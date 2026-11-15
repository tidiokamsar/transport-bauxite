import { expect, test } from '@playwright/test';
import { ADMIN, PROFIL, repondre, simulerApi } from './api-simulee';

// Double authentification (D-045) avec l'API d'authentification simulee :
// un compte avec facteur TOTP verifie saisit son code apres le mot de passe ;
// la session passe en aal2 et l'application s'ouvre.

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jeton = (aal: 'aal1' | 'aal2') =>
  `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: ADMIN, role: 'authenticated', aal, exp: Math.floor(Date.now() / 1000) + 3600 })}.test`;
const FACTEUR = { id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'SIGTB', created_at: '2026-11-15T07:00:00Z', updated_at: '2026-11-15T07:00:00Z' };
const UTILISATEUR = { id: ADMIN, email: 'admin@exemple.invalid', aud: 'authenticated', role: 'authenticated', factors: [FACTEUR] };

test('connexion en deux etapes : code TOTP exige puis application ouverte', async ({ page }) => {
  await simulerApi(page, { profiles: PROFIL });
  await page.addInitScript((session) => { localStorage.setItem('sb-127-auth-token', JSON.stringify(session)); }, {
    access_token: jeton('aal1'), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'test', user: UTILISATEUR,
  });
  const appels: string[] = [];
  await page.route('**/auth/v1/user', (route) => repondre(route, UTILISATEUR));
  await page.route('**/auth/v1/factors/f1/challenge', (route) => { appels.push('challenge'); return repondre(route, { id: 'c1', type: 'totp', expires_at: Math.floor(Date.now() / 1000) + 300 }); });
  await page.route('**/auth/v1/factors/f1/verify', (route) => {
    appels.push(`verify:${(route.request().postDataJSON() as { code: string }).code}`);
    return repondre(route, { access_token: jeton('aal2'), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'test2', user: UTILISATEUR });
  });

  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto('/');
  const etape = page.getByRole('dialog', { name: 'Vérification en deux étapes' });
  await expect(etape).toBeVisible();
  await expect(etape.getByRole('button', { name: 'Vérifier' })).toBeDisabled();
  await etape.getByLabel('Code de vérification').fill('123 456');
  await etape.getByRole('button', { name: 'Vérifier' }).click();
  await expect.poll(() => appels).toEqual(['challenge', 'verify:123456']);
  await expect(etape).toBeHidden();
  await expect(page.getByRole('button', { name: 'Paramètres', exact: true })).toBeVisible();
});
