import { describe, expect, it } from 'vitest';
import { coutPieces, type PieceOrdre } from './ordres';
import { dernierReleveParEngin, echeancePlanning } from './preventif';

const piece = (p: Partial<PieceOrdre>): PieceOrdre => ({
  mouvement_id: 'm', numero: 'MVT', date_mouvement: '2026-11-18T08:00:00Z', type_mouvement: 'exit', article_id: 'a1',
  article_code: 'F', article_nom: 'Filtre', unite: 'piece', quantite: 1, prix_unitaire: null, valeur: null, depot_code: 'MAG', annule: false, ...p,
});

describe('coutPieces (D-061)', () => {
  it('sorties moins retours, annulations exclues', () => {
    const r = coutPieces([
      piece({ mouvement_id: '1', quantite: 3, prix_unitaire: 1000 }),
      piece({ mouvement_id: '2', type_mouvement: 'return', quantite: 1 }),
      piece({ mouvement_id: '3', quantite: 5, prix_unitaire: 1000, annule: true }),
    ]);
    expect(r.valeur).toBe(2000);
    expect(r.incomplet).toBe(false);
    expect(r.quantiteNette.get('a1')).toBe(2);
  });
  it('une sortie sans prix rend le cout incomplet, sans estimation', () => {
    const r = coutPieces([piece({ quantite: 2 }), piece({ article_id: 'a2', quantite: 1, prix_unitaire: 500 })]);
    expect(r.valeur).toBe(500);
    expect(r.incomplet).toBe(true);
  });
  it('un retour avec deux prix de sortie possibles reste non valorise', () => {
    const r = coutPieces([
      piece({ quantite: 1, prix_unitaire: 1000 }), piece({ quantite: 1, prix_unitaire: 1200 }),
      piece({ type_mouvement: 'return', quantite: 1 }),
    ]);
    expect(r.incomplet).toBe(true);
    expect(r.valeur).toBe(2200);
  });
});

describe('echeancePlanning (D-061)', () => {
  const jour = new Date(2026, 10, 18);
  it('inconnue sans derniere intervention ni releve', () => {
    expect(echeancePlanning({ next_service_km: 60000, next_service_date: null }, null, jour).statut).toBe('inconnue');
  });
  it('km restants depuis le dernier releve compteur', () => {
    const e = echeancePlanning({ next_service_km: 60000, next_service_date: null }, { valeur_km: 58500, releve_le: '2026-11-17T10:00:00Z' }, jour);
    expect(e).toEqual({ statut: 'a_venir', kmRestants: 1500, joursRestants: null });
  });
  it('depassee si l\'un des deux criteres est atteint', () => {
    const e = echeancePlanning({ next_service_km: 60000, next_service_date: '2026-11-18' }, { valeur_km: 50000, releve_le: '2026-11-17T10:00:00Z' }, jour);
    expect(e.statut).toBe('depassee');
    expect(e.joursRestants).toBe(0);
  });
  it('dernier releve par engin', () => {
    const m = dernierReleveParEngin([
      { vehicle_id: 'v', valeur_km: 10, releve_le: '2026-11-01T00:00:00Z' },
      { vehicle_id: 'v', valeur_km: 30, releve_le: '2026-11-03T00:00:00Z' },
      { vehicle_id: 'v', valeur_km: 20, releve_le: '2026-11-02T00:00:00Z' },
    ]);
    expect(m.get('v')?.valeur_km).toBe(30);
  });
});
