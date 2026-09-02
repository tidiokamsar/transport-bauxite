/*
  # Advanced AI/ML Analytics System for Fleet Management
  
  1. New Tables
    - `fleet_health_scores` - AI-based fleet health scoring and predictions
    - `predictive_maintenance_models` - ML models for maintenance prediction
    - `driver_behavior_scores` - Advanced driver scoring with risk analysis
    - `route_optimization_suggestions` - AI-powered route recommendations
    - `vehicle_upgrade_recommendations` - Intelligent vehicle upgrade suggestions
    - `tco_analysis` - Total Cost of Ownership detailed analysis
    - `carbon_footprint_tracking` - Environmental impact tracking
    - `compliance_reports` - Automated compliance reporting
    - `training_needs_analysis` - Driver training recommendations
    - `benchmark_comparisons` - Industry benchmark tracking
    - `scenario_simulations` - Strategic planning simulations
    - `smart_notifications` - Intelligent priority-based notifications
    - `quick_actions_log` - Track quick actions usage
    - `custom_dashboards` - User-customizable dashboard configurations
    
  2. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users
*/

-- Fleet Health Scores with AI Predictions
CREATE TABLE IF NOT EXISTS fleet_health_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE,
  overall_score integer NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  mechanical_score integer CHECK (mechanical_score >= 0 AND mechanical_score <= 100),
  performance_score integer CHECK (performance_score >= 0 AND performance_score <= 100),
  safety_score integer CHECK (safety_score >= 0 AND safety_score <= 100),
  efficiency_score integer CHECK (efficiency_score >= 0 AND efficiency_score <= 100),
  predicted_issues jsonb DEFAULT '[]',
  risk_level text CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  next_maintenance_prediction timestamptz,
  confidence_level numeric(5,2) CHECK (confidence_level >= 0 AND confidence_level <= 100),
  recommendations jsonb DEFAULT '[]',
  calculated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE fleet_health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view fleet health scores"
  ON fleet_health_scores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert fleet health scores"
  ON fleet_health_scores FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update fleet health scores"
  ON fleet_health_scores FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

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
  ON predictive_maintenance_models FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert predictive maintenance"
  ON predictive_maintenance_models FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update predictive maintenance"
  ON predictive_maintenance_models FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

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
  ON driver_behavior_scores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert driver behavior scores"
  ON driver_behavior_scores FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update driver behavior scores"
  ON driver_behavior_scores FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Route Optimization Suggestions
CREATE TABLE IF NOT EXISTS route_optimization_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  original_route jsonb,
  suggested_route jsonb,
  estimated_fuel_savings numeric(10,2),
  estimated_time_savings integer,
  estimated_distance_reduction numeric(10,2),
  estimated_cost_savings numeric(12,2),
  factors_considered jsonb DEFAULT '[]',
  traffic_conditions text,
  weather_conditions text,
  road_conditions text,
  suggestion_confidence numeric(5,2) CHECK (suggestion_confidence >= 0 AND suggestion_confidence <= 100),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  suggested_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  decision_made_at timestamptz,
  actual_savings numeric(12,2),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE route_optimization_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view route suggestions"
  ON route_optimization_suggestions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert route suggestions"
  ON route_optimization_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update route suggestions"
  ON route_optimization_suggestions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Vehicle Upgrade Recommendations
CREATE TABLE IF NOT EXISTS vehicle_upgrade_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE,
  recommendation_type text CHECK (recommendation_type IN ('replace', 'upgrade', 'retrofit', 'retire')),
  current_vehicle_age_years numeric(5,2),
  current_total_cost numeric(12,2),
  current_efficiency_score integer CHECK (current_efficiency_score >= 0 AND current_efficiency_score <= 100),
  recommended_action text NOT NULL,
  recommended_vehicle_type text,
  estimated_investment numeric(12,2),
  estimated_annual_savings numeric(12,2),
  roi_period_months integer,
  payback_period_months integer,
  environmental_impact_improvement numeric(5,2),
  reliability_improvement numeric(5,2),
  justification text,
  urgency_score integer CHECK (urgency_score >= 0 AND urgency_score <= 100),
  supporting_data jsonb DEFAULT '{}',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'implemented')),
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  implemented_at timestamptz
);

