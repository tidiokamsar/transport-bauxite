import { lignesConsultationPourServeur, type Fournisseur, type LigneConsultationSaisie } from './fournisseurs';

// Controles de saisie des pages Fournisseurs (D-090), testes dans
// saisie.test.ts. Le serveur reste seul juge (unicite, droits, etat).

export type SaisieFournisseur = {
  nom: string; type: string; telephone: string; email: string; adresse: string; ville: string; pays: string;
  nif: string; rccm: string; conditions: string; note: string;
};

export const saisieDepuisFournisseur = (f?: Fournisseur | null): SaisieFournisseur => ({
  nom: f?.company_name ?? '', type: f?.supplier_type ?? 'parts', telephone: f?.phone ?? '', email: f?.email ?? '',
  adresse: f?.address ?? '', ville: f?.ville ?? '', pays: f?.pays ?? '', nif: f?.identifiant_fiscal ?? '',
  rccm: f?.registre_commerce ?? '', conditions: f?.payment_terms ?? '', note: f?.notes ?? '',
});

const courrielInvalide = (v: string) => v.trim() !== '' && !/^[^\s@]+@[^\s@]+$/.test(v.trim());

export const erreursSaisieFournisseur = (s: SaisieFournisseur): string[] => [
  ...(!s.nom.trim() ? ['Raison sociale obligatoire.'] : []),
  ...(!s.type ? ['Type obligatoire.'] : []),
  ...(courrielInvalide(s.email) ? ['Courriel invalide.'] : []),
];

export interface SaisieContact { nom: string; fonction: string; telephone: string; email: string; principal: boolean }

export const erreursSaisieContact = (c: SaisieContact): string[] => [
  ...(!c.nom.trim() ? ['Nom du contact obligatoire.'] : []),
  ...(!c.telephone.trim() && !c.email.trim() ? ['Téléphone ou courriel obligatoire.'] : []),
  ...(courrielInvalide(c.email) ? ['Courriel invalide.'] : []),
];

export interface SaisieDocument { type: string; libelle: string; numero: string; emission: string; expiration: string; reference: string; observation: string }

export const erreursSaisieDocument = (d: SaisieDocument): string[] => [
  ...(!d.reference.trim() ? ['Référence de la pièce obligatoire.'] : []),
  ...(d.type === 'autre' && !d.libelle.trim() ? ['Libellé obligatoire pour un document « Autre ».'] : []),
  ...(d.emission && d.expiration && d.expiration < d.emission ? ['La date d\'expiration précède la date d\'émission.'] : []),
];

export interface SaisieOffre { fournisseur: string; reference: string; recue: string; delai: string; validite: string; conditions: string }

export const erreursSaisieOffre = (o: SaisieOffre, prixValides: boolean): string[] => [
  ...(!o.fournisseur ? ['Fournisseur obligatoire.'] : []),
  ...(!o.recue ? ['Date de réception obligatoire.'] : []),
  ...(!/^\d+$/.test(o.delai.trim()) ? ['Délai de livraison en jours (entier) obligatoire.'] : []),
  ...(!prixValides ? ['Au moins un prix unitaire entier, et aucun prix invalide.'] : []),
];

export const erreursConsultation = (s: { objet: string; lignes: LigneConsultationSaisie[]; consultes: string[] }): string[] => [
  ...(!s.objet.trim() ? ['Objet obligatoire.'] : []),
  ...(!lignesConsultationPourServeur(s.lignes) ? ['Chaque ligne porte un article ou une désignation et une quantité entière positive.'] : []),
  ...(s.consultes.length === 0 ? ['Au moins un fournisseur consulté.'] : []),
];
