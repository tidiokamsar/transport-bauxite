-- Tests (D-067) : reservations, lots et numeros de serie, cout moyen
-- pondere, reception de pneus depuis un bon de commande, performance des
-- pneus par marque et modele (migration 20261119210000). Tout est annule.
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

SELECT plan(52);

-- Donnees de test (sans JWT : gardes inactives).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-d067-000000000001', 'logistique.d067@exemple.invalid'),
  ('00000000-0000-4000-d067-000000000002', 'mecanicien.d067@exemple.invalid'),
  ('00000000-0000-4000-d067-000000000003', 'admin.d067@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-d067-000000000001', 'logistician', 'Logistique D-067', 'active', NULL),
  ('00000000-0000-4000-d067-000000000002', 'mechanic', 'Mecanicien D-067', 'active', NULL),
  ('00000000-0000-4000-d067-000000000003', 'admin', 'Admin D-067', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.sites (id, name, type) VALUES ('00000000-0000-4000-d067-0000000000a1', 'Site D-067', 'depot');
INSERT INTO public.warehouses (id, name, code, warehouse_type, site_id) VALUES
  ('00000000-0000-4000-d067-0000000000c1', 'Magasin D-067', 'TEST-MAG-D067', 'main', '00000000-0000-4000-d067-0000000000a1'),
  ('00000000-0000-4000-d067-0000000000c2', 'Atelier D-067', 'TEST-ATL-D067', 'garage', '00000000-0000-4000-d067-0000000000a1');
INSERT INTO public.suppliers (id, supplier_number, supplier_type, company_name) VALUES
  ('00000000-0000-4000-d067-0000000000f1', 'TEST-F-D067', 'parts', 'Fournisseur D-067');
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status, site_id) VALUES
  ('00000000-0000-4000-d067-0000000000b1', 'TEST-D067-1', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-d067-0000000000a1');
INSERT INTO public.maintenance_orders (id, vehicle_id, maintenance_type, description, status, work_order_number) VALUES
  ('00000000-0000-4000-d067-000000000021', '00000000-0000-4000-d067-0000000000b1', 'corrective', 'TEST-D067', 'open', 'TEST-OT-D067');
INSERT INTO public.stock_items (id, item_code, name, unit_of_measure, suivi) VALUES
  ('00000000-0000-4000-d067-0000000000e1', 'TEST-ART-D067', 'Filtre D-067', 'piece', 'aucun'),
  ('00000000-0000-4000-d067-0000000000e2', 'TEST-LOT-D067', 'Huile D-067', 'bidon', 'lot'),
  ('00000000-0000-4000-d067-0000000000e3', 'TEST-SER-D067', 'Alternateur D-067', 'piece', 'serie'),
  ('00000000-0000-4000-d067-0000000000e4', 'TEST-CMP-D067', 'Courroie D-067', 'piece', 'aucun'),
  ('00000000-0000-4000-d067-0000000000e5', 'TEST-SANS-D067', 'Joint D-067', 'piece', 'aucun');
DELETE FROM public.settings WHERE key IN ('pneu_reforme_precoce_km', 'achats_validation_separee');
INSERT INTO public.settings (key, value, category) VALUES ('pneu_reforme_precoce_km', '{"value": "10000"}', 'pneus');
SELECT throws_ok($$INSERT INTO public.settings (key, value) VALUES ('pneu_reforme_precoce_km', '{"value": "abc"}')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value$$, '22023', NULL, 'seuil de reforme precoce : nombre attendu');

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
SELECT is((SELECT vehicle_id FROM public.reservations_stock WHERE id = (SELECT id FROM res)),
  '00000000-0000-4000-d067-0000000000b1'::uuid, 'engin de l''ordre repris sur la reservation');
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
SELECT is((SELECT maintenance_order_id FROM public.stock_movements WHERE id = (SELECT id FROM sortie_res)),
  '00000000-0000-4000-d067-000000000021'::uuid, 'sortie sur reservation imputee a l''ordre de la reservation');
SELECT is((SELECT statut || ' ' || quantite_consommee || ' ' || quantite_restante FROM public.v_reservations_stock WHERE id = (SELECT id FROM res)),
  'active 3 1', 'reservation consommee en partie par la sortie');
SELECT throws_ok($$SELECT public.mouvement_stock('00000000-0000-4000-d067-0000000000e1', 'exit', 2, '00000000-0000-4000-d067-0000000000c1',
  p_reservation => (SELECT id FROM res))$$, '22023', NULL, 'sortie superieure au reste de la reservation refusee');
SELECT throws_ok($$SELECT public.lever_reservation_stock((SELECT id FROM res), ' ')$$, '22023', NULL, 'levee sans motif refusee');
SELECT lives_ok($$SELECT public.lever_reservation_stock((SELECT id FROM res), 'Piece remplacee par le loueur')$$, 'levee motivee');
SELECT is((SELECT statut || ' ' || quantite_restante FROM public.v_reservations_stock WHERE id = (SELECT id FROM res)) || ' '
          || public.stock_libre('00000000-0000-4000-d067-0000000000e1', '00000000-0000-4000-d067-0000000000c1'),
  'levee 0 1', 'reservation levee : le reste redevient libre');
SELECT throws_ok($$UPDATE public.reservations_stock SET quantite = 9 WHERE id = (SELECT id FROM res)$$,
  '42501', NULL, 'ecriture directe d''une reservation refusee');
SELECT throws_ok($$DELETE FROM public.reservations_stock WHERE id = (SELECT id FROM res)$$,
  '42501', NULL, 'suppression d''une reservation refusee');
RESET ROLE;

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
SELECT throws_ok($$INSERT INTO public.stock_mouvements_lots (stock_movement_id, code, quantite)
  VALUES ((SELECT id FROM sortie_lot), 'X', 1)$$, '42501', NULL, 'lignes de lots : ecriture directe refusee');

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
SELECT throws_ok($$SELECT public.annuler_reception((SELECT id FROM rec), 'Erreur')$$, '22023', NULL,
  'reception avec pneus non annulable');

-- 5. Performance par marque et modele ----------------------------------------------
SELECT public.monter_pneu((SELECT id FROM public.tires WHERE tire_number = 'TEST-PN-D067-1'), '00000000-0000-4000-d067-0000000000b1', 'AV G', p_km => 1000);
SELECT public.monter_pneu((SELECT id FROM public.tires WHERE tire_number = 'TEST-PN-D067-2'), '00000000-0000-4000-d067-0000000000b1', 'AV D', p_km => 1000);
SELECT public.demonter_pneu((SELECT id FROM public.tires WHERE tire_number = 'TEST-PN-D067-1'), 'Usure', 'damaged', '00000000-0000-4000-d067-0000000000a1', p_km => 51000);
SELECT public.demonter_pneu((SELECT id FROM public.tires WHERE tire_number = 'TEST-PN-D067-2'), 'Coupure', 'damaged', '00000000-0000-4000-d067-0000000000a1', p_km => 6000);
SELECT public.reformer_pneu((SELECT id FROM public.tires WHERE tire_number = 'TEST-PN-D067-1'), 'Usure finale');
SELECT public.reformer_pneu((SELECT id FROM public.tires WHERE tire_number = 'TEST-PN-D067-2'), 'Coupure flanc');
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

SELECT * FROM finish();
ROLLBACK;
