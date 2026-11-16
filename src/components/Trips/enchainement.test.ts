import { describe, expect, it } from 'vitest';
import { recommanderSuivant, type VoyageSimple } from './enchainement';

const voyage = (id: string, extra: Partial<VoyageSimple> = {}): VoyageSimple => ({
  id, reference: `VYG-${id}`, planned_date: '2026-11-15', etat: 'PLANNED', vehicle_id: null, driver_id: null,
  loader_vehicle_id: null, departure_site_id: 'M', arrival_site_id: 'D', shift_id: 'S1', ...extra,
});
const livre = voyage('001', { etat: 'DELIVERED', vehicle_id: 'v1', driver_id: 'c1', loader_vehicle_id: 'l1' });
const camion = { id: 'v1', registration: 'RC-1', status: 'active' };
const chauffeur = { id: 'c1', name: 'Alpha', status: 'active', license_expiry: '2099-01-01' };
const chargeuse = { id: 'l1', registration: 'CAT-1', status: 'active' };

describe('voyage suivant apres livraison', () => {
  it('rien a proposer tant que le voyage n\'est pas livre', () => {
    expect(recommanderSuivant({ voyage: { ...livre, etat: 'IN_TRANSIT' }, camion, chauffeur, chargeuse, voyagesCamion: [], prepares: [] })).toBeNull();
  });

  it('prefere un voyage prepare du meme jour, shift et trajet', () => {
    const r = recommanderSuivant({
      voyage: livre, camion, chauffeur, chargeuse, voyagesCamion: [livre],
      prepares: [voyage('009', { arrival_site_id: 'E' }), voyage('005', { shift_id: 'S2' }), voyage('007'), voyage('002', { vehicle_id: 'v2' })],
    });
    expect(r).toMatchObject({ possible: true, suivant: { id: '007' }, chargeuse: { id: 'l1' } });
    expect(r?.explications[0]).toContain('aucun retour au parking');
  });

  it('sans voyage prepare : un nouveau voyage sur le meme trajet', () => {
    const r = recommanderSuivant({ voyage: livre, camion, chauffeur, chargeuse: { ...chargeuse, status: 'maintenance' }, voyagesCamion: [], prepares: [] });
    expect(r).toMatchObject({ possible: true, suivant: null, chargeuse: null });
    expect(r?.explications).toContain('CAT-1 indisponible : voyage sans chargeuse désignée');
  });

  it('refuse si le camion est deja engage ou le permis expire', () => {
    expect(recommanderSuivant({ voyage: livre, camion, chauffeur, chargeuse, voyagesCamion: [voyage('003', { etat: 'ASSIGNED', vehicle_id: 'v1' })], prepares: [] }))
      .toMatchObject({ possible: false, raison: 'Camion déjà engagé sur VYG-003' });
    expect(recommanderSuivant({ voyage: livre, camion, chauffeur: { ...chauffeur, license_expiry: '2020-01-01' }, chargeuse, voyagesCamion: [], prepares: [] }))
      .toMatchObject({ possible: false, raison: 'Permis de Alpha expiré' });
  });
});
