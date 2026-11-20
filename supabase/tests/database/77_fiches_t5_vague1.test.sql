-- Tests (D-104, T5 vague 1) : FIMM, FRET, FM, FSEC, FACC, FINC, FENV
-- deviennent des fiches du cycle, chacune rattachee a sa fonction metier
-- existante (D-025 immobilisations, D-049 interventions loueur, D-054
-- incidents HSE). La saisie cree l'objet metier dans la meme transaction,
-- le journal du cycle trace la ligne, la sync mobile accepte le nouveau
-- point d'entree. Tout est annule en fin de transaction.
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
  ('00000000-0000-4000-8f77-000000000001', 'exploit.t5@exemple.invalid'),
  ('00000000-0000-4000-8f77-000000000002', 'chauffeur.t5@exemple.invalid'),
  ('00000000-0000-4000-8f77-000000000003', 'admin.t5@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status) VALUES
  ('00000000-0000-4000-8f77-000000000001', 'operations_manager', 'Exploitation T5', 'active'),
  ('00000000-0000-4000-8f77-000000000002', 'driver', 'Chauffeur T5', 'active'),
  ('00000000-0000-4000-8f77-000000000003', 'admin', 'Admin T5', 'active')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-8f77-0000000000a1', 'Site T5', 'mine');
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status) VALUES
  ('00000000-0000-4000-8f77-0000000000b1', 'TEST-T5-1', 'Test', 40, 'tipper', 'active'),
  ('00000000-0000-4000-8f77-0000000000b2', 'TEST-T5-2', 'Test', 10, 'loader', 'active');
INSERT INTO public.drivers (id, name, license_number, license_category, license_expiry, hire_date, status) VALUES
  ('00000000-0000-4000-8f77-0000000000c1', 'Chauffeur T5', 'T5-1', 'C', current_date + 100, current_date - 100, 'active');

-- Catalogue : les sept familles passent deployees.
SELECT is((SELECT count(*)::int FROM public.fiches_catalogue WHERE statut = 'deployee'), 10,
  'dix familles deployees (FR, FP, FC + les sept de la vague 1)');

-- FIMM : creation puis saisie -> declarer_immobilisation (D-025).
SELECT pg_temp.se_connecter('00000000-0000-4000-8f77-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE fimm AS SELECT public.creer_fiche_metier(p_type := 'immobilisation', p_date := current_date,
  p_site_id := '00000000-0000-4000-8f77-0000000000a1', p_vehicle_id := '00000000-0000-4000-8f77-0000000000b1',
  p_agent := 'Agent T5') AS id;
SELECT is((SELECT numero LIKE 'FIMM-%' FROM public.fiches_terrain WHERE id = (SELECT id FROM fimm)), true,
  'fiche FIMM numerotee');
SELECT is((SELECT module_proprietaire FROM public.fiches_catalogue WHERE code = 'FIMM' AND statut = 'deployee'),
  'maintenance', 'FIMM rattachee au module maintenance');
CREATE TEMP TABLE immo AS SELECT public.saisir_ligne_fiche((SELECT id FROM fimm), 1,
  jsonb_build_object('vehicle_id', '00000000-0000-4000-8f77-0000000000b1',
    'debut', now() - interval '2 hours', 'cause', 'panne', 'imputation', 'loueur',
    'description', 'Fuite hydraulique')) AS id;
SELECT is((SELECT statut FROM public.immobilisations WHERE id = (SELECT id FROM immo)), 'ouverte',
  'FIMM : immobilisation ouverte par la saisie (D-025)');
SELECT is((SELECT etat FROM public.fiches_terrain WHERE id = (SELECT id FROM fimm)), 'saisie_en_cours',
  'etat du cycle avance a la saisie');

-- FM : intervention loueur rattachee a la meme immobilisation (D-049).
CREATE TEMP TABLE fm AS SELECT public.creer_fiche_metier(p_type := 'intervention_loueur', p_date := current_date,
  p_site_id := '00000000-0000-4000-8f77-0000000000a1', p_agent := 'Agent T5') AS id;
CREATE TEMP TABLE inte AS SELECT public.saisir_ligne_fiche((SELECT id FROM fm), 1,
  jsonb_build_object('immobilisation_id', (SELECT id FROM immo), 'quand', now(),
    'canal', 'telephone', 'description', 'Intervention hydraulique demandee')) AS id;
SELECT ok((SELECT id FROM inte) IS NOT NULL, 'FM : intervention loueur creee (D-049)');
SELECT is((SELECT count(*)::int FROM public.interventions_journal WHERE intervention_id = (SELECT id FROM inte)), 1,
  'FM : journal de l''intervention trace');

