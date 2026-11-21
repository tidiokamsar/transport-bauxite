import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PageListe } from '../ui/PageListe';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { useRoute } from '../ui/routeur';
import type { ColonneListe, FiltreListe } from '../ui/liste';
import { MODES_PAIEMENT, STATUTS_PAIEMENT, VUE_PAIEMENTS, montantPaiement, routeBonAPayer, type Paiement, type PiecePayable } from './paiements';
import { DetailPaiement } from './DetailPaiement';
import { ActionPaiementVue } from './ActionPaiement';
import { FormulairePaiement } from './FormulairePaiement';
import { SituationPaiements } from './SituationPaiements';

// Paiements fournisseurs (D-055) au standard des pages (D-090) : SIGTB
// n'execute aucun paiement. Il enregistre le bon a payer (plafonne au reste
// a payer), l'approbation par une autre personne, le paiement execute hors
// systeme avec sa reference, puis le controle a posteriori. Le bon a payer
// s'ouvre depuis une piece payable : #/paiements/nouveau?source=...&piece=...

export const PaiementsView = () => {
  const route = useRoute();
  if (route.vue !== VUE_PAIEMENTS || route.mode === 'liste') return <ListePaiements />;
  if (route.mode === 'nouveau') return <FormulairePaiement source={route.requete.source ?? ''} piece={route.requete.piece ?? ''} />;
  if (route.mode === 'action' && route.action) return <ActionPaiementVue id={route.id ?? ''} action={route.action} />;
  return <DetailPaiement id={route.id ?? ''} />;
};

