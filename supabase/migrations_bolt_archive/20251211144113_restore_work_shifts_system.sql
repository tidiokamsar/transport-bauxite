/*
  # Restaurer le système de quarts de travail
  
  Cette migration recrée le système de quarts de travail pour les missions minières.
  
  1. Table work_shifts avec les 3 quarts (Matin, Après-midi, Nuit)
  2. Colonnes supplémentaires dans trips pour lier aux quarts
  3. Vue shift_performance_stats pour les statistiques
  4. Politiques RLS
*/

-- Créer la table des quarts de travail
CREATE TABLE IF NOT EXISTS work_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  shift_order integer NOT NULL UNIQUE,
  color text DEFAULT '#3b82f6',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Activer RLS
ALTER TABLE work_shifts ENABLE ROW LEVEL SECURITY;

-- Policies RLS
CREATE POLICY "Admins full access" ON work_shifts FOR ALL TO authenticated USING (true);

-- Insérer les 3 quarts de travail
INSERT INTO work_shifts (name, display_name, start_time, end_time, shift_order, color, is_active) VALUES
  ('morning', 'Quart du Matin', '06:00:00', '14:00:00', 1, '#10b981', true),
  ('afternoon', 'Quart de l''Après-midi', '14:00:00', '22:00:00', 2, '#f59e0b', true),
  ('night', 'Quart de Nuit', '22:00:00', '06:00:00', 3, '#6366f1', true)
ON CONFLICT (name) DO NOTHING;

-- Ajouter les colonnes manquantes à trips
ALTER TABLE trips ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES work_shifts(id);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS shift_sequence integer;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS loading_time_minutes integer DEFAULT 15;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS unloading_time_minutes integer DEFAULT 10;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS trip_duration_minutes integer;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS material_type text DEFAULT 'minerai';
ALTER TABLE trips ADD COLUMN IF NOT EXISTS notes text;

-- Créer des index
CREATE INDEX IF NOT EXISTS idx_trips_shift_id ON trips(shift_id);
CREATE INDEX IF NOT EXISTS idx_trips_planned_date_shift ON trips(planned_date, shift_id);

-- Fonction pour calculer la durée du voyage
CREATE OR REPLACE FUNCTION calculate_trip_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.actual_departure_time IS NOT NULL AND NEW.actual_arrival_time IS NOT NULL THEN
    NEW.trip_duration_minutes := EXTRACT(EPOCH FROM (NEW.actual_arrival_time - NEW.actual_departure_time)) / 60;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour calculer la durée
DROP TRIGGER IF EXISTS trigger_calculate_trip_duration ON trips;
CREATE TRIGGER trigger_calculate_trip_duration
  BEFORE INSERT OR UPDATE ON trips
  FOR EACH ROW
  EXECUTE FUNCTION calculate_trip_duration();

-- Mettre à jour les voyages existants avec un quart par défaut
UPDATE trips 
SET shift_id = (SELECT id FROM work_shifts WHERE name = 'morning' LIMIT 1)
WHERE shift_id IS NULL;

-- Vue pour les statistiques par quart
CREATE OR REPLACE VIEW shift_performance_stats AS
SELECT 
  ws.id as shift_id,
  ws.name as shift_name,
  ws.display_name,
  ws.color,
  DATE(t.planned_date) as date,
  COUNT(t.id) as total_trips,
  COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_trips,
  COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_trips,
  COALESCE(SUM(t.net_weight), 0) as total_weight,
  COALESCE(AVG(t.trip_duration_minutes), 0) as avg_duration_minutes
FROM work_shifts ws
LEFT JOIN trips t ON t.shift_id = ws.id
WHERE ws.is_active = true
GROUP BY ws.id, ws.name, ws.display_name, ws.color, DATE(t.planned_date);
