-- Tests (D-039, LOT 02 phase 2) : gardes de perimetre par declencheurs sur
-- les ecritures. Les fonctions SECURITY DEFINER passent outre la RLS : les
-- declencheurs BEFORE garantissent le meme perimetre que la lecture (D-038),
-- y compris a travers elles (preuves par saisir_pointage,
-- declarer_immobilisation et annuler_fiche).
-- Pour isoler le declencheur, les comptes affectes portent le role admin :
-- tous les droits de module passent, seule la garde peut refuser.
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

SELECT plan(10);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-9600-000000000001', 'admin.d039@exemple.invalid'),
  ('00000000-0000-4000-9600-000000000002', 'sitea.d039@exemple.invalid'),
  ('00000000-0000-4000-9600-000000000003', 'siteb.d039@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-9600-0000000000a1', 'Site A D-039', 'mine'),
  ('00000000-0000-4000-9600-0000000000a2', 'Site B D-039', 'depot');
-- Admins affectes a un site : la garde de perimetre s'applique aussi a eux
-- (site_permis ne deroge pas au role), les droits de module ne genent pas.
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-9600-000000000001', 'admin', 'Admin global', 'active', NULL),
  ('00000000-0000-4000-9600-000000000002', 'admin', 'Admin site A', 'active', '00000000-0000-4000-9600-0000000000a1'),
  ('00000000-0000-4000-9600-000000000003', 'admin', 'Admin site B', 'active', '00000000-0000-4000-9600-0000000000a2')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, site_id) VALUES
  ('00000000-0000-4000-9600-0000000000b1', 'TEST-G-A', 'Test', 40, 'tipper', '00000000-0000-4000-9600-0000000000a1'),
  ('00000000-0000-4000-9600-0000000000b2', 'TEST-G-B', 'Test', 40, 'tipper', '00000000-0000-4000-9600-0000000000a2');
INSERT INTO public.fiches_terrain (id, numero, type, date_fiche, site_id, statut) VALUES
  ('00000000-0000-4000-9600-0000000000f1', 'FP-140000-931', 'pointage_engins', current_date, '00000000-0000-4000-9600-0000000000a1', 'retournee'),
  ('00000000-0000-4000-9600-0000000000f2', 'FP-140000-932', 'pointage_engins', current_date, '00000000-0000-4000-9600-0000000000a2', 'retournee');

-- Ecritures directes bornees, vues de l'admin du site A.
SELECT pg_temp.se_connecter('00000000-0000-4000-9600-000000000002');
SELECT lives_ok($$INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, site_id)
  VALUES ('00000000-0000-4000-9600-0000000000b3', 'TEST-G-A2', 'Test', 40, 'tipper', '00000000-0000-4000-9600-0000000000a1')$$,
  'admin du site A : cree un vehicule de son site');
SELECT throws_ok($$INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, site_id)
  VALUES ('00000000-0000-4000-9600-0000000000b4', 'TEST-G-X', 'Test', 40, 'tipper', '00000000-0000-4000-9600-0000000000a2')$$,
  '42501', NULL, 'admin du site A : vehicule du site B refuse (garde)');
SELECT throws_ok($$UPDATE public.vehicles SET brand_model = 'X' WHERE id = '00000000-0000-4000-9600-0000000000b2'$$,
  '42501', NULL, 'admin du site A : modification d''un vehicule du site B refusee');
SELECT throws_ok($$DELETE FROM public.vehicles WHERE id = '00000000-0000-4000-9600-0000000000b2'$$,
  '42501', NULL, 'admin du site A : suppression d''un vehicule du site B refusee');
SELECT throws_ok($$INSERT INTO public.trips (reference, planned_date, departure_site_id, arrival_site_id)
  VALUES ('TEST-G-B-B', current_date, '00000000-0000-4000-9600-0000000000a2', '00000000-0000-4000-9600-0000000000a2')$$,
  '42501', NULL, 'admin du site A : voyage du site B refuse');
SELECT lives_ok($$INSERT INTO public.trips (reference, planned_date, departure_site_id, arrival_site_id)
  VALUES ('TEST-G-A-A', current_date, '00000000-0000-4000-9600-0000000000a1', '00000000-0000-4000-9600-0000000000a2')$$,
  'admin du site A : voyage touchant son site accepte');
RESET ROLE;

-- Fonctions SECURITY DEFINER : la garde passe aussi par elles.
SELECT pg_temp.se_connecter('00000000-0000-4000-9600-000000000003');
SELECT throws_ok(
  $$SELECT public.saisir_pointage('00000000-0000-4000-9600-0000000000f1', '00000000-0000-4000-9600-0000000000b1', 10, 20)$$,
  '42501', NULL,
  'admin du site B : pointage sur une fiche du site A refuse (table liee par fiche)');
SELECT throws_ok(
  $$SELECT public.declarer_immobilisation('00000000-0000-4000-9600-0000000000b1', now(), 'panne', 'loueur', 'test D-039')$$,
  '42501', NULL,
  'admin du site B : immobilisation d''un vehicule du site A refusee (table liee par vehicule)');
SELECT throws_ok(
  $$SELECT public.annuler_fiche('00000000-0000-4000-9600-0000000000f1', 'test D-039')$$,
  '42501', NULL,
  'admin du site B : annulation d''une fiche du site A refusee');
RESET ROLE;

-- Compte global : non borne (comportement inchange).
SELECT pg_temp.se_connecter('00000000-0000-4000-9600-000000000001');
SELECT lives_ok($$INSERT INTO public.trips (reference, planned_date, departure_site_id, arrival_site_id)
  VALUES ('TEST-G-N-N', current_date, NULL, NULL)$$,
  'compte global : voyage sans site accepte');
RESET ROLE;

SELECT finish();
ROLLBACK;
