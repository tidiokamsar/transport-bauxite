-- Tests (D-072, constats R1 : D-041 a D-047) : perimetre du registre
-- carburant et des stocks, annulation d'un transfert en bloc, annulation
-- rejetee, fiche carburant bornee, oracles retires, fermetures de site
-- (migration 20261120100000). Tout est annule.
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
  ('00000000-0000-4000-c520-000000000001', 'saisie.d072@exemple.invalid'),
  ('00000000-0000-4000-c520-000000000002', 'controle.d072@exemple.invalid'),
  ('00000000-0000-4000-c520-000000000003', 'admin.sitea.d072@exemple.invalid'),
  ('00000000-0000-4000-c520-000000000004', 'cm.siteb.d072@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-c520-0000000000a1', 'Site A D-072', 'mine'),
  ('00000000-0000-4000-c520-0000000000a2', 'Site B D-072', 'depot');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-c520-000000000001', 'contract_manager', 'Saisie D-072', 'active', NULL),
  ('00000000-0000-4000-c520-000000000002', 'contract_manager', 'Controle D-072', 'active', NULL),
  ('00000000-0000-4000-c520-000000000003', 'admin', 'Admin site A D-072', 'active', '00000000-0000-4000-c520-0000000000a1'),
  ('00000000-0000-4000-c520-000000000004', 'contract_manager', 'CM site B D-072', 'active', '00000000-0000-4000-c520-0000000000a2')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
-- Utilisateur 4 : aucun droit sur les stocks, ecriture carburant et parametres.
INSERT INTO public.droits_utilisateur (utilisateur, module, niveau) VALUES
  ('00000000-0000-4000-c520-000000000004', 'stock', 'aucun'),
  ('00000000-0000-4000-c520-000000000004', 'fuel', 'ecriture'),
  ('00000000-0000-4000-c520-000000000004', 'settings', 'ecriture')
ON CONFLICT (utilisateur, module) DO UPDATE SET niveau = EXCLUDED.niveau;
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status, site_id) VALUES
  ('00000000-0000-4000-c520-0000000000b1', 'TEST-D072-A1', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-c520-0000000000a1');
DELETE FROM public.settings WHERE key = 'carburant_validation_separee';
INSERT INTO public.stockages_carburant (id, code, libelle, type, site_id, capacite_litres) VALUES
  ('00000000-0000-4000-c520-0000000000c1', 'TEST-D072-CUVE-A', 'Cuve A', 'cuve_fixe', '00000000-0000-4000-c520-0000000000a1', 30000),
  ('00000000-0000-4000-c520-0000000000c2', 'TEST-D072-CIT-A', 'Citerne A', 'citerne_mobile', '00000000-0000-4000-c520-0000000000a1', 5000),
  ('00000000-0000-4000-c520-0000000000c3', 'TEST-D072-CUVE-B', 'Cuve B', 'cuve_fixe', '00000000-0000-4000-c520-0000000000a2', 30000);

-- R1-4 : un administrateur affecte au site A ne lit pas le registre du site B
SELECT pg_temp.se_connecter('00000000-0000-4000-c520-000000000003');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.stockages_carburant WHERE id = '00000000-0000-4000-c520-0000000000c3'), 0,
  'R1-4 administrateur du site A : stockage du site B invisible');
SELECT is((SELECT count(*)::int FROM public.v_stocks_carburant WHERE id = '00000000-0000-4000-c520-0000000000c3'), 0,
  'R1-4 administrateur du site A : situation du stockage du site B invisible');
SELECT is((SELECT count(*)::int FROM public.stockages_carburant WHERE site_id = '00000000-0000-4000-c520-0000000000a1'), 2,
  'R1-4 administrateur du site A : stockages de son site visibles');
RESET ROLE;

