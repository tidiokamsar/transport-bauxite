/*
  # Perimetre site des lectures de la chaine J1 et J2 (D-075, complete D-038,
  # D-046 et D-072)

  Constat du 2026-11-16 (production, lecture seule) : neuf tables de la
  chaine de recette et de couts se lisaient avec le seul droit de module,
  sans borne de site, alors que la table parente (voyages, engins, sites)
  l'est depuis D-038 :
  - journal des voyages `trip_events` et decisions de dispatch
    `decisions_dispatch` (lecture `trips`) ;
  - tickets de pesee CBG `tickets_pesee_cbg` (lecture `trips` ou `invoices`) ;
  - immobilisations `immobilisations` et pointages `pointages_engins`
    (lecture `maintenance`, ou `contracts` pour les pointages) ;
  - objectifs de production `objectifs_production` (lecture `planning`,
    limite D-023 levee) ;
  - livraisons de carburant CBG `livraisons_carburant_cbg` et stocks
    `fuel_stocks` (lecture `fuel`) ;
  - positions GPS `vehicle_tracking` (lecture `gps_tracking`).
  Un compte affecte a un site lisait ainsi les evenements, tickets,
  immobilisations et positions des autres sites.

  Correction : chaque politique de lecture garde son droit de module et
  ajoute le perimetre ; un profil sans site reste global, une ligne sans site
  n'est visible que des profils globaux (D-038). Rattachements retenus apres
  revue independante : journal, decisions et tickets par le voyage (le site
  de depart comme celui d'arrivee voit le ticket, dont `site_id` est le site
  d'arrivee) ; pointages par la fiche terrain (comme la garde D-039 et les
  rapports) ; immobilisations par l'engin ; positions par l'engin ou par le
  voyage visible ; objectifs, livraisons et stocks par le site. Les tables
  filles `immobilisations_journal` et `rectifications_tickets_pesee_cbg`
  suivent la RLS de leur parent. Les ecritures navigateur
  heritees sur `vehicle_tracking` et `fuel_stocks` (aucun ecran n'y ecrit ;
  les positions arrivent par `ingest_gps_data` en service_role) et sur
  `trip_events` (journal immuable, ecrit par les fonctions du cycle) sont
  retirees : une position saisie depuis le navigateur ne serait pas une
  mesure.

  Ecritures (revue independante de D-066, defaut constate sur main) :
  `decider_affectation` lisait le camion et le chauffeur sans perimetre ; un
  compte affecte a un site pouvait affecter le camion et le chauffeur d'un
  autre site. Le perimetre du voyage et des ressources est controle avant
  toute lecture, et une garde sur `trips` refuse toute affectation d'une
  ressource hors perimetre (creation, dispatch, enchainement).

  Idempotent. Aucune donnee modifiee.
*/

DROP POLICY IF EXISTS lecture_module ON public.trip_events;
CREATE POLICY lecture_module ON public.trip_events FOR SELECT TO authenticated
  USING ((public.has_module_view('trips') OR public.is_admin()) AND public.voyage_permis(trip_id));
REVOKE ALL ON public.trip_events FROM anon, authenticated;
GRANT SELECT ON public.trip_events TO authenticated;

DROP POLICY IF EXISTS lecture_module ON public.decisions_dispatch;
CREATE POLICY lecture_module ON public.decisions_dispatch FOR SELECT TO authenticated
  USING ((public.has_module_view('trips') OR public.is_admin()) AND public.voyage_permis(trip_id));

DROP POLICY IF EXISTS lecture_metier ON public.tickets_pesee_cbg;
CREATE POLICY lecture_metier ON public.tickets_pesee_cbg FOR SELECT TO authenticated
  USING ((public.has_module_view('trips') OR public.has_module_view('invoices') OR public.is_admin())
         AND public.voyage_permis(trip_id));
-- Rectifications des tickets : celles des tickets visibles seulement (RLS du ticket)
DROP POLICY IF EXISTS lecture_metier ON public.rectifications_tickets_pesee_cbg;
CREATE POLICY lecture_metier ON public.rectifications_tickets_pesee_cbg FOR SELECT TO authenticated
  USING ((public.has_module_view('trips') OR public.has_module_view('invoices') OR public.is_admin())
         AND EXISTS (SELECT 1 FROM public.tickets_pesee_cbg t WHERE t.id = ticket_id));

DROP POLICY IF EXISTS lecture_module ON public.immobilisations;
CREATE POLICY lecture_module ON public.immobilisations FOR SELECT TO authenticated
  USING ((public.has_module_view('maintenance') OR public.is_admin()) AND public.vehicule_permis(vehicle_id));
-- Journal des immobilisations : celui des immobilisations visibles (RLS du parent)
DROP POLICY IF EXISTS lecture_module ON public.immobilisations_journal;
CREATE POLICY lecture_module ON public.immobilisations_journal FOR SELECT TO authenticated
  USING ((public.has_module_view('maintenance') OR public.is_admin())
         AND EXISTS (SELECT 1 FROM public.immobilisations i WHERE i.id = immobilisation_id));

