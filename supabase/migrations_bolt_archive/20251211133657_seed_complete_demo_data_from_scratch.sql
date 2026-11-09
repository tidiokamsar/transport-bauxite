/*
  # Données de démonstration complètes depuis zéro
  
  Création de toutes les données nécessaires:
  1. Sites
  2. Clients
  3. Véhicules
  4. Chauffeurs  
  5. Trajets
  6. Incidents
  7. Alertes
  8. Scores (Driver Behavior, Fleet Health, TCO)
  9. Maintenance (Schedules, Predictive)
  10. Coûts et Dépenses
*/

-- ============================================
-- 1. SITES
-- ============================================

INSERT INTO sites (id, name, type, location, active) VALUES
  ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'Mine de Sangarédi', 'mine', '11.0855,-13.7467', true),
  ('b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'Port de Kamsar', 'port', '10.6500,-14.5833', true),
  ('c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'Dépôt Conakry', 'depot', '9.6412,-13.5784', true),
  ('d4e5f6a7-b8c9-7d8e-1f2a-3b4c5d6e7f8a', 'Base Boké', 'base', '10.9333,-14.3000', true),
  ('e5f6a7b8-c9d0-8e9f-2a3b-4c5d6e7f8a9b', 'Atelier Kamsar', 'workshop', '10.6500,-14.5833', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. CLIENTS
-- ============================================

INSERT INTO clients (name, contract_reference, rate_per_tonne, payment_terms_days, active) VALUES
  ('CBG - Compagnie des Bauxites de Guinée', 'CBG-2024-001', 45000, 30, true),
  ('SMB - Société Minière de Boké', 'SMB-2024-002', 42000, 30, true),
  ('Alliance Minière', 'ALLI-2024-003', 40000, 45, true)
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. VÉHICULES (20 camions)
-- ============================================

DO $$
DECLARE
  site_sangaredi uuid := 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
  site_kamsar uuid := 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e';
  brands text[] := ARRAY['HOWO', 'Shacman', 'Beiben', 'FAW', 'Dongfeng'];
  i INTEGER;
BEGIN
  FOR i IN 1..20 LOOP
    INSERT INTO vehicles (
      registration, brand_model, year, capacity_tonnes, vehicle_type,
      current_km, status, site_id, purchase_cost, current_value,
      insurance_expiry, technical_inspection_expiry, gps_device_id, gps_device_active
    ) VALUES (
      'GN-' || lpad(i::text, 4, '0'),
      brands[(i % 5) + 1] || ' ' || (CASE WHEN i % 2 = 0 THEN '6x4' ELSE '8x4' END),
      2018 + (i % 6),
      40 + (i % 3) * 5,
      'tipper',
      50000 + (i * 12543),
      'active',
      CASE WHEN i % 2 = 0 THEN site_sangaredi ELSE site_kamsar END,
      350000000 + (i * 5000000),
      280000000 + (i * 4000000),
      CURRENT_DATE + ((90 + i * 15) * interval '1 day'),
      CURRENT_DATE + ((180 + i * 10) * interval '1 day'),
      'GPS-' || lpad(i::text, 6, '0'),
      true
    );
  END LOOP;
END $$;

-- ============================================
-- 4. CHAUFFEURS (25 chauffeurs)
-- ============================================

DO $$
DECLARE
  i INTEGER;
  prenom text[] := ARRAY['Mamadou', 'Ibrahima', 'Ousmane', 'Alpha', 'Boubacar', 'Mohamed', 'Amadou', 'Sékou', 'Thierno', 'Sory'];
  nom text[] := ARRAY['Diallo', 'Bah', 'Barry', 'Sy', 'Camara', 'Condé', 'Baldé', 'Touré', 'Keita', 'Soumah'];
BEGIN
  FOR i IN 1..25 LOOP
    INSERT INTO drivers (
      name, license_number, license_category, license_expiry,
      hire_date, contract_type, base_salary, status,
      phone, email, employee_id
    ) VALUES (
      prenom[(i % 10) + 1] || ' ' || nom[(i % 10) + 1],
      'PERM-' || lpad((100000 + i)::text, 6, '0'),
      'C, E',
      CURRENT_DATE + ((365 + i * 30) * interval '1 day'),
      CURRENT_DATE - ((365 * 2 + i * 15) * interval '1 day'),
      'CDI',
      4500000 + (i * 50000),
      'active',
      '+224 62' || lpad((1000000 + i * 11111)::text, 7, '0'),
      lower(prenom[(i % 10) + 1]) || '.' || lower(nom[(i % 10) + 1]) || '@dariholding.com',
      'DRV-' || lpad(i::text, 4, '0')
    );
  END LOOP;
END $$;

-- ============================================
-- 5. TRAJETS (100 trajets)
-- ============================================

DO $$
DECLARE
  i INTEGER;
  v_id uuid;
  d_id uuid;
  c_id uuid;
  site_from uuid := 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
  site_to uuid := 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e';
  trip_date date;
  depart_time timestamptz;
  arrive_time timestamptz;
BEGIN
  FOR i IN 1..100 LOOP
    SELECT id INTO v_id FROM vehicles ORDER BY random() LIMIT 1;
    SELECT id INTO d_id FROM drivers ORDER BY random() LIMIT 1;
    SELECT id INTO c_id FROM clients ORDER BY random() LIMIT 1;
    
    trip_date := CURRENT_DATE - ((i / 2) * interval '1 day');
    depart_time := trip_date + time '06:00:00' + ((random() * 120)::int * interval '1 minute');
    arrive_time := depart_time + interval '4 hours' + ((random() * 90)::int * interval '1 minute');
    
    INSERT INTO trips (
      reference, planned_date, vehicle_id, driver_id, client_id,
      departure_site_id, arrival_site_id, estimated_distance_km,
      actual_departure_time, actual_arrival_time,
      km_start, km_end, gross_weight, tare_weight, net_weight, status
    ) VALUES (
      'TRIP-' || to_char(trip_date, 'YYYYMMDD') || '-' || lpad(i::text, 4, '0'),
      trip_date,
      v_id,
      d_id,
      c_id,
      CASE WHEN i % 2 = 0 THEN site_from ELSE site_to END,
      CASE WHEN i % 2 = 0 THEN site_to ELSE site_from END,
      135 + (random() * 15)::numeric,
      depart_time,
      arrive_time,
      50000 + (i * 100),
      50135 + (i * 100) + (random() * 20)::numeric,
      80 + (random() * 10)::numeric,
      35 + (random() * 3)::numeric,
      43 + (random() * 7)::numeric,
      CASE WHEN i <= 90 THEN 'completed' WHEN i <= 95 THEN 'in_progress' ELSE 'planned' END::trip_status
    );
  END LOOP;
END $$;

-- ============================================
-- 6. INCIDENTS (15 incidents)
-- ============================================

DO $$
DECLARE
  trip_rec RECORD;
  counter INTEGER := 0;
BEGIN
  FOR trip_rec IN (
    SELECT id, actual_departure_time 
    FROM trips 
    WHERE actual_departure_time IS NOT NULL AND status = 'completed'
    ORDER BY random() 
    LIMIT 15
  ) LOOP
    INSERT INTO incidents (trip_id, incident_time, description, severity, estimated_cost) VALUES (
      trip_rec.id,
      trip_rec.actual_departure_time + ((1 + random() * 3)::numeric * interval '1 hour'),
      CASE (counter % 8)
        WHEN 0 THEN 'Crevaison route Sangarédi'
        WHEN 1 THEN 'Panne transmission'
        WHEN 2 THEN 'Collision mineure'
        WHEN 3 THEN 'Surchauffe moteur'
        WHEN 4 THEN 'Problème freins'
        WHEN 5 THEN 'Renversement partiel'
        WHEN 6 THEN 'Obstacle routier'
        ELSE 'Retard météo'
      END,
      CASE (counter % 4)
        WHEN 0 THEN 'minor'
        WHEN 1 THEN 'moderate'
        WHEN 2 THEN 'severe'
        ELSE 'critical'
      END::incident_severity,
      1000000 + (random() * 49000000)::numeric
    );
    counter := counter + 1;
  END LOOP;
END $$;

-- ============================================
-- 7. ALERTES (20+ alertes)
-- ============================================

-- Alertes maintenance
INSERT INTO alerts (alert_type, severity, title, message, reference_type, vehicle_id, status)
SELECT 
  'vehicle_maintenance', 'critical',
  'Maintenance urgente - ' || v.registration,
  'Kilométrage: ' || v.current_km || ' km',
  'vehicle', v.id, 'active'
FROM vehicles v
WHERE v.current_km > 150000
ORDER BY v.current_km DESC
LIMIT 5;

-- Alertes assurance
INSERT INTO alerts (alert_type, severity, title, message, reference_type, vehicle_id, status)
SELECT 
  'insurance_expiry',
  CASE 
    WHEN v.insurance_expiry < CURRENT_DATE + interval '15 days' THEN 'warning'
    ELSE 'info'
  END::text,
  'Assurance - ' || v.registration,
  'Expire ' || v.insurance_expiry::text,
  'vehicle', v.id, 'active'
FROM vehicles v
ORDER BY v.insurance_expiry
LIMIT 5;

-- Alertes permis
INSERT INTO alerts (alert_type, severity, title, message, reference_type, driver_id, status)
SELECT 
  'driver_license_expiry',
  CASE 
    WHEN d.license_expiry < CURRENT_DATE + interval '60 days' THEN 'warning'
    ELSE 'info'
  END::text,
  'Permis - ' || d.name,
  'Expire ' || d.license_expiry::text,
  'driver', d.id, 'active'
FROM drivers d
ORDER BY d.license_expiry
LIMIT 5;

-- ============================================
-- 8. DRIVER BEHAVIOR SCORES
-- ============================================

INSERT INTO driver_behavior_scores (
  driver_id, period_start, period_end, overall_score, safety_score, 
  efficiency_score, compliance_score, eco_driving_score, 
  harsh_braking_count, harsh_acceleration_count, speeding_incidents, 
  idle_time_minutes, fatigue_risk_level, accident_risk_score,
  improvement_areas, strengths, training_recommendations, peer_comparison_percentile
)
SELECT 
  d.id,
  CURRENT_DATE - interval '30 days',
  CURRENT_DATE,
  (60 + random() * 40)::integer,
  (55 + random() * 45)::integer,
  (65 + random() * 35)::integer,
  (70 + random() * 30)::integer,
  (60 + random() * 40)::integer,
  (random() * 20)::integer,
  (random() * 25)::integer,
  (random() * 15)::integer,
  (random() * 600)::integer,
  CASE (random() * 4)::int WHEN 0 THEN 'low' WHEN 1 THEN 'medium' WHEN 2 THEN 'high' ELSE 'critical' END,
  (random() * 100)::numeric(5,2),
  jsonb_build_array('Freinage brusque', 'Ralenti élevé'),
  jsonb_build_array('Respect horaires', 'Conduite économique'),
  jsonb_build_array('Formation éco-conduite'),
  (random() * 100)::integer
FROM drivers d;

-- ============================================
-- 9. FLEET HEALTH SCORES
-- ============================================

INSERT INTO fleet_health_scores (
  vehicle_id, overall_score, mechanical_score, performance_score, 
  safety_score, efficiency_score, risk_level, next_maintenance_prediction, 
  confidence_level, predicted_issues, recommendations
)
SELECT 
  v.id,
  (50 + random() * 50)::integer,
  (45 + random() * 55)::integer,
  (55 + random() * 45)::integer,
  (60 + random() * 40)::integer,
  (50 + random() * 50)::integer,
  CASE WHEN random() < 0.2 THEN 'critical' WHEN random() < 0.4 THEN 'high' WHEN random() < 0.7 THEN 'medium' ELSE 'low' END,
  CURRENT_DATE + ((10 + random() * 50)::int * interval '1 day'),
  (70 + random() * 30)::numeric(5,2),
  jsonb_build_array(
    jsonb_build_object('component', 'Freins', 'probability', (random() * 100)::int),
    jsonb_build_object('component', 'Suspension', 'probability', (random() * 100)::int)
  ),
  jsonb_build_array('Inspection freins', 'Contrôle pneus')
FROM vehicles v;

-- ============================================
-- 10. TCO ANALYSIS
-- ============================================

INSERT INTO tco_analysis (
  vehicle_id, analysis_period_months, period_start, period_end,
  acquisition_cost, depreciation, fuel_cost, maintenance_cost, 
  insurance_cost, registration_cost, downtime_cost, total_cost, 
  cost_per_km, cost_per_day, utilization_rate, efficiency_rating, recommendations
)
SELECT 
  v.id, 12,
  CURRENT_DATE - interval '12 months',
  CURRENT_DATE,
  v.purchase_cost, v.purchase_cost * 0.15,
  120000000 + (random() * 80000000)::numeric,
  45000000 + (random() * 35000000)::numeric,
  8000000 + (random() * 4000000)::numeric,
  3000000::numeric,
  5000000 + (random() * 5000000)::numeric,
  v.purchase_cost + 200000000 + (random() * 100000000)::numeric,
  (8000 + random() * 4000)::numeric(10,4),
  (600000 + random() * 400000)::numeric(10,2),
  (70 + random() * 30)::numeric(5,2),
  CASE (random() * 5)::int WHEN 0 THEN 'excellent' WHEN 1 THEN 'good' WHEN 2 THEN 'average' WHEN 3 THEN 'below_average' ELSE 'poor' END,
  jsonb_build_array('Optimiser carburant')
FROM vehicles v;

-- ============================================
-- 11. VEHICLE COSTS (12 mois historique)
-- ============================================

DO $$
DECLARE
  v_rec RECORD;
  month_offset INTEGER;
  period_date DATE;
BEGIN
  FOR v_rec IN SELECT id FROM vehicles LOOP
    FOR month_offset IN 0..11 LOOP
      period_date := (date_trunc('month', CURRENT_DATE) - (month_offset * interval '1 month'))::date;
      
      INSERT INTO vehicle_costs (
        vehicle_id, cost_period, fuel_cost, maintenance_cost, tire_cost, 
        insurance_cost, other_costs, total_cost, distance_traveled, cost_per_km
      ) VALUES (
        v_rec.id, period_date,
        (8000000 + random() * 6000000)::bigint,
        (2000000 + random() * 4000000)::bigint,
        CASE WHEN random() < 0.25 THEN (5000000)::bigint ELSE 0 END,
        CASE WHEN extract(month from period_date) = 1 THEN 8000000::bigint ELSE 0 END,
        (1000000 + random() * 2000000)::bigint,
        (12000000 + random() * 15000000)::bigint,
        (1200 + random() * 800)::integer,
        (8000 + random() * 4000)::numeric
      );
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- 12. MAINTENANCE SCHEDULES
-- ============================================

INSERT INTO maintenance_schedules (
  vehicle_id, title, description, maintenance_type, frequency_type, 
  frequency_value, last_service_date, last_service_km, next_service_date, 
  next_service_km, estimated_cost, active
)
SELECT 
  v.id, 'Vidange moteur', 'Vidange + filtres', 'preventive', 'km', 10000,
  CURRENT_DATE - interval '2 months', v.current_km - 8000,
  CURRENT_DATE + interval '1 month', v.current_km + 2000, 2500000, true
FROM vehicles v;

-- ============================================
-- 13. PREDICTIVE MAINTENANCE
-- ============================================

INSERT INTO predictive_maintenance_models (
  vehicle_id, model_type, prediction_date, failure_probability, 
  predicted_component, recommended_action, estimated_cost, 
  urgency_level, confidence_score, historical_data_points, 
  last_trained_at, status
)
SELECT 
  v.id, 'engine_failure',
  CURRENT_DATE + ((10 + random() * 50)::int * interval '1 day'),
  (20 + random() * 60)::numeric(5,2),
  CASE (random() * 5)::int
    WHEN 0 THEN 'Refroidissement'
    WHEN 1 THEN 'Transmission'
    WHEN 2 THEN 'Freins'
    WHEN 3 THEN 'Suspension'
    ELSE 'Alternateur'
  END,
  'Inspection recommandée',
  (3000000 + random() * 12000000)::numeric,
  CASE WHEN random() < 0.3 THEN 'high' WHEN random() < 0.7 THEN 'medium' ELSE 'low' END,
  (75 + random() * 20)::numeric(5,2),
  (500 + random() * 1000)::integer,
  now() - interval '1 week',
  'active'
FROM vehicles v;
