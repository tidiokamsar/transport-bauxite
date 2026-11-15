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
