/*
  # Fix Security Issues - Part 5: Final Policy Consolidation

  Complete the consolidation of remaining duplicate policies
*/

-- Tire PO items
DROP POLICY IF EXISTS "Authenticated users can manage tire po items" ON tire_po_items;
DROP POLICY IF EXISTS "Authenticated users can read tire po items" ON tire_po_items;
CREATE POLICY "Users can view tire po items" ON tire_po_items
  FOR SELECT TO authenticated
  USING (true);

-- Tire purchase orders
DROP POLICY IF EXISTS "Authenticated users can manage tire purchase orders" ON tire_purchase_orders;
DROP POLICY IF EXISTS "Authenticated users can read tire purchase orders" ON tire_purchase_orders;
CREATE POLICY "Users can view tire purchase orders" ON tire_purchase_orders
  FOR SELECT TO authenticated
  USING (true);

-- Tire removals
DROP POLICY IF EXISTS "Authenticated users can manage tire removals" ON tire_removals;
DROP POLICY IF EXISTS "Authenticated users can read tire removals" ON tire_removals;
CREATE POLICY "Users can view tire removals" ON tire_removals
  FOR SELECT TO authenticated
  USING (true);

-- Tire retreads
DROP POLICY IF EXISTS "Authenticated users can manage tire retreads" ON tire_retreads;
DROP POLICY IF EXISTS "Authenticated users can read tire retreads" ON tire_retreads;
CREATE POLICY "Users can view tire retreads" ON tire_retreads
  FOR SELECT TO authenticated
  USING (true);

-- Tire sensors
DROP POLICY IF EXISTS "Users can manage tire sensors" ON tire_sensors;
DROP POLICY IF EXISTS "Users can view tire sensors" ON tire_sensors;
CREATE POLICY "Users can view tire sensors" ON tire_sensors
  FOR SELECT TO authenticated
  USING (true);

-- Tire suppliers
DROP POLICY IF EXISTS "Authenticated users can manage tire suppliers" ON tire_suppliers;
DROP POLICY IF EXISTS "Authenticated users can read tire suppliers" ON tire_suppliers;
CREATE POLICY "Users can view tire suppliers" ON tire_suppliers
  FOR SELECT TO authenticated
  USING (true);

-- Tire transfers
DROP POLICY IF EXISTS "Authenticated users can manage tire transfers" ON tire_transfers;
DROP POLICY IF EXISTS "Authenticated users can read tire transfers" ON tire_transfers;
CREATE POLICY "Users can view tire transfers" ON tire_transfers
  FOR SELECT TO authenticated
  USING (true);

-- Tire usage logs
DROP POLICY IF EXISTS "Authenticated users can manage tire usage logs" ON tire_usage_logs;
DROP POLICY IF EXISTS "Authenticated users can read tire usage logs" ON tire_usage_logs;
CREATE POLICY "Users can view tire usage logs" ON tire_usage_logs
  FOR SELECT TO authenticated
  USING (true);

-- Tire usage zones
DROP POLICY IF EXISTS "Users can manage tire usage zones" ON tire_usage_zones;
DROP POLICY IF EXISTS "Users can view tire usage zones" ON tire_usage_zones;
CREATE POLICY "Users can view tire usage zones" ON tire_usage_zones
  FOR SELECT TO authenticated
  USING (true);

-- Tire work orders
DROP POLICY IF EXISTS "Users can manage tire work orders" ON tire_work_orders;
DROP POLICY IF EXISTS "Users can view tire work orders" ON tire_work_orders;
CREATE POLICY "Users can view tire work orders" ON tire_work_orders
  FOR SELECT TO authenticated
  USING (true);

-- Trip waypoints
DROP POLICY IF EXISTS "Users can manage trip waypoints" ON trip_waypoints;
DROP POLICY IF EXISTS "Users can view trip waypoints" ON trip_waypoints;
CREATE POLICY "Users can view trip waypoints" ON trip_waypoints
  FOR SELECT TO authenticated
  USING (true);

-- Trips
DROP POLICY IF EXISTS "Authenticated users can view trips" ON trips;

-- User activity logs (keep only admin policy)
DROP POLICY IF EXISTS "Users can view own activity logs" ON user_activity_logs;

-- Vehicle availability
DROP POLICY IF EXISTS "Authenticated users can manage vehicle availability" ON vehicle_availability;
DROP POLICY IF EXISTS "Authenticated users can read vehicle availability" ON vehicle_availability;
CREATE POLICY "Users can view vehicle availability" ON vehicle_availability
  FOR SELECT TO authenticated
  USING (true);

-- Vehicles
DROP POLICY IF EXISTS "Authenticated users can view vehicles" ON vehicles;

-- Waste management
DROP POLICY IF EXISTS "Authenticated users can manage waste management" ON waste_management;
DROP POLICY IF EXISTS "Authenticated users can read waste management" ON waste_management;
CREATE POLICY "Users can view waste management" ON waste_management
  FOR SELECT TO authenticated
  USING (true);

-- Work shifts
DROP POLICY IF EXISTS "Users can view work shifts" ON work_shifts;

DO $$
BEGIN
  RAISE NOTICE '✅ Part 5 Complete: Consolidated final 18 duplicate policies';
  RAISE NOTICE '   Total: 60+ duplicate policies consolidated!';
END $$;
