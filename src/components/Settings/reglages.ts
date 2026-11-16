// Parametres generaux (D-061) : seules les cles de `settings` reellement
// lues par les fonctions serveur sont proposees, avec leur effet et le
// comportement applique quand la cle est absente. Le format est controle
// par le declencheur `valider_reglage` (migration 20261118180000).

export type TypeReglage = 'booleen' | 'nombre' | 'entier';

export interface Reglage {
  cle: string;
  libelle: string;
  type: TypeReglage;
  /** Effet reel, tel que code dans la fonction serveur qui lit la cle. */
  effet: string;
  /** Comportement du serveur quand la cle est absente. */
  siAbsent: string;
  /** Lecteur cote serveur (fonction SQL) et decision de reference. */
  lecteur: string;
  unite?: string;
  /** Ecran dedie qui gere deja ce reglage (lecture seule ici). */
  ecran?: { vue: string; libelle: string };
}

export const REGLAGES: Reglage[] = [
  {
    cle: 'mfa_exige', libelle: 'Double authentification exigée', type: 'booleen',
    effet: 'Les droits par utilisateur, les rectifications de tickets et la signature de facture exigent une session à double authentification (aal2).',
    siAbsent: 'Non exigée.', lecteur: 'garde_aal2 (D-040)',
    ecran: { vue: 'securite-compte', libelle: 'Menu du compte > Sécurité du compte' },
  },
  {
    cle: 'carburant_validation_separee', libelle: 'Carburant : validation par une autre personne', type: 'booleen',
    effet: 'Un mouvement ou un inventaire de carburant est validé par une autre personne que son auteur.',
    siAbsent: 'Exigée.', lecteur: 'validation_carburant_separee (D-041)',
  },
  {
    cle: 'kilometrage_validation_separee', libelle: 'Distances : validation par une autre personne', type: 'booleen',
    effet: 'La distance d\'un voyage est validée par une autre personne que l\'auteur des relevés compteur.',
    siAbsent: 'Exigée.', lecteur: 'valider_distance_voyage (D-043)',
  },
  {
    cle: 'achats_validation_separee', libelle: 'Achats : approbation par une autre personne', type: 'booleen',
    effet: 'Le demandeur d\'un bon de commande ne peut pas l\'approuver.',
    siAbsent: 'Exigée.', lecteur: 'decider_bon_commande (D-053)',
  },
  {
    cle: 'paiements_validation_separee', libelle: 'Paiements : approbation par une autre personne', type: 'booleen',
    effet: 'Le proposant d\'un paiement fournisseur ne peut pas l\'approuver.',
    siAbsent: 'Exigée.', lecteur: 'decider_paiement (D-055)',
  },
  {
    cle: 'planification_cloture_separee', libelle: 'Planification : clôture par une autre personne', type: 'booleen',
    effet: 'La clôture de planification d\'une journée et d\'un site revient à une autre personne que l\'auteur des objectifs en vigueur.',
    siAbsent: 'Non exigée.', lecteur: 'cloturer_planification (D-063)',
  },
  {
    cle: 'clauses_renonciation_separee', libelle: 'Clauses : renonciation par une autre personne', type: 'booleen',
    effet: 'Écarter une pénalité, un bonus ou une retenue calculé revient à une personne qui a le droit d\'approbation des contrats et qui n\'a pas calculé la proposition. L\'application d\'une clause reste soumise à la signature de la facture par le Directeur Général.',
    siAbsent: 'Exigée.', lecteur: 'decider_clause (D-065)',
  },
  {
    cle: 'controle_depart_exige', libelle: 'Contrôle avant départ exigé', type: 'booleen',
    effet: 'Un camion ne passe au chargement qu\'avec un contrôle avant départ du jour qui n\'est pas non conforme.',
    siAbsent: 'Non exigé.', lecteur: 'garde_controle_depart sur trip_events (D-054)',
    ecran: { vue: 'controles-depart', libelle: 'RH & Sécurité > Contrôles avant départ' },
  },
  {
    cle: 'tolerance_poids_cbg_t', libelle: 'Tolérance de poids CBG', type: 'nombre', unite: 't',
    effet: 'Écart de poids net accepté entre le relevé CBG et le ticket SIGTB avant de signaler un écart de poids.',
    siAbsent: '0 t : tout écart est signalé.', lecteur: 'rapprocher_releve_cbg (D-050)',
  },
  {
    cle: 'pneu_profondeur_min_mm', libelle: 'Pneus : profondeur minimale', type: 'nombre', unite: 'mm',
    effet: 'Un pneu dont la dernière profondeur mesurée est inférieure apparaît dans les pneus à surveiller.',
    siAbsent: 'Aucune alerte de profondeur.', lecteur: 'seuil_pneus, v_pneus_a_surveiller (D-052)',
    ecran: { vue: 'tires', libelle: 'Pneus' },
  },
  {
    cle: 'pneu_inspection_max_jours', libelle: 'Pneus : délai maximal entre inspections', type: 'nombre', unite: 'jours',
    effet: 'Un pneu dont la dernière inspection est plus ancienne apparaît dans les pneus à surveiller.',
    siAbsent: 'Aucune alerte d\'inspection.', lecteur: 'seuil_pneus, v_pneus_a_surveiller (D-052)',
    ecran: { vue: 'tires', libelle: 'Pneus' },
  },
  {
    cle: 'pneu_reforme_precoce_km', libelle: 'Pneus : seuil de réforme précoce', type: 'nombre', unite: 'km',
    effet: 'Un pneu réformé avec moins de km parcourus compte comme réforme précoce dans la performance par marque et modèle.',
    siAbsent: 'Taux de réforme précoce sans données.', lecteur: 'seuil_pneus, v_pneus_performance (D-067)',
    ecran: { vue: 'tires', libelle: 'Pneus' },
  },
  {
    cle: 'fournisseurs_alerte_documents_jours', libelle: 'Fournisseurs : alerte avant expiration des documents', type: 'entier', unite: 'jours',
    effet: 'Un document administratif de fournisseur apparaît « à renouveler » quand il expire dans ce délai (aucun blocage automatique).',
    siAbsent: '30 jours.', lecteur: 'reglage_entier, v_documents_fournisseurs_echeance (D-059)',
  },
  {
    cle: 'consultation_offres_minimum', libelle: 'Consultations : nombre minimal d\'offres', type: 'entier', unite: 'offres',
    effet: 'Une offre ne peut être retenue qu\'après réception de ce nombre d\'offres actives dans la consultation.',
    siAbsent: '1 offre : aucune mise en concurrence imposée.', lecteur: 'reglage_entier, selectionner_offre (D-059)',
  },
  {
    cle: 'contrats_alerte_echeance_jours', libelle: 'Contrats : alerte avant échéance', type: 'entier', unite: 'jours',
    effet: 'Une échéance de contrat (limite de préavis, puis date de fin) apparaît dans Mes validations ce nombre de jours avant la date clé (aucun blocage, aucun renouvellement automatique).',
    siAbsent: '0 jour : alerte à la date clé seulement.', lecteur: 'delai_alerte_echeances_contrats, v_echeances_contrats (D-065)',
  },
];

export const CLES_REGLAGES = REGLAGES.map((r) => r.cle);

/** Valeur stockee (settings.value.value) lisible pour l'ecran. */
export const valeurAffichee = (r: Reglage, brute: string | undefined): string => {
  if (brute === undefined) return `Absent : ${r.siAbsent}`;
  if (r.type === 'booleen') return brute === 'true' ? 'Oui' : brute === 'false' ? 'Non' : `Valeur invalide (${brute})`;
  return r.unite ? `${brute} ${r.unite}` : brute;
};

/** Meme regle que valider_reglage cote serveur. */
export const valeurValide = (r: Reglage, saisie: string): boolean =>
  r.type === 'booleen' ? saisie === 'true' || saisie === 'false'
    : r.type === 'entier' ? /^\d+$/.test(saisie.trim()) && (r.cle !== 'consultation_offres_minimum' || Number(saisie) >= 1)
    : /^\d+(\.\d+)?$/.test(saisie.trim());
