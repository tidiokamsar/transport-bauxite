import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Check, Download, Gauge, PackagePlus, Plus, RefreshCw, Undo2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { exportToCSV } from '../../lib/exports';
import { formatNombre } from '../Dashboard/indicateurs';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import { alerteStockage, LIBELLE_MOUVEMENT, LIBELLE_TYPE_STOCKAGE, type Stock } from './stocks';

// Registre des mouvements de carburant (D-041) : le stock est la somme des
// mouvements valides. Toute saisie (reception, transfert, inventaire,
// distribution par fiche) attend la decision d'une autre personne ; une
// erreur se corrige par annulation (contre-mouvement), jamais par
// modification ou suppression.

interface Mouvement {
  id: string; numero: number; stockage_id: string; type: keyof typeof LIBELLE_MOUVEMENT; variation: number;
  date_mouvement: string; reference_piece: string | null; statut: 'a_valider' | 'valide' | 'rejete';
  note: string | null; motif_decision: string | null; transfert_id: string | null; annule_mouvement_id: string | null;
}
interface Inventaire {
  id: string; stockage_id: string; date_mesure: string; volume_mesure: number; methode_mesure: string;
  solde_theorique: number | null; ecart: number | null; statut: 'a_valider' | 'valide' | 'rejete'; note: string | null;
}
interface Livraison { id: string; reference: string; date_livraison: string; site_id: string; volume_litres: number }
interface Site { id: string; name: string }

