import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PageListe } from '../ui/PageListe';
import { Provenance, Puce, ReferentielVide } from '../ui/Panneau';
import { routeNouveau, useRoute } from '../ui/routeur';
import type { ColonneListe, FiltreListe } from '../ui/liste';
import { montant } from '../Facturation/facturation';
import { STATUTS_FACTURE_F, VUE_FACTURES_NEEMBA, type ContratLoueur, type FactureF, type StatutFactureF } from './facturesNeemba';
import { FormulaireFactureNeemba } from './FormulaireFactureNeemba';
import { DetailFactureNeemba } from './DetailFactureNeemba';
import { ActionFactureNeemba } from './ActionFactureNeemba';

// Controle des factures du loueur (phase 5, D-032 ; type de facturation et
// tarif par engin, D-033) aux pages standard (D-090). Le charge de contrats
// saisit la facture recue en pleine page ; le serveur la confronte, dans
// l'unite du tarif de chaque engin (heures pointees ou kilometres releves
// des voyages livres), au tarif du contrat ; l'ecart est notifie (lettre
// imprimable en pleine page) puis suivi jusqu'a sa regularisation.

export const FacturesNeembaView = () => {
  const route = useRoute();
  if (route.vue !== VUE_FACTURES_NEEMBA || route.mode === 'liste') return <ListeFacturesNeemba />;
  if (route.mode === 'nouveau') return <FormulaireFactureNeemba />;
  if (route.mode === 'action' && route.action) return <ActionFactureNeemba id={route.id ?? ''} action={route.action} />;
  // Aucune fonction serveur ne modifie une facture saisie : la fiche s'ouvre.
  return <DetailFactureNeemba id={route.id ?? ''} />;
};

const jour = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR') : null);

const ListeFacturesNeemba = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('contracts', 'create') || hasPermission('contracts', 'edit');
  const [factures, setFactures] = useState<FactureF[] | null>(null);
  const [contrats, setContrats] = useState<ContratLoueur[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const [f, c] = await Promise.all([
      supabase.from('factures_fournisseur').select('*').order('date_facture', { ascending: false }),
      supabase.from('contrats').select('id, reference, contrepartie, devise, nature').order('reference'),
    ]);
    setErreur(f.error ? `Factures du loueur indisponibles : ${f.error.message}` : '');
    setFactures(f.error ? null : (f.data ?? []) as FactureF[]);
    setContrats((c.data ?? []) as ContratLoueur[]);
    setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const contrat = useMemo(() => new Map((contrats ?? []).map((c) => [c.id, c])), [contrats]);
  const location = useMemo(() => (contrats ?? []).filter((c) => c.nature === 'location'), [contrats]);

  const colonnes = useMemo<ColonneListe<FactureF>[]>(() => [
    { id: 'numero', libelle: 'N° de facture', valeur: (f) => f.numero_fournisseur },
    { id: 'contrat', libelle: 'Contrat', valeur: (f) => (contrat.get(f.contrat_id) ? `${contrat.get(f.contrat_id)?.reference} · ${contrat.get(f.contrat_id)?.contrepartie}` : null) },
    { id: 'date', libelle: 'Date', valeur: (f) => f.date_facture, rendu: (f) => jour(f.date_facture) },
    { id: 'periode', libelle: 'Période', valeur: (f) => f.periode_debut, rendu: (f) => `du ${jour(f.periode_debut)} au ${jour(f.periode_fin)}` },
    { id: 'ht', libelle: 'Facturé HT', alignement: 'droite', valeur: (f) => Number(f.montant_ht_facture), rendu: (f) => montant(f.montant_ht_facture, f.devise) },
    { id: 'attendu', libelle: 'Attendu', alignement: 'droite', valeur: (f) => f.montant_attendu, rendu: (f) => (f.montant_attendu === null ? 'Non contrôlé' : montant(f.montant_attendu, f.devise)), masquee: true },
    { id: 'reclame', libelle: 'Réclamé', alignement: 'droite', valeur: (f) => f.montant_reclame, rendu: (f) => (f.montant_reclame === null ? '—' : montant(f.montant_reclame, f.devise)) },
    { id: 'statut', libelle: 'Statut', valeur: (f) => STATUTS_FACTURE_F[f.statut]?.l ?? f.statut,
      rendu: (f) => <Puce teinte={STATUTS_FACTURE_F[f.statut]?.t ?? 'gris'}>{STATUTS_FACTURE_F[f.statut]?.l ?? f.statut}</Puce> },
  ], [contrat]);

  const filtres = useMemo<FiltreListe<FactureF>[]>(() => [
    { id: 'statut', libelle: 'Statut', options: (Object.keys(STATUTS_FACTURE_F) as StatutFactureF[]).map((k) => ({ valeur: k, libelle: STATUTS_FACTURE_F[k].l })), correspond: (f, v) => f.statut === v },
    { id: 'contrat', libelle: 'Contrat', options: location.map((c) => ({ valeur: c.id, libelle: c.reference })), correspond: (f, v) => f.contrat_id === v },
  ], [location]);

  return (
    <PageListe
      vue={VUE_FACTURES_NEEMBA}
      titre="Contrôle des factures Neemba"
      sousTitre="Quantités facturées confrontées, dans l'unité du tarif de chaque engin (heures pointées ou kilomètres relevés), au contrat de location"
      lignes={factures}
      erreur={erreur}
      colonnes={colonnes}
      filtres={filtres}
      placeholderRecherche="Rechercher un numéro, un contrat..."
      cle={(f) => f.id}
      libelleOuverture={(f) => `Fiche facture ${f.numero_fournisseur}`}
      synthese={contrats !== null && location.length === 0 && (
        <ReferentielVide>Aucun contrat de location : saisissez le contrat Neemba (nature « Location ») et ses tarifs par engin (à l'heure ou au kilomètre, D-033) dans le dossier contractuel.</ReferentielVide>
      )}
      actions={peutEcrire && (
        <a href={routeNouveau(VUE_FACTURES_NEEMBA)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow">
          <Plus className="h-4 w-4" /> Saisir une facture reçue
        </a>
      )}
      nomExport="factures-loueur"
      vide={{ message: 'Aucune facture du loueur', detail: 'Saisissez la facture Neemba reçue pour la contrôler.' }}
      onActualiser={charger}
      provenance={<Provenance source="factures du loueur saisies ; contrôle par le serveur (tarif du contrat, pointages signés, kilomètres des voyages livrés, immobilisations imputées au loueur)" heure={heure} />}
    />
  );
};
