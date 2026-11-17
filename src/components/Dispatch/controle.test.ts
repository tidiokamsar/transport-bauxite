import { describe, expect, it } from 'vitest';
import {
  actionsPoste, calculerBesoin, dansVue, fraicheur, libelleAnciennete, libelleShiftCourant, messageErreur, motifRequis, shiftHoraire,
} from './controle';
import { evaluerConfiance, recommander, type Chauffeur, type Engin, type VoyageShift } from './recommandation';

const JOUR = { id: 'j', display_name: 'Jour', start_time: '06:00:00', end_time: '18:00:00' };
const NUIT = { id: 'n', display_name: 'Nuit', start_time: '18:00:00', end_time: '06:00:00' };
const a = (h: number, m = 0) => new Date(2026, 10, 17, h, m);

describe('shifts : referentiel et instance (D-087)', () => {
  it('le shift horaire couvre l\'heure, la nuit passe minuit, sans repli sur le premier shift', () => {
    expect(shiftHoraire([JOUR, NUIT], a(10))?.id).toBe('j');
    expect(shiftHoraire([JOUR, NUIT], a(2))?.id).toBe('n');
    expect(shiftHoraire([JOUR], a(20))).toBeNull();
  });

  it('un filtre ou une plage horaire n\'est jamais un shift actif', () => {
    expect(libelleShiftCourant([JOUR], null, a(10))).toMatchObject({ titre: 'Shift Jour', actif: false });
    expect(libelleShiftCourant([JOUR], null, a(10)).detail).toContain('non ouvert');
    expect(libelleShiftCourant([JOUR], null, a(20))).toMatchObject({ titre: 'Hors plage horaire', actif: false });
    expect(libelleShiftCourant([JOUR], { etat: 'en_cours', libelle: 'Jour' }, a(20))).toMatchObject({ titre: 'Shift Jour', actif: true });
    expect(libelleShiftCourant([], null, a(10)).titre).toBe('Aucun shift défini');
    expect(libelleShiftCourant(null, null, a(10)).titre).toBe('Shifts indisponibles');
  });

  it('actions selon l\'etat de l\'instance', () => {
    expect(actionsPoste(null)).toEqual(['planifier', 'ouvrir']);
    expect(actionsPoste('ouvert')).toContain('demarrer');
    expect(actionsPoste('en_cours')).toContain('cloturer');
    expect(actionsPoste('cloture')).toEqual([]);
    expect(actionsPoste('annule')).toEqual([]);
  });
});

describe('besoin en voyages (miroir de besoin_shift)', () => {
  const base = { tonnes_cible: 120, voyages_cible: null, capacite_utile_t: 40, hypothese_charge_pct: 75, voyages_existants: 2 };
  it('cible / (capacite x hypothese), arrondi au voyage superieur, moins l\'existant', () => {
    expect(calculerBesoin(base)).toMatchObject({ besoin: 4, proposition: 2 });
    expect(calculerBesoin({ ...base, tonnes_cible: 121 }).besoin).toBe(5);
  });
  it('les voyages vises par l\'objectif priment', () => {
    expect(calculerBesoin({ ...base, voyages_cible: 6 })).toMatchObject({ besoin: 6, proposition: 4 });
  });
  it('rien n\'est suppose : sans objectif, sans capacite ou sans hypothese, pas de besoin', () => {
    expect(calculerBesoin({ ...base, tonnes_cible: null }).besoin).toBeNull();
    expect(calculerBesoin({ ...base, capacite_utile_t: null }).besoin).toBeNull();
    expect(calculerBesoin({ ...base, hypothese_charge_pct: null }).base).toContain('Hypothèse de charge à saisir');
    expect(calculerBesoin({ ...base, hypothese_charge_pct: 120 }).besoin).toBeNull();
  });
  it('la proposition ne descend pas sous zero', () => {
    expect(calculerBesoin({ ...base, voyages_existants: 9 }).proposition).toBe(0);
  });
  it('motif exige si le nombre corrige la proposition ou sans proposition', () => {
    expect(motifRequis(2, 2)).toBe(false);
    expect(motifRequis(2, 3)).toBe(true);
    expect(motifRequis(null, 0)).toBe(false);
    expect(motifRequis(null, 1)).toBe(true);
  });
});

