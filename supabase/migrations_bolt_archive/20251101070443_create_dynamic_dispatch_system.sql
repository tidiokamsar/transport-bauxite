/*
  # Système d'affectation dynamique et optimisation (Dynamic Dispatch)
  
  1. Nouvelles tables
    - `dispatch_rules` - Règles d'affectation automatique
    - `dispatch_assignments` - Affectations optimisées
    - `dispatch_simulations` - Simulations what-if
    - `optimization_history` - Historique des optimisations
    - `vehicle_availability` - Disponibilité temps réel véhicules
    - `driver_availability` - Disponibilité temps réel chauffeurs
    - `mission_requirements` - Exigences des missions
    - `performance_scores` - Scores de performance véhicule/chauffeur
  
  2. Fonctionnalités
    - Affectation automatique véhicule + chauffeur
    - Optimisation multi-critères (distance, charge, disponibilité)
    - Simulation de scénarios
    - Scoring intelligent
  
  3. Sécurité
    - RLS activé sur toutes les tables
    - Policies authentifiées
*/

-- Table règles d'affectation
CREATE TABLE IF NOT EXISTS dispatch_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  priority int DEFAULT 0,
  rule_type text CHECK (rule_type IN ('distance', 'load_capacity', 'driver_score', 'fuel_efficiency', 'cost')),
  weight numeric(3,2) DEFAULT 1.0,
  conditions jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table disponibilité véhicules
CREATE TABLE IF NOT EXISTS vehicle_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE,
  date date DEFAULT CURRENT_DATE,
  status text DEFAULT 'available' CHECK (status IN ('available', 'in_mission', 'maintenance', 'unavailable')),
  current_location jsonb,
  fuel_level numeric(5,2),
  load_capacity_available numeric(10,2),
  next_maintenance_km int,
  health_score numeric(3,2),
  updated_at timestamptz DEFAULT now()
);

-- Table disponibilité chauffeurs
CREATE TABLE IF NOT EXISTS driver_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE,
  date date DEFAULT CURRENT_DATE,
  status text DEFAULT 'available' CHECK (status IN ('available', 'on_mission', 'resting', 'off_duty', 'unavailable')),
  current_location jsonb,
  hours_worked_today numeric(4,2) DEFAULT 0,
  hours_worked_week numeric(5,2) DEFAULT 0,
  fatigue_score numeric(3,2),
  performance_score numeric(3,2),
  updated_at timestamptz DEFAULT now()
);

-- Table exigences missions
CREATE TABLE IF NOT EXISTS mission_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  required_vehicle_type text,
  min_load_capacity numeric(10,2),
  required_certifications text[],
  max_distance_km numeric(10,2),
  time_window_start timestamptz,
  time_window_end timestamptz,
  priority int DEFAULT 0,
  special_requirements jsonb,
  created_at timestamptz DEFAULT now()
);

-- Table affectations optimisées
CREATE TABLE IF NOT EXISTS dispatch_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id),
  driver_id uuid REFERENCES drivers(id),
  assignment_date timestamptz DEFAULT now(),
  assignment_type text DEFAULT 'automatic' CHECK (assignment_type IN ('automatic', 'manual', 'override')),
  optimization_score numeric(5,2),
  estimated_cost numeric(10,2),
  estimated_duration_minutes int,
  estimated_fuel_consumption numeric(10,2),
  route_optimization jsonb,
  status text DEFAULT 'assigned' CHECK (status IN ('assigned', 'accepted', 'in_progress', 'completed', 'cancelled')),
  assigned_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Table simulations
CREATE TABLE IF NOT EXISTS dispatch_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_name text NOT NULL,
  scenario_type text CHECK (scenario_type IN ('add_vehicles', 'change_routes', 'optimize_fuel', 'what_if')),
  parameters jsonb NOT NULL,
  results jsonb,
  metrics jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Table scores de performance
CREATE TABLE IF NOT EXISTS performance_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text CHECK (entity_type IN ('vehicle', 'driver', 'route')),
  entity_id uuid NOT NULL,
  score_date date DEFAULT CURRENT_DATE,
  efficiency_score numeric(3,2),
  reliability_score numeric(3,2),
  safety_score numeric(3,2),
  cost_effectiveness_score numeric(3,2),
  overall_score numeric(3,2),
  metrics jsonb,
  created_at timestamptz DEFAULT now()
);

