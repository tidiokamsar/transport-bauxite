import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { CHAMP, TYPES_DOCUMENT, TYPES_FOURNISSEUR, type Categorie, type Fournisseur } from './fournisseurs';
import { FicheFournisseur } from './FicheFournisseur';
import { ConsultationsFournisseurs } from './ConsultationsFournisseurs';
import { ReferentielsFournisseurs } from './ReferentielsFournisseurs';

// Fournisseurs (D-059) : repertoire, fiche detaillee, consultations et
// referentiels. Toute ecriture passe par les fonctions serveur.

interface Contact { id: string; supplier_id: string; nom: string; telephone: string | null; email: string | null; principal: boolean; actif: boolean }
interface Evaluation { id: string; supplier_id: string; periode_debut: string; periode_fin: string; note_globale: number }
interface AlerteDocument { id: string; supplier_id: string; company_name: string; type_document: string; libelle: string | null; date_expiration: string; jours_restants: number; etat: 'expire' | 'a_renouveler' }

const COLONNES = 'id, supplier_number, supplier_type, company_name, phone, email, address, ville, pays, identifiant_fiscal, registre_commerce, payment_terms, notes, active, suspendu_le, motif_suspension';
const FICHE_VIDE: Record<string, string> = { type: 'parts' };

type Onglet = 'repertoire' | 'consultations' | 'referentiels';

