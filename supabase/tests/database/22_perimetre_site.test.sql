-- Tests (D-038, LOT 02 phase 1) : perimetre site dans le modele d'acces.
-- Un compte affecte a un site ne lit ni n'ecrit que les lignes de son site
-- (trips : depart OU arrivee) ; un compte global (site NULL) voit tout comme
-- avant ; une ligne sans site reste visible des seuls comptes globaux.
-- Les droits role x module (D-012) et par utilisateur (D-036) restent le
-- premier filtre. Tout est annule en fin de transaction.
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
  ('00000000-0000-4000-9500-000000000001', 'admin.d038@exemple.invalid'),
  ('00000000-0000-4000-9500-000000000002', 'sitea.d038@exemple.invalid'),
  ('00000000-0000-4000-9500-000000000003', 'siteb.d038@exemple.invalid'),
  ('00000000-0000-4000-9500-000000000004', 'global.d038@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-9500-0000000000a1', 'Site A D-038', 'mine'),
  ('00000000-0000-4000-9500-0000000000a2', 'Site B D-038', 'depot');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-9500-000000000001', 'admin', 'Admin D-038', 'active', NULL),
  ('00000000-0000-4000-9500-000000000002', 'operations_manager', 'Site A', 'active', '00000000-0000-4000-9500-0000000000a1'),
  ('00000000-0000-4000-9500-000000000003', 'operations_manager', 'Site B', 'active', '00000000-0000-4000-9500-0000000000a2'),
  ('00000000-0000-4000-9500-000000000004', 'operations_manager', 'Global', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;

INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, site_id) VALUES
  ('00000000-0000-4000-9500-0000000000b1', 'TEST-S-A', 'Test', 40, 'tipper', '00000000-0000-4000-9500-0000000000a1'),
  ('00000000-0000-4000-9500-0000000000b2', 'TEST-S-B', 'Test', 40, 'tipper', '00000000-0000-4000-9500-0000000000a2'),
  ('00000000-0000-4000-9500-0000000000b3', 'TEST-S-N', 'Test', 40, 'tipper', NULL);
INSERT INTO public.trips (id, reference, planned_date, departure_site_id, arrival_site_id) VALUES
  ('00000000-0000-4000-9500-0000000000c1', 'TEST-P-A-A', current_date, '00000000-0000-4000-9500-0000000000a1', '00000000-0000-4000-9500-0000000000a1'),
  ('00000000-0000-4000-9500-0000000000c2', 'TEST-P-A-B', current_date, '00000000-0000-4000-9500-0000000000a1', '00000000-0000-4000-9500-0000000000a2'),
  ('00000000-0000-4000-9500-0000000000c3', 'TEST-P-B-B', current_date, '00000000-0000-4000-9500-0000000000a2', '00000000-0000-4000-9500-0000000000a2');
INSERT INTO public.drivers (id, name, license_number, license_category, license_expiry, hire_date, site_id) VALUES
  ('00000000-0000-4000-9500-0000000000d1', 'Chauffeur A', 'PC-A-038', 'C', current_date + 365, current_date - 365, '00000000-0000-4000-9500-0000000000a1'),
  ('00000000-0000-4000-9500-0000000000d2', 'Chauffeur B', 'PC-B-038', 'C', current_date + 365, current_date - 365, '00000000-0000-4000-9500-0000000000a2');
INSERT INTO public.fiches_terrain (id, numero, type, date_fiche, site_id, statut) VALUES
  ('00000000-0000-4000-9500-0000000000f1', 'FP-140000-921', 'pointage_engins', current_date, '00000000-0000-4000-9500-0000000000a1', 'saisie');

-- Fonction de perimetre, vue du compte du site A.
SELECT pg_temp.se_connecter('00000000-0000-4000-9500-000000000002');
SET LOCAL ROLE authenticated;
SELECT is(public.site_permis('00000000-0000-4000-9500-0000000000a1'::uuid), true, 'compte du site A : son site permis');
SELECT is(public.site_permis('00000000-0000-4000-9500-0000000000a2'::uuid), false, 'compte du site A : site B refuse');
SELECT is(public.site_permis(NULL), false, 'compte du site A : ligne sans site refusee');
SELECT is((SELECT count(*)::int FROM public.vehicles WHERE registration LIKE 'TEST-S-%'), 1, 'compte du site A : ne lit que le vehicule de son site');
SELECT is((SELECT count(*)::int FROM public.trips WHERE reference LIKE 'TEST-P-%'), 2, 'compte du site A : lit les voyages qui touchent son site (depart ou arrivee)');
SELECT is((SELECT count(*)::int FROM public.drivers WHERE license_number LIKE 'PC-%-038'), 1, 'compte du site A : un seul chauffeur, celui de son site');
SELECT is((SELECT count(*)::int FROM public.fiches_terrain WHERE numero = 'FP-140000-921'), 1, 'compte du site A : fiche de son site');
SELECT lives_ok($$UPDATE public.vehicles SET brand_model = 'Test A' WHERE id = '00000000-0000-4000-9500-0000000000b1'$$,
  'compte du site A : modifie le vehicule de son site');
-- Une ligne masquee par le perimetre n'est pas en erreur : l'UPDATE la
-- ignore (0 ligne modifiee), comme le fait PostgreSQL sous RLS.
WITH modifie AS (
  UPDATE public.vehicles SET brand_model = 'X'
   WHERE id = '00000000-0000-4000-9500-0000000000b2' RETURNING 1
)
SELECT is((SELECT count(*)::int FROM modifie), 0,
  'compte du site A : vehicule du site B ignore (aucune ligne modifiee)');
SELECT throws_ok($$INSERT INTO public.organisations (raison_sociale) VALUES ('Fausse org')$$,
  '42501', NULL, 'organisations : creation reservee a l administrateur');
RESET ROLE;

-- Vue du compte du site B.
SELECT pg_temp.se_connecter('00000000-0000-4000-9500-000000000003');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.vehicles WHERE registration LIKE 'TEST-S-%'), 1, 'compte du site B : ne lit que le vehicule de son site');
SELECT is((SELECT count(*)::int FROM public.trips WHERE reference LIKE 'TEST-P-%'), 2, 'compte du site B : A-B et B-B, pas A-A');
RESET ROLE;

-- Vue du compte global (site NULL) : comportement inchange.
SELECT pg_temp.se_connecter('00000000-0000-4000-9500-000000000004');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.vehicles WHERE registration LIKE 'TEST-S-%'), 3, 'compte global : tous les vehicules de test, y compris sans site');
SELECT is((SELECT count(*)::int FROM public.trips WHERE reference LIKE 'TEST-P-%'), 3, 'compte global : tous les voyages de test');
SELECT is(public.site_permis(NULL), true, 'compte global : ligne sans site permise');
RESET ROLE;

-- Referentiel organisations : l'administrateur cree, tous lisent.
SELECT pg_temp.se_connecter('00000000-0000-4000-9500-000000000001');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$INSERT INTO public.organisations (raison_sociale) VALUES ('Org test D-038')$$,
  'l administrateur cree une organisation');
SELECT is((SELECT raison_sociale FROM public.organisations WHERE raison_sociale = 'Org test D-038'), 'Org test D-038',
  'organisation lisible (referentiel)');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-9500-000000000002');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.organisations WHERE raison_sociale = 'Org test D-038'), 1,
  'un compte de site lit le referentiel des organisations');
RESET ROLE;

SELECT finish();
ROLLBACK;
