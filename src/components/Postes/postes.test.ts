import { describe, expect, it } from 'vitest';
import { resumeBilan } from './postes';

describe('resumeBilan (D-048)', () => {
  it('objectif et livraisons absents restent « sans données »', () => {
    expect(resumeBilan({ tonnes_cible: null, tonnes_livrees: null, voyages: 0, voyages_livres: 0, presents: 1, absents: 1, evenements: 2, fige_le: '' }))
      .toBe('Objectif sans données, livré sans données · 0/0 voyage(s) livré(s) · 1 présent(s), 1 absent(s) · 2 événement(s)');
  });
  it('bilan chiffre', () => {
    expect(resumeBilan({ tonnes_cible: 1200, tonnes_livrees: 980, voyages: 30, voyages_livres: 25, presents: 12, absents: 0, evenements: 0, fige_le: '' }))
      .toContain('25/30 voyage(s) livré(s)');
  });
});
