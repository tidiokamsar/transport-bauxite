// Type Vehicle canonique, partage par les vues et modales du module.
// Les dates d'expiration viennent de PostgreSQL : absentes = null.
export interface Vehicle {
  id?: string;
  registration: string;
  brand_model: string;
  year?: number;
  capacity_tonnes: number;
  vehicle_type: string;
  chassis_number?: string;
  current_km: number;
  status: string;
  purchase_cost?: number;
  current_value?: number;
  insurance_expiry?: string | null;
  technical_inspection_expiry?: string | null;
}
