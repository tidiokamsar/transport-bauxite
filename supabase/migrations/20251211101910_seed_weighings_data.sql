/*
  # Ajout de donnees pour les pesees (weighings)

  1. Donnees ajoutees
    - Pesees pour les trajets completes
    - Poids brut, tare et net realistes
    - Tickets de pesee avec operateurs
*/

-- Ajouter des pesees pour les trajets completes
INSERT INTO weighings (
  trip_id, 
  scale_id, 
  weighing_time, 
  gross_weight, 
  tare_weight, 
  net_weight, 
  ticket_number, 
  operator_name
)
SELECT 
  t.id as trip_id,
  CASE (RANDOM() * 3)::int
    WHEN 0 THEN 'BALANCE-SANG-01'
    WHEN 1 THEN 'BALANCE-KAMS-01'
    WHEN 2 THEN 'BALANCE-KAMS-02'
    ELSE 'BALANCE-SANG-02'
  END as scale_id,
  t.actual_departure_time + INTERVAL '10 minutes' as weighing_time,
  CASE 
    WHEN v.vehicle_type = 'tipper' THEN 45000 + (RANDOM() * 15000)::int
    WHEN v.vehicle_type = 'loader' THEN 35000 + (RANDOM() * 10000)::int
    ELSE 30000 + (RANDOM() * 8000)::int
  END as gross_weight,
  CASE 
    WHEN v.vehicle_type = 'tipper' THEN 12000 + (RANDOM() * 3000)::int
    WHEN v.vehicle_type = 'loader' THEN 10000 + (RANDOM() * 2000)::int
    ELSE 8000 + (RANDOM() * 2000)::int
  END as tare_weight,
  0 as net_weight,
  'TK-' || LPAD((ROW_NUMBER() OVER (ORDER BY t.id))::text, 6, '0') as ticket_number,
  CASE (RANDOM() * 5)::int
    WHEN 0 THEN 'Mamadou Diallo'
    WHEN 1 THEN 'Fatoumata Camara'
    WHEN 2 THEN 'Ibrahima Sow'
    WHEN 3 THEN 'Aissatou Barry'
    ELSE 'Ousmane Bah'
  END as operator_name
FROM trips t
JOIN vehicles v ON t.vehicle_id = v.id
WHERE t.status = 'completed'
  AND t.actual_departure_time IS NOT NULL
ORDER BY t.actual_departure_time
LIMIT 500;

-- Calculer le poids net
UPDATE weighings
SET net_weight = gross_weight - tare_weight
WHERE net_weight = 0;
