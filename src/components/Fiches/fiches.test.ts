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

  it('integre la pesee source CBG a la reception sans demander une seconde lecture Kogon', () => {
    const ligne = { ...ligneVide(), heures: { DELIVERED: '08:30' }, heurePesee: '08:20', ticket: ' PB-10 ', brut: '56', tare: '15', documentRef: 'BL-10.pdf' };
    const { etapes, erreur } = etapesRotation(ligne, '2026-11-10', 'arrivee', '06:00');
    expect(erreur).toBeNull();
    const pesee = etapes.find((e) => e.etat === 'WEIGHED_IN');
    expect(pesee?.donnees).toEqual({ brut: 56, tare: 15, ticket: 'PB-10', document_ref: 'BL-10.pdf' });
    expect(etapes.some((e) => e.etat === 'WEIGHED_OUT')).toBe(false);
  });

  it('ticket CBG incomplet ou saisi au depart : refuse avant envoi', () => {
    const ligne = { ...ligneVide(), heurePesee: '07:25', brut: '56', tare: '15' };
    expect(etapesRotation(ligne, '2026-11-10', 'arrivee', '06:00').erreur)
      .toBe('Ticket CBG, heure, brut et tare requis pour intégrer la pesée');
    expect(etapesRotation({ ...ligne, ticket: 'PB-11' }, '2026-11-10', 'depart', '06:00').erreur)
      .toBe('Le ticket CBG est intégré à la réception au dépôt');
  });

  it('pesee incomplete ou incoherente, ligne vide : refusees avant envoi', () => {
    expect(etapesRotation({ ...ligneVide(), heures: { LOADED: '07:00' }, brut: '55' }, '2026-11-10', 'arrivee', null).erreur)
      .toBe('Ticket CBG, heure, brut et tare requis pour intégrer la pesée');
    expect(etapesRotation({ ...ligneVide(), heurePesee: '07:00', brut: '10', tare: '15', ticket: 'PB-12' }, '2026-11-10', 'arrivee', null).erreur)
      .toBe('Pesée incohérente : le brut doit dépasser la tare');
    expect(etapesRotation(ligneVide(), '2026-11-10', 'arrivee', null).erreur).toBe('Aucune heure saisie');
  });
});
