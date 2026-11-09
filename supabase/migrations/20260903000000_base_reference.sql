/*
  # Base de reference SIGTB (D-017)

  Genere par scripts/construire-base-reference.sh a partir des migrations
  Bolt archivees (supabase/migrations_bolt_archive) qui rejouent sur base
  vierge. Ne pas modifier a la main : regenerer.

  Contenu : schema `public` (tables, fonctions, vues, politiques RLS,
  droits) et donnees de reference de `role_permissions`. Aucune donnee de
  demonstration (regle 1).

  Les migrations 2026 (Tranche 0, N4, D-012) s'appliquent ensuite.
*/

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

--
-- PostgreSQL database dump
--



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: driver_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.driver_status AS ENUM (
    'active',
    'suspended',
    'terminated'
);


--
-- Name: fuel_transaction_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fuel_transaction_type AS ENUM (
    'refuel',
    'tank_fill'
);


--
-- Name: incident_severity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.incident_severity AS ENUM (
    'minor',
    'moderate',
    'severe',
    'critical'
);


--
-- Name: maintenance_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.maintenance_status AS ENUM (
    'open',
    'in_progress',
    'completed',
    'cancelled'
);


--
-- Name: maintenance_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.maintenance_type AS ENUM (
    'preventive',
    'corrective'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'partial',
    'paid',
    'overdue'
);


--
-- Name: site_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.site_type AS ENUM (
    'mine',
    'port',
    'depot',
    'workshop',
    'base'
);


--
-- Name: transaction_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.transaction_type AS ENUM (
    'refill',
    'consumption'
);


--
-- Name: trip_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.trip_status AS ENUM (
    'planned',
    'in_progress',
    'completed',
    'cancelled'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'director',
    'operations_manager',
    'fleet_manager',
    'maintenance_chief',
    'logistician',
    'accountant',
    'driver'
);


--
-- Name: vehicle_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vehicle_status AS ENUM (
    'active',
    'maintenance',
    'immobilized',
    'sold'
);


--
-- Name: vehicle_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vehicle_type AS ENUM (
    'tipper',
    'tanker',
    'flatbed'
);


--
-- Name: workshop_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.workshop_type AS ENUM (
    'internal',
    'external'
);


--
-- Name: calculate_employee_payroll(uuid, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_employee_payroll(p_employee_id uuid, p_period_start date, p_period_end date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_result jsonb;
  v_base_salary numeric;
  v_trips_count integer;
  v_mission_bonus numeric;
  v_overtime_hours numeric;
  v_overtime_pay numeric;
  v_total_bonuses numeric;
  v_gross_salary numeric;
  v_social_security numeric;
  v_tax_amount numeric;
  v_total_deductions numeric;
  v_net_salary numeric;
BEGIN
  -- Get base salary
  SELECT base_salary INTO v_base_salary
  FROM employees
  WHERE id = p_employee_id;

  -- Count completed trips for mission bonus
  SELECT COUNT(*) INTO v_trips_count
  FROM trips
  WHERE driver_id = p_employee_id
    AND status = 'completed'
    AND planned_date BETWEEN p_period_start AND p_period_end;

  -- Calculate mission bonus (50,000 GNF per trip)
  v_mission_bonus := v_trips_count * 50000;

  -- Get overtime hours (simplified)
  v_overtime_hours := 0;
  v_overtime_pay := 0;

  -- Total bonuses
  v_total_bonuses := v_mission_bonus + v_overtime_pay;

  -- Gross salary
  v_gross_salary := v_base_salary + v_total_bonuses;

  -- Calculate deductions
  v_social_security := v_gross_salary * 0.05; -- 5% CNSS
  v_tax_amount := v_gross_salary * 0.05; -- 5% IR
  v_total_deductions := v_social_security + v_tax_amount;

  -- Net salary
  v_net_salary := v_gross_salary - v_total_deductions;

  -- Build result
  v_result := jsonb_build_object(
    'employee_id', p_employee_id,
    'base_salary', v_base_salary,
    'trips_count', v_trips_count,
    'mission_bonus', v_mission_bonus,
    'overtime_hours', v_overtime_hours,
    'overtime_pay', v_overtime_pay,
    'bonuses', v_total_bonuses,
    'gross_salary', v_gross_salary,
    'social_security', v_social_security,
    'tax_amount', v_tax_amount,
    'deductions', v_total_deductions,
    'net_salary', v_net_salary
  );

  RETURN v_result;
END;
$$;


--
-- Name: calculate_fatigue_score(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_fatigue_score(p_driver_id uuid) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: calculate_tire_cost_per_tonne_km(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_tire_cost_per_tonne_km(p_tire_id uuid) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_total_cost numeric := 0;
  v_total_tonne_km numeric := 0;
BEGIN
  SELECT COALESCE(t.purchase_price, 0) +
         COALESCE(SUM(tr.retread_cost), 0) +
         COALESCE(SUM(rem.repair_cost), 0)
  INTO v_total_cost
  FROM tires t
  LEFT JOIN tire_retreads tr ON tr.tire_id = t.id
  LEFT JOIN tire_removals rem ON rem.installation_id IN (
    SELECT id FROM tire_installations WHERE tire_id = t.id
  )
  WHERE t.id = p_tire_id
  GROUP BY t.id, t.purchase_price;

  SELECT COALESCE(SUM(ul.tonnage_tonnes * ul.distance_km), 0)
  INTO v_total_tonne_km
  FROM tire_usage_logs ul
  WHERE ul.installation_id IN (
    SELECT id FROM tire_installations WHERE tire_id = p_tire_id
  );

  IF v_total_tonne_km > 0 THEN
    RETURN v_total_cost / v_total_tonne_km;
  ELSE
    RETURN NULL;
  END IF;
END;
$$;


--
-- Name: calculate_tire_performance_metrics(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_tire_performance_metrics(p_tire_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
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


--
-- Name: calculate_trip_carbon_emissions(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_trip_carbon_emissions(p_trip_id uuid) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_fuel_consumed numeric;
  v_distance_km numeric;
  v_co2_kg numeric;
  v_emission_factor numeric := 2.68;
BEGIN
  SELECT fuel_consumed, (km_end - km_start)
  INTO v_fuel_consumed, v_distance_km
  FROM trips
  WHERE id = p_trip_id;

  v_co2_kg := v_fuel_consumed * v_emission_factor;

  INSERT INTO carbon_emissions (
    trip_id,
    fuel_consumed_liters,
    distance_km,
    co2_emissions_kg,
    emission_factor
  ) VALUES (
    p_trip_id,
    v_fuel_consumed,
    v_distance_km,
    v_co2_kg,
    v_emission_factor
  );

  RETURN v_co2_kg;
END;
$$;


--
-- Name: calculate_trip_duration(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_trip_duration() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.actual_departure_time IS NOT NULL AND NEW.actual_arrival_time IS NOT NULL THEN
    NEW.trip_duration_minutes := EXTRACT(EPOCH FROM (NEW.actual_arrival_time - NEW.actual_departure_time)) / 60;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: calculate_trip_progress(uuid, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_trip_progress(p_trip_id uuid, p_current_lat numeric, p_current_lng numeric) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_total_distance numeric := 0;
  v_distance_covered numeric := 0;
  v_waypoint RECORD;
  v_prev_lat numeric;
  v_prev_lng numeric;
  v_current_segment_passed boolean := false;
BEGIN
  -- Calculer la distance totale du trajet
  FOR v_waypoint IN 
    SELECT latitude, longitude, sequence_number
    FROM trip_waypoints
    WHERE trip_id = p_trip_id
    ORDER BY sequence_number
  LOOP
    IF v_prev_lat IS NOT NULL THEN
      v_total_distance := v_total_distance + (
        6371 * acos(
          LEAST(1.0,
            cos(radians(v_prev_lat)) * cos(radians(v_waypoint.latitude)) *
            cos(radians(v_waypoint.longitude) - radians(v_prev_lng)) +
            sin(radians(v_prev_lat)) * sin(radians(v_waypoint.latitude))
          )
        )
      );
    END IF;
    v_prev_lat := v_waypoint.latitude;
    v_prev_lng := v_waypoint.longitude;
  END LOOP;
  
  -- Calculer la distance parcourue
  v_prev_lat := NULL;
  v_prev_lng := NULL;
  
  FOR v_waypoint IN 
    SELECT latitude, longitude
    FROM trip_waypoints
    WHERE trip_id = p_trip_id
    ORDER BY sequence_number
  LOOP
    IF v_prev_lat IS NOT NULL AND NOT v_current_segment_passed THEN
      v_distance_covered := v_distance_covered + (
        6371 * acos(
          LEAST(1.0,
            cos(radians(v_prev_lat)) * cos(radians(v_waypoint.latitude)) *
            cos(radians(v_waypoint.longitude) - radians(v_prev_lng)) +
            sin(radians(v_prev_lat)) * sin(radians(v_waypoint.latitude))
          )
        )
      );
      
      -- Vérifier si on a dépassé la position actuelle
      IF (6371 * acos(
        LEAST(1.0,
          cos(radians(p_current_lat)) * cos(radians(v_waypoint.latitude)) *
          cos(radians(v_waypoint.longitude) - radians(p_current_lng)) +
          sin(radians(p_current_lat)) * sin(radians(v_waypoint.latitude))
        )
      )) < 1 THEN
        v_current_segment_passed := true;
      END IF;
    END IF;
    v_prev_lat := v_waypoint.latitude;
    v_prev_lng := v_waypoint.longitude;
  END LOOP;
  
  IF v_total_distance > 0 THEN
    RETURN ROUND((v_distance_covered / v_total_distance * 100)::numeric, 2);
  ELSE
    RETURN 0;
  END IF;
END;
$$;


--
-- Name: check_alert_conditions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_alert_conditions() RETURNS TABLE(alert_triggered boolean, rule_name text, message text, severity text, entity_id uuid)
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: check_fatigue_violations(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_fatigue_violations(p_driver_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: check_reorder_points(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_reorder_points() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_inventory RECORD;
BEGIN
  FOR v_inventory IN
    SELECT * FROM tire_inventory
    WHERE quantity <= reorder_point AND quantity > 0
  LOOP
    INSERT INTO tire_alerts (
      alert_type,
      severity,
      site_id,
      tire_model_id,
      message,
      threshold_value,
      current_value
    ) VALUES (
      'reorder_point',
      CASE WHEN v_inventory.quantity <= v_inventory.minimum_stock THEN 'critical' ELSE 'high' END,
      v_inventory.site_id,
      v_inventory.tire_model_id,
      'Stock below reorder point',
      v_inventory.reorder_point,
      v_inventory.quantity
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;


--
-- Name: check_vehicle_in_authorized_zone(uuid, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_vehicle_in_authorized_zone(p_vehicle_id uuid, p_latitude numeric, p_longitude numeric) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_in_authorized_zone boolean := false;
  v_zone RECORD;
  v_assignment RECORD;
  v_distance numeric;
BEGIN
  -- Vérifier chaque zone où le véhicule a un accès autorisé
  FOR v_assignment IN 
    SELECT za.*, gz.*
    FROM geofence_zone_assignments za
    JOIN geofence_zones gz ON gz.id = za.zone_id
    WHERE za.vehicle_id = p_vehicle_id
      AND za.access_type = 'allowed'
      AND gz.is_active = true
      AND (za.valid_until IS NULL OR za.valid_until > now())
  LOOP
    -- Pour les zones circulaires
    IF v_assignment.geometry_type = 'circle' THEN
      -- Calculer la distance avec la formule de Haversine
      v_distance := 6371000 * acos(
        cos(radians(p_latitude)) * cos(radians(v_assignment.center_lat)) *
        cos(radians(v_assignment.center_lng) - radians(p_longitude)) +
        sin(radians(p_latitude)) * sin(radians(v_assignment.center_lat))
      );
      
      -- Si le véhicule est dans une zone autorisée
      IF v_distance <= v_assignment.radius_meters THEN
        v_in_authorized_zone := true;
        EXIT;
      END IF;
    END IF;
  END LOOP;
  
  RETURN v_in_authorized_zone;
END;
$$;


--
-- Name: create_alert_notification(text, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_alert_notification(p_rule_name text, p_severity text, p_message text, p_entity_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: detect_geofence_violations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.detect_geofence_violations() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_gps RECORD;
  v_zone RECORD;
  v_assignment RECORD;
  v_in_zone boolean;
BEGIN
  -- Parcourir les dernières positions GPS
  FOR v_gps IN 
    SELECT DISTINCT ON (g.vehicle_id) 
      g.id, g.vehicle_id, g.latitude, g.longitude, g.speed_kmh, g.timestamp,
      v.registration_number, t.id as trip_id, t.driver_id
    FROM iot_gps_readings g
    JOIN vehicles v ON v.id = g.vehicle_id
    LEFT JOIN trips t ON t.vehicle_id = v.id AND t.status = 'in_progress'
    WHERE g.timestamp > now() - interval '5 minutes'
    ORDER BY g.vehicle_id, g.timestamp DESC
  LOOP
    -- Vérifier chaque zone active
    FOR v_zone IN SELECT * FROM geofence_zones WHERE is_active = true LOOP
      v_in_zone := is_point_in_geofence(v_gps.latitude, v_gps.longitude, v_zone.id);
      
      -- Vérifier les assignations
      SELECT * INTO v_assignment 
      FROM geofence_zone_assignments 
      WHERE zone_id = v_zone.id 
        AND vehicle_id = v_gps.vehicle_id
        AND (valid_until IS NULL OR valid_until > now());
      
      -- Créer une violation si nécessaire
      IF v_in_zone AND v_assignment.access_type = 'restricted' THEN
        INSERT INTO geofence_violations (
          zone_id, vehicle_id, driver_id, trip_id,
          violation_type, severity,
          entry_time, latitude, longitude, speed_kmh,
          description
        ) VALUES (
          v_zone.id, v_gps.vehicle_id, v_gps.driver_id, v_gps.trip_id,
          'unauthorized_entry', 'high',
          v_gps.timestamp, v_gps.latitude, v_gps.longitude, v_gps.speed_kmh,
          format('Entrée non autorisée dans la zone %s', v_zone.name)
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;


--
-- Name: detect_vehicles_out_of_zone(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.detect_vehicles_out_of_zone() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_gps RECORD;
  v_in_zone boolean;
  v_violation_id uuid;
BEGIN
  -- Vérifier les positions récentes de tous les véhicules actifs
  FOR v_gps IN 
    SELECT DISTINCT ON (g.vehicle_id) 
      g.id, g.vehicle_id, g.latitude, g.longitude, g.speed_kmh, g.timestamp,
      v.registration_number, t.id as trip_id, t.driver_id
    FROM iot_gps_readings g
    JOIN vehicles v ON v.id = g.vehicle_id
    LEFT JOIN trips t ON t.vehicle_id = v.id AND t.status = 'in_progress'
    WHERE g.timestamp > now() - interval '10 minutes'
    ORDER BY g.vehicle_id, g.timestamp DESC
  LOOP
    -- Vérifier si le véhicule est dans une zone autorisée
    v_in_zone := check_vehicle_in_authorized_zone(
      v_gps.vehicle_id, 
      v_gps.latitude, 
      v_gps.longitude
    );
    
    -- Si le véhicule est hors zone autorisée, créer une violation
    IF NOT v_in_zone THEN
      -- Vérifier qu'une violation similaire n'existe pas déjà (dans les 30 dernières minutes)
      IF NOT EXISTS (
        SELECT 1 FROM geofence_violations
        WHERE vehicle_id = v_gps.vehicle_id
          AND violation_type = 'unauthorized_exit'
          AND status IN ('open', 'acknowledged')
          AND created_at > now() - interval '30 minutes'
      ) THEN
        -- Créer la violation
        INSERT INTO geofence_violations (
          zone_id,
          vehicle_id,
          driver_id,
          trip_id,
          violation_type,
          severity,
          entry_time,
          latitude,
          longitude,
          speed_kmh,
          description,
          status
        )
        SELECT
          gz.id,
          v_gps.vehicle_id,
          v_gps.driver_id,
          v_gps.trip_id,
          'unauthorized_exit',
          'high',
          v_gps.timestamp,
          v_gps.latitude,
          v_gps.longitude,
          v_gps.speed_kmh,
          format('Véhicule %s détecté hors de toutes les zones autorisées', v_gps.registration_number),
          'open'
        FROM geofence_zones gz
        WHERE gz.zone_type = 'mine' AND gz.is_active = true
        LIMIT 1
        RETURNING id INTO v_violation_id;
        
        -- Créer une alerte associée
        IF v_violation_id IS NOT NULL THEN
          INSERT INTO geofence_alerts (
            violation_id,
            zone_id,
            vehicle_id,
            alert_type,
            priority,
            message,
            notification_sent
          )
          SELECT
            v_violation_id,
            gz.id,
            v_gps.vehicle_id,
            'exit',
            'urgent',
            format('🚨 ALERTE: Véhicule %s hors zone autorisée! Position: %.4f, %.4f', 
              v_gps.registration_number, v_gps.latitude, v_gps.longitude),
            false
          FROM geofence_zones gz
          WHERE gz.zone_type = 'mine' AND gz.is_active = true
          LIMIT 1;
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$$;


--
-- Name: generate_fuel_transaction_reference(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_fuel_transaction_reference() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
  next_sequence INTEGER;
  date_part TEXT;
  new_reference TEXT;
BEGIN
  -- Si une référence est déjà fournie, on la garde
  IF NEW.reference IS NOT NULL AND NEW.reference != '' THEN
    RETURN NEW;
  END IF;

  -- Créer la partie date au format YYYYMMDD
  date_part := TO_CHAR(COALESCE(NEW.transaction_date, CURRENT_DATE), 'YYYYMMDD');

  -- Trouver le prochain numéro de séquence pour cette date
  SELECT COALESCE(MAX(
    CASE 
      WHEN reference ~ ('^FUEL-' || date_part || '-[0-9]{4}$')
      THEN CAST(SUBSTRING(reference FROM '[0-9]{4}$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO next_sequence
  FROM fuel_transactions
  WHERE transaction_date = COALESCE(NEW.transaction_date, CURRENT_DATE);

  -- Générer la nouvelle référence
  new_reference := 'FUEL-' || date_part || '-' || LPAD(next_sequence::TEXT, 4, '0');

  -- Assigner la référence
  NEW.reference := new_reference;

  RETURN NEW;
END;
$_$;


--
-- Name: generate_payroll_record(uuid, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_payroll_record(p_employee_id uuid, p_period_start date, p_period_end date) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_payroll_data jsonb;
  v_payroll_id uuid;
BEGIN
  -- Calculate payroll
  v_payroll_data := calculate_employee_payroll(p_employee_id, p_period_start, p_period_end);

  -- Insert payroll record
  INSERT INTO payroll_records (
    employee_id,
    period_start,
    period_end,
    base_salary,
    bonuses,
    overtime_pay,
    overtime_hours,
    gross_salary,
    social_security,
    tax_amount,
    deductions,
    net_salary,
    status
  ) VALUES (
    p_employee_id,
    p_period_start,
    p_period_end,
    (v_payroll_data->>'base_salary')::numeric,
    (v_payroll_data->>'bonuses')::numeric,
    (v_payroll_data->>'overtime_pay')::numeric,
    (v_payroll_data->>'overtime_hours')::numeric,
    (v_payroll_data->>'gross_salary')::numeric,
    (v_payroll_data->>'social_security')::numeric,
    (v_payroll_data->>'tax_amount')::numeric,
    (v_payroll_data->>'deductions')::numeric,
    (v_payroll_data->>'net_salary')::numeric,
    'draft'
  )
  RETURNING id INTO v_payroll_id;

  RETURN v_payroll_id;
END;
$$;


--
-- Name: generate_random_position_in_zone(numeric, numeric, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_random_position_in_zone(center_lat numeric, center_lng numeric, radius_meters integer) RETURNS TABLE(latitude numeric, longitude numeric)
    LANGUAGE plpgsql
    AS $$
DECLARE
  lat_degree_meters numeric := 111320;
  lng_degree_meters numeric;
  random_angle numeric;
  random_distance numeric;
BEGIN
  lng_degree_meters := 111320 * cos(radians(center_lat));
  random_angle := random() * 2 * pi();
  random_distance := sqrt(random()) * radius_meters;
  latitude := center_lat + (random_distance * sin(random_angle) / lat_degree_meters);
  longitude := center_lng + (random_distance * cos(random_angle) / lng_degree_meters);
  RETURN NEXT;
END;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND status = 'active'
  );
END;
$$;


--
-- Name: is_authenticated(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_authenticated() RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN auth.uid() IS NOT NULL;
END;
$$;


--
-- Name: is_point_in_geofence(numeric, numeric, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_point_in_geofence(p_latitude numeric, p_longitude numeric, p_zone_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_zone RECORD;
  v_distance numeric;
BEGIN
  SELECT * INTO v_zone FROM geofence_zones WHERE id = p_zone_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Pour les cercles, calculer la distance
  IF v_zone.geometry_type = 'circle' THEN
    -- Formule de Haversine simplifiée (approximation)
    v_distance := 6371000 * acos(
      cos(radians(p_latitude)) * cos(radians(v_zone.center_lat)) *
      cos(radians(v_zone.center_lng) - radians(p_longitude)) +
      sin(radians(p_latitude)) * sin(radians(v_zone.center_lat))
    );
    
    RETURN v_distance <= v_zone.radius_meters;
  END IF;
  
  -- Pour les polygones, utiliser une approximation simple
  -- (dans une vraie implémentation, utiliser PostGIS)
  RETURN true;
END;
$$;


--
-- Name: log_user_activity(text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_user_activity(p_action text, p_details jsonb DEFAULT '{}'::jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO user_activity_logs (
    user_id,
    action,
    details,
    created_at
  ) VALUES (
    auth.uid(),
    p_action,
    p_details,
    now()
  );
END;
$$;


--
-- Name: optimize_dispatch_assignment(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.optimize_dispatch_assignment(p_trip_id uuid, p_optimization_type text DEFAULT 'balanced'::text) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_best_vehicle uuid;
  v_best_driver uuid;
  v_optimization_score numeric;
  v_result jsonb;
BEGIN
  -- Trouver le meilleur véhicule disponible
  SELECT va.vehicle_id, ps.overall_score
  INTO v_best_vehicle, v_optimization_score
  FROM vehicle_availability va
  LEFT JOIN performance_scores ps ON ps.entity_id = va.vehicle_id AND ps.entity_type = 'vehicle'
  WHERE va.status = 'available'
    AND va.fuel_level > 20
    AND va.health_score > 0.7
  ORDER BY 
    CASE 
      WHEN p_optimization_type = 'efficiency' THEN ps.efficiency_score
      WHEN p_optimization_type = 'cost' THEN ps.cost_effectiveness_score
      ELSE ps.overall_score
    END DESC NULLS LAST
  LIMIT 1;

  -- Trouver le meilleur chauffeur disponible
  SELECT da.driver_id
  INTO v_best_driver
  FROM driver_availability da
  LEFT JOIN performance_scores ps ON ps.entity_id = da.driver_id AND ps.entity_type = 'driver'
  WHERE da.status = 'available'
    AND da.hours_worked_today < 10
    AND da.fatigue_score < 0.7
  ORDER BY ps.overall_score DESC NULLS LAST
  LIMIT 1;

  -- Créer l'affectation
  IF v_best_vehicle IS NOT NULL AND v_best_driver IS NOT NULL THEN
    INSERT INTO dispatch_assignments (
      trip_id,
      vehicle_id,
      driver_id,
      assignment_type,
      optimization_score
    ) VALUES (
      p_trip_id,
      v_best_vehicle,
      v_best_driver,
      'automatic',
      v_optimization_score
    );

    v_result := jsonb_build_object(
      'success', true,
      'vehicle_id', v_best_vehicle,
      'driver_id', v_best_driver,
      'optimization_score', v_optimization_score
    );
  ELSE
    v_result := jsonb_build_object(
      'success', false,
      'message', 'No available resources'
    );
  END IF;

  RETURN v_result;
END;
$$;


--
-- Name: sync_trips_columns(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_trips_columns() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.start_date IS NULL AND NEW.planned_date IS NOT NULL THEN
    NEW.start_date := NEW.planned_date;
  END IF;
  
  IF NEW.load_weight IS NULL THEN
    NEW.load_weight := COALESCE(NEW.net_weight, NEW.gross_weight);
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_document_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_document_status() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE vehicle_documents
  SET status = CASE
    WHEN expiry_date < CURRENT_DATE THEN 'expired'
    WHEN expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'pending_renewal'
    ELSE 'active'
  END
  WHERE status NOT IN ('archived')
    AND expiry_date IS NOT NULL;
END;
$$;


--
-- Name: FUNCTION update_document_status(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_document_status() IS 'Updates document status based on expiry dates. Run periodically to maintain accurate status.';


--
-- Name: update_sustainability_kpis(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_sustainability_kpis(p_date date DEFAULT CURRENT_DATE) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_total_co2 numeric;
  v_total_fuel numeric;
  v_total_distance numeric;
  v_avg_eco_score numeric;
BEGIN
  SELECT 
    COALESCE(SUM(co2_emissions_kg), 0),
    COALESCE(SUM(fuel_consumed_liters), 0),
    COALESCE(SUM(distance_km), 0)
  INTO v_total_co2, v_total_fuel, v_total_distance
  FROM carbon_emissions
  WHERE emission_date = p_date;

  SELECT COALESCE(AVG(overall_score), 0)
  INTO v_avg_eco_score
  FROM eco_driving_scores
  WHERE score_date = p_date;

  INSERT INTO sustainability_kpis (
    kpi_date,
    period_type,
    total_co2_emissions_kg,
    total_fuel_consumed_liters,
    fuel_efficiency_l_per_100km,
    eco_driving_avg_score
  ) VALUES (
    p_date,
    'daily',
    v_total_co2,
    v_total_fuel,
    CASE WHEN v_total_distance > 0 THEN (v_total_fuel / v_total_distance) * 100 ELSE 0 END,
    v_avg_eco_score
  )
  ON CONFLICT (kpi_date) DO UPDATE SET
    total_co2_emissions_kg = EXCLUDED.total_co2_emissions_kg,
    total_fuel_consumed_liters = EXCLUDED.total_fuel_consumed_liters,
    fuel_efficiency_l_per_100km = EXCLUDED.fuel_efficiency_l_per_100km,
    eco_driving_avg_score = EXCLUDED.eco_driving_avg_score;
END;
$$;


--
-- Name: update_user_password(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_password(user_id uuid, new_password text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = user_id;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alert_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alert_rule_id uuid,
    triggered_at timestamp with time zone DEFAULT now(),
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
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    resolved_at timestamp with time zone,
    resolution_note text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: alert_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_name text NOT NULL,
    category text,
    severity text DEFAULT 'medium'::text,
    condition_type text,
    condition_expression jsonb NOT NULL,
    notification_channels text[] DEFAULT ARRAY['in_app'::text],
    escalation_delay_minutes integer DEFAULT 60,
    auto_resolve boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT alert_rules_category_check CHECK ((category = ANY (ARRAY['fuel'::text, 'maintenance'::text, 'driver'::text, 'vehicle'::text, 'trip'::text, 'esg'::text, 'cost'::text, 'safety'::text]))),
    CONSTRAINT alert_rules_condition_type_check CHECK ((condition_type = ANY (ARRAY['threshold'::text, 'anomaly'::text, 'time_based'::text, 'pattern'::text]))),
    CONSTRAINT alert_rules_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text, 'emergency'::text])))
);


--
-- Name: alert_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    alert_category text,
    min_severity text DEFAULT 'warning'::text,
    notification_channels text[] DEFAULT ARRAY['in_app'::text, 'email'::text],
    is_active boolean DEFAULT true,
    quiet_hours_start time without time zone,
    quiet_hours_end time without time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: alert_thresholds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_thresholds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alert_rule_id uuid,
    threshold_name text NOT NULL,
    metric_name text NOT NULL,
    operator text,
    threshold_value numeric,
    threshold_min numeric,
    threshold_max numeric,
    unit text,
    evaluation_period_minutes integer DEFAULT 5,
    consecutive_violations_required integer DEFAULT 1,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT alert_thresholds_operator_check CHECK ((operator = ANY (ARRAY['>'::text, '<'::text, '>='::text, '<='::text, '='::text, '!='::text, 'between'::text])))
);


--
-- Name: alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alert_type text NOT NULL,
    severity text DEFAULT 'info'::text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    reference_type text,
    reference_id uuid,
    vehicle_id uuid,
    driver_id uuid,
    status text DEFAULT 'active'::text NOT NULL,
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT alerts_alert_type_check CHECK ((alert_type = ANY (ARRAY['vehicle_maintenance'::text, 'fuel_low'::text, 'tire_replacement'::text, 'document_expiry'::text, 'driver_license_expiry'::text, 'insurance_expiry'::text, 'stock_low'::text, 'invoice_overdue'::text]))),
    CONSTRAINT alerts_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text]))),
    CONSTRAINT alerts_status_check CHECK ((status = ANY (ARRAY['active'::text, 'acknowledged'::text, 'resolved'::text])))
);


--
-- Name: attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    attendance_date date NOT NULL,
    check_in_time time without time zone,
    check_out_time time without time zone,
    status text DEFAULT 'present'::text NOT NULL,
    hours_worked numeric(4,2),
    overtime_hours numeric(4,2) DEFAULT 0,
    notes text,
    recorded_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT attendance_status_check CHECK ((status = ANY (ARRAY['present'::text, 'absent'::text, 'late'::text, 'half_day'::text, 'on_leave'::text, 'holiday'::text])))
);


--
-- Name: benchmark_comparisons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.benchmark_comparisons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comparison_category text NOT NULL,
    metric_name text NOT NULL,
    our_value numeric(12,2) NOT NULL,
    industry_average numeric(12,2),
    industry_best numeric(12,2),
    industry_worst numeric(12,2),
    percentile_rank integer,
    variance_from_average numeric(8,2),
    performance_rating text,
    improvement_potential numeric(8,2),
    benchmark_source text,
    geographic_region text,
    fleet_size_category text,
    measurement_period text,
    period_start date NOT NULL,
    period_end date NOT NULL,
    insights jsonb DEFAULT '[]'::jsonb,
    action_items jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT benchmark_comparisons_percentile_rank_check CHECK (((percentile_rank >= 0) AND (percentile_rank <= 100))),
    CONSTRAINT benchmark_comparisons_performance_rating_check CHECK ((performance_rating = ANY (ARRAY['excellent'::text, 'above_average'::text, 'average'::text, 'below_average'::text, 'poor'::text])))
);


--
-- Name: carbon_emissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carbon_emissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trip_id uuid,
    vehicle_id uuid,
    emission_date date DEFAULT CURRENT_DATE,
    fuel_consumed_liters numeric(10,2),
    distance_km numeric(10,2),
    co2_emissions_kg numeric(10,2),
    nox_emissions_kg numeric(10,2),
    pm_emissions_kg numeric(10,2),
    emission_factor numeric(5,4),
    calculation_method text DEFAULT 'standard'::text,
    verified boolean DEFAULT false,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: carbon_footprint_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carbon_footprint_tracking (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_id uuid,
    trip_id uuid,
    tracking_period text NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    total_co2_emissions_kg numeric(12,2) NOT NULL,
    fuel_consumption_liters numeric(10,2),
    distance_traveled_km numeric(10,2),
    co2_per_km numeric(8,4),
    co2_per_liter numeric(8,4),
    emission_standard text,
    carbon_offset_cost numeric(12,2),
    benchmark_emissions numeric(12,2),
    variance_from_benchmark numeric(5,2),
    improvement_opportunities jsonb DEFAULT '[]'::jsonb,
    esg_compliance_score integer,
    certifications jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT carbon_footprint_tracking_esg_compliance_score_check CHECK (((esg_compliance_score >= 0) AND (esg_compliance_score <= 100)))
);


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    contract_reference text,
    rate_per_tonne numeric NOT NULL,
    payment_terms_days integer DEFAULT 30,
    late_penalty_rate numeric DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: compliance_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_type text NOT NULL,
    reporting_period text NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    regulatory_body text,
    compliance_status text,
    compliance_score integer,
    violations jsonb DEFAULT '[]'::jsonb,
    corrective_actions jsonb DEFAULT '[]'::jsonb,
    documentation_links jsonb DEFAULT '[]'::jsonb,
    submission_deadline date,
    submitted_at timestamp with time zone,
    approved_at timestamp with time zone,
    report_data jsonb DEFAULT '{}'::jsonb,
    auto_generated boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT compliance_reports_compliance_score_check CHECK (((compliance_score >= 0) AND (compliance_score <= 100))),
    CONSTRAINT compliance_reports_compliance_status_check CHECK ((compliance_status = ANY (ARRAY['compliant'::text, 'non_compliant'::text, 'partially_compliant'::text, 'under_review'::text])))
);


--
-- Name: cost_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    category_type text NOT NULL,
    description text,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT cost_categories_category_type_check CHECK ((category_type = ANY (ARRAY['fixed'::text, 'variable'::text, 'operational'::text])))
);


--
-- Name: custom_dashboards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_dashboards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    dashboard_name text NOT NULL,
    is_default boolean DEFAULT false,
    layout_config jsonb DEFAULT '{}'::jsonb,
    widgets jsonb DEFAULT '[]'::jsonb,
    filters jsonb DEFAULT '{}'::jsonb,
    refresh_interval_seconds integer DEFAULT 300,
    is_public boolean DEFAULT false,
    shared_with jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_number text NOT NULL,
    customer_type text DEFAULT 'company'::text NOT NULL,
    company_name text,
    contact_name text NOT NULL,
    email text,
    phone text,
    address text,
    city text,
    country text DEFAULT 'Guinée'::text,
    tax_id text,
    payment_terms integer DEFAULT 30,
    credit_limit numeric DEFAULT 0,
    notes text,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: cycle_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cycle_tracking (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assignment_id uuid NOT NULL,
    cycle_number integer NOT NULL,
    cycle_start_time timestamp with time zone NOT NULL,
    cycle_end_time timestamp with time zone,
    loading_start_time timestamp with time zone,
    loading_end_time timestamp with time zone,
    travel_loaded_start_time timestamp with time zone,
    travel_loaded_end_time timestamp with time zone,
    dumping_start_time timestamp with time zone,
    dumping_end_time timestamp with time zone,
    travel_empty_start_time timestamp with time zone,
    travel_empty_end_time timestamp with time zone,
    loading_duration_minutes integer,
    travel_loaded_duration_minutes integer,
    dumping_duration_minutes integer,
    travel_empty_duration_minutes integer,
    total_cycle_duration_minutes integer,
    queue_wait_time_minutes integer DEFAULT 0,
    load_weight_tonnes numeric(10,2),
    material_loaded text,
    loader_vehicle_id uuid,
    distance_traveled_km numeric(10,2),
    fuel_consumed_liters numeric(10,2),
    gps_start_lat numeric(10,6),
    gps_start_lon numeric(10,6),
    gps_end_lat numeric(10,6),
    gps_end_lon numeric(10,6),
    gps_track jsonb,
    status text DEFAULT 'in_progress'::text NOT NULL,
    issues_encountered text[],
    delay_reasons text[],
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT cycle_tracking_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'completed'::text, 'interrupted'::text, 'cancelled'::text])))
);


--
-- Name: deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    delivery_number text NOT NULL,
    delivery_date date DEFAULT CURRENT_DATE NOT NULL,
    purchase_order_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    warehouse_id uuid,
    received_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: dispatch_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispatch_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trip_id uuid,
    vehicle_id uuid,
    driver_id uuid,
    assignment_date timestamp with time zone DEFAULT now(),
    assignment_type text DEFAULT 'automatic'::text,
    optimization_score numeric(5,2),
    estimated_cost numeric(10,2),
    estimated_duration_minutes integer,
    estimated_fuel_consumption numeric(10,2),
    route_optimization jsonb,
    status text DEFAULT 'assigned'::text,
    assigned_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT dispatch_assignments_assignment_type_check CHECK ((assignment_type = ANY (ARRAY['automatic'::text, 'manual'::text, 'override'::text]))),
    CONSTRAINT dispatch_assignments_status_check CHECK ((status = ANY (ARRAY['assigned'::text, 'accepted'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: dispatch_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispatch_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    priority integer DEFAULT 0,
    rule_type text,
    weight numeric(3,2) DEFAULT 1.0,
    conditions jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT dispatch_rules_rule_type_check CHECK ((rule_type = ANY (ARRAY['distance'::text, 'load_capacity'::text, 'driver_score'::text, 'fuel_efficiency'::text, 'cost'::text])))
);


--
-- Name: dispatch_simulations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispatch_simulations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    simulation_name text NOT NULL,
    scenario_type text,
    parameters jsonb NOT NULL,
    results jsonb,
    metrics jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT dispatch_simulations_scenario_type_check CHECK ((scenario_type = ANY (ARRAY['add_vehicles'::text, 'change_routes'::text, 'optimize_fuel'::text, 'what_if'::text])))
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_number text NOT NULL,
    document_type text NOT NULL,
    title text NOT NULL,
    description text,
    reference_type text,
    reference_id uuid,
    vehicle_id uuid,
    driver_id uuid,
    issue_date date,
    expiry_date date,
    file_url text,
    file_name text,
    file_size integer,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT documents_document_type_check CHECK ((document_type = ANY (ARRAY['vehicle_insurance'::text, 'vehicle_registration'::text, 'technical_inspection'::text, 'driver_license'::text, 'contract'::text, 'invoice'::text, 'receipt'::text, 'other'::text])))
);


--
-- Name: driver_availability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driver_availability (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    driver_id uuid,
    date date DEFAULT CURRENT_DATE,
    status text DEFAULT 'available'::text,
    current_location jsonb,
    hours_worked_today numeric(4,2) DEFAULT 0,
    hours_worked_week numeric(5,2) DEFAULT 0,
    fatigue_score numeric(3,2),
    performance_score numeric(3,2),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT driver_availability_status_check CHECK ((status = ANY (ARRAY['available'::text, 'on_mission'::text, 'resting'::text, 'off_duty'::text, 'unavailable'::text])))
);


--
-- Name: driver_behavior_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driver_behavior_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    driver_id uuid,
    period_start date NOT NULL,
    period_end date NOT NULL,
    overall_score integer NOT NULL,
    safety_score integer,
    efficiency_score integer,
    compliance_score integer,
    eco_driving_score integer,
    harsh_braking_count integer DEFAULT 0,
    harsh_acceleration_count integer DEFAULT 0,
    speeding_incidents integer DEFAULT 0,
    idle_time_minutes integer DEFAULT 0,
    night_driving_hours numeric(8,2) DEFAULT 0,
    fatigue_risk_level text,
    accident_risk_score numeric(5,2),
    improvement_areas jsonb DEFAULT '[]'::jsonb,
    strengths jsonb DEFAULT '[]'::jsonb,
    training_recommendations jsonb DEFAULT '[]'::jsonb,
    peer_comparison_percentile integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT driver_behavior_scores_accident_risk_score_check CHECK (((accident_risk_score >= (0)::numeric) AND (accident_risk_score <= (100)::numeric))),
    CONSTRAINT driver_behavior_scores_compliance_score_check CHECK (((compliance_score >= 0) AND (compliance_score <= 100))),
    CONSTRAINT driver_behavior_scores_eco_driving_score_check CHECK (((eco_driving_score >= 0) AND (eco_driving_score <= 100))),
    CONSTRAINT driver_behavior_scores_efficiency_score_check CHECK (((efficiency_score >= 0) AND (efficiency_score <= 100))),
    CONSTRAINT driver_behavior_scores_fatigue_risk_level_check CHECK ((fatigue_risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT driver_behavior_scores_overall_score_check CHECK (((overall_score >= 0) AND (overall_score <= 100))),
    CONSTRAINT driver_behavior_scores_peer_comparison_percentile_check CHECK (((peer_comparison_percentile >= 0) AND (peer_comparison_percentile <= 100))),
    CONSTRAINT driver_behavior_scores_safety_score_check CHECK (((safety_score >= 0) AND (safety_score <= 100)))
);


--
-- Name: driver_work_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driver_work_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    driver_id uuid,
    session_date date DEFAULT CURRENT_DATE,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone,
    total_driving_minutes integer,
    total_break_minutes integer DEFAULT 0,
    total_rest_minutes integer DEFAULT 0,
    trips_completed integer DEFAULT 0,
    distance_covered_km numeric(10,2),
    session_type text DEFAULT 'regular'::text,
    fatigue_score_start numeric(3,2),
    fatigue_score_end numeric(3,2),
    violations text[],
    status text DEFAULT 'active'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT driver_work_sessions_session_type_check CHECK ((session_type = ANY (ARRAY['regular'::text, 'overtime'::text, 'night_shift'::text, 'emergency'::text]))),
    CONSTRAINT driver_work_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'on_break'::text, 'completed'::text, 'interrupted'::text])))
);


--
-- Name: drivers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drivers (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    profile_id uuid,
    license_number text NOT NULL,
    license_category text NOT NULL,
    license_expiry date NOT NULL,
    hire_date date NOT NULL,
    contract_type text,
    base_salary numeric DEFAULT 0,
    status public.driver_status DEFAULT 'active'::public.driver_status,
    health_certificate_expiry date,
    total_tonnage numeric DEFAULT 0,
    total_km numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    name text DEFAULT ''::text NOT NULL,
    phone text,
    email text,
    birth_date date,
    address text,
    emergency_contact_name text,
    emergency_contact_phone text,
    employee_id text,
    notes text
);


--
-- Name: driving_time_regulations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driving_time_regulations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    regulation_name text NOT NULL,
    country_code text DEFAULT 'GN'::text,
    max_daily_driving_hours numeric(4,2) DEFAULT 10.0,
    max_weekly_driving_hours numeric(5,2) DEFAULT 56.0,
    max_continuous_driving_hours numeric(3,2) DEFAULT 4.5,
    min_break_duration_minutes integer DEFAULT 30,
    min_daily_rest_hours numeric(4,2) DEFAULT 11.0,
    min_weekly_rest_hours numeric(4,2) DEFAULT 45.0,
    is_active boolean DEFAULT true,
    effective_date date,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: eco_driving_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eco_driving_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    driver_id uuid,
    trip_id uuid,
    score_date date DEFAULT CURRENT_DATE,
    overall_score numeric(3,2),
    smooth_acceleration_score numeric(3,2),
    smooth_braking_score numeric(3,2),
    optimal_speed_score numeric(3,2),
    idle_time_score numeric(3,2),
    fuel_efficiency_score numeric(3,2),
    harsh_events_count integer DEFAULT 0,
    idle_time_minutes integer DEFAULT 0,
    recommendations text[],
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: employee_attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_attendance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    date date NOT NULL,
    status text DEFAULT 'present'::text,
    check_in_time time without time zone,
    check_out_time time without time zone,
    hours_worked numeric(4,2) DEFAULT 0,
    overtime_hours numeric(4,2) DEFAULT 0,
    absence_reason text,
    justification_document text,
    approved_by uuid,
    approval_date timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT employee_attendance_status_check CHECK ((status = ANY (ARRAY['present'::text, 'absent'::text, 'late'::text, 'half_day'::text, 'leave'::text, 'sick_leave'::text, 'unpaid_leave'::text])))
);


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_number text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    full_name text GENERATED ALWAYS AS (((first_name || ' '::text) || last_name)) STORED,
    date_of_birth date,
    gender text,
    national_id text,
    "position" text NOT NULL,
    department text NOT NULL,
    hire_date date DEFAULT CURRENT_DATE NOT NULL,
    phone text,
    email text,
    address text,
    base_salary bigint DEFAULT 0,
    bank_name text,
    bank_account text,
    emergency_contact_name text,
    emergency_contact_phone text,
    status text DEFAULT 'active'::text NOT NULL,
    photo_url text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT employees_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text]))),
    CONSTRAINT employees_status_check CHECK ((status = ANY (ARRAY['active'::text, 'on_leave'::text, 'suspended'::text, 'terminated'::text])))
);


--
-- Name: environmental_incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.environmental_incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    incident_date timestamp with time zone DEFAULT now(),
    incident_type text,
    severity text,
    vehicle_id uuid,
    driver_id uuid,
    location jsonb,
    description text NOT NULL,
    estimated_impact text,
    corrective_actions text,
    status text DEFAULT 'open'::text,
    reported_by uuid,
    photos jsonb,
    resolved_date timestamp with time zone,
    cost_remediation numeric(12,2),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT environmental_incidents_incident_type_check CHECK ((incident_type = ANY (ARRAY['fuel_spill'::text, 'oil_leak'::text, 'tire_disposal'::text, 'waste'::text, 'emission_excess'::text, 'other'::text]))),
    CONSTRAINT environmental_incidents_severity_check CHECK ((severity = ANY (ARRAY['minor'::text, 'moderate'::text, 'major'::text, 'critical'::text]))),
    CONSTRAINT environmental_incidents_status_check CHECK ((status = ANY (ARRAY['open'::text, 'investigating'::text, 'resolved'::text, 'closed'::text])))
);


--
-- Name: esg_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.esg_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_name text NOT NULL,
    report_type text,
    report_period_start date,
    report_period_end date,
    status text DEFAULT 'draft'::text,
    environmental_data jsonb,
    social_data jsonb,
    governance_data jsonb,
    key_findings text[],
    recommendations text[],
    generated_by uuid,
    published_date date,
    file_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT esg_reports_report_type_check CHECK ((report_type = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'annual'::text, 'custom'::text]))),
    CONSTRAINT esg_reports_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'completed'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expense_number text NOT NULL,
    expense_date date DEFAULT CURRENT_DATE NOT NULL,
    category_id uuid NOT NULL,
    description text NOT NULL,
    amount bigint NOT NULL,
    vehicle_id uuid,
    driver_id uuid,
    trip_id uuid,
    payment_method text,
    payment_reference text,
    supplier_id uuid,
    invoice_number text,
    notes text,
    recorded_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT expenses_payment_method_check CHECK ((payment_method = ANY (ARRAY['cash'::text, 'bank_transfer'::text, 'check'::text, 'mobile_money'::text, 'credit'::text])))
);


--
-- Name: fatigue_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fatigue_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    driver_id uuid,
    work_session_id uuid,
    alert_type text,
    severity text DEFAULT 'medium'::text,
    alert_time timestamp with time zone DEFAULT now(),
    driving_hours_current numeric(4,2),
    driving_hours_limit numeric(4,2),
    fatigue_score numeric(3,2),
    message text NOT NULL,
    action_required text,
    action_taken text,
    is_acknowledged boolean DEFAULT false,
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    resolution_status text DEFAULT 'open'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT fatigue_alerts_alert_type_check CHECK ((alert_type = ANY (ARRAY['max_driving_hours'::text, 'continuous_driving'::text, 'missing_break'::text, 'high_fatigue_score'::text, 'regulation_violation'::text]))),
    CONSTRAINT fatigue_alerts_resolution_status_check CHECK ((resolution_status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'dismissed'::text]))),
    CONSTRAINT fatigue_alerts_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])))
);


