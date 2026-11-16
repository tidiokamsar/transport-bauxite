import { describe, expect, it } from 'vitest';
import { alerteArticle, lireLots, lotsPourMouvement, texteCmp, texteValeur, totalLots } from './stock';

describe('alerteArticle (D-044)', () => {
  it('rupture, seuil atteint, niveau normal', () => {
    expect(alerteArticle({ active: true, quantity_in_stock: 0, minimum_threshold: 5 })?.texte).toBe('Rupture');
    expect(alerteArticle({ active: true, quantity_in_stock: 5, minimum_threshold: 5 })?.teinte).toBe('orange');
    expect(alerteArticle({ active: true, quantity_in_stock: 6, minimum_threshold: 5 })).toBeNull();
  });
  it('sans seuil, aucune alerte de niveau ; article archive signale', () => {
    expect(alerteArticle({ active: true, quantity_in_stock: 1, minimum_threshold: null })).toBeNull();
    expect(alerteArticle({ active: false, quantity_in_stock: 3, minimum_threshold: 5 })?.texte).toBe('Archivé');
  });
});

describe('lots et numeros de serie (D-067)', () => {
  it('lit les lots CODE QUANTITE, normalise et refuse les doublons', () => {
    expect(lireLots('lot', ' l1 3\nL2;2 ')).toEqual([{ code: 'L1', quantite: 3 }, { code: 'L2', quantite: 2 }]);
    expect(lireLots('lot', 'L1')).toBeNull();
    expect(lireLots('lot', 'L1 2\nl1 1')).toBeNull();
    expect(lireLots('aucun', 'sans objet')).toEqual([]);
  });
  it('series : une unite par numero ; total egal a la quantite', () => {
    expect(lireLots('serie', 's1, S2\nS3')).toEqual([{ code: 'S1', quantite: 1 }, { code: 'S2', quantite: 1 }, { code: 'S3', quantite: 1 }]);
    expect(lotsPourMouvement('serie', 'S1\nS2', 3)).toBeNull();
    expect(lotsPourMouvement('lot', 'L1 2\nL2 1', 3)).toHaveLength(2);
    expect(totalLots([{ code: 'A', quantite: 2 }, { code: 'B', quantite: 5 }])).toBe(7);
  });
});

describe('valorisation (D-067)', () => {
  it('valeur du serveur, jamais estimee a l\'ecran', () => {
    expect(texteValeur(null, 'sans_donnees')).toBe('Sans données');
    expect(texteValeur(22500, 'partielle')).toMatch(/22\s500 GNF \(partielle\)/);
    expect(texteValeur(30000, 'complete')).toMatch(/30\s000 GNF$/);
    expect(texteCmp(null)).toBe('Sans données');
  });
});
