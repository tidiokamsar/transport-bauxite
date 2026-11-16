import { expect, test, type Page, type Route } from '@playwright/test';
import { ADMIN, PROFIL, repondre, simulerApi } from './api-simulee';

// Saisie des referentiels et du dossier contractuel (D-079) avec l'API
// simulee : sites (champs conserves, coordonnees, stock non saisi), comptes
// (site obligatoire, desactivation motivee), contrats (suppression et
// tarif en vigueur), consultation sans depot.

const ORGS = [{ id: 'o1', raison_sociale: 'Kogon Mining SARL', statut: 'active' }];
const SITE = {
  id: 's1', name: 'Mine Nimba', type: 'mine', organisation_id: 'o1', address: 'Zone nord', city: null, country: 'Guinée',
  latitude: 7.65, longitude: -8.4, contact_name: null, contact_phone: null, contact_email: null, capacity: 12000,
  is_active: true, responsable_id: 'u2', notes: null,
};
const COMPTES = [{ id: 'u2', full_name: 'Fanta Test', role: 'operations_manager', site_id: null }];

const ouvrir = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
};

const ouvrirSites = async (page: Page) => {
  await ouvrir(page);
  const entree = page.getByRole('button', { name: 'Sites', exact: true });
  await expect(page.getByRole('button', { name: 'Exploitation', exact: true })).toBeVisible();
  if (!(await entree.isVisible())) await page.getByRole('button', { name: 'Exploitation', exact: true }).click();
  await entree.click();
  await expect(page.getByRole('heading', { name: 'Gestion des Sites' })).toBeVisible();
};

const corps = (route: Route) => route.request().postDataJSON() as Record<string, unknown>;

test.describe('Saisie des sites (D-079)', () => {
  test('modification : organisation, coordonnees et responsable conserves, stock jamais envoye', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL, sites: [SITE], organisations: ORGS });
    await page.route('**/rest/v1/rpc/comptes_selectionnables', (route) => repondre(route, COMPTES));
    const envois: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/sites*', (route) => {
      if (route.request().method() === 'PATCH') { envois.push(corps(route)); return route.fulfill({ status: 204, body: '' }); }
      return route.fallback();
    });
    await ouvrirSites(page);
    // Recherche : ville vide, aucune erreur.
    await page.getByPlaceholder('Rechercher un site...').fill('zone');
    await expect(page.getByRole('heading', { name: 'Mine Nimba' })).toBeVisible();
    await expect(page.getByText('12 000 t').first()).toBeVisible();
    await page.getByRole('button', { name: 'Modifier le site Mine Nimba' }).click();
    const f = page.getByRole('dialog', { name: 'Modifier le site' });
    await expect(f.getByLabel('Organisation (D-038)')).toHaveValue('o1');
    await expect(f.getByLabel('Responsable du site (compte actif)')).toHaveValue('u2');
    await f.getByLabel('Ville *').fill('Lola');
    await f.getByRole('button', { name: 'Mettre à jour' }).click();
    await expect.poll(() => envois.length).toBe(1);
    expect(envois[0]).toMatchObject({ organisation_id: 'o1', latitude: 7.65, longitude: -8.4, capacity: 12000, responsable_id: 'u2', city: 'Lola' });
    expect(envois[0]).not.toHaveProperty('current_stock');
    expect(envois[0]).not.toHaveProperty('manager_id');
  });

  test('creation : coordonnees ensemble, capacite en tonnes, erreur du serveur affichee', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL, sites: [], organisations: ORGS });
    await page.route('**/rest/v1/rpc/comptes_selectionnables', (route) => repondre(route, COMPTES));
    const envois: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/sites*', (route) => {
      if (route.request().method() === 'POST') {
        envois.push((corps(route) as unknown as Record<string, unknown>[])[0]);
        return envois.length === 1
          ? route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: '42501', message: 'new row violates row-level security policy for table "sites"' }) })
          : route.fulfill({ status: 201, body: '' });
      }
      return route.fallback();
    });
    await ouvrirSites(page);
    await page.getByRole('button', { name: 'Nouveau site' }).click();
    const f = page.getByRole('dialog', { name: 'Nouveau site' });
    await f.getByLabel('Nom du site *').fill('Port de Kamsar');
    await f.getByLabel('Type de site *').selectOption('port');
    await f.getByLabel('Adresse complète *').fill('Quai 2');
    await f.getByLabel('Ville *').fill('Kamsar');
    await f.getByLabel('Latitude (facultative)').fill('10,65');
    await expect(f.getByText('Saisir la latitude et la longitude ensemble')).toBeVisible();
    await f.getByLabel('Longitude (facultative)').fill('-14.61');
    await f.getByLabel('Capacité de stockage (tonnes)').fill('0');
    await expect(f.getByText('Capacité en tonnes, strictement positive')).toBeVisible();
    await f.getByLabel('Capacité de stockage (tonnes)').fill('250 000');
    await expect(f.getByText('Stock actuel')).toHaveCount(0);
    await f.getByRole('button', { name: 'Créer le site' }).click();
    await expect(f.getByRole('alert')).toContainText('row-level security');
    await f.getByRole('button', { name: 'Créer le site' }).click();
    await expect.poll(() => envois.length).toBe(2);
    expect(envois[1]).toMatchObject({ name: 'Port de Kamsar', type: 'port', latitude: 10.65, longitude: -14.61, capacity: 250000, organisation_id: null });
    expect(envois[1]).not.toHaveProperty('current_stock');
  });
});

