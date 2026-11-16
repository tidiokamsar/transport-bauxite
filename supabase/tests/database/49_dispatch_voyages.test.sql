-- Tests (D-066) : affectation groupee (rapport par voyage), reaffectation
-- directe apres livraison, statistiques de trajets pour la simulation,
-- rapports par axe, registre des infractions et sanctions (migration
-- 20261121100000_dispatch_voyages). Tout est annule.
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

SELECT plan(80);

-- Voyage affecte -> livre, toutes les etapes a l'heure de la transaction.
CREATE FUNCTION pg_temp.livrer_maintenant(p_trip uuid) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE e text;
BEGIN
  FOREACH e IN ARRAY ARRAY['AT_LOADING', 'LOADING', 'LOADED', 'IN_TRANSIT', 'AT_DESTINATION', 'UNLOADING', 'DELIVERED'] LOOP
    PERFORM public.avancer_voyage(p_trip, e, now(), NULL, '{}'::jsonb);
  END LOOP;
END;
$$;
-- Controle avant depart et habilitations neutralises (tests 09 et 11).
DELETE FROM public.settings WHERE key = 'controle_depart_exige';
DELETE FROM public.habilitations_requises;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a660-000000000001', 'operations.d066@exemple.invalid'),
  ('00000000-0000-4000-a660-000000000002', 'directeur.d066@exemple.invalid'),
  ('00000000-0000-4000-a660-000000000003', 'comptable.d066@exemple.invalid'),
  ('00000000-0000-4000-a660-000000000004', 'operations.site.d066@exemple.invalid'),
  ('00000000-0000-4000-a660-000000000005', 'operations.depota.d066@exemple.invalid'),
  ('00000000-0000-4000-a660-000000000006', 'directeur.depotb.d066@exemple.invalid'),
  ('00000000-0000-4000-a660-000000000007', 'operations.mine.d066@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-a660-0000000000a1', 'Mine D-066', 'mine'),
  ('00000000-0000-4000-a660-0000000000a2', 'Depot A D-066', 'depot'),
  ('00000000-0000-4000-a660-0000000000a3', 'Depot B D-066', 'depot');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-a660-000000000001', 'operations_manager', 'Operations D-066', 'active', NULL),
  ('00000000-0000-4000-a660-000000000002', 'director', 'Directeur D-066', 'active', NULL),
  ('00000000-0000-4000-a660-000000000003', 'accountant', 'Comptable D-066', 'active', NULL),
  ('00000000-0000-4000-a660-000000000004', 'operations_manager', 'Operations depot B D-066', 'active', '00000000-0000-4000-a660-0000000000a3'),
  ('00000000-0000-4000-a660-000000000005', 'operations_manager', 'Operations depot A D-066', 'active', '00000000-0000-4000-a660-0000000000a2'),
  ('00000000-0000-4000-a660-000000000006', 'director', 'Directeur depot B D-066', 'active', '00000000-0000-4000-a660-0000000000a3'),
  ('00000000-0000-4000-a660-000000000007', 'operations_manager', 'Operations mine D-066', 'active', '00000000-0000-4000-a660-0000000000a1')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status, site_id) VALUES
  ('00000000-0000-4000-a660-0000000000b1', 'TEST-D066-1', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-a660-0000000000a1'),
  ('00000000-0000-4000-a660-0000000000b2', 'TEST-D066-2', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-a660-0000000000a1'),
  ('00000000-0000-4000-a660-0000000000b3', 'TEST-D066-3', 'Test', 40, 'tipper', 'immobilized', '00000000-0000-4000-a660-0000000000a1'),
  ('00000000-0000-4000-a660-0000000000e1', 'TEST-D066-CHG', 'Test', 10, 'loader', 'active', '00000000-0000-4000-a660-0000000000a1'),
  ('00000000-0000-4000-a660-0000000000b4', 'TEST-D066-4', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-a660-0000000000a1'),
  ('00000000-0000-4000-a660-0000000000b5', 'TEST-D066-5', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-a660-0000000000a1'),
  ('00000000-0000-4000-a660-0000000000b6', 'TEST-D066-6', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-a660-0000000000a1');
INSERT INTO public.drivers (id, name, license_number, license_category, license_expiry, hire_date, status, site_id) VALUES
  ('00000000-0000-4000-a660-0000000000c1', 'Chauffeur un D-066', 'D066-1', 'C', current_date + 100, current_date - 100, 'active', '00000000-0000-4000-a660-0000000000a1'),
  ('00000000-0000-4000-a660-0000000000c2', 'Chauffeur deux D-066', 'D066-2', 'C', current_date + 100, current_date - 100, 'active', '00000000-0000-4000-a660-0000000000a1'),
  ('00000000-0000-4000-a660-0000000000c3', 'Chauffeur expire D-066', 'D066-3', 'C', current_date - 1, current_date - 100, 'active', '00000000-0000-4000-a660-0000000000a1'),
  ('00000000-0000-4000-a660-0000000000c4', 'Chauffeur depot B D-066', 'D066-4', 'C', current_date + 100, current_date - 100, 'active', '00000000-0000-4000-a660-0000000000a3'),
  ('00000000-0000-4000-a660-0000000000c5', 'Chauffeur cinq D-066', 'D066-5', 'C', current_date + 100, current_date - 100, 'active', '00000000-0000-4000-a660-0000000000a1'),
  ('00000000-0000-4000-a660-0000000000c6', 'Chauffeur six D-066', 'D066-6', 'C', current_date + 100, current_date - 100, 'active', '00000000-0000-4000-a660-0000000000a1'),
  ('00000000-0000-4000-a660-0000000000c7', 'Chauffeur mute D-066', 'D066-7', 'C', current_date + 100, current_date - 100, 'active', '00000000-0000-4000-a660-0000000000a1');

-- Responsable des operations (global)
SELECT pg_temp.se_connecter('00000000-0000-4000-a660-000000000001');
SET LOCAL ROLE authenticated;

-- 1. Affectation groupee
SELECT is(public.preparer_voyages(current_date, '00000000-0000-4000-a660-0000000000a1',
  '00000000-0000-4000-a660-0000000000a2', NULL, 3), 3, 'trois voyages prepares');
CREATE TEMP TABLE vs AS
  SELECT id, row_number() OVER (ORDER BY reference) AS n FROM public.trips
   WHERE departure_site_id = '00000000-0000-4000-a660-0000000000a1' AND planned_date = current_date;

CREATE TEMP TABLE rapport AS
  SELECT * FROM public.affecter_en_groupe(jsonb_build_array(
    jsonb_build_object('voyage', (SELECT id FROM vs WHERE n = 1), 'camion', '00000000-0000-4000-a660-0000000000b1',
                       'chauffeur', '00000000-0000-4000-a660-0000000000c1', 'engin', '00000000-0000-4000-a660-0000000000e1',
                       'recommandation', '{"camion": "TEST-D066-1"}'::jsonb),
    jsonb_build_object('voyage', (SELECT id FROM vs WHERE n = 2), 'camion', '00000000-0000-4000-a660-0000000000b3',
                       'chauffeur', '00000000-0000-4000-a660-0000000000c2'),
    jsonb_build_object('voyage', (SELECT id FROM vs WHERE n = 3), 'camion', '00000000-0000-4000-a660-0000000000b2',
                       'chauffeur', '00000000-0000-4000-a660-0000000000c3'),
    jsonb_build_object('voyage', (SELECT id FROM vs WHERE n = 1), 'camion', '00000000-0000-4000-a660-0000000000b2',
                       'chauffeur', '00000000-0000-4000-a660-0000000000c2')));
SELECT is((SELECT count(*)::int FROM rapport), 4, 'une ligne de rapport par voyage demande');
SELECT is((SELECT string_agg(resultat, ',' ORDER BY resultat) FROM rapport), 'affecte,refuse,refuse,refuse',
  'un voyage affecte, trois refuses');
SELECT ok((SELECT raison FROM rapport WHERE trip_id = (SELECT id FROM vs WHERE n = 2)) LIKE 'Camion indisponible%',
  'raison du refus : camion immobilise');
SELECT ok((SELECT raison FROM rapport WHERE trip_id = (SELECT id FROM vs WHERE n = 3)) LIKE 'Permis%',
  'raison du refus : permis expire');
SELECT ok((SELECT bool_and(raison LIKE 'Voyage deja affecte%') FROM rapport
            WHERE trip_id = (SELECT id FROM vs WHERE n = 1) AND resultat = 'refuse'),
  'un voyage deja affecte n''est pas reaffecte en groupe');
SELECT is((SELECT string_agg(etat, ',' ORDER BY n) FROM public.trips t JOIN vs ON vs.id = t.id), 'ASSIGNED,PLANNED,PLANNED',
  'un refus n''annule que son voyage');
SELECT is((SELECT (count(*), max(recommandation ->> 'operation'))::text FROM public.decisions_dispatch WHERE trip_id IN (SELECT id FROM vs)),
  '(1,groupee)', 'seule l''affectation acceptee est historisee, marquee groupee');
SELECT throws_ok($$SELECT * FROM public.affecter_en_groupe('[]'::jsonb)$$, '22023', NULL, 'liste vide refusee');

-- 2. Reaffectation directe apres livraison
SELECT throws_ok($$SELECT public.enchainer_voyage((SELECT id FROM vs WHERE n = 1), NULL)$$, '22023', NULL,
  'un voyage non livre ne s''enchaine pas');
SELECT lives_ok($$SELECT pg_temp.livrer_maintenant((SELECT id FROM vs WHERE n = 1))$$, 'le premier voyage est livre');
CREATE TEMP TABLE suivant (id uuid);
INSERT INTO suivant SELECT public.enchainer_voyage((SELECT id FROM vs WHERE n = 1), '00000000-0000-4000-a660-0000000000e1');
SELECT is((SELECT (etat, vehicle_id, driver_id, loader_vehicle_id, arrival_site_id)::text FROM public.trips WHERE id = (SELECT id FROM suivant)),
  '(ASSIGNED,00000000-0000-4000-a660-0000000000b1,00000000-0000-4000-a660-0000000000c1,00000000-0000-4000-a660-0000000000e1,00000000-0000-4000-a660-0000000000a2)',
  'voyage suivant affecte au meme camion et au meme chauffeur, meme trajet');
SELECT is((SELECT etat FROM public.trips WHERE id = (SELECT id FROM vs WHERE n = 1)), 'DELIVERED',
  'le voyage livre reste livre (aucun retour force au parking)');
SELECT is((SELECT (decision, nature, recommandation ->> 'regle')::text FROM public.decisions_dispatch WHERE trip_id = (SELECT id FROM suivant)),
  '(acceptee,affectation,enchainement)', 'l''enchainement est une decision historisee');
SELECT throws_ok($$SELECT public.enchainer_voyage((SELECT id FROM vs WHERE n = 1), NULL)$$, '22023', NULL,
  'camion deja engage sur le voyage suivant : pas de second enchainement');

SELECT lives_ok($$SELECT public.decider_affectation((SELECT id FROM vs WHERE n = 2), 'acceptee',
  '00000000-0000-4000-a660-0000000000b2', '00000000-0000-4000-a660-0000000000c2', NULL)$$, 'deuxieme voyage affecte');
SELECT lives_ok($$SELECT pg_temp.livrer_maintenant((SELECT id FROM vs WHERE n = 2))$$, 'le deuxieme voyage est livre');
SELECT throws_ok($$SELECT public.enchainer_voyage((SELECT id FROM vs WHERE n = 2), NULL, (SELECT id FROM vs WHERE n = 1))$$,
  '22023', NULL, 'le voyage suivant designe doit etre prepare et sans camion');
SELECT lives_ok($$SELECT public.enchainer_voyage((SELECT id FROM vs WHERE n = 2), NULL, (SELECT id FROM vs WHERE n = 3))$$,
  'enchainement sur un voyage deja prepare du shift');
SELECT is((SELECT (etat, vehicle_id)::text FROM public.trips WHERE id = (SELECT id FROM vs WHERE n = 3)),
  '(ASSIGNED,00000000-0000-4000-a660-0000000000b2)', 'le voyage prepare est affecte au camion qui vient de livrer');

-- 2 bis. Habilitations (D-072 R2-C2) : un chauffeur non habilite est refuse a
-- l'affectation groupee et a l'enchainement.
RESET ROLE;
INSERT INTO public.habilitations_requises (type, note) VALUES ('visite_medicale', 'Test D-066');
SELECT pg_temp.se_connecter('00000000-0000-4000-a660-000000000001');
SET LOCAL ROLE authenticated;
SELECT is(public.preparer_voyages(current_date + 1, '00000000-0000-4000-a660-0000000000a1',
  '00000000-0000-4000-a660-0000000000a2', NULL, 1), 1, 'un voyage prepare pour le lendemain');
CREATE TEMP TABLE lendemain AS
  SELECT id FROM public.trips WHERE departure_site_id = '00000000-0000-4000-a660-0000000000a1'
     AND planned_date = current_date + 1;
CREATE TEMP TABLE hab AS
  SELECT * FROM public.affecter_en_groupe(jsonb_build_array(jsonb_build_object(
    'voyage', (SELECT id FROM lendemain),
    'camion', '00000000-0000-4000-a660-0000000000b2', 'chauffeur', '00000000-0000-4000-a660-0000000000c2')));
SELECT is((SELECT (resultat, raison LIKE 'Chauffeur non habilite%')::text FROM hab), '(refuse,t)',
  'affectation groupee : chauffeur non habilite refuse, raison rapportee');
SELECT lives_ok($$SELECT pg_temp.livrer_maintenant((SELECT id FROM vs WHERE n = 3))$$, 'le troisieme voyage est livre');
SELECT throws_like($$SELECT public.enchainer_voyage((SELECT id FROM vs WHERE n = 3), NULL)$$, '%non habilite%',
  'enchainement refuse : chauffeur non habilite a la date du voyage suivant');
SELECT is((SELECT count(*)::int FROM public.trips WHERE notes LIKE 'Enchaîné après %'
             AND driver_id = '00000000-0000-4000-a660-0000000000c2'), 0,
  'enchainement refuse : aucun voyage cree ni affecte');
RESET ROLE;
DELETE FROM public.habilitations_requises;
SELECT pg_temp.se_connecter('00000000-0000-4000-a660-000000000001');
SET LOCAL ROLE authenticated;

-- 2 ter. Chauffeur engage ailleurs, voyage rejete, voyage livre ancien.
CREATE TEMP TABLE eng AS SELECT public.creer_voyage(current_date + 2, '00000000-0000-4000-a660-0000000000a1',
  '00000000-0000-4000-a660-0000000000a3', '00000000-0000-4000-a660-0000000000b4', '00000000-0000-4000-a660-0000000000c2') AS id;
SELECT throws_like($$SELECT public.enchainer_voyage((SELECT id FROM vs WHERE n = 3), NULL)$$, 'Chauffeur deja engage sur le voyage VYG-%',
  'enchainement refuse : chauffeur engage sur un autre voyage (reference donnee dans le perimetre)');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a660-000000000005');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.enchainer_voyage((SELECT id FROM vs WHERE n = 3), NULL)$$, '22023', 'Chauffeur deja engage sur un autre voyage',
  'compte borne : reference du voyage engageant hors perimetre non revelee');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a660-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE rej AS SELECT public.creer_voyage(current_date, '00000000-0000-4000-a660-0000000000a1', '00000000-0000-4000-a660-0000000000a2',
  '00000000-0000-4000-a660-0000000000b5', '00000000-0000-4000-a660-0000000000c5') AS id;
SELECT lives_ok($$SELECT pg_temp.livrer_maintenant((SELECT id FROM rej))$$, 'voyage livre');
SELECT lives_ok($$SELECT public.avancer_voyage((SELECT id FROM rej), 'REJECTED', now(), 'Bauxite hors specification', '{}'::jsonb)$$,
  'voyage rejete a destination');
CREATE TEMP TABLE rej_suivant (id uuid);
SELECT lives_ok($$INSERT INTO rej_suivant SELECT public.enchainer_voyage((SELECT id FROM rej), NULL)$$, 'un voyage rejete s''enchaine');
SELECT is((SELECT (etat, vehicle_id, driver_id)::text FROM public.trips WHERE id = (SELECT id FROM rej_suivant)),
  '(ASSIGNED,00000000-0000-4000-a660-0000000000b5,00000000-0000-4000-a660-0000000000c5)',
  'voyage suivant d''un voyage rejete : meme camion, meme chauffeur');
CREATE TEMP TABLE ancien AS SELECT public.creer_voyage(current_date - 3, '00000000-0000-4000-a660-0000000000a1', '00000000-0000-4000-a660-0000000000a2',
  '00000000-0000-4000-a660-0000000000b6', '00000000-0000-4000-a660-0000000000c6') AS id;
SELECT lives_ok($$SELECT pg_temp.livrer_maintenant((SELECT id FROM ancien))$$, 'voyage d''il y a trois jours livre');
SELECT throws_like($$SELECT public.enchainer_voyage((SELECT id FROM ancien), NULL)$$, '%preciser la date du voyage suivant',
  'voyage livre ancien sans date : date du voyage suivant exigee');
SELECT lives_ok($$SELECT public.enchainer_voyage((SELECT id FROM ancien), NULL, NULL, current_date)$$,
  'voyage livre ancien avec la date du jour : enchaine');

-- 3. Durees, statistiques de trajets et rapports (annee 2001)
CREATE TEMP TABLE v2001 (nom text, id uuid);
INSERT INTO v2001 SELECT x.nom, public.creer_voyage('2001-02-01', '00000000-0000-4000-a660-0000000000a1', x.arrivee,
  '00000000-0000-4000-a660-0000000000b1', '00000000-0000-4000-a660-0000000000c1', NULL, NULL, NULL, NULL)
  FROM (VALUES ('X', '00000000-0000-4000-a660-0000000000a2'::uuid), ('Y', '00000000-0000-4000-a660-0000000000a2'::uuid),
               ('Z', '00000000-0000-4000-a660-0000000000a3'::uuid), ('W', '00000000-0000-4000-a660-0000000000a2'::uuid)) x(nom, arrivee);
CREATE FUNCTION pg_temp.livrer(p_trip uuid, p_debut timestamptz, p_minutes integer, p_brut numeric) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.avancer_voyage(p_trip, 'AT_LOADING', p_debut, NULL, '{}'::jsonb);
  PERFORM public.avancer_voyage(p_trip, 'LOADING', p_debut + interval '5 minutes', NULL, '{}'::jsonb);
  PERFORM public.avancer_voyage(p_trip, 'LOADED', p_debut + interval '10 minutes', NULL, '{}'::jsonb);
  IF p_brut IS NOT NULL THEN
    PERFORM public.avancer_voyage(p_trip, 'WEIGHED_OUT', p_debut + interval '12 minutes', NULL,
      jsonb_build_object('brut', p_brut, 'tare', 15));
  END IF;
  PERFORM public.avancer_voyage(p_trip, 'IN_TRANSIT', p_debut + interval '15 minutes', NULL, '{}'::jsonb);
  PERFORM public.avancer_voyage(p_trip, 'AT_DESTINATION', p_debut + (p_minutes - 10) * interval '1 minute', NULL, '{}'::jsonb);
  PERFORM public.avancer_voyage(p_trip, 'UNLOADING', p_debut + (p_minutes - 5) * interval '1 minute', NULL, '{}'::jsonb);
  PERFORM public.avancer_voyage(p_trip, 'DELIVERED', p_debut + p_minutes * interval '1 minute', NULL, '{}'::jsonb);
END;
$$;
SELECT pg_temp.livrer((SELECT id FROM v2001 WHERE nom = 'X'), '2001-02-01 08:00+00', 60, 50);
SELECT pg_temp.livrer((SELECT id FROM v2001 WHERE nom = 'Y'), '2001-02-01 10:00+00', 60, 48);
SELECT pg_temp.livrer((SELECT id FROM v2001 WHERE nom = 'Z'), '2001-02-01 12:30+00', 50, NULL);
SELECT public.avancer_voyage((SELECT id FROM v2001 WHERE nom = 'Y'), 'DISPUTED', '2001-02-01 11:30+00', 'Tonnage conteste', '{}'::jsonb);
SELECT public.avancer_voyage((SELECT id FROM v2001 WHERE nom = 'W'), 'CANCELLED', '2001-02-01 13:30+00', 'Piste fermee', '{}'::jsonb);
SELECT public.declarer_incident('materiel', 'minor', 'Crevaison sur la piste', '2001-02-01 08:30+00',
  '00000000-0000-4000-a660-0000000000b1', '00000000-0000-4000-a660-0000000000c1', (SELECT id FROM v2001 WHERE nom = 'X'));

SELECT is((SELECT (cycle_min, rotation_min)::text FROM public.durees_voyages('2001-02-01', '2001-02-01') WHERE trip_id = (SELECT id FROM v2001 WHERE nom = 'X')),
  '(60.0,120.0)', 'cycle et rotation mesures sur le journal');
SELECT is((SELECT rotation_min FROM public.durees_voyages('2001-02-01', '2001-02-01') WHERE trip_id = (SELECT id FROM v2001 WHERE nom = 'Z')),
  NULL, 'dernier voyage du jour : rotation non mesuree, jamais estimee');
SELECT is((SELECT (voyages_livres, charge_moyenne, cycle_moyen_min, rotation_moyenne_min, rotations_mesurees)::text
             FROM public.statistiques_trajets('00000000-0000-4000-a660-0000000000a1', NULL, '2001-02-02', 14)
            WHERE arrival_site_id = '00000000-0000-4000-a660-0000000000a2'),
  '(2,34.00,60,135,2)', 'statistiques observees vers le depot A');
SELECT is((SELECT (voyages_livres, charge_moyenne, rotations_mesurees)::text
             FROM public.statistiques_trajets('00000000-0000-4000-a660-0000000000a1', NULL, '2001-02-02', 14)
            WHERE arrival_site_id = '00000000-0000-4000-a660-0000000000a3'),
  '(1,,0)', 'depot B : ni pesee ni rotation, donnees insuffisantes signalees par NULL');
SELECT is((SELECT count(*)::int FROM public.statistiques_trajets('00000000-0000-4000-a660-0000000000a1', NULL, '2001-02-01', 14)),
  0, 'la journee simulee n''entre pas dans ses propres statistiques');

SELECT is((SELECT (libelle, voyages, livres, annules, tonnes, livres_sans_poids, cycle_moyen_min, rotation_moyenne_min, incidents, litiges)::text
             FROM public.rapport_voyages('2001-02-01', '2001-02-01', 'camion', '00000000-0000-4000-a660-0000000000a1')
            WHERE cle = '00000000-0000-4000-a660-0000000000b1'),
  '(TEST-D066-1,4,3,1,68.00,1,57,135,1,1)', 'rapport par camion : voyages, tonnes, durees, incidents, litiges');
SELECT is((SELECT (libelle, livres, incidents)::text
             FROM public.rapport_voyages('2001-02-01', '2001-02-01', 'chauffeur', '00000000-0000-4000-a660-0000000000a1')
            WHERE cle = '00000000-0000-4000-a660-0000000000c1'),
  '("Chauffeur un D-066",3,1)', 'rapport par chauffeur');
SELECT is((SELECT (cle IS NULL, voyages)::text
             FROM public.rapport_voyages('2001-02-01', '2001-02-01', 'shift', '00000000-0000-4000-a660-0000000000a1')),
  '(t,4)', 'rapport par shift : voyages sans shift regroupes et signales');
SELECT throws_ok($$SELECT * FROM public.rapport_voyages('2001-02-01', '2001-02-01', 'semaine')$$, '22023', NULL,
  'axe inconnu refuse');

-- 6. Infractions
CREATE TEMP TABLE inf (id uuid);
INSERT INTO inf SELECT public.enregistrer_infraction('00000000-0000-4000-a660-0000000000c1', 'exces_vitesse', now() - interval '1 hour',
  'Radar : 72 km/h en zone limitee a 40', 'controle_routier', 'PK 12', (SELECT id FROM vs WHERE n = 1));
SELECT is((SELECT (numero LIKE 'INF-%', vehicle_id, site_id, statut)::text FROM public.infractions_chauffeur WHERE id = (SELECT id FROM inf)),
  '(t,00000000-0000-4000-a660-0000000000b1,00000000-0000-4000-a660-0000000000a1,enregistree)',
  'infraction numerotee, engin et site repris du voyage');
SELECT throws_ok($$SELECT public.enregistrer_infraction('00000000-0000-4000-a660-0000000000c1', 'telephone', now(),
  'Telephone au volant', 'constat_interne', NULL, (SELECT id FROM vs WHERE n = 2))$$, '22023', NULL, 'voyage d''un autre chauffeur refuse');
SELECT throws_ok($$SELECT public.enregistrer_infraction('00000000-0000-4000-a660-0000000000c1', 'telephone', now() + interval '1 day',
  'Telephone au volant', 'constat_interne')$$, '22023', NULL, 'date future refusee');
SELECT throws_ok($$SELECT public.enregistrer_infraction('00000000-0000-4000-a660-0000000000c1', 'telephone', now(), ' ', 'constat_interne')$$,
  '22023', NULL, 'constat obligatoire');
SELECT throws_ok($$SELECT public.decider_sanction((SELECT id FROM inf), 'avertissement', 'Premiere infraction')$$, '42501', NULL,
  'sans droit d''approbation, pas de sanction');
RESET ROLE;
-- Garde du registre (proprietaire avec session utilisateur ; les comptes n'ont
-- aucun droit d'ecriture, verifie par has_table_privilege plus bas, D-072).
SELECT throws_ok($$UPDATE public.infractions_chauffeur SET constat = 'autre' WHERE id = (SELECT id FROM inf)$$, '42501', NULL,
  'garde du registre : aucune modification hors annulation');
SELECT throws_ok($$DELETE FROM public.infractions_chauffeur WHERE id = (SELECT id FROM inf)$$, '42501', NULL,
  'garde du registre : aucune suppression');

-- Directeur : sanction
SELECT pg_temp.se_connecter('00000000-0000-4000-a660-000000000002');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.decider_sanction((SELECT id FROM inf), 'avertissement', 'Premiere infraction')$$,
  'sanction decidee par une personne habilitee');
SELECT throws_ok($$SELECT public.decider_sanction((SELECT id FROM inf), 'blame', 'Recidive')$$, '22023', NULL,
  'une seule decision en vigueur');
SELECT lives_ok($$SELECT public.annuler_sanction((SELECT id FROM public.sanctions_infraction WHERE infraction_id = (SELECT id FROM inf)), 'Erreur sur la sanction')$$,
  'decision annulee avec motif');
SELECT lives_ok($$SELECT public.decider_sanction((SELECT id FROM inf), 'formation', 'Stage de conduite preventive')$$,
  'nouvelle decision apres annulation');
SELECT is((SELECT (count(*), count(*) FILTER (WHERE statut = 'active'))::text FROM public.sanctions_infraction WHERE infraction_id = (SELECT id FROM inf)),
  '(2,1)', 'l''historique des decisions est conserve');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-a660-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.annuler_infraction((SELECT id FROM inf), '')$$, '22023', NULL, 'annulation sans motif refusee');
SELECT throws_ok($$SELECT public.annuler_infraction((SELECT id FROM inf), 'Doublon')$$, '42501', NULL,
  'infraction sanctionnee : annulation reservee a une personne habilitee');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-a660-000000000002');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.annuler_infraction((SELECT id FROM inf), 'Doublon du constat INF precedent')$$, 'infraction annulee avec motif');
SELECT is((SELECT (i.statut, (SELECT count(*) FROM public.sanctions_infraction s WHERE s.infraction_id = i.id AND s.statut = 'active'))::text
             FROM public.infractions_chauffeur i WHERE i.id = (SELECT id FROM inf)),
  '(annulee,0)', 'l''annulation de l''infraction annule sa sanction, rien n''est supprime');
SELECT throws_ok($$SELECT public.annuler_infraction((SELECT id FROM inf), 'Encore')$$, '22023', NULL, 'infraction deja annulee');
RESET ROLE;

-- Perimetre des decisions de sanction (directeur d'un autre site)
SELECT pg_temp.se_connecter('00000000-0000-4000-a660-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE inf2 AS SELECT public.enregistrer_infraction('00000000-0000-4000-a660-0000000000c1', 'ceinture', now() - interval '2 hours',
  'Ceinture non bouclee', 'constat_interne') AS id;
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a660-000000000006');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.decider_sanction((SELECT id FROM inf2), 'avertissement', 'Rappel')$$, '42501',
  'Infraction hors de votre perimetre', 'decider_sanction refusee hors perimetre');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a660-000000000002');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE sanc2 AS SELECT public.decider_sanction((SELECT id FROM inf2), 'avertissement', 'Rappel des regles') AS id;
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a660-000000000006');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.annuler_sanction((SELECT id FROM sanc2), 'Erreur')$$, '42501',
  'Infraction hors de votre perimetre', 'annuler_sanction refusee hors perimetre');
RESET ROLE;

-- Mutation du chauffeur : l'infraction reste au site ou elle a ete saisie
SELECT pg_temp.se_connecter('00000000-0000-4000-a660-000000000007');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE inf3 AS SELECT public.enregistrer_infraction('00000000-0000-4000-a660-0000000000c7', 'documents', now() - interval '1 hour',
  'Carte grise absente', 'controle_routier') AS id;
RESET ROLE;
SELECT pg_temp.se_connecter(NULL);
UPDATE public.drivers SET site_id = '00000000-0000-4000-a660-0000000000a3' WHERE id = '00000000-0000-4000-a660-0000000000c7';
SELECT pg_temp.se_connecter('00000000-0000-4000-a660-000000000007');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.infractions_chauffeur WHERE id = (SELECT id FROM inf3)), 1,
  'chauffeur mute : l''infraction reste visible du site ou elle a ete saisie');
