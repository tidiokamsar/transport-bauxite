-- Tests (D-043) : releves d'odometre append-only et coherents, distances
-- mesuree / reference / validee, separation saisie / validation, controle
-- des factures du loueur au km sur les distances facturables
-- (migration 20261115150000). Periode de septembre 2001. Tout est annule.
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

SELECT plan(19);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-9900-000000000001', 'releves.d043@exemple.invalid'),
  ('00000000-0000-4000-9900-000000000002', 'controle.d043@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-9900-000000000001', 'contract_manager', 'Saisie releves', 'active', NULL),
  ('00000000-0000-4000-9900-000000000002', 'contract_manager', 'Controle distances', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-9900-0000000000a1', 'Mine km test', 'mine'),
  ('00000000-0000-4000-9900-0000000000a2', 'Depot km test', 'depot');
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status) VALUES
  ('00000000-0000-4000-9900-0000000000b1', 'TEST-KM-D043', 'Test', 40, 'tipper', 'active');
INSERT INTO public.trips (id, reference, planned_date, vehicle_id, etat, departure_site_id, arrival_site_id) VALUES
  ('00000000-0000-4000-9900-000000000011', 'TEST-D043-T1', '2001-09-05', '00000000-0000-4000-9900-0000000000b1', 'DELIVERED',
   '00000000-0000-4000-9900-0000000000a1', '00000000-0000-4000-9900-0000000000a2'),
  ('00000000-0000-4000-9900-000000000012', 'TEST-D043-T2', '2001-09-06', '00000000-0000-4000-9900-0000000000b1', 'CLOSED',
   '00000000-0000-4000-9900-0000000000a1', '00000000-0000-4000-9900-0000000000a2'),
  ('00000000-0000-4000-9900-000000000013', 'TEST-D043-T3', '2001-09-07', '00000000-0000-4000-9900-0000000000b1', 'LOADING',
   '00000000-0000-4000-9900-0000000000a1', '00000000-0000-4000-9900-0000000000a2');
INSERT INTO public.contrats (id, reference, intitule, nature, contrepartie, devise, date_debut, statut) VALUES
  ('00000000-0000-4000-9900-0000000000c1', 'TEST-D043-LOC', 'Camion au km', 'location', 'Neemba', 'GNF', '2001-01-01', 'actif');
INSERT INTO public.contrat_versions (id, contrat_id, numero, intitule, date_effet) VALUES
  ('00000000-0000-4000-9900-0000000000e1', '00000000-0000-4000-9900-0000000000c1', 0, 'Initial', '2001-01-01');
INSERT INTO public.contrat_tarifs (id, version_id, libelle, unite, prix, engin) VALUES
  ('00000000-0000-4000-9900-0000000000d1', '00000000-0000-4000-9900-0000000000e1', 'Camion au km', 'km', 5000, '00000000-0000-4000-9900-0000000000b1');

-- A : distance de reference et releves
SELECT pg_temp.se_connecter('00000000-0000-4000-9900-000000000001');
SET LOCAL ROLE authenticated;
INSERT INTO public.distances_reference (site_depart_id, site_arrivee_id, distance_km, source)
VALUES ('00000000-0000-4000-9900-0000000000a1', '00000000-0000-4000-9900-0000000000a2', 52, 'Releve de piste 2001');
SELECT lives_ok($$SELECT public.saisir_releve_compteur('00000000-0000-4000-9900-0000000000b1', '00000000-0000-4000-9900-000000000011', 'depart_charge', 10000, '2001-09-05 06:00+00', 'fiche', 'FR-T1')$$,
  'releve de depart enregistre');
SELECT throws_ok($$SELECT public.saisir_releve_compteur('00000000-0000-4000-9900-0000000000b1', '00000000-0000-4000-9900-000000000011', 'arrivee_depot', 9990, '2001-09-05 08:00+00', 'fiche')$$,
  '22023', NULL, 'releve inferieur au precedent refuse');
SELECT throws_ok($$SELECT public.saisir_releve_compteur('00000000-0000-4000-9900-0000000000b1', '00000000-0000-4000-9900-000000000011', 'depart_charge', 10001, '2001-09-05 06:10+00', 'fiche')$$,
  '22023', NULL, 'second releve du meme moment refuse : correction obligatoire');
SELECT lives_ok($$SELECT public.saisir_releve_compteur('00000000-0000-4000-9900-0000000000b1', '00000000-0000-4000-9900-000000000011', 'arrivee_depot', 10055, '2001-09-05 08:00+00', 'fiche')$$,
  'releve d''arrivee enregistre');
SELECT lives_ok($$SELECT public.saisir_releve_compteur('00000000-0000-4000-9900-0000000000b1', '00000000-0000-4000-9900-000000000011', 'fin_rotation', 10105, '2001-09-05 10:00+00', 'fiche')$$,
  'releve de fin de rotation enregistre');
SELECT is((SELECT (mesure_charge_km, mesure_retour_km, distance_reference_km)::text FROM public.mesures_voyage('00000000-0000-4000-9900-000000000011')),
  '(55,50,52)', 'mesures charge et retour, distance de reference');
