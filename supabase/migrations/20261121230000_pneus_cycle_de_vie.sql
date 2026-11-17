/*
  # Gestion du cycle de vie des pneus (D-091, lot 12, module 12)

  Etend D-052 et D-067 sans second registre : `tires` reste le registre des
  carcasses, `pneus_operations` le journal append-only dont l'etat, l'engin,
  la position et le site sont recalcules (`recalculer_pneu`).

  1. Carcasse a identite permanente : `code_sigtb` (PN-NNNNNN, genere,
     jamais reutilise), `numero_serie` fabricant unique quand il est fourni ;
     creation sans numero seulement avec motif (`creer_carcasse_pneu`).
     Caracteristiques (construction, indices, application, fabrication, DOT,
     commande, facture, source du prix, garantie, profondeur initiale).
     Reprise : code genere pour chaque pneu existant, numero saisi recopie
     en numero de serie, profondeur initiale reprise de l'entree.
  2. Episodes de service (`v_pneus_episodes`), derives du journal : neuf,
     apres reparation, apres rechapage n. Un rechapage ne cree jamais de
     carcasse.
  3. Configurations de positions par modele d'engin (`pneus_configurations`,
     `pneus_configuration_positions`) : aucune configuration par defaut ;
     une position a un code stable ; dimensions admises.
  4. Montage controle (verrou de l'engin, position, dimension, etat,
     intervention en cours, perimetre, blocage de securite configurable),
     permutation, demontage, transfert.
  5. Inspections detaillees (`pneus_inspections`) : date reelle, mesures par
     zone, pression et temperature si mesurees, constats, nature,
     recommandation. Analyse d'usure (`v_pneus_usure`) seulement si les
     seuils et l'historique le permettent.
  6. Interventions (`pneus_interventions`) : reparation, vulcanisation,
     rechapage, expertise, autre ; numero unique, cycle de rechapage,
     criteres d'acceptation configurables, controle, decision de remise en
     service par un approbateur distinct (`separation_violee`).
  7. Stock et mouvements calcules (`v_pneus_stock`, `v_pneus_mouvements`) ;
     aucun solde modifiable. Couts par categorie (`v_pneus_couts`) avec la
     part deja comptee par les achats (D-082). Indicateurs au km, a l'heure
     et a la tonne seulement sur donnees completes (`v_pneus_indicateurs`).
  8. Alertes pneus au catalogue D-068 (13 regles) ; blocages de montage et
     de remise en service desactives par defaut ; proposition
     d'immobilisation, jamais automatique (decision humaine, puis
     `declarer_immobilisation`).
  9. Pieces jointes D-083 etendues aux pneus, inspections et interventions.
  10. Idempotence par cle client (`pneus_requetes_client`).

  Fonctions recreees depuis leur derniere definition sur main :
  `valider_reglage` (20261121150000), `catalogue_regles_alertes` et
  `v_alertes_candidates` (20261121150000, reprises a l'identique, branches
  pneus ajoutees), `piece_resoudre_objet` et `piece_objet_lisible`
  (20261121200000), `recalculer_pneu`, `monter_pneu`, `demonter_pneu`,
  `permuter_pneu`, `rechaper_pneu`, `reparer_pneu` (20261116210000),
  `v_pneus` (20261120101000). `monter_pneu` et `demonter_pneu` recoivent un
  parametre facultatif en fin (`p_cle_client`) : ancienne signature retiree,
  appels positionnels et par nom inchanges. Idempotent.
*/

-- ===================================================================
-- 0. Reglages : blocages (desactives par defaut) et alertes pneus
-- ===================================================================

-- Reprise de 20261121150000 (D-068), plus les cles D-091.
CREATE OR REPLACE FUNCTION public.valider_reglage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE v text := NEW.value ->> 'value';
BEGIN
  IF NEW.key IN ('mfa_exige', 'carburant_validation_separee', 'kilometrage_validation_separee',
                 'achats_validation_separee', 'paiements_validation_separee', 'controle_depart_exige',
                 'planification_cloture_separee', 'clauses_renonciation_separee',
                 'alerte_intervention_retard_active', 'alerte_controle_non_conforme_active', 'alerte_document_expire_active',
                 'alerte_action_corrective_retard_active', 'alerte_epi_echu_active', 'alerte_inspection_retard_active',
                 'pneu_blocage_montage_actif', 'pneu_blocage_remise_service_actif', 'pneu_configuration_exigee')
     OR NEW.key ~ '^alerte_pneu_[a-z_]+_active$' THEN
    IF v IS NULL OR v NOT IN ('true', 'false') THEN
      RAISE EXCEPTION 'Reglage % : valeur true ou false attendue', NEW.key USING ERRCODE = '22023';
    END IF;
  ELSIF NEW.key IN ('alerte_immobilisation_longue_h', 'alerte_ecart_carburant_l', 'alerte_voyage_sans_ticket_h') THEN
    IF v IS NULL OR v !~ '^\d+(\.\d+)?$' OR v::numeric <= 0 THEN
      RAISE EXCEPTION 'Reglage % : nombre strictement positif attendu', NEW.key USING ERRCODE = '22023';
    END IF;
  ELSIF NEW.key IN ('tolerance_poids_cbg_t', 'pneu_profondeur_min_mm', 'pneu_inspection_max_jours', 'pneu_reforme_precoce_km') THEN
    IF v IS NULL OR v !~ '^\d+(\.\d+)?$' THEN
      RAISE EXCEPTION 'Reglage % : nombre positif attendu', NEW.key USING ERRCODE = '22023';
    END IF;
  ELSIF NEW.key IN ('fournisseurs_alerte_documents_jours', 'consultation_offres_minimum', 'contrats_alerte_echeance_jours') THEN
    IF v IS NULL OR v !~ '^\d+$' OR (NEW.key = 'consultation_offres_minimum' AND v::integer < 1) THEN
      RAISE EXCEPTION 'Reglage % : nombre entier attendu (au moins 1 offre)', NEW.key USING ERRCODE = '22023';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Blocage ou exigence D-091 : actif seulement si le reglage vaut true.
