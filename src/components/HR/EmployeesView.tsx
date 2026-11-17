import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSite } from '../../contexts/SiteContext';
import { PageListe } from '../ui/PageListe';
import { Provenance, Puce } from '../ui/Panneau';
import { routeNouveau, useRoute } from '../ui/routeur';
import type { ColonneListe, FiltreListe } from '../ui/liste';
import { STATUTS_EMPLOYE, VUE_EMPLOYES, nomEmploye, type Employe } from './employe';
import { DetailEmploye } from './DetailEmploye';
import { FormulaireEmploye } from './FormulaireEmploye';
import { ActionEmployePage } from './ActionEmploye';

// Registre des employes au standard des pages (D-094, remplace
// EmployeeModal et EmployeeDetailsModal) : liste, fiche, creation et
// modification en pleine page, suspension, desactivation et reactivation
// motivees (jamais de suppression). La paie heritee reste hors lot.

export const EmployeesView = () => {
  const route = useRoute();
  if (route.vue !== VUE_EMPLOYES || route.mode === 'liste') return <ListeEmployes />;
  if (route.mode === 'nouveau') return <FormulaireEmploye />;
  if (route.mode === 'modifier') return <FormulaireEmploye id={route.id} />;
  if (route.mode === 'action' && route.action) return <ActionEmployePage id={route.id ?? ''} action={route.action} />;
  return <DetailEmploye id={route.id ?? ''} />;
};

const ListeEmployes = () => {
  const { hasPermission } = useAuth();
  const { sites } = useSite();
  const [employes, setEmployes] = useState<Employe[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const { data, error } = await supabase.from('employees').select('*').order('last_name');
    setErreur(error ? `Employés indisponibles : ${error.message}` : '');
    setEmployes(error ? null : (data ?? []) as Employe[]);
    setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const nomSite = useCallback((id: string | null) => (id ? sites.find((s) => s.id === id)?.name ?? 'Site non visible' : 'Global'), [sites]);

  const colonnes = useMemo<ColonneListe<Employe>[]>(() => [
    { id: 'nom', libelle: 'Employé', valeur: (e) => nomEmploye(e),
      rendu: (e) => <span>{nomEmploye(e)}<span className="block text-xs font-normal text-stone-500">{e.employee_number}</span></span> },
    { id: 'matricule', libelle: 'Matricule', valeur: (e) => e.employee_number, masquee: true },
    { id: 'poste', libelle: 'Poste', valeur: (e) => e.position },
    { id: 'departement', libelle: 'Département', valeur: (e) => e.department },
    { id: 'site', libelle: 'Site', valeur: (e) => nomSite(e.site_id) },
    { id: 'telephone', libelle: 'Téléphone', valeur: (e) => e.phone, masquee: true },
    { id: 'email', libelle: 'Email', valeur: (e) => e.email, masquee: true },
    { id: 'embauche', libelle: 'Embauche', valeur: (e) => e.hire_date, rendu: (e) => new Date(`${e.hire_date}T00:00:00`).toLocaleDateString('fr-FR') },
    { id: 'salaire', libelle: 'Salaire (GNF)', valeur: (e) => e.base_salary, alignement: 'droite', masquee: true,
      rendu: (e) => (e.base_salary === null ? 'Non renseigné' : e.base_salary.toLocaleString('fr-FR')) },
    { id: 'statut', libelle: 'Statut', valeur: (e) => STATUTS_EMPLOYE[e.status]?.libelle ?? e.status,
      rendu: (e) => { const s = STATUTS_EMPLOYE[e.status]; return s ? <Puce teinte={s.teinte}>{s.libelle}</Puce> : e.status; } },
  ], [nomSite]);

  const filtres = useMemo<FiltreListe<Employe>[]>(() => {
    const departements = [...new Set((employes ?? []).map((e) => e.department))].sort();
    return [
      { id: 'statut', libelle: 'Statut', options: Object.entries(STATUTS_EMPLOYE).map(([k, v]) => ({ valeur: k, libelle: v.libelle })), correspond: (e, s) => e.status === s },
      { id: 'departement', libelle: 'Département', options: departements.map((d) => ({ valeur: d, libelle: d })), correspond: (e, d) => e.department === d },
      { id: 'site', libelle: 'Site', options: [{ valeur: 'global', libelle: 'Global' }, ...sites.map((s) => ({ valeur: s.id, libelle: s.name }))],
        correspond: (e, s) => (s === 'global' ? e.site_id === null : e.site_id === s) },
    ];
  }, [employes, sites]);

  const liste = employes ?? [];
  const synthese = (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Synthèse des employés">
      {([
        ['Total employés', liste.length],
        ['Actifs', liste.filter((e) => e.status === 'active').length],
        ['Suspendus ou en congé', liste.filter((e) => e.status === 'suspended' || e.status === 'on_leave').length],
        ['Désactivés', liste.filter((e) => e.status === 'terminated').length],
      ] as [string, number][]).map(([l, n]) => (
        <div key={l} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-carte"><p className="text-sm text-stone-500">{l}</p><p className="text-2xl font-black text-stone-900">{employes ? n : '—'}</p></div>
      ))}
    </section>
  );

  return (
    <PageListe
      vue={VUE_EMPLOYES}
      titre="Employés"
      sousTitre="Registre du personnel : poste, département, site, statut"
      lignes={employes}
      erreur={erreur}
      colonnes={colonnes}
      filtres={filtres}
      placeholderRecherche="Rechercher par nom, matricule ou poste..."
      recherche={(e, t) => { const s = t.trim().toLowerCase(); return [nomEmploye(e), e.employee_number, e.position].some((v) => (v ?? '').toLowerCase().includes(s)); }}
      cle={(e) => e.id}
      libelleOuverture={(e) => `Fiche ${nomEmploye(e)}`}
      actions={hasPermission('hr', 'create') && (
        <a href={routeNouveau(VUE_EMPLOYES)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow">
          <Plus className="h-4 w-4" /> Ajouter un employé
        </a>
      )}
      synthese={synthese}
      nomExport="employes"
      vide={{ message: 'Aucun employé', detail: 'Ajoutez la première fiche employé.' }}
      onActualiser={charger}
      provenance={<Provenance source="registre du personnel (employees), dans votre périmètre de site" heure={heure} />}
    />
  );
};
