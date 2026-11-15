import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { formatNombre } from '../Dashboard/indicateurs';
import {
  dureeShift, evaluerScenario, scenariosProposes,
  type CapaciteSaisie, type Horizon, type ResultatScenario, type Scenario, type StatTrajet,
} from './simulation';

// Simulation et comparaison de scenarios d'affectation (D-066). Lecture
// seule : statistiques observees par destination (statistiques_trajets) et
// capacites saisies (infrastructures_site). Aucune affectation n'est ecrite.

interface Shift { id: string; display_name: string; start_time: string; end_time: string }

const CHAMP = 'rounded-lg border border-stone-300 px-3 py-2 text-sm';
const nombre = (v: number | null, decimales = 0) => (v === null ? '—' : formatNombre(v, decimales));

export const SimulationScenarios = ({
  date, site, shift, shifts, nomSite, camionsDisponibles,
}: {
  date: string;
  site: string;
  shift: string;
  shifts: Shift[];
  nomSite: Map<string, string>;
  camionsDisponibles: number;
}) => {
  const [horizon, setHorizon] = useState<Horizon>('shift');
  const [jours, setJours] = useState(14);
  const [minMesures, setMinMesures] = useState(3);
  const [camions, setCamions] = useState(String(camionsDisponibles));
  const [stats, setStats] = useState<StatTrajet[] | null>(null);
  const [capacites, setCapacites] = useState<CapaciteSaisie[]>([]);
  const [saisie, setSaisie] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  useEffect(() => { setCamions(String(camionsDisponibles)); }, [camionsDisponibles]);

  const charger = useCallback(async () => {
    if (!site) return;
    const [rS, rC] = await Promise.all([
      supabase.rpc('statistiques_trajets', { p_site_id: site, p_shift_id: horizon === 'shift' ? shift || null : null, p_jusqua: date, p_jours: jours }),
      supabase.from('infrastructures_site').select('site_id, type, code, capacite, unite_capacite, actif'),
    ]);
    setErreur(rS.error ? `Statistiques indisponibles : ${rS.error.message}` : '');
    setStats(rS.error || !Array.isArray(rS.data) ? [] : (rS.data as StatTrajet[]).map((s) => ({
      ...s,
      charge_moyenne: s.charge_moyenne === null ? null : Number(s.charge_moyenne),
      rotation_moyenne_min: s.rotation_moyenne_min === null ? null : Number(s.rotation_moyenne_min),
      cycle_moyen_min: s.cycle_moyen_min === null ? null : Number(s.cycle_moyen_min),
    })));
    setCapacites(((rC.data ?? []) as CapaciteSaisie[]).map((c) => ({ ...c, capacite: c.capacite === null ? null : Number(c.capacite) })));
    setHeure(new Date());
  }, [site, shift, date, jours, horizon]);
  useEffect(() => { charger(); }, [charger]);

  const shiftChoisi = shifts.find((s) => s.id === shift);
  const dureeMin = horizon === 'shift'
    ? (shiftChoisi ? dureeShift(shiftChoisi.start_time, shiftChoisi.end_time) : null)
    : (shifts.length > 0 ? shifts.reduce((a, s) => a + dureeShift(s.start_time, s.end_time), 0) : null);
  const nCamions = Math.max(0, Math.floor(Number(camions) || 0));
  const nom = useCallback((id: string) => nomSite.get(id) ?? 'Destination inconnue', [nomSite]);

  const scenarios: Scenario[] = useMemo(() => {
    const proposes = scenariosProposes(stats ?? [], nCamions, nom);
    return proposes.map((s) => s.nom !== 'Répartition égale' ? s : {
      nom: 'Répartition (modifiable)',
      repartition: Object.fromEntries(Object.entries(s.repartition).map(([d, n]) => [d, saisie[d] !== undefined ? Math.max(0, Math.floor(Number(saisie[d]) || 0)) : n])),
    });
  }, [stats, nCamions, nom, saisie]);

  const resultats: ResultatScenario[] = useMemo(() => (dureeMin === null ? [] : scenarios.map((scenario) => evaluerScenario({
    scenario, stats: stats ?? [], capacites, siteChargement: site, horizon, dureeMin, minMesures,
  }))), [scenarios, stats, capacites, site, horizon, dureeMin, minMesures]);

  return (
    <Panneau titre={<span className="flex items-center gap-2"><FlaskConical className="h-5 w-5 text-orange-700" /> Simulation de scénarios</span>}>
      <p className="mb-3 text-sm text-stone-600">
        Comparaison indicative de répartitions des camions entre destinations, calculée sur les rotations observées. Rien n'est écrit : l'affectation reste une décision du dispatcher.
      </p>
      <div className="mb-4 flex flex-wrap items-end gap-3 text-sm" role="group" aria-label="Paramètres de la simulation">
        <label>Horizon<select aria-label="Horizon" value={horizon} onChange={(e) => setHorizon(e.target.value as Horizon)} className={`mt-1 block ${CHAMP}`}>
          <option value="shift">Shift {shiftChoisi?.display_name ?? ''}</option><option value="jour">Journée (shifts actifs)</option></select></label>
        <label>Camions<input aria-label="Camions simulés" inputMode="numeric" value={camions} onChange={(e) => setCamions(e.target.value)} className={`mt-1 block w-24 ${CHAMP}`} /></label>
        <label>Observation<select aria-label="Période observée" value={jours} onChange={(e) => setJours(Number(e.target.value))} className={`mt-1 block ${CHAMP}`}>
          {[7, 14, 30, 60].map((j) => <option key={j} value={j}>{j} derniers jours</option>)}</select></label>
        <label>Mesures minimales<input aria-label="Mesures minimales par trajet" inputMode="numeric" value={minMesures} onChange={(e) => setMinMesures(Math.max(1, Math.floor(Number(e.target.value) || 1)))} className={`mt-1 block w-24 ${CHAMP}`} /></label>
      </div>
      {erreur && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}

      {stats === null ? <p className="text-sm text-stone-400">Chargement…</p> : stats.length === 0 ? (
        <SansDonnees message="Sans données" detail="Aucun voyage livré depuis ce site sur la période observée : aucune rotation à exploiter, aucun scénario n'est estimé." />
      ) : (
        <>
          <h3 className="mb-2 text-sm font-bold text-stone-800">Observé par destination ({jours} jours avant le {new Date(date).toLocaleDateString('fr-FR')})</h3>
          <div className="mb-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-stone-200 text-left text-stone-500">
                <th className="py-2 pr-3 font-medium">Destination</th><th className="py-2 pr-3 text-right font-medium">Voyages livrés</th>
                <th className="py-2 pr-3 text-right font-medium">Charge moyenne</th><th className="py-2 pr-3 text-right font-medium">Cycle moyen</th>
                <th className="py-2 pr-3 text-right font-medium">Rotation moyenne</th>
              </tr></thead>
              <tbody>{stats.map((s) => (
                <tr key={s.arrival_site_id} className="border-b border-stone-100 last:border-0">
                  <td className="py-2 pr-3 font-semibold text-stone-900">{nom(s.arrival_site_id)}</td>
                  <td className="py-2 pr-3 text-right">{s.voyages_livres} <span className="text-xs text-stone-400">({s.jours_observes} j)</span></td>
                  <td className="py-2 pr-3 text-right">{s.charge_moyenne === null ? 'sans pesée' : `${nombre(s.charge_moyenne, 1)} t`} <span className="text-xs text-stone-400">({s.voyages_pesees} pesées)</span></td>
                  <td className="py-2 pr-3 text-right">{s.cycle_moyen_min === null ? '—' : `${s.cycle_moyen_min} min`} <span className="text-xs text-stone-400">({s.cycles_mesures})</span></td>
                  <td className="py-2 pr-3 text-right">
                    {s.rotation_moyenne_min === null ? 'non mesurée' : `${s.rotation_moyenne_min} min`} <span className="text-xs text-stone-400">({s.rotations_mesurees} mesures{s.rotation_min_observee !== null ? `, ${s.rotation_min_observee} à ${s.rotation_max_observee} min` : ''})</span>
                    {s.rotations_mesurees < minMesures && <span className="ml-2"><Puce teinte="orange">Données insuffisantes</Puce></span>}
                  </td>
                </tr>))}</tbody>
            </table>
          </div>

          {dureeMin === null ? <SansDonnees message="Durée de l'horizon inconnue" detail="Aucun shift actif paramétré : la durée de travail n'est pas connue, aucun scénario n'est estimé." /> : (
            <>
              <h3 className="mb-2 text-sm font-bold text-stone-800">Comparaison ({formatNombre(dureeMin / 60, 1)} h de travail, {nCamions} camion(s))</h3>
              <div className="mb-3 overflow-x-auto">
                <table className="w-full text-sm" aria-label="Comparaison des scénarios">
                  <thead><tr className="border-b border-stone-200 text-left text-stone-500">
                    <th className="py-2 pr-3 font-medium">Scénario</th><th className="py-2 pr-3 font-medium">Répartition</th>
                    <th className="py-2 pr-3 text-right font-medium">Voyages estimés</th><th className="py-2 pr-3 text-right font-medium">Tonnes estimées</th>
                    <th className="py-2 font-medium">Remarques</th>
                  </tr></thead>
                  <tbody>{resultats.map((r) => (
                    <tr key={r.nom} className="border-b border-stone-100 align-top last:border-0">
                      <td className="py-2 pr-3 font-semibold text-stone-900">{r.nom}</td>
                      <td className="py-2 pr-3">
                        <ul className="space-y-1">{r.lignes.map((l) => (
                          <li key={l.destination} className="text-stone-700">
                            {r.nom === 'Répartition (modifiable)' ? (
                              <input aria-label={`Camions vers ${nom(l.destination)}`} inputMode="numeric" value={saisie[l.destination] ?? String(l.camions)}
                                onChange={(e) => setSaisie({ ...saisie, [l.destination]: e.target.value })} className="mr-1 w-14 rounded border border-stone-300 px-1 py-0.5 text-sm" />
                            ) : <b>{l.camions}</b>} → {nom(l.destination)}
                            {l.statut === 'estime' && <span className="text-xs text-stone-500"> · {l.voyagesParCamion} voyage(s)/camion (rotation {l.rotationMin} min) = {l.voyages} voyages{l.tonnes !== null ? `, ${nombre(l.tonnes)} t` : ''}</span>}
                            {l.plafonne && <span className="text-xs text-orange-700"> · {l.plafonne}</span>}
                            {l.remarques.map((m) => <span key={m} className="block text-xs text-red-700">{m}</span>)}
                          </li>))}</ul>
                      </td>
                      <td className="py-2 pr-3 text-right font-semibold">{nombre(r.voyages)}</td>
                      <td className="py-2 pr-3 text-right font-semibold">{r.tonnes === null ? 'non estimé' : `${nombre(r.tonnes)} t`}</td>
                      <td className="py-2 text-xs text-stone-600">{[r.plafonne, ...r.remarques].filter(Boolean).join(' ; ') || (r.complet ? 'Toutes les mesures requises sont présentes' : '')}</td>
                    </tr>))}</tbody>
                </table>
              </div>
            </>
          )}
          <div className="rounded-xl bg-stone-50 p-3 text-xs text-stone-600">
            <p className="font-semibold text-stone-700">Calcul (pas d'optimisation)</p>
            <p>Voyages par camion = partie entière de (durée de l'horizon / rotation moyenne observée). Voyages = camions × voyages par camion. Tonnes = voyages × charge moyenne observée (tonnage accepté, sinon reçu, sinon chargé).</p>
            <p>Rotation : de l'arrivée au chargement à l'arrivée au chargement suivante du même camion, le même jour et sur le même shift ; seuls les voyages livrés comptent. Un trajet avec moins de {minMesures} rotation(s) mesurée(s) n'est pas estimé.</p>
            <p>Les capacités saisies (Sites, infrastructures) plafonnent le résultat quand leur unité est exploitable (tonnes ou voyages, par heure, par shift ou par jour selon l'horizon). Le calcul ne modélise ni l'attente au chargement ni les pannes : il reprend les durées observées telles quelles.</p>
          </div>
        </>
      )}
      <Provenance source={`statistiques_trajets (journal des voyages, ${jours} jours avant la date), capacités des infrastructures ; aucune écriture`} heure={heure} />
    </Panneau>
  );
};
