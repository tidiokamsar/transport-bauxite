import { expect, test, type Page } from '@playwright/test';
import { ilYa, PROFIL, repondre, simulerApi, SITE_DEPOT, SITE_MINE } from './api-simulee';

// Dispatch Control Center (D-087) avec l'API simulee : tableau de bord
// cliquable, instance de shift distincte du filtre, conflit de version,
// suspension, supervision (GPS ancien, perte de connexion).

const SHIFT = '00000000-0000-4000-a000-0000000000d1';
const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const voyage = (id: string, reference: string, extra: Record<string, unknown> = {}) => ({
  id, reference, etat: 'PLANNED', planned_date: aujourdhui(), shift_id: SHIFT, departure_site_id: SITE_MINE, arrival_site_id: SITE_DEPOT,
  vehicle_id: null, driver_id: null, loader_vehicle_id: null, etat_modifie_le: ilYa(30), net_weight: null, load_weight: null,
  net_weight_reception: null, accepted_tonnage: null, actual_departure_time: null, actual_arrival_time: null, notes: null, ...extra,
});

const JEU = {
  profiles: PROFIL,
  sites: [{ id: SITE_MINE, name: 'Mine Nimba', type: 'mine' }, { id: SITE_DEPOT, name: 'Dépôt', type: 'depot' }],
  work_shifts: [{ id: SHIFT, name: 'jour', display_name: 'Jour', start_time: '00:00:00', end_time: '23:59:00', shift_order: 1 }],
  vehicles: [
    { id: 'v1', registration: 'RC-1001', vehicle_type: 'tipper', status: 'active', site_id: SITE_MINE, capacity_tonnes: 40 },
    { id: 'v2', registration: 'RC-1002', vehicle_type: 'tipper', status: 'active', site_id: SITE_MINE, capacity_tonnes: 40 },
  ],
  drivers: [
    { id: 'c1', name: 'Alpha Test', status: 'active', license_expiry: '2099-01-01' },
    { id: 'c2', name: 'Bah Test', status: 'active', license_expiry: '2099-01-01' },
  ],
  trips: [
    voyage('t1', 'VYG-001'),
    voyage('t2', 'VYG-002', { etat: 'IN_TRANSIT', vehicle_id: 'v2', driver_id: 'c2' }),
  ],
  suspensions_voyage: [{ trip_id: 't2', action: 'suspension', motif: 'Piste fermée', cree_le: ilYa(5), rang: 1 }],
};

const INDICATEURS = [
  { code: 'voyages_crees', libelle: 'Voyages crees', valeur: 2, unite: 'voyages', source: 'trips du shift', filtre: 'tous', calcule_le: new Date().toISOString() },
  { code: 'voyages_suspendus', libelle: 'Suspendus', valeur: 1, unite: 'voyages', source: 'suspensions_voyage', filtre: 'suspendus', calcule_le: new Date().toISOString() },
  { code: 'tonnes_validees', libelle: 'Tonnes validees (releve CBG rapproche)', valeur: null, unite: 't', source: 'v_rapprochements_pesee_courants', filtre: 'termines', calcule_le: new Date().toISOString() },
];

const ouvrir = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1300 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Dispatch' }).first().click();
  await expect(page.getByRole('heading', { name: 'Dispatch', exact: true })).toBeVisible();
};

