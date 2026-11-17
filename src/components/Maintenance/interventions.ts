// Interventions du loueur (D-049) : libelles, controle des pieces saisies
// et regles des pages standard (D-090).

export const LIBELLE_STATUT_INTERVENTION = {
  demandee: 'Demandée',
  prise_en_charge: 'Prise en charge',
  terminee: 'Terminée, remise à valider',
  remise_validee: 'Remise en service validée',
} as const;

export type StatutIntervention = keyof typeof LIBELLE_STATUT_INTERVENTION;

export const TEINTES_INTERVENTION: Record<StatutIntervention, 'bleu' | 'orange' | 'vert'> = {
  demandee: 'bleu', prise_en_charge: 'bleu', terminee: 'orange', remise_validee: 'vert',
};

export const CANAUX = {
  telephone: 'Téléphone',
  courriel: 'Courriel',
  courrier: 'Courrier',
  portail: 'Portail du loueur',
  sur_place: 'Sur place',
} as const;

export interface Piece { designation: string; reference: string; quantite: string; fournie_par: 'loueur' | 'exploitant' }

// Une ligne de piece commencee doit porter une quantite positive.
export const piecesValides = (pieces: Piece[]) =>
  pieces.filter((p) => p.designation.trim()).every((p) => Number(p.quantite.replace(',', '.')) > 0);

export const VUE_INTERVENTIONS = 'interventions-loueur';
export const MODULE_INTERVENTIONS = 'Interventions Neemba';

export const ACTIONS_INTERVENTION = ['prendre-en-charge', 'terminer', 'valider', 'refuser'] as const;
export type ActionIntervention = typeof ACTIONS_INTERVENTION[number];

const ETAT_REQUIS: Record<ActionIntervention, StatutIntervention> = {
  'prendre-en-charge': 'demandee', terminer: 'prise_en_charge', valider: 'terminee', refuser: 'terminee',
};

/**
 * Raison du refus de l'action (droit, etat, separation des taches comme le
 * serveur : la remise en service est decidee par une autre personne que
 * celle qui a saisi la fin) ; null = possible.
 */
export const actionInterventionInterdite = (
  action: ActionIntervention, statut: StatutIntervention, peutEcrire: boolean, finSaisiePar: string | null, utilisateur: string | null,
): string | null => {
  if (!peutEcrire) return 'Droit d\'écriture sur la maintenance requis.';
  if (statut !== ETAT_REQUIS[action]) return `Action impossible : l'intervention est « ${LIBELLE_STATUT_INTERVENTION[statut] ?? statut} ».`;
  if ((action === 'valider' || action === 'refuser') && finSaisiePar && utilisateur && finSaisiePar === utilisateur) {
    return 'La remise en service est décidée par une autre personne que celle qui a saisi la fin d\'intervention.';
  }
  return null;
};

/** Nombre saisi (virgule acceptee) ; null si vide, NaN si illisible. */
export const lireNombre = (v: string): number | null => (v.trim() === '' ? null : Number(v.replace(/\s/g, '').replace(',', '.')));
