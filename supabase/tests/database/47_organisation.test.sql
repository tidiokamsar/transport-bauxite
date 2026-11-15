-- Tests (D-064) : affectations multisites et site_permis, delegations
-- temporaires et has_module_*, journal de connexion, referentiels devises et
-- unites, sequences de numerotation (migration 20261119120000).
-- Tout est annule en fin de transaction.
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

SELECT plan(70);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-b640-000000000001', 'admin.d064@exemple.invalid'),
  ('00000000-0000-4000-b640-000000000002', 'flotte-f.d064@exemple.invalid'),
  ('00000000-0000-4000-b640-000000000003', 'flotte-g.d064@exemple.invalid'),
  ('00000000-0000-4000-b640-000000000004', 'flotte-h.d064@exemple.invalid'),
  ('00000000-0000-4000-b640-000000000005', 'dispatch-x.d064@exemple.invalid'),
  ('00000000-0000-4000-b640-000000000006', 'chauffeur-y.d064@exemple.invalid'),
  ('00000000-0000-4000-b640-000000000007', 'chauffeur-z.d064@exemple.invalid'),
  ('00000000-0000-4000-b640-000000000008', 'logistique-1.d064@exemple.invalid'),
  ('00000000-0000-4000-b640-000000000009', 'logistique-2.d064@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-b640-0000000000a1', 'Site 1 D-064', 'mine'),
  ('00000000-0000-4000-b640-0000000000a2', 'Site 2 D-064', 'depot');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-b640-000000000001', 'admin', 'Admin D-064', 'active', NULL),
  ('00000000-0000-4000-b640-000000000002', 'fleet_manager', 'Flotte F D-064', 'active', NULL),
  ('00000000-0000-4000-b640-000000000003', 'fleet_manager', 'Flotte G D-064', 'active', NULL),
  ('00000000-0000-4000-b640-000000000004', 'fleet_manager', 'Flotte H D-064', 'active', '00000000-0000-4000-b640-0000000000a1'),
  ('00000000-0000-4000-b640-000000000005', 'dispatcher', 'Dispatch X D-064', 'active', NULL),
  ('00000000-0000-4000-b640-000000000006', 'driver', 'Chauffeur Y D-064', 'active', NULL),
  ('00000000-0000-4000-b640-000000000007', 'driver', 'Chauffeur Z D-064', 'active', NULL),
  ('00000000-0000-4000-b640-000000000008', 'logistician', 'Logistique 1 D-064', 'active', NULL),
  ('00000000-0000-4000-b640-000000000009', 'logistician', 'Logistique 2 D-064', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name, status = EXCLUDED.status,
  site_id = EXCLUDED.site_id;
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, site_id) VALUES
  ('00000000-0000-4000-b640-0000000000b1', 'TEST-D064-1', 'Test', 40, 'tipper', '00000000-0000-4000-b640-0000000000a1'),
  ('00000000-0000-4000-b640-0000000000b2', 'TEST-D064-2', 'Test', 40, 'tipper', '00000000-0000-4000-b640-0000000000a2');

-- 1. Affectations multisites ----------------------------------------------

-- Sans affectation : global, comme avant (D-038).
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000002');
SET LOCAL ROLE authenticated;
SELECT ok(public.site_permis('00000000-0000-4000-b640-0000000000a1') AND public.site_permis('00000000-0000-4000-b640-0000000000a2')
          AND public.site_permis(NULL), 'sans affectation : compte global');
SELECT throws_ok($$SELECT public.affecter_site('00000000-0000-4000-b640-000000000002',
  '00000000-0000-4000-b640-0000000000a1', current_date)$$, '42501', NULL, 'un non-administrateur n''affecte pas');
SELECT throws_ok($$INSERT INTO public.affectations_sites (utilisateur, site_id, debut)
  VALUES ('00000000-0000-4000-b640-000000000002', '00000000-0000-4000-b640-0000000000a1', current_date)$$,
  '42501', NULL, 'ecriture directe des affectations refusee');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE aff_f1 AS SELECT public.affecter_site('00000000-0000-4000-b640-000000000002',
  '00000000-0000-4000-b640-0000000000a1', current_date - 30, NULL, 'Affectation principale') AS id;