-- Ouverture des deux stockages du site A (1000 L et 0 L)
SELECT pg_temp.se_connecter('00000000-0000-4000-c520-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE inv AS
  SELECT public.saisir_inventaire_carburant('00000000-0000-4000-c520-0000000000c1', now() - interval '5 hours', 1000, 'jauge') AS id
  UNION ALL
  SELECT public.saisir_inventaire_carburant('00000000-0000-4000-c520-0000000000c2', now() - interval '5 hours', 0, 'jauge');
GRANT SELECT ON inv TO authenticated;
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-c520-000000000002');
SET LOCAL ROLE authenticated;
SELECT public.decider_inventaire_carburant(id, true) FROM inv;
RESET ROLE;

-- R1-1 : l'annulation d'un transfert se decide en bloc
SELECT pg_temp.se_connecter('00000000-0000-4000-c520-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE tr AS SELECT public.transferer_carburant('00000000-0000-4000-c520-0000000000c1',
  '00000000-0000-4000-c520-0000000000c2', 300, now() - interval '4 hours', 'BT-D072') AS id;
GRANT SELECT ON tr TO authenticated;
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-c520-000000000002');
SET LOCAL ROLE authenticated;
SELECT public.decider_mouvement_carburant((SELECT id FROM public.mouvements_carburant
  WHERE transfert_id = (SELECT id FROM tr) AND type = 'transfert_sortie'), true);
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-c520-000000000001');
SET LOCAL ROLE authenticated;
SELECT is(public.annuler_mouvement_carburant((SELECT id FROM public.mouvements_carburant
  WHERE transfert_id = (SELECT id FROM tr) AND type = 'transfert_sortie'), 'Transfert saisi par erreur'), 2,
  'R1-1 annulation d''un transfert : deux contre-mouvements');
RESET ROLE;
SELECT is((SELECT count(DISTINCT a.transfert_id)::int FROM public.mouvements_carburant a
             JOIN public.mouvements_carburant o ON o.id = a.annule_mouvement_id
            WHERE o.transfert_id = (SELECT id FROM tr) AND a.transfert_id IS NOT NULL), 1,
  'R1-1 les contre-mouvements partagent un lot commun');
SELECT pg_temp.se_connecter('00000000-0000-4000-c520-000000000002');
SET LOCAL ROLE authenticated;
SELECT is(public.decider_mouvement_carburant((SELECT a.id FROM public.mouvements_carburant a
  JOIN public.mouvements_carburant o ON o.id = a.annule_mouvement_id
  WHERE o.transfert_id = (SELECT id FROM tr) AND o.type = 'transfert_entree'), true), 2,
  'R1-1 une decision sur un contre-mouvement decide les deux');
SELECT is((SELECT sum(solde_litres) FROM public.v_stocks_carburant
  WHERE id IN ('00000000-0000-4000-c520-0000000000c1', '00000000-0000-4000-c520-0000000000c2')), 1000::numeric,
  'R1-1 total des deux stockages conserve (1000 L)');
SELECT is((SELECT solde_litres FROM public.v_stocks_carburant WHERE id = '00000000-0000-4000-c520-0000000000c2'), 0::numeric,
  'R1-1 citerne revenue a 0 L : aucune jambe isolee');
RESET ROLE;

-- R1-2 : une annulation rejetee laisse le mouvement annulable
SELECT pg_temp.se_connecter('00000000-0000-4000-c520-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE liv AS SELECT public.enregistrer_livraison_cbg('TEST-D072-LIV-1', current_date,
  '00000000-0000-4000-c520-0000000000a1', 500, 12000) AS id;
GRANT SELECT ON liv TO authenticated;
CREATE TEMP TABLE rec AS SELECT public.receptionner_livraison_cbg((SELECT id FROM liv),
  '00000000-0000-4000-c520-0000000000c1', now() - interval '3 hours', 500, 500, 'jauge') AS id;
GRANT SELECT ON rec TO authenticated;
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-c520-000000000002');
SET LOCAL ROLE authenticated;
SELECT public.decider_mouvement_carburant((SELECT id FROM public.mouvements_carburant WHERE reception_id = (SELECT id FROM rec)), true);
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-c520-000000000001');
SET LOCAL ROLE authenticated;
SELECT public.annuler_mouvement_carburant((SELECT id FROM public.mouvements_carburant WHERE reception_id = (SELECT id FROM rec)), 'Doute sur la reception');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-c520-000000000002');
SET LOCAL ROLE authenticated;
SELECT public.decider_mouvement_carburant((SELECT a.id FROM public.mouvements_carburant a
  JOIN public.mouvements_carburant o ON o.id = a.annule_mouvement_id WHERE o.reception_id = (SELECT id FROM rec)),
  false, 'Reception confirmee');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-c520-000000000001');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.annuler_mouvement_carburant((SELECT id FROM public.mouvements_carburant
  WHERE reception_id = (SELECT id FROM rec)), 'Erreur averee finalement')$$,
  'R1-2 apres rejet d''une annulation, le mouvement reste annulable');
