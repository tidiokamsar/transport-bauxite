import { useCallback, useEffect, useMemo, useState } from 'react';
import { Info, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatNombre } from '../Dashboard/indicateurs';
import { PageListe } from '../ui/PageListe';
import { Provenance, Puce } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import { routeNouveau, useRoute } from '../ui/routeur';
import type { ColonneListe, FiltreListe } from '../ui/liste';
import { COLONNES_PLANNING, VUE_PREVENTIF, dernierReleveParEngin, echeancePlanning, type Echeance, type Planning, type Releve } from './preventif';
import { chargerLocationsEngins, type LocationEngin } from './locationsEngins';
import { FormulairePlanning } from './FormulairePlanning';
import { DetailPlanPreventif } from './DetailPlanPreventif';
import { ActionPlanPreventif } from './ActionPlanPreventif';

// Maintenance preventive interne (D-061) au standard des pages (D-090). Les
// engins loues relevent de Neemba (D-022, D-025) : leur maintenance se suit
// en Immobilisations et Interventions Neemba. Aucune valeur par defaut (cout,
// intervalle, date) n'est proposee ; l'echeance n'est calculee que depuis des
// donnees connues.

export const PreventiveMaintenanceView = () => {
  const route = useRoute();
  if (route.vue !== VUE_PREVENTIF || route.mode === 'liste') return <ListePlannings />;
  if (route.mode === 'nouveau') return <FormulairePlanning />;
  if (route.mode === 'modifier') return <ModifierPlanning id={route.id ?? ''} />;
  if (route.mode === 'action' && route.action) return <ActionPlanPreventif id={route.id ?? ''} action={route.action} />;
  return <DetailPlanPreventif id={route.id ?? ''} />;
};

const ModifierPlanning = ({ id }: { id: string }) => {
  const [planning, setPlanning] = useState<Planning | null>(null);
  const [erreur, setErreur] = useState('');
  useEffect(() => {
    lire<Planning>(supabase.from('maintenance_schedules').select(COLONNES_PLANNING).eq('id', id), 'planning préventif').then((r) => {
      const p = trouver(r.lignes, id);
      setPlanning(p);
      setErreur(r.erreur || (p ? '' : 'Planning introuvable ou non visible avec vos droits.'));
    });
  }, [id]);
  return planning ? <FormulairePlanning key={planning.id} planning={planning} /> : <FormulairePlanning chargement={!erreur} erreurChargement={erreur} />;
};

interface Ligne { p: Planning; e: Echeance; engin: string | null; location: LocationEngin | null; releve: Releve | null }

const RANG_ECHEANCE = { depassee: 0, a_venir: 1, inconnue: 2 } as const;
const LIBELLE_ECHEANCE = { depassee: 'Dépassée', a_venir: 'À venir', inconnue: 'Inconnue' } as const;
const km = (v: number | null) => (v !== null && v !== undefined ? `${formatNombre(Number(v), 0)} km` : null);
const jour = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR') : null);

const PuceEcheance = ({ e }: { e: Echeance }) => (e.statut === 'depassee' ? <Puce teinte="rouge">Dépassée</Puce>
  : e.statut === 'a_venir' ? <Puce teinte="bleu">À venir</Puce> : <Puce teinte="gris">Inconnue</Puce>);

