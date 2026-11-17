import { expect, test, type Page } from '@playwright/test';
import { aujourdhuiA, PROFIL, repondre, simulerApi, SITE_DEPOT, SITE_MINE } from './api-simulee';

// Operations transport (D-088) avec l'API simulee : les sept scenarios de
// coherence (registre, chronologie, fiche FR, ticket CBG, anomalie,
// reaffectation, controles) et les refus du serveur (droit, concurrence,
// doublon). Le journal vient de la vue v_journal_voyage ; l'ecran n'invente
// rien et envoie les fonctions serveur existantes.

const JOUR = aujourdhuiA(6).slice(0, 10);

const voyage = (id: string, reference: string, etat: string, extra: Record<string, unknown> = {}) => ({
  id, reference, planned_date: JOUR, vehicle_id: 'v2', driver_id: 'c1', loader_vehicle_id: null, departure_site_id: SITE_MINE, arrival_site_id: SITE_DEPOT,
  shift_id: 's1', etat, etat_modifie_le: aujourdhuiA(7), net_weight: null, load_weight: null, net_weight_reception: null, accepted_tonnage: null,
  actual_departure_time: null, actual_arrival_time: null, notes: null, km_start: 1000, km_end: 1042, shift_sequence: 2, estimated_distance_km: 40, ...extra,
});

const evt = (id: string, type: string, libelle: string, h: number, extra: Record<string, unknown> = {}) => ({
  id, trip_id: 't1', voyage_reference: 'VYG-OPS-001', rotation: 2, type, libelle, date_operation: aujourdhuiA(h), date_saisie: aujourdhuiA(h),
  source: 'dispatch', auteur: null, donnees: {}, justificatif: null, statut: 'declare', verification_id: null, corrige_ref: null, annule: false,
  table_source: 'test', ...extra,
});

const JOURNAL = [
  evt('decision_dispatch:d1', 'affectation', 'affectation acceptee', 6, { statut: 'valide', donnees: { vehicle_id: 'v1', driver_id: 'c1' } }),
  evt('decision_dispatch:d2', 'reaffectation', 'reaffectation modifiee', 6, { statut: 'valide', corrige_ref: 'decision_dispatch:d1', donnees: { vehicle_id: 'v2', driver_id: 'c1', motif: 'Crevaison' } }),
  evt('trip_event:e1', 'etat', 'ASSIGNED -> AT_LOADING', 7, { source: 'agent_kogon' }),
  evt('trip_event:e2', 'etat', 'AT_LOADING -> LOADING', 7, { source: 'agent_kogon', statut: 'verifie', verification_id: 'w1' }),
  evt('ligne_fiche:l1', 'ligne_fiche_rotation', 'Rotation 1 de la fiche FR-OPS-01', 8, { source: 'agent_kogon', justificatif: 'FR-OPS-01', donnees: { fiche_id: 'f1', fiche: 'FR-OPS-01', etat_fiche: 'retournee' } }),
  evt('ticket_cbg:k1', 'ticket_cbg', 'Ticket CBG T-OPS-1', 9, { source: 'agent_kogon', donnees: { ticket: 'T-OPS-1', net: 39 } }),
  evt('rectification_ticket:r1', 'rectification_ticket', 'Rectification du ticket T-OPS-1 -> T-OPS-1B', 10, { source: 'agent_kogon', corrige_ref: 'ticket_cbg:k1', donnees: { nouveau: { net: 39.5 }, motif: 'Saisie erronee' } }),
  evt('ligne_releve_cbg:c1', 'ligne_releve_cbg', 'Releve officiel CBG RCBG-11 ticket T-OPS-1B', 10, { source: 'import_cbg', statut: 'valide', donnees: { releve: 'RCBG-11', ticket: 'T-OPS-1B', net: 41.2 } }),
  evt('anomalie_pesee:a1', 'anomalie_pesee', 'Anomalie ecart_poids (haute)', 11, { source: 'systeme', donnees: { categorie: 'ecart_poids' } }),
  evt('journal_anomalie:ja1', 'traitement_anomalie', 'Anomalie : justifier (ouverte -> justifiee)', 12, { source: 'agent_kogon', statut: 'valide', corrige_ref: 'anomalie_pesee:a1' }),
];

