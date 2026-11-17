import type { TeintePuce } from '../ui/Panneau';
import { lotsPourMouvement, type SuiviArticle } from '../Stock/stock';

// Circuit achat (D-053) : statuts et operations permises, memes regles que
// les fonctions serveur.

export type StatutBon = 'draft' | 'submitted' | 'approved' | 'partially_received' | 'received' | 'closed' | 'rejected' | 'cancelled';

export const STATUTS_BON: Record<StatutBon, { texte: string; teinte: TeintePuce }> = {
  draft: { texte: 'Brouillon', teinte: 'gris' },
  submitted: { texte: 'Soumis', teinte: 'bleu' },
  approved: { texte: 'Approuvé', teinte: 'violet' },
  partially_received: { texte: 'Reçu en partie', teinte: 'orange' },
  received: { texte: 'Reçu', teinte: 'vert' },
  closed: { texte: 'Soldé', teinte: 'vert' },
  rejected: { texte: 'Rejeté', teinte: 'rouge' },
  cancelled: { texte: 'Annulé', teinte: 'gris' },
};

/** Valeur de la liste « Article » pour une ligne de pneus (registre des pneus, D-067). */
export const LIGNE_PNEU = '__pneu__';

export interface LigneSaisie {
  article: string; designation: string; quantite: string; prix: string;
  pneuMarque?: string; pneuModele?: string; pneuDimension?: string;
}

const entier = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : null);

interface LigneServeur {
  article: string | null; designation: string | null; quantite: number; prix_unitaire: number;
  pneu?: { marque: string; modele: string; dimension: string | null };
}

// Lignes envoyees au serveur ; null si une ligne est incomplete. Une ligne
// de pneus porte le modele (marque et modele requis), sans article.
export const lignesPourServeur = (lignes: LigneSaisie[]): LigneServeur[] | null => {
  if (lignes.length === 0) return null;
  const sortie = lignes.map((l): LigneServeur | null => {
    const quantite = entier(l.quantite);
    const prix = entier(l.prix);
    if (!quantite || prix === null) return null;
    if (l.article === LIGNE_PNEU) {
      const marque = (l.pneuMarque ?? '').trim();
      const modele = (l.pneuModele ?? '').trim();
      if (!marque || !modele) return null;
      return { article: null, designation: l.designation.trim() || null, quantite, prix_unitaire: prix,
        pneu: { marque, modele, dimension: (l.pneuDimension ?? '').trim() || null } };
    }
    if (!l.article && !l.designation.trim()) return null;
    return { article: l.article || null, designation: l.designation.trim() || null, quantite, prix_unitaire: prix };
  });
  return sortie.every((l) => l !== null) ? (sortie as LigneServeur[]) : null;
};

