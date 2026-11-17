import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowRightLeft, BookmarkPlus, ClipboardCheck, PackageMinus, PackagePlus, Plus, RefreshCw, Undo2, Warehouse } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatNombre } from '../Dashboard/indicateurs';
import { PageListe } from '../ui/PageListe';
import { Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { ecrireRoute, naviguer, useRoute } from '../ui/routeur';
import type { ColonneListe, FiltreListe } from '../ui/liste';
import {
  COLONNES_ARTICLE, COLONNES_DEPOT, COLONNES_MOUVEMENT, COLONNES_RESERVATION, LIBELLE_MOUVEMENT_STOCK, LIBELLE_SUIVI, ONGLETS_LISTE_STOCK, STATUT_RESERVATION,
  TYPES_DEPOT, VUE_STOCK, alerteArticle, idRouteStock, lireIdRouteStock,
  type ArticleStock, type DepotStock, type DisponibiliteStock, type MouvementStock, type OngletListeStock, type Reservation, type SaisieStock,
} from './stock';
import { LotsStock, type LigneLotMouvement, type LotEnStock } from './LotsStock';
import { ValorisationStock } from './ValorisationStock';
import { FormulaireStock } from './FormulaireStock';
import { DetailStock } from './DetailStock';
import { ActionStock } from './ActionStock';

// Registre des stocks magasin (D-044, D-067) au standard des pages (D-090) :
// listes des articles, mouvements, reservations et depots (onglets), lots et
// valorisation ; fiche de chaque objet (#/stock/<objet>-<id>), saisies en
// pleine page (#/stock/nouveau?objet=...), annulation, levee et archivage en
// pages d'action. Quantites calculees depuis les mouvements, jamais saisies.

export const StockView = () => {
  const route = useRoute();
  if (route.vue !== VUE_STOCK || route.mode === 'liste') return <ListeStock requete={route.vue === VUE_STOCK ? route.requete : {}} />;
  if (route.mode === 'nouveau') return <FormulaireStock objet={route.requete.objet} requete={route.requete} />;
  const cible = lireIdRouteStock(route.id ?? '');
  if (!cible) return <SansDonnees message="Fiche introuvable" detail="Adresse de fiche inconnue dans le registre des stocks." />;
  if (route.mode === 'modifier') return <FormulaireStock objet={cible.objet} id={cible.id} requete={route.requete} />;
  if (route.mode === 'action' && route.action) return <ActionStock objet={cible.objet} id={cible.id} action={route.action} />;
  return <DetailStock objet={cible.objet} id={cible.id} />;
};

const LIBELLES_ONGLET: Record<OngletListeStock, string> = {
  articles: 'Articles', mouvements: 'Mouvements', reservations: 'Réservations', depots: 'Dépôts', lots: 'Lots et séries', valorisation: 'Valorisation',
};

// Onglet ouvert pendant la session : les filtres de PageListe reecrivent la
// requete de l'adresse, l'onglet est donc garde ici (et lu dans ?onglet=
// quand une fiche renvoie vers un onglet precis).
let dernierOnglet: OngletListeStock = 'articles';
const estOnglet = (v: string | undefined): v is OngletListeStock => (ONGLETS_LISTE_STOCK as readonly string[]).includes(v ?? '');

const routeListeStock =(onglet: OngletListeStock) => ecrireRoute({ vue: VUE_STOCK, mode: 'liste', requete: { onglet } });

const saisie = (objet: SaisieStock) => ecrireRoute({ vue: VUE_STOCK, mode: 'nouveau', requete: { objet } });

const BOUTON = 'flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm';

const ListeStock = ({ requete }: { requete: Record<string, string> }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('stock', 'create') || hasPermission('stock', 'edit');
  const [onglet, setOnglet] = useState<OngletListeStock>(() => (estOnglet(requete.onglet) ? requete.onglet : dernierOnglet));
  const [articles, setArticles] = useState<ArticleStock[] | null>(null);
  const [depots, setDepots] = useState<DepotStock[] | null>(null);
  const [dispo, setDispo] = useState<DisponibiliteStock[]>([]);
  const [mouvements, setMouvements] = useState<MouvementStock[] | null>(null);
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [lots, setLots] = useState<LotEnStock[]>([]);
  const [lotsMouvements, setLotsMouvements] = useState<LigneLotMouvement[]>([]);
  const [ordres, setOrdres] = useState<Map<string, string>>(new Map());
  const [engins, setEngins] = useState<Map<string, string>>(new Map());
  const [sites, setSites] = useState<Map<string, string>>(new Map());
  const [version, setVersion] = useState(0);
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  useEffect(() => { if (estOnglet(requete.onglet)) setOnglet(requete.onglet); }, [requete.onglet]);
  useEffect(() => { dernierOnglet = onglet; }, [onglet]);

  const charger = useCallback(async () => {
    const [a, d, l, m, s, r, lo, lm, o, v] = await Promise.all([
      supabase.from('stock_items').select(COLONNES_ARTICLE).order('item_code'),
      supabase.from('warehouses').select(COLONNES_DEPOT).order('code'),
      supabase.from('v_stock_disponibilite').select('stock_item_id, warehouse_id, quantite, reserve, libre'),
      supabase.from('stock_movements').select(COLONNES_MOUVEMENT).order('movement_date', { ascending: false }).limit(300),
      supabase.from('sites').select('id, name').order('name'),
      supabase.from('v_reservations_stock').select(COLONNES_RESERVATION).order('reserve_le', { ascending: false }).limit(300),
      supabase.from('v_stock_lots').select('stock_item_id, warehouse_id, code, quantite').neq('quantite', 0),
      supabase.from('v_stock_lots_mouvements').select('id, code, quantite, stock_movement_id, movement_number, movement_date, movement_type, stock_item_id, from_warehouse_id, to_warehouse_id, reference_piece, annule')
        .order('movement_date', { ascending: false }).limit(1000),
      supabase.from('maintenance_orders').select('id, work_order_number').order('work_order_number'),
      supabase.from('vehicles').select('id, registration').order('registration'),
    ]);
    // Toute lecture en echec est signalee (D-067 revue C8), jamais une liste vide silencieuse.
    setErreur([a, d, l, m, s, r, lo, lm, o, v].map((x) => x.error?.message).find(Boolean) ?? '');
    setArticles(a.error ? null : (a.data ?? []) as ArticleStock[]);
    setDepots(d.error ? null : (d.data ?? []) as DepotStock[]);
    setDispo((l.data ?? []) as DisponibiliteStock[]);
    setMouvements(m.error ? null : (m.data ?? []) as MouvementStock[]);
    setSites(new Map((s.data ?? []).map((x) => [x.id as string, x.name as string])));
    setReservations(r.error ? null : (r.data ?? []) as Reservation[]);
    setLots((lo.data ?? []) as LotEnStock[]);
    setLotsMouvements((lm.data ?? []) as LigneLotMouvement[]);
    setOrdres(new Map((o.data ?? []).map((x) => [x.id as string, (x.work_order_number as string | null) ?? 'OT sans numéro'])));
    setEngins(new Map((v.data ?? []).map((x) => [x.id as string, x.registration as string])));
    setVersion((n) => n + 1);
    setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const article = useMemo(() => new Map((articles ?? []).map((a) => [a.id, a])), [articles]);
  const depot = useMemo(() => new Map((depots ?? []).map((d) => [d.id, d])), [depots]);
  // Quantite = somme des depots visibles (D-086) : le cache tous depots
  // `quantity_in_stock` n'est plus lisible par les comptes.
  const quantite = useMemo(() => {
    const q = new Map<string, number>();
    dispo.forEach((x) => q.set(x.stock_item_id, (q.get(x.stock_item_id) ?? 0) + Number(x.quantite ?? 0)));
    return q;
  }, [dispo]);
  const parDepot = useCallback((articleId: string) => dispo.filter((l) => l.stock_item_id === articleId && Number(l.quantite) !== 0)
    .map((l) => `${depot.get(l.warehouse_id)?.code ?? '?'} ${l.quantite}`).join(' · '), [dispo, depot]);
  const reserve = useCallback((articleId: string) => dispo.filter((l) => l.stock_item_id === articleId).reduce((s, l) => s + Number(l.reserve ?? 0), 0), [dispo]);
  const annules = useMemo(() => new Set((mouvements ?? []).map((m) => m.annule_mouvement_id).filter(Boolean)), [mouvements]);
  const lotsDe = useCallback((mouvementId: string) => lotsMouvements.filter((x) => x.stock_movement_id === mouvementId)
    .map((x) => `${x.code} ×${Math.abs(x.quantite)}`).join(' · '), [lotsMouvements]);
  const codeArticle = (id: string) => article.get(id)?.item_code ?? '?';
  const codeDepot = useCallback((id: string | null) => (id ? depot.get(id)?.code ?? '?' : '—'), [depot]);
  const alerte = useCallback((a: ArticleStock) => alerteArticle({ active: a.active, quantity_in_stock: quantite.get(a.id) ?? 0, minimum_threshold: a.minimum_threshold }), [quantite]);

  const colArticles = useMemo<ColonneListe<ArticleStock>[]>(() => [
    { id: 'code', libelle: 'Code', valeur: (a) => a.item_code, rendu: (a) => <span className="font-mono">{a.item_code}{a.suivi && a.suivi !== 'aucun' && <span className="block font-sans text-xs text-stone-500">{LIBELLE_SUIVI[a.suivi]}</span>}</span> },
    { id: 'nom', libelle: 'Désignation', valeur: (a) => a.name },
    { id: 'stock', libelle: 'En stock', valeur: (a) => quantite.get(a.id) ?? 0, rendu: (a) => <b>{formatNombre(quantite.get(a.id) ?? 0, 0)} {a.unit_of_measure}</b>, alignement: 'droite' },
    { id: 'depots', libelle: 'Par dépôt', valeur: (a) => parDepot(a.id) || null, rendu: (a) => <span className="text-xs">{parDepot(a.id) || '—'}</span> },
    { id: 'reserve', libelle: 'Réservé', valeur: (a) => reserve(a.id), rendu: (a) => (reserve(a.id) > 0 ? reserve(a.id) : '—'), alignement: 'droite' },
    { id: 'seuil', libelle: 'Seuil', valeur: (a) => a.minimum_threshold, alignement: 'droite' },
    { id: 'alerte', libelle: 'Alerte', valeur: (a) => alerte(a)?.texte ?? null, rendu: (a) => { const al = alerte(a); return al && <Puce teinte={al.teinte}>{al.texte}</Puce>; } },
    { id: 'prix', libelle: 'Prix de référence (GNF)', valeur: (a) => a.unit_price, masquee: true },
  ], [quantite, parDepot, reserve, alerte]);
  const filtresArticles = useMemo<FiltreListe<ArticleStock>[]>(() => [
    { id: 'alerte', libelle: 'Alerte', options: ['Rupture', 'Sous le seuil', 'Archivé'].map((x) => ({ valeur: x, libelle: x })), correspond: (a, v) => alerte(a)?.texte === v },
    { id: 'suivi', libelle: 'Suivi', options: Object.entries(LIBELLE_SUIVI).map(([valeur, libelle]) => ({ valeur, libelle })), correspond: (a, v) => (a.suivi ?? 'aucun') === v },
  ], [alerte]);

  const colMouvements = useMemo<ColonneListe<MouvementStock>[]>(() => [
    { id: 'numero', libelle: 'N°', valeur: (m) => m.movement_number },
    { id: 'date', libelle: 'Date', valeur: (m) => m.movement_date, rendu: (m) => new Date(m.movement_date).toLocaleString('fr-FR') },
    { id: 'type', libelle: 'Type', valeur: (m) => LIBELLE_MOUVEMENT_STOCK[m.movement_type] ?? m.movement_type },
    { id: 'article', libelle: 'Article', valeur: (m) => article.get(m.stock_item_id)?.item_code ?? null },
    { id: 'quantite', libelle: 'Quantité', valeur: (m) => m.quantity, alignement: 'droite' },
    { id: 'trajet', libelle: 'Depuis → vers', valeur: (m) => `${codeDepot(m.from_warehouse_id)} → ${codeDepot(m.to_warehouse_id)}` },
    { id: 'lots', libelle: 'Lots / séries', valeur: (m) => lotsDe(m.id) || null },
    { id: 'piece', libelle: 'Pièce / motif', valeur: (m) => [m.reference_piece, m.motif].filter(Boolean).join(' · ') || null },
    { id: 'etat', libelle: 'État', valeur: (m) => (annules.has(m.id) ? 'Annulé' : m.movement_type === 'annulation' ? 'Contre-mouvement' : 'Enregistré') },
  ], [article, codeDepot, lotsDe, annules]);
  const filtresMouvements = useMemo<FiltreListe<MouvementStock>[]>(() => [
    { id: 'type', libelle: 'Type', options: Object.entries(LIBELLE_MOUVEMENT_STOCK).map(([valeur, libelle]) => ({ valeur, libelle })), correspond: (m, v) => m.movement_type === v },
    { id: 'article', libelle: 'Article', options: (articles ?? []).map((a) => ({ valeur: a.id, libelle: a.item_code })), correspond: (m, v) => m.stock_item_id === v },
  ], [articles]);

  const colReservations = useMemo<ColonneListe<Reservation>[]>(() => {
    const destination = (r: Reservation) => [r.maintenance_order_id && (ordres.get(r.maintenance_order_id) ?? 'OT'), r.vehicle_id && (engins.get(r.vehicle_id) ?? '?'), r.affectation]
      .filter(Boolean).join(' · ');
    return [
    { id: 'numero', libelle: 'N°', valeur: (r) => r.numero },
    { id: 'article', libelle: 'Article', valeur: (r) => article.get(r.stock_item_id)?.item_code ?? null },
    { id: 'depot', libelle: 'Dépôt', valeur: (r) => depot.get(r.warehouse_id)?.code ?? null },
    { id: 'reserve', libelle: 'Réservé', valeur: (r) => r.quantite, alignement: 'droite' },
    { id: 'sorti', libelle: 'Sorti', valeur: (r) => r.quantite_consommee, alignement: 'droite' },
    { id: 'reste', libelle: 'Reste', valeur: (r) => r.quantite_restante, alignement: 'droite' },
    { id: 'pour', libelle: 'Pour', valeur: (r) => destination(r) || null },
    { id: 'statut', libelle: 'Statut', valeur: (r) => STATUT_RESERVATION[r.statut]?.texte ?? r.statut,
      rendu: (r) => <Puce teinte={STATUT_RESERVATION[r.statut]?.teinte ?? 'gris'}>{STATUT_RESERVATION[r.statut]?.texte ?? r.statut}</Puce> },
    ];
  }, [article, depot, ordres, engins]);
  const filtresReservations = useMemo<FiltreListe<Reservation>[]>(() => [
    { id: 'statut', libelle: 'Statut', options: Object.entries(STATUT_RESERVATION).map(([valeur, s]) => ({ valeur, libelle: s.texte })), correspond: (r, v) => r.statut === v },
  ], []);

  const colDepots = useMemo<ColonneListe<DepotStock>[]>(() => [
    { id: 'code', libelle: 'Code', valeur: (d) => d.code, rendu: (d) => <span className="font-mono">{d.code}</span> },
    { id: 'nom', libelle: 'Nom', valeur: (d) => d.name },
    { id: 'type', libelle: 'Type', valeur: (d) => TYPES_DEPOT[d.warehouse_type] ?? d.warehouse_type },
    { id: 'site', libelle: 'Site', valeur: (d) => (d.site_id ? sites.get(d.site_id) ?? null : 'Tous sites') },
    { id: 'etat', libelle: 'État', valeur: (d) => (d.active === false ? 'Inactif' : 'Actif') },
  ], [sites]);

  const changerOnglet = (o: OngletListeStock) => { setOnglet(o); naviguer(routeListeStock(o), { remplacer: true }); };
  const onglets = (
    <div role="tablist" aria-label="Registre des stocks" className="flex flex-wrap gap-1 border-b border-stone-200">
      {ONGLETS_LISTE_STOCK.map((o) => (
        <button key={o} type="button" role="tab" aria-selected={o === onglet} onClick={() => changerOnglet(o)}
          className={`-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-semibold ${o === onglet ? 'border-orange-600 text-orange-800' : 'border-transparent text-stone-500 hover:text-stone-800'}`}>
          {LIBELLES_ONGLET[o]}
        </button>
      ))}
    </div>
  );
  const actions: ReactNode = peutEcrire && (
    <>
      <a href={saisie('entry')} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-3 py-2 text-sm font-bold text-white shadow"><PackagePlus className="h-4 w-4" /> Entrée</a>
      <a href={saisie('exit')} className={BOUTON}><PackageMinus className="h-4 w-4" /> Sortie</a>
      <a href={saisie('transfer')} className={BOUTON}><ArrowRightLeft className="h-4 w-4" /> Transfert</a>
      <a href={saisie('return')} className={BOUTON}><Undo2 className="h-4 w-4" /> Retour</a>
      <a href={saisie('reservation')} className={BOUTON}><BookmarkPlus className="h-4 w-4" /> Réserver</a>
      <a href={saisie('inventaire')} className={BOUTON}><ClipboardCheck className="h-4 w-4" /> Inventaire</a>
      <a href={saisie('article')} className={BOUTON}><Plus className="h-4 w-4" /> Article</a>
      <a href={saisie('depot')} className={BOUTON}><Warehouse className="h-4 w-4" /> Dépôt</a>
    </>
  );
  const commun = {
    vue: VUE_STOCK, titre: 'Stocks magasin', sousTitre: 'Quantités calculées depuis les mouvements. Aucune quantité ne se saisit ni ne se modifie.',
    erreur, actions, synthese: onglets, onActualiser: charger,
  };
  const provenance = <Provenance source="registre des mouvements (fonctions serveur) ; quantités par dépôt visibles dans votre périmètre" heure={heure} />;

  if (onglet === 'articles') {
    return <PageListe {...commun} lignes={articles} colonnes={colArticles} filtres={filtresArticles} cle={(a) => idRouteStock('article', a.id)}
      libelleOuverture={(a) => `Fiche ${a.item_code}`} placeholderRecherche="Rechercher (code, désignation)" nomExport="articles-stock"
      vide={{ message: 'Aucun article', detail: 'Créez les articles, puis constituez leur stock par une entrée ou un inventaire.' }} provenance={provenance} />;
  }
  if (onglet === 'mouvements') {
    return <PageListe {...commun} lignes={mouvements} colonnes={colMouvements} filtres={filtresMouvements} cle={(m) => idRouteStock('mouvement', m.id)}
      libelleOuverture={(m) => `Fiche ${m.movement_number}`} placeholderRecherche="Rechercher un mouvement, une pièce..." nomExport="registre-stocks"
      vide={{ message: 'Aucun mouvement' }} provenance={<Provenance source="300 derniers mouvements du registre ; une erreur se corrige par annulation (contre-mouvement)" heure={heure} />} />;
  }
  if (onglet === 'reservations') {
    return <PageListe {...commun} lignes={reservations} colonnes={colReservations} filtres={filtresReservations} cle={(r) => idRouteStock('reservation', r.id)}
      libelleOuverture={(r) => `Fiche ${r.numero}`} placeholderRecherche="Rechercher une réservation..." nomExport="reservations-stock"
      vide={{ message: 'Aucune réservation', detail: 'Une réservation déduit une quantité du stock libre pour un ordre de travail, un engin ou une affectation, sans sortie physique.' }} provenance={provenance} />;
  }
  if (onglet === 'depots') {
    return <PageListe {...commun} lignes={depots} colonnes={colDepots} cle={(d) => idRouteStock('depot', d.id)}
      libelleOuverture={(d) => `Fiche ${d.code}`} placeholderRecherche="Rechercher un dépôt..." nomExport="depots"
      vide={{ message: 'Aucun dépôt' }} provenance={provenance} />;
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-900">Stocks magasin</h1>
          <p className="text-stone-500">{commun.sousTitre}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={charger} className={BOUTON}><RefreshCw className="h-4 w-4" /> Actualiser</button>
          {actions}
        </div>
      </div>
      {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
      {onglets}
      {onglet === 'lots'
        ? <LotsStock lots={lots} mouvements={lotsMouvements} article={codeArticle} depot={(id) => codeDepot(id)} />
        : <ValorisationStock version={version} article={(id) => (article.get(id) ? `${article.get(id)!.item_code} · ${article.get(id)!.name}` : '?')} depot={(id) => codeDepot(id)} />}
    </div>
  );
};
