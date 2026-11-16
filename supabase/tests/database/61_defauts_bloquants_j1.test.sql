-- Tests (D-078) : defauts bloquants de la chaine J1 (migration
-- 20261121160000) : gestion des shifts, fiche de rotations sur un trajet
-- inter-sites, pesee a l'arrivee indissociable du ticket CBG, rattachement
-- d'un ticket a un voyage livre, vraisemblance du net, perimetre de la
-- planification, facture du loueur en une transaction. Tout est annule.
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

SELECT plan(58);

-- Droits : aucune ecriture directe, fonctions fermees a anon
SELECT is((SELECT count(*)::int FROM unnest(ARRAY['anon', 'authenticated']) u,
                 unnest(ARRAY['public.work_shifts', 'public.journal_shifts']) t,
                 unnest(ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p
            WHERE has_table_privilege(u, t, p)), 0, 'shifts et journal : aucune ecriture directe des comptes');
SELECT is((SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'work_shifts' AND cmd <> 'SELECT'), 0,
  'shifts : plus de politique d''ecriture heritee');
SELECT ok(NOT has_table_privilege('anon', 'public.work_shifts', 'SELECT'), 'anon ne lit pas les shifts');
SELECT is((SELECT count(*)::int FROM unnest(ARRAY[
    'public.definir_shift(uuid, text, text, time, time, integer, boolean, text)',
    'public.desactiver_shift(uuid, text)',
    'public.rattacher_ticket_cbg(uuid, text, numeric, numeric, timestamptz, text, text)',
    'public.saisir_facture_fournisseur(uuid, text, date, date, date, numeric, jsonb, numeric, text)',
    'public.definir_objectif(date, uuid, uuid, numeric, integer, integer, integer, text, text)',
    'public.annuler_objectif(uuid, text)',
    'public.saisir_rotation(uuid, uuid, jsonb)']) f
  WHERE has_function_privilege('anon', f, 'EXECUTE') OR NOT has_function_privilege('authenticated', f, 'EXECUTE')), 0,
  'fonctions d''ecriture : executables par authenticated seulement');
SELECT ok(NOT has_function_privilege('authenticated', 'public.controler_shift(uuid, text, text, time, time, integer, boolean)', 'EXECUTE'),
  'controle interne des shifts ferme aux comptes');

-- Donnees
DELETE FROM public.settings WHERE key = 'controle_depart_exige';
UPDATE public.work_shifts SET is_active = false;  -- shifts existants (production) neutralises pour le test
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-d780-000000000001', 'global.d780@exemple.invalid'),
  ('00000000-0000-4000-d780-000000000002', 'borne.d780@exemple.invalid'),
  ('00000000-0000-4000-d780-000000000003', 'chauffeur.d780@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-d780-0000000000a1', 'Mine D780', 'mine'),
  ('00000000-0000-4000-d780-0000000000a2', 'Depot CBG D780', 'depot'),
  ('00000000-0000-4000-d780-0000000000a3', 'Autre D780', 'mine');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-d780-000000000001', 'operations_manager', 'Global D780', 'active', NULL),
  ('00000000-0000-4000-d780-000000000002', 'operations_manager', 'Borne D780', 'active', '00000000-0000-4000-d780-0000000000a1'),
  ('00000000-0000-4000-d780-000000000003', 'driver', 'Chauffeur D780', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.droits_utilisateur (utilisateur, module, niveau)
SELECT u, m, 'ecriture' FROM unnest(ARRAY['00000000-0000-4000-d780-000000000001', '00000000-0000-4000-d780-000000000002']::uuid[]) u,
       unnest(ARRAY['settings', 'trips', 'planning', 'contracts', 'invoices']) m
ON CONFLICT (utilisateur, module) DO UPDATE SET niveau = EXCLUDED.niveau;
INSERT INTO public.droits_utilisateur (utilisateur, module, niveau) VALUES
  ('00000000-0000-4000-d780-000000000003', 'settings', 'aucun')
ON CONFLICT (utilisateur, module) DO UPDATE SET niveau = EXCLUDED.niveau;
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status, site_id) VALUES
  ('00000000-0000-4000-d780-0000000000b1', 'TEST-D780-1', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-d780-0000000000a1'),
  ('00000000-0000-4000-d780-0000000000b3', 'TEST-D780-3', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-d780-0000000000a3');
INSERT INTO public.drivers (id, name, license_number, license_category, license_expiry, hire_date, status, site_id) VALUES
  ('00000000-0000-4000-d780-0000000000c1', 'Chauffeur D780', 'D780-1', 'C', current_date + 400, '2020-01-01', 'active', '00000000-0000-4000-d780-0000000000a1'),
  ('00000000-0000-4000-d780-0000000000c3', 'Chauffeur D780 S3', 'D780-3', 'C', current_date + 400, '2020-01-01', 'active', '00000000-0000-4000-d780-0000000000a3');
-- Voyages poses directement (periode vide de 2001) : livre sans ticket,
-- en dechargement, hors perimetre ; un voyage pese en kg (net > capacite).
INSERT INTO public.trips (id, reference, planned_date, vehicle_id, departure_site_id, arrival_site_id, etat, net_weight) VALUES
  ('00000000-0000-4000-d780-000000000201', 'TEST-D780-LIV', '2001-05-11', '00000000-0000-4000-d780-0000000000b1',
   '00000000-0000-4000-d780-0000000000a1', '00000000-0000-4000-d780-0000000000a2', 'DELIVERED', 40),
  ('00000000-0000-4000-d780-000000000202', 'TEST-D780-DECH', '2001-05-11', '00000000-0000-4000-d780-0000000000b1',
   '00000000-0000-4000-d780-0000000000a1', '00000000-0000-4000-d780-0000000000a2', 'UNLOADING', 40),
  ('00000000-0000-4000-d780-000000000203', 'TEST-D780-HORS', '2001-05-11', '00000000-0000-4000-d780-0000000000b3',
   '00000000-0000-4000-d780-0000000000a3', '00000000-0000-4000-d780-0000000000a3', 'DELIVERED', 40),
  ('00000000-0000-4000-d780-000000000204', 'TEST-D780-KG', '2001-05-12', '00000000-0000-4000-d780-0000000000b1',
   '00000000-0000-4000-d780-0000000000a1', '00000000-0000-4000-d780-0000000000a2', 'DELIVERED', 40),
  ('00000000-0000-4000-d780-000000000205', 'TEST-D780-DECH2', '2001-05-11', '00000000-0000-4000-d780-0000000000b1',
   '00000000-0000-4000-d780-0000000000a1', '00000000-0000-4000-d780-0000000000a2', 'UNLOADING', 40);
INSERT INTO public.tickets_pesee_cbg (trip_id, site_id, ticket, brut, tare, mesure_le) VALUES
  ('00000000-0000-4000-d780-000000000204', '00000000-0000-4000-d780-0000000000a2', 'TEST-D780-TKG', 55000, 14300, '2001-05-12 10:00+00');
INSERT INTO public.contrats (id, reference, intitule, nature, contrepartie, devise, date_debut, statut, delai_paiement_jours) VALUES
  ('00000000-0000-4000-d780-0000000000e1', 'TEST-D780-CBG', 'Transport D780', 'client', 'CBG', 'USD', '2001-01-01', 'actif', 30),
  ('00000000-0000-4000-d780-0000000000e2', 'TEST-D780-LOC', 'Location D780', 'location', 'Neemba', 'USD', '2001-01-01', 'actif', 30);
INSERT INTO public.contrat_versions (id, contrat_id, numero, intitule, date_effet) VALUES
  ('00000000-0000-4000-d780-0000000000f1', '00000000-0000-4000-d780-0000000000e1', 0, 'Initial', '2001-01-01');

-- 1. Shifts ---------------------------------------------------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-d780-000000000003');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.definir_shift(NULL, 'jour-d780', 'Jour D780', '06:00', '18:00', 91)$$, '42501', NULL,
  'sans droit parametres : creation refusee');
SELECT pg_temp.se_connecter('00000000-0000-4000-d780-000000000002');
SELECT throws_ok($$SELECT public.definir_shift(NULL, 'jour-d780', 'Jour D780', '06:00', '18:00', 91)$$, '42501', NULL,
  'profil borne a un site : les shifts communs lui sont refuses');
SELECT throws_ok($$INSERT INTO public.work_shifts (name, display_name, start_time, end_time, shift_order) VALUES ('x', 'x', '01:00', '02:00', 99)$$,
  '42501', NULL, 'ecriture directe des shifts refusee');

SELECT pg_temp.se_connecter('00000000-0000-4000-d780-000000000001');
CREATE TEMP TABLE sj AS SELECT public.definir_shift(NULL, 'jour-d780', 'Jour D780', '06:00', '18:00', 91) AS id;
SELECT is((SELECT (display_name, start_time, end_time, is_active)::text FROM public.work_shifts WHERE id = (SELECT id FROM sj)),
  '("Jour D780",06:00:00,18:00:00,t)', 'shift de jour cree');
SELECT throws_ok($$SELECT public.definir_shift(NULL, 'autre-d780', 'jour d780 ', '20:00', '22:00', 92)$$, '23505', NULL,
  'libelle deja pris (casse et espaces ignores)');
SELECT throws_ok($$SELECT public.definir_shift(NULL, 'egal-d780', 'Egal D780', '08:00', '08:00', 92)$$, '22023', NULL,
  'heure de fin egale a l''heure de debut refusee');
SELECT throws_ok($$SELECT public.definir_shift(NULL, 'ordre-d780', 'Ordre D780', '20:00', '22:00', 91)$$, '23505', NULL,
  'ordre deja pris refuse');
CREATE TEMP TABLE sn AS SELECT public.definir_shift(NULL, 'nuit-d780', 'Nuit D780', '18:00', '06:00', 92) AS id;
SELECT ok((SELECT is_active FROM public.work_shifts WHERE id = (SELECT id FROM sn)), 'shift de nuit (fin le lendemain) accepte sans chevauchement');
SELECT throws_ok($$SELECT public.definir_shift(NULL, 'renfort-d780', 'Renfort D780', '04:00', '07:00', 93)$$, '22023', NULL,
  'chevauchement avec un shift actif, de part et d''autre de minuit, refuse');
SELECT lives_ok($$SELECT public.definir_shift(NULL, 'renfort-d780', 'Renfort D780', '04:00', '07:00', 93, false)$$,
  'un shift inactif peut recouvrir les autres');
SELECT throws_ok($$SELECT public.definir_shift((SELECT id FROM sj), 'jour-d780', 'Jour D780', '06:00', '17:00', 91)$$, '22023', NULL,
  'modification sans motif refusee');
SELECT lives_ok($$SELECT public.definir_shift((SELECT id FROM sj), 'jour-d780', 'Jour D780', '06:00', '17:30', 91, true, 'Horaire d''hiver')$$,
  'modification motivee');
SELECT is((SELECT end_time FROM public.work_shifts WHERE id = (SELECT id FROM sj)), '17:30'::time, 'horaire modifie');
SELECT throws_ok($$SELECT public.desactiver_shift((SELECT id FROM sj), ' ')$$, '22023', NULL, 'desactivation sans motif refusee');
SELECT lives_ok($$SELECT public.desactiver_shift((SELECT id FROM sj), 'Remplace par deux shifts')$$, 'desactivation motivee');
SELECT is((SELECT is_active FROM public.work_shifts WHERE id = (SELECT id FROM sj)), false, 'shift desactive, jamais supprime');
SELECT is((SELECT string_agg(action, ',' ORDER BY le, action) FROM public.journal_shifts WHERE shift_id = (SELECT id FROM sj)),
  'creation,desactivation,modification', 'creation, modification et desactivation journalisees');
SELECT is((SELECT apres ->> 'end_time' FROM public.journal_shifts WHERE shift_id = (SELECT id FROM sj) AND action = 'modification'),
  '17:30:00', 'le journal garde la valeur apres modification');
SELECT throws_ok($$SELECT public.desactiver_shift((SELECT id FROM sj), 'deux fois')$$, '22023', NULL, 'shift deja inactif');
RESET ROLE;
SELECT throws_ok($$UPDATE public.journal_shifts SET motif = 'x'$$, '42501', NULL, 'journal des shifts immuable');

-- 2. Fiche de rotations sur un trajet inter-sites -------------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-d780-000000000002');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE vi AS SELECT public.creer_voyage(current_date, '00000000-0000-4000-d780-0000000000a1', '00000000-0000-4000-d780-0000000000a2',
  '00000000-0000-4000-d780-0000000000b1', '00000000-0000-4000-d780-0000000000c1') AS id;
CREATE TEMP TABLE fi AS SELECT public.preparer_fiche('rotations', current_date, '00000000-0000-4000-d780-0000000000a1', (SELECT id FROM sn),
  '00000000-0000-4000-d780-0000000000b1', '00000000-0000-4000-d780-0000000000c1', NULL, '{"pesee":"arrivee"}') AS id;
SELECT is(public.saisir_rotation((SELECT id FROM fi), (SELECT id FROM vi), jsonb_build_array(
  jsonb_build_object('etat', 'AT_LOADING', 'quand', now() - interval '5 hours'),
  jsonb_build_object('etat', 'LOADING', 'quand', now() - interval '4 hours 50 minutes'),
  jsonb_build_object('etat', 'LOADED', 'quand', now() - interval '4 hours 40 minutes'),
  jsonb_build_object('etat', 'IN_TRANSIT', 'quand', now() - interval '4 hours 30 minutes'),
  jsonb_build_object('etat', 'AT_DESTINATION', 'quand', now() - interval '2 hours'),
  jsonb_build_object('etat', 'UNLOADING', 'quand', now() - interval '1 hour 55 minutes'),
  jsonb_build_object('etat', 'WEIGHED_IN', 'quand', now() - interval '1 hour 50 minutes',
    'donnees', jsonb_build_object('brut', 54.2, 'tare', 14.1, 'ticket', 'TEST-D780-T1')),
  jsonb_build_object('etat', 'DELIVERED', 'quand', now() - interval '1 hour 45 minutes'))), 'DELIVERED',
  'fiche du site de depart : le ticket CBG du depot d''arrivee est rattache (Nimba -> depot CBG)');
SELECT is((SELECT (site_id, net, origine)::text FROM public.tickets_pesee_cbg WHERE trip_id = (SELECT id FROM vi)),
  '(00000000-0000-4000-d780-0000000000a2,40.1,fiche)', 'le ticket porte le site d''arrivee et son origine');

RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d780-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE vi2 AS SELECT public.creer_voyage(current_date, '00000000-0000-4000-d780-0000000000a1', '00000000-0000-4000-d780-0000000000a2',
  '00000000-0000-4000-d780-0000000000b1', '00000000-0000-4000-d780-0000000000c1') AS id;
CREATE TEMP TABLE f3 AS SELECT public.preparer_fiche('rotations', current_date, '00000000-0000-4000-d780-0000000000a3', NULL,
  '00000000-0000-4000-d780-0000000000b1', NULL, NULL, '{"pesee":"arrivee"}') AS id;
SELECT throws_ok($$SELECT public.saisir_rotation((SELECT id FROM f3), (SELECT id FROM vi2), jsonb_build_array(
  jsonb_build_object('etat', 'AT_LOADING', 'quand', now() - interval '40 minutes'),
  jsonb_build_object('etat', 'LOADING', 'quand', now() - interval '35 minutes'),
  jsonb_build_object('etat', 'LOADED', 'quand', now() - interval '30 minutes'),
  jsonb_build_object('etat', 'IN_TRANSIT', 'quand', now() - interval '25 minutes'),
  jsonb_build_object('etat', 'AT_DESTINATION', 'quand', now() - interval '20 minutes'),
  jsonb_build_object('etat', 'UNLOADING', 'quand', now() - interval '15 minutes'),
  jsonb_build_object('etat', 'WEIGHED_IN', 'quand', now() - interval '10 minutes',
    'donnees', jsonb_build_object('brut', 54, 'tare', 14, 'ticket', 'TEST-D780-T2'))))$$, '22023', NULL,
  'fiche d''un site etranger au trajet : ticket refuse');
SELECT is((SELECT etat FROM public.trips WHERE id = (SELECT id FROM vi2)), 'ASSIGNED', 'refus : aucune etape appliquee');

-- 4. Pesee a l'arrivee = ticket CBG ---------------------------------------
SELECT throws_ok($$SELECT public.avancer_voyage('00000000-0000-4000-d780-000000000205', 'WEIGHED_IN', now() - interval '1 minute', NULL,
  '{"brut": 50, "tare": 12, "ticket": "TEST-D780-DIRECT"}')$$, '22023', NULL,
  'pesee a l''arrivee sans creation du ticket (appel direct) refusee');
SELECT throws_ok($$SELECT public.avancer_voyage('00000000-0000-4000-d780-000000000205', 'WEIGHED_IN', now() - interval '1 minute', NULL,
  '{"brut": 50, "tare": 12}')$$, '22023', NULL, 'pesee a l''arrivee sans ticket refusee');

SELECT pg_temp.se_connecter('00000000-0000-4000-d780-000000000002');
SELECT lives_ok($$SELECT public.rattacher_ticket_cbg('00000000-0000-4000-d780-000000000202', 'TEST-D780-T3', 52, 13,
  '2001-05-11 11:00+00', 'BL-D780-3')$$, 'ticket saisi a la reception dans le meme geste');
SELECT is((SELECT etat FROM public.trips WHERE id = '00000000-0000-4000-d780-000000000202'), 'WEIGHED_IN', 'voyage pese a l''arrivee');
SELECT is((SELECT (origine, net, document_ref)::text FROM public.tickets_pesee_cbg WHERE trip_id = '00000000-0000-4000-d780-000000000202'),
  '(reception,39,BL-D780-3)', 'ticket de reception cree');
SELECT is((SELECT donnees ->> 'ticket' FROM public.trip_events WHERE trip_id = '00000000-0000-4000-d780-000000000202' AND etat_apres = 'WEIGHED_IN'),
  'TEST-D780-T3', 'le journal du voyage porte le ticket');
SELECT throws_ok($$SELECT public.rattacher_ticket_cbg('00000000-0000-4000-d780-000000000201', 'TEST-D780-T4', 52, 13, '2001-05-11 12:00+00')$$,
  '22023', NULL, 'rattachement a un voyage livre sans motif refuse');
SELECT lives_ok($$SELECT public.rattacher_ticket_cbg('00000000-0000-4000-d780-000000000201', 'TEST-D780-T4', 52, 13, '2001-05-11 12:00+00',
  NULL, 'Ticket CBG remis apres la livraison')$$, 'rattachement motive a un voyage livre sans ticket');
SELECT is((SELECT (origine, motif_rattachement, site_id)::text FROM public.tickets_pesee_cbg WHERE trip_id = '00000000-0000-4000-d780-000000000201'),
  '(rattachement,"Ticket CBG remis apres la livraison",00000000-0000-4000-d780-0000000000a2)', 'origine et motif conserves');
SELECT is((SELECT etat FROM public.trips WHERE id = '00000000-0000-4000-d780-000000000201'), 'DELIVERED', 'l''etat du voyage livre ne change pas');
SELECT throws_ok($$SELECT public.rattacher_ticket_cbg('00000000-0000-4000-d780-000000000201', 'TEST-D780-T5', 52, 13, '2001-05-11 12:00+00',
  NULL, 'encore')$$, '22023', NULL, 'un second ticket passe par la rectification');
SELECT throws_ok($$SELECT public.rattacher_ticket_cbg('00000000-0000-4000-d780-000000000205', 'test-d780-t4 ', 52, 13, '2001-05-11 12:00+00')$$,
  '23505', NULL, 'numero de ticket deja utilise sur un autre voyage');
SELECT throws_ok($$SELECT public.rattacher_ticket_cbg('00000000-0000-4000-d780-000000000203', 'TEST-D780-T6', 52, 13, '2001-05-11 12:00+00', NULL, 'x')$$,
  'P0002', 'Voyage introuvable', 'voyage hors perimetre : indiscernable d''un voyage inexistant');
SELECT throws_ok($$SELECT public.rattacher_ticket_cbg('00000000-0000-4000-d780-000000000205', 'TEST-D780-T7', 13, 52, '2001-05-11 12:00+00')$$,
  '22023', NULL, 'tare superieure au brut refusee');

-- 3. Vraisemblance : net superieur a la capacite du camion -----------------
SELECT pg_temp.se_connecter('00000000-0000-4000-d780-000000000001');
CREATE TEMP TABLE rc AS SELECT public.ouvrir_reconciliation('00000000-0000-4000-d780-0000000000e1', '2001-05-01', '2001-05-31',
  'charge', 5, '00000000-0000-4000-d780-0000000000a1', NULL) AS id;
SELECT ok((SELECT anomalies @> ARRAY['net_superieur_capacite'] FROM public.reconciliation_lignes
            WHERE reconciliation_id = (SELECT id FROM rc) AND reference = 'TEST-D780-KG'),
  'ticket saisi en kg (net 40 700 pour un camion de 40 t) : anomalie signalee');
SELECT ok(NOT (SELECT anomalies @> ARRAY['net_superieur_capacite'] FROM public.reconciliation_lignes
            WHERE reconciliation_id = (SELECT id FROM rc) AND reference = 'TEST-D780-LIV'),
  'net vraisemblable : pas d''anomalie de capacite');
SELECT ok(public.ligne_bloquee(ARRAY['net_superieur_capacite']), 'la ligne attend une decision');
SELECT lives_ok($$SELECT public.decider_ligne_reconciliation((SELECT id FROM public.reconciliation_lignes
  WHERE reconciliation_id = (SELECT id FROM rc) AND reference = 'TEST-D780-KG'), 'exclue', 'Ticket en kg : a rectifier')$$,
  'decision motivee possible (aucun refus silencieux)');

-- 6. Planification : perimetre de site -------------------------------------
CREATE TEMP TABLE o3 AS SELECT public.definir_objectif('2001-06-01', '00000000-0000-4000-d780-0000000000a3', NULL, 500) AS id;
SELECT pg_temp.se_connecter('00000000-0000-4000-d780-000000000002');
SELECT throws_ok($$SELECT public.definir_objectif('2001-06-01', '00000000-0000-4000-d780-0000000000a3', NULL, 600, NULL, NULL, NULL, 'x')$$,
  '42501', NULL, 'compte borne : objectif d''un autre site refuse');
SELECT lives_ok($$SELECT public.definir_objectif('2001-06-01', '00000000-0000-4000-d780-0000000000a1', NULL, 600)$$,
  'compte borne : objectif de son site');
SELECT throws_ok($$SELECT public.annuler_objectif((SELECT id FROM o3), 'x')$$, 'P0002', 'Objectif actif introuvable',
  'compte borne : annulation d''un objectif d''un autre site refusee');
SELECT throws_ok($$SELECT public.annuler_objectif(gen_random_uuid(), 'x')$$, 'P0002', 'Objectif actif introuvable',
  'meme message pour un objectif inexistant (aucun oracle)');
RESET ROLE;
SELECT is((SELECT statut FROM public.objectifs_production WHERE id = (SELECT id FROM o3)), 'actif', 'l''objectif de l''autre site reste actif');

-- 11. Facture du loueur en une transaction ---------------------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-d780-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.saisir_facture_fournisseur('00000000-0000-4000-d780-0000000000e2', 'NB-D780-1', '2001-06-30', '2001-06-01', '2001-06-30',
  1000, '[{"libelle": "Engin A", "montant_facture": 600}, {"libelle": "Engin B", "montant_facture": -1}]')$$, '22023', NULL,
  'ligne refusee : toute la facture est refusee');
