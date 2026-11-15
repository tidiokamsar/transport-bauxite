import type { TeintePuce } from '../ui/Panneau';

// Registre des stocks magasin (D-044) : libelles et alerte de seuil.

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
