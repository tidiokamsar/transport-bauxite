import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { exportToCSV } from '../../lib/exports';
import { bornesMois, depenseValide, repartitionParCategorie, totauxParDevise } from '../../lib/rapports';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';

// Couts directs (D-058) : une depense s'enregistre par la fonction serveur
// enregistrer_cout (droit d'ecriture costs, perimetre du site) ; elle ne se
// modifie ni ne se supprime, elle s'annule avec un motif (annuler_cout).
// Montants saisis TTC, compares aux budgets TTC (D-082). Une depense qui
// reprend une piece du circuit fournisseur (bon de commande, facture du
// loueur) la cite : elle ne compte pas au realise budgetaire, la piece y est
// deja (pas de double compte).
// Les totaux sont donnes par devise, jamais additionnes entre devises. Le
// cout par tonne et la rentabilite sont dans Rapports (rapport mensuel) et
// Reporting > Cout direct par tonne.

interface Cout {
  id: string; numero: string | null; date: string; description: string; amount: number; devise: string | null; reference: string | null;
  payment_method: string | null; notes: string | null; statut: 'enregistre' | 'annule'; motif_annulation: string | null; site_id: string | null;
  cost_categories: { name: string; category_type: string } | null; vehicles: { registration: string } | null; sites: { name: string } | null;
}
interface Lib { id: string; libelle: string }
interface PieceReprise { source: 'bon_commande' | 'facture_loueur'; id: string; libelle: string }

const CHAMP = 'mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm';
const DEVISES = ['GNF', 'USD', 'EUR'];
const MODES = ['Virement', 'Chèque', 'Espèces', 'Mobile money', 'Autre'];
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const moisCourant = () => new Date().toISOString().slice(0, 7);
const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const SAISIE_VIDE = { date: '', description: '', montant: '', devise: '', categorie: '', site: '', vehicule: '', reference: '', mode: '', notes: '', piece: '' };

