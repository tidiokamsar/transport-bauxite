/*
  # Système avancé de gestion des pneus (Module minerais Guinée)
  
  1. Nouvelles tables
    - `tire_suppliers` - Fournisseurs de pneus avec lead times
    - `tire_models` - Modèles de pneus avec specs techniques
    - `tire_installations` - Historique détaillé des installations
    - `tire_removals` - Historique des retraits avec causes
    - `tire_retreads` - Suivi des rechapages
    - `tire_transfers` - Transferts inter-sites
    - `tire_inventory` - Stock par site
    - `tire_po` - Commandes de pneus
    - `tire_po_items` - Lignes de commande
    - `tire_usage_logs` - Logs d'utilisation (tonnage, km)
    - `tire_alerts` - Alertes automatiques ROP
  
  2. Modifications tables existantes
    - Enrichissement table `tires` avec retread tracking
  
  3. Sécurité
    - Enable RLS sur toutes les nouvelles tables
    - Policies pour lecture/écriture authentifiée
*/

-- Table fournisseurs pneus enrichie
CREATE TABLE IF NOT EXISTS tire_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_info jsonb,
  is_local_importer boolean DEFAULT false,
  lead_time_port_to_site_days int DEFAULT 30,
  quality_rating numeric(3,2),
  notes text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table modèles de pneus
CREATE TABLE IF NOT EXISTS tire_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES tire_suppliers(id),
  model_name text NOT NULL,
  sku text UNIQUE,
  dimension text,
  load_index int,
  speed_rating text,
  pattern_type text,
  price_unit numeric(10,2),
  max_retreads int DEFAULT 2,
  warranty_days int DEFAULT 365,
  recommended_pressure_psi numeric(5,2),
  specs jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enrichir la table tires existante avec nouvelles colonnes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tires' AND column_name = 'tire_model_id') THEN
    ALTER TABLE tires ADD COLUMN tire_model_id uuid REFERENCES tire_models(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tires' AND column_name = 'lot_code') THEN
    ALTER TABLE tires ADD COLUMN lot_code text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tires' AND column_name = 'country_origin') THEN
    ALTER TABLE tires ADD COLUMN country_origin text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tires' AND column_name = 'retread_count') THEN
    ALTER TABLE tires ADD COLUMN retread_count int DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tires' AND column_name = 'max_retreads') THEN
    ALTER TABLE tires ADD COLUMN max_retreads int DEFAULT 2;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tires' AND column_name = 'warranty_days') THEN
    ALTER TABLE tires ADD COLUMN warranty_days int DEFAULT 365;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tires' AND column_name = 'import_documents') THEN
    ALTER TABLE tires ADD COLUMN import_documents jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tires' AND column_name = 'qr_code') THEN
    ALTER TABLE tires ADD COLUMN qr_code text UNIQUE;
  END IF;
END $$;

-- Table installations enrichie
CREATE TABLE IF NOT EXISTS tire_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tire_id uuid REFERENCES tires(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id),
  site_id uuid REFERENCES sites(id),
  position text NOT NULL,
  install_date timestamptz DEFAULT now(),
  odometer_install bigint,
  engine_hours_install numeric(10,2),
  estimated_tonnage_tonnes numeric(10,2),
  operator_id uuid REFERENCES drivers(id),
  installation_photo_url text,
  pressure_psi numeric(5,2),
  notes text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'removed', 'failed')),
  created_at timestamptz DEFAULT now()
);

