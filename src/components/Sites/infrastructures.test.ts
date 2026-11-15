import { describe, expect, it } from 'vitest';
import { fermetureActive, finEffective } from './infrastructures';

const a = new Date('2026-11-15T10:00:00Z');

describe('fermetures de site (D-047)', () => {
  it('active entre le debut et la fin, ou sans fin', () => {
    expect(fermetureActive({ debut: '2026-11-15T00:00:00Z', fin: '2026-11-17T00:00:00Z', levee_le: null }, a)).toBe(true);
    expect(fermetureActive({ debut: '2026-11-15T00:00:00Z', fin: null, levee_le: null }, a)).toBe(true);
    expect(fermetureActive({ debut: '2026-11-16T00:00:00Z', fin: null, levee_le: null }, a)).toBe(false);
  });
  it('une levee anticipee termine la fermeture', () => {
    const f = { debut: '2026-11-15T00:00:00Z', fin: '2026-11-17T00:00:00Z', levee_le: '2026-11-15T08:00:00Z' };
    expect(finEffective(f)?.toISOString()).toBe('2026-11-15T08:00:00.000Z');
    expect(fermetureActive(f, a)).toBe(false);
  });
});
