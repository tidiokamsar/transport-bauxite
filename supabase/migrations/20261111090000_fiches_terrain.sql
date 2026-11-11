/*
  # Fiches terrain (phase 2 du poste charge de contrats, D-028)

  Fiches papier numerotees remises aux agents de terrain, puis saisies.
  Chaque donnee saisie garde le numero de sa fiche : la fiche signee est
  la preuve (D-013, sources « feuille de pointage signee »).

  1. `avancer_voyage` conserve aussi le numero de fiche et le ticket de
     pesee dans le journal du voyage ; un ticket deja utilise sur un autre
     voyage est refuse (doublon, CDC 13). Le reste de la fonction est
     inchange (migration 20261110120000).
  2. `fiches_terrain` : numero (FR rotations, FP pointage, FC carburant),
     date, site, shift, camion et chauffeur (rotations), agent, contenu
     prevu, cycle preparee -> remise -> retournee -> saisie, annulation
     motivee.
  3. `pointages_engins` : index d'horametre de debut et de fin par engin et
     par fiche ; heures de marche calculees.
  4. Fonctions : preparer_fiche, suivre_fiche, annuler_fiche,
     terminer_saisie_fiche, saisir_rotation (etapes d'un voyage en une
     transaction), saisir_pointage (avec arrets -> immobilisations),
     saisir_carburant (pleins -> fuel_transactions, prix saisi).

  Idempotent : IF NOT EXISTS, CREATE OR REPLACE, DROP ... IF EXISTS.
*/

-- 1. avancer_voyage : fiche et ticket au journal, doublon de ticket refuse
CREATE INDEX IF NOT EXISTS idx_trip_events_ticket ON public.trip_events ((donnees ->> 'ticket'))
  WHERE donnees ? 'ticket';

