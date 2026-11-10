import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi, SITE_DEPOT, SITE_MINE } from './api-simulee';

// Dispatch v1 (CDC 11, D-024) avec l'API simulee : recommandations
// expliquees, acceptation, refus motive, voyages a reaffecter apres une
// panne, preparation du shift depuis l'objectif.

const SHIFT = '00000000-0000-4000-a000-0000000000d1';
const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const voyage = (id: string, reference: string, extra: Record<string, unknown> = {}) => ({
  id, reference, etat: 'PLANNED', departure_site_id: SITE_MINE, arrival_site_id: SITE_DEPOT,
  vehicle_id: null, driver_id: null, loader_vehicle_id: null,
  status: 'planned', net_weight: null, load_weight: null, actual_arrival_time: null, ...extra,
});

const JEU = {
  profiles: PROFIL,
  sites: [
    { id: SITE_MINE, name: 'Mine Nimba', type: 'mine' },
    { id: SITE_DEPOT, name: 'Dépôt', type: 'depot' },
  ],
  work_shifts: [{ id: SHIFT, name: 'jour', display_name: 'Jour', start_time: '00:00:00', end_time: '23:59:00', shift_order: 1 }],
  vehicles: [
    { id: 'v1', registration: 'RC-1001', vehicle_type: 'tipper', status: 'active', site_id: SITE_MINE },
    { id: 'v2', registration: 'RC-1002', vehicle_type: 'tipper', status: 'active', site_id: SITE_MINE },
    { id: 'v9', registration: 'RC-1009', vehicle_type: 'tipper', status: 'immobilized', site_id: SITE_MINE },
    { id: 'l1', registration: 'CAT-980L-01', vehicle_type: 'loader', status: 'active', site_id: SITE_MINE },
  ],
  drivers: [
    { id: 'c1', name: 'Alpha Test', status: 'active', license_expiry: '2099-01-01' },
    { id: 'c2', name: 'Bah Test', status: 'active', license_expiry: '2099-01-01' },
    { id: 'c3', name: 'Camara Expiré', status: 'active', license_expiry: '2000-01-01' },
  ],
  trips: [
    voyage('t1', 'VYG-001'),
    voyage('t2', 'VYG-002'),
    voyage('t3', 'VYG-003', { etat: 'ASSIGNED', vehicle_id: 'v9', driver_id: 'c3' }),
  ],
  v_realisation_objectifs: [{ site_id: SITE_MINE, shift_id: SHIFT, tonnes_cible: 200, voyages_cible: 5, tonnes_livrees: 0 }],
};

const ouvrir = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1300 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Dispatch' }).first().click();
  await expect(page.getByRole('heading', { name: 'Dispatch', exact: true })).toBeVisible();
};

const capturer = async (page: Page, fonction: string) => {
  const corps: Record<string, unknown>[] = [];
  await page.route(`**/rest/v1/rpc/${fonction}`, (route) => {
    corps.push(route.request().postDataJSON());
    return repondre(route, 'ok');
  });
  return corps;
};

test.describe('Dispatch', () => {
  test('recommandations expliquees et acceptation de toutes', async ({ page }) => {
    await simulerApi(page, JEU);
    const decisions = await capturer(page, 'decider_affectation');
    await ouvrir(page);
    await expect(page.getByText('RC-1001 · Alpha Test · CAT-980L-01')).toHaveCount(2);
    await expect(page.getByText('RC-1002 · Bah Test · CAT-980L-01')).toBeVisible();
    await expect(page.getByText('Bah Test est disponible (sur aucun camion du shift)')).toBeVisible();
    await page.screenshot({ path: 'test-results/dispatch.png', fullPage: true });
    await page.getByRole('button', { name: 'Tout accepter (2)' }).click();
    await expect.poll(() => decisions.length).toBe(2);
    expect(decisions[0]).toMatchObject({ p_trip_id: 't1', p_decision: 'acceptee', p_vehicle_id: 'v1', p_driver_id: 'c1', p_loader_vehicle_id: 'l1' });
    expect(decisions[1]).toMatchObject({ p_trip_id: 't2', p_vehicle_id: 'v2', p_driver_id: 'c2' });
    expect(decisions[0].p_recommandation).toMatchObject({ camion: 'RC-1001', chauffeur: 'Alpha Test' });
  });

  test('panne : voyage a reaffecter, reaffectation motivee', async ({ page }) => {
    await simulerApi(page, JEU);
    const decisions = await capturer(page, 'decider_affectation');
    await ouvrir(page);
    await expect(page.getByText('Camion RC-1009 indisponible (immobilisé)')).toBeVisible();
    await page.getByRole('button', { name: 'Réaffecter' }).click();
    const fenetre = page.getByRole('dialog');
    await expect(fenetre.getByLabel('Motif (obligatoire)')).toHaveValue('Camion RC-1009 indisponible (immobilisé)');
    await expect(fenetre.getByLabel('Chauffeur').locator('option')).toHaveText(['Choisir', 'Alpha Test', 'Bah Test']);
    await fenetre.getByRole('button', { name: 'Enregistrer la décision' }).click();
    await expect.poll(() => decisions.length).toBe(1);
    expect(decisions[0]).toMatchObject({ p_trip_id: 't3', p_motif: 'Camion RC-1009 indisponible (immobilisé)' });
  });

  test('refus : motif obligatoire, rien n\'est affecte', async ({ page }) => {
    await simulerApi(page, JEU);
    const decisions = await capturer(page, 'decider_affectation');
    await ouvrir(page);
    await page.getByRole('button', { name: 'Refuser VYG-001' }).click();
    const fenetre = page.getByRole('dialog');
    await expect(fenetre.getByRole('button', { name: 'Refuser' })).toBeDisabled();
    await fenetre.getByLabel('Motif (obligatoire)').fill('Camion réservé à la piste sud');
    await fenetre.getByRole('button', { name: 'Refuser' }).click();
    await expect.poll(() => decisions.length).toBe(1);
    expect(decisions[0]).toMatchObject({ p_trip_id: 't1', p_decision: 'refusee', p_vehicle_id: null, p_driver_id: null });
  });

  test('preparation du shift depuis l\'objectif', async ({ page }) => {
    await simulerApi(page, JEU);
    const preparations = await capturer(page, 'preparer_voyages');
    await ouvrir(page);
    await expect(page.getByText(/Proposition : 2 voyage\(s\), 5 voyages visés par l'objectif/)).toBeVisible();
    await page.getByRole('combobox').filter({ hasText: 'Choisir' }).selectOption({ label: 'Dépôt' });
    await page.getByRole('button', { name: 'Créer les voyages' }).click();
    await expect.poll(() => preparations.length).toBe(1);
    expect(preparations[0]).toMatchObject({ p_date: aujourdhui(), p_site_id: SITE_MINE, p_destination_id: SITE_DEPOT, p_shift_id: SHIFT, p_nombre: 2 });
  });
});
