-- Tests (D-068) : alertes ecrites par le serveur (regle a seuil inactive
-- sans reglage, une alerte par objet, resolution motivee, condition
-- levee), centre des decisions, filtres des indicateurs de pilotage, EPI,
-- registre des risques versionne, plans de prevention signes, inspections
-- planifiees avec constats et actions correctives (migration
-- 20261121150000). Integration : reglages D-063, D-065 et D-067 conserves,
-- mes_validations D-065 conservee, indicateurs D-072 R3 (masque, annulee),
-- perimetre et message unique (D-075), droits retires verifies par
-- has_*_privilege (D-072), jamais par un appel sous SET ROLE. Periode 2001
-- pour les agregats. Tout est annule.
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

SELECT plan(109);

CREATE FUNCTION pg_temp.actualiser() RETURNS void
LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM public.alertes_actualisation;
  SELECT public.actualiser_alertes(false);
$$;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a680-000000000001', 'admin.d068@exemple.invalid'),
  ('00000000-0000-4000-a680-000000000002', 'operations.d068@exemple.invalid'),
  ('00000000-0000-4000-a680-000000000003', 'directeur.d068@exemple.invalid'),
  ('00000000-0000-4000-a680-000000000004', 'chauffeur.d068@exemple.invalid'),
  ('00000000-0000-4000-a680-000000000005', 'site.d068@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-a680-0000000000a1', 'Mine D-068', 'mine'),
  ('00000000-0000-4000-a680-0000000000a2', 'Depot D-068', 'depot');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-a680-000000000001', 'admin', 'Admin D-068', 'active', NULL),
  ('00000000-0000-4000-a680-000000000002', 'operations_manager', 'Operations D-068', 'active', NULL),
  ('00000000-0000-4000-a680-000000000003', 'director', 'Directeur D-068', 'active', NULL),
  ('00000000-0000-4000-a680-000000000004', 'driver', 'Chauffeur D-068', 'active', NULL),
  ('00000000-0000-4000-a680-000000000005', 'operations_manager', 'Site D-068', 'active', '00000000-0000-4000-a680-0000000000a2')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status, site_id, transporteur) VALUES
  ('00000000-0000-4000-a680-0000000000b1', 'TEST-D068-1', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-a680-0000000000a1', 'Transports Kaloum'),
  ('00000000-0000-4000-a680-0000000000b2', 'TEST-D068-2', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-a680-0000000000a1', NULL),
  ('00000000-0000-4000-a680-0000000000b3', 'TEST-D068-3', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-a680-0000000000a2', NULL);
INSERT INTO public.drivers (id, name, license_number, license_category, license_expiry, hire_date, status, site_id) VALUES
  ('00000000-0000-4000-a680-0000000000c1', 'Chauffeur Mine D-068', 'D068-1', 'C', '2030-01-01', '2020-01-01', 'active', '00000000-0000-4000-a680-0000000000a1');
DELETE FROM public.settings WHERE key LIKE 'alerte\_%';
DELETE FROM public.alertes_actualisation;

-- Donnees reelles de depart (hors session)
SELECT pg_temp.se_connecter(NULL);
INSERT INTO public.immobilisations (id, vehicle_id, debut, cause, imputation, description, statut) VALUES
  ('00000000-0000-4000-a680-0000000000d1', '00000000-0000-4000-a680-0000000000b1', now() - interval '100 hours', 'panne', 'loueur', 'Boite de vitesses', 'ouverte');
INSERT INTO public.trips (id, reference, planned_date, vehicle_id, departure_site_id, etat, net_weight) VALUES
  ('00000000-0000-4000-a680-000000000101', 'TD068-1', '2001-04-10', '00000000-0000-4000-a680-0000000000b1', '00000000-0000-4000-a680-0000000000a1', 'DELIVERED', 30),
  ('00000000-0000-4000-a680-000000000102', 'TD068-2', '2001-04-11', '00000000-0000-4000-a680-0000000000b2', '00000000-0000-4000-a680-0000000000a1', 'DELIVERED', 20);
-- Revue D-068 : une donnee par regle. Voyage du site A avec le camion du site B
-- livre sans ticket ; incident sur ce voyage et action corrective en retard.
INSERT INTO public.trips (id, reference, planned_date, vehicle_id, departure_site_id, etat, net_weight) VALUES
  ('00000000-0000-4000-a680-000000000103', 'TD068-3', current_date, '00000000-0000-4000-a680-0000000000b3', '00000000-0000-4000-a680-0000000000a1', 'DELIVERED', 25);
INSERT INTO public.trip_events (trip_id, etat_avant, etat_apres, survenu_le) VALUES
  ('00000000-0000-4000-a680-000000000103', 'IN_TRANSIT', 'DELIVERED', now() - interval '5 hours');
INSERT INTO public.incidents (id, numero, incident_time, description, severity, type, trip_id, vehicle_id) VALUES
  ('00000000-0000-4000-a680-0000000000f1', 'INC-TEST-D068', now() - interval '3 days', 'Incident D-068', 'minor', 'materiel',
   '00000000-0000-4000-a680-000000000103', '00000000-0000-4000-a680-0000000000b3');
INSERT INTO public.actions_correctives (id, incident_id, libelle, responsable, echeance) VALUES
  ('00000000-0000-4000-a680-0000000000f2', '00000000-0000-4000-a680-0000000000f1', 'Reparer le hayon', 'Atelier', current_date - 2);
INSERT INTO public.interventions_loueur (id, numero, immobilisation_id, vehicle_id, statut, demande_le, canal, description, delai_contractuel_heures) VALUES
  ('00000000-0000-4000-a680-0000000000f3', 'INT-TEST-D068', '00000000-0000-4000-a680-0000000000d1', '00000000-0000-4000-a680-0000000000b1',
   'demandee', now() - interval '48 hours', 'telephone', 'Boite de vitesses', 24);
INSERT INTO public.stockages_carburant (id, code, libelle, type, site_id, capacite_litres) VALUES
  ('00000000-0000-4000-a680-0000000000f4', 'CUVE-D068', 'Cuve D-068', 'cuve_fixe', '00000000-0000-4000-a680-0000000000a1', 10000);
INSERT INTO public.inventaires_carburant (id, stockage_id, date_mesure, volume_mesure, methode_mesure, solde_theorique, ecart, statut) VALUES
  ('00000000-0000-4000-a680-0000000000f5', '00000000-0000-4000-a680-0000000000f4', now() - interval '1 hour', 900, 'jauge', 1000, -100, 'valide');
INSERT INTO public.vehicle_documents (id, vehicle_id, document_type, document_name, expiry_date) VALUES
  ('00000000-0000-4000-a680-0000000000f6', '00000000-0000-4000-a680-0000000000b1', 'insurance', 'Assurance D-068', current_date - 3);
INSERT INTO public.habilitations_chauffeur (id, driver_id, type, libelle, delivre_le, expire_le) VALUES
  ('00000000-0000-4000-a680-0000000000f7', '00000000-0000-4000-a680-0000000000c1', 'visite_medicale', 'Visite D-068', current_date - 400, current_date - 1);
INSERT INTO public.settings (key, value, category) VALUES
  ('alerte_voyage_sans_ticket_h', '{"value": "2"}', 'alertes'), ('alerte_ecart_carburant_l', '{"value": "50"}', 'alertes');
CREATE TEMP TABLE dernier_calcul(t timestamptz);
GRANT ALL ON dernier_calcul TO authenticated;

-- D-072 R3-2 : immobilisation annulee de l'engin 2 dans la periode filtree
INSERT INTO public.immobilisations (vehicle_id, debut, fin, cause, imputation, description, statut) VALUES
  ('00000000-0000-4000-a680-0000000000b2', '2001-04-05 06:00+00', '2001-04-06 06:00+00', 'panne', 'loueur', 'Saisie erronee D-068', 'annulee');

-- 0. Droits (has_*_privilege, D-072) et reglages conserves de main
SELECT ok(NOT has_table_privilege('authenticated', 'public.alerts', 'INSERT') AND NOT has_table_privilege('authenticated', 'public.alerts', 'UPDATE')
          AND NOT has_table_privilege('authenticated', 'public.alerts', 'DELETE') AND NOT has_table_privilege('authenticated', 'public.alerts', 'TRUNCATE')
          AND NOT has_table_privilege('anon', 'public.alerts', 'SELECT'),
  'alertes : aucune ecriture des comptes, rien pour anon');
SELECT is((SELECT count(*)::integer FROM unnest(ARRAY['programmes_inspection', 'inspections', 'constats_inspection', 'dotations_epi', 'risques',
                                                     'risques_versions', 'plans_prevention', 'alertes_actualisation']) t,
                 unnest(ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) d
            WHERE has_table_privilege('authenticated', 'public.' || t, d) OR has_table_privilege('anon', 'public.' || t, d)
               OR has_table_privilege('anon', 'public.' || t, 'SELECT')), 0,
  'tables HSE et alertes_actualisation : aucune ecriture directe, rien pour anon');
SELECT is((SELECT count(*)::integer FROM unnest(ARRAY['inspections_numero_seq', 'dotations_epi_numero_seq', 'risques_numero_seq',
                                                     'plans_prevention_numero_seq']) q
            WHERE has_sequence_privilege('authenticated', 'public.' || q, 'USAGE') OR has_sequence_privilege('authenticated', 'public.' || q, 'UPDATE')
               OR has_sequence_privilege('anon', 'public.' || q, 'USAGE')), 0,
  'sequences de numerotation fermees aux comptes');
SELECT is((SELECT count(*)::integer FROM unnest(ARRAY['v_actions_correctives_en_retard', 'v_epi_a_renouveler', 'v_risques_courants', 'v_plans_prevention']) v
            WHERE has_table_privilege('anon', 'public.' || v, 'SELECT') OR has_table_privilege('authenticated', 'public.' || v, 'INSERT')
               OR NOT has_table_privilege('authenticated', 'public.' || v, 'SELECT')), 0,
  'vues HSE : lecture seule pour les comptes, rien pour anon');
SELECT ok(NOT has_table_privilege('authenticated', 'public.v_alertes_candidates', 'SELECT')
          AND NOT has_table_privilege('anon', 'public.v_alertes_candidates', 'SELECT'),
  'candidats d''alerte (vue interne) illisibles par les comptes');
SELECT is((SELECT count(*)::integer FROM unnest(ARRAY['public.seuil_regle_alerte(text)', 'public.regle_alerte_en_service(text)',
                                                     'public.exiger_droit_hse()', 'public.exiger_ecriture_hse(uuid)', 'public.texte_requis(text, text)',
                                                     'public.inspection_ecrivable(uuid)', 'public.inserer_inspection(uuid, uuid, text, text, text, date)',
                                                     'public.planifier_suivante(public.inspections)', 'public.dotation_epi_ouverte(uuid)',
                                                     'public.alerte_traitable(uuid)']) f
            WHERE has_function_privilege('authenticated', f, 'EXECUTE') OR has_function_privilege('anon', f, 'EXECUTE')), 0,
  'fonctions internes (SECURITY DEFINER et oracles de reglages) non executables par les comptes');
SELECT is((SELECT count(*)::integer FROM unnest(ARRAY['public.actualiser_alertes(boolean)', 'public.regles_alertes()', 'public.centre_decisions()',
                                                     'public.indicateurs_pilotage(date, date, uuid, uuid, uuid, text)',
                                                     'public.remettre_epi(uuid, text, text, integer, date, date, text, text, uuid, uuid, uuid)',
                                                     'public.signer_plan_prevention(uuid)', 'public.solder_action_corrective(uuid, boolean, text, timestamptz)']) f
            WHERE has_function_privilege('anon', f, 'EXECUTE') OR NOT has_function_privilege('authenticated', f, 'EXECUTE')), 0,
  'fonctions exposees : comptes oui, anon non');
SELECT ok(to_regprocedure('public.indicateurs_pilotage(date, date, uuid)') IS NULL
          AND (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'indicateurs_pilotage') = 1,
  'indicateurs_pilotage : une seule signature (ancienne retiree, aucune surcharge)');
SELECT ok(pg_get_functiondef('public.mes_validations()'::regprocedure) LIKE '%v_echeances_contrats%'
          AND pg_get_functiondef('public.mes_validations()'::regprocedure) LIKE '%calculs_clauses%'
          AND pg_get_functiondef('public.mes_validations()'::regprocedure) LIKE '%v_suivi_budgets%'
          AND pg_get_functiondef('public.mes_validations()'::regprocedure) LIKE '%plans_prevention%',
  'mes_validations : branches D-065 conservees, plans a signer ajoutes');
SELECT throws_ok($$INSERT INTO public.settings (key, value, category) VALUES ('planification_cloture_separee', '{"value": "oui"}', 'test')$$,
  '22023', NULL, 'valider_reglage conserve la cle D-063');
SELECT throws_ok($$INSERT INTO public.settings (key, value, category) VALUES ('contrats_alerte_echeance_jours', '{"value": "1.5"}', 'test')$$,
  '22023', NULL, 'valider_reglage conserve la cle entiere D-065');
SELECT throws_ok($$INSERT INTO public.settings (key, value, category) VALUES ('pneu_reforme_precoce_km', '{"value": "-1"}', 'test')$$,
  '22023', NULL, 'valider_reglage conserve la cle D-067');

-- 1. Regles et reglages
SELECT pg_temp.se_connecter('00000000-0000-4000-a680-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT en_service FROM public.regles_alertes() WHERE regle = 'immobilisation_longue'), false, 'regle a seuil sans reglage : hors service');
SELECT is((SELECT en_service FROM public.regles_alertes() WHERE regle = 'controle_non_conforme'), true, 'regle sans seuil : en service si absente');
SELECT pg_temp.actualiser();
SELECT is((SELECT count(*)::integer FROM public.alerts WHERE reference_id = '00000000-0000-4000-a680-0000000000d1'), 0,
  'sans seuil saisi, aucune alerte d''immobilisation longue');
SELECT throws_ok($$INSERT INTO public.settings (key, value, category) VALUES ('alerte_immobilisation_longue_h', '{"value": "-3"}', 'alertes')$$,
  '22023', NULL, 'seuil invalide refuse par valider_reglage');
SELECT throws_ok($$INSERT INTO public.settings (key, value, category) VALUES ('alerte_immobilisation_longue_h', '{"value": "0"}', 'alertes')$$,
  '22023', NULL, 'seuil nul refuse : un seuil d''alerte est strictement positif');
INSERT INTO public.settings (key, value, category) VALUES ('alerte_immobilisation_longue_h', '{"value": "48"}', 'alertes');
SELECT lives_ok($$SELECT public.actualiser_alertes(true)$$, 'administrateur : actualisation forcee');
SELECT is((SELECT count(*)::integer FROM public.alerts WHERE regle = 'immobilisation_longue' AND reference_id = '00000000-0000-4000-a680-0000000000d1'), 1,
  'une alerte pour l''immobilisation');
SELECT pg_temp.actualiser();
SELECT is((SELECT count(*)::integer FROM public.alerts WHERE regle = 'immobilisation_longue' AND reference_id = '00000000-0000-4000-a680-0000000000d1'), 1,
  'pas de doublon a l''actualisation suivante');
INSERT INTO dernier_calcul SELECT derniere FROM public.alertes_actualisation;
SELECT public.actualiser_alertes(false);
SELECT is((SELECT derniere FROM public.alertes_actualisation), (SELECT t FROM dernier_calcul), 'actualisation rapprochee ignoree (intervalle technique)');
SELECT is(pg_get_function_result('public.actualiser_alertes(boolean)'::regprocedure), 'void',
  'constat 3 : actualiser_alertes ne renvoie rien (aucun nombre d''alertes tous sites)');
-- Une alerte par regle
SELECT is((SELECT count(*)::integer FROM public.alerts WHERE regle = 'intervention_retard' AND reference_id = '00000000-0000-4000-a680-0000000000f3'), 1,
  'regle intervention Neemba en retard (delai contractuel saisi)');
SELECT is((SELECT count(*)::integer FROM public.alerts WHERE regle = 'ecart_carburant' AND reference_id = '00000000-0000-4000-a680-0000000000f5'), 1,
  'regle ecart d''inventaire carburant au-dela du seuil');
SELECT is((SELECT count(*)::integer FROM public.alerts WHERE regle = 'document_expire' AND reference_type = 'vehicle_document' AND reference_id = '00000000-0000-4000-a680-0000000000f6'), 1,
  'regle document d''engin expire');
SELECT is((SELECT count(*)::integer FROM public.alerts WHERE regle = 'document_expire' AND reference_type = 'habilitation_chauffeur' AND reference_id = '00000000-0000-4000-a680-0000000000f7'), 1,
  'regle habilitation de chauffeur expiree');
SELECT is((SELECT count(*)::integer FROM public.alerts WHERE regle = 'voyage_sans_ticket' AND reference_id = '00000000-0000-4000-a680-000000000103'), 1,
  'regle voyage livre sans ticket CBG au-dela du seuil');
SELECT is((SELECT count(*)::integer FROM public.alerts WHERE regle = 'action_corrective_retard' AND reference_id = '00000000-0000-4000-a680-0000000000f2'), 1,
  'regle action corrective en retard');
-- Constat 5 : une regle mise hors service leve la condition de ses alertes
INSERT INTO public.settings (key, value, category) VALUES ('alerte_document_expire_active', '{"value": "false"}', 'alertes');
SELECT pg_temp.actualiser();
SELECT is((SELECT count(*)::integer FROM public.alerts WHERE regle = 'document_expire' AND condition_levee_le IS NOT NULL AND status = 'active'), 2,
  'constat 5 : regle hors service, alertes ouvertes marquees condition levee');
UPDATE public.settings SET value = '{"value": "true"}' WHERE key = 'alerte_document_expire_active';
SELECT is((SELECT module || ' ' || ecran || ' ' || severity FROM public.alerts WHERE reference_id = '00000000-0000-4000-a680-0000000000d1'),
  'maintenance immobilisations warning', 'alerte rattachee au module, a l''ecran et a la gravite de la regle');
RESET ROLE;

-- 2. Ecriture directe interdite, resolution motivee et habilitee
SELECT pg_temp.se_connecter('00000000-0000-4000-a680-000000000004');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::integer FROM public.alerts WHERE reference_id = '00000000-0000-4000-a680-0000000000d1'), 1,
  'lecture maintenance : alerte visible');
SELECT throws_ok($$SELECT public.resoudre_alerte((SELECT id FROM public.alerts WHERE reference_id = '00000000-0000-4000-a680-0000000000d1'), 'Vu')$$,
  '42501', NULL, 'resolution refusee sans droit d''ecriture du module');
RESET ROLE;
CREATE TEMP TABLE al_autre AS SELECT id FROM public.alerts WHERE reference_id = '00000000-0000-4000-a680-0000000000d1';
GRANT SELECT ON al_autre TO authenticated;
CREATE TEMP TABLE al_voyage AS SELECT id FROM public.alerts WHERE regle = 'voyage_sans_ticket' AND reference_id = '00000000-0000-4000-a680-000000000103';
GRANT SELECT ON al_voyage TO authenticated;
CREATE TEMP TABLE al_action AS SELECT id FROM public.alerts WHERE regle = 'action_corrective_retard' AND reference_id = '00000000-0000-4000-a680-0000000000f2';
GRANT SELECT ON al_action TO authenticated;
SELECT pg_temp.se_connecter('00000000-0000-4000-a680-000000000005');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::integer FROM public.alerts WHERE reference_id = '00000000-0000-4000-a680-0000000000d1'), 0,
  'perimetre : alerte d''un engin d''un autre site invisible');
