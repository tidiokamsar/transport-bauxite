import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi, SITE_DEPOT, SITE_MINE } from './api-simulee';

// Fiches terrain (D-028) avec l'API simulee : preparation depuis le
// dispatch, fiche imprimable, saisie d'une ligne de rotations.

const SHIFT = '00000000-0000-4000-a000-0000000000d1';
const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const voyage = (id: string, reference: string, vehicle_id: string) => ({
  id, reference, vehicle_id, driver_id: 'c1', etat: 'ASSIGNED', planned_date: aujourdhui(), departure_site_id: SITE_MINE,
  arrival_site_id: SITE_DEPOT, status: 'planned', net_weight: null, load_weight: null, actual_arrival_time: null,
});

const fiche = (extra: Record<string, unknown> = {}) => ({
  id: 'f1', numero: 'FR-261111-001', type: 'rotations', date_fiche: aujourdhui(), site_id: SITE_MINE, shift_id: SHIFT,
  vehicle_id: 'v1', driver_id: 'c1', agent: 'Mamadou Pointeur', options: { pesee: 'arrivee' },
  contenu: { voyages: [{ id: 't1', reference: 'VYG-001' }, { id: 't2', reference: 'VYG-002' }] },
  statut: 'retournee', prepare_le: new Date().toISOString(), remise_le: null, retournee_le: null, saisie_le: null, motif_annulation: null,
  ...extra,
});

const JEU = {
  profiles: PROFIL,
  sites: [{ id: SITE_MINE, name: 'Mine Nimba', type: 'mine' }, { id: SITE_DEPOT, name: 'Dépôt', type: 'depot' }],
  work_shifts: [{ id: SHIFT, name: 'jour', display_name: 'Jour', start_time: '06:00:00', end_time: '18:00:00', shift_order: 1 }],
  vehicles: [
    { id: 'v1', registration: 'RC-1001', vehicle_type: 'tipper', status: 'active', site_id: SITE_MINE },
    { id: 'v2', registration: 'RC-1002', vehicle_type: 'tipper', status: 'active', site_id: SITE_MINE },
  ],
  drivers: [{ id: 'c1', name: 'Alpha Test' }],
  societe: [{ raison_sociale: 'Kogon Mining SARL', rccm: null, nif: null, adresse: 'Conakry' }],
  trips: [voyage('t1', 'VYG-001', 'v1'), voyage('t2', 'VYG-002', 'v1'), voyage('t3', 'VYG-003', 'v2')],
};

const ouvrir = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Fiches terrain' }).first().click();
  await expect(page.getByRole('heading', { name: 'Fiches terrain', exact: true })).toBeVisible();
};

