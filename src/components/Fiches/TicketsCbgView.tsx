import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileUp, RefreshCw, Scale } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { exportToCSV } from '../../lib/exports';
import { Panneau, Puce, SansDonnees, type TeintePuce } from '../ui/Panneau';
import { lireReleveCsv, type LigneReleve } from './releveCbg';

// Registre des tickets CBG et rapprochement des releves (D-050). CBG pese ;
// KOGON importe le releve CBG tel que recu, le rapproche des tickets
// integres aux voyages et decide chaque anomalie (accepte ou litige, motive).

interface Releve { id: string; reference: string; periode_debut: string; periode_fin: string; site_id: string | null; statut: 'importe' | 'rapproche'; importe_le: string }
interface Ecart { id: string; releve_id: string; ligne_id: string | null; ticket_id: string | null; nature: keyof typeof NATURES; detail: string | null; ecart_net: number | null; decision: 'accepte' | 'litige' | null; motif: string | null }
interface Ticket { id: string; trip_id: string; ticket: string; net: number; mesure_le: string; est_rectifie: boolean }
interface SansTicket { id: string; reference: string; planned_date: string; vehicle_id: string | null }
interface Lib { id: string; libelle: string }

const NATURES: Record<string, { libelle: string; teinte: TeintePuce }> = {
  concordant: { libelle: 'Concordant', teinte: 'vert' },
  ecart_poids: { libelle: 'Écart de poids', teinte: 'rouge' },
  immatriculation_differente: { libelle: 'Autre camion', teinte: 'rouge' },
  date_differente: { libelle: 'Autre date', teinte: 'orange' },
  absent_sigtb: { libelle: 'Inconnu de SIGTB', teinte: 'rouge' },
  manquant_releve: { libelle: 'Absent du relevé CBG', teinte: 'orange' },
  ligne_illisible: { libelle: 'Ligne illisible', teinte: 'gris' },
  doublon_releve: { libelle: 'Ticket en double dans le relevé', teinte: 'rouge' },
};
const CHAMP = 'mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm';