const UTILISATEURS = [
  { id: ADMIN, role: 'admin', full_name: 'Aminata Test', email: 'admin@exemple.invalid', status: 'active', department: 'Direction', created_at: '2026-11-01T00:00:00Z', photo_url: null, site_id: null },
  { id: 'u1', role: 'driver', full_name: 'Mamadou Test', email: 'mamadou@exemple.invalid', status: 'active', department: 'Opérations', created_at: '2026-11-02T00:00:00Z', photo_url: null, site_id: 's1' },
];

const preparerComptes = async (page: Page) => {
  await simulerApi(page, { profiles: [], sites: [{ id: 's1', name: 'Mine Nimba', is_active: true }], organisations: ORGS, v_droits_modules: [] });
  await page.route('**/rest/v1/profiles**', (route) => {
    const id = new URL(route.request().url()).searchParams.get('id');
    if (id === 'eq.u1') return repondre(route, UTILISATEURS[1], '0-0/1');
    if (id) return repondre(route, PROFIL, '0-0/1');
    return repondre(route, UTILISATEURS);
  });
};

// Les routes propres a un test s'enregistrent APRES preparerComptes (la
// derniere route enregistree prend la main), puis l'ecran s'ouvre.
const afficherComptes = async (page: Page) => {
  await ouvrir(page);
  await page.getByRole('button', { name: 'Paramètres' }).click();
  await expect(page.getByRole('heading', { name: 'Gestion des utilisateurs' })).toBeVisible();
};

