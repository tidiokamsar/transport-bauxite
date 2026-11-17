import { describe, expect, it } from 'vitest';
import { clotureInterdite, comptesLignes, decisionInterdite, erreursOuvertureReconciliation } from './reconciliation';

describe('reconciliation (D-029, D-082, D-090)', () => {
  const ouverte = { statut: 'ouverte' as const };
  const droits = { ecrire: true, approuver: false };
  it('comptes des lignes', () => {
    expect(comptesLignes([
      { decision: null, anomalies: [], tonnage_base: 40 },
      { decision: null, anomalies: ['ecart_hors_tolerance'], tonnage_base: 37 },
      { decision: 'exclue', anomalies: ['litige'], tonnage_base: 30 },
    ])).toEqual({ facturable: 1, a_examiner: 1, exclue: 1, tonnes: 40 });
  });
  it('ticket rectifie : facturation reservee a un approbateur', () => {
    const ligne = { anomalies: ['ticket_rectifie'], decision: null };
    expect(decisionInterdite('facturable', ouverte, ligne, droits)).toMatch(/approbateur/);
    expect(decisionInterdite('facturable', ouverte, ligne, { ecrire: true, approuver: true })).toBeNull();
    expect(decisionInterdite('exclue', ouverte, ligne, droits)).toBeNull();
    expect(decisionInterdite('aucune', ouverte, ligne, droits)).toMatch(/Aucune décision/);
    expect(decisionInterdite('exclue', { statut: 'cloturee' }, ligne, droits)).toMatch(/clôturée/);
  });
  it('cloture bloquee par une ligne a examiner', () => {
    expect(clotureInterdite(ouverte, 1, true)).toMatch(/à examiner/);
    expect(clotureInterdite(ouverte, 0, true)).toBeNull();
  });
  it('ouverture : saisie complete exigee', () => {
    expect(erreursOuvertureReconciliation({ contrat: '', mois: '2026-10', base: 'accepte', tolerance: '2' })).toHaveLength(1);
    expect(erreursOuvertureReconciliation({ contrat: 'c1', mois: '2026-10', base: 'accepte', tolerance: '2,5' })).toEqual([]);
    expect(erreursOuvertureReconciliation({ contrat: 'c1', mois: '2026-10', base: '', tolerance: '' })).toHaveLength(2);
  });
});
