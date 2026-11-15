import { expect, test } from '@playwright/test';
import { PROFIL, repondre, simulerApi } from './api-simulee';

// Mes validations et notifications (D-056) avec l'API simulee : elements
// calcules par le serveur, compteur dans la barre, ouverture de l'ecran
// cible, notification marquee lue.

const ELEMENTS = [
  { categorie: 'Achats', objet: 'Bon de commande à approuver', reference: 'BC-2026-00009', detail: '70000 GNF', depuis: '2026-11-14T08:00:00Z', ecran: 'purchases' },
  { categorie: 'Paiements', objet: 'Paiement à contrôler a posteriori', reference: 'PAY-2026-00002', detail: 'Neemba · 300 USD', depuis: '2026-11-14T09:00:00Z', ecran: 'paiements' },
];

test.describe('Mes validations', () => {
  test('boite calculee, compteur, ouverture de l\'ecran cible, notification lue', async ({ page }) => {
    await simulerApi(page, {
      profiles: PROFIL,
      notifications: [{ id: 'n1', notification_type: 'achat', title: 'Bon de commande BC-2026-00008 approuvé', message: 'Le bon peut être réceptionné.', read: false, created_at: '2026-11-14T10:00:00Z' }],
      purchase_orders: [],
    });
    const lues: unknown[] = [];
    await page.route('**/rest/v1/rpc/mes_validations', (route) => repondre(route, ELEMENTS));
    await page.route('**/rest/v1/rpc/marquer_notifications_lues', (route) => { lues.push(route.request().postDataJSON()); return repondre(route, 1); });
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto('/');
    await page.getByRole('button', { name: '2 validations en attente' }).click();
    await expect(page.getByText('Bon de commande à approuver')).toBeVisible();
    await expect(page.getByText('Paiement à contrôler a posteriori')).toBeVisible();
    await page.getByRole('button', { name: 'Marquer comme lu Bon de commande BC-2026-00008 approuvé' }).click();
    await expect.poll(() => lues.length).toBe(1);
    expect(lues[0]).toMatchObject({ p_ids: ['n1'] });
    await page.getByRole('button', { name: 'Traiter Bon de commande à approuver BC-2026-00009' }).click();
    await expect(page.getByRole('heading', { name: 'Achats', exact: true })).toBeVisible();
  });
});
