import { describe, expect, it } from 'vitest';
import {
  LIGNE_PNEU, actionBonInterdite, erreursBon, lignesPourServeur, lignesReceptionPourServeur, lireNumerosPneus, operationsPossibles, restantARecevoir, totalSaisi,
} from './achats';

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

describe('pages standard des achats (D-090)', () => {
  const tous = { acheter: true, approuver: true, receptionner: true };
  it('refuse une action selon le droit, le statut et l\'auteur', () => {
    expect(actionBonInterdite('soumettre', 'draft', tous)).toBeNull();
    expect(actionBonInterdite('soumettre', 'submitted', tous)).toMatch(/Soumis/);
    expect(actionBonInterdite('approuver', 'submitted', { ...tous, approuver: false })).toMatch(/approbation/);
    expect(actionBonInterdite('approuver', 'submitted', tous, true)).toMatch(/autre personne/);
    expect(actionBonInterdite('receptionner', 'approved', { ...tous, receptionner: false })).toMatch(/stocks/);
    expect(actionBonInterdite('annuler-reception', 'received', tous)).toBeNull();
    expect(actionBonInterdite('annuler-reception', 'approved', tous)).not.toBeNull();
    expect(actionBonInterdite('solder', 'partially_received', tous)).toBeNull();
  });
  it('lignes de reception : reliquat, refus motive, lots et pneus exiges', () => {
    const lignes = [
      { id: 'l1', quantity: 10, quantity_received: 0, pneu_marque: null, suivi: 'aucun' as const },
      { id: 'l2', quantity: 4, quantity_received: 0, pneu_marque: null, suivi: 'lot' as const },
      { id: 'l3', quantity: 2, quantity_received: 0, pneu_marque: 'Michelin', suivi: 'aucun' as const },
    ];
    const vide = { recue: '', refusee: '', motif: '' };
    expect(lignesReceptionPourServeur(lignes, {})).toBeNull();
    expect(lignesReceptionPourServeur(lignes, { l1: { ...vide, recue: '6', refusee: '1' } })).toBeNull();
    expect(lignesReceptionPourServeur(lignes, { l1: { ...vide, recue: '6', refusee: '1', motif: 'Abîmé' } }))
      .toEqual([{ ligne: 'l1', recue: 6, refusee: 1, motif_refus: 'Abîmé' }]);
    expect(lignesReceptionPourServeur(lignes, { l1: { ...vide, recue: '11' } })).toBeNull();
    expect(lignesReceptionPourServeur(lignes, { l2: { ...vide, recue: '4' } })).toBeNull();
    expect(lignesReceptionPourServeur(lignes, { l2: { ...vide, recue: '4', lots: 'L9 4' }, l3: { ...vide, recue: '2', pneus: 'pn-1\npn-2' } }))
      .toEqual([{ ligne: 'l2', recue: 4, refusee: 0, motif_refus: null, lots: [{ code: 'L9', quantite: 4 }] },
        { ligne: 'l3', recue: 2, refusee: 0, motif_refus: null, pneus: [{ numero: 'PN-1' }, { numero: 'PN-2' }] }]);
  });
  it('erreurs du brouillon', () => {
    expect(erreursBon({ fournisseur: '', depot: 'w', taxes: '0' }, [{ article: 'a', designation: '', quantite: '1', prix: '1' }])).toEqual(['Fournisseur requis.']);
    expect(erreursBon({ fournisseur: 'f', depot: 'w', taxes: '-1' }, [{ article: 'a', designation: '', quantite: '1', prix: '1' }])).toHaveLength(1);
  });
});
