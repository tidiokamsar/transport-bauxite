import { describe, expect, it } from 'vitest';
import { actionsPossibles, ETATS, phaseDe, tonnageVoyage, type Etat } from './cycle';

// Les transitions autorisees cote serveur (migration 20261110120000),
// recopiees ici : le test garantit que l'interface ne propose rien de plus.
const SERVEUR: [Etat, Etat][] = [
  ['DRAFT', 'PLANNED'], ['PLANNED', 'ASSIGNED'], ['ASSIGNED', 'AT_LOADING'], ['AT_LOADING', 'LOADING'],
  ['LOADING', 'LOADED'], ['LOADED', 'WEIGHED_OUT'], ['LOADED', 'IN_TRANSIT'], ['WEIGHED_OUT', 'IN_TRANSIT'],
  ['IN_TRANSIT', 'AT_DESTINATION'], ['AT_DESTINATION', 'UNLOADING'], ['UNLOADING', 'WEIGHED_IN'],
  ['UNLOADING', 'DELIVERED'], ['WEIGHED_IN', 'DELIVERED'], ['DELIVERED', 'ACCEPTED'], ['DELIVERED', 'DISPUTED'],
  ['DELIVERED', 'REJECTED'], ['DISPUTED', 'ACCEPTED'], ['DISPUTED', 'REJECTED'], ['ACCEPTED', 'CLOSED'],
  ['REJECTED', 'CLOSED'], ['INTERRUPTED', 'IN_TRANSIT'], ['INTERRUPTED', 'AT_DESTINATION'], ['INTERRUPTED', 'CANCELLED'],
  ...(['DRAFT', 'PLANNED', 'ASSIGNED', 'AT_LOADING', 'LOADING', 'LOADED', 'WEIGHED_OUT'] as Etat[]).map((e) => [e, 'CANCELLED'] as [Etat, Etat]),
  ...(['LOADING', 'LOADED', 'WEIGHED_OUT', 'IN_TRANSIT', 'AT_DESTINATION', 'UNLOADING'] as Etat[]).map((e) => [e, 'INTERRUPTED'] as [Etat, Etat]),
];

describe('cycle de voyage', () => {
  it('18 etats (14 du cycle et 4 exceptionnels, CDC 12)', () => {
    expect(Object.keys(ETATS)).toHaveLength(18);
  });

  it('l\'interface ne propose que des transitions acceptees par le serveur, et toutes', () => {
    const proposees = (Object.keys(ETATS) as Etat[]).flatMap((de) => {
      const { normales, exceptions } = actionsPossibles(de);
      return [...normales, ...exceptions].map((vers) => `${de}>${vers}`);
    });
    expect(new Set(proposees)).toEqual(new Set(SERVEUR.map(([de, vers]) => `${de}>${vers}`)));
  });

  it('un voyage cloture ou annule n\'offre plus d\'action', () => {
    expect(actionsPossibles('CLOSED')).toEqual({ normales: [], exceptions: [] });
    expect(actionsPossibles('CANCELLED')).toEqual({ normales: [], exceptions: [] });
  });

  it('phases', () => {
    expect(phaseDe('LOADING')).toBe('chargement');
    expect(phaseDe('IN_TRANSIT')).toBe('route');
    expect(phaseDe('ACCEPTED')).toBe('livre');
    expect(phaseDe('DISPUTED')).toBe('exception');
    expect(phaseDe(null)).toBe('prevu');
  });

  it('tonnage : accepte, sinon recu, sinon charge, sinon absent', () => {
    const base = { accepted_tonnage: null, net_weight_reception: null, net_weight: null, load_weight: null };
    expect(tonnageVoyage(base)).toBeNull();
    expect(tonnageVoyage({ ...base, net_weight: 40.7 })).toEqual({ valeur: 40.7, nature: 'chargé' });
    expect(tonnageVoyage({ ...base, net_weight: 40.7, net_weight_reception: 40.2 })).toEqual({ valeur: 40.2, nature: 'reçu' });
    expect(tonnageVoyage({ ...base, net_weight: 40.7, accepted_tonnage: 40 })).toEqual({ valeur: 40, nature: 'accepté' });
  });
});
