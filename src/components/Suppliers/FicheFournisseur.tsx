import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import { STATUTS_BON, type StatutBon } from '../Purchases/achats';
import {
  CHAMP, ETATS_DOCUMENT, TYPES_DOCUMENT, TYPES_FOURNISSEUR, etatDocument, noteGlobale, type Categorie, type Fournisseur,
} from './fournisseurs';


// Fiche detaillee d'un fournisseur (D-059) : identite, contacts,
// categories, documents, evaluations, historique des commandes et des
// paiements, journal.

interface Contact { id: string; supplier_id: string; nom: string; fonction: string | null; telephone: string | null; email: string | null; principal: boolean; actif: boolean; motif_retrait: string | null }
interface DocFournisseur { id: string; supplier_id: string; type_document: string; libelle: string | null; numero: string | null; date_emission: string | null; date_expiration: string | null; reference_piece: string; observation: string | null; retire_le: string | null; motif_retrait: string | null }
interface Critere { id: string; libelle: string; poids: number; actif: boolean; ordre: number }
interface Evaluation { id: string; supplier_id: string; periode_debut: string; periode_fin: string; note_globale: number; commentaire: string | null; remplace_id: string | null; motif_correction: string | null; evalue_le: string }
interface NoteEvaluation { id: string; evaluation_id: string; libelle: string; poids: number; note: number; observation: string | null }
interface Bon { id: string; po_number: string; po_date: string; supplier_id: string; status: StatutBon; total_amount: number | null }
interface Paiement { id: string; numero: string; purchase_order_id: string | null; statut: string; montant_propose: number; montant_execute: number | null; execute_le: string | null; devise: string }
interface Evenement { id: string; supplier_id: string; evenement: string; motif: string | null; le: string }

const GNF = new Intl.NumberFormat('fr-FR');
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const STATUTS_PAIEMENT: Record<string, string> = { propose: 'Proposé', approuve: 'Approuvé', rejete: 'Rejeté', execute: 'Exécuté', annule: 'Annulé' };

