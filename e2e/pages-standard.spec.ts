import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi } from './api-simulee';

// Pages standard (D-090) avec l'API simulee, pilote sur Sites, Vehicules et
// Chauffeurs : navigation par adresse (lien partageable, bouton retour,
// filtres conserves), liste (recherche, filtre, tri, export), fiche a
// onglets (relations, historique, pieces jointes), formulaire en pleine page
// (annulation confirmee) et actions metier en pleine page.

const SITES = [
  { id: 's1', name: 'Mine Nimba', type: 'mine', organisation_id: null, address: 'Zone nord', city: 'Lola', country: 'Guinée', latitude: null, longitude: null,
    contact_name: null, contact_phone: null, contact_email: null, capacity: 12000, is_active: true, responsable_id: null, notes: null },
  { id: 's2', name: 'Port de Kamsar', type: 'port', organisation_id: null, address: 'Quai 2', city: 'Kamsar', country: 'Guinée', latitude: null, longitude: null,
    contact_name: null, contact_phone: null, contact_email: null, capacity: null, is_active: false, responsable_id: null, notes: null },
];
const VEHICULE = {
  id: 'v1', registration: 'CAM-01', brand_model: 'Sinotruk Howo', year: 2022, vehicle_type: 'tipper', capacity_tonnes: 40, chassis_number: null, site_id: 's1',
  status: 'active', insurance_expiry: null, technical_inspection_expiry: null, propriete: 'loue', proprietaire: 'Neemba', exploitant: null, transporteur: null,
  contrat_id: null, contrat_reference: null, statut_admin: 'suspendu', statut_admin_depuis: '2026-11-14T08:00:00Z', statut_admin_motif: 'Visite technique expirée',
  voyage_en_cours: null, statut_operationnel: 'suspendu',
};
const CHAUFFEUR = {
  id: 'd1', name: 'Alpha Diallo', employee_id: 'MAT-009', phone: null, email: null, hire_date: '2024-01-01', birth_date: null, license_number: 'PC-9',
  license_category: 'C', license_expiry: '2030-01-01', health_certificate_expiry: null, address: null, emergency_contact_name: null,
  emergency_contact_phone: null, contract_type: 'permanent', base_salary: null, status: 'terminated', notes: null, site_id: 's1', created_at: '2026-11-01T08:00:00Z',
};

const JEU = {
  profiles: PROFIL,
  sites: SITES,
  vehicles: [{ id: 'v1', registration: 'CAM-01', vehicle_type: 'tipper', status: 'active' }],
  drivers: [CHAUFFEUR],
  trips: [],
  affectations_sites: [],
  journal_affectations_sites: [],
  v_vehicules: [VEHICULE],
  v_fiche_vehicule: [],
  journal_flotte: [{ id: 'j1', vehicle_id: 'v1', action: 'suspension', motif: 'Visite technique expirée', le: '2026-11-14T08:00:00Z', auteur: null, apres: {} }],
  immobilisations: [],
  fuel_transactions: [],
  controles_depart: [],
  vehicle_documents: [],
  habilitations_chauffeur: [],
  infractions_chauffeur: [],
  sanctions_infraction: [],
};

const ouvrir = async (page: Page, adresse = '/') => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto(adresse);
};

