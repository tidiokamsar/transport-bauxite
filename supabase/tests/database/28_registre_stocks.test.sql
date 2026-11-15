-- Tests (D-044) : registre des stocks magasin (migration 20261115180000).
-- Stock par depot calcule depuis les mouvements, sortie bornee au stock
-- disponible, inventaire motive, annulation par contre-mouvement, quantite
-- non modifiable, perimetre site des depots. Tout est annule.
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

SELECT plan(17);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-9a00-000000000001', 'magasin.d044@exemple.invalid'),
  ('00000000-0000-4000-9a00-000000000002', 'site.b.d044@exemple.invalid'),
  ('00000000-0000-4000-9a00-000000000003', 'comptable.d044@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-9a00-0000000000a1', 'Site A D-044', 'mine'),
  ('00000000-0000-4000-9a00-0000000000a2', 'Site B D-044', 'depot');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-9a00-000000000001', 'admin', 'Magasinier global', 'active', NULL),
  ('00000000-0000-4000-9a00-000000000002', 'admin', 'Admin site B', 'active', '00000000-0000-4000-9a00-0000000000a2'),
  ('00000000-0000-4000-9a00-000000000003', 'accountant', 'Comptable', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.warehouses (id, name, code, warehouse_type, site_id) VALUES
  ('00000000-0000-4000-9a00-0000000000d1', 'Magasin A D-044', 'TEST-MAG-A', 'main', '00000000-0000-4000-9a00-0000000000a1'),
  ('00000000-0000-4000-9a00-0000000000d2', 'Atelier A D-044', 'TEST-ATL-A', 'garage', '00000000-0000-4000-9a00-0000000000a1');

SELECT pg_temp.se_connecter('00000000-0000-4000-9a00-000000000001');
SET LOCAL ROLE authenticated;
INSERT INTO public.stock_items (id, item_code, name, unit_of_measure, minimum_threshold)
VALUES ('00000000-0000-4000-9a00-0000000000f1', 'TEST-FILTRE-D044', 'Filtre a huile', 'piece', 5);
SELECT throws_ok($$INSERT INTO public.stock_items (item_code, name, quantity_in_stock) VALUES ('TEST-X-D044', 'X', 100)$$,
  '42501', NULL, 'quantite non saisissable a la creation');
SELECT throws_ok($$UPDATE public.stock_items SET quantity_in_stock = 50 WHERE id = '00000000-0000-4000-9a00-0000000000f1'$$,
  '42501', NULL, 'quantite non modifiable');
SELECT throws_ok($$INSERT INTO public.stock_movements (movement_number, movement_type, stock_item_id, quantity, to_warehouse_id)
  VALUES ('X', 'entry', '00000000-0000-4000-9a00-0000000000f1', 10, '00000000-0000-4000-9a00-0000000000d1')$$,
  '42501', NULL, 'pas d''insertion directe de mouvement');
CREATE TEMP TABLE e1 AS SELECT public.mouvement_stock('00000000-0000-4000-9a00-0000000000f1', 'entry', 20, NULL,
  '00000000-0000-4000-9a00-0000000000d1', now() - interval '2 hours', 15000, 'BL-001') AS id;
GRANT SELECT ON e1 TO authenticated;
SELECT matches((SELECT movement_number FROM public.stock_movements WHERE id = (SELECT id FROM e1)), '^MVT-[0-9]{4}-[0-9]{6}$',
  'numero de mouvement attribue par le serveur');
SELECT is((SELECT quantity_in_stock FROM public.stock_items WHERE id = '00000000-0000-4000-9a00-0000000000f1'), 20, 'entree : 20 en stock');
SELECT throws_ok($$SELECT public.mouvement_stock('00000000-0000-4000-9a00-0000000000f1', 'exit', 25, '00000000-0000-4000-9a00-0000000000d1')$$,
  '22023', NULL, 'sortie superieure au stock refusee');
SELECT lives_ok($$SELECT public.mouvement_stock('00000000-0000-4000-9a00-0000000000f1', 'transfer', 8, '00000000-0000-4000-9a00-0000000000d1', '00000000-0000-4000-9a00-0000000000d2', now() - interval '1 hour')$$,
  'transfert vers l''atelier');
SELECT lives_ok($$SELECT public.mouvement_stock('00000000-0000-4000-9a00-0000000000f1', 'exit', 3, '00000000-0000-4000-9a00-0000000000d2', NULL, now() - interval '30 minutes', NULL, 'OT-12')$$,
  'sortie de l''atelier');
SELECT is((SELECT string_agg(w.code || '=' || d.quantite, ',' ORDER BY w.code) FROM public.v_stock_depots d JOIN public.warehouses w ON w.id = d.warehouse_id
  WHERE d.stock_item_id = '00000000-0000-4000-9a00-0000000000f1'), 'TEST-ATL-A=5,TEST-MAG-A=12', 'stock par depot');
SELECT throws_ok($$SELECT public.inventorier_stock('00000000-0000-4000-9a00-0000000000f1', '00000000-0000-4000-9a00-0000000000d1', 11)$$,
  '22023', NULL, 'ecart d''inventaire sans motif refuse');
SELECT is(public.inventorier_stock('00000000-0000-4000-9a00-0000000000f1', '00000000-0000-4000-9a00-0000000000d1', 11, 'Piece endommagee'), -1,
  'inventaire : ajustement de -1');
SELECT is(public.inventorier_stock('00000000-0000-4000-9a00-0000000000f1', '00000000-0000-4000-9a00-0000000000d1', 11), 0,
  'inventaire conforme : aucun mouvement');
SELECT lives_ok($$SELECT public.annuler_mouvement_stock((SELECT id FROM public.stock_movements WHERE reference_piece = 'OT-12'), 'Sortie saisie sur le mauvais article')$$,
  'sortie annulee par contre-mouvement');
SELECT is((SELECT quantity_in_stock FROM public.stock_items WHERE id = '00000000-0000-4000-9a00-0000000000f1'), 19,
  'apres annulation : 11 au magasin + 8 a l''atelier');
SELECT throws_ok($$UPDATE public.stock_movements SET quantity = 1$$, '42501', NULL, 'mouvement non modifiable');
RESET ROLE;

-- Compte affecte au site B : depots du site A hors perimetre ; comptable sans droit stock.
SELECT pg_temp.se_connecter('00000000-0000-4000-9a00-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.mouvement_stock('00000000-0000-4000-9a00-0000000000f1', 'entry', 1, NULL, '00000000-0000-4000-9a00-0000000000d1')$$,
  '42501', NULL, 'depot d''un autre site : ecriture refusee');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-9a00-000000000003');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.mouvement_stock('00000000-0000-4000-9a00-0000000000f1', 'entry', 1, NULL, '00000000-0000-4000-9a00-0000000000d2')$$,
  '42501', NULL, 'sans droit d''ecriture stock : refuse');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
