import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, PenLine, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSite } from '../../contexts/SiteContext';
import { Panneau, Provenance, Puce, ReferentielVide, SansDonnees } from '../ui/Panneau';
import { SANS_SHIFT, SANS_SITE } from '../ui/referentiels';
import { LienVue } from '../ui/LienVue';
import {
  A_AFFECTER, TYPES_ENGIN, camionDisponible, chauffeurDisponible, instantane, raisonReaffectation, recommander,
  type Chauffeur, type Engin, type Recommandation,
} from './recommandation';
import { COLONNES_VOYAGE, type Voyage } from '../Trips/types';
import { messageErreur, shiftHoraire, type VueVoyages } from './controle';
import { FenetreDecision, type ModeDecision } from './FenetreDecision';
import { SimulationScenarios } from './SimulationScenarios';
import { TableauDeBordDispatch } from './TableauDeBordDispatch';
import { PanneauShift } from './PanneauShift';
import { VoyagesParEtat } from './VoyagesParEtat';
import { SupervisionDispatch } from './SupervisionDispatch';
import { SANCTIONS_CONDUITE, SELECTION_SANCTIONS_CONDUITE, sanctionsConduiteParChauffeur, type SanctionConduite } from '../Drivers/infractions';

// Dispatch Control Center (D-087, etend D-024 et D-066). Le systeme
// recommande selon des regles fixes et affichees ; le dispatcher accepte,
// modifie ou refuse ; chaque decision passe par affecter_voyage (controle de
// version) puis decider_affectation, et est historisee. Le filtre date, site
// et shift n'est jamais un shift actif : l'etat de l'instance (postes) est
// affiche dans l'onglet Shift.

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
interface Suspension { trip_id: string; action: 'suspension' | 'reprise'; motif: string; cree_le: string; rang: number }

const DECISIONS: Record<string, { libelle: string; teinte: 'vert' | 'orange' | 'rouge' }> = {
  acceptee: { libelle: 'Acceptée', teinte: 'vert' },
  modifiee: { libelle: 'Modifiée', teinte: 'orange' },
  refusee: { libelle: 'Refusée', teinte: 'rouge' },
};

type Onglet = 'affectations' | 'voyages' | 'supervision' | 'shift' | 'journal';
const ONGLETS: { cle: Onglet; libelle: string }[] = [
  { cle: 'affectations', libelle: 'Affectations' },
  { cle: 'voyages', libelle: 'Voyages par état' },
  { cle: 'supervision', libelle: 'Supervision' },
  { cle: 'shift', libelle: 'Shift et préparation' },
  { cle: 'journal', libelle: 'Journal' },
];
const ENGAGES = ['AT_LOADING', 'LOADING', 'LOADED', 'WEIGHED_OUT', 'IN_TRANSIT', 'AT_DESTINATION', 'UNLOADING', 'WEIGHED_IN', 'INTERRUPTED'];
const TERMINES = ['DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED', 'CANCELLED', 'REJECTED'];

type Ouverte = { mode: ModeDecision; recommandation: Recommandation; reference: string; raison?: string } | null;
interface LigneRapport { trip_id: string | null; reference: string | null; resultat: 'affecte' | 'refuse'; raison: string | null }

