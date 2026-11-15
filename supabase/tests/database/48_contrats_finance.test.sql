-- Tests (D-065) : clauses chiffrees calculees depuis le rapport remis et
-- appliquees par decision motivee (avoir ou facture D-029), echeances et
-- alertes, budgets (engage, realise, depassement, revision), dettes, export
-- comptable, evaluation du loueur sur la grille D-059
-- (migration 20261119150000). Periodes de 2001, vides en production. Tout
-- est annule.
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

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a650-000000000001', 'contrats.d065@exemple.invalid'),
  ('00000000-0000-4000-a650-000000000002', 'admin.d065@exemple.invalid'),
  ('00000000-0000-4000-a650-000000000003', 'chauffeur.d065@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-a650-000000000001', 'contract_manager', 'Charge D-065', 'active', NULL),
  ('00000000-0000-4000-a650-000000000002', 'admin', 'Admin D-065', 'active', NULL),
  ('00000000-0000-4000-a650-000000000003', 'driver', 'Chauffeur D-065', 'active', NULL)
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
   'remis', '2001-12-05', 'Loueur');
INSERT INTO public.factures (id, numero, type, contrat_id, objet, periode_debut, periode_fin, devise, taux_taxe_pct, montant_ht, montant_taxe,
                             montant_ttc, statut, date_emission) VALUES
  ('00000000-0000-4000-a650-0000000000f1', 'TEST-D065-FAC', 'facture', '00000000-0000-4000-a650-0000000000c1', 'Transport novembre',
   '2001-11-01', '2001-11-30', 'USD', 0, 10000, 0, 10000, 'emise', '2001-12-01');
INSERT INTO public.factures_fournisseur (id, contrat_id, numero_fournisseur, date_facture, periode_debut, periode_fin, devise,
                                         montant_ht_facture, montant_ttc_facture, statut) VALUES
  ('00000000-0000-4000-a650-0000000000f2', '00000000-0000-4000-a650-0000000000c2', 'D065-F1', '2001-12-02', '2001-11-01', '2001-11-30', 'USD', 1000, 1180, 'conforme');
INSERT INTO public.suppliers (id, supplier_number, supplier_type, company_name) VALUES
  ('00000000-0000-4000-a650-0000000000b1', 'TEST-F-D065', 'parts', 'Fournisseur D-065');
INSERT INTO public.warehouses (id, name, code, warehouse_type, site_id) VALUES
  ('00000000-0000-4000-a650-0000000000b2', 'Magasin D-065', 'TEST-MAG-D065', 'main', NULL);
INSERT INTO public.purchase_orders (id, po_number, po_date, supplier_id, warehouse_id, status) VALUES
  ('00000000-0000-4000-a650-0000000000b3', 'TEST-D065-BC', '2001-04-01', '00000000-0000-4000-a650-0000000000b1',
   '00000000-0000-4000-a650-0000000000b2', 'approved');
INSERT INTO public.purchase_order_items (purchase_order_id, item_description, quantity, unit_price, total_price, quantity_received) VALUES
  ('00000000-0000-4000-a650-0000000000b3', 'Filtres', 10, 20, 200, 4);
INSERT INTO public.cost_categories (id, name, category_type) VALUES ('00000000-0000-4000-a650-0000000000b4', 'Pieces D-065', 'variable');
DELETE FROM public.settings WHERE key = 'contrats_alerte_echeance_jours';
UPDATE public.criteres_evaluation_fournisseur SET actif = false;

-- Clauses chiffrees
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
CREATE TEMP TABLE k1 AS SELECT public.definir_clause('00000000-0000-4000-a650-0000000000d1', 'penalite', 'Penalite disponibilite',
  '00000000-0000-4000-a650-0000000000e1', 'non_tenu', 'taux', 5, p_plafond => 300) AS id;
SELECT is((SELECT count(*)::int FROM public.journal_contrats WHERE table_cible = 'contrat_clauses' AND ligne_id = (SELECT id FROM k1)), 1,
  'clause journalisee au dossier contractuel');
SELECT throws_ok($$SELECT public.calculer_clauses('00000000-0000-4000-a650-0000000000a2')$$, '22023', NULL, 'rapport non remis : pas de calcul');
SELECT is(public.calculer_clauses('00000000-0000-4000-a650-0000000000a1'), 1, 'une proposition calculee depuis le rapport remis');
SELECT is((SELECT (statut, assiette, montant_calcule, montant_propose)::text FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k1)),
  '(propose,10000,500.00,300)', 'taux applique a l''assiette des factures, ramene au plafond');
SELECT is(public.calculer_clauses('00000000-0000-4000-a650-0000000000a1'), 0, 'pas de second calcul pour le meme rapport');
SELECT throws_ok($$SELECT public.decider_clause((SELECT id FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k1)), true, ' ')$$,
  '22023', NULL, 'decision sans motif refusee');
SELECT throws_ok($$SELECT public.decider_clause((SELECT id FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k1)), true, 'Penalite due')$$,
  '22023', NULL, 'deduction sans facture du contrat refusee');
CREATE TEMP TABLE av AS SELECT public.decider_clause((SELECT id FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k1)), true,
  'Penalite due selon l''avenant', '00000000-0000-4000-a650-0000000000f1') AS id;
SELECT is((SELECT (type, statut, montant_ht)::text FROM public.factures WHERE id = (SELECT id FROM av)), '(avoir,brouillon,-300)',
  'avoir brouillon produit par creer_avoir (circuit D-029)');
