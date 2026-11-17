import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, FileUp, Scale } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import { BoutonPieces } from '../ui/PiecesJointes';
import { analyserReleve, empreinteSha256, type AnalyseImport } from './pesee';
import { CHAMP, type ContextePesee, type Resultat } from './peseeContexte';

// Espace A : releves officiels CBG (source A). Import CSV controle dans le
// navigateur (colonnes, apercu, lignes rejetees avec motif, empreinte
// SHA-256), conservation telle que recue, annulation motivee. Excel natif,
// PDF et images : non pris en charge ici (aucune dependance de lecture
// presente ; PDF et images = pieces jointes, sans OCR), voir D-081.

interface Releve {
  id: string; reference: string; periode_debut: string; periode_fin: string; site_id: string | null;
  statut: 'importe' | 'rapproche' | 'annule'; importe_le: string; fichier_source: string | null; empreinte_sha256: string | null;
  lignes_rejetees: unknown[] | null; importe_par: string | null; motif_annulation: string | null; rapproche_pesees_le: string | null;
}
interface Rapport { acceptees: number; rejetees: number; doublons_inter_releves: number; incompletes: number }
interface Lecture extends AnalyseImport { fichier: string; empreinte: string }

const STATUT = { importe: ['À rapprocher', 'orange'], rapproche: ['Rapproché', 'vert'], annule: ['Annulé', 'gris'] } as const;

