/*
  # Création des tables AI/ML Analytics (Partie 2)
  
  1. Tables créées
    - predictive_maintenance_models
    - driver_behavior_scores
    - tco_analysis
    
  2. Security
    - Enable RLS
    - Policies pour authenticated users
*/

-- Predictive Maintenance Models
CREATE TABLE IF NOT EXISTS predictive_maintenance_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE,
  model_type text NOT NULL,
  prediction_date timestamptz NOT NULL,
  failure_probability numeric(5,2) CHECK (failure_probability >= 0 AND failure_probability <= 100),
  predicted_component text,
  recommended_action text,
  estimated_cost numeric(12,2),
  urgency_level text CHECK (urgency_level IN ('low', 'medium', 'high', 'critical')),
  confidence_score numeric(5,2) CHECK (confidence_score >= 0 AND confidence_score <= 100),
  historical_data_points integer DEFAULT 0,
  last_trained_at timestamptz,
  status text DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'dismissed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE predictive_maintenance_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view predictive maintenance"
  ON predictive_maintenance_models FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert predictive maintenance"
  ON predictive_maintenance_models FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update predictive maintenance"
  ON predictive_maintenance_models FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Advanced Driver Behavior Scores
CREATE TABLE IF NOT EXISTS driver_behavior_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  overall_score integer NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  safety_score integer CHECK (safety_score >= 0 AND safety_score <= 100),
  efficiency_score integer CHECK (efficiency_score >= 0 AND efficiency_score <= 100),
  compliance_score integer CHECK (compliance_score >= 0 AND compliance_score <= 100),
  eco_driving_score integer CHECK (eco_driving_score >= 0 AND eco_driving_score <= 100),
  harsh_braking_count integer DEFAULT 0,
  harsh_acceleration_count integer DEFAULT 0,
  speeding_incidents integer DEFAULT 0,
  idle_time_minutes integer DEFAULT 0,
  night_driving_hours numeric(8,2) DEFAULT 0,
  fatigue_risk_level text CHECK (fatigue_risk_level IN ('low', 'medium', 'high', 'critical')),
  accident_risk_score numeric(5,2) CHECK (accident_risk_score >= 0 AND accident_risk_score <= 100),
  improvement_areas jsonb DEFAULT '[]',
  strengths jsonb DEFAULT '[]',
  training_recommendations jsonb DEFAULT '[]',
  peer_comparison_percentile integer CHECK (peer_comparison_percentile >= 0 AND peer_comparison_percentile <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE driver_behavior_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view driver behavior scores"
  ON driver_behavior_scores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert driver behavior scores"
  ON driver_behavior_scores FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update driver behavior scores"
  ON driver_behavior_scores FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Total Cost of Ownership Analysis
CREATE TABLE IF NOT EXISTS tco_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE,
  analysis_period_months integer NOT NULL,
  acquisition_cost numeric(12,2) DEFAULT 0,
  depreciation numeric(12,2) DEFAULT 0,
  fuel_cost numeric(12,2) DEFAULT 0,
  maintenance_cost numeric(12,2) DEFAULT 0,
  insurance_cost numeric(12,2) DEFAULT 0,
  registration_cost numeric(12,2) DEFAULT 0,
  financing_cost numeric(12,2) DEFAULT 0,
  downtime_cost numeric(12,2) DEFAULT 0,
  accident_cost numeric(12,2) DEFAULT 0,
  other_costs numeric(12,2) DEFAULT 0,
  total_cost numeric(12,2) NOT NULL,
  cost_per_km numeric(10,4),
  cost_per_day numeric(10,2),
  cost_per_trip numeric(10,2),
  utilization_rate numeric(5,2),
  efficiency_rating text CHECK (efficiency_rating IN ('excellent', 'good', 'average', 'below_average', 'poor')),
  benchmark_comparison numeric(5,2),
  recommendations jsonb DEFAULT '[]',
  period_start date NOT NULL,
  period_end date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tco_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view TCO analysis"
  ON tco_analysis FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert TCO analysis"
  ON tco_analysis FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update TCO analysis"
  ON tco_analysis FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_fleet_health_vehicle ON fleet_health_scores(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fleet_health_risk ON fleet_health_scores(risk_level);
CREATE INDEX IF NOT EXISTS idx_predictive_maintenance_vehicle ON predictive_maintenance_models(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_predictive_maintenance_status ON predictive_maintenance_models(status);
CREATE INDEX IF NOT EXISTS idx_driver_behavior_driver ON driver_behavior_scores(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_behavior_period ON driver_behavior_scores(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_tco_vehicle ON tco_analysis(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_tco_period ON tco_analysis(period_start, period_end);
