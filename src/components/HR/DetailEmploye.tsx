import { useEffect, useState } from 'react';
import { Ban, Edit2, RotateCcw, UserX } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSite } from '../../contexts/SiteContext';
import { Historique } from '../ui/Historique';
import { Informations, OngletPieces, PageDetail, Relation } from '../ui/PageDetail';
import { fusionnerHistoriques, type EvenementHistorique } from '../ui/evenements';
import { lire, trouver, type Lecture } from '../ui/lecture';
import { routeAction, routeDetail, routeModifier } from '../ui/routeur';
import { GENRES, STATUTS_EMPLOYE, VUE_EMPLOYES, actionEmployePermise, nomEmploye, type Employe } from './employe';

// Fiche d'un employe en pleine page (D-094, remplace EmployeeDetailsModal) :
// informations, relations (dossier chauffeur rattache par le matricule,
// dotations EPI, presences recentes), historique lu dans journal_employes.
// La paie heritee de Bolt n'est pas reprise dans ce lot. Aucun registre de
// contrats ni de documents RH n'existe en base : l'ecart est affiche.

interface Journal { id: string; employee_id: string; action: string; avant: Record<string, unknown> | null; apres: Record<string, unknown> | null; motif: string | null; auteur: string | null; le: string }
interface Chauffeur { id: string; name: string; license_number: string; status: string }
interface Dotation { id: string; numero: string; type_epi: string; quantite: number; remis_le: string; statut: string }
interface Presence { id: string; date: string; status: string | null; hours_worked: number | null }

const date = (d: string | null | undefined) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('fr-FR') : null);
const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });

const LIBELLES_JOURNAL: Record<string, string> = {
  creation: 'Fiche créée', modification: 'Fiche modifiée', suspension: 'Employé suspendu',
  desactivation: 'Employé désactivé', reactivation: 'Employé réactivé',
};

/** Champs modifies entre deux etats journalises (noms de colonnes). */
const champsModifies = (avant: Record<string, unknown> | null, apres: Record<string, unknown> | null) =>
  Object.keys(apres ?? {}).filter((k) => k !== 'full_name' && JSON.stringify(avant?.[k] ?? null) !== JSON.stringify(apres?.[k] ?? null));

