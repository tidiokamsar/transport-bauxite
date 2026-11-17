import { expect, test, type Page } from '@playwright/test';
import { ADMIN, PROFIL, SITE_MINE, repondre, simulerApi } from './api-simulee';

// Pieces justificatives (D-083) avec l'API simulee : etat vide, depot en
// trois temps (enregistrement, envoi au stockage, confirmation), refus d'un
// type non admis sans appel au serveur, echec d'envoi explicite, annulation
// motivee.

const LIVRAISON = { id: 'l1', reference: 'LIV-CBG-13', date_livraison: '2026-11-14', site_id: SITE_MINE, site: { name: 'Mine de Nimba' },
  volume_litres: 5000, prix_litre: 12000, montant: 60000000, document_ref: null };
const jeu = {
  profiles: PROFIL, livraisons_carburant_cbg: [LIVRAISON], factures_carburant_cbg: [], factures_carburant_cbg_livraisons: [],
  sites: [{ id: SITE_MINE, name: 'Mine de Nimba' }], pieces_jointes: [],
};
const CHEMIN = 'livraison_carburant_cbg/l1/p1.pdf';
const PIECE = { id: 'p1', objet_type: 'livraison_carburant_cbg', objet_id: 'l1', chemin: CHEMIN, nom: 'BL 13.pdf', type_mime: 'application/pdf',
  taille: 20, sha256: 'a'.repeat(64), statut: 'deposee', depose_par: ADMIN, depose_le: '2026-11-16T10:00:00Z', annule_le: null, motif_annulation: null };
const PDF = { name: 'BL 13.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% test\n') };

const ouvrir = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Carburant', exact: true }).click();
  await page.getByRole('button', { name: 'Livraisons et factures CBG', exact: true }).click();
  await page.getByRole('button', { name: 'Pièces livraison LIV-CBG-13' }).click();
};

test.describe('Pieces justificatives', () => {
  test('etat vide puis depot : enregistrement, envoi, confirmation, liste rechargee', async ({ page }) => {
    await simulerApi(page, jeu);
    const appels: string[] = [];
    const enregistrements: Record<string, unknown>[] = [];
    let pieces: unknown[] = [];
    await page.route('**/rest/v1/pieces_jointes*', (route) => repondre(route, pieces));
    await page.route('**/rest/v1/rpc/enregistrer_piece_jointe', (route) => {
      appels.push('enregistrer'); enregistrements.push(route.request().postDataJSON());
      return repondre(route, { id: 'p1', chemin: CHEMIN, bucket: 'pieces' });
    });
    await page.route('**/storage/v1/object/pieces/**', (route) => {
      appels.push(`envoi ${new URL(route.request().url()).pathname} ${route.request().headers()['content-type']} upsert=${route.request().headers()['x-upsert']}`);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Key: `pieces/${CHEMIN}`, Id: 'o1' }) });
    });
    await page.route('**/rest/v1/rpc/confirmer_piece_jointe', (route) => {
      appels.push('confirmer'); pieces = [PIECE];
      return repondre(route, 'deposee');
    });
    await ouvrir(page);
    const fenetre = page.getByRole('dialog', { name: 'Pièces justificatives : livraison LIV-CBG-13' });
    await expect(fenetre.getByText('Aucune pièce justificative')).toBeVisible();
    await fenetre.getByLabel('Fichier à joindre').setInputFiles(PDF);
    await fenetre.getByRole('button', { name: 'Joindre', exact: true }).click();
    await expect(fenetre.getByText('Pièce « BL 13.pdf » déposée.')).toBeVisible();
    expect(appels).toEqual(['enregistrer', `envoi /storage/v1/object/pieces/${CHEMIN} application/pdf upsert=false`, 'confirmer']);
    expect(enregistrements[0]).toMatchObject({ p_objet_type: 'livraison_carburant_cbg', p_objet_id: 'l1', p_nom: 'BL 13.pdf',
      p_type_mime: 'application/pdf', p_taille: PDF.buffer.length });
    expect(String(enregistrements[0].p_sha256)).toMatch(/^[0-9a-f]{64}$/);
    await expect(fenetre.getByText('Déposée', { exact: true })).toBeVisible();
    await expect(fenetre.getByRole('button', { name: 'Télécharger BL 13.pdf' })).toBeVisible();
  });

  test('type non admis refuse sans appel ; echec d envoi explicite', async ({ page }) => {
    await simulerApi(page, jeu);
    let enregistrements = 0;
    await page.route('**/rest/v1/rpc/enregistrer_piece_jointe', (route) => { enregistrements += 1; return repondre(route, { id: 'p1', chemin: CHEMIN }); });
    await page.route('**/storage/v1/object/pieces/**', (route) =>
      route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' }) }));
    await ouvrir(page);
    const fenetre = page.getByRole('dialog', { name: 'Pièces justificatives : livraison LIV-CBG-13' });
    await fenetre.getByLabel('Fichier à joindre').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
    await expect(fenetre.getByRole('alert')).toContainText('Type de fichier non admis');
    await expect(fenetre.getByRole('button', { name: 'Joindre', exact: true })).toBeDisabled();
    expect(enregistrements).toBe(0);

    await fenetre.getByLabel('Fichier à joindre').setInputFiles(PDF);
    await fenetre.getByRole('button', { name: 'Joindre', exact: true }).click();
    await expect(fenetre.getByRole('alert')).toContainText('Fichier non reçu par le stockage');
    await expect(fenetre.getByRole('alert')).toContainText('dépôt inachevé');
    expect(enregistrements).toBe(1);
  });

  test('annulation motivee, la piece reste visible', async ({ page }) => {
    await simulerApi(page, jeu);
    let pieces: unknown[] = [PIECE];
    const annulations: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/pieces_jointes*', (route) => repondre(route, pieces));
    await page.route('**/rest/v1/rpc/annuler_piece_jointe', (route) => {
      annulations.push(route.request().postDataJSON());
      pieces = [{ ...PIECE, annule_le: '2026-11-16T11:00:00Z', motif_annulation: 'Mauvais bon joint' }];
      return repondre(route, null);
    });
    await ouvrir(page);
    const fenetre = page.getByRole('dialog', { name: 'Pièces justificatives : livraison LIV-CBG-13' });
    await fenetre.getByRole('button', { name: 'Annuler BL 13.pdf' }).click();
    const confirmer = fenetre.getByRole('button', { name: 'Confirmer l’annulation' });
    await expect(confirmer).toBeDisabled();
    await fenetre.getByLabel('Motif de l’annulation *').fill('Mauvais bon joint');
    await confirmer.click();
    await expect.poll(() => annulations.length).toBe(1);
    expect(annulations[0]).toEqual({ p_id: 'p1', p_motif: 'Mauvais bon joint' });
    await expect(fenetre.getByText('Annulée', { exact: true })).toBeVisible();
    await expect(fenetre.getByText(/Mauvais bon joint/)).toBeVisible();
  });
});
