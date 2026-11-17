// Ordres de travail (D-061) : libelles et cout des pieces sorties du
// registre des stocks (D-044) pour un ordre.

export const STATUTS_ORDRE: Record<string, string> = { open: 'Ouvert', in_progress: 'En cours', completed: 'Terminé', cancelled: 'Annulé' };
export const TYPES_ORDRE: Record<string, string> = { preventive: 'Préventive', corrective: 'Corrective' };
export const PRIORITES_ORDRE: Record<string, string> = { low: 'Basse', medium: 'Moyenne', high: 'Haute', critical: 'Critique' };

export interface PieceOrdre {
  mouvement_id: string; numero: string; date_mouvement: string; type_mouvement: 'exit' | 'return';
  article_id: string; article_code: string; article_nom: string; unite: string; quantite: number;
  prix_unitaire: number | null; valeur: number | null; depot_code: string | null; annule: boolean;
}

/**
 * Cout net des pieces : sorties moins retours, mouvements annules exclus.
 * Un retour sans prix est valorise au prix de la sortie du meme article
 * quand il est unique ; sinon le cout est incomplet (jamais estime).
 */
export const coutPieces = (pieces: PieceOrdre[]): { valeur: number; incomplet: boolean; quantiteNette: Map<string, number> } => {
  const actives = pieces.filter((p) => !p.annule);
  const prixSortie = new Map<string, Set<number>>();
  for (const p of actives) {
    if (p.type_mouvement === 'exit' && p.prix_unitaire !== null) {
      prixSortie.set(p.article_id, (prixSortie.get(p.article_id) ?? new Set()).add(Number(p.prix_unitaire)));
    }
  }
  let valeur = 0;
  let incomplet = false;
  const quantiteNette = new Map<string, number>();
  for (const p of actives) {
    const signe = p.type_mouvement === 'exit' ? 1 : -1;
    quantiteNette.set(p.article_id, (quantiteNette.get(p.article_id) ?? 0) + signe * p.quantite);
    let prix = p.prix_unitaire;
    if (prix === null && p.type_mouvement === 'return') {
      const connus = prixSortie.get(p.article_id);
      if (connus && connus.size === 1) prix = [...connus][0];
    }
    if (prix === null) { incomplet = true; continue; }
    valeur += signe * Number(prix) * p.quantite;
  }
  return { valeur, incomplet, quantiteNette };
};

// Pages standard (D-090) : adresse du module, colonnes lues, saisie et regles
// des actions. Miroir des gardes serveur (garde_ordre_travail,
// annuler_ordre_travail, garde_mouvement_ordre) : le serveur reste juge.

export const VUE_ORDRES = 'maintenance';
export const MODULE_ORDRES = 'Ordres de travail';

export interface Ordre {
  id: string; work_order_number: string | null; title: string | null; description: string; maintenance_type: string; priority: string | null;
  status: string; vehicle_id: string | null; site_id: string | null; scheduled_date: string | null; request_date: string | null;
  started_at: string | null; completion_date: string | null; km_at_maintenance: number | null; labor_hours: number | null;
  labor_cost: number | null; estimated_cost: number | null; actual_cost: number | null; workshop: string | null; notes: string | null;
  annule_le: string | null; annule_par: string | null; motif_annulation: string | null; created_at: string | null; updated_at: string | null;
}

export const COLONNES_ORDRE = 'id, work_order_number, title, description, maintenance_type, priority, status, vehicle_id, site_id, scheduled_date, request_date, started_at, completion_date, km_at_maintenance, labor_hours, labor_cost, estimated_cost, actual_cost, workshop, notes, annule_le, annule_par, motif_annulation, created_at, updated_at';

export const TEINTE_STATUT_ORDRE: Record<string, 'bleu' | 'orange' | 'vert' | 'gris'> = { open: 'bleu', in_progress: 'orange', completed: 'vert', cancelled: 'gris' };
export const ATELIERS_ORDRE: Record<string, string> = { internal: 'Interne', external: 'Externe' };

export const ACTIONS_ORDRE = ['demarrer', 'terminer', 'annuler', 'sortir', 'retourner', 'annuler-mouvement'] as const;
export type ActionOrdre = typeof ACTIONS_ORDRE[number];

export interface DroitsOrdre { maintenance: boolean; stock: boolean }

