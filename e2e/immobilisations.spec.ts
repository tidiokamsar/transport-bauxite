import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi } from './api-simulee';

// Immobilisations des engins loues (D-022, D-025) avec l'API simulee :
// arrets en cours, heures du mois par imputation, declaration par la
// fonction serveur, imputation a choisir (aucune valeur par defaut).

const ilYa = (heures: number) => new Date(Date.now() - heures * 3_600_000).toISOString();

const ENGINS = [
  { id: 'v1', registration: 'RC-1001', vehicle_type: 'tipper', status: 'immobilized', site_id: null },
  { id: 'v2', registration: 'RC-1002', vehicle_type: 'tipper', status: 'active', site_id: null },
  { id: 'l1', registration: 'CAT-980L-01', vehicle_type: 'loader', status: 'active', site_id: null },
];

const ouvrir = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Maintenance' }).first().click();
  await page.getByRole('button', { name: 'Immobilisations' }).first().click();
  await expect(page.getByRole('heading', { name: 'Immobilisations', exact: true })).toBeVisible();
};

test.describe('Immobilisations', () => {
  test('aucun arret : sans donnees', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL, vehicles: ENGINS });
    await ouvrir(page);
    await expect(page.getByText('Aucun engin arrêté')).toBeVisible();
    await expect(page.getByText('Aucun arrêt ce mois-ci')).toBeVisible();
  });

  test('arrets en cours et heures par imputation', async ({ page }) => {
    // Bornes dans le mois courant : arret clos de 3 h il y a peu
    const debutClos = new Date();
    debutClos.setHours(0, 30, 0, 0);
    await simulerApi(page, {
      profiles: PROFIL,
      vehicles: ENGINS,
      immobilisations: [
        { id: 'i1', vehicle_id: 'v1', debut: ilYa(0.5), fin: null, cause: 'panne', imputation: 'loueur', description: 'Fuite hydraulique', reference_loueur: 'NM-4521', statut: 'ouverte' },
        { id: 'i2', vehicle_id: 'v2', debut: debutClos.toISOString(), fin: new Date(debutClos.getTime() + 3 * 3_600_000).toISOString(), cause: 'pneumatique', imputation: 'exploitant', description: 'Crevaison', reference_loueur: null, statut: 'cloturee' },
      ],
    });
    await ouvrir(page);
    const synthese = page.getByRole('region', { name: 'Synthèse du mois' });
    await expect(synthese).toContainText('1 / 3');
    await expect(synthese).toContainText('3,0 h');
    await expect(page.getByText('Fuite hydraulique · réf. NM-4521')).toBeVisible();
    await expect(page.getByText(/restent à imputer/)).toHaveCount(0);
    await page.screenshot({ path: 'test-results/immobilisations.png', fullPage: true });
  });

  test('declaration : imputation obligatoire, envoi a declarer_immobilisation', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL, vehicles: ENGINS });
    const corps: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/declarer_immobilisation', (route) => {
      corps.push(route.request().postDataJSON());
      return repondre(route, 'nouvelle');
    });
    await ouvrir(page);
    await page.getByRole('button', { name: 'Déclarer une immobilisation' }).click();
    const fenetre = page.getByRole('dialog');
    await expect(fenetre).toContainText('maintenance à la charge du loueur, pneus et carburant à la charge de l\'exploitant');
    await fenetre.getByLabel('Engin *').selectOption({ label: 'CAT-980L-01' });
    await fenetre.getByLabel('Cause *').selectOption({ label: 'Attente de pièce' });
    await fenetre.getByLabel('Description *').fill('Vérin de godet');
    const declarer = fenetre.getByRole('button', { name: 'Déclarer' });
    await expect(declarer).toBeDisabled();
    await fenetre.getByLabel('Imputation *').selectOption({ label: 'Loueur' });
    await fenetre.getByLabel('Référence d\'intervention du loueur').fill('NM-2611-016');
    await declarer.click();
    await expect.poll(() => corps.length).toBe(1);
    expect(corps[0]).toMatchObject({ p_vehicle_id: 'l1', p_cause: 'attente_piece', p_imputation: 'loueur', p_description: 'Vérin de godet', p_reference_loueur: 'NM-2611-016' });
  });
});
