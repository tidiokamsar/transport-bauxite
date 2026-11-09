-- Tests (CDC 12, CDC 31) : cycle de voyage par transitions controlees
-- (migration 20261110120000_cycle_voyage). Tout est annule.
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

SELECT plan(16);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8800-000000000001', 'operations.cycle@exemple.invalid'),
  ('00000000-0000-4000-8800-000000000002', 'chauffeur.cycle@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status) VALUES
  ('00000000-0000-4000-8800-000000000001', 'operations_manager', 'Operations Cycle', 'active'),
  ('00000000-0000-4000-8800-000000000002', 'driver', 'Chauffeur Cycle', 'active')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-8800-0000000000a1', 'Mine test', 'mine'),
  ('00000000-0000-4000-8800-0000000000a2', 'Stock test', 'depot');
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type) VALUES
  ('00000000-0000-4000-8800-0000000000b1', 'TEST-CYCLE', 'Test', 40, 'tipper');
INSERT INTO public.drivers (id, name, license_number, license_category, license_expiry, hire_date) VALUES
  ('00000000-0000-4000-8800-0000000000c1', 'Chauffeur test', 'T-1', 'C', current_date + 100, current_date - 100);

SELECT pg_temp.se_connecter('00000000-0000-4000-8800-000000000001');
SET LOCAL ROLE authenticated;

CREATE TEMP TABLE v AS SELECT public.creer_voyage(current_date, '00000000-0000-4000-8800-0000000000a1',
  '00000000-0000-4000-8800-0000000000a2', '00000000-0000-4000-8800-0000000000b1',
  '00000000-0000-4000-8800-0000000000c1') AS id;

SELECT is((SELECT etat FROM public.trips WHERE id = (SELECT id FROM v)), 'ASSIGNED',
  'creation avec camion et chauffeur : voyage affecte');
SELECT ok((SELECT reference FROM public.trips WHERE id = (SELECT id FROM v)) ~ '^VYG-\d{6}-\d{3}$',
  'reference generee par le serveur');
SELECT is((SELECT count(*)::int FROM public.trip_events WHERE trip_id = (SELECT id FROM v)), 1,
  'la creation est journalisee');

SELECT throws_ok($$SELECT public.avancer_voyage((SELECT id FROM v), 'DELIVERED', now())$$,
  '22023', NULL, 'saut d''etapes refuse');
SELECT throws_ok($$UPDATE public.trips SET etat = 'DELIVERED' WHERE id = (SELECT id FROM v)$$,
  '42501', NULL, 'changement d''etat direct refuse');
SELECT throws_ok($$INSERT INTO public.trips (reference, planned_date, etat) VALUES ('TEST-X', current_date, 'DELIVERED')$$,
  '42501', NULL, 'creation directe d''un voyage livre refusee');

SELECT lives_ok($$SELECT public.avancer_voyage((SELECT id FROM v), 'AT_LOADING', now() - interval '50 minutes')$$, 'arrivee au chargement');
SELECT lives_ok($$SELECT public.avancer_voyage((SELECT id FROM v), 'LOADING', now() - interval '45 minutes')$$, 'chargement');
SELECT lives_ok($$SELECT public.avancer_voyage((SELECT id FROM v), 'LOADED', now() - interval '35 minutes')$$, 'charge');
SELECT throws_ok($$SELECT public.avancer_voyage((SELECT id FROM v), 'WEIGHED_OUT', now() - interval '30 minutes', NULL, '{"brut": 10, "tare": 15}')$$,
  '22023', NULL, 'pesee incoherente refusee');
SELECT lives_ok($$SELECT public.avancer_voyage((SELECT id FROM v), 'WEIGHED_OUT', now() - interval '30 minutes', NULL, '{"brut": 56.2, "tare": 15.5}')$$, 'pesee au depart');
SELECT is((SELECT net_weight FROM public.trips WHERE id = (SELECT id FROM v)), 40.7::numeric, 'poids net calcule par le serveur');
SELECT throws_ok($$SELECT public.avancer_voyage((SELECT id FROM v), 'IN_TRANSIT', now() - interval '40 minutes')$$,
  '22023', NULL, 'heure anterieure au dernier evenement refusee');
SELECT throws_ok($$DELETE FROM public.trips WHERE id = (SELECT id FROM v)$$,
  '42501', NULL, 'un voyage engage ne se supprime pas');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-8800-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.avancer_voyage((SELECT id FROM v), 'IN_TRANSIT', now())$$,
  '42501', NULL, 'un chauffeur (lecture seule) ne fait pas avancer le voyage');
SELECT is((SELECT count(*)::int FROM public.trip_events WHERE trip_id = (SELECT id FROM v)), 5,
  'un chauffeur lit le journal du voyage');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
