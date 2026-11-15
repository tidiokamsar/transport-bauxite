import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi } from './api-simulee';

// Corrections des ecrans herites (D-061) avec l'API simulee : ordres de
// travail (annulation motivee, pieces sorties du registre des stocks),
// preventif (rappel Neemba, echeance inconnue non inventee), presences
// (correction et annulation motivees), recherche globale (colonnes reelles),
// parametres lus par le serveur, georeperage (desactivation, aucune position
// par defaut), chauffeurs (archivage).

const ENGIN = { id: 'v1', registration: 'RC-1234-A', brand_model: 'Sinotruk Howo', vehicle_type: 'tipper', status: 'active', site_id: null };

const aller = async (page: Page, groupe: string | null, vue: string) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Paramètres', exact: true }).waitFor();
  const cible = page.getByRole('button', { name: vue, exact: true });
  // Le groupe Exploitation est ouvert par defaut : ne pas le refermer.
  if (groupe && !(await cible.isVisible())) await page.getByRole('button', { name: groupe, exact: true }).click();
  await cible.click();
};

const capturer = async (page: Page, fonctions: string[], reponses: Record<string, unknown> = {}) => {
  const appels: { fonction: string; corps: Record<string, unknown> }[] = [];
  for (const fonction of fonctions) {
    await page.route(`**/rest/v1/rpc/${fonction}`, (route) => {
      appels.push({ fonction, corps: route.request().postDataJSON() as Record<string, unknown> });
      return repondre(route, reponses[fonction] ?? null);
    });
  }
  return appels;
};

