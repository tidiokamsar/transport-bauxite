/*
  # Create All Remaining SIGTB Tables

  1. Stock & Inventory
    - `stock_categories` - Categories for inventory items
    - `stock_items` - Inventory items (parts, consumables)
    - `stock_movements` - Entry/exit movements
    - `warehouses` - Storage locations

  2. Purchases & Suppliers
    - `suppliers` - Supplier information
    - `purchase_orders` - Purchase orders
    - `purchase_order_items` - PO line items
    - `deliveries` - Delivery receipts

  3. Costs & Charges
    - `cost_categories` - Expense categories
    - `expenses` - Operating expenses
    - `vehicle_costs` - Cost tracking per vehicle

  4. HR & Payroll
    - `employees` - Employee records
    - `attendance` - Daily attendance
    - `leave_requests` - Leave management
    - `payroll` - Salary calculations
    - `payroll_items` - Salary components

  5. Additional Tracking
    - `alerts` - System alerts
    - `notifications` - User notifications
    - `documents` - Document management
*/

-- Stock Categories
CREATE TABLE IF NOT EXISTS stock_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  parent_id uuid REFERENCES stock_categories(id),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Warehouses
CREATE TABLE IF NOT EXISTS warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  code text UNIQUE NOT NULL,
  warehouse_type text NOT NULL CHECK (warehouse_type IN ('main', 'garage', 'fuel_station', 'depot')),
  location text,
  manager_name text,
  phone text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Stock Items
CREATE TABLE IF NOT EXISTS stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  category_id uuid REFERENCES stock_categories(id),

  unit_of_measure text NOT NULL DEFAULT 'piece',
  unit_price bigint DEFAULT 0,

  quantity_in_stock integer DEFAULT 0,
  minimum_threshold integer DEFAULT 0,
  maximum_threshold integer,

  warehouse_id uuid REFERENCES warehouses(id),
  location_in_warehouse text,

  supplier_id uuid,

  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Stock Movements
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_number text UNIQUE NOT NULL,
  movement_date timestamptz DEFAULT now(),
  movement_type text NOT NULL CHECK (movement_type IN ('entry', 'exit', 'transfer', 'adjustment', 'return')),

  stock_item_id uuid NOT NULL REFERENCES stock_items(id),
  quantity integer NOT NULL,
  unit_price bigint,
  total_value bigint,

  from_warehouse_id uuid REFERENCES warehouses(id),
  to_warehouse_id uuid REFERENCES warehouses(id),

  reference_type text,
  reference_id uuid,

  vehicle_id uuid REFERENCES vehicles(id),
  maintenance_order_id uuid REFERENCES maintenance_orders(id),

  notes text,
  performed_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_number text UNIQUE NOT NULL,
  supplier_type text NOT NULL CHECK (supplier_type IN ('parts', 'tires', 'fuel', 'services', 'other')),

  company_name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  address text,

  payment_terms text,
  credit_limit bigint,

  rating integer CHECK (rating >= 1 AND rating <= 5),
  notes text,

  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text UNIQUE NOT NULL,
  po_date date NOT NULL DEFAULT CURRENT_DATE,

  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  warehouse_id uuid REFERENCES warehouses(id),

  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'received', 'cancelled')),

  subtotal bigint DEFAULT 0,
  tax_amount bigint DEFAULT 0,
  total_amount bigint DEFAULT 0,

  expected_delivery_date date,
  notes text,

  requested_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Purchase Order Items
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  stock_item_id uuid REFERENCES stock_items(id),

  item_description text NOT NULL,
  quantity integer NOT NULL,
  unit_price bigint NOT NULL,
  total_price bigint NOT NULL,

  quantity_received integer DEFAULT 0,

  created_at timestamptz DEFAULT now()
);

-- Deliveries
CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_number text UNIQUE NOT NULL,
  delivery_date date NOT NULL DEFAULT CURRENT_DATE,

  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  warehouse_id uuid REFERENCES warehouses(id),

  received_by uuid REFERENCES auth.users(id),
  notes text,

  created_at timestamptz DEFAULT now()
);

-- Cost Categories
CREATE TABLE IF NOT EXISTS cost_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  category_type text NOT NULL CHECK (category_type IN ('fixed', 'variable', 'operational')),
  description text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_number text UNIQUE NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,

  category_id uuid NOT NULL REFERENCES cost_categories(id),

  description text NOT NULL,
  amount bigint NOT NULL,

  vehicle_id uuid REFERENCES vehicles(id),
  driver_id uuid REFERENCES drivers(id),
  trip_id uuid REFERENCES trips(id),

  payment_method text CHECK (payment_method IN ('cash', 'bank_transfer', 'check', 'mobile_money', 'credit')),
  payment_reference text,

  supplier_id uuid REFERENCES suppliers(id),
  invoice_number text,

  notes text,
  recorded_by uuid REFERENCES auth.users(id),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Vehicle Costs Summary
