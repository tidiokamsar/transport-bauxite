-- Tests (D-089) : cycle de vie controle des fiches terrain (migration
-- 20261121215000_fiches_terrain_cycle) : structure et droits, generation
-- depuis le Dispatch, transitions, impression et reimpression, lot, remise,
-- retour, brouillon, saisie au retour, controle, renvoi, validation separee,
-- fiche validee protegee, carburant sans double sortie, compatibilite D-028.
-- Tout est annule.
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

SELECT plan(111);
DELETE FROM public.settings WHERE key = 'controle_depart_exige';

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8f71-000000000001', 'saisie.cycle@exemple.invalid'),
  ('00000000-0000-4000-8f71-000000000002', 'validation.cycle@exemple.invalid'),
  ('00000000-0000-4000-8f71-000000000003', 'chauffeur.cycle@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status) VALUES
  ('00000000-0000-4000-8f71-000000000001', 'contract_manager', 'Saisie cycle', 'active'),
  ('00000000-0000-4000-8f71-000000000002', 'contract_manager', 'Validation cycle', 'active'),
  ('00000000-0000-4000-8f71-000000000003', 'driver', 'Chauffeur cycle', 'active')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;
INSERT INTO public.droits_utilisateur (utilisateur, module, niveau) VALUES
  ('00000000-0000-4000-8f71-000000000003', 'trips', 'aucun'),
  ('00000000-0000-4000-8f71-000000000003', 'maintenance', 'aucun'),
  ('00000000-0000-4000-8f71-000000000003', 'fuel', 'aucun');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-8f71-0000000000a1', 'Mine cycle', 'mine'),
  ('00000000-0000-4000-8f71-0000000000a2', 'Depot cycle', 'depot');
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status) VALUES
  ('00000000-0000-4000-8f71-0000000000b1', 'TEST-CYC-1', 'Test', 40, 'tipper', 'active'),
  ('00000000-0000-4000-8f71-0000000000b2', 'TEST-CYC-2', 'Test', 40, 'tipper', 'active'),
  ('00000000-0000-4000-8f71-0000000000e1', 'TEST-CYC-CHG', 'Test', 10, 'loader', 'active');
INSERT INTO public.drivers (id, name, license_number, license_category, license_expiry, hire_date, status) VALUES
  ('00000000-0000-4000-8f71-0000000000c1', 'Chauffeur cycle 1', 'CY-1', 'C', current_date + 100, current_date - 100, 'active'),
  ('00000000-0000-4000-8f71-0000000000c2', 'Chauffeur cycle 2', 'CY-2', 'C', current_date + 100, current_date - 100, 'active');
INSERT INTO public.stockages_carburant (id, code, libelle, type, site_id, capacite_litres) VALUES
  ('00000000-0000-4000-8f71-0000000000d1', 'TEST-CUVE-CYC', 'Cuve cycle', 'cuve_fixe', '00000000-0000-4000-8f71-0000000000a1', 20000);

-- 1. Structure et droits ------------------------------------------------------
SELECT has_table('public', 'fiches_journal', 'journal des fiches');
SELECT has_table('public', 'fiches_lots', 'lots de fiches');
SELECT has_table('public', 'fiches_remises', 'remises');
SELECT has_table('public', 'fiches_retours', 'retours');
SELECT has_table('public', 'fiches_rotations_lignes', 'lignes FR');
SELECT has_table('public', 'fiches_carburant_lignes', 'lignes FC');
SELECT has_table('public', 'fiches_ecarts', 'ecarts de controle');
SELECT is((SELECT count(*)::int FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relrowsecurity
            AND relname IN ('fiches_journal', 'fiches_lots', 'fiches_remises', 'fiches_retours',
                            'fiches_rotations_lignes', 'fiches_carburant_lignes', 'fiches_ecarts')), 7, 'RLS active sur les sept tables');
SELECT ok(NOT EXISTS (SELECT 1 FROM unnest(ARRAY['fiches_terrain', 'fiches_journal', 'fiches_lots', 'fiches_remises', 'fiches_retours',
            'fiches_rotations_lignes', 'fiches_carburant_lignes', 'fiches_ecarts', 'pointages_engins']) t
          WHERE has_table_privilege('authenticated', 'public.' || t, 'INSERT') OR has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
             OR has_table_privilege('authenticated', 'public.' || t, 'DELETE')), 'aucune ecriture directe pour authenticated');
