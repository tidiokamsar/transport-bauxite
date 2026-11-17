import { useEffect, useState } from 'react';
import { Ban } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Historique } from '../ui/Historique';
import { Informations, OngletPieces, PageDetail, Relation } from '../ui/PageDetail';
import { fusionnerHistoriques, type EvenementHistorique } from '../ui/evenements';
import { lire, trouver, type Lecture } from '../ui/lecture';
import { routeAction, routeDetail } from '../ui/routeur';
import { COLONNES_COUT, MODULE_COUTS, VUE_COUTS, annulationCoutInterdite, libelleCout, type Cout } from './couts';

// Fiche d'une depense (D-058, D-090) : informations, rattachements (site,
// engin, piece du circuit fournisseur reprise), historique lu dans les
// horodatages de la depense (saisie, annulation).

interface Rattachement { id: string; type: string; libelle: string; vers: string | null }
const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

export const DetailCout = ({ id }: { id: string }) => {
  const { hasPermission } = useAuth();
  const peutSaisir = hasPermission('costs', 'create') || hasPermission('costs', 'edit');
  const [cout, setCout] = useState<Lecture<Cout>>({ lignes: null, erreur: '' });
  const [piece, setPiece] = useState<{ libelle: string | null; erreur: string }>({ libelle: null, erreur: '' });

  useEffect(() => {
    lire<Cout>(supabase.from('costs').select(COLONNES_COUT).eq('id', id), 'dépense').then(async (r) => {
      setCout(r);
      const c = trouver(r.lignes, id);
      if (!c?.piece_reprise_id || !c.piece_reprise_source) return;
      const req = c.piece_reprise_source === 'bon_commande'
        ? supabase.from('purchase_orders').select('id, po_number').eq('id', c.piece_reprise_id)
        : supabase.from('factures_fournisseur').select('id, numero_fournisseur').eq('id', c.piece_reprise_id);
      const { data, error } = await req;
      const l = ((data ?? []) as { id: string; po_number?: string; numero_fournisseur?: string }[]).find((x) => x.id === c.piece_reprise_id);
      setPiece({ libelle: l ? (l.po_number ?? l.numero_fournisseur ?? null) : null, erreur: error ? `Pièce reprise non lue : ${error.message}` : '' });
    });
  }, [id]);

  const c = trouver(cout.lignes, id);
  const rattachements: Rattachement[] = !c ? [] : [
    ...(c.site_id ? [{ id: 'site', type: 'Site', libelle: c.sites?.name ?? 'Site', vers: routeDetail('sites', c.site_id) }] : []),
    ...(c.vehicle_id ? [{ id: 'engin', type: 'Engin', libelle: c.vehicles?.registration ?? 'Engin', vers: routeDetail('vehicles', c.vehicle_id) }] : []),
    ...(c.piece_reprise_id ? [{ id: 'piece', type: c.piece_reprise_source === 'bon_commande' ? 'Bon de commande repris' : 'Facture du loueur reprise',
      libelle: piece.libelle ?? 'Pièce non visible avec vos droits', vers: null }] : []),
  ];

  const historique: EvenementHistorique[] | null = c ? fusionnerHistoriques([
    ...(c.created_at ? [{ id: 'saisie', le: c.created_at, libelle: 'Dépense enregistrée', detail: `${nombre.format(c.amount)} ${c.devise ?? ''}`.trim(), auteur: c.created_by ?? null, source: 'costs.created_at' }] : []),
    ...(c.annule_le ? [{ id: 'annulation', le: c.annule_le, libelle: 'Dépense annulée', motif: c.motif_annulation, auteur: c.annule_par ?? null, source: 'costs.annule_le' }] : []),
  ]) : null;

  return (
    <PageDetail
      vue={VUE_COUTS}
      module={MODULE_COUTS}
      reference={c ? libelleCout(c) : 'Dépense'}
      titre={c ? `${c.numero ?? 'Sans numéro'} · ${c.description}` : undefined}
      statut={c ? (c.statut === 'annule' ? { libelle: 'Annulée', teinte: 'gris' } : { libelle: 'Enregistrée', teinte: 'vert' }) : null}
      resume={c && <>{c.date.split('-').reverse().join('/')} · {nombre.format(c.amount)} {c.devise ?? '(devise non renseignée)'} TTC</>}
      chargement={cout.lignes === null && !cout.erreur}
      erreur={cout.erreur}
      introuvable={cout.lignes !== null && !c}
      actions={[{ id: 'annuler', libelle: 'Annuler la dépense', icone: <Ban className="h-4 w-4" />, ton: 'danger',
        visible: Boolean(c) && annulationCoutInterdite(c as Cout, peutSaisir) === null, vers: routeAction(VUE_COUTS, id, 'annuler') }]}
      onglets={!c ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <Informations groupes={[
            { titre: 'Dépense', champs: [['Numéro', c.numero], ['Date', c.date.split('-').reverse().join('/')], ['Description', c.description],
              ['Montant TTC', `${nombre.format(c.amount)} ${c.devise ?? ''}`.trim()], ['Devise', c.devise], ['Catégorie', c.cost_categories?.name ?? null]] },
            { titre: 'Pièce et règlement', champs: [['Référence', c.reference], ['Mode de paiement', c.payment_method], ['Notes', c.notes],
              ['Statut', c.statut === 'annule' ? 'Annulée' : 'Enregistrée'], ['Motif d\'annulation', c.motif_annulation]] },
          ]} />
        ) },
        { id: 'relations', libelle: 'Rattachements', compte: rattachements.length, contenu: (
          <Relation titre="Rattachements" lignes={rattachements} erreur={piece.erreur} cle={(r) => r.id} vide="Ni site, ni engin, ni pièce reprise (dépense du siège)"
            lien={(r) => r.vers ?? routeDetail(VUE_COUTS, id, 'relations')}
            colonnes={[{ libelle: 'Élément', valeur: (r) => r.libelle }, { libelle: 'Type', valeur: (r) => r.type }]}
            note="Une dépense qui reprend une pièce fournisseur n'est pas recomptée au réalisé budgétaire : la pièce y figure déjà." />
        ) },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={historique} source="costs (created_at, annule_le)"
            absent="Aucune table de journal pour les coûts : l'historique est lu dans les horodatages de la dépense." />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="une dépense" /> },
      ]}
    />
  );
};
