import { describe, expect, it } from 'vitest';
import { appliquerListe, comparer, etatDepuisRequete, lignesExport, paginer, requeteDepuisEtat, triSuivant, type ColonneListe, type FiltreListe } from './liste';
import { fusionnerHistoriques } from './evenements';
import { motifValide } from './pages';
import { identifiantSur, lire, trouver } from './lecture';

interface L { id: string; nom: string; capacite: number | null; actif: boolean }
const lignes: L[] = [
  { id: '1', nom: 'Mine Nimba', capacite: 12000, actif: true },
  { id: '2', nom: 'Dépôt Kamsar', capacite: null, actif: false },
  { id: '3', nom: 'Port 10', capacite: 500, actif: true },
  { id: '4', nom: 'Port 9', capacite: 500, actif: true },
];
const colonnes: ColonneListe<L>[] = [
  { id: 'nom', libelle: 'Nom', valeur: (l) => l.nom },
  { id: 'capacite', libelle: 'Capacité', valeur: (l) => l.capacite },
  { id: 'actif', libelle: 'Actif', valeur: (l) => l.actif },
  { id: 'interne', libelle: 'Interne', valeur: (l) => l.id, exportable: false },
];
const filtres: FiltreListe<L>[] = [{ id: 'statut', libelle: 'Statut', options: [], correspond: (l, v) => (v === 'actif') === l.actif }];

describe('PageListe : regles pures (D-090)', () => {
  it('etat porte par l\'adresse : lecture tolerante et ecriture minimale', () => {
    const e = etatDepuisRequete({ q: 'port', 'f.statut': 'actif', tri: 'capacite', sens: 'desc', page: '2', taille: '50', inconnu: 'x' });
    expect(e).toEqual({ recherche: 'port', filtres: { statut: 'actif' }, tri: 'capacite', sens: 'desc', page: 2, taille: 50 });
    expect(requeteDepuisEtat(e)).toEqual({ q: 'port', 'f.statut': 'actif', tri: 'capacite', sens: 'desc', page: '2', taille: '50' });
    expect(etatDepuisRequete({ page: '-3', taille: '7' })).toMatchObject({ page: 1, taille: 25, sens: 'asc', tri: null });
    expect(requeteDepuisEtat(etatDepuisRequete({}))).toEqual({});
  });

  it('recherche sans accents ni casse, filtres cumules', () => {
    const r = appliquerListe(lignes, { recherche: 'DEPOT', filtres: {}, tri: null, sens: 'asc' }, { colonnes, filtres });
    expect(r.map((l) => l.id)).toEqual(['2']);
    const f = appliquerListe(lignes, { recherche: 'port', filtres: { statut: 'actif' }, tri: null, sens: 'asc' }, { colonnes, filtres });
    expect(f.map((l) => l.id)).toEqual(['3', '4']);
  });

  it('tri numerique, textes en ordre naturel, valeurs absentes toujours en fin', () => {
    const asc = appliquerListe(lignes, { recherche: '', filtres: {}, tri: 'capacite', sens: 'asc' }, { colonnes });
    expect(asc.map((l) => l.id)).toEqual(['3', '4', '1', '2']);
    const desc = appliquerListe(lignes, { recherche: '', filtres: {}, tri: 'capacite', sens: 'desc' }, { colonnes });
    expect(desc.map((l) => l.id)).toEqual(['1', '3', '4', '2']);
    const noms = appliquerListe(lignes, { recherche: '', filtres: {}, tri: 'nom', sens: 'asc' }, { colonnes });
    expect(noms.map((l) => l.nom)).toEqual(['Dépôt Kamsar', 'Mine Nimba', 'Port 9', 'Port 10']);
    expect(comparer(null, 1)).toBeGreaterThan(0);
  });

  it('cycle du tri et pagination bornee', () => {
    expect(triSuivant({ tri: null, sens: 'asc' }, 'nom')).toEqual({ tri: 'nom', sens: 'asc' });
    expect(triSuivant({ tri: 'nom', sens: 'asc' }, 'nom')).toEqual({ tri: 'nom', sens: 'desc' });
    expect(triSuivant({ tri: 'nom', sens: 'desc' }, 'nom')).toEqual({ tri: null, sens: 'asc' });
    const p = paginer(lignes, 9, 3);
    expect(p).toMatchObject({ page: 2, pages: 2, debut: 4, fin: 4 });
    expect(p.lignes.map((l) => l.id)).toEqual(['4']);
    expect(paginer([], 1, 25)).toMatchObject({ page: 1, pages: 1, debut: 0, fin: 0 });
  });

  it('export : colonnes exportables, absent = vide, booleens en clair', () => {
    expect(lignesExport(lignes.slice(0, 2), colonnes)).toEqual([
      { Nom: 'Mine Nimba', Capacité: 12000, Actif: 'Oui' },
      { Nom: 'Dépôt Kamsar', Capacité: '', Actif: 'Non' },
    ]);
  });
});

describe('Historique, motifs et lectures', () => {
  it('fusionne du plus recent au plus ancien et ecarte un horodatage illisible', () => {
    const h = fusionnerHistoriques(
      [{ id: 'a', le: '2026-11-10T08:00:00Z', libelle: 'A', source: 't1' }, { id: 'x', le: '', libelle: 'X', source: 't1' }],
      null,
      [{ id: 'b', le: '2026-11-12T08:00:00Z', libelle: 'B', source: 't2' }, { id: 'c', le: 'pas une date', libelle: 'C', source: 't2' }],
    );
    expect(h.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('motif obligatoire : longueur minimale hors espaces', () => {
    expect(motifValide('  ', 'obligatoire', 1)).toBe(false);
    expect(motifValide('ok', 'obligatoire')).toBe(false);
    expect(motifValide('Panne', 'obligatoire')).toBe(true);
    expect(motifValide('', 'facultatif')).toBe(true);
  });

  it('lecture : erreur jamais presentee comme une liste vide ; ligne retrouvee par identifiant', async () => {
    expect(await lire(Promise.resolve({ data: null, error: { message: 'refus RLS' } }), 'sites')).toEqual({ lignes: null, erreur: 'Lecture impossible (sites) : refus RLS' });
    expect(await lire(Promise.resolve({ data: null, error: null }), 'sites')).toEqual({ lignes: [], erreur: '' });
    expect(trouver([{ id: 'a' }, { id: 'b' }], 'b')).toEqual({ id: 'b' });
    expect(trouver(null, 'b')).toBeNull();
    expect(identifiantSur('0b6c-11ab')).toBe(true);
    expect(identifiantSur('x,etat.eq.1')).toBe(false);
  });
});
