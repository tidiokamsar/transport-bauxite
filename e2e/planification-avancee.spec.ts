import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi, SITE_DEPOT, SITE_MINE } from './api-simulee';

// Planification avancee (D-063) avec l'API simulee : ventilation par
// destination et contrat, simulation et scenario de rattrapage (revision
// par definir_objectif), cloture de planification et rapport de
// production, comparaison des shifts.

const SHIFT_JOUR = '00000000-0000-4000-a000-0000000000d1';
const CONTRAT = '00000000-0000-4000-a000-0000000000c1';
const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const objectif = (extra: Record<string, unknown> = {}) => ({
  id: 'o1', date_plan: aujourdhui(), site_id: SITE_MINE, shift_id: SHIFT_JOUR, version: 1, tonnes_cible: 1000, voyages_cible: null,
  camions_prevus: 3, chargeuses_prevues: 1, motif: null, note: null, cree_le: new Date().toISOString(), tonnes_cible_initial: 1000,
  tonnes_livrees: 200, tonnes_acceptees: 0, voyages_livres: 5, voyages_sans_poids: 0, voyages_en_cours: 2, voyages_prevus: 10,
  derniere_livraison: new Date().toISOString(), ...extra,
});

const REFERENTIEL = {
  profiles: PROFIL,
  sites: [
    { id: SITE_MINE, name: 'Mine Nimba', type: 'mine' },
    { id: SITE_DEPOT, name: 'Dépôt CBG', type: 'depot' },
  ],
  work_shifts: [{ id: SHIFT_JOUR, name: 'jour', display_name: 'Jour', start_time: '00:00:00', end_time: '23:59:00', shift_order: 1 }],
  contrats: [{ id: CONTRAT, reference: 'CT-CBG-01', intitule: 'Transport bauxite' }],
  v_realisation_objectifs: [objectif()],
};

const l = (rang: number, groupe: string, code: string, libelle: string, valeur: number | null, unite: string | null, source: string, remarque: string | null = null) =>
  ({ rang, groupe, code, libelle, valeur, unite, source, remarque });
const SIMULATION = [
  l(2, 'Hypothèses', 'charge_par_voyage', 'Charge par voyage', 40, 't', 'observée : 24 voyages livrés avec tonnage sur 4 jours'),
  l(4, 'Hypothèses', 'duree_rotation', 'Durée de rotation (médiane)', 120, 'min', 'intervalle entre deux départs successifs, 16 mesure(s)'),
  l(5, 'Hypothèses', 'duree_chargement', 'Durée de chargement (médiane)', null, 'min', 'journal des voyages, 2 mesure(s)', 'Données insuffisantes : il faut 10 mesures'),
  l(13, 'Situation', 'tonnes_restantes', 'Tonnes restantes', 800, 't', 'objectif - livré'),
  l(21, 'Besoin', 'camions_necessaires', 'Camions nécessaires', 7, 'camions', 'voyages restants / rotations possibles par camion'),
  l(23, 'Besoin', 'engins_necessaires', 'Engins de chargement nécessaires', null, 'engins', 'voyages restants x durée de chargement', 'Données insuffisantes'),
  l(30, 'Scénario', 'tonnes_atteignables', 'Tonnage atteignable en fin de période', 560, 't', 'livré + moyens disponibles', 'limité par : camions disponibles'),
  l(31, 'Scénario', 'objectif_propose', 'Objectif révisé proposé', 560, 't', 'tonnage atteignable'),
  l(32, 'Scénario', 'renfort_camions', 'Renfort de camions', 4, 'camions', 'écart camions'),
  l(33, 'Scénario', 'renfort_engins', 'Renfort d\'engins', null, 'engins', 'écart engins', 'Données insuffisantes'),
];

const ouvrir = async (page: Page, onglet?: string) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Planification' }).first().click();
  await expect(page.getByRole('heading', { name: 'Planification', exact: true })).toBeVisible();
  if (onglet) await page.getByRole('tab', { name: onglet }).click();
};

