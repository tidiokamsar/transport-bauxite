import { expect, test, type Page } from '@playwright/test';
import { PROFIL, simulerApi } from './api-simulee';

// Assainissement P0 (D-042) avec l'API simulee : un bon de commande
// s'annule au lieu d'etre supprime, son numero vient du serveur ; le portail
// client fabrique n'est plus au menu.

const COMMANDE = {
  id: 'po1', po_number: 'BC-2026-00001', po_date: '2026-11-10', supplier_id: 'f1', status: 'draft', total_amount: 250000,
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
    const ecritures: { methode: string; url: string; corps: unknown }[] = [];
    await page.route('**/rest/v1/purchase_orders*', (route) => {
      const methode = route.request().method();
      if (methode === 'GET' || methode === 'HEAD') return route.fallback();
      ecritures.push({ methode, url: route.request().url(), corps: route.request().postDataJSON() });
      return route.fulfill({ status: 204, body: '' });
    });
    page.on('dialog', (d) => d.accept());
    await ouvrirAchats(page);
    await expect(page.getByText('BC-2026-00001')).toBeVisible();
    await page.getByRole('button', { name: 'Annuler BC-2026-00001' }).click();
    await expect.poll(() => ecritures.length).toBe(1);
    expect(ecritures[0].methode).toBe('PATCH');
    expect(ecritures[0].corps).toMatchObject({ status: 'cancelled' });

    await page.getByRole('button', { name: 'Nouveau bon de commande' }).click();
    await expect(page.getByPlaceholder('Attribué à l\'enregistrement')).toHaveValue('');
  });

  test('le portail client fabrique n\'est plus au menu', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL });
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Paramètres', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Portail client' })).toHaveCount(0);
  });
});
