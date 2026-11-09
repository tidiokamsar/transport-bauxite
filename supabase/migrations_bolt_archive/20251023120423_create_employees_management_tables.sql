/*
  # Gestion des Employés - Tables Principales

  1. Nouvelles Tables
    - `departments` : Départements
      - `id` (uuid, clé primaire)
      - `name` (text) : Nom du département
      - `description` (text)
      - `created_at` (timestamp)
    
    - `employees` : Employés
      - `id` (uuid, clé primaire)
      - `employee_number` (text, unique) : Matricule
      - `first_name` (text) : Prénom
      - `last_name` (text) : Nom
      - `department_id` (uuid) : Département
      - `position` (text) : Poste
      - `hire_date` (date) : Date d'embauche
      - `base_salary` (numeric) : Salaire de base
      - `phone` (text) : Téléphone
      - `email` (text) : Email
      - `address` (text) : Adresse
      - `status` (enum) : active, on_leave, terminated
      - `notes` (text)
      - `created_at` (timestamp)
    
    - `attendance` : Présences/Absences
      - `id` (uuid, clé primaire)
      - `employee_id` (uuid) : Employé
      - `date` (date) : Date
      - `status` (enum) : present, absent, leave, sick
      - `check_in` (time) : Heure arrivée
      - `check_out` (time) : Heure départ
      - `notes` (text)

  2. Sécurité
    - RLS activé sur toutes les tables
    - Policies pour utilisateurs authentifiés
*/

-- Enum pour statut employé
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employee_status') THEN
    CREATE TYPE employee_status AS ENUM ('active', 'on_leave', 'terminated');
  END IF;
END $$;

-- Enum pour statut présence
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
    CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'leave', 'sick');
  END IF;
END $$;

-- Table des départements
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Table des employés
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  department_id uuid REFERENCES departments(id),
  position text NOT NULL,
  hire_date date NOT NULL,
  base_salary numeric DEFAULT 0,
  phone text,
  email text,
  address text,
  status employee_status DEFAULT 'active',
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Table des présences
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  date date NOT NULL,
  status attendance_status DEFAULT 'present',
  check_in time,
  check_out time,
  notes text,
  UNIQUE(employee_id, date)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);

-- RLS
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Policies departments
CREATE POLICY "Users can view departments"
  ON departments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert departments"
  ON departments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update departments"
  ON departments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies employees
CREATE POLICY "Users can view employees"
  ON employees FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert employees"
  ON employees FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update employees"
  ON employees FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete employees"
  ON employees FOR DELETE
  TO authenticated
  USING (true);

-- Policies attendance
CREATE POLICY "Users can view attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert attendance"
  ON attendance FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update attendance"
  ON attendance FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete attendance"
  ON attendance FOR DELETE
  TO authenticated
  USING (true);
