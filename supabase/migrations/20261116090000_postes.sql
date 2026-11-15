/*
  # Postes de travail : instances de shift operables (D-048, lot 8,
  # module 05 du mandat)

  `work_shifts` reste le modele d'horaires. Un poste est l'instance d'un
  shift pour une date et un site :
  1. `postes` : ouverture (responsable, consignes recues de la passation),
     cloture (consignes pour le poste suivant, rapport, bilan fige
     planifie / livre), validation de la cloture par une autre personne.
     Etats : ouvert -> cloture -> valide ; jamais supprime.
  2. `postes_equipe` : chauffeurs et engins du poste, presence, retard en
     minutes, motif d'absence. Modifiable tant que le poste est ouvert.
  3. `postes_evenements` : journal append-only des evenements du poste
     (incident, arret, retard, securite, information).
  4. A l'ouverture, les consignes de sortie du dernier poste clos du meme
     site sont reprises comme consignes recues (passation).
  5. Le bilan de cloture fige les tonnes cible et livrees du poste lues
     dans `v_realisation_objectifs` (D-023) et le nombre de voyages du poste ;
     sans objectif ni voyage, les valeurs restent NULL.

  Ecriture : fonctions serveur ; ouverture, equipe, evenements et cloture
  sous `has_module_write('trips')`, validation sous
  `has_module_write('planning')` par une autre personne que celle qui a
  clos. Perimetre `site_permis`. Idempotent.
*/

CREATE TABLE IF NOT EXISTS public.postes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_poste date NOT NULL,
  shift_id uuid NOT NULL REFERENCES public.work_shifts(id),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  responsable_id uuid REFERENCES public.profiles(id),
  statut text NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert', 'cloture', 'valide')),
  consignes_recues text,
  consignes_sortie text,
  rapport text,
  bilan jsonb,
  ouvert_par uuid REFERENCES auth.users(id),
  ouvert_le timestamptz NOT NULL DEFAULT now(),
  cloture_par uuid REFERENCES auth.users(id),
  cloture_le timestamptz,
  valide_par uuid REFERENCES auth.users(id),
  valide_le timestamptz,
  UNIQUE (date_poste, shift_id, site_id)
);
CREATE INDEX IF NOT EXISTS idx_postes_site_date ON public.postes(site_id, date_poste DESC);

CREATE TABLE IF NOT EXISTS public.postes_equipe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poste_id uuid NOT NULL REFERENCES public.postes(id),
  driver_id uuid REFERENCES public.drivers(id),
  vehicle_id uuid REFERENCES public.vehicles(id),
  present boolean,
  retard_minutes integer CHECK (retard_minutes IS NULL OR retard_minutes >= 0),
  motif_absence text,
  ajoute_par uuid REFERENCES auth.users(id),
  ajoute_le timestamptz NOT NULL DEFAULT now(),
  CHECK (driver_id IS NOT NULL OR vehicle_id IS NOT NULL),
  CHECK (present IS DISTINCT FROM false OR motif_absence IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_postes_equipe_chauffeur ON public.postes_equipe(poste_id, driver_id) WHERE driver_id IS NOT NULL AND vehicle_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_postes_equipe_engin ON public.postes_equipe(poste_id, vehicle_id) WHERE vehicle_id IS NOT NULL AND driver_id IS NULL;

CREATE TABLE IF NOT EXISTS public.postes_evenements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poste_id uuid NOT NULL REFERENCES public.postes(id),
  survenu_le timestamptz NOT NULL,
  categorie text NOT NULL CHECK (categorie IN ('incident', 'arret', 'retard', 'securite', 'information')),
  description text NOT NULL CHECK (btrim(description) <> ''),
  vehicle_id uuid REFERENCES public.vehicles(id),
  auteur uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_postes_evenements ON public.postes_evenements(poste_id, survenu_le);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['postes', 'postes_equipe', 'postes_evenements'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS lecture ON public.postes;
CREATE POLICY lecture ON public.postes FOR SELECT TO authenticated
  USING ((public.has_module_view('trips') OR public.has_module_view('planning') OR public.is_admin()) AND public.site_permis(site_id));
DROP POLICY IF EXISTS lecture ON public.postes_equipe;
CREATE POLICY lecture ON public.postes_equipe FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.postes p WHERE p.id = poste_id));
DROP POLICY IF EXISTS lecture ON public.postes_evenements;
CREATE POLICY lecture ON public.postes_evenements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.postes p WHERE p.id = poste_id));

