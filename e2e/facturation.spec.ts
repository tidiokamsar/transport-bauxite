import { expect, test, type Page } from '@playwright/test';
import { ADMIN, PROFIL, repondre, simulerApi } from './api-simulee';

// Reconciliation mensuelle et factures (D-029) avec l'API simulee, aux
// pages standard (D-090) : decisions motivees sur les lignes a examiner en
// pages d'action, circuit de la facture, signature reservee au Directeur
// General, chaine de preuve facture -> voyages -> tickets CBG.

const CONTRAT = { id: 'c1', reference: 'CBG-2026-01', contrepartie: 'CBG', devise: 'USD', nature: 'client', intitule: 'Transport' };
const REC = {
  id: 'r1', contrat_id: 'c1', periode_debut: '2026-10-01', periode_fin: '2026-10-31', base_tonnage: 'accepte', tolerance_ecart_pct: 2,
  site_depart_id: null, site_arrivee_id: null, statut: 'ouverte', tonnage_facturable: null, voyages_facturables: null, ouverte_le: '2026-11-02T08:00:00Z',
  actualisee_le: null, cloturee_le: null,
};
const ligne = (id: string, reference: string, anomalies: string[], accepte: number | null) => ({
  id, reconciliation_id: 'r1', trip_id: `t${id}`, reference, date_voyage: '2026-10-05', etat: 'ACCEPTED', tonnage_charge: 40, tonnage_recu: accepte ?? 40,
  tonnage_accepte: accepte, tonnage_base: accepte, ticket: 'PB-1', fiche: 'FR-261005-001', anomalies, decision: null, motif_decision: null,
  ticket_rectifie: anomalies.includes('ticket_rectifie'),
});
const FACTURE = {
  id: 'f1', numero: null, type: 'facture', contrat_id: 'c1', reconciliation_id: null, facture_origine_id: null, objet: 'Transport de bauxite d\'octobre 2026', devise: 'USD',
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
const ficheReconciliation = async (page: Page) => {
  await aller(page, 'Contrats & Finance', 'Réconciliation mensuelle');
  await page.getByRole('button', { name: /^Réconciliation CBG-2026-01/ }).click();
  await expect(page).toHaveURL(/#\/reconciliation\/r1$/);
};

test.describe('Réconciliation et facturation', () => {
  test('reconciliation : lignes a examiner, decision motivee en page, cloture bloquee', async ({ page }) => {
    await simulerApi(page, {
      profiles: PROFIL, contrats: [CONTRAT], sites: [], reconciliations: [REC], factures: [],
      reconciliation_lignes: [ligne('1', 'VYG-001', ['sans_fiche'], 40), ligne('2', 'VYG-002', ['ecart_hors_tolerance'], 37)],
    });
    const decisions = await capturer(page, 'decider_ligne_reconciliation');
    await ficheReconciliation(page);
    await expect(page.getByText('40,00 t', { exact: true })).toBeVisible();
    await expect(page.getByText(/Clôture impossible : 1 ligne\(s\) à examiner/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Clôturer' })).toHaveCount(0);
    await page.getByRole('tab', { name: /Lignes/ }).click();
    await expect(page.getByText('Écart chargé / reçu hors tolérance')).toBeVisible();
    await page.screenshot({ path: 'test-results/reconciliation.png', fullPage: true });
    await page.getByRole('link', { name: 'Facturer VYG-002' }).click();
    const f = page.getByRole('form', { name: /^Déclarer la ligne facturable · VYG-002/ });
    await expect(f.getByRole('button', { name: 'Déclarer la ligne facturable' })).toBeDisabled();
    await f.getByLabel('Motif *').fill('Écart expliqué par la tare du pont');
    await f.getByRole('button', { name: 'Déclarer la ligne facturable' }).click();
    await expect.poll(() => decisions.length).toBe(1);
    expect(decisions[0]).toMatchObject({ p_ligne_id: '2', p_decision: 'facturable', p_motif: 'Écart expliqué par la tare du pont' });
    await expect(page).toHaveURL(/#\/reconciliation\/r1$/);
  });

  test('ticket CBG rectifie : facturation decidee par un approbateur (D-082)', async ({ page }) => {
    await simulerApi(page, {
      profiles: PROFIL, contrats: [CONTRAT], sites: [], reconciliations: [REC], factures: [], tickets_pesee_cbg: [], rectifications_tickets_pesee_cbg: [],
      reconciliation_lignes: [ligne('3', 'VYG-003', ['ticket_rectifie'], 39)],
    });
    const decisions = await capturer(page, 'decider_ligne_reconciliation');
    await ficheReconciliation(page);
    await page.getByRole('tab', { name: /Lignes/ }).click();
    await expect(page.getByText('Ticket CBG rectifié (décision d\'un approbateur distinct)')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Facturer VYG-003' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Approuver la facturation VYG-003' }).click();
    const f = page.getByRole('form', { name: /^Approuver la facturation · VYG-003/ });
    await f.getByLabel('Motif *').fill('Rectification controlee sur le releve CBG');
    await f.getByRole('button', { name: 'Approuver la facturation' }).click();
    await expect.poll(() => decisions.length).toBe(1);
    expect(decisions[0]).toMatchObject({ p_ligne_id: '3', p_decision: 'facturable', p_motif: 'Rectification controlee sur le releve CBG' });
  });

  test('ticket CBG rectifie : sans approbation, pas de lien de facturation, page refusee', async ({ page }) => {
    const CHEF = [{ id: ADMIN, role: 'operations_manager', full_name: 'Chef Test', status: 'active', site_id: null }];
    const DROITS = ['dashboard', 'invoices', 'contracts'].map((module) => ({ role: 'operations_manager', module, can_view: true, can_create: true, can_edit: true, can_delete: false, can_approve: false }));
    await simulerApi(page, {
      profiles: CHEF, role_permissions: DROITS, contrats: [CONTRAT], sites: [], reconciliations: [REC], factures: [],
      reconciliation_lignes: [ligne('3', 'VYG-003', ['ticket_rectifie'], 39)],
    });
    await ficheReconciliation(page);
    await page.getByRole('tab', { name: /Lignes/ }).click();
    await expect(page.getByText('Facturation : approbateur')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Approuver la facturation VYG-003' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Exclure VYG-003' })).toBeVisible();
    // Ouverte par son adresse, la page d'action refuse aussi la decision.
    await page.goto('/#/reconciliation/r1/decider?ligne=3&decision=facturable');
    await expect(page.getByText('Action impossible')).toBeVisible();
    await expect(page.getByText(/approbateur de la facturation/)).toBeVisible();
  });

  test('facture a signer : seul le Directeur voit et utilise la signature', async ({ page }) => {
    const DG = [{ id: ADMIN, role: 'director', full_name: 'Directeur Test', status: 'active', site_id: null }];
    const DROITS = ['dashboard', 'invoices', 'contracts'].map((module) => ({ role: 'director', module, can_view: true, can_create: true, can_edit: true, can_delete: false, can_approve: true }));
    await simulerApi(page, { profiles: DG, role_permissions: DROITS, factures: [FACTURE], facture_lignes: LIGNES_FACTURE, contrats: [CONTRAT], societe: [{ raison_sociale: 'Kogon Mining SARL' }] });
    const actions = await capturer(page, 'avancer_facture');
    await aller(page, 'Contrats & Finance', 'Facturation');
    await expect(page.getByText('1 facture(s) attendent votre signature.')).toBeVisible();
    await expect(page.getByText('454,30 USD').first()).toBeVisible();
    await page.getByRole('button', { name: 'Fiche Facture (brouillon)' }).click();
    await page.getByRole('link', { name: 'Signer', exact: true }).click();
    await page.getByRole('form', { name: 'Signer la facture' }).getByRole('button', { name: 'Signer' }).click();
    await expect.poll(() => actions.length).toBe(1);
    expect(actions[0]).toMatchObject({ p_id: 'f1', p_action: 'signer', p_motif: null });
  });

  test('preparateur : pas de signature, soumission d\'un brouillon, apercu non valable', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL, factures: [{ ...FACTURE, statut: 'brouillon' }], facture_lignes: LIGNES_FACTURE, contrats: [CONTRAT], societe: [{ raison_sociale: 'Kogon Mining SARL' }] });
    const actions = await capturer(page, 'avancer_facture');
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto('/#/invoices/f1');
    const fiche = page.getByRole('article', { name: 'Fiche Facture (brouillon)' });
    await expect(fiche.getByRole('link', { name: 'Signer', exact: true })).toHaveCount(0);
    await fiche.getByRole('tab', { name: /Lignes/ }).click();
    await expect(fiche.getByText('Transport mine - stock (2 voyages)')).toBeVisible();
    await fiche.getByRole('link', { name: 'Aperçu' }).click();
    const doc = page.getByRole('article', { name: 'Document brouillon' });
    await expect(doc).toContainText('Kogon Mining SARL');
    await expect(doc).toContainText('NON VALABLE');
    await expect(doc).toContainText('77 tonne');
    await page.screenshot({ path: 'test-results/facture-apercu.png', fullPage: true });
    await page.getByRole('link', { name: 'Retour à la fiche' }).click();
    await page.getByRole('link', { name: 'Soumettre au DG' }).click();
    await page.getByRole('form', { name: 'Soumettre au Directeur Général' }).getByRole('button', { name: 'Soumettre au DG' }).click();
    await expect.poll(() => actions.length).toBe(1);
    expect(actions[0]).toMatchObject({ p_action: 'soumettre' });
  });

  test('facture emise : chaine de preuve jusqu\'aux tickets CBG, avoir motive', async ({ page }) => {
    await simulerApi(page, {
      profiles: PROFIL, contrats: [CONTRAT],
      factures: [{ ...FACTURE, statut: 'emise', numero: 'FAC-2026-0001', reconciliation_id: 'r1', date_emission: '2026-11-05' }],
      facture_lignes: LIGNES_FACTURE, factures_journal: [{ id: 'j1', facture_id: 'f1', action: 'emettre', motif: null, auteur: null, le: '2026-11-05T09:00:00Z' }],
      reconciliations: [{ ...REC, statut: 'cloturee', tonnage_facturable: 77, voyages_facturables: 2 }],
      reconciliation_lignes: [{ ...ligne('1', 'VYG-001', [], 40), tonnage_base: 40 }, { ...ligne('2', 'VYG-002', ['litige'], 37), decision: 'exclue', motif_decision: 'Litige CBG' }],
      tickets_pesee_cbg: [{ id: 'k1', trip_id: 't1', ticket: 'CBG-9001', brut: 60, tare: 20, net: 40, mesure_le: '2026-10-05T10:00:00Z', document_ref: 'SCAN-12' }],
      encaissements: [], relances: [],
    });
    const avoirs = await capturer(page, 'creer_avoir');
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto('/#/invoices/f1?onglet=relations');
    const voyages = page.getByRole('region', { name: /Voyages facturés/ });
    await expect(voyages).toContainText('VYG-001');
    await expect(voyages).toContainText('CBG-9001 · net 40,00 t · doc SCAN-12');
    await expect(voyages).not.toContainText('VYG-002');
    await page.getByRole('tab', { name: 'Historique' }).click();
    await expect(page.getByRole('region', { name: 'Historique' }).getByText('Émise', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Créer un avoir' }).click();
    const f = page.getByRole('form', { name: 'Créer un avoir' });
    await f.getByLabel(/Montant hors taxes de l'avoir/).fill('50');
    await f.getByLabel('Motif *').fill('Écart de tonnage reconnu');
    await f.getByRole('button', { name: 'Créer l\'avoir' }).click();
    await expect.poll(() => avoirs.length).toBe(1);
    expect(avoirs[0]).toMatchObject({ p_facture_id: 'f1', p_montant_ht: 50, p_motif: 'Écart de tonnage reconnu' });
  });
});
