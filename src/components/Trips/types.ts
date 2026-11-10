// Voyage tel que lu par l'ecran Voyages & Rotations.
export interface Voyage {
  id: string;
  reference: string;
  planned_date: string;
  vehicle_id: string | null;
  driver_id: string | null;
  loader_vehicle_id: string | null;
  departure_site_id: string | null;
  arrival_site_id: string | null;
  shift_id: string | null;
  etat: string | null;
  etat_modifie_le: string | null;
  net_weight: number | null;
  load_weight: number | null;
  net_weight_reception: number | null;
  accepted_tonnage: number | null;
  actual_departure_time: string | null;
  actual_arrival_time: string | null;
  notes: string | null;
}

export const COLONNES_VOYAGE =
  'id, reference, planned_date, vehicle_id, driver_id, loader_vehicle_id, departure_site_id, arrival_site_id, shift_id, etat, etat_modifie_le, net_weight, load_weight, net_weight_reception, accepted_tonnage, actual_departure_time, actual_arrival_time, notes';
