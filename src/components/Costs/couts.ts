// Regles des pages Couts directs (D-058, D-082, D-090). Une depense
// s'enregistre par enregistrer_cout et s'annule avec un motif par
// annuler_cout : elle ne se modifie ni ne se supprime.

export const VUE_COUTS = 'costs';
export const MODULE_COUTS = 'Coûts directs';
export const COLONNES_COUT = '*, cost_categories(name, category_type), vehicles(registration), sites(name)';

export interface Cout {
  id: string; numero: string | null; date: string; description: string; amount: number; devise: string | null; reference: string | null;
  payment_method: string | null; notes: string | null; statut: 'enregistre' | 'annule'; motif_annulation: string | null; site_id: string | null;
  vehicle_id?: string | null; category_id?: string | null; created_by?: string | null; created_at?: string | null; annule_par?: string | null; annule_le?: string | null;
  piece_reprise_source?: 'bon_commande' | 'facture_loueur' | null; piece_reprise_id?: string | null;
  cost_categories: { name: string; category_type: string } | null; vehicles: { registration: string } | null; sites: { name: string } | null;
}

export const DEVISES_COUT = ['GNF', 'USD', 'EUR'];
export const MODES_COUT = ['Virement', 'Chèque', 'Espèces', 'Mobile money', 'Autre'];
export const SAISIE_COUT_VIDE = { date: '', description: '', montant: '', devise: '', categorie: '', site: '', vehicule: '', reference: '', mode: '', notes: '', piece: '' };
export type SaisieCout = typeof SAISIE_COUT_VIDE;

/** Erreurs de saisie d'une depense (memes controles que le serveur : date non future, montant TTC positif, devise ISO). */
export const erreursDepense = (d: SaisieCout, aujourdhui: string): string[] => {
  const montant = Number(d.montant.replace(/\s/g, '').replace(',', '.'));
  return [
    ...(!/^\d{4}-\d{2}-\d{2}$/.test(d.date) ? ['Date de la dépense requise.'] : d.date > aujourdhui ? ['Date de la dépense dans le futur.'] : []),
    ...(!d.description.trim() ? ['Description requise.'] : []),
    ...(!(Number.isFinite(montant) && montant > 0) ? ['Montant TTC positif requis.'] : []),
    ...(!/^[A-Z]{3}$/.test(d.devise) ? ['Devise requise.'] : []),
  ];
};

/** Raison pour laquelle l'annulation n'est pas proposee, ou null. */
export const annulationCoutInterdite = (c: Pick<Cout, 'statut'>, peutSaisir: boolean): string | null =>
  !peutSaisir ? 'Droit d\'écriture sur les coûts requis.' : c.statut !== 'enregistre' ? 'Dépense déjà annulée.' : null;

export const libelleCout = (c: Pick<Cout, 'numero' | 'description'>) => c.numero ?? c.description;
