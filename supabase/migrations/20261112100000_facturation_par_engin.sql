/*
  # Type de facturation et tarif par engin (D-033)

  Declaration du proprietaire du 2026-11-11 : pour chaque engin du dossier
  contractuel, on choisit le type de facturation (l'unite) et le tarif.
  Configuration de depart : camions bennes au kilometre parcouru, chargeuses
  et pelle a l'heure. Leve la limite v1 de D-032 (base heures seulement).

  1. `contrat_tarifs.engin` : un tarif peut etre attache a un engin precis.
     Resolution du tarif d'une ligne d'engin, par priorite : tarif de
     l'engin, puis tarif de sa categorie de materiel, puis tarif unique de
     la version (sans engin ni categorie). L'unite du tarif retenu fixe la
     base de la confrontation.
  2. `factures_fournisseur_lignes` : quantite et unite facturees (la facture
     du loueur porte sa propre unite ; les lignes v1 en heures sont
     requalifiees), et resultat du controle en quantite : quantite attendue
     et unite attendue. Les colonnes heures_* restent remplies pour les
     lignes a l'heure (compatibilite des ecrits existants).
  3. `controler_facture_fournisseur` etendu :
     - unite « heure » : heures de marche pointees sur les fiches signees
       de la periode (D-028) + heures d'arret imputees au loueur ;
     - unite « km » : releve kilometrique des voyages livres de la periode
       (km_end - km_start, meme source que les engagements, D-031) ;
     - autre unite : non controlee automatiquement, ligne signalee, rien
       n'est estime ;
     - facturee dans une unite differente de celle du contrat : ecart calcule
       sur les montants, quantites signalees non comparables.

  Idempotent : ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE.
*/

-- 1. Tarif par engin (grants de table : la colonne suit).
ALTER TABLE public.contrat_tarifs ADD COLUMN IF NOT EXISTS engin uuid REFERENCES public.vehicles(id);
CREATE INDEX IF NOT EXISTS idx_contrat_tarifs_engin ON public.contrat_tarifs (version_id, engin);

-- 2. Quantite et unite sur les lignes de facture fournisseur.
ALTER TABLE public.factures_fournisseur_lignes
  ADD COLUMN IF NOT EXISTS quantite_facturee numeric CHECK (quantite_facturee >= 0),
  ADD COLUMN IF NOT EXISTS unite_facturee text
    CHECK (unite_facturee IN ('tonne', 'heure', 'km', 'jour', 'mois', 'forfait', 'autre')),
  ADD COLUMN IF NOT EXISTS quantite_attendue numeric,
  ADD COLUMN IF NOT EXISTS unite_attendue text;

-- Lignes saisies en v1 : c'etaient des heures (D-032).
UPDATE public.factures_fournisseur_lignes
   SET quantite_facturee = heures_facturees, unite_facturee = 'heure'
 WHERE quantite_facturee IS NULL AND heures_facturees IS NOT NULL;

-- Saisie : les nouvelles colonnes sont modifiables avec les anciennes.
GRANT INSERT (quantite_facturee, unite_facturee), UPDATE (quantite_facturee, unite_facturee)
  ON public.factures_fournisseur_lignes TO authenticated;

