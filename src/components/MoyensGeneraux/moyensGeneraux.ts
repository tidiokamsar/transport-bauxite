import type { TeintePuce } from '../ui/Panneau';

// Moyens generaux et patrimoine (D-060) : memes regles que les fonctions
// serveur (normalisation du numero d'inventaire, operations permises selon
// le statut, amortissement lineaire en mois entiers).

export type StatutBien = 'en_stock' | 'affecte' | 'remis' | 'reforme';
export type CategorieBien = 'informatique' | 'mobilier' | 'equipement' | 'outillage' | 'vehicule_administratif' | 'autre';
export type EtatPhysique = 'bon' | 'moyen' | 'mauvais' | 'hors_service';
export type ActionBien = 'affecter' | 'remettre' | 'restituer' | 'transferer' | 'constater' | 'reparer' | 'reformer';
export type Ecart = 'hors_site' | 'reforme' | 'non_reference' | 'manquant';

export const STATUTS_BIEN: Record<StatutBien, { texte: string; teinte: TeintePuce }> = {
  en_stock: { texte: 'En stock', teinte: 'bleu' },
  affecte: { texte: 'Affecté', teinte: 'orange' },
  remis: { texte: 'Remis', teinte: 'vert' },
  reforme: { texte: 'Réformé', teinte: 'gris' },
};

export const CATEGORIES_BIEN: Record<CategorieBien, string> = {
  informatique: 'Informatique',
  mobilier: 'Mobilier',
  equipement: 'Équipement',
  outillage: 'Outillage',
  vehicule_administratif: 'Véhicule administratif',
  autre: 'Autre',
};

export const ETATS_PHYSIQUES: Record<EtatPhysique, string> = {
  bon: 'Bon',
  moyen: 'Moyen',
  mauvais: 'Mauvais',
  hors_service: 'Hors service',
};

export const TYPES_OPERATION_BIEN: Record<string, string> = {
  entree: 'Entrée au registre',
  affectation: 'Affectation',
  remise: 'Remise',
  restitution: 'Restitution',
  transfert: 'Transfert',
  constat: 'Constat d\'état',
  reparation: 'Réparation',
  reforme: 'Réforme',
  fiche: 'Modification de la fiche',
  annulation: 'Annulation',
};

export const LIBELLES_ACTION_BIEN: Record<ActionBien, string> = {
  affecter: 'Affecter',
  remettre: 'Remettre',
  restituer: 'Restituer',
  transferer: 'Transférer',
  constater: 'Constater',
  reparer: 'Réparer',
  reformer: 'Réformer',
};

export const ECARTS: Record<Ecart, { texte: string; teinte: TeintePuce }> = {
  manquant: { texte: 'Manquant', teinte: 'rouge' },
  hors_site: { texte: 'Bien d\'un autre site', teinte: 'orange' },
  reforme: { texte: 'Bien réformé retrouvé', teinte: 'violet' },
  non_reference: { texte: 'Non référencé', teinte: 'orange' },
};

export const normaliserNumero = (n: string) => n.trim().replace(/\s+/g, ' ').toUpperCase();

export const actionsPossibles = (statut: StatutBien): ActionBien[] => {
  if (statut === 'en_stock') return ['affecter', 'transferer', 'constater', 'reparer', 'reformer'];
  if (statut === 'affecte') return ['remettre', 'restituer', 'constater', 'reparer'];
  if (statut === 'remis') return ['restituer', 'constater', 'reparer'];
  return [];
};

/** Mois entiers ecoules entre deux dates AAAA-MM-JJ (comme age() de Postgres). */
export const moisEcoules = (debut: string, fin: string) => {
  const [y1, m1, d1] = debut.slice(0, 10).split('-').map(Number);
  const [y2, m2, d2] = fin.slice(0, 10).split('-').map(Number);
  let mois = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) mois -= 1;
  return mois;
};

export interface Amortissement { moisAmortis: number; dotationMensuelle: number; cumul: number; valeurNette: number }

/** Amortissement lineaire a une date ; null si valeur, date ou duree manque. */
export const amortissementLineaire = (
  valeur: number | null, dateAcquisition: string | null, dureeMois: number | null, dateFin: string,
): Amortissement | null => {
  if (valeur === null || !dateAcquisition || !dureeMois || dureeMois <= 0) return null;
  const moisAmortis = Math.min(dureeMois, Math.max(0, moisEcoules(dateAcquisition, dateFin)));
  const cumul = Math.round((valeur * moisAmortis) / dureeMois);
  return { moisAmortis, dotationMensuelle: Math.round((valeur / dureeMois) * 100) / 100, cumul, valeurNette: valeur - cumul };
};

/** Plan d'amortissement par annee civile (cumul au 31 decembre). */
export const planAmortissement = (valeur: number | null, dateAcquisition: string | null, dureeMois: number | null) => {
  if (valeur === null || !dateAcquisition || !dureeMois || dureeMois <= 0) return [];
  const lignes: { annee: number; dotation: number; cumul: number; valeurNette: number }[] = [];
  let precedent = 0;
  for (let annee = Number(dateAcquisition.slice(0, 4)); precedent < valeur; annee += 1) {
    const a = amortissementLineaire(valeur, dateAcquisition, dureeMois, `${annee}-12-31`);
    if (!a) break;
    lignes.push({ annee, dotation: a.cumul - precedent, cumul: a.cumul, valeurNette: a.valeurNette });
    if (a.moisAmortis >= dureeMois) break;
    precedent = a.cumul;
  }
  return lignes;
};

const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
export const texteMontant = (v: number | null | undefined) => (v === null || v === undefined ? 'Sans données' : `${nombre.format(v)} GNF`);
