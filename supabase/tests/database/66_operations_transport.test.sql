-- Tests (D-088) : operations transport (migration 20261121220000) : journal
-- unifie du voyage (droits du lecteur, perimetre, aucune duplication,
-- corrections chainees), verification des evenements declares (saisie
-- distincte de la verification et de la validation, concurrence, append-only)
-- et controles du voyage. Sites et comptes de test dedies ; aucune assertion
-- sur les totaux globaux. Tout est annule.
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

DELETE FROM public.settings WHERE key = 'controle_depart_exige';
DELETE FROM public.habilitations_requises;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a880-000000000001', 'saisie.d088@exemple.invalid'),
  ('00000000-0000-4000-a880-000000000002', 'verification.d088@exemple.invalid'),
  ('00000000-0000-4000-a880-000000000003', 'validation.d088@exemple.invalid'),
  ('00000000-0000-4000-a880-000000000004', 'autre.site.d088@exemple.invalid'),
  ('00000000-0000-4000-a880-000000000005', 'lecture.d088@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-a880-0000000000a1', 'Mine D-088', 'mine'),
  ('00000000-0000-4000-a880-0000000000a2', 'Depot D-088', 'depot'),
  ('00000000-0000-4000-a880-0000000000a3', 'Autre mine D-088', 'mine');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-a880-000000000001', 'operations_manager', 'Saisie D-088', 'active', NULL),
  ('00000000-0000-4000-a880-000000000002', 'operations_manager', 'Verification D-088', 'active', NULL),
  ('00000000-0000-4000-a880-000000000003', 'operations_manager', 'Validation D-088', 'active', NULL),
  ('00000000-0000-4000-a880-000000000004', 'operations_manager', 'Autre site D-088', 'active', '00000000-0000-4000-a880-0000000000a3'),
  ('00000000-0000-4000-a880-000000000005', 'operations_manager', 'Lecture D-088', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.droits_utilisateur (utilisateur, module, niveau) VALUES
  ('00000000-0000-4000-a880-000000000005', 'trips', 'lecture');
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status, site_id) VALUES
  ('00000000-0000-4000-a880-0000000000b1', 'TEST-D088-1', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-a880-0000000000a1'),
  ('00000000-0000-4000-a880-0000000000b2', 'TEST-D088-2', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-a880-0000000000a1');
INSERT INTO public.drivers (id, name, license_number, license_category, license_expiry, hire_date, status, site_id) VALUES
  ('00000000-0000-4000-a880-0000000000c1', 'Chauffeur un D-088', 'D088-1', 'C', current_date + 100, current_date - 100, 'active', '00000000-0000-4000-a880-0000000000a1');

-- 1. Structure et droits -------------------------------------------------------
SELECT has_view('public', 'v_journal_voyage', 'vue du journal unifie');
SELECT ok((SELECT reloptions @> ARRAY['security_invoker=true'] FROM pg_class WHERE oid = 'public.v_journal_voyage'::regclass),
  'vue en security_invoker : droits et perimetre du lecteur');
SELECT has_table('public', 'verifications_evenements_voyage', 'table des verifications');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.verifications_evenements_voyage'::regclass), 'RLS active');
SELECT ok(NOT has_table_privilege('authenticated', 'public.verifications_evenements_voyage', 'INSERT')
      AND NOT has_table_privilege('authenticated', 'public.verifications_evenements_voyage', 'UPDATE'),
  'aucune ecriture directe des verifications');
SELECT ok(NOT has_function_privilege('anon', 'public.verifier_evenement_voyage(uuid, text, text, text, uuid)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.controles_voyage(uuid)', 'EXECUTE'), 'anonyme : aucune fonction');
SELECT ok(has_function_privilege('authenticated', 'public.controles_voyage(uuid)', 'EXECUTE'), 'controles executables par un compte');
SELECT ok((SELECT prosecdef AND proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid = 'public.verifier_evenement_voyage(uuid, text, text, text, uuid)'::regprocedure),
  'verification : SECURITY DEFINER, search_path vide');

-- 2. Un voyage cree, affecte, reaffecte, suspendu, repris, pese -----------------
SELECT pg_temp.se_connecter('00000000-0000-4000-a880-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE v1 AS SELECT public.creer_voyage(current_date, '00000000-0000-4000-a880-0000000000a1', '00000000-0000-4000-a880-0000000000a2') AS id;
SELECT lives_ok($$SELECT public.decider_affectation((SELECT id FROM v1), 'acceptee', '00000000-0000-4000-a880-0000000000b1',
  '00000000-0000-4000-a880-0000000000c1', NULL)$$, 'affectation');
SELECT lives_ok($$SELECT public.decider_affectation((SELECT id FROM v1), 'modifiee', '00000000-0000-4000-a880-0000000000b2',
  '00000000-0000-4000-a880-0000000000c1', NULL, '{}'::jsonb, 'Crevaison du premier camion')$$, 'reaffectation motivee');
SELECT lives_ok($$SELECT public.avancer_voyage((SELECT id FROM v1), 'AT_LOADING', now() + interval '1 second', NULL, '{}'::jsonb)$$, 'au chargement');
SELECT lives_ok($$SELECT public.suspendre_voyage((SELECT id FROM v1), 'Pluie forte')$$, 'suspension');
SELECT lives_ok($$SELECT public.reprendre_voyage((SELECT id FROM v1), 'Fin de la pluie')$$, 'reprise');
SELECT lives_ok($q$DO $x$ DECLARE e text; n int := 1; BEGIN
  FOREACH e IN ARRAY ARRAY['LOADING', 'LOADED', 'IN_TRANSIT', 'AT_DESTINATION', 'UNLOADING'] LOOP
    n := n + 1;
    PERFORM public.avancer_voyage((SELECT id FROM v1), e, now() + interval '1 second' * n, NULL, '{}'::jsonb);
  END LOOP; END $x$$q$,
  'progression jusqu''au dechargement');
SELECT lives_ok($$SELECT public.rattacher_ticket_cbg((SELECT id FROM v1), 'TEST-D088-T1', 52, 13, now() + interval '10 seconds', 'BL-D088-1')$$,
  'ticket CBG saisi a la reception');

-- 3. Journal unifie : contenu, aucune duplication, corrections chainees ---------
CREATE TEMP TABLE j1 AS SELECT * FROM public.v_journal_voyage WHERE trip_id = (SELECT id FROM v1);
SELECT is((SELECT count(*)::int FROM j1 WHERE type IN ('affectation', 'reaffectation')), 2, 'deux decisions du Dispatch au journal');
SELECT is((SELECT count(*)::int FROM j1 WHERE type IN ('suspension', 'reprise')), 2, 'suspension et reprise au journal');
SELECT is((SELECT count(*)::int FROM j1 WHERE type = 'etat'),
  (SELECT count(*)::int FROM public.trip_events WHERE trip_id = (SELECT id FROM v1)), 'chaque evenement du cycle une fois');
SELECT is((SELECT count(*)::int FROM j1 WHERE type = 'ticket_cbg'), 1, 'ticket CBG au journal');
SELECT is((SELECT count(*)::int FROM j1), (SELECT count(DISTINCT id)::int FROM j1), 'aucune ligne dupliquee');
SELECT is((SELECT corrige_ref FROM j1 WHERE type = 'reaffectation'), (SELECT id FROM j1 WHERE type = 'affectation'),
  'la reaffectation cite l''affectation remplacee');
SELECT is((SELECT corrige_ref FROM j1 WHERE type = 'reprise'), (SELECT id FROM j1 WHERE type = 'suspension'),
  'la reprise cite la suspension levee');
SELECT is((SELECT source FROM j1 WHERE type = 'reaffectation'), 'dispatch', 'source dispatch');
SELECT ok((SELECT bool_and(date_saisie IS NOT NULL AND statut IN ('declare', 'verifie', 'valide', 'conteste')) FROM j1),
  'date de saisie et statut sur chaque ligne');
SELECT is((SELECT vehicle_id FROM public.trips WHERE id = (SELECT id FROM v1)), '00000000-0000-4000-a880-0000000000b2'::uuid,
  'camion courant = camion de la reaffectation');

-- 4. Controles du voyage -----------------------------------------------------
CREATE TEMP TABLE c1 AS SELECT * FROM public.controles_voyage((SELECT id FROM v1));
SELECT is((SELECT count(*)::int FROM c1), 7, 'sept controles');
SELECT is((SELECT resultat FROM c1 WHERE code = 'affectation_valide'), 'conforme', 'affectation conforme a la derniere decision');
SELECT is((SELECT resultat FROM c1 WHERE code = 'chauffeur_habilite'), 'conforme', 'chauffeur habilite');
SELECT is((SELECT resultat FROM c1 WHERE code = 'etapes_coherentes'), 'conforme', 'etapes coherentes');
SELECT is((SELECT resultat FROM c1 WHERE code = 'ticket_associe'), 'conforme', 'ticket associe');
SELECT is((SELECT resultat FROM c1 WHERE code = 'fiche_presente'), 'alerte', 'voyage pese sans fiche : alerte, jamais conforme');
SELECT is((SELECT resultat FROM c1 WHERE code = 'double_comptage'), 'conforme', 'pas de double comptage');
CREATE TEMP TABLE v2 AS SELECT public.creer_voyage(current_date, '00000000-0000-4000-a880-0000000000a1', '00000000-0000-4000-a880-0000000000a2') AS id;
SELECT is((SELECT resultat FROM public.controles_voyage((SELECT id FROM v2)) WHERE code = 'affectation_valide'), 'non_applicable',
  'voyage non engage : controle non applicable');

-- 5. Verification : saisie, verification et validation separees -----------------
CREATE TEMP TABLE evt AS SELECT id FROM j1 WHERE type = 'etat' AND libelle LIKE '%-> AT_LOADING';
GRANT SELECT ON v1, v2, evt, j1 TO authenticated;
SELECT throws_ok($$SELECT public.verifier_evenement_voyage((SELECT id FROM v1), (SELECT id FROM evt), 'verifie')$$,
  '42501', NULL, 'l''auteur de la saisie ne la verifie pas');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a880-000000000005');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.verifier_evenement_voyage((SELECT id FROM v1), (SELECT id FROM evt), 'verifie')$$,
  '42501', NULL, 'lecture seule : verification refusee');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a880-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.verifier_evenement_voyage((SELECT id FROM v1), 'trip_event:00000000-0000-4000-a880-00000000ffff', 'verifie')$$,
  'P0002', NULL, 'evenement inconnu refuse');
CREATE TEMP TABLE ver1 AS SELECT public.verifier_evenement_voyage((SELECT id FROM v1), (SELECT id FROM evt), 'verifie') AS id;
SELECT is((SELECT statut FROM public.v_journal_voyage WHERE id = (SELECT id FROM evt)), 'verifie', 'evenement verifie');
SELECT throws_ok($$SELECT public.verifier_evenement_voyage((SELECT id FROM v1), (SELECT id FROM evt), 'valide', NULL, (SELECT id FROM ver1))$$,
  '42501', NULL, 'le verificateur ne valide pas');
GRANT SELECT ON ver1 TO authenticated;
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a880-000000000003');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.verifier_evenement_voyage((SELECT id FROM v1), (SELECT id FROM evt), 'valide', NULL, NULL)$$,
  '40001', NULL, 'verification modifiee entre-temps : conflit');
