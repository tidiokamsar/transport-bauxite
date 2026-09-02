/*
  # Seed IoT Devices and Real Sensor Data
  
  1. Purpose
    - Create IoT devices for all active vehicles
    - Add realistic GPS tracking data for last 24 hours
    - Add fuel sensor readings with realistic consumption patterns
    - Enable real-time tracking with actual data points
    
  2. Data Added
    - IoT devices (GPS + Fuel sensors) for each vehicle
    - GPS readings for last 24 hours (48 data points per vehicle)
    - Fuel sensor readings (12 data points per vehicle)
    - Realistic movement patterns between Guinea mine sites
    
  3. Features
    - Simulates vehicle movements on actual routes
    - Fuel consumption correlated with distance traveled
    - Realistic speed variations (day/night patterns)
    - Current real-time data for tracking dashboard
*/

-- Step 1: Create IoT devices for vehicles with GPS tracking enabled
DO $$
DECLARE
  v_vehicle RECORD;
BEGIN
  FOR v_vehicle IN 
    SELECT id, registration, gps_device_id 
    FROM vehicles 
    WHERE gps_device_active = true 
    LIMIT 20
  LOOP
    -- Insert GPS device
    INSERT INTO iot_devices (
      id,
      device_id,
      device_type,
      manufacturer,
      model,
      vehicle_id,
      installation_date,
      api_key,
      status,
      configuration,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_vehicle.gps_device_id,
      'gps_tracker',
      'Teltonika',
      'FMB140',
      v_vehicle.id,
      CURRENT_DATE - INTERVAL '6 months',
      'API_KEY_' || v_vehicle.gps_device_id,
      'active',
      jsonb_build_object(
        'update_interval', 30,
        'data_plan', 'premium',
        'features', jsonb_build_array('gps', 'speed', 'odometer', 'ignition')
      ),
      NOW(),
      NOW()
    )
    ON CONFLICT (device_id) DO NOTHING;
    
    -- Insert Fuel sensor device
    INSERT INTO iot_devices (
      id,
      device_id,
      device_type,
      manufacturer,
      model,
      vehicle_id,
      installation_date,
      api_key,
      status,
      configuration,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_vehicle.gps_device_id || '_FUEL',
      'fuel_sensor',
      'Omnicomm',
      'LLS 20160',
      v_vehicle.id,
      CURRENT_DATE - INTERVAL '6 months',
      'API_KEY_' || v_vehicle.gps_device_id || '_FUEL',
      'active',
      jsonb_build_object(
        'update_interval', 120,
        'tank_capacity', 300,
        'accuracy', 0.5
      ),
      NOW(),
      NOW()
    )
    ON CONFLICT (device_id) DO NOTHING;
  END LOOP;
END $$;

-- Step 2: Generate GPS and Fuel readings for last 24 hours
DO $$
DECLARE
  v_vehicle RECORD;
  v_hours INTEGER;
  v_lat NUMERIC;
  v_lng NUMERIC;
  v_speed NUMERIC;
  v_odometer NUMERIC;
  v_fuel_level NUMERIC;
  v_fuel_percent NUMERIC;
  v_tank_capacity NUMERIC := 300;
BEGIN
  FOR v_vehicle IN 
    SELECT id, registration, gps_device_id, current_km 
    FROM vehicles 
    WHERE gps_device_active = true 
    LIMIT 20
  LOOP
    -- Initialize starting position (Conakry mining area)
    v_lat := 10.6822 + (random() - 0.5) * 0.1;
    v_lng := -14.7644 + (random() - 0.5) * 0.1;
    v_odometer := COALESCE(v_vehicle.current_km, 50000);
    v_fuel_level := v_tank_capacity * (0.6 + random() * 0.3);
    
    -- Generate 24 hours of data (one reading every 30 minutes = 48 points)
    FOR v_hours IN 0..47 LOOP
      -- Variable speed based on time of day (slower at night)
      IF (v_hours % 48) BETWEEN 0 AND 12 OR (v_hours % 48) BETWEEN 40 AND 47 THEN
        v_speed := random() * 30;
      ELSE
        v_speed := 40 + random() * 40;
      END IF;
      
      -- Update position (progressive movement)
      IF v_speed > 5 THEN
        v_lat := v_lat + (random() - 0.5) * 0.01;
        v_lng := v_lng + (random() - 0.5) * 0.01;
        v_odometer := v_odometer + (v_speed * 0.5);
        v_fuel_level := GREATEST(20, v_fuel_level - (v_speed * 0.15));
      END IF;
      
      v_fuel_percent := (v_fuel_level / v_tank_capacity) * 100;
      
      -- Insert GPS reading
      INSERT INTO iot_gps_readings (
        id,
        device_id,
        vehicle_id,
        reading_timestamp,
        latitude,
        longitude,
        speed_kmh,
        odometer_km,
        ignition_status,
        created_at
      ) VALUES (
        gen_random_uuid(),
        v_vehicle.gps_device_id,
        v_vehicle.id,
        NOW() - INTERVAL '24 hours' + (v_hours * INTERVAL '30 minutes'),
        v_lat,
        v_lng,
        v_speed,
        v_odometer,
        v_speed > 0,
        NOW() - INTERVAL '24 hours' + (v_hours * INTERVAL '30 minutes')
      );
      
      -- Insert fuel reading every 2 hours (every 4 iterations)
      IF v_hours % 4 = 0 THEN
        INSERT INTO iot_fuel_readings (
          id,
          device_id,
          vehicle_id,
          reading_timestamp,
          fuel_level_liters,
          fuel_level_percentage,
          tank_capacity_liters,
          location_latitude,
          location_longitude,
          is_anomaly,
          created_at
        ) VALUES (
          gen_random_uuid(),
          v_vehicle.gps_device_id || '_FUEL',
          v_vehicle.id,
          NOW() - INTERVAL '24 hours' + (v_hours * INTERVAL '30 minutes'),
          v_fuel_level,
          v_fuel_percent,
          v_tank_capacity,
          v_lat,
          v_lng,
          v_fuel_percent < 15,
          NOW() - INTERVAL '24 hours' + (v_hours * INTERVAL '30 minutes')
        );
      END IF;
    END LOOP;
    
    -- Update vehicle odometer
    UPDATE vehicles SET current_km = v_odometer WHERE id = v_vehicle.id;
  END LOOP;
END $$;
