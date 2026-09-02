/*
  # Système de gestion de la fatigue des chauffeurs
  
  1. Nouvelles tables
    - `driver_work_sessions` - Sessions de travail
    - `fatigue_alerts` - Alertes fatigue
    - `rest_periods` - Périodes de repos
    - `driving_time_regulations` - Réglementations temps de conduite
  
  2. Fonctionnalités
    - Suivi temps de conduite en temps réel
    - Alertes automatiques dépassement
    - Calcul score fatigue
    - Gestion pauses obligatoires
  
  3. Sécurité
    - RLS activé
    - Policies authentifiées
*/

-- Table réglementations temps de conduite
CREATE TABLE IF NOT EXISTS driving_time_regulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_name text NOT NULL,
  country_code text DEFAULT 'GN',
  max_daily_driving_hours numeric(4,2) DEFAULT 10.0,
  max_weekly_driving_hours numeric(5,2) DEFAULT 56.0,
  max_continuous_driving_hours numeric(3,2) DEFAULT 4.5,
  min_break_duration_minutes int DEFAULT 30,
  min_daily_rest_hours numeric(4,2) DEFAULT 11.0,
  min_weekly_rest_hours numeric(4,2) DEFAULT 45.0,
  is_active boolean DEFAULT true,
  effective_date date,
  created_at timestamptz DEFAULT now()
);

-- Table sessions de travail
CREATE TABLE IF NOT EXISTS driver_work_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE,
  session_date date DEFAULT CURRENT_DATE,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  total_driving_minutes int,
  total_break_minutes int DEFAULT 0,
  total_rest_minutes int DEFAULT 0,
  trips_completed int DEFAULT 0,
  distance_covered_km numeric(10,2),
  session_type text DEFAULT 'regular' CHECK (session_type IN ('regular', 'overtime', 'night_shift', 'emergency')),
  fatigue_score_start numeric(3,2),
  fatigue_score_end numeric(3,2),
  violations text[],
  status text DEFAULT 'active' CHECK (status IN ('active', 'on_break', 'completed', 'interrupted')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table périodes de repos
CREATE TABLE IF NOT EXISTS rest_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE,
  work_session_id uuid REFERENCES driver_work_sessions(id),
  rest_type text CHECK (rest_type IN ('short_break', 'meal_break', 'daily_rest', 'weekly_rest', 'emergency_rest')),
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  planned_duration_minutes int,
  actual_duration_minutes int,
  location jsonb,
  is_compliant boolean,
  interrupted boolean DEFAULT false,
  interruption_reason text,
  created_at timestamptz DEFAULT now()
);

