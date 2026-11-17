import { describe, expect, it } from 'vitest';
import { SAISIE_COUT_VIDE, annulationCoutInterdite, erreursDepense, libelleCout } from './couts';

describe('couts directs', () => {
  const saisie = { ...SAISIE_COUT_VIDE, date: '2026-11-05', description: 'Réparation pompe', montant: '250 000', devise: 'GNF' };
  it('depense complete : date non future, montant positif, devise ISO', () => {
    expect(erreursDepense(saisie, '2026-11-17')).toEqual([]);
    expect(erreursDepense({ ...saisie, devise: '' }, '2026-11-17')).toEqual(['Devise requise.']);
    expect(erreursDepense({ ...saisie, date: '2026-11-18' }, '2026-11-17')).toEqual(['Date de la dépense dans le futur.']);
    expect(erreursDepense({ ...saisie, montant: '0' }, '2026-11-17')).toEqual(['Montant TTC positif requis.']);
  });
  it('annulation d\'une depense enregistree seulement, avec le droit', () => {
    expect(annulationCoutInterdite({ statut: 'enregistre' }, true)).toBeNull();
    expect(annulationCoutInterdite({ statut: 'annule' }, true)).toMatch(/déjà annulée/);
    expect(annulationCoutInterdite({ statut: 'enregistre' }, false)).toMatch(/Droit/);
  });
  it('libelle : numero, a defaut la description', () => {
    expect(libelleCout({ numero: null, description: 'Gasoil' })).toBe('Gasoil');
    expect(libelleCout({ numero: 'CST-1', description: 'Gasoil' })).toBe('CST-1');
  });
});