DROP POLICY IF EXISTS lecture_module ON public.pointages_engins;
CREATE POLICY lecture_module ON public.pointages_engins FOR SELECT TO authenticated
  USING ((public.has_module_view('maintenance') OR public.has_module_view('contracts') OR public.is_admin())
         AND EXISTS (SELECT 1 FROM public.fiches_terrain f WHERE f.id = fiche_id AND public.site_permis(f.site_id)));

DROP POLICY IF EXISTS lecture_module ON public.objectifs_production;
CREATE POLICY lecture_module ON public.objectifs_production FOR SELECT TO authenticated
  USING ((public.has_module_view('planning') OR public.is_admin()) AND public.site_permis(site_id));

DROP POLICY IF EXISTS lecture_module ON public.livraisons_carburant_cbg;
CREATE POLICY lecture_module ON public.livraisons_carburant_cbg FOR SELECT TO authenticated
  USING ((public.has_module_view('fuel') OR public.is_admin()) AND public.site_permis(site_id));

DROP POLICY IF EXISTS lecture_module ON public.fuel_stocks;
DROP POLICY IF EXISTS ecriture_module ON public.fuel_stocks;
DROP POLICY IF EXISTS "Admins full access" ON public.fuel_stocks;
CREATE POLICY lecture_module ON public.fuel_stocks FOR SELECT TO authenticated
  USING ((public.has_module_view('fuel') OR public.is_admin()) AND public.site_permis(site_id));
REVOKE ALL ON public.fuel_stocks FROM anon, authenticated;
GRANT SELECT ON public.fuel_stocks TO authenticated;

DROP POLICY IF EXISTS lecture_module ON public.vehicle_tracking;
DROP POLICY IF EXISTS ecriture_module ON public.vehicle_tracking;
DROP POLICY IF EXISTS "Admins full access" ON public.vehicle_tracking;
CREATE POLICY lecture_module ON public.vehicle_tracking FOR SELECT TO authenticated
  USING ((public.has_module_view('gps_tracking') OR public.is_admin())
         AND (public.vehicule_permis(vehicle_id) OR (trip_id IS NOT NULL AND public.voyage_permis(trip_id))));
REVOKE ALL ON public.vehicle_tracking FROM anon, authenticated;
GRANT SELECT ON public.vehicle_tracking TO authenticated;


-- Affectation d'un camion, d'un engin ou d'un chauffeur d'un autre site
-- (constat de la revue independante de D-066, defaut de main) ----------------
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

  -- Perimetre avant toute lecture (D-075) : un message unique, qui ne revele
  -- ni l'existence ni l'etat d'une ressource d'un autre site.
  IF NOT public.voyage_permis(p_trip_id) THEN
    RAISE EXCEPTION 'Voyage introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF p_decision <> 'refusee' AND (
       (p_vehicle_id IS NOT NULL AND NOT public.vehicule_permis(p_vehicle_id))
    OR (p_loader_vehicle_id IS NOT NULL AND NOT public.vehicule_permis(p_loader_vehicle_id))
    OR (p_driver_id IS NOT NULL AND NOT public.site_permis((SELECT d.site_id FROM public.drivers d WHERE d.id = p_driver_id)))) THEN
    RAISE EXCEPTION 'Camion, engin ou chauffeur hors de votre perimetre' USING ERRCODE = '42501';
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
REVOKE EXECUTE ON FUNCTION public.decider_affectation(uuid, text, uuid, uuid, uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decider_affectation(uuid, text, uuid, uuid, uuid, jsonb, text) TO authenticated;

-- Garde : toute affectation d'une ressource a un voyage (creation, dispatch,
-- enchainement, reaffectation) reste dans le perimetre de l'auteur. Sans
-- session (maintenance, service_role), la garde laisse passer.
CREATE OR REPLACE FUNCTION public.garde_trips_ressources_perimetre()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.vehicle_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id)
     AND NOT public.vehicule_permis(NEW.vehicle_id) THEN
    RAISE EXCEPTION 'Camion hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  IF NEW.loader_vehicle_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.loader_vehicle_id IS DISTINCT FROM OLD.loader_vehicle_id)
     AND NOT public.vehicule_permis(NEW.loader_vehicle_id) THEN
    RAISE EXCEPTION 'Engin de chargement hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  IF NEW.driver_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.driver_id IS DISTINCT FROM OLD.driver_id)
     AND NOT public.site_permis((SELECT d.site_id FROM public.drivers d WHERE d.id = NEW.driver_id)) THEN
    RAISE EXCEPTION 'Chauffeur hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.garde_trips_ressources_perimetre() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garde_trips_ressources_perimetre ON public.trips;
-- Nom choisi pour passer avant `garde_habilitations_voyage` (ordre alphabetique) :
-- aucun message sur un chauffeur d'un autre site.
DROP TRIGGER IF EXISTS garde_a_ressources_perimetre ON public.trips;
CREATE TRIGGER garde_a_ressources_perimetre BEFORE INSERT OR UPDATE OF vehicle_id, loader_vehicle_id, driver_id ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.garde_trips_ressources_perimetre();
