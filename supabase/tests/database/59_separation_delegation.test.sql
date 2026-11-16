-- Tests (D-064, contre-revue R1) : une delegation d'ecriture ne contourne pas
-- les separations des taches fondees sur l'ecriture. Le delegue ne valide pas
-- ce que son delegant a saisi ou clos, sauf s'il detient le droit en propre
-- (migration 20261121140000, section 5). Tout est annule.
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

SELECT plan(22);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-b659-000000000001', 'admin.r1@exemple.invalid'),
  ('00000000-0000-4000-b659-000000000002', 'chef.r1@exemple.invalid'),
  ('00000000-0000-4000-b659-000000000003', 'chauffeur.r1@exemple.invalid'),
  ('00000000-0000-4000-b659-000000000004', 'contrats.r1@exemple.invalid'),
  ('00000000-0000-4000-b659-000000000005', 'maintenance.r1@exemple.invalid'),
  ('00000000-0000-4000-b659-000000000006', 'flotte.r1@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-b659-000000000001', 'admin', 'Admin R1', 'active', NULL),
  ('00000000-0000-4000-b659-000000000002', 'operations_manager', 'Chef R1', 'active', NULL),
  ('00000000-0000-4000-b659-000000000003', 'driver', 'Chauffeur R1', 'active', NULL),
  ('00000000-0000-4000-b659-000000000004', 'contract_manager', 'Contrats R1', 'active', NULL),
  ('00000000-0000-4000-b659-000000000005', 'maintenance_chief', 'Maintenance R1', 'active', NULL),
  ('00000000-0000-4000-b659-000000000006', 'fleet_manager', 'Flotte R1', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name, status = EXCLUDED.status,
  site_id = EXCLUDED.site_id;
INSERT INTO public.sites (id, name, type) VALUES ('00000000-0000-4000-b659-0000000000a1', 'Site R1', 'mine');
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, site_id) VALUES
  ('00000000-0000-4000-b659-0000000000b1', 'TEST-R1-1', 'Test', 40, 'tipper', '00000000-0000-4000-b659-0000000000a1'),
  ('00000000-0000-4000-b659-0000000000b2', 'TEST-R1-2', 'Test', 40, 'tipper', '00000000-0000-4000-b659-0000000000a1');
DELETE FROM public.settings WHERE key IN ('carburant_validation_separee', 'kilometrage_validation_separee',
                                          'planification_cloture_separee', 'clauses_renonciation_separee');

-- 0. Regle generale (auteur_ou_delegant) et fonctions reprises -------------

SELECT ok(NOT has_function_privilege('authenticated', 'public.auteur_ou_delegant(uuid, text)', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'public.delegants_ecriture(text)', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.auteur_ou_delegant(uuid, text)', 'EXECUTE'),
  'fonctions de separation internes, non executables par les comptes');
SELECT is((SELECT count(*)::int FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
            AND p.proname IN ('valider_cloture_poste', 'cloturer_planification', 'valider_distance_voyage',
                              'decider_inventaire_carburant', 'decider_mouvement_carburant',
                              'valider_remise_en_service', 'rectifier_ticket_pesee_cbg')
            AND p.prosrc LIKE '%auteur_ou_delegant%'), 7,
  'les sept controles de separation fondes sur l''ecriture lisent les delegants');

-- Le chef delegue l'ecriture planning au chauffeur (sans ce droit par son role).
SELECT pg_temp.se_connecter('00000000-0000-4000-b659-000000000002');
SET LOCAL ROLE authenticated;
SELECT public.deleguer_droit('00000000-0000-4000-b659-000000000003', 'planning', 'ecriture',
  now(), now() + interval '1 day', 'Validation R1');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b659-000000000003');
SELECT ok(public.has_module_write('planning') AND NOT public.droit_module_base(auth.uid(), 'planning', 'ecriture'),
  'le chauffeur ecrit planning par delegation seulement');
SELECT ok(public.auteur_ou_delegant('00000000-0000-4000-b659-000000000002', 'planning'),
  'le delegant est assimile a l''appelant sur le module delegue');
SELECT ok(NOT public.auteur_ou_delegant('00000000-0000-4000-b659-000000000002', 'fuel'),
  'pas sur un autre module');
SELECT ok(NOT public.auteur_ou_delegant('00000000-0000-4000-b659-000000000004', 'planning')
          AND NOT public.auteur_ou_delegant(NULL, 'planning'),
  'ni pour un tiers ni pour un auteur inconnu');
SELECT pg_temp.se_connecter('00000000-0000-4000-b659-000000000006');
SELECT ok(NOT public.auteur_ou_delegant('00000000-0000-4000-b659-000000000002', 'planning'),
  'un compte sans delegation n''est pas concerne');
SELECT pg_temp.se_connecter(NULL);

-- 1. Poste (sonde G du relecteur) -----------------------------------------

INSERT INTO public.work_shifts (id, name, display_name, start_time, end_time, shift_order) VALUES
  ('00000000-0000-4000-b659-0000000000e1', 'r1_jour', 'Jour R1', '06:00', '18:00', 96);
INSERT INTO public.drivers (id, name, license_number, license_category, license_expiry, hire_date, status) VALUES
  ('00000000-0000-4000-b659-0000000000c1', 'Chauffeur poste R1', 'R1-1', 'C', '2030-01-01', '2020-01-01', 'active');
SELECT pg_temp.se_connecter('00000000-0000-4000-b659-000000000002');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE pg1 AS SELECT public.ouvrir_poste(current_date, '00000000-0000-4000-b659-0000000000e1',
  '00000000-0000-4000-b659-0000000000a1') AS id;
GRANT SELECT ON pg1 TO authenticated;
CREATE TEMP TABLE mg1 AS SELECT public.affecter_au_poste((SELECT id FROM pg1), '00000000-0000-4000-b659-0000000000c1') AS id;
GRANT SELECT ON mg1 TO authenticated;
SELECT public.pointer_presence((SELECT id FROM mg1), true);
SELECT public.cloturer_poste((SELECT id FROM pg1), 'Consignes R1', 'RAS');
SELECT throws_ok($$SELECT public.valider_cloture_poste((SELECT id FROM pg1))$$, '42501', NULL,
  'poste : le chef ne valide pas son propre poste');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b659-000000000003');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.valider_cloture_poste((SELECT id FROM pg1))$$, '42501',
  'La validation revient a une autre personne que celle qui a clos le poste',
  'poste : le delegue ne valide pas le poste clos par son delegant (sonde G)');
