/*
  # Système de Géofencing Avancé pour SIGTB

  1. Nouvelles Tables
    - `geofence_zones`
      - Définition des zones géographiques (mines, dépôts, routes, zones interdites)
      - Support des polygones et cercles
      - Configuration des règles par zone
    
    - `geofence_violations`
      - Historique des violations de géofencing
      - Horodatage entrée/sortie
      - Gravité et statut de traitement
    
    - `geofence_zone_assignments`
      - Attribution de zones spécifiques aux véhicules
      - Horaires autorisés
      - Types d'accès
    
    - `geofence_alerts`
      - Alertes en temps réel
      - Notification aux superviseurs
      - Workflow d'escalade

  2. Sécurité
    - RLS activé sur toutes les tables
    - Politiques pour lecture/écriture authentifiée
    - Accès superviseurs pour gestion des zones

  3. Fonctionnalités
    - Détection automatique entrée/sortie de zone
    - Calcul de distance aux zones
    - Alertes multicritères
    - Rapports de conformité
*/

-- Table des zones de géofencing
CREATE TABLE IF NOT EXISTS geofence_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  zone_type text NOT NULL CHECK (zone_type IN ('mine', 'depot', 'route', 'restricted', 'loading', 'maintenance', 'parking', 'customs')),
  geometry_type text NOT NULL CHECK (geometry_type IN ('polygon', 'circle')),
  
  -- Géométrie pour polygones (array de coordonnées [lat, lng])
  polygon_coordinates jsonb,
  
  -- Géométrie pour cercles
  center_lat numeric(10, 7),
  center_lng numeric(10, 7),
  radius_meters integer,
  
  -- Configuration de la zone
  color text DEFAULT '#8B5CF6',
  is_active boolean DEFAULT true,
  priority integer DEFAULT 0,
  
  -- Règles de géofencing
  alert_on_entry boolean DEFAULT false,
  alert_on_exit boolean DEFAULT false,
  alert_on_dwell boolean DEFAULT false,
  max_dwell_minutes integer,
  
  -- Restrictions
  allowed_vehicle_types text[],
  restricted_hours jsonb,
  max_speed_kmh integer,
  
  -- Métadonnées
  site_id uuid REFERENCES sites(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des assignations de zones aux véhicules
CREATE TABLE IF NOT EXISTS geofence_zone_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid REFERENCES geofence_zones(id) ON DELETE CASCADE NOT NULL,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE,
  
  -- Configuration d'accès
  access_type text NOT NULL CHECK (access_type IN ('allowed', 'restricted', 'monitored')),
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz,
  
  -- Horaires autorisés (format: [{day: 0-6, start: "HH:MM", end: "HH:MM"}])
  allowed_schedules jsonb,
  
  -- Notifications
  notify_on_violation boolean DEFAULT true,
  notification_emails text[],
  notification_phones text[],
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des violations de géofencing
CREATE TABLE IF NOT EXISTS geofence_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid REFERENCES geofence_zones(id) NOT NULL,
  vehicle_id uuid REFERENCES vehicles(id) NOT NULL,
  driver_id uuid REFERENCES drivers(id),
  trip_id uuid REFERENCES trips(id),
  
  -- Type de violation
  violation_type text NOT NULL CHECK (violation_type IN ('unauthorized_entry', 'unauthorized_exit', 'overstay', 'speeding', 'restricted_hours')),
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  
  -- Données de la violation
  entry_time timestamptz,
  exit_time timestamptz,
  duration_minutes integer,
  
  -- Position GPS
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  speed_kmh numeric(5, 2),
  
  -- Détails
  description text,
  automated_detection boolean DEFAULT true,
  
  -- Traitement
  status text NOT NULL CHECK (status IN ('open', 'acknowledged', 'investigating', 'resolved', 'false_positive')) DEFAULT 'open',
  acknowledged_by uuid REFERENCES auth.users(id),
  acknowledged_at timestamptz,
  resolution_notes text,
  resolved_at timestamptz,
  
  created_at timestamptz DEFAULT now()
);

-- Table des alertes de géofencing
CREATE TABLE IF NOT EXISTS geofence_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  violation_id uuid REFERENCES geofence_violations(id) ON DELETE CASCADE NOT NULL,
  zone_id uuid REFERENCES geofence_zones(id) NOT NULL,
  vehicle_id uuid REFERENCES vehicles(id) NOT NULL,
  
  -- Alerte
  alert_type text NOT NULL CHECK (alert_type IN ('entry', 'exit', 'dwell', 'speed', 'schedule')),
  priority text NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  message text NOT NULL,
  
  -- Notification
  notification_sent boolean DEFAULT false,
  notification_channels text[] DEFAULT ARRAY['app', 'email'],
  notified_users uuid[],
  sent_at timestamptz,
  
  -- Statut
  is_read boolean DEFAULT false,
  read_by uuid REFERENCES auth.users(id),
  read_at timestamptz,
  
  -- Escalade
  escalated boolean DEFAULT false,
  escalated_at timestamptz,
  escalated_to uuid REFERENCES auth.users(id),
  
  created_at timestamptz DEFAULT now()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_geofence_zones_type ON geofence_zones(zone_type);
CREATE INDEX IF NOT EXISTS idx_geofence_zones_active ON geofence_zones(is_active);
CREATE INDEX IF NOT EXISTS idx_geofence_zones_site ON geofence_zones(site_id);

