import { expect, test, type Page } from '@playwright/test';
import { ADMIN, PROFIL, repondre, simulerApi } from './api-simulee';

// Droits d'acces aux modules par utilisateur (D-036) avec l'API simulee :
// l'attribution specifique prime sur la matrice du role (menu), et
// l'administrateur choisit les droits module par module dans Parametres.

const CHARGE = [{ id: ADMIN, role: 'contract_manager', full_name: 'Awa Test', status: 'active', site_id: null }];

const droits = (modules: string[]) => modules.map((module) => ({
  role: 'contract_manager', module, can_view: true,
  can_create: module === 'contracts', can_edit: module === 'contracts',
  can_delete: false, can_approve: false,
}));

const ouvrir = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
};

test.describe('Droits par utilisateur', () => {
  test('retrait : un module du role masque par l\'attribution « aucun »', async ({ page }) => {
    await simulerApi(page, {
      profiles: CHARGE,
      role_permissions: droits(['dashboard', 'contracts', 'trips', 'settings']),
      droits_utilisateur: [{ module: 'trips', niveau: 'aucun', utilisateur: ADMIN }],
    });
    await ouvrir(page);
    await expect(page.getByRole('button', { name: 'Voyages & Rotations' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Paramètres' })).toBeVisible();
  });

  test('attribution : un module absent du role affiche en lecture', async ({ page }) => {
    await simulerApi(page, {
      profiles: CHARGE,
      role_permissions: droits(['dashboard', 'contracts', 'settings']),
      droits_utilisateur: [{ module: 'trips', niveau: 'lecture', utilisateur: ADMIN }],
    });
    await ouvrir(page);
    await expect(page.getByRole('button', { name: 'Voyages & Rotations' })).toBeVisible();
  });

  test('l\'administrateur choisit les droits module par module', async ({ page }) => {
    const UTILISATEUR = [{
      id: 'u1', role: 'driver', full_name: 'Mamadou Test', email: 'mamadou@exemple.invalid',
      status: 'active', department: 'Opérations', created_at: '2026-11-01T00:00:00Z', photo_url: null,
    }];
    await simulerApi(page, {
      profiles: [],
      role_permissions: [{
        role: 'admin', module: 'settings', can_view: true, can_create: true, can_edit: true,
        can_delete: true, can_approve: true,
      }],
      v_droits_modules: [
        { utilisateur: 'u1', module: 'fuel', role_lecture: false, role_ecriture: false, niveau_attribue: 'ecriture' },
        { utilisateur: 'u1', module: 'trips', role_lecture: true, role_ecriture: false, niveau_attribue: null },
      ],
    });
    // Le profil de session (requete par id) est l'admin ; la liste des
    // utilisateurs commence par le compte edite. Enregistre APRES
    // simulerApi pour prendre precedence.
    await page.route('**/rest/v1/profiles**', (route) => {
      const objet = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object');
      if (objet) return repondre(route, PROFIL[0], '0-0/1');
      return repondre(route, UTILISATEUR);
    });

    const appels: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/definir_droit_module', (route) => {
      appels.push(route.request().postDataJSON() as Record<string, unknown>);
      return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    });

    await ouvrir(page);
    await page.getByRole('button', { name: 'Paramètres' }).click();
    await page.getByRole('button', { name: 'Modifier' }).first().click();
    await expect(page.getByRole('heading', { name: 'Modifier Utilisateur' })).toBeVisible();
    await expect(page.getByText('Droits d\'accès aux modules')).toBeVisible();
    await expect(page.getByText('Rôle : lecture', { exact: true })).toBeVisible();

    await page.getByLabel('Droits Voyages et fiches terrain').selectOption('ecriture');
    await page.getByLabel('Droits Carburant').selectOption('defaut');
    await page.getByRole('button', { name: 'Mettre à jour' }).click();

    await expect.poll(() => appels.length).toBe(2);
    expect(appels).toEqual(expect.arrayContaining([
      expect.objectContaining({ p_utilisateur: 'u1', p_module: 'trips', p_niveau: 'ecriture' }),
      expect.objectContaining({ p_utilisateur: 'u1', p_module: 'fuel', p_niveau: 'defaut' }),
    ]));
    await expect(page.getByRole('heading', { name: 'Modifier Utilisateur' })).toBeHidden();
  });
});
