/*
  # Ajout du système de quarts de travail pour les missions minières

  Cette migration ajoute la gestion des 3 quarts de travail (8h chacun) sur 24h dans la mine.

  ## Nouveaux éléments
  
  1. **Table work_shifts**
     - Définition des 3 quarts de travail quotidiens
     - Quart 1: 06h00 - 14h00 (Jour)
     - Quart 2: 14h00 - 22h00 (Après-midi)
     - Quart 3: 22h00 - 06h00 (Nuit)
  
  2. **Modifications de la table trips**
     - Ajout de `shift_id` pour lier un voyage à un quart
     - Ajout de `shift_sequence` pour ordonner les missions dans un quart
     - Ajout de `loading_time_minutes` pour le temps de chargement
     - Ajout de `unloading_time_minutes` pour le temps de déchargement
     - Ajout de `trip_duration_minutes` pour la durée totale calculée
  
  3. **RLS Policies**
     - Protection des données avec Row Level Security
*/

-- Créer la table des quarts de travail
CREATE TABLE IF NOT EXISTS work_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  shift_order integer NOT NULL,
  color text DEFAULT '#3b82f6',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_shift_name UNIQUE (name),
  CONSTRAINT unique_shift_order UNIQUE (shift_order)
);

-- Activer RLS sur work_shifts
ALTER TABLE work_shifts ENABLE ROW LEVEL SECURITY;

-- Policies pour work_shifts
CREATE POLICY "Users can view work shifts"
  ON work_shifts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage work shifts"
  ON work_shifts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Insérer les 3 quarts de travail standard
INSERT INTO work_shifts (name, display_name, start_time, end_time, shift_order, color) VALUES
  ('morning', 'Quart du Matin', '06:00:00', '14:00:00', 1, '#10b981'),
  ('afternoon', 'Quart de l''Après-midi', '14:00:00', '22:00:00', 2, '#f59e0b'),
  ('night', 'Quart de Nuit', '22:00:00', '06:00:00', 3, '#6366f1');

-- Ajouter les colonnes de quart de travail à la table trips
ALTER TABLE trips ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES work_shifts(id);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS shift_sequence integer;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS loading_time_minutes integer DEFAULT 15;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS unloading_time_minutes integer DEFAULT 10;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS trip_duration_minutes integer;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS material_type text DEFAULT 'minerai';
ALTER TABLE trips ADD COLUMN IF NOT EXISTS notes text;

-- Créer un index pour améliorer les performances des requêtes par quart
CREATE INDEX IF NOT EXISTS idx_trips_shift_id ON trips(shift_id);
CREATE INDEX IF NOT EXISTS idx_trips_planned_date_shift ON trips(planned_date, shift_id);

-- Fonction pour calculer automatiquement la durée du voyage
CREATE OR REPLACE FUNCTION calculate_trip_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.actual_departure_time IS NOT NULL AND NEW.actual_arrival_time IS NOT NULL THEN
    NEW.trip_duration_minutes := EXTRACT(EPOCH FROM (NEW.actual_arrival_time - NEW.actual_departure_time)) / 60;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour calculer la durée automatiquement
DROP TRIGGER IF EXISTS trigger_calculate_trip_duration ON trips;
CREATE TRIGGER trigger_calculate_trip_duration
  BEFORE INSERT OR UPDATE ON trips
  FOR EACH ROW
  EXECUTE FUNCTION calculate_trip_duration();

-- Mettre à jour les voyages existants avec un quart par défaut (matin)
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

-- RLS pour la vue
ALTER VIEW shift_performance_stats SET (security_invoker = true);
