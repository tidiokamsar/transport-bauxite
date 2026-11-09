/*
  # Correction du schema trips pour le dashboard

  1. Ajouts
    - Colonne start_date comme alias de planned_date
    - Colonne load_weight comme alias de net_weight
    - Migration des donnees
*/

-- Ajouter start_date si elle n'existe pas
ALTER TABLE trips
ADD COLUMN IF NOT EXISTS start_date DATE;

-- Ajouter load_weight si elle n'existe pas
ALTER TABLE trips
ADD COLUMN IF NOT EXISTS load_weight NUMERIC;

-- Migrer les donnees
UPDATE trips
SET 
  start_date = COALESCE(start_date, planned_date),
  load_weight = COALESCE(load_weight, net_weight, gross_weight)
WHERE start_date IS NULL OR load_weight IS NULL;

-- Creer un trigger pour maintenir start_date et load_weight a jour
CREATE OR REPLACE FUNCTION sync_trips_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.start_date IS NULL AND NEW.planned_date IS NOT NULL THEN
    NEW.start_date := NEW.planned_date;
  END IF;
  
  IF NEW.load_weight IS NULL THEN
    NEW.load_weight := COALESCE(NEW.net_weight, NEW.gross_weight);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_trips_columns_trigger ON trips;
CREATE TRIGGER sync_trips_columns_trigger
BEFORE INSERT OR UPDATE ON trips
FOR EACH ROW
EXECUTE FUNCTION sync_trips_columns();
