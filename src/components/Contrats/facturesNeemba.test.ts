import { describe, expect, it } from 'vitest';
import { actionFactureFInterdite, erreursFactureF, ligneVide, lignesPourServeur, quantite } from './facturesNeemba';

describe('factures du loueur (D-032, D-090)', () => {
  it('actions selon l\'etat et le droit', () => {
    expect(actionFactureFInterdite('controler', 'saisie', true)).toBeNull();
    expect(actionFactureFInterdite('controler', 'notifiee', true)).toMatch(/plus modifiable/);
    expect(actionFactureFInterdite('notifier', 'saisie', true)).toMatch(/suit le contrôle/);
    expect(actionFactureFInterdite('notifier', 'controlee', false)).toMatch(/Droit/);
    expect(actionFactureFInterdite('regulariser', 'notifiee', true)).toBeNull();
    expect(actionFactureFInterdite('regulariser', 'regularisee', true)).toMatch(/notifié seulement/);
    expect(actionFactureFInterdite('notification', 'regularisee', false)).toBeNull();
    expect(actionFactureFInterdite('notification', 'conforme', true)).toMatch(/Aucun écart/);
  });

  it('saisie : en-tete et lignes completes', () => {
    const e = { contrat: 'c1', numero: 'NB-1', date: '2026-11-02', debut: '2026-10-01', fin: '2026-10-31', ht: '11 000' };
    const l = [{ ...ligneVide(), vehicule: 'v1', quantite: '110', montant: '11000' }];
    expect(erreursFactureF(e, l, '2026-11-17')).toEqual([]);
    expect(erreursFactureF({ ...e, fin: '2026-09-30' }, l, '2026-11-17')).toContain('La fin de période suit le début.');
    expect(erreursFactureF(e, [ligneVide()], '2026-11-17')).toContain('Au moins une ligne (engin ou libellé).');
    expect(erreursFactureF(e, [{ ...l[0], montant: '' }], '2026-11-17')).toContain('Chaque ligne porte son montant.');
    expect(erreursFactureF({ ...e, date: '2026-12-01' }, l, '2026-11-17')).toContain('Date de facture dans le futur.');
  });

  it('lignes envoyees : unite seulement avec une quantite, libelle de repli', () => {
    const immat = new Map([['v1', 'RC-1001']]);
    expect(lignesPourServeur([{ ...ligneVide(), vehicule: 'v1', quantite: '110', montant: '11 000,5' }, ligneVide(), { ...ligneVide(), libelle: 'Transport', montant: '50' }], immat)).toEqual([
      { vehicle_id: 'v1', libelle: 'RC-1001', categorie_materiel: null, quantite_facturee: 110, unite_facturee: 'heure', taux_facture: null, montant_facture: 11000.5 },
      { vehicle_id: null, libelle: 'Transport', categorie_materiel: null, quantite_facturee: null, unite_facturee: null, taux_facture: null, montant_facture: 50 },
    ]);
  });

  it('quantite affichee avec son unite', () => {
    expect(quantite(400, 'km')).toBe('400 km');
    expect(quantite(null, null, 12)).toBe('12');
    expect(quantite(null, null)).toBe('—');
  });
});
