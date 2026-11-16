import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Download, Lock, Printer, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { exportToCSV, exportToPDF } from '../../lib/exports';
import {
  RAPPORTS, argumentsRapport, bornesMois, grouperParSection, lignesExport, nomFichier, rapportVide, texteValeur, titreRapport,
  type LigneRapport, type TypeRapport,
} from '../../lib/rapports';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';

// Rapports standard (D-058) : chaque rapport est calcule par une fonction
// serveur sur les donnees reelles, avec les droits et le perimetre du
// lecteur. Une valeur absente reste « sans donnees » avec sa raison ;
// l'export CSV et l'impression reprennent exactement les lignes affichees.
// Un rapport peut etre fige (append-only) par un titulaire du droit
// d'ecriture sur les rapports.

interface Lib { id: string; libelle: string }
interface Poste { id: string; date_poste: string; shift_id: string; site_id: string; statut: string }
interface Jour {
  jour: string; voyages: number | null; voyages_livres: number | null; tonnes_livrees: number | null; tonnes_acceptees: number | null;
  litres: number | null; incidents: number | null; immobilisations_declarees: number | null; heures_pointees: number | null;
}
interface Fige { id: string; numero: string; type: TypeRapport; periode_debut: string; periode_fin: string; site_id: string | null; lignes: LigneRapport[]; note: string | null; fige_le: string }

const CHAMP = 'mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm';
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const moisCourant = () => new Date().toISOString().slice(0, 7);
const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const cellule = (v: number | null) => (v === null || v === undefined ? '—' : nombre.format(Number(v)));
const STATUT_POSTE: Record<string, string> = { ouvert: 'ouvert', cloture: 'clos', valide: 'validé' };