CREATE TEMP TABLE api (f regprocedure);
INSERT INTO api SELECT unnest(ARRAY[
  'public.generer_fiches_rotation(date, uuid, uuid, text, text)',
  'public.creer_fiche(text, date, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, jsonb, jsonb, boolean, timestamptz, timestamptz)',
  'public.preparer_contenu_fiche(uuid, jsonb, integer)', 'public.changer_etat_fiche(uuid, text, text, integer)',
  'public.enregistrer_impression_fiches(uuid[], text)', 'public.attribuer_fiches(uuid[], text, uuid)',
  'public.creer_lot_fiches(uuid[], text, uuid, text)', 'public.remettre_fiches(uuid[], text, uuid, timestamptz, uuid, text)',
  'public.confirmer_remise(uuid, text)', 'public.enregistrer_retour_fiches(text, jsonb, uuid, timestamptz, uuid, text)',
  'public.enregistrer_brouillon_fiche(uuid, jsonb, integer)', 'public.saisir_ligne_rotation(uuid, integer, jsonb, text)',
  'public.saisir_pointage_fiche(uuid, uuid, numeric, numeric, numeric, timestamptz, timestamptz, jsonb, text, text, text, text)',
  'public.saisir_ligne_carburant(uuid, integer, jsonb, text)', 'public.soumettre_fiche_controle(uuid, integer)',
  'public.controler_fiche(uuid)', 'public.renvoyer_fiche_correction(uuid, text)', 'public.valider_fiche(uuid, text, integer)',
  'public.archiver_fiche(uuid)', 'public.suivre_fiche(uuid, text, text, timestamptz)', 'public.annuler_fiche(uuid, text)',
  'public.terminer_saisie_fiche(uuid, text)', 'public.saisir_rotation(uuid, uuid, jsonb)',
  'public.saisir_pointage(uuid, uuid, numeric, numeric, text, text, jsonb)', 'public.saisir_carburant(uuid, numeric, text, jsonb)'
]::regprocedure[]);
SELECT ok(NOT EXISTS (SELECT 1 FROM api WHERE has_function_privilege('anon', f, 'EXECUTE'))
          AND NOT EXISTS (SELECT 1 FROM api WHERE NOT has_function_privilege('authenticated', f, 'EXECUTE')),
          'API : executable par authenticated, jamais par anon');
SELECT ok(NOT EXISTS (SELECT 1 FROM unnest(ARRAY[
  'public.fiche_journaliser(uuid, text, text, text, jsonb)', 'public.fiche_verrou(uuid, text, integer)',
  'public.fiche_passer(uuid, text, text, text, jsonb)', 'public.fiche_marquer_saisie(uuid, text, jsonb)',
  'public.fiche_saisissable(uuid, text)', 'public.fiche_numero_suivant(text, date)', 'public.fiche_ouverte(uuid, text)'
]::regprocedure[]) f WHERE has_function_privilege('authenticated', f, 'EXECUTE')), 'assistants internes non executables par les comptes');
SELECT ok(NOT EXISTS (SELECT 1 FROM api a JOIN pg_proc p ON p.oid = a.f
          WHERE NOT p.prosecdef OR NOT coalesce(p.proconfig, '{}') @> ARRAY['search_path=""']), 'API en SECURITY DEFINER, search_path vide');
SELECT is(public.fiche_statut_herite('a_corriger') || ' ' || public.fiche_statut_herite('a_controler') || ' '
          || public.fiche_statut_herite('en_utilisation'), 'retournee saisie remise', 'statut D-028 derive de l''etat');
SELECT ok(public.transition_fiche_autorisee('a_controler', 'validee') AND NOT public.transition_fiche_autorisee('validee', 'saisie_en_cours')
          AND NOT public.transition_fiche_autorisee('archivee', 'annulee') AND NOT public.transition_fiche_autorisee('saisie_en_cours', 'validee'),
          'graphe : validation depuis a_controler seulement, validee et archivee figees');

-- 2. Generation depuis le Dispatch ------------------------------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-8f71-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE vy AS SELECT
  public.creer_voyage(current_date, '00000000-0000-4000-8f71-0000000000a1', '00000000-0000-4000-8f71-0000000000a2',
    '00000000-0000-4000-8f71-0000000000b1', '00000000-0000-4000-8f71-0000000000c1') AS v1,
  public.creer_voyage(current_date, '00000000-0000-4000-8f71-0000000000a1', '00000000-0000-4000-8f71-0000000000a2',
    '00000000-0000-4000-8f71-0000000000b1', '00000000-0000-4000-8f71-0000000000c1') AS v2,
  public.creer_voyage(current_date, '00000000-0000-4000-8f71-0000000000a1', '00000000-0000-4000-8f71-0000000000a2',
    '00000000-0000-4000-8f71-0000000000b2', '00000000-0000-4000-8f71-0000000000c2') AS v3;
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-8f71-000000000003');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT * FROM public.generer_fiches_rotation(current_date, '00000000-0000-4000-8f71-0000000000a1')$$,
  '42501', NULL, 'generation refusee sans droit voyages');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-8f71-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE gen AS SELECT * FROM public.generer_fiches_rotation(current_date, '00000000-0000-4000-8f71-0000000000a1');