export const TicketsCbgView = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('trips', 'create') || hasPermission('trips', 'edit');
  const [releves, setReleves] = useState<Releve[] | null>(null);
  const [ecarts, setEcarts] = useState<Ecart[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [sansTicket, setSansTicket] = useState<SansTicket[]>([]);
  const [sites, setSites] = useState<Lib[]>([]);
  const [engins, setEngins] = useState<Map<string, string>>(new Map());
  const [choisi, setChoisi] = useState<string | null>(null);
  const [lecture, setLecture] = useState<{ fichier: string; lignes: LigneReleve[]; erreur?: string } | null>(null);
  const [champs, setChamps] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const [r, t, s, si, v] = await Promise.all([
      supabase.from('releves_cbg').select('id, reference, periode_debut, periode_fin, site_id, statut, importe_le').order('importe_le', { ascending: false }).limit(50),
      supabase.from('v_tickets_pesee_cbg_effectifs').select('id, trip_id, ticket, net, mesure_le, est_rectifie').order('mesure_le', { ascending: false }).limit(300),
      supabase.from('v_voyages_livres_sans_ticket').select('id, reference, planned_date, vehicle_id').order('planned_date', { ascending: false }).limit(200),
      supabase.from('sites').select('id, name').order('name'),
      supabase.from('vehicles').select('id, registration'),
    ]);
    setErreur(r.error?.message ?? t.error?.message ?? s.error?.message ?? '');
    setReleves((r.data ?? []) as Releve[]);
    setTickets((t.data ?? []) as Ticket[]);
    setSansTicket((s.data ?? []) as SansTicket[]);
    setSites((si.data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string })));
    setEngins(new Map((v.data ?? []).map((x) => [x.id as string, x.registration as string])));
  }, []);
  useEffect(() => { charger(); }, [charger]);
  useEffect(() => {
    if (!choisi) { setEcarts([]); return; }
    supabase.from('ecarts_releve_cbg').select('id, releve_id, ligne_id, ticket_id, nature, detail, ecart_net, decision, motif').eq('releve_id', choisi)
      .then(({ data, error }) => { if (error) setErreur(error.message); setEcarts((data ?? []) as Ecart[]); });
  }, [choisi, releves]);

  const nomSite = useMemo(() => new Map(sites.map((s) => [s.id, s.libelle])), [sites]);
  const ticketDe = useMemo(() => new Map(tickets.map((t) => [t.id, t.ticket])), [tickets]);
  const c = (k: string) => champs[k] ?? '';
  const poser = (k: string, v: string) => setChamps({ ...champs, [k]: v });
  const executer = async (action: () => PromiseLike<{ error: { message: string } | null }>, succes: string) => {
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await action();
    setBusy(false);
    if (error) { setErreur(error.message); return false; }
    setMessage(succes); await charger(); return true;
  };

  const lireFichier = async (f: File | undefined) => {
    if (!f) return;
    const texte = await f.text();
    const r = lireReleveCsv(texte);
    setLecture({ fichier: f.name, lignes: r.lignes, erreur: r.erreur });
  };
  const importer = () => lecture && executer(() => supabase.rpc('importer_releve_cbg', {
    p_reference: c('reference').trim(), p_du: c('du'), p_au: c('au'), p_site_id: c('site') || null, p_fichier: lecture.fichier, p_lignes: lecture.lignes,
  }), `Relevé importé (${lecture.lignes.length} lignes). Lancez le rapprochement.`).then((ok) => { if (ok) { setLecture(null); setChamps({}); } });
  const rapprocher = (r: Releve) => executer(() => supabase.rpc('rapprocher_releve_cbg', { p_releve_id: r.id }), 'Rapprochement effectué : traitez les anomalies.')
    .then((ok) => ok && setChoisi(r.id));
  const decider = (e: Ecart, decision: 'accepte' | 'litige') => {
    const motif = window.prompt(decision === 'litige' ? 'Motif du litige (contestation adressée à CBG…)' : 'Motif de l\'acceptation');
    if (!motif?.trim()) return;
    executer(() => supabase.rpc('decider_ecart_releve_cbg', { p_ecart_id: e.id, p_decision: decision, p_motif: motif }), 'Décision enregistrée.')
      .then(() => setChoisi(e.releve_id));
  };
  const exporter = () => exportToCSV(ecarts.map((e) => ({
    nature: NATURES[e.nature]?.libelle ?? e.nature, ticket: e.ticket_id ? ticketDe.get(e.ticket_id) ?? '' : '', detail: e.detail ?? '',
    ecart_net_t: e.ecart_net ?? '', decision: e.decision ?? '', motif: e.motif ?? '',
  })), 'rapprochement-releve-cbg');

  const anomalies = ecarts.filter((e) => e.nature !== 'concordant');
  const releve = (releves ?? []).find((r) => r.id === choisi);

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Tickets et relevés CBG</h2>
        <p className="text-sm text-stone-500">CBG pèse ; KOGON rapproche le relevé CBG des tickets intégrés aux voyages et traite les anomalies.</p></div>
      <button onClick={charger} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
    </header>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}

    {peutEcrire && <Panneau titre="Importer un relevé CBG (CSV)">
      <p className="mb-2 text-xs text-stone-500">Colonnes reconnues : ticket, date, immatriculation, brut, tare, net (séparateur ; ou ,). Le relevé est conservé tel que reçu.</p>
      <div role="form" aria-label="Import du relevé" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <label className="text-sm">Fichier CSV *<input aria-label="Fichier du relevé" type="file" accept=".csv,text/csv" onChange={(e) => lireFichier(e.target.files?.[0])} className={CHAMP} /></label>
        <label className="text-sm">Référence du relevé *<input value={c('reference')} onChange={(e) => poser('reference', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Du *<input type="date" value={c('du')} onChange={(e) => poser('du', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Au *<input type="date" value={c('au')} onChange={(e) => poser('au', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Site<select value={c('site')} onChange={(e) => poser('site', e.target.value)} className={CHAMP}><option value="">Tous sites</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}</select></label>
      </div>
      {lecture && (lecture.erreur ? <p role="alert" className="mt-2 text-sm text-red-700">{lecture.fichier} : {lecture.erreur}</p>
        : <p className="mt-2 text-sm text-stone-600">{lecture.fichier} : {lecture.lignes.length} ligne(s) lue(s).</p>)}
      <button disabled={busy || !lecture || !!lecture.erreur || lecture.lignes.length === 0 || !c('reference').trim() || !c('du') || !c('au')} onClick={importer}
        className="mt-3 flex items-center gap-2 rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><FileUp className="h-4 w-4" /> Importer le relevé</button>
    </Panneau>}

    <Panneau titre="Relevés CBG">
      {releves === null ? <p>Chargement…</p> : releves.length === 0 ? <SansDonnees message="Aucun relevé importé" /> :
        <ul className="divide-y divide-stone-100 text-sm">{releves.map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span><span className="font-mono font-semibold">{r.reference}</span> · {r.periode_debut} → {r.periode_fin} · {r.site_id ? nomSite.get(r.site_id) ?? '?' : 'tous sites'} · {r.statut === 'rapproche' ? <Puce teinte="vert">Rapproché</Puce> : <Puce teinte="orange">À rapprocher</Puce>}</span>
          <span className="flex gap-1">
            {peutEcrire && r.statut === 'importe' && <button disabled={busy} onClick={() => rapprocher(r)} aria-label={`Rapprocher ${r.reference}`} className="flex items-center gap-1 rounded bg-stone-800 px-2 py-1 text-xs font-bold text-white"><Scale className="h-3 w-3" /> Rapprocher</button>}
            {r.statut === 'rapproche' && <button onClick={() => setChoisi(r.id)} aria-label={`Résultat ${r.reference}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Résultat</button>}
          </span></li>)}</ul>}
    </Panneau>

    {releve && <Panneau titre={`Rapprochement ${releve.reference} : ${ecarts.length - anomalies.length} concordant(s), ${anomalies.length} anomalie(s)`}>
      <button onClick={exporter} className="mb-3 flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"><Download className="h-4 w-4" /> Exporter CSV</button>
      {anomalies.length === 0 ? <SansDonnees message="Aucune anomalie" /> : <ul className="divide-y divide-stone-100 text-sm">{anomalies.map((e) => <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
        <span><Puce teinte={NATURES[e.nature]?.teinte ?? 'gris'}>{NATURES[e.nature]?.libelle ?? e.nature}</Puce> {e.ticket_id && <span className="font-mono">{ticketDe.get(e.ticket_id)}</span>} {e.detail}
          {e.decision && <span className="ml-2 text-xs text-stone-500">{e.decision === 'litige' ? 'Litige' : 'Accepté'} : {e.motif}</span>}</span>
        {peutEcrire && !e.decision && <span className="flex gap-1">
          <button onClick={() => decider(e, 'accepte')} className="rounded border border-stone-300 px-2 py-1 text-xs">Accepter</button>
          <button onClick={() => decider(e, 'litige')} aria-label={`Litige ${e.detail ?? e.nature}`} className="rounded bg-red-700 px-2 py-1 text-xs font-bold text-white">Litige</button></span>}
      </li>)}</ul>}
    </Panneau>}

    <Panneau titre={`Voyages livrés sans ticket CBG (${sansTicket.length})`}>
      {sansTicket.length === 0 ? <SansDonnees message="Tous les voyages livrés ont un ticket" /> :
        <ul className="divide-y divide-stone-100 text-sm">{sansTicket.map((v) => <li key={v.id} className="py-1.5"><span className="font-mono">{v.reference}</span> · {v.planned_date} · {engins.get(v.vehicle_id ?? '') ?? '—'}</li>)}</ul>}
    </Panneau>

    <Panneau titre={`Registre des tickets intégrés (${tickets.length})`}>
      {tickets.length === 0 ? <SansDonnees message="Aucun ticket intégré" /> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500"><th className="py-2 pr-3">Ticket</th><th className="py-2 pr-3">Pesée</th><th className="py-2 pr-3 text-right">Net</th><th className="py-2">État</th></tr></thead>
          <tbody>{tickets.map((t) => <tr key={t.id} className="border-b border-stone-100"><td className="py-2 pr-3 font-mono">{t.ticket}</td><td className="py-2 pr-3">{new Date(t.mesure_le).toLocaleString('fr-FR')}</td>
            <td className="py-2 pr-3 text-right">{Number(t.net).toLocaleString('fr-FR')} t</td><td className="py-2">{t.est_rectifie ? <Puce teinte="orange">Rectifié</Puce> : <Puce teinte="gris">Source CBG</Puce>}</td></tr>)}</tbody></table></div>}
    </Panneau>
  </div>;
};
