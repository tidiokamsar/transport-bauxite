import { useCallback, useEffect, useMemo, useState } from 'react';
import { Circle, MapContainer, Polygon, Popup, TileLayer } from 'react-leaflet';
import { Info, Plus, RefreshCw } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Puce, SansDonnees, type TeintePuce } from '../ui/Panneau';
import { lirePolygone } from './zones';

// Georeperage (D-061) : referentiel des zones (lecture gps_tracking et
// perimetre du site, ecriture par droit du module, desactivation au lieu de
// suppression). PostGIS absent et moniteur non deploye : aucune detection
// n'est faite ici ni inventee ; les violations et alertes ne viennent que
// d'une source serveur et se traitent (acquittement, resolution motivee,
// lecture). Aucune position par defaut : une zone se saisit avec ses
// coordonnees.

interface Zone {
  id: string; name: string; description: string | null; zone_type: string; geometry_type: 'circle' | 'polygon';
  polygon_coordinates: [number, number][] | null; center_lat: number | null; center_lng: number | null; radius_meters: number | null;
  color: string | null; is_active: boolean | null; site_id: string | null; max_speed_kmh: number | null; max_dwell_minutes: number | null;
  alert_on_entry: boolean | null; alert_on_exit: boolean | null; alert_on_dwell: boolean | null;
}
interface Violation {
  id: string; zone_id: string; vehicle_id: string; violation_type: string; severity: string; status: string; description: string | null;
  entry_time: string | null; created_at: string; resolution_notes: string | null;
  zone: { name: string } | null; vehicle: { registration: string } | null; driver: { name: string } | null;
}
interface Alerte { id: string; alert_type: string; priority: string; message: string; created_at: string }
interface Lib { id: string; libelle: string }

const CHAMP = 'mt-1 w-full rounded border border-stone-300 px-3 py-2';
const TYPES_ZONE: Record<string, string> = { mine: 'Mine', depot: 'Dépôt', route: 'Route', restricted: 'Zone interdite', loading: 'Chargement', maintenance: 'Maintenance', parking: 'Parking', customs: 'Douane' };
const TYPES_VIOLATION: Record<string, string> = { unauthorized_entry: 'Entrée non autorisée', unauthorized_exit: 'Sortie non autorisée', overstay: 'Dépassement de durée', speeding: 'Excès de vitesse', restricted_hours: 'Horaire non autorisé' };
const STATUTS_VIOLATION: Record<string, { libelle: string; teinte: TeintePuce }> = {
  open: { libelle: 'Ouverte', teinte: 'rouge' }, acknowledged: { libelle: 'Acquittée', teinte: 'orange' }, investigating: { libelle: 'En analyse', teinte: 'bleu' },
  resolved: { libelle: 'Résolue', teinte: 'vert' }, false_positive: { libelle: 'Faux positif', teinte: 'gris' },
};
const nombre = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

