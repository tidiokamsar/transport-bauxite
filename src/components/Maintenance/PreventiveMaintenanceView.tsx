import { useCallback, useEffect, useMemo, useState } from 'react';
import { Info, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatNombre } from '../Dashboard/indicateurs';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import { dernierReleveParEngin, echeancePlanning, type Releve } from './preventif';

// Maintenance preventive interne (D-061). Les engins loues relevent de
// Neemba (D-022, D-025) : leur maintenance se suit en Immobilisations et
// Interventions Neemba. SIGTB ne connait pas la propriete d'un engin : on
// signale seulement un engin rattache a un contrat de location quand le
// dossier contractuel le montre. Aucune valeur par defaut (cout, intervalle,
// date) n'est proposee.

interface Planning {
  id: string; vehicle_id: string | null; title: string; description: string | null; maintenance_type: string;
  interval_km: number | null; interval_days: number | null; last_maintenance_km: number | null; last_maintenance_date: string | null;
  next_service_km: number | null; next_service_date: string | null; estimated_cost: number | null; is_active: boolean | null;
}
interface Engin { id: string; registration: string; brand_model: string }
interface Location { reference: string; contrepartie: string }

const CHAMP = 'mt-1 w-full rounded border border-stone-300 px-3 py-2';
const nombre = (v: string) => (v.trim() === '' ? null : Number(v.replace(/\s/g, '').replace(',', '.')));
const TYPES = ['Vidange moteur', 'Graissage', 'Remplacement des filtres', 'Contrôle des freins', 'Contrôle de la transmission',
  'Contrôle hydraulique', 'Contrôle électrique', 'Révision générale', 'Autre'];

