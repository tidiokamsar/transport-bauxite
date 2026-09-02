/*
  # Ajout des politiques RLS pour les tables d'alertes

  1. Tables concernees
    - alert_notifications
    - alert_rules
    - alert_subscriptions
    - alert_thresholds
    - fatigue_alerts
    - geofence_alerts
    - tire_alerts
*/

-- alert_notifications
DROP POLICY IF EXISTS "Users can read all alert notifications" ON alert_notifications;
CREATE POLICY "Users can read all alert notifications"
  ON alert_notifications FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert alert notifications" ON alert_notifications;
CREATE POLICY "Users can insert alert notifications"
  ON alert_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update alert notifications" ON alert_notifications;
CREATE POLICY "Users can update alert notifications"
  ON alert_notifications FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- alert_rules
DROP POLICY IF EXISTS "Users can read all alert rules" ON alert_rules;
CREATE POLICY "Users can read all alert rules"
  ON alert_rules FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert alert rules" ON alert_rules;
CREATE POLICY "Users can insert alert rules"
  ON alert_rules FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update alert rules" ON alert_rules;
CREATE POLICY "Users can update alert rules"
  ON alert_rules FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- alert_subscriptions
DROP POLICY IF EXISTS "Users can read all alert subscriptions" ON alert_subscriptions;
CREATE POLICY "Users can read all alert subscriptions"
  ON alert_subscriptions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert alert subscriptions" ON alert_subscriptions;
CREATE POLICY "Users can insert alert subscriptions"
  ON alert_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- alert_thresholds
DROP POLICY IF EXISTS "Users can read all alert thresholds" ON alert_thresholds;
CREATE POLICY "Users can read all alert thresholds"
  ON alert_thresholds FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert alert thresholds" ON alert_thresholds;
CREATE POLICY "Users can insert alert thresholds"
  ON alert_thresholds FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update alert thresholds" ON alert_thresholds;
CREATE POLICY "Users can update alert thresholds"
  ON alert_thresholds FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- fatigue_alerts
DROP POLICY IF EXISTS "Users can read all fatigue alerts" ON fatigue_alerts;
CREATE POLICY "Users can read all fatigue alerts"
  ON fatigue_alerts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert fatigue alerts" ON fatigue_alerts;
CREATE POLICY "Users can insert fatigue alerts"
  ON fatigue_alerts FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- geofence_alerts
DROP POLICY IF EXISTS "Users can read all geofence alerts" ON geofence_alerts;
CREATE POLICY "Users can read all geofence alerts"
  ON geofence_alerts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert geofence alerts" ON geofence_alerts;
CREATE POLICY "Users can insert geofence alerts"
  ON geofence_alerts FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update geofence alerts" ON geofence_alerts;
CREATE POLICY "Users can update geofence alerts"
  ON geofence_alerts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- tire_alerts
DROP POLICY IF EXISTS "Users can read all tire alerts" ON tire_alerts;
CREATE POLICY "Users can read all tire alerts"
  ON tire_alerts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert tire alerts" ON tire_alerts;
CREATE POLICY "Users can insert tire alerts"
  ON tire_alerts FOR INSERT
  TO authenticated
  WITH CHECK (true);
