-- Tests (D-091) : cycle de vie des pneus (migration 20261121230000) :
-- carcasse et doublon de serie, creation sans numero, reception, entree,
-- configuration de positions, montage controle, double montage, permutation,
-- demontage, inspection et mesures, usure, alertes, proposition
-- d'immobilisation et Dispatch (D-087), reparation, rechapage et deuxieme
-- cycle, remise en service separee, retour en stock, reforme, couts,
-- absence de km, historique, droits, idempotence, conflit, correction,
-- blocages, pieces jointes. Tout est annule.
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

SELECT plan(117);
DELETE FROM public.settings WHERE key IN ('pneu_blocage_montage_actif', 'pneu_blocage_remise_service_actif', 'pneu_configuration_exigee',
                                          'achats_validation_separee');

-- Acteurs : U1 chef maintenance (ecriture, pas d'approbation), U2 directeur
-- (approbation maintenance), U3 administrateur, U4 chauffeur (lecture),
-- U5 chef maintenance borne au site B, U6 logisticien (achats).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-d091-000000000001', 'maintenance.d091@exemple.invalid'),
  ('00000000-0000-4000-d091-000000000002', 'directeur.d091@exemple.invalid'),
  ('00000000-0000-4000-d091-000000000003', 'admin.d091@exemple.invalid'),
  ('00000000-0000-4000-d091-000000000004', 'chauffeur.d091@exemple.invalid'),
  ('00000000-0000-4000-d091-000000000005', 'maintenance.siteb.d091@exemple.invalid'),
  ('00000000-0000-4000-d091-000000000006', 'logistique.d091@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-d091-0000000000a1', 'Site A D-091', 'depot'),
  ('00000000-0000-4000-d091-0000000000a2', 'Site B D-091', 'depot');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-d091-000000000001', 'maintenance_chief', 'Maintenance D-091', 'active', NULL),
  ('00000000-0000-4000-d091-000000000002', 'director', 'Directeur D-091', 'active', NULL),
  ('00000000-0000-4000-d091-000000000003', 'admin', 'Admin D-091', 'active', NULL),
  ('00000000-0000-4000-d091-000000000004', 'driver', 'Chauffeur D-091', 'active', NULL),
  ('00000000-0000-4000-d091-000000000005', 'maintenance_chief', 'Maintenance site B D-091', 'active', '00000000-0000-4000-d091-0000000000a2'),
  ('00000000-0000-4000-d091-000000000006', 'logistician', 'Logistique D-091', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status, site_id) VALUES
  ('00000000-0000-4000-d091-0000000000b1', 'TEST-D091-1', 'Camion test D-091', 40, 'tipper', 'active', '00000000-0000-4000-d091-0000000000a1'),
  ('00000000-0000-4000-d091-0000000000b2', 'TEST-D091-2', 'Modele sans configuration D-091', 40, 'tipper', 'active', '00000000-0000-4000-d091-0000000000a1');
INSERT INTO public.warehouses (id, name, code, warehouse_type, site_id) VALUES
  ('00000000-0000-4000-d091-0000000000c1', 'Magasin D-091', 'TEST-MAG-D091', 'main', '00000000-0000-4000-d091-0000000000a1');
INSERT INTO public.suppliers (id, supplier_number, supplier_type, company_name) VALUES
  ('00000000-0000-4000-d091-0000000000f1', 'TEST-F-D091', 'parts', 'Fournisseur D-091');

-- 1. Structure et droits -------------------------------------------------------
SELECT has_table('public', 'pneus_configurations', 'configurations de positions');
SELECT has_table('public', 'pneus_interventions', 'interventions');
SELECT has_table('public', 'pneus_inspections', 'inspections detaillees');
SELECT is((SELECT count(*)::int FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relrowsecurity
            AND relname IN ('pneus_configurations', 'pneus_configuration_positions', 'pneus_seuils', 'pneus_criteres_rechapage',
                            'pneus_parametres_journal', 'pneus_interventions', 'pneus_inspections', 'pneus_propositions_immobilisation',
                            'pneus_requetes_client')), 9, 'RLS active sur les neuf tables');
SELECT ok(NOT EXISTS (SELECT 1 FROM unnest(ARRAY['tires', 'pneus_operations', 'pneus_configurations', 'pneus_configuration_positions',
            'pneus_seuils', 'pneus_criteres_rechapage', 'pneus_parametres_journal', 'pneus_interventions', 'pneus_inspections',
            'pneus_propositions_immobilisation', 'pneus_requetes_client']) t
          WHERE has_table_privilege('authenticated', 'public.' || t, 'INSERT') OR has_table_privilege('authenticated', 'public.' || t, 'DELETE')
             OR (t <> 'tires' AND has_table_privilege('authenticated', 'public.' || t, 'UPDATE'))), 'aucune ecriture directe pour authenticated');
SELECT ok(NOT EXISTS (SELECT 1 FROM unnest(ARRAY['tires', 'pneus_configurations', 'pneus_interventions', 'v_pneus_surveillance', 'v_pneus_couts']) t
          WHERE has_table_privilege('anon', 'public.' || t, 'SELECT')), 'anon ne lit rien');
CREATE TEMP TABLE api (f regprocedure);
INSERT INTO api SELECT unnest(ARRAY[
  'public.definir_configuration_pneus(text, text, text, jsonb, text, text)', 'public.retirer_configuration_pneus(uuid, text)',
  'public.definir_seuils_pneus(jsonb, text, uuid)', 'public.desactiver_seuils_pneus(uuid, text)',
  'public.definir_critere_rechapage(text, text, boolean, jsonb, boolean, text)',
  'public.creer_carcasse_pneu(jsonb, uuid, text, text, timestamptz, text)', 'public.corriger_caracteristiques_pneu(uuid, jsonb, text)',
  'public.monter_pneu(uuid, uuid, text, timestamptz, numeric, numeric, numeric, text, text)',
  'public.demonter_pneu(uuid, text, text, uuid, timestamptz, numeric, numeric, text, text)',
  'public.permuter_pneu(uuid, text, timestamptz, numeric, text)', 'public.transferer_pneu(uuid, uuid, text, timestamptz, text)',
  'public.inspecter_pneu_detail(uuid, timestamptz, text, jsonb, numeric, numeric, jsonb, text, numeric, text, text)',
  'public.proposer_immobilisation_pneu(uuid, text, uuid)', 'public.decider_proposition_immobilisation(uuid, boolean, text, text)',
  'public.envoyer_pneu_intervention(uuid, text, text, timestamptz, text, uuid, jsonb, text, text, text)',
  'public.enregistrer_retour_intervention(uuid, uuid, timestamptz, bigint, numeric, text, integer, numeric, text, uuid, text, text)',
  'public.controler_intervention_pneu(uuid, boolean, text)', 'public.decider_remise_en_service_pneu(uuid, text, text)',
  'public.annuler_intervention_pneu(uuid, text)']::regprocedure[]);
SELECT ok(NOT EXISTS (SELECT 1 FROM api WHERE has_function_privilege('anon', f, 'EXECUTE'))
          AND NOT EXISTS (SELECT 1 FROM api WHERE NOT has_function_privilege('authenticated', f, 'EXECUTE')),
  'API : executable par authenticated seulement');
SELECT ok(NOT EXISTS (SELECT 1 FROM api a JOIN pg_proc p ON p.oid = a.f
                       WHERE NOT p.prosecdef OR NOT coalesce(p.proconfig, '{}') @> ARRAY['search_path=""']), 'API en SECURITY DEFINER, search_path vide');
SELECT ok(NOT has_function_privilege('authenticated', 'public.recalculer_pneu(uuid)', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'public.pneu_requete_rejouee(text, text)', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'public.pneu_requete_memoriser(text, text, uuid)', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'public.intervention_pneu_pour_action(uuid)', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'public.journaliser_parametre_pneu(text, uuid, text, jsonb, jsonb, text)', 'EXECUTE'),
  'fonctions internes hors de portee des comptes');
SELECT is((SELECT count(*)::int FROM public.catalogue_regles_alertes() WHERE regle LIKE 'pneu_%'), 13, '13 regles d''alerte pneus au catalogue');

SET LOCAL ROLE authenticated;

-- 2. Parametrage : configuration de positions -------------------------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-d091-000000000001');
SELECT throws_ok($$SELECT public.definir_configuration_pneus('CFG-D091', 'Camion 6x4', 'Camion test D-091', '[{"code": "E1-G", "essieu": 1, "cote": "gauche", "rang": "simple"}]')$$,
  '42501', NULL, 'configuration : reservee a l''approbateur ou a l''administrateur');
SELECT pg_temp.se_connecter('00000000-0000-4000-d091-000000000002');
SELECT throws_ok($$SELECT public.definir_configuration_pneus('CFG-D091', 'Camion 6x4', 'Camion test D-091', '[]')$$,
  '22023', NULL, 'aucune configuration vide ni supposee');
CREATE TEMP TABLE cfg AS SELECT public.definir_configuration_pneus('cfg-d091', 'Camion 6x4 (test)', 'camion test d-091', '[
  {"code": "e1-g", "essieu": 1, "cote": "gauche", "rang": "simple", "dimensions": ["315/80 R22.5"], "ordre": 1},
  {"code": "E1-D", "essieu": 1, "cote": "droite", "rang": "simple", "dimensions": ["315/80 R22.5"], "ordre": 2},
  {"code": "E2-G-EXT", "essieu": 2, "cote": "gauche", "rang": "exterieure", "dimensions": ["315/80 R22.5"], "ordre": 3},
  {"code": "SECOURS", "secours": true, "ordre": 9}]') AS id;
SELECT is((SELECT count(*)::int FROM public.pneus_configuration_positions WHERE configuration_id = (SELECT id FROM cfg) AND actif), 4,
  'configuration : quatre positions, codes normalises');
SELECT is(public.configuration_pneus_engin('00000000-0000-4000-d091-0000000000b1'), (SELECT id FROM cfg), 'engin rattache par son modele');
SELECT is(public.configuration_pneus_engin('00000000-0000-4000-d091-0000000000b2'), NULL::uuid, 'modele sans configuration : aucune supposee');
SELECT is((SELECT count(*)::int FROM public.pneus_parametres_journal WHERE objet_id = (SELECT id FROM cfg)), 1, 'configuration journalisee');
CREATE TEMP TABLE seuil AS SELECT public.definir_seuils_pneus('{"dimension": "315/80 R22.5", "profondeur_min_mm": 11, "ecart_usure_max_mm": 2,
  "mesures_min_projection": 3, "rechapages_max": 2}', 'Seuils fournis pour le test') AS id;
SELECT throws_ok($$SELECT public.definir_seuils_pneus('{"profondeur_min_mm": 3}', 'Sans portee')$$, '23514', NULL,
  'aucun seuil universel (portee requise)');
SELECT lives_ok($$SELECT public.definir_critere_rechapage('carcasse_saine', 'Carcasse sans coupure ni separation', true)$$,
  'critere de rechapage bloquant parametre');

-- 3. Creation de carcasse, doublon, sans numero, entree ---------------------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-d091-000000000001');
CREATE TEMP TABLE p (n text PRIMARY KEY, id uuid);
INSERT INTO p SELECT 'A', public.creer_carcasse_pneu('{"marque": "Michelin", "modele": "X Works", "dimension": "315/80 R22.5",
  "construction": "radiale", "indice_charge": "156/150", "indice_vitesse": "K", "application": "chantier", "date_fabrication": "2026-06-01",
  "prix": 4200000, "prix_source": "facture", "facture": "FAC-FOURN-1", "garantie_mois": 12, "profondeur_initiale_mm": 18}',
  '00000000-0000-4000-d091-0000000000a1', 'mx-0001', NULL, now() - interval '20 days');
