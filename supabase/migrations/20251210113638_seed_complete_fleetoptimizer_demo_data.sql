/*
  # Seed Complete FleetOptimizer Demo Data
  
  Comprehensive demonstration data including:
  - Complete cycle tracking for active tasks
  - Re-optimization events with resolutions
  - Optimization scenarios (baseline, what-if variations)
  - Additional shift plans for future days
*/

-- Add more shift plans for upcoming days
INSERT INTO shift_plans (
  plan_number,
  shift_date,
  shift_type,
  shift_start_time,
  shift_end_time,
  target_production_tonnes,
  allocated_vehicles_count,
  allocated_loaders_count,
  allocated_drivers_count,
  status,
  optimization_score,
  total_estimated_cost,
  total_estimated_fuel_liters,
  weather_conditions,
  site_conditions
)
SELECT
  'SHIFT-' || TO_CHAR(CURRENT_DATE + i, 'YYYYMMDD') || '-M',
  CURRENT_DATE + i,
  'morning',
  (CURRENT_DATE + i) + INTERVAL '6 hours',
  (CURRENT_DATE + i) + INTERVAL '14 hours',
  4500 + (random() * 500)::INTEGER,
  40,
  8,
  40,
  CASE WHEN i = 0 THEN 'active' WHEN i = 1 THEN 'approved' ELSE 'draft' END,
  82 + (random() * 10)::NUMERIC(5,2),
  24000000 + (random() * 2000000)::INTEGER,
  3400 + (random() * 200)::INTEGER,
  (ARRAY['Clear sunny', 'Partly cloudy', 'Light rain'])[1 + (random() * 2)::INTEGER],
  'Normal operations'
FROM generate_series(1, 3) i
WHERE NOT EXISTS (
  SELECT 1 FROM shift_plans WHERE shift_date = CURRENT_DATE + i AND shift_type = 'morning'
);

-- Add cycle tracking for in-progress tasks
DO $$
DECLARE
  v_assignment RECORD;
  v_cycle_num INTEGER;
BEGIN
  FOR v_assignment IN
    SELECT ta.id, ta.task_id, ft.estimated_duration_minutes
    FROM task_assignments ta
    JOIN fleet_tasks ft ON ft.id = ta.task_id
    WHERE ta.status = 'in_progress'
    LIMIT 20
  LOOP
    FOR v_cycle_num IN 1..3 LOOP
      INSERT INTO cycle_tracking (
        assignment_id,
        cycle_number,
        cycle_start_time,
        cycle_end_time,
        loading_start_time,
        loading_end_time,
        travel_loaded_start_time,
        travel_loaded_end_time,
        dumping_start_time,
        dumping_end_time,
        travel_empty_start_time,
        travel_empty_end_time,
        loading_duration_minutes,
        travel_loaded_duration_minutes,
        dumping_duration_minutes,
        travel_empty_duration_minutes,
        total_cycle_duration_minutes,
        queue_wait_time_minutes,
        load_weight_tonnes,
        material_loaded,
        distance_traveled_km,
        fuel_consumed_liters,
        gps_start_lat,
        gps_start_lon,
        gps_end_lat,
        gps_end_lon,
        status
      ) VALUES (
        v_assignment.id,
        v_cycle_num,
        CURRENT_TIMESTAMP - (4 - v_cycle_num) * INTERVAL '45 minutes',
        CURRENT_TIMESTAMP - (4 - v_cycle_num) * INTERVAL '45 minutes' + INTERVAL '42 minutes',
        CURRENT_TIMESTAMP - (4 - v_cycle_num) * INTERVAL '45 minutes',
        CURRENT_TIMESTAMP - (4 - v_cycle_num) * INTERVAL '45 minutes' + INTERVAL '8 minutes',
        CURRENT_TIMESTAMP - (4 - v_cycle_num) * INTERVAL '45 minutes' + INTERVAL '8 minutes',
        CURRENT_TIMESTAMP - (4 - v_cycle_num) * INTERVAL '45 minutes' + INTERVAL '23 minutes',
        CURRENT_TIMESTAMP - (4 - v_cycle_num) * INTERVAL '45 minutes' + INTERVAL '23 minutes',
        CURRENT_TIMESTAMP - (4 - v_cycle_num) * INTERVAL '45 minutes' + INTERVAL '28 minutes',
        CURRENT_TIMESTAMP - (4 - v_cycle_num) * INTERVAL '45 minutes' + INTERVAL '28 minutes',
        CURRENT_TIMESTAMP - (4 - v_cycle_num) * INTERVAL '45 minutes' + INTERVAL '42 minutes',
        (6 + random() * 4)::INTEGER,
        (12 + random() * 6)::INTEGER,
        (3 + random() * 3)::INTEGER,
        (10 + random() * 5)::INTEGER,
        (38 + random() * 8)::INTEGER,
        (1 + random() * 4)::INTEGER,
        (28 + random() * 12)::NUMERIC(10,2),
        'bauxite',
        (85 + random() * 35)::NUMERIC(10,2),
        (35 + random() * 15)::NUMERIC(10,2),
        11.0667,
        -13.7833,
        10.6667,
        -14.5833,
        'completed'
      );
    END LOOP;
  END LOOP;
