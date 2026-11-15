import { describe, expect, it } from 'vitest';
import { delegationRevocable, erreurDelegation, libelleEvenement, perimetreCompte } from './organisation';

describe('perimetreCompte (meme regle que site_permis, D-064)', () => {
  it('sans site au profil ni affectation : global', () => {
    expect(perimetreCompte(null, [])).toEqual({ type: 'global' });
  });
  it('affectations annulees seulement : global', () => {
    expect(perimetreCompte(null, [{ site_id: 's1', statut: 'annulee' }])).toEqual({ type: 'global' });
  });
  it('affectation expiree seule : aucun site, pas global', () => {
    expect(perimetreCompte(null, [{ site_id: 's1', statut: 'terminee' }])).toEqual({ type: 'aucun' });
  });
  it('site du profil et affectations en cours : union', () => {
    expect(perimetreCompte('s1', [{ site_id: 's2', statut: 'en_cours' }, { site_id: 's3', statut: 'a_venir' }]))
      .toEqual({ type: 'sites', sites: ['s1', 's2'] });
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
