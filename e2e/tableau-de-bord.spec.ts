import { expect, test } from '@playwright/test';
import { aujourdhuiA, ilYa, PROFIL, simulerApi, SITE_DEPOT, SITE_MINE } from './api-simulee';

// Tableau de bord et cadre de l'application (D-018), avec l'API simulee.

test.describe('Tableau de bord', () => {
  test('base vide : cadre complet et « sans données », aucun chiffre invente', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Bonjour, Aminata' })).toBeVisible();
    await expect(page.getByText('Centre de Contrôle Opérationnel')).toBeVisible();
    await expect(page.getByText('Aucun voyage enregistré.')).toBeVisible();
    await expect(page.getByText('Aucune alerte active')).toBeVisible();
    await expect(page.getByText('Objectif jour')).toBeVisible();
    await expect(page.getByText('Non défini')).toBeVisible();
    await expect(page.getByText('Aucun shift défini')).toBeVisible();
    await expect(page.getByText('Aucune distribution saisie')).toBeVisible();
    await expect(page.getByText(/DONNÉES DE DÉMONSTRATION/)).toHaveCount(0);
    await page.screenshot({ path: 'test-results/tableau-de-bord-vide.png', fullPage: true });
  });

  test('avec des voyages : tonnes, voyages, flotte et derniers voyages', async ({ page }) => {
    await simulerApi(page, {
      profiles: PROFIL,
      sites: [
        { id: SITE_MINE, name: 'Mine Nimba', type: 'mine' },
        { id: SITE_DEPOT, name: 'Dépôt', type: 'depot' },
      ],
      vehicles: [
        { id: 'v1', registration: 'RC-1001', status: 'active', site_id: SITE_MINE },
        { id: 'v2', registration: 'RC-1002', status: 'active', site_id: SITE_MINE },
        { id: 'v3', registration: 'RC-1003', status: 'maintenance', site_id: SITE_MINE },
        { id: 'v4', registration: 'RC-1004', status: 'immobilized', site_id: SITE_MINE },
      ],
      trips: [
        { id: 't1', reference: 'VYG-0001', vehicle_id: 'v1', departure_site_id: SITE_MINE, arrival_site_id: SITE_DEPOT, net_weight: 52, load_weight: null, status: 'completed', actual_arrival_time: aujourdhuiA(7) },
        { id: 't2', reference: 'VYG-0002', vehicle_id: 'v2', departure_site_id: SITE_MINE, arrival_site_id: SITE_DEPOT, net_weight: 48, load_weight: null, status: 'completed', actual_arrival_time: aujourdhuiA(9) },
      ],
      work_shifts: [{ name: 'jour', display_name: 'Jour', start_time: '00:00:00', end_time: '23:59:00' }],
      alerts: [{ id: 'a1', title: 'Retard de livraison', message: 'Écart estimé', severity: 'warning', created_at: ilYa(12) }],
      vehicle_tracking: [{ vehicle_id: 'v1', latitude: 7.6, longitude: -8.4, timestamp: ilYa(3), speed: 34 }],
      fuel_transactions: [{ volume_liters: 230 }],
      sigtb_demonstration: [{ active: true, chargee_le: ilYa(5) }],
    });
    await page.setViewportSize({ width: 1680, height: 1700 });
    await page.goto('/');
    await expect(page.getByText('100 T').first()).toBeVisible();
    await expect(page.getByText('VYG-0001')).toBeVisible();
    await expect(page.getByText('Mine Nimba → Dépôt').first()).toBeVisible();
    await expect(page.getByText('Retard de livraison')).toBeVisible();
    await expect(page.getByText('Shift Jour')).toBeVisible();
    await expect(page.getByText('230 L')).toBeVisible();
    await expect(page.getByText('2,30 L/T')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'DONNÉES DE DÉMONSTRATION' })).toBeVisible();
    await page.screenshot({ path: 'test-results/tableau-de-bord-donnees.png', fullPage: true });
  });

  test('la deconnexion passe par une fenetre de confirmation', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL });
    await page.goto('/');
    await page.getByRole('button', { name: 'Menu utilisateur' }).click();
    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await expect(page.getByRole('dialog')).toContainText('Se déconnecter de SIGTB');
    await page.screenshot({ path: 'test-results/deconnexion.png' });
  });
});
