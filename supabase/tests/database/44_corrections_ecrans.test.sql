-- Tests (D-061, migration 20261118180000) : corrections des ecrans herites.
-- Ordres de travail (numero serveur, annulation motivee, pieces sorties du
-- registre des stocks), plannings preventifs, archivage des chauffeurs,
-- presences (correction par nouvelle saisie, annulation motivee),
-- parametres lus par le serveur, georeperage (politiques, pas de
-- suppression ni de detection inventee). Tout est annule.
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

-- Cache tous depots (D-044), illisible par les comptes depuis D-086 : lu
-- par le proprietaire du test.
CREATE FUNCTION pg_temp.cache_article(p_id uuid) RETURNS public.stock_items.quantity_in_stock%TYPE
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT quantity_in_stock FROM public.stock_items WHERE id = p_id;
$$;

SELECT plan(47);

-- Donnees de test (sans JWT : gardes inactives).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-9d00-000000000001', 'admin.d061@exemple.invalid'),
  ('00000000-0000-4000-9d00-000000000002', 'admin.site.d061@exemple.invalid'),
  ('00000000-0000-4000-9d00-000000000003', 'comptable.d061@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-9d00-0000000000a1', 'Site A D-061', 'mine'),
  ('00000000-0000-4000-9d00-0000000000a2', 'Site B D-061', 'depot');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-9d00-000000000001', 'admin', 'Admin global D-061', 'active', NULL),
  ('00000000-0000-4000-9d00-000000000002', 'admin', 'Admin site A D-061', 'active', '00000000-0000-4000-9d00-0000000000a1'),
  ('00000000-0000-4000-9d00-000000000003', 'accountant', 'Comptable D-061', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, site_id) VALUES
  ('00000000-0000-4000-9d00-0000000000b1', 'TEST-D061-A', 'Test', 40, 'tipper', '00000000-0000-4000-9d00-0000000000a1'),
  ('00000000-0000-4000-9d00-0000000000b2', 'TEST-D061-B', 'Test', 40, 'tipper', '00000000-0000-4000-9d00-0000000000a2');
INSERT INTO public.warehouses (id, name, code, warehouse_type, site_id) VALUES
  ('00000000-0000-4000-9d00-0000000000c1', 'Magasin D-061', 'TEST-MAG-D061', 'main', '00000000-0000-4000-9d00-0000000000a1'),
  ('00000000-0000-4000-9d00-0000000000c2', 'Atelier D-061', 'TEST-ATL-D061', 'garage', '00000000-0000-4000-9d00-0000000000a1');
INSERT INTO public.stock_items (id, item_code, name, unit_of_measure, unit_price) VALUES
  ('00000000-0000-4000-9d00-0000000000d1', 'TEST-FILTRE-D061', 'Filtre a huile', 'piece', 1000);
INSERT INTO public.maintenance_orders (id, vehicle_id, maintenance_type, description, status, work_order_number) VALUES
  ('00000000-0000-4000-9d00-000000000022', '00000000-0000-4000-9d00-0000000000b2', 'corrective', 'TEST-D061 site B', 'open', 'TEST-OT-B');
INSERT INTO public.drivers (id, license_number, license_category, license_expiry, hire_date, name) VALUES
  ('00000000-0000-4000-9d00-0000000000e1', 'TEST-PERMIS-D061', 'C', '2030-01-01', '2020-01-01', 'Chauffeur D-061');
INSERT INTO public.trips (id, reference, planned_date, vehicle_id, driver_id, departure_site_id, arrival_site_id, etat) VALUES
  ('00000000-0000-4000-9d00-000000000031', 'TEST-D061-V', '2001-09-01', '00000000-0000-4000-9d00-0000000000b1',
   '00000000-0000-4000-9d00-0000000000e1', '00000000-0000-4000-9d00-0000000000a1', '00000000-0000-4000-9d00-0000000000a1', 'IN_TRANSIT');
INSERT INTO public.employees (id, employee_number, first_name, last_name, "position", department) VALUES
  ('00000000-0000-4000-9d00-0000000000f1', 'TEST-EMP-D061', 'Fatou', 'Test', 'Chauffeur', 'Operations');
INSERT INTO public.geofence_zones (id, name, zone_type, geometry_type, center_lat, center_lng, radius_meters, site_id) VALUES
  ('00000000-0000-4000-9d00-000000000041', 'TEST-D061 zone B', 'mine', 'circle', 10.5, -13.5, 500, '00000000-0000-4000-9d00-0000000000a2');
INSERT INTO public.geofence_zones (id, name, zone_type, geometry_type, polygon_coordinates, site_id) VALUES
  ('00000000-0000-4000-9d00-000000000042', 'TEST-D061 polygone', 'mine', 'polygon', '[[10,-13],[10.1,-13],[10.1,-13.1]]', '00000000-0000-4000-9d00-0000000000a1');
