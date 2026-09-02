/*
  # Ajouter des données de démonstration

  1. Données ajoutées
    - 20 transactions de carburant
    - 15 ordres de maintenance
  
  2. Types d'enum corrects
    - fuel_transaction_type: 'refuel' ou 'tank_fill'
    - maintenance_type: 'preventive' ou 'corrective'
    - maintenance_status: 'open', 'in_progress', 'completed', 'cancelled'
*/

-- Insérer des transactions de carburant
INSERT INTO fuel_transactions (
  vehicle_id, driver_id, site_id, volume_liters, quantity, 
  unit_price, total_cost, total_amount, odometer_reading, 
  transaction_type, transaction_date, supplier, reference
)
SELECT 
  v.id,
  d.id,
  s.id,
  (80 + (random() * 60)::int)::numeric,
  (80 + (random() * 60)::int)::numeric,
  8500::numeric,
  ((80 + (random() * 60)::int) * 8500)::numeric,
  ((80 + (random() * 60)::int) * 8500)::numeric,
  (random() * 50000 + 10000)::numeric,
  CASE WHEN seq % 2 = 0 THEN 'refuel'::fuel_transaction_type ELSE 'tank_fill'::fuel_transaction_type END,
  (NOW() - (seq || ' days')::interval)::date,
  CASE (seq % 3)
    WHEN 0 THEN 'Total Guinée'
    WHEN 1 THEN 'Oryx Energies'
    ELSE 'Sahel Gaz'
  END,
  'FT-' || to_char(NOW(), 'YYYYMMDD') || '-' || lpad((seq * 100)::text, 6, '0')
FROM (
  SELECT id, row_number() OVER () as seq
  FROM vehicles 
  LIMIT 20
) v
CROSS JOIN LATERAL (
  SELECT id FROM drivers ORDER BY random() LIMIT 1
) d
CROSS JOIN LATERAL (
  SELECT id FROM sites ORDER BY random() LIMIT 1
) s
WHERE NOT EXISTS (
  SELECT 1 FROM fuel_transactions LIMIT 1
);

-- Insérer des ordres de maintenance
INSERT INTO maintenance_orders (
  vehicle_id, maintenance_type, title, description, priority, status, 
  request_date, scheduled_date, completion_date, km_at_maintenance,
  labor_hours, labor_cost, actual_cost, assigned_to, work_order_number
)
SELECT 
  v.id,
  CASE WHEN seq % 2 = 0 THEN 'preventive'::maintenance_type ELSE 'corrective'::maintenance_type END,
  CASE (seq % 5)
    WHEN 0 THEN 'Vidange moteur'
    WHEN 1 THEN 'Contrôle freinage'
    WHEN 2 THEN 'Remplacement pneus'
    WHEN 3 THEN 'Révision hydraulique'
    ELSE 'Inspection générale'
  END,
  CASE (seq % 5)
    WHEN 0 THEN 'Vidange moteur et remplacement filtres'
    WHEN 1 THEN 'Contrôle système de freinage'
    WHEN 2 THEN 'Remplacement pneus usés'
    WHEN 3 THEN 'Révision système hydraulique'
    ELSE 'Inspection générale périodique'
  END,
  CASE (seq % 3)
    WHEN 0 THEN 'high'
    WHEN 1 THEN 'medium'
    ELSE 'low'
  END,
  CASE (seq % 3)
    WHEN 0 THEN 'completed'::maintenance_status
    WHEN 1 THEN 'in_progress'::maintenance_status
    ELSE 'open'::maintenance_status
  END,
  (NOW() - (seq * 2 || ' days')::interval)::date,
  (NOW() - (seq * 2 || ' days')::interval)::date,
  CASE WHEN (seq % 3) = 0 THEN (NOW() - (seq || ' days')::interval)::date ELSE NULL END,
  (random() * 50000 + 10000)::numeric,
  (random() * 8 + 2)::numeric,
  (random() * 500000 + 100000)::numeric,
  (random() * 3000000 + 500000)::numeric,
  (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1),
  'WO-' || to_char(NOW(), 'YYYYMMDD') || '-' || lpad((seq * 100)::text, 6, '0')
FROM (
  SELECT id, row_number() OVER () as seq
  FROM vehicles 
  LIMIT 15
) v
WHERE NOT EXISTS (
  SELECT 1 FROM maintenance_orders LIMIT 1
);
