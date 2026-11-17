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

// Pages standard (D-090) : adresse, colonnes, saisie et regles des actions.

export const VUE_PREVENTIF = 'preventive';
export const MODULE_PREVENTIF = 'Maintenance préventive';

export interface Planning {
  id: string; vehicle_id: string | null; title: string; description: string | null; maintenance_type: string;
  interval_km: number | null; interval_days: number | null; last_maintenance_km: number | null; last_maintenance_date: string | null;
  next_service_km: number | null; next_service_date: string | null; estimated_cost: number | null; is_active: boolean | null;
  created_at: string | null; updated_at: string | null;
}

export const COLONNES_PLANNING = 'id, vehicle_id, title, description, maintenance_type, interval_km, interval_days, last_maintenance_km, last_maintenance_date, next_service_km, next_service_date, estimated_cost, is_active, created_at, updated_at';

export const TYPES_PLANNING = ['Vidange moteur', 'Graissage', 'Remplacement des filtres', 'Contrôle des freins', 'Contrôle de la transmission',
  'Contrôle hydraulique', 'Contrôle électrique', 'Révision générale', 'Autre'];

export const ACTIONS_PLANNING = ['desactiver', 'reactiver'] as const;
export type ActionPlanning = typeof ACTIONS_PLANNING[number];

export const actionPlanningInterdite = (action: ActionPlanning, actif: boolean, droit: boolean): string | null => {
  if (!droit) return 'Droit d\'écriture sur la maintenance requis.';
  if (action === 'desactiver') return actif ? null : 'Planning déjà désactivé.';
  return actif ? 'Planning déjà actif.' : null;
};

export type SaisiePlanning = {
  engin: string; titre: string; type: string; description: string; km: string; jours: string; dernierKm: string; derniereDate: string; cout: string;
};

export const saisieDepuisPlanning = (p?: Planning | null): SaisiePlanning => ({
  engin: p?.vehicle_id ?? '', titre: p?.title ?? '', type: p?.maintenance_type ?? '', description: p?.description ?? '',
  km: p?.interval_km?.toString() ?? '', jours: p?.interval_days?.toString() ?? '', dernierKm: p?.last_maintenance_km?.toString() ?? '',
  derniereDate: p?.last_maintenance_date ?? '', cout: p?.estimated_cost?.toString() ?? '',
});

const nombre = (v: string): number | null => (v.trim() === '' ? null : Number(v.replace(/\s/g, '').replace(',', '.')));

export const erreursPlanning = (f: SaisiePlanning): string[] => {
  const km = nombre(f.km); const jours = nombre(f.jours); const dernierKm = nombre(f.dernierKm); const cout = nombre(f.cout);
  const invalide = (n: number | null) => n !== null && (Number.isNaN(n) || n < 0);
  return [
    ...(!f.engin ? ['Choisissez l\'engin.'] : []),
    ...(!f.titre.trim() ? ['Intitulé obligatoire.'] : []),
    ...(!f.type ? ['Choisissez le type d\'intervention.'] : []),
    ...(invalide(km) ? ['Intervalle en km : nombre positif attendu.'] : []),
    // Intervalle en jours : entier (colonne integer, D-078).
    ...(invalide(jours) || (jours !== null && !Number.isInteger(jours)) ? ['Intervalle en jours : nombre entier attendu (sans décimales).'] : []),
    ...(!((km ?? 0) > 0 || (jours ?? 0) > 0) ? ['Au moins un intervalle (km ou jours) supérieur à zéro.'] : []),
    ...(invalide(dernierKm) ? ['Compteur de la dernière intervention : nombre positif attendu.'] : []),
    ...(invalide(cout) ? ['Coût estimé : nombre positif attendu.'] : []),
  ];
};

export const valeursPlanning = (f: SaisiePlanning) => ({
  vehicle_id: f.engin, title: f.titre.trim(), maintenance_type: f.type, description: f.description.trim() || null,
  interval_km: nombre(f.km), interval_days: nombre(f.jours), last_maintenance_km: nombre(f.dernierKm),
  last_maintenance_date: f.derniereDate || null, estimated_cost: nombre(f.cout),
});
