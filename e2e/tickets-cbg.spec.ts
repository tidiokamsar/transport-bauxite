import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi } from './api-simulee';

// Tickets et releves CBG (D-050) avec l'API simulee : import d'un releve
// CSV lu dans le navigateur, rapprochement, litige motive.

const jeu = {
  profiles: PROFIL,
  releves_cbg: [{ id: 'r1', reference: 'CBG-REL-2026-10', periode_debut: '2026-10-01', periode_fin: '2026-10-31', site_id: null, statut: 'rapproche', importe_le: '2026-11-02T08:00:00Z' }],
  ecarts_releve_cbg: [
    { id: 'e1', releve_id: 'r1', ligne_id: 'l1', ticket_id: 'k1', nature: 'concordant', detail: null, ecart_net: null, decision: null, motif: null },
    { id: 'e2', releve_id: 'r1', ligne_id: 'l2', ticket_id: 'k2', nature: 'ecart_poids', detail: 'Net CBG 40.5 t, SIGTB 40 t', ecart_net: 0.5, decision: null, motif: null },
  ],
  v_tickets_pesee_cbg_effectifs: [{ id: 'k1', trip_id: 't1', ticket: 'T-1', net: 40, mesure_le: '2026-10-03T10:00:00Z', est_rectifie: false },
    { id: 'k2', trip_id: 't2', ticket: 'T-2', net: 40, mesure_le: '2026-10-03T11:00:00Z', est_rectifie: false }],
  v_voyages_livres_sans_ticket: [{ id: 't9', reference: 'V-009', planned_date: '2026-10-05', vehicle_id: 'v1' }],
  sites: [], vehicles: [{ id: 'v1', registration: 'RC-1001' }],
};

const ouvrir = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Tickets CBG', exact: true }).click();
};

test.describe('Tickets et releves CBG', () => {
  test('import CSV, voyage sans ticket, litige motive', async ({ page }) => {
    await simulerApi(page, jeu);
    const appels: { fonction: string; corps: Record<string, unknown> }[] = [];
    for (const fonction of ['importer_releve_cbg', 'decider_ecart_releve_cbg']) {
      await page.route(`**/rest/v1/rpc/${fonction}`, (route) => { appels.push({ fonction, corps: route.request().postDataJSON() }); return repondre(route, 'x'); });
    }
    page.on('dialog', (d) => d.accept('Contestation envoyée à CBG'));
    await ouvrir(page);
    await expect(page.getByText('V-009')).toBeVisible();

    await page.getByRole('button', { name: 'Résultat CBG-REL-2026-10' }).click();
    await page.getByRole('button', { name: 'Litige Net CBG 40.5 t, SIGTB 40 t' }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ fonction: 'decider_ecart_releve_cbg', corps: { p_ecart_id: 'e2', p_decision: 'litige', p_motif: 'Contestation envoyée à CBG' } });

    const f = page.getByRole('form', { name: 'Import du relevé' });
    await f.getByLabel('Fichier du relevé').setInputFiles({ name: 'releve.csv', mimeType: 'text/csv',
      buffer: Buffer.from('N° ticket;Date;Immatriculation;Net\nT-3;04/11/2026;RC 1001;40,2\n') });
    await expect(page.getByText('releve.csv : 1 ligne(s) lue(s).')).toBeVisible();
    await f.getByLabel('Référence du relevé *').fill('CBG-REL-2026-11');
    await f.getByLabel('Du *').fill('2026-11-01');
    await f.getByLabel('Au *').fill('2026-11-30');
    await page.getByRole('button', { name: 'Importer le relevé' }).click();
    await expect.poll(() => appels.length).toBe(2);
    expect(appels[1]).toMatchObject({ fonction: 'importer_releve_cbg', corps: { p_reference: 'CBG-REL-2026-11', p_fichier: 'releve.csv',
      p_lignes: [{ ticket: 'T-3', date: '2026-11-04', immatriculation: 'RC 1001', net: '40.2' }] } });
  });
});
