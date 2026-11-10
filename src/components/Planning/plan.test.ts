import { describe, expect, it } from 'vitest';
import { camionsNecessaires, fenetreJournee, fenetreShift, suivre, totalJournee } from './plan';

const JOUR = { start_time: '06:00:00', end_time: '18:00:00' };
const NUIT = { start_time: '18:00:00', end_time: '06:00:00' };
const heure = (h: number, m = 0, j = 10) => new Date(2026, 10, j, h, m);

describe('planification', () => {
  it('fenetres de shift, y compris la nuit qui finit le lendemain', () => {
    expect(fenetreShift('2026-11-10', JOUR)).toEqual({ debut: heure(6), fin: heure(18) });
    expect(fenetreShift('2026-11-10', NUIT)).toEqual({ debut: heure(18), fin: heure(6, 0, 11) });
    expect(fenetreJournee('2026-11-10', [JOUR, NUIT])).toEqual({ debut: heure(6), fin: heure(6, 0, 11) });
    expect(fenetreJournee('2026-11-10', [])).toEqual({ debut: heure(0), fin: heure(0, 0, 11) });
  });

  it('suivi : pourcentage, ecart, projection au rythme constate, rythme requis', () => {
    const f = fenetreShift('2026-11-10', JOUR);
    const s = suivre(1200, 300, f, heure(9));
    expect(s.avancement).toBe('en_cours');
    expect(s.pourcentage).toBe(25);
    expect(s.ecart).toBe(-900);
    expect(s.prevision).toBe(1200);
    expect(s.rythmeRequis).toBe(100);
  });

  it('pas de projection avant 15 % du shift (30 min au moins) ni avant le debut ; shift termine = realise', () => {
    const f = fenetreShift('2026-11-10', JOUR);
    expect(suivre(1200, 10, f, heure(6, 20)).prevision).toBeNull();
    expect(suivre(1200, 100, f, heure(7, 40)).prevision).toBeNull();
    expect(suivre(1200, 110, f, heure(7, 50)).prevision).toBeCloseTo(720);
    const avant = suivre(1200, 0, f, heure(5));
    expect(avant.avancement).toBe('a_venir');
    expect(avant.prevision).toBeNull();
    expect(avant.rythmeRequis).toBe(100);
    const fini = suivre(1200, 1300, f, heure(19));
    expect(fini).toMatchObject({ avancement: 'termine', prevision: 1300, rythmeRequis: null, ecart: 100 });
  });

  it('camions necessaires : estimation seulement avec un historique suffisant', () => {
    const stats = { jours_observes: 14, voyages: 1600, charge_moyenne: 40, rotations_par_camion: 6, camions_par_jour: 19 };
    expect(camionsNecessaires(5000, stats)).toEqual({ camions: 21, charge: 40, rotations: 6 });
    expect(camionsNecessaires(5000, { ...stats, jours_observes: 2 })).toBeNull();
    expect(camionsNecessaires(5000, { ...stats, voyages: 9 })).toBeNull();
    expect(camionsNecessaires(5000, { ...stats, charge_moyenne: null })).toBeNull();
    expect(camionsNecessaires(5000, null)).toBeNull();
  });

  it('journee : objectif de journee prioritaire, sinon somme des shifts, par site', () => {
    expect(totalJournee([])).toBeNull();
    expect(totalJournee([
      { site_id: 'a', shift_id: 'jour', tonnes_cible: 3000, tonnes_livrees: 1000 },
      { site_id: 'a', shift_id: 'nuit', tonnes_cible: 2000, tonnes_livrees: 500 },
      { site_id: 'b', shift_id: null, tonnes_cible: 1000, tonnes_livrees: 800 },
      { site_id: 'b', shift_id: 'jour', tonnes_cible: 600, tonnes_livrees: 600 },
    ])).toEqual({ cible: 6000, realise: 2300 });
  });
});