SELECT ok((SELECT id FROM aff_f1) IS NOT NULL, 'l''administrateur affecte un compte a un site');
SELECT throws_ok($$SELECT public.affecter_site('00000000-0000-4000-b640-000000000002',
  '00000000-0000-4000-b640-0000000000a1', current_date, current_date + 10)$$,
  '22023', NULL, 'chevauchement d''affectations au meme site refuse');
SELECT throws_ok($$SELECT public.affecter_site('00000000-0000-4000-b640-000000000002',
  '00000000-0000-4000-b640-0000000000a2', current_date, current_date - 1)$$,
  '22023', NULL, 'fin anterieure au debut refusee');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000002');
SET LOCAL ROLE authenticated;
SELECT is(public.site_permis('00000000-0000-4000-b640-0000000000a1'), true, 'affecte au site 1 : site 1 permis');
SELECT is(public.site_permis('00000000-0000-4000-b640-0000000000a2'), false, 'affecte au site 1 : site 2 refuse');
SELECT is(public.site_permis(NULL), false, 'affecte : une ligne sans site n''est plus visible');
SELECT is((SELECT count(*)::int FROM public.vehicles WHERE registration LIKE 'TEST-D064-%'), 1,
  'la politique des vehicules suit l''affectation (un seul site)');
RESET ROLE;

-- Second site : multisite.
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE aff_f2 AS SELECT public.affecter_site('00000000-0000-4000-b640-000000000002',
  '00000000-0000-4000-b640-0000000000a2', current_date - 5, NULL, 'Renfort') AS id;
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000002');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.vehicles WHERE registration LIKE 'TEST-D064-%'), 2,
  'multisite : les vehicules des deux sites sont visibles');
SELECT is((SELECT count(*)::int FROM public.v_affectations_sites WHERE utilisateur = '00000000-0000-4000-b640-000000000002'
  AND statut = 'en_cours'), 2, 'le compte lit ses deux affectations en cours');
RESET ROLE;

-- Cloture : le site 2 est retire a partir d'hier.
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.cloturer_affectation_site((SELECT id FROM aff_f2), current_date - 1, 'Fin du renfort')$$,
  'cloture d''une affectation');
SELECT throws_ok($$SELECT public.cloturer_affectation_site((SELECT id FROM aff_f2), current_date - 10)$$,
  '22023', NULL, 'une fin anterieure au debut est refusee a la cloture');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000002');
SET LOCAL ROLE authenticated;
SELECT is(public.site_permis('00000000-0000-4000-b640-0000000000a2'), false, 'affectation terminee : site 2 refuse');
SELECT is(public.site_permis('00000000-0000-4000-b640-0000000000a1'), true, 'l''autre affectation reste en vigueur');
RESET ROLE;

-- Affectation expiree seule : le compte ne redevient pas global.
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE aff_g AS SELECT public.affecter_site('00000000-0000-4000-b640-000000000003',
  '00000000-0000-4000-b640-0000000000a1', current_date - 10, current_date - 1, 'Mission terminee') AS id;
SELECT lives_ok($$SELECT public.affecter_site('00000000-0000-4000-b640-000000000003',
  '00000000-0000-4000-b640-0000000000a2', current_date + 3, NULL, 'Mutation prevue')$$, 'affectation a venir');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000003');
SET LOCAL ROLE authenticated;
SELECT is(public.site_permis('00000000-0000-4000-b640-0000000000a1'), false, 'affectation expiree : site refuse');
SELECT is(public.site_permis('00000000-0000-4000-b640-0000000000a2'), false, 'affectation a venir : pas encore permise');
SELECT is(public.site_permis(NULL), false, 'affectation expiree : le compte ne redevient pas global');
SELECT is((SELECT count(*)::int FROM public.vehicles WHERE registration LIKE 'TEST-D064-%'), 0,
  'affectation expiree : aucun vehicule visible');
