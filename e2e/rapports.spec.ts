import { expect, test, type Page } from '@playwright/test';
import { PROFIL, SITE_MINE, repondre, simulerApi } from './api-simulee';

// Rapports (D-058) et couts directs avec l'API simulee : rapport calcule
// par le serveur, valeur absente signalee, export CSV et impression reels,
// rapport fige, saisie d'une depense par fonction serveur.

const L = (rang: number, section: string, indicateur: string, valeur: number | null, unite: string | null, manquants: number | null, remarque: string | null) =>
  ({ rang, section, indicateur, valeur, unite, manquants, source: 'trips', remarque });

const journalier = [
  L(20, 'Voyages', 'Voyages du périmètre', 4, 'voyages', null, null),
  L(23, 'Voyages', 'Livrés', 2, 'voyages', null, null),
  L(31, 'Tonnages', 'Tonnes reçues (pesée arrivée)', 39, 't', 1, null),
  L(50, 'Carburant', 'Gasoil distribué (pleins)', null, 'L', null, 'Non visible avec vos droits de lecture'),
];
const sansDonnees = [L(20, 'Voyages', 'Voyages du périmètre', 0, 'voyages', null, null), L(30, 'Tonnages', 'Tonnes chargées (pesée départ)', null, 't', 0, 'Sans données')];

const jeu = {
  profiles: PROFIL,
  sites: [{ id: SITE_MINE, name: 'Mine de Nimba' }],
  work_shifts: [],
  rapports_figes: [{ id: 'r1', numero: 'RAP-2026-00001', type: 'journalier', periode_debut: '2026-11-10', periode_fin: '2026-11-10', site_id: SITE_MINE,
    lignes: journalier, note: 'Remis au directeur', fige_le: '2026-11-11T07:00:00Z' }],
  costs: [{ id: 'c1', numero: 'CST-2026-00001', date: '2026-11-03', description: 'Location groupe électrogène', amount: 1500000, devise: 'GNF', reference: 'FAC-12',
    payment_method: null, notes: null, statut: 'enregistre', motif_annulation: null, site_id: SITE_MINE,
    cost_categories: { name: 'Énergie', category_type: 'operational' }, vehicles: null, sites: { name: 'Mine de Nimba' } }],
  cost_categories: [{ id: 'k1', name: 'Énergie' }],
  vehicles: [],
};

const surveillerImpression = async (page: Page) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __impressions: string[]; open: unknown };
    w.__impressions = [];
    w.open = () => ({ document: { write: (h: string) => w.__impressions.push(h), close: () => undefined }, print: () => undefined });
  });
};

const ouvrirRapports = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Reporting & Analyse', exact: true }).click();
  await page.getByRole('button', { name: 'Rapports', exact: true }).click();
};

