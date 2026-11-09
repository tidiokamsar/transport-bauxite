/*
  # Relocalisation COMPLÈTE - Mine de Sangarédi
  Coordonnées: 11° 05′ 48″ N, 13° 46′ 34″ O (11.0967, -13.7761)
*/

CREATE OR REPLACE FUNCTION generate_random_position_in_zone(center_lat numeric, center_lng numeric, radius_meters integer)
RETURNS TABLE(latitude numeric, longitude numeric) AS $$
DECLARE
  lat_degree_meters numeric := 111320;
  lng_degree_meters numeric;
  random_angle numeric;
  random_distance numeric;
BEGIN
  lng_degree_meters := 111320 * cos(radians(center_lat));
  random_angle := random() * 2 * pi();
  random_distance := sqrt(random()) * radius_meters;
  latitude := center_lat + (random_distance * sin(random_angle) / lat_degree_meters);
  longitude := center_lng + (random_distance * cos(random_angle) / lng_degree_meters);
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Devices
DO $$ DECLARE v RECORD; BEGIN
  FOR v IN SELECT id, registration FROM vehicles WHERE gps_device_active = true LOOP
    INSERT INTO iot_devices (device_id, device_type, vehicle_id, status) VALUES ('GPS-' || v.registration, 'gps_tracker', v.id, 'active') ON CONFLICT (device_id) DO UPDATE SET status = 'active';
    INSERT INTO iot_devices (device_id, device_type, vehicle_id, status) VALUES ('FUEL-' || v.registration, 'fuel_sensor', v.id, 'active') ON CONFLICT (device_id) DO UPDATE SET status = 'active';
  END LOOP;
END $$;

-- RELOCALISATION
DO $$ DECLARE v RECORD; p RECORD; s numeric; t timestamptz; c int := 0;
BEGIN
  FOR v IN SELECT id, registration FROM vehicles WHERE gps_device_active = true LOOP
    SELECT * INTO p FROM generate_random_position_in_zone(11.0967, -13.7761, 3000);
    s := CASE WHEN random() < 0.7 THEN 15 + random() * 35 ELSE 0 END;
    t := now() - random() * interval '5 minutes';
    INSERT INTO iot_gps_readings (vehicle_id, device_id, latitude, longitude, speed_kmh, reading_timestamp) VALUES (v.id, 'GPS-' || v.registration, p.latitude, p.longitude, s, t);
    INSERT INTO iot_fuel_readings (vehicle_id, device_id, fuel_level_percentage, fuel_level_liters, tank_capacity_liters, reading_timestamp) VALUES (v.id, 'FUEL-' || v.registration, 20 + random() * 70, (20 + random() * 70) * 3, 300, t);
    c := c + 1;
  END LOOP;
  RAISE NOTICE '✓ % véhicules relocalisés', c;
END $$;

-- Trails
DO $$ DECLARE v RECORD; p RECORD; i int;
BEGIN
  FOR v IN SELECT id, registration FROM vehicles WHERE gps_device_active = true LIMIT 10 LOOP
    FOR i IN 1..20 LOOP
      SELECT * INTO p FROM generate_random_position_in_zone(11.0967, -13.7761, 2800);
      INSERT INTO iot_gps_readings (vehicle_id, device_id, latitude, longitude, speed_kmh, reading_timestamp) VALUES (v.id, 'GPS-' || v.registration, p.latitude, p.longitude, 20 + random() * 30, now() - (20 - i) * interval '3 minutes');
    END LOOP;
  END LOOP;
END $$;

-- Stats
DO $$ DECLARE t int; r int; z int; m int; s int;
BEGIN
  SELECT COUNT(*) INTO t FROM vehicles WHERE gps_device_active = true;
  SELECT COUNT(DISTINCT vehicle_id) INTO r FROM iot_gps_readings WHERE reading_timestamp > now() - interval '10 minutes';
  SELECT COUNT(DISTINCT g.vehicle_id) INTO z FROM iot_gps_readings g INNER JOIN (SELECT vehicle_id, MAX(reading_timestamp) mt FROM iot_gps_readings WHERE reading_timestamp > now() - interval '10 minutes' GROUP BY vehicle_id) l ON g.vehicle_id = l.vehicle_id AND g.reading_timestamp = l.mt WHERE (6371000 * acos(LEAST(1.0, cos(radians(g.latitude)) * cos(radians(11.0967)) * cos(radians(-13.7761) - radians(g.longitude)) + sin(radians(g.latitude)) * sin(radians(11.0967))))) <= 3000;
  SELECT COUNT(DISTINCT g.vehicle_id) INTO m FROM iot_gps_readings g INNER JOIN (SELECT vehicle_id, MAX(reading_timestamp) mt FROM iot_gps_readings WHERE reading_timestamp > now() - interval '10 minutes' GROUP BY vehicle_id) l ON g.vehicle_id = l.vehicle_id AND g.reading_timestamp = l.mt WHERE g.speed_kmh > 5;
  s := z - m;
  RAISE NOTICE '╔═══════════════════════════════════════╗';
  RAISE NOTICE '║   MINE DE SANGARÉDI - RELOCALISATION  ║';
  RAISE NOTICE '╚═══════════════════════════════════════╝';
  RAISE NOTICE '📍 11.0967°N, -13.7761°O | Zone 3km';
  RAISE NOTICE '📊 Total: % | Zone: % | 🟢: % | 🟠: %', t, z, m, s;
END $$;