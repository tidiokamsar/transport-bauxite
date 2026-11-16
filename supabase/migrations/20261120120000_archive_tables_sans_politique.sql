/*
  # Tables publiques a RLS active sans politique (D-071, decision du
  # proprietaire du 2026-11-15, D-069 point 4)

  Inventaire de la production le 2026-11-15, verifie a nouveau le 2026-11-16
  apres D-072 : 47 tables du schema public ont
  la RLS active et aucune politique (heritage Bolt). Aucune suppression.

  1. Archivage reversible : les 38 tables qu'aucun code ne lit (ecran, test,
     fonction Edge, migration ; `shift_plans` et `smart_notifications` ne sont
     cites que par des commentaires) passent dans le schema `archive_bolt`.
     Toutes sont vides en production. Les cles etrangeres entrantes
     (`fatigue_alerts`, `rest_periods` vers `driver_work_sessions` ;
     `tire_models` vers `tire_brands`) restent valides apres le changement de
     schema. Le schema n'est ouvert a aucun role applicatif. Retour arriere :
     `ALTER TABLE archive_bolt.<table> SET SCHEMA public;`.
  2. Les six fonctions heritees qui lisent ces tables (aucun appelant) ne
     sont plus executables par les comptes.
  3. Les 9 tables encore lues recoivent une politique explicite ; les droits
     d'ecriture herites de `anon` et `authenticated` sont retires :
     - mesures IoT (`iot_devices`, `iot_gps_readings`, `iot_tire_readings`,
       `iot_weight_readings`) : lecture `gps_tracking` ou `iot` et perimetre
       de l'engin ; ecriture par la fonction Edge d'ingestion seulement
       (service_role) ; la cle `iot_devices.api_key` n'est pas lisible depuis
       le navigateur (droit par colonne) ;
     - trajets (`trip_waypoints`, `trip_route_tracking`) : lecture `trips`
       ou `gps_tracking` et perimetre du voyage ; aucune ecriture navigateur ;
     - `geofence_zone_assignments` : lecture `gps_tracking` et perimetre de
       l'engin ; aucune ecriture navigateur (aucun ecran n'en ecrit ; la
       fonction Edge `geofence-monitor` lit en service_role) ;
     - `quick_actions_log` : chacun ecrit et lit ses propres lignes ;
     - `waste_management` : lecture du module `esg`, perimetre de l'engin
       source quand il est renseigne ; aucune ecriture navigateur tant
       qu'aucun ecran n'en a besoin (moindre privilege).

  4. Les cles etrangeres de `public` vers `archive_bolt` (`tire_models`,
     `fatigue_alerts`, `rest_periods`) imposent de restaurer aussi ce schema :
     `deploy/vps/restaurer.sh` le cree et le restaure.

  Idempotent.
*/

CREATE SCHEMA IF NOT EXISTS archive_bolt;
REVOKE ALL ON SCHEMA archive_bolt FROM PUBLIC, anon, authenticated;
COMMENT ON SCHEMA archive_bolt IS 'Tables heritees de Bolt sans lecteur, archivees le 2026-11-16 (D-071). Reversible par SET SCHEMA public.';

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'alert_subscriptions', 'benchmark_comparisons', 'carbon_footprint_tracking', 'compliance_reports',
    'custom_dashboards', 'cycle_tracking', 'driver_work_sessions', 'fleet_tasks', 'optimization_constraints',
    'optimization_scenarios', 'performance_kpis', 'reoptimization_events', 'route_optimization_suggestions',
    'scenario_simulations', 'task_assignments', 'tire_brands', 'tire_cost_analysis', 'tire_dismounting_operations',
    'tire_inspections', 'tire_mounting_operations', 'tire_performance_metrics', 'tire_purchase_recommendations',
    'tire_quality_controls', 'tire_rotations', 'tire_sensor_readings', 'tire_sensors', 'tire_stock_forecasts',
    'tire_supplier_scores', 'tire_usage_analysis', 'tire_usage_logs', 'tire_usage_zones', 'tire_work_orders',
    'training_needs_analysis', 'trip_routes', 'vehicle_availability', 'vehicle_upgrade_recommendations',
    'shift_plans', 'smart_notifications'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL AND to_regclass('archive_bolt.' || t) IS NULL THEN
      EXECUTE format('ALTER TABLE public.%I SET SCHEMA archive_bolt', t);
    END IF;
    IF to_regclass('archive_bolt.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON archive_bolt.%I FROM PUBLIC, anon, authenticated', t);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname IN ('calculate_fatigue_score', 'calculate_tire_cost_per_tonne_km',
              'calculate_tire_performance_metrics', 'check_alert_conditions', 'check_fatigue_violations', 'optimize_dispatch_assignment') LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
  END LOOP;
END $$;

-- 3. Politiques explicites des 9 tables encore lues
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['iot_devices', 'iot_gps_readings', 'iot_tire_readings', 'iot_weight_readings',
                           'trip_waypoints', 'trip_route_tracking', 'geofence_zone_assignments', 'quick_actions_log', 'waste_management'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- La cle d'authentification du boitier (`api_key`, controlee par la fonction
-- Edge d'ingestion en service_role) n'est pas lisible depuis le navigateur.
REVOKE SELECT ON public.iot_devices FROM authenticated;
GRANT SELECT (id, device_id, device_type, manufacturer, model, vehicle_id, installation_date, status,
              configuration, created_at, updated_at) ON public.iot_devices TO authenticated;

CREATE POLICY lecture ON public.iot_devices FOR SELECT TO authenticated
  USING ((public.has_module_view('gps_tracking') OR public.has_module_view('iot') OR public.is_admin()) AND public.vehicule_permis(vehicle_id));
CREATE POLICY lecture ON public.iot_gps_readings FOR SELECT TO authenticated
  USING ((public.has_module_view('gps_tracking') OR public.has_module_view('iot') OR public.is_admin()) AND public.vehicule_permis(vehicle_id));
CREATE POLICY lecture ON public.iot_tire_readings FOR SELECT TO authenticated
  USING ((public.has_module_view('gps_tracking') OR public.has_module_view('iot') OR public.is_admin()) AND public.vehicule_permis(vehicle_id));
CREATE POLICY lecture ON public.iot_weight_readings FOR SELECT TO authenticated
  USING ((public.has_module_view('gps_tracking') OR public.has_module_view('iot') OR public.is_admin()) AND public.vehicule_permis(vehicle_id));
CREATE POLICY lecture ON public.trip_waypoints FOR SELECT TO authenticated
  USING ((public.has_module_view('trips') OR public.has_module_view('gps_tracking') OR public.is_admin()) AND public.voyage_permis(trip_id));
CREATE POLICY lecture ON public.trip_route_tracking FOR SELECT TO authenticated
  USING ((public.has_module_view('trips') OR public.has_module_view('gps_tracking') OR public.is_admin()) AND public.voyage_permis(trip_id));
CREATE POLICY lecture ON public.geofence_zone_assignments FOR SELECT TO authenticated
  USING ((public.has_module_view('gps_tracking') OR public.is_admin()) AND public.vehicule_permis(vehicle_id));
GRANT INSERT ON public.quick_actions_log TO authenticated;
CREATE POLICY lecture_personnelle ON public.quick_actions_log FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY ecriture_personnelle ON public.quick_actions_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY lecture ON public.waste_management FOR SELECT TO authenticated
  USING ((public.has_module_view('esg') OR public.is_admin())
         AND (source_vehicle_id IS NULL OR public.vehicule_permis(source_vehicle_id)));
