/*
  # Capteurs de Poids, Pneumatiques et Suivi de Trajets

  1. Nouveaux capteurs IoT
    - Capteurs de poids (weight_sensor) pour tonnage en temps réel
    - Capteurs de pression pneumatique (tire_pressure_sensor)
    - Capteurs de température pneumatique (tire_temperature_sensor)

  2. Tables de lectures
    - iot_weight_readings : lectures de poids/tonnage
    - iot_tire_readings : pression et température des pneus
    
  3. Amélioration des trajets
    - Ajout de waypoints (points intermédiaires) pour le trajet
    - Tracking de la position actuelle sur le trajet
    - Calcul de progression
*/

-- Table pour les lectures de poids/tonnage
CREATE TABLE IF NOT EXISTS iot_weight_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL REFERENCES iot_devices(device_id),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  reading_timestamp timestamptz NOT NULL DEFAULT now(),
  gross_weight_kg numeric NOT NULL,
  net_weight_kg numeric,
  tare_weight_kg numeric,
  axle_weights jsonb,
  is_overloaded boolean DEFAULT false,
  location_latitude numeric,
  location_longitude numeric,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weight_readings_vehicle ON iot_weight_readings(vehicle_id, reading_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_weight_readings_timestamp ON iot_weight_readings(reading_timestamp DESC);

-- Table pour les lectures pneumatiques
CREATE TABLE IF NOT EXISTS iot_tire_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL REFERENCES iot_devices(device_id),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  reading_timestamp timestamptz NOT NULL DEFAULT now(),
  tire_position text NOT NULL,
  pressure_psi numeric NOT NULL,
  temperature_celsius numeric,
  tread_depth_mm numeric,
  is_anomaly boolean DEFAULT false,
  anomaly_type text,
  location_latitude numeric,
  location_longitude numeric,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tire_readings_vehicle ON iot_tire_readings(vehicle_id, reading_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tire_readings_anomaly ON iot_tire_readings(vehicle_id) WHERE is_anomaly = true;

-- Table pour les waypoints de trajets
CREATE TABLE IF NOT EXISTS trip_waypoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL,
  waypoint_type text NOT NULL CHECK (waypoint_type IN ('departure', 'intermediate', 'arrival')),
  site_id uuid REFERENCES sites(id),
  location_name text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  planned_arrival_time timestamptz,
  actual_arrival_time timestamptz,
  departure_time timestamptz,
  distance_from_previous_km numeric,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(trip_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_trip_waypoints_trip ON trip_waypoints(trip_id, sequence_number);

-- Table pour le tracking de position sur le trajet
CREATE TABLE IF NOT EXISTS trip_route_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  timestamp timestamptz NOT NULL DEFAULT now(),
  current_latitude numeric NOT NULL,
  current_longitude numeric NOT NULL,
  next_waypoint_id uuid REFERENCES trip_waypoints(id),
  distance_to_next_waypoint_km numeric,
  estimated_arrival_time timestamptz,
  progress_percentage numeric CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  speed_kmh numeric,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_route_tracking_trip ON trip_route_tracking(trip_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_route_tracking_vehicle ON trip_route_tracking(vehicle_id, timestamp DESC);

-- RLS Policies
ALTER TABLE iot_weight_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE iot_tire_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_waypoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_route_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view weight readings"
  ON iot_weight_readings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can view tire readings"
  ON iot_tire_readings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can view trip waypoints"
  ON trip_waypoints FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage trip waypoints"
  ON trip_waypoints FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view route tracking"
  ON trip_route_tracking FOR SELECT
  TO authenticated
  USING (true);

-- Fonction pour calculer la progression sur le trajet
CREATE OR REPLACE FUNCTION calculate_trip_progress(p_trip_id uuid, p_current_lat numeric, p_current_lng numeric)
RETURNS numeric AS $$
DECLARE
  v_total_distance numeric := 0;
  v_distance_covered numeric := 0;
  v_waypoint RECORD;
  v_prev_lat numeric;
  v_prev_lng numeric;
  v_current_segment_passed boolean := false;
BEGIN
  -- Calculer la distance totale du trajet
  FOR v_waypoint IN 
    SELECT latitude, longitude, sequence_number
    FROM trip_waypoints
    WHERE trip_id = p_trip_id
    ORDER BY sequence_number
  LOOP
    IF v_prev_lat IS NOT NULL THEN
      v_total_distance := v_total_distance + (
        6371 * acos(
          LEAST(1.0,
            cos(radians(v_prev_lat)) * cos(radians(v_waypoint.latitude)) *
            cos(radians(v_waypoint.longitude) - radians(v_prev_lng)) +
            sin(radians(v_prev_lat)) * sin(radians(v_waypoint.latitude))
          )
        )
      );
    END IF;
    v_prev_lat := v_waypoint.latitude;
    v_prev_lng := v_waypoint.longitude;
  END LOOP;
  
  -- Calculer la distance parcourue
  v_prev_lat := NULL;
  v_prev_lng := NULL;
  
  FOR v_waypoint IN 
    SELECT latitude, longitude
    FROM trip_waypoints
    WHERE trip_id = p_trip_id
    ORDER BY sequence_number
  LOOP
    IF v_prev_lat IS NOT NULL AND NOT v_current_segment_passed THEN
      v_distance_covered := v_distance_covered + (
        6371 * acos(
          LEAST(1.0,
            cos(radians(v_prev_lat)) * cos(radians(v_waypoint.latitude)) *
            cos(radians(v_waypoint.longitude) - radians(v_prev_lng)) +
            sin(radians(v_prev_lat)) * sin(radians(v_waypoint.latitude))
          )
        )
      );
      
      -- Vérifier si on a dépassé la position actuelle
      IF (6371 * acos(
        LEAST(1.0,
          cos(radians(p_current_lat)) * cos(radians(v_waypoint.latitude)) *
          cos(radians(v_waypoint.longitude) - radians(p_current_lng)) +
          sin(radians(p_current_lat)) * sin(radians(v_waypoint.latitude))
        )
      )) < 1 THEN
        v_current_segment_passed := true;
      END IF;
    END IF;
    v_prev_lat := v_waypoint.latitude;
    v_prev_lng := v_waypoint.longitude;
  END LOOP;
  
  IF v_total_distance > 0 THEN
    RETURN ROUND((v_distance_covered / v_total_distance * 100)::numeric, 2);
  ELSE
    RETURN 0;
  END IF;
END;
$$ LANGUAGE plpgsql;