SELECT is((SELECT count(*)::int FROM gen WHERE creee), 2, 'une fiche FR par camion et periode');
SELECT is((SELECT count(*)::int FROM public.generer_fiches_rotation(current_date, '00000000-0000-4000-8f71-0000000000a1') WHERE creee), 0,
  'generation repetee : aucune fiche en double');
CREATE TEMP TABLE fr1 AS SELECT fiche_id AS id FROM gen WHERE vehicle_id = '00000000-0000-4000-8f71-0000000000b1';
CREATE TEMP TABLE fr2 AS SELECT fiche_id AS id FROM gen WHERE vehicle_id = '00000000-0000-4000-8f71-0000000000b2';
SELECT is((SELECT etat || ' ' || origine || ' ' || jsonb_array_length(contenu) || ' ' || (driver_id = '00000000-0000-4000-8f71-0000000000c1')
             || ' ' || (options ->> 'pesee') FROM public.fiches_terrain WHERE id = (SELECT id FROM fr1)),
  'preparee generation 2 true arrivee', 'fiche preremplie : voyages, chauffeur, pesee a l''arrivee');
SELECT throws_ok($$SELECT public.creer_fiche('rotations', current_date, '00000000-0000-4000-8f71-0000000000a1', NULL,
  '00000000-0000-4000-8f71-0000000000b1')$$, '23505', NULL, 'doublon de fiche FR refuse');
SELECT throws_ok($$UPDATE public.fiches_terrain SET etat = 'validee' WHERE id = (SELECT id FROM fr1)$$, '42501', NULL,
  'aucune ecriture directe de l''etat');

-- 3. Transitions, impression, remise ------------------------------------------
SELECT is(public.changer_etat_fiche((SELECT id FROM fr1), 'a_imprimer'), 'a_imprimer', 'preparee vers a_imprimer');
SELECT throws_ok($$SELECT public.changer_etat_fiche((SELECT id FROM fr1), 'remise_agent')$$, '22023', NULL,
  'remise hors de sa fonction refusee');
SELECT is(public.enregistrer_impression_fiches(ARRAY[(SELECT id FROM fr1)]), 1, 'impression tracee');
SELECT throws_ok($$SELECT public.enregistrer_impression_fiches(ARRAY[(SELECT id FROM fr1)])$$, '22023', NULL,
  'reimpression sans motif refusee');
SELECT lives_ok($$SELECT public.enregistrer_impression_fiches(ARRAY[(SELECT id FROM fr1)], 'Exemplaire tache')$$, 'reimpression motivee');
SELECT is((SELECT f.etat || ' ' || f.nb_impressions || ' ' || (SELECT count(*) FROM public.fiches_journal j WHERE j.fiche_id = f.id AND j.action = 'reimpression')
             FROM public.fiches_terrain f WHERE f.id = (SELECT id FROM fr1)), 'imprimee 2 1', 'reimpression sans changement d''etat, journalisee');
SELECT is((SELECT count(*)::int FROM public.trips WHERE planned_date = current_date
            AND vehicle_id IN ('00000000-0000-4000-8f71-0000000000b1', '00000000-0000-4000-8f71-0000000000b2')), 3,
  'impression et generation sans operation metier (aucun voyage cree)');
SELECT throws_ok($$SELECT public.remettre_fiches(ARRAY[(SELECT id FROM fr2)], 'Agent Alpha')$$, '22023', NULL,
  'fiche non imprimee : remise refusee');
SELECT is(public.attribuer_fiches(ARRAY[(SELECT id FROM fr1)], 'Agent Alpha'), 1, 'fiche attribuee a un agent');
SELECT throws_like($$SELECT public.remettre_fiches(ARRAY[(SELECT id FROM fr1)], 'Agent Beta')$$, '%Mauvais agent%',
  'remise a un autre agent refusee');
CREATE TEMP TABLE rem AS SELECT public.remettre_fiches(ARRAY[(SELECT id FROM fr1)], 'agent alpha', NULL, now(), NULL, 'Debut de poste') AS id;
SELECT is((SELECT r.nombre || ' ' || (r.numeros ->> 0 = f.numero) || ' ' || (r.responsable = '00000000-0000-4000-8f71-000000000001') || ' ' || f.etat
             FROM public.fiches_remises r JOIN public.fiches_terrain f ON f.id = r.fiche_ids[1] WHERE r.id = (SELECT id FROM rem)),
  '1 true true remise_agent', 'remise : nombre, numeros, responsable, etat');
