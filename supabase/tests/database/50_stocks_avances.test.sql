-- Tests (D-067) : reservations, lots et numeros de serie, cout moyen
-- pondere, reception de pneus depuis un bon de commande, performance des
-- pneus par marque et modele (migration 20261121130000) ; integration sur
-- main : droits retires (has_*_privilege, jamais un appel refuse sous SET
-- ROLE, D-072), reservations levees a la cloture d'un ordre, perimetre d'un
-- compte borne a un site (D-075), annulation de reception d'un bon engage
-- refusee (D-072 R3-5) ; constats C1 a C7 de la revue independante (section
-- 10). Tout est annule.
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

SELECT plan(94);

-- Donnees de test (sans JWT : gardes inactives).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-d067-000000000001', 'logistique.d067@exemple.invalid'),
  ('00000000-0000-4000-d067-000000000002', 'comptable.d067@exemple.invalid'),
  ('00000000-0000-4000-d067-000000000003', 'admin.d067@exemple.invalid'),
  ('00000000-0000-4000-d067-000000000005', 'logistique.site2.d067@exemple.invalid'),
  ('00000000-0000-4000-d067-000000000006', 'magasin.seul.d067@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-d067-000000000001', 'logistician', 'Logistique D-067', 'active', NULL),
  ('00000000-0000-4000-d067-000000000002', 'accountant', 'Comptable D-067', 'active', NULL),
  ('00000000-0000-4000-d067-000000000003', 'admin', 'Admin D-067', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.sites (id, name, type) VALUES ('00000000-0000-4000-d067-0000000000a1', 'Site D-067', 'depot'),
  ('00000000-0000-4000-d067-0000000000a2', 'Site 2 D-067', 'depot');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-d067-000000000005', 'logistician', 'Logistique site 2 D-067', 'active', '00000000-0000-4000-d067-0000000000a2'),
  ('00000000-0000-4000-d067-000000000006', 'logistician', 'Magasin seul D-067', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
-- Compte n'ayant que le droit stocks : flotte et maintenance en lecture (D-036).
INSERT INTO public.droits_utilisateur (utilisateur, module, niveau) VALUES
  ('00000000-0000-4000-d067-000000000006', 'vehicles', 'lecture'),
  ('00000000-0000-4000-d067-000000000006', 'maintenance', 'lecture'),
  ('00000000-0000-4000-d067-000000000006', 'stock', 'ecriture')
ON CONFLICT (utilisateur, module) DO UPDATE SET niveau = EXCLUDED.niveau;
INSERT INTO public.warehouses (id, name, code, warehouse_type, site_id) VALUES
  ('00000000-0000-4000-d067-0000000000c1', 'Magasin D-067', 'TEST-MAG-D067', 'main', '00000000-0000-4000-d067-0000000000a1'),
  ('00000000-0000-4000-d067-0000000000c2', 'Atelier D-067', 'TEST-ATL-D067', 'garage', '00000000-0000-4000-d067-0000000000a1'),
  ('00000000-0000-4000-d067-0000000000c3', 'Magasin site 2 D-067', 'TEST-MAG2-D067', 'main', '00000000-0000-4000-d067-0000000000a2');
INSERT INTO public.suppliers (id, supplier_number, supplier_type, company_name) VALUES
  ('00000000-0000-4000-d067-0000000000f1', 'TEST-F-D067', 'parts', 'Fournisseur D-067');
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status, site_id) VALUES
  ('00000000-0000-4000-d067-0000000000b1', 'TEST-D067-1', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-d067-0000000000a1');
INSERT INTO public.maintenance_orders (id, vehicle_id, maintenance_type, description, status, work_order_number) VALUES
  ('00000000-0000-4000-d067-000000000021', '00000000-0000-4000-d067-0000000000b1', 'corrective', 'TEST-D067', 'open', 'TEST-OT-D067'),
  ('00000000-0000-4000-d067-000000000022', '00000000-0000-4000-d067-0000000000b1', 'corrective', 'TEST-D067-2', 'open', 'TEST-OT2-D067'),
  ('00000000-0000-4000-d067-000000000023', '00000000-0000-4000-d067-0000000000b1', 'corrective', 'TEST-D067-3', 'open', 'TEST-OT3-D067');
INSERT INTO public.stock_items (id, item_code, name, unit_of_measure, suivi) VALUES
  ('00000000-0000-4000-d067-0000000000e1', 'TEST-ART-D067', 'Filtre D-067', 'piece', 'aucun'),
  ('00000000-0000-4000-d067-0000000000e2', 'TEST-LOT-D067', 'Huile D-067', 'bidon', 'lot'),
  ('00000000-0000-4000-d067-0000000000e3', 'TEST-SER-D067', 'Alternateur D-067', 'piece', 'serie'),
  ('00000000-0000-4000-d067-0000000000e4', 'TEST-CMP-D067', 'Courroie D-067', 'piece', 'aucun'),
  ('00000000-0000-4000-d067-0000000000e5', 'TEST-SANS-D067', 'Joint D-067', 'piece', 'aucun'),
  ('00000000-0000-4000-d067-0000000000e6', 'TEST-PAY-D067', 'Pompe D-067', 'piece', 'aucun'),
  ('00000000-0000-4000-d067-0000000000e7', 'TEST-OTP-D067', 'Plaquette D-067', 'piece', 'aucun'),
  ('00000000-0000-4000-d067-0000000000e9', 'TEST-C1A-D067', 'C1a D-067', 'piece', 'aucun'),
  ('00000000-0000-4000-d067-0000000000ea', 'TEST-C1B-D067', 'C1b D-067', 'piece', 'aucun'),
  ('00000000-0000-4000-d067-0000000000eb', 'TEST-C1C-D067', 'C1c D-067', 'piece', 'aucun'),
  ('00000000-0000-4000-d067-0000000000ec', 'TEST-C1D-D067', 'C1d D-067', 'piece', 'aucun'),
  ('00000000-0000-4000-d067-0000000000ed', 'TEST-C2-D067', 'C2 D-067', 'piece', 'aucun'),
  ('00000000-0000-4000-d067-0000000000ee', 'TEST-C3-D067', 'C3 D-067', 'piece', 'aucun'),
  ('00000000-0000-4000-d067-0000000000ef', 'TEST-C7-D067', 'C7 D-067', 'piece', 'aucun'),
  ('00000000-0000-4000-d067-0000000000f0', 'TEST-RES-D067', 'Reservation D-067', 'piece', 'aucun');
DELETE FROM public.settings WHERE key IN ('pneu_reforme_precoce_km', 'achats_validation_separee');
INSERT INTO public.settings (key, value, category) VALUES ('pneu_reforme_precoce_km', '{"value": "10000"}', 'pneus');
SELECT throws_ok($$INSERT INTO public.settings (key, value) VALUES ('pneu_reforme_precoce_km', '{"value": "abc"}')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value$$, '22023', NULL, 'seuil de reforme precoce : nombre attendu');
SELECT throws_ok($$INSERT INTO public.settings (key, value) VALUES ('planification_cloture_separee', '{"value": "oui"}')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value$$, '22023', NULL,
  'valider_reglage recree : la cle planification_cloture_separee (D-063) reste controlee');

-- 1. Reservations ---------------------------------------------------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-d067-000000000001');
SET LOCAL ROLE authenticated;
SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e1', 'entry', 10, NULL, '00000000-0000-4000-d067-0000000000c1',
  now(), 1000);
CREATE TEMP TABLE res AS SELECT public.reserver_stock('00000000-0000-4000-d067-0000000000e1', '00000000-0000-4000-d067-0000000000c1', 4,
  p_ordre_maintenance => '00000000-0000-4000-d067-000000000021') AS id;
SELECT is((SELECT quantite || ' ' || reserve || ' ' || libre FROM public.v_stock_disponibilite
            WHERE stock_item_id = '00000000-0000-4000-d067-0000000000e1' AND warehouse_id = '00000000-0000-4000-d067-0000000000c1'),
  '10 4 6', 'reservation : deduite du libre sans sortie physique');
SELECT is((SELECT vehicle_id FROM public.reservations_stock WHERE id = (SELECT id FROM res)), NULL,
  'engin de l''ordre non recopie sur la reservation (il peut changer tant qu''aucune piece n''est imputee)');
SELECT throws_like($$SELECT public.annuler_mouvement_stock((SELECT id FROM public.stock_movements
  WHERE stock_item_id = '00000000-0000-4000-d067-0000000000e1' AND movement_type = 'entry'), 'Erreur')$$,
  '%reserve%', 'annulation qui laisserait une reservation sans stock refusee');
SELECT throws_ok($$SELECT public.reserver_stock('00000000-0000-4000-d067-0000000000e1', '00000000-0000-4000-d067-0000000000c1', 7,
  p_affectation => 'Chantier nord')$$, '22023', NULL, 'reservation au-dela du stock libre refusee');
SELECT throws_ok($$SELECT public.reserver_stock('00000000-0000-4000-d067-0000000000e1', '00000000-0000-4000-d067-0000000000c1', 1)$$,
  '22023', NULL, 'reservation sans ordre, engin ni affectation refusee');
SELECT throws_ok($$SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e1', 'exit', 7, '00000000-0000-4000-d067-0000000000c1')$$,
  '22023', NULL, 'sortie libre au-dela du stock non reserve refusee');
SELECT throws_ok($$SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e1', 'transfer', 7, '00000000-0000-4000-d067-0000000000c1',
  '00000000-0000-4000-d067-0000000000c2')$$, '22023', NULL, 'transfert au-dela du stock non reserve refuse');
