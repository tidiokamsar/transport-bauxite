-- Tests (D-081) : pesee a deux sources (migration 20261121180000). Source A :
-- releve officiel CBG importe (empreinte, colonnes, doublons, annulation) ;
-- source B : releve terrain KOGON (resynchronisation idempotente, correction
-- tracee) ; rapprochement multi-constats, anomalies et separation des taches,
-- reconciliation alimentee par le releve officiel, perimetre de site, droits.
-- Periode d'octobre 2001, vide en production. Tout est annule.
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

SELECT plan(70);

-- Droits : fonctions fermees a anon, internes fermees aux comptes, aucune ecriture directe
SELECT is((SELECT count(*)::int FROM unnest(ARRAY[
    'public.importer_releve_cbg_v2(text, date, date, uuid, text, text, jsonb, jsonb)',
    'public.annuler_releve_cbg(uuid, text)',
    'public.saisir_releve_terrain_kogon(uuid, uuid, uuid, jsonb)',
    'public.definir_tolerance_pesee(uuid, numeric, numeric, text)',
    'public.tolerance_pesee_applicable(uuid)',
    'public.rapprocher_pesees(uuid)',
    'public.agir_anomalie_pesee(uuid, text, text, text, uuid)']) f
  WHERE has_function_privilege('anon', f, 'EXECUTE') OR NOT has_function_privilege('authenticated', f, 'EXECUTE')), 0,
  'fonctions de pesee : executables par authenticated seulement');
SELECT is((SELECT count(*)::int FROM unnest(ARRAY['public.releve_cbg_engage(uuid)', 'public.voyage_reconcilie_clos(uuid)',
    'public.recopier_ticket_kogon()', 'public.recopier_rectification_kogon()']) f
  WHERE has_function_privilege('authenticated', f, 'EXECUTE') OR has_function_privilege('anon', f, 'EXECUTE')), 0,
  'fonctions internes fermees aux comptes');
