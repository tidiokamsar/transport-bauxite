// Infrastructures de site et fermetures (D-047) : memes regles que la
// fonction serveur site_ferme_le pour l'etat d'une fermeture.

export const TYPES_INFRASTRUCTURE = {
  point_chargement: 'Point de chargement',
  depot_reception: 'Dépôt de réception',
  pont_bascule: 'Pont-bascule',
  station_carburant: 'Station carburant',
  atelier: 'Atelier',
  zone_securite: 'Zone de sécurité',
} as const;

export interface Fermeture {
  id: string; site_id: string; infrastructure_id: string | null; debut: string; fin: string | null;
  motif: string; levee_le: string | null; motif_levee: string | null;
}

// Fin effective : la plus proche de la fin prevue et de la levee.
export const finEffective = (f: Pick<Fermeture, 'fin' | 'levee_le'>): Date | null => {
  const dates = [f.fin, f.levee_le].filter((x): x is string => x !== null).map((x) => new Date(x));
  return dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
};

export const fermetureActive = (f: Pick<Fermeture, 'debut' | 'fin' | 'levee_le'>, a: Date) => {
  const fin = finEffective(f);
  return new Date(f.debut) <= a && (fin === null || fin > a);
};