SELECT lives_ok($$SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e1', 'exit', 6, '00000000-0000-4000-d067-0000000000c1')$$,
  'sortie du stock libre');
CREATE TEMP TABLE sortie_res AS SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e1', 'exit', 3, '00000000-0000-4000-d067-0000000000c1',
  p_reservation => (SELECT id FROM res)) AS id;
SELECT is((SELECT maintenance_order_id || ' ' || vehicle_id FROM public.stock_movements WHERE id = (SELECT id FROM sortie_res)),
  '00000000-0000-4000-d067-000000000021 00000000-0000-4000-d067-0000000000b1',
  'sortie sur reservation imputee a l''ordre de la reservation, engin de l''ordre');
SELECT is((SELECT statut || ' ' || quantite_consommee || ' ' || quantite_restante FROM public.v_reservations_stock WHERE id = (SELECT id FROM res)),
  'active 3 1', 'reservation consommee en partie par la sortie');
SELECT throws_ok($$SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e1', 'exit', 2, '00000000-0000-4000-d067-0000000000c1',
  p_reservation => (SELECT id FROM res))$$, '22023', NULL, 'sortie superieure au reste de la reservation refusee');
SELECT throws_ok($$SELECT public.lever_reservation_stock((SELECT id FROM res), ' ')$$, '22023', NULL, 'levee sans motif refusee');
SELECT lives_ok($$SELECT public.lever_reservation_stock((SELECT id FROM res), 'Piece remplacee par le loueur')$$, 'levee motivee');
SELECT is((SELECT statut || ' ' || quantite_restante FROM public.v_reservations_stock WHERE id = (SELECT id FROM res)) || ' '
          || (SELECT libre FROM public.v_stock_disponibilite
               WHERE stock_item_id = '00000000-0000-4000-d067-0000000000e1' AND warehouse_id = '00000000-0000-4000-d067-0000000000c1'),
  'levee 0 1', 'reservation levee : le reste redevient libre');
RESET ROLE;
-- Ecriture directe : aucun droit (verifie par has_table_privilege, D-072) ;
-- la garde refuse aussi une modification ou une suppression avec session.
SELECT ok(NOT has_table_privilege('authenticated', 'public.reservations_stock', 'UPDATE')
          AND NOT has_table_privilege('authenticated', 'public.reservations_stock', 'DELETE'),
  'reservation : ni modification ni suppression par les comptes');
SELECT throws_ok($$UPDATE public.reservations_stock SET quantite = 9 WHERE id = (SELECT id FROM res)$$,
  '42501', NULL, 'garde : une reservation ne se modifie pas');
SELECT throws_ok($$DELETE FROM public.reservations_stock WHERE id = (SELECT id FROM res)$$,
  '42501', NULL, 'garde : une reservation ne se supprime pas');

SELECT pg_temp.se_connecter('00000000-0000-4000-d067-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.reserver_stock('00000000-0000-4000-d067-0000000000e1', '00000000-0000-4000-d067-0000000000c1', 1,
  p_affectation => 'Atelier')$$, '42501', NULL, 'sans droit d''ecriture des stocks : reservation refusee');
RESET ROLE;

-- 2. Lots et numeros de serie ----------------------------------------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-d067-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e2', 'entry', 5, NULL, '00000000-0000-4000-d067-0000000000c1')$$,
  '22023', NULL, 'article suivi par lot : entree sans lot refusee');
