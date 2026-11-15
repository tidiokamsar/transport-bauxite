import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi } from './api-simulee';

// Moyens generaux et patrimoine (D-060) avec l'API simulee : registre sans
// valeur inventee, affectation et annulation par le serveur, plan
// d'amortissement seulement si la duree est saisie, inventaire physique.

const bien = {
  marque: null, modele: null, numero_serie: null, immatriculation: null, fournisseur_id: null, note: null,
  date_acquisition: null, valeur_acquisition: null, duree_amortissement_mois: null, beneficiaire_type: null, beneficiaire: null,
  etat_physique: null, etat_constate_le: null, mois_amortis: null, amortissement_cumule: null, valeur_nette: null, fin_amortissement: null,
};
const op = { site_origine_id: null, beneficiaire_type: null, beneficiaire: null, etat_physique: null, cout: null, prestataire: null, reference_piece: null, motif: null, note: null, annule_operation_id: null };
const jeu = {
  profiles: PROFIL,
  v_biens: [
    { ...bien, id: 'b1', numero_inventaire: 'PC-001', categorie: 'informatique', designation: 'Ordinateur portable', statut: 'en_stock', site_id: 's1' },
    { ...bien, id: 'b2', numero_inventaire: 'MOB-001', categorie: 'mobilier', designation: 'Bureau direction', statut: 'remis', site_id: 's1',
      beneficiaire_type: 'service', beneficiaire: 'Service comptable', etat_physique: 'bon', etat_constate_le: '2026-04-01T08:00:00Z',
      date_acquisition: '2026-04-01', valeur_acquisition: 3600000, duree_amortissement_mois: 36, mois_amortis: 7, amortissement_cumule: 700000,
      valeur_nette: 2900000, fin_amortissement: '2029-04-01' },
  ],
  biens_operations: [
    { ...op, id: 'o2', bien_id: 'b2', type: 'remise', effectue_le: '2026-04-03T08:00:00Z', saisi_le: '2026-04-03T08:01:00Z', site_id: 's1', beneficiaire_type: 'service', beneficiaire: 'Service comptable', reference_piece: 'PV-7' },
    { ...op, id: 'o1', bien_id: 'b2', type: 'entree', effectue_le: '2026-04-01T08:00:00Z', saisi_le: '2026-04-01T08:01:00Z', site_id: 's1', etat_physique: 'bon' },
  ],
  v_inventaires_biens: [{ id: 'i1', site_id: 's1', libelle: 'Inventaire annuel 2026', ouvert_le: '2026-11-14T08:00:00Z', cloture_le: null, ouvert: true,
    nb_attendus: 2, nb_constates: 0, nb_manquants: 2, nb_hors_site: 0, nb_reformes: 0, nb_non_references: 0 }],
  inventaires_biens_lignes: [],
  v_inventaires_biens_ecarts: [{ inventaire_id: 'i1', ligne_id: null, ecart: 'manquant', bien_id: 'b1', numero: 'PC-001', designation: 'Ordinateur portable', provisoire: true }],
  sites: [{ id: 's1', name: 'Siège Conakry' }, { id: 's2', name: 'Site de Nimba' }],
  suppliers: [],
};

const ouvrir = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Stocks & Achats', exact: true }).click();
  await page.getByRole('button', { name: 'Moyens généraux et patrimoine', exact: true }).click();
};

const espionner = async (page: Page, fonctions: string[]) => {
  const appels: { fonction: string; corps: Record<string, unknown> }[] = [];
  for (const fonction of fonctions) {
    await page.route(`**/rest/v1/rpc/${fonction}`, (route) => { appels.push({ fonction, corps: route.request().postDataJSON() }); return repondre(route, 'ok'); });
  }
  return appels;
};

test.describe('Moyens generaux', () => {
  test('registre, affectation, fiche avec plan d\'amortissement et annulation motivee', async ({ page }) => {
    await simulerApi(page, jeu);
    const appels = await espionner(page, ['affecter_bien', 'annuler_operation_bien']);
    await ouvrir(page);
    const ligne = page.getByRole('row').filter({ hasText: 'PC-001' });
    await expect(ligne.getByText('Sans données')).toHaveCount(2);
    await expect(page.getByText('Service comptable (service)')).toBeVisible();

    await page.getByRole('button', { name: 'Affecter PC-001' }).click();
    const f = page.getByRole('form', { name: 'Opération bien' });
    await f.getByLabel('Type de bénéficiaire *').selectOption('personne');
    await f.getByLabel('Nom du bénéficiaire *').fill('  A. Camara ');
    await page.getByRole('button', { name: 'Valider l\'opération' }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ fonction: 'affecter_bien', corps: { p_bien: 'b1', p_beneficiaire_type: 'personne', p_beneficiaire: 'A. Camara' } });

    await page.getByRole('button', { name: 'Fiche MOB-001' }).click();
    const plan = page.getByRole('table', { name: 'Plan d\'amortissement' });
    await expect(plan.getByRole('row')).toHaveCount(5);
    await expect(plan.getByRole('row').filter({ hasText: '2026' })).toContainText('800');
    await expect(page.getByRole('button', { name: 'Annuler Entrée au registre' })).toHaveCount(0);
    page.once('dialog', (d) => d.accept('Remise saisie par erreur'));
    await page.getByRole('button', { name: 'Annuler Remise' }).click();
    await expect.poll(() => appels.length).toBe(2);
    expect(appels[1]).toMatchObject({ fonction: 'annuler_operation_bien', corps: { p_operation: 'o2', p_motif: 'Remise saisie par erreur' } });
  });

  test('inventaire physique : ecart provisoire, constat et cloture', async ({ page }) => {
    await simulerApi(page, jeu);
    const appels = await espionner(page, ['constater_inventaire_bien', 'cloturer_inventaire_biens']);
    await ouvrir(page);
    await page.getByRole('tab', { name: 'Inventaires physiques' }).click();
    await expect(page.getByText('Ouverte (chiffres provisoires)')).toBeVisible();
    await page.getByRole('button', { name: 'Détail Inventaire annuel 2026' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: 'Manquant' })).toContainText('PC-001');

    const f = page.getByRole('form', { name: 'Constat inventaire' });
    await f.getByLabel('Numéro d\'inventaire lu').fill(' mob-001 ');
    await f.getByLabel('État constaté').selectOption('bon');
    await page.getByRole('button', { name: 'Enregistrer le constat' }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ fonction: 'constater_inventaire_bien', corps: { p_inventaire: 'i1', p_numero: 'MOB-001', p_etat: 'bon' } });

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Clôturer la campagne' }).click();
    await expect.poll(() => appels.length).toBe(2);
    expect(appels[1]).toMatchObject({ fonction: 'cloturer_inventaire_biens', corps: { p_inventaire: 'i1' } });
  });
});
