import type { Vehicle, VehiculeDescriptif } from '../../types/vehicle';

// Saisie des champs descriptifs d'un engin (D-062, D-090) : valeurs
// initiales reprises de la ligne, erreurs en temps reel, corps envoye.

export interface SaisieVehicule {
  [cle: string]: string;
  registration: string; brand_model: string; vehicle_type: string; capacity_tonnes: string; year: string;
  chassis_number: string; site_id: string; insurance_expiry: string; technical_inspection_expiry: string;
}

export const saisieDepuisVehicule = (v: Vehicle | null, siteProfil: string | null): SaisieVehicule => ({
  registration: v?.registration ?? '',
  brand_model: v?.brand_model ?? '',
  vehicle_type: v?.vehicle_type ?? '',
  capacity_tonnes: v ? String(v.capacity_tonnes) : '',
  year: v?.year ? String(v.year) : '',
  chassis_number: v?.chassis_number ?? '',
  site_id: v?.site_id ?? siteProfil ?? '',
  insurance_expiry: v?.insurance_expiry ?? '',
  technical_inspection_expiry: v?.technical_inspection_expiry ?? '',
});

const capacite = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'));

export const erreursVehicule = (f: SaisieVehicule): string[] => [
  !f.registration.trim() && 'Immatriculation requise.',
  !f.brand_model.trim() && 'Marque et modèle requis.',
  !f.vehicle_type && 'Type requis.',
  f.capacity_tonnes.trim() === '' ? 'Capacité requise.'
    : (Number.isNaN(capacite(f.capacity_tonnes)) || capacite(f.capacity_tonnes) < 0) && 'Capacité en tonnes : nombre positif ou nul.',
].filter((m): m is string => Boolean(m));

const vide = (v: string) => (v.trim() === '' ? null : v.trim());

export const corpsVehicule = (f: SaisieVehicule, siteProfil: string | null): VehiculeDescriptif => ({
  registration: f.registration.trim(),
  brand_model: f.brand_model.trim(),
  vehicle_type: f.vehicle_type,
  capacity_tonnes: capacite(f.capacity_tonnes),
  year: f.year ? Number(f.year) : null,
  chassis_number: vide(f.chassis_number),
  site_id: siteProfil ?? (f.site_id || null),
  insurance_expiry: f.insurance_expiry || null,
  technical_inspection_expiry: f.technical_inspection_expiry || null,
});
