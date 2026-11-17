import { describe, expect, it } from 'vitest';
import {
  alerteArticle, entierSaisi, erreursMouvement, estSaisieStock, idRouteStock, lireIdRouteStock, lireLots, lotsPourMouvement, texteCmp, texteValeur, totalLots,
} from './stock';

describe('routes du registre des stocks (D-090)', () => {
  it('identifiant prefixe par l\'objet, lu sans perte', () => {
    const id = '0b5c1d2e-3f40-4a51-9b62-7c83d94ea5f6';
    expect(lireIdRouteStock(idRouteStock('article', id))).toEqual({ objet: 'article', id });
    expect(lireIdRouteStock(idRouteStock('reservation', 'r1'))).toEqual({ objet: 'reservation', id: 'r1' });
    expect(lireIdRouteStock('inconnu-abc')).toBeNull();
    expect(lireIdRouteStock('article-')).toBeNull();
    expect(lireIdRouteStock('abc')).toBeNull();
  });
  it('saisies connues seulement', () => {
    expect(estSaisieStock('exit')).toBe(true);
    expect(estSaisieStock('suppression')).toBe(false);
    expect(estSaisieStock(undefined)).toBe(false);
  });
  it('erreurs de saisie memes exigences que le serveur', () => {
    const vide = { article: 'a1', source: '', destination: '', depot: '', quantite: '2', lots: '', quand: '2026-11-17T08:00', compte: '', code: '', ordre: '', engin: '', affectation: '' };
    expect(erreursMouvement('exit', vide, 'aucun')).toEqual(['Dépôt de départ requis.']);
    expect(erreursMouvement('exit', { ...vide, source: 'd1' }, 'aucun')).toEqual([]);
    expect(erreursMouvement('exit', { ...vide, source: 'd1' }, 'lot')).toHaveLength(1);
    expect(erreursMouvement('exit', { ...vide, source: 'd1', lots: 'l1 2' }, 'lot')).toEqual([]);
    expect(erreursMouvement('transfer', { ...vide, source: 'd1' }, 'aucun')).toEqual(['Dépôt d\'arrivée requis.']);
    expect(erreursMouvement('reservation', { ...vide, depot: 'd1' }, 'aucun')).toEqual(['Ordre de travail, engin ou affectation requis.']);
    expect(erreursMouvement('inventaire', { ...vide, depot: 'd1', compte: '0' }, 'aucun')).toEqual([]);
    expect(erreursMouvement('inventaire', { ...vide, depot: 'd1', compte: '1' }, 'serie')).toEqual(['Numéro de série requis.']);
    expect(entierSaisi('1 200')).toBe(1200);
    expect(entierSaisi('-3')).toBeNull();
  });
});

describe('alerteArticle (D-044)', () => {
  it('rupture, seuil atteint, niveau normal', () => {
    expect(alerteArticle({ active: true, quantity_in_stock: 0, minimum_threshold: 5 })?.texte).toBe('Rupture');
    expect(alerteArticle({ active: true, quantity_in_stock: 5, minimum_threshold: 5 })?.teinte).toBe('orange');
    expect(alerteArticle({ active: true, quantity_in_stock: 6, minimum_threshold: 5 })).toBeNull();
  });
  it('sans seuil, aucune alerte de niveau ; article archive signale', () => {
    expect(alerteArticle({ active: true, quantity_in_stock: 1, minimum_threshold: null })).toBeNull();
    expect(alerteArticle({ active: false, quantity_in_stock: 3, minimum_threshold: 5 })?.texte).toBe('Archivé');
  });
});

describe('lots et numeros de serie (D-067)', () => {
  it('lit les lots CODE QUANTITE, normalise et refuse les doublons', () => {
    expect(lireLots('lot', ' l1 3\nL2;2 ')).toEqual([{ code: 'L1', quantite: 3 }, { code: 'L2', quantite: 2 }]);
    expect(lireLots('lot', 'L1')).toBeNull();
    expect(lireLots('lot', 'L1 2\nl1 1')).toBeNull();
    expect(lireLots('aucun', 'sans objet')).toEqual([]);
  });
  it('series : une unite par numero ; total egal a la quantite', () => {
    expect(lireLots('serie', 's1, S2\nS3')).toEqual([{ code: 'S1', quantite: 1 }, { code: 'S2', quantite: 1 }, { code: 'S3', quantite: 1 }]);
    expect(lotsPourMouvement('serie', 'S1\nS2', 3)).toBeNull();
    expect(lotsPourMouvement('lot', 'L1 2\nL2 1', 3)).toHaveLength(2);
    expect(totalLots([{ code: 'A', quantite: 2 }, { code: 'B', quantite: 5 }])).toBe(7);
  });
});

describe('valorisation (D-067)', () => {
  it('valeur du serveur, jamais estimee a l\'ecran', () => {
    expect(texteValeur(null, 'sans_donnees')).toBe('Sans données');
    expect(texteValeur(22500, 'partielle')).toMatch(/22\s500 GNF \(partielle\)/);
    expect(texteValeur(30000, 'complete')).toMatch(/30\s000 GNF$/);
    expect(texteValeur(1500, 'a_verifier')).toMatch(/1\s500 GNF \(à vérifier\)/);
    expect(texteCmp(null)).toBe('Sans données');
  });
});
