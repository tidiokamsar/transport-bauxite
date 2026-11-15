import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi } from './api-simulee';

// Flotte (D-062) avec l'API simulee : registre (propriete non renseignee,
// statut derive), fiche consolidee sans cout invente, suspension motivee et
// propriete par fonctions serveur ; alertes d'expiration des documents.

const base = {
  brand_model: 'Sinotruk Howo', year: 2022, vehicle_type: 'tipper', capacity_tonnes: 40, chassis_number: null, site_id: null,
  insurance_expiry: null, technical_inspection_expiry: null, exploitant: null, transporteur: null, statut_admin: null,
  statut_admin_depuis: null, statut_admin_motif: null, voyage_en_cours: null,
};
const jeu = {
  profiles: PROFIL,
  v_vehicules: [
    { ...base, id: 'v1', registration: 'CAM-01', status: 'active', propriete: null, proprietaire: null, contrat_id: null, contrat_reference: null, statut_operationnel: 'disponible' },
    { ...base, id: 'v2', registration: 'CAM-02', status: 'immobilized', propriete: 'loue', proprietaire: 'Neemba', contrat_id: 'c1', contrat_reference: 'LOC-2026 · Neemba',
      statut_admin: 'suspendu', statut_admin_depuis: '2026-11-14T08:00:00Z', statut_admin_motif: 'Visite technique expirée', statut_operationnel: 'suspendu' },
  ],
  v_fiche_vehicule: [{ vehicle_id: 'v1', immobilisations: 2, heures_immobilisation: 30, immobilisation_ouverte_depuis: null, interventions_loueur: 1, interventions_actives: 0,
    pneus_montes: 6, pleins: 3, litres: 600, dernier_plein: '2026-11-12', cout_carburant_connu: null, litres_sans_prix: 600,
    dernier_controle_le: null, dernier_controle_resultat: null, documents_a_renouveler: 1 }],
  journal_flotte: [],
  immobilisations: [],
  fuel_transactions: [],
  controles_depart: [],
};

const aller = async (page: Page, ecran: string) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Flotte', exact: true }).click();
  await page.getByRole('button', { name: ecran, exact: true }).click();
};

test.describe('Flotte', () => {
  test('registre, fiche consolidee, suspension et propriete par fonctions serveur', async ({ page }) => {
    await simulerApi(page, jeu);
    const appels: { fonction: string; corps: Record<string, unknown> }[] = [];
    for (const fonction of ['suspendre_vehicule', 'definir_propriete_vehicule']) {
      await page.route(`**/rest/v1/rpc/${fonction}`, (route) => { appels.push({ fonction, corps: route.request().postDataJSON() }); return repondre(route, null); });
    }
    await page.route('**/rest/v1/rpc/contrats_rattachables_flotte', (route) =>
      repondre(route, [{ id: 'c1', reference: 'LOC-2026', intitule: 'Location', nature: 'location', contrepartie: 'Neemba', statut: 'actif' }]));
    await aller(page, 'Véhicules et engins');

    const registre = page.getByRole('table');
    await expect(registre.getByText('Non renseignée')).toBeVisible();
    await expect(registre.getByText('Suspendu')).toBeVisible();
    await expect(registre.getByText('Neemba · LOC-2026 · Neemba')).toBeVisible();

    await page.getByRole('button', { name: 'Fiche CAM-01' }).click();
    const fiche = page.getByRole('dialog', { name: 'Fiche CAM-01' });
    await expect(fiche.getByText('Sans prix connu (600 L non valorisés)')).toBeVisible();
    await expect(fiche.getByText('6', { exact: true })).toBeVisible();

    page.once('dialog', (d) => d.accept('Contrôle technique à refaire'));
    await fiche.getByRole('button', { name: 'Suspendre' }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ fonction: 'suspendre_vehicule', corps: { p_vehicle: 'v1', p_motif: 'Contrôle technique à refaire' } });

    await fiche.getByRole('button', { name: 'Renseigner' }).click();
    const f = fiche.getByRole('form', { name: 'Propriété de l\'engin' });
    await f.getByLabel('Propriété *').selectOption('loue');
    await f.getByLabel('Propriétaire / loueur').fill('Neemba');
    await f.getByLabel('Contrat de location').selectOption('c1');
    await f.getByRole('button', { name: 'Enregistrer la propriété' }).click();
    await expect.poll(() => appels.length).toBe(2);
    expect(appels[1]).toMatchObject({ fonction: 'definir_propriete_vehicule', corps: { p_vehicle: 'v1', p_propriete: 'loue', p_proprietaire: 'Neemba', p_contrat: 'c1', p_motif: null } });
  });

  test('documents : alertes d\'expiration et saisie sans valeur inventee', async ({ page }) => {
    await simulerApi(page, {
      profiles: PROFIL,
      vehicles: [{ id: 'v1', registration: 'CAM-01', brand_model: 'Sinotruk Howo' }],
      vehicle_documents: [{ id: 'd1', vehicle_id: 'v1', document_type: 'insurance', document_name: 'Assurance 2026', reference_number: 'POL-77', issue_date: null,
        expiry_date: '2099-01-01', status: 'active', provider: null, cost: null, notes: null, vehicle: { registration: 'CAM-01', brand_model: 'Sinotruk Howo' } }],
      v_documents_vehicule_a_renouveler: [
        { cle: 'registre:technical_inspection:v1', vehicle_id: 'v1', registration: 'CAM-01', type: 'technical_inspection', libelle: 'Visite technique (date du registre)', reference: null, expire_le: '2026-11-10', jours_restants: -5, origine: 'registre' },
        { cle: 'document:d2', vehicle_id: 'v1', registration: 'CAM-01', type: 'tax_vignette', libelle: 'Vignette 2026', reference: null, expire_le: '2026-11-25', jours_restants: 10, origine: 'document' },
      ],
    });
    const envois: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/vehicle_documents*', (route) => {
      if (route.request().method() === 'POST') { envois.push(route.request().postDataJSON()); return route.fulfill({ status: 201, body: '' }); }
      return route.fallback();
    });
    await aller(page, 'Documents');
    await expect(page.getByText('Expiré depuis 5 j')).toBeVisible();
    await expect(page.getByText('Expire dans 10 j')).toBeVisible();
    await expect(page.getByText('date saisie au registre, sans document enregistré')).toBeVisible();
    await expect(page.getByRole('table').getByText('Valide')).toBeVisible();

    await page.getByRole('button', { name: 'Nouveau document' }).click();
    const d = page.getByRole('dialog', { name: 'Nouveau document' });
    await d.getByLabel('Véhicule *').selectOption('v1');
    await d.getByLabel('Type *').selectOption('technical_inspection');
    await d.getByLabel('Nom du document *').fill('Visite technique 2026');
    await d.getByLabel('Date d\'expiration').fill('2027-11-20');
    await d.getByRole('button', { name: 'Enregistrer' }).click();
    await expect.poll(() => envois.length).toBe(1);
    expect(envois[0]).toMatchObject({ vehicle_id: 'v1', document_type: 'technical_inspection', expiry_date: '2027-11-20', issue_date: null, cost: null, status: 'active' });
  });
});
