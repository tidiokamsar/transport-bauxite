import { ecrireRoute } from '../ui/routeur';

// Rapport de performance mensuel (phase 4, D-031) au standard des pages
// (D-090) : la liste garde le contrat et le mois dans l'adresse
// (#/engagements?contrat=...&mois=AAAA-MM) ; un rapport a sa fiche
// (#/engagements/<id>), son apercu imprimable (#/engagements/<id>/apercu)
// et sa remise (#/engagements/<id>/remettre, marquer_rapport_remis).

export const VUE_ENGAGEMENTS = 'engagements';
export const MODULE_ENGAGEMENTS = 'Engagements et rapport';

export interface LigneEngagement {
  engagement_id: string; indicateur: string; libelle: string; seuil: number; unite: string; sens: string; periodicite: string;
  consequence: string | null; realise: number | null; echantillon: number | null; conforme: boolean | null;
}
export interface RapportPerformance {
  id: string; contrat_id: string; periode_debut: string; periode_fin: string; statut: 'brouillon' | 'remis';
  genere_le: string; genere_par?: string | null; remis_le: string | null; remis_a: string | null; remis_par?: string | null;
  contenu: {
    engagements: LigneEngagement[];
    reconciliations: { debut: string; fin: string; statut: string; tonnage_facturable: number | null; voyages_facturables: number | null }[];
    factures: { numero: string | null; type: string; statut: string; montant_ttc: number; devise: string }[];
  };
}
export interface ContratRapport { id: string; reference: string; contrepartie: string; intitule: string; nature: string; statut?: string }

export const moisPrecedent = (maintenant = new Date()) => {
  const d = new Date(maintenant);
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
};
export const bornesMoisRapport = (mois: string) => {
  const [a, m] = mois.split('-').map(Number);
  return { du: `${mois}-01`, au: `${mois}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}` };
};
/** Mois AAAA-MM valide, sinon le defaut. */
export const moisOuDefaut = (mois: string | undefined, defaut: string) => (mois && /^\d{4}-(0[1-9]|1[0-2])$/.test(mois) ? mois : defaut);

export const routeListeEngagements = (contrat: string, mois: string) =>
  ecrireRoute({ vue: VUE_ENGAGEMENTS, mode: 'liste', requete: { contrat, mois } });

/** Raison pour laquelle la remise n'est pas proposee, ou null (le serveur controle aussi le contrat signe). */
export const remiseInterdite = (r: Pick<RapportPerformance, 'statut'>, peutEcrire: boolean): string | null =>
  !peutEcrire ? 'Droit d\'écriture sur les contrats requis.' : r.statut !== 'brouillon' ? 'Rapport déjà remis.' : null;

/** Erreurs de la saisie de remise (memes controles que marquer_rapport_remis). */
export const erreursRemise = (f: { date: string; destinataire: string }, aujourdhui: string): string[] => [
  ...(!f.date ? ['Date de remise requise.'] : f.date > aujourdhui ? ['Date de remise dans le futur.'] : []),
  ...(!f.destinataire.trim() ? ['Destinataire requis.'] : []),
];

export const libelleMois = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
export const libelleRapport = (r: Pick<RapportPerformance, 'periode_debut'> | null, c: Pick<ContratRapport, 'reference'> | null) =>
  (r ? `Rapport ${libelleMois(r.periode_debut)}${c ? ` · ${c.reference}` : ''}` : 'Rapport');
export const jourRapport =(d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR') : '—');
