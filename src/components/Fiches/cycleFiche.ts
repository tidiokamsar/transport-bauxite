// Cycle de vie d'une fiche terrain (D-089), regles d'affichage. Miroir de
// transition_fiche_autorisee (migration 20261121215000) pour proposer les
// actions ; le serveur reste seul juge et refuse le reste.
import type { TeintePuce } from '../ui/Panneau';

export const VUE_FICHES = 'fiches';

export const ETATS_FICHE: Record<string, { libelle: string; teinte: TeintePuce }> = {
  a_preparer: { libelle: 'À préparer', teinte: 'gris' },
  preparee: { libelle: 'Préparée', teinte: 'gris' },
  a_imprimer: { libelle: 'À imprimer', teinte: 'gris' },
  imprimee: { libelle: 'Imprimée', teinte: 'bleu' },
  a_remettre: { libelle: 'À remettre', teinte: 'bleu' },
  remise_agent: { libelle: 'Remise à l\'agent', teinte: 'bleu' },
  en_utilisation: { libelle: 'En utilisation', teinte: 'bleu' },
  retournee: { libelle: 'Retournée', teinte: 'orange' },
  a_saisir: { libelle: 'À saisir', teinte: 'orange' },
  saisie_en_cours: { libelle: 'Saisie en cours', teinte: 'orange' },
  saisie_terminee: { libelle: 'Saisie terminée', teinte: 'violet' },
  a_controler: { libelle: 'À contrôler', teinte: 'violet' },
  a_corriger: { libelle: 'À corriger', teinte: 'rouge' },
  validee: { libelle: 'Validée', teinte: 'vert' },
  archivee: { libelle: 'Archivée', teinte: 'gris' },
  annulee: { libelle: 'Annulée', teinte: 'rouge' },
};

export type ActionFiche =
  | 'imprimer' | 'remettre' | 'retour' | 'saisir-ligne' | 'terminer-saisie' | 'soumettre'
  | 'controler' | 'renvoyer' | 'valider' | 'archiver' | 'annuler';

export const LIBELLES_ACTIONS: Record<ActionFiche, string> = {
  imprimer: 'Enregistrer l\'impression',
  remettre: 'Remettre à l\'agent',
  retour: 'Enregistrer le retour',
  'saisir-ligne': 'Saisir une rotation',
  'terminer-saisie': 'Terminer la saisie',
  soumettre: 'Soumettre au contrôle',
  controler: 'Contrôler',
  renvoyer: 'Renvoyer en correction',
  valider: 'Valider',
  archiver: 'Archiver',
  annuler: 'Annuler la fiche',
};

const PERMISES: Record<ActionFiche, string[]> = {
  imprimer: ['preparee', 'a_imprimer', 'imprimee', 'a_remettre', 'remise_agent', 'en_utilisation', 'retournee'],
  remettre: ['preparee', 'imprimee', 'a_remettre'],
  retour: ['remise_agent', 'en_utilisation'],
  'saisir-ligne': ['retournee', 'a_saisir', 'saisie_en_cours', 'a_corriger'],
  'terminer-saisie': ['retournee', 'a_saisir', 'saisie_en_cours', 'a_corriger'],
  soumettre: ['saisie_terminee'],
  controler: ['a_controler'],
  renvoyer: ['a_controler'],
  valider: ['a_controler'],
  archiver: ['validee'],
  annuler: ['a_preparer', 'preparee', 'a_imprimer', 'imprimee', 'a_remettre', 'remise_agent', 'en_utilisation', 'retournee',
    'a_saisir', 'saisie_en_cours', 'saisie_terminee', 'a_corriger'],
};

export const estActionFiche = (a: string): a is ActionFiche => a in PERMISES;

/** Action proposee pour une fiche a cet etat (et de ce type pour la saisie des rotations). */
export const actionPermise = (action: ActionFiche, etat: string, type: string): boolean =>
  PERMISES[action].includes(etat) && (action !== 'saisir-ligne' || type === 'rotations');

export const actionsFiche = (etat: string, type: string): ActionFiche[] =>
  (Object.keys(PERMISES) as ActionFiche[]).filter((a) => actionPermise(a, etat, type));

/** La reimpression d'une fiche deja imprimee exige un motif (D-089). */
export const motifImpressionRequis = (nbImpressions: number | null | undefined) => (nbImpressions ?? 0) > 0;

export type LigneRotationSaisie = {
  rang: string; trip_id: string; depart_le: string; arrivee_le: string; km_depart: string; km_arrivee: string;
  ticket_cbg: string; observations: string; incidents: string; motif: string;
};

/** Erreurs de la saisie d'une rotation (memes regles que la table) ; vide = envoi possible. */
export const erreursLigneRotation = (s: LigneRotationSaisie, correction: boolean): Record<string, string> => {
  const e: Record<string, string> = {};
  const rang = Number(s.rang);
  if (!Number.isInteger(rang) || rang <= 0) e.rang = 'Numéro de rotation entier positif requis';
  const kd = s.km_depart === '' ? null : Number(s.km_depart.replace(',', '.'));
  const ka = s.km_arrivee === '' ? null : Number(s.km_arrivee.replace(',', '.'));
  if (kd !== null && (Number.isNaN(kd) || kd < 0)) e.km_depart = 'Compteur invalide';
  if (ka !== null && (Number.isNaN(ka) || ka < 0)) e.km_arrivee = 'Compteur invalide';
  if (kd !== null && ka !== null && !e.km_depart && !e.km_arrivee && ka < kd) e.km_arrivee = 'Compteur d\'arrivée inférieur au départ';
  if (s.depart_le && s.arrivee_le && Date.parse(s.arrivee_le) < Date.parse(s.depart_le)) e.arrivee_le = 'Arrivée avant le départ';
  if (correction && s.motif.trim().length < 3) e.motif = 'Motif de correction requis (ligne déjà saisie)';
  return e;
};

/** Ligne envoyee a saisir_ligne_rotation : champs vides omis, nombres convertis, aucune valeur ajoutee. */
export const ligneVersServeur = (s: LigneRotationSaisie): Record<string, unknown> => {
  const o: Record<string, unknown> = {};
  if (s.trip_id) o.trip_id = s.trip_id;
  if (s.depart_le) o.depart_le = new Date(s.depart_le).toISOString();
  if (s.arrivee_le) o.arrivee_le = new Date(s.arrivee_le).toISOString();
  if (s.km_depart !== '') o.km_depart = Number(s.km_depart.replace(',', '.'));
  if (s.km_arrivee !== '') o.km_arrivee = Number(s.km_arrivee.replace(',', '.'));
  if (s.ticket_cbg.trim()) o.ticket_cbg = s.ticket_cbg.trim();
  if (s.observations.trim()) o.observations = s.observations.trim();
  if (s.incidents.trim()) o.incidents = s.incidents.trim();
  return o;
};
