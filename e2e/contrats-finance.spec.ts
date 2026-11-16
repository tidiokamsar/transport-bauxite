import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi } from './api-simulee';

// Clauses chiffrees, echeances, budgets, export comptable et evaluation du
// loueur (D-065) avec l'API simulee. Les fonctions serveur restent seules
// juges : on verifie ce que l'ecran leur envoie.

const CONTRAT = {
  id: 'c1', reference: 'CBG-2026-01', intitule: 'Transport', nature: 'client', contrepartie: 'CBG', devise: 'USD', date_debut: '2026-01-01',
  date_fin: '2026-12-31', statut: 'actif', delai_paiement_jours: 30, description: null, preavis_jours: 60, renouvellement: 'tacite', renouvellement_duree_mois: 12,
};
const jeuContrat = {
  profiles: PROFIL,
  contrats: [CONTRAT],
  contrat_versions: [{ id: 'v0', contrat_id: 'c1', numero: 0, intitule: 'Contrat initial', date_effet: '2026-01-01', date_signature: null, resume: null, document_ref: null }],
  contrat_engagements: [
    { id: 'e1', version_id: 'v0', indicateur: 'disponibilite', libelle: 'Disponibilité', seuil: 90, unite: '%', sens: 'minimum', periodicite: 'mois', consequence: null, ordre: 1 },
    { id: 'e2', version_id: 'v0', indicateur: 'autre', libelle: 'Clause libre', seuil: 1, unite: 'u', sens: 'minimum', periodicite: 'mois', consequence: null, ordre: 2 },
  ],
  contrat_tarifs: [],
  contrat_clauses: [],
  v_echeances_contrats: [{
    contrat_id: 'c1', reference: 'CBG-2026-01', contrepartie: 'CBG', date_fin: '2026-12-31', preavis_jours: 60, renouvellement: 'tacite', denonce_le: null,
    date_limite_preavis: '2026-11-01', nature_echeance: 'fin', date_cle: '2026-12-31', delai_alerte_jours: 0, date_alerte: '2026-12-31',
    jours_restants: 46, a_signaler: false, echu: false, fin_si_tacite: '2027-12-31',
  }],
  contrats_echeances: [],
  journal_contrats: [],
};

const ouvrir = async (page: Page, rubrique: string) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Contrats & Finance', exact: true }).click();
  await page.getByRole('button', { name: rubrique, exact: true }).click();
};

const capturer = async (page: Page, fonctions: string[], reponses: Record<string, unknown> = {}) => {
  const appels: { fonction: string; corps: Record<string, unknown> }[] = [];
  for (const fonction of fonctions) {
    await page.route(`**/rest/v1/rpc/${fonction}`, (route) => {
      appels.push({ fonction, corps: route.request().postDataJSON() });
      return repondre(route, reponses[fonction] ?? 'ok');
    });
  }
  return appels;
};

