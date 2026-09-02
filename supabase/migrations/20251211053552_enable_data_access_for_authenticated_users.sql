/*
  # Activer l'accès aux données pour les utilisateurs authentifiés

  1. Modifications
    - Supprimer toutes les policies RLS restrictives existantes
    - Créer des policies SELECT permissives pour tous les utilisateurs authentifiés
    - Permettre la lecture de toutes les données nécessaires à l'application

  2. Sécurité
    - Les utilisateurs authentifiés peuvent lire toutes les données
    - Les modifications (INSERT, UPDATE, DELETE) restent contrôlées
*/

-- Supprimer les policies restrictives existantes et créer des policies permissives

-- vehicles
DROP POLICY IF EXISTS "Authenticated users can read all vehicles" ON vehicles;
CREATE POLICY "Enable read access for authenticated users"
  ON vehicles FOR SELECT
  TO authenticated
  USING (true);

-- drivers
DROP POLICY IF EXISTS "Authenticated users can read all drivers" ON drivers;
CREATE POLICY "Enable read access for authenticated users"
  ON drivers FOR SELECT
  TO authenticated
  USING (true);

-- trips
DROP POLICY IF EXISTS "Authenticated users can read all trips" ON trips;
CREATE POLICY "Enable read access for authenticated users"
  ON trips FOR SELECT
  TO authenticated
  USING (true);

-- fuel_transactions
DROP POLICY IF EXISTS "Authenticated users can read all fuel_transactions" ON fuel_transactions;
CREATE POLICY "Enable read access for authenticated users"
  ON fuel_transactions FOR SELECT
  TO authenticated
  USING (true);

-- fuel_stocks
DROP POLICY IF EXISTS "Authenticated users can read all fuel_stocks" ON fuel_stocks;
CREATE POLICY "Enable read access for authenticated users"
  ON fuel_stocks FOR SELECT
  TO authenticated
  USING (true);

-- fuel_stations
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON fuel_stations;
CREATE POLICY "Enable read access for authenticated users"
  ON fuel_stations FOR SELECT
  TO authenticated
  USING (true);

-- fuel_types
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON fuel_types;
CREATE POLICY "Enable read access for authenticated users"
  ON fuel_types FOR SELECT
  TO authenticated
  USING (true);

-- maintenance_orders
DROP POLICY IF EXISTS "Authenticated users can read all maintenance_orders" ON maintenance_orders;
CREATE POLICY "Enable read access for authenticated users"
  ON maintenance_orders FOR SELECT
  TO authenticated
  USING (true);

-- parts_inventory
DROP POLICY IF EXISTS "Authenticated users can read all parts_inventory" ON parts_inventory;
CREATE POLICY "Enable read access for authenticated users"
  ON parts_inventory FOR SELECT
  TO authenticated
  USING (true);

-- invoices
DROP POLICY IF EXISTS "Authenticated users can read all invoices" ON invoices;
CREATE POLICY "Enable read access for authenticated users"
  ON invoices FOR SELECT
  TO authenticated
  USING (true);

-- payments
DROP POLICY IF EXISTS "Authenticated users can read all payments" ON payments;
CREATE POLICY "Enable read access for authenticated users"
  ON payments FOR SELECT
  TO authenticated
  USING (true);

-- costs
DROP POLICY IF EXISTS "Authenticated users can read all costs" ON costs;
CREATE POLICY "Enable read access for authenticated users"
  ON costs FOR SELECT
  TO authenticated
  USING (true);

-- cost_categories
DROP POLICY IF EXISTS "Authenticated users can read all cost_categories" ON cost_categories;
CREATE POLICY "Enable read access for authenticated users"
  ON cost_categories FOR SELECT
  TO authenticated
  USING (true);

-- sites
DROP POLICY IF EXISTS "Authenticated users can read all sites" ON sites;
CREATE POLICY "Enable read access for authenticated users"
  ON sites FOR SELECT
  TO authenticated
  USING (true);

-- employees
DROP POLICY IF EXISTS "Authenticated users can read all employees" ON employees;
CREATE POLICY "Enable read access for authenticated users"
  ON employees FOR SELECT
  TO authenticated
  USING (true);

-- employee_attendance
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON employee_attendance;
CREATE POLICY "Enable read access for authenticated users"
  ON employee_attendance FOR SELECT
  TO authenticated
  USING (true);

-- payroll_records
DROP POLICY IF EXISTS "Authenticated users can read all payroll_records" ON payroll_records;
CREATE POLICY "Enable read access for authenticated users"
  ON payroll_records FOR SELECT
  TO authenticated
  USING (true);

-- stock_items
DROP POLICY IF EXISTS "Authenticated users can read all stock_items" ON stock_items;
CREATE POLICY "Enable read access for authenticated users"
  ON stock_items FOR SELECT
  TO authenticated
  USING (true);

-- stock_movements
DROP POLICY IF EXISTS "Authenticated users can read all stock_movements" ON stock_movements;
CREATE POLICY "Enable read access for authenticated users"
  ON stock_movements FOR SELECT
  TO authenticated
  USING (true);

-- stock_categories
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON stock_categories;
CREATE POLICY "Enable read access for authenticated users"
  ON stock_categories FOR SELECT
  TO authenticated
  USING (true);

-- purchase_orders
DROP POLICY IF EXISTS "Authenticated users can read all purchase_orders" ON purchase_orders;
CREATE POLICY "Enable read access for authenticated users"
  ON purchase_orders FOR SELECT
  TO authenticated
  USING (true);

