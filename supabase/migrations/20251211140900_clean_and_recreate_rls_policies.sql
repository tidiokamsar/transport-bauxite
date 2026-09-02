/*
  # Nettoyer et recréer les politiques RLS

  1. Actions
    - Supprimer TOUTES les politiques existantes
    - Créer une seule politique simple par table
  
  2. Objectif
    - Permettre un accès complet à tous les utilisateurs authentifiés
    - Éliminer les conflits de politiques
*/

-- =============================================
-- VEHICLES
-- =============================================
DO $$
BEGIN
  DROP POLICY IF EXISTS "Full access for authenticated users" ON vehicles;
  DROP POLICY IF EXISTS "Authenticated users can view vehicles" ON vehicles;
  DROP POLICY IF EXISTS "Fleet managers and admins can manage vehicles" ON vehicles;
  DROP POLICY IF EXISTS "Admins have full access to vehicles" ON vehicles;
  DROP POLICY IF EXISTS "All authenticated users can read vehicles" ON vehicles;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "authenticated_full_access" ON vehicles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- DRIVERS
-- =============================================
DO $$
BEGIN
  DROP POLICY IF EXISTS "Full access for authenticated users" ON drivers;
  DROP POLICY IF EXISTS "Authenticated users can view drivers" ON drivers;
  DROP POLICY IF EXISTS "Managers can manage drivers" ON drivers;
  DROP POLICY IF EXISTS "Admins have full access to drivers" ON drivers;
  DROP POLICY IF EXISTS "All authenticated users can read drivers" ON drivers;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "authenticated_full_access" ON drivers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- TRIPS
-- =============================================
DO $$
BEGIN
  DROP POLICY IF EXISTS "Full access for authenticated users" ON trips;
  DROP POLICY IF EXISTS "Authenticated users can view trips" ON trips;
  DROP POLICY IF EXISTS "Managers can manage trips" ON trips;
  DROP POLICY IF EXISTS "Admins have full access to trips" ON trips;
  DROP POLICY IF EXISTS "All authenticated users can read trips" ON trips;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "authenticated_full_access" ON trips
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- FUEL_TRANSACTIONS
-- =============================================
DO $$
BEGIN
  DROP POLICY IF EXISTS "Full access for authenticated users" ON fuel_transactions;
  DROP POLICY IF EXISTS "Authenticated users can view fuel transactions" ON fuel_transactions;
  DROP POLICY IF EXISTS "Authorized users can create fuel transactions" ON fuel_transactions;
  DROP POLICY IF EXISTS "Admins have full access to fuel_transactions" ON fuel_transactions;
  DROP POLICY IF EXISTS "All authenticated users can read fuel_transactions" ON fuel_transactions;
  DROP POLICY IF EXISTS "auth_view_fuel_trans" ON fuel_transactions;
  DROP POLICY IF EXISTS "auth_insert_fuel_trans" ON fuel_transactions;
  DROP POLICY IF EXISTS "auth_update_fuel_trans" ON fuel_transactions;
  DROP POLICY IF EXISTS "auth_delete_fuel_trans" ON fuel_transactions;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "authenticated_full_access" ON fuel_transactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- MAINTENANCE_ORDERS
-- =============================================
DO $$
BEGIN
  DROP POLICY IF EXISTS "Full access for authenticated users" ON maintenance_orders;
  DROP POLICY IF EXISTS "Authenticated users can view maintenance orders" ON maintenance_orders;
  DROP POLICY IF EXISTS "Maintenance chiefs can manage orders" ON maintenance_orders;
  DROP POLICY IF EXISTS "Admins have full access to maintenance_orders" ON maintenance_orders;
  DROP POLICY IF EXISTS "All authenticated users can read maintenance_orders" ON maintenance_orders;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "authenticated_full_access" ON maintenance_orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- SITES
-- =============================================
DO $$
BEGIN
  DROP POLICY IF EXISTS "Full access for authenticated users" ON sites;
  DROP POLICY IF EXISTS "Authenticated users can view sites" ON sites;
  DROP POLICY IF EXISTS "Admins have full access to sites" ON sites;
  DROP POLICY IF EXISTS "All authenticated users can read sites" ON sites;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "authenticated_full_access" ON sites
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- SUPPLIERS
-- =============================================
DO $$
BEGIN
  DROP POLICY IF EXISTS "Full access for authenticated users" ON suppliers;
  DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON suppliers;
  DROP POLICY IF EXISTS "Admins have full access to suppliers" ON suppliers;
  DROP POLICY IF EXISTS "All authenticated users can read suppliers" ON suppliers;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "authenticated_full_access" ON suppliers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- STOCK_ITEMS
-- =============================================
DO $$
BEGIN
  DROP POLICY IF EXISTS "Full access for authenticated users" ON stock_items;
  DROP POLICY IF EXISTS "Authenticated users can view stock items" ON stock_items;
  DROP POLICY IF EXISTS "Admins have full access to stock_items" ON stock_items;
  DROP POLICY IF EXISTS "All authenticated users can read stock_items" ON stock_items;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "authenticated_full_access" ON stock_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- INVOICES
-- =============================================
DO $$
BEGIN
  DROP POLICY IF EXISTS "Full access for authenticated users" ON invoices;
  DROP POLICY IF EXISTS "Authenticated users can view invoices" ON invoices;
  DROP POLICY IF EXISTS "Admins have full access to invoices" ON invoices;
  DROP POLICY IF EXISTS "All authenticated users can read invoices" ON invoices;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "authenticated_full_access" ON invoices
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- EMPLOYEES
-- =============================================
DO $$
BEGIN
  DROP POLICY IF EXISTS "Full access for authenticated users" ON employees;
  DROP POLICY IF EXISTS "Authenticated users can view employees" ON employees;
  DROP POLICY IF EXISTS "Admins have full access to employees" ON employees;
  DROP POLICY IF EXISTS "All authenticated users can read employees" ON employees;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "authenticated_full_access" ON employees
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
