/*
  # Système Avancé de Gestion du Cycle de Vie des Pneus

  1. **Tables Principales**
     - tire_mounting_operations (montage avec technicien, QR, position)
     - tire_dismounting_operations (démontage avec analyse)
     - tire_rotations (permutations pour équilibrer usure)
     - tire_quality_controls (contrôles qualité)
     - tire_performance_metrics (métriques calculées)
     - tire_supplier_scores (scoring fournisseurs)
     - tire_purchase_recommendations (recommandations IA)
     - tire_stock_forecasts (prévisions stock)
     - tire_usage_analysis (analyse détaillée usage)
     
  2. **Fonctionnalités**
     - Traçabilité complète achat → rebut
     - Calculs automatiques de rendement
     - Scoring fournisseurs/marques
     - Recommandations IA
     - Analyse par terrain/véhicule/conducteur
     
  3. **Sécurité**
     - RLS activé sur toutes les tables
     - Politiques optimisées avec SELECT wrapper
*/

-- =====================================================
-- MONTAGE ET DÉMONTAGE
-- =====================================================

-- Opérations de montage
CREATE TABLE IF NOT EXISTS tire_mounting_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tire_id uuid REFERENCES tires(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE,
  position text NOT NULL, -- 'front_left', 'front_right', 'rear_left_outer', etc.
  mounting_date timestamptz DEFAULT now(),
  technician_id uuid REFERENCES employees(id),
  technician_signature text,
  initial_pressure_psi numeric,
  initial_tread_depth_mm numeric,
  torque_value_nm numeric,
  qr_code text UNIQUE,
  rfid_tag text,
  quality_check_passed boolean DEFAULT false,
  mounting_notes text,
  photo_before_url text,
  photo_after_url text,
  gps_latitude numeric,
  gps_longitude numeric,
  site_id uuid REFERENCES sites(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Opérations de démontage
CREATE TABLE IF NOT EXISTS tire_dismounting_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tire_id uuid REFERENCES tires(id) ON DELETE CASCADE,
  mounting_operation_id uuid REFERENCES tire_mounting_operations(id),
  vehicle_id uuid REFERENCES vehicles(id),
  dismounting_date timestamptz DEFAULT now(),
  dismounting_reason text NOT NULL, -- 'wear', 'puncture', 'accident', 'rotation'
  technician_id uuid REFERENCES employees(id),
  
  -- Calculs automatiques
  days_in_service integer,
  total_trips_count integer,
  total_tonnage_transported numeric,
  total_kilometers numeric,
  
  -- État final
  final_tread_depth_mm numeric,
  final_pressure_psi numeric,
  wear_percentage numeric,
  
  -- Analyse post-démontage
  physical_condition text, -- 'excellent', 'good', 'fair', 'poor', 'damaged'
  anomalies jsonb, -- {shoulder_wear: true, sidewall_damage: false, ...}
  can_be_retreaded boolean DEFAULT false,
  disposal_method text, -- 'storage', 'retread', 'scrap', 'recycle'
  
  -- Documentation
  inspection_notes text,
  photo_url text,
  gps_latitude numeric,
  gps_longitude numeric,
  site_id uuid REFERENCES sites(id),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Permutations / Rotations
CREATE TABLE IF NOT EXISTS tire_rotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tire_id uuid REFERENCES tires(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE,
  rotation_date timestamptz DEFAULT now(),
  from_position text NOT NULL,
  to_position text NOT NULL,
  reason text, -- 'scheduled', 'uneven_wear', 'optimization'
  technician_id uuid REFERENCES employees(id),
  odometer_reading numeric,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Contrôles qualité détaillés
CREATE TABLE IF NOT EXISTS tire_quality_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tire_id uuid REFERENCES tires(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id),
  control_date timestamptz DEFAULT now(),
  control_type text NOT NULL, -- 'mounting', 'periodic', 'dismounting', 'incident'
  
  -- Mesures
  pressure_psi numeric,
  tread_depth_mm numeric,
  temperature_celsius numeric,
  
  -- Inspections visuelles
  sidewall_condition text, -- 'good', 'cracks', 'bulges', 'cuts'
  tread_condition text, -- 'even', 'center_wear', 'edge_wear', 'cupping'
  bead_condition text,
  
  -- Défauts détectés
  defects_found jsonb,
  severity text, -- 'none', 'minor', 'moderate', 'critical'
  action_required text, -- 'none', 'monitor', 'repair', 'replace'
  
  inspector_id uuid REFERENCES employees(id),
  inspector_signature text,
  photos jsonb, -- {front: url, side: url, tread: url}
  notes text,
  
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- ANALYSE DE PERFORMANCE
-- =====================================================

-- Métriques de performance par pneu
CREATE TABLE IF NOT EXISTS tire_performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tire_id uuid REFERENCES tires(id) ON DELETE CASCADE,
  
  -- Période d'analyse
  calculation_date timestamptz DEFAULT now(),
  service_start_date date,
  service_end_date date,
  
  -- Durée
  days_in_service integer,
  hours_in_service numeric,
  
  -- Utilisation
  total_trips integer,
  total_kilometers numeric,
  total_tonnage_transported numeric,
  average_load_per_trip numeric,
  
  -- Performance économique
  purchase_price_gnf numeric,
  cost_per_day numeric,
  cost_per_km numeric,
  cost_per_ton numeric,
  cost_per_trip numeric,
  
  -- Performance technique
  average_wear_rate numeric, -- mm per 1000 km
  fuel_efficiency_impact numeric, -- % impact on fuel consumption
  downtime_hours numeric,
  number_of_repairs integer,
  repair_cost_total numeric,
  
  -- Scores
  overall_performance_score numeric, -- 0-100
  reliability_score numeric, -- 0-100
  cost_effectiveness_score numeric, -- 0-100
  
  -- Contexte
  vehicle_type text,
  terrain_type text, -- 'dirt', 'gravel', 'paved', 'mixed'
  climate_conditions text,
  site_id uuid REFERENCES sites(id),
  
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- SCORING FOURNISSEURS ET MARQUES
-- =====================================================

CREATE TABLE IF NOT EXISTS tire_supplier_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES tire_suppliers(id) ON DELETE CASCADE,
  brand_name text,
  model_name text,
  
  -- Période d'évaluation
  evaluation_period_start date,
  evaluation_period_end date,
  sample_size integer, -- nombre de pneus analysés
  
  -- Durée de vie moyenne
  avg_days_in_service numeric,
  avg_kilometers numeric,
  avg_tonnage_transported numeric,
  
  -- Performance économique
  avg_purchase_price_gnf numeric,
  avg_cost_per_ton numeric,
  avg_cost_per_km numeric,
  
  -- Fiabilité
  failure_rate numeric, -- % de pneus avec incident
  avg_number_of_repairs numeric,
  premature_failure_count integer,
  
  -- Scores globaux (0-100)
  durability_score numeric,
  cost_efficiency_score numeric,
  reliability_score numeric,
  overall_score numeric,
  
  -- Classement
  ranking_position integer,
  star_rating integer, -- 1-5 étoiles
  
  -- Recommandation
  is_recommended boolean DEFAULT false,
  recommendation_notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================================
-- IA ET RECOMMANDATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS tire_purchase_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Contexte
  vehicle_type text NOT NULL,
  terrain_type text NOT NULL,
  site_id uuid REFERENCES sites(id),
  expected_load_tons numeric,
  expected_monthly_usage_km numeric,
  
  -- Recommandation
  recommended_supplier_id uuid REFERENCES tire_suppliers(id),
  recommended_brand text,
  recommended_model text,
  recommended_quantity integer,
  
  -- Justification
  confidence_score numeric, -- 0-100
  reasoning jsonb, -- {durability: 95, cost: 85, past_performance: 90}
  expected_lifespan_days integer,
  expected_cost_per_ton numeric,
  expected_total_cost_gnf numeric,
  
  -- Budget prévisionnel
  recommended_purchase_date date,
  budget_allocated_gnf numeric,
  
  -- Alternatives
  alternative_options jsonb, -- [{supplier, model, score}, ...]
  
  -- Métadonnées
  generated_by text DEFAULT 'ai_engine',
  generated_at timestamptz DEFAULT now(),
  approved_by uuid REFERENCES employees(id),
  approval_date timestamptz,
  status text DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'purchased'
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================================
-- PRÉVISIONS STOCK
-- =====================================================

CREATE TABLE IF NOT EXISTS tire_stock_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Période
  forecast_date date NOT NULL,
  forecast_period_months integer DEFAULT 12,
  
  -- Par type de pneu
  tire_brand text,
  tire_model text,
  tire_size text,
  vehicle_type text,
  
  -- Stock actuel
  current_stock_quantity integer,
  current_in_use_quantity integer,
  
  -- Prévisions
  expected_monthly_consumption numeric,
  expected_total_consumption integer,
  recommended_minimum_stock integer,
  recommended_purchase_quantity integer,
  
  -- Timing
  estimated_stockout_date date,
  recommended_order_date date,
  lead_time_days integer,
  
  -- Budget
  estimated_unit_price_gnf numeric,
  estimated_total_budget_gnf numeric,
  
  -- Facteurs
  based_on_avg_lifespan_days integer,
  based_on_fleet_size integer,
  based_on_expected_tonnage numeric,
  
  confidence_level numeric, -- 0-100
  notes text,
  
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- ANALYSE DÉTAILLÉE D'USAGE
-- =====================================================

CREATE TABLE IF NOT EXISTS tire_usage_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Période d'analyse
  analysis_date date NOT NULL,
  period_start date,
  period_end date,
  
  -- Segmentation
  analysis_type text NOT NULL, -- 'by_brand', 'by_terrain', 'by_driver', 'by_vehicle', 'by_site'
  segment_name text,
  segment_id uuid,
  
  -- Statistiques agrégées
  total_tires_analyzed integer,
  avg_lifespan_days numeric,
  avg_tonnage_per_tire numeric,
  avg_cost_per_ton numeric,
  
  -- Comparaisons
  vs_company_average_percent numeric,
  vs_best_in_class_percent numeric,
  
  -- Top performers
  best_tire_model text,
  best_tire_score numeric,
  worst_tire_model text,
  worst_tire_score numeric,
  
  -- Insights
  key_findings jsonb,
  recommendations jsonb,
  
  -- Tendances
  trend_direction text, -- 'improving', 'stable', 'declining'
  trend_percentage numeric,
  
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- INDEXES POUR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_tire_mounting_tire ON tire_mounting_operations(tire_id);
CREATE INDEX IF NOT EXISTS idx_tire_mounting_vehicle ON tire_mounting_operations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_tire_mounting_date ON tire_mounting_operations(mounting_date);
CREATE INDEX IF NOT EXISTS idx_tire_mounting_tech ON tire_mounting_operations(technician_id);

CREATE INDEX IF NOT EXISTS idx_tire_dismounting_tire ON tire_dismounting_operations(tire_id);
CREATE INDEX IF NOT EXISTS idx_tire_dismounting_mounting ON tire_dismounting_operations(mounting_operation_id);
CREATE INDEX IF NOT EXISTS idx_tire_dismounting_date ON tire_dismounting_operations(dismounting_date);

CREATE INDEX IF NOT EXISTS idx_tire_rotations_tire ON tire_rotations(tire_id);
CREATE INDEX IF NOT EXISTS idx_tire_rotations_vehicle ON tire_rotations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_tire_rotations_date ON tire_rotations(rotation_date);

CREATE INDEX IF NOT EXISTS idx_tire_quality_tire ON tire_quality_controls(tire_id);
CREATE INDEX IF NOT EXISTS idx_tire_quality_date ON tire_quality_controls(control_date);
CREATE INDEX IF NOT EXISTS idx_tire_quality_severity ON tire_quality_controls(severity);

CREATE INDEX IF NOT EXISTS idx_tire_perf_tire ON tire_performance_metrics(tire_id);
CREATE INDEX IF NOT EXISTS idx_tire_perf_date ON tire_performance_metrics(calculation_date);
CREATE INDEX IF NOT EXISTS idx_tire_perf_score ON tire_performance_metrics(overall_performance_score);

CREATE INDEX IF NOT EXISTS idx_tire_supplier_score_supplier ON tire_supplier_scores(supplier_id);
CREATE INDEX IF NOT EXISTS idx_tire_supplier_score_rating ON tire_supplier_scores(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_tire_supplier_score_recommended ON tire_supplier_scores(is_recommended);

CREATE INDEX IF NOT EXISTS idx_tire_recommend_status ON tire_purchase_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_tire_recommend_date ON tire_purchase_recommendations(recommended_purchase_date);

CREATE INDEX IF NOT EXISTS idx_tire_forecast_date ON tire_stock_forecasts(forecast_date);
CREATE INDEX IF NOT EXISTS idx_tire_forecast_model ON tire_stock_forecasts(tire_brand, tire_model);

CREATE INDEX IF NOT EXISTS idx_tire_analysis_date ON tire_usage_analysis(analysis_date);
CREATE INDEX IF NOT EXISTS idx_tire_analysis_type ON tire_usage_analysis(analysis_type);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE tire_mounting_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_dismounting_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_rotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_quality_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_supplier_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_purchase_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_stock_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_usage_analysis ENABLE ROW LEVEL SECURITY;

-- Politiques simples pour utilisateurs authentifiés
CREATE POLICY "Users can view tire mounting operations" ON tire_mounting_operations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view tire dismounting operations" ON tire_dismounting_operations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view tire rotations" ON tire_rotations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view tire quality controls" ON tire_quality_controls
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view tire performance metrics" ON tire_performance_metrics
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view tire supplier scores" ON tire_supplier_scores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view tire purchase recommendations" ON tire_purchase_recommendations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view tire stock forecasts" ON tire_stock_forecasts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view tire usage analysis" ON tire_usage_analysis
  FOR SELECT TO authenticated USING (true);

-- =====================================================
-- FONCTIONS DE CALCUL AUTOMATIQUE
-- =====================================================

-- Fonction pour calculer les métriques de performance d'un pneu
CREATE OR REPLACE FUNCTION calculate_tire_performance_metrics(p_tire_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_metric_id uuid;
  v_mounting_date timestamptz;
  v_dismounting_date timestamptz;
  v_days_service integer;
  v_total_trips integer;
  v_total_tonnage numeric;
  v_total_km numeric;
  v_purchase_price numeric;
BEGIN
  -- Récupérer les dates de montage/démontage
  SELECT mounting_date INTO v_mounting_date
  FROM tire_mounting_operations
  WHERE tire_id = p_tire_id
  ORDER BY mounting_date DESC LIMIT 1;
  
  SELECT dismounting_date INTO v_dismounting_date
  FROM tire_dismounting_operations
  WHERE tire_id = p_tire_id
  ORDER BY dismounting_date DESC LIMIT 1;
  
  -- Calculer durée
  v_days_service := COALESCE(EXTRACT(DAY FROM (v_dismounting_date - v_mounting_date)), 0);
  
  -- Compter les voyages (simplif ié)
  v_total_trips := COALESCE((
    SELECT COUNT(*) FROM trips t
    JOIN tire_mounting_operations tmo ON tmo.vehicle_id = t.vehicle_id
    WHERE tmo.tire_id = p_tire_id
    AND t.planned_date BETWEEN v_mounting_date AND COALESCE(v_dismounting_date, now())
  ), 0);
  
  -- Calculer tonnage total (simplifié)
  v_total_tonnage := COALESCE((
    SELECT SUM(net_weight) FROM trips t
    JOIN tire_mounting_operations tmo ON tmo.vehicle_id = t.vehicle_id
    WHERE tmo.tire_id = p_tire_id
    AND t.planned_date BETWEEN v_mounting_date AND COALESCE(v_dismounting_date, now())
  ), 0);
  
  -- Prix d'achat
  SELECT purchase_price INTO v_purchase_price FROM tires WHERE id = p_tire_id;
  
  -- Insérer les métriques
  INSERT INTO tire_performance_metrics (
    tire_id,
    service_start_date,
    service_end_date,
    days_in_service,
    total_trips,
    total_tonnage_transported,
    purchase_price_gnf,
    cost_per_day,
    cost_per_ton,
    overall_performance_score
  ) VALUES (
    p_tire_id,
    v_mounting_date::date,
    v_dismounting_date::date,
    v_days_service,
    v_total_trips,
    v_total_tonnage,
    v_purchase_price,
    CASE WHEN v_days_service > 0 THEN v_purchase_price / v_days_service ELSE 0 END,
    CASE WHEN v_total_tonnage > 0 THEN v_purchase_price / v_total_tonnage ELSE 0 END,
    -- Score simplifié basé sur durée et tonnage
    LEAST(100, (v_days_service / 180.0 * 50) + (v_total_tonnage / 10000.0 * 50))
  )
  RETURNING id INTO v_metric_id;
  
  RETURN v_metric_id;
END;
$$;

DO $$
BEGIN
  RAISE NOTICE '✅ Système avancé de gestion du cycle de vie des pneus créé avec succès';
  RAISE NOTICE '   - 9 nouvelles tables créées';
  RAISE NOTICE '   - Traçabilité complète montage → démontage → rebut';
  RAISE NOTICE '   - Analyse de performance et scoring fournisseurs';
  RAISE NOTICE '   - Recommandations IA et prévisions stock';
  RAISE NOTICE '   - Fonction de calcul automatique';
END $$;
