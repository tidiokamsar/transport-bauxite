/*
  # Fix Security Issues - Part 4: Consolidate More Policies

  Continue removing duplicate SELECT policies
*/

-- Geofence zone assignments
DROP POLICY IF EXISTS "Superviseurs peuvent gérer les assignations" ON geofence_zone_assignments;
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent voir les assignations" ON geofence_zone_assignments;
CREATE POLICY "Users can view geofence assignments" ON geofence_zone_assignments
  FOR SELECT TO authenticated
  USING (true);

-- Geofence zones
DROP POLICY IF EXISTS "Superviseurs peuvent gérer les zones" ON geofence_zones;
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent voir les zones" ON geofence_zones;
CREATE POLICY "Users can view geofence zones" ON geofence_zones
  FOR SELECT TO authenticated
  USING (true);

-- Geofences
DROP POLICY IF EXISTS "Users can manage geofences" ON geofences;
DROP POLICY IF EXISTS "Users can view geofences" ON geofences;
CREATE POLICY "Users can view geofences" ON geofences
  FOR SELECT TO authenticated
  USING (true);

-- Invoices
DROP POLICY IF EXISTS "Authenticated users can view invoices" ON invoices;

-- Maintenance orders
DROP POLICY IF EXISTS "Authenticated users can view maintenance orders" ON maintenance_orders;

-- Mission requirements
DROP POLICY IF EXISTS "Authenticated users can manage mission requirements" ON mission_requirements;
DROP POLICY IF EXISTS "Authenticated users can read mission requirements" ON mission_requirements;
CREATE POLICY "Users can view mission requirements" ON mission_requirements
  FOR SELECT TO authenticated
  USING (true);

-- Optimization history
DROP POLICY IF EXISTS "Authenticated users can manage optimization history" ON optimization_history;
DROP POLICY IF EXISTS "Authenticated users can read optimization history" ON optimization_history;
CREATE POLICY "Users can view optimization history" ON optimization_history
  FOR SELECT TO authenticated
  USING (true);

-- Parts inventory
DROP POLICY IF EXISTS "Authenticated users can view parts" ON parts_inventory;

-- Performance scores
DROP POLICY IF EXISTS "Authenticated users can manage performance scores" ON performance_scores;
DROP POLICY IF EXISTS "Authenticated users can read performance scores" ON performance_scores;
CREATE POLICY "Users can view performance scores" ON performance_scores
  FOR SELECT TO authenticated
  USING (true);

-- Rest periods
DROP POLICY IF EXISTS "Authenticated users can manage rest periods" ON rest_periods;
DROP POLICY IF EXISTS "Authenticated users can read rest periods" ON rest_periods;
CREATE POLICY "Users can view rest periods" ON rest_periods
  FOR SELECT TO authenticated
  USING (true);

-- Sites
DROP POLICY IF EXISTS "Authenticated users can view sites" ON sites;

-- Sustainability KPIs
DROP POLICY IF EXISTS "Authenticated users can manage sustainability kpis" ON sustainability_kpis;
DROP POLICY IF EXISTS "Authenticated users can read sustainability kpis" ON sustainability_kpis;
CREATE POLICY "Users can view sustainability kpis" ON sustainability_kpis
  FOR SELECT TO authenticated
  USING (true);

-- Tire alerts
DROP POLICY IF EXISTS "Authenticated users can manage tire alerts" ON tire_alerts;
DROP POLICY IF EXISTS "Authenticated users can read tire alerts" ON tire_alerts;
CREATE POLICY "Users can view tire alerts" ON tire_alerts
  FOR SELECT TO authenticated
  USING (true);

-- Tire brands
DROP POLICY IF EXISTS "Users can manage tire brands" ON tire_brands;
DROP POLICY IF EXISTS "Users can view tire brands" ON tire_brands;
CREATE POLICY "Users can view tire brands" ON tire_brands
  FOR SELECT TO authenticated
  USING (true);

-- Tire cost analysis
DROP POLICY IF EXISTS "Users can manage tire cost analysis" ON tire_cost_analysis;
DROP POLICY IF EXISTS "Users can view tire cost analysis" ON tire_cost_analysis;
CREATE POLICY "Users can view tire cost analysis" ON tire_cost_analysis
  FOR SELECT TO authenticated
  USING (true);

-- Tire inspections
DROP POLICY IF EXISTS "Users can manage tire inspections" ON tire_inspections;
DROP POLICY IF EXISTS "Users can view tire inspections" ON tire_inspections;
CREATE POLICY "Users can view tire inspections" ON tire_inspections
  FOR SELECT TO authenticated
  USING (true);

-- Tire installations
DROP POLICY IF EXISTS "Authenticated users can manage tire installations" ON tire_installations;
DROP POLICY IF EXISTS "Authenticated users can read tire installations" ON tire_installations;
CREATE POLICY "Users can view tire installations" ON tire_installations
  FOR SELECT TO authenticated
  USING (true);

-- Tire inventory
DROP POLICY IF EXISTS "Authenticated users can manage tire inventory" ON tire_inventory;
DROP POLICY IF EXISTS "Authenticated users can read tire inventory" ON tire_inventory;
CREATE POLICY "Users can view tire inventory" ON tire_inventory
  FOR SELECT TO authenticated
  USING (true);

-- Tire maintenance events
DROP POLICY IF EXISTS "Authenticated users can manage tire maintenance events" ON tire_maintenance_events;
DROP POLICY IF EXISTS "Authenticated users can read tire maintenance events" ON tire_maintenance_events;
CREATE POLICY "Users can view tire maintenance events" ON tire_maintenance_events
  FOR SELECT TO authenticated
  USING (true);

-- Tire models
DROP POLICY IF EXISTS "Authenticated users can manage tire models" ON tire_models;
DROP POLICY IF EXISTS "Authenticated users can read tire models" ON tire_models;
CREATE POLICY "Users can view tire models" ON tire_models
  FOR SELECT TO authenticated
  USING (true);

DO $$
BEGIN
  RAISE NOTICE '✅ Part 4 Complete: Consolidated 20 more duplicate policies';
END $$;
