import { describe, expect, it } from 'vitest';
import { calculerDecompte, type ParametresContrat, type Segment } from './decompte';

// Valeurs de test uniquement : elles ne representent aucun tarif ni
// contrat reel (regle 1 du CLAUDE.md, D-013).
const contrat = (surcharge: Partial<ParametresContrat> = {}): Partial<ParametresContrat> => ({
  sens: 'preneur',
  devise: 'GNF',
  decimalesMontant: 0,
  decalageUtcMinutes: 0,
  sourceReference: 'pointage',
  sourcesControle: [],
  toleranceEcartMinutes: null,
  regleEcart: null,
  siControleAbsent: null,
  coefficientsCategorie: { productif: 100, attente: 100, panne_loueur: 0 },
  tarifs: [{ dateEffet: '2026-11-01', tauxHoraire: 100 }],
  franchiseJournaliereMinutes: null,
  arrondiJournalier: null,
  plafondJournalierHeures: null,
  minimumJournalierHeures: null,
  minimumSiDisponibleSeulement: null,
  categoriesIndisponibilite: [],
  majorations: [],
  ...surcharge,
});

const seg = (debut: string, fin: string, categorie = 'productif', source = 'pointage'): Segment => ({
  debut: `2026-11-${debut}:00Z`,
  fin: `2026-11-${fin}:00Z`,
  categorie,
  source,
});

const periode = { du: '2026-11-01', au: '2026-11-30' };

const brouillon = (r: ReturnType<typeof calculerDecompte>) => {
  if (r.statut !== 'brouillon') throw new Error(`non calculable : ${r.motifs.join(' ; ')}`);
  return r;
};

describe('calculerDecompte - heures et coefficients', () => {
  it('L-01 : attente facturee a 100 %, panne du loueur a 0 %', () => {
    const r = brouillon(calculerDecompte(contrat(), [
      seg('02T06:00', '02T10:00'),
      seg('02T10:00', '02T11:00', 'attente'),
      seg('02T11:00', '02T13:00', 'panne_loueur'),
    ], periode));
    expect(r.jours).toHaveLength(1);
    expect(r.jours[0].heuresFacturees).toBe(5);
    expect(r.total).toBe(500);
    expect(r.nature).toBe('cout');
  });

  it('L-11 : exploitant bailleur, meme calcul en revenu', () => {
    const r = brouillon(calculerDecompte(contrat({ sens: 'bailleur' }), [seg('02T06:00', '02T10:00')], periode));
    expect(r.nature).toBe('revenu');
    expect(r.total).toBe(400);
  });

  it('materiel interne : nature cout interne', () => {
    const r = brouillon(calculerDecompte(contrat({ sens: 'interne' }), [seg('02T06:00', '02T07:00')], periode));
    expect(r.nature).toBe('cout_interne');
  });
});

describe('calculerDecompte - minimum garanti', () => {
  const avecMinimum = (siDisponibleSeulement: boolean) => contrat({
    minimumJournalierHeures: 8,
    minimumSiDisponibleSeulement: siDisponibleSeulement,
    categoriesIndisponibilite: ['panne_loueur'],
  });

  it('L-02 : journee courte sans panne, minimum applique', () => {
    const r = brouillon(calculerDecompte(avecMinimum(true), [seg('02T06:00', '02T10:00')], periode));
    expect(r.jours[0].ajustements).toEqual([{ motif: 'minimum', heures: 4, montant: 400 }]);
    expect(r.total).toBe(800);
  });

  it('L-03 : panne du loueur, minimum non applique si la condition l\'exige', () => {
    const segments = [seg('02T06:00', '02T10:00'), seg('02T10:00', '02T12:00', 'panne_loueur')];
    expect(brouillon(calculerDecompte(avecMinimum(true), segments, periode)).total).toBe(400);
    expect(brouillon(calculerDecompte(avecMinimum(false), segments, periode)).total).toBe(800);
  });

  it('pas de minimum un jour sans segment de reference', () => {
    const r = brouillon(calculerDecompte(
      avecMinimum(true),
      [seg('02T06:00', '02T10:00')],
      periode,
    ));
    expect(r.jours.map((j) => j.jour)).toEqual(['2026-11-02']);
  });
});

