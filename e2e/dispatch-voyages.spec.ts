import { expect, test, type Page } from '@playwright/test';
import { aujourdhuiA, ilYa, PROFIL, repondre, simulerApi, SITE_DEPOT, SITE_MINE } from './api-simulee';

// Lot 06 (D-066) avec l'API simulee : affectation groupee et rapport par
// voyage, simulation de scenarios (lecture seule), enchainement apres
// livraison, incident declare depuis la fiche voyage, rapports par axe avec
// export CSV, infractions dans la fiche chauffeur. Le serveur reste juge ;
// ici on verifie ce que l'ecran envoie et affiche.

const SHIFT = '00000000-0000-4000-a000-0000000000d1';
const SITE_SUD = '00000000-0000-4000-a000-0000000000b3';
const SITES = [
  { id: SITE_MINE, name: 'Mine Nimba', type: 'mine' },
  { id: SITE_DEPOT, name: 'Dépôt', type: 'depot' },
  { id: SITE_SUD, name: 'Dépôt Sud', type: 'depot' },
];
const VEHICULES = [
  { id: 'v1', registration: 'RC-1001', vehicle_type: 'tipper', status: 'active', site_id: SITE_MINE },
  { id: 'v2', registration: 'RC-1002', vehicle_type: 'tipper', status: 'active', site_id: SITE_MINE },
  { id: 'l1', registration: 'CAT-980L-01', vehicle_type: 'loader', status: 'active', site_id: SITE_MINE },
];
const CHAUFFEURS = [
  { id: 'c1', name: 'Alpha Test', employee_id: 'MAT-001', phone: null, email: null, hire_date: '2024-01-01', birth_date: null, license_number: 'PC-1',
    license_category: 'C', license_expiry: '2099-01-01', health_certificate_expiry: null, address: null, emergency_contact_name: null,
    emergency_contact_phone: null, contract_type: 'permanent', base_salary: 0, status: 'active', notes: null },
  { id: 'c2', name: 'Bah Test', employee_id: 'MAT-002', phone: null, email: null, hire_date: '2024-01-01', birth_date: null, license_number: 'PC-2',
    license_category: 'C', license_expiry: '2099-01-01', health_certificate_expiry: null, address: null, emergency_contact_name: null,
    emergency_contact_phone: null, contract_type: 'permanent', base_salary: 0, status: 'active', notes: null },
];
const jour = aujourdhuiA(6).slice(0, 10);
const voyage = (id: string, reference: string, etat: string, extra: Record<string, unknown> = {}) => ({
  id, reference, planned_date: jour, vehicle_id: null, driver_id: null, loader_vehicle_id: null,
  departure_site_id: SITE_MINE, arrival_site_id: SITE_DEPOT, shift_id: SHIFT, etat, etat_modifie_le: ilYa(30),
  net_weight: null, load_weight: null, net_weight_reception: null, accepted_tonnage: null,
  actual_departure_time: null, actual_arrival_time: null, notes: null, status: 'planned', ...extra,
});
const BASE = {
  profiles: PROFIL,
  sites: SITES,
  vehicles: VEHICULES,
  drivers: CHAUFFEURS,
  work_shifts: [{ id: SHIFT, name: 'jour', display_name: 'Jour', start_time: '00:00:00', end_time: '23:59:00', shift_order: 1 }],
};

/** Capture les appels d'une fonction serveur et repond la valeur donnee. */
const capturer = async (page: Page, fonction: string, reponse: unknown = null) => {
  const corps: Record<string, unknown>[] = [];
  await page.route(`**/rest/v1/rpc/${fonction}`, (route) => {
    corps.push(route.request().postDataJSON());
    return repondre(route, reponse);
  });
  return corps;
};