CREATE OR REPLACE FUNCTION public.avancer_voyage(
  p_trip_id uuid,
  p_etat text,
  p_survenu_le timestamptz DEFAULT now(),
  p_note text DEFAULT NULL,
  p_donnees jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v public.trips;
  v_dernier timestamptz;
  v_brut numeric;
  v_tare numeric;
  v_net numeric;
  v_accepte numeric;
  v_ticket text := nullif(btrim(coalesce(p_donnees ->> 'ticket', '')), '');
  v_fiche text := nullif(btrim(coalesce(p_donnees ->> 'fiche', '')), '');
BEGIN
  IF NOT (public.has_module_write('trips') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les voyages requis' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Voyage introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.transition_voyage_autorisee(v.etat, p_etat) THEN
    RAISE EXCEPTION 'Transition non autorisee : % vers %', v.etat, p_etat USING ERRCODE = '22023';
  END IF;

  IF p_survenu_le IS NULL OR p_survenu_le > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Heure de l''evenement absente ou dans le futur' USING ERRCODE = '22023';
  END IF;
  SELECT max(survenu_le) INTO v_dernier FROM public.trip_events
   WHERE trip_id = p_trip_id AND etat_avant IS NOT NULL;
  IF v_dernier IS NOT NULL AND p_survenu_le < v_dernier THEN
    RAISE EXCEPTION 'Heure anterieure au dernier evenement du voyage' USING ERRCODE = '22023';
  END IF;

  IF p_etat = 'ASSIGNED' AND (v.vehicle_id IS NULL OR v.driver_id IS NULL) THEN
    RAISE EXCEPTION 'Camion et chauffeur requis pour affecter le voyage' USING ERRCODE = '22023';
  END IF;
  IF p_etat IN ('INTERRUPTED', 'CANCELLED', 'DISPUTED', 'REJECTED') AND coalesce(trim(p_note), '') = '' THEN
    RAISE EXCEPTION 'Motif obligatoire' USING ERRCODE = '22023';
  END IF;

  IF p_etat IN ('WEIGHED_OUT', 'WEIGHED_IN') THEN
    v_brut := (p_donnees ->> 'brut')::numeric;
    v_tare := (p_donnees ->> 'tare')::numeric;
    IF v_brut IS NULL OR v_tare IS NULL OR v_brut <= v_tare OR v_tare < 0 THEN
      RAISE EXCEPTION 'Pesee incoherente : brut et tare requis, brut superieur a la tare' USING ERRCODE = '22023';
    END IF;
    v_net := v_brut - v_tare;
    IF v_ticket IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.trip_events e
      WHERE e.donnees ? 'ticket' AND e.donnees ->> 'ticket' = v_ticket AND e.trip_id <> p_trip_id
    ) THEN
      RAISE EXCEPTION 'Ticket de pesee % deja utilise sur un autre voyage', v_ticket USING ERRCODE = '23505';
    END IF;
  END IF;

  IF p_etat = 'ACCEPTED' THEN
    v_accepte := coalesce((p_donnees ->> 'accepte')::numeric, v.net_weight_reception, v.net_weight);
    IF v_accepte IS NULL OR v_accepte < 0 THEN
      RAISE EXCEPTION 'Tonnage accepte requis (aucune pesee enregistree)' USING ERRCODE = '22023';
    END IF;
  END IF;

  PERFORM set_config('sigtb.transition_voyage', 'on', true);
  UPDATE public.trips SET
    etat = p_etat,
    etat_modifie_le = now(),
    gross_weight = CASE WHEN p_etat = 'WEIGHED_OUT' THEN v_brut ELSE gross_weight END,
    tare_weight = CASE WHEN p_etat = 'WEIGHED_OUT' THEN v_tare ELSE tare_weight END,
    net_weight = CASE WHEN p_etat = 'WEIGHED_OUT' THEN v_net ELSE net_weight END,
    load_weight = CASE WHEN p_etat = 'WEIGHED_OUT' THEN v_net ELSE load_weight END,
    net_weight_reception = CASE WHEN p_etat = 'WEIGHED_IN' THEN v_net ELSE net_weight_reception END,
    accepted_tonnage = CASE WHEN p_etat = 'ACCEPTED' THEN v_accepte ELSE accepted_tonnage END,
    actual_departure_time = CASE WHEN p_etat = 'IN_TRANSIT' AND actual_departure_time IS NULL
                                 THEN p_survenu_le ELSE actual_departure_time END,
    actual_arrival_time = CASE WHEN p_etat = 'AT_DESTINATION' THEN p_survenu_le ELSE actual_arrival_time END
  WHERE id = p_trip_id;
  INSERT INTO public.trip_events (trip_id, etat_avant, etat_apres, survenu_le, auteur, note, donnees)
  VALUES (p_trip_id, v.etat, p_etat, p_survenu_le, auth.uid(), nullif(trim(p_note), ''),
          (CASE WHEN v_net IS NOT NULL THEN jsonb_build_object('brut', v_brut, 'tare', v_tare, 'net', v_net)
                WHEN v_accepte IS NOT NULL THEN jsonb_build_object('accepte', v_accepte)
                ELSE '{}'::jsonb END)
          || jsonb_strip_nulls(jsonb_build_object('fiche', v_fiche,
               'ticket', CASE WHEN v_net IS NOT NULL THEN v_ticket END)));
  PERFORM set_config('sigtb.transition_voyage', 'off', true);
END;
$$;

-- 2. Fiches terrain
CREATE TABLE IF NOT EXISTS public.fiches_terrain (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('rotations', 'pointage_engins', 'carburant')),
  date_fiche date NOT NULL,
  site_id uuid NOT NULL REFERENCES public.sites(id),
  shift_id uuid REFERENCES public.work_shifts(id),
  vehicle_id uuid REFERENCES public.vehicles(id),
  driver_id uuid REFERENCES public.drivers(id),
  agent text,
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  contenu jsonb NOT NULL DEFAULT '[]'::jsonb,
  statut text NOT NULL DEFAULT 'preparee' CHECK (statut IN ('preparee', 'remise', 'retournee', 'saisie', 'annulee')),
  prepare_par uuid REFERENCES auth.users(id),
  prepare_le timestamptz NOT NULL DEFAULT now(),
  remise_le timestamptz,
  retournee_le timestamptz,
  saisie_par uuid REFERENCES auth.users(id),
  saisie_le timestamptz,
  note text,
  motif_annulation text,
  CONSTRAINT fiches_rotations_camion CHECK (type <> 'rotations' OR vehicle_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_fiches_terrain_date ON public.fiches_terrain (date_fiche, site_id);

CREATE TABLE IF NOT EXISTS public.pointages_engins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiche_id uuid NOT NULL REFERENCES public.fiches_terrain(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id),
  operateur text,
  index_debut numeric NOT NULL CHECK (index_debut >= 0),
  index_fin numeric NOT NULL,
  heures_marche numeric GENERATED ALWAYS AS (index_fin - index_debut) STORED,
  observations text,
  saisi_par uuid REFERENCES auth.users(id),
  saisi_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fiche_id, vehicle_id),
  CONSTRAINT pointages_index CHECK (index_fin >= index_debut)
);