export const SuppliersView = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('purchases', 'create') || hasPermission('purchases', 'edit');
  const [onglet, setOnglet] = useState<Onglet>('repertoire');
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[] | null>(null);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [classement, setClassement] = useState<{ supplier_id: string; categorie_id: string }[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [alertes, setAlertes] = useState<AlerteDocument[]>([]);
  const [heure, setHeure] = useState<Date | null>(null);
  const [recherche, setRecherche] = useState('');
  const [filtreType, setFiltreType] = useState('');
  const [filtreCategorie, setFiltreCategorie] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('actifs');
  const [selection, setSelection] = useState<string | null>(null);
  const [edition, setEdition] = useState<{ id: string | null } | null>(null);
  const [fiche, setFiche] = useState<Record<string, string>>(FICHE_VIDE);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const [f, c, fc, ct, ev, al] = await Promise.all([
      supabase.from('suppliers').select(COLONNES).order('company_name'),
      supabase.from('categories_fournisseurs').select('id, libelle, actif').order('libelle'),
      supabase.from('fournisseurs_categories').select('supplier_id, categorie_id'),
      supabase.from('contacts_fournisseurs').select('id, supplier_id, nom, telephone, email, principal, actif').eq('actif', true),
      supabase.from('v_evaluations_fournisseurs_courantes').select('id, supplier_id, periode_debut, periode_fin, note_globale').order('periode_fin', { ascending: false }),
      supabase.from('v_documents_fournisseurs_echeance').select('id, supplier_id, company_name, type_document, libelle, date_expiration, jours_restants, etat').order('date_expiration'),
    ]);
    setErreur(f.error?.message ?? '');
    setFournisseurs((f.data ?? []) as Fournisseur[]);
    setCategories((c.data ?? []) as Categorie[]);
    setClassement((fc.data ?? []) as { supplier_id: string; categorie_id: string }[]);
    setContacts(((ct.data ?? []) as Contact[]).filter((x) => x.actif));
    setEvaluations((ev.data ?? []) as Evaluation[]);
    setAlertes((al.data ?? []) as AlerteDocument[]);
    setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const libelleCategorie = useMemo(() => new Map(categories.map((c) => [c.id, c.libelle])), [categories]);
  const categoriesDe = (id: string) => classement.filter((x) => x.supplier_id === id).map((x) => libelleCategorie.get(x.categorie_id) ?? '?');
  const principal = (id: string) => contacts.find((c) => c.supplier_id === id && c.principal) ?? contacts.find((c) => c.supplier_id === id);
  const derniereEvaluation = (id: string) => evaluations.filter((e) => e.supplier_id === id).sort((a, b) => b.periode_fin.localeCompare(a.periode_fin))[0];
  const alertesDe = (id: string) => alertes.filter((a) => a.supplier_id === id);

  const terme = recherche.trim().toLowerCase();
  const liste = (fournisseurs ?? []).filter((f) =>
    (!terme || [f.company_name, f.supplier_number, f.identifiant_fiscal ?? '', f.ville ?? ''].some((v) => v.toLowerCase().includes(terme)))
    && (!filtreType || f.supplier_type === filtreType)
    && (!filtreCategorie || classement.some((x) => x.supplier_id === f.id && x.categorie_id === filtreCategorie))
    && (filtreStatut === 'tous' || (filtreStatut === 'actifs' ? f.active !== false : f.active === false)));

  const executer = async (fonction: string, args: Record<string, unknown>, succes: string) => {
    setBusy(true); setErreur(''); setMessage('');
    const { data, error } = await supabase.rpc(fonction, args);
    setBusy(false);
    if (error) { setErreur(error.message); return null; }
    setMessage(succes);
    await charger();
    return { data: data as unknown };
  };

  const nouveau = () => { setEdition({ id: null }); setSelection(null); setFiche(FICHE_VIDE); };
  const modifier = (f: Fournisseur) => {
    setEdition({ id: f.id });
    setFiche({ nom: f.company_name, type: f.supplier_type, telephone: f.phone ?? '', email: f.email ?? '', adresse: f.address ?? '',
      ville: f.ville ?? '', pays: f.pays ?? '', nif: f.identifiant_fiscal ?? '', rccm: f.registre_commerce ?? '',
      conditions: f.payment_terms ?? '', note: f.notes ?? '' });
  };
  const val = (k: string) => fiche[k]?.trim() || null;
  const enregistrer = async () => {
    if (!edition) return;
    const r = await executer('enregistrer_fournisseur', {
      p_id: edition.id, p_raison_sociale: val('nom'), p_type: fiche.type, p_telephone: val('telephone'), p_email: val('email'),
      p_adresse: val('adresse'), p_ville: val('ville'), p_pays: val('pays'), p_identifiant_fiscal: val('nif'),
      p_registre_commerce: val('rccm'), p_conditions_paiement: val('conditions'), p_note: val('note'),
    }, edition.id ? 'Fiche fournisseur mise à jour.' : 'Fournisseur créé : numéro attribué par le serveur.');
    if (r) { if (typeof r.data === 'string') setSelection(r.data); setEdition(null); }
  };
  const champ = (k: string, libelle: string, props: Record<string, string> = {}) => (
    <label className="text-sm">{libelle}<input value={fiche[k] ?? ''} onChange={(e) => setFiche({ ...fiche, [k]: e.target.value })} className={CHAMP} {...props} /></label>
  );

  const courant = selection ? (fournisseurs ?? []).find((f) => f.id === selection) ?? null : null;

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Fournisseurs</h2>
        <p className="text-sm text-stone-500">Répertoire, fiches, documents, évaluations, suspension et consultations de prix.</p></div>
      <div className="flex gap-2">
        {peutEcrire && onglet === 'repertoire' && <button onClick={nouveau} className="flex items-center gap-2 rounded-lg bg-orange-700 px-3 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Nouveau fournisseur</button>}
        <button onClick={charger} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
      </div>
    </header>
    <nav role="tablist" aria-label="Rubriques fournisseurs" className="flex gap-2">
      {([['repertoire', 'Répertoire'], ['consultations', 'Consultations'], ['referentiels', 'Référentiels']] as [Onglet, string][]).map(([id, texte]) =>
        <button key={id} role="tab" aria-selected={onglet === id} onClick={() => setOnglet(id)}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${onglet === id ? 'bg-stone-900 text-white' : 'border border-stone-200 bg-white text-stone-700'}`}>{texte}</button>)}
    </nav>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}

    {onglet === 'consultations' && <ConsultationsFournisseurs fournisseurs={fournisseurs ?? []} />}
    {onglet === 'referentiels' && <ReferentielsFournisseurs categories={categories} onChange={charger} />}

    {onglet === 'repertoire' && <>
      {alertes.length > 0 && <Panneau titre="Documents à renouveler">
        <ul className="divide-y divide-stone-100 text-sm">{alertes.map((a) => <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span><b>{a.company_name}</b> · {a.type_document === 'autre' ? a.libelle : TYPES_DOCUMENT[a.type_document] ?? a.type_document} · expire le {a.date_expiration}</span>
          <Puce teinte={a.etat === 'expire' ? 'rouge' : 'orange'}>{a.etat === 'expire' ? `Expiré depuis ${-a.jours_restants} j` : `Dans ${a.jours_restants} j`}</Puce>
        </li>)}</ul>
        <Provenance source="v_documents_fournisseurs_echeance (dates saisies)" heure={heure} />
      </Panneau>}

      {edition && <Panneau titre={edition.id ? `Modifier ${courant?.company_name ?? 'la fiche'}` : 'Nouveau fournisseur'}>
        <p className="mb-3 text-sm text-stone-600">Numéro attribué par le serveur. Raison sociale et identifiant fiscal uniques.</p>
        <div role="form" aria-label="Saisie fournisseur" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {champ('nom', 'Raison sociale *')}
          <label className="text-sm">Type *<select value={fiche.type ?? 'parts'} onChange={(e) => setFiche({ ...fiche, type: e.target.value })} className={CHAMP}>
            {Object.entries(TYPES_FOURNISSEUR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          {champ('telephone', 'Téléphone', { type: 'tel' })}
          {champ('email', 'Courriel', { type: 'email' })}
          {champ('adresse', 'Adresse')}
          {champ('ville', 'Ville')}
          {champ('pays', 'Pays')}
          {champ('nif', 'Identifiant fiscal (NIF)')}
          {champ('rccm', 'Registre du commerce')}
          {champ('conditions', 'Conditions de paiement')}
          <label className="text-sm sm:col-span-2">Note<input value={fiche.note ?? ''} onChange={(e) => setFiche({ ...fiche, note: e.target.value })} className={CHAMP} /></label>
        </div>
        <div className="mt-3 flex gap-2">
          <button disabled={busy || !fiche.nom?.trim()} onClick={enregistrer} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer la fiche</button>
          <button onClick={() => setEdition(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Fermer</button>
        </div>
      </Panneau>}

      {courant && !edition && <FicheFournisseur fournisseur={courant} categories={categories} onModifier={() => modifier(courant)}
        onChange={charger} onFermer={() => setSelection(null)} />}

      <Panneau titre="Répertoire">
        <div className="mb-3 flex flex-wrap gap-2">
          <input aria-label="Rechercher un fournisseur" placeholder="Nom, numéro, NIF, ville" value={recherche} onChange={(e) => setRecherche(e.target.value)} className="rounded border border-stone-300 px-3 py-2 text-sm" />
          <select aria-label="Filtrer par type" value={filtreType} onChange={(e) => setFiltreType(e.target.value)} className="rounded border border-stone-300 px-3 py-2 text-sm">
            <option value="">Tous les types</option>{Object.entries(TYPES_FOURNISSEUR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select aria-label="Filtrer par catégorie" value={filtreCategorie} onChange={(e) => setFiltreCategorie(e.target.value)} className="rounded border border-stone-300 px-3 py-2 text-sm">
            <option value="">Toutes les catégories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}</select>
          <select aria-label="Filtrer par statut" value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} className="rounded border border-stone-300 px-3 py-2 text-sm">
            <option value="actifs">Actifs</option><option value="suspendus">Suspendus</option><option value="tous">Tous</option></select>
        </div>
        {fournisseurs === null ? <p>Chargement…</p> : liste.length === 0 ? <SansDonnees message="Aucun fournisseur" /> :
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500">
            <th className="py-2 pr-3">Numéro</th><th className="py-2 pr-3">Raison sociale</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Catégories</th>
            <th className="py-2 pr-3">Contact principal</th><th className="py-2 pr-3">Dernière évaluation</th><th className="py-2 pr-3">Documents</th><th className="py-2 pr-3">Statut</th><th /></tr></thead>
            <tbody>{liste.map((f) => { const c = principal(f.id); const e = derniereEvaluation(f.id); const a = alertesDe(f.id);
              return <tr key={f.id} className={`border-b border-stone-100 ${selection === f.id ? 'bg-orange-50' : ''}`}>
                <td className="py-2 pr-3 font-bold">{f.supplier_number}</td>
                <td className="py-2 pr-3">{f.company_name}{f.ville && <span className="block text-xs text-stone-500">{f.ville}</span>}</td>
                <td className="py-2 pr-3">{TYPES_FOURNISSEUR[f.supplier_type] ?? f.supplier_type}</td>
                <td className="py-2 pr-3">{categoriesDe(f.id).join(', ') || <span className="text-stone-400">Aucune</span>}</td>
                <td className="py-2 pr-3">{c ? <>{c.nom}<span className="block text-xs text-stone-500">{c.telephone ?? c.email}</span></> : <span className="text-stone-400">Aucun</span>}</td>
                <td className="py-2 pr-3">{e ? <>{e.note_globale} / 5<span className="block text-xs text-stone-500">{e.periode_debut} au {e.periode_fin}</span></> : <span className="text-stone-400">Non évalué</span>}</td>
                <td className="py-2 pr-3">{a.length === 0 ? <span className="text-stone-400">Aucune alerte</span> :
                  <Puce teinte={a.some((x) => x.etat === 'expire') ? 'rouge' : 'orange'}>{a.length} à renouveler</Puce>}</td>
                <td className="py-2 pr-3"><Puce teinte={f.active === false ? 'rouge' : 'vert'}>{f.active === false ? 'Suspendu' : 'Actif'}</Puce></td>
                <td className="py-2"><button onClick={() => { setSelection(f.id); setEdition(null); }} aria-label={`Ouvrir ${f.company_name}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Ouvrir</button></td>
              </tr>; })}</tbody></table></div>}
        <Provenance source="suppliers, contacts, évaluations courantes" heure={heure} />
      </Panneau>
    </>}
  </div>;
};
