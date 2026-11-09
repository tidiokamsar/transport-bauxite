/*
  # Module ESG et Durabilité (Environment, Social, Governance)
  
  1. Nouvelles tables
    - `carbon_emissions` - Suivi émissions CO₂
    - `eco_driving_scores` - Scores éco-conduite
    - `environmental_incidents` - Incidents environnementaux
    - `sustainability_kpis` - KPIs durabilité
    - `esg_reports` - Rapports RSE
    - `waste_management` - Gestion déchets (pneus usés, etc.)
  
  2. Fonctionnalités
    - Calcul automatique CO₂
    - Scoring éco-conduite
    - Rapports RSE automatisés
    - Conformité environnementale
  
  3. Sécurité
    - RLS activé
    - Policies authentifiées
*/

-- Table émissions carbone
CREATE TABLE IF NOT EXISTS carbon_emissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id),
  emission_date date DEFAULT CURRENT_DATE,
  fuel_consumed_liters numeric(10,2),
  distance_km numeric(10,2),
  co2_emissions_kg numeric(10,2),
  nox_emissions_kg numeric(10,2),
  pm_emissions_kg numeric(10,2),
  emission_factor numeric(5,4),
  calculation_method text DEFAULT 'standard',
  verified boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Table scores éco-conduite
CREATE TABLE IF NOT EXISTS eco_driving_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES trips(id),
  score_date date DEFAULT CURRENT_DATE,
  overall_score numeric(3,2),
  smooth_acceleration_score numeric(3,2),
  smooth_braking_score numeric(3,2),
  optimal_speed_score numeric(3,2),
  idle_time_score numeric(3,2),
  fuel_efficiency_score numeric(3,2),
  harsh_events_count int DEFAULT 0,
  idle_time_minutes int DEFAULT 0,
  recommendations text[],
  created_at timestamptz DEFAULT now()
);

-- Table incidents environnementaux
CREATE TABLE IF NOT EXISTS environmental_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_date timestamptz DEFAULT now(),
  incident_type text CHECK (incident_type IN ('fuel_spill', 'oil_leak', 'tire_disposal', 'waste', 'emission_excess', 'other')),
  severity text CHECK (severity IN ('minor', 'moderate', 'major', 'critical')),
  vehicle_id uuid REFERENCES vehicles(id),
  driver_id uuid REFERENCES drivers(id),
  location jsonb,
  description text NOT NULL,
  estimated_impact text,
  corrective_actions text,
  status text DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  reported_by uuid REFERENCES auth.users(id),
  photos jsonb,
  resolved_date timestamptz,
  cost_remediation numeric(12,2),
  created_at timestamptz DEFAULT now()
);

-- Table KPIs durabilité
CREATE TABLE IF NOT EXISTS sustainability_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_date date DEFAULT CURRENT_DATE,
  period_type text CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  total_co2_emissions_kg numeric(12,2),
  co2_per_tonne_km numeric(8,4),
  total_fuel_consumed_liters numeric(12,2),
  fuel_efficiency_l_per_100km numeric(5,2),
  empty_km_percentage numeric(5,2),
  eco_driving_avg_score numeric(3,2),
  environmental_incidents_count int DEFAULT 0,
  waste_recycled_percentage numeric(5,2),
  compliance_score numeric(3,2),
  water_consumption_liters numeric(10,2),
  noise_pollution_events int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Table rapports ESG
CREATE TABLE IF NOT EXISTS esg_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_name text NOT NULL,
  report_type text CHECK (report_type IN ('monthly', 'quarterly', 'annual', 'custom')),
  report_period_start date,
  report_period_end date,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'published', 'archived')),
  environmental_data jsonb,
  social_data jsonb,
  governance_data jsonb,
  key_findings text[],
  recommendations text[],
  generated_by uuid REFERENCES auth.users(id),
  published_date date,
  file_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table gestion déchets