-- Table historique optimisations
CREATE TABLE IF NOT EXISTS optimization_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  optimization_date timestamptz DEFAULT now(),
  optimization_type text,
  vehicles_optimized int,
  missions_optimized int,
  improvement_percentage numeric(5,2),
  cost_saved numeric(12,2),
  time_saved_minutes int,
  fuel_saved_liters numeric(10,2),
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE dispatch_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_history ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can read dispatch rules" ON dispatch_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage dispatch rules" ON dispatch_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read vehicle availability" ON vehicle_availability FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage vehicle availability" ON vehicle_availability FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read driver availability" ON driver_availability FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage driver availability" ON driver_availability FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read mission requirements" ON mission_requirements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage mission requirements" ON mission_requirements FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read dispatch assignments" ON dispatch_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage dispatch assignments" ON dispatch_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read dispatch simulations" ON dispatch_simulations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage dispatch simulations" ON dispatch_simulations FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read performance scores" ON performance_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage performance scores" ON performance_scores FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read optimization history" ON optimization_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage optimization history" ON optimization_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_vehicle_availability_vehicle_id ON vehicle_availability(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_availability_status ON vehicle_availability(status);
CREATE INDEX IF NOT EXISTS idx_driver_availability_driver_id ON driver_availability(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_availability_status ON driver_availability(status);
CREATE INDEX IF NOT EXISTS idx_dispatch_assignments_trip_id ON dispatch_assignments(trip_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_assignments_status ON dispatch_assignments(status);
CREATE INDEX IF NOT EXISTS idx_performance_scores_entity ON performance_scores(entity_type, entity_id);

-- Fonction d'optimisation automatique
CREATE OR REPLACE FUNCTION optimize_dispatch_assignment(
  p_trip_id uuid,
  p_optimization_type text DEFAULT 'balanced'
)
RETURNS jsonb AS $$
DECLARE
  v_best_vehicle uuid;
  v_best_driver uuid;
  v_optimization_score numeric;
  v_result jsonb;
BEGIN
  -- Trouver le meilleur véhicule disponible
  SELECT va.vehicle_id, ps.overall_score
  INTO v_best_vehicle, v_optimization_score
  FROM vehicle_availability va
  LEFT JOIN performance_scores ps ON ps.entity_id = va.vehicle_id AND ps.entity_type = 'vehicle'
  WHERE va.status = 'available'
    AND va.fuel_level > 20
    AND va.health_score > 0.7
  ORDER BY 
    CASE 
      WHEN p_optimization_type = 'efficiency' THEN ps.efficiency_score
      WHEN p_optimization_type = 'cost' THEN ps.cost_effectiveness_score
      ELSE ps.overall_score
    END DESC NULLS LAST
  LIMIT 1;

  -- Trouver le meilleur chauffeur disponible
  SELECT da.driver_id
  INTO v_best_driver
  FROM driver_availability da
  LEFT JOIN performance_scores ps ON ps.entity_id = da.driver_id AND ps.entity_type = 'driver'
  WHERE da.status = 'available'
    AND da.hours_worked_today < 10
    AND da.fatigue_score < 0.7
  ORDER BY ps.overall_score DESC NULLS LAST
  LIMIT 1;

  -- Créer l'affectation
  IF v_best_vehicle IS NOT NULL AND v_best_driver IS NOT NULL THEN
    INSERT INTO dispatch_assignments (
      trip_id,
      vehicle_id,
      driver_id,
      assignment_type,
      optimization_score
    ) VALUES (
      p_trip_id,
      v_best_vehicle,
      v_best_driver,
      'automatic',
      v_optimization_score
    );

    v_result := jsonb_build_object(
      'success', true,
      'vehicle_id', v_best_vehicle,
      'driver_id', v_best_driver,
      'optimization_score', v_optimization_score
    );
  ELSE
    v_result := jsonb_build_object(
      'success', false,
      'message', 'No available resources'
    );
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
