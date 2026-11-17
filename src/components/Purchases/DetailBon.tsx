import { useEffect, useState } from 'react';
import { Ban, CheckCircle2, PackageCheck, Pencil, Send, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Historique } from '../ui/Historique';
import { Informations, OngletPieces, PageDetail, Relation } from '../ui/PageDetail';
import { fusionnerHistoriques, type EvenementHistorique } from '../ui/evenements';
import { lire, trouver, type Lecture } from '../ui/lecture';
import { ecrireRoute, routeAction, routeDetail, routeModifier } from '../ui/routeur';
import {
  COLONNES_BON, COLONNES_LIGNE_BON, COLONNES_RECEPTION, LIBELLE_EVENEMENT_ACHAT, MODULE_ACHATS, STATUTS_BON, VUE_ACHATS, actionBonInterdite, montantGnf, operationsPossibles,
  type ActionBon, type Bon, type LigneBon, type ReceptionBon,
} from './achats';

// Fiche d'un bon de commande (D-053, D-090) : en-tete, lignes et
// receptions (avec refus motives), historique tire de achats_journal,
// actions selon le droit, le statut et l'auteur du bon.

interface LigneReception { id: string; delivery_id: string; po_item_id: string; quantite_recue: number; quantite_refusee: number; motif_refus: string | null }
interface Journal { id: string; purchase_order_id: string; evenement: string; motif: string | null; par: string | null; le: string }

const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });
const jour = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString('fr-FR') : null);

