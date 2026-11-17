import type { RouteApp } from '../ui/routeur';
import { ecrireRoute, routeAction, routeDetail } from '../ui/routeur';
import type { Fournisseur, StatutConsultation, StatutOffre } from './fournisseurs';

// Pages du module Fournisseurs (D-059, D-090). Une seule vue du menu,
// `suppliers`, porte trois sortes de pages ; le routeur commun n'est pas
// modifie :
//   #/suppliers                            repertoire des fournisseurs
//   #/suppliers/nouveau, /<id>, /<id>/modifier, /<id>/<action>
//   #/suppliers/consultations              liste des consultations (?q=, ?statut=)
//   #/suppliers/consultations/nouveau      creation d'une consultation
//   #/suppliers/consultation-<id>          fiche d'une consultation
//   #/suppliers/consultation-<id>/<action> action sur une consultation
//   #/suppliers/referentiels               categories et grille d'evaluation
//   #/suppliers/referentiels/<action>      saisie d'un referentiel (administrateur)

export const VUE_FOURNISSEURS = 'suppliers';
export const MODULE_FOURNISSEURS = 'Fournisseurs';
export const ID_CONSULTATIONS = 'consultations';
export const ID_REFERENTIELS = 'referentiels';
const PREFIXE_CONSULTATION = 'consultation-';

export type PageFournisseurs =
  | { page: 'fournisseurs' }
  | { page: 'nouveau-fournisseur' }
  | { page: 'fournisseur'; id: string }
  | { page: 'modifier-fournisseur'; id: string }
  | { page: 'action-fournisseur'; id: string; action: string }
  | { page: 'consultations' }
  | { page: 'nouvelle-consultation' }
  | { page: 'consultation'; id: string }
  | { page: 'action-consultation'; id: string; action: string }
  | { page: 'referentiels' }
  | { page: 'action-referentiel'; action: string };

/** Page a afficher pour une route de la vue `suppliers`. */
export const pageDepuisRoute = (route: Pick<RouteApp, 'vue' | 'mode' | 'id' | 'action'>): PageFournisseurs => {
  if (route.vue !== VUE_FOURNISSEURS || route.mode === 'liste') return { page: 'fournisseurs' };
  if (route.mode === 'nouveau') return { page: 'nouveau-fournisseur' };
  const id = route.id ?? '';
  if (id === ID_CONSULTATIONS) {
    if (route.mode === 'action' && route.action === 'nouveau') return { page: 'nouvelle-consultation' };
    return { page: 'consultations' };
  }
  if (id === ID_REFERENTIELS) {
    if (route.mode === 'action' && route.action) return { page: 'action-referentiel', action: route.action };
    return { page: 'referentiels' };
  }
  if (id.startsWith(PREFIXE_CONSULTATION)) {
    const c = id.slice(PREFIXE_CONSULTATION.length);
    if (route.mode === 'action' && route.action) return { page: 'action-consultation', id: c, action: route.action };
    return { page: 'consultation', id: c };
  }
  if (route.mode === 'modifier') return { page: 'modifier-fournisseur', id };
  if (route.mode === 'action' && route.action) return { page: 'action-fournisseur', id, action: route.action };
  return { page: 'fournisseur', id };
};

export const idRouteConsultation = (id: string) => `${PREFIXE_CONSULTATION}${id}`;
export const routeConsultations = (requete: Record<string, string> = {}) =>
  ecrireRoute({ vue: VUE_FOURNISSEURS, mode: 'detail', id: ID_CONSULTATIONS, requete });
export const routeNouvelleConsultation = () => routeAction(VUE_FOURNISSEURS, ID_CONSULTATIONS, 'nouveau');
export const routeConsultation = (id: string, onglet?: string) => routeDetail(VUE_FOURNISSEURS, idRouteConsultation(id), onglet);
export const routeActionConsultation = (id: string, action: string, requete: Record<string, string> = {}) =>
  ecrireRoute({ vue: VUE_FOURNISSEURS, mode: 'action', id: idRouteConsultation(id), action, requete });
export const routeReferentiels = () => routeDetail(VUE_FOURNISSEURS, ID_REFERENTIELS);
export const routeActionReferentiel = (action: string, requete: Record<string, string> = {}) =>
  ecrireRoute({ vue: VUE_FOURNISSEURS, mode: 'action', id: ID_REFERENTIELS, action, requete });
export const routeActionFournisseur = (id: string, action: string, requete: Record<string, string> = {}) =>
  ecrireRoute({ vue: VUE_FOURNISSEURS, mode: 'action', id, action, requete });

// Actions d'un fournisseur et conditions (droit, etat), miroir des
// fonctions serveur qui restent seules juges.
export const ACTIONS_FOURNISSEUR = ['suspendre', 'reactiver', 'contact', 'retirer-contact', 'document', 'retirer-document', 'evaluer', 'classer'] as const;
export type ActionFournisseur = typeof ACTIONS_FOURNISSEUR[number];
export interface DroitsFournisseurs { ecrire: boolean; approuver: boolean }

export const actionFournisseurInterdite = (
  action: ActionFournisseur, f: Pick<Fournisseur, 'active'>, droits: DroitsFournisseurs, grilleDefinie = true,
): string | null => {
  if (action === 'suspendre' || action === 'reactiver') {
    if (!droits.approuver) return 'Droit d\'approbation sur les achats requis.';
    if (action === 'suspendre' && f.active === false) return 'Ce fournisseur est déjà suspendu.';
    if (action === 'reactiver' && f.active !== false) return 'Ce fournisseur n\'est pas suspendu.';
    return null;
  }
  if (!droits.ecrire) return 'Droit d\'écriture sur les achats requis.';
  if (action === 'evaluer' && !grilleDefinie) return 'Grille d\'évaluation non définie : l\'administrateur la renseigne dans les référentiels.';
  return null;
};

export const ACTIONS_CONSULTATION = ['offre', 'retenir', 'retirer-offre', 'annuler', 'inviter', 'preparer-bon'] as const;
export type ActionConsultation = typeof ACTIONS_CONSULTATION[number];

export const actionConsultationInterdite = (
  action: ActionConsultation,
  c: { statut: StatutConsultation; purchase_order_id: string | null },
  ecrire: boolean,
  offre?: { statut: StatutOffre } | null,
): string | null => {
  if (!ecrire) return 'Droit d\'écriture sur les achats requis.';
  if (action === 'preparer-bon') {
    if (c.statut !== 'attribuee') return 'Le bon de commande se prépare sur une consultation attribuée.';
    if (c.purchase_order_id) return 'Un bon de commande est déjà préparé pour cette consultation.';
    return null;
  }
  if (c.statut !== 'ouverte') return 'La consultation n\'est plus ouverte.';
  if ((action === 'retenir' || action === 'retirer-offre') && offre !== undefined) {
    if (!offre) return 'Offre introuvable dans cette consultation.';
    if (offre.statut !== 'recue') return 'Seule une offre reçue peut être retenue ou retirée.';
  }
  return null;
};