export const PreventiveMaintenanceView = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('maintenance', 'create') || hasPermission('maintenance', 'edit');
  const [plannings, setPlannings] = useState<Planning[] | null>(null);
  const [engins, setEngins] = useState<Engin[]>([]);
  const [releves, setReleves] = useState<Map<string, Releve>>(new Map());
  const [locations, setLocations] = useState<Map<string, Location>>(new Map());
  const [inactifs, setInactifs] = useState(false);
  const [champs, setChamps] = useState<Record<string, string> | null>(null);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const [p, e, r, t] = await Promise.all([
      supabase.from('maintenance_schedules').select('id, vehicle_id, title, description, maintenance_type, interval_km, interval_days, last_maintenance_km, last_maintenance_date, next_service_km, next_service_date, estimated_cost, is_active').order('title'),
      supabase.from('vehicles').select('id, registration, brand_model').order('registration'),
      supabase.from('v_releves_compteur').select('vehicle_id, valeur_km, releve_le').order('releve_le', { ascending: false }).limit(2000),
      // Engins attaches a un tarif d'un contrat de location (D-033), si le dossier est lisible.
      supabase.from('contrat_tarifs').select('engin, version:contrat_versions(contrat:contrats(reference, nature, contrepartie))').not('engin', 'is', null),
    ]);
    setErreur(p.error?.message ?? e.error?.message ?? '');
    setPlannings((p.data ?? []) as Planning[]);
    setEngins((e.data ?? []) as Engin[]);
    setReleves(dernierReleveParEngin(r.error ? [] : (r.data ?? []) as (Releve & { vehicle_id: string })[]));
    const loc = new Map<string, Location>();
    for (const l of (t.error ? [] : t.data ?? []) as unknown as { engin: string; version: { contrat: { reference: string; nature: string; contrepartie: string } | null } | null }[]) {
      const ct = l.version?.contrat;
      if (ct?.nature === 'location') loc.set(l.engin, { reference: ct.reference, contrepartie: ct.contrepartie });
    }
    setLocations(loc);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const engin = useMemo(() => new Map(engins.map((x) => [x.id, x])), [engins]);
  const aujourdhui = new Date();
  const lignes = (plannings ?? []).filter((p) => inactifs || p.is_active !== false)
    .map((p) => ({ p, e: echeancePlanning(p, p.vehicle_id ? releves.get(p.vehicle_id) ?? null : null, aujourdhui) }))
    .sort((a, b) => ({ depassee: 0, a_venir: 1, inconnue: 2 }[a.e.statut] - { depassee: 0, a_venir: 1, inconnue: 2 }[b.e.statut]));

  const c = (k: string) => champs?.[k] ?? '';
  const poser = (k: string, v: string) => setChamps({ ...(champs ?? {}), [k]: v });
  const ouvrir = (p?: Planning) => {
    setErreur(''); setMessage('');
    setChamps(p ? {
      id: p.id, engin: p.vehicle_id ?? '', titre: p.title, type: p.maintenance_type, description: p.description ?? '',
      km: p.interval_km?.toString() ?? '', jours: p.interval_days?.toString() ?? '', dernierKm: p.last_maintenance_km?.toString() ?? '',
      derniereDate: p.last_maintenance_date ?? '', cout: p.estimated_cost?.toString() ?? '',
    } : { type: '' });
  };
  const executer = async (action: () => PromiseLike<{ error: { message: string } | null }>, succes: string) => {
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await action();
    setBusy(false);
    if (error) { setErreur(error.message); return; }
    setMessage(succes); setChamps(null); await charger();
  };
  const enregistrer = () => {
    // Intervalle en jours : entier (colonne integer, D-078).
    const jours = nombre(c('jours'));
    if (jours !== null && !Number.isInteger(jours)) { setErreur('Intervalle en jours : nombre entier attendu (sans décimales)'); return; }
    const valeurs = {
      vehicle_id: c('engin'), title: c('titre').trim(), maintenance_type: c('type'), description: c('description').trim() || null,
      interval_km: nombre(c('km')), interval_days: nombre(c('jours')), last_maintenance_km: nombre(c('dernierKm')),
      last_maintenance_date: c('derniereDate') || null, estimated_cost: nombre(c('cout')),
    };
    return executer(() => c('id')
      ? supabase.from('maintenance_schedules').update(valeurs).eq('id', c('id'))
      : supabase.from('maintenance_schedules').insert({ ...valeurs, is_active: true }), c('id') ? 'Planning modifié.' : 'Planning créé.');
  };
  const desactiver = (p: Planning) => {
    if (!window.confirm(`Désactiver le planning « ${p.title} » ? Il restera consultable.`)) return;
    executer(() => supabase.from('maintenance_schedules').update({ is_active: false }).eq('id', p.id), 'Planning désactivé.');
  };
  const reactiver = (p: Planning) => executer(() => supabase.from('maintenance_schedules').update({ is_active: true }).eq('id', p.id), 'Planning réactivé.');

  const pret = champs && c('engin') && c('titre').trim() && c('type') && ((nombre(c('km')) ?? 0) > 0 || (nombre(c('jours')) ?? 0) > 0);

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Maintenance préventive</h2>
        <p className="text-sm text-stone-500">Plannings internes par intervalle de kilomètres ou de jours ; échéance calculée depuis la dernière intervention et le dernier relevé compteur.</p></div>
      <div className="flex flex-wrap gap-2">
        {peutEcrire && <button onClick={() => ouvrir()} className="flex items-center gap-2 rounded-lg bg-orange-700 px-3 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Nouveau planning</button>}
        <button onClick={charger} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
      </div>
    </header>

    <p role="note" className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span>Les engins loués à Neemba sont entretenus par le loueur (D-022, D-025) : leur maintenance se suit dans Immobilisations et Interventions Neemba.
        Ce planning ne concerne que les engins entretenus par KOGON. SIGTB ne connaît pas la propriété des engins : un engin est signalé « au contrat de location » seulement si le dossier contractuel le rattache à un tarif de location.</span>
    </p>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}

    {champs && <Panneau titre={c('id') ? 'Modifier le planning' : 'Nouveau planning'}>
      <div role="form" aria-label="Planning préventif" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <label className="text-sm">Engin *<select value={c('engin')} onChange={(e) => poser('engin', e.target.value)} className={CHAMP}>
          <option value="">Choisir</option>{engins.map((e) => <option key={e.id} value={e.id}>{e.registration} · {e.brand_model}{locations.has(e.id) ? ' (au contrat de location)' : ''}</option>)}</select></label>
        <label className="text-sm">Intitulé *<input value={c('titre')} onChange={(e) => poser('titre', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Type *<select value={c('type')} onChange={(e) => poser('type', e.target.value)} className={CHAMP}>
          <option value="">Choisir</option>{(TYPES.includes(c('type')) || !c('type') ? TYPES : [c('type'), ...TYPES]).map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
        <label className="text-sm">Intervalle (km)<input inputMode="numeric" value={c('km')} onChange={(e) => poser('km', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Intervalle (jours)<input inputMode="numeric" value={c('jours')} onChange={(e) => poser('jours', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Coût estimé (GNF, facultatif)<input inputMode="numeric" value={c('cout')} onChange={(e) => poser('cout', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Dernière intervention : compteur (km)<input inputMode="numeric" value={c('dernierKm')} onChange={(e) => poser('dernierKm', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Dernière intervention : date<input type="date" value={c('derniereDate')} onChange={(e) => poser('derniereDate', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm sm:col-span-2 xl:col-span-3">Description<input value={c('description')} onChange={(e) => poser('description', e.target.value)} className={CHAMP} /></label>
        {c('engin') && locations.has(c('engin')) && <p className="text-sm text-amber-800 sm:col-span-2 xl:col-span-3">
          Cet engin figure au contrat de location {locations.get(c('engin'))?.reference} ({locations.get(c('engin'))?.contrepartie}) : sa maintenance relève du loueur.</p>}
      </div>
      <p className="mt-2 text-xs text-stone-500">Au moins un intervalle. Sans dernière intervention connue, l'échéance reste « inconnue ».</p>
      <div className="mt-3 flex gap-2">
        <button disabled={busy || !pret} onClick={enregistrer} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer</button>
        <button onClick={() => setChamps(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Fermer</button>
      </div>
    </Panneau>}

    <Panneau titre={`Plannings (${lignes.length})`} action={<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={inactifs} onChange={(e) => setInactifs(e.target.checked)} /> Afficher les plannings désactivés</label>}>
      {plannings === null ? <p>Chargement…</p> : lignes.length === 0 ? <SansDonnees message="Aucun planning préventif" detail="Créez un planning pour un engin entretenu par KOGON." /> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500">
          <th className="py-2 pr-3">Engin</th><th className="py-2 pr-3">Planning</th><th className="py-2 pr-3">Intervalle</th><th className="py-2 pr-3">Dernière intervention</th>
          <th className="py-2 pr-3">Échéance</th><th className="py-2 pr-3">Reste</th><th /></tr></thead>
          <tbody>{lignes.map(({ p, e }) => {
            const en = p.vehicle_id ? engin.get(p.vehicle_id) : undefined; const loc = p.vehicle_id ? locations.get(p.vehicle_id) : undefined;
            const rel = p.vehicle_id ? releves.get(p.vehicle_id) : undefined;
            return <tr key={p.id} className={`border-b border-stone-100 ${p.is_active === false ? 'text-stone-400' : ''}`}>
              <td className="py-2 pr-3"><span className="font-semibold">{en?.registration ?? '—'}</span>{loc && <span className="ml-1"><Puce teinte="orange">Au contrat de location {loc.reference}</Puce></span>}</td>
              <td className="py-2 pr-3">{p.title}<span className="block text-xs text-stone-500">{p.maintenance_type}</span></td>
              <td className="py-2 pr-3 text-xs">{[p.interval_km && `${formatNombre(Number(p.interval_km), 0)} km`, p.interval_days && `${p.interval_days} j`].filter(Boolean).join(' ou ') || '—'}</td>
              <td className="py-2 pr-3 text-xs">{[p.last_maintenance_km !== null && `${formatNombre(Number(p.last_maintenance_km), 0)} km`, p.last_maintenance_date && new Date(`${p.last_maintenance_date}T00:00:00`).toLocaleDateString('fr-FR')].filter(Boolean).join(' · ') || 'Non saisie'}</td>
              <td className="py-2 pr-3">{e.statut === 'depassee' ? <Puce teinte="rouge">Dépassée</Puce> : e.statut === 'a_venir' ? <Puce teinte="bleu">À venir</Puce> : <Puce teinte="gris">Inconnue</Puce>}
                <span className="block text-xs text-stone-500">{[p.next_service_km !== null && `${formatNombre(Number(p.next_service_km), 0)} km`, p.next_service_date && new Date(`${p.next_service_date}T00:00:00`).toLocaleDateString('fr-FR')].filter(Boolean).join(' ou ')}</span></td>
              <td className="py-2 pr-3 text-xs">{e.kmRestants !== null && <span className="block">{formatNombre(e.kmRestants, 0)} km (relevé du {rel ? new Date(rel.releve_le).toLocaleDateString('fr-FR') : '?'})</span>}
                {e.joursRestants !== null && <span className="block">{e.joursRestants} j</span>}
                {e.kmRestants === null && p.next_service_km !== null && <span className="block text-stone-400">km : sans relevé compteur</span>}
                {e.kmRestants === null && e.joursRestants === null && '—'}</td>
              <td className="py-2">{peutEcrire && <span className="flex gap-1">
                <button onClick={() => ouvrir(p)} aria-label={`Modifier ${p.title}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Modifier</button>
                {p.is_active === false
                  ? <button onClick={() => reactiver(p)} aria-label={`Réactiver ${p.title}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Réactiver</button>
                  : <button onClick={() => desactiver(p)} aria-label={`Désactiver ${p.title}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Désactiver</button>}</span>}</td>
            </tr>;
          })}</tbody></table></div>}
    </Panneau>
  </div>;
};