export const DetailEmploye = ({ id }: { id: string }) => {
  const { hasPermission } = useAuth();
  const { sites } = useSite();
  const [employe, setEmploye] = useState<Lecture<Employe>>(attente);
  const [journal, setJournal] = useState<Lecture<Journal>>(attente);
  const [chauffeurs, setChauffeurs] = useState<Lecture<Chauffeur>>(attente);
  const [dotations, setDotations] = useState<Lecture<Dotation>>(attente);
  const [presences, setPresences] = useState<Lecture<Presence>>(attente);

  useEffect(() => {
    lire<Employe>(supabase.from('employees').select('*').eq('id', id), 'employé').then(async (r) => {
      setEmploye(r);
      const e = trouver(r.lignes, id);
      setChauffeurs(e ? await lire<Chauffeur>(supabase.from('drivers').select('id, name, license_number, status').eq('employee_id', e.employee_number), 'dossier chauffeur') : { lignes: [], erreur: '' });
    });
    lire<Journal>(supabase.from('journal_employes').select('*').eq('employee_id', id).order('le', { ascending: false }), 'journal').then(setJournal);
    lire<Dotation>(supabase.from('dotations_epi').select('id, numero, type_epi, quantite, remis_le, statut').eq('employee_id', id).order('remis_le', { ascending: false }), 'dotations EPI').then(setDotations);
    lire<Presence>(supabase.from('employee_attendance').select('id, date, status, hours_worked').eq('employee_id', id).order('date', { ascending: false }).limit(20), 'présences').then(setPresences);
  }, [id]);

  const e = trouver(employe.lignes, id);
  const peutModifier = hasPermission('hr', 'edit');
  const statut = e ? STATUTS_EMPLOYE[e.status] ?? { libelle: e.status, teinte: 'gris' as const } : null;

  const historique: EvenementHistorique[] | null = journal.lignes && fusionnerHistoriques(
    journal.lignes.filter((j) => j.employee_id === id).map((j) => ({
      id: `journal_employes-${j.id}`, le: j.le, libelle: LIBELLES_JOURNAL[j.action] ?? j.action, motif: j.motif, auteur: j.auteur, source: 'journal_employes',
      detail: j.action === 'modification' ? `Champs modifiés : ${champsModifies(j.avant, j.apres).join(', ') || 'aucun'}`
        : j.avant?.status || j.apres?.status ? `Statut : ${String(j.avant?.status ?? '-')} -> ${String(j.apres?.status ?? '-')}` : null,
    })),
  );

  return (
    <PageDetail
      vue={VUE_EMPLOYES}
      module="Employés"
      reference={e ? nomEmploye(e) : 'Employé'}
      statut={statut}
      resume={e && <>{e.employee_number} · {e.position} · {e.department}</>}
      chargement={employe.lignes === null && !employe.erreur}
      erreur={employe.erreur}
      introuvable={employe.lignes !== null && !e}
      actions={!e ? [] : [
        { id: 'modifier', libelle: 'Modifier', icone: <Edit2 className="h-4 w-4" />, visible: peutModifier, ton: 'principal', vers: routeModifier(VUE_EMPLOYES, id) },
        { id: 'suspendre', libelle: 'Suspendre', icone: <Ban className="h-4 w-4" />, visible: peutModifier && actionEmployePermise('suspendre', e.status), vers: routeAction(VUE_EMPLOYES, id, 'suspendre') },
        { id: 'reactiver', libelle: 'Réactiver', icone: <RotateCcw className="h-4 w-4" />, visible: peutModifier && actionEmployePermise('reactiver', e.status), vers: routeAction(VUE_EMPLOYES, id, 'reactiver') },
        { id: 'desactiver', libelle: 'Désactiver', icone: <UserX className="h-4 w-4" />, visible: peutModifier && actionEmployePermise('desactiver', e.status), ton: 'danger', vers: routeAction(VUE_EMPLOYES, id, 'desactiver') },
      ]}
      onglets={!e ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <Informations groupes={[
            { titre: 'Identité', champs: [['Matricule', e.employee_number], ['Prénom', e.first_name], ['Nom', e.last_name], ['Date de naissance', date(e.date_of_birth)],
              ['Genre', e.gender ? GENRES[e.gender] ?? e.gender : null], ['Pièce d\'identité', e.national_id]] },
            { titre: 'Poste et affectation', champs: [['Poste', e.position], ['Département', e.department], ['Embauche', date(e.hire_date)],
              ['Site', e.site_id ? sites.find((s) => s.id === e.site_id)?.name ?? 'Site non visible' : 'Global (tous sites)'], ['Statut', statut?.libelle]] },
            { titre: 'Coordonnées et urgence', champs: [['Téléphone', e.phone], ['Email', e.email], ['Adresse', e.address],
              ['Contact d\'urgence', e.emergency_contact_name], ['Téléphone d\'urgence', e.emergency_contact_phone]] },
            { titre: 'Rémunération et notes', champs: [['Salaire de base', e.base_salary === null ? null : `${e.base_salary.toLocaleString('fr-FR')} GNF`],
              ['Banque', e.bank_name], ['Compte bancaire', e.bank_account], ['Notes', e.notes]] },
          ]} />
        ) },
        { id: 'relations', libelle: 'Relations', contenu: (
          <div className="grid gap-4 lg:grid-cols-2">
            <Relation titre="Dossier chauffeur" lignes={chauffeurs.lignes} erreur={chauffeurs.erreur} cle={(c) => c.id} vide="Aucun dossier chauffeur à ce matricule"
              note="Rattaché par le matricule (drivers.employee_id) ; permis et habilitations dans la fiche chauffeur." lien={(c) => routeDetail('drivers', c.id)}
              colonnes={[{ libelle: 'Chauffeur', valeur: (c) => c.name }, { libelle: 'Permis', valeur: (c) => c.license_number }, { libelle: 'Statut', valeur: (c) => c.status }]} />
            <Relation titre="Dotations EPI" lignes={dotations.lignes} erreur={dotations.erreur} cle={(d) => d.id} vide="Aucune dotation enregistrée"
              note="Saisie dans HSE → Prévention."
              colonnes={[{ libelle: 'Numéro', valeur: (d) => d.numero }, { libelle: 'EPI', valeur: (d) => `${d.type_epi} x ${d.quantite}` }, { libelle: 'Remis le', valeur: (d) => date(d.remis_le) ?? '—' }, { libelle: 'État', valeur: (d) => d.statut }]} />
            <Relation titre="Présences récentes" lignes={presences.lignes} erreur={presences.erreur} cle={(p) => p.id} vide="Aucun pointage enregistré"
              note="Les 20 plus récentes ; saisie dans RH → Présences."
              colonnes={[{ libelle: 'Date', valeur: (p) => date(p.date) ?? '—' }, { libelle: 'Statut', valeur: (p) => p.status ?? '—' }, { libelle: 'Heures', valeur: (p) => p.hours_worked ?? '—' }]} />
            <section className="rounded-2xl border border-dashed border-stone-300 bg-white p-4 text-sm text-stone-600">
              <p className="font-bold text-stone-800">Contrats de travail et documents RH</p>
              <p className="mt-1">Aucun registre en base pour l'instant (D-094) : ils seront ajoutés dans un lot RH suivant. Aucune donnée n'est supposée.</p>
            </section>
          </div>
        ) },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={journal.erreur ? [] : historique} erreur={journal.erreur} source="journal_employes (append-only, D-094)"
            absent="Les fiches créées avant D-094 n'ont pas d'événement de création journalisé." />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="un employé" /> },
      ]}
    />
  );
};