SELECT is((SELECT count(*)::int FROM public.factures_fournisseur WHERE numero_fournisseur = 'NB-D780-1'), 0, 'aucune facture orpheline');
CREATE TEMP TABLE ff AS SELECT public.saisir_facture_fournisseur('00000000-0000-4000-d780-0000000000e2', 'NB-D780-1', '2001-06-30', '2001-06-01',
  '2001-06-30', 1000, '[{"libelle": "Engin A", "montant_facture": 600, "quantite_facturee": 200, "unite_facturee": "heure", "taux_facture": 3},
  {"vehicle_id": "00000000-0000-4000-d780-0000000000b1", "montant_facture": 400}]') AS id;
SELECT is((SELECT count(*)::int FROM public.factures_fournisseur_lignes WHERE facture_id = (SELECT id FROM ff)), 2, 'en-tete et lignes enregistres ensemble');
SELECT is((SELECT (devise, statut)::text FROM public.factures_fournisseur WHERE id = (SELECT id FROM ff)), '(USD,saisie)', 'devise du contrat, facture a controler');
SELECT is((SELECT jsonb_array_length(apres -> 'lignes') FROM public.journal_contrats WHERE ligne_id = (SELECT id FROM ff)), 2,
  'saisie journalisee au dossier contractuel');
SELECT throws_ok($$SELECT public.saisir_facture_fournisseur('00000000-0000-4000-d780-0000000000e1', 'NB-D780-2', '2001-06-30', '2001-06-01', '2001-06-30',
  1, '[{"libelle": "x", "montant_facture": 1}]')$$, '22023', NULL, 'contrat client refuse pour une facture de loueur');

SELECT * FROM finish();
ROLLBACK;
