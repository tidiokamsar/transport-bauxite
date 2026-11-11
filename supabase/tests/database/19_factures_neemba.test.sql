-- Tests (D-032) : controle des factures du loueur sur les heures pointees
-- et le tarif du contrat, notification d'ecart, regularisation
-- (migration 20261111200000). Periode de septembre 2001, vide en
-- production. Tout est annule.
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

SELECT plan(17);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-9300-000000000001', 'contrats.neemba@exemple.invalid'),
  ('00000000-0000-4000-9300-000000000002', 'chauffeur.neemba@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status) VALUES
  ('00000000-0000-4000-9300-000000000001', 'contract_manager', 'Charge Neemba', 'active'),
  ('00000000-0000-4000-9300-000000000002', 'driver', 'Chauffeur Neemba', 'active')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;
INSERT INTO public.sites (id, name, type) VALUES ('00000000-0000-4000-9300-0000000000a1', 'Mine Neemba test', 'mine');
INSERT INTO public.contrats (id, reference, intitule, nature, contrepartie, devise, date_debut, statut) VALUES
  ('00000000-0000-4000-9300-0000000000c1', 'TEST-NEEMBA-LOC', 'Location a l''heure', 'location', 'Neemba', 'USD', '2001-01-01', 'actif');
INSERT INTO public.contrat_versions (id, contrat_id, numero, intitule, date_effet) VALUES
  ('00000000-0000-4000-9300-0000000000e1', '00000000-0000-4000-9300-0000000000c1', 0, 'Contrat initial', '2001-01-01');
INSERT INTO public.contrat_tarifs (version_id, libelle, unite, prix, categorie_materiel) VALUES
  ('00000000-0000-4000-9300-0000000000e1', 'Semi-remorque a l''heure', 'heure', 100, 'Semi-remorque'),
  ('00000000-0000-4000-9300-0000000000e1', 'Chargeuse a l''heure', 'heure', 150, 'Chargeuse');
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status) VALUES
  ('00000000-0000-4000-9300-0000000000b1', 'TEST-NB-1', 'Test', 40, 'tipper', 'active'),
  ('00000000-0000-4000-9300-0000000000b2', 'TEST-NB-CHG', 'Test', 10, 'loader', 'active'),
  ('00000000-0000-4000-9300-0000000000b3', 'TEST-NB-3', 'Test', 40, 'tipper', 'active');
-- Pointages signes : TEST-NB-1 100 h, chargeuse 50 h ; TEST-NB-3 aucun
INSERT INTO public.fiches_terrain (id, numero, type, date_fiche, site_id, statut) VALUES
  ('00000000-0000-4000-9300-0000000000f1', 'FP-010910-901', 'pointage_engins', '2001-09-10', '00000000-0000-4000-9300-0000000000a1', 'saisie');
INSERT INTO public.pointages_engins (fiche_id, vehicle_id, index_debut, index_fin) VALUES
  ('00000000-0000-4000-9300-0000000000f1', '00000000-0000-4000-9300-0000000000b1', 1000, 1100),
  ('00000000-0000-4000-9300-0000000000f1', '00000000-0000-4000-9300-0000000000b2', 500, 550);
INSERT INTO public.immobilisations (vehicle_id, debut, fin, cause, imputation, description, statut) VALUES
  ('00000000-0000-4000-9300-0000000000b1', '2001-09-15 00:00+00', '2001-09-15 10:00+00', 'panne', 'loueur', 'x', 'cloturee');

SELECT pg_temp.se_connecter('00000000-0000-4000-9300-000000000001');
SET LOCAL ROLE authenticated;

INSERT INTO public.factures_fournisseur (id, contrat_id, numero_fournisseur, date_facture, periode_debut, periode_fin, devise, montant_ht_facture)
VALUES ('00000000-0000-4000-9300-000000000101', '00000000-0000-4000-9300-0000000000c1', 'NB-2001-09', '2001-10-02', '2001-09-01', '2001-09-30', 'USD', 21000);
INSERT INTO public.factures_fournisseur_lignes (facture_id, vehicle_id, libelle, categorie_materiel, heures_facturees, taux_facture, montant_facture) VALUES
  ('00000000-0000-4000-9300-000000000101', '00000000-0000-4000-9300-0000000000b1', 'TEST-NB-1', 'Semi-remorque', 110, 100, 11000),
  ('00000000-0000-4000-9300-000000000101', '00000000-0000-4000-9300-0000000000b2', 'TEST-NB-CHG', 'Chargeuse', 50, 150, 7500),
  ('00000000-0000-4000-9300-000000000101', '00000000-0000-4000-9300-0000000000b3', 'TEST-NB-3', 'Semi-remorque', 20, 100, 2000),
  ('00000000-0000-4000-9300-000000000101', NULL, 'Frais de mobilisation', NULL, NULL, NULL, 500);

