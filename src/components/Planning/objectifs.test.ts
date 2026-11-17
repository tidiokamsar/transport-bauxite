import { describe, expect, it } from 'vitest';
import { erreursObjectif, requeteScenario, scenarioDepuisRequete, type SaisieObjectif } from './objectifs';

const SAISIE: SaisieObjectif = { date: '2026-11-17', site: 's1', shift: '', tonnes: '4800', voyages: '', camions: '20', chargeuses: '', motif: '', note: '' };

describe('objectifs de production (D-023, D-090)', () => {
  it('tonnes > 0, motif exige pour une revision (miroir de definir_objectif)', () => {
    expect(erreursObjectif(SAISIE, false)).toEqual([]);
    expect(erreursObjectif({ ...SAISIE, tonnes: '0' }, false)).toEqual(['Indiquez un objectif en tonnes supérieur à zéro.']);
    expect(erreursObjectif(SAISIE, true)).toEqual(['Motif de la révision obligatoire (nouvelle version).']);
    expect(erreursObjectif({ ...SAISIE, site: '' }, false)).toEqual(['Choisissez le site de chargement.']);
    expect(erreursObjectif({ ...SAISIE, camions: '2,5' }, false)).toHaveLength(1);
  });
  it('scenario retenu transmis par l\'adresse', () => {
    const s = { titre: 'Réviser l\'objectif à 560 t', tonnes: 560, camions: null, chargeuses: 2 };
    expect(scenarioDepuisRequete(requeteScenario(s))).toEqual(s);
    expect(scenarioDepuisRequete({ scenario: 'x', tonnes: 'abc' })).toBeNull();
    expect(scenarioDepuisRequete({})).toBeNull();
  });
});
