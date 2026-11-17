import { describe, expect, it } from 'vitest';
import {
  erreursConsultation, erreursSaisieContact, erreursSaisieDocument, erreursSaisieFournisseur, erreursSaisieOffre, saisieDepuisFournisseur,
} from './saisie';

describe('saisies du module Fournisseurs', () => {
  it('fiche : raison sociale obligatoire, courriel bien forme', () => {
    const vide = saisieDepuisFournisseur();
    expect(vide.type).toBe('parts');
    expect(erreursSaisieFournisseur(vide)).toEqual(['Raison sociale obligatoire.']);
    expect(erreursSaisieFournisseur({ ...vide, nom: 'Pièces Kogon', email: 'pas-un-courriel' })).toEqual(['Courriel invalide.']);
    expect(erreursSaisieFournisseur({ ...vide, nom: 'Pièces Kogon', email: 'a@b.gn' })).toEqual([]);
  });
  it('contact : nom et un moyen de joindre', () => {
    const c = { nom: 'Bah', fonction: '', telephone: '', email: '', principal: false };
    expect(erreursSaisieContact(c)).toEqual(['Téléphone ou courriel obligatoire.']);
    expect(erreursSaisieContact({ ...c, telephone: '+224 600' })).toEqual([]);
  });
  it('document : reference, libelle d\'un « autre », dates ordonnees', () => {
    const d = { type: 'autre', libelle: '', numero: '', emission: '2026-02-01', expiration: '2026-01-01', reference: '', observation: '' };
    expect(erreursSaisieDocument(d)).toHaveLength(3);
    expect(erreursSaisieDocument({ ...d, libelle: 'Agrément', reference: 'A3', expiration: '2027-01-01' })).toEqual([]);
  });
  it('offre : delai entier et prix valides', () => {
    const o = { fournisseur: 'f1', reference: '', recue: '2026-11-12', delai: '5', validite: '', conditions: '' };
    expect(erreursSaisieOffre(o, true)).toEqual([]);
    expect(erreursSaisieOffre({ ...o, delai: '5,5' }, false)).toHaveLength(2);
  });
  it('consultation : objet, lignes completes, au moins un fournisseur', () => {
    expect(erreursConsultation({ objet: '', lignes: [{ article: '', designation: '', quantite: '' }], consultes: [] })).toHaveLength(3);
    expect(erreursConsultation({ objet: 'Pneus', lignes: [{ article: '', designation: 'Pneu', quantite: '8' }], consultes: ['f1'] })).toEqual([]);
  });
});