RESET ROLE;

-- Annulation (erreur de saisie) : l'affectation est reputee n'avoir jamais existe.
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.annuler_affectation_site((SELECT id FROM aff_g), '  ')$$,
  '22023', NULL, 'annulation sans motif refusee');
SELECT lives_ok($$SELECT public.annuler_affectation_site(id, 'Erreur de saisie') FROM public.affectations_sites
  WHERE utilisateur = '00000000-0000-4000-b640-000000000003'$$, 'annulation motivee des affectations');
SELECT throws_ok($$SELECT public.cloturer_affectation_site((SELECT id FROM aff_g), current_date)$$,
  '22023', NULL, 'une affectation annulee ne se modifie plus');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000003');
SET LOCAL ROLE authenticated;
SELECT is(public.site_permis('00000000-0000-4000-b640-0000000000a2'), true,
  'toutes les affectations annulees : retour au perimetre global');
RESET ROLE;

-- Compatibilite profiles.site_id : le site du profil s'ajoute aux affectations.
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000004');
SET LOCAL ROLE authenticated;
SELECT ok(public.site_permis('00000000-0000-4000-b640-0000000000a1') AND NOT public.site_permis('00000000-0000-4000-b640-0000000000a2'),
  'site du profil seul : comportement D-038 inchange');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
SELECT public.affecter_site('00000000-0000-4000-b640-000000000004', '00000000-0000-4000-b640-0000000000a2', current_date, current_date);
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000004');
SET LOCAL ROLE authenticated;
SELECT ok(public.site_permis('00000000-0000-4000-b640-0000000000a1') AND public.site_permis('00000000-0000-4000-b640-0000000000a2'),
  'site du profil et affectation du jour (fin incluse) : deux sites');
RESET ROLE;

-- Journal et gardes.
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.journal_affectations_sites WHERE utilisateur IN (
  '00000000-0000-4000-b640-000000000002', '00000000-0000-4000-b640-000000000003', '00000000-0000-4000-b640-000000000004')), 8,
  'journal : 5 creations, 1 cloture, 2 annulations');
SELECT is((SELECT count(*)::int FROM public.journal_affectations_sites WHERE affectation_id = (SELECT id FROM aff_f2)
  AND evenement = 'cloture' AND (avant ->> 'fin') IS NULL AND (apres ->> 'fin')::date = current_date - 1), 1,
  'journal : la cloture garde la fin avant et apres');
SELECT throws_ok($$UPDATE public.journal_affectations_sites SET motif = 'x'$$, '42501', NULL,
  'journal des affectations non modifiable');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000002');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.journal_affectations_sites), 0, 'un non-administrateur ne lit pas le journal');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SELECT throws_ok($$DELETE FROM public.affectations_sites WHERE id = (SELECT id FROM aff_f1)$$, '42501', NULL,
  'une affectation ne se supprime pas, meme hors navigateur');

-- 2. Delegations temporaires ----------------------------------------------

SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000006');
SET LOCAL ROLE authenticated;
SELECT ok(NOT public.has_module_write('trips') AND NOT public.has_module_view('trips'),
  'etat initial : le chauffeur ne lit ni n''ecrit les voyages');
SELECT throws_ok($$SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000007', 'trips', 'ecriture',
  now(), now() + interval '1 day', 'Conges')$$, '42501', NULL, 'deleguer un droit qu''on n''a pas : refuse');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000005');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000005', 'trips', 'ecriture',
  now(), now() + interval '1 day', 'Conges')$$, '22023', NULL, 'deleguer a soi-meme : refuse');
SELECT throws_ok($$SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000006', 'settings', 'ecriture',
  now(), now() + interval '1 day', 'Conges')$$, '22023', NULL, 'l''administration ne se delegue pas');
SELECT throws_ok($$SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000006', 'trips', 'admin',
  now(), now() + interval '1 day', 'Conges')$$, '22023', NULL, 'niveau administrateur : refuse');
SELECT throws_ok($$SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000006', 'trips', 'ecriture',
  now(), now() + interval '1 day', '')$$, '22023', NULL, 'delegation sans motif : refusee');
