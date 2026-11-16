import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi } from './api-simulee';

// Centre des decisions, comparaison de periodes et prevention HSE (D-068)
// avec l'API simulee : alertes du serveur par priorite et resolution
// motivee, ecart et prudence entre deux periodes, filtres transmis au
// serveur, dotation EPI et signature d'un plan de prevention.

const ELEMENTS = [
  { nature: 'alerte', priorite: 3, gravite: 'warning', categorie: 'Maintenance', objet: 'Immobilisation longue : CAM-01', reference: null,
    detail: 'Immobilisé depuis 100 h (seuil 48 h)', depuis: '2026-11-10T08:00:00Z', ecran: 'immobilisations', alerte_id: 'al2', statut: 'active',
    regle: 'immobilisation_longue', condition_levee_le: '2026-11-14T08:00:00Z', detectee_le: '2026-11-12T08:00:00Z' },
  { nature: 'validation', priorite: 2, gravite: null, categorie: 'Achats', objet: 'Bon de commande à approuver', reference: 'BC-2026-00009',
    detail: '70000 GNF', depuis: '2026-11-14T08:00:00Z', ecran: 'purchases', alerte_id: null, statut: null, regle: null, condition_levee_le: null, detectee_le: null },
  { nature: 'alerte', priorite: 1, gravite: 'critical', categorie: 'HSE', objet: 'Contrôle avant départ non conforme : CAM-02', reference: null,
    detail: 'Freins : fuite', depuis: '2026-11-15T06:00:00Z', ecran: 'controles-depart', alerte_id: 'al1', statut: 'active',
    regle: 'controle_non_conforme', condition_levee_le: null, detectee_le: '2026-11-15T06:05:00Z' },
];
const REGLES = [
  { regle: 'immobilisation_longue', libelle: 'Immobilisation longue', domaine: 'Maintenance', cle: 'alerte_immobilisation_longue_h', type_reglage: 'seuil', unite: 'h',
    gravite: 'warning', description: 'Immobilisation ouverte', en_service: true, seuil: 48 },
  { regle: 'ecart_carburant', libelle: 'Écart d\'inventaire carburant', domaine: 'Carburant', cle: 'alerte_ecart_carburant_l', type_reglage: 'seuil', unite: 'L',
    gravite: 'warning', description: 'Inventaire', en_service: false, seuil: null },
];

const base = { calcule_le: '2026-11-15T12:00:00Z', detail: null, nature: 'periode' };
const kpi = (debut: string, fin: string, tonnes: number | null, fiabilite: string) => [
  { ...base, periode_debut: debut, periode_fin: fin, domaine: 'Production', code: 'tonnes_livrees', libelle: 'Tonnes livrées', valeur: tonnes, unite: 't', source: 'trips', fiabilite },
  { ...base, periode_debut: debut, periode_fin: fin, domaine: 'Flotte', code: 'engins_actifs', libelle: 'Engins en service', valeur: 12, unite: 'engins', source: 'vehicles', fiabilite: 'mesure', nature: 'instantane' },
];

const ouvrir = async (page: Page, groupe: string, ecran: string) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  const entree = page.getByRole('button', { name: ecran, exact: true });
  await expect(page.getByRole('button', { name: groupe, exact: true })).toBeVisible();
  if (!(await entree.isVisible())) await page.getByRole('button', { name: groupe, exact: true }).click();
  await entree.click();
};

