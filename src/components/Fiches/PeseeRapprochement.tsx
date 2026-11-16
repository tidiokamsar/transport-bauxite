import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Scale } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { exportToCSV } from '../../lib/exports';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import { CLASSES, libelleTolerance } from './pesee';
import { CHAMP, dateHeure, nombre, type ContextePesee } from './peseeContexte';

// Espace C : rapprochement CBG x KOGON x rotation, cote a cote (derniere
// passe en vigueur ; les passes precedentes restent en base). Plusieurs
// constats par ligne ; une rotation candidate est proposee, jamais
// rattachee d'office. Parametrage versionne de la tolerance.

interface Releve { id: string; reference: string; site_id: string | null; statut: string; rapproche_pesees_le: string | null }
interface Ligne {
  id: string; releve_id: string; ligne_id: string | null; releve_kogon_id: string | null; trip_id: string | null; trips_candidats: string[];
  site_id: string | null; ticket: string | null; date_cbg: string | null; immatriculation_cbg: string | null; net_cbg: number | null;
  heure_kogon: string | null; immatriculation_kogon: string | null; net_kogon: number | null; ecart_t: number | null; ecart_pct: number | null;
  source_tolerance: string | null; classes: string[]; detail: string | null; passe_numero: number; passe_le: string;
}
interface Tolerance { tolerance_t: number | null; tolerance_pct: number | null; source: string }
interface Parametre { id: string; site_id: string | null; version: number; tolerance_t: number | null; tolerance_pct: number | null; motif: string; defini_le: string }