SELECT throws_ok($$SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e2', 'entry', 5, NULL, '00000000-0000-4000-d067-0000000000c1',
  p_lots => '[{"code": "L1", "quantite": 4}]')$$, '22023', NULL, 'total des lots different de la quantite refuse');
SELECT throws_ok($$SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e1', 'entry', 1, NULL, '00000000-0000-4000-d067-0000000000c1',
  p_lots => '[{"code": "L1", "quantite": 1}]')$$, '22023', NULL, 'lot sur un article sans suivi refuse');
SELECT lives_ok($$SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e2', 'entry', 5, NULL, '00000000-0000-4000-d067-0000000000c1',
  now(), 2000, p_lots => '[{"code": " l1 ", "quantite": 3}, {"code": "L2", "quantite": 2}]')$$, 'entree detaillee par lot');
SELECT is((SELECT string_agg(code || '=' || quantite, ' ' ORDER BY code) FROM public.v_stock_lots
            WHERE stock_item_id = '00000000-0000-4000-d067-0000000000e2' AND warehouse_id = '00000000-0000-4000-d067-0000000000c1'),
  'L1=3 L2=2', 'quantites par lot (codes normalises)');
SELECT throws_ok($$SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e2', 'exit', 2, '00000000-0000-4000-d067-0000000000c1')$$,
  '22023', NULL, 'sortie d''un article suivi sans lot refusee');
SELECT throws_ok($$SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e2', 'exit', 3, '00000000-0000-4000-d067-0000000000c1',
  p_lots => '[{"code": "L2", "quantite": 3}]')$$, '22023', NULL, 'sortie au-dela du lot disponible refusee');
CREATE TEMP TABLE sortie_lot AS SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e2', 'exit', 2, '00000000-0000-4000-d067-0000000000c1',
  p_lots => '[{"code": "L1", "quantite": 2}]', p_vehicle_id => '00000000-0000-4000-d067-0000000000b1') AS id;
SELECT is((SELECT string_agg(movement_type || ':' || code || ':' || quantite, ' ' ORDER BY movement_number) FROM public.v_stock_lots_mouvements
            WHERE stock_item_id = '00000000-0000-4000-d067-0000000000e2' AND code = 'L1'),
  'entry:L1:3 exit:L1:2', 'lot trace de l''entree a la sortie');
SELECT throws_ok($$SELECT public.inventorier_stock('00000000-0000-4000-d067-0000000000e2', '00000000-0000-4000-d067-0000000000c1', 2, 'Test')$$,
  '22023', NULL, 'article suivi : inventaire global refuse');
SELECT is(public.inventorier_lot_stock('00000000-0000-4000-d067-0000000000e2', '00000000-0000-4000-d067-0000000000c1', 'L2', 1, 'Bidon perce'),
  -1, 'inventaire par lot : ajustement egal a l''ecart du lot');
SELECT lives_ok($$SELECT public.annuler_mouvement_stock((SELECT id FROM sortie_lot), 'Sortie saisie par erreur')$$,
  'annulation d''une sortie de lot');
SELECT is((SELECT string_agg(code || '=' || quantite, ' ' ORDER BY code) FROM public.v_stock_lots
            WHERE stock_item_id = '00000000-0000-4000-d067-0000000000e2' AND warehouse_id = '00000000-0000-4000-d067-0000000000c1'),
  'L1=3 L2=1', 'le contre-mouvement reprend les lots de l''original');
SELECT throws_ok($$UPDATE public.stock_items SET suivi = 'aucun' WHERE id = '00000000-0000-4000-d067-0000000000e2'$$,
  '22023', NULL, 'mode de suivi non modifiable tant qu''il reste du stock');

SELECT lives_ok($$SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e3', 'entry', 2, NULL, '00000000-0000-4000-d067-0000000000c1',
  p_lots => '[{"code": "S1"}, {"code": "S2"}]')$$, 'entree de deux numeros de serie');
SELECT throws_ok($$SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e3', 'entry', 1, NULL, '00000000-0000-4000-d067-0000000000c2',
  p_lots => '[{"code": "s1"}]')$$, '23505', NULL, 'numero de serie deja en stock refuse');
SELECT throws_ok($$SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e3', 'entry', 2, NULL, '00000000-0000-4000-d067-0000000000c1',
  p_lots => '[{"code": "S3", "quantite": 2}]')$$, '22023', NULL, 'un numero de serie vaut une unite');
SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e3', 'transfer', 1, '00000000-0000-4000-d067-0000000000c1',
  '00000000-0000-4000-d067-0000000000c2', p_lots => '[{"code": "S1"}]');
SELECT throws_ok($$SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e3', 'exit', 1, '00000000-0000-4000-d067-0000000000c1',
  p_lots => '[{"code": "S1"}]')$$, '22023', NULL, 'sortie d''une serie absente du depot refusee');
SELECT ok(NOT has_table_privilege('authenticated', 'public.stock_mouvements_lots', 'INSERT'),
  'lignes de lots : aucune ecriture directe');

-- 3. Cout moyen pondere ------------------------------------------------------------
SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e4', 'entry', 10, NULL, '00000000-0000-4000-d067-0000000000c1', now(), 1000);
SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e4', 'entry', 10, NULL, '00000000-0000-4000-d067-0000000000c1', now(), 2000);
SELECT is((SELECT statut || ' ' || valeur || ' ' || cmp FROM public.v_valorisation_articles WHERE stock_item_id = '00000000-0000-4000-d067-0000000000e4'),
  'complete 30000 1500.00', 'cout moyen pondere des entrees valorisees');
SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e4', 'exit', 5, '00000000-0000-4000-d067-0000000000c1');
SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e4', 'entry', 5, NULL, '00000000-0000-4000-d067-0000000000c1');
SELECT is((SELECT statut || ' ' || quantite || ' ' || quantite_non_valorisee || ' ' || valeur || ' ' || cmp FROM public.v_valorisation_articles
            WHERE stock_item_id = '00000000-0000-4000-d067-0000000000e4'),
  'partielle 20 5.000 22500 1500.00', 'entree sans prix : valeur partielle, jamais estimee');
SELECT is((SELECT statut || ' ' || valeur FROM public.v_valorisation_stock
            WHERE stock_item_id = '00000000-0000-4000-d067-0000000000e4' AND warehouse_id = '00000000-0000-4000-d067-0000000000c1'),
  'partielle 22500', 'valorisation par depot');
SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e5', 'entry', 3, NULL, '00000000-0000-4000-d067-0000000000c1');
SELECT is((SELECT statut || ' ' || coalesce(valeur::text, 'NULL') FROM public.v_valorisation_articles
            WHERE stock_item_id = '00000000-0000-4000-d067-0000000000e5'),
  'sans_donnees NULL', 'aucune entree valorisee : sans donnees');
