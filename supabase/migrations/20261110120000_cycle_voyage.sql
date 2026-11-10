/*
  # Cycle de voyage et journal d'evenements (CDC 12, CDC 31, etape 2 de
  # la reprise)

  1. `trips.etat` : les 14 etats du cycle et les 4 exceptionnels du CDC 12.
     L'ancien `status` (4 valeurs) reste, synchronise, pour les ecrans et
     indicateurs existants (planned, in_progress, completed, cancelled).
  2. `trips.loader_vehicle_id` (chargeuse), `net_weight_reception`
     (poids net a destination), `accepted_tonnage` (tonnage accepte) :
     CDC 13 distingue tonnes chargees, recues et acceptees.
  3. `trip_events` : journal non modifiable. Chaque transition enregistre
     l'heure reelle de l'evenement, l'auteur, l'origine (declare, detecte,
     valide) et les donnees de pesee.
  4. `creer_voyage` et `avancer_voyage` (SECURITY DEFINER, module trips) :
     seules voies pour creer un voyage et changer son etat. Un trigger
     refuse toute autre modification d'etat ou de poids, la creation
     directe d'un voyage deja engage, et la suppression d'un voyage engage
     (il s'annule).
  Les voyages existants recoivent un etat derive de leur statut, sans
  evenement invente. Idempotent.
*/

-- 1-2. Colonnes
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS etat text;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS loader_vehicle_id uuid REFERENCES public.vehicles(id);
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS net_weight_reception numeric;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS accepted_tonnage numeric;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS etat_modifie_le timestamptz;

UPDATE public.trips SET etat = CASE status
    WHEN 'planned' THEN 'PLANNED'
    WHEN 'in_progress' THEN 'IN_TRANSIT'
    WHEN 'completed' THEN 'DELIVERED'
    WHEN 'cancelled' THEN 'CANCELLED'
  END
