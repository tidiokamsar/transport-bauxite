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

export type StatutValeur = 'complete' | 'partielle' | 'sans_donnees' | 'sans_stock';

export const STATUT_VALEUR: Record<StatutValeur, { texte: string; teinte: TeintePuce }> = {
  complete: { texte: 'Complète', teinte: 'vert' },
  partielle: { texte: 'Partielle', teinte: 'orange' },
  sans_donnees: { texte: 'Sans données', teinte: 'gris' },
  sans_stock: { texte: 'Sans stock', teinte: 'gris' },
};

const gnf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

/** Valeur calculee par le serveur : jamais completee ni estimee a l'ecran. */
export const texteValeur = (valeur: number | null, statut: StatutValeur) => {
  if (valeur === null || statut === 'sans_donnees') return 'Sans données';
  return `${gnf.format(valeur)} GNF${statut === 'partielle' ? ' (partielle)' : ''}`;
};

export const texteCmp = (cmp: number | null) => (cmp === null ? 'Sans données' : `${gnf.format(cmp)} GNF`);
