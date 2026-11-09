/*
  # Ajout de données complètes pour tous les modules
  
  Données ajoutées pour:
  - Sites (avec coordonnées GPS Guinée)
  - Incidents (15 incidents variés)
  - Alertes (20+ alertes actives)
  - Driver Behavior Scores
  - Fleet Health Scores  
  - TCO Analysis
  - Vehicle Costs (12 mois)
  - Maintenance Schedules
  - Predictive Maintenance
  - Expenses (dépenses opérationnelles)
*/

-- ============================================
-- 1. SITES avec coordonnées GPS
-- ============================================

INSERT INTO sites (id, name, type, location, active) VALUES
  ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'Mine de Sangarédi', 'mine', '11.0855,-13.7467', true),
  ('b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'Port de Kamsar', 'port', '10.6500,-14.5833', true),
  ('c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'Dépôt Central Conakry', 'depot', '9.6412,-13.5784', true),
  ('d4e5f6a7-b8c9-7d8e-1f2a-3b4c5d6e7f8a', 'Base Opérationnelle Boké', 'base', '10.9333,-14.3000', true),
  ('e5f6a7b8-c9d0-8e9f-2a3b-4c5d6e7f8a9b', 'Atelier Mécanique Kamsar', 'workshop', '10.6500,-14.5833', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. INCIDENTS
-- ============================================

DO $$
DECLARE
  trip_rec RECORD;
  counter INTEGER := 0;
BEGIN
  FOR trip_rec IN (
    SELECT id, actual_departure_time 
    FROM trips 
    WHERE actual_departure_time IS NOT NULL 
    ORDER BY random() 
    LIMIT 15
  ) LOOP
    INSERT INTO incidents (trip_id, incident_time, description, severity, estimated_cost) VALUES (
      trip_rec.id,
      trip_rec.actual_departure_time + (random() * interval '4 hours'),
      CASE (counter % 8)
        WHEN 0 THEN 'Crevaison sur route Sangarédi-Kamsar'
        WHEN 1 THEN 'Panne mécanique - transmission'
        WHEN 2 THEN 'Accident mineur avec autre véhicule'
        WHEN 3 THEN 'Surchauffe moteur'
        WHEN 4 THEN 'Problème de freinage'
        WHEN 5 THEN 'Renversement partiel chargement'
        WHEN 6 THEN 'Obstacle routier'
        ELSE 'Retard conditions météo'
      END,
      CASE (counter % 4)
        WHEN 0 THEN 'minor'
        WHEN 1 THEN 'moderate'
        WHEN 2 THEN 'severe'
        ELSE 'critical'
      END::incident_severity,
      (1000000 + random() * 49000000)
    );
    counter := counter + 1;
  END LOOP;
END $$;

-- ============================================
-- 3. ALERTES
-- ============================================

-- Alertes maintenance véhicules
INSERT INTO alerts (alert_type, severity, title, message, reference_type, vehicle_id, status)
SELECT 
  'vehicle_maintenance',
  'critical',
  'Maintenance urgente - ' || v.registration,
  'Kilométrage: ' || v.current_km || ' km. Maintenance requise.',
  'vehicle',
  v.id,
  'active'
FROM vehicles v
WHERE v.current_km > 200000
ORDER BY v.current_km DESC
LIMIT 5;

-- Alertes assurance
INSERT INTO alerts (alert_type, severity, title, message, reference_type, vehicle_id, status)
SELECT 
  'insurance_expiry',
  CASE 
    WHEN v.insurance_expiry < CURRENT_DATE THEN 'critical'
    WHEN v.insurance_expiry < CURRENT_DATE + interval '15 days' THEN 'warning'
    ELSE 'info'
  END::text,
  'Assurance - ' || v.registration,
  'Expire le ' || v.insurance_expiry::text,
  'vehicle',
  v.id,
  'active'
FROM vehicles v
WHERE v.insurance_expiry IS NOT NULL
ORDER BY v.insurance_expiry
LIMIT 5;

-- Alertes permis chauffeurs
INSERT INTO alerts (alert_type, severity, title, message, reference_type, driver_id, status)
SELECT 
  'driver_license_expiry',
  CASE 
    WHEN d.license_expiry < CURRENT_DATE THEN 'critical'
    WHEN d.license_expiry < CURRENT_DATE + interval '30 days' THEN 'warning'
    ELSE 'info'
  END::text,
  'Permis - ' || d.name,
  'Expire le ' || d.license_expiry::text,
  'driver',
  d.id,
  'active'
FROM drivers d
WHERE d.license_expiry IS NOT NULL
ORDER BY d.license_expiry
LIMIT 5;

-- Alertes stock bas
INSERT INTO alerts (alert_type, severity, title, message, status)
SELECT 
  'stock_low',
  CASE 
    WHEN si.quantity_in_stock = 0 THEN 'critical'
    ELSE 'warning'
  END::text,
  'Stock bas - ' || si.name,
  'Stock: ' || si.quantity_in_stock || ' (min: ' || si.minimum_threshold || ')',
  'active'
FROM stock_items si
WHERE si.quantity_in_stock <= si.minimum_threshold
LIMIT 5;

-- ============================================
-- 4. DRIVER BEHAVIOR SCORES
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
  jsonb_build_array('Freinage brusque', 'Temps ralenti élevé'),
  jsonb_build_array('Respect horaires', 'Conduite économique'),
  jsonb_build_array('Formation éco-conduite', 'Sensibilisation sécurité'),
  (random() * 100)::integer
FROM drivers d;

-- ============================================
-- 5. FLEET HEALTH SCORES
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
    jsonb_build_object('component', 'Freins', 'probability', (random() * 100)::int, 'severity', 'medium'),
    jsonb_build_object('component', 'Suspension', 'probability', (random() * 100)::int, 'severity', 'low')
  ),
  jsonb_build_array('Inspection freins', 'Vérification refroidissement', 'Contrôle pneus')
FROM vehicles v;

-- ============================================
-- 6. TCO ANALYSIS
-- ============================================

INSERT INTO tco_analysis (
  vehicle_id, analysis_period_months, period_start, period_end,
  acquisition_cost, depreciation, fuel_cost, maintenance_cost, 
  insurance_cost, registration_cost, downtime_cost, total_cost, 
  cost_per_km, cost_per_day, utilization_rate, efficiency_rating, recommendations
)
SELECT 
  v.id,
  12,
  CURRENT_DATE - interval '12 months',
  CURRENT_DATE,
  COALESCE(v.purchase_cost, 0),
  COALESCE(v.purchase_cost, 0) * 0.15,
  120000000 + (random() * 80000000)::numeric(12,2),
  45000000 + (random() * 35000000)::numeric(12,2),
  8000000 + (random() * 4000000)::numeric(12,2),
  3000000::numeric(12,2),
  5000000 + (random() * 5000000)::numeric(12,2),
  COALESCE(v.purchase_cost, 0) + 200000000 + (random() * 100000000)::numeric(12,2),
  (8000 + random() * 4000)::numeric(10,4),
  (600000 + random() * 400000)::numeric(10,2),
  (70 + random() * 30)::numeric(5,2),
  CASE (random() * 5)::int WHEN 0 THEN 'excellent' WHEN 1 THEN 'good' WHEN 2 THEN 'average' WHEN 3 THEN 'below_average' ELSE 'poor' END,
  jsonb_build_array('Optimiser carburant', 'Maintenance préventive', 'Améliorer utilisation')
FROM vehicles v;

-- ============================================
-- 7. VEHICLE COSTS (historique 12 mois)
-- ============================================

DO $$
DECLARE
  v_rec RECORD;
  month_offset INTEGER;
  period_date DATE;
BEGIN
  FOR v_rec IN SELECT id FROM vehicles LIMIT 20 LOOP
    FOR month_offset IN 0..11 LOOP
      period_date := (date_trunc('month', CURRENT_DATE) - (month_offset * interval '1 month'))::date;
      
      INSERT INTO vehicle_costs (
        vehicle_id, cost_period, fuel_cost, maintenance_cost, tire_cost, 
        insurance_cost, other_costs, total_cost, distance_traveled, cost_per_km
      ) VALUES (
        v_rec.id,
        period_date,
        (8000000 + random() * 6000000)::bigint,
        (2000000 + random() * 4000000)::bigint,
        CASE WHEN random() < 0.25 THEN (5000000 + random() * 5000000)::bigint ELSE 0 END,
        CASE WHEN extract(month from period_date) = 1 THEN 8000000::bigint ELSE 0 END,
        (1000000 + random() * 2000000)::bigint,
        (12000000 + random() * 15000000)::bigint,
        (1200 + random() * 800)::integer,
        (8000 + random() * 4000)::numeric(12,2)
      );
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- 8. MAINTENANCE SCHEDULES (préventive)
-- ============================================

INSERT INTO maintenance_schedules (
  vehicle_id, title, description, maintenance_type, frequency_type, 
  frequency_value, last_service_date, last_service_km, next_service_date, 
  next_service_km, estimated_cost, active
)
SELECT 
  v.id,
  'Vidange moteur',
  'Vidange + filtres',
  'preventive',
  'km',
  10000,
  CURRENT_DATE - interval '2 months',
  GREATEST(v.current_km - 8000, 0),
  CURRENT_DATE + interval '1 month',
  v.current_km + 2000,
  2500000,
  true
FROM vehicles v;

INSERT INTO maintenance_schedules (
  vehicle_id, title, description, maintenance_type, frequency_type, 
  frequency_value, last_service_date, last_service_km, next_service_date, 
  next_service_km, estimated_cost, active
)
SELECT 
  v.id,
  'Révision générale',
  'Contrôle complet',
  'preventive',
  'km',
  30000,
  CURRENT_DATE - interval '5 months',
  GREATEST(v.current_km - 25000, 0),
  CURRENT_DATE + interval '2 months',
  v.current_km + 5000,
  8500000,
  true
FROM vehicles v;

-- ============================================
-- 9. PREDICTIVE MAINTENANCE (IA)
-- ============================================

INSERT INTO predictive_maintenance_models (
  vehicle_id, model_type, prediction_date, failure_probability, 
  predicted_component, recommended_action, estimated_cost, 
  urgency_level, confidence_score, historical_data_points, 
  last_trained_at, status
)
SELECT 
  v.id,
  'engine_failure',
  CURRENT_DATE + ((10 + random() * 50)::int * interval '1 day'),
  (20 + random() * 60)::numeric(5,2),
  CASE (random() * 8)::int
    WHEN 0 THEN 'Système refroidissement'
    WHEN 1 THEN 'Transmission'
    WHEN 2 THEN 'Freins avant'
    WHEN 3 THEN 'Suspension arrière'
    WHEN 4 THEN 'Échappement'
    WHEN 5 THEN 'Alternateur'
    WHEN 6 THEN 'Démarreur'
    ELSE 'Embrayage'
  END,
  'Inspection préventive recommandée',
  (3000000 + random() * 12000000)::numeric(12,2),
  CASE WHEN random() < 0.2 THEN 'critical' WHEN random() < 0.5 THEN 'high' WHEN random() < 0.8 THEN 'medium' ELSE 'low' END,
  (75 + random() * 20)::numeric(5,2),
  (500 + random() * 1500)::integer,
  now() - interval '1 week',
  'active'
FROM vehicles v;

-- ============================================
-- 10. EXPENSES (Dépenses)
-- ============================================

DO $$
DECLARE
  cat_carburant uuid;
  cat_maintenance uuid;
  day_offset INTEGER;
  v_id uuid;
BEGIN
  -- Créer catégories si nécessaire
  INSERT INTO cost_categories (name, category_type, description, active) VALUES
    ('Carburant', 'variable', 'Coûts carburant', true),
    ('Maintenance', 'variable', 'Maintenance et réparations', true),
    ('Pneus', 'variable', 'Achat pneus', true),
    ('Assurance', 'fixed', 'Assurances', true),
    ('Péages', 'variable', 'Péages et frais', true)
  ON CONFLICT (name) DO NOTHING;
  
  SELECT id INTO cat_carburant FROM cost_categories WHERE name = 'Carburant' LIMIT 1;
  SELECT id INTO cat_maintenance FROM cost_categories WHERE name = 'Maintenance' LIMIT 1;
  
  FOR day_offset IN 1..50 LOOP
    SELECT id INTO v_id FROM vehicles ORDER BY random() LIMIT 1;
    
    IF random() < 0.7 AND cat_carburant IS NOT NULL THEN
      INSERT INTO expenses (
        expense_number, expense_date, category_id, description, 
        amount, vehicle_id, payment_method, notes
      ) VALUES (
        'EXP-' || to_char(CURRENT_DATE - (day_offset * interval '1 day'), 'YYYYMMDD') || '-' || lpad((random() * 999)::int::text, 3, '0'),
        CURRENT_DATE - (day_offset * interval '1 day'),
        cat_carburant,
        'Ravitaillement',
        (800000 + random() * 1200000)::bigint,
        v_id,
        CASE (random() * 3)::int WHEN 0 THEN 'cash' WHEN 1 THEN 'bank_transfer' ELSE 'mobile_money' END,
        'Plein complet'
      );
    END IF;
    
    IF random() < 0.15 AND cat_maintenance IS NOT NULL THEN
      SELECT id INTO v_id FROM vehicles ORDER BY random() LIMIT 1;
      INSERT INTO expenses (
        expense_number, expense_date, category_id, description, 
        amount, vehicle_id, payment_method, notes
      ) VALUES (
        'EXP-' || to_char(CURRENT_DATE - (day_offset * interval '1 day'), 'YYYYMMDD') || '-M' || lpad((random() * 999)::int::text, 3, '0'),
        CURRENT_DATE - (day_offset * interval '1 day'),
        cat_maintenance,
        'Réparation',
        (2000000 + random() * 8000000)::bigint,
        v_id,
        'bank_transfer',
        'Intervention atelier'
      );
    END IF;
  END LOOP;
END $$;
