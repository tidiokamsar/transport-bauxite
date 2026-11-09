/*
  # Enhance Invoicing System

  1. Changes
    - Create customers table
    - Enhance existing invoices table
    - Create invoice_items table
    - Create payments table
    - Add relationships and new columns

  2. Notes
    - Works with existing schema
    - Adds comprehensive invoicing capabilities
*/

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_number text UNIQUE NOT NULL,
  customer_type text NOT NULL DEFAULT 'company',
  company_name text,
  contact_name text NOT NULL,
  email text,
  phone text,
  address text,
  city text,
  country text DEFAULT 'Guinée',
  tax_id text,
  payment_terms integer DEFAULT 30,
  credit_limit numeric DEFAULT 0,
  notes text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'customer_id') THEN
    ALTER TABLE invoices ADD COLUMN customer_id uuid REFERENCES customers(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'invoice_date') THEN
    ALTER TABLE invoices ADD COLUMN invoice_date date DEFAULT CURRENT_DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'status') THEN
    ALTER TABLE invoices ADD COLUMN status text DEFAULT 'draft';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'subtotal') THEN
    ALTER TABLE invoices ADD COLUMN subtotal numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'tax_rate') THEN
    ALTER TABLE invoices ADD COLUMN tax_rate numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'tax_amount') THEN
    ALTER TABLE invoices ADD COLUMN tax_amount numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'discount_amount') THEN
    ALTER TABLE invoices ADD COLUMN discount_amount numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'total_amount') THEN
    ALTER TABLE invoices ADD COLUMN total_amount numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'amount_paid') THEN
    ALTER TABLE invoices ADD COLUMN amount_paid numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'balance_due') THEN
    ALTER TABLE invoices ADD COLUMN balance_due numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'currency') THEN
    ALTER TABLE invoices ADD COLUMN currency text DEFAULT 'GNF';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'notes') THEN
    ALTER TABLE invoices ADD COLUMN notes text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'terms') THEN
    ALTER TABLE invoices ADD COLUMN terms text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'created_by') THEN
    ALTER TABLE invoices ADD COLUMN created_by uuid REFERENCES profiles(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES trips(id),
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric DEFAULT 0,
  item_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number text UNIQUE NOT NULL,
  invoice_id uuid REFERENCES invoices(id),
  customer_id uuid REFERENCES customers(id),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL,
  payment_method text NOT NULL,
  reference_number text,
  notes text,
  received_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
  ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
  ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "auth_view_customers" ON customers FOR SELECT TO authenticated USING (true);
  CREATE POLICY "auth_insert_customers" ON customers FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "auth_update_customers" ON customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "auth_delete_customers" ON customers FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "auth_view_invoice_items" ON invoice_items FOR SELECT TO authenticated USING (true);
  CREATE POLICY "auth_insert_invoice_items" ON invoice_items FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "auth_update_invoice_items" ON invoice_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "auth_delete_invoice_items" ON invoice_items FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "auth_view_payments" ON payments FOR SELECT TO authenticated USING (true);
  CREATE POLICY "auth_insert_payments" ON payments FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "auth_update_payments" ON payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "auth_delete_payments" ON payments FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
