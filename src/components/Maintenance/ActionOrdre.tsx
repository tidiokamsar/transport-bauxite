import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { PageAction } from '../ui/PageAction';
import { ChampPage } from '../ui/PageFormulaire';
import { SansDonnees } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import { routeDetail } from '../ui/routeur';
import { lotsPourMouvement, type SuiviArticle } from '../Stock/stock';
import { ACTIONS_ORDRE, COLONNES_ORDRE, MODULE_ORDRES, VUE_ORDRES, actionOrdreInterdite, type ActionOrdre, type Ordre, type PieceOrdre } from './ordres';

// Actions d'un ordre de travail en pleine page (D-061, D-090, remplace les
// window.confirm et window.prompt). Annulation de l'ordre et d'un mouvement
// de piece : motif exige par annuler_ordre_travail et annuler_mouvement_stock
// (non vide). Pieces : mouvement_stock rattache a l'ordre (D-044, D-067).
// Demarrer et terminer : mise a jour de maintenance_orders sous droits de
// colonne, comme l'ecran d'origine (aucune fonction serveur dediee ; gardes
// d'etat du declencheur garde_ordre_travail ; pas de motif conserve).

interface Article { id: string; item_code: string; name: string; unit_price: number | null; suivi?: SuiviArticle | null; active?: boolean | null }
interface Depot { id: string; code: string; name: string; active?: boolean | null }
interface Reservation { id: string; numero: string; stock_item_id: string; warehouse_id: string; quantite_restante: number; maintenance_order_id: string | null; statut: string }

const TITRES: Record<ActionOrdre, string> = {
  demarrer: 'Démarrer l\'ordre', terminer: 'Terminer l\'ordre', annuler: 'Annuler l\'ordre de travail',
  sortir: 'Sortir une pièce du stock', retourner: 'Retourner une pièce au stock', 'annuler-mouvement': 'Annuler un mouvement de pièce',
};
const entier = (v: string) => (v.trim() === '' ? null : Number.parseInt(v.replace(/\s/g, ''), 10));
const aujourdhui = () => new Date().toISOString().slice(0, 10);

