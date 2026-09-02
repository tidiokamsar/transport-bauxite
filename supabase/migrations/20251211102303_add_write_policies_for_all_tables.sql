/*
  # Ajout des politiques RLS pour operations d'ecriture

  1. Modifications
    - Ajouter des politiques INSERT, UPDATE, DELETE pour utilisateurs authentifies
    - Permettre la gestion complete des donnees
*/

-- Purchase Orders
DROP POLICY IF EXISTS "Users can insert purchase orders" ON purchase_orders;
CREATE POLICY "Users can insert purchase orders"
  ON purchase_orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update purchase orders" ON purchase_orders;
CREATE POLICY "Users can update purchase orders"
  ON purchase_orders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete purchase orders" ON purchase_orders;
CREATE POLICY "Users can delete purchase orders"
  ON purchase_orders FOR DELETE
  TO authenticated
  USING (true);

-- Suppliers
DROP POLICY IF EXISTS "Users can insert suppliers" ON suppliers;
CREATE POLICY "Users can insert suppliers"
  ON suppliers FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update suppliers" ON suppliers;
CREATE POLICY "Users can update suppliers"
  ON suppliers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete suppliers" ON suppliers;
CREATE POLICY "Users can delete suppliers"
  ON suppliers FOR DELETE
  TO authenticated
  USING (true);

-- Trips
DROP POLICY IF EXISTS "Users can insert trips" ON trips;
CREATE POLICY "Users can insert trips"
  ON trips FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update trips" ON trips;
CREATE POLICY "Users can update trips"
  ON trips FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete trips" ON trips;
CREATE POLICY "Users can delete trips"
  ON trips FOR DELETE
  TO authenticated
  USING (true);

-- Fuel Stocks
DROP POLICY IF EXISTS "Users can insert fuel stocks" ON fuel_stocks;
CREATE POLICY "Users can insert fuel stocks"
  ON fuel_stocks FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update fuel stocks" ON fuel_stocks;
CREATE POLICY "Users can update fuel stocks"
  ON fuel_stocks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Maintenance Orders
DROP POLICY IF EXISTS "Users can insert maintenance orders" ON maintenance_orders;
CREATE POLICY "Users can insert maintenance orders"
  ON maintenance_orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update maintenance orders" ON maintenance_orders;
CREATE POLICY "Users can update maintenance orders"
  ON maintenance_orders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete maintenance orders" ON maintenance_orders;
CREATE POLICY "Users can delete maintenance orders"
  ON maintenance_orders FOR DELETE
  TO authenticated
  USING (true);

-- Stock Items
DROP POLICY IF EXISTS "Users can insert stock items" ON stock_items;
CREATE POLICY "Users can insert stock items"
  ON stock_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update stock items" ON stock_items;
CREATE POLICY "Users can update stock items"
  ON stock_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete stock items" ON stock_items;
CREATE POLICY "Users can delete stock items"
  ON stock_items FOR DELETE
  TO authenticated
  USING (true);

-- Vehicles
DROP POLICY IF EXISTS "Users can insert vehicles" ON vehicles;
CREATE POLICY "Users can insert vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update vehicles" ON vehicles;
CREATE POLICY "Users can update vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete vehicles" ON vehicles;
CREATE POLICY "Users can delete vehicles"
  ON vehicles FOR DELETE
  TO authenticated
  USING (true);

-- Drivers
DROP POLICY IF EXISTS "Users can insert drivers" ON drivers;
CREATE POLICY "Users can insert drivers"
  ON drivers FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update drivers" ON drivers;
CREATE POLICY "Users can update drivers"
  ON drivers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete drivers" ON drivers;
CREATE POLICY "Users can delete drivers"
  ON drivers FOR DELETE
  TO authenticated
  USING (true);

-- Fuel Transactions
DROP POLICY IF EXISTS "Users can insert fuel transactions" ON fuel_transactions;
CREATE POLICY "Users can insert fuel transactions"
  ON fuel_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update fuel transactions" ON fuel_transactions;
CREATE POLICY "Users can update fuel transactions"
  ON fuel_transactions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete fuel transactions" ON fuel_transactions;
CREATE POLICY "Users can delete fuel transactions"
  ON fuel_transactions FOR DELETE
  TO authenticated
  USING (true);

-- Sites
DROP POLICY IF EXISTS "Users can insert sites" ON sites;
CREATE POLICY "Users can insert sites"
  ON sites FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update sites" ON sites;