SELECT lives_ok($$SELECT public.confirmer_remise((SELECT id FROM rem), 'signature')$$, 'remise confirmee (signature)');
SELECT throws_ok($$SELECT public.confirmer_remise((SELECT id FROM rem), 'signature')$$, '22023', NULL, 'confirmation unique');
SELECT throws_ok($$SELECT public.saisir_ligne_rotation((SELECT id FROM fr1), 1, '{}'::jsonb)$$, '22023', NULL,
  'saisie avant le retour refusee');

-- 4. Retour, brouillon, saisie ------------------------------------------------
SELECT throws_like($$SELECT public.enregistrer_retour_fiches('Agent Beta', jsonb_build_array(jsonb_build_object('fiche_id', (SELECT id FROM fr1))))$$,
  '%Mauvais agent%', 'retour par un autre agent refuse');
CREATE TEMP TABLE ret AS SELECT public.enregistrer_retour_fiches('Agent Alpha',
  jsonb_build_array(jsonb_build_object('fiche_id', (SELECT id FROM fr1), 'etat_retour', 'complete'))) AS id;
SELECT is((SELECT f.etat || ' ' || (r.receptionnaire = '00000000-0000-4000-8f71-000000000001') || ' ' || r.nombre_recu
             FROM public.fiches_retours r, public.fiches_terrain f WHERE r.id = (SELECT id FROM ret) AND f.id = (SELECT id FROM fr1)),
  'retournee true 1', 'retour : receptionnaire, nombre, etat');
SELECT throws_ok($$SELECT public.enregistrer_brouillon_fiche((SELECT id FROM fr1), '{"note": "a"}', 1)$$, '40001', NULL,
  'brouillon sur une version perimee refuse');
SELECT ok(public.enregistrer_brouillon_fiche((SELECT id FROM fr1), '{"note": "a"}',
  (SELECT version FROM public.fiches_terrain WHERE id = (SELECT id FROM fr1))) > 0, 'brouillon enregistre');
SELECT is((SELECT etat FROM public.fiches_terrain WHERE id = (SELECT id FROM fr1)), 'saisie_en_cours', 'saisie en cours');
SELECT throws_like($$SELECT public.saisir_ligne_rotation((SELECT id FROM fr1), 1, jsonb_build_object('trip_id', (SELECT v3 FROM vy)))$$,
  '%Mauvais engin%', 'voyage d''un autre camion refuse');
CREATE TEMP TABLE lg AS SELECT public.saisir_ligne_rotation((SELECT id FROM fr1), 1, jsonb_build_object('trip_id', (SELECT v1 FROM vy),
  'ticket_cbg', 'TCK-71-1', 'km_depart', 1000, 'km_arrivee', 1042, 'observations', 'RAS')) AS id;
SELECT is(public.saisir_ligne_rotation((SELECT id FROM fr1), 1, jsonb_build_object('trip_id', (SELECT v1 FROM vy),
  'ticket_cbg', 'TCK-71-1', 'km_depart', 1000, 'km_arrivee', 1042, 'observations', 'RAS')), (SELECT id FROM lg),
  'ressoumission identique sans effet');
SELECT throws_ok($$SELECT public.saisir_ligne_rotation((SELECT id FROM fr1), 1, jsonb_build_object('trip_id', (SELECT v1 FROM vy),
  'ticket_cbg', 'TCK-71-1', 'km_depart', 1000, 'km_arrivee', 1043))$$, '22023', NULL, 'correction sans motif refusee');
SELECT lives_ok($$SELECT public.saisir_ligne_rotation((SELECT id FROM fr1), 1, jsonb_build_object('trip_id', (SELECT v1 FROM vy),
  'ticket_cbg', 'TCK-71-1', 'km_depart', 1000, 'km_arrivee', 1043), 'Erreur de lecture du compteur')$$, 'correction motivee');
SELECT is((SELECT count(*)::int FROM public.fiches_journal WHERE fiche_id = (SELECT id FROM fr1) AND action = 'correction'), 1,
  'correction tracee');
SELECT is((SELECT count(*)::int FROM public.trips WHERE planned_date = current_date
            AND vehicle_id IN ('00000000-0000-4000-8f71-0000000000b1', '00000000-0000-4000-8f71-0000000000b2')), 3,
  'la saisie de la fiche ne cree aucun voyage');

-- 5. Controle, separation, renvoi, validation --------------------------------
SELECT lives_ok($$SELECT public.terminer_saisie_fiche((SELECT id FROM fr1), 'Fiche complete')$$, 'saisie terminee');
SELECT throws_ok($$SELECT public.valider_fiche((SELECT id FROM fr1), 'motif')$$, '22023', NULL, 'validation prematuree refusee');
SELECT is(public.soumettre_fiche_controle((SELECT id FROM fr1)), 'a_controler', 'fiche soumise au controle');
SELECT is(public.soumettre_fiche_controle((SELECT id FROM fr1)) || ' '
          || (SELECT count(*) FROM public.fiches_journal WHERE fiche_id = (SELECT id FROM fr1) AND action = 'soumission'),
  'a_controler 1', 'soumission repetee idempotente');
