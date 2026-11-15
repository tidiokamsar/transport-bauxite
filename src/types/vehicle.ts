// Type Vehicle canonique du registre de la flotte (vue v_vehicules, D-062).
// Les dates d'expiration viennent de PostgreSQL : absentes = null. Le
// statut operationnel est calcule par le serveur.
export interface Vehicle {
  id: string;
  registration: string;
  brand_model: string;
  year: number | null;
  capacity_tonnes: number;
  vehicle_type: string;
  chassis_number: string | null;
  site_id: string | null;
  status: string;
  insurance_expiry: string | null;
  technical_inspection_expiry: string | null;
  propriete: string | null;
  proprietaire: string | null;
  exploitant: string | null;
  transporteur: string | null;
  contrat_id: string | null;
  contrat_reference: string | null;
  statut_admin: string | null;
  statut_admin_depuis: string | null;
  statut_admin_motif: string | null;
  voyage_en_cours: string | null;
  statut_operationnel: string;
}

/** Champs descriptifs saisissables directement (les autres passent par fonctions serveur). */
export type VehiculeDescriptif = Pick<Vehicle, 'registration' | 'brand_model' | 'year' | 'capacity_tonnes' | 'vehicle_type'
  | 'chassis_number' | 'site_id' | 'insurance_expiry' | 'technical_inspection_expiry'>;
