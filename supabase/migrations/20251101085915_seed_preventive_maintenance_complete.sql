/*
  # Seed Complete Preventive Maintenance Data
  
  1. Purpose
    - Add preventive maintenance schedules for all active vehicles
    - Add historical maintenance orders with correct enum types
    
  2. Data Added
    - 8 maintenance schedules per vehicle (240+ total)
    - 3 completed maintenance orders per vehicle (90+ total)
    - Realistic intervals, costs, and dates
*/

-- Insert preventive maintenance schedules
DO $$
DECLARE
  v_vehicle RECORD;
  v_maintenance_types TEXT[] := ARRAY[
    'Vidange moteur',
    'Changement filtres',
    'Rotation pneus',
    'Inspection freins',
    'Révision complète',
    'Contrôle suspension',
    'Inspection électrique',
    'Graissage général'
  ];
  v_type TEXT;
  v_interval_km INTEGER;
  v_interval_days INTEGER;
  v_last_service_km INTEGER;
  v_last_service_date DATE;
  v_cost NUMERIC;
BEGIN
  FOR v_vehicle IN 
    SELECT id, registration, current_km 
    FROM vehicles 
    WHERE status = 'active'
    LIMIT 30
  LOOP
    FOREACH v_type IN ARRAY v_maintenance_types
    LOOP
      CASE v_type
        WHEN 'Vidange moteur' THEN
          v_interval_km := 10000;
          v_interval_days := 180;
          v_cost := 500000;
        WHEN 'Changement filtres' THEN
          v_interval_km := 15000;
          v_interval_days := 180;
          v_cost := 350000;
        WHEN 'Rotation pneus' THEN
          v_interval_km := 12000;
          v_interval_days := 120;
          v_cost := 200000;
        WHEN 'Inspection freins' THEN
          v_interval_km := 20000;
          v_interval_days := 180;
          v_cost := 750000;
        WHEN 'Révision complète' THEN
          v_interval_km := 30000;
          v_interval_days := 365;
          v_cost := 2000000;
        WHEN 'Contrôle suspension' THEN
          v_interval_km := 25000;
          v_interval_days := 270;
          v_cost := 800000;
        WHEN 'Inspection électrique' THEN
          v_interval_km := 40000;
          v_interval_days := 365;
          v_cost := 600000;
        WHEN 'Graissage général' THEN
          v_interval_km := 5000;
          v_interval_days := 90;
          v_cost := 150000;
        ELSE
          v_interval_km := 15000;
          v_interval_days := 180;
          v_cost := 400000;
      END CASE;
      
      v_last_service_km := GREATEST(0, v_vehicle.current_km - (v_interval_km * (0.2 + random() * 0.6))::INTEGER);
      v_last_service_date := CURRENT_DATE - (v_interval_days * (0.2 + random() * 0.6))::INTEGER;
      
      INSERT INTO maintenance_schedules (
        id,
        vehicle_id,
        title,
        description,
        maintenance_type,
        frequency_type,
        frequency_value,
        last_service_date,
        last_service_km,
        next_service_date,
        next_service_km,
        estimated_cost,
        active,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        v_vehicle.id,
        v_type,
        'Maintenance préventive programmée - ' || v_type,
        CASE 
          WHEN v_type IN ('Vidange moteur', 'Changement filtres') THEN 'routine'
          WHEN v_type IN ('Révision complète', 'Inspection électrique') THEN 'major'
          ELSE 'inspection'
        END,
        'both',
        v_interval_km,
        v_last_service_date,
        v_last_service_km,
        v_last_service_date + v_interval_days,
        v_last_service_km + v_interval_km,
        v_cost,
        true,
        NOW(),
        NOW()
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Add historical maintenance orders
DO $$
DECLARE
  v_vehicle RECORD;
  v_i INTEGER;
  v_work_order_num TEXT;
BEGIN
  FOR v_vehicle IN 
    SELECT id, registration, current_km 
    FROM vehicles 
    WHERE status = 'active'
    LIMIT 30
  LOOP
    FOR v_i IN 1..3 LOOP
      v_work_order_num := 'WO-' || TO_CHAR(CURRENT_DATE - (v_i * 60)::INTEGER, 'YYYYMMDD') || '-' || LPAD((floor(random() * 1000))::TEXT, 4, '0');
      
      INSERT INTO maintenance_orders (
        id,
        vehicle_id,
        work_order_number,
        title,
        request_date,
        scheduled_date,
        completion_date,
        maintenance_type,
        description,
        km_at_maintenance,
        estimated_cost,
        actual_cost,
        labor_hours,
        labor_cost,
        status,
        priority,
        workshop,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        v_vehicle.id,
        v_work_order_num,
        (ARRAY['Vidange moteur', 'Réparation frein', 'Révision complète', 'Changement pneus'])[floor(random() * 4 + 1)],
        CURRENT_DATE - (random() * 180 + v_i * 60)::INTEGER,
        CURRENT_DATE - (random() * 180 + v_i * 60 - 5)::INTEGER,
        CURRENT_DATE - (random() * 180 + v_i * 60 - 10)::INTEGER,
        (ARRAY['preventive', 'corrective'])[floor(random() * 2 + 1)]::maintenance_type,
        'Maintenance effectuée - ' || v_vehicle.registration,
        v_vehicle.current_km - (random() * 10000 * v_i)::INTEGER,
        200000 + (random() * 1500000)::NUMERIC,
        250000 + (random() * 1600000)::NUMERIC,
        (4 + random() * 12)::NUMERIC,
        (50000 + random() * 300000)::NUMERIC,
        'completed',
        (ARRAY['low', 'medium', 'high'])[floor(random() * 3 + 1)],
        (ARRAY['internal', 'external'])[floor(random() * 2 + 1)]::workshop_type,
        NOW(),
        NOW()
      );
    END LOOP;
  END LOOP;
END $$;
