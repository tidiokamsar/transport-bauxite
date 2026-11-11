import { expect, test, type Page } from '@playwright/test';
import { ADMIN, PROFIL, repondre, simulerApi } from './api-simulee';

// Reconciliation mensuelle et factures (D-029) avec l'API simulee :
// decisions sur les lignes a examiner, circuit de la facture, signature
// reservee au Directeur General.

const CONTRAT = { id: 'c1', reference: 'CBG-2026-01', contrepartie: 'CBG', devise: 'USD', nature: 'client' };
const REC = {
  id: 'r1', contrat_id: 'c1', periode_debut: '2026-10-01', periode_fin: '2026-10-31', base_tonnage: 'accepte', tolerance_ecart_pct: 2,
  site_depart_id: null, site_arrivee_id: null, statut: 'ouverte', tonnage_facturable: null, voyages_facturables: null, actualisee_le: null, cloturee_le: null,
};
const ligne = (id: string, reference: string, anomalies: string[], accepte: number | null) => ({
  id, trip_id: `t${id}`, reference, date_voyage: '2026-10-05', etat: 'ACCEPTED', tonnage_charge: 40, tonnage_recu: accepte ?? 40,
  tonnage_accepte: accepte, tonnage_base: accepte, ticket: 'PB-1', fiche: 'FR-261005-001', anomalies, decision: null, motif_decision: null,
});
const FACTURE = {
  id: 'f1', numero: null, type: 'facture', contrat_id: 'c1', facture_origine_id: null, objet: 'Transport de bauxite d\'octobre 2026', devise: 'USD',
  taux_taxe_pct: 18, montant_ht: 385, montant_taxe: 69.3, montant_ttc: 454.3, statut: 'a_signer', date_emission: null, date_echeance: null,
  prepare_le: new Date().toISOString(), signee_le: null, prepare_par: 'autre-utilisateur', motif: null,
};
const LIGNES_FACTURE = [{ id: 'l1', facture_id: 'f1', libelle: 'Transport mine - stock (2 voyages)', quantite: 77, unite: 'tonne', prix_unitaire: 5, montant: 385, ordre: 0 }];

const aller = async (page: Page, groupe: string, ecran: string) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: groupe }).click();
  await page.getByRole('button', { name: ecran, exact: true }).click();
};
const capturer = async (page: Page, fonction: string) => {
  const corps: Record<string, unknown>[] = [];
  await page.route(`**/rest/v1/rpc/${fonction}`, (route) => { corps.push(route.request().postDataJSON()); return repondre(route, 'ok'); });
  return corps;
};

test.describe('Réconciliation et facturation', () => {
  test('reconciliation : lignes a examiner, decision motivee, cloture bloquee', async ({ page }) => {
    await simulerApi(page, {
      profiles: PROFIL, contrats: [CONTRAT], sites: [], reconciliations: [REC],
      reconciliation_lignes: [ligne('1', 'VYG-001', ['sans_fiche'], 40), ligne('2', 'VYG-002', ['ecart_hors_tolerance'], 37)],
    });
    const decisions = await capturer(page, 'decider_ligne_reconciliation');
    page.on('dialog', (d) => d.accept('Écart expliqué par la tare du pont'));
    await aller(page, 'Contrats & Finance', 'Réconciliation mensuelle');
    await expect(page.getByText('Écart chargé / reçu hors tolérance')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clôturer' })).toBeDisabled();
    await expect(page.getByText('40,00 t', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/reconciliation.png', fullPage: true });
    await page.getByRole('button', { name: 'Facturer VYG-002' }).click();
    await expect.poll(() => decisions.length).toBe(1);
    expect(decisions[0]).toMatchObject({ p_ligne_id: '2', p_decision: 'facturable', p_motif: 'Écart expliqué par la tare du pont' });
  });

  test('facture a signer : seul le Directeur voit et utilise la signature', async ({ page }) => {
    const DG = [{ id: ADMIN, role: 'director', full_name: 'Directeur Test', status: 'active', site_id: null }];
    const DROITS = ['dashboard', 'invoices', 'contracts'].map((module) => ({ role: 'director', module, can_view: true, can_create: true, can_edit: true, can_delete: false, can_approve: true }));
    await simulerApi(page, { profiles: DG, role_permissions: DROITS, factures: [FACTURE], facture_lignes: LIGNES_FACTURE, contrats: [CONTRAT], societe: [{ raison_sociale: 'Kogon Mining SARL' }] });
    const actions = await capturer(page, 'avancer_facture');
    await aller(page, 'Contrats & Finance', 'Facturation');
    await expect(page.getByText('1 facture(s) attendent votre signature.')).toBeVisible();
    await expect(page.getByText('454,30 USD').first()).toBeVisible();
    await page.getByRole('button', { name: 'Signer', exact: true }).click();
    await expect.poll(() => actions.length).toBe(1);
    expect(actions[0]).toMatchObject({ p_id: 'f1', p_action: 'signer' });
  });

  test('preparateur : pas de signature, soumission d\'un brouillon, apercu non valable', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL, factures: [{ ...FACTURE, statut: 'brouillon' }], facture_lignes: LIGNES_FACTURE, contrats: [CONTRAT], societe: [{ raison_sociale: 'Kogon Mining SARL' }] });
    const actions = await capturer(page, 'avancer_facture');
    await aller(page, 'Contrats & Finance', 'Facturation');
    await expect(page.getByRole('button', { name: 'Signer', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Aperçu' }).click();
    const doc = page.getByRole('article', { name: 'Document brouillon' });
    await expect(doc).toContainText('Kogon Mining SARL');
    await expect(doc).toContainText('NON VALABLE');
    await expect(doc).toContainText('77 tonne');
    await page.screenshot({ path: 'test-results/facture-apercu.png', fullPage: true });
    await page.getByRole('button', { name: 'Fermer l\'aperçu' }).click();
    await page.getByRole('button', { name: 'Soumettre au DG' }).click();
    await expect.poll(() => actions.length).toBe(1);
    expect(actions[0]).toMatchObject({ p_action: 'soumettre' });
  });
});
