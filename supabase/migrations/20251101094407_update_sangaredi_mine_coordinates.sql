/*
  # Mise à jour des Coordonnées de la Mine de Sangarédi

  1. Corrections
    - Mise à jour des coordonnées exactes de la mine : 11° 05′ 48″ N, 13° 46′ 34″ O
    - Conversion en décimal : 11.0967° N, -13.7761° O
    - Ajustement du rayon de la zone principale
    - Création de zones de sécurité supplémentaires

  2. Détection des violations
    - Fonction pour détecter les véhicules hors zone
    - Création automatique d'alertes
*/

-- Mettre à jour la zone principale de Sangaredi avec les vraies coordonnées
UPDATE geofence_zones 
SET 
  center_lat = 11.0967,
  center_lng = -13.7761,
  radius_meters = 3000,
  description = 'Zone principale d''extraction de bauxite - Mine de Sangarédi (coordonnées exactes)',
  updated_at = now()
WHERE name = 'Mine de Sangaredi - Zone Principale';

-- Mettre à jour les autres zones autour de la vraie mine
UPDATE geofence_zones 
SET 
  center_lat = 11.1050,
  center_lng = -13.7700,
  description = 'Zone de chargement des camions - Secteur Nord (position réelle)',
  updated_at = now()
WHERE name = 'Zone de Chargement - Sangaredi Nord';

UPDATE geofence_zones 
SET 
  center_lat = 11.0880,
  center_lng = -13.7820,
  description = 'Zone de chargement des camions - Secteur Sud (position réelle)',
  updated_at = now()
WHERE name = 'Zone de Chargement - Sangaredi Sud';

UPDATE geofence_zones 
SET 
  center_lat = 11.0920,
  center_lng = -13.7850,
  updated_at = now()
WHERE name = 'Station de Maintenance - Sangaredi';

UPDATE geofence_zones 
SET 
  center_lat = 11.1100,
  center_lng = -13.7600,
  updated_at = now()
WHERE name = 'Zone Interdite - Explosifs';

UPDATE geofence_zones 
SET 
  center_lat = 11.0850,
  center_lng = -13.7900,
  updated_at = now()
WHERE name = 'Zone Interdite - Résidentielle';

UPDATE geofence_zones 
SET 
  center_lat = 11.0980,
  center_lng = -13.7680,
  updated_at = now()
WHERE name = 'Parking Camions - Nuit';

-- Créer une fonction pour vérifier si un véhicule est dans une zone autorisée
CREATE OR REPLACE FUNCTION check_vehicle_in_authorized_zone(
  p_vehicle_id uuid,
  p_latitude numeric,
  p_longitude numeric
)
RETURNS boolean AS $$
DECLARE
  v_in_authorized_zone boolean := false;
  v_zone RECORD;
  v_assignment RECORD;
  v_distance numeric;
BEGIN
  -- Vérifier chaque zone où le véhicule a un accès autorisé
  FOR v_assignment IN 
    SELECT za.*, gz.*
    FROM geofence_zone_assignments za
    JOIN geofence_zones gz ON gz.id = za.zone_id
    WHERE za.vehicle_id = p_vehicle_id
      AND za.access_type = 'allowed'
      AND gz.is_active = true
      AND (za.valid_until IS NULL OR za.valid_until > now())
  LOOP
    -- Pour les zones circulaires
    IF v_assignment.geometry_type = 'circle' THEN
      -- Calculer la distance avec la formule de Haversine
      v_distance := 6371000 * acos(
        cos(radians(p_latitude)) * cos(radians(v_assignment.center_lat)) *
        cos(radians(v_assignment.center_lng) - radians(p_longitude)) +
        sin(radians(p_latitude)) * sin(radians(v_assignment.center_lat))
      );
      
      -- Si le véhicule est dans une zone autorisée
      IF v_distance <= v_assignment.radius_meters THEN
        v_in_authorized_zone := true;
        EXIT;
      END IF;
    END IF;
  END LOOP;
  
  RETURN v_in_authorized_zone;
END;
$$ LANGUAGE plpgsql;

-- Créer une fonction pour générer des alertes pour véhicules hors zone
CREATE OR REPLACE FUNCTION detect_vehicles_out_of_zone()
RETURNS void AS $$
DECLARE
  v_gps RECORD;
  v_in_zone boolean;
  v_violation_id uuid;
BEGIN
  -- Vérifier les positions récentes de tous les véhicules actifs
  FOR v_gps IN 
    SELECT DISTINCT ON (g.vehicle_id) 
      g.id, g.vehicle_id, g.latitude, g.longitude, g.speed_kmh, g.timestamp,
      v.registration_number, t.id as trip_id, t.driver_id
    FROM iot_gps_readings g
    JOIN vehicles v ON v.id = g.vehicle_id
    LEFT JOIN trips t ON t.vehicle_id = v.id AND t.status = 'in_progress'
    WHERE g.timestamp > now() - interval '10 minutes'
    ORDER BY g.vehicle_id, g.timestamp DESC
  LOOP
    -- Vérifier si le véhicule est dans une zone autorisée
    v_in_zone := check_vehicle_in_authorized_zone(
      v_gps.vehicle_id, 
      v_gps.latitude, 
      v_gps.longitude
    );
    
    -- Si le véhicule est hors zone autorisée, créer une violation
    IF NOT v_in_zone THEN
      -- Vérifier qu'une violation similaire n'existe pas déjà (dans les 30 dernières minutes)
      IF NOT EXISTS (
        SELECT 1 FROM geofence_violations
        WHERE vehicle_id = v_gps.vehicle_id
          AND violation_type = 'unauthorized_exit'
          AND status IN ('open', 'acknowledged')
          AND created_at > now() - interval '30 minutes'
      ) THEN
        -- Créer la violation
        INSERT INTO geofence_violations (
          zone_id,
          vehicle_id,
          driver_id,
          trip_id,
          violation_type,
          severity,
          entry_time,
          latitude,
          longitude,
          speed_kmh,
          description,
          status
        )
        SELECT
          gz.id,
          v_gps.vehicle_id,
          v_gps.driver_id,
          v_gps.trip_id,
          'unauthorized_exit',
          'high',
          v_gps.timestamp,
          v_gps.latitude,
          v_gps.longitude,
          v_gps.speed_kmh,
          format('Véhicule %s détecté hors de toutes les zones autorisées', v_gps.registration_number),
          'open'
        FROM geofence_zones gz
        WHERE gz.zone_type = 'mine' AND gz.is_active = true
        LIMIT 1
        RETURNING id INTO v_violation_id;
        
        -- Créer une alerte associée
        IF v_violation_id IS NOT NULL THEN
          INSERT INTO geofence_alerts (
            violation_id,
            zone_id,
            vehicle_id,
            alert_type,
            priority,
            message,
            notification_sent
          )
          SELECT
            v_violation_id,
            gz.id,
            v_gps.vehicle_id,
            'exit',
            'urgent',
            format('🚨 ALERTE: Véhicule %s hors zone autorisée! Position: %.4f, %.4f', 
              v_gps.registration_number, v_gps.latitude, v_gps.longitude),
            false
          FROM geofence_zones gz
          WHERE gz.zone_type = 'mine' AND gz.is_active = true
          LIMIT 1;
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;