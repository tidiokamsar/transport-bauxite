-- Tests (D-065) : clauses chiffrees calculees depuis le rapport remis et
-- appliquees par decision motivee (avoir ou facture D-029), separation de la
-- renonciation, echeances et alertes, budgets (engage, realise, depassement,
-- revision, perimetre), dettes, export comptable, evaluation du loueur sur
-- la grille D-059, reglages repris, corrections de la revue independante
-- (calcul rouvert a l'annulation de sa piece, periodes chevauchantes, avoirs
-- plafonnes apres avoirs, profil global de l'evaluation du loueur)
-- (migration 20261121120000). Periodes de
-- 2001, vides en production. Tout est annule. Un droit retire se verifie
-- par has_*_privilege, jamais par un appel sous SET ROLE (D-072) ; les
-- gardes se verifient sans SET ROLE, avec une session utilisateur.
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

SELECT plan(111);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a650-000000000001', 'contrats.d065@exemple.invalid'),
  ('00000000-0000-4000-a650-000000000002', 'admin.d065@exemple.invalid'),
  ('00000000-0000-4000-a650-000000000003', 'chauffeur.d065@exemple.invalid'),
  ('00000000-0000-4000-a650-000000000004', 'directeur.d065@exemple.invalid'),
  ('00000000-0000-4000-a650-000000000005', 'site.d065@exemple.invalid'),
  ('00000000-0000-4000-a650-000000000006', 'contrats2.d065@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES ('00000000-0000-4000-a650-000000000a51', 'Mine D-065', 'mine');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-a650-000000000001', 'contract_manager', 'Charge D-065', 'active', NULL),
  ('00000000-0000-4000-a650-000000000002', 'admin', 'Admin D-065', 'active', NULL),
  ('00000000-0000-4000-a650-000000000003', 'driver', 'Chauffeur D-065', 'active', NULL),
  ('00000000-0000-4000-a650-000000000004', 'director', 'Directeur D-065', 'active', NULL),
  ('00000000-0000-4000-a650-000000000005', 'contract_manager', 'Charge site D-065', 'active', '00000000-0000-4000-a650-000000000a51'),
  ('00000000-0000-4000-a650-000000000006', 'contract_manager', 'Second charge D-065', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;

INSERT INTO public.contrats (id, reference, intitule, nature, contrepartie, devise, date_debut, date_fin, statut, preavis_jours, renouvellement) VALUES
  ('00000000-0000-4000-a650-0000000000c1', 'TEST-D065-CBG', 'Transport test', 'client', 'Client D-065', 'USD', '2001-01-01',
   current_date + 10, 'actif', 30, 'tacite'),
  ('00000000-0000-4000-a650-0000000000c2', 'TEST-D065-LOC', 'Location test', 'location', 'Loueur D-065', 'USD', '2001-01-01', NULL, 'actif', NULL, NULL);
INSERT INTO public.contrat_versions (id, contrat_id, numero, intitule, date_effet) VALUES
  ('00000000-0000-4000-a650-0000000000d1', '00000000-0000-4000-a650-0000000000c1', 0, 'Initial', '2001-01-01'),
  ('00000000-0000-4000-a650-0000000000d2', '00000000-0000-4000-a650-0000000000c2', 0, 'Initial', '2001-01-01');
INSERT INTO public.contrat_engagements (id, version_id, indicateur, libelle, seuil, unite, sens, periodicite) VALUES
  ('00000000-0000-4000-a650-0000000000e1', '00000000-0000-4000-a650-0000000000d1', 'disponibilite', 'Disponibilite', 90, '%', 'minimum', 'mois'),
  ('00000000-0000-4000-a650-0000000000e2', '00000000-0000-4000-a650-0000000000d1', 'autre', 'Clause libre', 1, 'u', 'minimum', 'mois'),
  ('00000000-0000-4000-a650-0000000000e3', '00000000-0000-4000-a650-0000000000d2', 'disponibilite', 'Disponibilite engins', 85, '%', 'minimum', 'mois');
-- Rapports figes (fixtures) : seule la mesure du rapport compte pour le calcul.
INSERT INTO public.rapports_performance (id, contrat_id, periode_debut, periode_fin, contenu, statut, remis_le, remis_a) VALUES
  ('00000000-0000-4000-a650-0000000000a1', '00000000-0000-4000-a650-0000000000c1', '2001-11-01', '2001-11-30',
   '{"engagements": [{"engagement_id": "00000000-0000-4000-a650-0000000000e1", "indicateur": "disponibilite", "seuil": 90, "unite": "%", "sens": "minimum", "realise": 80, "echantillon": 3, "conforme": false}]}',
   'remis', '2001-12-05', 'Client'),
  ('00000000-0000-4000-a650-0000000000a2', '00000000-0000-4000-a650-0000000000c2', '2001-10-01', '2001-10-31', '{"engagements": []}', 'brouillon', NULL, NULL),
  ('00000000-0000-4000-a650-0000000000a3', '00000000-0000-4000-a650-0000000000c2', '2001-11-01', '2001-11-30',
   '{"engagements": [{"engagement_id": "00000000-0000-4000-a650-0000000000e3", "indicateur": "disponibilite", "seuil": 85, "unite": "%", "sens": "minimum", "realise": 70, "echantillon": 2, "conforme": false}]}',
   'remis', '2001-12-05', 'Loueur'),
  ('00000000-0000-4000-a650-0000000000a4', '00000000-0000-4000-a650-0000000000c1', '2001-10-01', '2001-10-31',
   '{"engagements": [{"engagement_id": "00000000-0000-4000-a650-0000000000e1", "indicateur": "disponibilite", "seuil": 90, "unite": "%", "sens": "minimum", "realise": 85, "echantillon": 3, "conforme": false}]}',
   'remis', '2001-11-05', 'Client'),
  ('00000000-0000-4000-a650-0000000000a5', '00000000-0000-4000-a650-0000000000c1', '2001-11-15', '2001-12-14',
   '{"engagements": [{"engagement_id": "00000000-0000-4000-a650-0000000000e1", "indicateur": "disponibilite", "seuil": 90, "unite": "%", "sens": "minimum", "realise": 70, "echantillon": 3, "conforme": false}]}',
   'remis', '2001-12-20', 'Client'),
  ('00000000-0000-4000-a650-0000000000a6', '00000000-0000-4000-a650-0000000000c1', '2001-08-01', '2001-08-31',
   '{"engagements": [{"engagement_id": "00000000-0000-4000-a650-0000000000e1", "indicateur": "disponibilite", "seuil": 90, "unite": "%", "sens": "minimum", "realise": 60, "echantillon": 3, "conforme": false}]}',
   'remis', '2001-09-05', 'Client');
INSERT INTO public.factures (id, numero, type, contrat_id, objet, periode_debut, periode_fin, devise, taux_taxe_pct, montant_ht, montant_taxe,
                             montant_ttc, statut, date_emission) VALUES
  ('00000000-0000-4000-a650-0000000000f1', 'TEST-D065-FAC', 'facture', '00000000-0000-4000-a650-0000000000c1', 'Transport novembre',
   '2001-11-01', '2001-11-30', 'USD', 0, 10000, 0, 10000, 'emise', '2001-12-01'),
  -- Facture d'une autre devise sur la meme periode : hors assiette.
  ('00000000-0000-4000-a650-0000000000f4', 'TEST-D065-FAC-GNF', 'facture', '00000000-0000-4000-a650-0000000000c1', 'Autre devise',
   '2001-11-01', '2001-11-30', 'GNF', 0, 999999, 0, 999999, 'emise', '2001-12-01');
INSERT INTO public.factures_fournisseur (id, contrat_id, numero_fournisseur, date_facture, periode_debut, periode_fin, devise,
                                         montant_ht_facture, montant_ttc_facture, statut) VALUES
  ('00000000-0000-4000-a650-0000000000f2', '00000000-0000-4000-a650-0000000000c2', 'D065-F1', '2001-12-02', '2001-11-01', '2001-11-30', 'USD', 1000, 1180, 'conforme');
INSERT INTO public.suppliers (id, supplier_number, supplier_type, company_name) VALUES
  ('00000000-0000-4000-a650-0000000000b1', 'TEST-F-D065', 'parts', 'Fournisseur D-065');
INSERT INTO public.warehouses (id, name, code, warehouse_type, site_id) VALUES
  ('00000000-0000-4000-a650-0000000000b2', 'Magasin D-065', 'TEST-MAG-D065', 'main', NULL);
INSERT INTO public.purchase_orders (id, po_number, po_date, supplier_id, warehouse_id, status, tax_amount) VALUES
  ('00000000-0000-4000-a650-0000000000b3', 'TEST-D065-BC', '2001-04-01', '00000000-0000-4000-a650-0000000000b1',
   '00000000-0000-4000-a650-0000000000b2', 'approved', 36);
INSERT INTO public.purchase_order_items (purchase_order_id, item_description, quantity, unit_price, total_price, quantity_received) VALUES
  ('00000000-0000-4000-a650-0000000000b3', 'Filtres', 10, 20, 200, 4);
INSERT INTO public.cost_categories (id, name, category_type) VALUES ('00000000-0000-4000-a650-0000000000b4', 'Pieces D-065', 'variable');
DELETE FROM public.settings WHERE key IN ('contrats_alerte_echeance_jours', 'clauses_renonciation_separee');
UPDATE public.criteres_evaluation_fournisseur SET actif = false;

-- Clauses chiffrees -------------------------------------------------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000003');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.definir_clause('00000000-0000-4000-a650-0000000000d1', 'penalite', 'X', '00000000-0000-4000-a650-0000000000e1',
  'non_tenu', 'montant', 10)$$, '42501', NULL, 'clause : droit d''ecriture des contrats requis');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.definir_clause('00000000-0000-4000-a650-0000000000d1', 'penalite', 'X', '00000000-0000-4000-a650-0000000000e2',
  'non_tenu', 'montant', 10)$$, '22023', NULL, 'un engagement « autre » ne conditionne pas une clause');
