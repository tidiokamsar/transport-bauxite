import type { TeintePuce } from '../ui/Panneau';
import { ecrireRoute } from '../ui/routeur';

// Regles d'affichage des paiements fournisseurs (D-055, D-090). Elles
// reprennent celles de l'ecran d'origine ; le serveur reste seul juge
// (droits, etat, separation des taches D-082, plafond au reste a payer).

export const VUE_PAIEMENTS = 'paiements';
export const MODULE_PAIEMENTS = 'Paiements fournisseurs';

export interface PiecePayable {
  source: 'facture_loueur' | 'bon_commande'; piece_id: string; piece: string; date_piece: string; base: number; engage: number; paye: number;
  reste: number; beneficiaire: string | null; devise: string;
}
export interface Paiement {
  id: string; numero: string; facture_fournisseur_id: string | null; purchase_order_id: string | null; beneficiaire: string; devise: string; objet: string;
  montant_propose: number; statut: string; propose_par: string | null; propose_le: string | null; decide_par: string | null; decide_le: string | null;
  motif_decision: string | null; execute_le: string | null; mode: string | null; reference_execution: string | null; montant_execute: number | null;
  execute_par: string | null; execute_saisi_le: string | null; annule_par: string | null; motif_annulation: string | null;
  controle_resultat: string | null; controle_motif: string | null; controle_par: string | null; controle_le: string | null;
}

export const STATUTS_PAIEMENT: Record<string, { texte: string; teinte: TeintePuce }> = {
  propose: { texte: 'Proposé', teinte: 'bleu' }, approuve: { texte: 'Approuvé', teinte: 'violet' }, rejete: { texte: 'Rejeté', teinte: 'rouge' },
  execute: { texte: 'Exécuté', teinte: 'vert' }, annule: { texte: 'Annulé', teinte: 'gris' },
};
export const MODES_PAIEMENT: Record<string, string> = { virement: 'Virement', cheque: 'Chèque', especes: 'Espèces', compensation: 'Compensation', autre: 'Autre' };

export const ACTIONS_PAIEMENT = ['approuver', 'rejeter', 'executer', 'annuler', 'conforme', 'anomalie'] as const;
export type ActionPaiement = typeof ACTIONS_PAIEMENT[number];

export interface DroitsPaiement { saisir: boolean; approuver: boolean; moi: string | null }

/** Raison pour laquelle l'action n'est pas proposee (droit, etat ou separation des taches), ou null. */
export const actionPaiementInterdite = (a: ActionPaiement, p: Paiement, d: DroitsPaiement): string | null => {
  switch (a) {
    case 'approuver':
    case 'rejeter':
      if (!d.approuver) return 'Droit d\'approbation des factures requis.';
      if (p.statut !== 'propose') return 'Seul un paiement proposé se décide.';
      if (p.propose_par && p.propose_par === d.moi) return 'L\'approbation revient à une autre personne que le proposant.';
      return null;
    case 'executer':
      if (!d.saisir) return 'Droit d\'écriture sur les factures requis.';
      return p.statut === 'approuve' ? null : 'Seul un paiement approuvé s\'exécute.';
    case 'annuler':
      if (!d.saisir) return 'Droit d\'écriture sur les factures requis.';
      return ['propose', 'approuve'].includes(p.statut) ? null : 'Paiement exécuté, rejeté ou annulé : non annulable.';
    case 'conforme':
    case 'anomalie':
      if (!d.approuver) return 'Droit d\'approbation des factures requis pour le contrôle.';
      if (p.statut !== 'execute') return 'Seul un paiement exécuté se contrôle.';
      if (p.controle_resultat !== null) return 'Paiement déjà contrôlé.';
      if ((p.propose_par && p.propose_par === d.moi) || (p.execute_par && p.execute_par === d.moi)) {
        return 'Le contrôle revient à une autre personne que le proposant et l\'exécutant.';
      }
      return null;
    default:
      return 'Action inconnue.';
  }
};

const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
export const montantPaiement = (v: number | null, devise: string) => (v === null ? 'Sans données' : `${nombre.format(v)} ${devise}`);

/** Page du bon a payer d'une piece payable. */
export const routeBonAPayer = (x: Pick<PiecePayable, 'source' | 'piece_id'>) =>
  ecrireRoute({ vue: VUE_PAIEMENTS, mode: 'nouveau', requete: { source: x.source, piece: x.piece_id } });

/** Montant saisi (virgule decimale et espaces acceptes) ; NaN si illisible. */
export const lireMontant = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(/\s/g, '').replace(',', '.')));

export const erreursProposition = (f: { montant: string; objet: string }, reste: number | null): string[] => {
  const m = lireMontant(f.montant);
  return [
    ...(!(m > 0) ? ['Montant positif requis.'] : reste !== null && m > reste ? ['Montant supérieur au reste à payer.'] : []),
    ...(!f.objet.trim() ? ['Objet du paiement requis.'] : []),
  ];
};

export const erreursExecution = (f: { date: string; mode: string; montant: string; reference: string }, approuve: number, aujourdhui: string): string[] => {
  const m = lireMontant(f.montant);
  return [
    ...(!f.date ? ['Date d\'exécution requise.'] : f.date > aujourdhui ? ['Date d\'exécution dans le futur.'] : []),
    ...(!f.mode ? ['Mode de paiement requis.'] : []),
    ...(!(m > 0) || m > approuve ? ['Montant exécuté positif, au plus égal à l\'approuvé.'] : []),
    ...(['virement', 'cheque'].includes(f.mode) && !f.reference.trim() ? ['Référence bancaire requise pour un virement ou un chèque.'] : []),
  ];
};
