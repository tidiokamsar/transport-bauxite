import { describe, expect, it } from 'vitest';
import { actionInterventionInterdite, lireNombre, piecesValides } from './interventions';

describe('piecesValides (D-049)', () => {
  it('lignes vides ignorees, quantite positive exigee', () => {
    expect(piecesValides([{ designation: '', reference: '', quantite: '', fournie_par: 'loueur' }])).toBe(true);
    expect(piecesValides([{ designation: 'Flexible', reference: '', quantite: '1', fournie_par: 'loueur' }])).toBe(true);
    expect(piecesValides([{ designation: 'Flexible', reference: '', quantite: '0', fournie_par: 'exploitant' }])).toBe(false);
    expect(piecesValides([{ designation: 'Huile', reference: '', quantite: '2,5', fournie_par: 'exploitant' }])).toBe(true);
  });
});

describe('actions d\'une intervention (D-049, D-090)', () => {
  it('etat requis par action', () => {
    expect(actionInterventionInterdite('prendre-en-charge', 'demandee', true, null, 'u1')).toBeNull();
    expect(actionInterventionInterdite('terminer', 'demandee', true, null, 'u1')).toMatch(/impossible/);
    expect(actionInterventionInterdite('valider', 'terminee', true, 'u2', 'u1')).toBeNull();
    expect(actionInterventionInterdite('refuser', 'remise_validee', true, null, 'u1')).toMatch(/impossible/);
    expect(actionInterventionInterdite('valider', 'terminee', false, 'u2', 'u1')).toMatch(/Droit/);
  });

  it('remise en service decidee par une autre personne que celle qui a saisi la fin', () => {
    expect(actionInterventionInterdite('valider', 'terminee', true, 'u1', 'u1')).toMatch(/autre personne/);
    expect(actionInterventionInterdite('refuser', 'terminee', true, 'u1', 'u1')).toMatch(/autre personne/);
  });

  it('lecture des nombres saisis', () => {
    expect(lireNombre('')).toBeNull();
    expect(lireNombre('4,5')).toBe(4.5);
    expect(lireNombre('1 200')).toBe(1200);
    expect(Number.isNaN(lireNombre('abc'))).toBe(true);
  });
});