test.describe('Comptes (D-079)', () => {
  test('creation : site obligatoire, compte global seulement motive', async ({ page }) => {
    await preparerComptes(page);
    const envois: Record<string, unknown>[] = [];
    await page.route('**/functions/v1/admin-utilisateurs', (route) => {
      envois.push(corps(route));
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'u9' }) });
    });
    await afficherComptes(page);
    await page.getByRole('button', { name: 'Ajouter utilisateur' }).click();
    await page.getByPlaceholder('utilisateur@exemple.com').fill('awa@exemple.invalid');
    await page.getByPlaceholder('12 caractères minimum').fill('motdepasse-solide');
    await page.getByPlaceholder('Jean Dupont').fill('Awa Test');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.getByRole('alert')).toContainText("Site d'affectation obligatoire");
    expect(envois).toHaveLength(0);

    await page.getByLabel('Compte global (lit tous les sites)').check();
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.getByRole('alert')).toContainText('Compte global : motif obligatoire');
    await page.getByLabel('Compte global (lit tous les sites)').uncheck();

    await page.getByLabel("Site d'affectation (D-038) *").selectOption({ label: 'Mine Nimba' });
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect.poll(() => envois.length).toBe(1);
    expect(envois[0]).toMatchObject({ action: 'creer', email: 'awa@exemple.invalid', site_id: 's1', global: false, motif_global: null });
  });

  test('modification : site et droits par fonctions serveur, motifs saisis', async ({ page }) => {
    await preparerComptes(page);
    const appels: { fonction: string; corps: Record<string, unknown> }[] = [];
    const patchs: Record<string, unknown>[] = [];
    for (const fonction of ['definir_site_compte', 'definir_droit_module']) {
      await page.route(`**/rest/v1/rpc/${fonction}`, (route) => { appels.push({ fonction, corps: corps(route) }); return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }); });
    }
    await page.route('**/rest/v1/profiles**', (route) => {
      if (route.request().method() === 'PATCH') { patchs.push(corps(route)); return route.fulfill({ status: 204, body: '' }); }
      return route.fallback();
    });
    await afficherComptes(page);
    await page.route('**/rest/v1/v_droits_modules*', (route) => repondre(route, [
      { utilisateur: 'u1', module: 'trips', role_lecture: true, role_ecriture: false, niveau_attribue: null },
    ]));
    await page.getByRole('button', { name: 'Modifier' }).nth(1).click();
    await expect(page.getByRole('heading', { name: 'Modifier Utilisateur' })).toBeVisible();
    await page.getByLabel('Compte global (lit tous les sites)').check();
    await page.getByLabel('Motif du périmètre global *').fill('Supervision de tous les sites');
    await page.getByLabel('Droits Voyages et fiches terrain').selectOption('ecriture');
    await page.getByRole('button', { name: 'Mettre à jour' }).click();
    await expect(page.getByRole('alert')).toContainText('Motif du changement de droits obligatoire');
    await page.getByLabel('Motif du changement de droits *').fill('Remplacement du dispatcheur');
    await page.getByRole('button', { name: 'Mettre à jour' }).click();
    await expect.poll(() => appels.length).toBe(2);
    expect(appels).toEqual(expect.arrayContaining([
      { fonction: 'definir_site_compte', corps: { p_utilisateur: 'u1', p_site: null, p_motif: 'Supervision de tous les sites' } },
      { fonction: 'definir_droit_module', corps: { p_utilisateur: 'u1', p_module: 'trips', p_niveau: 'ecriture', p_motif: 'Remplacement du dispatcheur' } },
    ]));
    expect(patchs[0]).not.toHaveProperty('status');
    expect(patchs[0]).not.toHaveProperty('site_id');
  });

  test('desactivation : jamais sur soi-meme, motif obligatoire, refus du serveur affiche', async ({ page }) => {
    await preparerComptes(page);
    const appels: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/desactiver_compte', (route) => {
      appels.push(corps(route));
      return route.fulfill({ status: 400, contentType: 'application/json',
        body: JSON.stringify({ code: '42501', message: 'Dernier administrateur actif : il garde son role et son statut' }) });
    });
    await afficherComptes(page);
    await expect(page.getByRole('columnheader')).toHaveCount(6);
    await expect(page.getByRole('button', { name: 'Désactiver Aminata Test' })).toHaveCount(0);
    await expect(page.getByText('supprimer', { exact: false })).toHaveCount(0);
    await page.getByRole('button', { name: 'Désactiver Mamadou Test' }).click();
    const d = page.getByRole('dialog', { name: 'Désactiver le compte' });
    await expect(d.getByRole('button', { name: 'Confirmer' })).toBeDisabled();
    await d.getByLabel('Motif *').fill('Fin de contrat');
    await d.getByRole('button', { name: 'Confirmer' }).click();
    await expect(d.getByRole('alert')).toContainText('Dernier administrateur actif');
    expect(appels).toEqual([{ p_utilisateur: 'u1', p_motif: 'Fin de contrat' }]);
  });
});

