import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, ClipboardCheck, Download, PackageMinus, PackagePlus, Plus, RefreshCw, Undo2, Warehouse } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { exportToCSV } from '../../lib/exports';
import { formatNombre } from '../Dashboard/indicateurs';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import { LIBELLE_MOUVEMENT_STOCK, alerteArticle, type TypeMouvementStock } from './stock';

// Registre des stocks magasin (D-044) : la quantite d'un article dans un
// depot est la somme de ses mouvements. Entree, sortie, transfert, retour et
// inventaire passent par des fonctions serveur ; une erreur se corrige par
// annulation (contre-mouvement), jamais par modification.

interface Article { id: string; item_code: string; name: string; unit_of_measure: string; unit_price: number | null; minimum_threshold: number | null; quantity_in_stock: number | null; active: boolean | null; category_id: string | null }
interface Depot { id: string; code: string; name: string; warehouse_type: string; site_id: string | null; active: boolean | null }
interface Mouvement { id: string; movement_number: string; movement_date: string; movement_type: TypeMouvementStock; stock_item_id: string; quantity: number; from_warehouse_id: string | null; to_warehouse_id: string | null; reference_piece: string | null; motif: string | null; notes: string | null; annule_mouvement_id: string | null }
interface Ligne { stock_item_id: string; warehouse_id: string; quantite: number }
interface Lib { id: string; libelle: string }

const CHAMP = 'mt-1 w-full rounded border border-stone-300 px-3 py-2';
const TYPES_DEPOT: Record<string, string> = { main: 'Magasin principal', garage: 'Atelier', fuel_station: 'Station', depot: 'Dépôt' };
const entier = (v: string) => (v.trim() === '' ? null : Number.parseInt(v.replace(/\s/g, ''), 10));
const maintenantLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

type Formulaire = '' | 'article' | 'depot' | 'entry' | 'exit' | 'transfer' | 'return' | 'inventaire';

