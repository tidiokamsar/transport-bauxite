/*
  # Mode demonstration (D-020)

  Le proprietaire a choisi le 2026-11-09 de charger des donnees de
  demonstration dans la base de production, etiquetees et purgeables.
  Cette table signale leur presence : l'interface affiche un bandeau
  « DONNEES DE DEMONSTRATION » tant que `active` est vrai.

  Les donnees elles-memes ne sont pas dans les migrations : elles sont
  chargees et purgees par deploy/vps/demo/ (identifiants prefixes
  `dec0de00-`).

  RLS : lecture par tout utilisateur connecte (le bandeau doit etre vu de
  tous), ecriture par un administrateur actif seulement. Idempotent.
*/

CREATE TABLE IF NOT EXISTS public.sigtb_demonstration (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  active boolean NOT NULL DEFAULT false,
  chargee_le timestamptz,
  description text
);

ALTER TABLE public.sigtb_demonstration ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.sigtb_demonstration FROM anon;
GRANT SELECT ON public.sigtb_demonstration TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.sigtb_demonstration TO authenticated;
GRANT ALL ON public.sigtb_demonstration TO service_role;

DROP POLICY IF EXISTS lecture_authentifies ON public.sigtb_demonstration;
CREATE POLICY lecture_authentifies ON public.sigtb_demonstration
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS ecriture_admin ON public.sigtb_demonstration;
CREATE POLICY ecriture_admin ON public.sigtb_demonstration
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