SELECT throws_ok($$SELECT public.prendre_en_compte_alerte((SELECT id FROM al_autre))$$, '42501', 'Alerte introuvable ou hors de votre perimetre',
  'alerte hors perimetre : refusee avant toute description');
SELECT throws_ok($$SELECT public.prendre_en_compte_alerte(gen_random_uuid())$$, '42501', 'Alerte introuvable ou hors de votre perimetre',
  'alerte inexistante : meme message (D-075)');
SELECT is((SELECT count(*)::integer FROM public.vehicles WHERE id = '00000000-0000-4000-a680-0000000000b3'), 1, 'site B : son camion est visible');
SELECT is((SELECT count(*)::integer FROM public.alerts WHERE regle = 'voyage_sans_ticket' AND reference_id = '00000000-0000-4000-a680-000000000103'), 0,
  'constat 1 : alerte d''un voyage du site A invisible malgre le camion du site B');
SELECT is((SELECT count(*)::integer FROM public.alerts WHERE regle = 'action_corrective_retard' AND reference_id = '00000000-0000-4000-a680-0000000000f2'), 0,
  'constat 1 : alerte d''action corrective d''un incident du site A invisible malgre le camion du site B');
SELECT throws_ok($$SELECT public.prendre_en_compte_alerte((SELECT id FROM al_voyage))$$, '42501', 'Alerte introuvable ou hors de votre perimetre',
  'constat 1 : alerte du voyage non traitable par le site B');
