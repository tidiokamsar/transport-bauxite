-- Tests (D-022, D-025, CDC 31) : immobilisations des engins loues, statut de
-- l'engin, journal des actions, heures par imputation
-- (migration 20261110210000_immobilisations). Tout est annule.
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

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8c00-000000000001', 'maintenance.immo@exemple.invalid'),
  ('00000000-0000-4000-8c00-000000000002', 'comptable.immo@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status) VALUES
  ('00000000-0000-4000-8c00-000000000001', 'maintenance_chief', 'Chef maintenance', 'active'),
  ('00000000-0000-4000-8c00-000000000002', 'accountant', 'Comptable immo', 'active')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status) VALUES
  ('00000000-0000-4000-8c00-0000000000b1', 'TEST-IMMO-1', 'Test', 40, 'tipper', 'active'),
  ('00000000-0000-4000-8c00-0000000000b2', 'TEST-IMMO-2', 'Test', 10, 'loader', 'active');

SELECT pg_temp.se_connecter('00000000-0000-4000-8c00-000000000001');
SET LOCAL ROLE authenticated;

CREATE TEMP TABLE i1 AS SELECT public.declarer_immobilisation('00000000-0000-4000-8c00-0000000000b1',
  now() - interval '10 hours', 'panne', 'loueur', 'Fuite hydraulique de benne', 'NM-4521') AS id;
SELECT is((SELECT status::text FROM public.vehicles WHERE id = '00000000-0000-4000-8c00-0000000000b1'), 'immobilized',
  'la declaration immobilise le camion');
SELECT throws_ok($$SELECT public.declarer_immobilisation('00000000-0000-4000-8c00-0000000000b1', now() - interval '1 hour',
  'panne', 'loueur', 'Doublon')$$, '22023', NULL, 'une seule immobilisation ouverte par engin');
SELECT throws_ok($$SELECT public.declarer_immobilisation('00000000-0000-4000-8c00-0000000000b2', now() + interval '2 hours',
  'panne', 'loueur', 'Futur')$$, '22023', NULL, 'heure future refusee');
SELECT throws_ok($$SELECT public.declarer_immobilisation('00000000-0000-4000-8c00-0000000000b2', now(), 'panne', 'loueur', '  ')$$,
  '22023', NULL, 'description requise');
SELECT throws_ok($$INSERT INTO public.immobilisations (vehicle_id, debut, cause, imputation, description)
  VALUES ('00000000-0000-4000-8c00-0000000000b2', now(), 'panne', 'loueur', 'direct')$$, '42501', NULL, 'insertion directe refusee');

SELECT throws_ok($$SELECT public.cloturer_immobilisation((SELECT id FROM i1), now() - interval '11 hours')$$,
  '22023', NULL, 'fin anterieure au debut refusee');
SELECT lives_ok($$SELECT public.cloturer_immobilisation((SELECT id FROM i1), now() - interval '4 hours', 'Verin remplace par Nimba Mining')$$,
  'cloture');
SELECT is((SELECT status::text FROM public.vehicles WHERE id = '00000000-0000-4000-8c00-0000000000b1'), 'active',
  'la cloture remet le camion en service');
SELECT throws_ok($$SELECT public.declarer_immobilisation('00000000-0000-4000-8c00-0000000000b1', now() - interval '6 hours',
  'pneumatique', 'exploitant', 'Chevauchement')$$, '22023', NULL, 'chevauchement avec une immobilisation cloturee refuse');

SELECT throws_ok($$SELECT public.corriger_immobilisation((SELECT id FROM i1), 'pneumatique', 'exploitant',
  now() - interval '10 hours', now() - interval '4 hours', NULL)$$, '22023', NULL, 'correction sans motif refusee');
SELECT lives_ok($$SELECT public.corriger_immobilisation((SELECT id FROM i1), 'pneumatique', 'exploitant',
  now() - interval '10 hours', now() - interval '4 hours', 'Crevaison, pas une panne du loueur')$$, 'correction motivee');
SELECT is((SELECT (count(*), max(motif) FILTER (WHERE action = 'correction'))::text FROM public.immobilisations_journal
  WHERE immobilisation_id = (SELECT id FROM i1)), '(3,"Crevaison, pas une panne du loueur")',
  'declaration, cloture et correction journalisees');
SELECT is((SELECT avant->>'imputation' FROM public.immobilisations_journal
  WHERE immobilisation_id = (SELECT id FROM i1) AND action = 'correction'), 'loueur', 'le journal garde l''etat avant');

-- Engin de chargement en maintenance planifiee, encore ouverte
CREATE TEMP TABLE i2 AS SELECT public.declarer_immobilisation('00000000-0000-4000-8c00-0000000000b2',
  now() - interval '2 hours', 'maintenance_planifiee', 'loueur', 'Revision 1000 h') AS id;
SELECT is((SELECT status::text FROM public.vehicles WHERE id = '00000000-0000-4000-8c00-0000000000b2'), 'maintenance',
  'maintenance planifiee : engin en maintenance');
SELECT is(
  (SELECT string_agg(imputation || ':' || heures::text, ',' ORDER BY imputation)
   FROM public.heures_immobilisation(now() - interval '8 hours', now() + interval '1 hour')
   WHERE vehicle_id IN ('00000000-0000-4000-8c00-0000000000b1', '00000000-0000-4000-8c00-0000000000b2')),
  'exploitant:4.00,loueur:2.00', 'heures bornees a la periode, immobilisation ouverte comptee jusqu''a maintenant');

SELECT throws_ok($$SELECT public.annuler_immobilisation((SELECT id FROM i2), '')$$, '22023', NULL, 'annulation sans motif refusee');
SELECT lives_ok($$SELECT public.annuler_immobilisation((SELECT id FROM i2), 'Saisie sur le mauvais engin')$$, 'annulation motivee');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-8c00-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.declarer_immobilisation('00000000-0000-4000-8c00-0000000000b2', now(), 'panne', 'loueur', 'x')$$,
  '42501', NULL, 'un comptable (lecture seule) ne declare pas');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
