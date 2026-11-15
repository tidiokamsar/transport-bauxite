import { describe, expect, it } from 'vitest';
import { piecesValides } from './interventions';

describe('piecesValides (D-049)', () => {
  it('lignes vides ignorees, quantite positive exigee', () => {
    expect(piecesValides([{ designation: '', reference: '', quantite: '', fournie_par: 'loueur' }])).toBe(true);
    expect(piecesValides([{ designation: 'Flexible', reference: '', quantite: '1', fournie_par: 'loueur' }])).toBe(true);
    expect(piecesValides([{ designation: 'Flexible', reference: '', quantite: '0', fournie_par: 'exploitant' }])).toBe(false);
    expect(piecesValides([{ designation: 'Huile', reference: '', quantite: '2,5', fournie_par: 'exploitant' }])).toBe(true);
  });
});
