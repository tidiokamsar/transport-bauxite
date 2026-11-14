import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi } from './api-simulee';

// Perimetre site (D-038, LOT 02 phase 1) avec l'API simulee : referentiel
// des organisations dans Parametres, site d'affectation du compte.

const ORGS = [
  { id: 'o1', raison_sociale: 'Kogon Mining SARL', statut: 'active' },
];
const SITES = [
  { id: 's1', name: 'Mine Nimba' },
  { id: 's2', name: 'Dépôt CBG' },
];
const UTILISATEUR = [{
  id: 'u1', role: 'driver', full_name: 'Mamadou Test', email: 'mamadou@exemple.invalid',
  status: 'active', department: 'Opérations', created_at: '2026-11-01T00:00:00Z', photo_url: null, site_id: null,
}];

const ouvrir = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
};

test.describe('Périmètre site', () => {
  test('l\'administrateur gère le référentiel des organisations', async ({ page }) => {
    await simulerApi(page, { profiles: [], organisations: ORGS, sites: SITES });
    // Le profil de session (requete filtree par id) est l'admin ; la liste
    // des utilisateurs commence par le compte edite. Enregistre APRES
    // simulerApi pour prendre precedence.
    await page.route('**/rest/v1/profiles**', (route) => {
      if (new URL(route.request().url()).searchParams.has('id')) {
        return repondre(route, PROFIL, '0-0/1');
      }
      return repondre(route, UTILISATEUR);
    });

    const envois: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/organisations*', (route) => {
      if (route.request().method() === 'POST') {
        envois.push(route.request().postDataJSON() as Record<string, unknown>);
        return route.fulfill({ status: 201, body: '' });
      }
      return route.fallback();
    });

    await ouvrir(page);
    await page.getByRole('button', { name: 'Paramètres' }).click();
    await page.getByRole('button', { name: 'Organisations' }).click();
    await expect(page.getByText('Kogon Mining SARL')).toBeVisible();
    await page.getByPlaceholder('Raison sociale de la nouvelle organisation').fill('Société partenaires SA');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect.poll(() => envois.length).toBe(1);
    expect(envois[0]).toMatchObject({ raison_sociale: 'Société partenaires SA' });
  });

  test('le site d\'affectation du compte est enregistré', async ({ page }) => {
    await simulerApi(page, { profiles: [], sites: SITES, v_droits_modules: [] });
    // Le profil de session (requete filtree par id) est l'admin ; la liste
    // des utilisateurs commence par le compte edite. Enregistre APRES
    // simulerApi pour prendre precedence.
    await page.route('**/rest/v1/profiles**', (route) => {
      if (new URL(route.request().url()).searchParams.has('id')) {
        return repondre(route, PROFIL, '0-0/1');
      }
      return repondre(route, UTILISATEUR);
    });

    const maj: Record<string, unknown> = {};
    await page.route('**/rest/v1/profiles**', (route) => {
      if (route.request().method() === 'PATCH' && new URL(route.request().url()).searchParams.get('id') === 'eq.u1') {
        Object.assign(maj, route.request().postDataJSON() as Record<string, unknown>);
        return route.fulfill({ status: 204, body: '' });
      }
      return route.fallback();
    });

    await ouvrir(page);
    await page.getByRole('button', { name: 'Paramètres' }).click();
    await page.getByRole('button', { name: 'Modifier' }).first().click();
    await expect(page.getByText('Site d\'affectation (D-038)')).toBeVisible();
    await page.getByLabel('Site d\'affectation (D-038)').selectOption({ label: 'Mine Nimba' });
    await page.getByRole('button', { name: 'Mettre à jour' }).click();
    await expect.poll(() => (maj as Record<string, unknown>).site_id).toBe('s1');
    expect(maj).toMatchObject({ site_id: 's1' });
  });
});