export const FicheFournisseur = ({ fournisseur: f, categories, onModifier, onChange, onFermer }: {
  fournisseur: Fournisseur; categories: Categorie[]; onModifier: () => void; onChange: () => Promise<void>; onFermer: () => void;
}) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('purchases', 'create') || hasPermission('purchases', 'edit');
  const peutApprouver = hasPermission('purchases', 'approve');
  const voitPaiements = hasPermission('invoices', 'view') || hasPermission('contracts', 'view');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [documents, setDocuments] = useState<DocFournisseur[]>([]);
  const [criteres, setCriteres] = useState<Critere[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [notes, setNotes] = useState<NoteEvaluation[]>([]);
  const [bons, setBons] = useState<Bon[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [journal, setJournal] = useState<Evenement[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [delai, setDelai] = useState<number | null>(null);
  const [contact, setContact] = useState<Record<string, string> | null>(null);
  const [piece, setPiece] = useState<Record<string, string> | null>(null);
  const [evaluation, setEvaluation] = useState<Record<string, string> | null>(null);
  const [choixCategories, setChoixCategories] = useState<string[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const pour = <T extends { supplier_id: string }>(x: { data: unknown }) => ((x.data ?? []) as T[]).filter((r) => r.supplier_id === f.id);
    const [c, d, cr, ev, b, j, fc, dl] = await Promise.all([
      supabase.from('contacts_fournisseurs').select('*').eq('supplier_id', f.id).order('cree_le'),
      supabase.from('documents_fournisseurs').select('*').eq('supplier_id', f.id).order('enregistre_le', { ascending: false }),
      supabase.from('criteres_evaluation_fournisseur').select('id, libelle, poids, actif, ordre').order('ordre'),
      supabase.from('evaluations_fournisseurs').select('*').eq('supplier_id', f.id).order('evalue_le', { ascending: false }),
      supabase.from('purchase_orders').select('id, po_number, po_date, supplier_id, status, total_amount').eq('supplier_id', f.id).order('po_date', { ascending: false }),
      supabase.from('fournisseurs_journal').select('id, supplier_id, evenement, motif, le').eq('supplier_id', f.id).order('le', { ascending: false }),
      supabase.from('fournisseurs_categories').select('supplier_id, categorie_id').eq('supplier_id', f.id),
      supabase.rpc('delai_alerte_documents_fournisseurs'),
    ]);
    const evs = pour<Evaluation>(ev);
    const lesBons = pour<Bon>(b);
    setContacts(pour<Contact>(c));
    setDocuments(pour<DocFournisseur>(d));
    setCriteres((cr.data ?? []) as Critere[]);
    setEvaluations(evs);
    setBons(lesBons);
    setJournal(pour<Evenement>(j));
    setClasses(pour<{ supplier_id: string; categorie_id: string }>(fc).map((x) => x.categorie_id));
    setDelai(typeof dl.data === 'number' ? dl.data : null);
    const n = evs.length ? await supabase.from('evaluations_fournisseurs_notes').select('*').in('evaluation_id', evs.map((e) => e.id)) : { data: [] };
    setNotes(((n.data ?? []) as NoteEvaluation[]).filter((x) => evs.some((e) => e.id === x.evaluation_id)));
    const ids = lesBons.map((x) => x.id);
    const p = voitPaiements && ids.length
      ? await supabase.from('paiements_fournisseur').select('id, numero, purchase_order_id, statut, montant_propose, montant_execute, execute_le, devise').in('purchase_order_id', ids)
      : { data: [] };
    setPaiements(((p.data ?? []) as Paiement[]).filter((x) => x.purchase_order_id && ids.includes(x.purchase_order_id)));
  }, [f.id, voitPaiements]);
  useEffect(() => { setContact(null); setPiece(null); setEvaluation(null); setChoixCategories(null); setErreur(''); setMessage(''); charger(); }, [charger]);

  const executer = async (fonction: string, args: Record<string, unknown>, succes: string) => {
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await supabase.rpc(fonction, args);
    setBusy(false);
    if (error) { setErreur(error.message); return false; }
    setMessage(succes);
    await Promise.all([charger(), onChange()]);
    return true;
  };
  const motif = (question: string) => { const m = window.prompt(question); return m?.trim() ? m.trim() : null; };

  const suspendu = f.active === false;
  const suspendre = () => { const m = motif(`Motif de la suspension de ${f.company_name}`); if (m) executer('suspendre_fournisseur', { p_id: f.id, p_motif: m }, 'Fournisseur suspendu : plus aucun bon de commande ne peut lui être adressé.'); };
  const reactiver = () => { const m = motif(`Motif de la réactivation de ${f.company_name}`); if (m) executer('reactiver_fournisseur', { p_id: f.id, p_motif: m }, 'Fournisseur réactivé.'); };

  const enregistrerContact = () => {
    if (!contact) return;
    executer('enregistrer_contact_fournisseur', {
      p_fournisseur: f.id, p_id: contact.id || null, p_nom: contact.nom?.trim() || null, p_fonction: contact.fonction?.trim() || null,
      p_telephone: contact.telephone?.trim() || null, p_email: contact.email?.trim() || null, p_principal: contact.principal === 'oui',
    }, 'Contact enregistré.').then((ok) => { if (ok) setContact(null); });
  };
  const retirerContact = (c: Contact) => { const m = motif(`Motif du retrait du contact ${c.nom}`); if (m) executer('retirer_contact_fournisseur', { p_id: c.id, p_motif: m }, 'Contact retiré.'); };

  const enregistrerDocument = () => {
    if (!piece) return;
    executer('enregistrer_document_fournisseur', {
      p_fournisseur: f.id, p_type: piece.type, p_reference_piece: piece.reference?.trim() || null, p_numero: piece.numero?.trim() || null,
      p_date_emission: piece.emission || null, p_date_expiration: piece.expiration || null, p_libelle: piece.libelle?.trim() || null,
      p_observation: piece.observation?.trim() || null,
    }, 'Document enregistré.').then((ok) => { if (ok) setPiece(null); });
  };
  const retirerDocument = (d: DocFournisseur) => { const m = motif('Motif du retrait du document'); if (m) executer('retirer_document_fournisseur', { p_id: d.id, p_motif: m }, 'Document retiré.'); };

  const actifs = criteres.filter((c) => c.actif);
  const courantes = evaluations.filter((e) => !evaluations.some((x) => x.remplace_id === e.id));
  const dejaEvaluee = !!evaluation && courantes.some((e) => e.periode_debut === evaluation.debut && e.periode_fin === evaluation.fin);
  const apercu = evaluation ? noteGlobale(actifs.map((c) => ({ note: evaluation[`note_${c.id}`] ? Number(evaluation[`note_${c.id}`]) : null, poids: c.poids }))) : null;
  const evaluer = () => {
    if (!evaluation) return;
    executer('evaluer_fournisseur', {
      p_fournisseur: f.id, p_debut: evaluation.debut, p_fin: evaluation.fin,
      p_notes: actifs.map((c) => ({ critere: c.id, note: Number(evaluation[`note_${c.id}`]), observation: evaluation[`obs_${c.id}`]?.trim() || null })),
      p_commentaire: evaluation.commentaire?.trim() || null, p_motif_correction: evaluation.motif?.trim() || null,
    }, 'Évaluation enregistrée.').then((ok) => { if (ok) setEvaluation(null); });
  };

  const categoriesAffichees = useMemo(() => categories.filter((c) => c.actif || classes.includes(c.id)), [categories, classes]);

  const totalCommande = bons.filter((b) => !['draft', 'rejected', 'cancelled'].includes(b.status)).reduce((s, b) => s + (b.total_amount ?? 0), 0);
  const totalPaye = paiements.filter((p) => p.statut === 'execute').reduce((s, p) => s + (p.montant_execute ?? 0), 0);

  return <Panneau titre={`${f.company_name} · ${f.supplier_number}`} action={<button onClick={onFermer} className="rounded border border-stone-300 px-3 py-1 text-xs">Fermer la fiche</button>}>
    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
      <Puce teinte={suspendu ? 'rouge' : 'vert'}>{suspendu ? 'Suspendu' : 'Actif'}</Puce>
      <span>{TYPES_FOURNISSEUR[f.supplier_type] ?? f.supplier_type}</span>
      {suspendu && <span className="text-red-700">Suspendu le {f.suspendu_le ? new Date(f.suspendu_le).toLocaleDateString('fr-FR') : '?'} : {f.motif_suspension}</span>}
    </div>
    <div className="mb-4 flex flex-wrap gap-2">
      {peutEcrire && <button onClick={onModifier} className="rounded border border-stone-300 px-3 py-1 text-xs">Modifier la fiche</button>}
      {peutApprouver && !suspendu && <button onClick={suspendre} className="rounded border border-red-300 px-3 py-1 text-xs text-red-700">Suspendre</button>}
      {peutApprouver && suspendu && <button onClick={reactiver} className="rounded border border-green-300 px-3 py-1 text-xs text-green-800">Réactiver</button>}
    </div>
    {erreur && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}

    <section aria-label="Identité" className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 xl:grid-cols-3">
      {([['Téléphone', f.phone], ['Courriel', f.email], ['Adresse', f.address], ['Ville', f.ville], ['Pays', f.pays],
        ['Identifiant fiscal', f.identifiant_fiscal], ['Registre du commerce', f.registre_commerce], ['Conditions de paiement', f.payment_terms], ['Note', f.notes]] as [string, string | null][])
        .map(([k, v]) => <p key={k}><span className="text-stone-500">{k} : </span>{v || <span className="text-stone-400">Non renseigné</span>}</p>)}
    </section>

    <h3 className="mt-5 text-sm font-bold">Contacts</h3>
    {contacts.filter((c) => c.actif).length === 0 ? <SansDonnees message="Aucun contact" /> :
      <ul className="divide-y divide-stone-100 text-sm">{contacts.filter((c) => c.actif).map((c) => <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
        <span><b>{c.nom}</b>{c.fonction && ` · ${c.fonction}`}{c.telephone && ` · ${c.telephone}`}{c.email && ` · ${c.email}`} {c.principal && <Puce teinte="bleu">Principal</Puce>}</span>
        {peutEcrire && <span className="flex gap-1">
          <button onClick={() => setContact({ id: c.id, nom: c.nom, fonction: c.fonction ?? '', telephone: c.telephone ?? '', email: c.email ?? '', principal: c.principal ? 'oui' : 'non' })} className="rounded border border-stone-300 px-2 py-1 text-xs">Modifier</button>
          <button onClick={() => retirerContact(c)} aria-label={`Retirer le contact ${c.nom}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Retirer</button></span>}
      </li>)}</ul>}
    {peutEcrire && !contact && <button onClick={() => setContact({ principal: 'non' })} className="mt-2 rounded border border-stone-300 px-3 py-1 text-xs">Ajouter un contact</button>}
    {contact && <div role="form" aria-label="Saisie contact" className="mt-2 grid gap-2 rounded-lg bg-stone-50 p-3 sm:grid-cols-2 xl:grid-cols-5">
      {(['nom', 'fonction', 'telephone', 'email'] as const).map((k) => <label key={k} className="text-sm">{{ nom: 'Nom *', fonction: 'Fonction', telephone: 'Téléphone', email: 'Courriel' }[k]}
        <input value={contact[k] ?? ''} onChange={(e) => setContact({ ...contact, [k]: e.target.value })} className={CHAMP} /></label>)}
      <label className="text-sm">Principal<select value={contact.principal ?? 'non'} onChange={(e) => setContact({ ...contact, principal: e.target.value })} className={CHAMP}><option value="non">Non</option><option value="oui">Oui</option></select></label>
      <div className="flex gap-2 sm:col-span-2 xl:col-span-5">
        <button disabled={busy || !contact.nom?.trim() || (!contact.telephone?.trim() && !contact.email?.trim())} onClick={enregistrerContact} className="rounded-lg bg-orange-700 px-3 py-1 text-xs font-bold text-white disabled:opacity-50">Enregistrer le contact</button>
        <button onClick={() => setContact(null)} className="rounded-lg border border-stone-300 px-3 py-1 text-xs">Annuler</button>
      </div>
    </div>}

    <h3 className="mt-5 text-sm font-bold">Catégories</h3>
    {choixCategories === null
      ? <p className="text-sm">{classes.map((id) => categories.find((c) => c.id === id)?.libelle ?? '?').join(', ') || <span className="text-stone-400">Aucune catégorie</span>}
        {peutEcrire && categoriesAffichees.length > 0 && <button onClick={() => setChoixCategories(classes)} className="ml-2 rounded border border-stone-300 px-2 py-1 text-xs">Classer</button>}
        {categoriesAffichees.length === 0 && <span className="ml-2 text-xs text-stone-500">Référentiel vide : onglet Référentiels.</span>}</p>
      : <div className="flex flex-wrap items-center gap-3 text-sm">{categoriesAffichees.map((c) => <label key={c.id} className="flex items-center gap-1">
          <input type="checkbox" checked={choixCategories.includes(c.id)} onChange={(e) => setChoixCategories(e.target.checked ? [...choixCategories, c.id] : choixCategories.filter((x) => x !== c.id))} />{c.libelle}</label>)}
        <button disabled={busy} onClick={() => executer('classer_fournisseur', { p_fournisseur: f.id, p_categories: choixCategories }, 'Catégories enregistrées.').then((ok) => { if (ok) setChoixCategories(null); })} className="rounded-lg bg-orange-700 px-3 py-1 text-xs font-bold text-white">Enregistrer les catégories</button>
        <button onClick={() => setChoixCategories(null)} className="rounded-lg border border-stone-300 px-3 py-1 text-xs">Annuler</button></div>}

    <h3 className="mt-5 text-sm font-bold">Documents administratifs</h3>
    <p className="text-xs text-stone-500">Métadonnées et référence de la pièce (le dépôt de fichiers n'est pas disponible). Alerte {delai === null ? 'à l\'expiration' : `${delai} jours avant l'expiration (réglage fournisseurs_alerte_documents_jours)`}.</p>
    {documents.length === 0 ? <SansDonnees message="Aucun document" /> :
      <table className="mt-2 w-full text-sm"><thead><tr className="border-b text-left text-stone-500"><th className="py-2 pr-3">Document</th><th className="py-2 pr-3">Numéro</th><th className="py-2 pr-3">Émis le</th><th className="py-2 pr-3">Expire le</th><th className="py-2 pr-3">Pièce</th><th className="py-2 pr-3">État</th><th /></tr></thead>
        <tbody>{documents.map((d) => { const etat = etatDocument(d.date_expiration, aujourdhui(), delai ?? 0);
          return <tr key={d.id} className={`border-b border-stone-100 ${d.retire_le ? 'text-stone-400 line-through' : ''}`}>
            <td className="py-2 pr-3">{d.type_document === 'autre' ? d.libelle : TYPES_DOCUMENT[d.type_document] ?? d.type_document}{d.retire_le && <span className="block text-xs no-underline">Retiré : {d.motif_retrait}</span>}</td>
            <td className="py-2 pr-3">{d.numero ?? '-'}</td><td className="py-2 pr-3">{d.date_emission ?? '-'}</td><td className="py-2 pr-3">{d.date_expiration ?? '-'}</td>
            <td className="py-2 pr-3">{d.reference_piece}</td>
            <td className="py-2 pr-3">{!d.retire_le && <Puce teinte={ETATS_DOCUMENT[etat].teinte}>{ETATS_DOCUMENT[etat].texte}</Puce>}</td>
            <td className="py-2">{peutEcrire && !d.retire_le && <button onClick={() => retirerDocument(d)} className="rounded border border-stone-300 px-2 py-1 text-xs">Retirer</button>}</td>
          </tr>; })}</tbody></table>}
    {peutEcrire && !piece && <button onClick={() => setPiece({ type: 'attestation_fiscale' })} className="mt-2 rounded border border-stone-300 px-3 py-1 text-xs">Ajouter un document</button>}
    {piece && <div role="form" aria-label="Saisie document" className="mt-2 grid gap-2 rounded-lg bg-stone-50 p-3 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-sm">Type *<select value={piece.type} onChange={(e) => setPiece({ ...piece, type: e.target.value })} className={CHAMP}>
        {Object.entries(TYPES_DOCUMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      {piece.type === 'autre' && <label className="text-sm">Libellé *<input value={piece.libelle ?? ''} onChange={(e) => setPiece({ ...piece, libelle: e.target.value })} className={CHAMP} /></label>}
      <label className="text-sm">Numéro<input value={piece.numero ?? ''} onChange={(e) => setPiece({ ...piece, numero: e.target.value })} className={CHAMP} /></label>
      <label className="text-sm">Date d'émission<input type="date" value={piece.emission ?? ''} onChange={(e) => setPiece({ ...piece, emission: e.target.value })} className={CHAMP} /></label>
      <label className="text-sm">Date d'expiration<input type="date" value={piece.expiration ?? ''} onChange={(e) => setPiece({ ...piece, expiration: e.target.value })} className={CHAMP} /></label>
      <label className="text-sm">Référence de la pièce *<input placeholder="Classeur, dossier, référence GED" value={piece.reference ?? ''} onChange={(e) => setPiece({ ...piece, reference: e.target.value })} className={CHAMP} /></label>
      <label className="text-sm sm:col-span-2">Observation<input value={piece.observation ?? ''} onChange={(e) => setPiece({ ...piece, observation: e.target.value })} className={CHAMP} /></label>
      <div className="flex gap-2 sm:col-span-2 xl:col-span-4">
        <button disabled={busy || !piece.reference?.trim() || (piece.type === 'autre' && !piece.libelle?.trim())} onClick={enregistrerDocument} className="rounded-lg bg-orange-700 px-3 py-1 text-xs font-bold text-white disabled:opacity-50">Enregistrer le document</button>
        <button onClick={() => setPiece(null)} className="rounded-lg border border-stone-300 px-3 py-1 text-xs">Annuler</button>
      </div>
    </div>}

    <h3 className="mt-5 text-sm font-bold">Évaluations</h3>
    {courantes.length === 0 ? <SansDonnees message="Aucune évaluation" /> :
      <ul className="divide-y divide-stone-100 text-sm">{courantes.map((e) => <li key={e.id} className="py-2">
        <b>{e.note_globale} / 5</b> · {e.periode_debut} au {e.periode_fin}{e.commentaire && ` · ${e.commentaire}`}
        {e.motif_correction && <span className="block text-xs text-stone-500">Corrige une évaluation précédente : {e.motif_correction}</span>}
        <span className="block text-xs text-stone-500">{notes.filter((n) => n.evaluation_id === e.id).map((n) => `${n.libelle} (poids ${n.poids}) : ${n.note}`).join(' ; ')}</span>
      </li>)}</ul>}
    {peutEcrire && !evaluation && (actifs.length === 0
      ? <p className="mt-2 text-xs text-stone-500">Grille d'évaluation non définie : l'administrateur la renseigne dans l'onglet Référentiels.</p>
      : <button onClick={() => setEvaluation({})} className="mt-2 rounded border border-stone-300 px-3 py-1 text-xs">Évaluer</button>)}
    {evaluation && <div role="form" aria-label="Saisie évaluation" className="mt-2 space-y-2 rounded-lg bg-stone-50 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm">Début de la période *<input type="date" value={evaluation.debut ?? ''} onChange={(e) => setEvaluation({ ...evaluation, debut: e.target.value })} className={CHAMP} /></label>
        <label className="text-sm">Fin de la période *<input type="date" value={evaluation.fin ?? ''} onChange={(e) => setEvaluation({ ...evaluation, fin: e.target.value })} className={CHAMP} /></label>
      </div>
      <table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500"><th className="py-1 pr-2">Critère</th><th className="py-1 pr-2">Poids</th><th className="py-1 pr-2">Note (1 à 5)</th><th className="py-1 pr-2">Observation</th></tr></thead>
        <tbody>{actifs.map((c) => <tr key={c.id}><td className="py-1 pr-2">{c.libelle}</td><td className="py-1 pr-2">{c.poids}</td>
          <td className="py-1 pr-2"><select aria-label={`Note ${c.libelle}`} value={evaluation[`note_${c.id}`] ?? ''} onChange={(e) => setEvaluation({ ...evaluation, [`note_${c.id}`]: e.target.value })} className={CHAMP}>
            <option value="">Choisir</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></td>
          <td className="py-1 pr-2"><input aria-label={`Observation ${c.libelle}`} value={evaluation[`obs_${c.id}`] ?? ''} onChange={(e) => setEvaluation({ ...evaluation, [`obs_${c.id}`]: e.target.value })} className={CHAMP} /></td></tr>)}</tbody></table>
      <label className="block text-sm">Commentaire<input value={evaluation.commentaire ?? ''} onChange={(e) => setEvaluation({ ...evaluation, commentaire: e.target.value })} className={CHAMP} /></label>
      {dejaEvaluee && <label className="block text-sm">Motif de la correction * (période déjà évaluée)<input value={evaluation.motif ?? ''} onChange={(e) => setEvaluation({ ...evaluation, motif: e.target.value })} className={CHAMP} /></label>}
      <p className="text-sm">Note globale pondérée : <b>{apercu === null ? 'notes incomplètes' : `${apercu} / 5`}</b> (recalculée par le serveur)</p>
      <div className="flex gap-2">
        <button disabled={busy || apercu === null || !evaluation.debut || !evaluation.fin || (dejaEvaluee && !evaluation.motif?.trim())} onClick={evaluer} className="rounded-lg bg-orange-700 px-3 py-1 text-xs font-bold text-white disabled:opacity-50">Enregistrer l'évaluation</button>
        <button onClick={() => setEvaluation(null)} className="rounded-lg border border-stone-300 px-3 py-1 text-xs">Annuler</button>
      </div>
    </div>}

    <h3 className="mt-5 text-sm font-bold">Historique des commandes</h3>
    {bons.length === 0 ? <SansDonnees message="Aucun bon de commande" /> : <>
      <p className="text-xs text-stone-500">Montant engagé (bons soumis et au-delà, hors rejetés et annulés) : {GNF.format(totalCommande)} GNF</p>
      <table className="mt-1 w-full text-sm"><thead><tr className="border-b text-left text-stone-500"><th className="py-2 pr-3">Bon</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Total</th><th className="py-2 pr-3">Statut</th></tr></thead>
        <tbody>{bons.map((b) => <tr key={b.id} className="border-b border-stone-100"><td className="py-2 pr-3 font-bold">{b.po_number}</td><td className="py-2 pr-3">{b.po_date}</td>
          <td className="py-2 pr-3">{b.total_amount === null ? 'Sans données' : `${GNF.format(b.total_amount)} GNF`}</td>
          <td className="py-2 pr-3"><Puce teinte={STATUTS_BON[b.status]?.teinte ?? 'gris'}>{STATUTS_BON[b.status]?.texte ?? b.status}</Puce></td></tr>)}</tbody></table></>}

    <h3 className="mt-5 text-sm font-bold">Historique des paiements</h3>
    {!voitPaiements ? <p className="text-xs text-stone-500">Lecture réservée aux modules Facturation ou Contrats.</p>
      : paiements.length === 0 ? <SansDonnees message="Aucun paiement sur les bons de ce fournisseur" /> : <>
        <p className="text-xs text-stone-500">Payé (exécuté) : {GNF.format(totalPaye)} GNF</p>
        <table className="mt-1 w-full text-sm"><thead><tr className="border-b text-left text-stone-500"><th className="py-2 pr-3">Paiement</th><th className="py-2 pr-3">Bon</th><th className="py-2 pr-3">Proposé</th><th className="py-2 pr-3">Exécuté</th><th className="py-2 pr-3">Statut</th></tr></thead>
          <tbody>{paiements.map((p) => <tr key={p.id} className="border-b border-stone-100"><td className="py-2 pr-3 font-bold">{p.numero}</td>
            <td className="py-2 pr-3">{bons.find((b) => b.id === p.purchase_order_id)?.po_number ?? '?'}</td>
            <td className="py-2 pr-3">{GNF.format(p.montant_propose)} {p.devise}</td>
            <td className="py-2 pr-3">{p.montant_execute === null ? '-' : `${GNF.format(p.montant_execute)} ${p.devise} le ${p.execute_le}`}</td>
            <td className="py-2 pr-3">{STATUTS_PAIEMENT[p.statut] ?? p.statut}</td></tr>)}</tbody></table></>}

    <h3 className="mt-5 text-sm font-bold">Journal</h3>
    {journal.length === 0 ? <p className="text-xs text-stone-500">Aucun événement</p> :
      <ul className="text-xs text-stone-600">{journal.map((e) => <li key={e.id}>{new Date(e.le).toLocaleString('fr-FR')} · {e.evenement}{e.motif ? ` · ${e.motif}` : ''}</li>)}</ul>}
  </Panneau>;
};
