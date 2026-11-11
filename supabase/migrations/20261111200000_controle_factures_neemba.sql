/*
  # Controle des factures du loueur (phase 5 du poste charge de contrats, D-032)

  Fiche de poste : « controler les factures emises par Neemba et notifier
  formellement tout ecart constate » ; indicateur « montant des ecarts
  detectes et recouvres sur les factures Neemba ».

  1. `factures_fournisseur` et `factures_fournisseur_lignes` : facture recue
     (contrat de location, numero du loueur, periode, devise), lignes par
     engin (heures et taux factures).
  2. `controler_facture_fournisseur(id)` : pour chaque ligne d'engin,
     heures attendues = heures de marche pointees sur les fiches de la
     periode (preuve signee) ; taux attendu = tarif a l'heure de la version
     du contrat en vigueur a la fin de la periode (meme categorie de
     materiel si renseignee, sinon tarif horaire unique) ; heures d'arret a
     la charge du loueur sur la periode (information) ; ecart = facture -
     attendu. Sans pointage ou sans tarif : attendu non calcule, ligne
     signalee, rien n'est estime.
  3. `notifier_ecart_fournisseur(id, date, reference)` : notification
     formelle datee du montant reclame (ecarts positifs).
  4. `enregistrer_regularisation(id, date, montant, mode, reference, note)` :
     suivi jusqu'au recouvrement (avoir, deduction, remboursement).
  5. `indicateurs_charge_contrats()` etendu : ecarts detectes et recouvres.

  Limite v1 : la franchise, l'arrondi, le plafond et le minimum du modele
  de location (D-013) ne sont pas appliques ; ils le seront quand les
  parametres de location seront saisis au dossier contractuel.

  Idempotent : IF NOT EXISTS, CREATE OR REPLACE, DROP ... IF EXISTS.
*/

CREATE TABLE IF NOT EXISTS public.factures_fournisseur (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrat_id uuid NOT NULL REFERENCES public.contrats(id),
  numero_fournisseur text NOT NULL,
  date_facture date NOT NULL,
  periode_debut date NOT NULL,
  periode_fin date NOT NULL,
  devise text NOT NULL,
  montant_ht_facture numeric NOT NULL CHECK (montant_ht_facture >= 0),
  montant_ttc_facture numeric,
  statut text NOT NULL DEFAULT 'saisie' CHECK (statut IN ('saisie', 'controlee', 'notifiee', 'regularisee', 'conforme')),
  montant_attendu numeric,
  ecart_total numeric,
  montant_reclame numeric,
  controle_le timestamptz,
  controle_par uuid REFERENCES auth.users(id),
  notifiee_le date,
  reference_notification text,
  saisie_par uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  saisie_le timestamptz NOT NULL DEFAULT now(),
  note text,
  UNIQUE (contrat_id, numero_fournisseur),
  CONSTRAINT factures_fournisseur_periode CHECK (periode_fin >= periode_debut)
);

CREATE TABLE IF NOT EXISTS public.factures_fournisseur_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id uuid NOT NULL REFERENCES public.factures_fournisseur(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id),
  libelle text NOT NULL,
  categorie_materiel text,
  heures_facturees numeric CHECK (heures_facturees >= 0),
  taux_facture numeric CHECK (taux_facture >= 0),
  montant_facture numeric NOT NULL,
  heures_attendues numeric,
  taux_attendu numeric,
  montant_attendu numeric,
  heures_arret_loueur numeric,
  ecart numeric,
  constat text
);