-- Table retraits enrichie
CREATE TABLE IF NOT EXISTS tire_removals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id uuid REFERENCES tire_installations(id) ON DELETE CASCADE,
  removal_date timestamptz DEFAULT now(),
  odometer_removal bigint,
  engine_hours_removal numeric(10,2),
  total_tonnage_tonnes numeric(12,2),
  total_km numeric(10,2),
  removal_reason text NOT NULL,
  tire_condition text,
  tread_depth_mm numeric(4,2),
  damage_photos jsonb,
  repair_cost numeric(10,2),
  is_retreaded boolean DEFAULT false,
  operator_id uuid REFERENCES drivers(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Table rechapages
CREATE TABLE IF NOT EXISTS tire_retreads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tire_id uuid REFERENCES tires(id) ON DELETE CASCADE,
  removal_id uuid REFERENCES tire_removals(id),
  retread_date date,
  retread_supplier text,
  retread_cost numeric(10,2),
  quality_score numeric(3,2),
  tread_depth_new_mm numeric(4,2),
  warranty_days int DEFAULT 180,
  photos jsonb,
  notes text,
  success boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Table transferts inter-sites
CREATE TABLE IF NOT EXISTS tire_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tire_id uuid REFERENCES tires(id) ON DELETE CASCADE,
  from_site_id uuid REFERENCES sites(id),
  to_site_id uuid REFERENCES sites(id),
  transfer_date timestamptz DEFAULT now(),
  quantity int DEFAULT 1,
  reason text,
  transport_ref text,
  received_date timestamptz,
  received_by uuid REFERENCES auth.users(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'received', 'cancelled')),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Table inventaire pneus par site
CREATE TABLE IF NOT EXISTS tire_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id),
  tire_model_id uuid REFERENCES tire_models(id),
  quantity int DEFAULT 0,
  location_code text,
  condition text DEFAULT 'new' CHECK (condition IN ('new', 'used', 'retreaded', 'damaged')),
  minimum_stock int DEFAULT 0,
  reorder_point int DEFAULT 0,
  last_counted_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(site_id, tire_model_id, condition)
);

-- Table commandes pneus
CREATE TABLE IF NOT EXISTS tire_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text UNIQUE NOT NULL,
  supplier_id uuid REFERENCES tire_suppliers(id),
  site_id uuid REFERENCES sites(id),
  order_date date DEFAULT CURRENT_DATE,
  expected_delivery_date date,
  actual_delivery_date date,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partial_received', 'received', 'cancelled')),
  total_amount numeric(12,2),
  currency text DEFAULT 'GNF',
  documents jsonb,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table lignes de commande
CREATE TABLE IF NOT EXISTS tire_po_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid REFERENCES tire_purchase_orders(id) ON DELETE CASCADE,
  tire_model_id uuid REFERENCES tire_models(id),
  quantity_ordered int NOT NULL,
  quantity_received int DEFAULT 0,
  unit_price numeric(10,2),
  lot_code text,
  expected_date date,
  received_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Table logs d'utilisation (tonnage/km par pneu)
