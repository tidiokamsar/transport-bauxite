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
