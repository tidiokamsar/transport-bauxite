/*
  # Dispatch v1 : decisions d'affectation historisees (etape 4, D-024)

  CDC 11.1, 11.3 (affectation initiale, reaffectation, gestion des pannes,
  explication), 11.4 (contraintes jamais sacrifiees), 11.5 (le systeme
  recommande, le dispatcher decide, chaque decision est historisee).

  Cartographie (CDC 33) : `dispatch_assignments`, `dispatch_rules`,
  `dispatch_simulations` (Bolt, FleetOptimizer alimente par Math.random) ne
  portent ni la recommandation, ni la decision, ni son motif : non reprises.

  1. Table `decisions_dispatch` : recommandation (instantane et
     explication), decision (acceptee, modifiee, refusee), affectation
     retenue, motif, auteur, heure. Immuable.
  2. `preparer_voyages` : cree N voyages planifies (sans camion) pour une
     date, un site, un shift et une destination, a la demande du
     dispatcher (nombre propose par l'ecran depuis l'objectif).
  3. `decider_affectation` : controle les contraintes (camion actif de type
     benne, chauffeur actif au permis valide a la date du voyage, engin de
     chargement actif, chauffeur sur un seul camion par shift), applique
     l'affectation (voyage planifie -> affecte, ou reaffectation motivee
     d'un voyage affecte) et historise la decision ; un refus est historise
     sans rien changer.

  Droits : ceux des voyages (`trips`), lecture et ecriture.
  Idempotent : IF NOT EXISTS, CREATE OR REPLACE, DROP ... IF EXISTS.
*/

