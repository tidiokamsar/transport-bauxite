/*
  # Contrats et facturation, phase 1 : fondation (D-026, D-027)

  1. Role `contract_manager` (Charge de contrats et facturation, Kogon
     Mining SARL). Droits de demarrage decides par le proprietaire le
     2026-11-10 (D-026) : ecriture sur les contrats, la facturation, les
     couts, les achats, la paie, la saisie terrain (voyages, pesees,
     immobilisations, carburant, flotte), la planification, les rapports et
     les parametres metier ; lecture sur le reste. La creation de comptes
     reste reservee a l'administrateur (is_admin).
  2. Module de droits `contracts` pour tous les roles.
  3. `societe` : identite legale imprimee sur les factures, notifications
     et fiches (une ligne). Raison sociale fournie par le proprietaire ;
     les autres champs sont a saisir (aucune valeur inventee).
  4. Dossier contractuel : `contrats`, `contrat_versions` (contrat initial
     et avenants), `contrat_engagements` (indicateurs et seuils de
     l'avenant), `contrat_tarifs`. Aucune valeur par defaut : un tarif ou
     un seuil absent n'est pas calculable (D-013).
  5. `journal_contrats` : toute creation, modification ou suppression sur
     ces tables, avec l'etat avant et apres et l'auteur (CDC 31).

  Idempotent : IF NOT EXISTS, ON CONFLICT, CREATE OR REPLACE.
*/

-- 1. Role
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'contract_manager';

INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_approve)
SELECT 'contract_manager', m.module, m.v, m.c, m.c, m.d, false
FROM (VALUES
  ('dashboard', true, false, false),
  ('vehicles', true, true, false),
  ('drivers', true, true, false),
  ('trips', true, true, true),
  ('planning', true, true, true),
  ('gps_tracking', true, false, false),
  ('geofencing', true, false, false),
  ('fuel', true, true, false),
  ('maintenance', true, true, false),
  ('stock', true, false, false),
  ('purchases', true, true, false),
  ('invoices', true, true, false),
  ('costs', true, true, false),
  ('hr', true, true, false),
  ('reports', true, true, false),
  ('settings', true, true, false),
  ('contracts', true, true, true),
  ('client_portal', true, false, false),
  ('esg', true, false, false),
  ('ai_analytics', true, false, false),
  ('iot', false, false, false)
) AS m(module, v, c, d)
ON CONFLICT (role, module) DO NOTHING;

-- 2. Module contracts pour les autres roles : direction en lecture et
-- approbation ; comptabilite en lecture ; les autres sans acces.
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_approve)
SELECT DISTINCT rp.role, 'contracts',
       rp.role IN ('admin', 'director', 'manager', 'accountant'),
       rp.role = 'admin', rp.role = 'admin', rp.role = 'admin',
       rp.role IN ('admin', 'director', 'manager')
FROM public.role_permissions rp
WHERE rp.role <> 'contract_manager'
ON CONFLICT (role, module) DO NOTHING;

-- 3. Societe
CREATE TABLE IF NOT EXISTS public.societe (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  raison_sociale text NOT NULL,
  rccm text,
  nif text,
  adresse text,
  ville text,
  pays text,
  telephone text,
  email text,
  signataire_nom text,
  signataire_fonction text,
  modifie_le timestamptz NOT NULL DEFAULT now(),
  modifie_par uuid REFERENCES auth.users(id)
);
INSERT INTO public.societe (id, raison_sociale) VALUES (1, 'Kogon Mining SARL') ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.societe ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.societe FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.societe TO authenticated;
GRANT ALL ON public.societe TO service_role;
DROP POLICY IF EXISTS lecture ON public.societe;
CREATE POLICY lecture ON public.societe FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ecriture_module ON public.societe;
CREATE POLICY ecriture_module ON public.societe FOR UPDATE TO authenticated
  USING (public.has_module_write('settings') OR public.is_admin())
  WITH CHECK (public.has_module_write('settings') OR public.is_admin());

-- 4. Dossier contractuel
CREATE TABLE IF NOT EXISTS public.contrats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  intitule text NOT NULL,
  nature text NOT NULL CHECK (nature IN ('client', 'location', 'autre')),
  contrepartie text NOT NULL,
  devise text NOT NULL CHECK (devise ~ '^[A-Z]{3}$'),
  date_debut date NOT NULL,
  date_fin date,
  statut text NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'actif', 'suspendu', 'clos')),
  delai_paiement_jours integer CHECK (delai_paiement_jours >= 0),
  description text,
  cree_par uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  cree_le timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contrats_periode CHECK (date_fin IS NULL OR date_fin >= date_debut)
);

CREATE TABLE IF NOT EXISTS public.contrat_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrat_id uuid NOT NULL REFERENCES public.contrats(id) ON DELETE CASCADE,
  numero integer NOT NULL CHECK (numero >= 0),
  intitule text NOT NULL,
  date_effet date NOT NULL,
  date_signature date,
  resume text,
  document_ref text,
  cree_par uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  cree_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contrat_id, numero)
);

