import { expect, test } from '@playwright/test';
import { PROFIL, repondre, simulerApi } from './api-simulee';

// Centre de pilotage (D-057) avec l'API simulee : chaque indicateur affiche
// sa fiabilite et sa source ; sans donnees, la valeur l'indique.

const base = { periode_debut: '2026-11-01', periode_fin: '2026-11-15', calcule_le: '2026-11-15T12:00:00Z', detail: null };
const INDICATEURS = [
  { ...base, domaine: 'Production', code: 'tonnes_livrees', libelle: 'Tonnes livrées', valeur: 1240.5, unite: 't', source: 'trips : tonnage accepté', fiabilite: 'partielle', detail: '2 voyage(s) livré(s) sans poids, non comptés' },
  { ...base, domaine: 'Production', code: 'realisation', libelle: 'Réalisation de l\'objectif', valeur: null, unite: '%', source: 'tonnes livrées / objectif', fiabilite: 'sans_donnees' },
  { ...base, domaine: 'Carburant', code: 'litres_distribues', libelle: 'Litres distribués (validés)', valeur: 8300, unite: 'L', source: 'mouvements_carburant', fiabilite: 'mesure' },
];

test.describe('Centre de pilotage', () => {
  test('indicateurs avec fiabilite, source et periode', async ({ page }) => {
    await simulerApi(page, { profiles: PROFIL, sites: [{ id: 's1', name: 'Mine Nimba' }] });
    const appels: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/indicateurs_pilotage', (route) => { appels.push(route.request().postDataJSON()); return repondre(route, INDICATEURS); });
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Centre de pilotage', exact: true }).click();
    const tonnes = page.getByTestId('kpi-tonnes_livrees');
    await expect(tonnes).toContainText('Partiel');
    await expect(tonnes).toContainText('sans poids');
    await expect(page.getByTestId('kpi-realisation')).toContainText('Sans données');
    await expect(page.getByTestId('kpi-litres_distribues')).toContainText('Source : mouvements_carburant');
    await page.getByLabel('Site', { exact: true }).selectOption('s1');
    await expect.poll(() => appels.some((a) => a.p_site === 's1')).toBe(true);
  });
});
