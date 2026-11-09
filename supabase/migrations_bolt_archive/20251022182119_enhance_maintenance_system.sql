/*
  # Enhance Maintenance System

  1. Changes
    - Add missing columns to existing tables
    - Create additional tables if needed
    - Enhance maintenance_orders table

  2. Notes
    - Works with existing schema
    - Adds comprehensive tracking capabilities
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_orders' AND column_name = 'work_order_number') THEN
    ALTER TABLE maintenance_orders ADD COLUMN work_order_number text UNIQUE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_orders' AND column_name = 'title') THEN
    ALTER TABLE maintenance_orders ADD COLUMN title text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_orders' AND column_name = 'priority') THEN
    ALTER TABLE maintenance_orders ADD COLUMN priority text DEFAULT 'medium';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_orders' AND column_name = 'assigned_to') THEN
    ALTER TABLE maintenance_orders ADD COLUMN assigned_to uuid REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_orders' AND column_name = 'requested_by') THEN
    ALTER TABLE maintenance_orders ADD COLUMN requested_by uuid REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_orders' AND column_name = 'site_id') THEN
    ALTER TABLE maintenance_orders ADD COLUMN site_id uuid REFERENCES sites(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_orders' AND column_name = 'scheduled_date') THEN
    ALTER TABLE maintenance_orders ADD COLUMN scheduled_date date;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_orders' AND column_name = 'started_at') THEN
    ALTER TABLE maintenance_orders ADD COLUMN started_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_orders' AND column_name = 'estimated_cost') THEN
    ALTER TABLE maintenance_orders ADD COLUMN estimated_cost numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_orders' AND column_name = 'actual_cost') THEN
    ALTER TABLE maintenance_orders ADD COLUMN actual_cost numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_orders' AND column_name = 'notes') THEN
    ALTER TABLE maintenance_orders ADD COLUMN notes text;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS spare_parts_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_number text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  category text,
  unit_price numeric NOT NULL DEFAULT 0,
  unit text DEFAULT 'unit',
  minimum_stock numeric DEFAULT 0,
  reorder_quantity numeric DEFAULT 0,
  supplier text,
  supplier_part_number text,
  notes text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id),
  title text NOT NULL,
  description text,
  maintenance_type text NOT NULL,
  frequency_type text NOT NULL,
  frequency_value numeric NOT NULL,
  last_service_date date,
  last_service_km numeric,
  next_service_date date,
  next_service_km numeric,
  estimated_cost numeric DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE spare_parts_catalog ENABLE ROW LEVEL SECURITY;
  ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "auth_view_spare_parts_catalog" ON spare_parts_catalog FOR SELECT TO authenticated USING (true);
  CREATE POLICY "auth_insert_spare_parts_catalog" ON spare_parts_catalog FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "auth_update_spare_parts_catalog" ON spare_parts_catalog FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "auth_delete_spare_parts_catalog" ON spare_parts_catalog FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "auth_view_maintenance_schedules" ON maintenance_schedules FOR SELECT TO authenticated USING (true);
  CREATE POLICY "auth_insert_maintenance_schedules" ON maintenance_schedules FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "auth_update_maintenance_schedules" ON maintenance_schedules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "auth_delete_maintenance_schedules" ON maintenance_schedules FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_maintenance_orders_vehicle ON maintenance_orders(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_orders_status ON maintenance_orders(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_orders_date ON maintenance_orders(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_vehicle ON maintenance_schedules(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_spare_parts_catalog_number ON spare_parts_catalog(part_number);
