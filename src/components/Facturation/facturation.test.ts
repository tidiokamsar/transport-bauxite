import { describe, expect, it } from 'vitest';
import { actionFactureInterdite, bornesMoisCalendaires, lireMontant, statutLigne, type StatutFacture } from './facturation';

describe('facturation', () => {
  it('statut d\'une ligne : decision, sinon anomalie bloquante (miroir du serveur)', () => {
    expect(statutLigne(null, [])).toBe('facturable');
    expect(statutLigne(null, ['sans_fiche'])).toBe('facturable');
    expect(statutLigne(null, ['ecart_hors_tolerance', 'sans_fiche'])).toBe('a_examiner');
    expect(statutLigne(null, ['ecart_double_pesee'])).toBe('a_examiner');
    expect(statutLigne(null, ['sans_double_pesee'])).toBe('a_examiner');
    expect(statutLigne('exclue', ['litige'])).toBe('exclue');
    expect(statutLigne('facturable', ['ecart_hors_tolerance'])).toBe('facturable');
    // D-078 : sans ticket, ticket rectifie et net au-dessus de la capacite attendent une decision.
    expect(statutLigne(null, ['sans_ticket_cbg'])).toBe('a_examiner');
    expect(statutLigne(null, ['ticket_rectifie'])).toBe('a_examiner');
    expect(statutLigne(null, ['net_superieur_capacite'])).toBe('a_examiner');
  });

  it('actions d\'une facture (miroir de avancer_facture et creer_avoir)', () => {
    const charge = { ecrire: true, directeur: false, utilisateur: 'u1' };
    const dg = { ecrire: true, directeur: true, utilisateur: 'u2' };
    const f = (statut: StatutFacture, type: 'facture' | 'avoir' = 'facture', prepare_par = 'u1') => ({ statut, type, prepare_par });
    expect(actionFactureInterdite('soumettre', f('brouillon'), charge)).toBeNull();
    expect(actionFactureInterdite('signer', f('a_signer'), charge)).toMatch(/Directeur/);
    expect(actionFactureInterdite('signer', f('a_signer'), dg)).toBeNull();
    expect(actionFactureInterdite('signer', f('a_signer', 'facture', 'u2'), dg)).toMatch(/préparateur/);
    expect(actionFactureInterdite('emettre', f('a_signer'), charge)).toMatch(/signée/);
    expect(actionFactureInterdite('annuler', f('emise'), charge)).toMatch(/avoir/);
    expect(actionFactureInterdite('avoir', f('emise'), charge)).toBeNull();
    expect(actionFactureInterdite('avoir', f('emise', 'avoir'), charge)).not.toBeNull();
    expect(actionFactureInterdite('emettre', f('signee'), { ...charge, ecrire: false })).toMatch(/Droit/);
  });

  it('montant saisi', () => {
    expect(lireMontant('1 250,50')).toBe(1250.5);
    expect(lireMontant('')).toBeNull();
    expect(lireMontant('12a')).toBeNull();
  });

  it('bornes d\'un mois, fevrier bissextile compris', () => {
    expect(bornesMoisCalendaires('2026-11')).toEqual({ debut: '2026-11-01', fin: '2026-11-30' });
    expect(bornesMoisCalendaires('2028-02')).toEqual({ debut: '2028-02-01', fin: '2028-02-29' });
  });
});
