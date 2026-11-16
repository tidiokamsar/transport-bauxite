// Planification avancee (D-063) : fonctions pures autour des resultats du
// serveur (simuler_objectif, ventilation, cloture, comparer_shifts). Rien
// n'est estime ici : une valeur absente du serveur reste absente.

export interface LigneSimulation {
  rang: number;
  groupe: string;
  code: string;
  libelle: string;
  valeur: number | null;
  unite: string | null;
  source: string | null;
  remarque: string | null;
}

export const GROUPES_SIMULATION = ['Hypothèses', 'Situation', 'Besoin', 'Scénario'] as const;

/** Lignes groupees dans l'ordre du serveur (rang), groupes vides omis. */
export const grouperSimulation = (lignes: LigneSimulation[]): { groupe: string; lignes: LigneSimulation[] }[] => {
  const tries = [...lignes].sort((a, b) => a.rang - b.rang);
  const groupes = new Map<string, LigneSimulation[]>();
  for (const l of tries) groupes.set(l.groupe, [...(groupes.get(l.groupe) ?? []), l]);
  return [...groupes.entries()].map(([groupe, l]) => ({ groupe, lignes: l }));
};

export const valeurDe = (lignes: LigneSimulation[], code: string): number | null => {
  const v = lignes.find((l) => l.code === code)?.valeur;
  return v === null || v === undefined ? null : Number(v);
};

const nombreFr = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

/** Affichage d'une valeur : « Données insuffisantes » ou « — » si absente. */
export const texteValeur = (l: LigneSimulation): string => {
  if (l.valeur === null || l.valeur === undefined) {
    return l.remarque?.startsWith('Données insuffisantes') ? 'Données insuffisantes' : '—';
  }
  return l.unite ? `${nombreFr(Number(l.valeur))} ${l.unite}` : nombreFr(Number(l.valeur));
};

export interface Scenario {
  cle: 'revision' | 'renfort';
  titre: string;
  explication: string;
  tonnes: number;
  camions: number | null;
  chargeuses: number | null;
}

/**
 * Scenarios de rattrapage tires de la simulation : reviser l'objectif au
 * tonnage atteignable, ou garder l'objectif avec les moyens necessaires.
 * Chacun devient, si l'humain le retient, une revision par definir_objectif.
 */
export const scenarios = (lignes: LigneSimulation[], tonnesCible: number): Scenario[] => {
  const liste: Scenario[] = [];
  const propose = valeurDe(lignes, 'objectif_propose');
  if (propose !== null && propose > 0 && propose < tonnesCible) {
    liste.push({
      cle: 'revision',
      titre: `Réviser l'objectif à ${nombreFr(propose)} t`,
      explication: 'Tonnage atteignable avec les moyens disponibles sur le temps restant, au rythme observé.',
      tonnes: propose,
      camions: null,
      chargeuses: null,
    });
  }
  const camions = valeurDe(lignes, 'camions_necessaires');
  const engins = valeurDe(lignes, 'engins_necessaires');
  const renfortCamions = valeurDe(lignes, 'renfort_camions') ?? 0;
  const renfortEngins = valeurDe(lignes, 'renfort_engins') ?? 0;
  if (camions !== null && (renfortCamions > 0 || renfortEngins > 0)) {
    const renforts = [
      renfortCamions > 0 ? `${renfortCamions} camion(s)` : null,
      renfortEngins > 0 ? `${renfortEngins} engin(s) de chargement` : null,
    ].filter(Boolean).join(' et ');
    liste.push({
      cle: 'renfort',
      titre: `Tenir ${nombreFr(tonnesCible)} t avec un renfort de ${renforts}`,
      explication: 'Moyens nécessaires sur le temps restant, à reporter comme moyens prévus de l\'objectif.',
      tonnes: tonnesCible,
      camions,
      chargeuses: engins,
    });
  }
  return liste;
};

// Ventilation d'un objectif (destination et / ou contrat client)
export interface LigneVentilation {
  destination_id: string;
  contrat_id: string;
  tonnes: string;
}

const nombreSaisi = (v: string) => (v.trim() === '' ? null : Number(v.replace(/\s/g, '').replace(',', '.')));

