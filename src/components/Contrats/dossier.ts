import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { lire, trouver, type Lecture } from '../ui/lecture';
import { COLONNES_CONTRAT, type Clause, type Contrat, type Echeance, type Engagement, type EntreeJournal, type Tarif, type Version } from './types';

// Lecture d'un dossier contractuel (D-026, D-090) pour la fiche et ses pages
// de saisie : contrat, versions et leur grille (tarifs, engagements,
// clauses), echeance et ses evenements, journal. Chaque erreur de lecture
// est rendue, jamais lue comme une liste vide.

export interface EvenementEcheance {
  id: string; evenement: string; date_evenement: string; ancienne_fin: string | null; nouvelle_fin: string | null; hors_preavis: boolean | null;
  motif: string; par: string | null; le: string;
}

export interface Dossier {
  contrat: Lecture<Contrat>;
  c: Contrat | null;
  versions: Version[];
  tarifs: Tarif[];
  engagements: Engagement[];
  clauses: Clause[];
  echeance: Echeance | null;
  evenements: EvenementEcheance[] | null;
  journal: (EntreeJournal & { auteur?: string | null })[] | null;
  erreurGrille: string;
  erreurJournal: string;
  pret: boolean;
}

const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });

export const useDossier = (id: string, { journal: avecJournal = false }: { journal?: boolean } = {}): Dossier => {
  const [contrat, setContrat] = useState<Lecture<Contrat>>(attente);
  const [grille, setGrille] = useState<{ versions: Version[]; tarifs: Tarif[]; engagements: Engagement[]; clauses: Clause[]; erreur: string; pret: boolean }>(
    { versions: [], tarifs: [], engagements: [], clauses: [], erreur: '', pret: false });
  const [echeance, setEcheance] = useState<Echeance | null>(null);
  const [evenements, setEvenements] = useState<EvenementEcheance[] | null>(null);
  const [journal, setJournal] = useState<Dossier['journal']>(null);
  const [erreurJournal, setErreurJournal] = useState('');

  useEffect(() => {
    lire<Contrat>(supabase.from('contrats').select(COLONNES_CONTRAT).eq('id', id), 'contrat').then(setContrat);
    (async () => {
      const v = await lire<Version>(supabase.from('contrat_versions').select('id, contrat_id, numero, intitule, date_effet, date_signature, resume, document_ref')
        .eq('contrat_id', id).order('numero'), 'versions du contrat');
      const versions = (v.lignes ?? []).filter((x) => x.contrat_id === id);
      const ids = versions.map((x) => x.id);
      if (ids.length === 0) { setGrille({ versions, tarifs: [], engagements: [], clauses: [], erreur: v.erreur, pret: true }); return; }
      const [t, e, k] = await Promise.all([
        lire<Tarif>(supabase.from('contrat_tarifs').select('*').in('version_id', ids).order('ordre'), 'tarifs'),
        lire<Engagement>(supabase.from('contrat_engagements').select('*').in('version_id', ids).order('ordre'), 'engagements'),
        lire<Clause>(supabase.from('contrat_clauses').select('*').in('version_id', ids).order('ordre'), 'clauses'),
      ]);
      const garder = <T extends { version_id: string }>(l: T[] | null) => (l ?? []).filter((x) => ids.includes(x.version_id));
      setGrille({ versions, tarifs: garder(t.lignes), engagements: garder(e.lignes), clauses: garder(k.lignes), erreur: v.erreur || t.erreur || e.erreur || k.erreur, pret: true });
    })();
    Promise.all([
      supabase.from('v_echeances_contrats').select('*').eq('contrat_id', id).maybeSingle(),
      supabase.from('contrats_echeances').select('id, evenement, date_evenement, ancienne_fin, nouvelle_fin, hors_preavis, motif, par, le').eq('contrat_id', id).order('le', { ascending: false }),
    ]).then(([ech, ev]) => {
      const e = ech.data as Echeance | null;
      setEcheance(e && e.contrat_id === id ? e : null);
      setEvenements(((ev.data ?? []) as (EvenementEcheance & { contrat_id?: string })[]).filter((x) => !x.contrat_id || x.contrat_id === id));
    });
    if (avecJournal) {
      supabase.from('journal_contrats').select('id, table_cible, action, avant, apres, auteur, le, contrat_id').eq('contrat_id', id).order('le', { ascending: false }).limit(200)
        .then(({ data, error }) => {
          setErreurJournal(error ? `Lecture impossible (journal du contrat) : ${error.message}` : '');
          setJournal(error ? [] : ((data ?? []) as (EntreeJournal & { contrat_id: string | null })[]).filter((j) => j.contrat_id === id));
        });
    }
  }, [id, avecJournal]);

  return {
    contrat, c: trouver(contrat.lignes, id), versions: grille.versions, tarifs: grille.tarifs, engagements: grille.engagements, clauses: grille.clauses,
    echeance, evenements, journal, erreurGrille: grille.erreur, erreurJournal, pret: contrat.lignes !== null && grille.pret,
  };
};