test.describe('Planification avancée', () => {
  test('ventilation : realise par destination, contrat seul non mesurable', async ({ page }) => {
    await simulerApi(page, {
      ...REFERENTIEL,
      v_realisation_ventilation: [
        { id: 'v1', objectif_id: 'o1', destination_id: SITE_DEPOT, contrat_id: CONTRAT, contrat_reference: 'CT-CBG-01', tonnes_cible: 600, voyages_cible: null,
          mesurable: true, realise_partage: false, tonnes_livrees: 160, voyages_livres: 4, voyages_sans_poids: 0 },
        { id: 'v2', objectif_id: 'o1', destination_id: null, contrat_id: CONTRAT, contrat_reference: 'CT-CBG-01', tonnes_cible: 300, voyages_cible: null,
          mesurable: false, realise_partage: false, tonnes_livrees: null, voyages_livres: null, voyages_sans_poids: null },
      ],
    });
    await ouvrir(page);
    const bloc = page.getByRole('region', { name: 'Ventilation de l\'objectif' });
    await expect(bloc).toContainText('Dépôt CBG');
    await expect(bloc).toContainText('160 t');
    await expect(bloc).toContainText('Non mesurable');
    await expect(bloc).toContainText('100 t non ventilées');
    await expect(bloc.getByRole('button', { name: 'Ventiler' })).toHaveCount(0);
  });

  test('ventiler un objectif envoie les lignes a ventiler_objectif', async ({ page }) => {
    await simulerApi(page, REFERENTIEL);
    let corps: Record<string, unknown> | null = null;
    await page.route('**/rest/v1/rpc/ventiler_objectif', (route) => { corps = route.request().postDataJSON(); return repondre(route, 1); });
    await ouvrir(page);
    await page.getByRole('button', { name: 'Ventiler' }).click();
    const fenetre = page.getByRole('dialog');
    await fenetre.getByLabel('Destination 1').selectOption({ label: 'Dépôt CBG' });
    await fenetre.getByLabel('Contrat 1').selectOption({ label: 'CT-CBG-01 · Transport bauxite' });
    await fenetre.getByLabel('Tonnes 1').fill('1200');
    await fenetre.getByRole('button', { name: 'Enregistrer la ventilation' }).click();
    await expect(fenetre).toContainText('dépasse l\'objectif');
    await fenetre.getByLabel('Tonnes 1').fill('600');
    await fenetre.getByRole('button', { name: 'Enregistrer la ventilation' }).click();
    await expect.poll(() => corps).not.toBeNull();
    expect(corps).toEqual({ p_objectif_id: 'o1', p_lignes: [{ destination_id: SITE_DEPOT, contrat_id: CONTRAT, tonnes: 600 }] });
  });

  test('simulation : hypotheses sourcees, donnees insuffisantes, scenario retenu par definir_objectif', async ({ page }) => {
    await simulerApi(page, REFERENTIEL);
    await page.route('**/rest/v1/rpc/simuler_objectif', (route) => repondre(route, SIMULATION));
    let corps: Record<string, unknown> | null = null;
    await page.route('**/rest/v1/rpc/definir_objectif', (route) => { corps = route.request().postDataJSON(); return repondre(route, 'o2'); });
    await ouvrir(page, 'Simulation et rattrapage');
    const hypotheses = page.getByRole('region', { name: 'Simulation : Hypothèses' });
    await expect(hypotheses).toContainText('observée : 24 voyages livrés');
    await expect(hypotheses).toContainText('Données insuffisantes');
    await expect(page.getByRole('region', { name: 'Simulation : Besoin' })).toContainText('7 camions');
    await expect(page.getByRole('region', { name: 'Simulation : Scénario' })).toContainText('limité par : camions disponibles');
    await expect(page.getByText('Réviser l\'objectif à 560 t')).toBeVisible();
    await expect(page.getByText(/Tenir 1\s000 t avec un renfort de 4 camion\(s\)/)).toBeVisible();
    await page.screenshot({ path: 'test-results/planification-simulation.png', fullPage: true });

    await page.getByRole('button', { name: 'Retenir ce scénario' }).first().click();
    const fenetre = page.getByRole('dialog');
    await expect(fenetre).toContainText('Scénario retenu');
    await expect(fenetre.getByLabel('Objectif (tonnes) *')).toHaveValue('560');
    await fenetre.getByLabel(/Motif de la révision/).fill('Deux camions en panne, rattrapage impossible');
    await fenetre.getByRole('button', { name: 'Enregistrer la révision' }).click();
    await expect.poll(() => corps).not.toBeNull();
    expect(corps).toMatchObject({ p_site_id: SITE_MINE, p_shift_id: SHIFT_JOUR, p_tonnes: 560, p_motif: 'Deux camions en panne, rattrapage impossible' });
  });

  test('cloture : cause exigee sous l\'objectif, envoi a cloturer_planification, rapport', async ({ page }) => {
    await simulerApi(page, REFERENTIEL);
    await page.route('**/rest/v1/rpc/production_journee', (route) => repondre(route, [{
      tonnes_cible: 1000, tonnes_livrees: 200, voyages_livres: 5, voyages_sans_poids: 0, tonnes_livrees_site: 230, voyages_non_termines: 0,
      perimetre: 'somme des objectifs de shift ; réalisé : voyages des shifts planifiés',
    }]));
    await page.route('**/rest/v1/rpc/rapport_production', (route) => repondre(route, [{
      date_plan: aujourdhui(), site_id: SITE_MINE, site: 'Mine Nimba', statut: 'non_close', tonnes_cible: 1000, tonnes_livrees: 200, ecart: -800,
      realisation_pct: 20, voyages_livres: 5, voyages_sans_poids: 0, causes: null, cloture_le: null, source: 'non clos, calculé à la lecture',
    }]));
    let corps: Record<string, unknown> | null = null;
    await page.route('**/rest/v1/rpc/cloturer_planification', (route) => { corps = route.request().postDataJSON(); return repondre(route, 'c1'); });
    await ouvrir(page, 'Clôture et rapport');
    await page.getByLabel('Site à clôturer').selectOption({ label: 'Mine Nimba' });
    await expect(page.getByText('-800 t').first()).toBeVisible();
    await page.getByRole('button', { name: 'Clôturer la journée' }).click();
    await expect(page.getByText(/au moins une cause d'écart/)).toBeVisible();
    await page.getByRole('button', { name: 'Ajouter une cause' }).click();
    await page.getByLabel('Catégorie de la cause 1').selectOption({ label: 'Panne de camion' });
    await page.getByLabel('Description de la cause 1').fill('Deux camions en panne');
    await page.getByLabel('Tonnes perdues 1').fill('300');
    await page.getByRole('button', { name: 'Clôturer la journée' }).click();
    await expect.poll(() => corps).not.toBeNull();
    expect(corps).toMatchObject({ p_site_id: SITE_MINE, p_causes: [{ categorie: 'panne_camion', description: 'Deux camions en panne', tonnes: 300 }] });
    await expect(page.locator('#rapport-production')).toContainText('Non clos');
    await expect(page.locator('#rapport-production')).toContainText('20 %');
  });

  test('comparaison des shifts : mesures, sans shift a part, historique des equipes', async ({ page }) => {
    await simulerApi(page, {
      ...REFERENTIEL,
      postes: [{ id: 'p1', date_poste: aujourdhui(), shift_id: SHIFT_JOUR, site_id: SITE_MINE, statut: 'cloture', responsable_id: PROFIL[0].id,
        postes_equipe: [{ present: true }, { present: false }] }],
    });
    const base = { jours: 4, voyages: 29, voyages_sans_poids: 0, trajets_mesures: 24, tonnes_cible: null, tonnes_livrees_objectif: null, realisation_pct: null,
      postes: 0, postes_clos: 0, incidents: null, arrets: null, retards: null, presences: null, absences: null, retard_minutes: null };
    await page.route('**/rest/v1/rpc/comparer_shifts', (route) => repondre(route, [
      { ...base, shift_id: SHIFT_JOUR, shift: 'Jour', voyages_livres: 29, tonnes_livrees: 1160, tonnes_par_voyage: 40, rotations_mesurees: 16,
        duree_rotation_min: 120, duree_trajet_min: 50, postes: 1, postes_clos: 1, incidents: 1, arrets: 1, retards: 0, presences: 1, absences: 1, retard_minutes: 15 },
      { ...base, shift_id: null, shift: 'Sans shift', jours: 1, voyages: 1, voyages_livres: 1, tonnes_livrees: 30, tonnes_par_voyage: 30,
        rotations_mesurees: 0, duree_rotation_min: null, trajets_mesures: 0, duree_trajet_min: null },
    ]));
    await ouvrir(page, 'Comparaison des shifts');
    const tableau = page.getByRole('table', { name: 'Comparaison des shifts' });
    await expect(tableau).toContainText('120 min');
    await expect(tableau).toContainText('290 t');
    await expect(tableau).toContainText('50 % de l\'équipe');
    await expect(tableau.getByRole('row', { name: /Sans shift/ })).toContainText('—');
    await expect(page.getByText('Aminata Test')).toBeVisible();
    await expect(page.getByRole('row', { name: /Aminata Test/ })).toContainText('1 / 1');
  });
});
