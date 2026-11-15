import type { TeintePuce } from '../ui/Panneau';

// Cycle de vie des pneus (D-052) : memes regles que les fonctions serveur
// (normalisation des positions, operations permises selon l'etat).

export type EtatPneu = 'stored' | 'active' | 'damaged' | 'retired';
export type ActionPneu = 'monter' | 'demonter' | 'permuter' | 'inspecter' | 'rechaper' | 'reparer' | 'reformer';

export const ETATS_PNEU: Record<EtatPneu, { texte: string; teinte: TeintePuce }> = {
  stored: { texte: 'En stock', teinte: 'bleu' },
  active: { texte: 'Monté', teinte: 'vert' },
  damaged: { texte: 'À décider', teinte: 'orange' },
  retired: { texte: 'Réformé', teinte: 'gris' },
};

export const TYPES_OPERATION: Record<string, string> = {
  entree: 'Entrée en stock',
  montage: 'Montage',
  demontage: 'Démontage',
  permutation: 'Permutation',
  inspection: 'Inspection',
  rechapage: 'Rechapage',
  reparation: 'Réparation',
  reforme: 'Réforme',
  annulation: 'Annulation',
};

export const LIBELLES_ACTION: Record<ActionPneu, string> = {
  monter: 'Monter',
  demonter: 'Démonter',
  permuter: 'Permuter',
  inspecter: 'Inspecter',
  rechaper: 'Rechaper',
  reparer: 'Réparer',
  reformer: 'Réformer',
};

export const normaliserPosition = (p: string) => p.trim().replace(/\s+/g, ' ').toUpperCase();

export const actionsPossibles = (etat: EtatPneu): ActionPneu[] => {
  if (etat === 'stored') return ['monter', 'inspecter', 'rechaper', 'reformer'];
  if (etat === 'active') return ['demonter', 'permuter', 'inspecter'];
  if (etat === 'damaged') return ['reparer', 'rechaper', 'inspecter', 'reformer'];
  return [];
};

const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

// Km parcourus : un montage sans compteur rend le total incomplet.
export const texteKm = (km: number | null, incomplet: boolean, nbMontages: number) => {
  if (nbMontages === 0) return 'Jamais monté';
  if (km === null) return 'Sans données';
  return incomplet ? `${nombre.format(km)} km (incomplet)` : `${nombre.format(km)} km`;
};

export const texteCoutKm = (cout: number | null) => (cout === null ? 'Sans données' : `${nombre.format(cout)} GNF/km`);

/** Mesure calculee par le serveur (D-067) : absente = sans donnees. */
export const texteMesure = (valeur: number | null, unite: string) => (valeur === null ? 'Sans données' : `${nombre.format(Number(valeur))} ${unite}`);
