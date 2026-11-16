-- Tests (D-072, constats R4 : D-059 a D-062) : ordres de travail bornes au
-- site et a l'engin, annulation des mouvements de pieces, engin fige apres
-- imputation, georeperage horodate par le serveur, bon issu d'une
-- consultation, referentiel des categories, unicite des fournisseurs,
-- TRUNCATE retire (migration 20261120103000). Tout est annule.
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

SELECT plan(28);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-c550-000000000001', 'admin.d072r4@exemple.invalid'),
  ('00000000-0000-4000-c550-000000000002', 'logistique.sitea.d072r4@exemple.invalid'),
  ('00000000-0000-4000-c550-000000000003', 'logistique.globale.d072r4@exemple.invalid'),
  ('00000000-0000-4000-c550-000000000004', 'tiers.d072r4@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-c550-0000000000a1', 'Site A D-072 R4', 'mine'),
  ('00000000-0000-4000-c550-0000000000a2', 'Site B D-072 R4', 'depot');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-c550-000000000001', 'admin', 'Admin R4', 'active', NULL),
  ('00000000-0000-4000-c550-000000000002', 'logistician', 'Logistique site A R4', 'active', '00000000-0000-4000-c550-0000000000a1'),
  ('00000000-0000-4000-c550-000000000003', 'logistician', 'Logistique globale R4', 'active', NULL),
  ('00000000-0000-4000-c550-000000000004', 'driver', 'Tiers R4', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, site_id) VALUES
  ('00000000-0000-4000-c550-0000000000b1', 'TEST-D072R4-A', 'Test', 40, 'tipper', '00000000-0000-4000-c550-0000000000a1'),
  ('00000000-0000-4000-c550-0000000000b2', 'TEST-D072R4-B', 'Test', 40, 'tipper', '00000000-0000-4000-c550-0000000000a2');
INSERT INTO public.warehouses (id, name, code, warehouse_type, site_id) VALUES
  ('00000000-0000-4000-c550-0000000000c1', 'Magasin R4 A', 'TEST-D072R4-MAG-A', 'main', '00000000-0000-4000-c550-0000000000a1');
INSERT INTO public.stock_items (id, item_code, name, unit_of_measure, unit_price) VALUES
  ('00000000-0000-4000-c550-0000000000d1', 'TEST-D072R4-PIECE', 'Piece R4', 'piece', 1000);
INSERT INTO public.geofence_zones (id, name, zone_type, geometry_type, center_lat, center_lng, radius_meters, site_id, created_by) VALUES
  ('00000000-0000-4000-c550-000000000041', 'TEST zone R4', 'mine', 'circle', 10.5, -13.5, 500, '00000000-0000-4000-c550-0000000000a1',
   '00000000-0000-4000-c550-000000000001');
INSERT INTO public.geofence_violations (id, zone_id, vehicle_id, violation_type, status) VALUES
  ('00000000-0000-4000-c550-000000000051', '00000000-0000-4000-c550-000000000041', '00000000-0000-4000-c550-0000000000b1', 'unauthorized_entry', 'open');
INSERT INTO public.geofence_alerts (id, violation_id, zone_id, vehicle_id, alert_type, priority, message, is_read) VALUES
  ('00000000-0000-4000-c550-000000000061', '00000000-0000-4000-c550-000000000051', '00000000-0000-4000-c550-000000000041',
   '00000000-0000-4000-c550-0000000000b1', 'entry', 'high', 'Entree non autorisee', false);
DELETE FROM public.settings WHERE key IN ('consultation_offres_minimum', 'achats_validation_separee');

-- R4-2 : un mouvement de pieces d'un ordre annule ne s'annule plus
SELECT pg_temp.se_connecter('00000000-0000-4000-c550-000000000001');
SET LOCAL ROLE authenticated;
INSERT INTO public.maintenance_orders (id, vehicle_id, maintenance_type, title, description)
  VALUES ('00000000-0000-4000-c550-000000000021', '00000000-0000-4000-c550-0000000000b1', 'corrective', 'S1', 'TEST S1');