describe('calculerDecompte - preuve des heures', () => {
  const avecGps = (regle: 'retenir_reference' | 'bloquer', absent: 'ignorer' | 'bloquer' = 'ignorer') => contrat({
    sourcesControle: ['gps'],
    toleranceEcartMinutes: 15,
    regleEcart: regle,
    siControleAbsent: absent,
  });

  it('L-04 : ecart hors tolerance, jour bloque pour validation', () => {
    const r = brouillon(calculerDecompte(avecGps('bloquer'), [
      seg('02T06:00', '02T10:00'),
      seg('02T06:00', '02T09:30', 'contact', 'gps'),
    ], periode));
    expect(r.jours[0].comparaisons[0]).toEqual({
      source: 'gps', minutesReference: 240, minutesControle: 210, statut: 'hors_tolerance',
    });
    expect(r.joursAValider).toEqual(['2026-11-02']);
    expect(r.total).toBe(0);
  });

  it('ecart hors tolerance, reference retenue et ecart signale', () => {
    const r = brouillon(calculerDecompte(avecGps('retenir_reference'), [
      seg('02T06:00', '02T10:00'),
      seg('02T06:00', '02T09:30', 'contact', 'gps'),
    ], periode));
    expect(r.jours[0].comparaisons[0].statut).toBe('hors_tolerance');
    expect(r.joursAValider).toEqual([]);
    expect(r.total).toBe(400);
  });

  it('ecart dans la tolerance : conforme', () => {
    const r = brouillon(calculerDecompte(avecGps('bloquer'), [
      seg('02T06:00', '02T10:00'),
      seg('02T06:10', '02T10:00', 'contact', 'gps'),
    ], periode));
    expect(r.jours[0].comparaisons[0].statut).toBe('conforme');
    expect(r.total).toBe(400);
  });

  it('controle absent : ignore ou bloque selon le contrat', () => {
    const segments = [seg('02T06:00', '02T10:00')];
    const ignore = brouillon(calculerDecompte(avecGps('bloquer', 'ignorer'), segments, periode));
    expect(ignore.jours[0].comparaisons[0].statut).toBe('controle_absent');
    expect(ignore.total).toBe(400);
    const bloque = brouillon(calculerDecompte(avecGps('bloquer', 'bloquer'), segments, periode));
    expect(bloque.joursAValider).toEqual(['2026-11-02']);
  });

  it('activite au controle sans pointage : jour signale, aucune heure facturee', () => {
    const r = brouillon(calculerDecompte(avecGps('bloquer'), [
      seg('03T06:00', '03T10:00', 'contact', 'gps'),
    ], periode));
    expect(r.jours[0].heuresFacturees).toBe(0);
    expect(r.joursAValider).toEqual(['2026-11-03']);
  });
});

describe('calculerDecompte - decoupage et tarifs', () => {
  it('L-05 : segment a cheval sur minuit, deux jours', () => {
    const r = brouillon(calculerDecompte(contrat(), [seg('02T22:00', '03T02:00')], periode));
    expect(r.jours.map((j) => [j.jour, j.heuresFacturees])).toEqual([['2026-11-02', 2], ['2026-11-03', 2]]);
  });

  it('le jour est celui du fuseau du site', () => {
    const r = brouillon(calculerDecompte(contrat({ decalageUtcMinutes: 60 }), [
      seg('02T22:30', '02T23:30'),
    ], periode));
    expect(r.jours.map((j) => [j.jour, j.heuresFacturees])).toEqual([['2026-11-02', 0.5], ['2026-11-03', 0.5]]);
  });

  it('L-06 : majoration de nuit sur une partie du segment', () => {
    const r = brouillon(calculerDecompte(contrat({
      majorations: [{ nom: 'nuit', debut: '20:00', fin: '06:00', pourcentage: 125 }],
    }), [seg('02T18:00', '02T22:00')], periode));
    expect(r.jours[0].lignes.map((l) => [l.majoration, l.heures, l.montant])).toEqual([
      [null, 2, 200],
      ['nuit', 2, 250],
    ]);
    expect(r.total).toBe(450);
  });

  it('L-08 : changement de taux en cours de periode', () => {
    const r = brouillon(calculerDecompte(contrat({
      tarifs: [{ dateEffet: '2026-11-01', tauxHoraire: 100 }, { dateEffet: '2026-11-03', tauxHoraire: 120 }],
    }), [seg('02T06:00', '02T10:00'), seg('03T06:00', '03T10:00')], periode));
    expect(r.jours.map((j) => [j.tauxHoraire, j.montant])).toEqual([[100, 400], [120, 480]]);
    expect(r.total).toBe(880);
  });

  it('les segments hors periode sont ignores', () => {
    const r = brouillon(calculerDecompte(contrat(), [seg('02T22:00', '03T02:00')], { du: '2026-11-03', au: '2026-11-03' }));
    expect(r.jours.map((j) => j.jour)).toEqual(['2026-11-03']);
    expect(r.total).toBe(200);
  });

  it('devise a decimales', () => {
    const r = brouillon(calculerDecompte(contrat({
      devise: 'USD', decimalesMontant: 2, tarifs: [{ dateEffet: '2026-11-01', tauxHoraire: 33.33 }],
    }), [seg('02T06:00', '02T06:20')], periode));
    expect(r.devise).toBe('USD');
    expect(r.total).toBe(11.11);
  });
});