SELECT ok(public.controler_fiche((SELECT id FROM fr1)) >= 3, 'controle : ecarts listes');
SELECT ok((SELECT array_agg(DISTINCT code) FROM public.v_fiches_ecarts_courants WHERE fiche_id = (SELECT id FROM fr1))
          @> ARRAY['ticket_absent_sigtb', 'voyage_non_termine', 'voyage_sans_ligne'], 'ecarts : ticket, voyage non termine, voyage absent');
SELECT is((SELECT etat FROM public.trips WHERE id = (SELECT v1 FROM vy)), 'ASSIGNED', 'controle sans correction automatique du voyage');
SELECT throws_like($$SELECT public.valider_fiche((SELECT id FROM fr1), 'motif')$$, '%separation_violee%', 'le saisisseur ne valide pas');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-8f71-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.valider_fiche((SELECT id FROM fr1))$$, '22023', NULL, 'ecarts : motif de validation exige');
SELECT throws_ok($$SELECT public.renvoyer_fiche_correction((SELECT id FROM fr1), ' ')$$, '22023', NULL, 'renvoi sans motif refuse');
SELECT lives_ok($$SELECT public.renvoyer_fiche_correction((SELECT id FROM fr1), 'Voyage 2 absent de la fiche')$$, 'renvoi en correction');
SELECT is((SELECT etat FROM public.fiches_terrain WHERE id = (SELECT id FROM fr1)), 'a_corriger', 'fiche a corriger');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-8f71-000000000001');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.saisir_ligne_rotation((SELECT id FROM fr1), 2, jsonb_build_object('trip_id', (SELECT v2 FROM vy)))$$,
  'correction : ligne ajoutee');
SELECT is((SELECT public.terminer_saisie_fiche((SELECT id FROM fr1))::text || public.soumettre_fiche_controle((SELECT id FROM fr1))), 'a_controler',
  'resoumission apres correction');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-8f71-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_like($$SELECT public.valider_fiche((SELECT id FROM fr1), 'motif')$$, '%controle a refaire%', 'controle perime : validation refusee');
SELECT lives_ok($$SELECT public.controler_fiche((SELECT id FROM fr1))$$, 'nouveau controle');
SELECT is(public.valider_fiche((SELECT id FROM fr1), 'Voyages en cours au moment du controle, tickets a rapprocher'), 'validee',
  'validation par une autre personne');
SELECT is(public.valider_fiche((SELECT id FROM fr1), 'bis') || ' '
          || (SELECT count(*) FROM public.fiches_journal WHERE fiche_id = (SELECT id FROM fr1) AND action = 'validation'),
  'validee 1', 'validation repetee sans effet');
RESET ROLE;

-- 6. Fiche validee protegee ---------------------------------------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-8f71-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.saisir_ligne_rotation((SELECT id FROM fr1), 3, '{}'::jsonb)$$, '22023', NULL,
  'fiche validee : saisie refusee');
SELECT throws_ok($$SELECT public.annuler_fiche((SELECT id FROM fr1), 'test')$$, '22023', NULL, 'fiche validee : annulation refusee');
SELECT throws_ok($$SELECT public.saisir_rotation((SELECT id FROM fr1), (SELECT v1 FROM vy), '[]')$$, '22023', NULL,
  'fiche validee : saisie D-028 refusee');
SELECT lives_ok($$SELECT public.enregistrer_impression_fiches(ARRAY[(SELECT id FROM fr1)], 'Copie pour le dossier CBG')$$,
  'reimpression d''une fiche validee tracee');
RESET ROLE;
SELECT throws_ok($$UPDATE public.fiches_terrain SET note = 'modifiee' WHERE id = (SELECT id FROM fr1)$$, '42501', NULL,
  'fiche validee : modification directe refusee meme hors API');
SELECT throws_ok($$UPDATE public.fiches_rotations_lignes SET observations = 'x' WHERE fiche_id = (SELECT id FROM fr1)$$, '42501', NULL,
  'lignes d''une fiche validee figees');
SELECT throws_ok($$UPDATE public.fiches_journal SET motif = 'x' WHERE fiche_id = (SELECT id FROM fr1)$$, '42501', NULL,
  'journal append-only (modification)');
SELECT throws_ok($$DELETE FROM public.fiches_journal WHERE fiche_id = (SELECT id FROM fr1)$$, '42501', NULL,
  'journal append-only (suppression)');
