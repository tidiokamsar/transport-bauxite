import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  INDICATEURS, NATURES, PERIODICITES, STATUTS, UNITES_TARIF,
  type Contrat, type Engagement, type Tarif, type Version,
} from './types';

// Saisie du dossier contractuel. Ecriture directe sous RLS (module
// contracts) ; chaque creation, modification ou suppression est
// journalisee par le serveur (journal_contrats).

const CHAMP = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20';

const Fenetre = ({ titre, onFermer, onValider, enCours, valide, erreur, children }: {
  titre: string;
  onFermer: () => void;
  onValider: () => void;
  enCours: boolean;
  valide: boolean;
  erreur: string;
  children: ReactNode;
}) => (
  <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/30 p-4" onClick={onFermer}>
    <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label={titre}>
      <header className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
        <h2 className="text-xl font-black text-stone-900">{titre}</h2>
        <button onClick={onFermer} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" aria-label="Fermer"><X className="h-5 w-5" /></button>
      </header>
      <div className="grid grid-cols-1 gap-3 px-6 py-5 text-sm sm:grid-cols-2">
        {children}
        {erreur && <p className="rounded-lg bg-red-50 p-3 text-red-700 sm:col-span-2">{erreur}</p>}
      </div>
      <footer className="flex justify-end gap-2 border-t border-stone-200 px-6 py-4">
        <button onClick={onFermer} className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">Annuler</button>
        <button onClick={onValider} disabled={!valide || enCours} className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-700 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
          {enCours ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </footer>
    </div>
  </div>
);

const Champ = ({ libelle, large = false, children }: { libelle: string; large?: boolean; children: ReactNode }) => (
  <label className={`block ${large ? 'sm:col-span-2' : ''}`}>
    <span className="mb-1 block font-medium text-stone-700">{libelle}</span>
    {children}
  </label>
);

const Choix = ({ valeur, options, onChange }: { valeur: string; options: Record<string, string>; onChange: (v: string) => void }) => (
  <select value={valeur} onChange={(e) => onChange(e.target.value)} className={CHAMP}>
    <option value="">Choisir</option>
    {Object.entries(options).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
  </select>
);

const nombre = (v: string) => (v.trim() === '' ? null : Number(v.replace(/\s/g, '').replace(',', '.')));
const texte = (v: string) => (v.trim() === '' ? null : v.trim());

/** Enregistre une ligne (creation ou modification) et rapporte l'erreur du serveur. */
const useEnregistrement = (table: string, id: string | undefined, onFait: () => void) => {
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const enregistrer = async (ligne: Record<string, unknown>) => {
    setEnCours(true);
    setErreur('');
    const { error } = id
      ? await supabase.from(table).update(ligne).eq('id', id)
      : await supabase.from(table).insert(ligne);
    setEnCours(false);
    if (error) setErreur(error.code === '23505' ? 'Cette référence ou ce numéro existe déjà.' : error.message);
    else onFait();
  };
  return { erreur, enCours, enregistrer };
};

export const FormulaireContrat = ({ contrat, onFermer, onFait }: { contrat?: Contrat; onFermer: () => void; onFait: () => void }) => {
  const [f, setF] = useState({
    reference: contrat?.reference ?? '',
    intitule: contrat?.intitule ?? '',
    nature: contrat?.nature ?? '',
    contrepartie: contrat?.contrepartie ?? '',
    devise: contrat?.devise ?? '',
    date_debut: contrat?.date_debut ?? '',
    date_fin: contrat?.date_fin ?? '',
    statut: contrat?.statut ?? 'brouillon',
    delai: contrat?.delai_paiement_jours?.toString() ?? '',
    description: contrat?.description ?? '',
  });
  const { erreur, enCours, enregistrer } = useEnregistrement('contrats', contrat?.id, onFait);
  const valide = Boolean(f.reference.trim() && f.intitule.trim() && f.nature && f.contrepartie.trim() && /^[A-Z]{3}$/.test(f.devise) && f.date_debut);
  return (
    <Fenetre
      titre={contrat ? `Modifier ${contrat.reference}` : 'Nouveau contrat'}
      onFermer={onFermer}
      enCours={enCours}
      valide={valide}
      erreur={erreur}
      onValider={() => enregistrer({
        reference: f.reference.trim(), intitule: f.intitule.trim(), nature: f.nature, contrepartie: f.contrepartie.trim(),
        devise: f.devise, date_debut: f.date_debut, date_fin: f.date_fin || null, statut: f.statut,
        delai_paiement_jours: nombre(f.delai), description: texte(f.description),
      })}
    >
      <Champ libelle="Référence *"><input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle="Contrepartie *"><input value={f.contrepartie} onChange={(e) => setF({ ...f, contrepartie: e.target.value })} placeholder="CBG, Neemba..." className={CHAMP} /></Champ>
      <Champ libelle="Intitulé *" large><input value={f.intitule} onChange={(e) => setF({ ...f, intitule: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle="Nature *"><Choix valeur={f.nature} options={NATURES} onChange={(nature) => setF({ ...f, nature: nature as Contrat['nature'] })} /></Champ>
      <Champ libelle="Devise (code ISO) *">
        <input value={f.devise} onChange={(e) => setF({ ...f, devise: e.target.value.toUpperCase().slice(0, 3) })} placeholder="GNF, USD..." className={CHAMP} />
      </Champ>
      <Champ libelle="Début *"><input type="date" value={f.date_debut} onChange={(e) => setF({ ...f, date_debut: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle="Fin"><input type="date" value={f.date_fin} onChange={(e) => setF({ ...f, date_fin: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle="Statut">
        <select value={f.statut} onChange={(e) => setF({ ...f, statut: e.target.value as Contrat['statut'] })} className={CHAMP}>
          {Object.entries(STATUTS).map(([k, s]) => <option key={k} value={k}>{s.libelle}</option>)}
        </select>
      </Champ>
      <Champ libelle="Délai de paiement (jours)"><input inputMode="numeric" value={f.delai} onChange={(e) => setF({ ...f, delai: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle="Description" large><textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={2} className={CHAMP} /></Champ>
    </Fenetre>
  );
};

export const FormulaireVersion = ({ contratId, version, numeroSuivant, onFermer, onFait }: {
  contratId: string; version?: Version; numeroSuivant: number; onFermer: () => void; onFait: () => void;
}) => {
  const [f, setF] = useState({
    numero: (version?.numero ?? numeroSuivant).toString(),
    intitule: version?.intitule ?? '',
    date_effet: version?.date_effet ?? '',
    date_signature: version?.date_signature ?? '',
    resume: version?.resume ?? '',
    document_ref: version?.document_ref ?? '',
  });
  const { erreur, enCours, enregistrer } = useEnregistrement('contrat_versions', version?.id, onFait);
  const [reprendre, setReprendre] = useState(true);
  const [erreurCopie, setErreurCopie] = useState('');
  const [copieEnCours, setCopieEnCours] = useState(false);
  const numero = nombre(f.numero);
  const ligne = {
    contrat_id: contratId, numero, intitule: f.intitule.trim(), date_effet: f.date_effet,
    date_signature: f.date_signature || null, resume: texte(f.resume), document_ref: texte(f.document_ref),
  };
  // Nouvel avenant : la grille de la version precedente est reprise (chaque
  // version porte sa grille complete), puis modifiee ligne par ligne.
  const creerAvecReprise = async () => {
    setCopieEnCours(true);
    setErreurCopie('');
    const { data: nouvelle, error } = await supabase.from('contrat_versions').insert(ligne).select('id').single();
    if (error || !nouvelle) {
      setCopieEnCours(false);
      setErreurCopie(error?.code === '23505' ? 'Ce numéro de version existe déjà.' : error?.message ?? 'Création impossible');
      return;
    }
    const { data: precedente } = await supabase.from('contrat_versions').select('id')
      .eq('contrat_id', contratId).lt('numero', numero ?? 0).order('numero', { ascending: false }).limit(1).maybeSingle();
    if (precedente) {
      const [t, e] = await Promise.all([
        supabase.from('contrat_tarifs').select('libelle, unite, prix, categorie_materiel, conditions, ordre').eq('version_id', precedente.id),
        supabase.from('contrat_engagements').select('indicateur, libelle, seuil, unite, sens, periodicite, consequence, ordre').eq('version_id', precedente.id),
      ]);
      const copies = await Promise.all([
        (t.data ?? []).length ? supabase.from('contrat_tarifs').insert((t.data ?? []).map((x) => ({ ...x, version_id: nouvelle.id }))) : { error: null },
        (e.data ?? []).length ? supabase.from('contrat_engagements').insert((e.data ?? []).map((x) => ({ ...x, version_id: nouvelle.id }))) : { error: null },
      ]);
      const echec = copies.find((c) => c.error);
      if (echec?.error) {
        setCopieEnCours(false);
        setErreurCopie(`Avenant créé, mais la reprise de la grille a échoué : ${echec.error.message}`);
        return;
      }
    }
    setCopieEnCours(false);
    onFait();
  };
  const avecReprise = !version && numeroSuivant > 0 && reprendre;
  return (
    <Fenetre
      titre={version ? 'Modifier la version' : numeroSuivant === 0 ? 'Contrat initial' : `Nouvel avenant (n° ${numeroSuivant})`}
      onFermer={onFermer}
      enCours={enCours || copieEnCours}
      valide={Boolean(numero !== null && numero >= 0 && f.intitule.trim() && f.date_effet)}
      erreur={erreur || erreurCopie}
      onValider={() => (avecReprise ? creerAvecReprise() : enregistrer(ligne))}
    >
      <Champ libelle="Numéro (0 = contrat initial) *"><input inputMode="numeric" value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle="Date d'effet *"><input type="date" value={f.date_effet} onChange={(e) => setF({ ...f, date_effet: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle="Intitulé *" large><input value={f.intitule} onChange={(e) => setF({ ...f, intitule: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle="Date de signature"><input type="date" value={f.date_signature} onChange={(e) => setF({ ...f, date_signature: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle="Référence du document"><input value={f.document_ref} onChange={(e) => setF({ ...f, document_ref: e.target.value })} placeholder="Classement, lien..." className={CHAMP} /></Champ>
      <Champ libelle="Résumé des changements" large><textarea value={f.resume} onChange={(e) => setF({ ...f, resume: e.target.value })} rows={3} className={CHAMP} /></Champ>
      {!version && numeroSuivant > 0 && (
        <label className="flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" checked={reprendre} onChange={(e) => setReprendre(e.target.checked)} />
          <span>Reprendre les tarifs et engagements de la version précédente (à modifier ensuite)</span>
        </label>
      )}
    </Fenetre>
  );
};

export const FormulaireTarif = ({ versionId, tarif, onFermer, onFait }: { versionId: string; tarif?: Tarif; onFermer: () => void; onFait: () => void }) => {
  const [f, setF] = useState({
    libelle: tarif?.libelle ?? '',
    unite: tarif?.unite ?? '',
    prix: tarif?.prix?.toString() ?? '',
    categorie: tarif?.categorie_materiel ?? '',
    engin: tarif?.engin ?? '',
    conditions: tarif?.conditions ?? '',
  });
  const [engins, setEngins] = useState<{ id: string; registration: string }[]>([]);
  useEffect(() => {
    supabase.from('vehicles').select('id, registration').order('registration')
      .then(({ data }) => setEngins((data as { id: string; registration: string }[] | null) ?? []));
  }, []);
  const { erreur, enCours, enregistrer } = useEnregistrement('contrat_tarifs', tarif?.id, onFait);
  const prix = nombre(f.prix);
  return (
    <Fenetre
      titre={tarif ? 'Modifier le tarif' : 'Nouveau tarif'}
      onFermer={onFermer}
      enCours={enCours}
      valide={Boolean(f.libelle.trim() && f.unite && prix !== null && prix >= 0)}
      erreur={erreur}
      onValider={() => enregistrer({
        version_id: versionId, libelle: f.libelle.trim(), unite: f.unite, prix,
        categorie_materiel: texte(f.categorie), engin: f.engin || null, conditions: texte(f.conditions),
      })}
    >
      <Champ libelle="Libellé *" large><input value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle="Unité *"><Choix valeur={f.unite} options={UNITES_TARIF} onChange={(unite) => setF({ ...f, unite })} /></Champ>
      <Champ libelle="Prix unitaire *"><input inputMode="decimal" value={f.prix} onChange={(e) => setF({ ...f, prix: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle="Engin (tarif propre à cet engin, D-033)">
        <select value={f.engin} onChange={(e) => setF({ ...f, engin: e.target.value })} className={CHAMP}>
          <option value="">Tous (catégorie ou tarif unique)</option>
          {engins.map((e) => <option key={e.id} value={e.id}>{e.registration}</option>)}
        </select>
      </Champ>
      <Champ libelle="Catégorie de matériel"><input value={f.categorie} onChange={(e) => setF({ ...f, categorie: e.target.value })} placeholder="Semi-remorque, chargeuse..." className={CHAMP} /></Champ>
      <Champ libelle="Conditions"><input value={f.conditions} onChange={(e) => setF({ ...f, conditions: e.target.value })} className={CHAMP} /></Champ>
    </Fenetre>
  );
};

export const FormulaireEngagement = ({ versionId, engagement, onFermer, onFait }: {
  versionId: string; engagement?: Engagement; onFermer: () => void; onFait: () => void;
}) => {
  const [f, setF] = useState({
    indicateur: engagement?.indicateur ?? '',
    libelle: engagement?.libelle ?? '',
    seuil: engagement?.seuil?.toString() ?? '',
    unite: engagement?.unite ?? '',
    sens: engagement?.sens ?? '',
    periodicite: engagement?.periodicite ?? '',
    consequence: engagement?.consequence ?? '',
  });
  const { erreur, enCours, enregistrer } = useEnregistrement('contrat_engagements', engagement?.id, onFait);
  const seuil = nombre(f.seuil);
  return (
    <Fenetre
      titre={engagement ? 'Modifier l\'engagement' : 'Nouvel engagement'}
      onFermer={onFermer}
      enCours={enCours}
      valide={Boolean(f.indicateur && f.libelle.trim() && seuil !== null && f.unite.trim() && f.sens && f.periodicite)}
      erreur={erreur}
      onValider={() => enregistrer({
        version_id: versionId, indicateur: f.indicateur, libelle: f.libelle.trim(), seuil, unite: f.unite.trim(),
        sens: f.sens, periodicite: f.periodicite, consequence: texte(f.consequence),
      })}
    >
      <Champ libelle="Indicateur *">
        <Choix valeur={f.indicateur} options={INDICATEURS} onChange={(indicateur) => setF({ ...f, indicateur, libelle: f.libelle || INDICATEURS[indicateur] || '' })} />
      </Champ>
      <Champ libelle="Libellé contractuel *"><input value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle="Seuil *"><input inputMode="decimal" value={f.seuil} onChange={(e) => setF({ ...f, seuil: e.target.value })} className={CHAMP} /></Champ>
      <Champ libelle="Unité *"><input value={f.unite} onChange={(e) => setF({ ...f, unite: e.target.value })} placeholder="%, min, km, L/h..." className={CHAMP} /></Champ>
      <Champ libelle="Sens *"><Choix valeur={f.sens} options={{ minimum: 'Au moins (minimum)', maximum: 'Au plus (maximum)' }} onChange={(sens) => setF({ ...f, sens: sens as Engagement['sens'] })} /></Champ>
      <Champ libelle="Périodicité *"><Choix valeur={f.periodicite} options={PERIODICITES} onChange={(periodicite) => setF({ ...f, periodicite })} /></Champ>
      <Champ libelle="Conséquence (pénalité, bonus, clause)" large><textarea value={f.consequence} onChange={(e) => setF({ ...f, consequence: e.target.value })} rows={2} className={CHAMP} /></Champ>
    </Fenetre>
  );
};
