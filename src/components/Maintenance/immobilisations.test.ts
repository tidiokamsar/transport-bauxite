import { describe, expect, it } from 'vitest';
import {
  actionImmobilisationInterdite, bornesMois, disponibilite, erreursDeclaration, formatDuree, heuresDansPeriode, totalParImputation, type Immobilisation,
} from './immobilisations';

const h = (jour: number, heure: number) => new Date(2026, 10, jour, heure);
const immo = (debut: Date, fin: Date | null, imputation: Immobilisation['imputation'], statut: Immobilisation['statut'] = fin ? 'cloturee' : 'ouverte'): Immobilisation => ({
  id: `${debut.getTime()}`, vehicle_id: 'v', debut: debut.toISOString(), fin: fin?.toISOString() ?? null,
  cause: 'panne', imputation, description: 'x', reference_loueur: null, statut,
});

describe('immobilisations', () => {
  const { du, au } = bornesMois('2026-11');

  it('bornes du mois', () => {
    expect(du).toEqual(new Date(2026, 10, 1));
    expect(au).toEqual(new Date(2026, 11, 1));
  });

  it('heures bornees a la periode ; ouverte jusqu\'a maintenant', () => {
    expect(heuresDansPeriode(immo(new Date(2026, 9, 31, 20), h(1, 4), 'loueur'), du, au, h(10, 12))).toBe(4);
    expect(heuresDansPeriode(immo(h(10, 2), null, 'loueur'), du, au, h(10, 12))).toBe(10);
    expect(heuresDansPeriode(immo(h(10, 2), null, 'loueur'), du, au, h(9, 12))).toBe(0);
  });

  it('totaux par imputation, annulees exclues', () => {
    const liste = [
      immo(h(2, 6), h(2, 18), 'loueur'),
      immo(h(3, 6), h(3, 9), 'exploitant'),
      immo(h(4, 6), h(4, 9), 'loueur', 'annulee'),
      immo(h(10, 10), null, 'a_determiner'),
    ];
    expect(totalParImputation(liste, du, au, h(10, 12))).toEqual({ loueur: 12, exploitant: 3, a_determiner: 2 });
  });

  it('disponibilite de la flotte sur les heures ecoulees', () => {
    // 2 engins, 24 h ecoulees, 12 h d'immobilisation : 75 %
    expect(disponibilite(12, 2, h(1, 0), h(30, 0), h(2, 0))).toBe(75);
    expect(disponibilite(12, 0, h(1, 0), h(30, 0), h(2, 0))).toBeNull();
    expect(disponibilite(0, 2, h(5, 0), h(30, 0), h(2, 0))).toBeNull();
  });

  it('format des durees', () => {
    expect(formatDuree(0.75)).toBe('45 min');
    expect(formatDuree(5 + 1 / 3)).toBe('5 h 20');
    expect(formatDuree(6)).toBe('6 h');
    expect(formatDuree(76)).toBe('3 j 4 h');
    expect(formatDuree(48)).toBe('2 j');
  });
});

describe('immobilisations : pages (D-090)', () => {
  it('cloture refusee si une intervention du loueur est en cours', () => {
    expect(actionImmobilisationInterdite('cloturer', 'ouverte', true, false)).toBeNull();
    expect(actionImmobilisationInterdite('cloturer', 'ouverte', true, true)).toMatch(/remise en service/);
    expect(actionImmobilisationInterdite('cloturer', 'cloturee', true, false)).toMatch(/déjà clôturée/);
    expect(actionImmobilisationInterdite('corriger', 'cloturee', true, false)).toBeNull();
    expect(actionImmobilisationInterdite('annuler', 'annulee', true, false)).toMatch(/annulée/);
    expect(actionImmobilisationInterdite('annuler', 'ouverte', false, false)).toMatch(/Droit/);
  });

  it('declaration : imputation sans valeur par defaut, debut non futur', () => {
    const base = { engin: 'v1', debut: '2026-11-10T08:00', cause: 'panne', imputation: 'loueur', description: 'Fuite', reference: '' };
    expect(erreursDeclaration(base, new Date(2026, 10, 10, 12))).toEqual([]);
    expect(erreursDeclaration({ ...base, imputation: '' }, new Date(2026, 10, 10, 12))).toContain('Imputation requise (aucune valeur par défaut).');
    expect(erreursDeclaration(base, new Date(2026, 10, 10, 7)).join()).toMatch(/futur/);
  });
});