RESET ROLE;

-- 4. Reception de pneus et de lots depuis un bon de commande ----------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-d067-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.enregistrer_bon_commande('00000000-0000-4000-d067-0000000000f1', '00000000-0000-4000-d067-0000000000c1',
  '[{"article": "00000000-0000-4000-d067-0000000000e1", "quantite": 1, "prix_unitaire": 1, "pneu": {"marque": "M", "modele": "X"}}]')$$,
  '22023', NULL, 'ligne de pneus rattachee a un article du magasin refusee');
CREATE TEMP TABLE bc AS SELECT public.enregistrer_bon_commande('00000000-0000-4000-d067-0000000000f1', '00000000-0000-4000-d067-0000000000c1',
  '[{"article": "00000000-0000-4000-d067-0000000000e2", "quantite": 4, "prix_unitaire": 2500},
    {"quantite": 2, "prix_unitaire": 3000000, "pneu": {"marque": "Marque D067", "modele": "XDR", "dimension": "12.00R24"}}]') AS id;
SELECT public.soumettre_bon_commande((SELECT id FROM bc));
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d067-000000000003');
SET LOCAL ROLE authenticated;
SELECT public.decider_bon_commande((SELECT id FROM bc), true);
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d067-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT item_description FROM public.purchase_order_items WHERE purchase_order_id = (SELECT id FROM bc) AND pneu_marque IS NOT NULL),
  'Pneu Marque D067 XDR 12.00R24', 'ligne de pneus : designation depuis le modele');
SELECT throws_ok($$SELECT public.receptionner_bon_commande((SELECT id FROM bc),
  (SELECT jsonb_agg(jsonb_build_object('ligne', id, 'recue', quantity, 'pneus', '[{"numero": "TEST-PN-D067-1"}]'::jsonb))
     FROM public.purchase_order_items WHERE purchase_order_id = (SELECT id FROM bc) AND pneu_marque IS NOT NULL))$$,
  '22023', NULL, 'un numero par pneu recu exige');
SELECT throws_ok($$SELECT public.receptionner_bon_commande((SELECT id FROM bc),
  (SELECT jsonb_agg(jsonb_build_object('ligne', id, 'recue', quantity))
     FROM public.purchase_order_items WHERE purchase_order_id = (SELECT id FROM bc) AND stock_item_id IS NOT NULL))$$,
  '22023', NULL, 'reception d''un article suivi sans lot refusee');
CREATE TEMP TABLE rec AS SELECT public.receptionner_bon_commande((SELECT id FROM bc),
  (SELECT jsonb_agg(CASE WHEN pneu_marque IS NOT NULL
            THEN jsonb_build_object('ligne', id, 'recue', 2, 'pneus', '[{"numero": "test-pn-d067-1", "profondeur_mm": 20}, {"numero": "TEST-PN-D067-2"}]'::jsonb)
            ELSE jsonb_build_object('ligne', id, 'recue', 4, 'lots', '[{"code": "L9", "quantite": 4}]'::jsonb) END)
     FROM public.purchase_order_items WHERE purchase_order_id = (SELECT id FROM bc)), 'BL-D067') AS id;
SELECT is((SELECT count(*)::int FROM public.tires t JOIN public.receptions_achat_pneus rp ON rp.tire_id = t.id
            WHERE t.purchase_price = 3000000 AND t.fournisseur_id = '00000000-0000-4000-d067-0000000000f1'
              AND t.site_id = '00000000-0000-4000-d067-0000000000a1' AND t.brand = 'Marque D067' AND t.status = 'stored'),
  2, 'pneus enregistres a la reception : prix de la ligne, fournisseur, site du depot');
SELECT is((SELECT reference_piece FROM public.pneus_operations o JOIN public.tires t ON t.id = o.tire_id
            WHERE t.tire_number = 'TEST-PN-D067-1' AND o.type = 'entree'), 'BL-D067', 'entree du pneu : piece de la reception');
SELECT is((SELECT quantite FROM public.v_stock_lots WHERE stock_item_id = '00000000-0000-4000-d067-0000000000e2' AND code = 'L9'),
  4, 'lots saisis a la reception');
-- e2 : 5 a 2000, sortie 2, inventaire -1, annulation de la sortie (+2 au cmp), 4 a 2500 : 18000 / 8.
SELECT is((SELECT cmp FROM public.v_valorisation_articles WHERE stock_item_id = '00000000-0000-4000-d067-0000000000e2'),
  2250.00, 'cmp recalcule avec le prix de reception');

-- 5. Performance par marque et modele ----------------------------------------------
SELECT public.monter_pneu((SELECT id FROM public.tires WHERE tire_number = 'TEST-PN-D067-1'), '00000000-0000-4000-d067-0000000000b1', 'AV G', p_km => 1000);
SELECT public.monter_pneu((SELECT id FROM public.tires WHERE tire_number = 'TEST-PN-D067-2'), '00000000-0000-4000-d067-0000000000b1', 'AV D', p_km => 1000);
SELECT public.demonter_pneu((SELECT id FROM public.tires WHERE tire_number = 'TEST-PN-D067-1'), 'Usure', 'damaged', '00000000-0000-4000-d067-0000000000a1', p_km => 51000);
SELECT public.demonter_pneu((SELECT id FROM public.tires WHERE tire_number = 'TEST-PN-D067-2'), 'Coupure', 'damaged', '00000000-0000-4000-d067-0000000000a1', p_km => 6000);
SELECT public.reformer_pneu((SELECT id FROM public.tires WHERE tire_number = 'TEST-PN-D067-1'), 'Usure finale');
SELECT public.reformer_pneu((SELECT id FROM public.tires WHERE tire_number = 'TEST-PN-D067-2'), 'Coupure flanc');
SELECT throws_like($$SELECT public.annuler_reception((SELECT id FROM rec), 'Erreur')$$,
  '%deja montes ou mouvementes (TEST-PN-D067-1, TEST-PN-D067-2)%',
  'C3 : reception dont les pneus ont ete montes non annulable, pneus listes');
SELECT public.enregistrer_pneu(p_numero => 'TEST-PN-D067-3', p_marque => ' marque d067', p_modele => 'xdr ', p_site => '00000000-0000-4000-d067-0000000000a1');
SELECT is((SELECT nb_pneus || ' ' || nb_pris_en_compte || ' ' || nb_exclus_en_service || ' ' || km_moyens || ' ' || cout_km || ' ' || taux_reforme_precoce_pct
             FROM public.v_pneus_performance WHERE marque = 'MARQUE D067' AND modele = 'XDR'),
  '3 2 1 27500 109.09 50.0', 'performance du modele sur les pneus aux mesures completes, exclus comptes');
