-- Tests (D-020) : table de signalement du mode demonstration.
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

SELECT plan(5);

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-f000-000000000001', 'chauffeur.d020@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status)
VALUES ('00000000-0000-4000-f000-000000000001', 'driver', 'Chauffeur D-020', 'active')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;
INSERT INTO public.sigtb_demonstration (id, active, chargee_le) VALUES (1, true, now())
ON CONFLICT (id) DO UPDATE SET active = true;

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.sigtb_demonstration'::regclass), 'RLS active');
SELECT is(has_table_privilege('anon', 'public.sigtb_demonstration', 'SELECT'), false, 'anon ne lit pas le signal');

SELECT pg_temp.se_connecter('00000000-0000-4000-f000-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT active FROM public.sigtb_demonstration), true, 'un utilisateur connecte voit le signal (bandeau)');
UPDATE public.sigtb_demonstration SET active = false;
SELECT is((SELECT active FROM public.sigtb_demonstration), true,
  'un non-administrateur ne peut pas retirer le signal');
SELECT throws_ok($$INSERT INTO public.sigtb_demonstration (id, active) VALUES (2, true)$$, NULL, NULL,
  'une seule ligne de signal');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