CREATE POLICY "Users can update sites"
  ON sites FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete sites" ON sites;
CREATE POLICY "Users can delete sites"
  ON sites FOR DELETE
  TO authenticated
  USING (true);

-- Employees
DROP POLICY IF EXISTS "Users can insert employees" ON employees;
CREATE POLICY "Users can insert employees"
  ON employees FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update employees" ON employees;
CREATE POLICY "Users can update employees"
  ON employees FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete employees" ON employees;
CREATE POLICY "Users can delete employees"
  ON employees FOR DELETE
  TO authenticated
  USING (true);

-- Attendance
DROP POLICY IF EXISTS "Users can insert attendance" ON attendance;
CREATE POLICY "Users can insert attendance"
  ON attendance FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update attendance" ON attendance;
CREATE POLICY "Users can update attendance"
  ON attendance FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete attendance" ON attendance;
CREATE POLICY "Users can delete attendance"
  ON attendance FOR DELETE
  TO authenticated
  USING (true);

-- Payroll Records
DROP POLICY IF EXISTS "Users can insert payroll records" ON payroll_records;
CREATE POLICY "Users can insert payroll records"
  ON payroll_records FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update payroll records" ON payroll_records;
CREATE POLICY "Users can update payroll records"
  ON payroll_records FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete payroll records" ON payroll_records;
CREATE POLICY "Users can delete payroll records"
  ON payroll_records FOR DELETE
  TO authenticated
  USING (true);

-- Tires
DROP POLICY IF EXISTS "Users can insert tires" ON tires;
CREATE POLICY "Users can insert tires"
  ON tires FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update tires" ON tires;
CREATE POLICY "Users can update tires"
  ON tires FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete tires" ON tires;
CREATE POLICY "Users can delete tires"
  ON tires FOR DELETE
  TO authenticated
  USING (true);

-- Tire Installations
DROP POLICY IF EXISTS "Users can insert tire installations" ON tire_installations;
CREATE POLICY "Users can insert tire installations"
  ON tire_installations FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update tire installations" ON tire_installations;
CREATE POLICY "Users can update tire installations"
  ON tire_installations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete tire installations" ON tire_installations;
CREATE POLICY "Users can delete tire installations"
  ON tire_installations FOR DELETE
  TO authenticated
  USING (true);

-- Invoices
DROP POLICY IF EXISTS "Users can insert invoices" ON invoices;
CREATE POLICY "Users can insert invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update invoices" ON invoices;
CREATE POLICY "Users can update invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete invoices" ON invoices;
CREATE POLICY "Users can delete invoices"
  ON invoices FOR DELETE
  TO authenticated
  USING (true);

-- Clients
DROP POLICY IF EXISTS "Users can insert clients" ON clients;
CREATE POLICY "Users can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update clients" ON clients;
CREATE POLICY "Users can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete clients" ON clients;
CREATE POLICY "Users can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (true);

-- Costs
DROP POLICY IF EXISTS "Users can insert costs" ON costs;
CREATE POLICY "Users can insert costs"
  ON costs FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update costs" ON costs;
CREATE POLICY "Users can update costs"
  ON costs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete costs" ON costs;
CREATE POLICY "Users can delete costs"
  ON costs FOR DELETE
  TO authenticated
  USING (true);

-- Geofences
DROP POLICY IF EXISTS "Users can insert geofences" ON geofences;
CREATE POLICY "Users can insert geofences"
  ON geofences FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update geofences" ON geofences;
CREATE POLICY "Users can update geofences"
  ON geofences FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete geofences" ON geofences;
CREATE POLICY "Users can delete geofences"
  ON geofences FOR DELETE
  TO authenticated
  USING (true);

-- Weighings
DROP POLICY IF EXISTS "Users can insert weighings" ON weighings;
CREATE POLICY "Users can insert weighings"
  ON weighings FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update weighings" ON weighings;
CREATE POLICY "Users can update weighings"
  ON weighings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Incidents
DROP POLICY IF EXISTS "Users can insert incidents" ON incidents;
CREATE POLICY "Users can insert incidents"
  ON incidents FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update incidents" ON incidents;
CREATE POLICY "Users can update incidents"
  ON incidents FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete incidents" ON incidents;
CREATE POLICY "Users can delete incidents"
  ON incidents FOR DELETE
  TO authenticated
  USING (true);
