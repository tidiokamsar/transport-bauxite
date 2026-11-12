/*
  # Droits d'acces aux modules par utilisateur (D-036)

  Au-dessus de la matrice role x module (D-012, appliquee par
  has_module_view / has_module_write depuis la migration 20261110090000),
  l'administrateur attribue ou retire, utilisateur par utilisateur, l'acces
  a un module :

  - `droits_utilisateur` : une ligne (utilisateur, module) = un attribution
    specifique qui PRIME sur la matrice du role, dans les deux sens
    (attribution : le compte gagne un acces que son role n'a pas ; retrait :
    le compte perd un acces que son role a). Niveaux : lecture, ecriture ;
    'aucun' retire tout acces. Sans ligne, les droits du role s'appliquent.
  - `journal_droits_modules` : chaque attribution, retrait ou retour au
    reglage du role est journalise (niveau avant, niveau apres, auteur,
    motif facultatif ; CDC 31). Historique conserve meme si le compte
    disparait (sans cle etrangere).
  - `definir_droit_module` : seule porte d'ecriture, SECURITY DEFINER,
    administrateur seulement, module et niveaux valides, 'defaut' supprime
    l'attribution specifique.
  - `has_module_view` et `has_module_write` lisent l'attribution specifique
    avant la matrice du role ; le compte actif reste exige dans tous les cas.
    Les policies existantes (`lecture_module`, `ecriture_module`) appellent
    ces fonctions : l'effet est immediat, sans nouvelle politique.
  - `v_droits_modules` (security_invoker) : pour l'ecran Parametres ->
    Utilisateurs, niveau du role, attribution specifique et niveau effectif,
    pour chaque compte actif et chaque module de la matrice.

  La vue d'administration reste `is_admin()` ; un utilisateur lit ses
  propres attributions (le menu les applique cote client). Idempotent :
  IF NOT EXISTS, CREATE OR REPLACE, DROP POLICY IF EXISTS.
*/

CREATE TABLE IF NOT EXISTS public.droits_utilisateur (
  utilisateur uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module text NOT NULL,
  niveau text NOT NULL CHECK (niveau IN ('lecture', 'ecriture', 'aucun')),
  modifie_par uuid REFERENCES public.profiles(id),
  modifie_le timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT droits_utilisateur_pkey PRIMARY KEY (utilisateur, module)
);

