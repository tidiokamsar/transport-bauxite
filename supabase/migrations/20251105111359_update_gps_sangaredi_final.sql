/*
  # Positions GPS Sangaredi
*/

DELETE FROM iot_gps_readings;

DO $$
DECLARE
  v_rec RECORD;
  base_lat NUMERIC := 11.0967;
  base_lon NUMERIC := -13.7761;
  route_type INT;
  pos_idx INT;
  total_pos INT := 20;
  lat_off NUMERIC;
  lon_off NUMERIC;
  spd NUMERIC;
  route_dist NUMERIC;
BEGIN
  FOR v_rec IN 
    SELECT id FROM vehicles WHERE status = 'active' ORDER BY registration LIMIT 50
  LOOP
    route_type := (random() * 3)::int;
    
    CASE route_type
      WHEN 0 THEN route_dist := 4.0;
      WHEN 1 THEN route_dist := 8.0;
      ELSE route_dist := 12.0;
    END CASE;
    
    FOR pos_idx IN 1..total_pos LOOP
      lat_off := (route_dist / 111.0) * (pos_idx::numeric / total_pos) * (0.8 + random() * 0.4);
      lon_off := (random() - 0.5) * 0.02;
      
      IF pos_idx <= 3 OR pos_idx >= 18 THEN
        spd := 5 + random() * 10;
      ELSE
        spd := 20 + random() * 20;
      END IF;
      
      INSERT INTO iot_gps_readings (
        vehicle_id, latitude, longitude, speed_kmh, reading_timestamp, ignition_status
      ) VALUES (
        v_rec.id,
        base_lat + lat_off,
        base_lon + lon_off,
        spd,
        NOW() - (interval '1 minute' * (total_pos - pos_idx) * 3),
        spd > 2
      );
    END LOOP;
  END LOOP;
END $$;

DELETE FROM iot_fuel_readings;

DO $$
DECLARE
  v_id uuid;
  f_lvl NUMERIC;
BEGIN
  FOR v_id IN SELECT id FROM vehicles WHERE status = 'active' LIMIT 50
  LOOP
    f_lvl := 40 + random() * 50;
    INSERT INTO iot_fuel_readings (vehicle_id, fuel_level_percentage, fuel_level_liters, reading_timestamp)
    VALUES (v_id, f_lvl, f_lvl * 8, NOW());
  END LOOP;
END $$;
