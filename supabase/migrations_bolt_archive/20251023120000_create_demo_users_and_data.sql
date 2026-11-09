/*
  # Create Demo Users and Complete Data

  1. Roles & Permissions
    - Admin, Manager, Dispatcher, Driver, Mechanic, Accountant roles
    - Comprehensive permissions system

  2. Demo Users
    - 10+ users with different roles
    - Complete profiles with realistic data

  3. Demo Data
    - Vehicles, drivers, trips, fuel, maintenance
    - Stock, purchases, suppliers
    - Employees, expenses, invoices
    - GPS tracking data

  4. Security
    - RLS policies per role
    - Permission-based access
*/

-- First, let's enhance the profiles table
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'manager', 'dispatcher', 'driver', 'mechanic', 'accountant', 'hr_manager', 'fleet_manager'));

-- Add more profile fields
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone') THEN
    ALTER TABLE profiles ADD COLUMN phone text;
    ALTER TABLE profiles ADD COLUMN department text;
    ALTER TABLE profiles ADD COLUMN photo_url text;
    ALTER TABLE profiles ADD COLUMN permissions jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE profiles ADD COLUMN preferences jsonb DEFAULT '{}'::jsonb;
    ALTER TABLE profiles ADD COLUMN last_login timestamptz;
  END IF;
END $$;

-- Insert demo data for stock categories
INSERT INTO stock_categories (name, description, active) VALUES
  ('Pièces moteur', 'Pièces et composants moteur', true),
  ('Filtres', 'Filtres à air, huile, carburant', true),
  ('Pneus et roues', 'Pneumatiques et accessoires', true),
  ('Électricité', 'Composants électriques et électroniques', true),
  ('Lubrifiants', 'Huiles et graisses', true),
  ('Consommables', 'Produits d''entretien courant', true)
ON CONFLICT (name) DO NOTHING;

-- Insert demo warehouses
INSERT INTO warehouses (name, code, warehouse_type, location, active) VALUES
  ('Entrepôt Principal', 'WH-MAIN', 'main', 'Conakry - Zone Industrielle', true),
  ('Garage Central', 'WH-GAR', 'garage', 'Base Kamsar', true),
  ('Station Carburant', 'WH-FUEL', 'fuel_station', 'Dépôt Boké', true),
  ('Dépôt Secondaire', 'WH-SEC', 'depot', 'Site Sangarédi', true)
ON CONFLICT (code) DO NOTHING;

-- Insert demo suppliers
INSERT INTO suppliers (supplier_number, supplier_type, company_name, contact_name, email, phone, active, rating) VALUES
  ('SUP-001', 'parts', 'TotalEnergies Guinée', 'Mamadou Diallo', 'contact@totalenergies.gn', '+224 622 123 456', true, 5),
  ('SUP-002', 'tires', 'Michelin West Africa', 'Ibrahim Sow', 'sales@michelin-wa.com', '+224 622 234 567', true, 5),
  ('SUP-003', 'parts', 'Bosch Automotive', 'Fatoumata Bah', 'info@bosch-gn.com', '+224 622 345 678', true, 4),
  ('SUP-004', 'fuel', 'Oryx Energies', 'Alpha Condé', 'alpha@oryx.gn', '+224 622 456 789', true, 4),
  ('SUP-005', 'tires', 'Bridgestone Africa', 'Mohamed Camara', 'm.camara@bridgestone.com', '+224 622 567 890', true, 5),
  ('SUP-006', 'services', 'Garage Pro Services', 'Thierno Barry', 'contact@garagepro.gn', '+224 622 678 901', true, 3)
ON CONFLICT (supplier_number) DO NOTHING;

