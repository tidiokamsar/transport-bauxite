/*
  # Centre des decisions, comparaison de periodes et HSE complementaire
  # (D-068, lot 01 du mandat global, modules 01 et 22)

  1. Alertes prioritaires ecrites par le serveur. La table heritee `alerts`
     n'avait aucun ecrivain (le navigateur pouvait y ecrire sous le droit
     dashboard). Elle devient le registre des alertes : plus aucune
     ecriture depuis le navigateur ; `actualiser_alertes()` (SECURITY
     DEFINER) confronte les donnees reelles deja enregistrees au catalogue
     des regles (`catalogue_regles_alertes`) et cree au plus une alerte par
     regle et par objet (index unique) ; une alerte dont la condition a
     disparu n'est pas effacee : `condition_levee_le` est renseigne et une
     personne la resout. `prendre_en_compte_alerte` et `resoudre_alerte`
     (motif obligatoire) exigent le droit d'ecriture du module de la regle
     et le perimetre.
     Mecanisme : calcul a la lecture, sans planificateur externe. Les
     regles dependent du temps qui passe (immobilisation au-dela d'un
     seuil, echeance depassee, delai contractuel) : un declencheur ne
     s'executerait qu'a l'ecriture de l'evenement et manquerait le
     franchissement du seuil. La barre superieure et le centre des
     decisions appellent `actualiser_alertes()` avant de lire ; un verrou
     consultatif et un intervalle technique de 30 s evitent les calculs
     concurrents ou repetes. La generation est deterministe et idempotente.
     Regles et seuils : `settings` (administrateur). Une regle a seuil ne
     s'active pas sans reglage ; une regle sans seuil est active sauf si
     son reglage vaut false. `regles_alertes()` expose leur etat.
  2. `centre_decisions()` (SECURITY INVOKER) regroupe les alertes visibles
     et `mes_validations()` par priorite : 1 alerte critique, 2 decision en
     attente, 3 alerte d'avertissement, 4 information.
  3. `indicateurs_pilotage` recoit les filtres shift, vehicule et
     partenaire (transporteur, proprietaire ou exploitant de l'engin, D-062)
     et une colonne `nature` (periode ou instantane). Un filtre sans objet
     pour un indicateur rend celui-ci « sans donnees » avec le motif, jamais
     une valeur non filtree.
  4. HSE complementaire, ecriture par fonctions serveur (droit d'ecriture
     exploitation, comme D-054, et perimetre site) :
     - EPI : `dotations_epi` (beneficiaire, type, quantite, remise,
       echeance de renouvellement saisie, restitution, remplacement,
       annulation motivee) ; `v_epi_a_renouveler`.
     - Registre des risques versionne : `risques`, `risques_versions`
       (danger, zone ou activite, gravite et probabilite saisies sur une
       echelle de 1 a 5, mesures, responsable, revue datee) ;
       `v_risques_courants`.
     - Plans de prevention : intervenant exterieur, perimetre, risques,
       mesures, validite ; signature par un titulaire du droit
       d'approbation de l'exploitation (`has_module_approve('trips')`) ;
       un plan signe ne se modifie pas, il est remplace par une nouvelle
       version ; `v_plans_prevention`.
     - Inspections planifiees : programmes (frequence saisie), inspections
       (planifiee, realisee, annulee), constats append-only, actions
       correctives D-054 rattachees a l'inspection.

  Integration sur main (renumerotee 20261121150000, au-dessus de D-064
  20261121140000, D-070). Chaque fonction ou vue recreee part de sa
  derniere definition sur main :
  - `valider_reglage` : 20261121130000 (D-067 : toutes les cles, dont
    `planification_cloture_separee` D-063, `clauses_renonciation_separee`
    et `contrats_alerte_echeance_jours` D-065, `pneu_reforme_precoce_km`
    D-067), plus les cles des regles d'alerte ;
  - `mes_validations` : 20261121120000 (D-065 : contrats, clauses,
    budgets), plus actions d'inspection et plans a signer ;
  - `indicateurs_pilotage` : 20261120102000 (D-072 R3-2 immobilisation
    annulee exclue, R3-6 domaine illisible « Non visible avec vos droits
    de lecture », R1-2 annulation validee), plus les filtres et `nature` ;
    l'ancienne signature a 3 arguments est retiree (aucune surcharge ;
    appels a 2 ou 3 arguments et par nom valides, memes droits) ;
  - `solder_action_corrective`, `v_actions_correctives_en_retard` :
    20261117120000 (D-054, inchanges par D-072), plus l'origine inspection.
  Durcissements de l'integration : droit et perimetre controles avant toute
  lecture, message unique pour un objet introuvable ou hors perimetre
  (D-075) ; chauffeur d'une dotation borne au perimetre ; sequences
  fermees aux comptes ; vues fermees a anon et en lecture seule ;
  `alertes_actualisation` recoit une politique explicite (D-071, test 57) ;
  `seuil_regle_alerte` et `regle_alerte_en_service` ne sont plus
  executables par les comptes (lues par `regles_alertes`).
  Revue independante de l'integration, corrigee en place (migration jamais
  appliquee) : perimetre d'une alerte = celui de son objet source
  (`alerte_objet_permis`) ; `actualiser_alertes` ne renvoie rien et seul
  l'administrateur force ; regle hors service : condition levee ; action
  corrective retiree du centre seulement si une alerte non resolue et
  visible la porte (`mes_validations.objet_id`) ; le redacteur ne signe pas
  son plan ; realisation jamais avant la planification ; beneficiaire d'un
  renouvellement d'EPI mis a jour ; seuils d'alerte strictement positifs.
  Idempotent.
*/

-- 1. Catalogue des regles d'alerte et lecture des reglages -----------------

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
     'trips', 'hse-prevention', 'warning', 'Inspection planifiée non réalisée à la date prévue (D-068).')
  ) AS c(regle, libelle, domaine, cle, type_reglage, unite, module, ecran, gravite, description);
$$;
REVOKE EXECUTE ON FUNCTION public.catalogue_regles_alertes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalogue_regles_alertes() TO authenticated;

-- Seuil d'une regle a seuil : NULL si le reglage est absent ou illisible.
CREATE OR REPLACE FUNCTION public.seuil_regle_alerte(p_regle text)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE WHEN (s.value ->> 'value') ~ '^\d+(\.\d+)?$' AND (s.value ->> 'value')::numeric > 0
              THEN (s.value ->> 'value')::numeric END
    FROM public.catalogue_regles_alertes() c JOIN public.settings s ON s.key = c.cle
   WHERE c.regle = p_regle AND c.type_reglage = 'seuil';
$$;