SELECT throws_ok($$SELECT public.actualiser_alertes(true)$$, '42501', NULL, 'constat 3 : actualisation forcee reservee a l''administrateur');
SELECT is((SELECT count(*)::integer FROM public.alertes_actualisation), 0, 'heure d''actualisation illisible hors administration');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a680-000000000002');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE al AS SELECT id FROM public.alerts WHERE reference_id = '00000000-0000-4000-a680-0000000000d1';
GRANT SELECT ON al TO authenticated;
SELECT is((SELECT priorite FROM public.centre_decisions() WHERE alerte_id = (SELECT id FROM al)), 3, 'centre des decisions : avertissement en priorite 3');
SELECT throws_ok($$SELECT public.resoudre_alerte((SELECT id FROM al), '  ')$$, '22023', NULL, 'resolution sans motif refusee');
SELECT lives_ok($$SELECT public.prendre_en_compte_alerte((SELECT id FROM al))$$, 'alerte prise en compte');
SELECT lives_ok($$SELECT public.resoudre_alerte((SELECT id FROM al), 'Piece commandee, suivi Neemba')$$, 'alerte resolue avec motif');
SELECT is((SELECT status || ' ' || (resolue_par = '00000000-0000-4000-a680-000000000002')::text FROM public.alerts WHERE id = (SELECT id FROM al)),
  'resolved true', 'resolution tracee (auteur)');