SELECT throws_ok($$SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000006', 'trips', 'ecriture',
  now() - interval '2 days', now() - interval '1 day', 'Conges')$$, '22023', NULL, 'periode deja passee : refusee');
CREATE TEMP TABLE dlg AS SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000006', 'trips', 'ecriture',
  now(), now() + interval '7 days', 'Conges du dispatcheur') AS id;
SELECT ok((SELECT id FROM dlg) IS NOT NULL, 'le dispatcheur delegue l''ecriture des voyages');
SELECT throws_ok($$SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000006', 'trips', 'ecriture',
  now(), now() + interval '2 days', 'Doublon')$$, '22023', NULL, 'delegation identique sur la meme periode : refusee');
SELECT throws_ok($$INSERT INTO public.delegations_droits (delegant, delegue, module, niveau, debut, fin, motif)
  VALUES ('00000000-0000-4000-b640-000000000005', '00000000-0000-4000-b640-000000000007', 'trips', 'ecriture',
          now(), now() + interval '1 day', 'x')$$, '42501', NULL, 'ecriture directe des delegations refusee');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000006');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_write('trips'), true, 'delegation en vigueur : le delegue ecrit les voyages');
SELECT is(public.has_module_view('trips'), true, 'delegation en vigueur : le delegue lit le module');
SELECT is(public.has_module_approve('trips'), false, 'une delegation d''ecriture ne donne pas l''approbation');
SELECT is(public.has_module_write('fuel'), false, 'la delegation est bornee a son module');
SELECT throws_ok($$SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000007', 'trips', 'ecriture',
  now(), now() + interval '1 day', 'Sous-delegation')$$, '42501', NULL, 'un droit recu par delegation ne se redelegue pas');
CREATE TEMP TABLE voyage AS SELECT public.creer_voyage(current_date, '00000000-0000-4000-b640-0000000000a1',
  '00000000-0000-4000-b640-0000000000a2') AS id;
SELECT is((SELECT auteur FROM public.trip_events WHERE trip_id = (SELECT id FROM voyage)),
  '00000000-0000-4000-b640-000000000006'::uuid, 'le delegue reste l''auteur de ses actes (journal du voyage)');
SELECT is((SELECT statut FROM public.mes_delegations() WHERE id = (SELECT id FROM dlg)), 'active',
  'le delegue voit sa delegation active');
RESET ROLE;

-- Un tiers ne revoque pas ; le delegant perd son droit : delegation sans effet.
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000007');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.revoquer_delegation((SELECT id FROM dlg), 'Abus')$$, '42501', NULL,
  'un tiers ne revoque pas la delegation');
SELECT is((SELECT count(*)::int FROM public.delegations_droits WHERE id = (SELECT id FROM dlg)), 0,
  'un tiers ne lit pas la delegation');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SELECT public.definir_droit_module('00000000-0000-4000-b640-000000000005', 'trips', 'lecture', 'test D-064');
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000006');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_write('trips'), false, 'le delegant a perdu le droit : la delegation est sans effet');
SELECT is((SELECT statut FROM public.mes_delegations() WHERE id = (SELECT id FROM dlg)), 'sans_effet',
  'statut sans_effet affiche');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SELECT public.definir_droit_module('00000000-0000-4000-b640-000000000005', 'trips', 'defaut', 'test D-064');
-- Restriction administrateur sur le delegue : la delegation ne la contourne pas.
SELECT public.definir_droit_module('00000000-0000-4000-b640-000000000006', 'trips', 'aucun', 'test D-064');
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000006');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_write('trips'), false, 'restriction administrateur (D-036) : la delegation ne la contourne pas');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000005');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000006', 'trips', 'ecriture',
  now() + interval '8 days', now() + interval '9 days', 'Autre periode')$$, '22023', NULL,
  'delegation a un compte restreint par l''administrateur : refusee');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SELECT public.definir_droit_module('00000000-0000-4000-b640-000000000006', 'trips', 'defaut', 'test D-064');

