import { describe, expect, it } from 'vitest';
import { encaissementInterdit, niveauSuivant, relanceInterdite } from './creances';

describe('recouvrement (D-031, D-090)', () => {
  it('encaissement : reste du et droit', () => {
    expect(encaissementInterdit({ reste: 400 }, true)).toBeNull();
    expect(encaissementInterdit({ reste: 0 }, true)).toMatch(/soldée/);
    expect(encaissementInterdit({ reste: 400 }, false)).toMatch(/Droit/);
  });
  it('relance : apres echeance, trois niveaux au plus', () => {
    expect(relanceInterdite({ reste: 400, jours_retard: 7, derniere_relance_niveau: null }, true)).toBeNull();
    expect(relanceInterdite({ reste: 400, jours_retard: 0, derniere_relance_niveau: null }, true)).toMatch(/Échéance/);
    expect(relanceInterdite({ reste: 400, jours_retard: 7, derniere_relance_niveau: 3 }, true)).toMatch(/maximal/);
    expect(niveauSuivant({ derniere_relance_niveau: null })).toBe(1);
    expect(niveauSuivant({ derniere_relance_niveau: 2 })).toBe(3);
  });
});
