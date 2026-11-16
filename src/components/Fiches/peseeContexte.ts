// Referentiels partages par les quatre espaces de la pesee (D-081).

export interface Lib { id: string; libelle: string }
export interface VoyageRef {
  id: string; reference: string; planned_date: string; departure_site_id: string | null; arrival_site_id: string | null;
  vehicle_id: string | null; etat: string;
}
export interface ContextePesee {
  sites: Lib[];
  engins: Map<string, string>;
  voyages: VoyageRef[];
  peutEcrire: boolean;
  peutValider: boolean;
  peutParametrer: boolean;
  utilisateur: string | null;
}

export const CHAMP = 'mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm';

export type Resultat = { error: { message: string } | null };

export const nombre = (v: number | null | undefined, unite = ' t') =>
  v === null || v === undefined ? '-' : `${Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 3 })}${unite}`;

export const dateHeure = (v: string | null | undefined) => (v ? new Date(v).toLocaleString('fr-FR') : '-');
