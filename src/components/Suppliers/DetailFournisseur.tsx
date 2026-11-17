import { useEffect, useState } from 'react';
import { Ban, FilePlus2, Pencil, RotateCcw, Star, Tags, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Historique } from '../ui/Historique';
import { Informations, OngletPieces, PageDetail, Relation } from '../ui/PageDetail';
import { Puce, SansDonnees } from '../ui/Panneau';
import { fusionnerHistoriques } from '../ui/evenements';
import { lire, trouver, type Lecture } from '../ui/lecture';
import { routeModifier } from '../ui/routeur';
import { STATUTS_BON } from '../Purchases/achats';
import { ETATS_DOCUMENT, TYPES_DOCUMENT, TYPES_FOURNISSEUR, etatDocument, type Categorie, type Fournisseur } from './fournisseurs';
import {
  COLONNES_FOURNISSEUR, EVENEMENTS_FOURNISSEUR, GNF, STATUTS_PAIEMENT, aujourdhui, lignesDe,
  type Bon, type Contact, type Critere, type DocFournisseur, type Evaluation, type JournalFournisseur, type NoteEvaluation, type Paiement,
} from './donnees';
import { MODULE_FOURNISSEURS, VUE_FOURNISSEURS, actionFournisseurInterdite, routeActionFournisseur, type ActionFournisseur } from './routes';

// Fiche d'un fournisseur (D-059, D-090) : identite et categories,
// contacts, documents administratifs, evaluations, commandes et paiements,
// historique (fournisseurs_journal), actions selon le droit et l'etat.

const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });
const LIEN_LIGNE = 'rounded border border-stone-300 px-2 py-1 text-xs font-semibold';