-- Revocation par le delegant.
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000005');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.revoquer_delegation((SELECT id FROM dlg), NULL)$$, '22023', NULL, 'revocation sans motif refusee');
SELECT lives_ok($$SELECT public.revoquer_delegation((SELECT id FROM dlg), 'Retour anticipe')$$, 'le delegant revoque');
SELECT throws_ok($$SELECT public.revoquer_delegation((SELECT id FROM dlg), 'Encore')$$, '22023', NULL, 'double revocation refusee');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000006');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_write('trips'), false, 'delegation revoquee : plus d''ecriture');
RESET ROLE;

-- Delegation a venir puis expiree.
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000005');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE dlg2 AS SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000007', 'trips', 'ecriture',
  now() + interval '1 day', now() + interval '2 days', 'Absence prevue') AS id;
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000007');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_write('trips'), false, 'delegation a venir : pas encore en vigueur');
RESET ROLE;
SELECT pg_temp.se_connecter(NULL);
UPDATE public.delegations_droits SET debut = now() - interval '3 days', fin = now() - interval '1 day'
 WHERE id = (SELECT id FROM dlg2);
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000007');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_write('trips'), false, 'delegation expiree : plus en vigueur');
SELECT is((SELECT statut FROM public.mes_delegations() WHERE id = (SELECT id FROM dlg2)), 'expiree', 'statut expiree affiche');
RESET ROLE;

-- Approbation deleguee : la separation des taches reste appliquee.
DELETE FROM public.settings WHERE key = 'achats_validation_separee';
INSERT INTO public.warehouses (id, name, code, warehouse_type, site_id) VALUES
  ('00000000-0000-4000-b640-0000000000d1', 'Magasin D-064', 'TEST-MAG-D064', 'main', '00000000-0000-4000-b640-0000000000a1');
INSERT INTO public.suppliers (id, supplier_number, supplier_type, company_name) VALUES
  ('00000000-0000-4000-b640-0000000000f1', 'TEST-F-D064', 'parts', 'Fournisseur D-064');
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000008');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_approve('purchases'), false, 'etat initial : la logistique n''approuve pas');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000008', 'purchases', 'approbation',
  now(), now() + interval '3 days', 'Absence du valideur');
SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000009', 'purchases', 'approbation',
  now(), now() + interval '3 days', 'Absence du valideur');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000008');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_approve('purchases'), true, 'approbation deleguee en vigueur');
CREATE TEMP TABLE bc AS SELECT public.enregistrer_bon_commande(
  p_fournisseur => '00000000-0000-4000-b640-0000000000f1', p_depot => '00000000-0000-4000-b640-0000000000d1',
  p_lignes => '[{"designation": "Prestation D-064", "quantite": 1, "prix_unitaire": 1000}]'::jsonb) AS id;
SELECT public.soumettre_bon_commande((SELECT id FROM bc));
SELECT throws_ok($$SELECT public.decider_bon_commande((SELECT id FROM bc), true)$$, '42501',
  'L''approbation revient a une autre personne que le demandeur',
  'separation des taches : le delegue n''approuve pas son propre bon');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000009');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.decider_bon_commande((SELECT id FROM bc), true)$$, 'un autre delegue approuve le bon');
RESET ROLE;
SELECT is((SELECT approved_by FROM public.purchase_orders WHERE id = (SELECT id FROM bc)),
  '00000000-0000-4000-b640-000000000009'::uuid, 'l''approbation est au nom du delegue');

-- Journal des delegations.
SELECT is((SELECT count(*)::int FROM public.journal_delegations WHERE delegue IN (
  '00000000-0000-4000-b640-000000000006', '00000000-0000-4000-b640-000000000007',
  '00000000-0000-4000-b640-000000000008', '00000000-0000-4000-b640-000000000009')), 5,
  'journal : 4 creations et 1 revocation');
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000005');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$UPDATE public.journal_delegations SET motif = 'x'$$, '42501', NULL, 'journal des delegations non modifiable');
SELECT is((SELECT count(*)::int FROM public.comptes_delegables() WHERE id = '00000000-0000-4000-b640-000000000005'), 0,
  'comptes delegables : sans soi-meme');