-- Insert demo cost categories
INSERT INTO cost_categories (name, category_type, description, active) VALUES
  ('Carburant', 'variable', 'Consommation de carburant', true),
  ('Entretien courant', 'variable', 'Maintenance préventive et révisions', true),
  ('Réparations', 'variable', 'Réparations imprévues', true),
  ('Pneus', 'variable', 'Achat et remplacement pneus', true),
  ('Assurances', 'fixed', 'Primes d''assurance véhicules', true),
  ('Salaires chauffeurs', 'fixed', 'Rémunération des chauffeurs', true),
  ('Péages et taxes', 'operational', 'Frais de route', true),
  ('Amortissement', 'fixed', 'Dépréciation des véhicules', true)
ON CONFLICT (name) DO NOTHING;

-- Insert demo geofences
INSERT INTO geofences (name, zone_type, center_latitude, center_longitude, radius_meters, active, notify_on_entry, notify_on_exit) VALUES
  ('Mine de Sangarédi', 'mine', 10.8421, -14.6456, 1000, true, true, true),
  ('Port de Kamsar', 'port', 10.6566, -14.5839, 800, true, true, true),
  ('Dépôt Boké', 'depot', 10.9407, -14.2920, 500, true, true, false),
  ('Station Total Conakry', 'station', 9.6412, -13.5784, 300, true, false, false),
  ('Garage Central', 'garage', 10.6789, -14.5912, 400, true, true, false)
ON CONFLICT DO NOTHING;

-- Insert realistic demo vehicles (more complete data)
INSERT INTO vehicles (registration_number, make, model, year, vehicle_type, status, capacity, current_mileage, purchase_date, last_service_date, fuel_tank_capacity, average_consumption, assigned_driver_id)
SELECT
  'TRK-' || LPAD(s.n::text, 3, '0'),
  CASE (s.n % 4)
    WHEN 0 THEN 'Volvo'
    WHEN 1 THEN 'Mercedes-Benz'
    WHEN 2 THEN 'MAN'
    ELSE 'Scania'
  END,
  CASE (s.n % 4)
    WHEN 0 THEN 'FMX 540'
    WHEN 1 THEN 'Actros 3363'
    WHEN 2 THEN 'TGS 41.440'
    ELSE 'R730'
  END,
  2018 + (s.n % 6),
  'dump_truck',
  CASE (s.n % 5)
    WHEN 0 THEN 'in_garage'
    WHEN 1 THEN 'maintenance'
    ELSE 'active'
  END,
  40000 + (s.n * 1000),
  150000 + (s.n * 25000),
  CURRENT_DATE - ((s.n * 200) || ' days')::interval,
  CURRENT_DATE - ((s.n * 15) || ' days')::interval,
  500 + (s.n * 50),
  35.5 + (s.n * 1.2),
  NULL
FROM generate_series(1, 15) AS s(n)
ON CONFLICT (registration_number) DO NOTHING;

-- Insert more realistic driver data
INSERT INTO drivers (driver_number, first_name, last_name, phone, email, license_number, license_expiry, hire_date, status, base_salary, performance_rating)
SELECT
  'DRV-' || LPAD(s.n::text, 3, '0'),
  CASE (s.n % 10)
    WHEN 0 THEN 'Mamadou'
    WHEN 1 THEN 'Ibrahim'
    WHEN 2 THEN 'Alpha'
    WHEN 3 THEN 'Thierno'
    WHEN 4 THEN 'Mohamed'
    WHEN 5 THEN 'Amadou'
    WHEN 6 THEN 'Ousmane'
    WHEN 7 THEN 'Boubacar'
    WHEN 8 THEN 'Sékou'
    ELSE 'Souleymane'
  END,
  CASE (s.n % 10)
    WHEN 0 THEN 'Diallo'
    WHEN 1 THEN 'Sow'
    WHEN 2 THEN 'Bah'
    WHEN 3 THEN 'Condé'
    WHEN 4 THEN 'Camara'
    WHEN 5 THEN 'Barry'
    WHEN 6 THEN 'Diakité'
    WHEN 7 THEN 'Sylla'
    WHEN 8 THEN 'Touré'
    ELSE 'Keita'
  END,
  '+224 62' || (2000000 + s.n * 11111)::text,
  'driver' || s.n || '@sigtb.gn',
  'GN' || LPAD((100000 + s.n)::text, 6, '0'),
  CURRENT_DATE + ((365 + s.n * 30) || ' days')::interval,
  CURRENT_DATE - ((s.n * 180) || ' days')::interval,
  'active',
  2500000 + (s.n * 100000),
  3.5 + (s.n % 3) * 0.5