RESET ROLE;
SELECT is((SELECT valide_par FROM public.postes WHERE id = (SELECT id FROM pg1)), NULL::uuid, 'poste : toujours non valide');
SELECT pg_temp.se_connecter('00000000-0000-4000-b659-000000000006');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.valider_cloture_poste((SELECT id FROM pg1))$$,
  'poste : un compte qui detient le droit en propre valide');
RESET ROLE;

-- 2. Cloture de planification ----------------------------------------------

SELECT pg_temp.se_connecter(NULL);
INSERT INTO public.settings (key, value) VALUES ('planification_cloture_separee', '{"value": "true"}');
SELECT pg_temp.se_connecter('00000000-0000-4000-b659-000000000002');
SET LOCAL ROLE authenticated;
SELECT public.definir_objectif('2001-04-05', '00000000-0000-4000-b659-0000000000a1', NULL, 100);
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b659-000000000003');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.cloturer_planification('2001-04-05', '00000000-0000-4000-b659-0000000000a1',
  '[{"categorie": "autre", "description": "Aucun voyage"}]', NULL)$$, '42501', NULL,
  'planification : le delegue ne clot pas la journee dont son delegant a fixe l''objectif');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b659-000000000006');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.cloturer_planification('2001-04-05', '00000000-0000-4000-b659-0000000000a1',
  '[{"categorie": "autre", "description": "Aucun voyage"}]', NULL)$$,
  'planification : un autre compte avec le droit propre clot');
RESET ROLE;

-- 3. Carburant : inventaire et mouvement -------------------------------------

SELECT pg_temp.se_connecter(NULL);
INSERT INTO public.stockages_carburant (id, code, libelle, type, site_id, capacite_litres) VALUES
  ('00000000-0000-4000-b659-0000000000f1', 'R1-CUVE', 'Cuve R1', 'cuve_fixe', '00000000-0000-4000-b659-0000000000a1', 10000);
INSERT INTO public.inventaires_carburant (id, stockage_id, date_mesure, volume_mesure, methode_mesure, statut, cree_par) VALUES
  ('00000000-0000-4000-b659-0000000000f2', '00000000-0000-4000-b659-0000000000f1', now() - interval '1 hour', 500, 'jauge',
   'a_valider', '00000000-0000-4000-b659-000000000006');
INSERT INTO public.mouvements_carburant (id, stockage_id, type, variation, date_mouvement, statut, saisi_par, transfert_id) VALUES
  ('00000000-0000-4000-b659-0000000000f3', '00000000-0000-4000-b659-0000000000f1', 'transfert_entree', 1000,
   now() - interval '1 hour', 'a_valider', '00000000-0000-4000-b659-000000000006', '00000000-0000-4000-b659-0000000000f4');
SELECT pg_temp.se_connecter('00000000-0000-4000-b659-000000000006');
SET LOCAL ROLE authenticated;
SELECT public.deleguer_droit('00000000-0000-4000-b659-000000000003', 'fuel', 'ecriture',
  now(), now() + interval '1 day', 'Carburant R1');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b659-000000000003');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.decider_inventaire_carburant('00000000-0000-4000-b659-0000000000f2', true)$$, '42501',
  'La decision revient a une autre personne que l''auteur de la saisie',
  'inventaire carburant : le delegue ne valide pas la saisie de son delegant');