SELECT public.mouvement_stock('00000000-0000-4000-c550-0000000000d1', 'entry', 10, NULL, '00000000-0000-4000-c550-0000000000c1');
CREATE TEMP TABLE s1_sortie AS SELECT public.mouvement_stock('00000000-0000-4000-c550-0000000000d1', 'exit', 3, '00000000-0000-4000-c550-0000000000c1', NULL,
  now(), 1000, NULL, NULL, '00000000-0000-4000-c550-000000000021') AS id;
CREATE TEMP TABLE s1_retour AS SELECT public.mouvement_stock('00000000-0000-4000-c550-0000000000d1', 'return', 3, NULL,
  '00000000-0000-4000-c550-0000000000c1', now(), NULL, NULL, NULL, '00000000-0000-4000-c550-000000000021') AS id;
SELECT throws_ok($$SELECT public.annuler_mouvement_stock((SELECT id FROM s1_sortie), 'Sortie saisie par erreur')$$, '22023', NULL,
  'R4-2 une sortie couverte par un retour ne s''annule pas');
SELECT lives_ok($$SELECT public.annuler_ordre_travail('00000000-0000-4000-c550-000000000021', 'Doublon')$$,
  'R4-2 ordre annule (pieces retournees)');
SELECT throws_ok($$SELECT public.annuler_mouvement_stock((SELECT id FROM s1_retour), 'Retour saisi par erreur')$$, '22023', NULL,
  'R4-2 le retour d''un ordre annule ne s''annule plus');
RESET ROLE;
SELECT is(public.pieces_nettes_ordre('00000000-0000-4000-c550-000000000021'), 0, 'R4-2 aucune piece nette imputee a l''ordre annule');

-- R4-2 : annulation d'une sortie d'un ordre ouvert, rattachee a l'ordre
SELECT pg_temp.se_connecter('00000000-0000-4000-c550-000000000001');
SET LOCAL ROLE authenticated;
INSERT INTO public.maintenance_orders (id, vehicle_id, maintenance_type, title, description)
  VALUES ('00000000-0000-4000-c550-000000000024', '00000000-0000-4000-c550-0000000000b1', 'corrective', 'S1b', 'TEST S1b');
CREATE TEMP TABLE s1b AS SELECT public.mouvement_stock('00000000-0000-4000-c550-0000000000d1', 'exit', 2, '00000000-0000-4000-c550-0000000000c1', NULL,
  now(), 1000, NULL, NULL, '00000000-0000-4000-c550-000000000024') AS id;
SELECT lives_ok($$SELECT public.annuler_mouvement_stock((SELECT id FROM s1b), 'Mauvais article')$$, 'R4-2 sortie d''un ordre ouvert annulable');
RESET ROLE;
SELECT is((SELECT maintenance_order_id FROM public.stock_movements WHERE annule_mouvement_id = (SELECT id FROM s1b)),
  '00000000-0000-4000-c550-000000000024'::uuid, 'R4-2 le contre-mouvement porte l''ordre de travail');
SELECT is(public.pieces_nettes_ordre('00000000-0000-4000-c550-000000000024'), 0, 'R4-2 pieces nettes apres annulation : 0');

-- R4-1 : ordre de travail borne au site et a l'engin
SELECT pg_temp.se_connecter('00000000-0000-4000-c550-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$INSERT INTO public.maintenance_orders (id, vehicle_id, site_id, maintenance_type, title, description)
  VALUES ('00000000-0000-4000-c550-000000000022', '00000000-0000-4000-c550-0000000000b2', '00000000-0000-4000-c550-0000000000a1',
          'corrective', 'S2', 'TEST S2')$$, NULL, NULL,
  'R4-1 ordre refuse sur un engin hors perimetre, meme avec le site de l''ordre dans le perimetre');
SELECT throws_ok($$INSERT INTO public.maintenance_orders (vehicle_id, maintenance_type, title, description)
  VALUES ('00000000-0000-4000-c550-0000000000b2', 'corrective', 'S2', 'TEST S2')$$, '42501', NULL,
  'R4-1 ordre refuse sur un engin hors perimetre (politique ordre_travail_permis)');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-c550-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$INSERT INTO public.maintenance_orders (vehicle_id, site_id, maintenance_type, title, description)
  VALUES ('00000000-0000-4000-c550-0000000000b2', '00000000-0000-4000-c550-0000000000a1', 'corrective', 'S2b', 'TEST S2b')$$, '22023', NULL,
  'R4-1 site de l''ordre different du site de l''engin refuse');