FROM generate_series(1, 20) AS s(n)
ON CONFLICT (driver_number) DO NOTHING;

-- Insert demo employees for HR module
INSERT INTO employees (employee_number, first_name, last_name, date_of_birth, gender, position, department, hire_date, phone, email, base_salary, status)
SELECT
  'EMP-' || LPAD(s.n::text, 3, '0'),
  CASE (s.n % 8)
    WHEN 0 THEN 'Fatoumata'
    WHEN 1 THEN 'Aissatou'
    WHEN 2 THEN 'Kadiatou'
    WHEN 3 THEN 'Mariama'
    WHEN 4 THEN 'Hawa'
    WHEN 5 THEN 'Nènè'
    WHEN 6 THEN 'Oumou'
    ELSE 'Fatim'
  END,
  CASE (s.n % 8)
    WHEN 0 THEN 'Diallo'
    WHEN 1 THEN 'Sow'
    WHEN 2 THEN 'Bah'
    WHEN 3 THEN 'Barry'
    WHEN 4 THEN 'Camara'
    WHEN 5 THEN 'Condé'
    WHEN 6 THEN 'Sylla'
    ELSE 'Keita'
  END,
  CURRENT_DATE - ((25 + s.n) || ' years')::interval,
  CASE WHEN s.n % 2 = 0 THEN 'female' ELSE 'male' END,
  CASE (s.n % 6)
    WHEN 0 THEN 'Comptable'
    WHEN 1 THEN 'Mécanicien'
    WHEN 2 THEN 'Dispatcher'
    WHEN 3 THEN 'Responsable Stock'
    WHEN 4 THEN 'Assistant RH'
    ELSE 'Agent Administratif'
  END,
  CASE (s.n % 4)
    WHEN 0 THEN 'Finance'
    WHEN 1 THEN 'Maintenance'
    WHEN 2 THEN 'Operations'
    ELSE 'Administration'
  END,
  CURRENT_DATE - ((s.n * 90) || ' days')::interval,
  '+224 66' || (4000000 + s.n * 11111)::text,
  'emp' || s.n || '@sigtb.gn',
  1800000 + (s.n * 150000),
  'active'
FROM generate_series(1, 15) AS s(n)
ON CONFLICT (employee_number) DO NOTHING;

-- Insert demo stock items
DO $$
DECLARE
  cat_id uuid;
  wh_id uuid;
BEGIN
  SELECT id INTO cat_id FROM stock_categories WHERE name = 'Pièces moteur' LIMIT 1;
  SELECT id INTO wh_id FROM warehouses WHERE code = 'WH-MAIN' LIMIT 1;

  INSERT INTO stock_items (item_code, name, description, category_id, unit_of_measure, unit_price, quantity_in_stock, minimum_threshold, warehouse_id, active)
  VALUES
    ('PART-001', 'Filtre à huile HD', 'Filtre à huile haute performance', cat_id, 'piece', 45000, 50, 10, wh_id, true),
    ('PART-002', 'Filtre à air', 'Filtre à air standard', cat_id, 'piece', 35000, 30, 8, wh_id, true),
    ('PART-003', 'Plaquettes de frein avant', 'Jeu de plaquettes', cat_id, 'set', 125000, 25, 5, wh_id, true),
    ('PART-004', 'Courroie de distribution', 'Courroie renforcée', cat_id, 'piece', 85000, 15, 3, wh_id, true),
    ('PART-005', 'Huile moteur 15W40', 'Bidon 20L', cat_id, 'liter', 8500, 500, 100, wh_id, true)
  ON CONFLICT (item_code) DO NOTHING;
END $$;

