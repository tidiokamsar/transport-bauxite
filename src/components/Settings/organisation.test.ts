import { describe, expect, it } from 'vitest';
import { delegationRevocable, erreurDelegation, libelleEvenement, perimetreCompte } from './organisation';

describe('perimetreCompte (lecture du perimetre calcule par le serveur, D-064)', () => {
  it('global seulement si le serveur le dit', () => {
    expect(perimetreCompte({ global: true, sites: [] })).toEqual({ type: 'global' });
  });
  it('compte borne sans site du jour (affectations annulees ou expirees) : aucun site, jamais global', () => {
    expect(perimetreCompte({ global: false, sites: [] })).toEqual({ type: 'aucun' });
    expect(perimetreCompte({ global: false, sites: null })).toEqual({ type: 'aucun' });
  });
  it('sites du jour transmis tels quels', () => {
    expect(perimetreCompte({ global: false, sites: ['s1', 's2'] })).toEqual({ type: 'sites', sites: ['s1', 's2'] });
  });
});

describe('erreurDelegation', () => {
  const maintenant = new Date('2026-11-15T10:00:00');
  const base = { delegue: 'u2', module: 'trips', niveau: 'ecriture', debut: '', fin: '2026-11-20T10:00', motif: 'Conges' };
  it('accepte une delegation complete', () => {
    expect(erreurDelegation(base, maintenant)).toBeNull();
  });
  it('refuse l\'administration, le motif vide et une fin passee', () => {
    expect(erreurDelegation({ ...base, module: 'settings' }, maintenant)).toMatch(/administration/);
    expect(erreurDelegation({ ...base, motif: '  ' }, maintenant)).toMatch(/motif/);
    expect(erreurDelegation({ ...base, fin: '2026-11-14T10:00' }, maintenant)).toMatch(/fin/);
    expect(erreurDelegation({ ...base, niveau: 'admin' }, maintenant)).toMatch(/Niveau/);
    expect(erreurDelegation({ ...base, niveau: 'approbation' }, maintenant)).toBeNull();
    expect(erreurDelegation({ ...base, debut: '2026-11-14T10:00' }, maintenant)).toMatch(/passé/);
  });
  it('revocable seulement tant qu\'elle n\'est ni expiree ni revoquee', () => {
    expect(delegationRevocable('active')).toBe(true);
    expect(delegationRevocable('expiree')).toBe(false);
    expect(delegationRevocable('revoquee')).toBe(false);
  });
});

describe('libelleEvenement', () => {
  it('traduit les actions GoTrue et garde une action inconnue telle quelle', () => {
    expect(libelleEvenement('login')).toBe('Connexion');
    expect(libelleEvenement('action_future')).toBe('action_future');
    expect(libelleEvenement(null)).toBe('Sans donnée');
  });
});
