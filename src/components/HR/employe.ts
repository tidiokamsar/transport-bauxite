// Registre des employes (D-094) : types, statuts, actions et saisie.
// Ecriture par enregistrer_employe et changer_statut_employe (droit 'hr',
// perimetre de site) ; aucune valeur par defaut inventee.

/** Identifiant de l'ecran dans le menu et dans l'adresse (#/hr-employees/...). */
export const VUE_EMPLOYES = 'hr-employees';

export type StatutEmploye = 'active' | 'on_leave' | 'suspended' | 'terminated';

export interface Employe {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  full_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  national_id: string | null;
  position: string;
  department: string;
  hire_date: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  base_salary: number | null;
  bank_name: string | null;
  bank_account: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  status: StatutEmploye;
  notes: string | null;
  site_id: string | null;
  created_at: string | null;
}

export const STATUTS_EMPLOYE: Record<StatutEmploye, { libelle: string; teinte: 'vert' | 'orange' | 'gris' | 'rouge' }> = {
  active: { libelle: 'Actif', teinte: 'vert' },
  on_leave: { libelle: 'En congé', teinte: 'orange' },
  suspended: { libelle: 'Suspendu', teinte: 'rouge' },
  terminated: { libelle: 'Désactivé', teinte: 'gris' },
};

export const GENRES: Record<string, string> = { male: 'Homme', female: 'Femme', other: 'Autre' };

/** Actions de la fiche ; l'action est le code envoye a changer_statut_employe. */
export const ACTIONS_EMPLOYE = {
  suspendre: { code: 'suspension', depuis: ['active', 'on_leave'], titre: 'Suspendre l\'employé', confirmer: 'Suspendre', succes: 'Employé suspendu.' },
  desactiver: { code: 'desactivation', depuis: ['active', 'on_leave', 'suspended'], titre: 'Désactiver l\'employé', confirmer: 'Désactiver', succes: 'Employé désactivé.' },
  reactiver: { code: 'reactivation', depuis: ['suspended', 'terminated'], titre: 'Réactiver l\'employé', confirmer: 'Réactiver', succes: 'Employé réactivé.' },
} as const satisfies Record<string, { code: string; depuis: readonly StatutEmploye[]; titre: string; confirmer: string; succes: string }>;
export type ActionEmploye = keyof typeof ACTIONS_EMPLOYE;

export const actionEmployePermise = (action: ActionEmploye, statut: StatutEmploye) =>
  (ACTIONS_EMPLOYE[action].depuis as readonly StatutEmploye[]).includes(statut);

export const nomEmploye = (e: Pick<Employe, 'first_name' | 'last_name' | 'full_name'>) => e.full_name ?? `${e.first_name} ${e.last_name}`;

export const CHAMPS_EMPLOYE = [
  'employee_number', 'first_name', 'last_name', 'date_of_birth', 'gender', 'national_id', 'position', 'department',
  'hire_date', 'phone', 'email', 'address', 'base_salary', 'bank_name', 'bank_account',
  'emergency_contact_name', 'emergency_contact_phone', 'notes', 'site_id',
] as const;
export type SaisieEmploye = Record<(typeof CHAMPS_EMPLOYE)[number], string>;

export const saisieDepuisEmploye = (e: Employe | null, siteProfil: string | null): SaisieEmploye => {
  const s = {} as SaisieEmploye;
  for (const c of CHAMPS_EMPLOYE) {
    const v = e ? (e as unknown as Record<string, unknown>)[c] : null;
    s[c] = v === null || v === undefined ? '' : String(v);
  }
  if (!e && siteProfil) s.site_id = siteProfil;
  return s;
};

/** Controles du formulaire, repris du serveur (le serveur reste juge). */
export const erreursEmploye = (f: SaisieEmploye): string[] => {
  const e: string[] = [];
  if (!f.employee_number.trim() || !f.first_name.trim() || !f.last_name.trim() || !f.position.trim() || !f.department.trim() || !f.hire_date) {
    e.push('Matricule, prénom, nom, poste, département et date d\'embauche sont requis.');
  }
  if (f.base_salary.trim() && !/^[0-9]+$/.test(f.base_salary.trim())) e.push('Salaire de base : entier positif en GNF attendu.');
  if (f.date_of_birth && f.hire_date && f.date_of_birth >= f.hire_date) e.push('La date de naissance doit précéder l\'embauche.');
  return e;
};
