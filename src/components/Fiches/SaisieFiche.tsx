import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Puce } from '../ui/Panneau';
import { ETATS, estEtat, phaseDe, PHASES } from '../Trips/cycle';
import { CAUSES, IMPUTATIONS } from '../Maintenance/immobilisations';
import { COLONNES_ROTATION, TYPES_FICHE, etapesRotation, horodater, ligneVide, type Fiche, type LigneRotation } from './fiches';

// Saisie d'une fiche retournee (D-028) : l'ecran reprend la fiche papier.
// Chaque ligne part a une fonction serveur qui l'applique en une
// transaction et rattache chaque donnee au numero de la fiche.

const CHAMP = 'w-full rounded border border-stone-300 px-1.5 py-1 text-xs focus:border-orange-500 focus:outline-none';
const HEURE = `${CHAMP} w-[5.5rem]`;

export interface Reference { id: string; libelle: string }

const Message = ({ texte }: { texte: { ok: boolean; texte: string } | undefined }) =>
  texte ? <p className={`mt-1 text-xs ${texte.ok ? 'text-green-700' : 'text-red-700'}`}>{texte.texte}</p> : null;

const SaisieRotations = ({ fiche, debutShift }: { fiche: Fiche; debutShift: string | null }) => {
  const [voyages, setVoyages] = useState<{ id: string; reference: string; etat: string | null }[]>([]);
  const [lignes, setLignes] = useState<Record<string, LigneRotation>>({});
  const [messages, setMessages] = useState<Record<string, { ok: boolean; texte: string }>>({});
  const [enCours, setEnCours] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const { data } = await supabase.from('trips').select('id, reference, etat')
      .eq('vehicle_id', fiche.vehicle_id ?? '').eq('planned_date', fiche.date_fiche).order('reference');
    setVoyages((data ?? []) as { id: string; reference: string; etat: string | null }[]);
  }, [fiche.vehicle_id, fiche.date_fiche]);
  useEffect(() => { charger(); }, [charger]);

  const ligne = (id: string) => lignes[id] ?? ligneVide();
  const maj = (id: string, l: LigneRotation) => setLignes({ ...lignes, [id]: l });

  const enregistrer = async (id: string) => {
    const { etapes, erreur } = etapesRotation(ligne(id), fiche.date_fiche, fiche.options.pesee ?? 'arrivee', debutShift);
    if (erreur) { setMessages({ ...messages, [id]: { ok: false, texte: erreur } }); return; }
    setEnCours(id);
    const { data, error } = await supabase.rpc('saisir_rotation', { p_fiche_id: fiche.id, p_trip_id: id, p_etapes: etapes });
    setEnCours(null);
    setMessages({ ...messages, [id]: error ? { ok: false, texte: error.message } : { ok: true, texte: `Enregistré : ${estEtat(data) ? ETATS[data].libelle : data}` } });
    charger();
  };

  if (voyages.length === 0) return <p className="text-sm text-stone-500">Aucun voyage de ce camion à cette date. Préparez les voyages dans le Dispatch.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr className="text-left text-stone-500">
          <th className="py-1 pr-2">Voyage</th>
          {COLONNES_ROTATION.map((c) => <th key={c.cle} className="py-1 pr-1 font-medium">{c.libelle}</th>)}
          <th className="py-1 pr-1 font-medium">Pesée ({fiche.options.pesee === 'depart' ? 'départ' : 'arrivée'})</th>
          <th className="py-1 pr-1 font-medium">Ticket</th><th className="py-1 pr-1 font-medium">Brut</th><th className="py-1 pr-1 font-medium">Tare</th><th />
        </tr></thead>
        <tbody>
          {voyages.map((v) => {
            const l = ligne(v.id);
            return (
              <tr key={v.id} className="border-t border-stone-100 align-top">
                <td className="py-1.5 pr-2">
                  <p className="font-semibold text-stone-900">{v.reference}</p>
                  <Puce teinte={PHASES[phaseDe(v.etat)].teinte}>{estEtat(v.etat) ? ETATS[v.etat].libelle : v.etat}</Puce>
                  <Message texte={messages[v.id]} />
                </td>
                {COLONNES_ROTATION.map((c) => (
                  <td key={c.cle} className="py-1.5 pr-1">
                    <input type="time" aria-label={`${v.reference} ${c.libelle}`} value={l.heures[c.cle] ?? ''} onChange={(e) => maj(v.id, { ...l, heures: { ...l.heures, [c.cle]: e.target.value } })} className={HEURE} />
                  </td>
                ))}
                <td className="py-1.5 pr-1"><input type="time" aria-label={`${v.reference} heure de pesée`} value={l.heurePesee} onChange={(e) => maj(v.id, { ...l, heurePesee: e.target.value })} className={HEURE} /></td>
                <td className="py-1.5 pr-1"><input aria-label={`${v.reference} ticket`} value={l.ticket} onChange={(e) => maj(v.id, { ...l, ticket: e.target.value })} className={`${CHAMP} w-20`} /></td>
                <td className="py-1.5 pr-1"><input inputMode="decimal" aria-label={`${v.reference} brut`} value={l.brut} onChange={(e) => maj(v.id, { ...l, brut: e.target.value })} className={`${CHAMP} w-16`} /></td>
                <td className="py-1.5 pr-1"><input inputMode="decimal" aria-label={`${v.reference} tare`} value={l.tare} onChange={(e) => maj(v.id, { ...l, tare: e.target.value })} className={`${CHAMP} w-16`} /></td>
                <td className="py-1.5">
                  <button onClick={() => enregistrer(v.id)} disabled={enCours === v.id} className="rounded bg-orange-600 px-2 py-1 text-xs font-bold text-white disabled:opacity-50" aria-label={`Enregistrer ${v.reference}`}>
                    {enCours === v.id ? '...' : 'Enregistrer'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-stone-500">Les étapes déjà enregistrées sont ignorées : une ligne peut être complétée plus tard. Les heures doivent se suivre.</p>
    </div>
  );
};

interface Arret { debut: string; fin: string; cause: string; imputation: string; description: string }
interface LignePointage { operateur: string; debut: string; fin: string; observations: string; arrets: Arret[] }
const arretVide = (): Arret => ({ debut: '', fin: '', cause: '', imputation: '', description: '' });

const SaisiePointage = ({ fiche, engins, debutShift }: { fiche: Fiche; engins: Reference[]; debutShift: string | null }) => {
  const [lignes, setLignes] = useState<Record<string, LignePointage>>({});
  const [saisis, setSaisis] = useState<Record<string, number>>({});
  const [messages, setMessages] = useState<Record<string, { ok: boolean; texte: string }>>({});

  const charger = useCallback(async () => {
    const { data } = await supabase.from('pointages_engins').select('vehicle_id, heures_marche').eq('fiche_id', fiche.id);
    setSaisis(Object.fromEntries((data ?? []).map((p: { vehicle_id: string; heures_marche: number }) => [p.vehicle_id, Number(p.heures_marche)])));
  }, [fiche.id]);
  useEffect(() => { charger(); }, [charger]);

  const ligne = (id: string): LignePointage => lignes[id] ?? { operateur: '', debut: '', fin: '', observations: '', arrets: [] };
  const maj = (id: string, l: LignePointage) => setLignes({ ...lignes, [id]: l });
  const nombre = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

  const enregistrer = async (id: string) => {
    const l = ligne(id);
    const incomplet = l.arrets.find((a) => !a.debut || !a.cause || !a.imputation);
    if (incomplet) { setMessages({ ...messages, [id]: { ok: false, texte: 'Arrêt incomplet : heure de début, cause et imputation requises' } }); return; }
    const { error } = await supabase.rpc('saisir_pointage', {
      p_fiche_id: fiche.id, p_vehicle_id: id, p_index_debut: nombre(l.debut), p_index_fin: nombre(l.fin),
      p_operateur: l.operateur || null, p_observations: l.observations || null,
      p_arrets: l.arrets.map((a) => ({
        debut: horodater(fiche.date_fiche, a.debut, debutShift).toISOString(),
        fin: a.fin ? horodater(fiche.date_fiche, a.fin, debutShift).toISOString() : null,
        cause: a.cause, imputation: a.imputation, description: a.description,
      })),
    });
    setMessages({ ...messages, [id]: error ? { ok: false, texte: error.message } : { ok: true, texte: 'Pointage enregistré' } });
    charger();
  };

  return (
    <div className="space-y-3">
      {engins.map((e) => {
        const l = ligne(e.id);
        const fait = e.id in saisis;
        return (
          <section key={e.id} className={`rounded-lg border p-3 ${fait ? 'border-green-300 bg-green-50/40' : 'border-stone-200'}`} aria-label={`Pointage ${e.libelle}`}>
            <div className="flex flex-wrap items-end gap-2 text-xs">
              <p className="w-28 font-bold text-stone-900">{e.libelle}</p>
              {fait ? (
                <p className="flex items-center gap-1 text-green-700"><CheckCircle2 className="h-4 w-4" /> Saisi : {saisis[e.id].toLocaleString('fr-FR')} h de marche</p>
              ) : (
                <>
                  <label>Opérateur<input value={l.operateur} onChange={(ev) => maj(e.id, { ...l, operateur: ev.target.value })} className={`${CHAMP} w-36`} /></label>
                  <label>Horamètre début<input inputMode="decimal" value={l.debut} onChange={(ev) => maj(e.id, { ...l, debut: ev.target.value })} className={`${CHAMP} w-24`} /></label>
                  <label>Horamètre fin<input inputMode="decimal" value={l.fin} onChange={(ev) => maj(e.id, { ...l, fin: ev.target.value })} className={`${CHAMP} w-24`} /></label>
                  <label className="flex-1">Observations<input value={l.observations} onChange={(ev) => maj(e.id, { ...l, observations: ev.target.value })} className={CHAMP} /></label>
                  <button onClick={() => maj(e.id, { ...l, arrets: [...l.arrets, arretVide()] })} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1"><Plus className="h-3 w-3" /> Arrêt</button>
                  <button onClick={() => enregistrer(e.id)} className="rounded bg-orange-600 px-2 py-1 font-bold text-white" aria-label={`Enregistrer le pointage de ${e.libelle}`}>Enregistrer</button>
                </>
              )}
            </div>
            {!fait && l.arrets.map((a, i) => (
              <div key={i} className="mt-2 flex flex-wrap items-end gap-2 pl-28 text-xs">
                <label>Début<input type="time" value={a.debut} onChange={(ev) => maj(e.id, { ...l, arrets: l.arrets.map((x, j) => (j === i ? { ...x, debut: ev.target.value } : x)) })} className={HEURE} /></label>
                <label>Fin<input type="time" value={a.fin} onChange={(ev) => maj(e.id, { ...l, arrets: l.arrets.map((x, j) => (j === i ? { ...x, fin: ev.target.value } : x)) })} className={HEURE} /></label>
                <label>Cause<select value={a.cause} onChange={(ev) => maj(e.id, { ...l, arrets: l.arrets.map((x, j) => (j === i ? { ...x, cause: ev.target.value } : x)) })} className={CHAMP}>
                  <option value="">Choisir</option>{Object.entries(CAUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></label>
                <label>Imputation<select value={a.imputation} onChange={(ev) => maj(e.id, { ...l, arrets: l.arrets.map((x, j) => (j === i ? { ...x, imputation: ev.target.value } : x)) })} className={CHAMP}>
                  <option value="">Choisir</option>{Object.entries(IMPUTATIONS).map(([k, v]) => <option key={k} value={k}>{v.libelle}</option>)}
                </select></label>
                <label className="flex-1">Description<input value={a.description} onChange={(ev) => maj(e.id, { ...l, arrets: l.arrets.map((x, j) => (j === i ? { ...x, description: ev.target.value } : x)) })} className={CHAMP} /></label>
                <button onClick={() => maj(e.id, { ...l, arrets: l.arrets.filter((_, j) => j !== i) })} className="rounded p-1 text-stone-400 hover:text-red-600" aria-label="Retirer l'arrêt"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            <Message texte={messages[e.id]} />
          </section>
        );
      })}
      <p className="text-xs text-stone-500">Chaque arrêt devient une immobilisation de l'engin (rappel D-022 : maintenance à la charge du loueur, pneus et carburant à la charge de l'exploitant).</p>
    </div>
  );
};

interface LignePlein { vehicule: string; chauffeur: string; litres: string; compteur: string }

const SaisieCarburant = ({ fiche, engins, chauffeurs, onFait }: { fiche: Fiche; engins: Reference[]; chauffeurs: Reference[]; onFait: () => void }) => {
  const [prix, setPrix] = useState('');
  const [fournisseur, setFournisseur] = useState('');
  const [lignes, setLignes] = useState<LignePlein[]>([{ vehicule: '', chauffeur: '', litres: '', compteur: '' }]);
  const [message, setMessage] = useState<{ ok: boolean; texte: string }>();
  const nombre = (v: string) => (v.trim() === '' ? null : Number(v.replace(/\s/g, '').replace(',', '.')));
  const maj = (i: number, l: LignePlein) => setLignes(lignes.map((x, j) => (j === i ? l : x)));

  const enregistrer = async () => {
    const remplies = lignes.filter((l) => l.vehicule || l.litres);
    if (remplies.some((l) => !l.vehicule || !(Number(nombre(l.litres)) > 0))) { setMessage({ ok: false, texte: 'Chaque ligne demande un engin et une quantité positive' }); return; }
    const { data, error } = await supabase.rpc('saisir_carburant', {
      p_fiche_id: fiche.id, p_prix_litre: nombre(prix), p_fournisseur: fournisseur || null,
      p_lignes: remplies.map((l) => ({ vehicle_id: l.vehicule, driver_id: l.chauffeur || null, litres: nombre(l.litres), compteur: nombre(l.compteur) })),
    });
    if (error) setMessage({ ok: false, texte: error.message });
    else { setMessage({ ok: true, texte: `${data} plein(s) enregistré(s)` }); onFait(); }
  };

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap gap-3">
        <label>Prix du litre * (facture ou prix de la cuve)<input inputMode="decimal" value={prix} onChange={(e) => setPrix(e.target.value)} className={`${CHAMP} w-36`} /></label>
        <label>Fournisseur ou cuve<input value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} className={`${CHAMP} w-48`} /></label>
      </div>
      {lignes.map((l, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2">
          <label>Engin<select aria-label={`Ligne ${i + 1} engin`} value={l.vehicule} onChange={(e) => maj(i, { ...l, vehicule: e.target.value })} className={`${CHAMP} w-36`}>
            <option value="">Choisir</option>{engins.map((e) => <option key={e.id} value={e.id}>{e.libelle}</option>)}
          </select></label>
          <label>Chauffeur<select value={l.chauffeur} onChange={(e) => maj(i, { ...l, chauffeur: e.target.value })} className={`${CHAMP} w-44`}>
            <option value="">—</option>{chauffeurs.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
          </select></label>
          <label>Litres<input aria-label={`Ligne ${i + 1} litres`} inputMode="decimal" value={l.litres} onChange={(e) => maj(i, { ...l, litres: e.target.value })} className={`${CHAMP} w-20`} /></label>
          <label>Compteur km ou horamètre<input inputMode="decimal" value={l.compteur} onChange={(e) => maj(i, { ...l, compteur: e.target.value })} className={`${CHAMP} w-28`} /></label>
          <button onClick={() => setLignes(lignes.filter((_, j) => j !== i))} className="rounded p-1 text-stone-400 hover:text-red-600" aria-label={`Retirer la ligne ${i + 1}`}><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <div className="flex gap-2">
        <button onClick={() => setLignes([...lignes, { vehicule: '', chauffeur: '', litres: '', compteur: '' }])} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1"><Plus className="h-3 w-3" /> Ligne</button>
        <button onClick={enregistrer} className="rounded bg-orange-600 px-3 py-1 font-bold text-white">Enregistrer les pleins</button>
      </div>
      <Message texte={message} />
    </div>
  );
};

export const SaisieFiche = ({ fiche, debutShift, engins, chauffeurs, titre, onFermer, onFait }: {
  fiche: Fiche;
  debutShift: string | null;
  engins: Reference[];
  chauffeurs: Reference[];
  titre: string;
  onFermer: () => void;
  onFait: () => void;
}) => {
  const [erreur, setErreur] = useState('');
  const terminer = async () => {
    const { error } = await supabase.rpc('terminer_saisie_fiche', { p_id: fiche.id, p_note: null });
    if (error) setErreur(error.message);
    else onFait();
  };
  return (
    <div className="fixed inset-0 z-[900] flex items-start justify-center overflow-y-auto bg-black/30 p-4" onClick={onFermer}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-7xl rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label={`Saisie ${fiche.numero}`}>
        <header className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-black text-stone-900">Saisie · {fiche.numero}</h2>
            <p className="text-sm text-stone-500">{TYPES_FICHE[fiche.type].libelle} · {titre}</p>
          </div>
          <button onClick={onFermer} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" aria-label="Fermer"><X className="h-5 w-5" /></button>
        </header>
        <div className="px-6 py-5">
          {fiche.type === 'rotations' && <SaisieRotations fiche={fiche} debutShift={debutShift} />}
          {fiche.type === 'pointage_engins' && <SaisiePointage fiche={fiche} engins={engins} debutShift={debutShift} />}
          {fiche.type === 'carburant' && <SaisieCarburant fiche={fiche} engins={engins} chauffeurs={chauffeurs} onFait={() => undefined} />}
          {erreur && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{erreur}</p>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-stone-200 px-6 py-4">
          <button onClick={onFermer} className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">Fermer</button>
          <button onClick={terminer} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white">Terminer la saisie de la fiche</button>
        </footer>
      </div>
    </div>
  );
};
