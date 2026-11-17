import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { PageAction } from '../ui/PageAction';
import { ChampPage } from '../ui/PageFormulaire';
import { SansDonnees } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import type { ExigenceMotif } from '../ui/pages';
import { TYPES_DOCUMENT, noteGlobale, type Categorie, type Fournisseur } from './fournisseurs';
import { COLONNES_FOURNISSEUR, lignesDe, type Contact, type Critere, type DocFournisseur, type Evaluation } from './donnees';
import {
  ACTIONS_FOURNISSEUR, MODULE_FOURNISSEURS, VUE_FOURNISSEURS, actionFournisseurInterdite, type ActionFournisseur,
} from './routes';
import { erreursSaisieContact, erreursSaisieDocument, type SaisieContact, type SaisieDocument } from './saisie';

// Actions d'un fournisseur en pleine page (D-059, D-090, remplace les
// window.prompt et les saisies en ligne) : chacune par sa fonction serveur.
// Motif exige (non vide) par suspendre, reactiver, retirer un contact ou un
// document ; motif de correction exige quand la periode est deja evaluee.

const Erreurs = ({ erreurs }: { erreurs: string[] }) => (erreurs.length === 0 ? null : (
  <ul className="list-disc pl-5 text-xs text-amber-800">{erreurs.map((e) => <li key={e}>{e}</li>)}</ul>
));