SELECT throws_ok($$SELECT public.annuler_mouvement_carburant((SELECT id FROM public.mouvements_carburant
  WHERE reception_id = (SELECT id FROM rec)), 'Deuxieme annulation')$$, '22023', NULL,
  'R1-2 une annulation en attente bloque toujours une seconde annulation');
RESET ROLE;

-- R1-3 : fiche carburant bornee au site de la fiche et a l'engin de chaque ligne
SELECT pg_temp.se_connecter('00000000-0000-4000-c520-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE fiche_a AS SELECT public.preparer_fiche('carburant', DATE '2001-03-01', '00000000-0000-4000-c520-0000000000a1') AS id;
GRANT SELECT ON fiche_a TO authenticated;
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-c520-000000000004');
SET LOCAL ROLE authenticated;
SELECT throws_like($$SELECT public.saisir_carburant((SELECT id FROM fiche_a), NULL, 'CBG',
  '[{"vehicle_id": "00000000-0000-4000-c520-0000000000b1", "litres": 100}]'::jsonb)$$, '%perimetre%',
  'R1-3 compte du site B : pleins sur une fiche du site A refuses');
CREATE TEMP TABLE fiche_b AS SELECT public.preparer_fiche('carburant', DATE '2001-03-02', '00000000-0000-4000-c520-0000000000a2') AS id;
SELECT throws_like($$SELECT public.saisir_carburant((SELECT id FROM fiche_b), NULL, 'CBG',
  '[{"vehicle_id": "00000000-0000-4000-c520-0000000000b1", "litres": 100}]'::jsonb)$$, '%perimetre%',
  'R1-3 compte du site B : plein sur un engin du site A refuse');
RESET ROLE;

-- R1-5, R1-6 : stocks lus dans le perimetre du depot ; stock_disponible retiree
SELECT pg_temp.se_connecter(NULL);
INSERT INTO public.warehouses (id, name, code, warehouse_type, site_id) VALUES
  ('00000000-0000-4000-c520-0000000000d1', 'Magasin A D-072', 'TEST-D072-MAG-A', 'main', '00000000-0000-4000-c520-0000000000a1'),
  ('00000000-0000-4000-c520-0000000000d2', 'Magasin B D-072', 'TEST-D072-MAG-B', 'main', '00000000-0000-4000-c520-0000000000a2');
INSERT INTO public.stock_items (id, item_code, name, unit_of_measure) VALUES
  ('00000000-0000-4000-c520-0000000000e1', 'TEST-D072-ART', 'Article D-072', 'piece');
INSERT INTO public.stock_movements (movement_date, movement_type, stock_item_id, quantity, to_warehouse_id) VALUES
  (now() - interval '1 day', 'entry', '00000000-0000-4000-c520-0000000000e1', 20, '00000000-0000-4000-c520-0000000000d1'),
  (now() - interval '1 day', 'entry', '00000000-0000-4000-c520-0000000000e1', 7, '00000000-0000-4000-c520-0000000000d2');
SELECT is(has_function_privilege('authenticated', 'public.stock_disponible(uuid, uuid)', 'EXECUTE'), false,
  'R1-6 stock_disponible non executable par les comptes');
SELECT pg_temp.se_connecter('00000000-0000-4000-c520-000000000003');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.warehouses WHERE id = '00000000-0000-4000-c520-0000000000d2'), 0,
  'R1-5 administrateur du site A : depot du site B invisible');
