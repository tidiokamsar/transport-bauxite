/*
  # Simplification des politiques RLS
  
  1. Modifications
    - Tous les utilisateurs authentifiés ont accès en lecture à toutes les données
    - Tous les utilisateurs authentifiés peuvent créer/modifier/supprimer
    - Cela permettra aux administrateurs d'avoir un accès complet
*/

-- Fonction simplifiée
CREATE OR REPLACE FUNCTION is_authenticated()
RETURNS boolean AS $$
BEGIN
  RETURN auth.uid() IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- MACRO POUR TOUTES LES TABLES
DO $$
DECLARE
  table_name text;
  tables text[] := ARRAY[
    'profiles', 'vehicles', 'drivers', 'trips', 'fuel_transactions', 'fuel_stocks',
    'maintenance_orders', 'maintenance_schedules', 'invoices', 'clients', 'sites',
    'suppliers', 'stock_items', 'expenses', 'purchase_orders', 'employees',
    'attendance', 'payroll', 'tires', 'vehicle_tracking', 'geofences', 'incidents',
    'alerts', 'notifications', 'weighings', 'vehicle_costs', 'documents',
    'tracking_events', 'stock_movements', 'warehouses', 'customers', 'payments',
    'fleet_health_scores', 'predictive_maintenance_models', 'tco_analysis',
    'driver_behavior_scores', 'cost_categories', 'fuel_types', 'stock_categories',
    'trailers', 'parts_inventory', 'maintenance_parts', 'invoice_items',
    'purchase_order_items', 'payroll_items', 'leave_requests', 'deliveries',
    'spare_parts_catalog', 'system_parameters', 'user_permissions', 'user_activity_logs'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables
  LOOP
    -- Supprimer toutes les anciennes politiques
    EXECUTE format('DROP POLICY IF EXISTS "Full access for authenticated users" ON %I', table_name);
    
    -- Créer une seule politique pour tout
    EXECUTE format('
      CREATE POLICY "Full access for authenticated users"
        ON %I FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true)
    ', table_name);
  END LOOP;
END $$;
