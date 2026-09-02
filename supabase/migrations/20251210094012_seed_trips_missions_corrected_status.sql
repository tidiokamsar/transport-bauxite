/*
  # Seed Trips & Missions Data for December 2025
  
  1. Purpose
    - Add realistic trip data for bonus calculations
    - Link to existing drivers, vehicles, sites, and shifts
    - Create comprehensive mission history
  
  2. Data Created
    - 22 trips over November-December 2025
    - Routes: Mine Sangarédi → Port de Kamsar
    - Multiple shifts (morning, afternoon, night)
    - Completed trips + some in progress today
    
  3. Relationships
    - Drivers: for payroll bonus calculation
    - Vehicles: DCH, DCP, DCR series
    - Sites: Mine and Port
    - Work shifts: morning, afternoon, night
*/

-- Delete existing data safely
DO $$ 
BEGIN
  DELETE FROM fuel_consumption WHERE trip_id IN (
    SELECT id FROM trips WHERE planned_date >= '2025-11-01'
  );
  DELETE FROM trips WHERE planned_date >= '2025-11-01';
END $$;

-- Insert trip data
DO $$ 
DECLARE
  v_mine_id UUID;
  v_port_id UUID;
  v_shift_morning UUID;
  v_shift_afternoon UUID;
  v_shift_night UUID;