SELECT throws_ok($$SELECT public.decider_mouvement_carburant('00000000-0000-4000-b659-0000000000f3', true)$$, '42501',
  'La decision revient a une autre personne que l''auteur de la saisie',
  'mouvement carburant : le delegue ne valide pas la saisie de son delegant');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b659-000000000002');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.decider_inventaire_carburant('00000000-0000-4000-b659-0000000000f2', true)$$,
  'inventaire carburant : un autre compte avec le droit propre decide');
RESET ROLE;

-- 4. Remise en service apres intervention du loueur -------------------------

SELECT pg_temp.se_connecter(NULL);
INSERT INTO public.immobilisations (id, vehicle_id, debut, cause, imputation, description) VALUES
  ('00000000-0000-4000-b659-0000000000d1', '00000000-0000-4000-b659-0000000000b2', now() - interval '10 hours',
   'panne', 'loueur', 'Fuite R1');
SELECT pg_temp.se_connecter('00000000-0000-4000-b659-000000000005');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE i1 AS SELECT public.demander_intervention_loueur('00000000-0000-4000-b659-0000000000d1',
  now() - interval '9 hours', 'courriel', 'Fuite R1') AS id;
GRANT SELECT ON i1 TO authenticated;
SELECT public.prendre_en_charge_intervention((SELECT id FROM i1), now() - interval '3 hours', 'Technicien');
SELECT public.terminer_intervention((SELECT id FROM i1), now() - interval '1 hour', 'Flexible remplace');
SELECT public.deleguer_droit('00000000-0000-4000-b659-000000000003', 'maintenance', 'ecriture',
  now(), now() + interval '1 day', 'Maintenance R1');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b659-000000000003');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.valider_remise_en_service((SELECT id FROM i1), true)$$, '42501',
  'La remise en service est validee par une autre personne que celle qui a saisi la fin',
  'remise en service : le delegue ne valide pas la fin saisie par son delegant');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b659-000000000006');
SET LOCAL ROLE authenticated;
SELECT is(public.valider_remise_en_service((SELECT id FROM i1), true), 'remise_validee',
  'remise en service : un autre compte avec le droit propre valide');
RESET ROLE;

-- 5. Distance d'un voyage (releves saisis par le delegant) -------------------

SELECT pg_temp.se_connecter('00000000-0000-4000-b659-000000000004');
SET LOCAL ROLE authenticated;
SELECT public.deleguer_droit('00000000-0000-4000-b659-000000000003', 'contracts', 'ecriture',
  now(), now() + interval '1 day', 'Contrats R1');
RESET ROLE;
SELECT pg_temp.se_connecter(NULL);
INSERT INTO public.trips (id, reference, planned_date, vehicle_id, etat, departure_site_id, arrival_site_id) VALUES
  ('00000000-0000-4000-b659-000000000011', 'TEST-R1-T1', '2001-04-05', '00000000-0000-4000-b659-0000000000b1', 'DELIVERED',
   '00000000-0000-4000-b659-0000000000a1', '00000000-0000-4000-b659-0000000000a1');
INSERT INTO public.releves_compteur (vehicle_id, trip_id, moment, valeur_km, releve_le, source, saisi_par) VALUES
  ('00000000-0000-4000-b659-0000000000b1', '00000000-0000-4000-b659-000000000011', 'depart_charge', 10000,
   '2001-04-05 06:00+00', 'fiche', '00000000-0000-4000-b659-000000000004');
SELECT pg_temp.se_connecter('00000000-0000-4000-b659-000000000003');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.valider_distance_voyage('00000000-0000-4000-b659-000000000011', 52, 53)$$, '42501',
  'La validation revient a une autre personne que l''auteur des releves',
  'distance : le delegue ne valide pas les releves saisis par son delegant');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b659-000000000001');
SET LOCAL ROLE authenticated;
SELECT is(public.valider_distance_voyage('00000000-0000-4000-b659-000000000011', 52, 53, NULL, 'Releve unique, distance de reference'), 1,
  'distance : un autre compte avec le droit propre valide');
RESET ROLE;
SELECT pg_temp.se_connecter(NULL);

-- 6. Clause contractuelle : la renonciation separee exige l'approbation, qui
--    ne se delegue pas ; l'application n'a pas de controle d'auteur.
SELECT pg_temp.se_connecter('00000000-0000-4000-b659-000000000003');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_approve('contracts'), false,
  'clause : le delegue n''a jamais l''approbation des contrats (renonciation separee impossible)');
RESET ROLE;

-- 7. Le delegue qui detient le droit en propre n'est pas bloque par la regle.
SELECT pg_temp.se_connecter('00000000-0000-4000-b659-000000000006');
SET LOCAL ROLE authenticated;
SELECT public.deleguer_droit('00000000-0000-4000-b659-000000000002', 'fuel', 'ecriture',
  now(), now() + interval '1 day', 'Doublon de droit');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b659-000000000002');
SELECT ok(NOT public.auteur_ou_delegant('00000000-0000-4000-b659-000000000006', 'fuel'),
  'delegue detenant le droit en propre : la delegation ne change rien');
SELECT pg_temp.se_connecter(NULL);

SELECT * FROM finish();
ROLLBACK;
