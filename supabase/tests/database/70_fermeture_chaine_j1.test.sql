-- Tests (D-086) : fermeture de la chaine J1 (migration 20261121205000) :
-- chevauchement de reconciliations (A, tous) cloturee puis (A, B), un voyage
-- dans une seule reconciliation (tous contrats), perimetre site des lignes de
-- reconciliation, des lectures IoT carburant, des lignes de facture Bolt et
-- du cache de quantite des articles. Tout est annule.
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

-- Droits : verifies par has_*_privilege, jamais par appel sous SET ROLE
SELECT is((SELECT count(*)::int FROM unnest(ARRAY['anon', 'authenticated']) u,
                 unnest(ARRAY['public.reconciliation_lignes', 'public.iot_fuel_readings', 'public.invoice_items']) t,
                 unnest(ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) p
            WHERE has_table_privilege(u, t, p)), 0,
  'lignes de reconciliation, lectures IoT, lignes de facture Bolt : aucune ecriture ni droit residuel des comptes');
SELECT ok(NOT has_table_privilege('anon', 'public.reconciliation_lignes', 'SELECT')
          AND NOT has_table_privilege('anon', 'public.iot_fuel_readings', 'SELECT')
          AND NOT has_table_privilege('anon', 'public.invoice_items', 'SELECT'), 'anon ne lit aucune des trois tables');
SELECT ok(NOT has_column_privilege('authenticated', 'public.stock_items', 'quantity_in_stock', 'SELECT')
          AND NOT has_column_privilege('anon', 'public.stock_items', 'quantity_in_stock', 'SELECT'),
  'cache tous depots quantity_in_stock : illisible par les comptes');
SELECT ok(has_column_privilege('authenticated', 'public.stock_items', 'name', 'SELECT')
          AND has_column_privilege('authenticated', 'public.stock_items', 'suivi', 'SELECT')
          AND has_column_privilege('authenticated', 'public.stock_items', 'minimum_threshold', 'SELECT'),
  'les autres colonnes du catalogue restent lisibles');
SELECT ok(NOT has_table_privilege('authenticated', 'public.stock_items', 'SELECT'),
  'plus de privilege de lecture sur la table entiere des articles');
SELECT ok(has_column_privilege('authenticated', 'public.stock_items', 'name', 'UPDATE')
          AND NOT has_column_privilege('authenticated', 'public.stock_items', 'quantity_in_stock', 'UPDATE'),
  'ecritures de colonnes du catalogue inchangees (D-044)');
SELECT ok(NOT has_function_privilege('authenticated', 'public.garde_voyage_une_reconciliation()', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.garde_voyage_une_reconciliation()', 'EXECUTE'),
  'garde interne fermee aux comptes');
SELECT is((SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public'
            AND tablename IN ('reconciliation_lignes', 'iot_fuel_readings', 'invoice_items')
            AND (cmd <> 'SELECT' OR coalesce(qual, '') !~ '(voyage_permis|vehicule_permis)')), 0,
  'les trois tables : lecture seule et toujours bornee au perimetre');
SELECT ok(EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.reconciliation_lignes'::regclass
                   AND tgname = 'garde_voyage_une_reconciliation' AND NOT tgisinternal),
  'garde « un voyage, une reconciliation » posee');

-- Donnees (periode vide de 2001)
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-d860-000000000001', 'global.d860@exemple.invalid'),
  ('00000000-0000-4000-d860-000000000002', 'borne.d860@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-d860-0000000000a1', 'Mine A D860', 'mine'),
  ('00000000-0000-4000-d860-0000000000a2', 'Depot B D860', 'depot'),
  ('00000000-0000-4000-d860-0000000000a3', 'Mine C D860', 'mine');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-d860-000000000001', 'operations_manager', 'Global D860', 'active', NULL),
  ('00000000-0000-4000-d860-000000000002', 'operations_manager', 'Borne D860', 'active', '00000000-0000-4000-d860-0000000000a1')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.droits_utilisateur (utilisateur, module, niveau)
SELECT u, m, 'ecriture' FROM unnest(ARRAY['00000000-0000-4000-d860-000000000001', '00000000-0000-4000-d860-000000000002']::uuid[]) u,
       unnest(ARRAY['trips', 'contracts', 'invoices', 'iot', 'stock']) m
