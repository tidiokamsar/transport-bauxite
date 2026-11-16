/*
  # Dispatch, voyages et infractions (D-066, lot 06, modules 06, 07, 09)

  Etend l'existant sans le dupliquer : cycle voyage (20261110120000,
  `creer_voyage`, `avancer_voyage`, garde `trips_garde_cycle`), dispatch v1
  (20261110180000, `decider_affectation`, `decisions_dispatch`, gardes D-047
  site ferme et D-051 habilitations), incidents (20261117120000,
  `declarer_incident`).

  1. `durees_voyages(debut, fin)` (INVOKER) : pour chaque voyage visible,
     duree du cycle (arrivee au chargement -> livraison) et duree de
     rotation (arrivee au chargement -> arrivee au chargement suivante du
     meme camion, meme date et meme shift), mesurees sur le journal
     `trip_events`. Aucune duree n'est estimee : absence = NULL.
  2. `statistiques_trajets(site, shift, jusqua, jours)` (INVOKER) : par
     destination, voyages livres, charge moyenne, cycle et rotation moyens
     observes avec le nombre de mesures. Sert a la simulation de scenarios,
     calculee dans l'ecran ; rien n'est ecrit.
  3. `affecter_en_groupe(affectations)` : plusieurs voyages prepares
     acceptes en une operation ; chaque voyage passe par
     `decider_affectation` dans son propre sous-bloc (point de sauvegarde) :
     un refus serveur n'annule que ce voyage. Rapport par voyage (affecte ou
     refuse, avec la raison).
  4. `enchainer_voyage(voyage, chargeuse, suivant, date, shift,
     recommandation)` : reaffectation directe apres livraison. Le meme
     camion et le meme chauffeur prennent un voyage prepare du meme site de
     chargement, ou un nouveau voyage sur le meme trajet, sans retour au
     parking (le cycle n'a pas d'etat parking : PLANNED -> ASSIGNED par
     `decider_affectation`, contraintes et historisation inchangees).
     Refus si le camion est deja engage sur un autre voyage.
  5. `rapport_voyages(debut, fin, axe, site)` (INVOKER) : par camion,
     chauffeur, site de chargement ou shift : voyages, livres, annules,
     tonnes livrees (convention D-023) et voyages livres sans poids, cycle
     et rotation moyens, incidents (D-054), litiges (voyages passes par
     DISPUTED).
  6. Infractions des chauffeurs : `infractions_chauffeur` (numero INF,
     type, date, lieu, voyage et engin eventuels, constat, source) et
     `sanctions_infraction` (sanction decidee par une personne habilitee,
     motif). Append-only : correction par annulation motivee. Ecriture par
     `enregistrer_infraction`, `annuler_infraction`, `decider_sanction`,
     `annuler_sanction`. Lecture : modules drivers ou trips, perimetre du
     chauffeur ou du voyage.

  Droits : voyages et dispatch W(trips) ; infractions W(drivers) ou
  W(trips) ; sanctions A(drivers) ou administrateur. Idempotent.

  Integration sur main apres D-072, D-071 et D-063 (renumerotee au-dessus
  de 20261121090000, D-070). Aucune fonction existante n'est recreee :
  `decider_affectation`, `creer_voyage` et `avancer_voyage` sont appelees
  telles quelles, avec leurs gardes (D-039 site, D-047 site ferme, D-072
  R2-C2 `garde_habilitations_voyage` sur trips et
  `garde_dispatch_habilitations` sur decisions_dispatch) : un chauffeur non
  habilite est refuse a l'affectation groupee (ligne « refuse ») et a
  l'enchainement (l'operation entiere est annulee). Les lectures INVOKER
  n'appellent aucune fonction retiree aux comptes (`site_rattache`, bornee
  au perimetre par D-072 R3-7, reste executable). Ajouts de l'integration :
  perimetre du voyage controle avant toute lecture dans
  `affecter_en_groupe` (aucune reference hors perimetre dans le rapport) ;
  `enchainer_voyage` refuse un chauffeur engage sur un autre voyage et un
  voyage suivant hors perimetre ; `enregistrer_infraction` controle le
  perimetre du voyage et de l'engin avant leur coherence (pas d'oracle) ;
  sequence et garde du registre fermees aux comptes.

  Revue independante de l'integration (constats 2 a 8) : conflits
  transitoires (classes 40 et 55) relances par `affecter_en_groupe`, jamais
  rapportes comme refus ; `enchainer_voyage` controle le perimetre avant tout
  verrou, ne donne la reference d'un voyage engageant que dans le perimetre,
  et exige une date pour un voyage livre avant la veille ; une infraction
  reste lisible et traitable par le site ou elle a ete saisie apres mutation
  du chauffeur. Le perimetre du camion et du chauffeur dans
  `decider_affectation` est traite a part (D-075).
*/

