// Rapports de voyages par axe (D-066) : lignes de rapport_voyages, libelles
// et export CSV. Une valeur absente reste vide (jamais 0 invente).

export type Axe = 'camion' | 'chauffeur' | 'site' | 'shift';

export const AXES: Record<Axe, { libelle: string; sansCle: string }> = {
  camion: { libelle: 'Camion', sansCle: 'Sans camion' },
  chauffeur: { libelle: 'Chauffeur', sansCle: 'Sans chauffeur' },
  site: { libelle: 'Site de chargement', sansCle: 'Sans site' },
  shift: { libelle: 'Shift', sansCle: 'Sans shift' },
};

export interface LigneRapportVoyages {
  cle: string | null;
  libelle: string | null;
  voyages: number;
  livres: number;
  annules: number;
  tonnes: number | null;
  livres_sans_poids: number;
  cycle_moyen_min: number | null;
  cycles_mesures: number;
  rotation_moyenne_min: number | null;
  rotations_mesurees: number;
  incidents: number;
  litiges: number;
}

export const libelleLigne = (axe: Axe, l: LigneRapportVoyages) =>
  l.cle === null ? AXES[axe].sansCle : l.libelle ?? 'Non visible avec vos droits';

const nombreOuVide = (v: number | null) => (v === null || v === undefined ? '' : Number(v));

export const lignesCsv = (axe: Axe, lignes: LigneRapportVoyages[]) => lignes.map((l) => ({
  [AXES[axe].libelle]: libelleLigne(axe, l),
  Voyages: l.voyages,
  Livres: l.livres,
  Annules: l.annules,
  Tonnes_livrees: nombreOuVide(l.tonnes),
  Livres_sans_poids: l.livres_sans_poids,
  Cycle_moyen_min: nombreOuVide(l.cycle_moyen_min),
  Cycles_mesures: l.cycles_mesures,
  Rotation_moyenne_min: nombreOuVide(l.rotation_moyenne_min),
  Rotations_mesurees: l.rotations_mesurees,
  Incidents: l.incidents,
  Litiges: l.litiges,
}));
