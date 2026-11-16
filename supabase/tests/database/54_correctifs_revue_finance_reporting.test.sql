-- Tests (D-072, constats R3 : D-054 a D-058) : reste a payer (taxes au
-- prorata, facture notifiee, droits), reverification des paiements,
-- annulation de reception, pilotage (immobilisation annulee, domaine
-- illisible), rapports figes, rattachements d'incident, garde de depart,
-- revision de cause (migration 20261120102000). Tout est annule ; periode 2001.
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

SELECT plan(28);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-c540-000000000001', 'logistique.d072r3@exemple.invalid'),
  ('00000000-0000-4000-c540-000000000002', 'comptable.a.d072r3@exemple.invalid'),
  ('00000000-0000-4000-c540-000000000003', 'comptable.b.d072r3@exemple.invalid'),
  ('00000000-0000-4000-c540-000000000004', 'chauffeur.d072r3@exemple.invalid'),
  ('00000000-0000-4000-c540-000000000011', 'admin.d072r3@exemple.invalid'),
  ('00000000-0000-4000-c540-000000000012', 'maintenance.d072r3@exemple.invalid'),
  ('00000000-0000-4000-c540-000000000013', 'exploitation.d072r3@exemple.invalid'),
  ('00000000-0000-4000-c540-000000000014', 'directeur.d072r3@exemple.invalid'),
  ('00000000-0000-4000-c540-000000000015', 'exploitation.site.d072r3@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-c540-0000000000a1', 'Mine D-072 R3', 'mine'),
  ('00000000-0000-4000-c540-0000000000a2', 'Port D-072 R3', 'port');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-c540-000000000001', 'logistician', 'Logistique R3', 'active', NULL),
  ('00000000-0000-4000-c540-000000000002', 'accountant', 'Comptable A R3', 'active', NULL),
  ('00000000-0000-4000-c540-000000000003', 'accountant', 'Comptable B R3', 'active', NULL),
  ('00000000-0000-4000-c540-000000000004', 'driver', 'Chauffeur R3', 'active', NULL),
  ('00000000-0000-4000-c540-000000000011', 'admin', 'Admin R3', 'active', NULL),
  ('00000000-0000-4000-c540-000000000012', 'maintenance_chief', 'Maintenance R3', 'active', NULL),
  ('00000000-0000-4000-c540-000000000013', 'operations_manager', 'Exploitation R3', 'active', NULL),
  ('00000000-0000-4000-c540-000000000014', 'director', 'Directeur R3', 'active', NULL),
  ('00000000-0000-4000-c540-000000000015', 'operations_manager', 'Exploitation site R3', 'active', '00000000-0000-4000-c540-0000000000a1')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.droits_utilisateur (utilisateur, module, niveau) VALUES
  ('00000000-0000-4000-c540-000000000014', 'trips', 'aucun'),
  ('00000000-0000-4000-c540-000000000014', 'planning', 'aucun');
INSERT INTO public.warehouses (id, name, code, warehouse_type, site_id) VALUES
  ('00000000-0000-4000-c540-0000000000d1', 'Magasin R3', 'TEST-MAG-D072R3', 'main', '00000000-0000-4000-c540-0000000000a1');
INSERT INTO public.suppliers (id, supplier_number, supplier_type, company_name) VALUES
  ('00000000-0000-4000-c540-0000000000f1', 'TEST-F-D072R3', 'parts', 'Fournisseur R3');
INSERT INTO public.contrats (id, reference, intitule, nature, contrepartie, devise, date_debut, statut) VALUES
  ('00000000-0000-4000-c540-0000000000c1', 'TEST-D072R3-LOC', 'Location test', 'location', 'Loueur R3', 'USD', '2001-01-01', 'actif');
INSERT INTO public.factures_fournisseur (id, contrat_id, numero_fournisseur, date_facture, periode_debut, periode_fin, devise,
                                         montant_ht_facture, montant_ttc_facture, montant_reclame, statut) VALUES
  ('00000000-0000-4000-c540-0000000000e1', '00000000-0000-4000-c540-0000000000c1', 'R3-F1', '2001-02-01', '2001-01-01', '2001-01-31', 'USD', 1000, 1180, NULL, 'conforme'),
  ('00000000-0000-4000-c540-0000000000e2', '00000000-0000-4000-c540-0000000000c1', 'R3-F2', '2001-02-01', '2001-01-01', '2001-01-31', 'USD', 1000, 1180, NULL, 'conforme'),
  ('00000000-0000-4000-c540-0000000000e3', '00000000-0000-4000-c540-0000000000c1', 'R3-F3', '2001-03-01', '2001-02-01', '2001-02-28', 'USD', 1000, 1180, 200, 'notifiee'),
  ('00000000-0000-4000-c540-0000000000e4', '00000000-0000-4000-c540-0000000000c1', 'R3-F4', '2001-04-02', '2001-03-01', '2001-03-31', 'USD', 987654, NULL, NULL, 'saisie');
