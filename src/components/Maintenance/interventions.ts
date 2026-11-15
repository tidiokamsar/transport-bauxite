// Interventions du loueur (D-049) : libelles et controle des pieces saisies.

export const LIBELLE_STATUT_INTERVENTION = {
  demandee: 'Demandée',
  prise_en_charge: 'Prise en charge',
  terminee: 'Terminée, remise à valider',
  remise_validee: 'Remise en service validée',
} as const;

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
