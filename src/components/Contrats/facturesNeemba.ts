// Controle des factures du loueur (D-032, D-033) aux pages standard
// (D-090) : libelles, regles des actions et saisie, sans effet de bord.

export type StatutFactureF = 'saisie' | 'controlee' | 'notifiee' | 'regularisee' | 'conforme';

export interface FactureF {
  id: string; contrat_id: string; numero_fournisseur: string; date_facture: string; periode_debut: string; periode_fin: string;
  devise: string; montant_ht_facture: number; statut: StatutFactureF;
  montant_attendu: number | null; ecart_total: number | null; montant_reclame: number | null; notifiee_le: string | null;
  reference_notification: string | null; controle_le: string | null; controle_par?: string | null;
  saisie_le?: string | null; saisie_par?: string | null; note?: string | null;
}
export interface LigneF {
  id: string; facture_id: string; vehicle_id: string | null; libelle: string; categorie_materiel: string | null;
  quantite_facturee: number | null; unite_facturee: string | null; heures_facturees: number | null; taux_facture: number | null; montant_facture: number;
  quantite_attendue: number | null; unite_attendue: string | null; heures_attendues: number | null;
  taux_attendu: number | null; montant_attendu: number | null; heures_arret_loueur: number | null;
  ecart: number | null; constat: string | null;
}
export interface RegulF { id: string; facture_id: string; date_regularisation: string; montant: number; mode: string; reference: string | null; saisi_par?: string | null; saisi_le?: string | null }
export interface ContratLoueur { id: string; reference: string; contrepartie: string; devise: string; nature: string }

export const VUE_FACTURES_NEEMBA = 'factures-neemba';
export const MODULE_FACTURES_NEEMBA = 'Contrôle factures Neemba';

export const STATUTS_FACTURE_F: Record<StatutFactureF, { l: string; t: 'gris' | 'bleu' | 'orange' | 'vert' }> = {
  saisie: { l: 'Saisie', t: 'gris' }, controlee: { l: 'Contrôlée', t: 'bleu' }, notifiee: { l: 'Écart notifié', t: 'orange' },
  regularisee: { l: 'Régularisée', t: 'vert' }, conforme: { l: 'Conforme', t: 'vert' },
};
export const MODES_REGUL: Record<string, string> = { avoir: 'Avoir du loueur', deduction: 'Déduction sur paiement', remboursement: 'Remboursement' };
export const UNITES: Record<string, string> = { heure: 'Heures', km: 'Kilomètres', tonne: 'Tonnes', jour: 'Jours', mois: 'Mois', forfait: 'Forfaits', autre: 'Autre' };
export const COURT: Record<string, string> = { heure: 'h', km: 'km', tonne: 't', jour: 'j', mois: 'mois', forfait: 'forfait', autre: '' };

/** Quantite affichee avec son unite courte ; « — » si absente. */
export const quantite = (q: number | null, unite: string | null, repli: number | null = null) => {
  const v = q ?? repli;
  if (v === null || v === undefined) return '—';
  return `${v}${q !== null && unite ? ` ${COURT[unite] ?? unite}` : ''}`;
};

export const nombre = (v: string): number | null => (v.trim() === '' ? null : Number(v.replace(/\s/g, '').replace(',', '.')));

export const ACTIONS_FACTURE_F = ['controler', 'notifier', 'regulariser', 'notification'] as const;
export type ActionFactureF = typeof ACTIONS_FACTURE_F[number];

/** Raison du refus (droit, etat) comme les fonctions serveur ; null = possible. */
export const actionFactureFInterdite = (action: ActionFactureF, statut: StatutFactureF, peutEcrire: boolean): string | null => {
  if (action === 'notification') {
    return statut === 'notifiee' || statut === 'regularisee' ? null : 'Aucun écart notifié pour cette facture : pas de lettre de notification.';
  }
  if (!peutEcrire) return 'Droit d\'écriture sur les contrats requis.';
  if (action === 'controler' && !['saisie', 'controlee'].includes(statut)) return `Facture « ${STATUTS_FACTURE_F[statut]?.l ?? statut} » : le contrôle n'est plus modifiable.`;
  if (action === 'notifier' && statut !== 'controlee') return 'La notification suit le contrôle de la facture (statut « Contrôlée »).';
  if (action === 'regulariser' && statut !== 'notifiee') return 'Régularisation sur un écart notifié seulement.';
  return null;
};

export interface EnteteSaisie { contrat: string; numero: string; date: string; debut: string; fin: string; ht: string }
export interface LigneSaisie { vehicule: string; libelle: string; categorie: string; quantite: string; unite: string; taux: string; montant: string }
export const ligneVide = (): LigneSaisie => ({ vehicule: '', libelle: '', categorie: '', quantite: '', unite: 'heure', taux: '', montant: '' });

const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** Erreurs de la saisie d'une facture recue (le serveur reste juge : D-078). */
export const erreursFactureF = (e: EnteteSaisie, lignes: LigneSaisie[], jour: string = aujourdhui()): string[] => {
  const r: string[] = [];
  if (!e.contrat) r.push('Contrat de location requis.');
  if (!e.numero.trim()) r.push('Numéro de facture requis.');
  if (!e.date) r.push('Date de facture requise.');
  else if (e.date > jour) r.push('Date de facture dans le futur.');
  if (!e.debut || !e.fin) r.push('Période facturée requise.');
  else if (e.fin < e.debut) r.push('La fin de période suit le début.');
  const ht = nombre(e.ht);
  if (ht === null || Number.isNaN(ht) || ht < 0) r.push('Montant HT facturé requis (nombre positif).');
  const remplies = lignes.filter((l) => l.vehicule || l.libelle.trim());
  if (remplies.length === 0) r.push('Au moins une ligne (engin ou libellé).');
  if (remplies.some((l) => { const m = nombre(l.montant); return m === null || Number.isNaN(m); })) r.push('Chaque ligne porte son montant.');
  if (remplies.some((l) => { const q = nombre(l.quantite); return q !== null && Number.isNaN(q); })) r.push('Quantité illisible sur une ligne.');
  return r;
};

/** Lignes envoyees a saisir_facture_fournisseur (lignes vides ecartees). */
export const lignesPourServeur = (lignes: LigneSaisie[], immat: Map<string, string>) =>
  lignes.filter((l) => l.vehicule || l.libelle.trim()).map((l) => ({
    vehicle_id: l.vehicule || null,
    libelle: l.libelle.trim() || immat.get(l.vehicule) || 'Ligne',
    categorie_materiel: l.categorie || null,
    quantite_facturee: nombre(l.quantite),
    unite_facturee: l.quantite.trim() === '' ? null : l.unite,
    taux_facture: nombre(l.taux),
    montant_facture: nombre(l.montant),
  }));
