import { useEffect, useState } from 'react';
import { Archive, BookmarkPlus, ClipboardCheck, PackageMinus, PackagePlus, Pencil, Undo2, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Historique } from '../ui/Historique';
import { Informations, OngletPieces, PageDetail, Relation } from '../ui/PageDetail';
import { Puce } from '../ui/Panneau';
import { fusionnerHistoriques, type EvenementHistorique } from '../ui/evenements';
import { identifiantSur, lire, trouver, type Lecture } from '../ui/lecture';
import { ecrireRoute, routeAction, routeDetail, routeModifier } from '../ui/routeur';
import {
  COLONNES_ARTICLE, COLONNES_DEPOT, COLONNES_MOUVEMENT, COLONNES_RESERVATION, LIBELLE_MOUVEMENT_STOCK, LIBELLE_SUIVI, MODULE_STOCK, STATUT_RESERVATION, TYPES_DEPOT,
  VUE_STOCK, alerteArticle, idRouteStock,
  type ArticleStock, type DepotStock, type DisponibiliteStock, type MouvementStock, type ObjetStock, type Reservation, type SaisieStock,
} from './stock';

// Fiches du registre des stocks (D-044, D-067, D-090) : article, depot,
// mouvement et reservation. Historique tire des mouvements enregistres
// (stock_movements) et des horodatages des reservations ; aucune table de
// journal propre aux articles et depots (ecart note).

interface LotMouvement { id: string; code: string; quantite: number; stock_movement_id: string; stock_item_id: string; warehouse_id?: string }
interface Lib { id: string; libelle: string }

const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });
const fiche = (objet: ObjetStock, id: string, onglet?: string) => routeDetail(VUE_STOCK, idRouteStock(objet, id), onglet);
const saisie = (objet: SaisieStock, valeurs: Record<string, string>) => ecrireRoute({ vue: VUE_STOCK, mode: 'nouveau', requete: { objet, ...valeurs } });
const quand = (d: string | null | undefined) => (d ? new Date(d).toLocaleString('fr-FR') : null);

export const DetailStock = ({ objet, id }: { objet: ObjetStock; id: string }) => {
  if (objet === 'article') return <FicheArticle id={id} />;
  if (objet === 'depot') return <FicheDepot id={id} />;
  if (objet === 'mouvement') return <FicheMouvement id={id} />;
  return <FicheReservation id={id} />;
};

const useReferentiels = () => {
  const [articles, setArticles] = useState<Map<string, ArticleStock>>(new Map());
  const [depots, setDepots] = useState<Map<string, DepotStock>>(new Map());
  useEffect(() => {
    Promise.all([
      supabase.from('stock_items').select(COLONNES_ARTICLE),
      supabase.from('warehouses').select(COLONNES_DEPOT),
    ]).then(([a, d]) => {
      setArticles(new Map(((a.data ?? []) as ArticleStock[]).map((x) => [x.id, x])));
      setDepots(new Map(((d.data ?? []) as DepotStock[]).map((x) => [x.id, x])));
    });
  }, []);
  return {
    article: (x: string) => articles.get(x)?.item_code ?? '?',
    depot: (x: string | null) => (x ? depots.get(x)?.code ?? '?' : '—'),
  };
};

const useDroitStock = () => {
  const { hasPermission } = useAuth();
  return hasPermission('stock', 'create') || hasPermission('stock', 'edit');
};

/** Evenements d'historique tires des mouvements (date du mouvement, auteur enregistre). */
const evenementsMouvements = (mouvements: MouvementStock[], article: (id: string) => string, depot: (id: string | null) => string): EvenementHistorique[] =>
  mouvements.map((m) => ({
    id: `stock_movements-${m.id}`, le: m.movement_date, libelle: `${LIBELLE_MOUVEMENT_STOCK[m.movement_type] ?? m.movement_type} ${m.movement_number}`,
    detail: `${article(m.stock_item_id)} · ${m.quantity} · ${depot(m.from_warehouse_id)} → ${depot(m.to_warehouse_id)}${m.reference_piece ? ` · ${m.reference_piece}` : ''}`,
    motif: m.motif, auteur: m.performed_by ?? null, source: 'stock_movements',
  }));