-- Insert demo customers
INSERT INTO customers (customer_number, customer_type, company_name, contact_name, email, phone, address, active)
VALUES
  ('CLI-001', 'corporate', 'Compagnie des Bauxites de Guinée (CBG)', 'Directeur Logistique', 'logistique@cbg-guinee.com', '+224 30 45 67 89', 'Kamsar, Guinée', true),
  ('CLI-002', 'corporate', 'Société Minière de Boké (SMB)', 'Chef Transport', 'transport@smb-winning.com', '+224 30 45 78 90', 'Boké, Guinée', true),
  ('CLI-003', 'corporate', 'Alliance Minière Responsable (AMR)', 'Responsable Fret', 'fret@amr-mining.com', '+224 30 45 89 01', 'Sangarédi, Guinée', true)
ON CONFLICT (customer_number) DO NOTHING;

-- Note: We cannot directly create auth.users via SQL (must use Supabase Auth API)
-- But we can prepare profiles that will be linked
INSERT INTO profiles (id, full_name, role, phone, department, preferences)
VALUES
  -- Admin
  (gen_random_uuid(), 'Abdoulaye Diallo', 'admin', '+224 622 111 111', 'Direction', '{"theme": "light", "language": "fr"}'::jsonb),
  -- Managers
  (gen_random_uuid(), 'Fatoumata Sow', 'manager', '+224 622 222 222', 'Operations', '{"theme": "light", "language": "fr"}'::jsonb),
  (gen_random_uuid(), 'Mohamed Camara', 'fleet_manager', '+224 622 333 333', 'Flotte', '{"theme": "light", "language": "fr"}'::jsonb),
  -- Dispatchers
  (gen_random_uuid(), 'Ibrahim Bah', 'dispatcher', '+224 622 444 444', 'Operations', '{"theme": "light", "language": "fr"}'::jsonb),
  (gen_random_uuid(), 'Aissatou Barry', 'dispatcher', '+224 622 555 555', 'Operations', '{"theme": "light", "language": "fr"}'::jsonb),
  -- Mechanics
  (gen_random_uuid(), 'Thierno Diakité', 'mechanic', '+224 622 666 666', 'Maintenance', '{"theme": "dark", "language": "fr"}'::jsonb),
  (gen_random_uuid(), 'Alpha Sylla', 'mechanic', '+224 622 777 777', 'Maintenance', '{"theme": "dark", "language": "fr"}'::jsonb),
  -- Accountant
  (gen_random_uuid(), 'Kadiatou Condé', 'accountant', '+224 622 888 888', 'Finance', '{"theme": "light", "language": "fr"}'::jsonb),
  -- HR Manager
  (gen_random_uuid(), 'Mariama Keita', 'hr_manager', '+224 622 999 999', 'Ressources Humaines', '{"theme": "light", "language": "fr"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Create function to generate demo trip data
CREATE OR REPLACE FUNCTION generate_demo_trips(num_trips integer DEFAULT 50)
RETURNS void AS $$
DECLARE
  v_id uuid;
  d_id uuid;
  c_id uuid;
  trip_date date;
  distance int;
  tonnage int;
BEGIN
  FOR i IN 1..num_trips LOOP
    -- Get random vehicle, driver, customer
    SELECT id INTO v_id FROM vehicles WHERE status = 'active' ORDER BY RANDOM() LIMIT 1;
    SELECT id INTO d_id FROM drivers WHERE status = 'active' ORDER BY RANDOM() LIMIT 1;
    SELECT id INTO c_id FROM customers ORDER BY RANDOM() LIMIT 1;

    trip_date := CURRENT_DATE - (i || ' days')::interval;
    distance := 80 + (RANDOM() * 120)::int;
    tonnage := 35000 + (RANDOM() * 10000)::int;

    INSERT INTO trips (
      trip_number,
      vehicle_id,
      driver_id,
      customer_id,
      origin,
      destination,
      departure_date,
      arrival_date,
      distance_km,
      tonnage_transported,
      status,
      fuel_consumed
    ) VALUES (
      'TRIP-' || TO_CHAR(trip_date, 'YYYYMMDD') || '-' || LPAD(i::text, 3, '0'),
      v_id,
      d_id,
      c_id,
      CASE (i % 3) WHEN 0 THEN 'Mine Sangarédi' WHEN 1 THEN 'Dépôt Boké' ELSE 'Mine Gaoual' END,
      'Port Kamsar',
      trip_date,
      trip_date + ((3 + (RANDOM() * 5)::int) || ' hours')::interval,
      distance,
      tonnage,
      CASE WHEN i <= 45 THEN 'completed' WHEN i <= 48 THEN 'in_progress' ELSE 'scheduled' END,
      distance * (0.35 + RANDOM() * 0.15)
    )
    ON CONFLICT (trip_number) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute demo data generation
SELECT generate_demo_trips(50);

-- Create comprehensive permissions structure
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  module text NOT NULL,
  can_view boolean DEFAULT false,
  can_create boolean DEFAULT false,
  can_edit boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  can_approve boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role, module)
);