INSERT INTO public.geofence_violations (id, zone_id, vehicle_id, violation_type, status) VALUES
  ('00000000-0000-4000-9d00-000000000051', '00000000-0000-4000-9d00-000000000042', '00000000-0000-4000-9d00-0000000000b1', 'unauthorized_entry', 'open');

SELECT is(public.is_point_in_geofence(10.05, -13.05, '00000000-0000-4000-9d00-000000000042'), NULL,
  'polygone sans PostGIS : indetermine, jamais declare dedans');
SELECT ok(NOT has_function_privilege('authenticated', 'public.detect_geofence_violations()', 'EXECUTE'),
  'detection heritee non executable par les comptes');

-- Parametres lus par le serveur : format controle.
SELECT throws_ok($$INSERT INTO public.settings (key, value) VALUES ('tolerance_poids_cbg_t', '{"value": "abc"}')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value$$,
  '22023', NULL, 'tolerance CBG : nombre attendu');
SELECT throws_ok($$INSERT INTO public.settings (key, value) VALUES ('mfa_exige', '{"value": "oui"}')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value$$,
  '22023', NULL, 'mfa_exige : booleen attendu');
SELECT lives_ok($$INSERT INTO public.settings (key, value) VALUES ('tolerance_poids_cbg_t', '{"value": "0.5"}')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value$$, 'tolerance CBG valide acceptee');

-- 1. Ordres de travail -------------------------------------------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-9d00-000000000001');
SET LOCAL ROLE authenticated;
INSERT INTO public.maintenance_orders (id, vehicle_id, maintenance_type, title, description)
  VALUES ('00000000-0000-4000-9d00-000000000021', '00000000-0000-4000-9d00-0000000000b1', 'corrective', 'Fuite', 'TEST-D061 A');
SELECT matches((SELECT work_order_number FROM public.maintenance_orders WHERE id = '00000000-0000-4000-9d00-000000000021'),
  '^OT-[0-9]{4}-[0-9]{5}$', 'numero d''ordre attribue par le serveur');
SELECT is((SELECT requested_by FROM public.maintenance_orders WHERE id = '00000000-0000-4000-9d00-000000000021'),
  '00000000-0000-4000-9d00-000000000001'::uuid, 'demandeur = compte connecte');
SELECT throws_ok($$UPDATE public.maintenance_orders SET work_order_number = 'X' WHERE id = '00000000-0000-4000-9d00-000000000021'$$,
  '42501', NULL, 'numero non modifiable');
SELECT throws_ok($$UPDATE public.maintenance_orders SET status = 'cancelled' WHERE id = '00000000-0000-4000-9d00-000000000021'$$,
  '42501', NULL, 'annulation directe refusee');
SELECT throws_ok($$SELECT public.annuler_ordre_travail('00000000-0000-4000-9d00-000000000021', ' ')$$,
  '22023', NULL, 'annulation sans motif refusee');
SELECT throws_ok($$DELETE FROM public.maintenance_orders WHERE id = '00000000-0000-4000-9d00-000000000021'$$,
  '42501', NULL, 'ordre non supprimable');

-- Pieces : sortie du registre des stocks rattachee a l'ordre.
SELECT lives_ok($$SELECT public.mouvement_stock('00000000-0000-4000-9d00-0000000000d1', 'entry', 10, NULL,
  '00000000-0000-4000-9d00-0000000000c1')$$, 'entree en stock');
SELECT lives_ok($$SELECT public.mouvement_stock('00000000-0000-4000-9d00-0000000000d1', 'exit', 3,
  '00000000-0000-4000-9d00-0000000000c1', NULL, now(), 1000, NULL, NULL, '00000000-0000-4000-9d00-000000000021')$$,
  'sortie de 3 pieces imputee a l''ordre');
SELECT is((SELECT vehicle_id FROM public.stock_movements WHERE maintenance_order_id = '00000000-0000-4000-9d00-000000000021'),
  '00000000-0000-4000-9d00-0000000000b1'::uuid, 'engin de l''ordre repris sur le mouvement');
SELECT is(pg_temp.cache_article('00000000-0000-4000-9d00-0000000000d1'), 7,
  'le stock du registre baisse (pas de second inventaire)');
SELECT throws_ok($$SELECT public.mouvement_stock('00000000-0000-4000-9d00-0000000000d1', 'return', 5, NULL,
  '00000000-0000-4000-9d00-0000000000c1', now(), NULL, NULL, NULL, '00000000-0000-4000-9d00-000000000021')$$,
  '22023', NULL, 'retour superieur aux pieces sorties refuse');
