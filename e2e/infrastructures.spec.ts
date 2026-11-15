import { expect, test, type Page } from '@playwright/test';
import { PROFIL, SITE_DEPOT, SITE_MINE, simulerApi } from './api-simulee';

// Infrastructures et fermetures (D-047) avec l'API simulee : fermeture en
// cours signalee, declaration d'une fermeture motivee, levee motivee.

const maintenant = Date.now();
const jeu = {
  profiles: PROFIL,
  sites: [{ id: SITE_MINE, name: 'Mine de Nimba' }, { id: SITE_DEPOT, name: 'Dépôt CBG' }],
  infrastructures_site: [{ id: 'i1', site_id: SITE_DEPOT, type: 'pont_bascule', code: 'PB-01', libelle: 'Pont-bascule', capacite: 20, unite_capacite: 'camions/heure', actif: true }],
  fermetures_site: [{ id: 'f1', site_id: SITE_DEPOT, infrastructure_id: null, debut: new Date(maintenant - 3600_000).toISOString(),
    fin: new Date(maintenant + 86400_000).toISOString(), motif: 'Pont-bascule en panne', levee_le: null, motif_levee: null }],
};

const ouvrir = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  const entree = page.getByRole('button', { name: 'Infrastructures et fermetures', exact: true });
  await expect(page.getByRole('button', { name: 'Exploitation', exact: true })).toBeVisible();
  if (!(await entree.isVisible())) await page.getByRole('button', { name: 'Exploitation', exact: true }).click();
  await entree.click();
};

test.describe('Infrastructures et fermetures', () => {
  test('fermeture en cours signalee, levee motivee, nouvelle fermeture', async ({ page }) => {
    await simulerApi(page, jeu);
    const ecritures: { methode: string; corps: Record<string, unknown> }[] = [];
    await page.route('**/rest/v1/fermetures_site*', (route) => {
      const methode = route.request().method();
      if (methode === 'GET' || methode === 'HEAD') return route.fallback();
      ecritures.push({ methode, corps: route.request().postDataJSON() });
      return route.fulfill({ status: 201, body: '' });
    });
    page.on('dialog', (d) => d.accept('Pont-bascule réparé'));
    await ouvrir(page);
    await expect(page.getByText('1 fermeture(s) en cours :', { exact: false })).toBeVisible();
    await expect(page.getByText('20 camions/heure')).toBeVisible();

    await page.getByRole('button', { name: 'Lever la fermeture Pont-bascule en panne' }).click();
    await expect.poll(() => ecritures.length).toBe(1);
    expect(ecritures[0]).toMatchObject({ methode: 'PATCH', corps: { motif_levee: 'Pont-bascule réparé' } });

    await page.getByRole('button', { name: 'Déclarer une fermeture' }).click();
    const f = page.getByRole('form', { name: 'Saisie infrastructure' });
    await f.getByLabel('Site *').selectOption(SITE_MINE);
    await f.getByLabel('Motif *').fill('Piste impraticable');
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect.poll(() => ecritures.length).toBe(2);
    expect(ecritures[1]).toMatchObject({ methode: 'POST', corps: { site_id: SITE_MINE, infrastructure_id: null, motif: 'Piste impraticable' } });
  });
});
