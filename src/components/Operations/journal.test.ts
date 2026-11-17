import { describe, expect, it } from 'vitest';
import {
  avecContexte, contexteDepuisRequete, deFamille, estSuspendu, estVerifiable, FAMILLES, fichesDuJournal,
  historiqueDepuisJournal, syntheseControles, trierChronologie, type LigneJournal,
} from './journal';

const ligne = (id: string, type: string, quand: string, extra: Partial<LigneJournal> = {}): LigneJournal => ({
  id, trip_id: 't1', voyage_reference: 'VYG-1', rotation: null, type, libelle: type, date_operation: quand, date_saisie: quand,
  source: 'dispatch', auteur: null, donnees: {}, justificatif: null, statut: 'declare', verification_id: null, corrige_ref: null,
  annule: false, table_source: 'test', ...extra,
});

describe('journal du voyage (D-088)', () => {
  it('trie par date d\'operation, a defaut par date de saisie', () => {
    const l = trierChronologie([
      ligne('b', 'etat', '2026-11-17T10:00:00Z'),
      ligne('a', 'etat', '2026-11-17T09:00:00Z'),
      ligne('c', 'piece_jointe', '2026-11-17T09:30:00Z', { date_operation: null }),
    ]);
    expect(l.map((x) => x.id)).toEqual(['a', 'c', 'b']);
  });

  it('suspendu seulement si le dernier evenement est une suspension', () => {
    expect(estSuspendu([ligne('s', 'suspension', '2026-11-17T09:00:00Z')])).toBe(true);
    expect(estSuspendu([ligne('s', 'suspension', '2026-11-17T09:00:00Z'), ligne('r', 'reprise', '2026-11-17T10:00:00Z')])).toBe(false);
    expect(estSuspendu([])).toBe(false);
  });

  it('une verification ou une ligne annulee ne se verifie pas', () => {
    expect(estVerifiable(ligne('v', 'verification', '2026-11-17T09:00:00Z'))).toBe(false);
    expect(estVerifiable(ligne('p', 'piece_jointe', '2026-11-17T09:00:00Z', { annule: true }))).toBe(false);
    expect(estVerifiable(ligne('e', 'etat', '2026-11-17T09:00:00Z'))).toBe(true);
  });

  it('fiches reliees : une fois chacune, numero lu dans les donnees', () => {
    const f = fichesDuJournal([
      ligne('1', 'ligne_fiche_rotation', '2026-11-17T09:00:00Z', { donnees: { fiche_id: 'f1', fiche: 'FR-001', etat_fiche: 'retournee' } }),
      ligne('2', 'ligne_fiche_rotation', '2026-11-17T10:00:00Z', { donnees: { fiche_id: 'f1', fiche: 'FR-001' } }),
      ligne('3', 'etat', '2026-11-17T10:00:00Z'),
    ]);
    expect(f).toEqual([{ id: 'f1', numero: 'FR-001', etat: 'retournee' }]);
  });

  it('familles : le releve officiel CBG et le releve KOGON restent distincts', () => {
    const l = [ligne('1', 'ligne_releve_cbg', '2026-11-17T09:00:00Z'), ligne('2', 'releve_kogon', '2026-11-17T09:00:00Z')];
    expect(deFamille(l, FAMILLES.officielCbg).map((x) => x.id)).toEqual(['1']);
    expect(deFamille(l, FAMILLES.releveKogon).map((x) => x.id)).toEqual(['2']);
  });

  it('historique : la date de saisie fait foi, la correction est citee', () => {
    const h = historiqueDepuisJournal([ligne('r', 'reaffectation', '2026-11-17T09:00:00Z', { corrige_ref: 'decision_dispatch:x', donnees: { motif: 'Crevaison' } })]);
    expect(h[0]).toMatchObject({ id: 'r', le: '2026-11-17T09:00:00Z', motif: 'Crevaison' });
    expect(h[0].detail).toContain('decision_dispatch:x');
  });

  it('synthese des controles', () => {
    expect(syntheseControles([
      { ordre: 1, code: 'a', libelle: 'A', resultat: 'alerte', detail: null },
      { ordre: 2, code: 'b', libelle: 'B', resultat: 'conforme', detail: null },
      { ordre: 3, code: 'c', libelle: 'C', resultat: 'sans_donnees', detail: null },
    ])).toEqual({ alertes: 1, sansDonnees: 1, conformes: 1 });
  });

  it('contexte : lu dans la requete et ajoute sans ecraser', () => {
    const c = contexteDepuisRequete({ date: '2026-11-17', site: 's1', q: 'x', camion: '' });
    expect(c).toEqual({ date: '2026-11-17', site: 's1' });
    expect(avecContexte('#/dispatch', c)).toBe('#/dispatch?date=2026-11-17&site=s1');
    expect(avecContexte('#/trips/t1?date=2026-11-16', c)).toBe('#/trips/t1?date=2026-11-16&site=s1');
  });
});
