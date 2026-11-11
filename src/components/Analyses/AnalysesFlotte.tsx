import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { formatNombre } from '../Dashboard/indicateurs';
import { CAUSES, type Cause } from '../Maintenance/immobilisations';

// Analyses de flotte sur donnees reelles (D-030). Remplacent les maquettes
// Bolt (maintenance predictive, comportement, sante de flotte, cout de
// possession) qui lisaient des tables sans producteur ou des colonnes
// inexistantes. Une valeur non calculable reste « — ».

const n = (v: number | null | undefined, d = 0) => (v === null || v === undefined ? '—' : formatNombre(Number(v), d));
const moisCourant = () => new Date().toISOString().slice(0, 7);
const bornesMois = (mois: string) => {
  const [a, m] = mois.split('-').map(Number);
  return { du: `${mois}-01`, au: `${mois}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}` };
};
const PERIODES = [{ jours: 30, libelle: '30 jours' }, { jours: 90, libelle: '90 jours' }, { jours: 365, libelle: '12 mois' }];

const Entete = ({ titre, sousTitre, children }: { titre: string; sousTitre: string; children?: ReactNode }) => (
  <div className="flex flex-wrap items-end justify-between gap-4">
    <div><h2 className="text-2xl font-black text-stone-900">{titre}</h2><p className="text-stone-500">{sousTitre}</p></div>
    {children}
  </div>
);
const Tuiles = ({ valeurs }: { valeurs: [string, string][] }) => (
  <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Synthèse">
    {valeurs.map(([l, v]) => <div key={l} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-carte"><p className="text-sm text-stone-500">{l}</p><p className="text-2xl font-black text-stone-900">{v}</p></div>)}
  </section>
);
const Chargement = () => <div className="flex h-24 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" /></div>;

const useEngins = () => {
  const [engins, setEngins] = useState<Map<string, { registration: string; vehicle_type: string; status: string; year: number | null; current_km: number | null }>>(new Map());
  useEffect(() => {
    supabase.from('vehicles').select('id, registration, vehicle_type, status, year, current_km').then(({ data }) =>
      setEngins(new Map(((data ?? []) as { id: string; registration: string; vehicle_type: string; status: string; year: number | null; current_km: number | null }[]).map((e) => [e.id, e]))));
  }, []);
  return engins;
};

interface Fiabilite {
  vehicle_id: string; heures_periode: number; heures_arret: number; pannes: number; heures_pannes: number;
  mttr_heures: number | null; mtbf_heures: number | null; disponibilite_pct: number | null; derniere_panne: string | null; heures_loueur: number;
}

/** Fiabilite des engins (ancienne « maintenance predictive »). */
export const FiabiliteEnginsView = () => {
  const engins = useEngins();
  const [jours, setJours] = useState(90);
  const [lignes, setLignes] = useState<Fiabilite[] | null>(null);
  const [heure, setHeure] = useState<Date | null>(null);
  const charger = useCallback(async () => {
    const au = new Date();
    const du = new Date(au.getTime() - jours * 86_400_000);
    const { data } = await supabase.rpc('fiabilite_engins', { p_du: du.toISOString(), p_au: au.toISOString() });
    setLignes(((data ?? []) as Fiabilite[]).sort((a, b) => Number(b.heures_arret) - Number(a.heures_arret)));
    setHeure(new Date());
  }, [jours]);
  useEffect(() => { charger(); }, [charger]);
  const synthese = useMemo(() => {
    const l = lignes ?? [];
    const pannes = l.reduce((s, x) => s + x.pannes, 0);
    const hPannes = l.reduce((s, x) => s + Number(x.heures_pannes), 0);
    const dispo = l.filter((x) => x.disponibilite_pct !== null);
    return {
      pannes, mttr: pannes > 0 ? hPannes / pannes : null,
      dispo: dispo.length ? dispo.reduce((s, x) => s + Number(x.disponibilite_pct), 0) / dispo.length : null,
      loueur: l.reduce((s, x) => s + Number(x.heures_loueur), 0),
    };
  }, [lignes]);
  return (
    <div className="space-y-6">
      <Entete titre="Fiabilité des engins" sousTitre="Pannes, temps de réparation et disponibilité, calculés sur les immobilisations déclarées">
        <div className="flex gap-1 text-sm">{PERIODES.map((p) => <button key={p.jours} onClick={() => setJours(p.jours)} className={`rounded-lg px-3 py-1.5 ${jours === p.jours ? 'bg-orange-100 font-semibold text-orange-800' : 'border border-stone-200 bg-white'}`}>{p.libelle}</button>)}</div>
      </Entete>
      <Tuiles valeurs={[
        ['Disponibilité moyenne', synthese.dispo === null ? '—' : `${n(synthese.dispo, 1)} %`],
        ['Pannes', String(synthese.pannes)],
        ['Temps moyen de réparation', synthese.mttr === null ? '—' : `${n(synthese.mttr, 1)} h`],
        ['Heures d\'arrêt à la charge du loueur', `${n(synthese.loueur, 1)} h`],
      ]} />
      <Panneau titre="Par engin (les plus arrêtés d'abord)">
        {lignes === null ? <Chargement /> : lignes.length === 0 ? <SansDonnees message="Aucun engin" /> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b border-stone-200 text-left text-stone-500">
              <th className="py-2 pr-3 font-medium">Engin</th><th className="py-2 pr-3 text-right font-medium">Disponibilité</th><th className="py-2 pr-3 text-right font-medium">Heures d'arrêt</th>
              <th className="py-2 pr-3 text-right font-medium">Pannes</th><th className="py-2 pr-3 text-right font-medium">MTTR</th><th className="py-2 pr-3 text-right font-medium">MTBF</th><th className="py-2 font-medium">Dernière panne</th>
            </tr></thead>
            <tbody>{lignes.map((x) => (
              <tr key={x.vehicle_id} className="border-b border-stone-100 last:border-0">
                <td className="py-2 pr-3 font-semibold">{engins.get(x.vehicle_id)?.registration ?? '—'}</td>
                <td className="py-2 pr-3 text-right">{x.disponibilite_pct === null ? '—' : `${n(x.disponibilite_pct, 1)} %`}</td>
                <td className="py-2 pr-3 text-right">{n(x.heures_arret, 1)} h</td><td className="py-2 pr-3 text-right">{x.pannes}</td>
                <td className="py-2 pr-3 text-right">{x.mttr_heures === null ? '—' : `${n(x.mttr_heures, 1)} h`}</td>
                <td className="py-2 pr-3 text-right">{x.mtbf_heures === null ? '—' : `${n(x.mtbf_heures, 0)} h`}</td>
                <td className="py-2">{x.derniere_panne ? new Date(x.derniere_panne).toLocaleDateString('fr-FR') : '—'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        <Provenance source="immobilisations (pannes = panne, attente de pièce, accident) ; MTTR = heures de panne / pannes ; MTBF = heures disponibles / pannes" heure={heure} />
      </Panneau>
    </div>
  );
};

interface Perf { driver_id: string; voyages: number; tonnes: number | null; cycle_moyen_min: number | null; chargement_moyen_min: number | null; ecart_moyen_pct: number | null; litiges: number; interruptions: number }

/** Performance des chauffeurs (ancien « comportement »). */
export const PerformanceChauffeursView = () => {
  const [mois, setMois] = useState(moisCourant);
  const [lignes, setLignes] = useState<Perf[] | null>(null);
  const [noms, setNoms] = useState<Map<string, string>>(new Map());
  const [heure, setHeure] = useState<Date | null>(null);
  const charger = useCallback(async () => {
    const { du, au } = bornesMois(mois);
    const [p, d] = await Promise.all([supabase.rpc('performance_chauffeurs', { p_du: du, p_au: au }), supabase.from('drivers').select('id, name')]);
    setLignes(((p.data ?? []) as Perf[]).sort((a, b) => Number(b.tonnes ?? 0) - Number(a.tonnes ?? 0)));
    setNoms(new Map(((d.data ?? []) as { id: string; name: string }[]).map((x) => [x.id, x.name])));
    setHeure(new Date());
  }, [mois]);
  useEffect(() => { charger(); }, [charger]);
  return (
    <div className="space-y-6">
      <Entete titre="Performance des chauffeurs" sousTitre="Voyages, tonnes, temps de cycle et qualité des pesées, depuis le journal des voyages">
        <input type="month" value={mois} onChange={(e) => setMois(e.target.value)} aria-label="Mois" className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm" />
      </Entete>
      <Panneau titre="Par chauffeur">
        {lignes === null ? <Chargement /> : lignes.length === 0 ? <SansDonnees message="Aucun voyage ce mois-ci" /> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b border-stone-200 text-left text-stone-500">
              <th className="py-2 pr-3 font-medium">Chauffeur</th><th className="py-2 pr-3 text-right font-medium">Voyages livrés</th><th className="py-2 pr-3 text-right font-medium">Tonnes</th>
              <th className="py-2 pr-3 text-right font-medium">Cycle moyen</th><th className="py-2 pr-3 text-right font-medium">Chargement moyen</th>
              <th className="py-2 pr-3 text-right font-medium">Écart chargé / reçu</th><th className="py-2 pr-3 text-right font-medium">Litiges</th><th className="py-2 text-right font-medium">Interruptions</th>
            </tr></thead>
            <tbody>{lignes.map((x) => (
              <tr key={x.driver_id} className="border-b border-stone-100 last:border-0">
                <td className="py-2 pr-3 font-semibold">{noms.get(x.driver_id) ?? '—'}</td><td className="py-2 pr-3 text-right">{x.voyages}</td>
                <td className="py-2 pr-3 text-right">{n(x.tonnes, 1)}</td>
                <td className="py-2 pr-3 text-right">{x.cycle_moyen_min === null ? '—' : `${n(x.cycle_moyen_min)} min`}</td>
                <td className="py-2 pr-3 text-right">{x.chargement_moyen_min === null ? '—' : `${n(x.chargement_moyen_min)} min`}</td>
                <td className="py-2 pr-3 text-right">{x.ecart_moyen_pct === null ? '—' : `${n(x.ecart_moyen_pct, 2)} %`}</td>
                <td className="py-2 pr-3 text-right">{x.litiges ? <Puce teinte="rouge">{x.litiges}</Puce> : '0'}</td><td className="py-2 text-right">{x.interruptions}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        <Provenance source="voyages du mois et leur journal (arrivée au chargement → fin de déchargement ; début → fin de chargement)" heure={heure} />
      </Panneau>
    </div>
  );
};

/** Sante de la flotte : etat, arret en cours, disponibilite et activite sur 30 jours. */
export const SanteFlotteView = () => {
  const engins = useEngins();
  const [fiab, setFiab] = useState<Map<string, Fiabilite>>(new Map());
  const [arrets, setArrets] = useState<Map<string, { cause: Cause; debut: string }>>(new Map());
  const [voyages, setVoyages] = useState<Map<string, number>>(new Map());
  const [heure, setHeure] = useState<Date | null>(null);
  useEffect(() => {
    const au = new Date();
    const du = new Date(au.getTime() - 30 * 86_400_000);
    Promise.all([
      supabase.rpc('fiabilite_engins', { p_du: du.toISOString(), p_au: au.toISOString() }),
      supabase.from('immobilisations').select('vehicle_id, cause, debut').eq('statut', 'ouverte'),
      supabase.from('trips').select('vehicle_id').gte('planned_date', du.toISOString().slice(0, 10)).in('etat', ['DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED']),
    ]).then(([f, i, t]) => {
      setFiab(new Map(((f.data ?? []) as Fiabilite[]).map((x) => [x.vehicle_id, x])));
      setArrets(new Map(((i.data ?? []) as { vehicle_id: string; cause: Cause; debut: string }[]).map((x) => [x.vehicle_id, x])));
      const c = new Map<string, number>();
      for (const v of (t.data ?? []) as { vehicle_id: string | null }[]) if (v.vehicle_id) c.set(v.vehicle_id, (c.get(v.vehicle_id) ?? 0) + 1);
      setVoyages(c);
      setHeure(new Date());
    });
  }, []);
  const liste = [...engins.entries()].filter(([, e]) => e.status !== 'sold').sort((a, b) => a[1].registration.localeCompare(b[1].registration));
  const actifs = liste.filter(([, e]) => e.status === 'active').length;
  const dispo = [...fiab.values()].filter((x) => x.disponibilite_pct !== null);
  return (
    <div className="space-y-6">
      <Entete titre="Santé de la flotte" sousTitre="État de chaque engin, arrêt en cours, disponibilité et activité sur 30 jours" />
      <Tuiles valeurs={[
        ['Engins en service', liste.length ? `${actifs} / ${liste.length}` : '—'],
        ['Arrêtés maintenant', String(arrets.size)],
        ['Disponibilité 30 jours', dispo.length ? `${n(dispo.reduce((s, x) => s + Number(x.disponibilite_pct), 0) / dispo.length, 1)} %` : '—'],
        ['Voyages livrés 30 jours', String([...voyages.values()].reduce((s, x) => s + x, 0))],
      ]} />
      <Panneau titre="Engins">
        {liste.length === 0 ? <SansDonnees message="Aucun engin" /> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b border-stone-200 text-left text-stone-500">
              <th className="py-2 pr-3 font-medium">Engin</th><th className="py-2 pr-3 font-medium">État</th><th className="py-2 pr-3 font-medium">Arrêt en cours</th>
              <th className="py-2 pr-3 text-right font-medium">Disponibilité 30 j</th><th className="py-2 pr-3 text-right font-medium">Voyages 30 j</th><th className="py-2 pr-3 text-right font-medium">Année</th><th className="py-2 text-right font-medium">Km</th>
            </tr></thead>
            <tbody>{liste.map(([id, e]) => {
              const a = arrets.get(id);
              const f = fiab.get(id);
              return (
                <tr key={id} className="border-b border-stone-100 last:border-0">
                  <td className="py-2 pr-3 font-semibold">{e.registration}</td>
                  <td className="py-2 pr-3"><Puce teinte={e.status === 'active' ? 'vert' : e.status === 'maintenance' ? 'orange' : 'rouge'}>{e.status === 'active' ? 'En service' : e.status === 'maintenance' ? 'En maintenance' : 'Immobilisé'}</Puce></td>
                  <td className="py-2 pr-3 text-stone-600">{a ? `${CAUSES[a.cause]} depuis le ${new Date(a.debut).toLocaleDateString('fr-FR')}` : '—'}</td>
                  <td className="py-2 pr-3 text-right">{f?.disponibilite_pct === null || f === undefined ? '—' : `${n(f.disponibilite_pct, 1)} %`}</td>
                  <td className="py-2 pr-3 text-right">{voyages.get(id) ?? 0}</td><td className="py-2 pr-3 text-right">{e.year ?? '—'}</td><td className="py-2 text-right">{n(e.current_km)}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
        <Provenance source="flotte, immobilisations ouvertes, fiabilité sur 30 jours, voyages livrés" heure={heure} />
      </Panneau>
    </div>
  );
};

interface Conso { vehicle_id: string; litres: number; cout: number | null; tonnes: number | null }

/** Cout direct par tonne (ancien « cout de possession ») : charges de l'exploitant. */
export const CoutTonneView = () => {
  const engins = useEngins();
  const [mois, setMois] = useState(moisCourant);
  const [lignes, setLignes] = useState<{ id: string; carburant: number; maintenance: number; pneus: number; tonnes: number | null }[] | null>(null);
  const [heure, setHeure] = useState<Date | null>(null);
  const charger = useCallback(async () => {
    const { du, au } = bornesMois(mois);
    const [c, m, p] = await Promise.all([
      supabase.rpc('consommation_carburant', { p_du: du, p_au: au }),
      supabase.from('maintenance_orders').select('vehicle_id, actual_cost').gte('request_date', du).lte('request_date', au),
      supabase.from('tires').select('vehicle_id, purchase_price').gte('purchase_date', du).lte('purchase_date', au),
    ]);
    const parEngin = new Map<string, { id: string; carburant: number; maintenance: number; pneus: number; tonnes: number | null }>();
    const ligne = (id: string) => parEngin.get(id) ?? parEngin.set(id, { id, carburant: 0, maintenance: 0, pneus: 0, tonnes: null }).get(id)!;
    for (const x of (c.data ?? []) as Conso[]) { const l = ligne(x.vehicle_id); l.carburant += Number(x.cout ?? 0); l.tonnes = x.tonnes === null ? null : Number(x.tonnes); }
    for (const x of (m.data ?? []) as { vehicle_id: string | null; actual_cost: number | null }[]) if (x.vehicle_id) ligne(x.vehicle_id).maintenance += Number(x.actual_cost ?? 0);
    for (const x of (p.data ?? []) as { vehicle_id: string | null; purchase_price: number | null }[]) if (x.vehicle_id) ligne(x.vehicle_id).pneus += Number(x.purchase_price ?? 0);
    setLignes([...parEngin.values()].sort((a, b) => (b.carburant + b.maintenance + b.pneus) - (a.carburant + a.maintenance + a.pneus)));
    setHeure(new Date());
  }, [mois]);
  useEffect(() => { charger(); }, [charger]);
  const total = (lignes ?? []).reduce((s, x) => ({ cout: s.cout + x.carburant + x.maintenance + x.pneus, tonnes: s.tonnes + (x.tonnes ?? 0) }), { cout: 0, tonnes: 0 });
  return (
    <div className="space-y-6">
      <Entete titre="Coût direct par tonne" sousTitre="Charges de l'exploitant par engin (carburant, pneus, maintenance à sa charge) rapportées aux tonnes livrées">
        <input type="month" value={mois} onChange={(e) => setMois(e.target.value)} aria-label="Mois" className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm" />
      </Entete>
      <p className="rounded-lg bg-orange-50 p-3 text-sm text-orange-900">La location des engins (Neemba, à l'heure) n'est pas encore incluse : elle sera calculée par le contrôle des factures Neemba (phase 5).</p>
      <Tuiles valeurs={[
        ['Coûts directs du mois', lignes ? n(total.cout) : '—'],
        ['Tonnes livrées', lignes ? `${n(total.tonnes, 1)} t` : '—'],
        ['Coût direct par tonne', total.tonnes > 0 ? n(total.cout / total.tonnes, 2) : '—'],
        ['Engins concernés', lignes ? String(lignes.length) : '—'],
      ]} />
      <Panneau titre="Par engin">
        {lignes === null ? <Chargement /> : lignes.length === 0 ? <SansDonnees message="Aucun coût ce mois-ci" /> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b border-stone-200 text-left text-stone-500">
              <th className="py-2 pr-3 font-medium">Engin</th><th className="py-2 pr-3 text-right font-medium">Carburant</th><th className="py-2 pr-3 text-right font-medium">Pneus</th>
              <th className="py-2 pr-3 text-right font-medium">Maintenance</th><th className="py-2 pr-3 text-right font-medium">Tonnes</th><th className="py-2 text-right font-medium">Coût / t</th>
            </tr></thead>
            <tbody>{lignes.map((x) => {
              const cout = x.carburant + x.maintenance + x.pneus;
              return (
                <tr key={x.id} className="border-b border-stone-100 last:border-0">
                  <td className="py-2 pr-3 font-semibold">{engins.get(x.id)?.registration ?? '—'}</td><td className="py-2 pr-3 text-right">{n(x.carburant)}</td>
                  <td className="py-2 pr-3 text-right">{n(x.pneus)}</td><td className="py-2 pr-3 text-right">{n(x.maintenance)}</td>
                  <td className="py-2 pr-3 text-right">{n(x.tonnes, 1)}</td><td className="py-2 text-right font-semibold">{x.tonnes && x.tonnes > 0 ? n(cout / x.tonnes, 2) : '—'}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
        <Provenance source="pleins au prix saisi, pneus achetés (prix d'achat), ordres de maintenance (coût réel), voyages livrés du mois ; devise des saisies" heure={heure} />
      </Panneau>
    </div>
  );
};
