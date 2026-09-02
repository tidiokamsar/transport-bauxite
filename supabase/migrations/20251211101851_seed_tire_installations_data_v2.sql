/*
  # Ajout de donnees pour les installations de pneus

  1. Donnees ajoutees
    - Installations de pneus sur vehicules actifs
    - Positions realistes (FL, FR, RL1, RR1, etc.)
    - Dates et kilometrages coherents
*/

-- Ajouter des installations de pneus pour les vehicules existants
WITH tire_vehicle_pairs AS (
  SELECT 
    t.id as tire_id,
    v.id as vehicle_id,
    v.site_id,
    v.current_km,
    v.vehicle_type,
    row_number() OVER (PARTITION BY v.id ORDER BY t.id) as tire_position_num
  FROM tires t
  CROSS JOIN vehicles v
  WHERE t.status = 'active'
    AND v.status = 'active'
)
INSERT INTO tire_installations (tire_id, vehicle_id, site_id, position, install_date, odometer_install, pressure_psi, status)
SELECT 
  tire_id,
  vehicle_id,
  site_id,
  CASE tire_position_num % 6
    WHEN 1 THEN 'FL'
    WHEN 2 THEN 'FR'
    WHEN 3 THEN 'RL1'
    WHEN 4 THEN 'RR1'
    WHEN 5 THEN 'RL2'
    ELSE 'RR2'
  END as position,
  CURRENT_DATE - INTERVAL '60 days' + (RANDOM() * 50)::int * INTERVAL '1 day' as install_date,
  (current_km - (RANDOM() * 5000)::int) as odometer_install,
  CASE 
    WHEN vehicle_type = 'tipper' THEN 110
    WHEN vehicle_type = 'loader' THEN 100
    ELSE 95
  END as pressure_psi,
  'active' as status
FROM tire_vehicle_pairs
WHERE tire_position_num <= 6;
