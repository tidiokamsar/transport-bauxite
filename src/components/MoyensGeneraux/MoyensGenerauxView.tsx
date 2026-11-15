import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, FileText, History, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import {
  CATEGORIES_BIEN, ECARTS, ETATS_PHYSIQUES, LIBELLES_ACTION_BIEN, STATUTS_BIEN, TYPES_OPERATION_BIEN,
  actionsPossibles, normaliserNumero, planAmortissement, texteMontant,
  type ActionBien, type CategorieBien, type Ecart, type EtatPhysique, type StatutBien,
} from './moyensGeneraux';

// Moyens generaux et patrimoine (D-060) : registre des biens, cycle par
// journal (fonctions serveur), annulation motivee de la derniere operation,
// inventaire physique par site avec ecarts signales, jamais regularises
// automatiquement.

interface Bien {
  id: string; numero_inventaire: string; categorie: CategorieBien; designation: string; marque: string | null; modele: string | null;
  numero_serie: string | null; immatriculation: string | null; date_acquisition: string | null; valeur_acquisition: number | null;
  duree_amortissement_mois: number | null; fournisseur_id: string | null; note: string | null; statut: StatutBien; site_id: string;
  beneficiaire_type: 'personne' | 'service' | null; beneficiaire: string | null; etat_physique: EtatPhysique | null; etat_constate_le: string | null;
  mois_amortis: number | null; amortissement_cumule: number | null; valeur_nette: number | null; fin_amortissement: string | null;
}
interface Operation {
  id: string; type: string; effectue_le: string; saisi_le: string; site_id: string | null; site_origine_id: string | null;
  beneficiaire_type: string | null; beneficiaire: string | null; etat_physique: EtatPhysique | null; cout: number | null;
  prestataire: string | null; reference_piece: string | null; motif: string | null; note: string | null; annule_operation_id: string | null;
}
interface Campagne {
  id: string; site_id: string; libelle: string; ouvert_le: string; cloture_le: string | null; ouvert: boolean;
  nb_attendus: number; nb_constates: number; nb_manquants: number; nb_hors_site: number; nb_reformes: number; nb_non_references: number;
}
interface LigneInventaire { id: string; resultat: string; numero_lu: string | null; designation_lue: string | null; etat_physique: EtatPhysique | null; localisation: string | null; constate_le: string; annule_le: string | null }
interface EcartInventaire { inventaire_id: string; ligne_id: string | null; ecart: Ecart; numero: string | null; designation: string | null; provisoire: boolean }
interface Lib { id: string; libelle: string }

const CHAMP = 'mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm';
const num = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(/\s/g, '').replace(',', '.')));
const texte = (v: string) => (v.trim() === '' ? undefined : v.trim());
const quand = (v: string) => (v ? new Date(v).toISOString() : undefined);
const date = (v: string) => new Date(v).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
const jour = (v: string) => new Date(`${v.slice(0, 10)}T00:00:00`).toLocaleDateString('fr-FR');

