/*
  # Correction complète des accès administrateur
  
  1. Fonction helper
    - Vérifie si l'utilisateur est admin
    
  2. Politiques
    - Les administrateurs ont un accès complet à toutes les données
    - Les autres utilisateurs authentifiés peuvent voir les données
*/

-- Fonction helper pour vérifier si l'utilisateur est admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- PROFILES
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to all profiles" ON profiles;
CREATE POLICY "Admins have full access to all profiles"
  ON profiles FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read profiles" ON profiles;
CREATE POLICY "All authenticated users can read profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- VEHICLES
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to vehicles" ON vehicles;
CREATE POLICY "Admins have full access to vehicles"
  ON vehicles FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read vehicles" ON vehicles;
CREATE POLICY "All authenticated users can read vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- DRIVERS
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to drivers" ON drivers;
CREATE POLICY "Admins have full access to drivers"
  ON drivers FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read drivers" ON drivers;
CREATE POLICY "All authenticated users can read drivers"
  ON drivers FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- TRIPS
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to trips" ON trips;
CREATE POLICY "Admins have full access to trips"
  ON trips FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read trips" ON trips;
CREATE POLICY "All authenticated users can read trips"
  ON trips FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- FUEL_TRANSACTIONS
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to fuel_transactions" ON fuel_transactions;
CREATE POLICY "Admins have full access to fuel_transactions"
  ON fuel_transactions FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read fuel_transactions" ON fuel_transactions;
CREATE POLICY "All authenticated users can read fuel_transactions"
  ON fuel_transactions FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- FUEL_STOCKS
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to fuel_stocks" ON fuel_stocks;
CREATE POLICY "Admins have full access to fuel_stocks"
  ON fuel_stocks FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read fuel_stocks" ON fuel_stocks;
CREATE POLICY "All authenticated users can read fuel_stocks"
  ON fuel_stocks FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- MAINTENANCE_ORDERS
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to maintenance_orders" ON maintenance_orders;
CREATE POLICY "Admins have full access to maintenance_orders"
  ON maintenance_orders FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read maintenance_orders" ON maintenance_orders;
CREATE POLICY "All authenticated users can read maintenance_orders"
  ON maintenance_orders FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- MAINTENANCE_SCHEDULES
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to maintenance_schedules" ON maintenance_schedules;
CREATE POLICY "Admins have full access to maintenance_schedules"
  ON maintenance_schedules FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read maintenance_schedules" ON maintenance_schedules;
CREATE POLICY "All authenticated users can read maintenance_schedules"
  ON maintenance_schedules FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- INVOICES
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to invoices" ON invoices;
CREATE POLICY "Admins have full access to invoices"
  ON invoices FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read invoices" ON invoices;
CREATE POLICY "All authenticated users can read invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- CLIENTS
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to clients" ON clients;
CREATE POLICY "Admins have full access to clients"
  ON clients FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read clients" ON clients;
CREATE POLICY "All authenticated users can read clients"
  ON clients FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- SITES
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to sites" ON sites;
CREATE POLICY "Admins have full access to sites"
  ON sites FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read sites" ON sites;
CREATE POLICY "All authenticated users can read sites"
  ON sites FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- SUPPLIERS
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to suppliers" ON suppliers;
CREATE POLICY "Admins have full access to suppliers"
  ON suppliers FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read suppliers" ON suppliers;
CREATE POLICY "All authenticated users can read suppliers"
  ON suppliers FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- STOCK_ITEMS
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to stock_items" ON stock_items;
CREATE POLICY "Admins have full access to stock_items"
  ON stock_items FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read stock_items" ON stock_items;
CREATE POLICY "All authenticated users can read stock_items"
  ON stock_items FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- EXPENSES
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to expenses" ON expenses;
CREATE POLICY "Admins have full access to expenses"
  ON expenses FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read expenses" ON expenses;
CREATE POLICY "All authenticated users can read expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- PURCHASE_ORDERS
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to purchase_orders" ON purchase_orders;
CREATE POLICY "Admins have full access to purchase_orders"
  ON purchase_orders FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read purchase_orders" ON purchase_orders;
CREATE POLICY "All authenticated users can read purchase_orders"
  ON purchase_orders FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- EMPLOYEES
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to employees" ON employees;
CREATE POLICY "Admins have full access to employees"
  ON employees FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read employees" ON employees;
CREATE POLICY "All authenticated users can read employees"
  ON employees FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- ATTENDANCE
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to attendance" ON attendance;
CREATE POLICY "Admins have full access to attendance"
  ON attendance FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read attendance" ON attendance;
CREATE POLICY "All authenticated users can read attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- PAYROLL
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to payroll" ON payroll;
CREATE POLICY "Admins have full access to payroll"
  ON payroll FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read payroll" ON payroll;
CREATE POLICY "All authenticated users can read payroll"
  ON payroll FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- TIRES
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to tires" ON tires;
CREATE POLICY "Admins have full access to tires"
  ON tires FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read tires" ON tires;
