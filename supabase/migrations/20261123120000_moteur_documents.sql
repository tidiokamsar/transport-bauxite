/*
  # Moteur de documents officiels (D-106, T1-T2)

  Les fiches deviennent de veritables supports operationnels et
  documentaires. Cette tranche pose :

  1. `documents_modeles` : modeles versionnes (code, version, famille A/B/C,
     orientation, contenu JSON avec zones de signature et cachet, en-tete,
     pied de page). Ecriture administrative, lecture pour tout compte.
  2. `documents_genere` : chaque generation produit une ligne avec numero
     officiel sans trou (DOC-AAAA-NNNN), empreinte SHA-256 du contenu rendu,
     statut (genere, en_signature, signe, cachete, retourne, archive).
     Append-only : un document archive est immuable.
  3. `circuits_signature` : circuits parametrables par modele — etapes
     ordonnees (role, fonction, action visa/signature/cachet, obligatoire,
     delai). Signatures paralleles (meme rang) ou successives.
  4. `signatures_documents` : trace de chaque intervention (signataire,
     fonction, action, motif, horodatage). Append-only.
  5. Fonctions : generer_document_fiche, apposer_visa, signer_document,
     rejeter_document, retourner_correction, archiver_document.
  6. `cachets` : referentiel des cachets autorises (organisation, service,
     responsable habilite, types de documents autorises, validite).
  7. `cachets_applications` : toute utilisation d'un cachet est journalisee.

  Regles :
  - Un visa electronique interne n'est JAMAIS presente comme une signature
    electronique juridiquement qualifiee (types explicites).
  - Un document ne devient jamais une seconde source de verite.
  - Un cachet scanne n'est utilisable que par le responsable habilite,
    sur les types autorises, dans la periode de validite.

  Idempotent.
*/

-- ============================================================================
-- 1. MODELES DOCUMENTAIRES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.documents_modeles (
  code text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  nom text NOT NULL,
  famille text NOT NULL CHECK (famille IN ('A', 'B', 'C')),
  type_source text, -- type de fiche ou objet metier (nullable = libre)
  orientation text NOT NULL DEFAULT 'portrait' CHECK (orientation IN ('portrait', 'paysage')),
  contenu jsonb NOT NULL DEFAULT '{}'::jsonb,
  en_tete jsonb NOT NULL DEFAULT '{}'::jsonb,
  pied_de_page jsonb NOT NULL DEFAULT '{}'::jsonb,
  zones_signature jsonb NOT NULL DEFAULT '[]'::jsonb,
  zones_cachet jsonb NOT NULL DEFAULT '[]'::jsonb,
  statut text NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'actif', 'archive')),
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (code, version)
);

ALTER TABLE public.documents_modeles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.documents_modeles FROM anon;
GRANT SELECT ON public.documents_modeles TO authenticated;
GRANT ALL ON public.documents_modeles TO service_role;
DROP POLICY IF EXISTS lecture_authentifies ON public.documents_modeles;
CREATE POLICY lecture_authentifies ON public.documents_modeles
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS administration ON public.documents_modeles;
CREATE POLICY administration ON public.documents_modeles
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================================
-- 2. DOCUMENTS GENERES (numero officiel, SHA-256, archivage)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.documents_genere (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_officiel text NOT NULL UNIQUE,
  modele_code text NOT NULL,
  modele_version integer NOT NULL,
  fiche_id uuid REFERENCES public.fiches_terrain(id) ON DELETE SET NULL,
  objet_type text,
  objet_id uuid,
  contenu_rendu jsonb NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  statut text NOT NULL DEFAULT 'genere'
    CHECK (statut IN ('genere', 'en_signature', 'signe', 'cachete', 'retourne', 'archive', 'rejete', 'correction')),
  cree_par uuid NOT NULL REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now(),
  archive_le timestamptz,
  archive_par uuid REFERENCES auth.users(id)
);

ALTER TABLE public.documents_genere ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.documents_genere FROM anon;
GRANT SELECT ON public.documents_genere TO authenticated;
GRANT ALL ON public.documents_genere TO service_role;
-- Lecture : le module proprietaire du modele, ou admin.
DROP POLICY IF EXISTS lecture_module ON public.documents_genere;
CREATE POLICY lecture_module ON public.documents_genere
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.has_module_view(
        coalesce((SELECT CASE WHEN m.type_source IS NOT NULL THEN public.fiche_module(m.type_source) END
                  FROM public.documents_modeles m
                  WHERE m.code = modele_code AND m.version = modele_version), 'trips'))
  );
