-- Tests (constat N5) : fonctions SECURITY DEFINER et vue fermees aux
-- roles applicatifs (migration 20261109120000_fermer_fonctions_definer).
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(9);

SELECT is(has_function_privilege('anon', 'public.update_user_password(uuid, text)', 'EXECUTE'), false,
  'anon ne peut pas changer un mot de passe');
SELECT is(has_function_privilege('authenticated', 'public.update_user_password(uuid, text)', 'EXECUTE'), false,
  'un utilisateur connecte ne peut pas changer le mot de passe d''un autre');
SELECT is(has_function_privilege('anon', 'public.calculate_employee_payroll(uuid, date, date)', 'EXECUTE'), false,
  'anon ne lit pas la paie');
SELECT is(has_function_privilege('authenticated', 'public.calculate_employee_payroll(uuid, date, date)', 'EXECUTE'), false,
  'un utilisateur connecte ne lit pas la paie d''un autre');
SELECT is(has_function_privilege('authenticated', 'public.generate_payroll_record(uuid, date, date)', 'EXECUTE'), false,
  'un utilisateur connecte ne genere pas de bulletin');
SELECT is(has_function_privilege('anon', 'public.log_user_activity(text, jsonb)', 'EXECUTE'), false,
  'anon n''ecrit pas dans le journal d''activite');
SELECT is(has_table_privilege('anon', 'public.shift_performance_stats', 'SELECT'), false,
  'anon ne lit pas les agregats des voyages');
SELECT ok((SELECT 'security_invoker=true' = ANY (reloptions) FROM pg_class
            WHERE oid = 'public.shift_performance_stats'::regclass),
  'la vue applique la RLS de l''appelant');
SELECT is(has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE'), true,
  'is_admin reste executable (politiques RLS)');

SELECT * FROM finish();
ROLLBACK;
