import { describe, expect, it } from 'vitest';
import { raisonReaffectation, recommander, voyagesAPreparer, type Chauffeur, type Engin, type VoyageShift } from './recommandation';

const DATE = '2026-11-10';
const MINE = 'mine';
const camion = (id: string, status = 'active', site: string | null = MINE): Engin => ({ id, registration: id.toUpperCase(), vehicle_type: 'tipper', status, site_id: site });
const engin = (id: string, type = 'loader'): Engin => ({ id, registration: id.toUpperCase(), vehicle_type: type, status: 'active', site_id: MINE });
const chauffeur = (id: string, name: string, expiry = '2027-01-01', status = 'active'): Chauffeur => ({ id, name, status, license_expiry: expiry });
const voyage = (id: string, extra: Partial<VoyageShift> = {}): VoyageShift => ({
  id, reference: `VYG-${id}`, etat: 'PLANNED', departure_site_id: MINE, vehicle_id: null, driver_id: null, loader_vehicle_id: null, ...extra,
});

describe('recommandation du dispatch', () => {
  it('repartit les voyages sur les camions les moins charges, avec un chauffeur par camion', () => {
    const voyages = [voyage('1'), voyage('2'), voyage('3')];
    const r = recommander({
      date: DATE,
      voyages,
      cibles: voyages.map((v) => ({ voyage: v })),
      engins: [camion('c1'), camion('c2'), engin('l1'), engin('p1', 'excavator')],
      chauffeurs: [chauffeur('a', 'Alpha'), chauffeur('b', 'Bah')],
      habitudes: new Map([['c2', 'b']]),
    });
    expect(r.map((x) => [x.camion?.id, x.chauffeur?.id, x.engin?.id])).toEqual([
      ['c1', 'a', 'l1'],
      ['c2', 'b', 'p1'],
      ['c1', 'a', 'l1'],
    ]);
    expect(r[1].explications).toContain('Bah est le chauffeur habituel de ce camion (14 jours)');
    expect(r[2].explications).toContain('Alpha est déjà au volant de ce camion sur le shift');
  });

  it('exclut camions indisponibles, autres sites, permis expires et chauffeurs deja pris', () => {
    const voyages = [voyage('1', { vehicle_id: 'c1', driver_id: 'a', etat: 'ASSIGNED' }), voyage('2')];
    const r = recommander({
      date: DATE,
      voyages,
      cibles: [{ voyage: voyages[1] }],
      engins: [camion('c1'), camion('c2', 'immobilized'), camion('c3', 'active', 'autre'), camion('c4')],
      chauffeurs: [chauffeur('a', 'Alpha'), chauffeur('e', 'Expiré', '2026-11-01'), chauffeur('z', 'Zoé')],
      habitudes: new Map([['c4', 'e']]),
    });
    expect([r[0].camion?.id, r[0].chauffeur?.id]).toEqual(['c4', 'z']);
  });

  it('annonce l\'impossibilite au lieu de proposer une affectation invalide', () => {
    const v = voyage('1');
    const sansCamion = recommander({ date: DATE, voyages: [v], cibles: [{ voyage: v }], engins: [camion('c1', 'maintenance')], chauffeurs: [chauffeur('a', 'Alpha')], habitudes: new Map() });
    expect(sansCamion[0]).toMatchObject({ camion: null, impossible: 'Aucun camion disponible sur le site' });
    const sansChauffeur = recommander({ date: DATE, voyages: [v], cibles: [{ voyage: v }], engins: [camion('c1')], chauffeurs: [chauffeur('e', 'Expiré', '2026-01-01')], habitudes: new Map() });
    expect(sansChauffeur[0].impossible).toBe('Aucun chauffeur disponible au permis valide');
  });

  it('voyages a reaffecter : camion ou chauffeur devenu indisponible', () => {
    const camions = new Map([['c1', camion('c1', 'immobilized')], ['c2', camion('c2')]]);
    const chauffeurs = new Map([['a', chauffeur('a', 'Alpha')], ['s', chauffeur('s', 'Sylla', '2027-01-01', 'suspended')]]);
    expect(raisonReaffectation(voyage('1', { etat: 'ASSIGNED', vehicle_id: 'c1', driver_id: 'a' }), camions, chauffeurs, DATE)).toBe('Camion C1 indisponible (immobilisé)');
    expect(raisonReaffectation(voyage('2', { etat: 'ASSIGNED', vehicle_id: 'c2', driver_id: 's' }), camions, chauffeurs, DATE)).toBe('Chauffeur Sylla indisponible');
    expect(raisonReaffectation(voyage('3', { etat: 'ASSIGNED', vehicle_id: 'c2', driver_id: 'a' }), camions, chauffeurs, DATE)).toBeNull();
    expect(raisonReaffectation(voyage('4', { etat: 'IN_TRANSIT', vehicle_id: 'c1', driver_id: 'a' }), camions, chauffeurs, DATE)).toBeNull();
  });

  it('nombre de voyages a preparer depuis l\'objectif', () => {
    expect(voyagesAPreparer(null, 40, 0)).toBeNull();
    expect(voyagesAPreparer({ tonnes_cible: 4800, voyages_cible: 118 }, 40, 18)).toMatchObject({ nombre: 100 });
    expect(voyagesAPreparer({ tonnes_cible: 4800, voyages_cible: null }, 40, 0)).toMatchObject({ nombre: 120 });
    expect(voyagesAPreparer({ tonnes_cible: 4800, voyages_cible: null }, null, 0)).toBeNull();
    expect(voyagesAPreparer({ tonnes_cible: 100, voyages_cible: 2 }, 40, 5)).toMatchObject({ nombre: 0 });
  });
});
