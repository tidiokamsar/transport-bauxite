import { describe, expect, it } from 'vitest';
import { actionPosteInterdite, lireRetard, resumeBilan } from './postes';

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

describe('actions de poste (D-048, D-090)', () => {
  const droits = { exploiter: true, valider: true };
  it('un poste ouvert ou en cours s\'exploite, un poste clos se valide', () => {
    expect(actionPosteInterdite('affecter', 'ouvert', droits)).toBeNull();
    expect(actionPosteInterdite('cloturer', 'en_cours', droits)).toBeNull();
    expect(actionPosteInterdite('consigner', 'cloture', droits)).toMatch(/Clos, à valider/);
    expect(actionPosteInterdite('valider', 'cloture', droits)).toBeNull();
    expect(actionPosteInterdite('valider', 'ouvert', droits)).toMatch(/Seul un poste clos/);
    expect(actionPosteInterdite('pointer', 'ouvert', { exploiter: false, valider: true })).toMatch(/Droit/);
  });
  it('retard : vide ou entier', () => {
    expect(lireRetard('')).toEqual({ valeur: null, erreur: null });
    expect(lireRetard(' 15 ')).toEqual({ valeur: 15, erreur: null });
    expect(lireRetard('dix').erreur).toMatch(/entier/);
  });
});