SELECT matches((SELECT code_sigtb FROM public.tires WHERE id = (SELECT id FROM p WHERE n = 'A')), '^PN-[0-9]{6}$', 'code SIGTB genere');
SELECT is((SELECT numero_serie || ' ' || status || ' ' || profondeur_initiale_mm FROM public.tires WHERE id = (SELECT id FROM p WHERE n = 'A')),
  'MX-0001 stored 18', 'numero de serie normalise, en stock, profondeur initiale');
SELECT throws_ok($$SELECT public.creer_carcasse_pneu('{"marque": "M", "modele": "X"}', '00000000-0000-4000-d091-0000000000a1', 'MX-0001')$$,
  '23505', NULL, 'doublon de numero de serie refuse');
SELECT throws_ok($$SELECT public.enregistrer_pneu(p_numero => 'mx-0001', p_marque => 'M', p_modele => 'X', p_site => '00000000-0000-4000-d091-0000000000a1')$$,
  '23505', NULL, 'doublon refuse aussi par l''ancienne fonction');
SELECT throws_ok($$SELECT public.creer_carcasse_pneu('{"marque": "M", "modele": "X", "prix": 10}', '00000000-0000-4000-d091-0000000000a1', 'MX-PRIX')$$,
  '22023', NULL, 'prix sans source refuse');
