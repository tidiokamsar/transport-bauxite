import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSite } from '../../contexts/SiteContext';
import { PageListe } from '../ui/PageListe';
import { Provenance, Puce } from '../ui/Panneau';
import { routeNouveau, useRoute } from '../ui/routeur';
import type { ColonneListe, FiltreListe } from '../ui/liste';
import type { Vehicle } from '../../types/vehicle';
import {
  COLONNES_VEHICULE, PROPRIETES, STATUTS_OPERATIONNELS, TYPES_VEHICULE, VUE_VEHICULES, libellePropriete, libelleStatut,
  type StatutOperationnel,
} from './flotte';
import { DetailVehicule } from './DetailVehicule';
import { FormulaireVehicule } from './FormulaireVehicule';
import { ActionVehicule } from './ActionVehicule';

// Registre de la flotte (D-062) au standard des pages (D-090) : liste,
// fiche consolidee, creation et modification en pleine page, actions de
// statut et propriete par les fonctions serveur journalisees. Le statut
// operationnel est derive par le serveur (v_vehicules) ; aucune propriete
// n'est supposee.

export const VehiclesView = () => {
  const route = useRoute();
  if (route.vue !== VUE_VEHICULES || route.mode === 'liste') return <ListeVehicules />;
  if (route.mode === 'nouveau') return <FormulaireVehicule />;
  if (route.mode === 'modifier') return <FormulaireVehicule id={route.id} />;
  if (route.mode === 'action' && route.action) return <ActionVehicule id={route.id ?? ''} action={route.action} />;
  return <DetailVehicule id={route.id ?? ''} />;
};

const ListeVehicules = () => {
  const { hasPermission } = useAuth();
  const { siteId, sites } = useSite();
  const [vehicules, setVehicules] = useState<Vehicle[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    let q = supabase.from('v_vehicules').select(COLONNES_VEHICULE).order('registration');
    if (siteId) q = q.eq('site_id', siteId);
    const { data, error } = await q;
    setErreur(error ? `Registre indisponible : ${error.message}` : '');
    setVehicules(error ? null : (data ?? []) as Vehicle[]);
    setHeure(new Date());
  }, [siteId]);
  useEffect(() => { charger(); }, [charger]);

  const nomSite = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites]);
  const colonnes = useMemo<ColonneListe<Vehicle>[]>(() => [
    { id: 'immatriculation', libelle: 'Immatriculation', valeur: (v) => v.registration },
    { id: 'modele', libelle: 'Modèle', valeur: (v) => v.brand_model },
    { id: 'type', libelle: 'Type', valeur: (v) => TYPES_VEHICULE[v.vehicle_type] ?? v.vehicle_type,
      rendu: (v) => `${TYPES_VEHICULE[v.vehicle_type] ?? v.vehicle_type} · ${v.capacity_tonnes} t` },
    { id: 'capacite', libelle: 'Capacité (t)', valeur: (v) => v.capacity_tonnes, alignement: 'droite', masquee: true },
    { id: 'site', libelle: 'Site', valeur: (v) => (v.site_id ? nomSite.get(v.site_id) ?? '' : 'Global') },
    { id: 'propriete', libelle: 'Propriété', valeur: (v) => libellePropriete(v.propriete),
      rendu: (v) => (v.propriete === null ? <Puce teinte="gris">Non renseignée</Puce> : <>{libellePropriete(v.propriete)}
        {v.proprietaire && <span className="block text-xs text-stone-500">{v.proprietaire}{v.contrat_reference ? ` · ${v.contrat_reference}` : ''}</span>}</>) },
    { id: 'contrat', libelle: 'Contrat', valeur: (v) => v.contrat_reference, masquee: true },
    { id: 'statut', libelle: 'Statut', valeur: (v) => libelleStatut(v.statut_operationnel).libelle,
      rendu: (v) => { const s = libelleStatut(v.statut_operationnel); return <span title={v.statut_admin_motif ?? v.voyage_en_cours ?? undefined}><Puce teinte={s.teinte}>{s.libelle}</Puce></span>; } },
    { id: 'motif', libelle: 'Motif du statut', valeur: (v) => v.statut_admin_motif, masquee: true },
  ], [nomSite]);

  const filtres = useMemo<FiltreListe<Vehicle>[]>(() => [
    { id: 'statut', libelle: 'Statut', options: Object.entries(STATUTS_OPERATIONNELS).map(([k, v]) => ({ valeur: k, libelle: v.libelle })),
      correspond: (v, s) => v.statut_operationnel === s },
    { id: 'propriete', libelle: 'Propriété', options: [...Object.entries(PROPRIETES).map(([k, v]) => ({ valeur: k, libelle: v })), { valeur: 'non_renseignee', libelle: 'Non renseignée' }],
      correspond: (v, p) => (p === 'non_renseignee' ? v.propriete === null : v.propriete === p) },
    { id: 'type', libelle: 'Type', options: Object.entries(TYPES_VEHICULE).map(([k, v]) => ({ valeur: k, libelle: v })), correspond: (v, t) => v.vehicle_type === t },
  ], []);

  const compte = (s: StatutOperationnel) => (vehicules ?? []).filter((v) => v.statut_operationnel === s).length;
  const synthese = (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Synthèse de la flotte">
      {([
        ['Disponibles', compte('disponible')],
        ['En mission', compte('en_mission')],
        ['Immobilisés ou en maintenance', compte('immobilise') + compte('en_maintenance')],
        ['Suspendus', compte('suspendu')],
        ['Propriété non renseignée', (vehicules ?? []).filter((v) => v.propriete === null && v.statut_operationnel !== 'reforme').length],
      ] as [string, number][]).map(([l, n]) => (
        <div key={l} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-carte"><p className="text-sm text-stone-500">{l}</p><p className="text-2xl font-black text-stone-900">{vehicules ? n : '—'}</p></div>
      ))}
    </section>
  );

  return (
    <PageListe
      vue={VUE_VEHICULES}
      titre="Véhicules et engins"
      sousTitre="Registre de la flotte : propriété, contrat, statut opérationnel et fiche détaillée"
      lignes={vehicules}
      erreur={erreur}
      colonnes={colonnes}
      filtres={filtres}
      placeholderRecherche="Immatriculation ou modèle"
      recherche={(v, t) => { const s = t.trim().toLowerCase(); return v.registration.toLowerCase().includes(s) || v.brand_model.toLowerCase().includes(s); }}
      cle={(v) => v.id}
      libelleOuverture={(v) => `Fiche ${v.registration}`}
      actions={(hasPermission('vehicles', 'create')) && (
        <a href={routeNouveau(VUE_VEHICULES)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow">
          <Plus className="h-4 w-4" /> Nouvel engin
        </a>
      )}
      synthese={synthese}
      nomExport="vehicules"
      vide={{ message: 'Aucun engin', detail: 'Créez le premier engin du registre.' }}
      onActualiser={charger}
      provenance={<Provenance source="registre des engins (v_vehicules) ; statut dérivé des immobilisations, des voyages engagés et des décisions de suspension ou de réforme" heure={heure} />}
    />
  );
};
