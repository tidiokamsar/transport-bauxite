/*
  # Données missions avec cast
*/

DO $$
DECLARE
  day_off INT;
  s_id uuid; s_order INT; s_start TIME;
  v_id uuid; v_km INT; d_id uuid;
  sang_id uuid; kams_id uuid; cli_id uuid;
  tc INT; t_ref TEXT; t_stat trip_status;
  dep_t TIMESTAMP; arr_t TIMESTAMP;
  dist NUMERIC; gr_w NUMERIC; ta_w NUMERIC;
BEGIN
  SELECT id INTO sang_id FROM sites WHERE name = 'Mine de Sangaredi' LIMIT 1;
  SELECT id INTO kams_id FROM sites WHERE name = 'Port de Kamsar' LIMIT 1;
  SELECT id INTO cli_id FROM clients LIMIT 1;
  
  IF cli_id IS NULL THEN
    INSERT INTO clients (name, type, active) VALUES ('CBG', 'corporate', true) RETURNING id INTO cli_id;
  END IF;
  
  FOR day_off IN 0..3 LOOP
    FOR s_id, s_order, s_start IN 
      SELECT id, shift_order, start_time FROM work_shifts WHERE is_active = true ORDER BY shift_order
    LOOP
      FOR tc IN 1..3 LOOP
        SELECT id, current_km INTO v_id, v_km FROM vehicles WHERE status = 'active' ORDER BY random() LIMIT 1;
        SELECT id INTO d_id FROM drivers WHERE status = 'active' ORDER BY random() LIMIT 1;
        
        t_ref := 'TRIP-' || to_char(CURRENT_DATE - day_off, 'YYYYMMDD') || '-' || s_order || tc;
        
        IF day_off = 0 THEN
          IF s_order = 1 THEN t_stat := 'completed'::trip_status;
          ELSIF s_order = 2 AND tc <= 2 THEN t_stat := 'in_progress'::trip_status;
          ELSE t_stat := 'planned'::trip_status; END IF;
        ELSE t_stat := 'completed'::trip_status; END IF;
        
        dist := 85 + (random() * 10)::numeric;
        dep_t := (CURRENT_DATE - day_off)::timestamp + s_start + (interval '1 minute' * (tc * 45));
        arr_t := dep_t + (interval '1 minute' * (dist * 1.2)::int);
        gr_w := 85 + (random() * 25)::numeric;
        ta_w := 26 + (random() * 2)::numeric;
        
        INSERT INTO trips (
          reference, planned_date, shift_id, vehicle_id, driver_id,
          departure_site_id, arrival_site_id, client_id, status,
          estimated_distance_km, material_type,
          actual_departure_time, actual_arrival_time,
          km_start, km_end, gross_weight, tare_weight, net_weight,
          trip_duration_minutes, shift_sequence
        ) VALUES (
          t_ref, CURRENT_DATE - day_off, s_id, v_id, d_id,
          sang_id, kams_id, cli_id, t_stat, dist, 'Bauxite',
          CASE WHEN t_stat IN ('in_progress', 'completed') THEN dep_t END,
          CASE WHEN t_stat = 'completed' THEN arr_t END,
          CASE WHEN t_stat IN ('in_progress', 'completed') THEN v_km END,
          CASE WHEN t_stat = 'completed' THEN v_km + dist::int END,
          CASE WHEN t_stat IN ('in_progress', 'completed') THEN gr_w END,
          CASE WHEN t_stat IN ('in_progress', 'completed') THEN ta_w END,
          CASE WHEN t_stat IN ('in_progress', 'completed') THEN gr_w - ta_w END,
          CASE WHEN t_stat = 'completed' THEN EXTRACT(EPOCH FROM (arr_t - dep_t))/60 END,
          tc
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
