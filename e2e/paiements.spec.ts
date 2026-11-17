import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi } from './api-simulee';

// Paiements fournisseurs (D-055) avec l'API simulee, au standard des pages
// (D-090) : bon a payer plafonne au reste en pleine page, fiche du
// paiement, execution avec reference bancaire obligatoire, rejet motive.

const PAIEMENT = {
  id: 'p1', numero: 'PAY-2026-00002', facture_fournisseur_id: 'f1', purchase_order_id: null, beneficiaire: 'Neemba', devise: 'USD', objet: 'Solde octobre',
  montant_propose: 300, statut: 'approuve', propose_par: 'autre', propose_le: '2026-11-10T08:00:00Z', decide_par: 'autre2', decide_le: '2026-11-11T08:00:00Z',
  motif_decision: null, execute_le: null, mode: null, reference_execution: null, montant_execute: null, execute_par: null, execute_saisi_le: null,
  annule_par: null, motif_annulation: null, controle_resultat: null, controle_motif: null, controle_par: null, controle_le: null,
};
const jeu = {
  profiles: PROFIL,
  v_reste_a_payer: [{ source: 'facture_loueur', piece_id: 'f1', piece: 'NEE-2026-118', date_piece: '2026-11-05', base: 1180, engage: 0, paye: 500, reste: 680, beneficiaire: 'Neemba', devise: 'USD' }],
  paiements_fournisseur: [PAIEMENT],
};

const ouvrir = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Contrats & Finance', exact: true }).click();
  await page.getByRole('button', { name: 'Paiements fournisseurs', exact: true }).click();
};

const capturer = async (page: Page, fonctions: string[], reponses: Record<string, unknown> = {}) => {
  const appels: { fonction: string; corps: Record<string, unknown> }[] = [];
  for (const fonction of fonctions) {
    await page.route(`**/rest/v1/rpc/${fonction}`, (route) => { appels.push({ fonction, corps: route.request().postDataJSON() }); return repondre(route, reponses[fonction] ?? 'ok'); });
  }
  return appels;
};

test.describe('Paiements fournisseurs', () => {
  test('bon a payer plafonne, execution avec reference', async ({ page }) => {
    await simulerApi(page, jeu);
    // proposer_paiement renvoie l'identifiant du paiement cree : la fiche s'ouvre.
    const appels = await capturer(page, ['proposer_paiement', 'enregistrer_execution_paiement'], { proposer_paiement: 'p1' });
    await ouvrir(page);
    await page.getByRole('link', { name: 'Proposer un paiement NEE-2026-118' }).click();
    await expect(page).toHaveURL(/#\/paiements\/nouveau\?source=facture_loueur&piece=f1$/);
    const f = page.getByRole('form', { name: 'Bon à payer : NEE-2026-118' });
    await expect(f.getByLabel('Montant (USD) *')).toHaveValue('680');
    await f.getByLabel('Montant (USD) *').fill('700');
    await f.getByLabel('Objet *').fill('Solde novembre');
    await f.getByRole('button', { name: 'Proposer', exact: true }).click();
    await expect(f.getByRole('alert')).toContainText('Montant supérieur au reste à payer.');
    expect(appels).toHaveLength(0);
    await f.getByLabel('Montant (USD) *').fill('680');
    await f.getByRole('button', { name: 'Proposer', exact: true }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ fonction: 'proposer_paiement', corps: { p_montant: 680, p_objet: 'Solde novembre', p_facture: 'f1', p_bon: null } });

    await expect(page).toHaveURL(/#\/paiements\/p1$/);
    const fiche = page.getByRole('article', { name: 'Fiche PAY-2026-00002' });
    await expect(fiche.getByRole('status').filter({ hasText: 'Bon à payer proposé' })).toBeVisible();
    await fiche.getByRole('link', { name: 'Saisir l\'exécution' }).click();
    const e = page.getByRole('form', { name: 'Paiement exécuté : PAY-2026-00002' });
    await e.getByLabel('Date d\'exécution *').fill('2026-11-14');
    await e.getByLabel('Mode *').selectOption('virement');
    await expect(e.getByRole('button', { name: 'Enregistrer l\'exécution' })).toBeDisabled();
    await e.getByLabel('Référence bancaire *').fill('VIR-0042');
    await e.getByRole('button', { name: 'Enregistrer l\'exécution' }).click();
    await expect.poll(() => appels.length).toBe(2);
    expect(appels[1]).toMatchObject({ fonction: 'enregistrer_execution_paiement', corps: { p_id: 'p1', p_date: '2026-11-14', p_mode: 'virement', p_montant: 300, p_reference: 'VIR-0042' } });
    await expect(page).toHaveURL(/#\/paiements\/p1$/);
  });

  test('rejet motive en pleine page, refus de l\'approbation par le proposant', async ({ page }) => {
    await simulerApi(page, { ...jeu, paiements_fournisseur: [
      { ...PAIEMENT, id: 'p2', numero: 'PAY-2026-00003', statut: 'propose', decide_par: null, decide_le: null },
      { ...PAIEMENT, id: 'p3', numero: 'PAY-2026-00004', statut: 'propose', propose_par: PROFIL[0].id, decide_par: null, decide_le: null },
    ] });
    const appels = await capturer(page, ['decider_paiement']);
    await ouvrir(page);
    await page.getByRole('button', { name: 'Fiche PAY-2026-00003' }).click();
    await page.getByRole('link', { name: 'Rejeter' }).click();
    const f = page.getByRole('form', { name: 'Rejeter le paiement PAY-2026-00003' });
    await expect(f.getByRole('button', { name: 'Rejeter' })).toBeDisabled();
    await f.getByLabel('Motif *').fill('Facture contestée');
    await f.getByRole('button', { name: 'Rejeter' }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0].corps).toMatchObject({ p_id: 'p2', p_approuver: false, p_motif: 'Facture contestée' });

    // Le proposant n'approuve pas son propre paiement, meme par l'adresse.
    await page.goto('/#/paiements/p3/approuver');
    await expect(page.getByText('Action impossible', { exact: true })).toBeVisible();
    await expect(page.getByText('L\'approbation revient à une autre personne que le proposant.')).toBeVisible();
  });
});
