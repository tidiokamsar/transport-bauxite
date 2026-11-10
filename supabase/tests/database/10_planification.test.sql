-- Tests (CDC 6.1, 6.3, CDC 31, D-023) : objectifs de production versionnes
-- et realisation tiree des voyages (migration 20261110150000_planification).
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

SELECT plan(18);

-- Droits derives de la ligne trips (D-023)
SELECT is(
  (SELECT count(*)::int FROM public.role_permissions p
   JOIN public.role_permissions t ON t.role = p.role AND t.module = 'trips'
   WHERE p.module = 'planning' AND p.can_view = t.can_view AND p.can_create = t.can_delete AND p.can_edit = t.can_delete),
  (SELECT count(*)::int FROM public.role_permissions WHERE module = 'trips'),
  'module planning : une ligne par role, derivee des droits sur les voyages');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8a00-000000000001', 'operations.plan@exemple.invalid'),
  ('00000000-0000-4000-8a00-000000000002', 'logisticien.plan@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status) VALUES
  ('00000000-0000-4000-8a00-000000000001', 'operations_manager', 'Operations Plan', 'active'),
  ('00000000-0000-4000-8a00-000000000002', 'logistician', 'Logisticien Plan', 'active')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-8a00-0000000000a1', 'Mine plan', 'mine'),
  ('00000000-0000-4000-8a00-0000000000a2', 'Stock plan', 'depot');
INSERT INTO public.work_shifts (id, name, display_name, start_time, end_time, shift_order) VALUES
  ('00000000-0000-4000-8a00-0000000000d1', 'jour_plan', 'Jour plan', '06:00', '18:00', 91),
  ('00000000-0000-4000-8a00-0000000000d2', 'nuit_plan', 'Nuit plan', '18:00', '06:00', 92);
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type) VALUES
  ('00000000-0000-4000-8a00-0000000000b1', 'TEST-PLAN-1', 'Test', 40, 'tipper'),
  ('00000000-0000-4000-8a00-0000000000b2', 'TEST-PLAN-2', 'Test', 40, 'tipper');

-- Voyages de reference, hors session utilisateur : 2 livres le jour J
-- (shift jour), 1 livre la nuit, 1 en route, 1 annule, 1 livre sur un
-- autre site, et 2 livres la veille (statistiques).
SELECT pg_temp.se_connecter(NULL);
INSERT INTO public.trips (reference, planned_date, vehicle_id, departure_site_id, arrival_site_id, shift_id, status, net_weight) VALUES
  ('TPL-1', current_date, '00000000-0000-4000-8a00-0000000000b1', '00000000-0000-4000-8a00-0000000000a1', '00000000-0000-4000-8a00-0000000000a2', '00000000-0000-4000-8a00-0000000000d1', 'completed', 40.5),
  ('TPL-2', current_date, '00000000-0000-4000-8a00-0000000000b2', '00000000-0000-4000-8a00-0000000000a1', '00000000-0000-4000-8a00-0000000000a2', '00000000-0000-4000-8a00-0000000000d1', 'completed', 39.5),
  ('TPL-3', current_date, '00000000-0000-4000-8a00-0000000000b1', '00000000-0000-4000-8a00-0000000000a1', '00000000-0000-4000-8a00-0000000000a2', '00000000-0000-4000-8a00-0000000000d2', 'completed', 41.0),
  ('TPL-4', current_date, '00000000-0000-4000-8a00-0000000000b2', '00000000-0000-4000-8a00-0000000000a1', '00000000-0000-4000-8a00-0000000000a2', '00000000-0000-4000-8a00-0000000000d1', 'in_progress', NULL),
  ('TPL-5', current_date, '00000000-0000-4000-8a00-0000000000b2', '00000000-0000-4000-8a00-0000000000a1', '00000000-0000-4000-8a00-0000000000a2', '00000000-0000-4000-8a00-0000000000d1', 'cancelled', 40.0),
  ('TPL-6', current_date, '00000000-0000-4000-8a00-0000000000b2', '00000000-0000-4000-8a00-0000000000a2', '00000000-0000-4000-8a00-0000000000a1', '00000000-0000-4000-8a00-0000000000d1', 'completed', 38.0),
  ('TPL-7', current_date - 1, '00000000-0000-4000-8a00-0000000000b1', '00000000-0000-4000-8a00-0000000000a1', '00000000-0000-4000-8a00-0000000000a2', '00000000-0000-4000-8a00-0000000000d1', 'completed', 40.0),
  ('TPL-8', current_date - 1, '00000000-0000-4000-8a00-0000000000b1', '00000000-0000-4000-8a00-0000000000a1', '00000000-0000-4000-8a00-0000000000a2', '00000000-0000-4000-8a00-0000000000d1', 'completed', 42.0);