CREATE OR REPLACE FUNCTION public.reglage_pneu_actif(p_cle text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce((SELECT (s.value ->> 'value') = 'true' FROM public.settings s
                    WHERE s.key = p_cle AND p_cle IN ('pneu_blocage_montage_actif', 'pneu_blocage_remise_service_actif',
                                                      'pneu_configuration_exigee')), false);
$$;
REVOKE EXECUTE ON FUNCTION public.reglage_pneu_actif(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reglage_pneu_actif(text) TO authenticated, service_role;

-- ===================================================================
-- 1. Normalisation
-- ===================================================================

CREATE OR REPLACE FUNCTION public.normaliser_texte_pneu(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$ SELECT nullif(upper(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g')), ''); $$;

CREATE OR REPLACE FUNCTION public.normaliser_dimension_pneu(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$ SELECT nullif(upper(regexp_replace(coalesce(p, ''), '\s+', '', 'g')), ''); $$;
GRANT EXECUTE ON FUNCTION public.normaliser_texte_pneu(text), public.normaliser_dimension_pneu(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.normaliser_texte_pneu(text), public.normaliser_dimension_pneu(text) FROM anon;

-- Nombre positif facultatif lu dans un jsonb : jamais de valeur supposee.
CREATE OR REPLACE FUNCTION public.pneu_nombre(p_valeur text, p_libelle text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF p_valeur IS NULL OR btrim(p_valeur) = '' THEN RETURN NULL; END IF;
  IF btrim(p_valeur) !~ '^\d+(\.\d+)?$' THEN
    RAISE EXCEPTION '% : nombre positif attendu', p_libelle USING ERRCODE = '22023';
  END IF;
  RETURN btrim(p_valeur)::numeric;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pneu_nombre(text, text) FROM PUBLIC, anon, authenticated;

-- ===================================================================
-- 2. Carcasse : identite permanente et caracteristiques
-- ===================================================================

-- Droits herites de la base (GRANT ALL a anon) : anon ne lit plus le registre.
REVOKE ALL ON public.tires FROM anon;
ALTER TABLE public.tires DROP CONSTRAINT IF EXISTS tires_status_check;
ALTER TABLE public.tires ADD CONSTRAINT tires_status_check
  CHECK (status IN ('active', 'stored', 'retired', 'damaged', 'en_intervention'));

ALTER TABLE public.tires
  ADD COLUMN IF NOT EXISTS code_sigtb text,
  ADD COLUMN IF NOT EXISTS numero_serie text,
  ADD COLUMN IF NOT EXISTS sans_numero_motif text,
  ADD COLUMN IF NOT EXISTS construction text,
  ADD COLUMN IF NOT EXISTS indice_charge text,
  ADD COLUMN IF NOT EXISTS indice_vitesse text,
  ADD COLUMN IF NOT EXISTS application text,
  ADD COLUMN IF NOT EXISTS date_fabrication date,
  ADD COLUMN IF NOT EXISTS code_dot text,
  ADD COLUMN IF NOT EXISTS commande_id uuid REFERENCES public.purchase_orders(id),
  ADD COLUMN IF NOT EXISTS facture_reference text,
  ADD COLUMN IF NOT EXISTS prix_source text,
  ADD COLUMN IF NOT EXISTS garantie_mois integer,
  ADD COLUMN IF NOT EXISTS garantie_km numeric,
  ADD COLUMN IF NOT EXISTS profondeur_initiale_mm numeric,
  ADD COLUMN IF NOT EXISTS cle_client text,
  ADD COLUMN IF NOT EXISTS cree_par uuid REFERENCES auth.users(id);
ALTER TABLE public.tires DROP CONSTRAINT IF EXISTS tires_d091_check;
ALTER TABLE public.tires ADD CONSTRAINT tires_d091_check CHECK (
  (construction IS NULL OR construction IN ('radiale', 'diagonale'))
  AND (prix_source IS NULL OR prix_source IN ('bon_commande', 'facture', 'saisie'))
  AND (prix_source IS DISTINCT FROM 'facture' OR nullif(btrim(coalesce(facture_reference, '')), '') IS NOT NULL)
  AND (garantie_mois IS NULL OR garantie_mois > 0) AND (garantie_km IS NULL OR garantie_km > 0)
  AND (profondeur_initiale_mm IS NULL OR profondeur_initiale_mm >= 0)
  AND (sans_numero_motif IS NULL OR (numero_serie IS NULL AND char_length(btrim(sans_numero_motif)) >= 5)));

CREATE SEQUENCE IF NOT EXISTS public.pneus_code_seq;
REVOKE ALL ON SEQUENCE public.pneus_code_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pneus_identite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.code_sigtb IS NULL THEN
      NEW.code_sigtb := 'PN-' || lpad(nextval('public.pneus_code_seq')::text, 6, '0');
    END IF;
    -- Numero saisi (D-052, D-067) = numero de serie fabricant, sauf creation sans numero.
    IF NEW.numero_serie IS NULL AND NEW.sans_numero_motif IS NULL AND NEW.tire_number IS DISTINCT FROM NEW.code_sigtb THEN
      NEW.numero_serie := upper(btrim(NEW.tire_number));
    END IF;
    NEW.cree_par := coalesce(NEW.cree_par, auth.uid());
  ELSIF NEW.tire_number IS DISTINCT FROM OLD.tire_number AND NEW.tire_number LIKE '%-ANNULE-%' THEN
    -- Reception annulee (D-067) : le numero saisi redevient disponible.
    NEW.numero_serie := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pneus_identite() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS pneus_identite ON public.tires;
CREATE TRIGGER pneus_identite BEFORE INSERT OR UPDATE OF tire_number ON public.tires
  FOR EACH ROW EXECUTE FUNCTION public.pneus_identite();

-- Reprise des pneus existants (D-052, D-067) : code dans l'ordre d'enregistrement.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.tires WHERE code_sigtb IS NULL ORDER BY created_at, id LOOP
    UPDATE public.tires SET code_sigtb = 'PN-' || lpad(nextval('public.pneus_code_seq')::text, 6, '0') WHERE id = r.id;
  END LOOP;
  UPDATE public.tires t SET numero_serie = upper(btrim(t.tire_number))
   WHERE t.numero_serie IS NULL AND t.sans_numero_motif IS NULL AND t.tire_number NOT LIKE '%-ANNULE-%'
     AND (SELECT count(*) FROM public.tires x WHERE upper(btrim(x.tire_number)) = upper(btrim(t.tire_number))) = 1;
  UPDATE public.tires t SET profondeur_initiale_mm = o.profondeur_mm
    FROM public.pneus_operations o
   WHERE o.tire_id = t.id AND o.type = 'entree' AND o.profondeur_mm IS NOT NULL AND t.profondeur_initiale_mm IS NULL;
  IF NOT EXISTS (SELECT 1 FROM public.tires GROUP BY upper(btrim(tire_number)) HAVING count(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS ux_tires_numero ON public.tires (upper(btrim(tire_number)));
  ELSE
    RAISE WARNING 'tires : numeros en double, index unique ux_tires_numero non cree';
  END IF;
END $$;
ALTER TABLE public.tires ALTER COLUMN code_sigtb SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_tires_code_sigtb ON public.tires (code_sigtb);
CREATE UNIQUE INDEX IF NOT EXISTS ux_tires_numero_serie ON public.tires (upper(btrim(numero_serie))) WHERE numero_serie IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_tires_cle_client ON public.tires (cle_client) WHERE cle_client IS NOT NULL;

-- Aucune suppression physique d'une carcasse qui a un historique.
CREATE OR REPLACE FUNCTION public.garde_suppression_pneu()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.pneus_operations o WHERE o.tire_id = OLD.id) THEN
    RAISE EXCEPTION 'Une carcasse avec historique ne se supprime pas : reforme motivee' USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.garde_suppression_pneu() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garde_suppression_pneu ON public.tires;
CREATE TRIGGER garde_suppression_pneu BEFORE DELETE ON public.tires
  FOR EACH ROW EXECUTE FUNCTION public.garde_suppression_pneu();

-- ===================================================================
-- 3. Journal : nouvelles operations
-- ===================================================================

ALTER TABLE public.pneus_operations
  ADD COLUMN IF NOT EXISTS donnees jsonb,
  ADD COLUMN IF NOT EXISTS intervention_id uuid,
  ADD COLUMN IF NOT EXISTS cle_client text;
ALTER TABLE public.pneus_operations DROP CONSTRAINT IF EXISTS pneus_operations_type_check;
ALTER TABLE public.pneus_operations ADD CONSTRAINT pneus_operations_type_check CHECK (type IN (
  'entree', 'montage', 'demontage', 'permutation', 'inspection', 'rechapage', 'reparation', 'reforme', 'annulation',
  'transfert', 'envoi_intervention', 'retour_intervention', 'remise_en_service', 'correction'));
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
            WHERE conrelid = 'public.pneus_operations'::regclass AND contype = 'c'
              AND pg_get_constraintdef(oid) LIKE '%demontage%= (etat_sortie IS NOT NULL)%' LOOP
    EXECUTE format('ALTER TABLE public.pneus_operations DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.pneus_operations DROP CONSTRAINT IF EXISTS pneus_operations_etat_sortie_d091;
ALTER TABLE public.pneus_operations ADD CONSTRAINT pneus_operations_etat_sortie_d091 CHECK (
  (type <> 'demontage' OR etat_sortie IS NOT NULL) AND (etat_sortie IS NULL OR type IN ('demontage', 'transfert'))
  AND (type <> 'transfert' OR (etat_sortie IS NOT NULL AND site_id IS NOT NULL))
  AND (type NOT IN ('transfert', 'correction') OR nullif(btrim(coalesce(motif, '')), '') IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS ux_pneus_operations_cle_client ON public.pneus_operations (cle_client) WHERE cle_client IS NOT NULL;
-- Vue effective (D-052, o.*) recreee pour exposer les colonnes D-091.
CREATE OR REPLACE VIEW public.v_pneus_operations_effectives WITH (security_invoker = true) AS
SELECT o.* FROM public.pneus_operations o
 WHERE o.type <> 'annulation'
   AND NOT EXISTS (SELECT 1 FROM public.pneus_operations a WHERE a.annule_operation_id = o.id);
GRANT SELECT ON public.v_pneus_operations_effectives TO authenticated;

-- ===================================================================
-- 4. Idempotence par cle client (preparation de la saisie terrain)
-- ===================================================================

CREATE TABLE IF NOT EXISTS public.pneus_requetes_client (
  cle text PRIMARY KEY CHECK (char_length(cle) BETWEEN 8 AND 100),
  fonction text NOT NULL,
  auteur uuid NOT NULL REFERENCES auth.users(id),
  resultat uuid,
  cree_le timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pneus_requetes_client ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pneus_requetes_client FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pneus_requetes_client TO authenticated;
GRANT ALL ON public.pneus_requetes_client TO service_role;
DROP POLICY IF EXISTS lecture ON public.pneus_requetes_client;
CREATE POLICY lecture ON public.pneus_requetes_client FOR SELECT TO authenticated USING (auteur = auth.uid());

-- Resultat d'une requete deja traitee pour cette cle (meme auteur, meme
-- fonction), sinon NULL. Verrou consultatif : deux envois simultanes de la
-- meme cle sont serialises.
CREATE OR REPLACE FUNCTION public.pneu_requete_rejouee(p_cle text, p_fonction text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE r public.pneus_requetes_client;
BEGIN
  IF p_cle IS NULL THEN RETURN NULL; END IF;
  IF char_length(btrim(p_cle)) NOT BETWEEN 8 AND 100 THEN
    RAISE EXCEPTION 'Cle client : 8 a 100 caracteres' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('sigtb.pneus.cle:' || btrim(p_cle)));
  SELECT * INTO r FROM public.pneus_requetes_client WHERE cle = btrim(p_cle);
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF r.auteur IS DISTINCT FROM auth.uid() OR r.fonction <> p_fonction THEN
    RAISE EXCEPTION 'Cle client deja utilisee pour une autre operation' USING ERRCODE = '23505';
  END IF;
  RETURN r.resultat;
END;
$$;
CREATE OR REPLACE FUNCTION public.pneu_requete_memoriser(p_cle text, p_fonction text, p_resultat uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.pneus_requetes_client (cle, fonction, auteur, resultat)
  SELECT btrim(p_cle), p_fonction, auth.uid(), p_resultat WHERE p_cle IS NOT NULL;
$$;
REVOKE EXECUTE ON FUNCTION public.pneu_requete_rejouee(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pneu_requete_memoriser(text, text, uuid) FROM PUBLIC, anon, authenticated;

-- ===================================================================
-- 5. Parametrage : configurations, seuils, criteres de rechapage
-- ===================================================================

-- Parametrage global : administrateur, ou approbateur de la maintenance a
-- perimetre global.
CREATE OR REPLACE FUNCTION public.pneus_parametrage_permis()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$ SELECT public.is_admin() OR (public.has_module_approve('maintenance') AND public.site_permis(NULL)); $$;
REVOKE EXECUTE ON FUNCTION public.pneus_parametrage_permis() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pneus_parametrage_permis() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pneus_lecture_permise()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$ SELECT public.has_module_view('vehicles') OR public.has_module_view('maintenance') OR public.is_admin(); $$;
REVOKE EXECUTE ON FUNCTION public.pneus_lecture_permise() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pneus_lecture_permise() TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.pneus_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code = public.normaliser_texte_pneu(code)),
  libelle text NOT NULL CHECK (btrim(libelle) <> ''),
  modele_engin text NOT NULL CHECK (btrim(modele_engin) <> ''),
  notes text,
  actif boolean NOT NULL DEFAULT true,
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now(),
  modifie_le timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pneus_configurations_modele
  ON public.pneus_configurations (public.normaliser_texte_pneu(modele_engin)) WHERE actif;

CREATE TABLE IF NOT EXISTS public.pneus_configuration_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_id uuid NOT NULL REFERENCES public.pneus_configurations(id),
  code text NOT NULL CHECK (code = public.normaliser_position_pneu(code)),
  libelle text,
  essieu integer CHECK (essieu IS NULL OR essieu >= 1),
  cote text CHECK (cote IS NULL OR cote IN ('gauche', 'droite', 'centre')),
  rang text CHECK (rang IS NULL OR rang IN ('simple', 'interieure', 'exterieure')),
  secours boolean NOT NULL DEFAULT false,
  dimensions_admises text[] NOT NULL DEFAULT '{}',
  ordre integer,
  actif boolean NOT NULL DEFAULT true,
  UNIQUE (configuration_id, code),
  CHECK (secours OR (essieu IS NOT NULL AND cote IS NOT NULL AND rang IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.pneus_seuils (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension text, marque text, modele text, application text,
  profondeur_min_mm numeric CHECK (profondeur_min_mm > 0),
  ecart_usure_max_mm numeric CHECK (ecart_usure_max_mm > 0),
  degradation_max_mm_1000km numeric CHECK (degradation_max_mm_1000km > 0),
  pression_min_bar numeric CHECK (pression_min_bar > 0),
  pression_max_bar numeric CHECK (pression_max_bar > 0),
  inspection_max_jours integer CHECK (inspection_max_jours > 0),
  duree_max_jours integer CHECK (duree_max_jours > 0),
  intervention_max_jours integer CHECK (intervention_max_jours > 0),
  garantie_preavis_jours integer CHECK (garantie_preavis_jours > 0),
  cout_km_max numeric CHECK (cout_km_max > 0),
  mesures_min_projection integer CHECK (mesures_min_projection >= 2),
  rechapages_max integer CHECK (rechapages_max >= 0),
  actif boolean NOT NULL DEFAULT true,
  motif text,
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT clock_timestamp(),
  -- Aucun seuil universel : au moins un critere de portee.
  CHECK (num_nonnulls(dimension, marque, modele, application) >= 1),
  CHECK (pression_min_bar IS NULL OR pression_max_bar IS NULL OR pression_min_bar < pression_max_bar)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pneus_seuils_portee ON public.pneus_seuils (
  coalesce(public.normaliser_dimension_pneu(dimension), ''), coalesce(public.normaliser_texte_pneu(marque), ''),
  coalesce(public.normaliser_texte_pneu(modele), ''), coalesce(public.normaliser_texte_pneu(application), '')) WHERE actif;

CREATE TABLE IF NOT EXISTS public.pneus_criteres_rechapage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code = public.normaliser_texte_pneu(code)),
  libelle text NOT NULL CHECK (btrim(libelle) <> ''),
  bloquant boolean NOT NULL DEFAULT true,
  dimension text, marque text, modele text,
  actif boolean NOT NULL DEFAULT true,
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pneus_parametres_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objet text NOT NULL CHECK (objet IN ('configuration', 'seuil', 'critere')),
  objet_id uuid NOT NULL,
  action text NOT NULL,
  avant jsonb,
  apres jsonb,
  motif text,
  auteur uuid REFERENCES auth.users(id),
  le timestamptz NOT NULL DEFAULT clock_timestamp()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pneus_configurations', 'pneus_configuration_positions', 'pneus_seuils',
                           'pneus_criteres_rechapage', 'pneus_parametres_journal'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS lecture ON public.%I', t);
    EXECUTE format('CREATE POLICY lecture ON public.%I FOR SELECT TO authenticated USING (public.pneus_lecture_permise())', t);
  END LOOP;
END $$;

-- Journaux et inspections : append-only pour les comptes.
CREATE OR REPLACE FUNCTION public.garde_pneus_immuable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN coalesce(NEW, OLD); END IF;
  RAISE EXCEPTION 'Enregistrement pneus immuable : corriger par une nouvelle operation' USING ERRCODE = '42501';
END;
$$;
-- Fiches modifiables par les fonctions serveur seulement : jamais supprimees.
CREATE OR REPLACE FUNCTION public.garde_pneus_sans_suppression()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Suppression refusee : annulation ou correction tracee seulement' USING ERRCODE = '42501';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.garde_pneus_immuable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.garde_pneus_sans_suppression() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garde_pneus_immuable ON public.pneus_parametres_journal;
CREATE TRIGGER garde_pneus_immuable BEFORE UPDATE OR DELETE ON public.pneus_parametres_journal
  FOR EACH ROW EXECUTE FUNCTION public.garde_pneus_immuable();
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pneus_configurations', 'pneus_configuration_positions', 'pneus_seuils', 'pneus_criteres_rechapage'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS garde_pneus_sans_suppression ON public.%I', t);
    EXECUTE format('CREATE TRIGGER garde_pneus_sans_suppression BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.garde_pneus_sans_suppression()', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.journaliser_parametre_pneu(p_objet text, p_id uuid, p_action text, p_avant jsonb, p_apres jsonb, p_motif text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.pneus_parametres_journal (objet, objet_id, action, avant, apres, motif, auteur)
  VALUES (p_objet, p_id, p_action, p_avant, p_apres, nullif(btrim(coalesce(p_motif, '')), ''), auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.journaliser_parametre_pneu(text, uuid, text, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.etat_configuration_pneus(p_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT to_jsonb(c) || jsonb_build_object('positions', coalesce((
           SELECT jsonb_agg(to_jsonb(p) ORDER BY p.ordre NULLS LAST, p.code)
             FROM public.pneus_configuration_positions p WHERE p.configuration_id = c.id), '[]'::jsonb))
    FROM public.pneus_configurations c WHERE c.id = p_id;
$$;
REVOKE EXECUTE ON FUNCTION public.etat_configuration_pneus(uuid) FROM PUBLIC, anon, authenticated;

-- Configuration active d'un engin : celle de son modele (vehicles.brand_model).
CREATE OR REPLACE FUNCTION public.configuration_pneus_engin(p_vehicle uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.id FROM public.vehicles v
    JOIN public.pneus_configurations c ON c.actif
         AND public.normaliser_texte_pneu(c.modele_engin) = public.normaliser_texte_pneu(v.brand_model)
   WHERE v.id = p_vehicle;
$$;
REVOKE EXECUTE ON FUNCTION public.configuration_pneus_engin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.configuration_pneus_engin(uuid) TO authenticated, service_role;

-- Pneus montes a une position d'une configuration (engins de son modele).
CREATE OR REPLACE FUNCTION public.pneus_montes_configuration(p_configuration uuid, p_position text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT count(*)::integer FROM public.tires t
    JOIN public.vehicles v ON v.id = t.vehicle_id
    JOIN public.pneus_configurations c ON c.id = p_configuration
         AND public.normaliser_texte_pneu(c.modele_engin) = public.normaliser_texte_pneu(v.brand_model)
   WHERE t.status = 'active' AND (p_position IS NULL OR t."position" = p_position);
$$;
REVOKE EXECUTE ON FUNCTION public.pneus_montes_configuration(uuid, text) FROM PUBLIC, anon, authenticated;

-- Cree ou met a jour une configuration par son code. Les positions absentes
-- du nouveau jeu sont desactivees (jamais supprimees), refus si un pneu y
-- est monte. Journalisee avant/apres.
CREATE OR REPLACE FUNCTION public.definir_configuration_pneus(
  p_code text, p_libelle text, p_modele_engin text, p_positions jsonb, p_notes text DEFAULT NULL, p_motif text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_code text := public.normaliser_texte_pneu(p_code);
  v_id uuid; v_avant jsonb; p jsonb; v_pos text; v_codes text[] := '{}'; v_dims text[]; r record;
BEGIN
  IF NOT public.pneus_parametrage_permis() THEN
    RAISE EXCEPTION 'Parametrage des pneus reserve a l''administrateur ou a un approbateur de la maintenance a perimetre global'
      USING ERRCODE = '42501';
  END IF;
  IF v_code IS NULL THEN RAISE EXCEPTION 'Code de configuration requis' USING ERRCODE = '22023'; END IF;
  PERFORM public.texte_requis(p_libelle, 'Libelle');
  PERFORM public.texte_requis(p_modele_engin, 'Modele d''engin');
  IF jsonb_typeof(p_positions) IS DISTINCT FROM 'array' OR jsonb_array_length(p_positions) = 0 THEN
    RAISE EXCEPTION 'Au moins une position requise (aucune configuration supposee)' USING ERRCODE = '22023';
  END IF;
  FOR p IN SELECT * FROM jsonb_array_elements(p_positions) LOOP
    v_pos := public.normaliser_position_pneu(p ->> 'code');
    IF v_pos IS NULL THEN RAISE EXCEPTION 'Code de position requis' USING ERRCODE = '22023'; END IF;
    IF v_pos = ANY (v_codes) THEN RAISE EXCEPTION 'Position % en double', v_pos USING ERRCODE = '22023'; END IF;
    v_codes := v_codes || v_pos;
  END LOOP;

  SELECT id INTO v_id FROM public.pneus_configurations WHERE code = v_code FOR UPDATE;
  IF FOUND THEN
    v_avant := public.etat_configuration_pneus(v_id);
    PERFORM public.texte_requis(p_motif, 'Motif de la modification');
    UPDATE public.pneus_configurations SET libelle = btrim(p_libelle), modele_engin = btrim(p_modele_engin),
           notes = nullif(btrim(coalesce(p_notes, '')), ''), actif = true, modifie_le = now()
     WHERE id = v_id;
  ELSE
    INSERT INTO public.pneus_configurations (code, libelle, modele_engin, notes, cree_par)
    VALUES (v_code, btrim(p_libelle), btrim(p_modele_engin), nullif(btrim(coalesce(p_notes, '')), ''), auth.uid())
    RETURNING id INTO v_id;
  END IF;

  FOR r IN SELECT x.code FROM public.pneus_configuration_positions x
            WHERE x.configuration_id = v_id AND x.actif AND NOT x.code = ANY (v_codes) LOOP
    IF public.pneus_montes_configuration(v_id, r.code) > 0 THEN
      RAISE EXCEPTION 'Position % retiree alors qu''un pneu y est monte : demonter d''abord', r.code USING ERRCODE = '22023';
    END IF;
    UPDATE public.pneus_configuration_positions SET actif = false WHERE configuration_id = v_id AND code = r.code;
  END LOOP;
  FOR p IN SELECT * FROM jsonb_array_elements(p_positions) LOOP
    v_pos := public.normaliser_position_pneu(p ->> 'code');
    SELECT coalesce(array_agg(DISTINCT public.normaliser_dimension_pneu(d)) FILTER (WHERE public.normaliser_dimension_pneu(d) IS NOT NULL), '{}')
      INTO v_dims FROM jsonb_array_elements_text(coalesce(p -> 'dimensions', '[]'::jsonb)) d;
    INSERT INTO public.pneus_configuration_positions (configuration_id, code, libelle, essieu, cote, rang, secours, dimensions_admises, ordre, actif)
    VALUES (v_id, v_pos, nullif(btrim(coalesce(p ->> 'libelle', '')), ''), (p ->> 'essieu')::integer, p ->> 'cote', p ->> 'rang',
            coalesce((p ->> 'secours')::boolean, false), v_dims, (p ->> 'ordre')::integer, true)
    ON CONFLICT (configuration_id, code) DO UPDATE SET libelle = EXCLUDED.libelle, essieu = EXCLUDED.essieu, cote = EXCLUDED.cote,
      rang = EXCLUDED.rang, secours = EXCLUDED.secours, dimensions_admises = EXCLUDED.dimensions_admises,
      ordre = EXCLUDED.ordre, actif = true;
  END LOOP;
  PERFORM public.journaliser_parametre_pneu('configuration', v_id, CASE WHEN v_avant IS NULL THEN 'creation' ELSE 'modification' END,
                                            v_avant, public.etat_configuration_pneus(v_id), p_motif);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.retirer_configuration_pneus(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_avant jsonb;
BEGIN
  IF NOT public.pneus_parametrage_permis() THEN
    RAISE EXCEPTION 'Parametrage des pneus reserve a l''administrateur ou a un approbateur de la maintenance a perimetre global'
      USING ERRCODE = '42501';
  END IF;
  PERFORM public.texte_requis(p_motif, 'Motif du retrait');
  PERFORM 1 FROM public.pneus_configurations WHERE id = p_id AND actif FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Configuration introuvable ou deja retiree' USING ERRCODE = '22023'; END IF;
  IF public.pneus_montes_configuration(p_id, NULL) > 0 THEN
    RAISE EXCEPTION 'Configuration utilisee par des pneus montes : demonter d''abord' USING ERRCODE = '22023';
  END IF;
  v_avant := public.etat_configuration_pneus(p_id);
  UPDATE public.pneus_configurations SET actif = false, modifie_le = now() WHERE id = p_id;
  PERFORM public.journaliser_parametre_pneu('configuration', p_id, 'retrait', v_avant, public.etat_configuration_pneus(p_id), p_motif);
END;
$$;

-- Incompatibilite d'une position et d'une dimension sur un engin : NULL si
-- compatible ou si l'engin n'a pas de configuration (exigence a part).
CREATE OR REPLACE FUNCTION public.position_pneu_incompatible(p_vehicle uuid, p_position text, p_dimension text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_conf uuid := public.configuration_pneus_engin(p_vehicle); pos public.pneus_configuration_positions; v_code text;
BEGIN
  IF v_conf IS NULL THEN RETURN NULL; END IF;
  SELECT code INTO v_code FROM public.pneus_configurations WHERE id = v_conf;
  SELECT * INTO pos FROM public.pneus_configuration_positions
   WHERE configuration_id = v_conf AND code = public.normaliser_position_pneu(p_position) AND actif;
  IF NOT FOUND THEN
    RETURN format('Position %s absente de la configuration %s', coalesce(public.normaliser_position_pneu(p_position), '?'), v_code);
  END IF;
  IF cardinality(pos.dimensions_admises) > 0 THEN
    IF public.normaliser_dimension_pneu(p_dimension) IS NULL THEN
      RETURN format('Dimension du pneu inconnue : la position %s admet %s', pos.code, array_to_string(pos.dimensions_admises, ', '));
    END IF;
    IF NOT public.normaliser_dimension_pneu(p_dimension) = ANY (pos.dimensions_admises) THEN
      RETURN format('Dimension %s non admise a la position %s (%s)', p_dimension, pos.code, array_to_string(pos.dimensions_admises, ', '));
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.position_pneu_incompatible(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.position_pneu_incompatible(uuid, text, text) TO authenticated, service_role;

-- Seuils : cree une portee (ou remplace celle de p_id, desactivee). Valeurs
-- jamais supposees : seuls les champs fournis sont poses.
CREATE OR REPLACE FUNCTION public.definir_seuils_pneus(p_valeurs jsonb, p_motif text, p_remplace uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid; v_avant jsonb; v jsonb := coalesce(p_valeurs, '{}'::jsonb);
BEGIN
  IF NOT public.pneus_parametrage_permis() THEN
    RAISE EXCEPTION 'Parametrage des pneus reserve a l''administrateur ou a un approbateur de la maintenance a perimetre global'
      USING ERRCODE = '42501';
  END IF;
  PERFORM public.texte_requis(p_motif, 'Motif');
  IF p_remplace IS NOT NULL THEN
    SELECT to_jsonb(s) INTO v_avant FROM public.pneus_seuils s WHERE s.id = p_remplace AND s.actif FOR UPDATE;
    IF v_avant IS NULL THEN RAISE EXCEPTION 'Seuils a remplacer introuvables ou inactifs' USING ERRCODE = '22023'; END IF;
    UPDATE public.pneus_seuils SET actif = false WHERE id = p_remplace;
  END IF;
  INSERT INTO public.pneus_seuils (dimension, marque, modele, application, profondeur_min_mm, ecart_usure_max_mm,
    degradation_max_mm_1000km, pression_min_bar, pression_max_bar, inspection_max_jours, duree_max_jours,
    intervention_max_jours, garantie_preavis_jours, cout_km_max, mesures_min_projection, rechapages_max, motif, cree_par)
  VALUES (public.normaliser_dimension_pneu(v ->> 'dimension'), public.normaliser_texte_pneu(v ->> 'marque'),
    public.normaliser_texte_pneu(v ->> 'modele'), public.normaliser_texte_pneu(v ->> 'application'),
    public.pneu_nombre(v ->> 'profondeur_min_mm', 'Profondeur minimale'), public.pneu_nombre(v ->> 'ecart_usure_max_mm', 'Ecart d''usure'),
    public.pneu_nombre(v ->> 'degradation_max_mm_1000km', 'Degradation'), public.pneu_nombre(v ->> 'pression_min_bar', 'Pression minimale'),
    public.pneu_nombre(v ->> 'pression_max_bar', 'Pression maximale'), public.pneu_nombre(v ->> 'inspection_max_jours', 'Inspection')::integer,
    public.pneu_nombre(v ->> 'duree_max_jours', 'Duree')::integer, public.pneu_nombre(v ->> 'intervention_max_jours', 'Intervention')::integer,
    public.pneu_nombre(v ->> 'garantie_preavis_jours', 'Preavis de garantie')::integer, public.pneu_nombre(v ->> 'cout_km_max', 'Cout au km'),
    public.pneu_nombre(v ->> 'mesures_min_projection', 'Mesures minimales')::integer, public.pneu_nombre(v ->> 'rechapages_max', 'Rechapages')::integer,
    btrim(p_motif), auth.uid())
  RETURNING id INTO v_id;
  IF NOT EXISTS (SELECT 1 FROM public.pneus_seuils s WHERE s.id = v_id
                  AND num_nonnulls(s.profondeur_min_mm, s.ecart_usure_max_mm, s.degradation_max_mm_1000km, s.pression_min_bar,
                                   s.pression_max_bar, s.inspection_max_jours, s.duree_max_jours, s.intervention_max_jours,
                                   s.garantie_preavis_jours, s.cout_km_max, s.mesures_min_projection, s.rechapages_max) > 0) THEN
    RAISE EXCEPTION 'Au moins un seuil requis' USING ERRCODE = '22023';
  END IF;
  PERFORM public.journaliser_parametre_pneu('seuil', v_id, CASE WHEN p_remplace IS NULL THEN 'creation' ELSE 'remplacement' END,
                                            v_avant, (SELECT to_jsonb(s) FROM public.pneus_seuils s WHERE s.id = v_id), p_motif);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.desactiver_seuils_pneus(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_avant jsonb;
BEGIN
  IF NOT public.pneus_parametrage_permis() THEN
    RAISE EXCEPTION 'Parametrage des pneus reserve a l''administrateur ou a un approbateur de la maintenance a perimetre global'
      USING ERRCODE = '42501';
  END IF;
  PERFORM public.texte_requis(p_motif, 'Motif');
  SELECT to_jsonb(s) INTO v_avant FROM public.pneus_seuils s WHERE s.id = p_id AND s.actif FOR UPDATE;
  IF v_avant IS NULL THEN RAISE EXCEPTION 'Seuils introuvables ou inactifs' USING ERRCODE = '22023'; END IF;
  UPDATE public.pneus_seuils SET actif = false WHERE id = p_id;
  PERFORM public.journaliser_parametre_pneu('seuil', p_id, 'desactivation', v_avant, v_avant || '{"actif": false}', p_motif);
END;
$$;

-- Seuils applicables a un pneu : champ par champ, la portee la plus precise
-- (modele, marque, dimension, application). Aucun seuil : NULL.
CREATE OR REPLACE FUNCTION public.seuils_pneu(p_tire uuid)
RETURNS TABLE (profondeur_min_mm numeric, ecart_usure_max_mm numeric, degradation_max_mm_1000km numeric,
               pression_min_bar numeric, pression_max_bar numeric, inspection_max_jours integer, duree_max_jours integer,
               intervention_max_jours integer, garantie_preavis_jours integer, cout_km_max numeric,
               mesures_min_projection integer, rechapages_max integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH s AS (
    SELECT x.*, (x.modele IS NOT NULL)::int * 8 + (x.marque IS NOT NULL)::int * 4
              + (x.dimension IS NOT NULL)::int * 2 + (x.application IS NOT NULL)::int AS score
      FROM public.pneus_seuils x, public.tires t
     WHERE t.id = p_tire AND x.actif
       AND (x.dimension IS NULL OR x.dimension = public.normaliser_dimension_pneu(t.dimension))
       AND (x.marque IS NULL OR x.marque = public.normaliser_texte_pneu(t.brand))
       AND (x.modele IS NULL OR x.modele = public.normaliser_texte_pneu(t.model))
       AND (x.application IS NULL OR x.application = public.normaliser_texte_pneu(t.application)))
  SELECT (array_agg(profondeur_min_mm ORDER BY score DESC, cree_le DESC) FILTER (WHERE profondeur_min_mm IS NOT NULL))[1],
         (array_agg(ecart_usure_max_mm ORDER BY score DESC, cree_le DESC) FILTER (WHERE ecart_usure_max_mm IS NOT NULL))[1],
         (array_agg(degradation_max_mm_1000km ORDER BY score DESC, cree_le DESC) FILTER (WHERE degradation_max_mm_1000km IS NOT NULL))[1],
         (array_agg(pression_min_bar ORDER BY score DESC, cree_le DESC) FILTER (WHERE pression_min_bar IS NOT NULL))[1],
         (array_agg(pression_max_bar ORDER BY score DESC, cree_le DESC) FILTER (WHERE pression_max_bar IS NOT NULL))[1],
         (array_agg(inspection_max_jours ORDER BY score DESC, cree_le DESC) FILTER (WHERE inspection_max_jours IS NOT NULL))[1],
         (array_agg(duree_max_jours ORDER BY score DESC, cree_le DESC) FILTER (WHERE duree_max_jours IS NOT NULL))[1],
         (array_agg(intervention_max_jours ORDER BY score DESC, cree_le DESC) FILTER (WHERE intervention_max_jours IS NOT NULL))[1],
         (array_agg(garantie_preavis_jours ORDER BY score DESC, cree_le DESC) FILTER (WHERE garantie_preavis_jours IS NOT NULL))[1],
         (array_agg(cout_km_max ORDER BY score DESC, cree_le DESC) FILTER (WHERE cout_km_max IS NOT NULL))[1],
         (array_agg(mesures_min_projection ORDER BY score DESC, cree_le DESC) FILTER (WHERE mesures_min_projection IS NOT NULL))[1],
         (array_agg(rechapages_max ORDER BY score DESC, cree_le DESC) FILTER (WHERE rechapages_max IS NOT NULL))[1]
    FROM s;
$$;
REVOKE EXECUTE ON FUNCTION public.seuils_pneu(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seuils_pneu(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.definir_critere_rechapage(
  p_code text, p_libelle text, p_bloquant boolean, p_portee jsonb DEFAULT NULL, p_actif boolean DEFAULT true, p_motif text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_code text := public.normaliser_texte_pneu(p_code); v_id uuid; v_avant jsonb; v jsonb := coalesce(p_portee, '{}'::jsonb);
BEGIN
  IF NOT public.pneus_parametrage_permis() THEN
    RAISE EXCEPTION 'Parametrage des pneus reserve a l''administrateur ou a un approbateur de la maintenance a perimetre global'
      USING ERRCODE = '42501';
  END IF;
  IF v_code IS NULL THEN RAISE EXCEPTION 'Code du critere requis' USING ERRCODE = '22023'; END IF;
  PERFORM public.texte_requis(p_libelle, 'Libelle');
  IF p_bloquant IS NULL OR p_actif IS NULL THEN RAISE EXCEPTION 'Caractere bloquant et activite requis' USING ERRCODE = '22023'; END IF;
  SELECT id, to_jsonb(c) INTO v_id, v_avant FROM public.pneus_criteres_rechapage c WHERE c.code = v_code FOR UPDATE;
  IF v_id IS NOT NULL THEN
    PERFORM public.texte_requis(p_motif, 'Motif de la modification');
    UPDATE public.pneus_criteres_rechapage SET libelle = btrim(p_libelle), bloquant = p_bloquant, actif = p_actif,
           dimension = public.normaliser_dimension_pneu(v ->> 'dimension'), marque = public.normaliser_texte_pneu(v ->> 'marque'),
           modele = public.normaliser_texte_pneu(v ->> 'modele')
     WHERE id = v_id;
  ELSE
    INSERT INTO public.pneus_criteres_rechapage (code, libelle, bloquant, dimension, marque, modele, actif, cree_par)
    VALUES (v_code, btrim(p_libelle), p_bloquant, public.normaliser_dimension_pneu(v ->> 'dimension'),
            public.normaliser_texte_pneu(v ->> 'marque'), public.normaliser_texte_pneu(v ->> 'modele'), p_actif, auth.uid())
    RETURNING id INTO v_id;
  END IF;
  PERFORM public.journaliser_parametre_pneu('critere', v_id, CASE WHEN v_avant IS NULL THEN 'creation' ELSE 'modification' END,
                                            v_avant, (SELECT to_jsonb(c) FROM public.pneus_criteres_rechapage c WHERE c.id = v_id), p_motif);
  RETURN v_id;
END;
$$;

-- ===================================================================
-- 6. Interventions, inspections detaillees, propositions d'immobilisation
-- ===================================================================

CREATE SEQUENCE IF NOT EXISTS public.pneus_interventions_seq;
REVOKE ALL ON SEQUENCE public.pneus_interventions_seq FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.pneus_interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  tire_id uuid NOT NULL REFERENCES public.tires(id),
  type text NOT NULL CHECK (type IN ('reparation', 'vulcanisation', 'rechapage', 'expertise', 'autre')),
  type_autre text,
  cycle_rechapage integer CHECK (cycle_rechapage IS NULL OR cycle_rechapage >= 1),
  prestataire text NOT NULL CHECK (btrim(prestataire) <> ''),
  fournisseur_id uuid REFERENCES public.suppliers(id),
  criteres jsonb,
  envoye_le timestamptz NOT NULL,
  envoye_par uuid REFERENCES auth.users(id),
  envoi_operation_id uuid REFERENCES public.pneus_operations(id),
  retour_le timestamptz,
  retour_par uuid REFERENCES auth.users(id),
  retour_operation_id uuid REFERENCES public.pneus_operations(id),
  cout bigint CHECK (cout IS NULL OR cout >= 0),
  bon_commande_id uuid REFERENCES public.purchase_orders(id),
  facture_reference text,
  garantie_mois integer CHECK (garantie_mois IS NULL OR garantie_mois > 0),
  garantie_km numeric CHECK (garantie_km IS NULL OR garantie_km > 0),
  profondeur_retour_mm numeric CHECK (profondeur_retour_mm IS NULL OR profondeur_retour_mm >= 0),
  constats text,
  controle_resultat text CHECK (controle_resultat IS NULL OR controle_resultat IN ('conforme', 'non_conforme')),
  controle_note text,
  controle_par uuid REFERENCES auth.users(id),
  controle_le timestamptz,
  decision text CHECK (decision IS NULL OR decision IN ('remis_en_service', 'reforme', 'a_reprendre')),
  decision_motif text,
  decide_par uuid REFERENCES auth.users(id),
  decide_le timestamptz,
  statut text NOT NULL DEFAULT 'envoyee' CHECK (statut IN ('envoyee', 'retournee', 'controlee', 'cloturee', 'annulee')),
  motif_annulation text,
  cle_client text UNIQUE,
  CHECK (type <> 'autre' OR nullif(btrim(coalesce(type_autre, '')), '') IS NOT NULL),
  CHECK ((type = 'rechapage') = (cycle_rechapage IS NOT NULL)),
  CHECK (statut = 'envoyee' OR statut = 'annulee' OR retour_le IS NOT NULL),
  CHECK (statut NOT IN ('controlee', 'cloturee') OR controle_resultat IS NOT NULL),
  CHECK (statut <> 'cloturee' OR (decision IS NOT NULL AND decide_par IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_pneus_interventions_pneu ON public.pneus_interventions (tire_id, envoye_le);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pneus_interventions_ouverte ON public.pneus_interventions (tire_id)
  WHERE statut IN ('envoyee', 'retournee', 'controlee');
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pneus_operations_intervention_fk') THEN
    ALTER TABLE public.pneus_operations ADD CONSTRAINT pneus_operations_intervention_fk
      FOREIGN KEY (intervention_id) REFERENCES public.pneus_interventions(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.pneus_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL UNIQUE REFERENCES public.pneus_operations(id),
  tire_id uuid NOT NULL REFERENCES public.tires(id),
  nature text NOT NULL CHECK (nature IN ('mesure', 'observation', 'declaration', 'import')),
  inspecte_le timestamptz NOT NULL,
  mesures jsonb,
  profondeur_min_mm numeric,
  ecart_mm numeric,
  pression_bar numeric CHECK (pression_bar IS NULL OR pression_bar > 0),
  temperature_c numeric,
  constats jsonb,
  defaut_critique boolean NOT NULL DEFAULT false,
  recommandation text CHECK (recommandation IS NULL OR recommandation IN
    ('aucune', 'surveiller', 'permuter', 'demonter', 'reparer', 'rechaper', 'reformer', 'immobiliser')),
  inspecteur uuid REFERENCES auth.users(id),
  saisi_le timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_pneus_inspections_pneu ON public.pneus_inspections (tire_id, inspecte_le);

CREATE TABLE IF NOT EXISTS public.pneus_propositions_immobilisation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id),
  tire_id uuid NOT NULL REFERENCES public.tires(id),
  operation_id uuid REFERENCES public.pneus_operations(id),
  motif text NOT NULL CHECK (btrim(motif) <> ''),
  propose_le timestamptz NOT NULL DEFAULT now(),
  propose_par uuid REFERENCES auth.users(id),
  statut text NOT NULL DEFAULT 'proposee' CHECK (statut IN ('proposee', 'acceptee', 'refusee')),
  decide_par uuid REFERENCES auth.users(id),
  decide_le timestamptz,
  motif_decision text,
  immobilisation_id uuid REFERENCES public.immobilisations(id),
  CHECK (statut = 'proposee' OR (decide_par IS NOT NULL AND nullif(btrim(coalesce(motif_decision, '')), '') IS NOT NULL)),
  CHECK ((statut = 'acceptee') = (immobilisation_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pneus_propositions_ouverte ON public.pneus_propositions_immobilisation (vehicle_id)
  WHERE statut = 'proposee';

ALTER TABLE public.pneus_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pneus_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pneus_propositions_immobilisation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pneus_interventions, public.pneus_inspections, public.pneus_propositions_immobilisation FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pneus_interventions, public.pneus_inspections, public.pneus_propositions_immobilisation TO authenticated;
GRANT ALL ON public.pneus_interventions, public.pneus_inspections, public.pneus_propositions_immobilisation TO service_role;
DROP POLICY IF EXISTS lecture ON public.pneus_interventions;
CREATE POLICY lecture ON public.pneus_interventions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tires t WHERE t.id = tire_id));
DROP POLICY IF EXISTS lecture ON public.pneus_inspections;
CREATE POLICY lecture ON public.pneus_inspections FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tires t WHERE t.id = tire_id));
DROP POLICY IF EXISTS lecture ON public.pneus_propositions_immobilisation;
CREATE POLICY lecture ON public.pneus_propositions_immobilisation FOR SELECT TO authenticated
  USING ((public.has_module_view('maintenance') OR public.is_admin()) AND public.vehicule_permis(vehicle_id));
DROP TRIGGER IF EXISTS garde_pneus_immuable ON public.pneus_inspections;
CREATE TRIGGER garde_pneus_immuable BEFORE UPDATE OR DELETE ON public.pneus_inspections
  FOR EACH ROW EXECUTE FUNCTION public.garde_pneus_immuable();
DROP TRIGGER IF EXISTS garde_pneus_sans_suppression ON public.pneus_interventions;
CREATE TRIGGER garde_pneus_sans_suppression BEFORE DELETE ON public.pneus_interventions
  FOR EACH ROW EXECUTE FUNCTION public.garde_pneus_sans_suppression();
DROP TRIGGER IF EXISTS garde_pneus_sans_suppression ON public.pneus_propositions_immobilisation;
CREATE TRIGGER garde_pneus_sans_suppression BEFORE DELETE ON public.pneus_propositions_immobilisation
  FOR EACH ROW EXECUTE FUNCTION public.garde_pneus_sans_suppression();

-- Annulation d'une operation liee (D-052, annuler_operation_pneu) :
-- une correction ou un retour d'intervention ne s'annulent pas (corriger
-- par une nouvelle operation) ; l'annulation d'un envoi annule
-- l'intervention, celle d'une remise en service la rend a decider.
CREATE OR REPLACE FUNCTION public.pneus_suivi_annulation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE c public.pneus_operations;
BEGIN
  SELECT * INTO c FROM public.pneus_operations WHERE id = NEW.annule_operation_id;
  IF c.type = 'correction' THEN
    RAISE EXCEPTION 'Une correction ne s''annule pas : saisir une nouvelle correction motivee' USING ERRCODE = '22023';
  END IF;
  IF c.intervention_id IS NOT NULL AND c.type NOT IN ('envoi_intervention', 'remise_en_service') THEN
    RAISE EXCEPTION 'Operation liee a l''intervention : corriger par la decision (reforme ou nouvelle intervention)' USING ERRCODE = '22023';
  END IF;
  IF c.type = 'envoi_intervention' THEN
    UPDATE public.pneus_interventions SET statut = 'annulee', motif_annulation = NEW.motif WHERE id = c.intervention_id;
  ELSIF c.type = 'remise_en_service' THEN
    UPDATE public.pneus_interventions SET statut = 'controlee', decision = NULL, decision_motif = NULL, decide_par = NULL, decide_le = NULL
     WHERE id = c.intervention_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pneus_suivi_annulation() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS pneus_suivi_annulation ON public.pneus_operations;
CREATE TRIGGER pneus_suivi_annulation AFTER INSERT ON public.pneus_operations
  FOR EACH ROW WHEN (NEW.type = 'annulation') EXECUTE FUNCTION public.pneus_suivi_annulation();

-- ===================================================================
-- 7. Etat du registre (cache recalcule depuis le journal)
-- ===================================================================

CREATE OR REPLACE FUNCTION public.recalculer_pneu(p_tire uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE e public.pneus_operations; v_status text; v_vehicle uuid; v_pos text; v_site uuid;
BEGIN
  SELECT o.* INTO e FROM public.pneus_operations o
   WHERE o.tire_id = p_tire AND o.type IN ('entree', 'montage', 'demontage', 'permutation', 'rechapage', 'reparation', 'reforme',
                                           'transfert', 'envoi_intervention', 'retour_intervention', 'remise_en_service')
     AND NOT EXISTS (SELECT 1 FROM public.pneus_operations a WHERE a.annule_operation_id = o.id)
   ORDER BY o.effectue_le DESC, o.saisi_le DESC LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  v_status := CASE
    WHEN e.type IN ('montage', 'permutation') THEN 'active'
    WHEN e.type IN ('demontage', 'transfert') THEN e.etat_sortie
    WHEN e.type = 'reforme' THEN 'retired'
    WHEN e.type = 'envoi_intervention' THEN 'en_intervention'
    -- Retour d'intervention (D-091) : a controler et a decider.
    WHEN e.type IN ('rechapage', 'reparation', 'retour_intervention') AND e.intervention_id IS NOT NULL THEN 'damaged'
    ELSE 'stored' END;
  v_vehicle := CASE WHEN v_status = 'active' THEN e.vehicle_id END;
  v_pos := CASE WHEN v_status = 'active' THEN e."position" END;
  v_site := CASE WHEN v_status = 'active' THEN NULL ELSE e.site_id END;
  IF v_status = 'active' AND EXISTS (SELECT 1 FROM public.tires t WHERE t.id <> p_tire AND t.status = 'active'
                                        AND t.vehicle_id = v_vehicle AND t."position" = v_pos) THEN
    RAISE EXCEPTION 'Position % deja occupee sur cet engin', v_pos USING ERRCODE = '22023';
  END IF;
  UPDATE public.tires t SET
    status = v_status, vehicle_id = v_vehicle, "position" = v_pos, site_id = v_site,
    installation_date = (SELECT max(o.effectue_le)::date FROM public.v_pneus_operations_effectives o
                          WHERE o.tire_id = p_tire AND o.type = 'montage'),
    removal_date = CASE WHEN v_status = 'active' THEN NULL ELSE
                     (SELECT max(o.effectue_le)::date FROM public.v_pneus_operations_effectives o
                       WHERE o.tire_id = p_tire AND o.type = 'demontage') END,
    retread_count = (SELECT count(*)::int FROM public.v_pneus_operations_effectives o
                      WHERE o.tire_id = p_tire AND o.type = 'rechapage'),
    last_inspection_date = (SELECT max(o.effectue_le)::date FROM public.v_pneus_operations_effectives o
                             WHERE o.tire_id = p_tire AND o.type = 'inspection'),
    updated_at = now()
   WHERE t.id = p_tire;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.recalculer_pneu(uuid) FROM PUBLIC, anon, authenticated;

-- Defaut critique ouvert : derniere inspection detaillee avec defaut
-- critique, sans inspection detaillee posterieure qui le leve ni retour
-- d'intervention, remise en service ou reforme posterieurs.
CREATE OR REPLACE FUNCTION public.pneu_defaut_critique_ouvert(p_tire uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT o.id FROM public.pneus_inspections d JOIN public.v_pneus_operations_effectives o ON o.id = d.operation_id
   WHERE d.tire_id = p_tire AND d.defaut_critique
     AND NOT EXISTS (SELECT 1 FROM public.v_pneus_operations_effectives x
                       LEFT JOIN public.pneus_inspections dx ON dx.operation_id = x.id
                      WHERE x.tire_id = p_tire AND (x.effectue_le, x.saisi_le) > (o.effectue_le, o.saisi_le)
                        AND (x.type IN ('remise_en_service', 'rechapage', 'reparation', 'retour_intervention', 'reforme')
                             OR (x.type = 'inspection' AND dx.defaut_critique IS FALSE)))
   ORDER BY o.effectue_le DESC, o.saisi_le DESC LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.pneu_defaut_critique_ouvert(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pneu_defaut_critique_ouvert(uuid) TO authenticated, service_role;

-- ===================================================================
-- 8. Operations : creation, montage, permutation, demontage, transfert
-- ===================================================================

-- Creation controlee d'une carcasse. Sans numero de serie : motif exige,
-- le code SIGTB sert de numero. Prix seulement avec sa source (piece).
CREATE OR REPLACE FUNCTION public.creer_carcasse_pneu(
  p_caracteristiques jsonb, p_site uuid, p_numero_serie text DEFAULT NULL, p_motif_sans_numero text DEFAULT NULL,
  p_date timestamptz DEFAULT now(), p_cle_client text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c jsonb := coalesce(p_caracteristiques, '{}'::jsonb);
  v_serie text := public.normaliser_texte_pneu(p_numero_serie);
  v_code text; v_id uuid; v_prix numeric; v_source text := nullif(btrim(coalesce(c ->> 'prix_source', '')), '');
  v_commande uuid := nullif(c ->> 'commande', '')::uuid; v_prec uuid;
BEGIN
  v_prec := public.pneu_requete_rejouee(p_cle_client, 'creer_carcasse_pneu');
  IF v_prec IS NOT NULL THEN RETURN v_prec; END IF;
  IF NOT (public.has_module_write('vehicles') OR public.has_module_write('maintenance') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la flotte ou la maintenance requis' USING ERRCODE = '42501';
  END IF;
  PERFORM public.texte_requis(c ->> 'marque', 'Marque');
  PERFORM public.texte_requis(c ->> 'modele', 'Modele');
  PERFORM public.site_stock_pneu(p_site);
  IF p_date IS NULL OR p_date > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Date d''entree requise, pas dans le futur' USING ERRCODE = '22023';
  END IF;
  IF v_serie IS NULL THEN
    IF char_length(btrim(coalesce(p_motif_sans_numero, ''))) < 5 THEN
      RAISE EXCEPTION 'Numero de serie fabricant, ou motif de creation sans numero (5 caracteres au moins), requis' USING ERRCODE = '22023';
    END IF;
  ELSIF EXISTS (SELECT 1 FROM public.tires t WHERE upper(btrim(t.numero_serie)) = v_serie OR upper(btrim(t.tire_number)) = v_serie) THEN
    RAISE EXCEPTION 'Numero de serie % deja enregistre' , v_serie USING ERRCODE = '23505';
  END IF;
  v_prix := public.pneu_nombre(c ->> 'prix', 'Prix');
  IF v_prix IS NOT NULL AND v_source IS NULL THEN
    RAISE EXCEPTION 'Prix sans piece : source requise (bon_commande, facture ou saisie)' USING ERRCODE = '22023';
  END IF;
  IF v_source = 'bon_commande' AND (v_commande IS NULL OR NOT EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = v_commande)) THEN
    RAISE EXCEPTION 'Bon de commande introuvable' USING ERRCODE = '22023';
  END IF;
  IF (c ->> 'construction') IS NOT NULL AND (c ->> 'construction') NOT IN ('radiale', 'diagonale') THEN
    RAISE EXCEPTION 'Construction : radiale ou diagonale' USING ERRCODE = '22023';
  END IF;
  v_code := 'PN-' || lpad(nextval('public.pneus_code_seq')::text, 6, '0');
  INSERT INTO public.tires (tire_number, code_sigtb, numero_serie, sans_numero_motif, brand, model, dimension, construction,
    indice_charge, indice_vitesse, application, date_fabrication, code_dot, purchase_date, purchase_price, prix_source,
    commande_id, facture_reference, fournisseur_id, garantie_mois, garantie_km, profondeur_initiale_mm, max_retreads,
    status, site_id, retread_count, notes, cle_client)
  VALUES (coalesce(v_serie, v_code), v_code, v_serie, CASE WHEN v_serie IS NULL THEN btrim(p_motif_sans_numero) END,
    btrim(c ->> 'marque'), btrim(c ->> 'modele'), nullif(btrim(coalesce(c ->> 'dimension', '')), ''), c ->> 'construction',
    nullif(btrim(coalesce(c ->> 'indice_charge', '')), ''), nullif(btrim(coalesce(c ->> 'indice_vitesse', '')), ''),
    nullif(btrim(coalesce(c ->> 'application', '')), ''), nullif(c ->> 'date_fabrication', '')::date,
    nullif(btrim(coalesce(c ->> 'code_dot', '')), ''), nullif(c ->> 'date_achat', '')::date, v_prix::bigint, v_source,
    v_commande, nullif(btrim(coalesce(c ->> 'facture', '')), ''), nullif(c ->> 'fournisseur', '')::uuid,
    public.pneu_nombre(c ->> 'garantie_mois', 'Garantie (mois)')::integer, public.pneu_nombre(c ->> 'garantie_km', 'Garantie (km)'),
    public.pneu_nombre(c ->> 'profondeur_initiale_mm', 'Profondeur initiale'), public.pneu_nombre(c ->> 'rechapages_max', 'Rechapages admis')::integer,
    'stored', p_site, 0, nullif(btrim(coalesce(c ->> 'note', '')), ''), nullif(btrim(coalesce(p_cle_client, '')), ''))
  RETURNING id INTO v_id;
  INSERT INTO public.pneus_operations (tire_id, type, effectue_le, site_id, profondeur_mm, reference_piece, motif, saisi_par)
  VALUES (v_id, 'entree', p_date, p_site, public.pneu_nombre(c ->> 'profondeur_initiale_mm', 'Profondeur initiale'),
          nullif(btrim(coalesce(c ->> 'reference', '')), ''),
          CASE WHEN v_serie IS NULL THEN 'Creation sans numero de serie : ' || btrim(p_motif_sans_numero) END, auth.uid());
  PERFORM public.pneu_requete_memoriser(p_cle_client, 'creer_carcasse_pneu', v_id);
  RETURN v_id;
END;
$$;

-- Correction motivee des caracteristiques (operation `correction`, avant et
-- apres dans le journal). Le code SIGTB ne change jamais.
CREATE OR REPLACE FUNCTION public.corriger_caracteristiques_pneu(p_tire uuid, p_valeurs jsonb, p_motif text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE t public.tires; v jsonb := coalesce(p_valeurs, '{}'::jsonb); v_apres public.tires; v_id uuid; v_serie text; k text;
BEGIN
  PERFORM public.texte_requis(p_motif, 'Motif de la correction');
  FOR k IN SELECT jsonb_object_keys(v) LOOP
    IF k NOT IN ('marque', 'modele', 'dimension', 'construction', 'indice_charge', 'indice_vitesse', 'application', 'date_fabrication',
                 'code_dot', 'numero_serie', 'garantie_mois', 'garantie_km', 'rechapages_max', 'facture', 'prix', 'prix_source') THEN
      RAISE EXCEPTION 'Caracteristique non corrigeable : %', k USING ERRCODE = '22023';
    END IF;
  END LOOP;
  t := public.pneu_pour_operation(p_tire, now());
  IF v ? 'numero_serie' THEN
    v_serie := public.normaliser_texte_pneu(v ->> 'numero_serie');
    IF v_serie IS NULL THEN RAISE EXCEPTION 'Numero de serie : valeur requise' USING ERRCODE = '22023'; END IF;
    IF EXISTS (SELECT 1 FROM public.tires x WHERE x.id <> p_tire
                AND (upper(btrim(x.numero_serie)) = v_serie OR upper(btrim(x.tire_number)) = v_serie)) THEN
      RAISE EXCEPTION 'Numero de serie % deja enregistre', v_serie USING ERRCODE = '23505';
    END IF;
  END IF;
  IF v ? 'construction' AND (v ->> 'construction') NOT IN ('radiale', 'diagonale') THEN
    RAISE EXCEPTION 'Construction : radiale ou diagonale' USING ERRCODE = '22023';
  END IF;
  UPDATE public.tires SET
    brand = CASE WHEN v ? 'marque' THEN public.texte_requis(v ->> 'marque', 'Marque') ELSE brand END,
    model = CASE WHEN v ? 'modele' THEN public.texte_requis(v ->> 'modele', 'Modele') ELSE model END,
    dimension = CASE WHEN v ? 'dimension' THEN nullif(btrim(coalesce(v ->> 'dimension', '')), '') ELSE dimension END,
    construction = CASE WHEN v ? 'construction' THEN v ->> 'construction' ELSE construction END,
    indice_charge = CASE WHEN v ? 'indice_charge' THEN nullif(btrim(coalesce(v ->> 'indice_charge', '')), '') ELSE indice_charge END,
    indice_vitesse = CASE WHEN v ? 'indice_vitesse' THEN nullif(btrim(coalesce(v ->> 'indice_vitesse', '')), '') ELSE indice_vitesse END,
    application = CASE WHEN v ? 'application' THEN nullif(btrim(coalesce(v ->> 'application', '')), '') ELSE application END,
    date_fabrication = CASE WHEN v ? 'date_fabrication' THEN nullif(v ->> 'date_fabrication', '')::date ELSE date_fabrication END,
    code_dot = CASE WHEN v ? 'code_dot' THEN nullif(btrim(coalesce(v ->> 'code_dot', '')), '') ELSE code_dot END,
    numero_serie = CASE WHEN v ? 'numero_serie' THEN v_serie ELSE numero_serie END,
    sans_numero_motif = CASE WHEN v ? 'numero_serie' THEN NULL ELSE sans_numero_motif END,
    tire_number = CASE WHEN v ? 'numero_serie' AND tire_number = code_sigtb THEN v_serie ELSE tire_number END,
    garantie_mois = CASE WHEN v ? 'garantie_mois' THEN public.pneu_nombre(v ->> 'garantie_mois', 'Garantie (mois)')::integer ELSE garantie_mois END,
    garantie_km = CASE WHEN v ? 'garantie_km' THEN public.pneu_nombre(v ->> 'garantie_km', 'Garantie (km)') ELSE garantie_km END,
    max_retreads = CASE WHEN v ? 'rechapages_max' THEN public.pneu_nombre(v ->> 'rechapages_max', 'Rechapages admis')::integer ELSE max_retreads END,
    facture_reference = CASE WHEN v ? 'facture' THEN nullif(btrim(coalesce(v ->> 'facture', '')), '') ELSE facture_reference END,
    purchase_price = CASE WHEN v ? 'prix' THEN public.pneu_nombre(v ->> 'prix', 'Prix')::bigint ELSE purchase_price END,
    prix_source = CASE WHEN v ? 'prix_source' THEN nullif(btrim(coalesce(v ->> 'prix_source', '')), '') ELSE prix_source END,
    updated_at = now()
   WHERE id = p_tire
  RETURNING * INTO v_apres;
  IF v_apres.purchase_price IS NOT NULL AND v_apres.prix_source IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.receptions_achat_pneus r WHERE r.tire_id = p_tire) THEN
    RAISE EXCEPTION 'Prix sans piece : source requise (bon_commande, facture ou saisie)' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.pneus_operations (tire_id, type, effectue_le, vehicle_id, "position", site_id, motif, donnees, saisi_par)
  VALUES (p_tire, 'correction', now(), t.vehicle_id, t."position", t.site_id, btrim(p_motif),
          jsonb_build_object('avant', to_jsonb(t) - 'updated_at', 'apres', to_jsonb(v_apres) - 'updated_at'), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Montage : une position = un pneu, un pneu = une position. Verrou de
-- l'engin (consultatif) puis du pneu ; controles d'etat, d'intervention,
-- d'engin, de configuration et, si le blocage est actif, de securite.
DROP FUNCTION IF EXISTS public.monter_pneu(uuid, uuid, text, timestamptz, numeric, numeric, numeric, text);
CREATE OR REPLACE FUNCTION public.monter_pneu(
  p_tire uuid, p_vehicle uuid, p_position text, p_date timestamptz DEFAULT now(), p_km numeric DEFAULT NULL,
  p_profondeur_mm numeric DEFAULT NULL, p_pression_bar numeric DEFAULT NULL, p_note text DEFAULT NULL,
  p_cle_client text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE t public.tires; v public.vehicles; v_pos text := public.normaliser_position_pneu(p_position); v_id uuid; v_prec uuid;
        v_incompat text; v_seuil numeric; v_prof numeric;
BEGIN
  v_prec := public.pneu_requete_rejouee(p_cle_client, 'monter_pneu');
  IF v_prec IS NOT NULL THEN RETURN v_prec; END IF;
  IF p_vehicle IS NULL THEN RAISE EXCEPTION 'Engin requis' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('sigtb.pneus.engin:' || p_vehicle::text));
  t := public.pneu_pour_operation(p_tire, p_date);
  IF t.status = 'en_intervention' THEN
    RAISE EXCEPTION 'Pneu en intervention : attendre son retour et la decision de remise en service' USING ERRCODE = '22023';
  ELSIF t.status = 'active' THEN
    RAISE EXCEPTION 'Pneu deja monte (%, position %) : un pneu = une position', t.vehicle_id, t."position" USING ERRCODE = '22023';
  ELSIF t.status <> 'stored' THEN
    RAISE EXCEPTION 'Seul un pneu en stock et reutilisable se monte (etat : %)', t.status USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v FROM public.vehicles WHERE id = p_vehicle;
  IF NOT FOUND OR v.status::text = 'sold' THEN RAISE EXCEPTION 'Engin introuvable ou sorti de la flotte' USING ERRCODE = '22023'; END IF;
  IF NOT public.vehicule_permis(p_vehicle) THEN RAISE EXCEPTION 'Engin hors de votre perimetre' USING ERRCODE = '42501'; END IF;
  IF v_pos IS NULL THEN RAISE EXCEPTION 'Position requise' USING ERRCODE = '22023'; END IF;
  IF public.configuration_pneus_engin(p_vehicle) IS NULL THEN
    IF public.reglage_pneu_actif('pneu_configuration_exigee') THEN
      RAISE EXCEPTION 'Aucune configuration de positions pour le modele % : montage refuse', v.brand_model USING ERRCODE = '22023';
    END IF;
  ELSE
    v_incompat := public.position_pneu_incompatible(p_vehicle, v_pos, t.dimension);
    IF v_incompat IS NOT NULL THEN RAISE EXCEPTION 'Montage incompatible : %', v_incompat USING ERRCODE = '22023'; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.tires x WHERE x.vehicle_id = p_vehicle AND x."position" = v_pos AND x.status = 'active') THEN
    RAISE EXCEPTION 'Position % deja occupee sur cet engin : une position = un pneu', v_pos USING ERRCODE = '22023';
  END IF;
  IF public.reglage_pneu_actif('pneu_blocage_montage_actif') THEN
    IF public.pneu_defaut_critique_ouvert(p_tire) IS NOT NULL THEN
      RAISE EXCEPTION 'Blocage de securite : defaut critique ouvert sur ce pneu' USING ERRCODE = '22023';
    END IF;
    SELECT s.profondeur_min_mm INTO v_seuil FROM public.seuils_pneu(p_tire) s;
    SELECT o.profondeur_mm INTO v_prof FROM public.v_pneus_operations_effectives o
     WHERE o.tire_id = p_tire AND o.profondeur_mm IS NOT NULL ORDER BY o.effectue_le DESC, o.saisi_le DESC LIMIT 1;
    v_prof := coalesce(p_profondeur_mm, v_prof);
    IF v_seuil IS NOT NULL AND v_prof IS NOT NULL AND v_prof < v_seuil THEN
      RAISE EXCEPTION 'Blocage de securite : profondeur % mm sous le seuil % mm', v_prof, v_seuil USING ERRCODE = '22023';
    END IF;
  END IF;
  INSERT INTO public.pneus_operations (tire_id, type, effectue_le, vehicle_id, "position", site_id, compteur_km,
                                       profondeur_mm, pression_bar, note, cle_client, saisi_par)
  VALUES (p_tire, 'montage', p_date, p_vehicle, v_pos, t.site_id, p_km, p_profondeur_mm, p_pression_bar,
          nullif(btrim(coalesce(p_note, '')), ''), nullif(btrim(coalesce(p_cle_client, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.recalculer_pneu(p_tire);
  PERFORM public.pneu_requete_memoriser(p_cle_client, 'monter_pneu', v_id);
  RETURN v_id;
END;
$$;

DROP FUNCTION IF EXISTS public.demonter_pneu(uuid, text, text, uuid, timestamptz, numeric, numeric, text);
CREATE OR REPLACE FUNCTION public.demonter_pneu(
  p_tire uuid, p_motif text, p_etat text, p_site uuid, p_date timestamptz DEFAULT now(), p_km numeric DEFAULT NULL,
  p_profondeur_mm numeric DEFAULT NULL, p_note text DEFAULT NULL, p_cle_client text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE t public.tires; v_km_montage numeric; v_id uuid; v_prec uuid; v_engin uuid;
BEGIN
  v_prec := public.pneu_requete_rejouee(p_cle_client, 'demonter_pneu');
  IF v_prec IS NOT NULL THEN RETURN v_prec; END IF;
  SELECT vehicle_id INTO v_engin FROM public.tires WHERE id = p_tire;
  IF v_engin IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtext('sigtb.pneus.engin:' || v_engin::text)); END IF;
  t := public.pneu_pour_operation(p_tire, p_date);
  IF t.status <> 'active' THEN RAISE EXCEPTION 'Le pneu n''est pas monte' USING ERRCODE = '22023'; END IF;
  IF p_etat NOT IN ('stored', 'damaged') THEN
    RAISE EXCEPTION 'Etat au demontage : reutilisable (stored) ou a decider (damaged)' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN RAISE EXCEPTION 'Motif du demontage requis' USING ERRCODE = '22023'; END IF;
  PERFORM public.site_stock_pneu(p_site);
  v_km_montage := public.km_montage_en_cours(p_tire);
  IF p_km IS NOT NULL AND v_km_montage IS NOT NULL AND p_km < v_km_montage THEN
    RAISE EXCEPTION 'Compteur au demontage (%) inferieur au compteur au montage (%)', p_km, v_km_montage USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.pneus_operations (tire_id, type, effectue_le, vehicle_id, "position", site_id, compteur_km,
                                       profondeur_mm, etat_sortie, motif, note, cle_client, saisi_par)
  VALUES (p_tire, 'demontage', p_date, t.vehicle_id, t."position", p_site, p_km, p_profondeur_mm, p_etat,
          btrim(p_motif), nullif(btrim(coalesce(p_note, '')), ''), nullif(btrim(coalesce(p_cle_client, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.recalculer_pneu(p_tire);
  PERFORM public.pneu_requete_memoriser(p_cle_client, 'demonter_pneu', v_id);
  RETURN v_id;
END;
$$;

-- Permutation : reprise de 20261116210000, verrou de l'engin et controle
-- de compatibilite des deux positions.
CREATE OR REPLACE FUNCTION public.permuter_pneu(
  p_tire uuid, p_position text, p_date timestamptz DEFAULT now(), p_km numeric DEFAULT NULL, p_motif text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE t public.tires; autre public.tires; v_pos text := public.normaliser_position_pneu(p_position); v_id uuid; v_id2 uuid;
        v_km_montage numeric; v_engin uuid; v_incompat text;
BEGIN
  SELECT vehicle_id INTO v_engin FROM public.tires WHERE id = p_tire;
  IF v_engin IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtext('sigtb.pneus.engin:' || v_engin::text)); END IF;
  t := public.pneu_pour_operation(p_tire, p_date);
  IF t.status <> 'active' THEN RAISE EXCEPTION 'Le pneu n''est pas monte' USING ERRCODE = '22023'; END IF;
  IF v_pos IS NULL OR v_pos = t."position" THEN RAISE EXCEPTION 'Nouvelle position requise' USING ERRCODE = '22023'; END IF;
  v_km_montage := public.km_montage_en_cours(p_tire);
  IF p_km IS NOT NULL AND v_km_montage IS NOT NULL AND p_km < v_km_montage THEN
    RAISE EXCEPTION 'Compteur (%) inferieur au compteur au montage (%)', p_km, v_km_montage USING ERRCODE = '22023';
  END IF;
  v_incompat := public.position_pneu_incompatible(t.vehicle_id, v_pos, t.dimension);
  IF v_incompat IS NOT NULL THEN RAISE EXCEPTION 'Permutation incompatible : %', v_incompat USING ERRCODE = '22023'; END IF;
  SELECT * INTO autre FROM public.tires WHERE vehicle_id = t.vehicle_id AND "position" = v_pos AND status = 'active' FOR UPDATE;
  IF autre.id IS NOT NULL THEN
    v_incompat := public.position_pneu_incompatible(t.vehicle_id, t."position", autre.dimension);
    IF v_incompat IS NOT NULL THEN RAISE EXCEPTION 'Permutation incompatible : %', v_incompat USING ERRCODE = '22023'; END IF;
  END IF;
  INSERT INTO public.pneus_operations (tire_id, type, effectue_le, vehicle_id, "position", position_precedente, compteur_km, motif, saisi_par)
  VALUES (p_tire, 'permutation', p_date, t.vehicle_id, v_pos, t."position", p_km, nullif(btrim(coalesce(p_motif, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  IF autre.id IS NOT NULL THEN
    PERFORM public.pneu_pour_operation(autre.id, p_date);
    INSERT INTO public.pneus_operations (tire_id, type, effectue_le, vehicle_id, "position", position_precedente, compteur_km,
                                         motif, operation_liee_id, saisi_par)
    VALUES (autre.id, 'permutation', p_date, t.vehicle_id, t."position", v_pos, p_km, nullif(btrim(coalesce(p_motif, '')), ''), v_id, auth.uid())
    RETURNING id INTO v_id2;
    UPDATE public.tires SET "position" = NULL WHERE id IN (p_tire, autre.id);
    PERFORM public.recalculer_pneu(autre.id);
  END IF;
  PERFORM public.recalculer_pneu(p_tire);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.transferer_pneu(
  p_tire uuid, p_site uuid, p_motif text, p_date timestamptz DEFAULT now(), p_cle_client text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE t public.tires; v_id uuid; v_prec uuid;
BEGIN
  v_prec := public.pneu_requete_rejouee(p_cle_client, 'transferer_pneu');
  IF v_prec IS NOT NULL THEN RETURN v_prec; END IF;
  t := public.pneu_pour_operation(p_tire, p_date);
  IF t.status NOT IN ('stored', 'damaged') THEN RAISE EXCEPTION 'Seul un pneu en stock se transfere' USING ERRCODE = '22023'; END IF;
  PERFORM public.site_stock_pneu(p_site);
  IF p_site = t.site_id THEN RAISE EXCEPTION 'Site de destination identique au site actuel' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.pneus_operations (tire_id, type, effectue_le, site_id, etat_sortie, motif, cle_client, saisi_par, donnees)
  VALUES (p_tire, 'transfert', p_date, p_site, t.status, public.texte_requis(p_motif, 'Motif du transfert'),
          nullif(btrim(coalesce(p_cle_client, '')), ''), auth.uid(), jsonb_build_object('site_origine', t.site_id))
  RETURNING id INTO v_id;
  PERFORM public.recalculer_pneu(p_tire);
  PERFORM public.pneu_requete_memoriser(p_cle_client, 'transferer_pneu', v_id);
  RETURN v_id;
END;
$$;

-- Reprises de 20261116210000 : le circuit direct (sans controle) est refuse
-- quand le blocage de remise en service est actif.
CREATE OR REPLACE FUNCTION public.rechaper_pneu(
  p_tire uuid, p_prestataire text, p_site uuid, p_date timestamptz DEFAULT now(), p_cout bigint DEFAULT NULL,
  p_profondeur_mm numeric DEFAULT NULL, p_reference text DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE t public.tires; v_faits integer; v_id uuid;
BEGIN
  IF public.reglage_pneu_actif('pneu_blocage_remise_service_actif') THEN
    RAISE EXCEPTION 'Remise en service controlee : passer par une intervention (envoi, retour, controle, decision)' USING ERRCODE = '22023';
  END IF;
  t := public.pneu_pour_operation(p_tire, p_date);
  IF t.status NOT IN ('stored', 'damaged') THEN RAISE EXCEPTION 'Seul un pneu demonte se rechape' USING ERRCODE = '22023'; END IF;
  IF nullif(btrim(coalesce(p_prestataire, '')), '') IS NULL THEN RAISE EXCEPTION 'Prestataire du rechapage requis' USING ERRCODE = '22023'; END IF;
  IF p_cout IS NOT NULL AND p_cout < 0 THEN RAISE EXCEPTION 'Cout positif ou absent' USING ERRCODE = '22023'; END IF;
  PERFORM public.site_stock_pneu(p_site);
  SELECT count(*) INTO v_faits FROM public.v_pneus_operations_effectives o WHERE o.tire_id = p_tire AND o.type = 'rechapage';
  IF t.max_retreads IS NOT NULL AND v_faits >= t.max_retreads THEN
    RAISE EXCEPTION 'Nombre maximal de rechapages atteint (%)', t.max_retreads USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.pneus_operations (tire_id, type, effectue_le, site_id, profondeur_mm, cout, prestataire, reference_piece, note, saisi_par)
  VALUES (p_tire, 'rechapage', p_date, p_site, p_profondeur_mm, p_cout, btrim(p_prestataire),
          nullif(btrim(coalesce(p_reference, '')), ''), nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.recalculer_pneu(p_tire);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reparer_pneu(
  p_tire uuid, p_site uuid, p_date timestamptz DEFAULT now(), p_cout bigint DEFAULT NULL, p_prestataire text DEFAULT NULL,
  p_profondeur_mm numeric DEFAULT NULL, p_reference text DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE t public.tires; v_id uuid;
BEGIN
  IF public.reglage_pneu_actif('pneu_blocage_remise_service_actif') THEN
    RAISE EXCEPTION 'Remise en service controlee : passer par une intervention (envoi, retour, controle, decision)' USING ERRCODE = '22023';
  END IF;
  t := public.pneu_pour_operation(p_tire, p_date);
  IF t.status <> 'damaged' THEN RAISE EXCEPTION 'Seul un pneu a decider se repare' USING ERRCODE = '22023'; END IF;
  IF p_cout IS NOT NULL AND p_cout < 0 THEN RAISE EXCEPTION 'Cout positif ou absent' USING ERRCODE = '22023'; END IF;
  PERFORM public.site_stock_pneu(p_site);
  INSERT INTO public.pneus_operations (tire_id, type, effectue_le, site_id, profondeur_mm, cout, prestataire, reference_piece, note, saisi_par)
  VALUES (p_tire, 'reparation', p_date, p_site, p_profondeur_mm, p_cout, nullif(btrim(coalesce(p_prestataire, '')), ''),
          nullif(btrim(coalesce(p_reference, '')), ''), nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.recalculer_pneu(p_tire);
  RETURN v_id;
END;
$$;

-- ===================================================================
-- 9. Inspection detaillee et proposition d'immobilisation
-- ===================================================================

CREATE OR REPLACE FUNCTION public.proposer_immobilisation_pneu(p_tire uuid, p_motif text, p_operation uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE t public.tires; v_id uuid;
BEGIN
  IF NOT (public.has_module_write('vehicles') OR public.has_module_write('maintenance') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la flotte ou la maintenance requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO t FROM public.tires WHERE id = p_tire;
  IF NOT FOUND OR NOT public.pneu_permis(t.vehicle_id, t.site_id) THEN
    RAISE EXCEPTION 'Pneu introuvable ou hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  IF t.status <> 'active' THEN RAISE EXCEPTION 'Proposition d''immobilisation : pneu monte requis' USING ERRCODE = '22023'; END IF;
  SELECT id INTO v_id FROM public.pneus_propositions_immobilisation WHERE vehicle_id = t.vehicle_id AND statut = 'proposee';
  IF FOUND THEN RETURN v_id; END IF;
  INSERT INTO public.pneus_propositions_immobilisation (vehicle_id, tire_id, operation_id, motif, propose_par)
  VALUES (t.vehicle_id, p_tire, p_operation, public.texte_requis(p_motif, 'Motif de la proposition'), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Decision humaine : accepter declare l'immobilisation (cause
-- pneumatique, imputation choisie, D-025) ; le Dispatch la voit (D-087).
CREATE OR REPLACE FUNCTION public.decider_proposition_immobilisation(
  p_id uuid, p_accepter boolean, p_motif text, p_imputation text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.pneus_propositions_immobilisation; t public.tires; v_immo uuid;
BEGIN
  IF NOT (public.has_module_write('maintenance') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la maintenance requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO p FROM public.pneus_propositions_immobilisation WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.vehicule_permis(p.vehicle_id) THEN
    RAISE EXCEPTION 'Proposition introuvable ou hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  IF p.statut <> 'proposee' THEN RAISE EXCEPTION 'Proposition deja decidee' USING ERRCODE = '22023'; END IF;
  PERFORM public.texte_requis(p_motif, 'Motif de la decision');
  IF p_accepter IS NULL THEN RAISE EXCEPTION 'Decision requise' USING ERRCODE = '22023'; END IF;
  IF p_accepter THEN
    SELECT * INTO t FROM public.tires WHERE id = p.tire_id;
    v_immo := public.declarer_immobilisation(p.vehicle_id, now(), 'pneumatique', p_imputation,
                'Pneu ' || t.code_sigtb || coalesce(' (' || t."position" || ')', '') || ' : ' || p.motif || ' / ' || btrim(p_motif));
  END IF;
  UPDATE public.pneus_propositions_immobilisation
     SET statut = CASE WHEN p_accepter THEN 'acceptee' ELSE 'refusee' END, decide_par = auth.uid(), decide_le = now(),
         motif_decision = btrim(p_motif), immobilisation_id = v_immo
   WHERE id = p_id;
  RETURN v_immo;
END;
$$;

CREATE OR REPLACE FUNCTION public.inspecter_pneu_detail(
  p_tire uuid, p_inspecte_le timestamptz, p_nature text, p_mesures jsonb DEFAULT NULL, p_pression_bar numeric DEFAULT NULL,
  p_temperature_c numeric DEFAULT NULL, p_constats jsonb DEFAULT NULL, p_recommandation text DEFAULT NULL,
  p_km numeric DEFAULT NULL, p_note text DEFAULT NULL, p_cle_client text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  t public.tires; v_op uuid; v_id uuid; v_prec uuid; v_min numeric; v_max numeric; v_nb integer := 0; z record; c jsonb;
  v_critique boolean := false; v_nb_constats integer := 0; v_mesures jsonb := '{}'::jsonb;
BEGIN
  v_prec := public.pneu_requete_rejouee(p_cle_client, 'inspecter_pneu_detail');
  IF v_prec IS NOT NULL THEN RETURN v_prec; END IF;
  IF p_nature IS NULL OR p_nature NOT IN ('mesure', 'observation', 'declaration', 'import') THEN
    RAISE EXCEPTION 'Nature : mesure, observation, declaration ou import' USING ERRCODE = '22023';
  END IF;
  t := public.pneu_pour_operation(p_tire, p_inspecte_le);
  IF t.status IN ('retired', 'en_intervention') THEN
    RAISE EXCEPTION 'Pneu reforme ou en intervention : inspection refusee' USING ERRCODE = '22023';
  END IF;
  IF p_mesures IS NOT NULL THEN
    IF jsonb_typeof(p_mesures) <> 'object' THEN RAISE EXCEPTION 'Mesures : objet {zone: profondeur mm}' USING ERRCODE = '22023'; END IF;
    FOR z IN SELECT key, value FROM jsonb_each_text(p_mesures) LOOP
      IF public.normaliser_texte_pneu(z.key) IS NULL THEN RAISE EXCEPTION 'Zone de mesure sans nom' USING ERRCODE = '22023'; END IF;
      v_mesures := v_mesures || jsonb_build_object(public.normaliser_texte_pneu(z.key), public.pneu_nombre(z.value, 'Profondeur ' || z.key));
      v_nb := v_nb + 1;
    END LOOP;
    SELECT min(value::numeric), max(value::numeric) INTO v_min, v_max FROM jsonb_each_text(v_mesures);
  END IF;
  IF p_pression_bar IS NOT NULL AND p_pression_bar <= 0 THEN RAISE EXCEPTION 'Pression strictement positive ou absente' USING ERRCODE = '22023'; END IF;
  IF p_constats IS NOT NULL THEN
    IF jsonb_typeof(p_constats) <> 'array' THEN RAISE EXCEPTION 'Constats : liste' USING ERRCODE = '22023'; END IF;
    FOR c IN SELECT * FROM jsonb_array_elements(p_constats) LOOP
      PERFORM public.texte_requis(c ->> 'code', 'Code du constat');
      IF coalesce(c ->> 'gravite', '') NOT IN ('info', 'majeur', 'critique') THEN
        RAISE EXCEPTION 'Gravite du constat : info, majeur ou critique' USING ERRCODE = '22023';
      END IF;
      v_critique := v_critique OR c ->> 'gravite' = 'critique';
      v_nb_constats := v_nb_constats + 1;
    END LOOP;
  END IF;
  IF p_nature = 'mesure' AND v_nb = 0 AND p_pression_bar IS NULL AND p_temperature_c IS NULL THEN
    RAISE EXCEPTION 'Inspection de nature mesure : au moins une mesure (profondeur, pression ou temperature)' USING ERRCODE = '22023';
  END IF;
  IF v_nb = 0 AND p_pression_bar IS NULL AND p_temperature_c IS NULL AND v_nb_constats = 0 THEN
    RAISE EXCEPTION 'Inspection vide : mesure ou constat requis' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.pneus_operations (tire_id, type, effectue_le, vehicle_id, "position", site_id, compteur_km,
                                       profondeur_mm, pression_bar, note, cle_client, saisi_par)
  VALUES (p_tire, 'inspection', p_inspecte_le, t.vehicle_id, t."position", t.site_id, p_km, v_min, p_pression_bar,
          nullif(btrim(coalesce(p_note, '')), ''), nullif(btrim(coalesce(p_cle_client, '')), ''), auth.uid())
  RETURNING id INTO v_op;
  INSERT INTO public.pneus_inspections (operation_id, tire_id, nature, inspecte_le, mesures, profondeur_min_mm, ecart_mm,
                                        pression_bar, temperature_c, constats, defaut_critique, recommandation, inspecteur)
  VALUES (v_op, p_tire, p_nature, p_inspecte_le, CASE WHEN v_nb > 0 THEN v_mesures END, v_min,
          CASE WHEN v_nb >= 2 THEN v_max - v_min END, p_pression_bar, p_temperature_c, p_constats, v_critique,
          p_recommandation, auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.recalculer_pneu(p_tire);
  -- Defaut critique sur un pneu monte : proposition, jamais d'immobilisation automatique.
  IF v_critique AND t.status = 'active' THEN
    PERFORM public.proposer_immobilisation_pneu(p_tire, 'Defaut critique constate a l''inspection du '
      || to_char(p_inspecte_le, 'DD/MM/YYYY HH24:MI'), v_op);
  END IF;
  PERFORM public.pneu_requete_memoriser(p_cle_client, 'inspecter_pneu_detail', v_id);
  RETURN v_id;
END;
$$;

-- ===================================================================
-- 10. Interventions : envoi, retour, controle, decision, annulation
-- ===================================================================

CREATE OR REPLACE FUNCTION public.envoyer_pneu_intervention(
  p_tire uuid, p_type text, p_prestataire text, p_date timestamptz DEFAULT now(), p_type_autre text DEFAULT NULL,
  p_fournisseur uuid DEFAULT NULL, p_criteres jsonb DEFAULT NULL, p_reference text DEFAULT NULL, p_note text DEFAULT NULL,
  p_cle_client text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  t public.tires; v_id uuid := gen_random_uuid(); v_op uuid; v_prec uuid; v_cycle integer; v_max integer; r record;
  v_crit jsonb := coalesce(p_criteres, '{}'::jsonb);
BEGIN
  v_prec := public.pneu_requete_rejouee(p_cle_client, 'envoyer_pneu_intervention');
  IF v_prec IS NOT NULL THEN RETURN v_prec; END IF;
  IF p_type IS NULL OR p_type NOT IN ('reparation', 'vulcanisation', 'rechapage', 'expertise', 'autre') THEN
    RAISE EXCEPTION 'Type d''intervention : reparation, vulcanisation, rechapage, expertise ou autre' USING ERRCODE = '22023';
  END IF;
  t := public.pneu_pour_operation(p_tire, p_date);
  IF t.status NOT IN ('stored', 'damaged') THEN RAISE EXCEPTION 'Seul un pneu demonte part en intervention' USING ERRCODE = '22023'; END IF;
  PERFORM public.texte_requis(p_prestataire, 'Prestataire');
  IF jsonb_typeof(v_crit) <> 'object' THEN RAISE EXCEPTION 'Criteres : objet {code: true|false}' USING ERRCODE = '22023'; END IF;
  IF p_type = 'rechapage' THEN
    v_cycle := t.retread_count + 1;
    v_max := coalesce(t.max_retreads, (SELECT s.rechapages_max FROM public.seuils_pneu(p_tire) s));
    IF v_max IS NOT NULL AND v_cycle > v_max THEN
      RAISE EXCEPTION 'Nombre admissible de rechapages atteint (%)', v_max USING ERRCODE = '22023';
    END IF;
    -- Criteres d'acceptation applicables : chacun renseigne ; un critere
    -- bloquant non satisfait refuse l'envoi.
    FOR r IN SELECT c.code, c.libelle, c.bloquant FROM public.pneus_criteres_rechapage c
              WHERE c.actif
                AND (c.dimension IS NULL OR c.dimension = public.normaliser_dimension_pneu(t.dimension))
                AND (c.marque IS NULL OR c.marque = public.normaliser_texte_pneu(t.brand))
                AND (c.modele IS NULL OR c.modele = public.normaliser_texte_pneu(t.model)) LOOP
      IF NOT v_crit ? r.code OR jsonb_typeof(v_crit -> r.code) <> 'boolean' THEN
        RAISE EXCEPTION 'Critere de rechapage non renseigne : % (%)', r.code, r.libelle USING ERRCODE = '22023';
      END IF;
      IF r.bloquant AND NOT (v_crit ->> r.code)::boolean THEN
        RAISE EXCEPTION 'Carcasse refusee au rechapage : critere % non satisfait', r.code USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END IF;
  INSERT INTO public.pneus_interventions (id, numero, tire_id, type, type_autre, cycle_rechapage, prestataire, fournisseur_id,
                                          criteres, envoye_le, envoye_par, cle_client)
  VALUES (v_id, 'IPN-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.pneus_interventions_seq')::text, 5, '0'),
          p_tire, p_type, nullif(btrim(coalesce(p_type_autre, '')), ''), v_cycle, btrim(p_prestataire), p_fournisseur,
          CASE WHEN v_crit = '{}'::jsonb THEN NULL ELSE v_crit END, p_date, auth.uid(), nullif(btrim(coalesce(p_cle_client, '')), ''));
  INSERT INTO public.pneus_operations (tire_id, type, effectue_le, site_id, prestataire, reference_piece, note, intervention_id, saisi_par)
  VALUES (p_tire, 'envoi_intervention', p_date, t.site_id, btrim(p_prestataire), nullif(btrim(coalesce(p_reference, '')), ''),
          nullif(btrim(coalesce(p_note, '')), ''), v_id, auth.uid())
  RETURNING id INTO v_op;
  UPDATE public.pneus_interventions SET envoi_operation_id = v_op WHERE id = v_id;
  PERFORM public.recalculer_pneu(p_tire);
  PERFORM public.pneu_requete_memoriser(p_cle_client, 'envoyer_pneu_intervention', v_id);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.intervention_pneu_pour_action(p_id uuid)
RETURNS public.pneus_interventions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE i public.pneus_interventions; t public.tires;
BEGIN
  SELECT * INTO i FROM public.pneus_interventions WHERE id = p_id FOR UPDATE;
  IF FOUND THEN SELECT * INTO t FROM public.tires WHERE id = i.tire_id; END IF;
  IF NOT FOUND OR NOT public.pneu_permis(t.vehicle_id, t.site_id) THEN
    RAISE EXCEPTION 'Intervention introuvable ou hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  RETURN i;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.intervention_pneu_pour_action(uuid) FROM PUBLIC, anon, authenticated;

-- Retour : operation de cout (rechapage, reparation, ou retour pour une
-- expertise ou autre) ; le pneu attend controle et decision.
CREATE OR REPLACE FUNCTION public.enregistrer_retour_intervention(
  p_intervention uuid, p_site uuid, p_date timestamptz DEFAULT now(), p_cout bigint DEFAULT NULL,
  p_profondeur_mm numeric DEFAULT NULL, p_constats text DEFAULT NULL, p_garantie_mois integer DEFAULT NULL,
  p_garantie_km numeric DEFAULT NULL, p_reference text DEFAULT NULL, p_bon_commande uuid DEFAULT NULL,
  p_facture text DEFAULT NULL, p_cle_client text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE i public.pneus_interventions; v_op uuid; v_prec uuid; v_type text;
BEGIN
  v_prec := public.pneu_requete_rejouee(p_cle_client, 'enregistrer_retour_intervention');
  IF v_prec IS NOT NULL THEN RETURN v_prec; END IF;
  i := public.intervention_pneu_pour_action(p_intervention);
  IF i.statut <> 'envoyee' THEN RAISE EXCEPTION 'Intervention deja retournee ou close' USING ERRCODE = '22023'; END IF;
  PERFORM public.pneu_pour_operation(i.tire_id, p_date);
  PERFORM public.site_stock_pneu(p_site);
  IF p_cout IS NOT NULL AND p_cout < 0 THEN RAISE EXCEPTION 'Cout positif ou absent' USING ERRCODE = '22023'; END IF;
  IF p_bon_commande IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = p_bon_commande) THEN
    RAISE EXCEPTION 'Bon de commande introuvable' USING ERRCODE = '22023';
  END IF;
  v_type := CASE i.type WHEN 'rechapage' THEN 'rechapage' WHEN 'reparation' THEN 'reparation' WHEN 'vulcanisation' THEN 'reparation'
                        ELSE 'retour_intervention' END;
  INSERT INTO public.pneus_operations (tire_id, type, effectue_le, site_id, profondeur_mm, cout, prestataire, reference_piece,
                                       note, intervention_id, cle_client, saisi_par)
  VALUES (i.tire_id, v_type, p_date, p_site, p_profondeur_mm, p_cout, i.prestataire, nullif(btrim(coalesce(p_reference, '')), ''),
          nullif(btrim(coalesce(p_constats, '')), ''), i.id, nullif(btrim(coalesce(p_cle_client, '')), ''), auth.uid())
  RETURNING id INTO v_op;
  UPDATE public.pneus_interventions SET statut = 'retournee', retour_le = p_date, retour_par = auth.uid(), retour_operation_id = v_op,
         cout = p_cout, profondeur_retour_mm = p_profondeur_mm, constats = nullif(btrim(coalesce(p_constats, '')), ''),
         garantie_mois = p_garantie_mois, garantie_km = p_garantie_km, bon_commande_id = p_bon_commande,
         facture_reference = nullif(btrim(coalesce(p_facture, '')), '')
   WHERE id = i.id;
  PERFORM public.recalculer_pneu(i.tire_id);
  PERFORM public.pneu_requete_memoriser(p_cle_client, 'enregistrer_retour_intervention', v_op);
  RETURN v_op;
END;
$$;

CREATE OR REPLACE FUNCTION public.controler_intervention_pneu(p_intervention uuid, p_conforme boolean, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE i public.pneus_interventions;
BEGIN
  IF NOT (public.has_module_write('vehicles') OR public.has_module_write('maintenance') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la flotte ou la maintenance requis' USING ERRCODE = '42501';
  END IF;
  i := public.intervention_pneu_pour_action(p_intervention);
  IF i.statut <> 'retournee' THEN RAISE EXCEPTION 'Controle possible apres le retour seulement' USING ERRCODE = '22023'; END IF;
  IF p_conforme IS NULL THEN RAISE EXCEPTION 'Resultat du controle requis' USING ERRCODE = '22023'; END IF;
  IF NOT p_conforme THEN PERFORM public.texte_requis(p_note, 'Constat du controle non conforme'); END IF;
  UPDATE public.pneus_interventions SET statut = 'controlee', controle_resultat = CASE WHEN p_conforme THEN 'conforme' ELSE 'non_conforme' END,
         controle_note = nullif(btrim(coalesce(p_note, '')), ''), controle_par = auth.uid(), controle_le = now()
   WHERE id = i.id;
END;
$$;

-- Decision : approbateur de la maintenance (ou administrateur), distinct de
-- l'auteur du retour et du controle (separation_violee, D-082).
CREATE OR REPLACE FUNCTION public.decider_remise_en_service_pneu(p_intervention uuid, p_decision text, p_motif text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE i public.pneus_interventions; t public.tires; v_op uuid;
BEGIN
  IF NOT (public.has_module_approve('maintenance') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Decision de remise en service reservee a un approbateur de la maintenance' USING ERRCODE = '42501';
  END IF;
  i := public.intervention_pneu_pour_action(p_intervention);
  IF i.statut <> 'controlee' THEN RAISE EXCEPTION 'Decision apres le controle seulement' USING ERRCODE = '22023'; END IF;
  IF public.separation_violee(i.retour_par, 'maintenance', 'maintenance', i.retour_le)
     OR public.separation_violee(i.controle_par, 'maintenance', 'maintenance', i.controle_le) THEN
    RAISE EXCEPTION 'Separation des taches : l''auteur du retour ou du controle ne decide pas la remise en service' USING ERRCODE = '42501';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('remis_en_service', 'reforme', 'a_reprendre') THEN
    RAISE EXCEPTION 'Decision : remis_en_service, reforme ou a_reprendre' USING ERRCODE = '22023';
  END IF;
  IF p_decision = 'remis_en_service' AND i.controle_resultat <> 'conforme' THEN
    RAISE EXCEPTION 'Controle non conforme : remise en service refusee' USING ERRCODE = '22023';
  END IF;
  IF p_decision <> 'remis_en_service' THEN PERFORM public.texte_requis(p_motif, 'Motif de la decision'); END IF;
  t := public.pneu_pour_operation(i.tire_id, now());
  IF p_decision = 'remis_en_service' THEN
    INSERT INTO public.pneus_operations (tire_id, type, effectue_le, site_id, motif, intervention_id, saisi_par)
    VALUES (i.tire_id, 'remise_en_service', now(), t.site_id, nullif(btrim(coalesce(p_motif, '')), ''), i.id, auth.uid())
    RETURNING id INTO v_op;
  ELSIF p_decision = 'reforme' THEN
    INSERT INTO public.pneus_operations (tire_id, type, effectue_le, site_id, motif, intervention_id, saisi_par)
    VALUES (i.tire_id, 'reforme', now(), t.site_id, btrim(p_motif), i.id, auth.uid())
    RETURNING id INTO v_op;
  END IF;
  UPDATE public.pneus_interventions SET statut = 'cloturee', decision = p_decision, decision_motif = nullif(btrim(coalesce(p_motif, '')), ''),
         decide_par = auth.uid(), decide_le = now()
   WHERE id = i.id;
  PERFORM public.recalculer_pneu(i.tire_id);
  RETURN v_op;
END;
$$;

CREATE OR REPLACE FUNCTION public.annuler_intervention_pneu(p_intervention uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE i public.pneus_interventions;
BEGIN
  i := public.intervention_pneu_pour_action(p_intervention);
  IF i.statut <> 'envoyee' THEN
    RAISE EXCEPTION 'Seule une intervention non retournee s''annule (sinon : decision de reforme ou nouvelle intervention)' USING ERRCODE = '22023';
  END IF;
  PERFORM public.annuler_operation_pneu(i.envoi_operation_id, public.texte_requis(p_motif, 'Motif de l''annulation'));
END;
$$;

-- ===================================================================
-- 11. Vues : registre, episodes, mouvements, stock, usure, couts,
--     indicateurs, positions, surveillance
-- ===================================================================

-- Reprise de 20261120101000 (C7) : couts de toutes les interventions,
-- colonnes D-091 ajoutees en fin.
CREATE OR REPLACE VIEW public.v_pneus WITH (security_invoker = true) AS
SELECT t.id, t.tire_number, t.brand, t.model, t.dimension, t.status, t.vehicle_id, t."position", t.site_id,
       t.purchase_date, t.purchase_price, t.fournisseur_id, t.retread_count, t.max_retreads, t.installation_date,
       t.last_inspection_date, t.notes,
       km.nb_montages, km.km_parcourus, coalesce(km.km_incomplet, false) AS km_incomplet,
       rc.cout_rechapages,
       CASE WHEN t.purchase_price IS NOT NULL AND NOT coalesce(rc.cout_inconnu, false)
            THEN t.purchase_price + coalesce(rc.cout_rechapages, 0) END AS cout_total,
       CASE WHEN t.purchase_price IS NOT NULL AND NOT coalesce(km.km_incomplet, false) AND km.km_parcourus > 0
            AND NOT coalesce(rc.cout_inconnu, false)
            THEN round((t.purchase_price + coalesce(rc.cout_rechapages, 0)) / km.km_parcourus, 2) END AS cout_km,
       p.profondeur_mm AS derniere_profondeur_mm, p.effectue_le AS profondeur_mesuree_le,
       t.code_sigtb, t.numero_serie, t.sans_numero_motif IS NOT NULL AS sans_numero_serie, t.application,
       t.construction, t.profondeur_initiale_mm, t.garantie_mois, t.garantie_km,
       public.configuration_pneus_engin(t.vehicle_id) AS configuration_id
  FROM public.tires t
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS nb_montages, sum(m.km_parcourus) AS km_parcourus, bool_or(m.km_parcourus IS NULL) AS km_incomplet
      FROM public.v_pneus_montages m WHERE m.tire_id = t.id) km ON true
  LEFT JOIN LATERAL (
    SELECT sum(o.cout) AS cout_rechapages, bool_or(o.cout IS NULL) AS cout_inconnu
      FROM public.v_pneus_operations_effectives o WHERE o.tire_id = t.id
       AND o.type IN ('rechapage', 'reparation', 'retour_intervention')) rc ON true
  LEFT JOIN LATERAL (
    SELECT o.profondeur_mm, o.effectue_le FROM public.v_pneus_operations_effectives o
     WHERE o.tire_id = t.id AND o.profondeur_mm IS NOT NULL ORDER BY o.effectue_le DESC, o.saisi_le DESC LIMIT 1) p ON true;
GRANT SELECT ON public.v_pneus TO authenticated;

-- Episodes de service : neuf (entree), puis chaque remise en service apres
-- intervention (ou rechapage et reparation directs, D-052). Le numero de
-- cycle de rechapage compte les rechapages effectifs jusqu'a l'episode.
CREATE OR REPLACE VIEW public.v_pneus_episodes WITH (security_invoker = true) AS
WITH d AS (
  SELECT o.tire_id, o.id AS operation_id, o.effectue_le, o.saisi_le, o.intervention_id,
         CASE WHEN o.type = 'entree' THEN 'neuf'
              WHEN o.type = 'rechapage' OR i.type = 'rechapage' THEN 'apres_rechapage'
              WHEN o.type = 'reparation' OR i.type IN ('reparation', 'vulcanisation') THEN 'apres_reparation'
              ELSE 'apres_controle' END AS nature
    FROM public.v_pneus_operations_effectives o
    LEFT JOIN public.pneus_interventions i ON i.id = o.intervention_id
   WHERE o.type IN ('entree', 'remise_en_service') OR (o.type IN ('rechapage', 'reparation') AND o.intervention_id IS NULL)
)
SELECT d.tire_id, row_number() OVER w AS numero_episode, d.nature,
       (SELECT count(*)::int FROM public.v_pneus_operations_effectives r
         WHERE r.tire_id = d.tire_id AND r.type = 'rechapage' AND (r.effectue_le, r.saisi_le) <= (d.effectue_le, d.saisi_le)) AS cycle_rechapage,
       d.effectue_le AS debut,
       coalesce(lead(d.effectue_le) OVER w,
                (SELECT min(f.effectue_le) FROM public.v_pneus_operations_effectives f
                  WHERE f.tire_id = d.tire_id AND f.type IN ('reforme', 'envoi_intervention')
                    AND (f.effectue_le, f.saisi_le) > (d.effectue_le, d.saisi_le))) AS fin,
       d.operation_id AS operation_origine_id, d.intervention_id
  FROM d
WINDOW w AS (PARTITION BY d.tire_id ORDER BY d.effectue_le, d.saisi_le);
GRANT SELECT ON public.v_pneus_episodes TO authenticated;

-- Mouvements de stock : lecture du journal (aucun solde stocke).
CREATE OR REPLACE VIEW public.v_pneus_mouvements WITH (security_invoker = true) AS
SELECT o.id, o.tire_id, t.code_sigtb, o.effectue_le, o.saisi_le,
       CASE o.type
         WHEN 'entree' THEN CASE WHEN EXISTS (SELECT 1 FROM public.receptions_achat_pneus r WHERE r.tire_id = o.tire_id)
                                 THEN 'reception' ELSE 'entree' END
         WHEN 'envoi_intervention' THEN CASE WHEN i.type = 'rechapage' THEN 'envoi_rechapage' ELSE 'envoi_reparation' END
         WHEN 'rechapage' THEN CASE WHEN o.intervention_id IS NULL THEN 'rechapage' ELSE 'retour_rechapage' END
         WHEN 'reparation' THEN CASE WHEN o.intervention_id IS NULL THEN 'reparation' ELSE 'retour_reparation' END
         WHEN 'retour_intervention' THEN 'retour_reparation'
         WHEN 'annulation' THEN 'correction'
         ELSE o.type END AS mouvement,
       o.vehicle_id, o."position", o.site_id, (o.donnees ->> 'site_origine')::uuid AS site_origine_id,
       o.motif, o.intervention_id, o.annule_operation_id, o.saisi_par,
       EXISTS (SELECT 1 FROM public.pneus_operations a WHERE a.annule_operation_id = o.id) AS annule
  FROM public.pneus_operations o
  JOIN public.tires t ON t.id = o.tire_id
  LEFT JOIN public.pneus_interventions i ON i.id = o.intervention_id
 WHERE o.type NOT IN ('inspection');
GRANT SELECT ON public.v_pneus_mouvements TO authenticated;

-- Stock : pneus hors engin, calcule depuis l'etat recalcule par le journal.
CREATE OR REPLACE VIEW public.v_pneus_stock WITH (security_invoker = true) AS
SELECT t.site_id, t.status, upper(btrim(t.brand)) AS marque, upper(btrim(t.model)) AS modele,
       public.normaliser_dimension_pneu(t.dimension) AS dimension, count(*)::integer AS nombre
  FROM public.tires t
 WHERE t.status IN ('stored', 'damaged', 'en_intervention')
 GROUP BY 1, 2, 3, 4, 5;
GRANT SELECT ON public.v_pneus_stock TO authenticated;

-- Usure du montage en cours : points (profondeur et compteur) du meme
-- engin depuis le montage. Taux et projection seulement avec le nombre de
-- mesures parametre (seuils) et une distance positive.
CREATE OR REPLACE VIEW public.v_pneus_usure WITH (security_invoker = true) AS
WITH b AS (
  SELECT t.id AS tire_id, t.code_sigtb, t.vehicle_id, m.id AS montage_id, m.effectue_le AS monte_le,
         pts.nb_mesures, pts.premiere_mm, pts.derniere_mm, pts.km_debut, pts.km_fin, pts.derniere_mesure_id,
         s.mesures_min_projection, s.profondeur_min_mm
    FROM public.tires t
    JOIN LATERAL (SELECT o.id, o.effectue_le, o.saisi_le, o.vehicle_id FROM public.v_pneus_operations_effectives o
                   WHERE o.tire_id = t.id AND o.type = 'montage' ORDER BY o.effectue_le DESC, o.saisi_le DESC LIMIT 1) m ON true
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS nb_mesures,
             (array_agg(o.profondeur_mm ORDER BY o.effectue_le, o.saisi_le))[1] AS premiere_mm,
             (array_agg(o.profondeur_mm ORDER BY o.effectue_le DESC, o.saisi_le DESC))[1] AS derniere_mm,
             (array_agg(o.compteur_km ORDER BY o.effectue_le, o.saisi_le))[1] AS km_debut,
             (array_agg(o.compteur_km ORDER BY o.effectue_le DESC, o.saisi_le DESC))[1] AS km_fin,
             (array_agg(o.id ORDER BY o.effectue_le DESC, o.saisi_le DESC))[1] AS derniere_mesure_id
        FROM public.v_pneus_operations_effectives o
       WHERE o.tire_id = t.id AND o.vehicle_id = m.vehicle_id AND o.profondeur_mm IS NOT NULL AND o.compteur_km IS NOT NULL
         AND (o.effectue_le, o.saisi_le) >= (m.effectue_le, m.saisi_le)) pts ON true
    LEFT JOIN LATERAL public.seuils_pneu(t.id) s ON true
   WHERE t.status = 'active'
), r AS (
  SELECT b.*,
         CASE WHEN b.mesures_min_projection IS NOT NULL AND b.nb_mesures >= b.mesures_min_projection AND b.km_fin > b.km_debut
              THEN round((b.premiere_mm - b.derniere_mm) / (b.km_fin - b.km_debut) * 1000, 3) END AS usure_mm_1000km
    FROM b
)
SELECT r.*,
       CASE WHEN r.usure_mm_1000km > 0 AND r.profondeur_min_mm IS NOT NULL AND r.derniere_mm >= r.profondeur_min_mm
            THEN round((r.derniere_mm - r.profondeur_min_mm) / r.usure_mm_1000km * 1000) END AS km_restants_projetes,
       CASE WHEN r.usure_mm_1000km IS NULL THEN 'donnees insuffisantes' END AS libelle
  FROM r;
GRANT SELECT ON public.v_pneus_usure TO authenticated;

-- Couts par categorie. `deja_compte_achats` : la depense figure deja dans le
-- circuit achats (bon de commande D-067, ou bon cite au retour) ; ne pas
-- l'ajouter une seconde fois a une depense agregee (meme logique que D-082).
CREATE OR REPLACE VIEW public.v_pneus_couts WITH (security_invoker = true) AS
SELECT t.id AS tire_id, 'acquisition'::text AS categorie, t.purchase_price AS montant, NULL::uuid AS operation_id,
       NULL::uuid AS intervention_id,
       CASE WHEN ra.tire_id IS NOT NULL THEN 'bon_commande' ELSE t.prix_source END AS source,
       (ra.tire_id IS NOT NULL OR t.prix_source = 'bon_commande') AS deja_compte_achats,
       coalesce(t.purchase_date::timestamptz, e.effectue_le) AS date_cout
  FROM public.tires t
  LEFT JOIN public.receptions_achat_pneus ra ON ra.tire_id = t.id
  LEFT JOIN LATERAL (SELECT o.effectue_le FROM public.v_pneus_operations_effectives o
                      WHERE o.tire_id = t.id AND o.type = 'entree' LIMIT 1) e ON true
 WHERE e.effectue_le IS NOT NULL
UNION ALL
SELECT o.tire_id,
       CASE WHEN o.type = 'rechapage' THEN 'rechapage' WHEN o.type = 'reparation' THEN 'reparation'
            WHEN i.type = 'expertise' THEN 'prestations' ELSE 'autres' END,
       o.cout, o.id, o.intervention_id,
       CASE WHEN i.bon_commande_id IS NOT NULL THEN 'bon_commande' WHEN i.facture_reference IS NOT NULL THEN 'facture' ELSE 'saisie' END,
       i.bon_commande_id IS NOT NULL, o.effectue_le
  FROM public.v_pneus_operations_effectives o
  LEFT JOIN public.pneus_interventions i ON i.id = o.intervention_id
 WHERE o.type IN ('rechapage', 'reparation', 'retour_intervention');
GRANT SELECT ON public.v_pneus_couts TO authenticated;

CREATE OR REPLACE VIEW public.v_pneus_couts_synthese WITH (security_invoker = true) AS
SELECT c.tire_id,
       sum(c.montant) FILTER (WHERE c.categorie = 'acquisition') AS acquisition,
       sum(c.montant) FILTER (WHERE c.categorie = 'reparation') AS reparation,
       sum(c.montant) FILTER (WHERE c.categorie = 'rechapage') AS rechapage,
       sum(c.montant) FILTER (WHERE c.categorie = 'prestations') AS prestations,
       sum(c.montant) FILTER (WHERE c.categorie = 'autres') AS autres,
       CASE WHEN bool_and(c.montant IS NOT NULL) THEN sum(c.montant) END AS total,
       sum(c.montant) FILTER (WHERE c.deja_compte_achats) AS deja_compte_achats,
       sum(c.montant) FILTER (WHERE NOT c.deja_compte_achats) AS hors_achats,
       count(*) FILTER (WHERE c.montant IS NULL)::integer AS couts_inconnus
  FROM public.v_pneus_couts c
 GROUP BY c.tire_id;
GRANT SELECT ON public.v_pneus_couts_synthese TO authenticated;

-- Indicateurs : cout au km, a l'heure, a la tonne. Chaque montage doit
-- avoir ses km (compteurs), ses heures (pointages de l'engin) ou ses
-- tonnes (tickets CBG de tous les voyages livres) ; sinon NULL et
-- « donnees insuffisantes ». Rien n'est estime.
CREATE OR REPLACE VIEW public.v_pneus_indicateurs WITH (security_invoker = true) AS
WITH m AS (
  SELECT m.tire_id, m.vehicle_id, m.monte_le, coalesce(m.demonte_le, now()) AS fin, m.km_parcourus,
         h.nb_pointages, h.heures, v.nb_voyages, v.nb_sans_ticket, v.tonnes
    FROM public.v_pneus_montages m
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS nb_pointages, sum(p.heures_marche) AS heures
        FROM public.pointages_engins p JOIN public.fiches_terrain f ON f.id = p.fiche_id
       WHERE p.vehicle_id = m.vehicle_id AND f.statut <> 'annulee'
         AND f.date_fiche BETWEEN m.monte_le::date AND coalesce(m.demonte_le, now())::date) h ON true
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS nb_voyages, count(*) FILTER (WHERE k.id IS NULL)::int AS nb_sans_ticket, sum(k.net) AS tonnes
        FROM public.trips tr LEFT JOIN public.tickets_pesee_cbg k ON k.trip_id = tr.id
       WHERE tr.vehicle_id = m.vehicle_id AND tr.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')
         AND tr.planned_date BETWEEN m.monte_le::date AND coalesce(m.demonte_le, now())::date) v ON true
), a AS (
  SELECT m.tire_id, count(*)::int AS nb_montages,
         CASE WHEN bool_and(m.km_parcourus IS NOT NULL) THEN sum(m.km_parcourus) END AS km,
         CASE WHEN bool_and(m.nb_pointages > 0) THEN sum(m.heures) END AS heures,
         CASE WHEN bool_and(m.nb_voyages > 0 AND m.nb_sans_ticket = 0) THEN sum(m.tonnes) END AS tonnes
    FROM m GROUP BY m.tire_id
)
SELECT t.id AS tire_id, t.code_sigtb, c.total AS cout_total, a.nb_montages, a.km, a.heures, a.tonnes,
       CASE WHEN c.total IS NOT NULL AND a.km > 0 THEN round(c.total / a.km, 2) END AS cout_km,
       CASE WHEN c.total IS NOT NULL AND a.heures > 0 THEN round(c.total / a.heures, 2) END AS cout_heure,
       CASE WHEN c.total IS NOT NULL AND a.tonnes > 0 THEN round(c.total / a.tonnes, 2) END AS cout_tonne,
       CASE WHEN c.total IS NULL OR NOT a.km > 0 OR a.km IS NULL THEN 'donnees insuffisantes' END AS libelle_km,
       CASE WHEN c.total IS NULL OR NOT a.heures > 0 OR a.heures IS NULL THEN 'donnees insuffisantes' END AS libelle_heure,
       CASE WHEN c.total IS NULL OR NOT a.tonnes > 0 OR a.tonnes IS NULL THEN 'donnees insuffisantes' END AS libelle_tonne
  FROM public.tires t
  LEFT JOIN public.v_pneus_couts_synthese c ON c.tire_id = t.id
  LEFT JOIN a ON a.tire_id = t.id;
GRANT SELECT ON public.v_pneus_indicateurs TO authenticated;

-- Positions configurees par engin et pneu qui les occupe.
CREATE OR REPLACE VIEW public.v_pneus_positions_engins WITH (security_invoker = true) AS
SELECT v.id AS vehicle_id, v.registration, c.id AS configuration_id, c.code AS configuration, p.code AS "position", p.libelle,
       p.essieu, p.cote, p.rang, p.secours, p.dimensions_admises, p.ordre, t.id AS tire_id, t.code_sigtb, t.dimension
  FROM public.vehicles v
  JOIN public.pneus_configurations c ON c.actif
       AND public.normaliser_texte_pneu(c.modele_engin) = public.normaliser_texte_pneu(v.brand_model)
  JOIN public.pneus_configuration_positions p ON p.configuration_id = c.id AND p.actif
  LEFT JOIN public.tires t ON t.vehicle_id = v.id AND t.status = 'active' AND t."position" = p.code;
GRANT SELECT ON public.v_pneus_positions_engins TO authenticated;

-- Surveillance : faits et seuils par pneu en service (source des alertes).
CREATE OR REPLACE VIEW public.v_pneus_surveillance WITH (security_invoker = true) AS
SELECT t.id, t.code_sigtb, t.tire_number, t.status, t.vehicle_id, t."position", t.site_id, t.dimension,
       coalesce(v.site_id, t.site_id) AS site_suivi_id, v.registration,
       mes.id AS mesure_id, mes.profondeur_mm, mes.effectue_le AS mesure_le,
       suivi.id AS suivi_operation_id, suivi.effectue_le AS suivi_le,
       pr.id AS pression_operation_id, pr.pression_bar, pr.effectue_le AS pression_le,
       det.id AS inspection_id, det.ecart_mm,
       public.pneu_defaut_critique_ouvert(t.id) AS defaut_critique_operation_id,
       u.usure_mm_1000km,
       itv.id AS intervention_id, itv.numero AS intervention_numero, itv.envoye_le,
       pos.id AS position_operation_id, mt.id AS montage_id, (mt.id IS NOT NULL AND mt.compteur_km IS NULL) AS montage_sans_km,
       CASE WHEN t.status = 'active' THEN public.position_pneu_incompatible(t.vehicle_id, t."position", t.dimension) END AS incompatibilite,
       CASE WHEN t.garantie_mois IS NOT NULL
            THEN (coalesce(t.purchase_date, ent.effectue_le::date) + make_interval(months => t.garantie_mois))::date END AS garantie_fin,
       coalesce(t.date_fabrication, t.purchase_date, ent.effectue_le::date) AS debut_vie,
       ind.cout_km,
       s.profondeur_min_mm, s.ecart_usure_max_mm, s.degradation_max_mm_1000km, s.pression_min_bar, s.pression_max_bar,
       s.inspection_max_jours, s.duree_max_jours, s.intervention_max_jours, s.garantie_preavis_jours, s.cout_km_max
  FROM public.tires t
  LEFT JOIN public.vehicles v ON v.id = t.vehicle_id
  LEFT JOIN LATERAL public.seuils_pneu(t.id) s ON true
  LEFT JOIN LATERAL (SELECT o.id, o.profondeur_mm, o.effectue_le FROM public.v_pneus_operations_effectives o
                      WHERE o.tire_id = t.id AND o.profondeur_mm IS NOT NULL ORDER BY o.effectue_le DESC, o.saisi_le DESC LIMIT 1) mes ON true
  LEFT JOIN LATERAL (SELECT o.id, o.effectue_le FROM public.v_pneus_operations_effectives o
                      WHERE o.tire_id = t.id AND o.type IN ('inspection', 'montage') ORDER BY o.effectue_le DESC, o.saisi_le DESC LIMIT 1) suivi ON true
  LEFT JOIN LATERAL (SELECT o.id, o.pression_bar, o.effectue_le FROM public.v_pneus_operations_effectives o
                      WHERE o.tire_id = t.id AND o.pression_bar IS NOT NULL ORDER BY o.effectue_le DESC, o.saisi_le DESC LIMIT 1) pr ON true
  LEFT JOIN LATERAL (SELECT d.id, d.ecart_mm FROM public.pneus_inspections d JOIN public.v_pneus_operations_effectives o ON o.id = d.operation_id
                      WHERE d.tire_id = t.id ORDER BY o.effectue_le DESC, o.saisi_le DESC LIMIT 1) det ON true
  LEFT JOIN LATERAL (SELECT x.usure_mm_1000km FROM public.v_pneus_usure x WHERE x.tire_id = t.id) u ON true
  LEFT JOIN LATERAL (SELECT i.id, i.numero, i.envoye_le FROM public.pneus_interventions i
                      WHERE i.tire_id = t.id AND i.statut = 'envoyee') itv ON true
  LEFT JOIN LATERAL (SELECT o.id FROM public.v_pneus_operations_effectives o WHERE o.tire_id = t.id AND t.status = 'active'
                      AND o.type IN ('montage', 'permutation') ORDER BY o.effectue_le DESC, o.saisi_le DESC LIMIT 1) pos ON true
  LEFT JOIN LATERAL (SELECT o.id, o.compteur_km FROM public.v_pneus_operations_effectives o WHERE o.tire_id = t.id AND t.status = 'active'
                      AND o.type = 'montage' ORDER BY o.effectue_le DESC, o.saisi_le DESC LIMIT 1) mt ON true
  LEFT JOIN LATERAL (SELECT o.effectue_le FROM public.v_pneus_operations_effectives o WHERE o.tire_id = t.id AND o.type = 'entree' LIMIT 1) ent ON true
  LEFT JOIN LATERAL (SELECT x.cout_km FROM public.v_pneus_indicateurs x WHERE x.tire_id = t.id) ind ON true
 WHERE t.status <> 'retired';
GRANT SELECT ON public.v_pneus_surveillance TO authenticated;

DO $$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY['v_pneus', 'v_pneus_episodes', 'v_pneus_mouvements', 'v_pneus_stock', 'v_pneus_usure', 'v_pneus_couts',
                           'v_pneus_couts_synthese', 'v_pneus_indicateurs', 'v_pneus_positions_engins', 'v_pneus_surveillance'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon', v);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM authenticated', v);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', v);
  END LOOP;
END $$;

-- ===================================================================
-- 12. Alertes pneus (catalogue D-068)
-- ===================================================================

-- Reprise de 20261121150000 (9 regles), plus 13 regles pneus. Toutes
-- desactivables (`alerte_pneu_*_active`) ; leurs seuils viennent de
-- `pneus_seuils` (sans seuil applicable : aucune alerte).
CREATE OR REPLACE FUNCTION public.catalogue_regles_alertes()
RETURNS TABLE (regle text, libelle text, domaine text, cle text, type_reglage text, unite text,
               module text, ecran text, gravite text, description text)
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT * FROM (VALUES
    ('immobilisation_longue', 'Immobilisation longue', 'Maintenance', 'alerte_immobilisation_longue_h', 'seuil', 'h',
     'maintenance', 'immobilisations', 'warning', 'Immobilisation ouverte depuis plus longtemps que le seuil (D-022).'),
    ('intervention_retard', 'Intervention Neemba en retard', 'Maintenance', 'alerte_intervention_retard_active', 'activation', NULL,
     'maintenance', 'interventions-loueur', 'critical', 'Intervention demandée et non prise en charge au-delà du délai contractuel saisi (D-049).'),
    ('controle_non_conforme', 'Contrôle avant départ non conforme', 'HSE', 'alerte_controle_non_conforme_active', 'activation', NULL,
     'trips', 'controles-depart', 'critical', 'Le dernier contrôle avant départ du camion est non conforme (D-054).'),
    ('ecart_carburant', 'Écart d''inventaire carburant', 'Carburant', 'alerte_ecart_carburant_l', 'seuil', 'L',
     'fuel', 'fuel-stocks', 'warning', 'Le dernier inventaire de la cuve s''écarte du solde théorique de plus que le seuil (D-041).'),
    ('document_expire', 'Document ou habilitation expiré', 'Flotte', 'alerte_document_expire_active', 'activation', NULL,
     'vehicles', 'documents', 'warning', 'Document d''engin ou habilitation de chauffeur expiré et non renouvelé (D-051).'),
    ('action_corrective_retard', 'Action corrective en retard', 'HSE', 'alerte_action_corrective_retard_active', 'activation', NULL,
     'trips', 'incidents', 'warning', 'Action corrective ouverte dont l''échéance est dépassée (D-054).'),
    ('voyage_sans_ticket', 'Voyage livré sans ticket CBG', 'Tickets CBG', 'alerte_voyage_sans_ticket_h', 'seuil', 'h',
     'trips', 'tickets-cbg', 'warning', 'Voyage livré depuis plus longtemps que le seuil sans ticket de pesée CBG (D-037).'),
    ('epi_echu', 'EPI à renouveler', 'HSE', 'alerte_epi_echu_active', 'activation', NULL,
     'trips', 'hse-prevention', 'warning', 'Équipement de protection remis dont l''échéance de renouvellement est atteinte (D-068).'),
    ('inspection_retard', 'Inspection en retard', 'HSE', 'alerte_inspection_retard_active', 'activation', NULL,
     'trips', 'hse-prevention', 'warning', 'Inspection planifiée non réalisée à la date prévue (D-068).'),
    ('pneu_profondeur', 'Pneu sous la profondeur minimale', 'Pneus', 'alerte_pneu_profondeur_active', 'activation', NULL,
     'maintenance', 'tires', 'critical', 'Dernière profondeur mesurée sous le seuil de la dimension, du modèle ou du fabricant (D-091).'),
    ('pneu_inspection_retard', 'Inspection de pneu en retard', 'Pneus', 'alerte_pneu_inspection_retard_active', 'activation', NULL,
     'maintenance', 'tires', 'warning', 'Pneu monté sans inspection depuis plus que le délai paramétré (D-091).'),
    ('pneu_degradation_rapide', 'Dégradation rapide d''un pneu', 'Pneus', 'alerte_pneu_degradation_rapide_active', 'activation', NULL,
     'maintenance', 'tires', 'warning', 'Usure mesurée au 1000 km au-dessus du seuil, sur un historique suffisant (D-091).'),
    ('pneu_usure_irreguliere', 'Usure irrégulière', 'Pneus', 'alerte_pneu_usure_irreguliere_active', 'activation', NULL,
     'maintenance', 'tires', 'warning', 'Écart de profondeur entre zones au-dessus du seuil (D-091).'),
    ('pneu_pression', 'Pression hors tolérance', 'Pneus', 'alerte_pneu_pression_active', 'activation', NULL,
     'maintenance', 'tires', 'warning', 'Dernière pression mesurée hors de la plage paramétrée (D-091).'),
    ('pneu_defaut_critique', 'Défaut critique de pneu', 'Pneus', 'alerte_pneu_defaut_critique_active', 'activation', NULL,
     'maintenance', 'tires', 'critical', 'Défaut critique constaté à l''inspection et non levé (D-091).'),
    ('pneu_non_localise', 'Pneu non localisé', 'Pneus', 'alerte_pneu_non_localise_active', 'activation', NULL,
     'maintenance', 'tires', 'warning', 'Pneu sans engin ni site cohérent avec son état (D-091).'),
    ('pneu_montage_incompatible', 'Montage incompatible', 'Pneus', 'alerte_pneu_montage_incompatible_active', 'activation', NULL,
     'maintenance', 'tires', 'critical', 'Pneu monté à une position ou avec une dimension non admise par la configuration de l''engin (D-091).'),
    ('pneu_intervention_longue', 'Intervention de pneu trop longue', 'Pneus', 'alerte_pneu_intervention_longue_active', 'activation', NULL,
     'maintenance', 'tires', 'warning', 'Pneu chez le prestataire au-delà du délai paramétré (D-091).'),
    ('pneu_garantie_proche', 'Fin de garantie proche', 'Pneus', 'alerte_pneu_garantie_proche_active', 'activation', NULL,
     'maintenance', 'tires', 'info', 'Fin de garantie dans le préavis paramétré (D-091).'),
    ('pneu_cout_anormal', 'Coût au km anormal', 'Pneus', 'alerte_pneu_cout_anormal_active', 'activation', NULL,
     'maintenance', 'tires', 'warning', 'Coût au km calculé sur données complètes au-dessus du seuil (D-091).'),
    ('pneu_historique_incomplet', 'Historique de pneu incomplet', 'Pneus', 'alerte_pneu_historique_incomplet_active', 'activation', NULL,
     'maintenance', 'tires', 'info', 'Montage en cours sans compteur : km et coût au km impossibles (D-091).'),
    ('pneu_duree_depassee', 'Durée de vie dépassée', 'Pneus', 'alerte_pneu_duree_depassee_active', 'activation', NULL,
     'maintenance', 'tires', 'warning', 'Âge du pneu (fabrication, achat ou entrée) au-delà de la durée paramétrée (D-091).')
  ) AS c(regle, libelle, domaine, cle, type_reglage, unite, module, ecran, gravite, description);
$$;
REVOKE EXECUTE ON FUNCTION public.catalogue_regles_alertes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalogue_regles_alertes() TO authenticated;

ALTER TABLE public.alerts DROP CONSTRAINT IF EXISTS alerts_alert_type_check;
ALTER TABLE public.alerts ADD CONSTRAINT alerts_alert_type_check CHECK (alert_type IN (
  'vehicle_maintenance', 'fuel_low', 'tire_replacement', 'document_expiry', 'driver_license_expiry', 'insurance_expiry',
  'stock_low', 'invoice_overdue',
  'immobilisation_longue', 'intervention_retard', 'controle_non_conforme', 'ecart_carburant', 'document_expire',
  'action_corrective_retard', 'voyage_sans_ticket', 'epi_echu', 'inspection_retard',
  'pneu_profondeur', 'pneu_inspection_retard', 'pneu_degradation_rapide', 'pneu_usure_irreguliere', 'pneu_pression',
  'pneu_defaut_critique', 'pneu_non_localise', 'pneu_montage_incompatible', 'pneu_intervention_longue',
  'pneu_garantie_proche', 'pneu_cout_anormal', 'pneu_historique_incomplet', 'pneu_duree_depassee'));

-- Candidats : reprise a l'identique de 20261121150000, plus les pneus.
DROP VIEW IF EXISTS public.v_alertes_candidates;
CREATE VIEW public.v_alertes_candidates AS
SELECT 'immobilisation_longue'::text AS regle, 'immobilisation'::text AS reference_type, i.id AS reference_id,
       i.vehicle_id, NULL::uuid AS driver_id, v.site_id, 'warning'::text AS severity, 'maintenance'::text AS module, 'immobilisations'::text AS ecran,
       'Immobilisation longue : ' || v.registration AS title,
       'Immobilisé depuis ' || round(extract(epoch FROM (now() - i.debut)) / 3600) || ' h (seuil ' || public.seuil_regle_alerte('immobilisation_longue')
         || ' h) · cause : ' || i.cause || ' · ' || i.description AS message,
       i.debut AS survenu_le
  FROM public.immobilisations i JOIN public.vehicles v ON v.id = i.vehicle_id
 WHERE i.statut = 'ouverte' AND public.seuil_regle_alerte('immobilisation_longue') IS NOT NULL
   AND i.debut < now() - make_interval(secs => public.seuil_regle_alerte('immobilisation_longue')::double precision * 3600)
UNION ALL
SELECT 'intervention_retard', 'intervention_loueur', i.id, i.vehicle_id, NULL, v.site_id, 'critical', 'maintenance', 'interventions-loueur',
       'Intervention Neemba en retard : ' || i.numero || ' (' || v.registration || ')',
       'Demandée le ' || to_char(i.demande_le, 'DD/MM/YYYY HH24:MI') || ', non prise en charge ; délai contractuel ' || i.delai_contractuel_heures || ' h',
       i.demande_le
  FROM public.interventions_loueur i JOIN public.vehicles v ON v.id = i.vehicle_id
 WHERE i.statut = 'demandee' AND i.delai_contractuel_heures IS NOT NULL AND public.regle_alerte_en_service('intervention_retard')
   AND i.demande_le < now() - make_interval(secs => i.delai_contractuel_heures::double precision * 3600)
UNION ALL
SELECT 'controle_non_conforme', 'controle_depart', c.id, c.vehicle_id, c.driver_id, v.site_id, 'critical', 'trips', 'controles-depart',
       'Contrôle avant départ non conforme : ' || v.registration,
       'Contrôle du ' || to_char(c.effectue_le, 'DD/MM/YYYY HH24:MI') || coalesce(' · ' || (
         SELECT string_agg(p.libelle || ' : ' || p.observation, ' ; ') FROM public.controles_depart_points p
          WHERE p.controle_id = c.id AND p.resultat = 'non_conforme' AND p.bloquant), ''),
       c.effectue_le
  FROM public.controles_depart c JOIN public.vehicles v ON v.id = c.vehicle_id
 WHERE c.resultat = 'non_conforme' AND public.regle_alerte_en_service('controle_non_conforme')
   AND NOT EXISTS (SELECT 1 FROM public.controles_depart n WHERE n.vehicle_id = c.vehicle_id
                    AND (n.effectue_le, n.saisi_le) > (c.effectue_le, c.saisi_le))
UNION ALL
SELECT 'ecart_carburant', 'inventaire_carburant', i.id, NULL, NULL, s.site_id, 'warning', 'fuel', 'fuel-stocks',
       'Écart d''inventaire carburant : ' || s.code || ' ' || s.libelle,
       'Inventaire du ' || to_char(i.date_mesure, 'DD/MM/YYYY HH24:MI') || ' : écart ' || round(i.ecart, 1) || ' L (seuil '
         || public.seuil_regle_alerte('ecart_carburant') || ' L)',
       i.date_mesure
  FROM public.inventaires_carburant i JOIN public.stockages_carburant s ON s.id = i.stockage_id
 WHERE i.statut <> 'rejete' AND i.ecart IS NOT NULL AND public.seuil_regle_alerte('ecart_carburant') IS NOT NULL
   AND abs(i.ecart) > public.seuil_regle_alerte('ecart_carburant')
   AND NOT EXISTS (SELECT 1 FROM public.inventaires_carburant n WHERE n.stockage_id = i.stockage_id AND n.statut <> 'rejete'
                    AND (n.date_mesure, n.cree_le) > (i.date_mesure, i.cree_le))
UNION ALL
SELECT 'document_expire', 'vehicle_document', d.id, d.vehicle_id, NULL, v.site_id, 'warning', 'vehicles', 'documents',
       'Document expiré : ' || d.document_name || ' (' || v.registration || ')',
       'Expiré le ' || to_char(d.expiry_date, 'DD/MM/YYYY') || ', aucun document de même type valide',
       d.expiry_date::timestamptz
  FROM public.vehicle_documents d JOIN public.vehicles v ON v.id = d.vehicle_id
 WHERE d.status <> 'archived' AND d.expiry_date < current_date AND public.regle_alerte_en_service('document_expire')
   AND NOT EXISTS (SELECT 1 FROM public.vehicle_documents n WHERE n.vehicle_id = d.vehicle_id AND n.document_type = d.document_type
                    AND n.id <> d.id AND n.status <> 'archived' AND n.expiry_date >= current_date)
UNION ALL
SELECT 'document_expire', 'habilitation_chauffeur', h.id, NULL, h.driver_id, dr.site_id, 'warning', 'drivers', 'habilitations',
       'Habilitation expirée : ' || coalesce(h.libelle, h.type) || ' (' || dr.name || ')',
       'Expirée le ' || to_char(h.expire_le, 'DD/MM/YYYY') || ', non renouvelée',
       h.expire_le::timestamptz
  FROM public.habilitations_chauffeur h JOIN public.drivers dr ON dr.id = h.driver_id
 WHERE h.revoque_le IS NULL AND h.expire_le < current_date AND public.regle_alerte_en_service('document_expire')
   AND NOT EXISTS (SELECT 1 FROM public.habilitations_chauffeur n WHERE n.driver_id = h.driver_id AND n.type = h.type
                    AND n.revoque_le IS NULL AND n.delivre_le > h.delivre_le AND (n.expire_le IS NULL OR n.expire_le >= current_date))
UNION ALL
SELECT 'action_corrective_retard', 'action_corrective', a.id, inc.vehicle_id, NULL,
       coalesce(inc.site_id, (SELECT t.departure_site_id FROM public.trips t WHERE t.id = inc.trip_id), ins.site_id),
       'warning', 'trips', CASE WHEN a.inspection_id IS NOT NULL THEN 'hse-prevention' ELSE 'incidents' END,
       'Action corrective en retard : ' || coalesce(inc.numero, ins.numero),
       a.libelle || ' · ' || a.responsable || ' · échéance ' || to_char(a.echeance, 'DD/MM/YYYY'),
       a.echeance::timestamptz
  FROM public.actions_correctives a
  LEFT JOIN public.incidents inc ON inc.id = a.incident_id
  LEFT JOIN public.inspections ins ON ins.id = a.inspection_id
 WHERE a.statut = 'ouverte' AND a.echeance < current_date AND public.regle_alerte_en_service('action_corrective_retard')
UNION ALL
SELECT 'voyage_sans_ticket', 'trip', t.id, t.vehicle_id, t.driver_id, t.departure_site_id, 'warning', 'trips', 'tickets-cbg',
       'Voyage livré sans ticket CBG : ' || coalesce(t.reference, t.id::text),
       'Livré le ' || to_char(l.livre_le, 'DD/MM/YYYY HH24:MI') || ', aucun ticket après ' || public.seuil_regle_alerte('voyage_sans_ticket') || ' h',
       l.livre_le
  FROM public.trips t
  JOIN LATERAL (SELECT min(e.survenu_le) AS livre_le FROM public.trip_events e WHERE e.trip_id = t.id AND e.etat_apres = 'DELIVERED') l ON true
 WHERE t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED') AND public.seuil_regle_alerte('voyage_sans_ticket') IS NOT NULL
   AND l.livre_le < now() - make_interval(secs => public.seuil_regle_alerte('voyage_sans_ticket')::double precision * 3600)
   AND NOT EXISTS (SELECT 1 FROM public.tickets_pesee_cbg k WHERE k.trip_id = t.id)
UNION ALL
SELECT 'epi_echu', 'dotation_epi', d.id, NULL, d.driver_id, d.site_id, 'warning', 'trips', 'hse-prevention',
       'EPI à renouveler : ' || d.type_epi || ' · ' || d.beneficiaire,
       d.numero || ' remis le ' || to_char(d.remis_le, 'DD/MM/YYYY') || ', échéance ' || to_char(d.echeance_renouvellement, 'DD/MM/YYYY'),
       d.echeance_renouvellement::timestamptz
  FROM public.dotations_epi d
 WHERE d.statut = 'remis' AND d.echeance_renouvellement <= current_date AND public.regle_alerte_en_service('epi_echu')
UNION ALL
SELECT 'inspection_retard', 'inspection', s.id, NULL, NULL, s.site_id, 'warning', 'trips', 'hse-prevention',
       'Inspection en retard : ' || s.numero || ' · ' || s.objet,
       'Prévue le ' || to_char(s.prevue_le, 'DD/MM/YYYY') || ' · responsable ' || s.responsable,
       s.prevue_le::timestamptz
  FROM public.inspections s
 WHERE s.statut = 'planifiee' AND s.prevue_le < current_date AND public.regle_alerte_en_service('inspection_retard')

UNION ALL
SELECT 'pneu_profondeur', 'pneu_operation', w.mesure_id, w.vehicle_id, NULL, w.site_suivi_id, 'critical', 'maintenance', 'tires',
       'Pneu sous la profondeur minimale : ' || w.code_sigtb,
       'Mesure du ' || to_char(w.mesure_le, 'DD/MM/YYYY') || ' : ' || w.profondeur_mm || ' mm (seuil ' || w.profondeur_min_mm || ' mm)',
       w.mesure_le
  FROM public.v_pneus_surveillance w
 WHERE w.profondeur_mm < w.profondeur_min_mm AND public.regle_alerte_en_service('pneu_profondeur')
UNION ALL
SELECT 'pneu_inspection_retard', 'pneu_operation', w.suivi_operation_id, w.vehicle_id, NULL, w.site_suivi_id, 'warning', 'maintenance', 'tires',
       'Inspection de pneu en retard : ' || w.code_sigtb || coalesce(' (' || w.registration || ' ' || w."position" || ')', ''),
       'Dernière inspection ou montage le ' || to_char(w.suivi_le, 'DD/MM/YYYY') || ' (délai ' || w.inspection_max_jours || ' j)',
       w.suivi_le
  FROM public.v_pneus_surveillance w
 WHERE w.status = 'active' AND w.suivi_le < now() - make_interval(days => w.inspection_max_jours)
   AND public.regle_alerte_en_service('pneu_inspection_retard')
UNION ALL
SELECT 'pneu_degradation_rapide', 'pneu_operation', w.mesure_id, w.vehicle_id, NULL, w.site_suivi_id, 'warning', 'maintenance', 'tires',
       'Dégradation rapide : ' || w.code_sigtb,
       'Usure ' || w.usure_mm_1000km || ' mm/1000 km (seuil ' || w.degradation_max_mm_1000km || ')',
       w.mesure_le
  FROM public.v_pneus_surveillance w
 WHERE w.usure_mm_1000km > w.degradation_max_mm_1000km AND public.regle_alerte_en_service('pneu_degradation_rapide')
UNION ALL
SELECT 'pneu_usure_irreguliere', 'pneu_inspection', w.inspection_id, w.vehicle_id, NULL, w.site_suivi_id, 'warning', 'maintenance', 'tires',
       'Usure irrégulière : ' || w.code_sigtb,
       'Écart entre zones ' || w.ecart_mm || ' mm (seuil ' || w.ecart_usure_max_mm || ' mm)',
       w.mesure_le
  FROM public.v_pneus_surveillance w
 WHERE w.ecart_mm > w.ecart_usure_max_mm AND public.regle_alerte_en_service('pneu_usure_irreguliere')
UNION ALL
SELECT 'pneu_pression', 'pneu_operation', w.pression_operation_id, w.vehicle_id, NULL, w.site_suivi_id, 'warning', 'maintenance', 'tires',
       'Pression hors tolérance : ' || w.code_sigtb,
       'Mesure du ' || to_char(w.pression_le, 'DD/MM/YYYY') || ' : ' || w.pression_bar || ' bar (plage '
         || coalesce(w.pression_min_bar::text, '-') || ' à ' || coalesce(w.pression_max_bar::text, '-') || ')',
       w.pression_le
  FROM public.v_pneus_surveillance w
 WHERE (w.pression_bar < w.pression_min_bar OR w.pression_bar > w.pression_max_bar) AND public.regle_alerte_en_service('pneu_pression')
UNION ALL
SELECT 'pneu_defaut_critique', 'pneu_operation', w.defaut_critique_operation_id, w.vehicle_id, NULL, w.site_suivi_id, 'critical', 'maintenance', 'tires',
       'Défaut critique : ' || w.code_sigtb || coalesce(' (' || w.registration || ' ' || w."position" || ')', ''),
       'Défaut critique constaté à l''inspection, non levé',
       (SELECT o.effectue_le FROM public.pneus_operations o WHERE o.id = w.defaut_critique_operation_id)
  FROM public.v_pneus_surveillance w
 WHERE w.defaut_critique_operation_id IS NOT NULL AND public.regle_alerte_en_service('pneu_defaut_critique')
UNION ALL
SELECT 'pneu_non_localise', 'tire', w.id, w.vehicle_id, NULL, w.site_suivi_id, 'warning', 'maintenance', 'tires',
       'Pneu non localisé : ' || w.code_sigtb, 'État ' || w.status || ' sans engin, position, site ou intervention cohérents', now()
  FROM public.v_pneus_surveillance w
 WHERE ((w.status = 'active' AND (w.vehicle_id IS NULL OR w."position" IS NULL))
        OR (w.status IN ('stored', 'damaged') AND w.site_id IS NULL)
        OR (w.status = 'en_intervention' AND w.intervention_id IS NULL))
   AND public.regle_alerte_en_service('pneu_non_localise')
UNION ALL
SELECT 'pneu_montage_incompatible', 'pneu_operation', w.position_operation_id, w.vehicle_id, NULL, w.site_suivi_id, 'critical', 'maintenance', 'tires',
       'Montage incompatible : ' || w.code_sigtb || ' (' || w.registration || ')', w.incompatibilite, now()
  FROM public.v_pneus_surveillance w
 WHERE w.incompatibilite IS NOT NULL AND w.position_operation_id IS NOT NULL AND public.regle_alerte_en_service('pneu_montage_incompatible')
UNION ALL
SELECT 'pneu_intervention_longue', 'pneu_intervention', w.intervention_id, NULL, NULL, w.site_suivi_id, 'warning', 'maintenance', 'tires',
       'Intervention trop longue : ' || w.intervention_numero || ' (' || w.code_sigtb || ')',
       'Envoyé le ' || to_char(w.envoye_le, 'DD/MM/YYYY') || ', délai ' || w.intervention_max_jours || ' j',
       w.envoye_le
  FROM public.v_pneus_surveillance w
 WHERE w.intervention_id IS NOT NULL AND w.envoye_le < now() - make_interval(days => w.intervention_max_jours)
   AND public.regle_alerte_en_service('pneu_intervention_longue')
UNION ALL
SELECT 'pneu_garantie_proche', 'tire', w.id, w.vehicle_id, NULL, w.site_suivi_id, 'info', 'maintenance', 'tires',
       'Fin de garantie proche : ' || w.code_sigtb, 'Garantie jusqu''au ' || to_char(w.garantie_fin, 'DD/MM/YYYY'),
       w.garantie_fin::timestamptz
  FROM public.v_pneus_surveillance w
 WHERE w.garantie_fin BETWEEN current_date AND current_date + w.garantie_preavis_jours
   AND public.regle_alerte_en_service('pneu_garantie_proche')
UNION ALL
SELECT 'pneu_cout_anormal', 'tire', w.id, w.vehicle_id, NULL, w.site_suivi_id, 'warning', 'maintenance', 'tires',
       'Coût au km anormal : ' || w.code_sigtb, w.cout_km || ' GNF/km (seuil ' || w.cout_km_max || ')', now()
  FROM public.v_pneus_surveillance w
 WHERE w.cout_km > w.cout_km_max AND public.regle_alerte_en_service('pneu_cout_anormal')
UNION ALL
SELECT 'pneu_historique_incomplet', 'pneu_operation', w.montage_id, w.vehicle_id, NULL, w.site_suivi_id, 'info', 'maintenance', 'tires',
       'Historique incomplet : ' || w.code_sigtb, 'Montage sans compteur kilométrique : km et coût au km non calculables',
       now()
  FROM public.v_pneus_surveillance w
 WHERE w.montage_sans_km AND public.regle_alerte_en_service('pneu_historique_incomplet')
UNION ALL
SELECT 'pneu_duree_depassee', 'tire', w.id, w.vehicle_id, NULL, w.site_suivi_id, 'warning', 'maintenance', 'tires',
       'Durée de vie dépassée : ' || w.code_sigtb,
       'En service depuis le ' || to_char(w.debut_vie, 'DD/MM/YYYY') || ' (durée ' || w.duree_max_jours || ' j)',
       w.debut_vie::timestamptz
  FROM public.v_pneus_surveillance w
 WHERE w.debut_vie < current_date - w.duree_max_jours AND public.regle_alerte_en_service('pneu_duree_depassee');
REVOKE ALL ON public.v_alertes_candidates FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_alertes_candidates TO service_role;

-- ===================================================================
-- 13. Pieces jointes (D-083) : pneus, inspections, interventions
-- ===================================================================

ALTER TABLE public.pieces_jointes DROP CONSTRAINT IF EXISTS pieces_jointes_objet_type_check;
ALTER TABLE public.pieces_jointes ADD CONSTRAINT pieces_jointes_objet_type_check CHECK (objet_type IN
  ('voyage', 'ticket_pesee_cbg', 'releve_compteur', 'releve_cbg', 'livraison_carburant_cbg',
   'pneu', 'pneu_inspection', 'pneu_intervention'));

-- Reprise de 20261121200000, plus les objets pneus (module maintenance,
-- perimetre du pneu : engin s'il est monte, sinon site).
CREATE OR REPLACE FUNCTION public.piece_resoudre_objet(
  p_objet_type text, p_objet_id uuid,
  OUT trouve boolean, OUT module text, OUT site_id uuid, OUT permis boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_dep uuid;
  v_arr uuid;
  v_tire uuid;
  t public.tires;
BEGIN
  trouve := false; permis := false; module := NULL; site_id := NULL;
  IF p_objet_type = 'voyage' THEN
    SELECT tr.departure_site_id, tr.arrival_site_id INTO v_dep, v_arr FROM public.trips tr WHERE tr.id = p_objet_id;
    IF FOUND THEN
      trouve := true; module := 'trips'; site_id := coalesce(v_arr, v_dep);
      permis := public.site_permis(v_dep) OR public.site_permis(v_arr);
    END IF;
  ELSIF p_objet_type = 'ticket_pesee_cbg' THEN
    SELECT tr.departure_site_id, tr.arrival_site_id, k.site_id INTO v_dep, v_arr, site_id
      FROM public.tickets_pesee_cbg k JOIN public.trips tr ON tr.id = k.trip_id
     WHERE k.id = p_objet_id;
    IF FOUND THEN
      trouve := true; module := 'trips';
      permis := public.site_permis(v_dep) OR public.site_permis(v_arr);
    END IF;
  ELSIF p_objet_type = 'releve_compteur' THEN
    SELECT v.site_id INTO site_id
      FROM public.releves_compteur r JOIN public.vehicles v ON v.id = r.vehicle_id
     WHERE r.id = p_objet_id;
    IF FOUND THEN
      trouve := true; module := 'trips'; permis := public.site_permis(site_id);
    END IF;
  ELSIF p_objet_type = 'releve_cbg' THEN
    SELECT r.site_id INTO site_id FROM public.releves_cbg r WHERE r.id = p_objet_id;
    IF FOUND THEN
      trouve := true; module := 'trips'; permis := public.site_permis(site_id);
    END IF;
  ELSIF p_objet_type = 'livraison_carburant_cbg' THEN
    SELECT l.site_id INTO site_id FROM public.livraisons_carburant_cbg l WHERE l.id = p_objet_id;
    IF FOUND THEN
      trouve := true; module := 'fuel'; permis := public.site_permis(site_id);
    END IF;
  ELSIF p_objet_type IN ('pneu', 'pneu_inspection', 'pneu_intervention') THEN
    v_tire := CASE p_objet_type
      WHEN 'pneu' THEN p_objet_id
      WHEN 'pneu_inspection' THEN (SELECT d.tire_id FROM public.pneus_inspections d WHERE d.id = p_objet_id)
      ELSE (SELECT i.tire_id FROM public.pneus_interventions i WHERE i.id = p_objet_id) END;
    SELECT * INTO t FROM public.tires WHERE id = v_tire;
    IF FOUND THEN
      trouve := true; module := 'maintenance';
      site_id := coalesce((SELECT v.site_id FROM public.vehicles v WHERE v.id = t.vehicle_id), t.site_id);
      permis := public.pneu_permis(t.vehicle_id, t.site_id);
    END IF;
  END IF;
  permis := coalesce(permis, false);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.piece_resoudre_objet(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.piece_resoudre_objet(text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.piece_objet_lisible(p_objet_type text, p_objet_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF p_objet_type = 'voyage' THEN
    RETURN (public.has_module_view('trips') OR public.is_admin())
       AND public.voyage_permis(p_objet_id)
       AND EXISTS (SELECT 1 FROM public.trips t WHERE t.id = p_objet_id);
  ELSIF p_objet_type = 'ticket_pesee_cbg' THEN
    RETURN (public.has_module_view('trips') OR public.has_module_view('invoices') OR public.is_admin())
       AND EXISTS (SELECT 1 FROM public.tickets_pesee_cbg k
                    WHERE k.id = p_objet_id AND public.voyage_permis(k.trip_id));
  ELSIF p_objet_type = 'releve_compteur' THEN
    RETURN (public.has_module_view('trips') OR public.has_module_view('contracts'))
       AND EXISTS (SELECT 1 FROM public.releves_compteur r
                    WHERE r.id = p_objet_id AND public.vehicule_permis(r.vehicle_id));
  ELSIF p_objet_type = 'releve_cbg' THEN
    RETURN (public.has_module_view('trips') OR public.has_module_view('invoices') OR public.is_admin())
       AND EXISTS (SELECT 1 FROM public.releves_cbg r
                    WHERE r.id = p_objet_id AND public.site_permis(r.site_id));
  ELSIF p_objet_type = 'livraison_carburant_cbg' THEN
    RETURN (public.has_module_view('fuel') OR public.is_admin())
       AND EXISTS (SELECT 1 FROM public.livraisons_carburant_cbg l
                    WHERE l.id = p_objet_id AND public.site_permis(l.site_id));
  ELSIF p_objet_type = 'pneu' THEN
    RETURN public.pneus_lecture_permise()
       AND EXISTS (SELECT 1 FROM public.tires t WHERE t.id = p_objet_id AND public.pneu_permis(t.vehicle_id, t.site_id));
  ELSIF p_objet_type = 'pneu_inspection' THEN
    RETURN public.pneus_lecture_permise()
       AND EXISTS (SELECT 1 FROM public.pneus_inspections d JOIN public.tires t ON t.id = d.tire_id
                    WHERE d.id = p_objet_id AND public.pneu_permis(t.vehicle_id, t.site_id));
  ELSIF p_objet_type = 'pneu_intervention' THEN
    RETURN public.pneus_lecture_permise()
       AND EXISTS (SELECT 1 FROM public.pneus_interventions i JOIN public.tires t ON t.id = i.tire_id
                    WHERE i.id = p_objet_id AND public.pneu_permis(t.vehicle_id, t.site_id));
  END IF;
  RETURN false;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.piece_objet_lisible(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.piece_objet_lisible(text, uuid) TO authenticated, service_role;

-- ===================================================================
-- 14. Droits d'execution
-- ===================================================================

DO $$
DECLARE f text;
BEGIN
  -- API des comptes (droits et perimetre controles dans chaque fonction).
  FOREACH f IN ARRAY ARRAY[
    'definir_configuration_pneus(text, text, text, jsonb, text, text)',
    'retirer_configuration_pneus(uuid, text)',
    'definir_seuils_pneus(jsonb, text, uuid)',
    'desactiver_seuils_pneus(uuid, text)',
    'definir_critere_rechapage(text, text, boolean, jsonb, boolean, text)',
    'creer_carcasse_pneu(jsonb, uuid, text, text, timestamptz, text)',
    'corriger_caracteristiques_pneu(uuid, jsonb, text)',
    'monter_pneu(uuid, uuid, text, timestamptz, numeric, numeric, numeric, text, text)',
    'demonter_pneu(uuid, text, text, uuid, timestamptz, numeric, numeric, text, text)',
    'permuter_pneu(uuid, text, timestamptz, numeric, text)',
    'transferer_pneu(uuid, uuid, text, timestamptz, text)',
    'rechaper_pneu(uuid, text, uuid, timestamptz, bigint, numeric, text, text)',
    'reparer_pneu(uuid, uuid, timestamptz, bigint, text, numeric, text, text)',
    'inspecter_pneu_detail(uuid, timestamptz, text, jsonb, numeric, numeric, jsonb, text, numeric, text, text)',
    'proposer_immobilisation_pneu(uuid, text, uuid)',
    'decider_proposition_immobilisation(uuid, boolean, text, text)',
    'envoyer_pneu_intervention(uuid, text, text, timestamptz, text, uuid, jsonb, text, text, text)',
    'enregistrer_retour_intervention(uuid, uuid, timestamptz, bigint, numeric, text, integer, numeric, text, uuid, text, text)',
    'controler_intervention_pneu(uuid, boolean, text)',
    'decider_remise_en_service_pneu(uuid, text, text)',
    'annuler_intervention_pneu(uuid, text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  -- Internes.
  FOREACH f IN ARRAY ARRAY[
    'etat_configuration_pneus(uuid)', 'pneus_montes_configuration(uuid, text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END $$;
