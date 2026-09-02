/*
  # Import données historiques SIGTB - DARI HOLDING (simplifié)
  
  Configuration initiale du système avec données de démonstration
*/

-- 1. RÈGLES DE DISPATCH
INSERT INTO dispatch_rules (name, priority, rule_type, weight, conditions, is_active) VALUES
('Proximité site', 1, 'distance', 1.0, '{"max_distance_km": 50, "preferred_distance_km": 20}'::jsonb, true),
('Capacité charge optimale', 2, 'load_capacity', 0.9, '{"min_capacity_percentage": 80}'::jsonb, true),
('Performance chauffeur', 3, 'driver_score', 0.85, '{"min_score": 0.7}'::jsonb, true),
('Efficacité carburant', 4, 'fuel_efficiency', 0.8, '{"max_consumption_l_100km": 35}'::jsonb, true),
('Coût optimal', 5, 'cost', 0.75, '{"cost_per_km_max": 5000}'::jsonb, true)
ON CONFLICT DO NOTHING;

-- 2. RÉGLEMENTATIONS CONDUITE GUINÉE
INSERT INTO driving_time_regulations (
  regulation_name, country_code, max_daily_driving_hours, max_weekly_driving_hours,
  max_continuous_driving_hours, min_break_duration_minutes, min_daily_rest_hours,
  min_weekly_rest_hours, is_active, effective_date
) VALUES (
  'Réglementation Transport Guinée 2025', 'GN', 10.0, 56.0, 4.5, 30, 11.0, 45.0, true, '2025-01-01'
) ON CONFLICT DO NOTHING;

-- 3. DISPONIBILITÉ VÉHICULES (temps réel)
INSERT INTO vehicle_availability (vehicle_id, date, status, fuel_level, load_capacity_available, health_score, current_location)
SELECT 
  v.id, CURRENT_DATE,
  CASE WHEN v.status = 'active' THEN 'available' WHEN v.status = 'maintenance' THEN 'maintenance' ELSE 'available' END,
  ROUND((RANDOM() * 50 + 30)::numeric, 2),
  ROUND((RANDOM() * 15 + 20)::numeric, 2),
  ROUND((RANDOM() * 0.3 + 0.7)::numeric, 2),
  jsonb_build_object('latitude', -10.7 + (RANDOM() * 0.5), 'longitude', -13.2 + (RANDOM() * 0.5), 'site', 'Sangaredi')
FROM vehicles v;

-- 4. DISPONIBILITÉ CHAUFFEURS (temps réel)
INSERT INTO driver_availability (driver_id, date, status, hours_worked_today, hours_worked_week, fatigue_score, performance_score, current_location)
SELECT 
  d.id, CURRENT_DATE, 'available',
  ROUND((RANDOM() * 4)::numeric, 2),
  ROUND((RANDOM() * 20 + 10)::numeric, 2),
  ROUND((RANDOM() * 0.3 + 0.1)::numeric, 2),
  ROUND((RANDOM() * 0.2 + 0.8)::numeric, 2),
  jsonb_build_object('latitude', -10.7 + (RANDOM() * 0.5), 'longitude', -13.2 + (RANDOM() * 0.5), 'site', 'Base')
FROM drivers d;

-- 5. SCORES PERFORMANCE VÉHICULES
INSERT INTO performance_scores (entity_type, entity_id, score_date, efficiency_score, reliability_score, safety_score, cost_effectiveness_score, overall_score, metrics)
SELECT 
  'vehicle', v.id, CURRENT_DATE,
  ROUND((RANDOM() * 0.2 + 0.75)::numeric, 2),
  ROUND((RANDOM() * 0.2 + 0.75)::numeric, 2),
  ROUND((RANDOM() * 0.15 + 0.80)::numeric, 2),
  ROUND((RANDOM() * 0.25 + 0.70)::numeric, 2),
  ROUND((RANDOM() * 0.2 + 0.75)::numeric, 2),
  jsonb_build_object(
    'avg_fuel_consumption', ROUND((RANDOM() * 5 + 28)::numeric, 2),
    'maintenance_cost_monthly', ROUND((RANDOM() * 2000000 + 3000000)::numeric, 0),
    'uptime_percentage', ROUND((RANDOM() * 10 + 85)::numeric, 2),
    'trips_completed_monthly', FLOOR(RANDOM() * 30 + 50)
  )
