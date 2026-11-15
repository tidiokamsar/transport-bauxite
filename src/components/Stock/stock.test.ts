import { describe, expect, it } from 'vitest';
import { alerteArticle } from './stock';

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
