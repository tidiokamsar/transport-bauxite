/*
  # Create Fuel Management System

  1. New Tables
    - `fuel_types` - Types de carburant
    - `fuel_stocks` - Stocks de carburant par site
    - `fuel_transactions` - Transactions (ravitaillement et consommation)

  2. Security
    - Enable RLS on all tables
    - Policies for authenticated users

  3. Indexes
    - Performance indexes on key columns
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
    CREATE TYPE transaction_type AS ENUM ('refill', 'consumption');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS fuel_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  unit text NOT NULL DEFAULT 'litres',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fuel_stocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id),
  fuel_type_id uuid REFERENCES fuel_types(id),
  tank_capacity numeric NOT NULL DEFAULT 0,
  current_stock numeric NOT NULL DEFAULT 0,
  minimum_stock numeric NOT NULL DEFAULT 0,
  last_refill_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(site_id, fuel_type_id)
);

CREATE TABLE IF NOT EXISTS fuel_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text UNIQUE NOT NULL,
  transaction_type transaction_type NOT NULL,
  fuel_type_id uuid REFERENCES fuel_types(id),
  site_id uuid REFERENCES sites(id),
  vehicle_id uuid REFERENCES vehicles(id),
  driver_id uuid REFERENCES drivers(id),
  trip_id uuid REFERENCES trips(id),
  quantity numeric NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  odometer_reading numeric,
  transaction_date timestamptz NOT NULL DEFAULT now(),
  supplier text,
  invoice_number text,
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE fuel_types ENABLE ROW LEVEL SECURITY;
  ALTER TABLE fuel_stocks ENABLE ROW LEVEL SECURITY;
  ALTER TABLE fuel_transactions ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_view_fuel_types" ON fuel_types FOR SELECT TO authenticated USING (true);
  CREATE POLICY "auth_insert_fuel_types" ON fuel_types FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "auth_update_fuel_types" ON fuel_types FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_view_fuel_stocks" ON fuel_stocks FOR SELECT TO authenticated USING (true);
  CREATE POLICY "auth_insert_fuel_stocks" ON fuel_stocks FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "auth_update_fuel_stocks" ON fuel_stocks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_view_fuel_trans" ON fuel_transactions FOR SELECT TO authenticated USING (true);
  CREATE POLICY "auth_insert_fuel_trans" ON fuel_transactions FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "auth_update_fuel_trans" ON fuel_transactions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "auth_delete_fuel_trans" ON fuel_transactions FOR DELETE TO authenticated USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_fuel_transactions_date ON fuel_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_vehicle ON fuel_transactions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_driver ON fuel_transactions(driver_id);
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_type ON fuel_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_fuel_stocks_site ON fuel_stocks(site_id);
