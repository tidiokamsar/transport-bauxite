/*
  # Pesee double Kogon / CBG avant facturation (D-035)

  Choix de modele : colonnes sur trips (simple mais ne distingue pas les
  deux sources), JSON d'evenement seulement (souple mais fragile a requeter),
  ou preuve relationnelle immuable (retenue : deux mesures, ticket, fiche,
  voyage et auteur sont lies et la reconciliation en conserve un instantane).
  Les valeurs restent accessibles seulement en lecture via les droits trips
  ou invoices ; l'ecriture passe par saisir_rotation.
*/

CREATE TABLE IF NOT EXISTS public.pesees_doubles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL UNIQUE REFERENCES public.trips(id) ON DELETE RESTRICT,
  fiche_id uuid NOT NULL REFERENCES public.fiches_terrain(id) ON DELETE RESTRICT,
  ticket text NOT NULL UNIQUE,
  tonnage_kogon numeric NOT NULL CHECK (tonnage_kogon > 0),
  tonnage_cbg numeric NOT NULL CHECK (tonnage_cbg > 0),
  mesure_le timestamptz NOT NULL,
  saisi_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pesees_doubles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pesees_doubles FROM anon, authenticated;
GRANT SELECT ON public.pesees_doubles TO authenticated;
GRANT ALL ON public.pesees_doubles TO service_role;
DROP POLICY IF EXISTS lecture_metier ON public.pesees_doubles;
CREATE POLICY lecture_metier ON public.pesees_doubles FOR SELECT TO authenticated
  USING (public.has_module_view('trips') OR public.has_module_view('invoices') OR public.is_admin());

ALTER TABLE public.reconciliation_lignes
  ADD COLUMN IF NOT EXISTS tonnage_kogon numeric,
  ADD COLUMN IF NOT EXISTS tonnage_cbg numeric;

