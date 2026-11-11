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

  test('relance d\'une creance echue et lettre imprimable', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL, v_creances: [CREANCE], contrats: [CONTRAT], societe: [{ raison_sociale: 'Kogon Mining SARL', adresse: 'Conakry' }] });
    const relances = await capturer(page, 'relancer', 1);
    await aller(page, 'Recouvrement');
    await expect(page.getByText('(7 j de retard)')).toBeVisible();
    await page.getByRole('button', { name: 'Relancer FAC-2026-0001' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();
    await expect.poll(() => relances.length).toBe(1);
    const lettre = page.getByRole('article', { name: 'Lettre de relance' });
    await expect(lettre).toContainText('Rappel · facture FAC-2026-0001');
    await expect(lettre).toContainText('400,00 USD');
    await page.screenshot({ path: 'test-results/lettre-relance.png', fullPage: true });
  });

  test('encaissement : reste du propose, montant envoye', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL, v_creances: [CREANCE], contrats: [CONTRAT] });
    const envois = await capturer(page, 'enregistrer_encaissement', 'e1');
    await aller(page, 'Recouvrement');
    await page.getByRole('button', { name: 'Encaisser FAC-2026-0001' }).click();
    const f = page.getByRole('dialog');
    await f.getByLabel('Référence bancaire').fill('VIR-2026-118');
    await f.getByRole('button', { name: 'Enregistrer' }).click();
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
