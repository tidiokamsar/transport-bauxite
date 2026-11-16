import { describe, expect, it } from 'vitest';
import { buildCSV } from '../../lib/exports';
import { libelleLigne, lignesCsv, type LigneRapportVoyages } from './rapports';

const ligne = (extra: Partial<LigneRapportVoyages> = {}): LigneRapportVoyages => ({
  cle: 'v1', libelle: 'RC-1001', voyages: 4, livres: 3, annules: 1, tonnes: 68, livres_sans_poids: 1,
  cycle_moyen_min: 57, cycles_mesures: 3, rotation_moyenne_min: 135, rotations_mesurees: 2, incidents: 1, litiges: 1, ...extra,
});

describe('rapports de voyages par axe', () => {
  it('libelle : sans cle, ou non visible avec les droits du lecteur', () => {
    expect(libelleLigne('camion', ligne())).toBe('RC-1001');
    expect(libelleLigne('shift', ligne({ cle: null, libelle: null }))).toBe('Sans shift');
    expect(libelleLigne('chauffeur', ligne({ libelle: null }))).toBe('Non visible avec vos droits');
  });

  it('export CSV : une mesure absente reste vide', () => {
    const csv = buildCSV(lignesCsv('camion', [ligne(), ligne({ cle: 'v2', libelle: 'RC-1002', tonnes: null, rotation_moyenne_min: null })]));
    const [entete, l1, l2] = csv.split('\n');
    expect(entete).toBe('Camion,Voyages,Livres,Annules,Tonnes_livrees,Livres_sans_poids,Cycle_moyen_min,Cycles_mesures,Rotation_moyenne_min,Rotations_mesurees,Incidents,Litiges');
    expect(l1).toBe('RC-1001,4,3,1,68,1,57,3,135,2,1,1');
    expect(l2).toBe('RC-1002,4,3,1,,1,57,3,,2,1,1');
  });
});
