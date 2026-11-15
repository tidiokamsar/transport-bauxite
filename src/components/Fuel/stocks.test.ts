import { describe, expect, it } from 'vitest';
import { alerteStockage } from './stocks';

const base = { actif: true, solde_litres: 5000, capacite_litres: 30000, seuil_alerte_litres: 3000 };

describe('alerteStockage (D-041)', () => {
  it('sans inventaire d\'ouverture : aucune valeur deduite', () => {
    expect(alerteStockage({ ...base, solde_litres: null })?.texte).toBe('Inventaire d\'ouverture requis');
  });
  it('solde negatif et depassement de capacite signales en rouge', () => {
    expect(alerteStockage({ ...base, solde_litres: -10 })?.teinte).toBe('rouge');
    expect(alerteStockage({ ...base, solde_litres: 30001 })?.teinte).toBe('rouge');
  });
  it('seuil d\'alerte atteint, seuil absent ou niveau normal', () => {
    expect(alerteStockage({ ...base, solde_litres: 3000 })?.teinte).toBe('orange');
    expect(alerteStockage({ ...base, solde_litres: 100, seuil_alerte_litres: null })).toBeNull();
    expect(alerteStockage(base)).toBeNull();
  });
  it('stockage inactif', () => {
    expect(alerteStockage({ ...base, actif: false })?.texte).toBe('Inactif');
  });
});