SELECT throws_ok($$UPDATE public.fiches_terrain SET etat = 'imprimee' WHERE id = (SELECT id FROM fr2)$$, '42501', NULL,
  'etat hors fonction du cycle refuse');
SELECT pg_temp.se_connecter('00000000-0000-4000-8f71-000000000002');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.archiver_fiche((SELECT id FROM fr1))$$, 'fiche archivee');
SELECT is((SELECT etat || ' ' || statut || ' ' || nb_impressions FROM public.fiches_terrain WHERE id = (SELECT id FROM fr1)),
  'archivee saisie 3', 'archivee, statut herite, impressions conservees');
RESET ROLE;

-- 7. Pointage horametre FP ----------------------------------------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-8f71-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE fp AS SELECT public.creer_fiche('pointage_engins', current_date, '00000000-0000-4000-8f71-0000000000a1', NULL,
  '00000000-0000-4000-8f71-0000000000e1', NULL, NULL, NULL, NULL, 'Agent Gamma', '{}', NULL, false,
  date_trunc('day', now()), date_trunc('day', now()) + interval '12 hours') AS id;
SELECT lives_ok($$SELECT public.enregistrer_impression_fiches(ARRAY[(SELECT id FROM fp)]),
  public.remettre_fiches(ARRAY[(SELECT id FROM fp)], 'Agent Gamma', NULL, now() - interval '1 minute'),
  public.enregistrer_retour_fiches('Agent Gamma', jsonb_build_array(jsonb_build_object('fiche_id', (SELECT id FROM fp))))$$,
  'FP imprimee, remise, retournee');
SELECT throws_like($$SELECT public.saisir_pointage_fiche((SELECT id FROM fp), '00000000-0000-4000-8f71-0000000000b1', 100, 110)$$,
  '%Mauvais engin%', 'pointage d''un autre engin refuse');
SELECT throws_ok($$SELECT public.saisir_pointage_fiche((SELECT id FROM fp), '00000000-0000-4000-8f71-0000000000e1', 1000, 1010.5, 12)$$,
  '22023', NULL, 'heures productives superieures aux heures moteur refusees');
SELECT lives_ok($$SELECT public.saisir_pointage_fiche((SELECT id FROM fp), '00000000-0000-4000-8f71-0000000000e1', 1000, 1010.5, 9,
  NULL, NULL, jsonb_build_array(jsonb_build_object('debut', date_trunc('day', now()) + interval '2 hours',
    'fin', date_trunc('day', now()) + interval '3 hours', 'cause', 'panne', 'description', 'Flexible')),
  'Operateur A', 'Agent Gamma')$$, 'pointage saisi');
SELECT ok((SELECT heures_marche = 10.5 AND heures_productives = 9 AND heures_arret = 1 AND origine = 'cycle'
             FROM public.pointages_engins WHERE fiche_id = (SELECT id FROM fp)), 'heures moteur, productives et arrets distincts');
SELECT is((SELECT public.terminer_saisie_fiche((SELECT id FROM fp))::text || public.soumettre_fiche_controle((SELECT id FROM fp))), 'a_controler',
  'FP terminee et soumise');
SELECT ok(public.controler_fiche((SELECT id FROM fp)) >= 1, 'FP controlee');
SELECT ok(EXISTS (SELECT 1 FROM public.v_fiches_ecarts_courants WHERE fiche_id = (SELECT id FROM fp) AND code = 'arret_sans_immobilisation'),
  'controle FP : arret sans immobilisation signale');
SELECT is((SELECT count(*)::int FROM public.immobilisations WHERE vehicle_id = '00000000-0000-4000-8f71-0000000000e1'), 0,
  'aucune immobilisation creee automatiquement');
RESET ROLE;

-- 8. Carburant FC : registre, sortie unique -----------------------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-8f71-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE fc AS SELECT public.creer_fiche('carburant', current_date, '00000000-0000-4000-8f71-0000000000a1', NULL, NULL, NULL,
  '00000000-0000-4000-8f71-0000000000d1', NULL, NULL, 'Agent Delta') AS id;
SELECT throws_ok($$SELECT public.creer_fiche('carburant', current_date, '00000000-0000-4000-8f71-0000000000a1', NULL, NULL, NULL,
  '00000000-0000-4000-8f71-0000000000d1')$$, '23505', NULL, 'doublon de fiche FC sur la meme cuve refuse');
SELECT lives_ok($$SELECT public.enregistrer_impression_fiches(ARRAY[(SELECT id FROM fc)]),
  public.remettre_fiches(ARRAY[(SELECT id FROM fc)], 'Agent Delta', NULL, now() - interval '1 minute'),
  public.enregistrer_retour_fiches('Agent Delta', jsonb_build_array(jsonb_build_object('fiche_id', (SELECT id FROM fc))))$$,
  'FC imprimee, remise, retournee');
