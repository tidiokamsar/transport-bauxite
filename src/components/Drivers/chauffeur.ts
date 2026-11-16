import { dateOuNull, entierOuNull, texteOuNull } from '../../lib/formulaires';

// Corps envoye a la table drivers (D-078) : dates et champs facultatifs
// vides -> null ; site impose pour un profil borne a un site.

export interface SaisieChauffeur {
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