WHERE etat IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trips_etat_check') THEN
    ALTER TABLE public.trips ADD CONSTRAINT trips_etat_check CHECK (etat IN (
      'DRAFT', 'PLANNED', 'ASSIGNED', 'AT_LOADING', 'LOADING', 'LOADED', 'WEIGHED_OUT',
      'IN_TRANSIT', 'AT_DESTINATION', 'UNLOADING', 'WEIGHED_IN', 'DELIVERED', 'ACCEPTED', 'CLOSED',
      'CANCELLED', 'INTERRUPTED', 'DISPUTED', 'REJECTED'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_trips_etat ON public.trips (etat);
CREATE INDEX IF NOT EXISTS idx_trips_planned_date ON public.trips (planned_date);

-- Statut historique deduit de l'etat
CREATE OR REPLACE FUNCTION public.statut_depuis_etat(p_etat text)
RETURNS public.trip_status
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT (CASE
    WHEN p_etat IN ('DRAFT', 'PLANNED', 'ASSIGNED') THEN 'planned'
    WHEN p_etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED') THEN 'completed'
    WHEN p_etat IN ('CANCELLED', 'REJECTED') THEN 'cancelled'
    ELSE 'in_progress'
  END)::public.trip_status;
$$;

-- 3. Journal des evenements
CREATE TABLE IF NOT EXISTS public.trip_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE RESTRICT,
  etat_avant text,
  etat_apres text NOT NULL,
  survenu_le timestamptz NOT NULL,
  enregistre_le timestamptz NOT NULL DEFAULT now(),
  origine text NOT NULL DEFAULT 'declare' CHECK (origine IN ('declare', 'detecte', 'valide')),
  auteur uuid REFERENCES auth.users(id),
  note text,
  donnees jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_trip_events_trip ON public.trip_events (trip_id, survenu_le);

ALTER TABLE public.trip_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trip_events FROM anon;
GRANT SELECT ON public.trip_events TO authenticated;
GRANT ALL ON public.trip_events TO service_role;
DROP POLICY IF EXISTS lecture_module ON public.trip_events;
CREATE POLICY lecture_module ON public.trip_events
  FOR SELECT TO authenticated USING (public.has_module_view('trips') OR public.is_admin());

-- Transitions autorisees
CREATE OR REPLACE FUNCTION public.transition_voyage_autorisee(p_de text, p_vers text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT (p_de, p_vers) IN (
    ('DRAFT', 'PLANNED'), ('PLANNED', 'ASSIGNED'), ('ASSIGNED', 'AT_LOADING'),
    ('AT_LOADING', 'LOADING'), ('LOADING', 'LOADED'), ('LOADED', 'WEIGHED_OUT'),
    ('LOADED', 'IN_TRANSIT'), ('WEIGHED_OUT', 'IN_TRANSIT'), ('IN_TRANSIT', 'AT_DESTINATION'),
    ('AT_DESTINATION', 'UNLOADING'), ('UNLOADING', 'WEIGHED_IN'), ('UNLOADING', 'DELIVERED'),
    ('WEIGHED_IN', 'DELIVERED'), ('DELIVERED', 'ACCEPTED'), ('DELIVERED', 'DISPUTED'),
    ('DELIVERED', 'REJECTED'), ('DISPUTED', 'ACCEPTED'), ('DISPUTED', 'REJECTED'),
    ('ACCEPTED', 'CLOSED'), ('REJECTED', 'CLOSED'),
    ('INTERRUPTED', 'IN_TRANSIT'), ('INTERRUPTED', 'AT_DESTINATION'), ('INTERRUPTED', 'CANCELLED')
  )
  OR (p_vers = 'CANCELLED' AND p_de IN ('DRAFT', 'PLANNED', 'ASSIGNED', 'AT_LOADING', 'LOADING', 'LOADED', 'WEIGHED_OUT'))
  OR (p_vers = 'INTERRUPTED' AND p_de IN ('LOADING', 'LOADED', 'WEIGHED_OUT', 'IN_TRANSIT', 'AT_DESTINATION', 'UNLOADING'));
$$;

-- 4a. Garde : l'etat, le statut et les poids ne changent que par
-- avancer_voyage ; un voyage engage ne se cree ni ne se supprime en direct.
CREATE OR REPLACE FUNCTION public.trips_garde_cycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  par_fonction boolean := coalesce(current_setting('sigtb.transition_voyage', true), '') = 'on';
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.etat IS NULL THEN
      NEW.etat := CASE NEW.status
        WHEN 'in_progress' THEN 'IN_TRANSIT' WHEN 'completed' THEN 'DELIVERED'
        WHEN 'cancelled' THEN 'CANCELLED' ELSE 'PLANNED' END;
    END IF;
    IF auth.uid() IS NOT NULL AND NOT par_fonction AND NEW.etat NOT IN ('DRAFT', 'PLANNED') THEN
      RAISE EXCEPTION 'Un voyage se cree a l''etat brouillon ou planifie, puis avance par transitions'
        USING ERRCODE = '42501';
    END IF;
    NEW.status := public.statut_depuis_etat(NEW.etat);
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF auth.uid() IS NOT NULL AND OLD.etat NOT IN ('DRAFT', 'PLANNED', 'ASSIGNED') THEN
      RAISE EXCEPTION 'Un voyage engage ne se supprime pas : il s''annule' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF auth.uid() IS NOT NULL AND NOT par_fonction THEN
    IF NEW.etat IS DISTINCT FROM OLD.etat
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.gross_weight IS DISTINCT FROM OLD.gross_weight
       OR NEW.tare_weight IS DISTINCT FROM OLD.tare_weight
       OR NEW.net_weight IS DISTINCT FROM OLD.net_weight
       OR NEW.net_weight_reception IS DISTINCT FROM OLD.net_weight_reception
       OR NEW.accepted_tonnage IS DISTINCT FROM OLD.accepted_tonnage
       OR NEW.actual_departure_time IS DISTINCT FROM OLD.actual_departure_time
       OR NEW.actual_arrival_time IS DISTINCT FROM OLD.actual_arrival_time THEN
      RAISE EXCEPTION 'Etat, poids et horaires changent par une transition du voyage'
        USING ERRCODE = '42501';
    END IF;
    IF OLD.etat NOT IN ('DRAFT', 'PLANNED', 'ASSIGNED') AND (
         NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id
         OR NEW.driver_id IS DISTINCT FROM OLD.driver_id
         OR NEW.loader_vehicle_id IS DISTINCT FROM OLD.loader_vehicle_id
         OR NEW.trailer_id IS DISTINCT FROM OLD.trailer_id
         OR NEW.departure_site_id IS DISTINCT FROM OLD.departure_site_id
         OR NEW.arrival_site_id IS DISTINCT FROM OLD.arrival_site_id) THEN
      RAISE EXCEPTION 'Voyage engage : affectation et sites ne changent plus' USING ERRCODE = '42501';
    END IF;
  END IF;
  NEW.status := public.statut_depuis_etat(NEW.etat);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trips_garde_cycle ON public.trips;
CREATE TRIGGER trips_garde_cycle
  BEFORE INSERT OR UPDATE OR DELETE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.trips_garde_cycle();

-- 4b. Creation d'un voyage
CREATE OR REPLACE FUNCTION public.creer_voyage(
  p_planned_date date,
  p_departure_site_id uuid,
  p_arrival_site_id uuid,
  p_vehicle_id uuid DEFAULT NULL,
  p_driver_id uuid DEFAULT NULL,
  p_loader_vehicle_id uuid DEFAULT NULL,
  p_trailer_id uuid DEFAULT NULL,
  p_shift_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_numero int;
  v_reference text;
  v_etat text;
BEGIN
  IF NOT (public.has_module_write('trips') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les voyages requis' USING ERRCODE = '42501';
  END IF;
  IF p_planned_date IS NULL OR p_departure_site_id IS NULL OR p_arrival_site_id IS NULL THEN
    RAISE EXCEPTION 'Date, origine et destination requises' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('sigtb.reference_voyage.' || p_planned_date::text));
  SELECT coalesce(max(substring(reference FROM '-(\d+)$')::int), 0) + 1 INTO v_numero
    FROM public.trips WHERE reference LIKE 'VYG-' || to_char(p_planned_date, 'YYMMDD') || '-%';
  v_reference := 'VYG-' || to_char(p_planned_date, 'YYMMDD') || '-' || lpad(v_numero::text, 3, '0');
  v_etat := CASE WHEN p_vehicle_id IS NOT NULL AND p_driver_id IS NOT NULL THEN 'ASSIGNED' ELSE 'PLANNED' END;

  PERFORM set_config('sigtb.transition_voyage', 'on', true);
  INSERT INTO public.trips (id, reference, planned_date, vehicle_id, driver_id, loader_vehicle_id, trailer_id,
                            departure_site_id, arrival_site_id, shift_id, material_type, notes, etat, etat_modifie_le)
  VALUES (v_id, v_reference, p_planned_date, p_vehicle_id, p_driver_id, p_loader_vehicle_id, p_trailer_id,
          p_departure_site_id, p_arrival_site_id, p_shift_id, 'bauxite', p_note, v_etat, now());
  INSERT INTO public.trip_events (trip_id, etat_avant, etat_apres, survenu_le, auteur, note)
  VALUES (v_id, NULL, v_etat, now(), auth.uid(), 'Création du voyage');
  PERFORM set_config('sigtb.transition_voyage', 'off', true);
  RETURN v_id;
END;
$$;

-- 4c. Transition d'etat
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
  -- L'ordre chronologique vaut entre evenements operationnels : la creation
  -- est datee de la saisie, un evenement peut etre declare apres coup.
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
          CASE WHEN v_net IS NOT NULL THEN jsonb_build_object('brut', v_brut, 'tare', v_tare, 'net', v_net)
               WHEN v_accepte IS NOT NULL THEN jsonb_build_object('accepte', v_accepte)
               ELSE '{}'::jsonb END);
  PERFORM set_config('sigtb.transition_voyage', 'off', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.creer_voyage(date, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.avancer_voyage(uuid, text, timestamptz, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.creer_voyage(date, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.avancer_voyage(uuid, text, timestamptz, text, jsonb) TO authenticated;