SELECT is((SELECT statut FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k1) AND facture_id = (SELECT id FROM av)), 'applique',
  'proposition appliquee, rattachee a l''avoir');
SELECT throws_ok($$SELECT public.decider_clause((SELECT id FROM public.calculs_clauses WHERE clause_id = (SELECT id FROM k1)), false, 'Revu')$$,
  '22023', NULL, 'une proposition appliquee ne se decide plus');
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
SELECT is((SELECT (type, statut, contrat_id::text, montant_ht)::text FROM public.factures WHERE id = (SELECT id FROM f2)),
  '(facture,brouillon,00000000-0000-4000-a650-0000000000c2,1000)', 'penalite du loueur : facture brouillon au circuit de signature');
RESET ROLE;

-- Echeances et alertes
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
SELECT ok(EXISTS (SELECT 1 FROM public.mes_validations() WHERE objet = 'Clause contractuelle à décider'), 'clause proposee dans mes validations');
SELECT throws_ok($$SELECT public.enregistrer_echeance_contrat('00000000-0000-4000-a650-0000000000c1', 'renouvellement', current_date, 'Avenant',
  current_date)$$, '22023', NULL, 'renouvellement : nouvelle fin posterieure exigee');
SELECT public.enregistrer_echeance_contrat('00000000-0000-4000-a650-0000000000c1', 'renouvellement', current_date, 'Avenant n 1 signe',
  current_date + 400);
SELECT is((SELECT date_fin - current_date FROM public.contrats WHERE id = '00000000-0000-4000-a650-0000000000c1'), 400,
  'renouvellement : nouvelle date de fin enregistree');
SELECT ok(NOT coalesce((SELECT a_signaler FROM public.v_echeances_contrats WHERE contrat_id = '00000000-0000-4000-a650-0000000000c1'), false),
  'plus d''alerte apres le renouvellement');
SELECT throws_ok($$DELETE FROM public.contrats_echeances WHERE contrat_id = '00000000-0000-4000-a650-0000000000c1'$$, '42501', NULL,
  'evenement d''echeance non supprimable');
RESET ROLE;

-- Referentiels administrateur et budgets
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
  '(120,1100,-220,t)', 'engage = reliquat du bon approuve ; depassement signale sans blocage');
SELECT ok(EXISTS (SELECT 1 FROM public.mes_validations() WHERE objet = 'Budget dépassé' AND reference = (SELECT numero FROM public.budgets WHERE id = (SELECT id FROM b1))),
  'depassement dans mes validations');
SELECT throws_ok($$SELECT public.definir_budget('2001-01-01', '2001-12-31', (SELECT id FROM n1), 'GNF', 2000, p_remplace => (SELECT id FROM b1))$$,
  '22023', NULL, 'revision sans motif refusee');
CREATE TEMP TABLE b2 AS SELECT public.definir_budget('2001-01-01', '2001-12-31', (SELECT id FROM n1), 'GNF', 2000,
  p_remplace => (SELECT id FROM b1), p_motif => 'Rallonge approuvee') AS id;
SELECT is((SELECT string_agg(montant::text, ',') FROM public.v_suivi_budgets WHERE nature_id = (SELECT id FROM n1)), '2000',
  'la revision remplace le budget precedent');
SELECT throws_ok($$UPDATE public.budgets SET montant = 1 WHERE id = (SELECT id FROM b2)$$, '42501', NULL, 'budget non modifiable hors fonction');
SELECT throws_ok($$SELECT public.annuler_budget((SELECT id FROM b2), '')$$, '22023', NULL, 'annulation sans motif refusee');

-- Dettes et export comptable
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
RESET ROLE;

-- Evaluation du loueur (grille D-059 reutilisee)
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
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a650-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.evaluer_loueur('00000000-0000-4000-a650-0000000000c1', '2001-11-01', '2001-11-30', '[]')$$, '22023', NULL,
  'un contrat client ne s''evalue pas comme loueur');
CREATE TEMP TABLE ev1 AS SELECT public.evaluer_loueur('00000000-0000-4000-a650-0000000000c2', '2001-11-01', '2001-11-30',
  jsonb_build_array(jsonb_build_object('critere', (SELECT id FROM cr1), 'note', 4), jsonb_build_object('critere', (SELECT id FROM cr2), 'note', 1))) AS id;
SELECT is((SELECT (note_globale, jsonb_array_length(mesures))::text FROM public.evaluations_fournisseurs WHERE id = (SELECT id FROM ev1)), '(3.00,4)',
  'note ponderee calculee, mesures de la periode figees');
SELECT throws_ok($$SELECT public.evaluer_loueur('00000000-0000-4000-a650-0000000000c2', '2001-11-01', '2001-11-30',
  jsonb_build_array(jsonb_build_object('critere', (SELECT id FROM cr1), 'note', 5), jsonb_build_object('critere', (SELECT id FROM cr2), 'note', 5)))$$,
  '22023', NULL, 'periode deja evaluee : motif exige');
SELECT throws_ok($$UPDATE public.evaluations_fournisseurs SET note_globale = 1 WHERE id = (SELECT id FROM ev1)$$, '42501', NULL,
  'evaluation du loueur non modifiable');
SELECT throws_ok($$SELECT public.evaluer_fournisseur('00000000-0000-4000-a650-0000000000b1', '2001-11-01', '2001-11-30',
  jsonb_build_array(jsonb_build_object('critere', (SELECT id FROM cr1), 'note', 4), jsonb_build_object('critere', (SELECT id FROM cr2), 'note', 4)))$$,
  '22023', NULL, 'la grille fournisseurs ignore les criteres du loueur');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