INSERT INTO public.regularisations_fournisseur (facture_id, date_regularisation, montant, mode) VALUES
  ('00000000-0000-4000-c540-0000000000e3', '2001-03-05', 150, 'avoir');
DELETE FROM public.settings WHERE key IN ('achats_validation_separee', 'paiements_validation_separee');

-- Bon 1 : 10 x 100 + taxes 180, recu a moitie puis solde ; bon 2 : 1 x 1000 recu.
SELECT pg_temp.se_connecter('00000000-0000-4000-c540-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE bc AS
  SELECT 1 AS n, public.enregistrer_bon_commande(p_fournisseur => '00000000-0000-4000-c540-0000000000f1', p_depot => '00000000-0000-4000-c540-0000000000d1',
    p_lignes => '[{"designation": "Prestation", "quantite": 10, "prix_unitaire": 100}]'::jsonb, p_taxes => 180) AS id
  UNION ALL
  SELECT 2, public.enregistrer_bon_commande(p_fournisseur => '00000000-0000-4000-c540-0000000000f1', p_depot => '00000000-0000-4000-c540-0000000000d1',
    p_lignes => '[{"designation": "Piece", "quantite": 1, "prix_unitaire": 1000}]'::jsonb);
SELECT public.soumettre_bon_commande(id) FROM bc;
GRANT SELECT ON bc TO PUBLIC;
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-c540-000000000003');
SET LOCAL ROLE authenticated;
SELECT public.decider_bon_commande(id, true) FROM bc;
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-c540-000000000001');
SET LOCAL ROLE authenticated;
SELECT public.receptionner_bon_commande((SELECT id FROM bc WHERE n = 1),
  jsonb_build_array(jsonb_build_object('ligne', (SELECT i.id FROM public.purchase_order_items i WHERE i.purchase_order_id = (SELECT id FROM bc WHERE n = 1)), 'recue', 5)));
SELECT public.solder_bon_commande((SELECT id FROM bc WHERE n = 1), 'Reliquat abandonne');
CREATE TEMP TABLE rec AS SELECT public.receptionner_bon_commande((SELECT id FROM bc WHERE n = 2),
  jsonb_build_array(jsonb_build_object('ligne', (SELECT i.id FROM public.purchase_order_items i WHERE i.purchase_order_id = (SELECT id FROM bc WHERE n = 2)), 'recue', 1))) AS id;
GRANT SELECT ON rec TO PUBLIC;
RESET ROLE;

-- R3-4, R3-11 : base payable
SELECT pg_temp.se_connecter('00000000-0000-4000-c540-000000000002');
SET LOCAL ROLE authenticated;
SELECT is((SELECT reste FROM public.reste_a_payer(NULL, (SELECT id FROM bc WHERE n = 1))), 590::numeric,
  'R3-4 bon solde a moitie : 500 recus + taxes au prorata (90)');
SELECT is((SELECT base FROM public.reste_a_payer('00000000-0000-4000-c540-0000000000e3', NULL)), 980::numeric,
  'R3-11 facture notifiee : 1180 moins le plus grand du reclame (200) et des avoirs (150)');
CREATE TEMP TABLE p2 AS SELECT public.proposer_paiement(1000, 'Piece', p_bon => (SELECT id FROM bc WHERE n = 2)) AS id;
CREATE TEMP TABLE pf AS SELECT public.proposer_paiement(500, 'Acompte', p_facture => '00000000-0000-4000-c540-0000000000e1') AS id;
CREATE TEMP TABLE pf2 AS SELECT public.proposer_paiement(100, 'Acompte', p_facture => '00000000-0000-4000-c540-0000000000e2') AS id;
GRANT SELECT ON p2, pf, pf2 TO PUBLIC;
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-c540-000000000003');
SET LOCAL ROLE authenticated;
SELECT public.decider_paiement((SELECT id FROM p2), true);
SELECT public.decider_paiement((SELECT id FROM pf), true);
RESET ROLE;

-- R3-5 : annulation de reception sous un paiement engage ; piece devenue non payable
SELECT pg_temp.se_connecter('00000000-0000-4000-c540-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.annuler_reception((SELECT id FROM rec), 'Erreur de saisie')$$, '22023', NULL,
  'R3-5 reception non annulable sous un paiement approuve');
SELECT is((SELECT status FROM public.purchase_orders WHERE id = (SELECT id FROM bc WHERE n = 2)), 'received', 'R3-5 bon toujours recu');
RESET ROLE;
UPDATE public.factures_fournisseur SET statut = 'saisie' WHERE id IN ('00000000-0000-4000-c540-0000000000e1', '00000000-0000-4000-c540-0000000000e2');
SELECT pg_temp.se_connecter('00000000-0000-4000-c540-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.enregistrer_execution_paiement((SELECT id FROM pf), current_date, 'especes', 500)$$, '22023', NULL,
  'R3-5 facture redevenue non controlee : execution refusee');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-c540-000000000003');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.decider_paiement((SELECT id FROM pf2), true)$$, '22023', NULL,
  'R3-5 facture redevenue non controlee : approbation refusee');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-c540-000000000002');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.enregistrer_execution_paiement((SELECT id FROM p2), current_date, 'especes', 1000)$$,
  'R3-5 bon recu : execution du paiement approuve acceptee');
