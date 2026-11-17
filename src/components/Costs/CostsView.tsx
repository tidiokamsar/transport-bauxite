import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { bornesMois, repartitionParCategorie, totauxParDevise } from '../../lib/rapports';
import { PageListe } from '../ui/PageListe';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { routeNouveau, useRoute } from '../ui/routeur';
import type { ColonneListe, FiltreListe } from '../ui/liste';
import { COLONNES_COUT, VUE_COUTS, libelleCout, type Cout } from './couts';
import { DetailCout } from './DetailCout';
import { FormulaireCout } from './FormulaireCout';
import { ActionCout } from './ActionCout';

// Couts directs (D-058) au standard des pages (D-090) : une depense
// s'enregistre par la fonction serveur enregistrer_cout (droit d'ecriture
// costs, perimetre du site) ; elle ne se modifie ni ne se supprime, elle
// s'annule avec un motif (annuler_cout). Montants saisis TTC, compares aux
// budgets TTC (D-082). Une depense qui reprend une piece du circuit
// fournisseur la cite : elle ne compte pas au realise budgetaire.
// Les totaux sont donnes par devise, jamais additionnes entre devises.

const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const moisCourant = () => new Date().toISOString().slice(0, 7);
// Mois lu pendant la session : le retour a la liste le conserve.
let moisMemorise = '';

export const CostsView = () => {
  const route = useRoute();
  if (route.vue !== VUE_COUTS || route.mode === 'liste') return <ListeCouts />;
  if (route.mode === 'nouveau') return <FormulaireCout />;
  if (route.mode === 'action' && route.action) return <ActionCout id={route.id ?? ''} action={route.action} />;
  return <DetailCout id={route.id ?? ''} />;
};

const ListeCouts = () => {
  const { hasPermission } = useAuth();
  const peutSaisir = hasPermission('costs', 'create') || hasPermission('costs', 'edit');
  const [mois, setMoisEtat] = useState(() => moisMemorise || moisCourant());
  const setMois = (m: string) => { moisMemorise = m; setMoisEtat(m); };
  const [couts, setCouts] = useState<Cout[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const b = bornesMois(mois);
    if (!b) { setCouts([]); return; }
    const { data, error } = await supabase.from('costs').select(COLONNES_COUT).gte('date', b.debut).lte('date', b.fin).order('date', { ascending: false });
    setErreur(error ? `Dépenses indisponibles : ${error.message}` : '');
    setCouts(error ? null : (data ?? []) as Cout[]);
    setHeure(new Date());
  }, [mois]);
  useEffect(() => { charger(); }, [charger]);

  const pourTotaux = useMemo(() => (couts ?? []).map((c) => ({ amount: c.amount, devise: c.devise, statut: c.statut, categorie: c.cost_categories?.name ?? null })), [couts]);
  const totaux = totauxParDevise(pourTotaux);
  const repartition = repartitionParCategorie(pourTotaux);

  const colonnes = useMemo<ColonneListe<Cout>[]>(() => [
    { id: 'date', libelle: 'Date', valeur: (c) => c.date, rendu: (c) => c.date.split('-').reverse().join('/') },
    { id: 'numero', libelle: 'Numéro', valeur: (c) => c.numero ?? 'Sans numéro' },
    { id: 'description', libelle: 'Dépense', valeur: (c) => c.description },
    { id: 'categorie', libelle: 'Catégorie', valeur: (c) => c.cost_categories?.name ?? null },
    { id: 'site', libelle: 'Site', valeur: (c) => c.sites?.name ?? 'Sans site' },
    { id: 'engin', libelle: 'Engin', valeur: (c) => c.vehicles?.registration ?? null, masquee: true },
    { id: 'reference', libelle: 'Référence', valeur: (c) => c.reference, masquee: true },
    { id: 'montant', libelle: 'Montant TTC', valeur: (c) => c.amount, alignement: 'droite',
      rendu: (c) => <span className={`font-semibold ${c.statut === 'annule' ? 'text-stone-400 line-through' : ''}`}>{nombre.format(c.amount)} {c.devise ?? '(devise non renseignée)'}</span> },
    { id: 'devise', libelle: 'Devise', valeur: (c) => c.devise, masquee: true },
    { id: 'statut', libelle: 'Statut', valeur: (c) => (c.statut === 'annule' ? 'Annulée' : 'Enregistrée'),
      rendu: (c) => <Puce teinte={c.statut === 'annule' ? 'gris' : 'vert'}>{c.statut === 'annule' ? 'Annulée' : 'Enregistrée'}</Puce> },
    { id: 'motif', libelle: 'Motif d\'annulation', valeur: (c) => c.motif_annulation, masquee: true },
  ], []);
  const filtres = useMemo<FiltreListe<Cout>[]>(() => [
    { id: 'statut', libelle: 'Statut', options: [{ valeur: 'enregistre', libelle: 'Enregistrées' }, { valeur: 'annule', libelle: 'Annulées' }], correspond: (c, v) => c.statut === v },
  ], []);

  const synthese = (
    <div className="grid gap-5 lg:grid-cols-3">
      <Panneau titre="Mois">
        <label className="block text-sm">Mois des dépenses
          <input type="month" value={mois} onChange={(e) => setMois(e.target.value)} className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm" />
        </label>
      </Panneau>
      <Panneau titre="Total par devise" className="lg:col-span-2">
        {totaux.length === 0 ? <SansDonnees message="Aucune dépense enregistrée" /> :
          <ul className="space-y-2 text-sm">{totaux.map((t) => <li key={t.devise} className="flex justify-between"><span>{t.devise} · {t.nombre} dépense(s)</span><b>{nombre.format(t.montant)} {t.devise}</b></li>)}</ul>}
        {repartition.length > 0 && <><h3 className="mt-4 text-sm font-bold text-stone-700">Par catégorie</h3>
          <ul className="mt-1 space-y-1 text-sm">{repartition.map((r) => <li key={`${r.categorie}-${r.devise}`} className="flex justify-between"><span>{r.categorie}</span><span>{nombre.format(r.montant)} {r.devise}</span></li>)}</ul></>}
        <Provenance source="costs (dépenses non annulées du mois)" heure={heure} />
      </Panneau>
    </div>
  );

  return (
    <PageListe
      vue={VUE_COUTS}
      titre="Coûts directs"
      sousTitre="Dépenses d'exploitation saisies dans SIGTB (hors location des engins). Une dépense ne se supprime pas : elle s'annule avec un motif."
      lignes={couts}
      erreur={erreur}
      colonnes={colonnes}
      filtres={filtres}
      placeholderRecherche="Description, référence, numéro"
      cle={(c) => c.id}
      libelleOuverture={(c) => `Fiche ${libelleCout(c)}`}
      actions={peutSaisir && (
        <a href={routeNouveau(VUE_COUTS)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow">
          <Plus className="h-4 w-4" /> Nouvelle dépense
        </a>
      )}
      synthese={synthese}
      nomExport={`couts_directs_${mois}`}
      vide={{ message: 'Aucune dépense pour ce mois' }}
      onActualiser={charger}
      provenance={<Provenance source="costs : dépenses enregistrées par enregistrer_cout, annulations par annuler_cout" heure={heure} />}
    />
  );
};
