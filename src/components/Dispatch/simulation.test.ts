import { describe, expect, it } from 'vitest';
import { dureeShift, evaluerScenario, lireUnite, plafondSite, repartitionEgale, scenariosProposes, type CapaciteSaisie, type StatTrajet } from './simulation';

const stat = (id: string, extra: Partial<StatTrajet> = {}): StatTrajet => ({
  arrival_site_id: id, jours_observes: 5, voyages_livres: 20, charge_moyenne: 34, voyages_pesees: 20,
  cycle_moyen_min: 60, cycles_mesures: 20, rotation_moyenne_min: 120, rotations_mesurees: 15,
  rotation_min_observee: 100, rotation_max_observee: 150, ...extra,
});
const cap = (site: string, type: string, capacite: number, unite: string, code = 'C'): CapaciteSaisie =>
  ({ site_id: site, type, code, capacite, unite_capacite: unite, actif: true });

describe('unites de capacite', () => {
  it('lit les unites usuelles et refuse les autres', () => {
    expect(lireUnite('t/jour')).toEqual({ grandeur: 'tonnes', periode: 'jour' });
    expect(lireUnite('Voyages par heure')).toEqual({ grandeur: 'voyages', periode: 'heure' });
    expect(lireUnite('t/shift')).toEqual({ grandeur: 'tonnes', periode: 'shift' });
    expect(lireUnite('m3')).toBeNull();
    expect(lireUnite(null)).toBeNull();
  });

  it('ramene une capacite horaire a la duree, ignore une periode differente', () => {
    const r = plafondSite([cap('D', 'depot_reception', 50, 't/h', 'DA'), cap('D', 'depot_reception', 900, 't/jour', 'DB')], 'D', 'depot_reception', 'shift', 600);
    expect(r.plafonds).toEqual([{ grandeur: 'tonnes', valeur: 500, sources: ['DA : 50 t/h'] }]);
    expect(r.ignorees).toEqual(['DB (900 t/jour)']);
  });
});

describe('evaluation d\'un scenario', () => {
  it('voyages = camions x partie entiere (duree / rotation), tonnes = voyages x charge', () => {
    const r = evaluerScenario({
      scenario: { nom: 'A', repartition: { D: 4 } }, stats: [stat('D')], capacites: [], siteChargement: 'M',
      horizon: 'shift', dureeMin: 600, minMesures: 3,
    });
    expect(r.lignes[0]).toMatchObject({ statut: 'estime', voyagesParCamion: 5, voyages: 20, tonnes: 680 });
    expect(r).toMatchObject({ voyages: 20, tonnes: 680, complet: true });
  });

  it('signale les donnees insuffisantes sans rien estimer', () => {
    const r = evaluerScenario({
      scenario: { nom: 'B', repartition: { D: 2, E: 2 } }, stats: [stat('D'), stat('E', { rotations_mesurees: 1 })], capacites: [],
      siteChargement: 'M', horizon: 'shift', dureeMin: 600, minMesures: 3,
    });
    expect(r.lignes[1]).toMatchObject({ statut: 'insuffisant', voyages: null, tonnes: null });
    expect(r.lignes[1].remarques[0]).toContain('Données insuffisantes');
    expect(r).toMatchObject({ voyages: null, tonnes: null, complet: false });
  });

  it('sans pesee : voyages estimes, tonnes non estimees', () => {
    const r = evaluerScenario({
      scenario: { nom: 'C', repartition: { D: 1 } }, stats: [stat('D', { charge_moyenne: null })], capacites: [],
      siteChargement: 'M', horizon: 'shift', dureeMin: 600, minMesures: 3,
    });
    expect(r).toMatchObject({ voyages: 5, tonnes: null, complet: false });
  });

  it('plafonne par la capacite du depot et du point de chargement saisies', () => {
    const r = evaluerScenario({
      scenario: { nom: 'D', repartition: { D: 10 } }, stats: [stat('D')],
      capacites: [cap('D', 'depot_reception', 1000, 't/shift', 'DEP-A'), cap('M', 'point_chargement', 25, 'voyages/shift', 'PC-1')],
      siteChargement: 'M', horizon: 'shift', dureeMin: 600, minMesures: 3,
    });
    expect(r.lignes[0]).toMatchObject({ voyages: 50, tonnes: 1000 });
    expect(r.lignes[0].plafonne).toContain('DEP-A');
    expect(r).toMatchObject({ voyages: 25, tonnes: 850 });
    expect(r.plafonne).toContain('PC-1');
  });
});

describe('scenarios proposes', () => {
  it('tout vers les deux destinations les plus livrees, puis repartition egale', () => {
    const s = scenariosProposes([stat('E', { voyages_livres: 5 }), stat('D', { voyages_livres: 30 })], 5, (id) => `site ${id}`);
    expect(s.map((x) => x.nom)).toEqual(['Toutes les rotations vers site D', 'Toutes les rotations vers site E', 'Répartition égale']);
    expect(s[0].repartition).toEqual({ D: 5, E: 0 });
    expect(s[2].repartition).toEqual({ D: 3, E: 2 });
  });

  it('repartition egale et duree de shift', () => {
    expect(repartitionEgale([], 4)).toEqual({});
    expect(dureeShift('06:00:00', '18:00:00')).toBe(720);
    expect(dureeShift('18:00:00', '06:00:00')).toBe(720);
  });
});