SELECT is((SELECT nb_pneus FROM public.v_pneus_performance WHERE marque = 'MARQUE D067' AND modele IS NULL),
  3, 'ligne de la marque (tous modeles)');
RESET ROLE;
DELETE FROM public.settings WHERE key = 'pneu_reforme_precoce_km';
SELECT pg_temp.se_connecter('00000000-0000-4000-d067-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT coalesce(taux_reforme_precoce_pct::text, 'sans donnees') FROM public.v_pneus_performance WHERE marque = 'MARQUE D067' AND modele = 'XDR'),
  'sans donnees', 'sans seuil : taux de reforme precoce sans donnees');
RESET ROLE;


-- 6. Droits (has_*_privilege : un droit retire ne se verifie pas par un appel
-- refuse sous SET ROLE, D-072) ----------------------------------------------------
SELECT ok(NOT (SELECT bool_or(has_function_privilege(r, f, 'EXECUTE'))
  FROM unnest(ARRAY['authenticated', 'anon']) r,
       unnest(ARRAY['public.stock_disponible(uuid, uuid)', 'public.stock_reserve(uuid, uuid)', 'public.stock_libre(uuid, uuid)',
                    'public.stock_lot_disponible(uuid, uuid, text)',
                    'public.controler_lots_mouvement(public.stock_items, text, integer, uuid, jsonb)',
                    'public.lever_reservations_ordre()', 'public.garde_suivi_article()']) f),
  'fonctions internes (quantites, lots, gardes) non executables par les comptes');
SELECT is((SELECT string_agg(p.pronargs::text, ',') FROM pg_proc p
            WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'mouvement_stock'), '13',
  'mouvement_stock : une seule signature (13 arguments), l''ancienne retiree');
SELECT ok(has_function_privilege('authenticated', 'public.mouvement_stock(uuid, text, integer, uuid, uuid, timestamptz, bigint, text, uuid, uuid, text, jsonb, uuid)', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.mouvement_stock(uuid, text, integer, uuid, uuid, timestamptz, bigint, text, uuid, uuid, text, jsonb, uuid)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.reserver_stock(uuid, uuid, integer, uuid, uuid, text, text)', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.reserver_stock(uuid, uuid, integer, uuid, uuid, text, text)', 'EXECUTE'),
  'fonctions d''ecriture : executables par les comptes, pas par anon');
SELECT is((SELECT count(*)::int FROM information_schema.role_table_grants
            WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated', 'PUBLIC')
              AND table_name IN ('reservations_stock', 'stock_mouvements_lots', 'receptions_achat_pneus')
              AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')), 0,
  'nouvelles tables : ni ecriture, ni DELETE, ni TRUNCATE pour les comptes');
SELECT ok(NOT (SELECT bool_or(has_sequence_privilege(r, 'public.reservations_stock_numero_seq', p))
  FROM unnest(ARRAY['authenticated', 'anon']) r, unnest(ARRAY['USAGE', 'SELECT', 'UPDATE']) p),
  'sequence des numeros RES fermee aux comptes');
SELECT is((SELECT count(*)::int FROM pg_class c
            WHERE c.oid IN ('public.reservations_stock'::regclass, 'public.stock_mouvements_lots'::regclass, 'public.receptions_achat_pneus'::regclass)
              AND c.relrowsecurity
              AND EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname)
              AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname
                                AND coalesce(p.qual, '') ~ '^\(?true\)?$')), 3,
  'nouvelles tables : RLS active, politique explicite, aucune politique ouverte');

-- 7. Cloture d'un ordre de travail : reservations levees --------------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-d067-000000000001');
SET LOCAL ROLE authenticated;
SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e7', 'entry', 10, NULL, '00000000-0000-4000-d067-0000000000c1', now(), 500);
CREATE TEMP TABLE res_ot AS
  SELECT 'r2a'::text AS n, public.reserver_stock('00000000-0000-4000-d067-0000000000e7', '00000000-0000-4000-d067-0000000000c1', 3,
    p_ordre_maintenance => '00000000-0000-4000-d067-000000000022') AS id
  UNION ALL SELECT 'r2b', public.reserver_stock('00000000-0000-4000-d067-0000000000e7', '00000000-0000-4000-d067-0000000000c1', 1,
    p_ordre_maintenance => '00000000-0000-4000-d067-000000000022')
  UNION ALL SELECT 'r3', public.reserver_stock('00000000-0000-4000-d067-0000000000e7', '00000000-0000-4000-d067-0000000000c1', 2,
    p_ordre_maintenance => '00000000-0000-4000-d067-000000000023');
SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e7', 'exit', 1, '00000000-0000-4000-d067-0000000000c1',
  p_reservation => (SELECT id FROM res_ot WHERE n = 'r2a'));
SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e7', 'exit', 1, '00000000-0000-4000-d067-0000000000c1',
  p_reservation => (SELECT id FROM res_ot WHERE n = 'r2b'));
SELECT is((SELECT quantite || ' ' || reserve || ' ' || libre FROM public.v_stock_disponibilite
            WHERE stock_item_id = '00000000-0000-4000-d067-0000000000e7' AND warehouse_id = '00000000-0000-4000-d067-0000000000c1'),
  '8 4 4', 'reservations de deux ordres : 2 restantes sur l''un, 2 sur l''autre');
RESET ROLE;
-- L'ordre passe a termine par l'ecran (ecriture de l'ordre, garde avec session).
SELECT pg_temp.se_connecter('00000000-0000-4000-d067-000000000003');
UPDATE public.maintenance_orders SET status = 'completed' WHERE id = '00000000-0000-4000-d067-000000000022';
SELECT is((SELECT string_agg(r.statut, ' ' ORDER BY x.n) FROM public.v_reservations_stock r JOIN res_ot x ON x.id = r.id
            WHERE x.n IN ('r2a', 'r2b')), 'levee consommee',
  'ordre termine : reservation active levee, reservation consommee inchangee');
SELECT ok((SELECT motif_levee = 'Levee a la cloture de l''ordre TEST-OT2-D067 (termine)'
                  AND levee_par = '00000000-0000-4000-d067-000000000003'
             FROM public.reservations_stock WHERE id = (SELECT id FROM res_ot WHERE n = 'r2a')),
  'levee consignee : motif citant l''ordre, auteur de la cloture');
SELECT is((SELECT reserve FROM public.v_stock_disponibilite
            WHERE stock_item_id = '00000000-0000-4000-d067-0000000000e7' AND warehouse_id = '00000000-0000-4000-d067-0000000000c1'),
  2, 'la quantite levee redevient libre');
SELECT pg_temp.se_connecter('00000000-0000-4000-d067-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.reserver_stock('00000000-0000-4000-d067-0000000000e7', '00000000-0000-4000-d067-0000000000c1', 1,
  p_ordre_maintenance => '00000000-0000-4000-d067-000000000022')$$, '22023', NULL, 'ordre termine : aucune nouvelle reservation');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d067-000000000003');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.annuler_ordre_travail('00000000-0000-4000-d067-000000000023', 'Doublon de l''ordre 2')$$,
  'annulation motivee d''un ordre sans piece imputee');
