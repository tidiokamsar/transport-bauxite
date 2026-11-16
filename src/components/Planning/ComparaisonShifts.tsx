import { useCallback, useEffect, useState } from 'react';
import { Download, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { exportToCSV } from '../../lib/exports';
import { formatNombre } from '../Dashboard/indicateurs';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { tauxAbsence, tonnesParJour, type LigneShift } from './planAvance';

// Comparaison entre shifts (D-063) : comparer_shifts sur une periode
// (voyages, tonnes, durees medianes de rotation et de trajet, objectifs,
// postes D-048, incidents, arrets, absences), et historique des equipes
// (postes de la periode, presences pointees). Une valeur non mesuree reste
// « — », jamais 0.

interface Poste {
  id: string; date_poste: string; shift_id: string; site_id: string; statut: 'ouvert' | 'cloture' | 'valide';
  responsable_id: string | null; postes_equipe: { present: boolean | null }[] | null;
}

const n = (v: number | null | undefined, unite = '', dec = 0) =>
  v === null || v === undefined ? '—' : `${formatNombre(Number(v), dec)}${unite}`;
const STATUT_POSTE = { ouvert: { l: 'Ouvert', t: 'bleu' }, cloture: { l: 'Clos', t: 'orange' }, valide: { l: 'Validé', t: 'vert' } } as const;

export const ComparaisonShifts = ({ date, siteId, nomSite, nomShift }: {
  date: string;
  siteId: string | null;
  nomSite: (id: string) => string;
  nomShift: (id: string | null) => string;
}) => {
  const debutDefaut = (() => { const d = new Date(`${date}T00:00:00`); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); })();
  const [periode, setPeriode] = useState({ debut: debutDefaut, fin: date });
  const [lignes, setLignes] = useState<LigneShift[] | null>(null);
  const [postes, setPostes] = useState<Poste[]>([]);
  const [noms, setNoms] = useState<Map<string, string>>(new Map());
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    let q = supabase.from('postes').select('id, date_poste, shift_id, site_id, statut, responsable_id, postes_equipe(present)')
      .gte('date_poste', periode.debut).lte('date_poste', periode.fin).order('date_poste', { ascending: false }).limit(200);
    if (siteId) q = q.eq('site_id', siteId);
    const [c, p, pr] = await Promise.all([
      supabase.rpc('comparer_shifts', { p_debut: periode.debut, p_fin: periode.fin, p_site: siteId }),
      q,
      supabase.from('profiles').select('id, full_name'),
    ]);
    setErreur(c.error ? 'Comparaison indisponible : ' + c.error.message : '');
    setLignes(c.error ? [] : ((c.data ?? []) as LigneShift[]));
    setPostes((p.data ?? []) as Poste[]);
    setNoms(new Map(((pr.data ?? []) as { id: string; full_name: string | null }[]).map((x) => [x.id, x.full_name ?? '—'])));
    setHeure(new Date());
  }, [periode, siteId]);
  useEffect(() => { charger(); }, [charger]);

  const exporter = () => exportToCSV((lignes ?? []).map((l) => ({
    shift: l.shift, jours: l.jours, voyages: l.voyages, voyages_livres: l.voyages_livres, tonnes_livrees: l.tonnes_livrees,
    tonnes_par_voyage: l.tonnes_par_voyage, rotation_mediane_min: l.duree_rotation_min, rotations_mesurees: l.rotations_mesurees,
    trajet_median_min: l.duree_trajet_min, objectif_t: l.tonnes_cible, realisation_pct: l.realisation_pct, postes: l.postes,
    incidents: l.incidents, arrets: l.arrets, absences: l.absences, retard_minutes: l.retard_minutes,
  })), 'comparaison_shifts');

  return (
    <div className="space-y-4">
      <Panneau
        titre="Comparaison entre shifts"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={periode.debut} onChange={(e) => setPeriode({ ...periode, debut: e.target.value })} className="rounded-lg border border-stone-300 px-2 py-1 text-sm" aria-label="Début de la comparaison" />
            <input type="date" value={periode.fin} onChange={(e) => setPeriode({ ...periode, fin: e.target.value })} className="rounded-lg border border-stone-300 px-2 py-1 text-sm" aria-label="Fin de la comparaison" />
            <button onClick={exporter} className="rounded-lg p-2 text-stone-600 hover:bg-stone-100" aria-label="Exporter la comparaison"><Download className="h-4 w-4" /></button>
          </div>
        }
      >
        {erreur && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
        {lignes === null ? <p className="text-sm text-stone-400">Chargement...</p> : lignes.length === 0 ? (
          <SansDonnees message="Aucune activité" detail="Ni voyage, ni poste, ni objectif de shift sur la période." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Comparaison des shifts">
              <thead className="text-left text-xs text-stone-500">
                <tr>
                  <th className="py-2 pr-3">Shift</th><th className="py-2 pr-3 text-right">Voyages livrés</th><th className="py-2 pr-3 text-right">Tonnes</th>
                  <th className="py-2 pr-3 text-right">t / jour</th><th className="py-2 pr-3 text-right">t / voyage</th>
                  <th className="py-2 pr-3 text-right">Rotation</th><th className="py-2 pr-3 text-right">Trajet</th>
                  <th className="py-2 pr-3 text-right">Objectif</th><th className="py-2 pr-3 text-right">Postes</th>
                  <th className="py-2 pr-3 text-right">Incidents</th><th className="py-2 pr-3 text-right">Arrêts</th><th className="py-2 text-right">Absences</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => {
                  const absence = tauxAbsence(l);
                  return (
                    <tr key={l.shift_id ?? 'sans'} className="border-t border-stone-100">
                      <td className="py-2 pr-3 font-semibold">{l.shift}</td>
                      <td className="py-2 pr-3 text-right">{l.voyages_livres} / {l.voyages}</td>
                      <td className="py-2 pr-3 text-right">{n(l.tonnes_livrees, ' t')}{l.voyages_sans_poids ? <span className="block text-[11px] text-stone-400">{l.voyages_sans_poids} sans poids</span> : null}</td>
                      <td className="py-2 pr-3 text-right">{n(tonnesParJour(l), ' t')}<span className="block text-[11px] text-stone-400">{l.jours} j</span></td>
                      <td className="py-2 pr-3 text-right">{n(l.tonnes_par_voyage, ' t', 1)}</td>
                      <td className="py-2 pr-3 text-right">{n(l.duree_rotation_min, ' min')}<span className="block text-[11px] text-stone-400">{l.rotations_mesurees} mesures</span></td>
                      <td className="py-2 pr-3 text-right">{n(l.duree_trajet_min, ' min')}<span className="block text-[11px] text-stone-400">{l.trajets_mesures} mesures</span></td>
                      <td className="py-2 pr-3 text-right">{l.tonnes_cible === null ? '—' : <>{n(l.realisation_pct, ' %', 1)}<span className="block text-[11px] text-stone-400">de {n(l.tonnes_cible, ' t')}</span></>}</td>
                      <td className="py-2 pr-3 text-right">{l.postes ? `${l.postes_clos} / ${l.postes}` : '—'}</td>
                      <td className="py-2 pr-3 text-right">{n(l.incidents)}</td>
                      <td className="py-2 pr-3 text-right">{n(l.arrets)}</td>
                      <td className="py-2 text-right">{n(l.absences)}{absence !== null ? <span className="block text-[11px] text-stone-400">{formatNombre(absence, 0)} % de l'équipe</span> : null}{l.retard_minutes ? <span className="block text-[11px] text-stone-400">{l.retard_minutes} min de retard</span> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Provenance source="comparer_shifts : voyages non annulés par date prévue et site de départ ; rotation = médiane entre deux départs d'un même camion ; trajet = médiane départ -> arrivée ; incidents, arrêts et absences des postes (D-048), « — » sans poste" heure={heure} />
      </Panneau>

      <Panneau titre={<span className="flex items-center gap-2"><Users className="h-5 w-5 text-orange-600" /> Historique des équipes</span>}>
        {postes.length === 0 ? (
          <SansDonnees message="Aucun poste" detail="Aucun poste de travail ouvert sur la période." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-stone-500">
                <tr><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Shift</th><th className="py-2 pr-3">Site</th><th className="py-2 pr-3">Responsable</th><th className="py-2 pr-3">Statut</th><th className="py-2 text-right">Présents / absents</th></tr>
              </thead>
              <tbody>
                {postes.map((p) => {
                  const equipe = p.postes_equipe ?? [];
                  const s = STATUT_POSTE[p.statut];
                  return (
                    <tr key={p.id} className="border-t border-stone-100">
                      <td className="py-2 pr-3">{new Date(`${p.date_poste}T00:00:00`).toLocaleDateString('fr-FR')}</td>
                      <td className="py-2 pr-3">{nomShift(p.shift_id)}</td>
                      <td className="py-2 pr-3">{nomSite(p.site_id)}</td>
                      <td className="py-2 pr-3">{p.responsable_id ? noms.get(p.responsable_id) ?? '—' : '—'}</td>
                      <td className="py-2 pr-3"><Puce teinte={s.t}>{s.l}</Puce></td>
                      <td className="py-2 text-right">
                        {equipe.length === 0 ? 'Équipe non saisie'
                          : `${equipe.filter((e) => e.present === true).length} / ${equipe.filter((e) => e.present === false).length}${equipe.some((e) => e.present === null) ? ' (pointage incomplet)' : ''}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panneau>
    </div>
  );
};
