/*
  # Fix Security Issues - Part 4: Consolidate Multiple Policies (Corrected)
  
  1. Policy Consolidation
    - Removes duplicate permissive policies
    - Keeps most restrictive/comprehensive policy
    - Improves policy evaluation performance
    
  2. Tables Updated
    - attendance, clients, costs, drivers, employees
    - fuel_stocks, fuel_transactions, invoices
    - maintenance_orders, parts_inventory, payments
    - payroll_records, purchase_orders, role_permissions
    - sites, tires, trips, vehicles
*/

-- ATTENDANCE: Keep comprehensive policy
DROP POLICY IF EXISTS "Allow authenticated read attendance" ON attendance;

-- CLIENTS: Consolidate to single comprehensive policy
DROP POLICY IF EXISTS "Allow authenticated modify clients" ON clients;
DROP POLICY IF EXISTS "Allow authenticated read clients" ON clients;

-- COSTS: Keep single read policy
DROP POLICY IF EXISTS "Users can view costs" ON costs;

-- DRIVERS: Consolidate to manager policy
DROP POLICY IF EXISTS "Allow authenticated modify drivers" ON drivers;
DROP POLICY IF EXISTS "Allow authenticated read drivers" ON drivers;

-- EMPLOYEES: Keep single read policy
DROP POLICY IF EXISTS "Users can view employees" ON employees;

-- FUEL_STOCKS: Keep single policy
DROP POLICY IF EXISTS auth_view_fuel_stocks ON fuel_stocks;

-- FUEL_TRANSACTIONS: Keep comprehensive policy
DROP POLICY IF EXISTS "Users can view fuel transactions" ON fuel_transactions;

-- INVOICES: Keep accountant policy (more restrictive)
DROP POLICY IF EXISTS "Allow authenticated read invoices" ON invoices;

-- MAINTENANCE_ORDERS: Keep maintenance chief policy
DROP POLICY IF EXISTS "Allow authenticated read maintenance_orders" ON maintenance_orders;

-- PARTS_INVENTORY: Keep maintenance policy
DROP POLICY IF EXISTS "Allow authenticated read parts_inventory" ON parts_inventory;

-- PAYMENTS: Keep single policy
DROP POLICY IF EXISTS auth_view_payments ON payments;

-- PAYROLL_RECORDS: Keep auth policy
DROP POLICY IF EXISTS "Auth users manage payroll" ON payroll_records;

-- PURCHASE_ORDERS: Keep single read policy
DROP POLICY IF EXISTS "Users can view purchase orders" ON purchase_orders;

-- ROLE_PERMISSIONS: Keep admin policy, add separate read policy
DROP POLICY IF EXISTS "Users can read their role permissions" ON role_permissions;
CREATE POLICY "Users can read own role permissions" ON role_permissions
  FOR SELECT
  TO authenticated
  USING (
    role = (
      SELECT profiles.role::text FROM profiles WHERE profiles.id = (SELECT auth.uid())
    )
  );

-- SITES: Consolidate to admin policy
DROP POLICY IF EXISTS "Allow authenticated modify sites" ON sites;
DROP POLICY IF EXISTS "Allow authenticated read sites" ON sites;

-- TIRES: Consolidate all policies
DROP POLICY IF EXISTS "Allow authenticated modify tires" ON tires;
DROP POLICY IF EXISTS "Allow authenticated read tires" ON tires;
DROP POLICY IF EXISTS "Users can view tires" ON tires;
DROP POLICY IF EXISTS "Users can insert tires" ON tires;
DROP POLICY IF EXISTS "Users can update tires" ON tires;
DROP POLICY IF EXISTS "Users can delete tires" ON tires;

-- Create single comprehensive tire policy
CREATE POLICY "Authenticated users manage tires" ON tires
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- TRIPS: Consolidate to manager policy
DROP POLICY IF EXISTS "Allow authenticated modify trips" ON trips;
DROP POLICY IF EXISTS "Allow authenticated read trips" ON trips;

-- VEHICLES: Consolidate to fleet manager policy
DROP POLICY IF EXISTS "Allow authenticated modify vehicles" ON vehicles;
DROP POLICY IF EXISTS "Allow authenticated read vehicles" ON vehicles;
