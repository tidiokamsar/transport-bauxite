import type { TeintePuce } from '../ui/Panneau';

// Circuit achat (D-053) : statuts et operations permises, memes regles que
// les fonctions serveur.

export type StatutBon = 'draft' | 'submitted' | 'approved' | 'partially_received' | 'received' | 'closed' | 'rejected' | 'cancelled';

export const STATUTS_BON: Record<StatutBon, { texte: string; teinte: TeintePuce }> = {
  draft: { texte: 'Brouillon', teinte: 'gris' },
  submitted: { texte: 'Soumis', teinte: 'bleu' },
  approved: { texte: 'Approuvé', teinte: 'violet' },
  partially_received: { texte: 'Reçu en partie', teinte: 'orange' },
  received: { texte: 'Reçu', teinte: 'vert' },
  closed: { texte: 'Soldé', teinte: 'vert' },
  rejected: { texte: 'Rejeté', teinte: 'rouge' },
  cancelled: { texte: 'Annulé', teinte: 'gris' },
};

/** Valeur de la liste « Article » pour une ligne de pneus (registre des pneus, D-067). */
export const LIGNE_PNEU = '__pneu__';

export interface LigneSaisie {
  article: string; designation: string; quantite: string; prix: string;
  pneuMarque?: string; pneuModele?: string; pneuDimension?: string;
}

const entier = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : null);

interface LigneServeur {
  article: string | null; designation: string | null; quantite: number; prix_unitaire: number;
  pneu?: { marque: string; modele: string; dimension: string | null };
}

// Lignes envoyees au serveur ; null si une ligne est incomplete. Une ligne
// de pneus porte le modele (marque et modele requis), sans article.
export const lignesPourServeur = (lignes: LigneSaisie[]): LigneServeur[] | null => {
  if (lignes.length === 0) return null;
  const sortie = lignes.map((l): LigneServeur | null => {
    const quantite = entier(l.quantite);
    const prix = entier(l.prix);
    if (!quantite || prix === null) return null;
    if (l.article === LIGNE_PNEU) {
      const marque = (l.pneuMarque ?? '').trim();
      const modele = (l.pneuModele ?? '').trim();
      if (!marque || !modele) return null;
      return { article: null, designation: l.designation.trim() || null, quantite, prix_unitaire: prix,
        pneu: { marque, modele, dimension: (l.pneuDimension ?? '').trim() || null } };
    }
    if (!l.article && !l.designation.trim()) return null;
    return { article: l.article || null, designation: l.designation.trim() || null, quantite, prix_unitaire: prix };
  });
  return sortie.every((l) => l !== null) ? (sortie as LigneServeur[]) : null;
};

/** Numeros de pneus saisis a la reception : un par ligne, en majuscules, sans doublon. */
export const lireNumerosPneus = (texte: string): string[] | null => {
  const numeros = texte.split(/[\n,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);
  return new Set(numeros).size === numeros.length ? numeros : null;
};

export const totalSaisi = (lignes: LigneSaisie[], taxes: string) => {
  const l = lignesPourServeur(lignes);
  const t = entier(taxes || '0');
  if (!l || t === null) return null;
  return l.reduce((s, x) => s + x.quantite * x.prix_unitaire, 0) + t;
};

export const restantARecevoir = (commande: number, recue: number | null) => Math.max(0, commande - (recue ?? 0));

export const operationsPossibles = (statut: StatutBon) => ({
  modifier: statut === 'draft',
  soumettre: statut === 'draft',
  decider: statut === 'submitted',
  receptionner: statut === 'approved' || statut === 'partially_received',
  annuler: statut === 'draft' || statut === 'submitted' || statut === 'approved',
  solder: statut === 'partially_received',
});