test.describe('Corrections des ecrans herites (D-061)', () => {
  test('ordre de travail : annulation motivee et pieces sorties du stock', async ({ page }) => {
    await simulerApi(page, {
      profiles: PROFIL, vehicles: [ENGIN], sites: [],
      maintenance_orders: [{ id: 'o1', work_order_number: 'OT-2026-00001', title: 'Vérin de benne', description: 'Fuite', maintenance_type: 'corrective',
        priority: 'high', status: 'in_progress', vehicle_id: 'v1', site_id: null, scheduled_date: '2026-11-18', request_date: '2026-11-17', started_at: null,
        completion_date: null, km_at_maintenance: null, labor_hours: null, labor_cost: null, estimated_cost: null, actual_cost: null, workshop: 'internal',
        notes: null, annule_le: null, motif_annulation: null }],
      stock_items: [{ id: 'a1', item_code: 'FLT-001', name: 'Filtre à huile', unit_of_measure: 'piece', unit_price: 15000, active: true }],
      warehouses: [{ id: 'd1', code: 'MAG-A', name: 'Magasin', active: true }],
    });
    const appels = await capturer(page, ['annuler_ordre_travail', 'mouvement_stock', 'pieces_ordre_travail'], {
      pieces_ordre_travail: [{ mouvement_id: 'm1', numero: 'MVT-2026-000001', date_mouvement: '2026-11-18T08:00:00Z', type_mouvement: 'exit', article_id: 'a1',
        article_code: 'FLT-001', article_nom: 'Filtre à huile', unite: 'piece', quantite: 2, prix_unitaire: 15000, valeur: 30000, depot_code: 'MAG-A', annule: false }],
    });
    const ecritures: string[] = [];
    page.on('request', (r) => { if (r.url().includes('/rest/v1/maintenance_orders') && r.method() !== 'GET') ecritures.push(r.method()); });
    page.on('dialog', (d) => d.accept('Ordre saisi en double'));
    await aller(page, 'Maintenance', 'Ordres de travail');
    await expect(page.getByText('OT-2026-00001')).toBeVisible();

    await page.getByRole('button', { name: 'Annuler OT-2026-00001' }).click();
    await expect.poll(() => appels.filter((a) => a.fonction === 'annuler_ordre_travail').length).toBe(1);
    expect(appels.find((a) => a.fonction === 'annuler_ordre_travail')?.corps).toMatchObject({ p_id: 'o1', p_motif: 'Ordre saisi en double' });

    await page.getByRole('button', { name: 'Pièces de OT-2026-00001' }).click();
    await expect(page.getByText('MVT-2026-000001')).toBeVisible();
    await expect(page.getByText(/30\s000 GNF/)).toBeVisible();
    await page.getByRole('button', { name: 'Sortir du stock' }).click();
    const f = page.getByRole('form', { name: 'Mouvement de pièce' });
    await f.getByLabel('Article *').selectOption('a1');
    await f.getByLabel('Depuis le dépôt *').selectOption('d1');
    await f.getByLabel('Quantité *').fill('1');
    await f.getByRole('button', { name: 'Enregistrer' }).click();
    await expect.poll(() => appels.filter((a) => a.fonction === 'mouvement_stock').length).toBe(1);
    expect(appels.find((a) => a.fonction === 'mouvement_stock')?.corps).toMatchObject({
      p_article: 'a1', p_type: 'exit', p_quantite: 1, p_depot_source: 'd1', p_ordre_maintenance: 'o1', p_vehicle_id: 'v1', p_prix_unitaire: 15000,
    });

    await page.getByRole('button', { name: 'Nouvel ordre de travail' }).click();
    await expect(page.getByText('Numéro : attribué à l\'enregistrement.')).toBeVisible();
    expect(ecritures).not.toContain('DELETE');
  });

  test('preventif : rappel Neemba, engin au contrat de location, echeance inconnue', async ({ page }) => {
    await simulerApi(page, {
      profiles: PROFIL, vehicles: [ENGIN], v_releves_compteur: [],
      maintenance_schedules: [{ id: 's1', vehicle_id: 'v1', title: 'Vidange 500 h', description: null, maintenance_type: 'Vidange moteur', interval_km: 10000,
        interval_days: null, last_maintenance_km: null, last_maintenance_date: null, next_service_km: null, next_service_date: null, estimated_cost: null, is_active: true }],
      contrat_tarifs: [{ engin: 'v1', version: { contrat: { reference: 'LOC-NEEMBA-01', nature: 'location', contrepartie: 'Neemba' } } }],
    });
    await aller(page, 'Maintenance', 'Préventif');
    await expect(page.getByRole('note')).toContainText('Neemba');
    await expect(page.getByText('Au contrat de location LOC-NEEMBA-01')).toBeVisible();
    await expect(page.getByText('Inconnue', { exact: true })).toBeVisible();
    await expect(page.getByText('Non saisie')).toBeVisible();
  });

  test('presences : correction par nouvelle saisie et annulation motivee', async ({ page }) => {
    const hier = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await simulerApi(page, {
      profiles: PROFIL,
      employees: [{ id: 'e1', first_name: 'Mamadou', last_name: 'Camara', employee_number: 'MAT-007', status: 'active' }],
      employee_attendance: [{ id: 'p1', employee_id: 'e1', date: hier, status: 'present', check_in_time: '07:00:00', check_out_time: '15:30:00', hours_worked: 8.5,
        overtime_hours: 0, absence_reason: null, notes: null, remplace_presence_id: null, motif_correction: null, annulee_le: null, motif_annulation: null }],
      drivers: [{ id: 'dr1', name: 'Mamadou Camara', employee_id: 'MAT-007', license_number: 'PC-42' }],
    });
    const appels = await capturer(page, ['enregistrer_presence', 'annuler_presence']);
    page.on('dialog', (d) => d.accept('Saisie en double'));
    await aller(page, 'RH & Sécurité', 'Présences');
    await expect(page.getByText('chauffeur Mamadou Camara, permis PC-42', { exact: false })).toBeVisible();

    await page.getByRole('button', { name: `Corriger la saisie du ${hier}` }).click();
    const f = page.getByRole('form', { name: 'Saisie de présence' });
    await f.getByLabel('Statut *').selectOption('late');
    await f.getByLabel('Motif de la correction *').fill('Retard constaté par le chef de poste');
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect.poll(() => appels.filter((a) => a.fonction === 'enregistrer_presence').length).toBe(1);
    expect(appels[0].corps).toMatchObject({ p_employe: 'e1', p_statut: 'late', p_remplace: 'p1', p_motif_correction: 'Retard constaté par le chef de poste' });

    await page.getByRole('button', { name: `Annuler la saisie du ${hier}` }).click();
    await expect.poll(() => appels.filter((a) => a.fonction === 'annuler_presence').length).toBe(1);
    expect(appels[1].corps).toMatchObject({ p_id: 'p1', p_motif: 'Saisie en double' });
  });

  test('recherche globale : colonnes reelles et ouverture de l\'ecran', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL, vehicles: [ENGIN] });
    const urls: string[] = [];
    page.on('request', (r) => { if (r.url().includes('/rest/v1/')) urls.push(decodeURIComponent(r.url())); });
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto('/');
    await page.getByRole('button', { name: /Rechercher\.\.\./ }).click();
    await page.getByLabel('Rechercher', { exact: true }).fill('RC-12');
    const resultat = page.getByRole('dialog', { name: 'Recherche globale' }).getByRole('button', { name: /RC-1234-A/ });
    await expect(resultat).toBeVisible();
    expect(urls.some((u) => u.includes('vehicles?') && u.includes('registration.ilike'))).toBe(true);
    expect(urls.filter((u) => u.includes('or=(')).some((u) => ['vehicle_number', 'first_name', 'trip_number', 'invoice_number', '(order_number'].some((c) => u.includes(c)))).toBe(false);
    await resultat.click();
    await expect(page.getByRole('dialog', { name: 'Recherche globale' })).toHaveCount(0);
  });

  test('parametres : reglages lus par le serveur, plus de cle API fictive', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL, settings: [{ key: 'achats_validation_separee', value: { value: 'true' } }] });
    const envois: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/settings*', (route) => {
      if (route.request().method() === 'POST') { envois.push(route.request().postDataJSON() as Record<string, unknown>); return route.fulfill({ status: 201, body: '' }); }
      return route.fallback();
    });
    await aller(page, null, 'Paramètres');
    await page.getByRole('button', { name: 'Général', exact: true }).click();
    await expect(page.getByText('Paramètres lus par le serveur')).toBeVisible();
    await expect(page.getByText(/sk_x/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Intégrations' })).toHaveCount(0);
    const mfa = page.getByRole('listitem', { name: 'Réglage Double authentification exigée' });
    await expect(mfa).toContainText('Se règle depuis');
    await expect(page.getByRole('listitem', { name: 'Réglage Achats : approbation par une autre personne' })).toContainText('Oui');

    const tol = page.getByRole('listitem', { name: 'Réglage Tolérance de poids CBG' });
    await expect(tol).toContainText('Absent : 0 t');
    await tol.getByLabel('Tolérance de poids CBG').fill('0.5');
    await tol.getByRole('button', { name: 'Enregistrer' }).click();
    await expect.poll(() => envois.length).toBe(1);
    expect(envois[0]).toMatchObject({ key: 'tolerance_poids_cbg_t', value: { value: '0.5' } });

    for (const cle of ['Carburant : validation par une autre personne', 'Distances : validation par une autre personne', 'Paiements : approbation par une autre personne']) {
      await expect(page.getByRole('listitem', { name: `Réglage ${cle}` }).getByLabel(cle)).toBeVisible();
    }
  });

  test('georeperage : desactivation au lieu de suppression, aucune position par defaut', async ({ page }) => {
    await simulerApi(page, {
      profiles: PROFIL, sites: [], geofence_violations: [], geofence_alerts: [],
      geofence_zones: [{ id: 'z1', name: 'Fosse Nord', description: null, zone_type: 'mine', geometry_type: 'circle', polygon_coordinates: null,
        center_lat: 10.5, center_lng: -13.5, radius_meters: 500, color: '#10B981', is_active: true, site_id: null, max_speed_kmh: null,
        max_dwell_minutes: null, alert_on_entry: false, alert_on_exit: false, alert_on_dwell: false }],
    });
    await page.route('**/tile.openstreetmap.org/**', (route) => route.abort());
    const maj: { methode: string; corps: unknown }[] = [];
    await page.route('**/rest/v1/geofence_zones*', (route) => {
      if (route.request().method() !== 'GET') { maj.push({ methode: route.request().method(), corps: route.request().postDataJSON() }); return route.fulfill({ status: 204, body: '' }); }
      return route.fallback();
    });
    page.on('dialog', (d) => d.accept());
    await aller(page, 'Exploitation', 'Géorepérage');
    await expect(page.getByRole('note')).toContainText('Aucune détection automatique');
    await page.getByRole('button', { name: 'Désactiver Fosse Nord' }).click();
    await expect.poll(() => maj.length).toBe(1);
    expect(maj[0]).toMatchObject({ methode: 'PATCH', corps: { is_active: false } });

    await page.getByRole('button', { name: 'Nouvelle zone' }).click();
    const f = page.getByRole('form', { name: 'Zone de géorepérage' });
    await f.getByLabel('Nom *').fill('Parc');
    await f.getByLabel('Type *').selectOption('parking');
    await expect(f.getByLabel('Latitude du centre *')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
  });

  test('chauffeur : archivage au lieu de suppression', async ({ page }) => {
    await simulerApi(page, {
      profiles: PROFIL,
      drivers: [{ id: 'dr1', name: 'Alpha Diallo', employee_id: 'MAT-009', phone: null, email: null, hire_date: '2024-01-01', birth_date: null, license_number: 'PC-9',
        license_category: 'C', license_expiry: '2030-01-01', health_certificate_expiry: null, address: null, emergency_contact_name: null,
        emergency_contact_phone: null, contract_type: 'permanent', base_salary: 0, status: 'active', notes: null }],
    });
    const ecritures: { methode: string; corps: unknown }[] = [];
    await page.route('**/rest/v1/drivers*', (route) => {
      if (route.request().method() !== 'GET') { ecritures.push({ methode: route.request().method(), corps: route.request().postDataJSON() }); return route.fulfill({ status: 204, body: '' }); }
      return route.fallback();
    });
    page.on('dialog', (d) => d.accept());
    await aller(page, 'Flotte', 'Chauffeurs');
    await page.getByText('Alpha Diallo').click();
    await page.getByRole('button', { name: 'Archiver le dossier' }).click();
    await expect.poll(() => ecritures.length).toBe(1);
    expect(ecritures[0]).toMatchObject({ methode: 'PATCH', corps: { status: 'terminated' } });
  });
});
