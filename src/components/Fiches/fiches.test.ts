import { describe, expect, it } from 'vitest';
import { etapesRotation, horodater, ligneVide } from './fiches';

describe('fiches terrain', () => {
  it('horodatage, y compris apres minuit pour un shift de nuit', () => {
    expect(horodater('2026-11-10', '07:15', '06:00')).toEqual(new Date(2026, 10, 10, 7, 15));
    expect(horodater('2026-11-10', '02:30', '18:00')).toEqual(new Date(2026, 10, 11, 2, 30));
    expect(horodater('2026-11-10', '02:30', null)).toEqual(new Date(2026, 10, 10, 2, 30));
  });

  it('ligne de rotation : heures saisies et pesee a l\'arrivee', () => {
    const ligne = { ...ligneVide(), heures: { AT_LOADING: '07:00', LOADED: '07:20', DELIVERED: '08:30' }, heurePesee: '08:20', brut: '56,1', tare: '15,4', ticket: ' PB-9 ' };
    const { etapes, erreur } = etapesRotation(ligne, '2026-11-10', 'arrivee', '06:00');
    expect(erreur).toBeNull();
    expect(etapes.map((e) => e.etat)).toEqual(['AT_LOADING', 'LOADED', 'DELIVERED', 'WEIGHED_IN']);
    expect(etapes[3].donnees).toEqual({ brut: 56.1, tare: 15.4, ticket: 'PB-9' });
    expect(etapes[0].quand).toBe(new Date(2026, 10, 10, 7, 0).toISOString());
  });

  it('pesee au depart, sans ticket', () => {
    const ligne = { ...ligneVide(), heures: { IN_TRANSIT: '07:30' }, heurePesee: '07:25', brut: '55', tare: '15' };
    const { etapes } = etapesRotation(ligne, '2026-11-10', 'depart', '06:00');
    expect(etapes.find((e) => e.etat === 'WEIGHED_OUT')?.donnees).toEqual({ brut: 55, tare: 15 });
  });

  it('pesee incomplete ou incoherente, ligne vide : refusees avant envoi', () => {
    expect(etapesRotation({ ...ligneVide(), heures: { LOADED: '07:00' }, brut: '55' }, '2026-11-10', 'arrivee', null).erreur)
      .toBe('Pesée incomplète : heure, brut et tare requis');
    expect(etapesRotation({ ...ligneVide(), heurePesee: '07:00', brut: '10', tare: '15' }, '2026-11-10', 'arrivee', null).erreur)
      .toBe('Pesée incohérente : le brut doit dépasser la tare');
    expect(etapesRotation(ligneVide(), '2026-11-10', 'arrivee', null).erreur).toBe('Aucune heure saisie');
  });
});
