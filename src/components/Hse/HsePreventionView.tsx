import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import { jourIso } from '../Pilotage/pilotage';
import {
  criticite, ETATS_PLAN, ETATS_RESTITUTION, etatEcheanceEpi, GRAVITES_CONSTAT, STATUTS_DOTATION, STATUTS_INSPECTION, TYPES_EPI,
} from './hse';

// Prevention HSE (D-068) : EPI, registre des risques, plans de prevention et
// inspections planifiees. Tout s'ecrit par des fonctions serveur (droit
// d'ecriture exploitation, perimetre site) ; un plan est signe par une
// personne habilitee (droit d'approbation exploitation) ; un enregistrement
// se corrige par un nouvel evenement (restitution, renouvellement, revision,
// nouvelle version, annulation motivee), jamais par reecriture.

interface Lib { id: string; libelle: string }
interface Dotation { id: string; numero: string; site_id: string; beneficiaire: string; driver_id: string | null; type_epi: string; designation: string | null;
  taille: string | null; quantite: number; remis_le: string; echeance_renouvellement: string | null; statut: string; restitue_le: string | null;
  etat_restitution: string | null; motif_annulation: string | null }
interface Risque { id: string; numero: string; site_id: string; version: number; danger: string; zone_activite: string; gravite: number; probabilite: number;
  mesures: string; responsable: string; revue_le: string; prochaine_revue: string | null; statut: string; revue_echue: boolean }
interface Plan { id: string; numero: string; version: number; site_id: string; intervenant: string; responsable_intervenant: string | null; perimetre: string;
  risques: string; mesures: string; valide_du: string; valide_au: string; statut: string; etat: string; signataire: string | null; signe_le: string | null; motif_annulation: string | null }
interface Programme { id: string; site_id: string; libelle: string; zone: string | null; frequence_jours: number; responsable: string; actif: boolean }
interface Inspection { id: string; numero: string; programme_id: string | null; site_id: string; objet: string; zone: string | null; responsable: string;
  prevue_le: string; statut: string; realisee_le: string | null; conclusion: string | null; motif_annulation: string | null }
interface Constat { id: string; inspection_id: string; description: string; gravite: string; localisation: string | null }
interface Action { id: string; inspection_id: string | null; constat_id: string | null; libelle: string; responsable: string; echeance: string; statut: string; preuve: string | null }

type Onglet = 'epi' | 'risques' | 'plans' | 'inspections';
const ONGLETS: { id: Onglet; libelle: string }[] = [
  { id: 'epi', libelle: 'EPI' }, { id: 'risques', libelle: 'Registre des risques' },
  { id: 'plans', libelle: 'Plans de prévention' }, { id: 'inspections', libelle: 'Inspections' },
];
const CHAMP = 'mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm';
const BOUTON = 'rounded-lg border border-stone-300 px-3 py-1.5 text-sm disabled:opacity-50';
const PRINCIPAL = 'rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50';
const d = (v: string | null) => (v ? new Date(v.length === 10 ? `${v}T00:00:00` : v).toLocaleDateString('fr-FR') : '—');
const entier = (v: string | undefined) => (v && /^\d+$/.test(v.trim()) ? Number(v) : null);

