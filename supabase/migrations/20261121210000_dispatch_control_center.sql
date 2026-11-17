/*
  # Dispatch Control Center (D-087, lot 06, modules 05, 06 et 07)

  Etend l'existant sans le dupliquer : `work_shifts` reste le referentiel des
  horaires (D-078), `postes` reste l'instance d'un shift pour une date et un
  site (D-048), `decisions_dispatch` reste le journal des affectations
  (D-024), `decider_affectation` (derniere definition 20261121095000) reste la
  seule fonction qui affecte, `preparer_voyages` (20261110180000) la seule qui
  cree les voyages prepares, `trips_garde_cycle` le seul juge du cycle.

  1. Instance de shift : etats planifie, ouvert, en_cours, cloture, valide,
     annule sur `postes` ; colonne `version` (controle de version, +1 a chaque
     mise a jour) ; journal append-only `postes_journal`. Fonctions :
     `planifier_poste` (nouvelle), `ouvrir_poste` (redefinie depuis
     20261116090000 : ouvre aussi un poste planifie), `changer_etat_poste`
     (demarrer, annuler), `cloturer_shift` (nouvelle, motif exige si des
     voyages ne sont pas termines), `cloturer_poste` (redefinie depuis
     20261116090000 : meme refus, sauf motif consigne par cloturer_shift dans
     la meme transaction), `poste_ecrivable` (redefinie depuis 20261116090000 :
     un poste en cours s'ecrit comme un poste ouvert).
  2. Plan de shift versionne `plans_shift` (append-only) : `besoin_shift`
     (SECURITY INVOKER, calcul explique : cible / (capacite utile x hypothese
     de charge saisie)) et `confirmer_plan_shift` (confirmation humaine, motif
     si le nombre differe de la proposition ou sans objectif, controle de
     version, creation par `preparer_voyages`).
  3. Suspension et reprise d'un voyage par evenement trace
     (`suspensions_voyage`, append-only) ; garde `garde_dispatch_suspension` :
     un voyage suspendu n'avance plus (sauf annulation).
  4. Garde `garde_dispatch_disponibilite` sur trips : camion a immobilisation
     ouverte refuse ; camion ou chauffeur engage sur un autre voyage avec une
     autre ressource refuse (toute ecriture : dispatch, creation, enchainement),
     sur les voyages dates de la veille au lendemain (un voyage oublie a l'etat
     engage plus ancien ne bloque pas l'engin indefiniment).
  5. `affecter_voyage` : controle de version (nombre de decisions et de
     suspensions connu du client), verrou sans attente, coherence de la
     decision avec la recommandation, puis `decider_affectation`.
  6. `habilitations_dispatch` (perimetre), `indicateurs_dispatch` et
     `supervision_dispatch` (SECURITY INVOKER, donnees reelles, NULL = sans
     donnees).

  Additive et idempotente. Aucune donnee existante n'est modifiee.
*/

-- ---------------------------------------------------------------------------
-- 1. Instance de shift
-- ---------------------------------------------------------------------------
ALTER TABLE public.postes DROP CONSTRAINT IF EXISTS postes_statut_check;
ALTER TABLE public.postes ADD CONSTRAINT postes_statut_check
  CHECK (statut IN ('planifie', 'ouvert', 'en_cours', 'cloture', 'valide', 'annule'));
ALTER TABLE public.postes ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.postes ADD COLUMN IF NOT EXISTS planifie_par uuid REFERENCES auth.users(id);
ALTER TABLE public.postes ADD COLUMN IF NOT EXISTS planifie_le timestamptz;
ALTER TABLE public.postes ADD COLUMN IF NOT EXISTS demarre_le timestamptz;
ALTER TABLE public.postes ADD COLUMN IF NOT EXISTS annule_par uuid REFERENCES auth.users(id);
ALTER TABLE public.postes ADD COLUMN IF NOT EXISTS annule_le timestamptz;
ALTER TABLE public.postes ADD COLUMN IF NOT EXISTS motif_annulation text;

CREATE OR REPLACE FUNCTION public.postes_version_suivante()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.postes_version_suivante() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS postes_version_suivante ON public.postes;
CREATE TRIGGER postes_version_suivante BEFORE UPDATE ON public.postes
  FOR EACH ROW EXECUTE FUNCTION public.postes_version_suivante();

CREATE OR REPLACE FUNCTION public.refuser_mutation_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Journal append-only : aucune modification ni suppression (D-087)' USING ERRCODE = '42501';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.refuser_mutation_dispatch() FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.postes_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rang bigint GENERATED ALWAYS AS IDENTITY,
  poste_id uuid NOT NULL REFERENCES public.postes(id),
  etat_avant text,
  etat_apres text NOT NULL,
  motif text,
  donnees jsonb NOT NULL DEFAULT '{}'::jsonb,
  transaction_id bigint NOT NULL DEFAULT txid_current(),
  auteur uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS postes_journal_poste_idx ON public.postes_journal (poste_id, rang);
DROP TRIGGER IF EXISTS postes_journal_immuable ON public.postes_journal;
CREATE TRIGGER postes_journal_immuable BEFORE UPDATE OR DELETE ON public.postes_journal
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_dispatch();

-- Redefinie depuis 20261116090000 (seule definition) : un poste en cours
-- s'ecrit comme un poste ouvert (equipe, evenements, cloture).
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
  IF p.statut <> p_statut AND NOT (p_statut = 'ouvert' AND p.statut = 'en_cours') THEN
    RAISE EXCEPTION 'Poste % : action impossible a cet etat', p.statut USING ERRCODE = '22023';
  END IF;
  RETURN p;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.poste_ecrivable(uuid, text, text) FROM PUBLIC, anon, authenticated;

