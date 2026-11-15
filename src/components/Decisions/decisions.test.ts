import { describe, expect, it } from 'vitest';
import { etatRegle, grouperParPriorite, type ElementDecision, type RegleAlerte } from './decisions';

const el = (o: Partial<ElementDecision>): ElementDecision => ({
  nature: 'alerte', priorite: 3, gravite: 'warning', categorie: 'HSE', objet: 'X', reference: null, detail: null, depuis: null,
  ecran: null, alerte_id: null, statut: 'active', regle: null, condition_levee_le: null, detectee_le: null, ...o,
});

describe('grouperParPriorite (D-068)', () => {
  it('critique, puis decisions, puis avertissements ; plus ancien d\'abord, date inconnue en dernier', () => {
    const g = grouperParPriorite([
      el({ objet: 'a', priorite: 3, depuis: '2026-11-02' }), el({ objet: 'b', priorite: 1, depuis: '2026-11-05' }),
      el({ objet: 'c', priorite: 2, nature: 'validation' }), el({ objet: 'd', priorite: 3, depuis: '2026-11-01' }), el({ objet: 'e', priorite: 3 }),
    ]);
    expect(g.map((x) => x.priorite)).toEqual([1, 2, 3]);
    expect(g[2].liste.map((x) => x.objet)).toEqual(['d', 'a', 'e']);
  });
});

describe('etatRegle', () => {
  const r = (o: Partial<RegleAlerte>): RegleAlerte => ({
    regle: 'immobilisation_longue', libelle: 'Immobilisation longue', domaine: 'Maintenance', cle: 'alerte_immobilisation_longue_h',
    type_reglage: 'seuil', unite: 'h', gravite: 'warning', description: '', en_service: false, seuil: null, ...o,
  });
  it('regle a seuil sans reglage : inactive, aucun seuil suppose', () => {
    expect(etatRegle(r({}))).toBe('Inactive : seuil non saisi (alerte_immobilisation_longue_h)');
    expect(etatRegle(r({ seuil: 48, en_service: true }))).toBe('Active : seuil 48 h');
  });
  it('regle d\'activation', () => {
    expect(etatRegle(r({ type_reglage: 'activation', cle: 'alerte_epi_echu_active', en_service: true }))).toBe('Active');
    expect(etatRegle(r({ type_reglage: 'activation', cle: 'alerte_epi_echu_active', en_service: false }))).toBe('Désactivée (alerte_epi_echu_active = false)');
  });
});
