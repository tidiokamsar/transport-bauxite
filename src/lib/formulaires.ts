// Conversions des champs de formulaire avant envoi au serveur (D-078) :
// une saisie vide devient null (jamais '' dans une colonne date ou nombre,
// jamais une valeur par defaut inventee).

/** Date AAAA-MM-JJ, ou null si vide. */
export const dateOuNull = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

/** Texte nettoye, ou null si vide. */
export const texteOuNull = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

/** Nombre decimal (virgule acceptee), null si vide, NaN si illisible. */
export const nombreOuNull = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : Number.NaN;
  const t = v.trim().replace(/\s/g, '').replace(',', '.');
  if (t === '') return null;
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : Number.NaN;
};

/**
 * Montant ou quantite entiere (colonne integer ou bigint, montant en GNF) :
 * null si vide, erreur explicite si decimal ou illisible ; aucun arrondi
 * silencieux.
 */
export const entierOuNull = (v: string | number | null | undefined, libelle: string): { valeur: number | null; erreur: string | null } => {
  const n = nombreOuNull(v);
  if (n === null) return { valeur: null, erreur: null };
  if (Number.isNaN(n)) return { valeur: null, erreur: `${libelle} : nombre illisible` };
  if (!Number.isInteger(n)) return { valeur: null, erreur: `${libelle} : nombre entier attendu (sans décimales)` };
  return { valeur: n, erreur: null };
};
