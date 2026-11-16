import { describe, expect, it } from 'vitest';
import { enNombre, siteCorrespond, verifierCapacite, verifierCoordonnees } from './saisieSite';

describe('saisie des sites (D-079)', () => {
  it('coordonnees : facultatives, ensemble, bornees', () => {
    expect(verifierCoordonnees('', '')).toBe('');
    expect(verifierCoordonnees('7,65', '-8.40')).toBe('');
    expect(verifierCoordonnees('7.65', '')).toMatch(/ensemble/);
    expect(verifierCoordonnees('', '-8')).toMatch(/ensemble/);
    expect(verifierCoordonnees('95', '-8')).toMatch(/Latitude/);
    expect(verifierCoordonnees('7', '-181')).toMatch(/Longitude/);
    expect(verifierCoordonnees('abc', '1')).toMatch(/Latitude/);
  });

  it('capacite en tonnes : vide ou strictement positive', () => {
    expect(verifierCapacite('')).toBe('');
    expect(verifierCapacite('12 500')).toBe('');
    expect(enNombre('12 500,5')).toBe(12500.5);
    expect(verifierCapacite('0')).toMatch(/strictement positive/);
    expect(verifierCapacite('-3')).toMatch(/strictement positive/);
  });

  it('recherche : ville ou adresse vide ne plante pas', () => {
    const site = { name: 'Mine Nimba', city: null, address: undefined };
    expect(siteCorrespond(site, 'nimba')).toBe(true);
    expect(siteCorrespond(site, 'conakry')).toBe(false);
    expect(siteCorrespond({ name: 'Dépôt', city: 'Kamsar', address: null }, 'KAM')).toBe(true);
    expect(siteCorrespond(site, '')).toBe(true);
  });
});
