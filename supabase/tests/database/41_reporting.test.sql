-- Tests (D-058) : rapports calcules sur les donnees reelles (journalier,
-- mensuel par jour, shift, loueur, client), valeurs absentes signalees,
-- droits de lecture respectes, rapport fige append-only, couts directs par
-- fonction serveur (migration 20261118090000). Periode 2001 : la
-- production contient des donnees de demonstration. Tout est annule.
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
-- Valeur et remarque d'un indicateur d'un rapport deja calcule.
CREATE FUNCTION pg_temp.v(p_rapport jsonb, p_indicateur text) RETURNS text
LANGUAGE sql AS $$
  SELECT coalesce(l ->> 'valeur', '-') || '|' || coalesce(l ->> 'manquants', '-') || '|' || coalesce(l ->> 'remarque', '-')
    FROM jsonb_array_elements(p_rapport) l WHERE l ->> 'indicateur' = p_indicateur LIMIT 1;
$$;
CREATE FUNCTION pg_temp.jr(p_date date, p_site uuid) RETURNS jsonb
LANGUAGE sql AS $$ SELECT jsonb_agg(to_jsonb(r)) FROM public.rapport_journalier(p_date, p_site) r; $$;

SELECT plan(28);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a800-000000000001', 'directeur.d058@exemple.invalid'),
  ('00000000-0000-4000-a800-000000000002', 'maintenance.d058@exemple.invalid'),
  ('00000000-0000-4000-a800-000000000003', 'directeur.site.d058@exemple.invalid'),
  ('00000000-0000-4000-a800-000000000004', 'chauffeur.d058@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-a800-0000000000a1', 'Mine D-058', 'mine'),
  ('00000000-0000-4000-a800-0000000000a2', 'Port D-058', 'port');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-a800-000000000001', 'director', 'Directeur D-058', 'active', NULL),
  ('00000000-0000-4000-a800-000000000002', 'maintenance_chief', 'Maintenance D-058', 'active', NULL),
  ('00000000-0000-4000-a800-000000000003', 'director', 'Directeur site D-058', 'active', '00000000-0000-4000-a800-0000000000a2'),
  ('00000000-0000-4000-a800-000000000004', 'driver', 'Chauffeur D-058', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.work_shifts (id, name, display_name, start_time, end_time, shift_order) VALUES
  ('00000000-0000-4000-a800-0000000000e1', 'test_jour_d058', 'Jour D-058', '06:00', '18:00', 93);
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status, site_id) VALUES
  ('00000000-0000-4000-a800-0000000000b1', 'TEST-D058-1', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-a800-0000000000a1'),
  ('00000000-0000-4000-a800-0000000000b2', 'TEST-D058-CHG', 'Test', 10, 'loader', 'active', '00000000-0000-4000-a800-0000000000a1');
INSERT INTO public.objectifs_production (date_plan, site_id, shift_id, version, tonnes_cible) VALUES
  ('2001-05-10', '00000000-0000-4000-a800-0000000000a1', NULL, 1, 200);
INSERT INTO public.trips (id, reference, planned_date, vehicle_id, departure_site_id, arrival_site_id, shift_id, etat, net_weight, net_weight_reception, accepted_tonnage) VALUES
  ('00000000-0000-4000-a800-000000000101', 'T-D058-1', '2001-05-10', '00000000-0000-4000-a800-0000000000b1', '00000000-0000-4000-a800-0000000000a1', '00000000-0000-4000-a800-0000000000a2', '00000000-0000-4000-a800-0000000000e1', 'ACCEPTED', 40, 39, 38),
  ('00000000-0000-4000-a800-000000000102', 'T-D058-2', '2001-05-10', '00000000-0000-4000-a800-0000000000b1', '00000000-0000-4000-a800-0000000000a1', '00000000-0000-4000-a800-0000000000a2', '00000000-0000-4000-a800-0000000000e1', 'DELIVERED', 42, NULL, NULL),
  ('00000000-0000-4000-a800-000000000103', 'T-D058-3', '2001-05-10', NULL, '00000000-0000-4000-a800-0000000000a1', NULL, '00000000-0000-4000-a800-0000000000e1', 'PLANNED', NULL, NULL, NULL),
  ('00000000-0000-4000-a800-000000000104', 'T-D058-4', '2001-05-10', NULL, '00000000-0000-4000-a800-0000000000a1', NULL, '00000000-0000-4000-a800-0000000000e1', 'CANCELLED', NULL, NULL, NULL),
  ('00000000-0000-4000-a800-000000000105', 'T-D058-5', '2001-05-10', NULL, '00000000-0000-4000-a800-0000000000a2', NULL, NULL, 'DELIVERED', 50, 50, NULL);
INSERT INTO public.tickets_pesee_cbg (trip_id, site_id, ticket, brut, tare, mesure_le) VALUES
  ('00000000-0000-4000-a800-000000000101', '00000000-0000-4000-a800-0000000000a1', 'TK-D058-1', 55, 15, '2001-05-10 09:00+00');
INSERT INTO public.fuel_transactions (transaction_date, vehicle_id, site_id, volume_liters, unit_price, total_cost, transaction_type, reference) VALUES
  ('2001-05-10', '00000000-0000-4000-a800-0000000000b1', '00000000-0000-4000-a800-0000000000a1', 300, 10, 3000, 'refuel', 'TEST-D058-P1'),
  ('2001-05-10', '00000000-0000-4000-a800-0000000000b2', NULL, 100, NULL, NULL, 'refuel', 'TEST-D058-P2');
INSERT INTO public.incidents (incident_time, description, severity, type, site_id) VALUES
  ('2001-05-10 10:00+00', 'Accrochage D-058', 'severe', 'accident', '00000000-0000-4000-a800-0000000000a1');
INSERT INTO public.immobilisations (vehicle_id, debut, fin, cause, imputation, description, statut) VALUES
  ('00000000-0000-4000-a800-0000000000b1', '2001-05-10 06:00+00', '2001-05-10 16:00+00', 'panne', 'loueur', 'x', 'cloturee');
INSERT INTO public.fiches_terrain (id, numero, type, date_fiche, site_id, shift_id, statut) VALUES
  ('00000000-0000-4000-a800-0000000000f1', 'FP-010510-958', 'pointage_engins', '2001-05-10', '00000000-0000-4000-a800-0000000000a1', '00000000-0000-4000-a800-0000000000e1', 'saisie');
INSERT INTO public.pointages_engins (fiche_id, vehicle_id, index_debut, index_fin) VALUES
  ('00000000-0000-4000-a800-0000000000f1', '00000000-0000-4000-a800-0000000000b2', 1000, 1008);
INSERT INTO public.postes (id, date_poste, shift_id, site_id, statut, consignes_sortie, bilan, cloture_le) VALUES
  ('00000000-0000-4000-a800-0000000000d1', '2001-05-10', '00000000-0000-4000-a800-0000000000e1', '00000000-0000-4000-a800-0000000000a1',
   'cloture', 'RAS', '{"tonnes_cible": null, "voyages": 4, "voyages_livres": 2}', '2001-05-10 18:00+00');
INSERT INTO public.contrats (id, reference, intitule, nature, contrepartie, devise, date_debut, statut) VALUES
  ('00000000-0000-4000-a800-0000000000c1', 'TEST-D058-LOC', 'Location test', 'location', 'Loueur D-058', 'USD', '2001-01-01', 'actif');
INSERT INTO public.factures_fournisseur (contrat_id, numero_fournisseur, date_facture, periode_debut, periode_fin, devise, montant_ht_facture, statut) VALUES
  ('00000000-0000-4000-a800-0000000000c1', 'D058-F1', '2001-06-02', '2001-05-01', '2001-05-31', 'USD', 1000, 'saisie');

-- Couts directs : fonction serveur, pas d'ecriture directe ni de suppression
SELECT pg_temp.se_connecter('00000000-0000-4000-a800-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE c1 AS SELECT public.enregistrer_cout('2001-05-10', 'Location groupe electrogene', 1600, 'gnf', p_site => '00000000-0000-4000-a800-0000000000a1') AS id;
CREATE TEMP TABLE c2 AS SELECT public.enregistrer_cout('2001-05-10', 'Saisie en double', 900, 'GNF', p_site => '00000000-0000-4000-a800-0000000000a1') AS id;
SELECT is((SELECT statut || ' ' || devise || ' ' || left(numero, 9) FROM public.costs WHERE id = (SELECT id FROM c1)), 'enregistre GNF CST-2001-', 'cout enregistre et numerote');
SELECT throws_ok($$INSERT INTO public.costs (date, description, amount) VALUES ('2001-05-10', 'Direct', 1)$$, '42501', NULL, 'ecriture directe refusee');
SELECT throws_ok($$DELETE FROM public.costs WHERE id = (SELECT id FROM c1)$$, '42501', NULL, 'suppression refusee');
SELECT throws_ok($$SELECT public.enregistrer_cout(current_date + 1, 'Futur', 10, 'GNF', p_site => '00000000-0000-4000-a800-0000000000a1')$$, '22023', NULL, 'date future refusee');
SELECT throws_ok($$SELECT public.enregistrer_cout('2001-05-10', 'Sans devise', 10, NULL, p_site => '00000000-0000-4000-a800-0000000000a1')$$, '22023', NULL, 'devise exigee');
SELECT throws_ok($$SELECT public.annuler_cout((SELECT id FROM c2), ' ')$$, '22023', NULL, 'annulation sans motif refusee');
SELECT public.annuler_cout((SELECT id FROM c2), 'Doublon de la piece CST precedente');
SELECT is((SELECT statut FROM public.costs WHERE id = (SELECT id FROM c2)), 'annule', 'annulation motivee');

-- Rapport journalier du directeur (profil global)
CREATE TEMP TABLE j AS SELECT pg_temp.jr('2001-05-10', '00000000-0000-4000-a800-0000000000a1') AS r;
SELECT is(pg_temp.v((SELECT r FROM j), 'Livrés') || ' ; ' || pg_temp.v((SELECT r FROM j), 'Voyages du périmètre'),
  '2|-|- ; 4|-|-', 'voyages du site et du jour (autre site exclu)');
SELECT is(pg_temp.v((SELECT r FROM j), 'Tonnes chargées (pesée départ)') || ' ; ' || pg_temp.v((SELECT r FROM j), 'Tonnes reçues (pesée arrivée)'),
  '82|0|- ; 39|1|-', 'tonnes chargees et recues, pesee manquante comptee');
SELECT is(pg_temp.v((SELECT r FROM j), 'Tonnes acceptées'), '38|0|1 voyage(s) livré(s) non encore accepté(s)', 'tonnes acceptees, attente signalee');
SELECT is(pg_temp.v((SELECT r FROM j), 'Tonnes livrées (convention D-023)') || ' ; ' || pg_temp.v((SELECT r FROM j), 'Taux de réalisation'),
  '80|0|Tonnage accepté, sinon reçu, sinon chargé ; 40.0|-|-', 'tonnes livrees et taux de realisation sur l''objectif');
SELECT is(pg_temp.v((SELECT r FROM j), 'Tickets de pesée') || ' ; ' || pg_temp.v((SELECT r FROM j), 'Voyages livrés sans ticket'),
  '1|-|- ; 1|-|-', 'tickets CBG et voyage livre sans ticket');
SELECT is(pg_temp.v((SELECT r FROM j), 'Gasoil distribué (pleins)') || ' ; ' || pg_temp.v((SELECT r FROM j), 'Montant des pleins valorisés')
       || ' ; ' || pg_temp.v((SELECT r FROM j), 'Litres par tonne livrée'),
  '400|-|- ; 3000|1|Devise non enregistrée sur les pleins ; 5.000|-|-', 'carburant (site de l''engin a defaut), plein sans prix compte');
SELECT is(pg_temp.v((SELECT r FROM j), 'Incidents déclarés') || ' ; ' || pg_temp.v((SELECT r FROM j), 'Dont gravité sévère ou critique'),
  '1|-|- ; 1|-|-', 'incidents du jour');
SELECT is(pg_temp.v((SELECT r FROM j), 'Heures d''immobilisation') || ' ; ' || pg_temp.v((SELECT r FROM j), 'Heures pointées'),
  '10.0|-|Bornées à la période et à l''heure actuelle ; 8|-|-', 'immobilisation et heures pointees');
SELECT is(pg_temp.v((SELECT r FROM j), 'Coûts directs saisis (GNF)') || ' ; ' || pg_temp.v((SELECT r FROM j), 'Coût direct par tonne livrée (GNF)'),
  '1600|-|1 dépense(s) ; hors location des engins ; 20.00|-|-', 'cout direct (annule exclu) et cout par tonne');
CREATE TEMP TABLE vide AS SELECT pg_temp.jr('2001-05-11', '00000000-0000-4000-a800-0000000000a1') AS r;
SELECT is(pg_temp.v((SELECT r FROM vide), 'Tonnes chargées (pesée départ)') || ' ; ' || pg_temp.v((SELECT r FROM vide), 'Objectif de production'),
  '-|0|Sans données ; -|-|Sans objectif saisi', 'jour sans donnees : NULL signale, jamais 0 tonne');
SELECT is((SELECT voyages || '/' || voyages_livres || '/' || tonnes_livrees || '/' || litres || '/' || heures_pointees
             FROM public.rapport_mensuel_par_jour('2001-05-20', '00000000-0000-4000-a800-0000000000a1') WHERE jour = '2001-05-10')
          || ' ; ' || (SELECT count(*) FROM public.rapport_mensuel_par_jour('2001-05-20', '00000000-0000-4000-a800-0000000000a1')),
  '4/2/80/400/8 ; 31', 'tableau jour x indicateur du mois');

-- Rapport de shift, partenaires
CREATE TEMP TABLE s AS SELECT jsonb_agg(to_jsonb(r)) AS r FROM public.rapport_shift('00000000-0000-4000-a800-0000000000d1') r;
SELECT is(pg_temp.v((SELECT r FROM s), 'Voyages (bilan figé)') || ' ; ' || pg_temp.v((SELECT r FROM s), 'Livrés')
       || ' ; ' || pg_temp.v((SELECT r FROM s), 'Gasoil distribué (pleins)'),
  '4|-|- ; 2|-|- ; -|-|Non rattaché au poste', 'rapport de shift : bilan fige, voyages du shift, carburant non rattache');
CREATE TEMP TABLE lo AS SELECT jsonb_agg(to_jsonb(r)) AS r FROM public.rapport_loueur('2001-05-01', '2001-05-31', '00000000-0000-4000-a800-0000000000a1') r;
SELECT is(pg_temp.v((SELECT r FROM lo), 'Heures de marche pointées') || ' ; ' || pg_temp.v((SELECT r FROM lo), 'Dont imputables au loueur')
       || ' ; ' || pg_temp.v((SELECT r FROM lo), 'Montant attendu au contrôle (USD)'),
  '8|-|- ; 10.0|-|- ; -|1|1 facture(s) non contrôlée(s)', 'rapport loueur : heures, imputation, facture non controlee signalee');
CREATE TEMP TABLE cl AS SELECT jsonb_agg(to_jsonb(r)) AS r FROM public.rapport_client('2001-05-01', '2001-05-31', '00000000-0000-4000-a800-0000000000a1') r;
SELECT is(pg_temp.v((SELECT r FROM cl), 'Voyages livrés') || ' ; ' || pg_temp.v((SELECT r FROM cl), 'Tonnes acceptées')
       || ' ; ' || pg_temp.v((SELECT r FROM cl), 'Factures émises'),
  '2|-|Au départ ou à l''arrivée du site ; 38|0|- ; -|-|Sans données', 'rapport client : livraisons, acceptation, sans facture');

-- Rapport fige : append-only, perimetre
CREATE TEMP TABLE rf AS SELECT public.figer_rapport('journalier', '2001-05-10', NULL, '00000000-0000-4000-a800-0000000000a1', NULL, 'Rapport du 10 mai') AS id;
SELECT is((SELECT left(numero, 4) || ' ' || type || ' ' || (jsonb_array_length(lignes) > 20)::text FROM public.rapports_figes WHERE id = (SELECT id FROM rf)),
  'RAP- journalier true', 'rapport journalier fige avec ses lignes');
SELECT throws_ok($$UPDATE public.rapports_figes SET note = 'x' WHERE id = (SELECT id FROM rf)$$, '42501', NULL, 'rapport fige non modifiable');
SELECT throws_ok($$SELECT public.figer_rapport('journalier', current_date + 2, NULL, '00000000-0000-4000-a800-0000000000a1')$$, '22023', NULL, 'periode future refusee');
RESET ROLE;

-- Droits de lecture : la maintenance ne voit pas les voyages
SELECT pg_temp.se_connecter('00000000-0000-4000-a800-000000000002');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE m AS SELECT pg_temp.jr('2001-05-10', '00000000-0000-4000-a800-0000000000a1') AS r;
SELECT is(pg_temp.v((SELECT r FROM m), 'Livrés') || ' ; ' || pg_temp.v((SELECT r FROM m), 'Immobilisations déclarées'),
  '-|-|Non visible avec vos droits de lecture ; 1|-|-', 'hors droits : valeur NULL signalee, jamais 0');
RESET ROLE;

-- Perimetre site et droit d'ecriture
SELECT pg_temp.se_connecter('00000000-0000-4000-a800-000000000003');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.enregistrer_cout('2001-05-10', 'Hors site', 10, 'GNF', p_site => '00000000-0000-4000-a800-0000000000a1')$$, '42501', NULL, 'cout hors perimetre refuse');
SELECT throws_ok($$SELECT public.figer_rapport('journalier', '2001-05-10', NULL, '00000000-0000-4000-a800-0000000000a1')$$, '42501', NULL, 'rapport fige hors perimetre refuse');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-a800-000000000004');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.enregistrer_cout('2001-05-10', 'Chauffeur', 10, 'GNF')$$, '42501', NULL, 'sans droit costs : refuse');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
