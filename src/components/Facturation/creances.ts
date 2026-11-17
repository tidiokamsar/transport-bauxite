// Creances clients (D-031) : ligne de v_creances et regles des actions de
// recouvrement, miroirs de enregistrer_encaissement et relancer.

export interface Creance {
  id: string; numero: string; contrat_id: string; devise: string; date_emission: string; date_echeance: string | null;
  montant_ttc: number; avoirs: number; du: number; encaisse: number; reste: number; jours_retard: number | null;
  dernier_encaissement: string | null; derniere_relance_niveau: number | null; derniere_relance_le: string | null;
}

export const COLONNES_CREANCE = 'id, numero, contrat_id, devise, date_emission, date_echeance, montant_ttc, avoirs, du, encaisse, reste, jours_retard, dernier_encaissement, derniere_relance_niveau, derniere_relance_le';

/** Raison du refus d'un encaissement, ou null : droit d'ecriture et reste du. */
export const encaissementInterdit = (c: Pick<Creance, 'reste'>, ecrire: boolean): string | null =>
  !ecrire ? 'Droit d\'écriture sur la facturation requis.' : Number(c.reste) > 0 ? null : 'Facture soldée : aucun reste dû.';

/** Raison du refus d'une relance, ou null : reste du, echeance depassee, trois niveaux au plus. */
export const relanceInterdite = (c: Pick<Creance, 'reste' | 'jours_retard' | 'derniere_relance_niveau'>, ecrire: boolean): string | null => {
  if (!ecrire) return 'Droit d\'écriture sur la facturation requis.';
  if (Number(c.reste) <= 0) return 'Facture soldée : aucune relance.';
  if ((c.jours_retard ?? 0) <= 0) return 'Échéance non dépassée : la relance commence après l\'échéance.';
  return (c.derniere_relance_niveau ?? 0) >= 3 ? 'Mise en demeure déjà envoyée : niveau maximal atteint.' : null;
};

export const niveauSuivant = (c: Pick<Creance, 'derniere_relance_niveau'>) => (c.derniere_relance_niveau ?? 0) + 1;