BEGIN
  SELECT id INTO v_mine_id FROM sites WHERE name LIKE '%Sangarédi%' OR name LIKE '%Sangaredi%' LIMIT 1;
  SELECT id INTO v_port_id FROM sites WHERE name LIKE '%Port%Kamsar%' LIMIT 1;
  SELECT id INTO v_shift_morning FROM work_shifts WHERE name = 'morning';
  SELECT id INTO v_shift_afternoon FROM work_shifts WHERE name = 'afternoon';
  SELECT id INTO v_shift_night FROM work_shifts WHERE name = 'night';

  INSERT INTO trips (
    reference, planned_date, vehicle_id, driver_id, 
    departure_site_id, arrival_site_id, shift_id,
    estimated_distance_km, actual_departure_time, actual_arrival_time,
    km_start, km_end, gross_weight, tare_weight, net_weight,
    status, material_type, loading_time_minutes, unloading_time_minutes,
    trip_duration_minutes, notes
  ) VALUES
  ('TRIP-NOV-001', '2025-11-01', 
   (SELECT id FROM vehicles WHERE registration = 'DCH-001' LIMIT 1),
   (SELECT id FROM drivers WHERE license_number = 'GN-C-34567' LIMIT 1),
   v_mine_id, v_port_id, v_shift_morning,
   320, '2025-11-01 06:00:00+00', '2025-11-01 14:30:00+00',
   12450, 12770, 70, 25, 45,
   'completed', 'Bauxite', 45, 30, 510, 'Mission matinale - Performance excellente'),

  ('TRIP-NOV-002', '2025-11-01',
   (SELECT id FROM vehicles WHERE registration = 'DCH-002' LIMIT 1),
   (SELECT id FROM drivers WHERE license_number = 'DL000007' LIMIT 1),
   v_mine_id, v_port_id, v_shift_afternoon,
   320, '2025-11-01 14:00:00+00', '2025-11-01 22:45:00+00',
   8920, 9240, 70, 25, 45,
   'completed', 'Bauxite', 47, 33, 525, 'Chargement complet'),

  ('TRIP-NOV-003', '2025-11-02',
   (SELECT id FROM vehicles WHERE registration = 'DCH-003' LIMIT 1),
   (SELECT id FROM drivers WHERE license_number = 'DL000017' LIMIT 1),
   v_mine_id, v_port_id, v_shift_morning,
   320, '2025-11-02 06:00:00+00', '2025-11-02 14:30:00+00',
   15670, 15990, 70, 25, 45,
   'completed', 'Bauxite', 45, 30, 510, 'Excellente performance'),

  ('TRIP-NOV-004', '2025-11-03',
   (SELECT id FROM vehicles WHERE registration = 'DCP-001' LIMIT 1),
   (SELECT id FROM drivers WHERE license_number = 'DL000027' LIMIT 1),
   v_mine_id, v_port_id, v_shift_afternoon,
   320, '2025-11-03 14:00:00+00', '2025-11-03 22:30:00+00',
   22100, 22420, 69, 25, 44,
   'completed', 'Bauxite', 48, 32, 510, 'Mission réussie'),

  ('TRIP-DEC-001', '2025-12-01',
   (SELECT id FROM vehicles WHERE registration = 'DCH-001' LIMIT 1),
   (SELECT id FROM drivers WHERE license_number = 'GN-C-34567' LIMIT 1),
   v_mine_id, v_port_id, v_shift_morning,
   320, '2025-12-01 06:00:00+00', '2025-12-01 14:30:00+00',
   18550, 18870, 70, 25, 45,
   'completed', 'Bauxite', 45, 30, 510, 'Début de mois'),

  ('TRIP-DEC-002', '2025-12-01',
   (SELECT id FROM vehicles WHERE registration = 'DCH-002' LIMIT 1),
   (SELECT id FROM drivers WHERE license_number = 'DL000007' LIMIT 1),
   v_mine_id, v_port_id, v_shift_afternoon,
   320, '2025-12-01 14:00:00+00', '2025-12-01 22:45:00+00',
   12890, 13210, 70, 25, 45,
   'completed', 'Bauxite', 47, 33, 525, 'Performance stable'),

  ('TRIP-DEC-003', '2025-12-02',
   (SELECT id FROM vehicles WHERE registration = 'DCH-003' LIMIT 1),
   (SELECT id FROM drivers WHERE license_number = 'DL000017' LIMIT 1),
   v_mine_id, v_port_id, v_shift_morning,
   320, '2025-12-02 06:00:00+00', '2025-12-02 14:20:00+00',
   19450, 19770, 70, 25, 45,
   'completed', 'Bauxite', 43, 28, 500, 'Excellente journée'),

  ('TRIP-DEC-004', '2025-12-02',
   (SELECT id FROM vehicles WHERE registration = 'DCP-001' LIMIT 1),
   (SELECT id FROM drivers WHERE license_number = 'DL000027' LIMIT 1),
   v_mine_id, v_port_id, v_shift_afternoon,
   320, '2025-12-02 14:00:00+00', '2025-12-02 22:30:00+00',
   27650, 27970, 69, 25, 44,
   'completed', 'Bauxite', 48, 32, 510, 'Mission réussie'),

  ('TRIP-DEC-005', '2025-12-03',
   (SELECT id FROM vehicles WHERE registration = 'DCR-001' LIMIT 1),
   (SELECT id FROM drivers WHERE license_number = 'DL000037' LIMIT 1),
   v_mine_id, v_port_id, v_shift_morning,
   320, '2025-12-03 06:00:00+00', '2025-12-03 14:45:00+00',
   38900, 39220, 70, 25, 45,
   'completed', 'Bauxite', 49, 34, 525, 'Rotation normale'),

  ('TRIP-DEC-006', '2025-12-03',
   (SELECT id FROM vehicles WHERE registration = 'DCR-002' LIMIT 1),
   (SELECT id FROM drivers WHERE license_number = 'DL000047' LIMIT 1),
   v_mine_id, v_port_id, v_shift_afternoon,
   320, '2025-12-03 14:00:00+00', '2025-12-03 22:15:00+00',
   32450, 32770, 70, 25, 45,
   'completed', 'Bauxite', 44, 29, 495, 'Temps record'),

  ('TRIP-DEC-007', '2025-12-04',
   (SELECT id FROM vehicles WHERE registration = 'DCH-001' LIMIT 1),
   (SELECT id FROM drivers WHERE license_number = 'GN-C-34567' LIMIT 1),
   v_mine_id, v_port_id, v_shift_morning,
   320, '2025-12-04 06:00:00+00', '2025-12-04 14:30:00+00',
   18870, 19190, 70, 25, 45,
   'completed', 'Bauxite', 46, 31, 510, 'Performance parfaite'),

  ('TRIP-DEC-008', '2025-12-05',
   (SELECT id FROM vehicles WHERE registration = 'DCH-002' LIMIT 1),
   (SELECT id FROM drivers WHERE license_number = 'DL000007' LIMIT 1),
   v_mine_id, v_port_id, v_shift_morning,
   320, '2025-12-05 06:00:00+00', '2025-12-05 14:40:00+00',
   13210, 13530, 70, 25, 45,
   'completed', 'Bauxite', 47, 33, 520, 'Standard'),

  ('TRIP-DEC-009', '2025-12-06',
   (SELECT id FROM vehicles WHERE registration = 'DCH-003' LIMIT 1),
   (SELECT id FROM drivers WHERE license_number = 'DL000017' LIMIT 1),
   v_mine_id, v_port_id, v_shift_afternoon,
   320, '2025-12-06 14:00:00+00', '2025-12-06 22:30:00+00',
   19770, 20090, 69, 25, 44,
   'completed', 'Bauxite', 48, 32, 510, 'Bon travail'),

  ('TRIP-DEC-010', '2025-12-07',
   (SELECT id FROM vehicles WHERE registration = 'DCP-001' LIMIT 1),
   (SELECT id FROM drivers WHERE license_number = 'DL000027' LIMIT 1),
   v_mine_id, v_port_id, v_shift_morning,
   320, '2025-12-07 06:00:00+00', '2025-12-07 14:25:00+00',
   27970, 28290, 70, 25, 45,
   'completed', 'Bauxite', 44, 29, 505, 'Optimal'),

  ('TRIP-DEC-011', '2025-12-08',
   (SELECT id FROM vehicles WHERE registration = 'DCH-001' LIMIT 1),
   (SELECT id FROM drivers WHERE license_number = 'GN-C-34567' LIMIT 1),
   v_mine_id, v_port_id, v_shift_morning,
   320, '2025-12-08 06:00:00+00', '2025-12-08 14:30:00+00',
   19190, 19510, 70, 25, 45,
   'completed', 'Bauxite', 45, 30, 510, 'Semaine en cours'),

  ('TRIP-DEC-012', '2025-12-08',
   (SELECT id FROM vehicles WHERE registration = 'DCH-002' LIMIT 1),
   (SELECT id FROM drivers WHERE license_number = 'DL000007' LIMIT 1),
   v_mine_id, v_port_id, v_shift_afternoon,
   320, '2025-12-08 14:00:00+00', '2025-12-08 22:45:00+00',
   13530, 13850, 70, 25, 45,
   'completed', 'Bauxite', 47, 33, 525, 'RAS'),

  ('TRIP-DEC-013', '2025-12-09',
   (SELECT id FROM vehicles WHERE registration = 'DCH-003' LIMIT 1),
   (SELECT id FROM drivers WHERE license_number = 'DL000017' LIMIT 1),
   v_mine_id, v_port_id, v_shift_morning,
   320, '2025-12-09 06:00:00+00', '2025-12-09 14:20:00+00',
   20090, 20410, 70, 25, 45,
   'completed', 'Bauxite', 43, 28, 500, 'Performance élevée'),

  ('TRIP-DEC-014', '2025-12-09',
   (SELECT id FROM vehicles WHERE registration = 'DCP-001' LIMIT 1),
   (SELECT id FROM drivers WHERE license_number = 'DL000027' LIMIT 1),
   v_mine_id, v_port_id, v_shift_afternoon,
   320, '2025-12-09 14:00:00+00', '2025-12-09 22:30:00+00',
   28290, 28610, 69, 25, 44,
   'completed', 'Bauxite', 48, 32, 510, 'Bon voyage'),

  ('TRIP-DEC-015', '2025-12-10',
   (SELECT id FROM vehicles WHERE registration = 'DCR-001' LIMIT 1),
   (SELECT id FROM drivers WHERE license_number = 'DL000037' LIMIT 1),
   v_mine_id, v_port_id, v_shift_morning,
   320, '2025-12-10 06:00:00+00', '2025-12-10 14:30:00+00',
   39220, 39540, 70, 25, 45,
   'completed', 'Bauxite', 45, 30, 510, 'Mission matinale terminée'),

  ('TRIP-DEC-016', '2025-12-10',
   (SELECT id FROM vehicles WHERE registration = 'DCR-002' LIMIT 1),
   (SELECT id FROM drivers WHERE license_number = 'DL000047' LIMIT 1),
   v_mine_id, v_port_id, v_shift_afternoon,
   320, '2025-12-10 14:00:00+00', NULL,
   32770, NULL, NULL, NULL, NULL,
   'in_progress', 'Bauxite', 45, NULL, NULL, 'En cours de livraison'),

  ('TRIP-DEC-017', '2025-12-10',
   (SELECT id FROM vehicles WHERE registration = 'DCH-001' LIMIT 1),
   (SELECT id FROM drivers WHERE license_number = 'GN-C-34567' LIMIT 1),
   v_mine_id, v_port_id, v_shift_afternoon,
   320, '2025-12-10 14:15:00+00', NULL,
   19510, NULL, NULL, NULL, NULL,
   'in_progress', 'Bauxite', 48, NULL, NULL, 'Chargement effectué, en route');

END $$;