--
-- Name: fleet_health_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fleet_health_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_id uuid,
    overall_score integer NOT NULL,
    mechanical_score integer,
    performance_score integer,
    safety_score integer,
    efficiency_score integer,
    predicted_issues jsonb DEFAULT '[]'::jsonb,
    risk_level text,
    next_maintenance_prediction timestamp with time zone,
    confidence_level numeric(5,2),
    recommendations jsonb DEFAULT '[]'::jsonb,
    calculated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT fleet_health_scores_confidence_level_check CHECK (((confidence_level >= (0)::numeric) AND (confidence_level <= (100)::numeric))),
    CONSTRAINT fleet_health_scores_efficiency_score_check CHECK (((efficiency_score >= 0) AND (efficiency_score <= 100))),
    CONSTRAINT fleet_health_scores_mechanical_score_check CHECK (((mechanical_score >= 0) AND (mechanical_score <= 100))),
    CONSTRAINT fleet_health_scores_overall_score_check CHECK (((overall_score >= 0) AND (overall_score <= 100))),
    CONSTRAINT fleet_health_scores_performance_score_check CHECK (((performance_score >= 0) AND (performance_score <= 100))),
    CONSTRAINT fleet_health_scores_risk_level_check CHECK ((risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT fleet_health_scores_safety_score_check CHECK (((safety_score >= 0) AND (safety_score <= 100)))
);


--
-- Name: fleet_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fleet_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_number text NOT NULL,
    task_type text NOT NULL,
    origin_site_id uuid,
    destination_site_id uuid,
    material_type text,
    target_tonnage numeric(10,2),
    priority integer DEFAULT 5,
    status text DEFAULT 'pending'::text NOT NULL,
    planned_start_time timestamp with time zone,
    planned_end_time timestamp with time zone,
    actual_start_time timestamp with time zone,
    actual_end_time timestamp with time zone,
    distance_km numeric(10,2),
    estimated_duration_minutes integer,
    route_profile jsonb,
    required_vehicle_type text,
    required_capacity_tonnes numeric(10,2),
    shift_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT fleet_tasks_priority_check CHECK (((priority >= 1) AND (priority <= 10))),
    CONSTRAINT fleet_tasks_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'assigned'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text, 'delayed'::text]))),
    CONSTRAINT fleet_tasks_task_type_check CHECK ((task_type = ANY (ARRAY['transport'::text, 'loading'::text, 'hauling'::text, 'dumping'::text, 'maintenance_move'::text, 'relocation'::text])))
);


--
-- Name: fuel_stocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fuel_stocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid,
    fuel_type_id uuid,
    tank_capacity numeric DEFAULT 0 NOT NULL,
    current_stock numeric DEFAULT 0 NOT NULL,
    minimum_stock numeric DEFAULT 0 NOT NULL,
    last_refill_date date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: fuel_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fuel_transactions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    transaction_date date DEFAULT CURRENT_DATE NOT NULL,
    vehicle_id uuid,
    driver_id uuid,
    volume_liters numeric NOT NULL,
    unit_price numeric NOT NULL,
    total_cost numeric NOT NULL,
    transaction_type public.fuel_transaction_type DEFAULT 'refuel'::public.fuel_transaction_type,
    receipt_photo_url text,
    supplier text,
    trip_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    reference text NOT NULL,
    site_id uuid,
    fuel_type_id uuid,
    quantity numeric,
    total_amount numeric,
    odometer_reading numeric,
    invoice_number text,
    notes text,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: fuel_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fuel_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    unit text DEFAULT 'litres'::text NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: geofence_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geofence_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    violation_id uuid NOT NULL,
    zone_id uuid NOT NULL,
    vehicle_id uuid NOT NULL,
    alert_type text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    message text NOT NULL,
    notification_sent boolean DEFAULT false,
    notification_channels text[] DEFAULT ARRAY['app'::text, 'email'::text],
    notified_users uuid[],
    sent_at timestamp with time zone,
    is_read boolean DEFAULT false,
    read_by uuid,
    read_at timestamp with time zone,
    escalated boolean DEFAULT false,
    escalated_at timestamp with time zone,
    escalated_to uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT geofence_alerts_alert_type_check CHECK ((alert_type = ANY (ARRAY['entry'::text, 'exit'::text, 'dwell'::text, 'speed'::text, 'schedule'::text]))),
    CONSTRAINT geofence_alerts_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text])))
);


--
-- Name: geofence_violations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geofence_violations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    zone_id uuid NOT NULL,
    vehicle_id uuid NOT NULL,
    driver_id uuid,
    trip_id uuid,
    violation_type text NOT NULL,
    severity text DEFAULT 'medium'::text NOT NULL,
    entry_time timestamp with time zone,
    exit_time timestamp with time zone,
    duration_minutes integer,
    latitude numeric(10,7),
    longitude numeric(10,7),
    speed_kmh numeric(5,2),
    description text,
    automated_detection boolean DEFAULT true,
    status text DEFAULT 'open'::text NOT NULL,
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    resolution_notes text,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT geofence_violations_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT geofence_violations_status_check CHECK ((status = ANY (ARRAY['open'::text, 'acknowledged'::text, 'investigating'::text, 'resolved'::text, 'false_positive'::text]))),
    CONSTRAINT geofence_violations_violation_type_check CHECK ((violation_type = ANY (ARRAY['unauthorized_entry'::text, 'unauthorized_exit'::text, 'overstay'::text, 'speeding'::text, 'restricted_hours'::text])))
);


--
-- Name: geofence_zone_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geofence_zone_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    zone_id uuid NOT NULL,
    vehicle_id uuid,
    driver_id uuid,
    access_type text NOT NULL,
    valid_from timestamp with time zone DEFAULT now(),
    valid_until timestamp with time zone,
    allowed_schedules jsonb,
    notify_on_violation boolean DEFAULT true,
    notification_emails text[],
    notification_phones text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT geofence_zone_assignments_access_type_check CHECK ((access_type = ANY (ARRAY['allowed'::text, 'restricted'::text, 'monitored'::text])))
);


--
-- Name: geofence_zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geofence_zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    zone_type text NOT NULL,
    geometry_type text NOT NULL,
    polygon_coordinates jsonb,
    center_lat numeric(10,7),
    center_lng numeric(10,7),
    radius_meters integer,
    color text DEFAULT '#8B5CF6'::text,
    is_active boolean DEFAULT true,
    priority integer DEFAULT 0,
    alert_on_entry boolean DEFAULT false,
    alert_on_exit boolean DEFAULT false,
    alert_on_dwell boolean DEFAULT false,
    max_dwell_minutes integer,
    allowed_vehicle_types text[],
    restricted_hours jsonb,
    max_speed_kmh integer,
    site_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT geofence_zones_geometry_type_check CHECK ((geometry_type = ANY (ARRAY['polygon'::text, 'circle'::text]))),
    CONSTRAINT geofence_zones_zone_type_check CHECK ((zone_type = ANY (ARRAY['mine'::text, 'depot'::text, 'route'::text, 'restricted'::text, 'loading'::text, 'maintenance'::text, 'parking'::text, 'customs'::text])))
);


--
-- Name: geofences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geofences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    zone_type text NOT NULL,
    center_latitude numeric(10,8) NOT NULL,
    center_longitude numeric(11,8) NOT NULL,
    radius_meters integer DEFAULT 500 NOT NULL,
    polygon_coordinates jsonb,
    description text,
    active boolean DEFAULT true,
    notify_on_entry boolean DEFAULT false,
    notify_on_exit boolean DEFAULT false,
    max_stay_duration interval,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT geofences_zone_type_check CHECK ((zone_type = ANY (ARRAY['mine'::text, 'port'::text, 'depot'::text, 'station'::text, 'garage'::text, 'client'::text, 'custom'::text])))
);


--
-- Name: incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incidents (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    trip_id uuid,
    incident_time timestamp with time zone DEFAULT now(),
    description text NOT NULL,
    severity public.incident_severity NOT NULL,
    estimated_cost numeric DEFAULT 0,
    insurance_report_url text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid,
    trip_id uuid,
    description text NOT NULL,
    quantity numeric DEFAULT 1 NOT NULL,
    unit_price numeric DEFAULT 0 NOT NULL,
    total_price numeric DEFAULT 0,
    item_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    client_id uuid,
    invoice_number text NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    total_tonnage numeric DEFAULT 0,
    unit_rate numeric NOT NULL,
    gross_amount numeric DEFAULT 0,
    deductions numeric DEFAULT 0,
    taxes numeric DEFAULT 0,
    net_amount numeric DEFAULT 0,
    payment_status public.payment_status DEFAULT 'pending'::public.payment_status,
    due_date date,
    pdf_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    customer_id uuid,
    invoice_date date DEFAULT CURRENT_DATE,
    status text DEFAULT 'draft'::text,
    subtotal numeric DEFAULT 0,
    tax_rate numeric DEFAULT 0,
    tax_amount numeric DEFAULT 0,
    discount_amount numeric DEFAULT 0,
    total_amount numeric DEFAULT 0,
    amount_paid numeric DEFAULT 0,
    balance_due numeric DEFAULT 0,
    currency text DEFAULT 'GNF'::text,
    notes text,
    terms text,
    created_by uuid
);


--
-- Name: iot_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.iot_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    device_id text NOT NULL,
    device_type text,
    manufacturer text,
    model text,
    vehicle_id uuid,
    installation_date date,
    api_key text,
    status text DEFAULT 'active'::text,
    configuration jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT iot_devices_device_type_check CHECK ((device_type = ANY (ARRAY['fuel_sensor'::text, 'gps_tracker'::text, 'telematic_unit'::text, 'weight_sensor'::text, 'tire_pressure_sensor'::text])))
);


--
-- Name: iot_fuel_readings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.iot_fuel_readings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    device_id text,
    vehicle_id uuid,
    reading_timestamp timestamp with time zone DEFAULT now(),
    fuel_level_liters numeric(10,2) NOT NULL,
    fuel_level_percentage numeric(5,2),
    tank_capacity_liters numeric(10,2),
    location_latitude numeric(10,7),
    location_longitude numeric(10,7),
    is_anomaly boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: iot_gps_readings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.iot_gps_readings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    device_id text,
    vehicle_id uuid,
    reading_timestamp timestamp with time zone DEFAULT now(),
    latitude numeric(10,7) NOT NULL,
    longitude numeric(10,7) NOT NULL,
    speed_kmh numeric(6,2),
    odometer_km numeric(12,2),
    ignition_status boolean,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: iot_tire_readings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.iot_tire_readings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    device_id text NOT NULL,
    vehicle_id uuid NOT NULL,
    reading_timestamp timestamp with time zone DEFAULT now() NOT NULL,
    tire_position text NOT NULL,
    pressure_psi numeric NOT NULL,
    temperature_celsius numeric,
    tread_depth_mm numeric,
    is_anomaly boolean DEFAULT false,
    anomaly_type text,
    location_latitude numeric,
    location_longitude numeric,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: iot_weight_readings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.iot_weight_readings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    device_id text NOT NULL,
    vehicle_id uuid NOT NULL,
    reading_timestamp timestamp with time zone DEFAULT now() NOT NULL,
    gross_weight_kg numeric NOT NULL,
    net_weight_kg numeric,
    tare_weight_kg numeric,
    axle_weights jsonb,
    is_overloaded boolean DEFAULT false,
    location_latitude numeric,
    location_longitude numeric,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    leave_type text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    days_requested integer NOT NULL,
    reason text,
    status text DEFAULT 'pending'::text NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT leave_requests_leave_type_check CHECK ((leave_type = ANY (ARRAY['annual'::text, 'sick'::text, 'maternity'::text, 'unpaid'::text, 'other'::text]))),
    CONSTRAINT leave_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])))
);


--
-- Name: maintenance_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_orders (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    vehicle_id uuid,
    request_date date DEFAULT CURRENT_DATE,
    maintenance_type public.maintenance_type NOT NULL,
    km_at_maintenance numeric,
    description text NOT NULL,
    labor_hours numeric DEFAULT 0,
    labor_cost numeric DEFAULT 0,
    status public.maintenance_status DEFAULT 'open'::public.maintenance_status,
    workshop public.workshop_type DEFAULT 'internal'::public.workshop_type,
    completion_date date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    work_order_number text,
    title text,
    priority text DEFAULT 'medium'::text,
    assigned_to uuid,
    requested_by uuid,
    site_id uuid,
    scheduled_date date,
    started_at timestamp with time zone,
    estimated_cost numeric DEFAULT 0,
    actual_cost numeric DEFAULT 0,
    notes text
);


--
-- Name: maintenance_parts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_parts (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    maintenance_order_id uuid,
    part_id uuid,
    quantity_used numeric NOT NULL,
    unit_cost numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: maintenance_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_id uuid,
    title text NOT NULL,
    description text,
    maintenance_type text NOT NULL,
    frequency_type text NOT NULL,
    frequency_value numeric NOT NULL,
    last_service_date date,
    last_service_km numeric,
    next_service_date date,
    next_service_km numeric,
    estimated_cost numeric DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    interval_km numeric,
    interval_days integer,
    is_active boolean DEFAULT true,
    last_maintenance_km numeric,
    last_maintenance_date date
);


--
-- Name: mission_requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_requirements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trip_id uuid,
    required_vehicle_type text,
    min_load_capacity numeric(10,2),
    required_certifications text[],
    max_distance_km numeric(10,2),
    time_window_start timestamp with time zone,
    time_window_end timestamp with time zone,
    priority integer DEFAULT 0,
    special_requirements jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    notification_type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    reference_type text,
    reference_id uuid,
    read boolean DEFAULT false,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: optimization_constraints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.optimization_constraints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    constraint_name text NOT NULL,
    constraint_type text NOT NULL,
    priority integer DEFAULT 5,
    is_hard_constraint boolean DEFAULT true,
    applies_to text NOT NULL,
    entity_ids uuid[],
    rules jsonb NOT NULL,
    valid_from timestamp with time zone,
    valid_until timestamp with time zone,
    is_active boolean DEFAULT true,
    violation_penalty_score numeric(5,2),
    violation_action text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT optimization_constraints_applies_to_check CHECK ((applies_to = ANY (ARRAY['vehicle'::text, 'driver'::text, 'route'::text, 'site'::text, 'task'::text, 'shift'::text]))),
    CONSTRAINT optimization_constraints_constraint_type_check CHECK ((constraint_type = ANY (ARRAY['vehicle_capacity'::text, 'vehicle_compatibility'::text, 'route_restriction'::text, 'time_window'::text, 'operator_qualification'::text, 'fuel_availability'::text, 'maintenance_schedule'::text]))),
    CONSTRAINT optimization_constraints_priority_check CHECK (((priority >= 1) AND (priority <= 10))),
    CONSTRAINT optimization_constraints_violation_action_check CHECK ((violation_action = ANY (ARRAY['reject'::text, 'warn'::text, 'penalize'::text, 'ignore'::text])))
);


--
-- Name: optimization_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.optimization_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    optimization_date timestamp with time zone DEFAULT now(),
    optimization_type text,
    vehicles_optimized integer,
    missions_optimized integer,
    improvement_percentage numeric(5,2),
    cost_saved numeric(12,2),
    time_saved_minutes integer,
    fuel_saved_liters numeric(10,2),
    details jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: optimization_scenarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.optimization_scenarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_name text NOT NULL,
    scenario_type text NOT NULL,
    base_shift_plan_id uuid,
    parameters jsonb NOT NULL,
    vehicles_added integer DEFAULT 0,
    vehicles_removed integer DEFAULT 0,
    vehicles_unavailable uuid[],
    routes_modified jsonb,
    speed_adjustments jsonb,
    weather_impact_factor numeric(3,2) DEFAULT 1.0,
    status text DEFAULT 'pending'::text NOT NULL,
    run_at timestamp with time zone,
    completion_time timestamp with time zone,
    estimated_production_tonnes numeric(10,2),
    estimated_total_cycles integer,
    estimated_fuel_consumption_liters numeric(10,2),
    estimated_total_cost numeric(15,2),
    estimated_completion_time timestamp with time zone,
    utilization_rate numeric(5,2),
    production_variance_percent numeric(5,2),
    cost_variance_percent numeric(5,2),
    efficiency_score numeric(5,2),
    results_detail jsonb,
    recommendations text[],
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT optimization_scenarios_scenario_type_check CHECK ((scenario_type = ANY (ARRAY['baseline'::text, 'what_if'::text, 'historical_replay'::text, 'predictive'::text]))),
    CONSTRAINT optimization_scenarios_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: parts_inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parts_inventory (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    part_reference text NOT NULL,
    description text NOT NULL,
    quantity_in_stock numeric DEFAULT 0,
    minimum_threshold numeric DEFAULT 0,
    unit_price numeric DEFAULT 0,
    supplier text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_number text NOT NULL,
    invoice_id uuid,
    customer_id uuid,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    amount numeric NOT NULL,
    payment_method text NOT NULL,
    reference_number text,
    notes text,
    received_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: payroll; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payroll_number text NOT NULL,
    employee_id uuid NOT NULL,
    payroll_period_start date NOT NULL,
    payroll_period_end date NOT NULL,
    payment_date date NOT NULL,
    base_salary bigint NOT NULL,
    allowances bigint DEFAULT 0,
    bonuses bigint DEFAULT 0,
    overtime_pay bigint DEFAULT 0,
    gross_salary bigint NOT NULL,
    deductions bigint DEFAULT 0,
    tax bigint DEFAULT 0,
    net_salary bigint NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    payment_method text,
    payment_reference text,
    notes text,
    prepared_by uuid,
    approved_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payroll_payment_method_check CHECK ((payment_method = ANY (ARRAY['bank_transfer'::text, 'cash'::text, 'check'::text, 'mobile_money'::text]))),
    CONSTRAINT payroll_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'paid'::text])))
);


