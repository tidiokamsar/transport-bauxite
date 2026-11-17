import { useState, type FormEvent } from 'react';
import { ScanLine } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { naviguer, routeDetail } from '../ui/routeur';
import { VUE_PNEUS } from './socle';

// Briques communes aux espaces et a la fiche Pneus (D-091).

/** Champ compatible douchette (le lecteur tape le code puis Entree) : ouvre la fiche ou l'action du pneu lu. */
export const Douchette = ({ action, libelle = 'Code SIGTB ou numéro de série' }: { action?: string; libelle?: string }) => {
  const [saisie, setSaisie] = useState('');
  const [message, setMessage] = useState('');
  const chercher = async (e: FormEvent) => {
    e.preventDefault();
    const s = saisie.trim().toUpperCase();
    if (!s) return;
    const [a, b, c] = await Promise.all([
      supabase.from('tires').select('id').eq('code_sigtb', s).limit(1),
      supabase.from('tires').select('id').eq('numero_serie', s).limit(1),
      supabase.from('tires').select('id').eq('tire_number', s).limit(1),
    ]);
    const erreur = a.error ?? b.error ?? c.error;
    if (erreur) { setMessage(`Recherche impossible : ${erreur.message}`); return; }
    const id = ([...(a.data ?? []), ...(b.data ?? []), ...(c.data ?? [])] as { id: string }[])[0]?.id;
    if (!id) { setMessage(`Aucun pneu « ${s} » dans votre périmètre.`); return; }
    setMessage('');
    setSaisie('');
    naviguer(action ? `#/${VUE_PNEUS}/${id}/${action}` : routeDetail(VUE_PNEUS, id));
  };
  return (
    <form onSubmit={chercher} role="search" aria-label={libelle} className="flex flex-wrap items-center gap-2">
      <label className="relative w-full min-w-0 flex-1 sm:w-auto sm:min-w-[240px]">
        <span className="sr-only">{libelle}</span>
        <ScanLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder={`${libelle} (douchette)`} autoComplete="off"
          className="w-full rounded-lg border border-stone-300 py-2 pl-9 pr-3 text-sm" />
      </label>
      <button type="submit" className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium">Ouvrir</button>
      {message && <p role="alert" className="w-full text-sm text-red-700">{message}</p>}
    </form>
  );
};

