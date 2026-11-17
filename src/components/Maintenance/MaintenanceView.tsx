import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatNombre } from '../Dashboard/indicateurs';
import { PageListe } from '../ui/PageListe';
import { Provenance, Puce } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import { routeNouveau, useRoute } from '../ui/routeur';
import type { ColonneListe, FiltreListe } from '../ui/liste';
import {
  COLONNES_ORDRE, PRIORITES_ORDRE, STATUTS_ORDRE, TEINTE_STATUT_ORDRE, TYPES_ORDRE, VUE_ORDRES, type Ordre,
} from './ordres';
import { FormulaireOrdre } from './FormulaireOrdre';
import { DetailOrdre } from './DetailOrdre';
import { ActionOrdreVue } from './ActionOrdre';

// Ordres de travail (D-061) au standard des pages (D-090). Numero attribue
// par le serveur ; une erreur ne se supprime pas : l'ordre s'annule avec un
// motif (annuler_ordre_travail). Les pieces sortent du registre des stocks
// (D-044) par mouvement_stock, rattachees a l'ordre, depuis sa fiche.

export const MaintenanceView = () => {
  const route = useRoute();
  if (route.vue !== VUE_ORDRES || route.mode === 'liste') return <ListeOrdres />;
  if (route.mode === 'nouveau') return <FormulaireOrdre />;
  if (route.mode === 'modifier') return <ModifierOrdre id={route.id ?? ''} />;
  if (route.mode === 'action' && route.action) return <ActionOrdreVue id={route.id ?? ''} action={route.action} requete={route.requete} />;
  return <DetailOrdre id={route.id ?? ''} />;
};

const ModifierOrdre = ({ id }: { id: string }) => {
  const [ordre, setOrdre] = useState<Ordre | null>(null);
  const [erreur, setErreur] = useState('');
  useEffect(() => {
    lire<Ordre>(supabase.from('maintenance_orders').select(COLONNES_ORDRE).eq('id', id), 'ordre de travail').then((r) => {
      const o = trouver(r.lignes, id);
      setOrdre(o);
      setErreur(r.erreur || (o ? '' : 'Ordre introuvable ou hors de votre périmètre.'));
    });
  }, [id]);
  return ordre ? <FormulaireOrdre key={ordre.id} ordre={ordre} /> : <FormulaireOrdre chargement={!erreur} erreurChargement={erreur} />;
};

const jour = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR') : null);