export const DetailBon = ({ id }: { id: string }) => {
  const { hasPermission, profile } = useAuth();
  const droits = {
    acheter: hasPermission('purchases', 'create') || hasPermission('purchases', 'edit'),
    approuver: hasPermission('purchases', 'approve'),
    receptionner: hasPermission('stock', 'create') || hasPermission('stock', 'edit'),
  };
  const [bon, setBon] = useState<Lecture<Bon>>(attente);
  const [lignes, setLignes] = useState<Lecture<LigneBon>>(attente);
  const [receptions, setReceptions] = useState<Lecture<ReceptionBon>>(attente);
  const [lignesReception, setLignesReception] = useState<LigneReception[]>([]);
  const [journal, setJournal] = useState<Lecture<Journal>>(attente);
  const [noms, setNoms] = useState({ fournisseur: '', depot: '' });

  useEffect(() => {
    lire<Bon>(supabase.from('purchase_orders').select(COLONNES_BON).eq('id', id), 'bon de commande').then(async (r) => {
      setBon(r);
      const b = trouver(r.lignes, id);
      if (!b) return;
      const [f, d] = await Promise.all([
        supabase.from('suppliers').select('id, company_name').eq('id', b.supplier_id),
        b.warehouse_id ? supabase.from('warehouses').select('id, name, code').eq('id', b.warehouse_id) : Promise.resolve({ data: [] }),
      ]);
      const fo = ((f.data ?? []) as { id: string; company_name: string }[]).find((x) => x.id === b.supplier_id);
      const de = ((d.data ?? []) as { id: string; name: string; code: string }[]).find((x) => x.id === b.warehouse_id);
      setNoms({ fournisseur: fo?.company_name ?? '', depot: de ? `${de.name} (${de.code})` : '' });
    });
    lire<LigneBon>(supabase.from('purchase_order_items').select(COLONNES_LIGNE_BON).eq('purchase_order_id', id), 'lignes du bon')
      .then((r) => setLignes({ ...r, lignes: r.lignes && r.lignes.filter((l) => l.purchase_order_id === id) }));
    lire<ReceptionBon>(supabase.from('deliveries').select(COLONNES_RECEPTION).eq('purchase_order_id', id).order('created_at'), 'réceptions du bon').then(async (r) => {
      const liste = r.lignes && r.lignes.filter((x) => x.purchase_order_id === id);
      setReceptions({ ...r, lignes: liste });
      if (!liste?.length) return;
      const { data } = await supabase.from('receptions_achat_lignes').select('id, delivery_id, po_item_id, quantite_recue, quantite_refusee, motif_refus').in('delivery_id', liste.map((x) => x.id));
      setLignesReception((data ?? []) as LigneReception[]);
    });
    lire<Journal>(supabase.from('achats_journal').select('id, purchase_order_id, evenement, motif, par, le').eq('purchase_order_id', id).order('le'), 'journal du bon')
      .then((r) => setJournal({ ...r, lignes: r.lignes && r.lignes.filter((j) => j.purchase_order_id === id) }));
  }, [id]);

  const b = trouver(bon.lignes, id);
  const estDemandeur = Boolean(b && profile && (b.requested_by === profile.id || b.soumis_par === profile.id));
  const possible = (a: ActionBon) => Boolean(b) && actionBonInterdite(a, b?.status ?? 'draft', droits, estDemandeur) === null;
  const statut = b ? STATUTS_BON[b.status] : null;

  const historique: EvenementHistorique[] | null = b && journal.lignes ? fusionnerHistoriques(
    journal.lignes.map((j) => ({ id: `achats_journal-${j.id}`, le: j.le, libelle: LIBELLE_EVENEMENT_ACHAT[j.evenement] ?? j.evenement, motif: j.motif, auteur: j.par, source: 'achats_journal' })),
    journal.lignes.length === 0 && b.created_at ? [{ id: 'purchase_orders-cree', le: b.created_at, libelle: 'Bon créé', source: 'purchase_orders.created_at' }] : [],
  ) : null;

  const detailReception = (r: ReceptionBon) => lignesReception.filter((x) => x.delivery_id === r.id)
    .map((x) => `${x.quantite_recue} reçu(s)${x.quantite_refusee ? `, ${x.quantite_refusee} refusé(s) (${x.motif_refus})` : ''}`).join(' ; ');
  const annulerReception = (r: ReceptionBon) => ecrireRoute({ vue: VUE_ACHATS, mode: 'action', id, action: 'annuler-reception', requete: { reception: r.id } });

  return (
    <PageDetail
      vue={VUE_ACHATS}
      module={MODULE_ACHATS}
      reference={b?.po_number ?? 'Bon de commande'}
      titre={b ? `Bon ${b.po_number}` : undefined}
      statut={statut ? { libelle: statut.texte, teinte: statut.teinte } : null}
      resume={b && <>{noms.fournisseur || 'Fournisseur'} · Total {montantGnf(b.total_amount)}{(b.motif_decision || b.motif_cloture) ? ` · ${b.motif_decision ?? b.motif_cloture}` : ''}</>}
      chargement={bon.lignes === null && !bon.erreur}
      erreur={bon.erreur}
      introuvable={bon.lignes !== null && !b}
      actions={[
        { id: 'modifier', libelle: 'Modifier', icone: <Pencil className="h-4 w-4" />, visible: Boolean(b) && droits.acheter && operationsPossibles(b?.status ?? 'cancelled').modifier, vers: routeModifier(VUE_ACHATS, id) },
        { id: 'soumettre', libelle: 'Soumettre à approbation', icone: <Send className="h-4 w-4" />, visible: possible('soumettre'), ton: 'principal', vers: routeAction(VUE_ACHATS, id, 'soumettre') },
        { id: 'approuver', libelle: 'Approuver', icone: <CheckCircle2 className="h-4 w-4" />, visible: possible('approuver'), ton: 'principal', vers: routeAction(VUE_ACHATS, id, 'approuver') },
        { id: 'rejeter', libelle: 'Rejeter', icone: <XCircle className="h-4 w-4" />, visible: possible('rejeter'), ton: 'danger', vers: routeAction(VUE_ACHATS, id, 'rejeter') },
        { id: 'receptionner', libelle: 'Réceptionner', icone: <PackageCheck className="h-4 w-4" />, visible: possible('receptionner'), ton: 'principal', vers: routeAction(VUE_ACHATS, id, 'receptionner') },
        { id: 'solder', libelle: 'Solder', visible: possible('solder'), vers: routeAction(VUE_ACHATS, id, 'solder') },
        { id: 'annuler', libelle: 'Annuler le bon', icone: <Ban className="h-4 w-4" />, visible: possible('annuler'), ton: 'danger', vers: routeAction(VUE_ACHATS, id, 'annuler') },
      ]}
      onglets={!b ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <div className="space-y-4">
            {droits.approuver && b.status === 'submitted' && estDemandeur && (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">L'approbation revient à une autre personne que le demandeur.</p>
            )}
            <Informations groupes={[
              { titre: 'Bon de commande', champs: [['Numéro', b.po_number], ['Date', jour(b.po_date)], ['Fournisseur', noms.fournisseur || null], ['Dépôt de livraison', b.warehouse_id ? noms.depot || null : 'Sans dépôt'],
                ['Livraison prévue', jour(b.expected_delivery_date)], ['Statut', statut?.texte ?? b.status], ['Note', b.notes]] },
              { titre: 'Montants (calculés par le serveur)', champs: [['Sous-total', montantGnf(b.subtotal)], ['Taxes', montantGnf(b.tax_amount)], ['Total', montantGnf(b.total_amount)],
                ['Motif de la décision', b.motif_decision], ['Motif du solde ou de l\'annulation', b.motif_cloture]] },
            ]} />
          </div>
        ) },
        { id: 'relations', libelle: 'Lignes et réceptions', compte: lignes.lignes?.length ?? null, contenu: (
          <div className="space-y-4">
            <Relation titre="Lignes" lignes={lignes.lignes} erreur={lignes.erreur} cle={(l) => l.id} vide="Aucune ligne"
              lien={(l) => (l.stock_item_id ? routeDetail('stock', `article-${l.stock_item_id}`) : routeDetail(VUE_ACHATS, id, 'relations'))}
              colonnes={[
                { libelle: 'Ligne', valeur: (l) => <>{l.item_description}{l.pneu_marque ? <span className="block text-xs text-stone-500">Pneus</span> : !l.stock_item_id && <span className="block text-xs text-stone-500">Hors stock</span>}</> },
                { libelle: 'Commandé', valeur: (l) => l.quantity },
                { libelle: 'Reçu', valeur: (l) => l.quantity_received ?? 0 },
                { libelle: 'Prix unitaire', valeur: (l) => montantGnf(l.unit_price) },
                { libelle: 'Montant', valeur: (l) => montantGnf(l.total_price) },
              ]} />
            <Relation titre="Réceptions" lignes={receptions.lignes} erreur={receptions.erreur} cle={(r) => r.id} vide="Aucune réception"
              colonnes={[
                { libelle: 'Réception', valeur: (r) => <span className={r.annule_le ? 'text-stone-400 line-through' : ''}>{r.delivery_number}</span> },
                { libelle: 'Date', valeur: (r) => jour(r.delivery_date) },
                { libelle: 'Bon de livraison', valeur: (r) => r.bon_livraison ?? '—' },
                { libelle: 'Détail', valeur: (r) => detailReception(r) || '—' },
                { libelle: 'État', valeur: (r) => (r.annule_le ? `Annulée : ${r.motif_annulation ?? ''}` : possible('annuler-reception')
                  ? <a href={annulerReception(r)} aria-label={`Annuler la réception ${r.delivery_number}`} className="rounded border border-stone-300 px-2 py-1 text-xs font-semibold">Annuler</a>
                  : 'Enregistrée') },
              ]} />
          </div>
        ) },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={historique} erreur={journal.erreur} source="achats_journal (création, modification, soumission, décision, réceptions, solde, annulation)" />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="un bon de commande" /> },
      ]}
    />
  );
};
