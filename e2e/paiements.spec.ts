import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi } from './api-simulee';

// Paiements fournisseurs (D-055) avec l'API simulee : bon a payer plafonne
// au reste, execution avec reference bancaire obligatoire.

const jeu = {
  profiles: PROFIL,
  v_reste_a_payer: [{ source: 'facture_loueur', piece_id: 'f1', piece: 'NEE-2026-118', date_piece: '2026-11-05', base: 1180, engage: 0, paye: 500, reste: 680, beneficiaire: 'Neemba', devise: 'USD' }],
  paiements_fournisseur: [{ id: 'p1', numero: 'PAY-2026-00002', facture_fournisseur_id: 'f1', purchase_order_id: null, beneficiaire: 'Neemba', devise: 'USD', objet: 'Solde octobre',
    montant_propose: 300, statut: 'approuve', propose_par: 'autre', motif_decision: null, execute_le: null, mode: null, reference_execution: null, montant_execute: null,
    execute_par: null, motif_annulation: null, controle_resultat: null, controle_motif: null, propose_le: '2026-11-10T08:00:00Z' }],
};

const ouvrir = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Contrats & Finance', exact: true }).click();
  await page.getByRole('button', { name: 'Paiements fournisseurs', exact: true }).click();
};

test.describe('Paiements fournisseurs', () => {
  test('bon a payer plafonne, execution avec reference', async ({ page }) => {
    await simulerApi(page, jeu);
    const appels: { fonction: string; corps: Record<string, unknown> }[] = [];
    for (const fonction of ['proposer_paiement', 'enregistrer_execution_paiement']) {
      await page.route(`**/rest/v1/rpc/${fonction}`, (route) => { appels.push({ fonction, corps: route.request().postDataJSON() }); return repondre(route, 'ok'); });
    }
    await ouvrir(page);
    await page.getByRole('button', { name: 'Proposer un paiement NEE-2026-118' }).click();
    const f = page.getByRole('form', { name: 'Bon à payer' });
    await f.getByLabel('Montant (USD) *').fill('700');
    await f.getByLabel('Objet *').fill('Solde novembre');
    await expect(page.getByRole('button', { name: 'Proposer', exact: true })).toBeDisabled();
    await f.getByLabel('Montant (USD) *').fill('680');
    await page.getByRole('button', { name: 'Proposer', exact: true }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ fonction: 'proposer_paiement', corps: { p_montant: 680, p_objet: 'Solde novembre', p_facture: 'f1', p_bon: null } });

    await page.getByRole('button', { name: 'Exécution PAY-2026-00002' }).click();
    const e = page.getByRole('form', { name: 'Paiement exécuté' });
    await e.getByLabel('Date d\'exécution *').fill('2026-11-14');
    await e.getByLabel('Mode *').selectOption('virement');
    await expect(page.getByRole('button', { name: 'Enregistrer l\'exécution' })).toBeDisabled();
    await e.getByLabel('Référence bancaire *').fill('VIR-0042');
    await page.getByRole('button', { name: 'Enregistrer l\'exécution' }).click();
    await expect.poll(() => appels.length).toBe(2);
    expect(appels[1]).toMatchObject({ fonction: 'enregistrer_execution_paiement', corps: { p_id: 'p1', p_date: '2026-11-14', p_mode: 'virement', p_montant: 300, p_reference: 'VIR-0042' } });
  });
});
