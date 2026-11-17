// Historique d'un objet (D-090) : evenements lus dans les tables de journal
// existantes ou dans les horodatages des pieces liees. Rien n'est deduit ni
// complete : un evenement sans horodatage n'est pas affiche.

export interface EvenementHistorique {
  /** Unique dans l'historique fusionne (prefixer par la source). */
  id: string;
  /** Horodatage ISO de l'evenement, tel qu'enregistre. */
  le: string;
  libelle: string;
  detail?: string | null;
  motif?: string | null;
  /** Identifiant du compte auteur, s'il est journalise. */
  auteur?: string | null;
  /** Table d'origine, affichee pour la tracabilite. */
  source: string;
}

/** Fusionne plusieurs sources, du plus recent au plus ancien ; horodatage absent ou illisible ecarte. */
export const fusionnerHistoriques = (...listes: (EvenementHistorique[] | null | undefined)[]): EvenementHistorique[] =>
  listes.flatMap((l) => l ?? [])
    .filter((e) => e.le && !Number.isNaN(Date.parse(e.le)))
    .sort((a, b) => Date.parse(b.le) - Date.parse(a.le) || a.id.localeCompare(b.id));
