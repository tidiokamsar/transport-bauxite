import type { StatutBon } from '../Purchases/achats';
import type { StatutConsultation, StatutOffre } from './fournisseurs';

// Lignes lues par les pages du module Fournisseurs (D-059, D-090).

export const COLONNES_FOURNISSEUR = 'id, supplier_number, supplier_type, company_name, phone, email, address, ville, pays, identifiant_fiscal, registre_commerce, payment_terms, notes, active, suspendu_le, motif_suspension';

export interface Contact { id: string; supplier_id: string; nom: string; fonction: string | null; telephone: string | null; email: string | null; principal: boolean; actif: boolean; motif_retrait: string | null }
export interface DocFournisseur {
  id: string; supplier_id: string; type_document: string; libelle: string | null; numero: string | null; date_emission: string | null; date_expiration: string | null;
  reference_piece: string; observation: string | null; retire_le: string | null; motif_retrait: string | null;
}
export interface Critere { id: string; libelle: string; description: string | null; poids: number; actif: boolean; ordre: number }
export interface Evaluation { id: string; supplier_id: string; periode_debut: string; periode_fin: string; note_globale: number; commentaire: string | null; remplace_id: string | null; motif_correction: string | null; evalue_le: string }
export interface NoteEvaluation { id: string; evaluation_id: string; libelle: string; poids: number; note: number; observation: string | null }
export interface Bon { id: string; po_number: string; po_date: string; supplier_id: string; status: StatutBon; total_amount: number | null }
export interface Paiement { id: string; numero: string; purchase_order_id: string | null; statut: string; montant_propose: number; montant_execute: number | null; execute_le: string | null; devise: string }
export interface JournalFournisseur { id: string; supplier_id: string; evenement: string; motif: string | null; par: string | null; le: string }

export interface Consultation {
  id: string; numero: string; objet: string; warehouse_id: string | null; date_limite: string | null; note: string | null; statut: StatutConsultation;
  offre_retenue_id: string | null; motif_selection: string | null; purchase_order_id: string | null; motif_annulation: string | null; cree_le: string;
}
export interface LigneConsultation { id: string; consultation_id: string; ordre: number; stock_item_id: string | null; designation: string; quantite: number }
export interface Invite { consultation_id: string; supplier_id: string }
export interface Offre {
  id: string; consultation_id: string; supplier_id: string; reference_offre: string | null; recue_le: string; delai_livraison_jours: number;
  validite_jusqu_au: string | null; conditions: string | null; montant_total: number; lignes_chiffrees: number; statut: StatutOffre; motif_retrait: string | null;
}
export interface PrixOffre { id: string; offre_id: string; consultation_ligne_id: string; prix_unitaire: number }
export interface JournalConsultation { id: string; consultation_id: string; evenement: string; motif: string | null; par: string | null; le: string }

export const COLONNES_CONSULTATION = 'id, numero, objet, warehouse_id, date_limite, note, statut, offre_retenue_id, motif_selection, purchase_order_id, motif_annulation, cree_le';

export const EVENEMENTS_FOURNISSEUR: Record<string, string> = {
  creation: 'Fiche créée', modification: 'Fiche modifiée', suspension: 'Fournisseur suspendu', reactivation: 'Fournisseur réactivé',
  contact: 'Contact enregistré', retrait_contact: 'Contact retiré', document: 'Document enregistré', retrait_document: 'Document retiré',
  categories: 'Catégories modifiées', evaluation: 'Évaluation enregistrée',
};

export const EVENEMENTS_CONSULTATION: Record<string, string> = {
  creation: 'Consultation créée', invitation: 'Fournisseur consulté', offre: 'Offre enregistrée', retrait_offre: 'Offre retirée',
  selection: 'Offre retenue', bon_commande: 'Bon de commande préparé', annulation: 'Consultation annulée',
};

export const STATUTS_PAIEMENT: Record<string, string> = { propose: 'Proposé', approuve: 'Approuvé', rejete: 'Rejeté', execute: 'Exécuté', annule: 'Annulé' };

export const LIENS_RUBRIQUES = 'flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-stone-50 disabled:opacity-50';

export const GNF = new Intl.NumberFormat('fr-FR');
export const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** Lignes d'une table liee a l'objet (robuste a une reponse non filtree). */
export const lignesDe = <T, K extends keyof T>(lignes: T[] | null, cle: K, id: string): T[] | null =>
  lignes && lignes.filter((l) => l[cle] === id);
