import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import {
  CHAMP, STATUTS_CONSULTATION, STATUTS_OFFRE, comparerOffres, lignesConsultationPourServeur, lignesOffrePourServeur,
  type Fournisseur, type LigneConsultationSaisie, type StatutConsultation, type StatutOffre,
} from './fournisseurs';

// Consultations de fournisseurs (D-059) : demande de cotation a plusieurs
// fournisseurs, offres saisies (prix par ligne, delai), comparaison,
// selection motivee qui prepare un bon de commande brouillon (circuit D-053).

interface Consultation {
  id: string; numero: string; objet: string; warehouse_id: string | null; date_limite: string | null; note: string | null; statut: StatutConsultation;
  offre_retenue_id: string | null; motif_selection: string | null; purchase_order_id: string | null; motif_annulation: string | null; cree_le: string;
}
interface Ligne { id: string; consultation_id: string; ordre: number; stock_item_id: string | null; designation: string; quantite: number }
interface Invite { consultation_id: string; supplier_id: string }
interface Offre {
  id: string; consultation_id: string; supplier_id: string; reference_offre: string | null; recue_le: string; delai_livraison_jours: number;
  validite_jusqu_au: string | null; conditions: string | null; montant_total: number; lignes_chiffrees: number; statut: StatutOffre; motif_retrait: string | null;
}
interface PrixOffre { id: string; offre_id: string; consultation_ligne_id: string; prix_unitaire: number }
interface Evenement { id: string; consultation_id: string; evenement: string; motif: string | null; le: string }
interface Lib { id: string; libelle: string }

const GNF = new Intl.NumberFormat('fr-FR');
const LIGNE_VIDE: LigneConsultationSaisie = { article: '', designation: '', quantite: '' };
const aujourdhui = () => new Date().toISOString().slice(0, 10);

