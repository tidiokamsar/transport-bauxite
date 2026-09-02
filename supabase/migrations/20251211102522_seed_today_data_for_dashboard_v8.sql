/*
  # Ajout de donnees pour aujourd'hui

  1. Donnees ajoutees
    - Voyages pour aujourd'hui
    - Maintenances planifiees pour aujourd'hui
    - Stock carburant mis a jour
*/

-- Ajouter des voyages pour aujourd'hui
WITH ranked_combinations AS (
  SELECT 
    v.id as vehicle_id,
    d.id as driver_id,
    s1.id as departure_site_id,
    s2.id as arrival_site_id,
    ws.id as shift_id,
    ws.start_time,
    row_number() OVER (ORDER BY v.id, d.id, ws.shift_order) as rn
  FROM vehicles v
  CROSS JOIN drivers d
  CROSS JOIN sites s1
  CROSS JOIN sites s2
  CROSS JOIN work_shifts ws
  WHERE v.status = 'active'
    AND d.status = 'active'
    AND s1.type = 'mine'
    AND s2.type = 'port'
)
INSERT INTO trips (
  reference,
  vehicle_id,
  driver_id,
  departure_site_id,
  arrival_site_id,
  shift_id,
  status,
  planned_date,
  actual_departure_time,
  estimated_distance_km,
  material_type
)
SELECT 
  'TRP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(rn::text, 4, '0') as reference,
  vehicle_id,
  driver_id,
  departure_site_id,
  arrival_site_id,
  shift_id,
  (CASE (RANDOM() * 3)::int
    WHEN 0 THEN 'planned'
    WHEN 1 THEN 'in_progress'
    ELSE 'completed'
  END)::trip_status as status,
  CURRENT_DATE as planned_date,
  CASE 
    WHEN (RANDOM() * 3)::int > 0 THEN CURRENT_TIMESTAMP - INTERVAL '2 hours' + (RANDOM() * 120)::int * INTERVAL '1 minute'
    ELSE NULL
  END as actual_departure_time,
  145 + (RANDOM() * 30)::int as estimated_distance_km,
  'Bauxite' as material_type
FROM ranked_combinations
WHERE rn <= 50;

-- Mettre a jour le stock carburant
UPDATE fuel_stocks
SET 
  current_stock = 8500,
  last_refill_date = CURRENT_DATE,
  updated_at = NOW()
WHERE id IN (SELECT id FROM fuel_stocks LIMIT 1);

-- Ajouter des maintenances pour aujourd'hui
INSERT INTO maintenance_orders (
  vehicle_id,
  site_id,
  maintenance_type,
  status,
  priority,
  scheduled_date,
  request_date,
  description,
  title
)
SELECT 
  v.id as vehicle_id,
  v.site_id,
  (CASE (RANDOM() * 3)::int
    WHEN 0 THEN 'preventive'
    ELSE 'corrective'
  END)::maintenance_type as maintenance_type,
  'open'::maintenance_status as status,
  (CASE (RANDOM() * 3)::int
    WHEN 0 THEN 'low'
    WHEN 1 THEN 'medium'
    ELSE 'high'
  END) as priority,
  CURRENT_DATE as scheduled_date,
  CURRENT_DATE as request_date,
  'Maintenance planifiee pour aujourd''hui' as description,
  'Maintenance ' || v.registration as title
FROM vehicles v
WHERE v.status = 'active'
  AND RANDOM() < 0.15
LIMIT 12;
