import { expect, test, type Page } from '@playwright/test';
import { PROFIL, SITE_DEPOT, repondre, simulerApi } from './api-simulee';

// Pesee CBG a deux sources (D-081) avec l'API simulee : import controle du
// releve officiel (apercu, empreinte), fiche terrain KOGON avec identifiant
// de saisie, rapprochement cote a cote, action tracee sur une anomalie.

const jeu = {
  profiles: PROFIL,
  sites: [{ id: SITE_DEPOT, name: 'Dépôt CBG' }],
  vehicles: [{ id: 'v1', registration: 'RC-1001' }],
  releves_cbg: [{ id: 'r1', reference: 'CBG-REL-2026-10', periode_debut: '2026-10-01', periode_fin: '2026-10-31', site_id: null, statut: 'rapproche',
    importe_le: '2026-11-02T08:00:00Z', fichier_source: 'octobre.csv', empreinte_sha256: 'a'.repeat(64), lignes_rejetees: [], motif_annulation: null,
    rapproche_pesees_le: '2026-11-02T08:05:00Z' }],
  v_rapprochements_pesee_courants: [
    { id: 'p1', releve_id: 'r1', ligne_id: 'l1', releve_kogon_id: 'k1', trip_id: 't1', trips_candidats: [], site_id: SITE_DEPOT, ticket: 'T-1',
      date_cbg: '2026-10-03', immatriculation_cbg: 'RC-1001', net_cbg: 42, heure_kogon: '2026-10-03T10:00:00Z', immatriculation_kogon: 'RC-1001', net_kogon: 40,
      ecart_t: 2, ecart_pct: 4.762, source_tolerance: 'non_parametree', classes: ['ecart_poids'], detail: 'Net CBG 42 t, releve KOGON 40 t, ecart 2 t',
      passe_numero: 1, passe_le: '2026-11-02T08:05:00Z' },
  ],
  anomalies_pesee: [{ id: 'a1', releve_id: 'r1', trip_id: 't1', site_id: SITE_DEPOT, categorie: 'ecart_poids', gravite: 'haute',
    description: 'Net CBG 42 t, releve KOGON 40 t, ecart 2 t', sources: ['cbg', 'kogon', 'rotation'], valeurs: { net_cbg: 42, net_kogon: 40 },
    responsable_id: null, statut: 'ouverte', decision: null, commentaire: null, preuve_ref: null, soumis_par: null, cree_le: '2026-11-02T08:05:00Z' }],
  v_releves_terrain_kogon_effectifs: [], v_voyages_livres_sans_ticket: [], parametres_tolerance_pesee: [], journal_anomalies_pesee: [],
};

const ouvrir = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Pesée CBG', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pesée CBG' })).toBeVisible();
};