SELECT throws_ok($$SELECT public.creer_carcasse_pneu('{"marque": "M", "modele": "X"}', '00000000-0000-4000-d091-0000000000a1')$$,
  '22023', NULL, 'creation sans numero sans motif refusee');
INSERT INTO p SELECT 'S', public.creer_carcasse_pneu('{"marque": "Bridgestone", "modele": "M840", "dimension": "315/80R22.5"}',
  '00000000-0000-4000-d091-0000000000a1', NULL, 'Marquage illisible a la reception', now() - interval '20 days');
SELECT ok((SELECT tire_number = code_sigtb AND numero_serie IS NULL AND sans_numero_motif IS NOT NULL FROM public.tires WHERE id = (SELECT id FROM p WHERE n = 'S')),
  'sans numero : le code SIGTB sert de numero, motif conserve');
INSERT INTO p SELECT 'B', public.creer_carcasse_pneu('{"marque": "Michelin", "modele": "X Works", "dimension": "315/80 R22.5", "profondeur_initiale_mm": 18}',
  '00000000-0000-4000-d091-0000000000a1', 'MX-0002', NULL, now() - interval '20 days');
INSERT INTO p SELECT 'D', public.creer_carcasse_pneu('{"marque": "Autre", "modele": "Petit", "dimension": "12.00 R24"}',
  '00000000-0000-4000-d091-0000000000a1', 'AU-0001', NULL, now() - interval '20 days');
SELECT is((SELECT nombre FROM public.v_pneus_stock WHERE site_id = '00000000-0000-4000-d091-0000000000a1' AND status = 'stored'
            AND marque = 'MICHELIN' AND dimension = '315/80R22.5'), 2, 'stock calcule : deux Michelin en stock au site A');
SELECT is((SELECT mouvement FROM public.v_pneus_mouvements WHERE tire_id = (SELECT id FROM p WHERE n = 'A')), 'entree', 'entree en stock tracee');

-- 4. Reception depuis un bon de commande (D-067) ----------------------------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-d091-000000000006');
CREATE TEMP TABLE bc AS SELECT public.enregistrer_bon_commande('00000000-0000-4000-d091-0000000000f1', '00000000-0000-4000-d091-0000000000c1',
  '[{"quantite": 1, "prix_unitaire": 3900000, "pneu": {"marque": "Michelin", "modele": "X Works", "dimension": "315/80 R22.5"}}]') AS id;
SELECT public.soumettre_bon_commande((SELECT id FROM bc));
SELECT pg_temp.se_connecter('00000000-0000-4000-d091-000000000003');
SELECT public.decider_bon_commande((SELECT id FROM bc), true);
SELECT pg_temp.se_connecter('00000000-0000-4000-d091-000000000006');
SELECT public.receptionner_bon_commande((SELECT id FROM bc),
  (SELECT jsonb_agg(jsonb_build_object('ligne', id, 'recue', 1, 'pneus', '[{"numero": "mx-0003", "profondeur_mm": 18}]'::jsonb))
     FROM public.purchase_order_items WHERE purchase_order_id = (SELECT id FROM bc)), 'BL-D091');
INSERT INTO p SELECT 'R', id FROM public.tires WHERE tire_number = 'MX-0003';
SELECT ok((SELECT code_sigtb LIKE 'PN-%' AND numero_serie = 'MX-0003' FROM public.tires WHERE id = (SELECT id FROM p WHERE n = 'R')),
  'reception : carcasse codee, numero saisi = numero de serie');
SELECT is((SELECT mouvement FROM public.v_pneus_mouvements WHERE tire_id = (SELECT id FROM p WHERE n = 'R')), 'reception', 'mouvement de reception');
SELECT is((SELECT source || ' ' || deja_compte_achats FROM public.v_pneus_couts WHERE tire_id = (SELECT id FROM p WHERE n = 'R') AND categorie = 'acquisition'),
  'bon_commande true', 'acquisition par bon de commande : deja comptee par les achats');