/** Meme regle que ventiler_objectif ; null si la saisie est recevable. */
export const erreurVentilation = (lignes: LigneVentilation[], tonnesObjectif: number, siteChargement: string): string | null => {
  if (lignes.length === 0) return 'Ajoutez au moins une ligne.';
  const cles = new Set<string>();
  let total = 0;
  for (const l of lignes) {
    if (!l.destination_id && !l.contrat_id) return 'Chaque ligne indique une destination ou un contrat.';
    if (l.destination_id && l.destination_id === siteChargement) return 'La destination diffère du site de chargement.';
    const t = nombreSaisi(l.tonnes);
    if (t === null || !(t > 0)) return 'Chaque ligne porte des tonnes supérieures à zéro.';
    const cle = `${l.destination_id}|${l.contrat_id}`;
    if (cles.has(cle)) return 'Deux lignes ont la même destination et le même contrat.';
    cles.add(cle);
    total += t;
  }
  if (total > tonnesObjectif + 1e-9) return `La ventilation (${nombreFr(total)} t) dépasse l'objectif (${nombreFr(tonnesObjectif)} t).`;
  return null;
};

export const lignesVentilationServeur = (lignes: LigneVentilation[]) =>
  lignes.map((l) => ({
    destination_id: l.destination_id || null,
    contrat_id: l.contrat_id || null,
    tonnes: nombreSaisi(l.tonnes),
  }));

// Cloture de planification
export const CATEGORIES_CAUSE: Record<string, string> = {
  panne_camion: 'Panne de camion',
  panne_engin: 'Panne d\'engin de chargement',
  attente_chargement: 'Attente au chargement',
  attente_dechargement: 'Attente au déchargement',
  piste: 'État de la piste',
  meteo: 'Météo',
  absence_personnel: 'Absence de personnel',
  carburant: 'Carburant',
  site_ferme: 'Site ou dépôt fermé',
  securite: 'Sécurité',
  autre: 'Autre',
};

export interface CauseSaisie {
  categorie: string;
  description: string;
  tonnes: string;
}

/** Meme regle que cloturer_planification ; null si recevable. */
export const erreurCauses = (causes: CauseSaisie[], cible: number | null, livre: number | null): string | null => {
  for (const c of causes) {
    if (!c.categorie) return 'Choisissez la catégorie de chaque cause.';
    if (!c.description.trim()) return 'Décrivez chaque cause.';
    const t = nombreSaisi(c.tonnes);
    if (t !== null && !(t >= 0)) return 'Tonnes perdues : nombre positif ou vide.';
  }
  if (cible !== null && livre !== null && livre < cible && causes.length === 0) {
    return 'Réalisé sous l\'objectif : indiquez au moins une cause d\'écart.';
  }
  return null;
};

export const causesServeur = (causes: CauseSaisie[]) =>
  causes.map((c) => ({ categorie: c.categorie, description: c.description.trim(), tonnes: nombreSaisi(c.tonnes) }));

// Comparaison entre shifts
export interface LigneShift {
  shift_id: string | null;
  shift: string;
  jours: number;
  voyages: number;
  voyages_livres: number;
  tonnes_livrees: number;
  voyages_sans_poids: number;
  tonnes_par_voyage: number | null;
  rotations_mesurees: number;
  duree_rotation_min: number | null;
  trajets_mesures: number;
  duree_trajet_min: number | null;
  tonnes_cible: number | null;
  tonnes_livrees_objectif: number | null;
  realisation_pct: number | null;
  postes: number;
  postes_clos: number;
  incidents: number | null;
  arrets: number | null;
  retards: number | null;
  presences: number | null;
  absences: number | null;
  retard_minutes: number | null;
}

/** Tonnes par jour d'activite du shift ; null sans jour actif. */
export const tonnesParJour = (l: LigneShift): number | null => (l.jours > 0 ? Number(l.tonnes_livrees) / l.jours : null);

/** Part des membres d'equipe absents ; null sans pointage. */
export const tauxAbsence = (l: LigneShift): number | null => {
  const total = (l.presences ?? 0) + (l.absences ?? 0);
  return total > 0 ? ((l.absences ?? 0) / total) * 100 : null;
};