test.describe('Fiches terrain', () => {
  test('preparation : une fiche de rotations par camion du dispatch, lieu de pesee exige', async ({ page }) => {
    await simulerApi(page, { ...JEU, fiches_terrain: [] });
    const appels: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/preparer_fiche', (route) => {
      appels.push(route.request().postDataJSON());
      return repondre(route, `f${appels.length}`);
    });
    await ouvrir(page);
    const bouton = page.getByRole('button', { name: 'Préparer 2 fiche(s) de rotations' });
    await expect(bouton).toBeDisabled();
    await page.getByLabel('Lieu de la pesée *').selectOption({ label: 'À l\'arrivée (réception)' });
    await bouton.click();
    await expect.poll(() => appels.length).toBe(2);
    expect(appels[0]).toMatchObject({ p_type: 'rotations', p_vehicle_id: 'v1', p_driver_id: 'c1', p_shift_id: SHIFT, p_options: { pesee: 'arrivee' } });
    expect(appels[0].p_contenu).toEqual({ voyages: [{ id: 't1', reference: 'VYG-001' }, { id: 't2', reference: 'VYG-002' }] });
    expect(appels[1]).toMatchObject({ p_vehicle_id: 'v2' });
  });

  test('fiche imprimable : societe, numero, voyages prevus, signatures', async ({ page }) => {
    await simulerApi(page, { ...JEU, fiches_terrain: [fiche({ statut: 'preparee' })] });
    await ouvrir(page);
    await page.getByRole('button', { name: 'Imprimer FR-261111-001' }).click();
    const papier = page.getByRole('article', { name: 'Fiche FR-261111-001' });
    await expect(papier).toContainText('Kogon Mining SARL');
    await expect(papier).toContainText('FICHE DE ROTATIONS');
    await expect(papier).toContainText('VYG-002');
    await expect(papier).toContainText('Pesée : à l\'arrivée');
    await expect(papier).toContainText('Chef de poste');
    await page.screenshot({ path: 'test-results/fiche-imprimable.png', fullPage: true });
  });

  test('saisie d\'une ligne : etapes horodatees, pesee et ticket envoyes', async ({ page }) => {
    await simulerApi(page, { ...JEU, fiches_terrain: [fiche()] });
    const corps: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/saisir_rotation', (route) => {
      corps.push(route.request().postDataJSON());
      return repondre(route, 'DELIVERED');
    });
    await ouvrir(page);
    await page.getByRole('button', { name: 'Saisir FR-261111-001' }).click();
    const s = page.getByRole('dialog');
    await s.getByLabel('VYG-001 Arrivée chargement').fill('07:00');
    await s.getByLabel('VYG-001 Fin chargement').fill('07:20');
    await s.getByLabel('VYG-001 Fin déchargement').fill('08:30');
    await s.getByLabel('VYG-001 heure de pesée').fill('08:20');
    await s.getByLabel('VYG-001 ticket').fill('PB-001');
    await s.getByLabel('VYG-001 brut').fill('56,1');
    await s.getByLabel('VYG-001 tare').fill('15,4');
    await page.screenshot({ path: 'test-results/fiche-saisie.png', fullPage: true });
    await s.getByRole('button', { name: 'Enregistrer VYG-001' }).click();
    await expect.poll(() => corps.length).toBe(1);
    expect(corps[0]).toMatchObject({ p_fiche_id: 'f1', p_trip_id: 't1' });
    const etapes = corps[0].p_etapes as { etat: string; donnees?: unknown }[];
    expect(etapes.map((e) => e.etat)).toEqual(['AT_LOADING', 'LOADED', 'DELIVERED', 'WEIGHED_IN']);
    expect(etapes[3].donnees).toEqual({ brut: 56.1, tare: 15.4, ticket: 'PB-001' });
    await expect(s.getByText('Enregistré : Livré')).toBeVisible();
  });

  test('double pesee au depart : valeurs Kogon et CBG envoyees avec le ticket', async ({ page }) => {
    await simulerApi(page, { ...JEU, fiches_terrain: [fiche({ options: { pesee: 'depart' } })] });
    const corps: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/saisir_rotation', (route) => {
      corps.push(route.request().postDataJSON());
      return repondre(route, 'WEIGHED_OUT');
    });
    await ouvrir(page);
    await page.getByRole('button', { name: 'Saisir FR-261111-001' }).click();
    const s = page.getByRole('dialog');
    await s.getByLabel('VYG-001 Fin chargement').fill('07:20');
    await s.getByLabel('VYG-001 heure de pesée').fill('07:25');
    await s.getByLabel('VYG-001 ticket').fill('PB-DOUBLE-001');
    await s.getByLabel('VYG-001 brut').fill('56');
    await s.getByLabel('VYG-001 tare').fill('15');
    await s.getByLabel('VYG-001 poids CBG').fill('40,8');
    await s.getByRole('button', { name: 'Enregistrer VYG-001' }).click();
    await expect.poll(() => corps.length).toBe(1);
    const etapes = corps[0].p_etapes as { etat: string; donnees?: unknown }[];
    expect(etapes.map((e) => e.etat)).toEqual(['LOADED', 'WEIGHED_OUT']);
    expect(etapes[1].donnees).toEqual({ brut: 56, tare: 15, ticket: 'PB-DOUBLE-001', tonnage_cbg: 40.8 });
  });
});