-- 1. Durees mesurees par voyage
CREATE OR REPLACE FUNCTION public.durees_voyages(p_debut date, p_fin date)
RETURNS TABLE (
  trip_id uuid, vehicle_id uuid, driver_id uuid, planned_date date, shift_id uuid,
  departure_site_id uuid, arrival_site_id uuid, etat text, livre boolean, tonnes numeric,
  debut_chargement timestamptz, livre_le timestamptz, cycle_min numeric, rotation_min numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH t AS (
    SELECT t.id, t.vehicle_id, t.driver_id, t.planned_date, t.shift_id, t.departure_site_id, t.arrival_site_id, t.etat,
           t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED') AS livre,
           coalesce(t.accepted_tonnage, t.net_weight_reception, t.net_weight, t.load_weight) AS tonnes
      FROM public.trips t
     WHERE t.planned_date BETWEEN p_debut AND p_fin
  ),
  ev AS (
    SELECT e.trip_id,
           min(e.survenu_le) FILTER (WHERE e.etat_apres = 'AT_LOADING') AS debut,
           max(e.survenu_le) FILTER (WHERE e.etat_apres = 'DELIVERED') AS fin
      FROM public.trip_events e
     WHERE e.trip_id IN (SELECT id FROM t)
     GROUP BY e.trip_id
  ),
  j AS (
    SELECT t.*, ev.debut, ev.fin,
           CASE WHEN t.vehicle_id IS NOT NULL AND ev.debut IS NOT NULL THEN
             lead(ev.debut) OVER (PARTITION BY t.vehicle_id, t.planned_date, t.shift_id, (ev.debut IS NULL) ORDER BY ev.debut)
           END AS suivant
      FROM t LEFT JOIN ev ON ev.trip_id = t.id
  )
  SELECT j.id, j.vehicle_id, j.driver_id, j.planned_date, j.shift_id, j.departure_site_id, j.arrival_site_id, j.etat,
         j.livre, j.tonnes, j.debut, j.fin,
         CASE WHEN j.livre AND j.fin > j.debut THEN round((extract(epoch FROM j.fin - j.debut) / 60)::numeric, 1) END,
         CASE WHEN j.livre AND j.fin > j.debut AND j.suivant >= j.fin
              THEN round((extract(epoch FROM j.suivant - j.debut) / 60)::numeric, 1) END
    FROM j;
$$;
REVOKE EXECUTE ON FUNCTION public.durees_voyages(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.durees_voyages(date, date) TO authenticated;

-- 2. Statistiques observees par destination (simulation)
CREATE OR REPLACE FUNCTION public.statistiques_trajets(
  p_site_id uuid, p_shift_id uuid, p_jusqua date, p_jours integer DEFAULT 14
) RETURNS TABLE (
  arrival_site_id uuid, jours_observes integer, voyages_livres integer, charge_moyenne numeric, voyages_pesees integer,
  cycle_moyen_min numeric, cycles_mesures integer, rotation_moyenne_min numeric, rotations_mesurees integer,
  rotation_min_observee numeric, rotation_max_observee numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT d.arrival_site_id,
         count(DISTINCT d.planned_date) FILTER (WHERE d.livre)::integer,
         count(*) FILTER (WHERE d.livre)::integer,
         round(avg(d.tonnes) FILTER (WHERE d.livre AND d.tonnes > 0), 2),
         count(*) FILTER (WHERE d.livre AND d.tonnes > 0)::integer,
         round(avg(d.cycle_min), 0),
         count(d.cycle_min)::integer,
         round(avg(d.rotation_min), 0),
         count(d.rotation_min)::integer,
         min(d.rotation_min),
         max(d.rotation_min)
    FROM public.durees_voyages(p_jusqua - greatest(1, least(coalesce(p_jours, 14), 90)), p_jusqua - 1) d
   WHERE d.departure_site_id = p_site_id
     AND (p_shift_id IS NULL OR d.shift_id = p_shift_id)
     AND d.arrival_site_id IS NOT NULL
   GROUP BY d.arrival_site_id
  HAVING count(*) FILTER (WHERE d.livre) > 0;
$$;
REVOKE EXECUTE ON FUNCTION public.statistiques_trajets(uuid, uuid, date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.statistiques_trajets(uuid, uuid, date, integer) TO authenticated;

-- 3. Affectation groupee
-- p_affectations : [{"voyage": uuid, "camion": uuid, "chauffeur": uuid,
--                    "engin": uuid|null, "recommandation": {...}}]
CREATE OR REPLACE FUNCTION public.affecter_en_groupe(p_affectations jsonb)
RETURNS TABLE (trip_id uuid, reference text, resultat text, decision_id uuid, raison text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  e jsonb;
  v_trip uuid;
  v_ref text;
  v_etat text;
  v_decision uuid;
BEGIN
  IF NOT public.has_module_write('trips') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les voyages requis' USING ERRCODE = '42501';
  END IF;
  IF p_affectations IS NULL OR jsonb_typeof(p_affectations) <> 'array' OR jsonb_array_length(p_affectations) = 0 THEN
    RAISE EXCEPTION 'Liste d''affectations requise' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_affectations) > 300 THEN
    RAISE EXCEPTION 'Au plus 300 voyages par operation' USING ERRCODE = '22023';
  END IF;

  FOR e IN SELECT x FROM jsonb_array_elements(p_affectations) x LOOP
    v_trip := NULL; v_ref := NULL; v_etat := NULL; v_decision := NULL;
    BEGIN
      v_trip := (e ->> 'voyage')::uuid;
      IF v_trip IS NULL THEN
        RAISE EXCEPTION 'Voyage requis' USING ERRCODE = '22023';
      END IF;
      -- Perimetre avant toute lecture : aucune reference hors perimetre dans le rapport.
      IF NOT public.voyage_permis(v_trip) THEN
        RAISE EXCEPTION 'Voyage hors de votre perimetre' USING ERRCODE = '42501';
      END IF;
      SELECT t.reference, t.etat INTO v_ref, v_etat FROM public.trips t WHERE t.id = v_trip;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Voyage introuvable' USING ERRCODE = 'P0002';
      END IF;
      IF v_etat NOT IN ('DRAFT', 'PLANNED') THEN
        RAISE EXCEPTION 'Voyage deja affecte ou engage : une reaffectation se decide une par une, avec motif'
          USING ERRCODE = '22023';
      END IF;
      v_decision := public.decider_affectation(
        v_trip, 'acceptee', (e ->> 'camion')::uuid, (e ->> 'chauffeur')::uuid, nullif(e ->> 'engin', '')::uuid,
        coalesce(e -> 'recommandation', '{}'::jsonb) || '{"operation": "groupee"}'::jsonb, NULL);
      trip_id := v_trip; reference := v_ref; resultat := 'affecte'; decision_id := v_decision; raison := NULL;
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      -- Conflit transitoire (classe 40 : interblocage, serialisation ; 55 :
      -- verrou indisponible) : l'operation entiere echoue et se rejoue, le
      -- voyage n'est jamais declare refuse a tort.
      IF left(SQLSTATE, 2) IN ('40', '55') THEN
        RAISE;
      END IF;
      trip_id := v_trip; reference := v_ref; resultat := 'refuse'; decision_id := NULL; raison := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.affecter_en_groupe(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.affecter_en_groupe(jsonb) TO authenticated;

-- 4. Reaffectation directe apres livraison
CREATE OR REPLACE FUNCTION public.enchainer_voyage(
  p_trip_id uuid,
  p_loader_vehicle_id uuid DEFAULT NULL,
  p_suivant uuid DEFAULT NULL,
  p_date date DEFAULT NULL,
  p_shift_id uuid DEFAULT NULL,
  p_recommandation jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v public.trips;
  s public.trips;
  v_engage uuid;
  v_ref_engage text;
  v_date date;
  v_suivant uuid;
BEGIN
  IF NOT public.has_module_write('trips') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les voyages requis' USING ERRCODE = '42501';
  END IF;
  -- Perimetre avant tout verrou ni lecture.
  IF p_trip_id IS NULL OR NOT public.voyage_permis(p_trip_id) THEN
    RAISE EXCEPTION 'Voyage hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Voyage introuvable' USING ERRCODE = 'P0002'; END IF;
  IF v.etat NOT IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED', 'REJECTED') THEN
    RAISE EXCEPTION 'Le voyage doit etre livre pour enchainer le suivant' USING ERRCODE = '22023';
  END IF;
  IF v.vehicle_id IS NULL OR v.driver_id IS NULL THEN
    RAISE EXCEPTION 'Voyage sans camion ou sans chauffeur' USING ERRCODE = '22023';
  END IF;
  -- Ressources hors perimetre : message unique de D-075 avant toute lecture
  -- de leur engagement (aucun oracle sur leur etat).
  IF NOT public.vehicule_permis(v.vehicle_id)
     OR NOT public.site_permis((SELECT d.site_id FROM public.drivers d WHERE d.id = v.driver_id)) THEN
    RAISE EXCEPTION 'Camion, engin ou chauffeur hors de votre perimetre' USING ERRCODE = '42501';
  END IF;

  -- Un seul enchainement a la fois par camion.
  PERFORM pg_advisory_xact_lock(hashtext('sigtb.enchainement.' || v.vehicle_id::text));
  -- La reference du voyage qui engage deja le camion ou le chauffeur n'est
  -- donnee que s'il est dans le perimetre de l'appelant.
  SELECT t.id, t.reference INTO v_engage, v_ref_engage FROM public.trips t
   WHERE t.vehicle_id = v.vehicle_id AND t.id <> v.id
     AND t.etat IN ('ASSIGNED', 'AT_LOADING', 'LOADING', 'LOADED', 'WEIGHED_OUT', 'IN_TRANSIT',
                    'AT_DESTINATION', 'UNLOADING', 'WEIGHED_IN', 'INTERRUPTED')
   ORDER BY t.planned_date, t.reference LIMIT 1;
  IF v_engage IS NOT NULL THEN
    IF public.voyage_permis(v_engage) THEN
      RAISE EXCEPTION 'Camion deja engage sur le voyage %', v_ref_engage USING ERRCODE = '22023';
    END IF;
    RAISE EXCEPTION 'Camion deja engage sur un autre voyage' USING ERRCODE = '22023';
  END IF;
  -- Le chauffeur suit le camion : il ne doit pas etre engage ailleurs.
  SELECT t.id, t.reference INTO v_engage, v_ref_engage FROM public.trips t
   WHERE t.driver_id = v.driver_id AND t.id <> v.id
     AND t.etat IN ('ASSIGNED', 'AT_LOADING', 'LOADING', 'LOADED', 'WEIGHED_OUT', 'IN_TRANSIT',
                    'AT_DESTINATION', 'UNLOADING', 'WEIGHED_IN', 'INTERRUPTED')
   ORDER BY t.planned_date, t.reference LIMIT 1;
  IF v_engage IS NOT NULL THEN
    IF public.voyage_permis(v_engage) THEN
      RAISE EXCEPTION 'Chauffeur deja engage sur le voyage %', v_ref_engage USING ERRCODE = '22023';
    END IF;
    RAISE EXCEPTION 'Chauffeur deja engage sur un autre voyage' USING ERRCODE = '22023';
  END IF;

  IF p_suivant IS NOT NULL THEN
    IF NOT public.voyage_permis(p_suivant) THEN
      RAISE EXCEPTION 'Voyage suivant hors de votre perimetre' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO s FROM public.trips WHERE id = p_suivant FOR UPDATE;
    IF NOT FOUND OR s.etat NOT IN ('DRAFT', 'PLANNED') OR s.vehicle_id IS NOT NULL
       OR s.departure_site_id IS DISTINCT FROM v.departure_site_id OR s.planned_date < v.planned_date THEN
      RAISE EXCEPTION 'Voyage suivant : un voyage prepare sans camion, du meme site de chargement' USING ERRCODE = '22023';
    END IF;
    v_suivant := s.id;
  ELSE
    -- Sans date fournie, la date du voyage livre ; refusee si ce voyage est
    -- ancien (un enchainement se decide le jour meme ou le lendemain).
    IF p_date IS NULL AND v.planned_date < current_date - 1 THEN
      RAISE EXCEPTION 'Voyage livre du % : preciser la date du voyage suivant', to_char(v.planned_date, 'DD/MM/YYYY')
        USING ERRCODE = '22023';
    END IF;
    v_date := coalesce(p_date, v.planned_date);
    IF v_date < v.planned_date THEN
      RAISE EXCEPTION 'Date du voyage suivant anterieure au voyage livre' USING ERRCODE = '22023';
    END IF;
    v_suivant := public.creer_voyage(v_date, v.departure_site_id, v.arrival_site_id, NULL, NULL, NULL, v.trailer_id,
                                     CASE WHEN p_date IS NULL THEN v.shift_id ELSE p_shift_id END,
                                     'Enchaîné après ' || v.reference);
  END IF;

  PERFORM public.decider_affectation(
    v_suivant, 'acceptee', v.vehicle_id, v.driver_id, p_loader_vehicle_id,
    coalesce(p_recommandation, '{}'::jsonb)
      || jsonb_build_object('regle', 'enchainement', 'voyage_precedent', v.reference), NULL);
  RETURN v_suivant;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enchainer_voyage(uuid, uuid, uuid, date, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enchainer_voyage(uuid, uuid, uuid, date, uuid, jsonb) TO authenticated;

-- 5. Rapports par camion, chauffeur, site, shift
CREATE OR REPLACE FUNCTION public.rapport_voyages(p_debut date, p_fin date, p_axe text, p_site uuid DEFAULT NULL)
RETURNS TABLE (
  cle uuid, libelle text, voyages integer, livres integer, annules integer, tonnes numeric, livres_sans_poids integer,
  cycle_moyen_min numeric, cycles_mesures integer, rotation_moyenne_min numeric, rotations_mesurees integer,
  incidents integer, litiges integer)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
#variable_conflict use_column
BEGIN
  IF p_axe IS NULL OR p_axe NOT IN ('camion', 'chauffeur', 'site', 'shift') THEN
    RAISE EXCEPTION 'Axe du rapport : camion, chauffeur, site ou shift' USING ERRCODE = '22023';
  END IF;
  IF p_debut IS NULL OR p_fin IS NULL OR p_fin < p_debut OR p_fin - p_debut > 366 THEN
    RAISE EXCEPTION 'Periode requise, d''au plus 367 jours' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  WITH d AS (
    SELECT x.*,
           CASE p_axe WHEN 'camion' THEN x.vehicle_id WHEN 'chauffeur' THEN x.driver_id
                      WHEN 'site' THEN x.departure_site_id ELSE x.shift_id END AS k,
           EXISTS (SELECT 1 FROM public.trip_events e WHERE e.trip_id = x.trip_id AND e.etat_apres = 'DISPUTED') AS litige
      FROM public.durees_voyages(p_debut, p_fin) x
     WHERE p_site IS NULL OR x.departure_site_id = p_site
  ),
  a AS (
    SELECT d.k,
           count(*)::integer AS voyages,
           count(*) FILTER (WHERE d.livre)::integer AS livres,
           count(*) FILTER (WHERE d.etat IN ('CANCELLED', 'REJECTED'))::integer AS annules,
           round(sum(d.tonnes) FILTER (WHERE d.livre), 2) AS tonnes,
           count(*) FILTER (WHERE d.livre AND d.tonnes IS NULL)::integer AS sans_poids,
           round(avg(d.cycle_min), 0) AS cycle,
           count(d.cycle_min)::integer AS cycles,
           round(avg(d.rotation_min), 0) AS rotation,
           count(d.rotation_min)::integer AS rotations,
           count(*) FILTER (WHERE d.litige)::integer AS litiges
      FROM d GROUP BY d.k
  ),
  i AS (
    SELECT CASE p_axe WHEN 'camion' THEN coalesce(n.vehicle_id, t.vehicle_id)
                      WHEN 'chauffeur' THEN coalesce(n.driver_id, t.driver_id)
                      WHEN 'site' THEN public.site_rattache(n.site_id, n.trip_id, n.vehicle_id)
                      ELSE t.shift_id END AS k,
           count(*)::integer AS n
      FROM public.incidents n
      LEFT JOIN public.trips t ON t.id = n.trip_id
     WHERE n.incident_time::date BETWEEN p_debut AND p_fin
       AND (p_site IS NULL OR public.site_rattache(n.site_id, n.trip_id, n.vehicle_id) = p_site)
     GROUP BY 1
  ),
  r AS (
    SELECT coalesce(a.k, i.k) AS k, a.voyages, a.livres, a.annules, a.tonnes, a.sans_poids, a.cycle, a.cycles,
           a.rotation, a.rotations, a.litiges, i.n
      FROM a FULL OUTER JOIN i
        ON coalesce(i.k, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(a.k, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  SELECT r.k,
         CASE p_axe
           WHEN 'camion' THEN (SELECT v.registration FROM public.vehicles v WHERE v.id = r.k)
           WHEN 'chauffeur' THEN (SELECT dr.name FROM public.drivers dr WHERE dr.id = r.k)
           WHEN 'site' THEN (SELECT s.name FROM public.sites s WHERE s.id = r.k)
           ELSE (SELECT w.display_name FROM public.work_shifts w WHERE w.id = r.k)
         END::text,
         coalesce(r.voyages, 0), coalesce(r.livres, 0), coalesce(r.annules, 0), r.tonnes, coalesce(r.sans_poids, 0),
         r.cycle, coalesce(r.cycles, 0), r.rotation, coalesce(r.rotations, 0), coalesce(r.n, 0), coalesce(r.litiges, 0)
    FROM r
   ORDER BY coalesce(r.livres, 0) DESC, r.k;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rapport_voyages(date, date, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rapport_voyages(date, date, text, uuid) TO authenticated;

-- 6. Infractions des chauffeurs
CREATE OR REPLACE FUNCTION public.chauffeur_permis(p_driver uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.site_permis((SELECT d.site_id FROM public.drivers d WHERE d.id = p_driver));
$$;
REVOKE EXECUTE ON FUNCTION public.chauffeur_permis(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chauffeur_permis(uuid) TO authenticated, service_role;

CREATE SEQUENCE IF NOT EXISTS public.infractions_numero_seq;
-- Numerotation par la seule fonction serveur (SECURITY DEFINER).
REVOKE ALL ON SEQUENCE public.infractions_numero_seq FROM PUBLIC, anon, authenticated;
GRANT ALL ON SEQUENCE public.infractions_numero_seq TO service_role;

CREATE TABLE IF NOT EXISTS public.infractions_chauffeur (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE RESTRICT,
  type text NOT NULL CHECK (type IN ('exces_vitesse', 'conduite_dangereuse', 'signalisation', 'telephone', 'ceinture',
    'alcool_stupefiants', 'surcharge', 'temps_conduite', 'itineraire', 'stationnement', 'documents', 'comportement', 'autre')),
  survenue_le timestamptz NOT NULL,
  lieu text,
  trip_id uuid REFERENCES public.trips(id) ON DELETE RESTRICT,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  site_id uuid REFERENCES public.sites(id) ON DELETE RESTRICT,
  constat text NOT NULL CHECK (btrim(constat) <> ''),
  source text NOT NULL CHECK (source IN ('constat_interne', 'controle_routier', 'client', 'gps', 'video', 'autre')),
  reference_source text,
  statut text NOT NULL DEFAULT 'enregistree' CHECK (statut IN ('enregistree', 'annulee')),
  declare_par uuid REFERENCES auth.users(id),
  declare_le timestamptz NOT NULL DEFAULT now(),
  annulee_par uuid REFERENCES auth.users(id),
  annulee_le timestamptz,
  motif_annulation text,
  CHECK (statut <> 'annulee' OR (annulee_le IS NOT NULL AND nullif(btrim(coalesce(motif_annulation, '')), '') IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_infractions_chauffeur ON public.infractions_chauffeur (driver_id, survenue_le);
CREATE INDEX IF NOT EXISTS idx_infractions_voyage ON public.infractions_chauffeur (trip_id) WHERE trip_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.sanctions_infraction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  infraction_id uuid NOT NULL REFERENCES public.infractions_chauffeur(id) ON DELETE RESTRICT,
  sanction text NOT NULL CHECK (sanction IN ('aucune', 'avertissement', 'blame', 'formation', 'mise_a_pied', 'retrait_conduite', 'autre')),
  detail text,
  motif text NOT NULL CHECK (btrim(motif) <> ''),
  decide_par uuid REFERENCES auth.users(id),
  decide_le timestamptz NOT NULL DEFAULT now(),
  statut text NOT NULL DEFAULT 'active' CHECK (statut IN ('active', 'annulee')),
  annulee_par uuid REFERENCES auth.users(id),
  annulee_le timestamptz,
  motif_annulation text,
  CHECK (sanction <> 'autre' OR nullif(btrim(coalesce(detail, '')), '') IS NOT NULL),
  CHECK (statut <> 'annulee' OR (annulee_le IS NOT NULL AND nullif(btrim(coalesce(motif_annulation, '')), '') IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS sanctions_infraction_une_active
  ON public.sanctions_infraction (infraction_id) WHERE statut = 'active';

ALTER TABLE public.infractions_chauffeur ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sanctions_infraction ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.infractions_chauffeur, public.sanctions_infraction FROM anon, authenticated;
GRANT SELECT ON public.infractions_chauffeur, public.sanctions_infraction TO authenticated;
GRANT ALL ON public.infractions_chauffeur, public.sanctions_infraction TO service_role;
DROP POLICY IF EXISTS lecture ON public.infractions_chauffeur;
CREATE POLICY lecture ON public.infractions_chauffeur FOR SELECT TO authenticated
  USING ((public.has_module_view('drivers') OR public.has_module_view('trips') OR public.is_admin())
         AND (public.chauffeur_permis(driver_id) OR (trip_id IS NOT NULL AND public.voyage_permis(trip_id))
              OR (site_id IS NOT NULL AND public.site_permis(site_id))));
DROP POLICY IF EXISTS lecture ON public.sanctions_infraction;
CREATE POLICY lecture ON public.sanctions_infraction FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.infractions_chauffeur i WHERE i.id = infraction_id));

-- Append-only : seule l'annulation (une fois, motivee) modifie une ligne.
CREATE OR REPLACE FUNCTION public.garde_registre_infractions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_annulation text[] := ARRAY['statut', 'annulee_par', 'annulee_le', 'motif_annulation'];
BEGIN
  IF auth.uid() IS NULL THEN RETURN coalesce(NEW, OLD); END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Registre des infractions : aucune suppression, annuler avec motif' USING ERRCODE = '42501';
  END IF;
  IF OLD.statut = 'annulee' OR NEW.statut <> 'annulee'
     OR (to_jsonb(NEW) - v_annulation) IS DISTINCT FROM (to_jsonb(OLD) - v_annulation) THEN
    RAISE EXCEPTION 'Registre des infractions non modifiable : annuler avec motif puis saisir a nouveau' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.garde_registre_infractions() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garde_registre ON public.infractions_chauffeur;
CREATE TRIGGER garde_registre BEFORE UPDATE OR DELETE ON public.infractions_chauffeur
  FOR EACH ROW EXECUTE FUNCTION public.garde_registre_infractions();
DROP TRIGGER IF EXISTS garde_registre ON public.sanctions_infraction;
CREATE TRIGGER garde_registre BEFORE UPDATE OR DELETE ON public.sanctions_infraction
  FOR EACH ROW EXECUTE FUNCTION public.garde_registre_infractions();

CREATE OR REPLACE FUNCTION public.enregistrer_infraction(
  p_driver uuid, p_type text, p_survenue_le timestamptz, p_constat text, p_source text,
  p_lieu text DEFAULT NULL, p_trip uuid DEFAULT NULL, p_vehicle uuid DEFAULT NULL, p_reference_source text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  d public.drivers;
  t public.trips;
  v_vehicle uuid := p_vehicle;
  v_site uuid;
  v_id uuid;
BEGIN
  IF NOT (public.has_module_write('drivers') OR public.has_module_write('trips') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les chauffeurs ou les voyages requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO d FROM public.drivers WHERE id = p_driver;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chauffeur requis' USING ERRCODE = '22023'; END IF;
  IF p_type IS NULL OR p_type NOT IN ('exces_vitesse', 'conduite_dangereuse', 'signalisation', 'telephone', 'ceinture',
       'alcool_stupefiants', 'surcharge', 'temps_conduite', 'itineraire', 'stationnement', 'documents', 'comportement', 'autre') THEN
    RAISE EXCEPTION 'Type d''infraction requis' USING ERRCODE = '22023';
  END IF;
  IF p_source IS NULL OR p_source NOT IN ('constat_interne', 'controle_routier', 'client', 'gps', 'video', 'autre') THEN
    RAISE EXCEPTION 'Source du constat requise' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce(p_constat, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Constat requis' USING ERRCODE = '22023';
  END IF;
  IF p_survenue_le IS NULL OR p_survenue_le > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Date de l''infraction requise, pas dans le futur' USING ERRCODE = '22023';
  END IF;
  -- Perimetre d'abord (chauffeur, ou voyage designe), puis coherence : un
  -- voyage ou un engin hors perimetre ne se revele pas par le message.
  IF p_trip IS NOT NULL THEN
    IF NOT public.voyage_permis(p_trip) THEN
      RAISE EXCEPTION 'Voyage hors de votre perimetre' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT public.chauffeur_permis(p_driver) THEN
    RAISE EXCEPTION 'Chauffeur hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  IF p_trip IS NULL AND v_vehicle IS NOT NULL AND NOT public.vehicule_permis(v_vehicle) THEN
    RAISE EXCEPTION 'Engin hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  IF p_trip IS NOT NULL THEN
    SELECT * INTO t FROM public.trips WHERE id = p_trip;
    IF NOT FOUND THEN RAISE EXCEPTION 'Voyage introuvable' USING ERRCODE = '22023'; END IF;
    IF t.driver_id IS DISTINCT FROM p_driver THEN
      RAISE EXCEPTION 'Voyage d''un autre chauffeur' USING ERRCODE = '22023';
    END IF;
    IF v_vehicle IS NULL THEN v_vehicle := t.vehicle_id;
    ELSIF v_vehicle IS DISTINCT FROM t.vehicle_id THEN
      RAISE EXCEPTION 'Engin different de celui du voyage' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF v_vehicle IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = v_vehicle) THEN
    RAISE EXCEPTION 'Engin introuvable' USING ERRCODE = '22023';
  END IF;
  v_site := coalesce(t.departure_site_id, (SELECT v.site_id FROM public.vehicles v WHERE v.id = v_vehicle), d.site_id);

  INSERT INTO public.infractions_chauffeur (numero, driver_id, type, survenue_le, lieu, trip_id, vehicle_id, site_id,
                                            constat, source, reference_source, declare_par)
  VALUES ('INF-' || to_char(p_survenue_le, 'YYYY') || '-' || lpad(nextval('public.infractions_numero_seq')::text, 5, '0'),
          p_driver, p_type, p_survenue_le, nullif(btrim(coalesce(p_lieu, '')), ''), p_trip, v_vehicle, v_site,
          btrim(p_constat), p_source, nullif(btrim(coalesce(p_reference_source, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.infraction_accessible(p_id uuid)
RETURNS public.infractions_chauffeur
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE i public.infractions_chauffeur;
BEGIN
  SELECT * INTO i FROM public.infractions_chauffeur WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Infraction introuvable' USING ERRCODE = '22023'; END IF;
  -- Meme perimetre que la lecture : chauffeur, voyage, ou site ou l'infraction
  -- a ete saisie (elle reste traitee par ce site apres mutation du chauffeur).
  IF NOT (public.chauffeur_permis(i.driver_id) OR (i.trip_id IS NOT NULL AND public.voyage_permis(i.trip_id))
          OR (i.site_id IS NOT NULL AND public.site_permis(i.site_id))) THEN
    RAISE EXCEPTION 'Infraction hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  IF i.statut = 'annulee' THEN RAISE EXCEPTION 'Infraction annulee' USING ERRCODE = '22023'; END IF;
  RETURN i;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.infraction_accessible(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.annuler_infraction(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE i public.infractions_chauffeur;
BEGIN
  IF NOT (public.has_module_write('drivers') OR public.has_module_write('trips') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les chauffeurs ou les voyages requis' USING ERRCODE = '42501';
  END IF;
  i := public.infraction_accessible(p_id);
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motif d''annulation requis' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sanctions_infraction s WHERE s.infraction_id = p_id AND s.statut = 'active') THEN
    IF NOT (public.has_module_approve('drivers') OR public.is_admin()) THEN
      RAISE EXCEPTION 'Une sanction est decidee : seule une personne habilitee a sanctionner peut annuler l''infraction'
        USING ERRCODE = '42501';
    END IF;
    UPDATE public.sanctions_infraction
       SET statut = 'annulee', annulee_par = auth.uid(), annulee_le = now(),
           motif_annulation = 'Infraction annulée : ' || btrim(p_motif)
     WHERE infraction_id = p_id AND statut = 'active';
  END IF;
  UPDATE public.infractions_chauffeur
     SET statut = 'annulee', annulee_par = auth.uid(), annulee_le = now(), motif_annulation = btrim(p_motif)
   WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decider_sanction(p_infraction uuid, p_sanction text, p_motif text, p_detail text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT (public.has_module_approve('drivers') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Sanction : droit d''approbation sur les chauffeurs requis' USING ERRCODE = '42501';
  END IF;
  PERFORM public.infraction_accessible(p_infraction);
  IF p_sanction IS NULL OR p_sanction NOT IN ('aucune', 'avertissement', 'blame', 'formation', 'mise_a_pied', 'retrait_conduite', 'autre') THEN
    RAISE EXCEPTION 'Sanction inconnue' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motif de la decision requis' USING ERRCODE = '22023';
  END IF;
  IF p_sanction = 'autre' AND nullif(btrim(coalesce(p_detail, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Preciser la sanction' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sanctions_infraction s WHERE s.infraction_id = p_infraction AND s.statut = 'active') THEN
    RAISE EXCEPTION 'Une decision est deja en vigueur : l''annuler avec motif avant d''en prendre une autre' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.sanctions_infraction (infraction_id, sanction, detail, motif, decide_par)
  VALUES (p_infraction, p_sanction, nullif(btrim(coalesce(p_detail, '')), ''), btrim(p_motif), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.annuler_sanction(p_sanction uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE s public.sanctions_infraction;
BEGIN
  IF NOT (public.has_module_approve('drivers') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Sanction : droit d''approbation sur les chauffeurs requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO s FROM public.sanctions_infraction WHERE id = p_sanction FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Decision introuvable' USING ERRCODE = '22023'; END IF;
  PERFORM public.infraction_accessible(s.infraction_id);
  IF s.statut <> 'active' THEN RAISE EXCEPTION 'Decision deja annulee' USING ERRCODE = '22023'; END IF;
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motif d''annulation requis' USING ERRCODE = '22023';
  END IF;
  UPDATE public.sanctions_infraction
     SET statut = 'annulee', annulee_par = auth.uid(), annulee_le = now(), motif_annulation = btrim(p_motif)
   WHERE id = p_sanction;
END;
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'enregistrer_infraction(uuid, text, timestamptz, text, text, text, uuid, uuid, text)',
    'annuler_infraction(uuid, text)',
    'decider_sanction(uuid, text, text, text)',
    'annuler_sanction(uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