SELECT lives_ok($$SELECT public.annuler_infraction((SELECT id FROM inf3), 'Carte grise presentee le jour meme')$$,
  'chauffeur mute : l''infraction reste traitable par ce site');
RESET ROLE;

-- Comptable (lecture seule) et responsable d'un autre site
SELECT pg_temp.se_connecter('00000000-0000-4000-a660-000000000003');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.enregistrer_infraction('00000000-0000-4000-a660-0000000000c2', 'ceinture', now(),
  'Ceinture non bouclee', 'constat_interne')$$, '42501', NULL, 'un comptable n''enregistre pas d''infraction');
SELECT throws_ok($$SELECT * FROM public.affecter_en_groupe('[{}]'::jsonb)$$, '42501', NULL, 'un comptable n''affecte pas');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-a660-000000000004');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.enregistrer_infraction('00000000-0000-4000-a660-0000000000c2', 'ceinture', now(),
  'Ceinture non bouclee', 'constat_interne')$$, '42501', NULL, 'chauffeur d''un autre site hors perimetre');
SELECT is((SELECT count(*)::int FROM public.infractions_chauffeur WHERE driver_id = '00000000-0000-4000-a660-0000000000c1'), 0,
  'le registre d''un chauffeur d''un autre site n''est pas visible');