const JEU = {
  profiles: PROFIL,
  sites: [{ id: SITE_MINE, name: 'Mine Nimba', type: 'mine' }, { id: SITE_DEPOT, name: 'Dépôt CBG', type: 'depot' }],
  vehicles: [{ id: 'v1', registration: 'RC-1001', vehicle_type: 'tipper', status: 'active' }, { id: 'v2', registration: 'RC-1002', vehicle_type: 'tipper', status: 'active' }],
  drivers: [{ id: 'c1', name: 'Mamadou Test', status: 'active' }],
  work_shifts: [{ id: 's1', name: 'jour', display_name: 'Jour', start_time: '00:00:00', end_time: '23:59:00', shift_order: 1 }],
  trips: [voyage('t1', 'VYG-OPS-001', 'DELIVERED')],
  trip_events: [],
  v_journal_voyage: JOURNAL,
  fiches_terrain: [],
  anomalies_pesee: [{ id: 'a1', trip_id: 't1', categorie: 'ecart_poids', gravite: 'haute', statut: 'ouverte', description: 'Ecart de 2,2 t', cree_le: aujourdhuiA(11) }],
  postes: [{ id: 'p1', statut: 'en_cours', shift_id: 's1', site_id: SITE_MINE }],
  incidents: [],
  pieces_jointes: [],
};

const capturer = async (page: Page, fonction: string, reponse: unknown = null) => {
  const corps: Record<string, unknown>[] = [];
  await page.route(`**/rest/v1/rpc/${fonction}`, (route) => {
    corps.push(route.request().postDataJSON());
    return repondre(route, reponse);
  });
  return corps;
};

const refuser = (page: Page, fonction: string, code: string, message: string) =>
  page.route(`**/rest/v1/rpc/${fonction}`, (route) => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code, message }) }));

const aller = async (page: Page, adresse: string) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto(`/${adresse}`);
};

const fiche = (page: Page) => page.getByRole('article', { name: 'Fiche VYG-OPS-001' });
const onglet = (page: Page, nom: string) => page.getByRole('tab', { name: new RegExp(`^${nom}`) }).click();

