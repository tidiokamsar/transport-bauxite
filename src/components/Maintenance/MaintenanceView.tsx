import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, Download, PackageMinus, Play, Plus, RefreshCw, Undo2, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { exportToCSV } from '../../lib/exports';
import { formatNombre } from '../Dashboard/indicateurs';
import { Panneau, Puce, SansDonnees, type TeintePuce } from '../ui/Panneau';
import { PRIORITES_ORDRE, STATUTS_ORDRE, TYPES_ORDRE, coutPieces, type PieceOrdre } from './ordres';

// Ordres de travail (D-061). Numero attribue par le serveur ; une erreur ne
// se supprime pas : l'ordre s'annule avec un motif (annuler_ordre_travail).
// Les pieces sortent du registre des stocks (D-044) par mouvement_stock,
// rattachees a l'ordre : plus de second inventaire de pieces.

interface Ordre {
  id: string; work_order_number: string | null; title: string | null; description: string; maintenance_type: string; priority: string | null;
  status: string; vehicle_id: string | null; site_id: string | null; scheduled_date: string | null; request_date: string | null;
  started_at: string | null; completion_date: string | null; km_at_maintenance: number | null; labor_hours: number | null;
  labor_cost: number | null; estimated_cost: number | null; actual_cost: number | null; workshop: string | null; notes: string | null;
  annule_le: string | null; motif_annulation: string | null;
}
interface Engin { id: string; registration: string; brand_model: string }
interface Lib { id: string; libelle: string }
interface Article { id: string; item_code: string; name: string; unit_of_measure: string; unit_price: number | null }
interface Depot { id: string; code: string; name: string }

const CHAMP = 'mt-1 w-full rounded border border-stone-300 px-3 py-2';
const TEINTE_STATUT: Record<string, TeintePuce> = { open: 'bleu', in_progress: 'orange', completed: 'vert', cancelled: 'gris' };
const nombre = (v: string) => (v.trim() === '' ? null : Number(v.replace(/\s/g, '').replace(',', '.')));
const entier = (v: string) => (v.trim() === '' ? null : Number.parseInt(v.replace(/\s/g, ''), 10));
const COLONNES = 'id, work_order_number, title, description, maintenance_type, priority, status, vehicle_id, site_id, scheduled_date, request_date, started_at, completion_date, km_at_maintenance, labor_hours, labor_cost, estimated_cost, actual_cost, workshop, notes, annule_le, motif_annulation';

