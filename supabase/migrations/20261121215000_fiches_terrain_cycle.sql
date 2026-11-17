/*
  # Fiches terrain : cycle de vie controle (D-089, lot 07, partie serveur)

  Etend D-028 sans le dupliquer : `fiches_terrain` reste la table des fiches
  (numero unique FR, FP, FC), `pointages_engins` la table des pointages,
  `saisir_rotation` la seule fonction qui fait avancer un voyage depuis une
  fiche (elle ne cree jamais de voyage), le registre `mouvements_carburant`
  (D-041) la seule voie d'une sortie de stock.

  1. Cycle a seize etats (`fiches_terrain.etat`) : a_preparer, preparee,
     a_imprimer, imprimee, a_remettre, remise_agent, en_utilisation,
     retournee, a_saisir, saisie_en_cours, saisie_terminee, a_controler,
     a_corriger, validee, archivee, annulee. Graphe `transition_fiche_autorisee`,
     garde `fiches_terrain_cycle` : l'etat ne change que par les fonctions du
     cycle (drapeau de transaction) et selon le graphe ; une fiche validee,
     archivee ou annulee est figee (seules l'archivage et la trace de
     reimpression passent) ; colonne `version` (+1 a chaque mise a jour).
     L'ancienne colonne `statut` (cinq valeurs D-028) est conservee et
     recalculee depuis l'etat (`fiche_statut_herite`) : ecrans, rapports et
     tableaux de bord existants inchanges.
  2. Fiches existantes : `etat` initialise depuis `statut` sans perte
     (preparee -> preparee, remise -> remise_agent, retournee -> retournee,
     saisie -> saisie_terminee, annulee -> annulee). Aucune n'est validee
     d'office : une fiche saisie avant D-089 passe par controle et validation.
     Aucune autre colonne existante n'est modifiee.
  3. Tables : `fiches_journal` (append-only), `fiches_lots`, `fiches_remises`
     (agent, responsable, horodatage, nombre, numeros, confirmation),
     `fiches_retours` (agent, receptionnaire, horodatage, etat par fiche,
     manquants), `fiches_rotations_lignes` (rotation declaree sur la fiche FR,
     rapprochee d'un voyage existant), `fiches_carburant_lignes` (distribution
     FC : engin, cuve, date-heure, litres, index pompe, agent, compteur,
     horametre, confirmation du destinataire ; sortie de stock unique),
     `fiches_ecarts` (resultat de chaque controle, append-only).
     `pointages_engins` recoit heures productives, periode, arrets, agent.
  4. Fonctions (SECURITY DEFINER, search_path vide, droit du module du type
     de fiche et site_permis) : generer_fiches_rotation, creer_fiche,
     preparer_contenu_fiche, changer_etat_fiche, enregistrer_impression_fiches,
     creer_lot_fiches, attribuer_fiches, remettre_fiches, confirmer_remise,
     enregistrer_retour_fiches, enregistrer_brouillon_fiche,
     saisir_ligne_rotation, saisir_pointage_fiche, saisir_ligne_carburant,
     soumettre_fiche_controle, controler_fiche, renvoyer_fiche_correction,
     valider_fiche (separation_violee), archiver_fiche.
     Redefinies, memes signatures : fiche_ouverte (20261120100000),
     suivre_fiche, annuler_fiche, terminer_saisie_fiche (20261111090000),
     saisir_rotation (20261121160000), saisir_pointage (20261111090000),
     saisir_carburant (20261120100000) : corps repris, ajout du journal et du
     cycle seulement.
  5. Carburant : une ligne FC saisie par le cycle n'est comptabilisee qu'a la
     validation de la fiche (une transaction carburant et un mouvement
     « distribution » a valider par ligne, une seule fois : cles uniques
     `fuel_transaction_id` et `mouvement_id`). La saisie heritee
     `saisir_carburant` (D-028, D-041) comptabilise immediatement comme avant
     et inscrit aussi ses lignes ; les deux voies s'excluent sur une fiche.

  Additive et idempotente. Aucune donnee existante n'est modifiee hors
  l'initialisation des colonnes ajoutees.
*/

-- ---------------------------------------------------------------------------
-- 1. Colonnes du cycle sur fiches_terrain
-- ---------------------------------------------------------------------------
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS etat text;
UPDATE public.fiches_terrain
   SET etat = CASE statut WHEN 'remise' THEN 'remise_agent' WHEN 'saisie' THEN 'saisie_terminee' ELSE statut END
 WHERE etat IS NULL;
ALTER TABLE public.fiches_terrain ALTER COLUMN etat SET DEFAULT 'preparee';
ALTER TABLE public.fiches_terrain ALTER COLUMN etat SET NOT NULL;
ALTER TABLE public.fiches_terrain DROP CONSTRAINT IF EXISTS fiches_terrain_etat_check;
ALTER TABLE public.fiches_terrain ADD CONSTRAINT fiches_terrain_etat_check CHECK (etat IN (
  'a_preparer', 'preparee', 'a_imprimer', 'imprimee', 'a_remettre', 'remise_agent', 'en_utilisation',
  'retournee', 'a_saisir', 'saisie_en_cours', 'saisie_terminee', 'a_controler', 'a_corriger',
  'validee', 'archivee', 'annulee'));

ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS origine text NOT NULL DEFAULT 'preparation';
ALTER TABLE public.fiches_terrain DROP CONSTRAINT IF EXISTS fiches_terrain_origine_check;
ALTER TABLE public.fiches_terrain ADD CONSTRAINT fiches_terrain_origine_check
  CHECK (origine IN ('preparation', 'generation', 'creation'));
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS trip_id uuid REFERENCES public.trips(id);
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS poste_id uuid REFERENCES public.postes(id);
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS stockage_id uuid REFERENCES public.stockages_carburant(id);
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS agent_profile_id uuid REFERENCES public.profiles(id);
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS periode_debut timestamptz;
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS periode_fin timestamptz;
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS brouillon jsonb;
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS brouillon_par uuid REFERENCES auth.users(id);
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS brouillon_le timestamptz;
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS nb_impressions integer NOT NULL DEFAULT 0;
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS imprime_le timestamptz;
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS etat_retour text;
ALTER TABLE public.fiches_terrain DROP CONSTRAINT IF EXISTS fiches_terrain_etat_retour_check;
ALTER TABLE public.fiches_terrain ADD CONSTRAINT fiches_terrain_etat_retour_check
  CHECK (etat_retour IS NULL OR etat_retour IN ('complete', 'incomplete', 'abimee'));
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS saisie_commencee_par uuid REFERENCES auth.users(id);
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS saisie_commencee_le timestamptz;
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS donnees_modifiees_le timestamptz;
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS controle_par uuid REFERENCES auth.users(id);
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS controle_le timestamptz;
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS controle_no integer NOT NULL DEFAULT 0;
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS nb_ecarts integer;
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS valide_par uuid REFERENCES auth.users(id);
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS valide_le timestamptz;
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS motif_validation text;
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS archive_par uuid REFERENCES auth.users(id);
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS archive_le timestamptz;
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS annule_par uuid REFERENCES auth.users(id);
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS annule_le timestamptz;

