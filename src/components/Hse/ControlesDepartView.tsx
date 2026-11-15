import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import { CATEGORIES_POINT, RESULTATS_CONTROLE, resultatControle, type PointControle, type Reponse, type ResultatPoint } from './hse';

// Controle avant depart (D-054) : liste de points tenue par
// l'administrateur, resultat calcule par le serveur. Quand le controle est
// exige, le camion ne part pas au chargement sans controle du jour conforme
// ou avec reserves.

interface Controle { id: string; vehicle_id: string; driver_id: string | null; effectue_le: string; resultat: string; compteur_km: number | null; note: string | null }
interface PointRelve { controle_id: string; libelle: string; bloquant: boolean; resultat: ResultatPoint; observation: string | null }
interface Lib { id: string; libelle: string }

const CHAMP = 'mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm';
const quand = (v: string) => new Date(v).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

export const ControlesDepartView = () => {
  const { hasPermission, profile } = useAuth();
  const estAdmin = profile?.role === 'admin';
  const peutEcrire = estAdmin || hasPermission('trips', 'create') || hasPermission('trips', 'edit');
  const [points, setPoints] = useState<PointControle[]>([]);
  const [controles, setControles] = useState<Controle[] | null>(null);
  const [releves, setReleves] = useState<PointRelve[]>([]);
  const [engins, setEngins] = useState<Lib[]>([]);
  const [chauffeurs, setChauffeurs] = useState<Lib[]>([]);
  const [exige, setExige] = useState<boolean | null>(null);
  const [saisie, setSaisie] = useState(false);
  const [entete, setEntete] = useState<Record<string, string>>({});
  const [reponses, setReponses] = useState<Record<string, Reponse>>({});
  const [nouveauPoint, setNouveauPoint] = useState<Record<string, string>>({ categorie: 'freinage', bloquant: 'true' });
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const depuis = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const [p, c, v, d] = await Promise.all([
      supabase.from('points_controle_depart').select('id, libelle, categorie, bloquant, ordre, actif').order('ordre'),
      supabase.from('controles_depart').select('id, vehicle_id, driver_id, effectue_le, resultat, compteur_km, note').gte('effectue_le', depuis).order('effectue_le', { ascending: false }),
      supabase.from('vehicles').select('id, registration').order('registration'),
      supabase.from('drivers').select('id, name').order('name'),
    ]);
    setErreur(p.error?.message ?? c.error?.message ?? '');
    setPoints((p.data ?? []) as PointControle[]);
    const liste = (c.data ?? []) as Controle[];
    setControles(liste);
    setEngins((v.data ?? []).map((x) => ({ id: x.id as string, libelle: x.registration as string })));
    setChauffeurs((d.data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string })));
    if (liste.length) {
      const { data } = await supabase.from('controles_depart_points').select('controle_id, libelle, bloquant, resultat, observation')
        .in('controle_id', liste.map((x) => x.id)).eq('resultat', 'non_conforme');
      setReleves((data ?? []) as PointRelve[]);
    } else setReleves([]);
    if (estAdmin) {
      const { data } = await supabase.from('settings').select('value').eq('key', 'controle_depart_exige').maybeSingle();
      setExige((data?.value as { value?: string } | undefined)?.value === 'true');
    }
  }, [estAdmin]);
  useEffect(() => { charger(); }, [charger]);

  const engin = useMemo(() => new Map(engins.map((x) => [x.id, x.libelle])), [engins]);
  const chauffeur = useMemo(() => new Map(chauffeurs.map((x) => [x.id, x.libelle])), [chauffeurs]);
  const actifs = points.filter((p) => p.actif);
  const attendu = resultatControle(points, reponses);
  const repondre = (id: string, r: Partial<Reponse>) => setReponses({ ...reponses, [id]: { ...(reponses[id] ?? { resultat: '', observation: '' }), ...r } });

  const executer = async (action: () => PromiseLike<{ error: { message: string } | null }>, succes: string) => {
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await action();
    setBusy(false);
    if (error) { setErreur(error.message); return false; }
    setMessage(succes); await charger(); return true;
  };
  const enregistrer = () => executer(() => supabase.rpc('enregistrer_controle_depart', {
    p_vehicle: entete.engin, p_driver: entete.chauffeur || null,
    p_points: actifs.map((p) => ({ point: p.id, resultat: reponses[p.id]?.resultat, observation: reponses[p.id]?.observation.trim() || null })),
    p_km: entete.km ? Number(entete.km.replace(',', '.')) : null, p_note: entete.note?.trim() || null,
  }), 'Contrôle enregistré.').then((ok) => { if (ok) { setSaisie(false); setReponses({}); setEntete({}); } });
  const ajouterPoint = () => executer(() => supabase.from('points_controle_depart').insert({
    libelle: nouveauPoint.libelle?.trim(), categorie: nouveauPoint.categorie, bloquant: nouveauPoint.bloquant === 'true',
    ordre: points.length + 1,
  }), 'Point ajouté.').then((ok) => { if (ok) setNouveauPoint({ categorie: 'freinage', bloquant: 'true' }); });
  const basculerPoint = (p: PointControle) => executer(() => supabase.from('points_controle_depart').update({ actif: !p.actif }).eq('id', p.id),
    p.actif ? 'Point retiré de la liste.' : 'Point réactivé.');
  const basculerExigence = () => {
    const actif = !exige;
    if (!window.confirm(actif ? 'Exiger un contrôle avant départ du jour, conforme ou avec réserves, pour qu\'un camion parte au chargement ?' : 'Lever l\'exigence du contrôle avant départ ?')) return;
    executer(() => supabase.from('settings').upsert({ key: 'controle_depart_exige', value: { value: String(actif) }, category: 'hse',
      description: 'Controle avant depart exige au cycle voyage (D-054)' }, { onConflict: 'key' }), actif ? 'Exigence activée.' : 'Exigence levée.');
  };

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Contrôles avant départ</h2>
        <p className="text-sm text-stone-500">Chaque camion est contrôlé avant son premier départ ; un point bloquant non conforme empêche le départ quand le contrôle est exigé.</p></div>
      <div className="flex gap-2">
        {peutEcrire && <button disabled={actifs.length === 0} onClick={() => { setSaisie(true); setReponses({}); setEntete({}); }} className="flex items-center gap-2 rounded-lg bg-orange-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Contrôle</button>}
        <button onClick={charger} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
      </div>
    </header>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {actifs.length === 0 && <p className="rounded-lg bg-orange-50 p-3 text-sm text-orange-800">Aucun point de contrôle paramétré : l'administrateur définit la liste ci-dessous.</p>}

    {saisie && <Panneau titre="Nouveau contrôle avant départ">
      <div role="form" aria-label="Saisie contrôle" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm">Camion *<select value={entete.engin ?? ''} onChange={(e) => setEntete({ ...entete, engin: e.target.value })} className={CHAMP}><option value="">Choisir</option>{engins.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}</select></label>
        <label className="text-sm">Chauffeur<select value={entete.chauffeur ?? ''} onChange={(e) => setEntete({ ...entete, chauffeur: e.target.value })} className={CHAMP}><option value="">Non renseigné</option>{chauffeurs.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}</select></label>
        <label className="text-sm">Compteur (km)<input inputMode="decimal" value={entete.km ?? ''} onChange={(e) => setEntete({ ...entete, km: e.target.value })} className={CHAMP} /></label>
        <label className="text-sm">Observation générale<input value={entete.note ?? ''} onChange={(e) => setEntete({ ...entete, note: e.target.value })} className={CHAMP} /></label>
      </div>
      <ul className="mt-4 divide-y divide-stone-100 text-sm">{actifs.map((p) => { const r = reponses[p.id]; return <li key={p.id} className="flex flex-wrap items-center gap-3 py-2">
        <span className="min-w-48 flex-1"><b>{p.libelle}</b> <span className="text-xs text-stone-500">{CATEGORIES_POINT[p.categorie] ?? p.categorie}{p.bloquant ? ' · bloquant' : ''}</span></span>
        <select aria-label={`Résultat ${p.libelle}`} value={r?.resultat ?? ''} onChange={(e) => repondre(p.id, { resultat: e.target.value as ResultatPoint })} className="rounded border border-stone-300 px-2 py-1">
          <option value="">À renseigner</option><option value="conforme">Conforme</option><option value="non_conforme">Non conforme</option><option value="sans_objet">Sans objet</option></select>
        {r?.resultat === 'non_conforme' && <input aria-label={`Observation ${p.libelle}`} value={r.observation} onChange={(e) => repondre(p.id, { observation: e.target.value })} placeholder="Observation obligatoire" className="min-w-48 flex-1 rounded border border-stone-300 px-2 py-1" />}
      </li>; })}</ul>
      <p className="mt-3 text-sm">Résultat : {attendu ? <Puce teinte={RESULTATS_CONTROLE[attendu].teinte}>{RESULTATS_CONTROLE[attendu].texte}</Puce> : 'points à renseigner'}</p>
      <div className="mt-3 flex gap-2">
        <button disabled={busy || !entete.engin || !attendu} onClick={enregistrer} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer le contrôle</button>
        <button onClick={() => setSaisie(false)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Annuler</button>
      </div>
    </Panneau>}

    <Panneau titre="Contrôles des 7 derniers jours">
      {controles === null ? <p>Chargement…</p> : controles.length === 0 ? <SansDonnees message="Aucun contrôle enregistré" /> :
        <ul className="divide-y divide-stone-100 text-sm">{controles.map((c) => <li key={c.id} className="py-2">
          <ClipboardCheck className="mr-1 inline h-4 w-4" /><b>{engin.get(c.vehicle_id) ?? '?'}</b> · {quand(c.effectue_le)}{c.driver_id && ` · ${chauffeur.get(c.driver_id) ?? '?'}`}
          {' '}<Puce teinte={RESULTATS_CONTROLE[c.resultat]?.teinte ?? 'gris'}>{RESULTATS_CONTROLE[c.resultat]?.texte ?? c.resultat}</Puce>
          {releves.filter((x) => x.controle_id === c.id).map((x) => <span key={x.libelle} className="block text-xs text-stone-600">{x.libelle}{x.bloquant ? ' (bloquant)' : ''} : {x.observation}</span>)}
          {c.note && <span className="block text-xs text-stone-500">{c.note}</span>}
        </li>)}</ul>}
    </Panneau>

    <Panneau titre="Liste des points de contrôle">
      {points.length === 0 ? <SansDonnees message="Aucun point défini" /> :
        <ul className="space-y-1 text-sm">{points.map((p) => <li key={p.id} className={`flex items-center justify-between gap-2 ${p.actif ? '' : 'text-stone-400'}`}>
          <span>{p.ordre}. {p.libelle} · {CATEGORIES_POINT[p.categorie] ?? p.categorie} {p.bloquant ? <Puce teinte="rouge">Bloquant</Puce> : <Puce teinte="gris">Non bloquant</Puce>}</span>
          {estAdmin && <button onClick={() => basculerPoint(p)} className="rounded border border-stone-300 px-2 py-1 text-xs">{p.actif ? 'Retirer' : 'Réactiver'}</button>}
        </li>)}</ul>}
      {estAdmin && <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <input aria-label="Libellé du point" value={nouveauPoint.libelle ?? ''} onChange={(e) => setNouveauPoint({ ...nouveauPoint, libelle: e.target.value })} placeholder="Freins, pneus, feux…" className="rounded border border-stone-300 px-3 py-2 text-sm" />
        <select aria-label="Catégorie du point" value={nouveauPoint.categorie} onChange={(e) => setNouveauPoint({ ...nouveauPoint, categorie: e.target.value })} className="rounded border border-stone-300 px-3 py-2 text-sm">{Object.entries(CATEGORIES_POINT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select aria-label="Point bloquant" value={nouveauPoint.bloquant} onChange={(e) => setNouveauPoint({ ...nouveauPoint, bloquant: e.target.value })} className="rounded border border-stone-300 px-3 py-2 text-sm"><option value="true">Bloquant</option><option value="false">Non bloquant</option></select>
        <button disabled={busy || !nouveauPoint.libelle?.trim()} onClick={ajouterPoint} className="rounded-lg border border-stone-300 px-3 py-2 text-sm disabled:opacity-50">Ajouter le point</button>
      </div>}
      {estAdmin && <div className="mt-4 flex items-center gap-3 text-sm">
        <span>Contrôle exigé au départ : {exige ? <Puce teinte="vert">Oui</Puce> : <Puce teinte="gris">Non</Puce>}</span>
        <button onClick={basculerExigence} className="rounded border border-stone-300 px-2 py-1 text-xs">{exige ? 'Lever l\'exigence' : 'Exiger'}</button>
      </div>}
    </Panneau>
  </div>;
};
