-- Tests (D-075) : perimetre site des lectures de la chaine J1 et J2
-- (journal des voyages, dispatch, tickets CBG, immobilisations, pointages,
-- objectifs, livraisons et stocks de carburant, positions GPS), retrait des
-- ecritures navigateur heritees, perimetre des ressources affectees a un
-- voyage (migration 20261121095000). Tout est annule.
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

SELECT plan(19);

-- Chaque politique de lecture porte le perimetre
SELECT is((SELECT count(*)::int FROM pg_policies
            WHERE schemaname = 'public' AND cmd IN ('SELECT', 'ALL')
              AND tablename IN ('trip_events', 'decisions_dispatch', 'tickets_pesee_cbg', 'immobilisations', 'pointages_engins',
                                'objectifs_production', 'livraisons_carburant_cbg', 'fuel_stocks', 'vehicle_tracking')
              AND coalesce(qual, '') !~ '(site_permis|vehicule_permis|voyage_permis)'), 0,
  'les 9 tables : aucune politique de lecture sans perimetre');
SELECT is((SELECT count(*)::int FROM information_schema.role_table_grants
            WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated') AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
              AND table_name IN ('trip_events', 'vehicle_tracking', 'fuel_stocks')), 0,
  'journal des voyages, positions GPS et stocks carburant : aucune ecriture depuis le navigateur');
SELECT ok(has_function_privilege('service_role', 'public.ingest_gps_data(text, numeric, numeric, numeric, numeric, numeric)', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'public.ingest_gps_data(text, numeric, numeric, numeric, numeric, numeric)', 'EXECUTE'),
  'les positions arrivent seulement par l''ingestion (service_role)');

