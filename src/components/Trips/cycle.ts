// Cycle de voyage (CDC 12). Miroir des regles du serveur
// (transition_voyage_autorisee, migration 20261110120000) pour proposer les
// bonnes actions ; le serveur reste seul juge et refuse le reste.
import type { TeintePuce } from '../ui/Panneau';

export type Etat =
  | 'DRAFT' | 'PLANNED' | 'ASSIGNED' | 'AT_LOADING' | 'LOADING' | 'LOADED' | 'WEIGHED_OUT'
  | 'IN_TRANSIT' | 'AT_DESTINATION' | 'UNLOADING' | 'WEIGHED_IN' | 'DELIVERED' | 'ACCEPTED' | 'CLOSED'
  | 'CANCELLED' | 'INTERRUPTED' | 'DISPUTED' | 'REJECTED';

export type Phase = 'prevu' | 'chargement' | 'route' | 'dechargement' | 'livre' | 'exception';

interface DefinitionEtat {
  libelle: string;
  action: string;
  phase: Phase;
}

export const ETATS: Record<Etat, DefinitionEtat> = {
  DRAFT: { libelle: 'Brouillon', action: 'Brouillon', phase: 'prevu' },
  PLANNED: { libelle: 'Planifié', action: 'Planifier', phase: 'prevu' },
  ASSIGNED: { libelle: 'Affecté', action: 'Affecter', phase: 'prevu' },
  AT_LOADING: { libelle: 'Au chargement', action: 'Arrivé au chargement', phase: 'chargement' },
  LOADING: { libelle: 'En chargement', action: 'Début du chargement', phase: 'chargement' },
  LOADED: { libelle: 'Chargé', action: 'Fin du chargement', phase: 'chargement' },
  WEIGHED_OUT: { libelle: 'Pesé au départ', action: 'Pesée au départ', phase: 'chargement' },
  IN_TRANSIT: { libelle: 'En route', action: 'Départ', phase: 'route' },
  AT_DESTINATION: { libelle: 'À destination', action: 'Arrivé à destination', phase: 'dechargement' },
  UNLOADING: { libelle: 'En déchargement', action: 'Début du déchargement', phase: 'dechargement' },
  WEIGHED_IN: { libelle: 'Pesé à l\'arrivée', action: 'Pesée à l\'arrivée', phase: 'dechargement' },
  DELIVERED: { libelle: 'Livré', action: 'Livraison terminée', phase: 'livre' },
  ACCEPTED: { libelle: 'Accepté', action: 'Accepter le tonnage', phase: 'livre' },
  CLOSED: { libelle: 'Clôturé', action: 'Clôturer', phase: 'livre' },
  CANCELLED: { libelle: 'Annulé', action: 'Annuler', phase: 'exception' },
  INTERRUPTED: { libelle: 'Interrompu', action: 'Interrompre', phase: 'exception' },
  DISPUTED: { libelle: 'En litige', action: 'Contester', phase: 'exception' },
  REJECTED: { libelle: 'Rejeté', action: 'Rejeter', phase: 'exception' },
};

export const PHASES: Record<Phase, { libelle: string; teinte: TeintePuce }> = {
  prevu: { libelle: 'Prévus', teinte: 'gris' },
  chargement: { libelle: 'Au chargement', teinte: 'orange' },
  route: { libelle: 'En route', teinte: 'bleu' },
  dechargement: { libelle: 'Au déchargement', teinte: 'violet' },
  livre: { libelle: 'Livrés', teinte: 'vert' },
  exception: { libelle: 'Exceptions', teinte: 'rouge' },
};

const SUITES: Partial<Record<Etat, Etat[]>> = {
  DRAFT: ['PLANNED'],
  PLANNED: ['ASSIGNED'],
  ASSIGNED: ['AT_LOADING'],
  AT_LOADING: ['LOADING'],
  LOADING: ['LOADED'],
  LOADED: ['WEIGHED_OUT', 'IN_TRANSIT'],
  WEIGHED_OUT: ['IN_TRANSIT'],
  IN_TRANSIT: ['AT_DESTINATION'],
  AT_DESTINATION: ['UNLOADING'],
  UNLOADING: ['WEIGHED_IN', 'DELIVERED'],
  WEIGHED_IN: ['DELIVERED'],
  DELIVERED: ['ACCEPTED', 'DISPUTED', 'REJECTED'],
  DISPUTED: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: ['CLOSED'],
  REJECTED: ['CLOSED'],
  INTERRUPTED: ['IN_TRANSIT', 'AT_DESTINATION', 'CANCELLED'],
};

const ANNULABLES: Etat[] = ['DRAFT', 'PLANNED', 'ASSIGNED', 'AT_LOADING', 'LOADING', 'LOADED', 'WEIGHED_OUT'];
const INTERRUPTIBLES: Etat[] = ['LOADING', 'LOADED', 'WEIGHED_OUT', 'IN_TRANSIT', 'AT_DESTINATION', 'UNLOADING'];

/** Etats exceptionnels : un motif est exige par le serveur. */
export const AVEC_MOTIF: Etat[] = ['CANCELLED', 'INTERRUPTED', 'DISPUTED', 'REJECTED'];
/** Etats de pesee : brut et tare exiges par le serveur. */
export const AVEC_PESEE: Etat[] = ['WEIGHED_OUT', 'WEIGHED_IN'];

export const estEtat = (v: string | null | undefined): v is Etat => !!v && v in ETATS;

/** Actions proposees depuis un etat : etapes normales puis exceptions. */
export const actionsPossibles = (etat: Etat): { normales: Etat[]; exceptions: Etat[] } => {
  const suites = SUITES[etat] ?? [];
  const normales = suites.filter((e) => !AVEC_MOTIF.includes(e));
  const exceptions = [
    ...suites.filter((e) => AVEC_MOTIF.includes(e)),
    ...(INTERRUPTIBLES.includes(etat) ? (['INTERRUPTED'] as Etat[]) : []),
    ...(ANNULABLES.includes(etat) ? (['CANCELLED'] as Etat[]) : []),
  ];
  return { normales, exceptions: [...new Set(exceptions)] };
};

export const phaseDe = (etat: string | null | undefined): Phase => (estEtat(etat) ? ETATS[etat].phase : 'prevu');

/** Tonnage le plus avance connu : accepte, sinon recu, sinon charge. */
export const tonnageVoyage = (v: {
  accepted_tonnage: number | null;
  net_weight_reception: number | null;
  net_weight: number | null;
  load_weight: number | null;
}): { valeur: number; nature: 'accepté' | 'reçu' | 'chargé' } | null => {
  if (v.accepted_tonnage !== null) return { valeur: v.accepted_tonnage, nature: 'accepté' };
  if (v.net_weight_reception !== null) return { valeur: v.net_weight_reception, nature: 'reçu' };
  const charge = v.net_weight ?? v.load_weight;
  return charge === null ? null : { valeur: charge, nature: 'chargé' };
};
