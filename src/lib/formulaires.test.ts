import { describe, expect, it } from 'vitest';
import { dateOuNull, entierOuNull, nombreOuNull, texteOuNull } from './formulaires';
import { corpsChauffeur, siteChauffeur, type SaisieChauffeur } from '../components/Drivers/chauffeur';

describe('conversions de formulaire (D-078)', () => {
  it('une saisie vide devient null, jamais une chaine vide', () => {
    expect(dateOuNull('')).toBeNull();
    expect(dateOuNull('  ')).toBeNull();
    expect(dateOuNull('2026-11-16')).toBe('2026-11-16');
    expect(texteOuNull(' ')).toBeNull();
    expect(nombreOuNull('')).toBeNull();
    expect(nombreOuNull('12,5')).toBe(12.5);
    expect(Number.isNaN(nombreOuNull('12a') as number)).toBe(true);
  });

  it('montant entier : decimales refusees avec un message, pas arrondies', () => {
    expect(entierOuNull('150000', 'Coût')).toEqual({ valeur: 150000, erreur: null });
    expect(entierOuNull('', 'Coût')).toEqual({ valeur: null, erreur: null });
    expect(entierOuNull('1500,5', 'Coût').erreur).toMatch(/entier/);
    expect(entierOuNull('abc', 'Coût').erreur).toMatch(/illisible/);
  });
});

describe('chauffeur (D-078)', () => {
  const base: SaisieChauffeur = {
    name: 'Mamadou Diallo', employee_id: '', phone: '', email: '', hire_date: '2026-11-01', birth_date: '',
    license_number: 'GN-123', license_category: 'C', license_expiry: '2028-01-01', health_certificate_expiry: '',
    address: '', emergency_contact_name: '', emergency_contact_phone: '', contract_type: 'permanent',
    base_salary: '', status: 'active', notes: '', site_id: '',
  };

  it('creation sans dates facultatives : null envoye', () => {
    const { corps, erreur } = corpsChauffeur(base, null);
    expect(erreur).toBeNull();
    expect(corps?.birth_date).toBeNull();
    expect(corps?.health_certificate_expiry).toBeNull();
    expect(corps?.employee_id).toBeNull();
    expect(corps?.base_salary).toBeNull();
    expect(corps?.site_id).toBeNull();
  });

  it('site impose au profil borne, choix libre pour un profil global', () => {
    expect(siteChauffeur('', 'site-1')).toBe('site-1');
    expect(siteChauffeur('site-2', 'site-1')).toBe('site-1');
    expect(siteChauffeur('site-2', null)).toBe('site-2');
    expect(siteChauffeur('', null)).toBeNull();
  });

  it('champs requis et salaire controles', () => {
    expect(corpsChauffeur({ ...base, license_expiry: '' }, null).erreur).toMatch(/requis/);
    expect(corpsChauffeur({ ...base, base_salary: '-5' }, null).erreur).toMatch(/Salaire/);
    expect(corpsChauffeur({ ...base, base_salary: '1500000,5' }, null).erreur).toMatch(/Salaire.*entier/);
    expect(corpsChauffeur({ ...base, base_salary: '1 500 000' }, null).corps?.base_salary).toBe(1500000);
  });
});
