// Postes de travail (D-048) : libelles et lecture du bilan fige a la cloture.

export const LIBELLE_STATUT_POSTE = { ouvert: 'Ouvert', cloture: 'Clos, à valider', valide: 'Clôture validée' } as const;

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
