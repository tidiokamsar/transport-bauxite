/*
  # Données de Démonstration - Système de Géofencing (Corrigé)

  1. Zones de Géofencing
    - Mine de Sangaredi (zone principale)
    - Dépôt de Kamsar (port)
    - Route autorisée Sangaredi-Kamsar
    - Zones de chargement
    - Zones interdites
    
  2. Assignations et Violations
    - Assignation des véhicules aux zones
    - Exemples de violations
    - Alertes de test
*/

-- Insérer les zones de géofencing principales
INSERT INTO geofence_zones (
  name, description, zone_type, geometry_type,
  center_lat, center_lng, radius_meters,
  color, is_active, priority,
  alert_on_entry, alert_on_exit, alert_on_dwell,
  max_dwell_minutes, max_speed_kmh
) VALUES 
(
  'Mine de Sangaredi - Zone Principale',
  'Zone principale d''extraction de la mine de Sangaredi',
  'mine',
  'circle',
  10.9503, -14.6235, 5000,
  '#10B981', true, 10,
  true, true, true,
  180, 40
),
(
  'Zone de Chargement - Sangaredi Nord',
  'Zone de chargement des camions - Secteur Nord',
  'loading',
  'circle',
  10.9580, -14.6200, 800,
  '#3B82F6', true, 8,
  true, false, true,
  60, 20
),
(
  'Zone de Chargement - Sangaredi Sud',
  'Zone de chargement des camions - Secteur Sud',
  'loading',
  'circle',
  10.9420, -14.6270, 800,
  '#3B82F6', true, 8,
  true, false, true,
  60, 20
),
(
  'Dépôt Kamsar - Port',
  'Zone portuaire de Kamsar pour déchargement',
  'depot',
  'circle',
  10.6822, -14.5800, 3000,
  '#F59E0B', true, 9,
  true, true, true,
  120, 30
),
(
  'Station de Maintenance - Sangaredi',
  'Atelier de maintenance et réparations',
  'maintenance',
  'circle',
  10.9450, -14.6300, 500,
  '#6366F1', true, 7,
  false, false, true,
  240, 15
),
(
  'Zone Interdite - Explosifs',
  'Zone de stockage des explosifs - ACCÈS INTERDIT',
  'restricted',
  'circle',
  10.9600, -14.6100, 500,
  '#EF4444', true, 10,
  true, true, false,
  0, 0
),
(
  'Zone Interdite - Résidentielle',
  'Zone résidentielle du personnel - ACCÈS CAMIONS INTERDIT',
  'restricted',
  'circle',
  10.9350, -14.6400, 800,
  '#EF4444', true, 9,
  true, true, false,
  0, 20
),
(
  'Parking Camions - Nuit',
  'Zone de stationnement nocturne des camions',
  'parking',
  'circle',
  10.9480, -14.6180, 1200,
  '#8B5CF6', true, 6,
  false, true, false,
  720, 10
),
(
  'Poste de Contrôle Douanier',
  'Contrôle douanier sur la route vers Kamsar',
  'customs',
  'circle',
  10.8200, -14.6000, 300,
  '#EC4899', true, 8,
  true, false, true,
  30, 15
)
ON CONFLICT DO NOTHING;

-- Route principale Sangaredi-Kamsar (polygone le long de la route)
INSERT INTO geofence_zones (
  name, description, zone_type, geometry_type,
  polygon_coordinates,
  color, is_active, priority,
  alert_on_entry, alert_on_exit,
  max_speed_kmh
) VALUES (
  'Route Autorisée Sangaredi-Kamsar',
  'Corridor de transport principal entre la mine et le port',
  'route',
  'polygon',
  '[
    {"lat": 10.9503, "lng": -14.6235},
    {"lat": 10.9400, "lng": -14.6150},
    {"lat": 10.9200, "lng": -14.6000},
    {"lat": 10.8900, "lng": -14.5900},
    {"lat": 10.8500, "lng": -14.5850},
    {"lat": 10.8200, "lng": -14.5900},
    {"lat": 10.7800, "lng": -14.5850},
    {"lat": 10.7400, "lng": -14.5800},
    {"lat": 10.7000, "lng": -14.5800},
    {"lat": 10.6822, "lng": -14.5800},
    {"lat": 10.6822, "lng": -14.5750},
    {"lat": 10.7000, "lng": -14.5750},
    {"lat": 10.7400, "lng": -14.5750},
    {"lat": 10.7800, "lng": -14.5800},
    {"lat": 10.8200, "lng": -14.5850},
    {"lat": 10.8500, "lng": -14.5800},
    {"lat": 10.8900, "lng": -14.5850},
    {"lat": 10.9200, "lng": -14.5950},
    {"lat": 10.9400, "lng": -14.6100},
    {"lat": 10.9503, "lng": -14.6185}
  ]'::jsonb,
  '#10B981', true, 7,
  false, true,
  80
)
ON CONFLICT DO NOTHING;

-- Assigner les zones aux véhicules existants
DO $$
DECLARE
  v_vehicle RECORD;
  v_zone_mine uuid;
  v_zone_depot uuid;
  v_zone_route uuid;
  v_zone_restricted1 uuid;
  v_zone_restricted2 uuid;