CREATE TABLE IF NOT EXISTS public.regularisations_fournisseur (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id uuid NOT NULL REFERENCES public.factures_fournisseur(id),
  date_regularisation date NOT NULL,
  montant numeric NOT NULL CHECK (montant > 0),
  mode text NOT NULL CHECK (mode IN ('avoir', 'deduction', 'remboursement')),
  reference text,
  note text,
  saisi_par uuid REFERENCES auth.users(id),
  saisi_le timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['factures_fournisseur', 'factures_fournisseur_lignes', 'regularisations_fournisseur'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS lecture_module ON public.%I', t);
    EXECUTE format('CREATE POLICY lecture_module ON public.%I FOR SELECT TO authenticated
      USING (public.has_module_view(''contracts'') OR public.is_admin())', t);
  END LOOP;
END $$;
-- Saisie directe de la facture recue et de ses lignes tant qu'elle n'est
-- pas notifiee ; regularisations par fonction seulement.
REVOKE ALL ON public.factures_fournisseur, public.factures_fournisseur_lignes, public.regularisations_fournisseur FROM authenticated;
-- Colonnes de saisie seulement : les resultats du controle sont ecrits par
-- le serveur.
GRANT SELECT, DELETE ON public.factures_fournisseur, public.factures_fournisseur_lignes TO authenticated;
GRANT INSERT (id, contrat_id, numero_fournisseur, date_facture, periode_debut, periode_fin, devise, montant_ht_facture,
  montant_ttc_facture, note), UPDATE (numero_fournisseur, date_facture, periode_debut, periode_fin, devise,
  montant_ht_facture, montant_ttc_facture, note) ON public.factures_fournisseur TO authenticated;
GRANT INSERT (id, facture_id, vehicle_id, libelle, categorie_materiel, heures_facturees, taux_facture, montant_facture),
  UPDATE (vehicle_id, libelle, categorie_materiel, heures_facturees, taux_facture, montant_facture)
  ON public.factures_fournisseur_lignes TO authenticated;
GRANT SELECT ON public.regularisations_fournisseur TO authenticated;
DROP POLICY IF EXISTS saisie_module ON public.factures_fournisseur;
CREATE POLICY saisie_module ON public.factures_fournisseur FOR ALL TO authenticated
  USING ((public.has_module_write('contracts') OR public.is_admin()) AND statut IN ('saisie', 'controlee'))
  WITH CHECK ((public.has_module_write('contracts') OR public.is_admin()) AND statut IN ('saisie', 'controlee'));
DROP POLICY IF EXISTS saisie_module ON public.factures_fournisseur_lignes;
CREATE POLICY saisie_module ON public.factures_fournisseur_lignes FOR ALL TO authenticated
  USING ((public.has_module_write('contracts') OR public.is_admin())
         AND EXISTS (SELECT 1 FROM public.factures_fournisseur f WHERE f.id = facture_id AND f.statut IN ('saisie', 'controlee')))
  WITH CHECK ((public.has_module_write('contracts') OR public.is_admin())
         AND EXISTS (SELECT 1 FROM public.factures_fournisseur f WHERE f.id = facture_id AND f.statut IN ('saisie', 'controlee')));

CREATE OR REPLACE FUNCTION public.controler_facture_fournisseur(p_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f public.factures_fournisseur;
  v_version uuid;
  v_taux_unique numeric;
  l public.factures_fournisseur_lignes;
  v_heures numeric;
  v_taux numeric;
  v_arret numeric;
  v_constat text;
BEGIN
  IF NOT public.has_module_write('contracts') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les contrats requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO f FROM public.factures_fournisseur WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR f.statut NOT IN ('saisie', 'controlee') THEN
    RAISE EXCEPTION 'Facture introuvable ou deja notifiee' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.factures_fournisseur_lignes WHERE facture_id = p_id) THEN
    RAISE EXCEPTION 'Saisir les lignes de la facture avant le controle' USING ERRCODE = '22023';
  END IF;
  SELECT v.id INTO v_version FROM public.contrat_versions v
  WHERE v.contrat_id = f.contrat_id AND v.date_effet <= f.periode_fin ORDER BY v.numero DESC LIMIT 1;
  SELECT CASE WHEN count(*) = 1 THEN max(prix) END INTO v_taux_unique
  FROM public.contrat_tarifs WHERE version_id = v_version AND unite = 'heure';

  FOR l IN SELECT * FROM public.factures_fournisseur_lignes WHERE facture_id = p_id LOOP
    v_constat := NULL;
    v_heures := NULL;
    v_arret := NULL;
    v_taux := NULL;
    IF l.vehicle_id IS NULL THEN
      v_constat := 'Ligne sans engin : non controlee';
    ELSE
      SELECT sum(p.heures_marche) INTO v_heures FROM public.pointages_engins p
      JOIN public.fiches_terrain fi ON fi.id = p.fiche_id
      WHERE p.vehicle_id = l.vehicle_id AND fi.date_fiche BETWEEN f.periode_debut AND f.periode_fin;
      SELECT sum(heures) INTO v_arret FROM public.heures_immobilisation(f.periode_debut::timestamptz, (f.periode_fin + 1)::timestamptz) h
      WHERE h.vehicle_id = l.vehicle_id AND h.imputation = 'loueur';
      SELECT t.prix INTO v_taux FROM public.contrat_tarifs t
      WHERE t.version_id = v_version AND t.unite = 'heure' AND l.categorie_materiel IS NOT NULL
        AND lower(t.categorie_materiel) = lower(l.categorie_materiel) LIMIT 1;
      v_taux := coalesce(v_taux, v_taux_unique);
      IF v_heures IS NULL THEN v_constat := 'Aucun pointage sur la periode : heures non verifiables'; END IF;
      IF v_taux IS NULL THEN v_constat := concat_ws(' ; ', v_constat, 'Tarif horaire du contrat introuvable pour cette categorie'); END IF;
    END IF;
    UPDATE public.factures_fournisseur_lignes SET
      heures_attendues = round(v_heures, 2), taux_attendu = v_taux, heures_arret_loueur = round(v_arret, 2),
      montant_attendu = CASE WHEN v_heures IS NOT NULL AND v_taux IS NOT NULL THEN round(v_heures * v_taux, 2) END,
      ecart = CASE WHEN v_heures IS NOT NULL AND v_taux IS NOT NULL THEN round(l.montant_facture - v_heures * v_taux, 2) END,
      constat = v_constat
    WHERE id = l.id;
  END LOOP;

  UPDATE public.factures_fournisseur SET
    statut = 'controlee', controle_le = now(), controle_par = auth.uid(),
    montant_attendu = (SELECT sum(montant_attendu) FROM public.factures_fournisseur_lignes WHERE facture_id = p_id),
    ecart_total = (SELECT sum(ecart) FROM public.factures_fournisseur_lignes WHERE facture_id = p_id),
    montant_reclame = (SELECT coalesce(sum(ecart) FILTER (WHERE ecart > 0), 0) FROM public.factures_fournisseur_lignes WHERE facture_id = p_id)
  WHERE id = p_id;
  RETURN (SELECT montant_reclame FROM public.factures_fournisseur WHERE id = p_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.notifier_ecart_fournisseur(p_id uuid, p_date date, p_reference text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f public.factures_fournisseur;
BEGIN
  IF NOT public.has_module_write('contracts') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les contrats requis' USING ERRCODE = '42501';
  END IF;
  IF p_date IS NULL OR p_date > current_date THEN
    RAISE EXCEPTION 'Date de notification requise et non future' USING ERRCODE = '22023';
  END IF;
  -- Controle relance juste avant : la notification porte sur les lignes
  -- telles qu'elles sont a cet instant.
  PERFORM public.controler_facture_fournisseur(p_id);
  SELECT * INTO f FROM public.factures_fournisseur WHERE id = p_id FOR UPDATE;
  IF p_date IS NULL THEN
    RAISE EXCEPTION 'Date de notification requise et non future' USING ERRCODE = '22023';
  END IF;
  IF coalesce(f.montant_reclame, 0) <= 0 THEN
    UPDATE public.factures_fournisseur SET statut = 'conforme' WHERE id = p_id;
    RETURN 'conforme';
  END IF;
  UPDATE public.factures_fournisseur SET statut = 'notifiee', notifiee_le = p_date,
    reference_notification = nullif(btrim(coalesce(p_reference, '')), '') WHERE id = p_id;
  RETURN 'notifiee';
END;
$$;

CREATE OR REPLACE FUNCTION public.enregistrer_regularisation(
  p_id uuid, p_date date, p_montant numeric, p_mode text, p_reference text DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f public.factures_fournisseur;
  v_recouvre numeric;
BEGIN
  IF NOT public.has_module_write('contracts') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les contrats requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO f FROM public.factures_fournisseur WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR f.statut <> 'notifiee' THEN
    RAISE EXCEPTION 'Regularisation sur un ecart notifie seulement' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(sum(montant), 0) INTO v_recouvre FROM public.regularisations_fournisseur WHERE facture_id = p_id;
  IF p_montant IS NULL OR p_montant <= 0 OR p_montant > f.montant_reclame - v_recouvre THEN
    RAISE EXCEPTION 'Montant positif et au plus egal au reste reclame (%)', f.montant_reclame - v_recouvre USING ERRCODE = '22023';
  END IF;
  IF p_date IS NULL OR p_date > current_date OR p_date < f.notifiee_le THEN
    RAISE EXCEPTION 'Date entre la notification et aujourd''hui' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.regularisations_fournisseur (facture_id, date_regularisation, montant, mode, reference, note, saisi_par)
  VALUES (p_id, p_date, p_montant, p_mode, nullif(btrim(coalesce(p_reference, '')), ''), nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
  v_recouvre := v_recouvre + p_montant;
  IF v_recouvre >= f.montant_reclame THEN
    UPDATE public.factures_fournisseur SET statut = 'regularisee' WHERE id = p_id;
  END IF;
  RETURN f.montant_reclame - v_recouvre;
END;
$$;

DO $$
DECLARE
  s text;
BEGIN
  FOREACH s IN ARRAY ARRAY[
    'public.controler_facture_fournisseur(uuid)',
    'public.notifier_ecart_fournisseur(uuid, date, text)',
    'public.enregistrer_regularisation(uuid, date, numeric, text, text, text)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', s);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', s);
  END LOOP;
END $$;

-- Indicateurs etendus (ecarts detectes et recouvres) : nouvelles colonnes
DROP FUNCTION IF EXISTS public.indicateurs_charge_contrats();
CREATE FUNCTION public.indicateurs_charge_contrats()
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
      WHERE type = 'facture' AND statut = 'emise' AND date_emission >= current_date - 365 AND periode_fin IS NOT NULL),
    (SELECT count(*)::integer FROM public.factures WHERE type = 'facture' AND statut = 'emise' AND date_emission >= current_date - 365),
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
