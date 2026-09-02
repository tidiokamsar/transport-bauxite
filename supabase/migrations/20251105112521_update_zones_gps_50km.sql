/*
  # Zones géofencing et GPS 50 km
*/

DELETE FROM geofence_violations;
DELETE FROM geofence_zones;

INSERT INTO geofence_zones (
  name, description, zone_type, geometry_type,
  center_lat, center_lng, radius_meters,
  color, is_active, priority,
  alert_on_entry, alert_on_exit, max_speed_kmh
) VALUES 
('Mine Sangaredi 50km', 'Périmètre opérationnel', 'mine', 'circle',
 11.0967, -13.7761, 50000, '#10B981', true, 1, false, true, 60),
 
('Chargement Nord', 'Chargement bauxite', 'loading', 'circle',
 11.1450, -13.7700, 1500, '#3B82F6', true, 2, true, true, 20),
 
('Chargement Sud', 'Chargement', 'loading', 'circle',
 11.0640, -13.7820, 1200, '#3B82F6', true, 2, true, true, 20),
 
('Déchargement Est', 'Déchargement', 'loading', 'circle',
 11.1050, -13.7100, 1000, '#8B5CF6', true, 2, true, true, 15),
 
('Déchargement Ouest', 'Déchargement', 'loading', 'circle',
 11.0880, -13.8400, 1000, '#8B5CF6', true, 2, true, true, 15),
 
('Parking', 'Parking repos', 'parking', 'circle',
 11.0980, -13.7680, 1500, '#F59E0B', true, 3, true, true, null),
 
('Maintenance', 'Atelier', 'maintenance', 'circle',
 11.0920, -13.7850, 600, '#EF4444', true, 3, true, true, 10),
 
('Zone Interdite', 'Interdit', 'restricted', 'circle',
 11.1200, -13.7600, 500, '#DC2626', true, 5, true, true, 0);

DELETE FROM iot_gps_readings;

DO $$
DECLARE
  v_id uuid; z INT; p INT; 
  b_lat NUMERIC := 11.0967; b_lng NUMERIC := -13.7761;
  t_lat NUMERIC; t_lng NUMERIC; c_lat NUMERIC; c_lng NUMERIC; d NUMERIC; s NUMERIC;
BEGIN
  FOR v_id IN SELECT id FROM vehicles WHERE status = 'active' LIMIT 50
  LOOP
    z := (random() * 4)::int;
    CASE z
      WHEN 0 THEN t_lat := 11.1450; t_lng := -13.7700; d := 5 + random() * 3;
      WHEN 1 THEN t_lat := 11.1050; t_lng := -13.7100; d := 8 + random() * 4;
      WHEN 2 THEN t_lat := 11.0640; t_lng := -13.7820; d := 3 + random() * 2;
      ELSE t_lat := 11.0880; t_lng := -13.8400; d := 6 + random() * 4;
    END CASE;
    
    FOR p IN 1..25 LOOP
      c_lat := b_lat + (t_lat - b_lat) * (p::numeric / 25) * (0.9 + random() * 0.2);
      c_lng := b_lng + (t_lng - b_lng) * (p::numeric / 25) * (0.9 + random() * 0.2);
      s := CASE WHEN p <= 3 OR p >= 22 THEN 5 + random() * 10 ELSE 25 + random() * 20 END;
      
      INSERT INTO iot_gps_readings (vehicle_id, latitude, longitude, speed_kmh, reading_timestamp, ignition_status, odometer_km)
      VALUES (v_id, c_lat, c_lng, s, NOW() - (interval '2 minutes' * (25 - p)), s > 2, d * (p::numeric / 25));
    END LOOP;
  END LOOP;
END $$;
