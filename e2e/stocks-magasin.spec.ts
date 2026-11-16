import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi } from './api-simulee';

// Registre des stocks magasin (D-044) avec l'API simulee : quantite calculee
// par depot, sortie par fonction serveur, annulation d'un mouvement.

const jeu = {
  profiles: PROFIL,
  stock_items: [{ id: 'a1', item_code: 'FLT-001', name: 'Filtre à huile', unit_of_measure: 'piece', unit_price: 15000, minimum_threshold: 5, quantity_in_stock: 4, active: true, category_id: null }],
  warehouses: [{ id: 'd1', code: 'MAG-A', name: 'Magasin', warehouse_type: 'main', site_id: null, active: true },
    { id: 'd2', code: 'ATL-A', name: 'Atelier', warehouse_type: 'garage', site_id: null, active: true }],
  v_stock_disponibilite: [{ stock_item_id: 'a1', warehouse_id: 'd1', quantite: 3, reserve: 0, libre: 3 }, { stock_item_id: 'a1', warehouse_id: 'd2', quantite: 1, reserve: 0, libre: 1 }],
  stock_movements: [{ id: 'm1', movement_number: 'MVT-2026-000001', movement_date: '2026-11-14T08:00:00Z', movement_type: 'entry', stock_item_id: 'a1', quantity: 4,
    from_warehouse_id: null, to_warehouse_id: 'd1', reference_piece: 'BL-001', motif: null, notes: null, annule_mouvement_id: null }],
  sites: [],
};

const ouvrir = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Stocks & Achats', exact: true }).click();
  await page.getByRole('button', { name: 'Stocks', exact: true }).click();
};

test.describe('Stocks magasin', () => {
  test('quantites par depot, alerte de seuil, sortie et annulation par le serveur', async ({ page }) => {
    await simulerApi(page, jeu);
    const appels: { fonction: string; corps: Record<string, unknown> }[] = [];
    for (const fonction of ['mouvement_stock', 'annuler_mouvement_stock']) {
      await page.route(`**/rest/v1/rpc/${fonction}`, (route) => { appels.push({ fonction, corps: route.request().postDataJSON() }); return repondre(route, 'x'); });
    }
    page.on('dialog', (d) => d.accept('Saisie sur le mauvais article'));
    await ouvrir(page);
    await expect(page.getByText('MAG-A 3 · ATL-A 1')).toBeVisible();
    await expect(page.getByText('Sous le seuil')).toBeVisible();

    await page.getByRole('button', { name: 'Sortie', exact: true }).click();
    const f = page.getByRole('form', { name: 'Saisie stock' });
    await f.getByLabel('Article *').selectOption('a1');
    await f.getByLabel('Depuis *').selectOption('d1');
    await f.getByLabel('Quantité *').fill('2');
    await f.getByLabel('Pièce (bon, ordre de travail)').fill('OT-12');
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ fonction: 'mouvement_stock', corps: { p_article: 'a1', p_type: 'exit', p_quantite: 2, p_depot_source: 'd1', p_depot_destination: null, p_reference: 'OT-12' } });

    await page.getByRole('button', { name: 'Annuler MVT-2026-000001' }).click();
    await expect.poll(() => appels.length).toBe(2);
    expect(appels[1]).toMatchObject({ fonction: 'annuler_mouvement_stock', corps: { p_id: 'm1', p_motif: 'Saisie sur le mauvais article' } });
  });
});
