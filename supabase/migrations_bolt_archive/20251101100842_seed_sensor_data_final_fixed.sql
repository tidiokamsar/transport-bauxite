/*
  # Données Capteurs et Trajets - FINAL
*/

ALTER TABLE iot_devices DROP CONSTRAINT IF EXISTS iot_devices_device_type_check;
ALTER TABLE iot_devices ADD CONSTRAINT iot_devices_device_type_check 
  CHECK (device_type = ANY (ARRAY['fuel_sensor'::text, 'gps_tracker'::text, 'telematic_unit'::text, 'weight_sensor'::text, 'tire_pressure_sensor'::text]));

DO $$
DECLARE
  v_id uuid;
  v_reg text;
BEGIN
  FOR v_id, v_reg IN SELECT id, registration FROM vehicles WHERE gps_device_active = true ORDER BY registration LOOP
    INSERT INTO iot_devices (device_id, device_type, vehicle_id, status) VALUES ('WEIGHT-' || v_reg, 'weight_sensor', v_id, 'active') ON CONFLICT DO NOTHING;
    INSERT INTO iot_devices (device_id, device_type, vehicle_id, status) VALUES ('TIRE-FL-' || v_reg, 'tire_pressure_sensor', v_id, 'active') ON CONFLICT DO NOTHING;
    INSERT INTO iot_devices (device_id, device_type, vehicle_id, status) VALUES ('TIRE-FR-' || v_reg, 'tire_pressure_sensor', v_id, 'active') ON CONFLICT DO NOTHING;
    INSERT INTO iot_devices (device_id, device_type, vehicle_id, status) VALUES ('TIRE-RL-' || v_reg, 'tire_pressure_sensor', v_id, 'active') ON CONFLICT DO NOTHING;
    INSERT INTO iot_devices (device_id, device_type, vehicle_id, status) VALUES ('TIRE-RR-' || v_reg, 'tire_pressure_sensor', v_id, 'active') ON CONFLICT DO NOTHING;
  END LOOP;
  RAISE NOTICE '✓ Devices créés';
END $$;

DO $$
DECLARE
  v_veh_id uuid; v_reg text; v_trip_id uuid; v_dr uuid; c int := 0;
BEGIN
  SELECT id INTO v_dr FROM drivers LIMIT 1;
  FOR v_veh_id, v_reg IN SELECT id, registration FROM vehicles WHERE gps_device_active = true LIMIT 10 LOOP
    INSERT INTO trips (reference, vehicle_id, driver_id, status, planned_date, actual_departure_time, gross_weight, net_weight, estimated_distance_km)
    VALUES ('TRP-' || to_char(now(), 'YYYYMMDD') || '-' || substring(v_reg, 3), v_veh_id, v_dr, 'in_progress', now(), now() - interval '2 hours', 45000 + random() * 10000, 40000 + random() * 8000, 90)
    RETURNING id INTO v_trip_id;
    INSERT INTO trip_waypoints (trip_id, sequence_number, waypoint_type, location_name, latitude, longitude, actual_arrival_time, departure_time) VALUES (v_trip_id, 1, 'departure', 'Mine Sangarédi', 11.0967, -13.7761, now() - interval '2h', now() - interval '2h');
    INSERT INTO trip_waypoints (trip_id, sequence_number, waypoint_type, location_name, latitude, longitude, actual_arrival_time) VALUES (v_trip_id, 2, 'intermediate', 'CP1', 10.95, -13.9, now() - interval '90min');
    INSERT INTO trip_waypoints (trip_id, sequence_number, waypoint_type, location_name, latitude, longitude, actual_arrival_time) VALUES (v_trip_id, 3, 'intermediate', 'CP2', 10.8, -14.2, now() - interval '40min');
    INSERT INTO trip_waypoints (trip_id, sequence_number, waypoint_type, location_name, latitude, longitude, planned_arrival_time) VALUES (v_trip_id, 4, 'arrival', 'Port Kamsar', 10.6667, -14.6333, now() + interval '1h');
    c := c + 1;
  END LOOP;
  RAISE NOTICE '✓ % trajets', c;
END $$;

DO $$
DECLARE
  v_id uuid; v_reg text; v_lat numeric; v_lng numeric; v_w numeric;
BEGIN
  FOR v_id, v_reg, v_lat, v_lng IN 
    SELECT v.id, v.registration, g.latitude, g.longitude
    FROM vehicles v JOIN iot_gps_readings g ON g.vehicle_id = v.id
    JOIN (SELECT vehicle_id, MAX(reading_timestamp) mt FROM iot_gps_readings GROUP BY vehicle_id) l ON g.vehicle_id = l.vehicle_id AND g.reading_timestamp = l.mt
    WHERE v.gps_device_active = true LIMIT 15
  LOOP
    v_w := 40000 + random() * 15000;
    INSERT INTO iot_weight_readings (device_id, vehicle_id, reading_timestamp, gross_weight_kg, net_weight_kg, tare_weight_kg, axle_weights, is_overloaded, location_latitude, location_longitude)
    VALUES ('WEIGHT-' || v_reg, v_id, now() - interval '3min', v_w, v_w - 8000, 8000, jsonb_build_object('front', (v_w * 0.35)::int, 'rear', (v_w * 0.65)::int), v_w > 50000, v_lat, v_lng);
  END LOOP;
  RAISE NOTICE '✓ Poids';
END $$;

DO $$
DECLARE
  v_id uuid; v_reg text; v_lat numeric; v_lng numeric; p numeric; t numeric;
BEGIN
  FOR v_id, v_reg, v_lat, v_lng IN 
    SELECT v.id, v.registration, g.latitude, g.longitude
    FROM vehicles v JOIN iot_gps_readings g ON g.vehicle_id = v.id
    JOIN (SELECT vehicle_id, MAX(reading_timestamp) mt FROM iot_gps_readings GROUP BY vehicle_id) l ON g.vehicle_id = l.vehicle_id AND g.reading_timestamp = l.mt
    WHERE v.gps_device_active = true LIMIT 15
  LOOP
    p := 90 + random() * 20; t := 45 + random() * 15;
    INSERT INTO iot_tire_readings VALUES (gen_random_uuid(), 'TIRE-FL-' || v_reg, v_id, now(), 'FL', p, t, 12 + random() * 8, p < 80, null, v_lat, v_lng, now());
    p := 90 + random() * 20; t := 45 + random() * 15;
    INSERT INTO iot_tire_readings VALUES (gen_random_uuid(), 'TIRE-FR-' || v_reg, v_id, now(), 'FR', p, t, 12 + random() * 8, p < 80, null, v_lat, v_lng, now());
    p := 90 + random() * 20; t := 45 + random() * 15;
    INSERT INTO iot_tire_readings VALUES (gen_random_uuid(), 'TIRE-RL-' || v_reg, v_id, now(), 'RL', p, t, 12 + random() * 8, p < 80, null, v_lat, v_lng, now());
    p := 90 + random() * 20; t := 45 + random() * 15;
    INSERT INTO iot_tire_readings VALUES (gen_random_uuid(), 'TIRE-RR-' || v_reg, v_id, now(), 'RR', p, t, 12 + random() * 8, p < 80, null, v_lat, v_lng, now());
  END LOOP;
  RAISE NOTICE '✓ Pneus';
END $$;