import { expect, test, type Page } from '@playwright/test';
import { ADMIN, PROFIL, repondre, simulerApi } from './api-simulee';

// Interventions du loueur (D-049) avec l'API simulee, aux pages standard
// (D-090) : retard signale, validation de la remise en service en page
// d'action, demande en pleine page depuis une immobilisation, refus de la
// decision par la personne qui a saisi la fin.

const ilYa = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const INTERVENTION = {
  id: 'i1', numero: 'INT-2026-00001', immobilisation_id: 'm2', vehicle_id: 'v2', statut: 'terminee', demande_le: ilYa(11), canal: 'courriel',
  reference_demande: 'KM/MNT/001', description: 'Moteur', delai_contractuel_heures: 4, technicien: 'Technicien Neemba',
  prise_en_charge_le: ilYa(5), fin_le: ilYa(1), rapport: 'Injecteur remplacé', remise_validee_le: null, demande_par: null, fin_saisie_par: null, valide_par: null,
  delai_heures: 6, en_retard: true, duree_intervention_heures: 4,
};
const jeu = {
  profiles: PROFIL,
  immobilisations: [
    { id: 'm1', vehicle_id: 'v1', debut: ilYa(10), cause: 'panne', imputation: 'loueur', description: 'Fuite hydraulique', statut: 'ouverte' },
    { id: 'm2', vehicle_id: 'v2', debut: ilYa(12), cause: 'panne', imputation: 'loueur', description: 'Moteur', statut: 'ouverte' },
  ],
  v_interventions_loueur: [INTERVENTION],
  interventions_pieces: [{ id: 'p1', intervention_id: 'i1', designation: 'Injecteur', reference: 'INJ-7', quantite: 1, fournie_par: 'loueur' }],
  interventions_journal: [{ id: 1, intervention_id: 'i1', action: 'demande', etat_avant: null, etat_apres: 'demandee', motif: null, auteur: null, cree_le: ilYa(11) }],
  vehicles: [{ id: 'v1', registration: 'CHG-01' }, { id: 'v2', registration: 'PEL-01' }],
};

const ouvrir = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Maintenance', exact: true }).click();
  await page.getByRole('button', { name: 'Interventions Neemba', exact: true }).click();
};

test.describe('Interventions du loueur', () => {
  test('retard signale, remise en service validee, demande depuis une immobilisation', async ({ page }) => {
    await simulerApi(page, jeu);
    const appels: { fonction: string; corps: Record<string, unknown> }[] = [];
    for (const fonction of ['demander_intervention_loueur', 'valider_remise_en_service']) {
      await page.route(`**/rest/v1/rpc/${fonction}`, (route) => { appels.push({ fonction, corps: route.request().postDataJSON() }); return repondre(route, 'ok'); });
    }
    await ouvrir(page);
    await expect(page.getByRole('table').getByText('Délai contractuel dépassé')).toBeVisible();
    await page.getByRole('button', { name: 'Fiche INT-2026-00001' }).click();
    await expect(page).toHaveURL(/#\/interventions-loueur\/i1$/);
    const fiche = page.getByRole('article', { name: 'Fiche INT-2026-00001 · PEL-01' });
    await expect(fiche.getByText('Injecteur remplacé')).toBeVisible();
    await fiche.getByRole('tab', { name: /Pièces remplacées/ }).click();
    await expect(fiche.getByText('INJ-7')).toBeVisible();

    await fiche.getByRole('link', { name: 'Valider la remise en service' }).click();
    const decision = page.getByRole('form', { name: 'Valider la remise en service' });
    await decision.getByRole('button', { name: 'Valider la remise en service' }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ fonction: 'valider_remise_en_service', corps: { p_id: 'i1', p_valider: true } });

    await page.goto('/#/interventions-loueur');
    await page.getByRole('link', { name: 'Demander l\'intervention CHG-01' }).click();
    const f = page.getByRole('form', { name: 'Demande d\'intervention' });
    await expect(f.getByLabel('Description *')).toHaveValue('Fuite hydraulique');
    await f.getByLabel('Délai contractuel d\'intervention (h)').fill('4');
    await page.getByRole('button', { name: 'Enregistrer la demande' }).click();
    await expect.poll(() => appels.length).toBe(2);
    expect(appels[1]).toMatchObject({ fonction: 'demander_intervention_loueur', corps: { p_immobilisation_id: 'm1', p_canal: 'courriel', p_description: 'Fuite hydraulique', p_delai_contractuel_heures: 4 } });
  });

  test('refus motive exige ; decision refusee a la personne qui a saisi la fin', async ({ page }) => {
    await simulerApi(page, jeu);
    const appels: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/valider_remise_en_service', (route) => { appels.push(route.request().postDataJSON()); return repondre(route, 'prise_en_charge'); });
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto('/#/interventions-loueur/i1/refuser');
    const refus = page.getByRole('form', { name: 'Refuser la remise en service' });
    const bouton = refus.getByRole('button', { name: 'Refuser la remise en service' });
    await expect(bouton).toBeDisabled();
    await refus.getByLabel('Motif *').fill('Fuite persistante');
    await bouton.click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ p_id: 'i1', p_valider: false, p_motif: 'Fuite persistante' });
  });

  test('la personne qui a saisi la fin ne decide pas de la remise en service', async ({ page }) => {
    await simulerApi(page, { ...jeu, v_interventions_loueur: [{ ...INTERVENTION, fin_saisie_par: ADMIN }] });
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto('/#/interventions-loueur/i1/valider');
    await expect(page.getByText('Action impossible')).toBeVisible();
    await expect(page.getByText(/autre personne que celle qui a saisi la fin/)).toBeVisible();
  });
});