export const ActionFournisseurVue = ({ id, action, requete }: { id: string; action: string; requete: Record<string, string> }) => {
  const { hasPermission } = useAuth();
  const droits = { ecrire: hasPermission('purchases', 'create') || hasPermission('purchases', 'edit'), approuver: hasPermission('purchases', 'approve') };
  const [f, setF] = useState<Fournisseur | null>(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [documents, setDocuments] = useState<DocFournisseur[]>([]);
  const [criteres, setCriteres] = useState<Critere[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [contact, setContact] = useState<SaisieContact>({ nom: '', fonction: '', telephone: '', email: '', principal: false });
  const [piece, setPiece] = useState<SaisieDocument>({ type: 'attestation_fiscale', libelle: '', numero: '', emission: '', expiration: '', reference: '', observation: '' });
  const [evaluation, setEvaluation] = useState<{ debut: string; fin: string; commentaire: string; notes: Record<string, string>; observations: Record<string, string> }>(
    { debut: '', fin: '', commentaire: '', notes: {}, observations: {} });
  const [choix, setChoix] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      lire<Fournisseur>(supabase.from('suppliers').select(COLONNES_FOURNISSEUR).eq('id', id), 'fournisseur'),
      lire<Contact>(supabase.from('contacts_fournisseurs').select('id, supplier_id, nom, fonction, telephone, email, principal, actif, motif_retrait').eq('supplier_id', id), 'contacts'),
      lire<DocFournisseur>(supabase.from('documents_fournisseurs').select('id, supplier_id, type_document, libelle, numero, date_emission, date_expiration, reference_piece, observation, retire_le, motif_retrait').eq('supplier_id', id), 'documents'),
      supabase.from('criteres_evaluation_fournisseur').select('id, libelle, description, poids, actif, ordre').eq('grille', 'fournisseur').order('ordre'),
      lire<Evaluation>(supabase.from('evaluations_fournisseurs').select('id, supplier_id, periode_debut, periode_fin, note_globale, commentaire, remplace_id, motif_correction, evalue_le').eq('supplier_id', id), 'évaluations'),
      supabase.from('categories_fournisseurs').select('id, libelle, actif').order('libelle'),
      supabase.from('fournisseurs_categories').select('supplier_id, categorie_id').eq('supplier_id', id),
    ]).then(([fo, ct, dc, cr, ev, ca, fc]) => {
      const x = trouver(fo.lignes, id);
      setF(x);
      const lesContacts = lignesDe(ct.lignes, 'supplier_id', id) ?? [];
      setContacts(lesContacts);
      setDocuments(lignesDe(dc.lignes, 'supplier_id', id) ?? []);
      setCriteres((cr.data ?? []) as Critere[]);
      setEvaluations(lignesDe(ev.lignes, 'supplier_id', id) ?? []);
      setCategories((ca.data ?? []) as Categorie[]);
      const cl = ((fc.data ?? []) as { supplier_id: string; categorie_id: string }[]).filter((k) => k.supplier_id === id).map((k) => k.categorie_id);
      setClasses(cl);
      setChoix(cl);
      const c = requete.contact ? lesContacts.find((k) => k.id === requete.contact) : null;
      if (c) setContact({ nom: c.nom, fonction: c.fonction ?? '', telephone: c.telephone ?? '', email: c.email ?? '', principal: c.principal });
      setErreur(fo.erreur || ct.erreur || dc.erreur || ev.erreur || (x ? '' : 'Fournisseur introuvable ou non visible avec vos droits.'));
      setChargement(false);
    });
  }, [id, requete.contact]);

  if (!(ACTIONS_FOURNISSEUR as readonly string[]).includes(action)) {
    return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action d'un fournisseur.`} />;
  }
  const a = action as ActionFournisseur;
  const actifs = criteres.filter((c) => c.actif);
  const commun = { vue: VUE_FOURNISSEURS, module: MODULE_FOURNISSEURS, reference: f ? f.company_name : 'Fournisseur', id, chargement, erreurChargement: erreur };
  const interditEtat = f ? actionFournisseurInterdite(a, f, droits, actifs.length > 0) : null;
  const nom = f?.company_name ?? 'ce fournisseur';

  const contactCible = requete.contact ? contacts.find((c) => c.id === requete.contact && c.actif) ?? null : null;
  const documentCible = requete.document ? documents.find((d) => d.id === requete.document && !d.retire_le) ?? null : null;
  const courantes = evaluations.filter((e) => !evaluations.some((x) => x.remplace_id === e.id));
  const dejaEvaluee = Boolean(evaluation.debut && evaluation.fin) && courantes.some((e) => e.periode_debut === evaluation.debut && e.periode_fin === evaluation.fin);
  const apercu = noteGlobale(actifs.map((c) => ({ note: evaluation.notes[c.id] ? Number(evaluation.notes[c.id]) : null, poids: c.poids })));
  const categoriesAffichees = categories.filter((c) => c.actif || classes.includes(c.id));

  const erreursContact = erreursSaisieContact(contact);
  const erreursDocument = erreursSaisieDocument(piece);
  const erreursEvaluation = [
    ...(!evaluation.debut || !evaluation.fin ? ['Période obligatoire.'] : []),
    ...(evaluation.debut && evaluation.fin && evaluation.fin < evaluation.debut ? ['La fin de période précède le début.'] : []),
    ...(apercu === null ? ['Une note de 1 à 5 par critère.'] : []),
  ];

  const definition: Record<ActionFournisseur, {
    titre: string; confirmer: string; succes: string; description: ReactNode; motif: ExigenceMotif; danger?: boolean; pret?: boolean; interdit?: string | null;
    executer: (motif: string) => PromiseLike<{ error: { message: string } | null }>; champs?: ReactNode;
  }> = {
    suspendre: {
      titre: `Suspendre ${nom}`, confirmer: 'Suspendre', danger: true, motif: 'obligatoire',
      succes: 'Fournisseur suspendu : plus aucun bon de commande ne peut lui être adressé.',
      description: 'Un fournisseur suspendu ne peut plus recevoir de bon de commande ni être consulté. Le motif est conservé sur la fiche et au journal.',
      executer: (motif) => supabase.rpc('suspendre_fournisseur', { p_id: id, p_motif: motif }),
    },
    reactiver: {
      titre: `Réactiver ${nom}`, confirmer: 'Réactiver', motif: 'obligatoire', succes: 'Fournisseur réactivé.',
      description: 'Le fournisseur peut de nouveau recevoir des bons de commande. Le motif est conservé au journal.',
      executer: (motif) => supabase.rpc('reactiver_fournisseur', { p_id: id, p_motif: motif }),
    },
    contact: {
      titre: contactCible ? `Modifier le contact ${contactCible.nom}` : 'Ajouter un contact', confirmer: 'Enregistrer le contact', motif: 'aucun',
      succes: 'Contact enregistré.', pret: erreursContact.length === 0,
      interdit: requete.contact && !chargement && !contactCible ? 'Contact introuvable ou retiré.' : null,
      description: 'Un contact porte un téléphone ou un courriel. Un seul contact principal par fournisseur.',
      executer: () => supabase.rpc('enregistrer_contact_fournisseur', {
        p_fournisseur: id, p_id: contactCible?.id ?? null, p_nom: contact.nom.trim() || null, p_fonction: contact.fonction.trim() || null,
        p_telephone: contact.telephone.trim() || null, p_email: contact.email.trim() || null, p_principal: contact.principal,
      }),
      champs: (
        <div className="grid gap-4 sm:grid-cols-2">
          {(['nom', 'fonction', 'telephone', 'email'] as const).map((k) => (
            <ChampPage key={k} libelle={{ nom: 'Nom *', fonction: 'Fonction', telephone: 'Téléphone', email: 'Courriel' }[k]}>
              <input type={k === 'email' ? 'email' : k === 'telephone' ? 'tel' : 'text'} value={contact[k]} onChange={(e) => setContact({ ...contact, [k]: e.target.value })} className={CHAMP_FENETRE} />
            </ChampPage>
          ))}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={contact.principal} onChange={(e) => setContact({ ...contact, principal: e.target.checked })} />Contact principal</label>
          <div className="sm:col-span-2"><Erreurs erreurs={erreursContact} /></div>
        </div>
      ),
    },
    'retirer-contact': {
      titre: `Retirer le contact ${contactCible?.nom ?? ''}`.trim(), confirmer: 'Retirer le contact', danger: true, motif: 'obligatoire', succes: 'Contact retiré.',
      interdit: !chargement && !contactCible ? 'Contact introuvable ou déjà retiré.' : null,
      description: 'Le contact n\'est pas supprimé : il est marqué retiré, avec son motif.',
      executer: (motif) => supabase.rpc('retirer_contact_fournisseur', { p_id: contactCible?.id, p_motif: motif }),
    },
    document: {
      titre: 'Ajouter un document administratif', confirmer: 'Enregistrer le document', motif: 'aucun', succes: 'Document enregistré.', pret: erreursDocument.length === 0,
      description: 'Métadonnées et référence de la pièce papier ou GED ; le dépôt de fichier n\'est pas pris en charge pour les fournisseurs (D-083).',
      executer: () => supabase.rpc('enregistrer_document_fournisseur', {
        p_fournisseur: id, p_type: piece.type, p_reference_piece: piece.reference.trim() || null, p_numero: piece.numero.trim() || null,
        p_date_emission: piece.emission || null, p_date_expiration: piece.expiration || null, p_libelle: piece.libelle.trim() || null,
        p_observation: piece.observation.trim() || null,
      }),
      champs: (
        <div className="grid gap-4 sm:grid-cols-2">
          <ChampPage libelle="Type *">
            <select value={piece.type} onChange={(e) => setPiece({ ...piece, type: e.target.value })} className={CHAMP_FENETRE}>
              {Object.entries(TYPES_DOCUMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </ChampPage>
          {piece.type === 'autre' && <ChampPage libelle="Libellé *"><input value={piece.libelle} onChange={(e) => setPiece({ ...piece, libelle: e.target.value })} className={CHAMP_FENETRE} /></ChampPage>}
          <ChampPage libelle="Numéro"><input value={piece.numero} onChange={(e) => setPiece({ ...piece, numero: e.target.value })} className={CHAMP_FENETRE} /></ChampPage>
          <ChampPage libelle="Date d'émission"><input type="date" value={piece.emission} onChange={(e) => setPiece({ ...piece, emission: e.target.value })} className={CHAMP_FENETRE} /></ChampPage>
          <ChampPage libelle="Date d'expiration"><input type="date" value={piece.expiration} onChange={(e) => setPiece({ ...piece, expiration: e.target.value })} className={CHAMP_FENETRE} /></ChampPage>
          <ChampPage libelle="Référence de la pièce *"><input placeholder="Classeur, dossier, référence GED" value={piece.reference} onChange={(e) => setPiece({ ...piece, reference: e.target.value })} className={CHAMP_FENETRE} /></ChampPage>
          <ChampPage libelle="Observation" className="sm:col-span-2"><input value={piece.observation} onChange={(e) => setPiece({ ...piece, observation: e.target.value })} className={CHAMP_FENETRE} /></ChampPage>
          <div className="sm:col-span-2"><Erreurs erreurs={erreursDocument} /></div>
        </div>
      ),
    },
    'retirer-document': {
      titre: 'Retirer un document', confirmer: 'Retirer le document', danger: true, motif: 'obligatoire', succes: 'Document retiré.',
      interdit: !chargement && !documentCible ? 'Document introuvable ou déjà retiré.' : null,
      description: documentCible ? <>Document <b>{documentCible.type_document === 'autre' ? documentCible.libelle : TYPES_DOCUMENT[documentCible.type_document] ?? documentCible.type_document}</b> (pièce {documentCible.reference_piece}). Il reste visible, barré, avec son motif.</> : null,
      executer: (motif) => supabase.rpc('retirer_document_fournisseur', { p_id: documentCible?.id, p_motif: motif }),
    },
    evaluer: {
      titre: `Évaluer ${nom}`, confirmer: 'Enregistrer l\'évaluation', motif: dejaEvaluee ? 'obligatoire' : 'aucun', succes: 'Évaluation enregistrée.',
      pret: erreursEvaluation.length === 0,
      description: dejaEvaluee
        ? 'Cette période est déjà évaluée : la nouvelle évaluation la corrige, le motif de la correction est obligatoire.'
        : 'Une note de 1 à 5 par critère ; la note globale pondérée est recalculée par le serveur.',
      executer: (motif) => supabase.rpc('evaluer_fournisseur', {
        p_fournisseur: id, p_debut: evaluation.debut, p_fin: evaluation.fin,
        p_notes: actifs.map((c) => ({ critere: c.id, note: Number(evaluation.notes[c.id]), observation: evaluation.observations[c.id]?.trim() || null })),
        p_commentaire: evaluation.commentaire.trim() || null, p_motif_correction: dejaEvaluee ? motif : null,
      }),
      champs: (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <ChampPage libelle="Début de la période *"><input type="date" value={evaluation.debut} onChange={(e) => setEvaluation({ ...evaluation, debut: e.target.value })} className={CHAMP_FENETRE} /></ChampPage>
            <ChampPage libelle="Fin de la période *"><input type="date" value={evaluation.fin} onChange={(e) => setEvaluation({ ...evaluation, fin: e.target.value })} className={CHAMP_FENETRE} /></ChampPage>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-stone-500"><th className="py-1 pr-2">Critère</th><th className="py-1 pr-2">Poids</th><th className="py-1 pr-2">Note (1 à 5)</th><th className="py-1 pr-2">Observation</th></tr></thead>
            <tbody>{actifs.map((c) => (
              <tr key={c.id}>
                <td className="py-1 pr-2">{c.libelle}</td><td className="py-1 pr-2">{c.poids}</td>
                <td className="py-1 pr-2">
                  <select aria-label={`Note ${c.libelle}`} value={evaluation.notes[c.id] ?? ''} onChange={(e) => setEvaluation({ ...evaluation, notes: { ...evaluation.notes, [c.id]: e.target.value } })} className={CHAMP_FENETRE}>
                    <option value="">Choisir</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </td>
                <td className="py-1 pr-2"><input aria-label={`Observation ${c.libelle}`} value={evaluation.observations[c.id] ?? ''} onChange={(e) => setEvaluation({ ...evaluation, observations: { ...evaluation.observations, [c.id]: e.target.value } })} className={CHAMP_FENETRE} /></td>
              </tr>
            ))}</tbody>
          </table>
          <ChampPage libelle="Commentaire"><input value={evaluation.commentaire} onChange={(e) => setEvaluation({ ...evaluation, commentaire: e.target.value })} className={CHAMP_FENETRE} /></ChampPage>
          <p className="text-sm">Note globale pondérée : <b>{apercu === null ? 'notes incomplètes' : `${apercu} / 5`}</b> (recalculée par le serveur)</p>
          <Erreurs erreurs={erreursEvaluation} />
        </div>
      ),
    },
    classer: {
      titre: `Classer ${nom}`, confirmer: 'Enregistrer les catégories', motif: 'aucun', succes: 'Catégories enregistrées.',
      interdit: !chargement && categoriesAffichees.length === 0 ? 'Référentiel des catégories vide : l\'administrateur le renseigne dans les référentiels du module.' : null,
      description: 'Les catégories servent au filtre du répertoire et aux consultations.',
      executer: () => supabase.rpc('classer_fournisseur', { p_fournisseur: id, p_categories: choix }),
      champs: (
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <legend className="mb-2 font-medium text-stone-700">Catégories</legend>
          {categoriesAffichees.map((c) => (
            <label key={c.id} className="flex items-center gap-1">
              <input type="checkbox" checked={choix.includes(c.id)} onChange={(e) => setChoix(e.target.checked ? [...choix, c.id] : choix.filter((x) => x !== c.id))} />
              {c.libelle}{!c.actif && ' (inactive)'}
            </label>
          ))}
        </fieldset>
      ),
    },
  };
  const d = definition[a];

  return (
    <PageAction
      {...commun}
      titre={d.titre}
      description={d.description}
      motif={d.motif}
      motifMinimum={1}
      libelleConfirmer={d.confirmer}
      danger={d.danger}
      interdit={interditEtat ?? d.interdit ?? null}
      pret={d.pret ?? true}
      messageSucces={d.succes}
      onExecuter={async (motif) => {
        const { error } = await d.executer(motif);
        return error ? error.message : null;
      }}
    >
      {d.champs}
    </PageAction>
  );
};
