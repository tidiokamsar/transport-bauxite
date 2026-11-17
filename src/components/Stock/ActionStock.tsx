import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PageAction } from '../ui/PageAction';
import { SansDonnees } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import {
  COLONNES_ARTICLE, COLONNES_MOUVEMENT, COLONNES_RESERVATION, LIBELLE_MOUVEMENT_STOCK, MODULE_STOCK, VUE_STOCK, idRouteStock,
  type ArticleStock, type MouvementStock, type ObjetStock, type Reservation,
} from './stock';

// Actions du registre des stocks en pleine page (D-044, D-067, D-090,
// remplacent window.prompt et window.confirm) : annulation d'un mouvement
// (contre-mouvement, annuler_mouvement_stock) et levee d'une reservation
// (lever_reservation_stock), motif exige par le serveur ; archivage d'un
// article dans sa table sous RLS comme l'ecran d'origine, sans motif
// (aucune colonne ne le conserverait).

const ACTIONS: Record<ObjetStock, string[]> = { article: ['archiver'], depot: [], mouvement: ['annuler'], reservation: ['lever'] };

export const ActionStock = ({ objet, id, action }: { objet: ObjetStock; id: string; action: string }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('stock', 'create') || hasPermission('stock', 'edit');
  const [article, setArticle] = useState<ArticleStock | null>(null);
  const [mouvement, setMouvement] = useState<MouvementStock | null>(null);
  const [dejaAnnule, setDejaAnnule] = useState(false);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    const finir = (e: string, trouve: boolean, quoi: string) => { setErreur(e || (trouve ? '' : `${quoi} introuvable ou hors de votre périmètre.`)); setChargement(false); };
    if (objet === 'article') {
      lire<ArticleStock>(supabase.from('stock_items').select(COLONNES_ARTICLE).eq('id', id), 'article').then((r) => { const a = trouver(r.lignes, id); setArticle(a); finir(r.erreur, Boolean(a), 'Article'); });
    } else if (objet === 'mouvement') {
      Promise.all([
        lire<MouvementStock>(supabase.from('stock_movements').select(COLONNES_MOUVEMENT).eq('id', id), 'mouvement'),
        lire<MouvementStock>(supabase.from('stock_movements').select(COLONNES_MOUVEMENT).eq('annule_mouvement_id', id), 'annulations'),
      ]).then(([r, a]) => {
        const m = trouver(r.lignes, id);
        setMouvement(m);
        setDejaAnnule((a.lignes ?? []).some((x) => x.annule_mouvement_id === id));
        finir(r.erreur || a.erreur, Boolean(m), 'Mouvement');
      });
    } else if (objet === 'reservation') {
      lire<Reservation>(supabase.from('v_reservations_stock').select(COLONNES_RESERVATION).eq('id', id), 'réservation').then((r) => { const x = trouver(r.lignes, id); setReservation(x); finir(r.erreur, Boolean(x), 'Réservation'); });
    } else {
      setChargement(false);
    }
  }, [objet, id]);

  if (!ACTIONS[objet].includes(action)) {
    return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action de cet objet du registre des stocks.`} />;
  }
  const droit = peutEcrire ? null : 'Droit d\'écriture sur les stocks requis.';
  const commun = { vue: VUE_STOCK, module: MODULE_STOCK, id: idRouteStock(objet, id), chargement, erreurChargement: erreur };
  const rpc = async (fonction: string, args: Record<string, unknown>) => {
    const { error } = await supabase.rpc(fonction, args);
    return error ? error.message : null;
  };

  if (objet === 'article') {
    return (
      <PageAction
        {...commun}
        reference={article?.item_code ?? 'Article'}
        titre={`Archiver l'article ${article?.item_code ?? ''}`.trim()}
        description="L'article archivé ne se propose plus aux saisies ; son historique et ses mouvements restent consultables."
        motif="aucun"
        libelleConfirmer="Archiver"
        danger
        interdit={droit ?? (article?.active === false ? 'Article déjà archivé.' : null)}
        messageSucces="Article archivé."
        onExecuter={async () => {
          const { error } = await supabase.from('stock_items').update({ active: false }).eq('id', id);
          return error ? error.message : null;
        }}
      />
    );
  }

  if (objet === 'mouvement') {
    return (
      <PageAction
        {...commun}
        reference={mouvement?.movement_number ?? 'Mouvement'}
        titre={`Annuler le mouvement ${mouvement?.movement_number ?? ''}`.trim()}
        description={mouvement ? `${LIBELLE_MOUVEMENT_STOCK[mouvement.movement_type] ?? mouvement.movement_type} de ${mouvement.quantity} : un contre-mouvement est créé, le mouvement d'origine reste au registre.` : undefined}
        motif="obligatoire"
        motifMinimum={1}
        libelleConfirmer="Annuler le mouvement"
        danger
        interdit={droit ?? (mouvement?.movement_type === 'annulation' ? 'Un contre-mouvement ne s\'annule pas.' : dejaAnnule ? 'Mouvement déjà annulé.' : null)}
        messageSucces="Mouvement annulé."
        onExecuter={(motif) => rpc('annuler_mouvement_stock', { p_id: id, p_motif: motif })}
      />
    );
  }

  return (
    <PageAction
      {...commun}
      reference={reservation?.numero ?? 'Réservation'}
      titre={`Lever la réservation ${reservation?.numero ?? ''}`.trim()}
      description="Le reste non sorti redevient libre ; les sorties déjà faites restent au registre."
      motif="obligatoire"
      motifMinimum={1}
      libelleConfirmer="Lever la réservation"
      danger
      interdit={droit ?? (reservation && reservation.statut !== 'active' ? 'Seule une réservation active se lève.' : null)}
      messageSucces="Réservation levée."
      onExecuter={(motif) => rpc('lever_reservation_stock', { p_id: id, p_motif: motif })}
    />
  );
};
