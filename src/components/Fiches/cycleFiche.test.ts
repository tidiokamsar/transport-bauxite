import { describe, expect, it } from 'vitest';
import { erreursCarburant, erreursPointage, idsDuLot, routeLot, tableauDeBordFiches, actionPermise, actionsFiche, erreursLigneRotation, ligneVersServeur, motifImpressionRequis, type LigneRotationSaisie } from './cycleFiche';

const vide: LigneRotationSaisie = { rang: '1', trip_id: '', depart_le: '', arrivee_le: '', km_depart: '', km_arrivee: '', ticket_cbg: '', observations: '', incidents: '', motif: '' };

describe('cycle des fiches terrain (D-089, ecran D-088)', () => {
  it('actions proposees selon l\'etat', () => {
    expect(actionsFiche('preparee', 'rotations')).toEqual(['imprimer', 'remettre', 'annuler']);
    expect(actionsFiche('a_controler', 'rotations')).toEqual(['controler', 'renvoyer', 'valider']);
    expect(actionsFiche('retournee', 'rotations')).toEqual(['imprimer', 'saisir-ligne', 'terminer-saisie', 'annuler']);
    expect(actionsFiche('validee', 'rotations')).toEqual(['archiver']);
    expect(actionsFiche('archivee', 'rotations')).toEqual([]);
  });
  it('saisie des rotations : fiche FR seulement', () => {
    expect(actionPermise('saisir-ligne', 'retournee', 'rotations')).toBe(true);
    expect(actionPermise('saisir-ligne', 'retournee', 'carburant')).toBe(false);
  });
  it('saisies FP et FC : type de la fiche', () => {
    expect(actionPermise('saisir-pointage', 'retournee', 'pointage_engins')).toBe(true);
    expect(actionPermise('saisir-pointage', 'retournee', 'rotations')).toBe(false);
    expect(actionPermise('saisir-carburant', 'a_corriger', 'carburant')).toBe(true);
  });
  it('lot : adresse et identifiants', () => {
    expect(routeLot('imprimer', ['a1', 'b2'])).toBe('#/fiches/lot/imprimer?ids=a1,b2');
    expect(idsDuLot('a1,b2, ,x;y')).toEqual(['a1', 'b2']);
  });
  it('tableau de bord par groupe d\'etats', () => {
    expect(tableauDeBordFiches([{ etat: 'preparee' }, { etat: 'imprimee' }, { etat: 'preparee' }]).map((g) => [g.cle, g.nombre]))
      .toEqual([['preparees', 2], ['imprimees', 1]]);
  });
  it('pointage : horametres et heures productives', () => {
    const p = { vehicle_id: 'e1', index_debut: '100', index_fin: '108', heures_productives: '9', periode_debut: '', periode_fin: '', operateur: '', observations: '', motif: '' };
    expect(erreursPointage(p).heures_productives).toBeTruthy();
    expect(erreursPointage({ ...p, heures_productives: '7' })).toEqual({});
    expect(erreursPointage({ ...p, index_fin: '90', heures_productives: '' }).index_fin).toBeTruthy();
  });
  it('carburant : litres, engin, index de pompe, motif de correction', () => {
    const c = { rang: '1', vehicle_id: 'e1', distribue_le: '2026-01-01T08:00', litres: '120', index_pompe_debut: '10', index_pompe_fin: '5',
      compteur_km: '', horametre: '', destinataire_confirme: true, destinataire_nom: '', observations: '', motif: '' };
    expect(erreursCarburant(c, false).index_pompe_fin).toBeTruthy();
    expect(erreursCarburant({ ...c, index_pompe_fin: '130' }, false)).toEqual({});
    expect(erreursCarburant({ ...c, index_pompe_fin: '130', litres: '0' }, true)).toMatchObject({ litres: expect.any(String), motif: expect.any(String) });
  });
  it('reimpression motivee', () => {
    expect(motifImpressionRequis(0)).toBe(false);
    expect(motifImpressionRequis(1)).toBe(true);
  });
  it('controles de la ligne : rang, compteurs, heures, motif de correction', () => {
    expect(erreursLigneRotation(vide, false)).toEqual({});
    expect(erreursLigneRotation({ ...vide, rang: '0' }, false).rang).toBeTruthy();
    expect(erreursLigneRotation({ ...vide, km_depart: '120', km_arrivee: '100' }, false).km_arrivee).toBeTruthy();
    expect(erreursLigneRotation({ ...vide, depart_le: '2026-11-17T10:00', arrivee_le: '2026-11-17T09:00' }, false).arrivee_le).toBeTruthy();
    expect(erreursLigneRotation(vide, true).motif).toBeTruthy();
  });
  it('ligne envoyee sans valeur ajoutee', () => {
    expect(ligneVersServeur({ ...vide, trip_id: 't1', km_depart: '100,5', ticket_cbg: ' T-1 ' })).toEqual({ trip_id: 't1', km_depart: 100.5, ticket_cbg: 'T-1' });
  });
});
