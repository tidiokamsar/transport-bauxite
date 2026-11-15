/*
  # Fournisseurs : repertoire, fiche, evaluation, suspension, consultations
  # (D-059, lot 15b, module 15)

  1. Fiche fournisseur ecrite par fonctions serveur seulement
     (`enregistrer_fournisseur`, droit d'ecriture des achats), sans
     suppression physique. Numero FRS-NNNNN attribue par le serveur ;
     raison sociale et identifiant fiscal uniques. Contacts
     (`enregistrer_contact_fournisseur`, `retirer_contact_fournisseur`, un
     seul contact principal actif), categories (referentiel
     `categories_fournisseurs`, `definir_categorie_fournisseur`,
     `classer_fournisseur`).
  2. Documents administratifs en metadonnees : type, numero, dates
     d'emission et d'expiration, reference de la piece (texte : le stockage
     de fichiers n'existe pas). Ajout et retrait motive, jamais de
     reecriture. Alerte : `v_documents_fournisseurs_echeance` (expire ou a
     renouveler dans le delai du reglage `fournisseurs_alerte_documents_jours`,
     30 jours si absent, a confirmer). Le systeme signale, l'humain decide :
     un document expire ne suspend pas le fournisseur.
  3. Evaluation periodique : grille de criteres ponderes tenue par
     l'administrateur (`criteres_evaluation_fournisseur`, aucune grille par
     defaut), notes de 1 a 5 saisies pour chaque critere actif, auteur,
     periode, commentaire ; note globale ponderee calculee par le serveur ;
     append-only. Une nouvelle evaluation d'une periode deja evaluee exige
     un motif de correction et remplace la precedente
     (`v_evaluations_fournisseurs_courantes`).
  4. Suspension et reactivation motivees (`suspendre_fournisseur`,
     `reactiver_fournisseur`, droit d'approbation des achats) et
     journalisees. `enregistrer_bon_commande` (D-053) exige deja
     `suppliers.active` ; un declencheur refuse en plus la soumission et
     l'approbation d'un bon dont le fournisseur est suspendu. Les bons deja
     approuves restent receptionnables.
  5. Consultations (demandes de cotation) : numero CONS-AAAA-NNNNN, lignes,
     fournisseurs consultes (actifs), offres recues avec prix unitaire par
     ligne et delai saisis (`enregistrer_offre`, `retirer_offre`),
     selection motivee (`selectionner_offre`) avec nombre minimal d'offres
     (reglage `consultation_offres_minimum`, 1 si absent). La selection
     peut preparer un bon de commande brouillon par
     `enregistrer_bon_commande` (`preparer_bon_commande_consultation`) :
     le circuit D-053 reste seul juge (soumission, approbation).
  6. Journaux `fournisseurs_journal` et `consultations_journal`
     (append-only).

  Lecture : modules achats ou stocks (fiches), achats (consultations) et
  perimetre du site du depot. Idempotent.
*/

-- 1. Fiche fournisseur
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS ville text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS pays text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS identifiant_fiscal text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS registre_commerce text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS suspendu_le timestamptz;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS suspendu_par uuid REFERENCES auth.users(id);
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS motif_suspension text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS cree_par uuid REFERENCES auth.users(id);
CREATE SEQUENCE IF NOT EXISTS public.suppliers_numero_seq;

CREATE TABLE IF NOT EXISTS public.fournisseurs_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  evenement text NOT NULL CHECK (evenement IN ('creation', 'modification', 'suspension', 'reactivation', 'contact', 'retrait_contact',
                                                'document', 'retrait_document', 'categories', 'evaluation')),
  motif text,
  details jsonb,
  par uuid REFERENCES auth.users(id),
  le timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_fournisseurs_journal_fournisseur ON public.fournisseurs_journal(supplier_id, le);

