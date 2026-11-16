import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import {
  LIGNE_PNEU, STATUTS_BON, lignesPourServeur, lireNumerosPneus, operationsPossibles, restantARecevoir, totalSaisi, type LigneSaisie, type StatutBon,
} from './achats';
import { lotsPourMouvement, type SuiviArticle } from '../Stock/stock';

// Achats (D-053) : bons de commande ecrits par les fonctions serveur.
// Brouillon, soumission, approbation par une autre personne, reception
// partielle vers le stock par le magasin, solde ou annulation motives.

interface Bon {
  id: string; po_number: string; po_date: string; supplier_id: string; warehouse_id: string | null; status: StatutBon;
  subtotal: number | null; tax_amount: number | null; total_amount: number | null; expected_delivery_date: string | null; notes: string | null;
  requested_by: string | null; soumis_par: string | null; motif_decision: string | null; motif_cloture: string | null;
}
interface Ligne { id: string; stock_item_id: string | null; item_description: string; quantity: number; unit_price: number; total_price: number; quantity_received: number | null; pneu_marque: string | null; pneu_modele: string | null; pneu_dimension: string | null }
interface Reception { id: string; delivery_number: string; delivery_date: string; bon_livraison: string | null; annule_le: string | null; motif_annulation: string | null }
interface LigneReception { id: string; delivery_id: string; po_item_id: string; quantite_recue: number; quantite_refusee: number; motif_refus: string | null }
interface Evenement { id: string; evenement: string; motif: string | null; le: string }
interface Lib { id: string; libelle: string }

const CHAMP = 'mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm';
const GNF = new Intl.NumberFormat('fr-FR');
const montant = (v: number | null) => (v === null ? 'Sans données' : `${GNF.format(v)} GNF`);
const LIGNE_VIDE: LigneSaisie = { article: '', designation: '', quantite: '', prix: '' };
interface SaisieReception { recue: string; refusee: string; motif: string; lots?: string; pneus?: string }
const RECEPTION_VIDE: SaisieReception = { recue: '', refusee: '', motif: '' };