SELECT is((SELECT count(*)::int FROM unnest(ARRAY['anon', 'authenticated']) u,
    unnest(ARRAY['public.releves_terrain_kogon', 'public.parametres_tolerance_pesee', 'public.passes_rapprochement_pesee',
                 'public.rapprochements_pesee', 'public.anomalies_pesee', 'public.journal_anomalies_pesee',
                 'public.releves_cbg', 'public.releves_cbg_lignes']) t,
    unnest(ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p
  WHERE has_table_privilege(u, t, p)), 0, 'aucune ecriture directe sur les tables de pesee');
SELECT is((SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname IN ('releves_terrain_kogon', 'parametres_tolerance_pesee', 'passes_rapprochement_pesee',
    'rapprochements_pesee', 'anomalies_pesee', 'journal_anomalies_pesee') AND c.relrowsecurity), 6, 'RLS active sur les six tables');
SELECT ok(NOT has_table_privilege('anon', 'public.anomalies_pesee', 'SELECT'), 'anon ne lit pas les anomalies');

-- Donnees
DELETE FROM public.settings WHERE key = 'tolerance_poids_cbg_t';
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-d810-000000000001', 'agent.d810@exemple.invalid'),
  ('00000000-0000-4000-d810-000000000002', 'valideur.d810@exemple.invalid'),
  ('00000000-0000-4000-d810-000000000003', 'borne.d810@exemple.invalid'),
  ('00000000-0000-4000-d810-000000000004', 'sansdroit.d810@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-d810-0000000000a1', 'Mine D810', 'mine'),
  ('00000000-0000-4000-d810-0000000000a2', 'Depot CBG D810', 'depot'),
  ('00000000-0000-4000-d810-0000000000a3', 'Autre D810', 'mine');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-d810-000000000001', 'operations_manager', 'Agent D810', 'active', NULL),
  ('00000000-0000-4000-d810-000000000002', 'operations_manager', 'Valideur D810', 'active', NULL),
  ('00000000-0000-4000-d810-000000000003', 'operations_manager', 'Borne D810', 'active', '00000000-0000-4000-d810-0000000000a3'),
  ('00000000-0000-4000-d810-000000000004', 'operations_manager', 'Sans droit D810', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.droits_utilisateur (utilisateur, module, niveau)
SELECT u, m, 'ecriture' FROM unnest(ARRAY['00000000-0000-4000-d810-000000000001', '00000000-0000-4000-d810-000000000002',
  '00000000-0000-4000-d810-000000000003']::uuid[]) u, unnest(ARRAY['trips', 'invoices', 'settings']) m
ON CONFLICT (utilisateur, module) DO UPDATE SET niveau = EXCLUDED.niveau;
INSERT INTO public.droits_utilisateur (utilisateur, module, niveau)
SELECT '00000000-0000-4000-d810-000000000004', m, 'lecture' FROM unnest(ARRAY['trips', 'invoices', 'settings']) m
ON CONFLICT (utilisateur, module) DO UPDATE SET niveau = EXCLUDED.niveau;
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type) VALUES
  ('00000000-0000-4000-d810-0000000000b1', 'KG-0001-A', 'Test', 60, 'tipper'),
  ('00000000-0000-4000-d810-0000000000b2', 'KG-0002-A', 'Test', 60, 'tipper');
INSERT INTO public.trips (id, reference, planned_date, vehicle_id, departure_site_id, arrival_site_id, etat, net_weight) VALUES
  ('00000000-0000-4000-d810-000000000011', 'TEST-D810-1', '2001-10-03', '00000000-0000-4000-d810-0000000000b1', '00000000-0000-4000-d810-0000000000a1', '00000000-0000-4000-d810-0000000000a2', 'ACCEPTED', 40),
  ('00000000-0000-4000-d810-000000000012', 'TEST-D810-2', '2001-10-03', '00000000-0000-4000-d810-0000000000b2', '00000000-0000-4000-d810-0000000000a1', '00000000-0000-4000-d810-0000000000a2', 'ACCEPTED', 41),
  ('00000000-0000-4000-d810-000000000013', 'TEST-D810-3', '2001-10-04', '00000000-0000-4000-d810-0000000000b1', '00000000-0000-4000-d810-0000000000a1', '00000000-0000-4000-d810-0000000000a2', 'ACCEPTED', 40),
  ('00000000-0000-4000-d810-000000000014', 'TEST-D810-4', '2001-10-05', '00000000-0000-4000-d810-0000000000b2', '00000000-0000-4000-d810-0000000000a1', '00000000-0000-4000-d810-0000000000a2', 'ACCEPTED', 40);
-- Releve KOGON saisi avec la rotation (tickets_pesee_cbg) : recopie dans la source B.
INSERT INTO public.tickets_pesee_cbg (trip_id, site_id, ticket, brut, tare, mesure_le, saisi_par) VALUES
  ('00000000-0000-4000-d810-000000000011', '00000000-0000-4000-d810-0000000000a2', 'K810-1', 60, 20, '2001-10-03 10:00+00', '00000000-0000-4000-d810-000000000001'),
  ('00000000-0000-4000-d810-000000000012', '00000000-0000-4000-d810-0000000000a2', 'K810-2', 61, 20, '2001-10-03 11:00+00', '00000000-0000-4000-d810-000000000001');
INSERT INTO public.contrats (id, reference, intitule, nature, contrepartie, devise, date_debut, statut, delai_paiement_jours)
VALUES ('00000000-0000-4000-d810-0000000000c1', 'TEST-D810-CBG', 'Transport de bauxite', 'client', 'CBG', 'USD', '2001-01-01', 'actif', 30);
SELECT is((SELECT count(*)::int FROM public.releves_terrain_kogon WHERE trip_id = '00000000-0000-4000-d810-000000000011' AND origine = 'rotation'), 1,
  'le releve KOGON saisi avec la rotation est recopie dans la source B');
SELECT throws_ok($$UPDATE public.releves_terrain_kogon SET net = 1 WHERE trip_id = '00000000-0000-4000-d810-000000000011'$$, '42501', NULL,
  'releve KOGON immuable, meme pour le proprietaire des tables');

-- Source B : saisie terrain, resynchronisation, correction
SELECT pg_temp.se_connecter('00000000-0000-4000-d810-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT source FROM public.tolerance_pesee_applicable('00000000-0000-4000-d810-0000000000a2')), 'non_parametree',
  'sans parametre : tolerance non parametree (0)');
SELECT is((public.saisir_releve_terrain_kogon('00000000-0000-4000-d810-0000000000e1', '00000000-0000-4000-d810-0000000000a2',
  '00000000-0000-4000-d810-000000000013', '{"agent":"Agent terrain","ticket":"K810-3","heure_pesee_observee":"2001-10-04T09:00:00Z",
   "immatriculation_observee":"KG-0001-A","chauffeur_observe":"Chauffeur X","net":"40","observations":"RAS"}') ->> 'deja_enregistre'), 'false',
  'releve terrain KOGON enregistre');
SELECT is((public.saisir_releve_terrain_kogon('00000000-0000-4000-d810-0000000000e1', '00000000-0000-4000-d810-0000000000a2',
  '00000000-0000-4000-d810-000000000013', '{"ticket":"K810-3","net":"40"}') ->> 'deja_enregistre'), 'true',
  'resynchronisation du meme identifiant : ligne existante renvoyee');
SELECT is((SELECT count(*)::int FROM public.releves_terrain_kogon WHERE client_id = '00000000-0000-4000-d810-0000000000e1'), 1,
  'aucun doublon apres resynchronisation');
SELECT lives_ok($$SELECT public.saisir_releve_terrain_kogon('00000000-0000-4000-d810-0000000000e2', '00000000-0000-4000-d810-0000000000a2', NULL,
  '{"ticket":"K810-4","heure_pesee_observee":"2001-10-05T08:00:00Z","net":"39"}')$$, 'releve KOGON sans rotation accepte');
SELECT lives_ok($$SELECT public.saisir_releve_terrain_kogon('00000000-0000-4000-d810-0000000000e3', '00000000-0000-4000-d810-0000000000a2', NULL,
  '{"ticket":"K810-5","heure_pesee_observee":"2001-10-05T09:00:00Z","brut":"58","tare":"20","anomalie_signalee":true,"anomalie_texte":"Ticket illisible"}')$$,
  'releve KOGON avec anomalie signalee par l''agent');
SELECT lives_ok($$SELECT public.saisir_releve_terrain_kogon('00000000-0000-4000-d810-0000000000e4', '00000000-0000-4000-d810-0000000000a2',
  '00000000-0000-4000-d810-000000000014', '{"ticket":"K810-8","heure_pesee_observee":"2001-10-05T10:00:00Z","net":"40"}')$$, 'releve KOGON du voyage 4');
SELECT throws_ok($$SELECT public.saisir_releve_terrain_kogon(gen_random_uuid(), '00000000-0000-4000-d810-0000000000a2', NULL,
  '{"ticket":"K810-X","brut":"20","tare":"30"}')$$, '22023', NULL, 'brut inferieur a la tare refuse');
SELECT throws_ok($$SELECT public.saisir_releve_terrain_kogon(gen_random_uuid(), '00000000-0000-4000-d810-0000000000a2', NULL,
  '{"ticket":"K810-X","net":"40","anomalie_signalee":true}')$$, '22023', NULL, 'anomalie signalee sans description refusee');
SELECT throws_ok($$SELECT public.saisir_releve_terrain_kogon(gen_random_uuid(), '00000000-0000-4000-d810-0000000000a3',
  '00000000-0000-4000-d810-000000000013', '{"ticket":"K810-X","net":"40"}')$$, '22023', NULL, 'site etranger au voyage refuse');
RESET ROLE;

-- Tolerance : 0,5 t globale (version 1)
SELECT pg_temp.se_connecter('00000000-0000-4000-d810-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.definir_tolerance_pesee(NULL, 0.5, NULL, ' ')$$, '22023', NULL, 'tolerance sans motif refusee');
SELECT lives_ok($$SELECT public.definir_tolerance_pesee(NULL, 0.5, NULL, 'Tolerance convenue avec CBG (test)')$$, 'tolerance globale definie');
SELECT is((SELECT (tolerance_t, source)::text FROM public.tolerance_pesee_applicable('00000000-0000-4000-d810-0000000000a2')), '(0.5,global)',
  'repli sur la tolerance globale');
RESET ROLE;

-- Source A : import du releve officiel
SELECT pg_temp.se_connecter('00000000-0000-4000-d810-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.importer_releve_cbg_v2('CBG-D810-ERR', '2001-10-01', '2001-10-31', '00000000-0000-4000-d810-0000000000a2', 'x.csv',
  repeat('0', 64), '[{"ticket":"K810-1","net":"40"}]')$$, '22023', NULL, 'import refuse : colonne date manquante');
SELECT throws_ok($$SELECT public.importer_releve_cbg_v2('CBG-D810-ERR', '2001-10-01', '2001-10-31', '00000000-0000-4000-d810-0000000000a2', 'x.csv',
  repeat('0', 64), '[{"ticket":"K810-1","date":"2001-10-03"}]')$$, '22023', NULL, 'import refuse : colonnes de poids manquantes');
SELECT throws_ok($$SELECT public.importer_releve_cbg_v2('CBG-D810-ERR', '2001-10-01', '2001-10-31', '00000000-0000-4000-d810-0000000000a2', 'x.csv',
  'pas-une-empreinte', '[{"ticket":"K810-1","date":"2001-10-03","net":"40"}]')$$, '22023', NULL, 'import refuse sans empreinte SHA-256');
CREATE TEMP TABLE imp AS SELECT public.importer_releve_cbg_v2('CBG-D810-10', '2001-10-01', '2001-10-31', '00000000-0000-4000-d810-0000000000a2',
  'releve-octobre.csv', repeat('a', 64),
  '[{"ticket":"K810-1","date":"2001-10-03","immatriculation":"KG 0001 A","brut":"60","tare":"20"},
    {"ticket":"K810-2","date":"2001-10-03","immatriculation":"KG-0002-A","net":"43"},
    {"ticket":"K810-3","date":"2001-10-04","immatriculation":"KG-0002-A","net":"40.2"},
    {"ticket":"K810-4","date":"2001-10-05","immatriculation":"KG-0002-A","net":"39"},
    {"ticket":"K810-6","date":"2001-10-04","immatriculation":"KG-0001-A","net":"40"},
    {"ticket":"k810-1","date":"2001-10-03","immatriculation":"KG-0001-A","net":"40"},
    {"ticket":"K810-7","date":"2001-10-05","immatriculation":"ZZ-9999","net":"40"},
    {"ticket":"","date":"2001-10-05","net":"40"},
    {"ticket":"K810-8","date":"2001-10-05","immatriculation":"KG-0002-A","net":"40.3"}]',
  '[{"rang":10,"motif":"Ligne vide"}]') AS rapport;
GRANT SELECT ON imp TO authenticated;
SELECT is((SELECT (rapport ->> 'acceptees', rapport ->> 'rejetees', rapport ->> 'doublons_inter_releves')::text FROM imp), '(9,1,0)',
  'rapport d''import : lignes acceptees, rejetees, doublons');
SELECT ok((SELECT empreinte_sha256 = repeat('a', 64) AND lignes_rejetees @> '[{"motif":"Ligne vide"}]' AND piece_id IS NULL
  FROM public.releves_cbg WHERE reference = 'CBG-D810-10'), 'empreinte et lignes rejetees conservees, piece a venir');
SELECT throws_ok($$SELECT public.importer_releve_cbg_v2('CBG-D810-10-BIS', '2001-10-01', '2001-10-31', '00000000-0000-4000-d810-0000000000a2',
  'copie.csv', repeat('a', 64), '[{"ticket":"K810-1","date":"2001-10-03","net":"40"}]')$$, '23505', NULL, 'meme fichier : re-import refuse');
SELECT throws_ok($$UPDATE public.releves_cbg_lignes SET net = 1 WHERE ticket = 'K810-2'$$, '42501', NULL, 'valeur officielle CBG non modifiable');

-- Rapprochement : plusieurs constats par ligne, aucune cascade
SELECT is((SELECT string_agg(classe || '=' || nombre, ',' ORDER BY classe)
  FROM public.rapprocher_pesees((SELECT (rapport ->> 'releve_id')::uuid FROM imp))),
  'camion_non_reconnu=2,concordant=1,concordant_avec_reserve=1,donnees_incompletes=1,ecart_poids=1,fiche_sans_ticket=1,rotation_non_retrouvee=3,ticket_duplique=1,ticket_sans_fiche=2',
  'rapprochement : chaque classe attendue');
CREATE TEMP TABLE rp AS SELECT * FROM public.v_rapprochements_pesee_courants WHERE releve_id = (SELECT (rapport ->> 'releve_id')::uuid FROM imp);
GRANT SELECT ON rp TO authenticated;
SELECT is((SELECT classes FROM rp WHERE ticket = 'K810-1' AND date_cbg = '2001-10-03' AND immatriculation_cbg = 'KG 0001 A'), ARRAY['concordant'],
  'concordant : meme ticket, meme poids, meme camion');
SELECT is((SELECT (classes, ecart_t)::text FROM rp WHERE ticket = 'K810-2'), '({ecart_poids},2)', 'ecart de poids au-dela de 0,5 t');
SELECT is((SELECT classes FROM rp WHERE ticket = 'K810-3'), ARRAY['camion_non_reconnu'], 'mauvais camion : CBG et KOGON different');
SELECT is((SELECT classes FROM rp WHERE ticket = 'K810-4'), ARRAY['rotation_non_retrouvee'], 'releve KOGON sans rotation : rotation non retrouvee');
SELECT is((SELECT (classes, cardinality(trips_candidats), trip_id IS NULL)::text FROM rp WHERE ticket = 'K810-6'), '({ticket_sans_fiche},1,t)',
  'ticket sans fiche : rotation candidate proposee, jamais rattachee');
SELECT is((SELECT classes FROM rp WHERE ticket = 'K810-7'), ARRAY['ticket_sans_fiche', 'rotation_non_retrouvee', 'camion_non_reconnu'],
  'plusieurs constats sur une meme ligne');
SELECT is((SELECT classes FROM rp WHERE ticket = 'K810-5'), ARRAY['fiche_sans_ticket', 'rotation_non_retrouvee'], 'fiche KOGON sans ticket CBG');
SELECT is((SELECT classes FROM rp WHERE ticket = 'k810-1'), ARRAY['ticket_duplique'], 'ticket en double dans le releve');
SELECT is((SELECT classes FROM rp WHERE ticket = 'K810-8'), ARRAY['concordant_avec_reserve'], 'ecart non nul dans la tolerance : reserve');
SELECT is((SELECT count(*)::int FROM public.anomalies_pesee WHERE releve_id = (SELECT (rapport ->> 'releve_id')::uuid FROM imp)), 12,
  'une anomalie par constat non concordant');
SELECT lives_ok($$SELECT * FROM public.rapprocher_pesees((SELECT (rapport ->> 'releve_id')::uuid FROM imp))$$, 'nouvelle passe de rapprochement');
SELECT is((SELECT count(*)::int FROM public.anomalies_pesee WHERE releve_id = (SELECT (rapport ->> 'releve_id')::uuid FROM imp)), 12,
  'une nouvelle passe ne duplique pas les anomalies');

-- Doublon inter-releves et annulation motivee
CREATE TEMP TABLE imp2 AS SELECT public.importer_releve_cbg_v2('CBG-D810-10-B', '2001-10-03', '2001-10-03', '00000000-0000-4000-d810-0000000000a2',
  'complement.csv', repeat('b', 64), '[{"ticket":"K810-2","date":"2001-10-03","immatriculation":"KG-0002-A","net":"43"}]') AS rapport;
GRANT SELECT ON imp2 TO authenticated;
SELECT is((SELECT (rapport ->> 'doublons_inter_releves')::int FROM imp2), 1, 'ticket deja present dans un autre releve : marque, pas rejete');
SELECT throws_ok($$SELECT public.annuler_releve_cbg((SELECT (rapport ->> 'releve_id')::uuid FROM imp2), '')$$, '22023', NULL, 'annulation sans motif refusee');
SELECT lives_ok($$SELECT public.annuler_releve_cbg((SELECT (rapport ->> 'releve_id')::uuid FROM imp2), 'Releve en double envoye par erreur')$$,
  'releve annule avec motif');
SELECT lives_ok($$SELECT public.importer_releve_cbg_v2('CBG-D810-10-C', '2001-10-03', '2001-10-03', '00000000-0000-4000-d810-0000000000a2',
  'complement.csv', repeat('b', 64), '[{"ticket":"K810-2","date":"2001-10-03","net":"43"}]')$$, 'apres annulation, le fichier se reimporte');
SELECT lives_ok($$SELECT public.annuler_releve_cbg((SELECT id FROM public.releves_cbg WHERE reference = 'CBG-D810-10-C'), 'Essai de reimport')$$,
  'second releve annule');
RESET ROLE;

-- Anomalie d'ecart de poids : circuit complet, separation des taches
CREATE TEMP TABLE an AS SELECT id FROM public.anomalies_pesee WHERE categorie = 'ecart_poids' AND trip_id = '00000000-0000-4000-d810-000000000012';
GRANT SELECT ON an TO authenticated;
SELECT pg_temp.se_connecter('00000000-0000-4000-d810-000000000004');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.agir_anomalie_pesee((SELECT id FROM an), 'examiner')$$, '42501', NULL, 'sans droit d''ecriture : action refusee');
SELECT throws_ok($$SELECT public.rapprocher_pesees((SELECT (rapport ->> 'releve_id')::uuid FROM imp))$$, '42501', NULL, 'sans droit : rapprochement refuse');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d810-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.agir_anomalie_pesee((SELECT id FROM an), 'accepter_ecart_justifie', 'Ecart explique')$$, '22023', NULL,
  'conclusion refusee avant examen');
