-- Tests (D-063) : ventilation des objectifs par destination et contrat,
-- durees de cycle observees, simulation de capacite et rattrapage, cloture
-- de planification et rapport de production, comparaison des shifts
-- (migration 20261121090000). Periode 2001 : la production contient des
-- donnees de demonstration. Tout est annule.
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
-- Valeur d'une ligne de simulation.
CREATE FUNCTION pg_temp.sim(p_id uuid, p_instant timestamptz, p_code text) RETURNS numeric
LANGUAGE sql AS $$ SELECT s.valeur FROM public.simuler_objectif(p_id, p_instant) s WHERE s.code = p_code; $$;
CREATE FUNCTION pg_temp.rem(p_id uuid, p_instant timestamptz, p_code text) RETURNS text
LANGUAGE sql AS $$ SELECT coalesce(s.remarque, '-') FROM public.simuler_objectif(p_id, p_instant) s WHERE s.code = p_code; $$;

SELECT plan(56);

-- Les departs de voyages ne dependent pas des reglages de la base.
DELETE FROM public.settings WHERE key IN ('controle_depart_exige', 'planification_cloture_separee');
DELETE FROM public.habilitations_requises;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a630-000000000001', 'operations1.d063@exemple.invalid'),
  ('00000000-0000-4000-a630-000000000002', 'operations2.d063@exemple.invalid'),
  ('00000000-0000-4000-a630-000000000003', 'logisticien.d063@exemple.invalid'),
  ('00000000-0000-4000-a630-000000000004', 'operations.site.d063@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-a630-0000000000a1', 'Mine D-063', 'mine'),
  ('00000000-0000-4000-a630-0000000000a2', 'Depot A D-063', 'depot'),
  ('00000000-0000-4000-a630-0000000000a3', 'Depot B D-063', 'depot'),
  ('00000000-0000-4000-a630-0000000000a4', 'Autre site D-063', 'mine');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-a630-000000000001', 'operations_manager', 'Operations 1 D-063', 'active', NULL),
  ('00000000-0000-4000-a630-000000000002', 'operations_manager', 'Operations 2 D-063', 'active', NULL),
  ('00000000-0000-4000-a630-000000000003', 'logistician', 'Logisticien D-063', 'active', NULL),
  ('00000000-0000-4000-a630-000000000004', 'operations_manager', 'Operations site D-063', 'active', '00000000-0000-4000-a630-0000000000a4')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.work_shifts (id, name, display_name, start_time, end_time, shift_order) VALUES
  ('00000000-0000-4000-a630-0000000000e1', 'jour_d063', 'Jour D-063', '06:00', '18:00', 94),
  ('00000000-0000-4000-a630-0000000000e2', 'nuit_d063', 'Nuit D-063', '18:00', '06:00', 95);
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status, site_id) VALUES
  ('00000000-0000-4000-a630-0000000000b1', 'TEST-D063-1', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-a630-0000000000a1'),
  ('00000000-0000-4000-a630-0000000000b2', 'TEST-D063-2', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-a630-0000000000a1'),
  ('00000000-0000-4000-a630-0000000000b3', 'TEST-D063-3', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-a630-0000000000a1'),
  ('00000000-0000-4000-a630-0000000000b4', 'TEST-D063-4', 'Test', 40, 'tipper', 'maintenance', '00000000-0000-4000-a630-0000000000a1'),
  ('00000000-0000-4000-a630-0000000000b9', 'TEST-D063-CHG', 'Test', 10, 'loader', 'active', '00000000-0000-4000-a630-0000000000a1');
INSERT INTO public.contrats (id, reference, intitule, nature, contrepartie, devise, date_debut, statut) VALUES
  ('00000000-0000-4000-a630-0000000000c1', 'TEST-D063-CLI', 'Transport test', 'client', 'Client D-063', 'USD', '2001-01-01', 'actif'),
  ('00000000-0000-4000-a630-0000000000c2', 'TEST-D063-LOC', 'Location test', 'location', 'Loueur D-063', 'USD', '2001-01-01', 'actif');
INSERT INTO public.infrastructures_site (site_id, type, code, libelle, capacite, unite_capacite) VALUES
  ('00000000-0000-4000-a630-0000000000a1', 'point_chargement', 'PC-D063-1', 'Front 1', 100, 't/h'),
  ('00000000-0000-4000-a630-0000000000a1', 'point_chargement', 'PC-D063-2', 'Front 2', 500, 'm3');
-- Fermeture du site sans moyens le jour J (lue par la simulation, D-072 R1-7).
INSERT INTO public.fermetures_site (site_id, debut, fin, motif) VALUES
  ('00000000-0000-4000-a630-0000000000a4', '2001-03-05 00:00+00', '2001-03-06 00:00+00', 'Fermeture test D-063');

-- Historique : 4 jours, 2 camions, 3 voyages chacun (departs 07:00, 09:00,
-- 11:00), 40 t, trajet 50 min, chargement 10 min (journal).
INSERT INTO public.trips (reference, planned_date, vehicle_id, departure_site_id, arrival_site_id, shift_id, etat, net_weight,
                          actual_departure_time, actual_arrival_time)
SELECT 'T-D063-H-' || d || '-' || vv.n || '-' || k, '2001-03-01'::date + d, vv.veh::uuid,
       '00000000-0000-4000-a630-0000000000a1', '00000000-0000-4000-a630-0000000000a2', '00000000-0000-4000-a630-0000000000e1',
       'DELIVERED', 40,
       ('2001-03-01'::date + d + time '07:00' + k * interval '2 hours') AT TIME ZONE 'Africa/Conakry',
       ('2001-03-01'::date + d + time '07:50' + k * interval '2 hours') AT TIME ZONE 'Africa/Conakry'
  FROM generate_series(0, 3) d,
       (VALUES (1, '00000000-0000-4000-a630-0000000000b1'), (2, '00000000-0000-4000-a630-0000000000b2')) vv(n, veh),
       generate_series(0, 2) k;
INSERT INTO public.trip_events (trip_id, etat_avant, etat_apres, survenu_le)
SELECT t.id, 'AT_LOADING', 'LOADING', t.actual_departure_time - interval '20 minutes' FROM public.trips t WHERE t.reference LIKE 'T-D063-H-%'
UNION ALL
SELECT t.id, 'LOADING', 'LOADED', t.actual_departure_time - interval '10 minutes' FROM public.trips t WHERE t.reference LIKE 'T-D063-H-%';
-- Jour J (2001-03-05) : 5 voyages du shift livres avant 10:00 (4 au depot A,
-- 1 au depot B), 1 voyage livre sans shift.
INSERT INTO public.trips (reference, planned_date, vehicle_id, departure_site_id, arrival_site_id, shift_id, etat, net_weight, actual_arrival_time)
SELECT 'T-D063-J-' || k, '2001-03-05', '00000000-0000-4000-a630-0000000000b1', '00000000-0000-4000-a630-0000000000a1',
       CASE WHEN k = 4 THEN '00000000-0000-4000-a630-0000000000a3'::uuid ELSE '00000000-0000-4000-a630-0000000000a2'::uuid END,
       '00000000-0000-4000-a630-0000000000e1', 'DELIVERED', 40,
       ('2001-03-05'::date + time '08:00' + k * interval '30 minutes') AT TIME ZONE 'Africa/Conakry'
  FROM generate_series(0, 4) k;
INSERT INTO public.trips (reference, planned_date, vehicle_id, departure_site_id, arrival_site_id, shift_id, etat, net_weight) VALUES
  ('T-D063-J-SANS', '2001-03-05', '00000000-0000-4000-a630-0000000000b2', '00000000-0000-4000-a630-0000000000a1',
   '00000000-0000-4000-a630-0000000000a2', NULL, 'DELIVERED', 30);
-- Poste du shift jour la veille : 1 present en retard, 1 absent, 1 incident, 1 arret.
INSERT INTO public.postes (id, date_poste, shift_id, site_id, statut, consignes_sortie, cloture_le) VALUES
  ('00000000-0000-4000-a630-0000000000d1', '2001-03-04', '00000000-0000-4000-a630-0000000000e1', '00000000-0000-4000-a630-0000000000a1',
   'cloture', 'RAS', '2001-03-04 18:00+00');
INSERT INTO public.postes_equipe (poste_id, vehicle_id, present, retard_minutes, motif_absence) VALUES
  ('00000000-0000-4000-a630-0000000000d1', '00000000-0000-4000-a630-0000000000b1', true, 15, NULL),
  ('00000000-0000-4000-a630-0000000000d1', '00000000-0000-4000-a630-0000000000b2', false, NULL, 'Chauffeur malade');
INSERT INTO public.postes_evenements (poste_id, survenu_le, categorie, description) VALUES
  ('00000000-0000-4000-a630-0000000000d1', '2001-03-04 09:00+00', 'incident', 'Crevaison'),
  ('00000000-0000-4000-a630-0000000000d1', '2001-03-04 10:00+00', 'arret', 'Pluie');

-- Droits (D-072) : verifies par has_function_privilege et has_table_privilege.
SELECT ok(NOT has_function_privilege('anon', 'public.ventiler_objectif(uuid, jsonb)', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.cloturer_planification(date, uuid, jsonb, text)', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.annuler_cloture_planification(uuid, text)', 'EXECUTE'),
  'fonctions d''ecriture non executables par anon');
SELECT ok(has_function_privilege('authenticated', 'public.ventiler_objectif(uuid, jsonb)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.cloturer_planification(date, uuid, jsonb, text)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.annuler_cloture_planification(uuid, text)', 'EXECUTE'),
  'fonctions d''ecriture executables par les comptes (controles internes)');
SELECT ok(NOT has_function_privilege('anon', 'public.simuler_objectif(uuid, timestamptz)', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.rapport_production(date, date, uuid)', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.comparer_shifts(date, date, uuid)', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.durees_cycle_observees(uuid, uuid, date, integer)', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.production_journee(date, uuid)', 'EXECUTE'),
  'fonctions de lecture non executables par anon');
SELECT ok(NOT has_function_privilege('authenticated', 'public.garde_objectif_journee_close()', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.garde_objectif_journee_close()', 'EXECUTE'),
  'garde SECURITY DEFINER non executable par les comptes');
SELECT ok(NOT has_function_privilege('authenticated', 'public.site_ferme_le(uuid, date)', 'EXECUTE'),
  'site_ferme_le reste retire aux comptes (D-072 R1-7)');
SELECT ok(NOT has_table_privilege('authenticated', 'public.objectifs_ventilation', 'INSERT')
          AND NOT has_table_privilege('authenticated', 'public.objectifs_ventilation', 'UPDATE')
          AND NOT has_table_privilege('authenticated', 'public.objectifs_ventilation', 'DELETE')
          AND NOT has_table_privilege('authenticated', 'public.objectifs_ventilation', 'TRUNCATE'),
  'ventilation : aucune ecriture directe pour les comptes');
SELECT ok(NOT has_table_privilege('authenticated', 'public.clotures_planification', 'INSERT')
          AND NOT has_table_privilege('authenticated', 'public.clotures_planification', 'UPDATE')
          AND NOT has_table_privilege('authenticated', 'public.clotures_planification', 'DELETE')
          AND NOT has_table_privilege('authenticated', 'public.clotures_planification', 'TRUNCATE')
          AND NOT has_table_privilege('authenticated', 'public.clotures_planification_causes', 'INSERT')
          AND NOT has_table_privilege('authenticated', 'public.clotures_planification_causes', 'DELETE')
          AND NOT has_table_privilege('authenticated', 'public.clotures_planification_causes', 'TRUNCATE'),
  'clotures et causes : aucune ecriture directe pour les comptes');
SELECT ok(NOT has_table_privilege('anon', 'public.objectifs_ventilation', 'SELECT')
          AND NOT has_table_privilege('anon', 'public.clotures_planification', 'SELECT')
          AND NOT has_table_privilege('anon', 'public.v_realisation_ventilation', 'SELECT'),
  'anon ne lit ni ventilation ni clotures');

-- Fonctions utilitaires
SELECT is(public.unite_debit('Camions par heure') || '|' || public.unite_debit(' t / h ') || '|' || coalesce(public.unite_debit('m3'), 'NULL'),
  'voyages_heure|tonnes_heure|NULL', 'unite de debit : camions/h et t/h reconnues, unite libre ignoree');
SELECT is((SELECT debut || '|' || fin FROM public.fenetre_planification('2001-03-05', '00000000-0000-4000-a630-0000000000e2')),
  '2001-03-05 18:00:00+00|2001-03-06 06:00:00+00', 'fenetre d''un shift de nuit : fin le lendemain');

-- Durees de cycle observees
SELECT is((SELECT rotations_mesurees || '|' || duree_rotation_min || '|' || chargements_mesures || '|' || duree_chargement_min
                  || '|' || trajets_mesures || '|' || duree_trajet_min
             FROM public.durees_cycle_observees('00000000-0000-4000-a630-0000000000a1', '00000000-0000-4000-a630-0000000000e1', '2001-03-05')),
  '16|120.0|24|10.0|24|50.0', 'durees observees : rotation 120 min, chargement 10 min, trajet 50 min');

-- Operations 1 : objectif du shift jour
SELECT pg_temp.se_connecter('00000000-0000-4000-a630-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE o1 AS SELECT public.definir_objectif('2001-03-05', '00000000-0000-4000-a630-0000000000a1',
  '00000000-0000-4000-a630-0000000000e1', 1000) AS id;

-- Besoin au debut de la periode (06:00)
SELECT is(pg_temp.sim((SELECT id FROM o1), '2001-03-05 06:00+00', 'charge_par_voyage'), 40.00::numeric, 'charge observee : 40 t');
SELECT is(pg_temp.sim((SELECT id FROM o1), '2001-03-05 06:00+00', 'voyages_restants'), 25::numeric, 'besoin initial : 25 voyages');
SELECT is(pg_temp.sim((SELECT id FROM o1), '2001-03-05 06:00+00', 'rotations_par_camion'), 6.00::numeric, '12 h / 120 min : 6 rotations par camion');
SELECT is(pg_temp.sim((SELECT id FROM o1), '2001-03-05 06:00+00', 'camions_necessaires'), 5::numeric, 'besoin initial : 5 camions');
SELECT is(pg_temp.sim((SELECT id FROM o1), '2001-03-05 06:00+00', 'camions_disponibles'), 3::numeric, '3 camions actifs (celui en maintenance exclu)');
SELECT is(pg_temp.sim((SELECT id FROM o1), '2001-03-05 06:00+00', 'engins_necessaires'), 1::numeric, '25 voyages x 10 min / 12 h : 1 engin');
SELECT is(pg_temp.sim((SELECT id FROM o1), '2001-03-05 06:00+00', 'capacite_chargement'), 100::numeric, 'capacite saisie en t/h retenue');
SELECT matches(pg_temp.rem((SELECT id FROM o1), '2001-03-05 06:00+00', 'capacite_chargement'), 'non exploitable.*PC-D063-2',
  'capacite dans une unite libre signalee, jamais convertie');
SELECT is(pg_temp.sim((SELECT id FROM o1), '2001-03-05 06:00+00', 'tonnes_atteignables'), 720::numeric,
  'atteignable : 3 camions x 6 rotations x 40 t');
SELECT is(pg_temp.rem((SELECT id FROM o1), '2001-03-05 06:00+00', 'tonnes_atteignables'), 'limité par : camions disponibles',
  'la contrainte limitante est nommee');
SELECT is(pg_temp.sim((SELECT id FROM o1), '2001-03-05 06:00+00', 'renfort_camions'), 2::numeric, 'renfort de 2 camions pour tenir l''objectif');

-- Rattrapage a mi-periode (12:00) : 200 t livrees
SELECT is(pg_temp.sim((SELECT id FROM o1), '2001-03-05 12:00+00', 'tonnes_livrees'), 200.00::numeric, 'mi-periode : 200 t livrees');
SELECT is(pg_temp.sim((SELECT id FROM o1), '2001-03-05 12:00+00', 'voyages_restants'), 20::numeric, 'mi-periode : 20 voyages restants');
SELECT is(pg_temp.sim((SELECT id FROM o1), '2001-03-05 12:00+00', 'camions_necessaires'), 7::numeric, 'mi-periode : 7 camions sur 6 h');
SELECT matches(pg_temp.rem((SELECT id FROM o1), '2001-03-05 12:00+00', 'rythme_requis'), 'Au-dessus de la capacité saisie',
  'rythme requis au-dessus de la capacite saisie signale');
SELECT is(pg_temp.sim((SELECT id FROM o1), '2001-03-05 12:00+00', 'objectif_propose'), 560::numeric,
  'objectif revise propose : 200 + min(360 camions, 600 capacite)');
SELECT is((SELECT statut FROM public.objectifs_production WHERE id = (SELECT id FROM o1)), 'actif',
  'la simulation ne modifie rien');

-- Sans historique ni moyens : donnees insuffisantes
CREATE TEMP TABLE o4 AS SELECT public.definir_objectif('2001-03-05', '00000000-0000-4000-a630-0000000000a4', NULL, 300) AS id;
SELECT is(pg_temp.sim((SELECT id FROM o4), NULL, 'charge_par_voyage') IS NULL
          AND pg_temp.sim((SELECT id FROM o4), NULL, 'camions_necessaires') IS NULL, true,
  'sans historique ni camion : aucune estimation');
SELECT is(pg_temp.rem((SELECT id FROM o4), NULL, 'camions_necessaires'), 'Données insuffisantes', 'donnees insuffisantes annoncees');
SELECT is(pg_temp.rem((SELECT id FROM o4), NULL, 'site_ferme'), 'Fermeture test D-063',
  'fermeture du site lue par un compte, sans site_ferme_le (D-072 R1-7)');

-- Ventilation par destination et contrat
SELECT is(public.ventiler_objectif((SELECT id FROM o1), jsonb_build_array(
    jsonb_build_object('destination_id', '00000000-0000-4000-a630-0000000000a2', 'contrat_id', '00000000-0000-4000-a630-0000000000c1', 'tonnes', 600),
    jsonb_build_object('destination_id', '00000000-0000-4000-a630-0000000000a3', 'tonnes', 300))), 2,
  'ventilation par destination et contrat : 2 lignes');
SELECT is((SELECT string_agg(tonnes_livrees::text, '|' ORDER BY tonnes_cible DESC) FROM public.v_realisation_ventilation
            WHERE objectif_id = (SELECT id FROM o1)), '160.00|40.00', 'realise par destination tire des voyages');
SELECT throws_ok($$SELECT public.ventiler_objectif((SELECT id FROM o1), '[{"destination_id": "00000000-0000-4000-a630-0000000000a2", "tonnes": 10}]')$$,
  '22023', NULL, 'objectif deja ventile : nouvelle version requise');
SELECT throws_ok($$SELECT public.ventiler_objectif((SELECT id FROM o4), '[{"destination_id": "00000000-0000-4000-a630-0000000000a2", "tonnes": 301}]')$$,
  '22023', NULL, 'ventilation superieure a l''objectif refusee');
SELECT throws_ok($$SELECT public.ventiler_objectif((SELECT id FROM o4), '[{"contrat_id": "00000000-0000-4000-a630-0000000000c2", "tonnes": 100}]')$$,
  '22023', NULL, 'contrat de location refuse (contrat client exige)');
SELECT throws_ok($$SELECT public.ventiler_objectif((SELECT id FROM o4), '[{"destination_id": "00000000-0000-4000-a630-0000000000a4", "tonnes": 100}]')$$,
  '22023', NULL, 'destination egale au site de chargement refusee');
SELECT is(public.ventiler_objectif((SELECT id FROM o4), '[{"contrat_id": "00000000-0000-4000-a630-0000000000c1", "tonnes": 300}]'), 1,
  'ventilation par contrat seul acceptee');
SELECT is((SELECT (NOT mesurable AND tonnes_livrees IS NULL)::text FROM public.v_realisation_ventilation WHERE objectif_id = (SELECT id FROM o4)),
  'true', 'contrat seul : realise non mesurable, jamais estime');
SELECT throws_ok($$UPDATE public.objectifs_ventilation SET tonnes_cible = 1$$, '42501', NULL, 'ventilation non modifiable directement');

-- Droits
SELECT pg_temp.se_connecter('00000000-0000-4000-a630-000000000003');
SELECT throws_ok($$SELECT public.cloturer_planification('2001-03-05', '00000000-0000-4000-a630-0000000000a1', '[]', NULL)$$,
  '42501', NULL, 'cloture refusee sans droit d''ecriture planning');
SELECT pg_temp.se_connecter('00000000-0000-4000-a630-000000000004');
SELECT throws_ok($$SELECT public.cloturer_planification('2001-03-05', '00000000-0000-4000-a630-0000000000a1', '[]', NULL)$$,
  '42501', NULL, 'cloture refusee hors perimetre site');

-- Cloture de planification
SELECT pg_temp.se_connecter('00000000-0000-4000-a630-000000000001');
SELECT throws_ok($$SELECT public.cloturer_planification(current_date + 1, '00000000-0000-4000-a630-0000000000a1', '[]', NULL)$$,
  '22023', NULL, 'journee non terminee : cloture refusee');
SELECT throws_ok($$SELECT public.cloturer_planification('2001-03-05', '00000000-0000-4000-a630-0000000000a1', '[]', NULL)$$,
  '22023', NULL, 'realise sous l''objectif sans cause : refuse');
CREATE TEMP TABLE c1 AS SELECT public.cloturer_planification('2001-03-05', '00000000-0000-4000-a630-0000000000a1',
  '[{"categorie": "panne_camion", "description": "Deux camions en panne", "tonnes": 300}]', 'Journee difficile') AS id;
SELECT is((SELECT tonnes_cible || '|' || tonnes_livrees || '|' || ecart || '|' || (bilan ->> 'tonnes_livrees_site')
             FROM public.clotures_planification WHERE id = (SELECT id FROM c1)),
  '1000.00|200.00|-800.00|230.00', 'bilan fige : objectif du shift contre ses voyages ; site entier a part');
SELECT throws_ok($$SELECT public.definir_objectif('2001-03-05', '00000000-0000-4000-a630-0000000000a1',
  '00000000-0000-4000-a630-0000000000e1', 800, p_motif => 'Apres cloture')$$, '22023', NULL, 'journee close : objectifs figes');
SELECT throws_ok($$UPDATE public.clotures_planification SET ecart = 0$$, '42501', NULL, 'cloture non modifiable directement');
SELECT matches((SELECT statut || ' ' || causes FROM public.rapport_production('2001-03-05', '2001-03-05', '00000000-0000-4000-a630-0000000000a1')),
  '^close panne_camion \(300\.00 t\) : Deux camions en panne$', 'rapport de production : bilan fige et causes');

-- Separation (reglage) : l'auteur de l'objectif ne clot pas
RESET ROLE;
SELECT pg_temp.se_connecter(NULL);
SELECT throws_ok($$INSERT INTO public.settings (key, value) VALUES ('planification_cloture_separee', '{"value": "oui"}')$$,
  '22023', NULL, 'reglage de separation : booleen exige');
INSERT INTO public.settings (key, value) VALUES ('planification_cloture_separee', '{"value": "true"}');
SELECT pg_temp.se_connecter('00000000-0000-4000-a630-000000000001');
SET LOCAL ROLE authenticated;
SELECT public.definir_objectif('2001-03-06', '00000000-0000-4000-a630-0000000000a1', NULL, 100);
SELECT throws_ok($$SELECT public.cloturer_planification('2001-03-06', '00000000-0000-4000-a630-0000000000a1',
  '[{"categorie": "autre", "description": "Aucun voyage"}]', NULL)$$, '42501', NULL, 'separation active : l''auteur ne clot pas');
SELECT pg_temp.se_connecter('00000000-0000-4000-a630-000000000002');
SELECT lives_ok($$SELECT public.cloturer_planification('2001-03-06', '00000000-0000-4000-a630-0000000000a1',
  '[{"categorie": "autre", "description": "Aucun voyage"}]', NULL)$$, 'separation active : une autre personne clot');

-- Annulation motivee puis revision
SELECT throws_ok($$SELECT public.annuler_cloture_planification((SELECT id FROM c1), ' ')$$, '22023', NULL, 'annulation sans motif refusee');
SELECT public.annuler_cloture_planification((SELECT id FROM c1), 'Pesees manquantes saisies en retard');
SELECT lives_ok($$SELECT public.definir_objectif('2001-03-05', '00000000-0000-4000-a630-0000000000a1',
  '00000000-0000-4000-a630-0000000000e1', 560, p_motif => 'Scenario de rattrapage retenu')$$,
  'cloture annulee : scenario retenu par definir_objectif');

-- Perimetre de lecture
SELECT pg_temp.se_connecter('00000000-0000-4000-a630-000000000004');
SELECT is((SELECT count(*)::int FROM public.clotures_planification WHERE site_id = '00000000-0000-4000-a630-0000000000a1'), 0,
  'clotures d''un autre site invisibles');

-- Comparaison entre shifts
SELECT pg_temp.se_connecter('00000000-0000-4000-a630-000000000001');
SELECT is((SELECT voyages_livres || '|' || tonnes_livrees || '|' || duree_rotation_min || '|' || duree_trajet_min || '|' || postes
                  || '|' || incidents || '|' || arrets || '|' || absences || '|' || retard_minutes
             FROM public.comparer_shifts('2001-03-01', '2001-03-05', '00000000-0000-4000-a630-0000000000a1')
            WHERE shift_id = '00000000-0000-4000-a630-0000000000e1'),
  '29|1160.00|120.0|50.0|1|1|1|1|15', 'shift jour : voyages, tonnes, durees, postes, incidents, absences');
SELECT is((SELECT shift || '|' || voyages_livres FROM public.comparer_shifts('2001-03-01', '2001-03-05', '00000000-0000-4000-a630-0000000000a1')
            WHERE shift_id IS NULL), 'Sans shift|1', 'voyages sans shift comptes a part, jamais attribues');

SELECT * FROM finish();
ROLLBACK;
