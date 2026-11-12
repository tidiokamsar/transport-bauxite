-- Tests (D-033) : type de facturation et tarif par engin. Camion facture au
-- km (releve des voyages livres), chargeuse a l'heure par categorie, pelle a
-- l'heure par tarif d'engin qui prime sur sa categorie, ligne facturee dans
-- une unite differente signalee, ligne v1 en heures requalifiee
-- (migration 20261112100000). Periode de septembre 2001, vide en production.
-- Tout est annule.
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

SELECT plan(7);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-9400-000000000001', 'contrats.engins@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status) VALUES
  ('00000000-0000-4000-9400-000000000001', 'contract_manager', 'Charge Engins', 'active')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;
INSERT INTO public.contrats (id, reference, intitule, nature, contrepartie, devise, date_debut, statut) VALUES
  ('00000000-0000-4000-9400-0000000000c1', 'TEST-ENGINS-LOC', 'Location camions au km, engins a l''heure', 'location', 'Neemba', 'GNF', '2001-01-01', 'actif');
INSERT INTO public.contrat_versions (id, contrat_id, numero, intitule, date_effet) VALUES
  ('00000000-0000-4000-9400-0000000000e1', '00000000-0000-4000-9400-0000000000c1', 0, 'Contrat initial', '2001-01-01');
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status) VALUES
  ('00000000-0000-4000-9400-0000000000b1', 'TEST-KM-1', 'Test', 40, 'tipper', 'active'),
  ('00000000-0000-4000-9400-0000000000b2', 'TEST-H-CHG', 'Test', 10, 'loader', 'active'),
  ('00000000-0000-4000-9400-0000000000b3', 'TEST-H-PEL', 'Test', 8, 'excavator', 'active');
-- Le type de facturation et le tarif par engin (D-033) : camion au km,
-- chargeuse par categorie, pelle par tarif d'engin qui prime sur sa categorie.
INSERT INTO public.contrat_tarifs (version_id, libelle, unite, prix, categorie_materiel, engin) VALUES
  ('00000000-0000-4000-9400-0000000000e1', 'Camion benne au kilometre', 'km', 5000, NULL, '00000000-0000-4000-9400-0000000000b1'),
  ('00000000-0000-4000-9400-0000000000e1', 'Chargeuse a l''heure', 'heure', 150, 'Chargeuse', NULL),
  ('00000000-0000-4000-9400-0000000000e1', 'Pelle a l''heure', 'heure', 200, 'Pelle', NULL),
  ('00000000-0000-4000-9400-0000000000e1', 'Pelle TEST-H-PEL a l''heure', 'heure', 300, NULL, '00000000-0000-4000-9400-0000000000b3');
-- Pointages signes : chargeuse 50 h, pelle 10 h.
INSERT INTO public.sites (id, name, type) VALUES ('00000000-0000-4000-9400-0000000000a1', 'Mine Engins test', 'mine');
INSERT INTO public.fiches_terrain (id, numero, type, date_fiche, site_id, statut) VALUES
  ('00000000-0000-4000-9400-0000000000f1', 'FP-010910-911', 'pointage_engins', '2001-09-10', '00000000-0000-4000-9400-0000000000a1', 'saisie');
INSERT INTO public.pointages_engins (fiche_id, vehicle_id, index_debut, index_fin) VALUES
  ('00000000-0000-4000-9400-0000000000f1', '00000000-0000-4000-9400-0000000000b2', 500, 550),
  ('00000000-0000-4000-9400-0000000000f1', '00000000-0000-4000-9400-0000000000b3', 1000, 1010);
-- Releves kilometriques du camion : 200 + 200 = 400 km livres en septembre.
INSERT INTO public.trips (id, reference, planned_date, vehicle_id, etat, km_start, km_end) VALUES
  ('00000000-0000-4000-9400-000000000011', 'TEST-ENG-T1', '2001-09-05', '00000000-0000-4000-9400-0000000000b1', 'DELIVERED', 100, 300),
  ('00000000-0000-4000-9400-000000000012', 'TEST-ENG-T2', '2001-09-20', '00000000-0000-4000-9400-0000000000b1', 'CLOSED', 300, 500),
  ('00000000-0000-4000-9400-000000000013', 'TEST-ENG-T3', '2001-10-05', '00000000-0000-4000-9400-0000000000b1', 'DELIVERED', 500, 1500),
  ('00000000-0000-4000-9400-000000000014', 'TEST-ENG-T4', '2001-09-25', '00000000-0000-4000-9400-0000000000b1', 'LOADING', 500, 900);