test.describe('Contrats et finance (D-065)', () => {
  test('clause chiffree conditionnee par un engagement mesure, echeance affichee', async ({ page }) => {
    await simulerApi(page, jeuContrat);
    const appels = await capturer(page, ['definir_clause']);
    await ouvrir(page, 'Dossier contractuel');
    await expect(page.getByText('Fin le 31/12/2026')).toBeVisible();
    await expect(page.getByText('si renouvellement tacite : fin au 31/12/2027', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: '+ Ajouter une clause' }).click();
    const f = page.getByRole('dialog', { name: 'Nouvelle clause chiffrée' });
    await f.getByLabel('Type *').selectOption('penalite');
    await f.getByLabel('Libellé *').fill('Pénalité de disponibilité');
    await expect(f.getByLabel('Engagement mesuré (condition) *').locator('option')).toHaveText(['Choisir', 'Disponibilité']);
    await f.getByLabel('Engagement mesuré (condition) *').selectOption('e1');
    await f.getByLabel('Déclenchement *').selectOption('non_tenu');
    await f.getByLabel('Base *').selectOption('taux');
    await f.getByLabel('Taux (%) *').fill('120');
    await expect(f.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
    await f.getByLabel('Taux (%) *').fill('5');
    await f.getByLabel('Plafond HT par période (USD)').fill('3000');
    await f.getByRole('button', { name: 'Enregistrer' }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0].corps).toMatchObject({ p_version: 'v0', p_type: 'penalite', p_engagement: 'e1', p_declenchement: 'non_tenu', p_base: 'taux', p_valeur: 5, p_plafond: 3000, p_id: null });
  });

  test('budget depasse signale, nouveau budget, export comptable en CSV', async ({ page }) => {
    await simulerApi(page, {
      profiles: PROFIL,
      natures_depense: [{ id: 'n1', code: 'PIECES', libelle: 'Pièces de rechange', actif: true }],
      sites: [{ id: 's1', name: 'Nimba' }],
      v_suivi_budgets: [{
        id: 'b1', numero: 'BUD-2026-00001', periode_debut: '2026-01-01', periode_fin: '2026-12-31', site_id: 's1', site: 'Nimba', nature_id: 'n1', nature: 'Pièces de rechange',
        nature_code: 'PIECES', devise: 'GNF', montant_ttc: 1000000, note: null, engage_bons: 200000, engage_a_payer: 0, engage: 200000, realise_couts: 900000,
        realise_paiements: 0, realise: 900000, disponible: -100000, consommation_pct: 110, depassement: true, sources_non_visibles: null,
      }],
      v_depenses_budgetaires: [], v_dettes_fournisseurs: [], plan_comptable: [], cost_categories: [], contrats: [], suppliers: [], comptes_tiers: [],
    });
    const appels = await capturer(page, ['definir_budget', 'ecritures_gestion'], {
      ecritures_gestion: [{ type_ecriture: 'facture_emise', date_ecriture: '2026-11-30', piece: 'FAC-2026-0007', piece_liee: null, tiers: 'CBG', compte_tiers: null,
        libelle: 'Transport novembre', montant_ht: 1000, montant_taxe: 0, montant: 1000, devise: 'USD', sens: 'a_recevoir' }],
    });
    await ouvrir(page, 'Budgets et comptabilité');
    await expect(page.getByText('Dépassé (110 %)')).toBeVisible();
    await page.getByRole('button', { name: 'Nouveau budget' }).click();
    const f = page.getByRole('form', { name: 'Budget' });
    await f.getByLabel('Début *').fill('2027-01-01');
    await f.getByLabel('Fin *').fill('2027-12-31');
    await f.getByLabel('Nature de dépense *').selectOption('n1');
    await f.getByLabel('Devise *').fill('gnf');
    await f.getByLabel('Montant TTC *').fill('1 500 000');
    await f.getByRole('button', { name: 'Enregistrer le budget' }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0].corps).toMatchObject({ p_debut: '2027-01-01', p_fin: '2027-12-31', p_nature: 'n1', p_devise: 'GNF', p_montant: 1500000, p_site: null, p_remplace: null });

    await page.getByRole('button', { name: 'Export comptable' }).click();
    await page.getByRole('button', { name: 'Afficher' }).click();
    await expect(page.getByText('non paramétré')).toBeVisible();
    const [telechargement] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter en CSV' }).click()]);
    const contenu = readFileSync(await telechargement.path(), 'utf-8');
    expect(contenu).toContain('type,date,numero_piece,piece_liee,tiers,compte_tiers,libelle,montant_ht,taxe,montant,devise,sens');
    expect(contenu).toContain('Facture émise,2026-11-30,FAC-2026-0007,,CBG,,Transport novembre,1000,0,1000,USD,a_recevoir');
  });

  test('evaluation du loueur : notes saisies a cote des mesures', async ({ page }) => {
    await simulerApi(page, {
      profiles: PROFIL,
      contrats: [{ id: 'c2', reference: 'NEE-2026-01', contrepartie: 'Neemba' }],
      criteres_evaluation_fournisseur: [
        { id: 'k1', libelle: 'Disponibilité', poids: 2, ordre: 1, actif: true, indicateur: 'disponibilite', description: null },
        { id: 'k2', libelle: 'Réactivité', poids: 1, ordre: 2, actif: true, indicateur: null, description: null },
      ],
      v_evaluations_loueur_courantes: [],
    });
    const appels = await capturer(page, ['evaluer_loueur', 'mesures_loueur'], {
      mesures_loueur: [
        { indicateur: 'disponibilite', libelle: 'Disponibilité des engins', valeur: 87.5, unite: '%', echantillon: 3, source: 'immobilisations' },
        { indicateur: 'ecart_facture', libelle: 'Écart des factures contrôlées', valeur: null, unite: '%', echantillon: 0, source: 'contrôle' },
      ],
    });
    await ouvrir(page, 'Évaluation Neemba');
    await expect(page.getByText('mesure : 87,5 %')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Indicateurs mesurés' }).getByText('Sans données')).toBeVisible();
    const f = page.getByRole('form', { name: 'Évaluation du loueur' });
    await f.getByLabel('Note Disponibilité').selectOption('4');
    await expect(f.getByRole('button', { name: 'Enregistrer l\'évaluation' })).toBeDisabled();
    await f.getByLabel('Note Réactivité').selectOption('2');
    await f.getByRole('button', { name: 'Enregistrer l\'évaluation' }).click();
    await expect.poll(() => appels.filter((a) => a.fonction === 'evaluer_loueur').length).toBe(1);
    expect(appels.find((a) => a.fonction === 'evaluer_loueur')?.corps).toMatchObject({
      p_contrat: 'c2', p_notes: [{ critere: 'k1', note: 4 }, { critere: 'k2', note: 2 }], p_motif_correction: null,
    });
  });
});