test.describe('Pesée CBG à deux sources', () => {
  test('import contrôlé, fiche KOGON, rapprochement, anomalie tracée', async ({ page }) => {
    await simulerApi(page, jeu);
    const appels: { fonction: string; corps: Record<string, unknown> }[] = [];
    for (const fonction of ['importer_releve_cbg_v2', 'saisir_releve_terrain_kogon', 'agir_anomalie_pesee']) {
      await page.route(`**/rest/v1/rpc/${fonction}`, (route) => {
        appels.push({ fonction, corps: route.request().postDataJSON() });
        return repondre(route, fonction === 'importer_releve_cbg_v2' ? { acceptees: 1, rejetees: 1, doublons_inter_releves: 0, incompletes: 0 }
          : fonction === 'agir_anomalie_pesee' ? 'en_examen' : { id: 'k9', deja_enregistre: false });
      });
    }
    await ouvrir(page);

    // A : releve officiel, colonnes controlees et apercu avant envoi
    const f = page.getByRole('form', { name: 'Import du relevé' });
    await f.getByLabel('Fichier du relevé').setInputFiles({ name: 'releve.csv', mimeType: 'text/csv',
      buffer: Buffer.from('N° ticket;Immatriculation;Net\nT-3;RC 1001;40,2\n') });
    await expect(page.getByText('releve.csv : Colonnes manquantes : date')).toBeVisible();
    await f.getByLabel('Fichier du relevé').setInputFiles({ name: 'releve.csv', mimeType: 'text/csv',
      buffer: Buffer.from('N° ticket;Date;Immatriculation;Net\nT-3;04/11/2026;RC 1001;40,2\nT-4;04/11/2026\n') });
    await expect(page.getByText(/releve\.csv : 1 ligne\(s\) acceptée\(s\), 1 rejetée\(s\)/)).toBeVisible();
    await expect(page.getByRole('table', { name: 'Aperçu du relevé' }).getByText('T-3')).toBeVisible();
    await f.getByLabel('Référence du relevé *').fill('CBG-REL-2026-11');
    await f.getByLabel('Du *').fill('2026-11-01');
    await f.getByLabel('Au *').fill('2026-11-30');
    await page.getByRole('button', { name: 'Importer le relevé' }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ fonction: 'importer_releve_cbg_v2', corps: { p_reference: 'CBG-REL-2026-11', p_fichier: 'releve.csv',
      p_lignes: [{ ticket: 'T-3', date: '2026-11-04', immatriculation: 'RC 1001', net: '40.2' }], p_rejets: [{ rang: 3 }] } });
    expect(String(appels[0].corps.p_empreinte)).toMatch(/^[0-9a-f]{64}$/);

    // B : fiche terrain KOGON envoyee avec son identifiant de saisie
    await page.getByRole('tab', { name: 'B. Fiches terrain KOGON' }).click();
    const fiche = page.getByRole('form', { name: 'Fiche terrain KOGON' });
    await fiche.getByLabel('Site *').selectOption(SITE_DEPOT);
    await fiche.getByLabel('N° du ticket CBG observé').fill('T-3');
    await fiche.getByLabel('Net observé (t)').fill('40,2');
    await page.getByRole('button', { name: 'Envoyer la fiche' }).click();
    await expect.poll(() => appels.length).toBe(2);
    expect(appels[1]).toMatchObject({ fonction: 'saisir_releve_terrain_kogon', corps: { p_site_id: SITE_DEPOT, p_trip_id: null,
      p_donnees: { ticket: 'T-3', net: '40.2', anomalie_signalee: false } } });
    expect(String(appels[1].corps.p_client_id)).toMatch(/^[0-9a-f-]{36}$/);
    await expect(page.getByText('Fiche terrain enregistrée.')).toBeVisible();

    // C : comparaison cote a cote
    await page.getByRole('tab', { name: 'C. Rapprochement' }).click();
    await page.getByLabel('Relevé', { exact: true }).selectOption('r1');
    const table = page.getByRole('table', { name: 'Rapprochement côte à côte' });
    await expect(table.getByText('Écart de poids')).toBeVisible();
    await expect(table.getByText('Net CBG 42 t, releve KOGON 40 t, ecart 2 t')).toBeVisible();
    await expect(page.getByText(/Tolérance non paramétrée/).first()).toBeVisible();

    // D : action tracee sur l'anomalie
    await page.getByRole('tab', { name: 'D. Anomalies et validations' }).click();
    await page.getByRole('button', { name: 'Ouvrir Net CBG 42 t, releve KOGON 40 t, ecart 2 t' }).click();
    const action = page.getByRole('form', { name: 'Action sur l\'anomalie' });
    await action.getByLabel('Action').selectOption('examiner');
    await page.getByRole('button', { name: 'Enregistrer l\'action' }).click();
    await expect.poll(() => appels.length).toBe(3);
    expect(appels[2]).toMatchObject({ fonction: 'agir_anomalie_pesee', corps: { p_id: 'a1', p_action: 'examiner' } });
  });
});