SELECT throws_ok($$SELECT public.definir_clause('00000000-0000-4000-a650-0000000000d1', 'penalite', 'X', '00000000-0000-4000-a650-0000000000e3',
  'non_tenu', 'montant', 10)$$, '22023', NULL, 'engagement d''une autre version refuse');
SELECT throws_ok($$SELECT public.definir_clause('00000000-0000-4000-a650-0000000000d1', 'penalite', 'X', '00000000-0000-4000-a650-0000000000e1',
  'non_tenu', 'taux', 120)$$, '22023', NULL, 'taux au-dela de 100 % refuse');
SELECT throws_ok($$SELECT public.definir_clause('00000000-0000-4000-a650-0000000000d1', 'penalite', 'X', '00000000-0000-4000-a650-0000000000e1',
  'non_tenu', 'montant', 10.555)$$, '22023', NULL, 'montant HT a plus de deux decimales refuse');
CREATE TEMP TABLE k1 AS SELECT public.definir_clause('00000000-0000-4000-a650-0000000000d1', 'penalite', 'Penalite disponibilite',
  '00000000-0000-4000-a650-0000000000e1', 'non_tenu', 'taux', 5, p_plafond => 300) AS id;
SELECT is((SELECT count(*)::int FROM public.journal_contrats WHERE table_cible = 'contrat_clauses' AND ligne_id = (SELECT id FROM k1)), 1,
  'clause journalisee au dossier contractuel');
SELECT throws_ok($$SELECT public.calculer_clauses('00000000-0000-4000-a650-0000000000a2')$$, '22023', NULL, 'rapport non remis : pas de calcul');
SELECT is(public.calculer_clauses('00000000-0000-4000-a650-0000000000a1'), 1, 'une proposition calculee depuis le rapport remis');
SELECT is((SELECT (statut, assiette_ht, montant_calcule_ht, montant_propose_ht, devise)::text FROM public.calculs_clauses
            WHERE clause_id = (SELECT id FROM k1) AND rapport_id = '00000000-0000-4000-a650-0000000000a1'),
  '(propose,10000.00,500.00,300.00,USD)', 'taux applique a l''assiette HT dans la devise du contrat, ramene au plafond');
SELECT is(public.calculer_clauses('00000000-0000-4000-a650-0000000000a1'), 0, 'pas de second calcul pour le meme rapport');
SELECT ok(EXISTS (SELECT 1 FROM public.mes_validations() WHERE objet = 'Clause contractuelle à décider'), 'clause proposee dans mes validations');
SELECT throws_ok($$SELECT public.decider_clause((SELECT id FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k1)), true, ' ')$$,
  '22023', NULL, 'decision sans motif refusee');
SELECT throws_ok($$SELECT public.decider_clause((SELECT id FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k1)), true, 'Penalite due')$$,
  '22023', NULL, 'deduction sans facture du contrat refusee');
SELECT throws_ok($$SELECT public.decider_clause((SELECT id FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k1)), true, 'Penalite due',
  '00000000-0000-4000-a650-0000000000f4')$$, '22023', NULL, 'facture d''une autre devise refusee');
SELECT throws_ok($$SELECT public.decider_clause((SELECT id FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k1)), false, 'Renonce')$$,
  '42501', NULL, 'renonciation sans approbation des contrats refusee (reglage absent : separation exigee)');
CREATE TEMP TABLE av AS SELECT public.decider_clause((SELECT id FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k1)), true,
  'Penalite due selon l''avenant', '00000000-0000-4000-a650-0000000000f1') AS id;
SELECT is((SELECT (type, statut, montant_ht, prepare_par::text)::text FROM public.factures WHERE id = (SELECT id FROM av)),
  '(avoir,brouillon,-300.00,00000000-0000-4000-a650-000000000001)', 'avoir brouillon produit par creer_avoir, le decideur en est le preparateur');