const libelleStatut = (s: string) => STATUTS_ORDRE[s] ?? s;

/** Raison du refus d'une action (droit ou etat), ou null si elle est possible. */
export const actionOrdreInterdite = (action: ActionOrdre, statut: string, droits: DroitsOrdre): string | null => {
  if (action === 'sortir' || action === 'retourner' || action === 'annuler-mouvement') {
    if (!droits.stock) return 'Droit d\'écriture sur les stocks (magasin) requis.';
    if (action === 'annuler-mouvement') return null;
    return statut === 'open' || statut === 'in_progress' ? null : `Ordre « ${libelleStatut(statut)} » : aucune pièce ne s'y impute plus.`;
  }
  if (!droits.maintenance) return 'Droit d\'écriture sur la maintenance requis.';
  if (action === 'demarrer') return statut === 'open' ? null : 'Seul un ordre ouvert se démarre.';
  if (action === 'terminer') return statut === 'in_progress' ? null : 'Seul un ordre en cours se termine.';
  return statut === 'open' || statut === 'in_progress' ? null : `Un ordre « ${libelleStatut(statut)} » ne s'annule pas.`;
};

/** Modification : refusee par le serveur pour un ordre annule. */
export const modificationOrdreInterdite = (statut: string, droitMaintenance: boolean): string | null => {
  if (!droitMaintenance) return 'Droit d\'écriture sur la maintenance requis.';
  return statut === 'cancelled' ? 'Ordre annulé : il ne se modifie plus.' : null;
};

export type SaisieOrdre = {
  engin: string; titre: string; description: string; type: string; priorite: string; atelier: string; site: string; prevue: string;
  km: string; heures: string; mo: string; estime: string; reel: string; notes: string;
};

export const saisieDepuisOrdre = (o?: Ordre | null): SaisieOrdre => ({
  engin: o?.vehicle_id ?? '', titre: o?.title ?? '', description: o?.description ?? '', type: o?.maintenance_type ?? '',
  priorite: o ? o.priority ?? '' : 'medium', atelier: o ? o.workshop ?? '' : 'internal', site: o?.site_id ?? '', prevue: o?.scheduled_date ?? '',
  km: o?.km_at_maintenance?.toString() ?? '', heures: o?.labor_hours?.toString() ?? '', mo: o?.labor_cost?.toString() ?? '',
  estime: o?.estimated_cost?.toString() ?? '', reel: o?.actual_cost?.toString() ?? '', notes: o?.notes ?? '',
});

/** Nombre saisi (espaces et virgule toleres) ; vide = null ; illisible = NaN. */
export const lireNombre = (v: string): number | null => (v.trim() === '' ? null : Number(v.replace(/\s/g, '').replace(',', '.')));

const CHAMPS_NOMBRE: [keyof SaisieOrdre, string][] = [
  ['km', 'Compteur'], ['heures', 'Heures de main d\'œuvre'], ['mo', 'Coût main d\'œuvre'], ['estime', 'Coût estimé'], ['reel', 'Coût réel'],
];

export const erreursOrdre = (f: SaisieOrdre): string[] => [
  ...(!f.engin ? ['Choisissez l\'engin.'] : []),
  ...(!f.titre.trim() ? ['Intitulé obligatoire.'] : []),
  ...(!f.type ? ['Choisissez le type d\'intervention.'] : []),
  ...CHAMPS_NOMBRE.flatMap(([k, l]) => {
    const n = lireNombre(f[k]);
    return n !== null && (Number.isNaN(n) || n < 0) ? [`${l} : nombre positif attendu.`] : [];
  }),
];

/** Colonnes ecrites (droits de colonne accordes par corrections_ecrans). */
export const valeursOrdre = (f: SaisieOrdre) => ({
  vehicle_id: f.engin, title: f.titre.trim(), description: f.description.trim() || f.titre.trim(), maintenance_type: f.type,
  priority: f.priorite || null, workshop: f.atelier || null, site_id: f.site || null, scheduled_date: f.prevue || null,
  km_at_maintenance: lireNombre(f.km), labor_hours: lireNombre(f.heures), labor_cost: lireNombre(f.mo), estimated_cost: lireNombre(f.estime),
  actual_cost: lireNombre(f.reel), notes: f.notes.trim() || null,
});