SELECT is((SELECT statut || ' ' || motif_levee FROM public.v_reservations_stock WHERE id = (SELECT id FROM res_ot WHERE n = 'r3')),
  'levee Levee a la cloture de l''ordre TEST-OT3-D067 (annule)', 'ordre annule : sa reservation est levee');
RESET ROLE;
-- Transfert du site 1 vers le site 2 (compte global) : sonde C5 ci-dessous.
SELECT pg_temp.se_connecter('00000000-0000-4000-d067-000000000001');
SET LOCAL ROLE authenticated;
SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e7', 'transfer', 1, '00000000-0000-4000-d067-0000000000c1',
  '00000000-0000-4000-d067-0000000000c3');
RESET ROLE;

-- 8. Perimetre : compte borne au site 2 (D-038, D-075) ---------------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-d067-000000000005');
SET LOCAL ROLE authenticated;
SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e1', 'entry', 2, NULL, '00000000-0000-4000-d067-0000000000c3', now(), 700);
SELECT is((SELECT count(*)::int FROM public.reservations_stock
            WHERE warehouse_id IN ('00000000-0000-4000-d067-0000000000c1', '00000000-0000-4000-d067-0000000000c2')), 0,
  'compte borne : reservations des depots du site 1 invisibles');
SELECT is((SELECT count(*)::int FROM public.v_stock_lots WHERE warehouse_id IN ('00000000-0000-4000-d067-0000000000c1', '00000000-0000-4000-d067-0000000000c2'))
          + (SELECT count(*)::int FROM public.v_stock_disponibilite WHERE warehouse_id IN ('00000000-0000-4000-d067-0000000000c1', '00000000-0000-4000-d067-0000000000c2'))
          + (SELECT count(*)::int FROM public.v_valorisation_stock WHERE warehouse_id IN ('00000000-0000-4000-d067-0000000000c1', '00000000-0000-4000-d067-0000000000c2')),
  0, 'compte borne : lots, disponibilite et valorisation du site 1 invisibles');
-- e1 : 1 restant a 1000 au site 1, 2 entres a 700 au site 2 : cmp de l'article 800.
SELECT is((SELECT statut || ' ' || quantite || ' ' || valeur || ' ' || cmp || ' ' || devise FROM public.v_valorisation_articles
            WHERE stock_item_id = '00000000-0000-4000-d067-0000000000e1'),
  'complete 2 1600 800.00 GNF', 'compte borne : quantite et valeur de ses seuls depots, cmp de l''article, en GNF');
SELECT throws_ok($$SELECT public.reserver_stock('00000000-0000-4000-d067-0000000000e1', '00000000-0000-4000-d067-0000000000c1', 1,
  p_affectation => 'Chantier')$$, '42501', NULL, 'compte borne : reservation dans un depot du site 1 refusee');
SELECT throws_ok($$SELECT public.lever_reservation_stock((SELECT id FROM res_ot WHERE n = 'r2a'), 'Essai')$$,
  '42501', 'Reservation introuvable ou hors de votre perimetre', 'compte borne : levee hors perimetre refusee, message unique');
SELECT throws_ok($$SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e7', 'exit', 1, '00000000-0000-4000-d067-0000000000c1',
  p_reservation => (SELECT id FROM res_ot WHERE n = 'r3'))$$, '42501', NULL,
  'compte borne : sortie sur une reservation du site 1 refusee avant toute lecture');
SELECT throws_ok($$SELECT public.reserver_stock('00000000-0000-4000-d067-0000000000e1', '00000000-0000-4000-d067-0000000000c3', 1,
  p_ordre_maintenance => '00000000-0000-4000-d067-000000000021')$$, '42501', 'Ordre de travail introuvable ou hors de votre perimetre',
  'compte borne : ordre de travail du site 1 refuse, message unique');
SELECT lives_ok($$SELECT public.reserver_stock('00000000-0000-4000-d067-0000000000e1', '00000000-0000-4000-d067-0000000000c3', 1,
  p_affectation => 'Atelier site 2')$$, 'compte borne : reservation dans son depot');
SELECT is((SELECT count(*)::int FROM public.v_stock_depots WHERE warehouse_id IN ('00000000-0000-4000-d067-0000000000c1', '00000000-0000-4000-d067-0000000000c2'))
          || ' ' || (SELECT quantite::int FROM public.v_stock_depots
                      WHERE stock_item_id = '00000000-0000-4000-d067-0000000000e7' AND warehouse_id = '00000000-0000-4000-d067-0000000000c3'),
  '0 1', 'C5 : v_stock_depots ne donne plus le depot du site 1 par le transfert, seulement le sien');
SELECT is((SELECT count(*)::int FROM public.valorisation_articles_stock() WHERE stock_item_id = '00000000-0000-4000-d067-0000000000e5'), 0,
  'C4 : aucun cout d''un article present seulement dans un depot d''un autre site');
RESET ROLE;

-- 9. D-072 R3-5 toujours vrai : reception d'un bon engage non annulable ------------
SELECT pg_temp.se_connecter('00000000-0000-4000-d067-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE bc2 AS SELECT public.enregistrer_bon_commande('00000000-0000-4000-d067-0000000000f1', '00000000-0000-4000-d067-0000000000c1',
  '[{"article": "00000000-0000-4000-d067-0000000000e6", "quantite": 2, "prix_unitaire": 1000}]') AS id;
