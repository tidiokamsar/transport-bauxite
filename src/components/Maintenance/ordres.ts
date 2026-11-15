// Ordres de travail (D-061) : libelles et cout des pieces sorties du
// registre des stocks (D-044) pour un ordre.

export const STATUTS_ORDRE: Record<string, string> = { open: 'Ouvert', in_progress: 'En cours', completed: 'Terminé', cancelled: 'Annulé' };
export const TYPES_ORDRE: Record<string, string> = { preventive: 'Préventive', corrective: 'Corrective' };
export const PRIORITES_ORDRE: Record<string, string> = { low: 'Basse', medium: 'Moyenne', high: 'Haute', critical: 'Critique' };

export interface PieceOrdre {
  mouvement_id: string; numero: string; date_mouvement: string; type_mouvement: 'exit' | 'return';
  article_id: string; article_code: string; article_nom: string; unite: string; quantite: number;
  prix_unitaire: number | null; valeur: number | null; depot_code: string | null; annule: boolean;
}

/**
 * Cout net des pieces : sorties moins retours, mouvements annules exclus.
 * Un retour sans prix est valorise au prix de la sortie du meme article
 * quand il est unique ; sinon le cout est incomplet (jamais estime).
 */
export const coutPieces = (pieces: PieceOrdre[]): { valeur: number; incomplet: boolean; quantiteNette: Map<string, number> } => {
  const actives = pieces.filter((p) => !p.annule);
  const prixSortie = new Map<string, Set<number>>();
  for (const p of actives) {
    if (p.type_mouvement === 'exit' && p.prix_unitaire !== null) {
      prixSortie.set(p.article_id, (prixSortie.get(p.article_id) ?? new Set()).add(Number(p.prix_unitaire)));
    }
  }
  let valeur = 0;
  let incomplet = false;
  const quantiteNette = new Map<string, number>();
  for (const p of actives) {
    const signe = p.type_mouvement === 'exit' ? 1 : -1;
    quantiteNette.set(p.article_id, (quantiteNette.get(p.article_id) ?? 0) + signe * p.quantite);
    let prix = p.prix_unitaire;
    if (prix === null && p.type_mouvement === 'return') {
      const connus = prixSortie.get(p.article_id);
      if (connus && connus.size === 1) prix = [...connus][0];
    }
    if (prix === null) { incomplet = true; continue; }
    valeur += signe * Number(prix) * p.quantite;
  }
  return { valeur, incomplet, quantiteNette };
};