SELECT throws_ok($$SELECT public.mouvement_stock('00000000-0000-4000-9d00-0000000000d1', 'transfer', 1,
  '00000000-0000-4000-9d00-0000000000c1', '00000000-0000-4000-9d00-0000000000c2', now(), NULL, NULL, NULL, '00000000-0000-4000-9d00-000000000021')$$,
  '22023', NULL, 'seules sortie et retour se rattachent a un ordre');
SELECT is((SELECT count(*)::int FROM public.pieces_ordre_travail('00000000-0000-4000-9d00-000000000021')), 1,
  'pieces de l''ordre restituees');
SELECT throws_ok($$SELECT public.annuler_ordre_travail('00000000-0000-4000-9d00-000000000021', 'Doublon')$$,
  '22023', NULL, 'annulation refusee tant que des pieces restent imputees');
SELECT lives_ok($$SELECT public.mouvement_stock('00000000-0000-4000-9d00-0000000000d1', 'return', 3, NULL,
  '00000000-0000-4000-9d00-0000000000c1', now(), NULL, NULL, NULL, '00000000-0000-4000-9d00-000000000021')$$,
  'retour des pieces au stock');
SELECT lives_ok($$SELECT public.annuler_ordre_travail('00000000-0000-4000-9d00-000000000021', 'Doublon')$$,
  'annulation motivee');
SELECT results_eq($$SELECT status::text, motif_annulation, annule_par FROM public.maintenance_orders
  WHERE id = '00000000-0000-4000-9d00-000000000021'$$,
  $$VALUES ('cancelled', 'Doublon', '00000000-0000-4000-9d00-000000000001'::uuid)$$, 'annulation journalisee sur l''ordre');
SELECT throws_ok($$UPDATE public.maintenance_orders SET notes = 'x' WHERE id = '00000000-0000-4000-9d00-000000000021'$$,
  '42501', NULL, 'ordre annule non modifiable');
SELECT throws_ok($$SELECT public.mouvement_stock('00000000-0000-4000-9d00-0000000000d1', 'exit', 1,
  '00000000-0000-4000-9d00-0000000000c1', NULL, now(), NULL, NULL, NULL, '00000000-0000-4000-9d00-000000000021')$$,
  '22023', NULL, 'aucune piece sur un ordre annule');

-- Un ordre termine ne se rouvre pas.
INSERT INTO public.maintenance_orders (id, vehicle_id, maintenance_type, description)
  VALUES ('00000000-0000-4000-9d00-000000000023', '00000000-0000-4000-9d00-0000000000b1', 'preventive', 'TEST-D061 C');
UPDATE public.maintenance_orders SET status = 'completed', completion_date = '2001-09-02' WHERE id = '00000000-0000-4000-9d00-000000000023';
SELECT throws_ok($$UPDATE public.maintenance_orders SET status = 'open' WHERE id = '00000000-0000-4000-9d00-000000000023'$$,
  '22023', NULL, 'ordre termine non rouvert');

-- 2. Planning preventif : colonnes alignees, echeance seulement si connue.
INSERT INTO public.maintenance_schedules (id, vehicle_id, title, maintenance_type, interval_km, last_maintenance_km)
  VALUES ('00000000-0000-4000-9d00-000000000061', '00000000-0000-4000-9d00-0000000000b1', 'Vidange', 'Vidange moteur', 10000, 50000);
SELECT results_eq($$SELECT frequency_type, frequency_value, next_service_km, next_service_date, active
  FROM public.maintenance_schedules WHERE id = '00000000-0000-4000-9d00-000000000061'$$,
  $$VALUES ('km'::text, 10000::numeric, 60000::numeric, NULL::date, true)$$, 'planning : colonnes heritees alignees, date inconnue non inventee');
SELECT throws_ok($$INSERT INTO public.maintenance_schedules (vehicle_id, title, maintenance_type)
  VALUES ('00000000-0000-4000-9d00-0000000000b1', 'Sans intervalle', 'Autre')$$, '22023', NULL, 'planning sans intervalle refuse');

-- 3. Chauffeurs.
SELECT ok(NOT has_table_privilege('authenticated', 'public.drivers', 'DELETE'), 'dossier chauffeur non supprimable (D-042)');
SELECT throws_ok($$UPDATE public.drivers SET status = 'terminated' WHERE id = '00000000-0000-4000-9d00-0000000000e1'$$,
  '22023', NULL, 'pas d''archivage pendant un voyage en cours');

-- 4. Presences.
SELECT ok(NOT has_table_privilege('authenticated', 'public.parts_inventory', 'INSERT')
          AND NOT has_table_privilege('authenticated', 'public.maintenance_parts', 'INSERT'),
  'second inventaire de pieces en lecture seule');
