/*
  # Correction du schema maintenance_schedules

  1. Modifications
    - Ajouter colonnes manquantes: interval_km, interval_days, is_active
    - Mapper les donnees existantes
*/

-- Ajouter les colonnes manquantes
ALTER TABLE maintenance_schedules 
ADD COLUMN IF NOT EXISTS interval_km NUMERIC,
ADD COLUMN IF NOT EXISTS interval_days INTEGER,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Migrer les donnees existantes
UPDATE maintenance_schedules
SET 
  interval_km = CASE 
    WHEN frequency_type = 'kilometers' THEN frequency_value
    ELSE NULL
  END,
  interval_days = CASE 
    WHEN frequency_type = 'days' THEN frequency_value::integer
    WHEN frequency_type = 'months' THEN (frequency_value * 30)::integer
    ELSE NULL
  END,
  is_active = COALESCE(active, true)
WHERE interval_km IS NULL OR interval_days IS NULL;

-- Ajouter colonnes last_maintenance_km et last_maintenance_date si manquantes
ALTER TABLE maintenance_schedules
ADD COLUMN IF NOT EXISTS last_maintenance_km NUMERIC,
ADD COLUMN IF NOT EXISTS last_maintenance_date DATE;

-- Migrer les valeurs
UPDATE maintenance_schedules
SET 
  last_maintenance_km = COALESCE(last_service_km, 0),
  last_maintenance_date = COALESCE(last_service_date, CURRENT_DATE - INTERVAL '30 days')
WHERE last_maintenance_km IS NULL;