SELECT is((SELECT count(*)::int FROM public.facture_lignes WHERE facture_id = (SELECT id FROM av) AND calcul_clause_id IS NOT NULL), 1,
  'ligne de l''avoir rattachee au calcul de la clause');
SELECT is((SELECT statut FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k1) AND facture_id = (SELECT id FROM av)), 'applique',
  'proposition appliquee, rattachee a l''avoir');
SELECT throws_ok($$SELECT public.decider_clause((SELECT id FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k1)), true, 'Revu',
  '00000000-0000-4000-a650-0000000000f1')$$, '22023', NULL, 'une proposition appliquee ne se decide plus');
SELECT throws_ok($$SELECT public.definir_clause('00000000-0000-4000-a650-0000000000d1', 'penalite', 'Modifiee', '00000000-0000-4000-a650-0000000000e1',
  'non_tenu', 'montant', 10, p_id => (SELECT id FROM k1))$$, '22023', NULL, 'clause calculee non modifiable');
CREATE TEMP TABLE k2 AS SELECT public.definir_clause('00000000-0000-4000-a650-0000000000d2', 'penalite', 'Penalite loueur',
  '00000000-0000-4000-a650-0000000000e3', 'non_tenu', 'montant', 1000) AS id;
CREATE TEMP TABLE k3 AS SELECT public.definir_clause('00000000-0000-4000-a650-0000000000d2', 'bonus', 'Bonus loueur',
  '00000000-0000-4000-a650-0000000000e3', 'tenu', 'montant', 200) AS id;
SELECT is(public.calculer_clauses('00000000-0000-4000-a650-0000000000a3'), 2, 'deux clauses du loueur calculees');
SELECT is((SELECT statut FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k3)), 'sans_objet', 'bonus non declenche : sans objet');
SELECT throws_ok($$SELECT public.decider_clause((SELECT id FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k2)), true, 'Due')$$,
  '22023', NULL, 'nouvelle facture sans taux de taxe refusee');
CREATE TEMP TABLE f2 AS SELECT public.decider_clause((SELECT id FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k2)), true,
  'Penalite de disponibilite due', p_taux_taxe => 0) AS id;
SELECT is((SELECT (type, statut, contrat_id::text, montant_ht, devise)::text FROM public.factures WHERE id = (SELECT id FROM f2)),
  '(facture,brouillon,00000000-0000-4000-a650-0000000000c2,1000.00,USD)', 'penalite du loueur : facture brouillon au circuit de signature');
RESET ROLE;

-- Un autre preparateur ne complete pas ce brouillon ; le decideur ne le signe pas.
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000006');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE k4 AS SELECT public.definir_clause('00000000-0000-4000-a650-0000000000d2', 'retenue', 'Retenue loueur',
  '00000000-0000-4000-a650-0000000000e3', 'non_tenu', 'montant', 50) AS id;
SELECT is(public.calculer_clauses('00000000-0000-4000-a650-0000000000a3'), 1, 'clause ajoutee calculee seule sur le meme rapport');
SELECT throws_ok($$SELECT public.decider_clause((SELECT id FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k4)), true, 'Retenue due',
  (SELECT id FROM f2))$$, '42501', NULL, 'ligne de clause refusee sur le brouillon d''un autre preparateur');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000001');
SET LOCAL ROLE authenticated;
SELECT is(public.avancer_facture((SELECT id FROM f2), 'soumettre'), 'a_signer', 'facture de clause soumise a signature');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000004');
SET LOCAL ROLE authenticated;
SELECT is(public.avancer_facture((SELECT id FROM f2), 'signer'), 'signee', 'facture de clause signee par le Directeur General, autre que le preparateur');
-- Renonciation : droit d'approbation des contrats et autre personne que l'auteur du calcul.
SELECT is(public.decider_clause((SELECT id FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k4)), false, 'Retenue abandonnee apres comite'),
  NULL::uuid, 'renonciation par le Directeur General (approbation des contrats)');
SELECT is((SELECT (statut, decide_par::text)::text FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k4)),
  '(ecarte,00000000-0000-4000-a650-000000000004)', 'renonciation tracee avec son auteur');
RESET ROLE;

-- Assiette d'un taux : hors lignes produites par une clause.
INSERT INTO public.factures (id, numero, type, contrat_id, objet, periode_debut, periode_fin, devise, taux_taxe_pct, montant_ht, montant_taxe,
                             montant_ttc, statut, date_emission) VALUES
  ('00000000-0000-4000-a650-0000000000f3', 'TEST-D065-FAC-OCT', 'facture', '00000000-0000-4000-a650-0000000000c1', 'Transport octobre',
   '2001-10-01', '2001-10-31', 'USD', 0, 1000, 0, 1000, 'emise', '2001-11-02');
INSERT INTO public.facture_lignes (facture_id, ordre, libelle, quantite, unite, prix_unitaire, montant, calcul_clause_id) VALUES
  ('00000000-0000-4000-a650-0000000000f3', 1, 'Transport', 1, 'forfait', 600, 600, NULL),
  ('00000000-0000-4000-a650-0000000000f3', 900, 'Bonus anterieur', 1, 'forfait', 400, 400,
   (SELECT id FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k1)));
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000001');
SET LOCAL ROLE authenticated;
SELECT is(public.calculer_clauses('00000000-0000-4000-a650-0000000000a4'), 1, 'calcul du mois precedent');
SELECT is((SELECT (assiette_ht, montant_propose_ht)::text FROM public.calculs_clauses
            WHERE clause_id = (SELECT id FROM k1) AND rapport_id = '00000000-0000-4000-a650-0000000000a4'),
  '(600.00,30.00)', 'assiette sans la ligne produite par une clause');
RESET ROLE;
-- Separation levee par le reglage : l'auteur du calcul renonce lui-meme.
INSERT INTO public.settings (key, value, category) VALUES ('clauses_renonciation_separee', '{"value": "false"}', 'test');
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000001');
SET LOCAL ROLE authenticated;
SELECT is(public.decider_clause((SELECT id FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k1)
                                  AND rapport_id = '00000000-0000-4000-a650-0000000000a4'), false, 'Geste commercial decide en comite'),
  NULL::uuid, 'reglage a false : l''auteur du calcul peut renoncer');
RESET ROLE;
-- Garde du calcul (sans SET ROLE, session utilisateur).
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000001');
SELECT throws_ok($$UPDATE public.calculs_clauses SET montant_propose_ht = 1 WHERE clause_id = (SELECT id FROM k3)$$, '42501', NULL,
  'calcul de clause fige (garde)');
SELECT throws_ok($$DELETE FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k3)$$, '42501', NULL, 'calcul de clause non supprimable (garde)');

