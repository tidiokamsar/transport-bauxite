-- Tests (D-082) : derogations tranchees le 2026-11-16 (migration
-- 20261121190000). Delegation des approbations avec separation des taches
-- dans les deux sens, signature des factures toujours au seul Directeur
-- General, ticket CBG rectifie facturable sur decision d'un approbateur
-- distinct, cout TTC reprenant une piece fournisseur hors du realise
-- budgetaire. Les droits revoques se testent par has_*_privilege. Tout est annule.
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

SELECT plan(59);

-- 0. Structure et droits ----------------------------------------------------

SELECT ok(pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = 'delegations_droits_niveau_check'
                                   AND conrelid = 'public.delegations_droits'::regclass)) ~ 'approbation',
  'le niveau approbation est admis par la contrainte des delegations');
SELECT is((SELECT count(*)::int FROM unnest(ARRAY[
    'public.separation_violee(uuid, text, text, timestamptz)', 'public.droit_module_base(uuid, text, text)',
    'public.derniere_rectification_ticket(uuid)', 'public.garde_decision_ticket_rectifie()']) f,
    unnest(ARRAY['anon', 'authenticated']) u
  WHERE has_function_privilege(u, f, 'EXECUTE')), 0, 'fonctions internes fermees aux comptes');
SELECT ok(has_function_privilege('authenticated',
            'public.enregistrer_cout(date, text, numeric, text, uuid, uuid, uuid, text, text, text, text, uuid)', 'EXECUTE')
          AND NOT has_function_privilege('anon',
            'public.enregistrer_cout(date, text, numeric, text, uuid, uuid, uuid, text, text, text, text, uuid)', 'EXECUTE')
          AND to_regprocedure('public.enregistrer_cout(date, text, numeric, text, uuid, uuid, uuid, text, text, text)') IS NULL,
  'enregistrer_cout : nouvelle signature pour authenticated seulement, ancienne retiree');
SELECT is((SELECT count(*)::int FROM unnest(ARRAY['anon', 'authenticated']) u,
                 unnest(ARRAY['INSERT', 'UPDATE', 'DELETE']) p
            WHERE has_table_privilege(u, 'public.costs', p) OR has_table_privilege(u, 'public.reconciliation_lignes', p)
               OR has_table_privilege(u, 'public.delegations_droits', p)), 0,
  'couts, lignes de reconciliation et delegations : aucune ecriture directe des comptes');
SELECT ok(NOT public.ligne_non_forcable(ARRAY['ticket_rectifie']) AND public.ligne_non_forcable(ARRAY['net_superieur_capacite'])
          AND public.ligne_bloquee(ARRAY['ticket_rectifie']),
  'ticket rectifie : bloquant (decision attendue) mais forcable ; net superieur a la capacite : jamais forcable');
SELECT ok(pg_get_functiondef('public.avancer_facture(uuid, text, text, date)'::regprocedure) ~ 'Seul le Directeur General signe'
          AND pg_get_functiondef('public.avancer_facture(uuid, text, text, date)'::regprocedure) !~ 'has_module_approve',
  'signature des factures : role director seulement, aucune approbation deleguee ne la donne');
SELECT is((SELECT count(*)::int FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
            AND p.proname IN ('decider_bon_commande', 'decider_paiement', 'controler_paiement', 'decider_clause',
                              'signer_plan_prevention', 'decider_ligne_reconciliation')
            AND p.prosrc LIKE '%separation_violee%'), 6,
  'les six controles d''approbation passent par separation_violee');
SELECT ok(pg_get_functiondef('public.cloturer_reconciliation(uuid)'::regprocedure) ~ 'decision_rectification_id',
  'cloture : defense en profondeur sur la rectification approuvee');

-- Donnees -------------------------------------------------------------------

