import { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleDot, History, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import {
  ETATS_PNEU, LIBELLES_ACTION, TYPES_OPERATION, actionsPossibles, normaliserPosition, texteCoutKm, texteKm,
  type ActionPneu, type EtatPneu,
} from './pneus';

// Pneus (D-052) : registre et cycle de vie individuel. Chaque operation
// passe par une fonction serveur et s'inscrit au journal ; une erreur se
// corrige en annulant la derniere operation, avec motif.

interface Pneu {
  id: string; tire_number: string; brand: string; model: string; dimension: string | null; status: EtatPneu;
  vehicle_id: string | null; position: string | null; site_id: string | null; purchase_price: number | null;
  retread_count: number; max_retreads: number | null; nb_montages: number; km_parcourus: number | null; km_incomplet: boolean;
  cout_total: number | null; cout_km: number | null; derniere_profondeur_mm: number | null; profondeur_mesuree_le: string | null;
}
interface Alerte { id: string; tire_number: string; motif: 'profondeur' | 'inspection'; derniere_profondeur_mm: number | null; last_inspection_date: string | null; installation_date: string | null }
interface Operation {
  id: string; type: string; effectue_le: string; saisi_le: string; vehicle_id: string | null; position: string | null; position_precedente: string | null;
  site_id: string | null; compteur_km: number | null; profondeur_mm: number | null; pression_bar: number | null; etat_sortie: string | null;
  cout: number | null; prestataire: string | null; motif: string | null; note: string | null; annule_operation_id: string | null;
}
interface Lib { id: string; libelle: string }

const CHAMP = 'mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm';
const num = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(',', '.')));
const texte = (v: string) => (v.trim() === '' ? undefined : v.trim());
const quand = (v: string) => (v ? new Date(v).toISOString() : undefined);
const date = (v: string) => new Date(v).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

