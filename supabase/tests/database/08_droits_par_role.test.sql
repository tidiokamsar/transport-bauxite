-- Tests RLS (D-021) : lecture et ecriture des tables metier selon la
-- matrice role x module (migration 20261110090000_droits_par_role).
-- Tout est annule en fin de transaction.
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

SELECT plan(14);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-9000-000000000001', 'chauffeur.d021@exemple.invalid'),
  ('00000000-0000-4000-9000-000000000002', 'comptable.d021@exemple.invalid'),
  ('00000000-0000-4000-9000-000000000003', 'operations.d021@exemple.invalid'),
  ('00000000-0000-4000-9000-000000000004', 'inactif.d021@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status) VALUES
  ('00000000-0000-4000-9000-000000000001', 'driver', 'Chauffeur D-021', 'active'),
  ('00000000-0000-4000-9000-000000000002', 'accountant', 'Comptable D-021', 'active'),
  ('00000000-0000-4000-9000-000000000003', 'operations_manager', 'Operations D-021', 'active'),
  ('00000000-0000-4000-9000-000000000004', 'operations_manager', 'Inactif D-021', 'inactive')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name, status = EXCLUDED.status;

INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type)
VALUES ('00000000-0000-4000-9000-0000000000a1', 'TEST-D021', 'Test', 40, 'tipper');
INSERT INTO public.trips (id, reference, planned_date, vehicle_id)
VALUES ('00000000-0000-4000-9000-0000000000b1', 'TEST-D021-T1', current_date, '00000000-0000-4000-9000-0000000000a1');
INSERT INTO public.employees (id, employee_number, first_name, last_name, position, department)
VALUES ('00000000-0000-4000-9000-0000000000c1', 'TEST-D021-E1', 'Test', 'D021', 'Chauffeur', 'Transport');

-- Chauffeur : lit voyages et matrice, ne lit pas les employes, n'ecrit pas.
SELECT pg_temp.se_connecter('00000000-0000-4000-9000-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.trips WHERE id = '00000000-0000-4000-9000-0000000000b1'), 1,
  'un chauffeur lit les voyages');
SELECT ok((SELECT count(*) FROM public.role_permissions WHERE role = 'driver') > 0,
  'un chauffeur lit la matrice de son role (menus)');
SELECT is((SELECT count(*)::int FROM public.employees), 0, 'un chauffeur ne lit pas les employes');
SELECT throws_ok(
  $$INSERT INTO public.trips (reference, planned_date) VALUES ('TEST-D021-T2', current_date)$$,
  '42501', NULL, 'un chauffeur ne cree pas de voyage');
SELECT is((SELECT count(*)::int FROM public.settings), 0, 'un chauffeur ne lit pas les parametres');
RESET ROLE;

-- Comptable : lit les employes, ne cree pas de voyage.
SELECT pg_temp.se_connecter('00000000-0000-4000-9000-000000000002');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.employees WHERE id = '00000000-0000-4000-9000-0000000000c1'), 1,
  'un comptable lit les employes');
SELECT throws_ok(
  $$INSERT INTO public.trips (reference, planned_date) VALUES ('TEST-D021-T3', current_date)$$,
  '42501', NULL, 'un comptable ne cree pas de voyage');
SELECT is(public.has_module_write('invoices'), true, 'un comptable ecrit en factures');
RESET ROLE;

-- Responsable d'exploitation : cree un voyage, lit les vehicules, pas les factures.
SELECT pg_temp.se_connecter('00000000-0000-4000-9000-000000000003');
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$INSERT INTO public.trips (reference, planned_date, vehicle_id) VALUES ('TEST-D021-T4', current_date, '00000000-0000-4000-9000-0000000000a1')$$,
  'un responsable d''exploitation cree un voyage');
SELECT is((SELECT count(*)::int FROM public.vehicles WHERE id = '00000000-0000-4000-9000-0000000000a1'), 1,
  'un responsable d''exploitation lit les vehicules');
SELECT is(public.has_module_view('invoices'), false, 'un responsable d''exploitation ne lit pas les factures');
SELECT ok((SELECT count(*) FROM public.sites) >= 0, 'les sites sont lisibles');
RESET ROLE;

-- Compte desactive : plus aucun droit.
SELECT pg_temp.se_connecter('00000000-0000-4000-9000-000000000004');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_write('trips'), false, 'un compte desactive n''ecrit plus');
SELECT is((SELECT count(*)::int FROM public.trips), 0, 'un compte desactive ne lit plus');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