SELECT is(public.controler_facture_fournisseur('00000000-0000-4000-9300-000000000101'), 1000::numeric,
  'montant reclame : heures facturees au-dela des heures pointees');
SELECT is((SELECT (heures_attendues, taux_attendu, montant_attendu, ecart, heures_arret_loueur)::text FROM public.factures_fournisseur_lignes
  WHERE libelle = 'TEST-NB-1'), '(100.00,100,10000.00,1000.00,10.00)', 'ligne camion : heures pointees, tarif du contrat, arret du loueur');
SELECT is((SELECT ecart FROM public.factures_fournisseur_lignes WHERE libelle = 'TEST-NB-CHG'), 0.00::numeric, 'chargeuse conforme au tarif de sa categorie');
SELECT is((SELECT (montant_attendu IS NULL, constat)::text FROM public.factures_fournisseur_lignes WHERE libelle = 'TEST-NB-3'),
  '(t,"Aucun pointage sur la periode : heures non verifiables")', 'sans pointage : rien n''est estime');
SELECT is((SELECT constat FROM public.factures_fournisseur_lignes WHERE libelle = 'Frais de mobilisation'), 'Ligne sans engin : non controlee',
  'ligne sans engin signalee');
SELECT throws_ok($$UPDATE public.factures_fournisseur_lignes SET montant_attendu = 11000 WHERE libelle = 'TEST-NB-1'$$,
  '42501', NULL, 'resultat du controle non modifiable a la main');

SELECT throws_ok($$SELECT public.notifier_ecart_fournisseur('00000000-0000-4000-9300-000000000101', current_date + 1, 'L-1')$$,
  '22023', NULL, 'notification datee dans le futur refusee');
SELECT is(public.notifier_ecart_fournisseur('00000000-0000-4000-9300-000000000101', current_date, 'KM/DC/2001-001'), 'notifiee', 'ecart notifie');
SELECT throws_ok($$INSERT INTO public.factures_fournisseur_lignes (facture_id, libelle, montant_facture)
  VALUES ('00000000-0000-4000-9300-000000000101', 'Ajout tardif', 10)$$, '42501', NULL, 'facture notifiee : lignes figees');

SELECT throws_ok($$SELECT public.enregistrer_regularisation('00000000-0000-4000-9300-000000000101', current_date, 1500, 'avoir')$$,
  '22023', NULL, 'regularisation au-dela du reclame refusee');
SELECT is(public.enregistrer_regularisation('00000000-0000-4000-9300-000000000101', current_date, 600, 'avoir', 'AV-NB-12'), 400::numeric,
  'regularisation partielle');
SELECT is(public.enregistrer_regularisation('00000000-0000-4000-9300-000000000101', current_date, 400, 'deduction'), 0::numeric, 'ecart recouvre');
SELECT is((SELECT statut FROM public.factures_fournisseur WHERE id = '00000000-0000-4000-9300-000000000101'), 'regularisee', 'facture regularisee');
SELECT ok((SELECT ecarts_detectes >= 1000 AND ecarts_recouvres >= 1000 FROM public.indicateurs_charge_contrats()),
  'indicateur : ecarts detectes et recouvres');

-- Facture conforme : aucune notification d'ecart
INSERT INTO public.factures_fournisseur (id, contrat_id, numero_fournisseur, date_facture, periode_debut, periode_fin, devise, montant_ht_facture)
VALUES ('00000000-0000-4000-9300-000000000102', '00000000-0000-4000-9300-0000000000c1', 'NB-2001-09B', '2001-10-02', '2001-09-01', '2001-09-30', 'USD', 7500);
INSERT INTO public.factures_fournisseur_lignes (facture_id, vehicle_id, libelle, categorie_materiel, heures_facturees, taux_facture, montant_facture)
VALUES ('00000000-0000-4000-9300-000000000102', '00000000-0000-4000-9300-0000000000b2', 'Chargeuse', 'Chargeuse', 50, 150, 7500);
SELECT is(public.notifier_ecart_fournisseur('00000000-0000-4000-9300-000000000102', current_date, NULL), 'conforme',
  'facture conforme : pas de notification');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-9300-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.controler_facture_fournisseur('00000000-0000-4000-9300-000000000102')$$, '42501', NULL,
  'un chauffeur ne controle pas les factures');
SELECT is((SELECT count(*)::int FROM public.factures_fournisseur), 0, 'un chauffeur ne voit pas les factures du loueur');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