CREATE TEMP TABLE lc AS SELECT public.saisir_ligne_carburant((SELECT id FROM fc), 1, jsonb_build_object(
  'vehicle_id', '00000000-0000-4000-8f71-0000000000b1', 'litres', 300, 'distribue_le', now() - interval '30 minutes',
  'index_pompe_debut', 1000, 'index_pompe_fin', 1300, 'destinataire_confirme', true, 'destinataire_nom', 'Chauffeur cycle 1')) AS id;
SELECT is(public.saisir_ligne_carburant((SELECT id FROM fc), 1, jsonb_build_object(
  'vehicle_id', '00000000-0000-4000-8f71-0000000000b1', 'litres', 300, 'distribue_le', (SELECT distribue_le FROM public.fiches_carburant_lignes WHERE id = (SELECT id FROM lc)),
  'index_pompe_debut', 1000, 'index_pompe_fin', 1300, 'destinataire_confirme', true, 'destinataire_nom', 'Chauffeur cycle 1')), (SELECT id FROM lc),
  'ligne FC ressoumise sans doublon');
SELECT lives_ok($$SELECT public.saisir_ligne_carburant((SELECT id FROM fc), 2, jsonb_build_object(
  'vehicle_id', '00000000-0000-4000-8f71-0000000000e1', 'litres', 150, 'distribue_le', now() - interval '20 minutes'))$$, 'seconde ligne FC');
SELECT is((SELECT count(*)::int FROM public.mouvements_carburant WHERE stockage_id = '00000000-0000-4000-8f71-0000000000d1'), 0,
  'aucune sortie de stock avant validation');
SELECT is((SELECT public.terminer_saisie_fiche((SELECT id FROM fc))::text || public.soumettre_fiche_controle((SELECT id FROM fc))), 'a_controler',
  'FC terminee et soumise');
SELECT ok(public.controler_fiche((SELECT id FROM fc)) >= 1, 'FC controlee');
SELECT ok((SELECT array_agg(code) FROM public.v_fiches_ecarts_courants WHERE fiche_id = (SELECT id FROM fc))
          @> ARRAY['destinataire_non_confirme', 'stock_sans_donnees'], 'controle FC : reception non confirmee, solde inconnu');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-8f71-000000000003');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.valider_fiche((SELECT id FROM fc), 'x')$$, '42501', NULL, 'validation refusee sans droit carburant');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-8f71-000000000002');
SET LOCAL ROLE authenticated;
SELECT is(public.valider_fiche((SELECT id FROM fc), 'Reception de la chargeuse confirmee oralement'), 'validee', 'FC validee');
SELECT is((SELECT count(*) || ' ' || count(*) FILTER (WHERE statut = 'a_valider' AND type = 'distribution'
             AND saisi_par = '00000000-0000-4000-8f71-000000000001')
             FROM public.mouvements_carburant WHERE stockage_id = '00000000-0000-4000-8f71-0000000000d1'), '2 2',
  'une sortie de stock par ligne, a valider au registre, au nom du saisisseur');
SELECT is(public.valider_fiche((SELECT id FROM fc), 'bis') || ' '
          || (SELECT count(*) FROM public.mouvements_carburant WHERE stockage_id = '00000000-0000-4000-8f71-0000000000d1'),
  'validee 2', 'validation repetee : jamais de double sortie');
SELECT is(public.valider_fiche((SELECT id FROM fp), 'Arret pluie, immobilisation non requise'), 'validee', 'FP validee');
RESET ROLE;