test.describe('Operations transport (D-088)', () => {
  test('1. vue generale, registre et fiche du voyage avec le contexte dans l\'adresse', async ({ page }) => {
    await simulerApi(page, JEU);
    await capturer(page, 'controles_voyage', []);
    await aller(page, `#/operations?date=${JOUR}`);
    await expect(page.getByRole('heading', { name: 'Opérations transport' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Journal des événements' })).toBeVisible();
    await page.getByRole('link', { name: /Voyages & Rotations/ }).click();
    await expect(page).toHaveURL(new RegExp(`#/trips\\?date=${JOUR}`));
    await page.getByRole('row').filter({ hasText: 'VYG-OPS-001' }).click();
    await expect(fiche(page)).toBeVisible();
    await expect(page).toHaveURL(/#\/trips\/t1\?date=/);
    await expect(fiche(page)).toContainText('Mine Nimba → Dépôt CBG');
    await expect(fiche(page).getByRole('link', { name: 'Voir dans Dispatch' })).toHaveAttribute('href', new RegExp(`#/dispatch\\?date=${JOUR}`));
  });

  test('2. chronologie unifiee et verification d\'un evenement declare', async ({ page }) => {
    await simulerApi(page, JEU);
    await capturer(page, 'controles_voyage', []);
    const verif = await capturer(page, 'verifier_evenement_voyage', 'w9');
    await aller(page, '#/trips/t1?onglet=chronologie');
    const table = fiche(page).getByRole('region', { name: 'Événements' });
    await expect(table).toContainText('ASSIGNED -> AT_LOADING');
    await expect(table).toContainText('Releve officiel CBG RCBG-11');
    await expect(table).toContainText('Vérifié');
    await table.getByRole('row').filter({ hasText: 'ASSIGNED -> AT_LOADING' }).getByRole('link', { name: 'Vérifier' }).click();
    const form = page.getByRole('form', { name: 'Vérifier un événement du voyage' });
    await expect(form).toContainText('Déclaré');
    await form.getByRole('button', { name: 'Enregistrer la vérification' }).click();
    await expect.poll(() => verif.length).toBe(1);
    expect(verif[0]).toMatchObject({ p_trip_id: 't1', p_evenement_id: 'trip_event:e1', p_statut: 'verifie', p_precedente_id: null });
  });

  test('3. fiche FR remise, retournee, saisie et reliee au voyage', async ({ page }) => {
    const base = { id: 'f1', numero: 'FR-OPS-01', type: 'rotations', date_fiche: JOUR, site_id: SITE_MINE, shift_id: 's1', vehicle_id: 'v2', driver_id: 'c1', agent: null,
      version: 3, nb_impressions: 1, trip_id: null, prepare_le: aujourdhuiA(5), remise_le: null, retournee_le: null, controle_le: null, nb_ecarts: null };
    await simulerApi(page, { ...JEU, fiches_terrain: [{ ...base, etat: 'imprimee' }], fiches_rotations_lignes: [], v_fiches_ecarts_courants: [], fiches_journal: [] });
    const remises = await capturer(page, 'remettre_fiches', 'lot1');
    await aller(page, '#/fiches/f1');
    const art = page.getByRole('article', { name: 'Fiche FR-OPS-01' });
    await expect(art).toContainText('Imprimée');
    await art.getByRole('link', { name: 'Remettre à l\'agent' }).click();
    const form = page.getByRole('form', { name: /Remettre à l'agent/ });
    await expect(form.getByRole('button', { name: 'Remettre à l\'agent' })).toBeDisabled();
    await form.getByLabel('Agent qui reçoit les fiches *').fill('Ibrahima Agent');
    await form.getByRole('button', { name: 'Remettre à l\'agent' }).click();
    await expect.poll(() => remises.length).toBe(1);
    expect(remises[0]).toMatchObject({ p_ids: ['f1'], p_agent: 'Ibrahima Agent' });

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await simulerApi(page, { ...JEU, fiches_terrain: [{ ...base, etat: 'retournee' }], fiches_rotations_lignes: [], v_fiches_ecarts_courants: [], fiches_journal: [] });
    const lignes = await capturer(page, 'saisir_ligne_rotation', 'l1');
    await aller(page, '#/fiches/f1/saisir-ligne');
    const saisie = page.getByRole('form', { name: /Saisir une rotation de la fiche FR-OPS-01/ });
    await saisie.getByLabel('Voyage relié').selectOption({ label: 'VYG-OPS-001' });
    await saisie.getByLabel('Compteur au départ (km)').fill('1000');
    await saisie.getByLabel('Compteur à l\'arrivée (km)').fill('990');
    await expect(saisie).toContainText('Compteur d\'arrivée inférieur au départ');
    await saisie.getByLabel('Compteur à l\'arrivée (km)').fill('1042');
    await saisie.getByRole('button', { name: 'Enregistrer la rotation' }).click();
    await expect.poll(() => lignes.length).toBe(1);
    expect(lignes[0]).toMatchObject({ p_fiche_id: 'f1', p_rang: 1, p_ligne: { trip_id: 't1', km_depart: 1000, km_arrivee: 1042 }, p_motif_correction: null });

    await capturer(page, 'controles_voyage', []);
    await aller(page, '#/trips/t1?onglet=fiches');
    await expect(fiche(page).getByRole('region', { name: 'Fiches reliées' }).getByRole('link', { name: 'FR-OPS-01' })).toHaveAttribute('href', '#/fiches/f1');
  });

  test('4. ticket CBG : officiel CBG et saisie KOGON distincts, original conserve', async ({ page }) => {
    await simulerApi(page, JEU);
    await capturer(page, 'controles_voyage', []);
    await aller(page, '#/trips/t1?onglet=tickets');
    const officiel = fiche(page).getByRole('region', { name: 'Relevé officiel CBG (source A)' });
    await expect(officiel).toContainText('RCBG-11');
    await expect(officiel).toContainText('41,2');
    const kogon = fiche(page).getByRole('region', { name: 'Ticket de réception et rectifications (saisie KOGON)' });
    await expect(kogon).toContainText('Ticket CBG T-OPS-1');
    await expect(kogon).toContainText('Rectification du ticket T-OPS-1 -> T-OPS-1B');
  });

  test('5. anomalie ouverte puis traitee, visible depuis les anomalies et le voyage', async ({ page }) => {
    await simulerApi(page, JEU);
    await capturer(page, 'controles_voyage', []);
    await aller(page, '#/operations-anomalies');
    await expect(page.getByRole('heading', { name: 'Anomalies et écarts' })).toBeVisible();
    await page.getByRole('row').filter({ hasText: 'ecart_poids' }).first().click();
    await expect(page).toHaveURL(/#\/trips\/t1\?onglet=anomalies/);
    const table = fiche(page).getByRole('region', { name: 'Événements' });
    await expect(table).toContainText('Anomalie ecart_poids (haute)');
    await expect(table).toContainText('Anomalie : justifier (ouverte -> justifiee)');
  });

  test('6. reaffectation identique partout, historique conserve', async ({ page }) => {
    await simulerApi(page, JEU);
    await capturer(page, 'controles_voyage', []);
    await aller(page, `#/trips?date=${JOUR}`);
    await expect(page.getByRole('row').filter({ hasText: 'VYG-OPS-001' })).toContainText('RC-1002');
    await aller(page, '#/trips/t1?onglet=affectations');
    const aff = fiche(page).getByRole('region', { name: 'Affectations (courante et historique)' });
    await expect(aff.getByRole('row')).toHaveCount(3);
    await expect(aff.getByRole('row').filter({ hasText: 'reaffectation' })).toContainText('RC-1002');
    await expect(aff.getByRole('row').filter({ hasText: 'reaffectation' })).toContainText('Crevaison');
    await expect(aff.getByRole('row').filter({ hasText: 'affectation acceptee' })).toContainText('RC-1001');
    await onglet(page, 'Synthèse');
    await expect(fiche(page).getByRole('region', { name: 'Affectation courante' })).toContainText('RC-1002');
  });

  test('7. controles et clotures du jour', async ({ page }) => {
    await simulerApi(page, JEU);
    const appels = await capturer(page, 'controles_voyage', [
      { ordre: 1, code: 'affectation_valide', libelle: 'Affectation valide', resultat: 'conforme', detail: 'ok' },
      { ordre: 5, code: 'fiche_presente', libelle: 'Fiche terrain presente', resultat: 'alerte', detail: 'Aucune fiche terrain reliee : absence a justifier' },
    ]);
    await aller(page, `#/operations-controles?date=${JOUR}`);
    await expect(page.getByText('en_cours')).toBeVisible();
    await page.getByRole('button', { name: 'Contrôler les voyages du jour' }).click();
    await expect(page.getByText('Voyages contrôlés : 1, en alerte : 1')).toBeVisible();
    expect(appels[0]).toMatchObject({ p_trip_id: 't1' });
    await page.getByRole('link', { name: 'VYG-OPS-001' }).click();
    await expect(page).toHaveURL(/#\/trips\/t1\?.*onglet=controles/);
    await expect(fiche(page).getByRole('region', { name: 'Contrôles du voyage' })).toContainText('Aucune fiche terrain reliee : absence a justifier');
  });

  test('refus du serveur : droit, concurrence et doublon affiches tels quels', async ({ page }) => {
    await simulerApi(page, JEU);
    await capturer(page, 'controles_voyage', []);
    for (const [code, message] of [
      ['42501', 'separation_violee : l\'auteur d\'une saisie ne la verifie pas'],
      ['40001', 'Verification modifiee entre-temps : recharger l\'evenement'],
      ['23505', 'Evenement deja verifie'],
    ]) {
      await page.unroute('**/rest/v1/rpc/verifier_evenement_voyage');
      await refuser(page, 'verifier_evenement_voyage', code, message);
      await aller(page, `#/trips/t1/verifier?evenement=${encodeURIComponent('trip_event:e1')}`);
      const form = page.getByRole('form', { name: 'Vérifier un événement du voyage' });
      await form.getByRole('button', { name: 'Enregistrer la vérification' }).click();
      await expect(form.getByRole('alert')).toContainText(message);
    }
  });
});