RESET ROLE;

-- 3. Journal de connexion et sessions -------------------------------------

INSERT INTO auth.audit_log_entries (instance_id, id, payload, created_at) VALUES
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-b640-0000000000c1',
   json_build_object('actor_id', '00000000-0000-4000-b640-000000000002', 'actor_username', 'flotte-f.d064@exemple.invalid',
                     'action', 'login', 'log_type', 'account', 'traits', json_build_object('provider', 'email')),
   now());
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT evenement || '|' || compte || '|' || nom || '|' || methode FROM public.v_journal_connexions
  WHERE id = '00000000-0000-4000-b640-0000000000c1'),
  'login|flotte-f.d064@exemple.invalid|Flotte F D-064|email', 'l''administrateur lit la connexion ecrite par GoTrue');
SELECT lives_ok($$SELECT * FROM public.sessions_ouvertes()$$, 'l''administrateur liste les sessions');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM information_schema.columns WHERE table_schema = 'public'
  AND table_name = 'v_journal_connexions' AND column_name IN ('payload', 'traits', 'token')), 0,
  'la vue n''expose ni payload brut ni jeton');
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000002');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.v_journal_connexions), 0, 'un non-administrateur ne lit pas le journal de connexion');
SELECT throws_ok($$SELECT * FROM public.sessions_ouvertes()$$, '42501', NULL, 'un non-administrateur ne liste pas les sessions');
RESET ROLE;

-- 4. Referentiels et sequences --------------------------------------------

INSERT INTO public.contrats (id, reference, intitule, nature, contrepartie, devise, date_debut) VALUES
  ('00000000-0000-4000-b640-0000000000e1', 'TEST-D064-CTR', 'Contrat D-064', 'autre', 'Test', 'ZZY', '2001-01-01');
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
SELECT ok(EXISTS (SELECT 1 FROM public.codes_utilises() WHERE type = 'devise' AND code = 'ZZY'
  AND source = 'contrats.devise' AND NOT au_referentiel), 'un code saisi hors referentiel est signale');
SELECT lives_ok($$SELECT public.enregistrer_devise('zzy', 'Devise de test')$$, 'l''administrateur enregistre une devise');
SELECT ok((SELECT au_referentiel FROM public.codes_utilises() WHERE type = 'devise' AND code = 'ZZY' AND source = 'contrats.devise'),
  'le code saisi est desormais au referentiel');
SELECT throws_ok($$SELECT public.enregistrer_devise('ZZ', NULL)$$, '22023', NULL, 'code devise invalide refuse');
SELECT ok(EXISTS (SELECT 1 FROM public.unites_mesure WHERE code = 'tonne'), 'unites de tarif reprises au referentiel');
SELECT is((SELECT count(*)::int FROM public.sequences_numerotation()
  WHERE code IN ('BC', 'REC', 'PAY', 'INC', 'OT', 'CONS', 'FRS', 'PL', 'CST', 'RAP', 'INT', 'MVT', 'VYG', 'FAC', 'AV', 'FR', 'FP', 'FC')), 18,
  'les numerotations existantes sont listees');
SELECT ok((SELECT compteur IS NOT DISTINCT FROM (SELECT last_value FROM pg_sequences WHERE schemaname = 'public'
            AND sequencename = 'purchase_orders_numero_seq') FROM public.sequences_numerotation() WHERE code = 'BC'),
  'le compteur est celui de la sequence (lecture seule)');
SELECT ok((SELECT dernier_numero ~ '^BC-[0-9]{4}-[0-9]{5}$' FROM public.sequences_numerotation() WHERE code = 'BC'),
  'le dernier numero de bon de commande est reconnu par son format');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT * FROM public.sequences_numerotation()$$, '42501', NULL, 'sequences : reserve a l''administrateur');
SELECT throws_ok($$SELECT public.enregistrer_unite('litre', 'Litre')$$, '42501', NULL, 'referentiel : ecriture reservee a l''administrateur');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
