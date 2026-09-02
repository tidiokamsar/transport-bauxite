/*
  # Fix Security Issues - Part 2: Optimize RLS Policies (Corrected)
  
  1. RLS Performance Optimization
    - Replaces auth.<function>() with (select auth.<function>())
    - Prevents re-evaluation for each row
    - Significantly improves query performance at scale
    
  2. Tables Updated
    - sites, vehicles, drivers, trips
    - fuel_transactions, maintenance_orders, parts_inventory
    - clients, invoices, user_activity_logs
    - work_shifts, role_permissions
*/

-- Drop and recreate optimized policies for sites
DROP POLICY IF EXISTS "Admins can manage sites" ON sites;
CREATE POLICY "Admins can manage sites" ON sites
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'director')
    )
  );

-- Drop and recreate optimized policies for vehicles
DROP POLICY IF EXISTS "Fleet managers and admins can manage vehicles" ON vehicles;
CREATE POLICY "Fleet managers and admins can manage vehicles" ON vehicles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'director', 'fleet_manager')
    )
  );

-- Drop and recreate optimized policies for drivers
DROP POLICY IF EXISTS "Managers can manage drivers" ON drivers;
CREATE POLICY "Managers can manage drivers" ON drivers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'director', 'fleet_manager', 'operations_manager')
    )
  );

-- Drop and recreate optimized policies for trips
DROP POLICY IF EXISTS "Managers can manage trips" ON trips;
CREATE POLICY "Managers can manage trips" ON trips
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'director', 'operations_manager')
    )
  );

-- Drop and recreate optimized policies for fuel_transactions
DROP POLICY IF EXISTS "Authorized users can create fuel transactions" ON fuel_transactions;
CREATE POLICY "Authorized users can create fuel transactions" ON fuel_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'director', 'operations_manager', 'logistician')
    )
  );

-- Drop and recreate optimized policies for maintenance_orders
DROP POLICY IF EXISTS "Maintenance chiefs can manage orders" ON maintenance_orders;
CREATE POLICY "Maintenance chiefs can manage orders" ON maintenance_orders
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'director', 'maintenance_chief')
    )
  );

-- Drop and recreate optimized policies for parts_inventory
DROP POLICY IF EXISTS "Maintenance chiefs can manage parts" ON parts_inventory;
CREATE POLICY "Maintenance chiefs can manage parts" ON parts_inventory
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'director', 'maintenance_chief', 'logistician')
    )
  );

-- Drop and recreate optimized policies for clients
DROP POLICY IF EXISTS "Admins and accountants can manage clients" ON clients;
CREATE POLICY "Admins and accountants can manage clients" ON clients
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'director', 'accountant')
    )
  );

-- Drop and recreate optimized policies for invoices
DROP POLICY IF EXISTS "Accountants can manage invoices" ON invoices;
CREATE POLICY "Accountants can manage invoices" ON invoices
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'director', 'accountant')
    )
  );

-- Drop and recreate optimized policies for user_activity_logs
DROP POLICY IF EXISTS "Admins can view all activity logs" ON user_activity_logs;
CREATE POLICY "Admins can view all activity logs" ON user_activity_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'director')
    )
  );

-- Drop and recreate optimized policies for work_shifts
DROP POLICY IF EXISTS "Admins can manage work shifts" ON work_shifts;
CREATE POLICY "Admins can manage work shifts" ON work_shifts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'director', 'operations_manager')
    )
  );

-- Drop and recreate optimized policies for role_permissions
DROP POLICY IF EXISTS "Admins can manage permissions" ON role_permissions;
CREATE POLICY "Admins can manage permissions" ON role_permissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'director')
    )
  );