test.describe('Dossier contractuel (D-079)', () => {
  const DROITS = ['dashboard', 'contracts'].map((module) => ({
    role: 'contract_manager', module, can_view: true, can_create: true, can_edit: true, can_delete: false, can_approve: false,
  }));
  const CHARGE = [{ id: ADMIN, role: 'contract_manager', full_name: 'Abdoulaye Test', status: 'active', site_id: null }];
  const CONTRAT = {
    id: 'c1', reference: 'CBG-2026-01', intitule: 'Transport', nature: 'client', contrepartie: 'CBG', devise: 'USD',
    date_debut: '2026-01-01', date_fin: null, statut: 'actif', delai_paiement_jours: 30, description: null,
  };
  const jeu = (statut: string) => ({
    profiles: CHARGE, role_permissions: DROITS, contrats: [{ ...CONTRAT, statut }],
    contrat_versions: [{ id: 'v0', contrat_id: 'c1', numero: 0, intitule: 'Contrat initial', date_effet: '2026-01-01', date_signature: null, resume: null, document_ref: null }],
    contrat_tarifs: [{ id: 't1', version_id: 'v0', libelle: 'Transport mine - port', unite: 'tonne', prix: 4.5, categorie_materiel: null, conditions: null, ordre: 0 }],
    contrat_engagements: [], contrat_clauses: [],
  });
  const ouvrirContrats = async (page: Page) => {
    await ouvrir(page);
    await page.getByRole('button', { name: 'Contrats & Finance' }).click();
    await page.getByRole('button', { name: 'Dossier contractuel' }).click();
    await expect(page.getByRole('heading', { name: 'Dossier contractuel', exact: true })).toBeVisible();
  };

  test('contrat actif : aucune suppression, tarif en vigueur modifie par avenant', async ({ page }) => {
    await simulerApi(page, jeu('actif'));
    const appels: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/modifier_tarif_par_avenant', (route) => { appels.push(corps(route)); return repondre(route, 'v1'); });
    await ouvrirContrats(page);
    await expect(page.getByRole('button', { name: 'Supprimer le tarif Transport mine - port' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Supprimer Contrat initial/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Modifier le tarif Transport mine - port par avenant' }).click();
    const f = page.getByRole('dialog', { name: 'Modifier un tarif en vigueur par avenant' });
    await f.getByLabel('Nouveau prix unitaire *').fill('5,25');
    await f.getByLabel("Intitulé de l'avenant *").fill('Révision du tarif port');
    await f.getByLabel(/Date d'effet de l'avenant/).fill('2025-12-01');
    await expect(f.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
    await f.getByLabel(/Date d'effet de l'avenant/).fill('2026-07-01');
    await f.getByRole('button', { name: 'Enregistrer' }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ p_tarif: 't1', p_prix: 5.25, p_intitule: 'Révision du tarif port', p_date_effet: '2026-07-01' });
  });

  test('brouillon : suppression par la fonction serveur, avec motif', async ({ page }) => {
    await simulerApi(page, jeu('brouillon'));
    const appels: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/supprimer_element_contrat', (route) => { appels.push(corps(route)); return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }); });
    page.on('dialog', (d) => d.accept('Doublon de saisie'));
    await ouvrirContrats(page);
    await page.getByRole('button', { name: 'Modifier le tarif Transport mine - port', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Supprimer le tarif Transport mine - port' }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toEqual({ p_table: 'contrat_tarifs', p_id: 't1', p_motif: 'Doublon de saisie' });
  });
});

test('consultation sans depot : le depot est demande pour preparer le bon', async ({ page }) => {
  await simulerApi(page, {
    profiles: PROFIL,
    suppliers: [{ id: 'f1', supplier_number: 'FRS-00001', supplier_type: 'parts', company_name: 'Pièces Kogon', active: true }],
    warehouses: [{ id: 'w1', name: 'Magasin Nimba', code: 'MAG-NIM' }],
    consultations_fournisseurs: [{ id: 'cs1', numero: 'CONS-2026-00002', objet: 'Filtres', warehouse_id: null, date_limite: null, note: null,
      statut: 'attribuee', offre_retenue_id: 'o1', motif_selection: 'Moins disante', purchase_order_id: null, motif_annulation: null, cree_le: '2026-11-10T08:00:00Z' }],
    consultations_lignes: [], consultations_invites: [], offres_fournisseurs: [], offres_lignes: [], consultations_journal: [],
  });
  const appels: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/preparer_bon_commande_consultation', (route) => { appels.push(corps(route)); return repondre(route, 'po1'); });
  await page.route('**/rest/v1/rpc/delai_alerte_documents_fournisseurs', (route) => repondre(route, 30));
  await ouvrir(page);
  await page.getByRole('button', { name: 'Stocks & Achats', exact: true }).click();
  await page.getByRole('button', { name: 'Fournisseurs', exact: true }).click();
  await page.getByRole('tab', { name: 'Consultations' }).click();
  await page.getByRole('button', { name: 'Ouvrir CONS-2026-00002' }).click();
  const preparer = page.getByRole('button', { name: 'Préparer le bon de commande' });
  await expect(preparer).toBeDisabled();
  await page.getByLabel('Dépôt de livraison du bon').selectOption('w1');
  await preparer.click();
  await expect.poll(() => appels.length).toBe(1);
  expect(appels[0]).toEqual({ p_consultation: 'cs1', p_depot: 'w1' });
});
