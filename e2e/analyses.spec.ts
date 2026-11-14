import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi } from './api-simulee';

// Ecrans remis a niveau (D-030) avec l'API simulee : analyse et anomalies
// carburant, fiabilite des engins, saisie d'un plein au prix saisi.

const ENGINS = [
  { id: 'v1', registration: 'RC-1001', vehicle_type: 'tipper', status: 'active', year: 2021, current_km: 84500 },
  { id: 'v2', registration: 'RC-1002', vehicle_type: 'tipper', status: 'immobilized', year: 2020, current_km: 91000 },
];

const aller = async (page: Page, groupe: string, ecran: string) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: groupe, exact: true }).click();
  await page.getByRole('button', { name: ecran, exact: true }).click();
};
const rpc = (page: Page, fonction: string, corps: unknown) =>
  page.route(`**/rest/v1/rpc/${fonction}`, (route) => repondre(route, corps));

test.describe('Écrans remis à niveau', () => {
  test('analyse carburant : litres par tonne, non calculable sans tonnage', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL, vehicles: ENGINS });
    await rpc(page, 'consommation_carburant', [
      { vehicle_id: 'v1', litres: 300, cout: 3750000, pleins: 2, tonnes: 80, voyages: 2, heures_marche: null, litres_par_tonne: 3.75, litres_par_heure: null },
      { vehicle_id: 'v2', litres: 50, cout: 625000, pleins: 1, tonnes: null, voyages: 0, heures_marche: null, litres_par_tonne: null, litres_par_heure: null },
    ]);
    await aller(page, 'Carburant', 'Analyse carburant');
    await expect(page.getByText('3,750').first()).toBeVisible();
    await expect(page.getByText('80,0 t')).toBeVisible();
    await expect(page.getByText('8500')).toHaveCount(0);
  });

  test('anomalies carburant : regles affichees, seuil a saisir', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL, vehicles: ENGINS });
    await rpc(page, 'anomalies_carburant', [{ type: 'pleins_meme_jour', vehicle_id: 'v1', jour: '2026-11-05', reference: 'FC-261105-001-01, FC-261105-001-02', litres: 300, detail: '2 pleins le meme jour' }]);
    await aller(page, 'Carburant', 'Anomalies');
    await expect(page.getByText('Plusieurs pleins le même jour · RC-1001')).toBeVisible();
    await expect(page.getByPlaceholder('non appliqué')).toBeVisible();
  });

  test('fiabilite des engins : MTTR et disponibilite depuis les immobilisations', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL, vehicles: ENGINS });
    await rpc(page, 'fiabilite_engins', [
      { vehicle_id: 'v2', heures_periode: 240, heures_arret: 36, pannes: 2, heures_pannes: 30, mttr_heures: 15, mtbf_heures: 102, disponibilite_pct: 85, derniere_panne: '2026-11-05T00:00:00Z', heures_loueur: 30 },
      { vehicle_id: 'v1', heures_periode: 240, heures_arret: 0, pannes: 0, heures_pannes: 0, mttr_heures: null, mtbf_heures: null, disponibilite_pct: 100, derniere_panne: null, heures_loueur: 0 },
    ]);
    await aller(page, 'Reporting & Analyse', 'Fiabilité des engins');
    await expect(page.getByText('15,0 h').first()).toBeVisible();
    await expect(page.getByText('92,5 %')).toBeVisible();
    await page.screenshot({ path: 'test-results/fiabilite.png', fullPage: true });
  });

  test('plein unitaire : enregistre les litres sans inventer le prix', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL, vehicles: ENGINS, drivers: [], fuel_transactions: [] });
    const envois: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/fuel_transactions*', (route) => {
      if (route.request().method() === 'POST') { envois.push(route.request().postDataJSON()); return route.fulfill({ status: 201, body: '' }); }
      return route.fallback();
    });
    await aller(page, 'Carburant', 'Pleins et cuves');
    await page.getByRole('button', { name: 'Saisir' }).click();
    const f = page.getByRole('dialog');
    await f.getByLabel('Engin *').selectOption({ label: 'RC-1001' });
    await f.getByLabel('Litres *').fill('250');
    await f.getByRole('button', { name: 'Enregistrer' }).click();
    await expect.poll(() => envois.length).toBe(1);
    expect(envois[0]).toMatchObject({ vehicle_id: 'v1', volume_liters: 250, unit_price: null, total_cost: null, total_amount: null, supplier: 'CBG', transaction_type: 'refuel' });
  });
});