END $$;

-- Add re-optimization events
DO $$
DECLARE
  v_shift_id UUID;
BEGIN
  SELECT id INTO v_shift_id FROM shift_plans WHERE shift_date = CURRENT_DATE AND shift_type = 'morning' LIMIT 1;
  
  IF v_shift_id IS NOT NULL THEN
    INSERT INTO reoptimization_events (
      event_type,
      severity,
      event_time,
      detected_by,
      affected_shift_plan_id,
      event_description,
      event_data,
      reoptimization_triggered,
      reoptimization_started_at,
      reoptimization_completed_at,
      reoptimization_status,
      tasks_reassigned,
      vehicles_reallocated,
      new_assignments_created,
      recommendations,
      actions_taken,
      resolved,
      resolved_at
    ) VALUES
    (
      'vehicle_breakdown',
      'high',
      CURRENT_TIMESTAMP - INTERVAL '45 minutes',
      'iot_sensor',
      v_shift_id,
      'Vehicle GN-015-1015 engine failure detected at loading zone',
      '{"vehicle": "GN-015-1015", "location": "Loading Zone 2", "error": "ENGINE_OVERHEAT", "temp": 105}'::jsonb,
      true,
      CURRENT_TIMESTAMP - INTERVAL '44 minutes',
      CURRENT_TIMESTAMP - INTERVAL '42 minutes',
      'completed',
      3,
      1,
      2,
      ARRAY['Reassign tasks to available backup vehicles', 'Send maintenance team immediately', 'Monitor similar vehicles'],
      ARRAY['Tasks reassigned to GN-028 and GN-031', 'Maintenance order created', 'Vehicle towed to depot'],
      true,
      CURRENT_TIMESTAMP - INTERVAL '30 minutes'
    ),
    (
      'congestion',
      'medium',
      CURRENT_TIMESTAMP - INTERVAL '20 minutes',
      'system_auto',
      v_shift_id,
      'Loading queue exceeding threshold at Zone 1',
      '{"zone": "Loading Zone 1", "queue": 6, "wait_time": 18}'::jsonb,
      true,
      CURRENT_TIMESTAMP - INTERVAL '19 minutes',
      CURRENT_TIMESTAMP - INTERVAL '17 minutes',
      'completed',
      4,
      4,
      0,
      ARRAY['Redirect to alternative zones', 'Increase loader capacity', 'Balance distribution'],
      ARRAY['4 vehicles redirected to Zone 2', 'Loader operator alerted', 'Queue reduced to 3 min'],
      true,
      CURRENT_TIMESTAMP - INTERVAL '15 minutes'
    ),
    (
      'driver_absence',
      'medium',
      CURRENT_TIMESTAMP - INTERVAL '3 hours',
      'operator',
      v_shift_id,
      'Driver no-show for shift - 2 vehicles affected',
      '{"driver": "Driver-042", "reason": "sick_leave", "vehicles": 2}'::jsonb,
      true,
      CURRENT_TIMESTAMP - INTERVAL '3 hours',
      CURRENT_TIMESTAMP - INTERVAL '2 hours 55 minutes',
      'completed',
      2,
      2,
      2,
      ARRAY['Assign backup drivers', 'Adjust task priorities', 'Notify HR department'],
      ARRAY['Backup drivers assigned', 'Tasks rescheduled', 'HR notified'],
      true,
      CURRENT_TIMESTAMP - INTERVAL '2 hours 50 minutes'
    );
  END IF;
