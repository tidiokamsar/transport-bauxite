/*
  # Create Fleet Optimization System (FleetOptimiser Module)
  
  1. New Tables Created
    - fleet_tasks: Tasks definition (transport, loading, tipping)
    - task_assignments: Vehicle/equipment assignments to tasks
    - shift_plans: Daily shift planning (morning, afternoon, night)
    - cycle_tracking: Real-time cycle monitoring (travel, load, tip, return)
    - optimization_scenarios: What-if simulation scenarios
    - optimization_constraints: Constraints for optimization engine
    - reoptimization_events: Events triggering re-optimization
    - performance_kpis: Calculated KPIs for reporting
    
  2. Features
    - Automatic allocation based on capacity, availability, priority
    - Real-time cycle tracking with GPS integration
    - Dynamic re-optimization on events (breakdown, weather, delays)
    - What-if scenario simulation
    - Advanced KPI calculation
    
  3. Security
    - RLS enabled on all tables
    - Policies for authenticated users
*/

-- Fleet Tasks: Define all operational tasks
CREATE TABLE IF NOT EXISTS fleet_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_number TEXT UNIQUE NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('transport', 'loading', 'hauling', 'dumping', 'maintenance_move', 'relocation')),
  origin_site_id UUID REFERENCES sites(id),
  destination_site_id UUID REFERENCES sites(id),
  material_type TEXT,
  target_tonnage NUMERIC(10,2),
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled', 'delayed')),
  planned_start_time TIMESTAMPTZ,
  planned_end_time TIMESTAMPTZ,
  actual_start_time TIMESTAMPTZ,
  actual_end_time TIMESTAMPTZ,
  distance_km NUMERIC(10,2),
  estimated_duration_minutes INTEGER,
  route_profile JSONB, -- {gradients: [], surface_conditions: [], speed_limits: []}
  required_vehicle_type TEXT,
  required_capacity_tonnes NUMERIC(10,2),
  shift_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Task Assignments: Link vehicles/operators to tasks
CREATE TABLE IF NOT EXISTS task_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES fleet_tasks(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  driver_id UUID REFERENCES drivers(id),
  loader_id UUID REFERENCES vehicles(id), -- For loading equipment
  assigned_at TIMESTAMPTZ DEFAULT now(),
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('primary', 'support', 'backup')),
  allocation_score NUMERIC(5,2), -- Score from optimization algorithm (0-100)
  allocation_reason TEXT,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'accepted', 'in_progress', 'completed', 'reassigned', 'cancelled')),
  performance_rating NUMERIC(3,2), -- Post-task rating (0-5)
  completed_cycles INTEGER DEFAULT 0,
  total_tonnage_moved NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, vehicle_id, assignment_type)
);

-- Shift Plans: Daily operational planning
CREATE TABLE IF NOT EXISTS shift_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_number TEXT UNIQUE NOT NULL,
  shift_date DATE NOT NULL,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('morning', 'afternoon', 'night', 'extended')),
  shift_start_time TIMESTAMPTZ NOT NULL,
  shift_end_time TIMESTAMPTZ NOT NULL,
  target_production_tonnes NUMERIC(10,2),
  allocated_vehicles_count INTEGER DEFAULT 0,
  allocated_loaders_count INTEGER DEFAULT 0,
  allocated_drivers_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'active', 'completed', 'cancelled')),
  optimization_run_at TIMESTAMPTZ,
  optimization_score NUMERIC(5,2),
  total_estimated_cost NUMERIC(15,2),
  total_estimated_fuel_liters NUMERIC(10,2),
  weather_conditions TEXT,
  site_conditions TEXT,
  constraints JSONB, -- {max_vehicles: 50, min_operators: 30, restricted_areas: []}
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Cycle Tracking: Real-time operational cycles
CREATE TABLE IF NOT EXISTS cycle_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES task_assignments(id),
  cycle_number INTEGER NOT NULL,
  cycle_start_time TIMESTAMPTZ NOT NULL,
  cycle_end_time TIMESTAMPTZ,
  
  -- Cycle phases with timestamps
  loading_start_time TIMESTAMPTZ,
  loading_end_time TIMESTAMPTZ,
  travel_loaded_start_time TIMESTAMPTZ,
  travel_loaded_end_time TIMESTAMPTZ,
  dumping_start_time TIMESTAMPTZ,
  dumping_end_time TIMESTAMPTZ,
  travel_empty_start_time TIMESTAMPTZ,
  travel_empty_end_time TIMESTAMPTZ,
  
  -- Performance metrics
  loading_duration_minutes INTEGER,
  travel_loaded_duration_minutes INTEGER,
  dumping_duration_minutes INTEGER,
  travel_empty_duration_minutes INTEGER,
  total_cycle_duration_minutes INTEGER,
  queue_wait_time_minutes INTEGER DEFAULT 0,
  
  -- Load information
  load_weight_tonnes NUMERIC(10,2),
  material_loaded TEXT,
  loader_vehicle_id UUID REFERENCES vehicles(id),
  
  -- Distance and fuel
  distance_traveled_km NUMERIC(10,2),
  fuel_consumed_liters NUMERIC(10,2),
  
  -- GPS tracking
  gps_start_lat NUMERIC(10,6),
  gps_start_lon NUMERIC(10,6),
  gps_end_lat NUMERIC(10,6),
  gps_end_lon NUMERIC(10,6),
  gps_track JSONB, -- Array of GPS points
  
  -- Status and issues
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'interrupted', 'cancelled')),
  issues_encountered TEXT[],
  delay_reasons TEXT[],
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(assignment_id, cycle_number)
);

