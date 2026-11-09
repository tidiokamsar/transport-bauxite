import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { SiteResume } from '../../contexts/SiteContext';

// Creation d'un voyage par la fonction serveur creer_voyage : reference
// generee par le serveur, voyage « affecte » si camion et chauffeur sont
// choisis, sinon « planifie ». Aucun champ pre-rempli avec une valeur
// inventee (prime, carburant, position).

export interface Option {
  id: string;
  libelle: string;
}

export const NouveauVoyage = ({
  date,
  sites,
  camions,
  chauffeurs,
  chargeuses,
  shifts,
  onFermer,
  onCree,
}: {
  date: string;
  sites: SiteResume[];
  camions: Option[];
  chauffeurs: Option[];
  chargeuses: Option[];
  shifts: Option[];
  onFermer: () => void;
  onCree: (id: string) => void;
}) => {
  const [form, setForm] = useState({
    date,
    origine: '',
    destination: '',
    camion: '',
    chauffeur: '',
    chargeuse: '',
    shift: '',
    note: '',
  });
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const maj = (champ: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [champ]: e.target.value });

  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.origine && form.origine === form.destination) {
      setErreur('L\'origine et la destination doivent être différentes.');
      return;
    }
    setEnCours(true);
    setErreur('');
    const { data, error } = await supabase.rpc('creer_voyage', {
      p_planned_date: form.date,
      p_departure_site_id: form.origine,
      p_arrival_site_id: form.destination,
      p_vehicle_id: form.camion || null,
      p_driver_id: form.chauffeur || null,
      p_loader_vehicle_id: form.chargeuse || null,
      p_trailer_id: null,
      p_shift_id: form.shift || null,
      p_note: form.note || null,
    });
    setEnCours(false);
    if (error) {
      setErreur(error.message);
      return;
    }
    onCree(data as string);
  };

  const champ = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20';
  const liste = (valeur: string, onChange: ReturnType<typeof maj>, options: Option[], vide: string, requis = false) => (
    <select value={valeur} onChange={onChange} className={champ} required={requis}>
      <option value="">{vide}</option>
      {options.map((o) => <option key={o.id} value={o.id}>{o.libelle}</option>)}
    </select>
  );

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/30 p-4" onClick={onFermer}>
      <form
        onSubmit={valider}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-nouveau-voyage"
      >
        <header className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <h2 id="titre-nouveau-voyage" className="text-xl font-black text-stone-900">Nouveau voyage</h2>
          <button type="button" onClick={onFermer} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-stone-700">Date prévue *</span>
            <input type="date" value={form.date} onChange={maj('date')} className={champ} required />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-stone-700">Shift</span>
            {liste(form.shift, maj('shift'), shifts, 'Non précisé')}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-stone-700">Origine *</span>
            {liste(form.origine, maj('origine'), sites.map((s) => ({ id: s.id, libelle: s.name })), 'Choisir un site', true)}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-stone-700">Destination *</span>
            {liste(form.destination, maj('destination'), sites.map((s) => ({ id: s.id, libelle: s.name })), 'Choisir un site', true)}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-stone-700">Camion</span>
            {liste(form.camion, maj('camion'), camions, 'À affecter plus tard')}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-stone-700">Chauffeur</span>
            {liste(form.chauffeur, maj('chauffeur'), chauffeurs, 'À affecter plus tard')}
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-stone-700">Chargeuse ou pelle</span>
            {liste(form.chargeuse, maj('chargeuse'), chargeuses, 'Non précisée')}
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-stone-700">Note</span>
            <textarea value={form.note} onChange={maj('note')} rows={2} className={champ} />
          </label>
          {sites.length === 0 && (
            <p className="rounded-lg bg-orange-50 p-3 text-sm text-orange-900 sm:col-span-2">
              Aucun site enregistré : créez d'abord les sites (Exploitation, Sites).
            </p>
          )}
          {erreur && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{erreur}</p>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-stone-200 px-6 py-4">
          <button type="button" onClick={onFermer} className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">Annuler</button>
          <button type="submit" disabled={enCours} className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-700 px-5 py-2 text-sm font-bold text-white disabled:opacity-60">
            {enCours ? 'Création...' : 'Créer le voyage'}
          </button>
        </footer>
      </form>
    </div>
  );
};
