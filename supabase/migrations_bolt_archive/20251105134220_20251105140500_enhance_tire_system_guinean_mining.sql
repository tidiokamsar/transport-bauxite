/*
  # Enrichissement du Système de Gestion des Pneus - Mines de Guinée
  
  ## Nouvelles fonctionnalités ajoutées:
  
  1. **Nouvelles tables**:
     - tire_brands (marques)
     - tire_inspections (inspections terrain)
     - tire_sensors (capteurs IoT/TPMS)
     - tire_sensor_readings (historique capteurs)
     - tire_work_orders (ordres de travail)
     - tire_usage_zones (zones géographiques + heatmap)
     - tire_cost_analysis (analyses économiques)
  
  2. **Enrichissement tables existantes**:
     - Ajout colonnes manquantes
     - Score santé, RFID/QR codes
     - Données économiques GNF/USD
  
  3. **Sécurité**: RLS sur toutes les nouvelles tables
*/

-- ============================================
-- NOUVELLES TABLES
-- ============================================

-- Table des marques de pneus
CREATE TABLE IF NOT EXISTS tire_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  country_origin TEXT,
  website TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  is_active BOOLEAN DEFAULT true,
  average_quality_rating DECIMAL(3,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table des inspections terrain
CREATE TABLE IF NOT EXISTS tire_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tire_id UUID REFERENCES tires(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id),
  inspector_user_id TEXT,
  
  inspection_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  inspection_type TEXT NOT NULL DEFAULT 'daily', -- daily, weekly, monthly, incident
  
  -- Mesures
  pressure_psi INTEGER,
  temperature_celsius DECIMAL(5,2),
  tread_depth_mm DECIMAL(5,2),
  
  -- État visuel
  visual_condition TEXT DEFAULT 'good', -- excellent, good, fair, poor, critical
  has_cracks BOOLEAN DEFAULT false,
  has_cuts BOOLEAN DEFAULT false,
  has_bulges BOOLEAN DEFAULT false,
  has_punctures BOOLEAN DEFAULT false,
  has_uneven_wear BOOLEAN DEFAULT false,
  
  -- Anomalies
  anomalies_detected TEXT[],
  severity TEXT DEFAULT 'info', -- info, warning, critical
  
  -- Recommandations
  action_required TEXT DEFAULT 'none', -- none, inflate, repair, replace
  recommended_action_date DATE,
  
  -- Localisation GPS
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  location_name TEXT,
  
  -- Documentation
  photos JSONB,
  inspector_signature TEXT,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table des capteurs IoT (TPMS)
CREATE TABLE IF NOT EXISTS tire_sensors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tire_id UUID REFERENCES tires(id) ON DELETE CASCADE,
  sensor_serial TEXT NOT NULL UNIQUE,
  sensor_type TEXT DEFAULT 'TPMS',
  
  -- Dernière lecture
  last_reading_time TIMESTAMPTZ,
  last_pressure_psi INTEGER,
  last_temperature_celsius DECIMAL(5,2),
  battery_level_percent INTEGER DEFAULT 100,
  
  -- Alertes actives
  has_active_alert BOOLEAN DEFAULT false,
  alert_type TEXT,
  alert_since TIMESTAMPTZ,
  
  -- Statut
  is_active BOOLEAN DEFAULT true,
  installation_date DATE DEFAULT CURRENT_DATE,
  last_maintenance_date DATE,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table des lectures de capteurs
CREATE TABLE IF NOT EXISTS tire_sensor_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID REFERENCES tire_sensors(id) ON DELETE CASCADE,
  tire_id UUID REFERENCES tires(id),
  vehicle_id UUID REFERENCES vehicles(id),
  
  reading_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  pressure_psi INTEGER NOT NULL,
  temperature_celsius DECIMAL(5,2),
  
  -- Alertes
  alert_generated BOOLEAN DEFAULT false,
  alert_type TEXT,
  
  -- Localisation
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table des ordres de travail
CREATE TABLE IF NOT EXISTS tire_work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  tire_id UUID REFERENCES tires(id),
  vehicle_id UUID REFERENCES vehicles(id),
  
  order_type TEXT NOT NULL DEFAULT 'inspection', -- installation, rotation, repair, inspection, removal
  priority TEXT NOT NULL DEFAULT 'normal', -- low, normal, high, critical
  status TEXT NOT NULL DEFAULT 'open', -- open, in_progress, completed, cancelled
  
  -- Assignation
  assigned_to_user_id TEXT,
  requested_by_user_id TEXT,
  
  -- Dates
  requested_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_date TIMESTAMPTZ,
  started_date TIMESTAMPTZ,
  completed_date TIMESTAMPTZ,
  
  -- Détails
  description TEXT,
  work_performed TEXT,
  parts_used JSONB,
  labor_hours DECIMAL(5,2),
  
  -- Coûts
  parts_cost_gnf DECIMAL(15,2) DEFAULT 0,
  labor_cost_gnf DECIMAL(15,2) DEFAULT 0,
  total_cost_gnf DECIMAL(15,2) GENERATED ALWAYS AS (parts_cost_gnf + labor_cost_gnf) STORED,
  
  -- Documentation
  before_photos JSONB,
  after_photos JSONB,
  technician_signature TEXT,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table des zones d'usure géographiques (SIG)
CREATE TABLE IF NOT EXISTS tire_usage_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_name TEXT NOT NULL,
  site_id UUID REFERENCES sites(id),
  
  -- Géographie
  center_latitude DECIMAL(10,8) NOT NULL,
  center_longitude DECIMAL(11,8) NOT NULL,
  radius_meters INTEGER DEFAULT 5000,
  polygon_coordinates JSONB,
  
  -- Caractéristiques terrain
  terrain_type TEXT DEFAULT 'mixed', -- laterite, gravel, rocky, muddy, paved
  road_condition TEXT DEFAULT 'fair', -- excellent, good, fair, poor
  slope_percentage DECIMAL(5,2) DEFAULT 0,
  dust_level TEXT DEFAULT 'medium', -- low, medium, high
  
  -- Statistiques d'usure
  average_wear_rate_mm_per_1000km DECIMAL(5,2) DEFAULT 0,
  puncture_incident_count INTEGER DEFAULT 0,
  temperature_avg_celsius DECIMAL(5,2),
  
  -- Alertes
  is_high_risk_zone BOOLEAN DEFAULT false,
  risk_level TEXT DEFAULT 'low', -- low, medium, high, critical
  
  -- Recommandations
  recommended_pressure_psi INTEGER,
  recommended_speed_limit_kmh INTEGER,
  recommended_tire_types TEXT[],
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table d'analyse des coûts
CREATE TABLE IF NOT EXISTS tire_cost_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_period_start DATE NOT NULL,
  analysis_period_end DATE NOT NULL,
  
  -- Scope
  vehicle_id UUID REFERENCES vehicles(id),
  site_id UUID REFERENCES sites(id),
  
  -- Métriques
  total_tires_used INTEGER DEFAULT 0,
  total_km_traveled DECIMAL(15,2) DEFAULT 0,
  total_purchase_cost_gnf DECIMAL(15,2) DEFAULT 0,
  total_maintenance_cost_gnf DECIMAL(15,2) DEFAULT 0,
  total_cost_gnf DECIMAL(15,2) DEFAULT 0,
  
  -- KPIs
  cost_per_km_gnf DECIMAL(10,2),
  cost_per_tire_gnf DECIMAL(15,2),
  average_lifetime_km DECIMAL(10,2),
  average_days_in_service INTEGER,
  
  -- Comparaisons
  vs_budget_percentage DECIMAL(5,2),
  vs_previous_period_percentage DECIMAL(5,2),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ENRICHISSEMENT DES TABLES EXISTANTES
-- ============================================

-- Enrichir tire_models
DO $$
BEGIN
  -- Ajouter colonnes manquantes si elles n'existent pas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tire_models' AND column_name = 'brand_id') THEN
    ALTER TABLE tire_models ADD COLUMN brand_id UUID REFERENCES tire_brands(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tire_models' AND column_name = 'unit_cost_gnf') THEN
    ALTER TABLE tire_models ADD COLUMN unit_cost_gnf DECIMAL(15,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tire_models' AND column_name = 'unit_cost_usd') THEN
    ALTER TABLE tire_models ADD COLUMN unit_cost_usd DECIMAL(10,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tire_models' AND column_name = 'estimated_lifetime_km') THEN
    ALTER TABLE tire_models ADD COLUMN estimated_lifetime_km INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tire_models' AND column_name = 'recommended_usage') THEN
    ALTER TABLE tire_models ADD COLUMN recommended_usage TEXT DEFAULT 'mining_heavy';
  END IF;
END $$;

-- Enrichir tires
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tires' AND column_name = 'rfid_code') THEN
    ALTER TABLE tires ADD COLUMN rfid_code TEXT UNIQUE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tires' AND column_name = 'qr_code') THEN
    ALTER TABLE tires ADD COLUMN qr_code TEXT UNIQUE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tires' AND column_name = 'health_score') THEN
    ALTER TABLE tires ADD COLUMN health_score INTEGER DEFAULT 100;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tires' AND column_name = 'current_pressure_psi') THEN
    ALTER TABLE tires ADD COLUMN current_pressure_psi INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tires' AND column_name = 'current_temperature_celsius') THEN
    ALTER TABLE tires ADD COLUMN current_temperature_celsius DECIMAL(5,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tires' AND column_name = 'purchase_cost_gnf') THEN
    ALTER TABLE tires ADD COLUMN purchase_cost_gnf DECIMAL(15,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tires' AND column_name = 'purchase_cost_usd') THEN
    ALTER TABLE tires ADD COLUMN purchase_cost_usd DECIMAL(10,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tires' AND column_name = 'total_maintenance_cost_gnf') THEN
    ALTER TABLE tires ADD COLUMN total_maintenance_cost_gnf DECIMAL(15,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tires' AND column_name = 'last_inspection_date') THEN
    ALTER TABLE tires ADD COLUMN last_inspection_date DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tires' AND column_name = 'photos') THEN
    ALTER TABLE tires ADD COLUMN photos JSONB;
  END IF;
END $$;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_tire_inspections_tire ON tire_inspections(tire_id);
CREATE INDEX IF NOT EXISTS idx_tire_inspections_date ON tire_inspections(inspection_date DESC);
CREATE INDEX IF NOT EXISTS idx_tire_inspections_severity ON tire_inspections(severity);

CREATE INDEX IF NOT EXISTS idx_tire_sensors_tire ON tire_sensors(tire_id);
CREATE INDEX IF NOT EXISTS idx_tire_sensors_active ON tire_sensors(is_active);

CREATE INDEX IF NOT EXISTS idx_tire_sensor_readings_sensor ON tire_sensor_readings(sensor_id);
CREATE INDEX IF NOT EXISTS idx_tire_sensor_readings_time ON tire_sensor_readings(reading_time DESC);

CREATE INDEX IF NOT EXISTS idx_tire_work_orders_status ON tire_work_orders(status);
CREATE INDEX IF NOT EXISTS idx_tire_work_orders_priority ON tire_work_orders(priority);
CREATE INDEX IF NOT EXISTS idx_tire_work_orders_tire ON tire_work_orders(tire_id);

CREATE INDEX IF NOT EXISTS idx_tire_usage_zones_site ON tire_usage_zones(site_id);
CREATE INDEX IF NOT EXISTS idx_tire_usage_zones_risk ON tire_usage_zones(is_high_risk_zone);

-- ============================================
-- ENABLE RLS
-- ============================================

ALTER TABLE tire_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_sensors ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_usage_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_cost_analysis ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

CREATE POLICY "Users can view tire brands"
  ON tire_brands FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage tire brands"
  ON tire_brands FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view tire inspections"
  ON tire_inspections FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage tire inspections"
  ON tire_inspections FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view tire sensors"
  ON tire_sensors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage tire sensors"
  ON tire_sensors FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view tire sensor readings"
  ON tire_sensor_readings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create tire sensor readings"
  ON tire_sensor_readings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view tire work orders"
  ON tire_work_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage tire work orders"
  ON tire_work_orders FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view tire usage zones"
  ON tire_usage_zones FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage tire usage zones"
  ON tire_usage_zones FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view tire cost analysis"
  ON tire_cost_analysis FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage tire cost analysis"
  ON tire_cost_analysis FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
