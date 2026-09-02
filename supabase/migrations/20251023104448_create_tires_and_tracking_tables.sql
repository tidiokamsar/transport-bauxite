/*
  # Create Tires Management and GPS Tracking Tables

  1. New Tables
    - `tires`
      - Complete tire lifecycle tracking (purchase, installation, removal)
      - Brand, model, pricing information
      - Position tracking on vehicles
      - Status management (active, stored, retired)

    - `vehicle_tracking`
      - Real-time GPS location data
      - Speed, heading, engine status
      - Fuel level monitoring
      - Timestamp tracking

    - `geofences`
      - Geographic zones definition (mines, ports, depots)
      - Zone type and radius
      - Entry/exit event triggering

    - `tracking_events`
      - Historical tracking events log
      - Entry/exit geofence events
      - Alert generation
      - Speed violations

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS tires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tire_number text UNIQUE NOT NULL,
  brand text NOT NULL,
  model text NOT NULL,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  purchase_price bigint NOT NULL DEFAULT 0,
  supplier_id uuid REFERENCES customers(id),

  installation_date date,
  removal_date date,
  initial_km integer,
  final_km integer,

  position text,
  status text NOT NULL DEFAULT 'stored' CHECK (status IN ('active', 'stored', 'retired', 'damaged')),

  vehicle_id uuid REFERENCES vehicles(id),

  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicle_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,

  timestamp timestamptz NOT NULL DEFAULT now(),
  latitude decimal(10, 8),
  longitude decimal(11, 8),
  speed integer DEFAULT 0,
  heading integer,

  altitude integer,
  accuracy integer,

  engine_status text DEFAULT 'off' CHECK (engine_status IN ('on', 'off')),
  ignition_status boolean DEFAULT false,

  odometer integer,
  fuel_level integer,
  fuel_rate integer,

  driver_id uuid REFERENCES drivers(id),
  trip_id uuid REFERENCES trips(id),

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_tracking_vehicle ON vehicle_tracking(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_tracking_timestamp ON vehicle_tracking(timestamp DESC);

CREATE TABLE IF NOT EXISTS geofences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  zone_type text NOT NULL CHECK (zone_type IN ('mine', 'port', 'depot', 'station', 'garage', 'client', 'custom')),

  center_latitude decimal(10, 8) NOT NULL,
  center_longitude decimal(11, 8) NOT NULL,
  radius_meters integer NOT NULL DEFAULT 500,

  polygon_coordinates jsonb,

  description text,
  active boolean DEFAULT true,

  notify_on_entry boolean DEFAULT false,
  notify_on_exit boolean DEFAULT false,
  max_stay_duration interval,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  driver_id uuid REFERENCES drivers(id),
  trip_id uuid REFERENCES trips(id),

  event_type text NOT NULL CHECK (event_type IN (
    'geofence_entry', 'geofence_exit', 'speed_violation',
    'harsh_braking', 'harsh_acceleration', 'idle_excessive',
    'route_deviation', 'offline', 'online', 'engine_on', 'engine_off'
  )),

  timestamp timestamptz NOT NULL DEFAULT now(),
  latitude decimal(10, 8),
  longitude decimal(11, 8),

  geofence_id uuid REFERENCES geofences(id),

  speed integer,
  details jsonb,
  severity text DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),

  acknowledged boolean DEFAULT false,
  acknowledged_by uuid REFERENCES auth.users(id),
  acknowledged_at timestamptz,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_vehicle ON tracking_events(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_timestamp ON tracking_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_events_type ON tracking_events(event_type);

ALTER TABLE tires ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tires"
  ON tires FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert tires"
  ON tires FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update tires"
  ON tires FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete tires"
  ON tires FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Users can view tracking data"
  ON vehicle_tracking FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert tracking data"
  ON vehicle_tracking FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view geofences"
  ON geofences FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage geofences"
  ON geofences FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view tracking events"
  ON tracking_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert tracking events"
  ON tracking_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can acknowledge events"
  ON tracking_events FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'gps_device_id'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN gps_device_id text;
    ALTER TABLE vehicles ADD COLUMN gps_device_active boolean DEFAULT false;
  END IF;
END $$;
