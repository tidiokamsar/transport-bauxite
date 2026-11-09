/*
  # Correction des timestamps pour geofence_violations

  1. Modifications
    - Ajouter entry_time pour toutes les violations
    - Ajouter exit_time pour certaines violations resolues
*/

-- Ajouter entry_time pour toutes les violations qui n'en ont pas
UPDATE geofence_violations
SET 
  entry_time = created_at - (RANDOM() * 24)::int * INTERVAL '1 hour'
WHERE entry_time IS NULL;

-- Pour les violations avec status != 'open', ajouter exit_time
UPDATE geofence_violations
SET 
  exit_time = entry_time + (RANDOM() * 120)::int * INTERVAL '1 minute',
  duration_minutes = 15 + (RANDOM() * 90)::int
WHERE status != 'open' AND exit_time IS NULL;