INSERT INTO public.maintenance_orders (id, vehicle_id, maintenance_type, title, description)
  VALUES ('00000000-0000-4000-c550-000000000025', '00000000-0000-4000-c550-0000000000b2', 'corrective', 'S2c', 'TEST S2c');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-c550-000000000002');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.maintenance_orders WHERE id = '00000000-0000-4000-c550-000000000025'), 0,
  'R4-1 ordre d''un engin du site B invisible au compte du site A');
SELECT throws_ok($$SELECT public.mouvement_stock('00000000-0000-4000-c550-0000000000d1', 'exit', 2, '00000000-0000-4000-c550-0000000000c1',
  NULL, now(), 1000, NULL, NULL, '00000000-0000-4000-c550-000000000025')$$, '42501', NULL,
  'R4-1 pieces non imputables a l''ordre d''un engin hors perimetre');
RESET ROLE;

-- R4-3 : engin fige apres imputation de pieces
SELECT pg_temp.se_connecter('00000000-0000-4000-c550-000000000001');
SET LOCAL ROLE authenticated;
INSERT INTO public.maintenance_orders (id, vehicle_id, maintenance_type, title, description)
  VALUES ('00000000-0000-4000-c550-000000000023', '00000000-0000-4000-c550-0000000000b1', 'corrective', 'S3', 'TEST S3');
SELECT public.mouvement_stock('00000000-0000-4000-c550-0000000000d1', 'exit', 1, '00000000-0000-4000-c550-0000000000c1', NULL,
  now(), 1000, NULL, NULL, '00000000-0000-4000-c550-000000000023');
SELECT throws_ok($$UPDATE public.maintenance_orders SET vehicle_id = '00000000-0000-4000-c550-0000000000b2'
  WHERE id = '00000000-0000-4000-c550-000000000023'$$, '22023', NULL, 'R4-3 engin de l''ordre fige apres sortie de pieces');
SELECT lives_ok($$UPDATE public.maintenance_orders SET notes = 'Suivi' WHERE id = '00000000-0000-4000-c550-000000000023'$$,
  'R4-3 les autres champs restent modifiables');

-- R4-6 : georeperage horodate par le serveur
UPDATE public.geofence_violations SET status = 'acknowledged', acknowledged_by = '00000000-0000-4000-c550-000000000004',
  acknowledged_at = '2001-01-01' WHERE id = '00000000-0000-4000-c550-000000000051';
UPDATE public.geofence_zones SET created_by = '00000000-0000-4000-c550-000000000004' WHERE id = '00000000-0000-4000-c550-000000000041';
UPDATE public.geofence_alerts SET is_read = true, read_by = '00000000-0000-4000-c550-000000000004', read_at = '2001-01-01'
 WHERE id = '00000000-0000-4000-c550-000000000061';
RESET ROLE;
SELECT is((SELECT acknowledged_by::text || ' ' || (acknowledged_at > now() - interval '1 minute')::text FROM public.geofence_violations
            WHERE id = '00000000-0000-4000-c550-000000000051'),
  '00000000-0000-4000-c550-000000000001 true', 'R4-6 acquittement attribue au compte connecte, a l''heure du serveur');
SELECT is((SELECT created_by FROM public.geofence_zones WHERE id = '00000000-0000-4000-c550-000000000041'),
  '00000000-0000-4000-c550-000000000001'::uuid, 'R4-6 auteur d''une zone non reecrit');
SELECT is((SELECT read_by::text || ' ' || (read_at > now() - interval '1 minute')::text FROM public.geofence_alerts
            WHERE id = '00000000-0000-4000-c550-000000000061'),
  '00000000-0000-4000-c550-000000000001 true', 'R4-6 lecture d''alerte attribuee au compte connecte');

