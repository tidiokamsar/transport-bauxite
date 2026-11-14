import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Fuel, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatNombre } from '../Dashboard/indicateurs';
import { Panneau, SansDonnees } from '../ui/Panneau';

interface Livraison {
  id: string; reference: string; date_livraison: string; site_id: string; site?: { name: string } | null;
  volume_litres: number; prix_litre: number; montant: number; document_ref: string | null;
}
interface Facture {
  id: string; reference: string; date_facture: string; montant_facture: number; montant_attendu: number | null;
  ecart: number | null; statut: 'saisie' | 'conforme' | 'a_examiner';
}
interface Site { id: string; name: string }

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const monnaie = (x: number | null) => x === null ? '—' : `${formatNombre(Number(x), 2)} GNF`;

export const LivraisonsCbgView = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('fuel', 'create') || hasPermission('fuel', 'edit');
  const [livraisons, setLivraisons] = useState<Livraison[] | null>(null);
  const [factures, setFactures] = useState<Facture[] | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [livraisonsFacturees, setLivraisonsFacturees] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<string[]>([]);
  const [date, setDate] = useState(aujourdhui);
  const [reference, setReference] = useState('');
  const [siteId, setSiteId] = useState('');
  const [litres, setLitres] = useState('');
  const [prix, setPrix] = useState('');
  const [documentRef, setDocumentRef] = useState('');
  const [factureRef, setFactureRef] = useState('');
  const [factureDate, setFactureDate] = useState(aujourdhui);
  const [factureMontant, setFactureMontant] = useState('');
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
  const [l, f, s, r] = await Promise.all([
      supabase.from('livraisons_carburant_cbg').select('id, reference, date_livraison, site_id, volume_litres, prix_litre, montant, document_ref, site:sites(name)').order('date_livraison', { ascending: false }),
      supabase.from('factures_carburant_cbg').select('id, reference, date_facture, montant_facture, montant_attendu, ecart, statut').order('date_facture', { ascending: false }),
      supabase.from('sites').select('id, name').order('name'),
      supabase.from('factures_carburant_cbg_livraisons').select('livraison_id'),
    ]);
    setErreur(l.error?.message ?? f.error?.message ?? s.error?.message ?? r.error?.message ?? '');
    setLivraisons((l.data ?? []) as unknown as Livraison[]);
    setFactures((f.data ?? []) as Facture[]);
    setSites((s.data ?? []) as Site[]);
    setLivraisonsFacturees(new Set((r.data ?? []).map((x) => x.livraison_id)));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const nonFacturees = useMemo(() => {
    return new Set((livraisons ?? []).map((x) => x.id).filter((id) => !livraisonsFacturees.has(id)));
  }, [livraisons, livraisonsFacturees]);
  const enregistrerLivraison = async () => {
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await supabase.rpc('enregistrer_livraison_cbg', {
      p_reference: reference.trim(), p_date: date, p_site_id: siteId,
      p_volume_litres: Number(litres.replace(',', '.')), p_prix_litre: Number(prix.replace(',', '.')),
      p_document_ref: documentRef.trim() || null, p_note: null,
    });
    setBusy(false);
    if (error) { setErreur(error.message); return; }
    setReference(''); setLitres(''); setPrix(''); setDocumentRef(''); setMessage('Livraison CBG enregistrée.');
    await charger();
  };
  const creerFacture = async () => {
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await supabase.rpc('enregistrer_facture_carburant_cbg', {
      p_reference: factureRef.trim(), p_date: factureDate,
      p_montant: Number(factureMontant.replace(',', '.')), p_livraison_ids: selection,
    });
    setBusy(false);
    if (error) { setErreur(error.message); return; }
    setFactureRef(''); setFactureMontant(''); setSelection([]); setMessage('Facture enregistrée. Lancez le contrôle pour rapprocher son montant.');
    await charger();
  };
  const controler = async (id: string) => {
    setBusy(true); setErreur(''); setMessage('');
    const { data, error } = await supabase.rpc('controler_facture_carburant_cbg', { p_facture_id: id });
    setBusy(false);
    if (error) setErreur(error.message);
    else setMessage(data === 'conforme' ? 'Facture conforme aux livraisons rattachées.' : 'Écart détecté : vérification humaine nécessaire.');
    await charger();
  };

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Livraisons carburant CBG</h2>
        <p className="text-sm text-stone-500">Prix saisi à chaque livraison ; factures rapprochées aux livraisons sélectionnées.</p></div>
      <button onClick={charger} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
    </header>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}

    {peutEcrire && <Panneau titre="Enregistrer une livraison CBG">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <label className="text-sm">Référence livraison *<input value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" /></label>
        <label className="text-sm">Date *<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" /></label>
        <label className="text-sm">Site *<select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="mt-1 w-full rounded border border-stone-300 px-3 py-2"><option value="">Choisir un site</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="text-sm">Quantité livrée (L) *<input inputMode="decimal" value={litres} onChange={(e) => setLitres(e.target.value)} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" /></label>
        <label className="text-sm">Prix facturé par litre (GNF) *<input inputMode="decimal" value={prix} onChange={(e) => setPrix(e.target.value)} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" /></label>
        <label className="text-sm">Bon / justificatif<input value={documentRef} onChange={(e) => setDocumentRef(e.target.value)} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" /></label>
      </div>
      <button disabled={busy || !reference.trim() || !siteId || !litres || !prix} onClick={enregistrerLivraison} className="mt-3 flex items-center gap-2 rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Enregistrer livraison</button>
    </Panneau>}

    <Panneau titre={`Livraisons enregistrées (${livraisons?.length ?? 0})`}>
      {livraisons === null ? <p>Chargement…</p> : livraisons.length === 0 ? <SansDonnees message="Aucune livraison CBG saisie" detail="Saisissez la quantité et le prix figurant sur chaque bon de livraison." /> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500"><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Référence</th><th className="py-2 pr-3">Site</th><th className="py-2 pr-3 text-right">Litres</th><th className="py-2 pr-3 text-right">GNF / L</th><th className="py-2 text-right">Montant calculé</th></tr></thead><tbody>{livraisons.map((l) => <tr key={l.id} className="border-b border-stone-100"><td className="py-2 pr-3">{l.date_livraison}</td><td className="py-2 pr-3 font-mono">{l.reference}</td><td className="py-2 pr-3">{l.site?.name ?? '—'}</td><td className="py-2 pr-3 text-right">{formatNombre(Number(l.volume_litres), 2)}</td><td className="py-2 pr-3 text-right">{formatNombre(Number(l.prix_litre), 2)}</td><td className="py-2 text-right font-semibold">{monnaie(l.montant)}</td></tr>)}</tbody></table></div>}
    </Panneau>

    {peutEcrire && <Panneau titre="Saisir et contrôler une facture CBG">
      <p className="mb-3 text-sm text-stone-600">Associez toutes les livraisons portées sur la facture. Le contrôle compare le montant facturé à la somme des quantités × prix saisis à la livraison. Un écart est signalé, jamais corrigé automatiquement.</p>
      {livraisons && <div className="mb-3 max-h-48 space-y-1 overflow-auto rounded border border-stone-200 p-2">{livraisons.filter((l) => nonFacturees.has(l.id)).map((l) => <label key={l.id} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={selection.includes(l.id)} onChange={(e) => setSelection(e.target.checked ? [...selection, l.id] : selection.filter((id) => id !== l.id))} />{l.reference} · {l.date_livraison} · {formatNombre(Number(l.volume_litres))} L · {monnaie(l.montant)}</label>)}</div>}
      <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Référence facture *<input value={factureRef} onChange={(e) => setFactureRef(e.target.value)} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" /></label><label className="text-sm">Date facture *<input type="date" value={factureDate} onChange={(e) => setFactureDate(e.target.value)} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" /></label><label className="text-sm">Montant facturé (GNF) *<input inputMode="decimal" value={factureMontant} onChange={(e) => setFactureMontant(e.target.value)} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" /></label></div>
      <button disabled={busy || selection.length === 0 || !factureRef.trim() || !factureMontant} onClick={creerFacture} className="mt-3 rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer la facture</button>
    </Panneau>}

    <Panneau titre="Contrôle des factures carburant">
      {factures === null ? <p>Chargement…</p> : factures.length === 0 ? <SansDonnees message="Aucune facture CBG enregistrée" /> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500"><th className="py-2 pr-3">Référence</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3 text-right">Facturé</th><th className="py-2 pr-3 text-right">Attendu</th><th className="py-2 pr-3 text-right">Écart</th><th className="py-2 pr-3">État</th><th /></tr></thead><tbody>{factures.map((f) => <tr key={f.id} className="border-b border-stone-100"><td className="py-2 pr-3 font-mono">{f.reference}</td><td className="py-2 pr-3">{f.date_facture}</td><td className="py-2 pr-3 text-right">{monnaie(f.montant_facture)}</td><td className="py-2 pr-3 text-right">{monnaie(f.montant_attendu)}</td><td className="py-2 pr-3 text-right">{monnaie(f.ecart)}</td><td className="py-2 pr-3">{f.statut === 'saisie' ? 'À contrôler' : f.statut === 'conforme' ? 'Conforme' : 'À examiner'}</td><td className="py-2">{peutEcrire && f.statut === 'saisie' && <button disabled={busy} onClick={() => controler(f.id)} className="flex items-center gap-1 rounded bg-stone-800 px-2 py-1 text-xs font-bold text-white"><Check className="h-3 w-3" /> Contrôler</button>}</td></tr>)}</tbody></table></div>}
    </Panneau>
    <p className="flex items-center gap-2 text-xs text-stone-500"><Fuel className="h-4 w-4" /> Le coût des distributions est calculé à partir du prix moyen pondéré des livraisons saisies dans la période analysée. Sans livraison, il reste « sans données ».</p>
  </div>;
};