export const ActionOrdreVue = ({ id, action, requete }: { id: string; action: string; requete: Record<string, string> }) => {
  const { hasPermission } = useAuth();
  const droits = {
    maintenance: hasPermission('maintenance', 'create') || hasPermission('maintenance', 'edit'),
    stock: hasPermission('stock', 'create') || hasPermission('stock', 'edit'),
  };
  const [ordre, setOrdre] = useState<Ordre | null>(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);
  const [articles, setArticles] = useState<Article[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [pieces, setPieces] = useState<PieceOrdre[]>([]);
  const [champs, setChamps] = useState({ article: '', depot: '', quantite: '', note: '', reservation: '', lots: '' });
  const poser = (k: keyof typeof champs, v: string) => setChamps((c) => ({ ...c, [k]: v }));
  const piecesAction = action === 'sortir' || action === 'retourner';

  useEffect(() => {
    const lectures = [
      lire<Ordre>(supabase.from('maintenance_orders').select(COLONNES_ORDRE).eq('id', id), 'ordre de travail').then((r) => {
        const o = trouver(r.lignes, id);
        setOrdre(o);
        return r.erreur || (o ? '' : 'Ordre introuvable ou hors de votre périmètre.');
      }),
    ];
    if (piecesAction) {
      lectures.push(Promise.all([
        supabase.from('stock_items').select('id, item_code, name, unit_price, active, suivi').order('item_code'),
        supabase.from('warehouses').select('id, code, name, active').order('code'),
        supabase.from('v_reservations_stock').select('id, numero, stock_item_id, warehouse_id, quantite_restante, maintenance_order_id, statut').eq('maintenance_order_id', id).eq('statut', 'active'),
      ]).then(([a, d, r]) => {
        setArticles(((a.data ?? []) as Article[]).filter((x) => x.active !== false));
        setDepots(((d.data ?? []) as Depot[]).filter((x) => x.active !== false));
        setReservations(((r.data ?? []) as Reservation[]).filter((x) => x.maintenance_order_id === id && x.statut === 'active'));
        // Reservations illisibles : signale (D-067 revue C8), jamais « aucune reservation » en silence.
        return a.error ? `Articles indisponibles : ${a.error.message}` : d.error ? `Dépôts indisponibles : ${d.error.message}`
          : r.error ? `Réservations de l'ordre illisibles : ${r.error.message}` : '';
      }));
    }
    if (action === 'annuler-mouvement') {
      lectures.push(Promise.resolve(supabase.rpc('pieces_ordre_travail', { p_ordre: id })).then(({ data, error }) => {
        setPieces((data ?? []) as PieceOrdre[]);
        return error ? `Pièces de l'ordre illisibles : ${error.message}` : '';
      }));
    }
    Promise.all(lectures).then((erreurs) => {
      setErreur(erreurs.find(Boolean) ?? '');
      setChargement(false);
    });
  }, [id, action, piecesAction]);

  if (!(ACTIONS_ORDRE as readonly string[]).includes(action)) {
    return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action d'un ordre de travail.`} />;
  }
  const a = action as ActionOrdre;
  const reference = ordre?.work_order_number ?? ordre?.title ?? 'Ordre de travail';
  const commun = { vue: VUE_ORDRES, module: MODULE_ORDRES, reference, id, chargement, erreurChargement: erreur };
  const interditEtat = ordre ? actionOrdreInterdite(a, ordre.status, droits) : null;
  const executer = async (appel: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await appel;
    return error ? error.message : null;
  };

  if (a === 'annuler') {
    return (
      <PageAction
        {...commun}
        titre={TITRES.annuler}
        description="L'ordre annulé reste consultable avec son motif ; il ne se modifie plus. Les pièces encore imputées doivent d'abord être retournées ou leurs sorties annulées (contrôle serveur)."
        motif="obligatoire"
        motifMinimum={1}
        libelleConfirmer="Annuler l'ordre"
        danger
        interdit={interditEtat}
        messageSucces="Ordre annulé."
        onExecuter={(motif) => executer(supabase.rpc('annuler_ordre_travail', { p_id: id, p_motif: motif }))}
      />
    );
  }

  if (a === 'annuler-mouvement') {
    const piece = pieces.find((p) => p.mouvement_id === requete.mouvement) ?? null;
    return (
      <PageAction
        {...commun}
        titre={piece ? `Annuler le mouvement ${piece.numero}` : TITRES['annuler-mouvement']}
        description={piece ? `${piece.type_mouvement === 'exit' ? 'Sortie' : 'Retour'} de ${piece.quantite} ${piece.unite} de ${piece.article_code} · ${piece.article_nom}. Un contre-mouvement est créé ; le mouvement d'origine reste visible, barré.` : undefined}
        motif="obligatoire"
        motifMinimum={1}
        libelleConfirmer="Annuler le mouvement"
        danger
        interdit={interditEtat ?? (!chargement && !piece ? 'Mouvement introuvable parmi les pièces de cet ordre.' : piece?.annule ? 'Mouvement déjà annulé.' : null)}
        messageSucces="Mouvement annulé."
        versApres={routeDetail(VUE_ORDRES, id, 'relations')}
        onExecuter={(motif) => executer(supabase.rpc('annuler_mouvement_stock', { p_id: piece?.mouvement_id, p_motif: motif }))}
      />
    );
  }

  if (piecesAction) {
    const sortie = a === 'sortir';
    const article = articles.find((x) => x.id === champs.article);
    const suivi: SuiviArticle = article?.suivi ?? 'aucun';
    const quantite = entier(champs.quantite);
    const lots = lotsPourMouvement(suivi, champs.lots, quantite);
    const reservationsPiece = reservations.filter((r) => r.stock_item_id === champs.article && r.warehouse_id === champs.depot);
    const pret = Boolean(champs.article && champs.depot) && (quantite ?? 0) > 0 && lots !== null;
    return (
      <PageAction
        {...commun}
        titre={TITRES[a]}
        description={sortie ? 'Sortie valorisée au prix de référence de l\'article s\'il est renseigné ; refusée au-delà du stock disponible du dépôt.' : 'Retour limité aux pièces déjà sorties pour cet ordre.'}
        motif="aucun"
        libelleConfirmer="Enregistrer le mouvement"
        interdit={interditEtat}
        pret={pret}
        messageSucces={sortie ? 'Pièce sortie du stock pour l\'ordre.' : 'Pièce retournée au stock.'}
        versApres={routeDetail(VUE_ORDRES, id, 'relations')}
        onExecuter={() => executer(supabase.rpc('mouvement_stock', {
          p_article: champs.article, p_type: sortie ? 'exit' : 'return', p_quantite: quantite,
          p_depot_source: sortie ? champs.depot : null, p_depot_destination: sortie ? null : champs.depot,
          p_date: new Date().toISOString(), p_prix_unitaire: sortie && article?.unit_price !== null && article?.unit_price !== undefined ? article.unit_price : null,
          p_reference: null, p_vehicle_id: ordre?.vehicle_id ?? null, p_ordre_maintenance: id, p_note: champs.note.trim() || null,
          p_lots: lots && lots.length ? lots : null, p_reservation: sortie && champs.reservation ? champs.reservation : null,
        }))}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ChampPage libelle="Article *">
            <select value={champs.article} onChange={(e) => poser('article', e.target.value)} className={CHAMP_FENETRE}>
              <option value="">Choisir</option>
              {articles.map((x) => <option key={x.id} value={x.id}>{x.item_code} · {x.name}</option>)}
            </select>
          </ChampPage>
          <ChampPage libelle={sortie ? 'Depuis le dépôt *' : 'Vers le dépôt *'}>
            <select value={champs.depot} onChange={(e) => poser('depot', e.target.value)} className={CHAMP_FENETRE}>
              <option value="">Choisir</option>
              {depots.map((d) => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}
            </select>
          </ChampPage>
          <ChampPage libelle="Quantité *" erreur={champs.quantite && !((quantite ?? 0) > 0) ? 'Quantité entière supérieure à zéro.' : null}>
            <input inputMode="numeric" value={champs.quantite} onChange={(e) => poser('quantite', e.target.value)} className={CHAMP_FENETRE} />
          </ChampPage>
          <ChampPage libelle="Note">
            <input value={champs.note} onChange={(e) => poser('note', e.target.value)} className={CHAMP_FENETRE} />
          </ChampPage>
          {sortie && reservationsPiece.length > 0 && (
            <ChampPage libelle="Réservation de l'ordre">
              <select value={champs.reservation} onChange={(e) => poser('reservation', e.target.value)} className={CHAMP_FENETRE}>
                <option value="">Aucune (stock libre)</option>
                {reservationsPiece.map((r) => <option key={r.id} value={r.id}>{r.numero} · reste {r.quantite_restante}</option>)}
              </select>
            </ChampPage>
          )}
          {suivi !== 'aucun' && (
            <ChampPage libelle={suivi === 'serie' ? 'Numéros de série (un par ligne) *' : 'Lots (un par ligne : CODE QUANTITÉ) *'} className="sm:col-span-2"
              erreur={champs.lots && lots === null ? 'Lots ou numéros de série incomplets : leur total doit égaler la quantité.' : null}>
              <textarea rows={3} value={champs.lots} onChange={(e) => poser('lots', e.target.value)} className={CHAMP_FENETRE} />
            </ChampPage>
          )}
        </div>
      </PageAction>
    );
  }

  const demarrer = a === 'demarrer';
  return (
    <PageAction
      {...commun}
      titre={TITRES[a]}
      description={demarrer ? 'L\'ordre passe en cours ; l\'heure de démarrage est enregistrée.'
        : 'Un ordre terminé ne se rouvre pas et ne reçoit plus de pièces ; la date de fin est celle du jour.'}
      motif="aucun"
      libelleConfirmer={demarrer ? 'Démarrer' : 'Terminer l\'ordre'}
      interdit={interditEtat}
      messageSucces={demarrer ? 'Ordre démarré.' : 'Ordre terminé.'}
      onExecuter={() => executer(demarrer
        ? supabase.from('maintenance_orders').update({ status: 'in_progress', started_at: new Date().toISOString() }).eq('id', id)
        : supabase.from('maintenance_orders').update({ status: 'completed', completion_date: aujourdhui() }).eq('id', id))}
    />
  );
};