CREATE TABLE IF NOT EXISTS waste_management (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waste_date date DEFAULT CURRENT_DATE,
  waste_type text CHECK (waste_type IN ('used_tires', 'used_oil', 'filters', 'batteries', 'parts', 'other')),
  quantity numeric(10,2),
  unit text DEFAULT 'kg',
  source_vehicle_id uuid REFERENCES vehicles(id),
  disposal_method text CHECK (disposal_method IN ('recycling', 'authorized_disposal', 'reuse', 'energy_recovery')),
  disposal_location text,
  disposal_partner text,
  cost numeric(10,2),
  certificate_number text,
  environmental_impact_reduction jsonb,
  status text DEFAULT 'collected' CHECK (status IN ('collected', 'in_transit', 'disposed', 'verified')),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE carbon_emissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE eco_driving_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE environmental_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sustainability_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE esg_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_management ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can read carbon emissions" ON carbon_emissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage carbon emissions" ON carbon_emissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read eco driving scores" ON eco_driving_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage eco driving scores" ON eco_driving_scores FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read environmental incidents" ON environmental_incidents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage environmental incidents" ON environmental_incidents FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read sustainability kpis" ON sustainability_kpis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage sustainability kpis" ON sustainability_kpis FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read esg reports" ON esg_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage esg reports" ON esg_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read waste management" ON waste_management FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage waste management" ON waste_management FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_carbon_emissions_trip ON carbon_emissions(trip_id);
CREATE INDEX IF NOT EXISTS idx_carbon_emissions_date ON carbon_emissions(emission_date);
CREATE INDEX IF NOT EXISTS idx_eco_driving_driver ON eco_driving_scores(driver_id);
CREATE INDEX IF NOT EXISTS idx_environmental_incidents_status ON environmental_incidents(status);
CREATE INDEX IF NOT EXISTS idx_sustainability_kpis_date ON sustainability_kpis(kpi_date);

-- Fonction calcul CO₂ automatique
CREATE OR REPLACE FUNCTION calculate_trip_carbon_emissions(p_trip_id uuid)
RETURNS numeric AS $$
DECLARE
  v_fuel_consumed numeric;
  v_distance_km numeric;
  v_co2_kg numeric;
  v_emission_factor numeric := 2.68;
BEGIN
  SELECT fuel_consumed, (km_end - km_start)
  INTO v_fuel_consumed, v_distance_km
  FROM trips
  WHERE id = p_trip_id;

  v_co2_kg := v_fuel_consumed * v_emission_factor;

  INSERT INTO carbon_emissions (
    trip_id,
    fuel_consumed_liters,
    distance_km,
    co2_emissions_kg,
    emission_factor
  ) VALUES (
    p_trip_id,
    v_fuel_consumed,
    v_distance_km,
    v_co2_kg,
    v_emission_factor
  );

  RETURN v_co2_kg;
END;
$$ LANGUAGE plpgsql;

-- Fonction calcul KPIs durabilité
CREATE OR REPLACE FUNCTION update_sustainability_kpis(p_date date DEFAULT CURRENT_DATE)
RETURNS void AS $$
DECLARE
  v_total_co2 numeric;
  v_total_fuel numeric;
  v_total_distance numeric;
  v_avg_eco_score numeric;
BEGIN
  SELECT 
    COALESCE(SUM(co2_emissions_kg), 0),
    COALESCE(SUM(fuel_consumed_liters), 0),
    COALESCE(SUM(distance_km), 0)
  INTO v_total_co2, v_total_fuel, v_total_distance
  FROM carbon_emissions
  WHERE emission_date = p_date;

  SELECT COALESCE(AVG(overall_score), 0)
  INTO v_avg_eco_score
  FROM eco_driving_scores
  WHERE score_date = p_date;

  INSERT INTO sustainability_kpis (
    kpi_date,
    period_type,
    total_co2_emissions_kg,
    total_fuel_consumed_liters,
    fuel_efficiency_l_per_100km,
    eco_driving_avg_score
  ) VALUES (
    p_date,
    'daily',
    v_total_co2,
    v_total_fuel,
    CASE WHEN v_total_distance > 0 THEN (v_total_fuel / v_total_distance) * 100 ELSE 0 END,
    v_avg_eco_score
  )
  ON CONFLICT (kpi_date) DO UPDATE SET
    total_co2_emissions_kg = EXCLUDED.total_co2_emissions_kg,
    total_fuel_consumed_liters = EXCLUDED.total_fuel_consumed_liters,
    fuel_efficiency_l_per_100km = EXCLUDED.fuel_efficiency_l_per_100km,
    eco_driving_avg_score = EXCLUDED.eco_driving_avg_score;
END;
$$ LANGUAGE plpgsql;