-- M2 : rapports dont les periodes se chevauchent, une seule proposition.
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000001');
SET LOCAL ROLE authenticated;
SELECT is(public.calculer_clauses('00000000-0000-4000-a650-0000000000a5'), 1, 'rapport chevauchant calcule');
SELECT is((SELECT (statut, montant_propose_ht IS NULL, raison)::text FROM public.calculs_clauses
            WHERE clause_id = (SELECT id FROM k1) AND rapport_id = '00000000-0000-4000-a650-0000000000a5'),
  '(sans_objet,t,"Periode deja couverte par le calcul du 01/11/2001 au 30/11/2001")', 'periode deja couverte : sans objet, aucune seconde proposition');

-- M1 : la piece produite est annulee, le calcul revient a la decision.
CREATE TEMP TABLE k5 AS SELECT public.definir_clause('00000000-0000-4000-a650-0000000000d2', 'penalite', 'Penalite loueur bis',
  '00000000-0000-4000-a650-0000000000e3', 'non_tenu', 'montant', 70) AS id;
SELECT is(public.calculer_clauses('00000000-0000-4000-a650-0000000000a3'), 1, 'nouvelle clause du loueur calculee');
CREATE TEMP TABLE f5 AS SELECT public.decider_clause((SELECT id FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k5)), true,
  'Penalite due', p_taux_taxe => 0) AS id;
SELECT is(public.avancer_facture((SELECT id FROM f5), 'annuler', 'Brouillon annule par le preparateur'), 'annulee', 'brouillon de la penalite annule');
SELECT is((SELECT (statut, facture_id IS NULL, decide_par IS NULL)::text FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k5)),
  '(propose,t,t)', 'facture annulee : le calcul revient a la decision, rien ne disparait');
SELECT is((SELECT string_agg(evenement, ',' ORDER BY le) FROM public.calculs_clauses_journal
            WHERE calcul_id = (SELECT id FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k5))), 'applique,reouvert',
  'application et reouverture journalisees');
SELECT ok(EXISTS (SELECT 1 FROM public.mes_validations() WHERE objet = 'Clause contractuelle à décider' AND reference = 'Penalite loueur bis'),
  'calcul rouvert de nouveau dans mes validations');
RESET ROLE;

-- M3 : avoirs plafonnes au reste apres avoirs ; deduction plafonnee ; ligne negative sur brouillon.
INSERT INTO public.factures (id, numero, type, contrat_id, objet, periode_debut, periode_fin, devise, taux_taxe_pct, montant_ht, montant_taxe,
                             montant_ttc, statut, date_emission, prepare_par) VALUES
  ('00000000-0000-4000-a650-0000000000f6', 'TEST-D065-FAC-AOU', 'facture', '00000000-0000-4000-a650-0000000000c1', 'Transport aout',
   '2001-08-01', '2001-08-31', 'USD', 0, 1000, 0, 1000, 'emise', '2001-09-01', NULL),
  ('00000000-0000-4000-a650-0000000000f7', NULL, 'facture', '00000000-0000-4000-a650-0000000000c1', 'Transport aout (brouillon)',
   '2001-08-01', '2001-08-31', 'USD', 0, 1000, 0, 1000, 'brouillon', NULL, '00000000-0000-4000-a650-000000000001');
INSERT INTO public.facture_lignes (facture_id, ordre, libelle, quantite, unite, prix_unitaire, montant) VALUES
  ('00000000-0000-4000-a650-0000000000f7', 1, 'Transport', 1, 'forfait', 1000, 1000);
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000001');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.creer_avoir('00000000-0000-4000-a650-0000000000f6', 800, 'Ecart de tonnage')$$, 'premier avoir de 800 sur 1000 HT');
SELECT throws_ok($$SELECT public.creer_avoir('00000000-0000-4000-a650-0000000000f6', 800, 'Second ecart')$$, '22023', NULL,
  'second avoir au-dela du reste apres avoirs refuse');
CREATE TEMP TABLE k6 AS SELECT public.definir_clause('00000000-0000-4000-a650-0000000000d1', 'penalite', 'Penalite aout',
  '00000000-0000-4000-a650-0000000000e1', 'non_tenu', 'montant', 500) AS id;
SELECT is(public.calculer_clauses('00000000-0000-4000-a650-0000000000a6'), 2, 'rapport d''aout : deux clauses calculees');
SELECT throws_ok($$SELECT public.decider_clause((SELECT id FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k6)), true, 'Due',
  '00000000-0000-4000-a650-0000000000f6')$$, '22023', NULL, 'deduction superieure au reste HT apres avoirs refusee');
SELECT is(public.decider_clause((SELECT id FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k6)), true, 'Penalite deduite du brouillon',
  '00000000-0000-4000-a650-0000000000f7'), '00000000-0000-4000-a650-0000000000f7'::uuid, 'deduction sur un brouillon prepare par le decideur');
SELECT is((SELECT montant_ht::text FROM public.factures WHERE id = '00000000-0000-4000-a650-0000000000f7'), '500.00',
  'ligne negative : HT du brouillon recalcule');
RESET ROLE;

-- Echeances et alertes ------------------------------------------------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT (nature_echeance, a_signaler, jours_restants)::text FROM public.v_echeances_contrats
  WHERE contrat_id = '00000000-0000-4000-a650-0000000000c1'), '(fin,f,10)', 'sans reglage : pas d''alerte avant la date de fin');
RESET ROLE;
SELECT throws_ok($$INSERT INTO public.settings (key, value, category) VALUES ('contrats_alerte_echeance_jours', '{"value": "15 j"}', 'test')$$,
  '22023', NULL, 'reglage du delai : entier exige');
INSERT INTO public.settings (key, value, category) VALUES ('contrats_alerte_echeance_jours', '{"value": "15"}', 'test');
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT a_signaler FROM public.v_echeances_contrats WHERE contrat_id = '00000000-0000-4000-a650-0000000000c1'), true,
  'alerte dans le delai du reglage');
SELECT ok(EXISTS (SELECT 1 FROM public.mes_validations() WHERE objet = 'Échéance de contrat' AND reference = 'TEST-D065-CBG'),
  'echeance dans mes validations');
SELECT throws_ok($$SELECT public.enregistrer_echeance_contrat('00000000-0000-4000-a650-0000000000c1', 'renouvellement', current_date, 'Avenant',
  current_date)$$, '22023', NULL, 'renouvellement : nouvelle fin posterieure exigee');
SELECT public.enregistrer_echeance_contrat('00000000-0000-4000-a650-0000000000c1', 'renouvellement', current_date, 'Avenant n 1 signe',
  current_date + 400);
SELECT is((SELECT date_fin - current_date FROM public.contrats WHERE id = '00000000-0000-4000-a650-0000000000c1'), 400,
  'renouvellement : nouvelle date de fin enregistree');
SELECT ok(NOT coalesce((SELECT a_signaler FROM public.v_echeances_contrats WHERE contrat_id = '00000000-0000-4000-a650-0000000000c1'), false),
  'plus d''alerte apres le renouvellement');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000001');
SELECT throws_ok($$DELETE FROM public.contrats_echeances WHERE contrat_id = '00000000-0000-4000-a650-0000000000c1'$$, '42501', NULL,
  'evenement d''echeance non supprimable (garde)');