-- 1. Decisions
CREATE TABLE IF NOT EXISTS public.decisions_dispatch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('acceptee', 'modifiee', 'refusee')),
  nature text NOT NULL CHECK (nature IN ('affectation', 'reaffectation')),
  recommandation jsonb NOT NULL DEFAULT '{}'::jsonb,
  vehicle_id uuid REFERENCES public.vehicles(id),
  driver_id uuid REFERENCES public.drivers(id),
  loader_vehicle_id uuid REFERENCES public.vehicles(id),
  avant jsonb NOT NULL DEFAULT '{}'::jsonb,
  motif text,
  auteur uuid REFERENCES auth.users(id),
  decide_le timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT decisions_dispatch_motif CHECK (
    decision = 'acceptee' AND nature = 'affectation' OR motif IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_decisions_dispatch_trip ON public.decisions_dispatch (trip_id, decide_le);
CREATE INDEX IF NOT EXISTS idx_decisions_dispatch_date ON public.decisions_dispatch (decide_le);

ALTER TABLE public.decisions_dispatch ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.decisions_dispatch FROM anon, authenticated;
GRANT SELECT ON public.decisions_dispatch TO authenticated;
GRANT ALL ON public.decisions_dispatch TO service_role;
DROP POLICY IF EXISTS lecture_module ON public.decisions_dispatch;
CREATE POLICY lecture_module ON public.decisions_dispatch
  FOR SELECT TO authenticated USING (public.has_module_view('trips') OR public.is_admin());

-- 2. Preparation des voyages d'un shift
CREATE OR REPLACE FUNCTION public.preparer_voyages(
  p_date date,
  p_site_id uuid,
  p_destination_id uuid,
  p_shift_id uuid,
  p_nombre integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  i integer;
BEGIN
  IF NOT public.has_module_write('trips') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les voyages requis' USING ERRCODE = '42501';
  END IF;
  IF p_nombre IS NULL OR p_nombre < 1 OR p_nombre > 300 THEN
    RAISE EXCEPTION 'Nombre de voyages entre 1 et 300' USING ERRCODE = '22023';
  END IF;
  FOR i IN 1..p_nombre LOOP
    PERFORM public.creer_voyage(p_date, p_site_id, p_destination_id, NULL, NULL, NULL, NULL, p_shift_id,
      'Préparé par le dispatch');
  END LOOP;
  RETURN p_nombre;
END;
$$;

-- 3. Decision d'affectation
CREATE OR REPLACE FUNCTION public.decider_affectation(
  p_trip_id uuid,
  p_decision text,
  p_vehicle_id uuid,
  p_driver_id uuid,
  p_loader_vehicle_id uuid,
  p_recommandation jsonb DEFAULT '{}'::jsonb,
  p_motif text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v public.trips;
  v_nature text;
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
  v_camion public.vehicles;
  v_engin public.vehicles;
  v_chauffeur public.drivers;
  v_id uuid;
BEGIN
  IF NOT public.has_module_write('trips') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les voyages requis' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('acceptee', 'modifiee', 'refusee') THEN
    RAISE EXCEPTION 'Decision inconnue : %', p_decision USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Voyage introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v.etat IN ('DRAFT', 'PLANNED') THEN
    v_nature := 'affectation';
  ELSIF v.etat = 'ASSIGNED' THEN
    v_nature := 'reaffectation';
  ELSE
    RAISE EXCEPTION 'Voyage engage : l''affectation ne change plus' USING ERRCODE = '22023';
  END IF;
  IF (p_decision <> 'acceptee' OR v_nature = 'reaffectation') AND v_motif IS NULL THEN
    RAISE EXCEPTION 'Motif obligatoire pour une modification, un refus ou une reaffectation' USING ERRCODE = '22023';
  END IF;

  IF p_decision <> 'refusee' THEN
    -- Contraintes jamais sacrifiees (CDC 11.4)
    SELECT * INTO v_camion FROM public.vehicles WHERE id = p_vehicle_id;
    IF NOT FOUND OR v_camion.status <> 'active' OR v_camion.vehicle_type::text NOT IN ('tipper', 'flatbed') THEN
      RAISE EXCEPTION 'Camion indisponible ou inadapte' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_chauffeur FROM public.drivers WHERE id = p_driver_id;
    IF NOT FOUND OR v_chauffeur.status <> 'active' THEN
      RAISE EXCEPTION 'Chauffeur indisponible' USING ERRCODE = '22023';
    END IF;
    IF v_chauffeur.license_expiry < v.planned_date THEN
      RAISE EXCEPTION 'Permis du chauffeur expire a la date du voyage' USING ERRCODE = '22023';
    END IF;
    IF p_loader_vehicle_id IS NOT NULL THEN
      SELECT * INTO v_engin FROM public.vehicles WHERE id = p_loader_vehicle_id;
      IF NOT FOUND OR v_engin.status <> 'active' OR v_engin.vehicle_type::text NOT IN ('loader', 'excavator') THEN
        RAISE EXCEPTION 'Engin de chargement indisponible ou inadapte' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id <> v.id AND t.planned_date = v.planned_date
        AND t.shift_id IS NOT DISTINCT FROM v.shift_id
        AND t.driver_id = p_driver_id
        AND t.vehicle_id IS DISTINCT FROM p_vehicle_id
        AND t.etat NOT IN ('CANCELLED', 'REJECTED')
    ) THEN
      RAISE EXCEPTION 'Chauffeur deja affecte a un autre camion sur ce shift' USING ERRCODE = '22023';
    END IF;

    UPDATE public.trips
    SET vehicle_id = p_vehicle_id, driver_id = p_driver_id, loader_vehicle_id = p_loader_vehicle_id
    WHERE id = v.id;
    IF v_nature = 'affectation' THEN
      IF v.etat = 'DRAFT' THEN
        PERFORM public.avancer_voyage(v.id, 'PLANNED', now(), NULL, '{}'::jsonb);
      END IF;
      PERFORM public.avancer_voyage(v.id, 'ASSIGNED', now(), 'Dispatch : affectation ' || p_decision, '{}'::jsonb);
    END IF;
  END IF;

  INSERT INTO public.decisions_dispatch (
    trip_id, decision, nature, recommandation, vehicle_id, driver_id, loader_vehicle_id, avant, motif, auteur)
  VALUES (
    v.id, p_decision, v_nature, coalesce(p_recommandation, '{}'::jsonb),
    CASE WHEN p_decision <> 'refusee' THEN p_vehicle_id END,
    CASE WHEN p_decision <> 'refusee' THEN p_driver_id END,
    CASE WHEN p_decision <> 'refusee' THEN p_loader_vehicle_id END,
    jsonb_build_object('vehicle_id', v.vehicle_id, 'driver_id', v.driver_id, 'loader_vehicle_id', v.loader_vehicle_id, 'etat', v.etat),
    v_motif, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.preparer_voyages(date, uuid, uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preparer_voyages(date, uuid, uuid, uuid, integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.decider_affectation(uuid, text, uuid, uuid, uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decider_affectation(uuid, text, uuid, uuid, uuid, jsonb, text) TO authenticated;
