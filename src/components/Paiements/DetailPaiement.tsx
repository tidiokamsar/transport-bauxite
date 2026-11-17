import { useEffect, useState, type ReactNode } from 'react';
import { Ban, CheckCircle2, ClipboardCheck, Landmark, AlertTriangle, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Historique } from '../ui/Historique';
import { Informations, OngletPieces, PageDetail, Relation } from '../ui/PageDetail';
import { Puce } from '../ui/Panneau';
import { fusionnerHistoriques, type EvenementHistorique } from '../ui/evenements';
import { lire, trouver, type Lecture } from '../ui/lecture';
import { routeAction, routeDetail } from '../ui/routeur';
import {
  MODES_PAIEMENT, MODULE_PAIEMENTS, STATUTS_PAIEMENT, VUE_PAIEMENTS, actionPaiementInterdite, montantPaiement, routeBonAPayer,
  type ActionPaiement, type Paiement, type PiecePayable,
} from './paiements';

// Fiche d'un paiement fournisseur (D-055, D-090) : piece reglee et son reste
// a payer, autres paiements de la meme piece, historique lu dans les
// horodatages du paiement (proposition, decision, execution, controle).

const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });
const jour = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR') : null);

export const DetailPaiement = ({ id }: { id: string }) => {
  const { hasPermission, profile } = useAuth();
  const droits = { saisir: hasPermission('invoices', 'create') || hasPermission('invoices', 'edit'), approuver: hasPermission('invoices', 'approve'), moi: profile?.id ?? null };
  const [paiement, setPaiement] = useState<Lecture<Paiement>>(attente);
  const [piece, setPiece] = useState<Lecture<PiecePayable>>(attente);
  const [freres, setFreres] = useState<Lecture<Paiement>>(attente);

  useEffect(() => {
    lire<Paiement>(supabase.from('paiements_fournisseur').select('*').eq('id', id), 'paiement').then((r) => {
      setPaiement(r);
      const p = trouver(r.lignes, id);
      if (!p) return;
      const pieceId = p.facture_fournisseur_id ?? p.purchase_order_id ?? '';
      const colonne = p.facture_fournisseur_id ? 'facture_fournisseur_id' : 'purchase_order_id';
      lire<PiecePayable>(supabase.from('v_reste_a_payer').select('*').eq('piece_id', pieceId), 'reste à payer de la pièce')
        .then((x) => setPiece({ ...x, lignes: x.lignes && x.lignes.filter((l) => l.piece_id === pieceId) }));
      lire<Paiement>(supabase.from('paiements_fournisseur').select('*').eq(colonne, pieceId).order('propose_le'), 'paiements de la pièce')
        .then((x) => setFreres({ ...x, lignes: x.lignes && x.lignes.filter((l) => (l.facture_fournisseur_id ?? l.purchase_order_id) === pieceId && l.id !== id) }));
    });
  }, [id]);

  const p = trouver(paiement.lignes, id);
  const possible = (a: ActionPaiement) => Boolean(p) && actionPaiementInterdite(a, p as Paiement, droits) === null;
  const statut = p ? STATUTS_PAIEMENT[p.statut] : null;

  // Horodatages enregistres sur le paiement ; l'annulation n'a pas d'horodatage
  // (colonne absente) : elle est decrite dans les informations, pas datee.
  const historique: EvenementHistorique[] | null = p ? fusionnerHistoriques([
    ...(p.propose_le ? [{ id: 'propose', le: p.propose_le, libelle: 'Bon à payer proposé', detail: `${montantPaiement(p.montant_propose, p.devise)} · ${p.objet}`, auteur: p.propose_par, source: 'paiements_fournisseur.propose_le' }] : []),
    ...(p.decide_le ? [{ id: 'decide', le: p.decide_le, libelle: p.statut === 'rejete' ? 'Paiement rejeté' : 'Paiement approuvé', motif: p.motif_decision, auteur: p.decide_par, source: 'paiements_fournisseur.decide_le' }] : []),
    ...(p.execute_saisi_le ? [{ id: 'execute', le: p.execute_saisi_le, libelle: 'Exécution enregistrée',
      detail: `Exécuté le ${jour(p.execute_le) ?? '?'} · ${MODES_PAIEMENT[p.mode ?? ''] ?? p.mode ?? ''} ${p.reference_execution ?? ''} · ${montantPaiement(p.montant_execute, p.devise)}`, auteur: p.execute_par, source: 'paiements_fournisseur.execute_saisi_le' }] : []),
    ...(p.controle_le ? [{ id: 'controle', le: p.controle_le, libelle: p.controle_resultat === 'conforme' ? 'Contrôle a posteriori : conforme' : 'Contrôle a posteriori : anomalie', motif: p.controle_motif, auteur: p.controle_par, source: 'paiements_fournisseur.controle_le' }] : []),
  ]) : null;

  const actions: { id: ActionPaiement; libelle: string; icone: ReactNode; ton?: 'principal' | 'danger' }[] = [
    { id: 'approuver', libelle: 'Approuver', icone: <CheckCircle2 className="h-4 w-4" />, ton: 'principal' },
    { id: 'rejeter', libelle: 'Rejeter', icone: <XCircle className="h-4 w-4" />, ton: 'danger' },
    { id: 'executer', libelle: 'Saisir l\'exécution', icone: <Landmark className="h-4 w-4" />, ton: 'principal' },
    { id: 'conforme', libelle: 'Contrôle conforme', icone: <ClipboardCheck className="h-4 w-4" /> },
    { id: 'anomalie', libelle: 'Signaler une anomalie', icone: <AlertTriangle className="h-4 w-4" />, ton: 'danger' },
    { id: 'annuler', libelle: 'Annuler', icone: <Ban className="h-4 w-4" />, ton: 'danger' },
  ];

  return (
    <PageDetail
      vue={VUE_PAIEMENTS}
      module={MODULE_PAIEMENTS}
      reference={p?.numero ?? 'Paiement'}
      statut={statut ? { libelle: statut.texte, teinte: statut.teinte } : null}
      resume={p && <>{p.beneficiaire} · {p.objet} · {montantPaiement(p.montant_propose, p.devise)}</>}
      chargement={paiement.lignes === null && !paiement.erreur}
      erreur={paiement.erreur}
      introuvable={paiement.lignes !== null && !p}
      actions={actions.map((a) => ({ ...a, visible: possible(a.id), vers: routeAction(VUE_PAIEMENTS, id, a.id) }))}
      onglets={!p ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <Informations groupes={[
            { titre: 'Bon à payer', champs: [['Numéro', p.numero], ['Pièce', p.facture_fournisseur_id ? 'Facture du loueur' : 'Bon de commande'], ['Bénéficiaire', p.beneficiaire],
              ['Objet', p.objet], ['Montant proposé', montantPaiement(p.montant_propose, p.devise)], ['Proposé le', p.propose_le ? new Date(p.propose_le).toLocaleString('fr-FR') : null]] },
            { titre: 'Décision', champs: [['Statut', statut?.texte ?? p.statut], ['Décidé le', p.decide_le ? new Date(p.decide_le).toLocaleString('fr-FR') : null],
              ['Motif de la décision', p.motif_decision], ['Motif de l\'annulation', p.motif_annulation]] },
            { titre: 'Exécution (hors SIGTB)', champs: [['Date d\'exécution', jour(p.execute_le)], ['Mode', p.mode ? MODES_PAIEMENT[p.mode] ?? p.mode : null],
              ['Référence bancaire', p.reference_execution], ['Montant exécuté', p.montant_execute === null ? null : montantPaiement(p.montant_execute, p.devise)]] },
            { titre: 'Contrôle a posteriori', champs: [['Résultat', p.statut !== 'execute' ? null : p.controle_resultat === null ? 'À faire' : p.controle_resultat === 'conforme' ? 'Conforme' : 'Anomalie'],
              ['Motif', p.controle_motif], ['Contrôlé le', p.controle_le ? new Date(p.controle_le).toLocaleString('fr-FR') : null]] },
          ]} />
        ) },
        { id: 'relations', libelle: 'Pièce et paiements liés', compte: freres.lignes?.length ?? null, contenu: (
          <div className="grid gap-4 lg:grid-cols-2">
            <Relation titre="Pièce réglée (reste à payer actuel)" lignes={piece.lignes} erreur={piece.erreur} cle={(x) => `${x.source}-${x.piece_id}`}
              vide="Pièce absente des pièces payables (soldée, suspendue ou hors de vos droits)"
              colonnes={[
                { libelle: 'Pièce', valeur: (x) => x.piece },
                { libelle: 'Base', valeur: (x) => montantPaiement(x.base, x.devise) },
                { libelle: 'Payé', valeur: (x) => montantPaiement(x.paye, x.devise) },
                { libelle: 'Reste', valeur: (x) => (
                  <span className="flex flex-wrap items-center gap-2"><b>{montantPaiement(x.reste, x.devise)}</b>
                    {droits.saisir && x.reste > 0 && <a href={routeBonAPayer(x)} className="rounded border border-stone-300 px-2 py-0.5 text-xs">Bon à payer</a>}</span>
                ) },
              ]} />
            <Relation titre="Autres paiements de la pièce" lignes={freres.lignes} erreur={freres.erreur} cle={(x) => x.id} vide="Aucun autre paiement"
              lien={(x) => routeDetail(VUE_PAIEMENTS, x.id)}
              colonnes={[
                { libelle: 'Numéro', valeur: (x) => x.numero },
                { libelle: 'Montant', valeur: (x) => montantPaiement(x.montant_propose, x.devise) },
                { libelle: 'Statut', valeur: (x) => <Puce teinte={STATUTS_PAIEMENT[x.statut]?.teinte ?? 'gris'}>{STATUTS_PAIEMENT[x.statut]?.texte ?? x.statut}</Puce> },
              ]} />
          </div>
        ) },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={historique} source="paiements_fournisseur (propose_le, decide_le, execute_saisi_le, controle_le)"
            absent="Aucune table de journal pour les paiements : l'historique est lu dans les horodatages du paiement ; l'annulation n'est pas horodatée (motif dans les informations)." />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="un paiement fournisseur" /> },
      ]}
    />
  );
};
