import { expect, test } from '@playwright/test';
import { PROFIL, simulerApi } from './api-simulee';

// Catalogue des fiches (D-104, T2) : les 21 familles se lisent depuis la
// vue active, avec leur statut reel (deployee/cible) et leurs rattachements.

const FICHES = [
  { code: 'FR', version: 1, nom: 'Rotations camion', objectif: 'Consigner chaque rotation.', module_proprietaire: 'trips',
    modules_consommateurs: ['trips', 'dispatch', 'planning', 'invoices', 'contracts'], profils: ['agent terrain'], pieces: ['fiche signee'],
    champs: [{ champ: 'voyage', obligatoire: true, regle: 'voyage livre' }], regles_validation: ['ticket unique'], statut: 'deployee' },
  { code: 'FP', version: 1, nom: 'Pointage des engins', objectif: 'Pointer les heures.', module_proprietaire: 'trips',
    modules_consommateurs: ['maintenance', 'contracts'], profils: [], pieces: [], champs: [], regles_validation: [], statut: 'deployee' },
  { code: 'FCS', version: 1, nom: 'Cloture de poste', objectif: 'Cloturer un poste.', module_proprietaire: 'planning',
    modules_consommateurs: ['planning', 'trips'], profils: [], pieces: [], champs: [], regles_validation: [], statut: 'cible' },
];

test.describe('Catalogue des fiches', () => {
  test('les familles se lisent avec leur statut reel', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL, v_fiches_catalogue_actives: FICHES });
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Catalogue des fiches' }).click();
    await expect(page.getByRole('heading', { name: 'Catalogue des fiches' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'FR · Rotations camion (v1)' })).toBeVisible();
    await expect(page.getByText('Déployée').first()).toBeVisible();
    await page.getByRole('button', { name: /FCS/ }).click();
    await expect(page.getByRole('heading', { name: /FCS · Cloture de poste/ })).toBeVisible();
    await expect(page.getByText('Cible').first()).toBeVisible();
    await expect(page.getByText('planning, trips')).toBeVisible();
  });
});
