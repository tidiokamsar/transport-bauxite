import { describe, expect, it } from 'vitest';
import { bornesMoisCalendaires, statutLigne } from './facturation';

describe('facturation', () => {
  it('statut d\'une ligne : decision, sinon anomalie bloquante (miroir du serveur)', () => {
    expect(statutLigne(null, [])).toBe('facturable');
    expect(statutLigne(null, ['sans_fiche'])).toBe('facturable');
    expect(statutLigne(null, ['ecart_hors_tolerance', 'sans_fiche'])).toBe('a_examiner');
    expect(statutLigne('exclue', ['litige'])).toBe('exclue');
    expect(statutLigne('facturable', ['ecart_hors_tolerance'])).toBe('facturable');
  });

  it('bornes d\'un mois, fevrier bissextile compris', () => {
    expect(bornesMoisCalendaires('2026-11')).toEqual({ debut: '2026-11-01', fin: '2026-11-30' });
    expect(bornesMoisCalendaires('2028-02')).toEqual({ debut: '2028-02-01', fin: '2028-02-29' });
  });
});
