import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PageListe } from '../ui/PageListe';
import { Provenance, Puce } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import { routeNouveau, useRoute } from '../ui/routeur';
import type { ColonneListe, FiltreListe } from '../ui/liste';
import { COLONNES_CONTRAT, NATURES, STATUTS, VUE_CONTRATS, type Contrat } from './types';
import { FormulaireContrat } from './Formulaires';
import { DetailContrat } from './DetailContrat';
import { ActionContrat } from './ActionContrat';

// Dossier contractuel (phase 1 du poste « Charge de contrats et
// facturation », D-026) au standard des pages (D-090) : liste des contrats
// CBG et Neemba, fiche (versions, grille de tarifs, engagements et
// clauses, echeance, factures, historique), saisie en pleine page.

export const ContratsView = () => {
  const route = useRoute();
  if (route.vue !== VUE_CONTRATS || route.mode === 'liste') return <ListeContrats />;
  if (route.mode === 'nouveau') return <FormulaireContrat />;
  if (route.mode === 'modifier') return <ModifierContrat id={route.id ?? ''} />;
  if (route.mode === 'action' && route.action) return <ActionContrat id={route.id ?? ''} action={route.action} requete={route.requete} />;
  return <DetailContrat id={route.id ?? ''} />;
};

const ModifierContrat = ({ id }: { id: string }) => {
  const [contrat, setContrat] = useState<Contrat | null>(null);
  const [erreur, setErreur] = useState('');
  useEffect(() => {
    lire<Contrat>(supabase.from('contrats').select(COLONNES_CONTRAT).eq('id', id), 'contrat').then((r) => {
      const c = trouver(r.lignes, id);
      setContrat(c);
      setErreur(r.erreur || (c ? '' : 'Contrat introuvable ou non visible avec vos droits.'));
    });
  }, [id]);
  return contrat ? <FormulaireContrat key={contrat.id} contrat={contrat} /> : <FormulaireContrat chargement={!erreur} erreurChargement={erreur} />;
};

const jour = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR') : null);

const ListeContrats = () => {
  const { hasPermission } = useAuth();
  const peutCreer = hasPermission('contracts', 'create') || hasPermission('contracts', 'edit');
  const [contrats, setContrats] = useState<Contrat[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const { data, error } = await supabase.from('contrats').select(COLONNES_CONTRAT).order('reference');
    setErreur(error ? `Contrats indisponibles : ${error.message}` : '');
    setContrats(error ? null : ((data ?? []) as Contrat[]));
    setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const colonnes = useMemo<ColonneListe<Contrat>[]>(() => [
    { id: 'reference', libelle: 'Référence', valeur: (c) => c.reference },
    { id: 'contrepartie', libelle: 'Contrepartie', valeur: (c) => c.contrepartie },
    { id: 'intitule', libelle: 'Intitulé', valeur: (c) => c.intitule },
    { id: 'nature', libelle: 'Nature', valeur: (c) => NATURES[c.nature] ?? c.nature },
    { id: 'devise', libelle: 'Devise', valeur: (c) => c.devise, masquee: true },
    { id: 'debut', libelle: 'Début', valeur: (c) => c.date_debut, rendu: (c) => jour(c.date_debut) },
    { id: 'fin', libelle: 'Fin', valeur: (c) => c.date_fin, rendu: (c) => jour(c.date_fin) ?? 'en cours' },
    { id: 'statut', libelle: 'Statut', valeur: (c) => STATUTS[c.statut]?.libelle ?? c.statut,
      rendu: (c) => <Puce teinte={STATUTS[c.statut]?.teinte ?? 'gris'}>{STATUTS[c.statut]?.libelle ?? c.statut}</Puce> },
  ], []);
  const filtres = useMemo<FiltreListe<Contrat>[]>(() => [
    { id: 'statut', libelle: 'Statut', options: Object.entries(STATUTS).map(([valeur, s]) => ({ valeur, libelle: s.libelle })), correspond: (c, v) => c.statut === v },
    { id: 'nature', libelle: 'Nature', options: Object.entries(NATURES).map(([valeur, libelle]) => ({ valeur, libelle })), correspond: (c, v) => c.nature === v },
  ], []);

  return (
    <PageListe
      vue={VUE_CONTRATS}
      titre="Dossier contractuel"
      sousTitre="Contrats, avenants, tarifs et engagements ; chaque modification est tracée"
      lignes={contrats}
      erreur={erreur}
      colonnes={colonnes}
      filtres={filtres}
      placeholderRecherche="Rechercher un contrat, une contrepartie..."
      cle={(c) => c.id}
      libelleOuverture={(c) => `Fiche ${c.reference}`}
      actions={peutCreer && (
        <a href={routeNouveau(VUE_CONTRATS)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow">
          <Plus className="h-4 w-4" /> Nouveau contrat
        </a>
      )}
      nomExport="contrats"
      vide={{ message: 'Aucun contrat', detail: 'Saisissez les contrats CBG et Neemba, puis leurs avenants, tarifs et engagements.' }}
      onActualiser={charger}
      provenance={<Provenance source="dossier contractuel saisi ; journal des modifications tenu par le serveur" heure={heure} />}
    />
  );
};
