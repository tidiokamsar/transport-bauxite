-- Tests RLS (decision D-007) : ecriture par module (Tranche 0.3,
-- migration 20260903090100_restrict_open_rls_policies).
-- Execution : npm run test:rls (supabase test db). Tout est annule en fin
-- de transaction.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

-- Simule la session d'un utilisateur. auth.uid() lit request.jwt.claims
-- (GoTrue recent) ou request.jwt.claim.sub (image Postgres seule).
CREATE FUNCTION pg_temp.se_connecter(p_id uuid) RETURNS void
LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', coalesce(p_id::text, ''), true),
         set_config('request.jwt.claims',
           CASE WHEN p_id IS NULL THEN '{}'
                ELSE json_build_object('sub', p_id, 'role', 'authenticated')::text END,
           true);
$$;

SELECT plan(6);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-b000-000000000001', 'chauffeur.rls@exemple.invalid'),
  ('00000000-0000-4000-b000-000000000002', 'comptable.rls@exemple.invalid');

INSERT INTO public.profiles (id, role, full_name) VALUES
  ('00000000-0000-4000-b000-000000000001', 'driver', 'Chauffeur RLS'),
  ('00000000-0000-4000-b000-000000000002', 'accountant', 'Comptable RLS')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name;

-- Un bulletin existant, cible de la tentative de modification.
INSERT INTO public.employees (id, employee_number, first_name, last_name, position, department)
VALUES ('00000000-0000-4000-b000-0000000000e1', 'TEST-RLS-E1', 'Test', 'RLS', 'Chauffeur', 'Transport');

INSERT INTO public.payroll (id, payroll_number, employee_id, payroll_period_start,
  payroll_period_end, payment_date, base_salary, gross_salary, net_salary)
VALUES ('00000000-0000-4000-b000-0000000000f1', 'TEST-RLS-P1',
  '00000000-0000-4000-b000-0000000000e1', current_date, current_date,
  current_date, 100, 100, 100);

SELECT has_function('public', 'has_module_write', ARRAY['text'],
  'has_module_write(text) existe');

-- Aucune politique FOR ALL ouverte (USING true) ne doit subsister.
SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname = 'public' AND cmd = 'ALL'
      AND roles = ARRAY['authenticated']::name[]
      AND replace(coalesce(qual, ''), ' ', '') IN ('true', '(true)')),
  0,
  'aucune politique FOR ALL USING (true) pour authenticated');

-- Chauffeur : pas d'ecriture sur le module hr.
SELECT pg_temp.se_connecter('00000000-0000-4000-b000-000000000001');
SET LOCAL ROLE authenticated;

SELECT is(public.has_module_write('hr'), false,
  'un chauffeur n''a pas l''ecriture sur le module hr');

SELECT throws_ok(
  $$INSERT INTO public.payroll (payroll_number, employee_id, payroll_period_start,
      payroll_period_end, payment_date, base_salary, gross_salary, net_salary)
    VALUES ('TEST-RLS-1', gen_random_uuid(), current_date, current_date,
      current_date, 1, 1, 1)$$,
  '42501', NULL,
  'un chauffeur ne peut pas creer de bulletin de paie');

-- Scenario de la migration : la tentative est filtree par RLS (0 ligne)
-- ou rejetee ; dans les deux cas le bulletin reste intact.
DO $$
BEGIN
  UPDATE public.payroll SET base_salary = 999999
  WHERE id = '00000000-0000-4000-b000-0000000000f1';
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END;
$$;

RESET ROLE;

SELECT is(
  (SELECT base_salary FROM public.payroll WHERE id = '00000000-0000-4000-b000-0000000000f1'),
  100::bigint,
  'un chauffeur ne peut pas modifier un bulletin de paie');

-- Comptable : ecriture autorisee sur le module hr (role_permissions).
SELECT pg_temp.se_connecter('00000000-0000-4000-b000-000000000002');
SET LOCAL ROLE authenticated;

SELECT is(public.has_module_write('hr'), true,
  'un comptable a l''ecriture sur le module hr');

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
