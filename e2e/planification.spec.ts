import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi, SITE_DEPOT, SITE_MINE } from './api-simulee';

// Planification v1 (CDC 6, D-023) avec l'API simulee : objectifs du jour,
// realisation, projection, ressources, definition et revision par les
// fonctions serveur, et objectif repris par le tableau de bord.

const SHIFT_JOUR = '00000000-0000-4000-a000-0000000000d1';
const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const REFERENTIEL = {
  profiles: PROFIL,
  sites: [
    { id: SITE_MINE, name: 'Mine Nimba', type: 'mine' },
    { id: SITE_DEPOT, name: 'Dépôt', type: 'depot' },
  ],
  work_shifts: [{ id: SHIFT_JOUR, name: 'jour', display_name: 'Jour', start_time: '00:00:00', end_time: '23:59:00', shift_order: 1 }],
  vehicles: [
    ...Array.from({ length: 3 }, (_, i) => ({ id: `v${i}`, registration: `RC-${i}`, vehicle_type: 'tipper', status: 'active', site_id: SITE_MINE })),
    { id: 'v9', registration: 'RC-9', vehicle_type: 'tipper', status: 'immobilized', site_id: SITE_MINE },
    { id: 'l1', registration: 'CAT-980L-01', vehicle_type: 'loader', status: 'active', site_id: SITE_MINE },
  ],
};

const objectif = (extra: Record<string, unknown> = {}) => ({
  id: 'o1',
  date_plan: aujourdhui(),
  site_id: SITE_MINE,
  shift_id: SHIFT_JOUR,
  version: 2,
  tonnes_cible: 4800,
  voyages_cible: 118,
  camions_prevus: 20,
  chargeuses_prevues: 2,
  motif: 'Chargeuse en attente de pièce',
  note: null,
  cree_le: new Date().toISOString(),
  tonnes_cible_initial: 5000,
  tonnes_livrees: 1200,
  tonnes_acceptees: 0,
  voyages_livres: 30,
  voyages_sans_poids: 0,
  voyages_en_cours: 8,
  voyages_prevus: 80,
  derniere_livraison: new Date().toISOString(),
  ...extra,
});

const ouvrir = async (page: Page) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Planification' }).first().click();
  await expect(page.getByRole('heading', { name: 'Planification', exact: true })).toBeVisible();
};

test.describe('Planification', () => {
  test('aucun objectif : non defini, aucun chiffre invente', async ({ page }) => {
    await simulerApi(page, REFERENTIEL);
    await ouvrir(page);
    await expect(page.getByText('Non défini')).toBeVisible();
    await expect(page.getByText(/Aucun objectif de production pour cette date/)).toBeVisible();
  });

  test('objectif revise : realisation, plan initial, ressources', async ({ page }) => {
    await simulerApi(page, { ...REFERENTIEL, v_realisation_objectifs: [objectif()] });
    await page.route('**/rest/v1/rpc/statistiques_rotation', (route) =>
      repondre(route, [{ jours_observes: 14, voyages: 1680, charge_moyenne: 40, rotations_par_camion: 6, camions_par_jour: 20 }]),
    );
    await page.setViewportSize({ width: 1600, height: 1200 });
    await ouvrir(page);
    const carte = page.getByRole('article', { name: 'Objectif Mine Nimba · Shift Jour' });
    await expect(carte).toContainText('25 %');
    await expect(carte).toContainText('Plan initial 5 000 t, révisé (version 2) : Chargeuse en attente de pièce');
    await expect(carte).toContainText('-3 600 t');
    await expect(carte).toContainText('30 / 118');
    // 4 800 / (40 t x 6 rotations) = 20 camions ; 3 disponibles, 1 immobilise
    await expect(carte).toContainText('40,0 t par voyage × 6,0 rotations par camion (14 j)');
    await expect(carte).toContainText('Il manque 17 camion(s)');
    await expect(carte).toContainText('1 en maintenance ou immobilisés');
    await page.screenshot({ path: 'test-results/planification.png', fullPage: true });
  });

  test('historique trop court : donnees insuffisantes', async ({ page }) => {
    await simulerApi(page, { ...REFERENTIEL, v_realisation_objectifs: [objectif()] });
    await page.route('**/rest/v1/rpc/statistiques_rotation', (route) =>
      repondre(route, [{ jours_observes: 1, voyages: 4, charge_moyenne: 40, rotations_par_camion: 4, camions_par_jour: 1 }]),
    );
    await ouvrir(page);
    await expect(page.getByText('Données insuffisantes')).toBeVisible();
  });

  test('definir un objectif envoie la saisie a definir_objectif', async ({ page }) => {
    await simulerApi(page, REFERENTIEL);
    let corps: Record<string, unknown> | null = null;
    await page.route('**/rest/v1/rpc/definir_objectif', (route) => {
      corps = route.request().postDataJSON();
      return repondre(route, 'nouvel-objectif');
    });
    await ouvrir(page);
    await page.getByRole('button', { name: 'Définir un objectif' }).click();
    const fenetre = page.getByRole('dialog');
    await fenetre.getByLabel('Site de chargement *').selectOption({ label: 'Mine Nimba' });
    await fenetre.getByLabel('Portée').selectOption({ label: 'Shift Jour (00:00 – 23:59)' });
    await fenetre.getByLabel('Objectif (tonnes) *').fill('4800');
    await fenetre.getByLabel('Camions prévus').fill('20');
    await fenetre.getByRole('button', { name: 'Enregistrer l\'objectif' }).click();
    await expect.poll(() => corps).not.toBeNull();
    expect(corps).toMatchObject({ p_site_id: SITE_MINE, p_shift_id: SHIFT_JOUR, p_tonnes: 4800, p_camions: 20, p_voyages: null, p_motif: null });
  });

  test('le tableau de bord reprend l\'objectif du jour', async ({ page }) => {
    await simulerApi(page, { ...REFERENTIEL, v_realisation_objectifs: [objectif()] });
    await page.goto('/');
    await expect(page.getByText('4 800 T')).toBeVisible();
    await expect(page.getByText('-3 600 T')).toBeVisible();
    await expect(page.getByText('25 %')).toBeVisible();
  });
});
