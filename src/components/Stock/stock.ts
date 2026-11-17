import type { TeintePuce } from '../ui/Panneau';

// Registre des stocks magasin (D-044) : libelles et alerte de seuil.
// Stocks avances (D-067) : suivi par lot ou numero de serie, reservations,
// valorisation au cout moyen pondere calculee par le serveur.

export type TypeMouvementStock = 'entry' | 'exit' | 'transfer' | 'adjustment' | 'return' | 'annulation';

export const LIBELLE_MOUVEMENT_STOCK: Record<TypeMouvementStock, string> = {
  entry: 'Entrée',
  exit: 'Sortie',
  transfer: 'Transfert',
  adjustment: 'Ajustement d\'inventaire',
  return: 'Retour',
  annulation: 'Annulation',
};

export const alerteArticle = (a: { active: boolean | null; quantity_in_stock: number | null; minimum_threshold: number | null }):
  { teinte: TeintePuce; texte: string } | null => {
  if (a.active === false) return { teinte: 'gris', texte: 'Archivé' };
  const q = Number(a.quantity_in_stock ?? 0);
  if (q === 0) return { teinte: 'rouge', texte: 'Rupture' };
  if (a.minimum_threshold !== null && a.minimum_threshold > 0 && q <= a.minimum_threshold) return { teinte: 'orange', texte: 'Sous le seuil' };
  return null;
};

export type SuiviArticle = 'aucun' | 'lot' | 'serie';

export const LIBELLE_SUIVI: Record<SuiviArticle, string> = {
  aucun: 'Sans suivi',
  lot: 'Par lot',
  serie: 'Par numéro de série',
};

export interface LigneLot { code: string; quantite: number }

/**
 * Saisie des lots d'un mouvement, memes regles que controler_lots_mouvement :
 * - lot : une ligne par lot, « CODE QUANTITE » (separateur espace, « ; », « : » ou « = ») ;
 * - serie : un numero par ligne (ou separes par des virgules), une unite chacun.
 * Codes en majuscules ; null si une ligne est illisible ou un code repete.
 */
export const lireLots = (suivi: SuiviArticle, texte: string): LigneLot[] | null => {
  if (suivi === 'aucun') return [];
  const morceaux = (suivi === 'serie' ? texte.split(/[\n,;]+/) : texte.split('\n')).map((x) => x.trim()).filter(Boolean);
  if (morceaux.length === 0) return null;
  const lignes: LigneLot[] = [];
  for (const m of morceaux) {
    if (suivi === 'serie') { lignes.push({ code: m.toUpperCase(), quantite: 1 }); continue; }
    const r = /^(.+?)[\s;:=]+(\d+)$/.exec(m);
    if (!r || Number(r[2]) <= 0) return null;
    lignes.push({ code: r[1].trim().toUpperCase(), quantite: Number(r[2]) });
  }
  const codes = lignes.map((l) => l.code);
  return new Set(codes).size === codes.length ? lignes : null;
};

export const totalLots = (lignes: LigneLot[]) => lignes.reduce((s, l) => s + l.quantite, 0);

/** Lots valides pour la quantite saisie (vide pour un article sans suivi). */
export const lotsPourMouvement = (suivi: SuiviArticle, texte: string, quantite: number | null): LigneLot[] | null => {
  const lignes = lireLots(suivi, texte);
  if (lignes === null) return null;
  if (suivi === 'aucun') return lignes;
  return quantite !== null && totalLots(lignes) === quantite ? lignes : null;
};

export type StatutReservation = 'active' | 'consommee' | 'levee';

export const STATUT_RESERVATION: Record<StatutReservation, { texte: string; teinte: TeintePuce }> = {
  active: { texte: 'Active', teinte: 'bleu' },
  consommee: { texte: 'Consommée', teinte: 'vert' },
  levee: { texte: 'Levée', teinte: 'gris' },
};

