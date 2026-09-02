/*
  # Système de configuration des alertes
  
  1. Nouvelles tables
    - `alert_rules` - Règles d'alerte configurables
    - `alert_thresholds` - Seuils par type d'alerte
    - `alert_notifications` - Historique notifications
    - `alert_subscriptions` - Abonnements utilisateurs
  
  2. Fonctionnalités
    - Alertes configurables par module
    - Seuils personnalisables
    - Notifications multi-canaux
    - Escalade automatique
*/

-- Table règles d'alerte
CREATE TABLE IF NOT EXISTS alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name text NOT NULL,
  category text CHECK (category IN ('fuel', 'maintenance', 'driver', 'vehicle', 'trip', 'esg', 'cost', 'safety')),
  severity text DEFAULT 'medium' CHECK (severity IN ('info', 'warning', 'critical', 'emergency')),
  condition_type text CHECK (condition_type IN ('threshold', 'anomaly', 'time_based', 'pattern')),
  condition_expression jsonb NOT NULL,
  notification_channels text[] DEFAULT ARRAY['in_app'],
  escalation_delay_minutes int DEFAULT 60,
  auto_resolve boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table seuils d'alerte
CREATE TABLE IF NOT EXISTS alert_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_rule_id uuid REFERENCES alert_rules(id) ON DELETE CASCADE,
  threshold_name text NOT NULL,
  metric_name text NOT NULL,
  operator text CHECK (operator IN ('>', '<', '>=', '<=', '=', '!=', 'between')),
  threshold_value numeric,
  threshold_min numeric,
  threshold_max numeric,
  unit text,
  evaluation_period_minutes int DEFAULT 5,
  consecutive_violations_required int DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Table notifications
CREATE TABLE IF NOT EXISTS alert_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_rule_id uuid REFERENCES alert_rules(id),
  triggered_at timestamptz DEFAULT now(),
  severity text,
  title text NOT NULL,
  message text NOT NULL,
  entity_type text,
  entity_id uuid,
  metric_value numeric,
  threshold_value numeric,
  notification_channels text[],
  sent_to uuid[] DEFAULT ARRAY[]::uuid[],
  is_read boolean DEFAULT false,
  is_acknowledged boolean DEFAULT false,
  acknowledged_by uuid REFERENCES auth.users(id),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  resolution_note text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Table abonnements utilisateurs
CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_category text,
  min_severity text DEFAULT 'warning',
  notification_channels text[] DEFAULT ARRAY['in_app', 'email'],
  is_active boolean DEFAULT true,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can read alert rules" ON alert_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage alert rules" ON alert_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read thresholds" ON alert_thresholds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage thresholds" ON alert_thresholds FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read notifications" ON alert_notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage notifications" ON alert_notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can read own subscriptions" ON alert_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own subscriptions" ON alert_subscriptions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_alert_rules_category ON alert_rules(category);
CREATE INDEX IF NOT EXISTS idx_alert_rules_active ON alert_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_alert_notifications_triggered ON alert_notifications(triggered_at);
CREATE INDEX IF NOT EXISTS idx_alert_notifications_read ON alert_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_user ON alert_subscriptions(user_id);

-- Configuration des alertes par défaut
INSERT INTO alert_rules (rule_name, category, severity, condition_type, condition_expression, notification_channels) VALUES
('Carburant faible', 'fuel', 'warning', 'threshold', 
 '{"metric": "fuel_level", "operator": "<", "value": 20, "unit": "%"}'::jsonb, 
 ARRAY['in_app', 'sms']),

('Carburant critique', 'fuel', 'critical', 'threshold', 
 '{"metric": "fuel_level", "operator": "<", "value": 10, "unit": "%"}'::jsonb, 
 ARRAY['in_app', 'sms', 'email']),

('Maintenance échue', 'maintenance', 'critical', 'threshold', 
 '{"metric": "km_since_maintenance", "operator": ">", "value": 500, "unit": "km"}'::jsonb, 
 ARRAY['in_app', 'email']),

('Fatigue chauffeur', 'driver', 'critical', 'threshold', 
 '{"metric": "fatigue_score", "operator": ">", "value": 0.7, "unit": "score"}'::jsonb, 
 ARRAY['in_app', 'sms']),

('Heures conduite max', 'driver', 'emergency', 'threshold', 
 '{"metric": "hours_worked_today", "operator": ">=", "value": 10, "unit": "hours"}'::jsonb, 
 ARRAY['in_app', 'sms', 'email']),