export const StockView = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('stock', 'create') || hasPermission('stock', 'edit');
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [sites, setSites] = useState<Lib[]>([]);
  const [recherche, setRecherche] = useState('');
  const [formulaire, setFormulaire] = useState<Formulaire>('');
  const [champs, setChamps] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const [a, d, l, m, s] = await Promise.all([
      supabase.from('stock_items').select('id, item_code, name, unit_of_measure, unit_price, minimum_threshold, quantity_in_stock, active, category_id').order('item_code'),
      supabase.from('warehouses').select('id, code, name, warehouse_type, site_id, active').order('code'),
      supabase.from('v_stock_depots').select('stock_item_id, warehouse_id, quantite'),
      supabase.from('stock_movements').select('id, movement_number, movement_date, movement_type, stock_item_id, quantity, from_warehouse_id, to_warehouse_id, reference_piece, motif, notes, annule_mouvement_id')
        .order('movement_date', { ascending: false }).limit(300),
      supabase.from('sites').select('id, name').order('name'),
    ]);
    setErreur(a.error?.message ?? d.error?.message ?? l.error?.message ?? m.error?.message ?? '');
    setArticles((a.data ?? []) as Article[]);
    setDepots((d.data ?? []) as Depot[]);
    setLignes((l.data ?? []) as Ligne[]);
    setMouvements((m.data ?? []) as Mouvement[]);
    setSites((s.data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string })));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const article = useMemo(() => new Map((articles ?? []).map((a) => [a.id, a])), [articles]);
  const depot = useMemo(() => new Map(depots.map((d) => [d.id, d])), [depots]);
  const nomSite = useMemo(() => new Map(sites.map((s) => [s.id, s.libelle])), [sites]);
  const actifs = depots.filter((d) => d.active !== false);
  const annules = new Set(mouvements.map((m) => m.annule_mouvement_id).filter(Boolean));
  const filtres = (articles ?? []).filter((a) => !recherche || `${a.item_code} ${a.name}`.toLowerCase().includes(recherche.toLowerCase()));
  const parDepot = (articleId: string) => lignes.filter((l) => l.stock_item_id === articleId && Number(l.quantite) !== 0);

  const ouvrir = (f: Formulaire, initial: Record<string, string> = {}) => { setFormulaire(f); setChamps({ quand: maintenantLocal(), ...initial }); setErreur(''); setMessage(''); };
  const c = (k: string) => champs[k] ?? '';
  const poser = (k: string, v: string) => setChamps({ ...champs, [k]: v });
  const executer = async (action: () => PromiseLike<{ error: { message: string } | null }>, succes: string) => {
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await action();
    setBusy(false);
    if (error) { setErreur(error.message); return; }
    setMessage(succes); setFormulaire(''); await charger();
  };

  const soumettre = () => {
    if (formulaire === 'article') {
      const valeurs = { item_code: c('code').trim(), name: c('nom').trim(), unit_of_measure: c('unite').trim() || 'piece',
        unit_price: c('prix') ? entier(c('prix')) : null, minimum_threshold: c('seuil') ? entier(c('seuil')) : 0 };
      return executer(() => c('id') ? supabase.from('stock_items').update(valeurs).eq('id', c('id')) : supabase.from('stock_items').insert(valeurs),
        c('id') ? 'Article modifié.' : 'Article créé. Son stock se constitue par une entrée ou un inventaire.');
    }
    if (formulaire === 'depot') {
      return executer(() => supabase.from('warehouses').insert({ code: c('code').trim(), name: c('nom').trim(), warehouse_type: c('type') || 'main', site_id: c('site') || null }), 'Dépôt créé.');
    }
    if (formulaire === 'inventaire') {
      return executer(() => supabase.rpc('inventorier_stock', { p_article: c('article'), p_depot: c('depot'), p_quantite_comptee: entier(c('compte')), p_motif: c('motif').trim() || null }),
        'Inventaire enregistré : l\'écart éventuel est passé en ajustement.');
    }
    return executer(() => supabase.rpc('mouvement_stock', {
      p_article: c('article'), p_type: formulaire, p_quantite: entier(c('quantite')),
      p_depot_source: ['exit', 'transfer'].includes(formulaire) ? c('source') : null,
      p_depot_destination: ['entry', 'return', 'transfer'].includes(formulaire) ? c('destination') : null,
      p_date: new Date(c('quand')).toISOString(), p_prix_unitaire: c('prix') ? entier(c('prix')) : null,
      p_reference: c('piece').trim() || null, p_vehicle_id: null, p_ordre_maintenance: null, p_note: c('note').trim() || null,
    }), `${LIBELLE_MOUVEMENT_STOCK[formulaire as TypeMouvementStock]} enregistrée.`);
  };
  const annuler = (m: Mouvement) => {
    const motif = window.prompt(`Motif de l'annulation de ${m.movement_number} (un contre-mouvement sera créé)`);
    if (!motif?.trim()) return;
    executer(() => supabase.rpc('annuler_mouvement_stock', { p_id: m.id, p_motif: motif }), 'Mouvement annulé.');
  };
  const archiver = (a: Article) => {
    if (!window.confirm(`Archiver l'article ${a.item_code} ? Son historique reste consultable.`)) return;
    executer(() => supabase.from('stock_items').update({ active: false }).eq('id', a.id), 'Article archivé.');
  };
  const exporter = () => exportToCSV(mouvements.map((m) => ({
    numero: m.movement_number, date: m.movement_date, type: LIBELLE_MOUVEMENT_STOCK[m.movement_type], article: article.get(m.stock_item_id)?.item_code ?? '',
    quantite: m.quantity, depuis: depot.get(m.from_warehouse_id ?? '')?.code ?? '', vers: depot.get(m.to_warehouse_id ?? '')?.code ?? '',
    piece: m.reference_piece ?? '', motif: m.motif ?? '',
  })), 'registre-stocks');

  const qte = entier(c('quantite'));
  const pret = formulaire === 'article' ? c('code').trim() && c('nom').trim()
    : formulaire === 'depot' ? c('code').trim() && c('nom').trim()
    : formulaire === 'inventaire' ? c('article') && c('depot') && entier(c('compte')) !== null
    : formulaire ? c('article') && qte !== null && qte > 0 && (!['exit', 'transfer'].includes(formulaire) || c('source')) && (!['entry', 'return', 'transfer'].includes(formulaire) || c('destination')) : false;
  const selectArticle = <label className="text-sm">Article *<select value={c('article')} onChange={(e) => poser('article', e.target.value)} className={CHAMP}>
    <option value="">Choisir</option>{(articles ?? []).filter((a) => a.active !== false).map((a) => <option key={a.id} value={a.id}>{a.item_code} · {a.name}</option>)}</select></label>;
  const selectDepot = (cle: string, libelle: string) => <label className="text-sm">{libelle} *<select value={c(cle)} onChange={(e) => poser(cle, e.target.value)} className={CHAMP}>
    <option value="">Choisir</option>{actifs.map((d) => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}</select></label>;

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Stocks magasin</h2>
        <p className="text-sm text-stone-500">Quantités calculées depuis les mouvements. Aucune quantité ne se saisit ni ne se modifie.</p></div>
      <div className="flex flex-wrap gap-2">
        {peutEcrire && <>
          <button onClick={() => ouvrir('entry')} className="flex items-center gap-2 rounded-lg bg-orange-700 px-3 py-2 text-sm font-bold text-white"><PackagePlus className="h-4 w-4" /> Entrée</button>
          <button onClick={() => ouvrir('exit')} className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"><PackageMinus className="h-4 w-4" /> Sortie</button>
          <button onClick={() => ouvrir('transfer')} className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"><ArrowRightLeft className="h-4 w-4" /> Transfert</button>
          <button onClick={() => ouvrir('return')} className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"><Undo2 className="h-4 w-4" /> Retour</button>
          <button onClick={() => ouvrir('inventaire')} className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"><ClipboardCheck className="h-4 w-4" /> Inventaire</button>
          <button onClick={() => ouvrir('article', { unite: 'piece' })} className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"><Plus className="h-4 w-4" /> Article</button>
          <button onClick={() => ouvrir('depot', { type: 'main' })} className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"><Warehouse className="h-4 w-4" /> Dépôt</button>
        </>}
        <button onClick={charger} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
      </div>
    </header>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}

    {formulaire && <Panneau titre={formulaire === 'article' ? (c('id') ? 'Modifier l\'article' : 'Nouvel article') : formulaire === 'depot' ? 'Nouveau dépôt' : formulaire === 'inventaire' ? 'Inventaire (comptage)' : LIBELLE_MOUVEMENT_STOCK[formulaire]}>
      <div role="form" aria-label="Saisie stock" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {formulaire === 'article' && <>
          <label className="text-sm">Code *<input value={c('code')} onChange={(e) => poser('code', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Désignation *<input value={c('nom')} onChange={(e) => poser('nom', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Unité<input value={c('unite')} onChange={(e) => poser('unite', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Prix unitaire de référence (GNF)<input inputMode="numeric" value={c('prix')} onChange={(e) => poser('prix', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Seuil minimum<input inputMode="numeric" value={c('seuil')} onChange={(e) => poser('seuil', e.target.value)} className={CHAMP} /></label>
        </>}
        {formulaire === 'depot' && <>
          <label className="text-sm">Code *<input value={c('code')} onChange={(e) => poser('code', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Nom *<input value={c('nom')} onChange={(e) => poser('nom', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Type<select value={c('type')} onChange={(e) => poser('type', e.target.value)} className={CHAMP}>{Object.entries(TYPES_DEPOT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="text-sm">Site<select value={c('site')} onChange={(e) => poser('site', e.target.value)} className={CHAMP}><option value="">Tous sites</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}</select></label>
        </>}
        {formulaire === 'inventaire' && <>
          {selectArticle}{selectDepot('depot', 'Dépôt')}
          <label className="text-sm">Quantité comptée *<input inputMode="numeric" value={c('compte')} onChange={(e) => poser('compte', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm sm:col-span-2">Motif (obligatoire en cas d'écart)<input value={c('motif')} onChange={(e) => poser('motif', e.target.value)} className={CHAMP} /></label>
        </>}
        {['entry', 'exit', 'transfer', 'return'].includes(formulaire) && <>
          {selectArticle}
          {['exit', 'transfer'].includes(formulaire) && selectDepot('source', 'Depuis')}
          {['entry', 'return', 'transfer'].includes(formulaire) && selectDepot('destination', 'Vers')}
          <label className="text-sm">Quantité *<input inputMode="numeric" value={c('quantite')} onChange={(e) => poser('quantite', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Date et heure *<input type="datetime-local" value={c('quand')} onChange={(e) => poser('quand', e.target.value)} className={CHAMP} /></label>
          {formulaire === 'entry' && <label className="text-sm">Prix unitaire du bon (GNF)<input inputMode="numeric" value={c('prix')} onChange={(e) => poser('prix', e.target.value)} className={CHAMP} /></label>}
          <label className="text-sm">Pièce (bon, ordre de travail)<input value={c('piece')} onChange={(e) => poser('piece', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Note<input value={c('note')} onChange={(e) => poser('note', e.target.value)} className={CHAMP} /></label>
        </>}
      </div>
      <div className="mt-3 flex gap-2">
        <button disabled={busy || !pret} onClick={soumettre} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer</button>
        <button onClick={() => setFormulaire('')} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Annuler</button>
      </div>
    </Panneau>}

    <Panneau titre={`Articles (${articles?.length ?? 0})`}>
      <input aria-label="Rechercher un article" placeholder="Rechercher (code, désignation)" value={recherche} onChange={(e) => setRecherche(e.target.value)} className="mb-3 w-full max-w-sm rounded border border-stone-300 px-3 py-2 text-sm" />
      {articles === null ? <p>Chargement…</p> : filtres.length === 0 ? <SansDonnees message="Aucun article" detail="Créez les articles, puis constituez leur stock par une entrée ou un inventaire." /> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500">
          <th className="py-2 pr-3">Code</th><th className="py-2 pr-3">Désignation</th><th className="py-2 pr-3 text-right">En stock</th><th className="py-2 pr-3">Par dépôt</th><th className="py-2 pr-3 text-right">Seuil</th><th className="py-2 pr-3">Alerte</th><th /></tr></thead>
          <tbody>{filtres.map((a) => { const al = alerteArticle(a); return <tr key={a.id} className={`border-b border-stone-100 ${a.active === false ? 'text-stone-400' : ''}`}>
            <td className="py-2 pr-3 font-mono">{a.item_code}</td><td className="py-2 pr-3">{a.name}</td>
            <td className="py-2 pr-3 text-right font-semibold">{formatNombre(Number(a.quantity_in_stock ?? 0), 0)} {a.unit_of_measure}</td>
            <td className="py-2 pr-3 text-xs">{parDepot(a.id).map((l) => `${depot.get(l.warehouse_id)?.code ?? '?'} ${l.quantite}`).join(' · ') || '—'}</td>
            <td className="py-2 pr-3 text-right">{a.minimum_threshold ?? '—'}</td>
            <td className="py-2 pr-3">{al && <Puce teinte={al.teinte}>{al.texte}</Puce>}</td>
            <td className="py-2">{peutEcrire && a.active !== false && <span className="flex gap-1">
              <button onClick={() => ouvrir('article', { id: a.id, code: a.item_code, nom: a.name, unite: a.unit_of_measure, prix: a.unit_price?.toString() ?? '', seuil: a.minimum_threshold?.toString() ?? '' })} className="rounded border border-stone-300 px-2 py-1 text-xs">Modifier</button>
              <button onClick={() => archiver(a)} aria-label={`Archiver ${a.item_code}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Archiver</button></span>}</td>
          </tr>; })}</tbody></table></div>}
    </Panneau>

    <Panneau titre={`Dépôts (${depots.length})`}>
      {depots.length === 0 ? <SansDonnees message="Aucun dépôt" /> :
        <ul className="divide-y divide-stone-100 text-sm">{depots.map((d) => <li key={d.id} className="py-2"><span className="font-mono font-semibold">{d.code}</span> {d.name} · {TYPES_DEPOT[d.warehouse_type] ?? d.warehouse_type} · {d.site_id ? nomSite.get(d.site_id) ?? '?' : 'tous sites'}{d.active === false ? ' · inactif' : ''}</li>)}</ul>}
    </Panneau>

    <Panneau titre="Registre des mouvements">
      <button onClick={exporter} className="mb-3 flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"><Download className="h-4 w-4" /> Exporter CSV</button>
      {mouvements.length === 0 ? <SansDonnees message="Aucun mouvement" /> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500">
          <th className="py-2 pr-3">N°</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Article</th><th className="py-2 pr-3 text-right">Quantité</th>
          <th className="py-2 pr-3">Depuis → vers</th><th className="py-2 pr-3">Pièce / motif</th><th /></tr></thead>
          <tbody>{mouvements.map((m) => <tr key={m.id} className="border-b border-stone-100">
            <td className="py-2 pr-3 font-mono text-xs">{m.movement_number}</td><td className="py-2 pr-3">{new Date(m.movement_date).toLocaleString('fr-FR')}</td>
            <td className="py-2 pr-3">{LIBELLE_MOUVEMENT_STOCK[m.movement_type]}</td><td className="py-2 pr-3">{article.get(m.stock_item_id)?.item_code ?? '—'}</td>
            <td className="py-2 pr-3 text-right font-semibold">{m.quantity}</td>
            <td className="py-2 pr-3 text-xs">{depot.get(m.from_warehouse_id ?? '')?.code ?? '—'} → {depot.get(m.to_warehouse_id ?? '')?.code ?? '—'}</td>
            <td className="py-2 pr-3 text-xs">{[m.reference_piece, m.motif].filter(Boolean).join(' · ') || '—'}</td>
            <td className="py-2">{peutEcrire && m.movement_type !== 'annulation' && !annules.has(m.id) &&
              <button onClick={() => annuler(m)} aria-label={`Annuler ${m.movement_number}`} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs"><Undo2 className="h-3 w-3" /> Annuler</button>}</td>
          </tr>)}</tbody></table></div>}
    </Panneau>
  </div>;
};
