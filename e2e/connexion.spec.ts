import { expect, test } from '@playwright/test';

test.describe('Page de connexion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  });

  test('affiche un formulaire vide', async ({ page }) => {
    const email = page.locator('input[type="email"]');
    const motDePasse = page.locator('input[type="password"]');
    await expect(email).toBeVisible();
    await expect(motDePasse).toBeVisible();
    await expect(email).toHaveValue('');
    await expect(motDePasse).toHaveValue('');
  });

  // Non-regression C1 (Tranche 0.1) : aucun compte de demonstration ni
  // identifiant ne doit etre expose sur la page publique.
  test("n'expose aucun compte de demonstration", async ({ page }) => {
    const texte = await page.locator('body').innerText();
    expect(texte).not.toMatch(/comptes? de d[ée]mo/i);
    expect(texte).not.toMatch(/demo accounts?/i);
    expect(texte).not.toMatch(/mot de passe\s*:/i);
    expect(texte).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });
});