-- suppliers
DROP POLICY IF EXISTS "Authenticated users can read all suppliers" ON suppliers;
CREATE POLICY "Enable read access for authenticated users"
  ON suppliers FOR SELECT
  TO authenticated
  USING (true);

-- customers
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON customers;
CREATE POLICY "Enable read access for authenticated users"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

-- clients
DROP POLICY IF EXISTS "Authenticated users can read all clients" ON clients;
CREATE POLICY "Enable read access for authenticated users"
  ON clients FOR SELECT
  TO authenticated
  USING (true);

-- vehicle_documents
DROP POLICY IF EXISTS "Authenticated users can read all vehicle_documents" ON vehicle_documents;
CREATE POLICY "Enable read access for authenticated users"
  ON vehicle_documents FOR SELECT
  TO authenticated
  USING (true);

-- incidents
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON incidents;
CREATE POLICY "Enable read access for authenticated users"
  ON incidents FOR SELECT
  TO authenticated
  USING (true);

-- profiles
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;
CREATE POLICY "Enable read access for authenticated users"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- gps_locations (si existe)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gps_locations') THEN
    DROP POLICY IF EXISTS "Enable read access for authenticated users" ON gps_locations;
    EXECUTE 'CREATE POLICY "Enable read access for authenticated users" ON gps_locations FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

-- geofence_zones
DROP POLICY IF EXISTS "Authenticated users can read all geofence_zones" ON geofence_zones;
CREATE POLICY "Enable read access for authenticated users"
  ON geofence_zones FOR SELECT
  TO authenticated
  USING (true);

-- tire_inventory
DROP POLICY IF EXISTS "Authenticated users can read all tire_inventory" ON tire_inventory;
CREATE POLICY "Enable read access for authenticated users"
  ON tire_inventory FOR SELECT
  TO authenticated
  USING (true);

-- tires
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON tires;
CREATE POLICY "Enable read access for authenticated users"
  ON tires FOR SELECT
  TO authenticated
  USING (true);

-- iot_devices
DROP POLICY IF EXISTS "Authenticated users can read all iot_devices" ON iot_devices;
CREATE POLICY "Enable read access for authenticated users"
  ON iot_devices FOR SELECT
  TO authenticated
  USING (true);

-- fuel_predictions
DROP POLICY IF EXISTS "Authenticated users can read all fuel_predictions" ON fuel_predictions;
CREATE POLICY "Enable read access for authenticated users"
  ON fuel_predictions FOR SELECT
  TO authenticated
  USING (true);

-- optimization_recommendations (si existe)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'optimization_recommendations') THEN
    DROP POLICY IF EXISTS "Enable read access for authenticated users" ON optimization_recommendations;
    EXECUTE 'CREATE POLICY "Enable read access for authenticated users" ON optimization_recommendations FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

-- predictive_maintenance_models
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON predictive_maintenance_models;
CREATE POLICY "Enable read access for authenticated users"
  ON predictive_maintenance_models FOR SELECT
  TO authenticated
  USING (true);

-- fleet_health_scores
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON fleet_health_scores;
CREATE POLICY "Enable read access for authenticated users"
  ON fleet_health_scores FOR SELECT
  TO authenticated
  USING (true);

-- driver_behavior_scores
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON driver_behavior_scores;
CREATE POLICY "Enable read access for authenticated users"
  ON driver_behavior_scores FOR SELECT
  TO authenticated
  USING (true);

-- tco_analysis
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON tco_analysis;
CREATE POLICY "Enable read access for authenticated users"
  ON tco_analysis FOR SELECT
  TO authenticated
  USING (true);

-- fuel_consumption
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON fuel_consumption;
CREATE POLICY "Enable read access for authenticated users"
  ON fuel_consumption FOR SELECT
  TO authenticated
  USING (true);

-- fuel_anomalies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON fuel_anomalies;
CREATE POLICY "Enable read access for authenticated users"
  ON fuel_anomalies FOR SELECT
  TO authenticated
  USING (true);

-- shift_plans
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON shift_plans;
CREATE POLICY "Enable read access for authenticated users"
  ON shift_plans FOR SELECT
  TO authenticated
  USING (true);

-- fleet_tasks
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON fleet_tasks;
CREATE POLICY "Enable read access for authenticated users"
  ON fleet_tasks FOR SELECT
  TO authenticated
  USING (true);

-- task_assignments
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON task_assignments;
CREATE POLICY "Enable read access for authenticated users"
  ON task_assignments FOR SELECT
  TO authenticated
  USING (true);

-- cycle_tracking
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON cycle_tracking;
CREATE POLICY "Enable read access for authenticated users"
  ON cycle_tracking FOR SELECT
  TO authenticated
  USING (true);

-- optimization_scenarios
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON optimization_scenarios;
CREATE POLICY "Enable read access for authenticated users"
  ON optimization_scenarios FOR SELECT
  TO authenticated
  USING (true);

-- performance_kpis
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON performance_kpis;
CREATE POLICY "Enable read access for authenticated users"
  ON performance_kpis FOR SELECT
  TO authenticated
  USING (true);

-- work_shifts
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON work_shifts;
CREATE POLICY "Enable read access for authenticated users"
  ON work_shifts FOR SELECT
  TO authenticated
  USING (true);

-- smart_notifications
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON smart_notifications;
CREATE POLICY "Enable read access for authenticated users"
  ON smart_notifications FOR SELECT
  TO authenticated
  USING (true);
