import { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatNombre } from '../Dashboard/indicateurs';
import { PageListe } from '../ui/PageListe';
import { Provenance, Puce, ReferentielVide } from '../ui/Panneau';
import { routeNouveau, useRoute } from '../ui/routeur';
import type { ColonneListe, FiltreListe } from '../ui/liste';
import { BASES, VUE_RECONCILIATION } from './facturation';
import type { Reconciliation } from './reconciliation';
import { DetailReconciliation } from './DetailReconciliation';
import { FormulaireReconciliation } from './FormulaireReconciliation';
import { ActionReconciliation } from './ActionReconciliation';

// Reconciliation mensuelle (phase 3, D-029) au standard des pages (D-090) :
// liste, ouverture en pleine page, fiche (lignes, chaine de preuve,
// factures generees, historique), decisions et cloture en pleine page.

export const ReconciliationView = () => {
  const route = useRoute();
  if (route.vue !== VUE_RECONCILIATION || route.mode === 'liste') return <ListeReconciliations />;
  if (route.mode === 'nouveau') return <FormulaireReconciliation />;
  if (route.mode === 'action' && route.action) return <ActionReconciliation id={route.id ?? ''} action={route.action} requete={route.requete} />;
  return <DetailReconciliation id={route.id ?? ''} />;
};

interface Contrat { id: string; reference: string; contrepartie: string }
const mois = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

const ListeReconciliations = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('invoices', 'create') || hasPermission('invoices', 'edit');
  const [liste, setListe] = useState<Reconciliation[] | null>(null);
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [aucunContrat, setAucunContrat] = useState(false);
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const [c, r] = await Promise.all([
      supabase.from('contrats').select('id, reference, contrepartie').eq('nature', 'client').order('reference'),
      supabase.from('reconciliations').select('*').order('periode_debut', { ascending: false }),
    ]);
    setContrats((c.data ?? []) as Contrat[]);
    setAucunContrat(!c.error && (c.data ?? []).length === 0);
    setErreur(r.error ? `Réconciliations indisponibles : ${r.error.message}` : '');
    setListe(r.error ? null : ((r.data ?? []) as Reconciliation[]));
    setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const contrat = useMemo(() => new Map(contrats.map((c) => [c.id, c])), [contrats]);
  const colonnes = useMemo<ColonneListe<Reconciliation>[]>(() => [
    { id: 'periode', libelle: 'Période', valeur: (r) => r.periode_debut, rendu: (r) => `${contrat.get(r.contrat_id)?.reference ?? 'Contrat'} · ${mois(r.periode_debut)}` },
    { id: 'client', libelle: 'Client', valeur: (r) => contrat.get(r.contrat_id)?.contrepartie ?? null },
    { id: 'base', libelle: 'Base', valeur: (r) => BASES[r.base_tonnage] ?? r.base_tonnage, masquee: true },
    { id: 'tolerance', libelle: 'Tolérance (%)', valeur: (r) => Number(r.tolerance_ecart_pct), alignement: 'droite', masquee: true },
    { id: 'tonnage', libelle: 'Tonnage facturable', valeur: (r) => r.tonnage_facturable, alignement: 'droite',
      rendu: (r) => (r.tonnage_facturable === null ? '—' : `${formatNombre(Number(r.tonnage_facturable), 2)} t`) },
    { id: 'voyages', libelle: 'Voyages facturables', valeur: (r) => r.voyages_facturables, alignement: 'droite', rendu: (r) => r.voyages_facturables ?? '—' },
    { id: 'statut', libelle: 'Statut', valeur: (r) => (r.statut === 'cloturee' ? 'Clôturée' : 'Ouverte'),
      rendu: (r) => (r.statut === 'cloturee' ? <Puce teinte="vert"><Lock className="mr-1 inline h-3 w-3" />Clôturée</Puce> : <Puce teinte="orange">Ouverte</Puce>) },
  ], [contrat]);
  const filtres = useMemo<FiltreListe<Reconciliation>[]>(() => [
    { id: 'statut', libelle: 'Statut', options: [{ valeur: 'ouverte', libelle: 'Ouvertes' }, { valeur: 'cloturee', libelle: 'Clôturées' }], correspond: (r, v) => r.statut === v },
    { id: 'contrat', libelle: 'Contrat', options: contrats.map((c) => ({ valeur: c.id, libelle: `${c.reference} · ${c.contrepartie}` })), correspond: (r, v) => r.contrat_id === v },
  ], [contrats]);

  return (
    <PageListe
      vue={VUE_RECONCILIATION}
      titre="Réconciliation mensuelle"
      sousTitre="Relevés de terrain rapprochés des tonnages facturables, avant la facture"
      lignes={liste}
      erreur={erreur}
      colonnes={colonnes}
      filtres={filtres}
      cle={(r) => r.id}
      libelleOuverture={(r) => `Réconciliation ${contrat.get(r.contrat_id)?.reference ?? ''} ${mois(r.periode_debut)}`.replace(/\s+/g, ' ')}
      actions={peutEcrire && !aucunContrat && (
        <a href={routeNouveau(VUE_RECONCILIATION)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow">
          <Plus className="h-4 w-4" /> Ouvrir une réconciliation
        </a>
      )}
      synthese={aucunContrat ? <ReferentielVide>Aucun contrat client enregistré : saisissez le contrat CBG (Contrats & Finance → Dossier contractuel) avant d'ouvrir une réconciliation.</ReferentielVide> : undefined}
      nomExport="reconciliations"
      vide={{ message: 'Aucune réconciliation', detail: 'Ouvrez la réconciliation du mois écoulé pour un contrat client.' }}
      onActualiser={charger}
      provenance={<Provenance source="voyages livrés de la période (cycle, tickets CBG et fiches terrain) ; décisions du chargé de contrats ; tonnage figé à la clôture" heure={heure} />}
    />
  );
};
