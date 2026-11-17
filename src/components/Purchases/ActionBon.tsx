import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { PageAction } from '../ui/PageAction';
import { ChampPage } from '../ui/PageFormulaire';
import { SansDonnees } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import type { SuiviArticle } from '../Stock/stock';
import {
  ACTIONS_BON, COLONNES_BON, COLONNES_LIGNE_BON, COLONNES_RECEPTION, MODULE_ACHATS, RECEPTION_VIDE, VUE_ACHATS, actionBonInterdite, lignesReceptionPourServeur,
  montantGnf, restantARecevoir, type ActionBon, type Bon, type LigneBon, type ReceptionBon, type SaisieReception,
} from './achats';

// Actions d'un bon de commande en pleine page (D-053, D-090, remplacent les
// window.prompt) : chacune par sa fonction serveur. Rejet, solde et
// annulations exigent un motif (controle serveur : motif non vide).

const TITRES: Record<ActionBon, string> = {
  soumettre: 'Soumettre à approbation', approuver: 'Approuver le bon', rejeter: 'Rejeter le bon', receptionner: 'Réceptionner le bon',
  solder: 'Solder le bon', annuler: 'Annuler le bon', 'annuler-reception': 'Annuler une réception',
};

export const ActionBonVue = ({ id, action, requete }: { id: string; action: string; requete: Record<string, string> }) => {
  const { hasPermission, profile } = useAuth();
  const droits = {
    acheter: hasPermission('purchases', 'create') || hasPermission('purchases', 'edit'),
    approuver: hasPermission('purchases', 'approve'),
    receptionner: hasPermission('stock', 'create') || hasPermission('stock', 'edit'),
  };
  const [bon, setBon] = useState<Bon | null>(null);
  const [lignes, setLignes] = useState<LigneBon[]>([]);
  const [receptions, setReceptions] = useState<ReceptionBon[]>([]);
  const [suivis, setSuivis] = useState<Map<string, SuiviArticle>>(new Map());
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);
  const [saisie, setSaisie] = useState<Record<string, SaisieReception>>({});
  const [bl, setBl] = useState('');

  useEffect(() => {
    Promise.all([
      lire<Bon>(supabase.from('purchase_orders').select(COLONNES_BON).eq('id', id), 'bon de commande'),
      lire<LigneBon>(supabase.from('purchase_order_items').select(COLONNES_LIGNE_BON).eq('purchase_order_id', id), 'lignes du bon'),
      lire<ReceptionBon>(supabase.from('deliveries').select(COLONNES_RECEPTION).eq('purchase_order_id', id), 'réceptions du bon'),
      supabase.from('stock_items').select('id, suivi'),
    ]).then(([b, l, r, a]) => {
      const ligne = trouver(b.lignes, id);
      setBon(ligne);
      setLignes((l.lignes ?? []).filter((x) => x.purchase_order_id === id));
      setReceptions((r.lignes ?? []).filter((x) => x.purchase_order_id === id));
      setSuivis(new Map(((a.data ?? []) as { id: string; suivi: SuiviArticle | null }[]).map((x) => [x.id, x.suivi ?? 'aucun'])));
      setErreur(b.erreur || l.erreur || r.erreur || (a.error ? `Articles indisponibles : ${a.error.message}` : '') || (ligne ? '' : 'Bon de commande introuvable ou hors de votre périmètre.'));
      setChargement(false);
    });
  }, [id]);

  if (!(ACTIONS_BON as readonly string[]).includes(action)) {
    return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action d'un bon de commande.`} />;
  }
  const a = action as ActionBon;
  const estDemandeur = Boolean(bon && profile && (bon.requested_by === profile.id || bon.soumis_par === profile.id));
  const interditEtat = bon ? actionBonInterdite(a, bon.status, droits, estDemandeur) : null;
  const commun = { vue: VUE_ACHATS, module: MODULE_ACHATS, reference: bon?.po_number ?? 'Bon de commande', id, chargement, erreurChargement: erreur };
  const rpc = async (fonction: string, args: Record<string, unknown>) => {
    const { error } = await supabase.rpc(fonction, args);
    return error ? error.message : null;
  };

  if (a === 'receptionner') {
    const suiviLigne = (l: LigneBon): SuiviArticle => (l.stock_item_id ? suivis.get(l.stock_item_id) ?? 'aucun' : 'aucun');
    const corps = lignesReceptionPourServeur(lignes.map((l) => ({ ...l, suivi: suiviLigne(l) })), saisie);
    const poser = (l: LigneBon, k: keyof SaisieReception, v: string) => setSaisie((s) => ({ ...s, [l.id]: { ...(s[l.id] ?? RECEPTION_VIDE), [k]: v } }));
    return (
      <PageAction
        {...commun}
        titre={TITRES[a]}
        description="Les quantités reçues entrent en stock au dépôt du bon ; une quantité refusée exige son motif. Les articles suivis exigent leurs lots ou numéros de série, chaque pneu son numéro."
        motif="aucun"
        libelleConfirmer="Enregistrer la réception"
        interdit={interditEtat}
        pret={corps !== null}
        messageSucces="Réception enregistrée : les articles sont entrés en stock."
        onExecuter={() => rpc('receptionner_bon_commande', { p_id: id, p_lignes: corps, p_bon_livraison: bl.trim() || null })}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-stone-500"><th className="py-2 pr-3">Ligne</th><th className="py-2 pr-3">Reste</th><th className="py-2 pr-3">Reçu maintenant</th><th className="py-2 pr-3">Refusé</th><th className="py-2 pr-3">Motif du refus</th><th className="py-2 pr-3">Lots, séries ou numéros de pneus</th></tr></thead>
            <tbody>{lignes.map((l) => {
              const s = saisie[l.id] ?? RECEPTION_VIDE;
              const suivi = suiviLigne(l);
              return (
                <tr key={l.id} className="border-b border-stone-100">
                  <td className="py-2 pr-3">{l.item_description}<span className="block text-xs text-stone-500">{montantGnf(l.unit_price)} l'unité{l.pneu_marque ? ' · pneus : un numéro par pneu reçu' : !l.stock_item_id ? ' · hors stock' : suivi !== 'aucun' ? (suivi === 'serie' ? ' · suivi par numéro de série' : ' · suivi par lot') : ''}</span></td>
                  <td className="py-2 pr-3">{restantARecevoir(l.quantity, l.quantity_received)}</td>
                  <td className="py-1 pr-2"><input aria-label={`Reçu ${l.item_description}`} inputMode="numeric" value={s.recue} onChange={(e) => poser(l, 'recue', e.target.value)} placeholder={`max ${restantARecevoir(l.quantity, l.quantity_received)}`} className={CHAMP_FENETRE} /></td>
                  <td className="py-1 pr-2"><input aria-label={`Refusé ${l.item_description}`} inputMode="numeric" value={s.refusee} onChange={(e) => poser(l, 'refusee', e.target.value)} className={CHAMP_FENETRE} /></td>
                  <td className="py-1 pr-2"><input aria-label={`Motif du refus ${l.item_description}`} value={s.motif} onChange={(e) => poser(l, 'motif', e.target.value)} className={CHAMP_FENETRE} /></td>
                  <td className="py-1 pr-2">{l.pneu_marque
                    ? <textarea aria-label={`Numéros des pneus ${l.item_description}`} rows={2} placeholder="Un numéro par ligne" value={s.pneus ?? ''} onChange={(e) => poser(l, 'pneus', e.target.value)} className={CHAMP_FENETRE} />
                    : suivi !== 'aucun'
                      ? <textarea aria-label={`Lots ${l.item_description}`} rows={2} placeholder={suivi === 'serie' ? 'Un numéro de série par ligne' : 'CODE QUANTITÉ, un lot par ligne'} value={s.lots ?? ''} onChange={(e) => poser(l, 'lots', e.target.value)} className={CHAMP_FENETRE} />
                      : <span className="text-xs text-stone-400">—</span>}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        {lignes.some((l) => l.pneu_marque) && (
          <p role="note" className="rounded bg-orange-50 p-2 text-xs text-orange-800">
            Pneus : chaque pneu reçu entre au registre des pneus. La réception ne pourra plus être annulée dès qu'un de ses pneus aura été monté ou mouvementé (D-067) ; vérifiez les numéros avant d'enregistrer.
          </p>
        )}
        <ChampPage libelle="Bon de livraison du fournisseur">
          <input value={bl} onChange={(e) => setBl(e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
      </PageAction>
    );
  }

  if (a === 'annuler-reception') {
    const reception = receptions.find((r) => r.id === requete.reception) ?? null;
    return (
      <PageAction
        {...commun}
        titre={`${TITRES[a]}${reception ? ` ${reception.delivery_number}` : ''}`}
        description="Les quantités de la réception sont retirées du stock (contre-mouvement) ; refusé par le serveur si un pneu de la réception a déjà été monté ou mouvementé."
        motif="obligatoire"
        motifMinimum={1}
        libelleConfirmer="Annuler la réception"
        danger
        interdit={interditEtat ?? (!chargement && !reception ? 'Réception introuvable sur ce bon.' : reception?.annule_le ? 'Réception déjà annulée.' : null)}
        messageSucces="Réception annulée : stock corrigé."
        onExecuter={(motif) => rpc('annuler_reception', { p_livraison: reception?.id, p_motif: motif })}
      />
    );
  }

  const definition: Record<Exclude<ActionBon, 'receptionner' | 'annuler-reception'>, {
    description: string; motif: 'obligatoire' | 'aucun'; confirmer: string; succes: string; danger?: boolean; executer: (motif: string) => Promise<string | null>;
  }> = {
    soumettre: { description: 'Le bon est figé et transmis à l\'approbation d\'une autre personne que son auteur.', motif: 'aucun', confirmer: 'Soumettre', succes: 'Bon soumis à approbation.',
      executer: () => rpc('soumettre_bon_commande', { p_id: id }) },
    approuver: { description: 'Le bon approuvé peut être réceptionné par le magasin.', motif: 'aucun', confirmer: 'Approuver', succes: 'Bon approuvé.',
      executer: () => rpc('decider_bon_commande', { p_id: id, p_approuver: true }) },
    rejeter: { description: 'Le bon rejeté est clos ; le motif est conservé sur le bon et au journal.', motif: 'obligatoire', confirmer: 'Rejeter', succes: 'Bon rejeté.', danger: true,
      executer: (m) => rpc('decider_bon_commande', { p_id: id, p_approuver: false, p_motif: m }) },
    solder: { description: 'Le reliquat ne sera pas livré ; le bon est clos.', motif: 'obligatoire', confirmer: 'Solder', succes: 'Bon soldé.',
      executer: (m) => rpc('solder_bon_commande', { p_id: id, p_motif: m }) },
    annuler: { description: 'Le bon est annulé (jamais supprimé) ; le motif est conservé au journal.', motif: 'obligatoire', confirmer: 'Annuler le bon', succes: 'Bon annulé.', danger: true,
      executer: (m) => rpc('annuler_bon_commande', { p_id: id, p_motif: m }) },
  };
  const d = definition[a];
  return (
    <PageAction
      {...commun}
      titre={TITRES[a]}
      description={d.description}
      motif={d.motif}
      motifMinimum={1}
      libelleConfirmer={d.confirmer}
      danger={d.danger}
      interdit={interditEtat}
      messageSucces={d.succes}
      onExecuter={d.executer}
    />
  );
};
