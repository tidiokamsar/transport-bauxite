import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Plus, Settings2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PageListe } from '../ui/PageListe';
import { Panneau, Provenance, Puce } from '../ui/Panneau';
import { routeNouveau, useRoute } from '../ui/routeur';
import type { ColonneListe, FiltreListe } from '../ui/liste';
import { TYPES_DOCUMENT, TYPES_FOURNISSEUR, type Categorie, type Fournisseur } from './fournisseurs';
import { COLONNES_FOURNISSEUR, LIENS_RUBRIQUES, type Contact, type Evaluation } from './donnees';
import { VUE_FOURNISSEURS, pageDepuisRoute, routeConsultations, routeReferentiels } from './routes';
import { DetailFournisseur } from './DetailFournisseur';
import { FormulaireFournisseur, ModifierFournisseur } from './FormulaireFournisseur';
import { ActionFournisseurVue } from './ActionFournisseur';
import { ListeConsultations } from './ListeConsultations';
import { DetailConsultation } from './DetailConsultation';
import { FormulaireConsultation } from './FormulaireConsultation';
import { ActionConsultationVue } from './ActionConsultation';
import { ActionReferentiel, ReferentielsFournisseurs } from './ReferentielsFournisseurs';

// Fournisseurs (D-059) au standard des pages (D-090) : repertoire, fiche,
// saisie en pleine page, actions motivees ; consultations de prix et
// referentiels dans la meme vue (routes.ts). Toute ecriture passe par les
// fonctions serveur.

export const SuppliersView = () => {
  const route = useRoute();
  const p = pageDepuisRoute(route);
  switch (p.page) {
    case 'nouveau-fournisseur': return <FormulaireFournisseur />;
    case 'fournisseur': return <DetailFournisseur id={p.id} />;
    case 'modifier-fournisseur': return <ModifierFournisseur id={p.id} />;
    case 'action-fournisseur': return <ActionFournisseurVue id={p.id} action={p.action} requete={route.requete} />;
    case 'consultations': return <ListeConsultations />;
    case 'nouvelle-consultation': return <FormulaireConsultation />;
    case 'consultation': return <DetailConsultation id={p.id} />;
    case 'action-consultation': return <ActionConsultationVue id={p.id} action={p.action} requete={route.requete} />;
    case 'referentiels': return <ReferentielsFournisseurs />;
    case 'action-referentiel': return <ActionReferentiel action={p.action} requete={route.requete} />;
    default: return <ListeFournisseurs />;
  }
};

interface AlerteDocument { id: string; supplier_id: string; company_name: string; type_document: string; libelle: string | null; date_expiration: string; jours_restants: number; etat: 'expire' | 'a_renouveler' }
interface Ligne extends Fournisseur { categories: string[]; categorieIds: string[]; contact: Contact | null; evaluation: Evaluation | null; alertes: AlerteDocument[] }

