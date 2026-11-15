import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi } from './api-simulee';

// Interventions du loueur (D-049) avec l'API simulee : demande depuis une
// immobilisation, retard signale, validation de la remise en service.

const ilYa = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const jeu = {
  profiles: PROFIL,
  immobilisations: [
    { id: 'm1', vehicle_id: 'v1', debut: ilYa(10), cause: 'panne', imputation: 'loueur', description: 'Fuite hydraulique', statut: 'ouverte' },
    { id: 'm2', vehicle_id: 'v2', debut: ilYa(12), cause: 'panne', imputation: 'loueur', description: 'Moteur', statut: 'ouverte' },
  ],
  v_interventions_loueur: [{
    id: 'i1', numero: 'INT-2026-00001', immobilisation_id: 'm2', vehicle_id: 'v2', statut: 'terminee', demande_le: ilYa(11), canal: 'courriel',
    reference_demande: 'KM/MNT/001', description: 'Moteur', delai_contractuel_heures: 4, technicien: 'Technicien Neemba',
    prise_en_charge_le: ilYa(5), fin_le: ilYa(1), rapport: 'Injecteur remplacé', delai_heures: 6, en_retard: true, duree_intervention_heures: 4,
  }],
  vehicles: [{ id: 'v1', registration: 'CHG-01' }, { id: 'v2', registration: 'PEL-01' }],
};

const ouvrir = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Maintenance', exact: true }).click();
  await page.getByRole('button', { name: 'Interventions Neemba', exact: true }).click();
};

test.describe('Interventions du loueur', () => {
  test('demande depuis une immobilisation, retard signale, remise en service validee', async ({ page }) => {
    await simulerApi(page, jeu);
    const appels: { fonction: string; corps: Record<string, unknown> }[] = [];
    for (const fonction of ['demander_intervention_loueur', 'valider_remise_en_service']) {
      await page.route(`**/rest/v1/rpc/${fonction}`, (route) => { appels.push({ fonction, corps: route.request().postDataJSON() }); return repondre(route, 'ok'); });
    }
    await ouvrir(page);
    await expect(page.getByText('Délai contractuel dépassé')).toBeVisible();
    await page.getByRole('button', { name: 'Valider la remise en service INT-2026-00001' }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ fonction: 'valider_remise_en_service', corps: { p_id: 'i1', p_valider: true } });

    await page.getByRole('button', { name: 'Demander l\'intervention CHG-01' }).click();
    const f = page.getByRole('form', { name: 'Demande d\'intervention' });
    await f.getByLabel('Délai contractuel d\'intervention (h)').fill('4');
    await f.getByRole('button', { name: 'Enregistrer la demande' }).click();
    await expect.poll(() => appels.length).toBe(2);
    expect(appels[1]).toMatchObject({ fonction: 'demander_intervention_loueur', corps: { p_immobilisation_id: 'm1', p_canal: 'courriel', p_description: 'Fuite hydraulique', p_delai_contractuel_heures: 4 } });
  });
});