SELECT public.soumettre_bon_commande((SELECT id FROM bc2));
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d067-000000000003');
SET LOCAL ROLE authenticated;
SELECT public.decider_bon_commande((SELECT id FROM bc2), true);
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d067-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE rec2 AS SELECT public.receptionner_bon_commande((SELECT id FROM bc2),
  (SELECT jsonb_agg(jsonb_build_object('ligne', id, 'recue', 2)) FROM public.purchase_order_items WHERE purchase_order_id = (SELECT id FROM bc2))) AS id;
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d067-000000000002');
SET LOCAL ROLE authenticated;
SELECT public.proposer_paiement(2000, 'Pompe D-067', p_bon => (SELECT id FROM bc2));
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d067-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_like($$SELECT public.annuler_reception((SELECT id FROM rec2), 'Erreur de saisie')$$, '%engages ou payes%',
  'R3-5 : reception d''un bon engage non annulable (fonction recreee par D-067)');
SELECT is((SELECT status FROM public.purchase_orders WHERE id = (SELECT id FROM bc2)), 'received', 'R3-5 : bon toujours recu');
RESET ROLE;


-- 10. Constats de la revue independante (C1 a C7) ---------------------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-d067-000000000001');
SET LOCAL ROLE authenticated;
-- C1 : entree annulee apres d'autres mouvements : sortie au cmp, « a verifier ».
SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e9', 'entry', 10, NULL, '00000000-0000-4000-d067-0000000000c1', now(), 100);
CREATE TEMP TABLE c1a AS SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e9', 'entry', 10, NULL, '00000000-0000-4000-d067-0000000000c1', now(), 500) AS id;
SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e9', 'exit', 5, '00000000-0000-4000-d067-0000000000c1');
SELECT public.annuler_mouvement_stock((SELECT id FROM c1a), 'Erreur de prix');
SELECT is((SELECT statut || ' ' || quantite || ' ' || cmp || ' ' || valeur FROM public.v_valorisation_articles
            WHERE stock_item_id = '00000000-0000-4000-d067-0000000000e9'),
  'a_verifier 5 300.00 1500', 'C1 : 10 a 100, 10 a 500, sortie 5, annulation de l''entree a 500 : 5 au cmp 300, a verifier (plus de valeur 0)');
SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000ea', 'entry', 10, NULL, '00000000-0000-4000-d067-0000000000c1', now(), 500);
CREATE TEMP TABLE c1b AS SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000ea', 'entry', 10, NULL, '00000000-0000-4000-d067-0000000000c1', now(), 100) AS id;
SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000ea', 'exit', 5, '00000000-0000-4000-d067-0000000000c1');
SELECT public.annuler_mouvement_stock((SELECT id FROM c1b), 'Erreur');
SELECT is((SELECT statut || ' ' || quantite || ' ' || cmp || ' ' || valeur FROM public.v_valorisation_articles
            WHERE stock_item_id = '00000000-0000-4000-d067-0000000000ea'),
  'a_verifier 5 300.00 1500', 'C1 : 10 a 500, 10 a 100, sortie 5, annulation de l''entree a 100 : cmp 300 (plus 700), a verifier');
SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000eb', 'entry', 10, NULL, '00000000-0000-4000-d067-0000000000c1', now(), 100);
CREATE TEMP TABLE c1c AS SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000eb', 'entry', 10, NULL, '00000000-0000-4000-d067-0000000000c1') AS id;
SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000eb', 'exit', 4, '00000000-0000-4000-d067-0000000000c1');
SELECT public.annuler_mouvement_stock((SELECT id FROM c1c), 'Erreur');
SELECT is((SELECT statut || ' ' || quantite || ' ' || quantite_non_valorisee || ' ' || cmp || ' ' || valeur FROM public.v_valorisation_articles
            WHERE stock_item_id = '00000000-0000-4000-d067-0000000000eb'),
  'a_verifier 6 3.000 100.00 300', 'C1 : 10 a 100, 10 sans prix, sortie 4, annulation de l''entree sans prix : cmp 100 (plus 133,33), a verifier');
SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000ec', 'entry', 10, NULL, '00000000-0000-4000-d067-0000000000c1', now(), 100);
CREATE TEMP TABLE c1d AS SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000ec', 'entry', 5, NULL, '00000000-0000-4000-d067-0000000000c1', now(), 200) AS id;
SELECT public.annuler_mouvement_stock((SELECT id FROM c1d), 'Doublon');
SELECT is((SELECT statut || ' ' || quantite || ' ' || cmp || ' ' || valeur FROM public.v_valorisation_articles
            WHERE stock_item_id = '00000000-0000-4000-d067-0000000000ec'),
  'complete 10 100.00 1000', 'C1 : entree annulee juste apres elle : retrait exact a son prix, complete');
RESET ROLE;

-- C2 : ordre d'enregistrement (enregistre_le), pas created_at (debut de transaction).
SELECT pg_temp.se_connecter(NULL);
INSERT INTO public.stock_movements (movement_date, movement_type, stock_item_id, quantity, unit_price, total_value, to_warehouse_id, created_at)
VALUES (now(), 'entry', '00000000-0000-4000-d067-0000000000ed', 10, 100, 1000, '00000000-0000-4000-d067-0000000000c1', now() + interval '2 hours');
INSERT INTO public.stock_movements (movement_date, movement_type, stock_item_id, quantity, from_warehouse_id, created_at)
VALUES (now(), 'exit', '00000000-0000-4000-d067-0000000000ed', 10, '00000000-0000-4000-d067-0000000000c1', now() + interval '1 hour');
INSERT INTO public.stock_movements (movement_date, movement_type, stock_item_id, quantity, unit_price, total_value, to_warehouse_id, created_at)
VALUES (now(), 'entry', '00000000-0000-4000-d067-0000000000ed', 10, 300, 3000, '00000000-0000-4000-d067-0000000000c1', now());
SELECT pg_temp.se_connecter('00000000-0000-4000-d067-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT cmp FROM public.v_valorisation_articles WHERE stock_item_id = '00000000-0000-4000-d067-0000000000ed'), 300.00,
  'C2 : entree a 100, sortie de 10, entree a 300 dans l''ordre d''ecriture : cmp 300 malgre un created_at forge en sens inverse');

-- C3 : reception de pneus annulable tant que chaque pneu n'a que son entree.
CREATE TEMP TABLE bc3 AS SELECT public.enregistrer_bon_commande('00000000-0000-4000-d067-0000000000f1', '00000000-0000-4000-d067-0000000000c1',
  '[{"article": "00000000-0000-4000-d067-0000000000ee", "quantite": 2, "prix_unitaire": 500},
    {"quantite": 1, "prix_unitaire": 1000000, "pneu": {"marque": "Marque D067", "modele": "ANN"}}]') AS id;
