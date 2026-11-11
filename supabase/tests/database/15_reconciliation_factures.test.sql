-- Tests (D-029) : reconciliation mensuelle, decisions, cloture, facture au
-- tarif du contrat, signature par le Directeur seulement, emission
-- numerotee, avoir (migration 20261111120000). Tout est annule.
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

SELECT plan(24);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8f00-000000000001', 'contrats.rec@exemple.invalid'),
  ('00000000-0000-4000-8f00-000000000002', 'dg.rec@exemple.invalid'),
  ('00000000-0000-4000-8f00-000000000003', 'chauffeur.rec@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status) VALUES
  ('00000000-0000-4000-8f00-000000000001', 'contract_manager', 'Charge rec', 'active'),
  ('00000000-0000-4000-8f00-000000000002', 'director', 'Directeur general', 'active'),
  ('00000000-0000-4000-8f00-000000000003', 'driver', 'Chauffeur rec', 'active')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-8f00-0000000000a1', 'Mine rec', 'mine'),
  ('00000000-0000-4000-8f00-0000000000a2', 'Stock rec', 'depot');
INSERT INTO public.contrats (id, reference, intitule, nature, contrepartie, devise, date_debut, statut, delai_paiement_jours)
VALUES ('00000000-0000-4000-8f00-0000000000c1', 'TEST-REC-CBG', 'Transport de bauxite', 'client', 'CBG', 'USD', '2026-01-01', 'actif', 30);
INSERT INTO public.contrat_versions (id, contrat_id, numero, intitule, date_effet)
VALUES ('00000000-0000-4000-8f00-0000000000e1', '00000000-0000-4000-8f00-0000000000c1', 0, 'Contrat initial', '2026-01-01');
INSERT INTO public.contrat_tarifs (version_id, libelle, unite, prix)
VALUES ('00000000-0000-4000-8f00-0000000000e1', 'Transport mine - stock', 'tonne', 5);

-- Voyages de reference (hors session) : periode = mois courant
CREATE TEMP TABLE p AS SELECT date_trunc('month', current_date)::date AS debut,
  (date_trunc('month', current_date) + interval '1 month - 1 day')::date AS fin;
GRANT SELECT ON p TO authenticated;
SELECT pg_temp.se_connecter(NULL);
INSERT INTO public.trips (id, reference, planned_date, departure_site_id, arrival_site_id, etat, net_weight, net_weight_reception, accepted_tonnage) VALUES
  ('00000000-0000-4000-8f00-000000000101', 'TREC-1', (SELECT debut FROM p), '00000000-0000-4000-8f00-0000000000a1', '00000000-0000-4000-8f00-0000000000a2', 'ACCEPTED', 40, 40, 40),
  ('00000000-0000-4000-8f00-000000000102', 'TREC-2', (SELECT debut FROM p), '00000000-0000-4000-8f00-0000000000a1', '00000000-0000-4000-8f00-0000000000a2', 'ACCEPTED', 40, 37, 37),
  ('00000000-0000-4000-8f00-000000000103', 'TREC-3', (SELECT debut FROM p), '00000000-0000-4000-8f00-0000000000a1', '00000000-0000-4000-8f00-0000000000a2', 'DISPUTED', 41, 41, NULL),
  ('00000000-0000-4000-8f00-000000000104', 'TREC-4', (SELECT debut FROM p), '00000000-0000-4000-8f00-0000000000a1', '00000000-0000-4000-8f00-0000000000a2', 'DELIVERED', 39, 39, NULL),
  ('00000000-0000-4000-8f00-000000000105', 'TREC-5', (SELECT debut FROM p), '00000000-0000-4000-8f00-0000000000a1', '00000000-0000-4000-8f00-0000000000a2', 'IN_TRANSIT', 40, NULL, NULL),
  ('00000000-0000-4000-8f00-000000000106', 'TREC-6', (SELECT debut FROM p) - 1, '00000000-0000-4000-8f00-0000000000a1', '00000000-0000-4000-8f00-0000000000a2', 'ACCEPTED', 40, 40, 40);

SELECT pg_temp.se_connecter('00000000-0000-4000-8f00-000000000001');
SET LOCAL ROLE authenticated;

SELECT throws_ok($$SELECT public.ouvrir_reconciliation('00000000-0000-4000-8f00-0000000000c1', (SELECT debut FROM p), (SELECT fin FROM p), NULL, 2,
  '00000000-0000-4000-8f00-0000000000a1')$$, '22023', NULL, 'base de tonnage exigee');
CREATE TEMP TABLE r AS SELECT public.ouvrir_reconciliation('00000000-0000-4000-8f00-0000000000c1', (SELECT debut FROM p), (SELECT fin FROM p),
  'accepte', 2, '00000000-0000-4000-8f00-0000000000a1') AS id;
SELECT is((SELECT count(*)::int FROM public.reconciliation_lignes WHERE reconciliation_id = (SELECT id FROM r)), 4,
  'voyages livres de la periode et du trajet seulement');
SELECT is((SELECT anomalies FROM public.reconciliation_lignes WHERE reference = 'TREC-2'), ARRAY['ecart_hors_tolerance', 'sans_fiche'],
  'ecart charge / recu au-dela de la tolerance signale');
SELECT ok((SELECT anomalies @> ARRAY['litige', 'base_absente'] FROM public.reconciliation_lignes WHERE reference = 'TREC-3'), 'litige signale');
SELECT ok((SELECT anomalies @> ARRAY['non_accepte'] FROM public.reconciliation_lignes WHERE reference = 'TREC-4'), 'livre non accepte signale');

SELECT throws_ok($$SELECT public.cloturer_reconciliation((SELECT id FROM r))$$, '22023', NULL, 'cloture refusee : lignes a examiner');
SELECT throws_ok($$SELECT public.decider_ligne_reconciliation((SELECT id FROM public.reconciliation_lignes WHERE reference = 'TREC-2'), 'facturable', NULL)$$,
  '22023', NULL, 'decision sans motif refusee');
SELECT lives_ok($$SELECT public.decider_ligne_reconciliation((SELECT id FROM public.reconciliation_lignes WHERE reference = 'TREC-2'), 'facturable',
  'Ecart explique : tare du pont de reception verifiee')$$, 'ligne declaree facturable');
SELECT throws_ok($$SELECT public.decider_ligne_reconciliation((SELECT id FROM public.reconciliation_lignes WHERE reference = 'TREC-3'), 'facturable', 'x')$$,
  '22023', NULL, 'sans tonnage de base : pas facturable');
SELECT lives_ok($$SELECT public.decider_ligne_reconciliation((SELECT id FROM public.reconciliation_lignes WHERE reference = 'TREC-3'), 'exclue', 'Litige en cours avec CBG')$$, 'litige exclu');
SELECT lives_ok($$SELECT public.decider_ligne_reconciliation((SELECT id FROM public.reconciliation_lignes WHERE reference = 'TREC-4'), 'exclue', 'Acceptation attendue')$$, 'non accepte exclu');
SELECT lives_ok($$SELECT public.cloturer_reconciliation((SELECT id FROM r))$$, 'reconciliation cloturee');
SELECT is((SELECT (tonnage_facturable, voyages_facturables)::text FROM public.reconciliations WHERE id = (SELECT id FROM r)), '(77,2)',
  'tonnage facturable fige a la cloture');
SELECT throws_ok($$SELECT public.ouvrir_reconciliation('00000000-0000-4000-8f00-0000000000c1', (SELECT debut FROM p), (SELECT fin FROM p),
  'accepte', 2, '00000000-0000-4000-8f00-0000000000a1')$$, '22023', NULL, 'periode deja reconciliee');

CREATE TEMP TABLE f AS SELECT public.generer_facture((SELECT id FROM r), 18) AS id;
SELECT is((SELECT (montant_ht, montant_taxe, montant_ttc)::text FROM public.factures WHERE id = (SELECT id FROM f)), '(385.00,69.30,454.30)',
  'facture au tarif du contrat, taxe saisie');
SELECT is(public.avancer_facture((SELECT id FROM f), 'soumettre'), 'a_signer', 'facture soumise au Directeur');
SELECT throws_ok($$SELECT public.avancer_facture((SELECT id FROM f), 'signer')$$, '42501', NULL, 'le charge de contrats ne signe pas');
SELECT throws_ok($$UPDATE public.factures SET statut = 'emise' WHERE id = (SELECT id FROM f)$$, '42501', NULL, 'aucune modification directe');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-8f00-000000000002');
SET LOCAL ROLE authenticated;
SELECT is(public.avancer_facture((SELECT id FROM f), 'signer'), 'signee', 'le Directeur General signe');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-8f00-000000000001');
SET LOCAL ROLE authenticated;
SELECT is(public.avancer_facture((SELECT id FROM f), 'emettre'), 'emise', 'facture emise');
SELECT ok((SELECT numero ~ '^FAC-\d{4}-\d{4}$' AND date_echeance = date_emission + 30 FROM public.factures WHERE id = (SELECT id FROM f)),
  'numero definitif et echeance a l''emission');
CREATE TEMP TABLE a AS SELECT public.creer_avoir((SELECT id FROM f), 50, 'Tonnage conteste sur TREC-2') AS id;
SELECT is((SELECT (type, montant_ht, statut)::text FROM public.factures WHERE id = (SELECT id FROM a)), '(avoir,-50,brouillon)',
  'avoir en brouillon, montant deduit');
SELECT is((SELECT count(*)::int FROM public.factures_journal WHERE facture_id = (SELECT id FROM f)), 4, 'chaque action journalisee');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-8f00-000000000003');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.generer_facture((SELECT id FROM r), 18)$$, '42501', NULL, 'un chauffeur ne genere pas de facture');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