-- 3. Controle dans l'unite du tarif de l'engin.
CREATE OR REPLACE FUNCTION public.controler_facture_fournisseur(p_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f public.factures_fournisseur;
  v_version uuid;
  l public.factures_fournisseur_lignes;
  v_quantite numeric;
  v_unite text;
  v_taux numeric;
  v_arret numeric;
  v_constat text;
  v_unite_facturee text;
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

  FOR l IN SELECT * FROM public.factures_fournisseur_lignes WHERE facture_id = p_id LOOP
    v_constat := NULL;
    v_quantite := NULL;
    v_unite := NULL;
    v_taux := NULL;
    v_arret := NULL;
    -- Lignes v1 : quantite non renseignee mais heures presentes = heures.
    v_unite_facturee := coalesce(l.unite_facturee,
                                 CASE WHEN l.quantite_facturee IS NOT NULL THEN NULL ELSE 'heure' END);
    IF l.vehicle_id IS NULL THEN
      v_constat := 'Ligne sans engin : non controlee';
    ELSE
      -- Tarif de l'engin : par engin d'abord, puis categorie (D-033).
      SELECT t.prix, t.unite INTO v_taux, v_unite
        FROM public.contrat_tarifs t
       WHERE t.version_id = v_version
         AND (t.engin = l.vehicle_id
              OR (t.engin IS NULL AND t.categorie_materiel IS NOT NULL
                  AND l.categorie_materiel IS NOT NULL
                  AND lower(t.categorie_materiel) = lower(l.categorie_materiel)))
       ORDER BY (t.engin IS NOT DISTINCT FROM l.vehicle_id) DESC, t.ordre
       LIMIT 1;
      IF v_taux IS NULL THEN
        -- Tarif unique de la version (sans engin ni categorie) : retenu
        -- seulement s'il est seul, pour ne pas choisir arbitrairement.
        SELECT CASE WHEN count(*) = 1 THEN max(prix) END,
               CASE WHEN count(*) = 1 THEN max(unite) END
          INTO v_taux, v_unite
          FROM public.contrat_tarifs
         WHERE version_id = v_version AND engin IS NULL AND categorie_materiel IS NULL;
      END IF;

      IF v_unite = 'heure' THEN
        SELECT sum(p.heures_marche) INTO v_quantite FROM public.pointages_engins p
        JOIN public.fiches_terrain fi ON fi.id = p.fiche_id
        WHERE p.vehicle_id = l.vehicle_id AND fi.date_fiche BETWEEN f.periode_debut AND f.periode_fin;
        SELECT sum(heures) INTO v_arret FROM public.heures_immobilisation(f.periode_debut::timestamptz, (f.periode_fin + 1)::timestamptz) h
        WHERE h.vehicle_id = l.vehicle_id AND h.imputation = 'loueur';
        IF v_quantite IS NULL THEN v_constat := 'Aucun pointage sur la periode : heures non verifiables'; END IF;
      ELSIF v_unite = 'km' THEN
        SELECT sum(km_end - km_start) INTO v_quantite FROM public.trips
        WHERE vehicle_id = l.vehicle_id AND planned_date BETWEEN f.periode_debut AND f.periode_fin
          AND etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')
          AND km_end IS NOT NULL AND km_start IS NOT NULL AND km_end >= km_start;
        IF v_quantite IS NULL THEN v_constat := 'Aucun releve kilometrique sur les voyages livres de la periode'; END IF;
      ELSIF v_unite IS NOT NULL THEN
        v_constat := concat_ws(' ; ', v_constat,
          format('Unite %s du tarif : controle automatique non prevu', v_unite));
      END IF;

      IF v_taux IS NULL THEN
        v_constat := concat_ws(' ; ', v_constat, 'Tarif du contrat introuvable pour cet engin');
      END IF;
      IF v_unite_facturee IS NOT NULL AND v_unite IS NOT NULL AND v_unite_facturee <> v_unite THEN
        v_constat := concat_ws(' ; ', v_constat,
          format('Facturee en %s, contrat en %s : quantites non comparables', v_unite_facturee, v_unite));
      END IF;
    END IF;

    UPDATE public.factures_fournisseur_lignes SET
      quantite_attendue = round(v_quantite, 2),
      unite_attendue = v_unite,
      heures_attendues = CASE WHEN v_unite = 'heure' THEN round(v_quantite, 2) END,
      taux_attendu = v_taux, heures_arret_loueur = round(v_arret, 2),
      montant_attendu = CASE WHEN v_quantite IS NOT NULL AND v_taux IS NOT NULL THEN round(v_quantite * v_taux, 2) END,
      ecart = CASE WHEN v_quantite IS NOT NULL AND v_taux IS NOT NULL THEN round(l.montant_facture - v_quantite * v_taux, 2) END,
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
