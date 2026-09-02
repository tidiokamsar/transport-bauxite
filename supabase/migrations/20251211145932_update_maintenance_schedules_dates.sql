/*
  # Mettre à jour les dates des programmes de maintenance
  
  Cette migration distribue les dates de maintenance de manière réaliste:
  - Certaines en retard (passées)
  - Certaines à venir bientôt (prochains 15 jours)
  - Certaines plus loin (prochains 30 jours)
*/

DO $$
DECLARE
  v_schedule RECORD;
  v_days_offset INTEGER;
BEGIN
  -- Mettre à jour les dates de maintenance
  FOR v_schedule IN 
    SELECT id FROM maintenance_schedules ORDER BY id
  LOOP
    -- Distribuer les dates sur 60 jours (30 jours passés, 30 jours futurs)
    v_days_offset := -30 + (RANDOM() * 60)::INTEGER;
    
    UPDATE maintenance_schedules
    SET 
      last_service_date = CURRENT_DATE + v_days_offset - 90,
      next_service_date = CURRENT_DATE + v_days_offset
    WHERE id = v_schedule.id;
  END LOOP;
END $$;
