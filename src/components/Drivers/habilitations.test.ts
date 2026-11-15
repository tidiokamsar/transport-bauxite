import { describe, expect, it } from 'vitest';
import { etatHabilitation } from './habilitations';

const a = new Date('2026-11-16T10:00:00Z');

describe('etatHabilitation (D-051)', () => {
  it('valide, expirant, expiree, a venir, revoquee', () => {
    expect(etatHabilitation({ delivre_le: '2026-01-01', expire_le: '2027-06-01', revoque_le: null }, a).texte).toBe('Valide');
    expect(etatHabilitation({ delivre_le: '2026-01-01', expire_le: '2026-12-01', revoque_le: null }, a).texte).toBe('Expire dans 15 j');
    expect(etatHabilitation({ delivre_le: '2025-01-01', expire_le: '2026-11-15', revoque_le: null }, a).texte).toBe('Expirée');
    expect(etatHabilitation({ delivre_le: '2026-12-01', expire_le: null, revoque_le: null }, a).texte).toBe('À venir');
    expect(etatHabilitation({ delivre_le: '2026-01-01', expire_le: null, revoque_le: '2026-11-10T00:00:00Z' }, a).texte).toBe('Révoquée');
  });
  it('sans echeance : valide', () => {
    expect(etatHabilitation({ delivre_le: '2026-01-01', expire_le: null, revoque_le: null }, a).teinte).toBe('vert');
  });
});
