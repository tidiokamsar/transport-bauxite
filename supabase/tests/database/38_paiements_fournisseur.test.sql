-- Tests (D-055) : bon a payer plafonne au reste a payer, approbation par
-- une autre personne, execution avec reference, controle a posteriori
-- (migration 20261117150000). Tout est annule.
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

SELECT plan(14);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a500-000000000001', 'comptable.a.d055@exemple.invalid'),
  ('00000000-0000-4000-a500-000000000002', 'comptable.b.d055@exemple.invalid'),
  ('00000000-0000-4000-a500-000000000003', 'chauffeur.d055@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-a500-000000000001', 'accountant', 'Comptable A D-055', 'active', NULL),
  ('00000000-0000-4000-a500-000000000002', 'accountant', 'Comptable B D-055', 'active', NULL),
  ('00000000-0000-4000-a500-000000000003', 'driver', 'Chauffeur D-055', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.contrats (id, reference, intitule, nature, contrepartie, devise, date_debut, statut) VALUES
  ('00000000-0000-4000-a500-0000000000c1', 'TEST-D055-LOC', 'Location test', 'location', 'Loueur D-055', 'USD', '2001-01-01', 'actif');
INSERT INTO public.factures_fournisseur (id, contrat_id, numero_fournisseur, date_facture, periode_debut, periode_fin, devise,
                                         montant_ht_facture, montant_ttc_facture, statut) VALUES
  ('00000000-0000-4000-a500-0000000000f1', '00000000-0000-4000-a500-0000000000c1', 'D055-F1', '2001-02-01', '2001-01-01', '2001-01-31', 'USD', 1000, 1180, 'conforme'),
  ('00000000-0000-4000-a500-0000000000f2', '00000000-0000-4000-a500-0000000000c1', 'D055-F2', '2001-03-01', '2001-02-01', '2001-02-28', 'USD', 900, NULL, 'saisie');
DELETE FROM public.settings WHERE key = 'paiements_validation_separee';

SELECT pg_temp.se_connecter('00000000-0000-4000-a500-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE p AS SELECT public.proposer_paiement(500, 'Acompte janvier', p_facture => '00000000-0000-4000-a500-0000000000f1') AS id;
SELECT is((SELECT statut || ' ' || beneficiaire FROM public.paiements_fournisseur WHERE id = (SELECT id FROM p)), 'propose Loueur D-055', 'bon a payer propose');
SELECT throws_ok($$SELECT public.proposer_paiement(700, 'Solde', p_facture => '00000000-0000-4000-a500-0000000000f1')$$,
  '22023', NULL, 'au-dela du reste a payer : refuse');
SELECT throws_ok($$SELECT public.proposer_paiement(100, 'Test', p_facture => '00000000-0000-4000-a500-0000000000f2')$$,
  '22023', NULL, 'facture non controlee : refuse');
SELECT throws_ok($$SELECT public.decider_paiement((SELECT id FROM p), true)$$, '42501', NULL, 'le proposant n''approuve pas');
SELECT throws_ok($$INSERT INTO public.paiements_fournisseur (numero, facture_fournisseur_id, beneficiaire, devise, objet, montant_propose)
  VALUES ('X', '00000000-0000-4000-a500-0000000000f1', 'X', 'USD', 'X', 1)$$, '42501', NULL, 'ecriture directe refusee');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-a500-000000000002');
SET LOCAL ROLE authenticated;
SELECT public.decider_paiement((SELECT id FROM p), true);
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-a500-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.enregistrer_execution_paiement((SELECT id FROM p), current_date, 'virement', 500)$$,
  '22023', NULL, 'virement sans reference : refuse');
SELECT throws_ok($$SELECT public.enregistrer_execution_paiement((SELECT id FROM p), current_date, 'virement', 600, 'VIR-1')$$,
  '22023', NULL, 'montant superieur a l''approuve : refuse');
SELECT public.enregistrer_execution_paiement((SELECT id FROM p), current_date, 'virement', 500, 'VIR-2026-001');
SELECT is((SELECT statut FROM public.paiements_fournisseur WHERE id = (SELECT id FROM p)), 'execute', 'paiement execute enregistre');
SELECT throws_ok($$SELECT public.controler_paiement((SELECT id FROM p), true)$$, '42501', NULL, 'l''executant ne controle pas');
SELECT throws_ok($$SELECT public.annuler_paiement((SELECT id FROM p), 'Test')$$, '22023', NULL, 'paiement execute : non annulable');
SELECT is((SELECT reste FROM public.v_reste_a_payer WHERE piece_id = '00000000-0000-4000-a500-0000000000f1'), 680::numeric, 'reste a payer : 1180 - 500');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-a500-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.controler_paiement((SELECT id FROM p), false)$$, '22023', NULL, 'anomalie sans motif : refusee');
SELECT public.controler_paiement((SELECT id FROM p), true);
SELECT is((SELECT controle_resultat FROM public.paiements_fournisseur WHERE id = (SELECT id FROM p)), 'conforme', 'controle a posteriori enregistre');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-a500-000000000003');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.proposer_paiement(10, 'Test', p_facture => '00000000-0000-4000-a500-0000000000f1')$$, '42501', NULL, 'sans droit : refuse');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
