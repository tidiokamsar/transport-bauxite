-- Tests (D-028) : fiches terrain, cycle de la fiche, saisie des rotations
-- (fiche et ticket au journal, doublon refuse), pointage avec arrets,
-- carburant (migration 20261111090000_fiches_terrain). Tout est annule.
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

SELECT plan(23);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8e00-000000000001', 'contrats.fiches@exemple.invalid'),
  ('00000000-0000-4000-8e00-000000000002', 'chauffeur.fiches@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status) VALUES
  ('00000000-0000-4000-8e00-000000000001', 'contract_manager', 'Charge fiches', 'active'),
  ('00000000-0000-4000-8e00-000000000002', 'driver', 'Chauffeur fiches', 'active')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-8e00-0000000000a1', 'Mine fiches', 'mine'),
  ('00000000-0000-4000-8e00-0000000000a2', 'Stock fiches', 'depot');
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status) VALUES
  ('00000000-0000-4000-8e00-0000000000b1', 'TEST-FCH-1', 'Test', 40, 'tipper', 'active'),
  ('00000000-0000-4000-8e00-0000000000b2', 'TEST-FCH-2', 'Test', 40, 'tipper', 'active'),
  ('00000000-0000-4000-8e00-0000000000e1', 'TEST-FCH-CHG', 'Test', 10, 'loader', 'active');
INSERT INTO public.drivers (id, name, license_number, license_category, license_expiry, hire_date, status) VALUES
  ('00000000-0000-4000-8e00-0000000000c1', 'Chauffeur fiche', 'F-1', 'C', current_date + 100, current_date - 100, 'active');

SELECT pg_temp.se_connecter('00000000-0000-4000-8e00-000000000001');
SET LOCAL ROLE authenticated;

SELECT throws_ok($$SELECT public.preparer_fiche('rotations', current_date, '00000000-0000-4000-8e00-0000000000a1', NULL,
  '00000000-0000-4000-8e00-0000000000b1')$$, '22023', NULL, 'lieu de pesee exige pour une fiche de rotations');
CREATE TEMP TABLE fr AS SELECT public.preparer_fiche('rotations', current_date, '00000000-0000-4000-8e00-0000000000a1', NULL,
  '00000000-0000-4000-8e00-0000000000b1', '00000000-0000-4000-8e00-0000000000c1', NULL, '{"pesee": "arrivee"}') AS id;
SELECT ok((SELECT numero FROM public.fiches_terrain WHERE id = (SELECT id FROM fr)) ~ '^FR-\d{6}-\d{3}$', 'numero de fiche genere');
SELECT throws_ok($$SELECT public.suivre_fiche((SELECT id FROM fr), 'remise')$$, '22023', NULL, 'remise sans nom d''agent refusee');
SELECT lives_ok($$SELECT public.suivre_fiche((SELECT id FROM fr), 'remise', 'Mamadou Pointeur')$$, 'fiche remise a l''agent');

-- Deux voyages du camion de la fiche, un voyage d'un autre camion
CREATE TEMP TABLE vy AS SELECT
  public.creer_voyage(current_date, '00000000-0000-4000-8e00-0000000000a1', '00000000-0000-4000-8e00-0000000000a2',
    '00000000-0000-4000-8e00-0000000000b1', '00000000-0000-4000-8e00-0000000000c1') AS v1,
  public.creer_voyage(current_date, '00000000-0000-4000-8e00-0000000000a1', '00000000-0000-4000-8e00-0000000000a2',
    '00000000-0000-4000-8e00-0000000000b1', '00000000-0000-4000-8e00-0000000000c1') AS v2,
  public.creer_voyage(current_date, '00000000-0000-4000-8e00-0000000000a1', '00000000-0000-4000-8e00-0000000000a2',
    '00000000-0000-4000-8e00-0000000000b2', NULL) AS v3;

CREATE TEMP TABLE etapes AS SELECT jsonb_build_array(
  jsonb_build_object('etat', 'AT_LOADING', 'quand', now() - interval '6 hours'),
  jsonb_build_object('etat', 'LOADING', 'quand', now() - interval '5 hours 50 minutes'),
  jsonb_build_object('etat', 'LOADED', 'quand', now() - interval '5 hours 40 minutes'),
  jsonb_build_object('etat', 'IN_TRANSIT', 'quand', now() - interval '5 hours 35 minutes'),
  jsonb_build_object('etat', 'AT_DESTINATION', 'quand', now() - interval '5 hours'),
  jsonb_build_object('etat', 'UNLOADING', 'quand', now() - interval '4 hours 55 minutes'),
  jsonb_build_object('etat', 'WEIGHED_IN', 'quand', now() - interval '4 hours 50 minutes',
    'donnees', jsonb_build_object('brut', 56.1, 'tare', 15.4, 'ticket', 'PB-001')),
  jsonb_build_object('etat', 'DELIVERED', 'quand', now() - interval '4 hours 45 minutes')) AS e;

SELECT is(public.saisir_rotation((SELECT id FROM fr), (SELECT v1 FROM vy), (SELECT e FROM etapes)), 'DELIVERED',
  'une ligne de fiche fait avancer le voyage jusqu''a livre');
