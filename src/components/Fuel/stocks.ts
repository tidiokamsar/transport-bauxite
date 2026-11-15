import type { TeintePuce } from '../ui/Panneau';

// Registre carburant (D-041) : libelles et regles d'alerte d'un stockage.
// Aucune valeur n'est deduite : sans inventaire d'ouverture, le stock est
// « sans donnees » et aucune alerte de niveau n'est calculee.

export interface Stock {
  id: string; code: string; libelle: string; type: 'cuve_fixe' | 'citerne_mobile'; site_id: string;
  capacite_litres: number; seuil_alerte_litres: number | null; actif: boolean;
  solde_litres: number | null; en_attente_litres: number; mouvements_en_attente: number;
  dernier_mouvement: string | null; dernier_inventaire: string | null; dernier_ecart_inventaire: number | null;
}

export const LIBELLE_TYPE_STOCKAGE: Record<Stock['type'], string> = {
  cuve_fixe: 'Cuve fixe',
  citerne_mobile: 'Citerne mobile',
};

export const LIBELLE_MOUVEMENT = {
  reception: 'Réception',
  transfert_sortie: 'Transfert (sortie)',
  transfert_entree: 'Transfert (entrée)',
  distribution: 'Distribution',
  ajustement_inventaire: 'Ajustement d\'inventaire',
  annulation: 'Annulation',
} as const;

export const alerteStockage = (s: Pick<Stock, 'actif' | 'solde_litres' | 'capacite_litres' | 'seuil_alerte_litres'>):
  { teinte: TeintePuce; texte: string } | null => {
  if (!s.actif) return { teinte: 'gris', texte: 'Inactif' };
  if (s.solde_litres === null) return { teinte: 'gris', texte: 'Inventaire d\'ouverture requis' };
  const solde = Number(s.solde_litres);
  if (solde < 0) return { teinte: 'rouge', texte: 'Solde négatif : réception ou inventaire manquant' };
  if (solde > Number(s.capacite_litres)) return { teinte: 'rouge', texte: 'Solde supérieur à la capacité' };
  if (s.seuil_alerte_litres !== null && solde <= Number(s.seuil_alerte_litres)) return { teinte: 'orange', texte: 'Sous le seuil d\'alerte' };
  return null;
};
