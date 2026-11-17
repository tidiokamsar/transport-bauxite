// Reconciliation mensuelle et factures clients (D-029) : libelles et
// regles miroirs du serveur (statut d'une ligne, bornes d'un mois).

export type BaseTonnage = 'accepte' | 'recu' | 'charge';

export const BASES: Record<BaseTonnage, string> = {
  accepte: 'Tonnage accepté par le client',
  recu: 'Tonnage reçu (pesée à la réception)',
  charge: 'Tonnage chargé (pesée au départ)',
};

export const ANOMALIES: Record<string, { libelle: string; bloquante: boolean }> = {
  base_absente: { libelle: 'Tonnage de base absent', bloquante: true },
  sans_double_pesee: { libelle: 'Pesée Kogon / CBG incomplète', bloquante: true },
  ecart_double_pesee: { libelle: 'Écart entre les pesées Kogon et CBG', bloquante: true },
  sans_pesee: { libelle: 'Sans pesée', bloquante: false },
  ecart_hors_tolerance: { libelle: 'Écart chargé / reçu hors tolérance', bloquante: true },
  litige: { libelle: 'En litige', bloquante: true },
  rejet: { libelle: 'Rejeté', bloquante: true },
  non_accepte: { libelle: 'Livré, pas encore accepté', bloquante: true },
  ticket_double: { libelle: 'Ticket de pesée en double', bloquante: true },
  sans_ticket_cbg: { libelle: 'Sans ticket CBG', bloquante: true },
  ticket_rectifie: { libelle: 'Ticket CBG rectifié (décision d\'un approbateur distinct)', bloquante: true },
  net_superieur_capacite: { libelle: 'Net du ticket supérieur à la capacité du camion (unité à vérifier : tonnes)', bloquante: true },
  sans_fiche: { libelle: 'Sans fiche terrain', bloquante: false },
};

export type StatutLigne = 'facturable' | 'a_examiner' | 'exclue';

/** Miroir de public.statut_ligne : decision prise, sinon anomalie bloquante. */
export const statutLigne = (decision: string | null, anomalies: string[]): StatutLigne =>
  (decision as StatutLigne | null) ?? (anomalies.some((a) => ANOMALIES[a]?.bloquante) ? 'a_examiner' : 'facturable');

export const STATUTS_LIGNE: Record<StatutLigne, { libelle: string; teinte: 'vert' | 'orange' | 'gris' }> = {
  facturable: { libelle: 'Facturable', teinte: 'vert' },
  a_examiner: { libelle: 'À examiner', teinte: 'orange' },
  exclue: { libelle: 'Exclue', teinte: 'gris' },
};

export type StatutFacture = 'brouillon' | 'a_signer' | 'signee' | 'emise' | 'annulee';

export const STATUTS_FACTURE: Record<StatutFacture, { libelle: string; teinte: 'gris' | 'orange' | 'bleu' | 'vert' | 'rouge' }> = {
  brouillon: { libelle: 'Brouillon', teinte: 'gris' },
  a_signer: { libelle: 'À signer (DG)', teinte: 'orange' },
  signee: { libelle: 'Signée', teinte: 'bleu' },
  emise: { libelle: 'Émise', teinte: 'vert' },
  annulee: { libelle: 'Annulée', teinte: 'rouge' },
};

/** Premier et dernier jour d'un mois AAAA-MM (dates calendaires). */
export const bornesMoisCalendaires = (mois: string): { debut: string; fin: string } => {
  const [a, m] = mois.split('-').map(Number);
  const dernier = new Date(a, m, 0).getDate();
  return { debut: `${mois}-01`, fin: `${mois}-${String(dernier).padStart(2, '0')}` };
};

export const montant = (valeur: number, devise: string) =>
  `${Number(valeur).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${devise}`;

// Pages standard (D-090) : factures et avoirs, reconciliations, creances.

