/*
  # Lot 2 — controles avant affectation (plan 2026-11-20, §§ 4.2 et 4.3)

  Les controles de disponibilite, d'immobilisation et d'affectation concurrente
  sont deja portes par le declencheur `garde_dispatch_disponibilite` (D-087).
  Cette migration ajoute uniquement le controle de tare exige par D-095, le
  controle de capacite et la restitution lisible des controles au dispatcher.

  La tare absente n'est jamais inventee : l'affectation est refusee, sauf
  derogation explicite avec motif. La derogation est journalisee dans
  `journal_tare` et dans la decision elle-meme. Aucune valeur CBG, aucun net
  calcule et aucune tare figee d'une rotation deja traitee ne sont modifies.

  Migration additive : aucune table creee, aucune ligne existante reecrite.
*/

-- 1. Lecture des controles pour un choix d'affectation donne.
CREATE OR REPLACE FUNCTION public.controles_avant_affectation(
  p_trip uuid,
  p_vehicle uuid,
  p_driver uuid,
  p_loader uuid
)
RETURNS TABLE (code text, libelle text, ok boolean, bloquant boolean, detail text, source text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH contexte AS (
    SELECT t.id, t.planned_date, t.shift_id,
           v.id AS vehicule_id, v.capacity_tonnes, v.contrat_id,
           d.id AS chauffeur_id, d.license_expiry, d.status AS chauffeur_statut,
           c.statut AS contrat_statut, c.date_debut, c.date_fin,
           public.habilitations_manquantes(p_driver, t.planned_date) AS habilitations_manquantes
      FROM public.trips t
      LEFT JOIN public.vehicles v ON v.id = p_vehicle
      LEFT JOIN public.drivers d ON d.id = p_driver
      LEFT JOIN public.contrats c ON c.id = v.contrat_id
     WHERE t.id = p_trip AND public.voyage_permis(t.id)
  ), documents AS (
    SELECT x.vehicule_id,
           count(DISTINCT vd.document_type) AS presents
      FROM contexte x
      JOIN public.vehicle_documents vd ON vd.vehicle_id = x.vehicule_id
     WHERE vd.status = 'active'
       AND vd.document_type IN ('insurance', 'registration', 'technical_inspection', 'transport_license')
       AND (vd.expiry_date IS NULL OR vd.expiry_date >= x.planned_date)
     GROUP BY x.vehicule_id
  ), controles AS (
    SELECT 'camion_actif'::text AS code, 'Camion disponible'::text AS libelle,
           (SELECT count(*) > 0 FROM contexte x
              JOIN public.vehicles vv ON vv.id = x.vehicule_id
             WHERE vv.status = 'active' AND vv.vehicle_type::text IN ('tipper','flatbed')) AS ok,
           true AS bloquant,
           'Le camion doit etre actif et adapte au transport'::text AS detail,
           'vehicles'::text AS source
    UNION ALL
    SELECT 'chauffeur_actif', 'Chauffeur disponible',
           (SELECT count(*) > 0 FROM contexte x WHERE x.chauffeur_statut = 'active'),
           true, 'Le chauffeur doit etre actif', 'drivers'
    UNION ALL
    SELECT 'permis_valide', 'Permis valide a la date',
           (SELECT count(*) > 0 FROM contexte x WHERE x.license_expiry >= x.planned_date),
           true, 'Le permis doit couvrir la date du voyage', 'drivers'
    UNION ALL
    SELECT 'habilitations', 'Habilitations du chauffeur',
           (SELECT count(*) > 0 FROM contexte x WHERE x.habilitations_manquantes IS NULL),
           true, 'Habilitations exigibles a la date du voyage', 'habilitations_chauffeur / habilitations_requises'
    UNION ALL
    SELECT 'tare_validee', 'Tare de reference validee',
           (SELECT EXISTS (SELECT 1 FROM contexte x
                             WHERE EXISTS (SELECT 1 FROM public.tare_applicable(x.vehicule_id, x.planned_date)))),
           true, 'Une tare validee applicable doit exister avant affectation (D-095)', 'tare_references'
    UNION ALL
    SELECT 'capacite_renseignee', 'Capacite renseignee',
           (SELECT count(*) > 0 FROM contexte x WHERE x.capacity_tonnes > 0),
           true, 'La capacite du camion doit etre positive', 'vehicles'
    UNION ALL
    SELECT 'immobilisation', 'Aucune immobilisation ouverte',
           NOT EXISTS (SELECT 1 FROM public.immobilisations i
                         WHERE i.vehicle_id IN (p_vehicle, p_loader) AND i.statut = 'ouverte'),
           true, 'Le camion ou l''engin ne doit pas etre immobilise', 'immobilisations'
    UNION ALL
    SELECT 'affectation_concurrente', 'Aucune affectation concurrente',
           NOT EXISTS (SELECT 1 FROM public.trips t
                         WHERE t.id <> p_trip AND t.planned_date = (SELECT planned_date FROM contexte)
                           AND (t.vehicle_id = p_vehicle OR (p_loader IS NOT NULL AND t.loader_vehicle_id = p_loader))
                           AND t.etat NOT IN ('CANCELLED','REJECTED','DELIVERED','ACCEPTED','CLOSED')),
           true, 'La ressource ne doit pas deja etre affectee sur ce shift', 'trips'
    UNION ALL
    SELECT 'contrat_actif', 'Contrat applicable',
           (SELECT count(*) > 0 FROM contexte x
             WHERE x.contrat_id IS NOT NULL AND x.contrat_statut = 'actif'
               AND x.planned_date >= x.date_debut
               AND (x.date_fin IS NULL OR x.planned_date <= x.date_fin)),
           false, 'Contrat renseigne, actif et couvrant la date du voyage', 'contrats / vehicles'
    UNION ALL
    SELECT 'documents_valides', 'Documents du camion a jour',
           (SELECT count(*) = 4 FROM documents),
           false, 'Assurance, immatriculation, visite technique et autorisation de transport', 'vehicle_documents'
  )
  SELECT c.code, c.libelle, c.ok, c.bloquant, c.detail, c.source
    FROM controles c
   WHERE EXISTS (SELECT 1 FROM contexte)
   ORDER BY c.bloquant DESC, c.code;
$$;
REVOKE ALL ON FUNCTION public.controles_avant_affectation(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.controles_avant_affectation(uuid, uuid, uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.controles_avant_affectation(uuid, uuid, uuid, uuid) IS
  'Controles de l''affectation avant decision. Les controles bloquants sont verifies cote serveur ; contrat et documents sont informatifs et ne inventent aucune donnee (lot 2, D-095).';

-- 2. Decision d'affectation : la tare validee devient obligatoire. Une
--    derogation motivee est autorisee, journalisee et conserve dans la decision.
-- L'ancienne signature est retiree : avec un argument par defaut, CREATE OR
-- REPLACE creerait une surcharge et les appels a 7 arguments continueraient
-- d'atteindre l'ancien corps sans controle de tare.
DROP FUNCTION IF EXISTS public.decider_affectation(uuid, text, uuid, uuid, uuid, jsonb, text);
CREATE OR REPLACE FUNCTION public.decider_affectation(
  p_trip_id uuid,
  p_decision text,
  p_vehicle_id uuid,
  p_driver_id uuid,
  p_loader_vehicle_id uuid,
  p_recommandation jsonb DEFAULT '{}'::jsonb,
  p_motif text DEFAULT NULL,
  p_derogation_motif text DEFAULT NULL
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
  v_derogation text := nullif(btrim(coalesce(p_derogation_motif, '')), '');
  v_derogations jsonb := '{}'::jsonb;
  v_camion public.vehicles;
  v_engin public.vehicles;
  v_chauffeur public.drivers;
  v_blocants text[];
  v_id uuid;
BEGIN
  IF NOT public.has_module_write('trips') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les voyages requis' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('acceptee', 'modifiee', 'refusee') THEN
    RAISE EXCEPTION 'Decision inconnue : %', p_decision USING ERRCODE = '22023';
  END IF;

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

    -- Seuls les nouveaux controles (tare et capacite) sont bloquants ici :
    -- disponibilite, immobilisation, habilitations et affectation concurrente
    -- restent verifies par les garde-fous existants (declencheurs D-087 et
    -- garde_habilitations), qui portent les messages metier attendus.
    SELECT array_agg(c.code) INTO v_blocants
      FROM public.controles_avant_affectation(v.id, p_vehicle_id, p_driver_id, p_loader_vehicle_id) c
     WHERE c.code IN ('tare_validee', 'capacite_renseignee') AND NOT c.ok;
    v_blocants := coalesce(v_blocants, '{}'::text[]);

    IF cardinality(v_blocants) > 0 AND NOT (v_blocants = ARRAY['tare_validee'] AND v_derogation IS NOT NULL) THEN
      RAISE EXCEPTION 'Controles d''affectation non satisfaits : %', array_to_string(v_blocants, ', ')
        USING ERRCODE = '22023', HINT = 'Renseigner une tare validee ou joindre un motif de derogation.';
    END IF;
    IF v_blocants = ARRAY['tare_validee'] THEN
      v_derogations := jsonb_build_object('tare_validee', v_derogation);
      v_motif := coalesce(v_motif, 'Derogation tare : ' || v_derogation);
    END IF;

    UPDATE public.trips
    SET vehicle_id = p_vehicle_id, driver_id = p_driver_id, loader_vehicle_id = p_loader_vehicle_id
    WHERE id = v.id;

    IF v_derogations <> '{}'::jsonb THEN
      PERFORM public.constater_tare_manquante(v.id, v_derogation);
    END IF;
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
    v.id, p_decision, v_nature,
    CASE WHEN v_derogations = '{}'::jsonb THEN coalesce(p_recommandation, '{}'::jsonb)
         ELSE jsonb_set(coalesce(p_recommandation, '{}'::jsonb), '{derogations}', v_derogations) END,
    CASE WHEN p_decision <> 'refusee' THEN p_vehicle_id END,
    CASE WHEN p_decision <> 'refusee' THEN p_driver_id END,
    CASE WHEN p_decision <> 'refusee' THEN p_loader_vehicle_id END,
    jsonb_build_object('vehicle_id', v.vehicle_id, 'driver_id', v.driver_id, 'loader_vehicle_id', v.loader_vehicle_id, 'etat', v.etat),
    v_motif, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.decider_affectation(uuid, text, uuid, uuid, uuid, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decider_affectation(uuid, text, uuid, uuid, uuid, jsonb, text, text) TO authenticated;

-- 3. Point d'entree avec controle de version : transmission du motif de
--    derogation jusqu'a la decision. Meme raisonnement sur la signature.
DROP FUNCTION IF EXISTS public.affecter_voyage(uuid, text, uuid, uuid, uuid, jsonb, text, integer);
CREATE OR REPLACE FUNCTION public.affecter_voyage(
  p_trip_id uuid,
  p_decision text,
  p_vehicle_id uuid,
  p_driver_id uuid,
  p_loader_vehicle_id uuid,
  p_recommandation jsonb,
  p_motif text,
  p_version_attendue integer,
  p_derogation_motif text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_version integer; r jsonb := coalesce(p_recommandation, '{}'::jsonb);
BEGIN
  IF NOT public.has_module_write('trips') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les voyages requis' USING ERRCODE = '42501';
  END IF;
  IF NOT public.voyage_permis(p_trip_id) THEN
    RAISE EXCEPTION 'Voyage introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF p_version_attendue IS NULL THEN
    RAISE EXCEPTION 'Version du voyage requise (recharger l''ecran)' USING ERRCODE = '22023';
  END IF;
  BEGIN
    PERFORM 1 FROM public.trips WHERE id = p_trip_id FOR UPDATE NOWAIT;
  EXCEPTION WHEN lock_not_available THEN
    RAISE EXCEPTION 'Voyage en cours de modification par un autre utilisateur : reessayer' USING ERRCODE = '40001';
  END;
  v_version := public.version_dispatch_voyage(p_trip_id);
  IF v_version <> p_version_attendue THEN
    RAISE EXCEPTION 'Voyage modifie entre-temps par un autre utilisateur (version % au lieu de %) : recharger avant de decider',
      v_version, p_version_attendue USING ERRCODE = '40001';
  END IF;
  IF p_decision = 'acceptee' AND (
       (r ? 'camion_id' AND (r->>'camion_id')::uuid IS DISTINCT FROM p_vehicle_id)
    OR (r ? 'chauffeur_id' AND (r->>'chauffeur_id')::uuid IS DISTINCT FROM p_driver_id)
    OR (r ? 'engin_id' AND (r->>'engin_id')::uuid IS DISTINCT FROM p_loader_vehicle_id)) THEN
    RAISE EXCEPTION 'Choix different de la recommandation : decision « modifiee » avec un motif' USING ERRCODE = '22023';
  END IF;
  RETURN public.decider_affectation(p_trip_id, p_decision, p_vehicle_id, p_driver_id, p_loader_vehicle_id,
                                   r, p_motif, p_derogation_motif);
END;
$$;
REVOKE ALL ON FUNCTION public.affecter_voyage(uuid, text, uuid, uuid, uuid, jsonb, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.affecter_voyage(uuid, text, uuid, uuid, uuid, jsonb, text, integer, text) TO authenticated;
