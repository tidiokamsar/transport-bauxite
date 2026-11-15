import { expect, test, type Page } from '@playwright/test';
import { PROFIL, SITE_DEPOT, SITE_MINE, repondre, simulerApi } from './api-simulee';

// Kilometrage (D-043) avec l'API simulee : distance mesuree depuis les
// releves, validation reprenant la mesure (sans motif), motif exige quand la
// distance s'en ecarte, saisie d'un releve manquant.

const jour = new Date().toISOString().slice(0, 10);
const VOYAGES = [
  { id: 't1', reference: 'V-001', planned_date: jour, etat: 'DELIVERED', vehicle_id: 'v1', departure_site_id: SITE_MINE, arrival_site_id: SITE_DEPOT },
  { id: 't2', reference: 'V-002', planned_date: jour, etat: 'DELIVERED', vehicle_id: 'v1', departure_site_id: SITE_MINE, arrival_site_id: SITE_DEPOT },
];
const RELEVES = [
  { id: 'r1', trip_id: 't1', moment: 'depart_charge', valeur_km: 10000, releve_le: `${jour}T06:00:00Z`, saisi_par: 'autre' },
  { id: 'r2', trip_id: 't1', moment: 'arrivee_depot', valeur_km: 10052, releve_le: `${jour}T08:00:00Z`, saisi_par: 'autre' },
  { id: 'r3', trip_id: 't1', moment: 'fin_rotation', valeur_km: 10105, releve_le: `${jour}T10:00:00Z`, saisi_par: 'autre' },
];
const jeu = {
  profiles: PROFIL, trips: [], v_releves_compteur: RELEVES, v_distances_voyage: [],
  distances_reference: [{ id: 'd1', site_depart_id: SITE_MINE, site_arrivee_id: SITE_DEPOT, distance_km: 52, source: 'Relevé de piste' }],
  vehicles: [{ id: 'v1', registration: 'RC-1001' }], sites: [{ id: SITE_MINE, name: 'Mine de Nimba' }, { id: SITE_DEPOT, name: 'Dépôt CBG' }],
};

const ouvrir = async (page: Page) => {
  // Les voyages ne sont servis qu'a la requete de l'ecran (filtre de periode) ;
  // le tableau de bord recoit une liste vide.
  await page.route('**/rest/v1/trips*', (route) =>
    route.request().url().includes('planned_date=gte') ? repondre(route, VOYAGES, `0-1/2`) : route.fallback());
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Kilométrage', exact: true }).click();
};

test.describe('Kilometrage des voyages', () => {
  test('mesure depuis les releves, validation sans motif quand elle reprend la mesure', async ({ page }) => {
    await simulerApi(page, jeu);
    const validations: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/valider_distance_voyage', (route) => { validations.push(route.request().postDataJSON()); return repondre(route, 1); });
    await ouvrir(page);
    await expect(page.getByText('2 voyage(s) livré(s) sur la période', { exact: false })).toBeVisible();
    await expect(page.getByText('retour 53 km')).toBeVisible();
    await page.getByRole('button', { name: 'Valider la distance V-001' }).click();
    await page.getByRole('button', { name: 'Valider la distance', exact: true }).click();
    await expect.poll(() => validations.length).toBe(1);
    expect(validations[0]).toMatchObject({ p_trip_id: 't1', p_charge_km: 52, p_retour_km: 53, p_motif: null });
  });

  test('sans mesure : reference proposee, motif obligatoire ; releve manquant saisi', async ({ page }) => {
    await simulerApi(page, jeu);
    const releves: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/saisir_releve_compteur', (route) => { releves.push(route.request().postDataJSON()); return repondre(route, 'r9'); });
    await ouvrir(page);
    await page.getByRole('button', { name: 'Valider la distance V-002' }).click();
    const valider = page.getByRole('button', { name: 'Valider la distance', exact: true });
    await expect(page.getByLabel('Trajet chargé validé (km) *')).toHaveValue('52');
    await expect(valider).toBeDisabled();
    await page.getByLabel('Motif *').fill('Compteur hors service, référence retenue');
    await expect(valider).toBeEnabled();
    await page.getByRole('button', { name: 'Fermer' }).click();

    await page.getByRole('button', { name: 'Relevés V-002' }).click();
    await page.getByLabel('Départ chargé compteur').fill('20000');
    await page.getByRole('button', { name: 'Enregistrer' }).first().click();
    await expect.poll(() => releves.length).toBe(1);
    expect(releves[0]).toMatchObject({ p_vehicle_id: 'v1', p_trip_id: 't2', p_moment: 'depart_charge', p_valeur: 20000, p_source: 'fiche' });
  });
});