CREATE OR REPLACE FUNCTION public.ligne_bloquee(p_anomalies text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT p_anomalies && ARRAY['base_absente', 'litige', 'rejet', 'ecart_hors_tolerance',
    'ecart_double_pesee', 'sans_double_pesee', 'ticket_double', 'non_accepte'];
$$;

-- Chaque ligne de fiche reste atomique : l'evenement et les deux poids sont
-- ecrits dans la meme transaction. La pessee double est au depart, apres
-- chargement ; les lignes D-028 historiques sans mesure CBG restent visibles
-- et seront marquees "sans_double_pesee" a la reconciliation.
CREATE OR REPLACE FUNCTION public.saisir_rotation(p_fiche_id uuid, p_trip_id uuid, p_etapes jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f public.fiches_terrain := public.fiche_ouverte(p_fiche_id, 'rotations');
  v public.trips;
  ordre CONSTANT text[] := ARRAY['DRAFT', 'PLANNED', 'ASSIGNED', 'AT_LOADING', 'LOADING', 'LOADED', 'WEIGHED_OUT',
    'IN_TRANSIT', 'AT_DESTINATION', 'UNLOADING', 'WEIGHED_IN', 'DELIVERED', 'ACCEPTED', 'CLOSED'];
  e jsonb; v_etat text; v_rang integer; v_cbg numeric; v_kogon numeric;
BEGIN
  SELECT * INTO v FROM public.trips WHERE id = p_trip_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Voyage introuvable' USING ERRCODE = 'P0002'; END IF;
  IF v.vehicle_id IS DISTINCT FROM f.vehicle_id OR v.planned_date <> f.date_fiche THEN
    RAISE EXCEPTION 'Le voyage % n''appartient pas a la fiche % (camion ou date)', v.reference, f.numero USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_etapes) <> 'array' THEN
    RAISE EXCEPTION 'Etapes attendues sous forme de liste' USING ERRCODE = '22023';
  END IF;
  FOR e IN SELECT x FROM jsonb_array_elements(p_etapes) AS t(x)
    ORDER BY array_position(ordre, x ->> 'etat') NULLS LAST
  LOOP
    v_rang := array_position(ordre, e ->> 'etat');
    IF v_rang IS NULL THEN RAISE EXCEPTION 'Etape inconnue : %', e ->> 'etat' USING ERRCODE = '22023'; END IF;
    SELECT etat INTO v_etat FROM public.trips WHERE id = p_trip_id;
    IF array_position(ordre, v_etat) >= v_rang THEN CONTINUE; END IF;
    PERFORM public.avancer_voyage(p_trip_id, e ->> 'etat', (e ->> 'quand')::timestamptz,
      'Fiche ' || f.numero, coalesce(e -> 'donnees', '{}'::jsonb) || jsonb_build_object('fiche', f.numero));
    IF e ->> 'etat' = 'WEIGHED_OUT' AND e -> 'donnees' ? 'tonnage_cbg' THEN
      IF coalesce(f.options ->> 'pesee', '') <> 'depart' THEN
        RAISE EXCEPTION 'La double pesee Kogon / CBG doit etre faite au depart, apres chargement' USING ERRCODE = '22023';
      END IF;
      v_cbg := (e -> 'donnees' ->> 'tonnage_cbg')::numeric;
      SELECT net_weight INTO v_kogon FROM public.trips WHERE id = p_trip_id;
      IF v_cbg IS NULL OR v_cbg <= 0 OR v_kogon IS NULL OR v_kogon <= 0
         OR nullif(btrim(coalesce(e -> 'donnees' ->> 'ticket', '')), '') IS NULL THEN
        RAISE EXCEPTION 'Double pesee : poids net CBG positif et ticket requis' USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.pesees_doubles (trip_id, fiche_id, ticket, tonnage_kogon, tonnage_cbg, mesure_le, saisi_par)
      VALUES (p_trip_id, p_fiche_id, btrim(e -> 'donnees' ->> 'ticket'), v_kogon, v_cbg,
        (e ->> 'quand')::timestamptz, auth.uid());
    END IF;
  END LOOP;
  SELECT etat INTO v_etat FROM public.trips WHERE id = p_trip_id;
  RETURN v_etat;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.saisir_rotation(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saisir_rotation(uuid, uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.actualiser_reconciliation(p_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE r public.reconciliations; n integer;
BEGIN
  IF NOT public.has_module_write('invoices') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la facturation requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.reconciliations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reconciliation introuvable' USING ERRCODE = 'P0002'; END IF;
  IF r.statut <> 'ouverte' THEN RAISE EXCEPTION 'Reconciliation cloturee : elle ne change plus' USING ERRCODE = '22023'; END IF;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.calcul_reconciliation (LIKE public.reconciliation_lignes) ON COMMIT DROP;
  DELETE FROM pg_temp.calcul_reconciliation;
  INSERT INTO pg_temp.calcul_reconciliation (id, reconciliation_id, trip_id, reference, date_voyage, vehicle_id, etat,
    tonnage_charge, tonnage_recu, tonnage_accepte, tonnage_kogon, tonnage_cbg, tonnage_base, ticket, fiche, anomalies)
  SELECT gen_random_uuid(), r.id, t.id, t.reference, t.planned_date, t.vehicle_id, t.etat,
    coalesce(t.net_weight, t.load_weight), t.net_weight_reception, t.accepted_tonnage,
    pd.tonnage_kogon, pd.tonnage_cbg,
    CASE r.base_tonnage WHEN 'accepte' THEN t.accepted_tonnage WHEN 'recu' THEN t.net_weight_reception
      ELSE coalesce(t.net_weight, t.load_weight) END,
    coalesce(tk.ticket, pd.ticket), fi.fiche,
    array_remove(ARRAY[
      CASE WHEN coalesce(t.net_weight, t.load_weight) IS NULL AND t.net_weight_reception IS NULL THEN 'sans_pesee' END,
      CASE WHEN (CASE r.base_tonnage WHEN 'accepte' THEN t.accepted_tonnage WHEN 'recu' THEN t.net_weight_reception
        ELSE coalesce(t.net_weight, t.load_weight) END) IS NULL THEN 'base_absente' END,
      CASE WHEN coalesce(t.net_weight, t.load_weight) > 0 AND t.net_weight_reception IS NOT NULL
        AND abs(t.net_weight_reception - coalesce(t.net_weight, t.load_weight)) / coalesce(t.net_weight, t.load_weight) * 100
          > r.tolerance_ecart_pct THEN 'ecart_hors_tolerance' END,
      CASE WHEN pd.trip_id IS NULL THEN 'sans_double_pesee' END,
      CASE WHEN pd.trip_id IS NOT NULL AND abs(pd.tonnage_kogon - pd.tonnage_cbg) / pd.tonnage_kogon * 100
        > r.tolerance_ecart_pct THEN 'ecart_double_pesee' END,
      CASE WHEN t.etat = 'DISPUTED' THEN 'litige' END,
      CASE WHEN t.etat = 'REJECTED' THEN 'rejet' END,
      CASE WHEN r.base_tonnage = 'accepte' AND t.etat = 'DELIVERED' THEN 'non_accepte' END,
      CASE WHEN coalesce(tk.ticket, pd.ticket) IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.trip_events e2 WHERE e2.donnees ? 'ticket'
          AND e2.donnees ->> 'ticket' = coalesce(tk.ticket, pd.ticket) AND e2.trip_id <> t.id) THEN 'ticket_double' END,
      CASE WHEN fi.fiche IS NULL THEN 'sans_fiche' END
    ], NULL)
  FROM public.trips t
  LEFT JOIN public.pesees_doubles pd ON pd.trip_id = t.id
  LEFT JOIN LATERAL (
    SELECT e.donnees ->> 'ticket' AS ticket FROM public.trip_events e
    WHERE e.trip_id = t.id AND e.donnees ? 'ticket' ORDER BY e.survenu_le DESC LIMIT 1) tk ON true
  LEFT JOIN LATERAL (
    SELECT coalesce(e.donnees ->> 'fiche', substring(e.note FROM 'Fiche ([A-Z]{2}-\d{6}-\d+)')) AS fiche
    FROM public.trip_events e WHERE e.trip_id = t.id AND (e.donnees ? 'fiche' OR e.note LIKE 'Fiche %')
    ORDER BY e.survenu_le LIMIT 1) fi ON true
  WHERE t.planned_date BETWEEN r.periode_debut AND r.periode_fin
    AND t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED', 'REJECTED')
    AND (r.site_depart_id IS NULL OR t.departure_site_id = r.site_depart_id)
    AND (r.site_arrivee_id IS NULL OR t.arrival_site_id = r.site_arrivee_id);

  DELETE FROM public.reconciliation_lignes l WHERE l.reconciliation_id = r.id
    AND NOT EXISTS (SELECT 1 FROM pg_temp.calcul_reconciliation c WHERE c.trip_id = l.trip_id);
  INSERT INTO public.reconciliation_lignes (reconciliation_id, trip_id, reference, date_voyage, vehicle_id, etat,
    tonnage_charge, tonnage_recu, tonnage_accepte, tonnage_kogon, tonnage_cbg, tonnage_base, ticket, fiche, anomalies)
  SELECT reconciliation_id, trip_id, reference, date_voyage, vehicle_id, etat, tonnage_charge, tonnage_recu,
    tonnage_accepte, tonnage_kogon, tonnage_cbg, tonnage_base, ticket, fiche, anomalies
  FROM pg_temp.calcul_reconciliation
  ON CONFLICT (reconciliation_id, trip_id) DO UPDATE SET
    reference = EXCLUDED.reference, date_voyage = EXCLUDED.date_voyage, vehicle_id = EXCLUDED.vehicle_id,
    etat = EXCLUDED.etat, tonnage_charge = EXCLUDED.tonnage_charge, tonnage_recu = EXCLUDED.tonnage_recu,
    tonnage_accepte = EXCLUDED.tonnage_accepte, tonnage_kogon = EXCLUDED.tonnage_kogon, tonnage_cbg = EXCLUDED.tonnage_cbg,
    tonnage_base = EXCLUDED.tonnage_base, ticket = EXCLUDED.ticket, fiche = EXCLUDED.fiche, anomalies = EXCLUDED.anomalies;
  SELECT count(*) INTO n FROM public.reconciliation_lignes WHERE reconciliation_id = r.id;
  UPDATE public.reconciliations SET actualisee_le = now() WHERE id = r.id;
  RETURN n;
END;
$$;