-- Reglages repris : cles de la derniere definition conservees ----------------------
SELECT lives_ok($$INSERT INTO public.settings (key, value, category) VALUES ('planification_cloture_separee', '{"value": "true"}', 'test')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value$$, 'planification_cloture_separee (D-063) toujours admise');
SELECT throws_ok($$UPDATE public.settings SET value = '{"value": "oui"}' WHERE key = 'clauses_renonciation_separee'$$, '22023', NULL,
  'clauses_renonciation_separee : booleen exige');

-- Referentiels administrateur et budgets --------------------------------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.definir_nature_depense('PIECES', 'Pieces')$$, '42501', NULL, 'natures : administrateur seulement');
SELECT throws_ok($$SELECT public.definir_compte_comptable('411', 'Clients')$$, '42501', NULL, 'plan de comptes : administrateur seulement');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000002');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE n1 AS SELECT public.definir_nature_depense('TEST-D065-PIECES', 'Pieces de rechange D-065') AS id;
CREATE TEMP TABLE n2 AS SELECT public.definir_nature_depense('TEST-D065-AUTRE', 'Autre D-065') AS id;
SELECT public.associer_categorie_cout('00000000-0000-4000-a650-0000000000b4', (SELECT id FROM n1));
CREATE TEMP TABLE cpt AS SELECT public.definir_compte_comptable('TEST-411-D065', 'Client D-065') AS id;
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000005');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.definir_budget('2001-01-01', '2001-12-31', (SELECT id FROM n2), 'GNF', 10)$$, '42501', NULL,
  'budget sans site refuse a un profil borne a un site (D-075)');
SELECT lives_ok($$SELECT public.definir_budget('2001-01-01', '2001-12-31', (SELECT id FROM n2), 'GNF', 10, '00000000-0000-4000-a650-000000000a51')$$,
  'budget de son site accepte');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE b1 AS SELECT public.definir_budget('2001-01-01', '2001-12-31', (SELECT id FROM n1), 'gnf', 1000) AS id;
SELECT throws_ok($$SELECT public.definir_budget('2001-06-01', '2001-06-30', (SELECT id FROM n1), 'GNF', 50)$$, '22023', NULL,
  'budget chevauchant le meme centre et la meme nature refuse');
CREATE TEMP TABLE c1 AS SELECT public.enregistrer_cout('2001-03-01', 'Pieces D-065', 600, 'GNF', p_categorie => '00000000-0000-4000-a650-0000000000b4') AS id;
CREATE TEMP TABLE c2 AS SELECT public.enregistrer_cout('2001-03-02', 'Divers D-065', 500, 'GNF') AS id;
SELECT is((SELECT realise_couts FROM public.v_suivi_budgets WHERE id = (SELECT id FROM b1)), 600::numeric,
  'realise : cout rattache par sa categorie, cout sans nature exclu');
SELECT public.imputer_depense('cout', (SELECT id FROM c2), (SELECT id FROM n1));
SELECT throws_ok($$SELECT public.imputer_depense('cout', (SELECT id FROM c2), (SELECT id FROM n1))$$, '22023', NULL, 'imputation identique refusee');
SELECT throws_ok($$SELECT public.imputer_depense('cout', (SELECT id FROM c2), (SELECT id FROM n2))$$, '22023', NULL, 'reimputation sans motif refusee');
SELECT public.imputer_depense('bon_commande', '00000000-0000-4000-a650-0000000000b3', (SELECT id FROM n1));
SELECT is((SELECT (engage_bons, realise_couts, disponible, depassement)::text FROM public.v_suivi_budgets WHERE id = (SELECT id FROM b1)),
  '(236.00,1100.00,-336.00,t)', 'engage = bon approuve, commande HT et taxes ; depassement signale sans blocage');
SELECT is((SELECT base_montant FROM public.v_depenses_budgetaires WHERE piece_id = '00000000-0000-4000-a650-0000000000b3'),
  'TTC (commande HT + taxes du bon)', 'base du montant explicite');
SELECT ok(EXISTS (SELECT 1 FROM public.mes_validations() WHERE objet = 'Budget dépassé' AND reference = (SELECT numero FROM public.budgets WHERE id = (SELECT id FROM b1))),
  'depassement dans mes validations');
SELECT throws_ok($$SELECT public.definir_budget('2001-01-01', '2001-12-31', (SELECT id FROM n1), 'GNF', 2000, p_remplace => (SELECT id FROM b1))$$,
  '22023', NULL, 'revision sans motif refusee');
CREATE TEMP TABLE b2 AS SELECT public.definir_budget('2001-01-01', '2001-12-31', (SELECT id FROM n1), 'GNF', 2000,
  p_remplace => (SELECT id FROM b1), p_motif => 'Rallonge approuvee') AS id;
SELECT is((SELECT string_agg(montant_ttc::text, ',') FROM public.v_suivi_budgets WHERE nature_id = (SELECT id FROM n1)), '2000.00',
  'la revision remplace le budget precedent');
SELECT throws_ok($$SELECT public.annuler_budget((SELECT id FROM b2), '')$$, '22023', NULL, 'annulation sans motif refusee');
RESET ROLE;
-- Bon recu : il passe de l'engagement de commande au reste a payer, sans double compte.
UPDATE public.purchase_order_items SET quantity_received = 10 WHERE purchase_order_id = '00000000-0000-4000-a650-0000000000b3';
UPDATE public.purchase_orders SET status = 'received' WHERE id = '00000000-0000-4000-a650-0000000000b3';
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT (engage_bons, engage_a_payer)::text FROM public.v_suivi_budgets WHERE id = (SELECT id FROM b2)), '(0,236.00)',
  'bon recu : engage au reste a payer TTC, plus en commande');
RESET ROLE;
-- Paiement execute : il passe du reste a payer au realise.
SELECT pg_temp.se_connecter(NULL);
INSERT INTO public.paiements_fournisseur (numero, purchase_order_id, beneficiaire, devise, objet, montant_propose, statut,
                                          execute_le, mode, reference_execution, montant_execute)
VALUES ('TEST-D065-PAY', '00000000-0000-4000-a650-0000000000b3', 'Fournisseur D-065', 'GNF', 'Filtres', 100, 'execute',
        '2001-05-02', 'virement', 'VIR-D065', 100);
INSERT INTO public.factures_fournisseur (id, contrat_id, numero_fournisseur, date_facture, periode_debut, periode_fin, devise,
                                         montant_ht_facture, montant_ttc_facture, statut) VALUES
  ('00000000-0000-4000-a650-0000000000f8', '00000000-0000-4000-a650-0000000000c2', 'D065-F2', '2001-10-02', '2001-09-01', '2001-09-30', 'USD', 500, NULL, 'conforme');
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT (engage_a_payer, realise_paiements)::text FROM public.v_suivi_budgets WHERE id = (SELECT id FROM b2)), '(136.00,100.00)',
  'paiement execute au realise, reste a payer diminue d''autant');