('Véhicule inactif prolongé', 'vehicle', 'warning', 'time_based', 
 '{"metric": "inactive_duration", "operator": ">", "value": 180, "unit": "minutes"}'::jsonb, 
 ARRAY['in_app']),

('Surconsommation carburant', 'fuel', 'warning', 'threshold', 
 '{"metric": "fuel_consumption", "operator": ">", "value": 35, "unit": "l/100km"}'::jsonb, 
 ARRAY['in_app', 'email']),

('Émissions CO2 élevées', 'esg', 'warning', 'threshold', 
 '{"metric": "co2_per_tonne_km", "operator": ">", "value": 0.012, "unit": "kg"}'::jsonb, 
 ARRAY['in_app']),

('Incident environnemental', 'esg', 'critical', 'pattern', 
 '{"metric": "incident_count", "operator": ">", "value": 0, "unit": "count"}'::jsonb, 
 ARRAY['in_app', 'email', 'sms']),

('Dépassement budget', 'cost', 'critical', 'threshold', 
 '{"metric": "monthly_cost", "operator": ">", "value": 50000000, "unit": "GNF"}'::jsonb, 
 ARRAY['in_app', 'email']),

('Pneu usure critique', 'maintenance', 'critical', 'threshold', 
 '{"metric": "retread_count", "operator": ">=", "value": 2, "unit": "count"}'::jsonb, 
 ARRAY['in_app', 'email']),

('Score performance faible', 'vehicle', 'warning', 'threshold', 
 '{"metric": "performance_score", "operator": "<", "value": 0.6, "unit": "score"}'::jsonb, 
 ARRAY['in_app'])
ON CONFLICT DO NOTHING;

-- Seuils associés
INSERT INTO alert_thresholds (alert_rule_id, threshold_name, metric_name, operator, threshold_value, unit, evaluation_period_minutes, consecutive_violations_required)
SELECT 
  ar.id,
  'Seuil ' || ar.rule_name,
  ar.condition_expression->>'metric',
  ar.condition_expression->>'operator',
  (ar.condition_expression->>'value')::numeric,
  ar.condition_expression->>'unit',
  5,
  1
FROM alert_rules ar
ON CONFLICT DO NOTHING;

-- Fonction de vérification des alertes
CREATE OR REPLACE FUNCTION check_alert_conditions()
RETURNS TABLE(alert_triggered boolean, rule_name text, message text, severity text, entity_id uuid) AS $$
BEGIN
  -- Vérifier carburant faible
  RETURN QUERY
  SELECT 
    true as alert_triggered,
    'Carburant faible'::text as rule_name,
    'Véhicule ' || v.registration_number || ' a ' || va.fuel_level::text || '% de carburant' as message,
    'warning'::text as severity,
    v.id as entity_id
  FROM vehicle_availability va
  JOIN vehicles v ON v.id = va.vehicle_id
  WHERE va.fuel_level < 20 
    AND va.date = CURRENT_DATE
    AND va.status != 'maintenance';

  -- Vérifier fatigue chauffeurs
  RETURN QUERY
  SELECT 
    true as alert_triggered,
    'Fatigue chauffeur'::text as rule_name,
    'Chauffeur ' || d.full_name || ' score fatigue: ' || da.fatigue_score::text as message,
    'critical'::text as severity,
    d.id as entity_id
  FROM driver_availability da
  JOIN drivers d ON d.id = da.driver_id
  WHERE da.fatigue_score > 0.7
    AND da.date = CURRENT_DATE;

  -- Vérifier heures max
  RETURN QUERY
  SELECT 
    true as alert_triggered,
    'Heures conduite max'::text as rule_name,
    'Chauffeur ' || d.full_name || ' a travaillé ' || da.hours_worked_today::text || ' heures' as message,
    'emergency'::text as severity,
    d.id as entity_id
  FROM driver_availability da
  JOIN drivers d ON d.id = da.driver_id
  WHERE da.hours_worked_today >= 10
    AND da.date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Fonction création notification
CREATE OR REPLACE FUNCTION create_alert_notification(
  p_rule_name text,
  p_severity text,
  p_message text,
  p_entity_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_rule_id uuid;
  v_notification_id uuid;
BEGIN
  SELECT id INTO v_rule_id FROM alert_rules WHERE rule_name = p_rule_name LIMIT 1;

  INSERT INTO alert_notifications (
    alert_rule_id,
    severity,
    title,
    message,
    entity_id
  ) VALUES (
    v_rule_id,
    p_severity,
    p_rule_name,
    p_message,
    p_entity_id
  ) RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;
