import { expect, test, type Page, type Route } from '@playwright/test';

// Tableau de bord et cadre de l'application (D-018), avec une API Supabase
// simulee : session administrateur de test et jeux de donnees de test.
// Ces donnees n'existent que dans ce fichier ; aucune ne va en base.

const ADMIN = '00000000-0000-4000-a000-0000000000a1';
const SITE_MINE = '00000000-0000-4000-a000-0000000000b1';
const SITE_DEPOT = '00000000-0000-4000-a000-0000000000b2';

const jeton = () => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: ADMIN, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.test`;
};

const ilYa = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const aujourdhuiA = (h: number) => {
  const d = new Date();
  d.setHours(h, 15, 0, 0);
  return d.toISOString();
};

type Jeu = Record<string, unknown[]>;

const repondre = (route: Route, corps: unknown, plage = '0-0/*') =>
  route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': plage }, body: JSON.stringify(corps) });

const simulerApi = async (page: Page, jeu: Jeu) => {
  await page.route('**/auth/v1/**', (route) =>
    repondre(route, { id: ADMIN, email: 'admin@exemple.invalid', aud: 'authenticated', role: 'authenticated' }),
  );
  await page.route('**/rest/v1/**', (route) => {
    const url = new URL(route.request().url());
    const table = url.pathname.split('/').pop() ?? '';
    const lignes = jeu[table] ?? [];
    if (route.request().method() === 'HEAD') return repondre(route, null, `*/${lignes.length}`);
    if (route.request().method() !== 'GET') return repondre(route, []);
    const objet = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object');
    return repondre(route, objet ? lignes[0] ?? null : lignes, `0-${Math.max(0, lignes.length - 1)}/${lignes.length}`);
  });
  await page.addInitScript((session) => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify(session));
  }, {
    access_token: jeton(),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'test',
    user: { id: ADMIN, email: 'admin@exemple.invalid', aud: 'authenticated', role: 'authenticated' },
  });
};

const PROFIL = [{ id: ADMIN, role: 'admin', full_name: 'Aminata Test', status: 'active', site_id: null }];

test.describe('Tableau de bord', () => {
  test('base vide : cadre complet et « sans données », aucun chiffre invente', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Bonjour, Aminata' })).toBeVisible();
    await expect(page.getByText('Centre de Contrôle Opérationnel')).toBeVisible();
    await expect(page.getByText('Aucun voyage enregistré.')).toBeVisible();
    await expect(page.getByText('Aucune alerte active')).toBeVisible();
    await expect(page.getByText('Objectif jour')).toBeVisible();
    await expect(page.getByText('Non défini')).toBeVisible();
    await expect(page.getByText('Aucun shift défini')).toBeVisible();
    await expect(page.getByText('Aucune distribution saisie')).toBeVisible();
    await page.screenshot({ path: 'test-results/tableau-de-bord-vide.png', fullPage: true });
  });

  test('avec des voyages : tonnes, voyages, flotte et derniers voyages', async ({ page }) => {
    await simulerApi(page, {
      profiles: PROFIL,
      sites: [
        { id: SITE_MINE, name: 'Mine Nimba', type: 'mine' },
        { id: SITE_DEPOT, name: 'Dépôt', type: 'depot' },
      ],
      vehicles: [
        { id: 'v1', registration: 'RC-1001', status: 'active', site_id: SITE_MINE },
        { id: 'v2', registration: 'RC-1002', status: 'active', site_id: SITE_MINE },
        { id: 'v3', registration: 'RC-1003', status: 'maintenance', site_id: SITE_MINE },
        { id: 'v4', registration: 'RC-1004', status: 'immobilized', site_id: SITE_MINE },
      ],
      trips: [
        { id: 't1', reference: 'VYG-0001', vehicle_id: 'v1', departure_site_id: SITE_MINE, arrival_site_id: SITE_DEPOT, net_weight: 52, load_weight: null, status: 'completed', actual_arrival_time: aujourdhuiA(7) },
        { id: 't2', reference: 'VYG-0002', vehicle_id: 'v2', departure_site_id: SITE_MINE, arrival_site_id: SITE_DEPOT, net_weight: 48, load_weight: null, status: 'completed', actual_arrival_time: aujourdhuiA(9) },
      ],
      work_shifts: [{ name: 'jour', display_name: 'Jour', start_time: '00:00:00', end_time: '23:59:00' }],
      alerts: [{ id: 'a1', title: 'Retard de livraison', message: 'Écart estimé', severity: 'warning', created_at: ilYa(12) }],
      vehicle_tracking: [{ vehicle_id: 'v1', latitude: 7.6, longitude: -8.4, timestamp: ilYa(3), speed: 34 }],
      fuel_transactions: [{ volume_liters: 230 }],
    });
    await page.setViewportSize({ width: 1680, height: 1700 });
    await page.goto('/');
    await expect(page.getByText('100 T').first()).toBeVisible();
    await expect(page.getByText('VYG-0001')).toBeVisible();
    await expect(page.getByText('Mine Nimba → Dépôt').first()).toBeVisible();
    await expect(page.getByText('Retard de livraison')).toBeVisible();
    await expect(page.getByText('Shift Jour')).toBeVisible();
    await expect(page.getByText('230 L')).toBeVisible();
    await expect(page.getByText('2,30 L/T')).toBeVisible();
    await page.screenshot({ path: 'test-results/tableau-de-bord-donnees.png', fullPage: true });
  });

  test('la deconnexion passe par une fenetre de confirmation', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL });
    await page.goto('/');
    await page.getByRole('button', { name: 'Menu utilisateur' }).click();
    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await expect(page.getByRole('dialog')).toContainText('Se déconnecter de SIGTB');
    await page.screenshot({ path: 'test-results/deconnexion.png' });
  });
});
