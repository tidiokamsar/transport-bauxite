import { useState } from 'react';
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, ErreurFenetre, Fenetre } from '../ui/Fenetre';
import { supabase } from '../../lib/supabase';
import { useSite } from '../../contexts/SiteContext';
import { useAuth } from '../../contexts/AuthContext';
import type { Vehicle, VehiculeDescriptif } from '../../types/vehicle';
import { TYPES_VEHICULE } from './flotte';

// Creation et modification des champs descriptifs d'un engin (D-062). Le
// statut, la propriete et le contrat passent par la fiche (fonctions
// serveur, journal) ; le kilometrage par les releves de compteur (D-043).

const CHAMP = 'mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm';

const vide = (v: string) => (v.trim() === '' ? null : v.trim());

export const VehicleModal = ({ vehicle, onClose }: { vehicle: Vehicle | null; onClose: (modifie: boolean) => void }) => {
  const { sites } = useSite();
  const { profile } = useAuth();
  // Profil borne : l'engin est enregistre sur son site ; « engin global »
  // n'est propose qu'a un profil global (D-038, D-078).
  const siteProfil = profile?.site_id ?? null;
  const [f, setF] = useState({
    registration: vehicle?.registration ?? '',
    brand_model: vehicle?.brand_model ?? '',
    vehicle_type: vehicle?.vehicle_type ?? '',
    capacity_tonnes: vehicle ? String(vehicle.capacity_tonnes) : '',
    year: vehicle?.year ? String(vehicle.year) : '',
    chassis_number: vehicle?.chassis_number ?? '',
    site_id: vehicle?.site_id ?? siteProfil ?? '',
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
      site_id: siteProfil ?? (f.site_id || null), insurance_expiry: f.insurance_expiry || null,
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
    <Fenetre
      titre={vehicle ? `Modifier ${vehicle.registration}` : 'Nouvel engin'}
      onFermer={() => onClose(false)}
      enCours={busy}
      onSubmit={(e) => { e.preventDefault(); void enregistrer(); }}
      pied={<>
        <button type="button" onClick={() => onClose(false)} disabled={busy} className={BOUTON_SECONDAIRE}>Annuler</button>
        <button type="submit" disabled={busy || !pret} className={BOUTON_PRINCIPAL}>Enregistrer</button>
      </>}
    >
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <ErreurFenetre className="sm:col-span-2">{erreur}</ErreurFenetre>
          <label>Immatriculation *<input value={f.registration} onChange={(e) => poser('registration', e.target.value)} className={CHAMP} /></label>
          <label>Marque et modèle *<input value={f.brand_model} onChange={(e) => poser('brand_model', e.target.value)} className={CHAMP} /></label>
          <label>Type *<select value={f.vehicle_type} onChange={(e) => poser('vehicle_type', e.target.value)} className={CHAMP}>
            <option value="">Choisir</option>{Object.entries(TYPES_VEHICULE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Capacité (t) *<input inputMode="decimal" value={f.capacity_tonnes} onChange={(e) => poser('capacity_tonnes', e.target.value)} className={CHAMP} /></label>
          <label>Année<input inputMode="numeric" value={f.year} onChange={(e) => poser('year', e.target.value.replace(/\D/g, ''))} className={CHAMP} /></label>
          <label>Numéro de châssis<input value={f.chassis_number} onChange={(e) => poser('chassis_number', e.target.value)} className={CHAMP} /></label>
          <label>Site d'affectation<select value={siteProfil ?? f.site_id} onChange={(e) => poser('site_id', e.target.value)} disabled={Boolean(siteProfil)} className={CHAMP}>
            {!siteProfil && <option value="">Aucun (engin global)</option>}{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <span />
          <label>Expiration assurance<input type="date" value={f.insurance_expiry} onChange={(e) => poser('insurance_expiry', e.target.value)} className={CHAMP} /></label>
          <label>Expiration visite technique<input type="date" value={f.technical_inspection_expiry} onChange={(e) => poser('technical_inspection_expiry', e.target.value)} className={CHAMP} /></label>
          <p className="text-xs text-stone-500 sm:col-span-2">Propriété, contrat et statut se renseignent depuis la fiche de l'engin (journalisés) ; le kilométrage par les relevés de compteur.</p>
        </div>
    </Fenetre>
  );
};
