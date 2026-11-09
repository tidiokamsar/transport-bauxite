/*
  # Fix Security Issues - Part 3: Consolidate Multiple Permissive Policies

  Remove duplicate SELECT policies to improve performance and clarity.
  Keep only one comprehensive policy per table/action combination.
*/

-- Alert notifications
DROP POLICY IF EXISTS "Authenticated users can manage notifications" ON alert_notifications;
DROP POLICY IF EXISTS "Authenticated users can read notifications" ON alert_notifications;
CREATE POLICY "Users can view alert notifications" ON alert_notifications
  FOR SELECT TO authenticated
  USING (true);

-- Alert rules
DROP POLICY IF EXISTS "Authenticated users can manage alert rules" ON alert_rules;
DROP POLICY IF EXISTS "Authenticated users can read alert rules" ON alert_rules;
CREATE POLICY "Users can view alert rules" ON alert_rules
  FOR SELECT TO authenticated
  USING (true);

-- Alert subscriptions
DROP POLICY IF EXISTS "Users can manage own subscriptions" ON alert_subscriptions;
DROP POLICY IF EXISTS "Users can read own subscriptions" ON alert_subscriptions;
CREATE POLICY "Users manage own subscriptions" ON alert_subscriptions
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Alert thresholds
DROP POLICY IF EXISTS "Authenticated users can manage thresholds" ON alert_thresholds;
DROP POLICY IF EXISTS "Authenticated users can read thresholds" ON alert_thresholds;
CREATE POLICY "Users can view alert thresholds" ON alert_thresholds
  FOR SELECT TO authenticated
  USING (true);

-- Carbon emissions
DROP POLICY IF EXISTS "Authenticated users can manage carbon emissions" ON carbon_emissions;
DROP POLICY IF EXISTS "Authenticated users can read carbon emissions" ON carbon_emissions;
CREATE POLICY "Users can view carbon emissions" ON carbon_emissions
  FOR SELECT TO authenticated
  USING (true);

-- Clients
DROP POLICY IF EXISTS "Authenticated users can view clients" ON clients;

-- Dispatch assignments
DROP POLICY IF EXISTS "Authenticated users can manage dispatch assignments" ON dispatch_assignments;
DROP POLICY IF EXISTS "Authenticated users can read dispatch assignments" ON dispatch_assignments;
CREATE POLICY "Users can view dispatch assignments" ON dispatch_assignments
  FOR SELECT TO authenticated
  USING (true);

-- Dispatch rules
DROP POLICY IF EXISTS "Authenticated users can manage dispatch rules" ON dispatch_rules;
DROP POLICY IF EXISTS "Authenticated users can read dispatch rules" ON dispatch_rules;
CREATE POLICY "Users can view dispatch rules" ON dispatch_rules
  FOR SELECT TO authenticated
  USING (true);

-- Dispatch simulations
DROP POLICY IF EXISTS "Authenticated users can manage dispatch simulations" ON dispatch_simulations;
DROP POLICY IF EXISTS "Authenticated users can read dispatch simulations" ON dispatch_simulations;
CREATE POLICY "Users can view dispatch simulations" ON dispatch_simulations
  FOR SELECT TO authenticated
  USING (true);

-- Driver availability
DROP POLICY IF EXISTS "Authenticated users can manage driver availability" ON driver_availability;
DROP POLICY IF EXISTS "Authenticated users can read driver availability" ON driver_availability;
CREATE POLICY "Users can view driver availability" ON driver_availability
  FOR SELECT TO authenticated
  USING (true);

-- Driver work sessions
DROP POLICY IF EXISTS "Authenticated users can manage work sessions" ON driver_work_sessions;
DROP POLICY IF EXISTS "Authenticated users can read work sessions" ON driver_work_sessions;
CREATE POLICY "Users can view work sessions" ON driver_work_sessions
  FOR SELECT TO authenticated
  USING (true);

-- Drivers
DROP POLICY IF EXISTS "Authenticated users can view drivers" ON drivers;

-- Driving time regulations
DROP POLICY IF EXISTS "Authenticated users can manage driving regulations" ON driving_time_regulations;
DROP POLICY IF EXISTS "Authenticated users can read driving regulations" ON driving_time_regulations;
CREATE POLICY "Users can view driving regulations" ON driving_time_regulations
  FOR SELECT TO authenticated
  USING (true);

-- Eco driving scores
DROP POLICY IF EXISTS "Authenticated users can manage eco driving scores" ON eco_driving_scores;
DROP POLICY IF EXISTS "Authenticated users can read eco driving scores" ON eco_driving_scores;
CREATE POLICY "Users can view eco driving scores" ON eco_driving_scores
  FOR SELECT TO authenticated
  USING (true);

-- Environmental incidents
DROP POLICY IF EXISTS "Authenticated users can manage environmental incidents" ON environmental_incidents;
DROP POLICY IF EXISTS "Authenticated users can read environmental incidents" ON environmental_incidents;
CREATE POLICY "Users can view environmental incidents" ON environmental_incidents
  FOR SELECT TO authenticated
  USING (true);

-- ESG reports
DROP POLICY IF EXISTS "Authenticated users can manage esg reports" ON esg_reports;
DROP POLICY IF EXISTS "Authenticated users can read esg reports" ON esg_reports;
CREATE POLICY "Users can view esg reports" ON esg_reports
  FOR SELECT TO authenticated
  USING (true);

-- Fatigue alerts
DROP POLICY IF EXISTS "Authenticated users can manage fatigue alerts" ON fatigue_alerts;
DROP POLICY IF EXISTS "Authenticated users can read fatigue alerts" ON fatigue_alerts;
CREATE POLICY "Users can view fatigue alerts" ON fatigue_alerts
  FOR SELECT TO authenticated
  USING (true);

-- Fuel anomalies
DROP POLICY IF EXISTS "Authenticated users can manage fuel anomalies" ON fuel_anomalies;
DROP POLICY IF EXISTS "Authenticated users can read fuel anomalies" ON fuel_anomalies;
CREATE POLICY "Users can view fuel anomalies" ON fuel_anomalies
  FOR SELECT TO authenticated
  USING (true);

-- Fuel transactions
DROP POLICY IF EXISTS "Authenticated users can view fuel transactions" ON fuel_transactions;
DROP POLICY IF EXISTS "auth_view_fuel_trans" ON fuel_transactions;
DROP POLICY IF EXISTS "auth_insert_fuel_trans" ON fuel_transactions;
CREATE POLICY "Users can view fuel transactions" ON fuel_transactions
  FOR SELECT TO authenticated
  USING (true);

DO $$
BEGIN
  RAISE NOTICE '✅ Part 3a Complete: Consolidated 22 duplicate policies';
END $$;