-- Ecriture par les fonctions serveur seulement.
REVOKE INSERT, UPDATE, DELETE ON public.documents_genere FROM authenticated;

CREATE INDEX IF NOT EXISTS idx_documents_genere_fiche ON public.documents_genere (fiche_id);
CREATE INDEX IF NOT EXISTS idx_documents_genere_statut ON public.documents_genere (statut);

-- Immuable une fois archive : trigger de garde.
CREATE OR REPLACE FUNCTION public.garde_document_archive()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Un document ne se supprime pas' USING ERRCODE = '42501';
  END IF;
  IF OLD.statut = 'archive' AND NEW.statut IS DISTINCT FROM OLD.statut THEN
    RAISE EXCEPTION 'Document % archive : immuable', OLD.numero_officiel USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS documents_genere_immuable ON public.documents_genere;
CREATE TRIGGER documents_genere_immuable BEFORE UPDATE OR DELETE ON public.documents_genere
  FOR EACH ROW EXECUTE FUNCTION public.garde_document_archive();

-- Numerotation officielle sans trou.
CREATE OR REPLACE FUNCTION public.document_numero_suivant(p_modele text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_annee text := to_char(now(), 'YYYY');
  v_suite integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('sigtb.doc.' || p_modele || '.' || v_annee));
  SELECT coalesce(max(substring(numero_officiel FROM '(\d+)$')::int), 0) + 1 INTO v_suite
    FROM public.documents_genere
   WHERE numero_officiel LIKE p_modele || '-DOC-' || v_annee || '-%';
  RETURN p_modele || '-DOC-' || v_annee || '-' || lpad(v_suite::text, 4, '0');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.document_numero_suivant(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.document_numero_suivant(text) TO authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================================
-- 3. GENERATION D'UN DOCUMENT DEPUIS UNE FICHE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generer_document_fiche(
  p_fiche_id uuid,
  p_modele_code text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f public.fiches_terrain;
  m public.documents_modeles;
  v_id uuid; v_numero text; v_contenu jsonb; v_sha text;
BEGIN
  SELECT * INTO f FROM public.fiches_terrain WHERE id = p_fiche_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fiche introuvable' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO m FROM public.documents_modeles
   WHERE code = p_modele_code AND statut = 'actif'
   ORDER BY version DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Modele % introuvable ou inactif', p_modele_code USING ERRCODE = 'P0002';
  END IF;

  -- Le modele doit correspondre au type de la fiche (si type_source defini).
  IF m.type_source IS NOT NULL AND m.type_source <> f.type THEN
    RAISE EXCEPTION 'Le modele % s''applique aux fiches %, pas %', p_modele_code, m.type_source, f.type
      USING ERRCODE = '22023';
  END IF;

  -- Droit de lecture sur la fiche (module proprietaire).
  IF NOT (public.has_module_view(public.fiche_module(f.type)) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit de lecture requis sur %', public.fiche_module(f.type) USING ERRCODE = '42501';
  END IF;

  -- Contenu rendu : la fiche + les donnees metier associees (jamais inventees).
  SELECT to_jsonb(f) || jsonb_build_object(
    'modele', jsonb_build_object('code', m.code, 'version', m.version, 'nom', m.nom,
      'orientation', m.orientation, 'zones_signature', m.zones_signature, 'zones_cachet', m.zones_cachet),
    'societe', (SELECT to_jsonb(s) FROM public.societe s WHERE s.id = 1),
    'site', (SELECT to_jsonb(si) FROM public.sites si WHERE si.id = f.site_id),
    'engin', (SELECT to_jsonb(v) FROM public.vehicles v WHERE v.id = f.vehicle_id)
  ) INTO v_contenu;

  v_sha := encode(extensions.digest(v_contenu::text, 'sha256'), 'hex');
  v_numero := public.document_numero_suivant(p_modele_code);

  INSERT INTO public.documents_genere (numero_officiel, modele_code, modele_version, fiche_id,
                                       objet_type, objet_id, contenu_rendu, sha256, cree_par)
  VALUES (v_numero, m.code, m.version, p_fiche_id, 'fiche', p_fiche_id, v_contenu, v_sha, auth.uid())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.generer_document_fiche(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generer_document_fiche(uuid, text) TO authenticated, service_role;

-- ============================================================================
-- 4. CIRCUITS DE SIGNATURE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.circuits_signature (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modele_code text NOT NULL,
  modele_version integer NOT NULL,
  nom text NOT NULL,
  etapes jsonb NOT NULL, -- [{rang, role, fonction, action, obligatoire, delai_heures}]
  actif boolean NOT NULL DEFAULT true,
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (modele_code, modele_version, nom)
);

ALTER TABLE public.circuits_signature ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.circuits_signature FROM anon;
GRANT SELECT ON public.circuits_signature TO authenticated;
GRANT ALL ON public.circuits_signature TO service_role;
DROP POLICY IF EXISTS lecture_authentifies ON public.circuits_signature;
CREATE POLICY lecture_authentifies ON public.circuits_signature
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS administration ON public.circuits_signature;
CREATE POLICY administration ON public.circuits_signature
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================================
-- 5. SIGNATURES ET INTERVENTIONS SUR DOCUMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.signatures_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents_genere(id) ON DELETE RESTRICT,
  circuit_id uuid REFERENCES public.circuits_signature(id),
  etape_rang integer NOT NULL,
  etape_action text NOT NULL CHECK (etape_action IN ('visa', 'signature', 'cachet', 'rejet', 'retour_correction')),
  signataire uuid NOT NULL REFERENCES auth.users(id),
  fonction_signataire text,
  motif text,
  horodatage timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.signatures_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.signatures_documents FROM anon;
GRANT SELECT ON public.signatures_documents TO authenticated;
GRANT ALL ON public.signatures_documents TO service_role;
-- Lecture : ceux qui voient le document.
DROP POLICY IF EXISTS lecture_module ON public.signatures_documents;
CREATE POLICY lecture_module ON public.signatures_documents
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.documents_genere d
                  WHERE d.id = document_id
                    AND (public.is_admin()
                         OR public.has_module_view(coalesce(
                             (SELECT public.fiche_module(m.type_source) FROM public.documents_modeles m
                              WHERE m.code = d.modele_code AND m.version = d.modele_version), 'trips')))));
-- Ecriture par les fonctions serveur seulement.
REVOKE INSERT, UPDATE, DELETE ON public.signatures_documents FROM authenticated;

CREATE INDEX IF NOT EXISTS idx_signatures_document ON public.signatures_documents (document_id, etape_rang);

-- ============================================================================
-- 6. CACHETS AUTORISES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cachets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES public.organisations(id),
  service text NOT NULL,
  responsable_habilite uuid NOT NULL REFERENCES public.profiles(id),
  types_documents_autorises text[] NOT NULL DEFAULT '{}',
  validite_debut date NOT NULL,
  validite_fin date,
  image_chemin text, -- reference au bucket pieces
  statut text NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'suspendu', 'retire')),
  cree_le timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cachets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cachets FROM anon;
