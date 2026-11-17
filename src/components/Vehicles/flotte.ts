import type { TeintePuce } from '../ui/Panneau';

// Flotte (D-062) : libelles et regles pures partagees par le registre, la
// fiche vehicule et les alertes de documents. Le statut operationnel est
// calcule par le serveur (v_vehicules) ; l'ecran ne fait que l'afficher.

/** Identifiant de l'ecran dans le menu et dans l'adresse (#/vehicles/..., D-090). */
export const VUE_VEHICULES = 'vehicles';

/** Colonnes du registre (vue v_vehicules). */
export const COLONNES_VEHICULE = 'id, registration, brand_model, year, vehicle_type, capacity_tonnes, chassis_number, site_id, status, insurance_expiry, technical_inspection_expiry, propriete, proprietaire, exploitant, transporteur, contrat_id, contrat_reference, statut_admin, statut_admin_depuis, statut_admin_motif, voyage_en_cours, statut_operationnel';

/** Actions de statut en pleine page : route, fonction serveur, libelles. */
export const ACTIONS_STATUT_VEHICULE = {
  suspendre: { fonction: 'suspendre_vehicule', titre: 'Suspendre', confirmer: 'Suspendre l\'engin', succes: 'Engin suspendu.' },
  'remettre-en-service': { fonction: 'remettre_en_service_vehicule', titre: 'Remettre en service', confirmer: 'Remettre en service', succes: 'Engin remis en service.' },
  reformer: { fonction: 'reformer_vehicule', titre: 'Réformer', confirmer: 'Réformer définitivement', succes: 'Engin réformé.' },
} as const;
export type ActionStatutVehicule = keyof typeof ACTIONS_STATUT_VEHICULE;

/** Action de statut permise par le statut operationnel courant. */
export const actionStatutPermise = (action: ActionStatutVehicule, s: StatutOperationnel) => {
  const a = actionsStatut(s);
  return action === 'suspendre' ? a.suspendre : action === 'reformer' ? a.reformer : a.remettre;
};

export type StatutOperationnel = 'disponible' | 'en_mission' | 'en_maintenance' | 'immobilise' | 'suspendu' | 'reforme';
export type Propriete = 'kogon' | 'loue' | 'sous_traitant';

export const STATUTS_OPERATIONNELS: Record<StatutOperationnel, { libelle: string; teinte: TeintePuce }> = {
  disponible: { libelle: 'Disponible', teinte: 'vert' },
  en_mission: { libelle: 'En mission', teinte: 'bleu' },
  en_maintenance: { libelle: 'En maintenance', teinte: 'orange' },
  immobilise: { libelle: 'Immobilisé', teinte: 'rouge' },
  suspendu: { libelle: 'Suspendu', teinte: 'violet' },
  reforme: { libelle: 'Réformé', teinte: 'gris' },
};

export const PROPRIETES: Record<Propriete, string> = {
  kogon: 'Kogon Mining',
  loue: 'Loué',
  sous_traitant: 'Sous-traitant',
};

export const TYPES_VEHICULE: Record<string, string> = {
  tipper: 'Benne',
  flatbed: 'Plateau',
  tanker: 'Citerne',
  loader: 'Chargeuse',
  excavator: 'Pelle',
  pickup: 'Pick-up',
  bus: 'Bus',
  tow_truck: 'Dépanneuse',
};

export const TYPES_DOCUMENT: Record<string, string> = {
  insurance: 'Assurance',
  registration: 'Carte grise',
  technical_inspection: 'Visite technique',
  transport_license: 'Autorisation de transport',
  circulation_permit: 'Permis de circulation',
  tax_vignette: 'Vignette',
  authorization: 'Autorisation',
  other: 'Autre',
};

export const libelleStatut = (s: string | null | undefined) =>
  STATUTS_OPERATIONNELS[s as StatutOperationnel] ?? { libelle: 'Sans données', teinte: 'gris' as TeintePuce };

export const libellePropriete = (p: string | null | undefined) =>
  p ? PROPRIETES[p as Propriete] ?? p : 'Non renseignée';

/** Actions de statut administratif possibles depuis un statut operationnel. */
export const actionsStatut = (s: StatutOperationnel) => ({
  suspendre: s !== 'suspendu' && s !== 'reforme',
  remettre: s === 'suspendu',
  reformer: s !== 'reforme',
});

/** Ecart en jours entre une date AAAA-MM-JJ et le jour local `aujourdhui`. */
export const joursRestants = (expire: string, aujourdhui: Date) => {
  const [a, m, j] = expire.slice(0, 10).split('-').map(Number);
  const cible = Date.UTC(a, m - 1, j);
  const jour = Date.UTC(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate());
  return Math.round((cible - jour) / 86_400_000);
};

/** Etat d'une echeance de document : memes seuils que la vue serveur (30 jours). */
export const etatEcheance = (expire: string | null, aujourdhui: Date, archive = false): { texte: string; teinte: TeintePuce } => {
  if (archive) return { texte: 'Archivé', teinte: 'gris' };
  if (!expire) return { texte: 'Sans échéance', teinte: 'gris' };
  const n = joursRestants(expire, aujourdhui);
  if (n < 0) return { texte: `Expiré depuis ${-n} j`, teinte: 'rouge' };
  if (n === 0) return { texte: 'Expire aujourd\'hui', teinte: 'rouge' };
  if (n <= 30) return { texte: `Expire dans ${n} j`, teinte: 'orange' };
  return { texte: 'Valide', teinte: 'vert' };
};

/** Cout carburant de la fiche : seulement le connu, jamais estime. */
export const resumeCoutCarburant = (cout: number | null, litresSansPrix: number | null, format: (n: number) => string) => {
  if (cout === null && litresSansPrix === null) return 'Non visible avec vos droits';
  const sansPrix = Number(litresSansPrix ?? 0);
  if (cout === null) return sansPrix > 0 ? `Sans prix connu (${format(sansPrix)} L non valorisés)` : 'Aucun plein';
  return sansPrix > 0 ? `${format(Number(cout))} (hors ${format(sansPrix)} L sans prix)` : format(Number(cout));
};

export interface SaisiePropriete {
  propriete: string; proprietaire: string; exploitant: string; transporteur: string; contrat: string; motif: string;
}

/** Controles de saisie repris du serveur (definir_propriete_vehicule). */
export const erreurPropriete = (f: SaisiePropriete, dejaRenseignee: boolean): string | null => {
  if (!(f.propriete in PROPRIETES)) return 'Choisir la propriété';
  if (f.contrat && f.propriete === 'kogon') return 'Un engin Kogon n\'a pas de contrat de location';
  if (dejaRenseignee && !f.motif.trim()) return 'Motif obligatoire pour modifier une propriété renseignée';
  return null;
};