SELECT is(public.agir_anomalie_pesee((SELECT id FROM an), 'examiner', 'Prise en charge'), 'en_examen', 'anomalie en examen');
SELECT throws_ok($$SELECT public.agir_anomalie_pesee((SELECT id FROM an), 'accepter_ecart_justifie', 'Ecart explique')$$, '22023', NULL,
  'ecart de poids justifie sans preuve refuse');
SELECT is(public.agir_anomalie_pesee((SELECT id FROM an), 'accepter_ecart_justifie', 'Bascule CBG recalibree', 'PV-CBG-0042'), 'justifiee', 'ecart justifie avec preuve');
SELECT is(public.agir_anomalie_pesee((SELECT id FROM an), 'soumettre_validation'), 'soumise_validation', 'soumis a validation');
SELECT throws_ok($$SELECT public.agir_anomalie_pesee((SELECT id FROM an), 'cloturer', 'Valide')$$, '42501', NULL,
  'celui qui soumet ne cloture pas l''ecart de poids');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d810-000000000002');
SET LOCAL ROLE authenticated;
SELECT is(public.agir_anomalie_pesee((SELECT id FROM an), 'cloturer', 'Valide par le controleur'), 'cloturee', 'cloture par une autre personne');
SELECT is((SELECT count(*)::int FROM public.journal_anomalies_pesee WHERE anomalie_id = (SELECT id FROM an)), 5,
  'historique : creation et quatre actions');