-- Table alertes fatigue
CREATE TABLE IF NOT EXISTS fatigue_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE,
  work_session_id uuid REFERENCES driver_work_sessions(id),
  alert_type text CHECK (alert_type IN ('max_driving_hours', 'continuous_driving', 'missing_break', 'high_fatigue_score', 'regulation_violation')),
  severity text DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  alert_time timestamptz DEFAULT now(),
  driving_hours_current numeric(4,2),
  driving_hours_limit numeric(4,2),
  fatigue_score numeric(3,2),
  message text NOT NULL,
  action_required text,
  action_taken text,
  is_acknowledged boolean DEFAULT false,
  acknowledged_by uuid REFERENCES auth.users(id),
  acknowledged_at timestamptz,
  resolution_status text DEFAULT 'open' CHECK (resolution_status IN ('open', 'in_progress', 'resolved', 'dismissed')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE driving_time_regulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rest_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE fatigue_alerts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can read driving regulations" ON driving_time_regulations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage driving regulations" ON driving_time_regulations FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read work sessions" ON driver_work_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage work sessions" ON driver_work_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read rest periods" ON rest_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage rest periods" ON rest_periods FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read fatigue alerts" ON fatigue_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage fatigue alerts" ON fatigue_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_work_sessions_driver ON driver_work_sessions(driver_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_date ON driver_work_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_work_sessions_status ON driver_work_sessions(status);
CREATE INDEX IF NOT EXISTS idx_rest_periods_driver ON rest_periods(driver_id);
CREATE INDEX IF NOT EXISTS idx_fatigue_alerts_driver ON fatigue_alerts(driver_id);
CREATE INDEX IF NOT EXISTS idx_fatigue_alerts_status ON fatigue_alerts(resolution_status);

-- Fonction calcul score fatigue
CREATE OR REPLACE FUNCTION calculate_fatigue_score(p_driver_id uuid)
RETURNS numeric AS $$
DECLARE
  v_hours_today numeric;
  v_hours_week numeric;
  v_last_rest_hours numeric;
  v_continuous_hours numeric;
  v_fatigue_score numeric := 0;
  v_regulation record;
BEGIN
  SELECT * INTO v_regulation
  FROM driving_time_regulations
  WHERE is_active = true
  ORDER BY effective_date DESC
  LIMIT 1;

  SELECT 
    COALESCE(SUM(total_driving_minutes), 0) / 60.0
  INTO v_hours_today
  FROM driver_work_sessions
  WHERE driver_id = p_driver_id
    AND session_date = CURRENT_DATE;

  SELECT 
    COALESCE(SUM(total_driving_minutes), 0) / 60.0
  INTO v_hours_week
  FROM driver_work_sessions
  WHERE driver_id = p_driver_id
    AND session_date >= CURRENT_DATE - INTERVAL '7 days';

  v_fatigue_score := LEAST(1.0, 
    (v_hours_today / v_regulation.max_daily_driving_hours * 0.4) +
    (v_hours_week / v_regulation.max_weekly_driving_hours * 0.3) +
    (CASE WHEN v_continuous_hours > v_regulation.max_continuous_driving_hours 
          THEN 0.3 ELSE 0 END)
  );

  UPDATE driver_availability
  SET fatigue_score = v_fatigue_score,
      updated_at = now()
  WHERE driver_id = p_driver_id;

  RETURN v_fatigue_score;
END;
$$ LANGUAGE plpgsql;

-- Fonction vérification et création alertes
CREATE OR REPLACE FUNCTION check_fatigue_violations(p_driver_id uuid)
RETURNS void AS $$
DECLARE
  v_hours_today numeric;
  v_continuous_hours numeric;
  v_regulation record;
  v_session_id uuid;
BEGIN
  SELECT * INTO v_regulation
  FROM driving_time_regulations
  WHERE is_active = true
  ORDER BY effective_date DESC
  LIMIT 1;

  SELECT id, SUM(total_driving_minutes) / 60.0
  INTO v_session_id, v_hours_today
  FROM driver_work_sessions
  WHERE driver_id = p_driver_id
    AND session_date = CURRENT_DATE
    AND status = 'active'
  GROUP BY id
  LIMIT 1;

  IF v_hours_today >= v_regulation.max_daily_driving_hours THEN
    INSERT INTO fatigue_alerts (
      driver_id,
      work_session_id,
      alert_type,
      severity,
      driving_hours_current,
      driving_hours_limit,
      message,
      action_required
    ) VALUES (
      p_driver_id,
      v_session_id,
      'max_driving_hours',
      'critical',
      v_hours_today,
      v_regulation.max_daily_driving_hours,
      'Maximum daily driving hours reached',
      'Immediate rest required'
    );
  END IF;

  IF v_hours_today >= v_regulation.max_daily_driving_hours * 0.8 THEN
    INSERT INTO fatigue_alerts (
      driver_id,
      work_session_id,
      alert_type,
      severity,
      driving_hours_current,
      driving_hours_limit,
      message,
      action_required
    ) VALUES (
      p_driver_id,
      v_session_id,
      'max_driving_hours',
      'high',
      v_hours_today,
      v_regulation.max_daily_driving_hours,
      'Approaching maximum daily driving hours',
      'Plan rest period soon'
    );
  END IF;
END;
$$ LANGUAGE plpgsql;