export const CostsView = () => {
  const { hasPermission } = useAuth();
  const peutSaisir = hasPermission('costs', 'create') || hasPermission('costs', 'edit');
  const [mois, setMois] = useState(moisCourant);
  const [statut, setStatut] = useState<'enregistre' | 'annule' | 'tous'>('enregistre');
  const [recherche, setRecherche] = useState('');
  const [couts, setCouts] = useState<Cout[] | null>(null);
  const [categories, setCategories] = useState<Lib[]>([]);
  const [sites, setSites] = useState<Lib[]>([]);
  const [engins, setEngins] = useState<Lib[]>([]);
  const [saisie, setSaisie] = useState<typeof SAISIE_VIDE | null>(null);
  const [pieces, setPieces] = useState<PieceReprise[]>([]);
  const [erreurPieces, setErreurPieces] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const b = bornesMois(mois);
    if (!b) { setCouts([]); return; }
    const [c, ca, si, ve] = await Promise.all([
      supabase.from('costs').select('*, cost_categories(name, category_type), vehicles(registration), sites(name)')
        .gte('date', b.debut).lte('date', b.fin).order('date', { ascending: false }),
      supabase.from('cost_categories').select('id, name').eq('active', true).order('name'),
      supabase.from('sites').select('id, name').order('name'),
      supabase.from('vehicles').select('id, registration').order('registration'),
    ]);
    setErreur(c.error?.message ?? '');
    setCouts((c.data ?? []) as Cout[]);
    setCategories((ca.data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string })));
    setSites((si.data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string })));
    setEngins((ve.data ?? []).map((x) => ({ id: x.id as string, libelle: x.registration as string })));
    setHeure(new Date());
  }, [mois]);
  useEffect(() => { charger(); }, [charger]);

  const visibles = useMemo(() => (couts ?? []).filter((c) => (statut === 'tous' || c.statut === statut)
    && (!recherche.trim() || `${c.description} ${c.reference ?? ''} ${c.numero ?? ''}`.toLowerCase().includes(recherche.trim().toLowerCase()))), [couts, statut, recherche]);
  const pourTotaux = useMemo(() => visibles.map((c) => ({ amount: c.amount, devise: c.devise, statut: c.statut, categorie: c.cost_categories?.name ?? null })), [visibles]);
  const totaux = totauxParDevise(pourTotaux);
  const repartition = repartitionParCategorie(pourTotaux);

  // Pieces du circuit fournisseur lisibles par le compte (RLS), chargees a
  // l'ouverture du formulaire.
  const ouvrirSaisie = async () => {
    setSaisie({ ...SAISIE_VIDE, date: aujourdhui() });
    const [b, f] = await Promise.all([
      supabase.from('purchase_orders').select('id, po_number').in('status', ['approved', 'partially_received', 'received', 'closed'])
        .order('po_date', { ascending: false }).limit(200),
      supabase.from('factures_fournisseur').select('id, numero_fournisseur').order('date_facture', { ascending: false }).limit(200),
    ]);
    setErreurPieces(b.error || f.error ? `Pièces fournisseur non chargées : ${(b.error ?? f.error)?.message}` : '');
    setPieces([
      ...(b.data ?? []).map((x) => ({ source: 'bon_commande' as const, id: x.id as string, libelle: `Bon ${x.po_number as string}` })),
      ...(f.data ?? []).map((x) => ({ source: 'facture_loueur' as const, id: x.id as string, libelle: `Facture loueur ${x.numero_fournisseur as string}` })),
    ]);
  };

  const enregistrer = async () => {
    if (!saisie) return;
    setBusy(true); setErreur(''); setMessage('');
    const piece = pieces.find((x) => `${x.source}:${x.id}` === saisie.piece);
    const { error } = await supabase.rpc('enregistrer_cout', {
      p_date: saisie.date, p_description: saisie.description.trim(), p_montant: Number(saisie.montant.replace(',', '.')), p_devise: saisie.devise,
      p_categorie: saisie.categorie || null, p_site: saisie.site || null, p_vehicule: saisie.vehicule || null,
      p_reference: saisie.reference.trim() || null, p_mode_paiement: saisie.mode || null, p_notes: saisie.notes.trim() || null,
      p_piece_source: piece?.source ?? null, p_piece_id: piece?.id ?? null,
    });
    setBusy(false);
    if (error) { setErreur(error.message); return; }
    setSaisie(null); setMessage('Dépense enregistrée.'); await charger();
  };
  const annuler = async (c: Cout) => {
    const motif = window.prompt(`Motif de l'annulation de ${c.numero ?? c.description}`)?.trim();
    if (!motif) return;
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await supabase.rpc('annuler_cout', { p_id: c.id, p_motif: motif });
    setBusy(false);
    if (error) { setErreur(error.message); return; }
    setMessage('Dépense annulée.'); await charger();
  };
  const exporter = () => exportToCSV(visibles.map((c) => ({
    Numéro: c.numero ?? '', Date: c.date, Description: c.description, Catégorie: c.cost_categories?.name ?? '', Site: c.sites?.name ?? '',
    Engin: c.vehicles?.registration ?? '', Montant: c.amount, Devise: c.devise ?? '', Référence: c.reference ?? '', Statut: c.statut,
    'Motif d\'annulation': c.motif_annulation ?? '',
  })), `couts_directs_${mois}`);
  const saisieValide = !!saisie && depenseValide(saisie, aujourdhui());
  const maj = (champ: keyof typeof SAISIE_VIDE, valeur: string) => saisie && setSaisie({ ...saisie, [champ]: valeur });

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Coûts directs</h2>
        <p className="text-sm text-stone-500">Dépenses d'exploitation saisies dans SIGTB (hors location des engins). Une dépense ne se supprime pas : elle s'annule avec un motif.</p></div>
      <div className="flex gap-2">
        <button onClick={charger} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
        {peutSaisir && <button onClick={ouvrirSaisie} className="flex items-center gap-2 rounded-lg bg-orange-700 px-3 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Nouvelle dépense</button>}
      </div>
    </header>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}

    {saisie && <Panneau titre="Nouvelle dépense">
      <div role="form" aria-label="Nouvelle dépense" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">Date *<input type="date" max={aujourdhui()} value={saisie.date} onChange={(e) => maj('date', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm lg:col-span-3">Description *<input value={saisie.description} onChange={(e) => maj('description', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Montant TTC *<input inputMode="decimal" value={saisie.montant} onChange={(e) => maj('montant', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Devise *<select value={saisie.devise} onChange={(e) => maj('devise', e.target.value)} className={CHAMP}>
          <option value="">Choisir</option>{DEVISES.map((d) => <option key={d} value={d}>{d}</option>)}</select></label>
        <label className="text-sm">Catégorie<select value={saisie.categorie} onChange={(e) => maj('categorie', e.target.value)} className={CHAMP}>
          <option value="">Sans catégorie</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}</select></label>
        <label className="text-sm">Site<select value={saisie.site} onChange={(e) => maj('site', e.target.value)} className={CHAMP}>
          <option value="">Sans site (siège)</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}</select></label>
        <label className="text-sm">Engin<select value={saisie.vehicule} onChange={(e) => maj('vehicule', e.target.value)} className={CHAMP}>
          <option value="">Aucun</option>{engins.map((v) => <option key={v.id} value={v.id}>{v.libelle}</option>)}</select></label>
        <label className="text-sm">Référence de la pièce<input value={saisie.reference} onChange={(e) => maj('reference', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Mode de paiement<select value={saisie.mode} onChange={(e) => maj('mode', e.target.value)} className={CHAMP}>
          <option value="">Non renseigné</option>{MODES.map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
        <label className="text-sm">Notes<input value={saisie.notes} onChange={(e) => maj('notes', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm lg:col-span-2">Reprend une pièce du circuit fournisseur<select value={saisie.piece} onChange={(e) => maj('piece', e.target.value)} className={CHAMP}>
          <option value="">Aucune</option>{pieces.map((x) => <option key={`${x.source}:${x.id}`} value={`${x.source}:${x.id}`}>{x.libelle}</option>)}</select></label>
      </div>
      {erreurPieces && <p role="alert" className="mt-2 text-xs text-amber-800">{erreurPieces}</p>}
      <p className="mt-2 text-xs text-stone-500">Montant toutes taxes comprises (TTC), comme les budgets. Une dépense qui reprend une pièce fournisseur (bon de commande, facture du loueur) n'est pas recomptée au réalisé budgétaire : la pièce y figure déjà. Une dépense sans site n'est visible que des profils sans affectation de site.</p>
      <div className="mt-3 flex gap-2">
        <button disabled={busy || !saisieValide} onClick={enregistrer} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer</button>
        <button onClick={() => setSaisie(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Annuler</button>
      </div>
    </Panneau>}

    <Panneau titre="Filtres">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">Mois<input type="month" value={mois} onChange={(e) => setMois(e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Statut<select value={statut} onChange={(e) => setStatut(e.target.value as typeof statut)} className={CHAMP}>
          <option value="enregistre">Enregistrées</option><option value="annule">Annulées</option><option value="tous">Toutes</option></select></label>
        <label className="text-sm">Recherche<input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Description, référence, numéro" className={CHAMP} /></label>
      </div>
    </Panneau>

    <div className="grid gap-5 lg:grid-cols-3">
      <Panneau titre="Total par devise" className="lg:col-span-1">
        {totaux.length === 0 ? <SansDonnees message="Aucune dépense enregistrée" /> :
          <ul className="space-y-2 text-sm">{totaux.map((t) => <li key={t.devise} className="flex justify-between"><span>{t.devise} · {t.nombre} dépense(s)</span><b>{nombre.format(t.montant)} {t.devise}</b></li>)}</ul>}
        {repartition.length > 0 && <><h3 className="mt-4 text-sm font-bold text-stone-700">Par catégorie</h3>
          <ul className="mt-1 space-y-1 text-sm">{repartition.map((r) => <li key={`${r.categorie}-${r.devise}`} className="flex justify-between"><span>{r.categorie}</span><span>{nombre.format(r.montant)} {r.devise}</span></li>)}</ul></>}
        <Provenance source="costs (dépenses non annulées du mois)" heure={heure} />
      </Panneau>

      <Panneau titre="Dépenses" className="lg:col-span-2" action={<button disabled={visibles.length === 0} onClick={exporter}
        className="flex items-center gap-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm disabled:opacity-50"><Download className="h-4 w-4" /> Export CSV</button>}>
        {couts === null ? <p className="text-sm text-stone-500">Chargement…</p> : visibles.length === 0 ? <SansDonnees message="Aucune dépense pour ce mois" /> :
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500">
            <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Dépense</th><th className="py-2 pr-3">Catégorie</th><th className="py-2 pr-3">Site · engin</th><th className="py-2 pr-3 text-right">Montant</th><th /></tr></thead>
            <tbody>{visibles.map((c) => <tr key={c.id} className="border-b border-stone-100">
              <td className="py-2 pr-3">{c.date.split('-').reverse().join('/')}</td>
              <td className="py-2 pr-3"><b>{c.description}</b><span className="block text-xs text-stone-500">{c.numero ?? 'Sans numéro'}{c.reference ? ` · ${c.reference}` : ''}</span>
                {c.statut === 'annule' && <span className="block text-xs text-stone-500"><Puce teinte="gris">Annulée</Puce> {c.motif_annulation}</span>}</td>
              <td className="py-2 pr-3">{c.cost_categories?.name ?? '—'}</td>
              <td className="py-2 pr-3">{c.sites?.name ?? 'Sans site'}{c.vehicles ? ` · ${c.vehicles.registration}` : ''}</td>
              <td className={`py-2 pr-3 text-right font-semibold ${c.statut === 'annule' ? 'text-stone-400 line-through' : ''}`}>{nombre.format(c.amount)} {c.devise ?? '(devise non renseignée)'}</td>
              <td className="py-2">{peutSaisir && c.statut === 'enregistre' && <button disabled={busy} onClick={() => annuler(c)} aria-label={`Annuler ${c.numero ?? c.description}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Annuler</button>}</td>
            </tr>)}</tbody></table></div>}
      </Panneau>
    </div>
  </div>;
};
