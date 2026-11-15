import { expect, test, type Page } from '@playwright/test';
import { ADMIN, PROFIL, repondre, simulerApi } from './api-simulee';

// Organisation et administration (D-064) avec l'API simulee : affectations
// multisites, delegations, journal de connexion, referentiels.

const SITES = [{ id: 's1', name: 'Mine Nimba' }, { id: 's2', name: 'Dépôt CBG' }];
const COMPTES = [
  { id: 'u1', full_name: 'Mamadou Test', site_id: null, status: 'active', role: 'driver', email: 'mamadou@exemple.invalid', created_at: '2026-11-01T00:00:00Z' },
  { id: 'u2', full_name: 'Fanta Test', site_id: null, status: 'active', role: 'fleet_manager', email: 'fanta@exemple.invalid', created_at: '2026-11-01T00:00:00Z' },
];
const AFFECTATIONS = [{
  id: 'a1', utilisateur: 'u1', utilisateur_nom: 'Mamadou Test', site_id: 's1', site_nom: 'Mine Nimba',
  debut: '2026-11-01', fin: null, motif: 'Affectation principale', annulee_le: null, motif_annulation: null, statut: 'en_cours',
}];

const ouvrir = async (page: Page, rpc: Record<string, unknown>, envois: { fn: string; corps: Record<string, unknown> }[]) => {
  await page.route('**/rest/v1/profiles**', (route) => {
    if (new URL(route.request().url()).searchParams.has('id')) return repondre(route, PROFIL, '0-0/1');
    return repondre(route, COMPTES);
  });
  await page.route('**/rest/v1/rpc/**', (route) => {
    const fn = new URL(route.request().url()).pathname.split('/').pop() ?? '';
    if (fn in rpc) return repondre(route, rpc[fn]);
    envois.push({ fn, corps: (route.request().postDataJSON() ?? {}) as Record<string, unknown> });
    return repondre(route, null);
  });
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Paramètres' }).click();
};

