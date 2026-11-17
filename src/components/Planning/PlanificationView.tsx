import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Target } from 'lucide-react';
import { ecrireRoute, naviguer, routeAction, routeDetail, routeModifier, useRoute } from '../ui/routeur';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSite } from '../../contexts/SiteContext';
import { Panneau, Provenance, ReferentielVide, SansDonnees } from '../ui/Panneau';
import { SANS_SITE } from '../ui/referentiels';
import { formatNombre } from '../Dashboard/indicateurs';
import { fenetreJournee, fenetreShift, suivre, totalJournee, type ShiftHoraire, type StatistiquesRotation } from './plan';
import { CarteObjectif, type Realisation } from './CarteObjectif';
import { BlocVentilation, FormulaireVentilation, type Ventilation } from './VentilationObjectif';
import { SimulationObjectifs } from './SimulationObjectifs';
import { ClotureProduction } from './ClotureProduction';
import { ComparaisonShifts } from './ComparaisonShifts';
import { PREFIXE_CLOTURE, VUE_PLANIFICATION, requeteScenario } from './objectifs';
import { ActionCloture, ActionObjectif, DetailCloture, DetailObjectif, FormulaireObjectif, RegistreObjectifs } from './PagesObjectif';

// Planification v1 (etape 3 de la reprise, CDC 6, D-023) : objectifs de
// production par date, site de chargement et shift, compares aux voyages
// livres. Le systeme projette et estime ; l'exploitant fixe et revise.
// Planification avancee (D-063) : ventilation par destination et contrat,
// simulation et rattrapage, cloture et rapport, comparaison des shifts.

type Onglet = 'objectifs' | 'registre' | 'simulation' | 'cloture' | 'shifts';
const ONGLETS: { id: Onglet; libelle: string }[] = [
  { id: 'objectifs', libelle: 'Objectifs du jour' },
  { id: 'registre', libelle: 'Registre des objectifs' },
  { id: 'simulation', libelle: 'Simulation et rattrapage' },
  { id: 'cloture', libelle: 'Clôture et rapport' },
  { id: 'shifts', libelle: 'Comparaison des shifts' },
];

const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface Engin { id: string; vehicle_type: string; status: string; site_id: string | null }

// Pages de la planification (D-090) : le tableau du jour reste la page
// d'accueil du module ; objectif et cloture ont leur fiche, leur saisie et
// leurs actions en pleine page. Date et volet sont conserves pendant la
// session (retour depuis une fiche).
const memoire: { date: string | null; onglet: Onglet } = { date: null, onglet: 'objectifs' };

export const PlanificationView = () => {
  const route = useRoute();
  if (route.vue !== VUE_PLANIFICATION || route.mode === 'liste') return <TableauPlanification />;
  if (route.mode === 'nouveau') return <FormulaireObjectif requete={route.requete} />;
  const id = route.id ?? '';
  if (id.startsWith(PREFIXE_CLOTURE)) {
    const cloture = id.slice(PREFIXE_CLOTURE.length);
    return route.mode === 'action' ? <ActionCloture id={cloture} action={route.action ?? ''} /> : <DetailCloture id={cloture} />;
  }
  if (route.mode === 'modifier') return <FormulaireObjectif id={id} requete={route.requete} />;
  if (route.mode === 'action' && route.action === 'ventiler') return <FormulaireVentilation id={id} />;
  if (route.mode === 'action' && route.action) return <ActionObjectif id={id} action={route.action} />;
  return <DetailObjectif id={id} />;
};

