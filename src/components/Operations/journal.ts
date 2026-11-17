// Operations transport (D-088) : regles pures du journal unifie du voyage
// (vue v_journal_voyage, migration 20261121220000) et du contexte de
// navigation. Aucune valeur n'est deduite : une colonne absente reste absente.
import type { EvenementHistorique } from '../ui/evenements';
import type { TeintePuce } from '../ui/Panneau';
import { lireRoute } from '../ui/routeur';

export const VUE_OPERATIONS = 'operations';

export type StatutEvenement = 'declare' | 'verifie' | 'valide' | 'conteste';
export type SourceEvenement = 'dispatch' | 'agent_kogon' | 'import_cbg' | 'systeme' | 'autre';

export interface LigneJournal {
  id: string;
  trip_id: string;
  voyage_reference: string | null;
  rotation: number | null;
  type: string;
  libelle: string;
  date_operation: string | null;
  date_saisie: string;
  source: SourceEvenement | string;
  auteur: string | null;
  donnees: Record<string, unknown> | null;
  justificatif: string | null;
  statut: StatutEvenement | string;
  verification_id: string | null;
  corrige_ref: string | null;
  annule: boolean;
  table_source: string;
}

export const COLONNES_JOURNAL =
  'id, trip_id, voyage_reference, rotation, type, libelle, date_operation, date_saisie, source, auteur, donnees, justificatif, statut, verification_id, corrige_ref, annule, table_source';

export interface Controle { ordre: number; code: string; libelle: string; resultat: string; detail: string | null }

export const STATUTS: Record<string, { libelle: string; teinte: TeintePuce }> = {
  declare: { libelle: 'Déclaré', teinte: 'gris' },
  verifie: { libelle: 'Vérifié', teinte: 'bleu' },
  valide: { libelle: 'Validé', teinte: 'vert' },
  conteste: { libelle: 'Contesté', teinte: 'rouge' },
};

export const SOURCES: Record<string, string> = {
  dispatch: 'Dispatch',
  agent_kogon: 'Agent KOGON',
  import_cbg: 'Import CBG',
  systeme: 'Système',
  autre: 'Autre',
};

export const RESULTATS: Record<string, { libelle: string; teinte: TeintePuce }> = {
  conforme: { libelle: 'Conforme', teinte: 'vert' },
  alerte: { libelle: 'Alerte', teinte: 'rouge' },
  justifie: { libelle: 'Justifié', teinte: 'bleu' },
  sans_donnees: { libelle: 'Sans données', teinte: 'orange' },
  non_applicable: { libelle: 'Non applicable', teinte: 'gris' },
};

/** Familles du journal, pour les sections de la fiche operationnelle. */
export const FAMILLES = {
  affectations: ['affectation', 'reaffectation'],
  etapes: ['etat', 'suspension', 'reprise'],
  fiches: ['ligne_fiche_rotation'],
  officielCbg: ['ligne_releve_cbg'],
  ticketKogon: ['ticket_cbg', 'rectification_ticket'],
  releveKogon: ['releve_kogon'],
  rapprochements: ['rapprochement_pesee'],
  anomalies: ['anomalie_pesee', 'traitement_anomalie'],
  pieces: ['piece_jointe'],
} as const;

export const deFamille = (lignes: LigneJournal[], types: readonly string[]) => lignes.filter((l) => types.includes(l.type));

/** Ordre chronologique : date d'operation, a defaut date de saisie (jamais completee). */
export const trierChronologie = (lignes: LigneJournal[]): LigneJournal[] =>
  [...lignes].sort((a, b) => {
    const da = Date.parse(a.date_operation ?? a.date_saisie);
    const db = Date.parse(b.date_operation ?? b.date_saisie);
    return da - db || Date.parse(a.date_saisie) - Date.parse(b.date_saisie) || a.id.localeCompare(b.id);
  });

/** Un evenement verifiable : ni une verification, ni une ligne annulee. */
export const estVerifiable = (l: LigneJournal) => l.type !== 'verification' && !l.annule;