export const PeseeRelevesCbg = ({ ctx, onRapproche }: { ctx: ContextePesee; onRapproche: (id: string) => void }) => {
  const [releves, setReleves] = useState<Releve[] | null>(null);
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [champs, setChamps] = useState<Record<string, string>>({});
  const [annulation, setAnnulation] = useState<{ id: string; motif: string } | null>(null);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const r = await supabase.from('releves_cbg')
      .select('id, reference, periode_debut, periode_fin, site_id, statut, importe_le, importe_par, fichier_source, empreinte_sha256, lignes_rejetees, motif_annulation, rapproche_pesees_le')
      .order('importe_le', { ascending: false }).limit(50);
    if (r.error) setErreur(r.error.message);
    setReleves((r.data ?? []) as Releve[]);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const nomSite = useMemo(() => new Map(ctx.sites.map((s) => [s.id, s.libelle])), [ctx.sites]);
  const c = (k: string) => champs[k] ?? '';
  const poser = (k: string, v: string) => setChamps({ ...champs, [k]: v });
  const executer = async (action: () => PromiseLike<Resultat & { data?: unknown }>, succes: (d: unknown) => string) => {
    setBusy(true); setErreur(''); setMessage('');
    const { error, data } = await action();
    setBusy(false);
    if (error) { setErreur(error.message); return false; }
    setMessage(succes(data)); await charger(); return true;
  };

  const lireFichier = async (f: File | undefined) => {
    setLecture(null);
    if (!f) return;
    const octets = await f.arrayBuffer();
    const texte = new TextDecoder('utf-8').decode(octets);
    setLecture({ fichier: f.name, empreinte: await empreinteSha256(octets), ...analyserReleve(texte) });
  };
  const importer = () => lecture && executer(
    () => supabase.rpc('importer_releve_cbg_v2', {
      p_reference: c('reference').trim(), p_du: c('du'), p_au: c('au'), p_site_id: c('site') || null, p_fichier: lecture.fichier,
      p_empreinte: lecture.empreinte, p_lignes: lecture.lignes, p_rejets: lecture.rejets,
    }),
    (x) => { const d = x as Rapport | null; return `Relevé importé : ${d?.acceptees ?? 0} ligne(s) acceptée(s), ${d?.rejetees ?? 0} rejetée(s), ${d?.incompletes ?? 0} incomplète(s), ${d?.doublons_inter_releves ?? 0} ticket(s) déjà présent(s) dans un autre relevé. Lancez le rapprochement.`; },
  ).then((ok) => { if (ok) { setLecture(null); setChamps({}); } });
  const rapprocher = (r: Releve) => executer(() => supabase.rpc('rapprocher_pesees', { p_releve_id: r.id }), () => 'Rapprochement effectué.')
    .then((ok) => ok && onRapproche(r.id));
  const annuler = () => annulation && executer(() => supabase.rpc('annuler_releve_cbg', { p_releve_id: annulation.id, p_motif: annulation.motif }),
    () => 'Relevé annulé ; ses anomalies ouvertes sont closes avec ce motif.').then((ok) => ok && setAnnulation(null));

  const pretImport = !!lecture && !lecture.erreur && lecture.lignes.length > 0 && !!c('reference').trim() && !!c('du') && !!c('au') && c('au') >= c('du');

  return <div className="space-y-5">
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}

    {ctx.peutEcrire && <Panneau titre="Importer un relevé officiel CBG (CSV)">
      <p className="mb-2 text-xs text-stone-500">Colonnes exigées : ticket, date, et net (ou brut et tare) ; immatriculation reconnue. Séparateur ; ou ,. Le relevé est conservé tel que reçu, son empreinte SHA-256 empêche un second import du même fichier. Excel : enregistrer en CSV ; PDF et photos : pièces jointes (lot à venir).</p>
      <div role="form" aria-label="Import du relevé" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <label className="text-sm">Fichier CSV *<input aria-label="Fichier du relevé" type="file" accept=".csv,text/csv" onChange={(e) => lireFichier(e.target.files?.[0])} className={CHAMP} /></label>
        <label className="text-sm">Référence du relevé *<input value={c('reference')} onChange={(e) => poser('reference', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Du *<input type="date" value={c('du')} onChange={(e) => poser('du', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Au *<input type="date" value={c('au')} onChange={(e) => poser('au', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Site<select value={c('site')} onChange={(e) => poser('site', e.target.value)} className={CHAMP}><option value="">Tous sites</option>{ctx.sites.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}</select></label>
      </div>
      {lecture && (lecture.erreur ? <p role="alert" className="mt-3 text-sm text-red-700">{lecture.fichier} : {lecture.erreur}</p> : <div className="mt-3 space-y-2 text-sm">
        <p role="status" className="text-stone-700">{lecture.fichier} : {lecture.lignes.length} ligne(s) acceptée(s), {lecture.rejets.length} rejetée(s), {lecture.incompletes} incomplète(s). Empreinte <span className="font-mono text-xs">{lecture.empreinte.slice(0, 16)}…</span></p>
        <div className="overflow-x-auto"><table aria-label="Aperçu du relevé" className="w-full text-xs"><thead><tr className="border-b text-left text-stone-500">
          <th className="py-1 pr-2">Ticket</th><th className="py-1 pr-2">Date</th><th className="py-1 pr-2">Camion</th><th className="py-1 pr-2 text-right">Brut</th><th className="py-1 pr-2 text-right">Tare</th><th className="py-1 text-right">Net</th></tr></thead>
          <tbody>{lecture.lignes.slice(0, 10).map((l, i) => <tr key={i} className="border-b border-stone-100">
            <td className="py-1 pr-2 font-mono">{l.ticket || <span className="text-red-700">absent</span>}</td><td className="py-1 pr-2">{l.date || <span className="text-red-700">illisible</span>}</td>
            <td className="py-1 pr-2">{l.immatriculation || '-'}</td><td className="py-1 pr-2 text-right">{l.brut || '-'}</td><td className="py-1 pr-2 text-right">{l.tare || '-'}</td><td className="py-1 text-right">{l.net || '-'}</td></tr>)}</tbody></table>
          {lecture.lignes.length > 10 && <p className="mt-1 text-xs text-stone-500">… et {lecture.lignes.length - 10} autre(s) ligne(s).</p>}</div>
        {lecture.rejets.length > 0 && <ul aria-label="Lignes rejetées" className="text-xs text-red-700">{lecture.rejets.map((r) => <li key={r.rang}>Ligne {r.rang} : {r.motif}</li>)}</ul>}
      </div>)}
      <button disabled={busy || !pretImport} onClick={importer}
        className="mt-3 flex items-center gap-2 rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><FileUp className="h-4 w-4" /> Importer le relevé</button>
    </Panneau>}

    <Panneau titre="Relevés officiels CBG">
      {releves === null ? <p className="text-sm text-stone-500">Chargement des relevés…</p> : releves.length === 0 ? <SansDonnees message="Aucun relevé importé" /> :
        <ul className="divide-y divide-stone-100 text-sm">{releves.map((r) => <li key={r.id} className="py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span><span className="font-mono font-semibold">{r.reference}</span> · {r.periode_debut} → {r.periode_fin} · {r.site_id ? nomSite.get(r.site_id) ?? 'site hors référentiel' : 'tous sites'} · <Puce teinte={STATUT[r.statut][1]}>{STATUT[r.statut][0]}</Puce>
              <span className="ml-2 text-xs text-stone-500">{r.fichier_source ?? 'fichier non nommé'}{r.empreinte_sha256 ? ` · SHA-256 ${r.empreinte_sha256.slice(0, 12)}…` : ' · import sans empreinte (avant D-081)'}{(r.lignes_rejetees?.length ?? 0) > 0 ? ` · ${r.lignes_rejetees?.length} ligne(s) rejetée(s) à l'import` : ''}</span></span>
            <span className="flex gap-1">
              {ctx.peutEcrire && r.statut !== 'annule' && <button disabled={busy} onClick={() => rapprocher(r)} aria-label={`Rapprocher ${r.reference}`} className="flex items-center gap-1 rounded bg-stone-800 px-2 py-1 text-xs font-bold text-white"><Scale className="h-3 w-3" /> {r.rapproche_pesees_le ? 'Relancer le rapprochement' : 'Rapprocher'}</button>}
              {r.rapproche_pesees_le && <button onClick={() => onRapproche(r.id)} aria-label={`Résultat ${r.reference}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Résultat</button>}
              {ctx.peutValider && r.statut !== 'annule' && r.importe_par !== ctx.utilisateur && <button onClick={() => setAnnulation({ id: r.id, motif: '' })} aria-label={`Annuler ${r.reference}`} className="flex items-center gap-1 rounded border border-red-300 px-2 py-1 text-xs text-red-700"><Ban className="h-3 w-3" /> Annuler</button>}
              <BoutonPieces objetType="releve_cbg" objetId={r.id} titre={`relevé CBG ${r.reference}`} peutDeposer={ctx.peutEcrire} />
            </span>
          </div>
          {r.statut === 'annule' && <p className="text-xs text-stone-500">Motif d'annulation : {r.motif_annulation}</p>}
          {annulation?.id === r.id && <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="min-w-[280px] flex-1 text-sm">Motif d'annulation *<input value={annulation.motif} onChange={(e) => setAnnulation({ id: r.id, motif: e.target.value })} className={CHAMP} /></label>
            <button disabled={busy || !annulation.motif.trim()} onClick={annuler} className="rounded bg-red-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Confirmer l'annulation</button>
            <button onClick={() => setAnnulation(null)} className="rounded border border-stone-300 px-3 py-2 text-sm">Abandonner</button>
          </div>}
        </li>)}</ul>}
    </Panneau>
  </div>;
};
