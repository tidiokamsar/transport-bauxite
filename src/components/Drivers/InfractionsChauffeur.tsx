import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { Gavel } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Puce, SansDonnees } from '../ui/Panneau';
import { SANCTIONS, SOURCES_INFRACTION, TYPES_INFRACTION, infractionValide, sanctionEnVigueur, type Infraction, type Sanction } from './infractions';

// Infractions du chauffeur dans sa fiche (D-066) : registre append-only,
// correction par annulation motivee ; sanction decidee par une personne
// habilitee (droit d'approbation sur les chauffeurs), avec motif.

const CHAMP = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
const versLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const quand = (v: string) => new Date(v).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
interface VoyageCourt { id: string; reference: string; planned_date: string }

export const InfractionsChauffeur = ({ chauffeurId }: { chauffeurId: string }) => {
  const { hasPermission, profile } = useAuth();
  const admin = profile?.role === 'admin';
  const peutEcrire = admin || hasPermission('drivers', 'create') || hasPermission('drivers', 'edit') || hasPermission('trips', 'create') || hasPermission('trips', 'edit');
  const peutSanctionner = admin || hasPermission('drivers', 'approve');
  const [infractions, setInfractions] = useState<Infraction[] | null>(null);
  const [sanctions, setSanctions] = useState<Sanction[]>([]);
  const [voyages, setVoyages] = useState<VoyageCourt[]>([]);
  const [saisie, setSaisie] = useState(false);
  const [champs, setChamps] = useState<Record<string, string>>({});
  const [decision, setDecision] = useState<{ id: string; sanction: string; motif: string; detail: string } | null>(null);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(async () => {
    const [rI, rV] = await Promise.all([
      supabase.from('infractions_chauffeur')
        .select('id, numero, driver_id, type, survenue_le, lieu, trip_id, vehicle_id, constat, source, reference_source, statut, motif_annulation, declare_le')
        .eq('driver_id', chauffeurId).order('survenue_le', { ascending: false }),
      supabase.from('trips').select('id, reference, planned_date').eq('driver_id', chauffeurId).order('planned_date', { ascending: false }).limit(50),
    ]);
    if (rI.error) setErreur(`Registre indisponible : ${rI.error.message}`);
    const liste = (rI.data ?? []) as Infraction[];
    setInfractions(liste);
    setVoyages((rV.data ?? []) as VoyageCourt[]);
    if (liste.length > 0) {
      const rS = await supabase.from('sanctions_infraction')
        .select('id, infraction_id, sanction, detail, motif, decide_le, statut, motif_annulation')
        .in('infraction_id', liste.map((i) => i.id)).order('decide_le');
      setSanctions((rS.data ?? []) as Sanction[]);
    } else setSanctions([]);
  }, [chauffeurId]);
  useEffect(() => { charger(); }, [charger]);

  const executer = async (fonction: string, args: Record<string, unknown>, succes: string) => {
    setEnCours(true); setErreur(''); setMessage('');
    const { error } = await supabase.rpc(fonction, args);
    setEnCours(false);
    if (error) { setErreur(error.message); return false; }
    setMessage(succes); await charger(); return true;
  };
  const c = (k: string) => champs[k] ?? '';
  const poser = (k: string, v: string) => setChamps({ ...champs, [k]: v });
  const enregistrer = () => executer('enregistrer_infraction', {
    p_driver: chauffeurId, p_type: c('type'), p_survenue_le: new Date(c('quand')).toISOString(), p_constat: c('constat').trim(),
    p_source: c('source'), p_lieu: c('lieu').trim() || null, p_trip: c('voyage') || null, p_vehicle: null,
    p_reference_source: c('reference').trim() || null,
  }, 'Infraction enregistrée.').then((ok) => { if (ok) setSaisie(false); });
  const demander = (question: string) => { const m = window.prompt(question); return m?.trim() ? m.trim() : null; };
  const annuler = (i: Infraction) => { const m = demander(`Motif de l'annulation de ${i.numero}`); if (m) executer('annuler_infraction', { p_id: i.id, p_motif: m }, 'Infraction annulée.'); };
  const annulerDecision = (s: Sanction) => { const m = demander('Motif de l\'annulation de la décision'); if (m) executer('annuler_sanction', { p_sanction: s.id, p_motif: m }, 'Décision annulée.'); };
  const decider = () => decision && executer('decider_sanction', {
    p_infraction: decision.id, p_sanction: decision.sanction, p_motif: decision.motif.trim(), p_detail: decision.detail.trim() || null,
  }, 'Décision enregistrée.').then((ok) => { if (ok) setDecision(null); });
  // Dans le formulaire du chauffeur : Entree ne valide pas la fiche.
  const bloquerEntree = (e: KeyboardEvent) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault(); };
  const reference = new Map(voyages.map((v) => [v.id, v.reference]));
  const actives = (infractions ?? []).filter((i) => i.statut === 'enregistree');

  return (
    <div className="md:col-span-2" onKeyDown={bloquerEntree} aria-label="Infractions du chauffeur" role="region">
      <div className="mb-3 mt-4 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><Gavel className="h-5 w-5" /> Infractions ({actives.length})</h3>
        {peutEcrire && !saisie && (
          <button type="button" onClick={() => { setChamps({ type: 'exces_vitesse', source: 'constat_interne', quand: versLocal(new Date()) }); setSaisie(true); setErreur(''); setMessage(''); }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Enregistrer une infraction</button>
        )}
      </div>
      {erreur && <p role="alert" className="mb-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">{erreur}</p>}
      {message && <p role="status" className="mb-2 rounded-lg bg-green-50 p-2 text-sm text-green-800">{message}</p>}

      {saisie && (
        <div className="mb-3 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2" aria-label="Nouvelle infraction" role="group">
          <label className="text-sm">Type *<select value={c('type')} onChange={(e) => poser('type', e.target.value)} className={CHAMP}>{Object.entries(TYPES_INFRACTION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="text-sm">Source *<select value={c('source')} onChange={(e) => poser('source', e.target.value)} className={CHAMP}>{Object.entries(SOURCES_INFRACTION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="text-sm">Date et heure *<input type="datetime-local" value={c('quand')} onChange={(e) => poser('quand', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Lieu<input value={c('lieu')} onChange={(e) => poser('lieu', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Voyage concerné<select value={c('voyage')} onChange={(e) => poser('voyage', e.target.value)} className={CHAMP}>
            <option value="">Aucun</option>{voyages.map((v) => <option key={v.id} value={v.id}>{v.reference} ({new Date(v.planned_date).toLocaleDateString('fr-FR')})</option>)}</select></label>
          <label className="text-sm">Référence de la source<input value={c('reference')} onChange={(e) => poser('reference', e.target.value)} placeholder="PV, rapport GPS…" className={CHAMP} /></label>
          <label className="text-sm sm:col-span-2">Constat *<textarea value={c('constat')} onChange={(e) => poser('constat', e.target.value)} rows={2} className={CHAMP} /></label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={() => setSaisie(false)} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Annuler</button>
            <button type="button" onClick={enregistrer} disabled={enCours || !infractionValide({ type: c('type'), source: c('source'), constat: c('constat'), quand: c('quand') })}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Enregistrer</button>
          </div>
        </div>
      )}

      {infractions === null ? <p className="text-sm text-slate-400">Chargement…</p> : infractions.length === 0 ? (
        <SansDonnees message="Aucune infraction enregistrée" />
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">{infractions.map((i) => {
          const s = sanctionEnVigueur(sanctions, i.id);
          const historique = sanctions.filter((x) => x.infraction_id === i.id && x.statut === 'annulee');
          return (
            <li key={i.id} className={`py-3 ${i.statut === 'annulee' ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-center gap-2">
                <b>{i.numero}</b> {TYPES_INFRACTION[i.type] ?? i.type} · {quand(i.survenue_le)}{i.lieu ? ` · ${i.lieu}` : ''}
                {i.trip_id && <span className="text-slate-500">· voyage {reference.get(i.trip_id) ?? 'rattaché'}</span>}
                {i.statut === 'annulee' ? <Puce teinte="gris">Annulée : {i.motif_annulation}</Puce>
                  : s ? <Puce teinte={s.sanction === 'aucune' ? 'bleu' : 'orange'}>{SANCTIONS[s.sanction] ?? s.sanction}{s.detail ? ` (${s.detail})` : ''}</Puce>
                    : <Puce teinte="rouge">Sans décision</Puce>}
              </div>
              <p className="text-slate-700">{i.constat}</p>
              <p className="text-xs text-slate-500">Source : {SOURCES_INFRACTION[i.source] ?? i.source}{i.reference_source ? ` (${i.reference_source})` : ''} · enregistrée le {quand(i.declare_le)}</p>
              {s && <p className="text-xs text-slate-500">Décision du {quand(s.decide_le)} : {s.motif}</p>}
              {historique.map((h) => <p key={h.id} className="text-xs text-slate-400">Décision annulée : {SANCTIONS[h.sanction] ?? h.sanction} ({h.motif_annulation})</p>)}
              {i.statut === 'enregistree' && (
                <div className="mt-1 flex flex-wrap gap-2">
                  {peutSanctionner && !s && <button type="button" onClick={() => setDecision({ id: i.id, sanction: 'avertissement', motif: '', detail: '' })} className="rounded border border-slate-300 px-2 py-1 text-xs">Décider de la sanction</button>}
                  {peutSanctionner && s && <button type="button" onClick={() => annulerDecision(s)} className="rounded border border-slate-300 px-2 py-1 text-xs">Annuler la décision</button>}
                  {peutEcrire && <button type="button" onClick={() => annuler(i)} aria-label={`Annuler ${i.numero}`} className="rounded border border-slate-300 px-2 py-1 text-xs">Annuler l'infraction</button>}
                </div>
              )}
              {decision?.id === i.id && (
                <div className="mt-2 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-3" role="group" aria-label="Décision de sanction">
                  <label className="text-xs">Sanction<select value={decision.sanction} onChange={(e) => setDecision({ ...decision, sanction: e.target.value })} className={CHAMP}>
                    {Object.entries(SANCTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                  <label className="text-xs">Précision{decision.sanction === 'autre' ? ' *' : ''}<input value={decision.detail} onChange={(e) => setDecision({ ...decision, detail: e.target.value })} className={CHAMP} /></label>
                  <label className="text-xs">Motif *<input value={decision.motif} onChange={(e) => setDecision({ ...decision, motif: e.target.value })} className={CHAMP} /></label>
                  <div className="flex justify-end gap-2 sm:col-span-3">
                    <button type="button" onClick={() => setDecision(null)} className="rounded-lg px-3 py-1.5 text-xs text-slate-600">Annuler</button>
                    <button type="button" onClick={decider} disabled={enCours || !decision.motif.trim() || (decision.sanction === 'autre' && !decision.detail.trim())}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Enregistrer la décision</button>
                  </div>
                </div>
              )}
            </li>
          );
        })}</ul>
      )}
    </div>
  );
};
