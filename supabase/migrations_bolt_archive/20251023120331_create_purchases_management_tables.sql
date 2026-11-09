/*
  # Gestion des Achats - Tables Principales

  1. Nouvelles Tables
    - `suppliers` : Fournisseurs
      - `id` (uuid, clé primaire)
      - `name` (text) : Nom du fournisseur
      - `contact_person` (text) : Personne de contact
      - `phone` (text) : Téléphone
      - `email` (text) : Email
      - `address` (text) : Adresse
      - `notes` (text)
      - `active` (boolean)
      - `created_at` (timestamp)
    
    - `purchase_orders` : Bons de commande
      - `id` (uuid, clé primaire)
      - `order_number` (text, unique) : Numéro BC
      - `supplier_id` (uuid) : Fournisseur
      - `order_date` (date) : Date commande
      - `expected_delivery` (date) : Livraison prévue
      - `actual_delivery` (date) : Livraison réelle
      - `status` (enum) : pending, received, cancelled
      - `total_amount` (numeric) : Montant total
      - `notes` (text)
      - `created_by` (uuid)
      - `created_at` (timestamp)
    
    - `purchase_order_items` : Lignes de commande
      - `id` (uuid, clé primaire)
      - `order_id` (uuid) : Bon de commande
      - `item_description` (text) : Description
      - `quantity` (numeric) : Quantité
      - `unit_price` (numeric) : Prix unitaire
      - `total_price` (numeric) : Prix total

  2. Sécurité
    - RLS activé sur toutes les tables
    - Policies pour utilisateurs authentifiés
*/

-- Enum pour statut de commande
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchase_order_status') THEN
    CREATE TYPE purchase_order_status AS ENUM ('pending', 'received', 'cancelled');
  END IF;
END $$;

-- Table des fournisseurs
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  notes text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Table des bons de commande
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  supplier_id uuid REFERENCES suppliers(id),
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery date,
  actual_delivery date,
  status purchase_order_status DEFAULT 'pending',
  total_amount numeric DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Table des lignes de commande
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_description text NOT NULL,
  quantity numeric NOT NULL,
  unit_price numeric NOT NULL,
  total_price numeric NOT NULL
);

-- Index
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order ON purchase_order_items(order_id);

-- RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Policies suppliers
CREATE POLICY "Users can view suppliers"
  ON suppliers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert suppliers"
  ON suppliers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update suppliers"
  ON suppliers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies purchase_orders
CREATE POLICY "Users can view purchase orders"
  ON purchase_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert purchase orders"
  ON purchase_orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update purchase orders"
  ON purchase_orders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete purchase orders"
  ON purchase_orders FOR DELETE
  TO authenticated
  USING (true);

-- Policies purchase_order_items
CREATE POLICY "Users can view order items"
  ON purchase_order_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert order items"
  ON purchase_order_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update order items"
  ON purchase_order_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete order items"
  ON purchase_order_items FOR DELETE
  TO authenticated
  USING (true);
