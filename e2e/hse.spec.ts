import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi } from './api-simulee';

// HSE (D-054) avec l'API simulee : controle avant depart (resultat
// calcule, observation obligatoire), incident et action corrective.

const jeu = {
  profiles: PROFIL,
  points_controle_depart: [
    { id: 'pt1', libelle: 'Freins', categorie: 'freinage', bloquant: true, ordre: 1, actif: true },
    { id: 'pt2', libelle: 'Rétroviseurs', categorie: 'securite', bloquant: false, ordre: 2, actif: true },
  ],
  controles_depart: [],
  vehicles: [{ id: 'v1', registration: 'CAM-01' }],
  drivers: [{ id: 'c1', name: 'Mamadou Camara' }],
  sites: [{ id: 's1', name: 'Mine Nimba' }],
  incidents: [{ id: 'i1', numero: 'INC-2026-00003', type: 'presque_accident', severity: 'moderate', description: 'Freinage tardif', incident_time: '2026-11-14T08:00:00Z',
    vehicle_id: 'v1', driver_id: null, trip_id: null, site_id: null, lieu: null, estimated_cost: null, statut: 'en_analyse', cause: 'Plaquettes usées', conclusion: null }],
  actions_correctives: [{ id: 'a1', incident_id: 'i1', libelle: 'Remplacer les plaquettes', responsable: 'Atelier', echeance: '2026-11-10', statut: 'ouverte', preuve: null, motif_annulation: null }],
  v_actions_correctives_en_retard: [{ id: 'a1', numero: 'INC-2026-00003', libelle: 'Remplacer les plaquettes', responsable: 'Atelier', echeance: '2026-11-10', jours_de_retard: 5 }],
};

const ouvrir = async (page: Page, ecran: string) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'RH & Sécurité', exact: true }).click();
  await page.getByRole('button', { name: ecran, exact: true }).click();
};

test.describe('HSE', () => {
  test('controle avant depart : point bloquant non conforme, observation obligatoire', async ({ page }) => {
    await simulerApi(page, jeu);
    const appels: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/enregistrer_controle_depart', (route) => { appels.push(route.request().postDataJSON()); return repondre(route, 'ok'); });
    await ouvrir(page, 'Contrôles avant départ');
    await page.getByRole('button', { name: 'Contrôle', exact: true }).click();
    const f = page.getByRole('form', { name: 'Saisie contrôle' });
    await f.getByLabel('Camion *').selectOption('v1');
    await page.getByLabel('Résultat Freins').selectOption('non_conforme');
    await page.getByLabel('Résultat Rétroviseurs').selectOption('conforme');
    await expect(page.getByRole('button', { name: 'Enregistrer le contrôle' })).toBeDisabled();
    await page.getByLabel('Observation Freins').fill('Pédale molle');
    await expect(page.locator('p', { hasText: 'Résultat :' })).toContainText('Non conforme');
    await page.getByRole('button', { name: 'Enregistrer le contrôle' }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ p_vehicle: 'v1', p_points: [{ point: 'pt1', resultat: 'non_conforme', observation: 'Pédale molle' }, { point: 'pt2', resultat: 'conforme', observation: null }] });
  });

  test('incident : action en retard signalee, realisation avec preuve', async ({ page }) => {
    await simulerApi(page, jeu);
    const appels: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/solder_action_corrective', (route) => { appels.push(route.request().postDataJSON()); return repondre(route, 'ok'); });
    await ouvrir(page, 'Incidents');
    await expect(page.getByText('5 j de retard')).toBeVisible();
    await page.getByRole('button', { name: 'Ouvrir INC-2026-00003' }).click();
    page.once('dialog', (d) => d.accept('OT-2026-0042'));
    await page.getByRole('button', { name: 'Réaliser Remplacer les plaquettes' }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ p_action: 'a1', p_realisee: true, p_texte: 'OT-2026-0042' });
  });
});