-- FRET : cloture d'une deuxieme immobilisation (sans intervention active).
CREATE TEMP TABLE fimm2 AS SELECT public.creer_fiche_metier(p_type := 'immobilisation', p_date := current_date,
  p_site_id := '00000000-0000-4000-8f77-0000000000a1', p_agent := 'Agent T5') AS id;
CREATE TEMP TABLE immo2 AS SELECT public.saisir_ligne_fiche((SELECT id FROM fimm2), 1,
  jsonb_build_object('vehicle_id', '00000000-0000-4000-8f77-0000000000b2',
    'debut', now() - interval '1 hour', 'cause', 'maintenance_planifiee', 'imputation', 'exploitant',
    'description', 'Revision periodique')) AS id;
CREATE TEMP TABLE fret AS SELECT public.creer_fiche_metier(p_type := 'retour_atelier', p_date := current_date,
  p_site_id := '00000000-0000-4000-8f77-0000000000a1', p_agent := 'Agent T5') AS id;
SELECT lives_ok($$SELECT public.saisir_ligne_fiche((SELECT id FROM fret), 1,
  jsonb_build_object('immobilisation_id', (SELECT id FROM immo2), 'fin', now(), 'note', 'Repare'))$$,
  'FRET : immobilisation cloturee');
SELECT is((SELECT statut FROM public.immobilisations WHERE id = (SELECT id FROM immo2)), 'cloturee',
  'FRET : immobilisation cloturee par la saisie');

-- FSEC : incident securite (D-054) — module reports, admin.
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-8f77-000000000003');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE fsec AS SELECT public.creer_fiche_metier(p_type := 'securite', p_date := current_date,
  p_site_id := '00000000-0000-4000-8f77-0000000000a1', p_agent := 'Agent T5') AS id;
CREATE TEMP TABLE inc AS SELECT public.saisir_ligne_fiche((SELECT id FROM fsec), 1,
  jsonb_build_object('gravite', 'moderate', 'description', 'Piste degradee au km 4',
    'survenu_le', now(), 'lieu', 'km 4')) AS id;
SELECT is((SELECT type FROM public.incidents WHERE id = (SELECT id FROM inc)), 'securite',
  'FSEC : incident securite cree (D-054)');
SELECT is((SELECT numero LIKE 'FSEC-%' FROM public.fiches_terrain WHERE id = (SELECT id FROM fsec)), true,
  'fiche FSEC numerotee');

-- Droits : un chauffeur sans droit maintenance ne cree pas de fiche FIMM.
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-8f77-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.creer_fiche_metier(p_type := 'immobilisation', p_date := current_date,
  p_site_id := '00000000-0000-4000-8f77-0000000000a1')$$,
  '42501', NULL, 'chauffeur : creation FIMM refusee sans droit maintenance');
RESET ROLE;

-- Sync mobile : le nouveau point d'entree accepte une ligne FACC (admin : module reports).
SELECT pg_temp.se_connecter('00000000-0000-4000-8f77-000000000003');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE facc AS SELECT public.creer_fiche_metier(p_type := 'accident', p_date := current_date,
  p_site_id := '00000000-0000-4000-8f77-0000000000a1', p_vehicle_id := '00000000-0000-4000-8f77-0000000000b1',
  p_driver_id := '00000000-0000-4000-8f77-0000000000c1', p_agent := 'Agent T5') AS id;
CREATE TEMP TABLE lotsync AS SELECT public.synchroniser_saisies_mobile(jsonb_build_array(
  jsonb_build_object('client_id', 't5-acc-1', 'fonction', 'saisir_ligne_fiche',
    'fiche_id', (SELECT id FROM facc),
    'params', jsonb_build_object('rang', 1, 'ligne', jsonb_build_object(
      'gravite', 'severe', 'description', 'Choc arriere au depot',
      'survenu_le', now(), 'lieu', 'depot'))))) AS sorties;
SELECT is((SELECT e ->> 'statut' FROM jsonb_array_elements((SELECT sorties FROM lotsync)) e
  WHERE e ->> 'client_id' = 't5-acc-1'), 'ok', 'sync mobile : ligne FACC saisie par le nouveau point d''entree');
SELECT is((SELECT type FROM public.incidents WHERE description = 'Choc arriere au depot'), 'accident',
  'FACC : incident accident cree via la sync');
RESET ROLE;

SELECT finish();
ROLLBACK;