export const HsePreventionView = () => {
  const { hasPermission, profile } = useAuth();
  const estAdmin = profile?.role === 'admin';
  const peutEcrire = estAdmin || hasPermission('trips', 'create') || hasPermission('trips', 'edit');
  const peutSigner = estAdmin || hasPermission('trips', 'approve');
  const [onglet, setOnglet] = useState<Onglet>('epi');
  const [sites, setSites] = useState<Lib[]>([]);
  const [chauffeurs, setChauffeurs] = useState<Lib[]>([]);
  const [dotations, setDotations] = useState<Dotation[] | null>(null);
  const [risques, setRisques] = useState<Risque[] | null>(null);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [inspections, setInspections] = useState<Inspection[] | null>(null);
  const [constats, setConstats] = useState<Constat[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [f, setF] = useState<Record<string, string>>({});
  const [cible, setCible] = useState<{ type: string; id: string } | null>(null);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const aujourdhui = jourIso(new Date());

  const charger = useCallback(async () => {
    const [s, c, e, r, p, pr, i] = await Promise.all([
      supabase.from('sites').select('id, name').order('name'),
      supabase.from('drivers').select('id, name').order('name'),
      supabase.from('dotations_epi').select('*').order('remis_le', { ascending: false }).limit(300),
      supabase.from('v_risques_courants').select('*').order('numero'),
      supabase.from('v_plans_prevention').select('*').order('redige_le', { ascending: false }).limit(200),
      supabase.from('programmes_inspection').select('*').order('libelle'),
      supabase.from('inspections').select('*').order('prevue_le', { ascending: false }).limit(300),
    ]);
    setErreur(e.error?.message ?? r.error?.message ?? p.error?.message ?? i.error?.message ?? '');
    setSites((s.data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string })));
    setChauffeurs((c.data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string })));
    setDotations((e.data ?? []) as Dotation[]);
    setRisques((r.data ?? []) as Risque[]);
    setPlans((p.data ?? []) as Plan[]);
    setProgrammes((pr.data ?? []) as Programme[]);
    const liste = (i.data ?? []) as Inspection[];
    setInspections(liste);
    const ids = liste.filter((x) => x.statut === 'realisee').map((x) => x.id);
    if (ids.length) {
      const [k, a] = await Promise.all([
        supabase.from('constats_inspection').select('id, inspection_id, description, gravite, localisation').in('inspection_id', ids),
        supabase.from('actions_correctives').select('id, inspection_id, constat_id, libelle, responsable, echeance, statut, preuve').in('inspection_id', ids),
      ]);
      setConstats((k.data ?? []) as Constat[]);
      setActions((a.data ?? []) as Action[]);
    } else { setConstats([]); setActions([]); }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const nomSite = useMemo(() => new Map(sites.map((s) => [s.id, s.libelle])), [sites]);
  const maj = (cle: string, v: string) => setF((x) => ({ ...x, [cle]: v }));
  const vider = () => { setF({}); setCible(null); };
  const executer = async (fn: string, args: Record<string, unknown>, succes: string) => {
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) { setErreur(error.message); return false; }
    setMessage(succes); vider(); await charger(); return true;
  };
  const avecMotif = (fn: string, args: Record<string, unknown>, question: string, succes: string) => {
    const motif = window.prompt(question);
    if (motif?.trim()) executer(fn, { ...args, p_motif: motif.trim() }, succes);
  };
  const choixSite = (aria = 'Site *') => <label className="text-sm">{aria}<select aria-label={aria} value={f.site ?? ''} onChange={(e) => maj('site', e.target.value)} className={CHAMP}>
    <option value="">Choisir</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}</select></label>;
  const champ = (cle: string, libelle: string, type = 'text') => <label className="text-sm">{libelle}<input type={type} aria-label={libelle} value={f[cle] ?? ''}
    onChange={(e) => maj(cle, e.target.value)} className={CHAMP} /></label>;

  // EPI ----------------------------------------------------------------------
  const remettre = () => executer('remettre_epi', {
    p_site: f.site, p_beneficiaire: f.beneficiaire?.trim() || null, p_type: f.type, p_quantite: entier(f.quantite), p_remis_le: f.remis_le,
    p_echeance: f.echeance || null, p_designation: f.designation?.trim() || null, p_taille: f.taille?.trim() || null,
    p_driver: f.chauffeur || null, p_remplace: cible?.type === 'renouveler' ? cible.id : null,
  }, cible?.type === 'renouveler' ? 'EPI renouvelé.' : 'Dotation enregistrée.');
  const ongletEpi = () => <>
    {peutEcrire && <Panneau titre={cible?.type === 'renouveler' ? 'Renouveler la dotation' : 'Remettre un EPI'}>
      <div role="form" aria-label="Dotation EPI" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {choixSite()}
        <label className="text-sm">Chauffeur<select aria-label="Chauffeur" value={f.chauffeur ?? ''} onChange={(e) => maj('chauffeur', e.target.value)} className={CHAMP}>
          <option value="">Autre personne</option>{chauffeurs.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}</select></label>
        {champ('beneficiaire', 'Bénéficiaire')}
        <label className="text-sm">Type *<select aria-label="Type *" value={f.type ?? ''} onChange={(e) => maj('type', e.target.value)} className={CHAMP}>
          <option value="">Choisir</option>{Object.entries(TYPES_EPI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        {champ('designation', 'Désignation')}{champ('taille', 'Taille')}{champ('quantite', 'Quantité *')}
        {champ('remis_le', 'Remis le *', 'date')}{champ('echeance', 'Échéance de renouvellement', 'date')}
      </div>
      <div className="mt-3 flex gap-2">
        <button disabled={busy || !f.site || !f.type || !entier(f.quantite) || !f.remis_le || !(f.beneficiaire?.trim() || f.chauffeur || cible)} onClick={remettre} className={PRINCIPAL}>Enregistrer la dotation</button>
        {cible && <button onClick={vider} className={BOUTON}>Annuler</button>}
      </div>
    </Panneau>}
    {cible?.type === 'restituer' && <Panneau titre="Restitution">
      <div role="form" aria-label="Restitution EPI" className="grid gap-3 sm:grid-cols-3">
        {champ('restitue_le', 'Restitué le *', 'date')}
        <label className="text-sm">État *<select aria-label="État *" value={f.etat ?? ''} onChange={(e) => maj('etat', e.target.value)} className={CHAMP}>
          <option value="">Choisir</option>{Object.entries(ETATS_RESTITUTION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        {champ('note', 'Note')}
      </div>
      <div className="mt-3 flex gap-2"><button disabled={busy || !f.restitue_le || !f.etat} className={PRINCIPAL}
        onClick={() => executer('restituer_epi', { p_dotation: cible.id, p_restitue_le: f.restitue_le, p_etat: f.etat, p_note: f.note?.trim() || null }, 'Restitution enregistrée.')}>Enregistrer la restitution</button>
        <button onClick={vider} className={BOUTON}>Annuler</button></div>
    </Panneau>}
    <Panneau titre="Dotations">
      {dotations === null ? <p>Chargement…</p> : dotations.length === 0 ? <SansDonnees message="Aucune dotation enregistrée" /> :
        <ul className="divide-y divide-stone-100 text-sm">{dotations.map((x) => { const ech = x.statut === 'remis' ? etatEcheanceEpi(x.echeance_renouvellement, aujourdhui) : null; return <li key={x.id} className="flex flex-wrap items-center gap-2 py-2">
          <span className="min-w-64 flex-1"><b>{x.numero}</b> · {x.beneficiaire} · {TYPES_EPI[x.type_epi] ?? x.type_epi}{x.designation ? ` (${x.designation})` : ''} × {x.quantite}
            <span className="block text-xs text-stone-500">{nomSite.get(x.site_id) ?? '?'} · remis le {d(x.remis_le)} · échéance {x.echeance_renouvellement ? d(x.echeance_renouvellement) : 'non saisie'}
              {x.restitue_le ? ` · restitué le ${d(x.restitue_le)} (${ETATS_RESTITUTION[x.etat_restitution ?? ''] ?? ''})` : ''}{x.motif_annulation ? ` · ${x.motif_annulation}` : ''}</span></span>
          <Puce teinte={STATUTS_DOTATION[x.statut]?.teinte ?? 'gris'}>{STATUTS_DOTATION[x.statut]?.texte ?? x.statut}</Puce>
          {ech === 'echue' && <Puce teinte="rouge">À renouveler</Puce>}
          {peutEcrire && x.statut === 'remis' && <>
            <button className={BOUTON} aria-label={`Renouveler ${x.numero}`} onClick={() => { setCible({ type: 'renouveler', id: x.id }); setF({ site: x.site_id, type: x.type_epi, quantite: String(x.quantite), chauffeur: x.driver_id ?? '', beneficiaire: x.beneficiaire, remis_le: aujourdhui }); }}>Renouveler</button>
            <button className={BOUTON} aria-label={`Restituer ${x.numero}`} onClick={() => { setCible({ type: 'restituer', id: x.id }); setF({ restitue_le: aujourdhui }); }}>Restituer</button>
            <button className={BOUTON} aria-label={`Annuler ${x.numero}`} onClick={() => avecMotif('annuler_dotation_epi', { p_dotation: x.id }, 'Motif de l\'annulation (erreur de saisie) ?', 'Dotation annulée.')}>Annuler</button>
          </>}
        </li>; })}</ul>}
    </Panneau>
  </>;

  // Risques ------------------------------------------------------------------
  const enregistrerRisque = () => executer('enregistrer_risque', {
    p_risque: cible?.type === 'reviser' ? cible.id : null, p_site: f.site || null, p_danger: f.danger, p_zone: f.zone,
    p_gravite: entier(f.gravite), p_probabilite: entier(f.probabilite), p_mesures: f.mesures, p_responsable: f.responsable,
    p_revue_le: f.revue_le, p_prochaine_revue: f.prochaine_revue || null, p_statut: f.statut || 'actif', p_motif: f.motif?.trim() || null,
  }, cible ? 'Risque révisé (nouvelle version).' : 'Risque enregistré.');
  const cotation = (cle: string, libelle: string) => <label className="text-sm">{libelle}<select aria-label={libelle} value={f[cle] ?? ''} onChange={(e) => maj(cle, e.target.value)} className={CHAMP}>
    <option value="">Choisir</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>;
  const ongletRisques = () => <>
    {peutEcrire && <Panneau titre={cible?.type === 'reviser' ? 'Réviser le risque' : 'Nouveau risque'}>
      <div role="form" aria-label="Risque" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {!cible && choixSite()}
        {champ('danger', 'Danger *')}{champ('zone', 'Zone ou activité *')}{cotation('gravite', 'Gravité (1 à 5) *')}{cotation('probabilite', 'Probabilité (1 à 5) *')}
        {champ('mesures', 'Mesures *')}{champ('responsable', 'Responsable *')}{champ('revue_le', 'Revue du *', 'date')}{champ('prochaine_revue', 'Prochaine revue', 'date')}
        <label className="text-sm">Statut<select aria-label="Statut" value={f.statut ?? 'actif'} onChange={(e) => maj('statut', e.target.value)} className={CHAMP}><option value="actif">Actif</option><option value="clos">Clos</option></select></label>
        {cible && champ('motif', 'Motif de la révision *')}
      </div>
      <p className="mt-2 text-xs text-stone-500">Criticité affichée : gravité × probabilité saisies (échelle de 1 à 5). {criticite(entier(f.gravite), entier(f.probabilite)) ?? ''}</p>
      <div className="mt-3 flex gap-2">
        <button disabled={busy || (!cible && !f.site) || !f.danger?.trim() || !f.zone?.trim() || !f.gravite || !f.probabilite || !f.mesures?.trim() || !f.responsable?.trim() || !f.revue_le || (!!cible && !f.motif?.trim())}
          onClick={enregistrerRisque} className={PRINCIPAL}>Enregistrer le risque</button>
        {cible && <button onClick={vider} className={BOUTON}>Annuler</button>}
      </div>
    </Panneau>}
    <Panneau titre="Registre des risques (version courante)">
      {risques === null ? <p>Chargement…</p> : risques.length === 0 ? <SansDonnees message="Aucun risque enregistré" /> :
        <ul className="divide-y divide-stone-100 text-sm">{risques.map((x) => <li key={x.id} className="flex flex-wrap items-center gap-2 py-2">
          <span className="min-w-64 flex-1"><b>{x.numero}</b> v{x.version} · {x.danger} · {x.zone_activite}
            <span className="block text-xs text-stone-500">{nomSite.get(x.site_id) ?? '?'} · G{x.gravite} × P{x.probabilite} = {criticite(x.gravite, x.probabilite)} · {x.mesures} · {x.responsable} · revue du {d(x.revue_le)}{x.prochaine_revue ? `, prochaine le ${d(x.prochaine_revue)}` : ''}</span></span>
          <Puce teinte={x.statut === 'actif' ? 'bleu' : 'gris'}>{x.statut === 'actif' ? 'Actif' : 'Clos'}</Puce>
          {x.revue_echue && <Puce teinte="rouge">Revue échue</Puce>}
          {peutEcrire && <button className={BOUTON} aria-label={`Réviser ${x.numero}`} onClick={() => { setCible({ type: 'reviser', id: x.id }); setF({ danger: x.danger, zone: x.zone_activite, gravite: String(x.gravite), probabilite: String(x.probabilite), mesures: x.mesures, responsable: x.responsable, revue_le: aujourdhui, statut: x.statut }); }}>Réviser</button>}
        </li>)}</ul>}
    </Panneau>
  </>;

  // Plans de prevention ------------------------------------------------------
  const enregistrerPlan = () => executer('enregistrer_plan_prevention', {
    p_plan: cible?.type === 'modifier' ? cible.id : null, p_site: f.site || null, p_intervenant: f.intervenant, p_perimetre: f.perimetre,
    p_risques: f.risques, p_mesures: f.mesures, p_valide_du: f.valide_du, p_valide_au: f.valide_au,
    p_responsable_intervenant: f.responsable_intervenant?.trim() || null, p_remplace: cible?.type === 'version' ? cible.id : null,
  }, cible?.type === 'version' ? 'Nouvelle version enregistrée, à signer.' : 'Plan enregistré, à signer.');
  const ongletPlans = () => <>
    {peutEcrire && <Panneau titre={cible?.type === 'version' ? 'Nouvelle version du plan' : cible?.type === 'modifier' ? 'Modifier le plan à signer' : 'Nouveau plan de prévention'}>
      <div role="form" aria-label="Plan de prévention" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {!cible && choixSite()}
        {champ('intervenant', 'Entreprise intervenante *')}{champ('responsable_intervenant', 'Responsable de l\'intervenant')}{champ('perimetre', 'Périmètre *')}
        {champ('risques', 'Risques *')}{champ('mesures', 'Mesures *')}{champ('valide_du', 'Valide du *', 'date')}{champ('valide_au', 'Valide au *', 'date')}
      </div>
      <div className="mt-3 flex gap-2">
        <button disabled={busy || (!cible && !f.site) || !f.intervenant?.trim() || !f.perimetre?.trim() || !f.risques?.trim() || !f.mesures?.trim() || !f.valide_du || !f.valide_au}
          onClick={enregistrerPlan} className={PRINCIPAL}>Enregistrer le plan</button>
        {cible && <button onClick={vider} className={BOUTON}>Annuler</button>}
      </div>
    </Panneau>}
    <Panneau titre="Plans de prévention">
      {plans === null ? <p>Chargement…</p> : plans.length === 0 ? <SansDonnees message="Aucun plan de prévention" /> :
        <ul className="divide-y divide-stone-100 text-sm">{plans.map((x) => <li key={x.id} className="flex flex-wrap items-center gap-2 py-2">
          <span className="min-w-64 flex-1"><b>{x.numero}</b> v{x.version} · {x.intervenant} · {x.perimetre}
            <span className="block text-xs text-stone-500">{nomSite.get(x.site_id) ?? '?'} · du {d(x.valide_du)} au {d(x.valide_au)} · risques : {x.risques} · mesures : {x.mesures}
              {x.signataire ? ` · signé par ${x.signataire} le ${d(x.signe_le)}` : ''}{x.motif_annulation ? ` · ${x.motif_annulation}` : ''}</span></span>
          <Puce teinte={ETATS_PLAN[x.etat]?.teinte ?? 'gris'}>{ETATS_PLAN[x.etat]?.texte ?? x.etat}</Puce>
          {x.statut === 'brouillon' && peutSigner && <button className={PRINCIPAL} aria-label={`Signer ${x.numero} v${x.version}`}
            onClick={() => { if (window.confirm(`Signer le plan ${x.numero} v${x.version} ? Il ne sera plus modifiable.`)) executer('signer_plan_prevention', { p_plan: x.id }, 'Plan signé.'); }}>Signer</button>}
          {x.statut === 'brouillon' && peutEcrire && <button className={BOUTON} onClick={() => { setCible({ type: 'modifier', id: x.id }); setF({ intervenant: x.intervenant, responsable_intervenant: x.responsable_intervenant ?? '', perimetre: x.perimetre, risques: x.risques, mesures: x.mesures, valide_du: x.valide_du, valide_au: x.valide_au }); }}>Modifier</button>}
          {x.statut === 'signe' && peutEcrire && <button className={BOUTON} aria-label={`Nouvelle version ${x.numero}`} onClick={() => { setCible({ type: 'version', id: x.id }); setF({ intervenant: x.intervenant, responsable_intervenant: x.responsable_intervenant ?? '', perimetre: x.perimetre, risques: x.risques, mesures: x.mesures, valide_du: x.valide_du, valide_au: x.valide_au }); }}>Nouvelle version</button>}
          {['brouillon', 'signe'].includes(x.statut) && peutEcrire && <button className={BOUTON} onClick={() => avecMotif('annuler_plan_prevention', { p_plan: x.id }, 'Motif de l\'annulation ?', 'Plan annulé.')}>Annuler</button>}
        </li>)}</ul>}
      {!peutSigner && <p className="mt-2 text-xs text-stone-500">La signature est réservée aux titulaires du droit d'approbation de l'exploitation.</p>}
    </Panneau>
  </>;

  // Inspections --------------------------------------------------------------
  const [constatsSaisis, setConstatsSaisis] = useState<{ gravite: string; description: string }[]>([]);
  const realiser = (i: Inspection) => executer('realiser_inspection', {
    p_inspection: i.id, p_realisee_le: f.realisee_le ? new Date(f.realisee_le).toISOString() : null, p_conclusion: f.conclusion,
    p_constats: constatsSaisis.filter((c) => c.description.trim()).map((c) => ({ description: c.description.trim(), gravite: c.gravite })),
  }, 'Inspection réalisée.').then((ok) => { if (ok) setConstatsSaisis([]); });
  const ongletInspections = () => <>
    {peutEcrire && <div className="grid gap-5 xl:grid-cols-2">
      <Panneau titre="Programme d'inspection">
        <div role="form" aria-label="Programme d'inspection" className="grid gap-3 sm:grid-cols-2">
          {choixSite()}{champ('libelle', 'Libellé *')}{champ('zone', 'Zone')}{champ('frequence', 'Fréquence (jours) *')}{champ('responsable', 'Responsable *')}{champ('premiere', 'Première inspection le *', 'date')}
        </div>
        <button className={`mt-3 ${PRINCIPAL}`} disabled={busy || !f.site || !f.libelle?.trim() || !entier(f.frequence) || !f.responsable?.trim() || !f.premiere}
          onClick={() => executer('definir_programme_inspection', { p_site: f.site, p_libelle: f.libelle, p_frequence_jours: entier(f.frequence), p_responsable: f.responsable, p_premiere: f.premiere, p_zone: f.zone?.trim() || null }, 'Programme créé, première inspection planifiée.')}>Créer le programme</button>
      </Panneau>
      <Panneau titre="Inspection ponctuelle">
        <div role="form" aria-label="Inspection ponctuelle" className="grid gap-3 sm:grid-cols-2">
          {choixSite('Site de l\'inspection *')}{champ('objet', 'Objet *')}{champ('zone_i', 'Zone de l\'inspection')}{champ('responsable_i', 'Responsable de l\'inspection *')}{champ('prevue_le', 'Prévue le *', 'date')}
        </div>
        <button className={`mt-3 ${PRINCIPAL}`} disabled={busy || !f.site || !f.objet?.trim() || !f.responsable_i?.trim() || !f.prevue_le}
          onClick={() => executer('planifier_inspection', { p_site: f.site, p_objet: f.objet, p_responsable: f.responsable_i, p_prevue_le: f.prevue_le, p_zone: f.zone_i?.trim() || null }, 'Inspection planifiée.')}>Planifier</button>
      </Panneau>
    </div>}
    {programmes.length > 0 && <Panneau titre="Programmes">
      <ul className="divide-y divide-stone-100 text-sm">{programmes.map((p) => <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
        <span className="flex-1"><b>{p.libelle}</b> · tous les {p.frequence_jours} j · {p.responsable} · {nomSite.get(p.site_id) ?? '?'}</span>
        <Puce teinte={p.actif ? 'vert' : 'gris'}>{p.actif ? 'Actif' : 'Arrêté'}</Puce>
        {p.actif && peutEcrire && <button className={BOUTON} onClick={() => avecMotif('arreter_programme_inspection', { p_programme: p.id }, 'Motif de l\'arrêt du programme ?', 'Programme arrêté.')}>Arrêter</button>}
      </li>)}</ul>
    </Panneau>}
    <Panneau titre="Inspections">
      {inspections === null ? <p>Chargement…</p> : inspections.length === 0 ? <SansDonnees message="Aucune inspection planifiée" /> :
        <ul className="divide-y divide-stone-100 text-sm">{inspections.map((i) => { const retard = i.statut === 'planifiee' && i.prevue_le < aujourdhui; return <li key={i.id} className="py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-64 flex-1"><b>{i.numero}</b> · {i.objet}{i.zone ? ` · ${i.zone}` : ''}
              <span className="block text-xs text-stone-500">{nomSite.get(i.site_id) ?? '?'} · prévue le {d(i.prevue_le)} · {i.responsable}{i.realisee_le ? ` · réalisée le ${d(i.realisee_le)} : ${i.conclusion}` : ''}{i.motif_annulation ? ` · ${i.motif_annulation}` : ''}</span></span>
            <Puce teinte={STATUTS_INSPECTION[i.statut]?.teinte ?? 'gris'}>{STATUTS_INSPECTION[i.statut]?.texte ?? i.statut}</Puce>
            {retard && <Puce teinte="rouge">En retard</Puce>}
            {i.statut === 'planifiee' && peutEcrire && <>
              <button className={BOUTON} aria-label={`Réaliser ${i.numero}`} onClick={() => { setCible({ type: 'realiser', id: i.id }); setF({ realisee_le: '' }); setConstatsSaisis([]); }}>Réaliser</button>
              <button className={BOUTON} onClick={() => avecMotif('annuler_inspection', { p_inspection: i.id }, 'Motif de l\'annulation ?', 'Inspection annulée.')}>Annuler</button>
            </>}
            {i.statut === 'realisee' && peutEcrire && <button className={BOUTON} aria-label={`Action corrective ${i.numero}`} onClick={() => { setCible({ type: 'action', id: i.id }); setF({}); }}>Action corrective</button>}
          </div>
          {cible?.id === i.id && cible.type === 'realiser' && <div role="form" aria-label={`Réalisation ${i.numero}`} className="mt-2 space-y-2 rounded-lg border border-stone-200 p-3">
            <div className="grid gap-3 sm:grid-cols-2">{champ('realisee_le', 'Réalisée le *', 'datetime-local')}{champ('conclusion', 'Conclusion *')}</div>
            {constatsSaisis.map((c, n) => <div key={n} className="flex gap-2">
              <select aria-label={`Gravité du constat ${n + 1}`} value={c.gravite} onChange={(e) => setConstatsSaisis(constatsSaisis.map((x, m) => (m === n ? { ...x, gravite: e.target.value } : x)))} className="rounded border border-stone-300 px-2 py-1">
                {Object.entries(GRAVITES_CONSTAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <input aria-label={`Constat ${n + 1}`} value={c.description} onChange={(e) => setConstatsSaisis(constatsSaisis.map((x, m) => (m === n ? { ...x, description: e.target.value } : x)))} className="flex-1 rounded border border-stone-300 px-2 py-1" placeholder="Description du constat" />
            </div>)}
            <div className="flex gap-2">
              <button className={BOUTON} onClick={() => setConstatsSaisis([...constatsSaisis, { gravite: 'mineur', description: '' }])}>Ajouter un constat</button>
              <button className={PRINCIPAL} disabled={busy || !f.realisee_le || !f.conclusion?.trim()} onClick={() => realiser(i)}>Enregistrer la réalisation</button>
              <button className={BOUTON} onClick={vider}>Annuler</button>
            </div>
          </div>}
          {cible?.id === i.id && cible.type === 'action' && <div role="form" aria-label={`Action ${i.numero}`} className="mt-2 grid gap-3 rounded-lg border border-stone-200 p-3 sm:grid-cols-4">
            {champ('libelle_a', 'Action *')}{champ('responsable_a', 'Responsable de l\'action *')}{champ('echeance_a', 'Échéance *', 'date')}
            <label className="text-sm">Constat<select aria-label="Constat" value={f.constat ?? ''} onChange={(e) => maj('constat', e.target.value)} className={CHAMP}>
              <option value="">Aucun</option>{constats.filter((c) => c.inspection_id === i.id).map((c) => <option key={c.id} value={c.id}>{c.description}</option>)}</select></label>
            <div className="flex gap-2 sm:col-span-4"><button className={PRINCIPAL} disabled={busy || !f.libelle_a?.trim() || !f.responsable_a?.trim() || !f.echeance_a}
              onClick={() => executer('ajouter_action_inspection', { p_inspection: i.id, p_libelle: f.libelle_a, p_responsable: f.responsable_a, p_echeance: f.echeance_a, p_constat: f.constat || null }, 'Action corrective ajoutée.')}>Ajouter l'action</button>
              <button className={BOUTON} onClick={vider}>Annuler</button></div>
          </div>}
          {constats.filter((c) => c.inspection_id === i.id).map((c) => <p key={c.id} className="ml-4 text-xs text-stone-600">Constat {GRAVITES_CONSTAT[c.gravite] ?? c.gravite} : {c.description}</p>)}
          {actions.filter((a) => a.inspection_id === i.id).map((a) => <p key={a.id} className="ml-4 flex flex-wrap items-center gap-2 text-xs">
            Action : {a.libelle} · {a.responsable} · échéance {d(a.echeance)} · {a.statut === 'ouverte' ? (a.echeance < aujourdhui ? 'en retard' : 'ouverte') : a.statut}{a.preuve ? ` · ${a.preuve}` : ''}
            {a.statut === 'ouverte' && peutEcrire && <button className="rounded border border-stone-300 px-2 py-0.5" aria-label={`Réaliser l'action ${a.libelle}`} onClick={() => {
              const preuve = window.prompt('Preuve de réalisation (référence, photo, OT) ?');
              if (preuve?.trim()) executer('solder_action_corrective', { p_action: a.id, p_realisee: true, p_texte: preuve.trim() }, 'Action réalisée.');
            }}>Réaliser</button>}
          </p>)}
        </li>; })}</ul>}
    </Panneau>
  </>;

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Prévention HSE</h2>
        <p className="text-sm text-stone-500">Équipements de protection, registre des risques, plans de prévention des entreprises extérieures et inspections planifiées.</p></div>
      <button onClick={charger} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
    </header>
    <nav className="flex flex-wrap gap-2" aria-label="Rubriques HSE">{ONGLETS.map((o) => <button key={o.id} onClick={() => { setOnglet(o.id); vider(); }}
      aria-pressed={onglet === o.id} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${onglet === o.id ? 'bg-stone-900 text-white' : 'border border-stone-200 bg-white'}`}>{o.libelle}</button>)}</nav>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {onglet === 'epi' && ongletEpi()}
    {onglet === 'risques' && ongletRisques()}
    {onglet === 'plans' && ongletPlans()}
    {onglet === 'inspections' && ongletInspections()}
  </div>;
};
