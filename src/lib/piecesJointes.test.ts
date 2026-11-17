import { describe, expect, it } from 'vitest';
import { TAILLE_MAX, accepte, controlerFichier, empreinteSha256, etatPiece, extension, formaterTaille, typeDuFichier } from './piecesJointes';

describe('pieces jointes (D-083)', () => {
  it('deduit le type de l extension, sans tenir compte de la casse', () => {
    expect(typeDuFichier('voyage', 'Ticket 12.PDF')).toBe('application/pdf');
    expect(typeDuFichier('voyage', 'photo.jpeg')).toBe('image/jpeg');
    expect(typeDuFichier('voyage', 'photo.JPG')).toBe('image/jpeg');
    expect(typeDuFichier('livraison_carburant_cbg', 'bl.webp')).toBe('image/webp');
    expect(typeDuFichier('voyage', 'sans-extension')).toBeNull();
    expect(extension('archive.tar.gz')).toBe('gz');
  });

  it('n admet le CSV et le tableur que pour le releve CBG', () => {
    expect(typeDuFichier('voyage', 'releve.csv')).toBeNull();
    expect(typeDuFichier('ticket_pesee_cbg', 'releve.xlsx')).toBeNull();
    expect(typeDuFichier('releve_cbg', 'releve.csv')).toBe('text/csv');
    expect(typeDuFichier('releve_cbg', 'releve.xlsx')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(accepte('voyage')).not.toContain('csv');
    expect(accepte('releve_cbg')).toContain('.csv');
  });

  it('controle nom, type et taille comme le serveur', () => {
    expect(controlerFichier('voyage', 'ticket.pdf', 1200)).toBeNull();
    expect(controlerFichier('voyage', 'ticket.pdf', TAILLE_MAX)).toBeNull();
    expect(controlerFichier('voyage', 'ticket.pdf', TAILLE_MAX + 1)).toMatch(/trop volumineux/);
    expect(controlerFichier('voyage', 'ticket.pdf', 0)).toMatch(/vide/);
    expect(controlerFichier('voyage', 'notes.txt', 10)).toMatch(/non admis/);
    expect(controlerFichier('voyage', '../ticket.pdf', 10)).toMatch(/invalide/);
    expect(controlerFichier('voyage', `${'a'.repeat(197)}.pdf`, 10)).toMatch(/trop long/);
  });

  it('calcule l empreinte sha256 en hexadecimal', async () => {
    const h = await empreinteSha256(new TextEncoder().encode('abc').buffer as ArrayBuffer);
    expect(h).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('etat affiche : annulee prime, en attente = depot inacheve', () => {
    expect(etatPiece({ statut: 'deposee', annule_le: null })).toBe('deposee');
    expect(etatPiece({ statut: 'en_attente', annule_le: null })).toBe('inachevee');
    expect(etatPiece({ statut: 'deposee', annule_le: '2026-11-16T10:00:00Z' })).toBe('annulee');
  });

  it('formate la taille', () => {
    expect(formaterTaille(512)).toBe('512 o');
    expect(formaterTaille(2048)).toMatch(/^2 Ko$/);
    expect(formaterTaille(3 * 1024 * 1024)).toMatch(/^3 Mo$/);
  });
});