BEGIN
  -- Récupérer les IDs des zones principales
  SELECT id INTO v_zone_mine FROM geofence_zones WHERE name = 'Mine de Sangaredi - Zone Principale';
  SELECT id INTO v_zone_depot FROM geofence_zones WHERE name = 'Dépôt Kamsar - Port';
  SELECT id INTO v_zone_route FROM geofence_zones WHERE name = 'Route Autorisée Sangaredi-Kamsar';
  SELECT id INTO v_zone_restricted1 FROM geofence_zones WHERE name = 'Zone Interdite - Explosifs';
  SELECT id INTO v_zone_restricted2 FROM geofence_zones WHERE name = 'Zone Interdite - Résidentielle';
  
  -- Assigner tous les camions benne aux zones autorisées
  FOR v_vehicle IN SELECT id FROM vehicles WHERE vehicle_type = 'tipper' LIMIT 20 LOOP
    -- Zones autorisées
    INSERT INTO geofence_zone_assignments (
      zone_id, vehicle_id, access_type, notify_on_violation
    ) VALUES 
    (v_zone_mine, v_vehicle.id, 'allowed', true),
    (v_zone_depot, v_vehicle.id, 'allowed', true),
    (v_zone_route, v_vehicle.id, 'allowed', true),
    (v_zone_restricted1, v_vehicle.id, 'restricted', true),
    (v_zone_restricted2, v_vehicle.id, 'restricted', true)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Créer des violations de démonstration
DO $$
DECLARE
  v_vehicle_id uuid;
  v_driver_id uuid;
  v_zone_restricted uuid;
  v_trip_id uuid;
BEGIN
  -- Récupérer un véhicule et son conducteur
  SELECT v.id, t.driver_id, t.id INTO v_vehicle_id, v_driver_id, v_trip_id
  FROM vehicles v
  LEFT JOIN trips t ON t.vehicle_id = v.id AND t.status = 'in_progress'
  WHERE v.vehicle_type = 'tipper'
  LIMIT 1;
  
  -- Récupérer la zone interdite
  SELECT id INTO v_zone_restricted FROM geofence_zones WHERE name = 'Zone Interdite - Explosifs';
  
  IF v_vehicle_id IS NOT NULL AND v_zone_restricted IS NOT NULL THEN
    -- Violation 1: Entrée non autorisée
    INSERT INTO geofence_violations (
      zone_id, vehicle_id, driver_id, trip_id,
      violation_type, severity,
      entry_time, latitude, longitude, speed_kmh,
      description, status
    ) VALUES (
      v_zone_restricted, v_vehicle_id, v_driver_id, v_trip_id,
      'unauthorized_entry', 'critical',
      now() - interval '2 hours', 10.9600, -14.6100, 25.5,
      'Entrée non autorisée dans la zone de stockage des explosifs',
      'acknowledged'
    );
    
    -- Violation 2: Dépassement de temps
    INSERT INTO geofence_violations (
      zone_id, vehicle_id, driver_id, trip_id,
      violation_type, severity,
      entry_time, exit_time, duration_minutes,
      latitude, longitude, speed_kmh,
      description, status
    ) VALUES (
      (SELECT id FROM geofence_zones WHERE name = 'Zone de Chargement - Sangaredi Nord'),
      v_vehicle_id, v_driver_id, v_trip_id,
      'overstay', 'medium',
      now() - interval '3 hours', now() - interval '1 hour', 120,
      10.9580, -14.6200, 5.2,
      'Dépassement du temps maximum autorisé en zone de chargement (120 min > 60 min)',
      'open'
    );
    
    -- Violation 3: Excès de vitesse
    INSERT INTO geofence_violations (
      zone_id, vehicle_id, driver_id, trip_id,
      violation_type, severity,
      entry_time, latitude, longitude, speed_kmh,
      description, status
    ) VALUES (
      (SELECT id FROM geofence_zones WHERE name = 'Mine de Sangaredi - Zone Principale'),
      v_vehicle_id, v_driver_id, v_trip_id,
      'speeding', 'high',
      now() - interval '1 hour', 10.9503, -14.6235, 65.0,
      'Excès de vitesse: 65 km/h dans une zone limitée à 40 km/h',
      'investigating'
    );
  END IF;
END $$;

-- Créer des alertes pour les violations
DO $$
DECLARE
  v_violation RECORD;
BEGIN
  FOR v_violation IN SELECT * FROM geofence_violations WHERE status IN ('open', 'acknowledged') LOOP
    INSERT INTO geofence_alerts (
      violation_id, zone_id, vehicle_id,
      alert_type, priority, message,
      notification_sent
    ) VALUES (
      v_violation.id, v_violation.zone_id, v_violation.vehicle_id,
      CASE v_violation.violation_type
        WHEN 'unauthorized_entry' THEN 'entry'
        WHEN 'overstay' THEN 'dwell'
        WHEN 'speeding' THEN 'speed'
        ELSE 'entry'
      END,
      CASE v_violation.severity
        WHEN 'critical' THEN 'urgent'
        WHEN 'high' THEN 'high'
        WHEN 'medium' THEN 'medium'
        ELSE 'low'
      END,
      format('⚠️ Violation de géofencing: %s', v_violation.description),
      true
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;