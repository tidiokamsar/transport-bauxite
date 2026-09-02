/*
  # Ajouter des politiques RLS pour toutes les tables restantes

  1. Objectif
    - Permettre l'accès complet à tous les utilisateurs authentifiés
    - Couvrir toutes les tables importantes du système
  
  2. Méthode
    - Une politique simple par table: accès complet pour les utilisateurs authentifiés
*/

-- Tables RH
DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON attendance;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON attendance
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON leave_requests;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON leave_requests
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON payroll;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON payroll
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON payroll_items;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON payroll_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tables de stock et achats
DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON stock_items;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON stock_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON stock_movements;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON stock_movements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON stock_categories;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON stock_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON purchase_orders;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON purchase_orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON purchase_order_items;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON purchase_order_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON deliveries;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON deliveries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON warehouses;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON warehouses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tables financières
DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON expenses;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON expenses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON cost_categories;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON cost_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON vehicle_costs;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON vehicle_costs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON payments;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON invoice_items;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON invoice_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON customers;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON customers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON clients;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON clients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tables maintenance et pièces
DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON maintenance_parts;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON maintenance_parts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON parts_inventory;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON parts_inventory
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON maintenance_schedules;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON maintenance_schedules
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON spare_parts_catalog;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON spare_parts_catalog
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tables pneus
DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON tires;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON tires
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tables GPS et suivi
DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON vehicle_tracking;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON vehicle_tracking
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON tracking_events;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON tracking_events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON geofences;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON geofences
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tables carburant
DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON fuel_stocks;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON fuel_stocks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON fuel_types;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON fuel_types
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tables alertes et notifications
DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON alerts;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON alerts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON notifications;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON notifications
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tables documents et incidents
DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON documents;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON documents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON incidents;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON incidents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON weighings;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON weighings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON trailers;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON trailers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tables analytics et AI
DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON fleet_health_scores;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON fleet_health_scores
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON driver_behavior_scores;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON driver_behavior_scores
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON predictive_maintenance_models;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON predictive_maintenance_models
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON tco_analysis;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON tco_analysis
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tables système
DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON user_permissions;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON user_permissions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON user_activity_logs;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON user_activity_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$BEGIN
  DROP POLICY IF EXISTS "authenticated_full_access" ON system_parameters;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "authenticated_full_access" ON system_parameters
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
