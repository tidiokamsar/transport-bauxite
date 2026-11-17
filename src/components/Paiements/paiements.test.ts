import { describe, expect, it } from 'vitest';
import { actionPaiementInterdite, erreursExecution, erreursProposition, lireMontant, routeBonAPayer, type Paiement } from './paiements';

const base: Paiement = {
  id: 'p1', numero: 'PAY-1', facture_fournisseur_id: 'f1', purchase_order_id: null, beneficiaire: 'Neemba', devise: 'USD', objet: 'Solde',
  montant_propose: 300, statut: 'propose', propose_par: 'a', propose_le: '2026-11-10T08:00:00Z', decide_par: null, decide_le: null, motif_decision: null,
  execute_le: null, mode: null, reference_execution: null, montant_execute: null, execute_par: null, execute_saisi_le: null, annule_par: null,
  motif_annulation: null, controle_resultat: null, controle_motif: null, controle_par: null, controle_le: null,
};
const tous = { saisir: true, approuver: true, moi: 'b' };

describe('actions d\'un paiement', () => {
  it('approbation par une autre personne que le proposant', () => {
    expect(actionPaiementInterdite('approuver', base, tous)).toBeNull();
    expect(actionPaiementInterdite('approuver', base, { ...tous, moi: 'a' })).toMatch(/autre personne/);
    expect(actionPaiementInterdite('rejeter', base, { ...tous, approuver: false })).toMatch(/Droit/);
  });
  it('execution d\'un paiement approuve seulement, annulation avant execution', () => {
    expect(actionPaiementInterdite('executer', base, tous)).toMatch(/approuvé/);
    expect(actionPaiementInterdite('executer', { ...base, statut: 'approuve' }, tous)).toBeNull();
    expect(actionPaiementInterdite('annuler', { ...base, statut: 'approuve' }, tous)).toBeNull();
    expect(actionPaiementInterdite('annuler', { ...base, statut: 'execute' }, tous)).toMatch(/non annulable/);
  });
  it('controle unique, ni par le proposant ni par l\'executant', () => {
    const execute = { ...base, statut: 'execute', execute_par: 'c' };
    expect(actionPaiementInterdite('conforme', execute, tous)).toBeNull();
    expect(actionPaiementInterdite('anomalie', execute, { ...tous, moi: 'c' })).toMatch(/autre personne/);
    expect(actionPaiementInterdite('conforme', { ...execute, controle_resultat: 'conforme' }, tous)).toMatch(/déjà/);
  });
});

describe('saisies', () => {
  it('montant lu avec virgule et espaces', () => {
    expect(lireMontant('1 500,5')).toBe(1500.5);
    expect(lireMontant('')).toBeNaN();
  });
  it('bon a payer plafonne au reste', () => {
    expect(erreursProposition({ montant: '700', objet: 'x' }, 680)).toEqual(['Montant supérieur au reste à payer.']);
    expect(erreursProposition({ montant: '680', objet: '' }, 680)).toEqual(['Objet du paiement requis.']);
    expect(erreursProposition({ montant: '680', objet: 'x' }, 680)).toEqual([]);
  });
  it('execution : reference exigee pour virement et cheque', () => {
    const f = { date: '2026-11-14', mode: 'virement', montant: '300', reference: '' };
    expect(erreursExecution(f, 300, '2026-11-17')).toEqual(['Référence bancaire requise pour un virement ou un chèque.']);
    expect(erreursExecution({ ...f, mode: 'especes' }, 300, '2026-11-17')).toEqual([]);
    expect(erreursExecution({ ...f, reference: 'V', montant: '301' }, 300, '2026-11-17')).toHaveLength(1);
    expect(erreursExecution({ ...f, reference: 'V', date: '2026-11-18' }, 300, '2026-11-17')).toEqual(['Date d\'exécution dans le futur.']);
  });
  it('route du bon a payer', () => {
    expect(routeBonAPayer({ source: 'facture_loueur', piece_id: 'f1' })).toBe('#/paiements/nouveau?source=facture_loueur&piece=f1');
  });
});
