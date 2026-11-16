// Organisation et administration (D-064) : libelles et regles d'affichage
// des affectations multisites, delegations, journal de connexion. Les
// regles qui comptent sont appliquees par le serveur (site_permis,
// has_module_*, deleguer_droit) ; ces fonctions ne font qu'afficher.

export const LIBELLES_MODULES: Record<string, string> = {
  dashboard: 'Tableau de bord',
  vehicles: 'Véhicules et engins',
  drivers: 'Chauffeurs',
  trips: 'Voyages et fiches terrain',
  gps_tracking: 'Suivi GPS',
  geofencing: 'Géorepérage',
  fuel: 'Carburant',
  maintenance: 'Maintenance',
  stock: 'Stocks',
  purchases: 'Achats et fournisseurs',
  invoices: 'Facturation',
  hr: 'Ressources humaines',
  costs: 'Coûts',
  reports: 'Rapports',
  settings: 'Paramètres',
  contracts: 'Contrats et finance',
  planning: 'Planification',
  iot: 'Capteurs IoT',
  esg: 'Environnement (ESG)',
  client_portal: 'Portail client',
  ai_analytics: 'Analyses IA',
};

export const libelleModule = (module: string) => LIBELLES_MODULES[module] ?? module;

/** Modules qui ne se delegent pas (administration, D-064). */
export const MODULES_NON_DELEGABLES = ['settings'];

export interface AffectationSite {
  id: string;
  utilisateur: string;
  site_id: string;
  site_nom: string | null;
  debut: string;
  fin: string | null;
  annulee_le: string | null;
  statut: 'en_cours' | 'a_venir' | 'terminee' | 'annulee';
}

export type Perimetre =
  | { type: 'global' }
  | { type: 'sites'; sites: string[] }
  | { type: 'aucun' };

/**
 * Perimetre d'un compte calcule par le serveur (`perimetres_comptes`, meme
 * regle que site_permis). Un compte affecte ne redevient jamais global de
 * lui-meme (expiration ou annulation de toutes ses affectations) : seul un
 * retour explicite de l'administrateur (`retablir_perimetre_global`) le rend
 * global.
 */
export interface PerimetreServeur {
  utilisateur: string;
  nom: string | null;
  statut: string;
  site_profil: string | null;
  global: boolean;
  sites: string[] | null;
  retour_possible: boolean;
  dernier_retour: string | null;
}

/** Lecture du perimetre serveur pour l'affichage (aucune regle recalculee). */
export const perimetreCompte = (p: Pick<PerimetreServeur, 'global' | 'sites'>): Perimetre => {
  if (p.global) return { type: 'global' };
  const sites = p.sites ?? [];
  return sites.length === 0 ? { type: 'aucun' } : { type: 'sites', sites };
};

export const LIBELLES_STATUT_AFFECTATION: Record<AffectationSite['statut'], string> = {
  en_cours: 'En cours',
  a_venir: 'À venir',
  terminee: 'Terminée',
  annulee: 'Annulée',
};

export type StatutDelegation = 'active' | 'a_venir' | 'expiree' | 'revoquee' | 'sans_effet';

export const LIBELLES_STATUT_DELEGATION: Record<StatutDelegation, string> = {
  active: 'En vigueur',
  a_venir: 'À venir',
  expiree: 'Expirée',
  revoquee: 'Révoquée',
  sans_effet: 'Sans effet',
};

/** Seule l'ecriture se delegue (D-064, revue C1 : l'approbation deleguee
 * contournait la separation des taches) ; la lecture l'accompagne. */
export const LIBELLES_NIVEAU_DELEGATION: Record<string, string> = {
  ecriture: 'Écriture',
};

/** Une delegation se revoque tant qu'elle n'est ni expiree ni revoquee. */
export const delegationRevocable = (statut: StatutDelegation) =>
  statut === 'active' || statut === 'a_venir' || statut === 'sans_effet';

/** Controle de saisie (le serveur refait chaque controle). */
export const erreurDelegation = (
  f: { delegue: string; module: string; niveau: string; debut: string; fin: string; motif: string },
  maintenant: Date,
): string | null => {
  if (!f.delegue) return 'Choisissez le compte délégué.';
  if (!f.module) return 'Choisissez le module.';
  if (MODULES_NON_DELEGABLES.includes(f.module)) return 'L\'administration ne se délègue pas.';
  if (f.niveau === 'approbation') return 'L\'approbation ne se délègue pas.';
  if (f.niveau !== 'ecriture') return 'Niveau : écriture seulement.';
  if (!f.motif.trim()) return 'Le motif est obligatoire.';
  const fin = new Date(f.fin);
  if (!f.fin || Number.isNaN(fin.getTime())) return 'Date de fin obligatoire.';
  const debut = f.debut ? new Date(f.debut) : maintenant;
  if (Number.isNaN(debut.getTime())) return 'Date de début invalide.';
  if (debut < maintenant && f.debut) return 'Le début ne peut pas être dans le passé (vide : maintenant).';
  if (fin <= debut || fin <= maintenant) return 'La fin doit suivre le début et l\'instant présent.';
  return null;
};

/** Evenements GoTrue (auth.audit_log_entries, v2.197.0) : libelle lisible. */
export const LIBELLES_EVENEMENTS: Record<string, string> = {
  login: 'Connexion',
  logout: 'Déconnexion',
  token_refreshed: 'Session renouvelée',
  token_revoked: 'Session révoquée',
  user_signedup: 'Inscription',
  user_invited: 'Invitation',
  invite_accepted: 'Invitation acceptée',
  user_deleted: 'Compte supprimé',
  user_modified: 'Compte modifié',
  user_updated_password: 'Mot de passe modifié',
  user_recovery_requested: 'Récupération demandée',
  user_reauthenticate_requested: 'Réauthentification demandée',
  user_confirmation_requested: 'Confirmation demandée',
  user_repeated_signup: 'Inscription répétée',
  factor_in_progress: 'Facteur MFA en cours d\'inscription',
  factor_unenrolled: 'Facteur MFA retiré',
  challenge_created: 'Défi MFA créé',
  verification_attempted: 'Vérification MFA',
  factor_deleted: 'Facteur MFA supprimé',
  factor_updated: 'Facteur MFA modifié',
  identity_linked: 'Identité liée',
  identity_unlinked: 'Identité déliée',
};

export const libelleEvenement = (action: string | null) =>
  action ? LIBELLES_EVENEMENTS[action] ?? action : 'Sans donnée';

/** Filtre « connexions » : ouvertures et fermetures de session seulement. */
export const EVENEMENTS_CONNEXION = ['login', 'logout'];
