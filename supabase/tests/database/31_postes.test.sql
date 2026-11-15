-- Tests (D-048) : postes de travail (migration 20261116090000). Ouverture
-- avec passation, equipe et presence, journal d'evenements, cloture avec
-- bilan fige, validation par une autre personne. Tout est annule.
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

SELECT plan(14);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-9d00-000000000001', 'chef.poste.d048@exemple.invalid'),
  ('00000000-0000-4000-9d00-000000000002', 'directeur.d048@exemple.invalid'),
  ('00000000-0000-4000-9d00-000000000003', 'comptable.d048@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-9d00-000000000001', 'operations_manager', 'Chef de poste', 'active', NULL),
  ('00000000-0000-4000-9d00-000000000002', 'director', 'Directeur', 'active', NULL),
  ('00000000-0000-4000-9d00-000000000003', 'accountant', 'Comptable', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.sites (id, name, type) VALUES ('00000000-0000-4000-9d00-0000000000a1', 'Mine D-048', 'mine');
INSERT INTO public.work_shifts (id, name, display_name, start_time, end_time, shift_order) VALUES
  ('00000000-0000-4000-9d00-0000000000e1', 'test_jour_d048', 'Jour D-048', '06:00', '18:00', 91),
  ('00000000-0000-4000-9d00-0000000000e2', 'test_nuit_d048', 'Nuit D-048', '18:00', '06:00', 92);
INSERT INTO public.drivers (id, name, license_number, license_category, license_expiry, hire_date, status) VALUES
  ('00000000-0000-4000-9d00-0000000000c1', 'Chauffeur D-048 un', 'D048-1', 'C', '2030-01-01', '2020-01-01', 'active'),
  ('00000000-0000-4000-9d00-0000000000c2', 'Chauffeur D-048 deux', 'D048-2', 'C', '2030-01-01', '2020-01-01', 'active');

SELECT pg_temp.se_connecter('00000000-0000-4000-9d00-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE p1 AS SELECT public.ouvrir_poste(current_date, '00000000-0000-4000-9d00-0000000000e1', '00000000-0000-4000-9d00-0000000000a1', NULL, 'Piste nord a surveiller') AS id;
GRANT SELECT ON p1 TO authenticated;
SELECT is((SELECT statut FROM public.postes WHERE id = (SELECT id FROM p1)), 'ouvert', 'poste ouvert');
SELECT throws_ok($$SELECT public.ouvrir_poste(current_date, '00000000-0000-4000-9d00-0000000000e1', '00000000-0000-4000-9d00-0000000000a1')$$,
  '22023', NULL, 'un seul poste par shift, site et date');
CREATE TEMP TABLE m1 AS SELECT public.affecter_au_poste((SELECT id FROM p1), '00000000-0000-4000-9d00-0000000000c1') AS id;
CREATE TEMP TABLE m2 AS SELECT public.affecter_au_poste((SELECT id FROM p1), '00000000-0000-4000-9d00-0000000000c2') AS id;
GRANT SELECT ON m1, m2 TO authenticated;
SELECT lives_ok($$SELECT public.consigner_evenement_poste((SELECT id FROM p1), 'arret', 'Chargeuse a l''arret 40 min', now() - interval '1 hour')$$,
  'evenement consigne');
SELECT throws_ok($$UPDATE public.postes_evenements SET description = 'X'$$, '42501', NULL, 'journal non modifiable');
SELECT throws_ok($$SELECT public.cloturer_poste((SELECT id FROM p1), 'RAS')$$, '22023', NULL, 'presence a pointer avant cloture');
SELECT throws_ok($$SELECT public.pointer_presence((SELECT id FROM m2), false)$$, '22023', NULL, 'absence sans motif refusee');
SELECT lives_ok($$SELECT public.pointer_presence((SELECT id FROM m1), true, 15)$$, 'present avec 15 min de retard');
SELECT lives_ok($$SELECT public.pointer_presence((SELECT id FROM m2), false, NULL, 'Malade')$$, 'absent motive');
SELECT throws_ok($$SELECT public.cloturer_poste((SELECT id FROM p1), '  ')$$, '22023', NULL, 'cloture sans consignes refusee');
SELECT is((SELECT (bilan ->> 'presents') || '/' || (bilan ->> 'absents') || '/' || (bilan ->> 'evenements')
  FROM (SELECT public.cloturer_poste((SELECT id FROM p1), 'Piste nord degradee : rouler a 20 km/h', 'Production normale') AS bilan) b),
  '1/1/1', 'cloture : bilan fige (presents, absents, evenements)');
SELECT throws_ok($$SELECT public.valider_cloture_poste((SELECT id FROM p1))$$, '42501', NULL, 'celui qui clot ne valide pas');
-- Passation : le poste suivant recoit les consignes de sortie
CREATE TEMP TABLE p2 AS SELECT public.ouvrir_poste(current_date, '00000000-0000-4000-9d00-0000000000e2', '00000000-0000-4000-9d00-0000000000a1') AS id;
GRANT SELECT ON p2 TO authenticated;
SELECT is((SELECT consignes_recues FROM public.postes WHERE id = (SELECT id FROM p2)), 'Piste nord degradee : rouler a 20 km/h',
  'passation : consignes du poste precedent reprises');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-9d00-000000000002');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.valider_cloture_poste((SELECT id FROM p1))$$, 'cloture validee par le directeur');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-9d00-000000000003');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.ouvrir_poste(current_date - 1, '00000000-0000-4000-9d00-0000000000e1', '00000000-0000-4000-9d00-0000000000a1')$$,
  '42501', NULL, 'sans droit d''exploitation : ouverture refusee');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