CREATE TABLE IF NOT EXISTS public.contacts_fournisseurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  nom text NOT NULL CHECK (btrim(nom) <> ''),
  fonction text,
  telephone text,
  email text,
  principal boolean NOT NULL DEFAULT false,
  actif boolean NOT NULL DEFAULT true,
  motif_retrait text,
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now(),
  modifie_le timestamptz,
  CHECK (telephone IS NOT NULL OR email IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_contacts_fournisseurs_fournisseur ON public.contacts_fournisseurs(supplier_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_fournisseurs_principal ON public.contacts_fournisseurs(supplier_id) WHERE principal AND actif;

CREATE TABLE IF NOT EXISTS public.categories_fournisseurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  libelle text NOT NULL CHECK (btrim(libelle) <> ''),
  actif boolean NOT NULL DEFAULT true,
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_fournisseurs_libelle ON public.categories_fournisseurs(lower(btrim(libelle)));

CREATE TABLE IF NOT EXISTS public.fournisseurs_categories (
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  categorie_id uuid NOT NULL REFERENCES public.categories_fournisseurs(id),
  PRIMARY KEY (supplier_id, categorie_id)
);

-- 2. Documents administratifs (metadonnees)
CREATE TABLE IF NOT EXISTS public.documents_fournisseurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  type_document text NOT NULL CHECK (type_document IN ('rccm', 'nif', 'attestation_fiscale', 'attestation_cnss', 'assurance',
                                                        'agrement', 'contrat_cadre', 'autre')),
  libelle text,
  numero text,
  date_emission date,
  date_expiration date,
  reference_piece text NOT NULL CHECK (btrim(reference_piece) <> ''),
  observation text,
  enregistre_par uuid REFERENCES auth.users(id),
  enregistre_le timestamptz NOT NULL DEFAULT clock_timestamp(),
  retire_le timestamptz,
  retire_par uuid REFERENCES auth.users(id),
  motif_retrait text,
  CHECK (date_expiration IS NULL OR date_emission IS NULL OR date_expiration >= date_emission),
  CHECK (type_document <> 'autre' OR nullif(btrim(coalesce(libelle, '')), '') IS NOT NULL),
  CHECK (retire_le IS NULL OR nullif(btrim(coalesce(motif_retrait, '')), '') IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_documents_fournisseurs_fournisseur ON public.documents_fournisseurs(supplier_id);

-- 3. Evaluation
CREATE TABLE IF NOT EXISTS public.criteres_evaluation_fournisseur (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  libelle text NOT NULL CHECK (btrim(libelle) <> ''),
  description text,
  poids integer NOT NULL CHECK (poids > 0),
  ordre integer NOT NULL DEFAULT 0,
  actif boolean NOT NULL DEFAULT true,
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.evaluations_fournisseurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  periode_debut date NOT NULL,
  periode_fin date NOT NULL,
  note_globale numeric(4,2) NOT NULL CHECK (note_globale BETWEEN 1 AND 5),
  commentaire text,
  remplace_id uuid REFERENCES public.evaluations_fournisseurs(id),
  motif_correction text,
  evalue_par uuid REFERENCES auth.users(id),
  evalue_le timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (periode_fin >= periode_debut),
  CHECK (remplace_id IS NULL OR nullif(btrim(coalesce(motif_correction, '')), '') IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_evaluations_fournisseurs_fournisseur ON public.evaluations_fournisseurs(supplier_id, periode_fin);

CREATE TABLE IF NOT EXISTS public.evaluations_fournisseurs_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES public.evaluations_fournisseurs(id),
  critere_id uuid NOT NULL REFERENCES public.criteres_evaluation_fournisseur(id),
  libelle text NOT NULL,
  poids integer NOT NULL CHECK (poids > 0),
  note integer NOT NULL CHECK (note BETWEEN 1 AND 5),
  observation text,
  UNIQUE (evaluation_id, critere_id)
);

-- 4. Consultations
CREATE SEQUENCE IF NOT EXISTS public.consultations_numero_seq;

CREATE TABLE IF NOT EXISTS public.consultations_fournisseurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  objet text NOT NULL CHECK (btrim(objet) <> ''),
  warehouse_id uuid REFERENCES public.warehouses(id),
  date_limite date,
  note text,
  statut text NOT NULL DEFAULT 'ouverte' CHECK (statut IN ('ouverte', 'attribuee', 'annulee')),
  offre_retenue_id uuid,
  motif_selection text,
  selection_par uuid REFERENCES auth.users(id),
  selection_le timestamptz,
  purchase_order_id uuid REFERENCES public.purchase_orders(id),
  motif_annulation text,
  annule_par uuid REFERENCES auth.users(id),
  annule_le timestamptz,
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.consultations_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL REFERENCES public.consultations_fournisseurs(id),
  ordre integer NOT NULL,
  stock_item_id uuid REFERENCES public.stock_items(id),
  designation text NOT NULL CHECK (btrim(designation) <> ''),
  quantite integer NOT NULL CHECK (quantite > 0),
  UNIQUE (consultation_id, ordre)
);

CREATE TABLE IF NOT EXISTS public.consultations_invites (
  consultation_id uuid NOT NULL REFERENCES public.consultations_fournisseurs(id),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  invite_par uuid REFERENCES auth.users(id),
  invite_le timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (consultation_id, supplier_id)
);

CREATE TABLE IF NOT EXISTS public.offres_fournisseurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL REFERENCES public.consultations_fournisseurs(id),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  reference_offre text,
  recue_le date NOT NULL,
  delai_livraison_jours integer NOT NULL CHECK (delai_livraison_jours >= 0),
  validite_jusqu_au date,
  conditions text,
  montant_total bigint NOT NULL CHECK (montant_total >= 0),
  lignes_chiffrees integer NOT NULL CHECK (lignes_chiffrees > 0),
  statut text NOT NULL DEFAULT 'recue' CHECK (statut IN ('recue', 'retenue', 'ecartee', 'retiree')),
  motif_retrait text,
  retire_par uuid REFERENCES auth.users(id),
  retire_le timestamptz,
  saisi_par uuid REFERENCES auth.users(id),
  saisi_le timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (statut <> 'retiree' OR nullif(btrim(coalesce(motif_retrait, '')), '') IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_offres_fournisseurs_consultation ON public.offres_fournisseurs(consultation_id);
CREATE INDEX IF NOT EXISTS idx_offres_fournisseurs_fournisseur ON public.offres_fournisseurs(supplier_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_offres_fournisseurs_active ON public.offres_fournisseurs(consultation_id, supplier_id) WHERE statut <> 'retiree';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consultations_fournisseurs_offre_retenue_fkey') THEN
    ALTER TABLE public.consultations_fournisseurs ADD CONSTRAINT consultations_fournisseurs_offre_retenue_fkey
      FOREIGN KEY (offre_retenue_id) REFERENCES public.offres_fournisseurs(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.offres_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offre_id uuid NOT NULL REFERENCES public.offres_fournisseurs(id),
  consultation_ligne_id uuid NOT NULL REFERENCES public.consultations_lignes(id),
  prix_unitaire bigint NOT NULL CHECK (prix_unitaire >= 0),
  UNIQUE (offre_id, consultation_ligne_id)
);

CREATE TABLE IF NOT EXISTS public.consultations_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL REFERENCES public.consultations_fournisseurs(id),
  evenement text NOT NULL CHECK (evenement IN ('creation', 'invitation', 'offre', 'retrait_offre', 'selection', 'bon_commande', 'annulation')),
  motif text,
  details jsonb,
  par uuid REFERENCES auth.users(id),
  le timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_consultations_journal_consultation ON public.consultations_journal(consultation_id, le);

-- 5. Droits : lecture bornee, ecriture par fonctions seulement.
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'suppliers' LOOP
    EXECUTE format('DROP POLICY %I ON public.suppliers', p.policyname);
  END LOOP;
END $$;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.suppliers FROM anon, authenticated;
REVOKE ALL ON public.suppliers FROM anon;
GRANT SELECT ON public.suppliers TO authenticated;
CREATE POLICY lecture ON public.suppliers FOR SELECT TO authenticated
  USING (public.has_module_view('purchases') OR public.has_module_view('stock') OR public.is_admin());

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fournisseurs_journal', 'contacts_fournisseurs', 'categories_fournisseurs', 'fournisseurs_categories',
                           'documents_fournisseurs', 'criteres_evaluation_fournisseur', 'evaluations_fournisseurs',
                           'evaluations_fournisseurs_notes', 'consultations_fournisseurs', 'consultations_lignes',
                           'consultations_invites', 'offres_fournisseurs', 'offres_lignes', 'consultations_journal'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS lecture ON public.%I', t);
  END LOOP;
END $$;

-- Pieces d'une fiche : visibles avec la fiche (RLS de suppliers).
CREATE POLICY lecture ON public.fournisseurs_journal FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id));
CREATE POLICY lecture ON public.contacts_fournisseurs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id));
CREATE POLICY lecture ON public.fournisseurs_categories FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id));
CREATE POLICY lecture ON public.documents_fournisseurs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id));
CREATE POLICY lecture ON public.evaluations_fournisseurs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id));
CREATE POLICY lecture ON public.evaluations_fournisseurs_notes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.evaluations_fournisseurs e WHERE e.id = evaluation_id));
CREATE POLICY lecture ON public.categories_fournisseurs FOR SELECT TO authenticated
  USING (public.has_module_view('purchases') OR public.has_module_view('stock') OR public.is_admin());
CREATE POLICY lecture ON public.criteres_evaluation_fournisseur FOR SELECT TO authenticated
  USING (public.has_module_view('purchases') OR public.is_admin());
-- Consultations : module achats et perimetre du depot de livraison.
CREATE POLICY lecture ON public.consultations_fournisseurs FOR SELECT TO authenticated
  USING ((public.has_module_view('purchases') OR public.is_admin())
         AND (warehouse_id IS NULL OR public.bon_commande_permis(warehouse_id)));
CREATE POLICY lecture ON public.consultations_lignes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.consultations_fournisseurs c WHERE c.id = consultation_id));
CREATE POLICY lecture ON public.consultations_invites FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.consultations_fournisseurs c WHERE c.id = consultation_id));
CREATE POLICY lecture ON public.offres_fournisseurs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.consultations_fournisseurs c WHERE c.id = consultation_id));
CREATE POLICY lecture ON public.offres_lignes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.offres_fournisseurs o WHERE o.id = offre_id));
CREATE POLICY lecture ON public.consultations_journal FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.consultations_fournisseurs c WHERE c.id = consultation_id));

CREATE OR REPLACE FUNCTION public.garde_append_only_fournisseurs()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN coalesce(NEW, OLD); END IF;
  RAISE EXCEPTION 'Enregistrement fournisseur non modifiable : saisir un nouvel enregistrement' USING ERRCODE = '42501';
END;
$$;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fournisseurs_journal', 'evaluations_fournisseurs', 'evaluations_fournisseurs_notes',
                           'offres_lignes', 'consultations_journal'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS garde_append_only ON public.%I', t);
    EXECUTE format('CREATE TRIGGER garde_append_only BEFORE UPDATE OR DELETE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.garde_append_only_fournisseurs()', t);
  END LOOP;
END $$;

