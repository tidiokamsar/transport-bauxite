import { formatNombre } from '../Dashboard/indicateurs';
import type { TeintePuce } from '../ui/Panneau';

// Regles pures des pages standard du carburant (D-041, D-062, D-090) :
// identifiant de route d'un objet secondaire, lecture des quantites saisies,
// controles de saisie (alignes sur les fonctions serveur, qui restent seules
// juges) et actions possibles selon le droit et l'etat. Testees dans
// carburant.test.ts.

export const VUE_PLEINS = 'fuel';
export const VUE_LIVRAISONS = 'livraisons-cbg';
export const VUE_STOCKS = 'fuel-stocks';
export const MODULE_PLEINS = 'Distribution aux engins';
export const MODULE_LIVRAISONS = 'Livraisons et factures CBG';
export const MODULE_STOCKS = 'Réceptions, cuves et inventaires';

// Une vue porte plusieurs objets : l'objet principal a son identifiant brut,
// les autres un prefixe (« facture-<uuid> », « mouvement-<uuid> »...), sans
// toucher au routeur commun.
export type ObjetSecondaire = 'facture' | 'mouvement' | 'inventaire';

export const idRoute = (objet: ObjetSecondaire, id: string) => `${objet}-${id}`;

/** Objet designe par l'identifiant de route ; objet null = objet principal de la vue. */
export const lireIdRoute = (brut: string, admis: readonly ObjetSecondaire[]): { objet: ObjetSecondaire | null; id: string } => {
  const i = brut.indexOf('-');
  const prefixe = i > 0 ? brut.slice(0, i) : '';
  if ((admis as readonly string[]).includes(prefixe) && brut.length > i + 1) return { objet: prefixe as ObjetSecondaire, id: brut.slice(i + 1) };
  return { objet: null, id: brut };
};