describe('vues des voyages et supervision', () => {
  it('classe les voyages par vue', () => {
    const s = new Set(['t2']);
    const r = new Set(['t3']);
    expect(dansVue('affectes', { id: 't1', etat: 'ASSIGNED' }, s, r)).toBe(true);
    expect(dansVue('pese_cbg', { id: 't1', etat: 'WEIGHED_IN' }, s, r)).toBe(true);
    expect(dansVue('suspendus', { id: 't2', etat: 'ASSIGNED' }, s, r)).toBe(true);
    expect(dansVue('a_reaffecter', { id: 't3', etat: 'ASSIGNED' }, s, r)).toBe(true);
    expect(dansVue('termines', { id: 't1', etat: 'ASSIGNED' }, s, r)).toBe(false);
  });
  it('une position ancienne n\'est jamais recente', () => {
    expect(fraicheur(null)).toBe('aucune');
    expect(fraicheur(3)).toBe('recente');
    expect(fraicheur(240)).toBe('ancienne');
    expect(libelleAnciennete(125)).toBe('il y a 2 h 05');
    expect(libelleAnciennete(null)).toBe('aucune transmission');
  });
  it('un conflit de version est nomme', () => {
    expect(messageErreur({ code: '40001', message: 'Voyage modifie' })).toBe('Conflit : Voyage modifie');
    expect(messageErreur({ code: '22023', message: 'Motif requis' })).toBe('Motif requis');
  });
});

describe('moteur de recommandation : contraintes et confiance (D-087)', () => {
  const DATE = '2026-11-17';
  const camion = (id: string, capacite: number | null = 40): Engin => ({ id, registration: id.toUpperCase(), vehicle_type: 'tipper', status: 'active', site_id: 'mine', capacity_tonnes: capacite });
  const ch = (id: string, name: string): Chauffeur => ({ id, name, status: 'active', license_expiry: '2030-01-01' });
  const v = (id: string): VoyageShift => ({ id, reference: `VYG-${id}`, etat: 'PLANNED', departure_site_id: 'mine', vehicle_id: null, driver_id: null, loader_vehicle_id: null });

  it('exclut le camion immobilise et le chauffeur non habilite', () => {
    const [r] = recommander({
      date: DATE, voyages: [v('1')], cibles: [{ voyage: v('1') }],
      engins: [camion('c1'), camion('c2')], chauffeurs: [ch('a', 'Alpha'), ch('b', 'Bah')], habitudes: new Map(),
      contexte: { immobilises: new Set(['c1']), nonHabilites: new Map([['a', 'visite_medicale']]), cycleMin: 95 },
    });
    expect(r.camion?.id).toBe('c2');
    expect(r.chauffeur?.id).toBe('b');
    expect(r.capacite).toBe(40);
    expect(r.dureeEstimeeMin).toBe(95);
    expect(r.contraintes).toContain('Habilitations requises valides à la date du voyage');
  });

  it('aucun chauffeur habilite : impossible, explique', () => {
    const [r] = recommander({
      date: DATE, voyages: [v('1')], cibles: [{ voyage: v('1') }],
      engins: [camion('c1')], chauffeurs: [ch('a', 'Alpha')], habitudes: new Map(),
      contexte: { nonHabilites: new Map([['a', 'visite_medicale']]) },
    });
    expect(r.impossible).toBe('Aucun chauffeur disponible, au permis valide et habilité');
    expect(r.confiance).toBe('faible');
  });

  it('chauffeur engage sur un autre camion hors du shift : ecarte', () => {
    const [r] = recommander({
      date: DATE, voyages: [v('1')], cibles: [{ voyage: v('1') }],
      engins: [camion('c1')], chauffeurs: [ch('a', 'Alpha'), ch('b', 'Bah')], habitudes: new Map(),
      contexte: { chauffeursEngages: new Map([['a', 'c9']]) },
    });
    expect(r.chauffeur?.id).toBe('b');
  });

  it('confiance selon la qualite des donnees, chaque manque nomme', () => {
    expect(evaluerConfiance({ chauffeurConnu: true, cycleConnu: true, capaciteConnue: true, habilitationsLues: true })).toEqual({ confiance: 'elevee', manques: [] });
    expect(evaluerConfiance({ chauffeurConnu: false, cycleConnu: true, capaciteConnue: true, habilitationsLues: true }).confiance).toBe('moyenne');
    const f = evaluerConfiance({ chauffeurConnu: false, cycleConnu: false, capaciteConnue: false, habilitationsLues: true });
    expect(f.confiance).toBe('faible');
    expect(f.manques).toContain('temps de cycle non mesuré sur ce shift');
  });

  it('deterministe : memes donnees, meme proposition', () => {
    const entree = {
      date: DATE, voyages: [v('1'), v('2')], cibles: [{ voyage: v('1') }, { voyage: v('2') }],
      engins: [camion('c2'), camion('c1')], chauffeurs: [ch('b', 'Bah'), ch('a', 'Alpha')], habitudes: new Map<string, string>(),
    };
    expect(recommander(entree)).toEqual(recommander(entree));
  });
});
