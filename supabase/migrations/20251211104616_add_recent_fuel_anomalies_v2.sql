/*
  # Ajout d'anomalies carburant recentes

  1. Ajouts
    - Anomalies de carburant des derniers jours
    - Differents types et severites
*/

-- Ajouter des anomalies recentes
INSERT INTO fuel_anomalies (
  vehicle_id,
  driver_id,
  detection_date,
  anomaly_type,
  severity,
  expected_value,
  actual_value,
  variance,
  variance_percentage,
  description,
  detection_method,
  confidence_score,
  location_name,
  status,
  estimated_loss
)
SELECT 
  v.id as vehicle_id,
  d.id as driver_id,
  CURRENT_TIMESTAMP - (RANDOM() * 7)::int * INTERVAL '1 day' as detection_date,
  (CASE (RANDOM() * 4)::int
    WHEN 0 THEN 'overconsumption'
    WHEN 1 THEN 'theft'
    WHEN 2 THEN 'leak'
    ELSE 'unauthorized_station'
  END) as anomaly_type,
  (CASE (RANDOM() * 4)::int
    WHEN 0 THEN 'critical'
    WHEN 1 THEN 'high'
    WHEN 2 THEN 'medium'
    ELSE 'low'
  END) as severity,
  300 + (RANDOM() * 200)::numeric as expected_value,
  350 + (RANDOM() * 250)::numeric as actual_value,
  30 + (RANDOM() * 70)::numeric as variance,
  15.0 + (RANDOM() * 20)::numeric as variance_percentage,
  (CASE (RANDOM() * 4)::int
    WHEN 0 THEN 'Consommation anormalement elevee detectee sur trajet habituel'
    WHEN 1 THEN 'Transaction suspecte detectee hors heures de service'
    WHEN 2 THEN 'Fuite possible detectee - perte progressive de carburant'
    ELSE 'Ravitaillement effectue dans une station non autorisee'
  END) as description,
  (CASE (RANDOM() * 2)::int
    WHEN 0 THEN 'ML_Algorithm'
    ELSE 'Rule_Based'
  END) as detection_method,
  0.70 + (RANDOM() * 0.25)::numeric as confidence_score,
  (CASE (RANDOM() * 3)::int
    WHEN 0 THEN 'Mine Sangaredi'
    WHEN 1 THEN 'Port Kamsar'
    ELSE 'Route N1'
  END) as location_name,
  (CASE (RANDOM() * 4)::int
    WHEN 0 THEN 'open'
    WHEN 1 THEN 'investigating'
    WHEN 2 THEN 'resolved'
    ELSE 'open'
  END) as status,
  500000 + (RANDOM() * 3000000)::numeric as estimated_loss
FROM vehicles v
CROSS JOIN drivers d
WHERE v.status = 'active'
  AND d.status = 'active'
  AND RANDOM() < 0.03
LIMIT 25;
