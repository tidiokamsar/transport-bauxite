// Navigation entre ecrans depuis un message d'etat vide (D-078) : l'ecran
// principal ecoute l'evenement et ouvre la vue demandee.

export const EVENEMENT_ALLER_A = 'sigtb:aller-a';

export const allerA = (vue: string) => {
  window.dispatchEvent(new CustomEvent<string>(EVENEMENT_ALLER_A, { detail: vue }));
};
