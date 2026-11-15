import { describe, expect, it } from 'vitest';
import { lireReleveCsv, normaliserDate, normaliserNombre } from './releveCbg';

describe('lecture du releve CBG (D-050)', () => {
  it('separateur point-virgule, decimales a virgule, dates francaises', () => {
    const r = lireReleveCsv('N° ticket;Date pesée;Immatriculation;Poids brut;Tare\nT-1;03/09/2026;RC 5001 A;60,5;20\nT-2;3/9/2026;RC-5002;61;20,2');
    expect(r.erreur).toBeUndefined();
    expect(r.lignes).toEqual([
      { ticket: 'T-1', date: '2026-09-03', immatriculation: 'RC 5001 A', brut: '60.5', tare: '20', net: '' },
      { ticket: 'T-2', date: '2026-09-03', immatriculation: 'RC-5002', brut: '61', tare: '20.2', net: '' },
    ]);
  });
  it('separateur virgule et guillemets', () => {
    const r = lireReleveCsv('ticket,date,net\n"T,3",2026-09-04,"40.5"');
    expect(r.lignes[0]).toMatchObject({ ticket: 'T,3', date: '2026-09-04', net: '40.5' });
  });
  it('valeur illisible laissee vide, jamais deduite', () => {
    expect(normaliserNombre('abc')).toBe('');
    expect(normaliserDate('demain')).toBe('');
  });
  it('en-tete sans ticket ou sans poids refuse', () => {
    expect(lireReleveCsv('date;net\n2026-09-04;40').erreur).toContain('ticket');
    expect(lireReleveCsv('ticket;date\nT-1;2026-09-04').erreur).toContain('poids');
  });
});