SELECT pg_temp.actualiser();
SELECT is((SELECT count(*)::integer FROM public.alerts WHERE regle = 'immobilisation_longue' AND reference_id = '00000000-0000-4000-a680-0000000000d1'), 1,
  'alerte resolue : pas recreee pour le meme objet');
SELECT is((SELECT count(*)::integer FROM public.centre_decisions() WHERE alerte_id = (SELECT id FROM al)), 0, 'alerte resolue absente du centre');
SELECT is((SELECT count(*)::integer FROM public.alerts WHERE regle = 'voyage_sans_ticket' AND reference_id = '00000000-0000-4000-a680-000000000103'), 1,
  'compte global : alerte du voyage visible');
SELECT is((SELECT count(*)::integer FROM public.centre_decisions() WHERE nature = 'validation' AND objet = 'Action corrective en retard'
            AND reference = (SELECT numero FROM public.incidents WHERE id = '00000000-0000-4000-a680-0000000000f1')), 0,
  'alerte ouverte de l''action : la decision n''est pas comptee deux fois');
SELECT lives_ok($$SELECT public.resoudre_alerte((SELECT id FROM al_action), 'Suivi en comite HSE')$$, 'alerte de l''action resolue');
SELECT is((SELECT count(*)::integer FROM public.mes_validations() WHERE objet_id = '00000000-0000-4000-a680-0000000000f2'), 1,
  'mes_validations expose l''identifiant de l''action');