SELECT is((SELECT base_montant FROM public.v_depenses_budgetaires WHERE piece_id = '00000000-0000-4000-a650-0000000000f8'),
  'HT (TTC du loueur non saisi), reste a payer', 'facture du loueur sans TTC : base HT explicite');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000001');
SELECT throws_ok($$UPDATE public.budgets SET montant_ttc = 1 WHERE id = (SELECT id FROM b2)$$, '42501', NULL, 'budget fige (garde)');

-- Dettes et export comptable ---------------------------------------------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT du FROM public.v_dettes_fournisseurs WHERE piece_id = '00000000-0000-4000-a650-0000000000f2'), 1180::numeric,
  'dette : facture du loueur controlee non payee');
SELECT is((SELECT compte_tiers FROM public.ecritures_gestion('2001-01-01', '2001-12-31') WHERE piece = 'TEST-D065-FAC'), NULL::text,
  'compte de tiers vide tant qu''il n''est pas parametre');
SELECT is((SELECT count(*)::int FROM public.ecritures_gestion('2001-01-01', '2001-12-31') WHERE type_ecriture = 'cout'
  AND piece IN (SELECT numero FROM public.costs WHERE id IN ((SELECT id FROM c1), (SELECT id FROM c2)))), 2, 'couts de la periode exportes');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000002');
SET LOCAL ROLE authenticated;
SELECT public.definir_compte_tiers((SELECT id FROM cpt), p_contrat => '00000000-0000-4000-a650-0000000000c1');
SELECT is((SELECT compte_tiers FROM public.ecritures_gestion('2001-01-01', '2001-12-31') WHERE piece = 'TEST-D065-FAC'), 'TEST-411-D065',
  'compte de tiers parametre repris dans l''export');
SELECT public.definir_compte_tiers(NULL, p_contrat => '00000000-0000-4000-a650-0000000000c1');
SELECT is((SELECT count(*)::int FROM public.comptes_tiers WHERE contrat_id = '00000000-0000-4000-a650-0000000000c1' AND compte_id IS NULL), 1,
  'retrait du compte de tiers : ligne conservee, compte vide (aucune suppression)');
RESET ROLE;

-- Evaluation du loueur (grille D-059 reutilisee) --------------------------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.evaluer_loueur('00000000-0000-4000-a650-0000000000c2', '2001-11-01', '2001-11-30', '[]')$$, '22023', NULL,
  'evaluation impossible sans grille du loueur');
SELECT throws_ok($$SELECT public.definir_critere_loueur('Disponibilite', 2, 'disponibilite')$$, '42501', NULL, 'grille : administrateur seulement');
SELECT is((SELECT count(*)::int FROM public.mesures_loueur('00000000-0000-4000-a650-0000000000c2', '2001-11-01', '2001-11-30') WHERE valeur IS NULL), 4,
  'sans engin rattache ni intervention : sans donnees, rien d''estime');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000002');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE cr1 AS SELECT public.definir_critere_loueur('Disponibilite D-065', 2, 'disponibilite') AS id;
CREATE TEMP TABLE cr2 AS SELECT public.definir_critere_loueur('Reactivite D-065', 1) AS id;
SELECT throws_ok($$SELECT public.definir_critere_evaluation('Detourne', 1, p_id => (SELECT id FROM cr1))$$, '22023', NULL,
  'la grille fournisseurs ne modifie pas un critere du loueur');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.evaluer_loueur('00000000-0000-4000-a650-0000000000c1', '2001-11-01', '2001-11-30', '[]')$$, '22023', NULL,
  'un contrat client ne s''evalue pas comme loueur');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000005');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.evaluer_loueur('00000000-0000-4000-a650-0000000000c2', '2001-11-01', '2001-11-30',
  jsonb_build_array(jsonb_build_object('critere', (SELECT id FROM cr1), 'note', 4), jsonb_build_object('critere', (SELECT id FROM cr2), 'note', 1)))$$,
  '42501', NULL, 'evaluation du loueur refusee a un profil borne a un site (mesures de tous les sites)');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE ev1 AS SELECT public.evaluer_loueur('00000000-0000-4000-a650-0000000000c2', '2001-11-01', '2001-11-30',
  jsonb_build_array(jsonb_build_object('critere', (SELECT id FROM cr1), 'note', 4), jsonb_build_object('critere', (SELECT id FROM cr2), 'note', 1))) AS id;
SELECT is((SELECT (note_globale, jsonb_array_length(mesures))::text FROM public.evaluations_fournisseurs WHERE id = (SELECT id FROM ev1)), '(3.00,4)',
  'note ponderee calculee, mesures de la periode figees');
SELECT is((SELECT count(*)::int FROM public.v_evaluations_fournisseurs_courantes WHERE id = (SELECT id FROM ev1)), 0,
  'evaluation du loueur absente de la vue des fournisseurs');
SELECT throws_ok($$SELECT public.evaluer_loueur('00000000-0000-4000-a650-0000000000c2', '2001-11-01', '2001-11-30',
  jsonb_build_array(jsonb_build_object('critere', (SELECT id FROM cr1), 'note', 5), jsonb_build_object('critere', (SELECT id FROM cr2), 'note', 5)))$$,
  '22023', NULL, 'periode deja evaluee : motif exige');
SELECT throws_ok($$SELECT public.evaluer_fournisseur('00000000-0000-4000-a650-0000000000b1', '2001-11-01', '2001-11-30',
  jsonb_build_array(jsonb_build_object('critere', (SELECT id FROM cr1), 'note', 4), jsonb_build_object('critere', (SELECT id FROM cr2), 'note', 4)))$$,
  '22023', NULL, 'la grille fournisseurs ignore les criteres du loueur');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000001');
SELECT throws_ok($$UPDATE public.evaluations_fournisseurs SET note_globale = 1 WHERE id = (SELECT id FROM ev1)$$, '42501', NULL,
  'evaluation du loueur non modifiable (garde)');

-- R1 (contre-revue) : seul un calcul propose ou applique couvre une periode.
INSERT INTO public.rapports_performance (id, contrat_id, periode_debut, periode_fin, contenu, statut, remis_le, remis_a)
SELECT x.id::uuid, '00000000-0000-4000-a650-0000000000c2', x.debut::date, x.fin::date,
       jsonb_build_object('engagements', jsonb_build_array(jsonb_build_object('engagement_id', '00000000-0000-4000-a650-0000000000e3',
         'indicateur', 'disponibilite', 'seuil', 85, 'unite', '%', 'sens', 'minimum', 'realise', CASE WHEN x.tenu THEN 90 ELSE 70 END,
         'echantillon', 3, 'conforme', x.tenu))), 'remis', x.fin::date + 5, 'Loueur'
  FROM (VALUES ('00000000-0000-4000-a650-0000000002a1', '2002-01-01', '2002-01-31', false),
               ('00000000-0000-4000-a650-0000000002a2', '2002-01-15', '2002-02-14', false),
               ('00000000-0000-4000-a650-0000000002a3', '2002-02-01', '2002-02-28', false),
               ('00000000-0000-4000-a650-0000000002a4', '2002-04-01', '2002-04-30', true),
               ('00000000-0000-4000-a650-0000000002a5', '2002-04-15', '2002-05-14', false)) AS x(id, debut, fin, tenu);
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE k7 AS SELECT public.definir_clause('00000000-0000-4000-a650-0000000000d2', 'penalite', 'Penalite chaine R1',
  '00000000-0000-4000-a650-0000000000e3', 'non_tenu', 'montant', 1000) AS id;
