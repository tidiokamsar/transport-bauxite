import type { TeintePuce } from '../ui/Panneau';

// Centre des decisions (D-068) : elements renvoyes par centre_decisions()
// (alertes ecrites par le serveur et decisions en attente). Fonctions pures,
// testees dans decisions.test.ts.

export interface ElementDecision {
  nature: 'alerte' | 'validation'; priorite: number; gravite: string | null; categorie: string; objet: string;
  reference: string | null; detail: string | null; depuis: string | null; ecran: string | null; alerte_id: string | null;
  statut: string | null; regle: string | null; condition_levee_le: string | null; detectee_le: string | null;
}

export interface RegleAlerte {
  regle: string; libelle: string; domaine: string; cle: string; type_reglage: 'seuil' | 'activation'; unite: string | null;
  gravite: string; description: string; en_service: boolean; seuil: number | null;
}

export const PRIORITES: Record<number, { texte: string; teinte: TeintePuce }> = {
  1: { texte: 'Critique', teinte: 'rouge' },
  2: { texte: 'Décision en attente', teinte: 'violet' },
  3: { texte: 'Avertissement', teinte: 'orange' },
  4: { texte: 'Information', teinte: 'bleu' },
};

/** Groupes par priorite croissante, puis du plus ancien au plus recent. */
export const grouperParPriorite = (elements: ElementDecision[]) => {
  const tries = [...elements].sort((a, b) => a.priorite - b.priorite || (a.depuis ?? '9').localeCompare(b.depuis ?? '9'));
  const groupes = new Map<number, ElementDecision[]>();
  for (const e of tries) groupes.set(e.priorite, [...(groupes.get(e.priorite) ?? []), e]);
  return [...groupes.entries()].map(([priorite, liste]) => ({ priorite, liste }));
};

/** Etat d'une regle lisible pour l'ecran : jamais un seuil suppose. */
export const etatRegle = (r: RegleAlerte) => {
  if (r.type_reglage === 'seuil') return r.seuil === null ? `Inactive : seuil non saisi (${r.cle})` : `Active : seuil ${r.seuil} ${r.unite ?? ''}`.trim();
  return r.en_service ? 'Active' : `Désactivée (${r.cle} = false)`;
};