-- Optimization Scenarios: What-if simulations
CREATE TABLE IF NOT EXISTS optimization_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_name TEXT NOT NULL,
  scenario_type TEXT NOT NULL CHECK (scenario_type IN ('baseline', 'what_if', 'historical_replay', 'predictive')),
  base_shift_plan_id UUID REFERENCES shift_plans(id),
  
  -- Scenario parameters
  parameters JSONB NOT NULL, -- {vehicle_count: 45, fuel_price: 13500, production_target: 5000, ...}
  
  -- Vehicle modifications
  vehicles_added INTEGER DEFAULT 0,
  vehicles_removed INTEGER DEFAULT 0,
  vehicles_unavailable UUID[],
  
  -- Operational modifications
  routes_modified JSONB,
  speed_adjustments JSONB,
  weather_impact_factor NUMERIC(3,2) DEFAULT 1.0,
  
  -- Results
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  run_at TIMESTAMPTZ,
  completion_time TIMESTAMPTZ,
  
  -- Calculated outputs
  estimated_production_tonnes NUMERIC(10,2),
  estimated_total_cycles INTEGER,
  estimated_fuel_consumption_liters NUMERIC(10,2),
  estimated_total_cost NUMERIC(15,2),
  estimated_completion_time TIMESTAMPTZ,
  utilization_rate NUMERIC(5,2),
  
  -- Comparison with baseline
  production_variance_percent NUMERIC(5,2),
  cost_variance_percent NUMERIC(5,2),
  efficiency_score NUMERIC(5,2),
  
  results_detail JSONB, -- Full simulation results
  recommendations TEXT[],
  
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Optimization Constraints: Rules for allocation engine
CREATE TABLE IF NOT EXISTS optimization_constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  constraint_name TEXT NOT NULL,
  constraint_type TEXT NOT NULL CHECK (constraint_type IN ('vehicle_capacity', 'vehicle_compatibility', 'route_restriction', 'time_window', 'operator_qualification', 'fuel_availability', 'maintenance_schedule')),
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  is_hard_constraint BOOLEAN DEFAULT true, -- Hard vs soft constraint
  
  -- Constraint definition
  applies_to TEXT NOT NULL CHECK (applies_to IN ('vehicle', 'driver', 'route', 'site', 'task', 'shift')),
  entity_ids UUID[], -- IDs of entities this applies to
  
  -- Constraint rules
  rules JSONB NOT NULL, -- {min_capacity: 30, max_gradient: 15, allowed_materials: ['bauxite'], ...}
  
  -- Validity
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  
  -- Violation handling
  violation_penalty_score NUMERIC(5,2), -- Penalty for soft constraint violation
  violation_action TEXT CHECK (violation_action IN ('reject', 'warn', 'penalize', 'ignore')),
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Re-optimization Events: Triggers for dynamic re-planning
CREATE TABLE IF NOT EXISTS reoptimization_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('vehicle_breakdown', 'driver_absence', 'route_closure', 'weather_change', 'congestion', 'equipment_failure', 'priority_change', 'manual_trigger')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  
  event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  detected_by TEXT, -- 'system_auto', 'operator', 'supervisor', 'iot_sensor'
  
  -- Event details
  affected_shift_plan_id UUID REFERENCES shift_plans(id),
  affected_task_ids UUID[],
  affected_vehicle_ids UUID[],
  affected_driver_ids UUID[],
  
  event_description TEXT NOT NULL,
  event_data JSONB, -- Detailed event information
  
  -- Re-optimization response
  reoptimization_triggered BOOLEAN DEFAULT false,
  reoptimization_started_at TIMESTAMPTZ,
  reoptimization_completed_at TIMESTAMPTZ,
  reoptimization_status TEXT CHECK (reoptimization_status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
  
  -- Results
  tasks_reassigned INTEGER DEFAULT 0,
  vehicles_reallocated INTEGER DEFAULT 0,
  new_assignments_created INTEGER DEFAULT 0,
  
  recommendations TEXT[],
  actions_taken TEXT[],
  
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Performance KPIs: Calculated metrics for reporting
CREATE TABLE IF NOT EXISTS performance_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_date DATE NOT NULL,
  shift_plan_id UUID REFERENCES shift_plans(id),
  calculation_time TIMESTAMPTZ DEFAULT now(),
  
  -- Utilization metrics
  total_vehicles_available INTEGER,
  total_vehicles_utilized INTEGER,
  vehicle_utilization_rate NUMERIC(5,2),
  total_productive_hours NUMERIC(10,2),
  total_idle_hours NUMERIC(10,2),
  idle_time_rate NUMERIC(5,2),
  
  -- Production metrics
  total_cycles_completed INTEGER,
  total_tonnage_moved NUMERIC(10,2),
  average_cycle_time_minutes NUMERIC(10,2),
  cycles_per_vehicle NUMERIC(5,2),
  tonnes_per_hour NUMERIC(10,2),
  
  -- Wait time analysis
  total_queue_wait_minutes INTEGER,
  average_queue_wait_minutes NUMERIC(10,2),
  max_queue_wait_minutes INTEGER,
  
  -- Fuel efficiency
  total_fuel_consumed_liters NUMERIC(10,2),
  fuel_per_tonne NUMERIC(5,2),
  fuel_per_km NUMERIC(5,2),
  fuel_cost_per_tonne NUMERIC(10,2),
  
  -- Cost metrics
  total_operational_cost NUMERIC(15,2),
  cost_per_tonne NUMERIC(10,2),
  cost_per_cycle NUMERIC(10,2),
  
  -- Performance by operator
  top_performing_drivers UUID[],
  underperforming_drivers UUID[],
  
  -- Delays and issues
  total_delays_minutes INTEGER,
  breakdown_incidents INTEGER,
  unplanned_stops INTEGER,
  
  -- Optimization effectiveness
  plan_vs_actual_variance_percent NUMERIC(5,2),
  reoptimization_events_count INTEGER,
  optimization_effectiveness_score NUMERIC(5,2),
  
  -- Detailed breakdowns
  metrics_by_vehicle JSONB,
  metrics_by_task_type JSONB,
  metrics_by_route JSONB,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_fleet_tasks_status ON fleet_tasks(status);
CREATE INDEX IF NOT EXISTS idx_fleet_tasks_shift ON fleet_tasks(shift_id);
CREATE INDEX IF NOT EXISTS idx_fleet_tasks_planned_start ON fleet_tasks(planned_start_time);
CREATE INDEX IF NOT EXISTS idx_task_assignments_task ON task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_vehicle ON task_assignments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_status ON task_assignments(status);
CREATE INDEX IF NOT EXISTS idx_shift_plans_date ON shift_plans(shift_date);
CREATE INDEX IF NOT EXISTS idx_shift_plans_status ON shift_plans(status);
CREATE INDEX IF NOT EXISTS idx_cycle_tracking_assignment ON cycle_tracking(assignment_id);
CREATE INDEX IF NOT EXISTS idx_cycle_tracking_status ON cycle_tracking(status);
CREATE INDEX IF NOT EXISTS idx_optimization_scenarios_status ON optimization_scenarios(status);
CREATE INDEX IF NOT EXISTS idx_reoptimization_events_time ON reoptimization_events(event_time);
CREATE INDEX IF NOT EXISTS idx_reoptimization_events_resolved ON reoptimization_events(resolved);
CREATE INDEX IF NOT EXISTS idx_performance_kpis_date ON performance_kpis(kpi_date);

-- Enable Row Level Security
ALTER TABLE fleet_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE reoptimization_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_kpis ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow authenticated users to manage optimization
CREATE POLICY "Users can view fleet tasks" ON fleet_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage fleet tasks" ON fleet_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view task assignments" ON task_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage task assignments" ON task_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view shift plans" ON shift_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage shift plans" ON shift_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view cycle tracking" ON cycle_tracking FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage cycle tracking" ON cycle_tracking FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view optimization scenarios" ON optimization_scenarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage optimization scenarios" ON optimization_scenarios FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view optimization constraints" ON optimization_constraints FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage optimization constraints" ON optimization_constraints FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view reoptimization events" ON reoptimization_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage reoptimization events" ON reoptimization_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view performance KPIs" ON performance_kpis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage performance KPIs" ON performance_kpis FOR ALL TO authenticated USING (true) WITH CHECK (true);
