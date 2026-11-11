-- Tests (D-031) : engagements compares au realise, rapport de performance
-- fige puis remis, encaissements et relances, comites
-- (migration 20261111180000). Periode de novembre 2001, vide en
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

SELECT plan(19);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-9200-000000000001', 'contrats.suivi@exemple.invalid'),
  ('00000000-0000-4000-9200-000000000002', 'chauffeur.suivi@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status) VALUES
  ('00000000-0000-4000-9200-000000000001', 'contract_manager', 'Charge suivi', 'active'),
  ('00000000-0000-4000-9200-000000000002', 'driver', 'Chauffeur suivi', 'active')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;
INSERT INTO public.contrats (id, reference, intitule, nature, contrepartie, devise, date_debut, statut, delai_paiement_jours) VALUES
  ('00000000-0000-4000-9200-0000000000c1', 'TEST-SUIVI-NEEMBA', 'Location', 'location', 'Neemba', 'USD', '2001-01-01', 'actif', 30);
INSERT INTO public.contrat_versions (id, contrat_id, numero, intitule, date_effet) VALUES
  ('00000000-0000-4000-9200-0000000000e1', '00000000-0000-4000-9200-0000000000c1', 0, 'Contrat initial', '2001-01-01');
INSERT INTO public.contrat_engagements (version_id, indicateur, libelle, seuil, unite, sens, periodicite, ordre) VALUES
  ('00000000-0000-4000-9200-0000000000e1', 'temps_chargement', 'Temps de chargement', 15, 'min', 'maximum', 'mois', 1),
  ('00000000-0000-4000-9200-0000000000e1', 'rotations', 'Rotations', 2, 'rotations/jour', 'minimum', 'jour', 2),
  ('00000000-0000-4000-9200-0000000000e1', 'taux_remplissage', 'Remplissage', 95, '%', 'minimum', 'mois', 3),
  ('00000000-0000-4000-9200-0000000000e1', 'autre', 'Clause libre', 1, 'u', 'minimum', 'mois', 4);
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status) VALUES
  ('00000000-0000-4000-9200-0000000000b1', 'TEST-SUIVI-1', 'Test', 40, 'tipper', 'active');
INSERT INTO public.trips (id, reference, planned_date, vehicle_id, etat, net_weight) VALUES
  ('00000000-0000-4000-9200-000000000101', 'TSUIVI-1', '2001-11-05', '00000000-0000-4000-9200-0000000000b1', 'ACCEPTED', 38),
  ('00000000-0000-4000-9200-000000000102', 'TSUIVI-2', '2001-11-05', '00000000-0000-4000-9200-0000000000b1', 'ACCEPTED', 36);
INSERT INTO public.trip_events (trip_id, etat_avant, etat_apres, survenu_le) VALUES
  ('00000000-0000-4000-9200-000000000101', 'AT_LOADING', 'LOADING', '2001-11-05 07:00+00'),
  ('00000000-0000-4000-9200-000000000101', 'LOADING', 'LOADED', '2001-11-05 07:12+00'),
  ('00000000-0000-4000-9200-000000000102', 'AT_LOADING', 'LOADING', '2001-11-05 09:00+00'),
  ('00000000-0000-4000-9200-000000000102', 'LOADING', 'LOADED', '2001-11-05 09:18+00');

SELECT pg_temp.se_connecter('00000000-0000-4000-9200-000000000001');
SET LOCAL ROLE authenticated;

SELECT is((SELECT (temps_chargement_min, rotations_par_camion_jour, taux_remplissage_pct)::text
  FROM public.realise_engagements('2001-11-01', '2001-11-30')), '(15.0,2.00,92.5)', 'mesures du terrain sur la periode');
SELECT is((SELECT array_agg(conforme::text ORDER BY libelle) FROM public.comparer_engagements('00000000-0000-4000-9200-0000000000c1', '2001-11-01', '2001-11-30')),
  ARRAY[NULL, 'false', 'true', 'true'], 'conformite : non mesurable, remplissage insuffisant, rotations et chargement tenus');

