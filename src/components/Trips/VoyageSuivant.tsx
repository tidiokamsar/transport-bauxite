import { useCallback, useEffect, useState } from 'react';
import { Repeat } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SANCTIONS_CONDUITE, SELECTION_SANCTIONS_CONDUITE, sanctionsConduiteParChauffeur } from '../Drivers/infractions';
import { ENCHAINABLES, recommanderSuivant, type ChauffeurEtat, type EnginEtat, type Suivant, type VoyageSimple } from './enchainement';
import type { Voyage } from './types';

// Reaffectation directe apres livraison (D-066), depuis la fiche du voyage
// livre : recommandation affichee, decision du dispatcher par
// enchainer_voyage (memes contraintes que le dispatch, decision historisee).

const COLONNES = 'id, reference, planned_date, etat, vehicle_id, driver_id, loader_vehicle_id, departure_site_id, arrival_site_id, shift_id';

/** Date du jour (heure locale du poste), au format AAAA-MM-JJ. */
const aujourdhui = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

export const VoyageSuivant = ({ voyage, onModifie }: { voyage: Voyage; onModifie: () => void }) => {
  const [proposition, setProposition] = useState<Suivant | null>(null);
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');
  const [erreurLecture, setErreurLecture] = useState('');
  const [enCours, setEnCours] = useState(false);
  // Date du nouveau voyage : le jour meme par defaut, jamais avant le voyage livre.
  const [date, setDate] = useState(() => {
    const jour = aujourdhui();
    return voyage.planned_date && voyage.planned_date > jour ? voyage.planned_date : jour;
  });
  const enchainable = ENCHAINABLES.includes(voyage.etat ?? '') && Boolean(voyage.vehicle_id && voyage.driver_id);

  const charger = useCallback(async () => {
    if (!enchainable || !voyage.vehicle_id || !voyage.driver_id || !voyage.departure_site_id) return;
    const ids = [voyage.vehicle_id, voyage.loader_vehicle_id].filter((x): x is string => Boolean(x));
    const [rE, rC, rT, rP, rS] = await Promise.all([
      supabase.from('vehicles').select('id, registration, status').in('id', ids),
      supabase.from('drivers').select('id, name, status, license_expiry').eq('id', voyage.driver_id),
      supabase.from('trips').select(COLONNES).eq('vehicle_id', voyage.vehicle_id).gte('planned_date', voyage.planned_date).limit(200),
      supabase.from('trips').select(COLONNES).eq('departure_site_id', voyage.departure_site_id).is('vehicle_id', null)
        .in('etat', ['DRAFT', 'PLANNED']).gte('planned_date', voyage.planned_date).order('reference').limit(200),
      supabase.from('sanctions_infraction').select(SELECTION_SANCTIONS_CONDUITE)
        .eq('statut', 'active').in('sanction', SANCTIONS_CONDUITE).eq('infractions_chauffeur.driver_id', voyage.driver_id),
    ]);
    const echec = [rE, rC, rT, rP, rS].find((r) => r.error);
    if (echec?.error) {
      // Lecture incomplete : aucune recommandation sur des donnees partielles.
      setErreurLecture(`Lecture impossible : ${echec.error.message}`);
      setProposition(null);
      return;
    }
    setErreurLecture('');
    const engins = (rE.data ?? []) as EnginEtat[];
    setProposition(recommanderSuivant({
      voyage: voyage as VoyageSimple,
      camion: engins.find((e) => e.id === voyage.vehicle_id) ?? null,
      chauffeur: ((rC.data ?? []) as ChauffeurEtat[]).find((c) => c.id === voyage.driver_id) ?? null,
      chargeuse: engins.find((e) => e.id === voyage.loader_vehicle_id) ?? null,
      voyagesCamion: ((rT.data ?? []) as VoyageSimple[]).filter((t) => t.vehicle_id === voyage.vehicle_id),
      prepares: (rP.data ?? []) as VoyageSimple[],
      sanctions: sanctionsConduiteParChauffeur(rS.data ?? []).get(voyage.driver_id),
    }));
  }, [enchainable, voyage]);
  useEffect(() => { charger(); }, [charger]);

  if (!enchainable) return null;

  const enchainer = async () => {
    if (!proposition?.possible || !date) return;
    setEnCours(true); setErreur(''); setMessage('');
    const { error } = await supabase.rpc('enchainer_voyage', {
      p_trip_id: voyage.id,
      p_loader_vehicle_id: proposition.chargeuse?.id ?? null,
      p_suivant: proposition.suivant?.id ?? null,
      // Nouveau voyage : date choisie, shift du voyage livre. Ignoree pour un voyage prepare designe.
      p_date: date,
      p_shift_id: voyage.shift_id ?? null,
      p_recommandation: { explications: proposition.explications, avertissements: proposition.avertissements },
    });
    setEnCours(false);
    if (error) { setErreur(error.message); return; }
    setMessage(proposition.suivant ? `${proposition.suivant.reference} affecté au même camion et au même chauffeur.` : 'Nouveau voyage créé et affecté au même camion et au même chauffeur.');
    onModifie();
    charger();
  };

  return (
    <section className="border-b border-stone-200 px-6 py-4" aria-label="Voyage suivant">
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-stone-700"><Repeat className="h-4 w-4" /> Voyage suivant</h3>
      {erreurLecture ? (
        <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{erreurLecture}</p>
      ) : proposition === null ? <p className="text-sm text-stone-400">Chargement…</p> : !proposition.possible ? (
        <p className="text-sm text-stone-600">Enchaînement impossible : {proposition.raison}</p>
      ) : (
        <>
          <p className="text-sm font-semibold text-stone-900">Recommandé : {proposition.suivant ? `enchaîner ${proposition.suivant.reference}` : 'enchaîner un nouveau voyage sur le même trajet'}</p>
          <ul className="mt-1 space-y-0.5 text-xs text-stone-500">{proposition.explications.map((e) => <li key={e}>{e}</li>)}</ul>
          {proposition.avertissements.map((a) => <p key={a} role="note" className="mt-1 text-xs font-medium text-orange-800">{a}</p>)}
          {!proposition.suivant && (
            <label className="mt-2 block text-sm text-stone-700">Date du nouveau voyage
              <input type="date" aria-label="Date du voyage suivant" value={date} min={voyage.planned_date ?? undefined}
                onChange={(e) => setDate(e.target.value)} className="ml-2 rounded-lg border border-stone-300 px-2 py-1 text-sm" />
            </label>
          )}
          <button onClick={enchainer} disabled={enCours || !date} className="mt-3 rounded-lg bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {enCours ? 'Enregistrement...' : 'Enchaîner le voyage suivant'}
          </button>
        </>
      )}
      {message && <p role="status" className="mt-2 rounded-lg bg-green-50 p-2 text-sm text-green-800">{message}</p>}
      {erreur && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">{erreur}</p>}
    </section>
  );
};