CREATE TEMP TABLE p1 AS SELECT public.enregistrer_presence('00000000-0000-4000-9d00-0000000000f1', current_date - 1, 'present',
  '07:00', '15:30') AS id;
SELECT is((SELECT hours_worked FROM public.employee_attendance WHERE id = (SELECT id FROM p1)), 8.50::numeric(4,2),
  'heures calculees depuis les horaires');
SELECT throws_ok($$SELECT public.enregistrer_presence('00000000-0000-4000-9d00-0000000000f1', current_date - 1, 'late', '08:00', '15:30')$$,
  '23505', NULL, 'une seule saisie en vigueur par jour');
SELECT throws_ok($$SELECT public.enregistrer_presence('00000000-0000-4000-9d00-0000000000f1', current_date - 1, 'late', '08:00', '15:30',
  NULL, NULL, NULL, NULL, (SELECT id FROM p1), NULL)$$, '22023', NULL, 'correction sans motif refusee');
CREATE TEMP TABLE p2 AS SELECT public.enregistrer_presence('00000000-0000-4000-9d00-0000000000f1', current_date - 1, 'late', '08:00', '15:30',
  NULL, NULL, NULL, NULL, (SELECT id FROM p1), 'Arrivee en retard constatee') AS id;
SELECT results_eq($$SELECT status, count(*) OVER () FROM public.v_presences WHERE employee_id = '00000000-0000-4000-9d00-0000000000f1'$$,
  $$VALUES ('late'::text, 1::bigint)$$, 'la correction remplace la saisie, l''ancienne reste en base');
SELECT is((SELECT count(*)::int FROM public.employee_attendance WHERE employee_id = '00000000-0000-4000-9d00-0000000000f1'), 2,
  'historique conserve');
SELECT throws_ok($$INSERT INTO public.employee_attendance (employee_id, date, status) VALUES ('00000000-0000-4000-9d00-0000000000f1', current_date - 2, 'present')$$,
  '42501', NULL, 'pas d''ecriture directe des presences');
SELECT throws_ok($$SELECT public.enregistrer_presence('00000000-0000-4000-9d00-0000000000f1', current_date - 2, 'absent')$$,
  '22023', NULL, 'absence sans motif refusee');
SELECT lives_ok($$SELECT public.annuler_presence((SELECT id FROM p2), 'Saisie sur le mauvais employe')$$, 'annulation motivee');
SELECT is((SELECT count(*)::int FROM public.v_presences WHERE employee_id = '00000000-0000-4000-9d00-0000000000f1'), 0,
  'saisie annulee hors des presences en vigueur');

-- 6. Georeperage (admin global).
SELECT throws_ok($$INSERT INTO public.geofence_zones (name, zone_type, geometry_type, radius_meters) VALUES ('Sans centre', 'mine', 'circle', 100)$$,
  '23514', NULL, 'zone circulaire sans centre refusee (aucune position par defaut)');
SELECT throws_ok($$DELETE FROM public.geofence_zones WHERE id = '00000000-0000-4000-9d00-000000000042'$$,
  '42501', NULL, 'zone non supprimable : desactivation');
SELECT throws_ok($$INSERT INTO public.geofence_violations (zone_id, vehicle_id, violation_type)
  VALUES ('00000000-0000-4000-9d00-000000000042', '00000000-0000-4000-9d00-0000000000b1', 'speeding')$$,
  '42501', NULL, 'aucune violation fabriquee depuis le navigateur');
SELECT throws_ok($$UPDATE public.geofence_violations SET status = 'resolved' WHERE id = '00000000-0000-4000-9d00-000000000051'$$,
  '23514', NULL, 'resolution sans commentaire refusee');
RESET ROLE;

-- Perimetre : admin du site A.
SELECT pg_temp.se_connecter('00000000-0000-4000-9d00-000000000002');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.geofence_zones WHERE name LIKE 'TEST-D061%'), 1, 'zones de son site seulement');
SELECT lives_ok($$UPDATE public.geofence_violations SET status = 'acknowledged', acknowledged_by = auth.uid(), acknowledged_at = now()
  WHERE id = '00000000-0000-4000-9d00-000000000051'$$, 'acquittement d''une violation de son site');
SELECT throws_ok($$SELECT public.annuler_ordre_travail('00000000-0000-4000-9d00-000000000022', 'Hors site')$$,
  '42501', NULL, 'annulation d''un ordre d''un autre site refusee');
RESET ROLE;

-- Comptable : pas de droit gps_tracking.
SELECT pg_temp.se_connecter('00000000-0000-4000-9d00-000000000003');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.geofence_zones WHERE name LIKE 'TEST-D061%'), 0, 'sans droit gps_tracking : aucune zone lue');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