ALTER TABLE vehicle_upgrade_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view upgrade recommendations"
  ON vehicle_upgrade_recommendations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert upgrade recommendations"
  ON vehicle_upgrade_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update upgrade recommendations"
  ON vehicle_upgrade_recommendations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

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
  ON tco_analysis FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert TCO analysis"
  ON tco_analysis FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update TCO analysis"
  ON tco_analysis FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Carbon Footprint Tracking
CREATE TABLE IF NOT EXISTS carbon_footprint_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES trips(id) ON DELETE SET NULL,
  tracking_period text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_co2_emissions_kg numeric(12,2) NOT NULL,
  fuel_consumption_liters numeric(10,2),
  distance_traveled_km numeric(10,2),
  co2_per_km numeric(8,4),
  co2_per_liter numeric(8,4),
  emission_standard text,
  carbon_offset_cost numeric(12,2),
  benchmark_emissions numeric(12,2),
  variance_from_benchmark numeric(5,2),
  improvement_opportunities jsonb DEFAULT '[]',
  esg_compliance_score integer CHECK (esg_compliance_score >= 0 AND esg_compliance_score <= 100),
  certifications jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE carbon_footprint_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view carbon footprint"
  ON carbon_footprint_tracking FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert carbon footprint"
  ON carbon_footprint_tracking FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update carbon footprint"
  ON carbon_footprint_tracking FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Automated Compliance Reports
CREATE TABLE IF NOT EXISTS compliance_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL,
  reporting_period text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  regulatory_body text,
  compliance_status text CHECK (compliance_status IN ('compliant', 'non_compliant', 'partially_compliant', 'under_review')),
  compliance_score integer CHECK (compliance_score >= 0 AND compliance_score <= 100),
  violations jsonb DEFAULT '[]',
  corrective_actions jsonb DEFAULT '[]',
  documentation_links jsonb DEFAULT '[]',
  submission_deadline date,
  submitted_at timestamptz,
  approved_at timestamptz,
  report_data jsonb DEFAULT '{}',
  auto_generated boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view compliance reports"
  ON compliance_reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert compliance reports"
  ON compliance_reports FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update compliance reports"
  ON compliance_reports FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Training Needs Analysis
CREATE TABLE IF NOT EXISTS training_needs_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE,
  analysis_date date NOT NULL,
  skill_gaps jsonb DEFAULT '[]',
  priority_areas jsonb DEFAULT '[]',
  recommended_courses jsonb DEFAULT '[]',
  estimated_training_duration_hours integer,
  estimated_training_cost numeric(10,2),
  expected_improvement_score integer CHECK (expected_improvement_score >= 0 AND expected_improvement_score <= 100),
  urgency_level text CHECK (urgency_level IN ('low', 'medium', 'high', 'critical')),
  completion_deadline date,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'in_progress', 'completed', 'cancelled')),
  training_provider text,
  scheduled_date date,
  completed_date date,
  post_training_score integer CHECK (post_training_score >= 0 AND post_training_score <= 100),
  effectiveness_rating integer CHECK (effectiveness_rating >= 1 AND effectiveness_rating <= 5),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE training_needs_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view training needs"
  ON training_needs_analysis FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert training needs"
  ON training_needs_analysis FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update training needs"
  ON training_needs_analysis FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Benchmark Comparisons
CREATE TABLE IF NOT EXISTS benchmark_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comparison_category text NOT NULL,
  metric_name text NOT NULL,
  our_value numeric(12,2) NOT NULL,
  industry_average numeric(12,2),
  industry_best numeric(12,2),
  industry_worst numeric(12,2),
  percentile_rank integer CHECK (percentile_rank >= 0 AND percentile_rank <= 100),
  variance_from_average numeric(8,2),
  performance_rating text CHECK (performance_rating IN ('excellent', 'above_average', 'average', 'below_average', 'poor')),
  improvement_potential numeric(8,2),
  benchmark_source text,
  geographic_region text,
  fleet_size_category text,
  measurement_period text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  insights jsonb DEFAULT '[]',
  action_items jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE benchmark_comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view benchmarks"
  ON benchmark_comparisons FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert benchmarks"
  ON benchmark_comparisons FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update benchmarks"
  ON benchmark_comparisons FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Scenario Simulations
