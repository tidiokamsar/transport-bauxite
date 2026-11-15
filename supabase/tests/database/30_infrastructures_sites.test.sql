-- Tests (D-047) : infrastructures de site, fermetures motivees et levees,
-- refus d'affectation vers un site ferme (migration 20261115230000).
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

SELECT plan(10);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-9c00-000000000001', 'admin.d047@exemple.invalid'),
  ('00000000-0000-4000-9c00-000000000002', 'operations.d047@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-9c00-000000000001', 'admin', 'Admin D-047', 'active', NULL),
  ('00000000-0000-4000-9c00-000000000002', 'operations_manager', 'Operations D-047', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-9c00-0000000000a1', 'Mine D-047', 'mine'),
  ('00000000-0000-4000-9c00-0000000000a2', 'Depot D-047', 'depot');
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status) VALUES
  ('00000000-0000-4000-9c00-0000000000b1', 'TEST-D047-1', 'Test', 40, 'tipper', 'active');
INSERT INTO public.drivers (id, name, license_number, license_category, license_expiry, hire_date, status) VALUES
  ('00000000-0000-4000-9c00-0000000000c1', 'Chauffeur D-047', 'D047-1', 'C', current_date + 100, current_date - 100, 'active');

-- Administrateur : referentiel et fermeture
SELECT pg_temp.se_connecter('00000000-0000-4000-9c00-000000000001');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$INSERT INTO public.infrastructures_site (site_id, type, code, libelle, capacite, unite_capacite)
  VALUES ('00000000-0000-4000-9c00-0000000000a2', 'pont_bascule', 'TEST-PB-D047', 'Pont-bascule depot', 20, 'camions/heure')$$,
  'infrastructure declaree avec une capacite et son unite');
SELECT throws_ok($$INSERT INTO public.infrastructures_site (site_id, type, code, libelle, capacite)
  VALUES ('00000000-0000-4000-9c00-0000000000a2', 'atelier', 'TEST-AT-D047', 'Atelier', 5)$$,
  '23514', NULL, 'capacite sans unite refusee');
SELECT throws_ok($$INSERT INTO public.fermetures_site (site_id, debut, motif) VALUES ('00000000-0000-4000-9c00-0000000000a2', now(), ' ')$$,
  '23514', NULL, 'fermeture sans motif refusee');
INSERT INTO public.fermetures_site (id, site_id, debut, fin, motif)
VALUES ('00000000-0000-4000-9c00-0000000000f1', '00000000-0000-4000-9c00-0000000000a2',
        current_date::timestamptz, (current_date + 2)::timestamptz, 'Pont-bascule en panne');
SELECT is(public.site_ferme_le('00000000-0000-4000-9c00-0000000000a2', current_date), 'Pont-bascule en panne', 'depot ferme aujourd''hui');
SELECT is(public.site_ferme_le('00000000-0000-4000-9c00-0000000000a2', current_date + 3), NULL, 'reouvert apres la fin');
SELECT throws_ok($$DELETE FROM public.fermetures_site WHERE id = '00000000-0000-4000-9c00-0000000000f1'$$,
  '42501', NULL, 'une fermeture ne se supprime pas');
RESET ROLE;

-- Responsable d'exploitation : affectation refusee vers le depot ferme
SELECT pg_temp.se_connecter('00000000-0000-4000-9c00-000000000002');
SET LOCAL ROLE authenticated;
SELECT is(public.preparer_voyages(current_date, '00000000-0000-4000-9c00-0000000000a1', '00000000-0000-4000-9c00-0000000000a2', NULL, 1), 1,
  'voyage prepare vers le depot');
CREATE TEMP TABLE v AS SELECT id FROM public.trips WHERE departure_site_id = '00000000-0000-4000-9c00-0000000000a1';
GRANT SELECT ON v TO authenticated;
SELECT throws_ok($$SELECT public.decider_affectation((SELECT id FROM v), 'acceptee', '00000000-0000-4000-9c00-0000000000b1',
  '00000000-0000-4000-9c00-0000000000c1', NULL)$$, '22023', NULL, 'affectation vers un depot ferme refusee');
RESET ROLE;

-- Levee anticipee motivee, puis l'affectation passe
SELECT pg_temp.se_connecter('00000000-0000-4000-9c00-000000000001');
SET LOCAL ROLE authenticated;
UPDATE public.fermetures_site SET levee_le = current_date::timestamptz, motif_levee = 'Pont-bascule repare'
 WHERE id = '00000000-0000-4000-9c00-0000000000f1';
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-9c00-000000000002');
SET LOCAL ROLE authenticated;
SELECT is(public.site_ferme_le('00000000-0000-4000-9c00-0000000000a2', current_date), NULL, 'fermeture levee : depot ouvert');
SELECT lives_ok($$SELECT public.decider_affectation((SELECT id FROM v), 'acceptee', '00000000-0000-4000-9c00-0000000000b1',
  '00000000-0000-4000-9c00-0000000000c1', NULL)$$, 'affectation acceptee apres la levee');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
