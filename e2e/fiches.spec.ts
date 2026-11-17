import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi, SITE_DEPOT, SITE_MINE } from './api-simulee';

// Fiches terrain en pages standard (D-090, D-088 suite) sur l'API du cycle
// D-089 avec l'API simulee : tableau de bord et liste, preparation (FR
// generees depuis le Dispatch, FC sur une cuve), impression groupee avec
// apercu, remise et retour groupes, saisies FP et FC au retour, brouillon.

const SHIFT = '00000000-0000-4000-a000-0000000000d1';
const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fiche = (id: string, numero: string, type: string, etat: string, extra: Record<string, unknown> = {}) => ({
  id, numero, type, date_fiche: aujourdhui(), site_id: SITE_MINE, shift_id: SHIFT, vehicle_id: type === 'rotations' ? 'v1' : null, driver_id: 'c1',
  stockage_id: type === 'carburant' ? 'cu1' : null, agent: 'Mamadou Pointeur', options: { pesee: 'arrivee' },
  contenu: { voyages: [{ id: 't1', reference: 'VYG-001' }] }, statut: 'preparee', etat, version: 3, nb_impressions: 0, brouillon: null,
  trip_id: null, prepare_le: new Date().toISOString(), remise_le: null, retournee_le: null, controle_le: null, nb_ecarts: null, ...extra,
});

const JEU = {
  profiles: PROFIL,
  sites: [{ id: SITE_MINE, name: 'Mine Nimba', type: 'mine' }, { id: SITE_DEPOT, name: 'Dépôt', type: 'depot' }],
  work_shifts: [{ id: SHIFT, name: 'jour', display_name: 'Jour', start_time: '06:00:00', end_time: '18:00:00', shift_order: 1 }],
  vehicles: [
    { id: 'v1', registration: 'RC-1001', vehicle_type: 'tipper', status: 'active', site_id: SITE_MINE },
    { id: 'v2', registration: 'RC-1002', vehicle_type: 'tipper', status: 'active', site_id: SITE_MINE },
    { id: 'e1', registration: 'CAT-980L-01', vehicle_type: 'loader', status: 'active', site_id: SITE_MINE },
  ],
  drivers: [{ id: 'c1', name: 'Alpha Test' }],
  stockages_carburant: [{ id: 'cu1', code: 'CUVE-1', libelle: 'Cuve principale', site_id: SITE_MINE }],
  societe: [{ raison_sociale: 'Kogon Mining SARL', rccm: null, nif: null, adresse: 'Conakry' }],
  trips: [{ id: 't1', reference: 'VYG-001', vehicle_id: 'v1', etat: 'ASSIGNED' }, { id: 't3', reference: 'VYG-003', vehicle_id: 'v2', etat: 'ASSIGNED' }],
  fiches_terrain: [
    fiche('f1', 'FR-261117-001', 'rotations', 'preparee'),
    fiche('f2', 'FP-261117-001', 'pointage_engins', 'retournee', { vehicle_id: 'e1' }),
    fiche('f3', 'FC-261117-001', 'carburant', 'remise_agent'),
  ],
  fiches_carburant_lignes: [],
  fiches_rotations_lignes: [], v_fiches_ecarts_courants: [], fiches_journal: [],
};

const capturer = async (page: Page, fonction: string, reponse: unknown = null) => {
  const corps: Record<string, unknown>[] = [];
  await page.route(`**/rest/v1/rpc/${fonction}`, (route) => { corps.push(route.request().postDataJSON()); return repondre(route, reponse); });
  return corps;
};

const aller = async (page: Page, adresse: string) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto(`/${adresse}`);
};

