/*
  # SIGTB Database Schema - Core Tables
  
  ## Overview
  Complete database schema for the Bauxite Transport Management System (SIGTB).
  
  ## New Tables
  
  ### 1. Users & Authentication
    - `profiles` - Extended user profile data with roles
      - id (uuid, references auth.users)
      - role (enum: admin, director, operations_manager, fleet_manager, maintenance_chief, logistician, accountant, driver)
      - full_name (text)
      - phone (text)
      - site_id (uuid, optional FK)
      - created_at, updated_at
  
  ### 2. Sites & Locations
    - `sites` - Mining sites, depots, ports, workshops
      - id (uuid)
      - name (text)
      - type (enum: mine, port, depot, workshop, base)
      - location (text)
      - active (boolean)
  
  ### 3. Vehicles
    - `vehicles` - Trucks and equipment
      - id (uuid)
      - registration (text, unique)
      - brand_model (text)
      - year (integer)
      - capacity_tonnes (numeric)
      - vehicle_type (enum: tipper, tanker, flatbed)
      - chassis_number (text)
      - current_km (numeric)
      - status (enum: active, maintenance, immobilized, sold)
      - site_id (uuid FK)
      - purchase_cost (numeric)
      - current_value (numeric)
      - insurance_expiry, technical_inspection_expiry (date)
  
  ### 4. Trailers
    - `trailers` - Trailer equipment
      - id (uuid)
      - registration (text)
      - capacity_tonnes (numeric)
      - status (enum: active, maintenance, retired)
  
  ### 5. Drivers
    - `drivers` - Driver information
      - id (uuid)
      - profile_id (uuid FK to profiles)
      - license_number (text)
      - license_category (text)
      - license_expiry (date)
      - hire_date (date)
      - contract_type (text)
      - base_salary (numeric)
      - status (enum: active, suspended, terminated)
      - health_certificate_expiry (date)
      - total_tonnage (numeric, default 0)
      - total_km (numeric, default 0)
  
  ### 6. Trips
    - `trips` - Transport missions/voyages
      - id (uuid)
      - reference (text, unique)
      - planned_date (date)
      - vehicle_id, driver_id, trailer_id (FKs)
      - departure_site_id, arrival_site_id (FKs)
      - estimated_distance_km (numeric)
      - actual_departure_time, actual_arrival_time (timestamptz)
      - km_start, km_end (numeric)
      - gross_weight, tare_weight, net_weight (numeric)
      - status (enum: planned, in_progress, completed, cancelled)
      - client_id (uuid FK)
  
  ### 7. Weighings
    - `weighings` - Weighing records
      - id (uuid)
      - trip_id (uuid FK)
      - scale_id (text)
      - weighing_time (timestamptz)
      - gross_weight, tare_weight, net_weight (numeric)
      - ticket_number (text)
      - operator_name (text)
      - client_signature (text)
      - photo_url (text)
  
  ### 8. Fuel
    - `fuel_transactions` - Fuel vouchers and consumption
      - id (uuid)
      - transaction_date (date)
      - vehicle_id, driver_id (FKs)
      - volume_liters (numeric)
      - unit_price, total_cost (numeric)
      - transaction_type (enum: refuel, tank_fill)
      - receipt_photo_url (text)
      - supplier (text)
      - trip_id (uuid FK, optional)
  
  ### 9. Maintenance
    - `maintenance_orders` - Repair and maintenance orders
      - id (uuid)
      - vehicle_id (uuid FK)
      - request_date (date)
      - maintenance_type (enum: preventive, corrective)
      - km_at_maintenance (numeric)
      - description (text)
      - labor_hours, labor_cost (numeric)
      - status (enum: open, in_progress, completed, cancelled)
      - workshop (enum: internal, external)
      - completion_date (date)
  
  ### 10. Parts Inventory
    - `parts_inventory` - Spare parts stock
      - id (uuid)
      - part_reference (text, unique)
      - description (text)
      - quantity_in_stock (numeric)
      - minimum_threshold (numeric)
      - unit_price (numeric)
      - supplier (text)
  
    - `maintenance_parts` - Parts used in maintenance
      - id (uuid)
      - maintenance_order_id (uuid FK)
      - part_id (uuid FK)
      - quantity_used (numeric)
      - unit_cost (numeric)
  
  ### 11. Clients & Contracts
    - `clients` - Customer information
      - id (uuid)
      - name (text)
      - contract_reference (text)
      - rate_per_tonne (numeric)
      - payment_terms_days (integer)
      - late_penalty_rate (numeric)
      - active (boolean)
  
  ### 12. Invoices
    - `invoices` - Client invoices and statements
      - id (uuid)
      - client_id (uuid FK)
      - invoice_number (text, unique)
      - period_start, period_end (date)
      - total_tonnage (numeric)
      - unit_rate (numeric)
      - gross_amount (numeric)
      - deductions, taxes (numeric)
      - net_amount (numeric)
      - payment_status (enum: pending, partial, paid, overdue)
      - due_date (date)
      - pdf_url (text)
  
  ### 13. Incidents
    - `incidents` - Accidents and incidents
      - id (uuid)
      - trip_id (uuid FK)
      - incident_time (timestamptz)
      - description (text)
      - severity (enum: minor, moderate, severe, critical)
      - estimated_cost (numeric)
      - insurance_report_url (text)
  
  ### 14. System Parameters
    - `system_parameters` - Global configuration
      - id (uuid)
      - param_key (text, unique)
      - param_value (text)
      - description (text)
  
  ## Security
  - RLS enabled on all tables
  - Policies created for role-based access control
  - Authentication required for all operations
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'director', 'operations_manager', 'fleet_manager', 'maintenance_chief', 'logistician', 'accountant', 'driver');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE site_type AS ENUM ('mine', 'port', 'depot', 'workshop', 'base');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE vehicle_type AS ENUM ('tipper', 'tanker', 'flatbed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE vehicle_status AS ENUM ('active', 'maintenance', 'immobilized', 'sold');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE driver_status AS ENUM ('active', 'suspended', 'terminated');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE trip_status AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE fuel_transaction_type AS ENUM ('refuel', 'tank_fill');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE maintenance_type AS ENUM ('preventive', 'corrective');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE maintenance_status AS ENUM ('open', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE workshop_type AS ENUM ('internal', 'external');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE incident_severity AS ENUM ('minor', 'moderate', 'severe', 'critical');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'partial', 'paid', 'overdue');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Sites table
CREATE TABLE IF NOT EXISTS sites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  type site_type NOT NULL,
  location text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'driver',
  full_name text NOT NULL,
  phone text,
  site_id uuid REFERENCES sites(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration text UNIQUE NOT NULL,
  brand_model text NOT NULL,
  year integer,
  capacity_tonnes numeric NOT NULL,
  vehicle_type vehicle_type NOT NULL,
  chassis_number text,
  current_km numeric DEFAULT 0,
  status vehicle_status DEFAULT 'active',
  site_id uuid REFERENCES sites(id),
  purchase_cost numeric DEFAULT 0,
  current_value numeric DEFAULT 0,
  insurance_expiry date,
  technical_inspection_expiry date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Trailers table
CREATE TABLE IF NOT EXISTS trailers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration text UNIQUE NOT NULL,
  capacity_tonnes numeric NOT NULL,
  status vehicle_status DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Drivers table
CREATE TABLE IF NOT EXISTS drivers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  license_number text NOT NULL,
  license_category text NOT NULL,
  license_expiry date NOT NULL,
  hire_date date NOT NULL,
  contract_type text,
  base_salary numeric DEFAULT 0,
  status driver_status DEFAULT 'active',
  health_certificate_expiry date,
  total_tonnage numeric DEFAULT 0,
  total_km numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  contract_reference text,
  rate_per_tonne numeric NOT NULL,
  payment_terms_days integer DEFAULT 30,
  late_penalty_rate numeric DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Trips table
CREATE TABLE IF NOT EXISTS trips (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference text UNIQUE NOT NULL,
  planned_date date NOT NULL,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE RESTRICT,
  driver_id uuid REFERENCES drivers(id) ON DELETE RESTRICT,
  trailer_id uuid REFERENCES trailers(id),
  departure_site_id uuid REFERENCES sites(id),
  arrival_site_id uuid REFERENCES sites(id),
  estimated_distance_km numeric,
  actual_departure_time timestamptz,
  actual_arrival_time timestamptz,
  km_start numeric,
  km_end numeric,
  gross_weight numeric,
  tare_weight numeric,
  net_weight numeric,
  status trip_status DEFAULT 'planned',
  client_id uuid REFERENCES clients(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Weighings table
CREATE TABLE IF NOT EXISTS weighings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  scale_id text,
  weighing_time timestamptz DEFAULT now(),
  gross_weight numeric,
  tare_weight numeric,
  net_weight numeric,
  ticket_number text,
  operator_name text,
  client_signature text,
  photo_url text,
  created_at timestamptz DEFAULT now()
);

-- Fuel transactions table
CREATE TABLE IF NOT EXISTS fuel_transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE RESTRICT,
  driver_id uuid REFERENCES drivers(id),
  volume_liters numeric NOT NULL,
  unit_price numeric NOT NULL,
  total_cost numeric NOT NULL,
  transaction_type fuel_transaction_type DEFAULT 'refuel',
  receipt_photo_url text,
  supplier text,
  trip_id uuid REFERENCES trips(id),
  created_at timestamptz DEFAULT now()
);

-- Parts inventory table
CREATE TABLE IF NOT EXISTS parts_inventory (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  part_reference text UNIQUE NOT NULL,
  description text NOT NULL,
  quantity_in_stock numeric DEFAULT 0,
  minimum_threshold numeric DEFAULT 0,
  unit_price numeric DEFAULT 0,
  supplier text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Maintenance orders table
CREATE TABLE IF NOT EXISTS maintenance_orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE RESTRICT,
  request_date date DEFAULT CURRENT_DATE,
  maintenance_type maintenance_type NOT NULL,
  km_at_maintenance numeric,
  description text NOT NULL,
  labor_hours numeric DEFAULT 0,
  labor_cost numeric DEFAULT 0,
  status maintenance_status DEFAULT 'open',
  workshop workshop_type DEFAULT 'internal',
  completion_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Maintenance parts junction table
CREATE TABLE IF NOT EXISTS maintenance_parts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  maintenance_order_id uuid REFERENCES maintenance_orders(id) ON DELETE CASCADE,
  part_id uuid REFERENCES parts_inventory(id) ON DELETE RESTRICT,
  quantity_used numeric NOT NULL,
  unit_cost numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid REFERENCES clients(id) ON DELETE RESTRICT,
  invoice_number text UNIQUE NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_tonnage numeric DEFAULT 0,
  unit_rate numeric NOT NULL,
  gross_amount numeric DEFAULT 0,
  deductions numeric DEFAULT 0,
  taxes numeric DEFAULT 0,
  net_amount numeric DEFAULT 0,
  payment_status payment_status DEFAULT 'pending',
  due_date date,
  pdf_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Incidents table
CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id uuid REFERENCES trips(id) ON DELETE RESTRICT,
  incident_time timestamptz DEFAULT now(),
  description text NOT NULL,
  severity incident_severity NOT NULL,
  estimated_cost numeric DEFAULT 0,
  insurance_report_url text,
  created_at timestamptz DEFAULT now()
);

-- System parameters table
CREATE TABLE IF NOT EXISTS system_parameters (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  param_key text UNIQUE NOT NULL,
  param_value text,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trailers ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE weighings ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_parameters ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_site ON vehicles(site_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle ON trips(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(planned_date);
CREATE INDEX IF NOT EXISTS idx_fuel_vehicle ON fuel_transactions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuel_date ON fuel_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle ON maintenance_orders(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_orders(status);

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Sites policies (all authenticated users can view)
CREATE POLICY "Authenticated users can view sites"
  ON sites FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage sites"
  ON sites FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Vehicles policies
CREATE POLICY "Authenticated users can view vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Fleet managers and admins can manage vehicles"
  ON vehicles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'fleet_manager', 'operations_manager')
    )
  );

-- Drivers policies
CREATE POLICY "Authenticated users can view drivers"
  ON drivers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage drivers"
  ON drivers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'operations_manager', 'fleet_manager')
    )
  );

-- Trips policies
CREATE POLICY "Authenticated users can view trips"
  ON trips FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage trips"
  ON trips FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'operations_manager', 'logistician')
    )
  );

-- Fuel policies
CREATE POLICY "Authenticated users can view fuel transactions"
  ON fuel_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authorized users can create fuel transactions"
  ON fuel_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'operations_manager', 'logistician', 'driver')
    )
  );

-- Maintenance policies
CREATE POLICY "Authenticated users can view maintenance orders"
  ON maintenance_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Maintenance chiefs can manage orders"
  ON maintenance_orders FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'maintenance_chief', 'fleet_manager')
    )
  );

-- Parts inventory policies
CREATE POLICY "Authenticated users can view parts"
  ON parts_inventory FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Maintenance chiefs can manage parts"
  ON parts_inventory FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'maintenance_chief')
    )
  );

-- Clients policies
CREATE POLICY "Authenticated users can view clients"
  ON clients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and accountants can manage clients"
  ON clients FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant', 'director')
    )
  );

-- Invoices policies
CREATE POLICY "Authenticated users can view invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Accountants can manage invoices"
  ON invoices FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant', 'director')
    )
  );

-- Generic policies for other tables
CREATE POLICY "Authenticated users can view weighings"
  ON weighings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view trailers"
  ON trailers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view incidents"
  ON incidents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view maintenance parts"
  ON maintenance_parts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view system parameters"
  ON system_parameters FOR SELECT
  TO authenticated
  USING (true);