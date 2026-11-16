import { useCallback, useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Puce } from '../ui/Panneau';
import { GRAVITES, STATUTS_INCIDENT, TYPES_INCIDENT } from '../Hse/hse';
import type { Voyage } from './types';

// Incidents d'un voyage (D-066) : declaration depuis la fiche du voyage,
// pre-remplie (voyage, camion, chauffeur, site de chargement), par
// declarer_incident (D-054) ; le suivi se poursuit dans Incidents HSE.

interface IncidentLu { id: string; numero: string | null; type: string | null; severity: string; incident_time: string; statut: string; description: string }

const CHAMP = 'mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm';
const versLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export const IncidentVoyage = ({
  voyage, peutEcrire, libelles,
}: {
  voyage: Voyage;
  peutEcrire: boolean;
  libelles: { camion: string; chauffeur: string; origine: string };
}) => {
  const [incidents, setIncidents] = useState<IncidentLu[] | null>(null);
  const [saisie, setSaisie] = useState(false);
  const [champs, setChamps] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState('');
  const [erreurLecture, setErreurLecture] = useState('');
  const [message, setMessage] = useState('');
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(async () => {
    const { data, error } = await supabase.from('incidents')
      .select('id, numero, type, severity, incident_time, statut, description').eq('trip_id', voyage.id).order('incident_time');
    setErreurLecture(error ? `Incidents indisponibles : ${error.message}` : '');
    setIncidents(error ? null : (data ?? []) as IncidentLu[]);
  }, [voyage.id]);
  useEffect(() => { charger(); }, [charger]);

  const c = (k: string) => champs[k] ?? '';
  const poser = (k: string, v: string) => setChamps({ ...champs, [k]: v });
  const ouvrir = () => {
    setChamps({ type: 'materiel', gravite: 'minor', quand: versLocal(new Date()) });
    setErreur(''); setMessage(''); setSaisie(true);
  };
  const declarer = async () => {
    setEnCours(true); setErreur('');
    const { error } = await supabase.rpc('declarer_incident', {
      p_type: c('type'), p_gravite: c('gravite'), p_description: c('description').trim(),
      p_survenu_le: new Date(c('quand')).toISOString(),
      p_vehicle: voyage.vehicle_id, p_driver: voyage.driver_id, p_trip: voyage.id, p_site: voyage.departure_site_id,
      p_lieu: c('lieu').trim() || null, p_cout_estime: c('cout').trim() ? Number(c('cout').replace(',', '.')) : null,
    });
    setEnCours(false);
    if (error) { setErreur(error.message); return; }
    setSaisie(false); setMessage('Incident déclaré. Analyse et actions correctives : écran Incidents HSE.');
    charger();
  };

  return (
    <section className="border-b border-stone-200 px-6 py-4" aria-label="Incidents du voyage">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-stone-700"><ShieldAlert className="h-4 w-4" /> Incidents du voyage</h3>
        {peutEcrire && !saisie && <button onClick={ouvrir} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">Déclarer un incident</button>}
      </div>
      {erreurLecture ? <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{erreurLecture}</p>
        : incidents === null ? <p className="text-sm text-stone-400">Chargement…</p> : incidents.length === 0 ? (
        <p className="text-sm text-stone-500">Aucun incident déclaré sur ce voyage.</p>
      ) : (
        <ul className="space-y-1 text-sm">{incidents.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-2">
            <b>{i.numero ?? 'Sans numéro'}</b> {TYPES_INCIDENT[i.type ?? ''] ?? 'Type non renseigné'}
            <Puce teinte={GRAVITES[i.severity]?.teinte ?? 'gris'}>{GRAVITES[i.severity]?.texte ?? i.severity}</Puce>
            <Puce teinte={STATUTS_INCIDENT[i.statut]?.teinte ?? 'gris'}>{STATUTS_INCIDENT[i.statut]?.texte ?? i.statut}</Puce>
            <span className="text-stone-500">{new Date(i.incident_time).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
          </li>))}</ul>
      )}
      {saisie && (
        <div role="form" aria-label="Déclaration d'incident du voyage" className="mt-3 space-y-3 rounded-xl bg-stone-50 p-4">
          <p className="text-xs text-stone-600">Rattaché au voyage {voyage.reference} · camion {libelles.camion} · chauffeur {libelles.chauffeur} · site {libelles.origine}</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">Type *<select value={c('type')} onChange={(e) => poser('type', e.target.value)} className={CHAMP}>{Object.entries(TYPES_INCIDENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="text-sm">Gravité *<select value={c('gravite')} onChange={(e) => poser('gravite', e.target.value)} className={CHAMP}>{Object.entries(GRAVITES).map(([k, v]) => <option key={k} value={k}>{v.texte}</option>)}</select></label>
            <label className="text-sm">Survenu le *<input type="datetime-local" value={c('quand')} onChange={(e) => poser('quand', e.target.value)} className={CHAMP} /></label>
            <label className="text-sm">Lieu<input value={c('lieu')} onChange={(e) => poser('lieu', e.target.value)} className={CHAMP} /></label>
            <label className="col-span-2 text-sm">Coût estimé (GNF)<input inputMode="numeric" value={c('cout')} onChange={(e) => poser('cout', e.target.value)} className={CHAMP} /></label>
            <label className="col-span-2 text-sm">Description *<textarea value={c('description')} onChange={(e) => poser('description', e.target.value)} rows={2} className={CHAMP} /></label>
          </div>
          {erreur && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{erreur}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setSaisie(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">Annuler</button>
            <button onClick={declarer} disabled={enCours || !c('description').trim() || !c('quand')} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Déclarer l'incident</button>
          </div>
        </div>
      )}
      {message && <p role="status" className="mt-2 rounded-lg bg-green-50 p-2 text-sm text-green-800">{message}</p>}
    </section>
  );
};