test.describe('Centre des decisions et HSE (D-068)', () => {
  test('alertes du serveur par priorite, resolution motivee', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL });
    const actualisations: unknown[] = [];
    const resolutions: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/actualiser_alertes', (route) => { actualisations.push(1); return repondre(route, 0); });
    await page.route('**/rest/v1/rpc/centre_decisions', (route) => repondre(route, ELEMENTS));
    await page.route('**/rest/v1/rpc/regles_alertes', (route) => repondre(route, REGLES));
    await page.route('**/rest/v1/rpc/resoudre_alerte', (route) => { resolutions.push(route.request().postDataJSON()); return repondre(route, null); });
    await ouvrir(page, 'Exploitation', 'Centre des décisions');
    await expect(page.getByRole('heading', { name: 'Centre des décisions' })).toBeVisible();
    await expect(page.getByText('Contrôle avant départ non conforme : CAM-02')).toBeVisible();
    const titres = await page.locator('h2').allInnerTexts();
    const rang = (t: string) => titres.findIndex((x) => x.includes(t));
    expect(rang('Critique')).toBeGreaterThan(-1);
    expect(rang('Critique')).toBeLessThan(rang('Décision en attente'));
    expect(rang('Décision en attente')).toBeLessThan(rang('Avertissement'));
    await expect(page.getByText('Condition levée le')).toBeVisible();
    await expect(page.getByText('Inactive : seuil non saisi (alerte_ecart_carburant_l)')).toBeVisible();
    await expect(page.getByText('Active : seuil 48 h')).toBeVisible();
    expect(actualisations.length).toBeGreaterThan(0);
    const resoudre = page.getByRole('button', { name: 'Résoudre Immobilisation longue : CAM-01' });
    await expect(resoudre).toBeDisabled();
    await page.getByLabel('Motif de résolution Immobilisation longue : CAM-01').fill('Remise en service validée');
    await resoudre.click();
    await expect.poll(() => resolutions.length).toBe(1);
    expect(resolutions[0]).toMatchObject({ p_alerte: 'al2', p_motif: 'Remise en service validée' });
    await page.getByRole('button', { name: 'Ouvrir Bon de commande à approuver' }).click();
    await expect(page.getByRole('heading', { name: 'Achats', exact: true })).toBeVisible();
  });

  test('comparaison de periodes : ecart, prudence et filtres transmis au serveur', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL, sites: [{ id: 's1', name: 'Mine Nimba' }], work_shifts: [{ id: 'w1', name: 'jour', display_name: 'Jour', start_time: '00:00:00', end_time: '23:59:00', is_active: true }],
      vehicles: [{ id: 'v1', registration: 'CAM-01', transporteur: 'Transports Kaloum', proprietaire: null, exploitant: null }] });
    const appels: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/indicateurs_pilotage', (route) => {
      const a = route.request().postDataJSON() as Record<string, string>;
      appels.push(a);
      return repondre(route, a.p_debut === '2026-09-01' ? kpi('2026-09-01', '2026-09-30', 1000, 'mesure') : kpi(a.p_debut, a.p_fin, 1250, 'partielle'));
    });
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Centre de pilotage', exact: true }).click();
    await page.getByLabel('Comparer').check();
    await page.getByLabel('Début de la période A').fill('2026-09-01');
    await page.getByLabel('Fin de la période A').fill('2026-09-30');
    const ligne = page.getByTestId('cmp-tonnes_livrees');
    await expect(ligne).toContainText('+250');
    await expect(ligne).toContainText('+25 %');
    await expect(ligne).toContainText('À interpréter avec prudence');
    await expect(ligne).toContainText('Valeur partielle');
    await expect(page.getByTestId('cmp-engins_actifs')).toContainText('Non comparable');
    await page.getByLabel('Shift', { exact: true }).selectOption('w1');
    await page.getByLabel('Partenaire', { exact: true }).selectOption('Transports Kaloum');
    await expect.poll(() => appels.some((a) => a.p_shift === 'w1' && a.p_partenaire === 'Transports Kaloum')).toBe(true);
    await expect(page.getByRole('button', { name: 'Imprimer' })).toBeEnabled();
  });

  test('prevention HSE : dotation EPI et signature d\'un plan de prevention', async ({ page }) => {
    await simulerApi(page, {
      profiles: PROFIL, sites: [{ id: 's1', name: 'Mine Nimba' }], drivers: [{ id: 'c1', name: 'Mamadou Camara' }],
      dotations_epi: [{ id: 'e1', numero: 'EPI-2025-00001', site_id: 's1', beneficiaire: 'Mamadou Camara', driver_id: 'c1', type_epi: 'casque', designation: null,
        taille: null, quantite: 1, remis_le: '2025-01-10', echeance_renouvellement: '2026-01-10', statut: 'remis', restitue_le: null, etat_restitution: null, motif_annulation: null }],
      v_risques_courants: [], programmes_inspection: [], inspections: [],
      v_plans_prevention: [{ id: 'p1', numero: 'PDP-2026-00001', version: 1, site_id: 's1', intervenant: 'Neemba Guinée', responsable_intervenant: null,
        perimetre: 'Atelier', risques: 'Levage', mesures: 'Consignation', valide_du: '2026-11-15', valide_au: '2026-12-15', statut: 'brouillon', etat: 'brouillon',
        signataire: null, signe_le: null, motif_annulation: null }],
    });
    const appels: { fn: string; args: Record<string, unknown> }[] = [];
    for (const fn of ['remettre_epi', 'signer_plan_prevention']) {
      await page.route(`**/rest/v1/rpc/${fn}`, (route) => { appels.push({ fn, args: route.request().postDataJSON() }); return repondre(route, null); });
    }
    await ouvrir(page, 'RH & Sécurité', 'Prévention HSE');
    await expect(page.getByText('À renouveler')).toBeVisible();
    await page.getByRole('button', { name: 'Renouveler EPI-2025-00001' }).click();
    await page.getByLabel('Échéance de renouvellement').fill('2027-11-15');
    await page.getByRole('button', { name: 'Enregistrer la dotation' }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ fn: 'remettre_epi', args: { p_site: 's1', p_type: 'casque', p_quantite: 1, p_remplace: 'e1', p_driver: 'c1', p_echeance: '2027-11-15' } });
    await page.getByRole('button', { name: 'Plans de prévention' }).click();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Signer PDP-2026-00001 v1' }).click();
    await expect.poll(() => appels.length).toBe(2);
    expect(appels[1]).toMatchObject({ fn: 'signer_plan_prevention', args: { p_plan: 'p1' } });
  });
});
