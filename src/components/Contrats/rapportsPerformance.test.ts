import { describe, expect, it } from 'vitest';
import { bornesMoisRapport, erreursRemise, moisOuDefaut, moisPrecedent, remiseInterdite, routeListeEngagements } from './rapportsPerformance';

describe('rapport de performance', () => {
  it('mois precedent et bornes du mois', () => {
    expect(moisPrecedent(new Date(2026, 0, 15))).toBe('2025-12');
    expect(bornesMoisRapport('2026-02')).toEqual({ du: '2026-02-01', au: '2026-02-28' });
  });
  it('mois de l\'adresse valide, sinon le defaut', () => {
    expect(moisOuDefaut('2026-10', '2026-11')).toBe('2026-10');
    expect(moisOuDefaut('2026-13', '2026-11')).toBe('2026-11');
    expect(moisOuDefaut(undefined, '2026-11')).toBe('2026-11');
  });
  it('liste filtree par contrat et mois dans l\'adresse', () => {
    expect(routeListeEngagements('c1', '2026-10')).toBe('#/engagements?contrat=c1&mois=2026-10');
  });
  it('remise d\'un brouillon seulement, destinataire et date non future exiges', () => {
    expect(remiseInterdite({ statut: 'brouillon' }, true)).toBeNull();
    expect(remiseInterdite({ statut: 'remis' }, true)).toMatch(/déjà remis/);
    expect(remiseInterdite({ statut: 'brouillon' }, false)).toMatch(/Droit/);
    expect(erreursRemise({ date: '2026-11-17', destinataire: ' ' }, '2026-11-17')).toEqual(['Destinataire requis.']);
    expect(erreursRemise({ date: '2026-11-18', destinataire: 'CBG' }, '2026-11-17')).toEqual(['Date de remise dans le futur.']);
  });
});