SELECT throws_ok($$SELECT public.corriger_releve_compteur((SELECT id FROM public.v_releves_compteur WHERE trip_id = '00000000-0000-4000-9900-000000000011' AND moment = 'arrivee_depot'), 10052, NULL)$$,
  '22023', NULL, 'correction sans motif refusee');
SELECT lives_ok($$SELECT public.corriger_releve_compteur((SELECT id FROM public.v_releves_compteur WHERE trip_id = '00000000-0000-4000-9900-000000000011' AND moment = 'arrivee_depot'), 10052, 'Lecture erronee sur la fiche')$$,
  'releve corrige avec motif');
SELECT is((SELECT count(*)::int FROM public.releves_compteur WHERE trip_id = '00000000-0000-4000-9900-000000000011'), 4,
  'la valeur initiale reste au journal');
SELECT throws_ok($$UPDATE public.releves_compteur SET valeur_km = 1$$, '42501', NULL, 'releve non modifiable directement');
SELECT throws_ok($$SELECT public.valider_distance_voyage('00000000-0000-4000-9900-000000000011', 52, 53)$$,
  '42501', NULL, 'l''auteur des releves ne valide pas la distance');
RESET ROLE;

-- B : validation
SELECT pg_temp.se_connecter('00000000-0000-4000-9900-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.valider_distance_voyage('00000000-0000-4000-9900-000000000013', 50)$$,
  '22023', NULL, 'voyage non livre : pas de distance validee');
SELECT throws_ok($$SELECT public.valider_distance_voyage('00000000-0000-4000-9900-000000000012', 52)$$,
  '22023', NULL, 'sans mesure, la reference ne s''impose pas sans motif');
SELECT is(public.valider_distance_voyage('00000000-0000-4000-9900-000000000011', 52, 53), 1, 'distance mesuree validee (version 1)');
SELECT is(public.valider_distance_voyage('00000000-0000-4000-9900-000000000012', 52, 50, NULL, 'Compteur hors service, distance de reference retenue'), 1,
  'distance de reference retenue avec motif');

-- Controle de facture au km
INSERT INTO public.factures_fournisseur (id, contrat_id, numero_fournisseur, date_facture, periode_debut, periode_fin, devise, montant_ht_facture)
VALUES ('00000000-0000-4000-9900-000000000101', '00000000-0000-4000-9900-0000000000c1', 'NB-D043-09', '2001-10-02', '2001-09-01', '2001-09-30', 'GNF', 1100000);
INSERT INTO public.factures_fournisseur_lignes (facture_id, vehicle_id, libelle, quantite_facturee, unite_facturee, taux_facture, montant_facture)
VALUES ('00000000-0000-4000-9900-000000000101', '00000000-0000-4000-9900-0000000000b1', 'TEST-KM-D043', 220, 'km', 5000, 1100000);
SELECT public.controler_facture_fournisseur('00000000-0000-4000-9900-000000000101');
SELECT is((SELECT (quantite_attendue IS NULL, constat)::text FROM public.factures_fournisseur_lignes WHERE libelle = 'TEST-KM-D043'),
  '(t,"Regle du retour a vide non renseignee au tarif : kilometres non verifiables")', 'regle du retour a confirmer : rien n''est estime');
RESET ROLE;
UPDATE public.contrat_tarifs SET km_retour_vide_facturable = true WHERE id = '00000000-0000-4000-9900-0000000000d1';
SELECT pg_temp.se_connecter('00000000-0000-4000-9900-000000000002');
SET LOCAL ROLE authenticated;
SELECT is(public.controler_facture_fournisseur('00000000-0000-4000-9900-000000000101'), 65000::numeric,
  'retour facture : 52+53+52+50 = 207 km attendus, 13 km reclames');
RESET ROLE;
UPDATE public.contrat_tarifs SET km_retour_vide_facturable = false WHERE id = '00000000-0000-4000-9900-0000000000d1';
SELECT pg_temp.se_connecter('00000000-0000-4000-9900-000000000002');
SET LOCAL ROLE authenticated;
SELECT is(public.controler_facture_fournisseur('00000000-0000-4000-9900-000000000101'), 580000::numeric,
  'trajet charge seulement : 104 km attendus, 116 km reclames');
RESET ROLE;
SELECT pg_temp.se_connecter(NULL);
INSERT INTO public.trips (id, reference, planned_date, vehicle_id, etat, departure_site_id, arrival_site_id) VALUES
  ('00000000-0000-4000-9900-000000000014', 'TEST-D043-T4', '2001-09-08', '00000000-0000-4000-9900-0000000000b1', 'DELIVERED',
   '00000000-0000-4000-9900-0000000000a1', '00000000-0000-4000-9900-0000000000a2');
SELECT pg_temp.se_connecter('00000000-0000-4000-9900-000000000002');
SET LOCAL ROLE authenticated;
SELECT public.controler_facture_fournisseur('00000000-0000-4000-9900-000000000101');
SELECT is((SELECT constat FROM public.factures_fournisseur_lignes WHERE libelle = 'TEST-KM-D043'),
  '1 voyage(s) livre(s) sans distance validee : kilometres non verifiables', 'voyage livre sans distance validee : non verifiable');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
