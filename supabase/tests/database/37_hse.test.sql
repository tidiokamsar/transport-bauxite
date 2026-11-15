-- Tests (D-054) : controle avant depart (resultat calcule, depart refuse
-- quand il est exige), incidents, actions correctives et cloture
-- (migration 20261117120000). Tout est annule.
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

SELECT plan(15);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a400-000000000001', 'admin.d054@exemple.invalid'),
  ('00000000-0000-4000-a400-000000000002', 'operations.d054@exemple.invalid'),
  ('00000000-0000-4000-a400-000000000003', 'chauffeur.d054@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-a400-000000000001', 'admin', 'Admin D-054', 'active', NULL),
  ('00000000-0000-4000-a400-000000000002', 'operations_manager', 'Operations D-054', 'active', NULL),
  ('00000000-0000-4000-a400-000000000003', 'driver', 'Chauffeur D-054', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-a400-0000000000a1', 'Mine D-054', 'mine'),
  ('00000000-0000-4000-a400-0000000000a2', 'Depot D-054', 'depot');
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status) VALUES
  ('00000000-0000-4000-a400-0000000000b1', 'TEST-D054-1', 'Test', 40, 'tipper', 'active');
INSERT INTO public.drivers (id, name, license_number, license_category, license_expiry, hire_date, status) VALUES
  ('00000000-0000-4000-a400-0000000000c1', 'Chauffeur D-054', 'D054-1', 'C', current_date + 100, current_date - 100, 'active');
DELETE FROM public.habilitations_requises;
UPDATE public.points_controle_depart SET actif = false;
DELETE FROM public.settings WHERE key = 'controle_depart_exige';
INSERT INTO public.settings (key, value, category) VALUES ('controle_depart_exige', '{"value": "true"}', 'hse');

-- Administrateur : liste des points
SELECT pg_temp.se_connecter('00000000-0000-4000-a400-000000000001');
SET LOCAL ROLE authenticated;
INSERT INTO public.points_controle_depart (id, libelle, categorie, bloquant, ordre) VALUES
  ('00000000-0000-4000-a400-0000000000e1', 'Freins', 'freinage', true, 1),
  ('00000000-0000-4000-a400-0000000000e2', 'Retroviseurs', 'securite', false, 2);
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-a400-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$INSERT INTO public.points_controle_depart (libelle, categorie, bloquant) VALUES ('X', 'autre', false)$$,
  '42501', NULL, 'liste des points : administrateur seulement');
SELECT throws_ok($$SELECT public.enregistrer_controle_depart('00000000-0000-4000-a400-0000000000b1',
  '[{"point": "00000000-0000-4000-a400-0000000000e1", "resultat": "conforme"}]'::jsonb)$$, '22023', NULL, 'point non renseigne : refuse');
SELECT throws_ok($$SELECT public.enregistrer_controle_depart('00000000-0000-4000-a400-0000000000b1',
  '[{"point": "00000000-0000-4000-a400-0000000000e1", "resultat": "non_conforme"}, {"point": "00000000-0000-4000-a400-0000000000e2", "resultat": "conforme"}]'::jsonb)$$,
  '22023', NULL, 'non-conformite sans observation : refusee');
CREATE TEMP TABLE c1 AS SELECT public.enregistrer_controle_depart('00000000-0000-4000-a400-0000000000b1',
  '[{"point": "00000000-0000-4000-a400-0000000000e1", "resultat": "non_conforme", "observation": "Pedale molle"}, {"point": "00000000-0000-4000-a400-0000000000e2", "resultat": "conforme"}]'::jsonb,
  p_date => now()) AS id;
SELECT is((SELECT resultat FROM public.controles_depart WHERE id = (SELECT id FROM c1)), 'non_conforme', 'point bloquant non conforme : controle non conforme');

-- Voyage affecte : depart refuse tant que le dernier controle est non conforme
SELECT is(public.preparer_voyages(current_date, '00000000-0000-4000-a400-0000000000a1', '00000000-0000-4000-a400-0000000000a2', NULL, 1), 1, 'voyage prepare');
CREATE TEMP TABLE v AS SELECT id FROM public.trips WHERE departure_site_id = '00000000-0000-4000-a400-0000000000a1';
GRANT SELECT ON v TO authenticated;
SELECT public.decider_affectation((SELECT id FROM v), 'acceptee', '00000000-0000-4000-a400-0000000000b1', '00000000-0000-4000-a400-0000000000c1', NULL);
SELECT throws_ok($$SELECT public.avancer_voyage((SELECT id FROM v), 'AT_LOADING', now())$$,
  '22023', NULL, 'controle non conforme : depart refuse');
SELECT public.enregistrer_controle_depart('00000000-0000-4000-a400-0000000000b1',
  '[{"point": "00000000-0000-4000-a400-0000000000e1", "resultat": "conforme"}, {"point": "00000000-0000-4000-a400-0000000000e2", "resultat": "non_conforme", "observation": "Fele"}]'::jsonb,
  p_date => now());
SELECT is(public.controle_depart_du_jour('00000000-0000-4000-a400-0000000000b1', current_date), 'reserves', 'apres reparation : conforme avec reserves');
SELECT lives_ok($$SELECT public.avancer_voyage((SELECT id FROM v), 'AT_LOADING', now())$$, 'depart autorise');
SELECT throws_ok($$UPDATE public.controles_depart SET resultat = 'conforme' WHERE id = (SELECT id FROM c1)$$, '42501', NULL, 'controle non modifiable');

-- Incident, analyse, action corrective, cloture
SELECT throws_ok($$SELECT public.declarer_incident('accident', 'moderate', 'Choc', now())$$, '22023', NULL, 'incident sans rattachement : refuse');
CREATE TEMP TABLE i AS SELECT public.declarer_incident('presque_accident', 'moderate', 'Freinage tardif au chargement', now() - interval '20 minutes',
  p_vehicle => '00000000-0000-4000-a400-0000000000b1', p_trip => (SELECT id FROM v)) AS id;
SELECT matches((SELECT numero FROM public.incidents WHERE id = (SELECT id FROM i)), '^INC-[0-9]{4}-[0-9]{5}$', 'incident numerote par le serveur');
SELECT throws_ok($$SELECT public.cloturer_incident((SELECT id FROM i), 'Clos')$$, '22023', NULL, 'cloture sans analyse : refusee');
SELECT public.analyser_incident((SELECT id FROM i), 'Usure des plaquettes non signalee');
CREATE TEMP TABLE a AS SELECT public.ajouter_action_corrective((SELECT id FROM i), 'Remplacer les plaquettes', 'Chef d''atelier', current_date + 2) AS id;
SELECT throws_ok($$SELECT public.cloturer_incident((SELECT id FROM i), 'Clos')$$, '22023', NULL, 'action ouverte : cloture refusee');
SELECT public.solder_action_corrective((SELECT id FROM a), true, 'OT-2026-0042');
SELECT public.cloturer_incident((SELECT id FROM i), 'Cause traitee');
SELECT is((SELECT statut FROM public.incidents WHERE id = (SELECT id FROM i)), 'clos', 'incident clos apres realisation de l''action');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-a400-000000000003');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.declarer_incident('accident', 'minor', 'Test', now(), p_vehicle => '00000000-0000-4000-a400-0000000000b1')$$,
  '42501', NULL, 'sans droit d''ecriture : refuse');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
