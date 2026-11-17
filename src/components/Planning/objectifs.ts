// Objectifs de production (D-023, D-063) au standard des pages (D-090) :
// adresse du module, lecture d'une version, regles de saisie miroirs de
// definir_objectif (tonnes > 0, motif d'une revision) et scenario de
// rattrapage transmis par l'adresse.

export const VUE_PLANIFICATION = 'planification';
export const MODULE_PLANIFICATION = 'Planification';
export const PREFIXE_CLOTURE = 'cloture-';

export interface ObjectifVersion {
  id: string; date_plan: string; site_id: string; shift_id: string | null; version: number; tonnes_cible: number; voyages_cible: number | null;
  camions_prevus: number | null; chargeuses_prevues: number | null; statut: 'actif' | 'remplace' | 'annule'; motif: string | null; note: string | null;
  cree_par: string | null; cree_le: string; clos_le: string | null; clos_par: string | null; motif_annulation: string | null;
}

export const COLONNES_OBJECTIF = 'id, date_plan, site_id, shift_id, version, tonnes_cible, voyages_cible, camions_prevus, chargeuses_prevues, statut, motif, note, cree_par, cree_le, clos_le, clos_par, motif_annulation';

export const STATUTS_OBJECTIF: Record<ObjectifVersion['statut'], { libelle: string; teinte: 'vert' | 'gris' | 'rouge' }> = {
  actif: { libelle: 'En vigueur', teinte: 'vert' },
  remplace: { libelle: 'Remplacé', teinte: 'gris' },
  annule: { libelle: 'Annulé', teinte: 'rouge' },
};

export type SaisieObjectif = {
  date: string; site: string; shift: string; tonnes: string; voyages: string; camions: string; chargeuses: string; motif: string; note: string;
};

export const nombreSaisi = (v: string) => (v.trim() === '' ? null : Number(v.replace(/\s/g, '').replace(',', '.')));
const entierOuVide = (v: string) => v.trim() === '' || /^\d+$/.test(v.trim());

/** Erreurs de saisie ; `revision` = un objectif actif existe deja pour la date, le site et la portee. */
export const erreursObjectif = (f: SaisieObjectif, revision: boolean): string[] => {
  const tonnes = nombreSaisi(f.tonnes);
  return [
    ...(!f.date ? ['Date obligatoire.'] : []),
    ...(!f.site ? ['Choisissez le site de chargement.'] : []),
    ...(tonnes === null || Number.isNaN(tonnes) || !(tonnes > 0) ? ['Indiquez un objectif en tonnes supérieur à zéro.'] : []),
    ...(!entierOuVide(f.voyages) || f.voyages.trim() === '0' ? ['Voyages visés : nombre entier supérieur à zéro, ou vide.'] : []),
    ...(!entierOuVide(f.camions) ? ['Camions prévus : nombre entier, ou vide.'] : []),
    ...(!entierOuVide(f.chargeuses) ? ['Chargeuses prévues : nombre entier, ou vide.'] : []),
    ...(revision && !f.motif.trim() ? ['Motif de la révision obligatoire (nouvelle version).'] : []),
  ];
};

export interface ScenarioPropose { titre: string; tonnes: number; camions: number | null; chargeuses: number | null }

/** Requete d'adresse d'un scenario retenu (D-063) : valeurs proposees, motif a saisir. */
export const requeteScenario = (s: ScenarioPropose): Record<string, string> => ({
  scenario: s.titre, tonnes: String(s.tonnes),
  ...(s.camions !== null ? { camions: String(s.camions) } : {}),
  ...(s.chargeuses !== null ? { chargeuses: String(s.chargeuses) } : {}),
});

export const scenarioDepuisRequete = (r: Record<string, string>): ScenarioPropose | null => {
  const tonnes = Number(r.tonnes);
  if (!r.scenario || !Number.isFinite(tonnes) || tonnes <= 0) return null;
  const entier = (v: string | undefined) => (v !== undefined && /^\d+$/.test(v) ? Number(v) : null);
  return { titre: r.scenario, tonnes, camions: entier(r.camions), chargeuses: entier(r.chargeuses) };
};