SELECT is((SELECT count(*)::int FROM public.durees_voyages('2001-02-01', '2001-02-01')), 1,
  'durees_voyages sous compte borne : seul le voyage arrivant au depot B');
SELECT is((SELECT (voyages, incidents)::text FROM public.rapport_voyages('2001-02-01', '2001-02-01', 'camion')
            WHERE cle = '00000000-0000-4000-a660-0000000000b1'), '(1,0)',
  'rapport_voyages sous compte borne : voyages et incidents d''un autre site exclus');
SELECT throws_ok($$SELECT public.enregistrer_infraction('00000000-0000-4000-a660-0000000000c1', 'ceinture', now(),
  'Ceinture non bouclee', 'constat_interne', NULL, (SELECT id FROM vs WHERE n = 2))$$, '42501',
  'Voyage hors de votre perimetre', 'voyage hors perimetre : refus de perimetre avant tout controle de coherence');
SELECT throws_ok($$SELECT public.enregistrer_infraction('00000000-0000-4000-a660-0000000000c4', 'ceinture', now(),
  'Ceinture non bouclee', 'constat_interne', NULL, NULL, '00000000-0000-4000-a660-0000000000b1')$$, '42501',
  'Engin hors de votre perimetre', 'chauffeur du site mais engin hors perimetre refuse');
