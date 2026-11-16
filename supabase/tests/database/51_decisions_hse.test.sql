-- Tests (D-068) : alertes ecrites par le serveur (regle a seuil inactive
-- sans reglage, une alerte par objet, resolution motivee, condition
-- levee), centre des decisions, filtres des indicateurs de pilotage, EPI,
-- registre des risques versionne, plans de prevention signes, inspections
-- planifiees avec constats et actions correctives (migration
-- 20261120090000). Periode 2001 pour les agregats. Tout est annule.
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

SELECT plan(47);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a680-000000000001', 'admin.d068@exemple.invalid'),
  ('00000000-0000-4000-a680-000000000002', 'operations.d068@exemple.invalid'),
  ('00000000-0000-4000-a680-000000000003', 'directeur.d068@exemple.invalid'),
  ('00000000-0000-4000-a680-000000000004', 'chauffeur.d068@exemple.invalid'),
  ('00000000-0000-4000-a680-000000000005', 'site.d068@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-a680-0000000000a1', 'Mine D-068', 'mine'),
  ('00000000-0000-4000-a680-0000000000a2', 'Depot D-068', 'depot');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-a680-000000000001', 'admin', 'Admin D-068', 'active', NULL),
  ('00000000-0000-4000-a680-000000000002', 'operations_manager', 'Operations D-068', 'active', NULL),
  ('00000000-0000-4000-a680-000000000003', 'director', 'Directeur D-068', 'active', NULL),
  ('00000000-0000-4000-a680-000000000004', 'driver', 'Chauffeur D-068', 'active', NULL),
  ('00000000-0000-4000-a680-000000000005', 'operations_manager', 'Site D-068', 'active', '00000000-0000-4000-a680-0000000000a2')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status, site_id, transporteur) VALUES
  ('00000000-0000-4000-a680-0000000000b1', 'TEST-D068-1', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-a680-0000000000a1', 'Transports Kaloum'),
  ('00000000-0000-4000-a680-0000000000b2', 'TEST-D068-2', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-a680-0000000000a1', NULL);
DELETE FROM public.settings WHERE key LIKE 'alerte\_%';
DELETE FROM public.alertes_actualisation;

-- Donnees reelles de depart (hors session)
SELECT pg_temp.se_connecter(NULL);
INSERT INTO public.immobilisations (id, vehicle_id, debut, cause, imputation, description, statut) VALUES
  ('00000000-0000-4000-a680-0000000000d1', '00000000-0000-4000-a680-0000000000b1', now() - interval '100 hours', 'panne', 'loueur', 'Boite de vitesses', 'ouverte');
INSERT INTO public.trips (id, reference, planned_date, vehicle_id, departure_site_id, etat, net_weight) VALUES
  ('00000000-0000-4000-a680-000000000101', 'TD068-1', '2001-04-10', '00000000-0000-4000-a680-0000000000b1', '00000000-0000-4000-a680-0000000000a1', 'DELIVERED', 30),
  ('00000000-0000-4000-a680-000000000102', 'TD068-2', '2001-04-11', '00000000-0000-4000-a680-0000000000b2', '00000000-0000-4000-a680-0000000000a1', 'DELIVERED', 20);

-- 1. Regles et reglages
SELECT pg_temp.se_connecter('00000000-0000-4000-a680-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT en_service FROM public.regles_alertes() WHERE regle = 'immobilisation_longue'), false, 'regle a seuil sans reglage : hors service');
SELECT is((SELECT en_service FROM public.regles_alertes() WHERE regle = 'controle_non_conforme'), true, 'regle sans seuil : en service si absente');
SELECT public.actualiser_alertes(true);
SELECT is((SELECT count(*)::integer FROM public.alerts WHERE reference_id = '00000000-0000-4000-a680-0000000000d1'), 0,
  'sans seuil saisi, aucune alerte d''immobilisation longue');
SELECT throws_ok($$INSERT INTO public.settings (key, value, category) VALUES ('alerte_immobilisation_longue_h', '{"value": "-3"}', 'alertes')$$,
  '22023', NULL, 'seuil invalide refuse par valider_reglage');
INSERT INTO public.settings (key, value, category) VALUES ('alerte_immobilisation_longue_h', '{"value": "48"}', 'alertes');
SELECT ok(public.actualiser_alertes(true) >= 1, 'seuil saisi : alerte creee');
SELECT is((SELECT count(*)::integer FROM public.alerts WHERE regle = 'immobilisation_longue' AND reference_id = '00000000-0000-4000-a680-0000000000d1'), 1,
  'une alerte pour l''immobilisation');
SELECT public.actualiser_alertes(true);
SELECT is((SELECT count(*)::integer FROM public.alerts WHERE regle = 'immobilisation_longue' AND reference_id = '00000000-0000-4000-a680-0000000000d1'), 1,
  'pas de doublon a l''actualisation suivante');
SELECT is(public.actualiser_alertes(false), 0, 'actualisation rapprochee ignoree (intervalle technique)');
SELECT is((SELECT module || ' ' || ecran || ' ' || severity FROM public.alerts WHERE reference_id = '00000000-0000-4000-a680-0000000000d1'),
  'maintenance immobilisations warning', 'alerte rattachee au module, a l''ecran et a la gravite de la regle');
RESET ROLE;

-- 2. Ecriture directe interdite, resolution motivee et habilitee
SELECT pg_temp.se_connecter('00000000-0000-4000-a680-000000000004');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$INSERT INTO public.alerts (alert_type, title, message) VALUES ('fuel_low', 'X', 'Y')$$, '42501', NULL,
  'aucune alerte ecrite depuis le navigateur');
SELECT is((SELECT count(*)::integer FROM public.alerts WHERE reference_id = '00000000-0000-4000-a680-0000000000d1'), 1,
  'lecture maintenance : alerte visible');
SELECT throws_ok($$SELECT public.resoudre_alerte((SELECT id FROM public.alerts WHERE reference_id = '00000000-0000-4000-a680-0000000000d1'), 'Vu')$$,
  '42501', NULL, 'resolution refusee sans droit d''ecriture du module');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a680-000000000005');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::integer FROM public.alerts WHERE reference_id = '00000000-0000-4000-a680-0000000000d1'), 0,
  'perimetre : alerte d''un engin d''un autre site invisible');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a680-000000000002');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE al AS SELECT id FROM public.alerts WHERE reference_id = '00000000-0000-4000-a680-0000000000d1';
GRANT SELECT ON al TO authenticated;
SELECT is((SELECT priorite FROM public.centre_decisions() WHERE alerte_id = (SELECT id FROM al)), 3, 'centre des decisions : avertissement en priorite 3');
SELECT throws_ok($$SELECT public.resoudre_alerte((SELECT id FROM al), '  ')$$, '22023', NULL, 'resolution sans motif refusee');
SELECT lives_ok($$SELECT public.prendre_en_compte_alerte((SELECT id FROM al))$$, 'alerte prise en compte');
SELECT lives_ok($$SELECT public.resoudre_alerte((SELECT id FROM al), 'Piece commandee, suivi Neemba')$$, 'alerte resolue avec motif');
SELECT is((SELECT status || ' ' || (resolue_par = '00000000-0000-4000-a680-000000000002')::text FROM public.alerts WHERE id = (SELECT id FROM al)),
  'resolved true', 'resolution tracee (auteur)');
SELECT public.actualiser_alertes(true);
SELECT is((SELECT count(*)::integer FROM public.alerts WHERE regle = 'immobilisation_longue' AND reference_id = '00000000-0000-4000-a680-0000000000d1'), 1,
  'alerte resolue : pas recreee pour le meme objet');
SELECT is((SELECT count(*)::integer FROM public.centre_decisions() WHERE alerte_id = (SELECT id FROM al)), 0, 'alerte resolue absente du centre');
RESET ROLE;

-- 3. Controle avant depart non conforme, condition levee, regle desactivee
SELECT pg_temp.se_connecter('00000000-0000-4000-a680-000000000001');
SET LOCAL ROLE authenticated;
UPDATE public.points_controle_depart SET actif = false;
INSERT INTO public.points_controle_depart (id, libelle, categorie, bloquant, ordre) VALUES
  ('00000000-0000-4000-a680-0000000000e1', 'Freins D-068', 'freinage', true, 1);
SELECT public.enregistrer_controle_depart('00000000-0000-4000-a680-0000000000b2',
  '[{"point": "00000000-0000-4000-a680-0000000000e1", "resultat": "non_conforme", "observation": "Fuite"}]'::jsonb, p_date => now() - interval '2 hours');
SELECT public.actualiser_alertes(true);
CREATE TEMP TABLE ac AS SELECT id FROM public.alerts WHERE regle = 'controle_non_conforme' AND vehicle_id = '00000000-0000-4000-a680-0000000000b2';
GRANT SELECT ON ac TO authenticated;
SELECT is((SELECT count(*)::integer FROM ac), 1, 'controle non conforme : alerte critique creee');
SELECT is((SELECT priorite FROM public.centre_decisions() WHERE alerte_id = (SELECT id FROM ac)), 1, 'alerte critique en priorite 1');
SELECT ok((SELECT message FROM public.alerts WHERE id = (SELECT id FROM ac)) LIKE '%Freins D-068 : Fuite%', 'message issu des points releves');
SELECT public.enregistrer_controle_depart('00000000-0000-4000-a680-0000000000b2',
  '[{"point": "00000000-0000-4000-a680-0000000000e1", "resultat": "conforme"}]'::jsonb, p_date => now() - interval '1 hour');
SELECT public.actualiser_alertes(true);
SELECT ok((SELECT condition_levee_le IS NOT NULL AND status = 'active' FROM public.alerts WHERE id = (SELECT id FROM ac)),
  'nouveau controle conforme : condition levee, alerte maintenue jusqu''a resolution');
INSERT INTO public.settings (key, value, category) VALUES ('alerte_controle_non_conforme_active', '{"value": "false"}', 'alertes');
SELECT public.enregistrer_controle_depart('00000000-0000-4000-a680-0000000000b1',
  '[{"point": "00000000-0000-4000-a680-0000000000e1", "resultat": "non_conforme", "observation": "Fuite"}]'::jsonb, p_date => now() - interval '30 minutes');
SELECT public.actualiser_alertes(true);
SELECT is((SELECT count(*)::integer FROM public.alerts WHERE regle = 'controle_non_conforme' AND vehicle_id = '00000000-0000-4000-a680-0000000000b1'), 0,
  'regle desactivee par reglage : aucune alerte');

-- 4. Indicateurs de pilotage filtres
CREATE TEMP TABLE kv AS SELECT * FROM public.indicateurs_pilotage('2001-04-01', '2001-04-30', NULL, p_vehicule => '00000000-0000-4000-a680-0000000000b1');
CREATE TEMP TABLE kp AS SELECT * FROM public.indicateurs_pilotage('2001-04-01', '2001-04-30', NULL, p_partenaire => ' transports KALOUM ');
CREATE TEMP TABLE ks AS SELECT * FROM public.indicateurs_pilotage('2001-04-01', '2001-04-30', NULL, p_shift => gen_random_uuid());
SELECT is((SELECT valeur FROM kv WHERE code = 'voyages_livres'), 1::numeric, 'filtre vehicule : voyages du seul engin');
SELECT is((SELECT valeur FROM kp WHERE code = 'tonnes_livrees'), 30.00::numeric, 'filtre partenaire (transporteur, sans casse)');
SELECT is((SELECT fiabilite || ' ' || coalesce(detail, '') FROM ks WHERE code = 'engins_actifs'), 'sans_donnees Filtre shift sans objet pour cet indicateur',
  'filtre shift sans objet : sans donnees avec le motif, jamais une valeur non filtree');
SELECT is((SELECT nature FROM kv WHERE code = 'engins_actifs') || ' ' || (SELECT nature FROM kv WHERE code = 'voyages_livres'), 'instantane periode',
  'nature de chaque indicateur (instantane ou periode)');
RESET ROLE;

-- 5. EPI
SELECT pg_temp.se_connecter('00000000-0000-4000-a680-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.remettre_epi('00000000-0000-4000-a680-0000000000a1', 'Ibrahima Sow', 'casque', 1, current_date - 10, current_date - 20)$$,
  '22023', NULL, 'echeance anterieure a la remise refusee');
CREATE TEMP TABLE e1 AS SELECT public.remettre_epi('00000000-0000-4000-a680-0000000000a1', 'Ibrahima Sow', 'casque', 1, current_date - 400, current_date - 35) AS id;
GRANT SELECT ON e1 TO authenticated;
SELECT matches((SELECT numero FROM public.dotations_epi WHERE id = (SELECT id FROM e1)), '^EPI-[0-9]{4}-[0-9]{5}$', 'dotation numerotee par le serveur');
SELECT public.actualiser_alertes(true);
SELECT is((SELECT count(*)::integer FROM public.alerts WHERE regle = 'epi_echu' AND reference_id = (SELECT id FROM e1)), 1, 'echeance atteinte : alerte EPI');
CREATE TEMP TABLE e2 AS SELECT public.remettre_epi('00000000-0000-4000-a680-0000000000a1', '', 'casque', 1, current_date, NULL, p_remplace => (SELECT id FROM e1)) AS id;
SELECT is((SELECT statut FROM public.dotations_epi WHERE id = (SELECT id FROM e1)), 'remplace', 'renouvellement : ancienne dotation remplacee');
SELECT throws_ok($$UPDATE public.dotations_epi SET quantite = 3$$, '42501', NULL, 'aucune modification directe des dotations');

-- 6. Registre des risques versionne
CREATE TEMP TABLE r1 AS SELECT public.enregistrer_risque(NULL, '00000000-0000-4000-a680-0000000000a1', 'Renversement de camion', 'Rampe d''acces fosse',
  4, 3, 'Limitation de vitesse, merlon', 'Chef de mine', current_date, current_date + 90) AS id;
GRANT SELECT ON r1 TO authenticated;
SELECT throws_ok($$SELECT public.enregistrer_risque((SELECT id FROM r1), NULL, 'Renversement', 'Rampe', 4, 2, 'Merlon rehausse', 'Chef de mine', current_date)$$,
  '22023', NULL, 'revision sans motif refusee');
SELECT public.enregistrer_risque((SELECT id FROM r1), NULL, 'Renversement de camion', 'Rampe d''acces fosse', 4, 2, 'Merlon rehausse', 'Chef de mine',
  current_date, NULL, 'actif', 'Revue trimestrielle');
SELECT is((SELECT version || ' ' || criticite FROM public.v_risques_courants WHERE id = (SELECT id FROM r1)), '2 8', 'version courante et criticite (gravite x probabilite saisies)');

-- 7. Plans de prevention
CREATE TEMP TABLE p1 AS SELECT public.enregistrer_plan_prevention(NULL, '00000000-0000-4000-a680-0000000000a1', 'Neemba Guinee', 'Atelier de maintenance',
  'Levage, energie electrique', 'Consignation, balisage', current_date, current_date + 30) AS id;
GRANT SELECT ON p1 TO authenticated;
SELECT throws_ok($$SELECT public.signer_plan_prevention((SELECT id FROM p1))$$, '42501', NULL, 'signature refusee sans habilitation');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a680-000000000003');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::integer FROM public.mes_validations() WHERE objet = 'Plan de prévention à signer'), 1, 'plan a signer dans la boite du directeur');
SELECT lives_ok($$SELECT public.signer_plan_prevention((SELECT id FROM p1))$$, 'signature par une personne habilitee');
SELECT is((SELECT etat || ' ' || signataire FROM public.v_plans_prevention WHERE id = (SELECT id FROM p1)), 'en_vigueur Directeur D-068', 'plan en vigueur, signataire fige');
SELECT throws_ok($$SELECT public.enregistrer_plan_prevention((SELECT id FROM p1), NULL, 'Neemba', 'Atelier', 'Levage', 'Balisage', current_date, current_date + 10)$$,
  '22023', NULL, 'plan signe non modifiable');
CREATE TEMP TABLE p2 AS SELECT public.enregistrer_plan_prevention(NULL, NULL, 'Neemba Guinee', 'Atelier et aire de lavage', 'Levage, glissade',
  'Consignation, balisage, tapis', current_date, current_date + 60, p_remplace => (SELECT id FROM p1)) AS id;
SELECT public.signer_plan_prevention((SELECT id FROM p2));
SELECT is((SELECT string_agg(version || ':' || etat, ',' ORDER BY version) FROM public.v_plans_prevention WHERE numero = (SELECT numero FROM public.plans_prevention WHERE id = (SELECT id FROM p1))),
  '1:remplace,2:en_vigueur', 'nouvelle version signee : la precedente est remplacee');
RESET ROLE;

-- 8. Inspections planifiees, constats et actions correctives
SELECT pg_temp.se_connecter('00000000-0000-4000-a680-000000000002');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE pr AS SELECT public.definir_programme_inspection('00000000-0000-4000-a680-0000000000a1', 'Inspection des pistes', 30, 'Responsable HSE', current_date - 5) AS id;
GRANT SELECT ON pr TO authenticated;
SELECT public.actualiser_alertes(true);
SELECT is((SELECT count(*)::integer FROM public.alerts a JOIN public.inspections i ON i.id = a.reference_id
            WHERE a.regle = 'inspection_retard' AND i.programme_id = (SELECT id FROM pr)), 1, 'inspection non realisee a la date prevue : alerte');
SELECT public.realiser_inspection((SELECT id FROM public.inspections WHERE programme_id = (SELECT id FROM pr) AND statut = 'planifiee'), now() - interval '1 hour',
  'Pistes praticables, un nid de poule', '[{"description": "Nid de poule au PK 3", "gravite": "majeur", "localisation": "PK 3"}]'::jsonb);
SELECT is((SELECT prevue_le - (current_date - 5) FROM public.inspections WHERE programme_id = (SELECT id FROM pr) AND statut = 'planifiee'), 30,
  'occurrence suivante planifiee a la frequence saisie');
CREATE TEMP TABLE ai AS SELECT public.ajouter_action_inspection(
  (SELECT id FROM public.inspections WHERE programme_id = (SELECT id FROM pr) AND statut = 'realisee'), 'Reboucher le nid de poule', 'Terrassement', current_date - 1,
  (SELECT c.id FROM public.constats_inspection c JOIN public.inspections i ON i.id = c.inspection_id WHERE i.programme_id = (SELECT id FROM pr))) AS id;
GRANT SELECT ON ai TO authenticated;
SELECT is((SELECT numero FROM public.v_actions_correctives_en_retard WHERE id = (SELECT id FROM ai)),
  (SELECT numero FROM public.inspections WHERE programme_id = (SELECT id FROM pr) AND statut = 'realisee'), 'action d''inspection en retard, numero de l''inspection');
SELECT lives_ok($$SELECT public.solder_action_corrective((SELECT id FROM ai), true, 'Rebouchage fait, photo PH-12')$$, 'action d''inspection soldee avec preuve');
SELECT throws_ok($$UPDATE public.constats_inspection SET gravite = 'mineur'$$, '42501', NULL, 'constats non modifiables');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
