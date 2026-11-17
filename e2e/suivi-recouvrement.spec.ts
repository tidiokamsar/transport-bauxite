import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi } from './api-simulee';

// Phase 4 (D-031) avec l'API simulee : engagements compares au realise,
// relance et lettre, encaissement, tableau de bord du poste.

const CONTRAT = { id: 'c1', reference: 'NEEMBA-2026-01', contrepartie: 'Neemba', intitule: 'Location d\'engins' };
const CREANCE = {
  id: 'f1', numero: 'FAC-2026-0001', contrat_id: 'c1', devise: 'USD', date_emission: '2026-10-05', date_echeance: '2026-11-04',
  montant_ttc: 1000, avoirs: 0, du: 1000, encaisse: 600, reste: 400, jours_retard: 7, dernier_encaissement: '2026-10-20',
  derniere_relance_niveau: null, derniere_relance_le: null,
};

const aller = async (page: Page, ecran: string) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Contrats & Finance', exact: true }).click();
  await page.getByRole('button', { name: ecran, exact: true }).click();
};
const capturer = async (page: Page, fonction: string, reponse: unknown) => {
  const corps: Record<string, unknown>[] = [];
  await page.route(`**/rest/v1/rpc/${fonction}`, (route) => { corps.push(route.request().postDataJSON()); return repondre(route, reponse); });
  return corps;
};