CREATE TABLE IF NOT EXISTS public.contrat_engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.contrat_versions(id) ON DELETE CASCADE,
  indicateur text NOT NULL CHECK (indicateur IN (
    'disponibilite', 'temps_chargement', 'temps_cycle', 'taux_remplissage', 'rotations',
    'km_facturable', 'reference_carburant', 'autre')),
  libelle text NOT NULL,
  seuil numeric NOT NULL,
  unite text NOT NULL,
  sens text NOT NULL CHECK (sens IN ('minimum', 'maximum')),
  periodicite text NOT NULL CHECK (periodicite IN ('jour', 'shift', 'semaine', 'mois')),
  consequence text,
  ordre integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.contrat_tarifs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.contrat_versions(id) ON DELETE CASCADE,
  libelle text NOT NULL,
  unite text NOT NULL CHECK (unite IN ('tonne', 'heure', 'km', 'jour', 'mois', 'forfait', 'autre')),
  prix numeric NOT NULL CHECK (prix >= 0),
  categorie_materiel text,
  conditions text,
  ordre integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_contrat_versions ON public.contrat_versions (contrat_id, numero);
CREATE INDEX IF NOT EXISTS idx_contrat_engagements ON public.contrat_engagements (version_id, ordre);
CREATE INDEX IF NOT EXISTS idx_contrat_tarifs ON public.contrat_tarifs (version_id, ordre);

-- RLS : lecture et ecriture selon le module contracts ; un contrat ne se
-- supprime qu'au stade de brouillon.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['contrats', 'contrat_versions', 'contrat_engagements', 'contrat_tarifs'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS lecture_module ON public.%I', t);
    EXECUTE format('CREATE POLICY lecture_module ON public.%I FOR SELECT TO authenticated
      USING (public.has_module_view(''contracts'') OR public.is_admin())', t);
    EXECUTE format('DROP POLICY IF EXISTS ecriture_module ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS insertion_module ON public.%I', t);
    EXECUTE format('CREATE POLICY insertion_module ON public.%I FOR INSERT TO authenticated
      WITH CHECK (public.has_module_write(''contracts'') OR public.is_admin())', t);
    EXECUTE format('DROP POLICY IF EXISTS modification_module ON public.%I', t);
    EXECUTE format('CREATE POLICY modification_module ON public.%I FOR UPDATE TO authenticated
      USING (public.has_module_write(''contracts'') OR public.is_admin())
      WITH CHECK (public.has_module_write(''contracts'') OR public.is_admin())', t);
    EXECUTE format('DROP POLICY IF EXISTS suppression_module ON public.%I', t);
  END LOOP;
END $$;

CREATE POLICY suppression_module ON public.contrats FOR DELETE TO authenticated
  USING ((public.has_module_write('contracts') OR public.is_admin()) AND statut = 'brouillon');
CREATE POLICY suppression_module ON public.contrat_versions FOR DELETE TO authenticated
  USING (public.has_module_write('contracts') OR public.is_admin());
CREATE POLICY suppression_module ON public.contrat_engagements FOR DELETE TO authenticated
  USING (public.has_module_write('contracts') OR public.is_admin());
CREATE POLICY suppression_module ON public.contrat_tarifs FOR DELETE TO authenticated
  USING (public.has_module_write('contracts') OR public.is_admin());

-- 5. Journal des modifications du dossier contractuel
CREATE TABLE IF NOT EXISTS public.journal_contrats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_cible text NOT NULL,
  ligne_id uuid NOT NULL,
  contrat_id uuid,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  avant jsonb,
  apres jsonb,
  auteur uuid,
  le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_journal_contrats ON public.journal_contrats (contrat_id, le);
ALTER TABLE public.journal_contrats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.journal_contrats FROM anon, authenticated;
GRANT SELECT ON public.journal_contrats TO authenticated;
GRANT ALL ON public.journal_contrats TO service_role;
DROP POLICY IF EXISTS lecture_module ON public.journal_contrats;
CREATE POLICY lecture_module ON public.journal_contrats FOR SELECT TO authenticated
  USING (public.has_module_view('contracts') OR public.is_admin());

CREATE OR REPLACE FUNCTION public.journaliser_contrats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ligne jsonb := to_jsonb(CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END);
  v_contrat uuid;
BEGIN
  v_contrat := CASE TG_TABLE_NAME
    WHEN 'contrats' THEN (v_ligne->>'id')::uuid
    WHEN 'contrat_versions' THEN (v_ligne->>'contrat_id')::uuid
    ELSE (SELECT cv.contrat_id FROM public.contrat_versions cv WHERE cv.id = (v_ligne->>'version_id')::uuid)
  END;
  INSERT INTO public.journal_contrats (table_cible, ligne_id, contrat_id, action, avant, apres, auteur)
  VALUES (TG_TABLE_NAME, (v_ligne->>'id')::uuid, v_contrat, TG_OP,
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END,
    auth.uid());
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.journaliser_contrats() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['contrats', 'contrat_versions', 'contrat_engagements', 'contrat_tarifs'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS journaliser ON public.%I', t);
    EXECUTE format('CREATE TRIGGER journaliser AFTER INSERT OR UPDATE OR DELETE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.journaliser_contrats()', t);
  END LOOP;
END $$;
