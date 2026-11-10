// Calculs de la planification v1 (CDC 6.2, 6.3, D-023). Fonctions pures :
// aucune valeur par defaut inventee ; un calcul impossible renvoie null et
// l'ecran affiche « sans donnees » ou « donnees insuffisantes ».

export interface ShiftHoraire {
  id: string;
  display_name: string;
  start_time: string; // HH:MM[:SS]
  end_time: string;
}

export interface Fenetre {
  debut: Date;
  fin: Date;
}

const aHeure = (date: string, heure: string) => {
  const [a, m, j] = date.split('-').map(Number);
  const [h, min] = heure.split(':').map(Number);
  return new Date(a, m - 1, j, h, min, 0, 0);
};

/** Fenetre d'un shift a une date ; un shift de nuit finit le lendemain. */
export const fenetreShift = (date: string, shift: Pick<ShiftHoraire, 'start_time' | 'end_time'>): Fenetre => {
  const debut = aHeure(date, shift.start_time);
  const fin = aHeure(date, shift.end_time);
  if (fin <= debut) fin.setDate(fin.getDate() + 1);
  return { debut, fin };
};

/**
 * Fenetre d'une journee d'exploitation : du debut du premier shift a la fin
 * du dernier ; sans shift defini, de 00:00 a 24:00.
 */
export const fenetreJournee = (date: string, shifts: Pick<ShiftHoraire, 'start_time' | 'end_time'>[]): Fenetre => {
  if (shifts.length === 0) {
    const debut = aHeure(date, '00:00');
    const fin = new Date(debut);
    fin.setDate(fin.getDate() + 1);
    return { debut, fin };
  }
  const fenetres = shifts.map((s) => fenetreShift(date, s));
  return {
    debut: new Date(Math.min(...fenetres.map((f) => f.debut.getTime()))),
    fin: new Date(Math.max(...fenetres.map((f) => f.fin.getTime()))),
  };
};

export type Avancement = 'a_venir' | 'en_cours' | 'termine';

export interface Suivi {
  avancement: Avancement;
  pourcentage: number;
  ecart: number;
  /**
   * Projection au rythme constate ; null tant que moins de 30 min et moins
   * de 15 % de la periode se sont ecoules (rythme trop peu observe).
   */
  prevision: number | null;
  /** Tonnes par heure a tenir pour atteindre l'objectif ; null si termine. */
  rythmeRequis: number | null;
  heuresRestantes: number;
}

const DELAI_MINIMAL_PREVISION_MS = 30 * 60_000;
const PART_MINIMALE_PREVISION = 0.15;

export const suivre = (cible: number, realise: number, fenetre: Fenetre, maintenant: Date): Suivi => {
  const duree = fenetre.fin.getTime() - fenetre.debut.getTime();
  const ecoule = Math.min(Math.max(maintenant.getTime() - fenetre.debut.getTime(), 0), duree);
  const restant = duree - ecoule;
  const avancement: Avancement = ecoule <= 0 ? 'a_venir' : restant <= 0 ? 'termine' : 'en_cours';
  let prevision: number | null = null;
  if (avancement === 'termine') prevision = realise;
  else if (avancement === 'en_cours' && ecoule >= Math.max(DELAI_MINIMAL_PREVISION_MS, duree * PART_MINIMALE_PREVISION)) {
    prevision = (realise / ecoule) * duree;
  }
  const reste = Math.max(0, cible - realise);
  return {
    avancement,
    pourcentage: cible > 0 ? (realise / cible) * 100 : 0,
    ecart: realise - cible,
    prevision,
    rythmeRequis: avancement === 'termine' ? null : reste / (restant / 3_600_000),
    heuresRestantes: restant / 3_600_000,
  };
};

export interface StatistiquesRotation {
  jours_observes: number;
  voyages: number;
  charge_moyenne: number | null;
  rotations_par_camion: number | null;
  camions_par_jour: number | null;
}

/** Seuils sous lesquels l'historique est juge trop maigre pour estimer. */
export const MINIMUM_JOURS = 3;
export const MINIMUM_VOYAGES = 10;

export interface EstimationCamions {
  camions: number;
  charge: number;
  rotations: number;
}

/** Camions necessaires (CDC 6.2) = cible / (charge moyenne x rotations par camion). */
export const camionsNecessaires = (cible: number, stats: StatistiquesRotation | null): EstimationCamions | null => {
  if (!stats || stats.jours_observes < MINIMUM_JOURS || stats.voyages < MINIMUM_VOYAGES) return null;
  const charge = Number(stats.charge_moyenne);
  const rotations = Number(stats.rotations_par_camion);
  if (!(charge > 0) || !(rotations > 0)) return null;
  return { camions: Math.ceil(cible / (charge * rotations)), charge, rotations };
};

export interface ObjectifRealise {
  site_id: string;
  shift_id: string | null;
  tonnes_cible: number;
  tonnes_livrees: number;
}

/**
 * Objectif et realisation de la journee pour un ensemble de sites : par
 * site, l'objectif de journee s'il existe, sinon la somme des objectifs de
 * shift. null si aucun objectif.
 */
export const totalJournee = (objectifs: ObjectifRealise[]): { cible: number; realise: number } | null => {
  if (objectifs.length === 0) return null;
  const parSite = new Map<string, ObjectifRealise[]>();
  for (const o of objectifs) parSite.set(o.site_id, [...(parSite.get(o.site_id) ?? []), o]);
  let cible = 0;
  let realise = 0;
  for (const liste of parSite.values()) {
    const journee = liste.find((o) => o.shift_id === null);
    const retenus = journee ? [journee] : liste;
    for (const o of retenus) {
      cible += Number(o.tonnes_cible);
      realise += Number(o.tonnes_livrees);
    }
  }
  return { cible, realise };
};
