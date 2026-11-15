/*
  # HSE : controle avant depart, incidents et actions correctives (D-054,
  # lot 15, module 22)

  1. Controle avant depart. `points_controle_depart` : referentiel tenu
     par l'administrateur (libelle, categorie, point bloquant ou non).
     `enregistrer_controle_depart` : tous les points actifs sont renseignes
     (conforme, non conforme avec observation, sans objet) ; resultat
     calcule par le serveur : conforme, avec reserves (non-conformite non
     bloquante) ou non conforme (point bloquant). Libelles et caractere
     bloquant figes dans le controle. Append-only : un nouveau controle
     (apres reparation) fait foi pour la journee.
  2. Lien au cycle voyage : si le reglage `controle_depart_exige` vaut
     true, le passage ASSIGNED -> AT_LOADING exige, pour le camion, un
     dernier controle du jour qui ne soit pas non conforme. Sans reglage,
     aucune contrainte nouvelle (le systeme signale, l'administrateur
     decide de l'exiger).
  3. Incidents : la table `incidents` (heritee, colonnes absentes de
     l'ecran) recoit engin, chauffeur, site, type, lieu, statut, numero
     INC, cause, cloture ; ecriture par `declarer_incident`,
     `analyser_incident`, `cloturer_incident` (cause renseignee, actions
     toutes realisees ou annulees). Le cout estime n'a plus de valeur par
     defaut.
  4. `actions_correctives` : responsable, echeance, realisation avec
     preuve, annulation motivee ; `v_actions_correctives_en_retard`.

  Ecriture : module trips (exploitation) et perimetre (voyage, engin ou
  site) ; referentiel : administrateur. Idempotent.
*/

-- 1. Controle avant depart
CREATE TABLE IF NOT EXISTS public.points_controle_depart (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  libelle text NOT NULL CHECK (btrim(libelle) <> ''),
  categorie text NOT NULL CHECK (categorie IN ('freinage', 'pneumatiques', 'eclairage', 'fluides', 'securite', 'documents', 'cabine', 'autre')),
  bloquant boolean NOT NULL,
  ordre integer NOT NULL DEFAULT 0,
  actif boolean NOT NULL DEFAULT true,
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.controles_depart (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id),
  driver_id uuid REFERENCES public.drivers(id),
  trip_id uuid REFERENCES public.trips(id),
  effectue_le timestamptz NOT NULL,
  compteur_km numeric CHECK (compteur_km IS NULL OR compteur_km >= 0),
  resultat text NOT NULL CHECK (resultat IN ('conforme', 'reserves', 'non_conforme')),
  note text,
  saisi_par uuid REFERENCES auth.users(id),
  saisi_le timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_controles_depart_engin ON public.controles_depart(vehicle_id, effectue_le);

CREATE TABLE IF NOT EXISTS public.controles_depart_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  controle_id uuid NOT NULL REFERENCES public.controles_depart(id),
  point_id uuid NOT NULL REFERENCES public.points_controle_depart(id),
  libelle text NOT NULL,
  bloquant boolean NOT NULL,
  resultat text NOT NULL CHECK (resultat IN ('conforme', 'non_conforme', 'sans_objet')),
  observation text,
  CHECK (resultat <> 'non_conforme' OR nullif(btrim(coalesce(observation, '')), '') IS NOT NULL),
  UNIQUE (controle_id, point_id)
);

ALTER TABLE public.points_controle_depart ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controles_depart ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controles_depart_points ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.points_controle_depart, public.controles_depart, public.controles_depart_points FROM anon, authenticated;
GRANT SELECT ON public.points_controle_depart, public.controles_depart, public.controles_depart_points TO authenticated;
GRANT INSERT (id, libelle, categorie, bloquant, ordre, actif, cree_par), UPDATE (libelle, categorie, bloquant, ordre, actif)
  ON public.points_controle_depart TO authenticated;
GRANT ALL ON public.points_controle_depart, public.controles_depart, public.controles_depart_points TO service_role;

DROP POLICY IF EXISTS lecture ON public.points_controle_depart;
CREATE POLICY lecture ON public.points_controle_depart FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS administration ON public.points_controle_depart;
CREATE POLICY administration ON public.points_controle_depart FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS lecture ON public.controles_depart;
CREATE POLICY lecture ON public.controles_depart FOR SELECT TO authenticated
  USING ((public.has_module_view('trips') OR public.has_module_view('vehicles') OR public.is_admin())
         AND public.vehicule_permis(vehicle_id));
