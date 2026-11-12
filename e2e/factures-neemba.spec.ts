import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi } from './api-simulee';

// Controle des factures du loueur (D-032, type de facturation et tarif par
// engin D-033) avec l'API simulee : ecarts par ligne dans l'unite de chaque
// engin (heures pointees ou kilometres releves), notification formelle
// imprimable, saisie d'une facture recue.

const CONTRAT = { id: 'c1', reference: 'NEEMBA-2026-01', contrepartie: 'Neemba', devise: 'USD', nature: 'location' };
const FACTURE = {
  id: 'ff1', contrat_id: 'c1', numero_fournisseur: 'NB-2026-10', date_facture: '2026-11-02', periode_debut: '2026-10-01', periode_fin: '2026-10-31',
  devise: 'USD', montant_ht_facture: 2113000, statut: 'controlee', montant_attendu: 2010000, ecart_total: 101000, montant_reclame: 101000,
  notifiee_le: null, reference_notification: null, controle_le: '2026-11-03T08:00:00Z',
};
const LIGNES = [
  { id: 'l1', facture_id: 'ff1', vehicle_id: 'v1', libelle: 'RC-1001', categorie_materiel: 'Semi-remorque', quantite_facturee: 110, unite_facturee: 'heure',
    heures_facturees: null, taux_facture: 100, montant_facture: 11000, quantite_attendue: 100, unite_attendue: 'heure',
    heures_attendues: 100, taux_attendu: 100, montant_attendu: 10000, heures_arret_loueur: 10, ecart: 1000, constat: null },
  { id: 'l2', facture_id: 'ff1', vehicle_id: 'v3', libelle: 'RC-1003', categorie_materiel: 'Semi-remorque', quantite_facturee: 20, unite_facturee: 'heure',
    heures_facturees: null, taux_facture: 100, montant_facture: 2000, quantite_attendue: null, unite_attendue: null,
    heures_attendues: null, taux_attendu: 100, montant_attendu: null, heures_arret_loueur: null, ecart: null, constat: 'Aucun pointage sur la periode : heures non verifiables' },
  { id: 'l3', facture_id: 'ff1', vehicle_id: 'v2', libelle: 'RC-1002', categorie_materiel: null, quantite_facturee: 420, unite_facturee: 'km',
    heures_facturees: null, taux_facture: 5000, montant_facture: 2100000, quantite_attendue: 400, unite_attendue: 'km',
    heures_attendues: null, taux_attendu: 5000, montant_attendu: 2000000, heures_arret_loueur: null, ecart: 100000, constat: null },
];
const ENGINS = [{ id: 'v1', registration: 'RC-1001' }, { id: 'v2', registration: 'RC-1002' }, { id: 'v3', registration: 'RC-1003' }];

const ouvrir = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Contrats & Finance', exact: true }).click();
  await page.getByRole('button', { name: 'Contrôle factures Neemba', exact: true }).click();
};

test.describe('Contrôle des factures Neemba', () => {
  test('ecarts par ligne, unites par engin, notification et lettre', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL, contrats: [CONTRAT], vehicles: ENGINS, contrat_tarifs: [{ categorie_materiel: 'Semi-remorque' }],
      factures_fournisseur: [FACTURE], factures_fournisseur_lignes: LIGNES, regularisations_fournisseur: [], societe: [{ raison_sociale: 'Kogon Mining SARL' }] });
    const appels: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/notifier_ecart_fournisseur', (route) => { appels.push(route.request().postDataJSON()); return repondre(route, 'notifiee'); });
    page.on('dialog', (d) => d.accept('KM/DC/2026-014'));
    await ouvrir(page);
    await expect(page.getByText('Aucun pointage sur la periode : heures non verifiables', { exact: false })).toBeVisible();
    await expect(page.getByText('100 h').first()).toBeVisible();
    await expect(page.getByText('400 km').first()).toBeVisible();
    await expect(page.getByText('101 000,00 USD').first()).toBeVisible();
    await page.getByRole('button', { name: 'Notifier l\'écart' }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ p_id: 'ff1', p_reference: 'KM/DC/2026-014' });
    const lettre = page.getByRole('article', { name: 'Notification d\'écart' });
    await expect(lettre).toContainText('notification d\'écart · facture n° NB-2026-10');
    await expect(lettre).toContainText('RC-1001');
    await expect(lettre).toContainText('420 km');
    await expect(lettre).not.toContainText('RC-1003');
    await page.screenshot({ path: 'test-results/notification-neemba.png', fullPage: true });
  });

  test('saisie d\'une facture recue : en-tete et lignes avec quantite et unite', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL, contrats: [CONTRAT], vehicles: ENGINS, contrat_tarifs: [{ categorie_materiel: 'Semi-remorque' }],
      factures_fournisseur: [], factures_fournisseur_lignes: [], regularisations_fournisseur: [] });
    const envois: { table: string; corps: unknown }[] = [];
    await page.route(/\/rest\/v1\/factures_fournisseur(_lignes)?(\?.*)?$/, (route) => {
      if (route.request().method() === 'POST') {
        envois.push({ table: new URL(route.request().url()).pathname.split('/').pop() ?? '', corps: route.request().postDataJSON() });
        return route.fulfill({ status: 201, body: '' });
      }
      return route.fallback();
    });
    await ouvrir(page);
    await page.getByRole('button', { name: 'Saisir une facture reçue' }).click();
    const f = page.getByRole('dialog');
    await f.getByLabel('N° de facture *').fill('NB-2026-10');
    await f.getByLabel('Date *').fill('2026-11-02');
    await f.getByLabel('Période du *').fill('2026-10-01');
    await f.getByLabel('au *').fill('2026-10-31');
    await f.getByLabel('Montant HT facturé *').fill('11000');
    await f.getByLabel('Ligne 1 engin').selectOption({ label: 'RC-1001' });
    await f.getByLabel('Ligne 1 quantité').fill('110');
    await f.getByLabel('Ligne 1 unité').selectOption('heure');
    await f.getByLabel('Ligne 1 montant').fill('11000');
    await f.getByRole('button', { name: 'Enregistrer la facture' }).click();
    await expect.poll(() => envois.length).toBe(2);
    expect(envois[0]).toMatchObject({ table: 'factures_fournisseur', corps: { numero_fournisseur: 'NB-2026-10', contrat_id: 'c1', devise: 'USD', montant_ht_facture: 11000 } });
    expect((envois[1].corps as Record<string, unknown>[])[0]).toMatchObject({ vehicle_id: 'v1', quantite_facturee: 110, unite_facturee: 'heure', montant_facture: 11000 });
  });
});