const TableauPlanification = () => {
  const { hasPermission } = useAuth();
  const { siteId, sites, aucunSite } = useSite();
  const peutEcrire = hasPermission('planning', 'create') || hasPermission('planning', 'edit');
  const [date, setDateEtat] = useState(() => memoire.date ?? aujourdhui());
  const setDate = (d: string) => { memoire.date = d; setDateEtat(d); };
  const [objectifs, setObjectifs] = useState<Realisation[] | null>(null);
  const [shifts, setShifts] = useState<ShiftHoraire[]>([]);
  const [engins, setEngins] = useState<Engin[]>([]);
  const [stats, setStats] = useState<Record<string, StatistiquesRotation | null>>({});
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);
  const [maintenant, setMaintenant] = useState(() => new Date());
  const [onglet, setOngletEtat] = useState<Onglet>(memoire.onglet);
  const setOnglet = (o: Onglet) => { memoire.onglet = o; setOngletEtat(o); };
  const [ventilations, setVentilations] = useState<Ventilation[]>([]);
  const [erreurVentilations, setErreurVentilations] = useState('');

  useEffect(() => {
    Promise.all([
      supabase.from('work_shifts').select('id, display_name, start_time, end_time').eq('is_active', true).order('shift_order'),
      supabase.from('vehicles').select('id, vehicle_type, status, site_id'),
    ]).then(([s, v]) => {
      setShifts((s.data ?? []) as ShiftHoraire[]);
      setEngins((v.data ?? []) as Engin[]);
    });
  }, []);

  const charger = useCallback(async () => {
    let requete = supabase.from('v_realisation_objectifs').select('*').eq('date_plan', date);
    if (siteId) requete = requete.eq('site_id', siteId);
    let requeteV = supabase.from('v_realisation_ventilation').select('*').eq('date_plan', date);
    if (siteId) requeteV = requeteV.eq('site_id', siteId);
    const [{ data, error }, v] = await Promise.all([requete, requeteV]);
    if (v.error) {
      setErreurVentilations('Ventilations indisponibles : ' + v.error.message);
      setVentilations([]);
    } else {
      setErreurVentilations('');
      setVentilations((v.data ?? []) as Ventilation[]);
    }
    if (error) {
      setErreur('Objectifs indisponibles : ' + error.message);
      setObjectifs([]);
    } else {
      setErreur('');
      setObjectifs((data ?? []) as Realisation[]);
    }
    setHeure(new Date());
    setMaintenant(new Date());
  }, [date, siteId]);

  useEffect(() => {
    charger();
    const minuterie = window.setInterval(charger, 60_000);
    return () => window.clearInterval(minuterie);
  }, [charger]);

  // Statistiques de rotation (14 jours precedant la date) par objectif.
  useEffect(() => {
    if (!objectifs) return;
    let actif = true;
    setStats({});
    Promise.all(objectifs.map(async (o) => {
      const { data, error } = await supabase.rpc('statistiques_rotation', { p_site_id: o.site_id, p_shift_id: o.shift_id, p_jusqua: o.date_plan });
      const ligne = !error && Array.isArray(data) ? (data[0] as StatistiquesRotation | undefined) ?? null : null;
      return [o.id, ligne] as const;
    })).then((paires) => {
      if (actif) setStats(Object.fromEntries(paires));
    });
    return () => { actif = false; };
  }, [objectifs]);

  const nomSite = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites]);
  const shiftParId = useMemo(() => new Map(shifts.map((s) => [s.id, s])), [shifts]);

  const libelleObjectif = (o: Realisation) => {
    const shift = o.shift_id ? shiftParId.get(o.shift_id) : null;
    return `${nomSite.get(o.site_id) ?? 'Site inconnu'} · ${o.shift_id ? `Shift ${shift?.display_name ?? '?'}` : 'Journée'}`;
  };

  const fenetreDe = (o: Realisation) => {
    const shift = o.shift_id ? shiftParId.get(o.shift_id) : null;
    return shift ? fenetreShift(o.date_plan, shift) : fenetreJournee(o.date_plan, shifts);
  };

  const horaire = (o: Realisation) => {
    const f = fenetreDe(o);
    const h = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const lendemain = f.fin.getDate() !== f.debut.getDate() ? ' (lendemain)' : '';
    return `${h(f.debut)} – ${h(f.fin)}${lendemain}${o.shift_id ? '' : ' · tous les shifts'}`;
  };

  const disponibles = (site: string) => {
    const duSite = engins.filter((e) => e.site_id === site);
    const camions = duSite.filter((e) => ['tipper', 'flatbed', 'tanker'].includes(e.vehicle_type));
    return {
      camions: camions.filter((e) => e.status === 'active').length,
      indisponibles: camions.filter((e) => e.status === 'maintenance' || e.status === 'immobilized').length,
      chargeuses: duSite.filter((e) => ['loader', 'excavator'].includes(e.vehicle_type) && e.status === 'active').length,
    };
  };

  const tries = useMemo(() => [...(objectifs ?? [])].sort((a, b) => {
    const s = (nomSite.get(a.site_id) ?? '').localeCompare(nomSite.get(b.site_id) ?? '');
    if (s !== 0) return s;
    const ordre = (o: Realisation) => (o.shift_id ? shifts.findIndex((x) => x.id === o.shift_id) + 1 : 0);
    return ordre(a) - ordre(b);
  }), [objectifs, nomSite, shifts]);

  const total = totalJournee(objectifs ?? []);
  const suiviTotal = total ? suivre(total.cible, total.realise, fenetreJournee(date, shifts), maintenant) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900">Planification</h2>
          <p className="text-stone-500">Objectifs de production par site et par shift, comparés aux voyages livrés</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm"
            aria-label="Date du plan"
          />
          {peutEcrire && (aucunSite ? (
            <button type="button" disabled className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow disabled:opacity-50">
              <Plus className="h-4 w-4" /> Définir un objectif
            </button>
          ) : (
            <a href={ecrireRoute({ vue: VUE_PLANIFICATION, mode: 'nouveau', requete: { date, ...(siteId ? { site: siteId } : {}) } })} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow">
              <Plus className="h-4 w-4" /> Définir un objectif
            </a>
          ))}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Synthèse de la journée">
        {[
          { libelle: 'Objectif de la journée', valeur: total ? `${formatNombre(total.cible)} t` : 'Non défini' },
          { libelle: 'Livré', valeur: total ? `${formatNombre(total.realise)} t` : '—' },
          { libelle: 'Réalisation du plan', valeur: suiviTotal ? `${Math.round(suiviTotal.pourcentage)} %` : '—' },
          {
            libelle: 'Prévision de fin de journée',
            valeur: suiviTotal?.prevision != null ? `${formatNombre(suiviTotal.prevision)} t` : '—',
          },
        ].map((k) => (
          <div key={k.libelle} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-carte">
            <p className="flex items-center gap-1.5 text-sm text-stone-500"><Target className="h-4 w-4 text-orange-600" />{k.libelle}</p>
            <p className="mt-1 text-2xl font-black text-stone-900">{k.valeur}</p>
          </div>
        ))}
      </section>

      <nav className="flex flex-wrap gap-1 border-b border-stone-200" role="tablist" aria-label="Volets de la planification">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            role="tab"
            aria-selected={onglet === o.id}
            onClick={() => setOnglet(o.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${onglet === o.id ? 'border-orange-600 text-orange-700' : 'border-transparent text-stone-500 hover:text-stone-800'}`}
          >
            {o.libelle}
          </button>
        ))}
      </nav>

      {aucunSite && <ReferentielVide>{SANS_SITE} Un objectif de production se définit par date, site de chargement et shift.</ReferentielVide>}
      {erreur && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}

      {onglet === 'simulation' && (
        <SimulationObjectifs
          date={date}
          objectifs={tries}
          libelle={libelleObjectif}
          peutEcrire={peutEcrire}
          onRetenir={(o, s) => naviguer(ecrireRoute({ vue: VUE_PLANIFICATION, mode: 'modifier', id: o.id, requete: requeteScenario(s) }))}
        />
      )}
      {onglet === 'registre' && <RegistreObjectifs nomSite={(id) => nomSite.get(id) ?? 'Site inconnu'} nomShift={(id) => (id ? shiftParId.get(id)?.display_name ?? 'Shift inconnu' : 'Journée')} />}
      {onglet === 'cloture' && <ClotureProduction date={date} siteId={siteId} sites={sites} peutEcrire={peutEcrire} />}
      {onglet === 'shifts' && (
        <ComparaisonShifts
          date={date}
          siteId={siteId}
          nomSite={(id) => nomSite.get(id) ?? 'Site inconnu'}
          nomShift={(id) => (id ? shiftParId.get(id)?.display_name ?? 'Shift inconnu' : 'Sans shift')}
        />
      )}

      {onglet === 'objectifs' && (<>
      {objectifs === null ? (
        <div className="flex h-32 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" /></div>
      ) : tries.length === 0 ? (
        <Panneau>
          <SansDonnees
            message="Aucun objectif"
            detail={peutEcrire
              ? 'Aucun objectif de production pour cette date et ce périmètre. Définissez-en un pour suivre la réalisation.'
              : 'Aucun objectif de production pour cette date et ce périmètre.'}
          />
        </Panneau>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {tries.map((o) => (
            <CarteObjectif
              key={o.id}
              objectif={o}
              titre={libelleObjectif(o)}
              horaire={horaire(o)}
              suivi={suivre(Number(o.tonnes_cible), Number(o.tonnes_livrees), fenetreDe(o), maintenant)}
              stats={o.id in stats ? stats[o.id] : undefined}
              disponibles={disponibles(o.site_id)}
              peutEcrire={peutEcrire}
              liens={{ fiche: routeDetail(VUE_PLANIFICATION, o.id), historique: routeDetail(VUE_PLANIFICATION, o.id, 'historique'), reviser: routeModifier(VUE_PLANIFICATION, o.id), annuler: routeAction(VUE_PLANIFICATION, o.id, 'annuler') }}
              ventilation={
                <BlocVentilation
                  lignes={ventilations.filter((v) => v.objectif_id === o.id)}
                  erreur={erreurVentilations}
                  nomSite={(id) => nomSite.get(id) ?? 'Site inconnu'}
                  tonnesObjectif={Number(o.tonnes_cible)}
                  peutVentiler={peutEcrire}
                  lienVentiler={routeAction(VUE_PLANIFICATION, o.id, 'ventiler')}
                />
              }
            />
          ))}
        </div>
      )}
      <Provenance
        source="objectifs de production ; réalisation = voyages livrés (livré, accepté, clôturé, en litige) partis du site, tonnage accepté sinon reçu sinon chargé ; prévision au rythme constaté ; ressources : 14 jours précédents"
        heure={heure}
      />
      </>)}

    </div>
  );
};
