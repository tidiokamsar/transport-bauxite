import { describe, expect, it } from 'vitest';
import { buildCSV, formatDataForExport } from './exports';

describe('buildCSV', () => {
  it('renvoie une chaine vide sans donnees', () => {
    expect(buildCSV([])).toBe('');
  });

  it('prend les en-tetes de la premiere ligne', () => {
    const csv = buildCSV([
      { numero: 'T-1', tonnes: 40 },
      { numero: 'T-2', tonnes: 38.5 },
    ]);
    expect(csv).toBe('numero,tonnes\nT-1,40\nT-2,38.5');
  });

  it('rend null et undefined par un champ vide, sans valeur inventee', () => {
    const csv = buildCSV([{ a: null, b: undefined, c: 0 }]);
    expect(csv).toBe('a,b,c\n,,0');
  });

  it('entoure de guillemets les valeurs contenant une virgule', () => {
    expect(buildCSV([{ site: 'Sangaredi, carriere 2' }])).toBe('site\n"Sangaredi, carriere 2"');
  });

  it('double les guillemets internes', () => {
    expect(buildCSV([{ note: 'dit "urgent"' }])).toBe('note\n"dit ""urgent"""');
  });

  it('entoure de guillemets les valeurs multilignes', () => {
    expect(buildCSV([{ note: 'ligne 1\nligne 2' }])).toBe('note\n"ligne 1\nligne 2"');
  });

  it('ignore les cles absentes de la premiere ligne', () => {
    expect(buildCSV([{ a: 1 }, { a: 2, b: 3 }])).toBe('a\n1\n2');
  });

  // Hors perimetre D-007 : protection contre l'injection de formules
  // tableur (=, +, -, @ en tete de cellule), a traiter en vague E.
  it.todo('neutralise les valeurs commencant par =, +, - ou @');
});

describe('formatDataForExport', () => {
  it('mappe les vehicules sur les libelles francais', () => {
    const [ligne] = formatDataForExport(
      [
        {
          vehicle_number: 'V-01',
          vehicle_type: 'benne',
          make: 'Volvo',
          model: 'FMX',
          year: 2021,
          status: 'active',
          mileage: 120000,
          capacity_tonnes: 40,
          registration_number: 'RC-1234',
        },
      ],
      'vehicles'
    );
    expect(ligne).toEqual({
      'Numéro': 'V-01',
      'Type': 'benne',
      'Marque': 'Volvo',
      'Modèle': 'FMX',
      'Année': 2021,
      'Statut': 'active',
      'Kilométrage': 120000,
      'Capacité': 40,
      'Immatriculation': 'RC-1234',
    });
  });

  it('conserve les champs manquants comme undefined, sans valeur par defaut', () => {
    const [ligne] = formatDataForExport([{ trip_number: 'T-9' }], 'trips');
    expect(ligne['Numéro']).toBe('T-9');
    expect(ligne['Distance']).toBeUndefined();
    expect(ligne['Carburant']).toBeUndefined();
  });

  it.each([
    ['drivers', 8],
    ['trips', 9],
    ['fuel', 8],
    ['maintenance', 7],
    ['invoices', 8],
  ] as const)('produit les colonnes attendues pour %s', (type, nbColonnes) => {
    const [ligne] = formatDataForExport([{}], type);
    expect(Object.keys(ligne)).toHaveLength(nbColonnes);
  });

  it('renvoie les donnees telles quelles pour generic', () => {
    const data = [{ x: 1 }];
    expect(formatDataForExport(data, 'generic')).toBe(data);
  });

  it('s\'enchaine avec buildCSV', () => {
    const csv = buildCSV(formatDataForExport([{ order_number: 'OT-7', description: 'Vidange, filtres' }], 'maintenance'));
    expect(csv.split('\n')[0]).toBe('Ordre,Véhicule,Type,Description,Date,Coût,Statut');
    expect(csv.split('\n')[1]).toBe('OT-7,,,"Vidange, filtres",,,');
  });
});

describe('exportToPDF et printDocument (C8)', () => {
  // Constat C8 du plan de revue : les valeurs et le titre sont injectes
  // sans echappement dans le HTML de la fenetre d'impression. Correction
  // prevue en vague E ; ce test deviendra actif avec elle.
  it.todo('echappe le HTML des valeurs, des en-tetes et du titre');
});