-- Voyages du poste qui ne sont pas termines (ni livres ni annules).
CREATE OR REPLACE FUNCTION public.voyages_non_termines_poste(p_poste_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT count(*)::integer FROM public.trips t JOIN public.postes p ON p.id = p_poste_id
   WHERE t.planned_date = p.date_poste AND t.shift_id = p.shift_id AND t.departure_site_id = p.site_id
     AND t.etat NOT IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED', 'CANCELLED', 'REJECTED');
$$;
REVOKE EXECUTE ON FUNCTION public.voyages_non_termines_poste(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.planifier_poste(
  p_date date, p_shift_id uuid, p_site_id uuid, p_responsable uuid DEFAULT NULL, p_consignes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid;
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
  IF p_date < current_date THEN
    RAISE EXCEPTION 'Un shift se planifie pour aujourd''hui ou une date future' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.work_shifts w WHERE w.id = p_shift_id AND w.is_active IS TRUE) THEN
    RAISE EXCEPTION 'Shift inconnu ou inactif (Exploitation > Shifts)' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('poste:' || p_date || ':' || p_shift_id || ':' || p_site_id));
  IF EXISTS (SELECT 1 FROM public.postes WHERE date_poste = p_date AND shift_id = p_shift_id AND site_id = p_site_id) THEN
    RAISE EXCEPTION 'Shift deja planifie ou ouvert pour cette date et ce site' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.postes (date_poste, shift_id, site_id, responsable_id, statut, consignes_recues, planifie_par, planifie_le)
  VALUES (p_date, p_shift_id, p_site_id, p_responsable, 'planifie', nullif(btrim(coalesce(p_consignes, '')), ''), auth.uid(), now())
  RETURNING id INTO v_id;
  INSERT INTO public.postes_journal (poste_id, etat_avant, etat_apres, auteur) VALUES (v_id, NULL, 'planifie', auth.uid());
  RETURN v_id;
END;
$$;

-- Redefinie depuis 20261116090000 (seule definition) : un poste planifie
-- s'ouvre ; journal des transitions. Reste a l'identique sinon.
CREATE OR REPLACE FUNCTION public.ouvrir_poste(
  p_date date, p_shift_id uuid, p_site_id uuid, p_responsable uuid DEFAULT NULL, p_consignes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid; v_passation text; v_existant public.postes;
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
  SELECT * INTO v_existant FROM public.postes
   WHERE date_poste = p_date AND shift_id = p_shift_id AND site_id = p_site_id FOR UPDATE;
  IF FOUND AND v_existant.statut <> 'planifie' THEN
    RAISE EXCEPTION 'Poste deja ouvert pour ce shift, ce site et cette date' USING ERRCODE = '22023';
  END IF;
  -- Passation : consignes du dernier poste clos du site.
  SELECT p.consignes_sortie INTO v_passation FROM public.postes p
   WHERE p.site_id = p_site_id AND p.statut IN ('cloture', 'valide') AND p.consignes_sortie IS NOT NULL
   ORDER BY p.cloture_le DESC LIMIT 1;
  IF v_existant.id IS NOT NULL THEN
    UPDATE public.postes SET statut = 'ouvert',
      responsable_id = coalesce(p_responsable, v_existant.responsable_id, auth.uid()),
      consignes_recues = nullif(concat_ws(E'\n', v_passation, v_existant.consignes_recues,
                                          nullif(btrim(coalesce(p_consignes, '')), '')), ''),
      ouvert_par = auth.uid(), ouvert_le = now()
     WHERE id = v_existant.id;
    v_id := v_existant.id;
    INSERT INTO public.postes_journal (poste_id, etat_avant, etat_apres, auteur) VALUES (v_id, 'planifie', 'ouvert', auth.uid());
    RETURN v_id;
  END IF;
  INSERT INTO public.postes (date_poste, shift_id, site_id, responsable_id, consignes_recues, ouvert_par)
  VALUES (p_date, p_shift_id, p_site_id, coalesce(p_responsable, auth.uid()),
          nullif(concat_ws(E'\n', v_passation, nullif(btrim(coalesce(p_consignes, '')), '')), ''), auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO public.postes_journal (poste_id, etat_avant, etat_apres, auteur) VALUES (v_id, NULL, 'ouvert', auth.uid());
  RETURN v_id;
END;
$$;

-- Demarrer (ouvert -> en_cours) ou annuler (planifie, ouvert, en_cours ->
-- annule, motif, aucun voyage engage). Controle de version si fourni.
CREATE OR REPLACE FUNCTION public.changer_etat_poste(
  p_poste_id uuid, p_etat text, p_motif text DEFAULT NULL, p_version integer DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.postes; v_motif text := nullif(btrim(coalesce(p_motif, '')), ''); v_engages integer;
BEGIN
  IF NOT public.has_module_write('trips') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur l''exploitation requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO p FROM public.postes WHERE id = p_poste_id FOR UPDATE;
  IF NOT FOUND OR NOT public.site_permis(p.site_id) THEN
    RAISE EXCEPTION 'Poste introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF p_version IS NOT NULL AND p_version <> p.version THEN
    RAISE EXCEPTION 'Shift modifie entre-temps par un autre utilisateur (version % au lieu de %) : recharger', p.version, p_version
      USING ERRCODE = '40001';
  END IF;
  IF p_etat = 'en_cours' THEN
    IF p.statut <> 'ouvert' THEN
      RAISE EXCEPTION 'Seul un shift ouvert demarre (etat actuel : %)', p.statut USING ERRCODE = '22023';
    END IF;
    UPDATE public.postes SET statut = 'en_cours', demarre_le = now() WHERE id = p.id;
  ELSIF p_etat = 'annule' THEN
    IF p.statut NOT IN ('planifie', 'ouvert', 'en_cours') THEN
      RAISE EXCEPTION 'Shift % : annulation impossible', p.statut USING ERRCODE = '22023';
    END IF;
    IF v_motif IS NULL THEN
      RAISE EXCEPTION 'Motif d''annulation requis' USING ERRCODE = '22023';
    END IF;
    SELECT count(*) INTO v_engages FROM public.trips t
     WHERE t.planned_date = p.date_poste AND t.shift_id = p.shift_id AND t.departure_site_id = p.site_id
       AND t.etat NOT IN ('DRAFT', 'PLANNED', 'ASSIGNED', 'CANCELLED', 'REJECTED');
    IF v_engages > 0 THEN
      RAISE EXCEPTION '% voyage(s) engage(s) ou livre(s) : le shift se cloture, il ne s''annule pas', v_engages USING ERRCODE = '22023';
    END IF;
    UPDATE public.postes SET statut = 'annule', annule_par = auth.uid(), annule_le = now(), motif_annulation = v_motif WHERE id = p.id;
  ELSE
    RAISE EXCEPTION 'Etat cible inconnu : % (en_cours ou annule ; ouvrir_poste, cloturer_shift pour les autres)', p_etat
      USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.postes_journal (poste_id, etat_avant, etat_apres, motif, auteur)
  VALUES (p.id, p.statut, p_etat, v_motif, auth.uid());
  RETURN p.version + 1;
END;
$$;

-- Redefinie depuis 20261116090000 (seule definition) : refus si des voyages
-- du poste ne sont pas termines, sauf motif consigne par cloturer_shift dans
-- la meme transaction ; transition journalisee. Bilan identique.
CREATE OR REPLACE FUNCTION public.cloturer_poste(p_poste_id uuid, p_consignes_sortie text, p_rapport text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.postes := public.poste_ecrivable(p_poste_id, 'trips', 'ouvert'); v_bilan jsonb; v_non_termines integer;
BEGIN
  IF nullif(btrim(coalesce(p_consignes_sortie, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Consignes de passation requises (meme « rien a signaler »)' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.postes_equipe WHERE poste_id = p.id AND present IS NULL) THEN
    RAISE EXCEPTION 'Presence de l''equipe a pointer avant la cloture' USING ERRCODE = '22023';
  END IF;
  v_non_termines := public.voyages_non_termines_poste(p.id);
  IF v_non_termines > 0 AND NOT EXISTS (
       SELECT 1 FROM public.postes_journal j WHERE j.poste_id = p.id AND j.etat_apres = 'cloture'
          AND j.transaction_id = txid_current() AND j.motif IS NOT NULL) THEN
    RAISE EXCEPTION '% voyage(s) non termine(s) : cloturer avec un motif (Dispatch, cloture du shift)', v_non_termines
      USING ERRCODE = '22023';
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
    'voyages_non_termines', v_non_termines,
    'presents', (SELECT count(*) FROM public.postes_equipe WHERE poste_id = p.id AND present),
    'absents', (SELECT count(*) FROM public.postes_equipe WHERE poste_id = p.id AND NOT present),
    'evenements', (SELECT count(*) FROM public.postes_evenements WHERE poste_id = p.id),
    'fige_le', now()) INTO v_bilan;
  UPDATE public.postes SET statut = 'cloture', consignes_sortie = btrim(p_consignes_sortie),
    rapport = nullif(btrim(coalesce(p_rapport, '')), ''), bilan = v_bilan, cloture_par = auth.uid(), cloture_le = now()
   WHERE id = p.id;
  IF NOT EXISTS (SELECT 1 FROM public.postes_journal j WHERE j.poste_id = p.id AND j.etat_apres = 'cloture'
                    AND j.transaction_id = txid_current()) THEN
    INSERT INTO public.postes_journal (poste_id, etat_avant, etat_apres, auteur) VALUES (p.id, p.statut, 'cloture', auth.uid());
  END IF;
  RETURN v_bilan;
END;
$$;

CREATE OR REPLACE FUNCTION public.cloturer_shift(
  p_poste_id uuid, p_consignes_sortie text, p_rapport text DEFAULT NULL, p_motif text DEFAULT NULL, p_version integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.postes := public.poste_ecrivable(p_poste_id, 'trips', 'ouvert'); v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
  v_non_termines integer;
BEGIN
  IF p_version IS NOT NULL AND p_version <> p.version THEN
    RAISE EXCEPTION 'Shift modifie entre-temps par un autre utilisateur (version % au lieu de %) : recharger', p.version, p_version
      USING ERRCODE = '40001';
  END IF;
  v_non_termines := public.voyages_non_termines_poste(p.id);
  IF v_non_termines > 0 AND v_motif IS NULL THEN
    RAISE EXCEPTION '% voyage(s) non termine(s) : motif de cloture requis', v_non_termines USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.postes_journal (poste_id, etat_avant, etat_apres, motif, donnees, auteur)
  VALUES (p.id, p.statut, 'cloture', v_motif, jsonb_build_object('voyages_non_termines', v_non_termines), auth.uid());
  RETURN public.cloturer_poste(p.id, p_consignes_sortie, p_rapport);
END;
$$;

ALTER TABLE public.postes_journal ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.postes_journal FROM anon, authenticated;
GRANT SELECT ON public.postes_journal TO authenticated;
GRANT ALL ON public.postes_journal TO service_role;
DROP POLICY IF EXISTS lecture ON public.postes_journal;
CREATE POLICY lecture ON public.postes_journal FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.postes p WHERE p.id = poste_id));

-- ---------------------------------------------------------------------------
-- 2. Plan de shift versionne
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plans_shift (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poste_id uuid NOT NULL REFERENCES public.postes(id),
  date_plan date NOT NULL,
  site_id uuid NOT NULL REFERENCES public.sites(id),
  shift_id uuid NOT NULL REFERENCES public.work_shifts(id),
  destination_id uuid REFERENCES public.sites(id),
  version integer NOT NULL CHECK (version >= 1),
  tonnes_cible numeric,
  voyages_cible integer,
  capacite_utile_t numeric,
  camions_disponibles integer,
  hypothese_charge_pct numeric CHECK (hypothese_charge_pct IS NULL OR (hypothese_charge_pct > 0 AND hypothese_charge_pct <= 100)),
  cycle_observe_min numeric,
  rotations_mesurees integer,
  besoin_voyages integer,
  voyages_existants integer NOT NULL,
  proposition integer,
  voyages_crees integer NOT NULL CHECK (voyages_crees >= 0),
  base_calcul text NOT NULL,
  motif text,
  auteur uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (date_plan, site_id, shift_id, version)
);
DROP TRIGGER IF EXISTS plans_shift_immuable ON public.plans_shift;
CREATE TRIGGER plans_shift_immuable BEFORE UPDATE OR DELETE ON public.plans_shift
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_dispatch();
ALTER TABLE public.plans_shift ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plans_shift FROM anon, authenticated;
GRANT SELECT ON public.plans_shift TO authenticated;
GRANT ALL ON public.plans_shift TO service_role;
DROP POLICY IF EXISTS lecture ON public.plans_shift;
CREATE POLICY lecture ON public.plans_shift FOR SELECT TO authenticated
  USING ((public.has_module_view('trips') OR public.has_module_view('planning') OR public.is_admin()) AND public.site_permis(site_id));

-- Besoin en voyages, calcule et explique (droits de l'appelant). Aucune
-- valeur supposee : sans objectif, sans camion ou sans hypothese de charge,
-- le besoin reste NULL et la base le dit.
CREATE OR REPLACE FUNCTION public.besoin_shift(p_date date, p_site_id uuid, p_shift_id uuid, p_hypothese_charge_pct numeric DEFAULT NULL)
RETURNS TABLE (
  tonnes_cible numeric, voyages_cible integer, capacite_utile_t numeric, camions_disponibles integer,
  hypothese_charge_pct numeric, cycle_observe_min numeric, rotations_mesurees integer,
  besoin_voyages integer, voyages_existants integer, proposition integer, base_calcul text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH o AS (
    SELECT r.tonnes_cible, r.voyages_cible FROM public.v_realisation_objectifs r
     WHERE r.date_plan = p_date AND r.site_id = p_site_id AND r.shift_id = p_shift_id
     ORDER BY r.version DESC LIMIT 1),
  c AS (
    SELECT avg(v.capacity_tonnes) AS capacite, count(*)::integer AS camions FROM public.vehicles v
     WHERE v.vehicle_type IN ('tipper', 'flatbed') AND v.status::text = 'active'
       AND (v.site_id = p_site_id OR v.site_id IS NULL) AND v.capacity_tonnes > 0
       AND NOT EXISTS (SELECT 1 FROM public.immobilisations i WHERE i.vehicle_id = v.id AND i.statut = 'ouverte')),
  d AS (
    SELECT avg(x.cycle_min) AS cycle, count(x.cycle_min)::integer AS mesures
      FROM public.durees_voyages(p_date - 14, p_date - 1) x
     WHERE x.departure_site_id = p_site_id AND x.shift_id = p_shift_id),
  e AS (
    SELECT count(*)::integer AS existants FROM public.trips t
     WHERE t.planned_date = p_date AND t.departure_site_id = p_site_id AND t.shift_id = p_shift_id
       AND t.etat NOT IN ('CANCELLED', 'REJECTED')),
  b AS (
    SELECT o.tonnes_cible, o.voyages_cible, c.capacite, c.camions, d.cycle, d.mesures, e.existants,
      CASE
        WHEN o.voyages_cible IS NOT NULL THEN o.voyages_cible
        WHEN o.tonnes_cible IS NOT NULL AND c.capacite IS NOT NULL AND p_hypothese_charge_pct > 0
          THEN ceil(o.tonnes_cible / (c.capacite * p_hypothese_charge_pct / 100))::integer
      END AS besoin
    FROM c CROSS JOIN d CROSS JOIN e LEFT JOIN o ON true)
  SELECT b.tonnes_cible, b.voyages_cible, round(b.capacite, 2), b.camions, p_hypothese_charge_pct, round(b.cycle, 1), b.mesures,
         b.besoin, b.existants, CASE WHEN b.besoin IS NOT NULL THEN greatest(b.besoin - b.existants, 0) END,
         CASE
           WHEN b.tonnes_cible IS NULL THEN 'Aucun objectif pour ce shift (Planification) : nombre a saisir avec un motif'
           WHEN b.voyages_cible IS NOT NULL THEN b.voyages_cible || ' voyages vises par l''objectif'
           WHEN b.capacite IS NULL THEN 'Aucun camion disponible de capacite connue : besoin non calculable'
           WHEN NOT (p_hypothese_charge_pct > 0) THEN 'Hypothese de charge a saisir (pourcentage de la capacite utile)'
           ELSE 'ceil(' || b.tonnes_cible || ' t / (' || round(b.capacite, 2) || ' t x ' || p_hypothese_charge_pct || ' %))'
         END
    FROM b;
$$;
REVOKE EXECUTE ON FUNCTION public.besoin_shift(date, uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.besoin_shift(date, uuid, uuid, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirmer_plan_shift(
  p_date date, p_site_id uuid, p_shift_id uuid, p_destination_id uuid, p_hypothese_charge_pct numeric,
  p_nombre integer, p_motif text DEFAULT NULL, p_version_attendue integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.postes; b record; v_version integer; v_motif text := nullif(btrim(coalesce(p_motif, '')), ''); v_id uuid;
BEGIN
  IF NOT public.has_module_write('trips') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les voyages requis' USING ERRCODE = '42501';
  END IF;
  IF p_date IS NULL OR p_site_id IS NULL OR p_shift_id IS NULL THEN
    RAISE EXCEPTION 'Date, site et shift requis' USING ERRCODE = '22023';
  END IF;
  IF NOT public.site_permis(p_site_id) THEN
    RAISE EXCEPTION 'Hors perimetre : site non autorise' USING ERRCODE = '42501';
  END IF;
  IF p_nombre IS NULL OR p_nombre < 0 OR p_nombre > 300 THEN
    RAISE EXCEPTION 'Nombre de voyages entre 0 et 300' USING ERRCODE = '22023';
  END IF;
  IF p_hypothese_charge_pct IS NOT NULL AND NOT (p_hypothese_charge_pct > 0 AND p_hypothese_charge_pct <= 100) THEN
    RAISE EXCEPTION 'Hypothese de charge entre 1 et 100 %%' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('plan_shift:' || p_date || ':' || p_shift_id || ':' || p_site_id));
  SELECT * INTO p FROM public.postes
   WHERE date_poste = p_date AND shift_id = p_shift_id AND site_id = p_site_id AND statut IN ('planifie', 'ouvert', 'en_cours');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Planifier ou ouvrir le shift avant de le preparer' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(max(version), 0) INTO v_version FROM public.plans_shift
   WHERE date_plan = p_date AND site_id = p_site_id AND shift_id = p_shift_id;
  IF p_version_attendue IS DISTINCT FROM v_version THEN
    RAISE EXCEPTION 'Plan du shift modifie entre-temps (version % enregistree) : recharger avant de confirmer', v_version
      USING ERRCODE = '40001';
  END IF;
  SELECT * INTO b FROM public.besoin_shift(p_date, p_site_id, p_shift_id, p_hypothese_charge_pct);
  IF b.proposition IS NULL AND p_nombre > 0 AND v_motif IS NULL THEN
    RAISE EXCEPTION 'Besoin non calculable (%) : motif requis pour creer % voyage(s)', b.base_calcul, p_nombre USING ERRCODE = '22023';
  END IF;
  IF b.proposition IS NOT NULL AND p_nombre <> b.proposition AND v_motif IS NULL THEN
    RAISE EXCEPTION 'Nombre different de la proposition (%) : motif de correction requis', b.proposition USING ERRCODE = '22023';
  END IF;
  IF p_nombre > 0 THEN
    IF p_destination_id IS NULL THEN
      RAISE EXCEPTION 'Destination requise' USING ERRCODE = '22023';
    END IF;
    PERFORM public.preparer_voyages(p_date, p_site_id, p_destination_id, p_shift_id, p_nombre);
  END IF;
  INSERT INTO public.plans_shift (poste_id, date_plan, site_id, shift_id, destination_id, version, tonnes_cible, voyages_cible,
    capacite_utile_t, camions_disponibles, hypothese_charge_pct, cycle_observe_min, rotations_mesurees, besoin_voyages,
    voyages_existants, proposition, voyages_crees, base_calcul, motif, auteur)
  VALUES (p.id, p_date, p_site_id, p_shift_id, p_destination_id, v_version + 1, b.tonnes_cible, b.voyages_cible,
    b.capacite_utile_t, b.camions_disponibles, p_hypothese_charge_pct, b.cycle_observe_min, b.rotations_mesurees, b.besoin_voyages,
    b.voyages_existants, b.proposition, p_nombre, b.base_calcul, v_motif, auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('plan_id', v_id, 'version', v_version + 1, 'besoin', b.besoin_voyages,
    'proposition', b.proposition, 'crees', p_nombre, 'base', b.base_calcul);
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Suspension et reprise d'un voyage
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.suspensions_voyage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rang bigint GENERATED ALWAYS AS IDENTITY,
  trip_id uuid NOT NULL REFERENCES public.trips(id),
  action text NOT NULL CHECK (action IN ('suspension', 'reprise')),
  etat_voyage text NOT NULL,
  motif text NOT NULL CHECK (btrim(motif) <> ''),
  auteur uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS suspensions_voyage_trip_idx ON public.suspensions_voyage (trip_id, rang DESC);
DROP TRIGGER IF EXISTS suspensions_voyage_immuable ON public.suspensions_voyage;
CREATE TRIGGER suspensions_voyage_immuable BEFORE UPDATE OR DELETE ON public.suspensions_voyage
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_dispatch();
ALTER TABLE public.suspensions_voyage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.suspensions_voyage FROM anon, authenticated;
GRANT SELECT ON public.suspensions_voyage TO authenticated;
GRANT ALL ON public.suspensions_voyage TO service_role;
DROP POLICY IF EXISTS lecture ON public.suspensions_voyage;
CREATE POLICY lecture ON public.suspensions_voyage FOR SELECT TO authenticated
  USING ((public.has_module_view('trips') OR public.is_admin()) AND EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id));

CREATE OR REPLACE FUNCTION public.voyage_suspendu(p_trip_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce((SELECT s.action = 'suspension' FROM public.suspensions_voyage s
                    WHERE s.trip_id = p_trip_id ORDER BY s.rang DESC LIMIT 1), false);
$$;
REVOKE EXECUTE ON FUNCTION public.voyage_suspendu(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.suspendre_voyage(p_trip_id uuid, p_motif text, p_reprise boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v public.trips; v_motif text := nullif(btrim(coalesce(p_motif, '')), ''); v_id uuid; v_suspendu boolean;
BEGIN
  IF NOT public.has_module_write('trips') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les voyages requis' USING ERRCODE = '42501';
  END IF;
  IF NOT public.voyage_permis(p_trip_id) THEN
    RAISE EXCEPTION 'Voyage introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_motif IS NULL THEN
    RAISE EXCEPTION 'Motif requis' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Voyage introuvable' USING ERRCODE = 'P0002'; END IF;
  v_suspendu := public.voyage_suspendu(v.id);
  IF p_reprise THEN
    IF NOT v_suspendu THEN
      RAISE EXCEPTION 'Voyage non suspendu : rien a reprendre' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF v_suspendu THEN
      RAISE EXCEPTION 'Voyage deja suspendu' USING ERRCODE = '22023';
    END IF;
    IF v.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED', 'CANCELLED', 'REJECTED') THEN
      RAISE EXCEPTION 'Voyage termine ou annule : suspension impossible' USING ERRCODE = '22023';
    END IF;
  END IF;
  INSERT INTO public.suspensions_voyage (trip_id, action, etat_voyage, motif, auteur)
  VALUES (v.id, CASE WHEN p_reprise THEN 'reprise' ELSE 'suspension' END, v.etat, v_motif, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reprendre_voyage(p_trip_id uuid, p_motif text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$ SELECT public.suspendre_voyage(p_trip_id, p_motif, true); $$;

CREATE OR REPLACE FUNCTION public.garde_dispatch_suspension()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.etat IS DISTINCT FROM OLD.etat AND NEW.etat <> 'CANCELLED' AND public.voyage_suspendu(NEW.id) THEN
    RAISE EXCEPTION 'Voyage suspendu : le reprendre avant de poursuivre (ou l''annuler)' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.garde_dispatch_suspension() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garde_dispatch_suspension ON public.trips;
CREATE TRIGGER garde_dispatch_suspension BEFORE UPDATE OF etat ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.garde_dispatch_suspension();

-- ---------------------------------------------------------------------------
-- 4. Disponibilite des ressources a l'affectation (toute ecriture)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.garde_dispatch_disponibilite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_cause text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.vehicle_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id) THEN
    SELECT i.cause INTO v_cause FROM public.immobilisations i WHERE i.vehicle_id = NEW.vehicle_id AND i.statut = 'ouverte';
    IF FOUND THEN
      RAISE EXCEPTION 'Camion immobilise (%) : affectation refusee', v_cause USING ERRCODE = '22023';
    END IF;
  END IF;
  IF NEW.loader_vehicle_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.loader_vehicle_id IS DISTINCT FROM OLD.loader_vehicle_id)
     AND EXISTS (SELECT 1 FROM public.immobilisations i WHERE i.vehicle_id = NEW.loader_vehicle_id AND i.statut = 'ouverte') THEN
    RAISE EXCEPTION 'Engin de chargement immobilise : affectation refusee' USING ERRCODE = '22023';
  END IF;
  IF NEW.vehicle_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id
                                     OR NEW.driver_id IS DISTINCT FROM OLD.driver_id)
     AND EXISTS (SELECT 1 FROM public.trips t WHERE t.id <> NEW.id AND t.vehicle_id = NEW.vehicle_id
                    AND t.planned_date BETWEEN NEW.planned_date - 1 AND NEW.planned_date + 1
                    AND t.driver_id IS DISTINCT FROM NEW.driver_id
                    AND t.etat IN ('AT_LOADING', 'LOADING', 'LOADED', 'WEIGHED_OUT', 'IN_TRANSIT', 'AT_DESTINATION',
                                   'UNLOADING', 'WEIGHED_IN', 'INTERRUPTED')) THEN
    RAISE EXCEPTION 'Camion engage sur un autre voyage avec un autre chauffeur' USING ERRCODE = '22023';
  END IF;
  IF NEW.driver_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id
                                    OR NEW.driver_id IS DISTINCT FROM OLD.driver_id)
     AND EXISTS (SELECT 1 FROM public.trips t WHERE t.id <> NEW.id AND t.driver_id = NEW.driver_id
                    AND t.planned_date BETWEEN NEW.planned_date - 1 AND NEW.planned_date + 1
                    AND t.vehicle_id IS DISTINCT FROM NEW.vehicle_id
                    AND t.etat IN ('AT_LOADING', 'LOADING', 'LOADED', 'WEIGHED_OUT', 'IN_TRANSIT', 'AT_DESTINATION',
                                   'UNLOADING', 'WEIGHED_IN', 'INTERRUPTED')) THEN
    RAISE EXCEPTION 'Chauffeur engage sur un autre voyage avec un autre camion' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.garde_dispatch_disponibilite() FROM PUBLIC, anon, authenticated;
-- Nom choisi pour passer apres garde_a_ressources_perimetre (ordre alphabetique).
DROP TRIGGER IF EXISTS garde_dispatch_disponibilite ON public.trips;
CREATE TRIGGER garde_dispatch_disponibilite BEFORE INSERT OR UPDATE OF vehicle_id, driver_id, loader_vehicle_id ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.garde_dispatch_disponibilite();

-- ---------------------------------------------------------------------------
-- 5. Affectation avec controle de version
-- ---------------------------------------------------------------------------
-- Version d'un voyage pour le dispatch : decisions et suspensions (append-only).
CREATE OR REPLACE FUNCTION public.version_dispatch_voyage(p_trip_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE WHEN public.voyage_permis(p_trip_id) THEN
    ((SELECT count(*) FROM public.decisions_dispatch d WHERE d.trip_id = p_trip_id)
     + (SELECT count(*) FROM public.suspensions_voyage s WHERE s.trip_id = p_trip_id))::integer END;
$$;
REVOKE EXECUTE ON FUNCTION public.version_dispatch_voyage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.version_dispatch_voyage(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.affecter_voyage(
  p_trip_id uuid,
  p_decision text,
  p_vehicle_id uuid,
  p_driver_id uuid,
  p_loader_vehicle_id uuid,
  p_recommandation jsonb,
  p_motif text,
  p_version_attendue integer
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
  RETURN public.decider_affectation(p_trip_id, p_decision, p_vehicle_id, p_driver_id, p_loader_vehicle_id, r, p_motif);
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Lectures du centre de controle
-- ---------------------------------------------------------------------------
-- Habilitations manquantes des chauffeurs du perimetre (seuls ceux qui en
-- manquent ; un chauffeur hors perimetre n'apparait jamais).
CREATE OR REPLACE FUNCTION public.habilitations_dispatch(p_date date)
RETURNS TABLE (driver_id uuid, manquant text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT d.id, public.habilitations_manquantes(d.id, p_date)
    FROM public.drivers d
   WHERE (public.has_module_view('trips') OR public.has_module_view('drivers') OR public.is_admin())
     AND public.site_permis(d.site_id) AND p_date IS NOT NULL
     AND public.habilitations_manquantes(d.id, p_date) IS NOT NULL;
$$;
REVOKE EXECUTE ON FUNCTION public.habilitations_dispatch(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.habilitations_dispatch(date) TO authenticated;

CREATE OR REPLACE FUNCTION public.indicateurs_dispatch(p_date date, p_site_id uuid, p_shift_id uuid)
RETURNS TABLE (code text, libelle text, valeur numeric, unite text, source text, filtre text, calcule_le timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH t AS (
    SELECT t.id, t.etat, t.vehicle_id, t.driver_id, t.net_weight_reception FROM public.trips t
     WHERE t.planned_date = p_date AND t.departure_site_id = p_site_id AND t.shift_id = p_shift_id),
  susp AS (
    SELECT t.id FROM t WHERE (SELECT s.action FROM public.suspensions_voyage s WHERE s.trip_id = t.id
                               ORDER BY s.rang DESC LIMIT 1) = 'suspension'),
  hab AS (SELECT h.driver_id FROM public.habilitations_dispatch(p_date) h),
  immo AS (SELECT i.vehicle_id FROM public.immobilisations i WHERE i.statut = 'ouverte'),
  engage AS (
    SELECT x.vehicle_id, x.driver_id FROM public.trips x
     WHERE x.planned_date BETWEEN p_date - 1 AND p_date
       AND x.etat IN ('AT_LOADING', 'LOADING', 'LOADED', 'WEIGHED_OUT', 'IN_TRANSIT', 'AT_DESTINATION', 'UNLOADING',
                      'WEIGHED_IN', 'INTERRUPTED')),
  camions AS (
    SELECT v.id, v.status::text AS statut, v.id IN (SELECT vehicle_id FROM immo) AS immobilise,
           v.id IN (SELECT vehicle_id FROM engage WHERE vehicle_id IS NOT NULL) AS en_mission,
           v.id IN (SELECT vehicle_id FROM t WHERE etat = 'ASSIGNED' AND vehicle_id IS NOT NULL) AS en_attente,
           EXISTS (SELECT 1 FROM t WHERE t.vehicle_id = v.id AND t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED'))
             AND NOT EXISTS (SELECT 1 FROM t WHERE t.vehicle_id = v.id
                               AND t.etat NOT IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED', 'CANCELLED', 'REJECTED')) AS libere
      FROM public.vehicles v
     WHERE v.vehicle_type IN ('tipper', 'flatbed') AND (v.site_id = p_site_id OR v.site_id IS NULL) AND v.status::text <> 'sold'),
  a_reaffecter AS (
    SELECT t.id FROM t
      LEFT JOIN public.vehicles v ON v.id = t.vehicle_id
      LEFT JOIN public.drivers d ON d.id = t.driver_id
     WHERE t.etat = 'ASSIGNED' AND (
           v.id IS NULL OR v.status::text <> 'active' OR v.id IN (SELECT vehicle_id FROM immo)
        OR d.id IS NULL OR d.status::text <> 'active' OR d.license_expiry < p_date OR d.id IN (SELECT driver_id FROM hab))),
  chauffeurs AS (
    SELECT count(*) AS n FROM public.drivers d
     WHERE (d.site_id = p_site_id OR d.site_id IS NULL) AND d.status::text = 'active' AND d.license_expiry >= p_date
       AND d.id NOT IN (SELECT driver_id FROM hab)
       AND d.id NOT IN (SELECT driver_id FROM engage WHERE driver_id IS NOT NULL)),
  chargement AS (
    SELECT count(*) AS n FROM public.vehicles v
     WHERE v.vehicle_type IN ('loader', 'excavator') AND (v.site_id = p_site_id OR v.site_id IS NULL)
       AND v.status::text = 'active' AND v.id NOT IN (SELECT vehicle_id FROM immo)),
  plan AS (
    SELECT ps.besoin_voyages FROM public.plans_shift ps
     WHERE ps.date_plan = p_date AND ps.site_id = p_site_id AND ps.shift_id = p_shift_id ORDER BY ps.version DESC LIMIT 1),
  objectif AS (
    SELECT o.tonnes_cible FROM public.v_realisation_objectifs o
     WHERE o.date_plan = p_date AND o.site_id = p_site_id AND o.shift_id = p_shift_id ORDER BY o.version DESC LIMIT 1),
  valide AS (
    SELECT sum(r.net_cbg) AS tonnes, count(*) AS lignes FROM public.v_rapprochements_pesee_courants r
      JOIN public.releves_cbg rc ON rc.id = r.releve_id AND rc.statut <> 'annule'
     WHERE r.trip_id IN (SELECT id FROM t) AND r.classes && ARRAY['concordant', 'concordant_avec_reserve']),
  cycle AS (
    SELECT avg(d.cycle_min) AS moyenne FROM public.durees_voyages(p_date, p_date) d WHERE d.trip_id IN (SELECT id FROM t)),
  ev AS (
    SELECT e.etat_apres, e.survenu_le,
           lead(e.etat_apres) OVER w AS etat_suivant, lead(e.survenu_le) OVER w AS suivant_le
      FROM public.trip_events e WHERE e.trip_id IN (SELECT id FROM t)
    WINDOW w AS (PARTITION BY e.trip_id ORDER BY e.survenu_le, e.enregistre_le)),
  attente AS (
    SELECT avg(extract(epoch FROM suivant_le - survenu_le) / 60) FILTER (WHERE etat_apres = 'AT_LOADING' AND etat_suivant = 'LOADING') AS chargement,
           avg(extract(epoch FROM suivant_le - survenu_le) / 60) FILTER (WHERE etat_apres = 'AT_DESTINATION' AND etat_suivant = 'UNLOADING') AS depot
      FROM ev)
  SELECT x.code, x.libelle, x.valeur, x.unite, x.source, x.filtre, now()
    FROM (VALUES
      ('voyages_planifies', 'Voyages planifies (plan du shift)', (SELECT besoin_voyages::numeric FROM plan), 'voyages', 'plans_shift (derniere version)', 'tous'),
      ('voyages_crees', 'Voyages crees', (SELECT count(*)::numeric FROM t), 'voyages', 'trips du shift', 'tous'),
      ('voyages_a_affecter', 'A affecter', (SELECT count(*)::numeric FROM t WHERE etat IN ('DRAFT', 'PLANNED') AND vehicle_id IS NULL), 'voyages', 'trips.etat', 'a_affecter'),
      ('voyages_affectes', 'Affectes', (SELECT count(*)::numeric FROM t WHERE etat = 'ASSIGNED'), 'voyages', 'trips.etat', 'affectes'),
      ('voyages_engages', 'Engages au chargement', (SELECT count(*)::numeric FROM t WHERE etat IN ('AT_LOADING', 'LOADING', 'LOADED', 'WEIGHED_OUT')), 'voyages', 'trips.etat', 'chargement'),
      ('voyages_en_cours', 'En route ou au depot', (SELECT count(*)::numeric FROM t WHERE etat IN ('IN_TRANSIT', 'AT_DESTINATION', 'UNLOADING', 'WEIGHED_IN')), 'voyages', 'trips.etat', 'route'),
      ('voyages_termines', 'Termines', (SELECT count(*)::numeric FROM t WHERE etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')), 'voyages', 'trips.etat', 'termines'),
      ('voyages_suspendus', 'Suspendus', (SELECT count(*)::numeric FROM susp), 'voyages', 'suspensions_voyage', 'suspendus'),
      ('voyages_annules', 'Annules ou rejetes', (SELECT count(*)::numeric FROM t WHERE etat IN ('CANCELLED', 'REJECTED')), 'voyages', 'trips.etat', 'annules'),
      ('camions_disponibles', 'Camions libres', (SELECT count(*)::numeric FROM camions WHERE statut = 'active' AND NOT immobilise AND NOT en_mission AND NOT en_attente), 'camions', 'vehicles, immobilisations, trips', 'camions'),
      ('camions_en_mission', 'Camions en mission', (SELECT count(*)::numeric FROM camions WHERE en_mission), 'camions', 'trips engages (veille et jour)', 'route'),
      ('camions_en_attente', 'Camions affectes en attente', (SELECT count(*)::numeric FROM camions WHERE en_attente AND NOT en_mission), 'camions', 'trips affectes', 'affectes'),
      ('camions_immobilises', 'Camions immobilises', (SELECT count(*)::numeric FROM camions WHERE immobilise OR statut IN ('immobilized', 'maintenance')), 'camions', 'immobilisations ouvertes, vehicles.status', 'camions'),
      ('camions_liberes', 'Camions liberes apres dechargement', (SELECT count(*)::numeric FROM camions WHERE libere AND NOT en_mission AND NOT immobilise), 'camions', 'trips livres sans voyage suivant', 'termines'),
      ('voyages_a_reaffecter', 'Voyages a reaffecter', (SELECT count(*)::numeric FROM a_reaffecter), 'voyages', 'ressource indisponible, immobilisee ou non habilitee', 'a_reaffecter'),
      ('chauffeurs_disponibles', 'Chauffeurs disponibles', (SELECT n::numeric FROM chauffeurs), 'chauffeurs', 'drivers, permis, habilitations, trips engages', 'chauffeurs'),
      ('chargement_disponible', 'Chargeuses et pelles disponibles', (SELECT n::numeric FROM chargement), 'engins', 'vehicles, immobilisations', 'camions'),
      ('tonnes_planifiees', 'Tonnes planifiees', (SELECT tonnes_cible FROM objectif), 't', 'objectifs_production (Planification)', 'tous'),
      ('tonnes_transportees', 'Tonnes transportees (tickets CBG saisis)', (SELECT sum(net_weight_reception) FROM t WHERE etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')), 't', 'trips.net_weight_reception (ticket CBG a la reception)', 'termines'),
      ('tonnes_validees', 'Tonnes validees (releve CBG rapproche)', (SELECT CASE WHEN lignes > 0 THEN tonnes END FROM valide), 't', 'v_rapprochements_pesee_courants, classes concordantes (D-081)', 'termines'),
      ('cycle_moyen', 'Temps moyen de cycle', (SELECT round(moyenne, 1) FROM cycle), 'min', 'durees_voyages (journal des voyages)', 'termines'),
      ('attente_chargement', 'Attente au chargement', (SELECT round(chargement, 1) FROM attente), 'min', 'trip_events AT_LOADING -> LOADING', 'chargement'),
      ('attente_depot', 'Attente au depot', (SELECT round(depot, 1) FROM attente), 'min', 'trip_events AT_DESTINATION -> UNLOADING', 'route'),
      ('anomalies', 'Anomalies (interrompus, litiges, a reaffecter)',
        (SELECT count(*)::numeric FROM t WHERE etat IN ('INTERRUPTED', 'DISPUTED')) + (SELECT count(*) FROM a_reaffecter), 'voyages', 'trips.etat, ressources', 'anomalies')
    ) AS x(code, libelle, valeur, unite, source, filtre);
$$;
REVOKE EXECUTE ON FUNCTION public.indicateurs_dispatch(date, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.indicateurs_dispatch(date, uuid, uuid) TO authenticated;

-- Supervision : derniere transmission par voyage non termine du shift. La
-- source est celle de l'information la plus recente (position GPS lue avec
-- le droit gps_tracking, sinon evenement declare au journal). L'anciennete
-- est rendue telle quelle : l'ecran ne presente jamais une donnee ancienne
-- comme en direct.
CREATE OR REPLACE FUNCTION public.supervision_dispatch(p_date date, p_site_id uuid, p_shift_id uuid)
RETURNS TABLE (
  trip_id uuid, reference text, etat text, vehicle_id uuid, driver_id uuid, suspendu boolean,
  position_le timestamptz, latitude numeric, longitude numeric, evenement_le timestamptz, dernier_evenement text,
  transmission_le timestamptz, source text, anciennete_min numeric, depuis_etat_min numeric, incidents integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT t.id, t.reference, t.etat, t.vehicle_id, t.driver_id,
         coalesce((SELECT s.action = 'suspension' FROM public.suspensions_voyage s WHERE s.trip_id = t.id ORDER BY s.rang DESC LIMIT 1), false),
         g."timestamp", g.latitude, g.longitude, e.survenu_le, e.etat_apres,
         greatest(g."timestamp", e.survenu_le),
         CASE WHEN g."timestamp" IS NULL AND e.survenu_le IS NULL THEN NULL
              WHEN e.survenu_le IS NULL OR g."timestamp" >= e.survenu_le THEN 'gps' ELSE 'evenement' END,
         round((extract(epoch FROM now() - greatest(g."timestamp", e.survenu_le)) / 60)::numeric, 1),
         round((extract(epoch FROM now() - t.etat_modifie_le) / 60)::numeric, 1),
         (SELECT count(*)::integer FROM public.incidents i WHERE i.trip_id = t.id)
    FROM public.trips t
    LEFT JOIN LATERAL (SELECT v."timestamp", v.latitude, v.longitude FROM public.vehicle_tracking v
                        WHERE v.vehicle_id = t.vehicle_id ORDER BY v."timestamp" DESC LIMIT 1) g ON t.vehicle_id IS NOT NULL
    LEFT JOIN LATERAL (SELECT x.survenu_le, x.etat_apres FROM public.trip_events x
                        WHERE x.trip_id = t.id ORDER BY x.survenu_le DESC, x.enregistre_le DESC LIMIT 1) e ON true
   WHERE t.planned_date = p_date AND t.departure_site_id = p_site_id AND t.shift_id = p_shift_id
     AND t.etat NOT IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED', 'CANCELLED', 'REJECTED')
   ORDER BY t.reference;
$$;
REVOKE EXECUTE ON FUNCTION public.supervision_dispatch(date, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supervision_dispatch(date, uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Droits d'execution des fonctions d'ecriture
-- ---------------------------------------------------------------------------
DO $$
DECLARE sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'planifier_poste(date, uuid, uuid, uuid, text)',
    'ouvrir_poste(date, uuid, uuid, uuid, text)',
    'changer_etat_poste(uuid, text, text, integer)',
    'cloturer_poste(uuid, text, text)',
    'cloturer_shift(uuid, text, text, text, integer)',
    'confirmer_plan_shift(date, uuid, uuid, uuid, numeric, integer, text, integer)',
    'suspendre_voyage(uuid, text, boolean)',
    'reprendre_voyage(uuid, text)',
    'affecter_voyage(uuid, text, uuid, uuid, uuid, jsonb, text, integer)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', sig);
  END LOOP;
END $$;
