/*
  # Infrastructure IoT complète - Final
  
  Système de capteurs carburant et GPS pour flotte DARI HOLDING
*/

-- Tables IoT (voir migration précédente pour détails complets)
CREATE TABLE IF NOT EXISTS iot_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text UNIQUE NOT NULL,
  device_type text CHECK (device_type IN ('fuel_sensor', 'gps_tracker', 'telematic_unit')),
  manufacturer text,
  model text,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  installation_date date,
  api_key text UNIQUE,
  status text DEFAULT 'active',
  configuration jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iot_fuel_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text REFERENCES iot_devices(device_id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id),
  reading_timestamp timestamptz DEFAULT now(),
  fuel_level_liters numeric(10,2) NOT NULL,
  fuel_level_percentage numeric(5,2),
  tank_capacity_liters numeric(10,2),
  location_latitude numeric(10,7),
  location_longitude numeric(10,7),
  is_anomaly boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iot_gps_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text REFERENCES iot_devices(device_id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id),
  reading_timestamp timestamptz DEFAULT now(),
  latitude numeric(10,7) NOT NULL,
  longitude numeric(10,7) NOT NULL,
  speed_kmh numeric(6,2),
  odometer_km numeric(12,2),
  ignition_status boolean,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE iot_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE iot_fuel_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE iot_gps_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read iot devices" ON iot_devices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public insert fuel" ON iot_fuel_readings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Public read fuel" ON iot_fuel_readings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public insert gps" ON iot_gps_readings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Public read gps" ON iot_gps_readings FOR SELECT TO authenticated USING (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_fuel_timestamp ON iot_fuel_readings(reading_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_gps_timestamp ON iot_gps_readings(reading_timestamp DESC);

-- Installation capteurs
INSERT INTO iot_devices (device_id, device_type, manufacturer, model, vehicle_id, installation_date, api_key, configuration)
SELECT 
  'GPS-' || v.registration, 'gps_tracker', 'Teltonika', 'FMB140', v.id, CURRENT_DATE - INTERVAL '90 days',
  'gps_' || substr(md5(random()::text), 1, 12), '{"interval": 30}'::jsonb
FROM vehicles v
ON CONFLICT (device_id) DO NOTHING;

INSERT INTO iot_devices (device_id, device_type, manufacturer, model, vehicle_id, installation_date, api_key, configuration)
SELECT 
  'FUEL-' || v.registration, 'fuel_sensor', 'Omnicomm', 'LLS20160', v.id, CURRENT_DATE - INTERVAL '90 days',
  'fuel_' || substr(md5(random()::text), 1, 12), '{"capacity": 400}'::jsonb
FROM vehicles v
ON CONFLICT (device_id) DO NOTHING;

-- Données GPS
INSERT INTO iot_gps_readings (device_id, vehicle_id, latitude, longitude, speed_kmh, odometer_km, ignition_status)
SELECT 
  d.device_id, d.vehicle_id, -10.7 + (RANDOM() * 0.5), -13.2 + (RANDOM() * 0.5),
  ROUND((RANDOM() * 60)::numeric, 2), ROUND((RANDOM() * 100000 + 50000)::numeric, 2), true
FROM iot_devices d WHERE d.device_type = 'gps_tracker' AND d.vehicle_id IS NOT NULL;

-- Données carburant
INSERT INTO iot_fuel_readings (device_id, vehicle_id, fuel_level_liters, fuel_level_percentage, tank_capacity_liters)
SELECT 
  d.device_id, d.vehicle_id, ROUND((RANDOM() * 300 + 50)::numeric, 2),
  ROUND((RANDOM() * 60 + 20)::numeric, 2), 400
FROM iot_devices d WHERE d.device_type = 'fuel_sensor' AND d.vehicle_id IS NOT NULL;
