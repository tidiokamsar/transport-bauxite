import { statutLigne, type BaseTonnage, type StatutLigne } from './facturation';

// Reconciliation mensuelle (D-029, D-082) au standard des pages (D-090) :
// lignes lues, comptes et regles des actions, miroirs des fonctions serveur
// (ouvrir, actualiser, cloturer, decider une ligne, rectifier un ticket CBG,
// generer la facture).

export interface Reconciliation {
  id: string; contrat_id: string; periode_debut: string; periode_fin: string; base_tonnage: BaseTonnage;
  tolerance_ecart_pct: number; site_depart_id: string | null; site_arrivee_id: string | null; statut: 'ouverte' | 'cloturee';
  tonnage_facturable: number | null; voyages_facturables: number | null; ouverte_par?: string | null; ouverte_le?: string | null;
  actualisee_le: string | null; cloturee_par?: string | null; cloturee_le: string | null;
}

export interface LigneReconciliation {
  id: string; reconciliation_id: string; trip_id: string; reference: string; date_voyage: string; etat: string | null;
  tonnage_charge: number | null; tonnage_recu: number | null; tonnage_accepte: number | null; tonnage_kogon: number | null; tonnage_cbg: number | null; tonnage_base: number | null;
  ticket: string | null; fiche: string | null; anomalies: string[]; decision: string | null; motif_decision: string | null;
  decide_par?: string | null; decide_le?: string | null;
  ticket_brut: number | null; ticket_tare: number | null; ticket_document_ref: string | null; ticket_rectifie: boolean;
}

export const comptesLignes = (lignes: Pick<LigneReconciliation, 'decision' | 'anomalies' | 'tonnage_base'>[]) => {
  const c = { facturable: 0, a_examiner: 0, exclue: 0, tonnes: 0 };
  for (const l of lignes) {
    const s = statutLigne(l.decision, l.anomalies);
    c[s] += 1;
    if (s === 'facturable') c.tonnes += Number(l.tonnage_base ?? 0);
  }
  return c;
};

export type DecisionLigne = 'facturable' | 'exclue' | 'aucune';

/**
 * Raison du refus d'une decision sur une ligne, ou null. Un ticket CBG
 * rectifie n'est declare facturable que par un approbateur de la
 * facturation (D-082 ; le serveur verifie aussi la separation avec
 * l'auteur de la rectification).
 */
export const decisionInterdite = (
  decision: DecisionLigne,
  rec: Pick<Reconciliation, 'statut'>,
  ligne: Pick<LigneReconciliation, 'anomalies' | 'decision'>,
  droits: { ecrire: boolean; approuver: boolean },
): string | null => {
  if (!droits.ecrire) return 'Droit d\'écriture sur la facturation requis.';
  if (rec.statut !== 'ouverte') return 'Réconciliation clôturée : les décisions sont figées.';
  if (decision === 'aucune') return ligne.decision ? null : 'Aucune décision à annuler sur cette ligne.';
  if (decision === 'facturable' && ligne.anomalies.includes('ticket_rectifie') && !droits.approuver) {
    return 'Ticket CBG rectifié : la facturation est décidée par un approbateur de la facturation, distinct de l\'auteur de la rectification.';
  }
  return null;
};

/** Cloture : reconciliation ouverte, aucune ligne a examiner. */
export const clotureInterdite = (rec: Pick<Reconciliation, 'statut'>, aExaminer: number, ecrire: boolean): string | null =>
  !ecrire ? 'Droit d\'écriture sur la facturation requis.'
    : rec.statut !== 'ouverte' ? 'Réconciliation déjà clôturée.'
      : aExaminer > 0 ? `${aExaminer} ligne(s) à examiner : décidez chaque ligne avant de clôturer.` : null;

export const FILTRES_LIGNES: (StatutLigne | 'toutes')[] = ['a_examiner', 'facturable', 'exclue', 'toutes'];

/** Saisie d'ouverture incomplete (jamais d'identifiant vide envoye). */
export const erreursOuvertureReconciliation = (f: { contrat: string; mois: string; base: string; tolerance: string }) => [
  ...(!f.contrat ? ['Choisissez le contrat client.'] : []),
  ...(!/^\d{4}-\d{2}$/.test(f.mois) ? ['Mois de la période obligatoire.'] : []),
  ...(!f.base ? ['Choisissez la base de tonnage facturé (selon le contrat).'] : []),
  ...(f.tolerance.trim() === '' || Number.isNaN(Number(f.tolerance.replace(',', '.'))) || Number(f.tolerance.replace(',', '.')) < 0
    ? ['Tolérance d\'écart en pourcentage (0 ou plus).'] : []),
];