const ListePaiements = () => {
  const { hasPermission } = useAuth();
  const peutSaisir = hasPermission('invoices', 'create') || hasPermission('invoices', 'edit');
  const [pieces, setPieces] = useState<PiecePayable[] | null>(null);
  const [erreurPieces, setErreurPieces] = useState('');
  const [paiements, setPaiements] = useState<Paiement[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const [r, p] = await Promise.all([
      supabase.from('v_reste_a_payer').select('*').order('date_piece', { ascending: false }),
      supabase.from('paiements_fournisseur').select('*').order('propose_le', { ascending: false }),
    ]);
    setErreurPieces(r.error ? `Pièces payables indisponibles : ${r.error.message}` : '');
    setPieces(r.error ? null : (r.data ?? []) as PiecePayable[]);
    setErreur(p.error ? `Paiements indisponibles : ${p.error.message}` : '');
    setPaiements(p.error ? null : (p.data ?? []) as Paiement[]);
    setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const colonnes = useMemo<ColonneListe<Paiement>[]>(() => [
    { id: 'numero', libelle: 'Numéro', valeur: (p) => p.numero },
    { id: 'beneficiaire', libelle: 'Bénéficiaire', valeur: (p) => p.beneficiaire },
    { id: 'objet', libelle: 'Objet', valeur: (p) => p.objet },
    { id: 'montant', libelle: 'Montant proposé', valeur: (p) => p.montant_propose, rendu: (p) => montantPaiement(p.montant_propose, p.devise), alignement: 'droite' },
    { id: 'devise', libelle: 'Devise', valeur: (p) => p.devise, masquee: true },
    { id: 'propose', libelle: 'Proposé le', valeur: (p) => p.propose_le, rendu: (p) => (p.propose_le ? new Date(p.propose_le).toLocaleDateString('fr-FR') : null) },
    { id: 'execution', libelle: 'Exécution', valeur: (p) => (p.statut === 'execute' ? `${p.execute_le ?? ''} ${MODES_PAIEMENT[p.mode ?? ''] ?? p.mode ?? ''} ${p.reference_execution ?? ''}`.trim() : null), masquee: true },
    { id: 'controle', libelle: 'Contrôle', valeur: (p) => (p.statut !== 'execute' ? null : p.controle_resultat === null ? 'à faire' : p.controle_resultat === 'conforme' ? 'conforme' : 'anomalie') },
    { id: 'statut', libelle: 'Statut', valeur: (p) => STATUTS_PAIEMENT[p.statut]?.texte ?? p.statut,
      rendu: (p) => <Puce teinte={STATUTS_PAIEMENT[p.statut]?.teinte ?? 'gris'}>{STATUTS_PAIEMENT[p.statut]?.texte ?? p.statut}</Puce> },
  ], []);
  const filtres = useMemo<FiltreListe<Paiement>[]>(() => [
    { id: 'statut', libelle: 'Statut', options: Object.entries(STATUTS_PAIEMENT).map(([valeur, s]) => ({ valeur, libelle: s.texte })), correspond: (p, v) => p.statut === v },
    { id: 'controle', libelle: 'Contrôle', options: [{ valeur: 'a_faire', libelle: 'À faire' }, { valeur: 'conforme', libelle: 'Conforme' }, { valeur: 'anomalie', libelle: 'Anomalie' }],
      correspond: (p, v) => p.statut === 'execute' && (v === 'a_faire' ? p.controle_resultat === null : p.controle_resultat === v) },
  ], []);

  const synthese = (
    <div className="space-y-4">
    <SituationPaiements />
    <Panneau titre="Pièces payables">
      {erreurPieces ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreurPieces}</p>
        : pieces === null ? <p role="status" className="text-sm text-stone-500">Chargement…</p>
          : pieces.length === 0 ? <SansDonnees message="Aucune facture contrôlée ni bon de commande reçu" /> : (
            <div className="overflow-x-auto"><table className="w-full text-sm" aria-label="Pièces payables"><thead><tr className="border-b text-left text-stone-500">
              <th className="py-2 pr-3">Pièce</th><th className="py-2 pr-3">Bénéficiaire</th><th className="py-2 pr-3">Base</th><th className="py-2 pr-3">Engagé</th>
              <th className="py-2 pr-3">Payé</th><th className="py-2 pr-3">Reste</th><th /></tr></thead>
            <tbody>{pieces.map((x) => <tr key={`${x.source}-${x.piece_id}`} className="border-b border-stone-100">
              <td className="py-2 pr-3"><b>{x.piece}</b><span className="block text-xs text-stone-500">{x.source === 'facture_loueur' ? 'Facture du loueur' : 'Bon de commande'} · {x.date_piece}</span></td>
              <td className="py-2 pr-3">{x.beneficiaire ?? 'Non renseigné'}</td><td className="py-2 pr-3">{montantPaiement(x.base, x.devise)}</td>
              <td className="py-2 pr-3">{montantPaiement(x.engage, x.devise)}</td><td className="py-2 pr-3">{montantPaiement(x.paye, x.devise)}</td>
              <td className="py-2 pr-3 font-bold">{montantPaiement(x.reste, x.devise)}</td>
              <td className="py-2">{peutSaisir && x.reste > 0 && <a href={routeBonAPayer(x)} aria-label={`Proposer un paiement ${x.piece}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Bon à payer</a>}</td>
            </tr>)}</tbody></table></div>
          )}
      <Provenance source="v_reste_a_payer (D-055) : base moins avoirs, déductions et part réclamée, moins engagé et payé" heure={heure} />
    </Panneau>
    </div>
  );

  return (
    <PageListe
      vue={VUE_PAIEMENTS}
      titre="Paiements fournisseurs"
      sousTitre="Bons à payer, approbation, paiements exécutés (hors SIGTB) et contrôle a posteriori. Aucun paiement n'est déclenché depuis l'application."
      lignes={paiements}
      erreur={erreur}
      colonnes={colonnes}
      filtres={filtres}
      placeholderRecherche="Rechercher un numéro, un bénéficiaire, un objet..."
      cle={(p) => p.id}
      libelleOuverture={(p) => `Fiche ${p.numero}`}
      synthese={synthese}
      nomExport="paiements_fournisseurs"
      vide={{ message: 'Aucun paiement enregistré', detail: 'Un bon à payer se propose depuis une pièce payable ci-dessus.' }}
      onActualiser={charger}
      provenance={<Provenance source="paiements_fournisseur (bons à payer, décisions, exécutions et contrôles enregistrés par le serveur)" heure={heure} />}
    />
  );
};
