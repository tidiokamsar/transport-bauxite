import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Clock, Scale, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Puce } from '../ui/Panneau';
import { formatNombre } from '../Dashboard/indicateurs';
import { AVEC_MOTIF, AVEC_PESEE, ETATS, PHASES, actionsPossibles, estEtat, phaseDe, tonnageVoyage, type Etat } from './cycle';
import type { Voyage } from './types';

// Fiche d'un voyage : chronologie des evenements (CDC 12, CDC 31) et
// transitions possibles. L'heure saisie est l'heure reelle de l'evenement,
// pas celle de la saisie ; le serveur controle l'ordre et la coherence.

interface Evenement {
  id: string;
  etat_avant: string | null;
  etat_apres: string;
  survenu_le: string;
  enregistre_le: string;
  origine: string;
  note: string | null;
  donnees: { brut?: number; tare?: number; net?: number; accepte?: number };
}

const versLocal = (d: Date) => {
  const decale = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return decale.toISOString().slice(0, 16);
};

const heure = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export const FicheVoyage = ({
  voyage,
  libelles,
  peutEcrire,
  onFermer,
  onModifie,
}: {
  voyage: Voyage;
  libelles: { camion: string; chauffeur: string; chargeuse: string; origine: string; destination: string; shift: string };
  peutEcrire: boolean;
  onFermer: () => void;
  onModifie: () => void;
}) => {
  const [evenements, setEvenements] = useState<Evenement[] | null>(null);
  const [action, setAction] = useState<Etat | null>(null);
  const [quand, setQuand] = useState(() => versLocal(new Date()));
  const [brut, setBrut] = useState('');
  const [tare, setTare] = useState('');
  const [accepte, setAccepte] = useState('');
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(async () => {
    const { data, error } = await supabase
      .from('trip_events')
      .select('id, etat_avant, etat_apres, survenu_le, enregistre_le, origine, note, donnees')
      .eq('trip_id', voyage.id)
      .order('survenu_le', { ascending: true });
    setEvenements(error ? [] : (data as Evenement[]));
  }, [voyage.id]);

  useEffect(() => {
    charger();
  }, [charger]);

  const etat = estEtat(voyage.etat) ? voyage.etat : 'PLANNED';
  const { normales, exceptions } = actionsPossibles(etat);
  const tonnage = tonnageVoyage(voyage);
  const phase = PHASES[phaseDe(etat)];

  const choisir = (e: Etat) => {
    setAction(e);
    setQuand(versLocal(new Date()));
    setBrut('');
    setTare('');
    setAccepte('');
    setMotif('');
    setErreur('');
  };

  const valider = async () => {
    if (!action) return;
    setEnCours(true);
    setErreur('');
    const donnees: Record<string, number> = {};
    if (AVEC_PESEE.includes(action)) {
      donnees.brut = Number(brut.replace(',', '.'));
      donnees.tare = Number(tare.replace(',', '.'));
    }
    if (action === 'ACCEPTED' && accepte.trim()) donnees.accepte = Number(accepte.replace(',', '.'));
    const { error } = await supabase.rpc('avancer_voyage', {
      p_trip_id: voyage.id,
      p_etat: action,
      p_survenu_le: new Date(quand).toISOString(),
      p_note: motif || null,
      p_donnees: donnees,
    });
    setEnCours(false);
    if (error) {
      setErreur(error.message);
      return;
    }
    setAction(null);
    await charger();
    onModifie();
  };

  const champ = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20';

  return (
    <div className="fixed inset-0 z-[900] flex justify-end bg-black/30" onClick={onFermer}>
      <aside
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-fiche-voyage"
      >
        <header className="flex items-start justify-between gap-4 border-b border-stone-200 px-6 py-5">
          <div>
            <h2 id="titre-fiche-voyage" className="text-xl font-black text-stone-900">{voyage.reference}</h2>
            <p className="mt-1 text-sm text-stone-500">
              {libelles.origine} → {libelles.destination} · {new Date(voyage.planned_date).toLocaleDateString('fr-FR')}
              {libelles.shift !== '—' ? ` · shift ${libelles.shift}` : ''}
            </p>
            <div className="mt-2"><Puce teinte={phase.teinte}>{ETATS[etat].libelle}</Puce></div>
          </div>
          <button onClick={onFermer} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </header>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-b border-stone-200 px-6 py-4 text-sm">
          <div><dt className="text-stone-500">Camion</dt><dd className="font-semibold text-stone-900">{libelles.camion}</dd></div>
          <div><dt className="text-stone-500">Chauffeur</dt><dd className="font-semibold text-stone-900">{libelles.chauffeur}</dd></div>
          <div><dt className="text-stone-500">Chargeuse</dt><dd className="font-semibold text-stone-900">{libelles.chargeuse}</dd></div>
          <div>
            <dt className="text-stone-500">Tonnage</dt>
            <dd className="font-semibold text-stone-900">
              {tonnage ? `${formatNombre(tonnage.valeur, 1)} t (${tonnage.nature})` : 'Non pesé'}
            </dd>
          </div>
        </dl>

        {peutEcrire && (normales.length > 0 || exceptions.length > 0) && (
          <section className="border-b border-stone-200 px-6 py-4">
            <h3 className="mb-3 text-sm font-semibold text-stone-700">Étape suivante</h3>
            <div className="flex flex-wrap gap-2">
              {normales.map((e) => (
                <button
                  key={e}
                  onClick={() => choisir(e)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${action === e ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-800 hover:bg-orange-100'}`}
                >
                  <ArrowRight className="h-4 w-4" /> {ETATS[e].action}
                </button>
              ))}
              {exceptions.map((e) => (
                <button
                  key={e}
                  onClick={() => choisir(e)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${action === e ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
                >
                  <AlertTriangle className="h-4 w-4" /> {ETATS[e].action}
                </button>
              ))}
            </div>

            {action && (
              <div className="mt-4 space-y-3 rounded-xl bg-stone-50 p-4">
                <label className="block text-sm">
                  <span className="mb-1 flex items-center gap-1.5 font-medium text-stone-700">
                    <Clock className="h-4 w-4" /> Heure réelle de l'événement
                  </span>
                  <input type="datetime-local" value={quand} onChange={(e) => setQuand(e.target.value)} className={champ} />
                </label>
                {AVEC_PESEE.includes(action) && (
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-sm">
                      <span className="mb-1 flex items-center gap-1.5 font-medium text-stone-700"><Scale className="h-4 w-4" /> Poids brut (t)</span>
                      <input inputMode="decimal" value={brut} onChange={(e) => setBrut(e.target.value)} className={champ} required />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-stone-700">Tare (t)</span>
                      <input inputMode="decimal" value={tare} onChange={(e) => setTare(e.target.value)} className={champ} required />
                    </label>
                  </div>
                )}
                {action === 'ACCEPTED' && (
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-stone-700">Tonnage accepté (t)</span>
                    <input
                      inputMode="decimal"
                      value={accepte}
                      onChange={(e) => setAccepte(e.target.value)}
                      className={champ}
                      placeholder={tonnage ? `Vide = ${formatNombre(tonnage.valeur, 1)} t (${tonnage.nature})` : 'Requis : aucune pesée'}
                    />
                  </label>
                )}
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-stone-700">
                    {AVEC_MOTIF.includes(action) ? 'Motif (obligatoire)' : 'Note (facultative)'}
                  </span>
                  <textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={2} className={champ} />
                </label>
                {erreur && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{erreur}</p>}
                <div className="flex justify-end gap-2">
                  <button onClick={() => setAction(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">Annuler</button>
                  <button
                    onClick={valider}
                    disabled={enCours}
                    className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {enCours ? 'Enregistrement...' : `Enregistrer : ${ETATS[action].libelle}`}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        <section className="px-6 py-4">
          <h3 className="mb-3 text-sm font-semibold text-stone-700">Chronologie</h3>
          {evenements === null ? (
            <p className="text-sm text-stone-400">Chargement...</p>
          ) : evenements.length === 0 ? (
            <p className="text-sm text-stone-500">Aucun événement enregistré pour ce voyage (voyage antérieur au journal).</p>
          ) : (
            <ol className="relative space-y-4 border-l-2 border-orange-100 pl-5">
              {evenements.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-orange-500" />
                  <p className="text-sm font-semibold text-stone-900">
                    {estEtat(e.etat_apres) ? ETATS[e.etat_apres].libelle : e.etat_apres}
                    <span className="ml-2 font-normal text-stone-500">{heure(e.survenu_le)}</span>
                  </p>
                  {e.donnees?.net !== undefined && (
                    <p className="text-sm text-stone-600">
                      Brut {formatNombre(e.donnees.brut ?? 0, 1)} t · tare {formatNombre(e.donnees.tare ?? 0, 1)} t · net {formatNombre(e.donnees.net, 1)} t
                    </p>
                  )}
                  {e.donnees?.accepte !== undefined && <p className="text-sm text-stone-600">Accepté : {formatNombre(e.donnees.accepte, 1)} t</p>}
                  {e.note && <p className="text-sm text-stone-600">{e.note}</p>}
                  <p className="text-xs text-stone-400">
                    {e.origine === 'declare' ? 'Déclaré' : e.origine === 'detecte' ? 'Détecté' : 'Validé'} · saisi {heure(e.enregistre_le)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </aside>
    </div>
  );
};
