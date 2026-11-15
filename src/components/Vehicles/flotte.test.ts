import { describe, expect, it } from 'vitest';
import { actionsStatut, erreurPropriete, etatEcheance, joursRestants, libellePropriete, libelleStatut, resumeCoutCarburant } from './flotte';

const LE_15 = new Date(2026, 10, 15, 9, 30);
const fmt = (n: number) => String(n);
const saisie = { propriete: 'loue', proprietaire: 'Neemba', exploitant: '', transporteur: '', contrat: 'c1', motif: '' };

describe('Flotte (D-062)', () => {
  it('compte les jours sur la date locale, sans decalage horaire', () => {
    expect(joursRestants('2026-11-15', LE_15)).toBe(0);
    expect(joursRestants('2026-12-15', LE_15)).toBe(30);
    expect(joursRestants('2026-11-10', LE_15)).toBe(-5);
  });

  it('etat d\'une echeance : expire, sous 30 jours, valide, sans echeance, archive', () => {
    expect(etatEcheance('2026-11-10', LE_15)).toEqual({ texte: 'Expiré depuis 5 j', teinte: 'rouge' });
    expect(etatEcheance('2026-11-15', LE_15).teinte).toBe('rouge');
    expect(etatEcheance('2026-12-15', LE_15)).toEqual({ texte: 'Expire dans 30 j', teinte: 'orange' });
    expect(etatEcheance('2026-12-16', LE_15)).toEqual({ texte: 'Valide', teinte: 'vert' });
    expect(etatEcheance(null, LE_15).texte).toBe('Sans échéance');
    expect(etatEcheance('2026-11-10', LE_15, true).texte).toBe('Archivé');
  });

  it('libelles : statut inconnu sans donnees, propriete non renseignee', () => {
    expect(libelleStatut('suspendu').libelle).toBe('Suspendu');
    expect(libelleStatut(undefined).libelle).toBe('Sans données');
    expect(libellePropriete(null)).toBe('Non renseignée');
    expect(libellePropriete('kogon')).toBe('Kogon Mining');
  });

  it('actions de statut : suspension, remise en service, reforme', () => {
    expect(actionsStatut('disponible')).toEqual({ suspendre: true, remettre: false, reformer: true });
    expect(actionsStatut('suspendu')).toEqual({ suspendre: false, remettre: true, reformer: true });
    expect(actionsStatut('reforme')).toEqual({ suspendre: false, remettre: false, reformer: false });
  });

  it('cout carburant : jamais estime sans prix', () => {
    expect(resumeCoutCarburant(null, null, fmt)).toBe('Non visible avec vos droits');
    expect(resumeCoutCarburant(null, 0, fmt)).toBe('Aucun plein');
    expect(resumeCoutCarburant(null, 120, fmt)).toBe('Sans prix connu (120 L non valorisés)');
    expect(resumeCoutCarburant(50000, 20, fmt)).toBe('50000 (hors 20 L sans prix)');
    expect(resumeCoutCarburant(50000, 0, fmt)).toBe('50000');
  });

  it('propriete : choix requis, pas de contrat pour Kogon, motif pour modifier', () => {
    expect(erreurPropriete({ ...saisie, propriete: '' }, false)).toBe('Choisir la propriété');
    expect(erreurPropriete({ ...saisie, propriete: 'kogon' }, false)).toMatch(/contrat/);
    expect(erreurPropriete(saisie, true)).toMatch(/Motif/);
    expect(erreurPropriete(saisie, false)).toBeNull();
    expect(erreurPropriete({ ...saisie, motif: 'Contrat signe' }, true)).toBeNull();
  });
});
