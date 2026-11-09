/*
  # Accès Complet pour les Administrateurs
  
  Cette migration donne un accès complet à tous les administrateurs sur toutes les tables.
  
  1. Fonction Helper
    - Crée la fonction `is_admin()` pour vérifier le rôle administrateur
  
  2. Politiques RLS
    - Supprime toutes les politiques restrictives existantes
    - Crée des politiques simples donnant accès complet aux admins
    - Couvre SELECT, INSERT, UPDATE et DELETE pour toutes les tables principales
  
  3. Sécurité
    - Les admins ont un accès total en lecture et écriture
    - Les politiques sont basées sur le rôle dans la table profiles
*/

-- Fonction pour vérifier si l'utilisateur actuel est administrateur
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supprimer toutes les politiques existantes sur toutes les tables
DO $$ 
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT schemaname, tablename, policyname 
    FROM pg_policies 
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
      pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- Créer des politiques d'accès complet pour les admins sur toutes les tables principales

-- Tables de gestion de flotte
CREATE POLICY "Admins full access" ON vehicles FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON drivers FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON trailers FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON trips FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Tables de carburant
CREATE POLICY "Admins full access" ON fuel_types FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON fuel_stocks FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON fuel_transactions FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Tables de maintenance
CREATE POLICY "Admins full access" ON maintenance_orders FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON maintenance_parts FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON maintenance_schedules FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON spare_parts_catalog FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON parts_inventory FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Tables de pneus
CREATE POLICY "Admins full access" ON tires FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Tables de suivi GPS
CREATE POLICY "Admins full access" ON vehicle_tracking FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON tracking_events FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON geofences FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Tables de sites et clients
CREATE POLICY "Admins full access" ON sites FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON clients FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON customers FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Tables de facturation
CREATE POLICY "Admins full access" ON invoices FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON invoice_items FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON payments FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Tables de coûts
CREATE POLICY "Admins full access" ON cost_categories FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON expenses FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON vehicle_costs FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Tables de stock
CREATE POLICY "Admins full access" ON stock_categories FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON stock_items FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON stock_movements FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON warehouses FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Tables d'achats
CREATE POLICY "Admins full access" ON suppliers FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON purchase_orders FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON purchase_order_items FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Tables RH
CREATE POLICY "Admins full access" ON employees FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON attendance FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON payroll FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON payroll_items FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON leave_requests FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Tables d'incidents et alertes
CREATE POLICY "Admins full access" ON incidents FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON alerts FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON notifications FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Tables de documents
CREATE POLICY "Admins full access" ON documents FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Tables d'analyse
CREATE POLICY "Admins full access" ON tco_analysis FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON fleet_health_scores FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON driver_behavior_scores FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON predictive_maintenance_models FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Tables système
CREATE POLICY "Admins full access" ON system_parameters FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON profiles FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON user_permissions FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON user_activity_logs FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Tables diverses
CREATE POLICY "Admins full access" ON deliveries FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins full access" ON weighings FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Politique spéciale pour profiles : permettre aux utilisateurs de voir leur propre profil
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
