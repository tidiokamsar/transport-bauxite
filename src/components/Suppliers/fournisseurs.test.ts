import { describe, expect, it } from 'vitest';
import {
  comparerOffres, etatDocument, lignesConsultationPourServeur, lignesOffrePourServeur, noteGlobale, type OffreComparee,
} from './fournisseurs';

const LIGNES = [
  { id: 'l1', designation: 'Filtre', quantite: 10 },
  { id: 'l2', designation: 'Transport', quantite: 2 },
];
const offre = (id: string, prix: Record<string, number>, delai: number, statut: OffreComparee['statut'] = 'recue', recueLe = '2026-11-10'): OffreComparee =>
  ({ id, fournisseur: `F-${id}`, prix, delai, statut, recueLe });

describe('comparerOffres', () => {
  it('classe les offres completes par montant puis delai', () => {
    const r = comparerOffres(LIGNES, [
      offre('a', { l1: 100, l2: 50 }, 7),
      offre('b', { l1: 90, l2: 60 }, 3),
      offre('c', { l1: 95, l2: 55 }, 10),
    ]);
    expect(r.offres.map((o) => [o.id, o.total, o.rang])).toEqual([['a', 1100, 3], ['b', 1020, 1], ['c', 1060, 2]]);
    expect(r.offres.find((o) => o.id === 'b')).toMatchObject({ moinsDisante: true, plusRapide: true, ecartPourcent: 0 });
    expect(r.offres.find((o) => o.id === 'a')?.ecartPourcent).toBe(7.8);
    expect(r.nbComparables).toBe(3);
  });

  it('ne classe pas une offre incomplete, meme moins chere', () => {
    const r = comparerOffres(LIGNES, [offre('a', { l1: 100, l2: 50 }, 7), offre('b', { l1: 10 }, 3)]);
    const b = r.offres.find((o) => o.id === 'b')!;
    expect(b).toMatchObject({ complete: false, rang: null, total: 100, lignesChiffrees: 1, moinsDisante: false, ecartPourcent: null });
    expect(r.offres.find((o) => o.id === 'a')).toMatchObject({ rang: 1, moinsDisante: true });
    expect(r.meilleurPrixParLigne).toEqual({ l1: ['b'], l2: ['a'] });
  });

  it('ignore les offres retirees et signale les offres hors delai', () => {
    const r = comparerOffres(LIGNES, [
      offre('a', { l1: 100, l2: 50 }, 7, 'recue', '2026-11-12'),
      offre('b', { l1: 1, l2: 1 }, 1, 'retiree'),
    ], '2026-11-11');
    expect(r.offres.map((o) => o.id)).toEqual(['a']);
    expect(r.offres[0]).toMatchObject({ horsDelai: true, rang: 1 });
  });

  it('ex aequo : meme rang', () => {
    const r = comparerOffres(LIGNES, [offre('a', { l1: 100, l2: 50 }, 5), offre('b', { l1: 100, l2: 50 }, 5)]);
    expect(r.offres.map((o) => o.rang)).toEqual([1, 1]);
    expect(r.meilleurPrixParLigne.l1).toEqual(['a', 'b']);
  });

  it('sans offre : rien a comparer', () => {
    expect(comparerOffres(LIGNES, [])).toEqual({ offres: [], meilleurPrixParLigne: { l1: [], l2: [] }, nbComparables: 0 });
  });
});

describe('etatDocument', () => {
  it('expire, a renouveler, valide, sans echeance', () => {
    expect(etatDocument('2026-11-14', '2026-11-15', 30)).toBe('expire');
    expect(etatDocument('2026-11-15', '2026-11-15', 30)).toBe('a_renouveler');
    expect(etatDocument('2026-12-15', '2026-11-15', 30)).toBe('a_renouveler');
    expect(etatDocument('2026-12-16', '2026-11-15', 30)).toBe('valide');
    expect(etatDocument(null, '2026-11-15', 30)).toBe('sans_echeance');
  });
});

describe('noteGlobale', () => {
  it('moyenne ponderee arrondie, comme le serveur', () => {
    expect(noteGlobale([{ note: 4, poids: 2 }, { note: 1, poids: 1 }])).toBe(3);
    expect(noteGlobale([{ note: 5, poids: 1 }, { note: 4, poids: 2 }])).toBe(4.33);
  });
  it('note manquante ou hors echelle : pas de note', () => {
    expect(noteGlobale([{ note: null, poids: 1 }])).toBeNull();
    expect(noteGlobale([{ note: 6, poids: 1 }])).toBeNull();
    expect(noteGlobale([])).toBeNull();
  });
});

describe('saisies', () => {
  it('lignes de consultation', () => {
    expect(lignesConsultationPourServeur([{ article: 'a1', designation: '', quantite: '4' }, { article: '', designation: ' Transport ', quantite: '1' }]))
      .toEqual([{ article: 'a1', designation: null, quantite: 4 }, { article: null, designation: 'Transport', quantite: 1 }]);
    expect(lignesConsultationPourServeur([{ article: '', designation: '', quantite: '4' }])).toBeNull();
    expect(lignesConsultationPourServeur([{ article: 'a1', designation: '', quantite: '0' }])).toBeNull();
  });
  it('prix d\'une offre : lignes vides non chiffrees, prix invalide refuse', () => {
    expect(lignesOffrePourServeur({ l1: '100', l2: '' })).toEqual([{ ligne: 'l1', prix_unitaire: 100 }]);
    expect(lignesOffrePourServeur({ l1: '', l2: '' })).toBeNull();
    expect(lignesOffrePourServeur({ l1: '12,5' })).toBeNull();
  });
});