-- Un fournisseur suspendu ne recoit plus de bon : ni nouveau brouillon
-- (deja refuse par enregistrer_bon_commande), ni soumission, ni approbation.
CREATE OR REPLACE FUNCTION public.garde_fournisseur_actif_bon()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.supplier_id IS NOT NULL
     AND (TG_OP = 'INSERT'
          OR (NEW.status IN ('submitted', 'approved') AND NEW.status IS DISTINCT FROM OLD.status AND OLD.status IN ('draft', 'submitted'))
          OR (NEW.supplier_id IS DISTINCT FROM OLD.supplier_id))
     AND NOT EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = NEW.supplier_id AND coalesce(s.active, true)) THEN
    RAISE EXCEPTION 'Fournisseur suspendu : aucun bon de commande ne peut lui etre adresse, soumis ou approuve' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.garde_fournisseur_actif_bon() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garde_fournisseur_actif ON public.purchase_orders;
CREATE TRIGGER garde_fournisseur_actif BEFORE INSERT OR UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.garde_fournisseur_actif_bon();

-- 6. Fonctions internes
CREATE OR REPLACE FUNCTION public.reglage_entier(p_cle text, p_defaut integer)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce((SELECT CASE WHEN (s.value ->> 'value') ~ '^[0-9]+$' THEN (s.value ->> 'value')::integer END
                     FROM public.settings s WHERE s.key = p_cle), p_defaut);
$$;
REVOKE EXECUTE ON FUNCTION public.reglage_entier(text, integer) FROM PUBLIC, anon, authenticated;