CREATE TEMP TABLE ver2 AS SELECT public.verifier_evenement_voyage((SELECT id FROM v1), (SELECT id FROM evt), 'valide', NULL, (SELECT id FROM ver1)) AS id;
SELECT is((SELECT statut FROM public.v_journal_voyage WHERE id = (SELECT id FROM evt)), 'valide', 'evenement valide');
SELECT throws_ok($$SELECT public.verifier_evenement_voyage((SELECT id FROM v1), (SELECT id FROM evt), 'conteste', NULL, (SELECT id FROM ver2))$$,
  '22023', NULL, 'contester sans motif refuse');
SELECT lives_ok($$SELECT public.verifier_evenement_voyage((SELECT id FROM v1), (SELECT id FROM evt), 'conteste', 'Heure d''arrivee contredite par la fiche', (SELECT id FROM ver2))$$,
  'contestation motivee : nouvelle ligne');
CREATE TEMP TABLE j2 AS SELECT * FROM public.v_journal_voyage WHERE trip_id = (SELECT id FROM v1);
SELECT is((SELECT count(*)::int FROM j2 WHERE type = 'verification' AND corrige_ref = (SELECT id FROM evt)), 3,
  'trois verifications chainees sur l''evenement, aucune ecrasee');
SELECT is((SELECT statut FROM j2 WHERE id = (SELECT id FROM evt)), 'conteste', 'la derniere verification prime');
SELECT is((SELECT count(*)::int FROM j2), (SELECT count(DISTINCT id)::int FROM j2), 'toujours aucune duplication');
SELECT throws_ok($$SELECT public.verifier_evenement_voyage((SELECT id FROM v1), (SELECT id FROM j2 WHERE type = 'verification' LIMIT 1), 'verifie')$$,
  '22023', NULL, 'une verification ne se verifie pas');

-- 6. Perimetre : un compte d'un autre site ne voit rien ----------------------------
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a880-000000000004');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.v_journal_voyage WHERE trip_id = (SELECT id FROM v1)), 0, 'hors perimetre : journal vide');
SELECT throws_ok($$SELECT * FROM public.controles_voyage((SELECT id FROM v1))$$, 'P0002', NULL, 'hors perimetre : controles refuses');

-- 7. Append-only --------------------------------------------------------------------
RESET ROLE;
SELECT throws_ok($$UPDATE public.verifications_evenements_voyage SET statut = 'valide' WHERE id = (SELECT id FROM ver1)$$,
  '42501', NULL, 'verification immuable (aucune modification)');

SELECT * FROM finish();
ROLLBACK;