--
-- Name: payroll_bonuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_bonuses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payroll_record_id uuid NOT NULL,
    bonus_type text NOT NULL,
    description text,
    amount numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: payroll_deductions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_deductions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payroll_record_id uuid NOT NULL,
    deduction_type text NOT NULL,
    description text,
    amount numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: payroll_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payroll_id uuid NOT NULL,
    item_type text NOT NULL,
    item_name text NOT NULL,
    amount bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payroll_items_item_type_check CHECK ((item_type = ANY (ARRAY['earning'::text, 'deduction'::text])))
);


--
-- Name: payroll_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    base_salary numeric(12,2) DEFAULT 0 NOT NULL,
    overtime_pay numeric(12,2) DEFAULT 0,
    bonuses numeric(12,2) DEFAULT 0,
    deductions numeric(12,2) DEFAULT 0,
    tax_amount numeric(12,2) DEFAULT 0,
    social_security numeric(12,2) DEFAULT 0,
    net_salary numeric(12,2) DEFAULT 0 NOT NULL,
    days_worked integer DEFAULT 0,
    days_absent integer DEFAULT 0,
    hours_worked numeric(6,2) DEFAULT 0,
    overtime_hours numeric(6,2) DEFAULT 0,
    status text DEFAULT 'draft'::text,
    payment_date date,
    payment_method text,
    notes text,
    approved_by uuid,
    approval_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payroll_records_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending'::text, 'approved'::text, 'paid'::text])))
);


--
-- Name: performance_kpis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.performance_kpis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kpi_date date NOT NULL,
    shift_plan_id uuid,
    calculation_time timestamp with time zone DEFAULT now(),
    total_vehicles_available integer,
    total_vehicles_utilized integer,
    vehicle_utilization_rate numeric(5,2),
    total_productive_hours numeric(10,2),
    total_idle_hours numeric(10,2),
    idle_time_rate numeric(5,2),
    total_cycles_completed integer,
    total_tonnage_moved numeric(10,2),
    average_cycle_time_minutes numeric(10,2),
    cycles_per_vehicle numeric(5,2),
    tonnes_per_hour numeric(10,2),
    total_queue_wait_minutes integer,
    average_queue_wait_minutes numeric(10,2),
    max_queue_wait_minutes integer,
    total_fuel_consumed_liters numeric(10,2),
    fuel_per_tonne numeric(5,2),
    fuel_per_km numeric(5,2),
    fuel_cost_per_tonne numeric(10,2),
    total_operational_cost numeric(15,2),
    cost_per_tonne numeric(10,2),
    cost_per_cycle numeric(10,2),
    top_performing_drivers uuid[],
    underperforming_drivers uuid[],
    total_delays_minutes integer,
    breakdown_incidents integer,
    unplanned_stops integer,
    plan_vs_actual_variance_percent numeric(5,2),
    reoptimization_events_count integer,
    optimization_effectiveness_score numeric(5,2),
    metrics_by_vehicle jsonb,
    metrics_by_task_type jsonb,
    metrics_by_route jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: performance_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.performance_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text,
    entity_id uuid NOT NULL,
    score_date date DEFAULT CURRENT_DATE,
    efficiency_score numeric(3,2),
    reliability_score numeric(3,2),
    safety_score numeric(3,2),
    cost_effectiveness_score numeric(3,2),
    overall_score numeric(3,2),
    metrics jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT performance_scores_entity_type_check CHECK ((entity_type = ANY (ARRAY['vehicle'::text, 'driver'::text, 'route'::text])))
);


--
-- Name: predictive_maintenance_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.predictive_maintenance_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_id uuid,
    model_type text NOT NULL,
    prediction_date timestamp with time zone NOT NULL,
    failure_probability numeric(5,2),
    predicted_component text,
    recommended_action text,
    estimated_cost numeric(12,2),
    urgency_level text,
    confidence_score numeric(5,2),
    historical_data_points integer DEFAULT 0,
    last_trained_at timestamp with time zone,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT predictive_maintenance_models_confidence_score_check CHECK (((confidence_score >= (0)::numeric) AND (confidence_score <= (100)::numeric))),
    CONSTRAINT predictive_maintenance_models_failure_probability_check CHECK (((failure_probability >= (0)::numeric) AND (failure_probability <= (100)::numeric))),
    CONSTRAINT predictive_maintenance_models_status_check CHECK ((status = ANY (ARRAY['active'::text, 'resolved'::text, 'dismissed'::text]))),
    CONSTRAINT predictive_maintenance_models_urgency_level_check CHECK ((urgency_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    role public.user_role DEFAULT 'driver'::public.user_role NOT NULL,
    full_name text NOT NULL,
    phone text,
    site_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    status text DEFAULT 'active'::text,
    created_by uuid,
    updated_by uuid,
    last_login timestamp with time zone,
    email text,
    department text,
    photo_url text,
    CONSTRAINT profiles_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text])))
);


--
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_order_id uuid NOT NULL,
    stock_item_id uuid,
    item_description text NOT NULL,
    quantity integer NOT NULL,
    unit_price bigint NOT NULL,
    total_price bigint NOT NULL,
    quantity_received integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    po_number text NOT NULL,
    po_date date DEFAULT CURRENT_DATE NOT NULL,
    supplier_id uuid NOT NULL,
    warehouse_id uuid,
    status text DEFAULT 'draft'::text NOT NULL,
    subtotal bigint DEFAULT 0,
    tax_amount bigint DEFAULT 0,
    total_amount bigint DEFAULT 0,
    expected_delivery_date date,
    notes text,
    requested_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT purchase_orders_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'received'::text, 'cancelled'::text])))
);


--
-- Name: quick_actions_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quick_actions_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action_type text NOT NULL,
    action_name text NOT NULL,
    entity_type text,
    entity_id uuid,
    parameters jsonb DEFAULT '{}'::jsonb,
    execution_time_ms integer,
    status text,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT quick_actions_log_status_check CHECK ((status = ANY (ARRAY['success'::text, 'failed'::text, 'partial'::text])))
);


--
-- Name: reoptimization_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reoptimization_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    severity text NOT NULL,
    event_time timestamp with time zone DEFAULT now() NOT NULL,
    detected_by text,
    affected_shift_plan_id uuid,
    affected_task_ids uuid[],
    affected_vehicle_ids uuid[],
    affected_driver_ids uuid[],
    event_description text NOT NULL,
    event_data jsonb,
    reoptimization_triggered boolean DEFAULT false,
    reoptimization_started_at timestamp with time zone,
    reoptimization_completed_at timestamp with time zone,
    reoptimization_status text,
    tasks_reassigned integer DEFAULT 0,
    vehicles_reallocated integer DEFAULT 0,
    new_assignments_created integer DEFAULT 0,
    recommendations text[],
    actions_taken text[],
    resolved boolean DEFAULT false,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT reoptimization_events_event_type_check CHECK ((event_type = ANY (ARRAY['vehicle_breakdown'::text, 'driver_absence'::text, 'route_closure'::text, 'weather_change'::text, 'congestion'::text, 'equipment_failure'::text, 'priority_change'::text, 'manual_trigger'::text]))),
    CONSTRAINT reoptimization_events_reoptimization_status_check CHECK ((reoptimization_status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT reoptimization_events_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])))
);


--
-- Name: rest_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rest_periods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    driver_id uuid,
    work_session_id uuid,
    rest_type text,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone,
    planned_duration_minutes integer,
    actual_duration_minutes integer,
    location jsonb,
    is_compliant boolean,
    interrupted boolean DEFAULT false,
    interruption_reason text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT rest_periods_rest_type_check CHECK ((rest_type = ANY (ARRAY['short_break'::text, 'meal_break'::text, 'daily_rest'::text, 'weekly_rest'::text, 'emergency_rest'::text])))
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role text NOT NULL,
    module text NOT NULL,
    can_view boolean DEFAULT false,
    can_create boolean DEFAULT false,
    can_edit boolean DEFAULT false,
    can_delete boolean DEFAULT false,
    can_approve boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: route_optimization_suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.route_optimization_suggestions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trip_id uuid,
    vehicle_id uuid,
    driver_id uuid,
    original_route jsonb,
    suggested_route jsonb,
    estimated_fuel_savings numeric(10,2),
    estimated_time_savings integer,
    estimated_distance_reduction numeric(10,2),
    estimated_cost_savings numeric(12,2),
    factors_considered jsonb DEFAULT '[]'::jsonb,
    traffic_conditions text,
    weather_conditions text,
    road_conditions text,
    suggestion_confidence numeric(5,2),
    status text DEFAULT 'pending'::text,
    suggested_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    decision_made_at timestamp with time zone,
    actual_savings numeric(12,2),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT route_optimization_suggestions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'expired'::text]))),
    CONSTRAINT route_optimization_suggestions_suggestion_confidence_check CHECK (((suggestion_confidence >= (0)::numeric) AND (suggestion_confidence <= (100)::numeric)))
);


--
-- Name: scenario_simulations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_simulations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    simulation_name text NOT NULL,
    simulation_type text,
    description text,
    baseline_metrics jsonb DEFAULT '{}'::jsonb,
    scenario_parameters jsonb DEFAULT '{}'::jsonb,
    projected_outcomes jsonb DEFAULT '{}'::jsonb,
    financial_impact numeric(12,2),
    roi_projection numeric(8,2),
    risk_assessment text,
    confidence_level numeric(5,2),
    timeframe_months integer,
    assumptions jsonb DEFAULT '[]'::jsonb,
    success_criteria jsonb DEFAULT '[]'::jsonb,
    status text DEFAULT 'draft'::text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    reviewed_at timestamp with time zone,
    implemented_at timestamp with time zone,
    actual_results jsonb,
    CONSTRAINT scenario_simulations_confidence_level_check CHECK (((confidence_level >= (0)::numeric) AND (confidence_level <= (100)::numeric))),
    CONSTRAINT scenario_simulations_risk_assessment_check CHECK ((risk_assessment = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'very_high'::text]))),
    CONSTRAINT scenario_simulations_simulation_type_check CHECK ((simulation_type = ANY (ARRAY['fleet_expansion'::text, 'cost_reduction'::text, 'route_optimization'::text, 'vehicle_replacement'::text, 'fuel_strategy'::text, 'maintenance_strategy'::text, 'other'::text]))),
    CONSTRAINT scenario_simulations_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'under_review'::text, 'approved'::text, 'implemented'::text, 'rejected'::text])))
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: trips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trips (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    reference text NOT NULL,
    planned_date date NOT NULL,
    vehicle_id uuid,
    driver_id uuid,
    trailer_id uuid,
    departure_site_id uuid,
    arrival_site_id uuid,
    estimated_distance_km numeric,
    actual_departure_time timestamp with time zone,
    actual_arrival_time timestamp with time zone,
    km_start numeric,
    km_end numeric,
    gross_weight numeric,
    tare_weight numeric,
    net_weight numeric,
    status public.trip_status DEFAULT 'planned'::public.trip_status,
    client_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    shift_id uuid,
    shift_sequence integer,
    loading_time_minutes integer DEFAULT 15,
    unloading_time_minutes integer DEFAULT 10,
    trip_duration_minutes integer,
    material_type text DEFAULT 'minerai'::text,
    notes text,
    start_date date,
    load_weight numeric
);


--
-- Name: work_shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_shifts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    display_name text NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    shift_order integer NOT NULL,
    color text DEFAULT '#3b82f6'::text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: shift_performance_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.shift_performance_stats AS
 SELECT ws.id AS shift_id,
    ws.name AS shift_name,
    ws.display_name,
    ws.color,
    t.planned_date AS date,
    count(t.id) AS total_trips,
    count(
        CASE
            WHEN (t.status = 'completed'::public.trip_status) THEN 1
            ELSE NULL::integer
        END) AS completed_trips,
    count(
        CASE
            WHEN (t.status = 'in_progress'::public.trip_status) THEN 1
            ELSE NULL::integer
        END) AS in_progress_trips,
    COALESCE(sum(t.net_weight), (0)::numeric) AS total_weight,
    COALESCE(avg(t.trip_duration_minutes), (0)::numeric) AS avg_duration_minutes
   FROM (public.work_shifts ws
     LEFT JOIN public.trips t ON ((t.shift_id = ws.id)))
  WHERE (ws.is_active = true)
  GROUP BY ws.id, ws.name, ws.display_name, ws.color, t.planned_date;


--
-- Name: shift_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_number text NOT NULL,
    shift_date date NOT NULL,
    shift_type text NOT NULL,
    shift_start_time timestamp with time zone NOT NULL,
    shift_end_time timestamp with time zone NOT NULL,
    target_production_tonnes numeric(10,2),
    allocated_vehicles_count integer DEFAULT 0,
    allocated_loaders_count integer DEFAULT 0,
    allocated_drivers_count integer DEFAULT 0,
    status text DEFAULT 'draft'::text NOT NULL,
    optimization_run_at timestamp with time zone,
    optimization_score numeric(5,2),
    total_estimated_cost numeric(15,2),
    total_estimated_fuel_liters numeric(10,2),
    weather_conditions text,
    site_conditions text,
    constraints jsonb,
    approved_by uuid,
    approved_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT shift_plans_shift_type_check CHECK ((shift_type = ANY (ARRAY['morning'::text, 'afternoon'::text, 'night'::text, 'extended'::text]))),
    CONSTRAINT shift_plans_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending_approval'::text, 'approved'::text, 'active'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: sites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sites (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    type public.site_type NOT NULL,
    location text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    address text,
    city text,
    country text DEFAULT 'Guinée'::text,
    contact_name text,
    contact_phone text,
    contact_email text,
    capacity numeric,
    current_stock numeric DEFAULT 0,
    manager_id uuid,
    notes text
);


--
-- Name: smart_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.smart_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    notification_type text NOT NULL,
    category text,
    priority integer DEFAULT 5,
    title text NOT NULL,
    message text NOT NULL,
    action_url text,
    action_label text,
    related_entity_type text,
    related_entity_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_read boolean DEFAULT false,
    is_dismissed boolean DEFAULT false,
    read_at timestamp with time zone,
    dismissed_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT smart_notifications_category_check CHECK ((category = ANY (ARRAY['critical'::text, 'warning'::text, 'info'::text, 'success'::text]))),
    CONSTRAINT smart_notifications_priority_check CHECK (((priority >= 1) AND (priority <= 10)))
);


--
-- Name: spare_parts_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spare_parts_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    part_number text NOT NULL,
    name text NOT NULL,
    description text,
    category text,
    unit_price numeric DEFAULT 0 NOT NULL,
    unit text DEFAULT 'unit'::text,
    minimum_stock numeric DEFAULT 0,
    reorder_quantity numeric DEFAULT 0,
    supplier text,
    supplier_part_number text,
    notes text,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: stock_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    parent_id uuid,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: stock_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_code text NOT NULL,
    name text NOT NULL,
    description text,
    category_id uuid,
    unit_of_measure text DEFAULT 'piece'::text NOT NULL,
    unit_price bigint DEFAULT 0,
    quantity_in_stock integer DEFAULT 0,
    minimum_threshold integer DEFAULT 0,
    maximum_threshold integer,
    warehouse_id uuid,
    location_in_warehouse text,
    supplier_id uuid,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    movement_number text NOT NULL,
    movement_date timestamp with time zone DEFAULT now(),
    movement_type text NOT NULL,
    stock_item_id uuid NOT NULL,
    quantity integer NOT NULL,
    unit_price bigint,
    total_value bigint,
    from_warehouse_id uuid,
    to_warehouse_id uuid,
    reference_type text,
    reference_id uuid,
    vehicle_id uuid,
    maintenance_order_id uuid,
    notes text,
    performed_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT stock_movements_movement_type_check CHECK ((movement_type = ANY (ARRAY['entry'::text, 'exit'::text, 'transfer'::text, 'adjustment'::text, 'return'::text])))
);


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_number text NOT NULL,
    supplier_type text NOT NULL,
    company_name text NOT NULL,
    contact_name text,
    email text,
    phone text,
    address text,
    payment_terms text,
    credit_limit bigint,
    rating integer,
    notes text,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT suppliers_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT suppliers_supplier_type_check CHECK ((supplier_type = ANY (ARRAY['parts'::text, 'tires'::text, 'fuel'::text, 'services'::text, 'other'::text])))
);


--
-- Name: sustainability_kpis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sustainability_kpis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kpi_date date DEFAULT CURRENT_DATE,
    period_type text,
    total_co2_emissions_kg numeric(12,2),
    co2_per_tonne_km numeric(8,4),
    total_fuel_consumed_liters numeric(12,2),
    fuel_efficiency_l_per_100km numeric(5,2),
    empty_km_percentage numeric(5,2),
    eco_driving_avg_score numeric(3,2),
    environmental_incidents_count integer DEFAULT 0,
    waste_recycled_percentage numeric(5,2),
    compliance_score numeric(3,2),
    water_consumption_liters numeric(10,2),
    noise_pollution_events integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sustainability_kpis_period_type_check CHECK ((period_type = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'quarterly'::text, 'yearly'::text])))
);


--
-- Name: system_parameters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_parameters (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    param_key text NOT NULL,
    param_value text,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: task_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    vehicle_id uuid NOT NULL,
    driver_id uuid,
    loader_id uuid,
    assigned_at timestamp with time zone DEFAULT now(),
    assignment_type text NOT NULL,
    allocation_score numeric(5,2),
    allocation_reason text,
    status text DEFAULT 'assigned'::text NOT NULL,
    performance_rating numeric(3,2),
    completed_cycles integer DEFAULT 0,
    total_tonnage_moved numeric(10,2) DEFAULT 0,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT task_assignments_assignment_type_check CHECK ((assignment_type = ANY (ARRAY['primary'::text, 'support'::text, 'backup'::text]))),
    CONSTRAINT task_assignments_status_check CHECK ((status = ANY (ARRAY['assigned'::text, 'accepted'::text, 'in_progress'::text, 'completed'::text, 'reassigned'::text, 'cancelled'::text])))
);


--
-- Name: tco_analysis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tco_analysis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_id uuid,
    analysis_period_months integer NOT NULL,
    acquisition_cost numeric(12,2) DEFAULT 0,
    depreciation numeric(12,2) DEFAULT 0,
    fuel_cost numeric(12,2) DEFAULT 0,
    maintenance_cost numeric(12,2) DEFAULT 0,
    insurance_cost numeric(12,2) DEFAULT 0,
    registration_cost numeric(12,2) DEFAULT 0,
    financing_cost numeric(12,2) DEFAULT 0,
    downtime_cost numeric(12,2) DEFAULT 0,
    accident_cost numeric(12,2) DEFAULT 0,
    other_costs numeric(12,2) DEFAULT 0,
    total_cost numeric(12,2) NOT NULL,
    cost_per_km numeric(10,4),
    cost_per_day numeric(10,2),
    cost_per_trip numeric(10,2),
    utilization_rate numeric(5,2),
    efficiency_rating text,
    benchmark_comparison numeric(5,2),
    recommendations jsonb DEFAULT '[]'::jsonb,
    period_start date NOT NULL,
    period_end date NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tco_analysis_efficiency_rating_check CHECK ((efficiency_rating = ANY (ARRAY['excellent'::text, 'good'::text, 'average'::text, 'below_average'::text, 'poor'::text])))
);


--
-- Name: tire_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alert_type text NOT NULL,
    severity text DEFAULT 'medium'::text,
    site_id uuid,
    tire_id uuid,
    tire_model_id uuid,
    message text NOT NULL,
    threshold_value numeric,
    current_value numeric,
    is_acknowledged boolean DEFAULT false,
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tire_alerts_alert_type_check CHECK ((alert_type = ANY (ARRAY['low_stock'::text, 'reorder_point'::text, 'warranty_expiry'::text, 'max_retreads'::text, 'lot_failure'::text, 'overdue_inspection'::text]))),
    CONSTRAINT tire_alerts_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])))
);


--
-- Name: tire_brands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_brands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    country_origin text,
    website text,
    contact_email text,
    contact_phone text,
    is_active boolean DEFAULT true,
    average_quality_rating numeric(3,2) DEFAULT 0,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tire_cost_analysis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_cost_analysis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    analysis_period_start date NOT NULL,
    analysis_period_end date NOT NULL,
    vehicle_id uuid,
    site_id uuid,
    total_tires_used integer DEFAULT 0,
    total_km_traveled numeric(15,2) DEFAULT 0,
    total_purchase_cost_gnf numeric(15,2) DEFAULT 0,
    total_maintenance_cost_gnf numeric(15,2) DEFAULT 0,
    total_cost_gnf numeric(15,2) DEFAULT 0,
    cost_per_km_gnf numeric(10,2),
    cost_per_tire_gnf numeric(15,2),
    average_lifetime_km numeric(10,2),
    average_days_in_service integer,
    vs_budget_percentage numeric(5,2),
    vs_previous_period_percentage numeric(5,2),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: tire_dismounting_operations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_dismounting_operations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tire_id uuid,
    mounting_operation_id uuid,
    vehicle_id uuid,
    dismounting_date timestamp with time zone DEFAULT now(),
    dismounting_reason text NOT NULL,
    technician_id uuid,
    days_in_service integer,
    total_trips_count integer,
    total_tonnage_transported numeric,
    total_kilometers numeric,
    final_tread_depth_mm numeric,
    final_pressure_psi numeric,
    wear_percentage numeric,
    physical_condition text,
    anomalies jsonb,
    can_be_retreaded boolean DEFAULT false,
    disposal_method text,
    inspection_notes text,
    photo_url text,
    gps_latitude numeric,
    gps_longitude numeric,
    site_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tire_inspections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_inspections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tire_id uuid,
    vehicle_id uuid,
    inspector_user_id text,
    inspection_date timestamp with time zone DEFAULT now() NOT NULL,
    inspection_type text DEFAULT 'daily'::text NOT NULL,
    pressure_psi integer,
    temperature_celsius numeric(5,2),
    tread_depth_mm numeric(5,2),
    visual_condition text DEFAULT 'good'::text,
    has_cracks boolean DEFAULT false,
    has_cuts boolean DEFAULT false,
    has_bulges boolean DEFAULT false,
    has_punctures boolean DEFAULT false,
    has_uneven_wear boolean DEFAULT false,
    anomalies_detected text[],
    severity text DEFAULT 'info'::text,
    action_required text DEFAULT 'none'::text,
    recommended_action_date date,
    latitude numeric(10,8),
    longitude numeric(11,8),
    location_name text,
    photos jsonb,
    inspector_signature text,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: tire_installations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_installations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tire_id uuid,
    vehicle_id uuid,
    site_id uuid,
    "position" text NOT NULL,
    install_date timestamp with time zone DEFAULT now(),
    odometer_install bigint,
    engine_hours_install numeric(10,2),
    estimated_tonnage_tonnes numeric(10,2),
    operator_id uuid,
    installation_photo_url text,
    pressure_psi numeric(5,2),
    notes text,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tire_installations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'removed'::text, 'failed'::text])))
);


--
-- Name: tire_inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_inventory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid,
    tire_model_id uuid,
    quantity integer DEFAULT 0,
    location_code text,
    condition text DEFAULT 'new'::text,
    minimum_stock integer DEFAULT 0,
    reorder_point integer DEFAULT 0,
    last_counted_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tire_inventory_condition_check CHECK ((condition = ANY (ARRAY['new'::text, 'used'::text, 'retreaded'::text, 'damaged'::text])))
);


--
-- Name: tire_maintenance_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_maintenance_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    installation_id uuid,
    event_type text NOT NULL,
    event_date timestamp with time zone DEFAULT now(),
    pressure_before_psi numeric(5,2),
    pressure_after_psi numeric(5,2),
    tread_depth_mm numeric(4,2),
    findings text,
    actions_taken text,
    cost numeric(10,2),
    technician_id uuid,
    photos jsonb,
    next_check_date date,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tire_maintenance_events_event_type_check CHECK ((event_type = ANY (ARRAY['rotation'::text, 'pressure_check'::text, 'inspection'::text, 'repair'::text, 'balancing'::text])))
);


--
-- Name: tire_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_id uuid,
    model_name text NOT NULL,
    sku text,
    dimension text,
    load_index integer,
    speed_rating text,
    pattern_type text,
    price_unit numeric(10,2),
    max_retreads integer DEFAULT 2,
    warranty_days integer DEFAULT 365,
    recommended_pressure_psi numeric(5,2),
    specs jsonb,
    created_at timestamp with time zone DEFAULT now(),
    brand_id uuid,
    unit_cost_gnf numeric(15,2),
    unit_cost_usd numeric(10,2),
    estimated_lifetime_km integer,
    recommended_usage text DEFAULT 'mining_heavy'::text
);


--
-- Name: tire_mounting_operations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_mounting_operations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tire_id uuid,
    vehicle_id uuid,
    "position" text NOT NULL,
    mounting_date timestamp with time zone DEFAULT now(),
    technician_id uuid,
    technician_signature text,
    initial_pressure_psi numeric,
    initial_tread_depth_mm numeric,
    torque_value_nm numeric,
    qr_code text,
    rfid_tag text,
    quality_check_passed boolean DEFAULT false,
    mounting_notes text,
    photo_before_url text,
    photo_after_url text,
    gps_latitude numeric,
    gps_longitude numeric,
    site_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tire_performance_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_performance_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tire_id uuid,
    calculation_date timestamp with time zone DEFAULT now(),
    service_start_date date,
    service_end_date date,
    days_in_service integer,
    hours_in_service numeric,
    total_trips integer,
    total_kilometers numeric,
    total_tonnage_transported numeric,
    average_load_per_trip numeric,
    purchase_price_gnf numeric,
    cost_per_day numeric,
    cost_per_km numeric,
    cost_per_ton numeric,
    cost_per_trip numeric,
    average_wear_rate numeric,
    fuel_efficiency_impact numeric,
    downtime_hours numeric,
    number_of_repairs integer,
    repair_cost_total numeric,
    overall_performance_score numeric,
    reliability_score numeric,
    cost_effectiveness_score numeric,
    vehicle_type text,
    terrain_type text,
    climate_conditions text,
    site_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: tire_po_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_po_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    po_id uuid,
    tire_model_id uuid,
    quantity_ordered integer NOT NULL,
    quantity_received integer DEFAULT 0,
    unit_price numeric(10,2),
    lot_code text,
    expected_date date,
    received_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: tire_purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    po_number text NOT NULL,
    supplier_id uuid,
    site_id uuid,
    order_date date DEFAULT CURRENT_DATE,
    expected_delivery_date date,
    actual_delivery_date date,
    status text DEFAULT 'draft'::text,
    total_amount numeric(12,2),
    currency text DEFAULT 'GNF'::text,
    documents jsonb,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tire_purchase_orders_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'partial_received'::text, 'received'::text, 'cancelled'::text])))
);


--
-- Name: tire_purchase_recommendations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_purchase_recommendations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_type text NOT NULL,
    terrain_type text NOT NULL,
    site_id uuid,
    expected_load_tons numeric,
    expected_monthly_usage_km numeric,
    recommended_supplier_id uuid,
    recommended_brand text,
    recommended_model text,
    recommended_quantity integer,
    confidence_score numeric,
    reasoning jsonb,
    expected_lifespan_days integer,
    expected_cost_per_ton numeric,
    expected_total_cost_gnf numeric,
    recommended_purchase_date date,
    budget_allocated_gnf numeric,
    alternative_options jsonb,
    generated_by text DEFAULT 'ai_engine'::text,
    generated_at timestamp with time zone DEFAULT now(),
    approved_by uuid,
    approval_date timestamp with time zone,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tire_quality_controls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_quality_controls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tire_id uuid,
    vehicle_id uuid,
    control_date timestamp with time zone DEFAULT now(),
    control_type text NOT NULL,
    pressure_psi numeric,
    tread_depth_mm numeric,
    temperature_celsius numeric,
    sidewall_condition text,
    tread_condition text,
    bead_condition text,
    defects_found jsonb,
    severity text,
    action_required text,
    inspector_id uuid,
    inspector_signature text,
    photos jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: tire_removals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_removals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    installation_id uuid,
    removal_date timestamp with time zone DEFAULT now(),
    odometer_removal bigint,
    engine_hours_removal numeric(10,2),
    total_tonnage_tonnes numeric(12,2),
    total_km numeric(10,2),
    removal_reason text NOT NULL,
    tire_condition text,
    tread_depth_mm numeric(4,2),
    damage_photos jsonb,
    repair_cost numeric(10,2),
    is_retreaded boolean DEFAULT false,
    operator_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: tire_retreads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_retreads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tire_id uuid,
    removal_id uuid,
    retread_date date,
    retread_supplier text,
    retread_cost numeric(10,2),
    quality_score numeric(3,2),
    tread_depth_new_mm numeric(4,2),
    warranty_days integer DEFAULT 180,
    photos jsonb,
    notes text,
    success boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: tire_rotations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_rotations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tire_id uuid,
    vehicle_id uuid,
    rotation_date timestamp with time zone DEFAULT now(),
    from_position text NOT NULL,
    to_position text NOT NULL,
    reason text,
    technician_id uuid,
    odometer_reading numeric,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: tire_sensor_readings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_sensor_readings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sensor_id uuid,
    tire_id uuid,
    vehicle_id uuid,
    reading_time timestamp with time zone DEFAULT now() NOT NULL,
    pressure_psi integer NOT NULL,
    temperature_celsius numeric(5,2),
    alert_generated boolean DEFAULT false,
    alert_type text,
    latitude numeric(10,8),
    longitude numeric(11,8),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: tire_sensors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_sensors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tire_id uuid,
    sensor_serial text NOT NULL,
    sensor_type text DEFAULT 'TPMS'::text,
    last_reading_time timestamp with time zone,
    last_pressure_psi integer,
    last_temperature_celsius numeric(5,2),
    battery_level_percent integer DEFAULT 100,
    has_active_alert boolean DEFAULT false,
    alert_type text,
    alert_since timestamp with time zone,
    is_active boolean DEFAULT true,
    installation_date date DEFAULT CURRENT_DATE,
    last_maintenance_date date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tire_stock_forecasts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_stock_forecasts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    forecast_date date NOT NULL,
    forecast_period_months integer DEFAULT 12,
    tire_brand text,
    tire_model text,
    tire_size text,
    vehicle_type text,
    current_stock_quantity integer,
    current_in_use_quantity integer,
    expected_monthly_consumption numeric,
    expected_total_consumption integer,
    recommended_minimum_stock integer,
    recommended_purchase_quantity integer,
    estimated_stockout_date date,
    recommended_order_date date,
    lead_time_days integer,
    estimated_unit_price_gnf numeric,
    estimated_total_budget_gnf numeric,
    based_on_avg_lifespan_days integer,
    based_on_fleet_size integer,
    based_on_expected_tonnage numeric,
    confidence_level numeric,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: tire_supplier_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_supplier_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_id uuid,
    brand_name text,
    model_name text,
    evaluation_period_start date,
    evaluation_period_end date,
    sample_size integer,
    avg_days_in_service numeric,
    avg_kilometers numeric,
    avg_tonnage_transported numeric,
    avg_purchase_price_gnf numeric,
    avg_cost_per_ton numeric,
    avg_cost_per_km numeric,
    failure_rate numeric,
    avg_number_of_repairs numeric,
    premature_failure_count integer,
    durability_score numeric,
    cost_efficiency_score numeric,
    reliability_score numeric,
    overall_score numeric,
    ranking_position integer,
    star_rating integer,
    is_recommended boolean DEFAULT false,
    recommendation_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tire_suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    contact_info jsonb,
    is_local_importer boolean DEFAULT false,
    lead_time_port_to_site_days integer DEFAULT 30,
    quality_rating numeric(3,2),
    notes text,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tire_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tire_id uuid,
    from_site_id uuid,
    to_site_id uuid,
    transfer_date timestamp with time zone DEFAULT now(),
    quantity integer DEFAULT 1,
    reason text,
    transport_ref text,
    received_date timestamp with time zone,
    received_by uuid,
    status text DEFAULT 'pending'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tire_transfers_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_transit'::text, 'received'::text, 'cancelled'::text])))
);