-- Acces en ecriture a un poste : droit, perimetre, etat attendu.
CREATE OR REPLACE FUNCTION public.poste_ecrivable(p_id uuid, p_module text, p_statut text)
RETURNS public.postes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.postes;
BEGIN
  IF NOT public.has_module_write(p_module) THEN
    RAISE EXCEPTION 'Droit d''ecriture requis (%)', p_module USING ERRCODE = '42501';
  END IF;
  SELECT * INTO p FROM public.postes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Poste introuvable' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.site_permis(p.site_id) THEN
    RAISE EXCEPTION 'Hors perimetre : poste d''un autre site' USING ERRCODE = '42501';
  END IF;
  IF p.statut <> p_statut THEN
    RAISE EXCEPTION 'Poste % : action impossible a cet etat', p.statut USING ERRCODE = '22023';
  END IF;
  RETURN p;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.poste_ecrivable(uuid, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ouvrir_poste(
  p_date date, p_shift_id uuid, p_site_id uuid, p_responsable uuid DEFAULT NULL, p_consignes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid; v_passation text;
BEGIN
  IF NOT public.has_module_write('trips') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur l''exploitation requis' USING ERRCODE = '42501';
  END IF;
  IF p_date IS NULL OR p_shift_id IS NULL OR p_site_id IS NULL THEN
    RAISE EXCEPTION 'Date, shift et site requis' USING ERRCODE = '22023';
  END IF;
  IF NOT public.site_permis(p_site_id) THEN
    RAISE EXCEPTION 'Hors perimetre : site non autorise' USING ERRCODE = '42501';
  END IF;
  IF p_date > current_date + 1 THEN
    RAISE EXCEPTION 'Un poste s''ouvre au plus tard la veille' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.postes WHERE date_poste = p_date AND shift_id = p_shift_id AND site_id = p_site_id) THEN
    RAISE EXCEPTION 'Poste deja ouvert pour ce shift, ce site et cette date' USING ERRCODE = '22023';
  END IF;
  -- Passation : consignes du dernier poste clos du site.
  SELECT p.consignes_sortie INTO v_passation FROM public.postes p
   WHERE p.site_id = p_site_id AND p.statut IN ('cloture', 'valide') AND p.consignes_sortie IS NOT NULL
   ORDER BY p.cloture_le DESC LIMIT 1;
  INSERT INTO public.postes (date_poste, shift_id, site_id, responsable_id, consignes_recues, ouvert_par)
  VALUES (p_date, p_shift_id, p_site_id, coalesce(p_responsable, auth.uid()),
          nullif(concat_ws(E'\n', v_passation, nullif(btrim(coalesce(p_consignes, '')), '')), ''), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.affecter_au_poste(p_poste_id uuid, p_driver_id uuid DEFAULT NULL, p_vehicle_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.postes := public.poste_ecrivable(p_poste_id, 'trips', 'ouvert'); v_id uuid;
BEGIN
  IF p_driver_id IS NULL AND p_vehicle_id IS NULL THEN
    RAISE EXCEPTION 'Chauffeur ou engin requis' USING ERRCODE = '22023';
  END IF;
  IF p_driver_id IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.postes_equipe e JOIN public.postes o ON o.id = e.poste_id
        WHERE e.driver_id = p_driver_id AND o.date_poste = p.date_poste AND o.shift_id = p.shift_id AND o.id <> p.id) THEN
    RAISE EXCEPTION 'Chauffeur deja affecte a un autre poste du meme shift' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.postes_equipe (poste_id, driver_id, vehicle_id, ajoute_par)
  VALUES (p.id, p_driver_id, p_vehicle_id, auth.uid()) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pointer_presence(p_membre_id uuid, p_present boolean, p_retard_minutes integer DEFAULT NULL, p_motif text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE e public.postes_equipe;
BEGIN
  SELECT * INTO e FROM public.postes_equipe WHERE id = p_membre_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membre introuvable' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.poste_ecrivable(e.poste_id, 'trips', 'ouvert');
  IF p_present IS NULL THEN RAISE EXCEPTION 'Presence a indiquer' USING ERRCODE = '22023'; END IF;
  IF NOT p_present AND nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motif d''absence requis' USING ERRCODE = '22023';
  END IF;
  UPDATE public.postes_equipe SET present = p_present,
    retard_minutes = CASE WHEN p_present THEN p_retard_minutes END,
    motif_absence = CASE WHEN p_present THEN NULL ELSE btrim(p_motif) END
   WHERE id = p_membre_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.consigner_evenement_poste(
  p_poste_id uuid, p_categorie text, p_description text, p_quand timestamptz DEFAULT now(), p_vehicle_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.postes := public.poste_ecrivable(p_poste_id, 'trips', 'ouvert'); v_id uuid;
BEGIN
  IF p_quand IS NULL OR p_quand > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Heure de l''evenement requise, pas dans le futur' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.postes_evenements (poste_id, survenu_le, categorie, description, vehicle_id, auteur)
  VALUES (p.id, p_quand, p_categorie, btrim(coalesce(p_description, '')), p_vehicle_id, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cloturer_poste(p_poste_id uuid, p_consignes_sortie text, p_rapport text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.postes := public.poste_ecrivable(p_poste_id, 'trips', 'ouvert'); v_bilan jsonb;
BEGIN
  IF nullif(btrim(coalesce(p_consignes_sortie, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Consignes de passation requises (meme « rien a signaler »)' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.postes_equipe WHERE poste_id = p.id AND present IS NULL) THEN
    RAISE EXCEPTION 'Presence de l''equipe a pointer avant la cloture' USING ERRCODE = '22023';
  END IF;
  SELECT jsonb_build_object(
    'tonnes_cible', (SELECT sum(o.tonnes_cible) FROM public.v_realisation_objectifs o
                      WHERE o.date_plan = p.date_poste AND o.site_id = p.site_id AND o.shift_id = p.shift_id),
    'tonnes_livrees', (SELECT sum(o.tonnes_livrees) FROM public.v_realisation_objectifs o
                      WHERE o.date_plan = p.date_poste AND o.site_id = p.site_id AND o.shift_id = p.shift_id),
    'voyages', (SELECT count(*) FROM public.trips t WHERE t.planned_date = p.date_poste AND t.shift_id = p.shift_id
                  AND t.departure_site_id = p.site_id),
    'voyages_livres', (SELECT count(*) FROM public.trips t WHERE t.planned_date = p.date_poste AND t.shift_id = p.shift_id
                  AND t.departure_site_id = p.site_id AND t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')),
    'presents', (SELECT count(*) FROM public.postes_equipe WHERE poste_id = p.id AND present),
    'absents', (SELECT count(*) FROM public.postes_equipe WHERE poste_id = p.id AND NOT present),
    'evenements', (SELECT count(*) FROM public.postes_evenements WHERE poste_id = p.id),
    'fige_le', now()) INTO v_bilan;
  UPDATE public.postes SET statut = 'cloture', consignes_sortie = btrim(p_consignes_sortie),
    rapport = nullif(btrim(coalesce(p_rapport, '')), ''), bilan = v_bilan, cloture_par = auth.uid(), cloture_le = now()
   WHERE id = p.id;
  RETURN v_bilan;
END;
$$;

CREATE OR REPLACE FUNCTION public.valider_cloture_poste(p_poste_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.postes := public.poste_ecrivable(p_poste_id, 'planning', 'cloture');
BEGIN
  IF p.cloture_par = auth.uid() THEN
    RAISE EXCEPTION 'La validation revient a une autre personne que celle qui a clos le poste' USING ERRCODE = '42501';
  END IF;
  UPDATE public.postes SET statut = 'valide', valide_par = auth.uid(), valide_le = now() WHERE id = p.id;
END;
$$;

DO $$
DECLARE sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'ouvrir_poste(date, uuid, uuid, uuid, text)',
    'affecter_au_poste(uuid, uuid, uuid)',
    'pointer_presence(uuid, boolean, integer, text)',
    'consigner_evenement_poste(uuid, text, text, timestamptz, uuid)',
    'cloturer_poste(uuid, text, text)',
    'valider_cloture_poste(uuid)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', sig);
  END LOOP;
END $$;