const ListeOrdres = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('maintenance', 'create') || hasPermission('maintenance', 'edit');
  const [ordres, setOrdres] = useState<Ordre[] | null>(null);
  const [engins, setEngins] = useState<Map<string, string>>(new Map());
  const [sites, setSites] = useState<Map<string, string>>(new Map());
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const [o, e, s] = await Promise.all([
      supabase.from('maintenance_orders').select(COLONNES_ORDRE).order('request_date', { ascending: false }).limit(500),
      supabase.from('vehicles').select('id, registration').order('registration'),
      supabase.from('sites').select('id, name').order('name'),
    ]);
    setErreur(o.error ? `Ordres de travail indisponibles : ${o.error.message}` : e.error ? `Engins indisponibles : ${e.error.message}` : '');
    setOrdres(o.error ? null : ((o.data ?? []) as Ordre[]));
    setEngins(new Map(((e.data ?? []) as { id: string; registration: string }[]).map((x) => [x.id, x.registration])));
    setSites(new Map(((s.data ?? []) as { id: string; name: string }[]).map((x) => [x.id, x.name])));
    setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const colonnes = useMemo<ColonneListe<Ordre>[]>(() => [
    { id: 'numero', libelle: 'N°', valeur: (o) => o.work_order_number, rendu: (o) => <span className="font-mono text-xs">{o.work_order_number ?? 'Non attribué'}</span> },
    { id: 'titre', libelle: 'Intitulé', valeur: (o) => o.title ?? o.description,
      rendu: (o) => <>{o.title ?? o.description}{o.status === 'cancelled' && o.motif_annulation && <span className="block text-xs text-stone-500">Annulé : {o.motif_annulation}</span>}</> },
    { id: 'engin', libelle: 'Engin', valeur: (o) => (o.vehicle_id ? engins.get(o.vehicle_id) ?? null : null) },
    { id: 'site', libelle: 'Site', valeur: (o) => (o.site_id ? sites.get(o.site_id) ?? null : null), masquee: true },
    { id: 'type', libelle: 'Type', valeur: (o) => TYPES_ORDRE[o.maintenance_type] ?? o.maintenance_type },
    { id: 'priorite', libelle: 'Priorité', valeur: (o) => (o.priority ? PRIORITES_ORDRE[o.priority] ?? o.priority : null), masquee: true },
    { id: 'statut', libelle: 'Statut', valeur: (o) => STATUTS_ORDRE[o.status] ?? o.status,
      rendu: (o) => <Puce teinte={TEINTE_STATUT_ORDRE[o.status] ?? 'gris'}>{STATUTS_ORDRE[o.status] ?? o.status}</Puce> },
    { id: 'demande', libelle: 'Demandé', valeur: (o) => o.request_date, rendu: (o) => jour(o.request_date), masquee: true },
    { id: 'prevue', libelle: 'Prévue', valeur: (o) => o.scheduled_date, rendu: (o) => jour(o.scheduled_date) },
    { id: 'termine', libelle: 'Terminé', valeur: (o) => o.completion_date, rendu: (o) => jour(o.completion_date), masquee: true },
    { id: 'estime', libelle: 'Coût estimé', valeur: (o) => o.estimated_cost, rendu: (o) => (o.estimated_cost !== null ? formatNombre(Number(o.estimated_cost), 0) : null), alignement: 'droite', masquee: true },
    { id: 'reel', libelle: 'Coût réel', valeur: (o) => o.actual_cost, rendu: (o) => (o.actual_cost !== null ? formatNombre(Number(o.actual_cost), 0) : null), alignement: 'droite' },
  ], [engins, sites]);

  const filtres = useMemo<FiltreListe<Ordre>[]>(() => [
    { id: 'statut', libelle: 'Statut', options: Object.entries(STATUTS_ORDRE).map(([valeur, libelle]) => ({ valeur, libelle })), correspond: (o, v) => o.status === v },
    { id: 'type', libelle: 'Type', options: Object.entries(TYPES_ORDRE).map(([valeur, libelle]) => ({ valeur, libelle })), correspond: (o, v) => o.maintenance_type === v },
    { id: 'priorite', libelle: 'Priorité', options: Object.entries(PRIORITES_ORDRE).map(([valeur, libelle]) => ({ valeur, libelle })), correspond: (o, v) => o.priority === v },
  ], []);

  const compte = (s: string) => (ordres ?? []).filter((o) => o.status === s).length;

  return (
    <PageListe
      vue={VUE_ORDRES}
      titre="Ordres de travail"
      sousTitre="Numéro attribué par le serveur ; un ordre s'annule avec un motif, il ne se supprime pas. Les pièces sortent du registre des stocks depuis la fiche de l'ordre."
      lignes={ordres}
      erreur={erreur}
      colonnes={colonnes}
      filtres={filtres}
      placeholderRecherche="Rechercher (numéro, intitulé, engin)"
      cle={(o) => o.id}
      libelleOuverture={(o) => `Fiche ${o.work_order_number ?? o.title ?? 'ordre'}`}
      actions={peutEcrire && (
        <a href={routeNouveau(VUE_ORDRES)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow">
          <Plus className="h-4 w-4" /> Nouvel ordre de travail
        </a>
      )}
      synthese={(
        <div className="space-y-3">
          <p className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">Les engins loués relèvent de Neemba (D-022, D-025) : leurs pannes se suivent dans Immobilisations et Interventions Neemba.</p>
          <div className="grid gap-3 sm:grid-cols-4">
            {([['Ouverts', 'open'], ['En cours', 'in_progress'], ['Terminés', 'completed'], ['Annulés', 'cancelled']] as const).map(([l, s]) => (
              <div key={s} className="rounded-2xl border border-stone-200 bg-white p-4"><p className="text-xs text-stone-500">{l}</p><p className="text-2xl font-black">{ordres === null ? '—' : compte(s)}</p></div>
            ))}
          </div>
        </div>
      )}
      nomExport="ordres-de-travail"
      vide={{ message: 'Aucun ordre de travail', detail: 'Créez un ordre pour un engin entretenu par KOGON.' }}
      onActualiser={charger}
      provenance={<Provenance source="maintenance_orders (500 derniers ordres par date de demande)" heure={heure} />}
    />
  );
};