SELECT ok((SELECT ancienne_valeur ->> 'statut' = 'en_examen' AND nouvelle_valeur ->> 'statut' = 'justifiee' AND preuve_ref = 'PV-CBG-0042'
  FROM public.journal_anomalies_pesee WHERE anomalie_id = (SELECT id FROM an) AND action = 'accepter_ecart_justifie'),
  'ancienne et nouvelle valeur tracees');
SELECT throws_ok($$SELECT public.agir_anomalie_pesee((SELECT id FROM an), 'ajouter_observation', 'Apres coup')$$, '22023', NULL,
  'anomalie cloturee immuable');

-- Reconciliation : tonnage CBG officiel, releve KOGON a part
CREATE TEMP TABLE rec AS SELECT public.ouvrir_reconciliation('00000000-0000-4000-d810-0000000000c1', '2001-10-01', '2001-10-31', 'recu', 5) AS id;
GRANT SELECT ON rec TO authenticated;
SELECT is((SELECT (tonnage_cbg, tonnage_kogon, releve_cbg_ligne_id IS NOT NULL)::text FROM public.reconciliation_lignes
  WHERE reference = 'TEST-D810-1'), '(40,40,t)', 'tonnage CBG = releve officiel, tonnage KOGON = releve terrain');
SELECT ok((SELECT tonnage_cbg = 43 AND tonnage_kogon = 41 AND anomalies @> ARRAY['ecart_releve_cbg'] FROM public.reconciliation_lignes
  WHERE reference = 'TEST-D810-2'), 'ecart officiel / KOGON signale, aucune valeur ecrasee');
