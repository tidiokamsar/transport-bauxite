/*
  # Gestion des Coûts - Tables Principales

  1. Nouvelles Tables
    - `cost_categories` : Catégories de dépenses
      - `id` (uuid, clé primaire)
      - `name` (text) : Nom de la catégorie
      - `type` (enum) : fixed, variable
      - `description` (text)
      - `created_at` (timestamp)
    
    - `costs` : Dépenses et charges
      - `id` (uuid, clé primaire)
      - `date` (date) : Date de la dépense
      - `category_id` (uuid) : Catégorie
      - `vehicle_id` (uuid) : Véhicule concerné (optionnel)
      - `description` (text) : Description
      - `amount` (numeric) : Montant
      - `reference` (text) : Référence document
      - `payment_method` (text) : Moyen de paiement
      - `notes` (text)
      - `created_by` (uuid) : Utilisateur
      - `created_at` (timestamp)

  2. Sécurité
    - RLS activé sur toutes les tables
    - Policies pour utilisateurs authentifiés
*/

-- Enum pour type de catégorie
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cost_category_type') THEN
    CREATE TYPE cost_category_type AS ENUM ('fixed', 'variable');
  END IF;
END $$;

-- Table des catégories de coûts
CREATE TABLE IF NOT EXISTS cost_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type cost_category_type NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Table des coûts
CREATE TABLE IF NOT EXISTS costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  category_id uuid REFERENCES cost_categories(id),
  vehicle_id uuid REFERENCES vehicles(id),
  description text NOT NULL,
  amount numeric NOT NULL,
  reference text,
  payment_method text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_costs_date ON costs(date);
CREATE INDEX IF NOT EXISTS idx_costs_category ON costs(category_id);
CREATE INDEX IF NOT EXISTS idx_costs_vehicle ON costs(vehicle_id);

-- RLS
ALTER TABLE cost_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE costs ENABLE ROW LEVEL SECURITY;

-- Policies pour cost_categories
CREATE POLICY "Users can view cost categories"
  ON cost_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert cost categories"
  ON cost_categories FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update cost categories"
  ON cost_categories FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies pour costs
CREATE POLICY "Users can view costs"
  ON costs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert costs"
  ON costs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update costs"
  ON costs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete costs"
  ON costs FOR DELETE
  TO authenticated
  USING (true);
