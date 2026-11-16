/*
  # Saisie des referentiels et du dossier contractuel (D-079)

  Defauts releves par les fiches du catalogue (D-077), modules 02, 03 et 19,
  pendant la saisie reelle des referentiels par le proprietaire.

  1. Sites : coordonnees GPS facultatives (`latitude`, `longitude`,
     numeric(9,6), bornees, saisies ensemble ou pas du tout) ; responsable
     choisi parmi les comptes actifs (`responsable_id` -> profiles) ;
     `current_stock` n'est plus saisissable (solde, D-077) ; capacite en
     tonnes, strictement positive si renseignee (nouvelles ecritures).
     `comptes_selectionnables()` liste les comptes actifs du perimetre a qui
     peut ecrire le referentiel des sites.
  2. Comptes : `desactiver_compte` et `reactiver_compte` (administrateur,
     motif obligatoire, jamais sur son propre compte, jamais le dernier
     administrateur actif), `definir_site_compte` (site du compte ; compte
     global seulement par choix explicite motive). Journal append-only
     `journal_comptes`. Le statut et le site d'un compte ne s'ecrivent plus
     par l'API qu'au travers de ces fonctions ; garde du dernier
     administrateur actif pour tout chemin d'ecriture.
  3. Infrastructures et fermetures de site : auteur (`cree_par`,
     `declare_par`, `levee_par`) renseigne par le serveur, jamais par le
     client.
  4. Dossier contractuel : plus aucune suppression directe (politiques
     DELETE retirees, privilege DELETE retire) ; `supprimer_element_contrat`
     ne supprime qu'un element d'un contrat brouillon, sans dependance, avec
     motif et journal (`suppressions_contrats`). Un tarif d'une version en
     vigueur d'un contrat qui n'est plus brouillon ne se modifie pas sur
     place : `modifier_tarif_par_avenant` cree l'avenant (D-033). Un contrat
     ne repasse pas en brouillon.

  Additive et idempotente. Aucune donnee modifiee.
*/

-- ---------------------------------------------------------------------------
-- 1. Sites
-- ---------------------------------------------------------------------------

ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS latitude numeric(9,6);
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS longitude numeric(9,6);
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS responsable_id uuid REFERENCES public.profiles(id);
CREATE INDEX IF NOT EXISTS idx_sites_responsable ON public.sites (responsable_id);

