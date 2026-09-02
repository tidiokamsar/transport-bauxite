/*
  # Enhance Fuel Transactions Schema

  1. Changes
    - Add missing columns to fuel_transactions table
    - Rename existing columns to match naming convention
    - Add new columns for comprehensive tracking

  2. Notes
    - Maintains existing data
    - Adds reference, site_id, fuel_type_id, and other tracking fields
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_transactions' AND column_name = 'reference') THEN
    ALTER TABLE fuel_transactions ADD COLUMN reference text UNIQUE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_transactions' AND column_name = 'site_id') THEN
    ALTER TABLE fuel_transactions ADD COLUMN site_id uuid REFERENCES sites(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_transactions' AND column_name = 'fuel_type_id') THEN
    ALTER TABLE fuel_transactions ADD COLUMN fuel_type_id uuid REFERENCES fuel_types(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_transactions' AND column_name = 'quantity') THEN
    ALTER TABLE fuel_transactions ADD COLUMN quantity numeric;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_transactions' AND column_name = 'total_amount') THEN
    ALTER TABLE fuel_transactions ADD COLUMN total_amount numeric;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_transactions' AND column_name = 'odometer_reading') THEN
    ALTER TABLE fuel_transactions ADD COLUMN odometer_reading numeric;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_transactions' AND column_name = 'invoice_number') THEN
    ALTER TABLE fuel_transactions ADD COLUMN invoice_number text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_transactions' AND column_name = 'notes') THEN
    ALTER TABLE fuel_transactions ADD COLUMN notes text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_transactions' AND column_name = 'created_by') THEN
    ALTER TABLE fuel_transactions ADD COLUMN created_by uuid REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_transactions' AND column_name = 'updated_at') THEN
    ALTER TABLE fuel_transactions ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fuel_trans_ref ON fuel_transactions(reference);
CREATE INDEX IF NOT EXISTS idx_fuel_trans_site ON fuel_transactions(site_id);
CREATE INDEX IF NOT EXISTS idx_fuel_trans_fuel_type ON fuel_transactions(fuel_type_id);