SELECT public.calculer_clauses(x.id::uuid)
  FROM unnest(ARRAY['00000000-0000-4000-a650-0000000002a1', '00000000-0000-4000-a650-0000000002a2', '00000000-0000-4000-a650-0000000002a3',
                    '00000000-0000-4000-a650-0000000002a4', '00000000-0000-4000-a650-0000000002a5']) WITH ORDINALITY AS x(id, n)
 ORDER BY x.n;
SELECT is((SELECT string_agg(to_char(periode_debut, 'MM-DD') || ':' || statut, ',' ORDER BY periode_debut, periode_fin)
             FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k7)),
  '01-01:propose,01-15:sans_objet,02-01:propose,04-01:sans_objet,04-15:propose',
  'janvier propose, mi-janvier couvert, fevrier non tenu propose ; avril tenu sans objet, mi-avril non tenu propose');

-- R2 (contre-revue) : clause saisie sur un contrat en brouillon, refusee sur un contrat clos.
RESET ROLE;
INSERT INTO public.contrats (id, reference, intitule, nature, contrepartie, devise, date_debut, statut) VALUES
  ('00000000-0000-4000-a650-0000000000c3', 'TEST-D065-BROUILLON', 'Contrat en preparation', 'client', 'Client D-065', 'USD', '2001-01-01', 'brouillon'),
  ('00000000-0000-4000-a650-0000000000c4', 'TEST-D065-CLOS', 'Contrat clos', 'client', 'Client D-065', 'USD', '2001-01-01', 'clos');
INSERT INTO public.contrat_versions (id, contrat_id, numero, intitule, date_effet) VALUES
  ('00000000-0000-4000-a650-0000000000d3', '00000000-0000-4000-a650-0000000000c3', 0, 'Initial', '2001-01-01'),
  ('00000000-0000-4000-a650-0000000000d4', '00000000-0000-4000-a650-0000000000c4', 0, 'Initial', '2001-01-01');
INSERT INTO public.contrat_engagements (id, version_id, indicateur, libelle, seuil, unite, sens, periodicite) VALUES
  ('00000000-0000-4000-a650-0000000000e5', '00000000-0000-4000-a650-0000000000d3', 'disponibilite', 'Disponibilite', 90, '%', 'minimum', 'mois'),
  ('00000000-0000-4000-a650-0000000000e6', '00000000-0000-4000-a650-0000000000d4', 'disponibilite', 'Disponibilite', 90, '%', 'minimum', 'mois');
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000001');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.definir_clause('00000000-0000-4000-a650-0000000000d3', 'penalite', 'Clause en preparation',
  '00000000-0000-4000-a650-0000000000e5', 'non_tenu', 'montant', 10)$$, 'clause saisie sur un contrat en brouillon');
SELECT throws_ok($$SELECT public.definir_clause('00000000-0000-4000-a650-0000000000d4', 'penalite', 'Clause tardive',
  '00000000-0000-4000-a650-0000000000e6', 'non_tenu', 'montant', 10)$$, '22023', NULL, 'clause refusee sur un contrat clos');

-- R4 : contrat en brouillon : clause saisie, mais ni rapport, ni calcul, ni
-- application ; contrat clos : un mois anterieur a la cloture reste du.
SELECT throws_ok($$SELECT public.generer_rapport_performance('00000000-0000-4000-a650-0000000000c3', '2001-03-01', '2001-03-31')$$,
  '22023', NULL, 'contrat en brouillon : aucun rapport de performance genere');
RESET ROLE;
INSERT INTO public.rapports_performance (id, contrat_id, periode_debut, periode_fin, contenu, statut, remis_le, remis_a) VALUES
  ('00000000-0000-4000-a650-0000000003a1', '00000000-0000-4000-a650-0000000000c3', '2001-03-01', '2001-03-31',
   '{"engagements": [{"engagement_id": "00000000-0000-4000-a650-0000000000e5", "conforme": false}]}', 'brouillon', NULL, NULL),
  ('00000000-0000-4000-a650-0000000003a2', '00000000-0000-4000-a650-0000000000c3', '2001-04-01', '2001-04-30',
   '{"engagements": [{"engagement_id": "00000000-0000-4000-a650-0000000000e5", "conforme": false}]}', 'remis', '2001-05-05', 'Client');
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.marquer_rapport_remis('00000000-0000-4000-a650-0000000003a1', '2001-04-05', 'Client')$$,
  '22023', NULL, 'contrat en brouillon : le rapport ne se remet pas');
SELECT throws_ok($$SELECT public.calculer_clauses('00000000-0000-4000-a650-0000000003a2')$$, '22023', NULL,
  'contrat en brouillon : aucune clause calculee');
RESET ROLE;
-- Un calcul anterieur (fixture) sur un contrat repasse en brouillon : decision refusee.
INSERT INTO public.calculs_clauses (id, clause_id, rapport_id, contrat_id, periode_debut, periode_fin, type_clause, libelle, base, valeur,
                                    montant_calcule_ht, montant_propose_ht, devise, statut)
SELECT '00000000-0000-4000-a650-0000000004c1', k.id, '00000000-0000-4000-a650-0000000003a2', '00000000-0000-4000-a650-0000000000c3',
       '2001-04-01', '2001-04-30', 'penalite', k.libelle, 'montant', 10, 10, 10, 'USD', 'propose'
  FROM public.contrat_clauses k WHERE k.version_id = '00000000-0000-4000-a650-0000000000d3';
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.decider_clause('00000000-0000-4000-a650-0000000004c1', true, 'Due', p_taux_taxe => 0)$$, '22023', NULL,
  'contrat en brouillon : aucune clause appliquee');
RESET ROLE;
-- Contrat clos : clause et rapport anterieurs a la cloture, toujours calculables et applicables.
INSERT INTO public.contrat_clauses (id, version_id, type_clause, libelle, engagement_id, declenchement, base, valeur)
VALUES ('00000000-0000-4000-a650-0000000004c2', '00000000-0000-4000-a650-0000000000d4', 'bonus', 'Clause avant cloture',
        '00000000-0000-4000-a650-0000000000e6', 'tenu', 'montant', 40);