--
-- Name: tire_usage_analysis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_usage_analysis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    analysis_date date NOT NULL,
    period_start date,
    period_end date,
    analysis_type text NOT NULL,
    segment_name text,
    segment_id uuid,
    total_tires_analyzed integer,
    avg_lifespan_days numeric,
    avg_tonnage_per_tire numeric,
    avg_cost_per_ton numeric,
    vs_company_average_percent numeric,
    vs_best_in_class_percent numeric,
    best_tire_model text,
    best_tire_score numeric,
    worst_tire_model text,
    worst_tire_score numeric,
    key_findings jsonb,
    recommendations jsonb,
    trend_direction text,
    trend_percentage numeric,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: tire_usage_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_usage_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    installation_id uuid,
    trip_id uuid,
    log_date date DEFAULT CURRENT_DATE,
    distance_km numeric(10,2),
    tonnage_tonnes numeric(10,2),
    route_type text,
    season text,
    avg_speed_kmh numeric(5,2),
    road_condition_score integer,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tire_usage_logs_road_condition_score_check CHECK (((road_condition_score >= 1) AND (road_condition_score <= 5))),
    CONSTRAINT tire_usage_logs_route_type_check CHECK ((route_type = ANY (ARRAY['piste'::text, 'route'::text, 'asphalte'::text]))),
    CONSTRAINT tire_usage_logs_season_check CHECK ((season = ANY (ARRAY['pluies'::text, 'seche'::text])))
);


--
-- Name: tire_usage_zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_usage_zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    zone_name text NOT NULL,
    site_id uuid,
    center_latitude numeric(10,8) NOT NULL,
    center_longitude numeric(11,8) NOT NULL,
    radius_meters integer DEFAULT 5000,
    polygon_coordinates jsonb,
    terrain_type text DEFAULT 'mixed'::text,
    road_condition text DEFAULT 'fair'::text,
    slope_percentage numeric(5,2) DEFAULT 0,
    dust_level text DEFAULT 'medium'::text,
    average_wear_rate_mm_per_1000km numeric(5,2) DEFAULT 0,
    puncture_incident_count integer DEFAULT 0,
    temperature_avg_celsius numeric(5,2),
    is_high_risk_zone boolean DEFAULT false,
    risk_level text DEFAULT 'low'::text,
    recommended_pressure_psi integer,
    recommended_speed_limit_kmh integer,
    recommended_tire_types text[],
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tire_work_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tire_work_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_number text NOT NULL,
    tire_id uuid,
    vehicle_id uuid,
    order_type text DEFAULT 'inspection'::text NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    assigned_to_user_id text,
    requested_by_user_id text,
    requested_date timestamp with time zone DEFAULT now() NOT NULL,
    scheduled_date timestamp with time zone,
    started_date timestamp with time zone,
    completed_date timestamp with time zone,
    description text,
    work_performed text,
    parts_used jsonb,
    labor_hours numeric(5,2),
    parts_cost_gnf numeric(15,2) DEFAULT 0,
    labor_cost_gnf numeric(15,2) DEFAULT 0,
    total_cost_gnf numeric(15,2) GENERATED ALWAYS AS ((parts_cost_gnf + labor_cost_gnf)) STORED,
    before_photos jsonb,
    after_photos jsonb,
    technician_signature text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tires; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tires (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tire_number text NOT NULL,
    brand text NOT NULL,
    model text NOT NULL,
    purchase_date date DEFAULT CURRENT_DATE NOT NULL,
    purchase_price bigint DEFAULT 0 NOT NULL,
    supplier_id uuid,
    installation_date date,
    removal_date date,
    initial_km integer,
    final_km integer,
    "position" text,
    status text DEFAULT 'stored'::text NOT NULL,
    vehicle_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tire_model_id uuid,
    lot_code text,
    country_origin text,
    retread_count integer DEFAULT 0,
    max_retreads integer DEFAULT 2,
    warranty_days integer DEFAULT 365,
    import_documents jsonb,
    qr_code text,
    rfid_code text,
    health_score integer DEFAULT 100,
    current_pressure_psi integer,
    current_temperature_celsius numeric(5,2),
    purchase_cost_gnf numeric(15,2),
    purchase_cost_usd numeric(10,2),
    total_maintenance_cost_gnf numeric(15,2) DEFAULT 0,
    last_inspection_date date,
    photos jsonb,
    CONSTRAINT tires_status_check CHECK ((status = ANY (ARRAY['active'::text, 'stored'::text, 'retired'::text, 'damaged'::text])))
);


--
-- Name: tracking_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tracking_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_id uuid NOT NULL,
    driver_id uuid,
    trip_id uuid,
    event_type text NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    latitude numeric(10,8),
    longitude numeric(11,8),
    geofence_id uuid,
    speed integer,
    details jsonb,
    severity text DEFAULT 'info'::text,
    acknowledged boolean DEFAULT false,
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tracking_events_event_type_check CHECK ((event_type = ANY (ARRAY['geofence_entry'::text, 'geofence_exit'::text, 'speed_violation'::text, 'harsh_braking'::text, 'harsh_acceleration'::text, 'idle_excessive'::text, 'route_deviation'::text, 'offline'::text, 'online'::text, 'engine_on'::text, 'engine_off'::text]))),
    CONSTRAINT tracking_events_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text])))
);


--
-- Name: trailers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trailers (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    registration text NOT NULL,
    capacity_tonnes numeric NOT NULL,
    status public.vehicle_status DEFAULT 'active'::public.vehicle_status,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: training_needs_analysis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_needs_analysis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    driver_id uuid,
    analysis_date date NOT NULL,
    skill_gaps jsonb DEFAULT '[]'::jsonb,
    priority_areas jsonb DEFAULT '[]'::jsonb,
    recommended_courses jsonb DEFAULT '[]'::jsonb,
    estimated_training_duration_hours integer,
    estimated_training_cost numeric(10,2),
    expected_improvement_score integer,
    urgency_level text,
    completion_deadline date,
    status text DEFAULT 'pending'::text,
    training_provider text,
    scheduled_date date,
    completed_date date,
    post_training_score integer,
    effectiveness_rating integer,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT training_needs_analysis_effectiveness_rating_check CHECK (((effectiveness_rating >= 1) AND (effectiveness_rating <= 5))),
    CONSTRAINT training_needs_analysis_expected_improvement_score_check CHECK (((expected_improvement_score >= 0) AND (expected_improvement_score <= 100))),
    CONSTRAINT training_needs_analysis_post_training_score_check CHECK (((post_training_score >= 0) AND (post_training_score <= 100))),
    CONSTRAINT training_needs_analysis_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'scheduled'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text]))),
    CONSTRAINT training_needs_analysis_urgency_level_check CHECK ((urgency_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])))
);


--
-- Name: trip_route_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trip_route_tracking (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trip_id uuid NOT NULL,
    vehicle_id uuid NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    current_latitude numeric NOT NULL,
    current_longitude numeric NOT NULL,
    next_waypoint_id uuid,
    distance_to_next_waypoint_km numeric,
    estimated_arrival_time timestamp with time zone,
    progress_percentage numeric,
    speed_kmh numeric,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT trip_route_tracking_progress_percentage_check CHECK (((progress_percentage >= (0)::numeric) AND (progress_percentage <= (100)::numeric)))
);


--
-- Name: trip_routes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trip_routes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trip_id uuid,
    vehicle_id uuid,
    sequence_number integer NOT NULL,
    latitude numeric NOT NULL,
    longitude numeric NOT NULL,
    speed_kmh numeric DEFAULT 0,
    heading numeric DEFAULT 0,
    altitude numeric,
    "timestamp" timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: trip_waypoints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trip_waypoints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trip_id uuid NOT NULL,
    sequence_number integer NOT NULL,
    waypoint_type text NOT NULL,
    site_id uuid,
    location_name text NOT NULL,
    latitude numeric NOT NULL,
    longitude numeric NOT NULL,
    planned_arrival_time timestamp with time zone,
    actual_arrival_time timestamp with time zone,
    departure_time timestamp with time zone,
    distance_from_previous_km numeric,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT trip_waypoints_waypoint_type_check CHECK ((waypoint_type = ANY (ARRAY['departure'::text, 'intermediate'::text, 'arrival'::text])))
);


--
-- Name: user_activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    module text NOT NULL,
    can_view boolean DEFAULT false,
    can_create boolean DEFAULT false,
    can_edit boolean DEFAULT false,
    can_delete boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    language text DEFAULT 'fr'::text,
    theme text DEFAULT 'light'::text,
    notifications_enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_preferences_language_check CHECK ((language = ANY (ARRAY['fr'::text, 'en'::text]))),
    CONSTRAINT user_preferences_theme_check CHECK ((theme = ANY (ARRAY['light'::text, 'dark'::text, 'auto'::text])))
);


--
-- Name: vehicle_availability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicle_availability (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_id uuid,
    date date DEFAULT CURRENT_DATE,
    status text DEFAULT 'available'::text,
    current_location jsonb,
    fuel_level numeric(5,2),
    load_capacity_available numeric(10,2),
    next_maintenance_km integer,
    health_score numeric(3,2),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT vehicle_availability_status_check CHECK ((status = ANY (ARRAY['available'::text, 'in_mission'::text, 'maintenance'::text, 'unavailable'::text])))
);


--
-- Name: vehicle_costs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicle_costs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_id uuid NOT NULL,
    cost_period date NOT NULL,
    fuel_cost bigint DEFAULT 0,
    maintenance_cost bigint DEFAULT 0,
    tire_cost bigint DEFAULT 0,
    insurance_cost bigint DEFAULT 0,
    other_costs bigint DEFAULT 0,
    total_cost bigint DEFAULT 0,
    distance_traveled integer DEFAULT 0,
    cost_per_km numeric(10,2),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: vehicle_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicle_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_id uuid NOT NULL,
    document_type text NOT NULL,
    document_name text NOT NULL,
    reference_number text,
    issue_date date,
    expiry_date date,
    file_name text,
    file_url text,
    file_type text,
    file_size integer,
    status text DEFAULT 'active'::text NOT NULL,
    provider text,
    cost bigint DEFAULT 0,
    notes text,
    uploaded_by uuid,
    uploaded_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT vehicle_documents_document_type_check CHECK ((document_type = ANY (ARRAY['insurance'::text, 'registration'::text, 'technical_inspection'::text, 'transport_license'::text, 'circulation_permit'::text, 'tax_vignette'::text, 'authorization'::text, 'other'::text]))),
    CONSTRAINT vehicle_documents_status_check CHECK ((status = ANY (ARRAY['active'::text, 'expired'::text, 'pending_renewal'::text, 'archived'::text])))
);


--
-- Name: TABLE vehicle_documents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.vehicle_documents IS 'Stores all vehicle-related documents including insurance, registration, technical inspections, and permits';


--
-- Name: vehicle_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicle_tracking (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_id uuid NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    latitude numeric(10,8),
    longitude numeric(11,8),
    speed integer DEFAULT 0,
    heading integer,
    altitude integer,
    accuracy integer,
    engine_status text DEFAULT 'off'::text,
    ignition_status boolean DEFAULT false,
    odometer integer,
    fuel_level integer,
    fuel_rate integer,
    driver_id uuid,
    trip_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT vehicle_tracking_engine_status_check CHECK ((engine_status = ANY (ARRAY['on'::text, 'off'::text])))
);


--
-- Name: vehicle_upgrade_recommendations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicle_upgrade_recommendations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_id uuid,
    recommendation_type text,
    current_vehicle_age_years numeric(5,2),
    current_total_cost numeric(12,2),
    current_efficiency_score integer,
    recommended_action text NOT NULL,
    recommended_vehicle_type text,
    estimated_investment numeric(12,2),
    estimated_annual_savings numeric(12,2),
    roi_period_months integer,
    payback_period_months integer,
    environmental_impact_improvement numeric(5,2),
    reliability_improvement numeric(5,2),
    justification text,
    urgency_score integer,
    supporting_data jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    reviewed_at timestamp with time zone,
    implemented_at timestamp with time zone,
    CONSTRAINT vehicle_upgrade_recommendations_current_efficiency_score_check CHECK (((current_efficiency_score >= 0) AND (current_efficiency_score <= 100))),
    CONSTRAINT vehicle_upgrade_recommendations_recommendation_type_check CHECK ((recommendation_type = ANY (ARRAY['replace'::text, 'upgrade'::text, 'retrofit'::text, 'retire'::text]))),
    CONSTRAINT vehicle_upgrade_recommendations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'under_review'::text, 'approved'::text, 'rejected'::text, 'implemented'::text]))),
    CONSTRAINT vehicle_upgrade_recommendations_urgency_score_check CHECK (((urgency_score >= 0) AND (urgency_score <= 100)))
);


--
-- Name: vehicles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicles (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    registration text NOT NULL,
    brand_model text NOT NULL,
    year integer,
    capacity_tonnes numeric NOT NULL,
    vehicle_type text NOT NULL,
    chassis_number text,
    current_km numeric DEFAULT 0,
    status public.vehicle_status DEFAULT 'active'::public.vehicle_status,
    site_id uuid,
    purchase_cost numeric DEFAULT 0,
    current_value numeric DEFAULT 0,
    insurance_expiry date,
    technical_inspection_expiry date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    gps_device_id text,
    gps_device_active boolean DEFAULT false,
    CONSTRAINT vehicles_vehicle_type_check CHECK ((vehicle_type = ANY (ARRAY['tipper'::text, 'tanker'::text, 'flatbed'::text, 'loader'::text, 'excavator'::text, 'pickup'::text, 'bus'::text, 'tow_truck'::text])))
);


--
-- Name: COLUMN vehicles.brand_model; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vehicles.brand_model IS 'Marque et modèle du véhicule. Le parc utilise principalement des marques chinoises (XCMG, SANY, LiuGong, Sinotruk, Shacman, Beiben, FAW, Dongfeng) couramment utilisées dans les mines guinéennes, avec quelques marques occidentales.';


--
-- Name: warehouses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    warehouse_type text NOT NULL,
    location text,
    manager_name text,
    phone text,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT warehouses_warehouse_type_check CHECK ((warehouse_type = ANY (ARRAY['main'::text, 'garage'::text, 'fuel_station'::text, 'depot'::text])))
);


--
-- Name: waste_management; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waste_management (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    waste_date date DEFAULT CURRENT_DATE,
    waste_type text,
    quantity numeric(10,2),
    unit text DEFAULT 'kg'::text,
    source_vehicle_id uuid,
    disposal_method text,
    disposal_location text,
    disposal_partner text,
    cost numeric(10,2),
    certificate_number text,
    environmental_impact_reduction jsonb,
    status text DEFAULT 'collected'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT waste_management_disposal_method_check CHECK ((disposal_method = ANY (ARRAY['recycling'::text, 'authorized_disposal'::text, 'reuse'::text, 'energy_recovery'::text]))),
    CONSTRAINT waste_management_status_check CHECK ((status = ANY (ARRAY['collected'::text, 'in_transit'::text, 'disposed'::text, 'verified'::text]))),
    CONSTRAINT waste_management_waste_type_check CHECK ((waste_type = ANY (ARRAY['used_tires'::text, 'used_oil'::text, 'filters'::text, 'batteries'::text, 'parts'::text, 'other'::text])))
);


--
-- Name: weighings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weighings (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    trip_id uuid,
    scale_id text,
    weighing_time timestamp with time zone DEFAULT now(),
    gross_weight numeric,
    tare_weight numeric,
    net_weight numeric,
    ticket_number text,
    operator_name text,
    client_signature text,
    photo_url text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: alert_notifications alert_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_notifications
    ADD CONSTRAINT alert_notifications_pkey PRIMARY KEY (id);


--
-- Name: alert_rules alert_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_pkey PRIMARY KEY (id);


--
-- Name: alert_subscriptions alert_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_subscriptions
    ADD CONSTRAINT alert_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: alert_thresholds alert_thresholds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_thresholds
    ADD CONSTRAINT alert_thresholds_pkey PRIMARY KEY (id);


--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- Name: attendance attendance_employee_id_attendance_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_employee_id_attendance_date_key UNIQUE (employee_id, attendance_date);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- Name: benchmark_comparisons benchmark_comparisons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.benchmark_comparisons
    ADD CONSTRAINT benchmark_comparisons_pkey PRIMARY KEY (id);


--
-- Name: carbon_emissions carbon_emissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carbon_emissions
    ADD CONSTRAINT carbon_emissions_pkey PRIMARY KEY (id);


--
-- Name: carbon_footprint_tracking carbon_footprint_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carbon_footprint_tracking
    ADD CONSTRAINT carbon_footprint_tracking_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: compliance_reports compliance_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_reports
    ADD CONSTRAINT compliance_reports_pkey PRIMARY KEY (id);


--
-- Name: cost_categories cost_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_categories
    ADD CONSTRAINT cost_categories_name_key UNIQUE (name);


--
-- Name: cost_categories cost_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_categories
    ADD CONSTRAINT cost_categories_pkey PRIMARY KEY (id);


--
-- Name: custom_dashboards custom_dashboards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_dashboards
    ADD CONSTRAINT custom_dashboards_pkey PRIMARY KEY (id);


--
-- Name: customers customers_customer_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_customer_number_key UNIQUE (customer_number);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: cycle_tracking cycle_tracking_assignment_id_cycle_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cycle_tracking
    ADD CONSTRAINT cycle_tracking_assignment_id_cycle_number_key UNIQUE (assignment_id, cycle_number);


--
-- Name: cycle_tracking cycle_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cycle_tracking
    ADD CONSTRAINT cycle_tracking_pkey PRIMARY KEY (id);


--
-- Name: deliveries deliveries_delivery_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_delivery_number_key UNIQUE (delivery_number);


--
-- Name: deliveries deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_pkey PRIMARY KEY (id);


--
-- Name: dispatch_assignments dispatch_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_assignments
    ADD CONSTRAINT dispatch_assignments_pkey PRIMARY KEY (id);


--
-- Name: dispatch_rules dispatch_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_rules
    ADD CONSTRAINT dispatch_rules_pkey PRIMARY KEY (id);


--
-- Name: dispatch_simulations dispatch_simulations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_simulations
    ADD CONSTRAINT dispatch_simulations_pkey PRIMARY KEY (id);


--
-- Name: documents documents_document_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_document_number_key UNIQUE (document_number);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: driver_availability driver_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_availability
    ADD CONSTRAINT driver_availability_pkey PRIMARY KEY (id);


--
-- Name: driver_behavior_scores driver_behavior_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_behavior_scores
    ADD CONSTRAINT driver_behavior_scores_pkey PRIMARY KEY (id);


--
-- Name: driver_work_sessions driver_work_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_work_sessions
    ADD CONSTRAINT driver_work_sessions_pkey PRIMARY KEY (id);


--
-- Name: drivers drivers_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_employee_id_key UNIQUE (employee_id);


--
-- Name: drivers drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_pkey PRIMARY KEY (id);


--
-- Name: driving_time_regulations driving_time_regulations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driving_time_regulations
    ADD CONSTRAINT driving_time_regulations_pkey PRIMARY KEY (id);


--
-- Name: eco_driving_scores eco_driving_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eco_driving_scores
    ADD CONSTRAINT eco_driving_scores_pkey PRIMARY KEY (id);


--
-- Name: employee_attendance employee_attendance_employee_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_attendance
    ADD CONSTRAINT employee_attendance_employee_id_date_key UNIQUE (employee_id, date);


--
-- Name: employee_attendance employee_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_attendance
    ADD CONSTRAINT employee_attendance_pkey PRIMARY KEY (id);


--
-- Name: employees employees_employee_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_employee_number_key UNIQUE (employee_number);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: environmental_incidents environmental_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.environmental_incidents
    ADD CONSTRAINT environmental_incidents_pkey PRIMARY KEY (id);


--
-- Name: esg_reports esg_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.esg_reports
    ADD CONSTRAINT esg_reports_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_expense_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_expense_number_key UNIQUE (expense_number);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: fatigue_alerts fatigue_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fatigue_alerts
    ADD CONSTRAINT fatigue_alerts_pkey PRIMARY KEY (id);


--
-- Name: fleet_health_scores fleet_health_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fleet_health_scores
    ADD CONSTRAINT fleet_health_scores_pkey PRIMARY KEY (id);


--
-- Name: fleet_tasks fleet_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fleet_tasks
    ADD CONSTRAINT fleet_tasks_pkey PRIMARY KEY (id);


--
-- Name: fleet_tasks fleet_tasks_task_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fleet_tasks
    ADD CONSTRAINT fleet_tasks_task_number_key UNIQUE (task_number);


--
-- Name: fuel_stocks fuel_stocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_stocks
    ADD CONSTRAINT fuel_stocks_pkey PRIMARY KEY (id);


--
-- Name: fuel_stocks fuel_stocks_site_id_fuel_type_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_stocks
    ADD CONSTRAINT fuel_stocks_site_id_fuel_type_id_key UNIQUE (site_id, fuel_type_id);


--
-- Name: fuel_transactions fuel_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_transactions
    ADD CONSTRAINT fuel_transactions_pkey PRIMARY KEY (id);


--
-- Name: fuel_transactions fuel_transactions_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_transactions
    ADD CONSTRAINT fuel_transactions_reference_key UNIQUE (reference);


--
-- Name: fuel_types fuel_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_types
    ADD CONSTRAINT fuel_types_name_key UNIQUE (name);


--
-- Name: fuel_types fuel_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_types
    ADD CONSTRAINT fuel_types_pkey PRIMARY KEY (id);


--
-- Name: geofence_alerts geofence_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geofence_alerts
    ADD CONSTRAINT geofence_alerts_pkey PRIMARY KEY (id);


--
-- Name: geofence_violations geofence_violations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geofence_violations
    ADD CONSTRAINT geofence_violations_pkey PRIMARY KEY (id);


--
-- Name: geofence_zone_assignments geofence_zone_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geofence_zone_assignments
    ADD CONSTRAINT geofence_zone_assignments_pkey PRIMARY KEY (id);


--
-- Name: geofence_zones geofence_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geofence_zones
    ADD CONSTRAINT geofence_zones_pkey PRIMARY KEY (id);


--
-- Name: geofences geofences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geofences
    ADD CONSTRAINT geofences_pkey PRIMARY KEY (id);


--
-- Name: incidents incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_pkey PRIMARY KEY (id);


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: iot_devices iot_devices_api_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_devices
    ADD CONSTRAINT iot_devices_api_key_key UNIQUE (api_key);


--
-- Name: iot_devices iot_devices_device_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_devices
    ADD CONSTRAINT iot_devices_device_id_key UNIQUE (device_id);


--
-- Name: iot_devices iot_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_devices
    ADD CONSTRAINT iot_devices_pkey PRIMARY KEY (id);


--
-- Name: iot_fuel_readings iot_fuel_readings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_fuel_readings
    ADD CONSTRAINT iot_fuel_readings_pkey PRIMARY KEY (id);


--
-- Name: iot_gps_readings iot_gps_readings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_gps_readings
    ADD CONSTRAINT iot_gps_readings_pkey PRIMARY KEY (id);


--
-- Name: iot_tire_readings iot_tire_readings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_tire_readings
    ADD CONSTRAINT iot_tire_readings_pkey PRIMARY KEY (id);


--
-- Name: iot_weight_readings iot_weight_readings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_weight_readings
    ADD CONSTRAINT iot_weight_readings_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: maintenance_orders maintenance_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_orders
    ADD CONSTRAINT maintenance_orders_pkey PRIMARY KEY (id);


--
-- Name: maintenance_orders maintenance_orders_work_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_orders
    ADD CONSTRAINT maintenance_orders_work_order_number_key UNIQUE (work_order_number);


--
-- Name: maintenance_parts maintenance_parts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_parts
    ADD CONSTRAINT maintenance_parts_pkey PRIMARY KEY (id);


--
-- Name: maintenance_schedules maintenance_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_schedules
    ADD CONSTRAINT maintenance_schedules_pkey PRIMARY KEY (id);


--
-- Name: mission_requirements mission_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_requirements
    ADD CONSTRAINT mission_requirements_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: optimization_constraints optimization_constraints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.optimization_constraints
    ADD CONSTRAINT optimization_constraints_pkey PRIMARY KEY (id);


--
-- Name: optimization_history optimization_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.optimization_history
    ADD CONSTRAINT optimization_history_pkey PRIMARY KEY (id);


--
-- Name: optimization_scenarios optimization_scenarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.optimization_scenarios
    ADD CONSTRAINT optimization_scenarios_pkey PRIMARY KEY (id);


--
-- Name: parts_inventory parts_inventory_part_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parts_inventory
    ADD CONSTRAINT parts_inventory_part_reference_key UNIQUE (part_reference);


--
-- Name: parts_inventory parts_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parts_inventory
    ADD CONSTRAINT parts_inventory_pkey PRIMARY KEY (id);


--
-- Name: payments payments_payment_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_payment_number_key UNIQUE (payment_number);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: payroll_bonuses payroll_bonuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_bonuses
    ADD CONSTRAINT payroll_bonuses_pkey PRIMARY KEY (id);


--
-- Name: payroll_deductions payroll_deductions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_deductions
    ADD CONSTRAINT payroll_deductions_pkey PRIMARY KEY (id);


--
-- Name: payroll_items payroll_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_items
    ADD CONSTRAINT payroll_items_pkey PRIMARY KEY (id);


--
-- Name: payroll payroll_payroll_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll
    ADD CONSTRAINT payroll_payroll_number_key UNIQUE (payroll_number);


--
-- Name: payroll payroll_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll
    ADD CONSTRAINT payroll_pkey PRIMARY KEY (id);


--
-- Name: payroll_records payroll_records_employee_id_period_start_period_end_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_records
    ADD CONSTRAINT payroll_records_employee_id_period_start_period_end_key UNIQUE (employee_id, period_start, period_end);


--
-- Name: payroll_records payroll_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_records
    ADD CONSTRAINT payroll_records_pkey PRIMARY KEY (id);


--
-- Name: performance_kpis performance_kpis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_kpis
    ADD CONSTRAINT performance_kpis_pkey PRIMARY KEY (id);


--
-- Name: performance_scores performance_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_scores
    ADD CONSTRAINT performance_scores_pkey PRIMARY KEY (id);


--
-- Name: predictive_maintenance_models predictive_maintenance_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.predictive_maintenance_models
    ADD CONSTRAINT predictive_maintenance_models_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_po_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_po_number_key UNIQUE (po_number);


--
-- Name: quick_actions_log quick_actions_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quick_actions_log
    ADD CONSTRAINT quick_actions_log_pkey PRIMARY KEY (id);


--
-- Name: reoptimization_events reoptimization_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reoptimization_events
    ADD CONSTRAINT reoptimization_events_pkey PRIMARY KEY (id);


--
-- Name: rest_periods rest_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rest_periods
    ADD CONSTRAINT rest_periods_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_role_module_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_module_key UNIQUE (role, module);


--
-- Name: route_optimization_suggestions route_optimization_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route_optimization_suggestions
    ADD CONSTRAINT route_optimization_suggestions_pkey PRIMARY KEY (id);


--
-- Name: scenario_simulations scenario_simulations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_simulations
    ADD CONSTRAINT scenario_simulations_pkey PRIMARY KEY (id);


--
-- Name: settings settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_key_key UNIQUE (key);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: shift_plans shift_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_plans
    ADD CONSTRAINT shift_plans_pkey PRIMARY KEY (id);


--
-- Name: shift_plans shift_plans_plan_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_plans
    ADD CONSTRAINT shift_plans_plan_number_key UNIQUE (plan_number);


--
-- Name: sites sites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_pkey PRIMARY KEY (id);


--
-- Name: smart_notifications smart_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_notifications
    ADD CONSTRAINT smart_notifications_pkey PRIMARY KEY (id);


--
-- Name: spare_parts_catalog spare_parts_catalog_part_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spare_parts_catalog
    ADD CONSTRAINT spare_parts_catalog_part_number_key UNIQUE (part_number);


--
-- Name: spare_parts_catalog spare_parts_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spare_parts_catalog
    ADD CONSTRAINT spare_parts_catalog_pkey PRIMARY KEY (id);


--
-- Name: stock_categories stock_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_categories
    ADD CONSTRAINT stock_categories_name_key UNIQUE (name);


--
-- Name: stock_categories stock_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_categories
    ADD CONSTRAINT stock_categories_pkey PRIMARY KEY (id);


--
-- Name: stock_items stock_items_item_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_items
    ADD CONSTRAINT stock_items_item_code_key UNIQUE (item_code);


--
-- Name: stock_items stock_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_items
    ADD CONSTRAINT stock_items_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_movement_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_movement_number_key UNIQUE (movement_number);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_supplier_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_supplier_number_key UNIQUE (supplier_number);


--
-- Name: sustainability_kpis sustainability_kpis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sustainability_kpis
    ADD CONSTRAINT sustainability_kpis_pkey PRIMARY KEY (id);


--
-- Name: system_parameters system_parameters_param_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_parameters
    ADD CONSTRAINT system_parameters_param_key_key UNIQUE (param_key);


--
-- Name: system_parameters system_parameters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_parameters
    ADD CONSTRAINT system_parameters_pkey PRIMARY KEY (id);


--
-- Name: task_assignments task_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_assignments
    ADD CONSTRAINT task_assignments_pkey PRIMARY KEY (id);


--
-- Name: task_assignments task_assignments_task_id_vehicle_id_assignment_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_assignments
    ADD CONSTRAINT task_assignments_task_id_vehicle_id_assignment_type_key UNIQUE (task_id, vehicle_id, assignment_type);


--
-- Name: tco_analysis tco_analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tco_analysis
    ADD CONSTRAINT tco_analysis_pkey PRIMARY KEY (id);


--
-- Name: tire_alerts tire_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_alerts
    ADD CONSTRAINT tire_alerts_pkey PRIMARY KEY (id);


--
-- Name: tire_brands tire_brands_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_brands
    ADD CONSTRAINT tire_brands_name_key UNIQUE (name);


--
-- Name: tire_brands tire_brands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_brands
    ADD CONSTRAINT tire_brands_pkey PRIMARY KEY (id);


--
-- Name: tire_cost_analysis tire_cost_analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_cost_analysis
    ADD CONSTRAINT tire_cost_analysis_pkey PRIMARY KEY (id);


--
-- Name: tire_dismounting_operations tire_dismounting_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_dismounting_operations
    ADD CONSTRAINT tire_dismounting_operations_pkey PRIMARY KEY (id);


--
-- Name: tire_inspections tire_inspections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_inspections
    ADD CONSTRAINT tire_inspections_pkey PRIMARY KEY (id);


--
-- Name: tire_installations tire_installations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_installations
    ADD CONSTRAINT tire_installations_pkey PRIMARY KEY (id);


--
-- Name: tire_inventory tire_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_inventory
    ADD CONSTRAINT tire_inventory_pkey PRIMARY KEY (id);


--
-- Name: tire_inventory tire_inventory_site_id_tire_model_id_condition_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_inventory
    ADD CONSTRAINT tire_inventory_site_id_tire_model_id_condition_key UNIQUE (site_id, tire_model_id, condition);


--
-- Name: tire_maintenance_events tire_maintenance_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_maintenance_events
    ADD CONSTRAINT tire_maintenance_events_pkey PRIMARY KEY (id);


--
-- Name: tire_models tire_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_models
    ADD CONSTRAINT tire_models_pkey PRIMARY KEY (id);


--
-- Name: tire_models tire_models_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_models
    ADD CONSTRAINT tire_models_sku_key UNIQUE (sku);


--
-- Name: tire_mounting_operations tire_mounting_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_mounting_operations
    ADD CONSTRAINT tire_mounting_operations_pkey PRIMARY KEY (id);


--
-- Name: tire_mounting_operations tire_mounting_operations_qr_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_mounting_operations
    ADD CONSTRAINT tire_mounting_operations_qr_code_key UNIQUE (qr_code);


--
-- Name: tire_performance_metrics tire_performance_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_performance_metrics
    ADD CONSTRAINT tire_performance_metrics_pkey PRIMARY KEY (id);


--
-- Name: tire_po_items tire_po_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_po_items
    ADD CONSTRAINT tire_po_items_pkey PRIMARY KEY (id);


--
-- Name: tire_purchase_orders tire_purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_purchase_orders
    ADD CONSTRAINT tire_purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: tire_purchase_orders tire_purchase_orders_po_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_purchase_orders
    ADD CONSTRAINT tire_purchase_orders_po_number_key UNIQUE (po_number);


--
-- Name: tire_purchase_recommendations tire_purchase_recommendations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_purchase_recommendations
    ADD CONSTRAINT tire_purchase_recommendations_pkey PRIMARY KEY (id);


--
-- Name: tire_quality_controls tire_quality_controls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_quality_controls
    ADD CONSTRAINT tire_quality_controls_pkey PRIMARY KEY (id);


--
-- Name: tire_removals tire_removals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_removals
    ADD CONSTRAINT tire_removals_pkey PRIMARY KEY (id);


--
-- Name: tire_retreads tire_retreads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_retreads
    ADD CONSTRAINT tire_retreads_pkey PRIMARY KEY (id);


--
-- Name: tire_rotations tire_rotations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_rotations
    ADD CONSTRAINT tire_rotations_pkey PRIMARY KEY (id);


--
-- Name: tire_sensor_readings tire_sensor_readings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_sensor_readings
    ADD CONSTRAINT tire_sensor_readings_pkey PRIMARY KEY (id);


--
-- Name: tire_sensors tire_sensors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_sensors
    ADD CONSTRAINT tire_sensors_pkey PRIMARY KEY (id);


--
-- Name: tire_sensors tire_sensors_sensor_serial_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_sensors
    ADD CONSTRAINT tire_sensors_sensor_serial_key UNIQUE (sensor_serial);


--
-- Name: tire_stock_forecasts tire_stock_forecasts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_stock_forecasts
    ADD CONSTRAINT tire_stock_forecasts_pkey PRIMARY KEY (id);


--
-- Name: tire_supplier_scores tire_supplier_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_supplier_scores
    ADD CONSTRAINT tire_supplier_scores_pkey PRIMARY KEY (id);


--
-- Name: tire_suppliers tire_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_suppliers
    ADD CONSTRAINT tire_suppliers_pkey PRIMARY KEY (id);


--
-- Name: tire_transfers tire_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_transfers
    ADD CONSTRAINT tire_transfers_pkey PRIMARY KEY (id);


--
-- Name: tire_usage_analysis tire_usage_analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_usage_analysis
    ADD CONSTRAINT tire_usage_analysis_pkey PRIMARY KEY (id);


--
-- Name: tire_usage_logs tire_usage_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_usage_logs
    ADD CONSTRAINT tire_usage_logs_pkey PRIMARY KEY (id);


--
-- Name: tire_usage_zones tire_usage_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_usage_zones
    ADD CONSTRAINT tire_usage_zones_pkey PRIMARY KEY (id);


--
-- Name: tire_work_orders tire_work_orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_work_orders
    ADD CONSTRAINT tire_work_orders_order_number_key UNIQUE (order_number);


--
-- Name: tire_work_orders tire_work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_work_orders
    ADD CONSTRAINT tire_work_orders_pkey PRIMARY KEY (id);


--
-- Name: tires tires_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tires
    ADD CONSTRAINT tires_pkey PRIMARY KEY (id);


--
-- Name: tires tires_qr_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tires
    ADD CONSTRAINT tires_qr_code_key UNIQUE (qr_code);


--
-- Name: tires tires_rfid_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tires
    ADD CONSTRAINT tires_rfid_code_key UNIQUE (rfid_code);


--
-- Name: tires tires_tire_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tires
    ADD CONSTRAINT tires_tire_number_key UNIQUE (tire_number);


--
-- Name: tracking_events tracking_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracking_events
    ADD CONSTRAINT tracking_events_pkey PRIMARY KEY (id);


--
-- Name: trailers trailers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trailers
    ADD CONSTRAINT trailers_pkey PRIMARY KEY (id);


--
-- Name: trailers trailers_registration_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trailers
    ADD CONSTRAINT trailers_registration_key UNIQUE (registration);


--
-- Name: training_needs_analysis training_needs_analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_needs_analysis
    ADD CONSTRAINT training_needs_analysis_pkey PRIMARY KEY (id);


--
-- Name: trip_route_tracking trip_route_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_route_tracking
    ADD CONSTRAINT trip_route_tracking_pkey PRIMARY KEY (id);


--
-- Name: trip_routes trip_routes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_routes
    ADD CONSTRAINT trip_routes_pkey PRIMARY KEY (id);


--
-- Name: trip_routes trip_routes_trip_id_sequence_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_routes
    ADD CONSTRAINT trip_routes_trip_id_sequence_number_key UNIQUE (trip_id, sequence_number);


--
-- Name: trip_waypoints trip_waypoints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_waypoints
    ADD CONSTRAINT trip_waypoints_pkey PRIMARY KEY (id);


--
-- Name: trip_waypoints trip_waypoints_trip_id_sequence_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_waypoints
    ADD CONSTRAINT trip_waypoints_trip_id_sequence_number_key UNIQUE (trip_id, sequence_number);


--
-- Name: trips trips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_pkey PRIMARY KEY (id);


--
-- Name: trips trips_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_reference_key UNIQUE (reference);


--
-- Name: work_shifts unique_shift_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_shifts
    ADD CONSTRAINT unique_shift_name UNIQUE (name);


--
-- Name: work_shifts unique_shift_order; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_shifts
    ADD CONSTRAINT unique_shift_order UNIQUE (shift_order);


--
-- Name: user_activity_logs user_activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activity_logs
    ADD CONSTRAINT user_activity_logs_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_user_id_module_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_module_key UNIQUE (user_id, module);


--
-- Name: user_preferences user_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_pkey PRIMARY KEY (id);


--
-- Name: user_preferences user_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_key UNIQUE (user_id);


--
-- Name: vehicle_availability vehicle_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_availability
    ADD CONSTRAINT vehicle_availability_pkey PRIMARY KEY (id);


--
-- Name: vehicle_costs vehicle_costs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_costs
    ADD CONSTRAINT vehicle_costs_pkey PRIMARY KEY (id);


--
-- Name: vehicle_costs vehicle_costs_vehicle_id_cost_period_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_costs
    ADD CONSTRAINT vehicle_costs_vehicle_id_cost_period_key UNIQUE (vehicle_id, cost_period);


--
-- Name: vehicle_documents vehicle_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_documents
    ADD CONSTRAINT vehicle_documents_pkey PRIMARY KEY (id);


--
-- Name: vehicle_tracking vehicle_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_tracking
    ADD CONSTRAINT vehicle_tracking_pkey PRIMARY KEY (id);


--
-- Name: vehicle_upgrade_recommendations vehicle_upgrade_recommendations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_upgrade_recommendations
    ADD CONSTRAINT vehicle_upgrade_recommendations_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_registration_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_registration_key UNIQUE (registration);


--
-- Name: warehouses warehouses_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_code_key UNIQUE (code);


--
-- Name: warehouses warehouses_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_name_key UNIQUE (name);


--
-- Name: warehouses warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);