export default function GeofencingView() {
  const { hasPermission, user } = useAuth();
  const peutEcrire = hasPermission('gps_tracking', 'create') || hasPermission('gps_tracking', 'edit');
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [sites, setSites] = useState<Lib[]>([]);
  const [inactives, setInactives] = useState(false);
  const [champs, setChamps] = useState<Record<string, string> | null>(null);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const [z, v, a, s] = await Promise.all([
      supabase.from('geofence_zones').select('id, name, description, zone_type, geometry_type, polygon_coordinates, center_lat, center_lng, radius_meters, color, is_active, site_id, max_speed_kmh, max_dwell_minutes, alert_on_entry, alert_on_exit, alert_on_dwell').order('name'),
      supabase.from('geofence_violations').select('id, zone_id, vehicle_id, violation_type, severity, status, description, entry_time, created_at, resolution_notes, zone:geofence_zones(name), vehicle:vehicles(registration), driver:drivers(name)')
        .order('created_at', { ascending: false }).limit(100),
      supabase.from('geofence_alerts').select('id, alert_type, priority, message, created_at').eq('is_read', false).order('created_at', { ascending: false }).limit(50),
      supabase.from('sites').select('id, name').order('name'),
    ]);
    setErreur(z.error?.message ?? v.error?.message ?? a.error?.message ?? '');
    setZones((z.data ?? []) as Zone[]);
    setViolations((v.data ?? []) as unknown as Violation[]);
    setAlertes((a.data ?? []) as Alerte[]);
    setSites((s.data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string })));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const nomSite = useMemo(() => new Map(sites.map((s) => [s.id, s.libelle])), [sites]);
  const visibles = (zones ?? []).filter((z) => inactives || z.is_active !== false);
  const positionnees = visibles.filter((z) => (z.geometry_type === 'circle' && z.center_lat !== null && z.center_lng !== null && z.radius_meters)
    || (z.geometry_type === 'polygon' && Array.isArray(z.polygon_coordinates) && z.polygon_coordinates.length >= 3));
  const premier = positionnees[0];
  const centre: [number, number] | null = premier
    ? (premier.geometry_type === 'circle' ? [Number(premier.center_lat), Number(premier.center_lng)] : premier.polygon_coordinates![0])
    : null;

  const executer = async (action: () => PromiseLike<{ error: { message: string } | null }>, succes: string) => {
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await action();
    setBusy(false);
    if (error) { setErreur(error.message); return; }
    setMessage(succes); setChamps(null); await charger();
  };
  const c = (k: string) => champs?.[k] ?? '';
  const poser = (k: string, v: string) => setChamps({ ...(champs ?? {}), [k]: v });
  const ouvrir = (z?: Zone) => {
    setErreur(''); setMessage('');
    setChamps(z ? {
      id: z.id, nom: z.name, description: z.description ?? '', type: z.zone_type, geometrie: z.geometry_type, site: z.site_id ?? '',
      lat: z.center_lat?.toString() ?? '', lng: z.center_lng?.toString() ?? '', rayon: z.radius_meters?.toString() ?? '',
      polygone: (z.polygon_coordinates ?? []).map((p) => p.join(', ')).join('\n'), couleur: z.color ?? '#8B5CF6',
      vitesse: z.max_speed_kmh?.toString() ?? '', duree: z.max_dwell_minutes?.toString() ?? '',
      entree: z.alert_on_entry ? '1' : '', sortie: z.alert_on_exit ? '1' : '', sejour: z.alert_on_dwell ? '1' : '',
    } : { type: '', geometrie: 'circle', couleur: '#8B5CF6' });
  };
  const cercle = c('geometrie') === 'circle';
  const polygone = cercle ? null : lirePolygone(c('polygone'));
  const lat = nombre(c('lat')); const lng = nombre(c('lng')); const rayon = nombre(c('rayon'));
  const geometrieValide = cercle
    ? lat !== null && lng !== null && rayon !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && rayon > 0
    : polygone !== null;
  const pret = champs && c('nom').trim() && c('type') && geometrieValide;

  const enregistrer = () => {
    const valeurs = {
      name: c('nom').trim(), description: c('description').trim() || null, zone_type: c('type'), geometry_type: c('geometrie'),
      site_id: c('site') || null, color: c('couleur') || null,
      center_lat: cercle ? lat : null, center_lng: cercle ? lng : null, radius_meters: cercle && rayon !== null ? Math.round(rayon) : null,
      polygon_coordinates: cercle ? null : polygone,
      max_speed_kmh: nombre(c('vitesse')), max_dwell_minutes: nombre(c('duree')),
      alert_on_entry: !!c('entree'), alert_on_exit: !!c('sortie'), alert_on_dwell: !!c('sejour'),
    };
    return executer(() => c('id') ? supabase.from('geofence_zones').update(valeurs).eq('id', c('id')) : supabase.from('geofence_zones').insert({ ...valeurs, is_active: true }),
      c('id') ? 'Zone modifiée.' : 'Zone créée.');
  };
  const basculer = (z: Zone) => {
    const activer = z.is_active === false;
    if (!activer && !window.confirm(`Désactiver la zone « ${z.name} » ? Elle restera consultable.`)) return;
    executer(() => supabase.from('geofence_zones').update({ is_active: activer }).eq('id', z.id), activer ? 'Zone réactivée.' : 'Zone désactivée.');
  };
  const acquitter = (v: Violation) => executer(() => supabase.from('geofence_violations')
    .update({ status: 'acknowledged', acknowledged_by: user?.id ?? null, acknowledged_at: new Date().toISOString() }).eq('id', v.id), 'Violation acquittée.');
  const cloturer = (v: Violation, statut: 'resolved' | 'false_positive') => {
    const notes = window.prompt(statut === 'resolved' ? 'Commentaire de résolution (obligatoire)' : 'Pourquoi est-ce un faux positif ? (obligatoire)');
    if (!notes?.trim()) return;
    executer(() => supabase.from('geofence_violations').update({ status: statut, resolution_notes: notes.trim(), resolved_at: new Date().toISOString() }).eq('id', v.id),
      statut === 'resolved' ? 'Violation résolue.' : 'Violation classée faux positif.');
  };
  const marquerLue = (a: Alerte) => executer(() => supabase.from('geofence_alerts').update({ is_read: true, read_by: user?.id ?? null, read_at: new Date().toISOString() }).eq('id', a.id), 'Alerte marquée lue.');

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Géorepérage</h2>
        <p className="text-sm text-stone-500">Zones géographiques des sites ; une zone se désactive, elle ne se supprime pas.</p></div>
      <div className="flex flex-wrap gap-2">
        {peutEcrire && <button onClick={() => ouvrir()} className="flex items-center gap-2 rounded-lg bg-orange-700 px-3 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Nouvelle zone</button>}
        <button onClick={charger} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
      </div>
    </header>
    <p role="note" className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span>Aucune détection automatique n'est en service (PostGIS absent, moniteur non déployé) : les règles d'alerte d'une zone sont enregistrées sans effet,
        et aucune violation n'est calculée par cet écran. Les violations et alertes affichées proviennent uniquement d'une source serveur.</span>
    </p>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}

    {champs && <Panneau titre={c('id') ? 'Modifier la zone' : 'Nouvelle zone'}>
      <div role="form" aria-label="Zone de géorepérage" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <label className="text-sm">Nom *<input value={c('nom')} onChange={(e) => poser('nom', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Type *<select value={c('type')} onChange={(e) => poser('type', e.target.value)} className={CHAMP}>
          <option value="">Choisir</option>{Object.entries(TYPES_ZONE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="text-sm">Site<select value={c('site')} onChange={(e) => poser('site', e.target.value)} className={CHAMP}>
          <option value="">Aucun (visible des comptes globaux)</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}</select></label>
        <label className="text-sm">Géométrie<select value={c('geometrie')} onChange={(e) => poser('geometrie', e.target.value)} className={CHAMP}>
          <option value="circle">Cercle</option><option value="polygon">Polygone</option></select></label>
        {cercle ? <>
          <label className="text-sm">Latitude du centre *<input inputMode="decimal" value={c('lat')} onChange={(e) => poser('lat', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Longitude du centre *<input inputMode="decimal" value={c('lng')} onChange={(e) => poser('lng', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Rayon (m) *<input inputMode="numeric" value={c('rayon')} onChange={(e) => poser('rayon', e.target.value)} className={CHAMP} /></label>
        </> : <label className="text-sm sm:col-span-2">Sommets * (« latitude, longitude » par ligne, au moins 3)
          <textarea rows={4} value={c('polygone')} onChange={(e) => poser('polygone', e.target.value)} className={CHAMP} /></label>}
        <label className="text-sm">Couleur<input type="color" value={c('couleur') || '#8B5CF6'} onChange={(e) => poser('couleur', e.target.value)} className="mt-1 h-10 w-full rounded border border-stone-300" /></label>
        <label className="text-sm">Vitesse maximale (km/h)<input inputMode="numeric" value={c('vitesse')} onChange={(e) => poser('vitesse', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Durée maximale (min)<input inputMode="numeric" value={c('duree')} onChange={(e) => poser('duree', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm sm:col-span-2 xl:col-span-3">Description<input value={c('description')} onChange={(e) => poser('description', e.target.value)} className={CHAMP} /></label>
        <fieldset className="text-sm sm:col-span-2 xl:col-span-3"><legend className="mb-1">Règles d'alerte (sans effet tant qu'aucune détection n'est en service)</legend>
          <span className="flex flex-wrap gap-4">
            {[['entree', 'Entrée'], ['sortie', 'Sortie'], ['sejour', 'Durée de séjour']].map(([k, l]) => <label key={k} className="flex items-center gap-2">
              <input type="checkbox" checked={!!c(k)} onChange={(e) => poser(k, e.target.checked ? '1' : '')} /> {l}</label>)}
          </span></fieldset>
      </div>
      <div className="mt-3 flex gap-2">
        <button disabled={busy || !pret} onClick={enregistrer} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer</button>
        <button onClick={() => setChamps(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Fermer</button>
      </div>
    </Panneau>}

    <Panneau titre={`Zones (${visibles.length})`} action={<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={inactives} onChange={(e) => setInactives(e.target.checked)} /> Afficher les zones désactivées</label>}>
      {zones === null ? <p>Chargement…</p> : visibles.length === 0 ? <SansDonnees message="Aucune zone" detail="Créez une zone avec ses coordonnées réelles." /> : <>
        {centre ? <div className="mb-4 h-[420px] overflow-hidden rounded-lg border border-stone-200">
          <MapContainer center={centre} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {positionnees.map((z) => {
              const style = { color: z.color ?? '#8B5CF6', fillOpacity: z.is_active === false ? 0.05 : 0.2, weight: 2, dashArray: z.is_active === false ? '4' : undefined };
              const bulle = <Popup><strong>{z.name}</strong><br />{TYPES_ZONE[z.zone_type] ?? z.zone_type}{z.is_active === false ? ' · désactivée' : ''}</Popup>;
              return z.geometry_type === 'circle'
                ? <Circle key={z.id} center={[Number(z.center_lat), Number(z.center_lng)]} radius={Number(z.radius_meters)} pathOptions={style}>{bulle}</Circle>
                : <Polygon key={z.id} positions={z.polygon_coordinates!} pathOptions={style}>{bulle}</Polygon>;
            })}
          </MapContainer></div> : <p className="mb-3 text-sm text-stone-500">Aucune zone positionnée : carte non affichée.</p>}
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500">
          <th className="py-2 pr-3">Zone</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Site</th><th className="py-2 pr-3">Géométrie</th><th className="py-2 pr-3">Statut</th><th /></tr></thead>
          <tbody>{visibles.map((z) => <tr key={z.id} className={`border-b border-stone-100 ${z.is_active === false ? 'text-stone-400' : ''}`}>
            <td className="py-2 pr-3"><span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: z.color ?? '#8B5CF6' }} />{z.name}
              {z.description && <span className="block text-xs text-stone-500">{z.description}</span>}</td>
            <td className="py-2 pr-3">{TYPES_ZONE[z.zone_type] ?? z.zone_type}</td>
            <td className="py-2 pr-3">{z.site_id ? nomSite.get(z.site_id) ?? '?' : '—'}</td>
            <td className="py-2 pr-3 text-xs">{z.geometry_type === 'circle' ? (z.radius_meters ? `Cercle, ${z.radius_meters} m` : 'Cercle sans centre') : `Polygone, ${z.polygon_coordinates?.length ?? 0} sommets`}</td>
            <td className="py-2 pr-3">{z.is_active === false ? <Puce teinte="gris">Désactivée</Puce> : <Puce teinte="vert">Active</Puce>}</td>
            <td className="py-2">{peutEcrire && <span className="flex gap-1">
              <button onClick={() => ouvrir(z)} aria-label={`Modifier ${z.name}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Modifier</button>
              <button onClick={() => basculer(z)} aria-label={`${z.is_active === false ? 'Réactiver' : 'Désactiver'} ${z.name}`} className="rounded border border-stone-300 px-2 py-1 text-xs">{z.is_active === false ? 'Réactiver' : 'Désactiver'}</button></span>}</td>
          </tr>)}</tbody></table></div>
      </>}
    </Panneau>

    <Panneau titre={`Violations (${violations.length})`}>
      {violations.length === 0 ? <SansDonnees message="Aucune violation" detail="Aucune source de détection n'a enregistré de violation." /> :
        <ul className="divide-y divide-stone-100 text-sm">{violations.map((v) => {
          const st = STATUTS_VIOLATION[v.status];
          return <li key={v.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
            <div><span className="font-semibold">{TYPES_VIOLATION[v.violation_type] ?? v.violation_type}</span> · {v.zone?.name ?? '—'} · {v.vehicle?.registration ?? '—'}{v.driver ? ` · ${v.driver.name}` : ''}
              <span className="block text-xs text-stone-500">{new Date(v.entry_time ?? v.created_at).toLocaleString('fr-FR')} · gravité {v.severity}{v.description ? ` · ${v.description}` : ''}{v.resolution_notes ? ` · ${v.resolution_notes}` : ''}</span></div>
            <span className="flex items-center gap-1">{st ? <Puce teinte={st.teinte}>{st.libelle}</Puce> : v.status}
              {peutEcrire && v.status === 'open' && <button onClick={() => acquitter(v)} className="rounded border border-stone-300 px-2 py-1 text-xs">Acquitter</button>}
              {peutEcrire && ['open', 'acknowledged', 'investigating'].includes(v.status) && <>
                <button onClick={() => cloturer(v, 'resolved')} className="rounded border border-stone-300 px-2 py-1 text-xs">Résoudre</button>
                <button onClick={() => cloturer(v, 'false_positive')} className="rounded border border-stone-300 px-2 py-1 text-xs">Faux positif</button></>}</span>
          </li>;
        })}</ul>}
    </Panneau>

    <Panneau titre={`Alertes non lues (${alertes.length})`}>
      {alertes.length === 0 ? <SansDonnees message="Aucune alerte non lue" /> :
        <ul className="divide-y divide-stone-100 text-sm">{alertes.map((a) => <li key={a.id} className="flex items-center justify-between gap-2 py-2">
          <span>{a.message}<span className="block text-xs text-stone-500">{new Date(a.created_at).toLocaleString('fr-FR')} · priorité {a.priority}</span></span>
          <button onClick={() => marquerLue(a)} className="rounded border border-stone-300 px-2 py-1 text-xs">Marquer lue</button></li>)}</ul>}
    </Panneau>
  </div>;
}
