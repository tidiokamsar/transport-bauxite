-- Tests RLS (constat N4) : is_admin() a search_path fixe et exige un
-- statut actif ; un admin inactif ne peut plus modifier les roles
-- (migration 20261108090000_durcir_is_admin). Tout est annule en fin de
-- transaction.
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
  ('00000000-0000-4000-c000-000000000001', 'admin.actif@exemple.invalid'),
  ('00000000-0000-4000-c000-000000000002', 'admin.inactif@exemple.invalid'),
  ('00000000-0000-4000-c000-000000000003', 'chauffeur.n4@exemple.invalid');

INSERT INTO public.profiles (id, role, full_name, status) VALUES
  ('00000000-0000-4000-c000-000000000001', 'admin', 'Admin actif', 'active'),
  ('00000000-0000-4000-c000-000000000002', 'admin', 'Admin inactif', 'inactive'),
  ('00000000-0000-4000-c000-000000000003', 'driver', 'Chauffeur N4', 'active')
ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role, full_name = EXCLUDED.full_name, status = EXCLUDED.status;

SELECT ok(
  (SELECT proconfig @> ARRAY['search_path=""']
     FROM pg_proc WHERE oid = 'public.is_admin()'::regprocedure),
  'is_admin() fixe un search_path vide');

SELECT pg_temp.se_connecter('00000000-0000-4000-c000-000000000001');
SELECT is(public.is_admin(), true, 'un admin actif est admin');

SELECT lives_ok(
  $$UPDATE public.profiles SET role = 'logistician'
    WHERE id = '00000000-0000-4000-c000-000000000003'$$,
  'un admin actif peut modifier un role');

SELECT pg_temp.se_connecter('00000000-0000-4000-c000-000000000002');
SELECT is(public.is_admin(), false, 'un admin inactif n''est pas admin');

SELECT throws_ok(
  $$UPDATE public.profiles SET role = 'admin'
    WHERE id = '00000000-0000-4000-c000-000000000003'$$,
  '42501', NULL,
  'un admin inactif ne peut pas modifier un role');

SELECT throws_ok(
  $$UPDATE public.profiles SET status = 'active'
    WHERE id = '00000000-0000-4000-c000-000000000002'$$,
  '42501', NULL,
  'un admin inactif ne peut pas se reactiver');

SELECT * FROM finish();
ROLLBACK;
