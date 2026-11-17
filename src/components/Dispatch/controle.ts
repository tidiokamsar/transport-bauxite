// Dispatch Control Center (D-087) : regles d'affichage pures, testees par
// vitest. Le serveur reste seul juge (fonctions de la migration
// 20261121210000) ; ces fonctions expliquent et preparent les appels.
import type { TeintePuce } from '../ui/Panneau';
import { FRAICHEUR_POSITION_MINUTES } from '../Dashboard/indicateurs';

// ---------------------------------------------------------------------------
// Shifts : referentiel (work_shifts) et instance (postes)
// ---------------------------------------------------------------------------
export interface ShiftHoraire { id: string; display_name: string; start_time: string; end_time: string }

const enMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * Shift configure dont la plage horaire couvre l'heure donnee, sinon null.
 * Ce n'est jamais un shift « actif » : seule une instance ouverte ou en cours
 * (postes) l'est. Pas de repli sur le premier shift (constat D-087).
 */
export const shiftHoraire = <S extends ShiftHoraire>(shifts: S[], maintenant: Date): S | null => {
  const m = maintenant.getHours() * 60 + maintenant.getMinutes();
  return shifts.find((s) => {
    const d = enMinutes(s.start_time);
    const f = enMinutes(s.end_time);
    return d < f ? m >= d && m < f : m >= d || m < f;
  }) ?? null;
};

export type EtatPoste = 'planifie' | 'ouvert' | 'en_cours' | 'cloture' | 'valide' | 'annule';

export const ETATS_POSTE: Record<EtatPoste, { libelle: string; teinte: TeintePuce }> = {
  planifie: { libelle: 'Planifié', teinte: 'gris' },
  ouvert: { libelle: 'Ouvert', teinte: 'bleu' },
  en_cours: { libelle: 'En cours', teinte: 'vert' },
  cloture: { libelle: 'Clôturé', teinte: 'violet' },
  valide: { libelle: 'Clôture validée', teinte: 'violet' },
  annule: { libelle: 'Annulé', teinte: 'rouge' },
};

export type ActionPoste = 'planifier' | 'ouvrir' | 'demarrer' | 'preparer' | 'cloturer' | 'annuler';

/** Actions proposees selon l'etat de l'instance (null = aucune instance). */
export const actionsPoste = (etat: EtatPoste | null): ActionPoste[] => {
  switch (etat) {
    case null: return ['planifier', 'ouvrir'];
    case 'planifie': return ['ouvrir', 'preparer', 'annuler'];
    case 'ouvert': return ['demarrer', 'preparer', 'cloturer', 'annuler'];
    case 'en_cours': return ['preparer', 'cloturer', 'annuler'];
    default: return [];
  }
};

/** Libelle de la barre superieure : instance d'abord, horaire ensuite. */
export const libelleShiftCourant = (
  shifts: ShiftHoraire[] | null,
  instance: { etat: EtatPoste; libelle: string } | null,
  maintenant: Date,
): { titre: string; detail: string; actif: boolean } => {
  if (shifts === null) return { titre: 'Shifts indisponibles', detail: 'lecture impossible', actif: false };
  if (shifts.length === 0) return { titre: 'Aucun shift défini', detail: 'Exploitation → Shifts', actif: false };
  if (instance && (instance.etat === 'ouvert' || instance.etat === 'en_cours')) {
    return { titre: `Shift ${instance.libelle}`, detail: ETATS_POSTE[instance.etat].libelle.toLowerCase(), actif: true };
  }
  const h = shiftHoraire(shifts, maintenant);
  if (!h) return { titre: 'Hors plage horaire', detail: 'aucun shift configuré à cette heure', actif: false };
  return { titre: `Shift ${h.display_name}`, detail: `${h.start_time.slice(0, 5)} – ${h.end_time.slice(0, 5)}, non ouvert`, actif: false };
};

// ---------------------------------------------------------------------------
// Besoin en voyages (miroir de besoin_shift)
// ---------------------------------------------------------------------------
export interface Besoin {
  tonnes_cible: number | null;
  voyages_cible: number | null;
  capacite_utile_t: number | null;
  hypothese_charge_pct: number | null;
  voyages_existants: number;
}

/** Besoin = voyages vises, sinon ceil(cible / (capacite x hypothese)). Null si non calculable. */
export const calculerBesoin = (b: Besoin): { besoin: number | null; proposition: number | null; base: string } => {
  if (b.tonnes_cible === null) return { besoin: null, proposition: null, base: 'Aucun objectif pour ce shift : nombre à saisir avec un motif' };
  if (b.voyages_cible !== null) {
    return { besoin: b.voyages_cible, proposition: Math.max(0, b.voyages_cible - b.voyages_existants), base: `${b.voyages_cible} voyages visés par l'objectif` };
  }
  if (b.capacite_utile_t === null || b.capacite_utile_t <= 0) return { besoin: null, proposition: null, base: 'Aucun camion disponible de capacité connue' };
  if (b.hypothese_charge_pct === null || !(b.hypothese_charge_pct > 0) || b.hypothese_charge_pct > 100) {
    return { besoin: null, proposition: null, base: 'Hypothèse de charge à saisir (pourcentage de la capacité utile)' };
  }
  const besoin = Math.ceil(b.tonnes_cible / (b.capacite_utile_t * b.hypothese_charge_pct / 100));
  return {
    besoin,
    proposition: Math.max(0, besoin - b.voyages_existants),
    base: `${b.tonnes_cible} t / (${b.capacite_utile_t} t × ${b.hypothese_charge_pct} %) = ${besoin} voyage(s)`,
  };
};