test.describe('Organisation et administration', () => {
  test('affectations multisites : périmètre affiché et affectation envoyée au serveur', async ({ page }) => {
    await simulerApi(page, { sites: SITES, v_affectations_sites: AFFECTATIONS, organisations: [] });
    const envois: { fn: string; corps: Record<string, unknown> }[] = [];
    await ouvrir(page, { mes_delegations: [], comptes_delegables: [] }, envois);
    await page.getByRole('button', { name: 'Affectations multisites' }).click();
    const perimetre = page.locator('tr', { hasText: 'Fanta Test' });
    await expect(perimetre.getByText('Tous les sites (aucune affectation)')).toBeVisible();
    await expect(page.locator('tr', { hasText: 'Mamadou Test' }).first().getByText('Mine Nimba')).toBeVisible();
    await page.getByLabel('Compte à affecter').selectOption('u1');
    await page.getByLabel('Site d\'affectation').selectOption('s2');
    await page.getByLabel('Début de l\'affectation').fill('2026-11-20');
    await page.getByLabel('Motif de l\'affectation').fill('Renfort');
    await page.getByRole('button', { name: 'Affecter' }).click();
    await expect.poll(() => envois.filter((e) => e.fn === 'affecter_site').length).toBe(1);
    expect(envois.find((e) => e.fn === 'affecter_site')?.corps).toMatchObject({
      p_utilisateur: 'u1', p_site: 's2', p_debut: '2026-11-20', p_fin: null, p_motif: 'Renfort',
    });
  });

  test('délégation : liste avec statut et envoi par la fonction serveur', async ({ page }) => {
    await simulerApi(page, { sites: SITES, organisations: [] });
    const envois: { fn: string; corps: Record<string, unknown> }[] = [];
    const fin = new Date(Date.now() + 3 * 86400000);
    await ouvrir(page, {
      comptes_delegables: [{ id: 'u2', full_name: 'Fanta Test', role: 'fleet_manager' }],
      mes_delegations: [{
        id: 'd1', delegant: ADMIN, delegant_nom: 'Aminata Test', delegue: 'u2', delegue_nom: 'Fanta Test', module: 'purchases',
        niveau: 'approbation', debut: new Date().toISOString(), fin: fin.toISOString(), motif: 'Absence du valideur',
        cree_le: new Date().toISOString(), revoquee_le: null, revoquee_par_nom: null, motif_revocation: null, statut: 'active',
      }],
    }, envois);
    await page.getByRole('button', { name: 'Délégations' }).click();
    const ligne = page.locator('tr', { hasText: 'Absence du valideur' });
    await expect(ligne.getByText('En vigueur')).toBeVisible();
    await expect(ligne.getByText('Approbation · Achats et fournisseurs')).toBeVisible();
    await page.getByLabel('Compte délégué').selectOption('u2');
    await page.getByLabel('Module délégué').selectOption('trips');
    await page.getByLabel('Fin de la délégation').fill(`${fin.toISOString().slice(0, 10)}T18:00`);
    await page.getByLabel('Motif de la délégation').fill('Congés');
    await page.getByRole('button', { name: 'Déléguer' }).click();
    await expect.poll(() => envois.filter((e) => e.fn === 'deleguer_droit').length).toBe(1);
    expect(envois.find((e) => e.fn === 'deleguer_droit')?.corps).toMatchObject({
      p_delegue: 'u2', p_module: 'trips', p_niveau: 'ecriture', p_debut: null, p_motif: 'Congés',
    });
    await ligne.getByRole('button', { name: 'Révoquer' }).click();
    await page.getByLabel('Motif de la révocation').fill('Retour anticipé');
    await ligne.getByRole('button', { name: 'Révoquer' }).click();
    await expect.poll(() => envois.filter((e) => e.fn === 'revoquer_delegation').length).toBe(1);
  });

  test('journal de connexion et référentiels en lecture', async ({ page }) => {
    await simulerApi(page, {
      sites: SITES, organisations: [],
      v_journal_connexions: [{
        id: 'j1', survenu_le: '2026-11-15T08:00:00Z', utilisateur: 'u1', compte: 'mamadou@exemple.invalid', nom: 'Mamadou Test',
        evenement: 'login', categorie: 'account', methode: 'email', adresse_ip: '10.0.0.8',
      }],
      devises: [{ code: 'GNF', libelle: null, actif: true }], unites_mesure: [{ code: 'tonne', libelle: 'Tonne', actif: true }],
    });
    const envois: { fn: string; corps: Record<string, unknown> }[] = [];
    await ouvrir(page, {
      sessions_ouvertes: [], mes_delegations: [], comptes_delegables: [],
      codes_utilises: [{ type: 'devise', code: 'USD', source: 'contrats.devise', occurrences: 2, au_referentiel: false }],
      sequences_numerotation: [{
        code: 'BC', libelle: 'Bons de commande', modele: 'BC-AAAA-NNNNN', source: 'purchase_orders.po_number',
        sequence_sql: 'purchase_orders_numero_seq', regle: 'sequence continue', compteur: 12, numeros: 12, dernier_numero: 'BC-2026-00012',
      }],
    }, envois);
    await page.getByRole('button', { name: 'Journal de connexion' }).click();
    const ligne = page.locator('tr', { hasText: 'mamadou@exemple.invalid' });
    await expect(ligne.getByText('Connexion')).toBeVisible();
    await expect(ligne.getByText('10.0.0.8')).toBeVisible();
    await expect(page.getByText('Aucune session ouverte enregistrée.')).toBeVisible();
    await page.getByRole('button', { name: 'Référentiels et numérotation' }).click();
    await expect(page.getByText('BC-2026-00012')).toBeVisible();
    await expect(page.locator('tr', { hasText: 'contrats.devise' }).getByText('Hors référentiel')).toBeVisible();
    await expect(page.getByText('Libellé non renseigné')).toBeVisible();
  });
});
