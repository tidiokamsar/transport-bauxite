/*
  # Clauses contractuelles, echeances, budgets, dettes, export comptable,
  # evaluation periodique du loueur (D-065, lot 19 du plan maitre, modules
  # 10, 19 et 20)

  Numero de sequence 20261121120000 (D-070) : au-dessus de D-063, D-075,
  D-066 et de D-064 (`20261121110000`). Integree sur `main` apres D-072 :
  les fonctions reprises (`mes_validations`, `valider_reglage`,
  `evaluer_fournisseur`, `definir_critere_evaluation`) partent de leur
  derniere definition sur `main`.

  Cartographie (CDC 33) : le dossier contractuel (D-026) porte deja
  `contrats.date_fin`, les engagements (`contrat_engagements`, D-031) et un
  champ `consequence` en texte libre ; le rapport de performance
  (`rapports_performance`, D-031) fige les engagements mesures ; les
  factures et avoirs (D-029), les encaissements (D-031), le controle des
  factures du loueur (D-032), les achats (D-053), les paiements (D-055,
  `v_reste_a_payer`, D-072 R3) et les couts (D-058) existent. Rien n'est
  duplique.

  Regles d'argent : montants en numeric(18,2) (valeur de clause : numeric(18,4)),
  devise portee par chaque ligne, HT ou TTC dans le nom de la colonne ou
  dans `base_montant` ; aucun taux ni montant suppose ; toute ecriture par
  fonction SECURITY DEFINER (search_path vide, droit de module, verrou,
  journal), aucune ecriture directe, ni DELETE ni TRUNCATE pour les comptes.

  1. Echeances : `contrats` recoit le preavis (jours), le mode de
     renouvellement (tacite, expres, aucun ; NULL = non renseigne) et la
     duree d'un renouvellement (mois). `contrats_echeances` (append-only)
     trace renouvellements et denonciations, `enregistrer_echeance_contrat`.
     `v_echeances_contrats` : date cle (limite de preavis puis fin), alerte
     a partir de la date cle moins le delai du reglage
     `contrats_alerte_echeance_jours` (0 si absent : alerte a la date cle
     seulement, aucune valeur supposee). Une prolongation tacite n'est
     jamais ecrite automatiquement.
  2. Clauses chiffrees par version (`contrat_clauses`, `definir_clause`,
     `desactiver_clause`) : penalite, bonus ou retenue, base montant HT ou
     taux (aucun taux suppose : valeur saisie), condition = un engagement
     D-031 mesure de la meme version (tenu ou non tenu), plafond HT
     eventuel. `calculer_clauses(rapport)` propose les montants HT depuis le
     rapport de performance remis (fige), assiette = factures et avoirs
     emis de la periode, dans la devise du contrat, hors lignes produites
     par une clause ; rien n'est applique automatiquement. `decider_clause` :
     decision humaine motivee. Appliquer produit une ligne de facture
     brouillon ou un avoir par le circuit D-029 (`recalculer_facture`,
     `journaliser_facture`, `creer_avoir`) ; le decideur en est le
     preparateur (une ligne ne s'ajoute qu'a un brouillon qu'il a prepare),
     la signature reste au Directeur General, jamais le preparateur.
     Ecarter (renoncer a un montant) revient, si le reglage
     `clauses_renonciation_separee` l'exige (exigee si absent), a une
     personne qui a le droit d'approbation des contrats et qui n'a pas
     calcule la proposition.
  3. Budgets : referentiel `natures_depense` (administrateur), categories
     de cout rattachees a une nature, imputation des pieces
     (`imputations_budgetaires`, append-only, `imputer_depense`). `budgets`
     par periode, centre (site, NULL = sans site), nature et devise, montant
     TTC saisi (`definir_budget`, revision motivee, `annuler_budget`).
     `v_depenses_budgetaires` : engage = bons approuves ou recus en partie
     (commande HT + taxes du bon, GNF par convention D-055) et pieces
     payables non payees (`v_reste_a_payer`, TTC) ; realise = paiements
     executes et couts enregistres (montant saisi). `v_suivi_budgets` :
     budget, engage, realise, disponible, depassement (alerte, aucun
     blocage) et sources non visibles avec les droits du lecteur. Dettes :
     `v_dettes_fournisseurs` depuis `v_reste_a_payer` (du = base - paye).
  4. Export comptable : `plan_comptable` et `comptes_tiers` (referentiels
     administrateur, aucun numero suppose) ; `ecritures_gestion(du, au)` :
     factures et avoirs emis, encaissements, paiements executes, couts, avec
     piece, date, tiers, compte de tiers si parametre (NULL sinon), montant,
     devise. Le CSV est construit par l'ecran.
  5. Evaluation periodique du loueur : grille D-059 reutilisee
     (`criteres_evaluation_fournisseur.grille` = 'loueur', indicateur mesure
     optionnel), evaluation rattachee au contrat de location
     (`evaluations_fournisseurs.contrat_id`, append-only, mesures figees).
     `mesures_loueur` (disponibilite, delai de prise en charge D-049,
     interventions hors delai, ecart de facture D-032), `definir_critere_loueur`,
     `evaluer_loueur`. `evaluer_fournisseur` et `definir_critere_evaluation`
     ne lisent et n'ecrivent plus que la grille fournisseur.
  6. `mes_validations()` reprise avec toutes ses branches (D-056) plus :
     echeances de contrat, clauses a decider, budgets depasses.
  7. `valider_reglage` reprise avec toutes ses cles (derniere definition :
     D-063, `20261121090000`) plus `contrats_alerte_echeance_jours` (entier)
     et `clauses_renonciation_separee` (booleen).
  8. Revue independante de l'integration (2026-11-16) : calcul rouvert
     (« propose », journalise dans `calculs_clauses_journal`) quand la
     facture ou l'avoir qu'il a produit est annule ; une clause n'est
     proposee qu'une fois pour des rapports dont les periodes se
     chevauchent (seul un calcul propose ou applique couvre la periode) ;
     `creer_avoir` (D-029) repris avec verrou et plafond apres
     avoirs ; `rapport_client` et `indicateurs_charge_contrats` reprises,
     limitees aux factures des contrats clients (`est_facture_client`).
     Contrat en brouillon (non signe) : clauses saisissables, mais ni rapport
     de performance (`generer_rapport_performance`, `marquer_rapport_remis`,
     D-031, reprises), ni calcul, ni application ; suspendu ou clos : un mois
     ecoule reste calculable.

  Idempotent : IF NOT EXISTS, CREATE OR REPLACE, DROP ... IF EXISTS.
*/

-- 0. Garde append-only commune aux nouveaux journaux --------------------------

CREATE OR REPLACE FUNCTION public.garde_append_only_finance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN coalesce(NEW, OLD); END IF;
  RAISE EXCEPTION 'Enregistrement non modifiable : saisir un nouvel enregistrement' USING ERRCODE = '42501';
END;
$$;

-- 1. Echeances et renouvellements ---------------------------------------------

