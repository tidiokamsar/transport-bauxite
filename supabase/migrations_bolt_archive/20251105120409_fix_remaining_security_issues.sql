/*
  # Fix Remaining Security Issues - Complete
  
  1. Add all remaining foreign key indexes (65 remaining)
  2. Optimize all remaining RLS policies (10 remaining)
  3. Secure remaining functions (5 with mutable search_path)
  4. Remove duplicate index (1 remaining)
*/

-- ========================================
-- PART 1: Add all remaining FK indexes
-- ========================================

-- Costs, dispatch, eco
CREATE INDEX IF NOT EXISTS idx_costs_created ON costs(created_by);
CREATE INDEX IF NOT EXISTS idx_dispatch_assign ON dispatch_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_dispatch_sim_cr ON dispatch_simulations(created_by);
CREATE INDEX IF NOT EXISTS idx_eco_trip ON eco_driving_scores(trip_id);

-- Employee and environmental
CREATE INDEX IF NOT EXISTS idx_emp_att_appr ON employee_attendance(approved_by);
CREATE INDEX IF NOT EXISTS idx_env_inc_drv ON environmental_incidents(driver_id);
CREATE INDEX IF NOT EXISTS idx_env_inc_rep ON environmental_incidents(reported_by);
CREATE INDEX IF NOT EXISTS idx_env_inc_veh ON environmental_incidents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_esg_gen ON esg_reports(generated_by);

-- Fatigue and fuel anomalies
CREATE INDEX IF NOT EXISTS idx_fatigue_ack ON fatigue_alerts(acknowledged_by);
CREATE INDEX IF NOT EXISTS idx_fatigue_sess ON fatigue_alerts(work_session_id);
CREATE INDEX IF NOT EXISTS idx_fuel_anom_cons ON fuel_anomalies(consumption_id);
CREATE INDEX IF NOT EXISTS idx_fuel_anom_drv ON fuel_anomalies(driver_id);
CREATE INDEX IF NOT EXISTS idx_fuel_anom_trans ON fuel_anomalies(transaction_id);
CREATE INDEX IF NOT EXISTS idx_fuel_anom_trip ON fuel_anomalies(trip_id);
CREATE INDEX IF NOT EXISTS idx_fuel_trans_cr ON fuel_transactions(created_by);

-- Geofence
CREATE INDEX IF NOT EXISTS idx_geof_esc ON geofence_alerts(escalated_to);
CREATE INDEX IF NOT EXISTS idx_geof_read ON geofence_alerts(read_by);
CREATE INDEX IF NOT EXISTS idx_geof_viol_ack ON geofence_violations(acknowledged_by);
CREATE INDEX IF NOT EXISTS idx_geof_zone_cr ON geofence_zones(created_by);

-- Invoices and IoT
CREATE INDEX IF NOT EXISTS idx_inv_created ON invoices(created_by);
CREATE INDEX IF NOT EXISTS idx_iot_tire_dev ON iot_tire_readings(device_id);
CREATE INDEX IF NOT EXISTS idx_iot_weight_dev ON iot_weight_readings(device_id);

-- Maintenance
CREATE INDEX IF NOT EXISTS idx_maint_req ON maintenance_orders(requested_by);
CREATE INDEX IF NOT EXISTS idx_maint_site ON maintenance_orders(site_id);
CREATE INDEX IF NOT EXISTS idx_mission_req ON mission_requirements(trip_id);

-- Payments and payroll
CREATE INDEX IF NOT EXISTS idx_pay_recv ON payments(received_by);
CREATE INDEX IF NOT EXISTS idx_payroll_appr ON payroll_records(approved_by);

-- Profiles
CREATE INDEX IF NOT EXISTS idx_prof_created ON profiles(created_by);
CREATE INDEX IF NOT EXISTS idx_prof_site ON profiles(site_id);
CREATE INDEX IF NOT EXISTS idx_prof_updated ON profiles(updated_by);

-- Purchases and rest
CREATE INDEX IF NOT EXISTS idx_po_created ON purchase_orders(created_by);
CREATE INDEX IF NOT EXISTS idx_rest_sess ON rest_periods(work_session_id);

