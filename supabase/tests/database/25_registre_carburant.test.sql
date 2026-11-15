-- Tests (D-041) : registre des mouvements de carburant (migration
-- 20261115090000). Stock calcule depuis les mouvements valides, ouverture
-- par inventaire, reception d'une livraison CBG, transfert, distribution par
-- fiche, annulation par contre-mouvement, separation saisie / validation,
-- perimetre site. Tout est annule.
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

SELECT plan(25);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-9700-000000000001', 'carburant.a@exemple.invalid'),
  ('00000000-0000-4000-9700-000000000002', 'carburant.b@exemple.invalid'),
  ('00000000-0000-4000-9700-000000000003', 'chauffeur.carb@exemple.invalid'),
  ('00000000-0000-4000-9700-000000000004', 'autre.site.carb@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-9700-0000000000a1', 'Mine carburant test', 'mine'),
  ('00000000-0000-4000-9700-0000000000a2', 'Autre site carburant', 'depot');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-9700-000000000001', 'contract_manager', 'Saisie A', 'active', NULL),
  ('00000000-0000-4000-9700-000000000002', 'contract_manager', 'Controle B', 'active', NULL),
  ('00000000-0000-4000-9700-000000000003', 'maintenance_chief', 'Chef maintenance', 'active', NULL),
  ('00000000-0000-4000-9700-000000000004', 'admin', 'Admin autre site', 'active', '00000000-0000-4000-9700-0000000000a2')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status, site_id) VALUES
  ('00000000-0000-4000-9700-0000000000b1', 'TEST-CARB-1', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-9700-0000000000a1');
DELETE FROM public.settings WHERE key = 'carburant_validation_separee';

-- A : referentiel et ouverture
SELECT pg_temp.se_connecter('00000000-0000-4000-9700-000000000001');
SET LOCAL ROLE authenticated;
INSERT INTO public.stockages_carburant (id, code, libelle, type, site_id, capacite_litres, cree_par) VALUES
  ('00000000-0000-4000-9700-0000000000c1', 'TEST-CUVE', 'Cuve test', 'cuve_fixe', '00000000-0000-4000-9700-0000000000a1', 30000, '00000000-0000-4000-9700-000000000001'),
  ('00000000-0000-4000-9700-0000000000c2', 'TEST-CIT', 'Citerne test', 'citerne_mobile', '00000000-0000-4000-9700-0000000000a1', 5000, '00000000-0000-4000-9700-000000000001');
SELECT is((SELECT solde_litres FROM public.v_stocks_carburant WHERE code = 'TEST-CUVE'), NULL::numeric,
  'sans inventaire : solde sans donnees');
CREATE TEMP TABLE inv1 AS SELECT public.saisir_inventaire_carburant('00000000-0000-4000-9700-0000000000c1', now() - interval '3 hours', 1000, 'jauge') AS id;
GRANT SELECT ON inv1 TO authenticated;
SELECT throws_ok($$SELECT public.decider_inventaire_carburant((SELECT id FROM inv1), true)$$, '42501', NULL,
  'l''auteur de la saisie ne valide pas son inventaire');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-9700-000000000002');
SET LOCAL ROLE authenticated;
SELECT is(public.decider_inventaire_carburant((SELECT id FROM inv1), true), 'valide', 'inventaire d''ouverture valide par un tiers');
SELECT is((SELECT solde_litres FROM public.v_stocks_carburant WHERE code = 'TEST-CUVE'), 1000::numeric, 'stock ouvert a 1000 L');
RESET ROLE;

-- A : livraison CBG puis reception
SELECT pg_temp.se_connecter('00000000-0000-4000-9700-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE liv AS SELECT public.enregistrer_livraison_cbg('TEST-LIV-REG-1', current_date, '00000000-0000-4000-9700-0000000000a1', 5000, 12000) AS id;
GRANT SELECT ON liv TO authenticated;
SELECT throws_ok($$SELECT public.receptionner_livraison_cbg((SELECT id FROM liv), '00000000-0000-4000-9700-0000000000c1', now() - interval '2 hours', 4950, 4950, 'jauge')$$,
  '22023', NULL, 'ecart avec le document CBG sans motif refuse');
SELECT lives_ok($$SELECT public.receptionner_livraison_cbg((SELECT id FROM liv), '00000000-0000-4000-9700-0000000000c1', now() - interval '2 hours', 4950, 4950, 'jauge', 'Jauge a l''arrivee : 50 L manquants')$$,
  'reception motivee enregistree');
SELECT is((SELECT (solde_litres, en_attente_litres)::text FROM public.v_stocks_carburant WHERE code = 'TEST-CUVE'), '(1000,4950)',
  'reception en attente : solde inchange');
SELECT throws_ok($$UPDATE public.mouvements_carburant SET variation = 9999 WHERE stockage_id = '00000000-0000-4000-9700-0000000000c1'$$,
  '42501', NULL, 'mouvement non modifiable depuis le navigateur');
SELECT throws_ok($$DELETE FROM public.mouvements_carburant WHERE stockage_id = '00000000-0000-4000-9700-0000000000c1'$$,
  '42501', NULL, 'mouvement non supprimable');
SELECT throws_ok($$UPDATE public.fuel_stocks SET current_stock = 1$$, '42501', NULL, 'ancien solde saisi en lecture seule');
SELECT throws_ok($$SELECT public.transferer_carburant('00000000-0000-4000-9700-0000000000c1', '00000000-0000-4000-9700-0000000000c2', 2000, now() + interval '1 day')$$,
  '22023', NULL, 'transfert date dans le futur refuse');
CREATE TEMP TABLE tr0 AS SELECT public.transferer_carburant('00000000-0000-4000-9700-0000000000c1', '00000000-0000-4000-9700-0000000000c2', 2000, now() - interval '100 minutes', 'BT-000') AS id;
GRANT SELECT ON tr0 TO authenticated;
RESET ROLE;

-- B : decisions
SELECT pg_temp.se_connecter('00000000-0000-4000-9700-000000000002');
SET LOCAL ROLE authenticated;
SELECT is(public.decider_mouvement_carburant((SELECT id FROM public.mouvements_carburant WHERE type = 'reception' AND stockage_id = '00000000-0000-4000-9700-0000000000c1'), true),
  1, 'reception validee');
SELECT throws_ok($$SELECT public.decider_mouvement_carburant((SELECT id FROM public.mouvements_carburant WHERE transfert_id = (SELECT id FROM tr0) LIMIT 1), true)$$,
  '22023', NULL, 'citerne non ouverte : transfert non validable');
SELECT is(public.decider_mouvement_carburant((SELECT id FROM public.mouvements_carburant WHERE transfert_id = (SELECT id FROM tr0) LIMIT 1), false, 'Citerne a ouvrir d''abord'),
  2, 'transfert rejete en bloc avec motif');
CREATE TEMP TABLE inv2 AS SELECT public.saisir_inventaire_carburant('00000000-0000-4000-9700-0000000000c2', now() - interval '90 minutes', 0, 'pige') AS id;
GRANT SELECT ON inv2 TO authenticated;
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-9700-000000000001');
SET LOCAL ROLE authenticated;
SELECT is(public.decider_inventaire_carburant((SELECT id FROM inv2), true), 'valide', 'citerne ouverte vide');
CREATE TEMP TABLE tr AS SELECT public.transferer_carburant('00000000-0000-4000-9700-0000000000c1', '00000000-0000-4000-9700-0000000000c2', 2000, now() - interval '1 hour', 'BT-001') AS id;
GRANT SELECT ON tr TO authenticated;
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-9700-000000000002');
SET LOCAL ROLE authenticated;
SELECT is(public.decider_mouvement_carburant((SELECT id FROM public.mouvements_carburant WHERE transfert_id = (SELECT id FROM tr) LIMIT 1), true),
  2, 'transfert valide en bloc (sortie et entree)');
SELECT is((SELECT string_agg(code || '=' || solde_litres, ',' ORDER BY code) FROM public.v_stocks_carburant WHERE code LIKE 'TEST-%'),
  'TEST-CIT=2000,TEST-CUVE=3950', 'soldes apres reception et transfert');
RESET ROLE;

-- A : distribution par fiche carburant depuis la citerne, puis annulation
SELECT pg_temp.se_connecter('00000000-0000-4000-9700-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE fc AS SELECT public.preparer_fiche('carburant', current_date, '00000000-0000-4000-9700-0000000000a1') AS id;
GRANT SELECT ON fc TO authenticated;
SELECT is(public.saisir_carburant((SELECT id FROM fc), NULL, 'CBG',
  '[{"vehicle_id":"00000000-0000-4000-9700-0000000000b1","litres":300,"stockage_id":"00000000-0000-4000-9700-0000000000c2"}]'::jsonb),
  1, 'plein saisi depuis la citerne');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-9700-000000000002');
SET LOCAL ROLE authenticated;
SELECT is(public.decider_mouvement_carburant((SELECT id FROM public.mouvements_carburant WHERE type = 'distribution' AND stockage_id = '00000000-0000-4000-9700-0000000000c2'), true),
  1, 'distribution validee');
SELECT throws_ok($$SELECT public.decider_mouvement_carburant((SELECT id FROM public.mouvements_carburant WHERE type = 'distribution' AND stockage_id = '00000000-0000-4000-9700-0000000000c2'), false)$$,
  '22023', NULL, 'mouvement deja decide');
SELECT is(public.annuler_mouvement_carburant((SELECT id FROM public.mouvements_carburant WHERE type = 'distribution' AND stockage_id = '00000000-0000-4000-9700-0000000000c2'), 'Plein saisi sur le mauvais engin'),
  1, 'annulation : contre-mouvement cree');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-9700-000000000001');
SET LOCAL ROLE authenticated;
SELECT is(public.decider_mouvement_carburant((SELECT id FROM public.mouvements_carburant WHERE type = 'annulation' AND stockage_id = '00000000-0000-4000-9700-0000000000c2'), true),
  1, 'annulation validee par un tiers');
SELECT is((SELECT solde_litres FROM public.v_stocks_carburant WHERE code = 'TEST-CIT'), 2000::numeric, 'citerne revenue a 2000 L');
RESET ROLE;

-- Chef maintenance et compte d'un autre site
SELECT pg_temp.se_connecter('00000000-0000-4000-9700-000000000003');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.mouvements_carburant), 0, 'un chef maintenance (sans droit carburant) ne lit pas le registre');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-9700-000000000004');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.saisir_inventaire_carburant('00000000-0000-4000-9700-0000000000c1', now(), 10, 'jauge')$$,
  '42501', NULL, 'compte d''un autre site : ecriture refusee');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