SELECT public.soumettre_bon_commande((SELECT id FROM bc3));
CREATE TEMP TABLE bc4 AS SELECT public.enregistrer_bon_commande('00000000-0000-4000-d067-0000000000f1', '00000000-0000-4000-d067-0000000000c1',
  '[{"quantite": 1, "prix_unitaire": 1000000, "pneu": {"marque": "Marque D067", "modele": "SEUL"}}]') AS id;
SELECT public.soumettre_bon_commande((SELECT id FROM bc4));
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d067-000000000003');
SET LOCAL ROLE authenticated;
SELECT public.decider_bon_commande((SELECT id FROM bc3), true);
SELECT public.decider_bon_commande((SELECT id FROM bc4), true);
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d067-000000000006');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.receptionner_bon_commande((SELECT id FROM bc4),
  (SELECT jsonb_agg(jsonb_build_object('ligne', id, 'recue', 1, 'pneus', '[{"numero": "TEST-PN-D067-8"}]'::jsonb))
     FROM public.purchase_order_items WHERE purchase_order_id = (SELECT id FROM bc4)))$$, '42501', NULL,
  'C3 : compte n''ayant que le droit stocks : reception de pneus refusee');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d067-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE rec3 AS SELECT public.receptionner_bon_commande((SELECT id FROM bc3),
  (SELECT jsonb_agg(CASE WHEN pneu_marque IS NOT NULL
            THEN jsonb_build_object('ligne', id, 'recue', 1, 'pneus', '[{"numero": "TEST-PN-D067-9"}]'::jsonb)
            ELSE jsonb_build_object('ligne', id, 'recue', 2) END)
     FROM public.purchase_order_items WHERE purchase_order_id = (SELECT id FROM bc3))) AS id;
CREATE TEMP TABLE pneu_c3 AS SELECT rp.tire_id AS id FROM public.receptions_achat_pneus rp
  JOIN public.receptions_achat_lignes x ON x.id = rp.reception_ligne_id WHERE x.delivery_id = (SELECT id FROM rec3);
SELECT lives_ok($$SELECT public.annuler_reception((SELECT id FROM rec3), 'Numero errone')$$,
  'C3 : reception annulable, son pneu n''ayant que son entree');
SELECT ok((SELECT t.status = 'retired' AND t.tire_number LIKE 'TEST-PN-D067-9-ANNULE-REC-%' FROM public.tires t WHERE t.id = (SELECT id FROM pneu_c3)),
  'C3 : pneu sorti du registre (statut reforme, numero suffixe : le numero saisi est libre)');
SELECT ok(EXISTS (SELECT 1 FROM public.pneus_operations a JOIN public.pneus_operations e ON e.id = a.annule_operation_id
                   WHERE e.tire_id = (SELECT id FROM pneu_c3) AND e.type = 'entree' AND a.type = 'annulation'
                     AND a.motif LIKE 'Annulation de la reception REC-% : Numero errone'
                     AND a.note = 'Numero saisi a la reception : TEST-PN-D067-9'),
  'C3 : annulation de l''entree du pneu journalisee et motivee, pas de suppression');
SELECT is((SELECT status FROM public.purchase_orders WHERE id = (SELECT id FROM bc3)) || ' '
          || (SELECT quantite::int FROM public.v_stock_depots WHERE stock_item_id = '00000000-0000-4000-d067-0000000000ee'
                AND warehouse_id = '00000000-0000-4000-d067-0000000000c1'),
  'approved 0', 'C3 : bon revenu a approuve, lignes de stock de la meme reception annulees');
SELECT lives_ok($$SELECT public.receptionner_bon_commande((SELECT id FROM bc3),
  (SELECT jsonb_agg(CASE WHEN pneu_marque IS NOT NULL
            THEN jsonb_build_object('ligne', id, 'recue', 1, 'pneus', '[{"numero": "TEST-PN-D067-9"}]'::jsonb)
            ELSE jsonb_build_object('ligne', id, 'recue', 2) END)
     FROM public.purchase_order_items WHERE purchase_order_id = (SELECT id FROM bc3)))$$,
  'C3 : nouvelle reception avec le meme numero de pneu');
SELECT is((SELECT nb_pneus FROM public.v_pneus_performance WHERE marque = 'MARQUE D067' AND modele = 'ANN'), 1,
  'C3 : le pneu de la reception annulee n''entre pas dans la performance');

-- C7 : mouvement sans lot anterieur au suivi par lot : annulation refusee.
SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000ef', 'entry', 2, NULL, '00000000-0000-4000-d067-0000000000c1');
CREATE TEMP TABLE c7 AS SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000ef', 'exit', 2, '00000000-0000-4000-d067-0000000000c1') AS id;
RESET ROLE;
UPDATE public.stock_items SET suivi = 'lot' WHERE id = '00000000-0000-4000-d067-0000000000ef';
SET LOCAL ROLE authenticated;
SELECT throws_like($$SELECT public.annuler_mouvement_stock((SELECT id FROM c7), 'Erreur')$$, '%anterieur au suivi%',
  'C7 : annulation d''un mouvement sans lot sur un article passe en suivi par lot refusee');

-- Retour d'une sortie annulee dans sa reservation.
SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000f0', 'entry', 5, NULL, '00000000-0000-4000-d067-0000000000c1');
CREATE TEMP TABLE res_ret AS SELECT public.reserver_stock('00000000-0000-4000-d067-0000000000f0', '00000000-0000-4000-d067-0000000000c1', 3,
  p_affectation => 'Chantier sud') AS id;
CREATE TEMP TABLE sortie_ret AS SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000f0', 'exit', 2, '00000000-0000-4000-d067-0000000000c1',
  p_reservation => (SELECT id FROM res_ret)) AS id;
SELECT public.annuler_mouvement_stock((SELECT id FROM sortie_ret), 'Piece non sortie');
SELECT is((SELECT statut || ' ' || quantite_consommee || ' ' || quantite_restante FROM public.v_reservations_stock WHERE id = (SELECT id FROM res_ret)),
  'active 0 3', 'sortie annulee : sa quantite revient a la reservation');
RESET ROLE;

-- C6 : vues fermees a anon.
SELECT ok(NOT (SELECT bool_or(has_table_privilege('anon', v, 'SELECT'))
  FROM unnest(ARRAY['public.v_reservations_stock', 'public.v_stock_disponibilite', 'public.v_stock_lots', 'public.v_stock_lots_mouvements',
                    'public.v_valorisation_stock', 'public.v_valorisation_articles', 'public.v_valorisation_depots',
                    'public.v_pneus_performance', 'public.v_stock_depots']) v),
  'C6 : aucune des vues de stocks et de pneus lisible par anon');

SELECT * FROM finish();
ROLLBACK;
