/*
  # Gestion des Stocks - Tables Principales

  1. Nouvelles Tables
    - `stock_categories` : Catégories d'articles
      - `id` (uuid, clé primaire)
      - `name` (text) : Nom de la catégorie
      - `description` (text) : Description
      - `created_at` (timestamp)
    
    - `stock_items` : Articles en stock
      - `id` (uuid, clé primaire)
      - `code` (text, unique) : Code article
      - `name` (text) : Nom de l'article
      - `description` (text) : Description
      - `category_id` (uuid) : Catégorie
      - `warehouse_location` (text) : Emplacement entrepôt
      - `unit` (text) : Unité de mesure (pièce, litre, kg, etc.)
      - `quantity` (numeric) : Quantité en stock
      - `min_quantity` (numeric) : Seuil minimum
      - `unit_price` (numeric) : Prix unitaire
      - `status` (enum) : active, discontinued
      - `created_at`, `updated_at` (timestamp)
    
    - `stock_movements` : Mouvements de stock
      - `id` (uuid, clé primaire)
      - `item_id` (uuid) : Article
      - `movement_type` (enum) : entry, exit, adjustment, transfer
      - `quantity` (numeric) : Quantité (+ ou -)
      - `previous_quantity` (numeric) : Quantité avant
      - `new_quantity` (numeric) : Quantité après
      - `reference` (text) : Référence document
      - `reason` (text) : Raison du mouvement
      - `performed_by` (uuid) : Utilisateur
      - `performed_at` (timestamp)
      - `notes` (text)

  2. Sécurité
    - RLS activé sur toutes les tables
    - Policies pour lecture/écriture par utilisateurs authentifiés
*/

-- Enum pour statut d'article
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_item_status') THEN
    CREATE TYPE stock_item_status AS ENUM ('active', 'discontinued');
  END IF;
END $$;

-- Enum pour type de mouvement
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_movement_type') THEN
    CREATE TYPE stock_movement_type AS ENUM ('entry', 'exit', 'adjustment', 'transfer');
  END IF;
END $$;

-- Table des catégories
CREATE TABLE IF NOT EXISTS stock_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Table des articles
CREATE TABLE IF NOT EXISTS stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  category_id uuid REFERENCES stock_categories(id),
  warehouse_location text,
  unit text NOT NULL DEFAULT 'pièce',
  quantity numeric DEFAULT 0,
  min_quantity numeric DEFAULT 0,
  unit_price numeric DEFAULT 0,
  status stock_item_status DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des mouvements
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES stock_items(id) ON DELETE CASCADE,
  movement_type stock_movement_type NOT NULL,
  quantity numeric NOT NULL,
  previous_quantity numeric NOT NULL,
  new_quantity numeric NOT NULL,
  reference text,
  reason text,
  performed_by uuid REFERENCES auth.users(id),
  performed_at timestamptz DEFAULT now(),
  notes text
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_stock_items_code ON stock_items(code);
CREATE INDEX IF NOT EXISTS idx_stock_items_category ON stock_items(category_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_status ON stock_items(status);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(performed_at);

-- Trigger pour update automatique
CREATE OR REPLACE FUNCTION update_stock_item_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_stock_items_timestamp'
  ) THEN
    CREATE TRIGGER update_stock_items_timestamp
      BEFORE UPDATE ON stock_items
      FOR EACH ROW
      EXECUTE FUNCTION update_stock_item_timestamp();
  END IF;
END $$;

-- RLS
ALTER TABLE stock_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Policies pour stock_categories
CREATE POLICY "Users can view categories"
  ON stock_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert categories"
  ON stock_categories FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update categories"
  ON stock_categories FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies pour stock_items
CREATE POLICY "Users can view items"
  ON stock_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert items"
  ON stock_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update items"
  ON stock_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete items"
  ON stock_items FOR DELETE
  TO authenticated
  USING (true);

-- Policies pour stock_movements
CREATE POLICY "Users can view movements"
  ON stock_movements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert movements"
  ON stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (true);
