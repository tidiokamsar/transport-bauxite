import { describe, expect, it } from 'vitest';
import {
  actionInventaireInterdite, actionMouvementInterdite, controleFactureInterdit, erreursFactureCbg, erreursInventaire, erreursLivraison,
  erreursPlein, erreursReception, erreursStockage, erreursTransfert, idRoute, lireIdRoute, lireNombre,
} from './carburant';

describe('identifiant de route (D-090)', () => {
  it('objet principal sans prefixe, objets secondaires prefixes', () => {
    expect(lireIdRoute('3f2a-1', ['facture'])).toEqual({ objet: null, id: '3f2a-1' });
    expect(lireIdRoute(idRoute('facture', 'abc-1'), ['facture'])).toEqual({ objet: 'facture', id: 'abc-1' });
    expect(lireIdRoute('mouvement-abc', ['mouvement', 'inventaire'])).toEqual({ objet: 'mouvement', id: 'abc' });
  });
  it('prefixe non admis pour la vue ou vide : objet principal', () => {
    expect(lireIdRoute('mouvement-abc', ['facture'])).toEqual({ objet: null, id: 'mouvement-abc' });
    expect(lireIdRoute('facture-', ['facture'])).toEqual({ objet: null, id: 'facture-' });
  });
});

describe('lireNombre', () => {
  it('espaces et virgule admis, vide ou illisible = null', () => {
    expect(lireNombre('4 950,5')).toBe(4950.5);
    expect(lireNombre('')).toBeNull();
    expect(lireNombre('abc')).toBeNull();
  });
});

describe('controles de saisie', () => {
  it('plein : engin, litres positifs, date non future', () => {
    const f = { date: '2026-11-10', engin: 'v1', chauffeur: '', litres: '250', compteur: '', cuve: '', note: '' };
    expect(erreursPlein(f, '2026-11-17')).toEqual([]);
    expect(erreursPlein({ ...f, engin: '', litres: '0' }, '2026-11-17')).toEqual(['Engin requis pour un plein.', 'Quantité en litres positive requise.']);
    expect(erreursPlein({ ...f, date: '2026-11-18' }, '2026-11-17')).toContain('Date du plein dans le futur refusée.');
    expect(erreursPlein({ ...f, compteur: '-1' }, '2026-11-17')).toContain('Compteur illisible ou négatif.');
  });
  it('livraison et facture CBG', () => {
    expect(erreursLivraison({ reference: 'L1', date: '2026-11-10', site: 's', litres: '5000', prix: '12000', document: '' })).toEqual([]);
    expect(erreursLivraison({ reference: ' ', date: '', site: '', litres: '', prix: '-1', document: '' })).toHaveLength(5);
    expect(erreursFactureCbg({ reference: 'F1', date: '2026-11-10', montant: '0', livraisons: ['l1'] })).toEqual([]);
    expect(erreursFactureCbg({ reference: 'F1', date: '2026-11-10', montant: '10', livraisons: [] })).toEqual(['Au moins une livraison rattachée.']);
  });
  it('stockage : code et site seulement a la creation', () => {
    const f = { code: '', libelle: 'Cuve', type: 'cuve_fixe', site: '', capacite: '30000', seuil: '' };
    expect(erreursStockage(f, false)).toEqual([]);
    expect(erreursStockage(f, true)).toEqual(['Code requis.', 'Site requis.']);
    expect(erreursStockage({ ...f, capacite: '0', seuil: '-5' }, false)).toEqual(['Capacité positive requise.', 'Seuil d\'alerte illisible ou négatif.']);
  });
  it('reception : motif exige si ecart avec le bon CBG, accepte au plus egal au mesure', () => {
    const f = { stockage: 's1', livraison: 'l1', quand: '2026-11-14T08:00', mesure: '5000', accepte: '5000', methode: 'jauge', motif: '' };
    expect(erreursReception(f, 5000)).toEqual([]);
    expect(erreursReception({ ...f, mesure: '4950', accepte: '4950' }, 5000)).toEqual(['Écart avec le volume du document CBG : motif requis.']);
    expect(erreursReception({ ...f, mesure: '4950', accepte: '4950', motif: 'jauge' }, 5000)).toEqual([]);
    expect(erreursReception({ ...f, accepte: '5100', motif: 'x' }, 5000)).toEqual(['Le volume accepté ne peut dépasser le volume mesuré.']);
  });
  it('transfert et inventaire', () => {
    expect(erreursTransfert({ source: 's1', destination: 's1', litres: '10', quand: 'x', reference: '', note: '' })).toEqual(['Départ et arrivée identiques.']);
    expect(erreursInventaire({ stockage: 's1', mesure: '0', quand: 'x', methode: 'jauge', note: '' }, 5000)).toEqual([]);
    expect(erreursInventaire({ stockage: 's1', mesure: '6000', quand: 'x', methode: 'jauge', note: '' }, 5000)).toHaveLength(1);
  });
});

describe('actions selon le droit et l\'etat', () => {
  const droits = { peutEcrire: true, dejaAnnule: false };
  it('decision d\'un mouvement a valider, jamais d\'un ajustement', () => {
    expect(actionMouvementInterdite('valider', { statut: 'a_valider', type: 'reception' }, droits)).toBeNull();
    expect(actionMouvementInterdite('rejeter', { statut: 'valide', type: 'reception' }, droits)).toBe('Mouvement déjà décidé.');
    expect(actionMouvementInterdite('valider', { statut: 'a_valider', type: 'ajustement_inventaire' }, droits)).toContain('inventaire');
    expect(actionMouvementInterdite('valider', { statut: 'a_valider', type: 'reception' }, { ...droits, peutEcrire: false })).toContain('Droit');
  });
  it('annulation d\'un mouvement valide, une seule fois', () => {
    expect(actionMouvementInterdite('annuler', { statut: 'valide', type: 'distribution' }, droits)).toBeNull();
    expect(actionMouvementInterdite('annuler', { statut: 'valide', type: 'distribution' }, { ...droits, dejaAnnule: true })).toContain('déjà annulé');
    expect(actionMouvementInterdite('annuler', { statut: 'a_valider', type: 'distribution' }, droits)).toContain('validé');
    expect(actionMouvementInterdite('annuler', { statut: 'valide', type: 'annulation' }, droits)).not.toBeNull();
  });
  it('inventaire et controle de facture', () => {
    expect(actionInventaireInterdite('a_valider', true)).toBeNull();
    expect(actionInventaireInterdite('valide', true)).toBe('Inventaire déjà décidé.');
    expect(controleFactureInterdit('saisie', true)).toBeNull();
    expect(controleFactureInterdit('conforme', true)).not.toBeNull();
    expect(controleFactureInterdit('saisie', false)).toContain('Droit');
  });
});
