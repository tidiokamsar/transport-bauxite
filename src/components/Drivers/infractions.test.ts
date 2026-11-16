import { describe, expect, it } from 'vitest';
import { infractionValide, sanctionEnVigueur, type Sanction } from './infractions';

const sanction = (id: string, statut: Sanction['statut']): Sanction => ({
  id, infraction_id: 'i1', sanction: 'avertissement', detail: null, motif: 'm', decide_le: '2026-11-15T10:00:00Z', statut, motif_annulation: null,
});

describe('registre des infractions', () => {
  it('controle la saisie comme le serveur', () => {
    const maintenant = new Date('2026-11-15T12:00:00Z');
    const base = { type: 'exces_vitesse', source: 'controle_routier', constat: 'Radar 72 km/h', quand: '2026-11-15T11:00:00Z' };
    expect(infractionValide(base, maintenant)).toBe(true);
    expect(infractionValide({ ...base, constat: '  ' }, maintenant)).toBe(false);
    expect(infractionValide({ ...base, type: 'inconnu' }, maintenant)).toBe(false);
    expect(infractionValide({ ...base, quand: '2026-11-16T11:00:00Z' }, maintenant)).toBe(false);
  });

  it('une seule decision en vigueur, les annulees restent a l\'historique', () => {
    expect(sanctionEnVigueur([sanction('s1', 'annulee'), sanction('s2', 'active')], 'i1')?.id).toBe('s2');
    expect(sanctionEnVigueur([sanction('s1', 'annulee')], 'i1')).toBeNull();
  });
});
