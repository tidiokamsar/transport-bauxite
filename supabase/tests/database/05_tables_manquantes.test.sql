-- Tests RLS (D-017) : tables recreees par 20261109090000_tables_manquantes.
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

SELECT plan(9);

SELECT has_table('public', 'costs', 'la table costs existe');
SELECT has_table('public', 'departments', 'la table departments existe');

SELECT is(
  (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('costs', 'departments', 'cost_categories', 'user_preferences')
      AND c.relrowsecurity),
  4, 'RLS active sur les quatre tables');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-e000-000000000001', 'comptable.d017@exemple.invalid'),
  ('00000000-0000-4000-e000-000000000002', 'chauffeur.d017@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status) VALUES
  ('00000000-0000-4000-e000-000000000001', 'accountant', 'Comptable D-017', 'active'),
  ('00000000-0000-4000-e000-000000000002', 'driver', 'Chauffeur D-017', 'active')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name, status = EXCLUDED.status;
INSERT INTO public.user_preferences (user_id, language) VALUES
  ('00000000-0000-4000-e000-000000000001', 'fr');

-- Comptable : ecrit un cout (module costs).
SELECT pg_temp.se_connecter('00000000-0000-4000-e000-000000000001');
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$INSERT INTO public.costs (description, amount) VALUES ('Test D-017', 1)$$,
  'un comptable peut saisir un cout');
SELECT is((SELECT count(*)::int FROM public.user_preferences), 1,
  'chacun voit sa preference');

-- Chauffeur : ni cout ni departement, ne voit pas la preference d'autrui.
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-e000-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$INSERT INTO public.costs (description, amount) VALUES ('Test D-017', 1)$$,
  '42501', NULL, 'un chauffeur ne peut pas saisir un cout');
SELECT throws_ok(
  $$INSERT INTO public.departments (name) VALUES ('Test D-017')$$,
  '42501', NULL, 'un chauffeur ne peut pas creer un departement');
SELECT is((SELECT count(*)::int FROM public.user_preferences), 0,
  'un utilisateur ne voit pas la preference d''un autre');
SELECT is((SELECT count(*)::int FROM public.costs), 1,
  'un chauffeur lit les couts (lecture connectee, perimetre au LOT 02)');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
