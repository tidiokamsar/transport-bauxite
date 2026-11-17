import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi } from './api-simulee';

// Stocks avances et pneumatiques (D-067) avec l'API simulee : reservation,
// sortie sur reservation, lots exiges, valorisation partielle, reception de
// pneus depuis un bon de commande, performance par marque et modele.

const capturer = async (page: Page, fonctions: string[]) => {
  const appels: { fonction: string; corps: Record<string, unknown> }[] = [];
  for (const fonction of fonctions) {
    await page.route(`**/rest/v1/rpc/${fonction}`, (route) => { appels.push({ fonction, corps: route.request().postDataJSON() }); return repondre(route, 'x'); });
  }
  return appels;
};

const ouvrir = async (page: Page, groupe: string, vue: string) => {
  await page.setViewportSize({ width: 1600, height: 1400 });
  await page.goto('/');
  if (groupe) await page.getByRole('button', { name: groupe, exact: true }).click();
  await page.getByRole('button', { name: vue, exact: true }).click();
};

test.describe('Stocks avances (D-067)', () => {
  test('reservation, sortie sur reservation, lots exiges, valorisation partielle', async ({ page }) => {
    await simulerApi(page, {
      profiles: PROFIL,
      stock_items: [
        { id: 'a1', item_code: 'FLT-001', name: 'Filtre à huile', unit_of_measure: 'piece', unit_price: 15000, minimum_threshold: 0, quantity_in_stock: 10, active: true, category_id: null, suivi: 'aucun' },
        { id: 'a2', item_code: 'HUI-15W40', name: 'Huile moteur', unit_of_measure: 'bidon', unit_price: null, minimum_threshold: 0, quantity_in_stock: 5, active: true, category_id: null, suivi: 'lot' },
      ],
      warehouses: [{ id: 'd1', code: 'MAG-A', name: 'Magasin', warehouse_type: 'main', site_id: null, active: true }],
      v_stock_disponibilite: [
        { stock_item_id: 'a1', warehouse_id: 'd1', quantite: 10, reserve: 4, libre: 6 },
        { stock_item_id: 'a2', warehouse_id: 'd1', quantite: 5, reserve: 0, libre: 5 },
      ],
      v_reservations_stock: [{ id: 'r1', numero: 'RES-2026-00001', stock_item_id: 'a1', warehouse_id: 'd1', quantite: 4, maintenance_order_id: 'o1', vehicle_id: null,
        affectation: null, note: null, reserve_le: '2026-11-18T08:00:00Z', motif_levee: null, quantite_consommee: 1, quantite_restante: 3, statut: 'active' }],
      v_stock_lots: [{ stock_item_id: 'a2', warehouse_id: 'd1', code: 'L1', quantite: 5 }],
      v_stock_lots_mouvements: [{ id: 'x1', code: 'L1', quantite: 5, stock_movement_id: 'm1', movement_number: 'MVT-2026-000001', movement_date: '2026-11-18T07:00:00Z',
        movement_type: 'entry', stock_item_id: 'a2', from_warehouse_id: null, to_warehouse_id: 'd1', reference_piece: 'REC-2026-00001', annule: false }],
      stock_movements: [],
      maintenance_orders: [{ id: 'o1', work_order_number: 'OT-2026-00004', vehicle_id: null, status: 'open' }],
      vehicles: [], sites: [],
      v_valorisation_depots: [{ warehouse_id: 'd1', nb_articles: 2, valeur_connue: 150000, nb_articles_partiels: 0, nb_articles_sans_prix: 1, statut: 'partielle' }],
      v_valorisation_stock: [
        { stock_item_id: 'a1', warehouse_id: 'd1', quantite: 10, cmp: 15000, quantite_non_valorisee: 0, valeur: 150000, statut: 'complete' },
        { stock_item_id: 'a2', warehouse_id: 'd1', quantite: 5, cmp: null, quantite_non_valorisee: null, valeur: null, statut: 'sans_donnees' },
      ],
    });
    const appels = await capturer(page, ['reserver_stock', 'mouvement_stock', 'lever_reservation_stock']);
    await ouvrir(page, 'Stocks & Achats', 'Stocks');

    await page.getByRole('tab', { name: 'Réservations' }).click();
    await expect(page.getByText('RES-2026-00001')).toBeVisible();
    await page.getByRole('tab', { name: 'Valorisation' }).click();
    await expect(page.getByText(/150\s000 GNF \(partielle\)/)).toBeVisible();
    await page.getByRole('button', { name: 'Détail valorisation MAG-A' }).click();
    await expect(page.getByText('Sans données').first()).toBeVisible();

    await page.getByRole('link', { name: 'Réserver', exact: true }).click();
    const r = page.getByRole('form', { name: 'Réservation (sans sortie physique)' });
    await r.getByLabel('Article *').selectOption('a1');
    await r.getByLabel('Dépôt *').selectOption('d1');
    await r.getByLabel('Quantité *').fill('2');
    await r.getByLabel('Affectation (chantier, équipe)').fill('Chantier nord');
    await r.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ fonction: 'reserver_stock', corps: { p_article: 'a1', p_depot: 'd1', p_quantite: 2, p_affectation: 'Chantier nord', p_ordre_maintenance: null } });

    // Sortie sur reservation depuis la fiche de la reservation.
    await page.goto('/#/stock/reservation-r1');
    await expect(page.getByRole('article', { name: 'Fiche RES-2026-00001' })).toBeVisible();
    await page.getByRole('link', { name: 'Sortir', exact: true }).click();
    const f = page.getByRole('form', { name: 'Sortie de stock' });
    await expect(f.getByLabel('Réservation consommée')).toHaveValue('r1');
    await f.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect.poll(() => appels.length).toBe(2);
    expect(appels[1]).toMatchObject({ fonction: 'mouvement_stock', corps: { p_article: 'a1', p_type: 'exit', p_quantite: 3, p_depot_source: 'd1', p_reservation: 'r1', p_lots: null } });

    // Article suivi par lot : la sortie est bloquee tant que les lots manquent.
    await page.goto('/#/stock/nouveau?objet=exit');
    await f.getByLabel('Article *').selectOption('a2');
    await f.getByLabel('Depuis *').selectOption('d1');
    await f.getByLabel('Quantité *').fill('2');
    await f.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(f.getByText('Saisie à compléter :')).toBeVisible();
    expect(appels).toHaveLength(2);
    await f.getByLabel(/Lots \(un par ligne/).fill('l1 2');
    await f.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect.poll(() => appels.length).toBe(3);
    expect(appels[2]).toMatchObject({ fonction: 'mouvement_stock', corps: { p_article: 'a2', p_type: 'exit', p_lots: [{ code: 'L1', quantite: 2 }], p_reservation: null } });

    await page.goto('/#/stock?onglet=lots');
    await page.getByLabel('Tracer un lot').fill('l1');
    await expect(page.getByText(/REC-2026-00001/)).toBeVisible();
  });

  test('levee d\'une reservation : motif exige par le serveur', async ({ page }) => {
    await simulerApi(page, {
      profiles: PROFIL, stock_items: [{ id: 'a1', item_code: 'FLT-001', name: 'Filtre à huile', unit_of_measure: 'piece', active: true, suivi: 'aucun' }],
      warehouses: [{ id: 'd1', code: 'MAG-A', name: 'Magasin', warehouse_type: 'main', site_id: null, active: true }],
      v_reservations_stock: [{ id: 'r1', numero: 'RES-2026-00001', stock_item_id: 'a1', warehouse_id: 'd1', quantite: 4, maintenance_order_id: null, vehicle_id: null,
        affectation: 'Chantier nord', note: null, reserve_le: '2026-11-18T08:00:00Z', motif_levee: null, quantite_consommee: 0, quantite_restante: 4, statut: 'active' }],
      stock_movements: [],
    });
    const appels = await capturer(page, ['lever_reservation_stock']);
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto('/#/stock/reservation-r1');
    await page.getByRole('link', { name: 'Lever', exact: true }).click();
    const f = page.getByRole('form', { name: 'Lever la réservation RES-2026-00001' });
    await expect(f.getByRole('button', { name: 'Lever la réservation' })).toBeDisabled();
    await f.getByLabel('Motif *').fill('Travaux reportés');
    await f.getByRole('button', { name: 'Lever la réservation' }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ fonction: 'lever_reservation_stock', corps: { p_id: 'r1', p_motif: 'Travaux reportés' } });
  });

  test('bon de commande avec ligne de pneus, reception des pneus et des lots', async ({ page }) => {
    await simulerApi(page, {
      profiles: PROFIL,
      purchase_orders: [{ id: 'po1', po_number: 'BC-2026-00009', po_date: '2026-11-18', supplier_id: 'f1', warehouse_id: 'w1', status: 'approved',
        subtotal: 6010000, tax_amount: 0, total_amount: 6010000, expected_delivery_date: null, notes: null, requested_by: 'autre', soumis_par: 'autre',
        motif_decision: null, motif_cloture: null, created_at: '2026-11-18T08:00:00Z' }],
      purchase_order_items: [
        { id: 'l1', purchase_order_id: 'po1', stock_item_id: 'a2', item_description: 'Huile moteur', quantity: 4, unit_price: 2500, total_price: 10000, quantity_received: 0, pneu_marque: null, pneu_modele: null, pneu_dimension: null },
        { id: 'l3', purchase_order_id: 'po1', stock_item_id: null, item_description: 'Pneu Michelin XDR', quantity: 2, unit_price: 3000000, total_price: 6000000, quantity_received: 0, pneu_marque: 'Michelin', pneu_modele: 'XDR', pneu_dimension: null },
      ],
      suppliers: [{ id: 'f1', company_name: 'Fournisseur pneus' }],
      warehouses: [{ id: 'w1', name: 'Magasin Nimba', code: 'MAG-NIM' }],
      stock_items: [{ id: 'a2', name: 'Huile moteur', item_code: 'HUI-15W40', suivi: 'lot' }],
    });
    const appels = await capturer(page, ['enregistrer_bon_commande', 'receptionner_bon_commande']);
    await ouvrir(page, 'Stocks & Achats', 'Achats');

    await page.getByRole('link', { name: 'Nouveau bon de commande' }).click();
    const f = page.getByRole('form', { name: 'Nouveau bon de commande' });
    await f.getByLabel('Fournisseur *').selectOption('f1');
    await f.getByLabel('Dépôt de livraison *').selectOption('w1');
    await f.getByLabel('Article ligne 1').selectOption('__pneu__');
    await f.getByLabel('Marque pneu ligne 1').fill('Michelin');
    await f.getByLabel('Modèle pneu ligne 1').fill('XDR');
    await f.getByLabel('Quantité ligne 1').fill('2');
    await f.getByLabel('Prix ligne 1').fill('3000000');
    await f.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ fonction: 'enregistrer_bon_commande', corps: { p_lignes: [{ article: null, quantite: 2, prix_unitaire: 3000000, pneu: { marque: 'Michelin', modele: 'XDR', dimension: null } }] } });

    await page.goto('/#/purchases');
    await page.getByRole('button', { name: 'Ouvrir BC-2026-00009' }).click();
    await page.getByRole('link', { name: 'Réceptionner', exact: true }).click();
    const r = page.getByRole('form', { name: 'Réceptionner le bon' });
    await r.getByLabel('Reçu Huile moteur').fill('4');
    await r.getByLabel('Reçu Pneu Michelin XDR').fill('2');
    await r.getByLabel('Numéros des pneus Pneu Michelin XDR').fill('pn-001\npn-002');
    await expect(r.getByRole('button', { name: 'Enregistrer la réception' })).toBeDisabled();
    await r.getByLabel('Lots Huile moteur').fill('L9 4');
    await r.getByRole('button', { name: 'Enregistrer la réception' }).click();
    await expect.poll(() => appels.length).toBe(2);
    expect(appels[1]).toMatchObject({ fonction: 'receptionner_bon_commande', corps: { p_id: 'po1', p_lignes: [
      { ligne: 'l1', recue: 4, lots: [{ code: 'L9', quantite: 4 }] },
      { ligne: 'l3', recue: 2, pneus: [{ numero: 'PN-001' }, { numero: 'PN-002' }] },
    ] } });
  });

  test('performance des pneus par marque et modele, exclus comptes', async ({ page }) => {
    const ligne = { nb_exclus_mesures_incompletes: 0, duree_vie_jours: 410, seuil_reforme_precoce_km: 10000 };
    await simulerApi(page, {
      profiles: PROFIL, v_pneus: [], v_pneus_a_surveiller: [], vehicles: [], sites: [], suppliers: [],
      v_pneus_performance: [
        { ...ligne, marque: 'MICHELIN', modele: 'XDR', nb_pneus: 3, nb_pris_en_compte: 2, nb_exclus: 1, nb_exclus_en_service: 1, km_moyens: 27500, cout_km: 109.09, taux_reforme_precoce_pct: 50 },
        { ...ligne, marque: 'MICHELIN', modele: null, nb_pneus: 3, nb_pris_en_compte: 2, nb_exclus: 1, nb_exclus_en_service: 1, km_moyens: 27500, cout_km: 109.09, taux_reforme_precoce_pct: 50 },
        { ...ligne, marque: 'BRIDGESTONE', modele: 'VSDT', nb_pneus: 1, nb_pris_en_compte: 0, nb_exclus: 1, nb_exclus_en_service: 1, km_moyens: null, cout_km: null, duree_vie_jours: null, taux_reforme_precoce_pct: null },
      ],
    });
    await ouvrir(page, '', 'Pneus');
    await expect(page.getByText('MICHELIN · XDR')).toBeVisible();
    await expect(page.getByText('MICHELIN · tous modèles')).toBeVisible();
    await expect(page.getByText(/27\s500 km/).first()).toBeVisible();
    await expect(page.getByText('BRIDGESTONE · VSDT')).toBeVisible();
    await expect(page.getByText('0 / 1')).toBeVisible();
    await expect(page.getByText('Réforme précoce : moins de 10000 km.', { exact: false })).toBeVisible();
  });
});