-- R4-4 : bon issu d'une consultation
SELECT pg_temp.se_connecter('00000000-0000-4000-c550-000000000003');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE f1 AS SELECT public.enregistrer_fournisseur('Fournisseur retenu R4', 'parts', p_telephone => '+224 600 00 00 81') AS id;
CREATE TEMP TABLE f2 AS SELECT public.enregistrer_fournisseur('Fournisseur non consulte R4', 'parts', p_telephone => '+224 600 00 00 82') AS id;
CREATE TEMP TABLE cons AS SELECT public.creer_consultation('Test R4', '[{"designation": "Prestation R4", "quantite": 1}]'::jsonb,
  ARRAY[(SELECT id FROM f1)], '00000000-0000-4000-c550-0000000000c1') AS id;
CREATE TEMP TABLE off AS SELECT public.enregistrer_offre((SELECT id FROM cons), (SELECT id FROM f1),
  jsonb_build_array(jsonb_build_object('ligne', (SELECT id FROM public.consultations_lignes WHERE consultation_id = (SELECT id FROM cons)),
                                       'prix_unitaire', 1000)), 5) AS id;
CREATE TEMP TABLE bc AS SELECT public.selectionner_offre((SELECT id FROM off), 'Moins-disant') AS id;
SELECT throws_ok($$SELECT public.enregistrer_bon_commande((SELECT id FROM f2), '00000000-0000-4000-c550-0000000000c1',
  '[{"designation": "Autre prestation", "quantite": 1, "prix_unitaire": 900000}]'::jsonb, (SELECT id FROM bc))$$, '22023', NULL,
  'R4-4 le fournisseur de l''offre retenue ne change pas');
SELECT lives_ok($$SELECT public.enregistrer_bon_commande((SELECT id FROM f1), '00000000-0000-4000-c550-0000000000c1',
  '[{"designation": "Prestation R4", "quantite": 1, "prix_unitaire": 900000}]'::jsonb, (SELECT id FROM bc))$$,
  'R4-4 brouillon modifiable chez le meme fournisseur');
SELECT throws_ok($$SELECT public.soumettre_bon_commande((SELECT id FROM bc))$$, '22023', NULL,
  'R4-4 soumission refusee : montant different de l''offre retenue');
SELECT is((SELECT status FROM public.purchase_orders WHERE id = (SELECT id FROM bc)), 'draft', 'R4-4 bon reste brouillon');

-- R4-5 : referentiel des categories reserve a l'administrateur
SELECT throws_ok($$SELECT public.definir_categorie_fournisseur('Categorie R4')$$, '42501', NULL,
  'R4-5 la logistique ne definit pas de categorie');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-c550-000000000001');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.definir_categorie_fournisseur('Categorie R4')$$, 'R4-5 l''administrateur definit une categorie');
RESET ROLE;

-- R4-7, R4-8 : verrou de l'offre, unicite des fournisseurs
SELECT ok(pg_get_functiondef('public.selectionner_offre(uuid, text, boolean)'::regprocedure) ~ 'offres_fournisseurs WHERE id = p_offre FOR UPDATE',
  'R4-7 l''offre est relue sous verrou');
SELECT pg_temp.se_connecter(NULL);
SELECT throws_ok($$INSERT INTO public.suppliers (supplier_number, supplier_type, company_name) VALUES ('TEST-R4-DOUBLON', 'parts', ' fournisseur retenu r4 ')$$,
  '23505', NULL, 'R4-8 raison sociale unique (casse et espaces ignores)');

-- R4-9 : TRUNCATE et vues
SELECT is(has_table_privilege('authenticated', 'public.vehicles', 'TRUNCATE') OR has_table_privilege('anon', 'public.settings', 'TRUNCATE')
          OR has_table_privilege('authenticated', 'public.stock_movements', 'TRUNCATE'), false,
  'R4-9 TRUNCATE retire aux comptes');
SELECT is((SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
              AND (has_table_privilege('anon', c.oid, 'TRUNCATE') OR has_table_privilege('authenticated', c.oid, 'TRUNCATE'))), 0,
  'R4-9 aucune table publique tronquable par anon ou authenticated');
SELECT is(has_table_privilege('anon', 'public.v_pneus', 'SELECT'), false, 'R4-9 vues sans droit anon');

SELECT * FROM finish();
ROLLBACK;