export type StatutValeur = 'complete' | 'partielle' | 'a_verifier' | 'sans_donnees' | 'sans_stock';

export const STATUT_VALEUR: Record<StatutValeur, { texte: string; teinte: TeintePuce }> = {
  complete: { texte: 'Complète', teinte: 'vert' },
  partielle: { texte: 'Partielle', teinte: 'orange' },
  // Entree annulee apres d'autres mouvements : retiree au cout moyen du moment (D-067 revue C1).
  a_verifier: { texte: 'À vérifier', teinte: 'orange' },
  sans_donnees: { texte: 'Sans données', teinte: 'gris' },
  sans_stock: { texte: 'Sans stock', teinte: 'gris' },
};

const gnf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

/** Valeur calculee par le serveur : jamais completee ni estimee a l'ecran. */
export const texteValeur = (valeur: number | null, statut: StatutValeur) => {
  if (valeur === null || statut === 'sans_donnees') return 'Sans données';
  return `${gnf.format(valeur)} GNF${statut === 'partielle' ? ' (partielle)' : statut === 'a_verifier' ? ' (à vérifier)' : ''}`;
};

export const texteCmp = (cmp: number | null) => (cmp === null ? 'Sans données' : `${gnf.format(cmp)} GNF`);

// Pages standard (D-090). Une seule vue du menu (« stock ») porte quatre
// objets : l'identifiant de route est prefixe par le type (article-<id>,
// depot-<id>, mouvement-<id>, reservation-<id>), sans modifier le routeur.

export const VUE_STOCK = 'stock';
export const MODULE_STOCK = 'Stocks magasin';

export const OBJETS_STOCK = ['article', 'depot', 'mouvement', 'reservation'] as const;
export type ObjetStock = typeof OBJETS_STOCK[number];

export const idRouteStock = (objet: ObjetStock, id: string) => `${objet}-${id}`;

/** Objet et identifiant d'un identifiant de route ; null si le prefixe est inconnu ou l'identifiant vide. */
export const lireIdRouteStock = (idRoute: string): { objet: ObjetStock; id: string } | null => {
  const i = idRoute.indexOf('-');
  if (i <= 0) return null;
  const objet = idRoute.slice(0, i);
  const id = idRoute.slice(i + 1);
  return (OBJETS_STOCK as readonly string[]).includes(objet) && id ? { objet: objet as ObjetStock, id } : null;
};

/** Saisies en pleine page (#/stock/nouveau?objet=...). */
export const SAISIES_STOCK = ['article', 'depot', 'entry', 'exit', 'transfer', 'return', 'inventaire', 'reservation'] as const;
export type SaisieStock = typeof SAISIES_STOCK[number];
export const estSaisieStock = (v: string | undefined): v is SaisieStock => (SAISIES_STOCK as readonly string[]).includes(v ?? '');

export const TITRE_SAISIE_STOCK: Record<SaisieStock, string> = {
  article: 'Nouvel article', depot: 'Nouveau dépôt', entry: 'Entrée en stock', exit: 'Sortie de stock', transfer: 'Transfert entre dépôts',
  return: 'Retour en stock', inventaire: 'Inventaire (comptage)', reservation: 'Réservation (sans sortie physique)',
};

export const ONGLETS_LISTE_STOCK = ['articles', 'mouvements', 'reservations', 'depots', 'lots', 'valorisation'] as const;
export type OngletListeStock = typeof ONGLETS_LISTE_STOCK[number];

export const entierSaisi = (v: string) => (/^\s*\d[\d\s]*$/.test(v) ? Number.parseInt(v.replace(/\s/g, ''), 10) : null);

export interface ChampsMouvement {
  article: string; source: string; destination: string; depot: string; quantite: string; lots: string; quand: string;
  compte: string; code: string; ordre: string; engin: string; affectation: string;
}