CREATE TEMP TABLE rp AS SELECT public.generer_rapport_performance('00000000-0000-4000-9200-0000000000c1', '2001-11-01', '2001-11-30') AS id;
SELECT is((SELECT jsonb_array_length(contenu -> 'engagements') FROM public.rapports_performance WHERE id = (SELECT id FROM rp)), 4,
  'rapport fige avec les engagements');
SELECT throws_ok($$SELECT public.marquer_rapport_remis((SELECT id FROM rp), current_date + 1, 'CBG')$$, '22023', NULL, 'date de remise future refusee');
SELECT lives_ok($$SELECT public.marquer_rapport_remis((SELECT id FROM rp), current_date, 'Direction CBG')$$, 'rapport remis');
SELECT throws_ok($$SELECT public.generer_rapport_performance('00000000-0000-4000-9200-0000000000c1', '2001-11-01', '2001-11-30')$$,
  '22023', NULL, 'rapport remis : il ne change plus');
RESET ROLE;

-- Facture emise (hors session), echue
SELECT pg_temp.se_connecter(NULL);
INSERT INTO public.factures (id, numero, type, contrat_id, objet, devise, taux_taxe_pct, montant_ht, montant_taxe, montant_ttc, statut,
  date_emission, date_echeance, periode_debut, periode_fin)
VALUES ('00000000-0000-4000-9200-0000000000f1', 'TEST-FAC-2001-0001', 'facture', '00000000-0000-4000-9200-0000000000c1', 'Test', 'USD', 0,
  1000, 0, 1000, 'emise', '2001-12-01', '2001-12-31', '2001-11-01', '2001-11-30');

SELECT pg_temp.se_connecter('00000000-0000-4000-9200-000000000001');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.enregistrer_encaissement('00000000-0000-4000-9200-0000000000f1', '2002-01-15', 600, 'virement', 'VIR-1')$$, 'encaissement partiel');
SELECT throws_ok($$SELECT public.enregistrer_encaissement('00000000-0000-4000-9200-0000000000f1', '2002-01-20', 500, 'virement')$$,
  '22023', NULL, 'encaissement au-dela du reste du refuse');
SELECT throws_ok($$SELECT public.enregistrer_encaissement('00000000-0000-4000-9200-0000000000f1', '2001-11-20', 10, 'virement')$$,
  '22023', NULL, 'encaissement anterieur a l''emission refuse');
SELECT is((SELECT (reste, jours_retard > 0)::text FROM public.v_creances WHERE id = '00000000-0000-4000-9200-0000000000f1'), '(400,t)',
  'reste du et retard');
SELECT is(public.relancer('00000000-0000-4000-9200-0000000000f1', 'email'), 1, 'premiere relance');
SELECT is(public.relancer('00000000-0000-4000-9200-0000000000f1', 'courrier'), 2, 'deuxieme relance');
SELECT is(public.relancer('00000000-0000-4000-9200-0000000000f1', 'remise_main', 'Mise en demeure'), 3, 'mise en demeure');
SELECT throws_ok($$SELECT public.relancer('00000000-0000-4000-9200-0000000000f1', 'email')$$, '22023', NULL, 'pas de relance apres la mise en demeure');
SELECT lives_ok($$SELECT public.enregistrer_encaissement('00000000-0000-4000-9200-0000000000f1', '2002-02-10', 400, 'cheque')$$, 'solde encaisse');
SELECT is((SELECT reste FROM public.v_creances WHERE id = '00000000-0000-4000-9200-0000000000f1'), 0::numeric, 'facture soldee');

INSERT INTO public.comites_contrat (contrat_id, date_comite, objet) VALUES ('00000000-0000-4000-9200-0000000000c1', '2001-12-05', 'Comite mensuel');
SELECT is((SELECT count(*)::int FROM public.comites_contrat WHERE contrat_id = '00000000-0000-4000-9200-0000000000c1'), 1, 'comite enregistre');
SELECT isnt((SELECT factures_a_signer FROM public.indicateurs_charge_contrats()), NULL, 'indicateurs de la fiche de poste calcules');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-9200-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$INSERT INTO public.comites_contrat (contrat_id, date_comite, objet) VALUES ('00000000-0000-4000-9200-0000000000c1', '2001-12-06', 'x')$$,
  '42501', NULL, 'un chauffeur ne cree pas de comite');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
