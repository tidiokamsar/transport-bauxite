/*
  # Security and Performance Optimizations
  
  1. Optimizes RLS policies
  2. Removes duplicate indexes
  3. Secures function search_path
*/

-- 1. Optimize critical RLS policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated
USING (id = (SELECT auth.uid()));

-- 2. Remove only truly duplicate indexes (not constraints)
DROP INDEX IF EXISTS idx_fuel_vehicle;
DROP INDEX IF EXISTS idx_maintenance_status;

-- 3. Remove some unused indexes (carefully selected)
DROP INDEX IF EXISTS idx_vehicle_availability_status;
DROP INDEX IF EXISTS idx_driver_availability_status;
DROP INDEX IF EXISTS idx_dispatch_assignments_status;
DROP INDEX IF EXISTS idx_performance_scores_entity;
DROP INDEX IF EXISTS idx_fuel_stocks_site;
DROP INDEX IF EXISTS idx_spare_parts_catalog_number;

-- 4. Secure all function search_path
ALTER FUNCTION calculate_mission_bonuses SET search_path = '';
ALTER FUNCTION calculate_employee_payroll SET search_path = '';
ALTER FUNCTION generate_payroll_record SET search_path = '';
ALTER FUNCTION calculate_trip_carbon_emissions SET search_path = '';
ALTER FUNCTION update_sustainability_kpis SET search_path = '';
ALTER FUNCTION calculate_fatigue_score SET search_path = '';
ALTER FUNCTION check_fatigue_violations SET search_path = '';
ALTER FUNCTION check_alert_conditions SET search_path = '';
ALTER FUNCTION create_alert_notification SET search_path = '';
ALTER FUNCTION is_point_in_geofence SET search_path = '';
ALTER FUNCTION detect_geofence_violations SET search_path = '';
ALTER FUNCTION check_vehicle_in_authorized_zone SET search_path = '';
ALTER FUNCTION detect_vehicles_out_of_zone SET search_path = '';
ALTER FUNCTION generate_random_position_in_zone SET search_path = '';
ALTER FUNCTION calculate_trip_progress SET search_path = '';
ALTER FUNCTION log_user_activity SET search_path = '';
ALTER FUNCTION update_document_status SET search_path = '';
ALTER FUNCTION update_stock_item_timestamp SET search_path = '';