export const DetailFournisseur = ({ id }: { id: string }) => {
  const { hasPermission } = useAuth();
  const droits = { ecrire: hasPermission('purchases', 'create') || hasPermission('purchases', 'edit'), approuver: hasPermission('purchases', 'approve') };
  const voitPaiements = hasPermission('invoices', 'view') || hasPermission('contracts', 'view');
  const [fournisseur, setFournisseur] = useState<Lecture<Fournisseur>>(attente);
  const [contacts, setContacts] = useState<Lecture<Contact>>(attente);
  const [documents, setDocuments] = useState<Lecture<DocFournisseur>>(attente);
  const [criteres, setCriteres] = useState<Critere[]>([]);
  const [evaluations, setEvaluations] = useState<Lecture<Evaluation>>(attente);
  const [notes, setNotes] = useState<NoteEvaluation[]>([]);
  const [bons, setBons] = useState<Lecture<Bon>>(attente);
  const [paiements, setPaiements] = useState<Lecture<Paiement>>(attente);
  const [journal, setJournal] = useState<Lecture<JournalFournisseur>>(attente);
  const [categories, setCategories] = useState<string[] | null>(null);
  const [delai, setDelai] = useState<number | null>(null);

  useEffect(() => {
    lire<Fournisseur>(supabase.from('suppliers').select(COLONNES_FOURNISSEUR).eq('id', id), 'fournisseur').then(setFournisseur);
    lire<Contact>(supabase.from('contacts_fournisseurs').select('id, supplier_id, nom, fonction, telephone, email, principal, actif, motif_retrait').eq('supplier_id', id).order('cree_le'), 'contacts')
      .then((r) => setContacts({ ...r, lignes: lignesDe(r.lignes, 'supplier_id', id) }));
    lire<DocFournisseur>(supabase.from('documents_fournisseurs').select('id, supplier_id, type_document, libelle, numero, date_emission, date_expiration, reference_piece, observation, retire_le, motif_retrait').eq('supplier_id', id).order('enregistre_le', { ascending: false }), 'documents')
      .then((r) => setDocuments({ ...r, lignes: lignesDe(r.lignes, 'supplier_id', id) }));
    supabase.from('criteres_evaluation_fournisseur').select('id, libelle, description, poids, actif, ordre').eq('grille', 'fournisseur').order('ordre')
      .then(({ data }) => setCriteres((data ?? []) as Critere[]));
    lire<Evaluation>(supabase.from('evaluations_fournisseurs').select('id, supplier_id, periode_debut, periode_fin, note_globale, commentaire, remplace_id, motif_correction, evalue_le').eq('supplier_id', id).order('evalue_le', { ascending: false }), 'évaluations')
      .then(async (r) => {
        const evs = lignesDe(r.lignes, 'supplier_id', id);
        setEvaluations({ ...r, lignes: evs });
        if (evs && evs.length) {
          const n = await supabase.from('evaluations_fournisseurs_notes').select('id, evaluation_id, libelle, poids, note, observation').in('evaluation_id', evs.map((e) => e.id));
          setNotes(((n.data ?? []) as NoteEvaluation[]).filter((x) => evs.some((e) => e.id === x.evaluation_id)));
        }
      });
    lire<Bon>(supabase.from('purchase_orders').select('id, po_number, po_date, supplier_id, status, total_amount').eq('supplier_id', id).order('po_date', { ascending: false }), 'bons de commande')
      .then(async (r) => {
        const lesBons = lignesDe(r.lignes, 'supplier_id', id);
        setBons({ ...r, lignes: lesBons });
        const ids = (lesBons ?? []).map((b) => b.id);
        if (!voitPaiements || ids.length === 0) { setPaiements({ lignes: [], erreur: '' }); return; }
        const p = await lire<Paiement>(supabase.from('paiements_fournisseur').select('id, numero, purchase_order_id, statut, montant_propose, montant_execute, execute_le, devise').in('purchase_order_id', ids), 'paiements');
        setPaiements({ ...p, lignes: p.lignes && p.lignes.filter((x) => x.purchase_order_id && ids.includes(x.purchase_order_id)) });
      });
    lire<JournalFournisseur>(supabase.from('fournisseurs_journal').select('id, supplier_id, evenement, motif, par, le').eq('supplier_id', id).order('le', { ascending: false }), 'journal du fournisseur')
      .then((r) => setJournal({ ...r, lignes: lignesDe(r.lignes, 'supplier_id', id) }));
    Promise.all([
      supabase.from('fournisseurs_categories').select('supplier_id, categorie_id').eq('supplier_id', id),
      supabase.from('categories_fournisseurs').select('id, libelle, actif'),
    ]).then(([fc, c]) => {
      const libelle = new Map(((c.data ?? []) as Categorie[]).map((x) => [x.id, x.libelle]));
      setCategories(((fc.data ?? []) as { supplier_id: string; categorie_id: string }[]).filter((x) => x.supplier_id === id).map((x) => libelle.get(x.categorie_id) ?? '?'));
    });
    supabase.rpc('delai_alerte_documents_fournisseurs').then(({ data }) => setDelai(typeof data === 'number' ? data : null));
  }, [id, voitPaiements]);

  const f = trouver(fournisseur.lignes, id);
  const grille = criteres.some((c) => c.actif);
  const possible = (a: ActionFournisseur) => Boolean(f) && actionFournisseurInterdite(a, f ?? { active: true }, droits, grille) === null;
  const vers = (a: ActionFournisseur, requete: Record<string, string> = {}) => routeActionFournisseur(id, a, requete);
  const suspendu = f?.active === false;
  const contactsActifs = contacts.lignes && contacts.lignes.filter((c) => c.actif);
  const courantes = evaluations.lignes && evaluations.lignes.filter((e) => !evaluations.lignes?.some((x) => x.remplace_id === e.id));
  const totalCommande = (bons.lignes ?? []).filter((b) => !['draft', 'rejected', 'cancelled'].includes(b.status)).reduce((s, b) => s + (b.total_amount ?? 0), 0);
  const totalPaye = (paiements.lignes ?? []).filter((p) => p.statut === 'execute').reduce((s, p) => s + (p.montant_execute ?? 0), 0);

  const historique = journal.lignes ? fusionnerHistoriques(journal.lignes.map((j) => ({
    id: `fournisseurs_journal-${j.id}`, le: j.le, libelle: EVENEMENTS_FOURNISSEUR[j.evenement] ?? j.evenement, motif: j.motif, auteur: j.par, source: 'fournisseurs_journal',
  }))) : null;

  return (
    <PageDetail
      vue={VUE_FOURNISSEURS}
      module={MODULE_FOURNISSEURS}
      reference={f ? `${f.company_name} · ${f.supplier_number}` : 'Fournisseur'}
      statut={f ? { libelle: suspendu ? 'Suspendu' : 'Actif', teinte: suspendu ? 'rouge' : 'vert' } : null}
      resume={f && <>{TYPES_FOURNISSEUR[f.supplier_type] ?? f.supplier_type}
        {suspendu && <span className="text-red-700"> · suspendu le {f.suspendu_le ? new Date(f.suspendu_le).toLocaleDateString('fr-FR') : 'date non enregistrée'} : {f.motif_suspension}</span>}</>}
      chargement={fournisseur.lignes === null && !fournisseur.erreur}
      erreur={fournisseur.erreur}
      introuvable={fournisseur.lignes !== null && !f}
      actions={[
        { id: 'modifier', libelle: 'Modifier la fiche', icone: <Pencil className="h-4 w-4" />, visible: Boolean(f) && droits.ecrire, vers: routeModifier(VUE_FOURNISSEURS, id) },
        { id: 'contact', libelle: 'Ajouter un contact', icone: <UserPlus className="h-4 w-4" />, visible: possible('contact'), vers: vers('contact') },
        { id: 'document', libelle: 'Ajouter un document', icone: <FilePlus2 className="h-4 w-4" />, visible: possible('document'), vers: vers('document') },
        { id: 'classer', libelle: 'Classer', icone: <Tags className="h-4 w-4" />, visible: possible('classer'), vers: vers('classer') },
        { id: 'evaluer', libelle: 'Évaluer', icone: <Star className="h-4 w-4" />, visible: possible('evaluer'), vers: vers('evaluer') },
        { id: 'suspendre', libelle: 'Suspendre', icone: <Ban className="h-4 w-4" />, visible: possible('suspendre'), ton: 'danger', vers: vers('suspendre') },
        { id: 'reactiver', libelle: 'Réactiver', icone: <RotateCcw className="h-4 w-4" />, visible: possible('reactiver'), ton: 'principal', vers: vers('reactiver') },
      ]}
      onglets={!f ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <Informations groupes={[
            { titre: 'Identité', champs: [['Numéro', f.supplier_number], ['Raison sociale', f.company_name], ['Type', TYPES_FOURNISSEUR[f.supplier_type] ?? f.supplier_type],
              ['Identifiant fiscal', f.identifiant_fiscal], ['Registre du commerce', f.registre_commerce],
              ['Catégories', categories === null ? 'Chargement…' : categories.join(', ') || null]] },
            { titre: 'Coordonnées et conditions', champs: [['Téléphone', f.phone], ['Courriel', f.email], ['Adresse', f.address], ['Ville', f.ville], ['Pays', f.pays],
              ['Conditions de paiement', f.payment_terms], ['Note', f.notes]] },
          ]} />
        ) },
        { id: 'contacts', libelle: 'Contacts', compte: contactsActifs?.length ?? null, contenu: (
          <Relation titre="Contacts" lignes={contactsActifs} erreur={contacts.erreur} cle={(c) => c.id} vide="Aucun contact"
            colonnes={[
              { libelle: 'Nom', valeur: (c) => <>{c.nom}{c.principal && <> <Puce teinte="bleu">Principal</Puce></>}</> },
              { libelle: 'Fonction', valeur: (c) => c.fonction ?? '' },
              { libelle: 'Téléphone', valeur: (c) => c.telephone ?? '' },
              { libelle: 'Courriel', valeur: (c) => c.email ?? '' },
              ...(possible('contact') ? [{ libelle: 'Gestion', valeur: (c: Contact) => (
                <span className="flex gap-2">
                  <a href={vers('contact', { contact: c.id })} aria-label={`Modifier le contact ${c.nom}`} className={LIEN_LIGNE}>Modifier</a>
                  <a href={vers('retirer-contact', { contact: c.id })} aria-label={`Retirer le contact ${c.nom}`} className={LIEN_LIGNE}>Retirer</a>
                </span>
              ) }] : []),
            ]} />
        ) },
        { id: 'documents', libelle: 'Documents', compte: documents.lignes?.filter((d) => !d.retire_le).length ?? null, contenu: (
          <Relation titre="Documents administratifs" lignes={documents.lignes} erreur={documents.erreur} cle={(d) => d.id} vide="Aucun document"
            note={`Métadonnées et référence de la pièce. Alerte ${delai === null ? 'à l\'expiration' : `${delai} jours avant l'expiration (réglage fournisseurs_alerte_documents_jours)`}.`}
            colonnes={[
              { libelle: 'Document', valeur: (d) => <span className={d.retire_le ? 'text-stone-400 line-through' : ''}>{d.type_document === 'autre' ? d.libelle : TYPES_DOCUMENT[d.type_document] ?? d.type_document}</span> },
              { libelle: 'Numéro', valeur: (d) => d.numero ?? '' },
              { libelle: 'Émis le', valeur: (d) => d.date_emission ?? '' },
              { libelle: 'Expire le', valeur: (d) => d.date_expiration ?? '' },
              { libelle: 'Pièce', valeur: (d) => d.reference_piece },
              { libelle: 'État', valeur: (d) => {
                if (d.retire_le) return <span className="text-xs text-stone-500">Retiré : {d.motif_retrait}</span>;
                const e = ETATS_DOCUMENT[etatDocument(d.date_expiration, aujourdhui(), delai ?? 0)];
                return <Puce teinte={e.teinte}>{e.texte}</Puce>;
              } },
              ...(possible('document') ? [{ libelle: 'Gestion', valeur: (d: DocFournisseur) => (d.retire_le ? '' : (
                <a href={vers('retirer-document', { document: d.id })} aria-label={`Retirer le document ${d.reference_piece}`} className={LIEN_LIGNE}>Retirer</a>
              )) }] : []),
            ]} />
        ) },
        { id: 'evaluations', libelle: 'Évaluations', compte: courantes?.length ?? null, contenu: (
          <div className="space-y-3">
            {!grille && <SansDonnees message="Grille d'évaluation non définie" detail="L'administrateur la renseigne dans les référentiels du module." />}
            <Relation titre="Évaluations courantes" lignes={courantes} erreur={evaluations.erreur} cle={(e) => e.id} vide="Aucune évaluation"
              colonnes={[
                { libelle: 'Période', valeur: (e) => `${e.periode_debut} au ${e.periode_fin}` },
                { libelle: 'Note globale', valeur: (e) => `${e.note_globale} / 5` },
                { libelle: 'Détail', valeur: (e) => notes.filter((n) => n.evaluation_id === e.id).map((n) => `${n.libelle} (poids ${n.poids}) : ${n.note}`).join(' ; ') },
                { libelle: 'Commentaire', valeur: (e) => <>{e.commentaire}{e.motif_correction && <span className="block text-xs text-stone-500">Corrige une évaluation précédente : {e.motif_correction}</span>}</> },
              ]} />
          </div>
        ) },
        { id: 'relations', libelle: 'Commandes et paiements', compte: bons.lignes?.length ?? null, contenu: (
          <div className="grid gap-4 xl:grid-cols-2">
            <Relation titre="Bons de commande" lignes={bons.lignes} erreur={bons.erreur} cle={(b) => b.id} vide="Aucun bon de commande"
              note={`Montant engagé (bons soumis et au-delà, hors rejetés et annulés) : ${GNF.format(totalCommande)} GNF`}
              colonnes={[
                { libelle: 'Bon', valeur: (b) => b.po_number },
                { libelle: 'Date', valeur: (b) => b.po_date },
                { libelle: 'Total', valeur: (b) => (b.total_amount === null ? 'Sans données' : `${GNF.format(b.total_amount)} GNF`) },
                { libelle: 'Statut', valeur: (b) => <Puce teinte={STATUTS_BON[b.status]?.teinte ?? 'gris'}>{STATUTS_BON[b.status]?.texte ?? b.status}</Puce> },
              ]} />
            {!voitPaiements ? <SansDonnees message="Paiements non visibles" detail="Lecture réservée aux modules Facturation ou Contrats." />
              : (
                <Relation titre="Paiements" lignes={paiements.lignes} erreur={paiements.erreur} cle={(p) => p.id} vide="Aucun paiement sur les bons de ce fournisseur"
                  note={`Payé (exécuté) : ${GNF.format(totalPaye)} GNF`}
                  colonnes={[
                    { libelle: 'Paiement', valeur: (p) => p.numero },
                    { libelle: 'Bon', valeur: (p) => bons.lignes?.find((b) => b.id === p.purchase_order_id)?.po_number ?? 'Non rattaché' },
                    { libelle: 'Proposé', valeur: (p) => `${GNF.format(p.montant_propose)} ${p.devise}` },
                    { libelle: 'Exécuté', valeur: (p) => (p.montant_execute === null ? '' : `${GNF.format(p.montant_execute)} ${p.devise} le ${p.execute_le}`) },
                    { libelle: 'Statut', valeur: (p) => STATUTS_PAIEMENT[p.statut] ?? p.statut },
                  ]} />
              )}
          </div>
        ) },
        { id: 'historique', libelle: 'Historique', contenu: <Historique evenements={historique} erreur={journal.erreur} source="fournisseurs_journal (création, modification, suspension, contacts, documents, catégories, évaluations)" /> },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="un fournisseur (les documents administratifs portent la référence de la pièce papier)" /> },
      ]}
    />
  );
};