test.describe('Rapports', () => {
  test('rapport journalier calcule, valeur absente signalee, export CSV et impression', async ({ page }) => {
    await simulerApi(page, jeu);
    await surveillerImpression(page);
    const appels: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/rapport_journalier', (route) => { appels.push(route.request().postDataJSON()); return repondre(route, journalier); });
    await ouvrirRapports(page);
    const f = page.getByRole('form', { name: 'Paramètres du rapport' });
    await f.getByLabel('Jour').fill('2026-11-10');
    await f.getByLabel('Site').selectOption(SITE_MINE);
    await expect(page.getByRole('heading', { name: 'Rapport journalier du 10/11/2026 · Mine de Nimba' })).toBeVisible();
    await expect.poll(() => appels.at(-1)).toEqual({ p_date: '2026-11-10', p_site: SITE_MINE });
    await expect(page.getByText('39 t')).toBeVisible();
    await expect(page.getByText('1 sans mesure')).toBeVisible();
    await expect(page.getByText('Non visible avec vos droits de lecture')).toBeVisible();

    const [telechargement] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
    expect(telechargement.suggestedFilename()).toMatch(/^rapport_journalier_du_10_11_2026_mine_de_nimba_\d{4}-\d{2}-\d{2}\.csv$/);
    const chemin = await telechargement.path();
    const contenu = (await import('node:fs')).readFileSync(chemin, 'utf-8');
    expect(contenu).toContain('Tonnages,Tonnes reçues (pesée arrivée),39,t,1,,trips');
    expect(contenu).toContain('Carburant,Gasoil distribué (pleins),,L,,Non visible avec vos droits de lecture,trips');

    await page.getByRole('button', { name: 'Imprimer', exact: true }).click();
    const impressions = await page.evaluate(() => (window as unknown as { __impressions: string[] }).__impressions);
    expect(impressions.at(-1)).toContain('Rapport journalier du 10/11/2026 · Mine de Nimba');
    expect(impressions.at(-1)).toContain('Tonnes reçues (pesée arrivée)');
  });

  test('sans donnees : rien a exporter ni a figer', async ({ page }) => {
    await simulerApi(page, jeu);
    await page.route('**/rest/v1/rpc/rapport_journalier', (route) => repondre(route, sansDonnees));
    await ouvrirRapports(page);
    await expect(page.getByText('Aucun enregistrement pour ces paramètres dans votre périmètre.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Figer' })).toBeDisabled();
  });

  test('rapport client sur une periode et rapport fige', async ({ page }) => {
    await simulerApi(page, jeu);
    const appels: { fonction: string; corps: Record<string, unknown> }[] = [];
    await page.route('**/rest/v1/rpc/rapport_journalier', (route) => repondre(route, journalier));
    for (const fonction of ['rapport_client', 'figer_rapport']) {
      await page.route(`**/rest/v1/rpc/${fonction}`, (route) => {
        appels.push({ fonction, corps: route.request().postDataJSON() });
        return repondre(route, fonction === 'figer_rapport' ? 'r2' : [L(13, 'Livraisons', 'Tonnes acceptées', 38, 't', 0, null)]);
      });
    }
    page.on('dialog', (d) => d.accept('Pour le comité'));
    await ouvrirRapports(page);
    await expect(page.getByText('RAP-2026-00001 · Rapport journalier · 10/11/2026')).toBeVisible();
    const f = page.getByRole('form', { name: 'Paramètres du rapport' });
    await f.getByLabel('Rapport').selectOption('client');
    await f.getByLabel('Du').fill('2026-11-01');
    await f.getByLabel('Au').fill('2026-11-30');
    await expect(page.getByText('38 t')).toBeVisible();
    expect(appels.filter((a) => a.fonction === 'rapport_client').at(-1)?.corps).toEqual({ p_debut: '2026-11-01', p_fin: '2026-11-30', p_site: null });
    await page.getByRole('button', { name: 'Figer' }).click();
    await expect.poll(() => appels.filter((a) => a.fonction === 'figer_rapport').length).toBe(1);
    expect(appels.find((a) => a.fonction === 'figer_rapport')?.corps).toEqual({
      p_type: 'client', p_debut: '2026-11-01', p_fin: '2026-11-30', p_site: null, p_poste: null, p_note: 'Pour le comité' });
    await expect(page.getByRole('status')).toHaveText('Rapport figé.');
  });
});

test.describe('Coûts directs', () => {
  test('nouvelle depense par fonction serveur, devise exigee, annulation motivee', async ({ page }) => {
    await simulerApi(page, jeu);
    const appels: { fonction: string; corps: Record<string, unknown> }[] = [];
    for (const fonction of ['enregistrer_cout', 'annuler_cout']) {
      await page.route(`**/rest/v1/rpc/${fonction}`, (route) => { appels.push({ fonction, corps: route.request().postDataJSON() }); return repondre(route, null); });
    }
    page.on('dialog', (d) => d.accept('Doublon de la facture FAC-12'));
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Contrats & Finance', exact: true }).click();
    await page.getByRole('button', { name: 'Coûts', exact: true }).click();
    await expect(page.getByText('1 dépense(s)', { exact: false })).toBeVisible();

    await page.getByRole('button', { name: 'Nouvelle dépense' }).click();
    const f = page.getByRole('form', { name: 'Nouvelle dépense' });
    await f.getByLabel('Date *').fill('2026-11-05');
    await f.getByLabel('Description *').fill('Réparation pompe');
    await f.getByLabel('Montant *').fill('250000');
    await f.getByLabel('Site').selectOption(SITE_MINE);
    await expect(page.getByRole('button', { name: 'Enregistrer', exact: true })).toBeDisabled();
    await f.getByLabel('Devise *').selectOption('GNF');
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ fonction: 'enregistrer_cout', corps: {
      p_date: '2026-11-05', p_description: 'Réparation pompe', p_montant: 250000, p_devise: 'GNF', p_site: SITE_MINE, p_categorie: null, p_vehicule: null } });

    await page.getByRole('button', { name: 'Annuler CST-2026-00001' }).click();
    await expect.poll(() => appels.length).toBe(2);
    expect(appels[1]).toMatchObject({ fonction: 'annuler_cout', corps: { p_id: 'c1', p_motif: 'Doublon de la facture FAC-12' } });
  });
});