ALTER TABLE public.contrats ADD COLUMN IF NOT EXISTS preavis_jours integer;
ALTER TABLE public.contrats ADD COLUMN IF NOT EXISTS renouvellement text;
ALTER TABLE public.contrats ADD COLUMN IF NOT EXISTS renouvellement_duree_mois integer;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contrats_preavis_positif') THEN
    ALTER TABLE public.contrats ADD CONSTRAINT contrats_preavis_positif CHECK (preavis_jours IS NULL OR preavis_jours >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contrats_renouvellement_connu') THEN
    ALTER TABLE public.contrats ADD CONSTRAINT contrats_renouvellement_connu
      CHECK (renouvellement IS NULL OR renouvellement IN ('tacite', 'expres', 'aucun'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contrats_renouvellement_duree') THEN
    ALTER TABLE public.contrats ADD CONSTRAINT contrats_renouvellement_duree
      CHECK (renouvellement_duree_mois IS NULL OR renouvellement_duree_mois > 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.contrats_echeances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrat_id uuid NOT NULL REFERENCES public.contrats(id),
  evenement text NOT NULL CHECK (evenement IN ('renouvellement', 'denonciation')),
  date_evenement date NOT NULL,
  ancienne_fin date,
  nouvelle_fin date,
  hors_preavis boolean,
  motif text NOT NULL CHECK (btrim(motif) <> ''),
  document_ref text,
  par uuid REFERENCES auth.users(id),
  le timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (evenement <> 'renouvellement' OR nouvelle_fin IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_contrats_echeances ON public.contrats_echeances (contrat_id, le);

-- Delai d'alerte avant la date cle : reglage administrateur, 0 si absent
-- (alerte a la date cle seulement ; aucune valeur documentee).
CREATE OR REPLACE FUNCTION public.delai_alerte_echeances_contrats()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.reglage_entier('contrats_alerte_echeance_jours', 0);
$$;
REVOKE EXECUTE ON FUNCTION public.delai_alerte_echeances_contrats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delai_alerte_echeances_contrats() TO authenticated;

CREATE OR REPLACE FUNCTION public.enregistrer_echeance_contrat(
  p_contrat uuid, p_evenement text, p_date date, p_motif text, p_nouvelle_fin date DEFAULT NULL, p_document text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE c public.contrats; v_id uuid; v_hors boolean;
BEGIN
  IF NOT (public.has_module_write('contracts') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les contrats requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO c FROM public.contrats WHERE id = p_contrat FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrat introuvable' USING ERRCODE = '22023'; END IF;
  IF c.statut NOT IN ('actif', 'suspendu') THEN
    RAISE EXCEPTION 'Contrat % : echeance traitee sur un contrat actif ou suspendu seulement', c.statut USING ERRCODE = '22023';
  END IF;
  IF c.date_fin IS NULL THEN RAISE EXCEPTION 'Contrat sans date de fin : aucune echeance a traiter' USING ERRCODE = '22023'; END IF;
  IF p_evenement IS NULL OR p_evenement NOT IN ('renouvellement', 'denonciation') THEN
    RAISE EXCEPTION 'Evenement : renouvellement ou denonciation' USING ERRCODE = '22023';
  END IF;
  IF p_date IS NULL OR p_date > current_date THEN RAISE EXCEPTION 'Date de l''evenement requise, non future' USING ERRCODE = '22023'; END IF;
  IF public.texte_ou_null(p_motif) IS NULL THEN RAISE EXCEPTION 'Motif requis' USING ERRCODE = '22023'; END IF;
  IF p_evenement = 'renouvellement' THEN
    IF p_nouvelle_fin IS NULL OR p_nouvelle_fin <= c.date_fin THEN
      RAISE EXCEPTION 'Nouvelle date de fin requise, posterieure a la fin actuelle (%)', c.date_fin USING ERRCODE = '22023';
    END IF;
  ELSE
    v_hors := CASE WHEN c.preavis_jours IS NULL THEN NULL ELSE p_date > c.date_fin - c.preavis_jours END;
  END IF;
  INSERT INTO public.contrats_echeances (contrat_id, evenement, date_evenement, ancienne_fin, nouvelle_fin, hors_preavis, motif, document_ref, par)
  VALUES (c.id, p_evenement, p_date, c.date_fin, CASE WHEN p_evenement = 'renouvellement' THEN p_nouvelle_fin END, v_hors,
          btrim(p_motif), public.texte_ou_null(p_document), auth.uid())
  RETURNING id INTO v_id;
  IF p_evenement = 'renouvellement' THEN
    -- Le journal du dossier (journaliser_contrats) trace l'ancienne et la nouvelle fin.
    UPDATE public.contrats SET date_fin = p_nouvelle_fin WHERE id = c.id;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE VIEW public.v_echeances_contrats WITH (security_invoker = true) AS
WITH base AS (
  SELECT c.id AS contrat_id, c.reference, c.intitule, c.nature, c.contrepartie, c.statut, c.date_fin, c.preavis_jours,
         c.renouvellement, c.renouvellement_duree_mois,
         CASE WHEN d.evenement = 'denonciation' THEN d.date_evenement END AS denonce_le,
         CASE WHEN c.preavis_jours IS NOT NULL THEN c.date_fin - c.preavis_jours END AS date_limite_preavis,
         public.delai_alerte_echeances_contrats() AS delai_alerte_jours
    FROM public.contrats c
    LEFT JOIN LATERAL (SELECT e.evenement, e.date_evenement FROM public.contrats_echeances e
                        WHERE e.contrat_id = c.id ORDER BY e.le DESC LIMIT 1) d ON true
   WHERE c.date_fin IS NOT NULL AND c.statut IN ('actif', 'suspendu')
), cle AS (
  SELECT b.*,
         CASE WHEN b.denonce_le IS NULL AND b.date_limite_preavis IS NOT NULL AND b.renouvellement IS DISTINCT FROM 'aucun'
                   AND current_date <= b.date_limite_preavis THEN 'limite_preavis' ELSE 'fin' END AS nature_echeance
    FROM base b
)
SELECT k.contrat_id, k.reference, k.intitule, k.nature, k.contrepartie, k.statut, k.date_fin, k.preavis_jours, k.renouvellement,
       k.renouvellement_duree_mois, k.denonce_le, k.date_limite_preavis, k.nature_echeance,
       CASE k.nature_echeance WHEN 'limite_preavis' THEN k.date_limite_preavis ELSE k.date_fin END AS date_cle,
       k.delai_alerte_jours,
       CASE k.nature_echeance WHEN 'limite_preavis' THEN k.date_limite_preavis ELSE k.date_fin END - k.delai_alerte_jours AS date_alerte,
       CASE k.nature_echeance WHEN 'limite_preavis' THEN k.date_limite_preavis ELSE k.date_fin END - current_date AS jours_restants,
       current_date >= CASE k.nature_echeance WHEN 'limite_preavis' THEN k.date_limite_preavis ELSE k.date_fin END - k.delai_alerte_jours AS a_signaler,
       k.date_fin < current_date AS echu,
       -- Proposition seulement : une prolongation tacite n'est jamais ecrite automatiquement.
       CASE WHEN k.renouvellement = 'tacite' AND k.renouvellement_duree_mois IS NOT NULL AND k.denonce_le IS NULL
            THEN (k.date_fin + make_interval(months => k.renouvellement_duree_mois))::date END AS fin_si_tacite
  FROM cle k;

-- 2. Clauses chiffrees ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.contrat_clauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Pas de suppression en cascade : une version ou un engagement qui
  -- conditionne une clause (meme desactivee) ne se supprime plus.
  version_id uuid NOT NULL REFERENCES public.contrat_versions(id),
  type_clause text NOT NULL CHECK (type_clause IN ('penalite', 'bonus', 'retenue')),
  libelle text NOT NULL CHECK (btrim(libelle) <> ''),
  engagement_id uuid NOT NULL REFERENCES public.contrat_engagements(id),
  declenchement text NOT NULL CHECK (declenchement IN ('non_tenu', 'tenu')),
  base text NOT NULL CHECK (base IN ('montant', 'taux')),
  -- base 'montant' : montant HT dans la devise du contrat ; base 'taux' :
  -- pourcentage de l'assiette HT.
  valeur numeric(18,4) NOT NULL CHECK (valeur > 0),
  plafond_ht numeric(18,2) CHECK (plafond_ht IS NULL OR plafond_ht > 0),
  article text,
  ordre integer NOT NULL DEFAULT 0,
  actif boolean NOT NULL DEFAULT true,
  motif_desactivation text,
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now(),
  CHECK (base <> 'taux' OR valeur <= 100),
  CHECK (actif OR nullif(btrim(coalesce(motif_desactivation, '')), '') IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_contrat_clauses ON public.contrat_clauses (version_id, ordre);

DROP TRIGGER IF EXISTS journaliser ON public.contrat_clauses;
CREATE TRIGGER journaliser AFTER INSERT OR UPDATE OR DELETE ON public.contrat_clauses
  FOR EACH ROW EXECUTE FUNCTION public.journaliser_contrats();

CREATE TABLE IF NOT EXISTS public.calculs_clauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clause_id uuid NOT NULL REFERENCES public.contrat_clauses(id),
  rapport_id uuid NOT NULL REFERENCES public.rapports_performance(id),
  contrat_id uuid NOT NULL REFERENCES public.contrats(id),
  periode_debut date NOT NULL,
  periode_fin date NOT NULL,
  type_clause text NOT NULL,
  libelle text NOT NULL,
  base text NOT NULL,
  valeur numeric(18,4) NOT NULL,
  plafond_ht numeric(18,2),
  engagement_id uuid,
  indicateur text,
  seuil numeric,
  sens text,
  unite text,
  realise numeric,
  echantillon integer,
  conforme boolean,
  declenchee boolean,
  assiette_ht numeric(18,2),
  assiette_source text,
  montant_calcule_ht numeric(18,2),
  montant_propose_ht numeric(18,2),
  devise text NOT NULL CHECK (devise ~ '^[A-Z]{3}$'),
  raison text,
  statut text NOT NULL CHECK (statut IN ('propose', 'sans_objet', 'applique', 'ecarte')),
  calcule_par uuid REFERENCES auth.users(id),
  calcule_le timestamptz NOT NULL DEFAULT clock_timestamp(),
  decide_par uuid REFERENCES auth.users(id),
  decide_le timestamptz,
  motif_decision text,
  facture_id uuid REFERENCES public.factures(id),
  UNIQUE (clause_id, rapport_id),
  CHECK (statut NOT IN ('applique', 'ecarte') OR nullif(btrim(coalesce(motif_decision, '')), '') IS NOT NULL),
  CHECK (statut NOT IN ('applique', 'ecarte') OR (decide_par IS NOT NULL AND decide_le IS NOT NULL)),
  CHECK (statut <> 'applique' OR facture_id IS NOT NULL),
  CHECK (statut NOT IN ('propose', 'applique', 'ecarte') OR montant_propose_ht > 0)
);
CREATE INDEX IF NOT EXISTS idx_calculs_clauses_contrat ON public.calculs_clauses (contrat_id, periode_debut);

-- Un calcul est fige : seule la decision (propose -> applique ou ecarte)
-- change son statut et ses champs de decision ; il ne se supprime pas.
-- Exception explicite : un calcul applique revient a « propose », champs de
-- decision vides, quand la facture ou l'avoir qu'il a produit est annule
-- (`rouvrir_clauses_facture_annulee`) : le montant ne disparait jamais sans
-- nouvelle decision.
CREATE OR REPLACE FUNCTION public.garde_calcul_clause()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN coalesce(NEW, OLD); END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Un calcul de clause ne se supprime pas' USING ERRCODE = '42501'; END IF;
  IF OLD.statut = 'applique' AND NEW.statut = 'propose'
     AND EXISTS (SELECT 1 FROM public.factures f WHERE f.id = OLD.facture_id AND f.statut = 'annulee')
     AND NEW.decide_par IS NULL AND NEW.decide_le IS NULL AND NEW.motif_decision IS NULL AND NEW.facture_id IS NULL
     AND (to_jsonb(NEW) - ARRAY['statut', 'decide_par', 'decide_le', 'motif_decision', 'facture_id'])
         = (to_jsonb(OLD) - ARRAY['statut', 'decide_par', 'decide_le', 'motif_decision', 'facture_id']) THEN
    RETURN NEW;
  END IF;
  IF OLD.statut <> 'propose' OR NEW.statut NOT IN ('applique', 'ecarte')
     OR (to_jsonb(NEW) - ARRAY['statut', 'decide_par', 'decide_le', 'motif_decision', 'facture_id'])
        IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['statut', 'decide_par', 'decide_le', 'motif_decision', 'facture_id']) THEN
    RAISE EXCEPTION 'Calcul de clause fige : seule une proposition se decide' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS garde_calcul_clause ON public.calculs_clauses;
CREATE TRIGGER garde_calcul_clause BEFORE UPDATE OR DELETE ON public.calculs_clauses
  FOR EACH ROW EXECUTE FUNCTION public.garde_calcul_clause();

-- Ligne de facture produite par une clause : exclue de l'assiette des
-- clauses suivantes (pas de clause calculee sur une clause).
ALTER TABLE public.facture_lignes ADD COLUMN IF NOT EXISTS calcul_clause_id uuid REFERENCES public.calculs_clauses(id);
CREATE INDEX IF NOT EXISTS idx_facture_lignes_calcul_clause ON public.facture_lignes (calcul_clause_id) WHERE calcul_clause_id IS NOT NULL;

-- Historique des decisions sur un calcul (append-only) : application,
-- renonciation, reouverture apres annulation de la piece produite.
CREATE TABLE IF NOT EXISTS public.calculs_clauses_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calcul_id uuid NOT NULL REFERENCES public.calculs_clauses(id),
  evenement text NOT NULL CHECK (evenement IN ('applique', 'ecarte', 'reouvert')),
  facture_id uuid REFERENCES public.factures(id),
  motif text NOT NULL CHECK (btrim(motif) <> ''),
  par uuid REFERENCES auth.users(id),
  le timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_calculs_clauses_journal ON public.calculs_clauses_journal (calcul_id, le);

-- Facture ou avoir annule (brouillon ou a signer, D-029) : chaque calcul
-- applique qui l'a produit et dont une ligne y figure revient a « propose »,
-- journalise. Vaut pour toute facture portant une ligne de clause
-- (facture de reconciliation comprise).
CREATE OR REPLACE FUNCTION public.rouvrir_clauses_facture_annulee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE k record;
BEGIN
  IF NEW.statut = 'annulee' AND OLD.statut IS DISTINCT FROM 'annulee' THEN
    FOR k IN SELECT c.id FROM public.calculs_clauses c
              WHERE c.statut = 'applique' AND c.facture_id = NEW.id
                AND c.id IN (SELECT l.calcul_clause_id FROM public.facture_lignes l
                              WHERE l.facture_id = NEW.id AND l.calcul_clause_id IS NOT NULL)
              ORDER BY c.id FOR UPDATE LOOP
      UPDATE public.calculs_clauses SET statut = 'propose', decide_par = NULL, decide_le = NULL, motif_decision = NULL, facture_id = NULL
       WHERE id = k.id;
      INSERT INTO public.calculs_clauses_journal (calcul_id, evenement, facture_id, motif, par)
      VALUES (k.id, 'reouvert', NEW.id,
              CASE NEW.type WHEN 'avoir' THEN 'Avoir' ELSE 'Facture' END || ' annule(e) : '
                || coalesce(nullif(btrim(coalesce(NEW.motif, '')), ''), 'sans motif'), auth.uid());
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS rouvrir_clauses_facture_annulee ON public.factures;
CREATE TRIGGER rouvrir_clauses_facture_annulee AFTER UPDATE OF statut ON public.factures
  FOR EACH ROW EXECUTE FUNCTION public.rouvrir_clauses_facture_annulee();

-- Avoir (D-029, derniere definition `20261111120000`, non modifiee par
-- D-072) : reprise a l'identique, plus le verrou de la facture et le
-- plafond = HT de la facture moins les avoirs deja crees non annules (deux
-- avoirs ne depassent plus la facture).
CREATE OR REPLACE FUNCTION public.creer_avoir(p_facture_id uuid, p_montant_ht numeric, p_motif text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f public.factures;
  v_id uuid;
  v_reste numeric;
BEGIN
  IF NOT public.has_module_write('invoices') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la facturation requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO f FROM public.factures WHERE id = p_facture_id FOR UPDATE;
  IF NOT FOUND OR f.type <> 'facture' OR f.statut <> 'emise' THEN
    RAISE EXCEPTION 'Un avoir corrige une facture emise' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motif obligatoire pour un avoir' USING ERRCODE = '22023';
  END IF;
  v_reste := f.montant_ht + coalesce((SELECT sum(a.montant_ht) FROM public.factures a
                                       WHERE a.facture_origine_id = f.id AND a.type = 'avoir' AND a.statut <> 'annulee'), 0);
  IF p_montant_ht IS NULL OR p_montant_ht <= 0 OR p_montant_ht > v_reste THEN
    RAISE EXCEPTION 'Montant de l''avoir positif et au plus egal au reste HT de la facture apres avoirs (% %)', v_reste, f.devise
      USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.factures (type, contrat_id, facture_origine_id, objet, periode_debut, periode_fin, devise,
    taux_taxe_pct, delai_paiement_jours, prepare_par, motif)
  VALUES ('avoir', f.contrat_id, f.id, 'Avoir sur la facture ' || f.numero, f.periode_debut, f.periode_fin, f.devise,
    f.taux_taxe_pct, f.delai_paiement_jours, auth.uid(), btrim(p_motif))
  RETURNING id INTO v_id;
  INSERT INTO public.facture_lignes (facture_id, libelle, quantite, unite, prix_unitaire, montant)
  VALUES (v_id, btrim(p_motif), 1, 'forfait', -p_montant_ht, -p_montant_ht);
  PERFORM public.recalculer_facture(v_id);
  PERFORM public.journaliser_facture(v_id, 'generation', btrim(p_motif));
  RETURN v_id;
END;
$$;

-- p_id NULL : nouvelle clause ; sinon modification d'une clause sans calcul.
CREATE OR REPLACE FUNCTION public.definir_clause(
  p_version uuid, p_type text, p_libelle text, p_engagement uuid, p_declenchement text, p_base text, p_valeur numeric,
  p_plafond numeric DEFAULT NULL, p_article text DEFAULT NULL, p_ordre integer DEFAULT 0, p_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE g public.contrat_engagements; v_id uuid; v_statut text;
BEGIN
  IF NOT (public.has_module_write('contracts') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les contrats requis' USING ERRCODE = '42501';
  END IF;
  -- Verrou de la version : saisies de clauses et calculs serialises.
  SELECT c.statut INTO v_statut FROM public.contrat_versions v JOIN public.contrats c ON c.id = v.contrat_id
   WHERE v.id = p_version FOR UPDATE OF v;
  IF NOT FOUND THEN RAISE EXCEPTION 'Version du contrat introuvable' USING ERRCODE = '22023'; END IF;
  IF v_statut NOT IN ('brouillon', 'actif') THEN
    RAISE EXCEPTION 'Contrat % : une clause chiffree se saisit sur un contrat en brouillon ou actif', v_statut USING ERRCODE = '22023';
  END IF;
  IF p_type IS NULL OR p_type NOT IN ('penalite', 'bonus', 'retenue') THEN
    RAISE EXCEPTION 'Type de clause : penalite, bonus ou retenue' USING ERRCODE = '22023';
  END IF;
  IF public.texte_ou_null(p_libelle) IS NULL THEN RAISE EXCEPTION 'Libelle de la clause requis' USING ERRCODE = '22023'; END IF;
  SELECT * INTO g FROM public.contrat_engagements WHERE id = p_engagement;
  IF NOT FOUND OR g.version_id <> p_version THEN
    RAISE EXCEPTION 'La condition se rapporte a un engagement de la meme version du contrat' USING ERRCODE = '22023';
  END IF;
  IF g.indicateur = 'autre' THEN
    RAISE EXCEPTION 'Engagement « autre » non mesure : il ne peut pas conditionner une clause chiffree' USING ERRCODE = '22023';
  END IF;
  IF p_declenchement IS NULL OR p_declenchement NOT IN ('non_tenu', 'tenu') THEN
    RAISE EXCEPTION 'Declenchement : engagement tenu ou non tenu' USING ERRCODE = '22023';
  END IF;
  IF p_base IS NULL OR p_base NOT IN ('montant', 'taux') THEN RAISE EXCEPTION 'Base : montant ou taux' USING ERRCODE = '22023'; END IF;
  IF p_valeur IS NULL OR p_valeur <= 0 OR (p_base = 'taux' AND p_valeur > 100) THEN
    RAISE EXCEPTION 'Valeur saisie requise : montant positif ou taux de 0 a 100 %%' USING ERRCODE = '22023';
  END IF;
  IF (p_base = 'montant' AND p_valeur <> round(p_valeur, 2)) OR (p_base = 'taux' AND p_valeur <> round(p_valeur, 4)) THEN
    RAISE EXCEPTION 'Montant HT a deux decimales au plus, taux a quatre decimales au plus' USING ERRCODE = '22023';
  END IF;
  IF p_plafond IS NOT NULL AND (p_plafond <= 0 OR p_plafond <> round(p_plafond, 2)) THEN
    RAISE EXCEPTION 'Plafond HT positif a deux decimales au plus, ou absent' USING ERRCODE = '22023';
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.contrat_clauses (version_id, type_clause, libelle, engagement_id, declenchement, base, valeur, plafond_ht, article, ordre, cree_par)
    VALUES (p_version, p_type, btrim(p_libelle), p_engagement, p_declenchement, p_base, p_valeur, p_plafond,
            public.texte_ou_null(p_article), coalesce(p_ordre, 0), auth.uid())
    RETURNING id INTO v_id;
  ELSE
    PERFORM 1 FROM public.contrat_clauses WHERE id = p_id FOR UPDATE;
    IF EXISTS (SELECT 1 FROM public.calculs_clauses WHERE clause_id = p_id) THEN
      RAISE EXCEPTION 'Clause deja calculee : la desactiver et en saisir une nouvelle' USING ERRCODE = '22023';
    END IF;
    UPDATE public.contrat_clauses SET type_clause = p_type, libelle = btrim(p_libelle), engagement_id = p_engagement,
      declenchement = p_declenchement, base = p_base, valeur = p_valeur, plafond_ht = p_plafond,
      article = public.texte_ou_null(p_article), ordre = coalesce(p_ordre, 0)
     WHERE id = p_id AND version_id = p_version AND actif
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Clause active introuvable dans cette version' USING ERRCODE = '22023'; END IF;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.desactiver_clause(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (public.has_module_write('contracts') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les contrats requis' USING ERRCODE = '42501';
  END IF;
  IF public.texte_ou_null(p_motif) IS NULL THEN RAISE EXCEPTION 'Motif requis' USING ERRCODE = '22023'; END IF;
  UPDATE public.contrat_clauses SET actif = false, motif_desactivation = btrim(p_motif) WHERE id = p_id AND actif;
  IF NOT FOUND THEN RAISE EXCEPTION 'Clause active introuvable' USING ERRCODE = '22023'; END IF;
END;
$$;

-- Propositions depuis un rapport de performance remis (fige). Une clause
-- deja calculee pour ce rapport n'est pas recalculee. Rien n'est applique.
-- Montants HT dans la devise du contrat. Assiette d'un taux : factures et
-- avoirs emis (client) ou factures du loueur controlees (location) dont la
-- periode est comprise dans celle du rapport, dans la devise du contrat,
-- hors lignes produites par une clause ; sinon « assiette absente », rien
-- n'est estime.
CREATE OR REPLACE FUNCTION public.calculer_clauses(p_rapport uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r public.rapports_performance; c public.contrats; v_version uuid; cl public.contrat_clauses; e jsonb;
  v_conforme boolean; v_decl boolean; v_assiette numeric(18,2); v_source text; v_calc numeric(18,2); v_prop numeric(18,2);
  v_raison text; n integer := 0; v_couvert record;
BEGIN
  IF NOT (public.has_module_write('contracts') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les contrats requis' USING ERRCODE = '42501';
  END IF;
  -- Verrou du rapport : deux calculs simultanes ne se chevauchent pas.
  SELECT * INTO r FROM public.rapports_performance WHERE id = p_rapport FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rapport introuvable' USING ERRCODE = '22023'; END IF;
  IF r.statut <> 'remis' THEN
    RAISE EXCEPTION 'Rapport non remis : les clauses se calculent sur un rapport fige et remis' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO c FROM public.contrats WHERE id = r.contrat_id;
  -- Contrat non signe : aucune somme due. Suspendu ou clos : un mois ecoule
  -- avant la suspension ou la cloture reste calculable.
  IF c.statut = 'brouillon' THEN
    RAISE EXCEPTION 'Contrat en brouillon (non signe) : aucune clause ne se calcule' USING ERRCODE = '22023';
  END IF;
  IF c.devise IS NULL OR c.devise !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Devise du contrat non renseignee : aucun montant ne se calcule' USING ERRCODE = '22023';
  END IF;
  -- Version en vigueur a la fin de la periode (meme regle que D-029 et D-031).
  SELECT v.id INTO v_version FROM public.contrat_versions v
   WHERE v.contrat_id = c.id AND v.date_effet <= r.periode_fin ORDER BY v.numero DESC LIMIT 1;
  IF v_version IS NULL THEN RAISE EXCEPTION 'Aucune version du contrat en vigueur sur la periode' USING ERRCODE = '22023'; END IF;

  FOR cl IN SELECT * FROM public.contrat_clauses k WHERE k.version_id = v_version AND k.actif
             AND NOT EXISTS (SELECT 1 FROM public.calculs_clauses x WHERE x.clause_id = k.id AND x.rapport_id = r.id)
             ORDER BY k.ordre, k.libelle FOR UPDATE OF k LOOP
    e := NULL;
    SELECT x.valeur INTO e FROM jsonb_array_elements(coalesce(r.contenu -> 'engagements', '[]'::jsonb)) AS x(valeur)
     WHERE x.valeur ->> 'engagement_id' = cl.engagement_id::text LIMIT 1;
    v_conforme := CASE WHEN e IS NULL OR jsonb_typeof(e -> 'conforme') IS DISTINCT FROM 'boolean' THEN NULL ELSE (e ->> 'conforme')::boolean END;
    v_decl := CASE WHEN v_conforme IS NULL THEN NULL
                   WHEN cl.declenchement = 'non_tenu' THEN NOT v_conforme ELSE v_conforme END;
    v_assiette := NULL; v_source := NULL; v_calc := NULL; v_prop := NULL; v_raison := NULL;
    -- Rapports dont les periodes se chevauchent : une clause n'est proposee
    -- qu'une fois pour une meme periode. Seul un calcul propose ou applique
    -- couvre la periode : un calcul sans objet (clause non declenchee ou
    -- periode deja couverte) ou ecarte ne bloque pas un rapport suivant.
    SELECT x.periode_debut, x.periode_fin INTO v_couvert FROM public.calculs_clauses x
     WHERE x.clause_id = cl.id AND x.rapport_id <> r.id AND x.statut IN ('propose', 'applique')
       AND x.periode_debut <= r.periode_fin AND x.periode_fin >= r.periode_debut
     ORDER BY x.calcule_le LIMIT 1;
    IF FOUND THEN
      v_raison := 'Periode deja couverte par le calcul du ' || to_char(v_couvert.periode_debut, 'DD/MM/YYYY')
                  || ' au ' || to_char(v_couvert.periode_fin, 'DD/MM/YYYY');
    ELSIF e IS NULL THEN
      v_raison := 'Engagement absent du rapport fige';
    ELSIF v_decl IS NULL THEN
      v_raison := 'Engagement non mesurable sur la periode';
    ELSIF NOT v_decl THEN
      v_raison := CASE WHEN v_conforme THEN 'Engagement tenu : clause non declenchee' ELSE 'Engagement non tenu : clause non declenchee' END;
    ELSE
      IF cl.base = 'montant' THEN
        v_calc := round(cl.valeur, 2);
      ELSE
        IF c.nature = 'client' THEN
          SELECT sum(f.montant_ht - coalesce((SELECT sum(l.montant) FROM public.facture_lignes l
                                               WHERE l.facture_id = f.id AND l.calcul_clause_id IS NOT NULL), 0)),
                 'factures et avoirs emis de la periode (HT, hors lignes de clauses)'
            INTO v_assiette, v_source
            FROM public.factures f
           WHERE f.contrat_id = c.id AND f.statut = 'emise' AND f.devise = c.devise
             AND f.periode_debut >= r.periode_debut AND f.periode_fin <= r.periode_fin;
        ELSIF c.nature = 'location' THEN
          SELECT sum(f.montant_ht_facture), 'factures du loueur controlees de la periode (HT facture)' INTO v_assiette, v_source
            FROM public.factures_fournisseur f
           WHERE f.contrat_id = c.id AND f.statut <> 'saisie' AND f.devise = c.devise
             AND f.periode_debut >= r.periode_debut AND f.periode_fin <= r.periode_fin;
        END IF;
        IF c.nature NOT IN ('client', 'location') THEN
          v_raison := 'Assiette non definie pour un contrat de cette nature';
        ELSIF v_assiette IS NULL OR v_assiette <= 0 THEN
          v_raison := 'Assiette absente : aucune facture de la periode dans la devise du contrat';
          v_assiette := NULL;
        ELSE
          v_calc := round(v_assiette * cl.valeur / 100, 2);
        END IF;
      END IF;
      IF v_calc IS NOT NULL THEN
        v_prop := CASE WHEN cl.plafond_ht IS NOT NULL THEN least(v_calc, cl.plafond_ht) ELSE v_calc END;
        IF cl.plafond_ht IS NOT NULL AND v_calc > cl.plafond_ht THEN v_raison := 'Montant ramene au plafond'; END IF;
        IF v_prop <= 0 THEN v_raison := 'Montant arrondi nul'; END IF;
      END IF;
    END IF;
    INSERT INTO public.calculs_clauses (clause_id, rapport_id, contrat_id, periode_debut, periode_fin, type_clause, libelle, base, valeur,
      plafond_ht, engagement_id, indicateur, seuil, sens, unite, realise, echantillon, conforme, declenchee, assiette_ht, assiette_source,
      montant_calcule_ht, montant_propose_ht, devise, raison, statut, calcule_par)
    VALUES (cl.id, r.id, c.id, r.periode_debut, r.periode_fin, cl.type_clause, cl.libelle, cl.base, cl.valeur, cl.plafond_ht,
      cl.engagement_id, e ->> 'indicateur', (e ->> 'seuil')::numeric, e ->> 'sens', e ->> 'unite', (e ->> 'realise')::numeric,
      (e ->> 'echantillon')::integer, v_conforme, v_decl, v_assiette, v_source, v_calc, v_prop, c.devise, v_raison,
      CASE WHEN v_prop > 0 THEN 'propose' ELSE 'sans_objet' END, auth.uid());
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

-- Decision humaine motivee, montants HT.
-- Appliquer (droits d'ecriture contrats et facturation) produit, par le
-- circuit D-029 :
--  - montant a facturer (bonus d'un contrat client ; penalite ou retenue du
--    loueur) : ligne positive sur une facture brouillon du contrat, ou
--    nouvelle facture brouillon (taux de taxe saisi) ;
--  - montant a deduire (penalite ou retenue d'un contrat client) : avoir sur
--    une facture emise (`creer_avoir`, au plus le reste apres avoirs) ou
--    ligne negative sur une facture brouillon du contrat.
-- Le decideur est le preparateur de la piece produite : une ligne ne
-- s'ajoute qu'a un brouillon qu'il a prepare, la nouvelle facture et l'avoir
-- portent son nom ; la signature (Directeur General, jamais le preparateur,
-- D-029) reste le controle. Ecarter = renoncer au montant : si le reglage
-- `clauses_renonciation_separee` l'exige (exigee si absent), droit
-- d'approbation des contrats et autre personne que l'auteur du calcul ;
-- sinon memes droits que pour appliquer. Retourne la facture ou l'avoir.
CREATE OR REPLACE FUNCTION public.decider_clause(
  p_calcul uuid, p_appliquer boolean, p_motif text, p_facture uuid DEFAULT NULL, p_taux_taxe numeric DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  k public.calculs_clauses; c public.contrats; f public.factures; v_sens text; v_id uuid; v_libelle text;
  v_separee boolean; v_reste numeric;
BEGIN
  IF p_appliquer IS NULL THEN RAISE EXCEPTION 'Decision requise' USING ERRCODE = '22023'; END IF;
  v_separee := coalesce((SELECT (s.value ->> 'value') <> 'false' FROM public.settings s WHERE s.key = 'clauses_renonciation_separee'), true);
  IF p_appliquer OR NOT v_separee THEN
    IF NOT ((public.has_module_write('contracts') AND public.has_module_write('invoices')) OR public.is_admin()) THEN
      RAISE EXCEPTION 'Droits d''ecriture sur les contrats et la facturation requis' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT (public.has_module_approve('contracts') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Renoncer a une clause : droit d''approbation des contrats requis (reglage clauses_renonciation_separee)' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO k FROM public.calculs_clauses WHERE id = p_calcul FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Calcul introuvable' USING ERRCODE = '22023'; END IF;
  IF k.statut <> 'propose' THEN RAISE EXCEPTION 'Seule une proposition se decide (%)', k.statut USING ERRCODE = '22023'; END IF;
  IF public.texte_ou_null(p_motif) IS NULL THEN RAISE EXCEPTION 'Motif de la decision requis' USING ERRCODE = '22023'; END IF;

  IF NOT p_appliquer THEN
    IF v_separee AND k.calcule_par IS NOT DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Renonciation par une autre personne que l''auteur du calcul (reglage clauses_renonciation_separee)' USING ERRCODE = '42501';
    END IF;
    UPDATE public.calculs_clauses SET statut = 'ecarte', decide_par = auth.uid(), decide_le = now(), motif_decision = btrim(p_motif)
     WHERE id = k.id;
    INSERT INTO public.calculs_clauses_journal (calcul_id, evenement, motif, par) VALUES (k.id, 'ecarte', btrim(p_motif), auth.uid());
    RETURN NULL;
  END IF;

  SELECT * INTO c FROM public.contrats WHERE id = k.contrat_id;
  IF c.statut = 'brouillon' THEN
    RAISE EXCEPTION 'Contrat en brouillon (non signe) : aucune clause ne s''applique' USING ERRCODE = '22023';
  END IF;
  v_sens := CASE
    WHEN c.nature = 'client' AND k.type_clause = 'bonus' THEN 'facturer'
    WHEN c.nature = 'client' THEN 'deduire'
    WHEN c.nature = 'location' AND k.type_clause IN ('penalite', 'retenue') THEN 'facturer'
  END;
  IF v_sens IS NULL THEN
    RAISE EXCEPTION 'Application non prise en charge : un bonus du loueur se regle sur sa facture (controle D-032)' USING ERRCODE = '22023';
  END IF;
  v_libelle := CASE k.type_clause WHEN 'penalite' THEN 'Penalite' WHEN 'bonus' THEN 'Bonus' ELSE 'Retenue' END
               || ' : ' || k.libelle || ' (' || to_char(k.periode_debut, 'DD/MM/YYYY') || ' au ' || to_char(k.periode_fin, 'DD/MM/YYYY') || ')';

  IF p_facture IS NOT NULL THEN
    SELECT * INTO f FROM public.factures WHERE id = p_facture FOR UPDATE;
    IF NOT FOUND OR f.contrat_id <> c.id OR f.type <> 'facture' OR f.devise <> k.devise THEN
      RAISE EXCEPTION 'Facture du meme contrat et de la meme devise requise' USING ERRCODE = '22023';
    END IF;
    IF f.statut = 'brouillon' AND f.prepare_par IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Une ligne de clause s''ajoute a un brouillon que vous avez prepare (le signataire ne doit pas en etre le preparateur)'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_sens = 'facturer' THEN
    IF p_facture IS NULL THEN
      IF p_taux_taxe IS NULL OR p_taux_taxe < 0 THEN
        RAISE EXCEPTION 'Taux de taxe requis pour une nouvelle facture (0 si exonere)' USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.factures (type, contrat_id, objet, periode_debut, periode_fin, devise, taux_taxe_pct, delai_paiement_jours, prepare_par)
      VALUES ('facture', c.id, v_libelle, k.periode_debut, k.periode_fin, k.devise, p_taux_taxe, c.delai_paiement_jours, auth.uid())
      RETURNING id INTO v_id;
      PERFORM public.journaliser_facture(v_id, 'generation', btrim(p_motif));
    ELSE
      IF f.statut <> 'brouillon' THEN RAISE EXCEPTION 'Une ligne s''ajoute a une facture brouillon' USING ERRCODE = '22023'; END IF;
      v_id := f.id;
    END IF;
    INSERT INTO public.facture_lignes (facture_id, ordre, libelle, quantite, unite, prix_unitaire, montant, calcul_clause_id)
    VALUES (v_id, 900, v_libelle, 1, 'forfait', k.montant_propose_ht, k.montant_propose_ht, k.id);
    PERFORM public.recalculer_facture(v_id);
    PERFORM public.journaliser_facture(v_id, 'clause', btrim(p_motif));
  ELSE
    IF p_facture IS NULL THEN
      RAISE EXCEPTION 'Facture du contrat requise : avoir sur une facture emise ou ligne sur un brouillon' USING ERRCODE = '22023';
    END IF;
    IF f.statut = 'emise' THEN
      -- Reste avoirable : HT de la facture moins les avoirs deja crees (non annules).
      v_reste := f.montant_ht + coalesce((SELECT sum(a.montant_ht) FROM public.factures a
                                           WHERE a.facture_origine_id = f.id AND a.type = 'avoir' AND a.statut <> 'annulee'), 0);
      IF k.montant_propose_ht > v_reste THEN
        RAISE EXCEPTION 'Deduction superieure au reste HT de la facture apres avoirs (% %)', v_reste, f.devise USING ERRCODE = '22023';
      END IF;
      v_id := public.creer_avoir(f.id, k.montant_propose_ht, v_libelle || ' : ' || btrim(p_motif));
      UPDATE public.facture_lignes SET calcul_clause_id = k.id WHERE facture_id = v_id;
      PERFORM public.journaliser_facture(v_id, 'clause', btrim(p_motif));
    ELSIF f.statut = 'brouillon' THEN
      IF k.montant_propose_ht > f.montant_ht THEN
        RAISE EXCEPTION 'Deduction superieure au montant HT du brouillon (% %)', f.montant_ht, f.devise USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.facture_lignes (facture_id, ordre, libelle, quantite, unite, prix_unitaire, montant, calcul_clause_id)
      VALUES (f.id, 900, v_libelle, 1, 'forfait', -k.montant_propose_ht, -k.montant_propose_ht, k.id);
      PERFORM public.recalculer_facture(f.id);
      PERFORM public.journaliser_facture(f.id, 'clause', btrim(p_motif));
      v_id := f.id;
    ELSE
      RAISE EXCEPTION 'Facture brouillon ou emise requise (%)', f.statut USING ERRCODE = '22023';
    END IF;
  END IF;
  UPDATE public.calculs_clauses SET statut = 'applique', decide_par = auth.uid(), decide_le = now(),
    motif_decision = btrim(p_motif), facture_id = v_id
   WHERE id = k.id;
  INSERT INTO public.calculs_clauses_journal (calcul_id, evenement, facture_id, motif, par)
  VALUES (k.id, 'applique', v_id, btrim(p_motif), auth.uid());
  RETURN v_id;
END;
$$;

-- 3. Referentiels finance (administrateur) ------------------------------------

CREATE TABLE IF NOT EXISTS public.plan_comptable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE CHECK (btrim(numero) <> ''),
  libelle text NOT NULL CHECK (btrim(libelle) <> ''),
  actif boolean NOT NULL DEFAULT true,
  modifie_par uuid REFERENCES auth.users(id),
  modifie_le timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.natures_depense (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (btrim(code) <> ''),
  libelle text NOT NULL CHECK (btrim(libelle) <> ''),
  actif boolean NOT NULL DEFAULT true,
  modifie_par uuid REFERENCES auth.users(id),
  modifie_le timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cost_categories ADD COLUMN IF NOT EXISTS nature_depense_id uuid REFERENCES public.natures_depense(id);

CREATE TABLE IF NOT EXISTS public.comptes_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrat_id uuid REFERENCES public.contrats(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  -- NULL : rattachement retire (la ligne reste, aucune suppression).
  compte_id uuid REFERENCES public.plan_comptable(id),
  modifie_par uuid REFERENCES auth.users(id),
  modifie_le timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(contrat_id, supplier_id) = 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS comptes_tiers_contrat ON public.comptes_tiers (contrat_id) WHERE contrat_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS comptes_tiers_fournisseur ON public.comptes_tiers (supplier_id) WHERE supplier_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.definir_compte_comptable(p_numero text, p_libelle text, p_actif boolean DEFAULT true, p_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Plan de comptes : administrateur seulement' USING ERRCODE = '42501'; END IF;
  IF public.texte_ou_null(p_numero) IS NULL OR public.texte_ou_null(p_libelle) IS NULL THEN
    RAISE EXCEPTION 'Numero et libelle du compte requis' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.plan_comptable WHERE numero = btrim(p_numero) AND id IS DISTINCT FROM p_id) THEN
    RAISE EXCEPTION 'Compte % deja saisi', btrim(p_numero) USING ERRCODE = '22023';
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.plan_comptable (numero, libelle, actif, modifie_par) VALUES (btrim(p_numero), btrim(p_libelle), coalesce(p_actif, true), auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.plan_comptable SET numero = btrim(p_numero), libelle = btrim(p_libelle), actif = coalesce(p_actif, true),
      modifie_par = auth.uid(), modifie_le = now() WHERE id = p_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Compte introuvable' USING ERRCODE = '22023'; END IF;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.definir_nature_depense(p_code text, p_libelle text, p_actif boolean DEFAULT true, p_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Natures de depense : administrateur seulement' USING ERRCODE = '42501'; END IF;
  IF public.texte_ou_null(p_code) IS NULL OR public.texte_ou_null(p_libelle) IS NULL THEN
    RAISE EXCEPTION 'Code et libelle de la nature requis' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.natures_depense WHERE code = btrim(p_code) AND id IS DISTINCT FROM p_id) THEN
    RAISE EXCEPTION 'Nature % deja saisie', btrim(p_code) USING ERRCODE = '22023';
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.natures_depense (code, libelle, actif, modifie_par) VALUES (btrim(p_code), btrim(p_libelle), coalesce(p_actif, true), auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.natures_depense SET code = btrim(p_code), libelle = btrim(p_libelle), actif = coalesce(p_actif, true),
      modifie_par = auth.uid(), modifie_le = now() WHERE id = p_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Nature introuvable' USING ERRCODE = '22023'; END IF;
  END IF;
  RETURN v_id;
END;
$$;

-- p_nature NULL : la categorie n'est plus rattachee a une nature.
CREATE OR REPLACE FUNCTION public.associer_categorie_cout(p_categorie uuid, p_nature uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Rattachement des categories : administrateur seulement' USING ERRCODE = '42501'; END IF;
  IF p_nature IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.natures_depense WHERE id = p_nature AND actif) THEN
    RAISE EXCEPTION 'Nature inconnue ou inactive' USING ERRCODE = '22023';
  END IF;
  UPDATE public.cost_categories SET nature_depense_id = p_nature WHERE id = p_categorie;
  IF NOT FOUND THEN RAISE EXCEPTION 'Categorie de cout introuvable' USING ERRCODE = '22023'; END IF;
END;
$$;

-- Un tiers : contrat (client ou loueur) ou fournisseur. p_compte NULL retire
-- le rattachement (compte vide, ligne conservee).
CREATE OR REPLACE FUNCTION public.definir_compte_tiers(p_compte uuid, p_contrat uuid DEFAULT NULL, p_fournisseur uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Comptes de tiers : administrateur seulement' USING ERRCODE = '42501'; END IF;
  IF (p_contrat IS NULL) = (p_fournisseur IS NULL) THEN RAISE EXCEPTION 'Un tiers : contrat ou fournisseur' USING ERRCODE = '22023'; END IF;
  IF p_contrat IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.contrats WHERE id = p_contrat) THEN
    RAISE EXCEPTION 'Contrat introuvable' USING ERRCODE = '22023';
  END IF;
  IF p_fournisseur IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_fournisseur) THEN
    RAISE EXCEPTION 'Fournisseur introuvable' USING ERRCODE = '22023';
  END IF;
  IF p_compte IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.plan_comptable WHERE id = p_compte AND actif) THEN
    RAISE EXCEPTION 'Compte inconnu ou inactif' USING ERRCODE = '22023';
  END IF;
  -- Mise a jour en place sous verrou du tiers : aucune suppression.
  PERFORM pg_advisory_xact_lock(hashtext('sigtb.compte_tiers.' || coalesce(p_contrat::text, '') || coalesce(p_fournisseur::text, '')));
  UPDATE public.comptes_tiers SET compte_id = p_compte, modifie_par = auth.uid(), modifie_le = now()
   WHERE contrat_id IS NOT DISTINCT FROM p_contrat AND supplier_id IS NOT DISTINCT FROM p_fournisseur;
  IF NOT FOUND AND p_compte IS NOT NULL THEN
    INSERT INTO public.comptes_tiers (contrat_id, supplier_id, compte_id, modifie_par) VALUES (p_contrat, p_fournisseur, p_compte, auth.uid());
  END IF;
END;
$$;

-- 4. Imputations et budgets -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.imputations_budgetaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('cout', 'bon_commande', 'facture_loueur')),
  piece_id uuid NOT NULL,
  nature_id uuid NOT NULL REFERENCES public.natures_depense(id),
  remplace_id uuid REFERENCES public.imputations_budgetaires(id),
  motif text,
  par uuid REFERENCES auth.users(id),
  le timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (remplace_id IS NULL OR nullif(btrim(coalesce(motif, '')), '') IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_imputations_piece ON public.imputations_budgetaires (source, piece_id, le);

CREATE OR REPLACE VIEW public.v_imputations_courantes WITH (security_invoker = true) AS
SELECT i.* FROM public.imputations_budgetaires i
 WHERE NOT EXISTS (SELECT 1 FROM public.imputations_budgetaires r WHERE r.remplace_id = i.id);

CREATE OR REPLACE FUNCTION public.imputer_depense(p_source text, p_piece uuid, p_nature uuid, p_motif text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_prec public.imputations_budgetaires; v_site uuid; v_depot uuid; v_id uuid;
BEGIN
  IF p_source = 'cout' THEN
    IF NOT (public.has_module_write('costs') OR public.is_admin()) THEN RAISE EXCEPTION 'Droit d''ecriture sur les couts requis' USING ERRCODE = '42501'; END IF;
    SELECT c.site_id INTO v_site FROM public.costs c WHERE c.id = p_piece;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cout introuvable' USING ERRCODE = '22023'; END IF;
    IF NOT public.site_permis(v_site) THEN RAISE EXCEPTION 'Hors perimetre : cout d''un autre site' USING ERRCODE = '42501'; END IF;
  ELSIF p_source = 'bon_commande' THEN
    IF NOT (public.has_module_write('purchases') OR public.is_admin()) THEN RAISE EXCEPTION 'Droit d''ecriture sur les achats requis' USING ERRCODE = '42501'; END IF;
    SELECT b.warehouse_id INTO v_depot FROM public.purchase_orders b WHERE b.id = p_piece;
    IF NOT FOUND THEN RAISE EXCEPTION 'Bon de commande introuvable' USING ERRCODE = '22023'; END IF;
    IF NOT public.bon_commande_permis(v_depot) THEN RAISE EXCEPTION 'Hors perimetre : bon d''un autre site' USING ERRCODE = '42501'; END IF;
  ELSIF p_source = 'facture_loueur' THEN
    IF NOT (public.has_module_write('contracts') OR public.is_admin()) THEN RAISE EXCEPTION 'Droit d''ecriture sur les contrats requis' USING ERRCODE = '42501'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.factures_fournisseur f WHERE f.id = p_piece) THEN
      RAISE EXCEPTION 'Facture du loueur introuvable' USING ERRCODE = '22023';
    END IF;
  ELSE
    RAISE EXCEPTION 'Piece : cout, bon de commande ou facture du loueur' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.natures_depense WHERE id = p_nature AND actif) THEN
    RAISE EXCEPTION 'Nature de depense inconnue ou inactive' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('sigtb.imputation.' || p_source || p_piece::text));
  SELECT * INTO v_prec FROM public.v_imputations_courantes WHERE source = p_source AND piece_id = p_piece ORDER BY le DESC LIMIT 1;
  IF v_prec.id IS NOT NULL THEN
    IF v_prec.nature_id = p_nature THEN RAISE EXCEPTION 'Piece deja imputee a cette nature' USING ERRCODE = '22023'; END IF;
    IF public.texte_ou_null(p_motif) IS NULL THEN RAISE EXCEPTION 'Piece deja imputee : motif de la nouvelle imputation requis' USING ERRCODE = '22023'; END IF;
  END IF;
  INSERT INTO public.imputations_budgetaires (source, piece_id, nature_id, remplace_id, motif, par)
  VALUES (p_source, p_piece, p_nature, v_prec.id, public.texte_ou_null(p_motif), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE SEQUENCE IF NOT EXISTS public.budgets_numero_seq;
REVOKE ALL ON SEQUENCE public.budgets_numero_seq FROM PUBLIC, anon, authenticated;
GRANT ALL ON SEQUENCE public.budgets_numero_seq TO service_role;

CREATE TABLE IF NOT EXISTS public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  periode_debut date NOT NULL,
  periode_fin date NOT NULL,
  site_id uuid REFERENCES public.sites(id),
  nature_id uuid NOT NULL REFERENCES public.natures_depense(id),
  devise text NOT NULL CHECK (devise ~ '^[A-Z]{3}$'),
  -- Plafond de depense taxes comprises (TTC), dans la devise du budget.
  montant_ttc numeric(18,2) NOT NULL CHECK (montant_ttc > 0),
  note text,
  remplace_id uuid REFERENCES public.budgets(id),
  motif_revision text,
  statut text NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'annule')),
  annule_par uuid REFERENCES auth.users(id),
  annule_le timestamptz,
  motif_annulation text,
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (periode_fin >= periode_debut),
  CHECK (remplace_id IS NULL OR nullif(btrim(coalesce(motif_revision, '')), '') IS NOT NULL),
  CHECK (statut <> 'annule' OR nullif(btrim(coalesce(motif_annulation, '')), '') IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_budgets_cle ON public.budgets (nature_id, site_id, devise, periode_debut);

-- Un budget ne change plus, sauf son annulation motivee.
CREATE OR REPLACE FUNCTION public.garde_budget()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN coalesce(NEW, OLD); END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Un budget ne se supprime pas : annulez-le avec un motif' USING ERRCODE = '42501'; END IF;
  IF OLD.statut <> 'actif' OR NEW.statut <> 'annule'
     OR (to_jsonb(NEW) - ARRAY['statut', 'annule_par', 'annule_le', 'motif_annulation'])
        IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['statut', 'annule_par', 'annule_le', 'motif_annulation']) THEN
    RAISE EXCEPTION 'Budget fige : reviser par un nouveau budget motive ou annuler' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS garde_budget ON public.budgets;
CREATE TRIGGER garde_budget BEFORE UPDATE OR DELETE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.garde_budget();

CREATE OR REPLACE VIEW public.v_budgets_courants WITH (security_invoker = true) AS
SELECT b.* FROM public.budgets b
 WHERE b.statut = 'actif' AND NOT EXISTS (SELECT 1 FROM public.budgets r WHERE r.remplace_id = b.id AND r.statut = 'actif');

CREATE OR REPLACE FUNCTION public.definir_budget(
  p_debut date, p_fin date, p_nature uuid, p_devise text, p_montant numeric,
  p_site uuid DEFAULT NULL, p_note text DEFAULT NULL, p_remplace uuid DEFAULT NULL, p_motif text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_devise text := upper(btrim(coalesce(p_devise, ''))); v_prec public.budgets; v_conflit text; v_id uuid;
BEGIN
  IF NOT (public.has_module_write('costs') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les couts requis' USING ERRCODE = '42501';
  END IF;
  IF p_debut IS NULL OR p_fin IS NULL OR p_fin < p_debut THEN RAISE EXCEPTION 'Periode du budget invalide' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.natures_depense WHERE id = p_nature AND actif) THEN
    RAISE EXCEPTION 'Nature de depense inconnue ou inactive (referentiel administrateur)' USING ERRCODE = '22023';
  END IF;
  IF v_devise !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Devise requise (code a trois lettres)' USING ERRCODE = '22023'; END IF;
  IF p_montant IS NULL OR p_montant <= 0 OR p_montant <> round(p_montant, 2) THEN
    RAISE EXCEPTION 'Montant TTC du budget positif requis (deux decimales au plus)' USING ERRCODE = '22023';
  END IF;
  IF p_site IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.sites WHERE id = p_site) THEN RAISE EXCEPTION 'Site inconnu' USING ERRCODE = '22023'; END IF;
  IF NOT public.site_permis(p_site) THEN
    RAISE EXCEPTION 'Hors perimetre : site non autorise (un budget sans site exige un profil global)' USING ERRCODE = '42501';
  END IF;
  IF p_remplace IS NOT NULL THEN
    SELECT * INTO v_prec FROM public.budgets WHERE id = p_remplace FOR UPDATE;
    IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.v_budgets_courants WHERE id = p_remplace) THEN
      RAISE EXCEPTION 'Budget a reviser introuvable, annule ou deja revise' USING ERRCODE = '22023';
    END IF;
    IF NOT public.site_permis(v_prec.site_id) THEN RAISE EXCEPTION 'Hors perimetre : budget d''un autre site' USING ERRCODE = '42501'; END IF;
    IF public.texte_ou_null(p_motif) IS NULL THEN RAISE EXCEPTION 'Motif de la revision requis' USING ERRCODE = '22023'; END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('sigtb.budget.' || p_nature::text || coalesce(p_site::text, '') || v_devise));
  SELECT b.numero INTO v_conflit FROM public.v_budgets_courants b
   WHERE b.nature_id = p_nature AND b.site_id IS NOT DISTINCT FROM p_site AND b.devise = v_devise
     AND b.periode_debut <= p_fin AND b.periode_fin >= p_debut AND b.id IS DISTINCT FROM p_remplace
   LIMIT 1;
  IF v_conflit IS NOT NULL THEN
    RAISE EXCEPTION 'Le budget % couvre deja cette nature, ce centre et cette periode : le reviser', v_conflit USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.budgets (numero, periode_debut, periode_fin, site_id, nature_id, devise, montant_ttc, note, remplace_id, motif_revision, cree_par)
  VALUES ('BUD-' || to_char(p_debut, 'YYYY') || '-' || lpad(nextval('public.budgets_numero_seq')::text, 5, '0'),
          p_debut, p_fin, p_site, p_nature, v_devise, p_montant, public.texte_ou_null(p_note), p_remplace,
          CASE WHEN p_remplace IS NOT NULL THEN btrim(p_motif) END, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.annuler_budget(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE b public.budgets;
BEGIN
  IF NOT (public.has_module_write('costs') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les couts requis' USING ERRCODE = '42501';
  END IF;
  IF public.texte_ou_null(p_motif) IS NULL THEN RAISE EXCEPTION 'Motif de l''annulation requis' USING ERRCODE = '22023'; END IF;
  SELECT * INTO b FROM public.budgets WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.v_budgets_courants WHERE id = p_id) THEN
    RAISE EXCEPTION 'Budget courant introuvable' USING ERRCODE = '22023';
  END IF;
  IF NOT public.site_permis(b.site_id) THEN RAISE EXCEPTION 'Hors perimetre : budget d''un autre site' USING ERRCODE = '42501'; END IF;
  UPDATE public.budgets SET statut = 'annule', annule_par = auth.uid(), annule_le = now(), motif_annulation = btrim(p_motif) WHERE id = p_id;
END;
$$;

-- Depenses rattachables a un budget, lues avec les droits du lecteur
-- (RLS des pieces, droit de `reste_a_payer`). Chaque piece compte une seule
-- fois, `base_montant` dit ce que porte le montant :
--  - engage, bon approuve ou recu en partie : commande HT + taxes du bon
--    (TTC ; devise GNF, convention de `reste_a_payer` D-055, les bons ne
--    portant pas de devise) ;
--  - engage, piece payable non entierement payee (bon recu ou solde,
--    facture du loueur controlee) : base moins paye de `v_reste_a_payer`
--    (TTC, ou HT si la facture du loueur n'a pas de TTC saisi ; les
--    paiements proposes ou approuves y restent inclus) ;
--  - realise : paiements executes (montant verse) et couts enregistres
--    (D-058, montant saisi tel quel).
-- Nature : derniere imputation de la piece, sinon (couts) nature de la
-- categorie ; sans nature, la depense n'est rattachee a aucun budget.
CREATE OR REPLACE VIEW public.v_depenses_budgetaires WITH (security_invoker = true) AS
SELECT 'engage'::text AS categorie, 'bon_commande'::text AS origine, po.id AS piece_id, po.po_number::text AS piece,
       po.po_date AS date_operation, w.site_id, im.nature_id, 'GNF'::text AS devise,
       (coalesce(sum(li.quantity * li.unit_price), 0) + coalesce(po.tax_amount, 0))::numeric(18,2) AS montant,
       'TTC (commande HT + taxes du bon)'::text AS base_montant, s.company_name::text AS tiers,
       'bon_commande'::text AS source_imputation, po.id AS piece_imputee
  FROM public.purchase_orders po
  JOIN public.purchase_order_items li ON li.purchase_order_id = po.id
  LEFT JOIN public.warehouses w ON w.id = po.warehouse_id
  LEFT JOIN public.suppliers s ON s.id = po.supplier_id
  LEFT JOIN public.v_imputations_courantes im ON im.source = 'bon_commande' AND im.piece_id = po.id
 WHERE po.status IN ('approved', 'partially_received')
 GROUP BY po.id, po.po_number, po.po_date, po.tax_amount, w.site_id, im.nature_id, s.company_name
HAVING coalesce(sum(li.quantity * li.unit_price), 0) + coalesce(po.tax_amount, 0) > 0
UNION ALL
SELECT 'engage', 'a_payer', r.piece_id, r.piece::text, r.date_piece, w.site_id, im.nature_id, r.devise,
       (r.base - r.paye)::numeric(18,2),
       CASE WHEN r.source = 'facture_loueur' AND ff.montant_ttc_facture IS NULL THEN 'HT (TTC du loueur non saisi), reste a payer'
            ELSE 'TTC, reste a payer' END,
       r.beneficiaire, r.source, r.piece_id
  FROM public.v_reste_a_payer r
  LEFT JOIN public.purchase_orders po ON r.source = 'bon_commande' AND po.id = r.piece_id
  LEFT JOIN public.warehouses w ON w.id = po.warehouse_id
  LEFT JOIN public.factures_fournisseur ff ON r.source = 'facture_loueur' AND ff.id = r.piece_id
  LEFT JOIN public.v_imputations_courantes im ON im.source = r.source AND im.piece_id = r.piece_id
 WHERE r.base - r.paye > 0
UNION ALL
SELECT 'realise', 'paiement', p.id, p.numero, p.execute_le, w.site_id, im.nature_id, p.devise, p.montant_execute::numeric(18,2),
       'Montant verse', p.beneficiaire,
       CASE WHEN p.facture_fournisseur_id IS NOT NULL THEN 'facture_loueur' ELSE 'bon_commande' END,
       coalesce(p.facture_fournisseur_id, p.purchase_order_id)
  FROM public.paiements_fournisseur p
  LEFT JOIN public.purchase_orders po ON po.id = p.purchase_order_id
  LEFT JOIN public.warehouses w ON w.id = po.warehouse_id
  LEFT JOIN public.v_imputations_courantes im
         ON (im.source = 'bon_commande' AND im.piece_id = p.purchase_order_id)
         OR (im.source = 'facture_loueur' AND im.piece_id = p.facture_fournisseur_id)
 WHERE p.statut = 'execute' AND (p.purchase_order_id IS NULL OR po.id IS NOT NULL)
UNION ALL
SELECT 'realise', 'cout', c.id, c.numero, c.date, c.site_id, coalesce(im.nature_id, cc.nature_depense_id), c.devise,
       c.amount::numeric(18,2), 'Montant saisi (cout D-058)', NULL::text, 'cout', c.id
  FROM public.costs c
  LEFT JOIN public.cost_categories cc ON cc.id = c.category_id
  LEFT JOIN public.v_imputations_courantes im ON im.source = 'cout' AND im.piece_id = c.id
 WHERE c.statut = 'enregistre';

CREATE OR REPLACE VIEW public.v_suivi_budgets WITH (security_invoker = true) AS
WITH s AS (
  SELECT b.id,
         coalesce(sum(d.montant) FILTER (WHERE d.categorie = 'engage' AND d.origine = 'bon_commande'), 0) AS engage_bons,
         coalesce(sum(d.montant) FILTER (WHERE d.categorie = 'engage' AND d.origine = 'a_payer'), 0) AS engage_a_payer,
         coalesce(sum(d.montant) FILTER (WHERE d.categorie = 'realise' AND d.origine = 'cout'), 0) AS realise_couts,
         coalesce(sum(d.montant) FILTER (WHERE d.categorie = 'realise' AND d.origine = 'paiement'), 0) AS realise_paiements
    FROM public.v_budgets_courants b
    LEFT JOIN public.v_depenses_budgetaires d
           ON d.nature_id = b.nature_id AND d.devise = b.devise AND d.site_id IS NOT DISTINCT FROM b.site_id
          AND d.date_operation BETWEEN b.periode_debut AND b.periode_fin
   GROUP BY b.id
)
SELECT b.id, b.numero, b.periode_debut, b.periode_fin, b.site_id, si.name AS site, b.nature_id, n.code AS nature_code, n.libelle AS nature,
       b.devise, b.montant_ttc, b.note, b.cree_le,
       s.engage_bons, s.engage_a_payer, s.engage_bons + s.engage_a_payer AS engage,
       s.realise_couts, s.realise_paiements, s.realise_couts + s.realise_paiements AS realise,
       b.montant_ttc - (s.engage_bons + s.engage_a_payer + s.realise_couts + s.realise_paiements) AS disponible,
       round((s.engage_bons + s.engage_a_payer + s.realise_couts + s.realise_paiements) / b.montant_ttc * 100, 1) AS consommation_pct,
       (s.engage_bons + s.engage_a_payer + s.realise_couts + s.realise_paiements) > b.montant_ttc AS depassement,
       nullif(array_to_string(array_remove(ARRAY[
         CASE WHEN NOT (public.has_module_view('purchases') OR public.has_module_view('stock') OR public.is_admin()) THEN 'bons de commande' END,
         CASE WHEN NOT (public.has_module_view('invoices') OR public.has_module_view('contracts') OR public.is_admin()) THEN 'pièces à payer et paiements' END,
         CASE WHEN NOT (public.has_module_view('costs') OR public.has_module_view('reports') OR public.is_admin()) THEN 'coûts' END
       ], NULL), ', '), '') AS sources_non_visibles
  FROM public.v_budgets_courants b
  JOIN s ON s.id = b.id
  JOIN public.natures_depense n ON n.id = b.nature_id
  LEFT JOIN public.sites si ON si.id = b.site_id;

-- Dettes : montants dus aux fournisseurs (factures du loueur controlees,
-- bons recus ou soldes), depuis le reste a payer D-055.
CREATE OR REPLACE VIEW public.v_dettes_fournisseurs WITH (security_invoker = true) AS
SELECT r.source, r.piece_id, r.piece, r.date_piece, r.beneficiaire, r.devise, r.base, r.paye,
       r.base - r.paye AS du, r.engage AS paiements_en_cours, r.reste AS reste_a_proposer,
       current_date - r.date_piece AS anciennete_jours
  FROM public.v_reste_a_payer r
 WHERE r.base - r.paye > 0;

-- 5. Export comptable -----------------------------------------------------------

-- Ecritures de gestion d'une periode, avec les droits du lecteur. Compte de
-- tiers : referentiel administrateur, NULL si non parametre.
CREATE OR REPLACE FUNCTION public.ecritures_gestion(p_du date, p_au date)
RETURNS TABLE (type_ecriture text, date_ecriture date, piece text, piece_liee text, tiers text, compte_tiers text, libelle text,
               montant_ht numeric, montant_taxe numeric, montant numeric, devise text, sens text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH comptes AS (
    SELECT t.contrat_id, t.supplier_id, pc.numero FROM public.comptes_tiers t JOIN public.plan_comptable pc ON pc.id = t.compte_id
  )
  SELECT x.* FROM (
    SELECT CASE f.type WHEN 'avoir' THEN 'avoir_emis' ELSE 'facture_emise' END, f.date_emission, f.numero, o.numero,
           c.contrepartie, ct.numero, f.objet, abs(f.montant_ht), abs(f.montant_taxe), abs(f.montant_ttc), f.devise,
           CASE f.type WHEN 'avoir' THEN 'a_deduire' ELSE 'a_recevoir' END
      FROM public.factures f
      JOIN public.contrats c ON c.id = f.contrat_id
      LEFT JOIN public.factures o ON o.id = f.facture_origine_id
      LEFT JOIN comptes ct ON ct.contrat_id = f.contrat_id
     WHERE f.statut = 'emise' AND f.date_emission BETWEEN p_du AND p_au
    UNION ALL
    SELECT 'encaissement', e.date_encaissement, e.reference, f.numero, c.contrepartie, ct.numero,
           'Encaissement (' || e.mode || ')', NULL::numeric, NULL::numeric, e.montant, f.devise, 'recu'
      FROM public.encaissements e
      JOIN public.factures f ON f.id = e.facture_id
      JOIN public.contrats c ON c.id = f.contrat_id
      LEFT JOIN comptes ct ON ct.contrat_id = f.contrat_id
     WHERE e.date_encaissement BETWEEN p_du AND p_au
    UNION ALL
    SELECT 'paiement_execute', p.execute_le, p.numero, p.reference_execution, p.beneficiaire,
           coalesce(cf.numero, cb.numero), p.objet, NULL, NULL, p.montant_execute, p.devise, 'verse'
      FROM public.paiements_fournisseur p
      LEFT JOIN public.factures_fournisseur ff ON ff.id = p.facture_fournisseur_id
      LEFT JOIN public.purchase_orders po ON po.id = p.purchase_order_id
      LEFT JOIN comptes cf ON cf.contrat_id = ff.contrat_id
      LEFT JOIN comptes cb ON cb.supplier_id = po.supplier_id
     WHERE p.statut = 'execute' AND p.execute_le BETWEEN p_du AND p_au
    UNION ALL
    SELECT 'cout', c.date, c.numero, c.reference, NULL, NULL, c.description, NULL, NULL, c.amount, c.devise, 'depense'
      FROM public.costs c
     WHERE c.statut = 'enregistre' AND c.date BETWEEN p_du AND p_au
  ) AS x(type_ecriture, date_ecriture, piece, piece_liee, tiers, compte_tiers, libelle, montant_ht, montant_taxe, montant, devise, sens)
  ORDER BY x.date_ecriture, x.type_ecriture, x.piece;
$$;

-- 6. Evaluation periodique du loueur (grille D-059 reutilisee) ------------------

ALTER TABLE public.criteres_evaluation_fournisseur ADD COLUMN IF NOT EXISTS grille text NOT NULL DEFAULT 'fournisseur';
ALTER TABLE public.criteres_evaluation_fournisseur ADD COLUMN IF NOT EXISTS indicateur text;
ALTER TABLE public.evaluations_fournisseurs ALTER COLUMN supplier_id DROP NOT NULL;
ALTER TABLE public.evaluations_fournisseurs ADD COLUMN IF NOT EXISTS contrat_id uuid REFERENCES public.contrats(id);
ALTER TABLE public.evaluations_fournisseurs ADD COLUMN IF NOT EXISTS mesures jsonb;
ALTER TABLE public.evaluations_fournisseurs_notes ADD COLUMN IF NOT EXISTS indicateur text;
ALTER TABLE public.evaluations_fournisseurs_notes ADD COLUMN IF NOT EXISTS valeur_mesuree numeric;
CREATE INDEX IF NOT EXISTS idx_evaluations_fournisseurs_contrat ON public.evaluations_fournisseurs (contrat_id, periode_fin);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'criteres_evaluation_grille') THEN
    ALTER TABLE public.criteres_evaluation_fournisseur ADD CONSTRAINT criteres_evaluation_grille CHECK (grille IN ('fournisseur', 'loueur'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'criteres_evaluation_indicateur') THEN
    ALTER TABLE public.criteres_evaluation_fournisseur ADD CONSTRAINT criteres_evaluation_indicateur CHECK (
      indicateur IS NULL OR (grille = 'loueur' AND indicateur IN ('disponibilite', 'delai_prise_en_charge', 'interventions_hors_delai', 'ecart_facture')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evaluations_fournisseurs_objet') THEN
    ALTER TABLE public.evaluations_fournisseurs ADD CONSTRAINT evaluations_fournisseurs_objet CHECK (num_nonnulls(supplier_id, contrat_id) = 1);
  END IF;
END $$;

DROP POLICY IF EXISTS lecture_loueur ON public.evaluations_fournisseurs;
CREATE POLICY lecture_loueur ON public.evaluations_fournisseurs FOR SELECT TO authenticated
  USING (contrat_id IS NOT NULL AND (public.has_module_view('contracts') OR public.is_admin()));
DROP POLICY IF EXISTS lecture_loueur ON public.criteres_evaluation_fournisseur;
CREATE POLICY lecture_loueur ON public.criteres_evaluation_fournisseur FOR SELECT TO authenticated
  USING (grille = 'loueur' AND (public.has_module_view('contracts') OR public.is_admin()));

-- Indicateurs mesures du loueur sur une periode (engins rattaches au contrat,
-- D-062). Valeur NULL = sans donnees, jamais estimee.
CREATE OR REPLACE FUNCTION public.mesures_loueur(p_contrat uuid, p_du date, p_au date)
RETURNS TABLE (indicateur text, libelle text, valeur numeric, unite text, echantillon integer, source text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH engins AS (SELECT v.id FROM public.vehicles v WHERE v.contrat_id = p_contrat),
  fiab AS (SELECT f.* FROM public.fiabilite_engins(p_du::timestamptz, (p_au + 1)::timestamptz) f WHERE f.vehicle_id IN (SELECT id FROM engins)),
  inter AS (SELECT i.* FROM public.v_interventions_loueur i
             WHERE i.vehicle_id IN (SELECT id FROM engins) AND i.demande_le >= p_du::timestamptz AND i.demande_le < (p_au + 1)::timestamptz),
  fact AS (SELECT f.* FROM public.factures_fournisseur f
            WHERE f.contrat_id = p_contrat AND f.statut <> 'saisie' AND f.periode_debut <= p_au AND f.periode_fin >= p_du)
  SELECT 'disponibilite', 'Disponibilité des engins', (SELECT round(avg(disponibilite_pct), 1) FROM fiab WHERE disponibilite_pct IS NOT NULL), '%',
         (SELECT count(*)::integer FROM fiab WHERE disponibilite_pct IS NOT NULL), 'immobilisations des engins du contrat (D-025)'
  UNION ALL
  SELECT 'delai_prise_en_charge', 'Délai moyen de prise en charge', (SELECT round(avg(delai_heures), 1) FROM inter WHERE prise_en_charge_le IS NOT NULL), 'h',
         (SELECT count(*)::integer FROM inter WHERE prise_en_charge_le IS NOT NULL), 'interventions du loueur (D-049)'
  UNION ALL
  SELECT 'interventions_hors_delai', 'Interventions hors délai contractuel',
         (SELECT round(100.0 * count(*) FILTER (WHERE en_retard) / nullif(count(*), 0), 1) FROM inter WHERE en_retard IS NOT NULL), '%',
         (SELECT count(*)::integer FROM inter WHERE en_retard IS NOT NULL), 'interventions avec délai contractuel saisi (D-049)'
  UNION ALL
  SELECT 'ecart_facture', 'Écart des factures contrôlées',
         (SELECT round(100 * sum(ecart_total) / nullif(sum(montant_ht_facture), 0), 2) FROM fact WHERE ecart_total IS NOT NULL), '%',
         (SELECT count(*)::integer FROM fact WHERE ecart_total IS NOT NULL), 'contrôle des factures du loueur (D-032)';
$$;

CREATE OR REPLACE FUNCTION public.definir_critere_loueur(
  p_libelle text, p_poids integer, p_indicateur text DEFAULT NULL, p_description text DEFAULT NULL,
  p_ordre integer DEFAULT 0, p_actif boolean DEFAULT true, p_id uuid DEFAULT NULL
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
  IF p_indicateur IS NOT NULL AND p_indicateur NOT IN ('disponibilite', 'delai_prise_en_charge', 'interventions_hors_delai', 'ecart_facture') THEN
    RAISE EXCEPTION 'Indicateur mesure inconnu' USING ERRCODE = '22023';
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.criteres_evaluation_fournisseur (libelle, description, poids, ordre, actif, cree_par, grille, indicateur)
    VALUES (btrim(p_libelle), public.texte_ou_null(p_description), p_poids, coalesce(p_ordre, 0), coalesce(p_actif, true), auth.uid(),
            'loueur', p_indicateur)
    RETURNING id INTO v_id;
  ELSE
    -- Les evaluations passees gardent le libelle, le poids et la mesure figes.
    UPDATE public.criteres_evaluation_fournisseur SET libelle = btrim(p_libelle), description = public.texte_ou_null(p_description),
      poids = p_poids, ordre = coalesce(p_ordre, 0), actif = coalesce(p_actif, true), indicateur = p_indicateur
     WHERE id = p_id AND grille = 'loueur' RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Critere de la grille du loueur introuvable' USING ERRCODE = '22023'; END IF;
  END IF;
  RETURN v_id;
END;
$$;

-- La grille fournisseurs (D-059) ne lit plus les criteres du loueur.
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
  IF NOT EXISTS (SELECT 1 FROM public.criteres_evaluation_fournisseur WHERE actif AND grille = 'fournisseur') THEN
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
  FOR n IN SELECT * FROM jsonb_array_elements(p_notes) LOOP
    SELECT * INTO cr FROM public.criteres_evaluation_fournisseur
     WHERE id = nullif(n ->> 'critere', '')::uuid AND actif AND grille = 'fournisseur';
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
  IF EXISTS (SELECT 1 FROM public.criteres_evaluation_fournisseur c WHERE c.actif AND c.grille = 'fournisseur' AND NOT (c.id = ANY (v_vus))) THEN
    RAISE EXCEPTION 'Chaque critere actif doit etre note' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.evaluations_fournisseurs (supplier_id, periode_debut, periode_fin, note_globale, commentaire, remplace_id, motif_correction, evalue_par)
  VALUES (p_fournisseur, p_debut, p_fin, round(v_somme::numeric / v_poids, 2), public.texte_ou_null(p_commentaire), v_prec,
          CASE WHEN v_prec IS NOT NULL THEN btrim(p_motif_correction) END, auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO public.evaluations_fournisseurs_notes (evaluation_id, critere_id, libelle, poids, note, observation)
  SELECT v_id, c.id, c.libelle, c.poids, (x.e ->> 'note')::integer, public.texte_ou_null(x.e ->> 'observation')
    FROM jsonb_array_elements(p_notes) AS x(e)
    JOIN public.criteres_evaluation_fournisseur c ON c.id = (x.e ->> 'critere')::uuid;
  PERFORM public.journaliser_fournisseur(p_fournisseur, 'evaluation', p_motif_correction,
    jsonb_build_object('evaluation', v_id, 'debut', p_debut, 'fin', p_fin, 'note_globale', round(v_somme::numeric / v_poids, 2), 'remplace', v_prec));
  RETURN v_id;
END;
$$;

-- Grille fournisseurs (D-059, derniere definition `20261118120000`, non
-- modifiee par D-072) : reprise a l'identique, une modification ne touche
-- plus un critere de la grille du loueur (definir_critere_loueur).
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
    INSERT INTO public.criteres_evaluation_fournisseur (libelle, description, poids, ordre, actif, cree_par, grille)
    VALUES (btrim(p_libelle), public.texte_ou_null(p_description), p_poids, coalesce(p_ordre, 0), coalesce(p_actif, true), auth.uid(), 'fournisseur')
    RETURNING id INTO v_id;
  ELSE
    -- Les evaluations passees gardent le libelle et le poids figes.
    UPDATE public.criteres_evaluation_fournisseur SET libelle = btrim(p_libelle), description = public.texte_ou_null(p_description),
      poids = p_poids, ordre = coalesce(p_ordre, 0), actif = coalesce(p_actif, true)
     WHERE id = p_id AND grille = 'fournisseur' RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Critere introuvable' USING ERRCODE = '22023'; END IF;
  END IF;
  RETURN v_id;
END;
$$;

-- Evaluations courantes des fournisseurs (D-059) : celles du loueur
-- (contrat_id, D-065) ont leur propre vue.
CREATE OR REPLACE VIEW public.v_evaluations_fournisseurs_courantes WITH (security_invoker = true) AS
SELECT e.*
  FROM public.evaluations_fournisseurs e
 WHERE e.supplier_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.evaluations_fournisseurs r WHERE r.remplace_id = e.id);
REVOKE ALL ON public.v_evaluations_fournisseurs_courantes FROM anon;
GRANT SELECT ON public.v_evaluations_fournisseurs_courantes TO authenticated;

-- Evaluation du loueur : notes de 1 a 5 saisies par critere (aucune
-- conversion automatique d'une mesure en note), mesures de la periode figees
-- avec l'evaluation ; append-only, correction motivee qui remplace.
CREATE OR REPLACE FUNCTION public.evaluer_loueur(
  p_contrat uuid, p_debut date, p_fin date, p_notes jsonb, p_commentaire text DEFAULT NULL, p_motif_correction text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE c public.contrats; v_id uuid; v_prec uuid; n jsonb; cr public.criteres_evaluation_fournisseur; v_note integer;
        v_somme bigint := 0; v_poids bigint := 0; v_vus uuid[] := '{}'; v_mesures jsonb;
BEGIN
  IF NOT (public.has_module_write('contracts') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les contrats requis' USING ERRCODE = '42501';
  END IF;
  -- Mesures figees sur tous les sites du contrat : profil global requis.
  IF NOT public.site_permis(NULL) THEN
    RAISE EXCEPTION 'Evaluation du loueur : profil global requis (mesures de tous les sites)' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO c FROM public.contrats WHERE id = p_contrat FOR UPDATE;
  IF NOT FOUND OR c.nature <> 'location' THEN RAISE EXCEPTION 'Contrat de location requis' USING ERRCODE = '22023'; END IF;
  IF p_debut IS NULL OR p_fin IS NULL OR p_fin < p_debut THEN RAISE EXCEPTION 'Periode evaluee invalide' USING ERRCODE = '22023'; END IF;
  IF p_fin > current_date THEN RAISE EXCEPTION 'Une periode future ne s''evalue pas' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.criteres_evaluation_fournisseur WHERE actif AND grille = 'loueur') THEN
    RAISE EXCEPTION 'Aucun critere actif dans la grille du loueur : grille a definir par l''administrateur' USING ERRCODE = '22023';
  END IF;
  IF p_notes IS NULL OR jsonb_typeof(p_notes) <> 'array' THEN RAISE EXCEPTION 'Notes requises' USING ERRCODE = '22023'; END IF;
  SELECT e.id INTO v_prec FROM public.evaluations_fournisseurs e
   WHERE e.contrat_id = p_contrat AND e.periode_debut = p_debut AND e.periode_fin = p_fin
     AND NOT EXISTS (SELECT 1 FROM public.evaluations_fournisseurs r WHERE r.remplace_id = e.id)
   ORDER BY e.evalue_le DESC LIMIT 1;
  IF v_prec IS NOT NULL AND public.texte_ou_null(p_motif_correction) IS NULL THEN
    RAISE EXCEPTION 'Periode deja evaluee : motif de correction requis' USING ERRCODE = '22023';
  END IF;
  FOR n IN SELECT * FROM jsonb_array_elements(p_notes) LOOP
    SELECT * INTO cr FROM public.criteres_evaluation_fournisseur
     WHERE id = CASE WHEN (n ->> 'critere') ~ '^[0-9a-fA-F-]{36}$' THEN (n ->> 'critere')::uuid END AND actif AND grille = 'loueur';
    IF NOT FOUND THEN RAISE EXCEPTION 'Critere inconnu ou inactif dans la grille du loueur' USING ERRCODE = '22023'; END IF;
    IF cr.id = ANY (v_vus) THEN RAISE EXCEPTION 'Critere « % » note deux fois', cr.libelle USING ERRCODE = '22023'; END IF;
    v_note := CASE WHEN (n ->> 'note') ~ '^[0-9]+$' THEN (n ->> 'note')::integer END;
    IF v_note IS NULL OR v_note < 1 OR v_note > 5 THEN
      RAISE EXCEPTION 'Critere « % » : note de 1 a 5 requise', cr.libelle USING ERRCODE = '22023';
    END IF;
    v_vus := v_vus || cr.id;
    v_somme := v_somme + v_note * cr.poids;
    v_poids := v_poids + cr.poids;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.criteres_evaluation_fournisseur k WHERE k.actif AND k.grille = 'loueur' AND NOT (k.id = ANY (v_vus))) THEN
    RAISE EXCEPTION 'Chaque critere actif doit etre note' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) INTO v_mesures FROM public.mesures_loueur(p_contrat, p_debut, p_fin) m;
  INSERT INTO public.evaluations_fournisseurs (supplier_id, contrat_id, periode_debut, periode_fin, note_globale, commentaire, remplace_id,
    motif_correction, evalue_par, mesures)
  VALUES (NULL, p_contrat, p_debut, p_fin, round(v_somme::numeric / v_poids, 2), public.texte_ou_null(p_commentaire), v_prec,
          CASE WHEN v_prec IS NOT NULL THEN btrim(p_motif_correction) END, auth.uid(), v_mesures)
  RETURNING id INTO v_id;
  INSERT INTO public.evaluations_fournisseurs_notes (evaluation_id, critere_id, libelle, poids, note, observation, indicateur, valeur_mesuree)
  SELECT v_id, k.id, k.libelle, k.poids, (x.e ->> 'note')::integer, public.texte_ou_null(x.e ->> 'observation'), k.indicateur,
         (SELECT (m ->> 'valeur')::numeric FROM jsonb_array_elements(v_mesures) m WHERE m ->> 'indicateur' = k.indicateur LIMIT 1)
    FROM jsonb_array_elements(p_notes) AS x(e)
    JOIN public.criteres_evaluation_fournisseur k ON k.id = (x.e ->> 'critere')::uuid;
  INSERT INTO public.journal_contrats (table_cible, ligne_id, contrat_id, action, avant, apres, auteur)
  VALUES ('evaluations_fournisseurs', v_id, p_contrat, 'INSERT', NULL,
          jsonb_build_object('debut', p_debut, 'fin', p_fin, 'note_globale', round(v_somme::numeric / v_poids, 2), 'remplace', v_prec,
                             'motif_correction', public.texte_ou_null(p_motif_correction)), auth.uid());
  RETURN v_id;
END;
$$;

CREATE OR REPLACE VIEW public.v_evaluations_loueur_courantes WITH (security_invoker = true) AS
SELECT e.id, e.contrat_id, e.periode_debut, e.periode_fin, e.note_globale, e.commentaire, e.remplace_id, e.motif_correction,
       e.evalue_par, e.evalue_le, e.mesures
  FROM public.evaluations_fournisseurs e
 WHERE e.contrat_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.evaluations_fournisseurs r WHERE r.remplace_id = e.id);

-- 7. Droits : lecture selon les modules, ecriture par fonctions seulement ------

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['contrats_echeances', 'contrat_clauses', 'calculs_clauses', 'plan_comptable', 'natures_depense',
                           'comptes_tiers', 'imputations_budgetaires', 'budgets', 'calculs_clauses_journal'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS lecture ON public.%I', t);
  END LOOP;
END $$;

CREATE POLICY lecture ON public.contrats_echeances FOR SELECT TO authenticated
  USING (public.has_module_view('contracts') OR public.is_admin());
CREATE POLICY lecture ON public.contrat_clauses FOR SELECT TO authenticated
  USING (public.has_module_view('contracts') OR public.is_admin());
CREATE POLICY lecture ON public.calculs_clauses FOR SELECT TO authenticated
  USING (public.has_module_view('contracts') OR public.has_module_view('invoices') OR public.is_admin());
CREATE POLICY lecture ON public.calculs_clauses_journal FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.calculs_clauses k WHERE k.id = calcul_id));
CREATE POLICY lecture ON public.plan_comptable FOR SELECT TO authenticated
  USING (public.has_module_view('invoices') OR public.has_module_view('costs') OR public.has_module_view('contracts') OR public.is_admin());
CREATE POLICY lecture ON public.natures_depense FOR SELECT TO authenticated
  USING (public.has_module_view('costs') OR public.has_module_view('purchases') OR public.has_module_view('invoices')
         OR public.has_module_view('contracts') OR public.is_admin());
CREATE POLICY lecture ON public.comptes_tiers FOR SELECT TO authenticated
  USING (public.has_module_view('invoices') OR public.has_module_view('costs') OR public.has_module_view('contracts') OR public.is_admin());
CREATE POLICY lecture ON public.imputations_budgetaires FOR SELECT TO authenticated
  USING (public.has_module_view('costs') OR public.has_module_view('purchases') OR public.has_module_view('invoices')
         OR public.has_module_view('contracts') OR public.is_admin());
CREATE POLICY lecture ON public.budgets FOR SELECT TO authenticated
  USING ((public.has_module_view('costs') OR public.has_module_view('reports') OR public.has_module_view('invoices') OR public.is_admin())
         AND public.site_permis(site_id));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['contrats_echeances', 'imputations_budgetaires', 'calculs_clauses_journal'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS garde_append_only ON public.%I', t);
    EXECUTE format('CREATE TRIGGER garde_append_only BEFORE UPDATE OR DELETE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.garde_append_only_finance()', t);
  END LOOP;
END $$;

DO $$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY['v_echeances_contrats', 'v_imputations_courantes', 'v_budgets_courants', 'v_depenses_budgetaires',
                           'v_suivi_budgets', 'v_dettes_fournisseurs', 'v_evaluations_loueur_courantes'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', v);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', v);
  END LOOP;
END $$;

DO $$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY[
    'enregistrer_echeance_contrat(uuid, text, date, text, date, text)',
    'definir_clause(uuid, text, text, uuid, text, text, numeric, numeric, text, integer, uuid)',
    'desactiver_clause(uuid, text)',
    'calculer_clauses(uuid)',
    'decider_clause(uuid, boolean, text, uuid, numeric)',
    'definir_compte_comptable(text, text, boolean, uuid)',
    'definir_nature_depense(text, text, boolean, uuid)',
    'associer_categorie_cout(uuid, uuid)',
    'definir_compte_tiers(uuid, uuid, uuid)',
    'imputer_depense(text, uuid, uuid, text)',
    'definir_budget(date, date, uuid, text, numeric, uuid, text, uuid, text)',
    'annuler_budget(uuid, text)',
    'ecritures_gestion(date, date)',
    'mesures_loueur(uuid, date, date)',
    'definir_critere_loueur(text, integer, text, text, integer, boolean, uuid)',
    'evaluer_fournisseur(uuid, date, date, jsonb, text, text)',
    'definir_critere_evaluation(text, integer, text, integer, boolean, uuid)',
    'evaluer_loueur(uuid, date, date, jsonb, text, text)',
    'creer_avoir(uuid, numeric, text)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', s);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', s);
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.garde_append_only_finance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.garde_budget() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.garde_calcul_clause() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rouvrir_clauses_facture_annulee() FROM PUBLIC, anon, authenticated;

-- 8. Mes validations (D-056, derniere definition `20261117180000`, non
-- modifiee par D-072) : branches existantes reprises a l'identique, plus
-- echeances de contrat, clauses a decider et budgets depasses -----------------

CREATE OR REPLACE FUNCTION public.mes_validations()
RETURNS TABLE (categorie text, objet text, reference text, detail text, depuis timestamptz, ecran text)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH moi AS (
    SELECT auth.uid() AS id,
           (SELECT pr.role::text FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.status = 'active') AS role,
           public.is_admin() AS admin
  )
  SELECT 'Achats', 'Bon de commande à approuver', po.po_number::text, coalesce(po.total_amount::text || ' GNF', ''), coalesce(po.soumis_le, po.created_at), 'purchases'
    FROM public.purchase_orders po, moi
   WHERE po.status = 'submitted' AND (public.has_module_approve('purchases') OR moi.admin)
     AND moi.id IS DISTINCT FROM po.requested_by AND moi.id IS DISTINCT FROM po.soumis_par
  UNION ALL
  SELECT 'Achats', 'Bon de commande à réceptionner', po.po_number::text, CASE WHEN po.status = 'partially_received' THEN 'Reçu en partie' ELSE 'Approuvé' END,
         coalesce(po.approved_at, po.updated_at), 'purchases'
    FROM public.purchase_orders po, moi
   WHERE po.status IN ('approved', 'partially_received') AND (public.has_module_write('stock') OR moi.admin)
  UNION ALL
  SELECT 'Paiements', 'Paiement à approuver', p.numero::text, p.beneficiaire || ' · ' || p.montant_propose::text || ' ' || p.devise, p.propose_le, 'paiements'
    FROM public.paiements_fournisseur p, moi
   WHERE p.statut = 'propose' AND (public.has_module_approve('invoices') OR moi.admin) AND moi.id IS DISTINCT FROM p.propose_par
  UNION ALL
  SELECT 'Paiements', 'Paiement approuvé : exécution à saisir', p.numero::text, p.beneficiaire || ' · ' || p.montant_propose::text || ' ' || p.devise, p.decide_le, 'paiements'
    FROM public.paiements_fournisseur p, moi
   WHERE p.statut = 'approuve' AND (public.has_module_write('invoices') OR moi.admin)
  UNION ALL
  SELECT 'Paiements', 'Paiement à contrôler a posteriori', p.numero::text, p.beneficiaire || ' · ' || p.montant_execute::text || ' ' || p.devise,
         p.execute_saisi_le, 'paiements'
    FROM public.paiements_fournisseur p, moi
   WHERE p.statut = 'execute' AND p.controle_resultat IS NULL AND (public.has_module_approve('invoices') OR moi.admin)
     AND moi.id IS DISTINCT FROM p.propose_par AND moi.id IS DISTINCT FROM p.execute_par
  UNION ALL
  SELECT 'Carburant', 'Mouvement de carburant à valider', m.numero::text, m.type::text || ' · ' || m.variation::text || ' L', m.saisi_le, 'fuel-stocks'
    FROM public.mouvements_carburant m, moi
   WHERE m.statut = 'a_valider' AND (public.has_module_write('fuel') OR moi.admin) AND moi.id IS DISTINCT FROM m.saisi_par
  UNION ALL
  SELECT 'Carburant', 'Inventaire de cuve à valider', NULL::text, i.volume_mesure::text || ' L mesurés', i.cree_le, 'fuel-stocks'
    FROM public.inventaires_carburant i, moi
   WHERE i.statut = 'a_valider' AND (public.has_module_write('fuel') OR moi.admin) AND moi.id IS DISTINCT FROM i.cree_par
  UNION ALL
  SELECT 'Exploitation', 'Clôture de poste à valider', to_char(p.date_poste, 'DD/MM/YYYY'), NULL::text, p.cloture_le, 'postes'
    FROM public.postes p, moi
   WHERE p.statut = 'cloture' AND (public.has_module_write('planning') OR moi.admin) AND moi.id IS DISTINCT FROM p.cloture_par
  UNION ALL
  SELECT 'Maintenance', 'Remise en service à valider', i.numero::text, i.description::text, i.fin_le, 'interventions-loueur'
    FROM public.interventions_loueur i, moi
   WHERE i.statut = 'terminee' AND (public.has_module_write('maintenance') OR moi.admin) AND moi.id IS DISTINCT FROM i.fin_saisie_par
  UNION ALL
  SELECT 'Tickets CBG', 'Écart de relevé à décider', r.reference::text, e.nature || coalesce(' · ' || e.detail, ''), r.importe_le, 'tickets-cbg'
    FROM public.ecarts_releve_cbg e JOIN public.releves_cbg r ON r.id = e.releve_id, moi
   WHERE e.decision IS NULL AND e.nature <> 'concordant' AND (public.has_module_write('trips') OR moi.admin)
  UNION ALL
  SELECT 'Facturation', 'Facture à signer', f.numero::text, f.montant_ttc::text || ' ' || f.devise, f.soumise_le, 'invoices'
    FROM public.factures f, moi
   WHERE f.statut = 'a_signer' AND moi.role = 'director'
  UNION ALL
  SELECT 'HSE', 'Action corrective en retard', i.numero::text, a.libelle || ' · ' || a.responsable, a.echeance::timestamptz, 'incidents'
    FROM public.actions_correctives a JOIN public.incidents i ON i.id = a.incident_id, moi
   WHERE a.statut = 'ouverte' AND a.echeance < current_date AND (public.has_module_write('trips') OR moi.admin)
  UNION ALL
  SELECT 'Contrats',
         CASE WHEN e.echu THEN 'Contrat échu : renouvellement ou clôture à décider'
              WHEN e.nature_echeance = 'limite_preavis' THEN 'Préavis de contrat à décider'
              ELSE 'Échéance de contrat' END,
         e.reference::text,
         e.contrepartie || ' · ' || CASE WHEN e.nature_echeance = 'limite_preavis' THEN 'préavis jusqu''au ' ELSE 'fin le ' END
           || to_char(e.date_cle, 'DD/MM/YYYY') || CASE WHEN e.denonce_le IS NOT NULL THEN ' · dénoncé' ELSE '' END,
         e.date_alerte::timestamptz, 'contrats'
    FROM public.v_echeances_contrats e, moi
   WHERE e.a_signaler AND (public.has_module_write('contracts') OR moi.admin)
  UNION ALL
  SELECT 'Contrats', 'Clause contractuelle à décider', k.libelle,
         k.montant_propose_ht::text || ' ' || k.devise || ' HT · ' || to_char(k.periode_debut, 'MM/YYYY'),
         k.calcule_le, 'engagements'
    FROM public.calculs_clauses k, moi
   WHERE k.statut = 'propose'
     AND ((public.has_module_write('contracts') AND public.has_module_write('invoices')) OR public.has_module_approve('contracts') OR moi.admin)
  UNION ALL
  SELECT 'Budgets', 'Budget dépassé', b.numero, b.nature || coalesce(' · ' || b.site, '') || ' · ' || b.consommation_pct::text || ' % consommé',
         b.cree_le, 'budgets'
    FROM public.v_suivi_budgets b, moi
   WHERE b.depassement AND (public.has_module_write('costs') OR moi.admin);
$$;
REVOKE EXECUTE ON FUNCTION public.mes_validations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mes_validations() TO authenticated;

-- 9. Reglages lus par le serveur (D-061) : toutes les cles de la derniere
-- definition (D-063, `20261121090000`) reprises, plus le delai d'alerte des
-- echeances de contrat et la separation de la renonciation a une clause ----

CREATE OR REPLACE FUNCTION public.valider_reglage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE v text := NEW.value ->> 'value';
BEGIN
  IF NEW.key IN ('mfa_exige', 'carburant_validation_separee', 'kilometrage_validation_separee',
                 'achats_validation_separee', 'paiements_validation_separee', 'controle_depart_exige',
                 'planification_cloture_separee', 'clauses_renonciation_separee') THEN
    IF v IS NULL OR v NOT IN ('true', 'false') THEN
      RAISE EXCEPTION 'Reglage % : valeur true ou false attendue', NEW.key USING ERRCODE = '22023';
    END IF;
  ELSIF NEW.key IN ('tolerance_poids_cbg_t', 'pneu_profondeur_min_mm', 'pneu_inspection_max_jours') THEN
    IF v IS NULL OR v !~ '^\d+(\.\d+)?$' THEN
      RAISE EXCEPTION 'Reglage % : nombre positif attendu', NEW.key USING ERRCODE = '22023';
    END IF;
  ELSIF NEW.key IN ('fournisseurs_alerte_documents_jours', 'consultation_offres_minimum', 'contrats_alerte_echeance_jours') THEN
    -- Lus par reglage_entier (D-059, D-065) : un entier, sinon la valeur par defaut s'appliquerait en silence.
    IF v IS NULL OR v !~ '^\d+$' OR (NEW.key = 'consultation_offres_minimum' AND v::integer < 1) THEN
      RAISE EXCEPTION 'Reglage % : nombre entier attendu (au moins 1 offre)', NEW.key USING ERRCODE = '22023';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS valider_reglage ON public.settings;
CREATE TRIGGER valider_reglage BEFORE INSERT OR UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.valider_reglage();

-- 10. Factures clientes (CBG) distinctes des factures de penalite du loueur --
-- Une penalite du loueur appliquee par clause (D-065) est une facture D-029
-- au contrat de location : elle ne compte ni dans le rapport client ni dans
-- les indicateurs d'emission du poste. Le recouvrement (`v_creances`) et
-- l'export comptable la gardent : c'est une creance reelle.

-- Nature du contrat d'une facture, avec le meme droit que la lecture des
-- factures (D-029) : rien n'est revele au-dela de la facture visible.
CREATE OR REPLACE FUNCTION public.est_facture_client(p_facture uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE WHEN public.has_module_view('invoices') OR public.has_module_view('contracts') OR public.is_admin()
              THEN (SELECT c.nature = 'client' FROM public.factures f JOIN public.contrats c ON c.id = f.contrat_id WHERE f.id = p_facture)
         END;
$$;
REVOKE EXECUTE ON FUNCTION public.est_facture_client(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.est_facture_client(uuid) TO authenticated;

-- rapport_client (D-058, derniere definition `20261118090000`, non modifiee
-- par D-072) : reprise a l'identique, factures des contrats clients seules.
CREATE OR REPLACE FUNCTION public.rapport_client(p_debut date, p_fin date, p_site uuid DEFAULT NULL)
RETURNS TABLE (rang integer, section text, indicateur text, valeur numeric, unite text, manquants integer, source text, remarque text)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH dr AS (
    SELECT (a OR public.has_module_view('trips')) AS trips,
           (a OR public.has_module_view('trips') OR public.has_module_view('invoices')) AS releves,
           (a OR public.has_module_view('invoices') OR public.has_module_view('contracts')) AS factures
      FROM (SELECT public.is_admin() AS a) x
  ),
  v AS (
    SELECT t.id, t.etat, t.net_weight, t.net_weight_reception, t.accepted_tonnage
      FROM public.trips t
     WHERE t.planned_date BETWEEN p_debut AND p_fin
       AND t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')
       AND (p_site IS NULL OR t.departure_site_id = p_site OR t.arrival_site_id = p_site)
  ),
  va AS (
    SELECT count(*) AS livres,
           sum(net_weight) AS chargees, count(*) FILTER (WHERE net_weight IS NULL) AS sans_chargee,
           sum(net_weight_reception) AS recues, count(*) FILTER (WHERE net_weight_reception IS NULL) AS sans_recue,
           sum(accepted_tonnage) FILTER (WHERE etat IN ('ACCEPTED', 'CLOSED')) AS acceptees,
           count(*) FILTER (WHERE etat IN ('ACCEPTED', 'CLOSED') AND accepted_tonnage IS NULL) AS sans_acceptee,
           count(*) FILTER (WHERE etat = 'DELIVERED') AS en_attente,
           count(*) FILTER (WHERE etat = 'DISPUTED') AS litiges
      FROM v
  ),
  tk AS (
    SELECT count(k.id) AS tickets, count(*) FILTER (WHERE k.est_rectifie) AS rectifies,
           count(*) FILTER (WHERE k.id IS NULL) AS sans_ticket, sum(k.net) AS net
      FROM v LEFT JOIN public.v_tickets_pesee_cbg_effectifs k ON k.trip_id = v.id
  ),
  rl AS (
    SELECT r.id FROM public.releves_cbg r
     WHERE r.periode_debut <= p_fin AND r.periode_fin >= p_debut AND (p_site IS NULL OR r.site_id = p_site)
  ),
  ec AS (
    SELECT (SELECT count(*) FROM rl) AS releves,
           (SELECT count(*) FROM public.releves_cbg_lignes x WHERE x.releve_id IN (SELECT id FROM rl)) AS lignes,
           count(*) FILTER (WHERE e.nature = 'concordant') AS concordants,
           count(*) FILTER (WHERE e.nature <> 'concordant') AS anomalies,
           count(*) FILTER (WHERE e.nature = 'ecart_poids') AS ecarts_poids,
           count(*) FILTER (WHERE e.nature IN ('absent_sigtb', 'manquant_releve')) AS absents,
           count(*) FILTER (WHERE e.nature NOT IN ('concordant', 'ecart_poids', 'absent_sigtb', 'manquant_releve')) AS autres,
           count(*) FILTER (WHERE e.nature <> 'concordant' AND e.decision = 'accepte') AS acceptes,
           count(*) FILTER (WHERE e.nature <> 'concordant' AND e.decision = 'litige') AS litiges,
           count(*) FILTER (WHERE e.nature <> 'concordant' AND e.decision IS NULL) AS sans_decision,
           sum(e.ecart_net) FILTER (WHERE e.nature = 'ecart_poids') AS ecart_net
      FROM public.ecarts_releve_cbg e WHERE e.releve_id IN (SELECT id FROM rl)
  ),
  fa AS (
    SELECT f.devise,
           count(*) FILTER (WHERE f.type = 'facture') AS factures,
           sum(f.montant_ht) FILTER (WHERE f.type = 'facture') AS ht,
           count(*) FILTER (WHERE f.type = 'avoir') AS avoirs,
           sum(f.montant_ht) FILTER (WHERE f.type = 'avoir') AS ht_avoirs
      FROM public.factures f
     WHERE f.statut = 'emise' AND f.periode_debut <= p_fin AND f.periode_fin >= p_debut
       AND public.est_facture_client(f.id)
     GROUP BY f.devise
  ),
  lignes AS (
    SELECT l.* FROM dr, va, tk, ec, LATERAL (VALUES
      (10, 'Livraisons', 'Voyages livrés', va.livres::numeric, 'voyages', NULL::integer, 'trips', 'Au départ ou à l''arrivée du site', dr.trips),
      (11, 'Livraisons', 'Tonnes chargées (pesée départ)', va.chargees, 't', va.sans_chargee::integer, 'voyages livrés', NULL::text, dr.trips),
      (12, 'Livraisons', 'Tonnes reçues (pesée arrivée)', va.recues, 't', va.sans_recue::integer, 'voyages livrés', NULL, dr.trips),
      (13, 'Livraisons', 'Tonnes acceptées', va.acceptees, 't', va.sans_acceptee::integer, 'voyages acceptés ou clos', NULL, dr.trips),
      (14, 'Livraisons', 'Livrés en attente d''acceptation', va.en_attente::numeric, 'voyages', NULL, 'trips', NULL, dr.trips),
      (15, 'Livraisons', 'En litige', va.litiges::numeric, 'voyages', NULL, 'trips', NULL, dr.trips),
      (20, 'Tickets CBG', 'Tickets de pesée', tk.tickets::numeric, 'tickets', NULL, 'tickets effectifs (D-037)', NULL, dr.trips),
      (21, 'Tickets CBG', 'Poids net des tickets', tk.net, 't', NULL, 'tickets effectifs (D-037)', NULL, dr.trips),
      (22, 'Tickets CBG', 'Dont tickets rectifiés', tk.rectifies::numeric, 'tickets', NULL, 'rectifications (D-037)', NULL, dr.trips),
      (23, 'Tickets CBG', 'Voyages livrés sans ticket', tk.sans_ticket::numeric, 'voyages', NULL, 'voyages livrés', NULL, dr.trips),
      (30, 'Relevés CBG', 'Relevés importés', ec.releves::numeric, 'relevés', NULL, 'releves_cbg (D-050)', 'Relevés dont la période recoupe la période', dr.releves),
      (31, 'Relevés CBG', 'Lignes de relevé', ec.lignes::numeric, 'lignes', NULL, 'releves_cbg_lignes', NULL, dr.releves),
      (32, 'Relevés CBG', 'Lignes concordantes', ec.concordants::numeric, 'lignes', NULL, 'rapprochement (D-050)', NULL, dr.releves),
      (33, 'Relevés CBG', 'Anomalies de rapprochement', ec.anomalies::numeric, 'écarts', NULL, 'rapprochement (D-050)', NULL, dr.releves),
      (34, 'Relevés CBG', 'Dont écarts de poids', ec.ecarts_poids::numeric, 'écarts', NULL, 'rapprochement (D-050)', NULL, dr.releves),
      (35, 'Relevés CBG', 'Dont tickets absents d''un côté', ec.absents::numeric, 'écarts', NULL, 'rapprochement (D-050)', NULL, dr.releves),
      (36, 'Relevés CBG', 'Dont autres écarts', ec.autres::numeric, 'écarts', NULL, 'rapprochement (D-050)', 'Camion, date ou ligne illisible', dr.releves),
      (37, 'Relevés CBG', 'Écart de poids net cumulé', ec.ecart_net, 't', NULL, 'rapprochement (D-050)', NULL, dr.releves),
      (38, 'Relevés CBG', 'Anomalies acceptées', ec.acceptes::numeric, 'écarts', NULL, 'décisions (D-050)', NULL, dr.releves),
      (39, 'Relevés CBG', 'Anomalies en litige', ec.litiges::numeric, 'écarts', NULL, 'décisions (D-050)', NULL, dr.releves),
      (40, 'Relevés CBG', 'Anomalies sans décision', ec.sans_decision::numeric, 'écarts', NULL, 'décisions (D-050)', NULL, dr.releves)
    ) AS l(rang, section, indicateur, valeur, unite, manquants, source, remarque, visible)
    UNION ALL
    SELECT 50 + (row_number() OVER (ORDER BY fa.devise))::integer * 10 + k.r, 'Factures CBG', k.libelle || ' (' || fa.devise || ')', k.v, k.u,
           NULL::integer, 'factures émises (D-029)', k.rq, dr.factures
      FROM fa, dr, LATERAL (VALUES
        (0, 'Factures émises', fa.factures::numeric, 'factures', 'Factures dont la période recoupe la période'),
        (1, 'Montant HT facturé', fa.ht, fa.devise, NULL::text),
        (2, 'Avoirs émis', fa.avoirs::numeric, 'avoirs', NULL),
        (3, 'Montant HT des avoirs', fa.ht_avoirs, fa.devise, NULL)
      ) AS k(r, libelle, v, u, rq)
    UNION ALL
    SELECT 60, 'Factures CBG', 'Factures émises', NULL::numeric, 'factures', NULL::integer, 'factures émises (D-029)', NULL, dr.factures
      FROM dr WHERE NOT EXISTS (SELECT 1 FROM fa)
  )
  SELECT l.rang, l.section, l.indicateur,
         CASE WHEN l.visible THEN l.valeur END, l.unite, CASE WHEN l.visible THEN l.manquants END, l.source,
         CASE WHEN NOT l.visible THEN 'Non visible avec vos droits de lecture'
              ELSE coalesce(l.remarque, CASE WHEN l.valeur IS NULL THEN 'Sans données' END) END
    FROM lignes l
   ORDER BY l.rang;
$$;

-- indicateurs_charge_contrats (D-032, derniere definition `20261111200000`) :
-- reprise a l'identique, delai et nombre de factures emises sur les contrats
-- clients seuls.
CREATE OR REPLACE FUNCTION public.indicateurs_charge_contrats()
RETURNS TABLE (
  delai_emission_jours numeric, factures_emises integer,
  ecart_tonnage_pct numeric, reconciliations_closes integer,
  delai_rapport_jours numeric, rapports_remis integer,
  delai_recouvrement_jours numeric, factures_soldees integer,
  creances_en_retard integer, montant_en_retard numeric,
  factures_a_signer integer,
  ecarts_detectes numeric, ecarts_recouvres numeric, factures_fournisseur_controlees integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    (SELECT round(avg(date_emission - periode_fin), 1) FROM public.factures
      WHERE type = 'facture' AND statut = 'emise' AND date_emission >= current_date - 365 AND periode_fin IS NOT NULL
        AND public.est_facture_client(id)),
    (SELECT count(*)::integer FROM public.factures WHERE type = 'facture' AND statut = 'emise' AND date_emission >= current_date - 365
        AND public.est_facture_client(id)),
    (SELECT round((x.releve - x.facture) / nullif(x.releve, 0) * 100, 2) FROM (
       SELECT (SELECT sum(l.tonnage_charge) FROM public.reconciliation_lignes l JOIN public.reconciliations r ON r.id = l.reconciliation_id
                WHERE r.statut = 'cloturee' AND r.cloturee_le >= now() - interval '365 days') AS releve,
              (SELECT sum(r.tonnage_facturable) FROM public.reconciliations r
                WHERE r.statut = 'cloturee' AND r.cloturee_le >= now() - interval '365 days') AS facture) x),
    (SELECT count(*)::integer FROM public.reconciliations WHERE statut = 'cloturee' AND cloturee_le >= now() - interval '365 days'),
    (SELECT round(avg(remis_le - periode_fin), 1) FROM public.rapports_performance WHERE statut = 'remis' AND remis_le >= current_date - 365),
    (SELECT count(*)::integer FROM public.rapports_performance WHERE statut = 'remis' AND remis_le >= current_date - 365),
    (SELECT round(avg(dernier_encaissement - date_emission), 1) FROM public.v_creances WHERE reste <= 0 AND dernier_encaissement >= current_date - 365),
    (SELECT count(*)::integer FROM public.v_creances WHERE reste <= 0 AND dernier_encaissement >= current_date - 365),
    (SELECT count(*)::integer FROM public.v_creances WHERE jours_retard > 0),
    (SELECT coalesce(sum(reste), 0) FROM public.v_creances WHERE jours_retard > 0),
    (SELECT count(*)::integer FROM public.factures WHERE statut = 'a_signer'),
    (SELECT coalesce(sum(montant_reclame), 0) FROM public.factures_fournisseur
      WHERE statut IN ('notifiee', 'regularisee') AND notifiee_le >= current_date - 365),
    (SELECT coalesce(sum(r.montant), 0) FROM public.regularisations_fournisseur r
      WHERE r.date_regularisation >= current_date - 365),
    (SELECT count(*)::integer FROM public.factures_fournisseur WHERE controle_le >= now() - interval '365 days');
$$;
REVOKE EXECUTE ON FUNCTION public.indicateurs_charge_contrats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.indicateurs_charge_contrats() TO authenticated;

-- 11. Rapport de performance (D-031, dernieres definitions `20261111180000`,
-- non modifiees par D-072) : reprises a l'identique, refusees sur un contrat
-- en brouillon (non signe), pour qu'aucune clause ne se calcule sur lui.
CREATE OR REPLACE FUNCTION public.generer_rapport_performance(p_contrat_id uuid, p_du date, p_au date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existant public.rapports_performance;
  v_contenu jsonb;
  v_id uuid;
BEGIN
  IF NOT public.has_module_write('contracts') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les contrats requis' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contrats WHERE id = p_contrat_id) OR p_du IS NULL OR p_au IS NULL OR p_au < p_du THEN
    RAISE EXCEPTION 'Contrat et periode requis' USING ERRCODE = '22023';
  END IF;
  IF (SELECT statut FROM public.contrats WHERE id = p_contrat_id) = 'brouillon' THEN
    RAISE EXCEPTION 'Contrat en brouillon (non signe) : aucun rapport de performance' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_existant FROM public.rapports_performance WHERE contrat_id = p_contrat_id AND periode_debut = p_du FOR UPDATE;
  IF v_existant.statut = 'remis' THEN
    RAISE EXCEPTION 'Rapport deja remis le % : il ne change plus', v_existant.remis_le USING ERRCODE = '22023';
  END IF;

  v_contenu := jsonb_build_object(
    'genere_le', now(),
    'engagements', coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM public.comparer_engagements(p_contrat_id, p_du, p_au) c), '[]'::jsonb),
    'mesures', (SELECT to_jsonb(r) FROM public.realise_engagements(p_du, p_au) r),
    'reconciliations', coalesce((SELECT jsonb_agg(jsonb_build_object('debut', periode_debut, 'fin', periode_fin, 'statut', statut,
        'tonnage_facturable', tonnage_facturable, 'voyages_facturables', voyages_facturables) ORDER BY periode_debut)
      FROM public.reconciliations WHERE contrat_id = p_contrat_id AND periode_debut <= p_au AND periode_fin >= p_du), '[]'::jsonb),
    'factures', coalesce((SELECT jsonb_agg(jsonb_build_object('numero', numero, 'type', type, 'statut', statut,
        'montant_ttc', montant_ttc, 'devise', devise) ORDER BY prepare_le)
      FROM public.factures WHERE contrat_id = p_contrat_id AND periode_debut <= p_au AND periode_fin >= p_du AND statut <> 'annulee'), '[]'::jsonb)
  );

  IF v_existant.id IS NOT NULL THEN
    UPDATE public.rapports_performance SET contenu = v_contenu, periode_fin = p_au, genere_par = auth.uid(), genere_le = now()
    WHERE id = v_existant.id RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.rapports_performance (contrat_id, periode_debut, periode_fin, contenu, genere_par)
    VALUES (p_contrat_id, p_du, p_au, v_contenu, auth.uid()) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.marquer_rapport_remis(p_id uuid, p_date date, p_destinataire text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_module_write('contracts') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les contrats requis' USING ERRCODE = '42501';
  END IF;
  IF p_date IS NULL OR p_date > current_date OR nullif(btrim(coalesce(p_destinataire, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Date de remise (non future) et destinataire requis' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.rapports_performance r JOIN public.contrats c ON c.id = r.contrat_id
              WHERE r.id = p_id AND c.statut = 'brouillon') THEN
    RAISE EXCEPTION 'Contrat en brouillon (non signe) : le rapport ne se remet pas' USING ERRCODE = '22023';
  END IF;
  UPDATE public.rapports_performance SET statut = 'remis', remis_le = p_date, remis_a = btrim(p_destinataire), remis_par = auth.uid()
  WHERE id = p_id AND statut = 'brouillon';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rapport introuvable ou deja remis' USING ERRCODE = '22023';
  END IF;
END;
$$;
