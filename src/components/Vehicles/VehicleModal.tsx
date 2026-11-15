import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSite } from '../../contexts/SiteContext';
import type { Vehicle, VehiculeDescriptif } from '../../types/vehicle';
import { TYPES_VEHICULE } from './flotte';

// Creation et modification des champs descriptifs d'un engin (D-062). Le
// statut, la propriete et le contrat passent par la fiche (fonctions
// serveur, journal) ; le kilometrage par les releves de compteur (D-043).

const CHAMP = 'mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm';

const vide = (v: string) => (v.trim() === '' ? null : v.trim());

export const VehicleModal = ({ vehicle, onClose }: { vehicle: Vehicle | null; onClose: (modifie: boolean) => void }) => {
  const { sites } = useSite();
  const [f, setF] = useState({
    registration: vehicle?.registration ?? '',
    brand_model: vehicle?.brand_model ?? '',
    vehicle_type: vehicle?.vehicle_type ?? '',
    capacity_tonnes: vehicle ? String(vehicle.capacity_tonnes) : '',
    year: vehicle?.year ? String(vehicle.year) : '',
    chassis_number: vehicle?.chassis_number ?? '',
    site_id: vehicle?.site_id ?? '',
    insurance_expiry: vehicle?.insurance_expiry ?? '',
    technical_inspection_expiry: vehicle?.technical_inspection_expiry ?? '',
  });
  const [erreur, setErreur] = useState('');
  const [busy, setBusy] = useState(false);
  const poser = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v });

  const capacite = Number(f.capacity_tonnes.replace(',', '.'));
  const pret = f.registration.trim() && f.brand_model.trim() && f.vehicle_type && f.capacity_tonnes.trim() !== '' && capacite >= 0;

  const enregistrer = async () => {
    if (!pret) { setErreur('Immatriculation, modèle, type et capacité sont requis'); return; }
    const corps: VehiculeDescriptif = {
      registration: f.registration.trim(), brand_model: f.brand_model.trim(), vehicle_type: f.vehicle_type,
      capacity_tonnes: capacite, year: f.year ? Number(f.year) : null, chassis_number: vide(f.chassis_number),
      site_id: f.site_id || null, insurance_expiry: f.insurance_expiry || null,
      technical_inspection_expiry: f.technical_inspection_expiry || null,
    };
    setBusy(true);
    const { error } = vehicle
      ? await supabase.from('vehicles').update(corps).eq('id', vehicle.id)
      : await supabase.from('vehicles').insert(corps);
    setBusy(false);
    if (error) { setErreur(error.message); return; }
    onClose(true);
  };

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/30 p-4" onClick={() => onClose(false)}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={vehicle ? 'Modifier un engin' : 'Nouvel engin'}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <h2 className="text-xl font-black text-stone-900">{vehicle ? `Modifier ${vehicle.registration}` : 'Nouvel engin'}</h2>
          <button onClick={() => onClose(false)} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" aria-label="Fermer"><X className="h-5 w-5" /></button>
        </header>
        <div className="grid grid-cols-1 gap-3 px-6 py-5 text-sm sm:grid-cols-2">
          <label>Immatriculation *<input value={f.registration} onChange={(e) => poser('registration', e.target.value)} className={CHAMP} /></label>
          <label>Marque et modèle *<input value={f.brand_model} onChange={(e) => poser('brand_model', e.target.value)} className={CHAMP} /></label>
          <label>Type *<select value={f.vehicle_type} onChange={(e) => poser('vehicle_type', e.target.value)} className={CHAMP}>
            <option value="">Choisir</option>{Object.entries(TYPES_VEHICULE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Capacité (t) *<input inputMode="decimal" value={f.capacity_tonnes} onChange={(e) => poser('capacity_tonnes', e.target.value)} className={CHAMP} /></label>
          <label>Année<input inputMode="numeric" value={f.year} onChange={(e) => poser('year', e.target.value.replace(/\D/g, ''))} className={CHAMP} /></label>
          <label>Numéro de châssis<input value={f.chassis_number} onChange={(e) => poser('chassis_number', e.target.value)} className={CHAMP} /></label>
          <label>Site d'affectation<select value={f.site_id} onChange={(e) => poser('site_id', e.target.value)} className={CHAMP}>
            <option value="">Aucun (engin global)</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <span />
          <label>Expiration assurance<input type="date" value={f.insurance_expiry} onChange={(e) => poser('insurance_expiry', e.target.value)} className={CHAMP} /></label>
          <label>Expiration visite technique<input type="date" value={f.technical_inspection_expiry} onChange={(e) => poser('technical_inspection_expiry', e.target.value)} className={CHAMP} /></label>
          <p className="text-xs text-stone-500 sm:col-span-2">Propriété, contrat et statut se renseignent depuis la fiche de l'engin (journalisés) ; le kilométrage par les relevés de compteur.</p>
          {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700 sm:col-span-2">{erreur}</p>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-stone-200 px-6 py-4">
          <button onClick={() => onClose(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">Annuler</button>
          <button disabled={busy || !pret} onClick={enregistrer} className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-700 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer</button>
        </footer>
      </div>
    </div>
  );
};