const ListeFournisseurs = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('purchases', 'create') || hasPermission('purchases', 'edit');
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [alertes, setAlertes] = useState<AlerteDocument[]>([]);
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const [f, c, fc, ct, ev, al] = await Promise.all([
      supabase.from('suppliers').select(COLONNES_FOURNISSEUR).order('company_name'),
      supabase.from('categories_fournisseurs').select('id, libelle, actif').order('libelle'),
      supabase.from('fournisseurs_categories').select('supplier_id, categorie_id'),
      supabase.from('contacts_fournisseurs').select('id, supplier_id, nom, fonction, telephone, email, principal, actif, motif_retrait').eq('actif', true),
      supabase.from('v_evaluations_fournisseurs_courantes').select('id, supplier_id, periode_debut, periode_fin, note_globale').order('periode_fin', { ascending: false }),
      supabase.from('v_documents_fournisseurs_echeance').select('id, supplier_id, company_name, type_document, libelle, date_expiration, jours_restants, etat').order('date_expiration'),
    ]);
    setHeure(new Date());
    if (f.error) { setErreur(`Fournisseurs indisponibles : ${f.error.message}`); setLignes(null); return; }
    setErreur('');
    const cats = (c.data ?? []) as Categorie[];
    const libelle = new Map(cats.map((x) => [x.id, x.libelle]));
    const classement = (fc.data ?? []) as { supplier_id: string; categorie_id: string }[];
    const contacts = ((ct.data ?? []) as Contact[]).filter((x) => x.actif);
    const evaluations = (ev.data ?? []) as Evaluation[];
    const als = (al.data ?? []) as AlerteDocument[];
    setCategories(cats);
    setAlertes(als);
    setLignes(((f.data ?? []) as Fournisseur[]).map((x) => {
      const ids = classement.filter((k) => k.supplier_id === x.id).map((k) => k.categorie_id);
      return {
        ...x,
        categorieIds: ids,
        categories: ids.map((id) => libelle.get(id) ?? '?'),
        contact: contacts.find((k) => k.supplier_id === x.id && k.principal) ?? contacts.find((k) => k.supplier_id === x.id) ?? null,
        evaluation: evaluations.filter((e) => e.supplier_id === x.id).sort((a, b) => b.periode_fin.localeCompare(a.periode_fin))[0] ?? null,
        alertes: als.filter((a) => a.supplier_id === x.id),
      };
    }));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const colonnes = useMemo<ColonneListe<Ligne>[]>(() => [
    { id: 'numero', libelle: 'Numéro', valeur: (f) => f.supplier_number },
    { id: 'nom', libelle: 'Raison sociale', valeur: (f) => f.company_name,
      rendu: (f) => <>{f.company_name}{f.ville && <span className="block text-xs text-stone-500">{f.ville}</span>}</> },
    { id: 'type', libelle: 'Type', valeur: (f) => TYPES_FOURNISSEUR[f.supplier_type] ?? f.supplier_type },
    { id: 'categories', libelle: 'Catégories', valeur: (f) => f.categories.join(', '), rendu: (f) => f.categories.join(', ') || <span className="text-stone-400">Aucune</span> },
    { id: 'contact', libelle: 'Contact principal', valeur: (f) => f.contact?.nom,
      rendu: (f) => (f.contact ? <>{f.contact.nom}<span className="block text-xs text-stone-500">{f.contact.telephone ?? f.contact.email}</span></> : <span className="text-stone-400">Aucun</span>) },
    { id: 'evaluation', libelle: 'Dernière évaluation', valeur: (f) => f.evaluation?.note_globale, alignement: 'droite',
      rendu: (f) => (f.evaluation ? <>{f.evaluation.note_globale} / 5<span className="block text-xs text-stone-500">{f.evaluation.periode_debut} au {f.evaluation.periode_fin}</span></> : <span className="text-stone-400">Non évalué</span>) },
    { id: 'documents', libelle: 'Documents', valeur: (f) => f.alertes.length,
      rendu: (f) => (f.alertes.length === 0 ? <span className="text-stone-400">Aucune alerte</span>
        : <Puce teinte={f.alertes.some((x) => x.etat === 'expire') ? 'rouge' : 'orange'}>{f.alertes.length} à renouveler</Puce>) },
    { id: 'nif', libelle: 'Identifiant fiscal', valeur: (f) => f.identifiant_fiscal, masquee: true },
    { id: 'telephone', libelle: 'Téléphone', valeur: (f) => f.phone, masquee: true },
    { id: 'statut', libelle: 'Statut', valeur: (f) => (f.active === false ? 'Suspendu' : 'Actif'),
      rendu: (f) => <Puce teinte={f.active === false ? 'rouge' : 'vert'}>{f.active === false ? 'Suspendu' : 'Actif'}</Puce> },
  ], []);
  const filtres = useMemo<FiltreListe<Ligne>[]>(() => [
    { id: 'statut', libelle: 'Statut', options: [{ valeur: 'actifs', libelle: 'Actifs' }, { valeur: 'suspendus', libelle: 'Suspendus' }],
      correspond: (f, v) => (v === 'actifs' ? f.active !== false : f.active === false) },
    { id: 'type', libelle: 'Type', options: Object.entries(TYPES_FOURNISSEUR).map(([valeur, libelle]) => ({ valeur, libelle })), correspond: (f, v) => f.supplier_type === v },
    { id: 'categorie', libelle: 'Catégorie', options: categories.map((c) => ({ valeur: c.id, libelle: c.libelle })), correspond: (f, v) => f.categorieIds.includes(v) },
  ], [categories]);

  return (
    <PageListe
      vue={VUE_FOURNISSEURS}
      titre="Fournisseurs"
      sousTitre="Répertoire, fiches, documents, évaluations, suspension et consultations de prix"
      lignes={lignes}
      erreur={erreur}
      colonnes={colonnes}
      filtres={filtres}
      placeholderRecherche="Nom, numéro, NIF, ville"
      recherche={(f, t) => { const q = t.trim().toLowerCase(); return [f.company_name, f.supplier_number, f.identifiant_fiscal ?? '', f.ville ?? ''].some((v) => v.toLowerCase().includes(q)); }}
      cle={(f) => f.id}
      libelleOuverture={(f) => `Fiche ${f.company_name}`}
      actions={<>
        <a href={routeConsultations()} className={LIENS_RUBRIQUES}><ClipboardList className="h-4 w-4" /> Consultations</a>
        <a href={routeReferentiels()} className={LIENS_RUBRIQUES}><Settings2 className="h-4 w-4" /> Référentiels</a>
        {peutEcrire && (
          <a href={routeNouveau(VUE_FOURNISSEURS)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow">
            <Plus className="h-4 w-4" /> Nouveau fournisseur
          </a>
        )}
      </>}
      synthese={alertes.length > 0 && (
        <Panneau titre="Documents à renouveler">
          <ul className="divide-y divide-stone-100 text-sm">{alertes.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span><b>{a.company_name}</b> · {a.type_document === 'autre' ? a.libelle : TYPES_DOCUMENT[a.type_document] ?? a.type_document} · expire le {a.date_expiration}</span>
              <Puce teinte={a.etat === 'expire' ? 'rouge' : 'orange'}>{a.etat === 'expire' ? `Expiré depuis ${-a.jours_restants} j` : `Dans ${a.jours_restants} j`}</Puce>
            </li>
          ))}</ul>
          <Provenance source="v_documents_fournisseurs_echeance (dates saisies)" heure={heure} />
        </Panneau>
      )}
      nomExport="fournisseurs"
      vide={{ message: 'Aucun fournisseur', detail: 'Créez les fiches fournisseurs : le numéro est attribué par le serveur.' }}
      onActualiser={charger}
      provenance={<Provenance source="suppliers, contacts, évaluations courantes" heure={heure} />}
    />
  );
};