export const PeseeRapprochement = ({ ctx, releveInitial }: { ctx: ContextePesee; releveInitial: string | null }) => {
  const [releves, setReleves] = useState<Releve[] | null>(null);
  const [choisi, setChoisi] = useState<string>(releveInitial ?? '');
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [tolerance, setTolerance] = useState<Tolerance | null>(null);
  const [parametres, setParametres] = useState<Parametre[]>([]);
  const [filtre, setFiltre] = useState({ classe: '', site: '', du: '', au: '' });
  const [param, setParam] = useState({ site: '', t: '', pct: '', motif: '' });
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const chargerReleves = useCallback(async () => {
    const [r, p] = await Promise.all([
      supabase.from('releves_cbg').select('id, reference, site_id, statut, rapproche_pesees_le').neq('statut', 'annule').order('importe_le', { ascending: false }).limit(50),
      supabase.from('parametres_tolerance_pesee').select('id, site_id, version, tolerance_t, tolerance_pct, motif, defini_le').order('defini_le', { ascending: false }).limit(20),
    ]);
    setErreur(r.error?.message ?? p.error?.message ?? '');
    setReleves((r.data ?? []) as Releve[]);
    setParametres((p.data ?? []) as Parametre[]);
  }, []);
  useEffect(() => { chargerReleves(); }, [chargerReleves]);

  const releve = (releves ?? []).find((r) => r.id === choisi);
  const chargerLignes = useCallback(async () => {
    if (!choisi) { setLignes(null); setTolerance(null); return; }
    const [l, t] = await Promise.all([
      supabase.from('v_rapprochements_pesee_courants').select('*').eq('releve_id', choisi).limit(2000),
      supabase.rpc('tolerance_pesee_applicable', { p_site_id: releve?.site_id ?? null }),
    ]);
    if (l.error || t.error) setErreur(l.error?.message ?? t.error?.message ?? '');
    setLignes((l.data ?? []) as Ligne[]);
    setTolerance(((t.data ?? []) as Tolerance[])[0] ?? null);
  }, [choisi, releve?.site_id]);
  useEffect(() => { chargerLignes(); }, [chargerLignes]);

  const nomSite = useMemo(() => new Map(ctx.sites.map((s) => [s.id, s.libelle])), [ctx.sites]);
  const refVoyage = useMemo(() => new Map(ctx.voyages.map((v) => [v.id, v.reference])), [ctx.voyages]);
  const jour = (l: Ligne) => l.date_cbg ?? l.heure_kogon?.slice(0, 10) ?? '';
  const visibles = (lignes ?? []).filter((l) => (!filtre.classe || l.classes.includes(filtre.classe))
    && (!filtre.site || l.site_id === filtre.site) && (!filtre.du || jour(l) >= filtre.du) && (!filtre.au || (jour(l) && jour(l) <= filtre.au)));
  const compte = (lignes ?? []).reduce<Record<string, number>>((acc, l) => { l.classes.forEach((c) => { acc[c] = (acc[c] ?? 0) + 1; }); return acc; }, {});

  const relancer = async () => {
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await supabase.rpc('rapprocher_pesees', { p_releve_id: choisi });
    setBusy(false);
    if (error) { setErreur(error.message); return; }
    setMessage('Nouvelle passe de rapprochement effectuée ; les anomalies déjà ouvertes ne sont pas recréées.');
    await chargerLignes();
  };
  const definirTolerance = async () => {
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await supabase.rpc('definir_tolerance_pesee', {
      p_site_id: param.site || null, p_tolerance_t: param.t.trim() ? Number(param.t.replace(',', '.')) : null,
      p_tolerance_pct: param.pct.trim() ? Number(param.pct.replace(',', '.')) : null, p_motif: param.motif,
    });
    setBusy(false);
    if (error) { setErreur(error.message); return; }
    setMessage('Tolérance enregistrée (nouvelle version) ; elle s\'applique aux prochains rapprochements.');
    setParam({ site: '', t: '', pct: '', motif: '' });
    await chargerReleves(); await chargerLignes();
  };
  const exporter = () => exportToCSV(visibles.map((l) => ({
    Ticket: l.ticket ?? '', Date_CBG: l.date_cbg ?? '', Camion_CBG: l.immatriculation_cbg ?? '', Net_CBG_t: l.net_cbg ?? '',
    Heure_KOGON: l.heure_kogon ?? '', Camion_KOGON: l.immatriculation_kogon ?? '', Net_KOGON_t: l.net_kogon ?? '',
    Rotation: l.trip_id ? refVoyage.get(l.trip_id) ?? l.trip_id : '', Candidats: l.trips_candidats.map((t) => refVoyage.get(t) ?? t).join(' '),
    Ecart_t: l.ecart_t ?? '', Ecart_pct: l.ecart_pct ?? '', Tolerance: l.source_tolerance ?? '', Classes: l.classes.map((c) => CLASSES[c]?.libelle ?? c).join(' + '),
    Detail: l.detail ?? '', Passe: l.passe_numero,
  })), `rapprochement-pesee-${releve?.reference ?? ''}`);

  return <div className="space-y-5">
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}

    <Panneau titre="Rapprochement relevé CBG, fiche KOGON, rotation">
      {releves === null ? <p className="text-sm text-stone-500">Chargement des relevés…</p> : releves.length === 0 ? <SansDonnees message="Aucun relevé à rapprocher" detail="Importez d'abord un relevé officiel CBG (espace A)." /> : <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="text-sm">Relevé<select value={choisi} onChange={(e) => setChoisi(e.target.value)} className={CHAMP}><option value="">Choisir</option>
            {releves.map((r) => <option key={r.id} value={r.id}>{r.reference}{r.rapproche_pesees_le ? '' : ' (non rapproché)'}</option>)}</select></label>
          <label className="text-sm">Classe<select value={filtre.classe} onChange={(e) => setFiltre({ ...filtre, classe: e.target.value })} className={CHAMP}><option value="">Toutes</option>
            {Object.entries(CLASSES).map(([k, v]) => <option key={k} value={k}>{v.libelle}{compte[k] ? ` (${compte[k]})` : ''}</option>)}</select></label>
          <label className="text-sm">Site<select value={filtre.site} onChange={(e) => setFiltre({ ...filtre, site: e.target.value })} className={CHAMP}><option value="">Tous</option>
            {ctx.sites.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}</select></label>
          <label className="text-sm">Du<input type="date" value={filtre.du} onChange={(e) => setFiltre({ ...filtre, du: e.target.value })} className={CHAMP} /></label>
          <label className="text-sm">Au<input type="date" value={filtre.au} onChange={(e) => setFiltre({ ...filtre, au: e.target.value })} className={CHAMP} /></label>
        </div>
        {choisi && <p role="status" className="mt-3 rounded-lg bg-stone-50 p-2 text-xs text-stone-600">{libelleTolerance(tolerance)}{releve?.site_id ? ` (site ${nomSite.get(releve.site_id) ?? ''})` : ''}. Chaque ligne garde la tolérance qui lui a été appliquée.</p>}
        {choisi && <div className="mt-3 flex flex-wrap gap-2">
          {ctx.peutEcrire && <button disabled={busy} onClick={relancer} className="flex items-center gap-2 rounded-lg bg-stone-800 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><Scale className="h-4 w-4" /> {releve?.rapproche_pesees_le ? 'Relancer le rapprochement' : 'Rapprocher'}</button>}
          <button onClick={exporter} disabled={visibles.length === 0} className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm disabled:opacity-50"><Download className="h-4 w-4" /> Exporter CSV</button>
        </div>}
      </>}
      {choisi && (lignes === null ? <p className="mt-3 text-sm text-stone-500">Chargement du rapprochement…</p> : lignes.length === 0
        ? <div className="mt-3"><SansDonnees message="Relevé non encore rapproché" detail="Lancez le rapprochement pour confronter les deux sources." /></div>
        : visibles.length === 0 ? <div className="mt-3"><SansDonnees message="Aucune ligne pour ces filtres" /></div>
        : <div className="mt-3 overflow-x-auto"><table aria-label="Rapprochement côte à côte" className="w-full text-xs"><thead><tr className="border-b text-left text-stone-500">
          <th className="py-2 pr-2">Ticket</th><th className="py-2 pr-2">CBG (officiel)</th><th className="py-2 pr-2">KOGON (terrain)</th><th className="py-2 pr-2">Rotation</th>
          <th className="py-2 pr-2 text-right">Écart</th><th className="py-2 pr-2">Constats</th><th className="py-2">Détail</th></tr></thead>
          <tbody>{visibles.map((l) => <tr key={l.id} className="border-b border-stone-100 align-top">
            <td className="py-2 pr-2 font-mono">{l.ticket ?? '-'}</td>
            <td className="py-2 pr-2">{l.ligne_id ? <>{l.date_cbg ?? 'date ?'} · {l.immatriculation_cbg ?? 'camion ?'} · <b>{nombre(l.net_cbg)}</b></> : <span className="text-stone-400">absent du relevé</span>}</td>
            <td className="py-2 pr-2">{l.releve_kogon_id ? <>{dateHeure(l.heure_kogon)} · {l.immatriculation_kogon ?? 'camion ?'} · <b>{nombre(l.net_kogon)}</b></> : <span className="text-stone-400">aucune fiche</span>}</td>
            <td className="py-2 pr-2">{l.trip_id ? refVoyage.get(l.trip_id) ?? 'hors liste' : l.trips_candidats.length > 0 ? `Candidat(s) : ${l.trips_candidats.map((t) => refVoyage.get(t) ?? '?').join(', ')}` : '-'}</td>
            <td className="py-2 pr-2 text-right">{l.ecart_t === null ? '-' : `${nombre(l.ecart_t)}${l.ecart_pct !== null ? ` (${l.ecart_pct} %)` : ''}`}</td>
            <td className="py-2 pr-2"><span className="flex flex-wrap gap-1">{l.classes.map((c) => <Puce key={c} teinte={CLASSES[c]?.teinte ?? 'gris'}>{CLASSES[c]?.libelle ?? c}</Puce>)}</span></td>
            <td className="py-2 text-stone-600">{l.detail ?? ''}</td></tr>)}</tbody></table>
          <p className="mt-2 text-[11px] text-stone-400">Source : passe n° {lignes[0].passe_numero} du {dateHeure(lignes[0].passe_le)} ; relevé officiel CBG et relevés terrain KOGON en vigueur.</p></div>)}
    </Panneau>

    <Panneau titre="Tolérance de rapprochement (versionnée)">
      <p className="mb-2 text-xs text-stone-500">Absolue (t) et relative (%), par site avec repli global. Chaque limite renseignée doit être respectée ; sans paramètre, tout écart non nul est signalé. Aucune valeur n'est proposée par défaut.</p>
      {ctx.peutParametrer && <div role="form" aria-label="Tolérance de pesée" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <label className="text-sm">Site<select value={param.site} onChange={(e) => setParam({ ...param, site: e.target.value })} className={CHAMP}><option value="">Global (tous sites)</option>
          {ctx.sites.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}</select></label>
        <label className="text-sm">Tolérance (t)<input inputMode="decimal" value={param.t} onChange={(e) => setParam({ ...param, t: e.target.value })} className={CHAMP} /></label>
        <label className="text-sm">Tolérance (%)<input inputMode="decimal" value={param.pct} onChange={(e) => setParam({ ...param, pct: e.target.value })} className={CHAMP} /></label>
        <label className="text-sm">Motif *<input value={param.motif} onChange={(e) => setParam({ ...param, motif: e.target.value })} className={CHAMP} /></label>
        <button disabled={busy || !param.motif.trim()} onClick={definirTolerance} className="mt-6 rounded-lg bg-orange-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer la version</button>
      </div>}
      {parametres.length === 0 ? <p role="status" className="mt-2 text-sm text-stone-500">Tolérance non paramétrée.</p> :
        <ul className="mt-2 divide-y divide-stone-100 text-sm">{parametres.map((p) => <li key={p.id} className="py-1.5">
          {p.site_id ? nomSite.get(p.site_id) ?? 'site' : 'Global'} · v{p.version} · {p.tolerance_t ?? '-'} t · {p.tolerance_pct ?? '-'} % · {dateHeure(p.defini_le)} · {p.motif}</li>)}</ul>}
    </Panneau>
  </div>;
};