export const DispatchView = () => {
  const { hasPermission } = useAuth();
  const { siteId, sites, aucunSite } = useSite();
  const peutEcrire = hasPermission('trips', 'create') || hasPermission('trips', 'edit');
  const [date, setDate] = useState(aujourdhui);
  const [site, setSite] = useState('');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [aucunShift, setAucunShift] = useState(false);
  const [shift, setShift] = useState('');
  const [engins, setEngins] = useState<Engin[]>([]);
  const [chauffeurs, setChauffeurs] = useState<Chauffeur[]>([]);
  const [voyages, setVoyages] = useState<Voyage[] | null>(null);
  const [habitudes, setHabitudes] = useState<Map<string, string>>(new Map());
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [suspensions, setSuspensions] = useState<Suspension[]>([]);
  const [immobilises, setImmobilises] = useState<Set<string>>(new Set());
  const [nonHabilites, setNonHabilites] = useState<Map<string, string> | undefined>(undefined);
  const [engagesAilleurs, setEngagesAilleurs] = useState<Map<string, string>>(new Map());
  const [cycleMin, setCycleMin] = useState<number | null>(null);
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);
  const [actualisation, setActualisation] = useState(0);
  const [onglet, setOnglet] = useState<Onglet>('affectations');
  const [vue, setVue] = useState<VueVoyages | 'tous'>('tous');
  const [ouverte, setOuverte] = useState<Ouverte>(null);
  const [enCours, setEnCours] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [rapport, setRapport] = useState<LigneRapport[] | null>(null);
  const [sanctions, setSanctions] = useState<Map<string, SanctionConduite[]>>(new Map());
  const [erreurSanctions, setErreurSanctions] = useState('');

  useEffect(() => {
    Promise.all([
      supabase.from('work_shifts').select('id, display_name, start_time, end_time').eq('is_active', true).order('shift_order'),
      supabase.from('vehicles').select('id, registration, vehicle_type, status, site_id, capacity_tonnes').order('registration'),
      supabase.from('drivers').select('id, name, status, license_expiry').order('name'),
      supabase.from('sanctions_infraction').select(SELECTION_SANCTIONS_CONDUITE)
        .eq('statut', 'active').in('sanction', SANCTIONS_CONDUITE).limit(1000),
    ]).then(([s, v, d, rS]) => {
      const liste = (s.data ?? []) as Shift[];
      setShifts(liste);
      setAucunShift(!s.error && liste.length === 0);
      if (s.error) setErreur('Shifts non lus : ' + s.error.message);
      // Filtre initial : le shift dont la plage couvre l'heure, sinon le
      // premier. Ce n'est qu'un filtre, jamais un shift actif.
      setShift((x) => x || (shiftHoraire(liste, new Date()) ?? liste[0])?.id || '');
      setEngins((v.data ?? []) as Engin[]);
      setChauffeurs((d.data ?? []) as Chauffeur[]);
      // Avertissement seulement : une lecture impossible est signalee, jamais tue.
      setErreurSanctions(rS.error ? `Sanctions en vigueur non lues : ${rS.error.message}` : '');
      setSanctions(rS.error ? new Map() : sanctionsConduiteParChauffeur(rS.data ?? []));
    });
  }, []);

  useEffect(() => {
    if (siteId) setSite(siteId);
    else if (!site && sites.length > 0) setSite((sites.find((s) => s.type === 'mine') ?? sites[0]).id);
  }, [siteId, sites, site]);

  const charger = useCallback(async () => {
    // Sans site ou sans shift (referentiel vide) : aucune requete, liste vide
    // explicite, jamais d'identifiant vide envoye au serveur.
    if (!site || !shift) {
      setVoyages([]);
      setDecisions([]);
      setSuspensions([]);
      setHabitudes(new Map());
      return;
    }
    const [rV, rH, rI, rHab, rE, rC] = await Promise.all([
      supabase.from('trips').select(COLONNES_VOYAGE)
        .eq('planned_date', date).eq('departure_site_id', site).eq('shift_id', shift).order('reference'),
      supabase.from('trips').select('vehicle_id, driver_id').eq('departure_site_id', site)
        .gte('planned_date', decaler(date, -14)).lt('planned_date', date)
        .not('vehicle_id', 'is', null).not('driver_id', 'is', null).limit(5000),
      supabase.from('immobilisations').select('vehicle_id').eq('statut', 'ouverte').limit(2000),
      supabase.rpc('habilitations_dispatch', { p_date: date }),
      supabase.from('trips').select('vehicle_id, driver_id, shift_id').gte('planned_date', decaler(date, -1)).lte('planned_date', date)
        .in('etat', ENGAGES).not('driver_id', 'is', null).limit(2000),
      supabase.rpc('durees_voyages', { p_debut: decaler(date, -14), p_fin: decaler(date, -1) }),
    ]);
    if (rV.error) {
      setErreur('Voyages non lus : ' + rV.error.message);
      setVoyages([]);
    } else {
      setErreur('');
      setVoyages((rV.data ?? []) as Voyage[]);
    }
    setImmobilises(new Set(((rI.data ?? []) as { vehicle_id: string }[]).map((i) => i.vehicle_id)));
    // Habilitations non lues : l'ecran ne les verifie pas, le serveur si.
    setNonHabilites(rHab.error || !Array.isArray(rHab.data) ? undefined
      : new Map((rHab.data as { driver_id: string; manquant: string }[]).map((h) => [h.driver_id, h.manquant])));
    setEngagesAilleurs(new Map(((rE.data ?? []) as { vehicle_id: string | null; driver_id: string; shift_id: string | null }[])
      .filter((t) => t.shift_id !== shift && t.vehicle_id).map((t) => [t.driver_id, t.vehicle_id as string])));
    const cycles = (Array.isArray(rC.data) ? rC.data as { departure_site_id: string | null; shift_id: string | null; cycle_min: number | null }[] : [])
      .filter((d) => d.departure_site_id === site && d.shift_id === shift && d.cycle_min !== null).map((d) => Number(d.cycle_min));
    setCycleMin(cycles.length > 0 ? Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length) : null);
    // Chauffeur habituel : le plus frequent sur chaque camion (14 jours).
    const comptes = new Map<string, Map<string, number>>();
    for (const t of (rH.data ?? []) as { vehicle_id: string; driver_id: string }[]) {
      const c = comptes.get(t.vehicle_id) ?? new Map<string, number>();
      c.set(t.driver_id, (c.get(t.driver_id) ?? 0) + 1);
      comptes.set(t.vehicle_id, c);
    }
    setHabitudes(new Map([...comptes].map(([v, c]) => [v, [...c].sort((a, b) => b[1] - a[1])[0][0]])));
    const ids = ((rV.data ?? []) as { id: string }[]).map((t) => t.id);
    if (ids.length > 0) {
      const [rD, rS] = await Promise.all([
        supabase.from('decisions_dispatch')
          .select('id, trip_id, decision, nature, recommandation, vehicle_id, driver_id, motif, decide_le')
          .in('trip_id', ids).order('decide_le', { ascending: false }).limit(3000),
        supabase.from('suspensions_voyage').select('trip_id, action, motif, cree_le, rang').in('trip_id', ids).order('rang').limit(3000),
      ]);
      setDecisions((rD.data ?? []) as Decision[]);
      setSuspensions((rS.data ?? []) as Suspension[]);
    } else {
      setDecisions([]);
      setSuspensions([]);
    }
    setHeure(new Date());
    setActualisation((n) => n + 1);
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

  // Version d'un voyage pour le dispatch : decisions et suspensions connues
  // (controle de version de affecter_voyage, D-087).
  const versions = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of decisions) m.set(d.trip_id, (m.get(d.trip_id) ?? 0) + 1);
    for (const s of suspensions) m.set(s.trip_id, (m.get(s.trip_id) ?? 0) + 1);
    return m;
  }, [decisions, suspensions]);
  const suspendus = useMemo(() => {
    const dernier = new Map<string, Suspension['action']>();
    for (const s of suspensions) dernier.set(s.trip_id, s.action);
    return new Set([...dernier].filter(([, a]) => a === 'suspension').map(([id]) => id));
  }, [suspensions]);
  const contexte = useMemo(() => ({ immobilises, nonHabilites, chauffeursEngages: engagesAilleurs, cycleMin }),
    [immobilises, nonHabilites, engagesAilleurs, cycleMin]);

  const { aAffecter, aReaffecter, recommandations } = useMemo(() => {
    const liste = voyages ?? [];
    const aAffecter = liste.filter((v) => A_AFFECTER.includes(v.etat ?? '') && !v.vehicle_id);
    const aReaffecter = liste
      .map((v) => {
        const base = raisonReaffectation(v, camionParId, chauffeurParId, date);
        const raison = base
          ?? (v.etat === 'ASSIGNED' && v.vehicle_id && immobilises.has(v.vehicle_id)
            ? `Camion ${camionParId.get(v.vehicle_id)?.registration ?? ''} immobilisé`
            : v.etat === 'ASSIGNED' && v.driver_id && nonHabilites?.has(v.driver_id)
              ? `${chauffeurParId.get(v.driver_id)?.name ?? 'Chauffeur'} non habilité (${nonHabilites.get(v.driver_id)})`
              : null);
        return { voyage: v, raison };
      })
      .filter((x): x is { voyage: Voyage; raison: string } => x.raison !== null);
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
      sanctions,
      contexte,
    });
    return { aAffecter, aReaffecter, recommandations: new Map(recommandations.map((r) => [r.voyageId, r])) };
  }, [voyages, camionParId, chauffeurParId, date, engins, chauffeurs, habitudes, sanctions, contexte, immobilises, nonHabilites]);

  const camionsSite = engins.filter((e) => camionDisponible(e) && !immobilises.has(e.id) && (e.site_id === null || e.site_id === site));
  const enginsSite = engins.filter((e) => e.status === 'active' && !immobilises.has(e.id) && TYPES_ENGIN.includes(e.vehicle_type) && (e.site_id === null || e.site_id === site));
  const chauffeursDispo = chauffeurs.filter((c) => chauffeurDisponible(c, date) && !nonHabilites?.has(c.id));
  const nonTermines = (voyages ?? []).filter((v) => !TERMINES.includes(v.etat ?? '')).length;
  const aReaffecterIds = useMemo(() => new Set(aReaffecter.map((r) => r.voyage.id)), [aReaffecter]);
  const libelleShift = `${date} · ${nomSite.get(site) ?? 'site'} · Shift ${shifts.find((s) => s.id === shift)?.display_name ?? ''}`;
  const libelleVoyage = (v: Voyage) => ({
    camion: camionParId.get(v.vehicle_id ?? '')?.registration ?? '—',
    chauffeur: chauffeurParId.get(v.driver_id ?? '')?.name ?? '—',
    chargeuse: camionParId.get(v.loader_vehicle_id ?? '')?.registration ?? '—',
    origine: nomSite.get(v.departure_site_id ?? '') ?? '—',
    destination: nomSite.get(v.arrival_site_id ?? '') ?? '—',
    shift: shifts.find((s) => s.id === v.shift_id)?.display_name ?? '—',
  });

  const accepter = async (ids: string[]) => {
    setEnCours(true);
    setErreur('');
    for (const id of ids) {
      const r = recommandations.get(id);
      if (!r || r.impossible || !r.camion || !r.chauffeur) continue;
      const { error } = await supabase.rpc('affecter_voyage', {
        p_trip_id: id,
        p_decision: 'acceptee',
        p_vehicle_id: r.camion.id,
        p_driver_id: r.chauffeur.id,
        p_loader_vehicle_id: r.engin?.id ?? null,
        p_recommandation: instantane(r),
        p_motif: null,
        p_version_attendue: versions.get(id) ?? 0,
      });
      if (error) {
        setErreur(`${referenceDe.get(id) ?? id} : ${messageErreur(error)}`);
        break;
      }
    }
    setEnCours(false);
    charger();
  };

  // Affectation groupee (D-066) : une operation, chaque voyage passe par
  // decider_affectation dans son propre sous-bloc ; rapport par voyage.
  const affecterEnGroupe = async (ids: string[]) => {
    const affectations = ids.flatMap((id) => {
      const r = recommandations.get(id);
      return r && !r.impossible && r.camion && r.chauffeur
        ? [{ voyage: id, camion: r.camion.id, chauffeur: r.chauffeur.id, engin: r.engin?.id ?? null, recommandation: instantane(r) }]
        : [];
    });
    if (affectations.length === 0) return;
    setEnCours(true);
    setErreur('');
    const { data, error } = await supabase.rpc('affecter_en_groupe', { p_affectations: affectations });
    setEnCours(false);
    if (error) setErreur(messageErreur(error));
    else setRapport(Array.isArray(data) ? (data as LigneRapport[]) : []);
    setSelection(new Set());
    charger();
  };

  const acceptables = aAffecter.filter((v) => {
    const r = recommandations.get(v.id);
    return r && !r.impossible && r.camion && r.chauffeur && !suspendus.has(v.id);
  });

  const selectionnes = acceptables.filter((v) => selection.has(v.id));

  const ligneRecommandation = (r: Recommandation | undefined) => r && (
    r.impossible ? <span className="font-medium text-red-700">{r.impossible}</span> : (
      <>
        <p className="font-semibold text-stone-900">{[r.camion?.registration, r.chauffeur?.name, r.engin?.registration].filter(Boolean).join(' · ')}</p>
        <ul className="mt-0.5 space-y-0.5 text-xs text-stone-500">{r.explications.map((e) => <li key={e}>{e}</li>)}</ul>
        <p className="mt-0.5 text-xs text-stone-500">
          Confiance {r.confiance === 'elevee' ? 'élevée' : r.confiance}
          {r.capacite !== null ? ` · ${r.capacite} t` : ''}
          {r.dureeEstimeeMin !== null ? ` · cycle observé ${r.dureeEstimeeMin} min` : ''}
          {r.manques.length > 0 ? ` · manque : ${r.manques.join(', ')}` : ''}
        </p>
        {r.avertissements.map((a) => <p key={a} role="note" className="mt-1 text-xs font-medium text-orange-800">{a}</p>)}
      </>
    )
  );

  const pret = Boolean(site && shift);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900">Dispatch</h2>
          <p className="text-stone-500">Centre de contrôle : le système recommande, le dispatcher décide ; chaque décision est historisée</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm" />
          <select value={site} onChange={(e) => setSite(e.target.value)} aria-label="Site de chargement" className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm" disabled={Boolean(siteId) || sites.length === 0}>
            {sites.length === 0 && <option value="">Aucun site</option>}
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={shift} onChange={(e) => setShift(e.target.value)} aria-label="Shift" title="Filtre : shift configuré (l'état du shift est dans l'onglet Shift)" disabled={shifts.length === 0} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm">
            {shifts.length === 0 && <option value="">Aucun shift</option>}
            {shifts.map((s) => <option key={s.id} value={s.id}>Shift {s.display_name}</option>)}
          </select>
        </div>
      </div>

      {aucunSite && <ReferentielVide>{SANS_SITE} Le dispatch prépare ensuite les voyages de ce site.</ReferentielVide>}
      {aucunShift && <ReferentielVide>{SANS_SHIFT} <LienVue vue="shifts">Ouvrir la gestion des shifts</LienVue></ReferentielVide>}
      {erreur && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
      {erreurSanctions && <p role="alert" className="rounded-lg bg-orange-50 p-3 text-sm text-orange-800">{erreurSanctions}</p>}

      {pret && <TableauDeBordDispatch date={date} site={site} shift={shift} actualisation={actualisation}
        onFiltre={(v) => { setVue(v); setOnglet('voyages'); }} />}

      <div role="tablist" aria-label="Centre de contrôle" className="flex flex-wrap gap-1 border-b border-stone-200">
        {ONGLETS.map((o) => (
          <button key={o.cle} role="tab" aria-selected={onglet === o.cle} onClick={() => setOnglet(o.cle)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${onglet === o.cle ? 'border-orange-600 text-orange-700' : 'border-transparent text-stone-500 hover:text-stone-800'}`}>
            {o.libelle}
          </button>
        ))}
      </div>

      {onglet === 'affectations' && (
        <>
          <Panneau
            titre={`Recommandations (${aAffecter.length})`}
            action={peutEcrire && acceptables.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => affecterEnGroupe(selectionnes.map((v) => v.id))} disabled={enCours || selectionnes.length === 0} className="flex items-center gap-2 rounded-xl border border-green-600 bg-white px-4 py-2 text-sm font-bold text-green-700 disabled:opacity-50">
                  <Check className="h-4 w-4" /> Accepter la sélection ({selectionnes.length})
                </button>
                <button onClick={() => affecterEnGroupe(acceptables.map((v) => v.id))} disabled={enCours} className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                  <Check className="h-4 w-4" /> Tout accepter ({acceptables.length})
                </button>
              </div>
            )}
          >
            {voyages === null ? (
              <div className="flex h-24 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" /></div>
            ) : aAffecter.length === 0 ? (
              <SansDonnees message="Aucun voyage à affecter" detail="Tous les voyages du shift ont un camion, ou aucun voyage n'est préparé (onglet Shift et préparation)." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-left text-stone-500">
                      {peutEcrire && <th className="w-8 py-2 pr-2 font-medium"><span className="sr-only">Sélection</span></th>}
                      <th className="py-2 pr-3 font-medium">Voyage</th>
                      <th className="py-2 pr-3 font-medium">Destination</th>
                      <th className="py-2 pr-3 font-medium">Recommandation et raisons</th>
                      {peutEcrire && <th className="py-2 font-medium">Décision</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {aAffecter.map((v) => {
                      const r = recommandations.get(v.id);
                      const suspendu = suspendus.has(v.id);
                      return (
                        <tr key={v.id} className="border-b border-stone-100 align-top last:border-0">
                          {peutEcrire && (
                            <td className="py-2.5 pr-2">
                              {r && !r.impossible && r.camion && r.chauffeur && !suspendu && (
                                <input type="checkbox" aria-label={`Sélectionner ${v.reference}`} checked={selection.has(v.id)}
                                  onChange={(e) => {
                                    const suite = new Set(selection);
                                    if (e.target.checked) suite.add(v.id); else suite.delete(v.id);
                                    setSelection(suite);
                                  }} />
                              )}
                            </td>
                          )}
                          <td className="py-2.5 pr-3 font-semibold text-stone-900">{v.reference}{suspendu && <span className="ml-2"><Puce teinte="rouge">Suspendu</Puce></span>}</td>
                          <td className="py-2.5 pr-3 text-stone-700">{nomSite.get(v.arrival_site_id ?? '') ?? '—'}</td>
                          <td className="py-2.5 pr-3">{ligneRecommandation(r)}</td>
                          {peutEcrire && r && (
                            <td className="whitespace-nowrap py-2.5">
                              {!r.impossible && !suspendu && (
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

          {rapport && (
            <Panneau titre="Rapport de l'affectation groupée" action={<button onClick={() => setRapport(null)} className="text-sm text-stone-500 hover:text-stone-800">Fermer</button>}>
              <p className="mb-2 text-sm text-stone-600">
                {rapport.filter((l) => l.resultat === 'affecte').length} voyage(s) affecté(s), {rapport.filter((l) => l.resultat === 'refuse').length} refusé(s) par le serveur. Un refus n'annule que son voyage.
              </p>
              <ul className="divide-y divide-stone-100 text-sm" aria-label="Rapport par voyage">
                {rapport.map((l, i) => (
                  <li key={`${l.trip_id ?? 'x'}-${i}`} className="flex flex-wrap items-center gap-2 py-2">
                    <span className="font-semibold text-stone-900">{l.reference ?? 'Voyage inconnu'}</span>
                    <Puce teinte={l.resultat === 'affecte' ? 'vert' : 'rouge'}>{l.resultat === 'affecte' ? 'Affecté' : 'Refusé'}</Puce>
                    {l.raison && <span className="text-stone-600">{l.raison}</span>}
                  </li>
                ))}
              </ul>
            </Panneau>
          )}

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
          <Provenance source="voyages du shift, flotte, immobilisations, habilitations et chauffeurs ; recommandation par règles fixes (camion le moins chargé, chauffeur habituel sur 14 jours, file de chargement la plus courte) ; décisions historisées" heure={heure} />
          {site && <SimulationScenarios date={date} site={site} shift={shift} shifts={shifts} nomSite={nomSite} camionsDisponibles={camionsSite.length} />}
        </>
      )}

      {onglet === 'voyages' && (
        <VoyagesParEtat voyages={voyages ?? []} vue={vue} setVue={setVue} suspendus={suspendus} aReaffecter={aReaffecterIds}
          peutEcrire={peutEcrire} libelle={libelleVoyage} onModifie={charger} />
      )}

      {onglet === 'supervision' && pret && (
        <SupervisionDispatch date={date} site={site} shift={shift} actualisation={actualisation}
          camion={(id) => camionParId.get(id ?? '')?.registration ?? '—'} chauffeur={(id) => chauffeurParId.get(id ?? '')?.name ?? '—'} />
      )}

      {onglet === 'shift' && pret && (
        <PanneauShift date={date} site={site} shift={shift} libelle={libelleShift}
          destinations={sites.filter((s) => s.id !== site).map((s) => ({ id: s.id, name: s.name }))}
          peutEcrire={peutEcrire} nonTermines={nonTermines} actualisation={actualisation} onModifie={charger} />
      )}

      {onglet === 'journal' && (
        <Panneau titre="Journal des décisions du shift">
          {decisions.length === 0 && suspensions.length === 0 ? (
            <SansDonnees message="Aucune décision" detail="Les acceptations, modifications, refus, réaffectations, suspensions et reprises apparaîtront ici." />
          ) : (
            <ul className="divide-y divide-stone-100 text-sm" aria-label="Journal du dispatch">
              {[
                ...decisions.map((d) => ({ cle: d.id, quand: d.decide_le, contenu: (
                  <>
                    <span className="font-semibold text-stone-900">{referenceDe.get(d.trip_id) ?? '—'}</span>
                    <Puce teinte={DECISIONS[d.decision]?.teinte ?? 'orange'}>{DECISIONS[d.decision]?.libelle ?? d.decision}</Puce>
                    {d.nature === 'reaffectation' && <span className="text-xs text-stone-500">réaffectation</span>}
                    <span className="text-stone-700">
                      {d.decision === 'refusee'
                        ? `recommandé : ${d.recommandation?.camion ?? '—'}`
                        : `${camionParId.get(d.vehicle_id ?? '')?.registration ?? '—'} · ${chauffeurParId.get(d.driver_id ?? '')?.name ?? '—'}`}
                    </span>
                    {d.motif && <span className="text-stone-500">« {d.motif} »</span>}
                  </>
                ) })),
                ...suspensions.map((s) => ({ cle: `s-${s.rang}`, quand: s.cree_le, contenu: (
                  <>
                    <span className="font-semibold text-stone-900">{referenceDe.get(s.trip_id) ?? '—'}</span>
                    <Puce teinte={s.action === 'suspension' ? 'rouge' : 'bleu'}>{s.action === 'suspension' ? 'Suspension' : 'Reprise'}</Puce>
                    <span className="text-stone-500">« {s.motif} »</span>
                  </>
                ) })),
              ].sort((a, b) => b.quand.localeCompare(a.quand)).map((l) => (
                <li key={l.cle} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className="w-12 text-stone-500">{new Date(l.quand).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                  {l.contenu}
                </li>
              ))}
            </ul>
          )}
        </Panneau>
      )}

      {ouverte && (
        <FenetreDecision
          mode={ouverte.mode}
          reference={ouverte.reference}
          recommandation={ouverte.recommandation}
          raison={ouverte.raison}
          camions={camionsSite}
          chauffeurs={chauffeursDispo}
          engins={enginsSite}
          version={versions.get(ouverte.recommandation.voyageId) ?? 0}
          onFermer={() => setOuverte(null)}
          onDecide={() => { setOuverte(null); charger(); }}
        />
      )}
    </div>
  );
};