FROM vehicles v;

-- 6. SCORES PERFORMANCE CHAUFFEURS
INSERT INTO performance_scores (entity_type, entity_id, score_date, efficiency_score, reliability_score, safety_score, cost_effectiveness_score, overall_score, metrics)
SELECT 
  'driver', d.id, CURRENT_DATE,
  ROUND((RANDOM() * 0.3 + 0.65)::numeric, 2),
  ROUND((RANDOM() * 0.2 + 0.75)::numeric, 2),
  ROUND((RANDOM() * 0.15 + 0.82)::numeric, 2),
  ROUND((RANDOM() * 0.25 + 0.70)::numeric, 2),
  ROUND((RANDOM() * 0.25 + 0.70)::numeric, 2),
  jsonb_build_object(
    'avg_trip_time_minutes', FLOOR(RANDOM() * 30 + 90),
    'fuel_efficiency_score', ROUND((RANDOM() * 0.2 + 0.75)::numeric, 2),
    'incidents_count', FLOOR(RANDOM() * 3),
    'trips_completed_monthly', FLOOR(RANDOM() * 40 + 60)
  )
FROM drivers d;

-- 7. KPIs DURABILITÉ (7 derniers jours)
INSERT INTO sustainability_kpis (
  kpi_date, period_type, total_co2_emissions_kg, co2_per_tonne_km, 
  total_fuel_consumed_liters, fuel_efficiency_l_per_100km, empty_km_percentage, 
  eco_driving_avg_score, environmental_incidents_count, waste_recycled_percentage, compliance_score
)
SELECT 
  date_series, 'daily',
  ROUND((RANDOM() * 500 + 1200)::numeric, 2),
  ROUND((RANDOM() * 0.002 + 0.008)::numeric, 4),
  ROUND((RANDOM() * 200 + 450)::numeric, 2),
  ROUND((RANDOM() * 3 + 30)::numeric, 2),
  ROUND((RANDOM() * 10 + 15)::numeric, 2),
  ROUND((RANDOM() * 0.15 + 0.75)::numeric, 2),
  FLOOR(RANDOM() * 2)::int,
  ROUND((RANDOM() * 20 + 60)::numeric, 2),
  ROUND((RANDOM() * 0.1 + 0.85)::numeric, 2)
FROM generate_series(
  CURRENT_DATE - INTERVAL '7 days', 
  CURRENT_DATE - INTERVAL '1 day', 
  INTERVAL '1 day'
) date_series;

-- 8. HISTORIQUE OPTIMISATION (3 derniers jours)
INSERT INTO optimization_history (
  optimization_date, optimization_type, vehicles_optimized, missions_optimized, 
  improvement_percentage, cost_saved, time_saved_minutes, fuel_saved_liters, details
) VALUES
(CURRENT_TIMESTAMP - INTERVAL '1 day', 'route_optimization', 12, 45, 15.5, 2500000, 180, 125.5, 
 '{"algorithm": "dynamic_dispatch", "criteria": ["distance", "fuel", "time"]}'::jsonb),
(CURRENT_TIMESTAMP - INTERVAL '2 days', 'vehicle_assignment', 10, 38, 12.3, 1800000, 150, 95.0, 
 '{"algorithm": "greedy_matching", "improvements": "better load distribution"}'::jsonb),
(CURRENT_TIMESTAMP - INTERVAL '3 days', 'driver_scheduling', 15, 52, 18.2, 3200000, 220, 145.0, 
 '{"algorithm": "constraint_optimization", "fatigue_reduction": "20%"}'::jsonb);

