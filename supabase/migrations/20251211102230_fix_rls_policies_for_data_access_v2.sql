/*
  # Correction des politiques RLS pour l'acces aux donnees

  1. Modifications
    - Ajouter des politiques SELECT permissives pour tous les utilisateurs authentifies
    - Permettre la lecture de toutes les donnees critiques
    - Maintenir la securite pour les operations d'ecriture
*/

-- Purchase Orders - Permettre la lecture
DROP POLICY IF EXISTS "Users can read all purchase orders" ON purchase_orders;
CREATE POLICY "Users can read all purchase orders"
  ON purchase_orders FOR SELECT
  TO authenticated
  USING (true);

-- Suppliers - Permettre la lecture
DROP POLICY IF EXISTS "Users can read all suppliers" ON suppliers;
CREATE POLICY "Users can read all suppliers"
  ON suppliers FOR SELECT
  TO authenticated
  USING (true);

-- Trips - Permettre la lecture
DROP POLICY IF EXISTS "Users can read all trips" ON trips;
CREATE POLICY "Users can read all trips"
  ON trips FOR SELECT
  TO authenticated
  USING (true);

-- Fuel Stocks - Permettre la lecture
DROP POLICY IF EXISTS "Users can read all fuel stocks" ON fuel_stocks;
CREATE POLICY "Users can read all fuel stocks"
  ON fuel_stocks FOR SELECT
  TO authenticated
  USING (true);

-- Maintenance Orders - Permettre la lecture
DROP POLICY IF EXISTS "Users can read all maintenance orders" ON maintenance_orders;
CREATE POLICY "Users can read all maintenance orders"
  ON maintenance_orders FOR SELECT
  TO authenticated
  USING (true);

-- Stock Items - Permettre la lecture
DROP POLICY IF EXISTS "Users can read all stock items" ON stock_items;
CREATE POLICY "Users can read all stock items"
  ON stock_items FOR SELECT
  TO authenticated
  USING (true);

-- Vehicles - Permettre la lecture
DROP POLICY IF EXISTS "Users can read all vehicles" ON vehicles;
CREATE POLICY "Users can read all vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (true);

-- Drivers - Permettre la lecture
DROP POLICY IF EXISTS "Users can read all drivers" ON drivers;
CREATE POLICY "Users can read all drivers"
  ON drivers FOR SELECT
  TO authenticated
  USING (true);

-- Fuel Transactions - Permettre la lecture
DROP POLICY IF EXISTS "Users can read all fuel transactions" ON fuel_transactions;
CREATE POLICY "Users can read all fuel transactions"
  ON fuel_transactions FOR SELECT
  TO authenticated
  USING (true);

-- Sites - Permettre la lecture
DROP POLICY IF EXISTS "Users can read all sites" ON sites;
CREATE POLICY "Users can read all sites"
  ON sites FOR SELECT
  TO authenticated
  USING (true);

-- Employees - Permettre la lecture
DROP POLICY IF EXISTS "Users can read all employees" ON employees;
CREATE POLICY "Users can read all employees"
  ON employees FOR SELECT
  TO authenticated
  USING (true);

-- Attendance - Permettre la lecture
DROP POLICY IF EXISTS "Users can read all attendance" ON attendance;
CREATE POLICY "Users can read all attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (true);

-- Payroll Records - Permettre la lecture
DROP POLICY IF EXISTS "Users can read all payroll records" ON payroll_records;
CREATE POLICY "Users can read all payroll records"
  ON payroll_records FOR SELECT
  TO authenticated
  USING (true);

-- Tires - Permettre la lecture
DROP POLICY IF EXISTS "Users can read all tires" ON tires;
CREATE POLICY "Users can read all tires"
  ON tires FOR SELECT
  TO authenticated
  USING (true);

-- Tire Installations - Permettre la lecture
DROP POLICY IF EXISTS "Users can read all tire installations" ON tire_installations;
CREATE POLICY "Users can read all tire installations"
  ON tire_installations FOR SELECT
  TO authenticated
  USING (true);

-- Geofences - Permettre la lecture
DROP POLICY IF EXISTS "Users can read all geofences" ON geofences;
CREATE POLICY "Users can read all geofences"
  ON geofences FOR SELECT
  TO authenticated
  USING (true);

-- Tracking Events - Permettre la lecture
DROP POLICY IF EXISTS "Users can read all tracking events" ON tracking_events;
CREATE POLICY "Users can read all tracking events"
  ON tracking_events FOR SELECT
  TO authenticated
  USING (true);

-- Vehicle Tracking - Permettre la lecture
DROP POLICY IF EXISTS "Users can read all vehicle tracking" ON vehicle_tracking;
CREATE POLICY "Users can read all vehicle tracking"
  ON vehicle_tracking FOR SELECT
  TO authenticated
  USING (true);

-- Weighings - Permettre la lecture
DROP POLICY IF EXISTS "Users can read all weighings" ON weighings;
CREATE POLICY "Users can read all weighings"
  ON weighings FOR SELECT
  TO authenticated
  USING (true);

-- Incidents - Permettre la lecture
DROP POLICY IF EXISTS "Users can read all incidents" ON incidents;
CREATE POLICY "Users can read all incidents"
  ON incidents FOR SELECT
  TO authenticated
  USING (true);

-- Invoices - Permettre la lecture
DROP POLICY IF EXISTS "Users can read all invoices" ON invoices;
CREATE POLICY "Users can read all invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (true);

-- Clients - Permettre la lecture
DROP POLICY IF EXISTS "Users can read all clients" ON clients;
CREATE POLICY "Users can read all clients"
  ON clients FOR SELECT
  TO authenticated
  USING (true);

-- Costs - Permettre la lecture
DROP POLICY IF EXISTS "Users can read all costs" ON costs;
CREATE POLICY "Users can read all costs"
  ON costs FOR SELECT
  TO authenticated
  USING (true);
