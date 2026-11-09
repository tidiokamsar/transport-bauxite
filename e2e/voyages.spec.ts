import { expect, test, type Page } from '@playwright/test';
import { aujourdhuiA, PROFIL, repondre, simulerApi, SITE_DEPOT, SITE_MINE } from './api-simulee';

// Voyages & Rotations (CDC 12) avec l'API simulee : liste du jour par phase,
// fiche du voyage, transition par la fonction serveur avancer_voyage et
// creation par creer_voyage. Le serveur reste juge ; ici on verifie que
// l'ecran envoie ce qui a ete saisi, sans valeur ajoutee.

const ouvrirVoyages = async (page: Page) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Voyages & Rotations' }).first().click();
  await expect(page.getByRole('heading', { name: 'Voyages & Rotations' })).toBeVisible();
};

const REFERENTIEL = {
  profiles: PROFIL,
  sites: [
    { id: SITE_MINE, name: 'Mine Nimba', type: 'mine' },
    { id: SITE_DEPOT, name: 'Dépôt', type: 'depot' },
  ],
  vehicles: [
    { id: 'v1', registration: 'RC-1001', vehicle_type: 'tipper', status: 'active' },
    { id: 'v2', registration: 'RC-1002', vehicle_type: 'tipper', status: 'active' },
    { id: 'l1', registration: 'CAT-980L-01', vehicle_type: 'loader', status: 'active' },
  ],
  drivers: [
    { id: 'c1', name: 'Mamadou Test', status: 'active' },
    { id: 'c2', name: 'Fatou Test', status: 'active' },
  ],
  work_shifts: [{ id: 's1', name: 'jour', display_name: 'Jour', start_time: '00:00:00', end_time: '23:59:00', shift_order: 1 }],
};

const voyage = (id: string, reference: string, etat: string, extra: Record<string, unknown> = {}) => ({
  id,
  reference,
  planned_date: aujourdhuiA(6).slice(0, 10),
  vehicle_id: 'v1',
  driver_id: 'c1',
  loader_vehicle_id: 'l1',
  departure_site_id: SITE_MINE,
  arrival_site_id: SITE_DEPOT,
  shift_id: 's1',
  etat,
  etat_modifie_le: aujourdhuiA(7),
  net_weight: null,
  load_weight: null,
  net_weight_reception: null,
  accepted_tonnage: null,
  actual_departure_time: null,
  actual_arrival_time: null,
  notes: null,
  ...extra,
});

test.describe('Voyages & Rotations', () => {
  test('aucun voyage : message explicite, aucun chiffre invente', async ({ page }) => {
    await simulerApi(page, REFERENTIEL);
    await ouvrirVoyages(page);
    await expect(page.getByText('Aucun voyage prévu à cette date pour ce périmètre.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Exporter' })).toBeDisabled();
  });

  test('liste par phase, fiche, et pesee envoyee au serveur', async ({ page }) => {
    await simulerApi(page, {
      ...REFERENTIEL,
      trips: [
        voyage('t1', 'VYG-261110-001', 'LOADED'),
        voyage('t2', 'VYG-261110-002', 'ACCEPTED', { vehicle_id: 'v2', driver_id: 'c2', net_weight: 40.7, accepted_tonnage: 40 }),
        voyage('t3', 'VYG-261110-003', 'IN_TRANSIT', { net_weight: 41.2 }),
      ],
      trip_events: [
        { id: 'e1', etat_avant: null, etat_apres: 'ASSIGNED', survenu_le: aujourdhuiA(5), enregistre_le: aujourdhuiA(5), origine: 'declare', note: null, donnees: {} },
        { id: 'e2', etat_avant: 'LOADING', etat_apres: 'LOADED', survenu_le: aujourdhuiA(6), enregistre_le: aujourdhuiA(6), origine: 'declare', note: null, donnees: {} },
      ],
    });
    let corps: Record<string, unknown> | null = null;
    await page.route('**/rest/v1/rpc/avancer_voyage', (route) => {
      corps = route.request().postDataJSON();
      return repondre(route, null);
    });

    await page.setViewportSize({ width: 1600, height: 1100 });
    await ouvrirVoyages(page);
    await expect(page.getByText('VYG-261110-001')).toBeVisible();
    await expect(page.getByText('40 t')).toBeVisible();
    await expect(page.getByText('41,2 t')).toBeVisible();
    await page.screenshot({ path: 'test-results/voyages-liste.png', fullPage: true });

    await page.getByText('VYG-261110-001').click();
    const fiche = page.getByRole('dialog');
    await expect(fiche).toContainText('Mine Nimba → Dépôt');
    await expect(fiche).toContainText('CAT-980L-01');
    await expect(fiche).toContainText('Non pesé');
    await expect(fiche.getByText('Chronologie')).toBeVisible();

    await fiche.getByRole('button', { name: 'Pesée au départ' }).click();
    await fiche.getByLabel('Poids brut (t)').fill('56,4');
    await fiche.getByLabel('Tare (t)').fill('15,7');
    await page.screenshot({ path: 'test-results/voyages-fiche.png' });
    await fiche.getByRole('button', { name: /Enregistrer : Pesé au départ/ }).click();

    await expect.poll(() => corps).not.toBeNull();
    expect(corps).toMatchObject({ p_trip_id: 't1', p_etat: 'WEIGHED_OUT', p_donnees: { brut: 56.4, tare: 15.7 }, p_note: null });
  });

  test('un refus du serveur est affiche tel quel', async ({ page }) => {
    await simulerApi(page, { ...REFERENTIEL, trips: [voyage('t1', 'VYG-261110-001', 'DELIVERED')] });
    await page.route('**/rest/v1/rpc/avancer_voyage', (route) =>
      route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0001', message: 'Motif obligatoire pour ce changement d\'état.' }) }),
    );
    await ouvrirVoyages(page);
    await page.getByText('VYG-261110-001').click();
    const fiche = page.getByRole('dialog');
    await fiche.getByRole('button', { name: 'Contester' }).click();
    await fiche.getByRole('button', { name: /Enregistrer : En litige/ }).click();
    await expect(fiche.getByText('Motif obligatoire pour ce changement d\'état.')).toBeVisible();
  });

  test('creation d\'un voyage par creer_voyage', async ({ page }) => {
    await simulerApi(page, REFERENTIEL);
    let corps: Record<string, unknown> | null = null;
    await page.route('**/rest/v1/rpc/creer_voyage', (route) => {
      corps = route.request().postDataJSON();
      return repondre(route, 'nouveau-voyage');
    });
    await ouvrirVoyages(page);
    await page.getByRole('button', { name: 'Nouveau voyage' }).click();
    const fenetre = page.getByRole('dialog');
    await fenetre.getByLabel('Origine *').selectOption({ label: 'Mine Nimba' });
    await fenetre.getByLabel('Destination *').selectOption({ label: 'Dépôt' });
    await fenetre.getByLabel('Camion').selectOption({ label: 'RC-1002' });
    await fenetre.getByLabel('Chauffeur').selectOption({ label: 'Fatou Test' });
    await expect(fenetre.getByLabel('Chargeuse ou pelle').locator('option')).toHaveText(['Non précisée', 'CAT-980L-01']);
    await fenetre.getByRole('button', { name: 'Créer le voyage' }).click();
    await expect.poll(() => corps).not.toBeNull();
    expect(corps).toMatchObject({
      p_departure_site_id: SITE_MINE,
      p_arrival_site_id: SITE_DEPOT,
      p_vehicle_id: 'v2',
      p_driver_id: 'c2',
      p_loader_vehicle_id: null,
      p_shift_id: null,
    });
  });
});
