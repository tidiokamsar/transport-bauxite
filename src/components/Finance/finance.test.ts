import { describe, expect, it } from 'vitest';
import { bornesMois, lignesExportComptable, totauxDettes, type Dette, type Ecriture } from './finance';

const dette = (beneficiaire: string | null, devise: string, du: number): Dette => ({
  source: 'facture_loueur', piece_id: beneficiaire ?? 'x', piece: 'P', date_piece: '2026-11-01', beneficiaire, devise,
  base: du, paye: 0, du, paiements_en_cours: 0, reste_a_proposer: du, anciennete_jours: 10,
});

describe('budgets, dettes et export comptable (D-065)', () => {
  it('export : compte de tiers vide si non parametre, aucun numero suppose', () => {
    const e: Ecriture = {
      type_ecriture: 'facture_emise', date_ecriture: '2026-11-30', piece: 'FAC-2026-0001', piece_liee: null, tiers: 'CBG', compte_tiers: null,
      libelle: 'Transport', montant_ht: 1000, montant_taxe: 180, montant: 1180, devise: 'USD', sens: 'a_recevoir',
    };
    expect(lignesExportComptable([e])[0]).toEqual({
      type: 'Facture émise', date: '2026-11-30', numero_piece: 'FAC-2026-0001', piece_liee: '', tiers: 'CBG', compte_tiers: '',
      libelle: 'Transport', montant_ht: 1000, taxe: 180, montant: 1180, devise: 'USD', sens: 'a_recevoir',
    });
  });

  it('dettes totalisees par beneficiaire et par devise, jamais entre devises', () => {
    expect(totauxDettes([dette('Neemba', 'USD', 100), dette('Neemba', 'USD', 50), dette('Neemba', 'GNF', 7000), dette(null, 'GNF', 1)])).toEqual([
      { beneficiaire: 'Neemba', devise: 'GNF', du: 7000, pieces: 1 },
      { beneficiaire: 'Neemba', devise: 'USD', du: 150, pieces: 2 },
      { beneficiaire: 'Non renseigné', devise: 'GNF', du: 1, pieces: 1 },
    ]);
  });

  it('bornes d\'un mois', () => {
    expect(bornesMois('2026-02')).toEqual({ du: '2026-02-01', au: '2026-02-28' });
    expect(bornesMois('2024-02').au).toBe('2024-02-29');
  });
});