CREATE POLICY "All authenticated users can read tires"
  ON tires FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- VEHICLE_TRACKING
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to vehicle_tracking" ON vehicle_tracking;
CREATE POLICY "Admins have full access to vehicle_tracking"
  ON vehicle_tracking FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read vehicle_tracking" ON vehicle_tracking;
CREATE POLICY "All authenticated users can read vehicle_tracking"
  ON vehicle_tracking FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- GEOFENCES
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to geofences" ON geofences;
CREATE POLICY "Admins have full access to geofences"
  ON geofences FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read geofences" ON geofences;
CREATE POLICY "All authenticated users can read geofences"
  ON geofences FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- INCIDENTS
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to incidents" ON incidents;
CREATE POLICY "Admins have full access to incidents"
  ON incidents FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read incidents" ON incidents;
CREATE POLICY "All authenticated users can read incidents"
  ON incidents FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- ALERTS
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to alerts" ON alerts;
CREATE POLICY "Admins have full access to alerts"
  ON alerts FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read alerts" ON alerts;
CREATE POLICY "All authenticated users can read alerts"
  ON alerts FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- NOTIFICATIONS
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to notifications" ON notifications;
CREATE POLICY "Admins have full access to notifications"
  ON notifications FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Users can read their own notifications" ON notifications;
CREATE POLICY "Users can read their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- ============================================
-- WEIGHINGS
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to weighings" ON weighings;
CREATE POLICY "Admins have full access to weighings"
  ON weighings FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read weighings" ON weighings;
CREATE POLICY "All authenticated users can read weighings"
  ON weighings FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- VEHICLE_COSTS
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to vehicle_costs" ON vehicle_costs;
CREATE POLICY "Admins have full access to vehicle_costs"
  ON vehicle_costs FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read vehicle_costs" ON vehicle_costs;
CREATE POLICY "All authenticated users can read vehicle_costs"
  ON vehicle_costs FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- DOCUMENTS
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to documents" ON documents;
CREATE POLICY "Admins have full access to documents"
  ON documents FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read documents" ON documents;
CREATE POLICY "All authenticated users can read documents"
  ON documents FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- TRACKING_EVENTS
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to tracking_events" ON tracking_events;
CREATE POLICY "Admins have full access to tracking_events"
  ON tracking_events FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read tracking_events" ON tracking_events;
CREATE POLICY "All authenticated users can read tracking_events"
  ON tracking_events FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- STOCK_MOVEMENTS
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to stock_movements" ON stock_movements;
CREATE POLICY "Admins have full access to stock_movements"
  ON stock_movements FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read stock_movements" ON stock_movements;
CREATE POLICY "All authenticated users can read stock_movements"
  ON stock_movements FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- WAREHOUSES
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to warehouses" ON warehouses;
CREATE POLICY "Admins have full access to warehouses"
  ON warehouses FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read warehouses" ON warehouses;
CREATE POLICY "All authenticated users can read warehouses"
  ON warehouses FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- CUSTOMERS
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to customers" ON customers;
CREATE POLICY "Admins have full access to customers"
  ON customers FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read customers" ON customers;
CREATE POLICY "All authenticated users can read customers"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- PAYMENTS
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to payments" ON payments;
CREATE POLICY "Admins have full access to payments"
  ON payments FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read payments" ON payments;
CREATE POLICY "All authenticated users can read payments"
  ON payments FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- FLEET_HEALTH_SCORES
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to fleet_health_scores" ON fleet_health_scores;
CREATE POLICY "Admins have full access to fleet_health_scores"
  ON fleet_health_scores FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read fleet_health_scores" ON fleet_health_scores;
CREATE POLICY "All authenticated users can read fleet_health_scores"
  ON fleet_health_scores FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- PREDICTIVE_MAINTENANCE_MODELS
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to predictive_maintenance_models" ON predictive_maintenance_models;
CREATE POLICY "Admins have full access to predictive_maintenance_models"
  ON predictive_maintenance_models FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read predictive_maintenance_models" ON predictive_maintenance_models;
CREATE POLICY "All authenticated users can read predictive_maintenance_models"
  ON predictive_maintenance_models FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- TCO_ANALYSIS
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to tco_analysis" ON tco_analysis;
CREATE POLICY "Admins have full access to tco_analysis"
  ON tco_analysis FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read tco_analysis" ON tco_analysis;
CREATE POLICY "All authenticated users can read tco_analysis"
  ON tco_analysis FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- DRIVER_BEHAVIOR_SCORES
-- ============================================
DROP POLICY IF EXISTS "Admins have full access to driver_behavior_scores" ON driver_behavior_scores;
CREATE POLICY "Admins have full access to driver_behavior_scores"
  ON driver_behavior_scores FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "All authenticated users can read driver_behavior_scores" ON driver_behavior_scores;
CREATE POLICY "All authenticated users can read driver_behavior_scores"
  ON driver_behavior_scores FOR SELECT
  TO authenticated
  USING (true);
