import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Gauge, PenLine, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { exportToCSV } from '../../lib/exports';
import { formatNombre } from '../Dashboard/indicateurs';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import { BoutonPieces } from '../ui/PiecesJointes';
import { ETATS_LIVRES, MOMENTS, mesurer, motifRequis, type MomentReleve, type Releve } from './kilometrage';

// Kilometrage des voyages (D-043) : releves d'odometre saisis depuis les
// fiches, distance mesuree, distance de reference, distance validee par une
// autre personne. Le controle des factures du loueur au km ne retient que
// les distances validees.

interface Voyage { id: string; reference: string; planned_date: string; etat: string | null; vehicle_id: string | null; departure_site_id: string | null; arrival_site_id: string | null }
interface Distance { trip_id: string; version: number; validee_charge_km: number; validee_retour_km: number | null; distance_reference_km: number | null; motif: string | null; valide_le: string }
interface Reference { id: string; site_depart_id: string; site_arrivee_id: string; distance_km: number; source: string }
interface Lib { id: string; libelle: string }

const CHAMP = 'mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm';
const debutMois = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const km = (x: number | null | undefined) => (x === null || x === undefined ? '—' : `${formatNombre(Number(x), 0)} km`);
const nombre = (v: string) => (v.trim() === '' ? null : Number(v.replace(/\s/g, '').replace(',', '.')));

