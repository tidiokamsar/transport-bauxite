import type { Page, Route } from '@playwright/test';

// API Supabase simulee pour les tests E2E : session administrateur de test
// et jeux de donnees de test. Ces donnees n'existent que dans les tests ;
// aucune ne va en base.

export const ADMIN = '00000000-0000-4000-a000-0000000000a1';
export const SITE_MINE = '00000000-0000-4000-a000-0000000000b1';
export const SITE_DEPOT = '00000000-0000-4000-a000-0000000000b2';

const jeton = () => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: ADMIN, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.test`;
};

export const ilYa = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
export const aujourdhuiA = (h: number) => {
  const d = new Date();
  d.setHours(h, 15, 0, 0);
  return d.toISOString();
};

export type Jeu = Record<string, unknown[]>;

export const repondre = (route: Route, corps: unknown, plage = '0-0/*') =>
  route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': plage }, body: JSON.stringify(corps) });

export const simulerApi = async (page: Page, jeu: Jeu) => {
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

export const PROFIL = [{ id: ADMIN, role: 'admin', full_name: 'Aminata Test', status: 'active', site_id: null }];