SELECT pg_temp.se_connecter('00000000-0000-4000-9400-000000000001');
SET LOCAL ROLE authenticated;

INSERT INTO public.factures_fournisseur (id, contrat_id, numero_fournisseur, date_facture, periode_debut, periode_fin, devise, montant_ht_facture)
VALUES ('00000000-0000-4000-9400-000000000101', '00000000-0000-4000-9400-0000000000c1', 'NB-ENG-2001-09', '2001-10-02', '2001-09-01', '2001-09-30', 'GNF', 2171250);
INSERT INTO public.factures_fournisseur_lignes
  (facture_id, vehicle_id, libelle, categorie_materiel, quantite_facturee, unite_facturee, taux_facture, montant_facture) VALUES
  ('00000000-0000-4000-9400-000000000101', '00000000-0000-4000-9400-0000000000b1', 'TEST-KM-1', NULL, 420, 'km', 5000, 2100000),
  ('00000000-0000-4000-9400-000000000101', '00000000-0000-4000-9400-0000000000b2', 'TEST-H-CHG', 'Chargeuse', 50, 'heure', 150, 7500),
  ('00000000-0000-4000-9400-000000000101', '00000000-0000-4000-9400-0000000000b1', 'TEST-KM-1 en heures', NULL, 10, 'heure', 6000, 60000),
  ('00000000-0000-4000-9400-000000000101', '00000000-0000-4000-9400-0000000000b3', 'TEST-H-PEL', 'Pelle', 10, 'heure', 300, 3000);
-- Ligne v1 (heures seulement) : requalifiee en heures par le controle.
INSERT INTO public.factures_fournisseur_lignes
  (facture_id, vehicle_id, libelle, categorie_materiel, heures_facturees, taux_facture, montant_facture) VALUES
  ('00000000-0000-4000-9400-000000000101', '00000000-0000-4000-9400-0000000000b2', 'TEST-H-CHG ligne v1', 'Chargeuse', 5, 150, 750);

SELECT is(public.controler_facture_fournisseur('00000000-0000-4000-9400-000000000101'), 100000::numeric,
  'montant reclame : kilometres factures au-dela des kilometres releves');
SELECT is((SELECT (quantite_attendue, unite_attendue, taux_attendu, montant_attendu, ecart)::text
  FROM public.factures_fournisseur_lignes WHERE libelle = 'TEST-KM-1'),
  '(400.00,km,5000,2000000.00,100000.00)',
  'camion au km : releve des voyages livres x tarif km de l''engin');
SELECT is((SELECT (quantite_attendue, unite_attendue, ecart)::text
  FROM public.factures_fournisseur_lignes WHERE libelle = 'TEST-H-CHG'),
  '(50.00,heure,0.00)', 'chargeuse a l''heure : pointages signes x tarif de sa categorie');
SELECT is((SELECT taux_attendu FROM public.factures_fournisseur_lignes WHERE libelle = 'TEST-H-PEL'), 300::numeric,
  'tarif de l''engin pelle (300) retenu avant le tarif de sa categorie (200)');
SELECT is((SELECT heures_attendues FROM public.factures_fournisseur_lignes WHERE libelle = 'TEST-H-PEL'), 10.00::numeric,
  'ligne a l''heure : heures_attendues toujours remplies');
SELECT ok((SELECT constat FROM public.factures_fournisseur_lignes WHERE libelle = 'TEST-KM-1 en heures')
  LIKE '%Facturee en heure, contrat en km : quantites non comparables%',
  'facturee dans une unite differente du contrat : ligne signalee');
SELECT is((SELECT (quantite_attendue, unite_attendue)::text
  FROM public.factures_fournisseur_lignes WHERE libelle = 'TEST-H-CHG ligne v1'),
  '(50.00,heure)', 'ligne v1 en heures requalifiee sans estimation');

SELECT finish();
ROLLBACK;