const CHAMP = 'mt-1 w-full rounded border border-stone-300 px-3 py-2';
const METHODES = [['jauge', 'Jauge'], ['pige', 'Pige'], ['compteur', 'Compteur'], ['autre', 'Autre']] as const;
const litres = (x: number | null | undefined) => (x === null || x === undefined ? '—' : `${formatNombre(Number(x), 0)} L`);
const nombre = (v: string) => Number(v.replace(/\s/g, '').replace(',', '.'));
const maintenantLocal = () => {
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const versIso = (local: string) => new Date(local).toISOString();

export const StocksCarburantView = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('fuel', 'create') || hasPermission('fuel', 'edit');
  const [stocks, setStocks] = useState<Stock[] | null>(null);
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [inventaires, setInventaires] = useState<Inventaire[]>([]);
  const [livraisons, setLivraisons] = useState<Livraison[]>([]);
  const [receptionnees, setReceptionnees] = useState<Set<string>>(new Set());
  const [sites, setSites] = useState<Site[]>([]);
  const [filtre, setFiltre] = useState('');
  const [formulaire, setFormulaire] = useState<'' | 'stockage' | 'reception' | 'transfert' | 'inventaire'>('');
  const [champs, setChamps] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const [s, m, i, l, r, si] = await Promise.all([
      supabase.from('v_stocks_carburant').select('*').order('code'),
      supabase.from('mouvements_carburant').select('id, numero, stockage_id, type, variation, date_mouvement, reference_piece, statut, note, motif_decision, transfert_id, annule_mouvement_id')
        .order('numero', { ascending: false }).limit(300),
      supabase.from('inventaires_carburant').select('id, stockage_id, date_mesure, volume_mesure, methode_mesure, solde_theorique, ecart, statut, note')
        .order('date_mesure', { ascending: false }).limit(100),
      supabase.from('livraisons_carburant_cbg').select('id, reference, date_livraison, site_id, volume_litres').order('date_livraison', { ascending: false }).limit(200),
      supabase.from('receptions_carburant').select('livraison_id'),
      supabase.from('sites').select('id, name').order('name'),
    ]);
    setErreur(s.error?.message ?? m.error?.message ?? i.error?.message ?? l.error?.message ?? r.error?.message ?? '');
    setStocks((s.data ?? []) as Stock[]);
    setMouvements((m.data ?? []) as Mouvement[]);
    setInventaires((i.data ?? []) as Inventaire[]);
    setLivraisons((l.data ?? []) as Livraison[]);
    setReceptionnees(new Set((r.data ?? []).map((x) => x.livraison_id as string)));
    setSites((si.data ?? []) as Site[]);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const parId = useMemo(() => new Map((stocks ?? []).map((s) => [s.id, s])), [stocks]);
  const nomSite = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites]);
  const actifs = (stocks ?? []).filter((s) => s.actif);
  const aValider = mouvements.filter((m) => m.statut === 'a_valider');
  const inventairesAValider = inventaires.filter((i) => i.statut === 'a_valider');
  const journal = mouvements.filter((m) => !filtre || m.stockage_id === filtre);
  const dejaAnnules = new Set(mouvements.filter((m) => m.annule_mouvement_id && m.statut !== 'rejete').map((m) => m.annule_mouvement_id));
  const stockageReception = parId.get(champs.stockage ?? '');
  const livraisonsAReceptionner = livraisons.filter((l) => !receptionnees.has(l.id) && (!stockageReception || l.site_id === stockageReception.site_id));

  const ouvrir = (f: typeof formulaire, initial: Record<string, string> = {}) => {
    setFormulaire(f); setChamps({ quand: maintenantLocal(), methode: 'jauge', ...initial }); setErreur(''); setMessage('');
  };
  const champ = (cle: string) => champs[cle] ?? '';
  const poser = (cle: string, v: string) => setChamps({ ...champs, [cle]: v });

  const executer = async (action: () => PromiseLike<{ error: { message: string } | null }>, succes: string) => {
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await action();
    setBusy(false);
    if (error) { setErreur(error.message); return false; }
    setMessage(succes); setFormulaire(''); await charger();
    return true;
  };

  const soumettre = () => {
    if (formulaire === 'stockage') {
      return executer(() => supabase.from('stockages_carburant').insert({
        code: champ('code').trim(), libelle: champ('libelle').trim(), type: champ('type') || 'cuve_fixe', site_id: champ('site'),
        capacite_litres: nombre(champ('capacite')), seuil_alerte_litres: champ('seuil') ? nombre(champ('seuil')) : null,
      }), 'Stockage créé. Saisissez son inventaire d\'ouverture : le stock reste « sans données » jusqu\'à sa validation.');
    }
    if (formulaire === 'reception') {
      return executer(() => supabase.rpc('receptionner_livraison_cbg', {
        p_livraison_id: champ('livraison'), p_stockage_id: champ('stockage'), p_date: versIso(champ('quand')),
        p_volume_mesure: nombre(champ('mesure')), p_volume_accepte: nombre(champ('accepte')), p_methode: champ('methode'),
        p_motif_ecart: champ('motif').trim() || null,
      }), 'Réception enregistrée : entrée en stock à valider par une autre personne.');
    }
    if (formulaire === 'transfert') {
      return executer(() => supabase.rpc('transferer_carburant', {
        p_source_id: champ('source'), p_destination_id: champ('destination'), p_litres: nombre(champ('litres')),
        p_date: versIso(champ('quand')), p_reference: champ('reference').trim() || null, p_note: champ('note').trim() || null,
      }), 'Transfert enregistré : sortie et entrée à valider ensemble.');
    }
    return executer(() => supabase.rpc('saisir_inventaire_carburant', {
      p_stockage_id: champ('stockage'), p_date: versIso(champ('quand')), p_volume_mesure: nombre(champ('mesure')),
      p_methode: champ('methode'), p_note: champ('note').trim() || null,
    }), 'Inventaire enregistré : l\'ajustement sera créé à sa validation.');
  };

  const deciderMouvement = (m: Mouvement, valider: boolean) => {
    const motif = valider ? null : window.prompt(`Motif du rejet du mouvement n° ${m.numero}`);
    if (!valider && !motif?.trim()) return;
    executer(() => supabase.rpc('decider_mouvement_carburant', { p_id: m.id, p_valider: valider, p_motif: motif }),
      valider ? `Mouvement n° ${m.numero} validé.` : `Mouvement n° ${m.numero} rejeté.`);
  };
  const deciderInventaire = (i: Inventaire, valider: boolean) => {
    const motif = valider ? null : window.prompt('Motif du rejet de l\'inventaire');
    if (!valider && !motif?.trim()) return;
    executer(() => supabase.rpc('decider_inventaire_carburant', { p_id: i.id, p_valider: valider, p_motif: motif }),
      valider ? 'Inventaire validé.' : 'Inventaire rejeté.');
  };
  const annuler = (m: Mouvement) => {
    const motif = window.prompt(`Motif de l'annulation du mouvement n° ${m.numero} (un contre-mouvement sera soumis à validation)`);
    if (!motif?.trim()) return;
    executer(() => supabase.rpc('annuler_mouvement_carburant', { p_id: m.id, p_motif: motif }), 'Contre-mouvement créé, à valider.');
  };
  const exporter = () => exportToCSV(journal.map((m) => ({
    numero: m.numero, date: m.date_mouvement, stockage: parId.get(m.stockage_id)?.code ?? '', type: LIBELLE_MOUVEMENT[m.type],
    variation_litres: m.variation, piece: m.reference_piece ?? '', statut: m.statut, note: m.note ?? '', motif_decision: m.motif_decision ?? '',
  })), 'registre-carburant');

  const pret = formulaire === 'stockage' ? champ('code').trim() && champ('libelle').trim() && champ('site') && nombre(champ('capacite')) > 0
    : formulaire === 'reception' ? champ('livraison') && champ('stockage') && nombre(champ('mesure')) > 0 && nombre(champ('accepte')) > 0
    : formulaire === 'transfert' ? champ('source') && champ('destination') && nombre(champ('litres')) > 0
    : formulaire === 'inventaire' ? champ('stockage') && champ('mesure') !== '' && nombre(champ('mesure')) >= 0 : false;
  const livraisonChoisie = livraisons.find((l) => l.id === champ('livraison'));

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Stocks et cuves</h2>
        <p className="text-sm text-stone-500">Stock calculé depuis les mouvements validés. Aucun solde ne se saisit ni ne se modifie.</p></div>
      <div className="flex flex-wrap gap-2">
        {peutEcrire && <>
          <button onClick={() => ouvrir('reception')} className="flex items-center gap-2 rounded-lg bg-orange-700 px-3 py-2 text-sm font-bold text-white"><PackagePlus className="h-4 w-4" /> Réception CBG</button>
          <button onClick={() => ouvrir('transfert')} className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"><ArrowRightLeft className="h-4 w-4" /> Transfert</button>
          <button onClick={() => ouvrir('inventaire')} className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"><Gauge className="h-4 w-4" /> Inventaire</button>
          <button onClick={() => ouvrir('stockage', { type: 'cuve_fixe' })} className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"><Plus className="h-4 w-4" /> Stockage</button>
        </>}
        <button onClick={charger} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
      </div>
    </header>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}

    {formulaire && <Panneau titre={{ stockage: 'Nouveau stockage', reception: 'Réception d\'une livraison CBG', transfert: 'Transfert entre stockages', inventaire: 'Inventaire (mesure physique)' }[formulaire]}>
      <div role="form" aria-label="Saisie carburant" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {formulaire === 'stockage' && <>
          <label className="text-sm">Code *<input value={champ('code')} onChange={(e) => poser('code', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Libellé *<input value={champ('libelle')} onChange={(e) => poser('libelle', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Type *<select value={champ('type')} onChange={(e) => poser('type', e.target.value)} className={CHAMP}>
            {Object.entries(LIBELLE_TYPE_STOCKAGE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="text-sm">Site *<select value={champ('site')} onChange={(e) => poser('site', e.target.value)} className={CHAMP}>
            <option value="">Choisir</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="text-sm">Capacité (L) *<input inputMode="decimal" value={champ('capacite')} onChange={(e) => poser('capacite', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Seuil d'alerte (L)<input inputMode="decimal" value={champ('seuil')} onChange={(e) => poser('seuil', e.target.value)} className={CHAMP} /></label>
        </>}
        {formulaire === 'reception' && <>
          <label className="text-sm">Stockage de réception *<select value={champ('stockage')} onChange={(e) => setChamps({ ...champs, stockage: e.target.value, livraison: '' })} className={CHAMP}>
            <option value="">Choisir</option>{actifs.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.libelle}</option>)}</select></label>
          <label className="text-sm">Livraison CBG *<select value={champ('livraison')} onChange={(e) => poser('livraison', e.target.value)} className={CHAMP}>
            <option value="">{livraisonsAReceptionner.length ? 'Choisir' : 'Aucune livraison à réceptionner sur ce site'}</option>
            {livraisonsAReceptionner.map((l) => <option key={l.id} value={l.id}>{l.reference} · {l.date_livraison} · {litres(l.volume_litres)}</option>)}</select></label>
          <label className="text-sm">Date et heure *<input type="datetime-local" value={champ('quand')} onChange={(e) => poser('quand', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Volume mesuré (L) *<input inputMode="decimal" value={champ('mesure')} onChange={(e) => poser('mesure', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Volume accepté (L) *<input inputMode="decimal" value={champ('accepte')} onChange={(e) => poser('accepte', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Méthode *<select value={champ('methode')} onChange={(e) => poser('methode', e.target.value)} className={CHAMP}>{METHODES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="text-sm sm:col-span-2 xl:col-span-3">Motif d'écart (obligatoire si différent du document CBG{livraisonChoisie ? ` : ${litres(livraisonChoisie.volume_litres)}` : ''})
            <input value={champ('motif')} onChange={(e) => poser('motif', e.target.value)} className={CHAMP} /></label>
        </>}
        {formulaire === 'transfert' && <>
          <label className="text-sm">Depuis *<select value={champ('source')} onChange={(e) => poser('source', e.target.value)} className={CHAMP}>
            <option value="">Choisir</option>{actifs.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.libelle}</option>)}</select></label>
          <label className="text-sm">Vers *<select value={champ('destination')} onChange={(e) => poser('destination', e.target.value)} className={CHAMP}>
            <option value="">Choisir</option>{actifs.filter((s) => s.id !== champ('source')).map((s) => <option key={s.id} value={s.id}>{s.code} · {s.libelle}</option>)}</select></label>
          <label className="text-sm">Quantité (L) *<input inputMode="decimal" value={champ('litres')} onChange={(e) => poser('litres', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Date et heure *<input type="datetime-local" value={champ('quand')} onChange={(e) => poser('quand', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Bon de transfert<input value={champ('reference')} onChange={(e) => poser('reference', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Note<input value={champ('note')} onChange={(e) => poser('note', e.target.value)} className={CHAMP} /></label>
        </>}
        {formulaire === 'inventaire' && <>
          <label className="text-sm">Stockage *<select value={champ('stockage')} onChange={(e) => poser('stockage', e.target.value)} className={CHAMP}>
            <option value="">Choisir</option>{actifs.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.libelle}</option>)}</select></label>
          <label className="text-sm">Volume mesuré (L) *<input inputMode="decimal" value={champ('mesure')} onChange={(e) => poser('mesure', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Date et heure de la mesure *<input type="datetime-local" value={champ('quand')} onChange={(e) => poser('quand', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Méthode *<select value={champ('methode')} onChange={(e) => poser('methode', e.target.value)} className={CHAMP}>{METHODES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="text-sm sm:col-span-2">Note<input value={champ('note')} onChange={(e) => poser('note', e.target.value)} className={CHAMP} /></label>
        </>}
      </div>
      <div className="mt-3 flex gap-2">
        <button disabled={busy || !pret} onClick={soumettre} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer</button>
        <button onClick={() => setFormulaire('')} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Annuler</button>
      </div>
    </Panneau>}

    <Panneau titre={`Stockages (${stocks?.length ?? 0})`}>
      {stocks === null ? <p>Chargement…</p> : stocks.length === 0 ? <SansDonnees message="Aucun stockage déclaré" detail="Déclarez chaque cuve fixe ou citerne mobile, puis son inventaire d'ouverture." /> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500">
          <th className="py-2 pr-3">Code</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Site</th><th className="py-2 pr-3 text-right">Stock validé</th>
          <th className="py-2 pr-3 text-right">En attente</th><th className="py-2 pr-3 text-right">Capacité</th><th className="py-2 pr-3">Dernier inventaire</th><th className="py-2">Alerte</th></tr></thead>
          <tbody>{stocks.map((s) => { const a = alerteStockage(s); return <tr key={s.id} className={`border-b border-stone-100 ${s.actif ? '' : 'text-stone-400'}`}>
            <td className="py-2 pr-3"><span className="font-mono font-semibold">{s.code}</span> <span className="text-stone-500">{s.libelle}</span></td>
            <td className="py-2 pr-3">{LIBELLE_TYPE_STOCKAGE[s.type]}</td><td className="py-2 pr-3">{nomSite.get(s.site_id) ?? '—'}</td>
            <td className="py-2 pr-3 text-right font-semibold">{s.solde_litres === null ? <span className="text-stone-400">sans données</span> : litres(s.solde_litres)}</td>
            <td className="py-2 pr-3 text-right">{s.mouvements_en_attente ? `${formatNombre(Number(s.en_attente_litres), 0)} L (${s.mouvements_en_attente})` : '—'}</td>
            <td className="py-2 pr-3 text-right">{litres(s.capacite_litres)}</td>
            <td className="py-2 pr-3">{s.dernier_inventaire ? `${new Date(s.dernier_inventaire).toLocaleDateString('fr-FR')} (écart ${litres(s.dernier_ecart_inventaire)})` : '—'}</td>
            <td className="py-2">{a && <Puce teinte={a.teinte}>{a.texte}</Puce>}</td></tr>; })}</tbody></table></div>}
    </Panneau>

    {(aValider.length > 0 || inventairesAValider.length > 0) && <Panneau titre={`À valider (${aValider.length + inventairesAValider.length})`}>
      <p className="mb-2 text-xs text-stone-500">La décision revient à une autre personne que l'auteur de la saisie (contrôle serveur).</p>
      <ul className="divide-y divide-stone-100 text-sm">
        {inventairesAValider.map((i) => <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span>Inventaire <b>{parId.get(i.stockage_id)?.code}</b> · {new Date(i.date_mesure).toLocaleString('fr-FR')} · mesuré {litres(i.volume_mesure)} · théorique {i.solde_theorique === null ? 'sans données (ouverture)' : litres(i.solde_theorique)} · écart <b>{litres(i.ecart)}</b></span>
          {peutEcrire && <span className="flex gap-1">
            <button disabled={busy} onClick={() => deciderInventaire(i, true)} aria-label={`Valider l'inventaire ${parId.get(i.stockage_id)?.code}`} className="flex items-center gap-1 rounded bg-green-700 px-2 py-1 text-xs font-bold text-white"><Check className="h-3 w-3" /> Valider</button>
            <button disabled={busy} onClick={() => deciderInventaire(i, false)} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs"><X className="h-3 w-3" /> Rejeter</button></span>}
        </li>)}
        {aValider.filter((m, idx, t) => !m.transfert_id || t.findIndex((x) => x.transfert_id === m.transfert_id) === idx).map((m) => <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span>n° {m.numero} · {LIBELLE_MOUVEMENT[m.type]}{m.transfert_id ? ' (sortie et entrée)' : ''} · <b>{parId.get(m.stockage_id)?.code}</b> · {formatNombre(Number(m.variation), 0)} L · {new Date(m.date_mouvement).toLocaleString('fr-FR')}{m.reference_piece ? ` · ${m.reference_piece}` : ''}{m.note ? ` · ${m.note}` : ''}</span>
          {peutEcrire && <span className="flex gap-1">
            <button disabled={busy} onClick={() => deciderMouvement(m, true)} aria-label={`Valider le mouvement ${m.numero}`} className="flex items-center gap-1 rounded bg-green-700 px-2 py-1 text-xs font-bold text-white"><Check className="h-3 w-3" /> Valider</button>
            <button disabled={busy} onClick={() => deciderMouvement(m, false)} aria-label={`Rejeter le mouvement ${m.numero}`} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs"><X className="h-3 w-3" /> Rejeter</button></span>}
        </li>)}
      </ul>
    </Panneau>}

    <Panneau titre="Registre des mouvements">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select aria-label="Filtrer par stockage" value={filtre} onChange={(e) => setFiltre(e.target.value)} className="rounded border border-stone-300 px-3 py-2 text-sm">
          <option value="">Tous les stockages</option>{(stocks ?? []).map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}</select>
        <button onClick={exporter} className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"><Download className="h-4 w-4" /> Exporter CSV</button>
      </div>
      {journal.length === 0 ? <SansDonnees message="Aucun mouvement" /> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500">
          <th className="py-2 pr-3">N°</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Stockage</th><th className="py-2 pr-3">Type</th>
          <th className="py-2 pr-3 text-right">Variation</th><th className="py-2 pr-3">Pièce</th><th className="py-2 pr-3">État</th><th /></tr></thead>
          <tbody>{journal.map((m) => <tr key={m.id} className="border-b border-stone-100">
            <td className="py-2 pr-3 font-mono">{m.numero}</td><td className="py-2 pr-3">{new Date(m.date_mouvement).toLocaleString('fr-FR')}</td>
            <td className="py-2 pr-3">{parId.get(m.stockage_id)?.code ?? '—'}</td><td className="py-2 pr-3">{LIBELLE_MOUVEMENT[m.type]}</td>
            <td className={`py-2 pr-3 text-right font-semibold ${Number(m.variation) < 0 ? 'text-red-700' : 'text-green-700'}`}>{Number(m.variation) > 0 ? '+' : ''}{formatNombre(Number(m.variation), 0)} L</td>
            <td className="py-2 pr-3">{m.reference_piece ?? '—'}</td>
            <td className="py-2 pr-3" title={m.motif_decision ?? undefined}>{m.statut === 'valide' ? <Puce teinte="vert">Validé</Puce> : m.statut === 'rejete' ? <Puce teinte="gris">Rejeté</Puce> : <Puce teinte="orange">À valider</Puce>}</td>
            <td className="py-2">{peutEcrire && m.statut === 'valide' && !['annulation', 'ajustement_inventaire'].includes(m.type) && !dejaAnnules.has(m.id) &&
              <button disabled={busy} onClick={() => annuler(m)} aria-label={`Annuler le mouvement ${m.numero}`} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs"><Undo2 className="h-3 w-3" /> Annuler</button>}</td>
          </tr>)}</tbody></table></div>}
    </Panneau>
  </div>;
};