describe('calculerDecompte - ajustements journaliers', () => {
  it('franchise, arrondi et plafond dans cet ordre', () => {
    const r = brouillon(calculerDecompte(contrat({
      franchiseJournaliereMinutes: 15,
      arrondiJournalier: { pasMinutes: 30, mode: 'superieur' },
      plafondJournalierHeures: 10,
    }), [seg('02T06:00', '02T10:25')], periode));
    // 4 h 25 - 15 min = 4 h 10, arrondi superieur a 4 h 30.
    expect(r.jours[0].heuresFacturees).toBe(4.5);
    expect(r.jours[0].ajustements.map((a) => a.motif)).toEqual(['franchise', 'arrondi']);
    expect(r.total).toBe(450);
  });

  it('plafond journalier', () => {
    const r = brouillon(calculerDecompte(contrat({ plafondJournalierHeures: 10 }), [seg('02T06:00', '02T18:00')], periode));
    expect(r.jours[0].heuresFacturees).toBe(10);
    expect(r.total).toBe(1000);
  });

  it('arrondi inferieur et au plus proche', () => {
    const calcul = (mode: 'inferieur' | 'plus_proche', fin: string) => brouillon(calculerDecompte(
      contrat({ arrondiJournalier: { pasMinutes: 15, mode } }),
      [seg('02T06:00', fin)],
      periode,
    )).jours[0].heuresFacturees;
    expect(calcul('inferieur', '02T06:58')).toBe(0.75);
    expect(calcul('plus_proche', '02T06:50')).toBe(0.75);
    expect(calcul('plus_proche', '02T06:53')).toBe(1);
  });
});

describe('calculerDecompte - non calculable (L-12)', () => {
  it('parametre obligatoire absent : aucun montant', () => {
    const p = contrat();
    delete p.tarifs;
    const r = calculerDecompte(p, [seg('02T06:00', '02T10:00')], periode);
    expect(r).toEqual({ statut: 'non_calculable', motifs: ['parametre manquant : tarifs'] });
  });

  it('parametres conditionnels requis', () => {
    const r = calculerDecompte(contrat({ sourcesControle: ['gps'], minimumJournalierHeures: 8 }), [], periode);
    expect(r.statut).toBe('non_calculable');
    if (r.statut === 'non_calculable') {
      expect(r.motifs).toEqual([
        'toleranceEcartMinutes requise (>= 0) avec des sources de controle',
        'regleEcart requise avec des sources de controle',
        'siControleAbsent requis avec des sources de controle',
        'minimumSiDisponibleSeulement requis avec un minimum',
      ]);
    }
  });

  it('categorie sans coefficient au contrat', () => {
    const r = calculerDecompte(contrat(), [seg('02T06:00', '02T10:00', 'toString')], periode);
    expect(r.statut).toBe('non_calculable');
  });

  it('segments qui se chevauchent', () => {
    const r = calculerDecompte(contrat(), [seg('02T06:00', '02T10:00'), seg('02T09:00', '02T11:00')], periode);
    expect(r).toEqual({ statut: 'non_calculable', motifs: ['segments qui se chevauchent pour la source pointage'] });
  });

  it('source non prevue au contrat', () => {
    const r = calculerDecompte(contrat(), [seg('02T06:00', '02T10:00', 'productif', 'horametre')], periode);
    expect(r.statut).toBe('non_calculable');
  });

  it('jour sans tarif en vigueur', () => {
    const r = calculerDecompte(contrat({ tarifs: [{ dateEffet: '2026-11-05', tauxHoraire: 100 }] }),
      [seg('02T06:00', '02T10:00')], periode);
    expect(r).toEqual({ statut: 'non_calculable', motifs: ['aucun tarif en vigueur le 2026-11-02'] });
  });

  it('plages de majoration qui se chevauchent', () => {
    const r = calculerDecompte(contrat({
      majorations: [
        { nom: 'nuit', debut: '20:00', fin: '06:00', pourcentage: 125 },
        { nom: 'soir', debut: '18:00', fin: '21:00', pourcentage: 110 },
      ],
    }), [], periode);
    expect(r.statut).toBe('non_calculable');
  });
});