/** Le voyage est suspendu si le dernier evenement suspension/reprise est une suspension. */
export const estSuspendu = (lignes: LigneJournal[]): boolean => {
  const s = trierChronologie(lignes.filter((l) => l.type === 'suspension' || l.type === 'reprise'));
  return s.length > 0 && s[s.length - 1].type === 'suspension';
};

/** Fiches reliees au voyage (une fois chacune), d'apres les lignes FR du journal. */
export const fichesDuJournal = (lignes: LigneJournal[]): { id: string; numero: string; etat: string | null }[] => {
  const vues = new Map<string, { id: string; numero: string; etat: string | null }>();
  lignes.forEach((l) => {
    const d = l.donnees ?? {};
    const id = typeof d.fiche_id === 'string' ? d.fiche_id : null;
    if (!id || vues.has(id)) return;
    vues.set(id, { id, numero: typeof d.fiche === 'string' ? d.fiche : id.slice(0, 8), etat: typeof d.etat_fiche === 'string' ? d.etat_fiche : null });
  });
  return [...vues.values()];
};

/** Historique standard (D-090) depuis le journal : un evenement par ligne, sans date inventee. */
export const historiqueDepuisJournal = (lignes: LigneJournal[]): EvenementHistorique[] =>
  lignes.map((l) => ({
    id: l.id,
    le: l.date_saisie,
    libelle: l.libelle,
    detail: [
      l.date_operation && l.date_operation !== l.date_saisie ? `Opération : ${new Date(l.date_operation).toLocaleString('fr-FR')}` : null,
      `Source : ${SOURCES[l.source] ?? l.source}`,
      `Statut : ${STATUTS[l.statut]?.libelle ?? l.statut}`,
      l.corrige_ref ? `Corrige ou complète ${l.corrige_ref}` : null,
      l.annule ? 'Annulé (conservé)' : null,
    ].filter(Boolean).join(' · '),
    motif: typeof l.donnees?.motif === 'string' ? l.donnees.motif : null,
    auteur: l.auteur,
    source: l.table_source,
  }));

/** Compte des controles par resultat. */
export const syntheseControles = (controles: Controle[]) => ({
  alertes: controles.filter((c) => c.resultat === 'alerte').length,
  sansDonnees: controles.filter((c) => c.resultat === 'sans_donnees').length,
  conformes: controles.filter((c) => c.resultat === 'conforme').length,
});

// Contexte conserve d'une page a l'autre (date, site, shift, camion,
// chauffeur, voyage, rotation), porte par la requete de l'adresse.
export const CLES_CONTEXTE = ['date', 'site', 'shift', 'camion', 'chauffeur', 'voyage', 'rotation'] as const;
export type Contexte = Partial<Record<(typeof CLES_CONTEXTE)[number], string>>;

export const contexteDepuisRequete = (requete: Record<string, string>): Contexte => {
  const c: Contexte = {};
  CLES_CONTEXTE.forEach((k) => { const v = requete[k]; if (v) c[k] = v; });
  return c;
};

/** Ajoute le contexte a une adresse (#/vue...), sans ecraser ses propres parametres. */
export const avecContexte = (hash: string, contexte: Contexte): string => {
  const i = hash.indexOf('?');
  const base = i < 0 ? hash : hash.slice(0, i);
  const params = new URLSearchParams(i < 0 ? '' : hash.slice(i + 1));
  Object.entries(contexte).forEach(([k, v]) => { if (v && !params.has(k)) params.set(k, v); });
  const qs = params.toString();
  return `${base}${qs ? `?${qs}` : ''}`;
};

/** Date du contexte de l'adresse courante (AAAA-MM-JJ), sinon la valeur par defaut. */
export const dateDuContexte = (defaut: () => string): string => {
  const d = lireRoute(typeof window === 'undefined' ? '' : window.location.hash).requete.date ?? '';
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : defaut();
};

/** Filtre camion et chauffeur du contexte : un champ absent du contexte ne filtre pas. */
export const correspondRessources = (ctx: Contexte) => (v: { vehicle_id: string | null; driver_id?: string | null }) =>
  (!ctx.camion || v.vehicle_id === ctx.camion) && (!ctx.chauffeur || v.driver_id === ctx.chauffeur);
