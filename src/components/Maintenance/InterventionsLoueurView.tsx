import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Plus, RefreshCw, Send, Trash2, Wrench, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import { CANAUX, LIBELLE_STATUT_INTERVENTION, piecesValides, type Piece } from './interventions';

// Interventions du loueur sur les engins immobilises (D-049) : demande,
// prise en charge, fin avec rapport et pieces, remise en service validee
// par une autre personne (elle cloture l'immobilisation).

interface Immobilisation { id: string; vehicle_id: string; debut: string; cause: string; imputation: string; description: string; statut: string }
interface Intervention {
  id: string; numero: string; immobilisation_id: string; vehicle_id: string; statut: keyof typeof LIBELLE_STATUT_INTERVENTION;
  demande_le: string; canal: string; reference_demande: string | null; description: string; delai_contractuel_heures: number | null;
  technicien: string | null; prise_en_charge_le: string | null; fin_le: string | null; rapport: string | null;
  delai_heures: number | null; en_retard: boolean | null; duree_intervention_heures: number | null;
}

const CHAMP = 'mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm';
const versLocal = (d: Date) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
const PIECE_VIDE: Piece = { designation: '', reference: '', quantite: '1', fournie_par: 'loueur' };

export const InterventionsLoueurView = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('maintenance', 'create') || hasPermission('maintenance', 'edit');
  const [immobs, setImmobs] = useState<Immobilisation[]>([]);
  const [interventions, setInterventions] = useState<Intervention[] | null>(null);
  const [engins, setEngins] = useState<Map<string, string>>(new Map());
  const [ouvert, setOuvert] = useState<{ type: 'demande' | 'fin'; id: string } | null>(null);
  const [champs, setChamps] = useState<Record<string, string>>({});
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const [m, i, v] = await Promise.all([
      supabase.from('immobilisations').select('id, vehicle_id, debut, cause, imputation, description, statut').eq('statut', 'ouverte').in('imputation', ['loueur', 'a_determiner']).order('debut'),
      supabase.from('v_interventions_loueur').select('*').order('demande_le', { ascending: false }).limit(200),
      supabase.from('vehicles').select('id, registration'),
    ]);
    setErreur(m.error?.message ?? i.error?.message ?? '');
    setImmobs((m.data ?? []) as Immobilisation[]);
    setInterventions((i.data ?? []) as Intervention[]);
    setEngins(new Map((v.data ?? []).map((x) => [x.id as string, x.registration as string])));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const enCours = useMemo(() => new Set((interventions ?? []).filter((x) => x.statut !== 'remise_validee').map((x) => x.immobilisation_id)), [interventions]);
  const aDemander = immobs.filter((m) => !enCours.has(m.id));
  const c = (k: string) => champs[k] ?? '';
  const poser = (k: string, v: string) => setChamps({ ...champs, [k]: v });
  const executer = async (action: () => PromiseLike<{ error: { message: string } | null }>, succes: string) => {
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await action();
    setBusy(false);
    if (error) { setErreur(error.message); return false; }
    setMessage(succes); setOuvert(null); await charger(); return true;
  };

  const demander = (immobId: string) => executer(() => supabase.rpc('demander_intervention_loueur', {
    p_immobilisation_id: immobId, p_quand: new Date(c('quand')).toISOString(), p_canal: c('canal') || 'courriel', p_description: c('description').trim(),
    p_reference: c('reference').trim() || null, p_delai_contractuel_heures: c('delai') ? Number(c('delai').replace(',', '.')) : null,
  }), 'Demande d\'intervention enregistrée.');
  const prendreEnCharge = (i: Intervention) => {
    const technicien = window.prompt('Technicien du loueur arrivé sur l\'engin');
    if (!technicien?.trim()) return;
    executer(() => supabase.rpc('prendre_en_charge_intervention', { p_id: i.id, p_quand: new Date().toISOString(), p_technicien: technicien }), 'Prise en charge enregistrée.');
  };
  const terminer = (i: Intervention) => executer(() => supabase.rpc('terminer_intervention', {
    p_id: i.id, p_quand: new Date(c('fin')).toISOString(), p_rapport: c('rapport').trim(),
    p_pieces: pieces.filter((p) => p.designation.trim()).map((p) => ({ designation: p.designation.trim(), reference: p.reference.trim(), quantite: Number(p.quantite.replace(',', '.')), fournie_par: p.fournie_par })),
  }), 'Fin d\'intervention enregistrée : remise en service à valider par une autre personne.');
  const decider = (i: Intervention, valider: boolean) => {
    const motif = valider ? null : window.prompt('Motif du refus de remise en service');
    if (!valider && !motif?.trim()) return;
    executer(() => supabase.rpc('valider_remise_en_service', { p_id: i.id, p_valider: valider, p_motif: motif }),
      valider ? 'Remise en service validée : immobilisation close, engin disponible.' : 'Remise en service refusée : l\'intervention reprend.');
  };
  const majPiece = (n: number, p: Piece) => setPieces(pieces.map((x, j) => (j === n ? p : x)));

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Interventions du loueur</h2>
        <p className="text-sm text-stone-500">Engins loués immobilisés : demande à Neemba, prise en charge, rapport, remise en service validée.</p></div>
      <button onClick={charger} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
    </header>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}

    <Panneau titre={`Immobilisations sans intervention demandée (${aDemander.length})`}>
      {aDemander.length === 0 ? <SansDonnees message="Aucune immobilisation en attente de demande" /> :
        <ul className="divide-y divide-stone-100 text-sm">{aDemander.map((m) => <li key={m.id} className="py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span><b>{engins.get(m.vehicle_id) ?? '?'}</b> · depuis le {new Date(m.debut).toLocaleString('fr-FR')} · {m.description} {m.imputation === 'a_determiner' && <Puce teinte="orange">Imputation à déterminer</Puce>}</span>
            {peutEcrire && <button onClick={() => { setOuvert({ type: 'demande', id: m.id }); setChamps({ quand: versLocal(new Date()), canal: 'courriel', description: m.description }); }}
              aria-label={`Demander l'intervention ${engins.get(m.vehicle_id) ?? ''}`} className="flex items-center gap-1 rounded bg-orange-700 px-2 py-1 text-xs font-bold text-white"><Send className="h-3 w-3" /> Demander l'intervention</button>}
          </div>
          {ouvert?.type === 'demande' && ouvert.id === m.id && <div role="form" aria-label="Demande d'intervention" className="mt-2 grid gap-2 rounded border border-stone-200 p-3 sm:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm">Date et heure de la demande *<input type="datetime-local" value={c('quand')} onChange={(e) => poser('quand', e.target.value)} className={CHAMP} /></label>
            <label className="text-sm">Canal *<select value={c('canal')} onChange={(e) => poser('canal', e.target.value)} className={CHAMP}>{Object.entries(CANAUX).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="text-sm">Référence (courrier, ticket)<input value={c('reference')} onChange={(e) => poser('reference', e.target.value)} className={CHAMP} /></label>
            <label className="text-sm sm:col-span-2">Description *<input value={c('description')} onChange={(e) => poser('description', e.target.value)} className={CHAMP} /></label>
            <label className="text-sm">Délai contractuel d'intervention (h)<input inputMode="decimal" value={c('delai')} onChange={(e) => poser('delai', e.target.value)} placeholder="selon le contrat" className={CHAMP} /></label>
            <div className="flex gap-2 sm:col-span-2 xl:col-span-3">
              <button disabled={busy || !c('description').trim() || !c('quand')} onClick={() => demander(m.id)} className="rounded-lg bg-orange-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer la demande</button>
              <button onClick={() => setOuvert(null)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm">Annuler</button>
            </div>
          </div>}
        </li>)}</ul>}
    </Panneau>

    <Panneau titre="Interventions">
      {interventions === null ? <p>Chargement…</p> : interventions.length === 0 ? <SansDonnees message="Aucune intervention" /> :
        <ul className="divide-y divide-stone-100 text-sm">{interventions.map((i) => <li key={i.id} className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span><span className="font-mono font-semibold">{i.numero}</span> · <b>{engins.get(i.vehicle_id) ?? '?'}</b> · {i.description} · <Puce teinte={i.statut === 'remise_validee' ? 'vert' : i.statut === 'terminee' ? 'orange' : 'bleu'}>{LIBELLE_STATUT_INTERVENTION[i.statut]}</Puce>{' '}
              {i.en_retard === true && <Puce teinte="rouge">Délai contractuel dépassé</Puce>}</span>
            {peutEcrire && <span className="flex gap-1">
              {i.statut === 'demandee' && <button disabled={busy} onClick={() => prendreEnCharge(i)} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs"><Wrench className="h-3 w-3" /> Prise en charge</button>}
              {i.statut === 'prise_en_charge' && <button disabled={busy} onClick={() => { setOuvert({ type: 'fin', id: i.id }); setChamps({ fin: versLocal(new Date()) }); setPieces([]); }} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs">Fin d'intervention</button>}
              {i.statut === 'terminee' && <>
                <button disabled={busy} onClick={() => decider(i, true)} aria-label={`Valider la remise en service ${i.numero}`} className="flex items-center gap-1 rounded bg-green-700 px-2 py-1 text-xs font-bold text-white"><CheckCircle2 className="h-3 w-3" /> Valider la remise en service</button>
                <button disabled={busy} onClick={() => decider(i, false)} aria-label={`Refuser la remise en service ${i.numero}`} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs"><XCircle className="h-3 w-3" /> Refuser</button></>}
            </span>}
          </div>
          <p className="mt-1 text-xs text-stone-500">Demandée le {new Date(i.demande_le).toLocaleString('fr-FR')} ({CANAUX[i.canal as keyof typeof CANAUX] ?? i.canal}{i.reference_demande ? `, ${i.reference_demande}` : ''})
            {' · '}délai de prise en charge {i.delai_heures !== null ? `${i.delai_heures} h${i.prise_en_charge_le ? '' : ' (en cours)'}` : '—'}
            {i.delai_contractuel_heures !== null ? ` / contrat ${i.delai_contractuel_heures} h` : ' / délai contractuel non renseigné'}
            {i.technicien && ` · ${i.technicien}`}{i.duree_intervention_heures !== null && ` · durée ${i.duree_intervention_heures} h`}</p>
          {i.rapport && <p className="mt-1 text-xs text-stone-700">Rapport : {i.rapport}</p>}
          {ouvert?.type === 'fin' && ouvert.id === i.id && <div role="form" aria-label="Fin d'intervention" className="mt-2 space-y-2 rounded border border-stone-200 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-sm">Fin de l'intervention *<input type="datetime-local" value={c('fin')} onChange={(e) => poser('fin', e.target.value)} className={CHAMP} /></label>
              <label className="text-sm">Rapport d'intervention *<input value={c('rapport')} onChange={(e) => poser('rapport', e.target.value)} className={CHAMP} /></label>
            </div>
            {pieces.map((p, n) => <div key={n} className="flex flex-wrap items-end gap-2">
              <label className="text-xs">Pièce<input aria-label={`Pièce ${n + 1}`} value={p.designation} onChange={(e) => majPiece(n, { ...p, designation: e.target.value })} className={`${CHAMP} w-48`} /></label>
              <label className="text-xs">Référence<input value={p.reference} onChange={(e) => majPiece(n, { ...p, reference: e.target.value })} className={`${CHAMP} w-32`} /></label>
              <label className="text-xs">Quantité<input inputMode="decimal" value={p.quantite} onChange={(e) => majPiece(n, { ...p, quantite: e.target.value })} className={`${CHAMP} w-20`} /></label>
              <label className="text-xs">Fournie par<select value={p.fournie_par} onChange={(e) => majPiece(n, { ...p, fournie_par: e.target.value as Piece['fournie_par'] })} className={`${CHAMP} w-32`}><option value="loueur">Loueur</option><option value="exploitant">Exploitant</option></select></label>
              <button onClick={() => setPieces(pieces.filter((_, j) => j !== n))} aria-label={`Retirer la pièce ${n + 1}`} className="rounded p-1 text-stone-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>)}
            <div className="flex gap-2">
              <button onClick={() => setPieces([...pieces, { ...PIECE_VIDE }])} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs"><Plus className="h-3 w-3" /> Pièce remplacée</button>
              <button disabled={busy || !c('rapport').trim() || !c('fin') || !piecesValides(pieces)} onClick={() => terminer(i)} className="rounded-lg bg-orange-700 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">Enregistrer la fin</button>
              <button onClick={() => setOuvert(null)} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm">Annuler</button>
            </div>
          </div>}
        </li>)}</ul>}
    </Panneau>
  </div>;
};