/** Numeros de pneus saisis a la reception : un par ligne, en majuscules, sans doublon. */
export const lireNumerosPneus = (texte: string): string[] | null => {
  const numeros = texte.split(/[\n,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);
  return new Set(numeros).size === numeros.length ? numeros : null;
};

export const totalSaisi = (lignes: LigneSaisie[], taxes: string) => {
  const l = lignesPourServeur(lignes);
  const t = entier(taxes || '0');
  if (!l || t === null) return null;
  return l.reduce((s, x) => s + x.quantite * x.prix_unitaire, 0) + t;
};

export const restantARecevoir = (commande: number, recue: number | null) => Math.max(0, commande - (recue ?? 0));

export const operationsPossibles = (statut: StatutBon) => ({
  modifier: statut === 'draft',
  soumettre: statut === 'draft',
  decider: statut === 'submitted',
  receptionner: statut === 'approved' || statut === 'partially_received',
  annuler: statut === 'draft' || statut === 'submitted' || statut === 'approved',
  solder: statut === 'partially_received',
});

// Pages standard (D-090) : vue du menu, actions d'un bon et refus selon le
// droit et le statut (memes conditions que les fonctions serveur).

export const VUE_ACHATS = 'purchases';
export const MODULE_ACHATS = 'Achats';

export const ACTIONS_BON = ['soumettre', 'approuver', 'rejeter', 'receptionner', 'solder', 'annuler', 'annuler-reception'] as const;
export type ActionBon = typeof ACTIONS_BON[number];

export interface DroitsAchat { acheter: boolean; approuver: boolean; receptionner: boolean }

/** Raison du refus d'une action (droit, statut, auteur du bon) ; null = possible. */
export const actionBonInterdite = (action: ActionBon, statut: StatutBon, droits: DroitsAchat, estDemandeur = false): string | null => {
  const ops = operationsPossibles(statut);
  const etat = `Impossible pour un bon au statut « ${STATUTS_BON[statut]?.texte ?? statut} ».`;
  switch (action) {
    case 'soumettre':
      if (!droits.acheter) return 'Droit d\'écriture sur les achats requis.';
      return ops.soumettre ? null : etat;
    case 'approuver':
    case 'rejeter':
      if (!droits.approuver) return 'Droit d\'approbation des achats requis.';
      if (!ops.decider) return etat;
      return estDemandeur ? 'L\'approbation revient à une autre personne que le demandeur.' : null;
    case 'receptionner':
      if (!droits.receptionner) return 'Droit d\'écriture sur les stocks requis (magasin).';
      return ops.receptionner ? null : etat;
    case 'solder':
      if (!droits.acheter) return 'Droit d\'écriture sur les achats requis.';
      return ops.solder ? null : etat;
    case 'annuler':
      if (!droits.acheter) return 'Droit d\'écriture sur les achats requis.';
      return ops.annuler ? null : etat;
    case 'annuler-reception':
      if (!droits.receptionner) return 'Droit d\'écriture sur les stocks requis (magasin).';
      return statut === 'partially_received' || statut === 'received' ? null : etat;
    default:
      return 'Action inconnue.';
  }
};

export interface SaisieReception { recue: string; refusee: string; motif: string; lots?: string; pneus?: string }
export const RECEPTION_VIDE: SaisieReception = { recue: '', refusee: '', motif: '' };

export interface LigneBonReception { id: string; quantity: number; quantity_received: number | null; pneu_marque: string | null; suivi: SuiviArticle }

export interface LigneReceptionServeur {
  ligne: string; recue: number; refusee: number; motif_refus: string | null;
  lots?: { code: string; quantite: number }[]; pneus?: { numero: string }[];
}

/**
 * Lignes de reception pour receptionner_bon_commande ; null si la saisie est
 * incomplete ou incoherente (refus sans motif, quantite au-dela du reliquat,
 * lots ou numeros de pneus manquants). Lignes a zero omises.
 */
export const lignesReceptionPourServeur = (lignes: LigneBonReception[], saisie: Record<string, SaisieReception>): LigneReceptionServeur[] | null => {
  const sortie: LigneReceptionServeur[] = [];
  for (const l of lignes) {
    const s = saisie[l.id] ?? RECEPTION_VIDE;
    const recue = Number(s.recue || 0);
    const refusee = Number(s.refusee || 0);
    if (!Number.isInteger(recue) || !Number.isInteger(refusee) || recue < 0 || refusee < 0) return null;
    if (recue > restantARecevoir(l.quantity, l.quantity_received)) return null;
    if (recue === 0 && refusee === 0) continue;
    const motif = s.motif.trim() || null;
    if (refusee > 0 && !motif) return null;
    const corps: LigneReceptionServeur = { ligne: l.id, recue, refusee, motif_refus: motif };
    if (recue > 0 && l.suivi !== 'aucun' && !l.pneu_marque) {
      const lots = lotsPourMouvement(l.suivi, s.lots ?? '', recue);
      if (!lots) return null;
      corps.lots = lots;
    }
    if (recue > 0 && l.pneu_marque) {
      const numeros = lireNumerosPneus(s.pneus ?? '');
      if (!numeros || numeros.length !== recue) return null;
      corps.pneus = numeros.map((numero) => ({ numero }));
    }
    sortie.push(corps);
  }
  return sortie.length > 0 ? sortie : null;
};

// Lignes lues (purchase_orders et tables liees).
export interface Bon {
  id: string; po_number: string; po_date: string; supplier_id: string; warehouse_id: string | null; status: StatutBon;
  subtotal: number | null; tax_amount: number | null; total_amount: number | null; expected_delivery_date: string | null; notes: string | null;
  requested_by: string | null; soumis_par: string | null; motif_decision: string | null; motif_cloture: string | null; created_at?: string | null;
}
export const COLONNES_BON = 'id, po_number, po_date, supplier_id, warehouse_id, status, subtotal, tax_amount, total_amount, expected_delivery_date, notes, requested_by, soumis_par, motif_decision, motif_cloture, created_at';
export interface LigneBon {
  id: string; purchase_order_id: string; stock_item_id: string | null; item_description: string; quantity: number; unit_price: number; total_price: number;
  quantity_received: number | null; pneu_marque: string | null; pneu_modele: string | null; pneu_dimension: string | null;
}
export const COLONNES_LIGNE_BON = 'id, purchase_order_id, stock_item_id, item_description, quantity, unit_price, total_price, quantity_received, pneu_marque, pneu_modele, pneu_dimension';
export interface ReceptionBon { id: string; purchase_order_id: string; delivery_number: string; delivery_date: string; bon_livraison: string | null; annule_le: string | null; motif_annulation: string | null }
export const COLONNES_RECEPTION = 'id, purchase_order_id, delivery_number, delivery_date, bon_livraison, annule_le, motif_annulation';

const GNF = new Intl.NumberFormat('fr-FR');
export const montantGnf = (v: number | null) => (v === null || v === undefined ? 'Sans données' : `${GNF.format(v)} GNF`);

export const LIBELLE_EVENEMENT_ACHAT: Record<string, string> = {
  creation: 'Bon créé (brouillon)', modification: 'Brouillon modifié', soumission: 'Soumis à approbation', approbation: 'Approuvé', rejet: 'Rejeté',
  annulation: 'Bon annulé', reception: 'Réception enregistrée', annulation_reception: 'Réception annulée', solde: 'Bon soldé',
};

/** Erreurs de saisie d'un brouillon de bon (en-tete et lignes). */
export const erreursBon = (entete: { fournisseur: string; depot: string; taxes: string }, lignes: LigneSaisie[]): string[] => [
  ...(!entete.fournisseur ? ['Fournisseur requis.'] : []),
  ...(!entete.depot ? ['Dépôt de livraison requis.'] : []),
  ...(!lignesPourServeur(lignes) ? ['Chaque ligne demande une quantité, un prix entier et un article, une désignation ou un modèle de pneu.'] : []),
  ...(!/^\d+$/.test((entete.taxes || '0').trim()) ? ['Taxes : montant entier positif ou nul.'] : []),
];