INSERT INTO public.rapports_performance (id, contrat_id, periode_debut, periode_fin, contenu, statut, remis_le, remis_a) VALUES
  ('00000000-0000-4000-a650-0000000003a3', '00000000-0000-4000-a650-0000000000c4', '2001-04-01', '2001-04-30',
   '{"engagements": [{"engagement_id": "00000000-0000-4000-a650-0000000000e6", "conforme": true}]}', 'remis', '2001-05-05', 'Client');
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000001');
SET LOCAL ROLE authenticated;
SELECT is(public.calculer_clauses('00000000-0000-4000-a650-0000000003a3'), 1, 'contrat clos : mois anterieur a la cloture calcule');
CREATE TEMP TABLE fclos AS SELECT public.decider_clause(
  (SELECT id FROM public.calculs_clauses WHERE clause_id = '00000000-0000-4000-a650-0000000004c2'), true, 'Du avant cloture', p_taux_taxe => 0) AS id;
SELECT is((SELECT (type, statut, montant_ht)::text FROM public.factures WHERE id = (SELECT id FROM fclos)),
  '(facture,brouillon,40.00)', 'contrat clos : bonus anterieur applique (facture brouillon)');

-- R3 (contre-revue) : une facture de penalite du loueur ne compte pas comme facture CBG.
CREATE TEMP TABLE ind_avant AS SELECT factures_emises FROM public.indicateurs_charge_contrats();
RESET ROLE;
INSERT INTO public.factures (id, numero, type, contrat_id, objet, periode_debut, periode_fin, devise, taux_taxe_pct, montant_ht, montant_taxe,
                             montant_ttc, statut, date_emission) VALUES
  ('00000000-0000-4000-a650-0000000000f9', 'TEST-D065-FAC-DEC', 'facture', '00000000-0000-4000-a650-0000000000c1', 'Transport decembre',
   '2001-12-01', '2001-12-31', 'USD', 0, 100, 0, 100, 'emise', current_date),
  ('00000000-0000-4000-a650-0000000000fa', 'TEST-D065-PEN-DEC', 'facture', '00000000-0000-4000-a650-0000000000c2', 'Penalite du loueur',
   '2001-12-01', '2001-12-31', 'USD', 0, 777, 0, 777, 'emise', current_date);
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT valeur FROM public.rapport_client('2001-12-01', '2001-12-31') WHERE indicateur = 'Montant HT facturé (USD)'), 100::numeric,
  'rapport client : facture de penalite du loueur exclue');
SELECT is((SELECT factures_emises FROM public.indicateurs_charge_contrats()) - (SELECT factures_emises FROM ind_avant), 1,
  'indicateurs du poste : seule la facture du contrat client est comptee');
SELECT ok(EXISTS (SELECT 1 FROM public.v_creances WHERE id = '00000000-0000-4000-a650-0000000000fa'),
  'la facture de penalite du loueur reste une creance suivie');
RESET ROLE;

-- Droits (D-072 : un droit retire se verifie par has_*_privilege) -----------------------
SELECT is((SELECT bool_or(has_table_privilege(r, 'public.' || t, p))
             FROM unnest(ARRAY['anon', 'authenticated']) r,
                  unnest(ARRAY['contrats_echeances', 'contrat_clauses', 'calculs_clauses', 'plan_comptable', 'natures_depense',
                               'comptes_tiers', 'imputations_budgetaires', 'budgets', 'calculs_clauses_journal']) t,
                  unnest(ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p), false,
  'aucune ecriture directe, ni DELETE ni TRUNCATE, sur les tables du lot');
SELECT is((SELECT bool_or(has_table_privilege('anon', 'public.' || t, 'SELECT'))
             FROM unnest(ARRAY['contrats_echeances', 'contrat_clauses', 'calculs_clauses', 'plan_comptable', 'natures_depense',
                               'comptes_tiers', 'imputations_budgetaires', 'budgets', 'v_echeances_contrats', 'v_suivi_budgets',
                               'v_depenses_budgetaires', 'v_dettes_fournisseurs', 'v_evaluations_loueur_courantes']) t), false,
  'tables et vues du lot illisibles par anon');
SELECT is((SELECT count(*)::int FROM pg_class c
            WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
              AND c.relname IN ('contrats_echeances', 'contrat_clauses', 'calculs_clauses', 'plan_comptable', 'natures_depense',
                                'comptes_tiers', 'imputations_budgetaires', 'budgets', 'calculs_clauses_journal')
              AND c.relrowsecurity
              AND EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname AND p.cmd = 'SELECT'
                            AND p.qual <> 'true')), 9,
  'RLS active et politique de lecture bornee sur les neuf tables');
SELECT is((SELECT bool_or(has_sequence_privilege(r, 'public.budgets_numero_seq', p))
             FROM unnest(ARRAY['anon', 'authenticated']) r, unnest(ARRAY['USAGE', 'SELECT', 'UPDATE']) p), false,
  'sequence des budgets fermee aux comptes');
SELECT is((SELECT bool_or(has_function_privilege('authenticated', f, 'EXECUTE')) FROM unnest(ARRAY[
    'public.garde_append_only_finance()', 'public.garde_budget()', 'public.garde_calcul_clause()',
    'public.rouvrir_clauses_facture_annulee()']) f), false,
  'gardes non executables par les comptes');
SELECT is((SELECT bool_or(has_function_privilege('anon', f, 'EXECUTE')) FROM unnest(ARRAY[
    'public.enregistrer_echeance_contrat(uuid, text, date, text, date, text)',
    'public.definir_clause(uuid, text, text, uuid, text, text, numeric, numeric, text, integer, uuid)',
    'public.calculer_clauses(uuid)', 'public.decider_clause(uuid, boolean, text, uuid, numeric)',
    'public.definir_budget(date, date, uuid, text, numeric, uuid, text, uuid, text)', 'public.annuler_budget(uuid, text)',
    'public.imputer_depense(text, uuid, uuid, text)', 'public.definir_compte_tiers(uuid, uuid, uuid)',
    'public.ecritures_gestion(date, date)', 'public.mesures_loueur(uuid, date, date)', 'public.evaluer_loueur(uuid, date, date, jsonb, text, text)',
    'public.delai_alerte_echeances_contrats()', 'public.mes_validations()', 'public.creer_avoir(uuid, numeric, text)',
    'public.est_facture_client(uuid)', 'public.rapport_client(date, date, uuid)', 'public.indicateurs_charge_contrats()']) f), false,
  'aucune fonction du lot executable par anon');
SELECT is((SELECT bool_and(p.prosecdef AND p.proconfig @> ARRAY['search_path=""'])
             FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
              AND p.proname IN ('enregistrer_echeance_contrat', 'definir_clause', 'desactiver_clause', 'calculer_clauses', 'decider_clause',
                                'definir_compte_comptable', 'definir_nature_depense', 'associer_categorie_cout', 'definir_compte_tiers',
                                'imputer_depense', 'definir_budget', 'annuler_budget', 'definir_critere_loueur', 'evaluer_loueur',
                                'evaluer_fournisseur', 'definir_critere_evaluation', 'creer_avoir', 'rouvrir_clauses_facture_annulee')),
  true, 'ecritures en SECURITY DEFINER a search_path vide');

SELECT * FROM finish();
ROLLBACK;
