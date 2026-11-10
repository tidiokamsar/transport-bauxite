import { expect, test, type Page } from '@playwright/test';
import { ADMIN, simulerApi } from './api-simulee';

// Dossier contractuel et fiche societe (D-026, D-027) avec l'API simulee.
// Profil : charge de contrats et facturation, droits lus dans la matrice.

const CHARGE = [{ id: ADMIN, role: 'contract_manager', full_name: 'Abdoulaye Test', status: 'active', site_id: null }];
const DROITS = ['dashboard', 'contracts', 'invoices', 'settings', 'trips'].map((module) => ({
  role: 'contract_manager', module, can_view: true, can_create: module !== 'dashboard', can_edit: module !== 'dashboard', can_delete: module === 'contracts', can_approve: false,
}));

const CONTRAT = {
  id: 'c1', reference: 'CBG-2026-01', intitule: 'Transport de bauxite mine - stock', nature: 'client', contrepartie: 'CBG',
  devise: 'USD', date_debut: '2026-01-01', date_fin: null, statut: 'actif', delai_paiement_jours: 30, description: null,
};
const VERSIONS = [
  { id: 'v0', contrat_id: 'c1', numero: 0, intitule: 'Contrat initial', date_effet: '2026-01-01', date_signature: '2025-12-15', resume: null, document_ref: 'CT-001' },
  { id: 'v1', contrat_id: 'c1', numero: 1, intitule: 'Révision des engagements', date_effet: '2026-06-01', date_signature: null, resume: 'Disponibilité portée à 85 %', document_ref: null },
];

const ouvrir = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Contrats & Finance' }).click();
  await page.getByRole('button', { name: 'Dossier contractuel' }).click();
  await expect(page.getByRole('heading', { name: 'Dossier contractuel', exact: true })).toBeVisible();
};

test.describe('Dossier contractuel', () => {
  test('profil charge de contrats : libelle du role, aucun contrat', async ({ page }) => {
    await simulerApi(page, { profiles: CHARGE, role_permissions: DROITS });
    await ouvrir(page);
    await expect(page.getByText('Aucun contrat')).toBeVisible();
    await page.getByRole('button', { name: 'Menu utilisateur' }).click();
    await expect(page.getByText('Chargé de contrats et facturation')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Nouveau contrat' })).toBeVisible();
  });

  test('contrat, version en vigueur, tarifs et engagements', async ({ page }) => {
    await simulerApi(page, {
      profiles: CHARGE,
      role_permissions: DROITS,
      contrats: [CONTRAT],
      contrat_versions: VERSIONS,
      contrat_tarifs: [{ id: 't1', version_id: 'v1', libelle: 'Transport mine - stock', unite: 'tonne', prix: 4.75, categorie_materiel: null, conditions: null, ordre: 0 }],
      contrat_engagements: [{ id: 'e1', version_id: 'v1', indicateur: 'disponibilite', libelle: 'Disponibilité mécanique', seuil: 85, unite: '%', sens: 'minimum', periodicite: 'mois', consequence: 'Pénalité de 2 % par point manquant', ordre: 0 }],
    });
    await ouvrir(page);
    await expect(page.getByText('Version en vigueur : Avenant n° 1 · Révision des engagements')).toBeVisible();
    const avenant = page.getByRole('region', { name: 'Avenant n° 1 · Révision des engagements' });
    await expect(avenant).toContainText('4,75 USD par tonne');
    await expect(avenant).toContainText('≥ 85,00 % par mois');
    await expect(avenant).toContainText('Pénalité de 2 % par point manquant');
    await page.screenshot({ path: 'test-results/contrats.png', fullPage: true });
  });

  test('creation : devise ISO exigee, saisie envoyee telle quelle', async ({ page }) => {
    await simulerApi(page, { profiles: CHARGE, role_permissions: DROITS });
    const corps: unknown[] = [];
    await page.route('**/rest/v1/contrats*', (route) => {
      if (route.request().method() === 'POST') {
        corps.push(route.request().postDataJSON());
        return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
      }
      return route.fallback();
    });
    await ouvrir(page);
    await page.getByRole('button', { name: 'Nouveau contrat' }).click();
    const f = page.getByRole('dialog');
    await f.getByLabel('Référence *').fill('NEEMBA-2026-01');
    await f.getByLabel('Contrepartie *').fill('Neemba');
    await f.getByLabel('Intitulé *').fill('Location d\'engins à l\'heure');
    await f.getByLabel('Nature *').selectOption({ label: 'Location (nous sommes facturés)' });
    await f.getByLabel('Début *').fill('2026-01-01');
    const enregistrer = f.getByRole('button', { name: 'Enregistrer' });
    await expect(enregistrer).toBeDisabled();
    await f.getByLabel('Devise (code ISO) *').fill('usd');
    await enregistrer.click();
    await expect.poll(() => corps.length).toBe(1);
    expect(corps[0]).toMatchObject({ reference: 'NEEMBA-2026-01', nature: 'location', contrepartie: 'Neemba', devise: 'USD', statut: 'brouillon', delai_paiement_jours: null });
  });
});
