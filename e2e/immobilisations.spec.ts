import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi } from './api-simulee';

// Immobilisations des engins loues (D-022, D-025) avec l'API simulee, aux
// pages standard (D-090) : liste du mois et synthese par imputation,
// declaration en pleine page (imputation a choisir, aucune valeur par
// defaut), fiche et annulation motivee en page d'action, cloture refusee
// quand une intervention du loueur est en cours.

const ilYa = (heures: number) => new Date(Date.now() - heures * 3_600_000).toISOString();

const ENGINS = [
  { id: 'v1', registration: 'RC-1001', vehicle_type: 'tipper', status: 'immobilized', site_id: null },
  { id: 'v2', registration: 'RC-1002', vehicle_type: 'tipper', status: 'active', site_id: null },
  { id: 'l1', registration: 'CAT-980L-01', vehicle_type: 'loader', status: 'active', site_id: null },
];
const OUVERTE = { id: 'i1', vehicle_id: 'v1', debut: ilYa(0.5), fin: null, cause: 'panne', imputation: 'loueur', description: 'Fuite hydraulique', reference_loueur: 'NM-4521', statut: 'ouverte', declare_le: ilYa(0.4), declare_par: null, cloture_le: null, cloture_par: null };

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
    await expect(page.getByRole('region', { name: 'Synthèse du mois' })).toContainText('0 / 3');
    await expect(page.getByText('Aucun arrêt ce mois-ci')).toBeVisible();
  });

  test('arrets du mois, heures par imputation, fiche et annulation motivee', async ({ page }) => {
    const debutClos = new Date();
    debutClos.setHours(0, 30, 0, 0);
    await simulerApi(page, {
      profiles: PROFIL,
      vehicles: ENGINS,
      immobilisations: [
        OUVERTE,
        { id: 'i2', vehicle_id: 'v2', debut: debutClos.toISOString(), fin: new Date(debutClos.getTime() + 3 * 3_600_000).toISOString(), cause: 'pneumatique', imputation: 'exploitant', description: 'Crevaison', reference_loueur: null, statut: 'cloturee' },
      ],
      immobilisations_journal: [{ id: 'j1', immobilisation_id: 'i1', action: 'declaration', motif: null, auteur: null, le: ilYa(0.4) }],
      v_interventions_loueur: [],
    });
    const appels: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/annuler_immobilisation', (route) => { appels.push(route.request().postDataJSON()); return repondre(route, null); });
    await ouvrir(page);
    const synthese = page.getByRole('region', { name: 'Synthèse du mois' });
    await expect(synthese).toContainText('1 / 3');
    await expect(synthese).toContainText('3,0 h');
    await expect(page.getByText('Fuite hydraulique · réf. NM-4521')).toBeVisible();
    await expect(page.getByText(/restent à imputer/)).toHaveCount(0);
    await page.screenshot({ path: 'test-results/immobilisations.png', fullPage: true });

    await page.getByRole('button', { name: /^Fiche RC-1001 du/ }).click();
    await expect(page).toHaveURL(/#\/immobilisations\/i1$/);
    const fiche = page.getByRole('article', { name: /^Fiche RC-1001 · Panne/ });
    await expect(fiche.getByRole('link', { name: 'Remettre en service' })).toBeVisible();
    await expect(fiche.getByRole('link', { name: 'Demander l\'intervention du loueur' })).toBeVisible();
    await fiche.getByRole('tab', { name: 'Historique' }).click();
    await expect(fiche.getByText('Immobilisation déclarée')).toBeVisible();

    await fiche.getByRole('link', { name: 'Annuler', exact: true }).click();
    const form = page.getByRole('form', { name: 'Annuler l\'immobilisation' });
    const confirmer = form.getByRole('button', { name: 'Annuler l\'immobilisation' });
    await expect(confirmer).toBeDisabled();
    await form.getByLabel('Motif *').fill('Saisie en double');
    await confirmer.click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ p_id: 'i1', p_motif: 'Saisie en double' });
    await expect(page.getByRole('status').filter({ hasText: 'Immobilisation annulée' })).toBeVisible();
  });

  test('declaration en pleine page : imputation obligatoire, envoi a declarer_immobilisation', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL, vehicles: ENGINS });
    const corps: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/declarer_immobilisation', (route) => {
      corps.push(route.request().postDataJSON());
      return repondre(route, 'nouvelle');
    });
    await ouvrir(page);
    await page.getByRole('link', { name: 'Déclarer une immobilisation' }).click();
    const f = page.getByRole('form', { name: 'Déclarer une immobilisation' });
    await expect(f).toContainText('maintenance à la charge du loueur, pneus et carburant à la charge de l\'exploitant');
    await f.getByLabel('Engin *').selectOption({ label: 'CAT-980L-01' });
    await f.getByLabel('Cause *').selectOption({ label: 'Attente de pièce' });
    await f.getByLabel('Description *').fill('Vérin de godet');
    await f.getByRole('button', { name: 'Déclarer' }).click();
    await expect(page.getByRole('alert')).toContainText('Imputation requise');
    expect(corps).toHaveLength(0);
    await f.getByLabel('Imputation *').selectOption({ label: 'Loueur' });
    await f.getByLabel('Référence d\'intervention du loueur').fill('NM-2611-016');
    await f.getByRole('button', { name: 'Déclarer' }).click();
    await expect.poll(() => corps.length).toBe(1);
    expect(corps[0]).toMatchObject({ p_vehicle_id: 'l1', p_cause: 'attente_piece', p_imputation: 'loueur', p_description: 'Vérin de godet', p_reference_loueur: 'NM-2611-016' });
    await expect(page).toHaveURL(/#\/immobilisations\/nouvelle$/);
  });

  test('cloture refusee par son adresse quand une intervention du loueur est en cours', async ({ page }) => {
    await simulerApi(page, {
      profiles: PROFIL, vehicles: ENGINS, immobilisations: [OUVERTE],
      v_interventions_loueur: [{ id: 'x1', immobilisation_id: 'i1', statut: 'prise_en_charge' }],
    });
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto('/#/immobilisations/i1/cloturer');
    await expect(page.getByText('Action impossible')).toBeVisible();
    await expect(page.getByText(/se clôture par la validation de la remise en service/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clôturer' })).toHaveCount(0);
  });
});