const colonnesMouvement = (article: (id: string) => string, depot: (id: string | null) => string) => [
  { libelle: 'N°', valeur: (m: MouvementStock) => m.movement_number },
  { libelle: 'Date', valeur: (m: MouvementStock) => quand(m.movement_date) },
  { libelle: 'Type', valeur: (m: MouvementStock) => LIBELLE_MOUVEMENT_STOCK[m.movement_type] ?? m.movement_type },
  { libelle: 'Article', valeur: (m: MouvementStock) => article(m.stock_item_id) },
  { libelle: 'Quantité', valeur: (m: MouvementStock) => m.quantity },
  { libelle: 'Depuis → vers', valeur: (m: MouvementStock) => `${depot(m.from_warehouse_id)} → ${depot(m.to_warehouse_id)}` },
];

const FicheArticle = ({ id }: { id: string }) => {
  const peutEcrire = useDroitStock();
  const ref = useReferentiels();
  const [article, setArticle] = useState<Lecture<ArticleStock>>(attente);
  const [dispo, setDispo] = useState<Lecture<DisponibiliteStock>>(attente);
  const [mouvements, setMouvements] = useState<Lecture<MouvementStock>>(attente);
  const [reservations, setReservations] = useState<Lecture<Reservation>>(attente);
  const [lots, setLots] = useState<Lecture<LotMouvement & { warehouse_id: string }>>(attente);

  useEffect(() => {
    lire<ArticleStock>(supabase.from('stock_items').select(COLONNES_ARTICLE).eq('id', id), 'article').then(setArticle);
    lire<DisponibiliteStock>(supabase.from('v_stock_disponibilite').select('stock_item_id, warehouse_id, quantite, reserve, libre').eq('stock_item_id', id), 'stock par dépôt')
      .then((r) => setDispo({ ...r, lignes: r.lignes && r.lignes.filter((x) => x.stock_item_id === id && Number(x.quantite) !== 0) }));
    lire<MouvementStock>(supabase.from('stock_movements').select(COLONNES_MOUVEMENT).eq('stock_item_id', id).order('movement_date', { ascending: false }).limit(200), 'mouvements de l\'article')
      .then((r) => setMouvements({ ...r, lignes: r.lignes && r.lignes.filter((x) => x.stock_item_id === id) }));
    lire<Reservation>(supabase.from('v_reservations_stock').select(COLONNES_RESERVATION).eq('stock_item_id', id).order('reserve_le', { ascending: false }), 'réservations de l\'article')
      .then((r) => setReservations({ ...r, lignes: r.lignes && r.lignes.filter((x) => x.stock_item_id === id) }));
    lire<LotMouvement & { warehouse_id: string }>(supabase.from('v_stock_lots').select('stock_item_id, warehouse_id, code, quantite').eq('stock_item_id', id).neq('quantite', 0), 'lots en stock')
      .then((r) => setLots({ ...r, lignes: r.lignes && r.lignes.filter((x) => x.stock_item_id === id) }));
  }, [id]);

  const a = trouver(article.lignes, id);
  const total = (dispo.lignes ?? []).reduce((s, x) => s + Number(x.quantite ?? 0), 0);
  const reserve = (dispo.lignes ?? []).reduce((s, x) => s + Number(x.reserve ?? 0), 0);
  const alerte = a ? alerteArticle({ active: a.active, quantity_in_stock: total, minimum_threshold: a.minimum_threshold }) : null;
  const actif = Boolean(a) && a?.active !== false;
  const historique = a && mouvements.lignes ? fusionnerHistoriques(
    evenementsMouvements(mouvements.lignes, ref.article, ref.depot),
    a.created_at ? [{ id: 'stock_items-cree', le: a.created_at, libelle: 'Article créé', source: 'stock_items.created_at' }] : [],
  ) : null;

  return (
    <PageDetail
      vue={VUE_STOCK} module={MODULE_STOCK}
      reference={a?.item_code ?? 'Article'} titre={a ? `${a.item_code} · ${a.name}` : undefined}
      statut={alerte ? { libelle: alerte.texte, teinte: alerte.teinte } : a ? { libelle: 'Actif', teinte: 'vert' } : null}
      resume={a && <>{total} {a.unit_of_measure} en stock{reserve > 0 ? `, dont ${reserve} réservé(s)` : ''} (dépôts visibles)</>}
      chargement={article.lignes === null && !article.erreur} erreur={article.erreur} introuvable={article.lignes !== null && !a}
      actions={[
        { id: 'entree', libelle: 'Entrée', icone: <PackagePlus className="h-4 w-4" />, visible: peutEcrire && actif, ton: 'principal', vers: saisie('entry', { article: id }) },
        { id: 'sortie', libelle: 'Sortie', icone: <PackageMinus className="h-4 w-4" />, visible: peutEcrire && actif, vers: saisie('exit', { article: id }) },
        { id: 'reserver', libelle: 'Réserver', icone: <BookmarkPlus className="h-4 w-4" />, visible: peutEcrire && actif, vers: saisie('reservation', { article: id }) },
        { id: 'inventaire', libelle: 'Inventaire', icone: <ClipboardCheck className="h-4 w-4" />, visible: peutEcrire && actif, vers: saisie('inventaire', { article: id }) },
        { id: 'modifier', libelle: 'Modifier', icone: <Pencil className="h-4 w-4" />, visible: peutEcrire && actif, vers: routeModifier(VUE_STOCK, idRouteStock('article', id)) },
        { id: 'archiver', libelle: 'Archiver', icone: <Archive className="h-4 w-4" />, visible: peutEcrire && actif, ton: 'danger', vers: routeAction(VUE_STOCK, idRouteStock('article', id), 'archiver') },
      ]}
      onglets={!a ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <Informations groupes={[
            { titre: 'Article', champs: [['Code', a.item_code], ['Désignation', a.name], ['Unité', a.unit_of_measure], ['Suivi', LIBELLE_SUIVI[a.suivi ?? 'aucun']],
              ['État', a.active === false ? 'Archivé' : 'Actif']] },
            { titre: 'Stock', champs: [['En stock (dépôts visibles)', `${total} ${a.unit_of_measure}`], ['Réservé', reserve], ['Seuil minimum', a.minimum_threshold],
              ['Prix de référence', a.unit_price !== null ? `${a.unit_price} GNF (hors valorisation)` : null]] },
          ]} />
        ) },
        { id: 'relations', libelle: 'Stock et mouvements', compte: mouvements.lignes?.length ?? null, contenu: (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Relation titre="Par dépôt" lignes={dispo.lignes} erreur={dispo.erreur} cle={(x) => x.warehouse_id} vide="Aucun stock" lien={(x) => fiche('depot', x.warehouse_id)}
                colonnes={[{ libelle: 'Dépôt', valeur: (x) => ref.depot(x.warehouse_id) }, { libelle: 'Quantité', valeur: (x) => x.quantite }, { libelle: 'Réservé', valeur: (x) => x.reserve }, { libelle: 'Libre', valeur: (x) => x.libre }]} />
              <Relation titre="Lots et numéros de série" lignes={lots.lignes} erreur={lots.erreur} cle={(x) => `${x.warehouse_id}-${x.code}`} vide={a.suivi && a.suivi !== 'aucun' ? 'Aucun lot en stock' : 'Article sans suivi par lot'}
                colonnes={[{ libelle: 'Lot / série', valeur: (x) => <span className="font-mono">{x.code}</span> }, { libelle: 'Dépôt', valeur: (x) => ref.depot(x.warehouse_id) }, { libelle: 'Quantité', valeur: (x) => x.quantite }]} />
            </div>
            <Relation titre="Réservations" lignes={reservations.lignes} erreur={reservations.erreur} cle={(r) => r.id} vide="Aucune réservation" lien={(r) => fiche('reservation', r.id)}
              colonnes={[{ libelle: 'N°', valeur: (r) => r.numero }, { libelle: 'Dépôt', valeur: (r) => ref.depot(r.warehouse_id) }, { libelle: 'Reste', valeur: (r) => r.quantite_restante },
                { libelle: 'Statut', valeur: (r) => <Puce teinte={STATUT_RESERVATION[r.statut]?.teinte ?? 'gris'}>{STATUT_RESERVATION[r.statut]?.texte ?? r.statut}</Puce> }]} />
            <Relation titre="Mouvements" lignes={mouvements.lignes} erreur={mouvements.erreur} cle={(m) => m.id} vide="Aucun mouvement" lien={(m) => fiche('mouvement', m.id)}
              colonnes={colonnesMouvement(ref.article, ref.depot)} note="200 derniers mouvements de l'article." />
          </div>
        ) },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={historique} erreur={mouvements.erreur} source="stock_movements (mouvements de l'article), stock_items.created_at"
            absent="Les modifications de la fiche article (désignation, seuil, suivi, archivage) ne sont pas journalisées : aucune table de journal n'existe pour les articles." />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="un article du magasin" /> },
      ]}
    />
  );
};

