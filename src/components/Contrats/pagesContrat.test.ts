import { describe, expect, it } from 'vitest';
import { erreursContrat, grilleVerrouillee } from './types';

const SAISIE = { reference: 'CBG-1', intitule: 'Transport', nature: 'client', contrepartie: 'CBG', devise: 'USD', date_debut: '2026-01-01', delai: '', preavis: '', duree: '' };

describe('saisie du dossier contractuel (D-026, D-090)', () => {
  it('saisie complete acceptee, devise ISO exigee', () => {
    expect(erreursContrat(SAISIE)).toEqual([]);
    expect(erreursContrat({ ...SAISIE, devise: 'us' })).toEqual(['Devise : code ISO de trois lettres (GNF, USD...).']);
    expect(erreursContrat({ ...SAISIE, duree: '0' })).toHaveLength(1);
    expect(erreursContrat({ ...SAISIE, reference: ' ', nature: '' })).toHaveLength(2);
  });
  it('grille verrouillee : contrat sorti du brouillon et version en vigueur ou passee', () => {
    expect(grilleVerrouillee('brouillon', { date_effet: '2026-01-01' }, '2026-11-17')).toBe(false);
    expect(grilleVerrouillee('actif', { date_effet: '2026-01-01' }, '2026-11-17')).toBe(true);
    expect(grilleVerrouillee('actif', { date_effet: '2026-12-01' }, '2026-11-17')).toBe(false);
  });
});
