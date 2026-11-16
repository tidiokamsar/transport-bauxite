-- Tests (D-071) : archivage des tables heritees sans lecteur dans le schema
-- archive_bolt, politiques explicites des 9 tables encore lues, cle des
-- boitiers IoT non lisible, perimetre site des mesures, journal des actions
-- rapides personnel (migration 20261120120000). Tout est annule.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

CREATE FUNCTION pg_temp.se_connecter(p_id uuid) RETURNS void
LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', coalesce(p_id::text, ''), true),
         set_config('request.jwt.claims',
           CASE WHEN p_id IS NULL THEN '{}'
                ELSE json_build_object('sub', p_id, 'role', 'authenticated')::text END,
           true);
$$;

SELECT plan(18);

-- Archivage -------------------------------------------------------------------
CREATE TEMP TABLE archivees(nom text) ON COMMIT DROP;
INSERT INTO archivees VALUES ('alert_subscriptions'), ('benchmark_comparisons'), ('carbon_footprint_tracking'), ('compliance_reports'),
  ('custom_dashboards'), ('cycle_tracking'), ('driver_work_sessions'), ('fleet_tasks'), ('optimization_constraints'),
  ('optimization_scenarios'), ('performance_kpis'), ('reoptimization_events'), ('route_optimization_suggestions'),
  ('scenario_simulations'), ('task_assignments'), ('tire_brands'), ('tire_cost_analysis'), ('tire_dismounting_operations'),
  ('tire_inspections'), ('tire_mounting_operations'), ('tire_performance_metrics'), ('tire_purchase_recommendations'),
  ('tire_quality_controls'), ('tire_rotations'), ('tire_sensor_readings'), ('tire_sensors'), ('tire_stock_forecasts'),
  ('tire_supplier_scores'), ('tire_usage_analysis'), ('tire_usage_logs'), ('tire_usage_zones'), ('tire_work_orders'),
  ('training_needs_analysis'), ('trip_routes'), ('vehicle_availability'), ('vehicle_upgrade_recommendations'),
  ('shift_plans'), ('smart_notifications');

SELECT is((SELECT count(*)::int FROM pg_tables t JOIN archivees a ON a.nom = t.tablename WHERE t.schemaname = 'archive_bolt'), 38,
  'les 38 tables sans lecteur sont dans archive_bolt');
SELECT is((SELECT count(*)::int FROM pg_tables t JOIN archivees a ON a.nom = t.tablename WHERE t.schemaname = 'public'), 0,
  'aucune ne reste dans public');
SELECT is((SELECT count(*)::int FROM pg_class c
            WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND c.relrowsecurity
              AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)), 0,
  'plus aucune table publique a RLS active sans politique');
SELECT ok(NOT has_schema_privilege('authenticated', 'archive_bolt', 'USAGE') AND NOT has_schema_privilege('anon', 'archive_bolt', 'USAGE'),
  'schema archive_bolt ferme aux comptes');
SELECT ok(EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.confrelid
                   WHERE c.conrelid = 'public.tire_models'::regclass AND c.contype = 'f' AND r.relnamespace = 'archive_bolt'::regnamespace),
  'la cle etrangere de tire_models vers tire_brands archivee reste en place');
SELECT is((SELECT count(*)::int FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
            AND p.proname IN ('calculate_fatigue_score', 'calculate_tire_cost_per_tonne_km', 'calculate_tire_performance_metrics',
                              'check_alert_conditions', 'check_fatigue_violations', 'optimize_dispatch_assignment')
            AND (has_function_privilege('authenticated', p.oid, 'EXECUTE') OR has_function_privilege('anon', p.oid, 'EXECUTE'))), 0,
  'les six fonctions heritees qui lisent les tables archivees ne sont plus executables par les comptes');

-- Droits des 9 tables encore lues ---------------------------------------------
SELECT is((SELECT count(*)::int FROM information_schema.role_table_grants
            WHERE table_schema = 'public' AND grantee = 'anon'
              AND table_name IN ('iot_devices', 'iot_gps_readings', 'iot_tire_readings', 'iot_weight_readings', 'trip_waypoints',
                                 'trip_route_tracking', 'geofence_zone_assignments', 'quick_actions_log', 'waste_management')), 0,
  'anon n''a plus aucun droit sur les 9 tables');
SELECT is((SELECT count(*)::int FROM information_schema.role_table_grants
            WHERE table_schema = 'public' AND grantee = 'authenticated' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
              AND table_name IN ('iot_devices', 'iot_gps_readings', 'iot_tire_readings', 'iot_weight_readings', 'trip_waypoints', 'trip_route_tracking')), 0,
  'mesures IoT et trajets : aucune ecriture depuis le navigateur');