DELETE FROM public.settings WHERE key IN ('achats_validation_separee', 'mfa_exige');
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-d820-000000000001', 'dir-a.d820@exemple.invalid'),
  ('00000000-0000-4000-d820-000000000002', 'dir-b.d820@exemple.invalid'),
  ('00000000-0000-4000-d820-000000000003', 'chef-c.d820@exemple.invalid'),
  ('00000000-0000-4000-d820-000000000004', 'chef-d.d820@exemple.invalid'),
  ('00000000-0000-4000-d820-000000000005', 'compta-e.d820@exemple.invalid'),
  ('00000000-0000-4000-d820-000000000006', 'chauffeur.d820@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-d820-000000000001', 'director', 'Dir A D820', 'active', NULL),
  ('00000000-0000-4000-d820-000000000002', 'director', 'Dir B D820', 'active', NULL),
  ('00000000-0000-4000-d820-000000000003', 'operations_manager', 'Chef C D820', 'active', NULL),
  ('00000000-0000-4000-d820-000000000004', 'operations_manager', 'Chef D D820', 'active', NULL),
  ('00000000-0000-4000-d820-000000000005', 'accountant', 'Compta E D820', 'active', NULL),
  ('00000000-0000-4000-d820-000000000006', 'driver', 'Chauffeur D820', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name, status = EXCLUDED.status,
  site_id = EXCLUDED.site_id;
-- Approbation : par le role seulement (director et accountant, matrice D-012).
UPDATE public.role_permissions SET can_approve = true
 WHERE role::text IN ('director', 'accountant') AND module IN ('purchases', 'invoices');
UPDATE public.role_permissions SET can_approve = false
 WHERE role::text IN ('operations_manager', 'driver') AND module IN ('purchases', 'invoices');
INSERT INTO public.droits_utilisateur (utilisateur, module, niveau)
SELECT u, m, 'ecriture'
  FROM unnest(ARRAY['00000000-0000-4000-d820-000000000001', '00000000-0000-4000-d820-000000000002',
                    '00000000-0000-4000-d820-000000000003', '00000000-0000-4000-d820-000000000004',
                    '00000000-0000-4000-d820-000000000005']::uuid[]) u,
       unnest(ARRAY['purchases', 'invoices', 'trips', 'costs']) m
ON CONFLICT (utilisateur, module) DO UPDATE SET niveau = EXCLUDED.niveau;
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-d820-0000000000a1', 'Mine D820', 'mine'),
  ('00000000-0000-4000-d820-0000000000a2', 'Depot CBG D820', 'depot');
INSERT INTO public.warehouses (id, name, code, warehouse_type, site_id) VALUES
  ('00000000-0000-4000-d820-0000000000d1', 'Magasin D820', 'TEST-MAG-D820', 'main', '00000000-0000-4000-d820-0000000000a1');
INSERT INTO public.suppliers (id, supplier_number, supplier_type, company_name) VALUES
  ('00000000-0000-4000-d820-0000000000f1', 'TEST-F-D820', 'parts', 'Fournisseur D820');

-- 1. Delegation des approbations ---------------------------------------------

SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000003');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.deleguer_droit('00000000-0000-4000-d820-000000000006', 'purchases', 'approbation',
  now(), now() + interval '1 day', 'Sans droit')$$, '42501', NULL,
  'un compte sans approbation propre ne la delegue pas');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.deleguer_droit('00000000-0000-4000-d820-000000000003', 'settings', 'approbation',
  now(), now() + interval '1 day', 'Administration')$$, '22023', NULL, 'l''administration ne se delegue pas');
SELECT throws_ok($$SELECT public.deleguer_droit('00000000-0000-4000-d820-000000000003', 'purchases', 'validation',
  now(), now() + interval '1 day', 'Niveau inconnu')$$, '22023', NULL, 'niveau inconnu refuse');
CREATE TEMP TABLE dlg_c AS SELECT public.deleguer_droit('00000000-0000-4000-d820-000000000003', 'purchases', 'approbation',
  now(), now() + interval '2 days', 'Absence du directeur') AS id;
CREATE TEMP TABLE dlg_ch AS SELECT public.deleguer_droit('00000000-0000-4000-d820-000000000006', 'purchases', 'approbation',
  now(), now() + interval '2 days', 'Essai chauffeur') AS id;
RESET ROLE;
SELECT is((SELECT (niveau, module)::text FROM public.delegations_droits WHERE id = (SELECT id FROM dlg_c)),
  '(approbation,purchases)', 'delegation d''approbation enregistree');
SELECT is((SELECT count(*)::int FROM public.journal_delegations WHERE delegation_id = (SELECT id FROM dlg_c)
            AND evenement = 'creation' AND niveau = 'approbation'), 1, 'delegation d''approbation journalisee');

SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000003');
SET LOCAL ROLE authenticated;
SELECT ok(public.has_module_approve('purchases'), 'le delegue approuve les achats');
SELECT ok(NOT public.has_module_approve('invoices'), 'pas les factures (autre module)');
SELECT is((SELECT statut FROM public.mes_delegations() WHERE id = (SELECT id FROM dlg_c)), 'active',
  'mes_delegations : delegation d''approbation active');