RESET ROLE;

-- R3-7 : oracles bornes
SELECT pg_temp.se_connecter('00000000-0000-4000-c540-000000000004');
SET LOCAL ROLE authenticated;
SELECT is((SELECT beneficiaire || ' ' || base FROM public.reste_a_payer('00000000-0000-4000-c540-0000000000e3', NULL)), NULL,
  'R3-7 chauffeur : reste_a_payer ne revele ni beneficiaire ni montant');
RESET ROLE;
SELECT is(has_function_privilege('authenticated', 'public.controle_depart_du_jour(uuid, date)', 'EXECUTE'), false,
  'R3-7 controle_depart_du_jour non executable par les comptes');

-- Pilotage, rapports, incidents
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status, site_id) VALUES
  ('00000000-0000-4000-c540-0000000000b1', 'TEST-D072R3-1', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-c540-0000000000a1'),
  ('00000000-0000-4000-c540-0000000000b2', 'TEST-D072R3-2', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-c540-0000000000a2'),
  ('00000000-0000-4000-c540-0000000000b3', 'TEST-D072R3-3', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-c540-0000000000a1');
INSERT INTO public.drivers (id, name, license_number, license_category, license_expiry, hire_date, status) VALUES
  ('00000000-0000-4000-c540-0000000000c9', 'Chauffeur R3', 'D072R3-1', 'C', current_date + 100, current_date - 100, 'active');
INSERT INTO public.work_shifts (id, name, display_name, start_time, end_time, shift_order) VALUES
  ('00000000-0000-4000-c540-0000000000e9', 'test_jour_d072r3', 'Jour R3', '06:00', '18:00', 95);
SELECT pg_temp.se_connecter(NULL);
INSERT INTO public.trips (id, reference, planned_date, vehicle_id, departure_site_id, etat) VALUES
  ('00000000-0000-4000-c540-000000000101', 'T-D072R3-1', '2001-03-10', '00000000-0000-4000-c540-0000000000b1', '00000000-0000-4000-c540-0000000000a1', 'PLANNED');
INSERT INTO public.immobilisations (vehicle_id, debut, fin, cause, imputation, description, statut) VALUES
  ('00000000-0000-4000-c540-0000000000b1', '2001-03-10 06:00+00', NULL, 'panne', 'loueur', 'Saisie erronee', 'annulee');
INSERT INTO public.incidents (incident_time, description, severity, type, site_id) VALUES
  ('2001-03-12 10:00+00', 'Incident R3', 'minor', 'materiel', '00000000-0000-4000-c540-0000000000a1');
INSERT INTO public.postes (id, date_poste, shift_id, site_id, statut, consignes_sortie, bilan, cloture_le) VALUES
  ('00000000-0000-4000-c540-0000000000d9', '2001-03-10', '00000000-0000-4000-c540-0000000000e9', '00000000-0000-4000-c540-0000000000a1',
   'cloture', 'RAS', '{"tonnes_livrees": 123}', '2001-03-10 18:00+00');

-- R3-2 : immobilisation annulee ni en cours ni comptee
SELECT pg_temp.se_connecter('00000000-0000-4000-c540-000000000011');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE k AS SELECT * FROM public.indicateurs_pilotage('2001-03-01', '2001-03-31', '00000000-0000-4000-c540-0000000000a1');
SELECT is((SELECT valeur FROM k WHERE code = 'immobilisations_ouvertes'), 0::numeric, 'R3-2 une immobilisation annulee n''est pas en cours');
SELECT is((SELECT valeur FROM k WHERE code = 'heures_immobilisation'), NULL, 'R3-2 une immobilisation annulee ne compte aucune heure');
CREATE TEMP TABLE rf AS SELECT public.figer_rapport('loueur', '2001-03-01', '2001-03-31', '00000000-0000-4000-c540-0000000000a1') AS id;
GRANT SELECT ON rf TO PUBLIC;
SELECT is((SELECT count(*)::int FROM public.rapports_figes WHERE id = (SELECT id FROM rf)), 1, 'R3-1 l''administrateur lit le rapport loueur fige');
RESET ROLE;

-- R3-6 : domaine illisible « sans donnees »
SELECT pg_temp.se_connecter('00000000-0000-4000-c540-000000000012');
SET LOCAL ROLE authenticated;
SELECT is((SELECT fiabilite || ' ' || coalesce(valeur::text, 'NULL') || ' ' || detail FROM public.indicateurs_pilotage('2001-03-01', '2001-03-31', NULL) WHERE code = 'incidents'),
  'sans_donnees NULL Non visible avec vos droits de lecture', 'R3-6 incidents illisibles : sans donnees, jamais 0 mesure');
SELECT is((SELECT fiabilite FROM public.indicateurs_pilotage('2001-03-01', '2001-03-31', NULL) WHERE code = 'immobilisations_ouvertes'), 'mesure',
  'R3-6 domaine lisible (maintenance) : mesure');
RESET ROLE;

-- R3-1 : rapport fige lu avec le droit de son domaine
SELECT pg_temp.se_connecter('00000000-0000-4000-c540-000000000013');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.rapports_figes WHERE id = (SELECT id FROM rf)), 0,
  'R3-1 l''exploitation ne lit pas le rapport loueur fige (montants du loueur)');
RESET ROLE;

-- R3-3 : le bilan d'un poste illisible n'est pas fige
SELECT pg_temp.se_connecter('00000000-0000-4000-c540-000000000014');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE rs AS SELECT public.figer_rapport('shift', p_poste => '00000000-0000-4000-c540-0000000000d9') AS id;
RESET ROLE;
SELECT is((SELECT (l ->> 'valeur') || '|' || (l ->> 'remarque') FROM public.rapports_figes r, jsonb_array_elements(r.lignes) l
            WHERE r.id = (SELECT id FROM rs) AND l ->> 'indicateur' = 'Tonnes livrées (bilan figé)'), NULL,
  'R3-3 sans droit voyages ni planification : bilan du poste non fige');
SELECT is((SELECT l ->> 'remarque' FROM public.rapports_figes r, jsonb_array_elements(r.lignes) l
            WHERE r.id = (SELECT id FROM rs) AND l ->> 'indicateur' = 'Tonnes livrées (bilan figé)'), 'Non visible avec vos droits de lecture',
  'R3-3 la ligne fige indique « non visible »');

-- R3-7, R3-8 : site d'un engin hors perimetre, rattachements d'incident
SELECT pg_temp.se_connecter('00000000-0000-4000-c540-000000000015');
SET LOCAL ROLE authenticated;
SELECT is(public.site_engin('00000000-0000-4000-c540-0000000000b2'), NULL, 'R3-7 site_engin : site d''un engin hors perimetre non revele');
SELECT is(public.site_engin('00000000-0000-4000-c540-0000000000b1'), '00000000-0000-4000-c540-0000000000a1'::uuid, 'R3-7 site_engin : engin du perimetre');
SELECT throws_ok($$SELECT public.declarer_incident('materiel', 'minor', 'Test', now(), p_vehicle => '00000000-0000-4000-c540-0000000000b2',
                   p_trip => '00000000-0000-4000-c540-000000000101')$$,
  '42501', NULL, 'R3-8 engin d''un autre site refuse meme avec un voyage du site');
SELECT throws_ok($$SELECT public.declarer_incident('materiel', 'minor', 'Test', now(), p_vehicle => '00000000-0000-4000-c540-0000000000b3',
                   p_trip => '00000000-0000-4000-c540-000000000101')$$,
  '22023', NULL, 'R3-8 engin different de celui du voyage refuse');
SELECT throws_ok($$SELECT public.declarer_incident('materiel', 'minor', 'Test', now(), p_trip => '00000000-0000-4000-c540-000000000101',
                   p_site => '00000000-0000-4000-c540-0000000000a2')$$,
  '42501', NULL, 'R3-8 site hors perimetre refuse');
RESET ROLE;

-- R3-9 : un controle saisi apres le depart ne l'autorise pas
DELETE FROM public.habilitations_requises;
UPDATE public.points_controle_depart SET actif = false;
INSERT INTO public.points_controle_depart (id, libelle, categorie, bloquant, ordre) VALUES
  ('00000000-0000-4000-c540-0000000000e7', 'Freins', 'freinage', true, 1);
DELETE FROM public.settings WHERE key = 'controle_depart_exige';
INSERT INTO public.settings (key, value, category) VALUES ('controle_depart_exige', '{"value": "true"}', 'hse');
SELECT pg_temp.se_connecter(NULL);
INSERT INTO public.trips (id, reference, planned_date, vehicle_id, driver_id, departure_site_id, etat) VALUES
  ('00000000-0000-4000-c540-000000000102', 'T-D072R3-2', current_date, '00000000-0000-4000-c540-0000000000b3',
   '00000000-0000-4000-c540-0000000000c9', '00000000-0000-4000-c540-0000000000a1', 'ASSIGNED');
INSERT INTO public.trip_events (trip_id, etat_avant, etat_apres, survenu_le, note)
VALUES ('00000000-0000-4000-c540-000000000102', 'PLANNED', 'ASSIGNED', now() - interval '3 hours', 'Test');
SELECT pg_temp.se_connecter('00000000-0000-4000-c540-000000000013');
SET LOCAL ROLE authenticated;
SELECT public.enregistrer_controle_depart('00000000-0000-4000-c540-0000000000b3',
  '[{"point": "00000000-0000-4000-c540-0000000000e7", "resultat": "conforme"}]'::jsonb, p_date => now());
SELECT throws_ok($$SELECT public.avancer_voyage('00000000-0000-4000-c540-000000000102', 'AT_LOADING', now() - interval '1 minute')$$,
  '22023', NULL, 'R3-9 depart anterieur au seul controle du jour refuse');
SELECT lives_ok($$SELECT public.avancer_voyage('00000000-0000-4000-c540-000000000102', 'AT_LOADING', now())$$,
  'R3-9 depart apres le controle autorise');

-- R3-10 : revision d'une cause motivee et journalisee
CREATE TEMP TABLE inc AS SELECT public.declarer_incident('presque_accident', 'moderate', 'Freinage tardif', now() - interval '20 minutes',
  p_vehicle => '00000000-0000-4000-c540-0000000000b3') AS id;
SELECT public.analyser_incident((SELECT id FROM inc), 'Freins uses');
SELECT throws_ok($$SELECT public.analyser_incident((SELECT id FROM inc), 'Chaussee glissante')$$, '22023', NULL,
  'R3-10 revision de la cause sans motif refusee');
SELECT lives_ok($$SELECT public.analyser_incident((SELECT id FROM inc), 'Chaussee glissante', 'Expertise du chef de quart')$$,
  'R3-10 revision motivee acceptee');
SELECT is((SELECT string_agg(action || ':' || coalesce(cause_avant, '-') || '>' || cause_apres, ' ; ' ORDER BY id)
             FROM public.incidents_journal WHERE incident_id = (SELECT id FROM inc)),
  'analyse:->Freins uses ; revision_cause:Freins uses>Chaussee glissante', 'R3-10 chaque analyse est journalisee');
SELECT throws_ok($$UPDATE public.incidents_journal SET motif = 'x' WHERE incident_id = (SELECT id FROM inc)$$, '42501', NULL,
  'R3-10 journal des analyses non modifiable');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