SELECT is((SELECT count(*)::integer FROM public.centre_decisions() WHERE nature = 'validation' AND objet = 'Action corrective en retard'
            AND reference = (SELECT numero FROM public.incidents WHERE id = '00000000-0000-4000-a680-0000000000f1')), 1,
  'constat 2 : alerte resolue, l''action encore ouverte revient dans le centre');
RESET ROLE;

-- 3. Controle avant depart non conforme, condition levee, regle desactivee
SELECT pg_temp.se_connecter('00000000-0000-4000-a680-000000000001');
SET LOCAL ROLE authenticated;
UPDATE public.points_controle_depart SET actif = false;
INSERT INTO public.points_controle_depart (id, libelle, categorie, bloquant, ordre) VALUES
  ('00000000-0000-4000-a680-0000000000e1', 'Freins D-068', 'freinage', true, 1);
SELECT public.enregistrer_controle_depart('00000000-0000-4000-a680-0000000000b2',
  '[{"point": "00000000-0000-4000-a680-0000000000e1", "resultat": "non_conforme", "observation": "Fuite"}]'::jsonb, p_date => now() - interval '2 hours');
SELECT pg_temp.actualiser();
CREATE TEMP TABLE ac AS SELECT id FROM public.alerts WHERE regle = 'controle_non_conforme' AND vehicle_id = '00000000-0000-4000-a680-0000000000b2';
GRANT SELECT ON ac TO authenticated;
SELECT is((SELECT count(*)::integer FROM ac), 1, 'controle non conforme : alerte critique creee');
SELECT is((SELECT priorite FROM public.centre_decisions() WHERE alerte_id = (SELECT id FROM ac)), 1, 'alerte critique en priorite 1');
SELECT ok((SELECT message FROM public.alerts WHERE id = (SELECT id FROM ac)) LIKE '%Freins D-068 : Fuite%', 'message issu des points releves');
SELECT public.enregistrer_controle_depart('00000000-0000-4000-a680-0000000000b2',
  '[{"point": "00000000-0000-4000-a680-0000000000e1", "resultat": "conforme"}]'::jsonb, p_date => now() - interval '1 hour');
SELECT pg_temp.actualiser();
SELECT ok((SELECT condition_levee_le IS NOT NULL AND status = 'active' FROM public.alerts WHERE id = (SELECT id FROM ac)),
  'nouveau controle conforme : condition levee, alerte maintenue jusqu''a resolution');
INSERT INTO public.settings (key, value, category) VALUES ('alerte_controle_non_conforme_active', '{"value": "false"}', 'alertes');
SELECT public.enregistrer_controle_depart('00000000-0000-4000-a680-0000000000b1',
  '[{"point": "00000000-0000-4000-a680-0000000000e1", "resultat": "non_conforme", "observation": "Fuite"}]'::jsonb, p_date => now() - interval '30 minutes');
SELECT pg_temp.actualiser();
SELECT is((SELECT count(*)::integer FROM public.alerts WHERE regle = 'controle_non_conforme' AND vehicle_id = '00000000-0000-4000-a680-0000000000b1'), 0,
  'regle desactivee par reglage : aucune alerte');

-- 4. Indicateurs de pilotage filtres
CREATE TEMP TABLE kv AS SELECT * FROM public.indicateurs_pilotage('2001-04-01', '2001-04-30', NULL, p_vehicule => '00000000-0000-4000-a680-0000000000b1');
CREATE TEMP TABLE kp AS SELECT * FROM public.indicateurs_pilotage('2001-04-01', '2001-04-30', NULL, p_partenaire => ' transports KALOUM ');
CREATE TEMP TABLE ks AS SELECT * FROM public.indicateurs_pilotage('2001-04-01', '2001-04-30', NULL, p_shift => gen_random_uuid());
SELECT is((SELECT valeur FROM kv WHERE code = 'voyages_livres'), 1::numeric, 'filtre vehicule : voyages du seul engin');
SELECT is((SELECT valeur FROM kp WHERE code = 'tonnes_livrees'), 30.00::numeric, 'filtre partenaire (transporteur, sans casse)');
SELECT is((SELECT fiabilite || ' ' || coalesce(detail, '') FROM ks WHERE code = 'engins_actifs'), 'sans_donnees Filtre shift sans objet pour cet indicateur',
  'filtre shift sans objet : sans donnees avec le motif, jamais une valeur non filtree');
SELECT is((SELECT nature FROM kv WHERE code = 'engins_actifs') || ' ' || (SELECT nature FROM kv WHERE code = 'voyages_livres'), 'instantane periode',
  'nature de chaque indicateur (instantane ou periode)');
CREATE TEMP TABLE kv2 AS SELECT * FROM public.indicateurs_pilotage('2001-04-01', '2001-04-30', NULL, p_vehicule => '00000000-0000-4000-a680-0000000000b2');
SELECT is((SELECT coalesce(valeur::text, 'NULL') FROM kv2 WHERE code = 'heures_immobilisation'), 'NULL',
  'D-072 R3-2 avec filtre vehicule : une immobilisation annulee ne compte aucune heure');
SELECT is((SELECT fiabilite || ' ' || detail FROM kv WHERE code = 'objectif'), 'sans_donnees Filtre véhicule ou partenaire sans objet pour cet indicateur',
  'objectif sans la dimension vehicule : sans donnees avec le motif');
