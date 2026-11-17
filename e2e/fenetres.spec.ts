import { expect, test, type Page } from '@playwright/test';
import { PROFIL, simulerApi, SITE_DEPOT, SITE_MINE } from './api-simulee';

// Fenetres modales (composant commun ui/Fenetre) avec l'API simulee : sur
// ecran portable (1366x768) et sur telephone (375x667), le bouton principal
// du pied reste dans l'ecran, la fenetre ne depasse pas la hauteur visible et
// seul son contenu defile. Defaut d'origine : « Definir un objectif » dont
// les boutons Enregistrer et Annuler sortaient de l'ecran. Chauffeur, engin
// et site ne s'ouvrent plus en fenetre mais en page (D-090, e2e/pages-standard).

const JEU = {
  profiles: PROFIL,
  sites: [
    { id: SITE_MINE, name: 'Mine Nimba', type: 'mine' },
    { id: SITE_DEPOT, name: 'Dépôt', type: 'depot' },
  ],
  work_shifts: [{ id: 's1', name: 'jour', display_name: 'Jour', start_time: '00:00:00', end_time: '23:59:00', shift_order: 1 }],
  vehicles: [{ id: 'v1', registration: 'RC-1001', vehicle_type: 'tipper', status: 'active', site_id: SITE_MINE }],
  drivers: [],
  fuel_transactions: [],
  stockages_carburant: [],
};

const ECRANS = [
  { largeur: 1366, hauteur: 768, nom: 'portable' },
  { largeur: 375, hauteur: 667, nom: 'téléphone' },
];

/** Navigation sur grand ecran (menu lateral visible), puis taille cible avant l'ouverture. */
const aller = async (page: Page, groupe: string | null, vue: string, largeur: number, hauteur: number) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Paramètres', exact: true }).waitFor();
  const cible = page.getByRole('button', { name: vue, exact: true }).first();
  if (groupe && !(await cible.isVisible())) await page.getByRole('button', { name: groupe, exact: true }).click();
  await cible.click();
  await page.setViewportSize({ width: largeur, height: hauteur });
};

const verifierFenetre = async (page: Page, principal: string, hauteur: number, doitDefiler = false) => {
  const fenetre = page.getByRole('dialog').last();
  await expect(fenetre).toBeVisible();
  const bouton = fenetre.getByRole('button', { name: principal, exact: true });
  await expect(bouton).toBeInViewport();
  await expect(fenetre.getByRole('button', { name: 'Fermer', exact: true }).first()).toBeInViewport();

  const boite = await fenetre.boundingBox();
  expect(boite).not.toBeNull();
  expect(boite!.y).toBeGreaterThanOrEqual(0);
  expect(boite!.y + boite!.height).toBeLessThanOrEqual(hauteur + 1);

  // Le contenu defile dans la fenetre ; la page en dessous ne defile plus.
  const corps = fenetre.locator('[data-fenetre-corps]');
  const mesure = await corps.evaluate((el) => {
    const avant = { hauteur: el.scrollHeight, visible: el.clientHeight, style: getComputedStyle(el).overflowY };
    el.scrollTop = el.scrollHeight;
    return { ...avant, defile: el.scrollTop, page: getComputedStyle(document.body).overflow };
  });
  expect(mesure.style).toBe('auto');
  expect(mesure.page).toBe('hidden');
  if (doitDefiler) expect(mesure.hauteur).toBeGreaterThan(mesure.visible);
  if (mesure.hauteur > mesure.visible) expect(mesure.defile).toBeGreaterThan(0);
  // Apres defilement complet, le bouton principal est toujours visible.
  await expect(bouton).toBeInViewport();

  // Echap ferme la fenetre.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
};

for (const { largeur, hauteur, nom } of ECRANS) {
  test.describe(`Fenêtres sur ${nom} (${largeur}x${hauteur})`, () => {
    test.beforeEach(async ({ page }) => { await simulerApi(page, JEU); });

    test('nouveau voyage', async ({ page }) => {
      await aller(page, null, 'Voyages & Rotations', largeur, hauteur);
      await page.getByRole('button', { name: 'Nouveau voyage' }).click();
      await verifierFenetre(page, 'Créer le voyage', hauteur);
    });

    test('saisir un plein', async ({ page }) => {
      await aller(page, 'Carburant', 'Distribution aux engins', largeur, hauteur);
      await page.getByRole('button', { name: 'Saisir' }).click();
      await verifierFenetre(page, 'Enregistrer', hauteur);
    });

    test('utilisateur', async ({ page }) => {
      await aller(page, null, 'Paramètres', largeur, hauteur);
      await page.getByRole('button', { name: 'Ajouter utilisateur' }).click();
      await verifierFenetre(page, 'Créer', hauteur, true);
    });
  });
}
