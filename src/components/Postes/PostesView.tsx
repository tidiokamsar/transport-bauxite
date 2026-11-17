import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PageListe } from '../ui/PageListe';
import { Provenance, Puce, ReferentielVide } from '../ui/Panneau';
import { SANS_SHIFT, SANS_SITE } from '../ui/referentiels';
import { LienVue } from '../ui/LienVue';
import { routeNouveau, useRoute } from '../ui/routeur';
import type { ColonneListe, FiltreListe } from '../ui/liste';
import { COLONNES_POSTE, LIBELLE_STATUT_POSTE, VUE_POSTES, teintePoste, type Poste } from './postes';
import { DetailPoste } from './DetailPoste';
import { FormulairePoste } from './FormulairePoste';
import { ActionPosteVue } from './ActionPoste';

// Postes de travail (D-048) au standard des pages (D-090) : liste, fiche
// (consignes, equipe, evenements, historique), ouverture en pleine page et
// actions motivees (affecter, pointer, consigner, clore, valider), chacune
// par sa fonction serveur existante.

export const PostesView = () => {
  const route = useRoute();
  if (route.vue !== VUE_POSTES || route.mode === 'liste') return <ListePostes />;
  if (route.mode === 'nouveau') return <FormulairePoste />;
  if (route.mode === 'action' && route.action) return <ActionPosteVue id={route.id ?? ''} action={route.action} requete={route.requete} />;
  if (route.mode === 'modifier') return <DetailPoste id={route.id ?? ''} />;
  return <DetailPoste id={route.id ?? ''} />;
};

interface Lib { id: string; libelle: string }

const jour = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR');

