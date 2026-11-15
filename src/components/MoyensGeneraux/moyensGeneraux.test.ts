import { describe, expect, it } from 'vitest';
import { actionsPossibles, amortissementLineaire, moisEcoules, normaliserNumero, planAmortissement, texteMontant } from './moyensGeneraux';

describe('moyens generaux (D-060)', () => {
  it('normalise le numero d inventaire comme le serveur', () => {
    expect(normaliserNumero('  pc   001 ')).toBe('PC 001');
  });

  it('propose les operations permises par le statut', () => {
    expect(actionsPossibles('en_stock')).toEqual(['affecter', 'transferer', 'constater', 'reparer', 'reformer']);
    expect(actionsPossibles('affecte')).toContain('remettre');
    expect(actionsPossibles('remis')).not.toContain('reformer');
    expect(actionsPossibles('remis')).not.toContain('transferer');
    expect(actionsPossibles('reforme')).toEqual([]);
  });

  it('compte les mois entiers comme age() de Postgres', () => {
    expect(moisEcoules('2026-01-31', '2026-02-28')).toBe(0);
    expect(moisEcoules('2026-01-31', '2026-03-31')).toBe(2);
    expect(moisEcoules('2026-02-28', '2026-03-31')).toBe(1);
    expect(moisEcoules('2025-05-15', '2026-11-15')).toBe(18);
  });

  it('amortit lineairement, borne a la duree, sans donnees si une valeur manque', () => {
    expect(amortissementLineaire(1200000, '2026-05-15', 12, '2026-11-15')).toEqual({ moisAmortis: 6, dotationMensuelle: 100000, cumul: 600000, valeurNette: 600000 });
    expect(amortissementLineaire(1200000, '2020-01-01', 12, '2026-11-15')?.valeurNette).toBe(0);
    expect(amortissementLineaire(1200000, '2026-12-01', 12, '2026-11-15')?.cumul).toBe(0);
    expect(amortissementLineaire(null, '2026-05-15', 12, '2026-11-15')).toBeNull();
    expect(amortissementLineaire(1200000, null, 12, '2026-11-15')).toBeNull();
    expect(amortissementLineaire(1200000, '2026-05-15', null, '2026-11-15')).toBeNull();
  });

  it('etablit un plan annuel dont le cumul atteint la valeur', () => {
    const plan = planAmortissement(3600000, '2026-04-01', 36);
    expect(plan.map((l) => l.annee)).toEqual([2026, 2027, 2028, 2029]);
    expect(plan[0]).toMatchObject({ dotation: 800000, valeurNette: 2800000 });
    expect(plan[plan.length - 1].valeurNette).toBe(0);
    expect(plan.reduce((s, l) => s + l.dotation, 0)).toBe(3600000);
    expect(planAmortissement(3600000, '2026-04-01', null)).toEqual([]);
  });

  it('affiche sans donnees pour un montant absent', () => {
    expect(texteMontant(null)).toBe('Sans données');
    expect(texteMontant(1500000)).toMatch(/^1.500.000 GNF$/);
  });
});
