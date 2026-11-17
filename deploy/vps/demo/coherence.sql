/*
  Controles de coherence des donnees d'exemple (D-084), lecture seule.
  Une requete par chaine ; chaque ligne porte un verdict `ok`.
  Execution : bash deploy/vps/demo/demo.sh coherence
*/
\set ON_ERROR_STOP on

\echo '=== J1 : voyage -> ticket CBG -> ligne de reconciliation -> facture -> encaissement'
SELECT t.reference AS voyage, v.registration AS camion, t.etat, tk.ticket, tk.brut - tk.tare AS net_ticket, v.capacity_tonnes AS capacite,
       l.tonnage_base, public.statut_ligne(l.decision, l.anomalies) AS statut_ligne, f.numero AS facture, f.statut AS statut_facture,
       (tk.brut - tk.tare) <= v.capacity_tonnes AND l.tonnage_base = tk.brut - tk.tare AND f.statut = 'emise'
         AND public.statut_ligne(l.decision, l.anomalies) = 'facturable' AS ok
  FROM public.trips t
  JOIN public.vehicles v ON v.id = t.vehicle_id
  JOIN public.tickets_pesee_cbg tk ON tk.trip_id = t.id
  JOIN public.reconciliation_lignes l ON l.trip_id = t.id
  JOIN public.reconciliations r ON r.id = l.reconciliation_id
  JOIN public.factures f ON f.reconciliation_id = r.id
 WHERE t.id::text LIKE 'dec0de00-%'
 ORDER BY t.reference;

\echo '=== J1 (D-081) : releve officiel CBG -> releve KOGON -> rapprochement concordant -> tonnage de base de la reconciliation'
SELECT rl.ticket, rl.brut - rl.tare AS net_cbg_officiel, k.net_kogon, rp.classes, l.tonnage_cbg, l.tonnage_base,
       rp.classes = ARRAY['concordant'] AND l.tonnage_cbg = rl.brut - rl.tare AND l.tonnage_base = rl.brut - rl.tare
         AND NOT EXISTS (SELECT 1 FROM public.anomalies_pesee a WHERE a.ligne_id = rl.id AND a.statut <> 'cloturee') AS ok
  FROM public.releves_cbg r
  JOIN public.releves_cbg_lignes rl ON rl.releve_id = r.id
  JOIN public.rapprochements_pesee rp ON rp.ligne_id = rl.id
  LEFT JOIN LATERAL (SELECT rp.net_kogon) k ON true
  JOIN public.reconciliation_lignes l ON l.trip_id = rp.trip_id
 WHERE r.id::text LIKE 'dec0de00-%' AND r.statut <> 'annule'
 ORDER BY rl.ticket;

\echo '=== J1 : facture = somme des lignes = tonnage facturable x tarif ; TTC = HT + TVA ; encaissements = TTC'
SELECT f.numero, r.tonnage_facturable, (SELECT sum(l.tonnage_base) FROM public.reconciliation_lignes l WHERE l.reconciliation_id = r.id) AS somme_lignes_reconciliation,
       f.montant_ht, (SELECT sum(fl.montant) FROM public.facture_lignes fl WHERE fl.facture_id = f.id) AS somme_lignes_facture,
       f.montant_taxe, f.montant_ttc, (SELECT coalesce(sum(e.montant), 0) FROM public.encaissements e WHERE e.facture_id = f.id) AS encaisse,
       f.montant_ht = (SELECT sum(fl.montant) FROM public.facture_lignes fl WHERE fl.facture_id = f.id)
         AND f.montant_ht = round(r.tonnage_facturable * (SELECT t.prix FROM public.contrat_tarifs t
                                JOIN public.contrat_versions cv ON cv.id = t.version_id WHERE cv.contrat_id = f.contrat_id AND t.unite = 'tonne'), 2)
         AND r.tonnage_facturable = (SELECT sum(l.tonnage_base) FROM public.reconciliation_lignes l WHERE l.reconciliation_id = r.id)
         AND f.montant_ttc = f.montant_ht + f.montant_taxe
         AND f.montant_taxe = round(f.montant_ht * f.taux_taxe_pct / 100, 2)
         AND f.montant_ttc = (SELECT sum(e.montant) FROM public.encaissements e WHERE e.facture_id = f.id) AS ok
  FROM public.factures f JOIN public.reconciliations r ON r.id = f.reconciliation_id
 WHERE f.id::text LIKE 'dec0de00-%';

\echo '=== J1 : releves kilometriques -> distance validee (mesure, ou reference avec motif)'
SELECT t.reference, d.mesure_charge_km, d.distance_reference_km, d.validee_charge_km, d.validee_retour_km, d.motif,
       (d.mesure_charge_km IS NOT DISTINCT FROM d.validee_charge_km OR d.motif IS NOT NULL) AS ok
  FROM public.distances_voyage d JOIN public.trips t ON t.id = d.trip_id
 WHERE t.id::text LIKE 'dec0de00-%' ORDER BY t.reference;