SELECT ok((SELECT tonnage_cbg IS NULL AND anomalies @> ARRAY['sans_ticket_cbg'] FROM public.reconciliation_lignes
  WHERE reference = 'TEST-D810-3'), 'sans releve KOGON de rotation : aucun repli sur une autre valeur');
RESET ROLE;
UPDATE public.reconciliations SET statut = 'cloturee', cloturee_le = now() WHERE id = (SELECT id FROM rec);

-- Correction apres cloture refusee
SELECT pg_temp.se_connecter('00000000-0000-4000-d810-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.saisir_releve_terrain_kogon(gen_random_uuid(), '00000000-0000-4000-d810-0000000000a2',
  '00000000-0000-4000-d810-000000000013', jsonb_build_object('ticket', 'K810-3', 'net', '40.2', 'motif_remplacement', 'Relecture',
  'remplace_id', (SELECT id FROM public.releves_terrain_kogon WHERE client_id = '00000000-0000-4000-d810-0000000000e1')))$$,
  '22023', NULL, 'correction du releve KOGON refusee apres cloture');
SELECT throws_ok($$SELECT public.agir_anomalie_pesee((SELECT id FROM public.anomalies_pesee WHERE categorie = 'camion_non_reconnu'
  AND trip_id = '00000000-0000-4000-d810-000000000013'), 'examiner')$$, '22023', NULL, 'anomalie d''une reconciliation cloturee figee');