-- 5. Montage controle, double montage, conflit, idempotence -----------------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-d091-000000000001');
SELECT throws_ok($$SELECT public.monter_pneu((SELECT id FROM p WHERE n = 'A'), '00000000-0000-4000-d091-0000000000b1', 'X9', now() - interval '19 days', 1000)$$,
  '22023', NULL, 'position absente de la configuration refusee');
SELECT throws_ok($$SELECT public.monter_pneu((SELECT id FROM p WHERE n = 'D'), '00000000-0000-4000-d091-0000000000b1', 'E1-G', now() - interval '19 days', 1000)$$,
  '22023', NULL, 'dimension non admise refusee');
CREATE TEMP TABLE m1 AS SELECT public.monter_pneu((SELECT id FROM p WHERE n = 'A'), '00000000-0000-4000-d091-0000000000b1', 'e1-g',
  now() - interval '19 days', 1000, 16, 8.5, NULL, 'cle-montage-d091-0001') AS id;
SELECT is((SELECT status || ' ' || "position" FROM public.tires WHERE id = (SELECT id FROM p WHERE n = 'A')), 'active E1-G', 'montage : pneu monte a sa position');
SELECT is(public.monter_pneu((SELECT id FROM p WHERE n = 'A'), '00000000-0000-4000-d091-0000000000b1', 'E1-G',
  now() - interval '19 days', 1000, 16, 8.5, NULL, 'cle-montage-d091-0001'), (SELECT id FROM m1), 'double soumission : meme resultat');
SELECT is((SELECT count(*)::int FROM public.pneus_operations WHERE tire_id = (SELECT id FROM p WHERE n = 'A') AND type = 'montage'), 1,
  'double soumission : une seule operation');
SELECT throws_ok($$SELECT public.demonter_pneu((SELECT id FROM p WHERE n = 'A'), 'x', 'stored', '00000000-0000-4000-d091-0000000000a1',
  p_cle_client => 'cle-montage-d091-0001')$$, '23505', NULL, 'cle client reutilisee pour une autre operation refusee');
SELECT throws_ok($$SELECT public.monter_pneu((SELECT id FROM p WHERE n = 'A'), '00000000-0000-4000-d091-0000000000b1', 'E1-D', now() - interval '19 days')$$,
  '22023', NULL, 'un pneu = une position : pneu deja monte refuse');
SELECT throws_ok($$SELECT public.monter_pneu((SELECT id FROM p WHERE n = 'B'), '00000000-0000-4000-d091-0000000000b1', 'E1-G', now() - interval '19 days')$$,
  '22023', NULL, 'une position = un pneu : position occupee refusee');
