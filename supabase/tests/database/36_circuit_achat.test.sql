-- Tests (D-053) : circuit achat, approbation par une autre personne,
-- reception partielle vers le stock, annulation de reception
-- (migration 20261117090000). Tout est annule.
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

SELECT plan(15);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a300-000000000001', 'logistique.d053@exemple.invalid'),
  ('00000000-0000-4000-a300-000000000002', 'comptable.d053@exemple.invalid'),
  ('00000000-0000-4000-a300-000000000003', 'admin.d053@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-a300-000000000001', 'logistician', 'Logistique D-053', 'active', NULL),
  ('00000000-0000-4000-a300-000000000002', 'accountant', 'Comptable D-053', 'active', NULL),
  ('00000000-0000-4000-a300-000000000003', 'admin', 'Admin D-053', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.sites (id, name, type) VALUES ('00000000-0000-4000-a300-0000000000a1', 'Site D-053', 'depot');
INSERT INTO public.warehouses (id, name, code, warehouse_type, site_id) VALUES
  ('00000000-0000-4000-a300-0000000000d1', 'Magasin D-053', 'TEST-MAG-D053', 'main', '00000000-0000-4000-a300-0000000000a1');
INSERT INTO public.suppliers (id, supplier_number, supplier_type, company_name) VALUES
  ('00000000-0000-4000-a300-0000000000f1', 'TEST-F-D053', 'parts', 'Fournisseur D-053');
INSERT INTO public.stock_items (id, item_code, name, unit_of_measure) VALUES
  ('00000000-0000-4000-a300-0000000000e1', 'TEST-ART-D053', 'Filtre D-053', 'piece');
DELETE FROM public.settings WHERE key = 'achats_validation_separee';

-- Logistique : brouillon et soumission
SELECT pg_temp.se_connecter('00000000-0000-4000-a300-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE bc AS SELECT public.enregistrer_bon_commande(
  p_fournisseur => '00000000-0000-4000-a300-0000000000f1', p_depot => '00000000-0000-4000-a300-0000000000d1',
  p_lignes => '[{"article": "00000000-0000-4000-a300-0000000000e1", "quantite": 10, "prix_unitaire": 5000},
                {"designation": "Transport", "quantite": 1, "prix_unitaire": 20000}]'::jsonb) AS id;
SELECT is((SELECT total_amount FROM public.purchase_orders WHERE id = (SELECT id FROM bc)), 70000::bigint, 'totaux calcules par le serveur');
SELECT throws_ok($$INSERT INTO public.purchase_orders (po_number, supplier_id) VALUES ('X', '00000000-0000-4000-a300-0000000000f1')$$,
  '42501', NULL, 'ecriture directe refusee');
SELECT lives_ok($$SELECT public.soumettre_bon_commande((SELECT id FROM bc))$$, 'soumission');
SELECT throws_ok($$SELECT public.decider_bon_commande((SELECT id FROM bc), true)$$, '42501', NULL, 'sans droit d''approbation : refuse');
RESET ROLE;

-- Administrateur : pas d'approbation de son propre bon
SELECT pg_temp.se_connecter('00000000-0000-4000-a300-000000000003');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE bc2 AS SELECT public.enregistrer_bon_commande(
  p_fournisseur => '00000000-0000-4000-a300-0000000000f1', p_depot => '00000000-0000-4000-a300-0000000000d1',
  p_lignes => '[{"designation": "Prestation", "quantite": 1, "prix_unitaire": 1000}]'::jsonb) AS id;
SELECT public.soumettre_bon_commande((SELECT id FROM bc2));
SELECT throws_ok($$SELECT public.decider_bon_commande((SELECT id FROM bc2), true)$$, '42501', NULL, 'le demandeur n''approuve pas son bon');
RESET ROLE;

-- Comptable : rejet motive, approbation
SELECT pg_temp.se_connecter('00000000-0000-4000-a300-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.decider_bon_commande((SELECT id FROM bc2), false)$$, '22023', NULL, 'rejet sans motif refuse');
SELECT public.decider_bon_commande((SELECT id FROM bc), true);
SELECT is((SELECT status FROM public.purchase_orders WHERE id = (SELECT id FROM bc)), 'approved', 'bon approuve par une autre personne');
SELECT throws_ok($$SELECT public.receptionner_bon_commande((SELECT id FROM bc),
  (SELECT jsonb_agg(jsonb_build_object('ligne', id, 'recue', 1)) FROM public.purchase_order_items WHERE purchase_order_id = (SELECT id FROM bc)))$$,
  '42501', NULL, 'reception : droit d''ecriture des stocks requis');
RESET ROLE;

-- Logistique (magasin) : reception partielle, depassement, annulation
SELECT pg_temp.se_connecter('00000000-0000-4000-a300-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE rec AS SELECT public.receptionner_bon_commande((SELECT id FROM bc),
  (SELECT jsonb_agg(jsonb_build_object('ligne', id, 'recue', CASE WHEN stock_item_id IS NULL THEN 1 ELSE 6 END, 'refusee', CASE WHEN stock_item_id IS NULL THEN 0 ELSE 1 END, 'motif_refus', 'Carton abime'))
     FROM public.purchase_order_items WHERE purchase_order_id = (SELECT id FROM bc)), 'BL-123') AS id;
SELECT is((SELECT status || ' ' || coalesce((SELECT d.quantite FROM public.v_stock_depots d WHERE d.stock_item_id = '00000000-0000-4000-a300-0000000000e1' AND d.warehouse_id = '00000000-0000-4000-a300-0000000000d1'), 0)
             FROM public.purchase_orders WHERE id = (SELECT id FROM bc)), 'partially_received 6', 'reception partielle : 6 en stock');
SELECT throws_ok($$SELECT public.receptionner_bon_commande((SELECT id FROM bc),
  (SELECT jsonb_agg(jsonb_build_object('ligne', id, 'recue', 5)) FROM public.purchase_order_items WHERE purchase_order_id = (SELECT id FROM bc) AND stock_item_id IS NOT NULL))$$,
  '22023', NULL, 'plus que la quantite commandee : refuse');
SELECT throws_ok($$SELECT public.annuler_mouvement_stock((SELECT stock_movement_id FROM public.receptions_achat_lignes WHERE delivery_id = (SELECT id FROM rec) AND stock_movement_id IS NOT NULL), 'Test')$$,
  '22023', NULL, 'mouvement d''une reception : annulation directe refusee');
SELECT public.annuler_reception((SELECT id FROM rec), 'Mauvais bon de livraison');
SELECT is((SELECT status || ' ' || coalesce((SELECT d.quantite FROM public.v_stock_depots d WHERE d.stock_item_id = '00000000-0000-4000-a300-0000000000e1' AND d.warehouse_id = '00000000-0000-4000-a300-0000000000d1'), 0)
             FROM public.purchase_orders WHERE id = (SELECT id FROM bc)), 'approved 0', 'reception annulee : stock et statut retablis');
SELECT public.receptionner_bon_commande((SELECT id FROM bc),
  (SELECT jsonb_agg(jsonb_build_object('ligne', id, 'recue', quantity)) FROM public.purchase_order_items WHERE purchase_order_id = (SELECT id FROM bc)), 'BL-124');
SELECT is((SELECT status FROM public.purchase_orders WHERE id = (SELECT id FROM bc)), 'received', 'reception complete : bon recu');
SELECT throws_ok($$SELECT public.annuler_bon_commande((SELECT id FROM bc), 'Test')$$, '22023', NULL, 'bon recu : annulation refusee');
SELECT throws_ok($$UPDATE public.achats_journal SET motif = 'x' WHERE purchase_order_id = (SELECT id FROM bc)$$, '42501', NULL, 'journal non modifiable');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