ALTER TABLE public.fiches_terrain ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pointages_engins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fiches_terrain, public.pointages_engins FROM anon, authenticated;
GRANT SELECT ON public.fiches_terrain, public.pointages_engins TO authenticated;
GRANT ALL ON public.fiches_terrain, public.pointages_engins TO service_role;
DROP POLICY IF EXISTS lecture_module ON public.fiches_terrain;
CREATE POLICY lecture_module ON public.fiches_terrain FOR SELECT TO authenticated USING (
  public.has_module_view('trips') OR public.has_module_view('maintenance') OR public.has_module_view('fuel') OR public.is_admin());
DROP POLICY IF EXISTS lecture_module ON public.pointages_engins;
CREATE POLICY lecture_module ON public.pointages_engins FOR SELECT TO authenticated USING (
  public.has_module_view('maintenance') OR public.has_module_view('contracts') OR public.is_admin());

-- Module de droits requis pour chaque type de fiche
CREATE OR REPLACE FUNCTION public.fiche_module(p_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_type WHEN 'rotations' THEN 'trips' WHEN 'pointage_engins' THEN 'maintenance' WHEN 'carburant' THEN 'fuel' END;
$$;

CREATE OR REPLACE FUNCTION public.fiche_ouverte(p_id uuid, p_type text)
RETURNS public.fiches_terrain
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  f public.fiches_terrain;
BEGIN
  SELECT * INTO f FROM public.fiches_terrain WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fiche introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF p_type IS NOT NULL AND f.type <> p_type THEN
    RAISE EXCEPTION 'Cette fiche n''est pas une fiche de ce type' USING ERRCODE = '22023';
  END IF;
  IF NOT public.has_module_write(public.fiche_module(f.type)) THEN
    RAISE EXCEPTION 'Droit d''ecriture requis pour ce type de fiche' USING ERRCODE = '42501';
  END IF;
  IF f.statut IN ('saisie', 'annulee') THEN
    RAISE EXCEPTION 'Fiche % close (%)', f.numero, f.statut USING ERRCODE = '22023';
  END IF;
  RETURN f;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fiche_ouverte(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.preparer_fiche(
  p_type text,
  p_date date,
  p_site_id uuid,
  p_shift_id uuid DEFAULT NULL,
  p_vehicle_id uuid DEFAULT NULL,
  p_driver_id uuid DEFAULT NULL,
  p_agent text DEFAULT NULL,
  p_options jsonb DEFAULT '{}'::jsonb,
  p_contenu jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_prefixe text;
  v_suite integer;
  v_id uuid;
BEGIN
  IF p_type NOT IN ('rotations', 'pointage_engins', 'carburant') THEN
    RAISE EXCEPTION 'Type de fiche inconnu : %', p_type USING ERRCODE = '22023';
  END IF;
  IF NOT public.has_module_write(public.fiche_module(p_type)) THEN
    RAISE EXCEPTION 'Droit d''ecriture requis pour ce type de fiche' USING ERRCODE = '42501';
  END IF;
  IF p_date IS NULL OR p_site_id IS NULL THEN
    RAISE EXCEPTION 'Date et site requis' USING ERRCODE = '22023';
  END IF;
  IF p_type = 'rotations' AND p_vehicle_id IS NULL THEN
    RAISE EXCEPTION 'Une fiche de rotations porte sur un camion' USING ERRCODE = '22023';
  END IF;
  IF p_type = 'rotations' AND coalesce(p_options ->> 'pesee', '') NOT IN ('depart', 'arrivee') THEN
    RAISE EXCEPTION 'Indiquer le lieu de la pesee (depart ou arrivee)' USING ERRCODE = '22023';
  END IF;

  v_prefixe := CASE p_type WHEN 'rotations' THEN 'FR' WHEN 'pointage_engins' THEN 'FP' ELSE 'FC' END
               || '-' || to_char(p_date, 'YYMMDD') || '-';
  PERFORM pg_advisory_xact_lock(hashtext('sigtb.fiche.' || v_prefixe));
  SELECT coalesce(max(substring(numero FROM '-(\d+)$')::int), 0) + 1 INTO v_suite
    FROM public.fiches_terrain WHERE numero LIKE v_prefixe || '%';

  INSERT INTO public.fiches_terrain (numero, type, date_fiche, site_id, shift_id, vehicle_id, driver_id, agent,
    options, contenu, prepare_par)
  VALUES (v_prefixe || lpad(v_suite::text, 3, '0'), p_type, p_date, p_site_id, p_shift_id, p_vehicle_id, p_driver_id,
    nullif(btrim(coalesce(p_agent, '')), ''), coalesce(p_options, '{}'::jsonb), coalesce(p_contenu, '[]'::jsonb), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Remise a l'agent, retour de la fiche remplie
CREATE OR REPLACE FUNCTION public.suivre_fiche(p_id uuid, p_etape text, p_agent text DEFAULT NULL, p_quand timestamptz DEFAULT now())
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f public.fiches_terrain := public.fiche_ouverte(p_id, NULL);
BEGIN
  IF p_quand IS NULL OR p_quand > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Heure absente ou dans le futur' USING ERRCODE = '22023';
  END IF;
  IF p_etape = 'remise' AND f.statut = 'preparee' THEN
    IF nullif(btrim(coalesce(p_agent, f.agent, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Nom de l''agent qui recoit la fiche requis' USING ERRCODE = '22023';
    END IF;
    UPDATE public.fiches_terrain SET statut = 'remise', remise_le = p_quand,
      agent = coalesce(nullif(btrim(coalesce(p_agent, '')), ''), agent) WHERE id = p_id;
  ELSIF p_etape = 'retournee' AND f.statut IN ('preparee', 'remise') THEN
    UPDATE public.fiches_terrain SET statut = 'retournee', retournee_le = p_quand,
      agent = coalesce(nullif(btrim(coalesce(p_agent, '')), ''), agent) WHERE id = p_id;
  ELSE
    RAISE EXCEPTION 'Etape % impossible depuis l''etat %', p_etape, f.statut USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.annuler_fiche(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f public.fiches_terrain := public.fiche_ouverte(p_id, NULL);
BEGIN
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motif obligatoire pour annuler une fiche' USING ERRCODE = '22023';
  END IF;
  IF f.type = 'pointage_engins' AND EXISTS (SELECT 1 FROM public.pointages_engins WHERE fiche_id = p_id) THEN
    RAISE EXCEPTION 'Fiche deja saisie en partie : terminer la saisie et corriger les lignes' USING ERRCODE = '22023';
  END IF;
  UPDATE public.fiches_terrain SET statut = 'annulee', motif_annulation = btrim(p_motif) WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.terminer_saisie_fiche(p_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f public.fiches_terrain := public.fiche_ouverte(p_id, NULL);
BEGIN
  IF f.statut = 'preparee' THEN
    RAISE EXCEPTION 'La fiche n''a pas ete remise ni retournee' USING ERRCODE = '22023';
  END IF;
  UPDATE public.fiches_terrain
  SET statut = 'saisie', saisie_par = auth.uid(), saisie_le = now(),
      retournee_le = coalesce(retournee_le, now()), note = nullif(btrim(coalesce(p_note, '')), '')
  WHERE id = p_id;
END;
$$;

-- 3. Saisie d'une ligne de fiche de rotations : les etapes d'un voyage,
-- dans l'ordre du cycle, en une transaction. Une etape deja atteinte est
-- ignoree (ressaisie sans doublon) ; une etape impossible arrete tout.
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
  e jsonb;
  v_etat text;
  v_rang integer;
BEGIN
  SELECT * INTO v FROM public.trips WHERE id = p_trip_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Voyage introuvable' USING ERRCODE = 'P0002';
  END IF;
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
    IF v_rang IS NULL THEN
      RAISE EXCEPTION 'Etape inconnue : %', e ->> 'etat' USING ERRCODE = '22023';
    END IF;
    SELECT etat INTO v_etat FROM public.trips WHERE id = p_trip_id;
    IF array_position(ordre, v_etat) >= v_rang THEN
      CONTINUE;
    END IF;
    PERFORM public.avancer_voyage(p_trip_id, e ->> 'etat', (e ->> 'quand')::timestamptz,
      'Fiche ' || f.numero, coalesce(e -> 'donnees', '{}'::jsonb) || jsonb_build_object('fiche', f.numero));
  END LOOP;
  SELECT etat INTO v_etat FROM public.trips WHERE id = p_trip_id;
  RETURN v_etat;
END;
$$;

-- Saisie d'un engin d'une fiche de pointage : index d'horametre et arrets
-- constates (chaque arret devient une immobilisation, D-025).
CREATE OR REPLACE FUNCTION public.saisir_pointage(
  p_fiche_id uuid,
  p_vehicle_id uuid,
  p_index_debut numeric,
  p_index_fin numeric,
  p_operateur text DEFAULT NULL,
  p_observations text DEFAULT NULL,
  p_arrets jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f public.fiches_terrain := public.fiche_ouverte(p_fiche_id, 'pointage_engins');
  a jsonb;
  v_id uuid;
  v_immo uuid;
BEGIN
  IF p_index_debut IS NULL OR p_index_fin IS NULL OR p_index_fin < p_index_debut THEN
    RAISE EXCEPTION 'Index d''horametre incoherents (fin inferieure au debut)' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.pointages_engins (fiche_id, vehicle_id, operateur, index_debut, index_fin, observations, saisi_par)
  VALUES (p_fiche_id, p_vehicle_id, nullif(btrim(coalesce(p_operateur, '')), ''), p_index_debut, p_index_fin,
    nullif(btrim(coalesce(p_observations, '')), ''), auth.uid())
  RETURNING id INTO v_id;

  FOR a IN SELECT x FROM jsonb_array_elements(coalesce(p_arrets, '[]'::jsonb)) AS t(x) LOOP
    v_immo := public.declarer_immobilisation(p_vehicle_id, (a ->> 'debut')::timestamptz, a ->> 'cause',
      a ->> 'imputation', coalesce(nullif(btrim(coalesce(a ->> 'description', '')), ''), 'Arret releve') || ' (fiche ' || f.numero || ')',
      a ->> 'reference_loueur');
    IF nullif(a ->> 'fin', '') IS NOT NULL THEN
      PERFORM public.cloturer_immobilisation(v_immo, (a ->> 'fin')::timestamptz, 'Fiche ' || f.numero);
    END IF;
  END LOOP;
  RETURN v_id;
END;
$$;

-- Saisie d'une fiche carburant : un plein par ligne. Le prix du litre est
-- saisi (facture du fournisseur ou prix de la cuve) : aucun prix invente.
CREATE OR REPLACE FUNCTION public.saisir_carburant(
  p_fiche_id uuid,
  p_prix_litre numeric,
  p_fournisseur text,
  p_lignes jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f public.fiches_terrain := public.fiche_ouverte(p_fiche_id, 'carburant');
  l jsonb;
  n integer := 0;
  v_litres numeric;
BEGIN
  IF p_prix_litre IS NULL OR p_prix_litre <= 0 THEN
    RAISE EXCEPTION 'Prix du litre requis (facture ou prix de la cuve)' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.fuel_transactions WHERE reference LIKE f.numero || '-%') THEN
    RAISE EXCEPTION 'Fiche % deja saisie' , f.numero USING ERRCODE = '22023';
  END IF;
  FOR l IN SELECT x FROM jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) AS t(x) LOOP
    v_litres := (l ->> 'litres')::numeric;
    IF v_litres IS NULL OR v_litres <= 0 THEN
      RAISE EXCEPTION 'Quantite en litres requise et positive (ligne %)', n + 1 USING ERRCODE = '22023';
    END IF;
    n := n + 1;
    INSERT INTO public.fuel_transactions (transaction_date, vehicle_id, driver_id, volume_liters, quantity, unit_price,
      total_cost, total_amount, transaction_type, supplier, reference, site_id, odometer_reading, notes, created_by)
    VALUES (f.date_fiche, (l ->> 'vehicle_id')::uuid, nullif(l ->> 'driver_id', '')::uuid, v_litres, v_litres, p_prix_litre,
      round(v_litres * p_prix_litre, 2), round(v_litres * p_prix_litre, 2), 'refuel',
      nullif(btrim(coalesce(p_fournisseur, '')), ''), f.numero || '-' || lpad(n::text, 2, '0'), f.site_id,
      nullif(l ->> 'compteur', '')::numeric, 'Fiche ' || f.numero, auth.uid());
  END LOOP;
  IF n = 0 THEN
    RAISE EXCEPTION 'Aucune ligne a saisir' USING ERRCODE = '22023';
  END IF;
  RETURN n;
END;
$$;

DO $$
DECLARE
  s text;
BEGIN
  FOREACH s IN ARRAY ARRAY[
    'public.preparer_fiche(text, date, uuid, uuid, uuid, uuid, text, jsonb, jsonb)',
    'public.suivre_fiche(uuid, text, text, timestamptz)',
    'public.annuler_fiche(uuid, text)',
    'public.terminer_saisie_fiche(uuid, text)',
    'public.saisir_rotation(uuid, uuid, jsonb)',
    'public.saisir_pointage(uuid, uuid, numeric, numeric, text, text, jsonb)',
    'public.saisir_carburant(uuid, numeric, text, jsonb)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', s);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', s);
  END LOOP;
END $$;
