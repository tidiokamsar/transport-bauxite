-- Tests (D-087) : Dispatch Control Center (migration
-- 20261121210000_dispatch_control_center). Instance de shift, plan versionne,
-- affectation avec controle de version, suspension et reprise, gardes de
-- disponibilite, indicateurs, supervision, cloture, perimetre et droits.
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

SELECT plan(67);

DELETE FROM public.settings WHERE key = 'controle_depart_exige';
DELETE FROM public.habilitations_requises;
INSERT INTO public.habilitations_requises (type, note) VALUES ('visite_medicale', 'Test D-087');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a870-000000000001', 'operations.d087@exemple.invalid'),
  ('00000000-0000-4000-a870-000000000002', 'operations.site.d087@exemple.invalid'),
  ('00000000-0000-4000-a870-000000000003', 'comptable.d087@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-a870-0000000000a1', 'Mine D-087', 'mine'),
  ('00000000-0000-4000-a870-0000000000a2', 'Depot D-087', 'depot'),
  ('00000000-0000-4000-a870-0000000000a3', 'Autre mine D-087', 'mine');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-a870-000000000001', 'operations_manager', 'Operations D-087', 'active', NULL),
  ('00000000-0000-4000-a870-000000000002', 'operations_manager', 'Operations autre site D-087', 'active', '00000000-0000-4000-a870-0000000000a3'),
  ('00000000-0000-4000-a870-000000000003', 'accountant', 'Comptable D-087', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.work_shifts (id, name, display_name, start_time, end_time, shift_order) VALUES
  ('00000000-0000-4000-a870-0000000000d1', 'test_jour_d087', 'Jour D-087', '06:00', '18:00', 87);
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status, site_id) VALUES
  ('00000000-0000-4000-a870-0000000000b1', 'TEST-D087-1', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-a870-0000000000a1'),
  ('00000000-0000-4000-a870-0000000000b2', 'TEST-D087-2', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-a870-0000000000a1'),
  ('00000000-0000-4000-a870-0000000000b3', 'TEST-D087-3', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-a870-0000000000a1'),
  ('00000000-0000-4000-a870-0000000000b4', 'TEST-D087-4', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-a870-0000000000a1'),
  ('00000000-0000-4000-a870-0000000000e1', 'TEST-D087-CHG', 'Test', 10, 'loader', 'active', '00000000-0000-4000-a870-0000000000a1');
-- Immobilisation ouverte sur B3 (statut de l'engin laisse actif : seule la
-- garde D-087 doit refuser).
INSERT INTO public.immobilisations (vehicle_id, debut, cause, imputation, description)
  VALUES ('00000000-0000-4000-a870-0000000000b3', now() - interval '1 hour', 'panne', 'loueur', 'Test D-087');
UPDATE public.vehicles SET status = 'active' WHERE id = '00000000-0000-4000-a870-0000000000b3';
INSERT INTO public.drivers (id, name, license_number, license_category, license_expiry, hire_date, status, site_id) VALUES
  ('00000000-0000-4000-a870-0000000000c1', 'Chauffeur un D-087', 'D087-1', 'C', current_date + 100, current_date - 100, 'active', '00000000-0000-4000-a870-0000000000a1'),
  ('00000000-0000-4000-a870-0000000000c2', 'Chauffeur deux D-087', 'D087-2', 'C', current_date + 100, current_date - 100, 'active', '00000000-0000-4000-a870-0000000000a1'),
  ('00000000-0000-4000-a870-0000000000c3', 'Chauffeur non habilite D-087', 'D087-3', 'C', current_date + 100, current_date - 100, 'active', '00000000-0000-4000-a870-0000000000a1'),
  ('00000000-0000-4000-a870-0000000000c4', 'Chauffeur quatre D-087', 'D087-4', 'C', current_date + 100, current_date - 100, 'active', '00000000-0000-4000-a870-0000000000a1');
INSERT INTO public.habilitations_chauffeur (driver_id, type, libelle, delivre_le) VALUES
  ('00000000-0000-4000-a870-0000000000c1', 'visite_medicale', 'Visite D-087', current_date - 10),
  ('00000000-0000-4000-a870-0000000000c2', 'visite_medicale', 'Visite D-087', current_date - 10),
  ('00000000-0000-4000-a870-0000000000c4', 'visite_medicale', 'Visite D-087', current_date - 10);

SELECT pg_temp.se_connecter('00000000-0000-4000-a870-000000000001');
SET LOCAL ROLE authenticated;

-- 1. Preparation sans objectif et instance de shift
SELECT is((SELECT proposition FROM public.besoin_shift(current_date, '00000000-0000-4000-a870-0000000000a1', '00000000-0000-4000-a870-0000000000d1', 75)),
  NULL, 'sans objectif : aucune proposition calculee');
SELECT matches((SELECT base_calcul FROM public.besoin_shift(current_date, '00000000-0000-4000-a870-0000000000a1', '00000000-0000-4000-a870-0000000000d1', 75)),
  'Aucun objectif', 'sans objectif : la base le dit');
SELECT throws_ok($$SELECT public.confirmer_plan_shift(current_date, '00000000-0000-4000-a870-0000000000a1', '00000000-0000-4000-a870-0000000000d1',
  '00000000-0000-4000-a870-0000000000a2', NULL, 2, 'test', 0)$$, '22023', NULL, 'preparation refusee sans instance de shift');
CREATE TEMP TABLE poste AS SELECT public.planifier_poste(current_date, '00000000-0000-4000-a870-0000000000d1', '00000000-0000-4000-a870-0000000000a1') AS id;
SELECT is((SELECT statut FROM public.postes WHERE id = (SELECT id FROM poste)), 'planifie', 'shift planifie');
SELECT throws_ok($$SELECT public.planifier_poste(current_date, '00000000-0000-4000-a870-0000000000d1', '00000000-0000-4000-a870-0000000000a1')$$,
  '22023', NULL, 'instance unique par date, shift et site');
SELECT throws_ok($$SELECT public.planifier_poste(current_date - 1, '00000000-0000-4000-a870-0000000000d1', '00000000-0000-4000-a870-0000000000a1')$$,
  '22023', NULL, 'pas de planification dans le passe');
SELECT throws_ok($$SELECT public.confirmer_plan_shift(current_date, '00000000-0000-4000-a870-0000000000a1', '00000000-0000-4000-a870-0000000000d1',
  '00000000-0000-4000-a870-0000000000a2', NULL, 2, NULL, 0)$$, '22023', NULL, 'sans objectif : motif exige pour creer');
SELECT is((public.confirmer_plan_shift(current_date, '00000000-0000-4000-a870-0000000000a1', '00000000-0000-4000-a870-0000000000d1',
  '00000000-0000-4000-a870-0000000000a2', NULL, 2, 'Objectif non saisi, reprise de la veille', 0))->>'version', '1', 'plan version 1');
SELECT is((SELECT count(*)::integer FROM public.trips WHERE planned_date = current_date AND shift_id = '00000000-0000-4000-a870-0000000000d1'),
  2, 'generation : deux voyages crees');
SELECT throws_ok($$SELECT public.confirmer_plan_shift(current_date, '00000000-0000-4000-a870-0000000000a1', '00000000-0000-4000-a870-0000000000d1',
  '00000000-0000-4000-a870-0000000000a2', NULL, 1, 'doublon', 0)$$, '40001', NULL, 'modification concurrente du plan refusee');

-- 2. Preparation avec objectif (hypothese de charge saisie)
SELECT lives_ok($$SELECT public.definir_objectif(current_date, '00000000-0000-4000-a870-0000000000a1', '00000000-0000-4000-a870-0000000000d1',
  120, NULL, NULL, NULL, NULL, 'Objectif D-087')$$, 'objectif du shift');
-- Les engins sans site (communs) comptent aussi : les assertions se fondent
-- sur la capacite rendue, pas sur une valeur supposee de la base.
CREATE TEMP TABLE b75 AS SELECT * FROM public.besoin_shift(current_date, '00000000-0000-4000-a870-0000000000a1', '00000000-0000-4000-a870-0000000000d1', 75);
SELECT ok((SELECT capacite_utile_t > 0 FROM b75), 'capacite utile calculee sur les camions disponibles');
SELECT is((SELECT besoin_voyages FROM b75), (SELECT ceil(120 / (capacite_utile_t * 0.75))::integer FROM b75), 'besoin = ceil(cible / (capacite x hypothese))');
SELECT is((SELECT proposition FROM b75), (SELECT greatest(besoin_voyages - 2, 0) FROM b75), 'proposition = besoin - voyages existants');
SELECT is((SELECT besoin_voyages FROM public.besoin_shift(current_date, '00000000-0000-4000-a870-0000000000a1', '00000000-0000-4000-a870-0000000000d1', NULL)),
  NULL, 'sans hypothese de charge : aucun besoin suppose');
SELECT throws_ok($$SELECT public.confirmer_plan_shift(current_date, '00000000-0000-4000-a870-0000000000a1', '00000000-0000-4000-a870-0000000000d1',
  '00000000-0000-4000-a870-0000000000a2', 75, 3, NULL, 1)$$, '22023', NULL, 'correction de la proposition : motif exige');
SELECT is((public.confirmer_plan_shift(current_date, '00000000-0000-4000-a870-0000000000a1', '00000000-0000-4000-a870-0000000000d1',
  '00000000-0000-4000-a870-0000000000a2', 75, 2, 'Deux voyages ajoutes', 1))->>'version', '2', 'proposition corrigee et motivee : version 2');
SELECT is((SELECT voyages_crees FROM public.plans_shift WHERE poste_id = (SELECT id FROM poste) AND version = 2), 2, 'plan versionne conserve');

-- 3. Transitions du shift
SELECT is(public.ouvrir_poste(current_date, '00000000-0000-4000-a870-0000000000d1', '00000000-0000-4000-a870-0000000000a1'),
  (SELECT id FROM poste), 'ouverture du shift planifie (meme instance)');
SELECT throws_ok($$SELECT public.changer_etat_poste((SELECT id FROM poste), 'en_cours', NULL, 1)$$, '40001', NULL,
  'version perimee du shift refusee');
SELECT lives_ok($$SELECT public.changer_etat_poste((SELECT id FROM poste), 'en_cours', NULL,
  (SELECT version FROM public.postes WHERE id = (SELECT id FROM poste)))$$, 'shift demarre');
SELECT is((SELECT statut FROM public.postes WHERE id = (SELECT id FROM poste)), 'en_cours', 'shift en cours');

-- 4. Affectations
CREATE TEMP TABLE vs AS
  SELECT id, row_number() OVER (ORDER BY reference) AS n FROM public.trips
   WHERE planned_date = current_date AND shift_id = '00000000-0000-4000-a870-0000000000d1';
GRANT SELECT ON vs TO authenticated;
GRANT SELECT ON b75 TO authenticated;
SELECT is((SELECT count(*)::integer FROM vs), 4, 'quatre voyages prepares');
SELECT lives_ok($$SELECT public.affecter_voyage((SELECT id FROM vs WHERE n = 1), 'acceptee',
  '00000000-0000-4000-a870-0000000000b1', '00000000-0000-4000-a870-0000000000c1', '00000000-0000-4000-a870-0000000000e1',
  jsonb_build_object('camion_id', '00000000-0000-4000-a870-0000000000b1', 'chauffeur_id', '00000000-0000-4000-a870-0000000000c1',
                     'engin_id', '00000000-0000-4000-a870-0000000000e1', 'explications', '[]'::jsonb), NULL, 0)$$,
  'recommandation acceptee');
SELECT throws_ok($$SELECT public.affecter_voyage((SELECT id FROM vs WHERE n = 1), 'modifiee',
  '00000000-0000-4000-a870-0000000000b2', '00000000-0000-4000-a870-0000000000c2', NULL, '{}'::jsonb, 'concurrent', 0)$$,
  '40001', NULL, 'modification concurrente : version perimee refusee');
SELECT throws_ok($$SELECT public.affecter_voyage((SELECT id FROM vs WHERE n = 2), 'acceptee',
  '00000000-0000-4000-a870-0000000000b2', '00000000-0000-4000-a870-0000000000c2', NULL,
  jsonb_build_object('camion_id', '00000000-0000-4000-a870-0000000000b4', 'chauffeur_id', '00000000-0000-4000-a870-0000000000c2'), NULL, 0)$$,
  '22023', NULL, 'choix different de la recommandation : decision modifiee exigee');
SELECT throws_ok($$SELECT public.affecter_voyage((SELECT id FROM vs WHERE n = 2), 'modifiee',
  '00000000-0000-4000-a870-0000000000b2', '00000000-0000-4000-a870-0000000000c3', NULL, '{}'::jsonb, 'test habilitation', 0)$$,
  '22023', NULL, 'chauffeur non habilite refuse');
SELECT throws_ok($$SELECT public.affecter_voyage((SELECT id FROM vs WHERE n = 2), 'modifiee',
  '00000000-0000-4000-a870-0000000000b3', '00000000-0000-4000-a870-0000000000c2', NULL, '{}'::jsonb, 'test immobilisation', 0)$$,
  '22023', 'Camion immobilise (panne) : affectation refusee', 'camion immobilise refuse');
SELECT throws_ok($$SELECT public.affecter_voyage((SELECT id FROM vs WHERE n = 2), 'modifiee',
  '00000000-0000-4000-a870-0000000000b2', '00000000-0000-4000-a870-0000000000c1', NULL, '{}'::jsonb, 'test doublon', 0)$$,
  '22023', NULL, 'chauffeur deja affecte a un autre camion refuse');
SELECT lives_ok($$SELECT public.affecter_voyage((SELECT id FROM vs WHERE n = 2), 'modifiee',
  '00000000-0000-4000-a870-0000000000b2', '00000000-0000-4000-a870-0000000000c2', NULL, '{}'::jsonb, 'Camion le plus proche', 0)$$,
  'affectation modifiee et motivee');
SELECT lives_ok($$SELECT public.affecter_voyage((SELECT id FROM vs WHERE n = 2), 'modifiee',
  '00000000-0000-4000-a870-0000000000b4', '00000000-0000-4000-a870-0000000000c2', NULL, '{}'::jsonb, 'Changement de camion : crevaison', 1)$$,
  'reaffectation : changement de camion');
SELECT is((SELECT count(*)::integer FROM public.decisions_dispatch WHERE trip_id = (SELECT id FROM vs WHERE n = 2)), 2,
  'reaffectation : la decision precedente reste au journal');
SELECT is((SELECT avant->>'vehicle_id' FROM public.decisions_dispatch WHERE trip_id = (SELECT id FROM vs WHERE n = 2) AND nature = 'reaffectation'),
  '00000000-0000-4000-a870-0000000000b2', 'ressource remplacee historisee');

-- Voyage 1 engage : camion et chauffeur ne se partagent pas.
SELECT lives_ok($$SELECT public.avancer_voyage((SELECT id FROM vs WHERE n = 1), 'AT_LOADING', now(), NULL, '{}'::jsonb)$$, 'voyage 1 au chargement');
SELECT throws_ok($$SELECT public.affecter_voyage((SELECT id FROM vs WHERE n = 3), 'modifiee',
  '00000000-0000-4000-a870-0000000000b1', '00000000-0000-4000-a870-0000000000c4', NULL, '{}'::jsonb, 'test engagement', 0)$$,
  '22023', 'Camion engage sur un autre voyage avec un autre chauffeur', 'camion engage avec un autre chauffeur : refuse');

-- 5. Suspension, reprise, incident
SELECT throws_ok($$SELECT public.suspendre_voyage((SELECT id FROM vs WHERE n = 1), '  ')$$, '22023', NULL, 'suspension sans motif refusee');
SELECT lives_ok($$SELECT public.suspendre_voyage((SELECT id FROM vs WHERE n = 1), 'Piste fermee par la pluie')$$, 'voyage suspendu');
SELECT throws_ok($$SELECT public.suspendre_voyage((SELECT id FROM vs WHERE n = 1), 'encore')$$, '22023', NULL, 'double suspension refusee');
SELECT throws_ok($$SELECT public.avancer_voyage((SELECT id FROM vs WHERE n = 1), 'LOADING', now(), NULL, '{}'::jsonb)$$,
  '22023', NULL, 'voyage suspendu : aucune avancee');
SELECT is((SELECT valeur FROM public.indicateurs_dispatch(current_date, '00000000-0000-4000-a870-0000000000a1', '00000000-0000-4000-a870-0000000000d1')
  WHERE code = 'voyages_suspendus'), 1::numeric, 'indicateur : un voyage suspendu');
SELECT throws_ok($$SELECT public.affecter_voyage((SELECT id FROM vs WHERE n = 1), 'modifiee',
  '00000000-0000-4000-a870-0000000000b1', '00000000-0000-4000-a870-0000000000c1', NULL, '{}'::jsonb, 'x', 1)$$,
  '40001', NULL, 'la suspension change la version du voyage');
SELECT lives_ok($$SELECT public.reprendre_voyage((SELECT id FROM vs WHERE n = 1), 'Piste rouverte')$$, 'voyage repris');
SELECT throws_ok($$SELECT public.reprendre_voyage((SELECT id FROM vs WHERE n = 1), 'Piste rouverte')$$, '22023', NULL, 'reprise sans suspension refusee');
SELECT lives_ok($$SELECT public.avancer_voyage((SELECT id FROM vs WHERE n = 1), 'LOADING', now(), NULL, '{}'::jsonb)$$, 'apres reprise : le voyage avance');
SELECT lives_ok($$SELECT public.declarer_incident('materiel', 'minor', 'Fuite hydraulique au chargement', now(),
  '00000000-0000-4000-a870-0000000000b1', NULL, (SELECT id FROM vs WHERE n = 1))$$, 'incident declare sur le voyage');

-- 6. Indicateurs et supervision
SELECT is((SELECT valeur FROM public.indicateurs_dispatch(current_date, '00000000-0000-4000-a870-0000000000a1', '00000000-0000-4000-a870-0000000000d1')
  WHERE code = 'voyages_crees'), 4::numeric, 'indicateur : voyages crees');
SELECT is((SELECT valeur FROM public.indicateurs_dispatch(current_date, '00000000-0000-4000-a870-0000000000a1', '00000000-0000-4000-a870-0000000000d1')
  WHERE code = 'voyages_planifies'), (SELECT besoin_voyages::numeric FROM b75), 'indicateur : voyages planifies (plan version 2)');
SELECT is((SELECT valeur FROM public.indicateurs_dispatch(current_date, '00000000-0000-4000-a870-0000000000a1', '00000000-0000-4000-a870-0000000000d1')
  WHERE code = 'tonnes_validees'), NULL, 'tonnes validees : sans releve CBG rapproche, sans donnees');
SELECT ok((SELECT valeur FROM public.indicateurs_dispatch(current_date, '00000000-0000-4000-a870-0000000000a1', '00000000-0000-4000-a870-0000000000d1')
  WHERE code = 'camions_immobilises') >= 1, 'indicateur : camion immobilise compte');
SELECT is((SELECT source FROM public.supervision_dispatch(current_date, '00000000-0000-4000-a870-0000000000a1', '00000000-0000-4000-a870-0000000000d1')
  WHERE trip_id = (SELECT id FROM vs WHERE n = 1)), 'evenement', 'supervision sans GPS : source evenement declare');
SELECT is((SELECT incidents FROM public.supervision_dispatch(current_date, '00000000-0000-4000-a870-0000000000a1', '00000000-0000-4000-a870-0000000000d1')
  WHERE trip_id = (SELECT id FROM vs WHERE n = 1)), 1, 'supervision : incident du voyage');

-- 7. Cloture avec voyages non termines
SELECT throws_ok($$SELECT public.cloturer_shift((SELECT id FROM poste), 'RAS', NULL, NULL, NULL)$$, '22023', NULL,
  'cloture sans motif refusee (voyages non termines)');
SELECT throws_ok($$SELECT public.cloturer_poste((SELECT id FROM poste), 'RAS')$$, '22023', NULL,
  'cloture directe refusee aussi (voyages non termines)');
SELECT is((public.cloturer_shift((SELECT id FROM poste), 'Voyages 3 et 4 reportes', NULL, 'Pluie : arret a 16 h', NULL))->>'voyages_non_termines',
  '4', 'cloture motivee : bilan des voyages non termines');
SELECT is((SELECT array_agg(etat_apres ORDER BY rang) FROM public.postes_journal WHERE poste_id = (SELECT id FROM poste)),
  ARRAY['planifie', 'ouvert', 'en_cours', 'cloture'], 'transitions journalisees');

-- 8. Annulation d'un shift planifie
CREATE TEMP TABLE poste2 AS SELECT public.planifier_poste(current_date + 1, '00000000-0000-4000-a870-0000000000d1', '00000000-0000-4000-a870-0000000000a1') AS id;
SELECT throws_ok($$SELECT public.changer_etat_poste((SELECT id FROM poste2), 'annule', NULL, NULL)$$, '22023', NULL, 'annulation sans motif refusee');
SELECT lives_ok($$SELECT public.changer_etat_poste((SELECT id FROM poste2), 'annule', 'Jour ferie', NULL)$$, 'shift annule');

-- 9. Perimetre de site
SELECT pg_temp.se_connecter('00000000-0000-4000-a870-000000000002');
SELECT throws_ok($$SELECT public.planifier_poste(current_date + 2, '00000000-0000-4000-a870-0000000000d1', '00000000-0000-4000-a870-0000000000a1')$$,
  '42501', NULL, 'hors perimetre : planification refusee');
SELECT throws_ok($$SELECT public.suspendre_voyage((SELECT id FROM vs WHERE n = 3), 'x')$$, 'P0002', NULL,
  'hors perimetre : voyage introuvable');
SELECT throws_ok($$SELECT public.affecter_voyage((SELECT id FROM vs WHERE n = 3), 'acceptee', NULL, NULL, NULL, '{}'::jsonb, NULL, 0)$$,
  'P0002', NULL, 'hors perimetre : affectation refusee sans rien reveler');
SELECT is((SELECT valeur FROM public.indicateurs_dispatch(current_date, '00000000-0000-4000-a870-0000000000a1', '00000000-0000-4000-a870-0000000000d1')
  WHERE code = 'voyages_crees'), 0::numeric, 'hors perimetre : indicateurs vides (RLS)');

-- 10. Droits
SELECT pg_temp.se_connecter('00000000-0000-4000-a870-000000000003');
SELECT throws_ok($$SELECT public.planifier_poste(current_date + 3, '00000000-0000-4000-a870-0000000000d1', '00000000-0000-4000-a870-0000000000a1')$$,
  '42501', NULL, 'sans droit d''ecriture : refuse');
RESET ROLE;
SELECT ok(NOT has_function_privilege('anon', 'public.affecter_voyage(uuid, text, uuid, uuid, uuid, jsonb, text, integer)', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public.confirmer_plan_shift(date, uuid, uuid, uuid, numeric, integer, text, integer)', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public.indicateurs_dispatch(date, uuid, uuid)', 'EXECUTE'),
  'anon : aucune fonction du centre de controle');
SELECT ok(NOT has_function_privilege('authenticated', 'public.voyage_suspendu(uuid)', 'EXECUTE')
       AND NOT has_function_privilege('authenticated', 'public.voyages_non_termines_poste(uuid)', 'EXECUTE')
       AND NOT has_function_privilege('authenticated', 'public.poste_ecrivable(uuid, text, text)', 'EXECUTE')
       AND NOT has_function_privilege('authenticated', 'public.garde_dispatch_disponibilite()', 'EXECUTE'),
  'fonctions internes et gardes retirees aux comptes');
SELECT ok(has_function_privilege('authenticated', 'public.cloturer_shift(uuid, text, text, text, integer)', 'EXECUTE')
       AND has_function_privilege('authenticated', 'public.suspendre_voyage(uuid, text, boolean)', 'EXECUTE'),
  'fonctions d''ecriture ouvertes aux comptes (controle dans la fonction)');
SELECT throws_ok($$UPDATE public.suspensions_voyage SET motif = 'efface'$$, '42501', NULL, 'journal des suspensions append-only');
SELECT throws_ok($$DELETE FROM public.plans_shift$$, '42501', NULL, 'plans de shift append-only');

SELECT * FROM finish();
ROLLBACK;
