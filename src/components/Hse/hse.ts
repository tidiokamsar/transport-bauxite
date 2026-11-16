import type { TeintePuce } from '../ui/Panneau';

// HSE (D-054) : memes regles que les fonctions serveur.

export type ResultatPoint = 'conforme' | 'non_conforme' | 'sans_objet';
export interface PointControle { id: string; libelle: string; categorie: string; bloquant: boolean; ordre: number; actif: boolean }
export interface Reponse { resultat: ResultatPoint | ''; observation: string }

export const RESULTATS_CONTROLE: Record<string, { texte: string; teinte: TeintePuce }> = {
  conforme: { texte: 'Conforme', teinte: 'vert' },
  reserves: { texte: 'Avec réserves', teinte: 'orange' },
  non_conforme: { texte: 'Non conforme', teinte: 'rouge' },
};

export const CATEGORIES_POINT: Record<string, string> = {
  freinage: 'Freinage', pneumatiques: 'Pneumatiques', eclairage: 'Éclairage', fluides: 'Fluides',
  securite: 'Sécurité', documents: 'Documents', cabine: 'Cabine', autre: 'Autre',
};

export const TYPES_INCIDENT: Record<string, string> = {
  accident: 'Accident', presque_accident: 'Presque-accident', blessure: 'Blessure', environnement: 'Environnement',
  materiel: 'Dégât matériel', securite: 'Sûreté / sécurité', autre: 'Autre',
};

export const GRAVITES: Record<string, { texte: string; teinte: TeintePuce }> = {
  minor: { texte: 'Mineure', teinte: 'gris' },
  moderate: { texte: 'Modérée', teinte: 'orange' },
  severe: { texte: 'Grave', teinte: 'rouge' },
  critical: { texte: 'Critique', teinte: 'rouge' },
};

export const STATUTS_INCIDENT: Record<string, { texte: string; teinte: TeintePuce }> = {
  ouvert: { texte: 'Ouvert', teinte: 'bleu' },
  en_analyse: { texte: 'En analyse', teinte: 'orange' },
  clos: { texte: 'Clos', teinte: 'vert' },
};

// Resultat attendu (le serveur le recalcule) ; null tant qu'un point manque.
export const resultatControle = (points: PointControle[], reponses: Record<string, Reponse>) => {
  const actifs = points.filter((p) => p.actif);
  if (actifs.length === 0) return null;
  let bloquant = false; let reserve = false;
  for (const p of actifs) {
    const r = reponses[p.id];
    if (!r?.resultat) return null;
    if (r.resultat === 'non_conforme') {
      if (!r.observation.trim()) return null;
      if (p.bloquant) bloquant = true; else reserve = true;
    }
  }
  return bloquant ? 'non_conforme' : reserve ? 'reserves' : 'conforme';
};

// HSE complementaire (D-068) : EPI, risques, plans de prevention, inspections.
export const TYPES_EPI: Record<string, string> = {
  casque: 'Casque', chaussures: 'Chaussures de sécurité', gilet: 'Gilet haute visibilité', gants: 'Gants', lunettes: 'Lunettes',
  protection_auditive: 'Protection auditive', masque: 'Masque', harnais: 'Harnais', combinaison: 'Combinaison', autre: 'Autre',
};
export const ETATS_RESTITUTION: Record<string, string> = { bon: 'Bon état', use: 'Usé', endommage: 'Endommagé', perdu: 'Perdu' };
export const STATUTS_DOTATION: Record<string, { texte: string; teinte: TeintePuce }> = {
  remis: { texte: 'Remis', teinte: 'bleu' }, restitue: { texte: 'Restitué', teinte: 'gris' },
  remplace: { texte: 'Renouvelé', teinte: 'vert' }, annule: { texte: 'Annulé', teinte: 'gris' },
};
export const ETATS_PLAN: Record<string, { texte: string; teinte: TeintePuce }> = {
  brouillon: { texte: 'À signer', teinte: 'orange' }, a_venir: { texte: 'Signé, à venir', teinte: 'bleu' },
  en_vigueur: { texte: 'En vigueur', teinte: 'vert' }, expire: { texte: 'Expiré', teinte: 'rouge' },
  remplace: { texte: 'Remplacé', teinte: 'gris' }, annule: { texte: 'Annulé', teinte: 'gris' },
};
export const STATUTS_INSPECTION: Record<string, { texte: string; teinte: TeintePuce }> = {
  planifiee: { texte: 'Planifiée', teinte: 'bleu' }, realisee: { texte: 'Réalisée', teinte: 'vert' }, annulee: { texte: 'Annulée', teinte: 'gris' },
};
export const GRAVITES_CONSTAT: Record<string, string> = { observation: 'Observation', mineur: 'Mineur', majeur: 'Majeur', critique: 'Critique' };

/** Echeance d'un EPI remis : atteinte (le jour meme compris) ou a venir ; null sans echeance saisie. */
export const etatEcheanceEpi = (echeance: string | null, aujourdhui: string): 'echue' | 'a_venir' | null =>
  !echeance ? null : echeance <= aujourdhui ? 'echue' : 'a_venir';

/** Criticite affichee : produit des cotations saisies (1 a 5), sans classement suppose. */
export const criticite = (gravite: number | null, probabilite: number | null) =>
  gravite == null || probabilite == null ? null : gravite * probabilite;