SELECT is((SELECT count(*)::integer FROM public.alertes_actualisation), 1, 'administrateur : heure de la derniere actualisation lisible');
RESET ROLE;
-- R3-6 : un domaine illisible reste masque, avant tout motif de filtre
INSERT INTO public.droits_utilisateur (utilisateur, module, niveau) VALUES
  ('00000000-0000-4000-a680-000000000004', 'fuel', 'aucun'), ('00000000-0000-4000-a680-000000000004', 'vehicles', 'aucun')
ON CONFLICT (utilisateur, module) DO UPDATE SET niveau = EXCLUDED.niveau;
SELECT pg_temp.se_connecter('00000000-0000-4000-a680-000000000004');
SET LOCAL ROLE authenticated;
SELECT is((SELECT fiabilite || ' ' || coalesce(valeur::text, 'NULL') || ' ' || detail
             FROM public.indicateurs_pilotage('2001-04-01', '2001-04-30', NULL, p_vehicule => '00000000-0000-4000-a680-0000000000b1') WHERE code = 'litres_distribues'),
  'sans_donnees NULL Non visible avec vos droits de lecture', 'R3-6 avec filtre vehicule : carburant illisible masque');
SELECT is((SELECT detail FROM public.indicateurs_pilotage('2001-04-01', '2001-04-30', NULL, p_shift => gen_random_uuid()) WHERE code = 'engins_actifs'),
  'Non visible avec vos droits de lecture', 'R3-6 avec filtre shift : le masque prime sur le motif du filtre');
RESET ROLE;

-- 5. EPI
SELECT pg_temp.se_connecter('00000000-0000-4000-a680-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.remettre_epi('00000000-0000-4000-a680-0000000000a1', 'Ibrahima Sow', 'casque', 1, current_date - 10, current_date - 20)$$,
  '22023', NULL, 'echeance anterieure a la remise refusee');
CREATE TEMP TABLE e1 AS SELECT public.remettre_epi('00000000-0000-4000-a680-0000000000a1', 'Ibrahima Sow', 'casque', 1, current_date - 400, current_date - 35) AS id;
GRANT SELECT ON e1 TO authenticated;
SELECT matches((SELECT numero FROM public.dotations_epi WHERE id = (SELECT id FROM e1)), '^EPI-[0-9]{4}-[0-9]{5}$', 'dotation numerotee par le serveur');
SELECT pg_temp.actualiser();
SELECT is((SELECT count(*)::integer FROM public.alerts WHERE regle = 'epi_echu' AND reference_id = (SELECT id FROM e1)), 1, 'echeance atteinte : alerte EPI');
CREATE TEMP TABLE e2 AS SELECT public.remettre_epi('00000000-0000-4000-a680-0000000000a1', '', 'casque', 1, current_date, NULL, p_remplace => (SELECT id FROM e1)) AS id;
SELECT is((SELECT statut FROM public.dotations_epi WHERE id = (SELECT id FROM e1)), 'remplace', 'renouvellement : ancienne dotation remplacee');
SELECT is((SELECT beneficiaire FROM public.dotations_epi WHERE remplace_dotation_id = (SELECT id FROM e1)), 'Ibrahima Sow',
  'renouvellement sans personne designee : beneficiaire repris');
CREATE TEMP TABLE e3 AS SELECT public.remettre_epi('00000000-0000-4000-a680-0000000000a1', '', 'gilet', 1, current_date - 30, NULL,
  p_driver => '00000000-0000-4000-a680-0000000000c1') AS id;
CREATE TEMP TABLE e4 AS SELECT public.remettre_epi('00000000-0000-4000-a680-0000000000a1', 'Mamadou Bah', 'gilet', 1, current_date - 10, NULL,
  p_driver => '00000000-0000-4000-a680-0000000000c1', p_remplace => (SELECT id FROM e3)) AS id;
SELECT is((SELECT beneficiaire FROM public.dotations_epi WHERE id = (SELECT id FROM e4)), 'Mamadou Bah',
  'constat 7 : renouvellement, beneficiaire mis a jour par la saisie');
SELECT lives_ok($$SELECT public.restituer_epi((SELECT id FROM e4), current_date, 'use', 'Fin de chantier')$$, 'restitution d''un EPI');
SELECT throws_ok($$SELECT public.restituer_epi((SELECT id FROM e4), current_date, 'bon')$$, '22023', NULL, 'dotation restituee : close');
CREATE TEMP TABLE e5 AS SELECT public.remettre_epi('00000000-0000-4000-a680-0000000000a1', 'Saisie erronee', 'gants', 2, current_date) AS id;
SELECT throws_ok($$SELECT public.annuler_dotation_epi((SELECT id FROM e5), '  ')$$, '22023', NULL, 'annulation sans motif refusee');
SELECT lives_ok($$SELECT public.annuler_dotation_epi((SELECT id FROM e5), 'Doublon de saisie')$$, 'annulation motivee d''une dotation');
RESET ROLE;
GRANT SELECT ON e2 TO authenticated;
SELECT pg_temp.se_connecter('00000000-0000-4000-a680-000000000005');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.restituer_epi((SELECT id FROM e2), current_date, 'bon')$$, '42501', 'Dotation introuvable ou hors de votre perimetre',
  'dotation d''un autre site : refusee avant toute description');
SELECT throws_ok($$SELECT public.restituer_epi(gen_random_uuid(), current_date, 'bon')$$, '42501', 'Dotation introuvable ou hors de votre perimetre',
  'dotation inexistante : meme message (D-075)');
SELECT throws_ok($$SELECT public.remettre_epi('00000000-0000-4000-a680-0000000000a2', '', 'gants', 1, current_date, p_driver => '00000000-0000-4000-a680-0000000000c1')$$,
  '42501', 'Chauffeur introuvable ou hors de votre perimetre', 'chauffeur d''un autre site refuse (D-075)');
