-- Tests (D-051) : habilitations des chauffeurs, exigences parametrees,
-- refus d'affectation d'un chauffeur non habilite, revocation motivee
-- (migration 20261116180000). Tout est annule.
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
  ('00000000-0000-4000-a100-000000000001', 'admin.d051@exemple.invalid'),
  ('00000000-0000-4000-a100-000000000002', 'operations.d051@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-a100-000000000001', 'admin', 'Admin D-051', 'active', NULL),
  ('00000000-0000-4000-a100-000000000002', 'operations_manager', 'Operations D-051', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-a100-0000000000a1', 'Mine D-051', 'mine'),
  ('00000000-0000-4000-a100-0000000000a2', 'Depot D-051', 'depot');
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status) VALUES
  ('00000000-0000-4000-a100-0000000000b1', 'TEST-D051-1', 'Test', 40, 'tipper', 'active');
INSERT INTO public.drivers (id, name, license_number, license_category, license_expiry, hire_date, status) VALUES
  ('00000000-0000-4000-a100-0000000000c1', 'Chauffeur D-051', 'D051-1', 'C', current_date + 100, current_date - 100, 'active');
DELETE FROM public.habilitations_requises;

-- Administrateur : exigence et habilitations
SELECT pg_temp.se_connecter('00000000-0000-4000-a100-000000000001');
SET LOCAL ROLE authenticated;
INSERT INTO public.habilitations_requises (type, note) VALUES ('visite_medicale', 'Aptitude annuelle');
SELECT is(public.habilitations_manquantes('00000000-0000-4000-a100-0000000000c1', current_date), 'visite_medicale', 'visite medicale manquante');
INSERT INTO public.habilitations_chauffeur (id, driver_id, type, libelle, delivre_le, expire_le) VALUES
  ('00000000-0000-4000-a100-0000000000d1', '00000000-0000-4000-a100-0000000000c1', 'visite_medicale', 'Aptitude 2025', current_date - 400, current_date - 35);
SELECT is(public.habilitations_manquantes('00000000-0000-4000-a100-0000000000c1', current_date), 'visite_medicale', 'visite expiree : toujours manquante');
SELECT throws_ok($$INSERT INTO public.habilitations_chauffeur (driver_id, type, libelle, delivre_le, expire_le)
  VALUES ('00000000-0000-4000-a100-0000000000c1', 'visite_medicale', 'Incoherente', current_date, current_date - 1)$$, '23514', NULL, 'expiration avant delivrance refusee');
SELECT throws_ok($$DELETE FROM public.habilitations_chauffeur$$, '42501', NULL, 'une habilitation ne se supprime pas');
RESET ROLE;

-- Responsable d'exploitation : affectation refusee faute de visite valide
SELECT pg_temp.se_connecter('00000000-0000-4000-a100-000000000002');
SET LOCAL ROLE authenticated;
SELECT is(public.preparer_voyages(current_date, '00000000-0000-4000-a100-0000000000a1', '00000000-0000-4000-a100-0000000000a2', NULL, 1), 1, 'voyage prepare');
CREATE TEMP TABLE v AS SELECT id FROM public.trips WHERE departure_site_id = '00000000-0000-4000-a100-0000000000a1';
GRANT SELECT ON v TO authenticated;
SELECT throws_ok($$SELECT public.decider_affectation((SELECT id FROM v), 'acceptee', '00000000-0000-4000-a100-0000000000b1',
  '00000000-0000-4000-a100-0000000000c1', NULL)$$, '22023', NULL, 'chauffeur non habilite : affectation refusee');
RESET ROLE;

-- Nouvelle visite : l'affectation passe ; revocation motivee
SELECT pg_temp.se_connecter('00000000-0000-4000-a100-000000000001');
SET LOCAL ROLE authenticated;
INSERT INTO public.habilitations_chauffeur (id, driver_id, type, libelle, delivre_le, expire_le) VALUES
  ('00000000-0000-4000-a100-0000000000d2', '00000000-0000-4000-a100-0000000000c1', 'visite_medicale', 'Aptitude 2026', current_date - 1, current_date + 365);
SELECT is((SELECT count(*)::int FROM public.v_habilitations_a_renouveler WHERE driver_id = '00000000-0000-4000-a100-0000000000c1'), 0,
  'visite renouvelee : plus d''alerte');
SELECT throws_ok($$UPDATE public.habilitations_chauffeur SET revoque_le = now() WHERE id = '00000000-0000-4000-a100-0000000000d1'$$,
  '22023', NULL, 'revocation sans motif refusee');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a100-000000000002');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.decider_affectation((SELECT id FROM v), 'acceptee', '00000000-0000-4000-a100-0000000000b1',
  '00000000-0000-4000-a100-0000000000c1', NULL)$$, 'chauffeur habilite : affectation acceptee');
SELECT throws_ok($$INSERT INTO public.habilitations_requises (type) VALUES ('acces_site')$$, '42501', NULL, 'exigences : administrateur seulement');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