--
-- Name: waste_management waste_management_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste_management
    ADD CONSTRAINT waste_management_pkey PRIMARY KEY (id);


--
-- Name: weighings weighings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weighings
    ADD CONSTRAINT weighings_pkey PRIMARY KEY (id);


--
-- Name: work_shifts work_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_shifts
    ADD CONSTRAINT work_shifts_pkey PRIMARY KEY (id);


--
-- Name: idx_alerts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_status ON public.alerts USING btree (status);


--
-- Name: idx_benchmark_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_benchmark_category ON public.benchmark_comparisons USING btree (comparison_category);


--
-- Name: idx_carbon_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carbon_period ON public.carbon_footprint_tracking USING btree (period_start, period_end);


--
-- Name: idx_carbon_vehicle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carbon_vehicle ON public.carbon_footprint_tracking USING btree (vehicle_id);


--
-- Name: idx_compliance_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_status ON public.compliance_reports USING btree (compliance_status);


--
-- Name: idx_compliance_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_type ON public.compliance_reports USING btree (report_type);


--
-- Name: idx_custom_dashboards_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_dashboards_user ON public.custom_dashboards USING btree (user_id);


--
-- Name: idx_cycle_tracking_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cycle_tracking_assignment ON public.cycle_tracking USING btree (assignment_id);


--
-- Name: idx_cycle_tracking_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cycle_tracking_status ON public.cycle_tracking USING btree (status);


--
-- Name: idx_dispatch_assignments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dispatch_assignments_status ON public.dispatch_assignments USING btree (status);


--
-- Name: idx_documents_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_expiry ON public.documents USING btree (expiry_date);


--
-- Name: idx_driver_availability_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_driver_availability_status ON public.driver_availability USING btree (status);


--
-- Name: idx_driver_behavior_driver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_driver_behavior_driver ON public.driver_behavior_scores USING btree (driver_id);


--
-- Name: idx_driver_behavior_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_driver_behavior_period ON public.driver_behavior_scores USING btree (period_start, period_end);


--
-- Name: idx_drivers_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drivers_employee_id ON public.drivers USING btree (employee_id);


--
-- Name: idx_drivers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drivers_name ON public.drivers USING btree (name);


--
-- Name: idx_ea_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ea_date ON public.employee_attendance USING btree (date DESC);


--
-- Name: idx_ea_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ea_emp ON public.employee_attendance USING btree (employee_id);


--
-- Name: idx_environmental_incidents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_environmental_incidents_status ON public.environmental_incidents USING btree (status);


--
-- Name: idx_expenses_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_date ON public.expenses USING btree (expense_date);


--
-- Name: idx_expenses_vehicle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_vehicle ON public.expenses USING btree (vehicle_id);


--
-- Name: idx_fleet_health_risk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fleet_health_risk ON public.fleet_health_scores USING btree (risk_level);


--
-- Name: idx_fleet_health_vehicle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fleet_health_vehicle ON public.fleet_health_scores USING btree (vehicle_id);


--
-- Name: idx_fleet_tasks_planned_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fleet_tasks_planned_start ON public.fleet_tasks USING btree (planned_start_time);


--
-- Name: idx_fleet_tasks_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fleet_tasks_shift ON public.fleet_tasks USING btree (shift_id);


--
-- Name: idx_fleet_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fleet_tasks_status ON public.fleet_tasks USING btree (status);


--
-- Name: idx_fuel_stocks_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fuel_stocks_site ON public.fuel_stocks USING btree (site_id);


--
-- Name: idx_fuel_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fuel_timestamp ON public.iot_fuel_readings USING btree (reading_timestamp DESC);


--
-- Name: idx_fuel_trans_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fuel_trans_ref ON public.fuel_transactions USING btree (reference);


--
-- Name: idx_fuel_transactions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fuel_transactions_date ON public.fuel_transactions USING btree (transaction_date DESC);


--
-- Name: idx_fuel_transactions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fuel_transactions_type ON public.fuel_transactions USING btree (transaction_type);


--
-- Name: idx_fuel_transactions_vehicle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fuel_transactions_vehicle ON public.fuel_transactions USING btree (vehicle_id);


--
-- Name: idx_fuel_vehicle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fuel_vehicle ON public.fuel_transactions USING btree (vehicle_id);


--
-- Name: idx_geofence_alerts_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geofence_alerts_created ON public.geofence_alerts USING btree (created_at);


--
-- Name: idx_geofence_alerts_violation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geofence_alerts_violation ON public.geofence_alerts USING btree (violation_id);


--
-- Name: idx_geofence_assignments_zone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geofence_assignments_zone ON public.geofence_zone_assignments USING btree (zone_id);


--
-- Name: idx_geofence_violations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geofence_violations_status ON public.geofence_violations USING btree (status);


--
-- Name: idx_geofence_violations_vehicle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geofence_violations_vehicle ON public.geofence_violations USING btree (vehicle_id);


--
-- Name: idx_geofence_violations_zone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geofence_violations_zone ON public.geofence_violations USING btree (zone_id);


--
-- Name: idx_gps_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gps_timestamp ON public.iot_gps_readings USING btree (reading_timestamp DESC);


--
-- Name: idx_invoice_items_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_items_invoice ON public.invoice_items USING btree (invoice_id);


--
-- Name: idx_invoices_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_date ON public.invoices USING btree (invoice_date);


--
-- Name: idx_maintenance_orders_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_maintenance_orders_date ON public.maintenance_orders USING btree (scheduled_date);


--
-- Name: idx_maintenance_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_maintenance_orders_status ON public.maintenance_orders USING btree (status);


--
-- Name: idx_maintenance_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_maintenance_status ON public.maintenance_orders USING btree (status);


--
-- Name: idx_maintenance_vehicle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_maintenance_vehicle ON public.maintenance_orders USING btree (vehicle_id);


--
-- Name: idx_notifications_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_read ON public.smart_notifications USING btree (is_read);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, read);


--
-- Name: idx_optimization_scenarios_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_optimization_scenarios_status ON public.optimization_scenarios USING btree (status);


--
-- Name: idx_payroll_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_employee ON public.payroll USING btree (employee_id);


--
-- Name: idx_performance_kpis_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_kpis_date ON public.performance_kpis USING btree (kpi_date);


--
-- Name: idx_performance_scores_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_scores_entity ON public.performance_scores USING btree (entity_type, entity_id);


--
-- Name: idx_pr_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pr_emp ON public.payroll_records USING btree (employee_id);


--
-- Name: idx_pr_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pr_period ON public.payroll_records USING btree (period_start DESC);


--
-- Name: idx_predictive_maintenance_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_predictive_maintenance_status ON public.predictive_maintenance_models USING btree (status);


--
-- Name: idx_predictive_maintenance_vehicle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_predictive_maintenance_vehicle ON public.predictive_maintenance_models USING btree (vehicle_id);


--
-- Name: idx_purchase_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_status ON public.purchase_orders USING btree (status);


--
-- Name: idx_quick_actions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quick_actions_user ON public.quick_actions_log USING btree (user_id);


--
-- Name: idx_reoptimization_events_resolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reoptimization_events_resolved ON public.reoptimization_events USING btree (resolved);


--
-- Name: idx_reoptimization_events_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reoptimization_events_time ON public.reoptimization_events USING btree (event_time);


--
-- Name: idx_route_optimization_trip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_route_optimization_trip ON public.route_optimization_suggestions USING btree (trip_id);


--
-- Name: idx_route_optimization_vehicle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_route_optimization_vehicle ON public.route_optimization_suggestions USING btree (vehicle_id);


--
-- Name: idx_scenario_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_status ON public.scenario_simulations USING btree (status);


--
-- Name: idx_scenario_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_type ON public.scenario_simulations USING btree (simulation_type);


--
-- Name: idx_settings_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settings_category ON public.settings USING btree (category);


--
-- Name: idx_settings_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settings_key ON public.settings USING btree (key);


--
-- Name: idx_shift_plans_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shift_plans_date ON public.shift_plans USING btree (shift_date);


--
-- Name: idx_shift_plans_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shift_plans_status ON public.shift_plans USING btree (status);


--
-- Name: idx_sites_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sites_active ON public.sites USING btree (is_active);


--
-- Name: idx_sites_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sites_city ON public.sites USING btree (city);


--
-- Name: idx_sites_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sites_type ON public.sites USING btree (type);


--
-- Name: idx_spare_parts_catalog_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spare_parts_catalog_number ON public.spare_parts_catalog USING btree (part_number);


--
-- Name: idx_stock_items_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_items_warehouse ON public.stock_items USING btree (warehouse_id);


--
-- Name: idx_sustainability_kpis_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sustainability_kpis_date ON public.sustainability_kpis USING btree (kpi_date);


--
-- Name: idx_task_assignments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_assignments_status ON public.task_assignments USING btree (status);


--
-- Name: idx_task_assignments_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_assignments_task ON public.task_assignments USING btree (task_id);


--
-- Name: idx_task_assignments_vehicle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_assignments_vehicle ON public.task_assignments USING btree (vehicle_id);


--
-- Name: idx_tco_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tco_period ON public.tco_analysis USING btree (period_start, period_end);


--
-- Name: idx_tco_vehicle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tco_vehicle ON public.tco_analysis USING btree (vehicle_id);


--
-- Name: idx_tire_dismounting_site_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tire_dismounting_site_id ON public.tire_dismounting_operations USING btree (site_id);


--
-- Name: idx_tire_dismounting_technician_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tire_dismounting_technician_id ON public.tire_dismounting_operations USING btree (technician_id);


--
-- Name: idx_tire_dismounting_vehicle_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tire_dismounting_vehicle_id ON public.tire_dismounting_operations USING btree (vehicle_id);


--
-- Name: idx_tire_inspections_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tire_inspections_date ON public.tire_inspections USING btree (inspection_date DESC);


--
-- Name: idx_tire_installations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tire_installations_status ON public.tire_installations USING btree (status);


--
-- Name: idx_tire_installations_tire_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tire_installations_tire_id ON public.tire_installations USING btree (tire_id);


--
-- Name: idx_tire_inventory_site_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tire_inventory_site_id ON public.tire_inventory USING btree (site_id);


--
-- Name: idx_tire_mounting_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tire_mounting_date ON public.tire_mounting_operations USING btree (mounting_date);


--
-- Name: idx_tire_mounting_site_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tire_mounting_site_id ON public.tire_mounting_operations USING btree (site_id);


--
-- Name: idx_tire_performance_site_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tire_performance_site_id ON public.tire_performance_metrics USING btree (site_id);


--
-- Name: idx_tire_purchase_rec_approved_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tire_purchase_rec_approved_by ON public.tire_purchase_recommendations USING btree (approved_by);


--
-- Name: idx_tire_purchase_rec_site_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tire_purchase_rec_site_id ON public.tire_purchase_recommendations USING btree (site_id);


--
-- Name: idx_tire_purchase_rec_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tire_purchase_rec_supplier_id ON public.tire_purchase_recommendations USING btree (recommended_supplier_id);


--
-- Name: idx_tire_quality_inspector_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tire_quality_inspector_id ON public.tire_quality_controls USING btree (inspector_id);


--
-- Name: idx_tire_quality_vehicle_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tire_quality_vehicle_id ON public.tire_quality_controls USING btree (vehicle_id);


--
-- Name: idx_tire_readings_vehicle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tire_readings_vehicle ON public.iot_tire_readings USING btree (vehicle_id, reading_timestamp DESC);


--
-- Name: idx_tire_removals_installation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tire_removals_installation_id ON public.tire_removals USING btree (installation_id);


--
-- Name: idx_tire_retreads_tire_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tire_retreads_tire_id ON public.tire_retreads USING btree (tire_id);


--
-- Name: idx_tire_rotations_technician_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tire_rotations_technician_id ON public.tire_rotations USING btree (technician_id);


--
-- Name: idx_tire_supplier_score_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tire_supplier_score_rating ON public.tire_supplier_scores USING btree (overall_score DESC);


--
-- Name: idx_training_driver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_driver ON public.training_needs_analysis USING btree (driver_id);


--
-- Name: idx_training_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_status ON public.training_needs_analysis USING btree (status);


--
-- Name: idx_trip_routes_vehicle_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trip_routes_vehicle_id ON public.trip_routes USING btree (vehicle_id);


--
-- Name: idx_trip_waypoints_trip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trip_waypoints_trip ON public.trip_waypoints USING btree (trip_id, sequence_number);


--
-- Name: idx_trips_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trips_date ON public.trips USING btree (planned_date);


--
-- Name: idx_trips_driver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trips_driver ON public.trips USING btree (driver_id);


--
-- Name: idx_trips_planned_date_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trips_planned_date_shift ON public.trips USING btree (planned_date, shift_id);


--
-- Name: idx_trips_shift_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trips_shift_id ON public.trips USING btree (shift_id);


--
-- Name: idx_trips_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trips_status ON public.trips USING btree (status);


--
-- Name: idx_trips_vehicle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trips_vehicle ON public.trips USING btree (vehicle_id);


--
-- Name: idx_user_activity_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activity_logs_created_at ON public.user_activity_logs USING btree (created_at DESC);


--
-- Name: idx_user_activity_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activity_logs_user_id ON public.user_activity_logs USING btree (user_id);


--
-- Name: idx_user_permissions_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_permissions_module ON public.user_permissions USING btree (module);


--
-- Name: idx_user_permissions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_permissions_user_id ON public.user_permissions USING btree (user_id);


--
-- Name: idx_user_preferences_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_preferences_user_id ON public.user_preferences USING btree (user_id);


--
-- Name: idx_vehicle_availability_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicle_availability_status ON public.vehicle_availability USING btree (status);


--
-- Name: idx_vehicle_documents_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicle_documents_expiry ON public.vehicle_documents USING btree (expiry_date);


--
-- Name: idx_vehicle_documents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicle_documents_status ON public.vehicle_documents USING btree (status);


--
-- Name: idx_vehicle_documents_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicle_documents_type ON public.vehicle_documents USING btree (document_type);


--
-- Name: idx_vehicle_documents_vehicle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicle_documents_vehicle ON public.vehicle_documents USING btree (vehicle_id);


--
-- Name: idx_vehicle_tracking_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicle_tracking_timestamp ON public.vehicle_tracking USING btree ("timestamp" DESC);


--
-- Name: idx_vehicle_upgrade_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicle_upgrade_status ON public.vehicle_upgrade_recommendations USING btree (status);


--
-- Name: idx_vehicle_upgrade_vehicle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicle_upgrade_vehicle ON public.vehicle_upgrade_recommendations USING btree (vehicle_id);


--
-- Name: idx_vehicles_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicles_site ON public.vehicles USING btree (site_id);


--
-- Name: idx_vehicles_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicles_status ON public.vehicles USING btree (status);


--
-- Name: idx_weight_readings_vehicle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weight_readings_vehicle ON public.iot_weight_readings USING btree (vehicle_id, reading_timestamp DESC);


--
-- Name: profiles_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_email_key ON public.profiles USING btree (email);


--
-- Name: trips sync_trips_columns_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_trips_columns_trigger BEFORE INSERT OR UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.sync_trips_columns();


--
-- Name: trips trigger_calculate_trip_duration; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_calculate_trip_duration BEFORE INSERT OR UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.calculate_trip_duration();


--
-- Name: fuel_transactions trigger_generate_fuel_transaction_reference; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_generate_fuel_transaction_reference BEFORE INSERT ON public.fuel_transactions FOR EACH ROW EXECUTE FUNCTION public.generate_fuel_transaction_reference();


--
-- Name: alert_notifications alert_notifications_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_notifications
    ADD CONSTRAINT alert_notifications_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES auth.users(id);


--
-- Name: alert_notifications alert_notifications_alert_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_notifications
    ADD CONSTRAINT alert_notifications_alert_rule_id_fkey FOREIGN KEY (alert_rule_id) REFERENCES public.alert_rules(id);


--
-- Name: alert_subscriptions alert_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_subscriptions
    ADD CONSTRAINT alert_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: alert_thresholds alert_thresholds_alert_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_thresholds
    ADD CONSTRAINT alert_thresholds_alert_rule_id_fkey FOREIGN KEY (alert_rule_id) REFERENCES public.alert_rules(id) ON DELETE CASCADE;


--
-- Name: alerts alerts_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES auth.users(id);


--
-- Name: alerts alerts_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: alerts alerts_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: attendance attendance_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: attendance attendance_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES auth.users(id);


--
-- Name: carbon_emissions carbon_emissions_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carbon_emissions
    ADD CONSTRAINT carbon_emissions_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: carbon_emissions carbon_emissions_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carbon_emissions
    ADD CONSTRAINT carbon_emissions_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: carbon_footprint_tracking carbon_footprint_tracking_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carbon_footprint_tracking
    ADD CONSTRAINT carbon_footprint_tracking_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE SET NULL;


--
-- Name: carbon_footprint_tracking carbon_footprint_tracking_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carbon_footprint_tracking
    ADD CONSTRAINT carbon_footprint_tracking_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- Name: custom_dashboards custom_dashboards_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_dashboards
    ADD CONSTRAINT custom_dashboards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: cycle_tracking cycle_tracking_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cycle_tracking
    ADD CONSTRAINT cycle_tracking_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.task_assignments(id);


--
-- Name: cycle_tracking cycle_tracking_loader_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cycle_tracking
    ADD CONSTRAINT cycle_tracking_loader_vehicle_id_fkey FOREIGN KEY (loader_vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: deliveries deliveries_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id);


--
-- Name: deliveries deliveries_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_received_by_fkey FOREIGN KEY (received_by) REFERENCES auth.users(id);


--
-- Name: deliveries deliveries_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: deliveries deliveries_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: dispatch_assignments dispatch_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_assignments
    ADD CONSTRAINT dispatch_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id);


--
-- Name: dispatch_assignments dispatch_assignments_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_assignments
    ADD CONSTRAINT dispatch_assignments_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: dispatch_assignments dispatch_assignments_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_assignments
    ADD CONSTRAINT dispatch_assignments_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: dispatch_assignments dispatch_assignments_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_assignments
    ADD CONSTRAINT dispatch_assignments_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: dispatch_simulations dispatch_simulations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_simulations
    ADD CONSTRAINT dispatch_simulations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: documents documents_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: documents documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id);


--
-- Name: documents documents_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: driver_availability driver_availability_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_availability
    ADD CONSTRAINT driver_availability_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE CASCADE;


--
-- Name: driver_behavior_scores driver_behavior_scores_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_behavior_scores
    ADD CONSTRAINT driver_behavior_scores_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE CASCADE;


--
-- Name: driver_work_sessions driver_work_sessions_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_work_sessions
    ADD CONSTRAINT driver_work_sessions_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE CASCADE;


--
-- Name: drivers drivers_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: eco_driving_scores eco_driving_scores_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eco_driving_scores
    ADD CONSTRAINT eco_driving_scores_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE CASCADE;


--
-- Name: eco_driving_scores eco_driving_scores_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eco_driving_scores
    ADD CONSTRAINT eco_driving_scores_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id);


--
-- Name: employee_attendance employee_attendance_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_attendance
    ADD CONSTRAINT employee_attendance_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: employee_attendance employee_attendance_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_attendance
    ADD CONSTRAINT employee_attendance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: environmental_incidents environmental_incidents_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.environmental_incidents
    ADD CONSTRAINT environmental_incidents_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: environmental_incidents environmental_incidents_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.environmental_incidents
    ADD CONSTRAINT environmental_incidents_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES auth.users(id);


--
-- Name: environmental_incidents environmental_incidents_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.environmental_incidents
    ADD CONSTRAINT environmental_incidents_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: esg_reports esg_reports_generated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.esg_reports
    ADD CONSTRAINT esg_reports_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES auth.users(id);


--
-- Name: expenses expenses_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.cost_categories(id);


--
-- Name: expenses expenses_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: expenses expenses_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES auth.users(id);


--
-- Name: expenses expenses_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: expenses expenses_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id);


--
-- Name: expenses expenses_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: fatigue_alerts fatigue_alerts_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fatigue_alerts
    ADD CONSTRAINT fatigue_alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES auth.users(id);


--
-- Name: fatigue_alerts fatigue_alerts_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fatigue_alerts
    ADD CONSTRAINT fatigue_alerts_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE CASCADE;


--
-- Name: fatigue_alerts fatigue_alerts_work_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fatigue_alerts
    ADD CONSTRAINT fatigue_alerts_work_session_id_fkey FOREIGN KEY (work_session_id) REFERENCES public.driver_work_sessions(id);


--
-- Name: stock_items fk_stock_items_supplier; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_items
    ADD CONSTRAINT fk_stock_items_supplier FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: fleet_health_scores fleet_health_scores_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fleet_health_scores
    ADD CONSTRAINT fleet_health_scores_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- Name: fleet_tasks fleet_tasks_destination_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fleet_tasks
    ADD CONSTRAINT fleet_tasks_destination_site_id_fkey FOREIGN KEY (destination_site_id) REFERENCES public.sites(id);


--
-- Name: fleet_tasks fleet_tasks_origin_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fleet_tasks
    ADD CONSTRAINT fleet_tasks_origin_site_id_fkey FOREIGN KEY (origin_site_id) REFERENCES public.sites(id);


--
-- Name: fuel_stocks fuel_stocks_fuel_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_stocks
    ADD CONSTRAINT fuel_stocks_fuel_type_id_fkey FOREIGN KEY (fuel_type_id) REFERENCES public.fuel_types(id);


--
-- Name: fuel_stocks fuel_stocks_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_stocks
    ADD CONSTRAINT fuel_stocks_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id);


--
-- Name: fuel_transactions fuel_transactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_transactions
    ADD CONSTRAINT fuel_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: fuel_transactions fuel_transactions_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_transactions
    ADD CONSTRAINT fuel_transactions_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: fuel_transactions fuel_transactions_fuel_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_transactions
    ADD CONSTRAINT fuel_transactions_fuel_type_id_fkey FOREIGN KEY (fuel_type_id) REFERENCES public.fuel_types(id);


--
-- Name: fuel_transactions fuel_transactions_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_transactions
    ADD CONSTRAINT fuel_transactions_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id);


--
-- Name: fuel_transactions fuel_transactions_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_transactions
    ADD CONSTRAINT fuel_transactions_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id);


--
-- Name: fuel_transactions fuel_transactions_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_transactions
    ADD CONSTRAINT fuel_transactions_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE RESTRICT;


--
-- Name: geofence_alerts geofence_alerts_escalated_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geofence_alerts
    ADD CONSTRAINT geofence_alerts_escalated_to_fkey FOREIGN KEY (escalated_to) REFERENCES auth.users(id);


--
-- Name: geofence_alerts geofence_alerts_read_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geofence_alerts
    ADD CONSTRAINT geofence_alerts_read_by_fkey FOREIGN KEY (read_by) REFERENCES auth.users(id);


--
-- Name: geofence_alerts geofence_alerts_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geofence_alerts
    ADD CONSTRAINT geofence_alerts_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: geofence_alerts geofence_alerts_violation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geofence_alerts
    ADD CONSTRAINT geofence_alerts_violation_id_fkey FOREIGN KEY (violation_id) REFERENCES public.geofence_violations(id) ON DELETE CASCADE;


--
-- Name: geofence_alerts geofence_alerts_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geofence_alerts
    ADD CONSTRAINT geofence_alerts_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.geofence_zones(id);


--
-- Name: geofence_violations geofence_violations_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geofence_violations
    ADD CONSTRAINT geofence_violations_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES auth.users(id);


--
-- Name: geofence_violations geofence_violations_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geofence_violations
    ADD CONSTRAINT geofence_violations_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: geofence_violations geofence_violations_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geofence_violations
    ADD CONSTRAINT geofence_violations_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id);


--
-- Name: geofence_violations geofence_violations_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geofence_violations
    ADD CONSTRAINT geofence_violations_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: geofence_violations geofence_violations_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geofence_violations
    ADD CONSTRAINT geofence_violations_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.geofence_zones(id);


--
-- Name: geofence_zone_assignments geofence_zone_assignments_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geofence_zone_assignments
    ADD CONSTRAINT geofence_zone_assignments_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE CASCADE;


--
-- Name: geofence_zone_assignments geofence_zone_assignments_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geofence_zone_assignments
    ADD CONSTRAINT geofence_zone_assignments_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- Name: geofence_zone_assignments geofence_zone_assignments_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geofence_zone_assignments
    ADD CONSTRAINT geofence_zone_assignments_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.geofence_zones(id) ON DELETE CASCADE;


--
-- Name: geofence_zones geofence_zones_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geofence_zones
    ADD CONSTRAINT geofence_zones_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: geofence_zones geofence_zones_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geofence_zones
    ADD CONSTRAINT geofence_zones_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id);


--
-- Name: incidents incidents_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE RESTRICT;


--
-- Name: invoice_items invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoice_items invoice_items_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id);


--
-- Name: invoices invoices_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;


--
-- Name: invoices invoices_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: invoices invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: iot_devices iot_devices_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_devices
    ADD CONSTRAINT iot_devices_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;


