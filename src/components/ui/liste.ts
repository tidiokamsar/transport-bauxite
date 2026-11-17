import type { ReactNode } from 'react';

// Regles pures de PageListe (D-090) : recherche, filtres, tri, pagination,
// export et etat porte par l'adresse. Testees dans liste.test.ts.

export type ValeurCellule = string | number | boolean | null | undefined;

export interface ColonneListe<T> {
  id: string;
  libelle: string;
  /** Valeur brute : tri, recherche par defaut et export CSV. */
  valeur: (ligne: T) => ValeurCellule;
  /** Affichage ; a defaut, la valeur brute. */
  rendu?: (ligne: T) => ReactNode;
  triable?: boolean;
  /** Masquee par defaut (reaffichable par le choix des colonnes). */
  masquee?: boolean;
  /** Exclue de l'export (defaut : exportee). */
  exportable?: boolean;
  alignement?: 'gauche' | 'droite';
}

export interface OptionFiltre { valeur: string; libelle: string }

export interface FiltreListe<T> {
  id: string;
  libelle: string;
  options: OptionFiltre[];
  correspond: (ligne: T, valeur: string) => boolean;
}

export type SensTri = 'asc' | 'desc';

export interface EtatListe {
  recherche: string;
  filtres: Record<string, string>;
  tri: string | null;
  sens: SensTri;
  page: number;
  taille: number;
}

export const TAILLES_PAGE = [25, 50, 100] as const;
const PREFIXE_FILTRE = 'f.';

const entierPositif = (v: string | undefined, defaut: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : defaut;
};

/** Etat de la liste lu dans la requete de l'adresse (valeurs inconnues ignorees). */
export const etatDepuisRequete = (requete: Record<string, string>, tailleDefaut = 25): EtatListe => {
  const filtres: Record<string, string> = {};
  Object.entries(requete).forEach(([k, v]) => { if (k.startsWith(PREFIXE_FILTRE) && v) filtres[k.slice(PREFIXE_FILTRE.length)] = v; });
  const taille = entierPositif(requete.taille, tailleDefaut);
  return {
    recherche: requete.q ?? '',
    filtres,
    tri: requete.tri || null,
    sens: requete.sens === 'desc' ? 'desc' : 'asc',
    page: entierPositif(requete.page, 1),
    taille: (TAILLES_PAGE as readonly number[]).includes(taille) ? taille : tailleDefaut,
  };
};

/** Requete minimale qui decrit l'etat (valeurs par defaut omises). */
export const requeteDepuisEtat = (e: EtatListe, tailleDefaut = 25): Record<string, string> => {
  const r: Record<string, string> = {};
  if (e.recherche) r.q = e.recherche;
  Object.entries(e.filtres).forEach(([k, v]) => { if (v) r[PREFIXE_FILTRE + k] = v; });
  if (e.tri) { r.tri = e.tri; if (e.sens === 'desc') r.sens = 'desc'; }
  if (e.page > 1) r.page = String(e.page);
  if (e.taille !== tailleDefaut) r.taille = String(e.taille);
  return r;
};

const vide = (v: ValeurCellule) => v === null || v === undefined || v === '';

/** Comparaison de tri : valeurs absentes en dernier, nombres en ordre numerique, textes en francais. */
export const comparer = (a: ValeurCellule, b: ValeurCellule): number => {
  if (vide(a) && vide(b)) return 0;
  if (vide(a)) return 1;
  if (vide(b)) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(b) - Number(a);
  return String(a).localeCompare(String(b), 'fr', { numeric: true, sensitivity: 'base' });
};

const normaliser = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Recherche par defaut : le texte dans l'une des colonnes (accents et casse ignores). */
export const rechercheParDefaut = <T,>(colonnes: ColonneListe<T>[]) => (ligne: T, texte: string) => {
  const t = normaliser(texte.trim());
  return !t || colonnes.some((c) => { const v = c.valeur(ligne); return !vide(v) && normaliser(String(v)).includes(t); });
};

export const appliquerListe = <T,>(
  lignes: T[],
  etat: Pick<EtatListe, 'recherche' | 'filtres' | 'tri' | 'sens'>,
  def: { colonnes: ColonneListe<T>[]; filtres?: FiltreListe<T>[]; recherche?: (ligne: T, texte: string) => boolean },
): T[] => {
  const chercher = def.recherche ?? rechercheParDefaut(def.colonnes);
  const actifs = (def.filtres ?? []).filter((f) => etat.filtres[f.id]);
  const res = lignes.filter((l) => (!etat.recherche.trim() || chercher(l, etat.recherche))
    && actifs.every((f) => f.correspond(l, etat.filtres[f.id])));
  const col = etat.tri ? def.colonnes.find((c) => c.id === etat.tri) : undefined;
  if (!col) return res;
  const signe = etat.sens === 'desc' ? -1 : 1;
  // Tri stable ; les valeurs absentes restent en fin dans les deux sens.
  return res.map((l, i) => ({ l, i, v: col.valeur(l) })).sort((x, y) => {
    if (vide(x.v) !== vide(y.v)) return vide(x.v) ? 1 : -1;
    return signe * comparer(x.v, y.v) || x.i - y.i;
  }).map((x) => x.l);
};

export const paginer = <T,>(lignes: T[], page: number, taille: number) => {
  const pages = Math.max(1, Math.ceil(lignes.length / taille));
  const p = Math.min(Math.max(1, page), pages);
  return { lignes: lignes.slice((p - 1) * taille, p * taille), page: p, pages, debut: lignes.length ? (p - 1) * taille + 1 : 0, fin: Math.min(p * taille, lignes.length) };
};

/** Clic sur l'en-tete : tri croissant, puis decroissant, puis aucun. */
export const triSuivant = (etat: Pick<EtatListe, 'tri' | 'sens'>, colonne: string): Pick<EtatListe, 'tri' | 'sens'> => {
  if (etat.tri !== colonne) return { tri: colonne, sens: 'asc' };
  if (etat.sens === 'asc') return { tri: colonne, sens: 'desc' };
  return { tri: null, sens: 'asc' };
};

/** Lignes d'export : colonnes visibles et exportables, valeurs brutes (absentes = vide, jamais inventees). */
export const lignesExport = <T,>(lignes: T[], colonnes: ColonneListe<T>[]): Record<string, string | number>[] =>
  lignes.map((l) => {
    const r: Record<string, string | number> = {};
    colonnes.filter((c) => c.exportable !== false).forEach((c) => {
      const v = c.valeur(l);
      r[c.libelle] = vide(v) ? '' : typeof v === 'boolean' ? (v ? 'Oui' : 'Non') : v as string | number;
    });
    return r;
  });