const FicheDepot = ({ id }: { id: string }) => {
  const ref = useReferentiels();
  const [depot, setDepot] = useState<Lecture<DepotStock>>(attente);
  const [site, setSite] = useState('');
  const [dispo, setDispo] = useState<Lecture<DisponibiliteStock>>(attente);
  const [mouvements, setMouvements] = useState<Lecture<MouvementStock>>(attente);

  useEffect(() => {
    lire<DepotStock>(supabase.from('warehouses').select(COLONNES_DEPOT).eq('id', id), 'dépôt').then(async (r) => {
      setDepot(r);
      const d = trouver(r.lignes, id);
      if (!d?.site_id) return;
      const { data } = await supabase.from('sites').select('id, name').eq('id', d.site_id);
      setSite(((data ?? []) as { id: string; name: string }[]).find((x) => x.id === d.site_id)?.name ?? '');
    });
    lire<DisponibiliteStock>(supabase.from('v_stock_disponibilite').select('stock_item_id, warehouse_id, quantite, reserve, libre').eq('warehouse_id', id), 'stock du dépôt')
      .then((r) => setDispo({ ...r, lignes: r.lignes && r.lignes.filter((x) => x.warehouse_id === id && Number(x.quantite) !== 0) }));
    if (!identifiantSur(id)) { setMouvements({ lignes: null, erreur: 'Identifiant de dépôt invalide.' }); return; }
    lire<MouvementStock>(supabase.from('stock_movements').select(COLONNES_MOUVEMENT).or(`from_warehouse_id.eq.${id},to_warehouse_id.eq.${id}`).order('movement_date', { ascending: false }).limit(200), 'mouvements du dépôt')
      .then((r) => setMouvements({ ...r, lignes: r.lignes && r.lignes.filter((x) => x.from_warehouse_id === id || x.to_warehouse_id === id) }));
  }, [id]);

  const d = trouver(depot.lignes, id);
  const historique = d && mouvements.lignes ? fusionnerHistoriques(
    evenementsMouvements(mouvements.lignes, ref.article, ref.depot),
    d.created_at ? [{ id: 'warehouses-cree', le: d.created_at, libelle: 'Dépôt créé', source: 'warehouses.created_at' }] : [],
  ) : null;

  return (
    <PageDetail
      vue={VUE_STOCK} module={MODULE_STOCK} reference={d?.code ?? 'Dépôt'} titre={d ? `${d.code} · ${d.name}` : undefined}
      statut={d ? (d.active === false ? { libelle: 'Inactif', teinte: 'gris' } : { libelle: 'Actif', teinte: 'vert' }) : null}
      chargement={depot.lignes === null && !depot.erreur} erreur={depot.erreur} introuvable={depot.lignes !== null && !d}
      onglets={!d ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <Informations groupes={[{ titre: 'Dépôt', champs: [['Code', d.code], ['Nom', d.name], ['Type', TYPES_DEPOT[d.warehouse_type] ?? d.warehouse_type],
            ['Site', d.site_id ? site || null : 'Tous sites'], ['État', d.active === false ? 'Inactif' : 'Actif']] }]} />
        ) },
        { id: 'relations', libelle: 'Stock et mouvements', compte: dispo.lignes?.length ?? null, contenu: (
          <div className="space-y-4">
            <Relation titre="Articles en stock" lignes={dispo.lignes} erreur={dispo.erreur} cle={(x) => x.stock_item_id} vide="Aucun article en stock" lien={(x) => fiche('article', x.stock_item_id)}
              colonnes={[{ libelle: 'Article', valeur: (x) => ref.article(x.stock_item_id) }, { libelle: 'Quantité', valeur: (x) => x.quantite }, { libelle: 'Réservé', valeur: (x) => x.reserve }, { libelle: 'Libre', valeur: (x) => x.libre }]} />
            <Relation titre="Mouvements" lignes={mouvements.lignes} erreur={mouvements.erreur} cle={(m) => m.id} vide="Aucun mouvement" lien={(m) => fiche('mouvement', m.id)}
              colonnes={colonnesMouvement(ref.article, ref.depot)} note="200 derniers mouvements au départ ou à l'arrivée du dépôt." />
          </div>
        ) },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={historique} erreur={mouvements.erreur} source="stock_movements (mouvements du dépôt), warehouses.created_at"
            absent="Aucune table de journal n'existe pour les dépôts : seuls la création et les mouvements sont datés." />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="un dépôt" /> },
      ]}
    />
  );
};

