import { describe, expect, it } from 'vitest';
import { LIGNE_PNEU, lignesPourServeur, lireNumerosPneus, operationsPossibles, restantARecevoir, totalSaisi } from './achats';

describe('achats (D-053)', () => {
  it('refuse une ligne sans prix ni designation', () => {
    expect(lignesPourServeur([{ article: '', designation: 'Filtre', quantite: '2', prix: '' }])).toBeNull();
    expect(lignesPourServeur([{ article: '', designation: '', quantite: '2', prix: '10' }])).toBeNull();
    expect(lignesPourServeur([{ article: 'a1', designation: '', quantite: '2', prix: '0' }]))
      .toEqual([{ article: 'a1', designation: null, quantite: 2, prix_unitaire: 0 }]);
  });

  it('calcule le total saisi avec les taxes', () => {
    expect(totalSaisi([{ article: '', designation: 'A', quantite: '3', prix: '1000' }, { article: 'a1', designation: '', quantite: '1', prix: '500' }], '200')).toBe(3700);
    expect(totalSaisi([{ article: '', designation: 'A', quantite: '3', prix: '1000' }], '-1')).toBeNull();
  });

  it('suit les operations permises et le reliquat', () => {
    expect(operationsPossibles('submitted')).toMatchObject({ decider: true, receptionner: false, annuler: true });
    expect(operationsPossibles('partially_received')).toMatchObject({ receptionner: true, solder: true, annuler: false });
    expect(restantARecevoir(10, 6)).toBe(4);
    expect(restantARecevoir(10, null)).toBe(10);
  });
});

describe('lignes de pneus (D-067)', () => {
  it('une ligne de pneus porte le modele, sans article', () => {
    expect(lignesPourServeur([{ article: LIGNE_PNEU, designation: '', quantite: '2', prix: '3000000', pneuMarque: ' Michelin ', pneuModele: 'XDR', pneuDimension: '' }]))
      .toEqual([{ article: null, designation: null, quantite: 2, prix_unitaire: 3000000, pneu: { marque: 'Michelin', modele: 'XDR', dimension: null } }]);
    expect(lignesPourServeur([{ article: LIGNE_PNEU, designation: '', quantite: '2', prix: '1', pneuMarque: 'Michelin', pneuModele: '' }])).toBeNull();
  });
  it('numeros de pneus : majuscules, sans doublon', () => {
    expect(lireNumerosPneus('pn-1\nPN-2')).toEqual(['PN-1', 'PN-2']);
    expect(lireNumerosPneus('pn-1, PN-1')).toBeNull();
  });
});