-- 9. Saisie D-028 : comptabilisation immediate, une seule fois ---------------
SELECT pg_temp.se_connecter('00000000-0000-4000-8f71-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE fch AS SELECT public.preparer_fiche('carburant', current_date - 1, '00000000-0000-4000-8f71-0000000000a1') AS id;
SELECT is(public.saisir_carburant((SELECT id FROM fch), NULL, 'CBG', jsonb_build_array(jsonb_build_object(
  'vehicle_id', '00000000-0000-4000-8f71-0000000000b2', 'litres', 100, 'stockage_id', '00000000-0000-4000-8f71-0000000000d1'))), 1,
  'saisie directe D-028');
SELECT throws_ok($$SELECT public.saisir_carburant((SELECT id FROM fch), NULL, 'CBG', jsonb_build_array(jsonb_build_object(
  'vehicle_id', '00000000-0000-4000-8f71-0000000000b2', 'litres', 100, 'stockage_id', '00000000-0000-4000-8f71-0000000000d1')))$$,
  '22023', NULL, 'resaisie refusee : pas de double sortie');
SELECT is((SELECT count(*)::int FROM public.fiches_carburant_lignes l JOIN public.mouvements_carburant m ON m.id = l.mouvement_id
            WHERE l.fiche_id = (SELECT id FROM fch) AND l.origine = 'saisir_carburant'), 1, 'ligne inscrite avec sa sortie de stock');
SELECT throws_ok($$SELECT public.saisir_carburant((SELECT id FROM fc), NULL, 'CBG', '[]')$$, '22023', NULL,
  'saisie directe sur une fiche validee refusee');

-- 10. Lot, remise groupee, manquante ------------------------------------------
CREATE TEMP TABLE fpa AS SELECT public.creer_fiche('pointage_engins', current_date, '00000000-0000-4000-8f71-0000000000a1') AS id;
CREATE TEMP TABLE fpb AS SELECT public.creer_fiche('pointage_engins', current_date, '00000000-0000-4000-8f71-0000000000a1') AS id;
SELECT lives_ok($$SELECT public.enregistrer_impression_fiches(ARRAY[(SELECT id FROM fpa), (SELECT id FROM fpb)])$$, 'lot imprime');
CREATE TEMP TABLE lot AS SELECT public.creer_lot_fiches(ARRAY[(SELECT id FROM fpa), (SELECT id FROM fpb)], 'Agent Epsilon') AS id;
SELECT ok((SELECT numero ~ '^LF-\d{6}-\d{3}$' FROM public.fiches_lots WHERE id = (SELECT id FROM lot)), 'numero de lot genere');
CREATE TEMP TABLE reml AS SELECT public.remettre_fiches(NULL, 'Agent Epsilon', NULL, now() - interval '1 minute', (SELECT id FROM lot)) AS id;
SELECT is((SELECT nombre FROM public.fiches_remises WHERE id = (SELECT id FROM reml)), 2, 'remise du lot entier');
CREATE TEMP TABLE retl AS SELECT public.enregistrer_retour_fiches('Agent Epsilon',
  jsonb_build_array(jsonb_build_object('fiche_id', (SELECT id FROM fpa), 'etat_retour', 'abimee', 'observation', 'Coin dechire')),
  NULL, now(), (SELECT id FROM lot)) AS id;
SELECT is((SELECT r.nombre_attendu || ' ' || r.nombre_recu || ' ' || (r.manquants ->> 0 = b.numero) || ' ' || a.etat || ' ' || a.etat_retour || ' ' || b.etat
             FROM public.fiches_retours r, public.fiches_terrain a, public.fiches_terrain b
            WHERE r.id = (SELECT id FROM retl) AND a.id = (SELECT id FROM fpa) AND b.id = (SELECT id FROM fpb)),
  '2 1 true retournee abimee remise_agent', 'retour du lot : fiche manquante restee chez l''agent');

-- 11. Annulation et compatibilite D-028 ---------------------------------------
SELECT throws_ok($$SELECT public.annuler_fiche((SELECT id FROM fr2), '')$$, '22023', NULL, 'annulation sans motif refusee');
SELECT lives_ok($$SELECT public.annuler_fiche((SELECT id FROM fr2), 'Camion immobilise')$$, 'annulation motivee');
SELECT is((SELECT f.etat || ' ' || f.statut || ' ' || (SELECT count(*) FROM public.fiches_journal j WHERE j.fiche_id = f.id AND j.action = 'annulation')
             FROM public.fiches_terrain f WHERE f.id = (SELECT id FROM fr2)), 'annulee annulee 1', 'annulation tracee');
CREATE TEMP TABLE fl AS SELECT public.preparer_fiche('rotations', current_date - 1, '00000000-0000-4000-8f71-0000000000a1', NULL,
  '00000000-0000-4000-8f71-0000000000b2', NULL, 'Agent L', '{"pesee": "arrivee"}') AS id;
SELECT lives_ok($$SELECT public.suivre_fiche((SELECT id FROM fl), 'remise')$$, 'remise D-028');
SELECT is((SELECT etat || ' ' || statut || ' ' || (derniere_remise_id IS NOT NULL) FROM public.fiches_terrain WHERE id = (SELECT id FROM fl)),
  'remise_agent remise true', 'remise D-028 tracee dans le cycle');
SELECT lives_ok($$SELECT public.terminer_saisie_fiche((SELECT id FROM fl)), public.terminer_saisie_fiche((SELECT id FROM fl))$$,
  'fin de saisie D-028 avec retour implicite, repetition sans effet');
SELECT is((SELECT etat || ' ' || statut || ' ' || (SELECT count(*) FROM public.fiches_journal j WHERE j.fiche_id = f.id AND j.action = 'retour_implicite')
             FROM public.fiches_terrain f WHERE f.id = (SELECT id FROM fl)), 'saisie_terminee saisie 1', 'aucune validation d''office');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
