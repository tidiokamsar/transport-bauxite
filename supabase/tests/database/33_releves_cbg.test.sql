-- Tests (D-050) : import d'un releve CBG et rapprochement avec les tickets
-- integres aux voyages (migration 20261116150000). Periode de septembre
-- 2001, vide en production. Tout est annule.
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
  ('00000000-0000-4000-9f00-000000000001', 'tickets.d050@exemple.invalid'),
  ('00000000-0000-4000-9f00-000000000002', 'mecanicien.d050@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-9f00-000000000001', 'contract_manager', 'Charge tickets', 'active', NULL),
  ('00000000-0000-4000-9f00-000000000002', 'maintenance_chief', 'Chef maintenance', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.sites (id, name, type) VALUES ('00000000-0000-4000-9f00-0000000000a1', 'Depot D-050', 'depot');
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type) VALUES
  ('00000000-0000-4000-9f00-0000000000b1', 'RC-5001-A', 'Test', 40, 'tipper'),
  ('00000000-0000-4000-9f00-0000000000b2', 'RC-5002-A', 'Test', 40, 'tipper');
INSERT INTO public.trips (id, reference, planned_date, vehicle_id, etat) VALUES
  ('00000000-0000-4000-9f00-000000000011', 'TEST-D050-1', '2001-09-03', '00000000-0000-4000-9f00-0000000000b1', 'DELIVERED'),
  ('00000000-0000-4000-9f00-000000000012', 'TEST-D050-2', '2001-09-03', '00000000-0000-4000-9f00-0000000000b2', 'DELIVERED'),
  ('00000000-0000-4000-9f00-000000000013', 'TEST-D050-3', '2001-09-04', '00000000-0000-4000-9f00-0000000000b1', 'DELIVERED'),
  ('00000000-0000-4000-9f00-000000000014', 'TEST-D050-4', '2001-09-04', '00000000-0000-4000-9f00-0000000000b2', 'DELIVERED'),
  ('00000000-0000-4000-9f00-000000000015', 'TEST-D050-5', '2001-09-05', '00000000-0000-4000-9f00-0000000000b2', 'DELIVERED');
INSERT INTO public.tickets_pesee_cbg (trip_id, site_id, ticket, brut, tare, mesure_le) VALUES
  ('00000000-0000-4000-9f00-000000000011', '00000000-0000-4000-9f00-0000000000a1', 'T050-1', 60, 20, '2001-09-03 10:00+00'),
  ('00000000-0000-4000-9f00-000000000012', '00000000-0000-4000-9f00-0000000000a1', 'T050-2', 61, 20, '2001-09-03 11:00+00'),
  ('00000000-0000-4000-9f00-000000000013', '00000000-0000-4000-9f00-0000000000a1', 'T050-3', 62, 20, '2001-09-04 10:00+00'),
  ('00000000-0000-4000-9f00-000000000014', '00000000-0000-4000-9f00-0000000000a1', 'T050-4', 63, 20, '2001-09-04 11:00+00');
DELETE FROM public.settings WHERE key = 'tolerance_poids_cbg_t';

SELECT pg_temp.se_connecter('00000000-0000-4000-9f00-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.v_voyages_livres_sans_ticket WHERE reference LIKE 'TEST-D050-%'), 1, 'un voyage livre sans ticket CBG');
-- Releve CBG : T050-1 concordant, T050-2 ecart de poids, T050-3 autre camion,
-- T050-9 inconnu de SIGTB, une ligne illisible ; T050-4 absent du releve.
CREATE TEMP TABLE r AS SELECT public.importer_releve_cbg('CBG-REL-2001-09', '2001-09-01', '2001-09-30', '00000000-0000-4000-9f00-0000000000a1', 'releve.csv',
  '[{"ticket":"T050-1","date":"2001-09-03","immatriculation":"RC 5001 A","brut":"60","tare":"20"},
    {"ticket":"t050-2","date":"2001-09-03","immatriculation":"RC-5002-A","net":"40.5"},
    {"ticket":"T050-3","date":"2001-09-04","immatriculation":"RC-9999-Z","brut":"62","tare":"20"},
    {"ticket":"T050-9","date":"2001-09-05","immatriculation":"RC-5002-A","net":"39"},
    {"ticket":"","date":"2001-09-05","brut":"abc"}]') AS id;
GRANT SELECT ON r TO authenticated;
SELECT is((SELECT count(*)::int FROM public.releves_cbg_lignes WHERE releve_id = (SELECT id FROM r)), 5, 'cinq lignes conservees telles que lues');
SELECT is((SELECT string_agg(nature || '=' || nombre, ',' ORDER BY nature) FROM public.rapprocher_releve_cbg((SELECT id FROM r))),
  'absent_sigtb=1,concordant=1,ecart_poids=1,immatriculation_differente=1,ligne_illisible=1,manquant_releve=1', 'rapprochement : une ligne par nature');
SELECT is((SELECT ecart_net FROM public.ecarts_releve_cbg WHERE releve_id = (SELECT id FROM r) AND nature = 'ecart_poids'), -0.5, 'ecart de poids : CBG 40,5 t contre 41 t dans SIGTB');
SELECT throws_ok($$SELECT * FROM public.rapprocher_releve_cbg((SELECT id FROM r))$$, '22023', NULL, 'releve deja rapproche');
SELECT throws_ok($$SELECT public.decider_ecart_releve_cbg((SELECT id FROM public.ecarts_releve_cbg WHERE releve_id = (SELECT id FROM r) AND nature = 'ecart_poids'), 'litige', ' ')$$,
  '22023', NULL, 'decision sans motif refusee');
SELECT lives_ok($$SELECT public.decider_ecart_releve_cbg((SELECT id FROM public.ecarts_releve_cbg WHERE releve_id = (SELECT id FROM r) AND nature = 'ecart_poids'), 'litige', 'Contestation envoyee a CBG')$$,
  'ecart de poids mis en litige');
SELECT throws_ok($$SELECT public.decider_ecart_releve_cbg((SELECT id FROM public.ecarts_releve_cbg WHERE releve_id = (SELECT id FROM r) AND nature = 'concordant'), 'accepte', 'x')$$,
  '22023', NULL, 'ligne concordante : pas de decision');
SELECT throws_ok($$UPDATE public.releves_cbg_lignes SET net = 1$$, '42501', NULL, 'releve non modifiable');
RESET ROLE;

-- Tolerance de poids : 1 t absorbe l'ecart de 0,5 t
INSERT INTO public.settings (key, value, category) VALUES ('tolerance_poids_cbg_t', '{"value": "1"}', 'test');
SELECT pg_temp.se_connecter('00000000-0000-4000-9f00-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE r2 AS SELECT public.importer_releve_cbg('CBG-REL-2001-09-B', '2001-09-03', '2001-09-03', NULL, NULL,
  '[{"ticket":"T050-2","date":"2001-09-03","immatriculation":"RC-5002-A","net":"40.5"}]') AS id;
GRANT SELECT ON r2 TO authenticated;
SELECT is((SELECT nombre FROM public.rapprocher_releve_cbg((SELECT id FROM r2)) WHERE nature = 'concordant'), 1, 'dans la tolerance : concordant');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-9f00-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.importer_releve_cbg('X', '2001-09-01', '2001-09-02', NULL, NULL, '[{"ticket":"A"}]')$$,
  '42501', NULL, 'sans droit voyages : import refuse');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