-- Delai d'alerte des documents (jours avant expiration) ; 30 si le reglage
-- est absent (valeur a confirmer par l'exploitation).
CREATE OR REPLACE FUNCTION public.delai_alerte_documents_fournisseurs()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.reglage_entier('fournisseurs_alerte_documents_jours', 30);
$$;
REVOKE EXECUTE ON FUNCTION public.delai_alerte_documents_fournisseurs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delai_alerte_documents_fournisseurs() TO authenticated;

CREATE OR REPLACE FUNCTION public.journaliser_fournisseur(p_fournisseur uuid, p_evenement text, p_motif text DEFAULT NULL, p_details jsonb DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.fournisseurs_journal (supplier_id, evenement, motif, details, par)
  VALUES (p_fournisseur, p_evenement, nullif(btrim(coalesce(p_motif, '')), ''), p_details, auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.journaliser_fournisseur(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.journaliser_consultation(p_consultation uuid, p_evenement text, p_motif text DEFAULT NULL, p_details jsonb DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.consultations_journal (consultation_id, evenement, motif, details, par)
  VALUES (p_consultation, p_evenement, nullif(btrim(coalesce(p_motif, '')), ''), p_details, auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.journaliser_consultation(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.exiger_ecriture_achats()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (public.has_module_write('purchases') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les achats requis' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.exiger_ecriture_achats() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fournisseur_existant(p_id uuid)
RETURNS public.suppliers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE s public.suppliers;
BEGIN
  SELECT * INTO s FROM public.suppliers WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fournisseur introuvable' USING ERRCODE = '22023'; END IF;
  RETURN s;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fournisseur_existant(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.texte_ou_null(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$ SELECT nullif(btrim(coalesce(p, '')), ''); $$;

-- 7. Fiche, contacts, categories, documents
CREATE OR REPLACE FUNCTION public.enregistrer_fournisseur(
  p_raison_sociale text, p_type text, p_id uuid DEFAULT NULL, p_telephone text DEFAULT NULL, p_email text DEFAULT NULL,
  p_adresse text DEFAULT NULL, p_ville text DEFAULT NULL, p_pays text DEFAULT NULL, p_identifiant_fiscal text DEFAULT NULL,
  p_registre_commerce text DEFAULT NULL, p_conditions_paiement text DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE s public.suppliers; v_id uuid; v_numero text; v_nom text := public.texte_ou_null(p_raison_sociale);
        v_nif text := public.texte_ou_null(p_identifiant_fiscal); v_email text := public.texte_ou_null(p_email);
        v_avant jsonb; v_apres jsonb; v_diff jsonb;
BEGIN
  PERFORM public.exiger_ecriture_achats();
  IF v_nom IS NULL THEN RAISE EXCEPTION 'Raison sociale requise' USING ERRCODE = '22023'; END IF;
  IF p_type IS NULL OR p_type NOT IN ('parts', 'tires', 'fuel', 'services', 'other') THEN
    RAISE EXCEPTION 'Type de fournisseur inconnu' USING ERRCODE = '22023';
  END IF;
  IF v_email IS NOT NULL AND v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Adresse electronique invalide' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.suppliers x WHERE lower(btrim(x.company_name)) = lower(v_nom) AND x.id IS DISTINCT FROM p_id) THEN
    RAISE EXCEPTION 'Un fournisseur porte deja la raison sociale « % »', v_nom USING ERRCODE = '23505';
  END IF;
  IF v_nif IS NOT NULL AND EXISTS (SELECT 1 FROM public.suppliers x WHERE lower(btrim(x.identifiant_fiscal)) = lower(v_nif) AND x.id IS DISTINCT FROM p_id) THEN
    RAISE EXCEPTION 'Identifiant fiscal deja attribue a un autre fournisseur' USING ERRCODE = '23505';
  END IF;
  v_apres := jsonb_build_object('company_name', v_nom, 'supplier_type', p_type, 'phone', public.texte_ou_null(p_telephone),
    'email', v_email, 'address', public.texte_ou_null(p_adresse), 'ville', public.texte_ou_null(p_ville),
    'pays', public.texte_ou_null(p_pays), 'identifiant_fiscal', v_nif, 'registre_commerce', public.texte_ou_null(p_registre_commerce),
    'payment_terms', public.texte_ou_null(p_conditions_paiement), 'notes', public.texte_ou_null(p_note));
  IF p_id IS NULL THEN
    LOOP
      v_numero := 'FRS-' || lpad(nextval('public.suppliers_numero_seq')::text, 5, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.suppliers x WHERE x.supplier_number = v_numero);
    END LOOP;
    INSERT INTO public.suppliers (supplier_number, supplier_type, company_name, phone, email, address, ville, pays, identifiant_fiscal,
                                  registre_commerce, payment_terms, notes, active, cree_par)
    VALUES (v_numero, p_type, v_nom, v_apres ->> 'phone', v_email, v_apres ->> 'address', v_apres ->> 'ville', v_apres ->> 'pays', v_nif,
            v_apres ->> 'registre_commerce', v_apres ->> 'payment_terms', v_apres ->> 'notes', true, auth.uid())
    RETURNING id INTO v_id;
    PERFORM public.journaliser_fournisseur(v_id, 'creation', NULL, jsonb_build_object('numero', v_numero));
  ELSE
    s := public.fournisseur_existant(p_id);
    v_id := p_id;
    v_avant := jsonb_build_object('company_name', s.company_name, 'supplier_type', s.supplier_type, 'phone', s.phone, 'email', s.email,
      'address', s.address, 'ville', s.ville, 'pays', s.pays, 'identifiant_fiscal', s.identifiant_fiscal,
      'registre_commerce', s.registre_commerce, 'payment_terms', s.payment_terms, 'notes', s.notes);
    SELECT jsonb_object_agg(k, jsonb_build_object('avant', v_avant -> k, 'apres', v_apres -> k)) INTO v_diff
      FROM jsonb_object_keys(v_apres) AS k WHERE (v_avant -> k) IS DISTINCT FROM (v_apres -> k);
    IF v_diff IS NULL THEN RETURN v_id; END IF;
    UPDATE public.suppliers SET company_name = v_nom, supplier_type = p_type, phone = v_apres ->> 'phone', email = v_email,
      address = v_apres ->> 'address', ville = v_apres ->> 'ville', pays = v_apres ->> 'pays', identifiant_fiscal = v_nif,
      registre_commerce = v_apres ->> 'registre_commerce', payment_terms = v_apres ->> 'payment_terms', notes = v_apres ->> 'notes',
      updated_at = now()
     WHERE id = v_id;
    PERFORM public.journaliser_fournisseur(v_id, 'modification', NULL, v_diff);
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.suspendre_fournisseur(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE s public.suppliers;
BEGIN
  IF NOT (public.has_module_approve('purchases') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''approbation des achats requis pour suspendre un fournisseur' USING ERRCODE = '42501';
  END IF;
  IF public.texte_ou_null(p_motif) IS NULL THEN RAISE EXCEPTION 'Motif de la suspension requis' USING ERRCODE = '22023'; END IF;
  s := public.fournisseur_existant(p_id);
  IF NOT coalesce(s.active, true) THEN RAISE EXCEPTION 'Fournisseur deja suspendu' USING ERRCODE = '22023'; END IF;
  UPDATE public.suppliers SET active = false, suspendu_le = now(), suspendu_par = auth.uid(), motif_suspension = btrim(p_motif),
    updated_at = now() WHERE id = p_id;
  PERFORM public.journaliser_fournisseur(p_id, 'suspension', p_motif,
    (SELECT jsonb_build_object('bons_en_cours', count(*)) FROM public.purchase_orders po
      WHERE po.supplier_id = p_id AND po.status IN ('draft', 'submitted', 'approved', 'partially_received')));
END;
$$;

CREATE OR REPLACE FUNCTION public.reactiver_fournisseur(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE s public.suppliers;
BEGIN
  IF NOT (public.has_module_approve('purchases') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''approbation des achats requis pour reactiver un fournisseur' USING ERRCODE = '42501';
  END IF;
  IF public.texte_ou_null(p_motif) IS NULL THEN RAISE EXCEPTION 'Motif de la reactivation requis' USING ERRCODE = '22023'; END IF;
  s := public.fournisseur_existant(p_id);
  IF coalesce(s.active, true) THEN RAISE EXCEPTION 'Fournisseur deja actif' USING ERRCODE = '22023'; END IF;
  UPDATE public.suppliers SET active = true, suspendu_le = NULL, suspendu_par = NULL, motif_suspension = NULL, updated_at = now()
   WHERE id = p_id;
  PERFORM public.journaliser_fournisseur(p_id, 'reactivation', p_motif,
    jsonb_build_object('suspendu_le', s.suspendu_le, 'motif_suspension', s.motif_suspension));
END;
$$;

CREATE OR REPLACE FUNCTION public.enregistrer_contact_fournisseur(
  p_fournisseur uuid, p_nom text, p_fonction text DEFAULT NULL, p_telephone text DEFAULT NULL, p_email text DEFAULT NULL,
  p_principal boolean DEFAULT false, p_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE c public.contacts_fournisseurs; v_id uuid; v_email text := public.texte_ou_null(p_email); v_tel text := public.texte_ou_null(p_telephone);
BEGIN
  PERFORM public.exiger_ecriture_achats();
  PERFORM public.fournisseur_existant(p_fournisseur);
  IF public.texte_ou_null(p_nom) IS NULL THEN RAISE EXCEPTION 'Nom du contact requis' USING ERRCODE = '22023'; END IF;
  IF v_email IS NULL AND v_tel IS NULL THEN RAISE EXCEPTION 'Telephone ou adresse electronique requis' USING ERRCODE = '22023'; END IF;
  IF v_email IS NOT NULL AND v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Adresse electronique invalide' USING ERRCODE = '22023';
  END IF;
  IF p_id IS NOT NULL THEN
    SELECT * INTO c FROM public.contacts_fournisseurs WHERE id = p_id AND supplier_id = p_fournisseur FOR UPDATE;
    IF NOT FOUND OR NOT c.actif THEN RAISE EXCEPTION 'Contact introuvable ou retire' USING ERRCODE = '22023'; END IF;
  END IF;
  IF coalesce(p_principal, false) THEN
    UPDATE public.contacts_fournisseurs SET principal = false, modifie_le = now()
     WHERE supplier_id = p_fournisseur AND principal AND actif AND id IS DISTINCT FROM p_id;
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.contacts_fournisseurs (supplier_id, nom, fonction, telephone, email, principal, cree_par)
    VALUES (p_fournisseur, btrim(p_nom), public.texte_ou_null(p_fonction), v_tel, v_email, coalesce(p_principal, false), auth.uid())
    RETURNING id INTO v_id;
  ELSE
    v_id := p_id;
    UPDATE public.contacts_fournisseurs SET nom = btrim(p_nom), fonction = public.texte_ou_null(p_fonction), telephone = v_tel, email = v_email,
      principal = coalesce(p_principal, false), modifie_le = now() WHERE id = p_id;
  END IF;
  PERFORM public.journaliser_fournisseur(p_fournisseur, 'contact', NULL,
    jsonb_build_object('contact', v_id, 'nom', btrim(p_nom), 'principal', coalesce(p_principal, false), 'modification', p_id IS NOT NULL));
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.retirer_contact_fournisseur(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE c public.contacts_fournisseurs;
BEGIN
  PERFORM public.exiger_ecriture_achats();
  IF public.texte_ou_null(p_motif) IS NULL THEN RAISE EXCEPTION 'Motif du retrait requis' USING ERRCODE = '22023'; END IF;
  SELECT * INTO c FROM public.contacts_fournisseurs WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT c.actif THEN RAISE EXCEPTION 'Contact introuvable ou deja retire' USING ERRCODE = '22023'; END IF;
  UPDATE public.contacts_fournisseurs SET actif = false, principal = false, motif_retrait = btrim(p_motif), modifie_le = now() WHERE id = p_id;
  PERFORM public.journaliser_fournisseur(c.supplier_id, 'retrait_contact', p_motif, jsonb_build_object('contact', p_id, 'nom', c.nom));
END;
$$;

CREATE OR REPLACE FUNCTION public.definir_categorie_fournisseur(p_libelle text, p_id uuid DEFAULT NULL, p_actif boolean DEFAULT true)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid; v_lib text := public.texte_ou_null(p_libelle);
BEGIN
  PERFORM public.exiger_ecriture_achats();
  IF v_lib IS NULL THEN RAISE EXCEPTION 'Libelle de la categorie requis' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.categories_fournisseurs c WHERE lower(btrim(c.libelle)) = lower(v_lib) AND c.id IS DISTINCT FROM p_id) THEN
    RAISE EXCEPTION 'Categorie « % » deja definie', v_lib USING ERRCODE = '23505';
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.categories_fournisseurs (libelle, actif, cree_par) VALUES (v_lib, coalesce(p_actif, true), auth.uid()) RETURNING id INTO v_id;
  ELSE
    UPDATE public.categories_fournisseurs SET libelle = v_lib, actif = coalesce(p_actif, true) WHERE id = p_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Categorie introuvable' USING ERRCODE = '22023'; END IF;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.classer_fournisseur(p_fournisseur uuid, p_categories uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_avant uuid[]; v_cibles uuid[] := ARRAY(SELECT DISTINCT x FROM unnest(coalesce(p_categories, '{}'::uuid[])) AS x WHERE x IS NOT NULL);
BEGIN
  PERFORM public.exiger_ecriture_achats();
  PERFORM public.fournisseur_existant(p_fournisseur);
  IF EXISTS (SELECT 1 FROM unnest(v_cibles) AS x
              WHERE NOT EXISTS (SELECT 1 FROM public.categories_fournisseurs c WHERE c.id = x AND c.actif)
                AND NOT EXISTS (SELECT 1 FROM public.fournisseurs_categories fc WHERE fc.supplier_id = p_fournisseur AND fc.categorie_id = x)) THEN
    RAISE EXCEPTION 'Categorie introuvable ou inactive' USING ERRCODE = '22023';
  END IF;
  v_avant := ARRAY(SELECT categorie_id FROM public.fournisseurs_categories WHERE supplier_id = p_fournisseur ORDER BY 1);
  DELETE FROM public.fournisseurs_categories WHERE supplier_id = p_fournisseur AND NOT (categorie_id = ANY (v_cibles));
  INSERT INTO public.fournisseurs_categories (supplier_id, categorie_id)
  SELECT p_fournisseur, x FROM unnest(v_cibles) AS x ON CONFLICT DO NOTHING;
  PERFORM public.journaliser_fournisseur(p_fournisseur, 'categories', NULL,
    jsonb_build_object('avant', to_jsonb(v_avant), 'apres', to_jsonb(ARRAY(SELECT x FROM unnest(v_cibles) AS x ORDER BY 1))));
END;
$$;

CREATE OR REPLACE FUNCTION public.enregistrer_document_fournisseur(
  p_fournisseur uuid, p_type text, p_reference_piece text, p_numero text DEFAULT NULL, p_date_emission date DEFAULT NULL,
  p_date_expiration date DEFAULT NULL, p_libelle text DEFAULT NULL, p_observation text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.exiger_ecriture_achats();
  PERFORM public.fournisseur_existant(p_fournisseur);
  IF p_type IS NULL OR p_type NOT IN ('rccm', 'nif', 'attestation_fiscale', 'attestation_cnss', 'assurance', 'agrement', 'contrat_cadre', 'autre') THEN
    RAISE EXCEPTION 'Type de document inconnu' USING ERRCODE = '22023';
  END IF;
  IF p_type = 'autre' AND public.texte_ou_null(p_libelle) IS NULL THEN
    RAISE EXCEPTION 'Libelle requis pour un document de type autre' USING ERRCODE = '22023';
  END IF;
  IF public.texte_ou_null(p_reference_piece) IS NULL THEN
    RAISE EXCEPTION 'Reference de la piece requise (classement papier ou electronique)' USING ERRCODE = '22023';
  END IF;
  IF p_date_emission IS NOT NULL AND p_date_emission > current_date THEN
    RAISE EXCEPTION 'Date d''emission dans le futur' USING ERRCODE = '22023';
  END IF;
  IF p_date_expiration IS NOT NULL AND p_date_emission IS NOT NULL AND p_date_expiration < p_date_emission THEN
    RAISE EXCEPTION 'Date d''expiration anterieure a la date d''emission' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.documents_fournisseurs (supplier_id, type_document, libelle, numero, date_emission, date_expiration, reference_piece,
                                             observation, enregistre_par)
  VALUES (p_fournisseur, p_type, public.texte_ou_null(p_libelle), public.texte_ou_null(p_numero), p_date_emission, p_date_expiration,
          btrim(p_reference_piece), public.texte_ou_null(p_observation), auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.journaliser_fournisseur(p_fournisseur, 'document', NULL,
    jsonb_build_object('document', v_id, 'type', p_type, 'numero', public.texte_ou_null(p_numero), 'expiration', p_date_expiration));
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.retirer_document_fournisseur(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE d public.documents_fournisseurs;
BEGIN
  PERFORM public.exiger_ecriture_achats();
  IF public.texte_ou_null(p_motif) IS NULL THEN RAISE EXCEPTION 'Motif du retrait requis' USING ERRCODE = '22023'; END IF;
  SELECT * INTO d FROM public.documents_fournisseurs WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR d.retire_le IS NOT NULL THEN RAISE EXCEPTION 'Document introuvable ou deja retire' USING ERRCODE = '22023'; END IF;
  UPDATE public.documents_fournisseurs SET retire_le = now(), retire_par = auth.uid(), motif_retrait = btrim(p_motif) WHERE id = p_id;
  PERFORM public.journaliser_fournisseur(d.supplier_id, 'retrait_document', p_motif, jsonb_build_object('document', p_id, 'type', d.type_document));
END;
$$;

-- 8. Evaluation
CREATE OR REPLACE FUNCTION public.definir_critere_evaluation(
  p_libelle text, p_poids integer, p_description text DEFAULT NULL, p_ordre integer DEFAULT 0, p_actif boolean DEFAULT true, p_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Grille d''evaluation : administrateur seulement' USING ERRCODE = '42501'; END IF;
  IF public.texte_ou_null(p_libelle) IS NULL THEN RAISE EXCEPTION 'Libelle du critere requis' USING ERRCODE = '22023'; END IF;
  IF p_poids IS NULL OR p_poids <= 0 THEN RAISE EXCEPTION 'Poids du critere : entier positif requis' USING ERRCODE = '22023'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.criteres_evaluation_fournisseur (libelle, description, poids, ordre, actif, cree_par)
    VALUES (btrim(p_libelle), public.texte_ou_null(p_description), p_poids, coalesce(p_ordre, 0), coalesce(p_actif, true), auth.uid())
    RETURNING id INTO v_id;
  ELSE
    -- Les evaluations passees gardent le libelle et le poids figes.
    UPDATE public.criteres_evaluation_fournisseur SET libelle = btrim(p_libelle), description = public.texte_ou_null(p_description),
      poids = p_poids, ordre = coalesce(p_ordre, 0), actif = coalesce(p_actif, true)
     WHERE id = p_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Critere introuvable' USING ERRCODE = '22023'; END IF;
  END IF;
  RETURN v_id;
END;
$$;

-- p_notes : [{"critere": uuid, "note": 1..5, "observation": text}]
CREATE OR REPLACE FUNCTION public.evaluer_fournisseur(
  p_fournisseur uuid, p_debut date, p_fin date, p_notes jsonb, p_commentaire text DEFAULT NULL, p_motif_correction text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid; v_prec uuid; n jsonb; cr public.criteres_evaluation_fournisseur; v_note integer;
        v_somme bigint := 0; v_poids bigint := 0; v_vus uuid[] := '{}';
BEGIN
  PERFORM public.exiger_ecriture_achats();
  PERFORM public.fournisseur_existant(p_fournisseur);
  IF p_debut IS NULL OR p_fin IS NULL OR p_fin < p_debut THEN RAISE EXCEPTION 'Periode evaluee invalide' USING ERRCODE = '22023'; END IF;
  IF p_fin > current_date THEN RAISE EXCEPTION 'Une periode future ne s''evalue pas' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.criteres_evaluation_fournisseur WHERE actif) THEN
    RAISE EXCEPTION 'Aucun critere d''evaluation actif : grille a definir par l''administrateur' USING ERRCODE = '22023';
  END IF;
  IF p_notes IS NULL OR jsonb_typeof(p_notes) <> 'array' THEN RAISE EXCEPTION 'Notes requises' USING ERRCODE = '22023'; END IF;
  SELECT e.id INTO v_prec FROM public.evaluations_fournisseurs e
   WHERE e.supplier_id = p_fournisseur AND e.periode_debut = p_debut AND e.periode_fin = p_fin
     AND NOT EXISTS (SELECT 1 FROM public.evaluations_fournisseurs r WHERE r.remplace_id = e.id)
   ORDER BY e.evalue_le DESC LIMIT 1;
  IF v_prec IS NOT NULL AND public.texte_ou_null(p_motif_correction) IS NULL THEN
    RAISE EXCEPTION 'Periode deja evaluee : motif de correction requis' USING ERRCODE = '22023';
  END IF;
  -- Premier passage : controle des notes et moyenne ponderee.
  FOR n IN SELECT * FROM jsonb_array_elements(p_notes) LOOP
    SELECT * INTO cr FROM public.criteres_evaluation_fournisseur WHERE id = nullif(n ->> 'critere', '')::uuid AND actif;
    IF NOT FOUND THEN RAISE EXCEPTION 'Critere inconnu ou inactif' USING ERRCODE = '22023'; END IF;
    IF cr.id = ANY (v_vus) THEN RAISE EXCEPTION 'Critere « % » note deux fois', cr.libelle USING ERRCODE = '22023'; END IF;
    v_note := CASE WHEN (n ->> 'note') ~ '^[0-9]+$' THEN (n ->> 'note')::integer END;
    IF v_note IS NULL OR v_note < 1 OR v_note > 5 THEN
      RAISE EXCEPTION 'Critere « % » : note de 1 a 5 requise', cr.libelle USING ERRCODE = '22023';
    END IF;
    v_vus := v_vus || cr.id;
    v_somme := v_somme + v_note * cr.poids;
    v_poids := v_poids + cr.poids;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.criteres_evaluation_fournisseur c WHERE c.actif AND NOT (c.id = ANY (v_vus))) THEN
    RAISE EXCEPTION 'Chaque critere actif doit etre note' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.evaluations_fournisseurs (supplier_id, periode_debut, periode_fin, note_globale, commentaire, remplace_id, motif_correction, evalue_par)
  VALUES (p_fournisseur, p_debut, p_fin, round(v_somme::numeric / v_poids, 2), public.texte_ou_null(p_commentaire), v_prec,
          CASE WHEN v_prec IS NOT NULL THEN btrim(p_motif_correction) END, auth.uid())
  RETURNING id INTO v_id;
  -- Second passage : notes, avec libelle et poids figes.
  INSERT INTO public.evaluations_fournisseurs_notes (evaluation_id, critere_id, libelle, poids, note, observation)
  SELECT v_id, c.id, c.libelle, c.poids, (x.e ->> 'note')::integer, public.texte_ou_null(x.e ->> 'observation')
    FROM jsonb_array_elements(p_notes) AS x(e)
    JOIN public.criteres_evaluation_fournisseur c ON c.id = (x.e ->> 'critere')::uuid;
  PERFORM public.journaliser_fournisseur(p_fournisseur, 'evaluation', p_motif_correction,
    jsonb_build_object('evaluation', v_id, 'debut', p_debut, 'fin', p_fin, 'note_globale', round(v_somme::numeric / v_poids, 2), 'remplace', v_prec));
  RETURN v_id;
END;
$$;

-- 9. Consultations
CREATE OR REPLACE FUNCTION public.consultation_ecrivable(p_id uuid)
RETURNS public.consultations_fournisseurs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE c public.consultations_fournisseurs;
BEGIN
  PERFORM public.exiger_ecriture_achats();
  SELECT * INTO c FROM public.consultations_fournisseurs WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Consultation introuvable' USING ERRCODE = '22023'; END IF;
  IF c.warehouse_id IS NOT NULL AND NOT public.bon_commande_permis(c.warehouse_id) THEN
    RAISE EXCEPTION 'Consultation hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  RETURN c;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.consultation_ecrivable(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.inviter_fournisseur_interne(p_consultation uuid, p_fournisseur uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE s public.suppliers;
BEGIN
  SELECT * INTO s FROM public.suppliers WHERE id = p_fournisseur;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fournisseur introuvable' USING ERRCODE = '22023'; END IF;
  IF NOT coalesce(s.active, true) THEN RAISE EXCEPTION 'Fournisseur % suspendu : non consultable', s.company_name USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.consultations_invites WHERE consultation_id = p_consultation AND supplier_id = p_fournisseur) THEN
    RAISE EXCEPTION 'Fournisseur % deja consulte', s.company_name USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.consultations_invites (consultation_id, supplier_id, invite_par) VALUES (p_consultation, p_fournisseur, auth.uid());
  PERFORM public.journaliser_consultation(p_consultation, 'invitation', NULL, jsonb_build_object('fournisseur', p_fournisseur, 'nom', s.company_name));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.inviter_fournisseur_interne(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- p_lignes : [{"article": uuid|null, "designation": text|null, "quantite": int}]
CREATE OR REPLACE FUNCTION public.creer_consultation(
  p_objet text, p_lignes jsonb, p_fournisseurs uuid[], p_depot uuid DEFAULT NULL, p_date_limite date DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid; v_numero text; l jsonb; a public.stock_items; v_q integer; v_des text; v_ordre integer := 0; f uuid;
BEGIN
  PERFORM public.exiger_ecriture_achats();
  IF public.texte_ou_null(p_objet) IS NULL THEN RAISE EXCEPTION 'Objet de la consultation requis' USING ERRCODE = '22023'; END IF;
  IF p_depot IS NOT NULL THEN PERFORM public.depot_ecrivable(p_depot); END IF;
  IF p_date_limite IS NOT NULL AND p_date_limite < current_date THEN
    RAISE EXCEPTION 'Date limite de reponse deja passee' USING ERRCODE = '22023';
  END IF;
  IF p_lignes IS NULL OR jsonb_typeof(p_lignes) <> 'array' OR jsonb_array_length(p_lignes) = 0 THEN
    RAISE EXCEPTION 'Au moins une ligne requise' USING ERRCODE = '22023';
  END IF;
  IF p_fournisseurs IS NULL OR cardinality(p_fournisseurs) = 0 THEN
    RAISE EXCEPTION 'Au moins un fournisseur consulte requis' USING ERRCODE = '22023';
  END IF;
  v_numero := 'CONS-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.consultations_numero_seq')::text, 5, '0');
  INSERT INTO public.consultations_fournisseurs (numero, objet, warehouse_id, date_limite, note, cree_par)
  VALUES (v_numero, btrim(p_objet), p_depot, p_date_limite, public.texte_ou_null(p_note), auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.journaliser_consultation(v_id, 'creation', NULL, jsonb_build_object('numero', v_numero, 'lignes', jsonb_array_length(p_lignes)));
  FOR l IN SELECT * FROM jsonb_array_elements(p_lignes) LOOP
    v_q := CASE WHEN (l ->> 'quantite') ~ '^[0-9]+$' THEN (l ->> 'quantite')::integer END;
    IF v_q IS NULL OR v_q <= 0 THEN RAISE EXCEPTION 'Quantite positive requise sur chaque ligne' USING ERRCODE = '22023'; END IF;
    v_des := public.texte_ou_null(l ->> 'designation');
    a := NULL;
    IF nullif(l ->> 'article', '') IS NOT NULL THEN
      SELECT * INTO a FROM public.stock_items WHERE id = (l ->> 'article')::uuid;
      IF NOT FOUND OR NOT coalesce(a.active, true) THEN RAISE EXCEPTION 'Article introuvable ou archive' USING ERRCODE = '22023'; END IF;
      v_des := coalesce(v_des, a.name);
    END IF;
    IF v_des IS NULL THEN RAISE EXCEPTION 'Article ou designation requis sur chaque ligne' USING ERRCODE = '22023'; END IF;
    v_ordre := v_ordre + 1;
    INSERT INTO public.consultations_lignes (consultation_id, ordre, stock_item_id, designation, quantite) VALUES (v_id, v_ordre, a.id, v_des, v_q);
  END LOOP;
  FOREACH f IN ARRAY ARRAY(SELECT DISTINCT x FROM unnest(p_fournisseurs) AS x WHERE x IS NOT NULL) LOOP
    PERFORM public.inviter_fournisseur_interne(v_id, f);
  END LOOP;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.inviter_fournisseur_consultation(p_consultation uuid, p_fournisseur uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE c public.consultations_fournisseurs;
BEGIN
  c := public.consultation_ecrivable(p_consultation);
  IF c.statut <> 'ouverte' THEN RAISE EXCEPTION 'Consultation close' USING ERRCODE = '22023'; END IF;
  PERFORM public.inviter_fournisseur_interne(p_consultation, p_fournisseur);
END;
$$;

-- p_lignes : [{"ligne": uuid, "prix_unitaire": int}] ; une ligne absente
-- n'est pas chiffree par le fournisseur.
CREATE OR REPLACE FUNCTION public.enregistrer_offre(
  p_consultation uuid, p_fournisseur uuid, p_lignes jsonb, p_delai_jours integer, p_recue_le date DEFAULT current_date,
  p_reference text DEFAULT NULL, p_validite date DEFAULT NULL, p_conditions text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE c public.consultations_fournisseurs; cl public.consultations_lignes; l jsonb; v_id uuid; v_pu bigint;
        v_total bigint := 0; v_nb integer := 0; v_vues uuid[] := '{}';
BEGIN
  c := public.consultation_ecrivable(p_consultation);
  IF c.statut <> 'ouverte' THEN RAISE EXCEPTION 'Consultation close : offre non recevable' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.consultations_invites WHERE consultation_id = p_consultation AND supplier_id = p_fournisseur) THEN
    RAISE EXCEPTION 'Fournisseur non consulte : l''inviter d''abord' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = p_fournisseur AND coalesce(s.active, true)) THEN
    RAISE EXCEPTION 'Fournisseur suspendu : offre non recevable' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.offres_fournisseurs WHERE consultation_id = p_consultation AND supplier_id = p_fournisseur AND statut <> 'retiree') THEN
    RAISE EXCEPTION 'Offre deja saisie pour ce fournisseur : la retirer (motif) avant de la ressaisir' USING ERRCODE = '22023';
  END IF;
  IF p_delai_jours IS NULL OR p_delai_jours < 0 THEN RAISE EXCEPTION 'Delai de livraison (jours) requis' USING ERRCODE = '22023'; END IF;
  IF p_recue_le IS NULL OR p_recue_le > current_date THEN RAISE EXCEPTION 'Date de reception de l''offre requise, pas dans le futur' USING ERRCODE = '22023'; END IF;
  IF p_validite IS NOT NULL AND p_validite < p_recue_le THEN RAISE EXCEPTION 'Validite anterieure a la reception' USING ERRCODE = '22023'; END IF;
  IF p_lignes IS NULL OR jsonb_typeof(p_lignes) <> 'array' OR jsonb_array_length(p_lignes) = 0 THEN
    RAISE EXCEPTION 'Au moins une ligne chiffree requise' USING ERRCODE = '22023';
  END IF;
  -- Premier passage : controle des lignes et montant de l'offre.
  FOR l IN SELECT * FROM jsonb_array_elements(p_lignes) LOOP
    SELECT * INTO cl FROM public.consultations_lignes WHERE id = nullif(l ->> 'ligne', '')::uuid AND consultation_id = p_consultation;
    IF NOT FOUND THEN RAISE EXCEPTION 'Ligne etrangere a la consultation' USING ERRCODE = '22023'; END IF;
    IF cl.id = ANY (v_vues) THEN RAISE EXCEPTION 'Ligne « % » chiffree deux fois', cl.designation USING ERRCODE = '22023'; END IF;
    v_pu := CASE WHEN (l ->> 'prix_unitaire') ~ '^[0-9]+$' THEN (l ->> 'prix_unitaire')::bigint END;
    IF v_pu IS NULL THEN RAISE EXCEPTION 'Ligne « % » : prix unitaire requis', cl.designation USING ERRCODE = '22023'; END IF;
    v_vues := v_vues || cl.id;
    v_total := v_total + v_pu * cl.quantite;
    v_nb := v_nb + 1;
  END LOOP;
  INSERT INTO public.offres_fournisseurs (consultation_id, supplier_id, reference_offre, recue_le, delai_livraison_jours, validite_jusqu_au,
                                          conditions, montant_total, lignes_chiffrees, saisi_par)
  VALUES (p_consultation, p_fournisseur, public.texte_ou_null(p_reference), p_recue_le, p_delai_jours, p_validite,
          public.texte_ou_null(p_conditions), v_total, v_nb, auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO public.offres_lignes (offre_id, consultation_ligne_id, prix_unitaire)
  SELECT v_id, (x.e ->> 'ligne')::uuid, (x.e ->> 'prix_unitaire')::bigint FROM jsonb_array_elements(p_lignes) AS x(e);
  PERFORM public.journaliser_consultation(p_consultation, 'offre', NULL,
    jsonb_build_object('offre', v_id, 'fournisseur', p_fournisseur, 'montant', v_total, 'delai_jours', p_delai_jours, 'lignes', v_nb));
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.retirer_offre(p_offre uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE o public.offres_fournisseurs; c public.consultations_fournisseurs;
BEGIN
  IF public.texte_ou_null(p_motif) IS NULL THEN RAISE EXCEPTION 'Motif du retrait requis' USING ERRCODE = '22023'; END IF;
  SELECT * INTO o FROM public.offres_fournisseurs WHERE id = p_offre;
  IF NOT FOUND THEN RAISE EXCEPTION 'Offre introuvable' USING ERRCODE = '22023'; END IF;
  c := public.consultation_ecrivable(o.consultation_id);
  IF c.statut <> 'ouverte' OR o.statut <> 'recue' THEN RAISE EXCEPTION 'Seule une offre recue d''une consultation ouverte se retire' USING ERRCODE = '22023'; END IF;
  UPDATE public.offres_fournisseurs SET statut = 'retiree', motif_retrait = btrim(p_motif), retire_par = auth.uid(), retire_le = now() WHERE id = p_offre;
  PERFORM public.journaliser_consultation(o.consultation_id, 'retrait_offre', p_motif, jsonb_build_object('offre', p_offre, 'fournisseur', o.supplier_id));
END;
$$;

-- Prepare le bon de commande brouillon de l'offre retenue par le circuit
-- D-053 (enregistrer_bon_commande) : lignes chiffrees, prix de l'offre,
-- livraison prevue a la date du jour plus le delai annonce.
CREATE OR REPLACE FUNCTION public.preparer_bon_commande_consultation(p_consultation uuid, p_depot uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE c public.consultations_fournisseurs; o public.offres_fournisseurs; v_depot uuid; v_lignes jsonb; v_bon uuid;
BEGIN
  c := public.consultation_ecrivable(p_consultation);
  IF c.statut <> 'attribuee' OR c.offre_retenue_id IS NULL THEN
    RAISE EXCEPTION 'Aucune offre retenue sur cette consultation' USING ERRCODE = '22023';
  END IF;
  IF c.purchase_order_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = c.purchase_order_id AND po.status NOT IN ('rejected', 'cancelled')) THEN
    RAISE EXCEPTION 'Un bon de commande issu de cette consultation est deja en cours' USING ERRCODE = '22023';
  END IF;
  v_depot := coalesce(p_depot, c.warehouse_id);
  IF v_depot IS NULL THEN RAISE EXCEPTION 'Depot de livraison requis pour preparer le bon de commande' USING ERRCODE = '22023'; END IF;
  SELECT * INTO o FROM public.offres_fournisseurs WHERE id = c.offre_retenue_id;
  SELECT jsonb_agg(jsonb_build_object('article', cl.stock_item_id, 'designation', cl.designation, 'quantite', cl.quantite,
                                      'prix_unitaire', ol.prix_unitaire) ORDER BY cl.ordre)
    INTO v_lignes
    FROM public.offres_lignes ol JOIN public.consultations_lignes cl ON cl.id = ol.consultation_ligne_id
   WHERE ol.offre_id = o.id;
  v_bon := public.enregistrer_bon_commande(o.supplier_id, v_depot, v_lignes, NULL, current_date + o.delai_livraison_jours, 0,
    'Consultation ' || c.numero || coalesce(' / offre ' || o.reference_offre, ''));
  UPDATE public.consultations_fournisseurs SET purchase_order_id = v_bon, warehouse_id = v_depot WHERE id = p_consultation;
  PERFORM public.journaliser_consultation(p_consultation, 'bon_commande', NULL,
    jsonb_build_object('bon', v_bon, 'numero', (SELECT po.po_number FROM public.purchase_orders po WHERE po.id = v_bon)));
  RETURN v_bon;
END;
$$;

CREATE OR REPLACE FUNCTION public.selectionner_offre(p_offre uuid, p_motif text, p_preparer_bon boolean DEFAULT true)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE o public.offres_fournisseurs; c public.consultations_fournisseurs; v_min integer; v_nb integer;
BEGIN
  IF public.texte_ou_null(p_motif) IS NULL THEN RAISE EXCEPTION 'Motif de la selection requis' USING ERRCODE = '22023'; END IF;
  SELECT * INTO o FROM public.offres_fournisseurs WHERE id = p_offre;
  IF NOT FOUND THEN RAISE EXCEPTION 'Offre introuvable' USING ERRCODE = '22023'; END IF;
  c := public.consultation_ecrivable(o.consultation_id);
  IF c.statut <> 'ouverte' THEN RAISE EXCEPTION 'Consultation deja attribuee ou annulee' USING ERRCODE = '22023'; END IF;
  IF o.statut <> 'recue' THEN RAISE EXCEPTION 'Offre retiree : non selectionnable' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = o.supplier_id AND coalesce(s.active, true)) THEN
    RAISE EXCEPTION 'Fournisseur suspendu : offre non selectionnable' USING ERRCODE = '22023';
  END IF;
  v_min := public.reglage_entier('consultation_offres_minimum', 1);
  SELECT count(*) INTO v_nb FROM public.offres_fournisseurs WHERE consultation_id = c.id AND statut = 'recue';
  IF v_nb < v_min THEN
    RAISE EXCEPTION 'Selection impossible : % offre(s) recue(s), % exigee(s) (reglage consultation_offres_minimum)', v_nb, v_min USING ERRCODE = '22023';
  END IF;
  UPDATE public.offres_fournisseurs SET statut = CASE WHEN id = p_offre THEN 'retenue' ELSE 'ecartee' END
   WHERE consultation_id = c.id AND statut = 'recue';
  UPDATE public.consultations_fournisseurs SET statut = 'attribuee', offre_retenue_id = p_offre, motif_selection = btrim(p_motif),
    selection_par = auth.uid(), selection_le = now() WHERE id = c.id;
  PERFORM public.journaliser_consultation(c.id, 'selection', p_motif,
    jsonb_build_object('offre', p_offre, 'fournisseur', o.supplier_id, 'montant', o.montant_total, 'offres_recues', v_nb));
  IF coalesce(p_preparer_bon, true) THEN
    RETURN public.preparer_bon_commande_consultation(c.id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.annuler_consultation(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE c public.consultations_fournisseurs;
BEGIN
  IF public.texte_ou_null(p_motif) IS NULL THEN RAISE EXCEPTION 'Motif de l''annulation requis' USING ERRCODE = '22023'; END IF;
  c := public.consultation_ecrivable(p_id);
  IF c.statut <> 'ouverte' THEN RAISE EXCEPTION 'Seule une consultation ouverte s''annule' USING ERRCODE = '22023'; END IF;
  UPDATE public.consultations_fournisseurs SET statut = 'annulee', motif_annulation = btrim(p_motif), annule_par = auth.uid(), annule_le = now()
   WHERE id = p_id;
  PERFORM public.journaliser_consultation(p_id, 'annulation', p_motif);
END;
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'enregistrer_fournisseur(text, text, uuid, text, text, text, text, text, text, text, text, text)',
    'suspendre_fournisseur(uuid, text)',
    'reactiver_fournisseur(uuid, text)',
    'enregistrer_contact_fournisseur(uuid, text, text, text, text, boolean, uuid)',
    'retirer_contact_fournisseur(uuid, text)',
    'definir_categorie_fournisseur(text, uuid, boolean)',
    'classer_fournisseur(uuid, uuid[])',
    'enregistrer_document_fournisseur(uuid, text, text, text, date, date, text, text)',
    'retirer_document_fournisseur(uuid, text)',
    'definir_critere_evaluation(text, integer, text, integer, boolean, uuid)',
    'evaluer_fournisseur(uuid, date, date, jsonb, text, text)',
    'creer_consultation(text, jsonb, uuid[], uuid, date, text)',
    'inviter_fournisseur_consultation(uuid, uuid)',
    'enregistrer_offre(uuid, uuid, jsonb, integer, date, text, date, text)',
    'retirer_offre(uuid, text)',
    'preparer_bon_commande_consultation(uuid, uuid)',
    'selectionner_offre(uuid, text, boolean)',
    'annuler_consultation(uuid, text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- 10. Vues (RLS de l'appelant)
CREATE OR REPLACE VIEW public.v_documents_fournisseurs_echeance WITH (security_invoker = true) AS
SELECT d.id, d.supplier_id, s.company_name, d.type_document, d.libelle, d.numero, d.reference_piece, d.date_expiration,
       (d.date_expiration - current_date) AS jours_restants,
       CASE WHEN d.date_expiration < current_date THEN 'expire' ELSE 'a_renouveler' END AS etat
  FROM public.documents_fournisseurs d JOIN public.suppliers s ON s.id = d.supplier_id
 WHERE d.retire_le IS NULL AND d.date_expiration IS NOT NULL
   AND d.date_expiration <= current_date + public.delai_alerte_documents_fournisseurs()
   AND NOT EXISTS (SELECT 1 FROM public.documents_fournisseurs n
                    WHERE n.supplier_id = d.supplier_id AND n.type_document = d.type_document AND coalesce(n.libelle, '') = coalesce(d.libelle, '')
                      AND n.retire_le IS NULL AND n.id <> d.id AND (n.date_expiration IS NULL OR n.date_expiration > d.date_expiration));

CREATE OR REPLACE VIEW public.v_evaluations_fournisseurs_courantes WITH (security_invoker = true) AS
SELECT e.*
  FROM public.evaluations_fournisseurs e
 WHERE NOT EXISTS (SELECT 1 FROM public.evaluations_fournisseurs r WHERE r.remplace_id = e.id);

REVOKE ALL ON public.v_documents_fournisseurs_echeance, public.v_evaluations_fournisseurs_courantes FROM anon;
GRANT SELECT ON public.v_documents_fournisseurs_echeance, public.v_evaluations_fournisseurs_courantes TO authenticated;
