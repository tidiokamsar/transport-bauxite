import { dateOuNull, entierOuNull, texteOuNull } from '../../lib/formulaires';

// Corps envoye a la table drivers (D-078) : dates et champs facultatifs
// vides -> null ; site impose pour un profil borne a un site.

/** Identifiant de l'ecran dans le menu et dans l'adresse (#/drivers/..., D-090). */
export const VUE_CHAUFFEURS = 'drivers';

export type StatutChauffeur = 'active' | 'suspended' | 'terminated';

/** Ligne de la table drivers lue par le registre et la fiche. */
export interface Chauffeur {
  id: string;
  name: string;
  employee_id: string | null;
  phone: string | null;
  email: string | null;
  hire_date: string;
  birth_date: string | null;
  license_number: string;
  license_category: string;
  license_expiry: string;
  health_certificate_expiry: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  contract_type: string;
  base_salary: number | null;
  status: StatutChauffeur;
  notes: string | null;
  site_id?: string | null;
  created_at?: string | null;
}

export const STATUTS_CHAUFFEUR: Record<StatutChauffeur, { libelle: string; teinte: 'vert' | 'orange' | 'gris' }> = {
  active: { libelle: 'Actif', teinte: 'vert' },
  suspended: { libelle: 'Suspendu', teinte: 'orange' },
  terminated: { libelle: 'Archivé', teinte: 'gris' },
};

export const CONTRATS_CHAUFFEUR: Record<string, string> = { permanent: 'Permanent', contract: 'Contrat', temporary: 'Temporaire' };

/**
 * Changements de statut du dossier en pleine page (D-090). Aucune fonction
 * serveur dediee : mise a jour de drivers.status sous RLS (droit drivers),
 * comme l'ancien ecran ; le serveur refuse l'archivage pendant un voyage en
 * cours (D-061).
 */
export const ACTIONS_CHAUFFEUR = {
  suspendre: { statut: 'suspended', depuis: ['active'], titre: 'Suspendre le dossier', confirmer: 'Suspendre', succes: 'Dossier suspendu.' },
  reactiver: { statut: 'active', depuis: ['suspended', 'terminated'], titre: 'Réactiver le dossier', confirmer: 'Réactiver', succes: 'Dossier réactivé.' },
  archiver: { statut: 'terminated', depuis: ['active', 'suspended'], titre: 'Archiver le dossier', confirmer: 'Archiver le dossier', succes: 'Dossier archivé.' },
} as const satisfies Record<string, { statut: StatutChauffeur; depuis: readonly StatutChauffeur[]; titre: string; confirmer: string; succes: string }>;
export type ActionChauffeur = keyof typeof ACTIONS_CHAUFFEUR;

export const actionChauffeurPermise = (action: ActionChauffeur, statut: StatutChauffeur) =>
  (ACTIONS_CHAUFFEUR[action].depuis as readonly StatutChauffeur[]).includes(statut);

/** Ecart en jours entre une date AAAA-MM-JJ et aujourd'hui (jour local). */
export const joursAvant = (dateIso: string, aujourdhui: Date) => {
  const [a, m, j] = dateIso.slice(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(a, m - 1, j) - Date.UTC(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate())) / 86_400_000);
};

export const saisieDepuisChauffeur = (d: Chauffeur | null, siteProfil: string | null): SaisieChauffeur => ({
  name: d?.name ?? '', employee_id: d?.employee_id ?? '', phone: d?.phone ?? '', email: d?.email ?? '',
  hire_date: d?.hire_date ?? '', birth_date: d?.birth_date ?? '', license_number: d?.license_number ?? '',
  license_category: d?.license_category ?? 'C', license_expiry: d?.license_expiry ?? '',
  health_certificate_expiry: d?.health_certificate_expiry ?? '', address: d?.address ?? '',
  emergency_contact_name: d?.emergency_contact_name ?? '', emergency_contact_phone: d?.emergency_contact_phone ?? '',
  contract_type: d?.contract_type ?? 'permanent', base_salary: d?.base_salary ?? '', status: d?.status ?? 'active',
  notes: d?.notes ?? '', site_id: d?.site_id ?? siteProfil ?? '',
});

export interface SaisieChauffeur {
  [cle: string]: string | number;
  name: string;
  employee_id: string;
  phone: string;
  email: string;
  hire_date: string;
  birth_date: string;
  license_number: string;
  license_category: string;
  license_expiry: string;
  health_certificate_expiry: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  contract_type: string;
  base_salary: string | number;
  status: 'active' | 'suspended' | 'terminated';
  notes: string;
  site_id: string;
}

/** Site retenu : celui du profil s'il est borne, sinon le choix (vide = global). */
export const siteChauffeur = (choix: string, siteProfil: string | null | undefined): string | null =>
  siteProfil ? siteProfil : (choix.trim() === '' ? null : choix);

export const corpsChauffeur = (f: SaisieChauffeur, siteProfil: string | null | undefined) => {
  // Salaire en GNF : entier, jamais arrondi (D-078).
  const { valeur: salaire, erreur: erreurSalaire } = entierOuNull(f.base_salary, 'Salaire de base (GNF)');
  if (erreurSalaire) return { corps: null, erreur: erreurSalaire };
  if (salaire !== null && salaire < 0) {
    return { corps: null, erreur: 'Salaire de base : nombre positif attendu' };
  }
  if (!f.name.trim() || !f.license_number.trim() || !dateOuNull(f.license_expiry) || !dateOuNull(f.hire_date)) {
    return { corps: null, erreur: 'Nom, numéro de permis, expiration du permis et date d\'embauche sont requis' };
  }
  return {
    erreur: null,
    corps: {
      name: f.name.trim(),
      employee_id: texteOuNull(f.employee_id),
      phone: texteOuNull(f.phone),
      email: texteOuNull(f.email),
      hire_date: dateOuNull(f.hire_date),
      birth_date: dateOuNull(f.birth_date),
      license_number: f.license_number.trim(),
      license_category: f.license_category,
      license_expiry: dateOuNull(f.license_expiry),
      health_certificate_expiry: dateOuNull(f.health_certificate_expiry),
      address: texteOuNull(f.address),
      emergency_contact_name: texteOuNull(f.emergency_contact_name),
      emergency_contact_phone: texteOuNull(f.emergency_contact_phone),
      contract_type: f.contract_type,
      base_salary: salaire,
      status: f.status,
      notes: texteOuNull(f.notes),
      site_id: siteChauffeur(f.site_id, siteProfil),
    },
  };
};