/** Le serveur exige un motif sans proposition ou si le nombre la corrige. */
export const motifRequis = (proposition: number | null, nombre: number) =>
  proposition === null ? nombre > 0 : nombre !== proposition;

// ---------------------------------------------------------------------------
// Vues des voyages par etat (cycle trips.etat inchange, D-087)
// ---------------------------------------------------------------------------
export type VueVoyages =
  | 'a_affecter' | 'affectes' | 'vers_chargement' | 'en_chargement' | 'vers_depot' | 'attente_depot'
  | 'pese_cbg' | 'decharge' | 'termines' | 'suspendus' | 'a_reaffecter' | 'interrompus' | 'annules';

export const VUES_VOYAGES: { cle: VueVoyages; libelle: string; etats: string[] }[] = [
  { cle: 'a_affecter', libelle: 'À affecter', etats: ['DRAFT', 'PLANNED'] },
  { cle: 'affectes', libelle: 'Affectés', etats: ['ASSIGNED'] },
  { cle: 'vers_chargement', libelle: 'Au chargement', etats: ['AT_LOADING'] },
  { cle: 'en_chargement', libelle: 'En chargement', etats: ['LOADING', 'LOADED', 'WEIGHED_OUT'] },
  { cle: 'vers_depot', libelle: 'Vers le dépôt', etats: ['IN_TRANSIT'] },
  { cle: 'attente_depot', libelle: 'Attente au dépôt', etats: ['AT_DESTINATION'] },
  { cle: 'decharge', libelle: 'En déchargement', etats: ['UNLOADING'] },
  { cle: 'pese_cbg', libelle: 'Pesé par CBG', etats: ['WEIGHED_IN'] },
  { cle: 'termines', libelle: 'Terminés', etats: ['DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED'] },
  { cle: 'suspendus', libelle: 'Suspendus', etats: [] },
  { cle: 'a_reaffecter', libelle: 'À réaffecter', etats: [] },
  { cle: 'interrompus', libelle: 'Interrompus', etats: ['INTERRUPTED'] },
  { cle: 'annules', libelle: 'Annulés', etats: ['CANCELLED', 'REJECTED'] },
];

/** Filtre d'un indicateur (indicateurs_dispatch.filtre) vers une vue de liste. */
export const VUE_DU_FILTRE: Record<string, VueVoyages | 'tous'> = {
  tous: 'tous', a_affecter: 'a_affecter', affectes: 'affectes', chargement: 'en_chargement', route: 'vers_depot',
  termines: 'termines', suspendus: 'suspendus', annules: 'annules', a_reaffecter: 'a_reaffecter', anomalies: 'a_reaffecter',
  camions: 'tous', chauffeurs: 'tous',
};

export const dansVue = (
  vue: VueVoyages | 'tous',
  v: { id: string; etat: string | null },
  suspendus: Set<string>,
  aReaffecter: Set<string>,
) => {
  if (vue === 'tous') return true;
  if (vue === 'suspendus') return suspendus.has(v.id);
  if (vue === 'a_reaffecter') return aReaffecter.has(v.id);
  return VUES_VOYAGES.find((x) => x.cle === vue)?.etats.includes(v.etat ?? '') ?? false;
};

// ---------------------------------------------------------------------------
// Supervision : fraicheur, jamais une position ancienne comme en direct
// ---------------------------------------------------------------------------
export type Fraicheur = 'recente' | 'ancienne' | 'aucune';

export const fraicheur = (ancienneteMin: number | null, seuil = FRAICHEUR_POSITION_MINUTES): Fraicheur =>
  ancienneteMin === null ? 'aucune' : ancienneteMin <= seuil ? 'recente' : 'ancienne';

export const libelleAnciennete = (min: number | null) => {
  if (min === null) return 'aucune transmission';
  if (min < 1) return 'il y a moins d\'une minute';
  if (min < 60) return `il y a ${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  return h < 48 ? `il y a ${h} h ${String(Math.round(min % 60)).padStart(2, '0')}` : `il y a ${Math.floor(h / 24)} j`;
};

/** Message d'erreur serveur : conflit de version (SQLSTATE 40001) explicite. */
export const messageErreur = (e: { code?: string; message: string }) =>
  e.code === '40001' ? `Conflit : ${e.message}` : e.message;