-- Regle en service : seuil renseigne, ou activation absente ou differente de false.
CREATE OR REPLACE FUNCTION public.regle_alerte_en_service(p_regle text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce((
    SELECT CASE c.type_reglage
             WHEN 'seuil' THEN public.seuil_regle_alerte(p_regle) IS NOT NULL
             ELSE coalesce((SELECT (s.value ->> 'value') <> 'false' FROM public.settings s WHERE s.key = c.cle), true) END
      FROM public.catalogue_regles_alertes() c WHERE c.regle = p_regle), false);
$$;
-- Reglages lisibles par l'administrateur seul (settings) : les comptes lisent
-- l'etat des regles par regles_alertes() (profil actif).
REVOKE EXECUTE ON FUNCTION public.seuil_regle_alerte(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.regle_alerte_en_service(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seuil_regle_alerte(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.regle_alerte_en_service(text) TO service_role;

CREATE OR REPLACE FUNCTION public.regles_alertes()
RETURNS TABLE (regle text, libelle text, domaine text, cle text, type_reglage text, unite text, gravite text,
               description text, en_service boolean, seuil numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.regle, c.libelle, c.domaine, c.cle, c.type_reglage, c.unite, c.gravite, c.description,
         public.regle_alerte_en_service(c.regle), public.seuil_regle_alerte(c.regle)
    FROM public.catalogue_regles_alertes() c
   WHERE EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.status = 'active');
$$;
REVOKE EXECUTE ON FUNCTION public.regles_alertes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regles_alertes() TO authenticated;

-- Controle du format des reglages : reprend la derniere definition sur main
-- (20261121130000, D-067 : cles D-061, D-063, D-065, D-067) et ajoute
-- celles des regles d'alerte (D-068).
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
                 'alerte_action_corrective_retard_active', 'alerte_epi_echu_active', 'alerte_inspection_retard_active') THEN
    IF v IS NULL OR v NOT IN ('true', 'false') THEN
      RAISE EXCEPTION 'Reglage % : valeur true ou false attendue', NEW.key USING ERRCODE = '22023';
    END IF;
  ELSIF NEW.key IN ('alerte_immobilisation_longue_h', 'alerte_ecart_carburant_l', 'alerte_voyage_sans_ticket_h') THEN
    -- Seuil d'alerte (D-068) : strictement positif ; une regle sans seuil reste inactive.
    IF v IS NULL OR v !~ '^\d+(\.\d+)?$' OR v::numeric <= 0 THEN
      RAISE EXCEPTION 'Reglage % : nombre strictement positif attendu', NEW.key USING ERRCODE = '22023';
    END IF;
  ELSIF NEW.key IN ('tolerance_poids_cbg_t', 'pneu_profondeur_min_mm', 'pneu_inspection_max_jours', 'pneu_reforme_precoce_km') THEN
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

-- 2. Registre des alertes --------------------------------------------------

ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS regle text;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS module text;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS ecran text;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id);
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS survenu_le timestamptz;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS condition_levee_le timestamptz;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS resolue_par uuid REFERENCES auth.users(id);
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS resolue_le timestamptz;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS motif_resolution text;

ALTER TABLE public.alerts DROP CONSTRAINT IF EXISTS alerts_alert_type_check;
ALTER TABLE public.alerts ADD CONSTRAINT alerts_alert_type_check CHECK (alert_type IN (
  'vehicle_maintenance', 'fuel_low', 'tire_replacement', 'document_expiry', 'driver_license_expiry', 'insurance_expiry',
  'stock_low', 'invoice_overdue',
  'immobilisation_longue', 'intervention_retard', 'controle_non_conforme', 'ecart_carburant', 'document_expire',
  'action_corrective_retard', 'voyage_sans_ticket', 'epi_echu', 'inspection_retard'));
ALTER TABLE public.alerts DROP CONSTRAINT IF EXISTS alerts_resolution_motivee;
ALTER TABLE public.alerts ADD CONSTRAINT alerts_resolution_motivee CHECK (
  regle IS NULL OR status <> 'resolved'
  OR (resolue_par IS NOT NULL AND resolue_le IS NOT NULL AND nullif(btrim(coalesce(motif_resolution, '')), '') IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS ux_alerts_regle_objet ON public.alerts (regle, reference_type, reference_id) WHERE regle IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_site ON public.alerts (site_id);

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'alerts' LOOP
    EXECUTE format('DROP POLICY %I ON public.alerts', p.policyname);
  END LOOP;
END $$;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.alerts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
-- Perimetre d'une alerte : celui de son objet source (revue, constat 1) :
-- voyage (depart ou arrivee, voyage_permis), action corrective (incident ou
-- inspection d'origine), sinon l'engin, sinon le site. L'engin d'un voyage
-- ou d'une action ne suffit jamais : un compte du site X ne lit pas l'alerte
-- d'un voyage du site Y qu'il ne voit pas.
CREATE OR REPLACE FUNCTION public.alerte_objet_permis(p_reference_type text, p_reference_id uuid, p_vehicle uuid, p_site uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
-- PL/pgSQL : le corps lit inspections et actions_correctives, creees plus bas.
BEGIN
  RETURN coalesce(CASE p_reference_type
    WHEN 'trip' THEN public.voyage_permis(p_reference_id)
    WHEN 'action_corrective' THEN EXISTS (
      SELECT 1 FROM public.actions_correctives a
        LEFT JOIN public.incidents i ON i.id = a.incident_id
        LEFT JOIN public.inspections s ON s.id = a.inspection_id
       WHERE a.id = p_reference_id
         AND CASE WHEN a.incident_id IS NOT NULL THEN public.incident_permis(i.trip_id, i.vehicle_id, i.site_id)
                  ELSE public.site_permis(s.site_id) END)
    ELSE CASE WHEN p_vehicle IS NOT NULL THEN public.vehicule_permis(p_vehicle) ELSE public.site_permis(p_site) END
  END, false);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.alerte_objet_permis(text, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alerte_objet_permis(text, uuid, uuid, uuid) TO authenticated, service_role;
CREATE POLICY lecture ON public.alerts FOR SELECT TO authenticated
  USING ((public.is_admin() OR public.has_module_view(coalesce(module, 'dashboard')))
         AND public.alerte_objet_permis(reference_type, reference_id, vehicle_id, site_id));

-- 3. HSE complementaire ------------------------------------------------------

-- Droit d'ecriture HSE (exploitation, comme D-054), controle avant toute lecture.
CREATE OR REPLACE FUNCTION public.exiger_droit_hse()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (public.has_module_write('trips') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur l''exploitation requis' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.exiger_droit_hse() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.exiger_ecriture_hse(p_site uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.exiger_droit_hse();
  IF p_site IS NULL OR NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.id = p_site) THEN
    RAISE EXCEPTION 'Site requis' USING ERRCODE = '22023';
  END IF;
  IF NOT public.site_permis(p_site) THEN RAISE EXCEPTION 'Site hors de votre perimetre' USING ERRCODE = '42501'; END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.exiger_ecriture_hse(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.texte_requis(p_valeur text, p_libelle text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF nullif(btrim(coalesce(p_valeur, '')), '') IS NULL THEN
    RAISE EXCEPTION '% requis', p_libelle USING ERRCODE = '22023';
  END IF;
  RETURN btrim(p_valeur);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.texte_requis(text, text) FROM PUBLIC, anon, authenticated;

-- 3a. Inspections planifiees
CREATE TABLE IF NOT EXISTS public.programmes_inspection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  libelle text NOT NULL CHECK (btrim(libelle) <> ''),
  zone text,
  frequence_jours integer NOT NULL CHECK (frequence_jours > 0),
  responsable text NOT NULL CHECK (btrim(responsable) <> ''),
  actif boolean NOT NULL DEFAULT true,
  motif_arret text,
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now(),
  arrete_par uuid REFERENCES auth.users(id),
  arrete_le timestamptz,
  CHECK (actif OR nullif(btrim(coalesce(motif_arret, '')), '') IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  programme_id uuid REFERENCES public.programmes_inspection(id),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  objet text NOT NULL CHECK (btrim(objet) <> ''),
  zone text,
  responsable text NOT NULL CHECK (btrim(responsable) <> ''),
  prevue_le date NOT NULL,
  statut text NOT NULL DEFAULT 'planifiee' CHECK (statut IN ('planifiee', 'realisee', 'annulee')),
  realisee_le timestamptz,
  realisee_par uuid REFERENCES auth.users(id),
  conclusion text,
  motif_annulation text,
  annulee_par uuid REFERENCES auth.users(id),
  annulee_le timestamptz,
  planifiee_par uuid REFERENCES auth.users(id),
  planifiee_le timestamptz NOT NULL DEFAULT now(),
  CHECK (statut <> 'realisee' OR (realisee_le IS NOT NULL AND nullif(btrim(coalesce(conclusion, '')), '') IS NOT NULL)),
  CHECK (statut <> 'annulee' OR nullif(btrim(coalesce(motif_annulation, '')), '') IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_inspections_programme_planifiee ON public.inspections (programme_id)
  WHERE statut = 'planifiee' AND programme_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inspections_site ON public.inspections (site_id, prevue_le);
CREATE SEQUENCE IF NOT EXISTS public.inspections_numero_seq;

CREATE TABLE IF NOT EXISTS public.constats_inspection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.inspections(id),
  description text NOT NULL CHECK (btrim(description) <> ''),
  gravite text NOT NULL CHECK (gravite IN ('observation', 'mineur', 'majeur', 'critique')),
  localisation text,
  saisi_par uuid REFERENCES auth.users(id),
  saisi_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_constats_inspection ON public.constats_inspection (inspection_id);

-- 3b. EPI
CREATE TABLE IF NOT EXISTS public.dotations_epi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  site_id uuid NOT NULL REFERENCES public.sites(id),
  beneficiaire text NOT NULL CHECK (btrim(beneficiaire) <> ''),
  driver_id uuid REFERENCES public.drivers(id),
  employee_id uuid REFERENCES public.employees(id),
  type_epi text NOT NULL CHECK (type_epi IN ('casque', 'chaussures', 'gilet', 'gants', 'lunettes', 'protection_auditive',
                                             'masque', 'harnais', 'combinaison', 'autre')),
  designation text,
  taille text,
  quantite integer NOT NULL CHECK (quantite > 0),
  remis_le date NOT NULL,
  echeance_renouvellement date CHECK (echeance_renouvellement IS NULL OR echeance_renouvellement > remis_le),
  remplace_dotation_id uuid UNIQUE REFERENCES public.dotations_epi(id),
  statut text NOT NULL DEFAULT 'remis' CHECK (statut IN ('remis', 'restitue', 'remplace', 'annule')),
  restitue_le date,
  etat_restitution text CHECK (etat_restitution IS NULL OR etat_restitution IN ('bon', 'use', 'endommage', 'perdu')),
  note_restitution text,
  motif_annulation text,
  cloture_par uuid REFERENCES auth.users(id),
  cloture_le timestamptz,
  remis_par uuid REFERENCES auth.users(id),
  saisi_le timestamptz NOT NULL DEFAULT now(),
  CHECK (statut <> 'restitue' OR (restitue_le IS NOT NULL AND etat_restitution IS NOT NULL)),
  CHECK (statut <> 'annule' OR nullif(btrim(coalesce(motif_annulation, '')), '') IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_dotations_epi_site ON public.dotations_epi (site_id, remis_le DESC);
CREATE INDEX IF NOT EXISTS idx_dotations_epi_chauffeur ON public.dotations_epi (driver_id);
CREATE SEQUENCE IF NOT EXISTS public.dotations_epi_numero_seq;

-- 3c. Registre des risques (versionne)
CREATE TABLE IF NOT EXISTS public.risques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  site_id uuid NOT NULL REFERENCES public.sites(id),
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE SEQUENCE IF NOT EXISTS public.risques_numero_seq;

CREATE TABLE IF NOT EXISTS public.risques_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risque_id uuid NOT NULL REFERENCES public.risques(id),
  version integer NOT NULL CHECK (version > 0),
  danger text NOT NULL CHECK (btrim(danger) <> ''),
  zone_activite text NOT NULL CHECK (btrim(zone_activite) <> ''),
  gravite integer NOT NULL CHECK (gravite BETWEEN 1 AND 5),
  probabilite integer NOT NULL CHECK (probabilite BETWEEN 1 AND 5),
  mesures text NOT NULL CHECK (btrim(mesures) <> ''),
  responsable text NOT NULL CHECK (btrim(responsable) <> ''),
  revue_le date NOT NULL,
  prochaine_revue date CHECK (prochaine_revue IS NULL OR prochaine_revue > revue_le),
  statut text NOT NULL CHECK (statut IN ('actif', 'clos')),
  motif text,
  saisi_par uuid REFERENCES auth.users(id),
  saisi_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (risque_id, version),
  CHECK (version = 1 OR nullif(btrim(coalesce(motif, '')), '') IS NOT NULL)
);

-- 3d. Plans de prevention
CREATE TABLE IF NOT EXISTS public.plans_prevention (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  remplace_plan_id uuid UNIQUE REFERENCES public.plans_prevention(id),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  intervenant text NOT NULL CHECK (btrim(intervenant) <> ''),
  fournisseur_id uuid REFERENCES public.suppliers(id),
  responsable_intervenant text,
  perimetre text NOT NULL CHECK (btrim(perimetre) <> ''),
  risques text NOT NULL CHECK (btrim(risques) <> ''),
  mesures text NOT NULL CHECK (btrim(mesures) <> ''),
  valide_du date NOT NULL,
  valide_au date NOT NULL,
  statut text NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'signe', 'remplace', 'annule')),
  redige_par uuid REFERENCES auth.users(id),
  redige_le timestamptz NOT NULL DEFAULT now(),
  signe_par uuid REFERENCES auth.users(id),
  signe_le timestamptz,
  signataire text,
  motif_annulation text,
  annule_par uuid REFERENCES auth.users(id),
  annule_le timestamptz,
  UNIQUE (numero, version),
  CHECK (valide_au >= valide_du),
  CHECK (statut NOT IN ('signe', 'remplace') OR (signe_par IS NOT NULL AND signe_le IS NOT NULL)),
  CHECK (statut <> 'annule' OR nullif(btrim(coalesce(motif_annulation, '')), '') IS NOT NULL)
);
CREATE SEQUENCE IF NOT EXISTS public.plans_prevention_numero_seq;

-- Droits : lecture exploitation ou rapports (EPI : aussi RH) et perimetre ;
-- aucune ecriture directe.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['programmes_inspection', 'inspections', 'constats_inspection', 'dotations_epi',
                           'risques', 'risques_versions', 'plans_prevention'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS lecture ON public.%I', t);
  END LOOP;
  -- Numerotation par les seules fonctions serveur (SECURITY DEFINER).
  FOREACH t IN ARRAY ARRAY['inspections_numero_seq', 'dotations_epi_numero_seq', 'risques_numero_seq', 'plans_prevention_numero_seq'] LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON SEQUENCE public.%I TO service_role', t);
  END LOOP;
END $$;
CREATE POLICY lecture ON public.programmes_inspection FOR SELECT TO authenticated
  USING ((public.has_module_view('trips') OR public.has_module_view('reports') OR public.is_admin()) AND public.site_permis(site_id));
CREATE POLICY lecture ON public.inspections FOR SELECT TO authenticated
  USING ((public.has_module_view('trips') OR public.has_module_view('reports') OR public.is_admin()) AND public.site_permis(site_id));
CREATE POLICY lecture ON public.constats_inspection FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.inspections i WHERE i.id = inspection_id));
CREATE POLICY lecture ON public.dotations_epi FOR SELECT TO authenticated
  USING ((public.has_module_view('trips') OR public.has_module_view('hr') OR public.is_admin()) AND public.site_permis(site_id));
CREATE POLICY lecture ON public.risques FOR SELECT TO authenticated
  USING ((public.has_module_view('trips') OR public.has_module_view('reports') OR public.is_admin()) AND public.site_permis(site_id));
CREATE POLICY lecture ON public.risques_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.risques r WHERE r.id = risque_id));
CREATE POLICY lecture ON public.plans_prevention FOR SELECT TO authenticated
  USING ((public.has_module_view('trips') OR public.has_module_view('reports') OR public.is_admin()) AND public.site_permis(site_id));

-- Enregistrements definitifs : jamais supprimes ; constats et versions de
-- risque jamais modifies (garde D-054, sauf maintenance hors session).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['programmes_inspection', 'inspections', 'dotations_epi', 'risques', 'plans_prevention'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS garde_append_only ON public.%I', t);
    EXECUTE format('CREATE TRIGGER garde_append_only BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.garde_append_only_hse()', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['constats_inspection', 'risques_versions'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS garde_append_only ON public.%I', t);
    EXECUTE format('CREATE TRIGGER garde_append_only BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.garde_append_only_hse()', t);
  END LOOP;
END $$;

-- 3e. Fonctions d'ecriture : inspections
CREATE OR REPLACE FUNCTION public.inspection_ecrivable(p_id uuid)
RETURNS public.inspections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE i public.inspections;
BEGIN
  PERFORM public.exiger_droit_hse();
  SELECT * INTO i FROM public.inspections WHERE id = p_id FOR UPDATE;
  -- Perimetre avant toute description, message unique (D-075).
  IF NOT FOUND OR NOT public.site_permis(i.site_id) THEN
    RAISE EXCEPTION 'Inspection introuvable ou hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  RETURN i;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.inspection_ecrivable(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.inserer_inspection(p_site uuid, p_programme uuid, p_objet text, p_zone text, p_responsable text, p_prevue_le date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
  IF p_prevue_le IS NULL THEN RAISE EXCEPTION 'Date prevue requise' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.inspections (numero, programme_id, site_id, objet, zone, responsable, prevue_le, planifiee_par)
  VALUES ('INS-' || to_char(p_prevue_le, 'YYYY') || '-' || lpad(nextval('public.inspections_numero_seq')::text, 5, '0'),
          p_programme, p_site, public.texte_requis(p_objet, 'Objet'), nullif(btrim(coalesce(p_zone, '')), ''),
          public.texte_requis(p_responsable, 'Responsable'), p_prevue_le, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.inserer_inspection(uuid, uuid, text, text, text, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.planifier_inspection(p_site uuid, p_objet text, p_responsable text, p_prevue_le date, p_zone text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.exiger_ecriture_hse(p_site);
  RETURN public.inserer_inspection(p_site, NULL, p_objet, p_zone, p_responsable, p_prevue_le);
END;
$$;

-- Programme : frequence saisie ; la premiere occurrence est planifiee a la
-- date indiquee, la suivante a la realisation ou a l'annulation.
CREATE OR REPLACE FUNCTION public.definir_programme_inspection(
  p_site uuid, p_libelle text, p_frequence_jours integer, p_responsable text, p_premiere date, p_zone text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.exiger_ecriture_hse(p_site);
  IF p_frequence_jours IS NULL OR p_frequence_jours <= 0 THEN RAISE EXCEPTION 'Frequence en jours requise' USING ERRCODE = '22023'; END IF;
  IF p_premiere IS NULL THEN RAISE EXCEPTION 'Date de la premiere inspection requise' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.programmes_inspection (site_id, libelle, zone, frequence_jours, responsable, cree_par)
  VALUES (p_site, public.texte_requis(p_libelle, 'Libelle'), nullif(btrim(coalesce(p_zone, '')), ''), p_frequence_jours,
          public.texte_requis(p_responsable, 'Responsable'), auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.inserer_inspection(p_site, v_id, p_libelle, p_zone, p_responsable, p_premiere);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.arreter_programme_inspection(p_programme uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.programmes_inspection; v_motif text;
BEGIN
  PERFORM public.exiger_droit_hse();
  SELECT * INTO p FROM public.programmes_inspection WHERE id = p_programme FOR UPDATE;
  IF NOT FOUND OR NOT public.site_permis(p.site_id) THEN
    RAISE EXCEPTION 'Programme introuvable ou hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  IF NOT p.actif THEN RAISE EXCEPTION 'Programme deja arrete' USING ERRCODE = '22023'; END IF;
  v_motif := public.texte_requis(p_motif, 'Motif');
  UPDATE public.programmes_inspection SET actif = false, motif_arret = v_motif, arrete_par = auth.uid(), arrete_le = now() WHERE id = p_programme;
  UPDATE public.inspections SET statut = 'annulee', motif_annulation = 'Programme arrete : ' || v_motif, annulee_par = auth.uid(), annulee_le = now()
   WHERE programme_id = p_programme AND statut = 'planifiee';
END;
$$;

CREATE OR REPLACE FUNCTION public.planifier_suivante(i public.inspections)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.programmes_inspection;
BEGIN
  IF i.programme_id IS NULL THEN RETURN; END IF;
  SELECT * INTO p FROM public.programmes_inspection WHERE id = i.programme_id;
  IF p.actif THEN
    PERFORM public.inserer_inspection(p.site_id, p.id, p.libelle, p.zone, p.responsable, i.prevue_le + p.frequence_jours);
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.planifier_suivante(public.inspections) FROM PUBLIC, anon, authenticated;

-- p_constats : [{"description": text, "gravite": "observation|mineur|majeur|critique", "localisation": text}]
CREATE OR REPLACE FUNCTION public.realiser_inspection(p_inspection uuid, p_realisee_le timestamptz, p_conclusion text, p_constats jsonb DEFAULT '[]'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE i public.inspections; e jsonb;
BEGIN
  i := public.inspection_ecrivable(p_inspection);
  IF i.statut <> 'planifiee' THEN RAISE EXCEPTION 'Inspection deja realisee ou annulee' USING ERRCODE = '22023'; END IF;
  IF p_realisee_le IS NULL OR p_realisee_le > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Date de realisation requise, pas dans le futur' USING ERRCODE = '22023';
  END IF;
  IF p_realisee_le < i.planifiee_le THEN
    RAISE EXCEPTION 'Date de realisation anterieure a la planification de l''inspection' USING ERRCODE = '22023';
  END IF;
  IF p_constats IS NOT NULL AND jsonb_typeof(p_constats) <> 'array' THEN RAISE EXCEPTION 'Constats : liste attendue' USING ERRCODE = '22023'; END IF;
  FOR e IN SELECT x FROM jsonb_array_elements(coalesce(p_constats, '[]'::jsonb)) x LOOP
    IF nullif(btrim(coalesce(e ->> 'description', '')), '') IS NULL OR coalesce(e ->> 'gravite', '') NOT IN ('observation', 'mineur', 'majeur', 'critique') THEN
      RAISE EXCEPTION 'Constat : description et gravite requises' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.constats_inspection (inspection_id, description, gravite, localisation, saisi_par)
    VALUES (i.id, btrim(e ->> 'description'), e ->> 'gravite', nullif(btrim(coalesce(e ->> 'localisation', '')), ''), auth.uid());
  END LOOP;
  UPDATE public.inspections SET statut = 'realisee', realisee_le = p_realisee_le, realisee_par = auth.uid(),
         conclusion = public.texte_requis(p_conclusion, 'Conclusion')
   WHERE id = i.id;
  PERFORM public.planifier_suivante(i);
END;
$$;

CREATE OR REPLACE FUNCTION public.annuler_inspection(p_inspection uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE i public.inspections;
BEGIN
  i := public.inspection_ecrivable(p_inspection);
  IF i.statut <> 'planifiee' THEN RAISE EXCEPTION 'Seule une inspection planifiee s''annule' USING ERRCODE = '22023'; END IF;
  UPDATE public.inspections SET statut = 'annulee', motif_annulation = public.texte_requis(p_motif, 'Motif'),
         annulee_par = auth.uid(), annulee_le = now()
   WHERE id = i.id;
  PERFORM public.planifier_suivante(i);
END;
$$;

-- 3f. Actions correctives rattachees aux inspections (D-054 etendu)
ALTER TABLE public.actions_correctives ALTER COLUMN incident_id DROP NOT NULL;
ALTER TABLE public.actions_correctives ADD COLUMN IF NOT EXISTS inspection_id uuid REFERENCES public.inspections(id);
ALTER TABLE public.actions_correctives ADD COLUMN IF NOT EXISTS constat_id uuid REFERENCES public.constats_inspection(id);
ALTER TABLE public.actions_correctives DROP CONSTRAINT IF EXISTS actions_correctives_origine;
ALTER TABLE public.actions_correctives ADD CONSTRAINT actions_correctives_origine CHECK (num_nonnulls(incident_id, inspection_id) = 1);
CREATE INDEX IF NOT EXISTS idx_actions_correctives_inspection ON public.actions_correctives(inspection_id);
DROP POLICY IF EXISTS lecture ON public.actions_correctives;
CREATE POLICY lecture ON public.actions_correctives FOR SELECT TO authenticated
  USING (CASE WHEN incident_id IS NOT NULL THEN EXISTS (SELECT 1 FROM public.incidents i WHERE i.id = incident_id)
              ELSE EXISTS (SELECT 1 FROM public.inspections s WHERE s.id = inspection_id) END);

CREATE OR REPLACE FUNCTION public.ajouter_action_inspection(p_inspection uuid, p_libelle text, p_responsable text, p_echeance date, p_constat uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE i public.inspections; v_id uuid;
BEGIN
  i := public.inspection_ecrivable(p_inspection);
  IF i.statut <> 'realisee' THEN RAISE EXCEPTION 'Actions correctives apres la realisation de l''inspection' USING ERRCODE = '22023'; END IF;
  IF p_constat IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.constats_inspection c WHERE c.id = p_constat AND c.inspection_id = i.id) THEN
    RAISE EXCEPTION 'Constat d''une autre inspection' USING ERRCODE = '22023';
  END IF;
  IF p_echeance IS NULL THEN RAISE EXCEPTION 'Echeance requise' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.actions_correctives (inspection_id, constat_id, libelle, responsable, echeance, cree_par)
  VALUES (i.id, p_constat, public.texte_requis(p_libelle, 'Action'), public.texte_requis(p_responsable, 'Responsable'), p_echeance, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Realisation (preuve requise) ou annulation (motif requis), definitive ;
-- incident ou inspection d'origine dans le perimetre. Reprend la derniere
-- definition sur main (20261117120000, D-054, inchangee par D-072) : droit
-- d'ecriture et perimetre de l'origine controles avant toute description
-- de l'action, message unique (D-075).
CREATE OR REPLACE FUNCTION public.solder_action_corrective(p_action uuid, p_realisee boolean, p_texte text, p_date timestamptz DEFAULT now())
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE a public.actions_correctives; v_permis boolean := false;
BEGIN
  PERFORM public.exiger_droit_hse();
  SELECT * INTO a FROM public.actions_correctives WHERE id = p_action FOR UPDATE;
  IF FOUND AND a.incident_id IS NOT NULL THEN
    v_permis := EXISTS (SELECT 1 FROM public.incidents i WHERE i.id = a.incident_id
                          AND public.incident_permis(i.trip_id, i.vehicle_id, i.site_id));
  ELSIF FOUND THEN
    v_permis := EXISTS (SELECT 1 FROM public.inspections s WHERE s.id = a.inspection_id AND public.site_permis(s.site_id));
  END IF;
  IF NOT v_permis THEN
    RAISE EXCEPTION 'Action introuvable ou hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  IF a.incident_id IS NOT NULL THEN
    PERFORM public.incident_ecrivable(a.incident_id);
  ELSE
    PERFORM public.inspection_ecrivable(a.inspection_id);
  END IF;
  IF a.statut <> 'ouverte' THEN RAISE EXCEPTION 'Action deja soldee' USING ERRCODE = '22023'; END IF;
  IF p_realisee IS NULL OR nullif(btrim(coalesce(p_texte, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Preuve de realisation ou motif d''annulation requis' USING ERRCODE = '22023';
  END IF;
  IF p_realisee AND (p_date IS NULL OR p_date > now() + interval '5 minutes') THEN
    RAISE EXCEPTION 'Date de realisation requise, pas dans le futur' USING ERRCODE = '22023';
  END IF;
  UPDATE public.actions_correctives SET
    statut = CASE WHEN p_realisee THEN 'realisee' ELSE 'annulee' END,
    realisee_le = CASE WHEN p_realisee THEN p_date END,
    preuve = CASE WHEN p_realisee THEN btrim(p_texte) END,
    motif_annulation = CASE WHEN p_realisee THEN NULL ELSE btrim(p_texte) END,
    solde_par = auth.uid()
   WHERE id = p_action;
END;
$$;

CREATE OR REPLACE VIEW public.v_actions_correctives_en_retard WITH (security_invoker = true) AS
SELECT a.id, a.incident_id, coalesce(i.numero, s.numero) AS numero, a.libelle, a.responsable, a.echeance,
       (current_date - a.echeance) AS jours_de_retard, a.inspection_id
  FROM public.actions_correctives a
  LEFT JOIN public.incidents i ON i.id = a.incident_id
  LEFT JOIN public.inspections s ON s.id = a.inspection_id
 WHERE a.statut = 'ouverte' AND a.echeance < current_date;
GRANT SELECT ON public.v_actions_correctives_en_retard TO authenticated;

-- 3g. EPI
CREATE OR REPLACE FUNCTION public.remettre_epi(
  p_site uuid, p_beneficiaire text, p_type text, p_quantite integer, p_remis_le date,
  p_echeance date DEFAULT NULL, p_designation text DEFAULT NULL, p_taille text DEFAULT NULL,
  p_driver uuid DEFAULT NULL, p_employee uuid DEFAULT NULL, p_remplace uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid; v_nom text; o public.dotations_epi;
BEGIN
  PERFORM public.exiger_ecriture_hse(p_site);
  IF p_type IS NULL OR p_type NOT IN ('casque', 'chaussures', 'gilet', 'gants', 'lunettes', 'protection_auditive',
                                      'masque', 'harnais', 'combinaison', 'autre') THEN
    RAISE EXCEPTION 'Type d''EPI requis' USING ERRCODE = '22023';
  END IF;
  IF p_quantite IS NULL OR p_quantite <= 0 THEN RAISE EXCEPTION 'Quantite positive requise' USING ERRCODE = '22023'; END IF;
  IF p_remis_le IS NULL OR p_remis_le > current_date THEN RAISE EXCEPTION 'Date de remise requise, pas dans le futur' USING ERRCODE = '22023'; END IF;
  IF p_echeance IS NOT NULL AND p_echeance <= p_remis_le THEN
    RAISE EXCEPTION 'Echeance de renouvellement posterieure a la remise' USING ERRCODE = '22023';
  END IF;
  -- Renouvellement : meme type, la personne de la dotation remplacee sauf saisie contraire.
  IF p_remplace IS NOT NULL THEN
    SELECT * INTO o FROM public.dotations_epi WHERE id = p_remplace FOR UPDATE;
    -- Perimetre avant toute description, message unique (D-075).
    IF NOT FOUND OR NOT public.site_permis(o.site_id) THEN
      RAISE EXCEPTION 'Dotation remplacee introuvable ou hors de votre perimetre' USING ERRCODE = '42501';
    END IF;
    IF o.statut <> 'remis' THEN RAISE EXCEPTION 'Dotation remplacee deja close' USING ERRCODE = '22023'; END IF;
    IF o.type_epi <> p_type THEN RAISE EXCEPTION 'Le remplacement porte sur le meme type d''EPI' USING ERRCODE = '22023'; END IF;
  END IF;
  IF coalesce(p_driver, o.driver_id) IS NOT NULL THEN
    -- Chauffeur du perimetre (D-075) : son nom n'est lu qu'apres ce controle.
    IF NOT EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = coalesce(p_driver, o.driver_id))
       OR NOT public.chauffeur_permis(coalesce(p_driver, o.driver_id)) THEN
      RAISE EXCEPTION 'Chauffeur introuvable ou hors de votre perimetre' USING ERRCODE = '42501';
    END IF;
    SELECT d.name INTO v_nom FROM public.drivers d WHERE d.id = coalesce(p_driver, o.driver_id);
  END IF;
  IF coalesce(p_employee, o.employee_id) IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.employees e WHERE e.id = coalesce(p_employee, o.employee_id)) THEN
    RAISE EXCEPTION 'Employe introuvable' USING ERRCODE = '22023';
  END IF;
  IF p_employee IS NOT NULL AND p_driver IS NULL THEN
    SELECT e.full_name INTO v_nom FROM public.employees e WHERE e.id = p_employee;
  END IF;
  -- Beneficiaire : nom saisi, sinon celui de la personne designee pour ce
  -- renouvellement, sinon celui de la dotation remplacee (revue, constat 7).
  v_nom := public.texte_requis(coalesce(nullif(btrim(coalesce(p_beneficiaire, '')), ''),
                                        CASE WHEN p_driver IS NOT NULL OR p_employee IS NOT NULL THEN v_nom END,
                                        o.beneficiaire, v_nom), 'Beneficiaire');
  IF p_remplace IS NOT NULL THEN
    UPDATE public.dotations_epi SET statut = 'remplace', cloture_par = auth.uid(), cloture_le = now() WHERE id = p_remplace;
  END IF;
  INSERT INTO public.dotations_epi (numero, site_id, beneficiaire, driver_id, employee_id, type_epi, designation, taille, quantite,
                                    remis_le, echeance_renouvellement, remplace_dotation_id, remis_par)
  VALUES ('EPI-' || to_char(p_remis_le, 'YYYY') || '-' || lpad(nextval('public.dotations_epi_numero_seq')::text, 5, '0'),
          p_site, v_nom,
          CASE WHEN p_driver IS NOT NULL OR p_employee IS NOT NULL THEN p_driver ELSE o.driver_id END,
          CASE WHEN p_driver IS NOT NULL OR p_employee IS NOT NULL THEN p_employee ELSE o.employee_id END, p_type,
          nullif(btrim(coalesce(p_designation, '')), ''), nullif(btrim(coalesce(p_taille, '')), ''),
          p_quantite, p_remis_le, p_echeance, p_remplace, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.dotation_epi_ouverte(p_dotation uuid)
RETURNS public.dotations_epi
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE d public.dotations_epi;
BEGIN
  PERFORM public.exiger_droit_hse();
  SELECT * INTO d FROM public.dotations_epi WHERE id = p_dotation FOR UPDATE;
  IF NOT FOUND OR NOT public.site_permis(d.site_id) THEN
    RAISE EXCEPTION 'Dotation introuvable ou hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  IF d.statut <> 'remis' THEN RAISE EXCEPTION 'Dotation deja close' USING ERRCODE = '22023'; END IF;
  RETURN d;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.dotation_epi_ouverte(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.restituer_epi(p_dotation uuid, p_restitue_le date, p_etat text, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE d public.dotations_epi;
BEGIN
  d := public.dotation_epi_ouverte(p_dotation);
  IF p_restitue_le IS NULL OR p_restitue_le > current_date OR p_restitue_le < d.remis_le THEN
    RAISE EXCEPTION 'Date de restitution requise, entre la remise et aujourd''hui' USING ERRCODE = '22023';
  END IF;
  IF p_etat IS NULL OR p_etat NOT IN ('bon', 'use', 'endommage', 'perdu') THEN RAISE EXCEPTION 'Etat a la restitution requis' USING ERRCODE = '22023'; END IF;
  UPDATE public.dotations_epi SET statut = 'restitue', restitue_le = p_restitue_le, etat_restitution = p_etat,
         note_restitution = nullif(btrim(coalesce(p_note, '')), ''), cloture_par = auth.uid(), cloture_le = now()
   WHERE id = d.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.annuler_dotation_epi(p_dotation uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE d public.dotations_epi;
BEGIN
  d := public.dotation_epi_ouverte(p_dotation);
  UPDATE public.dotations_epi SET statut = 'annule', motif_annulation = public.texte_requis(p_motif, 'Motif'),
         cloture_par = auth.uid(), cloture_le = now()
   WHERE id = d.id;
END;
$$;

CREATE OR REPLACE VIEW public.v_epi_a_renouveler WITH (security_invoker = true) AS
SELECT d.id, d.numero, d.site_id, d.beneficiaire, d.driver_id, d.type_epi, d.designation, d.remis_le, d.echeance_renouvellement,
       (d.echeance_renouvellement - current_date) AS jours_restants
  FROM public.dotations_epi d
 WHERE d.statut = 'remis' AND d.echeance_renouvellement IS NOT NULL;
GRANT SELECT ON public.v_epi_a_renouveler TO authenticated;

-- 3h. Registre des risques
CREATE OR REPLACE FUNCTION public.enregistrer_risque(
  p_risque uuid, p_site uuid, p_danger text, p_zone text, p_gravite integer, p_probabilite integer,
  p_mesures text, p_responsable text, p_revue_le date, p_prochaine_revue date DEFAULT NULL,
  p_statut text DEFAULT 'actif', p_motif text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE r public.risques; v_version integer;
BEGIN
  IF p_risque IS NULL THEN
    PERFORM public.exiger_ecriture_hse(p_site);
    v_version := 1;
  ELSE
    PERFORM public.exiger_droit_hse();
    SELECT * INTO r FROM public.risques WHERE id = p_risque FOR UPDATE;
    IF NOT FOUND OR NOT public.site_permis(r.site_id) THEN
      RAISE EXCEPTION 'Risque introuvable ou hors de votre perimetre' USING ERRCODE = '42501';
    END IF;
    SELECT max(v.version) + 1 INTO v_version FROM public.risques_versions v WHERE v.risque_id = r.id;
    PERFORM public.texte_requis(p_motif, 'Motif de la revision');
  END IF;
  IF p_gravite IS NULL OR p_gravite NOT BETWEEN 1 AND 5 OR p_probabilite IS NULL OR p_probabilite NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Gravite et probabilite requises (1 a 5)' USING ERRCODE = '22023';
  END IF;
  IF p_revue_le IS NULL OR p_revue_le > current_date THEN RAISE EXCEPTION 'Date de revue requise, pas dans le futur' USING ERRCODE = '22023'; END IF;
  IF p_prochaine_revue IS NOT NULL AND p_prochaine_revue <= p_revue_le THEN
    RAISE EXCEPTION 'Prochaine revue posterieure a la revue' USING ERRCODE = '22023';
  END IF;
  IF coalesce(p_statut, '') NOT IN ('actif', 'clos') THEN RAISE EXCEPTION 'Statut actif ou clos' USING ERRCODE = '22023'; END IF;
  IF p_risque IS NULL THEN
    INSERT INTO public.risques (numero, site_id, cree_par)
    VALUES ('RSQ-' || lpad(nextval('public.risques_numero_seq')::text, 5, '0'), p_site, auth.uid())
    RETURNING * INTO r;
  END IF;
  INSERT INTO public.risques_versions (risque_id, version, danger, zone_activite, gravite, probabilite, mesures, responsable,
                                       revue_le, prochaine_revue, statut, motif, saisi_par)
  VALUES (r.id, v_version, public.texte_requis(p_danger, 'Danger'), public.texte_requis(p_zone, 'Zone ou activite'), p_gravite, p_probabilite,
          public.texte_requis(p_mesures, 'Mesures'), public.texte_requis(p_responsable, 'Responsable'), p_revue_le, p_prochaine_revue,
          p_statut, nullif(btrim(coalesce(p_motif, '')), ''), auth.uid());
  RETURN r.id;
END;
$$;

CREATE OR REPLACE VIEW public.v_risques_courants WITH (security_invoker = true) AS
SELECT r.id, r.numero, r.site_id, v.version, v.danger, v.zone_activite, v.gravite, v.probabilite, (v.gravite * v.probabilite) AS criticite,
       v.mesures, v.responsable, v.revue_le, v.prochaine_revue, v.statut, v.motif, v.saisi_le,
       (v.statut = 'actif' AND v.prochaine_revue IS NOT NULL AND v.prochaine_revue < current_date) AS revue_echue
  FROM public.risques r
  JOIN LATERAL (SELECT * FROM public.risques_versions x WHERE x.risque_id = r.id ORDER BY x.version DESC LIMIT 1) v ON true;
GRANT SELECT ON public.v_risques_courants TO authenticated;

-- 3i. Plans de prevention
CREATE OR REPLACE FUNCTION public.enregistrer_plan_prevention(
  p_plan uuid, p_site uuid, p_intervenant text, p_perimetre text, p_risques text, p_mesures text,
  p_valide_du date, p_valide_au date, p_responsable_intervenant text DEFAULT NULL, p_fournisseur uuid DEFAULT NULL,
  p_remplace uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.plans_prevention; o public.plans_prevention; v_id uuid;
BEGIN
  PERFORM public.exiger_droit_hse();
  IF p_valide_du IS NULL OR p_valide_au IS NULL OR p_valide_au < p_valide_du THEN
    RAISE EXCEPTION 'Periode de validite requise (fin apres debut)' USING ERRCODE = '22023';
  END IF;
  IF p_fournisseur IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = p_fournisseur) THEN
    RAISE EXCEPTION 'Fournisseur introuvable' USING ERRCODE = '22023';
  END IF;
  IF p_plan IS NOT NULL THEN
    PERFORM public.exiger_droit_hse();
    SELECT * INTO p FROM public.plans_prevention WHERE id = p_plan FOR UPDATE;
    IF NOT FOUND OR NOT public.site_permis(p.site_id) THEN
      RAISE EXCEPTION 'Plan introuvable ou hors de votre perimetre' USING ERRCODE = '42501';
    END IF;
    IF p.statut <> 'brouillon' THEN RAISE EXCEPTION 'Plan signe ou clos : creer une nouvelle version' USING ERRCODE = '22023'; END IF;
    UPDATE public.plans_prevention SET intervenant = public.texte_requis(p_intervenant, 'Intervenant'),
           perimetre = public.texte_requis(p_perimetre, 'Perimetre'), risques = public.texte_requis(p_risques, 'Risques'),
           mesures = public.texte_requis(p_mesures, 'Mesures'), valide_du = p_valide_du, valide_au = p_valide_au,
           responsable_intervenant = nullif(btrim(coalesce(p_responsable_intervenant, '')), ''), fournisseur_id = p_fournisseur
     WHERE id = p.id;
    RETURN p.id;
  END IF;
  IF p_remplace IS NOT NULL THEN
    PERFORM public.exiger_droit_hse();
    -- Verrou : deux nouvelles versions concurrentes du meme plan sont serialisees.
    SELECT * INTO o FROM public.plans_prevention WHERE id = p_remplace FOR UPDATE;
    IF NOT FOUND OR NOT public.site_permis(o.site_id) THEN
      RAISE EXCEPTION 'Plan introuvable ou hors de votre perimetre' USING ERRCODE = '42501';
    END IF;
    IF o.statut <> 'signe' THEN RAISE EXCEPTION 'Seul un plan signe en vigueur se remplace' USING ERRCODE = '22023'; END IF;
    IF EXISTS (SELECT 1 FROM public.plans_prevention x WHERE x.remplace_plan_id = o.id) THEN
      RAISE EXCEPTION 'Une nouvelle version existe deja' USING ERRCODE = '22023';
    END IF;
    PERFORM public.exiger_ecriture_hse(o.site_id);
  ELSE
    PERFORM public.exiger_ecriture_hse(p_site);
  END IF;
  INSERT INTO public.plans_prevention (numero, version, remplace_plan_id, site_id, intervenant, fournisseur_id, responsable_intervenant,
                                       perimetre, risques, mesures, valide_du, valide_au, redige_par)
  VALUES (coalesce(o.numero, 'PDP-' || to_char(p_valide_du, 'YYYY') || '-' || lpad(nextval('public.plans_prevention_numero_seq')::text, 5, '0')),
          coalesce(o.version + 1, 1), o.id, coalesce(o.site_id, p_site), public.texte_requis(p_intervenant, 'Intervenant'), p_fournisseur,
          nullif(btrim(coalesce(p_responsable_intervenant, '')), ''), public.texte_requis(p_perimetre, 'Perimetre'),
          public.texte_requis(p_risques, 'Risques'), public.texte_requis(p_mesures, 'Mesures'), p_valide_du, p_valide_au, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Signature : titulaire du droit d'approbation de l'exploitation, ou administrateur.
CREATE OR REPLACE FUNCTION public.signer_plan_prevention(p_plan uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.plans_prevention;
BEGIN
  IF NOT (public.has_module_approve('trips') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Signature reservee aux personnes habilitees (approbation exploitation)' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO p FROM public.plans_prevention WHERE id = p_plan FOR UPDATE;
  IF NOT FOUND OR NOT public.site_permis(p.site_id) THEN
    RAISE EXCEPTION 'Plan introuvable ou hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  IF p.statut <> 'brouillon' THEN RAISE EXCEPTION 'Plan deja signe ou clos' USING ERRCODE = '22023'; END IF;
  IF p.redige_par IS NOT DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Le redacteur d''un plan ne le signe pas : signature par une autre personne habilitee' USING ERRCODE = '42501';
  END IF;
  IF p.valide_au < current_date THEN RAISE EXCEPTION 'Periode de validite depassee' USING ERRCODE = '22023'; END IF;
  UPDATE public.plans_prevention SET statut = 'signe', signe_par = auth.uid(), signe_le = now(),
         signataire = (SELECT pr.full_name FROM public.profiles pr WHERE pr.id = auth.uid())
   WHERE id = p.id;
  IF p.remplace_plan_id IS NOT NULL THEN
    UPDATE public.plans_prevention SET statut = 'remplace' WHERE id = p.remplace_plan_id AND statut = 'signe';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.annuler_plan_prevention(p_plan uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.plans_prevention;
BEGIN
  PERFORM public.exiger_droit_hse();
  SELECT * INTO p FROM public.plans_prevention WHERE id = p_plan FOR UPDATE;
  IF NOT FOUND OR NOT public.site_permis(p.site_id) THEN
    RAISE EXCEPTION 'Plan introuvable ou hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  IF p.statut NOT IN ('brouillon', 'signe') THEN RAISE EXCEPTION 'Plan deja remplace ou annule' USING ERRCODE = '22023'; END IF;
  UPDATE public.plans_prevention SET statut = 'annule', motif_annulation = public.texte_requis(p_motif, 'Motif'),
         annule_par = auth.uid(), annule_le = now()
   WHERE id = p.id;
END;
$$;

CREATE OR REPLACE VIEW public.v_plans_prevention WITH (security_invoker = true) AS
SELECT p.*,
       CASE WHEN p.statut IN ('brouillon', 'remplace', 'annule') THEN p.statut
            WHEN current_date < p.valide_du THEN 'a_venir'
            WHEN current_date > p.valide_au THEN 'expire'
            ELSE 'en_vigueur' END AS etat
  FROM public.plans_prevention p;
GRANT SELECT ON public.v_plans_prevention TO authenticated;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'planifier_inspection(uuid, text, text, date, text)',
    'definir_programme_inspection(uuid, text, integer, text, date, text)',
    'arreter_programme_inspection(uuid, text)',
    'realiser_inspection(uuid, timestamptz, text, jsonb)',
    'annuler_inspection(uuid, text)',
    'ajouter_action_inspection(uuid, text, text, date, uuid)',
    'solder_action_corrective(uuid, boolean, text, timestamptz)',
    'remettre_epi(uuid, text, text, integer, date, date, text, text, uuid, uuid, uuid)',
    'restituer_epi(uuid, date, text, text)',
    'annuler_dotation_epi(uuid, text)',
    'enregistrer_risque(uuid, uuid, text, text, integer, integer, text, text, date, date, text, text)',
    'enregistrer_plan_prevention(uuid, uuid, text, text, text, text, date, date, text, uuid, uuid)',
    'signer_plan_prevention(uuid)',
    'annuler_plan_prevention(uuid, text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- Vues HSE : rien pour anon, lecture seule pour les comptes (RLS des tables).
REVOKE ALL ON public.v_actions_correctives_en_retard, public.v_epi_a_renouveler, public.v_risques_courants,
              public.v_plans_prevention FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.v_actions_correctives_en_retard, public.v_epi_a_renouveler, public.v_risques_courants, public.v_plans_prevention
  FROM authenticated;
GRANT SELECT ON public.v_actions_correctives_en_retard, public.v_epi_a_renouveler, public.v_risques_courants,
                public.v_plans_prevention TO authenticated;

-- 4. Mes validations : derniere definition sur main (20261121120000, D-065 :
-- contrats, clauses, budgets), plus actions correctives d'inspection et
-- plans de prevention a signer.
-- Colonne objet_id ajoutee (identifiant de l'objet, renseigne pour les
-- actions correctives et les plans) : le type de retour change.
DROP FUNCTION IF EXISTS public.mes_validations();
CREATE OR REPLACE FUNCTION public.mes_validations()
RETURNS TABLE (categorie text, objet text, reference text, detail text, depuis timestamptz, ecran text, objet_id uuid)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH moi AS (
    SELECT auth.uid() AS id,
           (SELECT pr.role::text FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.status = 'active') AS role,
           public.is_admin() AS admin
  )
  SELECT 'Achats', 'Bon de commande à approuver', po.po_number::text, coalesce(po.total_amount::text || ' GNF', ''), coalesce(po.soumis_le, po.created_at), 'purchases', po.id
    FROM public.purchase_orders po, moi
   WHERE po.status = 'submitted' AND (public.has_module_approve('purchases') OR moi.admin)
     AND moi.id IS DISTINCT FROM po.requested_by AND moi.id IS DISTINCT FROM po.soumis_par
  UNION ALL
  SELECT 'Achats', 'Bon de commande à réceptionner', po.po_number::text, CASE WHEN po.status = 'partially_received' THEN 'Reçu en partie' ELSE 'Approuvé' END,
         coalesce(po.approved_at, po.updated_at), 'purchases', po.id
    FROM public.purchase_orders po, moi
   WHERE po.status IN ('approved', 'partially_received') AND (public.has_module_write('stock') OR moi.admin)
  UNION ALL
  SELECT 'Paiements', 'Paiement à approuver', p.numero::text, p.beneficiaire || ' · ' || p.montant_propose::text || ' ' || p.devise, p.propose_le, 'paiements', p.id
    FROM public.paiements_fournisseur p, moi
   WHERE p.statut = 'propose' AND (public.has_module_approve('invoices') OR moi.admin) AND moi.id IS DISTINCT FROM p.propose_par
  UNION ALL
  SELECT 'Paiements', 'Paiement approuvé : exécution à saisir', p.numero::text, p.beneficiaire || ' · ' || p.montant_propose::text || ' ' || p.devise, p.decide_le, 'paiements', p.id
    FROM public.paiements_fournisseur p, moi
   WHERE p.statut = 'approuve' AND (public.has_module_write('invoices') OR moi.admin)
  UNION ALL
  SELECT 'Paiements', 'Paiement à contrôler a posteriori', p.numero::text, p.beneficiaire || ' · ' || p.montant_execute::text || ' ' || p.devise,
         p.execute_saisi_le, 'paiements', p.id
    FROM public.paiements_fournisseur p, moi
   WHERE p.statut = 'execute' AND p.controle_resultat IS NULL AND (public.has_module_approve('invoices') OR moi.admin)
     AND moi.id IS DISTINCT FROM p.propose_par AND moi.id IS DISTINCT FROM p.execute_par
  UNION ALL
  SELECT 'Carburant', 'Mouvement de carburant à valider', m.numero::text, m.type::text || ' · ' || m.variation::text || ' L', m.saisi_le, 'fuel-stocks', m.id
    FROM public.mouvements_carburant m, moi
   WHERE m.statut = 'a_valider' AND (public.has_module_write('fuel') OR moi.admin) AND moi.id IS DISTINCT FROM m.saisi_par
  UNION ALL
  SELECT 'Carburant', 'Inventaire de cuve à valider', NULL::text, i.volume_mesure::text || ' L mesurés', i.cree_le, 'fuel-stocks', i.id
    FROM public.inventaires_carburant i, moi
   WHERE i.statut = 'a_valider' AND (public.has_module_write('fuel') OR moi.admin) AND moi.id IS DISTINCT FROM i.cree_par
  UNION ALL
  SELECT 'Exploitation', 'Clôture de poste à valider', to_char(p.date_poste, 'DD/MM/YYYY'), NULL::text, p.cloture_le, 'postes', p.id
    FROM public.postes p, moi
   WHERE p.statut = 'cloture' AND (public.has_module_write('planning') OR moi.admin) AND moi.id IS DISTINCT FROM p.cloture_par
  UNION ALL
  SELECT 'Maintenance', 'Remise en service à valider', i.numero::text, i.description::text, i.fin_le, 'interventions-loueur', i.id
    FROM public.interventions_loueur i, moi
   WHERE i.statut = 'terminee' AND (public.has_module_write('maintenance') OR moi.admin) AND moi.id IS DISTINCT FROM i.fin_saisie_par
  UNION ALL
  SELECT 'Tickets CBG', 'Écart de relevé à décider', r.reference::text, e.nature || coalesce(' · ' || e.detail, ''), r.importe_le, 'tickets-cbg', e.id
    FROM public.ecarts_releve_cbg e JOIN public.releves_cbg r ON r.id = e.releve_id, moi
   WHERE e.decision IS NULL AND e.nature <> 'concordant' AND (public.has_module_write('trips') OR moi.admin)
  UNION ALL
  SELECT 'Facturation', 'Facture à signer', f.numero::text, f.montant_ttc::text || ' ' || f.devise, f.soumise_le, 'invoices', f.id
    FROM public.factures f, moi
   WHERE f.statut = 'a_signer' AND moi.role = 'director'
  UNION ALL
  SELECT 'HSE', 'Action corrective en retard', coalesce(i.numero, s.numero)::text, a.libelle || ' · ' || a.responsable, a.echeance::timestamptz,
         CASE WHEN a.inspection_id IS NOT NULL THEN 'hse-prevention' ELSE 'incidents' END, a.id
    FROM public.actions_correctives a
    LEFT JOIN public.incidents i ON i.id = a.incident_id
    LEFT JOIN public.inspections s ON s.id = a.inspection_id, moi
   WHERE a.statut = 'ouverte' AND a.echeance < current_date AND (public.has_module_write('trips') OR moi.admin)
  UNION ALL
  SELECT 'HSE', 'Plan de prévention à signer', p.numero || ' v' || p.version, p.intervenant || ' · ' || p.perimetre, p.redige_le, 'hse-prevention', p.id
    FROM public.plans_prevention p, moi
   WHERE p.statut = 'brouillon' AND p.valide_au >= current_date AND (public.has_module_approve('trips') OR moi.admin)
     AND moi.id IS DISTINCT FROM p.redige_par
  UNION ALL
  SELECT 'Contrats',
         CASE WHEN e.echu THEN 'Contrat échu : renouvellement ou clôture à décider'
              WHEN e.nature_echeance = 'limite_preavis' THEN 'Préavis de contrat à décider'
              ELSE 'Échéance de contrat' END,
         e.reference::text,
         e.contrepartie || ' · ' || CASE WHEN e.nature_echeance = 'limite_preavis' THEN 'préavis jusqu''au ' ELSE 'fin le ' END
           || to_char(e.date_cle, 'DD/MM/YYYY') || CASE WHEN e.denonce_le IS NOT NULL THEN ' · dénoncé' ELSE '' END,
         e.date_alerte::timestamptz, 'contrats', NULL::uuid
    FROM public.v_echeances_contrats e, moi
   WHERE e.a_signaler AND (public.has_module_write('contracts') OR moi.admin)
  UNION ALL
  SELECT 'Contrats', 'Clause contractuelle à décider', k.libelle,
         k.montant_propose_ht::text || ' ' || k.devise || ' HT · ' || to_char(k.periode_debut, 'MM/YYYY'),
         k.calcule_le, 'engagements', k.id
    FROM public.calculs_clauses k, moi
   WHERE k.statut = 'propose'
     AND ((public.has_module_write('contracts') AND public.has_module_write('invoices')) OR public.has_module_approve('contracts') OR moi.admin)
  UNION ALL
  SELECT 'Budgets', 'Budget dépassé', b.numero, b.nature || coalesce(' · ' || b.site, '') || ' · ' || b.consommation_pct::text || ' % consommé',
         b.cree_le, 'budgets', NULL::uuid
    FROM public.v_suivi_budgets b, moi
   WHERE b.depassement AND (public.has_module_write('costs') OR moi.admin);
$$;
REVOKE EXECUTE ON FUNCTION public.mes_validations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mes_validations() TO authenticated;

-- 5. Generation des alertes --------------------------------------------------

-- Candidats : etat courant des donnees reelles pour les regles en service.
-- Vue interne (proprietaire), lue seulement par actualiser_alertes.
CREATE OR REPLACE VIEW public.v_alertes_candidates AS
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
 WHERE s.statut = 'planifiee' AND s.prevue_le < current_date AND public.regle_alerte_en_service('inspection_retard');
REVOKE ALL ON public.v_alertes_candidates FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_alertes_candidates TO service_role;

CREATE TABLE IF NOT EXISTS public.alertes_actualisation (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  derniere timestamptz NOT NULL
);
ALTER TABLE public.alertes_actualisation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.alertes_actualisation FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.alertes_actualisation TO service_role;
-- Politique explicite (D-071, test 57) : l'heure de la derniere actualisation
-- se lit par l'administrateur ; seule actualiser_alertes (SECURITY DEFINER)
-- l'ecrit.
GRANT SELECT ON public.alertes_actualisation TO authenticated;
DROP POLICY IF EXISTS lecture ON public.alertes_actualisation;
CREATE POLICY lecture ON public.alertes_actualisation FOR SELECT TO authenticated USING (public.is_admin());

-- Cree les alertes manquantes, signale les conditions levees ou revenues.
-- Sans effet si un calcul est en cours ou date de moins de 30 s, sauf
-- p_forcer (administrateur).
-- Ne renvoie rien (revue, constat 3) : le nombre d'alertes creees tous sites
-- confondus apprendrait a un compte borne un evenement d'un autre site.
DROP FUNCTION IF EXISTS public.actualiser_alertes(boolean);
CREATE OR REPLACE FUNCTION public.actualiser_alertes(p_forcer boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_derniere timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.status = 'active') THEN
    RAISE EXCEPTION 'Profil actif requis' USING ERRCODE = '42501';
  END IF;
  IF coalesce(p_forcer, false) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Actualisation forcee reservee a l''administrateur' USING ERRCODE = '42501';
  END IF;
  IF NOT pg_try_advisory_xact_lock(hashtext('sigtb.actualiser_alertes')) THEN RETURN; END IF;
  SELECT a.derniere INTO v_derniere FROM public.alertes_actualisation a WHERE a.id;
  IF NOT coalesce(p_forcer, false) AND v_derniere > clock_timestamp() - interval '30 seconds' THEN RETURN; END IF;
  INSERT INTO public.alertes_actualisation (id, derniere) VALUES (true, clock_timestamp())
  ON CONFLICT (id) DO UPDATE SET derniere = EXCLUDED.derniere;

  INSERT INTO public.alerts (alert_type, regle, severity, title, message, reference_type, reference_id, vehicle_id, driver_id,
                             site_id, module, ecran, survenu_le, status)
  SELECT c.regle, c.regle, c.severity, c.title, coalesce(c.message, ''), c.reference_type, c.reference_id, c.vehicle_id, c.driver_id,
         c.site_id, c.module, c.ecran, c.survenu_le, 'active'
    FROM public.v_alertes_candidates c
  ON CONFLICT (regle, reference_type, reference_id) WHERE regle IS NOT NULL DO NOTHING;

  -- Condition disparue, ou regle mise hors service (revue, constat 5) :
  -- l'alerte reste jusqu'a sa resolution, marquee condition levee.
  UPDATE public.alerts a SET condition_levee_le = now()
   WHERE a.regle IS NOT NULL AND a.status <> 'resolved' AND a.condition_levee_le IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.v_alertes_candidates c
                      WHERE c.regle = a.regle AND c.reference_type = a.reference_type AND c.reference_id = a.reference_id);
  UPDATE public.alerts a SET condition_levee_le = NULL
   WHERE a.regle IS NOT NULL AND a.status <> 'resolved' AND a.condition_levee_le IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.v_alertes_candidates c
                  WHERE c.regle = a.regle AND c.reference_type = a.reference_type AND c.reference_id = a.reference_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.actualiser_alertes(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.actualiser_alertes(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.alerte_traitable(p_alerte uuid)
RETURNS public.alerts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE a public.alerts;
BEGIN
  SELECT * INTO a FROM public.alerts WHERE id = p_alerte FOR UPDATE;
  -- Meme regle que la lecture (module de la regle et perimetre) avant toute
  -- description, message unique (D-075).
  IF NOT FOUND OR NOT ((public.is_admin() OR public.has_module_view(coalesce(a.module, 'dashboard')))
                       AND public.alerte_objet_permis(a.reference_type, a.reference_id, a.vehicle_id, a.site_id)) THEN
    RAISE EXCEPTION 'Alerte introuvable ou hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.is_admin() OR public.has_module_write(coalesce(a.module, 'dashboard'))) THEN
    RAISE EXCEPTION 'Droit d''ecriture du module requis pour traiter cette alerte' USING ERRCODE = '42501';
  END IF;
  IF a.status = 'resolved' THEN RAISE EXCEPTION 'Alerte deja resolue' USING ERRCODE = '22023'; END IF;
  RETURN a;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.alerte_traitable(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.prendre_en_compte_alerte(p_alerte uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE a public.alerts;
BEGIN
  a := public.alerte_traitable(p_alerte);
  IF a.status <> 'active' THEN RAISE EXCEPTION 'Alerte deja prise en compte' USING ERRCODE = '22023'; END IF;
  UPDATE public.alerts SET status = 'acknowledged', acknowledged_by = auth.uid(), acknowledged_at = now() WHERE id = a.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.resoudre_alerte(p_alerte uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE a public.alerts;
BEGIN
  a := public.alerte_traitable(p_alerte);
  UPDATE public.alerts SET status = 'resolved', resolue_par = auth.uid(), resolue_le = now(),
         motif_resolution = public.texte_requis(p_motif, 'Motif de resolution'),
         acknowledged_by = coalesce(acknowledged_by, auth.uid()), acknowledged_at = coalesce(acknowledged_at, now())
   WHERE id = a.id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.prendre_en_compte_alerte(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.resoudre_alerte(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prendre_en_compte_alerte(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resoudre_alerte(uuid, text) TO authenticated;

-- Centre des decisions : alertes visibles et decisions en attente, par
-- priorite (1 alerte critique, 2 decision en attente, 3 avertissement,
-- 4 information), puis de la plus ancienne a la plus recente. Une action
-- corrective en retard n'apparait qu'une fois quand sa regle d'alerte est
-- en service.
CREATE OR REPLACE FUNCTION public.centre_decisions()
RETURNS TABLE (nature text, priorite integer, gravite text, categorie text, objet text, reference text, detail text,
               depuis timestamptz, ecran text, alerte_id uuid, statut text, regle text, condition_levee_le timestamptz,
               detectee_le timestamptz)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT x.* FROM (
    SELECT 'alerte'::text AS nature, CASE a.severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 3 ELSE 4 END AS priorite,
           a.severity AS gravite, coalesce(c.domaine, 'Alertes') AS categorie, a.title AS objet, NULL::text AS reference,
           a.message AS detail, coalesce(a.survenu_le, a.created_at) AS depuis, a.ecran, a.id AS alerte_id, a.status AS statut,
           a.regle, a.condition_levee_le, a.created_at AS detectee_le
      FROM public.alerts a LEFT JOIN public.catalogue_regles_alertes() c ON c.regle = a.regle
     WHERE a.status IN ('active', 'acknowledged')
    UNION ALL
    SELECT 'validation', 2, NULL, v.categorie, v.objet, v.reference, v.detail, v.depuis, v.ecran, NULL, NULL, NULL, NULL, NULL
      FROM public.mes_validations() v
     -- Une action corrective en retard ne s'efface de la boite que si une
     -- alerte non resolue et visible (RLS) la porte deja (revue, constat 2).
     WHERE NOT (v.objet = 'Action corrective en retard'
                AND EXISTS (SELECT 1 FROM public.alerts al
                             WHERE al.regle = 'action_corrective_retard' AND al.reference_type = 'action_corrective'
                               AND al.reference_id = v.objet_id AND al.status <> 'resolved'))
  ) x
  ORDER BY x.priorite, x.depuis NULLS LAST;
$$;
REVOKE EXECUTE ON FUNCTION public.centre_decisions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.centre_decisions() TO authenticated;

-- 6. Indicateurs de pilotage : filtres shift, vehicule et partenaire ---------

-- Vrai si l'engin passe les filtres vehicule et partenaire (partenaire :
-- transporteur, proprietaire ou exploitant de l'engin, sans casse).
CREATE OR REPLACE FUNCTION public.engin_retenu(p_engin uuid, p_vehicule uuid, p_partenaire text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT coalesce((p_vehicule IS NULL OR p_engin = p_vehicule)
     AND (p_partenaire IS NULL OR EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = p_engin
            AND p_partenaire IN (lower(btrim(v.transporteur)), lower(btrim(v.proprietaire)), lower(btrim(v.exploitant))))), false);
$$;
REVOKE EXECUTE ON FUNCTION public.engin_retenu(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.engin_retenu(uuid, uuid, text) TO authenticated;

-- Derniere definition sur main : 20261120102000 (D-072 R3-2, R3-6, R1-2),
-- reprise a l'identique pour chaque indicateur ; s'ajoutent les filtres
-- shift, vehicule et partenaire et la colonne nature. La signature a 3
-- arguments est remplacee (aucune surcharge : les appels a 2 ou 3
-- arguments, positionnels ou par nom, restent valides ; memes droits).
-- Un domaine illisible reste « Non visible avec vos droits de lecture »,
-- avant tout motif de filtre (R3-6).
DROP FUNCTION IF EXISTS public.indicateurs_pilotage(date, date, uuid);
CREATE OR REPLACE FUNCTION public.indicateurs_pilotage(
  p_debut date, p_fin date, p_site uuid DEFAULT NULL, p_shift uuid DEFAULT NULL, p_vehicule uuid DEFAULT NULL, p_partenaire text DEFAULT NULL
) RETURNS TABLE (domaine text, code text, libelle text, valeur numeric, unite text, source text, fiabilite text, detail text,
                 periode_debut date, periode_fin date, calcule_le timestamptz, nature text)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_livres integer; v_sans_poids integer; v_tonnes numeric; v_acceptees numeric; v_cible numeric;
  v_litres numeric; v_debut timestamptz; v_fin timestamptz; r record;
  v_part text := lower(nullif(btrim(coalesce(p_partenaire, '')), ''));
  v_engin boolean;
  -- Visibilite par domaine (memes droits que la RLS des tables lues) : un
  -- domaine illisible ressort « sans donnees », jamais 0 mesure (R3-6).
  v_adm boolean := public.is_admin();
  v_trips boolean; v_plan boolean; v_veh boolean; v_maint boolean; v_fuel boolean; v_interv boolean;
  v_inc boolean; v_ctrl boolean; v_achats boolean; v_pay boolean;
  c_masque constant text := 'Non visible avec vos droits de lecture';
  v_na_shift constant text := 'Filtre shift sans objet pour cet indicateur';
  v_na_engin constant text := 'Filtre véhicule ou partenaire sans objet pour cet indicateur';
  v_na_filtre constant text := 'Indicateur global : sans objet avec un filtre shift, véhicule ou partenaire';
BEGIN
  IF p_debut IS NULL OR p_fin IS NULL OR p_fin < p_debut THEN
    RAISE EXCEPTION 'Periode invalide' USING ERRCODE = '22023';
  END IF;
  IF p_fin - p_debut > 366 THEN RAISE EXCEPTION 'Periode limitee a un an' USING ERRCODE = '22023'; END IF;
  v_trips := v_adm OR public.has_module_view('trips');
  v_plan := v_adm OR public.has_module_view('planning');
  v_veh := v_adm OR public.has_module_view('vehicles');
  v_maint := v_adm OR public.has_module_view('maintenance');
  v_fuel := v_adm OR public.has_module_view('fuel');
  v_interv := v_adm OR public.has_module_view('maintenance') OR public.has_module_view('contracts');
  v_inc := v_adm OR public.has_module_view('trips') OR public.has_module_view('reports');
  v_ctrl := v_adm OR public.has_module_view('trips') OR public.has_module_view('vehicles');
  v_achats := v_adm OR public.has_module_view('purchases') OR public.has_module_view('stock');
  v_pay := v_adm OR public.has_module_view('invoices') OR public.has_module_view('contracts');
  v_engin := p_vehicule IS NOT NULL OR v_part IS NOT NULL;
  v_debut := p_debut::timestamptz;
  v_fin := (p_fin + 1)::timestamptz;
  periode_debut := p_debut; periode_fin := p_fin; calcule_le := now();

  -- Production
  SELECT count(*) FILTER (WHERE t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')),
         count(*) FILTER (WHERE t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')
                          AND coalesce(t.accepted_tonnage, t.net_weight_reception, t.net_weight, t.load_weight) IS NULL),
         sum(coalesce(t.accepted_tonnage, t.net_weight_reception, t.net_weight, t.load_weight))
           FILTER (WHERE t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')),
         sum(t.accepted_tonnage) FILTER (WHERE t.etat IN ('ACCEPTED', 'CLOSED'))
    INTO v_livres, v_sans_poids, v_tonnes, v_acceptees
    FROM public.trips t
   WHERE t.planned_date BETWEEN p_debut AND p_fin AND (p_site IS NULL OR t.departure_site_id = p_site)
     AND (p_shift IS NULL OR t.shift_id = p_shift)
     AND (NOT v_engin OR public.engin_retenu(t.vehicle_id, p_vehicule, v_part));
  -- Objectif : de journee sans filtre shift (D-023), du shift sinon ; aucun
  -- objectif n'est rattache a un engin ou a un partenaire.
  IF NOT v_engin THEN
    SELECT sum(o.tonnes_cible) INTO v_cible FROM public.objectifs_production o
     WHERE o.statut = 'actif' AND o.date_plan BETWEEN p_debut AND p_fin AND (p_site IS NULL OR o.site_id = p_site)
       AND (CASE WHEN p_shift IS NULL THEN o.shift_id IS NULL ELSE o.shift_id = p_shift END);
  END IF;

  nature := 'periode';
  domaine := 'Production'; code := 'voyages_livres'; libelle := 'Voyages livrés'; valeur := v_livres; unite := 'voyages';
  source := 'trips (états livré, accepté, clôturé, en litige ; date prévue ; site de départ)';
  fiabilite := CASE WHEN v_livres = 0 THEN 'sans_donnees' ELSE 'mesure' END; detail := NULL;
  IF NOT v_trips THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  code := 'tonnes_livrees'; libelle := 'Tonnes livrées'; valeur := round(v_tonnes, 2); unite := 't';
  source := 'trips : tonnage accepté, sinon reçu, sinon net, sinon chargé';
  fiabilite := CASE WHEN v_livres = 0 THEN 'sans_donnees' WHEN v_sans_poids > 0 THEN 'partielle' ELSE 'mesure' END;
  detail := CASE WHEN v_sans_poids > 0 THEN v_sans_poids || ' voyage(s) livré(s) sans poids, non comptés' END;
  IF NOT v_trips THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  code := 'tonnes_acceptees'; libelle := 'Tonnes acceptées par CBG'; valeur := round(v_acceptees, 2); unite := 't';
  source := 'trips.accepted_tonnage (voyages acceptés ou clôturés)';
  fiabilite := CASE WHEN v_acceptees IS NULL THEN 'sans_donnees' ELSE 'mesure' END; detail := NULL;
  IF NOT v_trips THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  code := 'objectif'; libelle := 'Objectif de production'; valeur := round(v_cible, 2); unite := 't';
  source := CASE WHEN p_shift IS NULL THEN 'objectifs_production actifs de journée (D-023)' ELSE 'objectifs_production actifs du shift (D-023)' END;
  fiabilite := CASE WHEN v_cible IS NULL THEN 'sans_donnees' ELSE 'mesure' END;
  detail := CASE WHEN v_engin THEN v_na_engin END;
  IF NOT v_plan THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  code := 'realisation'; libelle := 'Réalisation de l''objectif'; unite := '%';
  valeur := CASE WHEN v_cible > 0 AND v_tonnes IS NOT NULL THEN round(100 * v_tonnes / v_cible, 1) END;
  source := 'tonnes livrées / objectif';
  fiabilite := CASE WHEN valeur IS NULL THEN 'sans_donnees' WHEN v_sans_poids > 0 THEN 'partielle' ELSE 'mesure' END;
  detail := CASE WHEN v_engin THEN v_na_engin END;
  IF NOT (v_trips AND v_plan) THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  -- Tickets
  domaine := 'Tickets CBG'; code := 'livres_sans_ticket'; libelle := 'Voyages livrés sans ticket CBG'; unite := 'voyages';
  SELECT count(*) INTO valeur FROM public.v_voyages_livres_sans_ticket v JOIN public.trips t ON t.id = v.id
   WHERE v.planned_date BETWEEN p_debut AND p_fin AND (p_site IS NULL OR v.departure_site_id = p_site)
     AND (p_shift IS NULL OR t.shift_id = p_shift)
     AND (NOT v_engin OR public.engin_retenu(v.vehicle_id, p_vehicule, v_part));
  source := 'v_voyages_livres_sans_ticket (D-050)'; fiabilite := CASE WHEN v_livres = 0 THEN 'sans_donnees' ELSE 'mesure' END; detail := NULL;
  IF NOT v_trips THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  -- Flotte (instantanes, a l'heure du calcul)
  domaine := 'Flotte'; code := 'engins_actifs'; libelle := 'Engins en service'; unite := 'engins'; nature := 'instantane'; detail := NULL;
  source := 'vehicles (statut actif, à l''heure du calcul)';
  IF p_shift IS NOT NULL THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := v_na_shift;
  ELSE
    SELECT count(*) INTO valeur FROM public.vehicles v WHERE v.status = 'active' AND (p_site IS NULL OR v.site_id = p_site)
       AND (NOT v_engin OR public.engin_retenu(v.id, p_vehicule, v_part));
    fiabilite := CASE WHEN valeur = 0 THEN 'sans_donnees' ELSE 'mesure' END;
  END IF;
  IF NOT v_veh THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  code := 'immobilisations_ouvertes'; libelle := 'Immobilisations en cours'; unite := 'engins'; detail := NULL;
  source := 'immobilisations ouvertes, sans fin (D-022)';
  IF p_shift IS NOT NULL THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := v_na_shift;
  ELSE
    SELECT count(*) INTO valeur FROM public.immobilisations i JOIN public.vehicles v ON v.id = i.vehicle_id
     WHERE i.statut = 'ouverte' AND i.fin IS NULL AND (p_site IS NULL OR v.site_id = p_site)
       AND (NOT v_engin OR public.engin_retenu(v.id, p_vehicule, v_part));
    fiabilite := 'mesure';
  END IF;
  IF NOT v_maint THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  code := 'heures_immobilisation'; libelle := 'Heures d''immobilisation sur la période'; unite := 'h'; nature := 'periode'; detail := NULL;
  source := 'immobilisations non annulées : durée comprise dans la période (en cours : jusqu''à l''heure du calcul)';
  IF p_shift IS NOT NULL THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := v_na_shift;
  ELSE
    SELECT round(sum(extract(epoch FROM (least(coalesce(i.fin, now()), v_fin) - greatest(i.debut, v_debut))) / 3600)::numeric, 1)
      INTO valeur
      FROM public.immobilisations i JOIN public.vehicles v ON v.id = i.vehicle_id
     WHERE i.statut <> 'annulee' AND i.debut < v_fin AND coalesce(i.fin, now()) > v_debut AND (p_site IS NULL OR v.site_id = p_site)
       AND (NOT v_engin OR public.engin_retenu(v.id, p_vehicule, v_part));
    fiabilite := CASE WHEN valeur IS NULL THEN 'sans_donnees' ELSE 'mesure' END;
  END IF;
  IF NOT v_maint THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  -- Carburant
  domaine := 'Carburant'; code := 'litres_distribues'; libelle := 'Litres distribués (validés)'; unite := 'L'; detail := NULL;
  source := 'mouvements_carburant : distributions validées, sans annulation validée (D-041)';
  IF p_shift IS NOT NULL THEN v_litres := NULL; valeur := NULL; fiabilite := 'sans_donnees'; detail := v_na_shift;
  ELSE
    SELECT -sum(m.variation) INTO v_litres FROM public.mouvements_carburant m JOIN public.stockages_carburant s ON s.id = m.stockage_id
      LEFT JOIN public.fuel_transactions ft ON ft.id = m.fuel_transaction_id
     WHERE m.type = 'distribution' AND m.statut = 'valide' AND m.date_mouvement >= v_debut AND m.date_mouvement < v_fin
       AND NOT EXISTS (SELECT 1 FROM public.mouvements_carburant a WHERE a.annule_mouvement_id = m.id AND a.statut = 'valide')
       AND (p_site IS NULL OR s.site_id = p_site)
       AND (NOT v_engin OR public.engin_retenu(ft.vehicle_id, p_vehicule, v_part));
    valeur := round(v_litres, 1);
    fiabilite := CASE WHEN v_litres IS NULL THEN 'sans_donnees' ELSE 'mesure' END;
  END IF;
  IF NOT v_fuel THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  code := 'litres_par_tonne'; libelle := 'Litres par tonne livrée'; unite := 'L/t';
  valeur := CASE WHEN v_litres > 0 AND v_tonnes > 0 THEN round(v_litres / v_tonnes, 3) END;
  source := 'litres distribués / tonnes livrées';
  fiabilite := CASE WHEN valeur IS NULL THEN 'sans_donnees' WHEN v_sans_poids > 0 THEN 'partielle' ELSE 'mesure' END;
  detail := CASE WHEN p_shift IS NOT NULL THEN v_na_shift END;
  IF NOT (v_fuel AND v_trips) THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  -- Maintenance (instantane)
  domaine := 'Maintenance'; code := 'interventions_en_retard'; libelle := 'Interventions Neemba en retard'; unite := 'interventions';
  nature := 'instantane';
  source := 'v_interventions_loueur (délai contractuel saisi, D-049) ; tout le périmètre lisible';
  IF p_shift IS NOT NULL THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := v_na_shift;
  ELSE
    SELECT count(*) INTO valeur FROM public.v_interventions_loueur i WHERE i.en_retard AND i.statut <> 'remise_validee'
       AND (NOT v_engin OR public.engin_retenu(i.vehicle_id, p_vehicule, v_part));
    fiabilite := 'mesure'; detail := 'Sans délai contractuel saisi, une intervention n''est jamais comptée en retard';
  END IF;
  IF NOT v_interv THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  -- HSE
  domaine := 'HSE'; detail := NULL; code := 'incidents'; libelle := 'Incidents déclarés'; unite := 'incidents'; nature := 'periode';
  source := 'incidents (heure de survenue) ; tout le périmètre lisible';
  IF p_shift IS NOT NULL THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := v_na_shift;
  ELSE
    SELECT count(*) INTO valeur FROM public.incidents i WHERE i.incident_time >= v_debut AND i.incident_time < v_fin
       AND (NOT v_engin OR public.engin_retenu(i.vehicle_id, p_vehicule, v_part));
    fiabilite := 'mesure';
  END IF;
  IF NOT v_inc THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  code := 'controles_non_conformes'; libelle := 'Contrôles avant départ non conformes'; unite := 'contrôles'; detail := NULL;
  source := 'controles_depart (D-054)';
  IF p_shift IS NOT NULL THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := v_na_shift;
  ELSE
    SELECT count(*) INTO valeur FROM public.controles_depart c JOIN public.vehicles v ON v.id = c.vehicle_id
     WHERE c.resultat = 'non_conforme' AND c.effectue_le >= v_debut AND c.effectue_le < v_fin AND (p_site IS NULL OR v.site_id = p_site)
       AND (NOT v_engin OR public.engin_retenu(c.vehicle_id, p_vehicule, v_part));
    fiabilite := CASE WHEN NOT EXISTS (SELECT 1 FROM public.controles_depart c WHERE c.effectue_le >= v_debut AND c.effectue_le < v_fin)
                      THEN 'sans_donnees' ELSE 'mesure' END;
  END IF;
  IF NOT v_ctrl THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  code := 'actions_en_retard'; libelle := 'Actions correctives en retard'; unite := 'actions'; nature := 'instantane'; detail := NULL;
  source := 'v_actions_correctives_en_retard (incidents et inspections, à l''heure du calcul)';
  IF p_shift IS NOT NULL OR v_engin THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := v_na_filtre;
  ELSE SELECT count(*) INTO valeur FROM public.v_actions_correctives_en_retard; fiabilite := 'mesure';
  END IF;
  IF NOT v_inc THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  -- Achats et finance (indicateurs globaux, instantanes)
  domaine := 'Achats et finance'; code := 'bons_a_approuver'; libelle := 'Bons de commande à approuver'; unite := 'bons'; detail := NULL;
  source := 'purchase_orders soumis (D-053)';
  IF p_shift IS NOT NULL OR v_engin THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := v_na_filtre;
  ELSE SELECT count(*) INTO valeur FROM public.purchase_orders po WHERE po.status = 'submitted'; fiabilite := 'mesure';
  END IF;
  IF NOT v_achats THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  code := 'paiements_a_controler'; libelle := 'Paiements à contrôler a posteriori'; unite := 'paiements'; detail := NULL;
  source := 'v_paiements_a_controler (D-055)';
  IF p_shift IS NOT NULL OR v_engin THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := v_na_filtre;
  ELSE SELECT count(*) INTO valeur FROM public.v_paiements_a_controler; fiabilite := 'mesure';
  END IF;
  IF NOT v_pay THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  -- Reste a payer : une ligne par devise lue (D-072 R3, inchange) ; avec un
  -- filtre, une seule ligne « sans donnees » (masquee sans droit des paiements).
  source := 'v_reste_a_payer : factures du loueur contrôlées et bons reçus (D-055)';
  IF p_shift IS NOT NULL OR v_engin THEN
    code := 'reste_a_payer'; libelle := 'Reste à payer aux fournisseurs'; valeur := NULL; unite := '';
    fiabilite := 'sans_donnees'; detail := CASE WHEN v_pay THEN v_na_filtre ELSE c_masque END; RETURN NEXT;
  ELSE
    detail := NULL;
    FOR r IN SELECT v.devise, sum(v.reste) AS reste FROM public.v_reste_a_payer v GROUP BY v.devise ORDER BY v.devise LOOP
      code := 'reste_a_payer_' || lower(r.devise); libelle := 'Reste à payer aux fournisseurs (' || r.devise || ')';
      valeur := round(r.reste, 2); unite := r.devise; fiabilite := 'mesure'; RETURN NEXT;
    END LOOP;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.indicateurs_pilotage(date, date, uuid, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.indicateurs_pilotage(date, date, uuid, uuid, uuid, text) TO authenticated;
