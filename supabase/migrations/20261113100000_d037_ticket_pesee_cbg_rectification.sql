/*
  D-037 : CBG effectue la pesee au depot. Kogon integre le ticket source et
  le rapproche du voyage; aucune deuxieme pesee physique n'est demandee.
  Les rectifications sont append-only et gardent la valeur source.
*/

CREATE TABLE IF NOT EXISTS public.tickets_pesee_cbg (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL UNIQUE REFERENCES public.trips(id) ON DELETE RESTRICT,
  fiche_id uuid REFERENCES public.fiches_terrain(id) ON DELETE RESTRICT,
  site_id uuid REFERENCES public.sites(id) ON DELETE RESTRICT,
  ticket text NOT NULL CHECK (nullif(btrim(ticket), '') IS NOT NULL),
  brut numeric NOT NULL CHECK (brut > 0),
  tare numeric NOT NULL CHECK (tare >= 0 AND tare < brut),
  net numeric GENERATED ALWAYS AS (brut - tare) STORED,
  mesure_le timestamptz NOT NULL,
  document_ref text,
  saisi_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tickets_pesee_cbg_ticket_norm_uq
  ON public.tickets_pesee_cbg (upper(btrim(ticket)));
ALTER TABLE public.tickets_pesee_cbg ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tickets_pesee_cbg FROM anon, authenticated;
GRANT SELECT ON public.tickets_pesee_cbg TO authenticated;
GRANT ALL ON public.tickets_pesee_cbg TO service_role;
DROP POLICY IF EXISTS lecture_metier ON public.tickets_pesee_cbg;
CREATE POLICY lecture_metier ON public.tickets_pesee_cbg FOR SELECT TO authenticated
  USING (public.has_module_view('trips') OR public.has_module_view('invoices') OR public.is_admin());

-- Reprise des tickets CBG deja presents dans les evenements de reception.
WITH sources AS (
  SELECT DISTINCT ON (e.trip_id)
    e.trip_id, e.donnees, e.survenu_le, e.auteur,
    coalesce(nullif(e.donnees ->> 'fiche', ''), substring(e.note FROM 'Fiche ([A-Z]{2}-\d{6}-\d+)')) AS numero_fiche
  FROM public.trip_events e
  WHERE e.etat_apres = 'WEIGHED_IN' AND e.donnees ? 'ticket'
  ORDER BY e.trip_id, e.survenu_le DESC
)
INSERT INTO public.tickets_pesee_cbg
  (trip_id, fiche_id, site_id, ticket, brut, tare, mesure_le, saisi_par)
SELECT s.trip_id, f.id, t.arrival_site_id, btrim(s.donnees ->> 'ticket'),
  (s.donnees ->> 'brut')::numeric, (s.donnees ->> 'tare')::numeric, s.survenu_le, s.auteur
FROM sources s
JOIN public.trips t ON t.id = s.trip_id
LEFT JOIN public.fiches_terrain f ON f.numero = s.numero_fiche
WHERE nullif(btrim(s.donnees ->> 'ticket'), '') IS NOT NULL
  AND (s.donnees ->> 'brut')::numeric > (s.donnees ->> 'tare')::numeric
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.rectifications_tickets_pesee_cbg (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets_pesee_cbg(id) ON DELETE RESTRICT,
  ancien_ticket text NOT NULL,
  ancien_brut numeric NOT NULL,
  ancienne_tare numeric NOT NULL,
  ancien_net numeric NOT NULL,
  ancien_document_ref text,
  nouveau_ticket text NOT NULL CHECK (nullif(btrim(nouveau_ticket), '') IS NOT NULL),
  nouveau_brut numeric NOT NULL CHECK (nouveau_brut > 0),
  nouvelle_tare numeric NOT NULL CHECK (nouvelle_tare >= 0 AND nouvelle_tare < nouveau_brut),
  nouveau_net numeric GENERATED ALWAYS AS (nouveau_brut - nouvelle_tare) STORED,
  nouveau_document_ref text,
  motif text NOT NULL CHECK (nullif(btrim(motif), '') IS NOT NULL),
  corrige_par uuid REFERENCES auth.users(id),
  corrige_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rectifications_tickets_pesee_cbg_recente_idx
  ON public.rectifications_tickets_pesee_cbg (ticket_id, corrige_le DESC, id DESC);
ALTER TABLE public.rectifications_tickets_pesee_cbg ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rectifications_tickets_pesee_cbg FROM anon, authenticated;
GRANT SELECT ON public.rectifications_tickets_pesee_cbg TO authenticated;
GRANT ALL ON public.rectifications_tickets_pesee_cbg TO service_role;
DROP POLICY IF EXISTS lecture_metier ON public.rectifications_tickets_pesee_cbg;
CREATE POLICY lecture_metier ON public.rectifications_tickets_pesee_cbg FOR SELECT TO authenticated
  USING (public.has_module_view('trips') OR public.has_module_view('invoices') OR public.is_admin());

CREATE OR REPLACE FUNCTION public.refuser_mutation_ticket_cbg()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Preuve de pesee immuable : ajouter une rectification motivee' USING ERRCODE = '42501';
END;
$$;
DROP TRIGGER IF EXISTS tickets_pesee_cbg_immuables ON public.tickets_pesee_cbg;
CREATE TRIGGER tickets_pesee_cbg_immuables BEFORE UPDATE OR DELETE ON public.tickets_pesee_cbg
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_ticket_cbg();
DROP TRIGGER IF EXISTS rectifications_tickets_pesee_cbg_immuables ON public.rectifications_tickets_pesee_cbg;
CREATE TRIGGER rectifications_tickets_pesee_cbg_immuables BEFORE UPDATE OR DELETE ON public.rectifications_tickets_pesee_cbg
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_ticket_cbg();

CREATE OR REPLACE VIEW public.v_tickets_pesee_cbg_effectifs
WITH (security_invoker = true) AS
SELECT t.id, t.trip_id, t.fiche_id, t.site_id,
  coalesce(c.nouveau_ticket, t.ticket) AS ticket,
  coalesce(c.nouveau_brut, t.brut) AS brut,
  coalesce(c.nouvelle_tare, t.tare) AS tare,
  coalesce(c.nouveau_net, t.net) AS net,
  t.mesure_le,
  coalesce(c.nouveau_document_ref, t.document_ref) AS document_ref,
  t.saisi_par, t.cree_le,
  (c.id IS NOT NULL) AS est_rectifie,
  c.corrige_par, c.corrige_le, c.motif
FROM public.tickets_pesee_cbg t
LEFT JOIN LATERAL (
  SELECT r.* FROM public.rectifications_tickets_pesee_cbg r
  WHERE r.ticket_id = t.id ORDER BY r.corrige_le DESC, r.id DESC LIMIT 1
) c ON true;
GRANT SELECT ON public.v_tickets_pesee_cbg_effectifs TO authenticated;

ALTER TABLE public.reconciliation_lignes
  ADD COLUMN IF NOT EXISTS ticket_brut numeric,
  ADD COLUMN IF NOT EXISTS ticket_tare numeric,
  ADD COLUMN IF NOT EXISTS ticket_document_ref text,
  ADD COLUMN IF NOT EXISTS ticket_rectifie boolean NOT NULL DEFAULT false;

-- Re-evaluer les anomalies liees au ticket exige une decision neuve.
CREATE OR REPLACE FUNCTION public.decider_ligne_reconciliation(p_ligne_id uuid, p_decision text, p_motif text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE l public.reconciliation_lignes;
BEGIN
  IF NOT public.has_module_write('invoices') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la facturation requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO l FROM public.reconciliation_lignes WHERE id = p_ligne_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ligne introuvable' USING ERRCODE = 'P0002'; END IF;
  IF (SELECT statut FROM public.reconciliations WHERE id = l.reconciliation_id) <> 'ouverte' THEN
    RAISE EXCEPTION 'Reconciliation cloturee' USING ERRCODE = '22023';
  END IF;
  IF p_decision IS NOT NULL AND nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motif obligatoire pour une decision' USING ERRCODE = '22023';
  END IF;
  IF p_decision = 'facturable' AND l.tonnage_base IS NULL THEN
    RAISE EXCEPTION 'Tonnage de base absent : corriger le voyage puis actualiser' USING ERRCODE = '22023';
  END IF;
  IF p_decision = 'facturable' AND l.anomalies && ARRAY['base_absente', 'litige', 'rejet', 'sans_ticket_cbg', 'ticket_rectifie', 'ticket_double', 'non_accepte'] THEN
    RAISE EXCEPTION 'Anomalies a examiner avant de declarer la ligne facturable' USING ERRCODE = '22023';
  END IF;
  UPDATE public.reconciliation_lignes SET decision = p_decision,
    motif_decision = CASE WHEN p_decision IS NULL THEN NULL ELSE btrim(p_motif) END,
    decide_par = auth.uid(), decide_le = now() WHERE id = p_ligne_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.decider_ligne_reconciliation(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decider_ligne_reconciliation(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.rectifier_ticket_pesee_cbg(
  p_trip_id uuid, p_ticket text, p_brut numeric, p_tare numeric,
  p_document_ref text, p_motif text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  t public.tickets_pesee_cbg;
  e public.v_tickets_pesee_cbg_effectifs;
  v_id uuid;
BEGIN
  IF NOT (public.has_module_write('trips') AND public.has_module_write('invoices')) THEN
    RAISE EXCEPTION 'Droits voyages et facturation requis pour rectifier une pesee' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motif de rectification obligatoire' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce(p_ticket, '')), '') IS NULL OR p_brut IS NULL OR p_tare IS NULL
     OR p_brut <= p_tare OR p_tare < 0 THEN
    RAISE EXCEPTION 'Ticket, poids brut et tare coherents requis' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO t FROM public.tickets_pesee_cbg WHERE trip_id = p_trip_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket CBG introuvable pour ce voyage' USING ERRCODE = 'P0002'; END IF;
  IF EXISTS (SELECT 1 FROM public.reconciliations r JOIN public.reconciliation_lignes l ON l.reconciliation_id = r.id
    WHERE l.trip_id = p_trip_id AND r.statut = 'cloturee') THEN
    RAISE EXCEPTION 'Reconciliation cloturee : utiliser le circuit d''avoir, pas une rectification retroactive' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO e FROM public.v_tickets_pesee_cbg_effectifs WHERE id = t.id;
  IF e.saisi_par IS NULL OR e.saisi_par = auth.uid() THEN
    RAISE EXCEPTION 'La rectification doit etre saisie par une autre personne que l''auteur du ticket' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(upper(btrim(p_ticket)), 0));
  IF EXISTS (
    SELECT 1 FROM public.v_tickets_pesee_cbg_effectifs x
    WHERE upper(btrim(x.ticket)) = upper(btrim(p_ticket)) AND x.trip_id <> p_trip_id
  ) THEN RAISE EXCEPTION 'Ticket deja rattache a un autre voyage' USING ERRCODE = '23505'; END IF;
  INSERT INTO public.rectifications_tickets_pesee_cbg
    (ticket_id, ancien_ticket, ancien_brut, ancienne_tare, ancien_net, ancien_document_ref,
     nouveau_ticket, nouveau_brut, nouvelle_tare, nouveau_document_ref, motif, corrige_par)
  VALUES (t.id, e.ticket, e.brut, e.tare, e.net, e.document_ref,
    btrim(p_ticket), p_brut, p_tare, nullif(btrim(coalesce(p_document_ref, '')), ''), btrim(p_motif), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rectifier_ticket_pesee_cbg(uuid, text, numeric, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rectifier_ticket_pesee_cbg(uuid, text, numeric, numeric, text, text) TO authenticated;

-- La fiche demeure atomique : WEIGHED_IN et preuve CBG sont créés ensemble.
-- Une donnée de pesée à la sortie n'est plus acceptée comme ticket CBG.
CREATE OR REPLACE FUNCTION public.preparer_fiche(
  p_type text, p_date date, p_site_id uuid, p_shift_id uuid DEFAULT NULL,
  p_vehicle_id uuid DEFAULT NULL, p_driver_id uuid DEFAULT NULL, p_agent text DEFAULT NULL,
  p_options jsonb DEFAULT '{}'::jsonb, p_contenu jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_prefixe text; v_suite integer; v_id uuid;
BEGIN
  IF p_type NOT IN ('rotations', 'pointage_engins', 'carburant') THEN
    RAISE EXCEPTION 'Type de fiche inconnu : %', p_type USING ERRCODE = '22023';
  END IF;
  IF NOT public.has_module_write(public.fiche_module(p_type)) THEN
    RAISE EXCEPTION 'Droit d''ecriture requis pour ce type de fiche' USING ERRCODE = '42501';
  END IF;
  IF p_date IS NULL OR p_site_id IS NULL THEN RAISE EXCEPTION 'Date et site requis' USING ERRCODE = '22023'; END IF;
  IF p_type = 'rotations' AND p_vehicle_id IS NULL THEN RAISE EXCEPTION 'Une fiche de rotations porte sur un camion' USING ERRCODE = '22023'; END IF;
  IF p_type = 'rotations' AND coalesce(p_options ->> 'pesee', '') <> 'arrivee' THEN
    RAISE EXCEPTION 'Le ticket de pesee CBG est integre a la reception au depot' USING ERRCODE = '22023';
  END IF;
  v_prefixe := CASE p_type WHEN 'rotations' THEN 'FR' WHEN 'pointage_engins' THEN 'FP' ELSE 'FC' END || '-' || to_char(p_date, 'YYMMDD') || '-';
  PERFORM pg_advisory_xact_lock(hashtext('sigtb.fiche.' || v_prefixe));
  SELECT coalesce(max(substring(numero FROM '-(\d+)$')::int), 0) + 1 INTO v_suite FROM public.fiches_terrain WHERE numero LIKE v_prefixe || '%';
  INSERT INTO public.fiches_terrain (numero, type, date_fiche, site_id, shift_id, vehicle_id, driver_id, agent, options, contenu, prepare_par)
  VALUES (v_prefixe || lpad(v_suite::text, 3, '0'), p_type, p_date, p_site_id, p_shift_id, p_vehicle_id, p_driver_id,
    nullif(btrim(coalesce(p_agent, '')), ''), coalesce(p_options, '{}'::jsonb), coalesce(p_contenu, '[]'::jsonb), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.preparer_fiche(text, date, uuid, uuid, uuid, uuid, text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preparer_fiche(text, date, uuid, uuid, uuid, uuid, text, jsonb, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.saisir_rotation(p_fiche_id uuid, p_trip_id uuid, p_etapes jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  f public.fiches_terrain := public.fiche_ouverte(p_fiche_id, 'rotations');
  v public.trips;
  ordre CONSTANT text[] := ARRAY['DRAFT', 'PLANNED', 'ASSIGNED', 'AT_LOADING', 'LOADING', 'LOADED', 'WEIGHED_OUT',
    'IN_TRANSIT', 'AT_DESTINATION', 'UNLOADING', 'WEIGHED_IN', 'DELIVERED', 'ACCEPTED', 'CLOSED'];
  e jsonb; v_etat text; v_rang integer; v_ticket text;
BEGIN
  SELECT * INTO v FROM public.trips WHERE id = p_trip_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Voyage introuvable' USING ERRCODE = 'P0002'; END IF;
  IF v.vehicle_id IS DISTINCT FROM f.vehicle_id OR v.planned_date <> f.date_fiche THEN
    RAISE EXCEPTION 'Le voyage % n''appartient pas a la fiche % (camion ou date)', v.reference, f.numero USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_etapes) <> 'array' THEN RAISE EXCEPTION 'Etapes attendues sous forme de liste' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_etapes) x
    WHERE x ->> 'etat' = 'WEIGHED_OUT'
      AND ((x -> 'donnees') ? 'ticket' OR (x -> 'donnees') ? 'tonnage_cbg')) THEN
    RAISE EXCEPTION 'Le ticket CBG est integre a la pesee de reception au depot, pas au depart' USING ERRCODE = '22023';
  END IF;
  FOR e IN SELECT x FROM jsonb_array_elements(p_etapes) AS t(x)
    ORDER BY array_position(ordre, x ->> 'etat') NULLS LAST
  LOOP
    v_rang := array_position(ordre, e ->> 'etat');
    IF v_rang IS NULL THEN RAISE EXCEPTION 'Etape inconnue : %', e ->> 'etat' USING ERRCODE = '22023'; END IF;
    SELECT etat INTO v_etat FROM public.trips WHERE id = p_trip_id;
    v_ticket := nullif(btrim(coalesce(e -> 'donnees' ->> 'ticket', '')), '');
    IF array_position(ordre, v_etat) >= v_rang THEN
      IF e ->> 'etat' = 'WEIGHED_IN' AND v_ticket IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM public.tickets_pesee_cbg WHERE trip_id = p_trip_id) THEN
        RAISE EXCEPTION 'Voyage deja receptionne sans preuve CBG : corriger via la procedure de rectification' USING ERRCODE = '22023';
      END IF;
      CONTINUE;
    END IF;
    IF e ->> 'etat' = 'WEIGHED_OUT' AND (v_ticket IS NOT NULL OR e -> 'donnees' ? 'tonnage_cbg') THEN
      RAISE EXCEPTION 'Le ticket CBG est integre a la pesee de reception au depot, pas au depart' USING ERRCODE = '22023';
    END IF;
    IF e ->> 'etat' = 'WEIGHED_IN' AND v_ticket IS NOT NULL THEN
      IF coalesce(f.options ->> 'pesee', '') <> 'arrivee' THEN
        RAISE EXCEPTION 'Le ticket CBG doit etre integre a l''arrivee au depot' USING ERRCODE = '22023';
      END IF;
      IF v.arrival_site_id IS DISTINCT FROM f.site_id THEN
        RAISE EXCEPTION 'Le ticket CBG ne peut etre rattache qu''au depot de destination du voyage' USING ERRCODE = '22023';
      END IF;
    END IF;
    PERFORM public.avancer_voyage(p_trip_id, e ->> 'etat', (e ->> 'quand')::timestamptz,
      'Fiche ' || f.numero, coalesce(e -> 'donnees', '{}'::jsonb) || jsonb_build_object('fiche', f.numero));
    IF e ->> 'etat' = 'WEIGHED_IN' AND v_ticket IS NOT NULL THEN
      INSERT INTO public.tickets_pesee_cbg
        (trip_id, fiche_id, site_id, ticket, brut, tare, mesure_le, document_ref, saisi_par)
      VALUES (p_trip_id, p_fiche_id, v.arrival_site_id, v_ticket,
        (e -> 'donnees' ->> 'brut')::numeric, (e -> 'donnees' ->> 'tare')::numeric,
        (e ->> 'quand')::timestamptz,
        nullif(btrim(coalesce(e -> 'donnees' ->> 'document_ref', '')), ''), auth.uid());
    END IF;
  END LOOP;
  SELECT etat INTO v_etat FROM public.trips WHERE id = p_trip_id;
  RETURN v_etat;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.saisir_rotation(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saisir_rotation(uuid, uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.ligne_bloquee(p_anomalies text[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT p_anomalies && ARRAY['base_absente', 'litige', 'rejet', 'ecart_hors_tolerance',
    'ecart_double_pesee', 'sans_double_pesee', 'sans_ticket_cbg', 'ticket_rectifie',
    'ticket_double', 'non_accepte'];
$$;

CREATE OR REPLACE FUNCTION public.actualiser_reconciliation(p_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
    tonnage_charge, tonnage_recu, tonnage_accepte, tonnage_kogon, tonnage_cbg, tonnage_base, ticket, fiche, anomalies,
    ticket_brut, ticket_tare, ticket_document_ref, ticket_rectifie)
  SELECT gen_random_uuid(), r.id, t.id, t.reference, t.planned_date, t.vehicle_id, t.etat,
    coalesce(t.net_weight, t.load_weight), coalesce(p.net, t.net_weight_reception), t.accepted_tonnage,
    coalesce(t.net_weight, t.load_weight), p.net,
    CASE r.base_tonnage WHEN 'accepte' THEN t.accepted_tonnage WHEN 'recu' THEN coalesce(p.net, t.net_weight_reception)
      ELSE coalesce(t.net_weight, t.load_weight) END,
    coalesce(p.ticket, tk.ticket), fi.fiche,
    array_remove(ARRAY[
      CASE WHEN coalesce(t.net_weight, t.load_weight, p.net, t.net_weight_reception) IS NULL THEN 'sans_pesee' END,
      CASE WHEN (CASE r.base_tonnage WHEN 'accepte' THEN t.accepted_tonnage WHEN 'recu' THEN coalesce(p.net, t.net_weight_reception)
        ELSE coalesce(t.net_weight, t.load_weight) END) IS NULL THEN 'base_absente' END,
      CASE WHEN coalesce(t.net_weight, t.load_weight) > 0 AND coalesce(p.net, t.net_weight_reception) IS NOT NULL
        AND abs(coalesce(p.net, t.net_weight_reception) - coalesce(t.net_weight, t.load_weight)) / coalesce(t.net_weight, t.load_weight) * 100
          > r.tolerance_ecart_pct THEN 'ecart_hors_tolerance' END,
      CASE WHEN p.trip_id IS NULL THEN 'sans_ticket_cbg' END,
      CASE WHEN p.est_rectifie THEN 'ticket_rectifie' END,
      CASE WHEN t.etat = 'DISPUTED' THEN 'litige' END,
      CASE WHEN t.etat = 'REJECTED' THEN 'rejet' END,
      CASE WHEN r.base_tonnage = 'accepte' AND t.etat = 'DELIVERED' THEN 'non_accepte' END,
      CASE WHEN coalesce(p.ticket, tk.ticket) IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.trip_events e2 WHERE e2.donnees ? 'ticket'
          AND upper(btrim(e2.donnees ->> 'ticket')) = upper(btrim(coalesce(p.ticket, tk.ticket))) AND e2.trip_id <> t.id) THEN 'ticket_double' END,
      CASE WHEN fi.fiche IS NULL THEN 'sans_fiche' END
    ], NULL), p.brut, p.tare, p.document_ref, coalesce(p.est_rectifie, false)
  FROM public.trips t
  LEFT JOIN public.v_tickets_pesee_cbg_effectifs p ON p.trip_id = t.id
  LEFT JOIN LATERAL (
    SELECT e.donnees ->> 'ticket' AS ticket FROM public.trip_events e
    WHERE e.trip_id = t.id AND e.etat_apres = 'WEIGHED_IN' AND e.donnees ? 'ticket'
    ORDER BY e.survenu_le DESC LIMIT 1) tk ON true
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
    tonnage_charge, tonnage_recu, tonnage_accepte, tonnage_kogon, tonnage_cbg, tonnage_base, ticket, fiche, anomalies,
    ticket_brut, ticket_tare, ticket_document_ref, ticket_rectifie)
  SELECT reconciliation_id, trip_id, reference, date_voyage, vehicle_id, etat, tonnage_charge, tonnage_recu,
    tonnage_accepte, tonnage_kogon, tonnage_cbg, tonnage_base, ticket, fiche, anomalies,
    ticket_brut, ticket_tare, ticket_document_ref, ticket_rectifie
  FROM pg_temp.calcul_reconciliation
  ON CONFLICT (reconciliation_id, trip_id) DO UPDATE SET
    reference = EXCLUDED.reference, date_voyage = EXCLUDED.date_voyage, vehicle_id = EXCLUDED.vehicle_id,
    etat = EXCLUDED.etat, tonnage_charge = EXCLUDED.tonnage_charge, tonnage_recu = EXCLUDED.tonnage_recu,
    tonnage_accepte = EXCLUDED.tonnage_accepte, tonnage_kogon = EXCLUDED.tonnage_kogon, tonnage_cbg = EXCLUDED.tonnage_cbg,
    tonnage_base = EXCLUDED.tonnage_base, ticket = EXCLUDED.ticket, fiche = EXCLUDED.fiche, anomalies = EXCLUDED.anomalies,
    ticket_brut = EXCLUDED.ticket_brut, ticket_tare = EXCLUDED.ticket_tare,
    ticket_document_ref = EXCLUDED.ticket_document_ref, ticket_rectifie = EXCLUDED.ticket_rectifie;
  SELECT count(*) INTO n FROM public.reconciliation_lignes WHERE reconciliation_id = r.id;
  UPDATE public.reconciliations SET actualisee_le = now() WHERE id = r.id;
  RETURN n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.actualiser_reconciliation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.actualiser_reconciliation(uuid) TO authenticated;
