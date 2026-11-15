import { describe, expect, it } from 'vitest';
import {
  argumentsRapport, bornesMois, depenseValide, grouperParSection, lignesExport, nomFichier, rapportVide,
  repartitionParCategorie, texteValeur, titreRapport, totauxParDevise, type LigneRapport,
} from './rapports';

const ligne = (p: Partial<LigneRapport>): LigneRapport => ({
  rang: 1, section: 'Voyages', indicateur: 'Livrés', valeur: null, unite: null, manquants: null, source: 'trips', remarque: null, ...p,
});
const vide = { jour: '', mois: '', debut: '', fin: '', site: '', poste: '' };

describe('bornesMois', () => {
  it('donne le premier et le dernier jour, annees bissextiles comprises', () => {
    expect(bornesMois('2024-02')).toEqual({ debut: '2024-02-01', fin: '2024-02-29' });
    expect(bornesMois('2026-11')).toEqual({ debut: '2026-11-01', fin: '2026-11-30' });
  });
  it('refuse un mois mal forme', () => {
    expect(bornesMois('2026-13')).toBeNull();
    expect(bornesMois('11/2026')).toBeNull();
  });
});

describe('argumentsRapport', () => {
  it('construit les arguments de chaque fonction serveur', () => {
    expect(argumentsRapport('journalier', { ...vide, jour: '2026-11-10', site: 's1' })).toEqual({ p_date: '2026-11-10', p_site: 's1' });
    expect(argumentsRapport('mensuel', { ...vide, mois: '2026-11' })).toEqual({ p_mois: '2026-11-01', p_site: null });
    expect(argumentsRapport('shift', { ...vide, poste: 'p1' })).toEqual({ p_poste: 'p1' });
    expect(argumentsRapport('client', { ...vide, debut: '2026-11-01', fin: '2026-11-30' })).toEqual({ p_debut: '2026-11-01', p_fin: '2026-11-30', p_site: null });
  });
  it('refuse des parametres incomplets ou une periode inversee', () => {
    expect(argumentsRapport('journalier', vide)).toBeNull();
    expect(argumentsRapport('shift', vide)).toBeNull();
    expect(argumentsRapport('loueur', { ...vide, debut: '2026-11-30', fin: '2026-11-01' })).toBeNull();
  });
});

describe('texteValeur et rapportVide', () => {
  it('affiche la remarque quand la valeur est absente, jamais 0', () => {
    expect(texteValeur(ligne({ valeur: null, remarque: 'Non visible avec vos droits de lecture' }))).toBe('Non visible avec vos droits de lecture');
    expect(texteValeur(ligne({ valeur: null }))).toBe('Sans données');
    expect(texteValeur(ligne({ valeur: 82, unite: 't' }))).toBe('82 t');
  });
  it('un rapport sans valeur ou tout a zero est vide', () => {
    expect(rapportVide(null)).toBe(true);
    expect(rapportVide([ligne({ valeur: 0 }), ligne({ valeur: null })])).toBe(true);
    expect(rapportVide([ligne({ valeur: 0 }), ligne({ valeur: 2 })])).toBe(false);
  });
});

describe('grouperParSection et lignesExport', () => {
  const lignes = [
    ligne({ rang: 30, section: 'Tonnages', indicateur: 'Tonnes chargées', valeur: 82, unite: 't', manquants: 1 }),
    ligne({ rang: 20, section: 'Voyages', indicateur: 'Voyages', valeur: 4 }),
    ligne({ rang: 23, section: 'Voyages', indicateur: 'Livrés', valeur: 2 }),
  ];
  it('regroupe dans l\'ordre des rangs', () => {
    expect(grouperParSection(lignes).map((s) => `${s.section}:${s.lignes.length}`)).toEqual(['Voyages:2', 'Tonnages:1']);
  });
  it('exporte la valeur brute et laisse vide une valeur absente', () => {
    const e = lignesExport([...lignes, ligne({ rang: 50, section: 'Carburant', indicateur: 'Gasoil', remarque: 'Sans données' })]);
    expect(e[2]).toMatchObject({ Indicateur: 'Tonnes chargées', Valeur: 82, 'Sans mesure': 1 });
    expect(e[3]).toMatchObject({ Valeur: '', Remarque: 'Sans données' });
  });
});

describe('titres et fichiers', () => {
  it('nomme le rapport selon son type et son perimetre', () => {
    expect(titreRapport('journalier', { ...vide, jour: '2026-11-10', site: 'Mine de Nimba' })).toBe('Rapport journalier du 10/11/2026 · Mine de Nimba');
    expect(titreRapport('loueur', { ...vide, debut: '2026-11-01', fin: '2026-11-30' })).toBe('Rapport loueur (Neemba) du 01/11/2026 au 30/11/2026 · tous les sites du périmètre');
    expect(nomFichier('Rapport journalier du 10/11/2026 · Mine')).toBe('rapport_journalier_du_10_11_2026_mine');
  });
});

describe('couts directs', () => {
  const couts = [
    { amount: 1000, devise: 'GNF', statut: 'enregistre', categorie: 'Location' },
    { amount: 500, devise: 'GNF', statut: 'enregistre', categorie: 'Location' },
    { amount: 900, devise: 'GNF', statut: 'annule', categorie: 'Location' },
    { amount: 20, devise: 'USD', statut: 'enregistre', categorie: null },
  ];
  it('totalise par devise sans les couts annules ni melange de devises', () => {
    expect(totauxParDevise(couts)).toEqual([{ devise: 'GNF', montant: 1500, nombre: 2 }, { devise: 'USD', montant: 20, nombre: 1 }]);
  });
  it('repartit par categorie et devise', () => {
    expect(repartitionParCategorie(couts)).toEqual([
      { categorie: 'Location', devise: 'GNF', montant: 1500 }, { categorie: 'Sans catégorie', devise: 'USD', montant: 20 },
    ]);
  });
  it('valide une depense : date non future, montant positif, devise', () => {
    const d = { date: '2026-11-10', description: 'Groupe', montant: '1 500', devise: 'GNF' };
    expect(depenseValide({ ...d, montant: '1500,5' }, '2026-11-15')).toBe(true);
    expect(depenseValide(d, '2026-11-15')).toBe(false);
    expect(depenseValide({ ...d, montant: '10', date: '2026-11-16' }, '2026-11-15')).toBe(false);
    expect(depenseValide({ ...d, montant: '10', devise: '' }, '2026-11-15')).toBe(false);
  });
});
