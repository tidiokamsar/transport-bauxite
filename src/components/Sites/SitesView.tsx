import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PageListe } from '../ui/PageListe';
import { Provenance, Puce } from '../ui/Panneau';
import { routeNouveau, useRoute } from '../ui/routeur';
import type { ColonneListe, FiltreListe } from '../ui/liste';
import { COLONNES_SITE, VUE_SITES, libelleTypeSite, siteCorrespond, type SiteSaisi } from './saisieSite';
import { DetailSite } from './DetailSite';
import { FormulaireSite } from './FormulaireSite';
import { ActionSite } from './ActionSite';

// Referentiel des sites (D-079) au standard des pages (D-090) : liste,
// fiche, creation et modification en pleine page, desactivation et
// reactivation. Ecriture sur la table sous RLS (droit settings), comme avant.



export const SitesView = () => {
  const route = useRoute();
  if (route.vue !== VUE_SITES || route.mode === 'liste') return <ListeSites />;
  if (route.mode === 'nouveau') return <FormulaireSite />;
  if (route.mode === 'modifier') return <FormulaireSite id={route.id} />;
  if (route.mode === 'action' && route.action) return <ActionSite id={route.id ?? ''} action={route.action} />;
  return <DetailSite id={route.id ?? ''} />;
};

const ListeSites = () => {
  const { hasPermission } = useAuth();
  const [sites, setSites] = useState<SiteSaisi[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const { data, error } = await supabase.from('sites').select(COLONNES_SITE).order('name');
    setErreur(error ? `Sites indisponibles : ${error.message}` : '');
    setSites(error ? null : (data as SiteSaisi[] | null) ?? []);
    setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const colonnes = useMemo<ColonneListe<SiteSaisi>[]>(() => [
    { id: 'nom', libelle: 'Site', valeur: (s) => s.name },
    { id: 'type', libelle: 'Type', valeur: (s) => libelleTypeSite(s.type) },
    { id: 'ville', libelle: 'Ville', valeur: (s) => s.city },
    { id: 'adresse', libelle: 'Adresse', valeur: (s) => s.address },
    { id: 'capacite', libelle: 'Capacité (t)', valeur: (s) => s.capacity ?? null, alignement: 'droite',
      rendu: (s) => (s.capacity == null ? '—' : `${s.capacity.toLocaleString('fr-FR')} t`) },
    { id: 'contact', libelle: 'Contact', valeur: (s) => s.contact_name, masquee: true },
    { id: 'telephone', libelle: 'Téléphone', valeur: (s) => s.contact_phone, masquee: true },
    { id: 'statut', libelle: 'Statut', valeur: (s) => (s.is_active === false ? 'Inactif' : 'Actif'),
      rendu: (s) => (s.is_active === false ? <Puce teinte="gris">Inactif</Puce> : <Puce teinte="vert">Actif</Puce>) },
  ], []);

  const filtres = useMemo<FiltreListe<SiteSaisi>[]>(() => [
    { id: 'type', libelle: 'Type', options: [...new Set((sites ?? []).map((s) => s.type))].map((t) => ({ valeur: t, libelle: libelleTypeSite(t) })),
      correspond: (s, v) => s.type === v },
    { id: 'statut', libelle: 'Statut', options: [{ valeur: 'actif', libelle: 'Actifs' }, { valeur: 'inactif', libelle: 'Inactifs' }],
      correspond: (s, v) => (v === 'actif' ? s.is_active !== false : s.is_active === false) },
  ], [sites]);

  const liste = sites ?? [];
  const sansCapacite = liste.filter((s) => s.capacity == null).length;
  const synthese = (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Synthèse des sites">
      {([
        ['Total sites', String(liste.length)],
        ['Sites actifs', String(liste.filter((s) => s.is_active !== false).length)],
        ['Dépôts et entrepôts', String(liste.filter((s) => s.type === 'warehouse' || s.type === 'depot').length)],
        ['Capacité déclarée', `${liste.reduce((n, s) => n + (s.capacity ?? 0), 0).toLocaleString('fr-FR')} t${sansCapacite ? ` (${sansCapacite} sans capacité)` : ''}`],
      ] as [string, string][]).map(([l, v]) => (
        <div key={l} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-carte">
          <p className="text-sm text-stone-500">{l}</p>
          <p className="text-2xl font-black text-stone-900">{sites ? v : '—'}</p>
        </div>
      ))}
    </section>
  );

  return (
    <PageListe
      vue={VUE_SITES}
      titre="Gestion des Sites"
      sousTitre="Mines, ports, dépôts et bases de l'exploitation"
      lignes={sites}
      erreur={erreur}
      colonnes={colonnes}
      filtres={filtres}
      recherche={siteCorrespond}
      placeholderRecherche="Rechercher un site..."
      cle={(s) => s.id}
      libelleOuverture={(s) => `Fiche ${s.name}`}
      actions={hasPermission('settings', 'create') && (
        <a href={routeNouveau(VUE_SITES)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow">
          <Plus className="h-4 w-4" /> Nouveau site
        </a>
      )}
      synthese={synthese}
      nomExport="sites"
      vide={{ message: 'Aucun site enregistré', detail: 'Créez le site d\'exploitation pour commencer.' }}
      onActualiser={charger}
      provenance={<Provenance source="référentiel des sites ; capacité saisie, stock non saisissable (D-079)" heure={heure} />}
    />
  );
};