export const KilometrageView = () => {
  const { hasPermission } = useAuth();
  const peutSaisir = hasPermission('trips', 'create') || hasPermission('trips', 'edit');
  const peutValider = hasPermission('contracts', 'edit');
  const [du, setDu] = useState(debutMois);
  const [au, setAu] = useState(aujourdhui);
  const [voyages, setVoyages] = useState<Voyage[] | null>(null);
  const [releves, setReleves] = useState<Releve[]>([]);
  const [distances, setDistances] = useState<Distance[]>([]);
  const [references, setReferences] = useState<Reference[]>([]);
  const [engins, setEngins] = useState<Lib[]>([]);
  const [sites, setSites] = useState<Lib[]>([]);
  const [ouvert, setOuvert] = useState<{ type: 'releves' | 'validation'; voyage: Voyage } | null>(null);
  const [champs, setChamps] = useState<Record<string, string>>({});
  const [nouvelleRef, setNouvelleRef] = useState({ depart: '', arrivee: '', distance: '', source: '' });
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const t = await supabase.from('trips').select('id, reference, planned_date, etat, vehicle_id, departure_site_id, arrival_site_id')
      .gte('planned_date', du).lte('planned_date', au).not('vehicle_id', 'is', null).order('planned_date', { ascending: false }).limit(300);
    const ids = (t.data ?? []).map((x) => x.id as string);
    const [r, d, ref, v, s] = await Promise.all([
      ids.length ? supabase.from('v_releves_compteur').select('id, trip_id, moment, valeur_km, releve_le, saisi_par').in('trip_id', ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? supabase.from('v_distances_voyage').select('trip_id, version, validee_charge_km, validee_retour_km, distance_reference_km, motif, valide_le').in('trip_id', ids) : Promise.resolve({ data: [], error: null }),
      supabase.from('distances_reference').select('id, site_depart_id, site_arrivee_id, distance_km, source').eq('actif', true),
      supabase.from('vehicles').select('id, registration').order('registration'),
      supabase.from('sites').select('id, name').order('name'),
    ]);
    setErreur(t.error?.message ?? r.error?.message ?? d.error?.message ?? ref.error?.message ?? '');
    setVoyages((t.data ?? []) as Voyage[]);
    setReleves((r.data ?? []) as Releve[]);
    setDistances((d.data ?? []) as Distance[]);
    setReferences((ref.data ?? []) as Reference[]);
    setEngins((v.data ?? []).map((x) => ({ id: x.id as string, libelle: x.registration as string })));
    setSites((s.data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string })));
  }, [du, au]);
  useEffect(() => { charger(); }, [charger]);

  const nomEngin = useMemo(() => new Map(engins.map((e) => [e.id, e.libelle])), [engins]);
  const nomSite = useMemo(() => new Map(sites.map((e) => [e.id, e.libelle])), [sites]);
  const relevesDe = (id: string) => releves.filter((r) => r.trip_id === id);
  const distanceDe = (id: string) => distances.find((d) => d.trip_id === id);
  const referenceDe = (v: Voyage) => references.find((r) => r.site_depart_id === v.departure_site_id && r.site_arrivee_id === v.arrival_site_id);
  const livres = (voyages ?? []).filter((v) => v.etat && ETATS_LIVRES.includes(v.etat));
  const aValider = livres.filter((v) => !distanceDe(v.id)).length;

  const executer = async (action: () => PromiseLike<{ error: { message: string } | null }>, succes: string) => {
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await action();
    setBusy(false);
    if (error) { setErreur(error.message); return false; }
    setMessage(succes); await charger();
    return true;
  };

  const ouvrirReleves = (v: Voyage) => { setOuvert({ type: 'releves', voyage: v }); setChamps({ source: 'fiche', quand: `${v.planned_date}T08:00` }); };
  const ouvrirValidation = (v: Voyage) => {
    const m = mesurer(relevesDe(v.id));
    const ref = referenceDe(v);
    setOuvert({ type: 'validation', voyage: v });
    setChamps({ charge: m.charge?.toString() ?? ref?.distance_km?.toString() ?? '', retour: m.retour?.toString() ?? '', declaree: '', motif: '' });
  };
  const saisirReleve = (v: Voyage, moment: MomentReleve) => executer(() => supabase.rpc('saisir_releve_compteur', {
    p_vehicle_id: v.vehicle_id, p_trip_id: v.id, p_moment: moment, p_valeur: nombre(champs[moment] ?? ''),
    p_quand: new Date(champs[`${moment}_quand`] || champs.quand).toISOString(), p_source: champs.source || 'fiche',
    p_reference: champs.reference?.trim() || null,
  }), 'Relevé enregistré.');
  const corriger = (r: Releve) => {
    const valeur = window.prompt('Nouvelle valeur du compteur (km)', String(r.valeur_km));
    if (valeur === null) return;
    const motif = window.prompt('Motif de la correction (l\'ancienne valeur reste au journal)');
    if (!motif?.trim()) return;
    executer(() => supabase.rpc('corriger_releve_compteur', { p_id: r.id, p_valeur: nombre(valeur), p_motif: motif }), 'Relevé corrigé.');
  };
  const valider = (v: Voyage) => executer(() => supabase.rpc('valider_distance_voyage', {
    p_trip_id: v.id, p_charge_km: nombre(champs.charge ?? ''), p_retour_km: nombre(champs.retour ?? ''),
    p_declaree_km: nombre(champs.declaree ?? ''), p_motif: champs.motif?.trim() || null,
  }), 'Distance validée.').then((ok) => ok && setOuvert(null));
  const ajouterReference = () => executer(() => supabase.from('distances_reference').insert({
    site_depart_id: nouvelleRef.depart, site_arrivee_id: nouvelleRef.arrivee, distance_km: nombre(nouvelleRef.distance), source: nouvelleRef.source.trim(),
  }), 'Distance de référence enregistrée.').then((ok) => ok && setNouvelleRef({ depart: '', arrivee: '', distance: '', source: '' }));
  const desactiverReference = (r: Reference) => {
    if (!window.confirm('Désactiver cette distance de référence ? Les validations passées gardent la valeur figée.')) return;
    executer(() => supabase.from('distances_reference').update({ actif: false }).eq('id', r.id), 'Distance de référence désactivée.');
  };
  const exporter = () => exportToCSV((voyages ?? []).map((v) => {
    const m = mesurer(relevesDe(v.id)); const d = distanceDe(v.id);
    return { voyage: v.reference, date: v.planned_date, engin: nomEngin.get(v.vehicle_id ?? '') ?? '', etat: v.etat ?? '',
      mesure_charge_km: m.charge ?? '', mesure_retour_km: m.retour ?? '', reference_km: referenceDe(v)?.distance_km ?? '',
      validee_charge_km: d?.validee_charge_km ?? '', validee_retour_km: d?.validee_retour_km ?? '', motif: d?.motif ?? '' };
  }), 'kilometrage-voyages');

  const v = ouvert?.voyage;
  const mesuresOuvert = v ? mesurer(relevesDe(v.id)) : { charge: null, retour: null };
  const motifObligatoire = ouvert?.type === 'validation' && motifRequis(mesuresOuvert, nombre(champs.charge ?? ''), nombre(champs.retour ?? ''));

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Kilométrage des voyages</h2>
        <p className="text-sm text-stone-500">Relevés d'odomètre, distance mesurée, distance de référence et distance validée. Aucune distance n'est estimée.</p></div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-stone-600">Du<input type="date" value={du} onChange={(e) => setDu(e.target.value)} className={CHAMP} /></label>
        <label className="text-xs text-stone-600">Au<input type="date" value={au} onChange={(e) => setAu(e.target.value)} className={CHAMP} /></label>
        <button onClick={exporter} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm">Exporter CSV</button>
        <button onClick={charger} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
      </div>
    </header>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {livres.length > 0 && <p className="text-sm text-stone-600">{livres.length} voyage(s) livré(s) sur la période, dont <b>{aValider}</b> sans distance validée (kilomètres non contrôlables tant qu'ils restent sans validation).</p>}

    {ouvert && v && <Panneau titre={`${ouvert.type === 'releves' ? 'Relevés' : 'Validation de la distance'} · ${v.reference} · ${nomEngin.get(v.vehicle_id ?? '') ?? ''}`}>
      {ouvert.type === 'releves' ? <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">Source<select value={champs.source} onChange={(e) => setChamps({ ...champs, source: e.target.value })} className={CHAMP}>
            <option value="fiche">Fiche terrain</option><option value="saisie">Saisie directe</option><option value="photo">Photo du compteur</option></select></label>
          <label className="text-sm">Pièce (n° de fiche, photo)<input value={champs.reference ?? ''} onChange={(e) => setChamps({ ...champs, reference: e.target.value })} className={CHAMP} /></label>
        </div>
        <ul className="divide-y divide-stone-100">
          {MOMENTS.map((mo) => { const r = relevesDe(v.id).find((x) => x.moment === mo.id); return <li key={mo.id} className="flex flex-wrap items-end gap-3 py-2 text-sm">
            <span className="w-36 font-semibold">{mo.libelle}</span>
            {r ? <><span>{km(r.valeur_km)} · {new Date(r.releve_le).toLocaleString('fr-FR')}</span>
              {peutSaisir && <button onClick={() => corriger(r)} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs"><PenLine className="h-3 w-3" /> Corriger</button>}
              <BoutonPieces objetType="releve_compteur" objetId={r.id} titre={`relevé ${mo.libelle} ${v.reference}`} peutDeposer={peutSaisir} /></>
              : peutSaisir ? <>
                <label className="text-xs">Compteur (km)<input aria-label={`${mo.libelle} compteur`} inputMode="decimal" value={champs[mo.id] ?? ''} onChange={(e) => setChamps({ ...champs, [mo.id]: e.target.value })} className={`${CHAMP} w-32`} /></label>
                <label className="text-xs">Heure<input aria-label={`${mo.libelle} heure`} type="datetime-local" value={champs[`${mo.id}_quand`] ?? champs.quand} onChange={(e) => setChamps({ ...champs, [`${mo.id}_quand`]: e.target.value })} className={CHAMP} /></label>
                <button disabled={busy || nombre(champs[mo.id] ?? '') === null} onClick={() => saisirReleve(v, mo.id)} className="flex items-center gap-1 rounded bg-orange-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"><Plus className="h-3 w-3" /> Enregistrer</button>
              </> : <span className="text-stone-400">non relevé</span>}
          </li>; })}
        </ul>
      </div> : <div className="space-y-3">
        <p className="text-sm text-stone-600">Mesure : chargé {km(mesuresOuvert.charge)}, retour {km(mesuresOuvert.retour)} · référence {km(referenceDe(v)?.distance_km)}</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm">Trajet chargé validé (km) *<input inputMode="decimal" value={champs.charge ?? ''} onChange={(e) => setChamps({ ...champs, charge: e.target.value })} className={CHAMP} /></label>
          <label className="text-sm">Retour à vide validé (km)<input inputMode="decimal" value={champs.retour ?? ''} onChange={(e) => setChamps({ ...champs, retour: e.target.value })} className={CHAMP} /></label>
          <label className="text-sm">Distance déclarée (km)<input inputMode="decimal" value={champs.declaree ?? ''} onChange={(e) => setChamps({ ...champs, declaree: e.target.value })} className={CHAMP} /></label>
          <label className="text-sm">Motif{motifObligatoire ? ' *' : ''}<input value={champs.motif ?? ''} onChange={(e) => setChamps({ ...champs, motif: e.target.value })} placeholder={motifObligatoire ? 'Écart à la mesure ou mesure absente' : ''} className={CHAMP} /></label>
        </div>
        <button disabled={busy || nombre(champs.charge ?? '') === null || (motifObligatoire && !champs.motif?.trim())} onClick={() => valider(v)} className="flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> Valider la distance</button>
      </div>}
      <button onClick={() => setOuvert(null)} className="mt-3 rounded-lg border border-stone-300 px-3 py-1.5 text-sm">Fermer</button>
    </Panneau>}

    <Panneau titre={`Voyages (${voyages?.length ?? 0})`}>
      {voyages === null ? <p>Chargement…</p> : voyages.length === 0 ? <SansDonnees message="Aucun voyage sur la période" /> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500">
          <th className="py-2 pr-3">Voyage</th><th className="py-2 pr-3">Engin</th><th className="py-2 pr-3">Trajet</th><th className="py-2 pr-3">Relevés</th>
          <th className="py-2 pr-3 text-right">Mesuré</th><th className="py-2 pr-3 text-right">Référence</th><th className="py-2 pr-3 text-right">Validé</th><th /></tr></thead>
          <tbody>{voyages.map((x) => { const m = mesurer(relevesDe(x.id)); const d = distanceDe(x.id); const livre = x.etat !== null && ETATS_LIVRES.includes(x.etat);
            return <tr key={x.id} className="border-b border-stone-100">
              <td className="py-2 pr-3"><span className="font-mono">{x.reference}</span><span className="block text-xs text-stone-500">{x.planned_date} · {x.etat ?? '—'}</span></td>
              <td className="py-2 pr-3">{nomEngin.get(x.vehicle_id ?? '') ?? '—'}</td>
              <td className="py-2 pr-3 text-xs">{nomSite.get(x.departure_site_id ?? '') ?? '?'} → {nomSite.get(x.arrival_site_id ?? '') ?? '?'}</td>
              <td className="py-2 pr-3">{relevesDe(x.id).length}/3</td>
              <td className="py-2 pr-3 text-right">{km(m.charge)}{m.retour !== null && <span className="block text-xs text-stone-500">retour {km(m.retour)}</span>}</td>
              <td className="py-2 pr-3 text-right">{km(referenceDe(x)?.distance_km)}</td>
              <td className="py-2 pr-3 text-right" title={d?.motif ?? undefined}>{d ? <><b>{km(d.validee_charge_km)}</b>{d.validee_retour_km !== null && <span className="block text-xs text-stone-500">retour {km(d.validee_retour_km)}</span>}</> : livre ? <Puce teinte="orange">À valider</Puce> : '—'}</td>
              <td className="py-2"><span className="flex gap-1">
                <button onClick={() => ouvrirReleves(x)} aria-label={`Relevés ${x.reference}`} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs"><Gauge className="h-3 w-3" /> Relevés</button>
                {peutValider && livre && <button onClick={() => ouvrirValidation(x)} aria-label={`Valider la distance ${x.reference}`} className="flex items-center gap-1 rounded bg-stone-800 px-2 py-1 text-xs font-bold text-white"><CheckCircle2 className="h-3 w-3" /> {d ? 'Revalider' : 'Valider'}</button>}
              </span></td>
            </tr>; })}</tbody></table></div>}
    </Panneau>

    <Panneau titre="Distances de référence (site à site)">
      {references.length === 0 ? <SansDonnees message="Aucune distance de référence" detail="Une distance de référence sert de repère ; elle n'est retenue qu'avec un motif." /> :
        <ul className="divide-y divide-stone-100 text-sm">{references.map((r) => <li key={r.id} className="flex items-center justify-between py-2">
          <span>{nomSite.get(r.site_depart_id) ?? '?'} → {nomSite.get(r.site_arrivee_id) ?? '?'} : <b>{km(r.distance_km)}</b> <span className="text-stone-500">({r.source})</span></span>
          {peutValider && <button onClick={() => desactiverReference(r)} className="rounded border border-stone-300 px-2 py-1 text-xs">Désactiver</button>}</li>)}</ul>}
      {peutValider && <div className="mt-3 grid gap-2 sm:grid-cols-5">
        <select aria-label="Site de départ" value={nouvelleRef.depart} onChange={(e) => setNouvelleRef({ ...nouvelleRef, depart: e.target.value })} className={CHAMP}><option value="">Départ</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}</select>
        <select aria-label="Site d'arrivée" value={nouvelleRef.arrivee} onChange={(e) => setNouvelleRef({ ...nouvelleRef, arrivee: e.target.value })} className={CHAMP}><option value="">Arrivée</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}</select>
        <input aria-label="Distance de référence (km)" inputMode="decimal" placeholder="km" value={nouvelleRef.distance} onChange={(e) => setNouvelleRef({ ...nouvelleRef, distance: e.target.value })} className={CHAMP} />
        <input aria-label="Source de la distance" placeholder="Source (relevé de piste, contrat...)" value={nouvelleRef.source} onChange={(e) => setNouvelleRef({ ...nouvelleRef, source: e.target.value })} className={CHAMP} />
        <button disabled={busy || !nouvelleRef.depart || !nouvelleRef.arrivee || !(Number(nombre(nouvelleRef.distance)) > 0) || !nouvelleRef.source.trim()} onClick={ajouterReference} className="rounded-lg bg-orange-700 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">Ajouter</button>
      </div>}
    </Panneau>
  </div>;
};