SELECT is((SELECT count(*)::integer FROM public.dotations_epi WHERE site_id = '00000000-0000-4000-a680-0000000000a1'), 0,
  'perimetre : dotations d''un autre site invisibles');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a680-000000000002');
SET LOCAL ROLE authenticated;

-- 6. Registre des risques versionne
CREATE TEMP TABLE r1 AS SELECT public.enregistrer_risque(NULL, '00000000-0000-4000-a680-0000000000a1', 'Renversement de camion', 'Rampe d''acces fosse',
  4, 3, 'Limitation de vitesse, merlon', 'Chef de mine', current_date, current_date + 90) AS id;
GRANT SELECT ON r1 TO authenticated;
SELECT throws_ok($$SELECT public.enregistrer_risque((SELECT id FROM r1), NULL, 'Renversement', 'Rampe', 4, 2, 'Merlon rehausse', 'Chef de mine', current_date)$$,
  '22023', NULL, 'revision sans motif refusee');
SELECT public.enregistrer_risque((SELECT id FROM r1), NULL, 'Renversement de camion', 'Rampe d''acces fosse', 4, 2, 'Merlon rehausse', 'Chef de mine',
  current_date, NULL, 'actif', 'Revue trimestrielle');
SELECT is((SELECT version || ' ' || criticite FROM public.v_risques_courants WHERE id = (SELECT id FROM r1)), '2 8', 'version courante et criticite (gravite x probabilite saisies)');

-- 7. Plans de prevention
CREATE TEMP TABLE p1 AS SELECT public.enregistrer_plan_prevention(NULL, '00000000-0000-4000-a680-0000000000a1', 'Neemba Guinee', 'Atelier de maintenance',
  'Levage, energie electrique', 'Consignation, balisage', current_date, current_date + 30) AS id;
GRANT SELECT ON p1 TO authenticated;
SELECT throws_ok($$SELECT public.signer_plan_prevention((SELECT id FROM p1))$$, '42501', NULL, 'signature refusee sans habilitation');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a680-000000000005');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.annuler_plan_prevention((SELECT id FROM p1), 'Essai')$$, '42501', 'Plan introuvable ou hors de votre perimetre',
  'plan d''un autre site : refuse avant toute description');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a680-000000000003');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::integer FROM public.mes_validations() WHERE objet = 'Plan de prévention à signer'), 1, 'plan a signer dans la boite du directeur');
SELECT lives_ok($$SELECT public.signer_plan_prevention((SELECT id FROM p1))$$, 'signature par une personne habilitee');
SELECT is((SELECT etat || ' ' || signataire FROM public.v_plans_prevention WHERE id = (SELECT id FROM p1)), 'en_vigueur Directeur D-068', 'plan en vigueur, signataire fige');
SELECT throws_ok($$SELECT public.enregistrer_plan_prevention((SELECT id FROM p1), NULL, 'Neemba', 'Atelier', 'Levage', 'Balisage', current_date, current_date + 10)$$,
  '22023', NULL, 'plan signe non modifiable');
CREATE TEMP TABLE p2 AS SELECT public.enregistrer_plan_prevention(NULL, NULL, 'Neemba Guinee', 'Atelier et aire de lavage', 'Levage, glissade',
  'Consignation, balisage, tapis', current_date, current_date + 60, p_remplace => (SELECT id FROM p1)) AS id;
SELECT throws_ok($$SELECT public.enregistrer_plan_prevention(NULL, NULL, 'Neemba', 'Atelier', 'Levage', 'Balisage', current_date, current_date + 10,
  p_remplace => (SELECT id FROM p1))$$, '22023', 'Une nouvelle version existe deja', 'une seule nouvelle version d''un plan');
SELECT is((SELECT count(*)::integer FROM public.mes_validations() WHERE objet_id = (SELECT id FROM p2)), 0,
  'constat 7 : plan non propose a la signature de son redacteur');
SELECT throws_ok($$SELECT public.signer_plan_prevention((SELECT id FROM p2))$$, '42501', NULL, 'constat 7 : le redacteur ne signe pas son plan');
RESET ROLE;
GRANT SELECT ON p2 TO authenticated;
SELECT pg_temp.se_connecter('00000000-0000-4000-a680-000000000001');
SET LOCAL ROLE authenticated;
SELECT public.signer_plan_prevention((SELECT id FROM p2));
SELECT is((SELECT string_agg(version || ':' || etat, ',' ORDER BY version) FROM public.v_plans_prevention WHERE numero = (SELECT numero FROM public.plans_prevention WHERE id = (SELECT id FROM p1))),
  '1:remplace,2:en_vigueur', 'nouvelle version signee : la precedente est remplacee');
RESET ROLE;

-- Contre-revue D-068, constat 1 : qui a modifie le brouillon d'un autre ne le signe pas.
SELECT pg_temp.se_connecter('00000000-0000-4000-a680-000000000002');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE p3 AS SELECT public.enregistrer_plan_prevention(NULL, '00000000-0000-4000-a680-0000000000a1', 'Sous-traitant', 'Aire de lavage',
  'Glissade', 'Tapis', current_date, current_date + 30) AS id;
RESET ROLE;
GRANT SELECT ON p3 TO authenticated;
SELECT pg_temp.se_connecter('00000000-0000-4000-a680-000000000003');
SET LOCAL ROLE authenticated;
SELECT public.enregistrer_plan_prevention((SELECT id FROM p3), NULL, 'Sous-traitant', 'Aire de lavage', 'Glissade', 'Tapis et balisage',
  current_date, current_date + 30);
SELECT is((SELECT count(*)::integer FROM public.mes_validations() WHERE objet_id = (SELECT id FROM p3)), 0,
  'contre-revue 1 : plan modifie non propose a la signature de son modificateur');