export const PneusView = () => {
  const { hasPermission, profile } = useAuth();
  const estAdmin = profile?.role === 'admin';
  const peutEcrire = estAdmin || hasPermission('vehicles', 'edit') || hasPermission('maintenance', 'edit');
  const [pneus, setPneus] = useState<Pneu[] | null>(null);
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [engins, setEngins] = useState<Lib[]>([]);
  const [sites, setSites] = useState<Lib[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Lib[]>([]);
  const [seuils, setSeuils] = useState<Record<string, string>>({});
  const [filtre, setFiltre] = useState('');
  const [saisie, setSaisie] = useState(false);
  const [action, setAction] = useState<{ type: ActionPneu; pneu: Pneu } | null>(null);
  const [historique, setHistorique] = useState<{ pneu: Pneu; operations: Operation[] } | null>(null);
  const [champs, setChamps] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const [p, a, v, s, f] = await Promise.all([
      supabase.from('v_pneus').select('*').order('tire_number'),
      supabase.from('v_pneus_a_surveiller').select('id, tire_number, motif, derniere_profondeur_mm, last_inspection_date, installation_date'),
      supabase.from('vehicles').select('id, registration').order('registration'),
      supabase.from('sites').select('id, name').order('name'),
      supabase.from('suppliers').select('id, company_name').order('company_name'),
    ]);
    setErreur(p.error?.message ?? a.error?.message ?? '');
    setPneus((p.data ?? []) as Pneu[]);
    setAlertes((a.data ?? []) as Alerte[]);
    setEngins((v.data ?? []).map((x) => ({ id: x.id as string, libelle: x.registration as string })));
    setSites((s.data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string })));
    setFournisseurs((f.data ?? []).map((x) => ({ id: x.id as string, libelle: x.company_name as string })));
    if (estAdmin) {
      const { data } = await supabase.from('settings').select('key, value').in('key', ['pneu_profondeur_min_mm', 'pneu_inspection_max_jours']);
      setSeuils(Object.fromEntries((data ?? []).map((x) => [x.key as string, String((x.value as { value?: string })?.value ?? '')])));
    }
  }, [estAdmin]);
  useEffect(() => { charger(); }, [charger]);

  const engin = useMemo(() => new Map(engins.map((e) => [e.id, e.libelle])), [engins]);
  const site = useMemo(() => new Map(sites.map((e) => [e.id, e.libelle])), [sites]);
  const liste = (pneus ?? []).filter((p) => !filtre || p.status === filtre);
  const c = (k: string) => champs[k] ?? '';
  const poser = (k: string, v: string) => setChamps({ ...champs, [k]: v });
  const emplacement = (p: Pick<Pneu, 'vehicle_id' | 'position' | 'site_id'>) =>
    p.vehicle_id ? `${engin.get(p.vehicle_id) ?? '?'} · ${p.position ?? '?'}` : p.site_id ? site.get(p.site_id) ?? '?' : 'Sans emplacement';

  const ouvrirHistorique = async (pneu: Pneu) => {
    const { data, error } = await supabase.from('pneus_operations').select('*').eq('tire_id', pneu.id)
      .order('effectue_le', { ascending: false }).order('saisi_le', { ascending: false });
    if (error) { setErreur(error.message); return; }
    setHistorique({ pneu, operations: (data ?? []) as Operation[] });
  };
  const executer = async (fonction: string, args: Record<string, unknown>, succes: string) => {
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await supabase.rpc(fonction, Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined)));
    setBusy(false);
    if (error) { setErreur(error.message); return false; }
    setMessage(succes); await charger();
    if (historique) await ouvrirHistorique(historique.pneu);
    return true;
  };

  const enregistrer = () => executer('enregistrer_pneu', {
    p_numero: c('numero').trim(), p_marque: c('marque').trim(), p_modele: c('modele').trim(), p_site: c('site'),
    p_dimension: texte(c('dimension')), p_date_achat: c('achat') || undefined, p_prix_achat: num(c('prix')),
    p_fournisseur: c('fournisseur') || undefined, p_profondeur_mm: num(c('profondeur')), p_rechapages_max: num(c('rechapages')),
    p_reference: texte(c('reference')), p_note: texte(c('note')), p_date: quand(c('date')),
  }, 'Pneu enregistré en stock.').then((ok) => { if (ok) { setSaisie(false); setChamps({}); } });

  const valider = () => {
    if (!action) return;
    const id = action.pneu.id;
    const commun = { p_tire: id, p_date: quand(c('date')) };
    const appels: Record<ActionPneu, [string, Record<string, unknown>]> = {
      monter: ['monter_pneu', { ...commun, p_vehicle: c('engin'), p_position: normaliserPosition(c('position')), p_km: num(c('km')), p_profondeur_mm: num(c('profondeur')), p_pression_bar: num(c('pression')), p_note: texte(c('note')) }],
      demonter: ['demonter_pneu', { ...commun, p_motif: c('motif').trim(), p_etat: c('etat'), p_site: c('site'), p_km: num(c('km')), p_profondeur_mm: num(c('profondeur')), p_note: texte(c('note')) }],
      permuter: ['permuter_pneu', { ...commun, p_position: normaliserPosition(c('position')), p_km: num(c('km')), p_motif: texte(c('motif')) }],
      inspecter: ['inspecter_pneu', { ...commun, p_profondeur_mm: num(c('profondeur')), p_pression_bar: num(c('pression')), p_km: num(c('km')), p_note: texte(c('note')) }],
      rechaper: ['rechaper_pneu', { ...commun, p_prestataire: c('prestataire').trim(), p_site: c('site'), p_cout: num(c('cout')), p_profondeur_mm: num(c('profondeur')), p_reference: texte(c('reference')), p_note: texte(c('note')) }],
      reparer: ['reparer_pneu', { ...commun, p_site: c('site'), p_cout: num(c('cout')), p_prestataire: texte(c('prestataire')), p_profondeur_mm: num(c('profondeur')), p_reference: texte(c('reference')), p_note: texte(c('note')) }],
      reformer: ['reformer_pneu', { ...commun, p_motif: c('motif').trim() }],
    };
    const [fonction, args] = appels[action.type];
    executer(fonction, args, `${LIBELLES_ACTION[action.type]} : opération enregistrée.`).then((ok) => { if (ok) { setAction(null); setChamps({}); } });
  };
  const pretAction = (() => {
    if (!action) return false;
    switch (action.type) {
      case 'monter': return !!c('engin') && !!normaliserPosition(c('position'));
      case 'demonter': return !!c('motif').trim() && !!c('etat') && !!c('site');
      case 'permuter': return !!normaliserPosition(c('position'));
      case 'inspecter': return c('profondeur').trim() !== '' || c('pression').trim() !== '';
      case 'rechaper': return !!c('prestataire').trim() && !!c('site');
      case 'reparer': return !!c('site');
      case 'reformer': return !!c('motif').trim();
      default: return false;
    }
  })();

  const annuler = (o: Operation) => {
    const motif = window.prompt(`Motif de l'annulation (${TYPES_OPERATION[o.type]} du ${date(o.effectue_le)})`);
    if (!motif?.trim()) return;
    executer('annuler_operation_pneu', { p_operation: o.id, p_motif: motif }, 'Opération annulée.');
  };
  const enregistrerSeuils = async () => {
    setErreur(''); setMessage('');
    for (const cle of ['pneu_profondeur_min_mm', 'pneu_inspection_max_jours']) {
      const v = (seuils[cle] ?? '').trim().replace(',', '.');
      const { error } = v === ''
        ? await supabase.from('settings').delete().eq('key', cle)
        : await supabase.from('settings').upsert({ key: cle, value: { value: v }, category: 'pneus', description: 'Seuil d\'alerte des pneus (D-052)' }, { onConflict: 'key' });
      if (error) { setErreur(error.message); return; }
    }
    setMessage('Seuils enregistrés.'); await charger();
  };

  const annulees = new Set((historique?.operations ?? []).filter((o) => o.annule_operation_id).map((o) => o.annule_operation_id));
  const derniere = (historique?.operations ?? []).find((o) => o.type !== 'annulation' && !annulees.has(o.id));
  const champ = (k: string, libelle: string, props: Record<string, unknown> = {}) =>
    <label className="text-sm">{libelle}<input value={c(k)} onChange={(e) => poser(k, e.target.value)} className={CHAMP} {...props} /></label>;
  const choixSite = (libelle = 'Site de stockage *') => <label className="text-sm">{libelle}<select value={c('site')} onChange={(e) => poser('site', e.target.value)} className={CHAMP}><option value="">Choisir</option>{sites.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}</select></label>;

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Pneus</h2>
        <p className="text-sm text-stone-500">Registre et cycle de vie de chaque pneu : montage, permutation, inspection, démontage, réparation, rechapage, réforme.</p></div>
      <div className="flex gap-2">
        {peutEcrire && <button onClick={() => { setSaisie(true); setAction(null); setChamps({}); }} className="flex items-center gap-2 rounded-lg bg-orange-700 px-3 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Pneu</button>}
        <button onClick={charger} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
      </div>
    </header>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}

    {saisie && <Panneau titre="Nouveau pneu (entrée en stock)">
      <div role="form" aria-label="Saisie pneu" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {champ('numero', 'Numéro (marquage) *')}
        {champ('marque', 'Marque *')}
        {champ('modele', 'Modèle *')}
        {champ('dimension', 'Dimension', { placeholder: '315/80 R22.5' })}
        {choixSite()}
        {champ('date', 'Entrée le', { type: 'datetime-local' })}
        {champ('profondeur', 'Profondeur initiale (mm)', { inputMode: 'decimal' })}
        {champ('rechapages', 'Rechapages maximum', { inputMode: 'numeric' })}
        {champ('achat', 'Date d\'achat', { type: 'date' })}
        {champ('prix', 'Prix d\'achat (GNF)', { inputMode: 'numeric' })}
        <label className="text-sm">Fournisseur<select value={c('fournisseur')} onChange={(e) => poser('fournisseur', e.target.value)} className={CHAMP}><option value="">Non renseigné</option>{fournisseurs.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}</select></label>
        {champ('reference', 'Pièce (bon de réception)')}
      </div>
      <div className="mt-3 flex gap-2">
        <button disabled={busy || !(c('numero').trim() && c('marque').trim() && c('modele').trim() && c('site'))} onClick={enregistrer} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer</button>
        <button onClick={() => setSaisie(false)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Annuler</button>
      </div>
    </Panneau>}

    {action && <Panneau titre={`${LIBELLES_ACTION[action.type]} le pneu ${action.pneu.tire_number}`}>
      <p className="mb-3 text-sm text-stone-600">Emplacement actuel : {emplacement(action.pneu)}</p>
      <div role="form" aria-label="Opération pneu" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {champ('date', 'Date de l\'opération', { type: 'datetime-local' })}
        {action.type === 'monter' && <>
          <label className="text-sm">Engin *<select value={c('engin')} onChange={(e) => poser('engin', e.target.value)} className={CHAMP}><option value="">Choisir</option>{engins.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}</select></label>
          {champ('position', 'Position *', { placeholder: 'AV G, AR1 D EXT…' })}
        </>}
        {action.type === 'permuter' && champ('position', 'Nouvelle position *')}
        {action.type === 'demonter' && <>
          {champ('motif', 'Motif *', { placeholder: 'Usure, crevaison, coupure…' })}
          <label className="text-sm">État au démontage *<select value={c('etat')} onChange={(e) => poser('etat', e.target.value)} className={CHAMP}><option value="">Choisir</option><option value="stored">Réutilisable (en stock)</option><option value="damaged">À décider (réparation, rechapage, réforme)</option></select></label>
          {choixSite('Site de dépose *')}
        </>}
        {(action.type === 'rechaper' || action.type === 'reparer') && <>
          {champ('prestataire', action.type === 'rechaper' ? 'Prestataire *' : 'Prestataire')}
          {champ('cout', 'Coût (GNF)', { inputMode: 'numeric' })}
          {choixSite('Site de retour *')}
          {champ('reference', 'Pièce (facture, bon)')}
        </>}
        {action.type === 'reformer' && champ('motif', 'Motif de la réforme *')}
        {action.type === 'permuter' && champ('motif', 'Motif')}
        {['monter', 'demonter', 'permuter', 'inspecter'].includes(action.type) && champ('km', 'Compteur engin (km)', { inputMode: 'decimal' })}
        {['monter', 'demonter', 'inspecter', 'rechaper', 'reparer'].includes(action.type) && champ('profondeur', 'Profondeur (mm)', { inputMode: 'decimal' })}
        {['monter', 'inspecter'].includes(action.type) && champ('pression', 'Pression (bar)', { inputMode: 'decimal' })}
        {action.type !== 'reformer' && action.type !== 'permuter' && champ('note', 'Observation')}
      </div>
      {action.type === 'reformer' && <p className="mt-2 text-sm text-orange-800">La réforme est définitive : le pneu ne pourra plus être monté.</p>}
      <div className="mt-3 flex gap-2">
        <button disabled={busy || !pretAction} onClick={valider} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Valider l'opération</button>
        <button onClick={() => setAction(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Annuler</button>
      </div>
    </Panneau>}

    <Panneau titre={`À surveiller (${alertes.length})`}>
      {alertes.length === 0 ? <SansDonnees message="Aucun pneu sous le seuil de profondeur ni en retard d'inspection (seuils fixés par l'administrateur)" /> :
        <ul className="divide-y divide-stone-100 text-sm">{alertes.map((a) => <li key={a.id} className="py-2">
          <b>{a.tire_number}</b> · {a.motif === 'profondeur'
            ? <Puce teinte="rouge">Profondeur {a.derniere_profondeur_mm} mm</Puce>
            : <Puce teinte="orange">Inspection en retard (dernière : {a.last_inspection_date ?? 'aucune'})</Puce>}</li>)}</ul>}
    </Panneau>

    {estAdmin && <Panneau titre="Seuils d'alerte">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">Profondeur minimale (mm)<input aria-label="Profondeur minimale (mm)" value={seuils.pneu_profondeur_min_mm ?? ''} onChange={(e) => setSeuils({ ...seuils, pneu_profondeur_min_mm: e.target.value })} className={CHAMP} /></label>
        <label className="text-sm">Inspection au plus tard tous les (jours)<input aria-label="Inspection maximale (jours)" value={seuils.pneu_inspection_max_jours ?? ''} onChange={(e) => setSeuils({ ...seuils, pneu_inspection_max_jours: e.target.value })} className={CHAMP} /></label>
        <div className="flex items-end"><button onClick={enregistrerSeuils} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Enregistrer les seuils</button></div>
      </div>
      <p className="mt-2 text-xs text-stone-500">Vide : pas d'alerte de ce type.</p>
    </Panneau>}

    <Panneau titre="Registre">
      <select aria-label="Filtrer par état" value={filtre} onChange={(e) => setFiltre(e.target.value)} className="mb-3 rounded border border-stone-300 px-3 py-2 text-sm">
        <option value="">Tous les états</option>{Object.entries(ETATS_PNEU).map(([k, v]) => <option key={k} value={k}>{v.texte}</option>)}</select>
      {pneus === null ? <p>Chargement…</p> : liste.length === 0 ? <SansDonnees message="Aucun pneu enregistré" /> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500">
          <th className="py-2 pr-3">Pneu</th><th className="py-2 pr-3">État</th><th className="py-2 pr-3">Emplacement</th><th className="py-2 pr-3">Km parcourus</th>
          <th className="py-2 pr-3">Coût au km</th><th className="py-2 pr-3">Profondeur</th><th className="py-2 pr-3">Rechapages</th><th /></tr></thead>
          <tbody>{liste.map((p) => <tr key={p.id} className="border-b border-stone-100 align-top">
            <td className="py-2 pr-3"><b>{p.tire_number}</b><span className="block text-xs text-stone-500">{p.brand} {p.model}{p.dimension ? ` · ${p.dimension}` : ''}</span></td>
            <td className="py-2 pr-3"><Puce teinte={ETATS_PNEU[p.status].teinte}>{ETATS_PNEU[p.status].texte}</Puce></td>
            <td className="py-2 pr-3">{emplacement(p)}</td>
            <td className="py-2 pr-3">{texteKm(p.km_parcourus, p.km_incomplet, p.nb_montages)}</td>
            <td className="py-2 pr-3">{texteCoutKm(p.cout_km)}</td>
            <td className="py-2 pr-3">{p.derniere_profondeur_mm === null ? 'Sans données' : <>{p.derniere_profondeur_mm} mm<span className="block text-xs text-stone-500">{p.profondeur_mesuree_le && date(p.profondeur_mesuree_le)}</span></>}</td>
            <td className="py-2 pr-3">{p.retread_count}{p.max_retreads !== null ? ` / ${p.max_retreads}` : ''}</td>
            <td className="py-2"><div className="flex flex-wrap gap-1">
              {peutEcrire && actionsPossibles(p.status).map((a) => <button key={a} onClick={() => { setAction({ type: a, pneu: p }); setSaisie(false); setChamps({}); }}
                aria-label={`${LIBELLES_ACTION[a]} ${p.tire_number}`} className="rounded border border-stone-300 px-2 py-1 text-xs">{LIBELLES_ACTION[a]}</button>)}
              <button onClick={() => ouvrirHistorique(p)} aria-label={`Historique ${p.tire_number}`} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs"><History className="h-3 w-3" /> Historique</button>
            </div></td>
          </tr>)}</tbody></table></div>}
    </Panneau>

    {historique && <Panneau titre={`Historique du pneu ${historique.pneu.tire_number}`}>
      {historique.operations.length === 0 ? <SansDonnees message="Aucune opération au journal" /> :
        <ul className="divide-y divide-stone-100 text-sm">{historique.operations.map((o) => <li key={o.id} className={`flex flex-wrap items-start justify-between gap-2 py-2 ${annulees.has(o.id) ? 'text-stone-400 line-through' : ''}`}>
          <div><CircleDot className="mr-1 inline h-3 w-3" /><b>{TYPES_OPERATION[o.type] ?? o.type}</b> · {date(o.effectue_le)}
            {o.vehicle_id && <> · {engin.get(o.vehicle_id) ?? '?'} {o.position_precedente ? `${o.position_precedente} → ` : ''}{o.position}</>}
            {o.site_id && !o.vehicle_id && <> · {site.get(o.site_id) ?? '?'}</>}
            {o.compteur_km !== null && <> · {o.compteur_km} km</>}
            {o.profondeur_mm !== null && <> · {o.profondeur_mm} mm</>}
            {o.pression_bar !== null && <> · {o.pression_bar} bar</>}
            {o.etat_sortie && <> · {ETATS_PNEU[o.etat_sortie as EtatPneu]?.texte}</>}
            {o.prestataire && <> · {o.prestataire}</>}
            {o.cout !== null && <> · {o.cout} GNF</>}
            {(o.motif || o.note) && <span className="block text-xs text-stone-500">{o.motif ?? ''}{o.motif && o.note ? ' · ' : ''}{o.note ?? ''}</span>}
          </div>
          {peutEcrire && derniere?.id === o.id && o.type !== 'entree' &&
            <button onClick={() => annuler(o)} aria-label={`Annuler ${TYPES_OPERATION[o.type]}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Annuler</button>}
        </li>)}</ul>}
    </Panneau>}
  </div>;
};