SELECT ok(NOT has_column_privilege('authenticated', 'public.iot_devices', 'api_key', 'SELECT'),
  'la cle d''authentification des boitiers n''est pas lisible');
SELECT ok(has_column_privilege('authenticated', 'public.iot_devices', 'device_id', 'SELECT'),
  'les autres colonnes des boitiers restent lisibles');
SELECT is((SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public'
            AND tablename IN ('iot_devices', 'iot_gps_readings', 'iot_tire_readings', 'iot_weight_readings', 'trip_waypoints',
                              'trip_route_tracking', 'geofence_zone_assignments', 'quick_actions_log', 'waste_management')
            AND (coalesce(qual, '') ~ '^\(?true\)?$' OR coalesce(with_check, '') ~ '^\(?true\)?$')), 0,
  'aucune politique ouverte (true) sur les 9 tables');

-- Perimetre des mesures ---------------------------------------------------------
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-d710-000000000001', 'lecteur.gps.d710@exemple.invalid'),
  ('00000000-0000-4000-d710-000000000002', 'sans.gps.d710@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-d710-0000000000a1', 'Mine S1 D710', 'mine'),
  ('00000000-0000-4000-d710-0000000000a2', 'Mine S2 D710', 'mine');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-d710-000000000001', 'operations_manager', 'Lecteur GPS D710', 'active', '00000000-0000-4000-d710-0000000000a1'),
  ('00000000-0000-4000-d710-000000000002', 'operations_manager', 'Sans GPS D710', 'active', '00000000-0000-4000-d710-0000000000a1')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.droits_utilisateur (utilisateur, module, niveau) VALUES
  ('00000000-0000-4000-d710-000000000001', 'gps_tracking', 'lecture'),
  ('00000000-0000-4000-d710-000000000002', 'gps_tracking', 'aucun'),
  ('00000000-0000-4000-d710-000000000002', 'iot', 'aucun')
ON CONFLICT (utilisateur, module) DO UPDATE SET niveau = EXCLUDED.niveau;
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status, site_id) VALUES
  ('00000000-0000-4000-d710-0000000000b1', 'TEST-D710-S1', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-d710-0000000000a1'),
  ('00000000-0000-4000-d710-0000000000b2', 'TEST-D710-S2', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-d710-0000000000a2');
INSERT INTO public.iot_devices (device_id, device_type, vehicle_id, api_key, status) VALUES
  ('TEST-D710-B1', 'gps_tracker', '00000000-0000-4000-d710-0000000000b1', 'cle-secrete-test', 'active'),
  ('TEST-D710-B2', 'gps_tracker', '00000000-0000-4000-d710-0000000000b2', 'cle-secrete-test-2', 'active');
INSERT INTO public.iot_gps_readings (device_id, vehicle_id, latitude, longitude) VALUES
  ('TEST-D710-B1', '00000000-0000-4000-d710-0000000000b1', 7.5, -8.5),
  ('TEST-D710-B2', '00000000-0000-4000-d710-0000000000b2', 7.6, -8.6);

SELECT pg_temp.se_connecter('00000000-0000-4000-d710-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.iot_gps_readings WHERE device_id LIKE 'TEST-D710-%'), 1,
  'lecteur GPS du site S1 : seule la mesure de son site');
SELECT is((SELECT string_agg(device_id, ',') FROM public.iot_devices WHERE device_id LIKE 'TEST-D710-%'), 'TEST-D710-B1',
  'lecteur GPS du site S1 : seul le boitier de son site');
SELECT throws_ok($$SELECT api_key FROM public.iot_devices$$, '42501', NULL,
  'la colonne api_key est refusee');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-d710-000000000002');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.iot_gps_readings WHERE device_id LIKE 'TEST-D710-%'), 0,
  'sans droit GPS ni IoT : aucune mesure');

-- Journal des actions rapides : personnel ----------------------------------------
SELECT lives_ok($$INSERT INTO public.quick_actions_log (user_id, action_type, action_name)
  VALUES ('00000000-0000-4000-d710-000000000002', 'test', 'Action D710')$$,
  'chacun journalise ses propres actions rapides');
SELECT throws_ok($$INSERT INTO public.quick_actions_log (user_id, action_type, action_name)
  VALUES ('00000000-0000-4000-d710-000000000001', 'test', 'Usurpation D710')$$, '42501', NULL,
  'pas d''ecriture au nom d''un autre');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d710-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.quick_actions_log WHERE action_name = 'Action D710'), 0,
  'les actions rapides d''un autre ne sont pas lisibles');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
