/*
  # Seed Trips - Correct Schema
  
  1. Seed Data Created
    - 250+ trips with proper schema
    - Uses: reference, departure_site_id, arrival_site_id
    - Weight fields: gross_weight, tare_weight, net_weight
    - Proper timestamps and durations
    - Material types for mining operations
    
  2. Schema Corrections
    - reference instead of trip_number
    - departure_site_id/arrival_site_id instead of origin_id/destination_id
    - gross_weight/tare_weight/net_weight instead of load_weight_tonnes
    - material_type instead of load_description
    - trip_duration_minutes, loading_time_minutes, unloading_time_minutes
    - Status enum: planned, in_progress, completed, cancelled
    
  3. Notes
    - Mining operations: Bauxite, Equipment, Fuel, Materials
    - Realistic timings and weights for 30-50 tonne trucks
    - 70% completed, 15% in_progress, 10% planned, 5% cancelled
*/

DO $$
DECLARE
  v_vehicles UUID[];
  v_drivers UUID[];
  v_sites UUID[];
  v_vehicle_id UUID;
  v_driver_id UUID;
  v_departure_site UUID;
  v_arrival_site UUID;
  v_trip_status trip_status;
  v_net_weight NUMERIC;
  v_tare_weight NUMERIC;
  v_gross_weight NUMERIC;
  v_distance_km NUMERIC;
  v_km_start NUMERIC;
  v_km_end NUMERIC;
  v_planned_date DATE;
  v_departure_time TIMESTAMP;
  v_arrival_time TIMESTAMP;
  v_trip_duration INTEGER;
  v_loading_time INTEGER;
  v_unloading_time INTEGER;
  i INTEGER;
BEGIN
  -- Get arrays of IDs
  SELECT ARRAY_AGG(id) INTO v_vehicles FROM vehicles WHERE status = 'active'::vehicle_status LIMIT 50;
  SELECT ARRAY_AGG(id) INTO v_drivers FROM drivers WHERE status = 'active'::driver_status LIMIT 35;
  SELECT ARRAY_AGG(id) INTO v_sites FROM sites WHERE is_active = true LIMIT 10;
  
  IF array_length(v_vehicles, 1) > 0 AND array_length(v_drivers, 1) > 0 AND array_length(v_sites, 1) > 0 THEN
    FOR i IN 1..250 LOOP
      -- Random selections
      v_vehicle_id := v_vehicles[1 + (random() * (array_length(v_vehicles, 1) - 1))::INTEGER];
      v_driver_id := v_drivers[1 + (random() * (array_length(v_drivers, 1) - 1))::INTEGER];
      v_departure_site := v_sites[1 + (random() * (array_length(v_sites, 1) - 1))::INTEGER];
      v_arrival_site := v_sites[1 + (random() * (array_length(v_sites, 1) - 1))::INTEGER];
      
      -- Ensure departure != arrival
      WHILE v_departure_site = v_arrival_site LOOP
        v_arrival_site := v_sites[1 + (random() * (array_length(v_sites, 1) - 1))::INTEGER];
      END LOOP;
      
      -- Trip parameters
      v_net_weight := (20000 + random() * 35000)::NUMERIC(10,2); -- kg
      v_tare_weight := (8000 + random() * 4000)::NUMERIC(10,2);
      v_gross_weight := v_net_weight + v_tare_weight;
      v_distance_km := (80 + random() * 180)::NUMERIC(10,2);
      v_trip_duration := (120 + random() * 480)::INTEGER; -- minutes
      v_loading_time := (20 + random() * 60)::INTEGER;
      v_unloading_time := (15 + random() * 45)::INTEGER;
      v_planned_date := (CURRENT_DATE - (random() * 180)::INTEGER)::DATE;
      
      -- Get random km_start based on vehicle's current_km
      SELECT current_km INTO v_km_start FROM vehicles WHERE id = v_vehicle_id;
      v_km_start := COALESCE(v_km_start, 100000) - (random() * 50000)::NUMERIC;
      v_km_end := v_km_start + v_distance_km;
      
      -- Status distribution
      v_trip_status := CASE 
        WHEN random() < 0.70 THEN 'completed'::trip_status
        WHEN random() < 0.85 THEN 'in_progress'::trip_status
        WHEN random() < 0.95 THEN 'planned'::trip_status
        ELSE 'cancelled'::trip_status
      END;
      
      -- Set timestamps based on status
      IF v_trip_status = 'planned'::trip_status THEN
        v_departure_time := NULL;
        v_arrival_time := NULL;
      ELSIF v_trip_status = 'in_progress'::trip_status THEN
        v_departure_time := v_planned_date::TIMESTAMP + INTERVAL '6 hours' + (random() * 12)::INTEGER * INTERVAL '1 hour';
        v_arrival_time := NULL;
      ELSIF v_trip_status = 'completed'::trip_status THEN
        v_departure_time := v_planned_date::TIMESTAMP + INTERVAL '6 hours' + (random() * 12)::INTEGER * INTERVAL '1 hour';
        v_arrival_time := v_departure_time + (v_trip_duration || ' minutes')::INTERVAL;
      ELSE -- cancelled
        v_departure_time := NULL;
        v_arrival_time := NULL;
      END IF;
      
      INSERT INTO trips (
        reference,
        planned_date,
        vehicle_id,
        driver_id,
        departure_site_id,
        arrival_site_id,
        estimated_distance_km,
        actual_departure_time,
        actual_arrival_time,
        km_start,
        km_end,
        gross_weight,
        tare_weight,
        net_weight,
        status,
        loading_time_minutes,
        unloading_time_minutes,
        trip_duration_minutes,
        material_type,
        notes
      ) VALUES (
        'TRIP-' || TO_CHAR(v_planned_date, 'YYYYMMDD') || '-' || LPAD(i::TEXT, 4, '0'),
        v_planned_date,
        v_vehicle_id,
        v_driver_id,
        v_departure_site,
        v_arrival_site,
        v_distance_km,
        v_departure_time,
        v_arrival_time,
        v_km_start,
        v_km_end,
        v_gross_weight,
        v_tare_weight,
        v_net_weight,
        v_trip_status,
        CASE WHEN v_trip_status = 'completed'::trip_status THEN v_loading_time ELSE NULL END,
        CASE WHEN v_trip_status = 'completed'::trip_status THEN v_unloading_time ELSE NULL END,
        CASE WHEN v_trip_status = 'completed'::trip_status THEN v_trip_duration ELSE NULL END,
        CASE 
          WHEN i % 4 = 0 THEN 'bauxite'
          WHEN i % 4 = 1 THEN 'equipment'
          WHEN i % 4 = 2 THEN 'fuel'
          ELSE 'materials'
        END,
        CASE 
          WHEN v_trip_status = 'cancelled'::trip_status THEN 'Annulé: ' || (ARRAY['Météo défavorable', 'Panne véhicule', 'Indisponibilité'])[1 + (random() * 2)::INTEGER]
          ELSE NULL
        END
      );
    END LOOP;
  END IF;
END $$;
