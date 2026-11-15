import { describe, expect, it } from 'vitest';
import { mesurer, motifRequis } from './kilometrage';

describe('mesurer (D-043)', () => {
  it('trajet charge et retour a vide depuis les trois releves', () => {
    expect(mesurer([
      { moment: 'depart_charge', valeur_km: 10000 }, { moment: 'arrivee_depot', valeur_km: 10052 }, { moment: 'fin_rotation', valeur_km: 10105 },
    ])).toEqual({ charge: 52, retour: 53 });
  });
  it('releve manquant ou incoherent : pas de distance', () => {
    expect(mesurer([{ moment: 'depart_charge', valeur_km: 10000 }])).toEqual({ charge: null, retour: null });
    expect(mesurer([{ moment: 'depart_charge', valeur_km: 10000 }, { moment: 'arrivee_depot', valeur_km: 9990 }]).charge).toBeNull();
  });
});

describe('motifRequis', () => {
  it('pas de motif quand la validation reprend la mesure', () => {
    expect(motifRequis({ charge: 52, retour: 53 }, 52, 53)).toBe(false);
    expect(motifRequis({ charge: 52, retour: null }, 52, null)).toBe(false);
  });
  it('motif quand la distance differe ou que la mesure manque', () => {
    expect(motifRequis({ charge: 52, retour: 53 }, 50, 53)).toBe(true);
    expect(motifRequis({ charge: null, retour: null }, 52, null)).toBe(true);
    expect(motifRequis({ charge: 52, retour: null }, 52, 50)).toBe(true);
  });
});
