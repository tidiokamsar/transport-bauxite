import { describe, expect, it } from 'vitest';
import { SAISIE_BUDGET_VIDE, budgetNonModifiable, chaineVersions, erreursBudget, lireMontantBudget, remplacantDe, type VersionBudget } from './budgets';

const v = (id: string, remplace: string | null): VersionBudget => ({
  id, numero: `BUD-${id}`, periode_debut: '2026-01-01', periode_fin: '2026-12-31', site_id: null, nature_id: 'n1', devise: 'GNF', montant_ttc: 1,
  note: null, remplace_id: remplace, motif_revision: remplace ? 'hausse' : null, statut: 'actif', annule_par: null, annule_le: null, motif_annulation: null,
  cree_par: null, cree_le: '2026-01-01T00:00:00Z',
});

describe('budgets', () => {
  const saisie = { ...SAISIE_BUDGET_VIDE, debut: '2027-01-01', fin: '2027-12-31', nature: 'n1', devise: 'GNF', montant: '1 500 000' };
  it('saisie complete, motif exige en revision', () => {
    expect(lireMontantBudget('1 500 000')).toBe(1500000);
    expect(erreursBudget(saisie, false)).toEqual([]);
    expect(erreursBudget(saisie, true)).toEqual(['Motif de la révision requis.']);
    expect(erreursBudget({ ...saisie, fin: '2026-12-31' }, false)).toEqual(['Fin antérieure au début.']);
    expect(erreursBudget({ ...saisie, devise: 'gn' }, false)).toEqual(['Devise requise (code à trois lettres).']);
  });
  it('seul le budget courant se revise ou s\'annule', () => {
    expect(budgetNonModifiable(true, true)).toBeNull();
    expect(budgetNonModifiable(true, false)).toMatch(/courant/);
    expect(budgetNonModifiable(false, true)).toMatch(/Droit/);
  });
  it('chaine des versions par remplace_id, sans boucle', () => {
    const versions = [v('a', null), v('b', 'a'), v('c', 'b')];
    expect(chaineVersions(versions, 'c').map((x) => x.id)).toEqual(['c', 'b', 'a']);
    expect(remplacantDe(versions, 'a')?.id).toBe('b');
    expect(chaineVersions([v('x', 'y'), v('y', 'x')], 'x').map((x) => x.id)).toEqual(['x', 'y']);
  });
});
