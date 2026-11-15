-- Tests (D-056) : boite « Mes validations » calculee selon les droits et
-- la separation, notifications personnelles ecrites par le serveur
-- (migration 20261117180000). Tout est annule.
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

SELECT plan(8);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a600-000000000001', 'logistique.d056@exemple.invalid'),
  ('00000000-0000-4000-a600-000000000002', 'comptable.d056@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-a600-000000000001', 'logistician', 'Logistique D-056', 'active', NULL),
  ('00000000-0000-4000-a600-000000000002', 'accountant', 'Comptable D-056', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.sites (id, name, type) VALUES ('00000000-0000-4000-a600-0000000000a1', 'Site D-056', 'depot');
INSERT INTO public.warehouses (id, name, code, warehouse_type, site_id) VALUES
  ('00000000-0000-4000-a600-0000000000d1', 'Magasin D-056', 'TEST-MAG-D056', 'main', '00000000-0000-4000-a600-0000000000a1');
INSERT INTO public.suppliers (id, supplier_number, supplier_type, company_name) VALUES
  ('00000000-0000-4000-a600-0000000000f1', 'TEST-F-D056', 'parts', 'Fournisseur D-056');
DELETE FROM public.settings WHERE key = 'achats_validation_separee';

SELECT pg_temp.se_connecter('00000000-0000-4000-a600-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE bc AS SELECT public.enregistrer_bon_commande(
  p_fournisseur => '00000000-0000-4000-a600-0000000000f1', p_depot => '00000000-0000-4000-a600-0000000000d1',
  p_lignes => '[{"designation": "Prestation", "quantite": 1, "prix_unitaire": 1000}]'::jsonb) AS id;
SELECT public.soumettre_bon_commande((SELECT id FROM bc));
CREATE TEMP TABLE num AS SELECT po_number FROM public.purchase_orders WHERE id = (SELECT id FROM bc);
GRANT SELECT ON num TO authenticated;
SELECT is((SELECT count(*)::int FROM public.mes_validations() WHERE reference = (SELECT po_number FROM num) AND objet = 'Bon de commande à approuver'), 0,
  'le demandeur ne voit pas son bon a approuver');
SELECT throws_ok($$INSERT INTO public.notifications (user_id, notification_type, title, message)
  VALUES ('00000000-0000-4000-a600-000000000002', 'x', 'x', 'x')$$, '42501', NULL, 'aucune notification ecrite depuis le navigateur');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-a600-000000000002');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.mes_validations() WHERE reference = (SELECT po_number FROM num) AND objet = 'Bon de commande à approuver'), 1,
  'l''approbateur voit le bon soumis');
SELECT public.decider_bon_commande((SELECT id FROM bc), true);
SELECT is((SELECT count(*)::int FROM public.mes_validations() WHERE reference = (SELECT po_number FROM num)), 0,
  'bon approuve : plus rien a faire pour l''approbateur (pas de droit stock)');
SELECT is((SELECT count(*)::int FROM public.notifications WHERE reference_id = (SELECT id FROM bc)), 0, 'notification d''autrui invisible');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-a600-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT title FROM public.notifications WHERE reference_id = (SELECT id FROM bc)), 'Bon de commande ' || (SELECT po_number FROM num) || ' approuvé',
  'le demandeur est notifie de l''approbation');
SELECT is((SELECT count(*)::int FROM public.mes_validations() WHERE reference = (SELECT po_number FROM num) AND objet = 'Bon de commande à réceptionner'), 1,
  'le magasin voit le bon a receptionner');
SELECT public.marquer_notifications_lues(NULL);
SELECT is((SELECT count(*)::int FROM public.notifications WHERE reference_id = (SELECT id FROM bc) AND NOT read), 0, 'notification marquee lue');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
