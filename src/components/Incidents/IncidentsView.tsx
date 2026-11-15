import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import { GRAVITES, STATUTS_INCIDENT, TYPES_INCIDENT } from '../Hse/hse';

// Incidents HSE (D-054) : declaration rattachee a un voyage, un engin ou
// un site ; analyse (cause), actions correctives avec responsable et
// echeance, cloture quand toutes les actions sont soldees.

interface Incident {
  id: string; numero: string | null; type: string | null; severity: string; description: string; incident_time: string;
  vehicle_id: string | null; driver_id: string | null; trip_id: string | null; site_id: string | null; lieu: string | null;
  estimated_cost: number | null; statut: string; cause: string | null; conclusion: string | null;
}
interface Action { id: string; incident_id: string; libelle: string; responsable: string; echeance: string; statut: string; preuve: string | null; motif_annulation: string | null }
interface Retard { id: string; numero: string | null; libelle: string; responsable: string; echeance: string; jours_de_retard: number }
interface Lib { id: string; libelle: string }

const CHAMP = 'mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm';
const quand = (v: string) => new Date(v).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

export const IncidentsView = () => {
  const { hasPermission, profile } = useAuth();
  const peutEcrire = profile?.role === 'admin' || hasPermission('trips', 'create') || hasPermission('trips', 'edit');
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [retards, setRetards] = useState<Retard[]>([]);
  const [engins, setEngins] = useState<Lib[]>([]);
  const [chauffeurs, setChauffeurs] = useState<Lib[]>([]);
  const [sites, setSites] = useState<Lib[]>([]);
  const [filtre, setFiltre] = useState('');
  const [saisie, setSaisie] = useState(false);
  const [champs, setChamps] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<string | null>(null);
  const [action, setAction] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const [i, a, r, v, d, s] = await Promise.all([
      supabase.from('incidents').select('id, numero, type, severity, description, incident_time, vehicle_id, driver_id, trip_id, site_id, lieu, estimated_cost, statut, cause, conclusion').order('incident_time', { ascending: false }).limit(200),
      supabase.from('actions_correctives').select('id, incident_id, libelle, responsable, echeance, statut, preuve, motif_annulation').order('echeance'),
      supabase.from('v_actions_correctives_en_retard').select('id, numero, libelle, responsable, echeance, jours_de_retard').order('echeance'),
      supabase.from('vehicles').select('id, registration').order('registration'),
      supabase.from('drivers').select('id, name').order('name'),
      supabase.from('sites').select('id, name').order('name'),
    ]);
    setErreur(i.error?.message ?? a.error?.message ?? '');
    setIncidents((i.data ?? []) as Incident[]);
    setActions((a.data ?? []) as Action[]);
    setRetards((r.data ?? []) as Retard[]);
    setEngins((v.data ?? []).map((x) => ({ id: x.id as string, libelle: x.registration as string })));
    setChauffeurs((d.data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string })));
    setSites((s.data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string })));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const engin = useMemo(() => new Map(engins.map((x) => [x.id, x.libelle])), [engins]);
  const chauffeur = useMemo(() => new Map(chauffeurs.map((x) => [x.id, x.libelle])), [chauffeurs]);
  const site = useMemo(() => new Map(sites.map((x) => [x.id, x.libelle])), [sites]);
  const liste = (incidents ?? []).filter((i) => !filtre || i.statut === filtre);
  const choisi = (incidents ?? []).find((i) => i.id === selection) ?? null;
  const actionsChoisi = actions.filter((a) => a.incident_id === selection);
  const c = (k: string) => champs[k] ?? '';
  const poser = (k: string, v: string) => setChamps({ ...champs, [k]: v });

  const executer = async (fonction: string, args: Record<string, unknown>, succes: string) => {
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await supabase.rpc(fonction, args);
    setBusy(false);
    if (error) { setErreur(error.message); return false; }
    setMessage(succes); await charger(); return true;
  };
  const declarer = () => executer('declarer_incident', {
    p_type: c('type'), p_gravite: c('gravite'), p_description: c('description').trim(),
    p_survenu_le: c('quand') ? new Date(c('quand')).toISOString() : new Date().toISOString(),
    p_vehicle: c('engin') || null, p_driver: c('chauffeur') || null, p_site: c('site') || null,
    p_lieu: c('lieu').trim() || null, p_cout_estime: c('cout') ? Number(c('cout')) : null,
  }, 'Incident déclaré.').then((ok) => { if (ok) { setSaisie(false); setChamps({}); } });
  const demander = (question: string) => { const m = window.prompt(question); return m?.trim() ? m.trim() : null; };
  const analyser = (i: Incident) => { const m = demander(`Cause de l'incident ${i.numero ?? ''}`); if (m) executer('analyser_incident', { p_id: i.id, p_cause: m }, 'Analyse enregistrée.'); };
  const cloturer = (i: Incident) => { const m = demander(`Conclusion de l'incident ${i.numero ?? ''}`); if (m) executer('cloturer_incident', { p_id: i.id, p_conclusion: m }, 'Incident clos.'); };
  const ajouterAction = () => {
    if (!choisi) return;
    executer('ajouter_action_corrective', { p_incident: choisi.id, p_libelle: action.libelle?.trim(), p_responsable: action.responsable?.trim(), p_echeance: action.echeance },
      'Action corrective ajoutée.').then((ok) => { if (ok) setAction({}); });
  };
  const solder = (a: Action, realisee: boolean) => {
    const t = demander(realisee ? `Preuve de réalisation de « ${a.libelle} » (référence d'OT, de formation…)` : `Motif de l'annulation de « ${a.libelle} »`);
    if (t) executer('solder_action_corrective', { p_action: a.id, p_realisee: realisee, p_texte: t }, realisee ? 'Action réalisée.' : 'Action annulée.');
  };
  const rattachement = (i: Incident) => [i.vehicle_id && engin.get(i.vehicle_id), i.driver_id && chauffeur.get(i.driver_id), i.site_id && site.get(i.site_id), i.lieu, i.trip_id && 'voyage'].filter(Boolean).join(' · ');

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Incidents HSE</h2>
        <p className="text-sm text-stone-500">Déclaration, analyse de la cause, actions correctives suivies jusqu'à la clôture.</p></div>
      <div className="flex gap-2">
        {peutEcrire && <button onClick={() => { setSaisie(true); setChamps({ gravite: 'minor', type: 'presque_accident' }); }} className="flex items-center gap-2 rounded-lg bg-orange-700 px-3 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Déclarer un incident</button>}
        <button onClick={charger} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
      </div>
    </header>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}

    {saisie && <Panneau titre="Déclaration d'incident">
      <div role="form" aria-label="Déclaration incident" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm">Type *<select value={c('type')} onChange={(e) => poser('type', e.target.value)} className={CHAMP}>{Object.entries(TYPES_INCIDENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="text-sm">Gravité *<select value={c('gravite')} onChange={(e) => poser('gravite', e.target.value)} className={CHAMP}>{Object.entries(GRAVITES).map(([k, v]) => <option key={k} value={k}>{v.texte}</option>)}</select></label>
        <label className="text-sm">Survenu le<input type="datetime-local" value={c('quand')} onChange={(e) => poser('quand', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Lieu<input value={c('lieu')} onChange={(e) => poser('lieu', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Engin<select value={c('engin')} onChange={(e) => poser('engin', e.target.value)} className={CHAMP}><option value="">Aucun</option>{engins.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}</select></label>
        <label className="text-sm">Chauffeur<select value={c('chauffeur')} onChange={(e) => poser('chauffeur', e.target.value)} className={CHAMP}><option value="">Aucun</option>{chauffeurs.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}</select></label>
        <label className="text-sm">Site<select value={c('site')} onChange={(e) => poser('site', e.target.value)} className={CHAMP}><option value="">Aucun</option>{sites.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}</select></label>
        <label className="text-sm">Coût estimé (GNF)<input inputMode="numeric" value={c('cout')} onChange={(e) => poser('cout', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm sm:col-span-2 xl:col-span-4">Description *<textarea value={c('description')} onChange={(e) => poser('description', e.target.value)} rows={3} className={CHAMP} /></label>
      </div>
      <p className="mt-2 text-xs text-stone-500">Rattacher l'incident au moins à un engin ou à un site.</p>
      <div className="mt-3 flex gap-2">
        <button disabled={busy || !c('description').trim() || !(c('engin') || c('site'))} onClick={declarer} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Déclarer</button>
        <button onClick={() => setSaisie(false)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Annuler</button>
      </div>
    </Panneau>}

    <Panneau titre={`Actions correctives en retard (${retards.length})`}>
      {retards.length === 0 ? <SansDonnees message="Aucune action corrective en retard" /> :
        <ul className="divide-y divide-stone-100 text-sm">{retards.map((r) => <li key={r.id} className="py-2"><b>{r.numero}</b> · {r.libelle} · {r.responsable} · <Puce teinte="rouge">{r.jours_de_retard} j de retard</Puce></li>)}</ul>}
    </Panneau>

    {choisi && <Panneau titre={`Incident ${choisi.numero ?? ''}`}>
      <div className="space-y-2 text-sm">
        <p><Puce teinte={STATUTS_INCIDENT[choisi.statut]?.teinte ?? 'gris'}>{STATUTS_INCIDENT[choisi.statut]?.texte ?? choisi.statut}</Puce> <Puce teinte={GRAVITES[choisi.severity]?.teinte ?? 'gris'}>{GRAVITES[choisi.severity]?.texte ?? choisi.severity}</Puce> {TYPES_INCIDENT[choisi.type ?? ''] ?? 'Type non renseigné'} · {quand(choisi.incident_time)}</p>
        <p>{choisi.description}</p>
        <p className="text-stone-600">{rattachement(choisi) || 'Sans rattachement'}{choisi.estimated_cost !== null && ` · coût estimé ${choisi.estimated_cost} GNF`}</p>
        <p><b>Cause :</b> {choisi.cause ?? 'non analysée'}</p>
        {choisi.conclusion && <p><b>Conclusion :</b> {choisi.conclusion}</p>}
      </div>
      {peutEcrire && choisi.statut !== 'clos' && <div className="mt-3 flex gap-2">
        <button onClick={() => analyser(choisi)} className="rounded border border-stone-300 px-3 py-1 text-xs">{choisi.cause ? 'Réviser la cause' : 'Analyser'}</button>
        <button onClick={() => cloturer(choisi)} className="rounded border border-stone-300 px-3 py-1 text-xs">Clôturer</button>
      </div>}
      <h3 className="mt-4 text-sm font-bold">Actions correctives</h3>
      {actionsChoisi.length === 0 ? <SansDonnees message="Aucune action corrective" /> :
        <ul className="divide-y divide-stone-100 text-sm">{actionsChoisi.map((a) => <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span>{a.libelle} · {a.responsable} · échéance {a.echeance} · {a.statut === 'ouverte' ? <Puce teinte="bleu">Ouverte</Puce> : a.statut === 'realisee' ? <Puce teinte="vert">Réalisée ({a.preuve})</Puce> : <Puce teinte="gris">Annulée ({a.motif_annulation})</Puce>}</span>
          {peutEcrire && a.statut === 'ouverte' && choisi.statut !== 'clos' && <span className="flex gap-1">
            <button onClick={() => solder(a, true)} aria-label={`Réaliser ${a.libelle}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Réalisée</button>
            <button onClick={() => solder(a, false)} aria-label={`Annuler ${a.libelle}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Annuler</button></span>}
        </li>)}</ul>}
      {peutEcrire && choisi.statut !== 'clos' && <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <input aria-label="Action corrective" value={action.libelle ?? ''} onChange={(e) => setAction({ ...action, libelle: e.target.value })} placeholder="Action" className="rounded border border-stone-300 px-3 py-2 text-sm" />
        <input aria-label="Responsable" value={action.responsable ?? ''} onChange={(e) => setAction({ ...action, responsable: e.target.value })} placeholder="Responsable" className="rounded border border-stone-300 px-3 py-2 text-sm" />
        <input aria-label="Échéance" type="date" value={action.echeance ?? ''} onChange={(e) => setAction({ ...action, echeance: e.target.value })} className="rounded border border-stone-300 px-3 py-2 text-sm" />
        <button disabled={busy || !action.libelle?.trim() || !action.responsable?.trim() || !action.echeance} onClick={ajouterAction} className="rounded-lg border border-stone-300 px-3 py-2 text-sm disabled:opacity-50">Ajouter l'action</button>
      </div>}
    </Panneau>}

    <Panneau titre="Registre des incidents">
      <select aria-label="Filtrer par statut" value={filtre} onChange={(e) => setFiltre(e.target.value)} className="mb-3 rounded border border-stone-300 px-3 py-2 text-sm">
        <option value="">Tous les statuts</option>{Object.entries(STATUTS_INCIDENT).map(([k, v]) => <option key={k} value={k}>{v.texte}</option>)}</select>
      {incidents === null ? <p>Chargement…</p> : liste.length === 0 ? <SansDonnees message="Aucun incident déclaré" /> :
        <ul className="divide-y divide-stone-100 text-sm">{liste.map((i) => <li key={i.id} className={`flex flex-wrap items-center justify-between gap-2 py-2 ${selection === i.id ? 'bg-orange-50' : ''}`}>
          <span><ShieldAlert className="mr-1 inline h-4 w-4" /><b>{i.numero ?? 'Sans numéro'}</b> · {TYPES_INCIDENT[i.type ?? ''] ?? 'Type non renseigné'} · {quand(i.incident_time)} · {rattachement(i) || 'Sans rattachement'}
            {' '}<Puce teinte={GRAVITES[i.severity]?.teinte ?? 'gris'}>{GRAVITES[i.severity]?.texte ?? i.severity}</Puce> <Puce teinte={STATUTS_INCIDENT[i.statut]?.teinte ?? 'gris'}>{STATUTS_INCIDENT[i.statut]?.texte ?? i.statut}</Puce></span>
          <button onClick={() => setSelection(i.id)} aria-label={`Ouvrir ${i.numero ?? i.id}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Ouvrir</button>
        </li>)}</ul>}
    </Panneau>
  </div>;
};
