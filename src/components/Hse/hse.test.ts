import { describe, expect, it } from 'vitest';
import { criticite, etatEcheanceEpi, resultatControle, type PointControle } from './hse';

describe('HSE complementaire (D-068)', () => {
  it('echeance EPI : atteinte le jour meme, aucune echeance sans saisie', () => {
    expect(etatEcheanceEpi('2026-11-15', '2026-11-15')).toBe('echue');
    expect(etatEcheanceEpi('2026-12-01', '2026-11-15')).toBe('a_venir');
    expect(etatEcheanceEpi(null, '2026-11-15')).toBeNull();
  });
  it('criticite : produit des cotations saisies, absente si une cotation manque', () => {
    expect(criticite(4, 2)).toBe(8);
    expect(criticite(null, 2)).toBeNull();
  });
});

const points: PointControle[] = [
  { id: 'f', libelle: 'Freins', categorie: 'freinage', bloquant: true, ordre: 1, actif: true },
  { id: 'r', libelle: 'Retroviseurs', categorie: 'securite', bloquant: false, ordre: 2, actif: true },
  { id: 'x', libelle: 'Ancien point', categorie: 'autre', bloquant: true, ordre: 3, actif: false },
];

describe('controle avant depart (D-054)', () => {
  it('attend tous les points actifs', () => {
    expect(resultatControle(points, { f: { resultat: 'conforme', observation: '' } })).toBeNull();
    expect(resultatControle([], {})).toBeNull();
  });

  it('calcule le resultat comme le serveur', () => {
    expect(resultatControle(points, { f: { resultat: 'conforme', observation: '' }, r: { resultat: 'sans_objet', observation: '' } })).toBe('conforme');
    expect(resultatControle(points, { f: { resultat: 'conforme', observation: '' }, r: { resultat: 'non_conforme', observation: 'Fele' } })).toBe('reserves');
    expect(resultatControle(points, { f: { resultat: 'non_conforme', observation: 'Molle' }, r: { resultat: 'conforme', observation: '' } })).toBe('non_conforme');
  });

  it('exige une observation pour une non-conformite', () => {
    expect(resultatControle(points, { f: { resultat: 'non_conforme', observation: ' ' }, r: { resultat: 'conforme', observation: '' } })).toBeNull();
  });
});