export const PurchasesView = () => {
  const { hasPermission, profile } = useAuth();
  const peutAcheter = hasPermission('purchases', 'create') || hasPermission('purchases', 'edit');
  const peutApprouver = hasPermission('purchases', 'approve');
  const peutReceptionner = hasPermission('stock', 'create') || hasPermission('stock', 'edit');
  const [bons, setBons] = useState<Bon[] | null>(null);
  const [fournisseurs, setFournisseurs] = useState<Lib[]>([]);
  const [depots, setDepots] = useState<Lib[]>([]);
  const [articles, setArticles] = useState<Lib[]>([]);
  const [suivis, setSuivis] = useState<Map<string, SuiviArticle>>(new Map());
  const [filtre, setFiltre] = useState('');
  const [selection, setSelection] = useState<Bon | null>(null);
  const [detail, setDetail] = useState<{ lignes: Ligne[]; receptions: Reception[]; lignesReception: LigneReception[]; journal: Evenement[] } | null>(null);
  const [edition, setEdition] = useState<{ id: string | null } | null>(null);
  const [entete, setEntete] = useState<Record<string, string>>({});
  const [lignes, setLignes] = useState<LigneSaisie[]>([LIGNE_VIDE]);
  const [reception, setReception] = useState<Record<string, SaisieReception> | null>(null);
  const [bl, setBl] = useState('');
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const [b, f, d, a] = await Promise.all([
      supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('suppliers').select('id, company_name').order('company_name'),
      supabase.from('warehouses').select('id, name, code').order('name'),
      supabase.from('stock_items').select('id, name, item_code, suivi').order('name'),
    ]);
    setErreur(b.error?.message ?? '');
    setBons((b.data ?? []) as Bon[]);
    setFournisseurs((f.data ?? []).map((x) => ({ id: x.id as string, libelle: x.company_name as string })));
    setDepots((d.data ?? []).map((x) => ({ id: x.id as string, libelle: `${x.name as string} (${x.code as string})` })));
    setArticles((a.data ?? []).map((x) => ({ id: x.id as string, libelle: `${x.name as string} · ${x.item_code as string}` })));
    setSuivis(new Map((a.data ?? []).map((x) => [x.id as string, ((x.suivi as SuiviArticle | null) ?? 'aucun')])));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const chargerDetail = useCallback(async (bon: Bon) => {
    const [l, r, j] = await Promise.all([
      supabase.from('purchase_order_items').select('id, stock_item_id, item_description, quantity, unit_price, total_price, quantity_received, pneu_marque, pneu_modele, pneu_dimension').eq('purchase_order_id', bon.id),
      supabase.from('deliveries').select('id, delivery_number, delivery_date, bon_livraison, annule_le, motif_annulation').eq('purchase_order_id', bon.id).order('created_at'),
      supabase.from('achats_journal').select('id, evenement, motif, le').eq('purchase_order_id', bon.id).order('le'),
    ]);
    const receptions = (r.data ?? []) as Reception[];
    const lr = receptions.length
      ? await supabase.from('receptions_achat_lignes').select('id, delivery_id, po_item_id, quantite_recue, quantite_refusee, motif_refus').in('delivery_id', receptions.map((x) => x.id))
      : { data: [] };
    setDetail({ lignes: (l.data ?? []) as Ligne[], receptions, lignesReception: (lr.data ?? []) as LigneReception[], journal: (j.data ?? []) as Evenement[] });
  }, []);

  const fournisseur = useMemo(() => new Map(fournisseurs.map((x) => [x.id, x.libelle])), [fournisseurs]);
  const depot = useMemo(() => new Map(depots.map((x) => [x.id, x.libelle])), [depots]);
  const liste = (bons ?? []).filter((b) => !filtre || b.status === filtre);

  const ouvrir = async (bon: Bon) => { setSelection(bon); setReception(null); setEdition(null); await chargerDetail(bon); };
  const executer = async (fonction: string, args: Record<string, unknown>, succes: string) => {
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await supabase.rpc(fonction, args);
    setBusy(false);
    if (error) { setErreur(error.message); return false; }
    setMessage(succes);
    await charger();
    if (selection) {
      const { data } = await supabase.from('purchase_orders').select('*').eq('id', selection.id).maybeSingle();
      if (data) { setSelection(data as Bon); await chargerDetail(data as Bon); }
    }
    return true;
  };

  const nouveau = () => { setEdition({ id: null }); setSelection(null); setEntete({ taxes: '0' }); setLignes([LIGNE_VIDE]); };
  const modifier = () => {
    if (!selection || !detail) return;
    setEdition({ id: selection.id });
    setEntete({ fournisseur: selection.supplier_id, depot: selection.warehouse_id ?? '', livraison: selection.expected_delivery_date ?? '',
      taxes: String(selection.tax_amount ?? 0), note: selection.notes ?? '' });
    setLignes(detail.lignes.map((l) => (l.pneu_marque
      ? { article: LIGNE_PNEU, designation: '', quantite: String(l.quantity), prix: String(l.unit_price), pneuMarque: l.pneu_marque, pneuModele: l.pneu_modele ?? '', pneuDimension: l.pneu_dimension ?? '' }
      : { article: l.stock_item_id ?? '', designation: l.stock_item_id ? '' : l.item_description, quantite: String(l.quantity), prix: String(l.unit_price) })));
  };
  const lignesServeur = lignesPourServeur(lignes);
  const total = totalSaisi(lignes, entete.taxes ?? '0');
  const enregistrer = () => {
    if (!edition || !lignesServeur || total === null) return;
    executer('enregistrer_bon_commande', {
      p_id: edition.id, p_fournisseur: entete.fournisseur, p_depot: entete.depot, p_lignes: lignesServeur,
      p_livraison_prevue: entete.livraison || null, p_taxes: Number(entete.taxes || '0'), p_note: entete.note?.trim() || null,
    }, edition.id ? 'Brouillon modifié.' : 'Bon de commande enregistré en brouillon.').then((ok) => { if (ok) setEdition(null); });
  };
  const poserLigne = (i: number, k: keyof LigneSaisie, v: string) => setLignes(lignes.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  const motif = (question: string) => { const m = window.prompt(question); return m?.trim() ? m.trim() : null; };
  const annuler = (bon: Bon) => { const m = motif(`Motif de l'annulation du bon ${bon.po_number}`); if (m) executer('annuler_bon_commande', { p_id: bon.id, p_motif: m }, 'Bon annulé.'); };
  const solder = (bon: Bon) => { const m = motif(`Motif du solde du bon ${bon.po_number} (le reliquat ne sera pas livré)`); if (m) executer('solder_bon_commande', { p_id: bon.id, p_motif: m }, 'Bon soldé.'); };
  const rejeter = (bon: Bon) => { const m = motif(`Motif du rejet du bon ${bon.po_number}`); if (m) executer('decider_bon_commande', { p_id: bon.id, p_approuver: false, p_motif: m }, 'Bon rejeté.'); };
  const annulerReception = (r: Reception) => { const m = motif(`Motif de l'annulation de la réception ${r.delivery_number}`); if (m) executer('annuler_reception', { p_livraison: r.id, p_motif: m }, 'Réception annulée : stock corrigé.'); };

  // Detail exige a la reception (D-067) : lots ou series d'un article suivi,
  // numero de chaque pneu d'une ligne de pneus. null = saisie incomplete.
  const suiviLigne = (l: Ligne): SuiviArticle => (l.stock_item_id ? suivis.get(l.stock_item_id) ?? 'aucun' : 'aucun');
  const lignesReceptionServeur = reception && detail ? detail.lignes.map((l) => {
    const s = reception[l.id] ?? RECEPTION_VIDE;
    const recue = Number(s.recue || 0);
    const base: Record<string, unknown> = { ligne: l.id, recue, refusee: Number(s.refusee || 0), motif_refus: s.motif.trim() || null };
    let complet = true;
    if (recue > 0 && suiviLigne(l) !== 'aucun') {
      const lots = lotsPourMouvement(suiviLigne(l), s.lots ?? '', recue);
      if (lots) base.lots = lots; else complet = false;
    }
    if (recue > 0 && l.pneu_marque) {
      const numeros = lireNumerosPneus(s.pneus ?? '');
      if (numeros && numeros.length === recue) base.pneus = numeros.map((numero) => ({ numero })); else complet = false;
    }
    return { corps: base as { ligne: string; recue: number; refusee: number; motif_refus: string | null }, complet };
  }).filter((x) => x.corps.recue > 0 || x.corps.refusee > 0) : [];
  const receptionValide = lignesReceptionServeur.length > 0 && lignesReceptionServeur.every(({ corps: x, complet }) => complet && Number.isInteger(x.recue) && Number.isInteger(x.refusee) && (x.refusee === 0 || x.motif_refus))
    && (detail?.lignes ?? []).every((l) => (Number(reception?.[l.id]?.recue || 0)) <= restantARecevoir(l.quantity, l.quantity_received));
  const receptionner = () => {
    if (!selection) return;
    executer('receptionner_bon_commande', { p_id: selection.id, p_lignes: lignesReceptionServeur.map((x) => x.corps), p_bon_livraison: bl.trim() || null },
      'Réception enregistrée : les articles sont entrés en stock.').then((ok) => { if (ok) { setReception(null); setBl(''); } });
  };

  const ops = selection ? operationsPossibles(selection.status) : null;
  const estDemandeur = !!selection && !!profile && (selection.requested_by === profile.id || selection.soumis_par === profile.id);

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Achats</h2>
        <p className="text-sm text-stone-500">Bons de commande : brouillon, soumission, approbation par une autre personne, réception vers le stock.</p></div>
      <div className="flex gap-2">
        {peutAcheter && <button onClick={nouveau} className="flex items-center gap-2 rounded-lg bg-orange-700 px-3 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Nouveau bon de commande</button>}
        <button onClick={charger} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
      </div>
    </header>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}

    {edition && <Panneau titre={edition.id ? `Modifier le brouillon ${selection?.po_number ?? ''}` : 'Nouveau bon de commande'}>
      <p className="mb-3 text-sm text-stone-600">Numéro : attribué à l'enregistrement. Les totaux sont recalculés par le serveur.</p>
      <div role="form" aria-label="Saisie bon de commande" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm">Fournisseur *<select value={entete.fournisseur ?? ''} onChange={(e) => setEntete({ ...entete, fournisseur: e.target.value })} className={CHAMP}><option value="">Choisir</option>{fournisseurs.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}</select></label>
        <label className="text-sm">Dépôt de livraison *<select value={entete.depot ?? ''} onChange={(e) => setEntete({ ...entete, depot: e.target.value })} className={CHAMP}><option value="">Choisir</option>{depots.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}</select></label>
        <label className="text-sm">Livraison prévue<input type="date" value={entete.livraison ?? ''} onChange={(e) => setEntete({ ...entete, livraison: e.target.value })} className={CHAMP} /></label>
        <label className="text-sm">Taxes (GNF)<input inputMode="numeric" value={entete.taxes ?? ''} onChange={(e) => setEntete({ ...entete, taxes: e.target.value })} className={CHAMP} /></label>
        <label className="text-sm sm:col-span-2 xl:col-span-4">Note<input value={entete.note ?? ''} onChange={(e) => setEntete({ ...entete, note: e.target.value })} className={CHAMP} /></label>
      </div>
      <table className="mt-4 w-full text-sm"><thead><tr className="border-b text-left text-stone-500"><th className="py-2 pr-2">Article du magasin</th><th className="py-2 pr-2">ou désignation libre</th><th className="py-2 pr-2">Quantité</th><th className="py-2 pr-2">Prix unitaire (GNF)</th><th /></tr></thead>
        <tbody>{lignes.map((l, i) => <tr key={i} className="border-b border-stone-100">
          <td className="py-1 pr-2"><select aria-label={`Article ligne ${i + 1}`} value={l.article} onChange={(e) => poserLigne(i, 'article', e.target.value)} className={CHAMP}><option value="">Aucun (hors stock)</option><option value={LIGNE_PNEU}>Pneus (registre des pneus)</option>{articles.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}</select></td>
          <td className="py-1 pr-2">{l.article === LIGNE_PNEU
            ? <div className="grid grid-cols-3 gap-1">
              <input aria-label={`Marque pneu ligne ${i + 1}`} placeholder="Marque *" value={l.pneuMarque ?? ''} onChange={(e) => poserLigne(i, 'pneuMarque', e.target.value)} className={CHAMP} />
              <input aria-label={`Modèle pneu ligne ${i + 1}`} placeholder="Modèle *" value={l.pneuModele ?? ''} onChange={(e) => poserLigne(i, 'pneuModele', e.target.value)} className={CHAMP} />
              <input aria-label={`Dimension pneu ligne ${i + 1}`} placeholder="Dimension" value={l.pneuDimension ?? ''} onChange={(e) => poserLigne(i, 'pneuDimension', e.target.value)} className={CHAMP} /></div>
            : <input aria-label={`Désignation ligne ${i + 1}`} value={l.designation} onChange={(e) => poserLigne(i, 'designation', e.target.value)} className={CHAMP} />}</td>
          <td className="py-1 pr-2"><input aria-label={`Quantité ligne ${i + 1}`} inputMode="numeric" value={l.quantite} onChange={(e) => poserLigne(i, 'quantite', e.target.value)} className={CHAMP} /></td>
          <td className="py-1 pr-2"><input aria-label={`Prix ligne ${i + 1}`} inputMode="numeric" value={l.prix} onChange={(e) => poserLigne(i, 'prix', e.target.value)} className={CHAMP} /></td>
          <td className="py-1">{lignes.length > 1 && <button onClick={() => setLignes(lignes.filter((_, j) => j !== i))} aria-label={`Retirer la ligne ${i + 1}`} className="rounded border border-stone-300 p-2"><Trash2 className="h-3 w-3" /></button>}</td>
        </tr>)}</tbody></table>
      <button onClick={() => setLignes([...lignes, LIGNE_VIDE])} className="mt-2 rounded border border-stone-300 px-3 py-1 text-xs">Ajouter une ligne</button>
      <p className="mt-3 text-sm">Total : <b>{total === null ? 'lignes incomplètes' : montant(total)}</b></p>
      <div className="mt-3 flex gap-2">
        <button disabled={busy || !entete.fournisseur || !entete.depot || !lignesServeur || total === null} onClick={enregistrer} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer le brouillon</button>
        <button onClick={() => setEdition(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Fermer</button>
      </div>
    </Panneau>}

    {selection && detail && <Panneau titre={`Bon ${selection.po_number}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Puce teinte={STATUTS_BON[selection.status].teinte}>{STATUTS_BON[selection.status].texte}</Puce>
        <span>{fournisseur.get(selection.supplier_id) ?? '?'}</span> · <span>{selection.warehouse_id ? depot.get(selection.warehouse_id) ?? '?' : 'Sans dépôt'}</span>
        · <span>Total {montant(selection.total_amount)}</span>
        {(selection.motif_decision || selection.motif_cloture) && <span className="text-stone-500">· {selection.motif_decision ?? selection.motif_cloture}</span>}
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {peutAcheter && ops?.modifier && <button onClick={modifier} className="rounded border border-stone-300 px-3 py-1 text-xs">Modifier</button>}
        {peutAcheter && ops?.soumettre && <button onClick={() => executer('soumettre_bon_commande', { p_id: selection.id }, 'Bon soumis à approbation.')} className="rounded border border-stone-300 px-3 py-1 text-xs">Soumettre à approbation</button>}
        {peutApprouver && ops?.decider && (estDemandeur
          ? <span className="text-xs text-stone-500">L'approbation revient à une autre personne que le demandeur.</span>
          : <>
            <button onClick={() => executer('decider_bon_commande', { p_id: selection.id, p_approuver: true }, 'Bon approuvé.')} className="rounded bg-green-700 px-3 py-1 text-xs font-bold text-white">Approuver</button>
            <button onClick={() => rejeter(selection)} className="rounded border border-red-300 px-3 py-1 text-xs text-red-700">Rejeter</button>
          </>)}
        {peutReceptionner && ops?.receptionner && <button onClick={() => setReception({})} className="rounded border border-stone-300 px-3 py-1 text-xs">Réceptionner</button>}
        {peutAcheter && ops?.solder && <button onClick={() => solder(selection)} className="rounded border border-stone-300 px-3 py-1 text-xs">Solder</button>}
        {peutAcheter && ops?.annuler && <button onClick={() => annuler(selection)} className="rounded border border-stone-300 px-3 py-1 text-xs">Annuler le bon</button>}
      </div>
      <table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500"><th className="py-2 pr-3">Ligne</th><th className="py-2 pr-3">Commandé</th><th className="py-2 pr-3">Reçu</th><th className="py-2 pr-3">Prix unitaire</th><th className="py-2 pr-3">Montant</th>{reception && <><th className="py-2 pr-3">Reçu maintenant</th><th className="py-2 pr-3">Refusé</th><th className="py-2 pr-3">Motif du refus</th><th className="py-2 pr-3">Lots, séries ou numéros de pneus</th></>}</tr></thead>
        <tbody>{detail.lignes.map((l) => { const s = reception?.[l.id] ?? RECEPTION_VIDE; const poser = (k: keyof SaisieReception, v: string) => setReception({ ...reception, [l.id]: { ...s, [k]: v } });
          return <tr key={l.id} className="border-b border-stone-100">
            <td className="py-2 pr-3">{l.item_description}{l.pneu_marque ? <span className="block text-xs text-stone-500">Pneus : un numéro par pneu reçu</span> : !l.stock_item_id ? <span className="block text-xs text-stone-500">Hors stock</span> : suiviLigne(l) !== 'aucun' && <span className="block text-xs text-stone-500">{suiviLigne(l) === 'serie' ? 'Suivi par numéro de série' : 'Suivi par lot'}</span>}</td>
            <td className="py-2 pr-3">{l.quantity}</td><td className="py-2 pr-3">{l.quantity_received ?? 0}</td>
            <td className="py-2 pr-3">{montant(l.unit_price)}</td><td className="py-2 pr-3">{montant(l.total_price)}</td>
            {reception && <>
              <td className="py-1 pr-2"><input aria-label={`Reçu ${l.item_description}`} inputMode="numeric" value={s.recue} onChange={(e) => poser('recue', e.target.value)} placeholder={`max ${restantARecevoir(l.quantity, l.quantity_received)}`} className={CHAMP} /></td>
              <td className="py-1 pr-2"><input aria-label={`Refusé ${l.item_description}`} inputMode="numeric" value={s.refusee} onChange={(e) => poser('refusee', e.target.value)} className={CHAMP} /></td>
              <td className="py-1 pr-2"><input aria-label={`Motif du refus ${l.item_description}`} value={s.motif} onChange={(e) => poser('motif', e.target.value)} className={CHAMP} /></td>
              <td className="py-1 pr-2">{l.pneu_marque
                ? <textarea aria-label={`Numéros des pneus ${l.item_description}`} rows={2} placeholder="Un numéro par ligne" value={s.pneus ?? ''} onChange={(e) => poser('pneus', e.target.value)} className={CHAMP} />
                : suiviLigne(l) !== 'aucun'
                  ? <textarea aria-label={`Lots ${l.item_description}`} rows={2} placeholder={suiviLigne(l) === 'serie' ? 'Un numéro de série par ligne' : 'CODE QUANTITÉ, un lot par ligne'} value={s.lots ?? ''} onChange={(e) => poser('lots', e.target.value)} className={CHAMP} />
                  : <span className="text-xs text-stone-400">—</span>}</td>
            </>}
          </tr>; })}</tbody></table>
      {reception && detail.lignes.some((l) => l.pneu_marque) && <p role="note" className="mt-3 rounded bg-orange-50 p-2 text-xs text-orange-800">
        Pneus : chaque pneu reçu entre au registre des pneus. La réception ne pourra plus être annulée dès qu'un de ses pneus aura été monté ou mouvementé (D-067) ; vérifiez les numéros avant d'enregistrer.</p>}
      {reception && <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-sm">Bon de livraison du fournisseur<input value={bl} onChange={(e) => setBl(e.target.value)} className={CHAMP} /></label>
        <button disabled={busy || !receptionValide} onClick={receptionner} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer la réception</button>
        <button onClick={() => setReception(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Fermer</button>
      </div>}
      <h3 className="mt-4 text-sm font-bold">Réceptions</h3>
      {detail.receptions.length === 0 ? <SansDonnees message="Aucune réception" /> :
        <ul className="divide-y divide-stone-100 text-sm">{detail.receptions.map((r) => <li key={r.id} className={`flex flex-wrap items-center justify-between gap-2 py-2 ${r.annule_le ? 'text-stone-400 line-through' : ''}`}>
          <span><b>{r.delivery_number}</b> · {r.delivery_date}{r.bon_livraison && ` · BL ${r.bon_livraison}`} · {detail.lignesReception.filter((x) => x.delivery_id === r.id).map((x) => `${x.quantite_recue} reçu(s)${x.quantite_refusee ? `, ${x.quantite_refusee} refusé(s) (${x.motif_refus})` : ''}`).join(' ; ')}
            {r.annule_le && <span className="block text-xs no-underline">Annulée : {r.motif_annulation}</span>}</span>
          {peutReceptionner && !r.annule_le && (selection.status === 'partially_received' || selection.status === 'received') &&
            <button onClick={() => annulerReception(r)} aria-label={`Annuler la réception ${r.delivery_number}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Annuler</button>}
        </li>)}</ul>}
      <h3 className="mt-4 text-sm font-bold">Journal</h3>
      <ul className="text-xs text-stone-600">{detail.journal.map((e) => <li key={e.id}>{new Date(e.le).toLocaleString('fr-FR')} · {e.evenement}{e.motif ? ` · ${e.motif}` : ''}</li>)}</ul>
    </Panneau>}

    <Panneau titre="Bons de commande">
      <select aria-label="Filtrer par statut" value={filtre} onChange={(e) => setFiltre(e.target.value)} className="mb-3 rounded border border-stone-300 px-3 py-2 text-sm">
        <option value="">Tous les statuts</option>{Object.entries(STATUTS_BON).map(([k, v]) => <option key={k} value={k}>{v.texte}</option>)}</select>
      {bons === null ? <p>Chargement…</p> : liste.length === 0 ? <SansDonnees message="Aucun bon de commande" /> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500"><th className="py-2 pr-3">Numéro</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Fournisseur</th><th className="py-2 pr-3">Dépôt</th><th className="py-2 pr-3">Total</th><th className="py-2 pr-3">Statut</th><th /></tr></thead>
          <tbody>{liste.map((b) => <tr key={b.id} className={`border-b border-stone-100 ${selection?.id === b.id ? 'bg-orange-50' : ''}`}>
            <td className="py-2 pr-3 font-bold">{b.po_number}</td><td className="py-2 pr-3">{b.po_date}</td>
            <td className="py-2 pr-3">{fournisseur.get(b.supplier_id) ?? '?'}</td><td className="py-2 pr-3">{b.warehouse_id ? depot.get(b.warehouse_id) ?? '?' : 'Sans dépôt'}</td>
            <td className="py-2 pr-3">{montant(b.total_amount)}</td>
            <td className="py-2 pr-3"><Puce teinte={STATUTS_BON[b.status]?.teinte ?? 'gris'}>{STATUTS_BON[b.status]?.texte ?? b.status}</Puce></td>
            <td className="py-2"><button onClick={() => ouvrir(b)} aria-label={`Ouvrir ${b.po_number}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Ouvrir</button></td>
          </tr>)}</tbody></table></div>}
    </Panneau>
  </div>;
};