test.describe('Suivi et recouvrement', () => {
  test('engagements : tenu, non tenu, non mesurable ; rapport fige', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL, contrats: [CONTRAT], rapports_performance: [], societe: [{ raison_sociale: 'Kogon Mining SARL' }] });
    await capturer(page, 'comparer_engagements', [
      { engagement_id: 'e1', indicateur: 'temps_chargement', libelle: 'Temps de chargement', seuil: 15, unite: 'min', sens: 'maximum', periodicite: 'mois', consequence: null, realise: 14.5, echantillon: 120, conforme: true },
      { engagement_id: 'e2', indicateur: 'taux_remplissage', libelle: 'Remplissage', seuil: 95, unite: '%', sens: 'minimum', periodicite: 'mois', consequence: 'Pénalité', realise: 92.5, echantillon: 118, conforme: false },
      { engagement_id: 'e3', indicateur: 'autre', libelle: 'Clause libre', seuil: 1, unite: 'u', sens: 'minimum', periodicite: 'mois', consequence: null, realise: null, echantillon: null, conforme: null },
    ]);
    const generation = await capturer(page, 'generer_rapport_performance', 'r1');
    await aller(page, 'Engagements et rapport');
    await expect(page.getByText('1 tenu(s), 1 non tenu(s)')).toBeVisible();
    await expect(page.getByText('Non mesurable')).toBeVisible();
    await page.getByRole('button', { name: 'Figer le rapport du mois' }).click();
    await expect.poll(() => generation.length).toBe(1);
    expect(generation[0]).toMatchObject({ p_contrat_id: 'c1' });
  });

  test('rapport de performance : apercu en pleine page, remise saisie dans une page', async ({ page }) => {
    const rapport = {
      id: 'r1', contrat_id: 'c1', periode_debut: '2026-10-01', periode_fin: '2026-10-31', statut: 'brouillon', genere_le: '2026-11-02T08:00:00Z', genere_par: null,
      remis_le: null, remis_a: null, remis_par: null,
      contenu: { engagements: [{ engagement_id: 'e1', indicateur: 'autre', libelle: 'Clause libre', seuil: 1, unite: 'u', sens: 'minimum', periodicite: 'mois', consequence: null, realise: null, echantillon: null, conforme: null }],
        reconciliations: [], factures: [] },
    };
    await simulerApi(page, { profiles: PROFIL, contrats: [CONTRAT], rapports_performance: [rapport], societe: [{ raison_sociale: 'Kogon Mining SARL' }] });
    await capturer(page, 'comparer_engagements', []);
    const remises = await capturer(page, 'marquer_rapport_remis', null);
    await aller(page, 'Engagements et rapport');
    await page.getByRole('link', { name: 'Aperçu du rapport 2026-10-01' }).click();
    await expect(page).toHaveURL(/#\/engagements\/r1\/apercu$/);
    await expect(page.getByRole('article', { name: 'Rapport de performance' })).toContainText('BROUILLON');
    await page.getByRole('link', { name: 'Retour à la fiche' }).click();
    const fiche = page.getByRole('article', { name: /^Fiche Rapport/ });
    await fiche.getByRole('link', { name: 'Marquer remis' }).click();
    const f = page.getByRole('form', { name: 'Marquer le rapport remis' });
    await expect(f.getByRole('button', { name: 'Marquer remis' })).toBeDisabled();
    await f.getByLabel('Remis à (destinataire) *').fill('Direction CBG');
    await f.getByRole('button', { name: 'Marquer remis' }).click();
    await expect.poll(() => remises.length).toBe(1);
    expect(remises[0]).toMatchObject({ p_id: 'r1', p_destinataire: 'Direction CBG' });
    await expect(page.getByRole('status').filter({ hasText: 'Rapport marqué remis.' })).toBeVisible();
  });

  test('relance d\'une creance echue et lettre imprimable', async ({ page }) => {
    await simulerApi(page, {
      profiles: PROFIL, v_creances: [CREANCE], contrats: [CONTRAT], encaissements: [],
      relances: [{ id: 'r1', facture_id: 'f1', niveau: 1, date_relance: '2026-11-12', canal: 'email', note: null, auteur: null, le: '2026-11-12T09:00:00Z' }],
      societe: [{ raison_sociale: 'Kogon Mining SARL', adresse: 'Conakry' }],
    });
    const relances = await capturer(page, 'relancer', 1);
    await aller(page, 'Recouvrement');
    await expect(page.getByText('(7 j de retard)')).toBeVisible();
    await page.getByRole('button', { name: 'Créance FAC-2026-0001' }).click();
    await page.getByRole('link', { name: 'Rappel', exact: true }).click();
    await page.getByRole('form', { name: 'Rappel · FAC-2026-0001' }).getByRole('button', { name: 'Enregistrer la relance' }).click();
    await expect.poll(() => relances.length).toBe(1);
    expect(relances[0]).toMatchObject({ p_facture_id: 'f1', p_canal: 'email' });
    // La lettre du niveau enregistre s'ouvre depuis les relances de la fiche.
    await page.getByRole('tab', { name: 'Encaissements et relances' }).click();
    await page.getByRole('region', { name: 'Relances' }).getByRole('link', { name: 'Rappel' }).click();
    const lettre = page.getByRole('article', { name: 'Lettre de relance' });
    await expect(lettre).toContainText('Rappel · facture FAC-2026-0001');
    await expect(lettre).toContainText('400,00 USD');
    await page.screenshot({ path: 'test-results/lettre-relance.png', fullPage: true });
  });

  test('encaissement : reste du propose, montant envoye', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL, v_creances: [CREANCE], contrats: [CONTRAT], encaissements: [], relances: [] });
    const envois = await capturer(page, 'enregistrer_encaissement', 'e1');
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto('/#/recouvrement/f1');
    await page.getByRole('link', { name: 'Encaisser' }).click();
    const f = page.getByRole('form', { name: 'Encaissement · FAC-2026-0001' });
    await expect(f.getByLabel(/^Montant \*/)).toHaveValue('400');
    await f.getByLabel('Référence bancaire').fill('VIR-2026-118');
    await f.getByRole('button', { name: 'Enregistrer l\'encaissement' }).click();
    await expect.poll(() => envois.length).toBe(1);
    expect(envois[0]).toMatchObject({ p_facture_id: 'f1', p_montant: 400, p_mode: 'virement', p_reference: 'VIR-2026-118' });
  });

  test('tableau de bord du poste : indicateurs et phases a venir', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL, reconciliations: [], factures: [], rapports_performance: [], fiches_terrain: [] });
    await capturer(page, 'indicateurs_charge_contrats', [{
      delai_emission_jours: 4.5, factures_emises: 3, ecart_tonnage_pct: 1.2, reconciliations_closes: 3, delai_rapport_jours: null, rapports_remis: 0,
      delai_recouvrement_jours: 38, factures_soldees: 2, creances_en_retard: 1, montant_en_retard: 400, factures_a_signer: 1,
      ecarts_detectes: 1000, ecarts_recouvres: 600, factures_fournisseur_controlees: 2,
    }]);
    await aller(page, 'Mon tableau de bord');
    await expect(page.getByText('4,5 j')).toBeVisible();
    await expect(page.getByText('1 000 / 600')).toBeVisible();
    await expect(page.getByText('Phase 6')).toBeVisible();
    await expect(page.getByText('1 facture(s) attendent la signature du DG.', { exact: false })).toBeVisible();
    await expect(page.getByText('Réconciliation du mois clôturée')).toBeVisible();
  });
});
