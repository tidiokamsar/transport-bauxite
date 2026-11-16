/*
  # Organisation et administration (D-064, lot 02, module 02)

  Developpee avant D-071 a D-075, integree sur `main` apres elles et
  renumerotee au-dessus de la derniere migration (D-070). Les fonctions de
  droits et de perimetre redefinies ici reprennent a l'identique leur
  derniere definition sur `main` (site_permis : 20261114100000, D-038 ;
  has_module_view et has_module_write : 20261112060000, D-036 ;
  has_module_approve : 20261117090000, D-053 ; vehicule_permis et
  voyage_permis : 20261115210000, D-046) ; memes signatures, meme langage,
  STABLE, SECURITY DEFINER, search_path vide, memes droits d'execution.
  is_admin() et has_module_approve (corps de main, sans delegation) ne
  changent pas de regle.

  Revue independante de l'integration (2026-11-16), constats corriges ici :
  C1 l'approbation ne se delegue plus (separation des taches contournee) ;
  C2 performance : corps D-036 recopies dans has_module_view et
  has_module_write, delegation lue seulement si une ligne existe, indicateur
  derive `profiles.perimetre_affecte` (site_permis sans sous-requete pour les
  comptes jamais affectes), regle de perimetre ecrite en ligne dans
  vehicule_permis et voyage_permis (meme resultat) ; C3 debut de delegation
  jamais dans le passe ; C4 comptes delegables seulement pour qui detient un
  droit d'ecriture delegable ; C5 retour au perimetre global refuse a un
  compte inactif, delegations identiques serialisees ; C6 vue du journal de
  connexion en security_barrier.

  1. Affectations multisites (`affectations_sites`) : un profil peut etre
     affecte a plusieurs sites, chacun pour une periode datee (debut, fin
     incluse ; fin NULL = sans terme). `site_permis(site)` devient :
     compte actif ET (
       - profil global : profiles.site_id NULL et aucune affectation (meme
         annulee, meme expiree) creee depuis son dernier retour au
         perimetre global (comportement D-038 inchange tant qu'aucune
         affectation n'existe) ;
       - ou site du profil (profiles.site_id, D-038) ;
       - ou affectation non annulee a ce site, en cours a la date du jour).
     Un compte qui a recu une affectation ne redevient jamais global de
     lui-meme : ni a l'expiration, ni a l'annulation de toutes ses
     affectations (il est alors sans acces site). Le retour au perimetre
     global est une decision explicite de l'administrateur, motivee et
     journalisee (`retablir_perimetre_global`, table append-only
     `retours_perimetre_global`), refusee tant qu'une affectation est en
     cours ou a venir ou que le profil porte un site. Une affectation
     anterieure au retour ne compte plus et ne se prolonge plus.
     Ecriture par l'administrateur seulement (`affecter_site`,
     `cloturer_affectation_site`, `annuler_affectation_site`), sous un
     verrou consultatif par compte ; journal append-only
     `journal_affectations_sites`. `perimetres_comptes()` donne a
     l'administrateur le perimetre calcule par le serveur.
     `profiles.perimetre_affecte` (derive, jamais saisi : recalcule par
     declencheur a toute ecriture du profil, d'une affectation ou d'un
     retour) vaut true si une affectation a ete creee depuis le dernier
     retour au perimetre global.

  2. Delegations temporaires (`delegations_droits`) : un utilisateur delegue
     son droit d'ecriture sur un module a un autre compte (l'approbation ne
     se delegue pas tant que le proprietaire n'a pas tranche, C1),
     pour une periode datee, avec motif (`deleguer_droit`). Revocation par
     le delegant ou l'administrateur (`revoquer_delegation`, motif). Journal
     append-only `journal_delegations`. Interdits : deleguer un droit qu'on
     n'a pas (les droits recus par delegation ne se redeleguent pas),
     deleguer a soi-meme, deleguer le module d'administration (settings),
     deleguer a un compte dont le perimetre site depasse celui du delegant ;
     is_admin() ne lit jamais les delegations. Une delegation ne vaut que
     pendant sa periode (debut inclus, fin exclue), tant qu'elle n'est pas
     revoquee, que le delegue est actif, que le delegant garde le droit
     delegue, que le perimetre du delegue reste inclus dans celui du
     delegant et qu'aucune restriction administrateur (D-036, niveau
     lecture ou aucun sur ce module) ne vise le delegue. Elle donne la
     lecture du module seulement si le delegant la detient. Le delegue
     reste borne par son propre site_permis et reste l'auteur de ses actes
     (auth.uid()) : les controles de separation des taches s'appliquent a
     lui. `has_module_view` et `has_module_write` gardent exactement leur
     corps (D-036) et y ajoutent la delegation en vigueur ; sans delegation,
     resultat identique. `has_module_approve` ne lit pas les delegations.

  3. Journal de connexion : `v_journal_connexions`, vue au proprietaire
     (lecture de auth.audit_log_entries, ecrite par GoTrue) limitee a
     is_admin(). Ni jeton ni payload brut. Les tentatives echouees n'y
     figurent pas (GoTrue n'a pas d'action d'audit pour elles).
     `sessions_ouvertes()` liste auth.sessions (sans cle ni jeton) pour
     l'administrateur. `user_activity_logs` (heritage Bolt) n'est pas un
     journal de connexion et n'est pas repris.

  4. Referentiels : `devises` (code ISO a trois lettres) reprises des codes
     reellement presents ; `unites_mesure` reprises de la liste fermee des
     tarifs de contrat. Ecriture par l'administrateur (`enregistrer_devise`,
     `enregistrer_unite`). Aucune contrainte nouvelle sur les saisies
     existantes. `codes_utilises()` confronte les codes saisis au
     referentiel. `sequences_numerotation()` (administrateur) liste les
     numerotations existantes, en lecture : aucun format n'est change.

  Tables nouvelles : RLS active avec politique de lecture explicite, aucune
  ecriture directe des comptes (ni INSERT, ni UPDATE, ni DELETE, ni
  TRUNCATE) ; ecriture par fonctions SECURITY DEFINER.

  Idempotent : IF NOT EXISTS, CREATE OR REPLACE, DROP ... IF EXISTS.
*/

-- 1. Affectations multisites ------------------------------------------------