-- Operations : definit, revise, annule
SELECT pg_temp.se_connecter('00000000-0000-4000-8a00-000000000001');
SET LOCAL ROLE authenticated;

CREATE TEMP TABLE o1 AS SELECT public.definir_objectif(current_date, '00000000-0000-4000-8a00-0000000000a1',
  '00000000-0000-4000-8a00-0000000000d1', 100) AS id;
SELECT is((SELECT version FROM public.objectifs_production WHERE id = (SELECT id FROM o1)), 1, 'premier objectif : version 1');
SELECT throws_ok($$SELECT public.definir_objectif(current_date, '00000000-0000-4000-8a00-0000000000a1',
  '00000000-0000-4000-8a00-0000000000d1', 120)$$, '22023', NULL, 'revision sans motif refusee');
SELECT throws_ok($$SELECT public.definir_objectif(current_date, '00000000-0000-4000-8a00-0000000000a1', NULL, 0)$$,
  '22023', NULL, 'objectif nul refuse');
CREATE TEMP TABLE o2 AS SELECT public.definir_objectif(current_date, '00000000-0000-4000-8a00-0000000000a1',
  '00000000-0000-4000-8a00-0000000000d1', 120, 3, 2, 1, 'Chargeuse supplementaire disponible') AS id;
SELECT is((SELECT version FROM public.objectifs_production WHERE id = (SELECT id FROM o2)), 2, 'revision motivee : version 2');
SELECT is((SELECT statut FROM public.objectifs_production WHERE id = (SELECT id FROM o1)), 'remplace', 'la version 1 est conservee, remplacee');
SELECT is((SELECT count(*)::int FROM public.objectifs_production
  WHERE site_id = '00000000-0000-4000-8a00-0000000000a1' AND statut = 'actif'), 1, 'un seul objectif actif par date, site et shift');

SELECT throws_ok($$UPDATE public.objectifs_production SET tonnes_cible = 1 WHERE id = (SELECT id FROM o2)$$,
  '42501', NULL, 'modification directe refusee');
SELECT throws_ok($$INSERT INTO public.objectifs_production (date_plan, site_id, version, tonnes_cible)
  VALUES (current_date, '00000000-0000-4000-8a00-0000000000a2', 1, 50)$$, '42501', NULL, 'insertion directe refusee');

-- Realisation : shift jour = TPL-1 + TPL-2 ; journee = + TPL-3 (nuit)
SELECT is((SELECT tonnes_livrees FROM public.v_realisation_objectifs WHERE id = (SELECT id FROM o2)), 80.0::numeric,
  'realisation du shift : voyages livres du site et du shift seulement');
SELECT is((SELECT (voyages_livres, voyages_en_cours, tonnes_cible_initial)::text FROM public.v_realisation_objectifs WHERE id = (SELECT id FROM o2)),
  '(2,1,100.00)', 'voyages livres, en cours, et objectif initial');
CREATE TEMP TABLE oj AS SELECT public.definir_objectif(current_date, '00000000-0000-4000-8a00-0000000000a1', NULL, 200) AS id;
SELECT is((SELECT tonnes_livrees FROM public.v_realisation_objectifs WHERE id = (SELECT id FROM oj)), 121.0::numeric,
  'objectif de journee : tous les shifts du site');

SELECT is((SELECT (jours_observes, voyages, charge_moyenne, rotations_par_camion)::text
  FROM public.statistiques_rotation('00000000-0000-4000-8a00-0000000000a1', '00000000-0000-4000-8a00-0000000000d1', current_date)),
  '(1,2,41.00,2.00)', 'statistiques : jours precedents seulement, charge et rotations par camion');

SELECT throws_ok($$SELECT public.annuler_objectif((SELECT id FROM oj), '  ')$$, '22023', NULL, 'annulation sans motif refusee');
SELECT lives_ok($$SELECT public.annuler_objectif((SELECT id FROM oj), 'Arret de la mine (pluie)')$$, 'annulation motivee');
SELECT throws_ok($$DELETE FROM public.objectifs_production WHERE id = (SELECT id FROM o2)$$,
  '42501', NULL, 'un objectif ne se supprime pas');
RESET ROLE;

-- Logisticien : lit les objectifs, ne les definit pas
SELECT pg_temp.se_connecter('00000000-0000-4000-8a00-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.definir_objectif(current_date + 1, '00000000-0000-4000-8a00-0000000000a1', NULL, 50)$$,
  '42501', NULL, 'un logisticien ne definit pas d''objectif');
SELECT is((SELECT count(*)::int FROM public.v_realisation_objectifs WHERE site_id = '00000000-0000-4000-8a00-0000000000a1'), 1,
  'un logisticien lit la realisation (objectif annule exclu)');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