export const MaintenanceView = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('maintenance', 'create') || hasPermission('maintenance', 'edit');
  const peutStock = hasPermission('stock', 'create') || hasPermission('stock', 'edit');
  const [ordres, setOrdres] = useState<Ordre[] | null>(null);
  const [engins, setEngins] = useState<Engin[]>([]);
  const [sites, setSites] = useState<Lib[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');
  const [champs, setChamps] = useState<Record<string, string> | null>(null);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [pieces, setPieces] = useState<PieceOrdre[] | null>(null);
  const [erreurPieces, setErreurPieces] = useState('');
  const [saisiePiece, setSaisiePiece] = useState<Record<string, string> | null>(null);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const [o, e, s] = await Promise.all([
      supabase.from('maintenance_orders').select(COLONNES).order('request_date', { ascending: false }).limit(500),
      supabase.from('vehicles').select('id, registration, brand_model').order('registration'),
      supabase.from('sites').select('id, name').order('name'),
    ]);
    setErreur(o.error?.message ?? e.error?.message ?? '');
    setOrdres((o.data ?? []) as Ordre[]);
    setEngins((e.data ?? []) as Engin[]);
    setSites((s.data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string })));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const chargerPieces = useCallback(async (id: string) => {
    setPieces(null); setErreurPieces('');
    const { data, error } = await supabase.rpc('pieces_ordre_travail', { p_ordre: id });
    if (error) { setErreurPieces(error.message); setPieces([]); return; }
    setPieces((data ?? []) as PieceOrdre[]);
  }, []);
  useEffect(() => { if (choisi) chargerPieces(choisi); }, [choisi, chargerPieces]);
  useEffect(() => {
    if (!peutStock) return;
    Promise.all([
      supabase.from('stock_items').select('id, item_code, name, unit_of_measure, unit_price, active').order('item_code'),
      supabase.from('warehouses').select('id, code, name, active').order('code'),
    ]).then(([a, d]) => {
      setArticles(((a.data ?? []) as (Article & { active: boolean | null })[]).filter((x) => x.active !== false));
      setDepots(((d.data ?? []) as (Depot & { active: boolean | null })[]).filter((x) => x.active !== false));
    });
  }, [peutStock]);

  const engin = useMemo(() => new Map(engins.map((x) => [x.id, x])), [engins]);
  const nomSite = useMemo(() => new Map(sites.map((x) => [x.id, x.libelle])), [sites]);
  const filtres = (ordres ?? []).filter((o) => (!filtreStatut || o.status === filtreStatut)
    && (!recherche || `${o.work_order_number ?? ''} ${o.title ?? ''} ${engin.get(o.vehicle_id ?? '')?.registration ?? ''}`.toLowerCase().includes(recherche.toLowerCase())));
  const ordreChoisi = (ordres ?? []).find((o) => o.id === choisi) ?? null;
  const compte = (s: string) => (ordres ?? []).filter((o) => o.status === s).length;

  const executer = async (action: () => PromiseLike<{ error: { message: string } | null }>, succes: string, apres?: () => void) => {
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await action();
    setBusy(false);
    if (error) { setErreur(error.message); return false; }
    setMessage(succes); apres?.(); await charger();
    return true;
  };

  const c = (k: string) => champs?.[k] ?? '';
  const poser = (k: string, v: string) => setChamps({ ...(champs ?? {}), [k]: v });
  const ouvrir = (o?: Ordre) => {
    setErreur(''); setMessage('');
    setChamps(o ? {
      id: o.id, numero: o.work_order_number ?? '', engin: o.vehicle_id ?? '', titre: o.title ?? '', description: o.description, type: o.maintenance_type,
      priorite: o.priority ?? '', atelier: o.workshop ?? '', site: o.site_id ?? '', prevue: o.scheduled_date ?? '', km: o.km_at_maintenance?.toString() ?? '',
      heures: o.labor_hours?.toString() ?? '', mo: o.labor_cost?.toString() ?? '', estime: o.estimated_cost?.toString() ?? '', reel: o.actual_cost?.toString() ?? '',
      notes: o.notes ?? '',
    } : { type: '', priorite: 'medium', atelier: 'internal' });
  };
  const enregistrer = () => {
    const valeurs = {
      vehicle_id: c('engin'), title: c('titre').trim(), description: c('description').trim() || c('titre').trim(), maintenance_type: c('type'),
      priority: c('priorite') || null, workshop: c('atelier') || null, site_id: c('site') || null, scheduled_date: c('prevue') || null,
      km_at_maintenance: nombre(c('km')), labor_hours: nombre(c('heures')), labor_cost: nombre(c('mo')), estimated_cost: nombre(c('estime')),
      actual_cost: nombre(c('reel')), notes: c('notes').trim() || null,
    };
    return executer(() => c('id')
      ? supabase.from('maintenance_orders').update({ ...valeurs, updated_at: new Date().toISOString() }).eq('id', c('id'))
      : supabase.from('maintenance_orders').insert({ ...valeurs, status: 'open', request_date: new Date().toISOString().slice(0, 10) }),
    c('id') ? 'Ordre modifié.' : 'Ordre créé : son numéro est attribué par le serveur.', () => setChamps(null));
  };
  const demarrer = (o: Ordre) => executer(() => supabase.from('maintenance_orders').update({ status: 'in_progress', started_at: new Date().toISOString() }).eq('id', o.id), 'Ordre démarré.');
  const terminer = (o: Ordre) => {
    if (!window.confirm(`Terminer l'ordre ${o.work_order_number} ? Un ordre terminé ne se rouvre pas et ne reçoit plus de pièces.`)) return;
    executer(() => supabase.from('maintenance_orders').update({ status: 'completed', completion_date: new Date().toISOString().slice(0, 10) }).eq('id', o.id), 'Ordre terminé.');
  };
  const annuler = (o: Ordre) => {
    const motif = window.prompt(`Motif de l'annulation de l'ordre ${o.work_order_number} (il restera consultable)`);
    if (!motif?.trim()) return;
    executer(() => supabase.rpc('annuler_ordre_travail', { p_id: o.id, p_motif: motif }), 'Ordre annulé.');
  };

  const sp = (k: string) => saisiePiece?.[k] ?? '';
  const mouvementPiece = async () => {
    if (!ordreChoisi || !saisiePiece) return;
    const a = articles.find((x) => x.id === sp('article'));
    const sortie = sp('type') === 'exit';
    const ok = await executer(() => supabase.rpc('mouvement_stock', {
      p_article: sp('article'), p_type: sp('type'), p_quantite: entier(sp('quantite')),
      p_depot_source: sortie ? sp('depot') : null, p_depot_destination: sortie ? null : sp('depot'),
      p_date: new Date().toISOString(), p_prix_unitaire: sortie && a?.unit_price !== null && a?.unit_price !== undefined ? a.unit_price : null,
      p_reference: null, p_vehicle_id: ordreChoisi.vehicle_id, p_ordre_maintenance: ordreChoisi.id, p_note: sp('note').trim() || null,
    }), sortie ? 'Pièce sortie du stock pour l\'ordre.' : 'Pièce retournée au stock.', () => setSaisiePiece(null));
    if (ok) chargerPieces(ordreChoisi.id);
  };
  const annulerMouvement = async (p: PieceOrdre) => {
    const motif = window.prompt(`Motif de l'annulation du mouvement ${p.numero} (un contre-mouvement sera créé)`);
    if (!motif?.trim() || !ordreChoisi) return;
    const ok = await executer(() => supabase.rpc('annuler_mouvement_stock', { p_id: p.mouvement_id, p_motif: motif }), 'Mouvement annulé.');
    if (ok) chargerPieces(ordreChoisi.id);
  };
  const exporter = () => exportToCSV(filtres.map((o) => ({
    numero: o.work_order_number ?? '', titre: o.title ?? '', type: TYPES_ORDRE[o.maintenance_type] ?? o.maintenance_type, statut: STATUTS_ORDRE[o.status] ?? o.status,
    engin: engin.get(o.vehicle_id ?? '')?.registration ?? '', demande: o.request_date ?? '', prevue: o.scheduled_date ?? '', termine: o.completion_date ?? '',
    cout_estime: o.estimated_cost ?? '', cout_reel: o.actual_cost ?? '', motif_annulation: o.motif_annulation ?? '',
  })), 'ordres-de-travail');

  const pret = champs && c('engin') && c('titre').trim() && c('type');
  const cout = pieces ? coutPieces(pieces) : null;
  const ouvertAuxPieces = ordreChoisi && ['open', 'in_progress'].includes(ordreChoisi.status);
  const pretPiece = saisiePiece && sp('article') && sp('depot') && (entier(sp('quantite')) ?? 0) > 0;

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Ordres de travail</h2>
        <p className="text-sm text-stone-500">Numéro attribué par le serveur ; un ordre s'annule avec un motif, il ne se supprime pas. Les pièces sortent du registre des stocks.</p></div>
      <div className="flex flex-wrap gap-2">
        {peutEcrire && <button onClick={() => ouvrir()} className="flex items-center gap-2 rounded-lg bg-orange-700 px-3 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Nouvel ordre de travail</button>}
        <button onClick={exporter} className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"><Download className="h-4 w-4" /> Exporter CSV</button>
        <button onClick={charger} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
      </div>
    </header>
    <p className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">Les engins loués relèvent de Neemba (D-022, D-025) : leurs pannes se suivent dans Immobilisations et Interventions Neemba.</p>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}

    <div className="grid gap-3 sm:grid-cols-4">
      {[['Ouverts', compte('open')], ['En cours', compte('in_progress')], ['Terminés', compte('completed')], ['Annulés', compte('cancelled')]].map(([l, v]) => (
        <div key={l as string} className="rounded-2xl border border-stone-200 bg-white p-4"><p className="text-xs text-stone-500">{l}</p><p className="text-2xl font-black">{ordres === null ? '—' : v}</p></div>
      ))}
    </div>

    {champs && <Panneau titre={c('id') ? `Modifier l'ordre ${c('numero')}` : 'Nouvel ordre de travail'}>
      <div role="form" aria-label="Ordre de travail" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {!c('id') && <p className="text-sm text-stone-500 sm:col-span-2 xl:col-span-3">Numéro : attribué à l'enregistrement.</p>}
        <label className="text-sm">Engin *<select value={c('engin')} onChange={(e) => poser('engin', e.target.value)} className={CHAMP}>
          <option value="">Choisir</option>{engins.map((e) => <option key={e.id} value={e.id}>{e.registration} · {e.brand_model}</option>)}</select></label>
        <label className="text-sm">Intitulé *<input value={c('titre')} onChange={(e) => poser('titre', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Type *<select value={c('type')} onChange={(e) => poser('type', e.target.value)} className={CHAMP}>
          <option value="">Choisir</option>{Object.entries(TYPES_ORDRE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="text-sm">Priorité<select value={c('priorite')} onChange={(e) => poser('priorite', e.target.value)} className={CHAMP}>
          {Object.entries(PRIORITES_ORDRE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="text-sm">Atelier<select value={c('atelier')} onChange={(e) => poser('atelier', e.target.value)} className={CHAMP}>
          <option value="internal">Interne</option><option value="external">Externe</option></select></label>
        <label className="text-sm">Site<select value={c('site')} onChange={(e) => poser('site', e.target.value)} className={CHAMP}>
          <option value="">Site de l'engin</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}</select></label>
        <label className="text-sm">Date prévue<input type="date" value={c('prevue')} onChange={(e) => poser('prevue', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Compteur (km)<input inputMode="numeric" value={c('km')} onChange={(e) => poser('km', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Heures de main d'œuvre<input inputMode="decimal" value={c('heures')} onChange={(e) => poser('heures', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Coût main d'œuvre (GNF)<input inputMode="numeric" value={c('mo')} onChange={(e) => poser('mo', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Coût estimé (GNF)<input inputMode="numeric" value={c('estime')} onChange={(e) => poser('estime', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Coût réel constaté (GNF)<input inputMode="numeric" value={c('reel')} onChange={(e) => poser('reel', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm sm:col-span-2 xl:col-span-3">Description<input value={c('description')} onChange={(e) => poser('description', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm sm:col-span-2 xl:col-span-3">Notes<input value={c('notes')} onChange={(e) => poser('notes', e.target.value)} className={CHAMP} /></label>
      </div>
      <div className="mt-3 flex gap-2">
        <button disabled={busy || !pret} onClick={enregistrer} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer</button>
        <button onClick={() => setChamps(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Fermer</button>
      </div>
    </Panneau>}

    <Panneau titre={`Ordres (${filtres.length})`}>
      <div className="mb-3 flex flex-wrap gap-3">
        <input aria-label="Rechercher un ordre" placeholder="Rechercher (numéro, intitulé, engin)" value={recherche} onChange={(e) => setRecherche(e.target.value)} className="w-full max-w-sm rounded border border-stone-300 px-3 py-2 text-sm" />
        <select aria-label="Filtrer par statut" value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} className="rounded border border-stone-300 px-3 py-2 text-sm">
          <option value="">Tous les statuts</option>{Object.entries(STATUTS_ORDRE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      {ordres === null ? <p>Chargement…</p> : filtres.length === 0 ? <SansDonnees message="Aucun ordre de travail" /> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500">
          <th className="py-2 pr-3">N°</th><th className="py-2 pr-3">Intitulé</th><th className="py-2 pr-3">Engin</th><th className="py-2 pr-3">Type</th>
          <th className="py-2 pr-3">Statut</th><th className="py-2 pr-3">Prévue</th><th className="py-2 pr-3 text-right">Coût réel</th><th /></tr></thead>
          <tbody>{filtres.map((o) => <tr key={o.id} className={`border-b border-stone-100 ${o.id === choisi ? 'bg-orange-50/60' : ''}`}>
            <td className="py-2 pr-3 font-mono text-xs">{o.work_order_number ?? '—'}</td>
            <td className="py-2 pr-3">{o.title ?? o.description}{o.status === 'cancelled' && o.motif_annulation && <span className="block text-xs text-stone-500">Annulé : {o.motif_annulation}</span>}</td>
            <td className="py-2 pr-3">{engin.get(o.vehicle_id ?? '')?.registration ?? '—'}{o.site_id && <span className="block text-xs text-stone-500">{nomSite.get(o.site_id)}</span>}</td>
            <td className="py-2 pr-3">{TYPES_ORDRE[o.maintenance_type] ?? o.maintenance_type}</td>
            <td className="py-2 pr-3"><Puce teinte={TEINTE_STATUT[o.status] ?? 'gris'}>{STATUTS_ORDRE[o.status] ?? o.status}</Puce></td>
            <td className="py-2 pr-3">{o.scheduled_date ? new Date(`${o.scheduled_date}T00:00:00`).toLocaleDateString('fr-FR') : '—'}</td>
            <td className="py-2 pr-3 text-right">{o.actual_cost !== null ? formatNombre(Number(o.actual_cost), 0) : '—'}</td>
            <td className="py-2"><span className="flex flex-wrap gap-1">
              <button onClick={() => setChoisi(o.id === choisi ? null : o.id)} aria-label={`Pièces de ${o.work_order_number}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Pièces</button>
              {peutEcrire && ['open', 'in_progress'].includes(o.status) && <>
                <button onClick={() => ouvrir(o)} aria-label={`Modifier ${o.work_order_number}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Modifier</button>
                {o.status === 'open' && <button onClick={() => demarrer(o)} aria-label={`Démarrer ${o.work_order_number}`} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs"><Play className="h-3 w-3" /> Démarrer</button>}
                {o.status === 'in_progress' && <button onClick={() => terminer(o)} aria-label={`Terminer ${o.work_order_number}`} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs"><CheckCircle className="h-3 w-3" /> Terminer</button>}
                <button onClick={() => annuler(o)} aria-label={`Annuler ${o.work_order_number}`} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs"><XCircle className="h-3 w-3" /> Annuler</button>
              </>}
              {peutEcrire && o.status === 'completed' && <button onClick={() => ouvrir(o)} aria-label={`Modifier ${o.work_order_number}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Modifier</button>}
            </span></td>
          </tr>)}</tbody></table></div>}
    </Panneau>

    {ordreChoisi && <Panneau titre={`Pièces de l'ordre ${ordreChoisi.work_order_number ?? ''}`}
      action={peutStock && ouvertAuxPieces ? <span className="flex gap-2">
        <button onClick={() => setSaisiePiece({ type: 'exit' })} className="flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm"><PackageMinus className="h-4 w-4" /> Sortir du stock</button>
        <button onClick={() => setSaisiePiece({ type: 'return' })} className="flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm"><Undo2 className="h-4 w-4" /> Retour au stock</button>
      </span> : undefined}>
      {!peutStock && <p className="mb-2 text-xs text-stone-500">La sortie de pièces demande le droit d'écriture sur les stocks (magasin).</p>}
      {!ouvertAuxPieces && <p className="mb-2 text-xs text-stone-500">Ordre terminé ou annulé : aucune pièce ne s'y impute plus.</p>}
      {saisiePiece && <div role="form" aria-label="Mouvement de pièce" className="mb-3 grid gap-3 rounded-lg border border-stone-200 p-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm">Article *<select value={sp('article')} onChange={(e) => setSaisiePiece({ ...saisiePiece, article: e.target.value })} className={CHAMP}>
          <option value="">Choisir</option>{articles.map((a) => <option key={a.id} value={a.id}>{a.item_code} · {a.name}</option>)}</select></label>
        <label className="text-sm">{sp('type') === 'exit' ? 'Depuis le dépôt *' : 'Vers le dépôt *'}<select value={sp('depot')} onChange={(e) => setSaisiePiece({ ...saisiePiece, depot: e.target.value })} className={CHAMP}>
          <option value="">Choisir</option>{depots.map((d) => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}</select></label>
        <label className="text-sm">Quantité *<input inputMode="numeric" value={sp('quantite')} onChange={(e) => setSaisiePiece({ ...saisiePiece, quantite: e.target.value })} className={CHAMP} /></label>
        <label className="text-sm">Note<input value={sp('note')} onChange={(e) => setSaisiePiece({ ...saisiePiece, note: e.target.value })} className={CHAMP} /></label>
        <p className="text-xs text-stone-500 sm:col-span-2 xl:col-span-4">{sp('type') === 'exit' ? 'Sortie valorisée au prix de référence de l\'article s\'il est renseigné ; refusée au-delà du stock disponible du dépôt.' : 'Retour limité aux pièces déjà sorties pour cet ordre.'}</p>
        <div className="flex gap-2 sm:col-span-2 xl:col-span-4">
          <button disabled={busy || !pretPiece} onClick={mouvementPiece} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer</button>
          <button onClick={() => setSaisiePiece(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Fermer</button>
        </div>
      </div>}
      {erreurPieces && <p role="alert" className="mb-2 rounded bg-red-50 p-2 text-sm text-red-700">{erreurPieces}</p>}
      {pieces === null ? <p>Chargement…</p> : pieces.length === 0 ? <SansDonnees message="Aucune pièce imputée" detail="Les pièces se sortent du registre des stocks, rattachées à l'ordre." /> : <>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500">
          <th className="py-2 pr-3">Mouvement</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Article</th>
          <th className="py-2 pr-3 text-right">Quantité</th><th className="py-2 pr-3">Dépôt</th><th className="py-2 pr-3 text-right">Valeur</th><th /></tr></thead>
          <tbody>{pieces.map((p) => <tr key={p.mouvement_id} className={`border-b border-stone-100 ${p.annule ? 'text-stone-400 line-through' : ''}`}>
            <td className="py-2 pr-3 font-mono text-xs">{p.numero}</td><td className="py-2 pr-3">{new Date(p.date_mouvement).toLocaleString('fr-FR')}</td>
            <td className="py-2 pr-3">{p.type_mouvement === 'exit' ? 'Sortie' : 'Retour'}{p.annule ? ' (annulé)' : ''}</td>
            <td className="py-2 pr-3">{p.article_code} · {p.article_nom}</td><td className="py-2 pr-3 text-right">{p.quantite} {p.unite}</td>
            <td className="py-2 pr-3">{p.depot_code ?? '—'}</td><td className="py-2 pr-3 text-right">{p.valeur !== null ? formatNombre(Number(p.valeur), 0) : '—'}</td>
            <td className="py-2">{peutStock && !p.annule && <button onClick={() => annulerMouvement(p)} aria-label={`Annuler ${p.numero}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Annuler</button>}</td>
          </tr>)}</tbody></table></div>
        {cout && <p className="mt-2 text-sm">Coût net des pièces : <strong>{formatNombre(cout.valeur, 0)} GNF</strong>{cout.incomplet && ' (incomplet : au moins un mouvement sans prix)'} · source : registre des stocks.</p>}
      </>}
    </Panneau>}
  </div>;
};