export const ReportsView = () => {
  const { hasPermission } = useAuth();
  const peutFiger = hasPermission('reports', 'create') || hasPermission('reports', 'edit');
  const [type, setType] = useState<TypeRapport>('journalier');
  const [jour, setJour] = useState(aujourdhui);
  const [mois, setMois] = useState(moisCourant);
  const [debut, setDebut] = useState(() => bornesMois(moisCourant())?.debut ?? '');
  const [fin, setFin] = useState(aujourdhui);
  const [site, setSite] = useState('');
  const [poste, setPoste] = useState('');
  const [sites, setSites] = useState<Lib[]>([]);
  const [shifts, setShifts] = useState<Lib[]>([]);
  const [postes, setPostes] = useState<Poste[]>([]);
  const [lignes, setLignes] = useState<LigneRapport[] | null>(null);
  const [jours, setJours] = useState<Jour[] | null>(null);
  const [figes, setFiges] = useState<Fige[] | null>(null);
  const [heure, setHeure] = useState<Date | null>(null);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [si, sh] = await Promise.all([
        supabase.from('sites').select('id, name').order('name'),
        supabase.from('work_shifts').select('id, display_name').order('shift_order'),
      ]);
      setSites((si.data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string })));
      setShifts((sh.data ?? []).map((x) => ({ id: x.id as string, libelle: x.display_name as string })));
    })();
  }, []);

  const chargerFiges = useCallback(async () => {
    const { data, error } = await supabase.from('rapports_figes').select('*').order('fige_le', { ascending: false }).limit(20);
    if (error) setErreur(error.message);
    setFiges((data ?? []) as Fige[]);
  }, []);
  useEffect(() => { chargerFiges(); }, [chargerFiges]);

  // Postes du jour choisi pour le rapport de shift
  useEffect(() => {
    if (type !== 'shift') return;
    (async () => {
      let q = supabase.from('postes').select('id, date_poste, shift_id, site_id, statut').eq('date_poste', jour);
      if (site) q = q.eq('site_id', site);
      const { data } = await q.order('ouvert_le');
      const liste = (data ?? []) as Poste[];
      setPostes(liste);
      setPoste((p) => (liste.some((x) => x.id === p) ? p : liste[0]?.id ?? ''));
    })();
  }, [type, jour, site]);

  const args = useMemo(() => argumentsRapport(type, { jour, mois, debut, fin, site, poste }), [type, jour, mois, debut, fin, site, poste]);

  const charger = useCallback(async () => {
    setErreur(''); setMessage('');
    if (!args) { setLignes(null); setJours(null); return; }
    setLignes(null); setJours(null);
    const [r, j] = await Promise.all([
      supabase.rpc(RAPPORTS[type].fonction, args),
      type === 'mensuel' ? supabase.rpc('rapport_mensuel_par_jour', args) : Promise.resolve({ data: null, error: null }),
    ]);
    if (r.error || j.error) setErreur((r.error ?? j.error)?.message ?? '');
    setLignes((r.data ?? []) as LigneRapport[]);
    setJours(type === 'mensuel' ? ((j.data ?? []) as Jour[]) : null);
    setHeure(new Date());
  }, [args, type]);
  useEffect(() => { charger(); }, [charger]);

  const nomSite = (id: string | null) => sites.find((s) => s.id === id)?.libelle ?? null;
  const libellePoste = (p: Poste) => `${shifts.find((s) => s.id === p.shift_id)?.libelle ?? 'Shift'} · ${nomSite(p.site_id) ?? 'site'} · ${STATUT_POSTE[p.statut] ?? p.statut}`;
  const posteChoisi = postes.find((p) => p.id === poste) ?? null;
  const titre = titreRapport(type, { jour, mois, debut, fin, site: nomSite(site || null),
    poste: posteChoisi ? `${libellePoste(posteChoisi)} · ${posteChoisi.date_poste.split('-').reverse().join('/')}` : null });
  const vide = rapportVide(lignes);
  const sections = useMemo(() => grouperParSection(lignes ?? []), [lignes]);

  const exporter = () => exportToCSV(lignesExport(lignes ?? []), nomFichier(titre));
  const imprimer = () => exportToPDF(titre, lignesExport(lignes ?? []), nomFichier(titre));
  const exporterJours = () => exportToCSV((jours ?? []).map((x) => ({
    Jour: x.jour, Voyages: x.voyages ?? '', 'Voyages livrés': x.voyages_livres ?? '', 'Tonnes livrées': x.tonnes_livrees ?? '',
    'Tonnes acceptées': x.tonnes_acceptees ?? '', 'Gasoil (L)': x.litres ?? '', Incidents: x.incidents ?? '',
    'Immobilisations déclarées': x.immobilisations_declarees ?? '', 'Heures pointées': x.heures_pointees ?? '',
  })), `${nomFichier(titre)}_par_jour`);

  const figer = async () => {
    if (!args) return;
    const note = window.prompt('Note jointe au rapport figé (facultative)') ?? null;
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await supabase.rpc('figer_rapport', {
      p_type: type,
      p_debut: type === 'journalier' ? jour : type === 'mensuel' ? bornesMois(mois)?.debut ?? null : type === 'shift' ? null : debut,
      p_fin: type === 'loueur' || type === 'client' ? fin : null,
      p_site: type === 'shift' ? null : site || null,
      p_poste: type === 'shift' ? poste : null,
      p_note: note?.trim() || null,
    });
    setBusy(false);
    if (error) { setErreur(error.message); return; }
    setMessage('Rapport figé.');
    await chargerFiges();
  };

  const titreFige = (f: Fige) => `${f.numero} · ${RAPPORTS[f.type]?.libelle ?? f.type} · ${f.periode_debut === f.periode_fin
    ? f.periode_debut.split('-').reverse().join('/') : `${f.periode_debut.split('-').reverse().join('/')} au ${f.periode_fin.split('-').reverse().join('/')}`}`;

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Rapports</h2>
        <p className="text-sm text-stone-500">Rapports calculés sur les données enregistrées, selon vos droits et votre périmètre. Une donnée absente est signalée, jamais estimée.</p></div>
      <button onClick={charger} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
    </header>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}

    <Panneau titre="Paramètres">
      <div role="form" aria-label="Paramètres du rapport" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">Rapport<select value={type} onChange={(e) => setType(e.target.value as TypeRapport)} className={CHAMP}>
          {(Object.keys(RAPPORTS) as TypeRapport[]).map((k) => <option key={k} value={k}>{RAPPORTS[k].libelle}</option>)}</select></label>
        {(type === 'journalier' || type === 'shift') && <label className="text-sm">Jour<input type="date" value={jour} onChange={(e) => setJour(e.target.value)} className={CHAMP} /></label>}
        {type === 'mensuel' && <label className="text-sm">Mois<input type="month" value={mois} onChange={(e) => setMois(e.target.value)} className={CHAMP} /></label>}
        {(type === 'loueur' || type === 'client') && <>
          <label className="text-sm">Du<input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Au<input type="date" value={fin} onChange={(e) => setFin(e.target.value)} className={CHAMP} /></label>
        </>}
        <label className="text-sm">Site<select value={site} onChange={(e) => setSite(e.target.value)} className={CHAMP}>
          <option value="">Tous les sites du périmètre</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}</select></label>
        {type === 'shift' && <label className="text-sm">Poste<select value={poste} onChange={(e) => setPoste(e.target.value)} className={CHAMP}>
          {postes.length === 0 && <option value="">Aucun poste ce jour</option>}
          {postes.map((p) => <option key={p.id} value={p.id}>{libellePoste(p)}</option>)}</select></label>}
      </div>
      <p className="mt-2 text-xs text-stone-500">{RAPPORTS[type].description}.</p>
    </Panneau>

    <Panneau titre={titre} action={<div className="flex flex-wrap gap-2">
      <button disabled={vide} onClick={exporter} className="flex items-center gap-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm disabled:opacity-50"><Download className="h-4 w-4" /> Export CSV</button>
      <button disabled={vide} onClick={imprimer} className="flex items-center gap-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm disabled:opacity-50"><Printer className="h-4 w-4" /> Imprimer</button>
      {peutFiger && <button disabled={busy || vide || !args || (type === 'shift' && posteChoisi?.statut === 'ouvert')} onClick={figer}
        title={type === 'shift' && posteChoisi?.statut === 'ouvert' ? 'Un rapport de shift se fige après la clôture du poste' : undefined}
        className="flex items-center gap-1 rounded-lg bg-orange-700 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"><Lock className="h-4 w-4" /> Figer</button>}
    </div>}>
      {!args ? <SansDonnees message={type === 'shift' ? 'Aucun poste ce jour' : 'Paramètres incomplets'} detail={type === 'shift' ? 'Choisissez un jour où un poste a été ouvert (Postes de travail).' : 'Vérifiez la période.'} />
        : lignes === null ? <p className="text-sm text-stone-500">Calcul…</p>
        : vide ? <SansDonnees detail="Aucun enregistrement pour ces paramètres dans votre périmètre." />
        : <div className="space-y-4">{sections.map((s) => <div key={s.section}>
          <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-stone-500">{s.section}</h3>
          <table className="w-full text-sm"><tbody>{s.lignes.map((l) => <tr key={`${l.rang}-${l.indicateur}`} className="border-b border-stone-100">
            <td className="py-1.5 pr-3">{l.indicateur}</td>
            <td className={`py-1.5 pr-3 text-right ${l.valeur === null ? 'text-stone-400' : 'font-semibold'}`}>{texteValeur(l)}</td>
            <td className="py-1.5 pr-3 text-xs text-stone-500">{l.manquants ? <Puce teinte="orange">{l.manquants} sans mesure</Puce> : null}{l.valeur !== null && l.remarque ? ` ${l.remarque}` : ''}</td>
            <td className="py-1.5 text-xs text-stone-400">{l.source}</td>
          </tr>)}</tbody></table>
        </div>)}</div>}
      <Provenance source="fonctions serveur de rapport (RLS et périmètre du lecteur)" heure={heure} />
    </Panneau>

    {type === 'mensuel' && jours && jours.length > 0 && !vide && <Panneau titre="Jour par jour" action={<button onClick={exporterJours}
      className="flex items-center gap-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm"><Download className="h-4 w-4" /> Export CSV</button>}>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500">
        <th className="py-2 pr-3">Jour</th><th className="py-2 pr-3 text-right">Voyages</th><th className="py-2 pr-3 text-right">Livrés</th><th className="py-2 pr-3 text-right">Tonnes livrées</th>
        <th className="py-2 pr-3 text-right">Tonnes acceptées</th><th className="py-2 pr-3 text-right">Gasoil (L)</th><th className="py-2 pr-3 text-right">Incidents</th>
        <th className="py-2 pr-3 text-right">Immobilisations</th><th className="py-2 text-right">Heures pointées</th></tr></thead>
        <tbody>{jours.map((x) => <tr key={x.jour} className="border-b border-stone-100">
          <td className="py-1.5 pr-3">{x.jour.split('-').reverse().join('/')}</td><td className="py-1.5 pr-3 text-right">{cellule(x.voyages)}</td>
          <td className="py-1.5 pr-3 text-right">{cellule(x.voyages_livres)}</td><td className="py-1.5 pr-3 text-right">{cellule(x.tonnes_livrees)}</td>
          <td className="py-1.5 pr-3 text-right">{cellule(x.tonnes_acceptees)}</td><td className="py-1.5 pr-3 text-right">{cellule(x.litres)}</td>
          <td className="py-1.5 pr-3 text-right">{cellule(x.incidents)}</td><td className="py-1.5 pr-3 text-right">{cellule(x.immobilisations_declarees)}</td>
          <td className="py-1.5 text-right">{cellule(x.heures_pointees)}</td></tr>)}</tbody></table></div>
      <p className="mt-2 text-xs text-stone-400">« — » : sans donnée ou non visible avec vos droits.</p>
    </Panneau>}

    <Panneau titre="Rapports figés">
      {figes === null ? <p className="text-sm text-stone-500">Chargement…</p> : figes.length === 0 ? <SansDonnees message="Aucun rapport figé" /> :
        <ul className="divide-y divide-stone-100 text-sm">{figes.map((f) => <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <div><Archive className="mr-1 inline h-4 w-4" /><b>{titreFige(f)}</b>{f.site_id ? ` · ${nomSite(f.site_id) ?? 'site'}` : ''}
            <span className="block text-xs text-stone-500">Figé le {new Date(f.fige_le).toLocaleString('fr-FR')}{f.note ? ` · ${f.note}` : ''}</span></div>
          <div className="flex gap-1">
            <button onClick={() => exportToCSV(lignesExport(f.lignes), nomFichier(titreFige(f)))} aria-label={`Exporter ${f.numero}`} className="rounded border border-stone-300 px-2 py-1 text-xs">CSV</button>
            <button onClick={() => exportToPDF(titreFige(f), lignesExport(f.lignes), nomFichier(titreFige(f)))} aria-label={`Imprimer ${f.numero}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Imprimer</button>
          </div>
        </li>)}</ul>}
    </Panneau>
  </div>;
};