END $$;

-- Add optimization scenarios
DO $$
DECLARE
  v_shift_id UUID;
BEGIN
  SELECT id INTO v_shift_id FROM shift_plans WHERE shift_date = CURRENT_DATE AND shift_type = 'morning' LIMIT 1;
  
  IF v_shift_id IS NOT NULL THEN
    -- Scenario 1: Reduce vehicles
    INSERT INTO optimization_scenarios (
      scenario_name,
      scenario_type,
      base_shift_plan_id,
      parameters,
      vehicles_removed,
      status,
      run_at,
      completion_time,
      estimated_production_tonnes,
      estimated_total_cycles,
      estimated_fuel_consumption_liters,
      estimated_total_cost,
      utilization_rate,
      production_variance_percent,
      cost_variance_percent,
      efficiency_score,
      recommendations
    ) VALUES (
      'Réduction: 35 véhicules (-5)',
      'what_if',
      v_shift_id,
      '{"vehicle_count": 35, "loader_count": 8, "fuel_price_gnf": 13500, "target_tonnes": 4500, "shift_hours": 8}'::jsonb,
      5,
      'completed',
      CURRENT_TIMESTAMP - INTERVAL '2 hours',
      CURRENT_TIMESTAMP - INTERVAL '1 hour 58 minutes',
      4280,
      595,
      3080,
      22100000,
      92.3,
      -4.9,
      -10.9,
      88.7,
      ARRAY['Utilisation plus élevée', 'Production -220 tonnes', 'Économie 2.7M GNF', 'Recommandé pour jours de faible demande']
    );
    
    -- Scenario 2: Increase vehicles
    INSERT INTO optimization_scenarios (
      scenario_name,
      scenario_type,
      base_shift_plan_id,
      parameters,
      vehicles_added,
      status,
      run_at,
      completion_time,
      estimated_production_tonnes,
      estimated_total_cycles,
      estimated_fuel_consumption_liters,
      estimated_total_cost,
      utilization_rate,
      production_variance_percent,
      cost_variance_percent,
      efficiency_score,
      recommendations
    ) VALUES (
      'Augmentation: 45 véhicules (+5)',
      'what_if',
      v_shift_id,
      '{"vehicle_count": 45, "loader_count": 10, "fuel_price_gnf": 13500, "target_tonnes": 4500, "shift_hours": 8}'::jsonb,
      5,
      'completed',
      CURRENT_TIMESTAMP - INTERVAL '1 hour 30 minutes',
      CURRENT_TIMESTAMP - INTERVAL '1 hour 28 minutes',
      4780,
      765,
      3920,
      27600000,
      81.2,
      6.2,
      11.3,
      82.1,
      ARRAY['Production +280 tonnes', 'Utilisation plus faible', 'Coût +2.8M GNF', 'Non rentable pour demande actuelle', 'Chargeuses deviennent goulot']
    );
    
    -- Scenario 3: Fuel price increase
    INSERT INTO optimization_scenarios (
      scenario_name,
      scenario_type,
      base_shift_plan_id,
      parameters,
      status,
      run_at,
      completion_time,
      estimated_production_tonnes,
      estimated_total_cycles,
      estimated_fuel_consumption_liters,
      estimated_total_cost,
      utilization_rate,
      production_variance_percent,
      cost_variance_percent,
      efficiency_score,
      recommendations
    ) VALUES (
      'Impact augmentation carburant +15%',
      'what_if',
      v_shift_id,
      '{"vehicle_count": 40, "loader_count": 8, "fuel_price_gnf": 15525, "target_tonnes": 4500, "shift_hours": 8}'::jsonb,
      'completed',
      CURRENT_TIMESTAMP - INTERVAL '1 hour',
      CURRENT_TIMESTAMP - INTERVAL '58 minutes',
      4520,
      680,
      3480,
      28300000,
      87.5,
      0.4,
      14.1,
      85.3,
      ARRAY['Production inchangée', 'Coût +3.5M GNF par shift', 'Impact majeur sur rentabilité', 'Optimiser consommation prioritaire']
    );
    
    -- Scenario 4: Weather impact
    INSERT INTO optimization_scenarios (
      scenario_name,
      scenario_type,
      base_shift_plan_id,
      parameters,
      status,
      run_at,
      completion_time,
      estimated_production_tonnes,
      estimated_total_cycles,
      estimated_fuel_consumption_liters,
      estimated_total_cost,
      utilization_rate,
      production_variance_percent,
      cost_variance_percent,
      efficiency_score,
      recommendations
    ) VALUES (
      'Conditions météo défavorables (pluie)',
      'what_if',
      v_shift_id,
      '{"vehicle_count": 40, "loader_count": 8, "fuel_price_gnf": 13500, "weather_impact": 0.85, "target_tonnes": 4500}'::jsonb,
      'completed',
      CURRENT_TIMESTAMP - INTERVAL '45 minutes',
      CURRENT_TIMESTAMP - INTERVAL '43 minutes',
      3830,
      580,
      3650,
      24500000,
      87.5,
      -14.9,
      -1.2,
      78.5,
      ARRAY['Production -670 tonnes', 'Temps cycle +15%', 'Consommation +5%', 'Planifier réserve capacité', 'Considérer report tâches non urgentes']
    );
    
    -- Scenario 5: Optimal production increase
    INSERT INTO optimization_scenarios (
      scenario_name,
      scenario_type,
      base_shift_plan_id,
      parameters,
      vehicles_added,
      status,
      run_at,
      completion_time,
      estimated_production_tonnes,
      estimated_total_cycles,
      estimated_fuel_consumption_liters,
      estimated_total_cost,
      utilization_rate,
      production_variance_percent,
      cost_variance_percent,
      efficiency_score,
      recommendations
    ) VALUES (
      'Optimum: 42 véhicules + 9 chargeuses',
      'what_if',
      v_shift_id,
      '{"vehicle_count": 42, "loader_count": 9, "fuel_price_gnf": 13500, "target_tonnes": 4800, "shift_hours": 8}'::jsonb,
      2,
      'completed',
      CURRENT_TIMESTAMP - INTERVAL '30 minutes',
      CURRENT_TIMESTAMP - INTERVAL '28 minutes',
      4850,
      720,
      3620,
      25800000,
      89.2,
      7.8,
      4.0,
      91.5,
      ARRAY['Meilleur équilibre coût/production', '+350 tonnes vs baseline', 'Utilisation optimale 89%', 'Recommandé comme nouvelle baseline', 'ROI positif avec +7.8% production']
    );
  END IF;
END $$;

-- Update some scenarios to pending for testing the "Run" feature
UPDATE optimization_scenarios 
SET status = 'pending', 
    run_at = NULL,
    completion_time = NULL,
    estimated_production_tonnes = NULL,
    estimated_total_cycles = NULL,
    estimated_fuel_consumption_liters = NULL,
    estimated_total_cost = NULL,
    utilization_rate = NULL,
    production_variance_percent = NULL,
    cost_variance_percent = NULL,
    efficiency_score = NULL
WHERE scenario_name LIKE '%Optimum%';