export const VUE_FACTURES = 'invoices';
export const VUE_RECONCILIATION = 'reconciliation';
export const VUE_RECOUVREMENT = 'recouvrement';

export interface Facture {
  id: string; numero: string | null; type: 'facture' | 'avoir'; contrat_id: string; reconciliation_id: string | null; facture_origine_id: string | null;
  objet: string; devise: string; taux_taxe_pct: number; montant_ht: number; montant_taxe: number; montant_ttc: number;
  statut: StatutFacture; date_emission: string | null; date_echeance: string | null; prepare_le: string; signee_le: string | null;
  prepare_par: string | null; motif: string | null; periode_debut?: string | null; periode_fin?: string | null;
}

/** Libelle d'une facture : son numero, sinon « brouillon » selon son type. */
export const libelleFacture = (f: Pick<Facture, 'numero' | 'type'>) =>
  f.numero ?? (f.type === 'avoir' ? 'Avoir (brouillon)' : 'Facture (brouillon)');

export const ACTIONS_FACTURE = ['soumettre', 'signer', 'renvoyer', 'emettre', 'avoir', 'annuler'] as const;
export type ActionFacture = typeof ACTIONS_FACTURE[number];

export const NIVEAUX_RELANCE: Record<number, string> = { 1: 'Rappel', 2: 'Relance', 3: 'Mise en demeure' };
export const CANAUX_RELANCE: Record<string, string> = { email: 'E-mail', courrier: 'Courrier', telephone: 'Téléphone', remise_main: 'Remise en main propre' };
export const MODES_ENCAISSEMENT: Record<string, string> = { virement: 'Virement', cheque: 'Chèque', especes: 'Espèces', compensation: 'Compensation', autre: 'Autre' };

/** Libelles du journal factures_journal. */
export const JOURNAL_FACTURE: Record<string, string> = {
  generation: 'Générée', soumettre: 'Soumise au DG', signer: 'Signée par le DG', renvoyer: 'Renvoyée par le DG', emettre: 'Émise', annuler: 'Annulée',
};

/**
 * Raison pour laquelle une action de facture est refusee, ou null : miroir
 * de avancer_facture et creer_avoir (D-029). Le Directeur General signe ou
 * renvoie une facture a signer qu'il n'a pas preparee ; le charge de
 * contrats soumet, emet, annule (brouillon ou a signer) et cree l'avoir
 * d'une facture emise.
 */
export const actionFactureInterdite = (
  action: ActionFacture,
  f: Pick<Facture, 'statut' | 'type' | 'prepare_par'>,
  droits: { ecrire: boolean; directeur: boolean; utilisateur: string | null },
): string | null => {
  if (action === 'signer' || action === 'renvoyer') {
    if (!droits.directeur) return 'Seul le Directeur Général signe ou renvoie une facture.';
    if (f.statut !== 'a_signer') return 'La facture n\'est pas soumise à signature.';
    if (droits.utilisateur && f.prepare_par === droits.utilisateur) return 'Le signataire ne peut pas être le préparateur de la facture.';
    return null;
  }
  if (!droits.ecrire) return 'Droit d\'écriture sur la facturation requis.';
  if (action === 'soumettre') return f.statut === 'brouillon' ? null : 'Seul un brouillon se soumet au Directeur Général.';
  if (action === 'emettre') return f.statut === 'signee' ? null : 'Seule une facture signée s\'émet.';
  if (action === 'annuler') return f.statut === 'brouillon' || f.statut === 'a_signer' ? null : 'Une facture signée ou émise ne s\'annule pas : avoir.';
  return f.statut === 'emise' && f.type === 'facture' ? null : 'Un avoir se crée sur une facture émise.';
};

/** Montant saisi (espaces et virgule decimale admis) ; null si illisible. */
export const lireMontant = (saisie: string): number | null => {
  const s = saisie.replace(/\s/g, '').replace(',', '.');
  if (!s || !/^\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
};
