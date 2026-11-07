-- Tests RLS (decision D-007) : garde contre l'auto-promotion (Tranche 0.2,
-- migration 20260903090000_protect_profiles_role_escalation).
-- Execution : npm run test:rls (supabase test db). Tout est annule en fin
-- de transaction.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

-- Simule la session d'un utilisateur (NULL = service role, sans JWT).
-- auth.uid() lit request.jwt.claims (GoTrue recent) ou
-- request.jwt.claim.sub (image Postgres seule) : on renseigne les deux.
CREATE FUNCTION pg_temp.se_connecter(p_id uuid) RETURNS void
LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', coalesce(p_id::text, ''), true),
         set_config('request.jwt.claims',
           CASE WHEN p_id IS NULL THEN '{}'
                ELSE json_build_object('sub', p_id, 'role', 'authenticated')::text END,
           true);
$$;

SELECT plan(7);

-- Jeu de donnees de test : un chauffeur et un administrateur.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a000-000000000001', 'chauffeur.test@exemple.invalid'),
  ('00000000-0000-4000-a000-000000000002', 'admin.test@exemple.invalid');

INSERT INTO public.profiles (id, role, full_name) VALUES
  ('00000000-0000-4000-a000-000000000001', 'driver', 'Chauffeur test'),
  ('00000000-0000-4000-a000-000000000002', 'admin', 'Admin test')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name;

SELECT has_trigger('public', 'profiles', 'profiles_guard_sensitive_columns',
  'le trigger de garde existe sur profiles');

-- 1. Le trigger refuse a un non-admin de changer son role, meme si une
--    politique RLS laissait passer l'UPDATE (on contourne RLS ici pour
--    isoler le trigger).
SELECT pg_temp.se_connecter('00000000-0000-4000-a000-000000000001');

SELECT throws_ok(
  $$UPDATE public.profiles SET role = 'admin'
    WHERE id = '00000000-0000-4000-a000-000000000001'$$,
  '42501', NULL,
  'un chauffeur ne peut pas s''attribuer le role admin');

SELECT throws_ok(
  $$UPDATE public.profiles SET status = 'inactive'
    WHERE id = '00000000-0000-4000-a000-000000000001'$$,
  '42501', NULL,
  'un chauffeur ne peut pas modifier son statut');

SELECT lives_ok(
  $$UPDATE public.profiles SET phone = '+224000000000'
    WHERE id = '00000000-0000-4000-a000-000000000001'$$,
  'les colonnes non sensibles restent modifiables');

-- 2. Meme tentative sous le role authenticated, RLS active : le role ne
--    doit pas changer, que l'UPDATE soit rejete ou filtre par RLS.
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  UPDATE public.profiles SET role = 'admin'
  WHERE id = '00000000-0000-4000-a000-000000000001';
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END;
$$;
RESET ROLE;

SELECT is(
  (SELECT role::text FROM public.profiles WHERE id = '00000000-0000-4000-a000-000000000001'),
  'driver',
  'sous RLS, le chauffeur reste driver');

-- 3. Un admin peut changer le role d'un autre utilisateur.
SELECT pg_temp.se_connecter('00000000-0000-4000-a000-000000000002');

SELECT lives_ok(
  $$UPDATE public.profiles SET role = 'logistician'
    WHERE id = '00000000-0000-4000-a000-000000000001'$$,
  'un admin peut modifier le role d''un utilisateur');

-- 4. Sans JWT utilisateur (service role, dashboard), la modification passe.
SELECT pg_temp.se_connecter(NULL);

SELECT lives_ok(
  $$UPDATE public.profiles SET role = 'driver'
    WHERE id = '00000000-0000-4000-a000-000000000001'$$,
  'le service role (sans auth.uid) peut modifier le role');

SELECT * FROM finish();
ROLLBACK;