test.describe('Pages standard (D-090)', () => {
  test('sites : filtres dans l\'adresse, fiche a onglets, retour du navigateur, lien partageable', async ({ page }) => {
    await simulerApi(page, JEU);
    await ouvrir(page);
    const entree = page.getByRole('button', { name: 'Sites', exact: true });
    await expect(page.getByRole('button', { name: 'Exploitation', exact: true })).toBeVisible();
    if (!(await entree.isVisible())) await page.getByRole('button', { name: 'Exploitation', exact: true }).click();
    await entree.click();
    await expect(page).toHaveURL(/#\/sites$/);

    // Filtre et recherche portes par l'adresse.
    await page.getByLabel('Filtrer : Statut').selectOption('actif');
    await expect(page).toHaveURL(/f\.statut=actif/);
    await expect(page.getByRole('button', { name: 'Fiche Port de Kamsar' })).toHaveCount(0);
    await page.getByPlaceholder('Rechercher un site...').fill('nimba');
    await expect(page).toHaveURL(/q=nimba/);

    // Clic sur la ligne -> fiche.
    await page.getByRole('row').filter({ hasText: 'Mine Nimba' }).getByRole('cell').nth(2).click();
    await expect(page).toHaveURL(/#\/sites\/s1$/);
    const fiche = page.getByRole('article', { name: 'Fiche Mine Nimba' });
    await expect(fiche.getByRole('navigation', { name: 'Fil d\'Ariane' })).toContainText('Sites');
    await expect(fiche.getByText('12 000 t')).toBeVisible();
    await expect(fiche.getByRole('link', { name: 'Désactiver' })).toBeVisible();
    await expect(fiche.getByRole('link', { name: 'Réactiver' })).toHaveCount(0);

    await fiche.getByRole('tab', { name: 'Relations' }).click();
    await expect(page).toHaveURL(/onglet=relations/);
    await expect(fiche.getByRole('region', { name: 'Engins affectés' }).getByRole('link', { name: 'CAM-01' })).toHaveAttribute('href', '#/vehicles/v1');
    await expect(fiche.getByRole('region', { name: 'Chauffeurs affectés' })).toContainText('Alpha Diallo');
    await fiche.getByRole('tab', { name: 'Historique' }).click();
    await expect(fiche.getByText('ne sont pas journalisées')).toBeVisible();
    await expect(fiche.getByText('Aucun événement enregistré')).toBeVisible();
    await fiche.getByRole('tab', { name: 'Pièces jointes' }).click();
    await expect(fiche.getByText('Pièces jointes non prises en charge pour un site')).toBeVisible();

    // Retour a la liste : filtres conserves (lien et bouton retour du navigateur).
    await fiche.getByRole('button', { name: 'Retour à la liste' }).click();
    await expect(page).toHaveURL(/#\/sites\?.*q=nimba/);
    await expect(page.getByPlaceholder('Rechercher un site...')).toHaveValue('nimba');
    await page.goBack();
    await expect(page).toHaveURL(/#\/sites\/s1/);
    await page.goBack();
    await expect(page.getByLabel('Filtrer : Statut')).toHaveValue('actif');

    // Lien partageable : la fiche s'ouvre directement ; identifiant inconnu signale.
    await page.goto('/#/sites/s2');
    await expect(page.getByRole('article', { name: 'Fiche Port de Kamsar' }).getByRole('link', { name: 'Réactiver' })).toBeVisible();
    await page.goto('/#/sites/inconnu');
    await expect(page.getByText('Fiche introuvable')).toBeVisible();
  });

  test('sites : modification en pleine page, annulation confirmee si la saisie a change ; desactivation', async ({ page }) => {
    await simulerApi(page, JEU);
    await page.route('**/rest/v1/rpc/comptes_selectionnables', (route) => repondre(route, []));
    const ecritures: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/sites*', (route) => {
      if (route.request().method() === 'PATCH') { ecritures.push(route.request().postDataJSON()); return route.fulfill({ status: 204, body: '' }); }
      return route.fallback();
    });
    await ouvrir(page, '/#/sites/s1/modifier');
    const f = page.getByRole('form', { name: 'Modifier le site' });
    await expect(f.getByLabel('Ville *')).toHaveValue('Lola');
    await f.getByLabel('Ville *').fill('');
    await f.getByRole('button', { name: 'Mettre à jour' }).click();
    await expect(f.getByRole('alert')).toContainText('Ville requise.');
    expect(ecritures).toHaveLength(0);

    // Annulation refusee puis acceptee : retour a la fiche, rien d'envoye.
    page.once('dialog', (d) => { expect(d.message()).toContain('Abandonner les modifications'); void d.dismiss(); });
    await f.getByRole('button', { name: 'Annuler' }).click();
    await expect(page).toHaveURL(/#\/sites\/s1\/modifier$/);
    page.once('dialog', (d) => void d.accept());
    await f.getByRole('button', { name: 'Annuler' }).click();
    await expect(page).toHaveURL(/#\/sites\/s1$/);
    expect(ecritures).toHaveLength(0);

    // Desactivation en pleine page : retour a la fiche avec confirmation.
    await page.getByRole('link', { name: 'Désactiver' }).click();
    await expect(page).toHaveURL(/#\/sites\/s1\/desactiver$/);
    await page.getByRole('form', { name: 'Désactiver le site Mine Nimba' }).getByRole('button', { name: 'Désactiver' }).click();
    await expect.poll(() => ecritures.length).toBe(1);
    expect(ecritures[0]).toEqual({ is_active: false });
    await expect(page).toHaveURL(/#\/sites\/s1$/);
    await expect(page.getByRole('status').filter({ hasText: 'Site désactivé.' })).toBeVisible();
  });

  test('vehicules : tri, export CSV, historique du journal de la flotte, remise en service motivee', async ({ page }) => {
    await simulerApi(page, { ...JEU, v_vehicules: [VEHICULE, { ...VEHICULE, id: 'v2', registration: 'AAA-02', statut_operationnel: 'disponible', statut_admin: null, statut_admin_motif: null }] });
    const appels: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/remettre_en_service_vehicule', (route) => { appels.push(route.request().postDataJSON()); return repondre(route, null); });
    await ouvrir(page, '/#/vehicles');
    const lignes = page.getByRole('table').getByRole('row');
    await expect(lignes.nth(1)).toContainText('CAM-01');
    await page.getByRole('button', { name: 'Immatriculation' }).click();
    await expect(page).toHaveURL(/tri=immatriculation/);
    await expect(lignes.nth(1)).toContainText('AAA-02');
    const telechargement = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exporter CSV' }).click();
    expect((await telechargement).suggestedFilename()).toMatch(/^vehicules/);

    await page.getByRole('button', { name: 'Fiche CAM-01' }).click();
    const fiche = page.getByRole('article', { name: 'Fiche CAM-01' });
    await expect(fiche.getByRole('link', { name: 'Suspendre' })).toHaveCount(0);
    await fiche.getByRole('tab', { name: 'Historique' }).click();
    await expect(fiche.getByRole('region', { name: 'Historique' })).toContainText('Suspension');
    await expect(fiche.getByRole('region', { name: 'Historique' })).toContainText('Motif : Visite technique expirée');

    await fiche.getByRole('link', { name: 'Remettre en service' }).click();
    const action = page.getByRole('form', { name: 'Remettre en service CAM-01' });
    await action.getByLabel('Motif *').fill('Visite technique refaite');
    await action.getByRole('button', { name: 'Remettre en service' }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toEqual({ p_vehicle: 'v1', p_motif: 'Visite technique refaite' });
  });

  test('chauffeurs : fiche archivee, reactivation en pleine page, action impossible signalee', async ({ page }) => {
    await simulerApi(page, JEU);
    const ecritures: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/drivers*', (route) => {
      if (route.request().method() === 'PATCH') { ecritures.push(route.request().postDataJSON()); return route.fulfill({ status: 204, body: '' }); }
      return route.fallback();
    });
    await ouvrir(page, '/#/drivers/d1');
    const fiche = page.getByRole('article', { name: 'Fiche Alpha Diallo' });
    await expect(fiche.getByRole('heading', { level: 1 })).toContainText('Archivé');
    await expect(fiche.getByRole('link', { name: 'Archiver le dossier' })).toHaveCount(0);
    await fiche.getByRole('tab', { name: 'Historique' }).click();
    await expect(fiche.getByRole('region', { name: 'Historique' })).toContainText('Dossier créé');

    // Une action non permise par l'etat ouverte par son adresse est refusee sans ecriture.
    await page.goto('/#/drivers/d1/archiver');
    await expect(page.getByText('Action impossible', { exact: true })).toBeVisible();
    await page.goto('/#/drivers/d1');
    await page.getByRole('link', { name: 'Réactiver' }).click();
    await page.getByRole('button', { name: 'Réactiver' }).click();
    await expect.poll(() => ecritures.length).toBe(1);
    expect(ecritures[0]).toMatchObject({ status: 'active' });
  });
});