SELECT ok(EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ux_tires_position_montee'), 'conflit concurrent : index unique par position montee');
SELECT is((SELECT count(*)::int FROM public.tires WHERE vehicle_id = '00000000-0000-4000-d091-0000000000b1' AND "position" = 'E1-G'), 1,
  'conflit : un seul pneu a la position');
SELECT lives_ok($$SELECT public.monter_pneu((SELECT id FROM p WHERE n = 'B'), '00000000-0000-4000-d091-0000000000b1', 'E1-D', now() - interval '19 days', 1000, 18)$$,
  'second pneu monte a la position voisine');
SELECT lives_ok($$SELECT public.monter_pneu((SELECT id FROM p WHERE n = 'D'), '00000000-0000-4000-d091-0000000000b2', 'AV G', now() - interval '19 days')$$,
  'engin sans configuration : position libre tant que la configuration n''est pas exigee');

-- 6. Permutation --------------------------------------------------------------------------
SELECT lives_ok($$SELECT public.permuter_pneu((SELECT id FROM p WHERE n = 'A'), 'E1-D', now() - interval '18 days', 1500, 'Usure dissymetrique')$$,
  'permutation acceptee');
SELECT is((SELECT string_agg(t."position", ',' ORDER BY t.numero_serie) FROM public.tires t WHERE t.id IN (SELECT id FROM p WHERE n IN ('A', 'B'))),
  'E1-D,E1-G', 'permutation : positions echangees');
SELECT is((SELECT count(*)::int FROM public.pneus_operations WHERE type = 'permutation' AND operation_liee_id IS NOT NULL
            AND tire_id = (SELECT id FROM p WHERE n = 'B')), 1, 'permutation : operations liees');
SELECT throws_ok($$SELECT public.permuter_pneu((SELECT id FROM p WHERE n = 'A'), 'X9')$$, '22023', NULL, 'permutation vers une position inconnue refusee');
SELECT public.permuter_pneu((SELECT id FROM p WHERE n = 'A'), 'E1-G', now() - interval '18 days', 1500, 'Retour');

-- 7. Inspections, mesures, usure ---------------------------------------------------------------
SELECT throws_ok($$SELECT public.inspecter_pneu_detail((SELECT id FROM p WHERE n = 'A'), now() - interval '17 days', 'mesure')$$,
  '22023', NULL, 'inspection de nature mesure sans mesure refusee');
SELECT throws_ok($$SELECT public.inspecter_pneu_detail((SELECT id FROM p WHERE n = 'A'), now() - interval '17 days', 'releve')$$,
  '22023', NULL, 'nature inconnue refusee');
CREATE TEMP TABLE i1 AS SELECT public.inspecter_pneu_detail((SELECT id FROM p WHERE n = 'A'), now() - interval '17 days', 'mesure',
  '{"ext": 14.5, "centre": 14, "int": 14.2}', NULL, NULL, NULL, 'surveiller', 3000) AS id;
SELECT is((SELECT profondeur_min_mm || ' ' || ecart_mm || ' ' || (pression_bar IS NULL) || ' ' || (temperature_c IS NULL)
             FROM public.pneus_inspections WHERE id = (SELECT id FROM i1)), '14 0.5 true true', 'mesures multi-zones ; pression et temperature non mesurees restent vides');
SELECT ok((SELECT inspecte_le < saisi_le - interval '16 days' FROM public.pneus_inspections WHERE id = (SELECT id FROM i1)),
  'date reelle de l''inspection distincte de la saisie');
SELECT is((SELECT libelle FROM public.v_pneus_usure WHERE tire_id = (SELECT id FROM p WHERE n = 'A')), 'donnees insuffisantes',
  'deux mesures : pas de projection (historique insuffisant)');
SELECT public.inspecter_pneu_detail((SELECT id FROM p WHERE n = 'A'), now() - interval '16 days', 'mesure', '{"ext": 12, "centre": 12.5, "int": 10}',
  8.2, 41, NULL, 'permuter', 5000);
SELECT is((SELECT usure_mm_1000km || ' ' || coalesce(km_restants_projetes::text, 'sous le seuil') FROM public.v_pneus_usure WHERE tire_id = (SELECT id FROM p WHERE n = 'A')),
  '1.500 sous le seuil', 'usure du montage en cours (16 -> 10 mm sur 4000 km) et projection jusqu''au seuil');
SELECT is((SELECT derniere_profondeur_mm FROM public.v_pneus WHERE id = (SELECT id FROM p WHERE n = 'A')), 10::numeric, 'derniere mesure = profondeur minimale des zones');
SELECT is((SELECT ecart_mm FROM public.v_pneus_surveillance WHERE id = (SELECT id FROM p WHERE n = 'A')), 2.5, 'ecart entre zones expose a la surveillance');

-- 8. Defaut critique, alertes, proposition d'immobilisation, Dispatch -------------------------
CREATE TEMP TABLE i2 AS SELECT public.inspecter_pneu_detail((SELECT id FROM p WHERE n = 'B'), now() - interval '16 days', 'observation', NULL, NULL, NULL,
  '[{"code": "COUPURE_FLANC", "gravite": "critique", "description": "Coupure profonde du flanc"}]', 'immobiliser') AS id;
SELECT ok((SELECT defaut_critique FROM public.pneus_inspections WHERE id = (SELECT id FROM i2)), 'defaut critique enregistre');
SELECT is((SELECT statut FROM public.pneus_propositions_immobilisation WHERE tire_id = (SELECT id FROM p WHERE n = 'B')), 'proposee',
  'immobilisation proposee');
SELECT is((SELECT count(*)::int FROM public.immobilisations WHERE vehicle_id = '00000000-0000-4000-d091-0000000000b1'), 0,
  'aucune immobilisation automatique');
SELECT pg_temp.se_connecter('00000000-0000-4000-d091-000000000003');
SELECT public.actualiser_alertes(true);
SELECT is((SELECT severity FROM public.alerts WHERE regle = 'pneu_profondeur' AND vehicle_id = '00000000-0000-4000-d091-0000000000b1'), 'critical',
  'alerte critique : profondeur sous le seuil de la dimension');
SELECT is((SELECT count(*)::int FROM public.alerts WHERE regle = 'pneu_defaut_critique' AND vehicle_id = '00000000-0000-4000-d091-0000000000b1'), 1,
  'alerte de defaut critique');
SELECT is((SELECT count(*)::int FROM public.alerts WHERE regle = 'pneu_usure_irreguliere' AND vehicle_id = '00000000-0000-4000-d091-0000000000b1'), 1,
  'alerte d''usure irreguliere (ecart 2,5 mm > 2 mm)');
SELECT is((SELECT count(*)::int FROM public.alerts WHERE regle = 'pneu_historique_incomplet'
            AND reference_id IN (SELECT o.id FROM public.pneus_operations o WHERE o.tire_id = (SELECT id FROM p WHERE n = 'D'))), 1,
  'alerte d''historique incomplet : montage sans compteur');
SELECT is((SELECT count(*)::int FROM public.alerts WHERE regle = 'pneu_pression'), 0, 'pression : sans plage parametree, aucune alerte');
SELECT pg_temp.se_connecter('00000000-0000-4000-d091-000000000001');
SELECT throws_ok($$SELECT public.decider_proposition_immobilisation((SELECT id FROM public.pneus_propositions_immobilisation
  WHERE tire_id = (SELECT id FROM p WHERE n = 'B')), true, 'Coupure confirmee')$$, '23502', NULL, 'imputation de l''immobilisation choisie, jamais supposee');
CREATE TEMP TABLE immo AS SELECT public.decider_proposition_immobilisation((SELECT id FROM public.pneus_propositions_immobilisation
  WHERE tire_id = (SELECT id FROM p WHERE n = 'B')), true, 'Coupure confirmee', 'exploitant') AS id;
SELECT is((SELECT cause || ' ' || imputation || ' ' || statut FROM public.immobilisations WHERE id = (SELECT id FROM immo)),
  'pneumatique exploitant ouverte', 'decision humaine : immobilisation declaree (cause pneumatique)');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d091-000000000002');
SELECT throws_ok($$INSERT INTO public.trips (reference, planned_date, vehicle_id) VALUES ('TEST-D091-T1', current_date, '00000000-0000-4000-d091-0000000000b1')$$,
  '22023', 'Camion immobilise (pneumatique) : affectation refusee', 'Dispatch (D-087) : engin immobilise pour un pneu refuse');
SET LOCAL ROLE authenticated;

-- 9. Demontage, intervention de reparation, remise en service separee ---------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-d091-000000000001');
SELECT lives_ok($$SELECT public.demonter_pneu((SELECT id FROM p WHERE n = 'B'), 'Coupure du flanc', 'damaged', '00000000-0000-4000-d091-0000000000a1',
  now() - interval '15 days', 5200, 9)$$, 'demontage : pneu a decider');
SELECT is((SELECT status || ' ' || coalesce(vehicle_id::text, 'sans engin') FROM public.tires WHERE id = (SELECT id FROM p WHERE n = 'B')),
  'damaged sans engin', 'demontage : pneu libere de l''engin');
CREATE TEMP TABLE itv AS SELECT public.envoyer_pneu_intervention((SELECT id FROM p WHERE n = 'B'), 'reparation', 'Atelier Pneus Conakry',
  now() - interval '15 days') AS id;
SELECT matches((SELECT numero FROM public.pneus_interventions WHERE id = (SELECT id FROM itv)), '^IPN-[0-9]{4}-[0-9]{5}$', 'intervention numerotee');
SELECT is((SELECT status FROM public.tires WHERE id = (SELECT id FROM p WHERE n = 'B')), 'en_intervention', 'pneu chez le prestataire');
SELECT throws_ok($$SELECT public.monter_pneu((SELECT id FROM p WHERE n = 'B'), '00000000-0000-4000-d091-0000000000b1', 'E1-D')$$,
  '22023', NULL, 'montage refuse pendant l''intervention');
SELECT throws_ok($$SELECT public.envoyer_pneu_intervention((SELECT id FROM p WHERE n = 'B'), 'expertise', 'Autre')$$,
  '22023', NULL, 'une seule intervention ouverte par pneu');
SELECT lives_ok($$SELECT public.enregistrer_retour_intervention((SELECT id FROM itv), '00000000-0000-4000-d091-0000000000a1', now() - interval '14 days',
  350000, 9, 'Vulcanisation du flanc', 3)$$, 'retour de reparation enregistre (cout, garantie)');
SELECT is((SELECT status FROM public.tires WHERE id = (SELECT id FROM p WHERE n = 'B')), 'damaged', 'retour : a controler, pas encore en service');
SELECT pg_temp.se_connecter('00000000-0000-4000-d091-000000000002');
SELECT throws_ok($$SELECT public.decider_remise_en_service_pneu((SELECT id FROM itv), 'remis_en_service')$$, '22023', NULL,
  'decision avant controle refusee');
SELECT pg_temp.se_connecter('00000000-0000-4000-d091-000000000001');
SELECT lives_ok($$SELECT public.controler_intervention_pneu((SELECT id FROM itv), true, 'Etancheite verifiee')$$, 'controle conforme');
SELECT throws_ok($$SELECT public.decider_remise_en_service_pneu((SELECT id FROM itv), 'remis_en_service')$$, '42501', NULL,
  'remise en service : role sans approbation refuse');
SELECT pg_temp.se_connecter('00000000-0000-4000-d091-000000000002');
SELECT lives_ok($$SELECT public.decider_remise_en_service_pneu((SELECT id FROM itv), 'remis_en_service', 'Controle conforme')$$,
  'remise en service par un approbateur distinct');
SELECT is((SELECT status FROM public.tires WHERE id = (SELECT id FROM p WHERE n = 'B')), 'stored', 'retour en stock apres decision');
SELECT is((SELECT nature FROM public.v_pneus_episodes WHERE tire_id = (SELECT id FROM p WHERE n = 'B') ORDER BY numero_episode DESC LIMIT 1),
  'apres_reparation', 'nouvel episode apres reparation, meme carcasse');
SELECT is(public.pneu_defaut_critique_ouvert((SELECT id FROM p WHERE n = 'B')), NULL::uuid, 'defaut critique leve par l''intervention');

-- 10. Rechapage, criteres, deuxieme cycle, plafond -----------------------------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-d091-000000000001');
SELECT throws_ok($$SELECT public.envoyer_pneu_intervention((SELECT id FROM p WHERE n = 'B'), 'rechapage', 'Rechapeur')$$,
  '22023', NULL, 'rechapage : critere d''acceptation non renseigne refuse');
SELECT throws_ok($$SELECT public.envoyer_pneu_intervention((SELECT id FROM p WHERE n = 'B'), 'rechapage', 'Rechapeur',
  p_criteres => '{"CARCASSE_SAINE": false}')$$, '22023', NULL, 'carcasse refusee : critere bloquant non satisfait');
CREATE TEMP TABLE r1 AS SELECT public.envoyer_pneu_intervention((SELECT id FROM p WHERE n = 'B'), 'rechapage', 'Rechapeur',
  p_criteres => '{"CARCASSE_SAINE": true}') AS id;
SELECT is((SELECT cycle_rechapage FROM public.pneus_interventions WHERE id = (SELECT id FROM r1)), 1, 'premier cycle de rechapage');
SELECT pg_temp.se_connecter('00000000-0000-4000-d091-000000000002');
SELECT public.enregistrer_retour_intervention((SELECT id FROM r1), '00000000-0000-4000-d091-0000000000a1', now(), 1800000, 16);
SELECT public.controler_intervention_pneu((SELECT id FROM r1), true);
SELECT throws_ok($$SELECT public.decider_remise_en_service_pneu((SELECT id FROM r1), 'remis_en_service')$$, '42501', NULL,
  'separation des taches : l''auteur du retour et du controle ne decide pas');
SELECT pg_temp.se_connecter('00000000-0000-4000-d091-000000000003');
SELECT public.decider_remise_en_service_pneu((SELECT id FROM r1), 'remis_en_service', 'Rechapage conforme');
SELECT is((SELECT nature || ' ' || cycle_rechapage FROM public.v_pneus_episodes WHERE tire_id = (SELECT id FROM p WHERE n = 'B') ORDER BY numero_episode DESC LIMIT 1),
  'apres_rechapage 1', 'episode apres rechapage 1');
SELECT pg_temp.se_connecter('00000000-0000-4000-d091-000000000001');
CREATE TEMP TABLE r2 AS SELECT public.envoyer_pneu_intervention((SELECT id FROM p WHERE n = 'B'), 'rechapage', 'Rechapeur', now(),
  p_criteres => '{"CARCASSE_SAINE": true}') AS id;
SELECT public.enregistrer_retour_intervention((SELECT id FROM r2), '00000000-0000-4000-d091-0000000000a1', now(), 1700000, 15);
SELECT public.controler_intervention_pneu((SELECT id FROM r2), true);
SELECT pg_temp.se_connecter('00000000-0000-4000-d091-000000000002');
SELECT public.decider_remise_en_service_pneu((SELECT id FROM r2), 'remis_en_service', 'Deuxieme rechapage conforme');
SELECT is((SELECT retread_count FROM public.tires WHERE id = (SELECT id FROM p WHERE n = 'B')), 2, 'deuxieme cycle de rechapage');
SELECT is((SELECT count(*)::int FROM public.tires WHERE numero_serie = 'MX-0002'), 1, 'un rechapage ne cree jamais de nouvelle carcasse');
SELECT is((SELECT string_agg(nature, ',' ORDER BY numero_episode) FROM public.v_pneus_episodes WHERE tire_id = (SELECT id FROM p WHERE n = 'B')),
  'neuf,apres_reparation,apres_rechapage,apres_rechapage', 'episodes successifs de la carcasse');
SELECT pg_temp.se_connecter('00000000-0000-4000-d091-000000000001');
SELECT throws_ok($$SELECT public.envoyer_pneu_intervention((SELECT id FROM p WHERE n = 'B'), 'rechapage', 'Rechapeur', now(),
  p_criteres => '{"CARCASSE_SAINE": true}')$$, '22023', 'Nombre admissible de rechapages atteint (2)', 'plafond de rechapages parametre');

-- 11. Couts, absence de km, historique -----------------------------------------------------
SELECT is((SELECT acquisition || ' ' || coalesce(reparation::text, '-') || ' ' || coalesce(rechapage::text, '-') || ' ' || coalesce(total::text, 'NULL')
             FROM public.v_pneus_couts_synthese WHERE tire_id = (SELECT id FROM p WHERE n = 'A')), '4200000 - - 4200000', 'couts : acquisition depuis la facture');
SELECT is((SELECT coalesce(acquisition::text, '-') || ' ' || reparation || ' ' || rechapage || ' ' || coalesce(total::text, 'NULL') || ' ' || couts_inconnus
             FROM public.v_pneus_couts_synthese WHERE tire_id = (SELECT id FROM p WHERE n = 'B')),
  '- 350000 3500000 NULL 1', 'couts par categorie ; prix d''achat inconnu : total non calcule');
SELECT is((SELECT cout_km IS NULL AND libelle_km = 'donnees insuffisantes' AND libelle_heure = 'donnees insuffisantes'
             AND libelle_tonne = 'donnees insuffisantes' FROM public.v_pneus_indicateurs WHERE tire_id = (SELECT id FROM p WHERE n = 'D')), true,
  'absence de km, d''heures et de tonnes : donnees insuffisantes, rien d''estime');
SELECT is((SELECT string_agg(mouvement, ',' ORDER BY effectue_le, saisi_le) FROM public.v_pneus_mouvements WHERE tire_id = (SELECT id FROM p WHERE n = 'B')),
  'entree,montage,permutation,permutation,demontage,envoi_reparation,retour_reparation,remise_en_service,envoi_rechapage,retour_rechapage,remise_en_service,envoi_rechapage,retour_rechapage,remise_en_service',
  'historique complet des mouvements');

-- 12. Reforme et correction -------------------------------------------------------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-d091-000000000001');
CREATE TEMP TABLE cor AS SELECT public.corriger_caracteristiques_pneu((SELECT id FROM p WHERE n = 'S'), '{"numero_serie": "bs-9999", "indice_vitesse": "L"}',
  'Numero lu apres nettoyage') AS id;
SELECT is((SELECT tire_number || ' ' || numero_serie || ' ' || indice_vitesse FROM public.tires WHERE id = (SELECT id FROM p WHERE n = 'S')),
  'BS-9999 BS-9999 L', 'correction motivee : numero de serie pose');
SELECT is((SELECT (donnees -> 'avant' ->> 'numero_serie') IS NULL AND donnees -> 'apres' ->> 'numero_serie' = 'BS-9999'
             FROM public.pneus_operations WHERE id = (SELECT id FROM cor)), true, 'correction tracee avant et apres');
SELECT throws_ok($$SELECT public.annuler_operation_pneu((SELECT id FROM cor), 'Erreur')$$, '22023', NULL,
  'une correction ne s''annule pas : nouvelle correction');
SELECT throws_ok($$SELECT public.corriger_caracteristiques_pneu((SELECT id FROM p WHERE n = 'S'), '{"code_sigtb": "PN-1"}', 'x')$$, '22023', NULL,
  'le code SIGTB ne se corrige pas');
SELECT lives_ok($$SELECT public.annuler_operation_pneu((SELECT id FROM public.pneus_operations WHERE tire_id = (SELECT id FROM p WHERE n = 'D') AND type = 'montage'),
  'Montage saisi sur le mauvais engin')$$, 'operation compensatoire : montage annule avec motif');
SELECT is((SELECT status FROM public.tires WHERE id = (SELECT id FROM p WHERE n = 'D')), 'stored', 'annulation : le pneu revient en stock');
SELECT lives_ok($$SELECT public.reformer_pneu((SELECT id FROM p WHERE n = 'D'), 'Carcasse hors d''usage')$$, 'reforme definitive motivee');
SELECT throws_ok($$SELECT public.envoyer_pneu_intervention((SELECT id FROM p WHERE n = 'D'), 'expertise', 'Expert')$$, '22023', NULL,
  'pneu reforme : plus aucune operation');
SELECT throws_ok($$DELETE FROM public.tires WHERE id = (SELECT id FROM p WHERE n = 'D')$$, '42501', NULL, 'aucune suppression physique d''une carcasse');

-- 13. Transfert, permissions, perimetre ------------------------------------------------------
SELECT lives_ok($$SELECT public.transferer_pneu((SELECT id FROM p WHERE n = 'S'), '00000000-0000-4000-d091-0000000000a2', 'Reequilibrage des stocks')$$,
  'transfert entre sites');
SELECT is((SELECT site_id FROM public.tires WHERE id = (SELECT id FROM p WHERE n = 'S')), '00000000-0000-4000-d091-0000000000a2'::uuid, 'transfert : site de destination');
SELECT pg_temp.se_connecter('00000000-0000-4000-d091-000000000004');
SELECT throws_ok($$SELECT public.creer_carcasse_pneu('{"marque": "M", "modele": "X"}', '00000000-0000-4000-d091-0000000000a1', 'DRV-1')$$,
  '42501', NULL, 'chauffeur : creation refusee');
SELECT throws_ok($$SELECT public.inspecter_pneu_detail((SELECT id FROM p WHERE n = 'A'), now(), 'mesure', '{"c": 9}')$$,
  '42501', NULL, 'chauffeur : inspection refusee');
SELECT pg_temp.se_connecter('00000000-0000-4000-d091-000000000005');
SELECT throws_ok($$SELECT public.inspecter_pneu_detail((SELECT id FROM p WHERE n = 'A'), now(), 'mesure', '{"c": 9}')$$,
  '42501', NULL, 'compte d''un autre site : pneu hors perimetre');
SELECT is((SELECT count(*)::int FROM public.pneus_interventions WHERE tire_id = (SELECT id FROM p WHERE n = 'B')), 0,
  'perimetre : interventions d''un autre site illisibles');
SELECT throws_ok($$SELECT public.definir_seuils_pneus('{"marque": "X", "profondeur_min_mm": 3}', 'test')$$, '42501', NULL,
  'seuils : parametrage refuse a un compte borne');

-- 14. Blocages configures (desactives par defaut) -------------------------------------------
RESET ROLE;
INSERT INTO public.settings (key, value, category) VALUES ('pneu_blocage_montage_actif', '{"value": "true"}', 'pneus'),
  ('pneu_blocage_remise_service_actif', '{"value": "true"}', 'pneus'), ('pneu_configuration_exigee', '{"value": "true"}', 'pneus');
SELECT throws_ok($$INSERT INTO public.settings (key, value) VALUES ('alerte_pneu_profondeur_active', '{"value": "oui"}')$$, '22023', NULL,
  'reglage d''alerte pneus : booleen controle');
SET LOCAL ROLE authenticated;
SELECT pg_temp.se_connecter('00000000-0000-4000-d091-000000000001');
INSERT INTO p SELECT 'U', public.creer_carcasse_pneu('{"marque": "Michelin", "modele": "X Works", "dimension": "315/80 R22.5", "profondeur_initiale_mm": 9}',
  '00000000-0000-4000-d091-0000000000a1', 'MX-USE', NULL);
SELECT throws_ok($$SELECT public.monter_pneu((SELECT id FROM p WHERE n = 'U'), '00000000-0000-4000-d091-0000000000b1', 'E2-G-EXT')$$,
  '22023', 'Blocage de securite : profondeur 9 mm sous le seuil 11 mm', 'blocage actif : montage d''un pneu sous le seuil refuse');
SELECT throws_ok($$SELECT public.monter_pneu((SELECT id FROM p WHERE n = 'R'), '00000000-0000-4000-d091-0000000000b2', 'AV D')$$,
  '22023', NULL, 'configuration exigee : engin sans configuration refuse');
SELECT throws_ok($$SELECT public.reparer_pneu((SELECT id FROM p WHERE n = 'B'), '00000000-0000-4000-d091-0000000000a1')$$,
  '22023', NULL, 'blocage actif : remise en service directe refusee');

-- 15. Pieces jointes et reintegration ----------------------------------------------------------
SELECT ok((public.enregistrer_piece_jointe('pneu_intervention', (SELECT id FROM itv), 'bon-atelier.pdf', 'application/pdf', 2048) ->> 'chemin')
            LIKE 'pneu_intervention/%', 'piece jointe sur une intervention de pneu');
SELECT ok((public.enregistrer_piece_jointe('pneu_inspection', (SELECT id FROM i2), 'flanc.jpg', 'image/jpeg', 4096) ->> 'chemin')
            LIKE 'pneu_inspection/%', 'piece jointe sur une inspection');
SELECT is((SELECT count(*)::int FROM public.pieces_jointes WHERE objet_type IN ('pneu_intervention', 'pneu_inspection')), 2, 'pieces jointes lisibles');
SELECT public.cloturer_immobilisation((SELECT id FROM immo), now() + interval '1 minute', 'Pneu remplace');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d091-000000000002');
SELECT lives_ok($$INSERT INTO public.trips (reference, planned_date, vehicle_id) VALUES ('TEST-D091-T2', current_date, '00000000-0000-4000-d091-0000000000b1')$$,
  'reintegration : apres cloture de l''immobilisation, l''engin est de nouveau affectable');

SELECT * FROM finish();
ROLLBACK;