SELECT throws_ok($$SELECT public.signer_plan_prevention((SELECT id FROM p3))$$, '42501', NULL,
  'contre-revue 1 : qui a modifie le brouillon ne le signe pas');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a680-000000000001');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.signer_plan_prevention((SELECT id FROM p3))$$, 'contre-revue 1 : un tiers habilite signe');
RESET ROLE;

-- Contre-revue D-068, constat 2 : sans droit de lecture RH, le nom d'un employe n'est pas recopie.
INSERT INTO public.employees (id, employee_number, first_name, last_name, "position", department)
VALUES ('00000000-0000-4000-a680-0000000000e1', 'D068-E1', 'Aissatou', 'Diallo', 'Agent', 'Exploitation') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.droits_utilisateur (utilisateur, module, niveau) VALUES ('00000000-0000-4000-a680-000000000002', 'hr', 'aucun')
ON CONFLICT (utilisateur, module) DO UPDATE SET niveau = EXCLUDED.niveau;
SELECT pg_temp.se_connecter('00000000-0000-4000-a680-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.remettre_epi('00000000-0000-4000-a680-0000000000a1', '', 'gants', 1, current_date,
  p_employee => '00000000-0000-4000-a680-0000000000e1')$$, '22023', 'Beneficiaire requis',
  'contre-revue 2 : sans droit RH, le beneficiaire doit etre saisi (nom de l''employe non lu)');
SELECT lives_ok($$SELECT public.remettre_epi('00000000-0000-4000-a680-0000000000a1', 'Nom saisi', 'gants', 1, current_date,
  p_employee => '00000000-0000-4000-a680-0000000000e1')$$, 'contre-revue 2 : beneficiaire saisi accepte');
RESET ROLE;
DELETE FROM public.droits_utilisateur WHERE utilisateur = '00000000-0000-4000-a680-000000000002' AND module = 'hr';

-- 8. Inspections planifiees, constats et actions correctives
SELECT pg_temp.se_connecter('00000000-0000-4000-a680-000000000002');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE pr AS SELECT public.definir_programme_inspection('00000000-0000-4000-a680-0000000000a1', 'Inspection des pistes', 30, 'Responsable HSE', current_date - 5) AS id;
GRANT SELECT ON pr TO authenticated;
SELECT pg_temp.actualiser();
SELECT is((SELECT count(*)::integer FROM public.alerts a JOIN public.inspections i ON i.id = a.reference_id
            WHERE a.regle = 'inspection_retard' AND i.programme_id = (SELECT id FROM pr)), 1, 'inspection non realisee a la date prevue : alerte');
SELECT throws_ok($$SELECT public.realiser_inspection((SELECT id FROM public.inspections WHERE programme_id = (SELECT id FROM pr) AND statut = 'planifiee'),
  now() - interval '10 days', 'Trop tot')$$, '22023', NULL, 'constat 7 : realisation anterieure a la planification refusee');
SELECT public.realiser_inspection((SELECT id FROM public.inspections WHERE programme_id = (SELECT id FROM pr) AND statut = 'planifiee'), now(),
  'Pistes praticables, un nid de poule', '[{"description": "Nid de poule au PK 3", "gravite": "majeur", "localisation": "PK 3"}]'::jsonb);
SELECT is((SELECT prevue_le - (current_date - 5) FROM public.inspections WHERE programme_id = (SELECT id FROM pr) AND statut = 'planifiee'), 30,
  'occurrence suivante planifiee a la frequence saisie');
CREATE TEMP TABLE ai AS SELECT public.ajouter_action_inspection(
  (SELECT id FROM public.inspections WHERE programme_id = (SELECT id FROM pr) AND statut = 'realisee'), 'Reboucher le nid de poule', 'Terrassement', current_date - 1,
  (SELECT c.id FROM public.constats_inspection c JOIN public.inspections i ON i.id = c.inspection_id WHERE i.programme_id = (SELECT id FROM pr))) AS id;
GRANT SELECT ON ai TO authenticated;
SELECT is((SELECT numero FROM public.v_actions_correctives_en_retard WHERE id = (SELECT id FROM ai)),
  (SELECT numero FROM public.inspections WHERE programme_id = (SELECT id FROM pr) AND statut = 'realisee'), 'action d''inspection en retard, numero de l''inspection');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a680-000000000005');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.solder_action_corrective((SELECT id FROM ai), true, 'Essai')$$, '42501', 'Action introuvable ou hors de votre perimetre',
  'action d''une inspection d''un autre site : refusee avant toute description');
SELECT throws_ok($$SELECT public.solder_action_corrective(gen_random_uuid(), true, 'Essai')$$, '42501', 'Action introuvable ou hors de votre perimetre',
  'action inexistante : meme message (D-075)');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a680-000000000002');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.solder_action_corrective((SELECT id FROM ai), true, 'Rebouchage fait, photo PH-12')$$, 'action d''inspection soldee avec preuve');
SELECT throws_ok($$SELECT public.arreter_programme_inspection((SELECT id FROM pr), ' ')$$, '22023', NULL, 'arret de programme sans motif refuse');
SELECT public.arreter_programme_inspection((SELECT id FROM pr), 'Fin du chantier');
SELECT is((SELECT count(*)::integer FROM public.inspections WHERE programme_id = (SELECT id FROM pr) AND statut = 'planifiee'), 0,
  'programme arrete : occurrence planifiee annulee, aucune suivante');
RESET ROLE;
-- Garde append-only (declencheur, session ouverte, hors SET ROLE) et droit retire par has_table_privilege
SELECT throws_ok($$UPDATE public.constats_inspection SET gravite = 'mineur'$$, '42501', NULL, 'constats non modifiables (garde append-only)');
SELECT ok(NOT has_table_privilege('authenticated', 'public.dotations_epi', 'UPDATE')
          AND NOT has_table_privilege('authenticated', 'public.constats_inspection', 'UPDATE'),
  'aucune modification directe des dotations ni des constats');

SELECT * FROM finish();
ROLLBACK;
