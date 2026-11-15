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
 * Perimetre d'un compte, meme regle que site_permis : global sans site au
 * profil ni affectation non annulee ; sinon site du profil plus affectations
 * en cours ; aucun site si toutes sont expirees ou a venir.
 */
export const perimetreCompte = (
  siteProfil: string | null,
  affectations: Pick<AffectationSite, 'site_id' | 'statut'>[],
): Perimetre => {
  const valides = affectations.filter((a) => a.statut !== 'annulee');
  if (!siteProfil && valides.length === 0) return { type: 'global' };
  const sites = new Set<string>();
  if (siteProfil) sites.add(siteProfil);
  for (const a of valides) if (a.statut === 'en_cours') sites.add(a.site_id);
  return sites.size === 0 ? { type: 'aucun' } : { type: 'sites', sites: [...sites] };
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

export const LIBELLES_NIVEAU_DELEGATION: Record<string, string> = {
  ecriture: 'Écriture',
  approbation: 'Approbation',
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
  if (f.niveau !== 'ecriture' && f.niveau !== 'approbation') return 'Niveau : écriture ou approbation.';
  if (!f.motif.trim()) return 'Le motif est obligatoire.';
  const fin = new Date(f.fin);
  if (!f.fin || Number.isNaN(fin.getTime())) return 'Date de fin obligatoire.';
  const debut = f.debut ? new Date(f.debut) : maintenant;
  if (Number.isNaN(debut.getTime())) return 'Date de début invalide.';
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
