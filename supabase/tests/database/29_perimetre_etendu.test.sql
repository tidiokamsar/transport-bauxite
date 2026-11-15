-- Tests (D-046) : un administrateur affecte a un site ne lit plus les
-- autres sites (politiques « Admins full access » retirees) ; perimetre
-- etendu aux pleins, maintenance, pneus, documents, incidents, pesees et
-- alertes (migration 20261115210000). Comptages bornes aux lignes du test.
-- Tout est annule.
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

SELECT plan(11);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-9b00-000000000001', 'admin.global.d046@exemple.invalid'),
  ('00000000-0000-4000-9b00-000000000002', 'admin.sitea.d046@exemple.invalid'),
  ('00000000-0000-4000-9b00-000000000003', 'flotte.sitea.d046@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-9b00-0000000000a1', 'Site A D-046', 'mine'),
  ('00000000-0000-4000-9b00-0000000000a2', 'Site B D-046', 'depot');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-9b00-000000000001', 'admin', 'Admin global', 'active', NULL),
  ('00000000-0000-4000-9b00-000000000002', 'admin', 'Admin site A', 'active', '00000000-0000-4000-9b00-0000000000a1'),
  ('00000000-0000-4000-9b00-000000000003', 'fleet_manager', 'Flotte site A', 'active', '00000000-0000-4000-9b00-0000000000a1')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, site_id) VALUES
  ('00000000-0000-4000-9b00-0000000000b1', 'TEST-D046-A', 'Test', 40, 'tipper', '00000000-0000-4000-9b00-0000000000a1'),
  ('00000000-0000-4000-9b00-0000000000b2', 'TEST-D046-B', 'Test', 40, 'tipper', '00000000-0000-4000-9b00-0000000000a2');
INSERT INTO public.trips (id, reference, planned_date, vehicle_id, departure_site_id, arrival_site_id) VALUES
  ('00000000-0000-4000-9b00-000000000011', 'TEST-D046-TA', '2001-09-01', '00000000-0000-4000-9b00-0000000000b1', '00000000-0000-4000-9b00-0000000000a1', '00000000-0000-4000-9b00-0000000000a1'),
  ('00000000-0000-4000-9b00-000000000012', 'TEST-D046-TB', '2001-09-01', '00000000-0000-4000-9b00-0000000000b2', '00000000-0000-4000-9b00-0000000000a2', '00000000-0000-4000-9b00-0000000000a2');
INSERT INTO public.fuel_transactions (reference, vehicle_id, volume_liters, site_id) VALUES
  ('TEST-D046-PA', '00000000-0000-4000-9b00-0000000000b1', 100, '00000000-0000-4000-9b00-0000000000a1'),
  ('TEST-D046-PB', '00000000-0000-4000-9b00-0000000000b2', 100, NULL);
INSERT INTO public.maintenance_orders (id, vehicle_id, maintenance_type, description) VALUES
  ('00000000-0000-4000-9b00-000000000021', '00000000-0000-4000-9b00-0000000000b1', 'corrective', 'TEST-D046 A'),
  ('00000000-0000-4000-9b00-000000000022', '00000000-0000-4000-9b00-0000000000b2', 'corrective', 'TEST-D046 B');
INSERT INTO public.incidents (trip_id, description, severity) VALUES
  ('00000000-0000-4000-9b00-000000000011', 'TEST-D046 incident A', 'minor'),
  ('00000000-0000-4000-9b00-000000000012', 'TEST-D046 incident B', 'minor');

-- Administrateur affecte au site A : plus de lecture du site B
SELECT pg_temp.se_connecter('00000000-0000-4000-9b00-000000000002');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.vehicles WHERE registration LIKE 'TEST-D046-%'), 1, 'admin du site A : vehicules de son site seulement');
SELECT is((SELECT count(*)::int FROM public.trips WHERE reference LIKE 'TEST-D046-%'), 1, 'admin du site A : voyages de son site seulement');
SELECT is((SELECT count(*)::int FROM public.fuel_transactions WHERE reference LIKE 'TEST-D046-%'), 1, 'pleins : site du plein, sinon de l''engin');
SELECT is((SELECT count(*)::int FROM public.maintenance_orders WHERE description LIKE 'TEST-D046%'), 1, 'ordres de travail : site de l''engin');
SELECT is((SELECT count(*)::int FROM public.incidents WHERE description LIKE 'TEST-D046%'), 1, 'incidents : site du voyage');
UPDATE public.maintenance_orders SET description = 'X' WHERE id = '00000000-0000-4000-9b00-000000000022';
RESET ROLE;
SELECT is((SELECT description FROM public.maintenance_orders WHERE id = '00000000-0000-4000-9b00-000000000022'), 'TEST-D046 B',
  'mise a jour hors perimetre : aucune ligne atteinte');

-- Gestionnaire de flotte du site A
SELECT pg_temp.se_connecter('00000000-0000-4000-9b00-000000000003');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.vehicles WHERE registration LIKE 'TEST-D046-%'), 1, 'flotte site A : son site seulement');
SELECT is((SELECT count(*)::int FROM public.maintenance_orders WHERE description LIKE 'TEST-D046%'), 1, 'flotte site A : maintenance de son site');
RESET ROLE;

-- Administrateur global : tout reste visible
SELECT pg_temp.se_connecter('00000000-0000-4000-9b00-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.vehicles WHERE registration LIKE 'TEST-D046-%'), 2, 'admin global : tous les sites');
SELECT is((SELECT count(*)::int FROM public.fuel_transactions WHERE reference LIKE 'TEST-D046-%'), 2, 'admin global : tous les pleins');
SELECT is((SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND policyname = 'Admins full access'
  AND tablename IN ('vehicles', 'trips', 'drivers', 'fuel_transactions', 'maintenance_orders', 'tires', 'incidents', 'weighings', 'alerts')), 0,
  'plus de politique administrateur non bornee sur les tables du perimetre');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
