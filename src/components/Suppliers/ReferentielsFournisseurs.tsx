import { useEffect, useState } from 'react';
import { ListPlus, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { PageAction } from '../ui/PageAction';
import { PageDetail, Relation } from '../ui/PageDetail';
import { ChampPage } from '../ui/PageFormulaire';
import { Puce, SansDonnees } from '../ui/Panneau';
import { lire, type Lecture } from '../ui/lecture';
import type { Categorie } from './fournisseurs';
import type { Critere } from './donnees';
import { ID_REFERENTIELS, MODULE_FOURNISSEURS, VUE_FOURNISSEURS, routeActionReferentiel, routeConsultations } from './routes';

// Referentiels fournisseurs (D-059, D-090) : categories et grille
// d'evaluation ponderee, tenues par l'administrateur (D-072, controle
// serveur is_admin). Aucune grille n'est fournie par defaut. Aucune
// suppression : une categorie ou un critere se desactive.

const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });
const LIEN_LIGNE = 'rounded border border-stone-300 px-2 py-1 text-xs font-semibold';
const ACTIONS = ['categorie', 'basculer-categorie', 'critere'] as const;

const lireReferentiels = () => Promise.all([
  lire<Categorie>(supabase.from('categories_fournisseurs').select('id, libelle, actif').order('libelle'), 'catégories'),
  lire<Critere>(supabase.from('criteres_evaluation_fournisseur').select('id, libelle, description, poids, ordre, actif').eq('grille', 'fournisseur').order('ordre'), 'grille d\'évaluation'),
]);

export const ReferentielsFournisseurs = () => {
  const { profile } = useAuth();
  const estAdmin = profile?.role === 'admin';
  const [categories, setCategories] = useState<Lecture<Categorie>>(attente);
  const [criteres, setCriteres] = useState<Lecture<Critere>>(attente);
  useEffect(() => { lireReferentiels().then(([c, g]) => { setCategories(c); setCriteres(g); }); }, []);
  const totalPoids = (criteres.lignes ?? []).filter((c) => c.actif).reduce((s, c) => s + c.poids, 0);

  return (
    <PageDetail
      vue={VUE_FOURNISSEURS}
      module={MODULE_FOURNISSEURS}
      reference="Référentiels"
      titre="Référentiels fournisseurs"
      resume={<>Catégories et grille d'évaluation, tenues par l'administrateur · <a href={routeConsultations()} className="underline">consultations</a></>}
      chargement={false}
      actions={[
        { id: 'categorie', libelle: 'Ajouter une catégorie', icone: <Plus className="h-4 w-4" />, visible: estAdmin, vers: routeActionReferentiel('categorie') },
        { id: 'critere', libelle: 'Ajouter un critère', icone: <ListPlus className="h-4 w-4" />, visible: estAdmin, vers: routeActionReferentiel('critere') },
      ]}
      onglets={[
        { id: 'categories', libelle: 'Catégories', compte: categories.lignes?.length ?? null, contenu: (
          <Relation titre="Catégories de fournisseurs" lignes={categories.lignes} erreur={categories.erreur} cle={(c) => c.id} vide="Aucune catégorie"
            colonnes={[
              { libelle: 'Catégorie', valeur: (c) => c.libelle },
              { libelle: 'État', valeur: (c) => <Puce teinte={c.actif ? 'vert' : 'gris'}>{c.actif ? 'Active' : 'Inactive'}</Puce> },
              ...(estAdmin ? [{ libelle: 'Gestion', valeur: (c: Categorie) => (
                <a href={routeActionReferentiel('basculer-categorie', { categorie: c.id })} aria-label={`${c.actif ? 'Désactiver' : 'Réactiver'} la catégorie ${c.libelle}`} className={LIEN_LIGNE}>
                  {c.actif ? 'Désactiver' : 'Réactiver'}
                </a>
              ) }] : []),
            ]} />
        ) },
        { id: 'grille', libelle: 'Grille d\'évaluation', compte: criteres.lignes?.length ?? null, contenu: (
          <div className="space-y-3">
            <p className="text-sm text-stone-600">Notes de 1 à 5 par critère ; note globale = moyenne pondérée par les poids, calculée par le serveur. Les évaluations passées gardent les libellés et poids de leur date.</p>
            {criteres.lignes?.length === 0 && <SansDonnees message="Grille non définie" detail="Aucune évaluation possible tant que l'administrateur n'a pas défini de critère." />}
            <Relation titre="Critères" lignes={criteres.lignes} erreur={criteres.erreur} cle={(c) => c.id} vide="Aucun critère"
              colonnes={[
                { libelle: 'Critère', valeur: (c) => <>{c.libelle}{c.description && <span className="block text-xs text-stone-500">{c.description}</span>}</> },
                { libelle: 'Poids', valeur: (c) => <>{c.poids}{c.actif && totalPoids > 0 && <span className="text-xs text-stone-500"> ({Math.round((c.poids / totalPoids) * 100)} %)</span>}</> },
                { libelle: 'Ordre', valeur: (c) => c.ordre },
                { libelle: 'État', valeur: (c) => <Puce teinte={c.actif ? 'vert' : 'gris'}>{c.actif ? 'Actif' : 'Inactif'}</Puce> },
                ...(estAdmin ? [{ libelle: 'Gestion', valeur: (c: Critere) => (
                  <a href={routeActionReferentiel('critere', { critere: c.id })} aria-label={`Modifier le critère ${c.libelle}`} className={LIEN_LIGNE}>Modifier</a>
                ) }] : []),
              ]} />
          </div>
        ) },
      ]}
    />
  );
};

