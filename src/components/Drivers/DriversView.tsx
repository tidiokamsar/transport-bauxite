import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PageListe } from '../ui/PageListe';
import { Provenance, Puce } from '../ui/Panneau';
import { routeNouveau, useRoute } from '../ui/routeur';
import type { ColonneListe, FiltreListe } from '../ui/liste';
import { CONTRATS_CHAUFFEUR, STATUTS_CHAUFFEUR, VUE_CHAUFFEURS, joursAvant, type Chauffeur } from './chauffeur';
import { DetailChauffeur } from './DetailChauffeur';
import { FormulaireChauffeur } from './FormulaireChauffeur';
import { ActionChauffeurPage } from './ActionChauffeur';

// Registre des chauffeurs au standard des pages (D-090) : liste, fiche
// (informations, voyages, habilitations, infractions, historique),
// creation et modification en pleine page, suspension, reactivation et
// archivage (jamais de suppression, D-042).

export const DriversView = () => {
  const route = useRoute();
  if (route.vue !== VUE_CHAUFFEURS || route.mode === 'liste') return <ListeChauffeurs />;
  if (route.mode === 'nouveau') return <FormulaireChauffeur />;
  if (route.mode === 'modifier') return <FormulaireChauffeur id={route.id} />;
  if (route.mode === 'action' && route.action) return <ActionChauffeurPage id={route.id ?? ''} action={route.action} />;
  return <DetailChauffeur id={route.id ?? ''} />;
};

const ListeChauffeurs = () => {
  const { hasPermission } = useAuth();
  const [chauffeurs, setChauffeurs] = useState<Chauffeur[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);
  const aujourdhui = useMemo(() => new Date(), []);

  const charger = useCallback(async () => {
    const { data, error } = await supabase.from('drivers').select('*').order('name');
    // Etat d'erreur visible (D-078), jamais une liste vide.
    setErreur(error ? `Chauffeurs indisponibles : ${error.message}` : '');
    setChauffeurs(error ? null : (data ?? []) as Chauffeur[]);
    setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const colonnes = useMemo<ColonneListe<Chauffeur>[]>(() => [
    { id: 'nom', libelle: 'Chauffeur', valeur: (d) => d.name,
      rendu: (d) => <span>{d.name}{d.employee_id && <span className="block text-xs font-normal text-stone-500">{d.employee_id}</span>}</span> },
    { id: 'matricule', libelle: 'Matricule', valeur: (d) => d.employee_id, masquee: true },
    { id: 'telephone', libelle: 'Téléphone', valeur: (d) => d.phone },
    { id: 'email', libelle: 'Email', valeur: (d) => d.email, masquee: true },
    { id: 'permis', libelle: 'Permis', valeur: (d) => d.license_number, rendu: (d) => `${d.license_number} · cat. ${d.license_category}` },
    { id: 'expiration', libelle: 'Expiration permis', valeur: (d) => d.license_expiry,
      rendu: (d) => { const n = joursAvant(d.license_expiry, aujourdhui); return <span className={n < 0 ? 'font-semibold text-red-700' : n <= 30 ? 'font-semibold text-orange-700' : ''}>{new Date(`${d.license_expiry}T00:00:00`).toLocaleDateString('fr-FR')}</span>; } },
    { id: 'contrat', libelle: 'Contrat', valeur: (d) => CONTRATS_CHAUFFEUR[d.contract_type] ?? d.contract_type },
    { id: 'salaire', libelle: 'Salaire (GNF)', valeur: (d) => d.base_salary, alignement: 'droite', masquee: true,
      rendu: (d) => (d.base_salary === null ? '—' : d.base_salary.toLocaleString('fr-FR')) },
    { id: 'embauche', libelle: 'Embauche', valeur: (d) => d.hire_date, masquee: true },
    { id: 'statut', libelle: 'Statut', valeur: (d) => STATUTS_CHAUFFEUR[d.status]?.libelle ?? d.status,
      rendu: (d) => { const s = STATUTS_CHAUFFEUR[d.status]; return s ? <Puce teinte={s.teinte}>{s.libelle}</Puce> : d.status; } },
  ], [aujourdhui]);

  const filtres = useMemo<FiltreListe<Chauffeur>[]>(() => [
    { id: 'statut', libelle: 'Statut', options: Object.entries(STATUTS_CHAUFFEUR).map(([k, v]) => ({ valeur: k, libelle: v.libelle })), correspond: (d, s) => d.status === s },
    { id: 'permis', libelle: 'Permis', options: [{ valeur: 'expire', libelle: 'Expiré' }, { valeur: 'bientot', libelle: 'Expire sous 30 jours' }],
      correspond: (d, v) => { const n = joursAvant(d.license_expiry, aujourdhui); return v === 'expire' ? n < 0 : n >= 0 && n <= 30; } },
  ], [aujourdhui]);

  const liste = chauffeurs ?? [];
  const synthese = (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Synthèse des chauffeurs">
      {([
        ['Total chauffeurs', liste.length],
        ['Chauffeurs actifs', liste.filter((d) => d.status === 'active').length],
        ['Suspendus', liste.filter((d) => d.status === 'suspended').length],
        ['Permis à renouveler (30 j)', liste.filter((d) => { const n = joursAvant(d.license_expiry, aujourdhui); return n >= 0 && n <= 30; }).length],
      ] as [string, number][]).map(([l, n]) => (
        <div key={l} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-carte"><p className="text-sm text-stone-500">{l}</p><p className="text-2xl font-black text-stone-900">{chauffeurs ? n : '—'}</p></div>
      ))}
    </section>
  );

  return (
    <PageListe
      vue={VUE_CHAUFFEURS}
      titre="Chauffeurs"
      sousTitre="Dossiers des chauffeurs : permis, contrat, habilitations, infractions"
      lignes={chauffeurs}
      erreur={erreur}
      colonnes={colonnes}
      filtres={filtres}
      placeholderRecherche="Rechercher par nom, matricule ou permis..."
      recherche={(d, t) => { const s = t.trim().toLowerCase(); return [d.name, d.employee_id, d.license_number].some((v) => (v ?? '').toLowerCase().includes(s)); }}
      cle={(d) => d.id}
      libelleOuverture={(d) => `Fiche ${d.name}`}
      actions={hasPermission('drivers', 'create') && (
        <a href={routeNouveau(VUE_CHAUFFEURS)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow">
          <Plus className="h-4 w-4" /> Ajouter un chauffeur
        </a>
      )}
      synthese={synthese}
      nomExport="chauffeurs"
      vide={{ message: 'Aucun chauffeur', detail: 'Ajoutez le premier dossier chauffeur.' }}
      onActualiser={charger}
      provenance={<Provenance source="dossiers des chauffeurs (drivers), dans votre périmètre de site" heure={heure} />}
    />
  );
};