CREATE INDEX IF NOT EXISTS idx_fiches_terrain_etat ON public.fiches_terrain (etat, site_id);
CREATE INDEX IF NOT EXISTS idx_fiches_terrain_engin ON public.fiches_terrain (vehicle_id, date_fiche);
-- Doublons : une fiche active par type, engin, jour et shift pour les fiches
-- generees ou creees par le cycle (les fiches D-028 anterieures en sont
-- exclues : aucune n'est rejetee retroactivement).
CREATE UNIQUE INDEX IF NOT EXISTS ux_fiches_terrain_cycle_engin
  ON public.fiches_terrain (type, vehicle_id, date_fiche, coalesce(shift_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE etat <> 'annulee' AND origine IN ('generation', 'creation') AND vehicle_id IS NOT NULL;

-- Statut herite D-028 (cinq valeurs) recalcule depuis l'etat.
CREATE OR REPLACE FUNCTION public.fiche_statut_herite(p_etat text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_etat IN ('a_preparer', 'preparee', 'a_imprimer', 'imprimee', 'a_remettre') THEN 'preparee'
    WHEN p_etat IN ('remise_agent', 'en_utilisation') THEN 'remise'
    WHEN p_etat IN ('retournee', 'a_saisir', 'saisie_en_cours', 'a_corriger') THEN 'retournee'
    WHEN p_etat IN ('saisie_terminee', 'a_controler', 'validee', 'archivee') THEN 'saisie'
    WHEN p_etat = 'annulee' THEN 'annulee'
  END;
$$;

CREATE OR REPLACE FUNCTION public.transition_fiche_autorisee(p_de text, p_vers text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT (p_de, p_vers) IN (
    ('a_preparer', 'preparee'), ('a_preparer', 'annulee'),
    ('preparee', 'a_imprimer'), ('preparee', 'imprimee'), ('preparee', 'remise_agent'), ('preparee', 'annulee'),
    ('a_imprimer', 'imprimee'), ('a_imprimer', 'annulee'),
    ('imprimee', 'a_remettre'), ('imprimee', 'remise_agent'), ('imprimee', 'annulee'),
    ('a_remettre', 'remise_agent'), ('a_remettre', 'annulee'),
    ('remise_agent', 'en_utilisation'), ('remise_agent', 'retournee'), ('remise_agent', 'annulee'),
    ('en_utilisation', 'retournee'), ('en_utilisation', 'annulee'),
    ('retournee', 'a_saisir'), ('retournee', 'saisie_en_cours'), ('retournee', 'saisie_terminee'), ('retournee', 'annulee'),
    ('a_saisir', 'saisie_en_cours'), ('a_saisir', 'saisie_terminee'), ('a_saisir', 'annulee'),
    ('saisie_en_cours', 'saisie_terminee'), ('saisie_en_cours', 'annulee'),
    ('saisie_terminee', 'a_controler'), ('saisie_terminee', 'saisie_en_cours'), ('saisie_terminee', 'annulee'),
    ('a_controler', 'validee'), ('a_controler', 'a_corriger'),
    ('a_corriger', 'saisie_en_cours'), ('a_corriger', 'saisie_terminee'), ('a_corriger', 'annulee'),
    ('validee', 'archivee'));
$$;
REVOKE EXECUTE ON FUNCTION public.fiche_statut_herite(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.transition_fiche_autorisee(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fiche_statut_herite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_fiche_autorisee(text, text) TO authenticated;

-- Garde du cycle. Contexte interne sans JWT (migration, maintenance) : le
-- graphe s'applique, le drapeau et le gel non (meme regle que D-039, D-041).
CREATE OR REPLACE FUNCTION public.fiches_terrain_cycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_libres CONSTANT text[] := ARRAY['etat', 'statut', 'version', 'archive_par', 'archive_le', 'nb_impressions', 'imprime_le'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.etat := coalesce(NEW.etat, 'preparee');
    IF auth.uid() IS NOT NULL AND NEW.etat NOT IN ('a_preparer', 'preparee') THEN
      RAISE EXCEPTION 'Une fiche nait a preparer ou preparee' USING ERRCODE = '22023';
    END IF;
    NEW.statut := public.fiche_statut_herite(NEW.etat);
    NEW.version := 1;
    RETURN NEW;
  END IF;
  IF NEW.etat IS DISTINCT FROM OLD.etat THEN
    IF auth.uid() IS NOT NULL AND coalesce(current_setting('sigtb.transition_fiche', true), 'off') <> 'on' THEN
      RAISE EXCEPTION 'L''etat d''une fiche ne change que par les fonctions du cycle (D-089)' USING ERRCODE = '42501';
    END IF;
    IF NOT public.transition_fiche_autorisee(OLD.etat, NEW.etat) THEN
      RAISE EXCEPTION 'Transition de fiche non autorisee : % vers %', OLD.etat, NEW.etat USING ERRCODE = '22023';
    END IF;
  END IF;
  IF auth.uid() IS NOT NULL AND OLD.etat IN ('validee', 'archivee', 'annulee')
     AND ((to_jsonb(NEW) - v_libres) IS DISTINCT FROM (to_jsonb(OLD) - v_libres)
          OR (OLD.etat = 'annulee' AND NEW.nb_impressions IS DISTINCT FROM OLD.nb_impressions)) THEN
    RAISE EXCEPTION 'Fiche % %e : protegee, aucune modification (corriger par une nouvelle fiche ou un avoir)',
      OLD.numero, OLD.etat USING ERRCODE = '42501';
  END IF;
  NEW.statut := public.fiche_statut_herite(NEW.etat);
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fiches_terrain_cycle() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS fiches_terrain_cycle ON public.fiches_terrain;
CREATE TRIGGER fiches_terrain_cycle BEFORE INSERT OR UPDATE ON public.fiches_terrain
  FOR EACH ROW EXECUTE FUNCTION public.fiches_terrain_cycle();

-- ---------------------------------------------------------------------------
-- 2. Tables du cycle
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fiches_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiche_id uuid NOT NULL REFERENCES public.fiches_terrain(id) ON DELETE RESTRICT,
  action text NOT NULL,
  etat_avant text,
  etat_apres text,
  version integer,
  auteur uuid REFERENCES auth.users(id),
  survenu_le timestamptz NOT NULL DEFAULT clock_timestamp(),
  motif text,
  donnees jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_fiches_journal_fiche ON public.fiches_journal (fiche_id, survenu_le);

CREATE TABLE IF NOT EXISTS public.fiches_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  site_id uuid NOT NULL REFERENCES public.sites(id),
  date_operation date NOT NULL,
  agent text,
  agent_profile_id uuid REFERENCES public.profiles(id),
  note text,
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS lot_id uuid REFERENCES public.fiches_lots(id);

CREATE TABLE IF NOT EXISTS public.fiches_remises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  lot_id uuid REFERENCES public.fiches_lots(id),
  agent text NOT NULL CHECK (nullif(btrim(agent), '') IS NOT NULL),
  agent_profile_id uuid REFERENCES public.profiles(id),
  responsable uuid NOT NULL REFERENCES auth.users(id),
  remise_le timestamptz NOT NULL,
  nombre integer NOT NULL CHECK (nombre > 0),
  numeros jsonb NOT NULL CHECK (jsonb_typeof(numeros) = 'array'),
  fiche_ids uuid[] NOT NULL,
  confirmation text CHECK (confirmation IS NULL OR confirmation IN ('signature', 'compte')),
  confirme_par uuid REFERENCES auth.users(id),
  confirme_le timestamptz,
  observations text,
  origine text NOT NULL DEFAULT 'remise' CHECK (origine IN ('remise', 'suivre_fiche')),
  saisi_le timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_array_length(numeros) = nombre AND cardinality(fiche_ids) = nombre)
);
CREATE TABLE IF NOT EXISTS public.fiches_retours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  lot_id uuid REFERENCES public.fiches_lots(id),
  agent text,
  agent_profile_id uuid REFERENCES public.profiles(id),
  receptionnaire uuid NOT NULL REFERENCES auth.users(id),
  retour_le timestamptz NOT NULL,
  nombre_attendu integer NOT NULL CHECK (nombre_attendu > 0),
  nombre_recu integer NOT NULL CHECK (nombre_recu >= 0 AND nombre_recu <= nombre_attendu),
  details jsonb NOT NULL DEFAULT '[]'::jsonb,
  manquants jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(manquants) = 'array'),
  observations text,
  origine text NOT NULL DEFAULT 'retour' CHECK (origine IN ('retour', 'suivre_fiche', 'fin_saisie')),
  saisi_le timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS derniere_remise_id uuid REFERENCES public.fiches_remises(id);
ALTER TABLE public.fiches_terrain ADD COLUMN IF NOT EXISTS dernier_retour_id uuid REFERENCES public.fiches_retours(id);

CREATE TABLE IF NOT EXISTS public.fiches_rotations_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiche_id uuid NOT NULL REFERENCES public.fiches_terrain(id) ON DELETE RESTRICT,
  rang integer NOT NULL CHECK (rang > 0),
  trip_id uuid REFERENCES public.trips(id),
  driver_id uuid REFERENCES public.drivers(id),
  chargement_site_id uuid REFERENCES public.sites(id),
  destination_site_id uuid REFERENCES public.sites(id),
  depart_le timestamptz,
  arrivee_le timestamptz,
  etapes jsonb NOT NULL DEFAULT '[]'::jsonb,
  km_depart numeric CHECK (km_depart IS NULL OR km_depart >= 0),
  km_arrivee numeric CHECK (km_arrivee IS NULL OR km_arrivee >= 0),
  ticket_cbg text,
  observations text,
  incidents text,
  saisi_par uuid REFERENCES auth.users(id),
  saisi_le timestamptz NOT NULL DEFAULT now(),
  modifie_par uuid REFERENCES auth.users(id),
  modifie_le timestamptz,
  UNIQUE (fiche_id, rang),
  CHECK (km_arrivee IS NULL OR km_depart IS NULL OR km_arrivee >= km_depart),
  CHECK (arrivee_le IS NULL OR depart_le IS NULL OR arrivee_le >= depart_le)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_fiches_rotations_lignes_voyage
  ON public.fiches_rotations_lignes (fiche_id, trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fiches_rotations_lignes_voyage ON public.fiches_rotations_lignes (trip_id);

CREATE TABLE IF NOT EXISTS public.fiches_carburant_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiche_id uuid NOT NULL REFERENCES public.fiches_terrain(id) ON DELETE RESTRICT,
  rang integer NOT NULL CHECK (rang > 0),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id),
  driver_id uuid REFERENCES public.drivers(id),
  stockage_id uuid REFERENCES public.stockages_carburant(id),
  distribue_le timestamptz,
  litres numeric NOT NULL CHECK (litres > 0),
  index_pompe_debut numeric CHECK (index_pompe_debut IS NULL OR index_pompe_debut >= 0),
  index_pompe_fin numeric,
  agent_distributeur text,
  compteur_km numeric CHECK (compteur_km IS NULL OR compteur_km >= 0),
  horametre numeric CHECK (horametre IS NULL OR horametre >= 0),
  destinataire_confirme boolean NOT NULL DEFAULT false,
  destinataire_nom text,
  observations text,
  fuel_transaction_id uuid UNIQUE REFERENCES public.fuel_transactions(id),
  mouvement_id uuid UNIQUE REFERENCES public.mouvements_carburant(id),
  comptabilise_le timestamptz,
  origine text NOT NULL DEFAULT 'cycle' CHECK (origine IN ('cycle', 'saisir_carburant')),
  saisi_par uuid REFERENCES auth.users(id),
  saisi_le timestamptz NOT NULL DEFAULT now(),
  modifie_par uuid REFERENCES auth.users(id),
  modifie_le timestamptz,
  UNIQUE (fiche_id, rang),
  CHECK (index_pompe_fin IS NULL OR index_pompe_debut IS NULL OR index_pompe_fin >= index_pompe_debut),
  CHECK (mouvement_id IS NULL OR fuel_transaction_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.fiches_ecarts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiche_id uuid NOT NULL REFERENCES public.fiches_terrain(id) ON DELETE RESTRICT,
  controle_no integer NOT NULL CHECK (controle_no > 0),
  code text NOT NULL,
  gravite text NOT NULL CHECK (gravite IN ('info', 'alerte')),
  libelle text NOT NULL,
  objet text,
  attendu text,
  constate text,
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fiches_ecarts_fiche ON public.fiches_ecarts (fiche_id, controle_no);

ALTER TABLE public.pointages_engins ADD COLUMN IF NOT EXISTS heures_productives numeric;
ALTER TABLE public.pointages_engins ADD COLUMN IF NOT EXISTS periode_debut timestamptz;
ALTER TABLE public.pointages_engins ADD COLUMN IF NOT EXISTS periode_fin timestamptz;
ALTER TABLE public.pointages_engins ADD COLUMN IF NOT EXISTS arrets jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.pointages_engins ADD COLUMN IF NOT EXISTS heures_arret numeric;
ALTER TABLE public.pointages_engins ADD COLUMN IF NOT EXISTS agent text;
ALTER TABLE public.pointages_engins ADD COLUMN IF NOT EXISTS origine text NOT NULL DEFAULT 'saisir_pointage';
ALTER TABLE public.pointages_engins ADD COLUMN IF NOT EXISTS modifie_par uuid REFERENCES auth.users(id);
ALTER TABLE public.pointages_engins ADD COLUMN IF NOT EXISTS modifie_le timestamptz;
ALTER TABLE public.pointages_engins DROP CONSTRAINT IF EXISTS pointages_engins_productives_check;
ALTER TABLE public.pointages_engins ADD CONSTRAINT pointages_engins_productives_check
  CHECK (heures_productives IS NULL OR (heures_productives >= 0 AND heures_productives <= index_fin - index_debut));
ALTER TABLE public.pointages_engins DROP CONSTRAINT IF EXISTS pointages_engins_periode_check;
ALTER TABLE public.pointages_engins ADD CONSTRAINT pointages_engins_periode_check
  CHECK (periode_fin IS NULL OR periode_debut IS NULL OR periode_fin > periode_debut);
ALTER TABLE public.pointages_engins DROP CONSTRAINT IF EXISTS pointages_engins_origine_check;
ALTER TABLE public.pointages_engins ADD CONSTRAINT pointages_engins_origine_check
  CHECK (origine IN ('saisir_pointage', 'cycle'));

-- RLS : lecture selon le module et le perimetre de la fiche ; aucune
-- ecriture directe (fonctions du cycle).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fiches_journal', 'fiches_lots', 'fiches_remises', 'fiches_retours',
                           'fiches_rotations_lignes', 'fiches_carburant_lignes', 'fiches_ecarts'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS lecture_module ON public.%I', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['fiches_lots', 'fiches_remises', 'fiches_retours'] LOOP
    EXECUTE format('CREATE POLICY lecture_module ON public.%I FOR SELECT TO authenticated
      USING ((public.has_module_view(''trips'') OR public.has_module_view(''maintenance'')
              OR public.has_module_view(''fuel'') OR public.is_admin()) AND public.site_permis(site_id))', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['fiches_journal', 'fiches_ecarts', 'fiches_rotations_lignes', 'fiches_carburant_lignes'] LOOP
    EXECUTE format('CREATE POLICY lecture_module ON public.%I FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.fiches_terrain f WHERE f.id = fiche_id))', t);
  END LOOP;
END $$;

-- Append-only : journal, ecarts, retours ; remises : seule la confirmation,
-- une fois. Contexte interne sans JWT (purge de demonstration) : passe.
CREATE OR REPLACE FUNCTION public.garde_append_only_fiches()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'fiches_remises' THEN
    IF (to_jsonb(OLD) ->> 'confirmation') IS NULL
       AND (to_jsonb(NEW) - ARRAY['confirmation', 'confirme_par', 'confirme_le'])
           = (to_jsonb(OLD) - ARRAY['confirmation', 'confirme_par', 'confirme_le']) THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'Trace append-only (%) : aucune modification ni suppression (D-089)', TG_TABLE_NAME USING ERRCODE = '42501';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.garde_append_only_fiches() FROM PUBLIC, anon, authenticated;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fiches_journal', 'fiches_ecarts', 'fiches_retours', 'fiches_remises'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS garde_append_only ON public.%I', t);
    EXECUTE format('CREATE TRIGGER garde_append_only BEFORE UPDATE OR DELETE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.garde_append_only_fiches()', t);
  END LOOP;
END $$;

-- Lignes d'une fiche validee, archivee ou annulee : figees. Ligne carburant
-- comptabilisee : figee. Aucune suppression de ligne.
CREATE OR REPLACE FUNCTION public.garde_lignes_fiche()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE v_etat text; v_numero text;
BEGIN
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Une ligne de fiche ne se supprime pas : la corriger (trace)' USING ERRCODE = '42501';
  END IF;
  SELECT f.etat, f.numero INTO v_etat, v_numero FROM public.fiches_terrain f WHERE f.id = NEW.fiche_id;
  IF v_etat IN ('validee', 'archivee', 'annulee') THEN
    RAISE EXCEPTION 'Fiche % %e : ses lignes sont figees', v_numero, v_etat USING ERRCODE = '42501';
  END IF;
  -- Branches separees : OLD.fuel_transaction_id n'existe que sur les lignes FC.
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'fiches_carburant_lignes' THEN
    IF (to_jsonb(OLD) ->> 'fuel_transaction_id') IS NOT NULL THEN
      RAISE EXCEPTION 'Ligne carburant comptabilisee au registre : corriger par annulation du mouvement' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.fiche_id IS DISTINCT FROM OLD.fiche_id) THEN
    RAISE EXCEPTION 'Une ligne ne change pas de fiche' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.garde_lignes_fiche() FROM PUBLIC, anon, authenticated;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pointages_engins', 'fiches_rotations_lignes', 'fiches_carburant_lignes'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS garde_lignes_fiche ON public.%I', t);
    EXECUTE format('CREATE TRIGGER garde_lignes_fiche BEFORE INSERT OR UPDATE OR DELETE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.garde_lignes_fiche()', t);
  END LOOP;
END $$;

-- Creation journalisee quelle que soit la voie (preparer_fiche D-028 compris).
CREATE OR REPLACE FUNCTION public.fiches_terrain_creation_journal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.fiches_journal (fiche_id, action, etat_avant, etat_apres, version, auteur, donnees)
  VALUES (NEW.id, 'creation', NULL, NEW.etat, NEW.version, auth.uid(),
          jsonb_build_object('numero', NEW.numero, 'type', NEW.type, 'origine', NEW.origine, 'date_operation', NEW.date_fiche));
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fiches_terrain_creation_journal() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS fiches_terrain_creation_journal ON public.fiches_terrain;
CREATE TRIGGER fiches_terrain_creation_journal AFTER INSERT ON public.fiches_terrain
  FOR EACH ROW EXECUTE FUNCTION public.fiches_terrain_creation_journal();

-- ---------------------------------------------------------------------------
-- 3. Assistants internes (non executables par les comptes)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fiche_journaliser(p_fiche uuid, p_action text, p_etat_avant text,
  p_motif text DEFAULT NULL, p_donnees jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.fiches_journal (fiche_id, action, etat_avant, etat_apres, version, auteur, motif, donnees)
  SELECT f.id, p_action, p_etat_avant, f.etat, f.version, auth.uid(), nullif(btrim(coalesce(p_motif, '')), ''),
         coalesce(p_donnees, '{}'::jsonb)
    FROM public.fiches_terrain f WHERE f.id = p_fiche;
END;
$$;

-- Verrou, droit du module du type, perimetre, controle de version.
CREATE OR REPLACE FUNCTION public.fiche_verrou(p_id uuid, p_type text DEFAULT NULL, p_version integer DEFAULT NULL)
RETURNS public.fiches_terrain
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE f public.fiches_terrain;
BEGIN
  SELECT * INTO f FROM public.fiches_terrain WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fiche introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF p_type IS NOT NULL AND f.type <> p_type THEN
    RAISE EXCEPTION 'Cette fiche n''est pas une fiche de ce type' USING ERRCODE = '22023';
  END IF;
  IF NOT public.has_module_write(public.fiche_module(f.type)) THEN
    RAISE EXCEPTION 'Droit d''ecriture requis pour ce type de fiche' USING ERRCODE = '42501';
  END IF;
  IF NOT public.site_permis(f.site_id) THEN
    RAISE EXCEPTION 'Hors perimetre : fiche d''un autre site' USING ERRCODE = '42501';
  END IF;
  IF p_version IS NOT NULL AND p_version <> f.version THEN
    RAISE EXCEPTION 'Fiche % modifiee entre-temps (version % attendue, % en base) : recharger', f.numero, p_version, f.version
      USING ERRCODE = '40001';
  END IF;
  RETURN f;
END;
$$;

-- Transition controlee et journalisee.
CREATE OR REPLACE FUNCTION public.fiche_passer(p_id uuid, p_vers text, p_action text,
  p_motif text DEFAULT NULL, p_donnees jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE v_avant text;
BEGIN
  SELECT etat INTO v_avant FROM public.fiches_terrain WHERE id = p_id FOR UPDATE;
  IF NOT public.transition_fiche_autorisee(v_avant, p_vers) THEN
    RAISE EXCEPTION 'Transition de fiche non autorisee : % vers %', v_avant, p_vers USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('sigtb.transition_fiche', 'on', true);
  UPDATE public.fiches_terrain SET etat = p_vers WHERE id = p_id;
  PERFORM set_config('sigtb.transition_fiche', 'off', true);
  PERFORM public.fiche_journaliser(p_id, p_action, v_avant, p_motif, p_donnees);
END;
$$;

-- Saisie : une fiche retournee, a saisir ou a corriger passe en saisie ;
-- une fiche remise passe en utilisation (donnee arrivee du terrain, D-078 :
-- ticket CBG integre au depot) ; avant la remise, saisie anticipee D-028.
CREATE OR REPLACE FUNCTION public.fiche_marquer_saisie(p_id uuid, p_operation text, p_donnees jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE v_etat text; v_action text := 'saisie';
BEGIN
  SELECT etat INTO v_etat FROM public.fiches_terrain WHERE id = p_id FOR UPDATE;
  IF v_etat IN ('retournee', 'a_saisir', 'a_corriger') THEN
    PERFORM public.fiche_passer(p_id, 'saisie_en_cours', 'debut_saisie');
  ELSIF v_etat = 'remise_agent' THEN
    PERFORM public.fiche_passer(p_id, 'en_utilisation', 'utilisation');
    v_action := 'saisie_anticipee';
  ELSIF v_etat IN ('a_preparer', 'preparee', 'a_imprimer', 'imprimee', 'a_remettre', 'en_utilisation') THEN
    v_action := 'saisie_anticipee';
  ELSIF v_etat <> 'saisie_en_cours' THEN
    RAISE EXCEPTION 'Saisie impossible sur une fiche a l''etat %', v_etat USING ERRCODE = '22023';
  END IF;
  UPDATE public.fiches_terrain
     SET donnees_modifiees_le = clock_timestamp(),
         saisie_commencee_par = coalesce(saisie_commencee_par, auth.uid()),
         saisie_commencee_le = coalesce(saisie_commencee_le, clock_timestamp())
   WHERE id = p_id;
  PERFORM public.fiche_journaliser(p_id, v_action, v_etat, NULL,
    coalesce(p_donnees, '{}'::jsonb) || jsonb_build_object('operation', p_operation));
END;
$$;

-- Fiche ouverte a la saisie du cycle : retour enregistre.
CREATE OR REPLACE FUNCTION public.fiche_saisissable(p_id uuid, p_type text)
RETURNS public.fiches_terrain
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE f public.fiches_terrain := public.fiche_verrou(p_id, p_type, NULL);
BEGIN
  IF f.etat NOT IN ('retournee', 'a_saisir', 'saisie_en_cours', 'a_corriger') THEN
    RAISE EXCEPTION 'Fiche % a l''etat % : la saisie se fait au retour de la fiche (ou apres renvoi pour correction)',
      f.numero, f.etat USING ERRCODE = '22023';
  END IF;
  RETURN f;
END;
$$;

CREATE OR REPLACE FUNCTION public.fiche_numero_suivant(p_type text, p_date date)
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE v_prefixe text; v_suite integer;
BEGIN
  v_prefixe := CASE p_type WHEN 'rotations' THEN 'FR' WHEN 'pointage_engins' THEN 'FP' ELSE 'FC' END
               || '-' || to_char(p_date, 'YYMMDD') || '-';
  PERFORM pg_advisory_xact_lock(hashtext('sigtb.fiche.' || v_prefixe));
  SELECT coalesce(max(substring(numero FROM '-(\d+)$')::int), 0) + 1 INTO v_suite
    FROM public.fiches_terrain WHERE numero LIKE v_prefixe || '%';
  RETURN v_prefixe || lpad(v_suite::text, 3, '0');
END;
$$;

-- Agent attendu : par compte si les deux sont connus, sinon par nom.
CREATE OR REPLACE FUNCTION public.fiche_agent_conforme(p_agent_fiche text, p_profil_fiche uuid, p_agent text, p_profil uuid)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_profil_fiche IS NOT NULL AND p_profil IS NOT NULL THEN p_profil_fiche = p_profil
    WHEN nullif(btrim(coalesce(p_agent_fiche, '')), '') IS NULL OR nullif(btrim(coalesce(p_agent, '')), '') IS NULL THEN true
    ELSE lower(btrim(p_agent_fiche)) = lower(btrim(p_agent))
  END;
$$;

DO $$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY[
    'public.fiche_journaliser(uuid, text, text, text, jsonb)',
    'public.fiche_verrou(uuid, text, integer)',
    'public.fiche_passer(uuid, text, text, text, jsonb)',
    'public.fiche_marquer_saisie(uuid, text, jsonb)',
    'public.fiche_saisissable(uuid, text)',
    'public.fiche_numero_suivant(text, date)',
    'public.fiche_agent_conforme(text, uuid, text, uuid)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', s);
  END LOOP;
END $$;

-- fiche_ouverte (reprise de 20261120100000) : ferme des saisie_terminee.
CREATE OR REPLACE FUNCTION public.fiche_ouverte(p_id uuid, p_type text)
RETURNS public.fiches_terrain
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  f public.fiches_terrain := public.fiche_verrou(p_id, p_type, NULL);
BEGIN
  IF f.etat IN ('saisie_terminee', 'a_controler', 'validee', 'archivee', 'annulee') THEN
    RAISE EXCEPTION 'Fiche % close (%)', f.numero, f.etat USING ERRCODE = '22023';
  END IF;
  RETURN f;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fiche_ouverte(uuid, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Preparation : generation depuis le Dispatch, creation, contenu
-- ---------------------------------------------------------------------------
-- Une fiche FR par camion et par periode (regle camion_shift : par shift du
-- voyage ; camion_jour : par jour), depuis les voyages du Dispatch partant du
-- site. Idempotente : une fiche active existante est rendue, jamais doublee.
CREATE OR REPLACE FUNCTION public.generer_fiches_rotation(
  p_date date, p_site_id uuid, p_shift_id uuid DEFAULT NULL, p_regle text DEFAULT 'camion_shift', p_agent text DEFAULT NULL
)
RETURNS TABLE (fiche_id uuid, numero text, vehicle_id uuid, shift_id uuid, creee boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  g record; v_id uuid; v_numero text; v_poste uuid; v_shift uuid;
BEGIN
  IF NOT public.has_module_write('trips') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les voyages requis' USING ERRCODE = '42501';
  END IF;
  IF p_date IS NULL OR p_site_id IS NULL THEN
    RAISE EXCEPTION 'Date et site requis' USING ERRCODE = '22023';
  END IF;
  IF NOT public.site_permis(p_site_id) THEN
    RAISE EXCEPTION 'Hors perimetre : site non autorise' USING ERRCODE = '42501';
  END IF;
  IF p_regle NOT IN ('camion_shift', 'camion_jour') THEN
    RAISE EXCEPTION 'Regle de preparation inconnue : % (camion_shift ou camion_jour)', p_regle USING ERRCODE = '22023';
  END IF;

  FOR g IN
    SELECT t.vehicle_id AS camion,
           CASE WHEN p_regle = 'camion_shift' THEN t.shift_id END AS shift,
           (array_agg(t.driver_id ORDER BY t.shift_sequence NULLS LAST, t.reference) FILTER (WHERE t.driver_id IS NOT NULL))[1] AS chauffeur,
           count(DISTINCT t.driver_id) AS nb_chauffeurs,
           array_agg(t.id ORDER BY t.shift_sequence NULLS LAST, t.reference) AS voyages,
           jsonb_agg(jsonb_build_object('trip_id', t.id, 'reference', t.reference, 'etat', t.etat,
             'depart_site_id', t.departure_site_id, 'arrivee_site_id', t.arrival_site_id,
             'driver_id', t.driver_id, 'shift_id', t.shift_id, 'sequence', t.shift_sequence)
             ORDER BY t.shift_sequence NULLS LAST, t.reference) AS contenu
      FROM public.trips t
     WHERE t.planned_date = p_date AND t.departure_site_id = p_site_id AND t.vehicle_id IS NOT NULL
       AND t.etat <> 'CANCELLED' AND (p_shift_id IS NULL OR t.shift_id = p_shift_id)
     GROUP BY 1, 2
     ORDER BY 1, 2
  LOOP
    v_shift := coalesce(g.shift, CASE WHEN p_regle = 'camion_shift' THEN p_shift_id END);
    SELECT f.id, f.numero INTO v_id, v_numero FROM public.fiches_terrain f
     WHERE f.type = 'rotations' AND f.vehicle_id = g.camion AND f.date_fiche = p_date AND f.etat <> 'annulee'
       AND (f.shift_id IS NULL OR v_shift IS NULL OR f.shift_id = v_shift)
     ORDER BY f.numero LIMIT 1;
    IF FOUND THEN
      fiche_id := v_id; numero := v_numero; vehicle_id := g.camion; shift_id := v_shift; creee := false;
      RETURN NEXT;
      CONTINUE;
    END IF;
    SELECT p.id INTO v_poste FROM public.postes p
     WHERE p.date_poste = p_date AND p.site_id = p_site_id AND p.shift_id = v_shift;
    v_numero := public.fiche_numero_suivant('rotations', p_date);
    INSERT INTO public.fiches_terrain (numero, type, date_fiche, site_id, shift_id, poste_id, vehicle_id, driver_id,
      trip_id, agent, options, contenu, prepare_par, origine, etat)
    VALUES (v_numero, 'rotations', p_date, p_site_id, v_shift, v_poste, g.camion, g.chauffeur,
      CASE WHEN cardinality(g.voyages) = 1 THEN g.voyages[1] END,
      nullif(btrim(coalesce(p_agent, '')), ''),
      jsonb_build_object('pesee', 'arrivee', 'regle', p_regle, 'chauffeurs_distincts', g.nb_chauffeurs),
      g.contenu, auth.uid(), 'generation', 'preparee')
    RETURNING id INTO v_id;
    fiche_id := v_id; numero := v_numero; vehicle_id := g.camion; shift_id := v_shift; creee := true;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Creation unitaire (FR, FP, FC) avec prevention des doublons et
-- preremplissage des donnees connues (FP : dernier index d'horametre).
CREATE OR REPLACE FUNCTION public.creer_fiche(
  p_type text, p_date date, p_site_id uuid, p_shift_id uuid DEFAULT NULL, p_vehicle_id uuid DEFAULT NULL,
  p_driver_id uuid DEFAULT NULL, p_stockage_id uuid DEFAULT NULL, p_poste_id uuid DEFAULT NULL,
  p_trip_id uuid DEFAULT NULL, p_agent text DEFAULT NULL, p_options jsonb DEFAULT '{}'::jsonb,
  p_contenu jsonb DEFAULT NULL, p_a_preparer boolean DEFAULT false,
  p_periode_debut timestamptz DEFAULT NULL, p_periode_fin timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid; v_existe text; t public.trips; p public.postes; s public.stockages_carburant;
  v_contenu jsonb := p_contenu; v_options jsonb := coalesce(p_options, '{}'::jsonb); v_index numeric;
BEGIN
  IF p_type NOT IN ('rotations', 'pointage_engins', 'carburant') THEN
    RAISE EXCEPTION 'Type de fiche inconnu : %', p_type USING ERRCODE = '22023';
  END IF;
  IF NOT public.has_module_write(public.fiche_module(p_type)) THEN
    RAISE EXCEPTION 'Droit d''ecriture requis pour ce type de fiche' USING ERRCODE = '42501';
  END IF;
  IF p_date IS NULL OR p_site_id IS NULL THEN
    RAISE EXCEPTION 'Date d''operation et site requis' USING ERRCODE = '22023';
  END IF;
  IF NOT public.site_permis(p_site_id) THEN
    RAISE EXCEPTION 'Hors perimetre : site non autorise' USING ERRCODE = '42501';
  END IF;
  IF p_type = 'rotations' AND p_vehicle_id IS NULL THEN
    RAISE EXCEPTION 'Une fiche de rotations porte sur un camion' USING ERRCODE = '22023';
  END IF;
  IF p_periode_fin IS NOT NULL AND p_periode_debut IS NOT NULL AND p_periode_fin <= p_periode_debut THEN
    RAISE EXCEPTION 'Periode incoherente (fin avant le debut)' USING ERRCODE = '22023';
  END IF;
  IF p_vehicle_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = p_vehicle_id) THEN
    RAISE EXCEPTION 'Engin introuvable' USING ERRCODE = '22023';
  END IF;
  IF p_vehicle_id IS NOT NULL AND NOT public.vehicule_permis(p_vehicle_id) THEN
    RAISE EXCEPTION 'Hors perimetre : engin d''un autre site' USING ERRCODE = '42501';
  END IF;
  IF p_trip_id IS NOT NULL THEN
    SELECT * INTO t FROM public.trips WHERE id = p_trip_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Voyage introuvable' USING ERRCODE = '22023'; END IF;
    IF t.vehicle_id IS DISTINCT FROM p_vehicle_id THEN
      RAISE EXCEPTION 'Mauvais engin : le voyage % est affecte a un autre camion', t.reference USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_poste_id IS NOT NULL THEN
    SELECT * INTO p FROM public.postes WHERE id = p_poste_id;
    IF NOT FOUND OR p.site_id <> p_site_id OR p.date_poste <> p_date THEN
      RAISE EXCEPTION 'Poste introuvable ou d''un autre site ou d''une autre date' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_stockage_id IS NOT NULL THEN
    s := public.stockage_ecrivable(p_stockage_id);
    IF s.site_id <> p_site_id THEN
      RAISE EXCEPTION 'Cuve % hors du site de la fiche', s.code USING ERRCODE = '22023';
    END IF;
  END IF;
  -- Doublon : meme type, meme engin (ou cuve), meme jour, shift recouvrant.
  SELECT f.numero INTO v_existe FROM public.fiches_terrain f
   WHERE f.type = p_type AND f.date_fiche = p_date AND f.etat <> 'annulee'
     AND ((p_vehicle_id IS NOT NULL AND f.vehicle_id = p_vehicle_id)
          OR (p_type = 'carburant' AND p_vehicle_id IS NULL AND p_stockage_id IS NOT NULL AND f.stockage_id = p_stockage_id))
     AND (f.shift_id IS NULL OR p_shift_id IS NULL OR f.shift_id = p_shift_id)
   LIMIT 1;
  IF v_existe IS NOT NULL THEN
    RAISE EXCEPTION 'Doublon : la fiche % couvre deja cet engin ou cette cuve pour cette date', v_existe USING ERRCODE = '23505';
  END IF;
  IF p_type = 'rotations' THEN
    v_options := v_options || jsonb_build_object('pesee', 'arrivee');
  END IF;
  IF v_contenu IS NULL AND p_type = 'pointage_engins' AND p_vehicle_id IS NOT NULL THEN
    SELECT pe.index_fin INTO v_index FROM public.pointages_engins pe JOIN public.fiches_terrain fi ON fi.id = pe.fiche_id
     WHERE pe.vehicle_id = p_vehicle_id AND fi.etat <> 'annulee' AND fi.date_fiche <= p_date
     ORDER BY fi.date_fiche DESC, pe.saisi_le DESC LIMIT 1;
    v_contenu := jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('vehicle_id', p_vehicle_id, 'index_debut_connu', v_index)));
  END IF;
  INSERT INTO public.fiches_terrain (numero, type, date_fiche, site_id, shift_id, poste_id, vehicle_id, driver_id, trip_id,
    stockage_id, agent, options, contenu, prepare_par, origine, etat, periode_debut, periode_fin)
  VALUES (public.fiche_numero_suivant(p_type, p_date), p_type, p_date, p_site_id, p_shift_id, p_poste_id, p_vehicle_id,
    p_driver_id, p_trip_id, p_stockage_id, nullif(btrim(coalesce(p_agent, '')), ''), v_options,
    coalesce(v_contenu, '[]'::jsonb), auth.uid(), 'creation', CASE WHEN p_a_preparer THEN 'a_preparer' ELSE 'preparee' END,
    p_periode_debut, p_periode_fin)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.preparer_contenu_fiche(p_id uuid, p_contenu jsonb, p_version integer DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE f public.fiches_terrain := public.fiche_verrou(p_id, NULL, p_version);
BEGIN
  IF f.etat <> 'a_preparer' THEN
    RAISE EXCEPTION 'Fiche % deja preparee (%)', f.numero, f.etat USING ERRCODE = '22023';
  END IF;
  IF p_contenu IS NULL OR jsonb_typeof(p_contenu) <> 'array' THEN
    RAISE EXCEPTION 'Contenu prevu attendu sous forme de liste' USING ERRCODE = '22023';
  END IF;
  UPDATE public.fiches_terrain SET contenu = p_contenu WHERE id = p_id;
  PERFORM public.fiche_passer(p_id, 'preparee', 'preparation');
END;
$$;

-- Transitions sans donnee propre. Les autres passent par leur fonction.
CREATE OR REPLACE FUNCTION public.changer_etat_fiche(p_id uuid, p_vers text, p_motif text DEFAULT NULL, p_version integer DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE f public.fiches_terrain := public.fiche_verrou(p_id, NULL, p_version);
BEGIN
  IF (f.etat, p_vers) NOT IN (('preparee', 'a_imprimer'), ('imprimee', 'a_remettre'), ('remise_agent', 'en_utilisation'),
                               ('retournee', 'a_saisir'), ('saisie_terminee', 'saisie_en_cours'), ('a_corriger', 'saisie_en_cours')) THEN
    RAISE EXCEPTION 'Passage % vers % : utiliser la fonction dediee du cycle ou transition interdite', f.etat, p_vers
      USING ERRCODE = '22023';
  END IF;
  IF f.etat = 'saisie_terminee' AND nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motif obligatoire pour rouvrir une saisie terminee' USING ERRCODE = '22023';
  END IF;
  PERFORM public.fiche_passer(p_id, p_vers, 'changement_etat', p_motif);
  RETURN p_vers;
END;
$$;

-- Impression : la premiere fait passer la fiche a imprimee ; une
-- reimpression est tracee avec son motif, sans changement d'etat ni
-- operation metier (fiche validee comprise).
CREATE OR REPLACE FUNCTION public.enregistrer_impression_fiches(p_ids uuid[], p_motif text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid; f public.fiches_terrain; n integer := 0;
BEGIN
  IF p_ids IS NULL OR cardinality(p_ids) = 0 THEN
    RAISE EXCEPTION 'Aucune fiche a imprimer' USING ERRCODE = '22023';
  END IF;
  FOREACH v_id IN ARRAY p_ids LOOP
    f := public.fiche_verrou(v_id, NULL, NULL);
    IF f.etat IN ('annulee', 'a_preparer') THEN
      RAISE EXCEPTION 'Fiche % % : impression impossible', f.numero, f.etat USING ERRCODE = '22023';
    END IF;
    IF f.nb_impressions > 0 AND nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Reimpression de la fiche % : motif obligatoire', f.numero USING ERRCODE = '22023';
    END IF;
    UPDATE public.fiches_terrain SET nb_impressions = nb_impressions + 1, imprime_le = now() WHERE id = v_id;
    IF f.nb_impressions = 0 AND f.etat IN ('preparee', 'a_imprimer') THEN
      PERFORM public.fiche_passer(v_id, 'imprimee', 'impression');
    ELSE
      PERFORM public.fiche_journaliser(v_id, CASE WHEN f.nb_impressions = 0 THEN 'impression' ELSE 'reimpression' END,
        f.etat, p_motif, jsonb_build_object('exemplaire', f.nb_impressions + 1));
    END IF;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Lots, attribution, remise, retour
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.attribuer_fiches(p_ids uuid[], p_agent text, p_agent_profile_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid; f public.fiches_terrain; n integer := 0; v_agent text := nullif(btrim(coalesce(p_agent, '')), '');
BEGIN
  IF v_agent IS NULL AND p_agent_profile_id IS NOT NULL THEN
    SELECT nullif(btrim(coalesce(full_name, '')), '') INTO v_agent FROM public.profiles WHERE id = p_agent_profile_id;
  END IF;
  IF v_agent IS NULL THEN
    RAISE EXCEPTION 'Agent requis (nom ou compte)' USING ERRCODE = '22023';
  END IF;
  FOREACH v_id IN ARRAY coalesce(p_ids, '{}'::uuid[]) LOOP
    f := public.fiche_verrou(v_id, NULL, NULL);
    IF f.etat NOT IN ('a_preparer', 'preparee', 'a_imprimer', 'imprimee', 'a_remettre') THEN
      RAISE EXCEPTION 'Fiche % deja remise (%) : attribution figee', f.numero, f.etat USING ERRCODE = '22023';
    END IF;
    UPDATE public.fiches_terrain SET agent = v_agent, agent_profile_id = p_agent_profile_id WHERE id = v_id;
    PERFORM public.fiche_journaliser(v_id, 'attribution', f.etat, NULL,
      jsonb_build_object('agent_avant', f.agent, 'agent', v_agent, 'agent_profile_id', p_agent_profile_id));
    n := n + 1;
  END LOOP;
  IF n = 0 THEN RAISE EXCEPTION 'Aucune fiche a attribuer' USING ERRCODE = '22023'; END IF;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.creer_lot_fiches(p_ids uuid[], p_agent text DEFAULT NULL,
  p_agent_profile_id uuid DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid; f public.fiches_terrain; v_site uuid; v_date date; v_lot uuid; v_prefixe text; v_suite integer;
BEGIN
  IF p_ids IS NULL OR cardinality(p_ids) = 0 THEN
    RAISE EXCEPTION 'Un lot regroupe au moins une fiche' USING ERRCODE = '22023';
  END IF;
  FOREACH v_id IN ARRAY p_ids LOOP
    f := public.fiche_verrou(v_id, NULL, NULL);
    IF v_site IS NULL THEN v_site := f.site_id; v_date := f.date_fiche; END IF;
    IF f.site_id <> v_site THEN
      RAISE EXCEPTION 'Un lot ne regroupe que des fiches d''un meme site' USING ERRCODE = '22023';
    END IF;
    IF f.etat NOT IN ('a_preparer', 'preparee', 'a_imprimer', 'imprimee', 'a_remettre') THEN
      RAISE EXCEPTION 'Fiche % deja remise (%)', f.numero, f.etat USING ERRCODE = '22023';
    END IF;
    IF f.lot_id IS NOT NULL THEN
      RAISE EXCEPTION 'Fiche % deja dans un lot', f.numero USING ERRCODE = '23505';
    END IF;
  END LOOP;
  v_prefixe := 'LF-' || to_char(v_date, 'YYMMDD') || '-';
  PERFORM pg_advisory_xact_lock(hashtext('sigtb.lot.' || v_prefixe));
  SELECT coalesce(max(substring(numero FROM '-(\d+)$')::int), 0) + 1 INTO v_suite
    FROM public.fiches_lots WHERE numero LIKE v_prefixe || '%';
  INSERT INTO public.fiches_lots (numero, site_id, date_operation, agent, agent_profile_id, note, cree_par)
  VALUES (v_prefixe || lpad(v_suite::text, 3, '0'), v_site, v_date, nullif(btrim(coalesce(p_agent, '')), ''),
          p_agent_profile_id, nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  RETURNING id INTO v_lot;
  UPDATE public.fiches_terrain SET lot_id = v_lot WHERE id = ANY (p_ids);
  FOREACH v_id IN ARRAY p_ids LOOP
    PERFORM public.fiche_journaliser(v_id, 'mise_en_lot', NULL, NULL, jsonb_build_object('lot_id', v_lot));
  END LOOP;
  IF nullif(btrim(coalesce(p_agent, '')), '') IS NOT NULL OR p_agent_profile_id IS NOT NULL THEN
    PERFORM public.attribuer_fiches(p_ids, p_agent, p_agent_profile_id);
  END IF;
  RETURN v_lot;
END;
$$;

-- Remise : fiches imprimees, meme site, agent attendu.
CREATE OR REPLACE FUNCTION public.remettre_fiches(
  p_ids uuid[], p_agent text, p_agent_profile_id uuid DEFAULT NULL, p_remise_le timestamptz DEFAULT now(),
  p_lot_id uuid DEFAULT NULL, p_observations text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ids uuid[] := p_ids; v_id uuid; f public.fiches_terrain; v_site uuid; v_numeros jsonb := '[]'::jsonb;
  v_remise uuid; v_agent text := nullif(btrim(coalesce(p_agent, '')), '');
BEGIN
  IF (v_ids IS NULL OR cardinality(v_ids) = 0) AND p_lot_id IS NOT NULL THEN
    SELECT array_agg(id ORDER BY numero) INTO v_ids FROM public.fiches_terrain
     WHERE lot_id = p_lot_id AND etat IN ('imprimee', 'a_remettre');
  END IF;
  IF v_ids IS NULL OR cardinality(v_ids) = 0 THEN
    RAISE EXCEPTION 'Aucune fiche a remettre' USING ERRCODE = '22023';
  END IF;
  IF v_agent IS NULL AND p_agent_profile_id IS NOT NULL THEN
    SELECT nullif(btrim(coalesce(full_name, '')), '') INTO v_agent FROM public.profiles WHERE id = p_agent_profile_id;
  END IF;
  IF v_agent IS NULL THEN
    RAISE EXCEPTION 'Nom de l''agent qui recoit les fiches requis' USING ERRCODE = '22023';
  END IF;
  IF p_remise_le IS NULL OR p_remise_le > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Heure de remise absente ou dans le futur' USING ERRCODE = '22023';
  END IF;
  FOREACH v_id IN ARRAY v_ids LOOP
    f := public.fiche_verrou(v_id, NULL, NULL);
    IF v_site IS NULL THEN v_site := f.site_id; END IF;
    IF f.site_id <> v_site THEN
      RAISE EXCEPTION 'Une remise ne porte que sur des fiches d''un meme site' USING ERRCODE = '22023';
    END IF;
    IF f.etat NOT IN ('imprimee', 'a_remettre') THEN
      RAISE EXCEPTION 'Fiche % a l''etat % : seule une fiche imprimee se remet', f.numero, f.etat USING ERRCODE = '22023';
    END IF;
    IF NOT public.fiche_agent_conforme(f.agent, f.agent_profile_id, v_agent, p_agent_profile_id) THEN
      RAISE EXCEPTION 'Mauvais agent : la fiche % est attribuee a %', f.numero, f.agent USING ERRCODE = '22023';
    END IF;
    IF p_lot_id IS NOT NULL AND f.lot_id IS DISTINCT FROM p_lot_id THEN
      RAISE EXCEPTION 'Fiche % hors du lot remis', f.numero USING ERRCODE = '22023';
    END IF;
    v_numeros := v_numeros || to_jsonb(f.numero);
  END LOOP;
  INSERT INTO public.fiches_remises (site_id, lot_id, agent, agent_profile_id, responsable, remise_le, nombre, numeros,
    fiche_ids, observations)
  VALUES (v_site, p_lot_id, v_agent, p_agent_profile_id, auth.uid(), p_remise_le, cardinality(v_ids), v_numeros, v_ids,
    nullif(btrim(coalesce(p_observations, '')), ''))
  RETURNING id INTO v_remise;
  FOREACH v_id IN ARRAY v_ids LOOP
    UPDATE public.fiches_terrain SET agent = v_agent, agent_profile_id = coalesce(p_agent_profile_id, agent_profile_id),
           remise_le = p_remise_le, derniere_remise_id = v_remise WHERE id = v_id;
    PERFORM public.fiche_passer(v_id, 'remise_agent', 'remise', NULL, jsonb_build_object('remise_id', v_remise, 'agent', v_agent));
  END LOOP;
  RETURN v_remise;
END;
$$;

-- Confirmation de la remise : signature papier relevee par le responsable,
-- ou confirmation par l'agent depuis son propre compte. Une seule fois.
CREATE OR REPLACE FUNCTION public.confirmer_remise(p_remise_id uuid, p_mode text DEFAULT 'signature')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE r public.fiches_remises; v_id uuid;
BEGIN
  SELECT * INTO r FROM public.fiches_remises WHERE id = p_remise_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Remise introuvable' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.site_permis(r.site_id) THEN
    RAISE EXCEPTION 'Hors perimetre : remise d''un autre site' USING ERRCODE = '42501';
  END IF;
  IF p_mode NOT IN ('signature', 'compte') THEN
    RAISE EXCEPTION 'Mode de confirmation inconnu (signature ou compte)' USING ERRCODE = '22023';
  END IF;
  IF p_mode = 'compte' AND (r.agent_profile_id IS NULL OR r.agent_profile_id <> auth.uid()) THEN
    RAISE EXCEPTION 'Seul l''agent destinataire confirme depuis son compte' USING ERRCODE = '42501';
  END IF;
  IF p_mode = 'signature' AND NOT (public.has_module_write('trips') OR public.has_module_write('maintenance')
                                   OR public.has_module_write('fuel')) THEN
    RAISE EXCEPTION 'Droit d''ecriture requis pour relever la signature' USING ERRCODE = '42501';
  END IF;
  IF r.confirmation IS NOT NULL THEN
    RAISE EXCEPTION 'Remise deja confirmee (%)', r.confirmation USING ERRCODE = '22023';
  END IF;
  UPDATE public.fiches_remises SET confirmation = p_mode, confirme_par = auth.uid(), confirme_le = now() WHERE id = p_remise_id;
  FOREACH v_id IN ARRAY r.fiche_ids LOOP
    PERFORM public.fiche_journaliser(v_id, 'confirmation_remise', NULL, NULL,
      jsonb_build_object('remise_id', p_remise_id, 'mode', p_mode));
  END LOOP;
END;
$$;

-- Retour : agent, receptionnaire (l'appelant), heure, etat par fiche,
-- manquants. Une fiche manquante reste chez l'agent (etat inchange).
CREATE OR REPLACE FUNCTION public.enregistrer_retour_fiches(
  p_agent text, p_details jsonb, p_agent_profile_id uuid DEFAULT NULL, p_retour_le timestamptz DEFAULT now(),
  p_lot_id uuid DEFAULT NULL, p_observations text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  d jsonb; v_details jsonb := coalesce(p_details, '[]'::jsonb); f public.fiches_terrain; v_site uuid;
  v_etat text; v_manquants jsonb := '[]'::jsonb; v_recus uuid[] := '{}'; v_retour uuid; n_attendu integer := 0;
  v_agent text := nullif(btrim(coalesce(p_agent, '')), ''); v_lignes jsonb := '[]'::jsonb; v_id uuid;
BEGIN
  IF jsonb_typeof(v_details) <> 'array' THEN
    RAISE EXCEPTION 'Detail du retour attendu sous forme de liste' USING ERRCODE = '22023';
  END IF;
  IF v_agent IS NULL AND p_agent_profile_id IS NOT NULL THEN
    SELECT nullif(btrim(coalesce(full_name, '')), '') INTO v_agent FROM public.profiles WHERE id = p_agent_profile_id;
  END IF;
  IF v_agent IS NULL THEN
    RAISE EXCEPTION 'Nom de l''agent qui rend les fiches requis' USING ERRCODE = '22023';
  END IF;
  IF p_retour_le IS NULL OR p_retour_le > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Heure de retour absente ou dans le futur' USING ERRCODE = '22023';
  END IF;
  -- Fiches du lot non citees : manquantes.
  IF p_lot_id IS NOT NULL THEN
    SELECT v_details || coalesce(jsonb_agg(jsonb_build_object('fiche_id', x.id, 'etat_retour', 'manquante')), '[]'::jsonb)
      INTO v_details
      FROM public.fiches_terrain x
     WHERE x.lot_id = p_lot_id AND x.etat IN ('remise_agent', 'en_utilisation')
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_details) e WHERE (e ->> 'fiche_id')::uuid = x.id);
  END IF;
  IF jsonb_array_length(v_details) = 0 THEN
    RAISE EXCEPTION 'Aucune fiche dans le retour' USING ERRCODE = '22023';
  END IF;
  FOR d IN SELECT x FROM jsonb_array_elements(v_details) AS t(x) LOOP
    v_etat := coalesce(d ->> 'etat_retour', 'complete');
    IF v_etat NOT IN ('complete', 'incomplete', 'abimee', 'manquante') THEN
      RAISE EXCEPTION 'Etat de retour inconnu : %', v_etat USING ERRCODE = '22023';
    END IF;
    f := public.fiche_verrou((d ->> 'fiche_id')::uuid, NULL, NULL);
    IF v_site IS NULL THEN v_site := f.site_id; END IF;
    IF f.site_id <> v_site THEN
      RAISE EXCEPTION 'Un retour ne porte que sur des fiches d''un meme site' USING ERRCODE = '22023';
    END IF;
    IF f.id = ANY (v_recus) THEN
      RAISE EXCEPTION 'Fiche % citee deux fois dans le retour', f.numero USING ERRCODE = '23505';
    END IF;
    v_recus := v_recus || f.id;
    IF f.etat NOT IN ('remise_agent', 'en_utilisation') THEN
      RAISE EXCEPTION 'Fiche % a l''etat % : pas chez un agent', f.numero, f.etat USING ERRCODE = '22023';
    END IF;
    IF NOT public.fiche_agent_conforme(f.agent, f.agent_profile_id, v_agent, p_agent_profile_id) THEN
      RAISE EXCEPTION 'Mauvais agent : la fiche % a ete remise a %', f.numero, f.agent USING ERRCODE = '22023';
    END IF;
    IF f.remise_le IS NOT NULL AND p_retour_le < f.remise_le THEN
      RAISE EXCEPTION 'Retour de la fiche % anterieur a sa remise', f.numero USING ERRCODE = '22023';
    END IF;
    n_attendu := n_attendu + 1;
    IF v_etat = 'manquante' THEN
      v_manquants := v_manquants || to_jsonb(f.numero);
    END IF;
    v_lignes := v_lignes || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('fiche_id', f.id, 'numero', f.numero,
      'etat_retour', v_etat, 'observation', nullif(btrim(coalesce(d ->> 'observation', '')), ''))));
  END LOOP;
  INSERT INTO public.fiches_retours (site_id, lot_id, agent, agent_profile_id, receptionnaire, retour_le, nombre_attendu,
    nombre_recu, details, manquants, observations)
  VALUES (v_site, p_lot_id, v_agent, p_agent_profile_id, auth.uid(), p_retour_le, n_attendu,
    n_attendu - jsonb_array_length(v_manquants), v_lignes, v_manquants, nullif(btrim(coalesce(p_observations, '')), ''))
  RETURNING id INTO v_retour;
  FOR d IN SELECT x FROM jsonb_array_elements(v_lignes) AS t(x) LOOP
    v_id := (d ->> 'fiche_id')::uuid;
    IF d ->> 'etat_retour' = 'manquante' THEN
      PERFORM public.fiche_journaliser(v_id, 'manquante_au_retour', NULL, NULL, jsonb_build_object('retour_id', v_retour));
    ELSE
      UPDATE public.fiches_terrain SET retournee_le = p_retour_le, etat_retour = d ->> 'etat_retour',
             dernier_retour_id = v_retour WHERE id = v_id;
      PERFORM public.fiche_passer(v_id, 'retournee', 'retour', d ->> 'observation',
        jsonb_build_object('retour_id', v_retour, 'etat_retour', d ->> 'etat_retour'));
    END IF;
  END LOOP;
  RETURN v_retour;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Saisie au retour : brouillon, lignes FR, pointages FP, lignes FC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enregistrer_brouillon_fiche(p_id uuid, p_brouillon jsonb, p_version integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE f public.fiches_terrain; v_version integer;
BEGIN
  IF p_version IS NULL THEN
    RAISE EXCEPTION 'Version de la fiche requise (controle de concurrence)' USING ERRCODE = '22023';
  END IF;
  f := public.fiche_verrou(p_id, NULL, p_version);
  IF f.etat NOT IN ('retournee', 'a_saisir', 'saisie_en_cours', 'a_corriger') THEN
    RAISE EXCEPTION 'Fiche % a l''etat % : brouillon de saisie impossible', f.numero, f.etat USING ERRCODE = '22023';
  END IF;
  IF f.etat <> 'saisie_en_cours' THEN
    PERFORM public.fiche_passer(p_id, 'saisie_en_cours', 'debut_saisie');
  END IF;
  UPDATE public.fiches_terrain SET brouillon = p_brouillon, brouillon_par = auth.uid(), brouillon_le = now(),
         saisie_commencee_par = coalesce(saisie_commencee_par, auth.uid()),
         saisie_commencee_le = coalesce(saisie_commencee_le, clock_timestamp())
   WHERE id = p_id RETURNING version INTO v_version;
  PERFORM public.fiche_journaliser(p_id, 'brouillon', f.etat);
  RETURN v_version;
END;
$$;

-- Rotation declaree sur la fiche FR, rapprochee d'un voyage existant du
-- camion de la fiche. Ne cree ni ne modifie aucun voyage (saisir_rotation
-- reste la seule voie d'avancement). Ressoumission identique : sans effet.
CREATE OR REPLACE FUNCTION public.saisir_ligne_rotation(p_fiche_id uuid, p_rang integer, p_ligne jsonb,
  p_motif_correction text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f public.fiches_terrain := public.fiche_saisissable(p_fiche_id, 'rotations');
  l public.fiches_rotations_lignes; t public.trips; v_autre text;
  v_trip uuid := nullif(p_ligne ->> 'trip_id', '')::uuid;
  n public.fiches_rotations_lignes;
BEGIN
  IF p_rang IS NULL OR p_rang <= 0 OR p_ligne IS NULL OR jsonb_typeof(p_ligne) <> 'object' THEN
    RAISE EXCEPTION 'Rang positif et ligne (objet) requis' USING ERRCODE = '22023';
  END IF;
  IF v_trip IS NOT NULL THEN
    SELECT * INTO t FROM public.trips WHERE id = v_trip;
    IF NOT FOUND THEN RAISE EXCEPTION 'Voyage introuvable' USING ERRCODE = '22023'; END IF;
    IF t.vehicle_id IS DISTINCT FROM f.vehicle_id THEN
      RAISE EXCEPTION 'Mauvais engin : le voyage % n''est pas affecte au camion de la fiche %', t.reference, f.numero
        USING ERRCODE = '22023';
    END IF;
    SELECT fi.numero INTO v_autre FROM public.fiches_rotations_lignes x JOIN public.fiches_terrain fi ON fi.id = x.fiche_id
     WHERE x.trip_id = v_trip AND x.fiche_id <> p_fiche_id AND fi.etat <> 'annulee' LIMIT 1;
    IF v_autre IS NOT NULL THEN
      RAISE EXCEPTION 'Doublon : le voyage % est deja rapporte sur la fiche %', t.reference, v_autre USING ERRCODE = '23505';
    END IF;
  END IF;
  n.fiche_id := p_fiche_id; n.rang := p_rang; n.trip_id := v_trip;
  n.driver_id := nullif(p_ligne ->> 'driver_id', '')::uuid;
  n.chargement_site_id := nullif(p_ligne ->> 'chargement_site_id', '')::uuid;
  n.destination_site_id := nullif(p_ligne ->> 'destination_site_id', '')::uuid;
  n.depart_le := nullif(p_ligne ->> 'depart_le', '')::timestamptz;
  n.arrivee_le := nullif(p_ligne ->> 'arrivee_le', '')::timestamptz;
  n.etapes := coalesce(p_ligne -> 'etapes', '[]'::jsonb);
  n.km_depart := nullif(p_ligne ->> 'km_depart', '')::numeric;
  n.km_arrivee := nullif(p_ligne ->> 'km_arrivee', '')::numeric;
  n.ticket_cbg := nullif(btrim(coalesce(p_ligne ->> 'ticket_cbg', '')), '');
  n.observations := nullif(btrim(coalesce(p_ligne ->> 'observations', '')), '');
  n.incidents := nullif(btrim(coalesce(p_ligne ->> 'incidents', '')), '');
  IF jsonb_typeof(n.etapes) <> 'array' THEN
    RAISE EXCEPTION 'Etapes attendues sous forme de liste' USING ERRCODE = '22023';
  END IF;
  IF n.km_depart IS NOT NULL AND n.km_arrivee IS NOT NULL AND n.km_arrivee < n.km_depart THEN
    RAISE EXCEPTION 'Releves kilometriques incoherents (arrivee inferieure au depart)' USING ERRCODE = '22023';
  END IF;
  IF n.depart_le IS NOT NULL AND n.arrivee_le IS NOT NULL AND n.arrivee_le < n.depart_le THEN
    RAISE EXCEPTION 'Horaires incoherents (arrivee avant le depart)' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO l FROM public.fiches_rotations_lignes WHERE fiche_id = p_fiche_id AND rang = p_rang;
  IF FOUND THEN
    IF (l.trip_id, l.driver_id, l.chargement_site_id, l.destination_site_id, l.depart_le, l.arrivee_le, l.etapes,
        l.km_depart, l.km_arrivee, l.ticket_cbg, l.observations, l.incidents)
       IS NOT DISTINCT FROM
       (n.trip_id, n.driver_id, n.chargement_site_id, n.destination_site_id, n.depart_le, n.arrivee_le, n.etapes,
        n.km_depart, n.km_arrivee, n.ticket_cbg, n.observations, n.incidents) THEN
      RETURN l.id;
    END IF;
    IF nullif(btrim(coalesce(p_motif_correction, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Ligne % deja saisie : motif de correction obligatoire', p_rang USING ERRCODE = '22023';
    END IF;
    UPDATE public.fiches_rotations_lignes SET trip_id = n.trip_id, driver_id = n.driver_id,
      chargement_site_id = n.chargement_site_id, destination_site_id = n.destination_site_id, depart_le = n.depart_le,
      arrivee_le = n.arrivee_le, etapes = n.etapes, km_depart = n.km_depart, km_arrivee = n.km_arrivee,
      ticket_cbg = n.ticket_cbg, observations = n.observations, incidents = n.incidents,
      modifie_par = auth.uid(), modifie_le = now()
     WHERE id = l.id;
    PERFORM public.fiche_marquer_saisie(p_fiche_id, 'correction_ligne_rotation',
      jsonb_build_object('rang', p_rang, 'avant', to_jsonb(l) - ARRAY['id', 'fiche_id'], 'motif', btrim(p_motif_correction)));
    PERFORM public.fiche_journaliser(p_fiche_id, 'correction', NULL, p_motif_correction, jsonb_build_object('rang', p_rang));
    RETURN l.id;
  END IF;
  INSERT INTO public.fiches_rotations_lignes (fiche_id, rang, trip_id, driver_id, chargement_site_id, destination_site_id,
    depart_le, arrivee_le, etapes, km_depart, km_arrivee, ticket_cbg, observations, incidents, saisi_par)
  VALUES (p_fiche_id, p_rang, n.trip_id, n.driver_id, n.chargement_site_id, n.destination_site_id, n.depart_le,
    n.arrivee_le, n.etapes, n.km_depart, n.km_arrivee, n.ticket_cbg, n.observations, n.incidents, auth.uid())
  RETURNING id INTO l.id;
  PERFORM public.fiche_marquer_saisie(p_fiche_id, 'saisie_ligne_rotation', jsonb_build_object('rang', p_rang, 'trip_id', v_trip));
  RETURN l.id;
END;
$$;

-- Pointage FP : heures moteur (index d'horametre) distinctes des heures
-- productives facturables ; arrets constates conserves sur le pointage et
-- rapproches des immobilisations au controle (aucune creation automatique).
CREATE OR REPLACE FUNCTION public.saisir_pointage_fiche(
  p_fiche_id uuid, p_vehicle_id uuid, p_index_debut numeric, p_index_fin numeric,
  p_heures_productives numeric DEFAULT NULL, p_periode_debut timestamptz DEFAULT NULL, p_periode_fin timestamptz DEFAULT NULL,
  p_arrets jsonb DEFAULT '[]'::jsonb, p_operateur text DEFAULT NULL, p_agent text DEFAULT NULL,
  p_observations text DEFAULT NULL, p_motif_correction text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f public.fiches_terrain := public.fiche_saisissable(p_fiche_id, 'pointage_engins');
  p public.pointages_engins; a jsonb; v_arret numeric := 0; v_arrets jsonb := coalesce(p_arrets, '[]'::jsonb);
  v_deb timestamptz; v_fin timestamptz; v_id uuid;
BEGIN
  IF p_vehicle_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = p_vehicle_id) THEN
    RAISE EXCEPTION 'Engin introuvable' USING ERRCODE = '22023';
  END IF;
  IF f.vehicle_id IS NOT NULL AND f.vehicle_id <> p_vehicle_id THEN
    RAISE EXCEPTION 'Mauvais engin : la fiche % porte sur un autre engin', f.numero USING ERRCODE = '22023';
  END IF;
  IF NOT public.vehicule_permis(p_vehicle_id) THEN
    RAISE EXCEPTION 'Hors perimetre : engin d''un autre site' USING ERRCODE = '42501';
  END IF;
  IF p_index_debut IS NULL OR p_index_fin IS NULL OR p_index_debut < 0 OR p_index_fin < p_index_debut THEN
    RAISE EXCEPTION 'Index d''horametre incoherents (fin inferieure au debut)' USING ERRCODE = '22023';
  END IF;
  IF p_heures_productives IS NOT NULL AND (p_heures_productives < 0 OR p_heures_productives > p_index_fin - p_index_debut) THEN
    RAISE EXCEPTION 'Heures productives (%) superieures aux heures moteur (%)', p_heures_productives, p_index_fin - p_index_debut
      USING ERRCODE = '22023';
  END IF;
  v_deb := coalesce(p_periode_debut, f.periode_debut); v_fin := coalesce(p_periode_fin, f.periode_fin);
  IF v_deb IS NOT NULL AND v_fin IS NOT NULL AND v_fin <= v_deb THEN
    RAISE EXCEPTION 'Periode incoherente (fin avant le debut)' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_arrets) <> 'array' THEN
    RAISE EXCEPTION 'Arrets attendus sous forme de liste' USING ERRCODE = '22023';
  END IF;
  FOR a IN SELECT x FROM jsonb_array_elements(v_arrets) AS t(x) LOOP
    IF nullif(a ->> 'debut', '') IS NULL OR nullif(a ->> 'fin', '') IS NULL
       OR (a ->> 'fin')::timestamptz <= (a ->> 'debut')::timestamptz OR nullif(btrim(coalesce(a ->> 'cause', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Arret : debut, fin posterieure et cause requis' USING ERRCODE = '22023';
    END IF;
    v_arret := v_arret + extract(epoch FROM (a ->> 'fin')::timestamptz - (a ->> 'debut')::timestamptz) / 3600.0;
  END LOOP;
  IF v_deb IS NOT NULL AND v_fin IS NOT NULL AND p_heures_productives IS NOT NULL
     AND p_heures_productives + v_arret > extract(epoch FROM v_fin - v_deb) / 3600.0 + 0.01 THEN
    RAISE EXCEPTION 'Heures productives et arrets superieurs a la duree de la periode' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO p FROM public.pointages_engins WHERE fiche_id = p_fiche_id AND vehicle_id = p_vehicle_id;
  IF FOUND THEN
    IF (p.index_debut, p.index_fin, p.heures_productives, p.periode_debut, p.periode_fin, p.arrets, p.operateur, p.agent, p.observations)
       IS NOT DISTINCT FROM
       (p_index_debut, p_index_fin, p_heures_productives, v_deb, v_fin, v_arrets,
        nullif(btrim(coalesce(p_operateur, '')), ''), nullif(btrim(coalesce(p_agent, '')), ''),
        nullif(btrim(coalesce(p_observations, '')), '')) THEN
      RETURN p.id;
    END IF;
    IF nullif(btrim(coalesce(p_motif_correction, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Engin deja pointe sur cette fiche : motif de correction obligatoire' USING ERRCODE = '22023';
    END IF;
    UPDATE public.pointages_engins SET index_debut = p_index_debut, index_fin = p_index_fin,
      heures_productives = p_heures_productives, periode_debut = v_deb, periode_fin = v_fin, arrets = v_arrets,
      heures_arret = round(v_arret, 2), operateur = nullif(btrim(coalesce(p_operateur, '')), ''),
      agent = nullif(btrim(coalesce(p_agent, '')), ''), observations = nullif(btrim(coalesce(p_observations, '')), ''),
      modifie_par = auth.uid(), modifie_le = now()
     WHERE id = p.id;
    PERFORM public.fiche_marquer_saisie(p_fiche_id, 'correction_pointage',
      jsonb_build_object('vehicle_id', p_vehicle_id, 'avant', to_jsonb(p) - ARRAY['id', 'fiche_id'], 'motif', btrim(p_motif_correction)));
    PERFORM public.fiche_journaliser(p_fiche_id, 'correction', NULL, p_motif_correction, jsonb_build_object('vehicle_id', p_vehicle_id));
    RETURN p.id;
  END IF;
  INSERT INTO public.pointages_engins (fiche_id, vehicle_id, operateur, index_debut, index_fin, observations, saisi_par,
    heures_productives, periode_debut, periode_fin, arrets, heures_arret, agent, origine)
  VALUES (p_fiche_id, p_vehicle_id, nullif(btrim(coalesce(p_operateur, '')), ''), p_index_debut, p_index_fin,
    nullif(btrim(coalesce(p_observations, '')), ''), auth.uid(), p_heures_productives, v_deb, v_fin, v_arrets,
    round(v_arret, 2), nullif(btrim(coalesce(p_agent, '')), ''), 'cycle')
  RETURNING id INTO v_id;
  PERFORM public.fiche_marquer_saisie(p_fiche_id, 'saisie_pointage', jsonb_build_object('vehicle_id', p_vehicle_id));
  RETURN v_id;
END;
$$;

-- Ligne FC du cycle : cuve source obligatoire (registre D-041) ; la sortie
-- de stock n'est ecrite qu'a la validation de la fiche, une seule fois.
CREATE OR REPLACE FUNCTION public.saisir_ligne_carburant(p_fiche_id uuid, p_rang integer, p_ligne jsonb,
  p_motif_correction text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f public.fiches_terrain := public.fiche_saisissable(p_fiche_id, 'carburant');
  l public.fiches_carburant_lignes; n public.fiches_carburant_lignes; s public.stockages_carburant;
BEGIN
  IF p_rang IS NULL OR p_rang <= 0 OR p_ligne IS NULL OR jsonb_typeof(p_ligne) <> 'object' THEN
    RAISE EXCEPTION 'Rang positif et ligne (objet) requis' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.fiches_carburant_lignes x WHERE x.fiche_id = p_fiche_id AND x.origine = 'saisir_carburant')
     OR EXISTS (SELECT 1 FROM public.fuel_transactions ft WHERE ft.reference LIKE f.numero || '-%') THEN
    RAISE EXCEPTION 'Fiche % deja saisie par la saisie directe (D-028) : ses pleins sont au registre', f.numero USING ERRCODE = '22023';
  END IF;
  n.fiche_id := p_fiche_id; n.rang := p_rang;
  n.vehicle_id := nullif(p_ligne ->> 'vehicle_id', '')::uuid;
  n.driver_id := nullif(p_ligne ->> 'driver_id', '')::uuid;
  n.stockage_id := coalesce(nullif(p_ligne ->> 'stockage_id', '')::uuid, f.stockage_id);
  n.distribue_le := nullif(p_ligne ->> 'distribue_le', '')::timestamptz;
  n.litres := nullif(p_ligne ->> 'litres', '')::numeric;
  n.index_pompe_debut := nullif(p_ligne ->> 'index_pompe_debut', '')::numeric;
  n.index_pompe_fin := nullif(p_ligne ->> 'index_pompe_fin', '')::numeric;
  n.agent_distributeur := coalesce(nullif(btrim(coalesce(p_ligne ->> 'agent_distributeur', '')), ''), f.agent);
  n.compteur_km := nullif(p_ligne ->> 'compteur_km', '')::numeric;
  n.horametre := nullif(p_ligne ->> 'horametre', '')::numeric;
  n.destinataire_confirme := coalesce((p_ligne ->> 'destinataire_confirme')::boolean, false);
  n.destinataire_nom := nullif(btrim(coalesce(p_ligne ->> 'destinataire_nom', '')), '');
  n.observations := nullif(btrim(coalesce(p_ligne ->> 'observations', '')), '');
  IF n.vehicle_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = n.vehicle_id) THEN
    RAISE EXCEPTION 'Engin destinataire requis' USING ERRCODE = '22023';
  END IF;
  IF f.vehicle_id IS NOT NULL AND f.vehicle_id <> n.vehicle_id THEN
    RAISE EXCEPTION 'Mauvais engin : la fiche % porte sur un autre engin', f.numero USING ERRCODE = '22023';
  END IF;
  IF NOT public.vehicule_permis(n.vehicle_id) THEN
    RAISE EXCEPTION 'Hors perimetre : engin d''un autre site' USING ERRCODE = '42501';
  END IF;
  IF n.litres IS NULL OR n.litres <= 0 THEN
    RAISE EXCEPTION 'Quantite en litres positive requise' USING ERRCODE = '22023';
  END IF;
  IF n.distribue_le IS NULL OR n.distribue_le > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Date et heure de distribution requises, pas dans le futur' USING ERRCODE = '22023';
  END IF;
  IF n.stockage_id IS NULL THEN
    RAISE EXCEPTION 'Cuve source requise : la distribution passe par le registre carburant' USING ERRCODE = '22023';
  END IF;
  s := public.stockage_ecrivable(n.stockage_id);
  IF s.site_id <> f.site_id THEN
    RAISE EXCEPTION 'Cuve % hors du site de la fiche', s.code USING ERRCODE = '22023';
  END IF;
  IF n.index_pompe_debut IS NOT NULL AND n.index_pompe_fin IS NOT NULL AND n.index_pompe_fin < n.index_pompe_debut THEN
    RAISE EXCEPTION 'Index de pompe incoherents (fin inferieure au debut)' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO l FROM public.fiches_carburant_lignes WHERE fiche_id = p_fiche_id AND rang = p_rang;
  IF FOUND THEN
    IF (l.vehicle_id, l.driver_id, l.stockage_id, l.distribue_le, l.litres, l.index_pompe_debut, l.index_pompe_fin,
        l.agent_distributeur, l.compteur_km, l.horametre, l.destinataire_confirme, l.destinataire_nom, l.observations)
       IS NOT DISTINCT FROM
       (n.vehicle_id, n.driver_id, n.stockage_id, n.distribue_le, n.litres, n.index_pompe_debut, n.index_pompe_fin,
        n.agent_distributeur, n.compteur_km, n.horametre, n.destinataire_confirme, n.destinataire_nom, n.observations) THEN
      RETURN l.id;
    END IF;
    IF nullif(btrim(coalesce(p_motif_correction, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Ligne % deja saisie : motif de correction obligatoire', p_rang USING ERRCODE = '22023';
    END IF;
    UPDATE public.fiches_carburant_lignes SET vehicle_id = n.vehicle_id, driver_id = n.driver_id, stockage_id = n.stockage_id,
      distribue_le = n.distribue_le, litres = n.litres, index_pompe_debut = n.index_pompe_debut,
      index_pompe_fin = n.index_pompe_fin, agent_distributeur = n.agent_distributeur, compteur_km = n.compteur_km,
      horametre = n.horametre, destinataire_confirme = n.destinataire_confirme, destinataire_nom = n.destinataire_nom,
      observations = n.observations, modifie_par = auth.uid(), modifie_le = now()
     WHERE id = l.id;
    PERFORM public.fiche_marquer_saisie(p_fiche_id, 'correction_ligne_carburant',
      jsonb_build_object('rang', p_rang, 'avant', to_jsonb(l) - ARRAY['id', 'fiche_id'], 'motif', btrim(p_motif_correction)));
    PERFORM public.fiche_journaliser(p_fiche_id, 'correction', NULL, p_motif_correction, jsonb_build_object('rang', p_rang));
    RETURN l.id;
  END IF;
  INSERT INTO public.fiches_carburant_lignes (fiche_id, rang, vehicle_id, driver_id, stockage_id, distribue_le, litres,
    index_pompe_debut, index_pompe_fin, agent_distributeur, compteur_km, horametre, destinataire_confirme,
    destinataire_nom, observations, origine, saisi_par)
  VALUES (p_fiche_id, p_rang, n.vehicle_id, n.driver_id, n.stockage_id, n.distribue_le, n.litres, n.index_pompe_debut,
    n.index_pompe_fin, n.agent_distributeur, n.compteur_km, n.horametre, n.destinataire_confirme, n.destinataire_nom,
    n.observations, 'cycle', auth.uid())
  RETURNING id INTO l.id;
  PERFORM public.fiche_marquer_saisie(p_fiche_id, 'saisie_ligne_carburant', jsonb_build_object('rang', p_rang));
  RETURN l.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Fonctions D-028 redefinies (memes signatures)
-- ---------------------------------------------------------------------------
-- suivre_fiche (reprise de 20261111090000) : remise et retour traces.
CREATE OR REPLACE FUNCTION public.suivre_fiche(p_id uuid, p_etape text, p_agent text DEFAULT NULL, p_quand timestamptz DEFAULT now())
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f public.fiches_terrain := public.fiche_ouverte(p_id, NULL);
  v_agent text := coalesce(nullif(btrim(coalesce(p_agent, '')), ''), f.agent);
  v_trace uuid;
BEGIN
  IF p_quand IS NULL OR p_quand > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Heure absente ou dans le futur' USING ERRCODE = '22023';
  END IF;
  IF p_etape = 'remise' AND f.etat IN ('preparee', 'imprimee', 'a_remettre') THEN
    IF nullif(btrim(coalesce(v_agent, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Nom de l''agent qui recoit la fiche requis' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.fiches_remises (site_id, agent, responsable, remise_le, nombre, numeros, fiche_ids, origine)
    VALUES (f.site_id, v_agent, auth.uid(), p_quand, 1, jsonb_build_array(f.numero), ARRAY[f.id], 'suivre_fiche')
    RETURNING id INTO v_trace;
    UPDATE public.fiches_terrain SET remise_le = p_quand, agent = v_agent, derniere_remise_id = v_trace WHERE id = p_id;
    PERFORM public.fiche_passer(p_id, 'remise_agent', 'remise', NULL, jsonb_build_object('remise_id', v_trace, 'agent', v_agent));
  ELSIF p_etape = 'retournee' AND f.etat IN ('preparee', 'imprimee', 'a_remettre', 'remise_agent', 'en_utilisation') THEN
    IF f.etat IN ('preparee', 'imprimee', 'a_remettre') THEN
      PERFORM public.fiche_passer(p_id, 'remise_agent', 'remise_implicite', 'Retour sans remise enregistree (D-028)');
    END IF;
    INSERT INTO public.fiches_retours (site_id, agent, receptionnaire, retour_le, nombre_attendu, nombre_recu, details, origine)
    VALUES (f.site_id, v_agent, auth.uid(), p_quand, 1, 1,
      jsonb_build_array(jsonb_build_object('fiche_id', f.id, 'numero', f.numero, 'etat_retour', 'complete')), 'suivre_fiche')
    RETURNING id INTO v_trace;
    UPDATE public.fiches_terrain SET retournee_le = p_quand, agent = v_agent, etat_retour = 'complete',
           dernier_retour_id = v_trace WHERE id = p_id;
    PERFORM public.fiche_passer(p_id, 'retournee', 'retour', NULL, jsonb_build_object('retour_id', v_trace));
  ELSE
    RAISE EXCEPTION 'Etape % impossible depuis l''etat %', p_etape, f.etat USING ERRCODE = '22023';
  END IF;
END;
$$;

-- annuler_fiche (reprise de 20261111090000) : refus si une operation metier
-- porte deja la fiche ; jamais une fiche a controler, validee ou archivee.
CREATE OR REPLACE FUNCTION public.annuler_fiche(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f public.fiches_terrain := public.fiche_verrou(p_id, NULL, NULL);
BEGIN
  IF f.etat IN ('a_controler', 'validee', 'archivee', 'annulee') THEN
    RAISE EXCEPTION 'Fiche % close (%)', f.numero, f.etat USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motif obligatoire pour annuler une fiche' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pointages_engins WHERE fiche_id = p_id)
     OR EXISTS (SELECT 1 FROM public.tickets_pesee_cbg WHERE fiche_id = p_id)
     OR EXISTS (SELECT 1 FROM public.trip_events e WHERE e.donnees ? 'fiche' AND e.donnees ->> 'fiche' = f.numero)
     OR EXISTS (SELECT 1 FROM public.fiches_carburant_lignes WHERE fiche_id = p_id AND fuel_transaction_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Fiche deja saisie en partie : terminer la saisie et corriger les lignes' USING ERRCODE = '22023';
  END IF;
  UPDATE public.fiches_terrain SET motif_annulation = btrim(p_motif), annule_par = auth.uid(), annule_le = now() WHERE id = p_id;
  PERFORM public.fiche_passer(p_id, 'annulee', 'annulation', p_motif);
END;
$$;

-- terminer_saisie_fiche (reprise de 20261111090000) : saisie_terminee.
-- Une fiche encore chez l'agent est d'abord marquee retournee (compat D-028,
-- trace « retour implicite »). Repetition sans effet.
CREATE OR REPLACE FUNCTION public.terminer_saisie_fiche(p_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f public.fiches_terrain := public.fiche_verrou(p_id, NULL, NULL);
  v_trace uuid;
BEGIN
  IF f.etat IN ('saisie_terminee', 'a_controler', 'validee', 'archivee') THEN
    RETURN;
  END IF;
  IF f.etat = 'annulee' THEN
    RAISE EXCEPTION 'Fiche % close (annulee)', f.numero USING ERRCODE = '22023';
  END IF;
  IF f.etat IN ('a_preparer', 'preparee', 'a_imprimer', 'imprimee', 'a_remettre') THEN
    RAISE EXCEPTION 'La fiche n''a pas ete remise ni retournee' USING ERRCODE = '22023';
  END IF;
  IF f.etat IN ('remise_agent', 'en_utilisation') THEN
    INSERT INTO public.fiches_retours (site_id, agent, receptionnaire, retour_le, nombre_attendu, nombre_recu, details, origine)
    VALUES (f.site_id, f.agent, auth.uid(), now(), 1, 1,
      jsonb_build_array(jsonb_build_object('fiche_id', f.id, 'numero', f.numero, 'etat_retour', 'complete')), 'fin_saisie')
    RETURNING id INTO v_trace;
    UPDATE public.fiches_terrain SET retournee_le = coalesce(retournee_le, now()), dernier_retour_id = v_trace WHERE id = p_id;
    PERFORM public.fiche_passer(p_id, 'retournee', 'retour_implicite', 'Fin de saisie sans retour enregistre (D-028)',
      jsonb_build_object('retour_id', v_trace));
  END IF;
  UPDATE public.fiches_terrain
     SET saisie_par = auth.uid(), saisie_le = now(), note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), note),
         donnees_modifiees_le = coalesce(donnees_modifiees_le, clock_timestamp())
   WHERE id = p_id;
  PERFORM public.fiche_passer(p_id, 'saisie_terminee', 'fin_saisie', p_note);
END;
$$;

-- saisir_rotation : reprise exacte de 20261121160000 ; ajout du cycle et du
-- journal (fiche_marquer_saisie) en fin de saisie.
CREATE OR REPLACE FUNCTION public.saisir_rotation(p_fiche_id uuid, p_trip_id uuid, p_etapes jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  f public.fiches_terrain := public.fiche_ouverte(p_fiche_id, 'rotations');
  v public.trips;
  ordre CONSTANT text[] := ARRAY['DRAFT', 'PLANNED', 'ASSIGNED', 'AT_LOADING', 'LOADING', 'LOADED', 'WEIGHED_OUT',
    'IN_TRANSIT', 'AT_DESTINATION', 'UNLOADING', 'WEIGHED_IN', 'DELIVERED', 'ACCEPTED', 'CLOSED'];
  e jsonb; v_etat text; v_rang integer; v_ticket text;
BEGIN
  SELECT * INTO v FROM public.trips WHERE id = p_trip_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Voyage introuvable' USING ERRCODE = 'P0002'; END IF;
  IF v.vehicle_id IS DISTINCT FROM f.vehicle_id OR v.planned_date <> f.date_fiche THEN
    RAISE EXCEPTION 'Le voyage % n''appartient pas a la fiche % (camion ou date)', v.reference, f.numero USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_etapes) <> 'array' THEN RAISE EXCEPTION 'Etapes attendues sous forme de liste' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_etapes) x
    WHERE x ->> 'etat' = 'WEIGHED_OUT'
      AND ((x -> 'donnees') ? 'ticket' OR (x -> 'donnees') ? 'tonnage_cbg')) THEN
    RAISE EXCEPTION 'Le ticket CBG est integre a la pesee de reception au depot, pas au depart' USING ERRCODE = '22023';
  END IF;
  FOR e IN SELECT x FROM jsonb_array_elements(p_etapes) AS t(x)
    ORDER BY array_position(ordre, x ->> 'etat') NULLS LAST
  LOOP
    v_rang := array_position(ordre, e ->> 'etat');
    IF v_rang IS NULL THEN RAISE EXCEPTION 'Etape inconnue : %', e ->> 'etat' USING ERRCODE = '22023'; END IF;
    SELECT etat INTO v_etat FROM public.trips WHERE id = p_trip_id;
    v_ticket := nullif(btrim(coalesce(e -> 'donnees' ->> 'ticket', '')), '');
    IF array_position(ordre, v_etat) >= v_rang THEN
      IF e ->> 'etat' = 'WEIGHED_IN' AND v_ticket IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM public.tickets_pesee_cbg WHERE trip_id = p_trip_id) THEN
        RAISE EXCEPTION 'Voyage deja receptionne sans ticket CBG : rattacher le ticket depuis la fiche du voyage' USING ERRCODE = '22023';
      END IF;
      CONTINUE;
    END IF;
    IF e ->> 'etat' = 'WEIGHED_OUT' AND (v_ticket IS NOT NULL OR e -> 'donnees' ? 'tonnage_cbg') THEN
      RAISE EXCEPTION 'Le ticket CBG est integre a la pesee de reception au depot, pas au depart' USING ERRCODE = '22023';
    END IF;
    IF e ->> 'etat' = 'WEIGHED_IN' THEN
      IF v_ticket IS NULL THEN
        RAISE EXCEPTION 'La pesee a l''arrivee se saisit avec le ticket CBG' USING ERRCODE = '22023';
      END IF;
      IF coalesce(f.options ->> 'pesee', '') <> 'arrivee' THEN
        RAISE EXCEPTION 'Le ticket CBG doit etre integre a l''arrivee au depot' USING ERRCODE = '22023';
      END IF;
      IF f.site_id IS DISTINCT FROM v.departure_site_id AND f.site_id IS DISTINCT FROM v.arrival_site_id THEN
        RAISE EXCEPTION 'Le ticket CBG ne se rattache que depuis une fiche du site de depart ou du depot d''arrivee du voyage' USING ERRCODE = '22023';
      END IF;
      IF (e -> 'donnees' ->> 'brut')::numeric IS NULL OR (e -> 'donnees' ->> 'tare')::numeric IS NULL
         OR (e -> 'donnees' ->> 'tare')::numeric < 0
         OR (e -> 'donnees' ->> 'brut')::numeric <= (e -> 'donnees' ->> 'tare')::numeric THEN
        RAISE EXCEPTION 'Pesee incoherente : brut et tare requis, brut superieur a la tare' USING ERRCODE = '22023';
      END IF;
      IF (e ->> 'quand')::timestamptz IS NULL OR (e ->> 'quand')::timestamptz > now() + interval '5 minutes' THEN
        RAISE EXCEPTION 'Heure de l''evenement absente ou dans le futur' USING ERRCODE = '22023';
      END IF;
      IF public.voyage_couvert_cloture(p_trip_id) THEN
        RAISE EXCEPTION 'Reconciliation cloturee : utiliser le circuit d''avoir' USING ERRCODE = '22023';
      END IF;
      PERFORM public.controler_ticket_cbg_libre(v_ticket, p_trip_id);
      INSERT INTO public.tickets_pesee_cbg
        (trip_id, fiche_id, site_id, ticket, brut, tare, mesure_le, document_ref, saisi_par, origine)
      VALUES (p_trip_id, p_fiche_id, v.arrival_site_id, v_ticket,
        (e -> 'donnees' ->> 'brut')::numeric, (e -> 'donnees' ->> 'tare')::numeric,
        (e ->> 'quand')::timestamptz,
        nullif(btrim(coalesce(e -> 'donnees' ->> 'document_ref', '')), ''), auth.uid(), 'fiche');
    END IF;
    PERFORM public.avancer_voyage(p_trip_id, e ->> 'etat', (e ->> 'quand')::timestamptz,
      'Fiche ' || f.numero, coalesce(e -> 'donnees', '{}'::jsonb) || jsonb_build_object('fiche', f.numero));
  END LOOP;
  SELECT etat INTO v_etat FROM public.trips WHERE id = p_trip_id;
  PERFORM public.fiche_marquer_saisie(p_fiche_id, 'saisie_rotation', jsonb_build_object('trip_id', p_trip_id, 'etat_voyage', v_etat));
  RETURN v_etat;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.saisir_rotation(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saisir_rotation(uuid, uuid, jsonb) TO authenticated;

-- saisir_pointage : reprise exacte de 20261111090000 ; ajout du journal.
CREATE OR REPLACE FUNCTION public.saisir_pointage(
  p_fiche_id uuid,
  p_vehicle_id uuid,
  p_index_debut numeric,
  p_index_fin numeric,
  p_operateur text DEFAULT NULL,
  p_observations text DEFAULT NULL,
  p_arrets jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f public.fiches_terrain := public.fiche_ouverte(p_fiche_id, 'pointage_engins');
  a jsonb;
  v_id uuid;
  v_immo uuid;
BEGIN
  IF p_index_debut IS NULL OR p_index_fin IS NULL OR p_index_fin < p_index_debut THEN
    RAISE EXCEPTION 'Index d''horametre incoherents (fin inferieure au debut)' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.pointages_engins (fiche_id, vehicle_id, operateur, index_debut, index_fin, observations, saisi_par)
  VALUES (p_fiche_id, p_vehicle_id, nullif(btrim(coalesce(p_operateur, '')), ''), p_index_debut, p_index_fin,
    nullif(btrim(coalesce(p_observations, '')), ''), auth.uid())
  RETURNING id INTO v_id;

  FOR a IN SELECT x FROM jsonb_array_elements(coalesce(p_arrets, '[]'::jsonb)) AS t(x) LOOP
    v_immo := public.declarer_immobilisation(p_vehicle_id, (a ->> 'debut')::timestamptz, a ->> 'cause',
      a ->> 'imputation', coalesce(nullif(btrim(coalesce(a ->> 'description', '')), ''), 'Arret releve') || ' (fiche ' || f.numero || ')',
      a ->> 'reference_loueur');
    IF nullif(a ->> 'fin', '') IS NOT NULL THEN
      PERFORM public.cloturer_immobilisation(v_immo, (a ->> 'fin')::timestamptz, 'Fiche ' || f.numero);
    END IF;
  END LOOP;
  PERFORM public.fiche_marquer_saisie(p_fiche_id, 'saisie_pointage', jsonb_build_object('vehicle_id', p_vehicle_id));
  RETURN v_id;
END;
$$;

-- saisir_carburant : reprise exacte de 20261120100000 (comptabilisation
-- immediate, D-028 et D-041) ; ajout de l'inscription des lignes (la sortie
-- de stock reste unique : la ligne porte la transaction et le mouvement), de
-- l'exclusion de la voie du cycle et du journal.
CREATE OR REPLACE FUNCTION public.saisir_carburant(
  p_fiche_id uuid, p_prix_litre numeric, p_fournisseur text, p_lignes jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE f public.fiches_terrain := public.fiche_ouverte(p_fiche_id, 'carburant'); l jsonb; n integer := 0;
        v_litres numeric; v_tx uuid; s public.stockages_carburant; v_mvt uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.fuel_transactions WHERE reference LIKE f.numero || '-%')
     OR EXISTS (SELECT 1 FROM public.fiches_carburant_lignes WHERE fiche_id = p_fiche_id) THEN
    RAISE EXCEPTION 'Fiche % deja saisie', f.numero USING ERRCODE = '22023';
  END IF;
  FOR l IN SELECT x FROM jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) AS t(x) LOOP
    v_litres := (l ->> 'litres')::numeric;
    IF v_litres IS NULL OR v_litres <= 0 OR nullif(l ->> 'vehicle_id', '') IS NULL THEN
      RAISE EXCEPTION 'Engin et quantite en litres positive requis (ligne %)', n + 1 USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = (l ->> 'vehicle_id')::uuid) THEN
      RAISE EXCEPTION 'Engin introuvable (ligne %)', n + 1 USING ERRCODE = '22023';
    END IF;
    IF NOT public.vehicule_permis((l ->> 'vehicle_id')::uuid) THEN
      RAISE EXCEPTION 'Hors perimetre : engin d''un autre site (ligne %)', n + 1 USING ERRCODE = '42501';
    END IF;
    n := n + 1;
    v_mvt := NULL;
    INSERT INTO public.fuel_transactions (transaction_date, vehicle_id, driver_id, volume_liters, quantity, unit_price,
      total_cost, total_amount, transaction_type, supplier, reference, site_id, odometer_reading, notes, created_by)
    VALUES (f.date_fiche, (l ->> 'vehicle_id')::uuid, nullif(l ->> 'driver_id', '')::uuid, v_litres, v_litres,
      NULL, NULL, NULL, 'refuel', 'CBG', f.numero || '-' || lpad(n::text, 2, '0'), f.site_id,
      nullif(l ->> 'compteur', '')::numeric, 'Fiche ' || f.numero, auth.uid())
    RETURNING id INTO v_tx;
    IF nullif(l ->> 'stockage_id', '') IS NOT NULL THEN
      s := public.stockage_ecrivable((l ->> 'stockage_id')::uuid);
      IF s.site_id <> f.site_id THEN
        RAISE EXCEPTION 'Stockage % hors du site de la fiche (ligne %)', s.code, n USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.mouvements_carburant (stockage_id, type, variation, date_mouvement, reference_piece,
        fuel_transaction_id, saisi_par)
      VALUES (s.id, 'distribution', -v_litres, f.date_fiche::timestamptz, f.numero || '-' || lpad(n::text, 2, '0'),
        v_tx, auth.uid())
      RETURNING id INTO v_mvt;
    END IF;
    INSERT INTO public.fiches_carburant_lignes (fiche_id, rang, vehicle_id, driver_id, stockage_id, distribue_le, litres,
      compteur_km, fuel_transaction_id, mouvement_id, comptabilise_le, origine, saisi_par)
    VALUES (p_fiche_id, n, (l ->> 'vehicle_id')::uuid, nullif(l ->> 'driver_id', '')::uuid,
      nullif(l ->> 'stockage_id', '')::uuid, f.date_fiche::timestamptz, v_litres, nullif(l ->> 'compteur', '')::numeric,
      v_tx, v_mvt, now(), 'saisir_carburant', auth.uid());
  END LOOP;
  IF n = 0 THEN RAISE EXCEPTION 'Aucune ligne a saisir' USING ERRCODE = '22023'; END IF;
  PERFORM public.fiche_marquer_saisie(p_fiche_id, 'saisie_carburant', jsonb_build_object('lignes', n));
  RETURN n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.saisir_carburant(uuid, numeric, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saisir_carburant(uuid, numeric, text, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. Controle, renvoi, validation, archivage
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.soumettre_fiche_controle(p_id uuid, p_version integer DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE f public.fiches_terrain := public.fiche_verrou(p_id, NULL, NULL);
BEGIN
  IF f.etat IN ('a_controler', 'validee', 'archivee') THEN
    RETURN f.etat;
  END IF;
  IF p_version IS NOT NULL AND p_version <> f.version THEN
    RAISE EXCEPTION 'Fiche % modifiee entre-temps (version % attendue, % en base) : recharger', f.numero, p_version, f.version
      USING ERRCODE = '40001';
  END IF;
  IF f.etat <> 'saisie_terminee' THEN
    RAISE EXCEPTION 'Fiche % a l''etat % : terminer la saisie avant le controle', f.numero, f.etat USING ERRCODE = '22023';
  END IF;
  PERFORM public.fiche_passer(p_id, 'a_controler', 'soumission');
  RETURN 'a_controler';
END;
$$;

-- Controle : compare la fiche aux donnees SIGTB et liste les ecarts, sans
-- rien corriger. Chaque controle est numerote ; le dernier fait foi.
CREATE OR REPLACE FUNCTION public.controler_fiche(p_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f public.fiches_terrain := public.fiche_verrou(p_id, NULL, NULL);
  v_no integer; n integer; l record; t public.trips; v_ticket text; v_km numeric; p record; a jsonb; i record;
  v_du timestamptz; v_au timestamptz; v_periode numeric; v_dispo numeric; e record; v_solde numeric; c record;
BEGIN
  IF f.etat <> 'a_controler' THEN
    RAISE EXCEPTION 'Fiche % a l''etat % : seule une fiche soumise se controle', f.numero, f.etat USING ERRCODE = '22023';
  END IF;
  v_no := f.controle_no + 1;
  CREATE TEMP TABLE IF NOT EXISTS pg_temp.ecarts_fiche (code text, gravite text, libelle text, objet text, attendu text, constate text)
    ON COMMIT DROP;
  DELETE FROM pg_temp.ecarts_fiche;

  IF f.type = 'rotations' THEN
    FOR l IN SELECT * FROM public.fiches_rotations_lignes WHERE fiche_id = f.id ORDER BY rang LOOP
      IF l.trip_id IS NULL THEN
        INSERT INTO pg_temp.ecarts_fiche VALUES ('rotation_sans_voyage', 'alerte', 'Rotation declaree sans voyage SIGTB',
          'ligne ' || l.rang, NULL, NULL);
        CONTINUE;
      END IF;
      SELECT * INTO t FROM public.trips WHERE id = l.trip_id;
      IF t.planned_date IS DISTINCT FROM f.date_fiche THEN
        INSERT INTO pg_temp.ecarts_fiche VALUES ('voyage_autre_date', 'alerte', 'Voyage date d''un autre jour que la fiche',
          t.reference, f.date_fiche::text, t.planned_date::text);
      END IF;
      IF coalesce(l.driver_id, f.driver_id) IS NOT NULL AND t.driver_id IS DISTINCT FROM coalesce(l.driver_id, f.driver_id) THEN
        INSERT INTO pg_temp.ecarts_fiche VALUES ('chauffeur_different', 'alerte', 'Chauffeur de la fiche different du voyage',
          t.reference, t.driver_id::text, coalesce(l.driver_id, f.driver_id)::text);
      END IF;
      IF t.etat NOT IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'REJECTED', 'DISPUTED', 'CANCELLED') THEN
        INSERT INTO pg_temp.ecarts_fiche VALUES ('voyage_non_termine', 'alerte', 'Voyage SIGTB non termine',
          t.reference, 'DELIVERED', t.etat);
      END IF;
      IF l.chargement_site_id IS NOT NULL AND l.chargement_site_id IS DISTINCT FROM t.departure_site_id THEN
        INSERT INTO pg_temp.ecarts_fiche VALUES ('site_chargement_different', 'alerte', 'Lieu de chargement different du voyage',
          t.reference, t.departure_site_id::text, l.chargement_site_id::text);
      END IF;
      IF l.destination_site_id IS NOT NULL AND l.destination_site_id IS DISTINCT FROM t.arrival_site_id THEN
        INSERT INTO pg_temp.ecarts_fiche VALUES ('destination_differente', 'alerte', 'Destination differente du voyage',
          t.reference, t.arrival_site_id::text, l.destination_site_id::text);
      END IF;
      SELECT k.ticket INTO v_ticket FROM public.tickets_pesee_cbg k WHERE k.trip_id = t.id;
      IF l.ticket_cbg IS NOT NULL AND v_ticket IS NULL THEN
        INSERT INTO pg_temp.ecarts_fiche VALUES ('ticket_absent_sigtb', 'alerte', 'Ticket CBG note sur la fiche, non integre a SIGTB',
          t.reference, NULL, l.ticket_cbg);
      ELSIF l.ticket_cbg IS NOT NULL AND upper(btrim(l.ticket_cbg)) <> upper(btrim(v_ticket)) THEN
        INSERT INTO pg_temp.ecarts_fiche VALUES ('ticket_different', 'alerte', 'Ticket CBG de la fiche different du ticket integre',
          t.reference, v_ticket, l.ticket_cbg);
      ELSIF l.ticket_cbg IS NULL AND v_ticket IS NOT NULL THEN
        INSERT INTO pg_temp.ecarts_fiche VALUES ('ticket_non_reporte', 'info', 'Ticket CBG integre mais non reporte sur la fiche',
          t.reference, v_ticket, NULL);
      END IF;
      IF l.km_depart IS NOT NULL THEN
        SELECT r.valeur_km INTO v_km FROM public.v_releves_compteur r
         WHERE r.trip_id = t.id AND r.moment = 'depart_charge' ORDER BY r.releve_le DESC LIMIT 1;
        IF v_km IS NULL THEN
          INSERT INTO pg_temp.ecarts_fiche VALUES ('releve_km_absent', 'info', 'Releve kilometrique de depart absent de SIGTB',
            t.reference, NULL, l.km_depart::text);
        ELSIF v_km <> l.km_depart THEN
          INSERT INTO pg_temp.ecarts_fiche VALUES ('km_depart_different', 'alerte', 'Compteur de depart different du releve SIGTB',
            t.reference, v_km::text, l.km_depart::text);
        END IF;
      END IF;
      IF l.km_arrivee IS NOT NULL THEN
        v_km := NULL;
        SELECT r.valeur_km INTO v_km FROM public.v_releves_compteur r
         WHERE r.trip_id = t.id AND r.moment = 'arrivee_depot' ORDER BY r.releve_le DESC LIMIT 1;
        IF v_km IS NULL THEN
          INSERT INTO pg_temp.ecarts_fiche VALUES ('releve_km_absent', 'info', 'Releve kilometrique d''arrivee absent de SIGTB',
            t.reference, NULL, l.km_arrivee::text);
        ELSIF v_km <> l.km_arrivee THEN
          INSERT INTO pg_temp.ecarts_fiche VALUES ('km_arrivee_different', 'alerte', 'Compteur d''arrivee different du releve SIGTB',
            t.reference, v_km::text, l.km_arrivee::text);
        END IF;
      END IF;
    END LOOP;
    -- Voyages du camion, du jour (et du shift) absents de la fiche.
    FOR t IN SELECT * FROM public.trips x
      WHERE x.vehicle_id = f.vehicle_id AND x.planned_date = f.date_fiche AND x.etat <> 'CANCELLED'
        AND (f.shift_id IS NULL OR x.shift_id = f.shift_id)
        AND NOT EXISTS (SELECT 1 FROM public.fiches_rotations_lignes y WHERE y.fiche_id = f.id AND y.trip_id = x.id)
        AND NOT EXISTS (SELECT 1 FROM public.trip_events ev WHERE ev.trip_id = x.id AND ev.donnees ->> 'fiche' = f.numero)
      ORDER BY x.reference LOOP
      INSERT INTO pg_temp.ecarts_fiche VALUES ('voyage_sans_ligne', 'alerte', 'Voyage SIGTB du camion absent de la fiche',
        t.reference, t.etat, NULL);
    END LOOP;

  ELSIF f.type = 'pointage_engins' THEN
    IF f.vehicle_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.pointages_engins WHERE fiche_id = f.id AND vehicle_id = f.vehicle_id) THEN
      INSERT INTO pg_temp.ecarts_fiche VALUES ('pointage_absent', 'alerte', 'Engin de la fiche sans pointage', f.vehicle_id::text, NULL, NULL);
    END IF;
    FOR p IN SELECT * FROM public.pointages_engins WHERE fiche_id = f.id LOOP
      IF p.heures_productives IS NULL THEN
        INSERT INTO pg_temp.ecarts_fiche VALUES ('heures_productives_absentes', 'info',
          'Heures productives non renseignees (heures moteur seules)', p.vehicle_id::text, NULL, p.heures_marche::text);
      END IF;
      SELECT max(pe.index_fin) INTO v_km FROM public.pointages_engins pe JOIN public.fiches_terrain fi ON fi.id = pe.fiche_id
       WHERE pe.vehicle_id = p.vehicle_id AND pe.fiche_id <> f.id AND fi.etat <> 'annulee' AND fi.date_fiche < f.date_fiche;
      IF v_km IS NOT NULL AND p.index_debut < v_km THEN
        INSERT INTO pg_temp.ecarts_fiche VALUES ('horametre_regression', 'alerte',
          'Index de debut inferieur au dernier index connu', p.vehicle_id::text, v_km::text, p.index_debut::text);
      ELSIF v_km IS NOT NULL AND p.index_debut > v_km THEN
        INSERT INTO pg_temp.ecarts_fiche VALUES ('horametre_saut', 'info',
          'Index de debut superieur au dernier index connu (heures hors fiche)', p.vehicle_id::text, v_km::text, p.index_debut::text);
      END IF;
      FOR a IN SELECT x FROM jsonb_array_elements(p.arrets) AS q(x) LOOP
        IF NOT EXISTS (SELECT 1 FROM public.immobilisations im
                        WHERE im.vehicle_id = p.vehicle_id AND im.statut <> 'annulee'
                          AND im.debut < (a ->> 'fin')::timestamptz AND coalesce(im.fin, now()) > (a ->> 'debut')::timestamptz) THEN
          INSERT INTO pg_temp.ecarts_fiche VALUES ('arret_sans_immobilisation', 'alerte',
            'Arret releve sur la fiche sans immobilisation declaree', p.vehicle_id::text, NULL,
            (a ->> 'debut') || ' / ' || (a ->> 'fin') || ' (' || (a ->> 'cause') || ')');
        END IF;
      END LOOP;
      v_du := coalesce(p.periode_debut, f.periode_debut, f.date_fiche::timestamptz);
      v_au := coalesce(p.periode_fin, f.periode_fin, (f.date_fiche + 1)::timestamptz);
      FOR i IN SELECT * FROM public.immobilisations im
        WHERE im.vehicle_id = p.vehicle_id AND im.statut <> 'annulee' AND im.debut < v_au AND coalesce(im.fin, now()) > v_du
          AND im.description NOT LIKE '%(fiche ' || f.numero || ')%' LOOP
        IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p.arrets) q(x)
                        WHERE (x ->> 'debut')::timestamptz < coalesce(i.fin, now()) AND (x ->> 'fin')::timestamptz > i.debut) THEN
          INSERT INTO pg_temp.ecarts_fiche VALUES ('immobilisation_sans_arret', 'alerte',
            'Immobilisation SIGTB sur la periode sans arret porte sur la fiche', p.vehicle_id::text,
            i.debut::text || ' / ' || coalesce(i.fin::text, 'en cours'), NULL);
        END IF;
      END LOOP;
      -- Engagement de disponibilite du contrat de l'engin (D-031, D-033).
      FOR e IN SELECT ce.* FROM public.contrat_tarifs ct
          JOIN public.contrat_versions cv ON cv.id = ct.version_id
          JOIN public.contrats co ON co.id = cv.contrat_id AND co.statut = 'actif'
          JOIN public.contrat_engagements ce ON ce.version_id = cv.id
         WHERE ct.engin = p.vehicle_id AND ce.indicateur = 'disponibilite' AND ce.periodicite IN ('jour', 'shift')
           AND cv.id = (SELECT v2.id FROM public.contrat_versions v2 WHERE v2.contrat_id = co.id AND v2.date_effet <= f.date_fiche
                         ORDER BY v2.date_effet DESC, v2.numero DESC LIMIT 1) LOOP
        IF p.periode_debut IS NULL OR p.periode_fin IS NULL OR lower(e.unite) NOT IN ('%', 'pct', 'pourcent', 'pourcentage') THEN
          INSERT INTO pg_temp.ecarts_fiche VALUES ('engagement_non_evaluable', 'info',
            'Engagement « ' || e.libelle || ' » non evaluable (periode ou unite)', p.vehicle_id::text, e.seuil::text || ' ' || e.unite, NULL);
        ELSE
          v_periode := extract(epoch FROM p.periode_fin - p.periode_debut) / 3600.0;
          v_dispo := round(100 * (v_periode - coalesce(p.heures_arret, 0)) / v_periode, 1);
          IF (e.sens = 'minimum' AND v_dispo < e.seuil) OR (e.sens = 'maximum' AND v_dispo > e.seuil) THEN
            INSERT INTO pg_temp.ecarts_fiche VALUES ('engagement_disponibilite', 'alerte',
              'Disponibilite hors engagement « ' || e.libelle || ' »', p.vehicle_id::text, e.sens || ' ' || e.seuil::text, v_dispo::text);
          END IF;
        END IF;
      END LOOP;
    END LOOP;

  ELSE
    FOR l IN SELECT x.*, v.site_id AS site_engin FROM public.fiches_carburant_lignes x
               JOIN public.vehicles v ON v.id = x.vehicle_id WHERE x.fiche_id = f.id ORDER BY x.rang LOOP
      IF l.stockage_id IS NULL THEN
        INSERT INTO pg_temp.ecarts_fiche VALUES ('sans_cuve', 'alerte', 'Distribution sans cuve source (hors registre)',
          'ligne ' || l.rang, NULL, NULL);
      END IF;
      IF NOT l.destinataire_confirme THEN
        INSERT INTO pg_temp.ecarts_fiche VALUES ('destinataire_non_confirme', 'alerte', 'Reception non confirmee par le destinataire',
          'ligne ' || l.rang, NULL, NULL);
      END IF;
      IF l.index_pompe_debut IS NOT NULL AND l.index_pompe_fin IS NOT NULL
         AND abs((l.index_pompe_fin - l.index_pompe_debut) - l.litres) > 0.5 THEN
        INSERT INTO pg_temp.ecarts_fiche VALUES ('index_pompe_ecart', 'alerte', 'Litres differents de l''ecart d''index de la pompe',
          'ligne ' || l.rang, (l.index_pompe_fin - l.index_pompe_debut)::text, l.litres::text);
      END IF;
      IF l.distribue_le IS NOT NULL AND (l.distribue_le AT TIME ZONE 'UTC')::date <> f.date_fiche THEN
        INSERT INTO pg_temp.ecarts_fiche VALUES ('date_distribution', 'alerte', 'Distribution datee d''un autre jour que la fiche',
          'ligne ' || l.rang, f.date_fiche::text, l.distribue_le::text);
      END IF;
      IF l.site_engin IS NOT NULL AND l.site_engin <> f.site_id THEN
        INSERT INTO pg_temp.ecarts_fiche VALUES ('engin_hors_site', 'info', 'Engin rattache a un autre site', 'ligne ' || l.rang,
          f.site_id::text, l.site_engin::text);
      END IF;
    END LOOP;
    FOR c IN SELECT x.stockage_id, sc.code, sum(x.litres) AS litres FROM public.fiches_carburant_lignes x
               JOIN public.stockages_carburant sc ON sc.id = x.stockage_id
              WHERE x.fiche_id = f.id AND x.fuel_transaction_id IS NULL GROUP BY 1, 2 LOOP
      v_solde := public.solde_stockage_carburant(c.stockage_id);
      IF v_solde IS NULL THEN
        INSERT INTO pg_temp.ecarts_fiche VALUES ('stock_sans_donnees', 'info', 'Solde de la cuve inconnu (aucun inventaire valide)',
          c.code, NULL, c.litres::text);
      ELSIF v_solde < c.litres THEN
        INSERT INTO pg_temp.ecarts_fiche VALUES ('stock_insuffisant', 'alerte', 'Litres distribues superieurs au solde valide de la cuve',
          c.code, v_solde::text, c.litres::text);
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.fiches_ecarts (fiche_id, controle_no, code, gravite, libelle, objet, attendu, constate)
  SELECT f.id, v_no, x.code, x.gravite, x.libelle, x.objet, x.attendu, x.constate FROM pg_temp.ecarts_fiche x;
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.fiches_terrain SET controle_no = v_no, controle_par = auth.uid(), controle_le = clock_timestamp(), nb_ecarts = n
   WHERE id = p_id;
  PERFORM public.fiche_journaliser(p_id, 'controle', f.etat, NULL,
    jsonb_build_object('controle_no', v_no, 'ecarts', n,
      'alertes', (SELECT count(*) FROM pg_temp.ecarts_fiche x WHERE x.gravite = 'alerte')));
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.renvoyer_fiche_correction(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE f public.fiches_terrain := public.fiche_verrou(p_id, NULL, NULL);
BEGIN
  IF f.etat <> 'a_controler' THEN
    RAISE EXCEPTION 'Fiche % a l''etat % : seule une fiche soumise se renvoie', f.numero, f.etat USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motif obligatoire pour renvoyer une fiche en correction' USING ERRCODE = '22023';
  END IF;
  PERFORM public.fiche_passer(p_id, 'a_corriger', 'renvoi_correction', p_motif);
END;
$$;

-- Validation : par une autre personne que les auteurs de la saisie
-- (separation_violee, delegations comprises), sur le dernier controle
-- posterieur a la derniere modification, motif si ecarts. FC : ecriture des
-- sorties de stock des lignes non comptabilisees, une seule fois.
CREATE OR REPLACE FUNCTION public.valider_fiche(p_id uuid, p_motif text DEFAULT NULL, p_version integer DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f public.fiches_terrain := public.fiche_verrou(p_id, NULL, NULL);
  v_module text := public.fiche_module(f.type); l public.fiches_carburant_lignes; s public.stockages_carburant;
  v_tx uuid; v_mvt uuid; v_ref text; n integer := 0;
BEGIN
  IF f.etat IN ('validee', 'archivee') THEN
    RETURN f.etat;
  END IF;
  IF p_version IS NOT NULL AND p_version <> f.version THEN
    RAISE EXCEPTION 'Fiche % modifiee entre-temps (version % attendue, % en base) : recharger', f.numero, p_version, f.version
      USING ERRCODE = '40001';
  END IF;
  IF f.etat <> 'a_controler' THEN
    RAISE EXCEPTION 'Fiche % a l''etat % : validation prematuree refusee (saisie terminee, soumise et controlee requises)',
      f.numero, f.etat USING ERRCODE = '22023';
  END IF;
  IF f.controle_le IS NULL OR (f.donnees_modifiees_le IS NOT NULL AND f.controle_le < f.donnees_modifiees_le) THEN
    RAISE EXCEPTION 'Fiche % : controle absent ou anterieur a la derniere saisie, controle a refaire', f.numero USING ERRCODE = '22023';
  END IF;
  IF public.separation_violee(f.saisie_par, v_module, v_module, f.saisie_le)
     OR EXISTS (SELECT 1 FROM public.fiches_journal j
                 WHERE j.fiche_id = f.id AND j.auteur IS NOT NULL
                   AND j.action IN ('saisie', 'saisie_anticipee', 'correction', 'brouillon', 'fin_saisie', 'debut_saisie')
                   AND public.separation_violee(j.auteur, v_module, v_module, j.survenu_le)) THEN
    RAISE EXCEPTION 'separation_violee : la validation revient a une autre personne que les auteurs de la saisie de la fiche %',
      f.numero USING ERRCODE = '42501';
  END IF;
  IF coalesce(f.nb_ecarts, 0) > 0 AND nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Fiche % : % ecart(s) au controle, motif de validation obligatoire', f.numero, f.nb_ecarts USING ERRCODE = '22023';
  END IF;
  IF f.type = 'carburant' THEN
    FOR l IN SELECT * FROM public.fiches_carburant_lignes WHERE fiche_id = f.id AND fuel_transaction_id IS NULL ORDER BY rang FOR UPDATE LOOP
      IF l.stockage_id IS NULL THEN
        RAISE EXCEPTION 'Ligne % sans cuve source : distribution hors registre refusee', l.rang USING ERRCODE = '22023';
      END IF;
      s := public.stockage_ecrivable(l.stockage_id);
      v_ref := f.numero || '-' || lpad(l.rang::text, 2, '0');
      IF EXISTS (SELECT 1 FROM public.fuel_transactions WHERE reference = v_ref) THEN
        RAISE EXCEPTION 'Sortie de stock % deja ecrite : double sortie refusee', v_ref USING ERRCODE = '23505';
      END IF;
      INSERT INTO public.fuel_transactions (transaction_date, vehicle_id, driver_id, volume_liters, quantity, unit_price,
        total_cost, total_amount, transaction_type, supplier, reference, site_id, odometer_reading, notes, created_by)
      VALUES ((l.distribue_le AT TIME ZONE 'UTC')::date, l.vehicle_id, l.driver_id, l.litres, l.litres, NULL, NULL, NULL,
        'refuel', 'CBG', v_ref, f.site_id, l.compteur_km, 'Fiche ' || f.numero, coalesce(l.saisi_par, auth.uid()))
      RETURNING id INTO v_tx;
      INSERT INTO public.mouvements_carburant (stockage_id, type, variation, date_mouvement, reference_piece,
        fuel_transaction_id, note, saisi_par)
      VALUES (s.id, 'distribution', -l.litres, l.distribue_le, v_ref, v_tx, 'Fiche ' || f.numero || ' validee',
        coalesce(l.saisi_par, auth.uid()))
      RETURNING id INTO v_mvt;
      UPDATE public.fiches_carburant_lignes SET fuel_transaction_id = v_tx, mouvement_id = v_mvt, comptabilise_le = now()
       WHERE id = l.id;
      n := n + 1;
    END LOOP;
  END IF;
  UPDATE public.fiches_terrain SET valide_par = auth.uid(), valide_le = now(),
         motif_validation = nullif(btrim(coalesce(p_motif, '')), '') WHERE id = p_id;
  PERFORM public.fiche_passer(p_id, 'validee', 'validation', p_motif,
    jsonb_build_object('controle_no', f.controle_no, 'ecarts', f.nb_ecarts, 'sorties_stock', n));
  RETURN 'validee';
END;
$$;

CREATE OR REPLACE FUNCTION public.archiver_fiche(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE f public.fiches_terrain := public.fiche_verrou(p_id, NULL, NULL);
BEGIN
  IF f.etat <> 'validee' THEN
    RAISE EXCEPTION 'Fiche % a l''etat % : seule une fiche validee s''archive', f.numero, f.etat USING ERRCODE = '22023';
  END IF;
  PERFORM public.fiche_passer(p_id, 'archivee', 'archivage');
  UPDATE public.fiches_terrain SET archive_par = auth.uid(), archive_le = now() WHERE id = p_id;
END;
$$;

-- Ecarts du dernier controle de chaque fiche (lecture, RLS de l'appelant).
CREATE OR REPLACE VIEW public.v_fiches_ecarts_courants WITH (security_invoker = true) AS
SELECT e.* FROM public.fiches_ecarts e JOIN public.fiches_terrain f ON f.id = e.fiche_id AND e.controle_no = f.controle_no;
REVOKE ALL ON public.v_fiches_ecarts_courants FROM anon;
GRANT SELECT ON public.v_fiches_ecarts_courants TO authenticated;

-- Droits d'execution de l'API du cycle.
DO $$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY[
    'public.generer_fiches_rotation(date, uuid, uuid, text, text)',
    'public.creer_fiche(text, date, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, jsonb, jsonb, boolean, timestamptz, timestamptz)',
    'public.preparer_contenu_fiche(uuid, jsonb, integer)',
    'public.changer_etat_fiche(uuid, text, text, integer)',
    'public.enregistrer_impression_fiches(uuid[], text)',
    'public.attribuer_fiches(uuid[], text, uuid)',
    'public.creer_lot_fiches(uuid[], text, uuid, text)',
    'public.remettre_fiches(uuid[], text, uuid, timestamptz, uuid, text)',
    'public.confirmer_remise(uuid, text)',
    'public.enregistrer_retour_fiches(text, jsonb, uuid, timestamptz, uuid, text)',
    'public.enregistrer_brouillon_fiche(uuid, jsonb, integer)',
    'public.saisir_ligne_rotation(uuid, integer, jsonb, text)',
    'public.saisir_pointage_fiche(uuid, uuid, numeric, numeric, numeric, timestamptz, timestamptz, jsonb, text, text, text, text)',
    'public.saisir_ligne_carburant(uuid, integer, jsonb, text)',
    'public.soumettre_fiche_controle(uuid, integer)',
    'public.controler_fiche(uuid)',
    'public.renvoyer_fiche_correction(uuid, text)',
    'public.valider_fiche(uuid, text, integer)',
    'public.archiver_fiche(uuid)',
    'public.suivre_fiche(uuid, text, text, timestamptz)',
    'public.annuler_fiche(uuid, text)',
    'public.terminer_saisie_fiche(uuid, text)',
    'public.saisir_pointage(uuid, uuid, numeric, numeric, text, text, jsonb)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', s);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', s);
  END LOOP;
END $$;
