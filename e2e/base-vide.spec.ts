import { expect, test, type Page, type Request } from '@playwright/test';
import { PROFIL, simulerApi } from './api-simulee';

// Base vide (apres la purge de la demonstration, D-076) : trois comptes,
// aucun site, shift, engin, chauffeur ni contrat. Chaque ecran de la chaine
// J1 s'ouvre sans erreur, affiche un etat vide explicite et n'envoie jamais
// un identifiant vide au serveur (invalid input syntax for type uuid: "").

const SANS_SITE = 'Aucun site enregistré : créez d\'abord le site d\'exploitation (Exploitation → Sites).';
const SANS_SHIFT = /Aucun shift actif : créez les horaires de travail \(Exploitation → Shifts\)/;

// Filtre PostgREST sans valeur : eq. vide, in.("") ou membre vide d'un or=(...).
const FILTRE_VIDE = /^(not\.)?(eq|neq|gt|gte|lt|lte|like|ilike|is)\.$|^(not\.)?in\.\((""|)\)$/;
const OU_VIDE = /\.(eq|neq)\.(,|\)|$)/;

const identifiantsVides = (corps: unknown, chemin = ''): string[] => {
  if (Array.isArray(corps)) return corps.flatMap((v, i) => identifiantsVides(v, `${chemin}[${i}]`));
  if (corps && typeof corps === 'object') {
    return Object.entries(corps as Record<string, unknown>).flatMap(([cle, v]) => (
      v === '' && (cle.startsWith('p_') || cle.endsWith('_id')) ? [`${chemin}${cle}`] : identifiantsVides(v, `${chemin}${cle}.`)
    ));
  }
  return [];
};

const surveiller = (page: Page) => {
  const suspects: string[] = [];
  page.on('request', (r: Request) => {
    const url = new URL(r.url());
    if (!url.pathname.includes('/rest/v1/')) return;
    for (const [cle, valeur] of url.searchParams) {
      if (FILTRE_VIDE.test(valeur) || ((cle === 'or' || cle === 'and') && OU_VIDE.test(valeur))) {
        suspects.push(`${r.method()} ${url.pathname} ${cle}=${valeur}`);
      }
    }
    if (r.method() === 'POST' || r.method() === 'PATCH') {
      let corps: unknown = null;
      try { corps = r.postDataJSON(); } catch { corps = null; }
      for (const champ of identifiantsVides(corps)) suspects.push(`${r.method()} ${url.pathname} ${champ}: ""`);
    }
  });
  return suspects;
};

const ouvrir = async (page: Page, groupe: string | null, vue: string, titre: string | RegExp) => {
  const cible = page.getByRole('button', { name: vue, exact: true });
  if (groupe && !(await cible.isVisible())) await page.getByRole('button', { name: groupe, exact: true }).click();
  await cible.click();
  await expect(page.getByRole('heading', { name: titre }).first()).toBeVisible();
};

const sansErreurNiChargement = async (page: Page) => {
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText(/invalid input syntax|indisponible/i)).toHaveCount(0);
  await expect(page.locator('.animate-spin')).toHaveCount(0);
  await expect(page.getByText(/^(Chargement|Calcul)…?\.{0,3}$/)).toHaveCount(0);
};

test.describe('Base vide (référentiels non saisis)', () => {
  test('chaîne J1 : états vides explicites, aucune erreur, aucun identifiant vide envoyé', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL });
    const suspects = surveiller(page);
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Paramètres', exact: true }).waitFor();

    await ouvrir(page, null, 'Planification', 'Planification');
    await expect(page.getByRole('status').filter({ hasText: SANS_SITE })).toBeVisible();
    await expect(page.getByText('Aucun objectif', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Définir un objectif' })).toBeDisabled();
    await sansErreurNiChargement(page);
    await page.getByRole('tab', { name: 'Clôture et rapport' }).click();
    await expect(page.getByRole('status').filter({ hasText: /La clôture porte sur une journée et un site/ })).toBeVisible();
    await expect(page.getByText('Aucune production', { exact: true })).toBeVisible();
    await sansErreurNiChargement(page);

    await ouvrir(page, null, 'Postes de travail', 'Postes de travail');
    await expect(page.getByRole('status').filter({ hasText: SANS_SITE })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: SANS_SHIFT })).toBeVisible();
    await expect(page.getByText('Aucun poste ouvert à cette date')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ouvrir le poste' })).toBeDisabled();
    await sansErreurNiChargement(page);

    await ouvrir(page, null, 'Dispatch', 'Dispatch');
    await expect(page.getByRole('status').filter({ hasText: SANS_SITE })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: SANS_SHIFT })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Site de chargement', exact: true })).toBeDisabled();
    await expect(page.getByRole('combobox', { name: 'Shift', exact: true })).toBeDisabled();
    await expect(page.getByText('Aucun voyage à affecter')).toBeVisible();
    await expect(page.getByRole('button', { name: /Créer les voyages/ })).toHaveCount(0);
    await sansErreurNiChargement(page);

    await ouvrir(page, null, 'Voyages & Rotations', 'Voyages & Rotations');
    await expect(page.getByRole('status').filter({ hasText: SANS_SITE })).toBeVisible();
    await expect(page.getByText('Aucun voyage', { exact: true })).toBeVisible();
    await sansErreurNiChargement(page);

    await ouvrir(page, null, 'Kilométrage', 'Kilométrage des voyages');
    await expect(page.getByText('Aucun voyage sur la période')).toBeVisible();
    await expect(page.getByText('Aucune distance de référence')).toBeVisible();
    await sansErreurNiChargement(page);

    await ouvrir(page, null, 'Fiches terrain', 'Fiches terrain');
    await expect(page.getByRole('status').filter({ hasText: SANS_SITE })).toBeVisible();
    await expect(page.getByLabel('Site', { exact: true })).toBeDisabled();
    await expect(page.getByText('Aucune fiche', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Préparer la fiche/ })).toHaveCount(0);
    await sansErreurNiChargement(page);

    await ouvrir(page, null, 'Tickets CBG', 'Tickets et relevés CBG');
    await expect(page.getByText('Aucun relevé importé')).toBeVisible();
    await sansErreurNiChargement(page);

    await ouvrir(page, 'Contrats & Finance', 'Dossier contractuel', 'Dossier contractuel');
    await expect(page.getByText('Aucun contrat', { exact: true })).toBeVisible();
    await sansErreurNiChargement(page);

    await ouvrir(page, 'Contrats & Finance', 'Réconciliation mensuelle', 'Réconciliation mensuelle');
    await expect(page.getByRole('status').filter({ hasText: /Aucun contrat client enregistré/ })).toBeVisible();
    await sansErreurNiChargement(page);

    await ouvrir(page, 'Contrats & Finance', 'Facturation', 'Facturation');
    await expect(page.getByText('Aucune facture', { exact: true })).toBeVisible();
    await sansErreurNiChargement(page);

    await ouvrir(page, null, 'Centre de pilotage', 'Centre de pilotage');
    await expect(page.getByRole('status').filter({ hasText: SANS_SITE })).toBeVisible();
    await expect(page.getByText('Aucun indicateur', { exact: true })).toBeVisible();
    await sansErreurNiChargement(page);

    await ouvrir(page, 'Reporting & Analyse', 'Rapports', 'Rapports');
    await expect(page.getByText('Aucun enregistrement pour ces paramètres dans votre périmètre.')).toBeVisible();
    await sansErreurNiChargement(page);

    expect(suspects).toEqual([]);
  });
});