/** Erreurs d'une saisie de mouvement, d'inventaire ou de reservation (memes exigences que les fonctions serveur). */
export const erreursMouvement = (type: Exclude<SaisieStock, 'article' | 'depot'>, c: ChampsMouvement, suivi: SuiviArticle): string[] => {
  const e: string[] = [];
  if (!c.article) e.push('Article requis.');
  if (type === 'inventaire') {
    if (!c.depot) e.push('Dépôt requis.');
    if (entierSaisi(c.compte) === null) e.push('Quantité comptée requise (entier).');
    if (suivi !== 'aucun' && !c.code.trim()) e.push(suivi === 'serie' ? 'Numéro de série requis.' : 'Lot requis.');
    return e;
  }
  const q = entierSaisi(c.quantite);
  if (q === null || q <= 0) e.push('Quantité entière positive requise.');
  if (type === 'reservation') {
    if (!c.depot) e.push('Dépôt requis.');
    if (!c.ordre && !c.engin && !c.affectation.trim()) e.push('Ordre de travail, engin ou affectation requis.');
    return e;
  }
  if ((type === 'exit' || type === 'transfer') && !c.source) e.push('Dépôt de départ requis.');
  if ((type === 'entry' || type === 'return' || type === 'transfer') && !c.destination) e.push('Dépôt d\'arrivée requis.');
  if (!c.quand || Number.isNaN(Date.parse(c.quand))) e.push('Date et heure requises.');
  if (suivi !== 'aucun' && lotsPourMouvement(suivi, c.lots, q) === null) {
    e.push(suivi === 'serie' ? 'Numéros de série : un par unité, sans doublon.' : 'Lots : CODE QUANTITÉ par ligne, total égal à la quantité.');
  }
  return e;
};

// Lignes lues par les pages du module.
export interface ArticleStock {
  id: string; item_code: string; name: string; unit_of_measure: string; unit_price: number | null; minimum_threshold: number | null;
  active: boolean | null; category_id: string | null; suivi: SuiviArticle | null; created_at?: string | null; updated_at?: string | null;
}
export const COLONNES_ARTICLE = 'id, item_code, name, unit_of_measure, unit_price, minimum_threshold, active, category_id, suivi, created_at, updated_at';
export interface DepotStock { id: string; code: string; name: string; warehouse_type: string; site_id: string | null; active: boolean | null; created_at?: string | null }
export const COLONNES_DEPOT = 'id, code, name, warehouse_type, site_id, active, created_at';
export interface MouvementStock {
  id: string; movement_number: string; movement_date: string; movement_type: TypeMouvementStock; stock_item_id: string; quantity: number;
  from_warehouse_id: string | null; to_warehouse_id: string | null; reference_piece: string | null; motif: string | null; notes: string | null;
  annule_mouvement_id: string | null; performed_by?: string | null; created_at?: string | null;
}
export const COLONNES_MOUVEMENT = 'id, movement_number, movement_date, movement_type, stock_item_id, quantity, from_warehouse_id, to_warehouse_id, reference_piece, motif, notes, annule_mouvement_id, performed_by, created_at';
export interface DisponibiliteStock { stock_item_id: string; warehouse_id: string; quantite: number; reserve: number; libre: number }
export const COLONNES_RESERVATION = 'id, numero, stock_item_id, warehouse_id, quantite, maintenance_order_id, vehicle_id, affectation, note, reserve_le, reserve_par, levee_le, levee_par, motif_levee, quantite_consommee, quantite_restante, statut';

export const TYPES_DEPOT: Record<string, string> = { main: 'Magasin principal', garage: 'Atelier', fuel_station: 'Station', depot: 'Dépôt' };

export interface Reservation {
  id: string; numero: string; stock_item_id: string; warehouse_id: string; quantite: number;
  maintenance_order_id: string | null; vehicle_id: string | null; affectation: string | null; note: string | null;
  reserve_le: string; reserve_par?: string | null; levee_le?: string | null; levee_par?: string | null;
  motif_levee: string | null; quantite_consommee: number; quantite_restante: number; statut: StatutReservation;
}
