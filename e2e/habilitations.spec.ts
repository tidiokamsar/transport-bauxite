import { expect, test, type Page } from '@playwright/test';
import { PROFIL, simulerApi } from './api-simulee';

// Habilitations des chauffeurs (D-051) avec l'API simulee : alerte
// d'expiration, exigence au dispatch, saisie d'une habilitation.

const jeu = {
  profiles: PROFIL,
  habilitations_chauffeur: [{ id: 'h1', driver_id: 'c1', type: 'visite_medicale', libelle: 'Aptitude 2025', numero: null, delivre_le: '2025-11-01', expire_le: '2026-11-01', revoque_le: null, motif_revocation: null }],
  v_habilitations_a_renouveler: [{ id: 'h1', driver_id: 'c1', type: 'visite_medicale', libelle: 'Aptitude 2025', expire_le: '2026-11-01', jours_restants: -15 }],
  habilitations_requises: [{ type: 'visite_medicale' }],
  drivers: [{ id: 'c1', name: 'Mamadou Camara' }],
};

const ouvrir = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Flotte', exact: true }).click();
  await page.getByRole('button', { name: 'Habilitations chauffeurs', exact: true }).click();
};

test.describe('Habilitations des chauffeurs', () => {
  test('alerte d\'expiration, exigence affichee, saisie d\'une habilitation', async ({ page }) => {
    await simulerApi(page, jeu);
    const envois: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/habilitations_chauffeur*', (route) => {
      if (route.request().method() === 'POST') { envois.push(route.request().postDataJSON()); return route.fulfill({ status: 201, body: '' }); }
      return route.fallback();
    });
    await ouvrir(page);
    await expect(page.getByText('Expirée depuis 15 j')).toBeVisible();
    await expect(page.getByText('Exigée').first()).toBeVisible();

    await page.getByRole('button', { name: 'Habilitation', exact: true }).click();
    const f = page.getByRole('form', { name: 'Saisie habilitation' });
    await f.getByLabel('Chauffeur *').selectOption('c1');
    await f.getByLabel('Libellé *').fill('Aptitude 2026');
    await f.getByLabel('Délivrée le *').fill('2026-11-10');
    await f.getByLabel('Expire le').fill('2027-11-10');
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect.poll(() => envois.length).toBe(1);
    expect(envois[0]).toMatchObject({ driver_id: 'c1', type: 'visite_medicale', libelle: 'Aptitude 2026', delivre_le: '2026-11-10', expire_le: '2027-11-10' });
  });
});