/** Quantite saisie (espaces et virgule decimale admis) ; null si vide ou illisible. */
export const lireNombre = (v: string): number | null => {
  const t = v.replace(/\s/g, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/** Montant en GNF ; absent = tiret. */
export const monnaie = (x: number | null) => (x === null ? '—' : `${formatNombre(Number(x), 2)} GNF`);

const positif = (v: string) => { const n = lireNombre(v); return n !== null && n > 0; };
const aujourdhuiIso = () => new Date().toISOString().slice(0, 10);

export const METHODES_MESURE = [['jauge', 'Jauge'], ['pige', 'Pige'], ['compteur', 'Compteur'], ['autre', 'Autre']] as const;

export interface SaisiePlein { date: string; engin: string; chauffeur: string; litres: string; compteur: string; cuve: string; note: string }
export const erreursPlein = (f: SaisiePlein, aujourdhui = aujourdhuiIso()): string[] => {
  const e: string[] = [];
  if (!f.date) e.push('Date du plein requise.');
  else if (f.date > aujourdhui) e.push('Date du plein dans le futur refusée.');
  if (!f.engin) e.push('Engin requis pour un plein.');
  if (!positif(f.litres)) e.push('Quantité en litres positive requise.');
  if (f.compteur.trim() !== '') { const c = lireNombre(f.compteur); if (c === null || c < 0) e.push('Compteur illisible ou négatif.'); }
  return e;
};

export interface SaisieLivraison { reference: string; date: string; site: string; litres: string; prix: string; document: string }
export const erreursLivraison = (f: SaisieLivraison): string[] => {
  const e: string[] = [];
  if (!f.reference.trim()) e.push('Référence de la livraison requise.');
  if (!f.date) e.push('Date de livraison requise.');
  if (!f.site) e.push('Site de livraison requis.');
  if (!positif(f.litres)) e.push('Quantité livrée positive requise.');
  if (!positif(f.prix)) e.push('Prix au litre positif requis.');
  return e;
};

export interface SaisieFactureCbg { reference: string; date: string; montant: string; livraisons: string[] }
export const erreursFactureCbg = (f: SaisieFactureCbg): string[] => {
  const e: string[] = [];
  if (!f.reference.trim()) e.push('Référence de la facture requise.');
  if (!f.date) e.push('Date de la facture requise.');
  const m = lireNombre(f.montant);
  if (m === null || m < 0) e.push('Montant facturé requis (zéro ou plus).');
  if (f.livraisons.length === 0) e.push('Au moins une livraison rattachée.');
  return e;
};

export interface SaisieStockage { code: string; libelle: string; type: string; site: string; capacite: string; seuil: string }
export const erreursStockage = (f: SaisieStockage, creation: boolean): string[] => {
  const e: string[] = [];
  if (creation && !f.code.trim()) e.push('Code requis.');
  if (!f.libelle.trim()) e.push('Libellé requis.');
  if (creation && !f.site) e.push('Site requis.');
  if (!positif(f.capacite)) e.push('Capacité positive requise.');
  if (f.seuil.trim() !== '') { const s = lireNombre(f.seuil); if (s === null || s < 0) e.push('Seuil d\'alerte illisible ou négatif.'); }
  return e;
};

export interface SaisieReception { stockage: string; livraison: string; quand: string; mesure: string; accepte: string; methode: string; motif: string }
/** volumeDocument : volume du bon CBG de la livraison choisie (motif exige s'il differe). */
export const erreursReception = (f: SaisieReception, volumeDocument: number | null): string[] => {
  const e: string[] = [];
  if (!f.stockage) e.push('Stockage de réception requis.');
  if (!f.livraison) e.push('Livraison CBG requise.');
  if (!f.quand) e.push('Date et heure requises.');
  const mesure = lireNombre(f.mesure);
  const accepte = lireNombre(f.accepte);
  if (!(mesure !== null && mesure > 0) || !(accepte !== null && accepte > 0)) e.push('Volumes mesuré et accepté positifs requis.');
  else if (accepte > mesure) e.push('Le volume accepté ne peut dépasser le volume mesuré.');
  if (volumeDocument !== null && mesure !== null && accepte !== null && (mesure !== volumeDocument || accepte !== volumeDocument) && !f.motif.trim()) {
    e.push('Écart avec le volume du document CBG : motif requis.');
  }
  return e;
};

export interface SaisieTransfert { source: string; destination: string; litres: string; quand: string; reference: string; note: string }
export const erreursTransfert = (f: SaisieTransfert): string[] => {
  const e: string[] = [];
  if (!f.source || !f.destination) e.push('Stockages de départ et d\'arrivée requis.');
  else if (f.source === f.destination) e.push('Départ et arrivée identiques.');
  if (!positif(f.litres)) e.push('Quantité positive requise.');
  if (!f.quand) e.push('Date et heure requises.');
  return e;
};

export interface SaisieInventaire { stockage: string; mesure: string; quand: string; methode: string; note: string }
export const erreursInventaire = (f: SaisieInventaire, capacite: number | null): string[] => {
  const e: string[] = [];
  if (!f.stockage) e.push('Stockage requis.');
  const m = lireNombre(f.mesure);
  if (m === null || m < 0) e.push('Volume mesuré requis (zéro ou plus).');
  else if (capacite !== null && m > capacite) e.push(`Volume mesuré au plus égal à la capacité (${capacite} L).`);
  if (!f.quand) e.push('Date et heure de la mesure requises.');
  return e;
};

export type StatutDecision = 'a_valider' | 'valide' | 'rejete';
export const LIBELLE_STATUT_DECISION: Record<StatutDecision, { libelle: string; teinte: TeintePuce }> = {
  a_valider: { libelle: 'À valider', teinte: 'orange' },
  valide: { libelle: 'Validé', teinte: 'vert' },
  rejete: { libelle: 'Rejeté', teinte: 'gris' },
};

export const ACTIONS_MOUVEMENT = ['valider', 'rejeter', 'annuler'] as const;
export type ActionMouvement = typeof ACTIONS_MOUVEMENT[number];

/** Raison du refus d'une action sur un mouvement, ou null si possible (le serveur reste juge). */
export const actionMouvementInterdite = (
  action: ActionMouvement,
  m: { statut: StatutDecision; type: string },
  { peutEcrire, dejaAnnule }: { peutEcrire: boolean; dejaAnnule: boolean },
): string | null => {
  if (!peutEcrire) return 'Droit d\'écriture sur le carburant requis.';
  if (action === 'annuler') {
    if (m.statut !== 'valide') return 'Seul un mouvement validé peut être annulé.';
    if (m.type === 'annulation' || m.type === 'ajustement_inventaire') return 'Un ajustement ou une annulation ne s\'annule pas : saisissez un nouvel inventaire.';
    if (dejaAnnule) return 'Mouvement déjà annulé ou en cours d\'annulation.';
    return null;
  }
  if (m.statut !== 'a_valider') return 'Mouvement déjà décidé.';
  if (m.type === 'ajustement_inventaire') return 'Un ajustement se décide par son inventaire.';
  return null;
};

export const ACTIONS_INVENTAIRE = ['valider', 'rejeter'] as const;
export type ActionInventaire = typeof ACTIONS_INVENTAIRE[number];

export const actionInventaireInterdite = (statut: StatutDecision, peutEcrire: boolean): string | null => {
  if (!peutEcrire) return 'Droit d\'écriture sur le carburant requis.';
  if (statut !== 'a_valider') return 'Inventaire déjà décidé.';
  return null;
};

export type StatutFactureCbg = 'saisie' | 'conforme' | 'a_examiner';
export const LIBELLE_STATUT_FACTURE_CBG: Record<StatutFactureCbg, { libelle: string; teinte: TeintePuce }> = {
  saisie: { libelle: 'À contrôler', teinte: 'orange' },
  conforme: { libelle: 'Conforme', teinte: 'vert' },
  a_examiner: { libelle: 'À examiner', teinte: 'rouge' },
};

export const controleFactureInterdit = (statut: StatutFactureCbg, peutEcrire: boolean): string | null => {
  if (!peutEcrire) return 'Droit d\'écriture sur le carburant requis.';
  if (statut !== 'saisie') return 'Facture déjà contrôlée : le contrôle n\'est fait qu\'une fois.';
  return null;
};
