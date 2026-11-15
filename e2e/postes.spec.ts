import { expect, test, type Page } from '@playwright/test';
import { PROFIL, SITE_MINE, repondre, simulerApi } from './api-simulee';

// Postes de travail (D-048) avec l'API simulee : ouverture, passation
// affichee, pointage d'absence motive, cloture avec consignes.

const jour = new Date().toISOString().slice(0, 10);
const POSTE = {
  id: 'p1', date_poste: jour, shift_id: 's1', site_id: SITE_MINE, responsable_id: null, statut: 'ouvert',
  consignes_recues: 'Piste nord dégradée', consignes_sortie: null, rapport: null, bilan: null, ouvert_le: `${jour}T06:00:00Z`, cloture_le: null, valide_le: null,
};
const jeu = {
  profiles: PROFIL, postes: [POSTE], postes_equipe: [{ id: 'm1', poste_id: 'p1', driver_id: 'c1', vehicle_id: null, present: null, retard_minutes: null, motif_absence: null }],
  postes_evenements: [], work_shifts: [{ id: 's1', display_name: 'Jour', start_time: '06:00:00', end_time: '18:00:00' }], sites: [{ id: SITE_MINE, name: 'Mine de Nimba' }], drivers: [{ id: 'c1', name: 'Mamadou Camara' }],
};

const ouvrir = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Postes de travail', exact: true }).click();
};

test.describe('Postes de travail', () => {
  test('passation affichee, absence motivee, cloture avec consignes', async ({ page }) => {
    await simulerApi(page, jeu);
    const appels: { fonction: string; corps: Record<string, unknown> }[] = [];
    for (const fonction of ['pointer_presence', 'cloturer_poste', 'ouvrir_poste']) {
      await page.route(`**/rest/v1/rpc/${fonction}`, (route) => { appels.push({ fonction, corps: route.request().postDataJSON() }); return repondre(route, null); });
    }
    page.on('dialog', (d) => d.accept('Malade'));
    await ouvrir(page);
    await page.getByRole('button', { name: 'Ouvrir la fiche du poste Jour Mine de Nimba' }).click();
    await expect(page.getByText('Piste nord dégradée')).toBeVisible();
    await page.getByRole('button', { name: 'Absent Mamadou Camara' }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ fonction: 'pointer_presence', corps: { p_membre_id: 'm1', p_present: false, p_motif: 'Malade' } });

    const clore = page.getByRole('button', { name: 'Clore le poste' });
    await expect(clore).toBeDisabled();
    await page.getByLabel(/Consignes pour le poste suivant/).fill('Rouler à 20 km/h sur la piste nord');
    await clore.click();
    await expect.poll(() => appels.length).toBe(2);
    expect(appels[1]).toMatchObject({ fonction: 'cloturer_poste', corps: { p_poste_id: 'p1', p_consignes_sortie: 'Rouler à 20 km/h sur la piste nord' } });
  });

  test('ouverture d\'un poste', async ({ page }) => {
    await simulerApi(page, { ...jeu, postes: [], postes_equipe: [] });
    const appels: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/ouvrir_poste', (route) => { appels.push(route.request().postDataJSON()); return repondre(route, 'p2'); });
    await ouvrir(page);
    const f = page.getByRole('form', { name: 'Ouverture de poste' });
    await f.getByLabel('Shift *').selectOption('s1');
    await f.getByLabel('Site *').selectOption(SITE_MINE);
    await page.getByRole('button', { name: 'Ouvrir le poste' }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ p_date: jour, p_shift_id: 's1', p_site_id: SITE_MINE });
  });
});
