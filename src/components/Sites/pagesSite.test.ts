import { describe, expect, it } from 'vitest';
import { corpsSite, erreursSite, libelleTypeSite, saisieDepuisSite, type SiteSaisi } from './saisieSite';
import { corpsVehicule, erreursVehicule, saisieDepuisVehicule } from '../Vehicles/saisieVehicule';
import { actionStatutPermise } from '../Vehicles/flotte';
import { actionChauffeurPermise, joursAvant, saisieDepuisChauffeur } from '../Drivers/chauffeur';
import type { Vehicle } from '../../types/vehicle';

// Pages du pilote D-090 : saisies des formulaires en pleine page et
// actions permises selon l'etat (sites, flotte, chauffeurs).

const SITE: SiteSaisi = {
  id: 's1', name: 'Mine Nimba', type: 'mine', organisation_id: 'o1', address: 'Zone nord', city: null, country: 'Guinée',
  latitude: 7.65, longitude: -8.4, contact_name: null, contact_phone: null, contact_email: null, capacity: 12000,
  is_active: false, responsable_id: 'u2', notes: null,
};

describe('Formulaire site', () => {
  it('modification : champs repris, ni statut ni stock envoyes, location gardee si l\'adresse ne change pas', () => {
    const f = saisieDepuisSite(SITE);
    expect(erreursSite({ ...f, city: 'Lola' })).toEqual([]);
    const corps = corpsSite({ ...f, city: 'Lola' }, SITE);
    expect(corps).toMatchObject({ organisation_id: 'o1', latitude: 7.65, longitude: -8.4, capacity: 12000, responsable_id: 'u2', city: 'Lola' });
    expect(corps).not.toHaveProperty('is_active');
    expect(corps).not.toHaveProperty('current_stock');
    expect(corps).not.toHaveProperty('location');
  });

  it('creation : site actif, erreurs en temps reel', () => {
    const f = saisieDepuisSite(null);
    expect(erreursSite(f)).toEqual(['Nom du site requis.', 'Adresse requise.', 'Ville requise.']);
    expect(erreursSite({ ...f, name: 'P', address: 'Q', city: 'K', latitude: '10' })[0]).toMatch(/ensemble/);
    expect(corpsSite({ ...f, name: 'P', address: 'Q', city: 'K' }, null)).toMatchObject({ is_active: true, location: 'Q' });
    expect(libelleTypeSite('warehouse')).toBe('Entrepôt');
    expect(libelleTypeSite('inconnu')).toBe('inconnu');
  });
});

describe('Formulaire engin et actions de statut', () => {
  it('capacite requise et positive, site impose au profil borne', () => {
    const f = saisieDepuisVehicule(null, 'site-a');
    expect(erreursVehicule(f)).toContain('Capacité requise.');
    expect(erreursVehicule({ ...f, capacity_tonnes: '-1' })).toContain('Capacité en tonnes : nombre positif ou nul.');
    const ok = { ...f, registration: 'CAM-9', brand_model: 'Howo', vehicle_type: 'tipper', capacity_tonnes: '40,5', site_id: 'autre' };
    expect(erreursVehicule(ok)).toEqual([]);
    expect(corpsVehicule(ok, 'site-a')).toMatchObject({ capacity_tonnes: 40.5, site_id: 'site-a', year: null, insurance_expiry: null });
    expect(saisieDepuisVehicule({ capacity_tonnes: 0, registration: 'X' } as Vehicle, null).capacity_tonnes).toBe('0');
  });

  it('actions permises par le statut operationnel derive', () => {
    expect(actionStatutPermise('suspendre', 'disponible')).toBe(true);
    expect(actionStatutPermise('remettre-en-service', 'disponible')).toBe(false);
    expect(actionStatutPermise('remettre-en-service', 'suspendu')).toBe(true);
    expect(actionStatutPermise('reformer', 'reforme')).toBe(false);
  });
});

describe('Dossier chauffeur', () => {
  it('actions selon le statut, jamais de suppression', () => {
    expect(actionChauffeurPermise('archiver', 'active')).toBe(true);
    expect(actionChauffeurPermise('archiver', 'terminated')).toBe(false);
    expect(actionChauffeurPermise('reactiver', 'terminated')).toBe(true);
    expect(actionChauffeurPermise('suspendre', 'suspended')).toBe(false);
  });

  it('saisie reprise du dossier et jours avant expiration', () => {
    expect(saisieDepuisChauffeur(null, 'site-a')).toMatchObject({ status: 'active', site_id: 'site-a', license_category: 'C', base_salary: '' });
    expect(joursAvant('2026-11-20', new Date(2026, 10, 17, 23, 0))).toBe(3);
    expect(joursAvant('2026-11-16', new Date(2026, 10, 17))).toBe(-1);
  });
});
