import { describe, expect, it } from 'vitest';
import { decrireClause, etatEcheance, libelleVersion, versionEnVigueur, type Version } from './types';

const v = (numero: number, date_effet: string): Version => ({
  id: String(numero), contrat_id: 'c', numero, intitule: `v${numero}`, date_effet, date_signature: null, resume: null, document_ref: null,
});

describe('dossier contractuel', () => {
  it('version en vigueur : dernier avenant entre en effet a la date', () => {
    const versions = [v(0, '2026-01-01'), v(1, '2026-06-01'), v(2, '2026-12-01')];
    expect(versionEnVigueur(versions, '2026-11-10')?.numero).toBe(1);
    expect(versionEnVigueur(versions, '2026-12-01')?.numero).toBe(2);
    expect(versionEnVigueur(versions, '2025-12-31')).toBeNull();
  });

  it('libelles de version', () => {
    expect(libelleVersion({ numero: 0, intitule: 'Transport' })).toBe('Contrat initial · Transport');
    expect(libelleVersion({ numero: 2, intitule: 'Révision des taux' })).toBe('Avenant n° 2 · Révision des taux');
  });

  it('clauses chiffrees (D-065) : base, condition et plafond saisis', () => {
    expect(decrireClause({ base: 'taux', valeur: 5, plafond_ht: 300, declenchement: 'non_tenu' }, 'USD', 'Disponibilité'))
      .toBe("5 % de l'assiette facturée HT si Disponibilité n'est pas tenu · plafond 300 USD HT");
    expect(decrireClause({ base: 'montant', valeur: 1000, plafond_ht: null, declenchement: 'tenu' }, 'GNF'))
      .toBe("1000 GNF HT si l'engagement est tenu");
  });

  it('etat des echeances (D-065)', () => {
    expect(etatEcheance({ echu: true, a_signaler: true, nature_echeance: 'fin', denonce_le: null }).libelle).toBe('Échu');
    expect(etatEcheance({ echu: false, a_signaler: true, nature_echeance: 'limite_preavis', denonce_le: null }).libelle).toBe('Préavis à décider');
    expect(etatEcheance({ echu: false, a_signaler: false, nature_echeance: 'fin', denonce_le: '2026-10-01' }).libelle).toBe('Dénoncé');
    expect(etatEcheance({ echu: false, a_signaler: false, nature_echeance: 'fin', denonce_le: null }).teinte).toBe('vert');
  });
});