const FicheMouvement = ({ id }: { id: string }) => {
  const peutEcrire = useDroitStock();
  const ref = useReferentiels();
  const [mouvement, setMouvement] = useState<Lecture<MouvementStock>>(attente);
  const [lies, setLies] = useState<Lecture<MouvementStock>>(attente);
  const [lots, setLots] = useState<Lecture<LotMouvement>>(attente);

  useEffect(() => {
    lire<MouvementStock>(supabase.from('stock_movements').select(COLONNES_MOUVEMENT).eq('id', id), 'mouvement').then(async (r) => {
      setMouvement(r);
      const m = trouver(r.lignes, id);
      if (!m) return;
      // Contre-mouvement qui annule celui-ci, ou mouvement annule par celui-ci.
      const requete = m.annule_mouvement_id
        ? supabase.from('stock_movements').select(COLONNES_MOUVEMENT).in('id', [m.annule_mouvement_id])
        : supabase.from('stock_movements').select(COLONNES_MOUVEMENT).eq('annule_mouvement_id', id);
      const l = await lire<MouvementStock>(requete, 'mouvements liés');
      setLies({ ...l, lignes: l.lignes && l.lignes.filter((x) => x.id === m.annule_mouvement_id || x.annule_mouvement_id === id) });
    });
    lire<LotMouvement>(supabase.from('v_stock_lots_mouvements').select('id, code, quantite, stock_movement_id, stock_item_id').eq('stock_movement_id', id), 'lots du mouvement')
      .then((r) => setLots({ ...r, lignes: r.lignes && r.lignes.filter((x) => x.stock_movement_id === id) }));
  }, [id]);

  const m = trouver(mouvement.lignes, id);
  const annulePar = (lies.lignes ?? []).find((x) => x.annule_mouvement_id === id) ?? null;
  const annulable = Boolean(m) && m?.movement_type !== 'annulation' && lies.lignes !== null && !annulePar;
  const historique = m && lies.lignes ? fusionnerHistoriques(
    evenementsMouvements([m], ref.article, ref.depot),
    m.created_at && m.created_at !== m.movement_date ? [{ id: 'stock_movements-saisi', le: m.created_at, libelle: 'Mouvement saisi', auteur: m.performed_by ?? null, source: 'stock_movements.created_at' }] : [],
    annulePar ? [{ id: `annulation-${annulePar.id}`, le: annulePar.movement_date, libelle: `Annulé par ${annulePar.movement_number}`, motif: annulePar.motif, auteur: annulePar.performed_by ?? null, source: 'stock_movements' }] : [],
  ) : null;

  return (
    <PageDetail
      vue={VUE_STOCK} module={MODULE_STOCK} reference={m?.movement_number ?? 'Mouvement'}
      titre={m ? `${LIBELLE_MOUVEMENT_STOCK[m.movement_type] ?? m.movement_type} ${m.movement_number}` : undefined}
      statut={m ? (annulePar ? { libelle: 'Annulé', teinte: 'gris' } : m.movement_type === 'annulation' ? { libelle: 'Contre-mouvement', teinte: 'orange' } : { libelle: 'Enregistré', teinte: 'vert' }) : null}
      resume={m && <>{ref.article(m.stock_item_id)} · {m.quantity} · {ref.depot(m.from_warehouse_id)} → {ref.depot(m.to_warehouse_id)}</>}
      chargement={mouvement.lignes === null && !mouvement.erreur} erreur={mouvement.erreur} introuvable={mouvement.lignes !== null && !m}
      actions={[
        { id: 'annuler', libelle: 'Annuler le mouvement', icone: <Undo2 className="h-4 w-4" />, visible: peutEcrire && annulable, ton: 'danger', vers: routeAction(VUE_STOCK, idRouteStock('mouvement', id), 'annuler') },
      ]}
      onglets={!m ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <Informations groupes={[
            { titre: 'Mouvement', champs: [['Numéro', m.movement_number], ['Type', LIBELLE_MOUVEMENT_STOCK[m.movement_type] ?? m.movement_type], ['Date', quand(m.movement_date)],
              ['Article', <a key="a" href={fiche('article', m.stock_item_id)} className="text-orange-800 hover:underline">{ref.article(m.stock_item_id)}</a>], ['Quantité', m.quantity]] },
            { titre: 'Trajet et pièce', champs: [['Depuis', m.from_warehouse_id ? <a key="s" href={fiche('depot', m.from_warehouse_id)} className="text-orange-800 hover:underline">{ref.depot(m.from_warehouse_id)}</a> : null],
              ['Vers', m.to_warehouse_id ? <a key="d" href={fiche('depot', m.to_warehouse_id)} className="text-orange-800 hover:underline">{ref.depot(m.to_warehouse_id)}</a> : null],
              ['Pièce', m.reference_piece], ['Motif', m.motif], ['Note', m.notes]] },
          ]} />
        ) },
        { id: 'relations', libelle: 'Lots et annulation', contenu: (
          <div className="grid gap-4 lg:grid-cols-2">
            <Relation titre="Lots et numéros de série" lignes={lots.lignes} erreur={lots.erreur} cle={(x) => x.id} vide="Aucun lot (article sans suivi)"
              colonnes={[{ libelle: 'Lot / série', valeur: (x) => <span className="font-mono">{x.code}</span> }, { libelle: 'Quantité', valeur: (x) => Math.abs(x.quantite) }]} />
            <Relation titre={m.annule_mouvement_id ? 'Mouvement annulé' : 'Annulation'} lignes={lies.lignes} erreur={lies.erreur} cle={(x) => x.id}
              vide="Aucune annulation : le mouvement est en vigueur" lien={(x) => fiche('mouvement', x.id)} colonnes={colonnesMouvement(ref.article, ref.depot)} />
          </div>
        ) },
        { id: 'historique', libelle: 'Historique', contenu: <Historique evenements={historique} erreur={lies.erreur} source="stock_movements (mouvement et contre-mouvement d'annulation)" /> },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="un mouvement de stock" /> },
      ]}
    />
  );
};

