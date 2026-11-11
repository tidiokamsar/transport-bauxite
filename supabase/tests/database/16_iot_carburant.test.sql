-- Tests (D-030) : reception IoT reservee au service, lectures rattachees a
-- l'engin, consommation et anomalies carburant calculees sur les donnees
-- reelles (migration 20261111150000_iot_carburant). Tout est annule.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(12);

SELECT is(has_function_privilege('authenticated', 'public.ingest_gps_data(text, numeric, numeric, numeric, numeric, numeric)', 'EXECUTE'), false,
  'reception GPS fermee aux utilisateurs');
SELECT is(has_function_privilege('anon', 'public.ingest_fuel_data(text, numeric, numeric, numeric, numeric)', 'EXECUTE'), false,
  'reception carburant fermee aux anonymes');

INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status) VALUES
  ('00000000-0000-4000-9000-0000000000b1', 'TEST-IOT-1', 'Test', 40, 'tipper', 'active'),
  ('00000000-0000-4000-9000-0000000000b2', 'TEST-IOT-2', 'Test', 40, 'tipper', 'active');
INSERT INTO public.iot_devices (device_id, device_type, vehicle_id, api_key, status) VALUES
  ('BOITIER-TEST-1', 'gps_tracker', '00000000-0000-4000-9000-0000000000b1', 'cle-test', 'active');

SELECT isnt(public.ingest_gps_data('BOITIER-TEST-1', 7.65, -8.40, 32, 90, 84500), NULL, 'position GPS recue');
SELECT is((SELECT count(*)::int FROM public.vehicle_tracking WHERE vehicle_id = '00000000-0000-4000-9000-0000000000b1'), 1,
  'position rattachee a l''engin du boitier');
SELECT throws_ok($$SELECT public.ingest_gps_data('BOITIER-TEST-1', 95, -8.40)$$, '22023', NULL, 'latitude hors bornes refusee');
CREATE TEMP TABLE jauge AS SELECT public.ingest_fuel_data('BOITIER-TEST-1', 120) AS sans_capacite,
  public.ingest_fuel_data('BOITIER-TEST-1', 120, 400) AS avec_capacite;
SELECT is((SELECT fuel_level_percentage FROM public.iot_fuel_readings WHERE id = (SELECT sans_capacite FROM jauge)), NULL,
  'sans capacite fournie : pas de pourcentage invente');
SELECT is((SELECT fuel_level_percentage FROM public.iot_fuel_readings WHERE id = (SELECT avec_capacite FROM jauge)), 30.00::numeric,
  'pourcentage calcule avec la capacite fournie');

-- Consommation : TEST-IOT-1 300 L pour 80 t ; TEST-IOT-2 200 L pour 40 t
INSERT INTO public.fuel_transactions (transaction_date, vehicle_id, volume_liters, unit_price, total_cost, transaction_type, reference) VALUES
  ('2026-10-05', '00000000-0000-4000-9000-0000000000b1', 200, 10, 2000, 'refuel', 'TEST-IOT-P1'),
  ('2026-10-05', '00000000-0000-4000-9000-0000000000b1', 100, 10, 1000, 'refuel', 'TEST-IOT-P2'),
  ('2026-10-06', '00000000-0000-4000-9000-0000000000b2', 200, 10, 2000, 'refuel', 'TEST-IOT-P3'),
  ('2026-10-07', '00000000-0000-4000-9000-0000000000b2', 50, 10, 500, 'refuel', 'TEST-IOT-P4');
INSERT INTO public.trips (reference, planned_date, vehicle_id, etat, net_weight, accepted_tonnage) VALUES
  ('TIOT-1', '2026-10-05', '00000000-0000-4000-9000-0000000000b1', 'ACCEPTED', 40, 40),
  ('TIOT-2', '2026-10-05', '00000000-0000-4000-9000-0000000000b1', 'ACCEPTED', 40, 40),
  ('TIOT-3', '2026-10-06', '00000000-0000-4000-9000-0000000000b2', 'DELIVERED', 40, NULL);

SELECT is((SELECT (litres, tonnes, litres_par_tonne)::text FROM public.consommation_carburant('2026-10-01', '2026-10-31')
  WHERE vehicle_id = '00000000-0000-4000-9000-0000000000b1'), '(300.00,80.00,3.750)', 'litres par tonne sur les voyages livres');
SELECT is((SELECT litres_par_heure FROM public.consommation_carburant('2026-10-01', '2026-10-31')
  WHERE vehicle_id = '00000000-0000-4000-9000-0000000000b1'), NULL, 'sans pointage : litres par heure non calculable');
SELECT is((SELECT count(*)::int FROM public.anomalies_carburant('2026-10-01', '2026-10-31') WHERE type = 'pleins_meme_jour'), 1,
  'deux pleins le meme jour signales');
SELECT is((SELECT reference FROM public.anomalies_carburant('2026-10-01', '2026-10-31') WHERE type = 'plein_sans_activite'), 'TEST-IOT-P4',
  'plein un jour sans activite signale');
SELECT is((SELECT count(*)::int FROM public.anomalies_carburant('2026-10-01', '2026-10-31', 20) WHERE type = 'surconsommation'), 1,
  'surconsommation au-dela de la mediane et du seuil saisi');

SELECT * FROM finish();
ROLLBACK;