DROP POLICY IF EXISTS lecture ON public.controles_depart_points;
CREATE POLICY lecture ON public.controles_depart_points FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.controles_depart c WHERE c.id = controle_id));

CREATE OR REPLACE FUNCTION public.garde_append_only_hse()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN coalesce(NEW, OLD); END IF;
  RAISE EXCEPTION 'Enregistrement HSE non modifiable : saisir un nouveau controle' USING ERRCODE = '42501';
END;
$$;
DROP TRIGGER IF EXISTS garde_append_only ON public.controles_depart;
CREATE TRIGGER garde_append_only BEFORE UPDATE OR DELETE ON public.controles_depart
  FOR EACH ROW EXECUTE FUNCTION public.garde_append_only_hse();
DROP TRIGGER IF EXISTS garde_append_only ON public.controles_depart_points;
CREATE TRIGGER garde_append_only BEFORE UPDATE OR DELETE ON public.controles_depart_points
  FOR EACH ROW EXECUTE FUNCTION public.garde_append_only_hse();

-- p_points : [{"point": uuid, "resultat": "conforme|non_conforme|sans_objet", "observation": text}]
CREATE OR REPLACE FUNCTION public.enregistrer_controle_depart(
  p_vehicle uuid, p_points jsonb, p_driver uuid DEFAULT NULL, p_trip uuid DEFAULT NULL,
  p_date timestamptz DEFAULT now(), p_km numeric DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.points_controle_depart; e jsonb; v_id uuid; v_res text; v_bloquant boolean := false; v_reserve boolean := false;
BEGIN
  IF NOT (public.has_module_write('trips') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur l''exploitation requis' USING ERRCODE = '42501';
  END IF;
  IF p_vehicle IS NULL OR NOT EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = p_vehicle) THEN
    RAISE EXCEPTION 'Engin requis' USING ERRCODE = '22023';
  END IF;
  IF NOT public.vehicule_permis(p_vehicle) THEN RAISE EXCEPTION 'Engin hors de votre perimetre' USING ERRCODE = '42501'; END IF;
  IF p_date IS NULL OR p_date > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Heure du controle requise, pas dans le futur' USING ERRCODE = '22023';
  END IF;
  IF p_trip IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.trips t WHERE t.id = p_trip AND t.vehicle_id = p_vehicle) THEN
    RAISE EXCEPTION 'Voyage d''un autre camion' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.points_controle_depart WHERE actif) THEN
    RAISE EXCEPTION 'Aucun point de controle parametre : l''administrateur definit la liste' USING ERRCODE = '22023';
  END IF;
  IF p_points IS NULL OR jsonb_typeof(p_points) <> 'array' THEN RAISE EXCEPTION 'Points du controle requis' USING ERRCODE = '22023'; END IF;
  FOR p IN SELECT * FROM public.points_controle_depart WHERE actif LOOP
    SELECT x INTO e FROM jsonb_array_elements(p_points) x WHERE x ->> 'point' = p.id::text LIMIT 1;
    IF e IS NULL OR (e ->> 'resultat') NOT IN ('conforme', 'non_conforme', 'sans_objet') THEN
      RAISE EXCEPTION 'Point « % » non renseigne', p.libelle USING ERRCODE = '22023';
    END IF;
    IF e ->> 'resultat' = 'non_conforme' THEN
      IF nullif(btrim(coalesce(e ->> 'observation', '')), '') IS NULL THEN
        RAISE EXCEPTION 'Point « % » non conforme : observation requise', p.libelle USING ERRCODE = '22023';
      END IF;
      IF p.bloquant THEN v_bloquant := true; ELSE v_reserve := true; END IF;
    END IF;
  END LOOP;
  v_res := CASE WHEN v_bloquant THEN 'non_conforme' WHEN v_reserve THEN 'reserves' ELSE 'conforme' END;
  INSERT INTO public.controles_depart (vehicle_id, driver_id, trip_id, effectue_le, compteur_km, resultat, note, saisi_par)
  VALUES (p_vehicle, p_driver, p_trip, p_date, p_km, v_res, nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO public.controles_depart_points (controle_id, point_id, libelle, bloquant, resultat, observation)
  SELECT v_id, pc.id, pc.libelle, pc.bloquant, j.x ->> 'resultat', nullif(btrim(coalesce(j.x ->> 'observation', '')), '')
    FROM public.points_controle_depart pc
    JOIN LATERAL (SELECT y FROM jsonb_array_elements(p_points) y WHERE y ->> 'point' = pc.id::text LIMIT 1) j(x) ON true
   WHERE pc.actif;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enregistrer_controle_depart(uuid, jsonb, uuid, uuid, timestamptz, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_controle_depart(uuid, jsonb, uuid, uuid, timestamptz, numeric, text) TO authenticated;

-- Dernier controle du jour d'un camion (NULL si aucun).
CREATE OR REPLACE FUNCTION public.controle_depart_du_jour(p_vehicle uuid, p_jour date)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.resultat FROM public.controles_depart c
   WHERE c.vehicle_id = p_vehicle AND c.effectue_le::date = p_jour
   ORDER BY c.effectue_le DESC, c.saisi_le DESC LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.controle_depart_du_jour(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.controle_depart_du_jour(uuid, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.garde_controle_depart()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_exige boolean; v_vehicle uuid; v_res text;
BEGIN
  IF auth.uid() IS NULL OR NOT (NEW.etat_avant = 'ASSIGNED' AND NEW.etat_apres = 'AT_LOADING') THEN RETURN NEW; END IF;
  SELECT coalesce((SELECT (s.value ->> 'value') = 'true' FROM public.settings s WHERE s.key = 'controle_depart_exige'), false) INTO v_exige;
  IF NOT v_exige THEN RETURN NEW; END IF;
  SELECT t.vehicle_id INTO v_vehicle FROM public.trips t WHERE t.id = NEW.trip_id;
  v_res := public.controle_depart_du_jour(v_vehicle, NEW.survenu_le::date);
  IF v_res IS NULL THEN
    RAISE EXCEPTION 'Depart refuse : aucun controle avant depart du camion ce jour' USING ERRCODE = '22023';
  END IF;
  IF v_res = 'non_conforme' THEN
    RAISE EXCEPTION 'Depart refuse : dernier controle avant depart non conforme' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS garde_controle_depart ON public.trip_events;
CREATE TRIGGER garde_controle_depart BEFORE INSERT ON public.trip_events
  FOR EACH ROW EXECUTE FUNCTION public.garde_controle_depart();

-- 2. Incidents
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS numero text UNIQUE;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS type text CHECK (type IS NULL OR type IN
  ('accident', 'presque_accident', 'blessure', 'environnement', 'materiel', 'securite', 'autre'));
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.vehicles(id);
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES public.drivers(id);
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id);
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS controle_id uuid REFERENCES public.controles_depart(id);
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS lieu text;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS statut text NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert', 'en_analyse', 'clos'));
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS declare_par uuid REFERENCES auth.users(id);
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS cause text;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS analyse_par uuid REFERENCES auth.users(id);
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS analyse_le timestamptz;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS clos_par uuid REFERENCES auth.users(id);
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS clos_le timestamptz;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS conclusion text;
ALTER TABLE public.incidents ALTER COLUMN estimated_cost DROP DEFAULT;
CREATE SEQUENCE IF NOT EXISTS public.incidents_numero_seq;

CREATE OR REPLACE FUNCTION public.incident_permis(p_trip uuid, p_vehicle uuid, p_site uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE WHEN p_trip IS NOT NULL THEN public.voyage_permis(p_trip)
              WHEN p_vehicle IS NOT NULL THEN public.vehicule_permis(p_vehicle)
              ELSE public.site_permis(p_site) END;
$$;
REVOKE EXECUTE ON FUNCTION public.incident_permis(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.incident_permis(uuid, uuid, uuid) TO authenticated, service_role;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'incidents' LOOP
    EXECUTE format('DROP POLICY %I ON public.incidents', p.policyname);
  END LOOP;
END $$;
REVOKE INSERT, UPDATE, DELETE ON public.incidents FROM anon, authenticated;
GRANT SELECT ON public.incidents TO authenticated;
CREATE POLICY lecture ON public.incidents FOR SELECT TO authenticated
  USING ((public.has_module_view('trips') OR public.has_module_view('reports') OR public.is_admin())
         AND public.incident_permis(trip_id, vehicle_id, site_id));

CREATE TABLE IF NOT EXISTS public.actions_correctives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.incidents(id),
  libelle text NOT NULL CHECK (btrim(libelle) <> ''),
  responsable text NOT NULL CHECK (btrim(responsable) <> ''),
  echeance date NOT NULL,
  statut text NOT NULL DEFAULT 'ouverte' CHECK (statut IN ('ouverte', 'realisee', 'annulee')),
  realisee_le timestamptz,
  preuve text,
  motif_annulation text,
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now(),
  solde_par uuid REFERENCES auth.users(id),
  CHECK (statut <> 'realisee' OR (realisee_le IS NOT NULL AND nullif(btrim(coalesce(preuve, '')), '') IS NOT NULL)),
  CHECK (statut <> 'annulee' OR nullif(btrim(coalesce(motif_annulation, '')), '') IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_actions_correctives_incident ON public.actions_correctives(incident_id);
ALTER TABLE public.actions_correctives ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.actions_correctives FROM anon, authenticated;
GRANT SELECT ON public.actions_correctives TO authenticated;
GRANT ALL ON public.actions_correctives TO service_role;
DROP POLICY IF EXISTS lecture ON public.actions_correctives;
CREATE POLICY lecture ON public.actions_correctives FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.incidents i WHERE i.id = incident_id));

CREATE OR REPLACE FUNCTION public.incident_ecrivable(p_id uuid)
RETURNS public.incidents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE i public.incidents;
BEGIN
  IF NOT (public.has_module_write('trips') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur l''exploitation requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO i FROM public.incidents WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Incident introuvable' USING ERRCODE = '22023'; END IF;
  IF NOT public.incident_permis(i.trip_id, i.vehicle_id, i.site_id) THEN
    RAISE EXCEPTION 'Incident hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  IF i.statut = 'clos' THEN RAISE EXCEPTION 'Incident clos' USING ERRCODE = '22023'; END IF;
  RETURN i;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.incident_ecrivable(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.declarer_incident(
  p_type text, p_gravite public.incident_severity, p_description text, p_survenu_le timestamptz DEFAULT now(),
  p_vehicle uuid DEFAULT NULL, p_driver uuid DEFAULT NULL, p_trip uuid DEFAULT NULL, p_site uuid DEFAULT NULL,
  p_lieu text DEFAULT NULL, p_cout_estime numeric DEFAULT NULL, p_controle uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT (public.has_module_write('trips') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur l''exploitation requis' USING ERRCODE = '42501';
  END IF;
  IF p_type IS NULL OR p_type NOT IN ('accident', 'presque_accident', 'blessure', 'environnement', 'materiel', 'securite', 'autre') THEN
    RAISE EXCEPTION 'Type d''incident requis' USING ERRCODE = '22023';
  END IF;
  IF p_gravite IS NULL THEN RAISE EXCEPTION 'Gravite requise' USING ERRCODE = '22023'; END IF;
  IF nullif(btrim(coalesce(p_description, '')), '') IS NULL THEN RAISE EXCEPTION 'Description requise' USING ERRCODE = '22023'; END IF;
  IF p_survenu_le IS NULL OR p_survenu_le > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Heure de l''incident requise, pas dans le futur' USING ERRCODE = '22023';
  END IF;
  IF p_trip IS NULL AND p_vehicle IS NULL AND p_site IS NULL THEN
    RAISE EXCEPTION 'Rattacher l''incident a un voyage, un engin ou un site' USING ERRCODE = '22023';
  END IF;
  IF NOT public.incident_permis(p_trip, p_vehicle, p_site) THEN
    RAISE EXCEPTION 'Hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  IF p_cout_estime IS NOT NULL AND p_cout_estime < 0 THEN RAISE EXCEPTION 'Cout estime positif ou absent' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.incidents (numero, type, severity, description, incident_time, vehicle_id, driver_id, trip_id, site_id,
                                lieu, estimated_cost, controle_id, statut, declare_par)
  VALUES ('INC-' || to_char(p_survenu_le, 'YYYY') || '-' || lpad(nextval('public.incidents_numero_seq')::text, 5, '0'),
          p_type, p_gravite, btrim(p_description), p_survenu_le, p_vehicle, p_driver, p_trip, p_site,
          nullif(btrim(coalesce(p_lieu, '')), ''), p_cout_estime, p_controle, 'ouvert', auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.analyser_incident(p_id uuid, p_cause text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.incident_ecrivable(p_id);
  IF nullif(btrim(coalesce(p_cause, '')), '') IS NULL THEN RAISE EXCEPTION 'Cause requise' USING ERRCODE = '22023'; END IF;
  UPDATE public.incidents SET cause = btrim(p_cause), statut = 'en_analyse', analyse_par = auth.uid(), analyse_le = now() WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ajouter_action_corrective(p_incident uuid, p_libelle text, p_responsable text, p_echeance date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.incident_ecrivable(p_incident);
  IF nullif(btrim(coalesce(p_libelle, '')), '') IS NULL OR nullif(btrim(coalesce(p_responsable, '')), '') IS NULL OR p_echeance IS NULL THEN
    RAISE EXCEPTION 'Action, responsable et echeance requis' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.actions_correctives (incident_id, libelle, responsable, echeance, cree_par)
  VALUES (p_incident, btrim(p_libelle), btrim(p_responsable), p_echeance, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Realisation (preuve requise) ou annulation (motif requis), definitive.
CREATE OR REPLACE FUNCTION public.solder_action_corrective(p_action uuid, p_realisee boolean, p_texte text, p_date timestamptz DEFAULT now())
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE a public.actions_correctives;
BEGIN
  SELECT * INTO a FROM public.actions_correctives WHERE id = p_action FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Action introuvable' USING ERRCODE = '22023'; END IF;
  PERFORM public.incident_ecrivable(a.incident_id);
  IF a.statut <> 'ouverte' THEN RAISE EXCEPTION 'Action deja soldee' USING ERRCODE = '22023'; END IF;
  IF p_realisee IS NULL OR nullif(btrim(coalesce(p_texte, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Preuve de realisation ou motif d''annulation requis' USING ERRCODE = '22023';
  END IF;
  IF p_realisee AND (p_date IS NULL OR p_date > now() + interval '5 minutes') THEN
    RAISE EXCEPTION 'Date de realisation requise, pas dans le futur' USING ERRCODE = '22023';
  END IF;
  UPDATE public.actions_correctives SET
    statut = CASE WHEN p_realisee THEN 'realisee' ELSE 'annulee' END,
    realisee_le = CASE WHEN p_realisee THEN p_date END,
    preuve = CASE WHEN p_realisee THEN btrim(p_texte) END,
    motif_annulation = CASE WHEN p_realisee THEN NULL ELSE btrim(p_texte) END,
    solde_par = auth.uid()
   WHERE id = p_action;
END;
$$;

CREATE OR REPLACE FUNCTION public.cloturer_incident(p_id uuid, p_conclusion text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE i public.incidents;
BEGIN
  i := public.incident_ecrivable(p_id);
  IF i.cause IS NULL THEN RAISE EXCEPTION 'Analyse requise avant la cloture (cause)' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.actions_correctives a WHERE a.incident_id = p_id AND a.statut = 'ouverte') THEN
    RAISE EXCEPTION 'Actions correctives encore ouvertes' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce(p_conclusion, '')), '') IS NULL THEN RAISE EXCEPTION 'Conclusion requise' USING ERRCODE = '22023'; END IF;
  UPDATE public.incidents SET statut = 'clos', clos_par = auth.uid(), clos_le = now(), conclusion = btrim(p_conclusion) WHERE id = p_id;
END;
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'declarer_incident(text, public.incident_severity, text, timestamptz, uuid, uuid, uuid, uuid, text, numeric, uuid)',
    'analyser_incident(uuid, text)',
    'ajouter_action_corrective(uuid, text, text, date)',
    'solder_action_corrective(uuid, boolean, text, timestamptz)',
    'cloturer_incident(uuid, text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

CREATE OR REPLACE VIEW public.v_actions_correctives_en_retard WITH (security_invoker = true) AS
SELECT a.id, a.incident_id, i.numero, a.libelle, a.responsable, a.echeance, (current_date - a.echeance) AS jours_de_retard
  FROM public.actions_correctives a JOIN public.incidents i ON i.id = a.incident_id
 WHERE a.statut = 'ouverte' AND a.echeance < current_date;
GRANT SELECT ON public.v_actions_correctives_en_retard TO authenticated;