ON CONFLICT (utilisateur, module) DO UPDATE SET niveau = EXCLUDED.niveau;
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status, site_id) VALUES
  ('00000000-0000-4000-d860-0000000000b1', 'TEST-D860-1', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-d860-0000000000a1'),
  ('00000000-0000-4000-d860-0000000000b3', 'TEST-D860-3', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-d860-0000000000a3');
INSERT INTO public.trips (id, reference, planned_date, vehicle_id, departure_site_id, arrival_site_id, etat, net_weight) VALUES
  ('00000000-0000-4000-d860-000000000201', 'TEST-D860-AB', '2001-03-10', '00000000-0000-4000-d860-0000000000b1',
   '00000000-0000-4000-d860-0000000000a1', '00000000-0000-4000-d860-0000000000a2', 'DELIVERED', 38),
  ('00000000-0000-4000-d860-000000000202', 'TEST-D860-CC', '2001-03-10', '00000000-0000-4000-d860-0000000000b3',
   '00000000-0000-4000-d860-0000000000a3', '00000000-0000-4000-d860-0000000000a3', 'DELIVERED', 38),
  ('00000000-0000-4000-d860-000000000203', 'TEST-D860-AB-AVR', '2001-04-10', '00000000-0000-4000-d860-0000000000b1',
   '00000000-0000-4000-d860-0000000000a1', '00000000-0000-4000-d860-0000000000a2', 'DELIVERED', 38);
INSERT INTO public.contrats (id, reference, intitule, nature, contrepartie, devise, date_debut, statut, delai_paiement_jours) VALUES
  ('00000000-0000-4000-d860-0000000000e1', 'TEST-D860-CBG1', 'Transport D860', 'client', 'CBG', 'USD', '2001-01-01', 'actif', 30),
  ('00000000-0000-4000-d860-0000000000e2', 'TEST-D860-CBG2', 'Transport D860 bis', 'client', 'CBG', 'USD', '2001-01-01', 'actif', 30);
-- Reconciliation (A, toutes destinations) d'avril 2001 deja cloturee.
INSERT INTO public.reconciliations (contrat_id, periode_debut, periode_fin, base_tonnage, tolerance_ecart_pct, site_depart_id, statut) VALUES
  ('00000000-0000-4000-d860-0000000000e1', '2001-04-01', '2001-04-30', 'charge', 5, '00000000-0000-4000-d860-0000000000a1', 'cloturee');

-- 1. Chevauchement (constat D-078 n 5) -------------------------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-d860-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.ouvrir_reconciliation('00000000-0000-4000-d860-0000000000e1', '2001-04-15', '2001-04-30',
  'charge', 5, '00000000-0000-4000-d860-0000000000a1', '00000000-0000-4000-d860-0000000000a2')$$, '22023', NULL,
  '(A, tous) cloturee puis (A, B) sur la meme periode : refuse');
SELECT throws_ok($$SELECT public.ouvrir_reconciliation('00000000-0000-4000-d860-0000000000e1', '2001-04-01', '2001-04-30',
  'charge', 5, NULL, '00000000-0000-4000-d860-0000000000a2')$$, '22023', NULL,
  '(tous, B) sur une periode couverte par (A, tous) : refuse (NULL = tous les sites)');
SELECT lives_ok($$SELECT public.ouvrir_reconciliation('00000000-0000-4000-d860-0000000000e1', '2001-04-01', '2001-04-30',
  'charge', 5, '00000000-0000-4000-d860-0000000000a3', NULL)$$, 'depart disjoint sur la meme periode : accepte');

-- 2. Un voyage, une seule reconciliation, tous contrats ---------------------
CREATE TEMP TABLE r1 AS SELECT public.ouvrir_reconciliation('00000000-0000-4000-d860-0000000000e1', '2001-03-01', '2001-03-31',
  'charge', 5, '00000000-0000-4000-d860-0000000000a1', NULL) AS id;
SELECT is((SELECT count(*)::int FROM public.reconciliation_lignes WHERE reconciliation_id = (SELECT id FROM r1)), 1,
  'reconciliation de mars (A, tous) : le voyage A -> B en ligne');
SELECT throws_ok($$SELECT public.ouvrir_reconciliation('00000000-0000-4000-d860-0000000000e2', '2001-03-01', '2001-03-31',
  'charge', 5, '00000000-0000-4000-d860-0000000000a1', '00000000-0000-4000-d860-0000000000a2')$$, '23505', NULL,
  'autre contrat client, memes periode et sites : le voyage deja en ligne est refuse (double facturation)');
SELECT lives_ok($$SELECT public.actualiser_reconciliation((SELECT id FROM r1))$$,
  'la reconciliation qui porte deja le voyage s''actualise normalement');
CREATE TEMP TABLE r3 AS SELECT public.ouvrir_reconciliation('00000000-0000-4000-d860-0000000000e2', '2001-03-01', '2001-03-31',
  'charge', 5, '00000000-0000-4000-d860-0000000000a3', NULL) AS id;
RESET ROLE;
SELECT throws_ok($$INSERT INTO public.reconciliation_lignes (reconciliation_id, trip_id, reference, date_voyage, etat)
  VALUES ((SELECT id FROM r3), '00000000-0000-4000-d860-000000000201', 'TEST-D860-AB', '2001-03-10', 'DELIVERED')$$, '23505', NULL,
  'garde serveur : meme une insertion directe ne porte pas un voyage dans deux reconciliations');
SELECT is((SELECT count(*)::int FROM (SELECT trip_id FROM public.reconciliation_lignes GROUP BY trip_id HAVING count(*) > 1) d), 0,
  'requete de controle : aucun voyage dans deux reconciliations');

-- 3. Perimetre de lecture ----------------------------------------------------
INSERT INTO public.iot_devices (device_id, device_type, vehicle_id) VALUES
  ('TEST-D860-CAPT1', 'fuel_sensor', '00000000-0000-4000-d860-0000000000b1'),
  ('TEST-D860-CAPT3', 'fuel_sensor', '00000000-0000-4000-d860-0000000000b3'),
  ('TEST-D860-CAPT0', 'fuel_sensor', NULL);
INSERT INTO public.iot_fuel_readings (device_id, vehicle_id, reading_timestamp, fuel_level_liters) VALUES
  ('TEST-D860-CAPT1', '00000000-0000-4000-d860-0000000000b1', '2001-03-10 08:00+00', 300),
  ('TEST-D860-CAPT3', '00000000-0000-4000-d860-0000000000b3', '2001-03-10 08:00+00', 200),
  ('TEST-D860-CAPT0', NULL, '2001-03-10 08:00+00', 100);
INSERT INTO public.invoice_items (trip_id, description) VALUES
  ('00000000-0000-4000-d860-000000000201', 'TEST-D860-LIGNE-A'),
  ('00000000-0000-4000-d860-000000000202', 'TEST-D860-LIGNE-C'),
  (NULL, 'TEST-D860-LIGNE-0');

SELECT pg_temp.se_connecter('00000000-0000-4000-d860-000000000002');
SET LOCAL ROLE authenticated;
SELECT is((SELECT array_agg(reference ORDER BY reference) FROM public.reconciliation_lignes
            WHERE reconciliation_id IN ((SELECT id FROM r1), (SELECT id FROM r3))), ARRAY['TEST-D860-AB'],
  'profil borne au site A : seules les lignes de ses voyages (pas celles du site C)');
SELECT is((SELECT array_agg(device_id ORDER BY device_id) FROM public.iot_fuel_readings WHERE device_id LIKE 'TEST-D860-%'),
  ARRAY['TEST-D860-CAPT1'], 'profil borne : lectures IoT des seuls engins de son site (ni autre site ni sans engin)');
SELECT is((SELECT array_agg(description ORDER BY description) FROM public.invoice_items WHERE description LIKE 'TEST-D860-%'),
  ARRAY['TEST-D860-LIGNE-A'], 'profil borne : lignes de facture Bolt de ses seuls voyages');

SELECT pg_temp.se_connecter('00000000-0000-4000-d860-000000000001');
SELECT is((SELECT count(*)::int FROM public.reconciliation_lignes
            WHERE reconciliation_id IN ((SELECT id FROM r1), (SELECT id FROM r3))), 2, 'profil global : toutes les lignes');
SELECT is((SELECT count(*)::int FROM public.iot_fuel_readings WHERE device_id LIKE 'TEST-D860-%'), 3,
  'profil global : toutes les lectures IoT, y compris sans engin');
SELECT is((SELECT count(*)::int FROM public.invoice_items WHERE description LIKE 'TEST-D860-%'), 3,
  'profil global : toutes les lignes de facture Bolt, y compris sans voyage');

SELECT * FROM finish();
ROLLBACK;
