import { describe, expect, it } from 'vitest';
import { SOURCES_RECHERCHE, filtreOu, motifRecherche, presenter } from './recherche';
import { REGLAGES, valeurAffichee, valeurValide } from '../Settings/reglages';
import { lirePolygone } from '../Geofencing/zones';

describe('recherche globale (D-061)', () => {
  it('une source par type de resultat, colonnes reelles', () => {
    expect(SOURCES_RECHERCHE.map((s) => s.type)).toEqual(['vehicule', 'chauffeur', 'voyage', 'ordre', 'facture', 'site']);
    expect(new Set(SOURCES_RECHERCHE.map((s) => s.table)).size).toBe(SOURCES_RECHERCHE.length);
    for (const s of SOURCES_RECHERCHE) for (const f of s.filtres) expect(s.colonnes).toContain(f);
  });
  it('motif neutralise les caracteres speciaux du filtre', () => {
    expect(motifRecherche('a')).toBeNull();
    expect(motifRecherche('AB,(x)%')).toBe('AB x');
    expect(filtreOu(SOURCES_RECHERCHE[0], 'RC 12')).toBe('registration.ilike.*RC 12*,brand_model.ilike.*RC 12*');
  });
  it('libelles depuis les colonnes reelles', () => {
    expect(presenter('chauffeur', { name: 'Mamadou', license_number: 'P1', phone: null, status: 'active' }))
      .toEqual({ titre: 'Mamadou', detail: 'Permis P1 · active' });
    expect(presenter('facture', { numero: null, objet: 'Transport', statut: 'brouillon', montant_ttc: null }).titre).toBe('Brouillon sans numéro');
  });
});

describe('parametres lus par le serveur (D-061)', () => {
  it('liste fermee des cles lues par les fonctions SQL', () => {
    expect(REGLAGES.map((r) => r.cle).sort()).toEqual([
      'achats_validation_separee', 'carburant_validation_separee', 'consultation_offres_minimum', 'controle_depart_exige',
      'fournisseurs_alerte_documents_jours', 'kilometrage_validation_separee', 'mfa_exige', 'paiements_validation_separee',
      'pneu_inspection_max_jours', 'pneu_profondeur_min_mm', 'pneu_reforme_precoce_km', 'tolerance_poids_cbg_t',
    ]);
  });
  it('format controle comme valider_reglage', () => {
    const tol = REGLAGES.find((r) => r.cle === 'tolerance_poids_cbg_t')!;
    const mfa = REGLAGES.find((r) => r.cle === 'mfa_exige')!;
    expect(valeurValide(tol, '0.5')).toBe(true);
    expect(valeurValide(tol, '-1')).toBe(false);
    expect(valeurValide(mfa, 'oui')).toBe(false);
    expect(valeurAffichee(tol, undefined)).toBe('Absent : 0 t : tout écart est signalé.');
    expect(valeurAffichee(mfa, 'false')).toBe('Non');
    const offres = REGLAGES.find((r) => r.cle === 'consultation_offres_minimum')!;
    expect(valeurValide(offres, '2')).toBe(true);
    expect(valeurValide(offres, '1.5')).toBe(false);
    expect(valeurValide(offres, '0')).toBe(false);
  });
});

describe('zone de georeperage (D-061)', () => {
  it('polygone : au moins trois sommets valides', () => {
    expect(lirePolygone('10, -13\n10.1, -13\n10.1, -13.1')).toEqual([[10, -13], [10.1, -13], [10.1, -13.1]]);
    expect(lirePolygone('10, -13\n10.1, -13')).toBeNull();
    expect(lirePolygone('10, -13\n10.1, -13\n95, 0')).toBeNull();
  });
});