export const MoyensGenerauxView = () => {
  const { hasPermission, profile } = useAuth();
  const peutEcrire = profile?.role === 'admin' || hasPermission('stock', 'create') || hasPermission('stock', 'edit');
  const [onglet, setOnglet] = useState<'registre' | 'inventaires'>('registre');
  const [biens, setBiens] = useState<Bien[] | null>(null);
  const [sites, setSites] = useState<Lib[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Lib[]>([]);
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [heure, setHeure] = useState<Date | null>(null);
  const [filtres, setFiltres] = useState({ statut: '', categorie: '', site: '', texte: '' });
  const [saisie, setSaisie] = useState<'bien' | 'fiche' | 'inventaire' | null>(null);
  const [action, setAction] = useState<{ type: ActionBien; bien: Bien } | null>(null);
  const [fiche, setFiche] = useState<{ bien: Bien; operations: Operation[] } | null>(null);
  const [campagne, setCampagne] = useState<{ c: Campagne; lignes: LigneInventaire[]; ecarts: EcartInventaire[] } | null>(null);
  const [champs, setChamps] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const [b, s, f, i] = await Promise.all([
      supabase.from('v_biens').select('*').order('numero_inventaire'),
      supabase.from('sites').select('id, name').order('name'),
      supabase.from('suppliers').select('id, company_name').order('company_name'),
      supabase.from('v_inventaires_biens').select('*').order('ouvert_le', { ascending: false }),
    ]);
    setErreur(b.error?.message ?? i.error?.message ?? '');
    setBiens((b.data ?? []) as Bien[]);
    setSites((s.data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string })));
    setFournisseurs((f.data ?? []).map((x) => ({ id: x.id as string, libelle: x.company_name as string })));
    setCampagnes((i.data ?? []) as Campagne[]);
    setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const site = useMemo(() => new Map(sites.map((e) => [e.id, e.libelle])), [sites]);
  const c = (k: string) => champs[k] ?? '';
  const poser = (k: string, v: string) => setChamps({ ...champs, [k]: v });
  const recherche = filtres.texte.trim().toLowerCase();
  const liste = (biens ?? []).filter((b) => (!filtres.statut || b.statut === filtres.statut) && (!filtres.categorie || b.categorie === filtres.categorie)
    && (!filtres.site || b.site_id === filtres.site)
    && (!recherche || `${b.numero_inventaire} ${b.designation} ${b.marque ?? ''} ${b.numero_serie ?? ''} ${b.beneficiaire ?? ''}`.toLowerCase().includes(recherche)));

  const ouvrirFiche = async (bien: Bien) => {
    const { data, error } = await supabase.from('biens_operations').select('*').eq('bien_id', bien.id)
      .order('effectue_le', { ascending: false }).order('saisi_le', { ascending: false });
    if (error) { setErreur(error.message); return; }
    setFiche({ bien, operations: (data ?? []) as Operation[] });
  };
  const ouvrirCampagne = async (cp: Campagne) => {
    const [l, e] = await Promise.all([
      supabase.from('inventaires_biens_lignes').select('*').eq('inventaire_id', cp.id).order('constate_le', { ascending: false }),
      supabase.from('v_inventaires_biens_ecarts').select('*').eq('inventaire_id', cp.id),
    ]);
    if (l.error || e.error) { setErreur(l.error?.message ?? e.error?.message ?? ''); return; }
    setCampagne({ c: cp, lignes: (l.data ?? []) as LigneInventaire[], ecarts: (e.data ?? []) as EcartInventaire[] });
  };
  const executer = async (fonction: string, args: Record<string, unknown>, succes: string) => {
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await supabase.rpc(fonction, Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined)));
    setBusy(false);
    if (error) { setErreur(error.message); return false; }
    setMessage(succes); await charger();
    if (fiche) {
      const { data } = await supabase.from('v_biens').select('*').eq('id', fiche.bien.id).maybeSingle();
      if (data) await ouvrirFiche(data as Bien);
    }
    if (campagne) {
      const { data } = await supabase.from('v_inventaires_biens').select('*').eq('id', campagne.c.id).maybeSingle();
      if (data) await ouvrirCampagne(data as Campagne);
    }
    return true;
  };
  const fermer = (ok: boolean) => { if (ok) { setSaisie(null); setAction(null); setChamps({}); } };

  const descriptif = () => ({
    p_categorie: c('categorie'), p_designation: c('designation').trim(), p_marque: texte(c('marque')), p_modele: texte(c('modele')),
    p_numero_serie: texte(c('serie')), p_immatriculation: texte(c('immatriculation')), p_date_acquisition: c('acquisition') || undefined,
    p_valeur_acquisition: num(c('valeur')), p_duree_amortissement_mois: num(c('duree')), p_fournisseur: c('fournisseur') || undefined, p_note: texte(c('note')),
  });
  const enregistrer = () => executer('enregistrer_bien', {
    ...descriptif(), p_numero: normaliserNumero(c('numero')), p_site: c('site'), p_etat: c('etat') || undefined,
    p_reference: texte(c('reference')), p_date: quand(c('date')),
  }, 'Bien enregistré au registre.').then(fermer);
  const modifierFiche = () => {
    if (!fiche) return;
    executer('modifier_fiche_bien', { ...descriptif(), p_bien: fiche.bien.id, p_motif: c('motif').trim() }, 'Fiche modifiée (journalisée).').then(fermer);
  };
  const preparerFiche = (b: Bien) => {
    setSaisie('fiche'); setAction(null);
    setChamps({
      categorie: b.categorie, designation: b.designation, marque: b.marque ?? '', modele: b.modele ?? '', serie: b.numero_serie ?? '',
      immatriculation: b.immatriculation ?? '', acquisition: b.date_acquisition ?? '', valeur: b.valeur_acquisition?.toString() ?? '',
      duree: b.duree_amortissement_mois?.toString() ?? '', fournisseur: b.fournisseur_id ?? '', note: b.note ?? '',
    });
  };

  const valider = () => {
    if (!action) return;
    const commun = { p_bien: action.bien.id, p_date: quand(c('date')) };
    const appels: Record<ActionBien, [string, Record<string, unknown>]> = {
      affecter: ['affecter_bien', { ...commun, p_beneficiaire_type: c('type'), p_beneficiaire: c('beneficiaire').trim(), p_reference: texte(c('reference')), p_note: texte(c('note')) }],
      remettre: ['remettre_bien', { ...commun, p_reference: texte(c('reference')), p_note: texte(c('note')) }],
      restituer: ['restituer_bien', { ...commun, p_etat: c('etat') || undefined, p_reference: texte(c('reference')), p_note: texte(c('note')) }],
      transferer: ['transferer_bien', { ...commun, p_site: c('site'), p_reference: texte(c('reference')), p_note: texte(c('note')) }],
      constater: ['constater_etat_bien', { ...commun, p_etat: c('etat'), p_note: texte(c('note')) }],
      reparer: ['reparer_bien', { ...commun, p_nature: c('nature').trim(), p_prestataire: texte(c('prestataire')), p_cout: num(c('cout')), p_etat: c('etat') || undefined, p_reference: texte(c('reference')) }],
      reformer: ['reformer_bien', { ...commun, p_motif: c('motif').trim(), p_reference: texte(c('reference')) }],
    };
    const [fonction, args] = appels[action.type];
    executer(fonction, args, `${LIBELLES_ACTION_BIEN[action.type]} : opération enregistrée.`).then(fermer);
  };
  const pretAction = (() => {
    if (!action) return false;
    switch (action.type) {
      case 'affecter': return !!c('type') && !!c('beneficiaire').trim();
      case 'transferer': return !!c('site') && c('site') !== action.bien.site_id;
      case 'constater': return !!c('etat');
      case 'reparer': return !!c('nature').trim();
      case 'reformer': return !!c('motif').trim();
      default: return true;
    }
  })();
  const annuler = (o: Operation) => {
    const motif = window.prompt(`Motif de l'annulation (${TYPES_OPERATION_BIEN[o.type]} du ${date(o.effectue_le)})`);
    if (!motif?.trim()) return;
    executer('annuler_operation_bien', { p_operation: o.id, p_motif: motif }, 'Opération annulée.');
  };

  const ouvrirInventaire = () => executer('ouvrir_inventaire_biens', { p_site: c('site'), p_libelle: c('libelle').trim(), p_date: quand(c('date')), p_note: texte(c('note')) },
    'Campagne d\'inventaire ouverte.').then(fermer);
  const constaterInventaire = () => {
    if (!campagne) return;
    executer('constater_inventaire_bien', {
      p_inventaire: campagne.c.id, p_numero: texte(normaliserNumero(c('lu'))), p_etat: c('etat') || undefined, p_designation: texte(c('designation')),
      p_localisation: texte(c('localisation')), p_note: texte(c('note')),
    }, 'Constat enregistré.').then((ok) => { if (ok) setChamps({}); });
  };
  const annulerConstat = (l: LigneInventaire) => {
    const motif = window.prompt(`Motif de l'annulation du constat ${l.numero_lu ?? l.designation_lue ?? ''}`);
    if (!motif?.trim()) return;
    executer('annuler_constat_inventaire', { p_ligne: l.id, p_motif: motif }, 'Constat annulé.');
  };
  const cloturer = () => {
    if (!campagne || !window.confirm('Clôturer la campagne ? Les biens attendus non constatés seront déclarés manquants ; les constats ne pourront plus changer.')) return;
    executer('cloturer_inventaire_biens', { p_inventaire: campagne.c.id }, 'Campagne clôturée : écarts figés.');
  };

  const annulees = new Set((fiche?.operations ?? []).filter((o) => o.annule_operation_id).map((o) => o.annule_operation_id));
  const derniere = (fiche?.operations ?? []).find((o) => o.type !== 'annulation' && o.type !== 'fiche' && !annulees.has(o.id));
  const champ = (k: string, libelle: string, props: Record<string, unknown> = {}) =>
    <label className="text-sm">{libelle}<input value={c(k)} onChange={(e) => poser(k, e.target.value)} className={CHAMP} {...props} /></label>;
  const choix = (k: string, libelle: string, options: [string, string][], vide = 'Choisir') =>
    <label className="text-sm">{libelle}<select value={c(k)} onChange={(e) => poser(k, e.target.value)} className={CHAMP}><option value="">{vide}</option>{options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>;
  const optionsSites = sites.map((x): [string, string] => [x.id, x.libelle]);
  const optionsEtats = Object.entries(ETATS_PHYSIQUES) as [string, string][];
  const champsDescriptifs = <>
    {choix('categorie', 'Catégorie *', Object.entries(CATEGORIES_BIEN))}
    {champ('designation', 'Désignation *')}
    {champ('marque', 'Marque')}
    {champ('modele', 'Modèle')}
    {champ('serie', 'Numéro de série')}
    {c('categorie') === 'vehicule_administratif' && champ('immatriculation', 'Immatriculation')}
    {champ('acquisition', 'Date d\'acquisition', { type: 'date' })}
    {champ('valeur', 'Valeur d\'acquisition (GNF)', { inputMode: 'numeric' })}
    {champ('duree', 'Durée d\'amortissement (mois)', { inputMode: 'numeric' })}
    {choix('fournisseur', 'Fournisseur', fournisseurs.map((x): [string, string] => [x.id, x.libelle]), 'Non renseigné')}
    {champ('note', 'Note')}
  </>;
  const libelleBeneficiaire = (b: Pick<Bien, 'beneficiaire' | 'beneficiaire_type'>) =>
    b.beneficiaire ? `${b.beneficiaire} (${b.beneficiaire_type === 'service' ? 'service' : 'personne'})` : '-';

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Moyens généraux et patrimoine</h2>
        <p className="text-sm text-stone-500">Registre des biens (matériel, mobilier, équipements, outillage, véhicules administratifs), affectations, inventaires physiques et réformes.</p></div>
      <div className="flex gap-2">
        {peutEcrire && onglet === 'registre' && <button onClick={() => { setSaisie('bien'); setAction(null); setChamps({}); }} className="flex items-center gap-2 rounded-lg bg-orange-700 px-3 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Bien</button>}
        {peutEcrire && onglet === 'inventaires' && <button onClick={() => { setSaisie('inventaire'); setChamps({}); }} className="flex items-center gap-2 rounded-lg bg-orange-700 px-3 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Campagne</button>}
        <button onClick={charger} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
      </div>
    </header>
    <div role="tablist" className="flex gap-2">
      {(['registre', 'inventaires'] as const).map((o) => <button key={o} role="tab" aria-selected={onglet === o} onClick={() => { setOnglet(o); setSaisie(null); setAction(null); }}
        className={`rounded-lg px-3 py-2 text-sm font-semibold ${onglet === o ? 'bg-stone-900 text-white' : 'border border-stone-200 bg-white'}`}>{o === 'registre' ? 'Registre' : 'Inventaires physiques'}</button>)}
    </div>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}

    {saisie === 'bien' && <Panneau titre="Nouveau bien (entrée au registre)">
      <div role="form" aria-label="Saisie bien" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {champ('numero', 'Numéro d\'inventaire *')}
        {choix('site', 'Site *', optionsSites)}
        {champ('date', 'Entrée le', { type: 'datetime-local' })}
        {choix('etat', 'État à l\'entrée', optionsEtats, 'Non constaté')}
        {champsDescriptifs}
        {champ('reference', 'Pièce (bon de réception, facture)')}
      </div>
      <p className="mt-2 text-xs text-stone-500">Valeur, date et durée vides : pas d'amortissement calculé (sans données).</p>
      <div className="mt-3 flex gap-2">
        <button disabled={busy || !(c('numero').trim() && c('site') && c('categorie') && c('designation').trim())} onClick={enregistrer} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer</button>
        <button onClick={() => setSaisie(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Annuler</button>
      </div>
    </Panneau>}

    {saisie === 'fiche' && fiche && <Panneau titre={`Modifier la fiche ${fiche.bien.numero_inventaire}`}>
      <div role="form" aria-label="Modification fiche" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {champsDescriptifs}
        {champ('motif', 'Motif de la modification *')}
      </div>
      <div className="mt-3 flex gap-2">
        <button disabled={busy || !(c('motif').trim() && c('categorie') && c('designation').trim())} onClick={modifierFiche} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer la modification</button>
        <button onClick={() => setSaisie(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Annuler</button>
      </div>
    </Panneau>}

    {action && <Panneau titre={`${LIBELLES_ACTION_BIEN[action.type]} le bien ${action.bien.numero_inventaire}`}>
      <p className="mb-3 text-sm text-stone-600">{action.bien.designation} · {site.get(action.bien.site_id) ?? '?'} · {STATUTS_BIEN[action.bien.statut].texte}{action.bien.beneficiaire ? ` · ${libelleBeneficiaire(action.bien)}` : ''}</p>
      <div role="form" aria-label="Opération bien" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {champ('date', 'Date de l\'opération', { type: 'datetime-local' })}
        {action.type === 'affecter' && <>
          {choix('type', 'Type de bénéficiaire *', [['personne', 'Personne'], ['service', 'Service']])}
          {champ('beneficiaire', 'Nom du bénéficiaire *')}
        </>}
        {action.type === 'transferer' && choix('site', 'Site de destination *', optionsSites.filter(([id]) => id !== action.bien.site_id))}
        {action.type === 'constater' && choix('etat', 'État constaté *', optionsEtats)}
        {(action.type === 'restituer' || action.type === 'reparer') && choix('etat', action.type === 'reparer' ? 'État après réparation' : 'État au retour', optionsEtats, 'Non constaté')}
        {action.type === 'reparer' && <>
          {champ('nature', 'Nature de la réparation *')}
          {champ('prestataire', 'Prestataire')}
          {champ('cout', 'Coût (GNF)', { inputMode: 'numeric' })}
        </>}
        {action.type === 'reformer' && champ('motif', 'Motif de la réforme *')}
        {action.type !== 'constater' && champ('reference', 'Pièce (PV, bon, facture)')}
        {!['reparer', 'reformer'].includes(action.type) && champ('note', 'Observation')}
      </div>
      {action.type === 'reformer' && <p className="mt-2 text-sm text-orange-800">La réforme est définitive : le bien sort du patrimoine actif et son amortissement s'arrête à cette date.</p>}
      <div className="mt-3 flex gap-2">
        <button disabled={busy || !pretAction} onClick={valider} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Valider l'opération</button>
        <button onClick={() => setAction(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Annuler</button>
      </div>
    </Panneau>}

    {onglet === 'registre' && <Panneau titre={`Registre (${liste.length})`}>
      <div className="mb-3 flex flex-wrap gap-2">
        <input aria-label="Rechercher un bien" placeholder="Numéro, désignation, série, bénéficiaire" value={filtres.texte} onChange={(e) => setFiltres({ ...filtres, texte: e.target.value })} className="rounded border border-stone-300 px-3 py-2 text-sm" />
        <select aria-label="Filtrer par statut" value={filtres.statut} onChange={(e) => setFiltres({ ...filtres, statut: e.target.value })} className="rounded border border-stone-300 px-3 py-2 text-sm">
          <option value="">Tous les statuts</option>{Object.entries(STATUTS_BIEN).map(([k, v]) => <option key={k} value={k}>{v.texte}</option>)}</select>
        <select aria-label="Filtrer par catégorie" value={filtres.categorie} onChange={(e) => setFiltres({ ...filtres, categorie: e.target.value })} className="rounded border border-stone-300 px-3 py-2 text-sm">
          <option value="">Toutes les catégories</option>{Object.entries(CATEGORIES_BIEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select aria-label="Filtrer par site" value={filtres.site} onChange={(e) => setFiltres({ ...filtres, site: e.target.value })} className="rounded border border-stone-300 px-3 py-2 text-sm">
          <option value="">Tous les sites</option>{sites.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}</select>
      </div>
      {biens === null ? <p>Chargement…</p> : liste.length === 0 ? <SansDonnees message="Aucun bien enregistré" /> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500">
          <th className="py-2 pr-3">Bien</th><th className="py-2 pr-3">Catégorie</th><th className="py-2 pr-3">Statut</th><th className="py-2 pr-3">Site</th>
          <th className="py-2 pr-3">Bénéficiaire</th><th className="py-2 pr-3">État</th><th className="py-2 pr-3">Valeur nette</th><th /></tr></thead>
          <tbody>{liste.map((b) => <tr key={b.id} className="border-b border-stone-100 align-top">
            <td className="py-2 pr-3"><b>{b.numero_inventaire}</b><span className="block text-xs text-stone-500">{b.designation}{b.marque ? ` · ${b.marque}` : ''}{b.numero_serie ? ` · S/N ${b.numero_serie}` : ''}</span></td>
            <td className="py-2 pr-3">{CATEGORIES_BIEN[b.categorie]}</td>
            <td className="py-2 pr-3"><Puce teinte={STATUTS_BIEN[b.statut].teinte}>{STATUTS_BIEN[b.statut].texte}</Puce></td>
            <td className="py-2 pr-3">{site.get(b.site_id) ?? '?'}</td>
            <td className="py-2 pr-3">{libelleBeneficiaire(b)}</td>
            <td className="py-2 pr-3">{b.etat_physique ? <>{ETATS_PHYSIQUES[b.etat_physique]}<span className="block text-xs text-stone-500">{b.etat_constate_le && date(b.etat_constate_le)}</span></> : 'Sans données'}</td>
            <td className="py-2 pr-3">{texteMontant(b.valeur_nette)}</td>
            <td className="py-2"><div className="flex flex-wrap gap-1">
              {peutEcrire && actionsPossibles(b.statut).map((a) => <button key={a} onClick={() => { setAction({ type: a, bien: b }); setSaisie(null); setChamps({}); }}
                aria-label={`${LIBELLES_ACTION_BIEN[a]} ${b.numero_inventaire}`} className="rounded border border-stone-300 px-2 py-1 text-xs">{LIBELLES_ACTION_BIEN[a]}</button>)}
              <button onClick={() => ouvrirFiche(b)} aria-label={`Fiche ${b.numero_inventaire}`} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs"><FileText className="h-3 w-3" /> Fiche</button>
            </div></td>
          </tr>)}</tbody></table></div>}
      <Provenance source="registre du patrimoine (v_biens), amortissement linéaire en mois entiers" heure={heure} />
    </Panneau>}

    {onglet === 'registre' && fiche && <Panneau titre={`Fiche du bien ${fiche.bien.numero_inventaire}`}
      action={peutEcrire && <button onClick={() => preparerFiche(fiche.bien)} className="rounded border border-stone-300 px-3 py-1 text-sm">Modifier la fiche</button>}>
      <dl className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
        {([
          ['Désignation', fiche.bien.designation], ['Catégorie', CATEGORIES_BIEN[fiche.bien.categorie]],
          ['Marque et modèle', [fiche.bien.marque, fiche.bien.modele].filter(Boolean).join(' ') || 'Sans données'],
          ['Numéro de série', fiche.bien.numero_serie ?? 'Sans données'],
          ...(fiche.bien.immatriculation ? [['Immatriculation', fiche.bien.immatriculation]] : []),
          ['Acquis le', fiche.bien.date_acquisition ? jour(fiche.bien.date_acquisition) : 'Sans données'],
          ['Valeur d\'acquisition', texteMontant(fiche.bien.valeur_acquisition)],
          ['Durée d\'amortissement', fiche.bien.duree_amortissement_mois ? `${fiche.bien.duree_amortissement_mois} mois` : 'Sans données'],
          ['Amortissement cumulé', texteMontant(fiche.bien.amortissement_cumule)],
          ['Valeur nette comptable', texteMontant(fiche.bien.valeur_nette)],
          ['Fin d\'amortissement', fiche.bien.fin_amortissement ? jour(fiche.bien.fin_amortissement) : 'Sans données'],
        ] as [string, string][]).map(([k, v]) => <div key={k}><dt className="text-xs text-stone-500">{k}</dt><dd className="font-medium">{v}</dd></div>)}
      </dl>
      {planAmortissement(fiche.bien.valeur_acquisition, fiche.bien.date_acquisition, fiche.bien.duree_amortissement_mois).length > 0 &&
        <table aria-label="Plan d'amortissement" className="mt-4 w-full max-w-xl text-sm"><thead><tr className="border-b text-left text-stone-500"><th className="py-1">Année</th><th>Dotation</th><th>Cumul au 31/12</th><th>Valeur nette</th></tr></thead>
          <tbody>{planAmortissement(fiche.bien.valeur_acquisition, fiche.bien.date_acquisition, fiche.bien.duree_amortissement_mois).map((l) =>
            <tr key={l.annee} className="border-b border-stone-100"><td className="py-1">{l.annee}</td><td>{texteMontant(l.dotation)}</td><td>{texteMontant(l.cumul)}</td><td>{texteMontant(l.valeurNette)}</td></tr>)}</tbody></table>}
      <h3 className="mb-2 mt-5 flex items-center gap-2 font-bold text-stone-800"><History className="h-4 w-4" /> Historique</h3>
      {fiche.operations.length === 0 ? <SansDonnees message="Aucune opération au journal" /> :
        <ul className="divide-y divide-stone-100 text-sm">{fiche.operations.map((o) => <li key={o.id} className={`flex flex-wrap items-start justify-between gap-2 py-2 ${annulees.has(o.id) ? 'text-stone-400 line-through' : ''}`}>
          <div><b>{TYPES_OPERATION_BIEN[o.type] ?? o.type}</b> · {date(o.effectue_le)}
            {o.type === 'transfert' && <> · {site.get(o.site_origine_id ?? '') ?? '?'} → {site.get(o.site_id ?? '') ?? '?'}</>}
            {o.type === 'entree' && o.site_id && <> · {site.get(o.site_id) ?? '?'}</>}
            {o.beneficiaire && <> · {o.beneficiaire}</>}
            {o.etat_physique && <> · {ETATS_PHYSIQUES[o.etat_physique]}</>}
            {o.prestataire && <> · {o.prestataire}</>}
            {o.cout !== null && <> · {texteMontant(o.cout)}</>}
            {o.reference_piece && <> · pièce {o.reference_piece}</>}
            {(o.motif || o.note) && <span className="block text-xs text-stone-500">{o.motif ?? ''}{o.motif && o.note ? ' · ' : ''}{o.note ?? ''}</span>}
          </div>
          {peutEcrire && derniere?.id === o.id && o.type !== 'entree' &&
            <button onClick={() => annuler(o)} aria-label={`Annuler ${TYPES_OPERATION_BIEN[o.type]}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Annuler</button>}
        </li>)}</ul>}
    </Panneau>}

    {onglet === 'inventaires' && saisie === 'inventaire' && <Panneau titre="Nouvelle campagne d'inventaire">
      <div role="form" aria-label="Ouverture inventaire" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {choix('site', 'Site *', optionsSites)}
        {champ('libelle', 'Libellé *', { placeholder: 'Inventaire annuel 2026' })}
        {champ('date', 'Ouverte le', { type: 'datetime-local' })}
        {champ('note', 'Note')}
      </div>
      <div className="mt-3 flex gap-2">
        <button disabled={busy || !(c('site') && c('libelle').trim())} onClick={ouvrirInventaire} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Ouvrir la campagne</button>
        <button onClick={() => setSaisie(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Annuler</button>
      </div>
    </Panneau>}

    {onglet === 'inventaires' && <Panneau titre="Campagnes d'inventaire">
      {campagnes.length === 0 ? <SansDonnees message="Aucune campagne d'inventaire" detail="Une campagne par site : constat des biens présents, puis clôture qui fige les manquants." /> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500">
          <th className="py-2 pr-3">Campagne</th><th className="py-2 pr-3">Site</th><th className="py-2 pr-3">État</th><th className="py-2 pr-3">Attendus</th>
          <th className="py-2 pr-3">Constatés</th><th className="py-2 pr-3">Manquants</th><th className="py-2 pr-3">Autres écarts</th><th /></tr></thead>
          <tbody>{campagnes.map((cp) => <tr key={cp.id} className="border-b border-stone-100">
            <td className="py-2 pr-3"><b>{cp.libelle}</b><span className="block text-xs text-stone-500">ouverte le {date(cp.ouvert_le)}</span></td>
            <td className="py-2 pr-3">{site.get(cp.site_id) ?? '?'}</td>
            <td className="py-2 pr-3">{cp.ouvert ? <Puce teinte="orange">Ouverte (chiffres provisoires)</Puce> : <Puce teinte="gris">Clôturée le {date(cp.cloture_le ?? '')}</Puce>}</td>
            <td className="py-2 pr-3">{cp.nb_attendus}</td><td className="py-2 pr-3">{cp.nb_constates}</td><td className="py-2 pr-3">{cp.nb_manquants}</td>
            <td className="py-2 pr-3">{cp.nb_hors_site + cp.nb_reformes + cp.nb_non_references}</td>
            <td className="py-2"><button onClick={() => ouvrirCampagne(cp)} aria-label={`Détail ${cp.libelle}`} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs"><ClipboardCheck className="h-3 w-3" /> Détail</button></td>
          </tr>)}</tbody></table></div>}
      <Provenance source="campagnes d'inventaire physique (v_inventaires_biens)" heure={heure} />
    </Panneau>}

    {onglet === 'inventaires' && campagne && <Panneau titre={`${campagne.c.libelle} · ${site.get(campagne.c.site_id) ?? '?'}`}
      action={peutEcrire && campagne.c.ouvert && <button onClick={cloturer} disabled={busy} className="rounded-lg border border-red-300 px-3 py-1 text-sm text-red-700">Clôturer la campagne</button>}>
      {peutEcrire && campagne.c.ouvert && <>
        <div role="form" aria-label="Constat inventaire" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {champ('lu', 'Numéro d\'inventaire lu')}
          {champ('designation', 'Désignation (bien sans étiquette)')}
          {choix('etat', 'État constaté', optionsEtats, 'Non constaté')}
          {champ('localisation', 'Localisation')}
          {champ('note', 'Note')}
        </div>
        <button disabled={busy || !(c('lu').trim() || c('designation').trim())} onClick={constaterInventaire} className="mt-3 rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer le constat</button>
        <p className="mt-2 text-xs text-stone-500">Les écarts sont signalés, le registre n'est pas modifié : régulariser par les opérations du registre (entrée, transfert, réforme motivée).</p>
      </>}
      <h3 className="mb-2 mt-4 font-bold text-stone-800">Écarts {campagne.c.ouvert ? '(provisoires)' : ''}</h3>
      {campagne.ecarts.length === 0 ? <SansDonnees message="Aucun écart" /> :
        <ul className="divide-y divide-stone-100 text-sm">{campagne.ecarts.map((e, i) => <li key={e.ligne_id ?? `${e.numero}-${i}`} className="py-2">
          <Puce teinte={ECARTS[e.ecart].teinte}>{ECARTS[e.ecart].texte}</Puce> <b>{e.numero ?? 'Sans numéro'}</b>{e.designation ? ` · ${e.designation}` : ''}</li>)}</ul>}
      <h3 className="mb-2 mt-4 font-bold text-stone-800">Constats ({campagne.lignes.filter((l) => !l.annule_le && l.resultat !== 'manquant').length})</h3>
      {campagne.lignes.filter((l) => l.resultat !== 'manquant').length === 0 ? <SansDonnees message="Aucun constat" /> :
        <ul className="divide-y divide-stone-100 text-sm">{campagne.lignes.filter((l) => l.resultat !== 'manquant').map((l) => <li key={l.id} className={`flex flex-wrap items-start justify-between gap-2 py-2 ${l.annule_le ? 'text-stone-400 line-through' : ''}`}>
          <div><b>{l.numero_lu ?? 'Sans numéro'}</b>{l.designation_lue ? ` · ${l.designation_lue}` : ''} · {l.resultat === 'constate' ? 'Constaté' : ECARTS[l.resultat as Ecart]?.texte}
            {l.etat_physique && <> · {ETATS_PHYSIQUES[l.etat_physique]}</>}{l.localisation && <> · {l.localisation}</>} · {date(l.constate_le)}</div>
          {peutEcrire && campagne.c.ouvert && !l.annule_le &&
            <button onClick={() => annulerConstat(l)} aria-label={`Annuler le constat ${l.numero_lu ?? l.designation_lue ?? ''}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Annuler</button>}
        </li>)}</ul>}
    </Panneau>}
  </div>;
};