--
-- Name: iot_fuel_readings iot_fuel_readings_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_fuel_readings
    ADD CONSTRAINT iot_fuel_readings_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.iot_devices(device_id) ON DELETE CASCADE;


--
-- Name: iot_fuel_readings iot_fuel_readings_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_fuel_readings
    ADD CONSTRAINT iot_fuel_readings_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: iot_gps_readings iot_gps_readings_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_gps_readings
    ADD CONSTRAINT iot_gps_readings_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.iot_devices(device_id) ON DELETE CASCADE;


--
-- Name: iot_gps_readings iot_gps_readings_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_gps_readings
    ADD CONSTRAINT iot_gps_readings_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: iot_tire_readings iot_tire_readings_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_tire_readings
    ADD CONSTRAINT iot_tire_readings_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.iot_devices(device_id);


--
-- Name: iot_tire_readings iot_tire_readings_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_tire_readings
    ADD CONSTRAINT iot_tire_readings_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: iot_weight_readings iot_weight_readings_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_weight_readings
    ADD CONSTRAINT iot_weight_readings_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.iot_devices(device_id);


--
-- Name: iot_weight_readings iot_weight_readings_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iot_weight_readings
    ADD CONSTRAINT iot_weight_readings_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: leave_requests leave_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: leave_requests leave_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: maintenance_orders maintenance_orders_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_orders
    ADD CONSTRAINT maintenance_orders_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id);


--
-- Name: maintenance_orders maintenance_orders_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_orders
    ADD CONSTRAINT maintenance_orders_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.profiles(id);


--
-- Name: maintenance_orders maintenance_orders_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_orders
    ADD CONSTRAINT maintenance_orders_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id);


--
-- Name: maintenance_orders maintenance_orders_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_orders
    ADD CONSTRAINT maintenance_orders_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE RESTRICT;


--
-- Name: maintenance_parts maintenance_parts_maintenance_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_parts
    ADD CONSTRAINT maintenance_parts_maintenance_order_id_fkey FOREIGN KEY (maintenance_order_id) REFERENCES public.maintenance_orders(id) ON DELETE CASCADE;


--
-- Name: maintenance_parts maintenance_parts_part_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_parts
    ADD CONSTRAINT maintenance_parts_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.parts_inventory(id) ON DELETE RESTRICT;


--
-- Name: maintenance_schedules maintenance_schedules_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_schedules
    ADD CONSTRAINT maintenance_schedules_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: mission_requirements mission_requirements_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_requirements
    ADD CONSTRAINT mission_requirements_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: optimization_scenarios optimization_scenarios_base_shift_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.optimization_scenarios
    ADD CONSTRAINT optimization_scenarios_base_shift_plan_id_fkey FOREIGN KEY (base_shift_plan_id) REFERENCES public.shift_plans(id);


--
-- Name: payments payments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: payments payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: payments payments_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.profiles(id);


--
-- Name: payroll payroll_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll
    ADD CONSTRAINT payroll_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: payroll_bonuses payroll_bonuses_payroll_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_bonuses
    ADD CONSTRAINT payroll_bonuses_payroll_record_id_fkey FOREIGN KEY (payroll_record_id) REFERENCES public.payroll_records(id) ON DELETE CASCADE;


--
-- Name: payroll_deductions payroll_deductions_payroll_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_deductions
    ADD CONSTRAINT payroll_deductions_payroll_record_id_fkey FOREIGN KEY (payroll_record_id) REFERENCES public.payroll_records(id) ON DELETE CASCADE;


--
-- Name: payroll payroll_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll
    ADD CONSTRAINT payroll_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: payroll_items payroll_items_payroll_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_items
    ADD CONSTRAINT payroll_items_payroll_id_fkey FOREIGN KEY (payroll_id) REFERENCES public.payroll(id) ON DELETE CASCADE;


--
-- Name: payroll payroll_prepared_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll
    ADD CONSTRAINT payroll_prepared_by_fkey FOREIGN KEY (prepared_by) REFERENCES auth.users(id);


--
-- Name: payroll_records payroll_records_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_records
    ADD CONSTRAINT payroll_records_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: payroll_records payroll_records_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_records
    ADD CONSTRAINT payroll_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: performance_kpis performance_kpis_shift_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_kpis
    ADD CONSTRAINT performance_kpis_shift_plan_id_fkey FOREIGN KEY (shift_plan_id) REFERENCES public.shift_plans(id);


--
-- Name: predictive_maintenance_models predictive_maintenance_models_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.predictive_maintenance_models
    ADD CONSTRAINT predictive_maintenance_models_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id);


--
-- Name: profiles profiles_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: purchase_order_items purchase_order_items_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_stock_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_stock_item_id_fkey FOREIGN KEY (stock_item_id) REFERENCES public.stock_items(id);


--
-- Name: purchase_orders purchase_orders_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: purchase_orders purchase_orders_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES auth.users(id);


--
-- Name: purchase_orders purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: purchase_orders purchase_orders_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: quick_actions_log quick_actions_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quick_actions_log
    ADD CONSTRAINT quick_actions_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: reoptimization_events reoptimization_events_affected_shift_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reoptimization_events
    ADD CONSTRAINT reoptimization_events_affected_shift_plan_id_fkey FOREIGN KEY (affected_shift_plan_id) REFERENCES public.shift_plans(id);


--
-- Name: rest_periods rest_periods_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rest_periods
    ADD CONSTRAINT rest_periods_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE CASCADE;


--
-- Name: rest_periods rest_periods_work_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rest_periods
    ADD CONSTRAINT rest_periods_work_session_id_fkey FOREIGN KEY (work_session_id) REFERENCES public.driver_work_sessions(id);


--
-- Name: route_optimization_suggestions route_optimization_suggestions_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route_optimization_suggestions
    ADD CONSTRAINT route_optimization_suggestions_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL;


--
-- Name: route_optimization_suggestions route_optimization_suggestions_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route_optimization_suggestions
    ADD CONSTRAINT route_optimization_suggestions_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: route_optimization_suggestions route_optimization_suggestions_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route_optimization_suggestions
    ADD CONSTRAINT route_optimization_suggestions_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- Name: scenario_simulations scenario_simulations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_simulations
    ADD CONSTRAINT scenario_simulations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: settings settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: sites sites_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.employees(id);


--
-- Name: smart_notifications smart_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_notifications
    ADD CONSTRAINT smart_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: stock_categories stock_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_categories
    ADD CONSTRAINT stock_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.stock_categories(id);


--
-- Name: stock_items stock_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_items
    ADD CONSTRAINT stock_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.stock_categories(id);


--
-- Name: stock_items stock_items_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_items
    ADD CONSTRAINT stock_items_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: stock_movements stock_movements_from_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_from_warehouse_id_fkey FOREIGN KEY (from_warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: stock_movements stock_movements_maintenance_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_maintenance_order_id_fkey FOREIGN KEY (maintenance_order_id) REFERENCES public.maintenance_orders(id);


--
-- Name: stock_movements stock_movements_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES auth.users(id);


--
-- Name: stock_movements stock_movements_stock_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_stock_item_id_fkey FOREIGN KEY (stock_item_id) REFERENCES public.stock_items(id);


--
-- Name: stock_movements stock_movements_to_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_to_warehouse_id_fkey FOREIGN KEY (to_warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: stock_movements stock_movements_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: task_assignments task_assignments_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_assignments
    ADD CONSTRAINT task_assignments_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: task_assignments task_assignments_loader_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_assignments
    ADD CONSTRAINT task_assignments_loader_id_fkey FOREIGN KEY (loader_id) REFERENCES public.vehicles(id);


--
-- Name: task_assignments task_assignments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_assignments
    ADD CONSTRAINT task_assignments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.fleet_tasks(id) ON DELETE CASCADE;


--
-- Name: task_assignments task_assignments_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_assignments
    ADD CONSTRAINT task_assignments_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: tco_analysis tco_analysis_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tco_analysis
    ADD CONSTRAINT tco_analysis_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- Name: tire_alerts tire_alerts_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_alerts
    ADD CONSTRAINT tire_alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES auth.users(id);


--
-- Name: tire_alerts tire_alerts_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_alerts
    ADD CONSTRAINT tire_alerts_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id);


--
-- Name: tire_alerts tire_alerts_tire_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_alerts
    ADD CONSTRAINT tire_alerts_tire_id_fkey FOREIGN KEY (tire_id) REFERENCES public.tires(id);


--
-- Name: tire_alerts tire_alerts_tire_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_alerts
    ADD CONSTRAINT tire_alerts_tire_model_id_fkey FOREIGN KEY (tire_model_id) REFERENCES public.tire_models(id);


--
-- Name: tire_cost_analysis tire_cost_analysis_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_cost_analysis
    ADD CONSTRAINT tire_cost_analysis_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id);


--
-- Name: tire_cost_analysis tire_cost_analysis_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_cost_analysis
    ADD CONSTRAINT tire_cost_analysis_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: tire_dismounting_operations tire_dismounting_operations_mounting_operation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_dismounting_operations
    ADD CONSTRAINT tire_dismounting_operations_mounting_operation_id_fkey FOREIGN KEY (mounting_operation_id) REFERENCES public.tire_mounting_operations(id);


--
-- Name: tire_dismounting_operations tire_dismounting_operations_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_dismounting_operations
    ADD CONSTRAINT tire_dismounting_operations_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id);


--
-- Name: tire_dismounting_operations tire_dismounting_operations_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_dismounting_operations
    ADD CONSTRAINT tire_dismounting_operations_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.employees(id);


--
-- Name: tire_dismounting_operations tire_dismounting_operations_tire_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_dismounting_operations
    ADD CONSTRAINT tire_dismounting_operations_tire_id_fkey FOREIGN KEY (tire_id) REFERENCES public.tires(id) ON DELETE CASCADE;


--
-- Name: tire_dismounting_operations tire_dismounting_operations_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_dismounting_operations
    ADD CONSTRAINT tire_dismounting_operations_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: tire_inspections tire_inspections_tire_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_inspections
    ADD CONSTRAINT tire_inspections_tire_id_fkey FOREIGN KEY (tire_id) REFERENCES public.tires(id) ON DELETE CASCADE;


--
-- Name: tire_inspections tire_inspections_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_inspections
    ADD CONSTRAINT tire_inspections_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: tire_installations tire_installations_operator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_installations
    ADD CONSTRAINT tire_installations_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES public.drivers(id);


--
-- Name: tire_installations tire_installations_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_installations
    ADD CONSTRAINT tire_installations_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id);


--
-- Name: tire_installations tire_installations_tire_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_installations
    ADD CONSTRAINT tire_installations_tire_id_fkey FOREIGN KEY (tire_id) REFERENCES public.tires(id) ON DELETE CASCADE;


--
-- Name: tire_installations tire_installations_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_installations
    ADD CONSTRAINT tire_installations_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: tire_inventory tire_inventory_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_inventory
    ADD CONSTRAINT tire_inventory_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id);


--
-- Name: tire_inventory tire_inventory_tire_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_inventory
    ADD CONSTRAINT tire_inventory_tire_model_id_fkey FOREIGN KEY (tire_model_id) REFERENCES public.tire_models(id);


--
-- Name: tire_maintenance_events tire_maintenance_events_installation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_maintenance_events
    ADD CONSTRAINT tire_maintenance_events_installation_id_fkey FOREIGN KEY (installation_id) REFERENCES public.tire_installations(id) ON DELETE CASCADE;


--
-- Name: tire_maintenance_events tire_maintenance_events_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_maintenance_events
    ADD CONSTRAINT tire_maintenance_events_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.drivers(id);


--
-- Name: tire_models tire_models_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_models
    ADD CONSTRAINT tire_models_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.tire_brands(id);


--
-- Name: tire_models tire_models_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_models
    ADD CONSTRAINT tire_models_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.tire_suppliers(id);


--
-- Name: tire_mounting_operations tire_mounting_operations_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_mounting_operations
    ADD CONSTRAINT tire_mounting_operations_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id);


--
-- Name: tire_mounting_operations tire_mounting_operations_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_mounting_operations
    ADD CONSTRAINT tire_mounting_operations_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.employees(id);


--
-- Name: tire_mounting_operations tire_mounting_operations_tire_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_mounting_operations
    ADD CONSTRAINT tire_mounting_operations_tire_id_fkey FOREIGN KEY (tire_id) REFERENCES public.tires(id) ON DELETE CASCADE;


--
-- Name: tire_mounting_operations tire_mounting_operations_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_mounting_operations
    ADD CONSTRAINT tire_mounting_operations_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- Name: tire_performance_metrics tire_performance_metrics_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_performance_metrics
    ADD CONSTRAINT tire_performance_metrics_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id);


--
-- Name: tire_performance_metrics tire_performance_metrics_tire_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_performance_metrics
    ADD CONSTRAINT tire_performance_metrics_tire_id_fkey FOREIGN KEY (tire_id) REFERENCES public.tires(id) ON DELETE CASCADE;


--
-- Name: tire_po_items tire_po_items_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_po_items
    ADD CONSTRAINT tire_po_items_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.tire_purchase_orders(id) ON DELETE CASCADE;


--
-- Name: tire_po_items tire_po_items_tire_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_po_items
    ADD CONSTRAINT tire_po_items_tire_model_id_fkey FOREIGN KEY (tire_model_id) REFERENCES public.tire_models(id);


--
-- Name: tire_purchase_orders tire_purchase_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_purchase_orders
    ADD CONSTRAINT tire_purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: tire_purchase_orders tire_purchase_orders_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_purchase_orders
    ADD CONSTRAINT tire_purchase_orders_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id);


--
-- Name: tire_purchase_orders tire_purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_purchase_orders
    ADD CONSTRAINT tire_purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.tire_suppliers(id);


--
-- Name: tire_purchase_recommendations tire_purchase_recommendations_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_purchase_recommendations
    ADD CONSTRAINT tire_purchase_recommendations_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.employees(id);


--
-- Name: tire_purchase_recommendations tire_purchase_recommendations_recommended_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_purchase_recommendations
    ADD CONSTRAINT tire_purchase_recommendations_recommended_supplier_id_fkey FOREIGN KEY (recommended_supplier_id) REFERENCES public.tire_suppliers(id);


--
-- Name: tire_purchase_recommendations tire_purchase_recommendations_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_purchase_recommendations
    ADD CONSTRAINT tire_purchase_recommendations_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id);


--
-- Name: tire_quality_controls tire_quality_controls_inspector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_quality_controls
    ADD CONSTRAINT tire_quality_controls_inspector_id_fkey FOREIGN KEY (inspector_id) REFERENCES public.employees(id);


--
-- Name: tire_quality_controls tire_quality_controls_tire_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_quality_controls
    ADD CONSTRAINT tire_quality_controls_tire_id_fkey FOREIGN KEY (tire_id) REFERENCES public.tires(id) ON DELETE CASCADE;


--
-- Name: tire_quality_controls tire_quality_controls_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_quality_controls
    ADD CONSTRAINT tire_quality_controls_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: tire_removals tire_removals_installation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_removals
    ADD CONSTRAINT tire_removals_installation_id_fkey FOREIGN KEY (installation_id) REFERENCES public.tire_installations(id) ON DELETE CASCADE;


--
-- Name: tire_removals tire_removals_operator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_removals
    ADD CONSTRAINT tire_removals_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES public.drivers(id);


--
-- Name: tire_retreads tire_retreads_removal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_retreads
    ADD CONSTRAINT tire_retreads_removal_id_fkey FOREIGN KEY (removal_id) REFERENCES public.tire_removals(id);


--
-- Name: tire_retreads tire_retreads_tire_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_retreads
    ADD CONSTRAINT tire_retreads_tire_id_fkey FOREIGN KEY (tire_id) REFERENCES public.tires(id) ON DELETE CASCADE;


--
-- Name: tire_rotations tire_rotations_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_rotations
    ADD CONSTRAINT tire_rotations_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.employees(id);


--
-- Name: tire_rotations tire_rotations_tire_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_rotations
    ADD CONSTRAINT tire_rotations_tire_id_fkey FOREIGN KEY (tire_id) REFERENCES public.tires(id) ON DELETE CASCADE;


--
-- Name: tire_rotations tire_rotations_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_rotations
    ADD CONSTRAINT tire_rotations_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- Name: tire_sensor_readings tire_sensor_readings_sensor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_sensor_readings
    ADD CONSTRAINT tire_sensor_readings_sensor_id_fkey FOREIGN KEY (sensor_id) REFERENCES public.tire_sensors(id) ON DELETE CASCADE;


--
-- Name: tire_sensor_readings tire_sensor_readings_tire_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_sensor_readings
    ADD CONSTRAINT tire_sensor_readings_tire_id_fkey FOREIGN KEY (tire_id) REFERENCES public.tires(id);


--
-- Name: tire_sensor_readings tire_sensor_readings_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_sensor_readings
    ADD CONSTRAINT tire_sensor_readings_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: tire_sensors tire_sensors_tire_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_sensors
    ADD CONSTRAINT tire_sensors_tire_id_fkey FOREIGN KEY (tire_id) REFERENCES public.tires(id) ON DELETE CASCADE;


--
-- Name: tire_supplier_scores tire_supplier_scores_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_supplier_scores
    ADD CONSTRAINT tire_supplier_scores_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.tire_suppliers(id) ON DELETE CASCADE;


--
-- Name: tire_transfers tire_transfers_from_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_transfers
    ADD CONSTRAINT tire_transfers_from_site_id_fkey FOREIGN KEY (from_site_id) REFERENCES public.sites(id);


--
-- Name: tire_transfers tire_transfers_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_transfers
    ADD CONSTRAINT tire_transfers_received_by_fkey FOREIGN KEY (received_by) REFERENCES auth.users(id);


--
-- Name: tire_transfers tire_transfers_tire_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_transfers
    ADD CONSTRAINT tire_transfers_tire_id_fkey FOREIGN KEY (tire_id) REFERENCES public.tires(id) ON DELETE CASCADE;


--
-- Name: tire_transfers tire_transfers_to_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_transfers
    ADD CONSTRAINT tire_transfers_to_site_id_fkey FOREIGN KEY (to_site_id) REFERENCES public.sites(id);


--
-- Name: tire_usage_logs tire_usage_logs_installation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_usage_logs
    ADD CONSTRAINT tire_usage_logs_installation_id_fkey FOREIGN KEY (installation_id) REFERENCES public.tire_installations(id) ON DELETE CASCADE;


--
-- Name: tire_usage_logs tire_usage_logs_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_usage_logs
    ADD CONSTRAINT tire_usage_logs_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id);


--
-- Name: tire_usage_zones tire_usage_zones_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_usage_zones
    ADD CONSTRAINT tire_usage_zones_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id);


--
-- Name: tire_work_orders tire_work_orders_tire_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_work_orders
    ADD CONSTRAINT tire_work_orders_tire_id_fkey FOREIGN KEY (tire_id) REFERENCES public.tires(id);


--
-- Name: tire_work_orders tire_work_orders_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tire_work_orders
    ADD CONSTRAINT tire_work_orders_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: tires tires_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tires
    ADD CONSTRAINT tires_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.customers(id);


--
-- Name: tires tires_tire_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tires
    ADD CONSTRAINT tires_tire_model_id_fkey FOREIGN KEY (tire_model_id) REFERENCES public.tire_models(id);


--
-- Name: tires tires_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tires
    ADD CONSTRAINT tires_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: tracking_events tracking_events_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracking_events
    ADD CONSTRAINT tracking_events_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES auth.users(id);


--
-- Name: tracking_events tracking_events_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracking_events
    ADD CONSTRAINT tracking_events_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: tracking_events tracking_events_geofence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracking_events
    ADD CONSTRAINT tracking_events_geofence_id_fkey FOREIGN KEY (geofence_id) REFERENCES public.geofences(id);


--
-- Name: tracking_events tracking_events_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracking_events
    ADD CONSTRAINT tracking_events_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id);


--
-- Name: tracking_events tracking_events_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracking_events
    ADD CONSTRAINT tracking_events_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: training_needs_analysis training_needs_analysis_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_needs_analysis
    ADD CONSTRAINT training_needs_analysis_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE CASCADE;


--
-- Name: trip_route_tracking trip_route_tracking_next_waypoint_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_route_tracking
    ADD CONSTRAINT trip_route_tracking_next_waypoint_id_fkey FOREIGN KEY (next_waypoint_id) REFERENCES public.trip_waypoints(id);


--
-- Name: trip_route_tracking trip_route_tracking_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_route_tracking
    ADD CONSTRAINT trip_route_tracking_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: trip_route_tracking trip_route_tracking_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_route_tracking
    ADD CONSTRAINT trip_route_tracking_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: trip_routes trip_routes_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_routes
    ADD CONSTRAINT trip_routes_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: trip_routes trip_routes_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_routes
    ADD CONSTRAINT trip_routes_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: trip_waypoints trip_waypoints_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_waypoints
    ADD CONSTRAINT trip_waypoints_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id);


--
-- Name: trip_waypoints trip_waypoints_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_waypoints
    ADD CONSTRAINT trip_waypoints_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: trips trips_arrival_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_arrival_site_id_fkey FOREIGN KEY (arrival_site_id) REFERENCES public.sites(id);


--
-- Name: trips trips_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: trips trips_departure_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_departure_site_id_fkey FOREIGN KEY (departure_site_id) REFERENCES public.sites(id);


--
-- Name: trips trips_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE RESTRICT;


--
-- Name: trips trips_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.work_shifts(id);


--
-- Name: trips trips_trailer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_trailer_id_fkey FOREIGN KEY (trailer_id) REFERENCES public.trailers(id);


--
-- Name: trips trips_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE RESTRICT;


--
-- Name: user_activity_logs user_activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activity_logs
    ADD CONSTRAINT user_activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_permissions user_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_preferences user_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: vehicle_availability vehicle_availability_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_availability
    ADD CONSTRAINT vehicle_availability_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- Name: vehicle_costs vehicle_costs_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_costs
    ADD CONSTRAINT vehicle_costs_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: vehicle_documents vehicle_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_documents
    ADD CONSTRAINT vehicle_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id);


--
-- Name: vehicle_documents vehicle_documents_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_documents
    ADD CONSTRAINT vehicle_documents_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- Name: vehicle_tracking vehicle_tracking_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_tracking
    ADD CONSTRAINT vehicle_tracking_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: vehicle_tracking vehicle_tracking_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_tracking
    ADD CONSTRAINT vehicle_tracking_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id);


--
-- Name: vehicle_tracking vehicle_tracking_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_tracking
    ADD CONSTRAINT vehicle_tracking_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- Name: vehicle_upgrade_recommendations vehicle_upgrade_recommendations_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_upgrade_recommendations
    ADD CONSTRAINT vehicle_upgrade_recommendations_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- Name: vehicles vehicles_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id);