SELECT is((SELECT string_agg(d.quantite::text, ',') FROM public.v_stock_depots d WHERE d.stock_item_id = '00000000-0000-4000-c520-0000000000e1'), '20',
  'R1-5 administrateur du site A : seul le stock de son depot est lu');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-c520-000000000004');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.stock_movements WHERE stock_item_id = '00000000-0000-4000-c520-0000000000e1'), 0,
  'R1-5 sans droit stock : aucun mouvement lu, meme de son site');
RESET ROLE;

-- R1-7 : site_ferme_le retiree aux comptes
SELECT is(has_function_privilege('authenticated', 'public.site_ferme_le(uuid, date)', 'EXECUTE'), false,
  'R1-7 site_ferme_le non executable par les comptes');

-- R1-8 : levee datee entre le debut de la fermeture et maintenant
SELECT pg_temp.se_connecter(NULL);
INSERT INTO public.fermetures_site (id, site_id, debut, motif) VALUES
  ('00000000-0000-4000-c520-0000000000f1', '00000000-0000-4000-c520-0000000000a1', now() - interval '2 days', 'Motif interne site A');
SELECT pg_temp.se_connecter('00000000-0000-4000-c520-000000000003');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$UPDATE public.fermetures_site SET levee_le = now() - interval '30 days', motif_levee = 'Retroactif'
  WHERE id = '00000000-0000-4000-c520-0000000000f1'$$, '22023', NULL,
  'R1-8 levee datee avant le debut de la fermeture refusee');
SELECT throws_ok($$UPDATE public.fermetures_site SET levee_le = now() + interval '3 days', motif_levee = 'Anticipee'
  WHERE id = '00000000-0000-4000-c520-0000000000f1'$$, '22023', NULL,
  'R1-8 levee datee dans le futur refusee');
SELECT lives_ok($$UPDATE public.fermetures_site SET levee_le = now() - interval '1 hour', motif_levee = 'Reouverture'
  WHERE id = '00000000-0000-4000-c520-0000000000f1'$$, 'R1-8 levee entre le debut et maintenant acceptee');
RESET ROLE;

-- R1-9 : fermeture rattachee a l'infrastructure d'un autre site
SELECT pg_temp.se_connecter(NULL);
INSERT INTO public.infrastructures_site (id, site_id, type, code, libelle) VALUES
  ('00000000-0000-4000-c520-0000000000f2', '00000000-0000-4000-c520-0000000000a1', 'pont_bascule', 'TEST-D072-PB-A', 'Pont A');
SELECT pg_temp.se_connecter('00000000-0000-4000-c520-000000000004');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$INSERT INTO public.fermetures_site (site_id, infrastructure_id, debut, motif) VALUES
  ('00000000-0000-4000-c520-0000000000a2', '00000000-0000-4000-c520-0000000000f2', now(), 'Pont A ferme par le site B')$$,
  '23503', NULL, 'R1-9 fermeture d''une infrastructure d''un autre site refusee');
RESET ROLE;

-- R1-10 : suppressions retirees ; R1-12, R1-13 : verrous
SELECT is(has_table_privilege('authenticated', 'public.factures_fournisseur', 'DELETE'), false,
  'R1-10 factures fournisseur : DELETE retire');
SELECT is(has_table_privilege('authenticated', 'public.stock_categories', 'DELETE'), false,
  'R1-10 categories de stock : DELETE retire');
SELECT ok(pg_get_functiondef('public.stockage_ecrivable(uuid)'::regprocedure) ~ 'FOR UPDATE',
  'R1-12 stockage_ecrivable verrouille le stockage');
SELECT ok(pg_get_functiondef('public.saisir_releve_compteur(uuid, uuid, text, numeric, timestamptz, text, text)'::regprocedure) ~ 'FOR NO KEY UPDATE'
          AND pg_get_functiondef('public.corriger_releve_compteur(uuid, numeric, text)'::regprocedure) ~ 'FOR NO KEY UPDATE',
  'R1-13 saisie et correction de releve verrouillent l''engin');

SELECT * FROM finish();
ROLLBACK;
