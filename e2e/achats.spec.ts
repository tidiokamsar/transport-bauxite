import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi } from './api-simulee';

// Circuit achat (D-053) avec l'API simulee : creation d'un brouillon,
// approbation, reception partielle avec refus motive.

const BON = {
  id: 'po1', po_number: 'BC-2026-00007', po_date: '2026-11-14', supplier_id: 'f1', warehouse_id: 'w1', status: 'approved',
  subtotal: 70000, tax_amount: 0, total_amount: 70000, expected_delivery_date: null, notes: null, requested_by: 'autre', soumis_par: 'autre',
  motif_decision: null, motif_cloture: null, created_at: '2026-11-14T08:00:00Z',
};
const jeu = {
  profiles: PROFIL,
  purchase_orders: [BON],
  purchase_order_items: [
    { id: 'l1', purchase_order_id: 'po1', stock_item_id: 'a1', item_description: 'Filtre à huile', quantity: 10, unit_price: 5000, total_price: 50000, quantity_received: 0 },
    { id: 'l2', purchase_order_id: 'po1', stock_item_id: null, item_description: 'Transport', quantity: 1, unit_price: 20000, total_price: 20000, quantity_received: 0 },
  ],
  suppliers: [{ id: 'f1', company_name: 'Fournisseur pièces' }],
  warehouses: [{ id: 'w1', name: 'Magasin Nimba', code: 'MAG-NIM' }],
  stock_items: [{ id: 'a1', name: 'Filtre à huile', item_code: 'FLT-01' }],
};

const ouvrir = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Stocks & Achats', exact: true }).click();
  await page.getByRole('button', { name: 'Achats', exact: true }).click();
};

test.describe('Circuit achat', () => {
  test('brouillon envoye au serveur, reception partielle avec refus motive', async ({ page }) => {
    await simulerApi(page, jeu);
    const appels: { fonction: string; corps: Record<string, unknown> }[] = [];
    for (const fonction of ['enregistrer_bon_commande', 'receptionner_bon_commande']) {
      await page.route(`**/rest/v1/rpc/${fonction}`, (route) => { appels.push({ fonction, corps: route.request().postDataJSON() }); return repondre(route, 'ok'); });
    }
    await ouvrir(page);
    await page.getByRole('button', { name: 'Nouveau bon de commande' }).click();
    const f = page.getByRole('form', { name: 'Saisie bon de commande' });
    await f.getByLabel('Fournisseur *').selectOption('f1');
    await f.getByLabel('Dépôt de livraison *').selectOption('w1');
    await page.getByLabel('Article ligne 1').selectOption('a1');
    await page.getByLabel('Quantité ligne 1').fill('4');
    await page.getByLabel('Prix ligne 1').fill('5000');
    await expect(page.getByText('20 000 GNF')).toBeVisible();
    await page.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ fonction: 'enregistrer_bon_commande', corps: { p_id: null, p_fournisseur: 'f1', p_depot: 'w1', p_taxes: 0,
      p_lignes: [{ article: 'a1', designation: null, quantite: 4, prix_unitaire: 5000 }] } });

    await page.getByRole('button', { name: 'Ouvrir BC-2026-00007' }).click();
    await page.getByRole('button', { name: 'Réceptionner', exact: true }).click();
    await page.getByLabel('Reçu Filtre à huile').fill('6');
    await page.getByLabel('Refusé Filtre à huile').fill('1');
    await expect(page.getByRole('button', { name: 'Enregistrer la réception' })).toBeDisabled();
    await page.getByLabel('Motif du refus Filtre à huile').fill('Carton abîmé');
    await page.getByRole('button', { name: 'Enregistrer la réception' }).click();
    await expect.poll(() => appels.length).toBe(2);
    expect(appels[1]).toMatchObject({ fonction: 'receptionner_bon_commande', corps: { p_id: 'po1', p_lignes: [{ ligne: 'l1', recue: 6, refusee: 1, motif_refus: 'Carton abîmé' }] } });
  });
});