--
-- Name: waste_management waste_management_source_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste_management
    ADD CONSTRAINT waste_management_source_vehicle_id_fkey FOREIGN KEY (source_vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: weighings weighings_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weighings
    ADD CONSTRAINT weighings_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: alerts Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.alerts TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: attendance Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.attendance TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: clients Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.clients TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: cost_categories Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.cost_categories TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: customers Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.customers TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: deliveries Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.deliveries TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: documents Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.documents TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: driver_behavior_scores Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.driver_behavior_scores TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: drivers Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.drivers TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: employees Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.employees TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: expenses Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.expenses TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: fleet_health_scores Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.fleet_health_scores TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: fuel_stocks Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.fuel_stocks TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: fuel_transactions Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.fuel_transactions TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: fuel_types Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.fuel_types TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: geofences Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.geofences TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: incidents Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.incidents TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: invoice_items Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.invoice_items TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: invoices Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.invoices TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: leave_requests Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.leave_requests TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: maintenance_orders Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.maintenance_orders TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: maintenance_parts Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.maintenance_parts TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: maintenance_schedules Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.maintenance_schedules TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: notifications Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.notifications TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: parts_inventory Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.parts_inventory TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: payments Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.payments TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: payroll Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.payroll TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: payroll_items Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.payroll_items TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: predictive_maintenance_models Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.predictive_maintenance_models TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: profiles Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.profiles TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: purchase_order_items Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.purchase_order_items TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: purchase_orders Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.purchase_orders TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: sites Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.sites TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: spare_parts_catalog Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.spare_parts_catalog TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: stock_categories Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.stock_categories TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: stock_items Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.stock_items TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: stock_movements Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.stock_movements TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: suppliers Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.suppliers TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: system_parameters Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.system_parameters TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: tco_analysis Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.tco_analysis TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: tires Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.tires TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: tracking_events Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.tracking_events TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: trailers Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.trailers TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: trips Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.trips TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: user_activity_logs Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.user_activity_logs TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: user_permissions Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.user_permissions TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: vehicle_costs Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.vehicle_costs TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: vehicle_tracking Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.vehicle_tracking TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: vehicles Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.vehicles TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: warehouses Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.warehouses TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: weighings Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.weighings TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: work_shifts Admins full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access" ON public.work_shifts TO authenticated USING (true);


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: alert_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alert_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: alert_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: alert_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alert_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: alert_thresholds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alert_thresholds ENABLE ROW LEVEL SECURITY;

--
-- Name: alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

--
-- Name: benchmark_comparisons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.benchmark_comparisons ENABLE ROW LEVEL SECURITY;

--
-- Name: carbon_emissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.carbon_emissions ENABLE ROW LEVEL SECURITY;

--
-- Name: carbon_footprint_tracking; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.carbon_footprint_tracking ENABLE ROW LEVEL SECURITY;

--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: cost_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cost_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_dashboards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.custom_dashboards ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: cycle_tracking; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cycle_tracking ENABLE ROW LEVEL SECURITY;

--
-- Name: deliveries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

--
-- Name: dispatch_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dispatch_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: dispatch_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dispatch_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: dispatch_simulations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dispatch_simulations ENABLE ROW LEVEL SECURITY;

--
-- Name: documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

--
-- Name: driver_availability; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.driver_availability ENABLE ROW LEVEL SECURITY;

--
-- Name: driver_behavior_scores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.driver_behavior_scores ENABLE ROW LEVEL SECURITY;

--
-- Name: driver_work_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.driver_work_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: drivers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

--
-- Name: driving_time_regulations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.driving_time_regulations ENABLE ROW LEVEL SECURITY;

--
-- Name: eco_driving_scores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.eco_driving_scores ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_attendance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_attendance ENABLE ROW LEVEL SECURITY;

--
-- Name: employees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

--
-- Name: environmental_incidents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.environmental_incidents ENABLE ROW LEVEL SECURITY;

--
-- Name: esg_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.esg_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: expenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: fatigue_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fatigue_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: fleet_health_scores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fleet_health_scores ENABLE ROW LEVEL SECURITY;

--
-- Name: fleet_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fleet_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: fuel_stocks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fuel_stocks ENABLE ROW LEVEL SECURITY;

--
-- Name: fuel_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fuel_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: fuel_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fuel_types ENABLE ROW LEVEL SECURITY;

--
-- Name: geofence_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.geofence_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: geofence_violations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.geofence_violations ENABLE ROW LEVEL SECURITY;

--
-- Name: geofence_zone_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.geofence_zone_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: geofence_zones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.geofence_zones ENABLE ROW LEVEL SECURITY;

--
-- Name: geofences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;

--
-- Name: incidents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: iot_devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.iot_devices ENABLE ROW LEVEL SECURITY;

--
-- Name: iot_fuel_readings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.iot_fuel_readings ENABLE ROW LEVEL SECURITY;

--
-- Name: iot_gps_readings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.iot_gps_readings ENABLE ROW LEVEL SECURITY;

--
-- Name: iot_tire_readings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.iot_tire_readings ENABLE ROW LEVEL SECURITY;

--
-- Name: iot_weight_readings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.iot_weight_readings ENABLE ROW LEVEL SECURITY;

--
-- Name: leave_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: maintenance_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.maintenance_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: maintenance_parts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.maintenance_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: maintenance_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.maintenance_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: mission_requirements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mission_requirements ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: optimization_constraints; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.optimization_constraints ENABLE ROW LEVEL SECURITY;

--
-- Name: optimization_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.optimization_history ENABLE ROW LEVEL SECURITY;

--
-- Name: optimization_scenarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.optimization_scenarios ENABLE ROW LEVEL SECURITY;

--
-- Name: parts_inventory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.parts_inventory ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll_bonuses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payroll_bonuses ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll_deductions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payroll_deductions ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;

--
-- Name: performance_kpis; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.performance_kpis ENABLE ROW LEVEL SECURITY;

--
-- Name: performance_scores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.performance_scores ENABLE ROW LEVEL SECURITY;

--
-- Name: predictive_maintenance_models; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.predictive_maintenance_models ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: quick_actions_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quick_actions_log ENABLE ROW LEVEL SECURITY;

--
-- Name: reoptimization_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reoptimization_events ENABLE ROW LEVEL SECURITY;

--
-- Name: rest_periods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rest_periods ENABLE ROW LEVEL SECURITY;

--
-- Name: role_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: route_optimization_suggestions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.route_optimization_suggestions ENABLE ROW LEVEL SECURITY;

--
-- Name: scenario_simulations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scenario_simulations ENABLE ROW LEVEL SECURITY;

--
-- Name: settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shift_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: sites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

--
-- Name: smart_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.smart_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: spare_parts_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.spare_parts_catalog ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: sustainability_kpis; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sustainability_kpis ENABLE ROW LEVEL SECURITY;

--
-- Name: system_parameters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_parameters ENABLE ROW LEVEL SECURITY;

--
-- Name: task_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: tco_analysis; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tco_analysis ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_brands; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_brands ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_cost_analysis; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_cost_analysis ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_dismounting_operations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_dismounting_operations ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_inspections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_inspections ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_installations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_installations ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_inventory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_inventory ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_maintenance_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_maintenance_events ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_models; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_models ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_mounting_operations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_mounting_operations ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_performance_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_performance_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_po_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_po_items ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_purchase_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_purchase_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_purchase_recommendations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_purchase_recommendations ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_quality_controls; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_quality_controls ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_removals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_removals ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_retreads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_retreads ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_rotations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_rotations ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_sensor_readings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_sensor_readings ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_sensors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_sensors ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_stock_forecasts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_stock_forecasts ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_supplier_scores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_supplier_scores ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_transfers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_transfers ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_usage_analysis; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_usage_analysis ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_usage_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_usage_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_usage_zones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_usage_zones ENABLE ROW LEVEL SECURITY;

--
-- Name: tire_work_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tire_work_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: tires; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tires ENABLE ROW LEVEL SECURITY;

--
-- Name: tracking_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;

--
-- Name: trailers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trailers ENABLE ROW LEVEL SECURITY;

--
-- Name: training_needs_analysis; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.training_needs_analysis ENABLE ROW LEVEL SECURITY;

--
-- Name: trip_route_tracking; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trip_route_tracking ENABLE ROW LEVEL SECURITY;

--
-- Name: trip_routes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trip_routes ENABLE ROW LEVEL SECURITY;

--
-- Name: trip_waypoints; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trip_waypoints ENABLE ROW LEVEL SECURITY;

--
-- Name: trips; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

--
-- Name: user_activity_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: user_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicle_availability; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vehicle_availability ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicle_costs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vehicle_costs ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicle_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vehicle_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicle_tracking; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vehicle_tracking ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicle_upgrade_recommendations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vehicle_upgrade_recommendations ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

--
-- Name: warehouses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

--
-- Name: waste_management; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.waste_management ENABLE ROW LEVEL SECURITY;

--
-- Name: weighings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.weighings ENABLE ROW LEVEL SECURITY;

--
-- Name: work_shifts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.work_shifts ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION calculate_employee_payroll(p_employee_id uuid, p_period_start date, p_period_end date); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.calculate_employee_payroll(p_employee_id uuid, p_period_start date, p_period_end date) TO postgres;
GRANT ALL ON FUNCTION public.calculate_employee_payroll(p_employee_id uuid, p_period_start date, p_period_end date) TO anon;
GRANT ALL ON FUNCTION public.calculate_employee_payroll(p_employee_id uuid, p_period_start date, p_period_end date) TO authenticated;
GRANT ALL ON FUNCTION public.calculate_employee_payroll(p_employee_id uuid, p_period_start date, p_period_end date) TO service_role;


--
-- Name: FUNCTION calculate_fatigue_score(p_driver_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.calculate_fatigue_score(p_driver_id uuid) TO postgres;
GRANT ALL ON FUNCTION public.calculate_fatigue_score(p_driver_id uuid) TO anon;
GRANT ALL ON FUNCTION public.calculate_fatigue_score(p_driver_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.calculate_fatigue_score(p_driver_id uuid) TO service_role;


--
-- Name: FUNCTION calculate_tire_cost_per_tonne_km(p_tire_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.calculate_tire_cost_per_tonne_km(p_tire_id uuid) TO postgres;
GRANT ALL ON FUNCTION public.calculate_tire_cost_per_tonne_km(p_tire_id uuid) TO anon;
GRANT ALL ON FUNCTION public.calculate_tire_cost_per_tonne_km(p_tire_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.calculate_tire_cost_per_tonne_km(p_tire_id uuid) TO service_role;


--
-- Name: FUNCTION calculate_tire_performance_metrics(p_tire_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.calculate_tire_performance_metrics(p_tire_id uuid) TO postgres;
GRANT ALL ON FUNCTION public.calculate_tire_performance_metrics(p_tire_id uuid) TO anon;
GRANT ALL ON FUNCTION public.calculate_tire_performance_metrics(p_tire_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.calculate_tire_performance_metrics(p_tire_id uuid) TO service_role;


--
-- Name: FUNCTION calculate_trip_carbon_emissions(p_trip_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.calculate_trip_carbon_emissions(p_trip_id uuid) TO postgres;
GRANT ALL ON FUNCTION public.calculate_trip_carbon_emissions(p_trip_id uuid) TO anon;
GRANT ALL ON FUNCTION public.calculate_trip_carbon_emissions(p_trip_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.calculate_trip_carbon_emissions(p_trip_id uuid) TO service_role;


--
-- Name: FUNCTION calculate_trip_duration(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.calculate_trip_duration() TO postgres;
GRANT ALL ON FUNCTION public.calculate_trip_duration() TO anon;
GRANT ALL ON FUNCTION public.calculate_trip_duration() TO authenticated;
GRANT ALL ON FUNCTION public.calculate_trip_duration() TO service_role;


--
-- Name: FUNCTION calculate_trip_progress(p_trip_id uuid, p_current_lat numeric, p_current_lng numeric); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.calculate_trip_progress(p_trip_id uuid, p_current_lat numeric, p_current_lng numeric) TO postgres;
GRANT ALL ON FUNCTION public.calculate_trip_progress(p_trip_id uuid, p_current_lat numeric, p_current_lng numeric) TO anon;
GRANT ALL ON FUNCTION public.calculate_trip_progress(p_trip_id uuid, p_current_lat numeric, p_current_lng numeric) TO authenticated;
GRANT ALL ON FUNCTION public.calculate_trip_progress(p_trip_id uuid, p_current_lat numeric, p_current_lng numeric) TO service_role;


--
-- Name: FUNCTION check_alert_conditions(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.check_alert_conditions() TO postgres;
GRANT ALL ON FUNCTION public.check_alert_conditions() TO anon;
GRANT ALL ON FUNCTION public.check_alert_conditions() TO authenticated;
GRANT ALL ON FUNCTION public.check_alert_conditions() TO service_role;


--
-- Name: FUNCTION check_fatigue_violations(p_driver_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.check_fatigue_violations(p_driver_id uuid) TO postgres;
GRANT ALL ON FUNCTION public.check_fatigue_violations(p_driver_id uuid) TO anon;
GRANT ALL ON FUNCTION public.check_fatigue_violations(p_driver_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.check_fatigue_violations(p_driver_id uuid) TO service_role;


--
-- Name: FUNCTION check_reorder_points(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.check_reorder_points() TO postgres;
GRANT ALL ON FUNCTION public.check_reorder_points() TO anon;
GRANT ALL ON FUNCTION public.check_reorder_points() TO authenticated;
GRANT ALL ON FUNCTION public.check_reorder_points() TO service_role;


--
-- Name: FUNCTION check_vehicle_in_authorized_zone(p_vehicle_id uuid, p_latitude numeric, p_longitude numeric); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.check_vehicle_in_authorized_zone(p_vehicle_id uuid, p_latitude numeric, p_longitude numeric) TO postgres;
GRANT ALL ON FUNCTION public.check_vehicle_in_authorized_zone(p_vehicle_id uuid, p_latitude numeric, p_longitude numeric) TO anon;
GRANT ALL ON FUNCTION public.check_vehicle_in_authorized_zone(p_vehicle_id uuid, p_latitude numeric, p_longitude numeric) TO authenticated;
GRANT ALL ON FUNCTION public.check_vehicle_in_authorized_zone(p_vehicle_id uuid, p_latitude numeric, p_longitude numeric) TO service_role;


--
-- Name: FUNCTION create_alert_notification(p_rule_name text, p_severity text, p_message text, p_entity_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_alert_notification(p_rule_name text, p_severity text, p_message text, p_entity_id uuid) TO postgres;
GRANT ALL ON FUNCTION public.create_alert_notification(p_rule_name text, p_severity text, p_message text, p_entity_id uuid) TO anon;
GRANT ALL ON FUNCTION public.create_alert_notification(p_rule_name text, p_severity text, p_message text, p_entity_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.create_alert_notification(p_rule_name text, p_severity text, p_message text, p_entity_id uuid) TO service_role;


--
-- Name: FUNCTION detect_geofence_violations(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.detect_geofence_violations() TO postgres;
GRANT ALL ON FUNCTION public.detect_geofence_violations() TO anon;
GRANT ALL ON FUNCTION public.detect_geofence_violations() TO authenticated;
GRANT ALL ON FUNCTION public.detect_geofence_violations() TO service_role;


--
-- Name: FUNCTION detect_vehicles_out_of_zone(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.detect_vehicles_out_of_zone() TO postgres;
GRANT ALL ON FUNCTION public.detect_vehicles_out_of_zone() TO anon;
GRANT ALL ON FUNCTION public.detect_vehicles_out_of_zone() TO authenticated;
GRANT ALL ON FUNCTION public.detect_vehicles_out_of_zone() TO service_role;


--
-- Name: FUNCTION generate_fuel_transaction_reference(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.generate_fuel_transaction_reference() TO postgres;
GRANT ALL ON FUNCTION public.generate_fuel_transaction_reference() TO anon;
GRANT ALL ON FUNCTION public.generate_fuel_transaction_reference() TO authenticated;
GRANT ALL ON FUNCTION public.generate_fuel_transaction_reference() TO service_role;


--
-- Name: FUNCTION generate_payroll_record(p_employee_id uuid, p_period_start date, p_period_end date); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.generate_payroll_record(p_employee_id uuid, p_period_start date, p_period_end date) TO postgres;
GRANT ALL ON FUNCTION public.generate_payroll_record(p_employee_id uuid, p_period_start date, p_period_end date) TO anon;
GRANT ALL ON FUNCTION public.generate_payroll_record(p_employee_id uuid, p_period_start date, p_period_end date) TO authenticated;
GRANT ALL ON FUNCTION public.generate_payroll_record(p_employee_id uuid, p_period_start date, p_period_end date) TO service_role;


--
-- Name: FUNCTION generate_random_position_in_zone(center_lat numeric, center_lng numeric, radius_meters integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.generate_random_position_in_zone(center_lat numeric, center_lng numeric, radius_meters integer) TO postgres;
GRANT ALL ON FUNCTION public.generate_random_position_in_zone(center_lat numeric, center_lng numeric, radius_meters integer) TO anon;
GRANT ALL ON FUNCTION public.generate_random_position_in_zone(center_lat numeric, center_lng numeric, radius_meters integer) TO authenticated;
GRANT ALL ON FUNCTION public.generate_random_position_in_zone(center_lat numeric, center_lng numeric, radius_meters integer) TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_admin() TO postgres;
GRANT ALL ON FUNCTION public.is_admin() TO anon;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;


--
-- Name: FUNCTION is_authenticated(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_authenticated() TO postgres;
GRANT ALL ON FUNCTION public.is_authenticated() TO anon;
GRANT ALL ON FUNCTION public.is_authenticated() TO authenticated;
GRANT ALL ON FUNCTION public.is_authenticated() TO service_role;


--
-- Name: FUNCTION is_point_in_geofence(p_latitude numeric, p_longitude numeric, p_zone_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_point_in_geofence(p_latitude numeric, p_longitude numeric, p_zone_id uuid) TO postgres;
GRANT ALL ON FUNCTION public.is_point_in_geofence(p_latitude numeric, p_longitude numeric, p_zone_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_point_in_geofence(p_latitude numeric, p_longitude numeric, p_zone_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_point_in_geofence(p_latitude numeric, p_longitude numeric, p_zone_id uuid) TO service_role;


--
-- Name: FUNCTION log_user_activity(p_action text, p_details jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.log_user_activity(p_action text, p_details jsonb) TO postgres;
GRANT ALL ON FUNCTION public.log_user_activity(p_action text, p_details jsonb) TO anon;
GRANT ALL ON FUNCTION public.log_user_activity(p_action text, p_details jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.log_user_activity(p_action text, p_details jsonb) TO service_role;


--
-- Name: FUNCTION optimize_dispatch_assignment(p_trip_id uuid, p_optimization_type text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.optimize_dispatch_assignment(p_trip_id uuid, p_optimization_type text) TO postgres;
GRANT ALL ON FUNCTION public.optimize_dispatch_assignment(p_trip_id uuid, p_optimization_type text) TO anon;
GRANT ALL ON FUNCTION public.optimize_dispatch_assignment(p_trip_id uuid, p_optimization_type text) TO authenticated;
GRANT ALL ON FUNCTION public.optimize_dispatch_assignment(p_trip_id uuid, p_optimization_type text) TO service_role;


--
-- Name: FUNCTION sync_trips_columns(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sync_trips_columns() TO postgres;
GRANT ALL ON FUNCTION public.sync_trips_columns() TO anon;
GRANT ALL ON FUNCTION public.sync_trips_columns() TO authenticated;
GRANT ALL ON FUNCTION public.sync_trips_columns() TO service_role;


--
-- Name: FUNCTION update_document_status(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_document_status() TO postgres;
GRANT ALL ON FUNCTION public.update_document_status() TO anon;
GRANT ALL ON FUNCTION public.update_document_status() TO authenticated;
GRANT ALL ON FUNCTION public.update_document_status() TO service_role;


--
-- Name: FUNCTION update_sustainability_kpis(p_date date); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_sustainability_kpis(p_date date) TO postgres;
GRANT ALL ON FUNCTION public.update_sustainability_kpis(p_date date) TO anon;
GRANT ALL ON FUNCTION public.update_sustainability_kpis(p_date date) TO authenticated;
GRANT ALL ON FUNCTION public.update_sustainability_kpis(p_date date) TO service_role;


--
-- Name: FUNCTION update_user_password(user_id uuid, new_password text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_user_password(user_id uuid, new_password text) TO postgres;
GRANT ALL ON FUNCTION public.update_user_password(user_id uuid, new_password text) TO anon;
GRANT ALL ON FUNCTION public.update_user_password(user_id uuid, new_password text) TO authenticated;
GRANT ALL ON FUNCTION public.update_user_password(user_id uuid, new_password text) TO service_role;


--
-- Name: TABLE alert_notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.alert_notifications TO postgres;
GRANT ALL ON TABLE public.alert_notifications TO anon;
GRANT ALL ON TABLE public.alert_notifications TO authenticated;
GRANT ALL ON TABLE public.alert_notifications TO service_role;


--
-- Name: TABLE alert_rules; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.alert_rules TO postgres;
GRANT ALL ON TABLE public.alert_rules TO anon;
GRANT ALL ON TABLE public.alert_rules TO authenticated;
GRANT ALL ON TABLE public.alert_rules TO service_role;


--
-- Name: TABLE alert_subscriptions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.alert_subscriptions TO postgres;
GRANT ALL ON TABLE public.alert_subscriptions TO anon;
GRANT ALL ON TABLE public.alert_subscriptions TO authenticated;
GRANT ALL ON TABLE public.alert_subscriptions TO service_role;


--
-- Name: TABLE alert_thresholds; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.alert_thresholds TO postgres;
GRANT ALL ON TABLE public.alert_thresholds TO anon;
GRANT ALL ON TABLE public.alert_thresholds TO authenticated;
GRANT ALL ON TABLE public.alert_thresholds TO service_role;


--
-- Name: TABLE alerts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.alerts TO postgres;
GRANT ALL ON TABLE public.alerts TO anon;
GRANT ALL ON TABLE public.alerts TO authenticated;
GRANT ALL ON TABLE public.alerts TO service_role;


--
-- Name: TABLE attendance; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.attendance TO postgres;
GRANT ALL ON TABLE public.attendance TO anon;
GRANT ALL ON TABLE public.attendance TO authenticated;
GRANT ALL ON TABLE public.attendance TO service_role;


--
-- Name: TABLE benchmark_comparisons; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.benchmark_comparisons TO postgres;
GRANT ALL ON TABLE public.benchmark_comparisons TO anon;
GRANT ALL ON TABLE public.benchmark_comparisons TO authenticated;
GRANT ALL ON TABLE public.benchmark_comparisons TO service_role;


--
-- Name: TABLE carbon_emissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.carbon_emissions TO postgres;
GRANT ALL ON TABLE public.carbon_emissions TO anon;
GRANT ALL ON TABLE public.carbon_emissions TO authenticated;
GRANT ALL ON TABLE public.carbon_emissions TO service_role;


--
-- Name: TABLE carbon_footprint_tracking; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.carbon_footprint_tracking TO postgres;
GRANT ALL ON TABLE public.carbon_footprint_tracking TO anon;
GRANT ALL ON TABLE public.carbon_footprint_tracking TO authenticated;
GRANT ALL ON TABLE public.carbon_footprint_tracking TO service_role;


--
-- Name: TABLE clients; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.clients TO postgres;
GRANT ALL ON TABLE public.clients TO anon;
GRANT ALL ON TABLE public.clients TO authenticated;
GRANT ALL ON TABLE public.clients TO service_role;


--
-- Name: TABLE compliance_reports; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.compliance_reports TO postgres;
GRANT ALL ON TABLE public.compliance_reports TO anon;
GRANT ALL ON TABLE public.compliance_reports TO authenticated;
GRANT ALL ON TABLE public.compliance_reports TO service_role;


--
-- Name: TABLE cost_categories; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cost_categories TO postgres;
GRANT ALL ON TABLE public.cost_categories TO anon;
GRANT ALL ON TABLE public.cost_categories TO authenticated;
GRANT ALL ON TABLE public.cost_categories TO service_role;


--
-- Name: TABLE custom_dashboards; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.custom_dashboards TO postgres;
GRANT ALL ON TABLE public.custom_dashboards TO anon;
GRANT ALL ON TABLE public.custom_dashboards TO authenticated;
GRANT ALL ON TABLE public.custom_dashboards TO service_role;


--
-- Name: TABLE customers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.customers TO postgres;
GRANT ALL ON TABLE public.customers TO anon;
GRANT ALL ON TABLE public.customers TO authenticated;
GRANT ALL ON TABLE public.customers TO service_role;


--
-- Name: TABLE cycle_tracking; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cycle_tracking TO postgres;
GRANT ALL ON TABLE public.cycle_tracking TO anon;
GRANT ALL ON TABLE public.cycle_tracking TO authenticated;
GRANT ALL ON TABLE public.cycle_tracking TO service_role;


--
-- Name: TABLE deliveries; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.deliveries TO postgres;
GRANT ALL ON TABLE public.deliveries TO anon;
GRANT ALL ON TABLE public.deliveries TO authenticated;
GRANT ALL ON TABLE public.deliveries TO service_role;


--
-- Name: TABLE dispatch_assignments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.dispatch_assignments TO postgres;
GRANT ALL ON TABLE public.dispatch_assignments TO anon;
GRANT ALL ON TABLE public.dispatch_assignments TO authenticated;
GRANT ALL ON TABLE public.dispatch_assignments TO service_role;


--
-- Name: TABLE dispatch_rules; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.dispatch_rules TO postgres;
GRANT ALL ON TABLE public.dispatch_rules TO anon;
GRANT ALL ON TABLE public.dispatch_rules TO authenticated;
GRANT ALL ON TABLE public.dispatch_rules TO service_role;


--
-- Name: TABLE dispatch_simulations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.dispatch_simulations TO postgres;
GRANT ALL ON TABLE public.dispatch_simulations TO anon;
GRANT ALL ON TABLE public.dispatch_simulations TO authenticated;
GRANT ALL ON TABLE public.dispatch_simulations TO service_role;


--
-- Name: TABLE documents; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.documents TO postgres;
GRANT ALL ON TABLE public.documents TO anon;
GRANT ALL ON TABLE public.documents TO authenticated;
GRANT ALL ON TABLE public.documents TO service_role;


--
-- Name: TABLE driver_availability; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.driver_availability TO postgres;
GRANT ALL ON TABLE public.driver_availability TO anon;
GRANT ALL ON TABLE public.driver_availability TO authenticated;
GRANT ALL ON TABLE public.driver_availability TO service_role;


--
-- Name: TABLE driver_behavior_scores; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.driver_behavior_scores TO postgres;
GRANT ALL ON TABLE public.driver_behavior_scores TO anon;
GRANT ALL ON TABLE public.driver_behavior_scores TO authenticated;
GRANT ALL ON TABLE public.driver_behavior_scores TO service_role;


--
-- Name: TABLE driver_work_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.driver_work_sessions TO postgres;
GRANT ALL ON TABLE public.driver_work_sessions TO anon;
GRANT ALL ON TABLE public.driver_work_sessions TO authenticated;
GRANT ALL ON TABLE public.driver_work_sessions TO service_role;


--
-- Name: TABLE drivers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.drivers TO postgres;
GRANT ALL ON TABLE public.drivers TO anon;
GRANT ALL ON TABLE public.drivers TO authenticated;
GRANT ALL ON TABLE public.drivers TO service_role;


--
-- Name: TABLE driving_time_regulations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.driving_time_regulations TO postgres;
GRANT ALL ON TABLE public.driving_time_regulations TO anon;
GRANT ALL ON TABLE public.driving_time_regulations TO authenticated;
GRANT ALL ON TABLE public.driving_time_regulations TO service_role;


--
-- Name: TABLE eco_driving_scores; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.eco_driving_scores TO postgres;
GRANT ALL ON TABLE public.eco_driving_scores TO anon;
GRANT ALL ON TABLE public.eco_driving_scores TO authenticated;
GRANT ALL ON TABLE public.eco_driving_scores TO service_role;


--
-- Name: TABLE employee_attendance; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.employee_attendance TO postgres;
GRANT ALL ON TABLE public.employee_attendance TO anon;
GRANT ALL ON TABLE public.employee_attendance TO authenticated;
GRANT ALL ON TABLE public.employee_attendance TO service_role;


--
-- Name: TABLE employees; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.employees TO postgres;
GRANT ALL ON TABLE public.employees TO anon;
GRANT ALL ON TABLE public.employees TO authenticated;
GRANT ALL ON TABLE public.employees TO service_role;


--
-- Name: TABLE environmental_incidents; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.environmental_incidents TO postgres;
GRANT ALL ON TABLE public.environmental_incidents TO anon;
GRANT ALL ON TABLE public.environmental_incidents TO authenticated;
GRANT ALL ON TABLE public.environmental_incidents TO service_role;


--
-- Name: TABLE esg_reports; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.esg_reports TO postgres;
GRANT ALL ON TABLE public.esg_reports TO anon;
GRANT ALL ON TABLE public.esg_reports TO authenticated;
GRANT ALL ON TABLE public.esg_reports TO service_role;


--
-- Name: TABLE expenses; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.expenses TO postgres;
GRANT ALL ON TABLE public.expenses TO anon;
GRANT ALL ON TABLE public.expenses TO authenticated;
GRANT ALL ON TABLE public.expenses TO service_role;


--
-- Name: TABLE fatigue_alerts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fatigue_alerts TO postgres;
GRANT ALL ON TABLE public.fatigue_alerts TO anon;
GRANT ALL ON TABLE public.fatigue_alerts TO authenticated;
GRANT ALL ON TABLE public.fatigue_alerts TO service_role;


--
-- Name: TABLE fleet_health_scores; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fleet_health_scores TO postgres;
GRANT ALL ON TABLE public.fleet_health_scores TO anon;
GRANT ALL ON TABLE public.fleet_health_scores TO authenticated;
GRANT ALL ON TABLE public.fleet_health_scores TO service_role;


--
-- Name: TABLE fleet_tasks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fleet_tasks TO postgres;
GRANT ALL ON TABLE public.fleet_tasks TO anon;
GRANT ALL ON TABLE public.fleet_tasks TO authenticated;
GRANT ALL ON TABLE public.fleet_tasks TO service_role;


--
-- Name: TABLE fuel_stocks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fuel_stocks TO postgres;
GRANT ALL ON TABLE public.fuel_stocks TO anon;
GRANT ALL ON TABLE public.fuel_stocks TO authenticated;
GRANT ALL ON TABLE public.fuel_stocks TO service_role;


--
-- Name: TABLE fuel_transactions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fuel_transactions TO postgres;
GRANT ALL ON TABLE public.fuel_transactions TO anon;
GRANT ALL ON TABLE public.fuel_transactions TO authenticated;
GRANT ALL ON TABLE public.fuel_transactions TO service_role;


--
-- Name: TABLE fuel_types; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fuel_types TO postgres;
GRANT ALL ON TABLE public.fuel_types TO anon;
GRANT ALL ON TABLE public.fuel_types TO authenticated;
GRANT ALL ON TABLE public.fuel_types TO service_role;


--
-- Name: TABLE geofence_alerts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.geofence_alerts TO postgres;
GRANT ALL ON TABLE public.geofence_alerts TO anon;
GRANT ALL ON TABLE public.geofence_alerts TO authenticated;
GRANT ALL ON TABLE public.geofence_alerts TO service_role;


--
-- Name: TABLE geofence_violations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.geofence_violations TO postgres;
GRANT ALL ON TABLE public.geofence_violations TO anon;
GRANT ALL ON TABLE public.geofence_violations TO authenticated;
GRANT ALL ON TABLE public.geofence_violations TO service_role;


--
-- Name: TABLE geofence_zone_assignments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.geofence_zone_assignments TO postgres;
GRANT ALL ON TABLE public.geofence_zone_assignments TO anon;
GRANT ALL ON TABLE public.geofence_zone_assignments TO authenticated;
GRANT ALL ON TABLE public.geofence_zone_assignments TO service_role;


--
-- Name: TABLE geofence_zones; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.geofence_zones TO postgres;
GRANT ALL ON TABLE public.geofence_zones TO anon;
GRANT ALL ON TABLE public.geofence_zones TO authenticated;
GRANT ALL ON TABLE public.geofence_zones TO service_role;


--
-- Name: TABLE geofences; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.geofences TO postgres;
GRANT ALL ON TABLE public.geofences TO anon;
GRANT ALL ON TABLE public.geofences TO authenticated;
GRANT ALL ON TABLE public.geofences TO service_role;


--
-- Name: TABLE incidents; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.incidents TO postgres;
GRANT ALL ON TABLE public.incidents TO anon;
GRANT ALL ON TABLE public.incidents TO authenticated;
GRANT ALL ON TABLE public.incidents TO service_role;


--
-- Name: TABLE invoice_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.invoice_items TO postgres;
GRANT ALL ON TABLE public.invoice_items TO anon;
GRANT ALL ON TABLE public.invoice_items TO authenticated;
GRANT ALL ON TABLE public.invoice_items TO service_role;


--
-- Name: TABLE invoices; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.invoices TO postgres;
GRANT ALL ON TABLE public.invoices TO anon;
GRANT ALL ON TABLE public.invoices TO authenticated;
GRANT ALL ON TABLE public.invoices TO service_role;


--
-- Name: TABLE iot_devices; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.iot_devices TO postgres;
GRANT ALL ON TABLE public.iot_devices TO anon;
GRANT ALL ON TABLE public.iot_devices TO authenticated;
GRANT ALL ON TABLE public.iot_devices TO service_role;


--
-- Name: TABLE iot_fuel_readings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.iot_fuel_readings TO postgres;
GRANT ALL ON TABLE public.iot_fuel_readings TO anon;
GRANT ALL ON TABLE public.iot_fuel_readings TO authenticated;
GRANT ALL ON TABLE public.iot_fuel_readings TO service_role;


--
-- Name: TABLE iot_gps_readings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.iot_gps_readings TO postgres;
GRANT ALL ON TABLE public.iot_gps_readings TO anon;
GRANT ALL ON TABLE public.iot_gps_readings TO authenticated;
GRANT ALL ON TABLE public.iot_gps_readings TO service_role;


--
-- Name: TABLE iot_tire_readings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.iot_tire_readings TO postgres;
GRANT ALL ON TABLE public.iot_tire_readings TO anon;
GRANT ALL ON TABLE public.iot_tire_readings TO authenticated;
GRANT ALL ON TABLE public.iot_tire_readings TO service_role;


--
-- Name: TABLE iot_weight_readings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.iot_weight_readings TO postgres;
GRANT ALL ON TABLE public.iot_weight_readings TO anon;
GRANT ALL ON TABLE public.iot_weight_readings TO authenticated;
GRANT ALL ON TABLE public.iot_weight_readings TO service_role;


--
-- Name: TABLE leave_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.leave_requests TO postgres;
GRANT ALL ON TABLE public.leave_requests TO anon;
GRANT ALL ON TABLE public.leave_requests TO authenticated;
GRANT ALL ON TABLE public.leave_requests TO service_role;


--
-- Name: TABLE maintenance_orders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.maintenance_orders TO postgres;
GRANT ALL ON TABLE public.maintenance_orders TO anon;
GRANT ALL ON TABLE public.maintenance_orders TO authenticated;
GRANT ALL ON TABLE public.maintenance_orders TO service_role;


--
-- Name: TABLE maintenance_parts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.maintenance_parts TO postgres;
GRANT ALL ON TABLE public.maintenance_parts TO anon;
GRANT ALL ON TABLE public.maintenance_parts TO authenticated;
GRANT ALL ON TABLE public.maintenance_parts TO service_role;


--
-- Name: TABLE maintenance_schedules; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.maintenance_schedules TO postgres;
GRANT ALL ON TABLE public.maintenance_schedules TO anon;
GRANT ALL ON TABLE public.maintenance_schedules TO authenticated;
GRANT ALL ON TABLE public.maintenance_schedules TO service_role;


--
-- Name: TABLE mission_requirements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mission_requirements TO postgres;
GRANT ALL ON TABLE public.mission_requirements TO anon;
GRANT ALL ON TABLE public.mission_requirements TO authenticated;
GRANT ALL ON TABLE public.mission_requirements TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notifications TO postgres;
GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: TABLE optimization_constraints; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.optimization_constraints TO postgres;
GRANT ALL ON TABLE public.optimization_constraints TO anon;
GRANT ALL ON TABLE public.optimization_constraints TO authenticated;
GRANT ALL ON TABLE public.optimization_constraints TO service_role;


--
-- Name: TABLE optimization_history; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.optimization_history TO postgres;
GRANT ALL ON TABLE public.optimization_history TO anon;
GRANT ALL ON TABLE public.optimization_history TO authenticated;
GRANT ALL ON TABLE public.optimization_history TO service_role;


--
-- Name: TABLE optimization_scenarios; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.optimization_scenarios TO postgres;
GRANT ALL ON TABLE public.optimization_scenarios TO anon;
GRANT ALL ON TABLE public.optimization_scenarios TO authenticated;
GRANT ALL ON TABLE public.optimization_scenarios TO service_role;


--
-- Name: TABLE parts_inventory; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.parts_inventory TO postgres;
GRANT ALL ON TABLE public.parts_inventory TO anon;
GRANT ALL ON TABLE public.parts_inventory TO authenticated;
GRANT ALL ON TABLE public.parts_inventory TO service_role;


--
-- Name: TABLE payments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payments TO postgres;
GRANT ALL ON TABLE public.payments TO anon;
GRANT ALL ON TABLE public.payments TO authenticated;
GRANT ALL ON TABLE public.payments TO service_role;


--
-- Name: TABLE payroll; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payroll TO postgres;
GRANT ALL ON TABLE public.payroll TO anon;
GRANT ALL ON TABLE public.payroll TO authenticated;
GRANT ALL ON TABLE public.payroll TO service_role;


--
-- Name: TABLE payroll_bonuses; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payroll_bonuses TO postgres;
GRANT ALL ON TABLE public.payroll_bonuses TO anon;
GRANT ALL ON TABLE public.payroll_bonuses TO authenticated;
GRANT ALL ON TABLE public.payroll_bonuses TO service_role;


--
-- Name: TABLE payroll_deductions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payroll_deductions TO postgres;
GRANT ALL ON TABLE public.payroll_deductions TO anon;
GRANT ALL ON TABLE public.payroll_deductions TO authenticated;
GRANT ALL ON TABLE public.payroll_deductions TO service_role;


--
-- Name: TABLE payroll_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payroll_items TO postgres;
GRANT ALL ON TABLE public.payroll_items TO anon;
GRANT ALL ON TABLE public.payroll_items TO authenticated;
GRANT ALL ON TABLE public.payroll_items TO service_role;


--
-- Name: TABLE payroll_records; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payroll_records TO postgres;
GRANT ALL ON TABLE public.payroll_records TO anon;
GRANT ALL ON TABLE public.payroll_records TO authenticated;
GRANT ALL ON TABLE public.payroll_records TO service_role;


--
-- Name: TABLE performance_kpis; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.performance_kpis TO postgres;
GRANT ALL ON TABLE public.performance_kpis TO anon;
GRANT ALL ON TABLE public.performance_kpis TO authenticated;
GRANT ALL ON TABLE public.performance_kpis TO service_role;


--
-- Name: TABLE performance_scores; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.performance_scores TO postgres;
GRANT ALL ON TABLE public.performance_scores TO anon;
GRANT ALL ON TABLE public.performance_scores TO authenticated;
GRANT ALL ON TABLE public.performance_scores TO service_role;


--
-- Name: TABLE predictive_maintenance_models; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.predictive_maintenance_models TO postgres;
GRANT ALL ON TABLE public.predictive_maintenance_models TO anon;
GRANT ALL ON TABLE public.predictive_maintenance_models TO authenticated;
GRANT ALL ON TABLE public.predictive_maintenance_models TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO postgres;
GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE purchase_order_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.purchase_order_items TO postgres;
GRANT ALL ON TABLE public.purchase_order_items TO anon;
GRANT ALL ON TABLE public.purchase_order_items TO authenticated;
GRANT ALL ON TABLE public.purchase_order_items TO service_role;


--
-- Name: TABLE purchase_orders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.purchase_orders TO postgres;
GRANT ALL ON TABLE public.purchase_orders TO anon;
GRANT ALL ON TABLE public.purchase_orders TO authenticated;
GRANT ALL ON TABLE public.purchase_orders TO service_role;


--
-- Name: TABLE quick_actions_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.quick_actions_log TO postgres;
GRANT ALL ON TABLE public.quick_actions_log TO anon;
GRANT ALL ON TABLE public.quick_actions_log TO authenticated;
GRANT ALL ON TABLE public.quick_actions_log TO service_role;


--
-- Name: TABLE reoptimization_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.reoptimization_events TO postgres;
GRANT ALL ON TABLE public.reoptimization_events TO anon;
GRANT ALL ON TABLE public.reoptimization_events TO authenticated;
GRANT ALL ON TABLE public.reoptimization_events TO service_role;


--
-- Name: TABLE rest_periods; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.rest_periods TO postgres;
GRANT ALL ON TABLE public.rest_periods TO anon;
GRANT ALL ON TABLE public.rest_periods TO authenticated;
GRANT ALL ON TABLE public.rest_periods TO service_role;


--
-- Name: TABLE role_permissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.role_permissions TO postgres;
GRANT ALL ON TABLE public.role_permissions TO anon;
GRANT ALL ON TABLE public.role_permissions TO authenticated;
GRANT ALL ON TABLE public.role_permissions TO service_role;


--
-- Name: TABLE route_optimization_suggestions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.route_optimization_suggestions TO postgres;
GRANT ALL ON TABLE public.route_optimization_suggestions TO anon;
GRANT ALL ON TABLE public.route_optimization_suggestions TO authenticated;
GRANT ALL ON TABLE public.route_optimization_suggestions TO service_role;


--
-- Name: TABLE scenario_simulations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.scenario_simulations TO postgres;
GRANT ALL ON TABLE public.scenario_simulations TO anon;
GRANT ALL ON TABLE public.scenario_simulations TO authenticated;
GRANT ALL ON TABLE public.scenario_simulations TO service_role;


--
-- Name: TABLE settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.settings TO postgres;
GRANT ALL ON TABLE public.settings TO anon;
GRANT ALL ON TABLE public.settings TO authenticated;
GRANT ALL ON TABLE public.settings TO service_role;


--
-- Name: TABLE trips; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trips TO postgres;
GRANT ALL ON TABLE public.trips TO anon;
GRANT ALL ON TABLE public.trips TO authenticated;
GRANT ALL ON TABLE public.trips TO service_role;


--
-- Name: TABLE work_shifts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.work_shifts TO postgres;
GRANT ALL ON TABLE public.work_shifts TO anon;
GRANT ALL ON TABLE public.work_shifts TO authenticated;
GRANT ALL ON TABLE public.work_shifts TO service_role;


--
-- Name: TABLE shift_performance_stats; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.shift_performance_stats TO postgres;
GRANT ALL ON TABLE public.shift_performance_stats TO anon;
GRANT ALL ON TABLE public.shift_performance_stats TO authenticated;
GRANT ALL ON TABLE public.shift_performance_stats TO service_role;


--
-- Name: TABLE shift_plans; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.shift_plans TO postgres;
GRANT ALL ON TABLE public.shift_plans TO anon;
GRANT ALL ON TABLE public.shift_plans TO authenticated;
GRANT ALL ON TABLE public.shift_plans TO service_role;


--
-- Name: TABLE sites; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sites TO postgres;
GRANT ALL ON TABLE public.sites TO anon;
GRANT ALL ON TABLE public.sites TO authenticated;
GRANT ALL ON TABLE public.sites TO service_role;


--
-- Name: TABLE smart_notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.smart_notifications TO postgres;
GRANT ALL ON TABLE public.smart_notifications TO anon;
GRANT ALL ON TABLE public.smart_notifications TO authenticated;
GRANT ALL ON TABLE public.smart_notifications TO service_role;


--
-- Name: TABLE spare_parts_catalog; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.spare_parts_catalog TO postgres;
GRANT ALL ON TABLE public.spare_parts_catalog TO anon;
GRANT ALL ON TABLE public.spare_parts_catalog TO authenticated;
GRANT ALL ON TABLE public.spare_parts_catalog TO service_role;


--
-- Name: TABLE stock_categories; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stock_categories TO postgres;
GRANT ALL ON TABLE public.stock_categories TO anon;
GRANT ALL ON TABLE public.stock_categories TO authenticated;
GRANT ALL ON TABLE public.stock_categories TO service_role;


--
-- Name: TABLE stock_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stock_items TO postgres;
GRANT ALL ON TABLE public.stock_items TO anon;
GRANT ALL ON TABLE public.stock_items TO authenticated;
GRANT ALL ON TABLE public.stock_items TO service_role;


--
-- Name: TABLE stock_movements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stock_movements TO postgres;
GRANT ALL ON TABLE public.stock_movements TO anon;
GRANT ALL ON TABLE public.stock_movements TO authenticated;
GRANT ALL ON TABLE public.stock_movements TO service_role;


--
-- Name: TABLE suppliers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.suppliers TO postgres;
GRANT ALL ON TABLE public.suppliers TO anon;
GRANT ALL ON TABLE public.suppliers TO authenticated;
GRANT ALL ON TABLE public.suppliers TO service_role;


--
-- Name: TABLE sustainability_kpis; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sustainability_kpis TO postgres;
GRANT ALL ON TABLE public.sustainability_kpis TO anon;
GRANT ALL ON TABLE public.sustainability_kpis TO authenticated;
GRANT ALL ON TABLE public.sustainability_kpis TO service_role;


--
-- Name: TABLE system_parameters; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.system_parameters TO postgres;
GRANT ALL ON TABLE public.system_parameters TO anon;
GRANT ALL ON TABLE public.system_parameters TO authenticated;
GRANT ALL ON TABLE public.system_parameters TO service_role;


--
-- Name: TABLE task_assignments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.task_assignments TO postgres;
GRANT ALL ON TABLE public.task_assignments TO anon;
GRANT ALL ON TABLE public.task_assignments TO authenticated;
GRANT ALL ON TABLE public.task_assignments TO service_role;


--
-- Name: TABLE tco_analysis; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tco_analysis TO postgres;
GRANT ALL ON TABLE public.tco_analysis TO anon;
GRANT ALL ON TABLE public.tco_analysis TO authenticated;
GRANT ALL ON TABLE public.tco_analysis TO service_role;


--
-- Name: TABLE tire_alerts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_alerts TO postgres;
GRANT ALL ON TABLE public.tire_alerts TO anon;
GRANT ALL ON TABLE public.tire_alerts TO authenticated;
GRANT ALL ON TABLE public.tire_alerts TO service_role;


--
-- Name: TABLE tire_brands; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_brands TO postgres;
GRANT ALL ON TABLE public.tire_brands TO anon;
GRANT ALL ON TABLE public.tire_brands TO authenticated;
GRANT ALL ON TABLE public.tire_brands TO service_role;


--
-- Name: TABLE tire_cost_analysis; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_cost_analysis TO postgres;
GRANT ALL ON TABLE public.tire_cost_analysis TO anon;
GRANT ALL ON TABLE public.tire_cost_analysis TO authenticated;
GRANT ALL ON TABLE public.tire_cost_analysis TO service_role;


--
-- Name: TABLE tire_dismounting_operations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_dismounting_operations TO postgres;
GRANT ALL ON TABLE public.tire_dismounting_operations TO anon;
GRANT ALL ON TABLE public.tire_dismounting_operations TO authenticated;
GRANT ALL ON TABLE public.tire_dismounting_operations TO service_role;


--
-- Name: TABLE tire_inspections; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_inspections TO postgres;
GRANT ALL ON TABLE public.tire_inspections TO anon;
GRANT ALL ON TABLE public.tire_inspections TO authenticated;
GRANT ALL ON TABLE public.tire_inspections TO service_role;


--
-- Name: TABLE tire_installations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_installations TO postgres;
GRANT ALL ON TABLE public.tire_installations TO anon;
GRANT ALL ON TABLE public.tire_installations TO authenticated;
GRANT ALL ON TABLE public.tire_installations TO service_role;


--
-- Name: TABLE tire_inventory; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_inventory TO postgres;
GRANT ALL ON TABLE public.tire_inventory TO anon;
GRANT ALL ON TABLE public.tire_inventory TO authenticated;
GRANT ALL ON TABLE public.tire_inventory TO service_role;


--
-- Name: TABLE tire_maintenance_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_maintenance_events TO postgres;
GRANT ALL ON TABLE public.tire_maintenance_events TO anon;
GRANT ALL ON TABLE public.tire_maintenance_events TO authenticated;
GRANT ALL ON TABLE public.tire_maintenance_events TO service_role;


--
-- Name: TABLE tire_models; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_models TO postgres;
GRANT ALL ON TABLE public.tire_models TO anon;
GRANT ALL ON TABLE public.tire_models TO authenticated;
GRANT ALL ON TABLE public.tire_models TO service_role;


--
-- Name: TABLE tire_mounting_operations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_mounting_operations TO postgres;
GRANT ALL ON TABLE public.tire_mounting_operations TO anon;
GRANT ALL ON TABLE public.tire_mounting_operations TO authenticated;
GRANT ALL ON TABLE public.tire_mounting_operations TO service_role;


--
-- Name: TABLE tire_performance_metrics; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_performance_metrics TO postgres;
GRANT ALL ON TABLE public.tire_performance_metrics TO anon;
GRANT ALL ON TABLE public.tire_performance_metrics TO authenticated;
GRANT ALL ON TABLE public.tire_performance_metrics TO service_role;


--
-- Name: TABLE tire_po_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_po_items TO postgres;
GRANT ALL ON TABLE public.tire_po_items TO anon;
GRANT ALL ON TABLE public.tire_po_items TO authenticated;
GRANT ALL ON TABLE public.tire_po_items TO service_role;


--
-- Name: TABLE tire_purchase_orders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_purchase_orders TO postgres;
GRANT ALL ON TABLE public.tire_purchase_orders TO anon;
GRANT ALL ON TABLE public.tire_purchase_orders TO authenticated;
GRANT ALL ON TABLE public.tire_purchase_orders TO service_role;


--
-- Name: TABLE tire_purchase_recommendations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_purchase_recommendations TO postgres;
GRANT ALL ON TABLE public.tire_purchase_recommendations TO anon;
GRANT ALL ON TABLE public.tire_purchase_recommendations TO authenticated;
GRANT ALL ON TABLE public.tire_purchase_recommendations TO service_role;


--
-- Name: TABLE tire_quality_controls; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_quality_controls TO postgres;
GRANT ALL ON TABLE public.tire_quality_controls TO anon;
GRANT ALL ON TABLE public.tire_quality_controls TO authenticated;
GRANT ALL ON TABLE public.tire_quality_controls TO service_role;


--
-- Name: TABLE tire_removals; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_removals TO postgres;
GRANT ALL ON TABLE public.tire_removals TO anon;
GRANT ALL ON TABLE public.tire_removals TO authenticated;
GRANT ALL ON TABLE public.tire_removals TO service_role;


--
-- Name: TABLE tire_retreads; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_retreads TO postgres;
GRANT ALL ON TABLE public.tire_retreads TO anon;
GRANT ALL ON TABLE public.tire_retreads TO authenticated;
GRANT ALL ON TABLE public.tire_retreads TO service_role;


--
-- Name: TABLE tire_rotations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_rotations TO postgres;
GRANT ALL ON TABLE public.tire_rotations TO anon;
GRANT ALL ON TABLE public.tire_rotations TO authenticated;
GRANT ALL ON TABLE public.tire_rotations TO service_role;


--
-- Name: TABLE tire_sensor_readings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_sensor_readings TO postgres;
GRANT ALL ON TABLE public.tire_sensor_readings TO anon;
GRANT ALL ON TABLE public.tire_sensor_readings TO authenticated;
GRANT ALL ON TABLE public.tire_sensor_readings TO service_role;


--
-- Name: TABLE tire_sensors; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_sensors TO postgres;
GRANT ALL ON TABLE public.tire_sensors TO anon;
GRANT ALL ON TABLE public.tire_sensors TO authenticated;
GRANT ALL ON TABLE public.tire_sensors TO service_role;


--
-- Name: TABLE tire_stock_forecasts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_stock_forecasts TO postgres;
GRANT ALL ON TABLE public.tire_stock_forecasts TO anon;
GRANT ALL ON TABLE public.tire_stock_forecasts TO authenticated;
GRANT ALL ON TABLE public.tire_stock_forecasts TO service_role;


--
-- Name: TABLE tire_supplier_scores; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_supplier_scores TO postgres;
GRANT ALL ON TABLE public.tire_supplier_scores TO anon;
GRANT ALL ON TABLE public.tire_supplier_scores TO authenticated;
GRANT ALL ON TABLE public.tire_supplier_scores TO service_role;


--
-- Name: TABLE tire_suppliers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_suppliers TO postgres;
GRANT ALL ON TABLE public.tire_suppliers TO anon;
GRANT ALL ON TABLE public.tire_suppliers TO authenticated;
GRANT ALL ON TABLE public.tire_suppliers TO service_role;


--
-- Name: TABLE tire_transfers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_transfers TO postgres;
GRANT ALL ON TABLE public.tire_transfers TO anon;
GRANT ALL ON TABLE public.tire_transfers TO authenticated;
GRANT ALL ON TABLE public.tire_transfers TO service_role;


--
-- Name: TABLE tire_usage_analysis; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_usage_analysis TO postgres;
GRANT ALL ON TABLE public.tire_usage_analysis TO anon;
GRANT ALL ON TABLE public.tire_usage_analysis TO authenticated;
GRANT ALL ON TABLE public.tire_usage_analysis TO service_role;


--
-- Name: TABLE tire_usage_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_usage_logs TO postgres;
GRANT ALL ON TABLE public.tire_usage_logs TO anon;
GRANT ALL ON TABLE public.tire_usage_logs TO authenticated;
GRANT ALL ON TABLE public.tire_usage_logs TO service_role;


--
-- Name: TABLE tire_usage_zones; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_usage_zones TO postgres;
GRANT ALL ON TABLE public.tire_usage_zones TO anon;
GRANT ALL ON TABLE public.tire_usage_zones TO authenticated;
GRANT ALL ON TABLE public.tire_usage_zones TO service_role;


--
-- Name: TABLE tire_work_orders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tire_work_orders TO postgres;
GRANT ALL ON TABLE public.tire_work_orders TO anon;
GRANT ALL ON TABLE public.tire_work_orders TO authenticated;
GRANT ALL ON TABLE public.tire_work_orders TO service_role;


--
-- Name: TABLE tires; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tires TO postgres;
GRANT ALL ON TABLE public.tires TO anon;
GRANT ALL ON TABLE public.tires TO authenticated;
GRANT ALL ON TABLE public.tires TO service_role;


--
-- Name: TABLE tracking_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tracking_events TO postgres;
GRANT ALL ON TABLE public.tracking_events TO anon;
GRANT ALL ON TABLE public.tracking_events TO authenticated;
GRANT ALL ON TABLE public.tracking_events TO service_role;


--
-- Name: TABLE trailers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trailers TO postgres;
GRANT ALL ON TABLE public.trailers TO anon;
GRANT ALL ON TABLE public.trailers TO authenticated;
GRANT ALL ON TABLE public.trailers TO service_role;


--
-- Name: TABLE training_needs_analysis; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.training_needs_analysis TO postgres;
GRANT ALL ON TABLE public.training_needs_analysis TO anon;
GRANT ALL ON TABLE public.training_needs_analysis TO authenticated;
GRANT ALL ON TABLE public.training_needs_analysis TO service_role;


--
-- Name: TABLE trip_route_tracking; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trip_route_tracking TO postgres;
GRANT ALL ON TABLE public.trip_route_tracking TO anon;
GRANT ALL ON TABLE public.trip_route_tracking TO authenticated;
GRANT ALL ON TABLE public.trip_route_tracking TO service_role;


--
-- Name: TABLE trip_routes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trip_routes TO postgres;
GRANT ALL ON TABLE public.trip_routes TO anon;
GRANT ALL ON TABLE public.trip_routes TO authenticated;
GRANT ALL ON TABLE public.trip_routes TO service_role;


--
-- Name: TABLE trip_waypoints; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trip_waypoints TO postgres;
GRANT ALL ON TABLE public.trip_waypoints TO anon;
GRANT ALL ON TABLE public.trip_waypoints TO authenticated;
GRANT ALL ON TABLE public.trip_waypoints TO service_role;


--
-- Name: TABLE user_activity_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_activity_logs TO postgres;
GRANT ALL ON TABLE public.user_activity_logs TO anon;
GRANT ALL ON TABLE public.user_activity_logs TO authenticated;
GRANT ALL ON TABLE public.user_activity_logs TO service_role;


--
-- Name: TABLE user_permissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_permissions TO postgres;
GRANT ALL ON TABLE public.user_permissions TO anon;
GRANT ALL ON TABLE public.user_permissions TO authenticated;
GRANT ALL ON TABLE public.user_permissions TO service_role;


--
-- Name: TABLE user_preferences; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_preferences TO postgres;
GRANT ALL ON TABLE public.user_preferences TO anon;
GRANT ALL ON TABLE public.user_preferences TO authenticated;
GRANT ALL ON TABLE public.user_preferences TO service_role;


--
-- Name: TABLE vehicle_availability; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.vehicle_availability TO postgres;
GRANT ALL ON TABLE public.vehicle_availability TO anon;
GRANT ALL ON TABLE public.vehicle_availability TO authenticated;
GRANT ALL ON TABLE public.vehicle_availability TO service_role;


--
-- Name: TABLE vehicle_costs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.vehicle_costs TO postgres;
GRANT ALL ON TABLE public.vehicle_costs TO anon;
GRANT ALL ON TABLE public.vehicle_costs TO authenticated;
GRANT ALL ON TABLE public.vehicle_costs TO service_role;


--
-- Name: TABLE vehicle_documents; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.vehicle_documents TO postgres;
GRANT ALL ON TABLE public.vehicle_documents TO anon;
GRANT ALL ON TABLE public.vehicle_documents TO authenticated;
GRANT ALL ON TABLE public.vehicle_documents TO service_role;


--
-- Name: TABLE vehicle_tracking; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.vehicle_tracking TO postgres;
GRANT ALL ON TABLE public.vehicle_tracking TO anon;
GRANT ALL ON TABLE public.vehicle_tracking TO authenticated;
GRANT ALL ON TABLE public.vehicle_tracking TO service_role;


--
-- Name: TABLE vehicle_upgrade_recommendations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.vehicle_upgrade_recommendations TO postgres;
GRANT ALL ON TABLE public.vehicle_upgrade_recommendations TO anon;
GRANT ALL ON TABLE public.vehicle_upgrade_recommendations TO authenticated;
GRANT ALL ON TABLE public.vehicle_upgrade_recommendations TO service_role;


--
-- Name: TABLE vehicles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.vehicles TO postgres;
GRANT ALL ON TABLE public.vehicles TO anon;
GRANT ALL ON TABLE public.vehicles TO authenticated;
GRANT ALL ON TABLE public.vehicles TO service_role;


--
-- Name: TABLE warehouses; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.warehouses TO postgres;
GRANT ALL ON TABLE public.warehouses TO anon;
GRANT ALL ON TABLE public.warehouses TO authenticated;
GRANT ALL ON TABLE public.warehouses TO service_role;


--
-- Name: TABLE waste_management; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.waste_management TO postgres;
GRANT ALL ON TABLE public.waste_management TO anon;
GRANT ALL ON TABLE public.waste_management TO authenticated;
GRANT ALL ON TABLE public.waste_management TO service_role;


--
-- Name: TABLE weighings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.weighings TO postgres;
GRANT ALL ON TABLE public.weighings TO anon;
GRANT ALL ON TABLE public.weighings TO authenticated;
GRANT ALL ON TABLE public.weighings TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--


-- Donnees de reference : matrice role x module
--
-- PostgreSQL database dump
--



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.role_permissions VALUES ('ae3aa703-e3b9-4b52-96ad-16760f11687f', 'admin', 'dashboard', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('50ef75c8-69ec-4bf8-91ad-4a3c716c6944', 'admin', 'vehicles', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('8eb99f38-34e0-47e9-8e71-44fbf2c60e8d', 'admin', 'drivers', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('2d9d7040-98de-4f62-9318-5ee6622158ea', 'admin', 'trips', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('9e4c8b76-bd67-4f4b-96c8-084167ff7f86', 'admin', 'gps_tracking', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('9302d394-32cd-4cf3-bdb5-1a4348759ad4', 'admin', 'fuel', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('2bfe1a72-5e18-45fe-af32-5fd9d0a21e0e', 'admin', 'maintenance', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('a49cbde1-4312-4ed5-b1fe-6b78274cacd5', 'admin', 'stock', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('9a758ab2-905b-4d54-ac27-128d502f88ec', 'admin', 'purchases', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('cdef4f8a-bae2-40b3-a939-d074c7f6c5ad', 'admin', 'invoices', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('128eed3e-9fa9-4060-ab60-5f19e8076aa2', 'admin', 'costs', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('82ecbccf-2ab8-49eb-9412-f0be58c03199', 'admin', 'hr', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('107a09b3-fa2e-418d-abf4-5c7d9abba1db', 'admin', 'reports', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('ec02fac7-9eb7-4cf2-ab9a-11570bcdb4e6', 'admin', 'settings', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('d8c07423-85d6-48ab-80df-b6696fbd27f5', 'admin', 'iot', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('d653fa42-3113-42ae-bb33-4da4bfc41983', 'admin', 'esg', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('34086c1d-e062-4291-86d0-4f4cff3cd033', 'admin', 'ai_analytics', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('aff68075-bb8a-4252-ac1c-87d2260706c8', 'admin', 'geofencing', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('bf8c53b1-8b41-4c2c-bb19-baa5685c1fc7', 'admin', 'client_portal', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('119dcd23-86b5-4639-9313-1032bb713d97', 'manager', 'dashboard', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('5a320833-1e19-4663-8593-dfb3c828c1e7', 'manager', 'vehicles', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('57703bae-5826-4552-9dbc-032cbde0eed1', 'manager', 'drivers', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('e12cbc50-d5cf-436d-b2cb-4da61869dbbd', 'manager', 'trips', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('73ac767c-867c-4c1f-ab8d-222c9c8290c5', 'manager', 'gps_tracking', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('2a7f5ffe-7cb1-4d98-9693-08652b982105', 'manager', 'fuel', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('1e5047b5-745f-439f-a66e-9e7ae11af405', 'manager', 'maintenance', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('7442ffb9-d008-48fa-815c-61922e83d49d', 'manager', 'stock', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('ba2bd082-2967-4c9c-b18b-436ff5428bbf', 'manager', 'purchases', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('de6f20e1-5698-4fb9-b1c7-757a084e1522', 'manager', 'invoices', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('46001aae-4682-409f-ba4b-4c9628a2f086', 'manager', 'costs', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('a146b17f-3034-43f3-8650-dc8ce825cf1b', 'manager', 'hr', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('aa3bfdc2-9c97-4907-b958-a42bf6cfd40d', 'manager', 'reports', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('81d6377b-b3b1-4687-a3ac-046de5c0246a', 'manager', 'settings', true, false, true, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('d71a5845-fd81-4942-8bde-3f0d971aac65', 'manager', 'iot', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('6f7925d0-b201-497f-9324-36d289b183a4', 'manager', 'esg', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('13200112-557b-4599-a7c5-dcde07fc46e3', 'manager', 'ai_analytics', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('c3253e58-f106-427e-9534-b31c4cbb288f', 'manager', 'geofencing', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('bd550b7b-7e16-42e7-9a54-bce562c86d94', 'manager', 'client_portal', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('0eeea6ca-da28-48d5-9076-3dbc89338bcb', 'dispatcher', 'dashboard', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('7fd31753-d914-4e9d-bfa9-265046498e2f', 'dispatcher', 'vehicles', true, false, true, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('b446d282-c54c-47a2-913d-f3b130a3f308', 'dispatcher', 'drivers', true, false, true, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('a5ce5be5-ecce-4218-9f22-826ce5549209', 'dispatcher', 'trips', true, true, true, true, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('3414bc42-d9ba-4917-87f1-dd80ad119ff8', 'dispatcher', 'gps_tracking', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('ae35814d-978d-4b08-abd3-4ecf905cafb8', 'dispatcher', 'fuel', true, true, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('8164358c-cac8-4e7c-a804-c3a58aae9fb2', 'dispatcher', 'maintenance', true, true, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('9ae93a4c-e931-45e5-9bfa-c55f17603b89', 'dispatcher', 'stock', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('8d44768d-6b9c-40ad-84ec-1dedb77a0a58', 'dispatcher', 'purchases', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('56e645c3-2a3c-4c82-9d17-260791b703e1', 'dispatcher', 'invoices', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('d3209068-f0bf-48a6-8ce6-fbdb5738ff86', 'dispatcher', 'costs', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('8902d902-e5fe-4107-8b54-32ebaa281c9b', 'dispatcher', 'hr', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('aa022f13-e786-4247-a7da-a2139a4e4512', 'dispatcher', 'reports', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('b3950da7-2b1c-430c-8510-b906e4f68da8', 'dispatcher', 'settings', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('0dc597a0-e1be-4f08-8f97-fe9726450da9', 'dispatcher', 'iot', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('acf3e549-1bea-49f3-9416-cd1677796966', 'dispatcher', 'esg', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('cb76dc3e-016b-42fe-b90c-46d343f20179', 'dispatcher', 'ai_analytics', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('778549cf-b610-4caf-9bd9-7dc0c4918364', 'dispatcher', 'geofencing', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('b52800bf-ec73-4c0a-a974-d1e751993b77', 'dispatcher', 'client_portal', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('ea2629db-96e6-4615-91d7-24a6395db67f', 'logistician', 'dashboard', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('ee01c75a-e6ae-4af2-a169-0319e351042b', 'logistician', 'vehicles', true, false, true, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('da919115-71ed-4b6d-838d-8921370acb5b', 'logistician', 'drivers', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('79b16dd6-28d8-4de1-ab3d-61a04cd36891', 'logistician', 'trips', true, true, true, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('1c220fef-c6ba-4c32-bf54-f4556f78ab9e', 'logistician', 'gps_tracking', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('5fc3045d-2428-49ef-9368-a4f522b500e2', 'logistician', 'fuel', true, true, true, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('cd613cb6-9870-4db5-a1f5-abfdc69cc401', 'logistician', 'maintenance', true, true, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('3e9ee71a-e243-44fd-b589-daef8a40cada', 'logistician', 'stock', true, true, true, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('ee0e1f54-ae9f-40f5-b95b-dd660b706319', 'logistician', 'purchases', true, true, true, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('acefd108-12a3-400f-9b91-1e3edc96e9f3', 'logistician', 'invoices', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('af7fe54d-25c9-441f-adb7-744b3eb9a794', 'logistician', 'costs', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('2dd315d3-6f3d-4bd1-aa09-e7e9e5dd81d0', 'logistician', 'hr', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('9e25445c-68a4-4a53-abb0-58a55ffb061b', 'logistician', 'reports', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('b82fdfad-6622-45a8-8b94-40abd9858f2e', 'logistician', 'settings', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('d1a57c52-c7d4-4cd0-b56f-e3cb9732cf38', 'logistician', 'iot', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('9f241fd8-7b4e-433f-adf3-3ea22d340114', 'logistician', 'esg', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('8cda0c77-e5ec-4ae3-aedc-08155ce2c125', 'logistician', 'ai_analytics', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('fe348331-424a-4873-9d5b-a9a9c16023fc', 'logistician', 'geofencing', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('ebb0358f-d100-429f-864a-c266fb74a2c5', 'logistician', 'client_portal', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('3d218686-c3f8-48b7-8c76-fe06f90c1373', 'accountant', 'dashboard', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('db2bf00a-d46b-43dd-97cb-f475312f7de9', 'accountant', 'vehicles', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('859c4a94-a8ba-4f11-862d-9c6bbba9d326', 'accountant', 'drivers', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('a6852582-3e94-4305-8aef-04297ba8f511', 'accountant', 'trips', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('8f841aa8-cc4d-4eb3-886f-8191c94cf8d4', 'accountant', 'gps_tracking', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('81f250f1-f00f-4fb0-810a-0676095ba02b', 'accountant', 'fuel', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('b2007f77-2a84-4f66-bb3e-bd3152848105', 'accountant', 'maintenance', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('3246dbd5-f2e0-448d-ba44-198a89bc3741', 'accountant', 'stock', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('91e3bee3-8696-47a8-8cdb-eff691be5000', 'accountant', 'purchases', true, false, true, false, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('f4b39eee-6360-4ad3-933f-0f3522ed11c7', 'accountant', 'invoices', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('afdf14d9-ab78-4497-ba6e-504a70f6d013', 'accountant', 'costs', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('d4deb259-34f3-4ea5-8ef5-46c45fe29b80', 'accountant', 'hr', true, true, true, true, true, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('5477e9be-0aef-4b44-aa69-4564cd8c2fb1', 'accountant', 'reports', true, true, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('485b0aba-0328-49f3-a8ce-07244bfa113c', 'accountant', 'settings', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('354db91f-86c4-4add-ba9a-1449c69831f7', 'accountant', 'iot', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('cf7dfaff-46e1-491b-a133-ad9c114bd2bd', 'accountant', 'esg', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('5d0d39a1-9375-4281-af8f-f516052dcf6a', 'accountant', 'ai_analytics', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('26e0462d-b62b-4632-8c74-ce013ace6116', 'accountant', 'geofencing', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('a6678e1b-8ce0-40c1-83d5-e4bee945169b', 'accountant', 'client_portal', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('c722e89a-a02e-4bc8-9553-57b7fd3e8587', 'mechanic', 'dashboard', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('15c04af9-cec3-4d77-8587-30443c92de5e', 'mechanic', 'vehicles', true, false, true, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('9b5bab7a-2434-49f5-a638-77e0df4ddc10', 'mechanic', 'drivers', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('1dd7eaf2-43bc-400a-8161-84fcde494aa9', 'mechanic', 'trips', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('825b252d-d5f5-48ed-ad40-5b10a26da76e', 'mechanic', 'gps_tracking', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('f12e7505-aca3-487a-8a4e-afa6f6845e22', 'mechanic', 'fuel', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('c9beda91-364c-48be-98f0-08dec5a30080', 'mechanic', 'maintenance', true, true, true, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('2c5f9480-c492-4318-9180-a72e0835ace4', 'mechanic', 'stock', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('553277f5-070e-4ae6-a084-398f1a9d1be7', 'mechanic', 'purchases', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('5156bda5-bb46-4c19-b4c5-7b5b7ef363df', 'mechanic', 'invoices', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('6bd7ad05-0243-485f-b6b5-573c73bc5c59', 'mechanic', 'costs', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('f96e1e6e-9b50-40d7-8311-582679d92f08', 'mechanic', 'hr', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('afd786fd-5492-45f7-b7b7-d79152c368d1', 'mechanic', 'reports', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('d9012d48-3218-49e9-94d8-b1b3b4103242', 'mechanic', 'settings', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('7321c9a9-cf16-4335-995f-0ced705da6bf', 'mechanic', 'iot', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('71679c84-47f7-4a59-b21b-f8d60204551c', 'mechanic', 'esg', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('aef9fd3e-7fe3-4c5d-bbce-734408133ac0', 'mechanic', 'ai_analytics', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('872e800d-971b-434a-8939-5f4f955dcb5e', 'mechanic', 'geofencing', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('45b56c96-449c-44ff-9ec1-723a6e515e2c', 'mechanic', 'client_portal', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('0cbf6e49-e2ba-4f58-a2f7-f16024977c32', 'driver', 'dashboard', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('9f925f0f-5e0a-4608-8bec-fac33517d4d1', 'driver', 'vehicles', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('fe8c2f9a-a474-483f-83eb-e1f007bbcc21', 'driver', 'drivers', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('bee0d56b-d900-4a8c-89ae-56064466f9a7', 'driver', 'trips', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('308003b1-d94d-4a78-b7f5-403179433af3', 'driver', 'gps_tracking', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('2dc56754-3890-4f8b-8be9-9aa0b36452d6', 'driver', 'fuel', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('879aba74-88b1-444d-a437-f307e3fbf3fa', 'driver', 'maintenance', true, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('73105381-af2b-47a9-8645-f4020ad84cdf', 'driver', 'stock', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('3ebe41fc-73c4-410c-b80a-ce430382189d', 'driver', 'purchases', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('f9d29a08-4189-4e49-9412-cad32ebc7e70', 'driver', 'invoices', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('9443830e-9fb5-4681-bdf7-2ed5802cf41a', 'driver', 'costs', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('dbf253e9-8a67-457e-85bd-fa34224e76a9', 'driver', 'hr', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('38d2859d-031b-4d96-b55b-3ceb124ec95f', 'driver', 'reports', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('cca0cdca-e3a1-4d93-a890-351289dcc6fd', 'driver', 'settings', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('f1ccceb2-ebe6-4648-b1eb-93f5fda7b63b', 'driver', 'iot', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('13dcbaa0-6f5e-42c0-a936-3b010cda4632', 'driver', 'esg', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('a09f7c69-0fe8-4366-878e-455961078c5b', 'driver', 'ai_analytics', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('2c2f95a8-6829-4954-a6dc-27534b3b96fd', 'driver', 'geofencing', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');
INSERT INTO public.role_permissions VALUES ('b5100424-15e0-435e-89df-2031df38900b', 'driver', 'client_portal', false, false, false, false, false, '2026-11-09 12:56:40.176483+00');


--
-- PostgreSQL database dump complete
--


SELECT pg_catalog.set_config('search_path', 'public', false);
