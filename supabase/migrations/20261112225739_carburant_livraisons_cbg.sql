/*
  # Livraisons de carburant CBG et controle des factures (D-034)

  Les prix sont saisis sur chaque livraison et ne sont jamais deduits.
  Le rapprochement d'une facture compare son total au total des livraisons
  explicitement rattachees. Tout ecart reste a examiner par une personne.
  La valorisation des distributions d'une periode utilise le prix moyen
  pondere par volume des livraisons CBG de cette periode ; sans livraison,
  le cout reste NULL (sans donnees).

  Les livraisons, factures et rapprochements sont en lecture seule via les
  tables. Les fonctions serveur controlees par has_module_write('fuel')
  sont la seule voie d'ecriture. Aucun deploiement n'est effectue ici.
*/

CREATE TABLE IF NOT EXISTS public.livraisons_carburant_cbg (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  date_livraison date NOT NULL,
  site_id uuid NOT NULL REFERENCES public.sites(id),
  volume_litres numeric NOT NULL CHECK (volume_litres > 0),
  prix_litre numeric NOT NULL CHECK (prix_litre > 0),
  montant numeric GENERATED ALWAYS AS (round(volume_litres * prix_litre, 2)) STORED,
  document_ref text,
  note text,
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_livraisons_cbg_date ON public.livraisons_carburant_cbg(date_livraison, site_id);

CREATE TABLE IF NOT EXISTS public.factures_carburant_cbg (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  date_facture date NOT NULL,
  montant_facture numeric NOT NULL CHECK (montant_facture >= 0),
  montant_attendu numeric,
  ecart numeric,
  statut text NOT NULL DEFAULT 'saisie' CHECK (statut IN ('saisie', 'conforme', 'a_examiner')),
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now(),
  controle_par uuid REFERENCES auth.users(id),
  controle_le timestamptz
);

CREATE TABLE IF NOT EXISTS public.factures_carburant_cbg_livraisons (
  facture_id uuid NOT NULL REFERENCES public.factures_carburant_cbg(id) ON DELETE RESTRICT,
  livraison_id uuid NOT NULL UNIQUE REFERENCES public.livraisons_carburant_cbg(id) ON DELETE RESTRICT,
  PRIMARY KEY (facture_id, livraison_id)
);

CREATE TABLE IF NOT EXISTS public.journal_factures_carburant_cbg (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  facture_id uuid NOT NULL REFERENCES public.factures_carburant_cbg(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('saisie', 'controle')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  auteur uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['livraisons_carburant_cbg', 'factures_carburant_cbg',
                           'factures_carburant_cbg_livraisons', 'journal_factures_carburant_cbg'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS lecture_module ON public.%I', t);
    EXECUTE format('CREATE POLICY lecture_module ON public.%I FOR SELECT TO authenticated
      USING (public.has_module_view(''fuel'') OR public.is_admin())', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.enregistrer_livraison_cbg(
  p_reference text, p_date date, p_site_id uuid, p_volume_litres numeric,
  p_prix_litre numeric, p_document_ref text DEFAULT NULL, p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_module_write('fuel') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur le carburant requis' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce(p_reference, '')), '') IS NULL OR p_date IS NULL OR p_site_id IS NULL
     OR p_volume_litres IS NULL OR p_volume_litres <= 0 OR p_prix_litre IS NULL OR p_prix_litre <= 0 THEN
    RAISE EXCEPTION 'Reference, date, site, litres et prix unitaire positifs requis' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.livraisons_carburant_cbg
    (reference, date_livraison, site_id, volume_litres, prix_litre, document_ref, note, cree_par)
  VALUES (btrim(p_reference), p_date, p_site_id, p_volume_litres, p_prix_litre,
          nullif(btrim(coalesce(p_document_ref, '')), ''), nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.enregistrer_facture_carburant_cbg(
  p_reference text, p_date date, p_montant numeric, p_livraison_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid; v_count integer;
BEGIN
  IF NOT public.has_module_write('fuel') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur le carburant requis' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce(p_reference, '')), '') IS NULL OR p_date IS NULL OR p_montant IS NULL OR p_montant < 0
     OR coalesce(cardinality(p_livraison_ids), 0) = 0 THEN
    RAISE EXCEPTION 'Reference, date, montant et au moins une livraison requis' USING ERRCODE = '22023';
  END IF;
  IF cardinality(p_livraison_ids) <> (SELECT count(DISTINCT x) FROM unnest(p_livraison_ids) x) THEN
    RAISE EXCEPTION 'Une livraison ne peut etre rattachee qu''une seule fois' USING ERRCODE = '22023';
  END IF;
  SELECT count(*) INTO v_count FROM public.livraisons_carburant_cbg WHERE id = ANY(p_livraison_ids);
  IF v_count <> cardinality(p_livraison_ids) THEN
    RAISE EXCEPTION 'Livraison absente ou deja rattachee a une autre facture' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.factures_carburant_cbg (reference, date_facture, montant_facture, cree_par)
  VALUES (btrim(p_reference), p_date, p_montant, auth.uid()) RETURNING id INTO v_id;
  INSERT INTO public.factures_carburant_cbg_livraisons (facture_id, livraison_id)
  SELECT v_id, x FROM unnest(p_livraison_ids) x;
  INSERT INTO public.journal_factures_carburant_cbg (facture_id, action, details, auteur)
  VALUES (v_id, 'saisie', jsonb_build_object('livraisons', p_livraison_ids, 'montant_facture', p_montant), auth.uid());
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.controler_facture_carburant_cbg(p_facture_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE f public.factures_carburant_cbg; v_attendu numeric; v_ecart numeric; v_statut text;
BEGIN
  IF NOT public.has_module_write('fuel') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur le carburant requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO f FROM public.factures_carburant_cbg WHERE id = p_facture_id FOR UPDATE;
  IF NOT FOUND OR f.statut <> 'saisie' THEN
    RAISE EXCEPTION 'Facture introuvable ou deja controlee' USING ERRCODE = '22023';
  END IF;
  SELECT round(sum(l.montant), 2) INTO v_attendu
  FROM public.factures_carburant_cbg_livraisons fl
  JOIN public.livraisons_carburant_cbg l ON l.id = fl.livraison_id
  WHERE fl.facture_id = p_facture_id;
  IF v_attendu IS NULL THEN
    RAISE EXCEPTION 'Aucune livraison rattachee a cette facture' USING ERRCODE = '22023';
  END IF;
  v_ecart := round(f.montant_facture - v_attendu, 2);
  v_statut := CASE WHEN v_ecart = 0 THEN 'conforme' ELSE 'a_examiner' END;
  UPDATE public.factures_carburant_cbg SET montant_attendu = v_attendu, ecart = v_ecart,
    statut = v_statut, controle_par = auth.uid(), controle_le = now() WHERE id = p_facture_id;
  INSERT INTO public.journal_factures_carburant_cbg (facture_id, action, details, auteur)
  VALUES (p_facture_id, 'controle', jsonb_build_object('montant_attendu', v_attendu,
    'montant_facture', f.montant_facture, 'ecart', v_ecart, 'statut', v_statut), auth.uid());
  RETURN v_statut;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enregistrer_livraison_cbg(text, date, uuid, numeric, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_livraison_cbg(text, date, uuid, numeric, numeric, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.enregistrer_facture_carburant_cbg(text, date, numeric, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_facture_carburant_cbg(text, date, numeric, uuid[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.controler_facture_carburant_cbg(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.controler_facture_carburant_cbg(uuid) TO authenticated;

-- Les fiches enregistrent les litres ; le prix vient des livraisons CBG.
ALTER TABLE public.fuel_transactions ALTER COLUMN unit_price DROP NOT NULL;
ALTER TABLE public.fuel_transactions ALTER COLUMN total_cost DROP NOT NULL;
ALTER TABLE public.fuel_transactions ALTER COLUMN total_amount DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.saisir_carburant(
  p_fiche_id uuid, p_prix_litre numeric, p_fournisseur text, p_lignes jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE f public.fiches_terrain := public.fiche_ouverte(p_fiche_id, 'carburant'); l jsonb; n integer := 0; v_litres numeric;
BEGIN
  IF EXISTS (SELECT 1 FROM public.fuel_transactions WHERE reference LIKE f.numero || '-%') THEN
    RAISE EXCEPTION 'Fiche % deja saisie', f.numero USING ERRCODE = '22023';
  END IF;
  FOR l IN SELECT x FROM jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) AS t(x) LOOP
    v_litres := (l ->> 'litres')::numeric;
    IF v_litres IS NULL OR v_litres <= 0 OR nullif(l ->> 'vehicle_id', '') IS NULL THEN
      RAISE EXCEPTION 'Engin et quantite en litres positive requis (ligne %)', n + 1 USING ERRCODE = '22023';
    END IF;
    n := n + 1;
    INSERT INTO public.fuel_transactions (transaction_date, vehicle_id, driver_id, volume_liters, quantity, unit_price,
      total_cost, total_amount, transaction_type, supplier, reference, site_id, odometer_reading, notes, created_by)
    VALUES (f.date_fiche, (l ->> 'vehicle_id')::uuid, nullif(l ->> 'driver_id', '')::uuid, v_litres, v_litres,
      NULL, NULL, NULL, 'refuel', 'CBG', f.numero || '-' || lpad(n::text, 2, '0'), f.site_id,
      nullif(l ->> 'compteur', '')::numeric, 'Fiche ' || f.numero, auth.uid());
  END LOOP;
  IF n = 0 THEN RAISE EXCEPTION 'Aucune ligne a saisir' USING ERRCODE = '22023'; END IF;
  RETURN n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.saisir_carburant(uuid, numeric, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saisir_carburant(uuid, numeric, text, jsonb) TO authenticated;

-- Le prix moyen pondere des livraisons de l'intervalle valorise les litres
-- distribues. Pas de livraison = NULL, jamais un cout a zero/invente.
CREATE OR REPLACE FUNCTION public.consommation_carburant(p_du date, p_au date)
RETURNS TABLE (
  vehicle_id uuid, litres numeric, cout numeric, pleins integer, tonnes numeric, voyages integer,
  heures_marche numeric, litres_par_tonne numeric, litres_par_heure numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH prix AS (
    SELECT sum(l.volume_litres * l.prix_litre) / nullif(sum(l.volume_litres), 0) AS moyen
    FROM public.livraisons_carburant_cbg l WHERE l.date_livraison BETWEEN p_du AND p_au
  ),
  pleins AS (
    SELECT f.vehicle_id, sum(coalesce(f.volume_liters, f.quantity)) AS litres,
           count(*)::integer AS n
    FROM public.fuel_transactions f
    WHERE f.transaction_date BETWEEN p_du AND p_au AND f.transaction_type = 'refuel' AND f.vehicle_id IS NOT NULL
    GROUP BY f.vehicle_id
  ),
  transports AS (
    SELECT t.vehicle_id, sum(coalesce(t.accepted_tonnage, t.net_weight_reception, t.net_weight, t.load_weight)) AS tonnes,
           count(*)::integer AS n
    FROM public.trips t
    WHERE t.planned_date BETWEEN p_du AND p_au AND t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')
      AND t.vehicle_id IS NOT NULL
    GROUP BY t.vehicle_id
  ),
  heures AS (
    SELECT p.vehicle_id, sum(p.heures_marche) AS h
    FROM public.pointages_engins p JOIN public.fiches_terrain fi ON fi.id = p.fiche_id
    WHERE fi.date_fiche BETWEEN p_du AND p_au GROUP BY p.vehicle_id
  )
  SELECT pl.vehicle_id, round(pl.litres, 2),
         CASE WHEN prix.moyen IS NOT NULL THEN round(pl.litres * prix.moyen, 2) END,
         pl.n, round(tr.tonnes, 2), coalesce(tr.n, 0), round(he.h, 2),
         CASE WHEN tr.tonnes > 0 THEN round(pl.litres / tr.tonnes, 3) END,
         CASE WHEN he.h > 0 THEN round(pl.litres / he.h, 2) END
         FROM pleins pl CROSS JOIN prix
         LEFT JOIN transports tr ON tr.vehicle_id = pl.vehicle_id
         LEFT JOIN heures he ON he.vehicle_id = pl.vehicle_id;
$$;
