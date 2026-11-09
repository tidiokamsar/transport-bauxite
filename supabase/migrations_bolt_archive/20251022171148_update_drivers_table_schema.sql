/*
  # Update Drivers Table Schema

  1. Changes
    - Add missing columns to drivers table:
      - `name` (text) - Nom complet du chauffeur
      - `phone` (text) - Numéro de téléphone
      - `email` (text) - Email
      - `birth_date` (date) - Date de naissance
      - `address` (text) - Adresse
      - `emergency_contact_name` (text) - Nom du contact d'urgence
      - `emergency_contact_phone` (text) - Téléphone du contact d'urgence
      - `employee_id` (text) - Numéro d'identification employé
      - `notes` (text) - Notes

  2. Notes
    - profile_id links to profiles table for user association
    - Existing columns: license_number, license_category, license_expiry, hire_date, contract_type, base_salary, status, health_certificate_expiry
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'name') THEN
    ALTER TABLE drivers ADD COLUMN name text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'phone') THEN
    ALTER TABLE drivers ADD COLUMN phone text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'email') THEN
    ALTER TABLE drivers ADD COLUMN email text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'birth_date') THEN
    ALTER TABLE drivers ADD COLUMN birth_date date;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'address') THEN
    ALTER TABLE drivers ADD COLUMN address text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'emergency_contact_name') THEN
    ALTER TABLE drivers ADD COLUMN emergency_contact_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'emergency_contact_phone') THEN
    ALTER TABLE drivers ADD COLUMN emergency_contact_phone text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'employee_id') THEN
    ALTER TABLE drivers ADD COLUMN employee_id text UNIQUE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'notes') THEN
    ALTER TABLE drivers ADD COLUMN notes text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_drivers_employee_id ON drivers(employee_id);
CREATE INDEX IF NOT EXISTS idx_drivers_name ON drivers(name);
