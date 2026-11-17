// Immobilisations des engins loues (D-022, D-025) : libelles et calculs
// purs. Une immobilisation ouverte court jusqu'a maintenant ; une duree
// se borne toujours a la periode consultee.

export type Cause = 'panne' | 'maintenance_planifiee' | 'pneumatique' | 'accident' | 'attente_piece' | 'autre';
export type Imputation = 'loueur' | 'exploitant' | 'a_determiner';

export const CAUSES: Record<Cause, string> = {
  panne: 'Panne',
  maintenance_planifiee: 'Maintenance planifiée',
  pneumatique: 'Pneumatique',
  accident: 'Accident',
  attente_piece: 'Attente de pièce',
  autre: 'Autre',
};

export const IMPUTATIONS: Record<Imputation, { libelle: string; teinte: 'violet' | 'orange' | 'gris' }> = {
  loueur: { libelle: 'Loueur', teinte: 'violet' },
  exploitant: { libelle: 'Exploitant', teinte: 'orange' },
  a_determiner: { libelle: 'À déterminer', teinte: 'gris' },
};

export interface Immobilisation {
  id: string;
  vehicle_id: string;
  debut: string;
  fin: string | null;
  cause: Cause;
  imputation: Imputation;
  description: string;
  reference_loueur: string | null;
  statut: 'ouverte' | 'cloturee' | 'annulee';
}

/** Heures d'une immobilisation comprises dans [du, au[ (ouverte : jusqu'a maintenant). */
export const heuresDansPeriode = (i: Pick<Immobilisation, 'debut' | 'fin'>, du: Date, au: Date, maintenant: Date): number => {
  const debut = Math.max(new Date(i.debut).getTime(), du.getTime());
  const fin = Math.min(i.fin ? new Date(i.fin).getTime() : maintenant.getTime(), au.getTime());
  return Math.max(0, fin - debut) / 3_600_000;
};

/** Total des heures par imputation sur la periode. */
export const totalParImputation = (liste: Immobilisation[], du: Date, au: Date, maintenant: Date): Record<Imputation, number> => {
  const total: Record<Imputation, number> = { loueur: 0, exploitant: 0, a_determiner: 0 };
  for (const i of liste) {
    if (i.statut === 'annulee') continue;
    total[i.imputation] += heuresDansPeriode(i, du, au, maintenant);
  }
  return total;
};

/**
 * Disponibilite d'une flotte sur la periode = 1 - heures immobilisees /
 * (engins x heures ecoulees de la periode). null sans engin ni duree.
 */
export const disponibilite = (heuresImmobilisees: number, engins: number, du: Date, au: Date, maintenant: Date): number | null => {
  const ecoulees = (Math.min(au.getTime(), maintenant.getTime()) - du.getTime()) / 3_600_000;
  if (engins <= 0 || ecoulees <= 0) return null;
  return Math.max(0, 1 - heuresImmobilisees / (engins * ecoulees)) * 100;
};

/** « 3 j 4 h », « 5 h 20 », « 45 min ». */
export const formatDuree = (heures: number): string => {
  const minutes = Math.round(heures * 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
  const j = Math.floor(h / 24);
  const r = h % 24;
  return r ? `${j} j ${r} h` : `${j} j`;
};

/** Mois [debut, debut du mois suivant[ au format AAAA-MM, en heure locale. */
export const bornesMois = (mois: string): { du: Date; au: Date } => {
  const [a, m] = mois.split('-').map(Number);
  return { du: new Date(a, m - 1, 1), au: new Date(a, m, 1) };
};

// Pages standard (D-090) : route, droits et etats des actions.

export const VUE_IMMOBILISATIONS = 'immobilisations';
export const MODULE_IMMOBILISATIONS = 'Immobilisations';
export const AIDE_IMPUTATION = 'Contrat Nimba Mining (D-022) : maintenance à la charge du loueur, pneus et carburant à la charge de l\'exploitant.';

export const COLONNES_IMMOBILISATION = 'id, vehicle_id, debut, fin, cause, imputation, description, reference_loueur, statut, declare_par, declare_le, cloture_par, cloture_le';
export interface ImmobilisationFiche extends Immobilisation { declare_par: string | null; declare_le: string; cloture_par: string | null; cloture_le: string | null }

export const STATUTS_IMMOBILISATION: Record<Immobilisation['statut'], { libelle: string; teinte: 'rouge' | 'vert' | 'gris' }> = {
  ouverte: { libelle: 'En cours', teinte: 'rouge' },
  cloturee: { libelle: 'Clôturée', teinte: 'vert' },
  annulee: { libelle: 'Annulée', teinte: 'gris' },
};

/** Date locale pour un champ datetime-local (AAAA-MM-JJTHH:MM). */
export const versLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
/** Valeur d'un champ datetime-local en ISO ; null si vide ou illisible. */
export const versIso = (local: string): string | null => {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export const ACTIONS_IMMOBILISATION = ['cloturer', 'corriger', 'annuler'] as const;
export type ActionImmobilisation = typeof ACTIONS_IMMOBILISATION[number];

/**
 * Raison pour laquelle l'action est impossible (droit, etat), comme le
 * serveur (D-025, D-049) ; null = possible. Une immobilisation suivie par
 * une intervention du loueur en cours se cloture par la validation de la
 * remise en service, pas directement.
 */
export const actionImmobilisationInterdite = (
  action: ActionImmobilisation, statut: Immobilisation['statut'], peutEcrire: boolean, interventionEnCours: boolean,
): string | null => {
  if (!peutEcrire) return 'Droit d\'écriture sur la maintenance requis.';
  if (statut === 'annulee') return 'Immobilisation annulée : plus aucune action possible.';
  if (action === 'cloturer') {
    if (statut !== 'ouverte') return 'Immobilisation déjà clôturée.';
    if (interventionEnCours) return 'Intervention du loueur en cours : l\'immobilisation se clôture par la validation de la remise en service (Interventions Neemba).';
  }
  return null;
};

export interface SaisieDeclaration { engin: string; debut: string; cause: string; imputation: string; description: string; reference: string }

/** Erreurs de la declaration (periode et chevauchement restent controles par le serveur). */
export const erreursDeclaration = (f: SaisieDeclaration, maintenant: Date = new Date()): string[] => {
  const e: string[] = [];
  if (!f.engin) e.push('Engin requis.');
  const debut = versIso(f.debut);
  if (!debut) e.push('Heure de début requise.');
  else if (new Date(debut).getTime() > maintenant.getTime()) e.push('Heure de début dans le futur : on déclare une immobilisation constatée.');
  if (!f.cause) e.push('Cause requise.');
  if (!f.imputation) e.push('Imputation requise (aucune valeur par défaut).');
  if (!f.description.trim()) e.push('Description requise.');
  return e;
};