test.describe('Dispatch Control Center (D-087)', () => {
  test('parcours principal : tableau de bord, liste filtree, suspension, shift et conflit de version', async ({ page }) => {
    await simulerApi(page, JEU);
    await page.route('**/rest/v1/rpc/indicateurs_dispatch', (route) => repondre(route, INDICATEURS));
    const reprises: unknown[] = [];
    await page.route('**/rest/v1/rpc/reprendre_voyage', (route) => { reprises.push(route.request().postDataJSON()); return repondre(route, 'ok'); });
    const planifications: unknown[] = [];
    await page.route('**/rest/v1/rpc/planifier_poste', (route) => { planifications.push(route.request().postDataJSON()); return repondre(route, 'p1'); });
    await page.route('**/rest/v1/rpc/affecter_voyage', (route) => route.fulfill({
      status: 400, contentType: 'application/json',
      body: JSON.stringify({ code: '40001', message: 'Voyage modifie entre-temps par un autre utilisateur (version 1 au lieu de 0) : recharger avant de decider' }),
    }));
    await ouvrir(page);

    // Indicateurs : valeur, source, « sans données » si absent.
    const tableau = page.getByRole('region', { name: 'Tableau de bord du dispatch' });
    await expect(tableau.getByRole('button', { name: 'Tonnes validees (releve CBG rapproche) : sans données' })).toBeVisible();
    await page.screenshot({ path: 'test-results/dispatch-control-center.png', fullPage: true });

    // Conflit de version : message clair, rien n'est ecrase.
    await page.getByRole('button', { name: 'Accepter VYG-001' }).click();
    await expect(page.getByText('VYG-001 : Conflit : Voyage modifie entre-temps', { exact: false })).toBeVisible();

    // Clic sur un indicateur : liste filtree.
    await tableau.getByRole('button', { name: 'Suspendus : 1 voyages' }).click();
    await expect(page.getByRole('tab', { name: 'Suspendus (1)' })).toHaveAttribute('aria-selected', 'true');
    const liste = page.getByRole('table', { name: 'Voyages par état' });
    await expect(liste.getByText('VYG-002')).toBeVisible();
    await expect(liste.getByText('VYG-001')).toHaveCount(0);

    // Reprise motivee.
    await page.getByRole('button', { name: 'Reprendre VYG-002' }).click();
    const fenetre = page.getByRole('article');
    await expect(fenetre.getByRole('button', { name: 'Reprendre' })).toBeDisabled();
    await fenetre.getByLabel('Motif (obligatoire)').fill('Piste rouverte');
    await fenetre.getByRole('button', { name: 'Reprendre' }).click();
    await expect.poll(() => reprises.length).toBe(1);
    expect(reprises[0]).toMatchObject({ p_trip_id: 't2', p_motif: 'Piste rouverte' });

    // Le filtre n'est pas un shift actif : sans instance, « non planifié ».
    await page.getByRole('tab', { name: 'Shift et préparation' }).click();
    await expect(page.getByText('Non planifié')).toBeVisible();
    await page.getByRole('button', { name: 'Planifier le shift' }).click();
    await page.getByRole('article').getByRole('button', { name: 'Planifier le shift' }).click();
    await expect.poll(() => planifications.length).toBe(1);
    expect(planifications[0]).toMatchObject({ p_date: aujourdhui(), p_shift_id: SHIFT, p_site_id: SITE_MINE });
  });

  test('cloture : motif exige si des voyages ne sont pas termines', async ({ page }) => {
    await simulerApi(page, { ...JEU, postes: [{ id: 'p1', statut: 'en_cours', version: 4, date_poste: aujourdhui(), shift_id: SHIFT, site_id: SITE_MINE }] });
    const clotures: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/cloturer_shift', (route) => { clotures.push(route.request().postDataJSON()); return repondre(route, {}); });
    await ouvrir(page);
    await page.getByRole('tab', { name: 'Shift et préparation' }).click();
    await expect(page.getByText('En cours', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Clôturer le shift' }).click();
    const fenetre = page.getByRole('article');
    await expect(fenetre.getByText('2 voyage(s) non terminé(s)', { exact: false })).toBeVisible();
    await fenetre.getByLabel('Consignes de passation (obligatoires)').fill('RAS');
    await expect(fenetre.getByRole('button', { name: 'Clôturer' })).toBeDisabled();
    await fenetre.getByLabel('Motif de clôture avec voyages non terminés').fill('Pluie : arrêt à 16 h');
    await fenetre.getByRole('button', { name: 'Clôturer' }).click();
    await expect.poll(() => clotures.length).toBe(1);
    expect(clotures[0]).toMatchObject({ p_poste_id: 'p1', p_motif: 'Pluie : arrêt à 16 h', p_version: 4 });
  });

  test('supervision : GPS ancien jamais presente comme en direct, perte de connexion signalee', async ({ page }) => {
    await simulerApi(page, JEU);
    let coupure = false;
    await page.route('**/rest/v1/rpc/supervision_dispatch', (route) => {
      if (coupure) return route.abort('internetdisconnected');
      return repondre(route, [
        { trip_id: 't2', reference: 'VYG-002', etat: 'IN_TRANSIT', vehicle_id: 'v2', driver_id: 'c2', suspendu: false,
          position_le: ilYa(240), latitude: 7.6, longitude: -8.4, evenement_le: ilYa(300), dernier_evenement: 'IN_TRANSIT',
          transmission_le: ilYa(240), source: 'gps', anciennete_min: 240, depuis_etat_min: 300, incidents: 0 },
        { trip_id: 't1', reference: 'VYG-001', etat: 'PLANNED', vehicle_id: null, driver_id: null, suspendu: false,
          position_le: null, latitude: null, longitude: null, evenement_le: null, dernier_evenement: null,
          transmission_le: null, source: null, anciennete_min: null, depuis_etat_min: 30, incidents: 0 },
      ]);
    });
    await ouvrir(page);
    await page.getByRole('tab', { name: 'Supervision' }).click();
    const table = page.getByRole('table', { name: 'Supervision' });
    const ligne = table.getByRole('row').filter({ hasText: 'VYG-002' });
    await expect(ligne.getByText('GPS ancien')).toBeVisible();
    await expect(ligne.getByText('transmission ancienne (il y a 4 h 00)')).toBeVisible();
    await expect(page.getByText('Positions GPS toutes de plus de 15 min : carte non affichée.')).toBeVisible();
    await expect(table.getByRole('row').filter({ hasText: 'VYG-001' }).getByText('aucune transmission').first()).toBeVisible();

    // Perte de connexion : signalee, rien n'est presente comme actuel.
    coupure = true;
    await page.getByRole('tab', { name: 'Affectations' }).click();
    await page.getByRole('tab', { name: 'Supervision' }).click();
    await expect(page.getByText(/Liaison perdue/)).toBeVisible();
  });
});