const ouvrir = async (page: Page, vue: string, titre: string) => {
  await page.setViewportSize({ width: 1600, height: 1300 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Paramètres', exact: true }).waitFor();
  const cible = page.getByRole('button', { name: vue, exact: true });
  if (!(await cible.isVisible())) await page.getByRole('button', { name: 'Flotte', exact: true }).click();
  await cible.click();
  await expect(page.getByRole('heading', { name: titre, exact: true })).toBeVisible();
};

test.describe('Dispatch, voyages et infractions (D-066)', () => {
  test('affectation groupee : selection, une operation, rapport par voyage', async ({ page }) => {
    await simulerApi(page, { ...BASE, trips: [voyage('t1', 'VYG-001', 'PLANNED'), voyage('t2', 'VYG-002', 'PLANNED')], v_realisation_objectifs: [] });
    const groupes = await capturer(page, 'affecter_en_groupe', [
      { trip_id: 't2', reference: 'VYG-002', resultat: 'refuse', decision_id: null, raison: 'Site ferme le 15/11/2026 : crue (affectation refusee)' },
    ]);
    const unitaires = await capturer(page, 'decider_affectation', 'ok');
    await ouvrir(page, 'Dispatch', 'Dispatch');
    await expect(page.getByRole('button', { name: 'Accepter la sélection (0)' })).toBeDisabled();
    await page.getByLabel('Sélectionner VYG-002').check();
    await page.getByRole('button', { name: 'Accepter la sélection (1)' }).click();
    await expect.poll(() => groupes.length).toBe(1);
    const liste = groupes[0].p_affectations as Record<string, unknown>[];
    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatchObject({ voyage: 't2', camion: 'v2', chauffeur: 'c2', engin: 'l1' });
    const rapport = page.getByRole('list', { name: 'Rapport par voyage' });
    await expect(rapport.getByText('Refusé')).toBeVisible();
    await expect(rapport.getByText('Site ferme le 15/11/2026 : crue (affectation refusee)')).toBeVisible();
    expect(unitaires).toHaveLength(0);
  });

  test('simulation : calcul explique sur les rotations observees, donnees insuffisantes signalees, rien n\'est ecrit', async ({ page }) => {
    await simulerApi(page, {
      ...BASE, trips: [], v_realisation_objectifs: [],
      infrastructures_site: [{ site_id: SITE_SUD, type: 'depot_reception', code: 'DEP-S', capacite: 500, unite_capacite: 'm3', actif: true }],
    });
    const stats = await capturer(page, 'statistiques_trajets', [
      { arrival_site_id: SITE_DEPOT, jours_observes: 10, voyages_livres: 40, charge_moyenne: 34, voyages_pesees: 40, cycle_moyen_min: 70, cycles_mesures: 40,
        rotation_moyenne_min: 120, rotations_mesurees: 30, rotation_min_observee: 95, rotation_max_observee: 160 },
      { arrival_site_id: SITE_SUD, jours_observes: 1, voyages_livres: 2, charge_moyenne: 33, voyages_pesees: 2, cycle_moyen_min: 50, cycles_mesures: 2,
        rotation_moyenne_min: 90, rotations_mesurees: 1, rotation_min_observee: 90, rotation_max_observee: 90 },
    ]);
    const ecritures = [...await capturer(page, 'affecter_en_groupe'), ...await capturer(page, 'decider_affectation')];
    await ouvrir(page, 'Dispatch', 'Dispatch');
    await expect.poll(() => stats.length).toBeGreaterThan(0);
    expect(stats.every((s) => s.p_shift_id === SHIFT)).toBe(true);
    expect(stats[0]).toMatchObject({ p_site_id: SITE_MINE, p_shift_id: SHIFT, p_jours: 14 });
    const comparaison = page.getByRole('table', { name: 'Comparaison des scénarios' });
    const versDepot = comparaison.getByRole('row').filter({ hasText: 'Toutes les rotations vers Dépôt' }).first();
    await expect(versDepot).toContainText('11 voyage(s)/camion (rotation 120 min) = 22 voyages');
    await expect(versDepot).toContainText('748 t');
    const versSud = comparaison.getByRole('row').filter({ hasText: 'Toutes les rotations vers Dépôt Sud' });
    await expect(versSud).toContainText('Données insuffisantes : 1 rotation(s) mesurée(s), 3 requise(s)');
    await expect(versSud).toContainText('non estimé');
    await expect(comparaison.getByRole('row').filter({ hasText: 'Répartition (modifiable)' })).toContainText('Résultat incomplet');
    await page.getByLabel('Camions vers Dépôt', { exact: true }).fill('2');
    await page.getByLabel('Camions vers Dépôt Sud').fill('0');
    await expect(comparaison.getByRole('row').filter({ hasText: 'Répartition (modifiable)' })).toContainText('748 t');
    await expect(page.getByText('Calcul (pas d\'optimisation)')).toBeVisible();
    await page.screenshot({ path: 'test-results/dispatch-simulation.png', fullPage: true });
    expect(ecritures).toHaveLength(0);
  });

  test('simulation sans voyage livre observe : sans donnees', async ({ page }) => {
    await simulerApi(page, { ...BASE, trips: [], v_realisation_objectifs: [] });
    await capturer(page, 'statistiques_trajets', []);
    await ouvrir(page, 'Dispatch', 'Dispatch');
    await expect(page.getByText('Aucun voyage livré depuis ce site sur la période observée', { exact: false })).toBeVisible();
  });

  test('fiche d\'un voyage livre : enchainement recommande et incident pre-rempli', async ({ page }) => {
    await simulerApi(page, {
      ...BASE,
      trips: [
        voyage('t1', 'VYG-001', 'DELIVERED', { vehicle_id: 'v1', driver_id: 'c1', loader_vehicle_id: 'l1', status: 'completed', net_weight: 34 }),
        voyage('t5', 'VYG-005', 'PLANNED'),
      ],
      trip_events: [], incidents: [],
    });
    const enchainements = await capturer(page, 'enchainer_voyage', 't5');
    const incidents = await capturer(page, 'declarer_incident', 'i1');
    await ouvrir(page, 'Voyages & Rotations', 'Voyages & Rotations');
    await page.getByRole('row').filter({ hasText: 'VYG-001' }).click();
    const fiche = page.getByRole('article', { name: 'Fiche VYG-001' });
    const suivant = fiche.getByRole('region', { name: 'Voyage suivant' });
    await expect(suivant).toContainText('Recommandé : enchaîner VYG-005');
    await expect(suivant).toContainText('RC-1001 et Alpha Test viennent de livrer VYG-001 : aucun retour au parking');
    await suivant.getByRole('button', { name: 'Enchaîner le voyage suivant' }).click();
    await expect.poll(() => enchainements.length).toBe(1);
    expect(enchainements[0]).toMatchObject({ p_trip_id: 't1', p_loader_vehicle_id: 'l1', p_suivant: 't5' });

    await fiche.getByRole('tab', { name: /^Incidents/ }).click();
    const zone = fiche.getByRole('region', { name: 'Incidents du voyage' });
    await expect(zone).toContainText('Aucun incident déclaré sur ce voyage.');
    await zone.getByRole('button', { name: 'Déclarer un incident' }).click();
    const form = zone.getByRole('form', { name: 'Déclaration d\'incident du voyage' });
    await expect(form).toContainText('Rattaché au voyage VYG-001 · camion RC-1001 · chauffeur Alpha Test · site Mine Nimba');
    await expect(form.getByRole('button', { name: 'Déclarer l\'incident' })).toBeDisabled();
    await form.getByLabel('Description *').fill('Crevaison pneu avant gauche');
    await form.getByRole('button', { name: 'Déclarer l\'incident' }).click();
    await expect.poll(() => incidents.length).toBe(1);
    expect(incidents[0]).toMatchObject({ p_trip: 't1', p_vehicle: 'v1', p_driver: 'c1', p_site: SITE_MINE, p_type: 'materiel', p_gravite: 'minor', p_description: 'Crevaison pneu avant gauche' });
  });

  test('enchainement sur un nouveau voyage : date envoyee, sanction de conduite signalee sans blocage', async ({ page }) => {
    await simulerApi(page, {
      ...BASE,
      trips: [voyage('t1', 'VYG-001', 'DELIVERED', { vehicle_id: 'v1', driver_id: 'c1', loader_vehicle_id: 'l1', status: 'completed', net_weight: 34 })],
      trip_events: [], incidents: [],
      sanctions_infraction: [{ sanction: 'retrait_conduite', infractions_chauffeur: { driver_id: 'c1', numero: 'INF-2026-00007', statut: 'enregistree' } }],
    });
    const enchainements = await capturer(page, 'enchainer_voyage', 't9');
    await ouvrir(page, 'Voyages & Rotations', 'Voyages & Rotations');
    await page.getByRole('row').filter({ hasText: 'VYG-001' }).click();
    const suivant = page.getByRole('article', { name: 'Fiche VYG-001' }).getByRole('region', { name: 'Voyage suivant' });
    await expect(suivant).toContainText('Recommandé : enchaîner un nouveau voyage sur le même trajet');
    await expect(suivant.getByRole('note')).toContainText('Alpha Test fait l\'objet d\'une sanction en vigueur (Retrait de la conduite, INF-2026-00007)');
    await expect(suivant.getByLabel('Date du voyage suivant')).not.toHaveValue('');
    await suivant.getByRole('button', { name: 'Enchaîner le voyage suivant' }).click();
    await expect.poll(() => enchainements.length).toBe(1);
    expect(enchainements[0]).toMatchObject({ p_trip_id: 't1', p_suivant: null, p_shift_id: SHIFT });
    expect(String(enchainements[0].p_date)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('fiche d\'un voyage : lecture impossible signalee, aucune recommandation ni liste vide', async ({ page }) => {
    await simulerApi(page, {
      ...BASE,
      trips: [voyage('t1', 'VYG-001', 'DELIVERED', { vehicle_id: 'v1', driver_id: 'c1', status: 'completed' })],
      trip_events: [],
    });
    await page.route('**/rest/v1/incidents*', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'panne simulee' }) }));
    await page.route('**/rest/v1/sanctions_infraction*', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'panne simulee' }) }));
    await ouvrir(page, 'Voyages & Rotations', 'Voyages & Rotations');
    await page.getByRole('row').filter({ hasText: 'VYG-001' }).click();
    const fiche = page.getByRole('article', { name: 'Fiche VYG-001' });
    await expect(fiche.getByRole('region', { name: 'Voyage suivant' }).getByRole('alert')).toContainText('Lecture impossible');
    await fiche.getByRole('tab', { name: /^Incidents/ }).click();
    await expect(fiche.getByRole('region', { name: 'Incidents du voyage' }).getByRole('alert')).toContainText('Incidents indisponibles');
    await expect(fiche.getByRole('region', { name: 'Incidents du voyage' })).not.toContainText('Aucun incident déclaré');
  });

  test('rapports par axe : tableau, mesures absentes signalees, export CSV', async ({ page }) => {
    await simulerApi(page, { ...BASE, trips: [] });
    const rapports = await capturer(page, 'rapport_voyages', [
      { cle: 'v1', libelle: 'RC-1001', voyages: 12, livres: 10, annules: 1, tonnes: 340.5, livres_sans_poids: 1, cycle_moyen_min: 72, cycles_mesures: 9,
        rotation_moyenne_min: 130, rotations_mesurees: 8, incidents: 2, litiges: 1 },
      { cle: null, libelle: null, voyages: 3, livres: 0, annules: 0, tonnes: null, livres_sans_poids: 0, cycle_moyen_min: null, cycles_mesures: 0,
        rotation_moyenne_min: null, rotations_mesurees: 0, incidents: 0, litiges: 0 },
    ]);
    await ouvrir(page, 'Voyages & Rotations', 'Voyages & Rotations');
    await page.getByRole('button', { name: 'Rapports par axe' }).click();
    const tableau = page.getByRole('table', { name: 'Rapport de voyages' });
    await expect(tableau.getByRole('row').filter({ hasText: 'RC-1001' })).toContainText('340,5 t');
    await expect(tableau.getByRole('row').filter({ hasText: 'RC-1001' })).toContainText('1 livré(s) sans poids');
    await expect(tableau.getByRole('row').filter({ hasText: 'Sans camion' })).toContainText('non mesurée');
    expect(rapports[0]).toMatchObject({ p_axe: 'camion' });
    await page.getByLabel('Axe du rapport').selectOption('chauffeur');
    await expect.poll(() => rapports.some((r) => r.p_axe === 'chauffeur')).toBe(true);
    const telechargement = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exporter CSV' }).click();
    expect((await telechargement).suggestedFilename()).toMatch(/^rapport-voyages-chauffeur-.*\.csv$/);
  });

  test('fiche chauffeur : registre des infractions, enregistrement et sanction motivee', async ({ page }) => {
    await simulerApi(page, {
      ...BASE,
      trips: [voyage('t1', 'VYG-001', 'DELIVERED', { vehicle_id: 'v1', driver_id: 'c1' })],
      infractions_chauffeur: [{
        id: 'i1', numero: 'INF-2026-00001', driver_id: 'c1', type: 'exces_vitesse', survenue_le: ilYa(120), lieu: 'PK 12', trip_id: 't1',
        vehicle_id: 'v1', constat: 'Radar 72 km/h en zone 40', source: 'controle_routier', reference_source: 'PV-77', statut: 'enregistree',
        motif_annulation: null, declare_le: ilYa(100),
      }],
      sanctions_infraction: [],
    });
    const enregistrements = await capturer(page, 'enregistrer_infraction', 'i2');
    const decisions = await capturer(page, 'decider_sanction', 's1');
    await ouvrir(page, 'Chauffeurs', 'Chauffeurs');
    await page.getByText('Alpha Test').first().click();
    await page.getByRole('tab', { name: /Infractions/ }).click();
    const registre = page.getByRole('region', { name: 'Infractions du chauffeur' });
    await expect(registre).toContainText('INF-2026-00001');
    await expect(registre).toContainText('voyage VYG-001');
    await expect(registre).toContainText('Sans décision');
    await registre.getByRole('button', { name: 'Décider de la sanction' }).click();
    const decision = registre.getByRole('group', { name: 'Décision de sanction' });
    await expect(decision.getByRole('button', { name: 'Enregistrer la décision' })).toBeDisabled();
    await decision.getByLabel('Motif *').fill('Premier manquement, rappel des règles');
    await decision.getByRole('button', { name: 'Enregistrer la décision' }).click();
    await expect.poll(() => decisions.length).toBe(1);
    expect(decisions[0]).toMatchObject({ p_infraction: 'i1', p_sanction: 'avertissement', p_motif: 'Premier manquement, rappel des règles' });

    await registre.getByRole('button', { name: 'Enregistrer une infraction' }).click();
    const saisie = registre.getByRole('group', { name: 'Nouvelle infraction' });
    await saisie.getByLabel('Type *').selectOption('telephone');
    await saisie.getByLabel('Voyage concerné').selectOption('t1');
    await saisie.getByLabel('Constat *').fill('Téléphone en main pendant la conduite');
    await saisie.getByRole('button', { name: 'Enregistrer' }).click();
    await expect.poll(() => enregistrements.length).toBe(1);
    expect(enregistrements[0]).toMatchObject({ p_driver: 'c1', p_type: 'telephone', p_source: 'constat_interne', p_trip: 't1', p_constat: 'Téléphone en main pendant la conduite' });
  });
});
