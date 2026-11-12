// Reconciliation mensuelle et factures clients (D-029) : libelles et
// regles miroirs du serveur (statut d'une ligne, bornes d'un mois).

export type BaseTonnage = 'accepte' | 'recu' | 'charge';

export const BASES: Record<BaseTonnage, string> = {
  accepte: 'Tonnage accepté par le client',
  recu: 'Tonnage reçu (pesée à la réception)',
  charge: 'Tonnage chargé (pesée au départ)',
};

export const ANOMALIES: Record<string, { libelle: string; bloquante: boolean }> = {
  base_absente: { libelle: 'Tonnage de base absent', bloquante: true },
  sans_double_pesee: { libelle: 'Pesée Kogon / CBG incomplète', bloquante: true },
  ecart_double_pesee: { libelle: 'Écart entre les pesées Kogon et CBG', bloquante: true },
  sans_pesee: { libelle: 'Sans pesée', bloquante: false },
  ecart_hors_tolerance: { libelle: 'Écart chargé / reçu hors tolérance', bloquante: true },
  litige: { libelle: 'En litige', bloquante: true },
  rejet: { libelle: 'Rejeté', bloquante: true },
  non_accepte: { libelle: 'Livré, pas encore accepté', bloquante: true },
  ticket_double: { libelle: 'Ticket de pesée en double', bloquante: true },
  sans_fiche: { libelle: 'Sans fiche terrain', bloquante: false },
};

export type StatutLigne = 'facturable' | 'a_examiner' | 'exclue';

/** Miroir de public.statut_ligne : decision prise, sinon anomalie bloquante. */
export const statutLigne = (decision: string | null, anomalies: string[]): StatutLigne =>
  (decision as StatutLigne | null) ?? (anomalies.some((a) => ANOMALIES[a]?.bloquante) ? 'a_examiner' : 'facturable');

export const STATUTS_LIGNE: Record<StatutLigne, { libelle: string; teinte: 'vert' | 'orange' | 'gris' }> = {
  facturable: { libelle: 'Facturable', teinte: 'vert' },
  a_examiner: { libelle: 'À examiner', teinte: 'orange' },
  exclue: { libelle: 'Exclue', teinte: 'gris' },
};

export type StatutFacture = 'brouillon' | 'a_signer' | 'signee' | 'emise' | 'annulee';

export const STATUTS_FACTURE: Record<StatutFacture, { libelle: string; teinte: 'gris' | 'orange' | 'bleu' | 'vert' | 'rouge' }> = {
  brouillon: { libelle: 'Brouillon', teinte: 'gris' },
  a_signer: { libelle: 'À signer (DG)', teinte: 'orange' },
  signee: { libelle: 'Signée', teinte: 'bleu' },
  emise: { libelle: 'Émise', teinte: 'vert' },
  annulee: { libelle: 'Annulée', teinte: 'rouge' },
};

/** Premier et dernier jour d'un mois AAAA-MM (dates calendaires). */
export const bornesMoisCalendaires = (mois: string): { debut: string; fin: string } => {
  const [a, m] = mois.split('-').map(Number);
  const dernier = new Date(a, m, 0).getDate();
  return { debut: `${mois}-01`, fin: `${mois}-${String(dernier).padStart(2, '0')}` };
};

export const montant = (valeur: number, devise: string) =>
  `${Number(valeur).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${devise}`;
