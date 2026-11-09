/*
  # Ajout de donnees pour les evenements de tracking

  1. Donnees ajoutees
    - Evenements de geofencing (entrees/sorties)
    - Evenements de vitesse et conduite
    - Evenements moteur (on/off)
*/

-- Ajouter des evenements de tracking pour les derniers trajets
WITH recent_trips AS (
  SELECT 
    t.id as trip_id,
    t.vehicle_id,
    t.driver_id,
    t.actual_departure_time,
    t.actual_arrival_time,
    v.registration
  FROM trips t
  JOIN vehicles v ON t.vehicle_id = v.id
  WHERE t.status IN ('completed', 'in_progress')
    AND t.actual_departure_time IS NOT NULL
  ORDER BY t.actual_departure_time DESC
  LIMIT 200
)
INSERT INTO tracking_events (
  vehicle_id, 
  driver_id, 
  trip_id, 
  event_type, 
  timestamp, 
  latitude, 
  longitude, 
  speed, 
  severity
)
SELECT 
  vehicle_id,
  driver_id,
  trip_id,
  'engine_on' as event_type,
  actual_departure_time as timestamp,
  11.0833 + (RANDOM() * 0.02 - 0.01) as latitude,
  -13.7500 + (RANDOM() * 0.02 - 0.01) as longitude,
  0 as speed,
  'info' as severity
FROM recent_trips

UNION ALL

SELECT 
  vehicle_id,
  driver_id,
  trip_id,
  'geofence_exit' as event_type,
  actual_departure_time + INTERVAL '5 minutes' as timestamp,
  11.0833 + (RANDOM() * 0.02 - 0.01) as latitude,
  -13.7500 + (RANDOM() * 0.02 - 0.01) as longitude,
  25 + (RANDOM() * 20)::int as speed,
  'info' as severity
FROM recent_trips

UNION ALL

SELECT 
  vehicle_id,
  driver_id,
  trip_id,
  CASE (RANDOM() * 10)::int
    WHEN 0 THEN 'harsh_braking'
    WHEN 1 THEN 'harsh_acceleration'
    WHEN 2 THEN 'speed_violation'
    ELSE 'route_deviation'
  END as event_type,
  actual_departure_time + (RANDOM() * (EXTRACT(EPOCH FROM (actual_arrival_time - actual_departure_time)) / 2))::int * INTERVAL '1 second' as timestamp,
  11.0833 + (RANDOM() * 1.5 - 0.75) as latitude,
  -13.7500 + (RANDOM() * 1.5 - 0.75) as longitude,
  50 + (RANDOM() * 40)::int as speed,
  CASE (RANDOM() * 3)::int
    WHEN 0 THEN 'info'
    WHEN 1 THEN 'warning'
    ELSE 'critical'
  END as severity
FROM recent_trips
WHERE actual_arrival_time IS NOT NULL
  AND RANDOM() < 0.3

UNION ALL

SELECT 
  vehicle_id,
  driver_id,
  trip_id,
  'geofence_entry' as event_type,
  actual_arrival_time - INTERVAL '5 minutes' as timestamp,
  10.6500 + (RANDOM() * 0.02 - 0.01) as latitude,
  -14.5833 + (RANDOM() * 0.02 - 0.01) as longitude,
  15 + (RANDOM() * 10)::int as speed,
  'info' as severity
FROM recent_trips
WHERE actual_arrival_time IS NOT NULL

UNION ALL

SELECT 
  vehicle_id,
  driver_id,
  trip_id,
  'engine_off' as event_type,
  actual_arrival_time as timestamp,
  10.6500 + (RANDOM() * 0.02 - 0.01) as latitude,
  -14.5833 + (RANDOM() * 0.02 - 0.01) as longitude,
  0 as speed,
  'info' as severity
FROM recent_trips
WHERE actual_arrival_time IS NOT NULL;