CREATE TABLE IF NOT EXISTS vehicle_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  cost_period date NOT NULL,

  fuel_cost bigint DEFAULT 0,
  maintenance_cost bigint DEFAULT 0,
  tire_cost bigint DEFAULT 0,
  insurance_cost bigint DEFAULT 0,
  other_costs bigint DEFAULT 0,
  total_cost bigint DEFAULT 0,

  distance_traveled integer DEFAULT 0,
  cost_per_km decimal(10,2),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(vehicle_id, cost_period)
);

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number text UNIQUE NOT NULL,

  first_name text NOT NULL,
  last_name text NOT NULL,
  full_name text GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,

  date_of_birth date,
  gender text CHECK (gender IN ('male', 'female', 'other')),
  national_id text,

  position text NOT NULL,
  department text NOT NULL,
  hire_date date NOT NULL DEFAULT CURRENT_DATE,

  phone text,
  email text,
  address text,

  base_salary bigint DEFAULT 0,

  bank_name text,
  bank_account text,

  emergency_contact_name text,
  emergency_contact_phone text,

  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'suspended', 'terminated')),

  photo_url text,
  notes text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Attendance
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id),
  attendance_date date NOT NULL,

  check_in_time time,
  check_out_time time,

  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'half_day', 'on_leave', 'holiday')),

  hours_worked decimal(4,2),
  overtime_hours decimal(4,2) DEFAULT 0,

  notes text,
  recorded_by uuid REFERENCES auth.users(id),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(employee_id, attendance_date)
);

-- Leave Requests
CREATE TABLE IF NOT EXISTS leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id),

  leave_type text NOT NULL CHECK (leave_type IN ('annual', 'sick', 'maternity', 'unpaid', 'other')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_requested integer NOT NULL,

  reason text,

  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),

  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  rejection_reason text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Payroll
CREATE TABLE IF NOT EXISTS payroll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_number text UNIQUE NOT NULL,

  employee_id uuid NOT NULL REFERENCES employees(id),

  payroll_period_start date NOT NULL,
  payroll_period_end date NOT NULL,
  payment_date date NOT NULL,

  base_salary bigint NOT NULL,
  allowances bigint DEFAULT 0,
  bonuses bigint DEFAULT 0,
  overtime_pay bigint DEFAULT 0,

  gross_salary bigint NOT NULL,

  deductions bigint DEFAULT 0,
  tax bigint DEFAULT 0,

  net_salary bigint NOT NULL,

  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid')),

  payment_method text CHECK (payment_method IN ('bank_transfer', 'cash', 'check', 'mobile_money')),
  payment_reference text,

  notes text,

  prepared_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Payroll Items (detailed breakdown)
CREATE TABLE IF NOT EXISTS payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id uuid NOT NULL REFERENCES payroll(id) ON DELETE CASCADE,

  item_type text NOT NULL CHECK (item_type IN ('earning', 'deduction')),
  item_name text NOT NULL,
  amount bigint NOT NULL,

  created_at timestamptz DEFAULT now()
);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL CHECK (alert_type IN (
    'vehicle_maintenance', 'fuel_low', 'tire_replacement', 'document_expiry',
    'driver_license_expiry', 'insurance_expiry', 'stock_low', 'invoice_overdue'
  )),

  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),

  title text NOT NULL,
  message text NOT NULL,

  reference_type text,
  reference_id uuid,

  vehicle_id uuid REFERENCES vehicles(id),
  driver_id uuid REFERENCES drivers(id),

  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),

  acknowledged_by uuid REFERENCES auth.users(id),
  acknowledged_at timestamptz,

  created_at timestamptz DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),

  notification_type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,

  reference_type text,
  reference_id uuid,

  read boolean DEFAULT false,
  read_at timestamptz,

  created_at timestamptz DEFAULT now()
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text UNIQUE NOT NULL,

  document_type text NOT NULL CHECK (document_type IN (
    'vehicle_insurance', 'vehicle_registration', 'technical_inspection',
    'driver_license', 'contract', 'invoice', 'receipt', 'other'
  )),

  title text NOT NULL,
  description text,

  reference_type text,
  reference_id uuid,

  vehicle_id uuid REFERENCES vehicles(id),
  driver_id uuid REFERENCES drivers(id),

  issue_date date,
  expiry_date date,

  file_url text,
  file_name text,
  file_size integer,

  uploaded_by uuid REFERENCES auth.users(id),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stock_items_category ON stock_items(category_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_warehouse ON stock_items(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements(stock_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_expenses_vehicle ON expenses(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_payroll_employee ON payroll(employee_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_documents_expiry ON documents(expiry_date);

-- Enable RLS
ALTER TABLE stock_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies (basic authenticated access)
CREATE POLICY "Users can view all data" ON stock_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage data" ON stock_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view warehouses" ON warehouses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage warehouses" ON warehouses FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view stock items" ON stock_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage stock items" ON stock_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view stock movements" ON stock_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create stock movements" ON stock_movements FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can view suppliers" ON suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage suppliers" ON suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view purchase orders" ON purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage purchase orders" ON purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view PO items" ON purchase_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage PO items" ON purchase_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view deliveries" ON deliveries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage deliveries" ON deliveries FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view cost categories" ON cost_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage cost categories" ON cost_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view expenses" ON expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage expenses" ON expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view vehicle costs" ON vehicle_costs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage vehicle costs" ON vehicle_costs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view employees" ON employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage employees" ON employees FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view attendance" ON attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage attendance" ON attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view leave requests" ON leave_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage leave requests" ON leave_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view payroll" ON payroll FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage payroll" ON payroll FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view payroll items" ON payroll_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view alerts" ON alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage alerts" ON alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view documents" ON documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage documents" ON documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Link stock_items to suppliers (update foreign key)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') THEN
    ALTER TABLE stock_items
    ADD CONSTRAINT fk_stock_items_supplier
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id);
  END IF;
END $$;
