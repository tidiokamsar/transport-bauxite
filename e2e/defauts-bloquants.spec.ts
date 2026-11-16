import { expect, test, type Page } from '@playwright/test';
import { PROFIL, SITE_MINE, repondre, simulerApi } from './api-simulee';

// Defauts bloquants J1 (D-078) avec l'API simulee : creation d'un shift puis
// ouverture d'un poste sur ce shift ; creation d'un chauffeur sans dates
// facultatives (null envoye, jamais une chaine vide).

const jour = new Date().toISOString().slice(0, 10);

const aller = async (page: Page, groupe: string | null, vue: string) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Paramètres', exact: true }).waitFor();
  const cible = page.getByRole('button', { name: vue, exact: true });
  if (groupe && !(await cible.isVisible())) await page.getByRole('button', { name: groupe, exact: true }).click();
  await cible.click();
};

test.describe('Défauts bloquants J1 (D-078)', () => {
  test('création d\'un shift puis ouverture d\'un poste', async ({ page }) => {
    const shifts: Record<string, unknown>[] = [];
    await simulerApi(page, {
      profiles: PROFIL, sites: [{ id: SITE_MINE, name: 'Mine de Nimba', type: 'mine' }], postes: [], postes_equipe: [], postes_evenements: [],
      drivers: [{ id: 'c1', name: 'Mamadou Camara' }], journal_shifts: [],
    });
    // Les shifts se lisent depuis la liste tenue par le test : vide, puis le shift cree.
    await page.route(/\/rest\/v1\/work_shifts(\?.*)?$/, (route) => repondre(route, shifts, `0-${Math.max(0, shifts.length - 1)}/${shifts.length}`));
    const appels: { fonction: string; corps: Record<string, unknown> }[] = [];
    await page.route('**/rest/v1/rpc/definir_shift', (route) => {
      const corps = route.request().postDataJSON() as Record<string, unknown>;
      appels.push({ fonction: 'definir_shift', corps });
      shifts.push({ id: 's-jour', name: corps.p_nom, display_name: corps.p_libelle, start_time: `${corps.p_debut}:00`, end_time: `${corps.p_fin}:00`, shift_order: corps.p_ordre, is_active: true });
      return repondre(route, 's-jour');
    });
    await page.route('**/rest/v1/rpc/ouvrir_poste', (route) => { appels.push({ fonction: 'ouvrir_poste', corps: route.request().postDataJSON() }); return repondre(route, 'p1'); });

    // Ecran vide : message qui renvoie vers la gestion des shifts
    await aller(page, null, 'Postes de travail');
    await expect(page.getByRole('status').filter({ hasText: /Aucun shift actif/ })).toBeVisible();
    await page.getByRole('button', { name: 'Ouvrir la gestion des shifts' }).click();
    await expect(page.getByRole('heading', { name: 'Shifts', exact: true })).toBeVisible();
    await expect(page.getByText('Aucun shift', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Nouveau shift' }).click();
    const f = page.getByRole('form', { name: 'Saisie du shift' });
    await f.getByLabel('Libellé affiché *').fill('Jour');
    await f.getByLabel('Nom technique *').fill('jour');
    await f.getByLabel('Heure de début *').fill('06:00');
    await f.getByLabel('Heure de fin *').fill('18:00');
    await page.getByRole('button', { name: 'Enregistrer le shift' }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0].corps).toMatchObject({ p_id: null, p_nom: 'jour', p_libelle: 'Jour', p_debut: '06:00', p_fin: '18:00', p_ordre: 1, p_actif: true });
    await expect(page.getByRole('cell', { name: /Jour/ }).first()).toBeVisible();

    // Le poste s'ouvre sur le shift cree
    await page.getByRole('button', { name: 'Postes de travail', exact: true }).click();
    const o = page.getByRole('form', { name: 'Ouverture de poste' });
    await o.getByLabel('Shift *').selectOption('s-jour');
    await o.getByLabel('Site *').selectOption(SITE_MINE);
    await page.getByRole('button', { name: 'Ouvrir le poste' }).click();
    await expect.poll(() => appels.length).toBe(2);
    expect(appels[1]).toMatchObject({ fonction: 'ouvrir_poste', corps: { p_date: jour, p_shift_id: 's-jour', p_site_id: SITE_MINE } });
  });

  test('création d\'un chauffeur sans dates facultatives', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL, sites: [{ id: SITE_MINE, name: 'Mine de Nimba', type: 'mine' }], drivers: [] });
    const ecritures: unknown[] = [];
    await page.route('**/rest/v1/drivers*', (route) => {
      if (route.request().method() === 'POST') { ecritures.push(route.request().postDataJSON()); return route.fulfill({ status: 201, body: '' }); }
      return route.fallback();
    });
    await aller(page, 'Flotte', 'Chauffeurs');
    await page.getByRole('button', { name: 'Ajouter un chauffeur' }).click();
    const champ = (libelle: string) => page.locator('label', { hasText: libelle }).locator('xpath=following-sibling::*[1]');
    await champ('Nom complet *').fill('Ibrahima Sow');
    await champ('ID Employé *').fill('MAT-101');
    await champ('Numéro de permis *').fill('GN-PC-101');
    await champ("Date d'expiration du permis *").fill('2028-06-30');
    await champ("Date d'embauche *").fill('2026-11-01');
    await page.getByLabel("Site d'affectation").selectOption(SITE_MINE);
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect.poll(() => ecritures.length).toBe(1);
    const corps = (ecritures[0] as Record<string, unknown>[])[0];
    expect(corps).toMatchObject({ name: 'Ibrahima Sow', birth_date: null, health_certificate_expiry: null, base_salary: null, site_id: SITE_MINE });
  });
});
