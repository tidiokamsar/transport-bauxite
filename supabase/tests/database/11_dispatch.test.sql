-- Tests (CDC 11.4, 11.5, D-024) : preparation des voyages, decisions
-- d'affectation controlees et historisees (migration 20261110180000_dispatch).
-- Tout est annule.
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

SELECT plan(17);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8b00-000000000001', 'operations.dispatch@exemple.invalid'),
  ('00000000-0000-4000-8b00-000000000002', 'comptable.dispatch@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status) VALUES
  ('00000000-0000-4000-8b00-000000000001', 'operations_manager', 'Operations Dispatch', 'active'),
  ('00000000-0000-4000-8b00-000000000002', 'accountant', 'Comptable Dispatch', 'active')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-8b00-0000000000a1', 'Mine dispatch', 'mine'),
  ('00000000-0000-4000-8b00-0000000000a2', 'Stock dispatch', 'depot');
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status) VALUES
  ('00000000-0000-4000-8b00-0000000000b1', 'TEST-DSP-1', 'Test', 40, 'tipper', 'active'),
  ('00000000-0000-4000-8b00-0000000000b2', 'TEST-DSP-2', 'Test', 40, 'tipper', 'active'),
  ('00000000-0000-4000-8b00-0000000000b3', 'TEST-DSP-3', 'Test', 40, 'tipper', 'immobilized'),
  ('00000000-0000-4000-8b00-0000000000e1', 'TEST-CHG-1', 'Test', 10, 'loader', 'active');
INSERT INTO public.drivers (id, name, license_number, license_category, license_expiry, hire_date, status) VALUES
  ('00000000-0000-4000-8b00-0000000000c1', 'Chauffeur un', 'D-1', 'C', current_date + 100, current_date - 100, 'active'),
  ('00000000-0000-4000-8b00-0000000000c2', 'Chauffeur deux', 'D-2', 'C', current_date + 100, current_date - 100, 'active'),
  ('00000000-0000-4000-8b00-0000000000c3', 'Chauffeur expire', 'D-3', 'C', current_date - 1, current_date - 100, 'active');

SELECT pg_temp.se_connecter('00000000-0000-4000-8b00-000000000001');
SET LOCAL ROLE authenticated;

SELECT is(public.preparer_voyages(current_date, '00000000-0000-4000-8b00-0000000000a1',
  '00000000-0000-4000-8b00-0000000000a2', NULL, 3), 3, 'trois voyages prepares');
SELECT is((SELECT count(*)::int FROM public.trips WHERE departure_site_id = '00000000-0000-4000-8b00-0000000000a1'
  AND etat = 'PLANNED' AND vehicle_id IS NULL), 3, 'voyages planifies, sans camion');
SELECT throws_ok($$SELECT public.preparer_voyages(current_date, '00000000-0000-4000-8b00-0000000000a1',
  '00000000-0000-4000-8b00-0000000000a2', NULL, 0)$$, '22023', NULL, 'nombre nul refuse');

CREATE TEMP TABLE vs AS
  SELECT id, row_number() OVER (ORDER BY reference) AS n FROM public.trips
  WHERE departure_site_id = '00000000-0000-4000-8b00-0000000000a1';

SELECT lives_ok($$SELECT public.decider_affectation((SELECT id FROM vs WHERE n = 1), 'acceptee',
  '00000000-0000-4000-8b00-0000000000b1', '00000000-0000-4000-8b00-0000000000c1', '00000000-0000-4000-8b00-0000000000e1',
  '{"camion": "TEST-DSP-1", "raison": "moins charge"}')$$, 'recommandation acceptee');
SELECT is((SELECT etat FROM public.trips WHERE id = (SELECT id FROM vs WHERE n = 1)), 'ASSIGNED', 'le voyage est affecte');
SELECT is((SELECT count(*)::int FROM public.trip_events WHERE trip_id = (SELECT id FROM vs WHERE n = 1) AND etat_apres = 'ASSIGNED'), 1,
  'l''affectation est au journal du voyage');

SELECT throws_ok($$SELECT public.decider_affectation((SELECT id FROM vs WHERE n = 2), 'modifiee',
  '00000000-0000-4000-8b00-0000000000b2', '00000000-0000-4000-8b00-0000000000c2', NULL)$$,
  '22023', NULL, 'modification sans motif refusee');
SELECT throws_ok($$SELECT public.decider_affectation((SELECT id FROM vs WHERE n = 2), 'acceptee',
  '00000000-0000-4000-8b00-0000000000b3', '00000000-0000-4000-8b00-0000000000c2', NULL)$$,
  '22023', NULL, 'camion immobilise refuse');
SELECT throws_ok($$SELECT public.decider_affectation((SELECT id FROM vs WHERE n = 2), 'acceptee',
  '00000000-0000-4000-8b00-0000000000b2', '00000000-0000-4000-8b00-0000000000c3', NULL)$$,
  '22023', NULL, 'permis expire refuse');
SELECT throws_ok($$SELECT public.decider_affectation((SELECT id FROM vs WHERE n = 2), 'acceptee',
  '00000000-0000-4000-8b00-0000000000b2', '00000000-0000-4000-8b00-0000000000c1', NULL)$$,
  '22023', NULL, 'chauffeur deja sur un autre camion du shift refuse');
SELECT throws_ok($$SELECT public.decider_affectation((SELECT id FROM vs WHERE n = 2), 'acceptee',
  '00000000-0000-4000-8b00-0000000000b2', '00000000-0000-4000-8b00-0000000000c2', '00000000-0000-4000-8b00-0000000000b1')$$,
  '22023', NULL, 'un camion n''est pas un engin de chargement');

SELECT lives_ok($$SELECT public.decider_affectation((SELECT id FROM vs WHERE n = 3), 'refusee', NULL, NULL, NULL,
  '{"camion": "TEST-DSP-2"}', 'Camion reserve pour la piste sud')$$, 'refus motive');
SELECT is((SELECT (etat, vehicle_id IS NULL)::text FROM public.trips WHERE id = (SELECT id FROM vs WHERE n = 3)), '(PLANNED,t)',
  'un refus ne change pas le voyage');

SELECT throws_ok($$SELECT public.decider_affectation((SELECT id FROM vs WHERE n = 1), 'modifiee',
  '00000000-0000-4000-8b00-0000000000b2', '00000000-0000-4000-8b00-0000000000c1', NULL)$$,
  '22023', NULL, 'reaffectation sans motif refusee');
SELECT lives_ok($$SELECT public.decider_affectation((SELECT id FROM vs WHERE n = 1), 'modifiee',
  '00000000-0000-4000-8b00-0000000000b2', '00000000-0000-4000-8b00-0000000000c1', NULL, '{}', 'Panne de TEST-DSP-1')$$,
  'reaffectation motivee d''un voyage affecte');
SELECT is((SELECT (count(*), count(*) FILTER (WHERE nature = 'reaffectation'))::text FROM public.decisions_dispatch
  WHERE trip_id IN (SELECT id FROM vs)), '(3,1)', 'chaque decision est historisee');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-8b00-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.decider_affectation((SELECT id FROM vs WHERE n = 3), 'acceptee',
  '00000000-0000-4000-8b00-0000000000b2', '00000000-0000-4000-8b00-0000000000c2', NULL)$$,
  '42501', NULL, 'un comptable (lecture seule) ne decide pas');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
