// Regles des pages Budgets (D-065, D-082, D-090). Un budget s'enregistre ou
// se revise par definir_budget (la revision garde le precedent et exige un
// motif) et s'annule par annuler_budget (motif exige). Seul un budget
// courant (v_budgets_courants : ni annule ni revise) se revise ou s'annule.

export const VUE_BUDGETS = 'budgets';
export const MODULE_BUDGETS = 'Budgets et comptabilité';

export interface SuiviBudget {
  id: string; numero: string; periode_debut: string; periode_fin: string; site_id: string | null; site: string | null; nature_id: string;
  nature: string; nature_code: string; devise: string; montant_ttc: number; note: string | null; cree_le?: string | null; engage_bons: number; engage_a_payer: number;
  engage: number; realise_couts: number; realise_paiements: number; realise: number; disponible: number; consommation_pct: number;
  depassement: boolean; sources_non_visibles: string | null;
}

/** Ligne de la table budgets (versions, revision et annulation). */
export interface VersionBudget {
  id: string; numero: string; periode_debut: string; periode_fin: string; site_id: string | null; nature_id: string; devise: string; montant_ttc: number;
  note: string | null; remplace_id: string | null; motif_revision: string | null; statut: 'actif' | 'annule'; annule_par: string | null; annule_le: string | null;
  motif_annulation: string | null; cree_par: string | null; cree_le: string;
}
export const COLONNES_VERSION_BUDGET = 'id, numero, periode_debut, periode_fin, site_id, nature_id, devise, montant_ttc, note, remplace_id, motif_revision, statut, annule_par, annule_le, motif_annulation, cree_par, cree_le';

export type SaisieBudget = { debut: string; fin: string; nature: string; site: string; devise: string; montant: string; motif: string; note: string };
export const SAISIE_BUDGET_VIDE: SaisieBudget = { debut: '', fin: '', nature: '', site: '', devise: '', montant: '', motif: '', note: '' };

export const lireMontantBudget = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(/\s/g, '').replace(',', '.')));

/** Erreurs de saisie (memes controles que definir_budget) ; `revision` exige le motif. */
export const erreursBudget = (b: SaisieBudget, revision: boolean): string[] => {
  const m = lireMontantBudget(b.montant);
  return [
    ...(!b.debut || !b.fin ? ['Période du budget requise.'] : b.fin < b.debut ? ['Fin antérieure au début.'] : []),
    ...(!b.nature ? ['Nature de dépense requise.'] : []),
    ...(!/^[A-Z]{3}$/.test(b.devise) ? ['Devise requise (code à trois lettres).'] : []),
    ...(!(m > 0) ? ['Montant TTC positif requis.'] : []),
    ...(revision && !b.motif.trim() ? ['Motif de la révision requis.'] : []),
  ];
};

/** Raison pour laquelle la revision ou l'annulation n'est pas proposee, ou null. */
export const budgetNonModifiable = (peutBudget: boolean, courant: boolean): string | null =>
  !peutBudget ? 'Droit d\'écriture sur les coûts requis.' : !courant ? 'Budget annulé ou déjà révisé : seul le budget courant se révise ou s\'annule.' : null;

/** Versions d'un budget, de la plus recente a la plus ancienne, en remontant remplace_id. */
export const chaineVersions = (versions: VersionBudget[], id: string): VersionBudget[] => {
  const parId = new Map(versions.map((v) => [v.id, v]));
  const chaine: VersionBudget[] = [];
  let courant = parId.get(id);
  while (courant && !chaine.includes(courant)) {
    chaine.push(courant);
    courant = courant.remplace_id ? parId.get(courant.remplace_id) : undefined;
  }
  return chaine;
};

/** Version qui a remplace celle-ci (revision posterieure), s'il y en a une. */
export const remplacantDe = (versions: VersionBudget[], id: string): VersionBudget | null => versions.find((v) => v.remplace_id === id) ?? null;
