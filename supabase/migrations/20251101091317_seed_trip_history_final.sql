/*
  # Seed Trip History with GPS Routes (Final)
  
  Create completed trips with full GPS route data
*/

DO $$
DECLARE
  v_trip_id UUID;
  v_vehicle_id UUID;
  v_driver_id UUID;
  v_departure_site UUID;
  v_arrival_site UUID;
  v_trip_date DATE;
  v_start_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
  v_departure_lat NUMERIC := 10.6822; -- Conakry
  v_departure_lng NUMERIC := -14.7644;
  v_arrival_lat NUMERIC;
  v_arrival_lng NUMERIC;
  v_current_lat NUMERIC;
  v_current_lng NUMERIC;
  v_distance NUMERIC;
  v_duration_hours NUMERIC;
  v_num_points INTEGER;
  v_i INTEGER;
  v_progress NUMERIC;
  v_speed NUMERIC;
  v_km_start NUMERIC;
  v_km_end NUMERIC;
  v_sites UUID[] := ARRAY(SELECT id FROM sites LIMIT 5);
BEGIN
  FOR trip_num IN 1..30 LOOP
    SELECT id INTO v_vehicle_id FROM vehicles WHERE status = 'active' ORDER BY random() LIMIT 1;
    SELECT id INTO v_driver_id FROM drivers WHERE status = 'active' ORDER BY random() LIMIT 1;
    
    v_departure_site := v_sites[1 + floor(random() * array_length(v_sites, 1))::INTEGER];
    v_arrival_site := v_sites[1 + floor(random() * array_length(v_sites, 1))::INTEGER];
    
    -- Different arrival coordinates
    v_arrival_lat := 10.6822 + (random() - 0.5) * 0.5;
    v_arrival_lng := -14.7644 + (random() - 0.5) * 0.5;
    
    v_trip_date := CURRENT_DATE - (trip_num || ' days')::INTERVAL;
    v_distance := 50 + random() * 100;
    v_duration_hours := 1 + random() * 3;
    v_num_points := 80 + floor(random() * 120)::INTEGER;
    
    v_start_time := v_trip_date + (6 + random() * 6)::INTEGER * INTERVAL '1 hour';
    v_end_time := v_start_time + (v_duration_hours || ' hours')::INTERVAL;
    
    SELECT COALESCE(current_km, 50000) INTO v_km_start FROM vehicles WHERE id = v_vehicle_id;
    v_km_end := v_km_start + v_distance;
    
    INSERT INTO trips (
      id, reference, planned_date, vehicle_id, driver_id,
      departure_site_id, arrival_site_id, estimated_distance_km,
      actual_departure_time, actual_arrival_time, km_start, km_end,
      gross_weight, tare_weight, net_weight, status,
      created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      'TRIP-' || TO_CHAR(v_trip_date, 'YYYYMMDD') || '-' || LPAD(trip_num::TEXT, 4, '0'),
      v_trip_date, v_vehicle_id, v_driver_id,
      v_departure_site, v_arrival_site, v_distance,
      v_start_time, v_end_time, v_km_start, v_km_end,
      70000 + random() * 10000, 20000, 50000 + random() * 10000,
      'completed', v_start_time - INTERVAL '1 day', v_end_time
    ) RETURNING id INTO v_trip_id;
    
    FOR v_i IN 0..v_num_points-1 LOOP
      v_progress := v_i::NUMERIC / v_num_points;
      v_current_lat := v_departure_lat + (v_arrival_lat - v_departure_lat) * v_progress + (random() - 0.5) * 0.005;
      v_current_lng := v_departure_lng + (v_arrival_lng - v_departure_lng) * v_progress + (random() - 0.5) * 0.005;
      v_speed := CASE WHEN v_i % 20 = 0 THEN 0 ELSE 40 + random() * 40 END;
      
      INSERT INTO trip_routes (
        trip_id, vehicle_id, sequence_number,
        latitude, longitude, speed_kmh, heading, timestamp
      ) VALUES (
        v_trip_id, v_vehicle_id, v_i,
        v_current_lat, v_current_lng, v_speed,
        CASE WHEN v_arrival_lat > v_departure_lat THEN 45 ELSE 225 END,
        v_start_time + (v_progress * v_duration_hours || ' hours')::INTERVAL
      );
    END LOOP;
    
    UPDATE vehicles SET current_km = v_km_end WHERE id = v_vehicle_id;
  END LOOP;
END $$;
