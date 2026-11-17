import { describe, expect, it } from 'vitest';
import { actionPermise, actionsFiche, erreursLigneRotation, ligneVersServeur, motifImpressionRequis, type LigneRotationSaisie } from './cycleFiche';

const vide: LigneRotationSaisie = { rang: '1', trip_id: '', depart_le: '', arrivee_le: '', km_depart: '', km_arrivee: '', ticket_cbg: '', observations: '', incidents: '', motif: '' };

describe('cycle des fiches terrain (D-089, ecran D-088)', () => {
  it('actions proposees selon l\'etat', () => {
    expect(actionsFiche('preparee', 'rotations')).toEqual(['imprimer', 'remettre', 'annuler']);
    expect(actionsFiche('a_controler', 'rotations')).toEqual(['controler', 'renvoyer', 'valider']);
    expect(actionsFiche('validee', 'rotations')).toEqual(['archiver']);
    expect(actionsFiche('archivee', 'rotations')).toEqual([]);
  });
  it('saisie des rotations : fiche FR seulement', () => {
    expect(actionPermise('saisir-ligne', 'retournee', 'rotations')).toBe(true);
    expect(actionPermise('saisir-ligne', 'retournee', 'carburant')).toBe(false);
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
