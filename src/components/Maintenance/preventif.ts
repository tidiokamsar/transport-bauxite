// Echeance d'un planning preventif (D-061) : calculee seulement depuis des
// donnees connues (derniere intervention saisie, intervalle, dernier releve
// compteur D-043). Aucun seuil d'alerte code en dur : l'ecran montre le reste
// a courir, l'humain decide.

export interface PlanningEcheance {
  next_service_km: number | null;
  next_service_date: string | null;
}

export interface Releve { valeur_km: number; releve_le: string }

export type StatutEcheance = 'depassee' | 'a_venir' | 'inconnue';

export interface Echeance {
  statut: StatutEcheance;
  kmRestants: number | null;
  joursRestants: number | null;
}

const JOUR = 24 * 60 * 60 * 1000;

export const echeancePlanning = (p: PlanningEcheance, releve: Releve | null, aujourdhui: Date): Echeance => {
  const kmRestants = p.next_service_km !== null && releve ? Number(p.next_service_km) - Number(releve.valeur_km) : null;
  let joursRestants: number | null = null;
  if (p.next_service_date) {
    const debut = Date.UTC(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate());
    const [a, m, j] = p.next_service_date.slice(0, 10).split('-').map(Number);
    joursRestants = Math.round((Date.UTC(a, m - 1, j) - debut) / JOUR);
  }
  if (kmRestants === null && joursRestants === null) return { statut: 'inconnue', kmRestants, joursRestants };
  const depassee = (kmRestants !== null && kmRestants <= 0) || (joursRestants !== null && joursRestants <= 0);
  return { statut: depassee ? 'depassee' : 'a_venir', kmRestants, joursRestants };
};

/** Dernier releve compteur par engin (releves en vigueur, ordre quelconque). */
export const dernierReleveParEngin = (releves: (Releve & { vehicle_id: string })[]): Map<string, Releve> => {
  const m = new Map<string, Releve>();
  for (const r of releves) {
    const actuel = m.get(r.vehicle_id);
    if (!actuel || r.releve_le > actuel.releve_le) m.set(r.vehicle_id, { valeur_km: r.valeur_km, releve_le: r.releve_le });
  }
  return m;
};