SELECT throws_ok($$SELECT public.deleguer_droit('00000000-0000-4000-d820-000000000004', 'purchases', 'approbation',
  now(), now() + interval '1 day', 'Redelegation')$$, '42501', NULL, 'une approbation recue ne se redelegue pas');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000006');
SET LOCAL ROLE authenticated;
SELECT ok(public.has_module_approve('purchases') AND NOT public.has_module_write('purchases'),
  'une delegation d''approbation ne donne pas l''ecriture');
RESET ROLE;
INSERT INTO public.droits_utilisateur (utilisateur, module, niveau)
VALUES ('00000000-0000-4000-d820-000000000006', 'purchases', 'lecture')
ON CONFLICT (utilisateur, module) DO UPDATE SET niveau = EXCLUDED.niveau;
SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000006');
SET LOCAL ROLE authenticated;
SELECT ok(NOT public.has_module_approve('purchases'), 'restriction administrateur (D-036) : la delegation reste sans effet');
RESET ROLE;

-- 2. Separation des taches avec une delegation d'approbation ----------------

SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE bc_a AS SELECT public.enregistrer_bon_commande(
  p_fournisseur => '00000000-0000-4000-d820-0000000000f1', p_depot => '00000000-0000-4000-d820-0000000000d1',
  p_lignes => '[{"designation": "Prestation D820 A", "quantite": 1, "prix_unitaire": 1000000}]'::jsonb) AS id;
SELECT public.soumettre_bon_commande((SELECT id FROM bc_a));
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000003');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.decider_bon_commande((SELECT id FROM bc_a), true)$$, '42501',
  'L''approbation revient a une autre personne que le demandeur',
  'R1 : le delegue n''approuve pas le bon de son delegant');
CREATE TEMP TABLE bc_c AS SELECT public.enregistrer_bon_commande(
  p_fournisseur => '00000000-0000-4000-d820-0000000000f1', p_depot => '00000000-0000-4000-d820-0000000000d1',
  p_lignes => '[{"designation": "Prestation D820 C", "quantite": 1, "prix_unitaire": 2000000}]'::jsonb) AS id;
SELECT public.soumettre_bon_commande((SELECT id FROM bc_c));
SELECT throws_ok($$SELECT public.decider_bon_commande((SELECT id FROM bc_c), true)$$, '42501', NULL,
  'le delegue n''approuve pas son propre bon');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.decider_bon_commande((SELECT id FROM bc_c), true)$$, '42501', NULL,
  'R1b : le delegant n''approuve pas le bon redige par son delegue pendant la delegation');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000002');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.decider_bon_commande((SELECT id FROM bc_a), true)$$, 'un tiers habilite approuve le bon A');
SELECT lives_ok($$SELECT public.decider_bon_commande((SELECT id FROM bc_c), true)$$, 'un tiers habilite approuve le bon C');
RESET ROLE;

-- Regle generale, avec la date de l'acte.
SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000003');
SELECT ok(public.separation_violee('00000000-0000-4000-d820-000000000001', 'purchases', 'purchases', now() - interval '10 days'),
  'R1 : acte du delegant anterieur a la delegation, approuve pendant celle-ci : refuse');
SELECT ok(NOT public.separation_violee('00000000-0000-4000-d820-000000000001', 'invoices', 'invoices', now()),
  'pas sur un autre module');
SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000001');
SELECT ok(NOT public.separation_violee('00000000-0000-4000-d820-000000000003', 'purchases', 'purchases', now() - interval '10 days'),
  'R1b : acte du delegue anterieur a la delegation : le delegant peut l''approuver');
SELECT ok(public.separation_violee('00000000-0000-4000-d820-000000000003', 'purchases', 'purchases', NULL),
  'R1b : date de l''acte inconnue, toute delegation compte (prudence)');
SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000002');
SELECT ok(NOT public.separation_violee('00000000-0000-4000-d820-000000000003', 'purchases', 'purchases', now()),
  'un tiers sans delegation n''est pas concerne');

-- Revocation : l'approbation cesse, la separation de l'acte fait pendant la
-- delegation demeure.
-- Delegation commencee la veille (dans une transaction de test, now() est fige).
SELECT pg_temp.se_connecter(NULL);
UPDATE public.delegations_droits SET debut = now() - interval '1 day' WHERE id = (SELECT id FROM dlg_c);
SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000001');
SET LOCAL ROLE authenticated;
SELECT public.revoquer_delegation((SELECT id FROM dlg_c), 'Retour du directeur');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000003');
SET LOCAL ROLE authenticated;
SELECT ok(NOT public.has_module_approve('purchases'), 'delegation revoquee : plus d''approbation');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000001');
SELECT ok(public.separation_violee('00000000-0000-4000-d820-000000000003', 'purchases', 'purchases', now() - interval '1 hour'),
  'apres revocation : l''acte fait pendant la delegation reste hors de portee du delegant');
SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000003');
SELECT ok(NOT public.separation_violee('00000000-0000-4000-d820-000000000001', 'purchases', 'purchases', now() + interval '1 hour'),
  'apres revocation : un acte posterieur du delegant n''est plus concerne');

-- 3. Ticket CBG rectifie --------------------------------------------------------

SELECT pg_temp.se_connecter(NULL);
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status, site_id) VALUES
  ('00000000-0000-4000-d820-0000000000b1', 'TEST-D820-1', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-d820-0000000000a1');
INSERT INTO public.trips (id, reference, planned_date, vehicle_id, departure_site_id, arrival_site_id, etat, net_weight) VALUES
  ('00000000-0000-4000-d820-000000000201', 'TEST-D820-RECT', '2001-09-05', '00000000-0000-4000-d820-0000000000b1',
   '00000000-0000-4000-d820-0000000000a1', '00000000-0000-4000-d820-0000000000a2', 'DELIVERED', 30),
  ('00000000-0000-4000-d820-000000000202', 'TEST-D820-CAPA', '2001-09-06', '00000000-0000-4000-d820-0000000000b1',
   '00000000-0000-4000-d820-0000000000a1', '00000000-0000-4000-d820-0000000000a2', 'DELIVERED', 30);
INSERT INTO public.tickets_pesee_cbg (trip_id, site_id, ticket, brut, tare, mesure_le, saisi_par) VALUES
  ('00000000-0000-4000-d820-000000000201', '00000000-0000-4000-d820-0000000000a2', 'TEST-D820-T1', 50, 20,
   '2001-09-05 10:00+00', '00000000-0000-4000-d820-000000000004'),
  ('00000000-0000-4000-d820-000000000202', '00000000-0000-4000-d820-0000000000a2', 'TEST-D820-T2', 65, 20,
   '2001-09-06 10:00+00', '00000000-0000-4000-d820-000000000004');
INSERT INTO public.contrats (id, reference, intitule, nature, contrepartie, devise, date_debut, statut, delai_paiement_jours) VALUES
  ('00000000-0000-4000-d820-0000000000e1', 'TEST-D820-CBG', 'Transport D820', 'client', 'CBG', 'USD', '2001-01-01', 'actif', 30);

-- Premiere rectification posee une heure plus tot (now() est fige dans la
-- transaction de test : deux rectifications auraient la meme heure).
INSERT INTO public.rectifications_tickets_pesee_cbg (ticket_id, ancien_ticket, ancien_brut, ancienne_tare, ancien_net,
  nouveau_ticket, nouveau_brut, nouvelle_tare, nouveau_document_ref, motif, corrige_par, corrige_le)
SELECT t.id, t.ticket, t.brut, t.tare, t.brut - t.tare, 'TEST-D820-T1B', 51, 20, 'scan-t1b.pdf', 'Lecture du brut corrigee',
       '00000000-0000-4000-d820-000000000005', now() - interval '1 hour'
  FROM public.tickets_pesee_cbg t WHERE t.trip_id = '00000000-0000-4000-d820-000000000201';
SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000004');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE rc AS SELECT public.ouvrir_reconciliation('00000000-0000-4000-d820-0000000000e1', '2001-09-01', '2001-09-30',
  'charge', 10, '00000000-0000-4000-d820-0000000000a1', NULL) AS id;
CREATE TEMP TABLE lg AS SELECT l.id, l.reference FROM public.reconciliation_lignes l WHERE l.reconciliation_id = (SELECT id FROM rc);
SELECT is((SELECT (anomalies @> ARRAY['ticket_rectifie'], public.statut_ligne(decision, anomalies))::text
             FROM public.reconciliation_lignes WHERE id = (SELECT id FROM lg WHERE reference = 'TEST-D820-RECT')),
  '(t,a_examiner)', 'ticket rectifie : la ligne attend une decision');
SELECT throws_ok($$SELECT public.decider_ligne_reconciliation((SELECT id FROM lg WHERE reference = 'TEST-D820-RECT'),
  'facturable', 'Rectification verifiee')$$, '42501', NULL, 'sans approbation de la facturation : refuse');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000005');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.decider_ligne_reconciliation((SELECT id FROM lg WHERE reference = 'TEST-D820-RECT'),
  'facturable', 'Ma rectification est juste')$$, '42501',
  'Ticket CBG rectifie : la decision revient a un approbateur distinct de l''auteur de la rectification et hors de ses delegations',
  'l''auteur de la rectification ne la declare pas facturable');