-- 9. ÉMISSIONS CARBONE (pour voyages complétés)
INSERT INTO carbon_emissions (trip_id, vehicle_id, emission_date, fuel_consumed_liters, distance_km, co2_emissions_kg, emission_factor, verified)
SELECT 
  t.id, t.vehicle_id, t.planned_date,
  ROUND((RANDOM() * 50 + 80)::numeric, 2) as fuel,
  COALESCE((t.km_end - t.km_start), ROUND((RANDOM() * 100 + 150)::numeric, 2)) as distance,
  ROUND((RANDOM() * 50 + 80)::numeric, 2) * 2.68 as co2,
  2.68, true
FROM trips t
WHERE t.status = 'completed' AND t.vehicle_id IS NOT NULL
LIMIT 20;

-- 10. SESSIONS DE TRAVAIL (historique)
INSERT INTO driver_work_sessions (
  driver_id, session_date, start_time, end_time, total_driving_minutes, 
  total_break_minutes, trips_completed, distance_covered_km, session_type, 
  fatigue_score_start, fatigue_score_end, status
)
SELECT 
  d.id,
  (CURRENT_DATE - (gs || ' days')::interval)::date,
  (CURRENT_TIMESTAMP - (gs || ' days')::interval + '06:00:00'::time),
  (CURRENT_TIMESTAMP - (gs || ' days')::interval + '15:00:00'::time),
  FLOOR(RANDOM() * 180 + 300)::int,
  FLOOR(RANDOM() * 30 + 30)::int,
  FLOOR(RANDOM() * 4 + 2)::int,
  ROUND((RANDOM() * 100 + 150)::numeric, 2),
  'regular',
  ROUND((RANDOM() * 0.2 + 0.1)::numeric, 2),
  ROUND((RANDOM() * 0.3 + 0.3)::numeric, 2),
  'completed'
FROM drivers d
CROSS JOIN generate_series(1, 5) gs
LIMIT 25;

-- 11. SCORES ÉCO-CONDUITE
INSERT INTO eco_driving_scores (
  driver_id, score_date, overall_score, smooth_acceleration_score, 
  smooth_braking_score, optimal_speed_score, idle_time_score, 
  fuel_efficiency_score, harsh_events_count, idle_time_minutes, recommendations
)
SELECT 
  d.id, CURRENT_DATE,
  ROUND((RANDOM() * 0.3 + 0.65)::numeric, 2),
  ROUND((RANDOM() * 0.25 + 0.70)::numeric, 2),
  ROUND((RANDOM() * 0.25 + 0.70)::numeric, 2),
  ROUND((RANDOM() * 0.2 + 0.75)::numeric, 2),
  ROUND((RANDOM() * 0.3 + 0.65)::numeric, 2),
  ROUND((RANDOM() * 0.25 + 0.70)::numeric, 2),
  FLOOR(RANDOM() * 5)::int,
  FLOOR(RANDOM() * 15 + 5)::int,
  ARRAY['Améliorer anticipation', 'Réduire ralenti', 'Maintenir vitesse optimale']
FROM drivers d;

-- 12. AFFECTATIONS DISPATCH (voyages existants)
INSERT INTO dispatch_assignments (
  trip_id, vehicle_id, driver_id, assignment_date, assignment_type, 
  optimization_score, estimated_cost, estimated_duration_minutes, 
  estimated_fuel_consumption, status
)
SELECT 
  t.id, t.vehicle_id, t.driver_id, t.planned_date, 'automatic',
  ROUND((RANDOM() * 0.2 + 0.75)::numeric, 2),
  ROUND((RANDOM() * 1000000 + 3000000)::numeric, 2),
  FLOOR(RANDOM() * 60 + 120)::int,
  ROUND((RANDOM() * 30 + 80)::numeric, 2),
  CASE t.status 
    WHEN 'completed' THEN 'completed' 
    WHEN 'in_progress' THEN 'in_progress' 
    ELSE 'assigned' 
  END
FROM trips t
WHERE t.vehicle_id IS NOT NULL AND t.driver_id IS NOT NULL;
