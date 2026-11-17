// Postes de travail (D-048) : libelles et lecture du bilan fige a la cloture.

export const LIBELLE_STATUT_POSTE = {
  planifie: 'Planifié', ouvert: 'Ouvert', en_cours: 'En cours', cloture: 'Clos, à valider', valide: 'Clôture validée', annule: 'Annulé',
} as const;

/** Un poste en cours s'exploite comme un poste ouvert (D-087). */
export const posteExploitable = (statut: string) => statut === 'ouvert' || statut === 'en_cours';

export const CATEGORIES_EVENEMENT = {
  incident: 'Incident',
  arret: 'Arrêt',
  retard: 'Retard',
  securite: 'Sécurité',
  information: 'Information',
} as const;

export interface Bilan {
  tonnes_cible: number | null; tonnes_livrees: number | null; voyages: number; voyages_livres: number;
  presents: number; absents: number; evenements: number; fige_le: string;
}

const t = (x: number | null) => (x === null || x === undefined ? 'sans données' : `${Number(x).toLocaleString('fr-FR')} t`);

export const resumeBilan = (b: Bilan) => [
  `Objectif ${t(b.tonnes_cible)}, livré ${t(b.tonnes_livrees)}`,
  `${b.voyages_livres}/${b.voyages} voyage(s) livré(s)`,
  `${b.presents} présent(s), ${b.absents} absent(s)`,
  `${b.evenements} événement(s)`,
].join(' · ');

// Pages standard (D-090) : adresse du module, colonnes lues, regles des actions.

export const VUE_POSTES = 'postes';
export const MODULE_POSTES = 'Postes de travail';

export type StatutPoste = keyof typeof LIBELLE_STATUT_POSTE;

export interface Poste {
  id: string; date_poste: string; shift_id: string; site_id: string; responsable_id: string | null; statut: StatutPoste;
  consignes_recues: string | null; consignes_sortie: string | null; rapport: string | null; bilan: Bilan | null;
  ouvert_le: string; cloture_le: string | null; valide_le: string | null;
}

export const COLONNES_POSTE = 'id, date_poste, shift_id, site_id, responsable_id, statut, consignes_recues, consignes_sortie, rapport, bilan, ouvert_le, cloture_le, valide_le';

export type TeintePoste = 'bleu' | 'rouge' | 'orange' | 'gris' | 'vert';

export const teintePoste = (statut: string): TeintePoste =>
  posteExploitable(statut) ? 'bleu' : statut === 'annule' ? 'rouge' : statut === 'cloture' ? 'orange' : statut === 'planifie' ? 'gris' : 'vert';

export const ACTIONS_POSTE = ['affecter', 'pointer', 'consigner', 'cloturer', 'valider'] as const;
export type ActionPoste = typeof ACTIONS_POSTE[number];

/**
 * Raison pour laquelle une action de poste est refusee (droit ou etat), ou
 * null. Miroir des gardes serveur (poste_ecrivable : poste ouvert ou en
 * cours ; validation : poste clos, droit planning).
 */
export const actionPosteInterdite = (action: ActionPoste, statut: string, droits: { exploiter: boolean; valider: boolean }): string | null => {
  if (action === 'valider') {
    if (!droits.valider) return 'Droit de validation de la planification requis.';
    return statut === 'cloture' ? null : 'Seul un poste clos, en attente de validation, se valide.';
  }
  if (!droits.exploiter) return 'Droit d\'écriture sur l\'exploitation (voyages) requis.';
  return posteExploitable(statut) ? null : `Action impossible : le poste est « ${LIBELLE_STATUT_POSTE[statut as StatutPoste] ?? statut} ».`;
};

/** Saisie d'ouverture incomplete : jamais d'identifiant vide envoye au serveur. */
export const erreursOuverturePoste = (f: { date: string; shift: string; site: string }) => [
  ...(!f.date ? ['Date du poste obligatoire.'] : []),
  ...(!f.shift ? ['Choisissez le shift du poste.'] : []),
  ...(!f.site ? ['Choisissez le site du poste.'] : []),
];

/** Retard saisi en minutes : vide (a l'heure) ou entier positif ou nul. */
export const lireRetard = (saisie: string): { valeur: number | null; erreur: string | null } => {
  const s = saisie.trim();
  if (!s) return { valeur: null, erreur: null };
  return /^\d+$/.test(s) ? { valeur: Number.parseInt(s, 10), erreur: null } : { valeur: null, erreur: 'Retard en minutes : nombre entier, vide si à l\'heure.' };
};
