import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ListPlus, PenLine, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSite } from '../../contexts/SiteContext';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { formatNombre } from '../Dashboard/indicateurs';
import {
  A_AFFECTER, TYPES_ENGIN, camionDisponible, chauffeurDisponible, instantane, raisonReaffectation, recommander, voyagesAPreparer,
  type Chauffeur, type Engin, type Recommandation, type VoyageShift,
} from './recommandation';
import { FenetreDecision, type ModeDecision } from './FenetreDecision';

// Dispatch v1 (etape 4 de la reprise, CDC 11, D-024). Le systeme recommande
// selon des regles fixes et affichees ; le dispatcher accepte, modifie ou
// refuse ; chaque decision passe par decider_affectation et est historisee.

const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const decaler = (date: string, jours: number) => {
  const [a, m, j] = date.split('-').map(Number);
  const d = new Date(a, m - 1, j + jours);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface Shift { id: string; display_name: string; start_time: string; end_time: string }
interface Decision {
  id: string;
  trip_id: string;
  decision: string;
  nature: string;
  recommandation: { camion?: string | null; chauffeur?: string | null };
  vehicle_id: string | null;
  driver_id: string | null;
  motif: string | null;
  decide_le: string;
}

const shiftCourant = (shifts: Shift[]) => {
  const maintenant = new Date();
  const minutes = maintenant.getHours() * 60 + maintenant.getMinutes();
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return shifts.find((s) => {
    const d = m(s.start_time);
    const f = m(s.end_time);
    return d < f ? minutes >= d && minutes < f : minutes >= d || minutes < f;
  }) ?? shifts[0];
};

const DECISIONS: Record<string, { libelle: string; teinte: 'vert' | 'orange' | 'rouge' }> = {
  acceptee: { libelle: 'Acceptée', teinte: 'vert' },
  modifiee: { libelle: 'Modifiée', teinte: 'orange' },
  refusee: { libelle: 'Refusée', teinte: 'rouge' },
};

type Ouverte = { mode: ModeDecision; recommandation: Recommandation; reference: string; raison?: string } | null;

export const DispatchView = () => {
  const { hasPermission } = useAuth();
  const { siteId, sites } = useSite();
  const peutEcrire = hasPermission('trips', 'create') || hasPermission('trips', 'edit');
  const [date, setDate] = useState(aujourdhui);
  const [site, setSite] = useState('');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shift, setShift] = useState('');
  const [engins, setEngins] = useState<Engin[]>([]);
  const [chauffeurs, setChauffeurs] = useState<Chauffeur[]>([]);
  const [voyages, setVoyages] = useState<(VoyageShift & { arrival_site_id: string | null })[] | null>(null);
  const [habitudes, setHabitudes] = useState<Map<string, string>>(new Map());
  const [objectif, setObjectif] = useState<{ tonnes_cible: number; voyages_cible: number | null } | null>(null);
  const [charge, setCharge] = useState<number | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);
  const [ouverte, setOuverte] = useState<Ouverte>(null);
  const [destination, setDestination] = useState('');
  const [nombre, setNombre] = useState('');
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('work_shifts').select('id, display_name, start_time, end_time').eq('is_active', true).order('shift_order'),
      supabase.from('vehicles').select('id, registration, vehicle_type, status, site_id').order('registration'),
      supabase.from('drivers').select('id, name, status, license_expiry').order('name'),
    ]).then(([s, v, d]) => {
      const liste = (s.data ?? []) as Shift[];
      setShifts(liste);
      setShift((x) => x || shiftCourant(liste)?.id || '');
      setEngins((v.data ?? []) as Engin[]);
      setChauffeurs((d.data ?? []) as Chauffeur[]);
    });
  }, []);

  useEffect(() => {
    if (siteId) setSite(siteId);
    else if (!site && sites.length > 0) setSite((sites.find((s) => s.type === 'mine') ?? sites[0]).id);
  }, [siteId, sites, site]);

  const charger = useCallback(async () => {
    if (!site || !shift) return;
    const [rV, rH, rO, rS] = await Promise.all([
      supabase.from('trips').select('id, reference, etat, departure_site_id, arrival_site_id, vehicle_id, driver_id, loader_vehicle_id')
        .eq('planned_date', date).eq('departure_site_id', site).eq('shift_id', shift).order('reference'),
      supabase.from('trips').select('vehicle_id, driver_id').eq('departure_site_id', site)
        .gte('planned_date', decaler(date, -14)).lt('planned_date', date)
        .not('vehicle_id', 'is', null).not('driver_id', 'is', null).limit(5000),
      supabase.from('v_realisation_objectifs').select('tonnes_cible, voyages_cible').eq('date_plan', date).eq('site_id', site).eq('shift_id', shift),
      supabase.rpc('statistiques_rotation', { p_site_id: site, p_shift_id: shift, p_jusqua: date }),
    ]);
    if (rV.error) {
      setErreur('Voyages indisponibles : ' + rV.error.message);
      setVoyages([]);
    } else {
      setErreur('');
      setVoyages((rV.data ?? []) as (VoyageShift & { arrival_site_id: string | null })[]);
    }
    // Chauffeur habituel : le plus frequent sur chaque camion (14 jours).
    const comptes = new Map<string, Map<string, number>>();
    for (const t of (rH.data ?? []) as { vehicle_id: string; driver_id: string }[]) {
      const c = comptes.get(t.vehicle_id) ?? new Map<string, number>();
      c.set(t.driver_id, (c.get(t.driver_id) ?? 0) + 1);
      comptes.set(t.vehicle_id, c);
    }
    setHabitudes(new Map([...comptes].map(([v, c]) => [v, [...c].sort((a, b) => b[1] - a[1])[0][0]])));
    setObjectif(((rO.data ?? []) as { tonnes_cible: number; voyages_cible: number | null }[])[0] ?? null);
    const stats = Array.isArray(rS.data) ? (rS.data[0] as { charge_moyenne: number | null } | undefined) : undefined;
    setCharge(stats?.charge_moyenne ? Number(stats.charge_moyenne) : null);
    const ids = ((rV.data ?? []) as { id: string }[]).map((t) => t.id);
    if (ids.length > 0) {
      const rD = await supabase.from('decisions_dispatch')
        .select('id, trip_id, decision, nature, recommandation, vehicle_id, driver_id, motif, decide_le')
        .in('trip_id', ids).order('decide_le', { ascending: false }).limit(200);
      setDecisions((rD.data ?? []) as Decision[]);
    } else setDecisions([]);
    setHeure(new Date());
  }, [date, site, shift]);

  useEffect(() => {
    charger();
    const minuterie = window.setInterval(charger, 60_000);
    return () => window.clearInterval(minuterie);
  }, [charger]);

  const camionParId = useMemo(() => new Map(engins.map((e) => [e.id, e])), [engins]);
  const chauffeurParId = useMemo(() => new Map(chauffeurs.map((c) => [c.id, c])), [chauffeurs]);
  const nomSite = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites]);
  const referenceDe = useMemo(() => new Map((voyages ?? []).map((v) => [v.id, v.reference])), [voyages]);

  const { aAffecter, aReaffecter, recommandations, affectes } = useMemo(() => {
    const liste = voyages ?? [];
    const aAffecter = liste.filter((v) => A_AFFECTER.includes(v.etat ?? '') && !v.vehicle_id);
    const aReaffecter = liste
      .map((v) => ({ voyage: v, raison: raisonReaffectation(v, camionParId, chauffeurParId, date) }))
      .filter((x): x is { voyage: typeof x.voyage; raison: string } => x.raison !== null);
    // Les voyages a reaffecter ne comptent pas dans la charge de leur
    // camion ou chauffeur indisponible.
    const enService = liste.filter((v) => !aReaffecter.some((r) => r.voyage.id === v.id));
    const recommandations = recommander({
      date,
      voyages: enService,
      cibles: [
        ...aAffecter.map((voyage) => ({ voyage })),
        ...aReaffecter.map((r) => ({ voyage: r.voyage, exclureCamion: r.voyage.vehicle_id })),
      ],
      engins,
      chauffeurs,
      habitudes,
    });
    return {
      aAffecter,
      aReaffecter,
      recommandations: new Map(recommandations.map((r) => [r.voyageId, r])),
      affectes: liste.filter((v) => v.vehicle_id && !A_AFFECTER.includes(v.etat ?? '') && !['CANCELLED', 'REJECTED'].includes(v.etat ?? '')).length,
    };
  }, [voyages, camionParId, chauffeurParId, date, engins, chauffeurs, habitudes]);

  const camionsSite = engins.filter((e) => camionDisponible(e) && (e.site_id === null || e.site_id === site));
  const enginsSite = engins.filter((e) => e.status === 'active' && TYPES_ENGIN.includes(e.vehicle_type) && (e.site_id === null || e.site_id === site));
  const chauffeursDispo = chauffeurs.filter((c) => chauffeurDisponible(c, date));
  const actifs = (voyages ?? []).filter((v) => !['CANCELLED', 'REJECTED'].includes(v.etat ?? '')).length;
  const proposition = voyagesAPreparer(objectif, charge, actifs);

  useEffect(() => {
    setNombre(proposition && proposition.nombre > 0 ? String(proposition.nombre) : '');
  }, [proposition?.nombre]); // eslint-disable-line react-hooks/exhaustive-deps

  const accepter = async (ids: string[]) => {
    setEnCours(true);
    setErreur('');
    for (const id of ids) {
      const r = recommandations.get(id);
      if (!r || r.impossible || !r.camion || !r.chauffeur) continue;
      const { error } = await supabase.rpc('decider_affectation', {
        p_trip_id: id,
        p_decision: 'acceptee',
        p_vehicle_id: r.camion.id,
        p_driver_id: r.chauffeur.id,
        p_loader_vehicle_id: r.engin?.id ?? null,
        p_recommandation: instantane(r),
        p_motif: null,
      });
      if (error) {
        setErreur(`${referenceDe.get(id) ?? id} : ${error.message}`);
        break;
      }
    }
    setEnCours(false);
    charger();
  };

  const preparer = async () => {
    setEnCours(true);
    setErreur('');
    const { error } = await supabase.rpc('preparer_voyages', {
      p_date: date, p_site_id: site, p_destination_id: destination, p_shift_id: shift, p_nombre: Number(nombre),
    });
    setEnCours(false);
    if (error) setErreur(error.message);
    charger();
  };

  const acceptables = aAffecter.filter((v) => {
    const r = recommandations.get(v.id);
    return r && !r.impossible && r.camion && r.chauffeur;
  });

  const ligneRecommandation = (r: Recommandation | undefined) => r && (
    r.impossible ? <span className="font-medium text-red-700">{r.impossible}</span> : (
      <>
        <p className="font-semibold text-stone-900">{[r.camion?.registration, r.chauffeur?.name, r.engin?.registration].filter(Boolean).join(' · ')}</p>
        <ul className="mt-0.5 space-y-0.5 text-xs text-stone-500">{r.explications.map((e) => <li key={e}>{e}</li>)}</ul>
      </>
    )
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900">Dispatch</h2>
          <p className="text-stone-500">Le système recommande, le dispatcher décide ; chaque décision est historisée</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm" />
          <select value={site} onChange={(e) => setSite(e.target.value)} aria-label="Site de chargement" className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm" disabled={Boolean(siteId)}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={shift} onChange={(e) => setShift(e.target.value)} aria-label="Shift" className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm">
            {shifts.map((s) => <option key={s.id} value={s.id}>Shift {s.display_name}</option>)}
          </select>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5" aria-label="Synthèse du shift">
        {[
          ['Voyages du shift', actifs],
          ['À affecter', aAffecter.length],
          ['Affectés et engagés', affectes],
          ['À réaffecter', aReaffecter.length],
          ['Camions disponibles', camionsSite.length],
        ].map(([libelle, valeur]) => (
          <div key={libelle} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-carte">
            <p className="text-sm text-stone-500">{libelle}</p>
            <p className="text-2xl font-black text-stone-900">{voyages ? valeur : '—'}</p>
          </div>
        ))}
      </section>

      {erreur && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}

      {peutEcrire && (
        <Panneau titre="Préparer le shift">
          <p className="mb-3 text-sm text-stone-600">
            {objectif
              ? <>Objectif : <b>{formatNombre(Number(objectif.tonnes_cible))} t</b>{objectif.voyages_cible ? ` (${objectif.voyages_cible} voyages)` : ''} ; {actifs} voyage(s) déjà créé(s). {proposition ? `Proposition : ${proposition.nombre} voyage(s), ${proposition.base}.` : 'Charge moyenne inconnue : saisissez le nombre.'}</>
              : 'Aucun objectif pour ce shift (Planification). Saisissez le nombre de voyages à créer.'}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-stone-700">Destination</span>
              <select value={destination} onChange={(e) => setDestination(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm">
                <option value="">Choisir</option>
                {sites.filter((s) => s.id !== site).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-stone-700">Nombre de voyages</span>
              <input inputMode="numeric" value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-32 rounded-lg border border-stone-300 px-3 py-2 text-sm" />
            </label>
            <button
              onClick={preparer}
              disabled={enCours || !destination || !(Number(nombre) >= 1)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              <ListPlus className="h-4 w-4" /> Créer les voyages
            </button>
          </div>
        </Panneau>
      )}

      <Panneau
        titre={`Recommandations (${aAffecter.length})`}
        action={peutEcrire && acceptables.length > 0 && (
          <button onClick={() => accepter(acceptables.map((v) => v.id))} disabled={enCours} className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            <Check className="h-4 w-4" /> Tout accepter ({acceptables.length})
          </button>
        )}
      >
        {voyages === null ? (
          <div className="flex h-24 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" /></div>
        ) : aAffecter.length === 0 ? (
          <SansDonnees message="Aucun voyage à affecter" detail="Tous les voyages du shift ont un camion, ou aucun voyage n'est préparé." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-stone-500">
                  <th className="py-2 pr-3 font-medium">Voyage</th>
                  <th className="py-2 pr-3 font-medium">Destination</th>
                  <th className="py-2 pr-3 font-medium">Recommandation et raisons</th>
                  {peutEcrire && <th className="py-2 font-medium">Décision</th>}
                </tr>
              </thead>
              <tbody>
                {aAffecter.map((v) => {
                  const r = recommandations.get(v.id);
                  return (
                    <tr key={v.id} className="border-b border-stone-100 align-top last:border-0">
                      <td className="py-2.5 pr-3 font-semibold text-stone-900">{v.reference}</td>
                      <td className="py-2.5 pr-3 text-stone-700">{nomSite.get(v.arrival_site_id ?? '') ?? '—'}</td>
                      <td className="py-2.5 pr-3">{ligneRecommandation(r)}</td>
                      {peutEcrire && r && (
                        <td className="whitespace-nowrap py-2.5">
                          {!r.impossible && (
                            <button onClick={() => accepter([v.id])} disabled={enCours} className="mr-1 rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100" aria-label={`Accepter ${v.reference}`}>
                              <Check className="inline h-3.5 w-3.5" /> Accepter
                            </button>
                          )}
                          <button onClick={() => setOuverte({ mode: 'modifiee', recommandation: r, reference: v.reference })} className="mr-1 rounded-lg bg-orange-50 px-2.5 py-1.5 text-xs font-semibold text-orange-800 hover:bg-orange-100" aria-label={`Modifier ${v.reference}`}>
                            <PenLine className="inline h-3.5 w-3.5" /> Modifier
                          </button>
                          <button onClick={() => setOuverte({ mode: 'refusee', recommandation: r, reference: v.reference })} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100" aria-label={`Refuser ${v.reference}`}>
                            <X className="inline h-3.5 w-3.5" /> Refuser
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panneau>

      {aReaffecter.length > 0 && (
        <Panneau titre={`À réaffecter (${aReaffecter.length})`}>
          <ul className="divide-y divide-stone-100">
            {aReaffecter.map(({ voyage: v, raison }) => {
              const r = recommandations.get(v.id);
              return (
                <li key={v.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-stone-900">{v.reference} <span className="ml-2 font-medium text-red-700">{raison}</span></p>
                    <p className="text-stone-500">Actuel : {camionParId.get(v.vehicle_id ?? '')?.registration ?? '—'} · {chauffeurParId.get(v.driver_id ?? '')?.name ?? '—'}</p>
                    <div className="mt-1">{ligneRecommandation(r)}</div>
                  </div>
                  {peutEcrire && r && (
                    <button onClick={() => setOuverte({ mode: 'reaffectation', recommandation: r, reference: v.reference, raison })} className="rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-800 hover:bg-orange-100">
                      Réaffecter
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Panneau>
      )}

      <Panneau titre="Journal des décisions du shift">
        {decisions.length === 0 ? (
          <SansDonnees message="Aucune décision" detail="Les acceptations, modifications et refus apparaîtront ici." />
        ) : (
          <ul className="divide-y divide-stone-100 text-sm">
            {decisions.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="w-12 text-stone-500">{new Date(d.decide_le).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="font-semibold text-stone-900">{referenceDe.get(d.trip_id) ?? '—'}</span>
                <Puce teinte={DECISIONS[d.decision]?.teinte ?? 'orange'}>{DECISIONS[d.decision]?.libelle ?? d.decision}</Puce>
                {d.nature === 'reaffectation' && <span className="text-xs text-stone-500">réaffectation</span>}
                <span className="text-stone-700">
                  {d.decision === 'refusee'
                    ? `recommandé : ${d.recommandation?.camion ?? '—'}`
                    : `${camionParId.get(d.vehicle_id ?? '')?.registration ?? '—'} · ${chauffeurParId.get(d.driver_id ?? '')?.name ?? '—'}`}
                </span>
                {d.motif && <span className="text-stone-500">« {d.motif} »</span>}
              </li>
            ))}
          </ul>
        )}
      </Panneau>
      <Provenance source="voyages du shift, flotte et chauffeurs ; recommandation par règles fixes (camion le moins chargé, chauffeur habituel sur 14 jours, file de chargement la plus courte) ; décisions historisées" heure={heure} />

      {ouverte && (
        <FenetreDecision
          mode={ouverte.mode}
          reference={ouverte.reference}
          recommandation={ouverte.recommandation}
          raison={ouverte.raison}
          camions={camionsSite}
          chauffeurs={chauffeursDispo}
          engins={enginsSite}
          onFermer={() => setOuverte(null)}
          onDecide={() => { setOuverte(null); charger(); }}
        />
      )}
    </div>
  );
};