COMMENT ON COLUMN public.sites.capacity IS 'Capacite de stockage du site, en tonnes (D-079).';
COMMENT ON COLUMN public.sites.current_stock IS 'Herite de Bolt, non saisissable (D-079) : aucune source calculee a ce jour.';
COMMENT ON COLUMN public.sites.manager_id IS 'Herite de Bolt (employees), plus saisi : voir responsable_id (D-079).';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sites_coordonnees_ensemble') THEN
    ALTER TABLE public.sites ADD CONSTRAINT sites_coordonnees_ensemble
      CHECK ((latitude IS NULL) = (longitude IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sites_latitude_bornee') THEN
    ALTER TABLE public.sites ADD CONSTRAINT sites_latitude_bornee
      CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sites_longitude_bornee') THEN
    ALTER TABLE public.sites ADD CONSTRAINT sites_longitude_bornee
      CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
  END IF;
  -- NOT VALID : les lignes existantes ne sont pas reecrites ; les nouvelles
  -- ecritures sont controlees.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sites_capacite_positive') THEN
    ALTER TABLE public.sites ADD CONSTRAINT sites_capacite_positive
      CHECK (capacity IS NULL OR capacity > 0) NOT VALID;
  END IF;
END $$;

-- Compte actif (lecture des profils hors RLS, pour les gardes).
CREATE OR REPLACE FUNCTION public.compte_actif(p_compte uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_compte AND p.status = 'active');
$$;
REVOKE EXECUTE ON FUNCTION public.compte_actif(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compte_actif(uuid) TO authenticated, service_role;

-- Garde de saisie des sites (appelant de l'API seulement : une fonction
-- serveur ou le service gardent la main).
CREATE OR REPLACE FUNCTION public.garde_saisie_site()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;
  IF (TG_OP = 'INSERT' AND coalesce(NEW.current_stock, 0) <> 0)
     OR (TG_OP = 'UPDATE' AND NEW.current_stock IS DISTINCT FROM OLD.current_stock) THEN
    RAISE EXCEPTION 'Stock du site non saisissable : un solde se calcule, il ne se saisit pas (D-077)'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.responsable_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.responsable_id IS DISTINCT FROM OLD.responsable_id)
     AND NOT public.compte_actif(NEW.responsable_id) THEN
    RAISE EXCEPTION 'Responsable du site : compte inconnu ou inactif' USING ERRCODE = '22023';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.manager_id IS DISTINCT FROM OLD.manager_id THEN
    RAISE EXCEPTION 'Responsable herite (employees) non modifiable : choisir un compte actif' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.garde_saisie_site() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garde_saisie_site ON public.sites;
CREATE TRIGGER garde_saisie_site BEFORE INSERT OR UPDATE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.garde_saisie_site();

-- Comptes actifs choisissables comme responsable : reserve a qui ecrit le
-- referentiel des sites ; un compte borne ne voit que les comptes de son
-- perimetre et les comptes globaux.
CREATE OR REPLACE FUNCTION public.comptes_selectionnables()
RETURNS TABLE (id uuid, full_name text, role text, site_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (public.is_admin() OR public.has_module_write('settings')) THEN
    RAISE EXCEPTION 'Liste des comptes reservee a l''administration des sites' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id, p.full_name, p.role::text, p.site_id
      FROM public.profiles p
     WHERE p.status = 'active'
       AND (p.site_id IS NULL OR public.site_permis(p.site_id))
     ORDER BY p.full_name;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.comptes_selectionnables() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.comptes_selectionnables() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Comptes : statut et site par fonction serveur, journal
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.journal_comptes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur uuid NOT NULL REFERENCES public.profiles(id),
  action text NOT NULL CHECK (action IN ('desactivation', 'reactivation', 'site', 'perimetre_global')),
  statut_avant text,
  statut_apres text,
  site_avant uuid,
  site_apres uuid,
  motif text CHECK (motif IS NULL OR btrim(motif) <> ''),
  auteur uuid,
  le timestamptz NOT NULL DEFAULT now(),
  CHECK (action = 'site' OR motif IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_journal_comptes ON public.journal_comptes (utilisateur, le);
ALTER TABLE public.journal_comptes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.journal_comptes FROM anon, authenticated;
GRANT SELECT ON public.journal_comptes TO authenticated;
GRANT ALL ON public.journal_comptes TO service_role;
DROP POLICY IF EXISTS lecture_admin ON public.journal_comptes;
CREATE POLICY lecture_admin ON public.journal_comptes FOR SELECT TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.garde_journal_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Journal non modifiable (%)', TG_TABLE_NAME USING ERRCODE = '42501';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.garde_journal_append_only() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS append_only ON public.journal_comptes;
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON public.journal_comptes
  FOR EACH ROW EXECUTE FUNCTION public.garde_journal_append_only();

-- Nombre d'administrateurs actifs autres que p_exclu (hors RLS).
CREATE OR REPLACE FUNCTION public.autres_admins_actifs(p_exclu uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT count(*)::int FROM public.profiles p
   WHERE p.role = 'admin' AND p.status = 'active' AND p.id IS DISTINCT FROM p_exclu;
$$;
REVOKE EXECUTE ON FUNCTION public.autres_admins_actifs(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.autres_admins_actifs(uuid) TO service_role;

-- Garde des comptes :
--  * tout chemin : le dernier administrateur actif ne perd ni son role ni
--    son statut (verrou consultatif pour serialiser deux retraits) ;
--  * appelant de l'API : ni son propre role ni son propre statut ; statut
--    et site seulement par les fonctions serveur (motif et journal).
-- La garde est SECURITY INVOKER : current_user y vaut authenticated pour un
-- appel de l'API, et le proprietaire quand l'ecriture vient d'une fonction
-- serveur (desactiver_compte...). Le comptage des administrateurs, hors RLS,
-- est delegue a autres_admins_actifs (SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.garde_comptes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_api boolean := current_user IN ('authenticated', 'anon');
BEGIN
  IF OLD.role = 'admin' AND OLD.status = 'active'
     AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status) THEN
    PERFORM pg_advisory_xact_lock(hashtext('sigtb.administrateurs_actifs'));
    IF public.autres_admins_actifs(OLD.id) = 0 THEN
      RAISE EXCEPTION 'Dernier administrateur actif : il garde son role et son statut' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF v_api THEN
    IF OLD.id = auth.uid()
       AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status) THEN
      RAISE EXCEPTION 'Votre propre role ou statut ne se modifie pas : un autre administrateur le fait'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Statut d''un compte : utiliser Desactiver ou Reactiver (motif obligatoire)' USING ERRCODE = '42501';
    END IF;
    IF NEW.site_id IS DISTINCT FROM OLD.site_id THEN
      RAISE EXCEPTION 'Site d''un compte : utiliser definir_site_compte (journalise)' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.garde_comptes() FROM PUBLIC, anon, authenticated;
-- Nom choisi pour passer avant profiles_guard_sensitive_columns (ordre alphabetique).
DROP TRIGGER IF EXISTS profiles_garde_comptes ON public.profiles;
CREATE TRIGGER profiles_garde_comptes BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.garde_comptes();

CREATE OR REPLACE FUNCTION public.desactiver_compte(p_utilisateur uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_statut text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Desactivation d''un compte reservee a l''administrateur' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motif de la desactivation obligatoire' USING ERRCODE = '22023';
  END IF;
  IF p_utilisateur = auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez pas desactiver votre propre compte' USING ERRCODE = '42501';
  END IF;
  SELECT p.status INTO v_statut FROM public.profiles p WHERE p.id = p_utilisateur FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compte inconnu' USING ERRCODE = '23503';
  END IF;
  IF v_statut <> 'active' THEN
    RAISE EXCEPTION 'Compte deja inactif' USING ERRCODE = '22023';
  END IF;
  -- La garde profiles_garde_comptes refuse le dernier administrateur actif.
  UPDATE public.profiles SET status = 'inactive', updated_at = now() WHERE id = p_utilisateur;
  INSERT INTO public.journal_comptes (utilisateur, action, statut_avant, statut_apres, motif, auteur)
  VALUES (p_utilisateur, 'desactivation', v_statut, 'inactive', btrim(p_motif), auth.uid());
END;
$$;
REVOKE EXECUTE ON FUNCTION public.desactiver_compte(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desactiver_compte(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reactiver_compte(p_utilisateur uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_statut text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Reactivation d''un compte reservee a l''administrateur' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motif de la reactivation obligatoire' USING ERRCODE = '22023';
  END IF;
  IF p_utilisateur = auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez pas reactiver votre propre compte' USING ERRCODE = '42501';
  END IF;
  SELECT p.status INTO v_statut FROM public.profiles p WHERE p.id = p_utilisateur FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compte inconnu' USING ERRCODE = '23503';
  END IF;
  IF v_statut = 'active' THEN
    RAISE EXCEPTION 'Compte deja actif' USING ERRCODE = '22023';
  END IF;
  UPDATE public.profiles SET status = 'active', updated_at = now() WHERE id = p_utilisateur;
  INSERT INTO public.journal_comptes (utilisateur, action, statut_avant, statut_apres, motif, auteur)
  VALUES (p_utilisateur, 'reactivation', v_statut, 'active', btrim(p_motif), auth.uid());
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reactiver_compte(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reactiver_compte(uuid, text) TO authenticated, service_role;

-- Site d'un compte : un site actif, ou le perimetre global par choix
-- explicite motive (journalise meme sans changement : cas de la creation).
CREATE OR REPLACE FUNCTION public.definir_site_compte(p_utilisateur uuid, p_site uuid, p_motif text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_avant uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Site d''un compte : reserve a l''administrateur' USING ERRCODE = '42501';
  END IF;
  SELECT p.site_id INTO v_avant FROM public.profiles p WHERE p.id = p_utilisateur FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compte inconnu' USING ERRCODE = '23503';
  END IF;
  IF p_site IS NULL THEN
    IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Compte global (tous les sites) : motif obligatoire' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.id = p_site AND coalesce(s.is_active, true)) THEN
      RAISE EXCEPTION 'Site inconnu ou inactif' USING ERRCODE = '22023';
    END IF;
    IF v_avant IS NOT DISTINCT FROM p_site THEN
      RETURN;
    END IF;
  END IF;
  UPDATE public.profiles SET site_id = p_site, updated_at = now() WHERE id = p_utilisateur;
  INSERT INTO public.journal_comptes (utilisateur, action, site_avant, site_apres, motif, auteur)
  VALUES (p_utilisateur, CASE WHEN p_site IS NULL THEN 'perimetre_global' ELSE 'site' END,
          v_avant, p_site, nullif(btrim(coalesce(p_motif, '')), ''), auth.uid());
END;
$$;
REVOKE EXECUTE ON FUNCTION public.definir_site_compte(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_site_compte(uuid, uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Infrastructures et fermetures : auteur renseigne par le serveur
-- ---------------------------------------------------------------------------

ALTER TABLE public.fermetures_site ADD COLUMN IF NOT EXISTS levee_par uuid REFERENCES auth.users(id);

REVOKE INSERT (cree_par) ON public.infrastructures_site FROM authenticated;
REVOKE INSERT (declare_par) ON public.fermetures_site FROM authenticated;

CREATE OR REPLACE FUNCTION public.auteur_infrastructure_site()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'infrastructures_site' THEN
    NEW.cree_par := auth.uid();
  ELSIF TG_OP = 'INSERT' THEN
    NEW.declare_par := auth.uid();
  ELSIF OLD.levee_le IS NULL AND NEW.levee_le IS NOT NULL THEN
    NEW.levee_par := auth.uid();
  ELSIF NEW.levee_par IS DISTINCT FROM OLD.levee_par THEN
    RAISE EXCEPTION 'Auteur de la levee non modifiable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.auteur_infrastructure_site() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS auteur_serveur ON public.infrastructures_site;
CREATE TRIGGER auteur_serveur BEFORE INSERT ON public.infrastructures_site
  FOR EACH ROW EXECUTE FUNCTION public.auteur_infrastructure_site();
DROP TRIGGER IF EXISTS auteur_serveur ON public.fermetures_site;
CREATE TRIGGER auteur_serveur BEFORE INSERT OR UPDATE ON public.fermetures_site
  FOR EACH ROW EXECUTE FUNCTION public.auteur_infrastructure_site();

-- ---------------------------------------------------------------------------
-- 4. Dossier contractuel
-- ---------------------------------------------------------------------------

-- 4.1 Plus de suppression directe.
DROP POLICY IF EXISTS suppression_module ON public.contrats;
DROP POLICY IF EXISTS suppression_module ON public.contrat_versions;
DROP POLICY IF EXISTS suppression_module ON public.contrat_engagements;
DROP POLICY IF EXISTS suppression_module ON public.contrat_tarifs;
REVOKE DELETE ON public.contrats, public.contrat_versions, public.contrat_engagements, public.contrat_tarifs
  FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.suppressions_contrats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_cible text NOT NULL CHECK (table_cible IN ('contrats', 'contrat_versions', 'contrat_engagements', 'contrat_tarifs')),
  ligne_id uuid NOT NULL,
  contrat_id uuid NOT NULL,
  contenu jsonb NOT NULL,
  motif text NOT NULL CHECK (btrim(motif) <> ''),
  auteur uuid,
  le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suppressions_contrats ON public.suppressions_contrats (contrat_id, le);
ALTER TABLE public.suppressions_contrats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.suppressions_contrats FROM anon, authenticated;
GRANT SELECT ON public.suppressions_contrats TO authenticated;
GRANT ALL ON public.suppressions_contrats TO service_role;
DROP POLICY IF EXISTS lecture_module ON public.suppressions_contrats;
CREATE POLICY lecture_module ON public.suppressions_contrats FOR SELECT TO authenticated
  USING (public.has_module_view('contracts') OR public.is_admin());
DROP TRIGGER IF EXISTS append_only ON public.suppressions_contrats;
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON public.suppressions_contrats
  FOR EACH ROW EXECUTE FUNCTION public.garde_journal_append_only();

-- Suppression d'un element jamais utilise d'un contrat brouillon. Toute
-- reference (cle etrangere vers la ligne, y compris ses propres tarifs,
-- engagements ou versions) bloque : supprimer d'abord les elements
-- dependants, ou cloturer / annuler le contrat.
CREATE OR REPLACE FUNCTION public.supprimer_element_contrat(p_table text, p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_contrat uuid;
  v_statut text;
  v_contenu jsonb;
  v_ref record;
  v_existe boolean;
  v_dependances text[] := ARRAY[]::text[];
BEGIN
  IF NOT (public.has_module_write('contracts') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Suppression reservee au module contrats' USING ERRCODE = '42501';
  END IF;
  IF p_table IS NULL OR p_table NOT IN ('contrats', 'contrat_versions', 'contrat_engagements', 'contrat_tarifs') THEN
    RAISE EXCEPTION 'Element de contrat inconnu : %', p_table USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motif de la suppression obligatoire' USING ERRCODE = '22023';
  END IF;

  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE t.id = $1 FOR UPDATE', p_table)
    INTO v_contenu USING p_id;
  IF v_contenu IS NULL THEN
    RAISE EXCEPTION 'Element introuvable' USING ERRCODE = '23503';
  END IF;
  v_contrat := CASE p_table
    WHEN 'contrats' THEN p_id
    WHEN 'contrat_versions' THEN (v_contenu->>'contrat_id')::uuid
    ELSE (SELECT v.contrat_id FROM public.contrat_versions v WHERE v.id = (v_contenu->>'version_id')::uuid)
  END;
  SELECT c.statut INTO v_statut FROM public.contrats c WHERE c.id = v_contrat FOR UPDATE;
  IF v_statut IS DISTINCT FROM 'brouillon' THEN
    RAISE EXCEPTION 'Contrat % : un element ne se supprime pas. Retirez-le par un avenant (nouvelle version sans cet element) ou cloturez le contrat avec motif', v_statut
      USING ERRCODE = '22023';
  END IF;

  FOR v_ref IN
    SELECT c.conrelid::regclass AS tab, a.attname AS col
      FROM pg_catalog.pg_constraint c
      JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND c.confrelid = format('public.%I', p_table)::regclass
       AND array_length(c.conkey, 1) = 1
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE %I = $1)', v_ref.tab, v_ref.col) INTO v_existe USING p_id;
    IF v_existe THEN
      v_dependances := v_dependances || v_ref.tab::text;
    END IF;
  END LOOP;
  IF cardinality(v_dependances) > 0 THEN
    RAISE EXCEPTION 'Element utilise (%) : supprimez d''abord les elements dependants, sinon annulez ou cloturez',
      array_to_string(v_dependances, ', ') USING ERRCODE = '23503';
  END IF;

  INSERT INTO public.suppressions_contrats (table_cible, ligne_id, contrat_id, contenu, motif, auteur)
  VALUES (p_table, p_id, v_contrat, v_contenu, btrim(p_motif), auth.uid());
  EXECUTE format('DELETE FROM public.%I WHERE id = $1', p_table) USING p_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.supprimer_element_contrat(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supprimer_element_contrat(text, uuid, text) TO authenticated, service_role;

-- 4.2 Gardes de modification (appelant de l'API seulement).
-- Une version est « en vigueur ou passee » quand sa date d'effet est
-- atteinte ; sur un contrat qui n'est plus brouillon, ses tarifs ne se
-- modifient pas et sa date d'effet ne bouge plus.
CREATE OR REPLACE FUNCTION public.garde_tarif_en_vigueur()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_statut text;
  v_effet date;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;
  SELECT c.statut, v.date_effet INTO v_statut, v_effet
    FROM public.contrat_versions v JOIN public.contrats c ON c.id = v.contrat_id
   WHERE v.id = OLD.version_id;
  IF NEW.version_id IS DISTINCT FROM OLD.version_id THEN
    RAISE EXCEPTION 'Un tarif ne change pas de version' USING ERRCODE = '22023';
  END IF;
  IF v_statut IS DISTINCT FROM 'brouillon' AND v_effet <= current_date THEN
    RAISE EXCEPTION 'Tarif en vigueur d''un contrat %, non modifiable sur place : modifiez-le par un avenant (D-033)', v_statut
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.garde_tarif_en_vigueur() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garde_tarif_en_vigueur ON public.contrat_tarifs;
CREATE TRIGGER garde_tarif_en_vigueur BEFORE UPDATE ON public.contrat_tarifs
  FOR EACH ROW EXECUTE FUNCTION public.garde_tarif_en_vigueur();

CREATE OR REPLACE FUNCTION public.garde_version_en_vigueur()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_statut text;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;
  SELECT c.statut INTO v_statut FROM public.contrats c WHERE c.id = OLD.contrat_id;
  IF v_statut IS DISTINCT FROM 'brouillon' AND OLD.date_effet <= current_date
     AND (NEW.date_effet IS DISTINCT FROM OLD.date_effet OR NEW.numero IS DISTINCT FROM OLD.numero
          OR NEW.contrat_id IS DISTINCT FROM OLD.contrat_id) THEN
    RAISE EXCEPTION 'Version en vigueur d''un contrat % : numero et date d''effet fixes ; creez un avenant', v_statut
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.garde_version_en_vigueur() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garde_version_en_vigueur ON public.contrat_versions;
CREATE TRIGGER garde_version_en_vigueur BEFORE UPDATE ON public.contrat_versions
  FOR EACH ROW EXECUTE FUNCTION public.garde_version_en_vigueur();

CREATE OR REPLACE FUNCTION public.garde_retour_brouillon()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;
  IF OLD.statut <> 'brouillon' AND NEW.statut = 'brouillon' THEN
    RAISE EXCEPTION 'Un contrat % ne repasse pas en brouillon', OLD.statut USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.garde_retour_brouillon() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garde_retour_brouillon ON public.contrats;
CREATE TRIGGER garde_retour_brouillon BEFORE UPDATE ON public.contrats
  FOR EACH ROW EXECUTE FUNCTION public.garde_retour_brouillon();

-- 4.3 Modification d'un tarif en vigueur par avenant : nouvelle version
-- (numero suivant), reprise complete de la grille de la version du tarif
-- (tarifs, engagements, clauses actives rattachees au meme engagement),
-- le tarif vise portant les nouvelles valeurs. Tout ou rien.
CREATE OR REPLACE FUNCTION public.modifier_tarif_par_avenant(
  p_tarif uuid,
  p_prix numeric,
  p_intitule text,
  p_date_effet date,
  p_libelle text DEFAULT NULL,
  p_conditions text DEFAULT NULL,
  p_resume text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  t public.contrat_tarifs;
  v public.contrat_versions;
  v_statut text;
  v_nouvelle uuid;
  v_numero integer;
  e record;
  v_eng uuid;
BEGIN
  IF NOT (public.has_module_write('contracts') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Avenant reserve au module contrats' USING ERRCODE = '42501';
  END IF;
  IF p_prix IS NULL OR p_prix < 0 THEN
    RAISE EXCEPTION 'Prix du tarif requis (positif ou nul)' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce(p_intitule, '')), '') IS NULL OR p_date_effet IS NULL THEN
    RAISE EXCEPTION 'Avenant : intitule et date d''effet obligatoires' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO t FROM public.contrat_tarifs WHERE id = p_tarif;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarif introuvable' USING ERRCODE = '23503';
  END IF;
  SELECT * INTO v FROM public.contrat_versions WHERE id = t.version_id;
  SELECT c.statut INTO v_statut FROM public.contrats c WHERE c.id = v.contrat_id FOR UPDATE;
  IF v_statut = 'clos' THEN
    RAISE EXCEPTION 'Contrat clos : aucun avenant' USING ERRCODE = '22023';
  END IF;
  IF p_date_effet <= v.date_effet THEN
    RAISE EXCEPTION 'La date d''effet de l''avenant doit suivre celle de la version modifiee (%)', to_char(v.date_effet, 'DD/MM/YYYY')
      USING ERRCODE = '22023';
  END IF;
  SELECT max(x.numero) INTO v_numero FROM public.contrat_versions x WHERE x.contrat_id = v.contrat_id;
  IF v_numero > v.numero THEN
    RAISE EXCEPTION 'Une version plus recente existe (n° %) : modifiez le tarif dans cette version', v_numero
      USING ERRCODE = '22023';
  END IF;
  v_numero := v_numero + 1;

  INSERT INTO public.contrat_versions (contrat_id, numero, intitule, date_effet, resume, cree_par)
  VALUES (v.contrat_id, v_numero, btrim(p_intitule), p_date_effet,
          coalesce(nullif(btrim(coalesce(p_resume, '')), ''),
                   format('Tarif « %s » : %s -> %s (avenant n° %s, reprise de la version n° %s)', t.libelle, t.prix, p_prix, v_numero, v.numero)),
          auth.uid())
  RETURNING id INTO v_nouvelle;

  INSERT INTO public.contrat_tarifs (version_id, libelle, unite, prix, categorie_materiel, engin, conditions, ordre, km_retour_vide_facturable)
  SELECT v_nouvelle,
         CASE WHEN x.id = t.id THEN coalesce(nullif(btrim(coalesce(p_libelle, '')), ''), x.libelle) ELSE x.libelle END,
         x.unite,
         CASE WHEN x.id = t.id THEN p_prix ELSE x.prix END,
         x.categorie_materiel, x.engin,
         CASE WHEN x.id = t.id AND p_conditions IS NOT NULL THEN nullif(btrim(p_conditions), '') ELSE x.conditions END,
         x.ordre, x.km_retour_vide_facturable
    FROM public.contrat_tarifs x WHERE x.version_id = v.id;

  FOR e IN SELECT * FROM public.contrat_engagements WHERE version_id = v.id LOOP
    INSERT INTO public.contrat_engagements (version_id, indicateur, libelle, seuil, unite, sens, periodicite, consequence, ordre)
    VALUES (v_nouvelle, e.indicateur, e.libelle, e.seuil, e.unite, e.sens, e.periodicite, e.consequence, e.ordre)
    RETURNING id INTO v_eng;
    INSERT INTO public.contrat_clauses (version_id, type_clause, libelle, engagement_id, declenchement, base, valeur, plafond_ht, article, ordre, cree_par)
    SELECT v_nouvelle, k.type_clause, k.libelle, v_eng, k.declenchement, k.base, k.valeur, k.plafond_ht, k.article, k.ordre, auth.uid()
      FROM public.contrat_clauses k WHERE k.version_id = v.id AND k.engagement_id = e.id AND k.actif;
  END LOOP;
  RETURN v_nouvelle;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.modifier_tarif_par_avenant(uuid, numeric, text, date, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.modifier_tarif_par_avenant(uuid, numeric, text, date, text, text, text) TO authenticated, service_role;
