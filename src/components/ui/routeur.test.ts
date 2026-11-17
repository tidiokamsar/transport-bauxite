import { describe, expect, it } from 'vitest';
import { ecrireRoute, lireRoute, memoriserRequeteListe, poserAnnonce, prendreAnnonce, routeAction, routeDetail, routeListe, routeModifier, routeNouveau } from './routeur';

describe('routeur par fragment (D-090)', () => {
  it('lit les cinq formes de route', () => {
    expect(lireRoute('')).toEqual({ vue: '', mode: 'liste', requete: {} });
    expect(lireRoute('#/sites')).toEqual({ vue: 'sites', mode: 'liste', requete: {} });
    expect(lireRoute('#/sites/nouveau')).toEqual({ vue: 'sites', mode: 'nouveau', requete: {} });
    expect(lireRoute('#/sites/abc')).toEqual({ vue: 'sites', mode: 'detail', id: 'abc', requete: {} });
    expect(lireRoute('#/sites/abc/modifier')).toEqual({ vue: 'sites', mode: 'modifier', id: 'abc', requete: {} });
    expect(lireRoute('#/vehicles/abc/remettre-en-service')).toEqual({ vue: 'vehicles', mode: 'action', id: 'abc', action: 'remettre-en-service', requete: {} });
  });

  it('lit la requete et tolere un fragment sans barre initiale ou mal encode', () => {
    expect(lireRoute('#/sites?q=mine%20nimba&f.statut=actif').requete).toEqual({ q: 'mine nimba', 'f.statut': 'actif' });
    expect(lireRoute('#sites/x').id).toBe('x');
    expect(lireRoute('#/sites/%E0').id).toBe('%E0');
  });

  it('ecrit puis relit la meme route (aller-retour), valeurs vides omises', () => {
    const r = { vue: 'drivers', mode: 'detail' as const, id: 'd 1', requete: { onglet: 'historique', vide: '' } };
    const hash = ecrireRoute(r);
    expect(hash).toBe('#/drivers/d%201?onglet=historique');
    expect(lireRoute(hash)).toEqual({ vue: 'drivers', mode: 'detail', id: 'd 1', requete: { onglet: 'historique' } });
  });

  it('refuse une route detail ou action sans identifiant', () => {
    expect(() => ecrireRoute({ vue: 'sites', mode: 'detail' })).toThrow();
    expect(() => ecrireRoute({ vue: 'sites', mode: 'action', id: 'a' })).toThrow();
  });

  it('raccourcis de route et retour a la liste avec les filtres memorises', () => {
    expect(routeNouveau('sites')).toBe('#/sites/nouveau');
    expect(routeDetail('sites', 's1')).toBe('#/sites/s1');
    expect(routeDetail('sites', 's1', 'relations')).toBe('#/sites/s1?onglet=relations');
    expect(routeModifier('sites', 's1')).toBe('#/sites/s1/modifier');
    expect(routeAction('sites', 's1', 'desactiver')).toBe('#/sites/s1/desactiver');
    expect(routeListe('vehicles')).toBe('#/vehicles');
    memoriserRequeteListe('vehicles', { q: 'cam', 'f.statut': 'suspendu' });
    expect(lireRoute(routeListe('vehicles')).requete).toEqual({ q: 'cam', 'f.statut': 'suspendu' });
  });

  it('annonce lue une seule fois', () => {
    poserAnnonce('Site désactivé.');
    expect(prendreAnnonce()).toBe('Site désactivé.');
    expect(prendreAnnonce()).toBe('');
  });
});