CREATE TABLE IF NOT EXISTS tire_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id uuid REFERENCES tire_installations(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES trips(id),
  log_date date DEFAULT CURRENT_DATE,
  distance_km numeric(10,2),
  tonnage_tonnes numeric(10,2),
  route_type text CHECK (route_type IN ('piste', 'route', 'asphalte')),
  season text CHECK (season IN ('pluies', 'seche')),
  avg_speed_kmh numeric(5,2),
  road_condition_score int CHECK (road_condition_score BETWEEN 1 AND 5),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Table alertes automatiques
CREATE TABLE IF NOT EXISTS tire_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL CHECK (alert_type IN ('low_stock', 'reorder_point', 'warranty_expiry', 'max_retreads', 'lot_failure', 'overdue_inspection')),
  severity text DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  site_id uuid REFERENCES sites(id),
  tire_id uuid REFERENCES tires(id),
  tire_model_id uuid REFERENCES tire_models(id),
  message text NOT NULL,
  threshold_value numeric,
  current_value numeric,
  is_acknowledged boolean DEFAULT false,
  acknowledged_by uuid REFERENCES auth.users(id),
  acknowledged_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Table events maintenance pour pneus
CREATE TABLE IF NOT EXISTS tire_maintenance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id uuid REFERENCES tire_installations(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('rotation', 'pressure_check', 'inspection', 'repair', 'balancing')),
  event_date timestamptz DEFAULT now(),
  pressure_before_psi numeric(5,2),
  pressure_after_psi numeric(5,2),
  tread_depth_mm numeric(4,2),
  findings text,
  actions_taken text,
  cost numeric(10,2),
  technician_id uuid REFERENCES drivers(id),
  photos jsonb,
  next_check_date date,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE tire_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_removals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_retreads ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_po_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_maintenance_events ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can read tire suppliers" ON tire_suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage tire suppliers" ON tire_suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read tire models" ON tire_models FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage tire models" ON tire_models FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read tire installations" ON tire_installations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage tire installations" ON tire_installations FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read tire removals" ON tire_removals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage tire removals" ON tire_removals FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read tire retreads" ON tire_retreads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage tire retreads" ON tire_retreads FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read tire transfers" ON tire_transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage tire transfers" ON tire_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read tire inventory" ON tire_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage tire inventory" ON tire_inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read tire purchase orders" ON tire_purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage tire purchase orders" ON tire_purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read tire po items" ON tire_po_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage tire po items" ON tire_po_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read tire usage logs" ON tire_usage_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage tire usage logs" ON tire_usage_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read tire alerts" ON tire_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage tire alerts" ON tire_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read tire maintenance events" ON tire_maintenance_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage tire maintenance events" ON tire_maintenance_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_tire_installations_tire_id ON tire_installations(tire_id);
CREATE INDEX IF NOT EXISTS idx_tire_installations_vehicle_id ON tire_installations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_tire_installations_status ON tire_installations(status);
CREATE INDEX IF NOT EXISTS idx_tire_removals_installation_id ON tire_removals(installation_id);
CREATE INDEX IF NOT EXISTS idx_tire_retreads_tire_id ON tire_retreads(tire_id);
CREATE INDEX IF NOT EXISTS idx_tire_inventory_site_id ON tire_inventory(site_id);
CREATE INDEX IF NOT EXISTS idx_tire_inventory_model_id ON tire_inventory(tire_model_id);
CREATE INDEX IF NOT EXISTS idx_tire_usage_logs_installation_id ON tire_usage_logs(installation_id);
CREATE INDEX IF NOT EXISTS idx_tire_alerts_site_id ON tire_alerts(site_id);
CREATE INDEX IF NOT EXISTS idx_tire_alerts_acknowledged ON tire_alerts(is_acknowledged);

-- Fonction pour calculer coût par tonne-km
CREATE OR REPLACE FUNCTION calculate_tire_cost_per_tonne_km(p_tire_id uuid)
RETURNS numeric AS $$
DECLARE
  v_total_cost numeric := 0;
  v_total_tonne_km numeric := 0;
BEGIN
  SELECT COALESCE(t.purchase_price, 0) +
         COALESCE(SUM(tr.retread_cost), 0) +
         COALESCE(SUM(rem.repair_cost), 0)
  INTO v_total_cost
  FROM tires t
  LEFT JOIN tire_retreads tr ON tr.tire_id = t.id
  LEFT JOIN tire_removals rem ON rem.installation_id IN (
    SELECT id FROM tire_installations WHERE tire_id = t.id
  )
  WHERE t.id = p_tire_id
  GROUP BY t.id, t.purchase_price;

  SELECT COALESCE(SUM(ul.tonnage_tonnes * ul.distance_km), 0)
  INTO v_total_tonne_km
  FROM tire_usage_logs ul
  WHERE ul.installation_id IN (
    SELECT id FROM tire_installations WHERE tire_id = p_tire_id
  );

  IF v_total_tonne_km > 0 THEN
    RETURN v_total_cost / v_total_tonne_km;
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour vérifier ROP et créer alertes
CREATE OR REPLACE FUNCTION check_reorder_points()
RETURNS void AS $$
DECLARE
  v_inventory RECORD;
BEGIN
  FOR v_inventory IN
    SELECT * FROM tire_inventory
    WHERE quantity <= reorder_point AND quantity > 0
  LOOP
    INSERT INTO tire_alerts (
      alert_type,
      severity,
      site_id,
      tire_model_id,
      message,
      threshold_value,
      current_value
    ) VALUES (
      'reorder_point',
      CASE WHEN v_inventory.quantity <= v_inventory.minimum_stock THEN 'critical' ELSE 'high' END,
      v_inventory.site_id,
      v_inventory.tire_model_id,
      'Stock below reorder point',
      v_inventory.reorder_point,
      v_inventory.quantity
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