CREATE TABLE IF NOT EXISTS scenario_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_name text NOT NULL,
  simulation_type text CHECK (simulation_type IN ('fleet_expansion', 'cost_reduction', 'route_optimization', 'vehicle_replacement', 'fuel_strategy', 'maintenance_strategy', 'other')),
  description text,
  baseline_metrics jsonb DEFAULT '{}',
  scenario_parameters jsonb DEFAULT '{}',
  projected_outcomes jsonb DEFAULT '{}',
  financial_impact numeric(12,2),
  roi_projection numeric(8,2),
  risk_assessment text CHECK (risk_assessment IN ('low', 'medium', 'high', 'very_high')),
  confidence_level numeric(5,2) CHECK (confidence_level >= 0 AND confidence_level <= 100),
  timeframe_months integer,
  assumptions jsonb DEFAULT '[]',
  success_criteria jsonb DEFAULT '[]',
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'approved', 'implemented', 'rejected')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  implemented_at timestamptz,
  actual_results jsonb
);

ALTER TABLE scenario_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view scenarios"
  ON scenario_simulations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert scenarios"
  ON scenario_simulations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update scenarios"
  ON scenario_simulations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Smart Notifications
CREATE TABLE IF NOT EXISTS smart_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  category text CHECK (category IN ('critical', 'warning', 'info', 'success')),
  priority integer DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  title text NOT NULL,
  message text NOT NULL,
  action_url text,
  action_label text,
  related_entity_type text,
  related_entity_id uuid,
  metadata jsonb DEFAULT '{}',
  is_read boolean DEFAULT false,
  is_dismissed boolean DEFAULT false,
  read_at timestamptz,
  dismissed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE smart_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON smart_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert notifications"
  ON smart_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON smart_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Quick Actions Log
CREATE TABLE IF NOT EXISTS quick_actions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  action_name text NOT NULL,
  entity_type text,
  entity_id uuid,
  parameters jsonb DEFAULT '{}',
  execution_time_ms integer,
  status text CHECK (status IN ('success', 'failed', 'partial')),
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE quick_actions_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quick actions"
  ON quick_actions_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert quick actions"
  ON quick_actions_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Custom Dashboards
CREATE TABLE IF NOT EXISTS custom_dashboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  dashboard_name text NOT NULL,
  is_default boolean DEFAULT false,
  layout_config jsonb DEFAULT '{}',
  widgets jsonb DEFAULT '[]',
  filters jsonb DEFAULT '{}',
  refresh_interval_seconds integer DEFAULT 300,
  is_public boolean DEFAULT false,
  shared_with jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE custom_dashboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dashboards"
  ON custom_dashboards FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can insert own dashboards"
  ON custom_dashboards FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dashboards"
  ON custom_dashboards FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own dashboards"
  ON custom_dashboards FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_fleet_health_vehicle ON fleet_health_scores(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fleet_health_risk ON fleet_health_scores(risk_level);
CREATE INDEX IF NOT EXISTS idx_predictive_maintenance_vehicle ON predictive_maintenance_models(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_predictive_maintenance_status ON predictive_maintenance_models(status);
CREATE INDEX IF NOT EXISTS idx_driver_behavior_driver ON driver_behavior_scores(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_behavior_period ON driver_behavior_scores(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_route_optimization_trip ON route_optimization_suggestions(trip_id);
CREATE INDEX IF NOT EXISTS idx_route_optimization_vehicle ON route_optimization_suggestions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_upgrade_vehicle ON vehicle_upgrade_recommendations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_upgrade_status ON vehicle_upgrade_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_tco_vehicle ON tco_analysis(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_tco_period ON tco_analysis(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_carbon_vehicle ON carbon_footprint_tracking(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_carbon_period ON carbon_footprint_tracking(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_compliance_type ON compliance_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_compliance_status ON compliance_reports(compliance_status);
CREATE INDEX IF NOT EXISTS idx_training_driver ON training_needs_analysis(driver_id);
CREATE INDEX IF NOT EXISTS idx_training_status ON training_needs_analysis(status);
CREATE INDEX IF NOT EXISTS idx_benchmark_category ON benchmark_comparisons(comparison_category);
CREATE INDEX IF NOT EXISTS idx_scenario_type ON scenario_simulations(simulation_type);
CREATE INDEX IF NOT EXISTS idx_scenario_status ON scenario_simulations(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON smart_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON smart_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_quick_actions_user ON quick_actions_log(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_dashboards_user ON custom_dashboards(user_id);