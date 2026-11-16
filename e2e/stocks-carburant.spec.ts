import { expect, test, type Page } from '@playwright/test';
import { PROFIL, SITE_MINE, repondre, simulerApi } from './api-simulee';

// Registre carburant (D-041) avec l'API simulee : stock calcule (ou « sans
// donnees »), decision sur un mouvement a valider, reception d'une
// livraison CBG avec motif d'ecart.

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
  receptions_carburant: [], sites: [{ id: SITE_MINE, name: 'Mine de Nimba' }],
};

const ouvrir = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Carburant', exact: true }).click();
  await page.getByRole('button', { name: 'Réceptions, cuves et inventaires', exact: true }).click();
};

test.describe('Registre carburant', () => {
  test('stock calcule, sans donnees avant inventaire, validation d\'un mouvement', async ({ page }) => {
    await simulerApi(page, jeu);
    const decisions: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/decider_mouvement_carburant', (route) => { decisions.push(route.request().postDataJSON()); return repondre(route, 1); });
    await ouvrir(page);
    await expect(page.getByText('3 950 L').first()).toBeVisible();
    await expect(page.getByText('sans données')).toBeVisible();
    await expect(page.getByText('Inventaire d\'ouverture requis')).toBeVisible();
    await page.getByRole('button', { name: 'Valider le mouvement 2' }).click();
    await expect.poll(() => decisions.length).toBe(1);
    expect(decisions[0]).toMatchObject({ p_id: 'm2', p_valider: true });
    await expect(page.getByRole('button', { name: 'Annuler le mouvement 1' })).toBeVisible();
    await page.screenshot({ path: 'test-results/registre-carburant.png', fullPage: true });
  });

  test('reception d\'une livraison CBG avec ecart motive', async ({ page }) => {
    await simulerApi(page, jeu);
    const receptions: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/receptionner_livraison_cbg', (route) => { receptions.push(route.request().postDataJSON()); return repondre(route, 'r1'); });
    await ouvrir(page);
    await page.getByRole('button', { name: 'Réception CBG' }).click();
    const f = page.getByRole('form', { name: 'Saisie carburant' });
    await f.getByLabel('Stockage de réception *').selectOption('s1');
    await f.getByLabel('Livraison CBG *').selectOption('l1');
    await f.getByLabel('Volume mesuré (L) *').fill('4950');
    await f.getByLabel('Volume accepté (L) *').fill('4950');
    await f.getByLabel(/Motif d'écart/).fill('50 L manquants a la jauge');
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect.poll(() => receptions.length).toBe(1);
    expect(receptions[0]).toMatchObject({ p_livraison_id: 'l1', p_stockage_id: 's1', p_volume_mesure: 4950, p_volume_accepte: 4950, p_methode: 'jauge', p_motif_ecart: '50 L manquants a la jauge' });
  });
});
