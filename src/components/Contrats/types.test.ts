import { describe, expect, it } from 'vitest';
import { libelleVersion, versionEnVigueur, type Version } from './types';

const v = (numero: number, date_effet: string): Version => ({
  id: String(numero), contrat_id: 'c', numero, intitule: `v${numero}`, date_effet, date_signature: null, resume: null, document_ref: null,
});

describe('dossier contractuel', () => {
  it('version en vigueur : dernier avenant entre en effet a la date', () => {
    const versions = [v(0, '2026-01-01'), v(1, '2026-06-01'), v(2, '2026-12-01')];
    expect(versionEnVigueur(versions, '2026-11-10')?.numero).toBe(1);
    expect(versionEnVigueur(versions, '2026-12-01')?.numero).toBe(2);
    expect(versionEnVigueur(versions, '2025-12-31')).toBeNull();
  });

  it('libelles de version', () => {
    expect(libelleVersion({ numero: 0, intitule: 'Transport' })).toBe('Contrat initial · Transport');
    expect(libelleVersion({ numero: 2, intitule: 'Révision des taux' })).toBe('Avenant n° 2 · Révision des taux');
  });
});