CREATE TABLE IF NOT EXISTS public.journal_droits_modules (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  utilisateur uuid NOT NULL,
  module text NOT NULL,
  niveau_avant text,
  niveau_apres text,
  motif text,
  auteur uuid NOT NULL,
  cree_le timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_droits_modules_utilisateur
  ON public.journal_droits_modules (utilisateur, cree_le);

-- Lecture et ecriture des droits : fonctions serveur seulement (RLS sans
-- politique d'ecriture ; l'administrateur passe par definir_droit_module).
ALTER TABLE public.droits_utilisateur ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.droits_utilisateur TO authenticated;
DROP POLICY IF EXISTS lecture_self_ou_admin ON public.droits_utilisateur;
CREATE POLICY lecture_self_ou_admin ON public.droits_utilisateur
  FOR SELECT TO authenticated
  USING (utilisateur = auth.uid() OR public.is_admin());

ALTER TABLE public.journal_droits_modules ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.journal_droits_modules TO authenticated;
DROP POLICY IF EXISTS lecture_admin ON public.journal_droits_modules;
CREATE POLICY lecture_admin ON public.journal_droits_modules
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Fonctions de droits : l'attribution specifique prime sur la matrice du
-- role ; le compte actif reste exige (D-021).
CREATE OR REPLACE FUNCTION public.has_module_view(p_module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.profiles pr
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
    );
$$;

CREATE OR REPLACE FUNCTION public.has_module_write(p_module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.profiles pr
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
    );
$$;

REVOKE EXECUTE ON FUNCTION public.has_module_view(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_module_view(text) TO authenticated, service_role;

-- Seule porte d'ecriture des droits (administrateur, journalisee).
CREATE OR REPLACE FUNCTION public.definir_droit_module(
  p_utilisateur uuid,
  p_module text,
  p_niveau text,
  p_motif text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_avant text;
  v_admin uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Attribution des droits reservee a l''administrateur'
      USING ERRCODE = '42501';
  END IF;

  IF p_niveau IS NULL OR p_niveau NOT IN ('aucun', 'lecture', 'ecriture', 'defaut') THEN
    RAISE EXCEPTION 'Niveau inconnu : % (aucun, lecture, ecriture ou defaut)', p_niveau
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.role_permissions rp WHERE rp.module = p_module) THEN
    RAISE EXCEPTION 'Module inconnu : %', p_module USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_utilisateur) THEN
    RAISE EXCEPTION 'Utilisateur inconnu' USING ERRCODE = '23503';
  END IF;

  SELECT d.niveau INTO v_avant
    FROM public.droits_utilisateur d
   WHERE d.utilisateur = p_utilisateur AND d.module = p_module;

  SELECT id INTO v_admin FROM public.profiles WHERE id = auth.uid();

  IF p_niveau = 'defaut' THEN
    IF v_avant IS NULL THEN
      RETURN; -- rien a retirer, rien a journaliser
    END IF;
    DELETE FROM public.droits_utilisateur
     WHERE utilisateur = p_utilisateur AND module = p_module;
    INSERT INTO public.journal_droits_modules
      (utilisateur, module, niveau_avant, niveau_apres, motif, auteur)
    VALUES (p_utilisateur, p_module, v_avant, NULL, p_motif, v_admin);
    RETURN;
  END IF;

  IF v_avant IS NOT DISTINCT FROM p_niveau THEN
    RETURN; -- deja en place
  END IF;

  INSERT INTO public.droits_utilisateur (utilisateur, module, niveau, modifie_par)
  VALUES (p_utilisateur, p_module, p_niveau, v_admin)
  ON CONFLICT (utilisateur, module) DO UPDATE
    SET niveau = EXCLUDED.niveau, modifie_par = EXCLUDED.modifie_par, modifie_le = now();

  INSERT INTO public.journal_droits_modules
    (utilisateur, module, niveau_avant, niveau_apres, motif, auteur)
  VALUES (p_utilisateur, p_module, v_avant, p_niveau, p_motif, v_admin);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.definir_droit_module(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_droit_module(uuid, text, text, text) TO authenticated, service_role;

-- Vue pour l'ecran d'administration : niveau du role, attribution
-- specifique, niveau effectif, par compte actif et module de la matrice.
DROP VIEW IF EXISTS public.v_droits_modules;
CREATE VIEW public.v_droits_modules
WITH (security_invoker = on) AS
SELECT base.utilisateur,
       base.full_name,
       base.role,
       base.module,
       base.role_lecture,
       base.role_ecriture,
       base.niveau_attribue,
       CASE
         WHEN base.niveau_attribue IS NOT NULL THEN base.niveau_attribue
         WHEN base.role_ecriture THEN 'ecriture'
         WHEN base.role_lecture THEN 'lecture'
         ELSE 'aucun'
       END AS niveau_effectif
FROM (
  SELECT p.id AS utilisateur,
         p.full_name,
         p.role::text AS role,
         m.module,
         EXISTS (SELECT 1 FROM public.role_permissions rp
                  WHERE rp.role::text = p.role::text
                    AND rp.module = m.module
                    AND rp.can_view) AS role_lecture,
         EXISTS (SELECT 1 FROM public.role_permissions rp
                  WHERE rp.role::text = p.role::text
                    AND rp.module = m.module
                    AND (rp.can_create OR rp.can_edit)) AS role_ecriture,
         d.niveau AS niveau_attribue
    FROM public.profiles p
   CROSS JOIN (SELECT DISTINCT module FROM public.role_permissions) m
    LEFT JOIN public.droits_utilisateur d
           ON d.utilisateur = p.id AND d.module = m.module
   WHERE p.status = 'active'
) base;

GRANT SELECT ON public.v_droits_modules TO authenticated;
