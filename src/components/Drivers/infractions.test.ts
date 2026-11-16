import { describe, expect, it } from 'vitest';
import { avertissementSanction, infractionValide, sanctionEnVigueur, sanctionsConduiteParChauffeur, type Sanction } from './infractions';

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

describe('sanctions de conduite (avertissement)', () => {
  it('regroupe les sanctions de conduite en vigueur par chauffeur', () => {
    const m = sanctionsConduiteParChauffeur([
      { sanction: 'retrait_conduite', infractions_chauffeur: { driver_id: 'c1', numero: 'INF-2026-00001', statut: 'enregistree' } },
      { sanction: 'avertissement', infractions_chauffeur: { driver_id: 'c1', numero: 'INF-2026-00002', statut: 'enregistree' } },
      { sanction: 'mise_a_pied', infractions_chauffeur: [{ driver_id: 'c2', numero: 'INF-2026-00003', statut: 'annulee' }] },
    ]);
    expect([...m.keys()]).toEqual(['c1']);
    expect(avertissementSanction('Alpha', m.get('c1'))).toContain('Retrait de la conduite, INF-2026-00001');
    expect(avertissementSanction('Beta', m.get('c2'))).toBeNull();
  });
});