const ListePostes = () => {
  const { hasPermission } = useAuth();
  const peutExploiter = hasPermission('trips', 'create') || hasPermission('trips', 'edit');
  const [postes, setPostes] = useState<Poste[] | null>(null);
  const [shifts, setShifts] = useState<Lib[]>([]);
  const [sites, setSites] = useState<Lib[]>([]);
  const [vides, setVides] = useState({ site: false, shift: false, chauffeur: false });
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const [p, sh, si, ch] = await Promise.all([
      supabase.from('postes').select(COLONNES_POSTE).order('date_poste', { ascending: false }).order('ouvert_le').limit(500),
      supabase.from('work_shifts').select('id, display_name').eq('is_active', true).order('shift_order'),
      supabase.from('sites').select('id, name').order('name'),
      supabase.from('drivers').select('id').eq('status', 'active').limit(1),
    ]);
    setErreur(p.error ? `Postes indisponibles : ${p.error.message}` : sh.error?.message ?? si.error?.message ?? ch.error?.message ?? '');
    setPostes(p.error ? null : ((p.data ?? []) as Poste[]));
    setShifts((sh.data ?? []).map((x) => ({ id: x.id as string, libelle: x.display_name as string })));
    setSites((si.data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string })));
    setVides({ site: !si.error && (si.data ?? []).length === 0, shift: !sh.error && (sh.data ?? []).length === 0, chauffeur: !ch.error && (ch.data ?? []).length === 0 });
    setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const nomShift = useMemo(() => new Map(shifts.map((s) => [s.id, s.libelle])), [shifts]);
  const nomSite = useMemo(() => new Map(sites.map((s) => [s.id, s.libelle])), [sites]);

  const colonnes = useMemo<ColonneListe<Poste>[]>(() => [
    { id: 'poste', libelle: 'Poste', valeur: (p) => `${nomShift.get(p.shift_id) ?? 'Shift'} · ${nomSite.get(p.site_id) ?? 'Site'}` },
    { id: 'date', libelle: 'Date', valeur: (p) => p.date_poste, rendu: (p) => jour(p.date_poste) },
    { id: 'site', libelle: 'Site', valeur: (p) => nomSite.get(p.site_id) ?? null },
    { id: 'shift', libelle: 'Shift', valeur: (p) => nomShift.get(p.shift_id) ?? null },
    { id: 'statut', libelle: 'Statut', valeur: (p) => LIBELLE_STATUT_POSTE[p.statut] ?? p.statut,
      rendu: (p) => <Puce teinte={teintePoste(p.statut)}>{LIBELLE_STATUT_POSTE[p.statut] ?? p.statut}</Puce> },
    { id: 'ouvert', libelle: 'Ouvert le', valeur: (p) => p.ouvert_le, rendu: (p) => new Date(p.ouvert_le).toLocaleString('fr-FR'), masquee: true },
    { id: 'clos', libelle: 'Clos le', valeur: (p) => p.cloture_le, rendu: (p) => (p.cloture_le ? new Date(p.cloture_le).toLocaleString('fr-FR') : '—'), masquee: true },
    { id: 'consignes', libelle: 'Consignes reçues', valeur: (p) => p.consignes_recues, masquee: true },
  ], [nomShift, nomSite]);

  const filtres = useMemo<FiltreListe<Poste>[]>(() => [
    { id: 'date', libelle: 'Date', options: [...new Set((postes ?? []).map((p) => p.date_poste))].map((d) => ({ valeur: d, libelle: jour(d) })),
      correspond: (p, v) => p.date_poste === v },
    { id: 'site', libelle: 'Site', options: sites.map((s) => ({ valeur: s.id, libelle: s.libelle })), correspond: (p, v) => p.site_id === v },
    { id: 'shift', libelle: 'Shift', options: shifts.map((s) => ({ valeur: s.id, libelle: s.libelle })), correspond: (p, v) => p.shift_id === v },
    { id: 'statut', libelle: 'Statut', options: Object.entries(LIBELLE_STATUT_POSTE).map(([valeur, libelle]) => ({ valeur, libelle })), correspond: (p, v) => p.statut === v },
  ], [postes, sites, shifts]);

  const ouvrable = peutExploiter && !vides.site && !vides.shift;
  const synthese = (vides.site || vides.shift || vides.chauffeur) ? (
    <div className="space-y-2">
      {vides.site && <ReferentielVide>{SANS_SITE} Un poste s'ouvre pour un shift et un site.</ReferentielVide>}
      {vides.shift && <ReferentielVide>{SANS_SHIFT} <LienVue vue="shifts">Ouvrir la gestion des shifts</LienVue></ReferentielVide>}
      {vides.chauffeur && <ReferentielVide>Aucun chauffeur actif : créez ou réactivez les chauffeurs (Flotte → Chauffeurs) pour composer l'équipe d'un poste.</ReferentielVide>}
    </div>
  ) : undefined;

  return (
    <PageListe
      vue={VUE_POSTES}
      titre="Postes de travail"
      sousTitre="Ouverture, équipe, événements, passation et clôture validée de chaque shift"
      lignes={postes}
      erreur={erreur}
      colonnes={colonnes}
      filtres={filtres}
      placeholderRecherche="Rechercher un poste, un site, un shift..."
      cle={(p) => p.id}
      libelleOuverture={(p) => `Fiche du poste ${nomShift.get(p.shift_id) ?? ''} ${nomSite.get(p.site_id) ?? ''} ${jour(p.date_poste)}`.replace(/\s+/g, ' ').trim()}
      actions={ouvrable && (
        <a href={routeNouveau(VUE_POSTES)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow">
          <Plus className="h-4 w-4" /> Ouvrir un poste
        </a>
      )}
      synthese={synthese}
      nomExport="postes-de-travail"
      vide={{ message: 'Aucun poste', detail: 'Aucun poste planifié ou ouvert. Un poste s\'ouvre pour une date, un shift et un site.' }}
      onActualiser={charger}
      provenance={<Provenance source="postes (500 plus récents), shifts et sites ; écriture par les fonctions serveur des postes (D-048)" heure={heure} />}
    />
  );
};