export const ConsultationsFournisseurs = ({ fournisseurs }: { fournisseurs: Fournisseur[] }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('purchases', 'create') || hasPermission('purchases', 'edit');
  const [consultations, setConsultations] = useState<Consultation[] | null>(null);
  const [depots, setDepots] = useState<Lib[]>([]);
  const [articles, setArticles] = useState<Lib[]>([]);
  const [selection, setSelection] = useState<Consultation | null>(null);
  const [detail, setDetail] = useState<{ lignes: Ligne[]; invites: Invite[]; offres: Offre[]; prix: PrixOffre[]; journal: Evenement[]; bon: string | null } | null>(null);
  const [creation, setCreation] = useState<Record<string, string> | null>(null);
  const [lignes, setLignes] = useState<LigneConsultationSaisie[]>([LIGNE_VIDE]);
  const [consultes, setConsultes] = useState<string[]>([]);
  const [offre, setOffre] = useState<Record<string, string> | null>(null);
  const [prix, setPrix] = useState<Record<string, string>>({});
  const [invite, setInvite] = useState('');
  const [preparerBon, setPreparerBon] = useState(true);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const [c, d, a] = await Promise.all([
      supabase.from('consultations_fournisseurs').select('*').order('cree_le', { ascending: false }),
      supabase.from('warehouses').select('id, name, code').order('name'),
      supabase.from('stock_items').select('id, name, item_code').order('name'),
    ]);
    setErreur(c.error?.message ?? '');
    setConsultations((c.data ?? []) as Consultation[]);
    setDepots((d.data ?? []).map((x) => ({ id: x.id as string, libelle: `${x.name as string} (${x.code as string})` })));
    setArticles((a.data ?? []).map((x) => ({ id: x.id as string, libelle: `${x.name as string} · ${x.item_code as string}` })));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const chargerDetail = useCallback(async (c: Consultation) => {
    const pour = <T extends { consultation_id: string }>(x: { data: unknown }) => ((x.data ?? []) as T[]).filter((r) => r.consultation_id === c.id);
    const [l, i, o, j] = await Promise.all([
      supabase.from('consultations_lignes').select('*').eq('consultation_id', c.id).order('ordre'),
      supabase.from('consultations_invites').select('consultation_id, supplier_id').eq('consultation_id', c.id),
      supabase.from('offres_fournisseurs').select('*').eq('consultation_id', c.id).order('saisi_le'),
      supabase.from('consultations_journal').select('id, consultation_id, evenement, motif, le').eq('consultation_id', c.id).order('le'),
    ]);
    const offres = pour<Offre>(o);
    const p = offres.length ? await supabase.from('offres_lignes').select('*').in('offre_id', offres.map((x) => x.id)) : { data: [] };
    const b = c.purchase_order_id ? await supabase.from('purchase_orders').select('id, po_number').eq('id', c.purchase_order_id).maybeSingle() : { data: null };
    setDetail({
      lignes: pour<Ligne>(l), invites: pour<Invite>(i), offres, journal: pour<Evenement>(j),
      prix: ((p.data ?? []) as PrixOffre[]).filter((x) => offres.some((y) => y.id === x.offre_id)),
      bon: (b.data as { po_number?: string } | null)?.po_number ?? null,
    });
  }, []);

  const nom = useMemo(() => new Map(fournisseurs.map((f) => [f.id, f.company_name])), [fournisseurs]);
  const actifs = fournisseurs.filter((f) => f.active !== false);
  const depot = useMemo(() => new Map(depots.map((x) => [x.id, x.libelle])), [depots]);

  const ouvrir = async (c: Consultation) => { setSelection(c); setCreation(null); setOffre(null); setPrix({}); await chargerDetail(c); };
  const executer = async (fonction: string, args: Record<string, unknown>, succes: string) => {
    setBusy(true); setErreur(''); setMessage('');
    const { data, error } = await supabase.rpc(fonction, args);
    setBusy(false);
    if (error) { setErreur(error.message); return null; }
    setMessage(succes);
    await charger();
    if (selection) {
      const { data: c } = await supabase.from('consultations_fournisseurs').select('*').eq('id', selection.id).maybeSingle();
      if (c) { setSelection(c as Consultation); await chargerDetail(c as Consultation); }
    }
    return { data: data as unknown };
  };
  const motif = (question: string) => { const m = window.prompt(question); return m?.trim() ? m.trim() : null; };

  const lignesServeur = lignesConsultationPourServeur(lignes);
  const creer = async () => {
    if (!creation || !lignesServeur) return;
    const r = await executer('creer_consultation', {
      p_objet: creation.objet?.trim() || null, p_lignes: lignesServeur, p_fournisseurs: consultes, p_depot: creation.depot || null,
      p_date_limite: creation.limite || null, p_note: creation.note?.trim() || null,
    }, 'Consultation créée : numéro attribué par le serveur.');
    if (r) { setCreation(null); setLignes([LIGNE_VIDE]); setConsultes([]); }
  };
  const poserLigne = (i: number, k: keyof LigneConsultationSaisie, v: string) => setLignes(lignes.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  const prixServeur = lignesOffrePourServeur(prix);
  const delaiOffre = offre?.delai?.trim() ?? '';
  const enregistrerOffre = () => {
    if (!selection || !offre || !prixServeur) return;
    executer('enregistrer_offre', {
      p_consultation: selection.id, p_fournisseur: offre.fournisseur, p_lignes: prixServeur, p_delai_jours: Number(delaiOffre),
      p_recue_le: offre.recue || aujourdhui(), p_reference: offre.reference?.trim() || null, p_validite: offre.validite || null,
      p_conditions: offre.conditions?.trim() || null,
    }, 'Offre enregistrée.').then((r) => { if (r) { setOffre(null); setPrix({}); } });
  };

  const comparaison = useMemo(() => {
    if (!detail || !selection) return null;
    return comparerOffres(
      detail.lignes.map((l) => ({ id: l.id, designation: l.designation, quantite: l.quantite })),
      detail.offres.map((o) => ({
        id: o.id, fournisseur: nom.get(o.supplier_id) ?? '?', delai: o.delai_livraison_jours, statut: o.statut, recueLe: o.recue_le,
        prix: Object.fromEntries(detail.prix.filter((p) => p.offre_id === o.id).map((p) => [p.consultation_ligne_id, p.prix_unitaire])),
      })),
      selection.date_limite,
    );
  }, [detail, selection, nom]);

  // Sans depot de livraison, le bon ne peut pas etre prepare a la selection
  // (le serveur refuserait toute la selection) : il le sera ensuite, apres
  // choix du depot (D-079).
  const preparerALaSelection = preparerBon && !!selection?.warehouse_id;
  const selectionner = (o: Offre) => {
    const m = motif(`Motif de la sélection de l'offre de ${nom.get(o.supplier_id) ?? '?'}`);
    if (!m) return;
    executer('selectionner_offre', { p_offre: o.id, p_motif: m, p_preparer_bon: preparerALaSelection },
      preparerALaSelection ? 'Offre retenue : bon de commande brouillon préparé (à soumettre dans Achats).'
        : selection?.warehouse_id ? 'Offre retenue.' : 'Offre retenue. Choisir le dépôt de livraison pour préparer le bon de commande.');
  };
  const [depotBon, setDepotBon] = useState('');
  const retirer = (o: Offre) => { const m = motif(`Motif du retrait de l'offre de ${nom.get(o.supplier_id) ?? '?'}`); if (m) executer('retirer_offre', { p_offre: o.id, p_motif: m }, 'Offre retirée.'); };
  const annuler = (c: Consultation) => { const m = motif(`Motif de l'annulation de la consultation ${c.numero}`); if (m) executer('annuler_consultation', { p_id: c.id, p_motif: m }, 'Consultation annulée.'); };

  const sansOffre = detail ? detail.invites.filter((i) => !detail.offres.some((o) => o.supplier_id === i.supplier_id && o.statut !== 'retiree')) : [];
  const nonConsultes = detail ? actifs.filter((f) => !detail.invites.some((i) => i.supplier_id === f.id)) : [];
  const offresActives = detail ? detail.offres.filter((o) => o.statut !== 'retiree') : [];

  return <div className="space-y-5">
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}

    {creation && <Panneau titre="Nouvelle consultation">
      <div role="form" aria-label="Saisie consultation" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm sm:col-span-2">Objet *<input value={creation.objet ?? ''} onChange={(e) => setCreation({ ...creation, objet: e.target.value })} className={CHAMP} /></label>
        <label className="text-sm">Dépôt de livraison<select value={creation.depot ?? ''} onChange={(e) => setCreation({ ...creation, depot: e.target.value })} className={CHAMP}>
          <option value="">À préciser</option>{depots.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}</select></label>
        <label className="text-sm">Date limite de réponse<input type="date" value={creation.limite ?? ''} onChange={(e) => setCreation({ ...creation, limite: e.target.value })} className={CHAMP} /></label>
        <label className="text-sm sm:col-span-2 xl:col-span-4">Note<input value={creation.note ?? ''} onChange={(e) => setCreation({ ...creation, note: e.target.value })} className={CHAMP} /></label>
      </div>
      <table className="mt-4 w-full text-sm"><thead><tr className="border-b text-left text-stone-500"><th className="py-2 pr-2">Article du magasin</th><th className="py-2 pr-2">ou désignation libre</th><th className="py-2 pr-2">Quantité</th><th /></tr></thead>
        <tbody>{lignes.map((l, i) => <tr key={i} className="border-b border-stone-100">
          <td className="py-1 pr-2"><select aria-label={`Article ligne ${i + 1}`} value={l.article} onChange={(e) => poserLigne(i, 'article', e.target.value)} className={CHAMP}><option value="">Aucun (hors stock)</option>{articles.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}</select></td>
          <td className="py-1 pr-2"><input aria-label={`Désignation ligne ${i + 1}`} value={l.designation} onChange={(e) => poserLigne(i, 'designation', e.target.value)} className={CHAMP} /></td>
          <td className="py-1 pr-2"><input aria-label={`Quantité ligne ${i + 1}`} inputMode="numeric" value={l.quantite} onChange={(e) => poserLigne(i, 'quantite', e.target.value)} className={CHAMP} /></td>
          <td className="py-1">{lignes.length > 1 && <button onClick={() => setLignes(lignes.filter((_, j) => j !== i))} aria-label={`Retirer la ligne ${i + 1}`} className="rounded border border-stone-300 p-2"><Trash2 className="h-3 w-3" /></button>}</td>
        </tr>)}</tbody></table>
      <button onClick={() => setLignes([...lignes, LIGNE_VIDE])} className="mt-2 rounded border border-stone-300 px-3 py-1 text-xs">Ajouter une ligne</button>
      <fieldset className="mt-4"><legend className="text-sm font-bold">Fournisseurs consultés * (actifs seulement)</legend>
        {actifs.length === 0 ? <SansDonnees message="Aucun fournisseur actif" /> :
          <div className="mt-1 flex flex-wrap gap-3 text-sm">{actifs.map((f) => <label key={f.id} className="flex items-center gap-1">
            <input type="checkbox" checked={consultes.includes(f.id)} onChange={(e) => setConsultes(e.target.checked ? [...consultes, f.id] : consultes.filter((x) => x !== f.id))} />{f.company_name}</label>)}</div>}
        {consultes.length === 1 && <p className="mt-1 text-xs text-orange-700">Un seul fournisseur consulté : pas de mise en concurrence.</p>}
      </fieldset>
      <div className="mt-3 flex gap-2">
        <button disabled={busy || !creation.objet?.trim() || !lignesServeur || consultes.length === 0} onClick={creer} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Créer la consultation</button>
        <button onClick={() => setCreation(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Fermer</button>
      </div>
    </Panneau>}

    {selection && detail && <Panneau titre={`Consultation ${selection.numero}`} action={<button onClick={() => setSelection(null)} className="rounded border border-stone-300 px-3 py-1 text-xs">Fermer</button>}>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Puce teinte={STATUTS_CONSULTATION[selection.statut].teinte}>{STATUTS_CONSULTATION[selection.statut].texte}</Puce>
        <span>{selection.objet}</span> · <span>{selection.warehouse_id ? depot.get(selection.warehouse_id) ?? '?' : 'Dépôt à préciser'}</span>
        {selection.date_limite && <span>· réponse avant le {selection.date_limite}</span>}
        {selection.motif_selection && <span className="text-stone-600">· Sélection : {selection.motif_selection}</span>}
        {selection.motif_annulation && <span className="text-stone-600">· Annulée : {selection.motif_annulation}</span>}
        {detail.bon && <span className="font-bold">· Bon de commande {detail.bon}</span>}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {peutEcrire && selection.statut === 'ouverte' && <button onClick={() => annuler(selection)} className="rounded border border-stone-300 px-3 py-1 text-xs">Annuler la consultation</button>}
        {peutEcrire && selection.statut === 'attribuee' && !detail.bon && <>
          {!selection.warehouse_id && <select aria-label="Dépôt de livraison du bon" value={depotBon} onChange={(e) => setDepotBon(e.target.value)} className="rounded border border-stone-300 px-2 py-1 text-xs">
            <option value="">Dépôt de livraison requis</option>{depots.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}</select>}
          <button disabled={busy || (!selection.warehouse_id && !depotBon)} onClick={() => executer('preparer_bon_commande_consultation', { p_consultation: selection.id, p_depot: selection.warehouse_id ? null : depotBon }, 'Bon de commande brouillon préparé.')} className="rounded border border-stone-300 px-3 py-1 text-xs disabled:opacity-50">Préparer le bon de commande</button>
        </>}
        {peutEcrire && selection.statut === 'ouverte' && nonConsultes.length > 0 && <>
          <select aria-label="Fournisseur à consulter" value={invite} onChange={(e) => setInvite(e.target.value)} className="rounded border border-stone-300 px-2 py-1 text-xs">
            <option value="">Consulter un autre fournisseur</option>{nonConsultes.map((f) => <option key={f.id} value={f.id}>{f.company_name}</option>)}</select>
          <button disabled={!invite || busy} onClick={() => executer('inviter_fournisseur_consultation', { p_consultation: selection.id, p_fournisseur: invite }, 'Fournisseur ajouté à la consultation.').then((r) => { if (r) setInvite(''); })} className="rounded border border-stone-300 px-3 py-1 text-xs disabled:opacity-50">Ajouter</button>
        </>}
      </div>
      <p className="text-sm">Consultés : {detail.invites.map((i) => nom.get(i.supplier_id) ?? '?').join(', ') || 'aucun'}
        {sansOffre.length > 0 && <span className="text-stone-500"> · sans offre : {sansOffre.map((i) => nom.get(i.supplier_id) ?? '?').join(', ')}</span>}</p>

      <h3 className="mt-4 text-sm font-bold">Comparaison des offres</h3>
      {!comparaison || offresActives.length === 0 ? <SansDonnees message="Aucune offre reçue" /> : <div className="overflow-x-auto">
        <table aria-label="Comparaison des offres" className="mt-1 w-full text-sm"><thead><tr className="border-b text-left text-stone-500">
          <th className="py-2 pr-3">Ligne</th><th className="py-2 pr-3">Quantité</th>
          {offresActives.map((o) => <th key={o.id} className="py-2 pr-3">{nom.get(o.supplier_id) ?? '?'}{o.reference_offre && <span className="block text-xs font-normal">{o.reference_offre}</span>}</th>)}</tr></thead>
          <tbody>
            {detail.lignes.map((l) => <tr key={l.id} className="border-b border-stone-100"><td className="py-2 pr-3">{l.designation}</td><td className="py-2 pr-3">{l.quantite}</td>
              {offresActives.map((o) => { const p = detail.prix.find((x) => x.offre_id === o.id && x.consultation_ligne_id === l.id);
                const meilleur = comparaison.meilleurPrixParLigne[l.id]?.includes(o.id);
                return <td key={o.id} className={`py-2 pr-3 ${meilleur ? 'font-bold text-green-800' : ''}`}>{p ? `${GNF.format(p.prix_unitaire)} GNF` : <span className="text-stone-400">Non chiffré</span>}</td>; })}</tr>)}
            {([['Montant', (r) => `${GNF.format(r.total)} GNF`], ['Lignes chiffrées', (r) => `${r.lignesChiffrees} / ${detail.lignes.length}`],
              ['Rang', (r) => (r.rang === null ? 'Non classée (incomplète)' : `${r.rang}${r.ecartPourcent ? ` (+${r.ecartPourcent} %)` : ''}`)]] as [string, (r: ReturnType<typeof comparerOffres>['offres'][number]) => string][])
              .map(([titre, f]) => <tr key={titre} className="border-b border-stone-100 bg-stone-50"><td className="py-2 pr-3 font-semibold" colSpan={2}>{titre}</td>
                {offresActives.map((o) => { const r = comparaison.offres.find((x) => x.id === o.id)!; return <td key={o.id} className="py-2 pr-3">{f(r)}</td>; })}</tr>)}
            <tr className="border-b border-stone-100 bg-stone-50"><td className="py-2 pr-3 font-semibold" colSpan={2}>Délai, réception</td>
              {offresActives.map((o) => { const r = comparaison.offres.find((x) => x.id === o.id)!;
                return <td key={o.id} className="py-2 pr-3">{o.delai_livraison_jours} j{r.plusRapide && ' (le plus court)'}<span className="block text-xs text-stone-500">reçue le {o.recue_le}{r.horsDelai && ', après la date limite'}</span>
                  {o.conditions && <span className="block text-xs text-stone-500">{o.conditions}</span>}</td>; })}</tr>
            <tr><td className="py-2 pr-3" colSpan={2}>{peutEcrire && selection.statut === 'ouverte' && <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={preparerALaSelection} disabled={!selection.warehouse_id} onChange={(e) => setPreparerBon(e.target.checked)} />{!selection.warehouse_id && 'Dépôt à préciser : bon à préparer après la sélection. '}Préparer le bon de commande brouillon</label>}</td>
              {offresActives.map((o) => <td key={o.id} className="py-2 pr-3"><Puce teinte={STATUTS_OFFRE[o.statut].teinte}>{STATUTS_OFFRE[o.statut].texte}</Puce>
                {peutEcrire && selection.statut === 'ouverte' && o.statut === 'recue' && <span className="mt-1 flex gap-1">
                  <button onClick={() => selectionner(o)} aria-label={`Retenir l'offre de ${nom.get(o.supplier_id) ?? '?'}`} className="rounded bg-green-700 px-2 py-1 text-xs font-bold text-white">Retenir</button>
                  <button onClick={() => retirer(o)} aria-label={`Retirer l'offre de ${nom.get(o.supplier_id) ?? '?'}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Retirer</button></span>}</td>)}</tr>
          </tbody></table>
        <p className="mt-1 text-xs text-stone-500">Classement sur les offres complètes, par montant puis délai ; en gras, le meilleur prix de chaque ligne. Le système compare, l'acheteur décide et motive.</p>
      </div>}
      {detail.offres.some((o) => o.statut === 'retiree') && <p className="mt-1 text-xs text-stone-500">Offres retirées : {detail.offres.filter((o) => o.statut === 'retiree').map((o) => `${nom.get(o.supplier_id) ?? '?'} (${o.motif_retrait})`).join(' ; ')}</p>}

      {peutEcrire && selection.statut === 'ouverte' && !offre && sansOffre.length > 0 && <button onClick={() => setOffre({ fournisseur: sansOffre[0].supplier_id, recue: aujourdhui() })} className="mt-3 rounded border border-stone-300 px-3 py-1 text-xs">Saisir une offre reçue</button>}
      {offre && <div role="form" aria-label="Saisie offre" className="mt-3 rounded-lg bg-stone-50 p-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm">Fournisseur *<select value={offre.fournisseur ?? ''} onChange={(e) => setOffre({ ...offre, fournisseur: e.target.value })} className={CHAMP}>
            {sansOffre.map((i) => <option key={i.supplier_id} value={i.supplier_id}>{nom.get(i.supplier_id) ?? '?'}</option>)}</select></label>
          <label className="text-sm">Référence de l'offre<input value={offre.reference ?? ''} onChange={(e) => setOffre({ ...offre, reference: e.target.value })} className={CHAMP} /></label>
          <label className="text-sm">Reçue le *<input type="date" value={offre.recue ?? ''} onChange={(e) => setOffre({ ...offre, recue: e.target.value })} className={CHAMP} /></label>
          <label className="text-sm">Délai de livraison (jours) *<input inputMode="numeric" value={offre.delai ?? ''} onChange={(e) => setOffre({ ...offre, delai: e.target.value })} className={CHAMP} /></label>
          <label className="text-sm">Valable jusqu'au<input type="date" value={offre.validite ?? ''} onChange={(e) => setOffre({ ...offre, validite: e.target.value })} className={CHAMP} /></label>
          <label className="text-sm sm:col-span-2 xl:col-span-3">Conditions<input value={offre.conditions ?? ''} onChange={(e) => setOffre({ ...offre, conditions: e.target.value })} className={CHAMP} /></label>
        </div>
        <table className="mt-2 w-full text-sm"><thead><tr className="border-b text-left text-stone-500"><th className="py-1 pr-2">Ligne</th><th className="py-1 pr-2">Quantité</th><th className="py-1 pr-2">Prix unitaire (GNF), vide si non chiffré</th></tr></thead>
          <tbody>{detail.lignes.map((l) => <tr key={l.id}><td className="py-1 pr-2">{l.designation}</td><td className="py-1 pr-2">{l.quantite}</td>
            <td className="py-1 pr-2"><input aria-label={`Prix ${l.designation}`} inputMode="numeric" value={prix[l.id] ?? ''} onChange={(e) => setPrix({ ...prix, [l.id]: e.target.value })} className={CHAMP} /></td></tr>)}</tbody></table>
        <div className="mt-2 flex gap-2">
          <button disabled={busy || !offre.fournisseur || !prixServeur || !/^\d+$/.test(delaiOffre) || !offre.recue} onClick={enregistrerOffre} className="rounded-lg bg-orange-700 px-3 py-1 text-xs font-bold text-white disabled:opacity-50">Enregistrer l'offre</button>
          <button onClick={() => { setOffre(null); setPrix({}); }} className="rounded-lg border border-stone-300 px-3 py-1 text-xs">Annuler</button>
        </div>
      </div>}

      <h3 className="mt-4 text-sm font-bold">Journal</h3>
      <ul className="text-xs text-stone-600">{detail.journal.map((e) => <li key={e.id}>{new Date(e.le).toLocaleString('fr-FR')} · {e.evenement}{e.motif ? ` · ${e.motif}` : ''}</li>)}</ul>
    </Panneau>}

    <Panneau titre="Consultations" action={peutEcrire && !creation && <button onClick={() => { setCreation({}); setSelection(null); }} className="flex items-center gap-2 rounded-lg bg-orange-700 px-3 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Nouvelle consultation</button>}>
      {consultations === null ? <p>Chargement…</p> : consultations.length === 0 ? <SansDonnees message="Aucune consultation" /> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500"><th className="py-2 pr-3">Numéro</th><th className="py-2 pr-3">Objet</th><th className="py-2 pr-3">Date limite</th><th className="py-2 pr-3">Statut</th><th /></tr></thead>
          <tbody>{consultations.map((c) => <tr key={c.id} className={`border-b border-stone-100 ${selection?.id === c.id ? 'bg-orange-50' : ''}`}>
            <td className="py-2 pr-3 font-bold">{c.numero}</td><td className="py-2 pr-3">{c.objet}</td><td className="py-2 pr-3">{c.date_limite ?? '-'}</td>
            <td className="py-2 pr-3"><Puce teinte={STATUTS_CONSULTATION[c.statut]?.teinte ?? 'gris'}>{STATUTS_CONSULTATION[c.statut]?.texte ?? c.statut}</Puce></td>
            <td className="py-2"><button onClick={() => ouvrir(c)} aria-label={`Ouvrir ${c.numero}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Ouvrir</button></td>
          </tr>)}</tbody></table></div>}
    </Panneau>
  </div>;
};