const ListePlannings = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('maintenance', 'create') || hasPermission('maintenance', 'edit');
  const [plannings, setPlannings] = useState<Planning[] | null>(null);
  const [engins, setEngins] = useState<Map<string, string>>(new Map());
  const [releves, setReleves] = useState<Map<string, Releve>>(new Map());
  const [locations, setLocations] = useState<Map<string, LocationEngin>>(new Map());
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const [p, e, r, loc] = await Promise.all([
      supabase.from('maintenance_schedules').select(COLONNES_PLANNING).order('title'),
      supabase.from('vehicles').select('id, registration').order('registration'),
      supabase.from('v_releves_compteur').select('vehicle_id, valeur_km, releve_le').order('releve_le', { ascending: false }).limit(2000),
      chargerLocationsEngins(),
    ]);
    setErreur(p.error ? `Plannings indisponibles : ${p.error.message}` : e.error ? `Engins indisponibles : ${e.error.message}` : '');
    setPlannings(p.error ? null : ((p.data ?? []) as Planning[]));
    setEngins(new Map(((e.data ?? []) as { id: string; registration: string }[]).map((x) => [x.id, x.registration])));
    setReleves(dernierReleveParEngin(r.error ? [] : (r.data ?? []) as (Releve & { vehicle_id: string })[]));
    setLocations(loc);
    setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const lignes = useMemo<Ligne[] | null>(() => {
    if (!plannings) return null;
    const aujourdhui = new Date();
    return plannings.map((p) => {
      const releve = p.vehicle_id ? releves.get(p.vehicle_id) ?? null : null;
      return { p, e: echeancePlanning(p, releve, aujourdhui), engin: p.vehicle_id ? engins.get(p.vehicle_id) ?? null : null, location: p.vehicle_id ? locations.get(p.vehicle_id) ?? null : null, releve };
    }).sort((a, b) => RANG_ECHEANCE[a.e.statut] - RANG_ECHEANCE[b.e.statut]);
  }, [plannings, releves, engins, locations]);

  const colonnes = useMemo<ColonneListe<Ligne>[]>(() => [
    { id: 'engin', libelle: 'Engin', valeur: (l) => l.engin,
      rendu: (l) => <><span className="font-semibold">{l.engin ?? 'Non renseigné'}</span>{l.location && <span className="ml-1"><Puce teinte="orange">Au contrat de location {l.location.reference}</Puce></span>}</> },
    { id: 'planning', libelle: 'Planning', valeur: (l) => l.p.title, rendu: (l) => <>{l.p.title}<span className="block text-xs text-stone-500">{l.p.maintenance_type}</span></> },
    { id: 'intervalle', libelle: 'Intervalle', valeur: (l) => [km(l.p.interval_km), l.p.interval_days ? `${l.p.interval_days} j` : null].filter(Boolean).join(' ou ') || null },
    { id: 'derniere', libelle: 'Dernière intervention', valeur: (l) => [km(l.p.last_maintenance_km), jour(l.p.last_maintenance_date)].filter(Boolean).join(' · ') || 'Non saisie' },
    { id: 'echeance', libelle: 'Échéance', valeur: (l) => LIBELLE_ECHEANCE[l.e.statut],
      rendu: (l) => <><PuceEcheance e={l.e} /><span className="block text-xs text-stone-500">{[km(l.p.next_service_km), jour(l.p.next_service_date)].filter(Boolean).join(' ou ')}</span></> },
    { id: 'reste', libelle: 'Reste', exportable: false, valeur: (l) => l.e.kmRestants ?? l.e.joursRestants,
      rendu: (l) => (
        <span className="text-xs">
          {l.e.kmRestants !== null && <span className="block">{formatNombre(l.e.kmRestants, 0)} km (relevé du {l.releve ? new Date(l.releve.releve_le).toLocaleDateString('fr-FR') : '?'})</span>}
          {l.e.joursRestants !== null && <span className="block">{l.e.joursRestants} j</span>}
          {l.e.kmRestants === null && l.p.next_service_km !== null && <span className="block text-stone-400">km : sans relevé compteur</span>}
          {l.e.kmRestants === null && l.e.joursRestants === null && 'Sans données'}
        </span>
      ) },
    { id: 'etat', libelle: 'État', valeur: (l) => (l.p.is_active === false ? 'Désactivé' : 'Actif'),
      rendu: (l) => <Puce teinte={l.p.is_active === false ? 'gris' : 'vert'}>{l.p.is_active === false ? 'Désactivé' : 'Actif'}</Puce> },
  ], []);

  const filtres = useMemo<FiltreListe<Ligne>[]>(() => [
    { id: 'etat', libelle: 'État', options: [{ valeur: 'actif', libelle: 'Actifs' }, { valeur: 'desactive', libelle: 'Désactivés' }],
      correspond: (l, v) => (v === 'actif' ? l.p.is_active !== false : l.p.is_active === false) },
    { id: 'echeance', libelle: 'Échéance', options: [{ valeur: 'depassee', libelle: 'Échéances dépassées' }, { valeur: 'a_venir', libelle: 'Échéances à venir' }, { valeur: 'inconnue', libelle: 'Échéances inconnues' }],
      correspond: (l, v) => l.e.statut === v },
  ], []);

  return (
    <PageListe
      vue={VUE_PREVENTIF}
      titre="Maintenance préventive"
      sousTitre="Plannings internes par intervalle de kilomètres ou de jours ; échéance calculée depuis la dernière intervention et le dernier relevé compteur."
      lignes={lignes}
      erreur={erreur}
      colonnes={colonnes}
      filtres={filtres}
      placeholderRecherche="Rechercher (engin, planning)"
      cle={(l) => l.p.id}
      libelleOuverture={(l) => `Fiche ${l.p.title}`}
      actions={peutEcrire && (
        <a href={routeNouveau(VUE_PREVENTIF)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow">
          <Plus className="h-4 w-4" /> Nouveau planning
        </a>
      )}
      synthese={(
        <p role="note" className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>Les engins loués à Neemba sont entretenus par le loueur (D-022, D-025) : leur maintenance se suit dans Immobilisations et Interventions Neemba.
            Ce planning ne concerne que les engins entretenus par KOGON. SIGTB ne connaît pas la propriété des engins : un engin est signalé « au contrat de location » seulement si le dossier contractuel le rattache à un tarif de location.</span>
        </p>
      )}
      nomExport="plannings-preventifs"
      vide={{ message: 'Aucun planning préventif', detail: 'Créez un planning pour un engin entretenu par KOGON.' }}
      onActualiser={charger}
      provenance={<Provenance source="maintenance_schedules ; relevés compteur (v_releves_compteur) ; tarifs des contrats de location" heure={heure} />}
    />
  );
};