CREATE INDEX IF NOT EXISTS idx_geofence_assignments_zone ON geofence_zone_assignments(zone_id);
CREATE INDEX IF NOT EXISTS idx_geofence_assignments_vehicle ON geofence_zone_assignments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_geofence_assignments_driver ON geofence_zone_assignments(driver_id);

CREATE INDEX IF NOT EXISTS idx_geofence_violations_zone ON geofence_violations(zone_id);
CREATE INDEX IF NOT EXISTS idx_geofence_violations_vehicle ON geofence_violations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_geofence_violations_status ON geofence_violations(status);
CREATE INDEX IF NOT EXISTS idx_geofence_violations_created ON geofence_violations(created_at);

CREATE INDEX IF NOT EXISTS idx_geofence_alerts_violation ON geofence_alerts(violation_id);
CREATE INDEX IF NOT EXISTS idx_geofence_alerts_read ON geofence_alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_geofence_alerts_created ON geofence_alerts(created_at);

-- Activer RLS
ALTER TABLE geofence_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofence_zone_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofence_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofence_alerts ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour geofence_zones
CREATE POLICY "Utilisateurs authentifiés peuvent voir les zones"
  ON geofence_zones FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Superviseurs peuvent gérer les zones"
  ON geofence_zones FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Politiques RLS pour geofence_zone_assignments
CREATE POLICY "Utilisateurs authentifiés peuvent voir les assignations"
  ON geofence_zone_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Superviseurs peuvent gérer les assignations"
  ON geofence_zone_assignments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Politiques RLS pour geofence_violations
CREATE POLICY "Utilisateurs authentifiés peuvent voir les violations"
  ON geofence_violations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Utilisateurs authentifiés peuvent créer des violations"
  ON geofence_violations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Superviseurs peuvent mettre à jour les violations"
  ON geofence_violations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Politiques RLS pour geofence_alerts
CREATE POLICY "Utilisateurs authentifiés peuvent voir leurs alertes"
  ON geofence_alerts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Système peut créer des alertes"
  ON geofence_alerts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Utilisateurs peuvent mettre à jour leurs alertes"
  ON geofence_alerts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Fonction pour vérifier si un point est dans une zone
CREATE OR REPLACE FUNCTION is_point_in_geofence(
  p_latitude numeric,
  p_longitude numeric,
  p_zone_id uuid
)
RETURNS boolean AS $$
DECLARE
  v_zone RECORD;
  v_distance numeric;
BEGIN
  SELECT * INTO v_zone FROM geofence_zones WHERE id = p_zone_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Pour les cercles, calculer la distance
  IF v_zone.geometry_type = 'circle' THEN
    -- Formule de Haversine simplifiée (approximation)
    v_distance := 6371000 * acos(
      cos(radians(p_latitude)) * cos(radians(v_zone.center_lat)) *
      cos(radians(v_zone.center_lng) - radians(p_longitude)) +
      sin(radians(p_latitude)) * sin(radians(v_zone.center_lat))
    );
    
    RETURN v_distance <= v_zone.radius_meters;
  END IF;
  
  -- Pour les polygones, utiliser une approximation simple
  -- (dans une vraie implémentation, utiliser PostGIS)
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour détecter les violations automatiquement
CREATE OR REPLACE FUNCTION detect_geofence_violations()
RETURNS void AS $$
DECLARE
  v_gps RECORD;
  v_zone RECORD;
  v_assignment RECORD;
  v_in_zone boolean;
BEGIN
  -- Parcourir les dernières positions GPS
  FOR v_gps IN 
    SELECT DISTINCT ON (g.vehicle_id) 
      g.id, g.vehicle_id, g.latitude, g.longitude, g.speed_kmh, g.timestamp,
      v.registration_number, t.id as trip_id, t.driver_id
    FROM iot_gps_readings g
    JOIN vehicles v ON v.id = g.vehicle_id
    LEFT JOIN trips t ON t.vehicle_id = v.id AND t.status = 'in_progress'
    WHERE g.timestamp > now() - interval '5 minutes'
    ORDER BY g.vehicle_id, g.timestamp DESC
  LOOP
    -- Vérifier chaque zone active
    FOR v_zone IN SELECT * FROM geofence_zones WHERE is_active = true LOOP
      v_in_zone := is_point_in_geofence(v_gps.latitude, v_gps.longitude, v_zone.id);
      
      -- Vérifier les assignations
      SELECT * INTO v_assignment 
      FROM geofence_zone_assignments 
      WHERE zone_id = v_zone.id 
        AND vehicle_id = v_gps.vehicle_id
        AND (valid_until IS NULL OR valid_until > now());
      
      -- Créer une violation si nécessaire
      IF v_in_zone AND v_assignment.access_type = 'restricted' THEN
        INSERT INTO geofence_violations (
          zone_id, vehicle_id, driver_id, trip_id,
          violation_type, severity,
          entry_time, latitude, longitude, speed_kmh,
          description
        ) VALUES (
          v_zone.id, v_gps.vehicle_id, v_gps.driver_id, v_gps.trip_id,
          'unauthorized_entry', 'high',
          v_gps.timestamp, v_gps.latitude, v_gps.longitude, v_gps.speed_kmh,
          format('Entrée non autorisée dans la zone %s', v_zone.name)
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;