-- L'auteur delegue l'approbation des factures : son delegue ne decide pas.
CREATE TEMP TABLE dlg_e AS SELECT public.deleguer_droit('00000000-0000-4000-d820-000000000004', 'invoices', 'approbation',
  now(), now() + interval '1 day', 'Conges') AS id;
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000004');
SET LOCAL ROLE authenticated;
SELECT ok(public.has_module_approve('invoices'), 'le delegue de l''auteur detient l''approbation des factures');
SELECT throws_ok($$SELECT public.decider_ligne_reconciliation((SELECT id FROM lg WHERE reference = 'TEST-D820-RECT'),
  'facturable', 'Pour le compte de mon delegant')$$, '42501', NULL,
  'le delegue de l''auteur de la rectification ne la declare pas facturable');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.decider_ligne_reconciliation((SELECT id FROM lg WHERE reference = 'TEST-D820-RECT'),
  'facturable', NULL)$$, '22023', NULL, 'decision sans motif refusee');
SELECT lives_ok($$SELECT public.decider_ligne_reconciliation((SELECT id FROM lg WHERE reference = 'TEST-D820-RECT'),
  'facturable', 'Rectification controlee sur le releve CBG')$$, 'un approbateur distinct declare la ligne facturable');
RESET ROLE;
SELECT is((SELECT (public.statut_ligne(decision, anomalies), decide_par,
                   decision_rectification_id = public.derniere_rectification_ticket(trip_id))::text
             FROM public.reconciliation_lignes WHERE id = (SELECT id FROM lg WHERE reference = 'TEST-D820-RECT')),
  '(facturable,00000000-0000-4000-d820-000000000002,t)', 'decision memorisee avec la rectification approuvee');
SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000004');
SET LOCAL ROLE authenticated;
SELECT public.actualiser_reconciliation((SELECT id FROM rc));
SELECT is((SELECT decision FROM public.reconciliation_lignes WHERE id = (SELECT id FROM lg WHERE reference = 'TEST-D820-RECT')),
  'facturable', 'actualisation sans nouvelle rectification : la decision tient');
SELECT throws_ok($$SELECT public.decider_ligne_reconciliation((SELECT id FROM lg WHERE reference = 'TEST-D820-CAPA'),
  'facturable', 'Ecart explique')$$, '22023', NULL, 'controle : la ligne au net superieur a la capacite');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.decider_ligne_reconciliation((SELECT id FROM lg WHERE reference = 'TEST-D820-CAPA'),
  'facturable', 'Approbateur : ecart explique')$$, '22023', 'Anomalies a examiner avant de declarer la ligne facturable',
  'net superieur a la capacite : jamais facturable, meme par un approbateur motive');
RESET ROLE;

-- Nouvelle rectification (par un autre compte : l'auteur E delegue
-- l'approbation a l'auteur du ticket, R1b) : decision perimee.
SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000005');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.rectifier_ticket_pesee_cbg('00000000-0000-4000-d820-000000000201', 'TEST-D820-T1X', 52, 20, NULL,
  'Par le delegant')$$, '42501', NULL, 'R1b : le delegant ne rectifie pas le ticket saisi par son delegue pendant la delegation');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000001');
SET LOCAL ROLE authenticated;
SELECT public.rectifier_ticket_pesee_cbg('00000000-0000-4000-d820-000000000201', 'TEST-D820-T1C', 52, 20, 'scan-t1c.pdf',
  'Seconde lecture');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.decider_ligne_reconciliation((SELECT id FROM lg WHERE reference = 'TEST-D820-RECT'),
  'facturable', 'Sans actualiser')$$, '22023',
  'Ticket CBG modifie depuis la derniere actualisation : actualiser la reconciliation avant de decider',
  'instantane perime : decision refusee avant actualisation');
SELECT public.actualiser_reconciliation((SELECT id FROM rc));
SELECT is((SELECT (decision, motif_decision, decide_par, decision_rectification_id)::text FROM public.reconciliation_lignes
            WHERE id = (SELECT id FROM lg WHERE reference = 'TEST-D820-RECT')), '(,,,)',
  'rectification posterieure a la decision : la ligne repasse a examiner');