-- Donnees : deux sites, un engin et un voyage par site
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-d750-000000000001', 'chef.s1.d750@exemple.invalid'),
  ('00000000-0000-4000-d750-000000000002', 'global.d750@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-d750-0000000000a1', 'Mine S1 D750', 'mine'),
  ('00000000-0000-4000-d750-0000000000a2', 'Mine S2 D750', 'mine');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-d750-000000000001', 'operations_manager', 'Chef S1 D750', 'active', '00000000-0000-4000-d750-0000000000a1'),
  ('00000000-0000-4000-d750-000000000002', 'operations_manager', 'Global D750', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.drivers (id, name, license_number, license_category, license_expiry, hire_date, status, site_id) VALUES
  ('00000000-0000-4000-d750-0000000000c1', 'Chauffeur S1 D750', 'D750-1', 'C', '2030-01-01', '2020-01-01', 'active', '00000000-0000-4000-d750-0000000000a1'),
  ('00000000-0000-4000-d750-0000000000c2', 'Chauffeur S2 D750', 'D750-2', 'C', '2030-01-01', '2020-01-01', 'active', '00000000-0000-4000-d750-0000000000a2');
INSERT INTO public.droits_utilisateur (utilisateur, module, niveau)
SELECT u, m, 'lecture' FROM unnest(ARRAY['00000000-0000-4000-d750-000000000001', '00000000-0000-4000-d750-000000000002']::uuid[]) u,
       unnest(ARRAY['maintenance', 'fuel', 'gps_tracking', 'planning']) m
ON CONFLICT (utilisateur, module) DO UPDATE SET niveau = EXCLUDED.niveau;
INSERT INTO public.droits_utilisateur (utilisateur, module, niveau) VALUES
  ('00000000-0000-4000-d750-000000000001', 'trips', 'ecriture'),
  ('00000000-0000-4000-d750-000000000002', 'trips', 'ecriture')
ON CONFLICT (utilisateur, module) DO UPDATE SET niveau = EXCLUDED.niveau;
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status, site_id) VALUES
  ('00000000-0000-4000-d750-0000000000b1', 'TEST-D750-S1', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-d750-0000000000a1'),
  ('00000000-0000-4000-d750-0000000000b2', 'TEST-D750-S2', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-d750-0000000000a2');
INSERT INTO public.trips (id, reference, planned_date, vehicle_id, departure_site_id, arrival_site_id, etat) VALUES
  ('00000000-0000-4000-d750-000000000101', 'TEST-D750-V1', '2001-05-10', '00000000-0000-4000-d750-0000000000b1',
   '00000000-0000-4000-d750-0000000000a1', '00000000-0000-4000-d750-0000000000a1', 'PLANNED'),
  ('00000000-0000-4000-d750-000000000102', 'TEST-D750-V2', '2001-05-10', '00000000-0000-4000-d750-0000000000b2',
   '00000000-0000-4000-d750-0000000000a2', '00000000-0000-4000-d750-0000000000a2', 'PLANNED');
INSERT INTO public.trip_events (trip_id, etat_apres, survenu_le) VALUES
  ('00000000-0000-4000-d750-000000000101', 'PLANNED', '2001-05-10 06:00+00'),
  ('00000000-0000-4000-d750-000000000102', 'PLANNED', '2001-05-10 06:00+00');
INSERT INTO public.immobilisations (vehicle_id, debut, cause, imputation, description) VALUES
  ('00000000-0000-4000-d750-0000000000b1', '2001-05-10 07:00+00', 'panne', 'loueur', 'Test D750 S1'),
  ('00000000-0000-4000-d750-0000000000b2', '2001-05-10 07:00+00', 'panne', 'loueur', 'Test D750 S2');
INSERT INTO public.livraisons_carburant_cbg (reference, date_livraison, site_id, volume_litres, prix_litre) VALUES
  ('TEST-D750-L1', '2001-05-10', '00000000-0000-4000-d750-0000000000a1', 1000, 12000),
  ('TEST-D750-L2', '2001-05-10', '00000000-0000-4000-d750-0000000000a2', 1000, 12000);
INSERT INTO public.vehicle_tracking (vehicle_id, latitude, longitude) VALUES
  ('00000000-0000-4000-d750-0000000000b1', 7.5, -8.5),
  ('00000000-0000-4000-d750-0000000000b2', 7.6, -8.6);
INSERT INTO public.fuel_stocks (site_id, tank_capacity) VALUES
  ('00000000-0000-4000-d750-0000000000a1', 10000),
  ('00000000-0000-4000-d750-0000000000a2', 10000);

-- Compte affecte au site S1
SELECT pg_temp.se_connecter('00000000-0000-4000-d750-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.trip_events WHERE trip_id::text LIKE '00000000-0000-4000-d750-%'), 1,
  'site S1 : seul le journal du voyage de son site');
SELECT is((SELECT count(*)::int FROM public.immobilisations WHERE description LIKE 'Test D750%'), 1,
  'site S1 : seule l''immobilisation de son engin');
SELECT is((SELECT count(*)::int FROM public.livraisons_carburant_cbg WHERE reference LIKE 'TEST-D750-%'), 1,
  'site S1 : seule la livraison de carburant de son site');
SELECT is((SELECT count(*)::int FROM public.vehicle_tracking WHERE vehicle_id::text LIKE '00000000-0000-4000-d750-%'), 1,
  'site S1 : seule la position de son engin');
SELECT is((SELECT count(*)::int FROM public.fuel_stocks WHERE site_id::text LIKE '00000000-0000-4000-d750-%'), 1,
  'site S1 : seul le stock de son site');
SELECT throws_ok($$INSERT INTO public.vehicle_tracking (vehicle_id, latitude, longitude) VALUES ('00000000-0000-4000-d750-0000000000b1', 1, 1)$$,
  '42501', NULL, 'aucune position saisie depuis le navigateur');
SELECT throws_ok($$SELECT public.decider_affectation('00000000-0000-4000-d750-000000000101', 'acceptee',
  '00000000-0000-4000-d750-0000000000b2', '00000000-0000-4000-d750-0000000000c1', NULL)$$,
  '42501', 'Camion, engin ou chauffeur hors de votre perimetre', 'dispatch : camion d''un autre site refuse');
SELECT throws_ok($$SELECT public.decider_affectation('00000000-0000-4000-d750-000000000101', 'acceptee',
  '00000000-0000-4000-d750-0000000000b1', '00000000-0000-4000-d750-0000000000c2', NULL)$$,
  '42501', 'Camion, engin ou chauffeur hors de votre perimetre', 'dispatch : chauffeur d''un autre site refuse');
SELECT throws_ok($$SELECT public.decider_affectation('00000000-0000-4000-d750-000000000102', 'acceptee',
  '00000000-0000-4000-d750-0000000000b2', '00000000-0000-4000-d750-0000000000c2', NULL)$$,
  'P0002', 'Voyage introuvable', 'dispatch : voyage d''un autre site introuvable');
RESET ROLE;
-- Garde sur trips, avec une session utilisateur (role proprietaire, sans SET ROLE)
SELECT throws_ok($$UPDATE public.trips SET vehicle_id = '00000000-0000-4000-d750-0000000000b2' WHERE id = '00000000-0000-4000-d750-000000000101'$$,
  '42501', 'Camion hors de votre perimetre', 'garde : camion d''un autre site refuse sur un voyage');
SELECT throws_ok($$UPDATE public.trips SET driver_id = '00000000-0000-4000-d750-0000000000c2' WHERE id = '00000000-0000-4000-d750-000000000101'$$,
  '42501', 'Chauffeur hors de votre perimetre', 'garde : chauffeur d''un autre site refuse sur un voyage');

-- Compte global
SELECT pg_temp.se_connecter('00000000-0000-4000-d750-000000000002');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.trip_events WHERE trip_id::text LIKE '00000000-0000-4000-d750-%'), 2,
  'profil sans site : journal des deux voyages');
SELECT is((SELECT count(*)::int FROM public.immobilisations WHERE description LIKE 'Test D750%'), 2,
  'profil sans site : deux immobilisations');
SELECT is((SELECT count(*)::int FROM public.livraisons_carburant_cbg WHERE reference LIKE 'TEST-D750-%'), 2,
  'profil sans site : deux livraisons');
SELECT is((SELECT count(*)::int FROM public.vehicle_tracking WHERE vehicle_id::text LIKE '00000000-0000-4000-d750-%'), 2,
  'profil sans site : deux positions');
SELECT is((SELECT count(*)::int FROM public.fuel_stocks WHERE site_id::text LIKE '00000000-0000-4000-d750-%'), 2,
  'profil sans site : deux stocks');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
