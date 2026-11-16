import { describe, expect, it } from 'vitest';
import {
  erreurCauses, erreurVentilation, grouperSimulation, instantConakry, lignesVentilationServeur, scenarios, tauxAbsence, texteValeur, tonnesParJour,
  type LigneShift, type LigneSimulation,
} from './planAvance';

const ligne = (code: string, valeur: number | null, extra: Partial<LigneSimulation> = {}): LigneSimulation => ({
  rang: 1, groupe: 'Scénario', code, libelle: code, valeur, unite: 't', source: 's', remarque: null, ...extra,
});

describe('simulation (D-063)', () => {
  it('groupe dans l\'ordre des rangs', () => {
    const g = grouperSimulation([
      ligne('b', 1, { rang: 20, groupe: 'Besoin' }),
      ligne('a', 1, { rang: 2, groupe: 'Hypothèses' }),
      ligne('c', 1, { rang: 21, groupe: 'Besoin' }),
    ]);
    expect(g.map((x) => x.groupe)).toEqual(['Hypothèses', 'Besoin']);
    expect(g[1].lignes.map((l) => l.code)).toEqual(['b', 'c']);
  });

  it('valeur absente : donnees insuffisantes, jamais 0', () => {
    expect(texteValeur(ligne('x', null, { remarque: 'Données insuffisantes : il faut 10 mesures' }))).toBe('Données insuffisantes');
    expect(texteValeur(ligne('x', null))).toBe('—');
    expect(texteValeur(ligne('x', 720))).toBe('720 t');
  });

  it('scenarios : revision au tonnage atteignable et renfort de moyens', () => {
    const s = scenarios([
      ligne('objectif_propose', 560), ligne('camions_necessaires', 7), ligne('engins_necessaires', 1),
      ligne('renfort_camions', 4), ligne('renfort_engins', 0),
    ], 1000);
    expect(s.map((x) => x.cle)).toEqual(['revision', 'renfort']);
    expect(s[0]).toMatchObject({ tonnes: 560, camions: null });
    expect(s[1]).toMatchObject({ tonnes: 1000, camions: 7, chargeuses: 1 });
    expect(s[1].titre).toContain('4 camion(s)');
  });

  it('heure choisie lue a Conakry (UTC+0), pas dans le fuseau du navigateur', () => {
    expect(instantConakry('2001-03-05', '12:00')).toBe('2001-03-05T12:00:00.000Z');
    expect(instantConakry('2001-03-05', '00:00')).toBe('2001-03-05T00:00:00.000Z');
  });

  it('aucun scenario sans donnees ou si l\'objectif est tenable', () => {
    expect(scenarios([ligne('objectif_propose', null), ligne('camions_necessaires', null)], 1000)).toEqual([]);
    expect(scenarios([ligne('objectif_propose', null), ligne('camions_necessaires', 3), ligne('renfort_camions', 0), ligne('renfort_engins', 0)], 1000)).toEqual([]);
  });
});

describe('ventilation (D-063)', () => {
  const l = (destination_id: string, contrat_id: string, tonnes: string) => ({ destination_id, contrat_id, tonnes });
  it('memes regles que ventiler_objectif', () => {
    expect(erreurVentilation([], 100, 'mine')).toMatch(/au moins une ligne/);
    expect(erreurVentilation([l('', '', '10')], 100, 'mine')).toMatch(/destination ou un contrat/);
    expect(erreurVentilation([l('mine', '', '10')], 100, 'mine')).toMatch(/diffère du site/);
    expect(erreurVentilation([l('d1', '', '0')], 100, 'mine')).toMatch(/supérieures à zéro/);
    expect(erreurVentilation([l('d1', '', '10'), l('d1', '', '5')], 100, 'mine')).toMatch(/même destination/);
    expect(erreurVentilation([l('d1', '', '60'), l('d2', '', '50')], 100, 'mine')).toMatch(/dépasse l'objectif/);
    expect(erreurVentilation([l('d1', '', '60'), l('', 'c1', '40')], 100, 'mine')).toMatch(/même forme/);
    expect(erreurVentilation([l('d1', 'c1', '60'), l('d2', '', '40')], 100, 'mine')).toMatch(/même forme/);
    expect(erreurVentilation([l('d1', '', '60'), l('d2', '', '40')], 100, 'mine')).toBeNull();
    expect(erreurVentilation([l('d1', 'c1', '60'), l('d2', 'c1', '40')], 100, 'mine')).toBeNull();
  });
  it('arrondit chaque ligne au centieme avant le cumul', () => {
    expect(erreurVentilation([l('d1', '', '50,005'), l('d2', '', '49,995')], 100, 'mine')).toMatch(/dépasse l'objectif/);
    expect(erreurVentilation([l('d1', '', '50,004'), l('d2', '', '49,996')], 100, 'mine')).toBeNull();
  });
  it('envoie null pour une dimension non choisie', () => {
    expect(lignesVentilationServeur([l('d1', '', '1 200,5')])).toEqual([{ destination_id: 'd1', contrat_id: null, tonnes: 1200.5 }]);
  });
});

describe('cloture (D-063)', () => {
  it('cause requise si le realise est sous l\'objectif', () => {
    expect(erreurCauses([], 1000, 200)).toMatch(/au moins une cause/);
    expect(erreurCauses([], 1000, 1000)).toBeNull();
    expect(erreurCauses([], null, 200)).toBeNull();
    expect(erreurCauses([{ categorie: 'panne_camion', description: ' ', tonnes: '' }], 1000, 200)).toMatch(/Décrivez/);
    expect(erreurCauses([{ categorie: 'panne_camion', description: 'Deux pannes', tonnes: '300' }], 1000, 200)).toBeNull();
  });
});

describe('comparaison des shifts (D-063)', () => {
  const base = { jours: 4, tonnes_livrees: 1160, presences: 3, absences: 1 } as LigneShift;
  it('ratios seulement quand la base existe', () => {
    expect(tonnesParJour(base)).toBe(290);
    expect(tonnesParJour({ ...base, jours: 0 })).toBeNull();
    expect(tauxAbsence(base)).toBe(25);
    expect(tauxAbsence({ ...base, presences: null, absences: null })).toBeNull();
  });
});
