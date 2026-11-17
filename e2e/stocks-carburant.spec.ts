import { expect, test, type Page } from '@playwright/test';
import { PROFIL, SITE_MINE, repondre, simulerApi } from './api-simulee';

// Registre carburant (D-041) avec l'API simulee, au standard des pages
// (D-090) : stock calcule (ou « sans donnees »), decision sur un mouvement
// a valider depuis sa fiche, rejet motive, reception d'une livraison CBG
// avec motif d'ecart en pleine page.

const STOCKS = [
  { id: 's1', code: 'CUVE-01', libelle: 'Cuve principale', type: 'cuve_fixe', site_id: SITE_MINE, capacite_litres: 30000, seuil_alerte_litres: 5000,
    actif: true, solde_litres: 3950, en_attente_litres: -300, mouvements_en_attente: 1, dernier_mouvement: null, dernier_inventaire: '2026-11-14T06:00:00Z', dernier_ecart_inventaire: -50 },
  { id: 's2', code: 'CIT-01', libelle: 'Citerne mobile', type: 'citerne_mobile', site_id: SITE_MINE, capacite_litres: 5000, seuil_alerte_litres: null,
    actif: true, solde_litres: null, en_attente_litres: 0, mouvements_en_attente: 0, dernier_mouvement: null, dernier_inventaire: null, dernier_ecart_inventaire: null },
];
const MOUVEMENTS = [
  { id: 'm2', numero: 2, stockage_id: 's1', type: 'distribution', variation: -300, date_mouvement: '2026-11-14T08:00:00Z', reference_piece: 'FC-141126-001-01',
    statut: 'a_valider', note: null, motif_decision: null, transfert_id: null, annule_mouvement_id: null },
  { id: 'm1', numero: 1, stockage_id: 's1', type: 'reception', variation: 4950, date_mouvement: '2026-11-13T08:00:00Z', reference_piece: 'LIV-CBG-12',
    statut: 'valide', note: null, motif_decision: null, transfert_id: null, annule_mouvement_id: null },
];
const jeu = {
  profiles: PROFIL, v_stocks_carburant: STOCKS, mouvements_carburant: MOUVEMENTS, inventaires_carburant: [],
  livraisons_carburant_cbg: [{ id: 'l1', reference: 'LIV-CBG-13', date_livraison: '2026-11-14', site_id: SITE_MINE, volume_litres: 5000 }],
  stockages_carburant: STOCKS, receptions_carburant: [], sites: [{ id: SITE_MINE, name: 'Mine de Nimba' }],
};

const ouvrir = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Carburant', exact: true }).click();
  await page.getByRole('button', { name: 'Réceptions, cuves et inventaires', exact: true }).click();
};

test.describe('Registre carburant', () => {
  test('stock calcule, sans donnees avant inventaire, validation d\'un mouvement depuis sa fiche', async ({ page }) => {
    await simulerApi(page, jeu);
    const decisions: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/decider_mouvement_carburant', (route) => { decisions.push(route.request().postDataJSON()); return repondre(route, 1); });
    await ouvrir(page);
    await expect(page.getByText('3 950 L').first()).toBeVisible();
    await expect(page.getByText('sans données').first()).toBeVisible();
    await expect(page.getByText('Inventaire d\'ouverture requis')).toBeVisible();
    await page.getByRole('region', { name: 'À valider' }).getByRole('link', { name: /n° 2 · Distribution/ }).click();
    await expect(page).toHaveURL(/#\/fuel-stocks\/mouvement-m2$/);
    const fiche = page.getByRole('article', { name: 'Fiche Mouvement n° 2' });
    await expect(fiche.getByRole('link', { name: 'Annuler' })).toHaveCount(0);
    await fiche.getByRole('link', { name: 'Valider' }).click();
    await page.getByRole('form', { name: 'Valider le mouvement n° 2' }).getByRole('button', { name: 'Valider' }).click();
    await expect.poll(() => decisions.length).toBe(1);
    expect(decisions[0]).toEqual({ p_id: 'm2', p_valider: true, p_motif: null });
    await expect(page).toHaveURL(/#\/fuel-stocks\/mouvement-m2$/);
    await expect(page.getByRole('status').filter({ hasText: 'Mouvement validé.' })).toBeVisible();

    // Mouvement valide : annulation proposee, decision impossible.
    await page.goto('/#/fuel-stocks/mouvement-m1');
    const valide = page.getByRole('article', { name: 'Fiche Mouvement n° 1' });
    await expect(valide.getByRole('link', { name: 'Annuler' })).toBeVisible();
    await expect(valide.getByRole('link', { name: 'Valider' })).toHaveCount(0);
    await page.goto('/#/fuel-stocks/mouvement-m1/valider');
    await expect(page.getByText('Mouvement déjà décidé.')).toBeVisible();
    await page.screenshot({ path: 'test-results/registre-carburant.png', fullPage: true });
  });

  test('rejet motive : motif exige par le serveur', async ({ page }) => {
    await simulerApi(page, jeu);
    const decisions: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/decider_mouvement_carburant', (route) => { decisions.push(route.request().postDataJSON()); return repondre(route, 1); });
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto('/#/fuel-stocks/mouvement-m2/rejeter');
    const f = page.getByRole('form', { name: 'Rejeter le mouvement n° 2' });
    await expect(f.getByRole('button', { name: 'Rejeter' })).toBeDisabled();
    await f.getByLabel('Motif *').fill('Fiche en double');
    await f.getByRole('button', { name: 'Rejeter' }).click();
    await expect.poll(() => decisions.length).toBe(1);
    expect(decisions[0]).toEqual({ p_id: 'm2', p_valider: false, p_motif: 'Fiche en double' });
  });

  test('reception d\'une livraison CBG avec ecart motive, en pleine page', async ({ page }) => {
    await simulerApi(page, jeu);
    const receptions: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/receptionner_livraison_cbg', (route) => { receptions.push(route.request().postDataJSON()); return repondre(route, 'r1'); });
    await ouvrir(page);
    await page.getByRole('link', { name: 'Réception CBG' }).click();
    const f = page.getByRole('form', { name: 'Réception d\'une livraison CBG' });
    await f.getByLabel('Stockage de réception *').selectOption('s1');
    await f.getByLabel('Livraison CBG *').selectOption('l1');
    await f.getByLabel('Volume mesuré (L) *').fill('4950');
    await f.getByLabel('Volume accepté (L) *').fill('4950');
    await f.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(f.getByRole('alert')).toContainText('motif requis');
    expect(receptions).toHaveLength(0);
    await f.getByLabel(/Motif d'écart/).fill('50 L manquants a la jauge');
    await f.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect.poll(() => receptions.length).toBe(1);
    expect(receptions[0]).toMatchObject({ p_livraison_id: 'l1', p_stockage_id: 's1', p_volume_mesure: 4950, p_volume_accepte: 4950, p_methode: 'jauge', p_motif_ecart: '50 L manquants a la jauge' });
    await expect(page).toHaveURL(/#\/fuel-stocks\/s1$/);
  });
});