export const ActionReferentiel = ({ action, requete }: { action: string; requete: Record<string, string> }) => {
  const { profile } = useAuth();
  const estAdmin = profile?.role === 'admin';
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [criteres, setCriteres] = useState<Critere[]>([]);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);
  const [libelle, setLibelle] = useState('');
  const [critere, setCritere] = useState({ libelle: '', poids: '', description: '', ordre: '', actif: true });

  useEffect(() => {
    lireReferentiels().then(([c, g]) => {
      setCategories(c.lignes ?? []);
      const lesCriteres = g.lignes ?? [];
      setCriteres(lesCriteres);
      const x = requete.critere ? lesCriteres.find((k) => k.id === requete.critere) : null;
      setCritere(x ? { libelle: x.libelle, poids: String(x.poids), description: x.description ?? '', ordre: String(x.ordre), actif: x.actif }
        : { libelle: '', poids: '', description: '', ordre: String(lesCriteres.length + 1), actif: true });
      setErreur(c.erreur || g.erreur);
      setChargement(false);
    });
  }, [requete.critere]);

  if (!(ACTIONS as readonly string[]).includes(action)) {
    return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action des référentiels fournisseurs.`} />;
  }
  const commun = {
    vue: VUE_FOURNISSEURS, module: MODULE_FOURNISSEURS, reference: 'Référentiels', id: ID_REFERENTIELS, chargement, erreurChargement: erreur,
    motif: 'aucun' as const,
  };
  const refus = estAdmin ? null : 'Référentiels fournisseurs : administrateur seulement.';
  const executer = async (fonction: string, args: Record<string, unknown>) => {
    const { error } = await supabase.rpc(fonction, args);
    return error ? error.message : null;
  };

  if (action === 'basculer-categorie') {
    const c = categories.find((k) => k.id === requete.categorie) ?? null;
    return (
      <PageAction
        {...commun}
        titre={c ? `${c.actif ? 'Désactiver' : 'Réactiver'} la catégorie ${c.libelle}` : 'Catégorie'}
        description={c?.actif ? 'La catégorie n\'est plus proposée au classement ; les fournisseurs déjà classés la conservent.' : 'La catégorie est de nouveau proposée au classement.'}
        libelleConfirmer={c?.actif ? 'Désactiver' : 'Réactiver'}
        danger={c?.actif}
        interdit={refus ?? (!chargement && !c ? 'Catégorie introuvable.' : null)}
        messageSucces={c?.actif ? 'Catégorie désactivée.' : 'Catégorie réactivée.'}
        onExecuter={() => executer('definir_categorie_fournisseur', { p_id: c?.id, p_libelle: c?.libelle, p_actif: !c?.actif })}
      />
    );
  }
  if (action === 'categorie') {
    return (
      <PageAction
        {...commun}
        titre="Ajouter une catégorie de fournisseurs"
        libelleConfirmer="Ajouter la catégorie"
        interdit={refus}
        pret={Boolean(libelle.trim())}
        messageSucces="Catégorie ajoutée."
        onExecuter={() => executer('definir_categorie_fournisseur', { p_libelle: libelle.trim() })}
      >
        <ChampPage libelle="Libellé *"><input value={libelle} onChange={(e) => setLibelle(e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
      </PageAction>
    );
  }
  const existant = requete.critere ? criteres.find((k) => k.id === requete.critere) ?? null : null;
  const poidsValide = /^[1-9]\d*$/.test(critere.poids.trim());
  const ordreValide = /^\d+$/.test(critere.ordre.trim() || '0');
  return (
    <PageAction
      {...commun}
      titre={existant ? `Modifier le critère ${existant.libelle}` : 'Ajouter un critère d\'évaluation'}
      description="Le poids est un entier positif ; un critère inactif n'est plus noté, les évaluations passées gardent leurs poids."
      libelleConfirmer="Enregistrer le critère"
      interdit={refus ?? (requete.critere && !chargement && !existant ? 'Critère introuvable.' : null)}
      pret={Boolean(critere.libelle.trim()) && poidsValide && ordreValide}
      messageSucces="Critère enregistré."
      onExecuter={() => executer('definir_critere_evaluation', {
        p_id: existant?.id ?? null, p_libelle: critere.libelle.trim() || null, p_poids: Number(critere.poids.trim()),
        p_description: critere.description.trim() || null, p_ordre: Number(critere.ordre.trim() || '0'), p_actif: critere.actif,
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampPage libelle="Libellé *"><input value={critere.libelle} onChange={(e) => setCritere({ ...critere, libelle: e.target.value })} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle="Poids * (entier positif)" erreur={critere.poids && !poidsValide ? 'Entier positif attendu.' : null}>
          <input inputMode="numeric" value={critere.poids} onChange={(e) => setCritere({ ...critere, poids: e.target.value })} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Description"><input value={critere.description} onChange={(e) => setCritere({ ...critere, description: e.target.value })} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle="Ordre d'affichage" erreur={!ordreValide ? 'Entier attendu.' : null}>
          <input inputMode="numeric" value={critere.ordre} onChange={(e) => setCritere({ ...critere, ordre: e.target.value })} className={CHAMP_FENETRE} />
        </ChampPage>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={critere.actif} onChange={(e) => setCritere({ ...critere, actif: e.target.checked })} />Critère actif</label>
      </div>
    </PageAction>
  );
};