SELECT is((SELECT net_weight_reception FROM public.trips WHERE id = (SELECT v1 FROM vy)), 40.7::numeric, 'poids recu calcule');
SELECT is((SELECT (donnees ->> 'ticket') || ' ' || (donnees ->> 'fiche') FROM public.trip_events
  WHERE trip_id = (SELECT v1 FROM vy) AND etat_apres = 'WEIGHED_IN'),
  'PB-001 ' || (SELECT numero FROM public.fiches_terrain WHERE id = (SELECT id FROM fr)), 'ticket et fiche au journal du voyage');
SELECT is((SELECT count(*)::int FROM public.trip_events WHERE trip_id = (SELECT v1 FROM vy) AND note LIKE 'Fiche FR-%'), 8,
  'chaque etape porte la reference de la fiche');
SELECT lives_ok($$SELECT public.saisir_rotation((SELECT id FROM fr), (SELECT v1 FROM vy), (SELECT e FROM etapes))$$,
  'ressaisie de la meme ligne sans erreur');
SELECT is((SELECT count(*)::int FROM public.trip_events WHERE trip_id = (SELECT v1 FROM vy)), 9, 'ressaisie sans doublon d''evenement');

SELECT throws_ok($$SELECT public.saisir_rotation((SELECT id FROM fr), (SELECT v2 FROM vy), jsonb_build_array(
  jsonb_build_object('etat', 'AT_LOADING', 'quand', now() - interval '3 hours'),
  jsonb_build_object('etat', 'LOADING', 'quand', now() - interval '2 hours 55 minutes'),
  jsonb_build_object('etat', 'LOADED', 'quand', now() - interval '2 hours 50 minutes'),
  jsonb_build_object('etat', 'IN_TRANSIT', 'quand', now() - interval '2 hours 45 minutes'),
  jsonb_build_object('etat', 'AT_DESTINATION', 'quand', now() - interval '2 hours 10 minutes'),
  jsonb_build_object('etat', 'UNLOADING', 'quand', now() - interval '2 hours 5 minutes'),
  jsonb_build_object('etat', 'WEIGHED_IN', 'quand', now() - interval '2 hours', 'donnees', jsonb_build_object('brut', 55, 'tare', 15, 'ticket', 'PB-001'))))$$,
  '23505', NULL, 'ticket de pesee deja utilise refuse');
SELECT is((SELECT etat FROM public.trips WHERE id = (SELECT v2 FROM vy)), 'ASSIGNED', 'ligne refusee : rien n''est applique (transaction)');
SELECT throws_ok($$SELECT public.saisir_rotation((SELECT id FROM fr), (SELECT v3 FROM vy), (SELECT e FROM etapes))$$,
  '22023', NULL, 'voyage d''un autre camion refuse');

-- Pointage des engins avec un arret
CREATE TEMP TABLE fp AS SELECT public.preparer_fiche('pointage_engins', current_date, '00000000-0000-4000-8e00-0000000000a1') AS id;
SELECT lives_ok($$SELECT public.saisir_pointage((SELECT id FROM fp), '00000000-0000-4000-8e00-0000000000e1', 1520.4, 1530.9, 'Operateur A', NULL,
  jsonb_build_array(jsonb_build_object('debut', now() - interval '4 hours', 'fin', now() - interval '3 hours',
    'cause', 'panne', 'imputation', 'loueur', 'description', 'Flexible hydraulique')))$$, 'pointage avec arret saisi');
SELECT is((SELECT heures_marche FROM public.pointages_engins WHERE fiche_id = (SELECT id FROM fp)), 10.5::numeric, 'heures de marche calculees');
SELECT is((SELECT statut || ' ' || imputation FROM public.immobilisations WHERE vehicle_id = '00000000-0000-4000-8e00-0000000000e1'),
  'cloturee loueur', 'l''arret devient une immobilisation close');
SELECT throws_ok($$SELECT public.saisir_pointage((SELECT id FROM fp), '00000000-0000-4000-8e00-0000000000b2', 100, 90)$$,
  '22023', NULL, 'index de fin inferieur au debut refuse');

-- Carburant
CREATE TEMP TABLE fc AS SELECT public.preparer_fiche('carburant', current_date, '00000000-0000-4000-8e00-0000000000a1') AS id;
SELECT throws_ok($$SELECT public.saisir_carburant((SELECT id FROM fc), NULL, 'Cuve mine',
  '[{"vehicle_id": "00000000-0000-4000-8e00-0000000000b1", "litres": 250}]')$$, '22023', NULL, 'prix du litre exige');
SELECT is(public.saisir_carburant((SELECT id FROM fc), 12500, 'Cuve mine',
  '[{"vehicle_id": "00000000-0000-4000-8e00-0000000000b1", "litres": 250, "compteur": 84500},
    {"vehicle_id": "00000000-0000-4000-8e00-0000000000e1", "litres": 180}]'), 2, 'deux pleins saisis');
SELECT is((SELECT sum(total_cost) FROM public.fuel_transactions WHERE notes LIKE 'Fiche FC-%'), 5375000::numeric, 'montants calcules au prix saisi');

SELECT lives_ok($$SELECT public.terminer_saisie_fiche((SELECT id FROM fr))$$, 'saisie terminee');
SELECT throws_ok($$SELECT public.saisir_rotation((SELECT id FROM fr), (SELECT v2 FROM vy), '[]')$$, '22023', NULL, 'fiche saisie : close');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-8e00-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.preparer_fiche('carburant', current_date, '00000000-0000-4000-8e00-0000000000a1')$$,
  '42501', NULL, 'un chauffeur ne prepare pas de fiche');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
