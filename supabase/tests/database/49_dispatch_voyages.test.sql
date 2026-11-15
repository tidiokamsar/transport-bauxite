-- Tests (D-066) : affectation groupee (rapport par voyage), reaffectation
-- directe apres livraison, statistiques de trajets pour la simulation,
-- rapports par axe, registre des infractions et sanctions (migration
-- 20261119180000_dispatch_voyages). Tout est annule.
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

SELECT plan(49);

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
  ('00000000-0000-4000-a660-000000000004', 'operations.site.d066@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-a660-0000000000a1', 'Mine D-066', 'mine'),
  ('00000000-0000-4000-a660-0000000000a2', 'Depot A D-066', 'depot'),
  ('00000000-0000-4000-a660-0000000000a3', 'Depot B D-066', 'depot');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-a660-000000000001', 'operations_manager', 'Operations D-066', 'active', NULL),
  ('00000000-0000-4000-a660-000000000002', 'director', 'Directeur D-066', 'active', NULL),
  ('00000000-0000-4000-a660-000000000003', 'accountant', 'Comptable D-066', 'active', NULL),
  ('00000000-0000-4000-a660-000000000004', 'operations_manager', 'Operations depot B D-066', 'active', '00000000-0000-4000-a660-0000000000a3')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status, site_id) VALUES
  ('00000000-0000-4000-a660-0000000000b1', 'TEST-D066-1', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-a660-0000000000a1'),
  ('00000000-0000-4000-a660-0000000000b2', 'TEST-D066-2', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-a660-0000000000a1'),
  ('00000000-0000-4000-a660-0000000000b3', 'TEST-D066-3', 'Test', 40, 'tipper', 'immobilized', '00000000-0000-4000-a660-0000000000a1'),
  ('00000000-0000-4000-a660-0000000000e1', 'TEST-D066-CHG', 'Test', 10, 'loader', 'active', '00000000-0000-4000-a660-0000000000a1');
INSERT INTO public.drivers (id, name, license_number, license_category, license_expiry, hire_date, status, site_id) VALUES
  ('00000000-0000-4000-a660-0000000000c1', 'Chauffeur un D-066', 'D066-1', 'C', current_date + 100, current_date - 100, 'active', '00000000-0000-4000-a660-0000000000a1'),
  ('00000000-0000-4000-a660-0000000000c2', 'Chauffeur deux D-066', 'D066-2', 'C', current_date + 100, current_date - 100, 'active', '00000000-0000-4000-a660-0000000000a1'),
  ('00000000-0000-4000-a660-0000000000c3', 'Chauffeur expire D-066', 'D066-3', 'C', current_date - 1, current_date - 100, 'active', '00000000-0000-4000-a660-0000000000a1');

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
SELECT throws_ok($$UPDATE public.infractions_chauffeur SET constat = 'autre' WHERE id = (SELECT id FROM inf)$$, '42501', NULL,
  'aucune modification directe du registre');
SELECT throws_ok($$SELECT public.decider_sanction((SELECT id FROM inf), 'avertissement', 'Premiere infraction')$$, '42501', NULL,
  'sans droit d''approbation, pas de sanction');
RESET ROLE;

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
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
