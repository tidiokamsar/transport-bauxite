import { describe, expect, it } from 'vitest';
import {
  actionsPossibles, analyserReleve, colonnesManquantes, donneesReleveKogon, empreinteSha256, enregistrerBrouillon,
  libelleTolerance, lireBrouillons, supprimerBrouillon, type BrouillonKogon,
} from './pesee';

// Stockage local simule (cle par fiche).
const memoire = () => {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
  };
};

describe('analyse de l\'import du releve CBG (D-081)', () => {
  it('colonnes exigees : ticket, date et poids', () => {
    expect(colonnesManquantes(['ticket', 'net'])).toEqual(['date']);
    expect(colonnesManquantes(['ticket', 'date', 'brut'])).toEqual(['net (ou brut et tare)']);
    expect(colonnesManquantes(['ticket', 'date', 'brut', 'tare'])).toEqual([]);
    expect(analyserReleve('ticket;net\nT-1;40').erreur).toBe('Colonnes manquantes : date');
  });
  it('apercu : lignes acceptees, rejetees avec motif, incompletes comptees', () => {
    const r = analyserReleve('Ticket;Date;Immatriculation;Net\nT-1;03/10/2026;RC 1;40,5\nT-2;03/10/2026;RC 2\n;;;\nT-3;demain;RC 3;41');
    expect(r.erreur).toBeUndefined();
    expect(r.lignes.map((l) => l.ticket)).toEqual(['T-1', 'T-3']);
    expect(r.rejets).toEqual([
      { rang: 3, motif: '3 champ(s) au lieu de 4', contenu: 'T-2;03/10/2026;RC 2' },
      { rang: 4, motif: 'Aucune valeur reconnue', contenu: ';;;' },
    ]);
    expect(r.incompletes).toBe(1);
    expect(r.lignes[1].date).toBe('');
  });
  it('fichier vide refuse', () => {
    expect(analyserReleve('ticket;date;net').erreur).toContain('vide');
  });
  it('empreinte SHA-256 du contenu exact', async () => {
    const e = await empreinteSha256(new TextEncoder().encode('abc').buffer as ArrayBuffer);
    expect(e).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('anomalies de pesee', () => {
  const droits = { voyages: true, facturation: true, utilisateur: 'u1' };
  it('actions selon l\'etat', () => {
    expect(actionsPossibles({ statut: 'ouverte', categorie: 'ecart_poids', soumis_par: null }, droits))
      .toEqual(['examiner', 'demander_verification', 'ajouter_observation', 'affecter']);
    expect(actionsPossibles({ statut: 'cloturee', categorie: 'ecart_poids', soumis_par: null }, droits)).toEqual([]);
  });
  it('celui qui a soumis un ecart de poids ne le cloture pas', () => {
    expect(actionsPossibles({ statut: 'soumise_validation', categorie: 'ecart_poids', soumis_par: 'u1' }, droits)).not.toContain('cloturer');
    expect(actionsPossibles({ statut: 'soumise_validation', categorie: 'ecart_poids', soumis_par: 'u2' }, droits)).toContain('cloturer');
    expect(actionsPossibles({ statut: 'soumise_validation', categorie: 'ecart_poids', soumis_par: 'u2' }, { ...droits, facturation: false }))
      .not.toContain('cloturer');
  });
  it('tolerance non parametree affichee comme telle', () => {
    expect(libelleTolerance({ tolerance_t: null, tolerance_pct: null, source: 'non_parametree' })).toContain('non paramétrée');
    expect(libelleTolerance({ tolerance_t: 0.5, tolerance_pct: 1, source: 'site' })).toBe('Tolérance du site : 0.5 t et 1 %');
  });
});

describe('brouillons de fiche terrain KOGON', () => {
  it('enregistrement local par fiche, relecture, suppression apres envoi', () => {
    const s = memoire();
    const b: BrouillonKogon = { client_id: 'c1', site_id: 's1', trip_id: '', champs: { ticket: 'T-1' }, anomalie: false, modifie_le: '2026-11-16T10:00:00Z' };
    expect(enregistrerBrouillon(b, s)).toBe(true);
    enregistrerBrouillon({ ...b, client_id: 'c2', modifie_le: '2026-11-16T11:00:00Z' }, s);
    s.setItem('autre', 'x');
    expect(lireBrouillons(s).map((x) => x.client_id)).toEqual(['c2', 'c1']);
    supprimerBrouillon('c1', s);
    expect(lireBrouillons(s).map((x) => x.client_id)).toEqual(['c2']);
  });
  it('stockage indisponible : aucun plantage', () => {
    expect(lireBrouillons(null)).toEqual([]);
    expect(enregistrerBrouillon({ client_id: 'c', site_id: '', trip_id: '', champs: {}, anomalie: false, modifie_le: '' }, null)).toBe(false);
  });
  it('donnees envoyees : vides retires, decimales a virgule, rien de complete', () => {
    expect(donneesReleveKogon({ ticket: ' T-1 ', net: '40,5', brut: '', anomalie_texte: 'x' }, false))
      .toEqual({ ticket: 'T-1', net: '40.5', anomalie_signalee: false });
  });
});