-- Settings and stock
CREATE INDEX IF NOT EXISTS idx_settings_upd ON settings(updated_by);
CREATE INDEX IF NOT EXISTS idx_stock_perf ON stock_movements(performed_by);

-- Tire alerts
CREATE INDEX IF NOT EXISTS idx_tire_alert_ack ON tire_alerts(acknowledged_by);
CREATE INDEX IF NOT EXISTS idx_tire_alert_tire ON tire_alerts(tire_id);
CREATE INDEX IF NOT EXISTS idx_tire_alert_mod ON tire_alerts(tire_model_id);

-- Tire operations
CREATE INDEX IF NOT EXISTS idx_tire_inst_op ON tire_installations(operator_id);
CREATE INDEX IF NOT EXISTS idx_tire_inst_site ON tire_installations(site_id);
CREATE INDEX IF NOT EXISTS idx_tire_maint_inst ON tire_maintenance_events(installation_id);
CREATE INDEX IF NOT EXISTS idx_tire_maint_tech ON tire_maintenance_events(technician_id);

-- Tire PO
CREATE INDEX IF NOT EXISTS idx_tire_po_item_po ON tire_po_items(po_id);
CREATE INDEX IF NOT EXISTS idx_tire_po_item_mod ON tire_po_items(tire_model_id);
CREATE INDEX IF NOT EXISTS idx_tire_po_cr ON tire_purchase_orders(created_by);
CREATE INDEX IF NOT EXISTS idx_tire_po_site ON tire_purchase_orders(site_id);
CREATE INDEX IF NOT EXISTS idx_tire_po_supp ON tire_purchase_orders(supplier_id);

-- Tire transfers and removals
CREATE INDEX IF NOT EXISTS idx_tire_rem_op ON tire_removals(operator_id);
CREATE INDEX IF NOT EXISTS idx_tire_retread_rem ON tire_retreads(removal_id);
CREATE INDEX IF NOT EXISTS idx_tire_trans_from ON tire_transfers(from_site_id);
CREATE INDEX IF NOT EXISTS idx_tire_trans_recv ON tire_transfers(received_by);
CREATE INDEX IF NOT EXISTS idx_tire_trans_tire ON tire_transfers(tire_id);
CREATE INDEX IF NOT EXISTS idx_tire_trans_to ON tire_transfers(to_site_id);
CREATE INDEX IF NOT EXISTS idx_tire_usage_trip ON tire_usage_logs(trip_id);
CREATE INDEX IF NOT EXISTS idx_tires_supp ON tires(supplier_id);

-- Tracking and trips
CREATE INDEX IF NOT EXISTS idx_track_ack ON tracking_events(acknowledged_by);
CREATE INDEX IF NOT EXISTS idx_track_drv ON tracking_events(driver_id);
CREATE INDEX IF NOT EXISTS idx_track_geo ON tracking_events(geofence_id);
CREATE INDEX IF NOT EXISTS idx_track_trip ON tracking_events(trip_id);
CREATE INDEX IF NOT EXISTS idx_route_next ON trip_route_tracking(next_waypoint_id);
CREATE INDEX IF NOT EXISTS idx_trips_client ON trips(client_id);
CREATE INDEX IF NOT EXISTS idx_trips_trailer ON trips(trailer_id);

-- Vehicle and waste
CREATE INDEX IF NOT EXISTS idx_veh_docs_up ON vehicle_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_waste_veh ON waste_management(source_vehicle_id);
CREATE INDEX IF NOT EXISTS idx_weigh_trip ON weighings(trip_id);

-- ========================================
-- PART 2: Optimize remaining RLS policies
-- ========================================

-- Sites
DROP POLICY IF EXISTS "Admins can manage sites" ON sites;
CREATE POLICY "Admins can manage sites" ON sites FOR ALL TO authenticated
USING ((SELECT (auth.jwt()->>'role')) = 'admin');

-- Vehicles
DROP POLICY IF EXISTS "Fleet managers and admins can manage vehicles" ON vehicles;
CREATE POLICY "Fleet managers and admins can manage vehicles" ON vehicles FOR ALL TO authenticated
USING ((SELECT (auth.jwt()->>'role')) IN ('admin', 'fleet_manager'));