CREATE TEMP TABLE hors AS
  SELECT * FROM public.affecter_en_groupe(jsonb_build_array(jsonb_build_object(
    'voyage', (SELECT id FROM lendemain),
    'camion', '00000000-0000-4000-a660-0000000000b2', 'chauffeur', '00000000-0000-4000-a660-0000000000c2')));
SELECT is((SELECT (resultat, reference IS NULL, raison)::text FROM hors), '(refuse,t,"Voyage hors de votre perimetre")',
  'affectation groupee hors perimetre : refusee, aucune reference revelee');
RESET ROLE;

-- Droits (D-072 : un droit retire se verifie par has_*_privilege, jamais par un appel sous SET ROLE)
SELECT is((SELECT bool_or(has_table_privilege(r, t, p))
             FROM unnest(ARRAY['anon', 'authenticated']) r,
                  unnest(ARRAY['public.infractions_chauffeur', 'public.sanctions_infraction']) t,
                  unnest(ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p), false,
  'aucune ecriture directe, ni DELETE ni TRUNCATE, sur le registre');
SELECT is((SELECT bool_or(has_table_privilege('anon', t, 'SELECT'))
             FROM unnest(ARRAY['public.infractions_chauffeur', 'public.sanctions_infraction']) t), false,
  'registre illisible par anon');
SELECT is((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.infractions_chauffeur'::regclass)
          AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.sanctions_infraction'::regclass)
          AND (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
                 AND tablename IN ('infractions_chauffeur', 'sanctions_infraction') AND cmd = 'SELECT') = 2,
  true, 'RLS active, une politique de lecture par table');
SELECT is((SELECT bool_or(has_sequence_privilege(r, 'public.infractions_numero_seq', p))
             FROM unnest(ARRAY['anon', 'authenticated']) r, unnest(ARRAY['USAGE', 'SELECT', 'UPDATE']) p), false,
  'sequence des numeros fermee aux comptes (USAGE, SELECT, UPDATE)');
SELECT is(has_function_privilege('authenticated', 'public.infraction_accessible(uuid)', 'EXECUTE')
          OR has_function_privilege('authenticated', 'public.garde_registre_infractions()', 'EXECUTE'), false,
  'fonctions internes du registre non executables par les comptes');
SELECT is((SELECT bool_or(has_function_privilege('anon', f, 'EXECUTE')) FROM unnest(ARRAY[
    'public.durees_voyages(date, date)', 'public.statistiques_trajets(uuid, uuid, date, integer)',
    'public.affecter_en_groupe(jsonb)', 'public.enchainer_voyage(uuid, uuid, uuid, date, uuid, jsonb)',
    'public.rapport_voyages(date, date, text, uuid)', 'public.chauffeur_permis(uuid)',
    'public.enregistrer_infraction(uuid, text, timestamptz, text, text, text, uuid, uuid, text)',
    'public.annuler_infraction(uuid, text)', 'public.decider_sanction(uuid, text, text, text)',
    'public.annuler_sanction(uuid, text)']) f), false, 'aucune fonction du lot executable par anon');
SELECT is((SELECT bool_and(p.prosecdef AND p.proconfig @> ARRAY['search_path=""'])
             FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
              AND p.proname IN ('affecter_en_groupe', 'enchainer_voyage', 'chauffeur_permis', 'enregistrer_infraction',
                                'infraction_accessible', 'annuler_infraction', 'decider_sanction', 'annuler_sanction')),
  true, 'ecritures en SECURITY DEFINER a search_path vide');

SELECT * FROM finish();
ROLLBACK;
