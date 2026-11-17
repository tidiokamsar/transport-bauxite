import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PageListe } from '../ui/PageListe';
import { Provenance, Puce } from '../ui/Panneau';
import { useRoute } from '../ui/routeur';
import type { ColonneListe, FiltreListe } from '../ui/liste';
import { STATUTS_FACTURE, VUE_FACTURES, libelleFacture, montant, type Facture } from './facturation';
import { DetailFacture } from './DetailFacture';
import { ActionFactureVue } from './ActionFacture';
import { ApercuFacture } from './FactureImprimable';

// Factures et avoirs clients (phase 3, D-029) au standard des pages
// (D-090). Le charge de contrats genere (depuis la reconciliation), soumet
// et emet ; le Directeur General seul signe ou renvoie. Une facture emise ne
// change plus : avoir. Aucune creation directe : une facture nait d'une
// reconciliation cloturee, un avoir d'une facture emise.

export const FacturesView = () => {
  const route = useRoute();
  if (route.vue !== VUE_FACTURES || route.mode === 'liste' || route.mode === 'nouveau') return <ListeFactures />;
  if (route.mode === 'action' && route.action === 'apercu') return <ApercuFacture id={route.id ?? ''} />;
  if (route.mode === 'action' && route.action) return <ActionFactureVue id={route.id ?? ''} action={route.action} />;
  return <DetailFacture id={route.id ?? ''} />;
};

const jour = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR') : null);

const ListeFactures = () => {
  const { profile } = useAuth();
  const estDG = profile?.role === 'director';
  const [factures, setFactures] = useState<Facture[] | null>(null);
  const [contrats, setContrats] = useState<Map<string, { reference: string; contrepartie: string }>>(new Map());
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const [f, c] = await Promise.all([
      supabase.from('factures').select('*').order('prepare_le', { ascending: false }),
      supabase.from('contrats').select('id, reference, contrepartie'),
    ]);
    setErreur(f.error ? `Factures indisponibles : ${f.error.message}` : '');
    setFactures(f.error ? null : ((f.data ?? []) as Facture[]));
    setContrats(new Map(((c.data ?? []) as { id: string; reference: string; contrepartie: string }[]).map((x) => [x.id, x])));
    setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const colonnes = useMemo<ColonneListe<Facture>[]>(() => [
    { id: 'numero', libelle: 'Numéro', valeur: (f) => libelleFacture(f), rendu: (f) => <span className="font-mono">{libelleFacture(f)}</span> },
    { id: 'type', libelle: 'Type', valeur: (f) => (f.type === 'avoir' ? 'Avoir' : 'Facture') },
    { id: 'client', libelle: 'Client', valeur: (f) => contrats.get(f.contrat_id)?.contrepartie ?? null },
    { id: 'contrat', libelle: 'Contrat', valeur: (f) => contrats.get(f.contrat_id)?.reference ?? null, masquee: true },
    { id: 'objet', libelle: 'Objet', valeur: (f) => f.objet },
    { id: 'ttc', libelle: 'TTC', valeur: (f) => Number(f.montant_ttc), alignement: 'droite', rendu: (f) => montant(f.montant_ttc, f.devise) },
    { id: 'devise', libelle: 'Devise', valeur: (f) => f.devise, masquee: true },
    { id: 'emission', libelle: 'Émise le', valeur: (f) => f.date_emission, rendu: (f) => jour(f.date_emission) ?? '—' },
    { id: 'echeance', libelle: 'Échéance', valeur: (f) => f.date_echeance, rendu: (f) => jour(f.date_echeance) ?? '—', masquee: true },
    { id: 'statut', libelle: 'Statut', valeur: (f) => STATUTS_FACTURE[f.statut]?.libelle ?? f.statut,
      rendu: (f) => <Puce teinte={STATUTS_FACTURE[f.statut]?.teinte ?? 'gris'}>{STATUTS_FACTURE[f.statut]?.libelle ?? f.statut}</Puce> },
  ], [contrats]);

  const filtres = useMemo<FiltreListe<Facture>[]>(() => [
    { id: 'statut', libelle: 'Statut', options: Object.entries(STATUTS_FACTURE).map(([valeur, s]) => ({ valeur, libelle: s.libelle })), correspond: (f, v) => f.statut === v },
    { id: 'type', libelle: 'Type', options: [{ valeur: 'facture', libelle: 'Factures' }, { valeur: 'avoir', libelle: 'Avoirs' }], correspond: (f, v) => f.type === v },
    { id: 'contrat', libelle: 'Contrat', options: [...contrats].map(([valeur, c]) => ({ valeur, libelle: `${c.reference} · ${c.contrepartie}` })), correspond: (f, v) => f.contrat_id === v },
  ], [contrats]);

  const aSigner = (factures ?? []).filter((x) => x.statut === 'a_signer').length;

  return (
    <PageListe
      vue={VUE_FACTURES}
      titre="Facturation"
      sousTitre="Factures et avoirs clients : préparés par le chargé de contrats, signés par le Directeur Général"
      lignes={factures}
      erreur={erreur}
      colonnes={colonnes}
      filtres={filtres}
      placeholderRecherche="Rechercher une facture, un client..."
      cle={(f) => f.id}
      libelleOuverture={(f) => `Fiche ${libelleFacture(f)}`}
      synthese={estDG && aSigner > 0 ? <p className="rounded-lg bg-orange-50 p-3 text-sm font-semibold text-orange-900">{aSigner} facture(s) attendent votre signature.</p> : undefined}
      nomExport="factures"
      vide={{ message: 'Aucune facture', detail: 'Les factures naissent d\'une réconciliation mensuelle clôturée.' }}
      onActualiser={charger}
      provenance={<Provenance source="factures générées depuis les réconciliations clôturées, au tarif du contrat en vigueur ; circuit de signature tracé" heure={heure} />}
    />
  );
};