-- Drivers
DROP POLICY IF EXISTS "Managers can manage drivers" ON drivers;
CREATE POLICY "Managers can manage drivers" ON drivers FOR ALL TO authenticated
USING ((SELECT (auth.jwt()->>'role')) IN ('admin', 'fleet_manager'));

-- Trips
DROP POLICY IF EXISTS "Managers can manage trips" ON trips;
CREATE POLICY "Managers can manage trips" ON trips FOR ALL TO authenticated
USING ((SELECT (auth.jwt()->>'role')) IN ('admin', 'fleet_manager'));

-- Fuel transactions
DROP POLICY IF EXISTS "Authorized users can create fuel transactions" ON fuel_transactions;
CREATE POLICY "Authorized users can create fuel transactions" ON fuel_transactions FOR INSERT TO authenticated
WITH CHECK ((SELECT (auth.jwt()->>'role')) IN ('admin', 'fleet_manager', 'driver'));

-- Maintenance
DROP POLICY IF EXISTS "Maintenance chiefs can manage orders" ON maintenance_orders;
CREATE POLICY "Maintenance chiefs can manage orders" ON maintenance_orders FOR ALL TO authenticated
USING ((SELECT (auth.jwt()->>'role')) IN ('admin', 'maintenance_chief'));

DROP POLICY IF EXISTS "Maintenance chiefs can manage parts" ON parts_inventory;
CREATE POLICY "Maintenance chiefs can manage parts" ON parts_inventory FOR ALL TO authenticated
USING ((SELECT (auth.jwt()->>'role')) IN ('admin', 'maintenance_chief'));

-- Clients and invoices
DROP POLICY IF EXISTS "Admins and accountants can manage clients" ON clients;
CREATE POLICY "Admins and accountants can manage clients" ON clients FOR ALL TO authenticated
USING ((SELECT (auth.jwt()->>'role')) IN ('admin', 'accountant'));

DROP POLICY IF EXISTS "Accountants can manage invoices" ON invoices;
CREATE POLICY "Accountants can manage invoices" ON invoices FOR ALL TO authenticated
USING ((SELECT (auth.jwt()->>'role')) IN ('admin', 'accountant'));

-- Alert subscriptions
DROP POLICY IF EXISTS "Users can read own subscriptions" ON alert_subscriptions;
CREATE POLICY "Users can read own subscriptions" ON alert_subscriptions FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can manage own subscriptions" ON alert_subscriptions;
CREATE POLICY "Users can manage own subscriptions" ON alert_subscriptions FOR ALL TO authenticated
USING (user_id = (SELECT auth.uid()));

-- User activity logs
DROP POLICY IF EXISTS "Admins can view all activity logs" ON user_activity_logs;
CREATE POLICY "Admins can view all activity logs" ON user_activity_logs FOR SELECT TO authenticated
USING ((SELECT (auth.jwt()->>'role')) = 'admin');

DROP POLICY IF EXISTS "Users can view own activity logs" ON user_activity_logs;
CREATE POLICY "Users can view own activity logs" ON user_activity_logs FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

-- Work shifts
DROP POLICY IF EXISTS "Admins can manage work shifts" ON work_shifts;
CREATE POLICY "Admins can manage work shifts" ON work_shifts FOR ALL TO authenticated
USING ((SELECT (auth.jwt()->>'role')) = 'admin');

-- ========================================
-- PART 3: Secure remaining functions
-- ========================================

ALTER FUNCTION calculate_trip_duration SET search_path = '';
ALTER FUNCTION calculate_tire_cost_per_tonne_km SET search_path = '';
ALTER FUNCTION check_reorder_points SET search_path = '';
ALTER FUNCTION generate_fuel_transaction_reference SET search_path = '';
ALTER FUNCTION optimize_dispatch_assignment SET search_path = '';

-- ========================================
-- PART 4: Remove duplicate index
-- ========================================

-- Keep idx_maintenance_orders_vehicle, drop the old one
DROP INDEX IF EXISTS idx_maintenance_vehicle;
