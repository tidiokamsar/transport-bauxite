import { useCallback, useEffect, useMemo, useState } from 'react';
import { DoorClosed, DoorOpen, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import { TYPES_INFRASTRUCTURE, fermetureActive, type Fermeture } from './infrastructures';

// Infrastructures de site et fermetures temporaires (D-047). Une fermeture
// du site entier bloque les affectations du dispatch a la date du voyage
// (controle serveur) ; elle se leve avec un motif, jamais supprimee.

interface Infrastructure { id: string; site_id: string; type: keyof typeof TYPES_INFRASTRUCTURE; code: string; libelle: string; capacite: number | null; unite_capacite: string | null; actif: boolean }
interface Lib { id: string; libelle: string }

const CHAMP = 'mt-1 w-full rounded border border-stone-300 px-3 py-2';
const versLocal = (d: Date) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };

export const InfrastructuresView = () => {
  const { hasPermission, profile } = useAuth();
  const peutEcrire = hasPermission('settings', 'edit') || profile?.role === 'admin';
  const [infras, setInfras] = useState<Infrastructure[] | null>(null);
  const [fermetures, setFermetures] = useState<Fermeture[]>([]);
  const [sites, setSites] = useState<Lib[]>([]);
  const [formulaire, setFormulaire] = useState<'' | 'infrastructure' | 'fermeture'>('');
  const [champs, setChamps] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const [i, f, s] = await Promise.all([
      supabase.from('infrastructures_site').select('id, site_id, type, code, libelle, capacite, unite_capacite, actif').order('code'),
      supabase.from('fermetures_site').select('id, site_id, infrastructure_id, debut, fin, motif, levee_le, motif_levee').order('debut', { ascending: false }).limit(200),
      supabase.from('sites').select('id, name').order('name'),
    ]);
    setErreur(i.error?.message ?? f.error?.message ?? s.error?.message ?? '');
    setInfras((i.data ?? []) as Infrastructure[]);
    setFermetures((f.data ?? []) as Fermeture[]);
    setSites((s.data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string })));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const nomSite = useMemo(() => new Map(sites.map((s) => [s.id, s.libelle])), [sites]);
  const nomInfra = useMemo(() => new Map((infras ?? []).map((i) => [i.id, `${i.code} · ${i.libelle}`])), [infras]);
  const maintenant = new Date();
  const actives = fermetures.filter((f) => fermetureActive(f, maintenant));
  const c = (k: string) => champs[k] ?? '';
  const poser = (k: string, v: string) => setChamps({ ...champs, [k]: v });

  const executer = async (action: () => PromiseLike<{ error: { message: string } | null }>, succes: string) => {
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await action();
    setBusy(false);
    if (error) { setErreur(error.message); return; }
    setMessage(succes); setFormulaire(''); await charger();
  };
  const soumettre = () => formulaire === 'infrastructure'
    ? executer(() => supabase.from('infrastructures_site').insert({
      site_id: c('site'), type: c('type'), code: c('code').trim(), libelle: c('libelle').trim(),
      capacite: c('capacite') ? Number(c('capacite').replace(',', '.')) : null, unite_capacite: c('capacite') ? c('unite').trim() : null,
    }), 'Infrastructure enregistrée.')
    : executer(() => supabase.from('fermetures_site').insert({
      site_id: c('site'), infrastructure_id: c('infrastructure') || null, debut: new Date(c('debut')).toISOString(),
      fin: c('fin') ? new Date(c('fin')).toISOString() : null, motif: c('motif').trim(),
    }), 'Fermeture déclarée. Le dispatch refusera les affectations vers ou depuis ce site sur la période.');
  const lever = (f: Fermeture) => {
    const motif = window.prompt('Motif de la levée de la fermeture');
    if (!motif?.trim()) return;
    executer(() => supabase.from('fermetures_site').update({ levee_le: new Date().toISOString(), motif_levee: motif }).eq('id', f.id), 'Fermeture levée.');
  };
  const archiver = (i: Infrastructure) => {
    if (!window.confirm(`Archiver ${i.code} ?`)) return;
    executer(() => supabase.from('infrastructures_site').update({ actif: false }).eq('id', i.id), 'Infrastructure archivée.');
  };

  const pret = formulaire === 'infrastructure'
    ? c('site') && c('type') && c('code').trim() && c('libelle').trim() && (!c('capacite') || (Number(c('capacite').replace(',', '.')) > 0 && c('unite').trim()))
    : formulaire === 'fermeture' ? c('site') && c('debut') && c('motif').trim() && (!c('fin') || new Date(c('fin')) > new Date(c('debut'))) : false;

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Infrastructures et fermetures</h2>
        <p className="text-sm text-stone-500">Points de chargement, dépôts, ponts-bascules, stations ; fermetures temporaires prises en compte par le dispatch.</p></div>
      <div className="flex flex-wrap gap-2">
        {peutEcrire && <>
          <button onClick={() => { setFormulaire('fermeture'); setChamps({ debut: versLocal(new Date()) }); }} className="flex items-center gap-2 rounded-lg bg-red-700 px-3 py-2 text-sm font-bold text-white"><DoorClosed className="h-4 w-4" /> Déclarer une fermeture</button>
          <button onClick={() => { setFormulaire('infrastructure'); setChamps({ type: 'point_chargement' }); }} className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"><Plus className="h-4 w-4" /> Infrastructure</button>
        </>}
        <button onClick={charger} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
      </div>
    </header>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {actives.length > 0 && <div role="status" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <b>{actives.length} fermeture(s) en cours :</b> {actives.map((f) => `${nomSite.get(f.site_id) ?? '?'}${f.infrastructure_id ? ` (${nomInfra.get(f.infrastructure_id) ?? '?'})` : ''} : ${f.motif}`).join(' ; ')}
    </div>}

    {formulaire && <Panneau titre={formulaire === 'infrastructure' ? 'Nouvelle infrastructure' : 'Déclarer une fermeture'}>
      <div role="form" aria-label="Saisie infrastructure" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <label className="text-sm">Site *<select value={c('site')} onChange={(e) => setChamps({ ...champs, site: e.target.value, infrastructure: '' })} className={CHAMP}>
          <option value="">Choisir</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}</select></label>
        {formulaire === 'infrastructure' ? <>
          <label className="text-sm">Type *<select value={c('type')} onChange={(e) => poser('type', e.target.value)} className={CHAMP}>
            {Object.entries(TYPES_INFRASTRUCTURE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="text-sm">Code *<input value={c('code')} onChange={(e) => poser('code', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Libellé *<input value={c('libelle')} onChange={(e) => poser('libelle', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Capacité (si connue)<input inputMode="decimal" value={c('capacite')} onChange={(e) => poser('capacite', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Unité de la capacité{c('capacite') ? ' *' : ''}<input value={c('unite')} onChange={(e) => poser('unite', e.target.value)} placeholder="camions/heure, tonnes, m³…" className={CHAMP} /></label>
        </> : <>
          <label className="text-sm">Infrastructure (vide = site entier)<select value={c('infrastructure')} onChange={(e) => poser('infrastructure', e.target.value)} className={CHAMP}>
            <option value="">Site entier (bloque le dispatch)</option>{(infras ?? []).filter((i) => i.site_id === c('site') && i.actif).map((i) => <option key={i.id} value={i.id}>{i.code} · {i.libelle}</option>)}</select></label>
          <label className="text-sm">Début *<input type="datetime-local" value={c('debut')} onChange={(e) => poser('debut', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Fin prévue<input type="datetime-local" value={c('fin')} onChange={(e) => poser('fin', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm sm:col-span-2">Motif *<input value={c('motif')} onChange={(e) => poser('motif', e.target.value)} className={CHAMP} /></label>
        </>}
      </div>
      <div className="mt-3 flex gap-2">
        <button disabled={busy || !pret} onClick={soumettre} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer</button>
        <button onClick={() => setFormulaire('')} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Annuler</button>
      </div>
    </Panneau>}

    <Panneau titre="Fermetures">
      {fermetures.length === 0 ? <SansDonnees message="Aucune fermeture déclarée" /> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500">
          <th className="py-2 pr-3">Site</th><th className="py-2 pr-3">Période</th><th className="py-2 pr-3">Motif</th><th className="py-2 pr-3">État</th><th /></tr></thead>
          <tbody>{fermetures.map((f) => { const active = fermetureActive(f, maintenant); return <tr key={f.id} className="border-b border-stone-100">
            <td className="py-2 pr-3">{nomSite.get(f.site_id) ?? '?'}{f.infrastructure_id && <span className="block text-xs text-stone-500">{nomInfra.get(f.infrastructure_id)}</span>}</td>
            <td className="py-2 pr-3 text-xs">{new Date(f.debut).toLocaleString('fr-FR')} → {f.fin ? new Date(f.fin).toLocaleString('fr-FR') : 'jusqu\'à levée'}</td>
            <td className="py-2 pr-3">{f.motif}{f.motif_levee && <span className="block text-xs text-stone-500">Levée : {f.motif_levee}</span>}</td>
            <td className="py-2 pr-3">{f.levee_le ? <Puce teinte="gris">Levée</Puce> : active ? <Puce teinte="rouge">En cours</Puce> : new Date(f.debut) > maintenant ? <Puce teinte="orange">À venir</Puce> : <Puce teinte="gris">Terminée</Puce>}</td>
            <td className="py-2">{peutEcrire && !f.levee_le && (active || new Date(f.debut) > maintenant) && <button onClick={() => lever(f)} aria-label={`Lever la fermeture ${f.motif}`} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs"><DoorOpen className="h-3 w-3" /> Lever</button>}</td>
          </tr>; })}</tbody></table></div>}
    </Panneau>

    <Panneau titre={`Infrastructures (${infras?.length ?? 0})`}>
      {infras === null ? <p>Chargement…</p> : infras.length === 0 ? <SansDonnees message="Aucune infrastructure" detail="Déclarez les points de chargement, dépôts, ponts-bascules et stations de chaque site." /> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500">
          <th className="py-2 pr-3">Code</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Site</th><th className="py-2 pr-3">Capacité</th><th /></tr></thead>
          <tbody>{infras.map((i) => <tr key={i.id} className={`border-b border-stone-100 ${i.actif ? '' : 'text-stone-400'}`}>
            <td className="py-2 pr-3"><span className="font-mono font-semibold">{i.code}</span> {i.libelle}</td>
            <td className="py-2 pr-3">{TYPES_INFRASTRUCTURE[i.type]}</td><td className="py-2 pr-3">{nomSite.get(i.site_id) ?? '?'}</td>
            <td className="py-2 pr-3">{i.capacite !== null ? `${i.capacite} ${i.unite_capacite}` : <span className="text-stone-400">non renseignée</span>}</td>
            <td className="py-2">{peutEcrire && i.actif && <button onClick={() => archiver(i)} className="rounded border border-stone-300 px-2 py-1 text-xs">Archiver</button>}</td>
          </tr>)}</tbody></table></div>}
    </Panneau>
  </div>;
};