GRANT SELECT ON public.cachets TO authenticated;
GRANT ALL ON public.cachets TO service_role;
DROP POLICY IF EXISTS lecture_authentifies ON public.cachets;
CREATE POLICY lecture_authentifies ON public.cachets
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS administration ON public.cachets;
CREATE POLICY administration ON public.cachets
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.cachets_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents_genere(id) ON DELETE RESTRICT,
  cachet_id uuid NOT NULL REFERENCES public.cachets(id) ON DELETE RESTRICT,
  applique_par uuid NOT NULL REFERENCES auth.users(id),
  applique_le timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cachets_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cachets_applications FROM anon;
GRANT SELECT ON public.cachets_applications TO authenticated;
GRANT ALL ON public.cachets_applications TO service_role;
DROP POLICY IF EXISTS lecture_module ON public.cachets_applications;
CREATE POLICY lecture_module ON public.cachets_applications
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.documents_genere d WHERE d.id = document_id));
-- Ecriture par la fonction serveur seulement.
REVOKE INSERT, UPDATE, DELETE ON public.cachets_applications FROM authenticated;

-- ============================================================================
-- 7. FONCTIONS : VISA, SIGNATURE, REJET, CACHET, ARCHIVAGE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apposer_visa(p_document_id uuid, p_fonction text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  d public.documents_genere;
BEGIN
  SELECT * INTO d FROM public.documents_genere WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document introuvable' USING ERRCODE = 'P0002'; END IF;
  IF d.statut IN ('archive', 'rejete') THEN
    RAISE EXCEPTION 'Document % : statut %, non signable', d.numero_officiel, d.statut USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.signatures_documents (document_id, etape_rang, etape_action, signataire, fonction_signataire)
  VALUES (p_document_id, 0, 'visa', auth.uid(), nullif(btrim(coalesce(p_fonction, '')), ''));
  IF d.statut = 'genere' THEN
    UPDATE public.documents_genere SET statut = 'en_signature' WHERE id = p_document_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.signer_document(p_document_id uuid, p_fonction text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  d public.documents_genere;
BEGIN
  SELECT * INTO d FROM public.documents_genere WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document introuvable' USING ERRCODE = 'P0002'; END IF;
  IF d.statut IN ('archive', 'rejete') THEN
    RAISE EXCEPTION 'Document % : statut %, non signable', d.numero_officiel, d.statut USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.signatures_documents (document_id, etape_rang, etape_action, signataire, fonction_signataire)
  VALUES (p_document_id, 1, 'signature', auth.uid(), nullif(btrim(coalesce(p_fonction, '')), ''));
  UPDATE public.documents_genere SET statut = 'signe' WHERE id = p_document_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rejeter_document(p_document_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motif obligatoire pour rejeter un document' USING ERRCODE = '22023';
  END IF;
  UPDATE public.documents_genere SET statut = 'rejete'
   WHERE id = p_document_id AND statut NOT IN ('archive');
  IF NOT FOUND THEN RAISE EXCEPTION 'Document introuvable ou archive' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.signatures_documents (document_id, etape_rang, etape_action, signataire, motif)
  VALUES (p_document_id, 99, 'rejet', auth.uid(), btrim(p_motif));
END;
$$;

CREATE OR REPLACE FUNCTION public.retourner_correction(p_document_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motif obligatoire pour retourner un document' USING ERRCODE = '22023';
  END IF;
  UPDATE public.documents_genere SET statut = 'correction'
   WHERE id = p_document_id AND statut NOT IN ('archive');
  IF NOT FOUND THEN RAISE EXCEPTION 'Document introuvable ou archive' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.signatures_documents (document_id, etape_rang, etape_action, signataire, motif)
  VALUES (p_document_id, 98, 'retour_correction', auth.uid(), btrim(p_motif));
END;
$$;

CREATE OR REPLACE FUNCTION public.apposer_cachet(p_document_id uuid, p_cachet_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  d public.documents_genere; c public.cachets;
BEGIN
  SELECT * INTO d FROM public.documents_genere WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document introuvable' USING ERRCODE = 'P0002'; END IF;
  IF d.statut IN ('archive', 'rejete') THEN
    RAISE EXCEPTION 'Document % : statut %, non cachetable', d.numero_officiel, d.statut USING ERRCODE = '22023';
  END IF;
  SELECT * INTO c FROM public.cachets WHERE id = p_cachet_id;
  IF NOT FOUND OR c.statut <> 'actif' THEN
    RAISE EXCEPTION 'Cachet introuvable ou inactif' USING ERRCODE = 'P0002';
  END IF;
  -- Habilitation : seul le responsable habilite (ou un admin) applique le cachet.
  IF NOT (public.is_admin() OR c.responsable_habilite = auth.uid()) THEN
    RAISE EXCEPTION 'Cachet reserve a son responsable habilite' USING ERRCODE = '42501';
  END IF;
  -- Periode de validite.
  IF current_date < c.validite_debut OR (c.validite_fin IS NOT NULL AND current_date > c.validite_fin) THEN
    RAISE EXCEPTION 'Cachet hors periode de validite' USING ERRCODE = '22023';
  END IF;
  -- Types de documents autorises.
  IF c.types_documents_autorises <> '{}' AND NOT (d.modele_code = ANY (c.types_documents_autorises)) THEN
    RAISE EXCEPTION 'Cachet non autorise pour le modele %', d.modele_code USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.cachets_applications (document_id, cachet_id, applique_par)
  VALUES (p_document_id, p_cachet_id, auth.uid());
  INSERT INTO public.signatures_documents (document_id, etape_rang, etape_action, signataire, fonction_signataire)
  VALUES (p_document_id, 2, 'cachet', auth.uid(), 'Cachet : ' || c.service);
  UPDATE public.documents_genere SET statut = 'cachete' WHERE id = p_document_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.archiver_document(p_document_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE d public.documents_genere;
BEGIN
  SELECT * INTO d FROM public.documents_genere WHERE id = p_document_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document introuvable' USING ERRCODE = 'P0002'; END IF;
  IF d.statut NOT IN ('signe', 'cachete', 'retourne') THEN
    RAISE EXCEPTION 'Document % au statut % : archivable apres signature, cachet ou retour seulement',
      d.numero_officiel, d.statut USING ERRCODE = '22023';
  END IF;
  UPDATE public.documents_genere SET statut = 'archive', archive_le = now(), archive_par = auth.uid()
   WHERE id = p_document_id;
END;
$$;

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.apposer_visa(uuid, text)',
    'public.signer_document(uuid, text)',
    'public.rejeter_document(uuid, text)',
    'public.retourner_correction(uuid, text)',
    'public.apposer_cachet(uuid, uuid)',
    'public.archiver_document(uuid)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;
