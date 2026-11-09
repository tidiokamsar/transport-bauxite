import { describe, expect, it } from 'vitest';
import {
  bilanVoyages, debutJour, disponibilite, positionFraiche, repartitionFlotte, tonnageVoyage,
  tonnesParHeure, variation,
} from './indicateurs';

const voyage = (net: number | null, charge: number | null, arrivee: string | null) => ({
  net_weight: net,
  load_weight: charge,
  actual_arrival_time: arrivee,
});

describe('indicateurs du tableau de bord', () => {
  it('tonnage : poids net, sinon chargement, sinon absent', () => {
    expect(tonnageVoyage({ net_weight: 52, load_weight: 60 })).toBe(52);
    expect(tonnageVoyage({ net_weight: null, load_weight: 60 })).toBe(60);
    expect(tonnageVoyage({ net_weight: null, load_weight: null })).toBeNull();
  });

  it('bilan : un voyage sans poids est compte a part, pas comme 0 tonne cache', () => {
    const b = bilanVoyages([voyage(50, null, null), voyage(null, null, null), voyage(null, 40, null)]);
    expect(b).toEqual({ voyages: 3, tonnes: 90, voyagesSansPoids: 1 });
  });

  it('variation : non calculable si la veille vaut 0', () => {
    expect(variation(110, 100)).toBeCloseTo(10);
    expect(variation(5, 0)).toBeNull();
  });

  it('debut de jour local', () => {
    const d = debutJour(new Date(2026, 10, 9, 15, 30), -1);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 8, 0]);
  });

  it('tonnes par heure : rien sans donnees, sinon fenetre 6 h - 18 h au minimum', () => {
    expect(tonnesParHeure([])).toEqual([]);
    const h = (heure: number) => new Date(2026, 10, 9, heure, 10).toISOString();
    const serie = tonnesParHeure([voyage(50, null, h(7)), voyage(30, null, h(7)), voyage(20, null, h(20))]);
    expect(serie[0]).toEqual({ heure: 6, tonnes: 0 });
    expect(serie.find((p) => p.heure === 7)?.tonnes).toBe(80);
    expect(serie[serie.length - 1]).toEqual({ heure: 20, tonnes: 20 });
  });

  it('repartition de la flotte et disponibilite', () => {
    const r = repartitionFlotte(
      [
        { id: 'a', status: 'active' },
        { id: 'b', status: 'active' },
        { id: 'c', status: 'maintenance' },
        { id: 'd', status: 'immobilized' },
        { id: 'e', status: 'sold' },
      ],
      new Set(['a']),
    );
    expect(r).toEqual({ enMission: 1, disponibles: 1, maintenance: 1, immobilises: 1, total: 4 });
    expect(disponibilite(r)).toBe(50);
    expect(disponibilite({ enMission: 0, disponibles: 0, maintenance: 0, immobilises: 0, total: 0 })).toBeNull();
  });

  it('une position de plus de 15 minutes n\'est pas fraiche', () => {
    const maintenant = new Date('2026-11-09T12:00:00Z');
    expect(positionFraiche('2026-11-09T11:50:00Z', maintenant)).toBe(true);
    expect(positionFraiche('2026-11-09T11:40:00Z', maintenant)).toBe(false);
  });
});