SELECT throws_ok($$SELECT public.cloturer_reconciliation((SELECT id FROM rc))$$, '22023', NULL,
  'cloture refusee tant que la ligne n''est pas redecidee');
SELECT lives_ok($$SELECT public.decider_ligne_reconciliation((SELECT id FROM lg WHERE reference = 'TEST-D820-RECT'),
  'facturable', 'Seconde rectification controlee')$$, 'nouvelle decision sur la derniere rectification');
RESET ROLE;
-- Ecriture hors fonction (proprietaire) : sans la rectification approuvee, la garde remet a examiner.
SELECT pg_temp.se_connecter(NULL);
UPDATE public.reconciliation_lignes SET decision_rectification_id = NULL
 WHERE id = (SELECT id FROM lg WHERE reference = 'TEST-D820-RECT');
SELECT is((SELECT decision FROM public.reconciliation_lignes WHERE id = (SELECT id FROM lg WHERE reference = 'TEST-D820-RECT')),
  NULL::text, 'garde : « facturable » sans rectification approuvee est remis a examiner');
SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000002');
SET LOCAL ROLE authenticated;
SELECT public.decider_ligne_reconciliation((SELECT id FROM lg WHERE reference = 'TEST-D820-RECT'), 'exclue', 'Exclue finalement');
RESET ROLE;
SELECT is((SELECT (decision, decision_rectification_id)::text FROM public.reconciliation_lignes
            WHERE id = (SELECT id FROM lg WHERE reference = 'TEST-D820-RECT')), '(exclue,)',
  'exclusion : aucune rectification memorisee');

-- 4. Couts TTC et piece reprise ---------------------------------------------------

SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000003');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.enregistrer_cout('2001-09-10', 'Piece sans numero', 1000, 'GNF',
  p_piece_source => 'bon_commande')$$, '22023', NULL, 'piece reprise : type sans piece refuse');
SELECT throws_ok($$SELECT public.enregistrer_cout('2001-09-10', 'Piece inconnue', 1000, 'GNF',
  p_piece_source => 'bon_commande', p_piece_id => '00000000-0000-4000-d820-0000000009ff')$$, '22023', NULL,
  'piece reprise inconnue refusee');
SELECT throws_ok($$SELECT public.enregistrer_cout('2001-09-10', 'Type inconnu', 1000, 'GNF',
  p_piece_source => 'autre', p_piece_id => (SELECT id FROM bc_a))$$, '22023', NULL, 'type de piece inconnu refuse');
CREATE TEMP TABLE c_lie AS SELECT public.enregistrer_cout('2001-09-10', 'Prestation du bon A', 1000000, 'GNF',
  p_piece_source => 'bon_commande', p_piece_id => (SELECT id FROM bc_a)) AS id;
CREATE TEMP TABLE c_seul AS SELECT public.enregistrer_cout('2001-09-10', 'Petite depense', 5000, 'GNF') AS id;
RESET ROLE;
SELECT is((SELECT (piece_reprise_source, piece_reprise_id = (SELECT id FROM bc_a))::text FROM public.costs
            WHERE id = (SELECT id FROM c_lie)), '(bon_commande,t)', 'piece reprise enregistree avec le cout');
SELECT is((SELECT count(*)::int FROM public.v_depenses_budgetaires WHERE origine = 'cout' AND piece_id = (SELECT id FROM c_lie)), 0,
  'cout reprenant une piece fournisseur : hors du realise (pas de double compte)');
SELECT is((SELECT count(*)::int FROM public.v_depenses_budgetaires WHERE origine = 'cout' AND piece_id = (SELECT id FROM c_seul)
            AND categorie = 'realise' AND base_montant = 'TTC saisi (cout D-058)'), 1,
  'cout sans piece reprise : au realise, en TTC');
SELECT is((SELECT count(*)::int FROM public.v_depenses_budgetaires WHERE piece_id = (SELECT id FROM bc_a) AND origine = 'bon_commande'), 1,
  'le bon repris reste compte une fois, par le circuit fournisseur');
SELECT pg_temp.se_connecter('00000000-0000-4000-d820-000000000003');
SELECT throws_ok($$UPDATE public.costs SET statut = 'annule', motif_annulation = 'x', piece_reprise_source = NULL, piece_reprise_id = NULL
  WHERE id = (SELECT id FROM c_lie)$$, '42501', NULL, 'piece reprise figee, meme lors d''une annulation');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.annuler_cout((SELECT id FROM c_lie), 'Saisie en double')$$, 'le cout lie s''annule avec un motif');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