\echo '=== J2 : facture Neemba, ligne par engin contre releve (km valides) ou pointage (heures) ; paiement'
SELECT ff.numero_fournisseur, fl.libelle, fl.quantite_facturee, fl.quantite_attendue, fl.unite_attendue, fl.montant_facture, fl.montant_attendu, fl.ecart,
       CASE fl.unite_attendue
         WHEN 'km' THEN fl.quantite_attendue = (SELECT sum(d.validee_charge_km) FROM public.distances_voyage d JOIN public.trips t ON t.id = d.trip_id
                                                 WHERE t.vehicle_id = fl.vehicle_id AND t.planned_date BETWEEN ff.periode_debut AND ff.periode_fin)
         WHEN 'heure' THEN fl.quantite_attendue = (SELECT sum(p.index_fin - p.index_debut) FROM public.pointages_engins p
                                                     JOIN public.fiches_terrain fi ON fi.id = p.fiche_id
                                                    WHERE p.vehicle_id = fl.vehicle_id AND fi.date_fiche BETWEEN ff.periode_debut AND ff.periode_fin)
       END AND fl.ecart = fl.montant_facture - fl.montant_attendu AS ok
  FROM public.factures_fournisseur ff JOIN public.factures_fournisseur_lignes fl ON fl.facture_id = ff.id
 WHERE ff.id::text LIKE 'dec0de00-%' ORDER BY fl.libelle;
SELECT ff.numero_fournisseur, ff.montant_ht_facture, (SELECT sum(montant_facture) FROM public.factures_fournisseur_lignes WHERE facture_id = ff.id) AS somme_lignes,
       ff.montant_reclame, p.numero AS paiement, p.montant_propose, p.statut,
       ff.montant_ht_facture = (SELECT sum(montant_facture) FROM public.factures_fournisseur_lignes WHERE facture_id = ff.id)
         AND p.montant_propose = round((ff.montant_ht_facture - ff.montant_reclame) * 1.18) AS ok
  FROM public.factures_fournisseur ff LEFT JOIN public.paiements_fournisseur p ON p.facture_fournisseur_id = ff.id
 WHERE ff.id::text LIKE 'dec0de00-%';

\echo '=== J2 : carburant recu, distribue, inventorie : solde de la cuve = somme des mouvements valides = dernier inventaire'
SELECT s.code, (SELECT sum(variation) FILTER (WHERE type = 'reception') FROM public.mouvements_carburant WHERE stockage_id = s.id) AS recu,
       (SELECT -sum(variation) FILTER (WHERE type = 'distribution') FROM public.mouvements_carburant WHERE stockage_id = s.id) AS distribue,
       (SELECT sum(volume_liters) FROM public.fuel_transactions WHERE id IN (SELECT fuel_transaction_id FROM public.mouvements_carburant WHERE stockage_id = s.id)) AS pleins,
       (SELECT sum(variation) FILTER (WHERE type = 'ajustement_inventaire') FROM public.mouvements_carburant WHERE stockage_id = s.id) AS ecart_inventaire,
       (SELECT sum(variation) FROM public.mouvements_carburant WHERE stockage_id = s.id AND statut = 'valide') AS solde,
       (SELECT volume_mesure FROM public.inventaires_carburant WHERE stockage_id = s.id ORDER BY date_mesure DESC LIMIT 1) AS dernier_inventaire,
       (SELECT sum(variation) FROM public.mouvements_carburant WHERE stockage_id = s.id AND statut = 'valide')
         = (SELECT volume_mesure FROM public.inventaires_carburant WHERE stockage_id = s.id ORDER BY date_mesure DESC LIMIT 1) AS ok
  FROM public.stockages_carburant s WHERE s.id::text LIKE 'dec0de00-%';

\echo '=== Achats -> stock et pneus : bon recu = entree en stock et pneus enregistres'
SELECT po.po_number, po.status, i.item_description, i.quantity, i.quantity_received,
       coalesce((SELECT si.quantity_in_stock FROM public.stock_items si WHERE si.id = i.stock_item_id),
                (SELECT count(*) FROM public.tires t WHERE t.fournisseur_id = po.supplier_id)) AS en_stock_ou_pneus,
       i.quantity = i.quantity_received AND i.total_price = i.quantity * i.unit_price AS ok
  FROM public.purchase_orders po JOIN public.purchase_order_items i ON i.purchase_order_id = po.id
 WHERE po.id::text LIKE 'dec0de00-%';

\echo '=== Etiquetage : lignes d''exemple sans prefixe DEMO- sur un numero genere (attendu : 0)'
SELECT count(*) AS numeros_non_prefixes FROM (
  SELECT reference AS n FROM public.trips WHERE id::text LIKE 'dec0de00-%' UNION ALL
  SELECT numero FROM public.fiches_terrain WHERE id::text LIKE 'dec0de00-%' UNION ALL
  SELECT numero FROM public.factures WHERE id::text LIKE 'dec0de00-%' UNION ALL
  SELECT po_number FROM public.purchase_orders WHERE id::text LIKE 'dec0de00-%' UNION ALL
  SELECT numero FROM public.paiements_fournisseur WHERE id::text LIKE 'dec0de00-%') x
 WHERE n NOT LIKE 'DEMO-%';
SELECT active AS bandeau_actif FROM public.sigtb_demonstration WHERE id = 1;
