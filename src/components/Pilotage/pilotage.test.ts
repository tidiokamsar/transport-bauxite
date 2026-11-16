import { describe, expect, it } from 'vitest';
import { comparerIndicateurs, lignesExportComparaison, type Indicateur } from './pilotage';

const ind = (o: Partial<Indicateur>): Indicateur => ({
  domaine: 'Production', code: 'tonnes_livrees', libelle: 'Tonnes livrées', valeur: 100, unite: 't', source: 'trips', fiabilite: 'mesure',
  detail: null, periode_debut: '2026-10-01', periode_fin: '2026-10-31', calcule_le: '2026-11-15T10:00:00Z', nature: 'periode', ...o,
});
const A = { periode_debut: '2026-09-01', periode_fin: '2026-09-30' };
const B = { periode_debut: '2026-10-01', periode_fin: '2026-10-30' };

describe('comparerIndicateurs (D-068)', () => {
  it('ecart absolu et relatif quand les deux periodes sont mesurees et terminees', () => {
    const [l] = comparerIndicateurs([ind({ ...A, valeur: 200 })], [ind({ ...B, valeur: 250 })], '2026-11-15');
    expect(l.ecart).toBe(50);
    expect(l.ecartPct).toBe(25);
    expect(l.prudence).toBe('comparable');
  });

  it('sans donnees sur une periode : non comparable, aucun ecart calcule', () => {
    const [l] = comparerIndicateurs([ind({ ...A, valeur: null, fiabilite: 'sans_donnees' })], [ind({ ...B, valeur: 250 })], '2026-11-15');
    expect(l.ecart).toBeNull();
    expect(l.prudence).toBe('non_comparable');
    expect(l.motifs).toContain('Sans données sur au moins une période');
  });

  it('valeur partielle ou periode en cours : prudence', () => {
    const [p] = comparerIndicateurs([ind({ ...A, fiabilite: 'partielle' })], [ind(B)], '2026-11-15');
    expect(p.prudence).toBe('prudence');
    const [c] = comparerIndicateurs([ind(A)], [ind({ periode_debut: '2026-11-01', periode_fin: '2026-11-30' })], '2026-11-15');
    expect(c.prudence).toBe('prudence');
    expect(c.motifs).toContain('Période B non terminée');
  });

  it('durees differentes signalees ; instantane non comparable', () => {
    const [d] = comparerIndicateurs([ind({ periode_debut: '2026-09-01', periode_fin: '2026-09-10' })], [ind(B)], '2026-11-15');
    expect(d.motifs).toContain('Durées de période différentes');
    const [i] = comparerIndicateurs([ind({ ...A, code: 'engins_actifs', nature: 'instantane' })], [ind({ ...B, code: 'engins_actifs', nature: 'instantane' })], '2026-11-15');
    expect(i.prudence).toBe('non_comparable');
    expect(i.ecart).toBeNull();
  });

  it('reference nulle : pas de pourcentage ; indicateur present sur une seule periode garde', () => {
    const l = comparerIndicateurs([ind({ ...A, valeur: 0 })], [ind({ ...B, valeur: 5 }), ind({ ...B, code: 'reste_a_payer_usd', libelle: 'Reste USD' })], '2026-11-15');
    expect(l[0].ecart).toBe(5);
    expect(l[0].ecartPct).toBeNull();
    expect(l[1].code).toBe('reste_a_payer_usd');
    expect(l[1].prudence).toBe('non_comparable');
    expect(lignesExportComparaison(l)[1].valeur_a).toBe('Sans données');
  });
});