const FicheReservation = ({ id }: { id: string }) => {
  const peutEcrire = useDroitStock();
  const ref = useReferentiels();
  const [reservation, setReservation] = useState<Lecture<Reservation>>(attente);
  const [sorties, setSorties] = useState<Lecture<MouvementStock>>(attente);
  const [noms, setNoms] = useState<{ ordre: Lib | null; engin: Lib | null }>({ ordre: null, engin: null });

  useEffect(() => {
    lire<Reservation>(supabase.from('v_reservations_stock').select(COLONNES_RESERVATION).eq('id', id), 'réservation').then(async (r) => {
      setReservation(r);
      const x = trouver(r.lignes, id);
      if (!x) return;
      const [o, v] = await Promise.all([
        x.maintenance_order_id ? supabase.from('maintenance_orders').select('id, work_order_number').eq('id', x.maintenance_order_id) : Promise.resolve({ data: [] }),
        x.vehicle_id ? supabase.from('vehicles').select('id, registration').eq('id', x.vehicle_id) : Promise.resolve({ data: [] }),
      ]);
      const ordre = ((o.data ?? []) as { id: string; work_order_number: string | null }[]).find((y) => y.id === x.maintenance_order_id);
      const engin = ((v.data ?? []) as { id: string; registration: string }[]).find((y) => y.id === x.vehicle_id);
      setNoms({ ordre: ordre ? { id: ordre.id, libelle: ordre.work_order_number ?? 'OT sans numéro' } : null, engin: engin ? { id: engin.id, libelle: engin.registration } : null });
    });
    lire<MouvementStock & { reservation_id?: string | null }>(supabase.from('stock_movements').select(`${COLONNES_MOUVEMENT}, reservation_id`).eq('reservation_id', id).order('movement_date'), 'sorties sur la réservation')
      .then((r) => setSorties({ ...r, lignes: r.lignes && r.lignes.filter((x) => x.reservation_id === id) }));
  }, [id]);

  const r = trouver(reservation.lignes, id);
  const active = r?.statut === 'active';
  const historique = r && sorties.lignes ? fusionnerHistoriques(
    [{ id: 'reservation-creee', le: r.reserve_le, libelle: `Réservation ${r.numero} (${r.quantite})`, auteur: r.reserve_par ?? null, source: 'reservations_stock.reserve_le' }],
    evenementsMouvements(sorties.lignes, ref.article, ref.depot),
    r.levee_le ? [{ id: 'reservation-levee', le: r.levee_le, libelle: 'Réservation levée', motif: r.motif_levee, auteur: r.levee_par ?? null, source: 'reservations_stock.levee_le' }] : [],
  ) : null;

  return (
    <PageDetail
      vue={VUE_STOCK} module={MODULE_STOCK} reference={r?.numero ?? 'Réservation'} titre={r ? `Réservation ${r.numero}` : undefined}
      statut={r ? { libelle: STATUT_RESERVATION[r.statut]?.texte ?? r.statut, teinte: STATUT_RESERVATION[r.statut]?.teinte ?? 'gris' } : null}
      resume={r && <>{ref.article(r.stock_item_id)} · {ref.depot(r.warehouse_id)} · reste {r.quantite_restante} sur {r.quantite}</>}
      chargement={reservation.lignes === null && !reservation.erreur} erreur={reservation.erreur} introuvable={reservation.lignes !== null && !r}
      actions={!r ? [] : [
        { id: 'sortir', libelle: 'Sortir', icone: <PackageMinus className="h-4 w-4" />, visible: peutEcrire && active, ton: 'principal',
          vers: saisie('exit', { article: r.stock_item_id, source: r.warehouse_id, reservation: r.id, quantite: String(r.quantite_restante) }) },
        { id: 'lever', libelle: 'Lever', icone: <XCircle className="h-4 w-4" />, visible: peutEcrire && active, ton: 'danger', vers: routeAction(VUE_STOCK, idRouteStock('reservation', id), 'lever') },
      ]}
      onglets={!r ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <Informations groupes={[
            { titre: 'Réservation', champs: [['Numéro', r.numero], ['Article', <a key="a" href={fiche('article', r.stock_item_id)} className="text-orange-800 hover:underline">{ref.article(r.stock_item_id)}</a>],
              ['Dépôt', <a key="d" href={fiche('depot', r.warehouse_id)} className="text-orange-800 hover:underline">{ref.depot(r.warehouse_id)}</a>], ['Réservée le', quand(r.reserve_le)],
              ['Statut', STATUT_RESERVATION[r.statut]?.texte ?? r.statut]] },
            { titre: 'Quantités et destination', champs: [['Réservé', r.quantite], ['Sorti', r.quantite_consommee], ['Reste', r.quantite_restante],
              ['Ordre de travail', noms.ordre?.libelle ?? (r.maintenance_order_id ? 'OT' : null)], ['Engin', noms.engin ? <a key="e" href={routeDetail('vehicles', noms.engin.id)} className="text-orange-800 hover:underline">{noms.engin.libelle}</a> : null],
              ['Affectation', r.affectation], ['Note', r.note], ['Motif de la levée', r.motif_levee]] },
          ]} />
        ) },
        { id: 'relations', libelle: 'Sorties', compte: sorties.lignes?.length ?? null, contenu: (
          <Relation titre="Sorties sur la réservation" lignes={sorties.lignes} erreur={sorties.erreur} cle={(m) => m.id} vide="Aucune sortie" lien={(m) => fiche('mouvement', m.id)}
            colonnes={colonnesMouvement(ref.article, ref.depot)} />
        ) },
        { id: 'historique', libelle: 'Historique', contenu: <Historique evenements={historique} erreur={sorties.erreur} source="reservations_stock (réservation, levée), stock_movements (sorties qui la citent)" /> },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="une réservation de stock" /> },
      ]}
    />
  );
};
