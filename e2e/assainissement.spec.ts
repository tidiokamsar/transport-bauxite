import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi } from './api-simulee';

// Assainissement P0 (D-042) avec l'API simulee : un bon de commande
// s'annule (motif, fonction serveur D-053) au lieu d'etre supprime, son
// numero vient du serveur ; le portail
// client fabrique n'est plus au menu.

const COMMANDE = {
  id: 'po1', po_number: 'BC-2026-00001', po_date: '2026-11-10', supplier_id: 'f1', warehouse_id: null, status: 'draft', total_amount: 250000, created_at: '2026-11-10T08:00:00Z',
  expected_delivery_date: null, notes: null, supplier: { company_name: 'Fournisseur pieces' },
};

const ouvrirAchats = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Stocks & Achats', exact: true }).click();
  await page.getByRole('button', { name: 'Achats', exact: true }).click();
};

test.describe('Assainissement des ecrans herites', () => {
  test('bon de commande : numero serveur affiche, annulation au lieu de suppression', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL, purchase_orders: [COMMANDE], suppliers: [{ id: 'f1', company_name: 'Fournisseur pieces' }] });
    const appels: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/annuler_bon_commande', (route) => { appels.push(route.request().postDataJSON()); return repondre(route, 'ok'); });
    await ouvrirAchats(page);
    await expect(page.getByText('BC-2026-00001')).toBeVisible();
    await page.getByRole('button', { name: 'Ouvrir BC-2026-00001' }).click();
    await page.getByRole('link', { name: 'Annuler le bon' }).click();
    const f = page.getByRole('form', { name: 'Annuler le bon' });
    await f.getByLabel('Motif *').fill('Commande en double');
    await f.getByRole('button', { name: 'Annuler le bon' }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ p_id: 'po1', p_motif: 'Commande en double' });

    await page.goto('/#/purchases');
    await page.getByRole('link', { name: 'Nouveau bon de commande' }).click();
    await expect(page.getByText('Numéro : attribué à l\'enregistrement.', { exact: false })).toBeVisible();
  });

  test('le portail client fabrique n\'est plus au menu', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL });
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Paramètres', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Portail client' })).toHaveCount(0);
  });
});
