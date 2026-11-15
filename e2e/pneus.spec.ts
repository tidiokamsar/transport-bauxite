import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi } from './api-simulee';

// Cycle de vie des pneus (D-052) avec l'API simulee : registre sans
// donnees inventees, alerte de profondeur, montage, annulation motivee.

const base = { brand: 'Michelin', model: 'X Works', dimension: '315/80 R22.5', purchase_price: null, retread_count: 0, max_retreads: null, cout_total: null };
const jeu = {
  profiles: PROFIL,
  v_pneus: [
    { ...base, id: 'p1', tire_number: 'PN-001', status: 'stored', vehicle_id: null, position: null, site_id: 's1', nb_montages: 0, km_parcourus: null, km_incomplet: false, cout_km: null, derniere_profondeur_mm: 16, profondeur_mesuree_le: '2026-11-10T08:00:00Z' },
    { ...base, id: 'p2', tire_number: 'PN-002', status: 'active', vehicle_id: 'v1', position: 'AV G', site_id: null, nb_montages: 1, km_parcourus: 12000, km_incomplet: false, cout_km: 150, derniere_profondeur_mm: 4, profondeur_mesuree_le: '2026-11-12T08:00:00Z' },
  ],
  v_pneus_a_surveiller: [{ id: 'p2', tire_number: 'PN-002', motif: 'profondeur', derniere_profondeur_mm: 4, last_inspection_date: '2026-11-12', installation_date: '2026-10-01' }],
  pneus_operations: [
    { id: 'o2', tire_id: 'p2', type: 'inspection', effectue_le: '2026-11-12T08:00:00Z', saisi_le: '2026-11-12T08:01:00Z', vehicle_id: 'v1', position: 'AV G', position_precedente: null, site_id: null, compteur_km: null, profondeur_mm: 4, pression_bar: null, etat_sortie: null, cout: null, prestataire: null, motif: null, note: null, annule_operation_id: null },
    { id: 'o1', tire_id: 'p2', type: 'montage', effectue_le: '2026-10-01T08:00:00Z', saisi_le: '2026-10-01T08:01:00Z', vehicle_id: 'v1', position: 'AV G', position_precedente: null, site_id: 's1', compteur_km: 1000, profondeur_mm: 16, pression_bar: 8.5, etat_sortie: null, cout: null, prestataire: null, motif: null, note: null, annule_operation_id: null },
  ],
  vehicles: [{ id: 'v1', registration: 'CAM-01' }],
  sites: [{ id: 's1', name: 'Dépôt Nimba' }],
};

const ouvrir = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Pneus', exact: true }).click();
};

test.describe('Pneus', () => {
  test('registre, alerte de profondeur, montage et annulation motivee', async ({ page }) => {
    await simulerApi(page, jeu);
    const appels: { fonction: string; corps: Record<string, unknown> }[] = [];
    for (const fonction of ['monter_pneu', 'annuler_operation_pneu']) {
      await page.route(`**/rest/v1/rpc/${fonction}`, (route) => { appels.push({ fonction, corps: route.request().postDataJSON() }); return repondre(route, 'ok'); });
    }
    await ouvrir(page);
    await expect(page.getByText('Profondeur 4 mm')).toBeVisible();
    await expect(page.getByText('Jamais monté')).toBeVisible();
    await expect(page.getByText('CAM-01 · AV G')).toBeVisible();

    await page.getByRole('button', { name: 'Monter PN-001' }).click();
    const f = page.getByRole('form', { name: 'Opération pneu' });
    await f.getByLabel('Engin *').selectOption('v1');
    await f.getByLabel('Position *').fill(' av  d ');
    await f.getByLabel('Compteur engin (km)').fill('15200');
    await page.getByRole('button', { name: 'Valider l\'opération' }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ fonction: 'monter_pneu', corps: { p_tire: 'p1', p_vehicle: 'v1', p_position: 'AV D', p_km: 15200 } });

    await page.getByRole('button', { name: 'Historique PN-002' }).click();
    page.once('dialog', (d) => d.accept('Mesure erronée'));
    await page.getByRole('button', { name: 'Annuler Inspection' }).click();
    await expect.poll(() => appels.length).toBe(2);
    expect(appels[1]).toMatchObject({ fonction: 'annuler_operation_pneu', corps: { p_operation: 'o2', p_motif: 'Mesure erronée' } });
  });
});