test.describe('Fiches terrain (pages, cycle D-089)', () => {
  test('tableau de bord et liste du jour, camions sans fiche signales', async ({ page }) => {
    await simulerApi(page, JEU);
    await aller(page, '#/fiches');
    await expect(page.getByRole('heading', { name: 'Fiches terrain', exact: true })).toBeVisible();
    const tableau = page.getByRole('region', { name: 'Tableau de bord des fiches' });
    await expect(tableau).toContainText('Préparées : 1');
    await expect(tableau).toContainText('Retournées, à saisir : 1');
    await expect(tableau).toContainText('Chez l\'agent : 1');
    await expect(page.getByText('1 camion(s) avec des voyages du jour sans fiche de rotations.')).toBeVisible();
    await page.getByRole('button', { name: 'Fiche FR-261117-001' }).click();
    await expect(page).toHaveURL(/#\/fiches\/f1/);
    await expect(page.getByRole('article', { name: 'Fiche FR-261117-001' })).toContainText('Préparée');
  });

  test('preparation : FR generees depuis le Dispatch, puis impression groupee enregistree', async ({ page }) => {
    await simulerApi(page, JEU);
    const generees = await capturer(page, 'generer_fiches_rotation', [{ fiche_id: 'f1', numero: 'FR-261117-001', vehicle_id: 'v1', shift_id: SHIFT, creee: true }]);
    const impressions = await capturer(page, 'enregistrer_impression_fiches', 1);
    await aller(page, '#/fiches');
    await page.getByRole('link', { name: 'Préparer des fiches' }).click();
    const form = page.getByRole('form', { name: 'Préparer des fiches' });
    await form.getByLabel('Agent prévu').fill('Mamadou Pointeur');
    await form.getByRole('button', { name: 'Générer les fiches de rotations' }).click();
    await expect.poll(() => generees.length).toBe(1);
    expect(generees[0]).toMatchObject({ p_site_id: SITE_MINE, p_shift_id: SHIFT, p_regle: 'camion_shift', p_agent: 'Mamadou Pointeur' });
    await expect(page).toHaveURL(/#\/fiches\/lot\/imprimer\?ids=f1/);
    await expect(page.getByRole('article', { name: 'Fiche FR-261117-001' })).toContainText('FICHE DE ROTATIONS');
    await page.getByRole('button', { name: 'Enregistrer l\'impression' }).click();
    await expect.poll(() => impressions.length).toBe(1);
    expect(impressions[0]).toMatchObject({ p_ids: ['f1'], p_motif: null });
  });

  test('fiche carburant : cuve exigee, creee par creer_fiche', async ({ page }) => {
    await simulerApi(page, JEU);
    const creees = await capturer(page, 'creer_fiche', 'f3');
    await aller(page, '#/fiches/nouveau');
    const form = page.getByRole('form', { name: 'Préparer des fiches' });
    await form.getByLabel('Type de fiche *').selectOption('carburant');
    await form.getByRole('button', { name: 'Créer la fiche' }).click();
    await expect(form).toContainText('Cuve requise pour une fiche carburant');
    expect(creees.length).toBe(0);
    await form.getByLabel('Cuve *').selectOption({ label: 'CUVE-1 Cuve principale' });
    await form.getByRole('button', { name: 'Créer la fiche' }).click();
    await expect.poll(() => creees.length).toBe(1);
    expect(creees[0]).toMatchObject({ p_type: 'carburant', p_stockage_id: 'cu1', p_site_id: SITE_MINE });
  });

  test('remise et retour groupes depuis la liste', async ({ page }) => {
    await simulerApi(page, JEU);
    const remises = await capturer(page, 'remettre_fiches', 'r1');
    const retours = await capturer(page, 'enregistrer_retour_fiches', 'x1');
    await aller(page, '#/fiches');
    await page.getByRole('checkbox', { name: 'Sélectionner Fiche FR-261117-001' }).check();
    await page.getByRole('checkbox', { name: 'Sélectionner Fiche FC-261117-001' }).check();
    await page.getByRole('toolbar', { name: 'Actions groupées' }).getByRole('button', { name: 'Remettre à l\'agent' }).click();
    const form = page.getByRole('form', { name: 'Remettre les fiches à l\'agent' });
    await expect(form.getByRole('button', { name: 'Remettre à l\'agent' })).toBeDisabled();
    await form.getByLabel('Agent qui reçoit les fiches *').fill('Ibrahima Agent');
    await form.getByRole('button', { name: 'Remettre à l\'agent' }).click();
    await expect.poll(() => remises.length).toBe(1);
    expect(remises[0]).toMatchObject({ p_ids: ['f1', 'f3'], p_agent: 'Ibrahima Agent' });

    await aller(page, '#/fiches/lot/retour?ids=f3');
    const retour = page.getByRole('form', { name: 'Enregistrer le retour des fiches' });
    await retour.getByLabel('Agent qui rend les fiches *').fill('Ibrahima Agent');
    await retour.getByLabel('État au retour de FC-261117-001').selectOption('incomplete');
    await retour.getByRole('button', { name: 'Enregistrer le retour' }).click();
    await expect.poll(() => retours.length).toBe(1);
    expect(retours[0]).toMatchObject({ p_agent: 'Ibrahima Agent', p_details: [{ fiche_id: 'f3', etat_retour: 'incomplete' }] });
  });

  test('saisie FP au retour : brouillon versionne puis pointage', async ({ page }) => {
    await simulerApi(page, JEU);
    const brouillons = await capturer(page, 'enregistrer_brouillon_fiche', 4);
    const pointages = await capturer(page, 'saisir_pointage_fiche', 'p1');
    await aller(page, '#/fiches/f2/saisir-pointage');
    const form = page.getByRole('form', { name: /Saisir un pointage de la fiche FP-261117-001/ });
    await form.getByLabel('Horamètre début *').fill('1200');
    await form.getByLabel('Horamètre fin *').fill('1208,5');
    await form.getByLabel('Heures productives').fill('9');
    await expect(form).toContainText('Heures productives supérieures aux heures moteur');
    await form.getByLabel('Heures productives').fill('7');
    await form.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
    await expect.poll(() => brouillons.length).toBe(1);
    expect(brouillons[0]).toMatchObject({ p_id: 'f2', p_version: 3, p_brouillon: { pointage: { index_debut: '1200', vehicle_id: 'e1' } } });
    await form.getByRole('button', { name: 'Enregistrer le pointage' }).click();
    await expect.poll(() => pointages.length).toBe(1);
    expect(pointages[0]).toMatchObject({ p_fiche_id: 'f2', p_vehicle_id: 'e1', p_index_debut: 1200, p_index_fin: 1208.5, p_heures_productives: 7 });
  });

  test('saisie FC au retour : distribution envoyee sans valeur ajoutee', async ({ page }) => {
    await simulerApi(page, { ...JEU, fiches_terrain: [fiche('f3', 'FC-261117-001', 'carburant', 'retournee')] });
    const lignes = await capturer(page, 'saisir_ligne_carburant', 'l1');
    await aller(page, '#/fiches/f3/saisir-carburant');
    const form = page.getByRole('form', { name: /Saisir une distribution de la fiche FC-261117-001/ });
    await form.getByLabel('Engin destinataire *').selectOption({ label: 'CAT-980L-01' });
    await form.getByLabel('Date et heure *').fill('2026-01-01T08:00');
    await form.getByLabel('Litres *').fill('180');
    await form.getByLabel('Index pompe début').fill('5000');
    await form.getByLabel('Index pompe fin').fill('5180');
    await form.getByRole('button', { name: 'Enregistrer la distribution' }).click();
    await expect.poll(() => lignes.length).toBe(1);
    expect(lignes[0]).toMatchObject({ p_fiche_id: 'f3', p_rang: 1, p_ligne: { vehicle_id: 'e1', litres: 180, index_pompe_debut: 5000, index_pompe_fin: 5180, destinataire_confirme: false }, p_motif_correction: null });
  });
});