SELECT throws_ok($$SELECT public.annuler_releve_cbg((SELECT (rapport ->> 'releve_id')::uuid FROM imp), 'Erreur')$$, '22023', NULL,
  'releve engage dans une reconciliation cloturee : annulation refusee');
SELECT lives_ok($$SELECT public.saisir_releve_terrain_kogon('00000000-0000-4000-d810-0000000000e5', '00000000-0000-4000-d810-0000000000a2', NULL,
  jsonb_build_object('ticket', 'K810-4', 'net', '39.5', 'motif_remplacement', 'Relecture de la fiche',
  'remplace_id', (SELECT id FROM public.releves_terrain_kogon WHERE client_id = '00000000-0000-4000-d810-0000000000e2')))$$,
  'correction d''un releve hors reconciliation close : nouvelle ligne motivee');
SELECT is((SELECT count(*)::int FROM public.v_releves_terrain_kogon_effectifs WHERE ticket = 'K810-4'), 1,
  'seule la derniere version est en vigueur, l''ancienne est conservee');
RESET ROLE;

-- Perimetre de site : un utilisateur d'un autre site ne voit ni ne modifie
SELECT pg_temp.se_connecter('00000000-0000-4000-d810-000000000003');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.releves_terrain_kogon WHERE ticket LIKE 'K810-%')
        + (SELECT count(*)::int FROM public.anomalies_pesee WHERE description LIKE '%K810%')
        + (SELECT count(*)::int FROM public.rapprochements_pesee WHERE ticket ILIKE 'K810-%')
        + (SELECT count(*)::int FROM public.releves_cbg WHERE reference LIKE 'CBG-D810-%'), 0,
  'autre site : releves, rapprochements et anomalies invisibles');
SELECT throws_ok($$SELECT public.rapprocher_pesees((SELECT (rapport ->> 'releve_id')::uuid FROM imp))$$, 'P0002', NULL,
  'autre site : rapprochement refuse');
SELECT throws_ok($$SELECT public.agir_anomalie_pesee((SELECT id FROM an), 'ajouter_observation', 'x')$$, 'P0002', NULL,
  'autre site : anomalie introuvable');
SELECT throws_ok($$SELECT public.saisir_releve_terrain_kogon(gen_random_uuid(), '00000000-0000-4000-d810-0000000000a2', NULL, '{"ticket":"K810-Z","net":"40"}')$$,
  'P0002', NULL, 'autre site : saisie refusee');
SELECT throws_ok($$SELECT public.saisir_releve_terrain_kogon('00000000-0000-4000-d810-0000000000e1', '00000000-0000-4000-d810-0000000000a3', NULL, '{"ticket":"K810-3","net":"40"}')$$,
  '23505', NULL, 'identifiant de saisie d''un autre agent : refuse, rien n''est revele');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
