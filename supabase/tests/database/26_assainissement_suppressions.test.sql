-- Tests (D-042) : plus de suppression physique d'enregistrements metier
-- depuis le navigateur ; numero de bon de commande attribue par le serveur
-- (migration 20261115120000) ; depuis D-053, le bon s'ecrit par fonction
-- serveur. Tout est annule.
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

SELECT plan(10);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-9800-000000000001', 'directeur.d042@exemple.invalid'),
  ('00000000-0000-4000-9800-000000000002', 'admin.d042@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-9800-000000000001', 'director', 'Directeur D-042', 'active', NULL),
  ('00000000-0000-4000-9800-000000000002', 'admin', 'Admin D-042', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.suppliers (id, supplier_number, supplier_type, company_name) VALUES
  ('00000000-0000-4000-9800-0000000000f1', 'TEST-F-D042', 'parts', 'Fournisseur test D-042');
INSERT INTO public.drivers (id, license_number, license_category, license_expiry, hire_date, name) VALUES
  ('00000000-0000-4000-9800-0000000000d1', 'TEST-PERMIS-D042', 'C', '2030-01-01', '2020-01-01', 'Chauffeur D-042');
INSERT INTO public.sites (id, name, type) VALUES ('00000000-0000-4000-9800-0000000000a1', 'Site D-042', 'mine');
INSERT INTO public.warehouses (id, name, code, warehouse_type, site_id) VALUES
  ('00000000-0000-4000-9800-0000000000e1', 'Magasin D-042', 'TEST-MAG-D042', 'main', '00000000-0000-4000-9800-0000000000a1');

SELECT pg_temp.se_connecter('00000000-0000-4000-9800-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE bc AS SELECT public.enregistrer_bon_commande(
  p_fournisseur => '00000000-0000-4000-9800-0000000000f1', p_depot => '00000000-0000-4000-9800-0000000000e1',
  p_lignes => '[{"designation": "Filtre", "quantite": 2, "prix_unitaire": 10}]'::jsonb) AS id;
SELECT matches((SELECT po_number FROM public.purchase_orders WHERE id = (SELECT id FROM bc)),
  '^BC-[0-9]{4}-[0-9]{5}$', 'numero de bon de commande attribue par le serveur');
SELECT throws_ok($$UPDATE public.purchase_orders SET po_number = 'BC-X' WHERE id = (SELECT id FROM bc)$$,
  '42501', NULL, 'numero non modifiable');
SELECT throws_ok($$DELETE FROM public.purchase_order_items WHERE purchase_order_id = (SELECT id FROM bc)$$,
  '42501', NULL, 'lignes d''un brouillon : remplacees par la fonction serveur seulement (D-053)');
SELECT throws_ok($$DELETE FROM public.purchase_orders WHERE id = (SELECT id FROM bc)$$,
  '42501', NULL, 'bon de commande non supprimable');
SELECT lives_ok($$SELECT public.annuler_bon_commande((SELECT id FROM bc), 'Test')$$,
  'bon de commande annule a la place');
SELECT throws_ok($$DELETE FROM public.drivers WHERE id = '00000000-0000-4000-9800-0000000000d1'$$,
  '42501', NULL, 'dossier chauffeur non supprimable');
SELECT lives_ok($$UPDATE public.drivers SET status = 'terminated' WHERE id = '00000000-0000-4000-9800-0000000000d1'$$,
  'dossier chauffeur clos a la place');
SELECT throws_ok($$DELETE FROM public.stock_movements$$, '42501', NULL, 'mouvement de stock non supprimable');
RESET ROLE;

-- Meme un administrateur ne supprime pas depuis l'API.
SELECT pg_temp.se_connecter('00000000-0000-4000-9800-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$DELETE FROM public.sites WHERE id = '00000000-0000-4000-9800-0000000000a1'$$,
  '42501', NULL, 'site non supprimable, meme par un administrateur');
SELECT lives_ok($$UPDATE public.sites SET is_active = false WHERE id = '00000000-0000-4000-9800-0000000000a1'$$,
  'site desactive a la place');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