CREATE TABLE IF NOT EXISTS public.affectations_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id),
  debut date NOT NULL,
  fin date,
  motif text,
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT clock_timestamp(),
  annulee_le timestamptz,
  annulee_par uuid REFERENCES auth.users(id),
  motif_annulation text,
  CONSTRAINT affectations_sites_periode CHECK (fin IS NULL OR fin >= debut),
  CONSTRAINT affectations_sites_annulation CHECK (annulee_le IS NULL OR motif_annulation IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_affectations_sites_utilisateur
  ON public.affectations_sites (utilisateur, site_id) WHERE annulee_le IS NULL;
CREATE INDEX IF NOT EXISTS idx_affectations_sites_creation
  ON public.affectations_sites (utilisateur, cree_le);

CREATE TABLE IF NOT EXISTS public.journal_affectations_sites (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  affectation_id uuid NOT NULL,
  utilisateur uuid NOT NULL,
  site_id uuid NOT NULL,
  evenement text NOT NULL CHECK (evenement IN ('creation', 'cloture', 'annulation')),
  avant jsonb,
  apres jsonb,
  motif text,
  auteur uuid,
  le timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_journal_affectations_sites_utilisateur
  ON public.journal_affectations_sites (utilisateur, le);

-- Retours au perimetre global : decision de l'administrateur, motivee,
-- append-only (la ligne est son propre journal).
CREATE TABLE IF NOT EXISTS public.retours_perimetre_global (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  utilisateur uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  le timestamptz NOT NULL DEFAULT clock_timestamp(),
  motif text NOT NULL CHECK (btrim(motif) <> ''),
  auteur uuid
);
CREATE INDEX IF NOT EXISTS idx_retours_perimetre_global_utilisateur
  ON public.retours_perimetre_global (utilisateur, le);

ALTER TABLE public.affectations_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_affectations_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retours_perimetre_global ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.affectations_sites, public.journal_affectations_sites, public.retours_perimetre_global
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.affectations_sites, public.journal_affectations_sites, public.retours_perimetre_global
  TO authenticated;
GRANT ALL ON public.affectations_sites, public.journal_affectations_sites, public.retours_perimetre_global
  TO service_role;

DROP POLICY IF EXISTS lecture ON public.affectations_sites;
CREATE POLICY lecture ON public.affectations_sites FOR SELECT TO authenticated
  USING (utilisateur = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS lecture ON public.journal_affectations_sites;
CREATE POLICY lecture ON public.journal_affectations_sites FOR SELECT TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS lecture ON public.retours_perimetre_global;
CREATE POLICY lecture ON public.retours_perimetre_global FOR SELECT TO authenticated
  USING (utilisateur = auth.uid() OR public.is_admin());

-- Gardes : journaux append-only ; une affectation ne se supprime pas, ses
-- colonnes d'identite ne changent pas, une affectation annulee est figee.
CREATE OR REPLACE FUNCTION public.garde_journal_organisation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN coalesce(NEW, OLD); END IF;
  RAISE EXCEPTION 'Journal : ligne non modifiable' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS garde_append_only ON public.journal_affectations_sites;
CREATE TRIGGER garde_append_only BEFORE UPDATE OR DELETE ON public.journal_affectations_sites
  FOR EACH ROW EXECUTE FUNCTION public.garde_journal_organisation();
DROP TRIGGER IF EXISTS garde_append_only ON public.retours_perimetre_global;
CREATE TRIGGER garde_append_only BEFORE UPDATE OR DELETE ON public.retours_perimetre_global
  FOR EACH ROW EXECUTE FUNCTION public.garde_journal_organisation();

CREATE OR REPLACE FUNCTION public.garde_affectation_site()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN coalesce(NEW, OLD); END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Une affectation ne se supprime pas : annulez-la' USING ERRCODE = '42501';
  END IF;
  IF OLD.annulee_le IS NOT NULL THEN
    RAISE EXCEPTION 'Affectation annulee : non modifiable' USING ERRCODE = '42501';
  END IF;
  IF NEW.utilisateur IS DISTINCT FROM OLD.utilisateur OR NEW.site_id IS DISTINCT FROM OLD.site_id
     OR NEW.debut IS DISTINCT FROM OLD.debut OR NEW.cree_par IS DISTINCT FROM OLD.cree_par
     OR NEW.cree_le IS DISTINCT FROM OLD.cree_le THEN
    RAISE EXCEPTION 'Affectation : seuls la fin et l''annulation se modifient' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS garde_affectation ON public.affectations_sites;
CREATE TRIGGER garde_affectation BEFORE UPDATE OR DELETE ON public.affectations_sites
  FOR EACH ROW EXECUTE FUNCTION public.garde_affectation_site();

REVOKE EXECUTE ON FUNCTION public.garde_journal_organisation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.garde_affectation_site() FROM PUBLIC, anon, authenticated;

-- Indicateur derive (C2) : une affectation creee depuis le dernier retour au
-- perimetre global. Jamais saisi : le declencheur du profil le recalcule a
-- chaque ecriture, ceux des affectations et des retours le rafraichissent.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS perimetre_affecte boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.perimetre_affecte_calcule(p_utilisateur uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.affectations_sites a
     WHERE a.utilisateur = p_utilisateur
       AND a.cree_le >= coalesce((SELECT max(r.le) FROM public.retours_perimetre_global r
                                   WHERE r.utilisateur = p_utilisateur), '-infinity'::timestamptz));
$$;

CREATE OR REPLACE FUNCTION public.profil_perimetre_affecte()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.perimetre_affecte := public.perimetre_affecte_calcule(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profil_perimetre_affecte ON public.profiles;
CREATE TRIGGER profil_perimetre_affecte BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profil_perimetre_affecte();

CREATE OR REPLACE FUNCTION public.rafraichir_perimetre_affecte()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_utilisateurs uuid[];
BEGIN
  -- Insertion, modification ou suppression (contre-revue R3) : l'ancien et le
  -- nouveau compte sont recalcules.
  v_utilisateurs := CASE TG_OP WHEN 'INSERT' THEN ARRAY[NEW.utilisateur]
                               WHEN 'DELETE' THEN ARRAY[OLD.utilisateur]
                               ELSE ARRAY[NEW.utilisateur, OLD.utilisateur] END;
  UPDATE public.profiles SET perimetre_affecte = public.perimetre_affecte_calcule(id)
   WHERE id = ANY (v_utilisateurs) AND perimetre_affecte IS DISTINCT FROM public.perimetre_affecte_calcule(id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS rafraichir_perimetre_affecte ON public.affectations_sites;
CREATE TRIGGER rafraichir_perimetre_affecte AFTER INSERT OR UPDATE OR DELETE ON public.affectations_sites
  FOR EACH ROW EXECUTE FUNCTION public.rafraichir_perimetre_affecte();
DROP TRIGGER IF EXISTS rafraichir_perimetre_affecte ON public.retours_perimetre_global;
CREATE TRIGGER rafraichir_perimetre_affecte AFTER INSERT OR UPDATE OR DELETE ON public.retours_perimetre_global
  FOR EACH ROW EXECUTE FUNCTION public.rafraichir_perimetre_affecte();

-- La colonne n'est jamais saisie : droits de colonne retires (le declencheur
-- du profil reste la garde effective, les droits de table existants sur
-- profiles couvrant toutes les colonnes).
REVOKE INSERT (perimetre_affecte), UPDATE (perimetre_affecte) ON public.profiles FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.perimetre_affecte_calcule(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.profil_perimetre_affecte() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rafraichir_perimetre_affecte() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.perimetre_affecte_calcule(uuid) TO service_role;

-- Rattrapage (migration rejouee apres des affectations) : seuls les profils
-- dont l'indicateur differe sont touches.
UPDATE public.profiles p SET perimetre_affecte = public.perimetre_affecte_calcule(p.id)
 WHERE p.perimetre_affecte IS DISTINCT FROM public.perimetre_affecte_calcule(p.id);

-- Affectation non annulee en cours a ce site (interne : n'est appelee par
-- site_permis, vehicule_permis et voyage_permis que pour un compte affecte).
CREATE OR REPLACE FUNCTION public.affectation_en_cours(p_utilisateur uuid, p_site uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.affectations_sites a
                  WHERE a.utilisateur = p_utilisateur
                    AND a.annulee_le IS NULL
                    AND a.site_id = p_site
                    AND a.debut <= current_date
                    AND (a.fin IS NULL OR a.fin >= current_date));
$$;
REVOKE EXECUTE ON FUNCTION public.affectation_en_cours(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.affectation_en_cours(uuid, uuid) TO service_role;

-- Perimetre : site du profil, profil global (sans site, jamais affecte
-- depuis son dernier retour), ou affectation en cours. Meme signature,
-- langage, volatilite et droits que D-038 (20261114100000). Les affectations
-- ne sont lues que pour un compte affecte, par un appel (C2 : aucun
-- sous-plan a initialiser a chaque appel).
CREATE OR REPLACE FUNCTION public.site_permis(p_site uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles pr
     WHERE pr.id = auth.uid()
       AND pr.status = 'active'
       AND (pr.site_id = p_site
            OR (pr.site_id IS NULL AND NOT pr.perimetre_affecte)
            OR (pr.perimetre_affecte AND public.affectation_en_cours(pr.id, p_site)))
  );
$$;

REVOKE EXECUTE ON FUNCTION public.site_permis(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.site_permis(uuid) TO authenticated, service_role;

-- Meme regle pour un compte quelconque (controle des delegations). Interne :
-- non executable par les comptes.
CREATE OR REPLACE FUNCTION public.perimetre_global_de(p_utilisateur uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles pr
     WHERE pr.id = p_utilisateur
       AND pr.status = 'active'
       AND pr.site_id IS NULL
       AND NOT pr.perimetre_affecte
  );
$$;

-- Sites permis a la date du jour d'un compte borne (vide pour un compte
-- global, inactif ou sans acces site).
CREATE OR REPLACE FUNCTION public.sites_permis_de(p_utilisateur uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pr.site_id FROM public.profiles pr
   WHERE pr.id = p_utilisateur AND pr.status = 'active' AND pr.site_id IS NOT NULL
  UNION
  SELECT a.site_id FROM public.affectations_sites a
    JOIN public.profiles pr ON pr.id = a.utilisateur AND pr.status = 'active'
   WHERE a.utilisateur = p_utilisateur
     AND a.annulee_le IS NULL
     AND a.debut <= current_date
     AND (a.fin IS NULL OR a.fin >= current_date);
$$;

-- Le perimetre du delegue est inclus dans celui du delegant : delegant
-- global, ou delegue borne dont chaque site permis l'est aussi au delegant.
CREATE OR REPLACE FUNCTION public.perimetre_inclus(p_delegue uuid, p_delegant uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.perimetre_global_de(p_delegant)
      OR (NOT public.perimetre_global_de(p_delegue)
          AND NOT EXISTS (SELECT s FROM public.sites_permis_de(p_delegue) s
                          EXCEPT
                          SELECT s FROM public.sites_permis_de(p_delegant) s));
$$;

-- vehicule_permis et voyage_permis (C2) : regle de site_permis ecrite en
-- ligne, une seule lecture du profil, aucun appel imbrique par ligne.
-- Resultat identique a D-046 (20261115210000) : compte global = toujours
-- true (y compris pour un identifiant inconnu, site_permis(NULL)) ; compte
-- borne = site de l'engin, ou site de depart ou d'arrivee du voyage, egal au
-- site du profil ou a une affectation en cours ; engin ou voyage inconnu, ou
-- sans site = false ; compte inactif = false.
CREATE OR REPLACE FUNCTION public.vehicule_permis(p_vehicle uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles pr
     WHERE pr.id = auth.uid()
       AND pr.status = 'active'
       AND ((pr.site_id IS NULL AND NOT pr.perimetre_affecte)
            OR EXISTS (SELECT 1 FROM public.vehicles v
                        WHERE v.id = p_vehicle
                          AND (v.site_id = pr.site_id
                               OR (pr.perimetre_affecte AND public.affectation_en_cours(pr.id, v.site_id)))))
  );
$$;

CREATE OR REPLACE FUNCTION public.voyage_permis(p_trip uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles pr
     WHERE pr.id = auth.uid()
       AND pr.status = 'active'
       AND ((pr.site_id IS NULL AND NOT pr.perimetre_affecte)
            OR EXISTS (SELECT 1 FROM public.trips t
                        WHERE t.id = p_trip
                          AND (t.departure_site_id = pr.site_id OR t.arrival_site_id = pr.site_id
                               OR (pr.perimetre_affecte
                                   AND (public.affectation_en_cours(pr.id, t.departure_site_id)
                                        OR public.affectation_en_cours(pr.id, t.arrival_site_id))))))
  );
$$;

REVOKE EXECUTE ON FUNCTION public.perimetre_global_de(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sites_permis_de(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.perimetre_inclus(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.perimetre_global_de(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sites_permis_de(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.perimetre_inclus(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.affecter_site(
  p_utilisateur uuid, p_site uuid, p_debut date, p_fin date DEFAULT NULL, p_motif text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Affectation des sites reservee a l''administrateur' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_utilisateur) THEN
    RAISE EXCEPTION 'Utilisateur inconnu' USING ERRCODE = '23503';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sites WHERE id = p_site) THEN
    RAISE EXCEPTION 'Site inconnu' USING ERRCODE = '23503';
  END IF;
  IF p_debut IS NULL THEN
    RAISE EXCEPTION 'Date de debut requise' USING ERRCODE = '22023';
  END IF;
  IF p_fin IS NOT NULL AND p_fin < p_debut THEN
    RAISE EXCEPTION 'La fin precede le debut' USING ERRCODE = '22023';
  END IF;
  -- Meme verrou que la cloture et le retour au perimetre global : l'horodatage
  -- de creation est pris apres le verrou (clock_timestamp), donc toujours
  -- posterieur a un retour deja valide.
  PERFORM pg_advisory_xact_lock(hashtext('sigtb.affectation.' || p_utilisateur::text));
  IF EXISTS (SELECT 1 FROM public.affectations_sites a
              WHERE a.utilisateur = p_utilisateur AND a.site_id = p_site AND a.annulee_le IS NULL
                AND a.debut <= coalesce(p_fin, 'infinity'::date)
                AND coalesce(a.fin, 'infinity'::date) >= p_debut
                AND a.cree_le >= coalesce((SELECT max(r.le) FROM public.retours_perimetre_global r
                                            WHERE r.utilisateur = p_utilisateur), '-infinity'::timestamptz)) THEN
    RAISE EXCEPTION 'Une affectation a ce site couvre deja tout ou partie de la periode' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.affectations_sites (utilisateur, site_id, debut, fin, motif, cree_par, cree_le)
  VALUES (p_utilisateur, p_site, p_debut, p_fin, v_motif, auth.uid(), clock_timestamp())
  RETURNING id INTO v_id;
  INSERT INTO public.journal_affectations_sites (affectation_id, utilisateur, site_id, evenement, avant, apres, motif, auteur)
  VALUES (v_id, p_utilisateur, p_site, 'creation', NULL,
          jsonb_build_object('debut', p_debut, 'fin', p_fin), v_motif, auth.uid());
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cloturer_affectation_site(p_id uuid, p_fin date, p_motif text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  a public.affectations_sites;
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Affectation des sites reservee a l''administrateur' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO a FROM public.affectations_sites WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Affectation inconnue ou annulee' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('sigtb.affectation.' || a.utilisateur::text));
  SELECT * INTO a FROM public.affectations_sites WHERE id = p_id FOR UPDATE;
  IF a.annulee_le IS NOT NULL THEN
    RAISE EXCEPTION 'Affectation inconnue ou annulee' USING ERRCODE = '22023';
  END IF;
  IF a.cree_le < coalesce((SELECT max(r.le) FROM public.retours_perimetre_global r
                            WHERE r.utilisateur = a.utilisateur), '-infinity'::timestamptz) THEN
    RAISE EXCEPTION 'Affectation anterieure au retour du compte au perimetre global : creez une nouvelle affectation'
      USING ERRCODE = '22023';
  END IF;
  IF p_fin IS NULL OR p_fin < a.debut THEN
    RAISE EXCEPTION 'Date de fin requise, au plus tot le debut (sinon annulez l''affectation)' USING ERRCODE = '22023';
  END IF;
  IF a.fin IS NOT DISTINCT FROM p_fin THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.affectations_sites x
              WHERE x.utilisateur = a.utilisateur AND x.site_id = a.site_id AND x.annulee_le IS NULL
                AND x.id <> a.id AND x.debut <= p_fin AND coalesce(x.fin, 'infinity'::date) >= a.debut
                AND x.cree_le >= coalesce((SELECT max(r.le) FROM public.retours_perimetre_global r
                                            WHERE r.utilisateur = a.utilisateur), '-infinity'::timestamptz)) THEN
    RAISE EXCEPTION 'Une autre affectation a ce site couvre deja la periode' USING ERRCODE = '22023';
  END IF;
  UPDATE public.affectations_sites SET fin = p_fin WHERE id = p_id;
  INSERT INTO public.journal_affectations_sites (affectation_id, utilisateur, site_id, evenement, avant, apres, motif, auteur)
  VALUES (a.id, a.utilisateur, a.site_id, 'cloture', jsonb_build_object('fin', a.fin),
          jsonb_build_object('fin', p_fin), v_motif, auth.uid());
END;
$$;

-- Annulation (erreur de saisie) : l'affectation ne donne plus aucun site.
-- Le compte ne redevient pas global pour autant (voir retablir_perimetre_global).
CREATE OR REPLACE FUNCTION public.annuler_affectation_site(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  a public.affectations_sites;
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Affectation des sites reservee a l''administrateur' USING ERRCODE = '42501';
  END IF;
  IF v_motif IS NULL THEN
    RAISE EXCEPTION 'Motif d''annulation requis' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO a FROM public.affectations_sites WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Affectation inconnue ou deja annulee' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('sigtb.affectation.' || a.utilisateur::text));
  SELECT * INTO a FROM public.affectations_sites WHERE id = p_id FOR UPDATE;
  IF a.annulee_le IS NOT NULL THEN
    RAISE EXCEPTION 'Affectation inconnue ou deja annulee' USING ERRCODE = '22023';
  END IF;
  UPDATE public.affectations_sites
     SET annulee_le = now(), annulee_par = auth.uid(), motif_annulation = v_motif
   WHERE id = p_id;
  INSERT INTO public.journal_affectations_sites (affectation_id, utilisateur, site_id, evenement, avant, apres, motif, auteur)
  VALUES (a.id, a.utilisateur, a.site_id, 'annulation',
          jsonb_build_object('debut', a.debut, 'fin', a.fin), NULL, v_motif, auth.uid());
END;
$$;

-- Retour explicite au perimetre global (decision consignee, motivee) :
-- profil sans site, aucune affectation en cours ou a venir.
CREATE OR REPLACE FUNCTION public.retablir_perimetre_global(p_utilisateur uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
  v_site uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Perimetre des comptes reserve a l''administrateur' USING ERRCODE = '42501';
  END IF;
  IF v_motif IS NULL THEN
    RAISE EXCEPTION 'Motif requis' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('sigtb.affectation.' || coalesce(p_utilisateur::text, '')));
  SELECT site_id INTO v_site FROM public.profiles WHERE id = p_utilisateur;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utilisateur inconnu' USING ERRCODE = '23503';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_utilisateur AND status = 'active') THEN
    RAISE EXCEPTION 'Compte inactif : reactivez-le avant de lui rendre le perimetre global' USING ERRCODE = '22023';
  END IF;
  IF v_site IS NOT NULL THEN
    RAISE EXCEPTION 'Le profil porte un site : retirez-le de la fiche utilisateur' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.affectations_sites a
                  WHERE a.utilisateur = p_utilisateur
                    AND a.cree_le >= coalesce((SELECT max(r.le) FROM public.retours_perimetre_global r
                                                WHERE r.utilisateur = p_utilisateur), '-infinity'::timestamptz)) THEN
    RAISE EXCEPTION 'Le compte a deja le perimetre global' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.affectations_sites a
              WHERE a.utilisateur = p_utilisateur AND a.annulee_le IS NULL
                AND (a.fin IS NULL OR a.fin >= current_date)) THEN
    RAISE EXCEPTION 'Affectation en cours ou a venir : closez-la ou annulez-la d''abord' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.retours_perimetre_global (utilisateur, le, motif, auteur)
  VALUES (p_utilisateur, clock_timestamp(), v_motif, auth.uid());
END;
$$;

-- Perimetre calcule par le serveur, pour l'ecran d'administration.
CREATE OR REPLACE FUNCTION public.perimetres_comptes()
RETURNS TABLE (utilisateur uuid, nom text, statut text, site_profil uuid, global boolean, sites uuid[],
               retour_possible boolean, dernier_retour timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Perimetre des comptes reserve a l''administrateur' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT p.id, p.full_name::text, p.status::text, p.site_id,
         public.perimetre_global_de(p.id),
         coalesce((SELECT array_agg(s ORDER BY s) FROM public.sites_permis_de(p.id) s), ARRAY[]::uuid[]),
         p.status = 'active' AND p.site_id IS NULL AND NOT public.perimetre_global_de(p.id)
           AND NOT EXISTS (SELECT 1 FROM public.affectations_sites a
                            WHERE a.utilisateur = p.id AND a.annulee_le IS NULL
                              AND (a.fin IS NULL OR a.fin >= current_date)),
         (SELECT max(r.le) FROM public.retours_perimetre_global r WHERE r.utilisateur = p.id)
    FROM public.profiles p
   ORDER BY p.full_name;
END;
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['affecter_site(uuid, uuid, date, date, text)',
                           'cloturer_affectation_site(uuid, date, text)',
                           'annuler_affectation_site(uuid, text)',
                           'retablir_perimetre_global(uuid, text)',
                           'perimetres_comptes()'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- Vue d'administration : affectations, statut a la date du jour.
DROP VIEW IF EXISTS public.v_affectations_sites;
CREATE VIEW public.v_affectations_sites WITH (security_invoker = on) AS
SELECT a.id, a.utilisateur, p.full_name AS utilisateur_nom, a.site_id, s.name AS site_nom,
       a.debut, a.fin, a.motif, a.cree_le, a.annulee_le, a.motif_annulation,
       CASE WHEN a.annulee_le IS NOT NULL THEN 'annulee'
            WHEN a.debut > current_date THEN 'a_venir'
            WHEN a.fin IS NOT NULL AND a.fin < current_date THEN 'terminee'
            ELSE 'en_cours' END AS statut
  FROM public.affectations_sites a
  LEFT JOIN public.profiles p ON p.id = a.utilisateur
  LEFT JOIN public.sites s ON s.id = a.site_id;
REVOKE ALL ON public.v_affectations_sites FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_affectations_sites TO authenticated, service_role;

-- 2. Delegations temporaires ------------------------------------------------

CREATE TABLE IF NOT EXISTS public.delegations_droits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delegant uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delegue uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module text NOT NULL,
  niveau text NOT NULL CHECK (niveau = 'ecriture'),
  debut timestamptz NOT NULL,
  fin timestamptz NOT NULL,
  motif text NOT NULL CHECK (btrim(motif) <> ''),
  cree_le timestamptz NOT NULL DEFAULT now(),
  revoquee_le timestamptz,
  revoquee_par uuid REFERENCES auth.users(id),
  motif_revocation text,
  CONSTRAINT delegations_droits_periode CHECK (fin > debut),
  CONSTRAINT delegations_droits_soi CHECK (delegant <> delegue),
  CONSTRAINT delegations_droits_module CHECK (module <> 'settings'),
  CONSTRAINT delegations_droits_revocation CHECK (revoquee_le IS NULL OR motif_revocation IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_delegations_droits_delegue
  ON public.delegations_droits (delegue, module) WHERE revoquee_le IS NULL;
CREATE INDEX IF NOT EXISTS idx_delegations_droits_delegant ON public.delegations_droits (delegant);

CREATE TABLE IF NOT EXISTS public.journal_delegations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  delegation_id uuid NOT NULL,
  evenement text NOT NULL CHECK (evenement IN ('creation', 'revocation')),
  delegant uuid NOT NULL,
  delegue uuid NOT NULL,
  module text NOT NULL,
  niveau text NOT NULL,
  debut timestamptz NOT NULL,
  fin timestamptz NOT NULL,
  motif text,
  auteur uuid,
  le timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_journal_delegations_delegation ON public.journal_delegations (delegation_id, le);

ALTER TABLE public.delegations_droits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_delegations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delegations_droits, public.journal_delegations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.delegations_droits, public.journal_delegations TO authenticated;
GRANT ALL ON public.delegations_droits, public.journal_delegations TO service_role;

DROP POLICY IF EXISTS lecture ON public.delegations_droits;
CREATE POLICY lecture ON public.delegations_droits FOR SELECT TO authenticated
  USING (delegant = auth.uid() OR delegue = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS lecture ON public.journal_delegations;
CREATE POLICY lecture ON public.journal_delegations FOR SELECT TO authenticated
  USING (delegant = auth.uid() OR delegue = auth.uid() OR public.is_admin());

DROP TRIGGER IF EXISTS garde_append_only ON public.journal_delegations;
CREATE TRIGGER garde_append_only BEFORE UPDATE OR DELETE ON public.journal_delegations
  FOR EACH ROW EXECUTE FUNCTION public.garde_journal_organisation();

CREATE OR REPLACE FUNCTION public.garde_delegation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN coalesce(NEW, OLD); END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Une delegation ne se supprime pas : revoquez-la' USING ERRCODE = '42501';
  END IF;
  IF OLD.revoquee_le IS NOT NULL THEN
    RAISE EXCEPTION 'Delegation revoquee : non modifiable' USING ERRCODE = '42501';
  END IF;
  IF NEW.delegant IS DISTINCT FROM OLD.delegant OR NEW.delegue IS DISTINCT FROM OLD.delegue
     OR NEW.module IS DISTINCT FROM OLD.module OR NEW.niveau IS DISTINCT FROM OLD.niveau
     OR NEW.debut IS DISTINCT FROM OLD.debut OR NEW.fin IS DISTINCT FROM OLD.fin
     OR NEW.motif IS DISTINCT FROM OLD.motif OR NEW.cree_le IS DISTINCT FROM OLD.cree_le THEN
    RAISE EXCEPTION 'Delegation : seule la revocation se modifie' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS garde_delegation ON public.delegations_droits;
CREATE TRIGGER garde_delegation BEFORE UPDATE OR DELETE ON public.delegations_droits
  FOR EACH ROW EXECUTE FUNCTION public.garde_delegation();
REVOKE EXECUTE ON FUNCTION public.garde_delegation() FROM PUBLIC, anon, authenticated;

-- MFA (D-040) : les delegations, les affectations et les retours au
-- perimetre global sont des droits.
DROP TRIGGER IF EXISTS garde_aal2 ON public.delegations_droits;
CREATE TRIGGER garde_aal2 BEFORE INSERT OR UPDATE OR DELETE ON public.delegations_droits
  FOR EACH ROW EXECUTE FUNCTION public.garde_aal2();
DROP TRIGGER IF EXISTS garde_aal2 ON public.affectations_sites;
CREATE TRIGGER garde_aal2 BEFORE INSERT OR UPDATE OR DELETE ON public.affectations_sites
  FOR EACH ROW EXECUTE FUNCTION public.garde_aal2();
DROP TRIGGER IF EXISTS garde_aal2 ON public.retours_perimetre_global;
CREATE TRIGGER garde_aal2 BEFORE INSERT OR UPDATE OR DELETE ON public.retours_perimetre_global
  FOR EACH ROW EXECUTE FUNCTION public.garde_aal2();

-- Droit propre d'un compte (sans delegation), pour controler le delegant.
-- Corps repris a l'identique de has_module_view et has_module_write
-- (20261112060000, D-036), auth.uid() remplace par le compte passe en
-- parametre. Interne : non executable par les comptes.
CREATE OR REPLACE FUNCTION public.droit_module_base(p_utilisateur uuid, p_module text, p_niveau text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = p_utilisateur AND pr.status = 'active')
    AND CASE p_niveau
      WHEN 'lecture' THEN COALESCE(
        (SELECT d.niveau IN ('lecture', 'ecriture') FROM public.droits_utilisateur d
          WHERE d.utilisateur = p_utilisateur AND d.module = p_module),
        EXISTS (SELECT 1 FROM public.profiles pr
                  JOIN public.role_permissions rp ON rp.role::text = pr.role::text
                 WHERE pr.id = p_utilisateur AND pr.status = 'active'
                   AND rp.module = p_module AND rp.can_view))
      WHEN 'ecriture' THEN COALESCE(
        (SELECT d.niveau = 'ecriture' FROM public.droits_utilisateur d
          WHERE d.utilisateur = p_utilisateur AND d.module = p_module),
        EXISTS (SELECT 1 FROM public.profiles pr
                  JOIN public.role_permissions rp ON rp.role::text = pr.role::text
                 WHERE pr.id = p_utilisateur AND pr.status = 'active'
                   AND rp.module = p_module AND (rp.can_create OR rp.can_edit)))
      ELSE false
    END;
$$;

-- Effet d'une delegation hors periode et revocation : delegue actif et non
-- restreint (D-036), delegant detenant encore le droit delegue (jamais par
-- delegation), perimetre du delegue inclus dans celui du delegant.
CREATE OR REPLACE FUNCTION public.delegation_effective(p_delegant uuid, p_delegue uuid, p_module text, p_niveau text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p_module <> 'settings'
    AND p_delegant <> p_delegue
    AND EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = p_delegue AND pr.status = 'active')
    AND NOT EXISTS (SELECT 1 FROM public.droits_utilisateur d
                     WHERE d.utilisateur = p_delegue AND d.module = p_module AND d.niveau <> 'ecriture')
    AND public.droit_module_base(p_delegant, p_module, p_niveau)
    AND public.perimetre_inclus(p_delegue, p_delegant);
$$;

-- Delegation en vigueur pour un compte. Niveau NULL : lecture du module,
-- accordee seulement si le delegant lit lui-meme le module.
CREATE OR REPLACE FUNCTION public.delegation_en_vigueur(p_utilisateur uuid, p_module text, p_niveau text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.delegations_droits g
     WHERE g.delegue = p_utilisateur
       AND g.module = p_module
       AND g.revoquee_le IS NULL
       AND g.debut <= now() AND now() < g.fin
       AND (p_niveau IS NULL OR g.niveau = p_niveau)
       AND public.delegation_effective(g.delegant, g.delegue, g.module, g.niveau)
       AND (p_niveau IS NOT NULL OR public.droit_module_base(g.delegant, g.module, 'lecture')));
$$;

REVOKE EXECUTE ON FUNCTION public.droit_module_base(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delegation_effective(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delegation_en_vigueur(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.droit_module_base(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.delegation_effective(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.delegation_en_vigueur(uuid, text, text) TO service_role;

-- Fonctions de droits : memes signatures, langage, volatilite et securite
-- que sur main ; droits d'execution inchanges (CREATE OR REPLACE les garde).
-- Corps de main recopies a l'identique (C2 : pas d'appel imbrique pour le
-- droit propre) ; la delegation n'est lue que si le droit propre est faux et
-- qu'une ligne de delegation en periode existe (sonde en ligne sur l'index
-- partiel, moins couteuse qu'un appel de fonction par ligne, mesure du
-- 2026-11-16).
CREATE OR REPLACE FUNCTION public.has_module_view(p_module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (EXISTS (SELECT 1 FROM public.profiles pr
              WHERE pr.id = auth.uid() AND pr.status = 'active')
     AND COALESCE(
       (SELECT d.niveau IN ('lecture', 'ecriture')
          FROM public.droits_utilisateur d
         WHERE d.utilisateur = auth.uid() AND d.module = p_module),
       EXISTS (
         SELECT 1
         FROM public.profiles pr
         JOIN public.role_permissions rp ON rp.role::text = pr.role::text
         WHERE pr.id = auth.uid()
           AND pr.status = 'active'
           AND rp.module = p_module
           AND rp.can_view)
     ))
    OR (EXISTS (SELECT 1 FROM public.delegations_droits g
                 WHERE g.delegue = auth.uid() AND g.module = p_module AND g.revoquee_le IS NULL
                   AND g.debut <= now() AND now() < g.fin)
        AND public.delegation_en_vigueur(auth.uid(), p_module, NULL));
$$;

CREATE OR REPLACE FUNCTION public.has_module_write(p_module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (EXISTS (SELECT 1 FROM public.profiles pr
              WHERE pr.id = auth.uid() AND pr.status = 'active')
     AND COALESCE(
       (SELECT d.niveau = 'ecriture'
          FROM public.droits_utilisateur d
         WHERE d.utilisateur = auth.uid() AND d.module = p_module),
       EXISTS (
         SELECT 1
         FROM public.profiles pr
         JOIN public.role_permissions rp ON rp.role::text = pr.role::text
         WHERE pr.id = auth.uid()
           AND pr.status = 'active'
           AND rp.module = p_module
           AND (rp.can_create OR rp.can_edit))
     ))
    OR (EXISTS (SELECT 1 FROM public.delegations_droits g
                 WHERE g.delegue = auth.uid() AND g.module = p_module AND g.revoquee_le IS NULL
                   AND g.debut <= now() AND now() < g.fin)
        AND public.delegation_en_vigueur(auth.uid(), p_module, 'ecriture'));
$$;

-- Approbation : corps de main (20261117090000, D-053), sans delegation (C1 :
-- une approbation deleguee contournait la separation des taches).
CREATE OR REPLACE FUNCTION public.has_module_approve(p_module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.status = 'active')
    AND coalesce((SELECT d.niveau = 'ecriture' FROM public.droits_utilisateur d
                   WHERE d.utilisateur = auth.uid() AND d.module = p_module), true)
    AND EXISTS (SELECT 1 FROM public.profiles pr JOIN public.role_permissions rp ON rp.role::text = pr.role::text
                 WHERE pr.id = auth.uid() AND pr.status = 'active' AND rp.module = p_module AND rp.can_approve);
$$;

CREATE OR REPLACE FUNCTION public.deleguer_droit(
  p_delegue uuid, p_module text, p_niveau text, p_debut timestamptz, p_fin timestamptz, p_motif text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  -- C3 : jamais dans le passe (une delegation retroactive est ramenee a
  -- l'instant present, valeur journalisee).
  v_debut timestamptz := greatest(coalesce(p_debut, now()), now());
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'active') THEN
    RAISE EXCEPTION 'Compte actif requis' USING ERRCODE = '42501';
  END IF;
  IF p_niveau = 'approbation' THEN
    RAISE EXCEPTION 'L''approbation ne se delegue pas (D-064, decision du proprietaire attendue)' USING ERRCODE = '22023';
  END IF;
  IF p_niveau IS NULL OR p_niveau <> 'ecriture' THEN
    RAISE EXCEPTION 'Niveau delegable : ecriture (la lecture du module l''accompagne)' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.role_permissions rp WHERE rp.module = p_module) THEN
    RAISE EXCEPTION 'Module inconnu : %', p_module USING ERRCODE = '22023';
  END IF;
  IF p_module = 'settings' THEN
    RAISE EXCEPTION 'L''administration ne se delegue pas' USING ERRCODE = '22023';
  END IF;
  IF p_delegue IS NULL OR p_delegue = auth.uid() THEN
    RAISE EXCEPTION 'Delegation a soi-meme interdite' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_delegue AND status = 'active') THEN
    RAISE EXCEPTION 'Delegue inconnu ou inactif' USING ERRCODE = '22023';
  END IF;
  IF v_motif IS NULL THEN
    RAISE EXCEPTION 'Motif requis' USING ERRCODE = '22023';
  END IF;
  IF p_fin IS NULL OR p_fin <= v_debut OR p_fin <= now() THEN
    RAISE EXCEPTION 'Periode invalide : la fin doit suivre le debut et l''instant present' USING ERRCODE = '22023';
  END IF;
  IF NOT public.droit_module_base(auth.uid(), p_module, p_niveau) THEN
    RAISE EXCEPTION 'Vous ne detenez pas ce droit (%, %) : il ne peut etre delegue', p_module, p_niveau
      USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.droits_utilisateur d
              WHERE d.utilisateur = p_delegue AND d.module = p_module AND d.niveau <> 'ecriture') THEN
    RAISE EXCEPTION 'Le delegue fait l''objet d''une restriction administrateur sur ce module' USING ERRCODE = '22023';
  END IF;
  IF NOT public.perimetre_inclus(p_delegue, auth.uid()) THEN
    RAISE EXCEPTION 'Le perimetre site du delegue depasse le votre : delegation refusee' USING ERRCODE = '22023';
  END IF;
  -- C5 : deux delegations identiques concurrentes sont serialisees.
  PERFORM pg_advisory_xact_lock(hashtext('sigtb.delegation.' || auth.uid()::text || '.' || p_delegue::text || '.' || p_module));
  IF EXISTS (SELECT 1 FROM public.delegations_droits g
              WHERE g.delegant = auth.uid() AND g.delegue = p_delegue AND g.module = p_module
                AND g.niveau = p_niveau AND g.revoquee_le IS NULL
                AND g.debut < p_fin AND g.fin > v_debut) THEN
    RAISE EXCEPTION 'Une delegation identique couvre deja la periode' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.delegations_droits (delegant, delegue, module, niveau, debut, fin, motif)
  VALUES (auth.uid(), p_delegue, p_module, p_niveau, v_debut, p_fin, v_motif)
  RETURNING id INTO v_id;
  INSERT INTO public.journal_delegations (delegation_id, evenement, delegant, delegue, module, niveau, debut, fin, motif, auteur)
  VALUES (v_id, 'creation', auth.uid(), p_delegue, p_module, p_niveau, v_debut, p_fin, v_motif, auth.uid());
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoquer_delegation(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  g public.delegations_droits;
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
BEGIN
  SELECT * INTO g FROM public.delegations_droits WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delegation inconnue' USING ERRCODE = '22023';
  END IF;
  IF NOT (public.is_admin()
          OR (g.delegant = auth.uid()
              AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'active'))) THEN
    RAISE EXCEPTION 'Revocation reservee au delegant ou a l''administrateur' USING ERRCODE = '42501';
  END IF;
  IF v_motif IS NULL THEN
    RAISE EXCEPTION 'Motif de revocation requis' USING ERRCODE = '22023';
  END IF;
  IF g.revoquee_le IS NOT NULL THEN
    RAISE EXCEPTION 'Delegation deja revoquee' USING ERRCODE = '22023';
  END IF;
  IF g.fin <= now() THEN
    RAISE EXCEPTION 'Delegation deja expiree' USING ERRCODE = '22023';
  END IF;
  UPDATE public.delegations_droits
     SET revoquee_le = now(), revoquee_par = auth.uid(), motif_revocation = v_motif
   WHERE id = p_id;
  INSERT INTO public.journal_delegations (delegation_id, evenement, delegant, delegue, module, niveau, debut, fin, motif, auteur)
  VALUES (g.id, 'revocation', g.delegant, g.delegue, g.module, g.niveau, g.debut, g.fin, v_motif, auth.uid());
END;
$$;

-- Delegations visibles de l'appelant (parties ou administrateur), noms et
-- statut calcule : revoquee, expiree, a_venir, active, sans_effet (periode
-- en cours mais delegant sans le droit, delegue inactif ou restreint,
-- perimetre du delegue hors de celui du delegant). Meme regle que
-- delegation_en_vigueur (delegation_effective). `donne_lecture` : la
-- delegation donne aussi la lecture du module (le delegant la detient).
CREATE OR REPLACE FUNCTION public.mes_delegations()
RETURNS TABLE (id uuid, delegant uuid, delegant_nom text, delegue uuid, delegue_nom text, module text, niveau text,
               debut timestamptz, fin timestamptz, motif text, cree_le timestamptz, revoquee_le timestamptz,
               revoquee_par_nom text, motif_revocation text, statut text, donne_lecture boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT g.id, g.delegant, pa.full_name, g.delegue, pb.full_name, g.module, g.niveau, g.debut, g.fin, g.motif,
         g.cree_le, g.revoquee_le, pr.full_name, g.motif_revocation,
         CASE WHEN g.revoquee_le IS NOT NULL THEN 'revoquee'
              WHEN g.fin <= now() THEN 'expiree'
              WHEN g.debut > now() THEN 'a_venir'
              WHEN public.delegation_effective(g.delegant, g.delegue, g.module, g.niveau) THEN 'active'
              ELSE 'sans_effet' END,
         public.droit_module_base(g.delegant, g.module, 'lecture')
    FROM public.delegations_droits g
    LEFT JOIN public.profiles pa ON pa.id = g.delegant
    LEFT JOIN public.profiles pb ON pb.id = g.delegue
    LEFT JOIN public.profiles pr ON pr.id = g.revoquee_par
   WHERE EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.status = 'active')
     AND (g.delegant = auth.uid() OR g.delegue = auth.uid() OR public.is_admin())
   ORDER BY g.debut DESC;
$$;

-- Comptes actifs a qui l'appelant peut deleguer (nom et role seulement,
-- sans courriel) : ceux dont le perimetre est inclus dans le sien. Un compte
-- borne ne voit donc que les comptes de ses sites ; un compte sans droit
-- d'ecriture delegable ne voit personne (C4).
CREATE OR REPLACE FUNCTION public.comptes_delegables()
RETURNS TABLE (id uuid, full_name text, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.full_name, p.role::text
    FROM public.profiles p
   WHERE p.status = 'active' AND p.id <> auth.uid()
     AND EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.status = 'active')
     AND EXISTS (SELECT 1 FROM (SELECT DISTINCT rp.module FROM public.role_permissions rp) m
                  WHERE m.module <> 'settings' AND public.droit_module_base(auth.uid(), m.module, 'ecriture'))
     AND public.perimetre_inclus(p.id, auth.uid())
   ORDER BY p.full_name;
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['deleguer_droit(uuid, text, text, timestamptz, timestamptz, text)',
                           'revoquer_delegation(uuid, text)', 'mes_delegations()', 'comptes_delegables()'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- 3. Journal de connexion et sessions ---------------------------------------

-- Vue au proprietaire (lecture du schema auth), bornee a l'administrateur.
-- L'adresse IP passe par to_jsonb : la colonne ip_address est ajoutee par
-- les migrations GoTrue et peut manquer sur une base sans GoTrue.
DROP VIEW IF EXISTS public.v_journal_connexions;
CREATE VIEW public.v_journal_connexions WITH (security_barrier = true) AS
SELECT a.id,
       a.created_at AS survenu_le,
       CASE WHEN (a.payload ->> 'actor_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN (a.payload ->> 'actor_id')::uuid END AS utilisateur,
       nullif(a.payload ->> 'actor_username', '') AS compte,
       coalesce(p.full_name, nullif(a.payload ->> 'actor_name', '')) AS nom,
       a.payload ->> 'action' AS evenement,
       a.payload ->> 'log_type' AS categorie,
       a.payload -> 'traits' ->> 'provider' AS methode,
       nullif(to_jsonb(a) ->> 'ip_address', '') AS adresse_ip
  FROM auth.audit_log_entries a
  LEFT JOIN public.profiles p
    ON p.id::text = (a.payload ->> 'actor_id')
 WHERE public.is_admin();

REVOKE ALL ON public.v_journal_connexions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_journal_connexions TO authenticated, service_role;

-- Sessions GoTrue ouvertes (sans cle ni jeton). La table auth.sessions est
-- creee par GoTrue : sans elle (base de rejeu), aucune ligne.
CREATE OR REPLACE FUNCTION public.sessions_ouvertes()
RETURNS TABLE (id uuid, utilisateur uuid, nom text, compte text, ouverte_le timestamptz, renouvelee_le timestamptz,
               expire_le timestamptz, niveau text, navigateur text, adresse_ip text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Sessions : reserve a l''administrateur' USING ERRCODE = '42501';
  END IF;
  IF to_regclass('auth.sessions') IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY EXECUTE
    'SELECT s.id, s.user_id, p.full_name, u.email::text, s.created_at, coalesce(s.refreshed_at::timestamptz, s.updated_at),
            s.not_after, s.aal::text, s.user_agent, host(s.ip)
       FROM auth.sessions s
       LEFT JOIN public.profiles p ON p.id = s.user_id
       LEFT JOIN auth.users u ON u.id = s.user_id
      WHERE s.not_after IS NULL OR s.not_after > now()
      ORDER BY coalesce(s.refreshed_at::timestamptz, s.updated_at) DESC NULLS LAST';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sessions_ouvertes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sessions_ouvertes() TO authenticated, service_role;

-- 4. Referentiels devises et unites, sequences de numerotation --------------

CREATE TABLE IF NOT EXISTS public.devises (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z]{3}$'),
  libelle text,
  actif boolean NOT NULL DEFAULT true,
  modifie_par uuid REFERENCES auth.users(id),
  modifie_le timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.unites_mesure (
  code text PRIMARY KEY CHECK (code ~ '^[a-z0-9_%/]{1,20}$'),
  libelle text,
  actif boolean NOT NULL DEFAULT true,
  modifie_par uuid REFERENCES auth.users(id),
  modifie_le timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.devises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unites_mesure ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.devises, public.unites_mesure FROM anon, authenticated;
GRANT SELECT ON public.devises, public.unites_mesure TO authenticated;
GRANT ALL ON public.devises, public.unites_mesure TO service_role;
DROP POLICY IF EXISTS lecture ON public.devises;
CREATE POLICY lecture ON public.devises FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS lecture ON public.unites_mesure;
CREATE POLICY lecture ON public.unites_mesure FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- Reprise des codes reellement saisis (aucun libelle suppose) et de la
-- liste fermee des unites de tarif (contrat_tarifs, D-033).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES ('contrats'), ('factures'), ('factures_fournisseur'),
                                 ('paiements_fournisseur'), ('costs')) AS x(t) LOOP
    IF to_regclass('public.' || r.t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('INSERT INTO public.devises (code)
                    SELECT DISTINCT upper(btrim(devise)) FROM public.%I
                     WHERE upper(btrim(devise)) ~ ''^[A-Z]{3}$''
                    ON CONFLICT (code) DO NOTHING', r.t);
  END LOOP;
END $$;

INSERT INTO public.unites_mesure (code, libelle) VALUES
  ('tonne', 'Tonne'), ('heure', 'Heure'), ('km', 'Kilomètre'), ('jour', 'Jour'),
  ('mois', 'Mois'), ('forfait', 'Forfait'), ('autre', 'Autre')
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.enregistrer_devise(p_code text, p_libelle text, p_actif boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_code text := upper(btrim(coalesce(p_code, '')));
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Referentiel reserve a l''administrateur' USING ERRCODE = '42501';
  END IF;
  IF v_code !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Code devise ISO a trois lettres requis' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.devises (code, libelle, actif, modifie_par)
  VALUES (v_code, nullif(btrim(coalesce(p_libelle, '')), ''), coalesce(p_actif, true), auth.uid())
  ON CONFLICT (code) DO UPDATE
    SET libelle = EXCLUDED.libelle, actif = EXCLUDED.actif, modifie_par = EXCLUDED.modifie_par, modifie_le = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.enregistrer_unite(p_code text, p_libelle text, p_actif boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_code text := lower(btrim(coalesce(p_code, '')));
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Referentiel reserve a l''administrateur' USING ERRCODE = '42501';
  END IF;
  IF v_code !~ '^[a-z0-9_%/]{1,20}$' THEN
    RAISE EXCEPTION 'Code d''unite : 1 a 20 caracteres (minuscules, chiffres, _ %% /)' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.unites_mesure (code, libelle, actif, modifie_par)
  VALUES (v_code, nullif(btrim(coalesce(p_libelle, '')), ''), coalesce(p_actif, true), auth.uid())
  ON CONFLICT (code) DO UPDATE
    SET libelle = EXCLUDED.libelle, actif = EXCLUDED.actif, modifie_par = EXCLUDED.modifie_par, modifie_le = now();
END;
$$;

-- Codes saisis dans les donnees, confrontes au referentiel.
CREATE OR REPLACE FUNCTION public.codes_utilises()
RETURNS TABLE (type text, code text, source text, occurrences bigint, au_referentiel boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE r record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Referentiel reserve a l''administrateur' USING ERRCODE = '42501';
  END IF;
  FOR r IN SELECT * FROM (VALUES
    ('devise', 'contrats', 'devise'), ('devise', 'factures', 'devise'),
    ('devise', 'factures_fournisseur', 'devise'), ('devise', 'paiements_fournisseur', 'devise'),
    ('devise', 'costs', 'devise'),
    ('unite', 'contrat_tarifs', 'unite'), ('unite', 'contrat_engagements', 'unite'),
    ('unite', 'facture_lignes', 'unite'), ('unite', 'factures_fournisseur_lignes', 'unite_facturee')
  ) AS x(t, nom_table, colonne) LOOP
    IF to_regclass('public.' || r.nom_table) IS NULL THEN CONTINUE; END IF;
    RETURN QUERY EXECUTE format(
      'SELECT %L::text, x.%I::text, %L::text, count(*)::bigint,
              EXISTS (SELECT 1 FROM public.%I ref WHERE ref.code = x.%I::text)
         FROM public.%I x WHERE x.%I IS NOT NULL GROUP BY x.%I',
      r.t, r.colonne, r.nom_table || '.' || r.colonne,
      CASE r.t WHEN 'devise' THEN 'devises' ELSE 'unites_mesure' END, r.colonne,
      r.nom_table, r.colonne, r.colonne);
  END LOOP;
END;
$$;

-- Numerotations existantes (lecture) : format, compteur de la sequence et
-- dernier numero attribue reconnu par son format.
CREATE OR REPLACE FUNCTION public.sequences_numerotation()
RETURNS TABLE (code text, libelle text, modele text, source text, sequence_sql text, regle text,
               compteur bigint, numeros bigint, dernier_numero text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r record;
  v_compteur bigint;
  v_nombre bigint;
  v_dernier text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Sequences : reserve a l''administrateur' USING ERRCODE = '42501';
  END IF;
  FOR r IN SELECT * FROM (VALUES
    ('VYG', 'Voyages', 'VYG-AAMMJJ-NNN', 'trips', 'reference', NULL, 'suite par jour de planification', '^VYG-[0-9]{6}-[0-9]{3,}$'),
    ('FR', 'Fiches de rotations', 'FR-AAMMJJ-NNN', 'fiches_terrain', 'numero', NULL, 'suite par type et par jour', '^FR-[0-9]{6}-[0-9]{3,}$'),
    ('FP', 'Fiches de pointage des engins', 'FP-AAMMJJ-NNN', 'fiches_terrain', 'numero', NULL, 'suite par type et par jour', '^FP-[0-9]{6}-[0-9]{3,}$'),
    ('FC', 'Fiches carburant', 'FC-AAMMJJ-NNN', 'fiches_terrain', 'numero', NULL, 'suite par type et par jour', '^FC-[0-9]{6}-[0-9]{3,}$'),
    ('FAC', 'Factures clients', 'FAC-AAAA-NNNN', 'factures', 'numero', NULL, 'suite annuelle, attribuee a l''emission', '^FAC-[0-9]{4}-[0-9]{4,}$'),
    ('AV', 'Avoirs clients', 'AV-AAAA-NNNN', 'factures', 'numero', NULL, 'suite annuelle, attribuee a l''emission', '^AV-[0-9]{4}-[0-9]{4,}$'),
    ('BC', 'Bons de commande', 'BC-AAAA-NNNNN', 'purchase_orders', 'po_number', 'purchase_orders_numero_seq', 'sequence continue', '^BC-[0-9]{4}-[0-9]{5,}$'),
    ('REC', 'Receptions d''achat', 'REC-AAAA-NNNNN', 'deliveries', 'delivery_number', 'receptions_achat_numero_seq', 'sequence continue', '^REC-[0-9]{4}-[0-9]{5,}$'),
    ('MVT', 'Mouvements de stock', 'MVT-AAAA-NNNNNN', 'stock_movements', 'movement_number', 'stock_movements_numero_seq', 'sequence continue', '^MVT-[0-9]{4}-[0-9]{6,}$'),
    ('PAY', 'Bons a payer', 'PAY-AAAA-NNNNN', 'paiements_fournisseur', 'numero', 'paiements_fournisseur_numero_seq', 'sequence continue', '^PAY-[0-9]{4}-[0-9]{5,}$'),
    ('INC', 'Incidents HSE', 'INC-AAAA-NNNNN', 'incidents', 'numero', 'incidents_numero_seq', 'sequence continue', '^INC-[0-9]{4}-[0-9]{5,}$'),
    ('INT', 'Interventions du loueur', 'INT-AAAA-NNNNN', 'interventions_loueur', 'numero', 'interventions_loueur_numero_seq', 'sequence continue', '^INT-[0-9]{4}-[0-9]{5,}$'),
    ('OT', 'Ordres de travail', 'OT-AAAA-NNNNN', 'maintenance_orders', 'work_order_number', 'maintenance_orders_numero_seq', 'sequence continue', '^OT-[0-9]{4}-[0-9]{5,}$'),
    ('CONS', 'Consultations fournisseurs', 'CONS-AAAA-NNNNN', 'consultations_fournisseurs', 'numero', 'consultations_numero_seq', 'sequence continue', '^CONS-[0-9]{4}-[0-9]{5,}$'),
    ('FRS', 'Fournisseurs', 'FRS-NNNNN', 'suppliers', 'supplier_number', 'suppliers_numero_seq', 'sequence continue', '^FRS-[0-9]{5,}$'),
    ('PL', 'Pleins isoles', 'PL-AAAAMMJJ-NNNNN', 'fuel_transactions', 'reference', 'fuel_pleins_numero_seq', 'sequence continue', '^PL-[0-9]{8}-[0-9]{5,}$'),
    ('CST', 'Couts directs', 'CST-AAAA-NNNNN', 'costs', 'numero', 'costs_numero_seq', 'sequence continue', '^CST-[0-9]{4}-[0-9]{5,}$'),
    ('RAP', 'Rapports figes', 'RAP-AAAA-NNNNN', 'rapports_figes', 'numero', 'rapports_figes_numero_seq', 'sequence continue', '^RAP-[0-9]{4}-[0-9]{5,}$')
  ) AS x(code, libelle, modele, nom_table, colonne, nom_sequence, regle, motif) LOOP
    v_compteur := NULL; v_nombre := NULL; v_dernier := NULL;
    IF r.nom_sequence IS NOT NULL THEN
      SELECT s.last_value INTO v_compteur FROM pg_catalog.pg_sequences s
       WHERE s.schemaname = 'public' AND s.sequencename = r.nom_sequence;
    END IF;
    IF to_regclass('public.' || r.nom_table) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %I ~ %L', r.nom_table, r.colonne, r.motif)
        INTO v_nombre;
      EXECUTE format('SELECT %I FROM public.%I WHERE %I ~ %L ORDER BY length(%I) DESC, %I DESC LIMIT 1',
                     r.colonne, r.nom_table, r.colonne, r.motif, r.colonne, r.colonne)
        INTO v_dernier;
    END IF;
    code := r.code; libelle := r.libelle; modele := r.modele; source := r.nom_table || '.' || r.colonne;
    sequence_sql := r.nom_sequence; regle := r.regle; compteur := v_compteur; numeros := v_nombre;
    dernier_numero := v_dernier;
    RETURN NEXT;
  END LOOP;
END;
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['enregistrer_devise(text, text, boolean)', 'enregistrer_unite(text, text, boolean)',
                           'codes_utilises()', 'sequences_numerotation()'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- 5. Separation des taches et delegation d'ecriture (contre-revue R1) -------
--
-- Une delegation d'ecriture ne doit pas permettre au delegue de valider ce
-- que son delegant a lui-meme saisi ou clos (le delegant obtiendrait la
-- validation de son propre acte par personne interposee). Regle : un
-- controle de separation fonde sur l'ecriture refuse si l'auteur concerne
-- est l'appelant, ou s'il est le delegant d'une delegation d'ecriture en
-- periode vers l'appelant sur le module exerce, alors que l'appelant n'a pas
-- ce droit en propre (`droit_module_base`). Les separations fondees sur
-- l'approbation ne sont pas concernees : l'approbation ne se delegue pas.
-- Les fonctions ci-dessous sont reprises de leur DERNIERE definition sur
-- main, seul le controle de separation change.

-- Delegants des delegations d'ecriture en periode vers l'appelant, sur ce
-- module (revoquees exclues ; une delegation sans effet compte quand meme,
-- par prudence). Interne.
CREATE OR REPLACE FUNCTION public.delegants_ecriture(p_module text)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT g.delegant FROM public.delegations_droits g
   WHERE g.delegue = auth.uid() AND g.module = p_module AND g.niveau = 'ecriture'
     AND g.revoquee_le IS NULL AND g.debut <= now() AND now() < g.fin;
$$;

-- L'auteur est l'appelant, ou son delegant sur ce module sans droit propre
-- de l'appelant. Auteur inconnu (NULL) : false, comme l'egalite d'origine.
CREATE OR REPLACE FUNCTION public.auteur_ou_delegant(p_auteur uuid, p_module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_auteur IS NOT NULL
     AND (p_auteur = auth.uid()
          OR (p_auteur IN (SELECT public.delegants_ecriture(p_module))
              AND NOT public.droit_module_base(auth.uid(), p_module, 'ecriture')));
$$;

-- Les deux sens (contre-revue R1b) : refus aussi quand l'auteur de l'acte
-- etait, a la date de son acte, delegue de l'appelant (delegation d'ecriture
-- sur un module quelconque, en periode et non revoquee a cette date) sans
-- droit propre sur le module de l'acte : le delegant validerait alors l'acte
-- fait sous son autorite. Date de l'acte inconnue (NULL) : toute delegation
-- de l'appelant vers l'auteur compte, par prudence.
CREATE OR REPLACE FUNCTION public.separation_violee(p_auteur uuid, p_module_appelant text, p_module_acte text,
                                                    p_acte_le timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.auteur_ou_delegant(p_auteur, p_module_appelant)
      OR (p_auteur IS NOT NULL AND p_auteur <> auth.uid()
          AND EXISTS (SELECT 1 FROM public.delegations_droits g
                       WHERE g.delegant = auth.uid() AND g.delegue = p_auteur AND g.niveau = 'ecriture'
                         AND (p_acte_le IS NULL
                              OR (g.debut <= p_acte_le AND p_acte_le < g.fin
                                  AND (g.revoquee_le IS NULL OR g.revoquee_le > p_acte_le))))
          AND NOT public.droit_module_base(p_auteur, p_module_acte, 'ecriture'));
$$;

REVOKE EXECUTE ON FUNCTION public.separation_violee(uuid, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.separation_violee(uuid, text, text, timestamptz) TO service_role;
REVOKE EXECUTE ON FUNCTION public.delegants_ecriture(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auteur_ou_delegant(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delegants_ecriture(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.auteur_ou_delegant(uuid, text) TO service_role;

-- valider_cloture_poste : reprise de D-048 (20261116090000), controle de separation etendu aux delegants.
CREATE OR REPLACE FUNCTION public.valider_cloture_poste(p_poste_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.postes := public.poste_ecrivable(p_poste_id, 'planning', 'cloture');
BEGIN
  IF public.separation_violee(p.cloture_par, 'planning', 'trips', p.cloture_le) THEN
    RAISE EXCEPTION 'La validation revient a une autre personne que celle qui a clos le poste' USING ERRCODE = '42501';
  END IF;
  UPDATE public.postes SET statut = 'valide', valide_par = auth.uid(), valide_le = now() WHERE id = p.id;
END;
$$;

-- cloturer_planification : reprise de D-063 (20261121090000), controle de separation etendu aux delegants.
CREATE OR REPLACE FUNCTION public.cloturer_planification(
  p_date date,
  p_site_id uuid,
  p_causes jsonb DEFAULT '[]'::jsonb,
  p_commentaire text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_fin timestamptz;
  v_separee boolean;
  p record;
  v_bilan jsonb;
  v_id uuid;
  l jsonb;
  v_obj uuid;
  v_causes jsonb := coalesce(p_causes, '[]'::jsonb);
BEGIN
  IF NOT public.has_module_write('planning') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la planification requis' USING ERRCODE = '42501';
  END IF;
  IF p_date IS NULL OR p_site_id IS NULL THEN
    RAISE EXCEPTION 'Date et site requis' USING ERRCODE = '22023';
  END IF;
  IF NOT public.site_permis(p_site_id) THEN
    RAISE EXCEPTION 'Hors perimetre : site non autorise' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(v_causes) <> 'array' THEN
    RAISE EXCEPTION 'Causes : liste attendue' USING ERRCODE = '22023';
  END IF;
  SELECT f.fin INTO v_fin FROM public.fenetre_planification(p_date, NULL) f;
  IF v_fin > now() THEN
    RAISE EXCEPTION 'La journee n''est pas terminee (fin %)', to_char(v_fin AT TIME ZONE 'Africa/Conakry', 'DD/MM/YYYY HH24:MI')
      USING ERRCODE = '22023';
  END IF;

  -- Verrou de la journee et du site, pris aussi par ventiler_objectif et par
  -- la garde de objectifs_production (creation, revision, annulation) : ces
  -- ecritures et la cloture sont serialisees, sans verrou de ligne (pas
  -- d'interblocage avec definir_objectif).
  PERFORM pg_advisory_xact_lock(hashtext('cloture_planification|' || p_date::text || '|' || p_site_id::text));
  IF EXISTS (SELECT 1 FROM public.clotures_planification c
              WHERE c.date_plan = p_date AND c.site_id = p_site_id AND c.statut = 'close') THEN
    RAISE EXCEPTION 'Planification deja close pour ce site et cette date' USING ERRCODE = '22023';
  END IF;

  -- Separation : toutes les versions de la journee comptent, quel que soit
  -- leur statut (auteur d'une version, auteur d'une revision ou d'une
  -- annulation) ; une annulation ou une revision ne la contourne pas.
  SELECT coalesce((SELECT (s.value ->> 'value') = 'true' FROM public.settings s WHERE s.key = 'planification_cloture_separee'), false)
    INTO v_separee;
  IF v_separee AND EXISTS (SELECT 1 FROM public.objectifs_production o
                            WHERE o.date_plan = p_date AND o.site_id = p_site_id
                              AND (public.separation_violee(o.cree_par, 'planning', 'planning', o.cree_le)
                                   OR public.separation_violee(o.clos_par, 'planning', 'planning', o.clos_le))) THEN
    RAISE EXCEPTION 'La cloture revient a une autre personne que les auteurs des objectifs de la journee (reglage planification_cloture_separee)'
      USING ERRCODE = '42501';
  END IF;

  -- Cause d'ecart exigee : realise sous l'objectif en vigueur, objectif de
  -- la journee annule, ou version remplacee dont la cible depasse le realise
  -- de son perimetre (une revision a la baisse ne dispense pas de cause).
  SELECT * INTO p FROM public.production_journee(p_date, p_site_id);
  IF jsonb_array_length(v_causes) = 0 THEN
    IF p.tonnes_cible IS NOT NULL AND p.tonnes_livrees < p.tonnes_cible THEN
      RAISE EXCEPTION 'Realise sous l''objectif (% t sur % t) : au moins une cause d''ecart requise', p.tonnes_livrees, p.tonnes_cible
        USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM public.objectifs_production o
                WHERE o.date_plan = p_date AND o.site_id = p_site_id AND o.statut = 'annule') THEN
      RAISE EXCEPTION 'Objectif de la journee annule : au moins une cause d''ecart requise' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM public.objectifs_production o
                WHERE o.date_plan = p_date AND o.site_id = p_site_id AND o.statut = 'remplace'
                  AND o.tonnes_cible > (
                    SELECT coalesce(sum(coalesce(t.accepted_tonnage, t.net_weight_reception, t.net_weight, t.load_weight)), 0)
                      FROM public.trips t
                     WHERE t.planned_date = p_date AND t.departure_site_id = p_site_id
                       AND (o.shift_id IS NULL OR t.shift_id = o.shift_id)
                       AND t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED'))) THEN
      RAISE EXCEPTION 'Objectif revise sous une cible non atteinte : au moins une cause d''ecart requise' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'perimetre', p.perimetre,
    'tonnes_cible', p.tonnes_cible,
    'tonnes_livrees', p.tonnes_livrees,
    'ecart', p.tonnes_livrees - p.tonnes_cible,
    'voyages_livres', p.voyages_livres,
    'voyages_sans_poids', p.voyages_sans_poids,
    'tonnes_livrees_site', p.tonnes_livrees_site,
    'voyages_non_termines', p.voyages_non_termines,
    'objectifs', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'shift_id', r.shift_id, 'version', r.version, 'tonnes_cible', r.tonnes_cible,
        'tonnes_cible_initial', r.tonnes_cible_initial, 'tonnes_livrees', r.tonnes_livrees,
        'tonnes_acceptees', r.tonnes_acceptees, 'voyages_cible', r.voyages_cible, 'voyages_livres', r.voyages_livres,
        'voyages_sans_poids', r.voyages_sans_poids, 'motif', r.motif) ORDER BY r.shift_id NULLS FIRST)
      FROM public.v_realisation_objectifs r WHERE r.date_plan = p_date AND r.site_id = p_site_id), '[]'::jsonb),
    'ventilation', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'objectif_id', w.objectif_id, 'destination_id', w.destination_id, 'contrat_id', w.contrat_id,
        'contrat_reference', w.contrat_reference, 'tonnes_cible', w.tonnes_cible, 'tonnes_livrees', w.tonnes_livrees,
        'voyages_livres', w.voyages_livres, 'mesurable', w.mesurable, 'realise_partage', w.realise_partage))
      FROM public.v_realisation_ventilation w WHERE w.date_plan = p_date AND w.site_id = p_site_id), '[]'::jsonb),
    'postes', coalesce((SELECT jsonb_agg(jsonb_build_object('id', x.id, 'shift_id', x.shift_id, 'statut', x.statut))
      FROM public.postes x WHERE x.date_poste = p_date AND x.site_id = p_site_id), '[]'::jsonb),
    'fige_le', now())
  INTO v_bilan;

  INSERT INTO public.clotures_planification (date_plan, site_id, tonnes_cible, tonnes_livrees, ecart, bilan, commentaire, cloture_par)
  VALUES (p_date, p_site_id, p.tonnes_cible, p.tonnes_livrees, p.tonnes_livrees - p.tonnes_cible, v_bilan,
          nullif(btrim(coalesce(p_commentaire, '')), ''), auth.uid())
  RETURNING id INTO v_id;

  FOR l IN SELECT * FROM jsonb_array_elements(v_causes) LOOP
    v_obj := nullif(l ->> 'objectif_id', '')::uuid;
    IF v_obj IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.objectifs_production o
                                          WHERE o.id = v_obj AND o.date_plan = p_date AND o.site_id = p_site_id) THEN
      RAISE EXCEPTION 'Cause rattachee a un objectif d''une autre journee ou d''un autre site' USING ERRCODE = '22023';
    END IF;
    IF nullif(btrim(coalesce(l ->> 'description', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Cause : description requise' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.clotures_planification_causes (cloture_id, objectif_id, categorie, description, tonnes_impact, saisi_par)
    VALUES (v_id, v_obj, l ->> 'categorie', btrim(l ->> 'description'), nullif(l ->> 'tonnes', '')::numeric, auth.uid());
  END LOOP;
  RETURN v_id;
END;
$$;

-- valider_distance_voyage : reprise de D-043 (20261115150000), controle de separation etendu aux delegants.
CREATE OR REPLACE FUNCTION public.valider_distance_voyage(
  p_trip_id uuid, p_charge_km numeric, p_retour_km numeric DEFAULT NULL,
  p_declaree_km numeric DEFAULT NULL, p_motif text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE t public.trips; m record; v_motif text := nullif(btrim(coalesce(p_motif, '')), ''); v_version integer;
        v_separee boolean;
BEGIN
  IF NOT public.has_module_write('contracts') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les contrats requis pour valider une distance' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO t FROM public.trips WHERE id = p_trip_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Voyage introuvable' USING ERRCODE = '22023'; END IF;
  IF NOT (public.site_permis(t.departure_site_id) OR public.site_permis(t.arrival_site_id)) THEN
    RAISE EXCEPTION 'Hors perimetre : voyage d''un autre site' USING ERRCODE = '42501';
  END IF;
  IF t.etat NOT IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED') THEN
    RAISE EXCEPTION 'Seul un voyage livre recoit une distance validee' USING ERRCODE = '22023';
  END IF;
  IF p_charge_km IS NULL OR p_charge_km < 0 OR (p_retour_km IS NOT NULL AND p_retour_km < 0) THEN
    RAISE EXCEPTION 'Distances positives requises' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce((SELECT (s.value ->> 'value') <> 'false' FROM public.settings s
                    WHERE s.key = 'kilometrage_validation_separee'), true) INTO v_separee;
  IF v_separee AND EXISTS (SELECT 1 FROM public.v_releves_compteur r WHERE r.trip_id = p_trip_id
                                                                 AND public.separation_violee(r.saisi_par, 'contracts', 'trips', r.saisi_le)) THEN
    RAISE EXCEPTION 'La validation revient a une autre personne que l''auteur des releves' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO m FROM public.mesures_voyage(p_trip_id);
  IF (m.mesure_charge_km IS DISTINCT FROM p_charge_km
      OR (p_retour_km IS NOT NULL AND m.mesure_retour_km IS DISTINCT FROM p_retour_km))
     AND v_motif IS NULL THEN
    RAISE EXCEPTION 'Distance differente de la mesure ou mesure absente : motif requis' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(max(version), 0) + 1 INTO v_version FROM public.distances_voyage WHERE trip_id = p_trip_id;
  INSERT INTO public.distances_voyage (trip_id, version, distance_reference_km, distance_declaree_km, mesure_charge_km,
    mesure_retour_km, validee_charge_km, validee_retour_km, motif, valide_par)
  VALUES (p_trip_id, v_version, m.distance_reference_km, p_declaree_km, m.mesure_charge_km, m.mesure_retour_km,
          p_charge_km, p_retour_km, v_motif, auth.uid());
  RETURN v_version;
END;
$$;

-- decider_inventaire_carburant : reprise de D-041 (20261115090000), controle de separation etendu aux delegants.
CREATE OR REPLACE FUNCTION public.decider_inventaire_carburant(p_id uuid, p_valider boolean, p_motif text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE i public.inventaires_carburant; s public.stockages_carburant;
        v_motif text := nullif(btrim(coalesce(p_motif, '')), ''); v_actuel numeric;
BEGIN
  SELECT * INTO i FROM public.inventaires_carburant WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR i.statut <> 'a_valider' THEN
    RAISE EXCEPTION 'Inventaire introuvable ou deja decide' USING ERRCODE = '22023';
  END IF;
  s := public.stockage_ecrivable(i.stockage_id);
  IF public.validation_carburant_separee() AND public.separation_violee(i.cree_par, 'fuel', 'fuel', i.cree_le) THEN
    RAISE EXCEPTION 'La decision revient a une autre personne que l''auteur de la saisie' USING ERRCODE = '42501';
  END IF;
  IF NOT coalesce(p_valider, false) THEN
    IF v_motif IS NULL THEN
      RAISE EXCEPTION 'Motif de rejet requis' USING ERRCODE = '22023';
    END IF;
    UPDATE public.inventaires_carburant SET statut = 'rejete', motif_decision = v_motif,
      decide_par = auth.uid(), decide_le = now() WHERE id = p_id;
    RETURN 'rejete';
  END IF;
  v_actuel := public.solde_stockage_carburant(s.id);
  IF v_actuel IS DISTINCT FROM i.solde_theorique THEN
    RAISE EXCEPTION 'Le solde a change depuis la mesure : saisissez un nouvel inventaire' USING ERRCODE = '22023';
  END IF;
  -- Ajustement egal a l'ecart. Un premier inventaire ouvre le stock ; a zero
  -- il ne cree aucun mouvement (variation non nulle exigee).
  IF i.ecart <> 0 THEN
    INSERT INTO public.mouvements_carburant (stockage_id, type, variation, date_mouvement, reference_piece,
      inventaire_id, statut, note, saisi_par, decide_par, decide_le)
    VALUES (s.id, 'ajustement_inventaire', i.ecart, i.date_mesure, 'INV-' || left(i.id::text, 8), i.id, 'valide',
            coalesce(v_motif, i.note), i.cree_par, auth.uid(), now());
  END IF;
  UPDATE public.inventaires_carburant SET statut = 'valide', motif_decision = v_motif,
    decide_par = auth.uid(), decide_le = now() WHERE id = p_id;
  RETURN 'valide';
END;
$$;

-- decider_mouvement_carburant : reprise de D-041 (20261115090000), controle de separation etendu aux delegants.
CREATE OR REPLACE FUNCTION public.decider_mouvement_carburant(p_id uuid, p_valider boolean, p_motif text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE m public.mouvements_carburant; v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
        v_ids uuid[]; v_id uuid; n integer;
BEGIN
  SELECT * INTO m FROM public.mouvements_carburant WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR m.statut <> 'a_valider' THEN
    RAISE EXCEPTION 'Mouvement introuvable ou deja decide' USING ERRCODE = '22023';
  END IF;
  IF m.type = 'ajustement_inventaire' THEN
    RAISE EXCEPTION 'Un ajustement se decide par l''inventaire' USING ERRCODE = '22023';
  END IF;
  -- Un transfert se decide en bloc (sortie et entree).
  IF m.transfert_id IS NOT NULL THEN
    SELECT array_agg(id) INTO v_ids FROM public.mouvements_carburant
     WHERE transfert_id = m.transfert_id AND statut = 'a_valider';
  ELSE
    v_ids := ARRAY[m.id];
  END IF;
  FOREACH v_id IN ARRAY v_ids LOOP
    SELECT * INTO m FROM public.mouvements_carburant WHERE id = v_id FOR UPDATE;
    PERFORM public.stockage_ecrivable(m.stockage_id);
    IF public.validation_carburant_separee() AND public.separation_violee(m.saisi_par, 'fuel', 'fuel', m.saisi_le) THEN
      RAISE EXCEPTION 'La decision revient a une autre personne que l''auteur de la saisie' USING ERRCODE = '42501';
    END IF;
  END LOOP;
  IF NOT coalesce(p_valider, false) AND v_motif IS NULL THEN
    RAISE EXCEPTION 'Motif de rejet requis' USING ERRCODE = '22023';
  END IF;
  -- Valider exige un stock ouvert par un inventaire : sinon le solde
  -- ignorerait le contenu initial du stockage.
  IF coalesce(p_valider, false) AND EXISTS (
       SELECT 1 FROM public.mouvements_carburant x WHERE x.id = ANY(v_ids)
          AND public.solde_stockage_carburant(x.stockage_id) IS NULL) THEN
    RAISE EXCEPTION 'Stockage non ouvert : validez d''abord un inventaire initial' USING ERRCODE = '22023';
  END IF;
  UPDATE public.mouvements_carburant
     SET statut = CASE WHEN coalesce(p_valider, false) THEN 'valide' ELSE 'rejete' END,
         motif_decision = v_motif, decide_par = auth.uid(), decide_le = now()
   WHERE id = ANY(v_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- valider_remise_en_service : reprise de D-072 (20261120101000), controle de separation etendu aux delegants.
CREATE OR REPLACE FUNCTION public.valider_remise_en_service(p_id uuid, p_valider boolean, p_motif text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE i public.interventions_loueur := public.intervention_ecrivable(p_id, 'terminee');
        v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
BEGIN
  IF public.separation_violee(i.fin_saisie_par, 'maintenance', 'maintenance', NULL) THEN
    RAISE EXCEPTION 'La remise en service est validee par une autre personne que celle qui a saisi la fin' USING ERRCODE = '42501';
  END IF;
  IF NOT coalesce(p_valider, false) THEN
    IF v_motif IS NULL THEN RAISE EXCEPTION 'Motif du refus requis' USING ERRCODE = '22023'; END IF;
    UPDATE public.interventions_loueur SET statut = 'prise_en_charge', fin_le = NULL, fin_saisie_par = NULL WHERE id = p_id;
    PERFORM public.journaliser_intervention(p_id, 'remise_refusee', 'terminee', 'prise_en_charge', v_motif);
    RETURN 'prise_en_charge';
  END IF;
  PERFORM set_config('sigtb.remise_en_service', i.immobilisation_id::text, true);
  PERFORM public.cloturer_immobilisation(i.immobilisation_id, i.fin_le,
    concat_ws(' : ', 'Remise en service validee, intervention ' || i.numero, v_motif));
  PERFORM set_config('sigtb.remise_en_service', '', true);
  UPDATE public.interventions_loueur SET statut = 'remise_validee', remise_validee_le = now(), valide_par = auth.uid() WHERE id = p_id;
  PERFORM public.journaliser_intervention(p_id, 'remise_validee', 'terminee', 'remise_validee', v_motif);
  RETURN 'remise_validee';
END;
$$;

-- rectifier_ticket_pesee_cbg : reprise de D-037 (20261113100000), controle de separation etendu aux delegants.
CREATE OR REPLACE FUNCTION public.rectifier_ticket_pesee_cbg(
  p_trip_id uuid, p_ticket text, p_brut numeric, p_tare numeric,
  p_document_ref text, p_motif text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  t public.tickets_pesee_cbg;
  e public.v_tickets_pesee_cbg_effectifs;
  v_id uuid;
BEGIN
  IF NOT (public.has_module_write('trips') AND public.has_module_write('invoices')) THEN
    RAISE EXCEPTION 'Droits voyages et facturation requis pour rectifier une pesee' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motif de rectification obligatoire' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce(p_ticket, '')), '') IS NULL OR p_brut IS NULL OR p_tare IS NULL
     OR p_brut <= p_tare OR p_tare < 0 THEN
    RAISE EXCEPTION 'Ticket, poids brut et tare coherents requis' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO t FROM public.tickets_pesee_cbg WHERE trip_id = p_trip_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket CBG introuvable pour ce voyage' USING ERRCODE = 'P0002'; END IF;
  IF EXISTS (SELECT 1 FROM public.reconciliations r JOIN public.reconciliation_lignes l ON l.reconciliation_id = r.id
    WHERE l.trip_id = p_trip_id AND r.statut = 'cloturee') THEN
    RAISE EXCEPTION 'Reconciliation cloturee : utiliser le circuit d''avoir, pas une rectification retroactive' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO e FROM public.v_tickets_pesee_cbg_effectifs WHERE id = t.id;
  IF e.saisi_par IS NULL OR public.separation_violee(e.saisi_par, 'trips', 'trips', e.cree_le)
     OR public.separation_violee(e.saisi_par, 'invoices', 'trips', e.cree_le) THEN
    RAISE EXCEPTION 'La rectification doit etre saisie par une autre personne que l''auteur du ticket' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(upper(btrim(p_ticket)), 0));
  IF EXISTS (
    SELECT 1 FROM public.v_tickets_pesee_cbg_effectifs x
    WHERE upper(btrim(x.ticket)) = upper(btrim(p_ticket)) AND x.trip_id <> p_trip_id
  ) THEN RAISE EXCEPTION 'Ticket deja rattache a un autre voyage' USING ERRCODE = '23505'; END IF;
  INSERT INTO public.rectifications_tickets_pesee_cbg
    (ticket_id, ancien_ticket, ancien_brut, ancienne_tare, ancien_net, ancien_document_ref,
     nouveau_ticket, nouveau_brut, nouvelle_tare, nouveau_document_ref, motif, corrige_par)
  VALUES (t.id, e.ticket, e.brut, e.tare, e.net, e.document_ref,
    btrim(p_ticket), p_brut, p_tare, nullif(btrim(coalesce(p_document_ref, '')), ''), btrim(p_motif), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- avancer_facture : reprise de D-029 (20261111120000), seule definition ;
-- le signataire n'est ni le preparateur ni le delegant d'un preparateur
-- delegue a la date de la preparation (contre-revue R1b).
CREATE OR REPLACE FUNCTION public.avancer_facture(p_id uuid, p_action text, p_motif text DEFAULT NULL, p_date date DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f public.factures;
  v_role text;
  v_prefixe text;
  v_suite integer;
  v_date date := coalesce(p_date, current_date);
BEGIN
  SELECT * INTO f FROM public.factures WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facture introuvable' USING ERRCODE = 'P0002';
  END IF;
  SELECT pr.role::text INTO v_role FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.status = 'active';

  IF p_action = 'signer' THEN
    IF v_role IS DISTINCT FROM 'director' THEN
      RAISE EXCEPTION 'Seul le Directeur General signe les factures' USING ERRCODE = '42501';
    END IF;
    IF public.separation_violee(f.prepare_par, 'invoices', 'invoices', f.prepare_le) THEN
      RAISE EXCEPTION 'Le signataire ne peut pas etre le preparateur de la facture' USING ERRCODE = '42501';
    END IF;
    IF f.statut <> 'a_signer' THEN
      RAISE EXCEPTION 'Facture non soumise a signature (%)', f.statut USING ERRCODE = '22023';
    END IF;
    UPDATE public.factures SET statut = 'signee', signee_par = auth.uid(), signee_le = now() WHERE id = p_id;
  ELSIF p_action = 'renvoyer' THEN
    IF v_role IS DISTINCT FROM 'director' THEN
      RAISE EXCEPTION 'Seul le Directeur General renvoie une facture' USING ERRCODE = '42501';
    END IF;
    IF f.statut <> 'a_signer' OR nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Renvoi d''une facture a signer, motif obligatoire' USING ERRCODE = '22023';
    END IF;
    UPDATE public.factures SET statut = 'brouillon', soumise_le = NULL WHERE id = p_id;
  ELSE
    IF NOT public.has_module_write('invoices') THEN
      RAISE EXCEPTION 'Droit d''ecriture sur la facturation requis' USING ERRCODE = '42501';
    END IF;
    IF p_action = 'soumettre' AND f.statut = 'brouillon' THEN
      IF NOT EXISTS (SELECT 1 FROM public.facture_lignes WHERE facture_id = p_id) THEN
        RAISE EXCEPTION 'Facture sans ligne' USING ERRCODE = '22023';
      END IF;
      UPDATE public.factures SET statut = 'a_signer', soumise_le = now() WHERE id = p_id;
    ELSIF p_action = 'emettre' AND f.statut = 'signee' THEN
      IF v_date > current_date THEN
        RAISE EXCEPTION 'Date d''emission dans le futur' USING ERRCODE = '22023';
      END IF;
      v_prefixe := CASE f.type WHEN 'avoir' THEN 'AV-' ELSE 'FAC-' END || to_char(v_date, 'YYYY') || '-';
      PERFORM pg_advisory_xact_lock(hashtext('sigtb.facture.' || v_prefixe));
      SELECT coalesce(max(substring(numero FROM '-(\d+)$')::int), 0) + 1 INTO v_suite
        FROM public.factures WHERE numero LIKE v_prefixe || '%';
      UPDATE public.factures SET statut = 'emise', emise_par = auth.uid(), emise_le = now(),
        numero = v_prefixe || lpad(v_suite::text, 4, '0'), date_emission = v_date,
        date_echeance = CASE WHEN delai_paiement_jours IS NOT NULL THEN v_date + delai_paiement_jours END
      WHERE id = p_id;
    ELSIF p_action = 'annuler' AND f.statut IN ('brouillon', 'a_signer') THEN
      IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
        RAISE EXCEPTION 'Motif obligatoire pour annuler' USING ERRCODE = '22023';
      END IF;
      UPDATE public.factures SET statut = 'annulee', motif = btrim(p_motif) WHERE id = p_id;
    ELSE
      RAISE EXCEPTION 'Action % impossible sur une facture %', p_action, f.statut USING ERRCODE = '22023';
    END IF;
  END IF;
  PERFORM public.journaliser_facture(p_id, p_action, nullif(btrim(coalesce(p_motif, '')), ''));
  RETURN (SELECT statut FROM public.factures WHERE id = p_id);
END;
$$;