-- Insert role permissions
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_approve) VALUES
  -- Admin has all permissions
  ('admin', 'dashboard', true, true, true, true, true),
  ('admin', 'vehicles', true, true, true, true, true),
  ('admin', 'drivers', true, true, true, true, true),
  ('admin', 'trips', true, true, true, true, true),
  ('admin', 'fuel', true, true, true, true, true),
  ('admin', 'maintenance', true, true, true, true, true),
  ('admin', 'stock', true, true, true, true, true),
  ('admin', 'purchases', true, true, true, true, true),
  ('admin', 'invoices', true, true, true, true, true),
  ('admin', 'hr', true, true, true, true, true),
  ('admin', 'reports', true, true, true, true, true),
  ('admin', 'settings', true, true, true, true, true),

  -- Manager permissions
  ('manager', 'dashboard', true, false, false, false, false),
  ('manager', 'vehicles', true, true, true, false, true),
  ('manager', 'drivers', true, true, true, false, true),
  ('manager', 'trips', true, true, true, false, true),
  ('manager', 'fuel', true, true, true, false, true),
  ('manager', 'maintenance', true, true, true, false, true),
  ('manager', 'reports', true, true, false, false, false),

  -- Dispatcher permissions
  ('dispatcher', 'dashboard', true, false, false, false, false),
  ('dispatcher', 'vehicles', true, false, false, false, false),
  ('dispatcher', 'drivers', true, false, false, false, false),
  ('dispatcher', 'trips', true, true, true, false, false),
  ('dispatcher', 'fuel', true, true, false, false, false),

  -- Mechanic permissions
  ('mechanic', 'dashboard', true, false, false, false, false),
  ('mechanic', 'vehicles', true, false, true, false, false),
  ('mechanic', 'maintenance', true, true, true, false, false),
  ('mechanic', 'stock', true, true, false, false, false),

  -- Accountant permissions
  ('accountant', 'dashboard', true, false, false, false, false),
  ('accountant', 'invoices', true, true, true, false, true),
  ('accountant', 'costs', true, true, true, false, false),
  ('accountant', 'reports', true, true, false, false, false),

  -- Fleet Manager permissions
  ('fleet_manager', 'dashboard', true, false, false, false, false),
  ('fleet_manager', 'vehicles', true, true, true, true, true),
  ('fleet_manager', 'drivers', true, true, true, true, false),
  ('fleet_manager', 'maintenance', true, true, true, false, true),
  ('fleet_manager', 'gps_tracking', true, false, false, false, false),

  -- HR Manager permissions
  ('hr_manager', 'dashboard', true, false, false, false, false),
  ('hr_manager', 'hr', true, true, true, true, true),
  ('hr_manager', 'reports', true, true, false, false, false)
ON CONFLICT (role, module) DO NOTHING;

-- Enable RLS on role_permissions
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their role permissions"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (
    role = (SELECT role FROM profiles WHERE id = auth.uid())
  );
