-- Tests (D-064) : affectations multisites et site_permis, delegations
-- temporaires et has_module_*, journal de connexion, referentiels devises et
-- unites, sequences de numerotation (migration 20261121140000).
-- Integration sur main : signatures et volatilite inchangees, droits sans
-- delegation identiques aux corps de main (D-036, D-053), compte sans
-- affectation apres annulation non global, retour explicite au perimetre
-- global, delegation bornee aux droits et au perimetre du delegant.
-- Revue independante : C1 (approbation non delegable), C3 (pas de debut
-- passe), C4 (comptes delegables), C5 (compte inactif), equivalence elargie
-- (chaque role x variantes, anon, role absent de la matrice, raccourcis de
-- vehicule_permis et voyage_permis).
-- Regle D-072 : un droit retire se verifie par has_*_privilege, jamais par
-- un appel sous SET ROLE.
-- Tout est annule en fin de transaction.
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

-- Corps de has_module_view, has_module_write (20261112060000) et
-- has_module_approve (20261117090000) sur main avant D-064, pour un compte
-- donne : reference de non-regression.
CREATE FUNCTION pg_temp.droit_main(p_u uuid, p_module text, p_niveau text) RETURNS boolean
LANGUAGE sql AS $$
  SELECT CASE p_niveau
    WHEN 'lecture' THEN
      EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = p_u AND pr.status = 'active')
      AND COALESCE(
        (SELECT d.niveau IN ('lecture', 'ecriture') FROM public.droits_utilisateur d
          WHERE d.utilisateur = p_u AND d.module = p_module),
        EXISTS (SELECT 1 FROM public.profiles pr JOIN public.role_permissions rp ON rp.role::text = pr.role::text
                 WHERE pr.id = p_u AND pr.status = 'active' AND rp.module = p_module AND rp.can_view))
    WHEN 'ecriture' THEN
      EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = p_u AND pr.status = 'active')
      AND COALESCE(
        (SELECT d.niveau = 'ecriture' FROM public.droits_utilisateur d
          WHERE d.utilisateur = p_u AND d.module = p_module),
        EXISTS (SELECT 1 FROM public.profiles pr JOIN public.role_permissions rp ON rp.role::text = pr.role::text
                 WHERE pr.id = p_u AND pr.status = 'active' AND rp.module = p_module AND (rp.can_create OR rp.can_edit)))
    ELSE
      EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = p_u AND pr.status = 'active')
      AND coalesce((SELECT d.niveau = 'ecriture' FROM public.droits_utilisateur d
                     WHERE d.utilisateur = p_u AND d.module = p_module), true)
      AND EXISTS (SELECT 1 FROM public.profiles pr JOIN public.role_permissions rp ON rp.role::text = pr.role::text
                   WHERE pr.id = p_u AND pr.status = 'active' AND rp.module = p_module AND rp.can_approve)
  END;
$$;

-- Ecarts entre has_module_* (appel sous le compte) et la reference de main,
-- pour tous les comptes de test et tous les modules.
CREATE FUNCTION pg_temp.ecarts_droits() RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE u uuid; m text; n integer := 0;
BEGIN
  FOR u IN SELECT id FROM public.profiles WHERE id::text LIKE '00000000-0000-4000-b640-%' LOOP
    PERFORM pg_temp.se_connecter(u);
    FOR m IN SELECT DISTINCT module FROM public.role_permissions LOOP
      IF public.has_module_view(m) IS DISTINCT FROM pg_temp.droit_main(u, m, 'lecture') THEN n := n + 1; END IF;
      IF public.has_module_write(m) IS DISTINCT FROM pg_temp.droit_main(u, m, 'ecriture') THEN n := n + 1; END IF;
      IF public.has_module_approve(m) IS DISTINCT FROM pg_temp.droit_main(u, m, 'approbation') THEN n := n + 1; END IF;
    END LOOP;
  END LOOP;
  PERFORM pg_temp.se_connecter(NULL);
  RETURN n;
END;
$$;

-- Ecarts entre site_permis (sous le compte) et la meme regle evaluee pour un
-- compte quelconque (perimetre_global_de, sites_permis_de), sur les sites de
-- test et la ligne sans site.
CREATE FUNCTION pg_temp.ecarts_perimetre() RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE u uuid; s uuid; n integer := 0; attendu boolean;
BEGIN
  FOR u IN SELECT id FROM public.profiles WHERE id::text LIKE '00000000-0000-4000-b640-%' LOOP
    PERFORM pg_temp.se_connecter(u);
    FOR s IN SELECT id FROM public.sites WHERE id::text LIKE '00000000-0000-4000-b640-%' UNION ALL SELECT NULL LOOP
      attendu := public.perimetre_global_de(u) OR (s IS NOT NULL AND s IN (SELECT public.sites_permis_de(u)));
      IF public.site_permis(s) IS DISTINCT FROM attendu THEN n := n + 1; END IF;
    END LOOP;
  END LOOP;
  PERFORM pg_temp.se_connecter(NULL);
  RETURN n;
END;
$$;

-- Equivalence elargie (sonde du relecteur) : comptes de chaque role x
-- variantes (global actif, borne au site 1, inactif, statut NULL, suspendu,
-- global avec droits specifiques), plus anon ; reference : corps de main.
CREATE FUNCTION pg_temp.ecarts_elargis() RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE u uuid; m text; s uuid; n integer := 0; attendu boolean;
BEGIN
  FOR u IN SELECT id FROM comptes_eq UNION ALL SELECT NULL::uuid LOOP
    PERFORM pg_temp.se_connecter(u);
    FOR m IN SELECT DISTINCT module FROM public.role_permissions UNION SELECT 'module_inconnu' UNION SELECT NULL LOOP
      IF public.has_module_view(m) IS DISTINCT FROM pg_temp.droit_main(u, m, 'lecture') THEN n := n + 1; END IF;
      IF public.has_module_write(m) IS DISTINCT FROM pg_temp.droit_main(u, m, 'ecriture') THEN n := n + 1; END IF;
      IF public.has_module_approve(m) IS DISTINCT FROM pg_temp.droit_main(u, m, 'approbation') THEN n := n + 1; END IF;
    END LOOP;
    FOR s IN SELECT x FROM unnest(ARRAY['00000000-0000-4000-b640-0000000000a1'::uuid,
                                        '00000000-0000-4000-b640-0000000000a2'::uuid, NULL]) x LOOP
      attendu := EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = u AND pr.status = 'active'
                                                           AND (pr.site_id IS NULL OR pr.site_id = s));
      IF public.site_permis(s) IS DISTINCT FROM attendu THEN n := n + 1; END IF;
    END LOOP;
    IF public.is_admin() IS DISTINCT FROM EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = u AND pr.role = 'admin'
                                                    AND pr.status = 'active') THEN n := n + 1; END IF;
  END LOOP;
  PERFORM pg_temp.se_connecter(NULL);
  RETURN n;
END;
$$;

-- vehicule_permis et voyage_permis (raccourci des comptes globaux) contre
-- leur definition D-046, pour tous les comptes de test, les engins et
-- voyages existants, NULL et un identifiant inconnu.
CREATE FUNCTION pg_temp.ecarts_permis_derives() RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE u uuid; x uuid; n integer := 0;
BEGIN
  FOR u IN SELECT id FROM public.profiles WHERE id::text LIKE '00000000-0000-4000-b64%' UNION ALL SELECT NULL::uuid LOOP
    PERFORM pg_temp.se_connecter(u);
    -- Echantillon borne (la base du serveur porte la demonstration) : engins
    -- et voyages de test, 200 autres au plus, NULL et un identifiant inconnu.
    FOR x IN SELECT id FROM public.vehicles WHERE registration LIKE 'TEST-D064-%'
             UNION SELECT id FROM (SELECT id FROM public.vehicles ORDER BY id LIMIT 200) v
             UNION ALL SELECT NULL UNION ALL SELECT gen_random_uuid() LOOP
      IF public.vehicule_permis(x) IS DISTINCT FROM public.site_permis((SELECT v.site_id FROM public.vehicles v WHERE v.id = x)) THEN
        n := n + 1;
      END IF;
    END LOOP;
    FOR x IN SELECT id FROM voyage
             UNION SELECT id FROM (SELECT id FROM public.trips ORDER BY id LIMIT 200) t
             UNION ALL SELECT NULL UNION ALL SELECT gen_random_uuid() LOOP
      IF public.voyage_permis(x) IS DISTINCT FROM coalesce((SELECT public.site_permis(t.departure_site_id) OR public.site_permis(t.arrival_site_id)
                                                             FROM public.trips t WHERE t.id = x), public.site_permis(NULL)) THEN
        n := n + 1;
      END IF;
    END LOOP;
  END LOOP;
  PERFORM pg_temp.se_connecter(NULL);
  RETURN n;
END;
$$;

SELECT plan(140);

-- 0. Integration : signatures, volatilite, securite, droits d'execution ----

SELECT is((SELECT count(*)::int FROM pg_proc p
            WHERE p.oid IN ('public.site_permis(uuid)'::regprocedure, 'public.has_module_view(text)'::regprocedure,
                            'public.has_module_write(text)'::regprocedure, 'public.has_module_approve(text)'::regprocedure,
                            'public.is_admin()'::regprocedure)
              AND p.prorettype = 'boolean'::regtype AND p.provolatile = 's' AND p.prosecdef
              AND p.prolang = (SELECT oid FROM pg_language WHERE lanname = 'sql')
              AND p.proconfig @> ARRAY['search_path=""']), 5,
  'site_permis, has_module_* et is_admin : booleen, sql, STABLE, SECURITY DEFINER, search_path vide');
SELECT ok(NOT has_function_privilege('anon', 'public.site_permis(uuid)', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.has_module_view(text)', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.has_module_approve(text)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.site_permis(uuid)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.has_module_view(text)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.has_module_write(text)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.has_module_approve(text)', 'EXECUTE'),
  'droits d''execution des fonctions de droits et de perimetre inchanges');
SELECT is((SELECT count(*)::int FROM unnest(ARRAY[
            'public.droit_module_base(uuid, text, text)', 'public.delegation_effective(uuid, uuid, text, text)',
            'public.delegation_en_vigueur(uuid, text, text)', 'public.perimetre_global_de(uuid)',
            'public.sites_permis_de(uuid)', 'public.perimetre_inclus(uuid, uuid)',
            'public.garde_journal_organisation()', 'public.garde_affectation_site()', 'public.garde_delegation()']) f
            WHERE has_function_privilege('authenticated', f, 'EXECUTE') OR has_function_privilege('anon', f, 'EXECUTE')), 0,
  'fonctions internes et gardes non executables par les comptes');
SELECT is((SELECT count(*)::int FROM unnest(ARRAY['affectations_sites', 'journal_affectations_sites', 'retours_perimetre_global',
            'delegations_droits', 'journal_delegations', 'devises', 'unites_mesure']) t
            CROSS JOIN unnest(ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p
            WHERE has_table_privilege('authenticated', 'public.' || t, p) OR has_table_privilege('anon', 'public.' || t, p)), 0,
  'tables nouvelles : aucune ecriture directe ni suppression pour les comptes');
SELECT is((SELECT count(*)::int FROM unnest(ARRAY['affectations_sites', 'journal_affectations_sites', 'retours_perimetre_global',
            'delegations_droits', 'journal_delegations', 'devises', 'unites_mesure']) t
            WHERE has_table_privilege('anon', 'public.' || t, 'SELECT')
               OR NOT has_table_privilege('authenticated', 'public.' || t, 'SELECT')
               OR NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = ('public.' || t)::regclass)
               OR NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = ('public.' || t)::regclass)), 0,
  'tables nouvelles : RLS active avec politique, lecture des comptes connectes seulement');
SELECT ok(NOT has_table_privilege('anon', 'public.v_affectations_sites', 'SELECT')
          AND NOT has_table_privilege('anon', 'public.v_journal_connexions', 'SELECT')
          AND NOT has_table_privilege('authenticated', 'public.v_affectations_sites', 'INSERT')
          AND NOT has_table_privilege('authenticated', 'public.v_journal_connexions', 'UPDATE')
          AND has_table_privilege('authenticated', 'public.v_journal_connexions', 'SELECT'),
  'vues : lecture seule des comptes connectes, rien pour anon');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-b640-000000000001', 'admin.d064@exemple.invalid'),
  ('00000000-0000-4000-b640-000000000002', 'flotte-f.d064@exemple.invalid'),
  ('00000000-0000-4000-b640-000000000003', 'flotte-g.d064@exemple.invalid'),
  ('00000000-0000-4000-b640-000000000004', 'flotte-h.d064@exemple.invalid'),
  ('00000000-0000-4000-b640-000000000005', 'dispatch-x.d064@exemple.invalid'),
  ('00000000-0000-4000-b640-000000000006', 'chauffeur-y.d064@exemple.invalid'),
  ('00000000-0000-4000-b640-000000000007', 'chauffeur-z.d064@exemple.invalid'),
  ('00000000-0000-4000-b640-000000000008', 'logistique-1.d064@exemple.invalid'),
  ('00000000-0000-4000-b640-000000000009', 'logistique-2.d064@exemple.invalid'),
  ('00000000-0000-4000-b640-00000000000a', 'chauffeur-w.d064@exemple.invalid'),
  ('00000000-0000-4000-b640-00000000000b', 'flotte-k.d064@exemple.invalid'),
  ('00000000-0000-4000-b640-00000000000c', 'directeur.d064@exemple.invalid'),
  ('00000000-0000-4000-b640-00000000000d', 'chauffeur-v.d064@exemple.invalid'),
  ('00000000-0000-4000-b640-00000000000e', 'flotte-e.d064@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-b640-0000000000a1', 'Site 1 D-064', 'mine'),
  ('00000000-0000-4000-b640-0000000000a2', 'Site 2 D-064', 'depot'),
  ('00000000-0000-4000-b640-0000000000a3', 'Site 3 D-064', 'depot');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-b640-000000000001', 'admin', 'Admin D-064', 'active', NULL),
  ('00000000-0000-4000-b640-000000000002', 'fleet_manager', 'Flotte F D-064', 'active', NULL),
  ('00000000-0000-4000-b640-000000000003', 'fleet_manager', 'Flotte G D-064', 'active', NULL),
  ('00000000-0000-4000-b640-000000000004', 'fleet_manager', 'Flotte H D-064', 'active', '00000000-0000-4000-b640-0000000000a1'),
  ('00000000-0000-4000-b640-000000000005', 'operations_manager', 'Dispatch X D-064', 'active', NULL),
  ('00000000-0000-4000-b640-000000000006', 'driver', 'Chauffeur Y D-064', 'active', NULL),
  ('00000000-0000-4000-b640-000000000007', 'driver', 'Chauffeur Z D-064', 'active', NULL),
  ('00000000-0000-4000-b640-000000000008', 'logistician', 'Logistique 1 D-064', 'active', NULL),
  ('00000000-0000-4000-b640-000000000009', 'logistician', 'Logistique 2 D-064', 'active', NULL),
  ('00000000-0000-4000-b640-00000000000a', 'driver', 'Chauffeur W D-064', 'active', NULL),
  ('00000000-0000-4000-b640-00000000000b', 'fleet_manager', 'Flotte K D-064', 'active', NULL),
  ('00000000-0000-4000-b640-00000000000c', 'director', 'Directeur D-064', 'active', NULL),
  ('00000000-0000-4000-b640-00000000000d', 'driver', 'Chauffeur V D-064', 'active', NULL),
  ('00000000-0000-4000-b640-00000000000e', 'fleet_manager', 'Flotte E D-064', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name, status = EXCLUDED.status,
  site_id = EXCLUDED.site_id;
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, site_id) VALUES
  ('00000000-0000-4000-b640-0000000000b1', 'TEST-D064-1', 'Test', 40, 'tipper', '00000000-0000-4000-b640-0000000000a1'),
  ('00000000-0000-4000-b640-0000000000b2', 'TEST-D064-2', 'Test', 40, 'tipper', '00000000-0000-4000-b640-0000000000a2');

SELECT is(pg_temp.ecarts_droits(), 0, 'sans delegation : has_module_* identiques aux definitions de main pour tous les comptes');

CREATE TEMP TABLE comptes_eq AS
SELECT ('00000000-0000-4000-b641-' || lpad(to_hex(r.n * 16 + v), 12, '0'))::uuid AS id, r.role, v
  FROM (SELECT e AS role, row_number() OVER () AS n FROM unnest(enum_range(NULL::public.user_role)) e) r
  CROSS JOIN generate_series(1, 6) v;
INSERT INTO auth.users (id, email) SELECT id, id::text || '@exemple.invalid' FROM comptes_eq;
INSERT INTO public.profiles (id, role, full_name, status, site_id)
SELECT id, role, 'Equivalence ' || role || ' ' || v,
       CASE v WHEN 3 THEN 'inactive' WHEN 5 THEN 'suspended' ELSE 'active' END,
       CASE v WHEN 2 THEN '00000000-0000-4000-b640-0000000000a1'::uuid END
  FROM comptes_eq
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name, status = EXCLUDED.status,
  site_id = EXCLUDED.site_id;
UPDATE public.profiles SET status = NULL WHERE id IN (SELECT id FROM comptes_eq WHERE v = 4);
INSERT INTO public.droits_utilisateur (utilisateur, module, niveau)
SELECT c.id, x.module, x.niveau FROM comptes_eq c
  CROSS JOIN (VALUES ('trips', 'aucun'), ('fuel', 'lecture'), ('invoices', 'ecriture'), ('purchases', 'lecture'),
                     ('reports', 'ecriture'), ('drivers', 'aucun'), ('module_inconnu', 'ecriture')) x(module, niveau)
 WHERE c.v = 6;
SELECT is(pg_temp.ecarts_elargis(), 0,
  'equivalence elargie : has_module_*, site_permis et is_admin identiques a main (chaque role x variantes, anon)');
SELECT is(pg_temp.ecarts_perimetre(), 0, 'sans affectation : site_permis identique a la regle D-038 (et a perimetre_global_de)');

-- 1. Affectations multisites ----------------------------------------------

-- Sans affectation : global, comme avant (D-038).
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000002');
SET LOCAL ROLE authenticated;
SELECT ok(public.site_permis('00000000-0000-4000-b640-0000000000a1') AND public.site_permis('00000000-0000-4000-b640-0000000000a2')
          AND public.site_permis(NULL), 'sans affectation : compte global');
SELECT throws_ok($$SELECT public.affecter_site('00000000-0000-4000-b640-000000000002',
  '00000000-0000-4000-b640-0000000000a1', current_date)$$, '42501', NULL, 'un non-administrateur n''affecte pas');
RESET ROLE;
SELECT ok(NOT has_table_privilege('authenticated', 'public.affectations_sites', 'INSERT')
          AND NOT has_table_privilege('authenticated', 'public.retours_perimetre_global', 'INSERT'),
  'ecriture directe des affectations et des retours refusee (droit retire)');

SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE aff_f1 AS SELECT public.affecter_site('00000000-0000-4000-b640-000000000002',
  '00000000-0000-4000-b640-0000000000a1', current_date - 30, NULL, 'Affectation principale') AS id;
SELECT ok((SELECT id FROM aff_f1) IS NOT NULL, 'l''administrateur affecte un compte a un site');
SELECT throws_ok($$SELECT public.affecter_site('00000000-0000-4000-b640-000000000002',
  '00000000-0000-4000-b640-0000000000a1', current_date, current_date + 10)$$,
  '22023', NULL, 'chevauchement d''affectations au meme site refuse');
SELECT throws_ok($$SELECT public.affecter_site('00000000-0000-4000-b640-000000000002',
  '00000000-0000-4000-b640-0000000000a2', current_date, current_date - 1)$$,
  '22023', NULL, 'fin anterieure au debut refusee');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000002');
SET LOCAL ROLE authenticated;
SELECT is(public.site_permis('00000000-0000-4000-b640-0000000000a1'), true, 'affecte au site 1 : site 1 permis');
SELECT is(public.site_permis('00000000-0000-4000-b640-0000000000a2'), false, 'affecte au site 1 : site 2 refuse');
SELECT is(public.site_permis(NULL), false, 'affecte : une ligne sans site n''est plus visible');
SELECT is((SELECT count(*)::int FROM public.vehicles WHERE registration LIKE 'TEST-D064-%'), 1,
  'la politique des vehicules suit l''affectation (un seul site)');
RESET ROLE;

-- Second site : multisite.
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE aff_f2 AS SELECT public.affecter_site('00000000-0000-4000-b640-000000000002',
  '00000000-0000-4000-b640-0000000000a2', current_date - 5, NULL, 'Renfort') AS id;
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000002');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.vehicles WHERE registration LIKE 'TEST-D064-%'), 2,
  'multisite : les vehicules des deux sites sont visibles');
SELECT is((SELECT count(*)::int FROM public.v_affectations_sites WHERE utilisateur = '00000000-0000-4000-b640-000000000002'
  AND statut = 'en_cours'), 2, 'le compte lit ses deux affectations en cours');
RESET ROLE;

-- Cloture : le site 2 est retire a partir d'hier.
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.cloturer_affectation_site((SELECT id FROM aff_f2), current_date - 1, 'Fin du renfort')$$,
  'cloture d''une affectation');
SELECT throws_ok($$SELECT public.cloturer_affectation_site((SELECT id FROM aff_f2), current_date - 10)$$,
  '22023', NULL, 'une fin anterieure au debut est refusee a la cloture');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000002');
SET LOCAL ROLE authenticated;
SELECT is(public.site_permis('00000000-0000-4000-b640-0000000000a2'), false, 'affectation terminee : site 2 refuse');
SELECT is(public.site_permis('00000000-0000-4000-b640-0000000000a1'), true, 'l''autre affectation reste en vigueur');
RESET ROLE;

-- Affectation expiree seule : le compte ne redevient pas global.
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE aff_g AS SELECT public.affecter_site('00000000-0000-4000-b640-000000000003',
  '00000000-0000-4000-b640-0000000000a1', current_date - 10, current_date - 1, 'Mission terminee') AS id;
SELECT lives_ok($$SELECT public.affecter_site('00000000-0000-4000-b640-000000000003',
  '00000000-0000-4000-b640-0000000000a2', current_date + 3, NULL, 'Mutation prevue')$$, 'affectation a venir');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000003');
SET LOCAL ROLE authenticated;
SELECT is(public.site_permis('00000000-0000-4000-b640-0000000000a1'), false, 'affectation expiree : site refuse');
SELECT is(public.site_permis('00000000-0000-4000-b640-0000000000a2'), false, 'affectation a venir : pas encore permise');
SELECT is(public.site_permis(NULL), false, 'affectation expiree : le compte ne redevient pas global');
SELECT is((SELECT count(*)::int FROM public.vehicles WHERE registration LIKE 'TEST-D064-%'), 0,
  'affectation expiree : aucun vehicule visible');
RESET ROLE;

-- Annulation (erreur de saisie) : l'affectation est reputee n'avoir jamais existe.
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.annuler_affectation_site((SELECT id FROM aff_g), '  ')$$,
  '22023', NULL, 'annulation sans motif refusee');
SELECT lives_ok($$SELECT public.annuler_affectation_site(id, 'Erreur de saisie') FROM public.affectations_sites
  WHERE utilisateur = '00000000-0000-4000-b640-000000000003'$$, 'annulation motivee des affectations');
SELECT throws_ok($$SELECT public.cloturer_affectation_site((SELECT id FROM aff_g), current_date)$$,
  '22023', NULL, 'une affectation annulee ne se modifie plus');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000003');
SET LOCAL ROLE authenticated;
SELECT ok(NOT public.site_permis('00000000-0000-4000-b640-0000000000a1') AND NOT public.site_permis('00000000-0000-4000-b640-0000000000a2')
          AND NOT public.site_permis(NULL),
  'toutes les affectations annulees : sans acces site, le compte ne redevient pas global');
SELECT is((SELECT count(*)::int FROM public.vehicles WHERE registration LIKE 'TEST-D064-%'), 0,
  'toutes les affectations annulees : aucun vehicule visible');
SELECT throws_ok($$SELECT public.retablir_perimetre_global('00000000-0000-4000-b640-000000000003', 'Retour')$$,
  '42501', NULL, 'un non-administrateur ne retablit pas le perimetre global');
RESET ROLE;

-- Retour explicite au perimetre global (decision motivee de l'administrateur).
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
SELECT ok((SELECT NOT global AND retour_possible AND cardinality(sites) = 0 FROM public.perimetres_comptes()
            WHERE utilisateur = '00000000-0000-4000-b640-000000000003'),
  'perimetres_comptes : compte sans acces site, retour possible');
SELECT throws_ok($$SELECT public.retablir_perimetre_global('00000000-0000-4000-b640-000000000003', ' ')$$,
  '22023', NULL, 'retour au perimetre global sans motif refuse');
SELECT throws_ok($$SELECT public.retablir_perimetre_global('00000000-0000-4000-b640-000000000002', 'Retour')$$,
  '22023', NULL, 'retour refuse tant qu''une affectation est en cours');
SELECT throws_ok($$SELECT public.retablir_perimetre_global('00000000-0000-4000-b640-000000000004', 'Retour')$$,
  '22023', NULL, 'retour refuse quand le profil porte un site');
SELECT throws_ok($$SELECT public.retablir_perimetre_global('00000000-0000-4000-b640-000000000005', 'Retour')$$,
  '22023', NULL, 'retour refuse pour un compte deja global');
SELECT lives_ok($$SELECT public.retablir_perimetre_global('00000000-0000-4000-b640-000000000003', 'Affectations saisies par erreur')$$,
  'l''administrateur retablit le perimetre global, motif a l''appui');
SELECT is((SELECT count(*)::int FROM public.retours_perimetre_global WHERE utilisateur = '00000000-0000-4000-b640-000000000003'
            AND motif = 'Affectations saisies par erreur' AND auteur = '00000000-0000-4000-b640-000000000001'), 1,
  'le retour est consigne (auteur, motif)');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000003');
SET LOCAL ROLE authenticated;
SELECT ok(public.site_permis('00000000-0000-4000-b640-0000000000a2') AND public.site_permis(NULL),
  'apres le retour explicite : perimetre global');
RESET ROLE;
SELECT throws_ok($$UPDATE public.retours_perimetre_global SET motif = 'x'$$, '42501', NULL,
  'retours au perimetre global non modifiables');
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE aff_g2 AS SELECT public.affecter_site('00000000-0000-4000-b640-000000000003',
  '00000000-0000-4000-b640-0000000000a1', current_date - 2, current_date - 1, 'Mission courte') AS id;
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000003');
SET LOCAL ROLE authenticated;
SELECT ok(NOT public.site_permis('00000000-0000-4000-b640-0000000000a1') AND NOT public.site_permis(NULL),
  'une affectation posterieure au retour borne de nouveau le compte, meme deja expiree');
RESET ROLE;
-- Une affectation anterieure au retour ne se prolonge plus.
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.retablir_perimetre_global('00000000-0000-4000-b640-000000000003', 'Mission close')$$,
  'second retour apres une affectation expiree');
SELECT throws_ok($$SELECT public.cloturer_affectation_site((SELECT id FROM aff_g2), current_date + 30)$$,
  '22023', NULL, 'une affectation anterieure au retour ne se prolonge pas');
RESET ROLE;

-- Compatibilite profiles.site_id : le site du profil s'ajoute aux affectations.
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000004');
SET LOCAL ROLE authenticated;
SELECT ok(public.site_permis('00000000-0000-4000-b640-0000000000a1') AND NOT public.site_permis('00000000-0000-4000-b640-0000000000a2'),
  'site du profil seul : comportement D-038 inchange');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
SELECT public.affecter_site('00000000-0000-4000-b640-000000000004', '00000000-0000-4000-b640-0000000000a2', current_date, current_date);
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000004');
SET LOCAL ROLE authenticated;
SELECT ok(public.site_permis('00000000-0000-4000-b640-0000000000a1') AND public.site_permis('00000000-0000-4000-b640-0000000000a2'),
  'site du profil et affectation du jour (fin incluse) : deux sites');
RESET ROLE;

-- Perimetre multisite date : avant le debut, premier et dernier jour, apres la fin.
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
SELECT public.affecter_site('00000000-0000-4000-b640-00000000000b', '00000000-0000-4000-b640-0000000000a1',
  current_date - 10, current_date - 1, 'Periode passee');
CREATE TEMP TABLE aff_k AS SELECT public.affecter_site('00000000-0000-4000-b640-00000000000b',
  '00000000-0000-4000-b640-0000000000a2', current_date, current_date + 5, 'Periode en cours') AS id;
SELECT public.affecter_site('00000000-0000-4000-b640-00000000000b', '00000000-0000-4000-b640-0000000000a1',
  current_date + 1, NULL, 'Retour prevu');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-00000000000b');
SET LOCAL ROLE authenticated;
SELECT is(public.site_permis('00000000-0000-4000-b640-0000000000a1'), false,
  'apres la fin d''une affectation et avant le debut de la suivante : site refuse');
SELECT is(public.site_permis('00000000-0000-4000-b640-0000000000a2'), true, 'premier jour d''une affectation : site permis');
SELECT is((SELECT count(*)::int FROM public.vehicles WHERE registration LIKE 'TEST-D064-%'), 1,
  'multisite date : seuls les vehicules du site en cours');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.cloturer_affectation_site((SELECT id FROM aff_k), current_date)$$,
  'cloture au jour meme (dernier jour inclus)');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-00000000000b');
SET LOCAL ROLE authenticated;
SELECT is(public.site_permis('00000000-0000-4000-b640-0000000000a2'), true, 'dernier jour d''une affectation : site permis');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
SELECT ok((SELECT NOT global AND NOT retour_possible AND sites = ARRAY['00000000-0000-4000-b640-0000000000a2'::uuid]
             FROM public.perimetres_comptes() WHERE utilisateur = '00000000-0000-4000-b640-00000000000b'),
  'perimetres_comptes : sites du jour calcules par le serveur, retour impossible (affectation a venir)');
RESET ROLE;
SELECT is(pg_temp.ecarts_perimetre(), 0, 'avec affectations : site_permis identique a la regle pour un compte quelconque');

-- Journal et gardes.
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.journal_affectations_sites WHERE utilisateur IN (
  '00000000-0000-4000-b640-000000000002', '00000000-0000-4000-b640-000000000003', '00000000-0000-4000-b640-000000000004')), 9,
  'journal : 6 creations, 1 cloture, 2 annulations');
SELECT is((SELECT count(*)::int FROM public.journal_affectations_sites WHERE affectation_id = (SELECT id FROM aff_f2)
  AND evenement = 'cloture' AND (avant ->> 'fin') IS NULL AND (apres ->> 'fin')::date = current_date - 1), 1,
  'journal : la cloture garde la fin avant et apres');
RESET ROLE;
SELECT throws_ok($$UPDATE public.journal_affectations_sites SET motif = 'x'$$, '42501', NULL,
  'journal des affectations non modifiable, meme hors navigateur (garde)');
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000002');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.journal_affectations_sites), 0, 'un non-administrateur ne lit pas le journal');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SELECT throws_ok($$DELETE FROM public.affectations_sites WHERE id = (SELECT id FROM aff_f1)$$, '42501', NULL,
  'une affectation ne se supprime pas, meme hors navigateur');

-- 2. Delegations temporaires ----------------------------------------------

SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000006');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_write('trips'), false, 'etat initial : le chauffeur n''ecrit pas les voyages');
SELECT throws_ok($$SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000007', 'trips', 'ecriture',
  now(), now() + interval '1 day', 'Conges')$$, '42501', NULL, 'deleguer un droit qu''on n''a pas : refuse');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000005');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000005', 'trips', 'ecriture',
  now(), now() + interval '1 day', 'Conges')$$, '22023', NULL, 'deleguer a soi-meme : refuse');
SELECT throws_ok($$SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000006', 'settings', 'ecriture',
  now(), now() + interval '1 day', 'Conges')$$, '22023', NULL, 'l''administration ne se delegue pas');
SELECT throws_ok($$SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000006', 'trips', 'admin',
  now(), now() + interval '1 day', 'Conges')$$, '22023', NULL, 'niveau administrateur : refuse');
SELECT throws_ok($$SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000006', 'trips', 'ecriture',
  now(), now() + interval '1 day', '')$$, '22023', NULL, 'delegation sans motif : refusee');
SELECT throws_ok($$SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000006', 'trips', 'ecriture',
  now() - interval '2 days', now() - interval '1 day', 'Conges')$$, '22023', NULL, 'periode deja passee : refusee');
CREATE TEMP TABLE dlg AS SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000006', 'trips', 'ecriture',
  now(), now() + interval '7 days', 'Conges du dispatcheur') AS id;
SELECT ok((SELECT id FROM dlg) IS NOT NULL, 'le dispatcheur delegue l''ecriture des voyages');
SELECT throws_ok($$SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000006', 'trips', 'ecriture',
  now(), now() + interval '2 days', 'Doublon')$$, '22023', NULL, 'delegation identique sur la meme periode : refusee');
RESET ROLE;
SELECT ok(NOT has_table_privilege('authenticated', 'public.delegations_droits', 'INSERT')
          AND NOT has_table_privilege('authenticated', 'public.delegations_droits', 'UPDATE'),
  'ecriture directe des delegations refusee (droit retire)');

SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000006');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_write('trips'), true, 'delegation en vigueur : le delegue ecrit les voyages');
SELECT is(public.has_module_view('trips'), true, 'delegation en vigueur : le delegue lit le module');
SELECT is(public.has_module_approve('trips'), false, 'une delegation d''ecriture ne donne pas l''approbation');
SELECT is(public.has_module_write('fuel'), false, 'la delegation est bornee a son module');
SELECT throws_ok($$SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000007', 'trips', 'ecriture',
  now(), now() + interval '1 day', 'Sous-delegation')$$, '42501', NULL, 'un droit recu par delegation ne se redelegue pas');
CREATE TEMP TABLE voyage AS SELECT public.creer_voyage(current_date, '00000000-0000-4000-b640-0000000000a1',
  '00000000-0000-4000-b640-0000000000a2') AS id;
SELECT is((SELECT auteur FROM public.trip_events WHERE trip_id = (SELECT id FROM voyage)),
  '00000000-0000-4000-b640-000000000006'::uuid, 'le delegue reste l''auteur de ses actes (journal du voyage)');
SELECT is((SELECT statut FROM public.mes_delegations() WHERE id = (SELECT id FROM dlg)), 'active',
  'le delegue voit sa delegation active');
RESET ROLE;

-- Un tiers ne revoque pas ; le delegant perd son droit : delegation sans effet.
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000007');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.revoquer_delegation((SELECT id FROM dlg), 'Abus')$$, '42501', NULL,
  'un tiers ne revoque pas la delegation');
SELECT is((SELECT count(*)::int FROM public.delegations_droits WHERE id = (SELECT id FROM dlg)), 0,
  'un tiers ne lit pas la delegation');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SELECT public.definir_droit_module('00000000-0000-4000-b640-000000000005', 'trips', 'lecture', 'test D-064');
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000006');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_write('trips'), false, 'le delegant a perdu le droit : la delegation est sans effet');
SELECT is((SELECT statut FROM public.mes_delegations() WHERE id = (SELECT id FROM dlg)), 'sans_effet',
  'statut sans_effet affiche');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SELECT public.definir_droit_module('00000000-0000-4000-b640-000000000005', 'trips', 'defaut', 'test D-064');
-- Restriction administrateur sur le delegue : la delegation ne la contourne pas.
SELECT public.definir_droit_module('00000000-0000-4000-b640-000000000006', 'trips', 'aucun', 'test D-064');
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000006');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_write('trips'), false, 'restriction administrateur (D-036) : la delegation ne la contourne pas');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000005');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000006', 'trips', 'ecriture',
  now() + interval '8 days', now() + interval '9 days', 'Autre periode')$$, '22023', NULL,
  'delegation a un compte restreint par l''administrateur : refusee');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SELECT public.definir_droit_module('00000000-0000-4000-b640-000000000006', 'trips', 'defaut', 'test D-064');

-- Revocation par le delegant.
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000005');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.revoquer_delegation((SELECT id FROM dlg), NULL)$$, '22023', NULL, 'revocation sans motif refusee');
SELECT lives_ok($$SELECT public.revoquer_delegation((SELECT id FROM dlg), 'Retour anticipe')$$, 'le delegant revoque');
SELECT throws_ok($$SELECT public.revoquer_delegation((SELECT id FROM dlg), 'Encore')$$, '22023', NULL, 'double revocation refusee');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000006');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_write('trips'), false, 'delegation revoquee : plus d''ecriture');
RESET ROLE;

-- Une delegation ne depasse jamais le perimetre site du delegant.
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000004');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.deleguer_droit('00000000-0000-4000-b640-00000000000a', 'trips', 'ecriture',
  now(), now() + interval '2 days', 'Conges')$$, '22023', NULL,
  'un delegant borne a un site ne delegue pas a un compte global');
SELECT ok(NOT EXISTS (SELECT 1 FROM public.comptes_delegables() WHERE id = '00000000-0000-4000-b640-00000000000a'),
  'comptes delegables d''un compte borne : pas de compte global');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
SELECT public.affecter_site('00000000-0000-4000-b640-00000000000a', '00000000-0000-4000-b640-0000000000a1',
  current_date, NULL, 'Chauffeur du site 1');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000004');
SET LOCAL ROLE authenticated;
SELECT ok(EXISTS (SELECT 1 FROM public.comptes_delegables() WHERE id = '00000000-0000-4000-b640-00000000000a')
          AND NOT EXISTS (SELECT 1 FROM public.comptes_delegables() WHERE id = '00000000-0000-4000-b640-000000000005'),
  'comptes delegables d''un compte borne : les comptes de son site seulement');
CREATE TEMP TABLE dlg_w AS SELECT public.deleguer_droit('00000000-0000-4000-b640-00000000000a', 'trips', 'ecriture',
  now(), now() + interval '2 days', 'Conges du chef de flotte') AS id;
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-00000000000a');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_write('trips'), true, 'perimetre du delegue inclus dans celui du delegant : delegation en vigueur');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
SELECT public.affecter_site('00000000-0000-4000-b640-00000000000a', '00000000-0000-4000-b640-0000000000a3',
  current_date, NULL, 'Renfort site 3');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-00000000000a');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_write('trips'), false,
  'le delegue gagne un site que le delegant n''a pas : la delegation est sans effet');
SELECT is((SELECT statut FROM public.mes_delegations() WHERE id = (SELECT id FROM dlg_w)), 'sans_effet',
  'statut sans_effet (perimetre) affiche');
RESET ROLE;

-- La lecture du module n'est deleguee que si le delegant la detient.
UPDATE public.role_permissions SET can_view = false WHERE role = 'fleet_manager' AND module = 'drivers';
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000003');
SET LOCAL ROLE authenticated;
SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000006', 'drivers', 'ecriture',
  now(), now() + interval '2 days', 'Remplacement');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000006');
SET LOCAL ROLE authenticated;
SELECT ok(public.has_module_write('drivers') AND NOT public.has_module_view('drivers'),
  'delegant sans lecture du module : la delegation ne donne pas la lecture');
SELECT is((SELECT donne_lecture FROM public.mes_delegations() WHERE module = 'drivers'), false,
  'mes_delegations : la delegation est signalee sans lecture du module');
RESET ROLE;
UPDATE public.role_permissions SET can_view = true WHERE role = 'fleet_manager' AND module = 'drivers';
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000006');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_view('drivers'), true, 'delegant lecteur du module : lecture deleguee');
RESET ROLE;

-- Delegation a venir puis expiree.
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000005');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE dlg2 AS SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000007', 'trips', 'ecriture',
  now() + interval '1 day', now() + interval '2 days', 'Absence prevue') AS id;
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000007');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_write('trips'), false, 'delegation a venir : pas encore en vigueur');
RESET ROLE;
SELECT pg_temp.se_connecter(NULL);
UPDATE public.delegations_droits SET debut = now() - interval '3 days', fin = now() - interval '1 day'
 WHERE id = (SELECT id FROM dlg2);
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000007');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_write('trips'), false, 'delegation expiree : plus en vigueur');
SELECT is((SELECT statut FROM public.mes_delegations() WHERE id = (SELECT id FROM dlg2)), 'expiree', 'statut expiree affiche');
SELECT is(public.has_module_view('trips'), (SELECT can_view FROM public.role_permissions WHERE role = 'driver' AND module = 'trips'),
  'delegation expiree : la lecture revient au seul droit du role');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000005');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.revoquer_delegation((SELECT id FROM dlg2), 'Trop tard')$$, '22023', NULL,
  'une delegation expiree ne se revoque plus');
RESET ROLE;
SELECT throws_ok($$INSERT INTO public.delegations_droits (delegant, delegue, module, niveau, debut, fin, motif)
  VALUES ('00000000-0000-4000-b640-000000000005', '00000000-0000-4000-b640-000000000005', 'trips', 'ecriture',
          now(), now() + interval '1 day', 'x')$$, '23514', NULL, 'contrainte : pas de delegation a soi-meme, meme hors fonction');

-- C1 : l'approbation ne se delegue pas (separation des taches, sonde A0 a A4).
DELETE FROM public.settings WHERE key = 'achats_validation_separee';
INSERT INTO public.warehouses (id, name, code, warehouse_type, site_id) VALUES
  ('00000000-0000-4000-b640-0000000000d1', 'Magasin D-064', 'TEST-MAG-D064', 'main', '00000000-0000-4000-b640-0000000000a1');
INSERT INTO public.suppliers (id, supplier_number, supplier_type, company_name) VALUES
  ('00000000-0000-4000-b640-0000000000f1', 'TEST-F-D064', 'parts', 'Fournisseur D-064');
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-00000000000c');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE bc AS SELECT public.enregistrer_bon_commande(
  p_fournisseur => '00000000-0000-4000-b640-0000000000f1', p_depot => '00000000-0000-4000-b640-0000000000d1',
  p_lignes => '[{"designation": "Prestation D-064", "quantite": 1, "prix_unitaire": 25000000}]'::jsonb) AS id;
SELECT public.soumettre_bon_commande((SELECT id FROM bc));
SELECT throws_ok($$SELECT public.decider_bon_commande((SELECT id FROM bc), true)$$, '42501',
  'L''approbation revient a une autre personne que le demandeur',
  'separation des taches : le directeur n''approuve pas son propre bon');
SELECT throws_ok($$SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000007', 'purchases', 'approbation',
  now(), now() + interval '1 hour', 'Approbation de mon bon')$$, '22023', NULL,
  'C1 : l''approbation ne se delegue pas (directeur vers chauffeur)');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000008', 'purchases', 'approbation',
  now(), now() + interval '3 days', 'Absence du valideur')$$, '22023', NULL,
  'C1 : l''approbation ne se delegue pas, meme par l''administrateur');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000007');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_approve('purchases'), false, 'C1 : le chauffeur n''a aucune approbation');
SELECT throws_ok($$SELECT public.decider_bon_commande((SELECT id FROM bc), true)$$, '42501', NULL,
  'C1 : le chauffeur n''approuve pas le bon redige par le directeur');
RESET ROLE;
SELECT is((SELECT approved_by FROM public.purchase_orders WHERE id = (SELECT id FROM bc)), NULL::uuid,
  'C1 : le bon reste sans approbation');
SELECT pg_temp.se_connecter(NULL);
SELECT throws_ok($$INSERT INTO public.delegations_droits (delegant, delegue, module, niveau, debut, fin, motif)
  VALUES ('00000000-0000-4000-b640-00000000000c', '00000000-0000-4000-b640-000000000007', 'purchases', 'approbation',
          now(), now() + interval '1 day', 'x')$$, '23514', NULL, 'C1 : contrainte, aucune delegation d''approbation meme hors fonction');
SELECT ok((SELECT prosrc NOT LIKE '%delegation%' FROM pg_proc WHERE oid = 'public.has_module_approve(text)'::regprocedure),
  'C1 : has_module_approve ne lit pas les delegations');

-- Une delegation d'ecriture donne la lecture du module.
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000007');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_view('hr'), false, 'etat initial : le chauffeur ne lit pas les RH');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000007', 'hr', 'ecriture',
  now(), now() + interval '3 days', 'Remplacement RH');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000007');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_view('hr'), true, 'une delegation d''ecriture donne aussi la lecture du module');
RESET ROLE;

-- Journal des delegations.
SELECT is((SELECT count(*)::int FROM public.journal_delegations WHERE delegue IN (
  '00000000-0000-4000-b640-000000000006', '00000000-0000-4000-b640-000000000007',
  '00000000-0000-4000-b640-000000000008', '00000000-0000-4000-b640-000000000009', '00000000-0000-4000-b640-00000000000a')), 6,
  'journal : 5 creations et 1 revocation');
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000005');
SELECT throws_ok($$UPDATE public.journal_delegations SET motif = 'x'$$, '42501', NULL,
  'journal des delegations non modifiable, meme hors navigateur (garde)');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.comptes_delegables() WHERE id = '00000000-0000-4000-b640-000000000005'), 0,
  'comptes delegables : sans soi-meme');
-- C3 : une delegation ne commence jamais dans le passe.
CREATE TEMP TABLE dlg_retro AS SELECT public.deleguer_droit('00000000-0000-4000-b640-000000000006', 'fuel', 'ecriture',
  '2020-01-01'::timestamptz, now() + interval '1 hour', 'Retroactif') AS id;
SELECT is((SELECT debut FROM public.delegations_droits WHERE id = (SELECT id FROM dlg_retro)), now(),
  'C3 : un debut passe est ramene a l''instant present');
SELECT is((SELECT debut FROM public.journal_delegations WHERE delegation_id = (SELECT id FROM dlg_retro)), now(),
  'C3 : le journal consigne le debut effectif');
RESET ROLE;
SELECT ok((SELECT prosrc LIKE '%pg_advisory_xact_lock%' FROM pg_proc
            WHERE oid = 'public.deleguer_droit(uuid, text, text, timestamptz, timestamptz, text)'::regprocedure),
  'C5 : deux delegations identiques concurrentes sont serialisees (verrou consultatif)');
-- C4 : sans droit d'ecriture delegable, aucun compte propose.
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-00000000000d');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.comptes_delegables()), 0,
  'C4 : un compte sans droit d''ecriture delegable ne voit aucun compte');
RESET ROLE;
-- C5 : pas de retour au perimetre global pour un compte inactif.
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
SELECT public.affecter_site('00000000-0000-4000-b640-00000000000e', '00000000-0000-4000-b640-0000000000a1',
  current_date - 10, current_date - 5, 'Mission passee');
RESET ROLE;
SELECT pg_temp.se_connecter(NULL);
UPDATE public.profiles SET status = 'inactive' WHERE id = '00000000-0000-4000-b640-00000000000e';
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.retablir_perimetre_global('00000000-0000-4000-b640-00000000000e', 'Compte inactif')$$,
  '22023', NULL, 'C5 : retour au perimetre global refuse a un compte inactif');
RESET ROLE;
-- Indicateur derive : jamais saisi, recalcule par le serveur.
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
UPDATE public.profiles SET perimetre_affecte = false WHERE id = '00000000-0000-4000-b640-00000000000e';
SELECT is((SELECT perimetre_affecte FROM public.profiles WHERE id = '00000000-0000-4000-b640-00000000000e'), true,
  'perimetre_affecte : une ecriture directe est recalculee (indicateur derive)');
SELECT pg_temp.se_connecter(NULL);

-- 3. Journal de connexion et sessions -------------------------------------

INSERT INTO auth.audit_log_entries (instance_id, id, payload, created_at) VALUES
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-b640-0000000000c1',
   json_build_object('actor_id', '00000000-0000-4000-b640-000000000002', 'actor_username', 'flotte-f.d064@exemple.invalid',
                     'action', 'login', 'log_type', 'account', 'traits', json_build_object('provider', 'email')),
   now());
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT evenement || '|' || compte || '|' || nom || '|' || methode FROM public.v_journal_connexions
  WHERE id = '00000000-0000-4000-b640-0000000000c1'),
  'login|flotte-f.d064@exemple.invalid|Flotte F D-064|email', 'l''administrateur lit la connexion ecrite par GoTrue');
SELECT lives_ok($$SELECT * FROM public.sessions_ouvertes()$$, 'l''administrateur liste les sessions');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM information_schema.columns WHERE table_schema = 'public'
  AND table_name = 'v_journal_connexions' AND column_name IN ('payload', 'traits', 'token')), 0,
  'la vue n''expose ni payload brut ni jeton');
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000002');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.v_journal_connexions), 0, 'un non-administrateur ne lit pas le journal de connexion');
SELECT throws_ok($$SELECT * FROM public.sessions_ouvertes()$$, '42501', NULL, 'un non-administrateur ne liste pas les sessions');
RESET ROLE;

-- 4. Referentiels et sequences --------------------------------------------

INSERT INTO public.contrats (id, reference, intitule, nature, contrepartie, devise, date_debut) VALUES
  ('00000000-0000-4000-b640-0000000000e1', 'TEST-D064-CTR', 'Contrat D-064', 'autre', 'Test', 'ZZY', '2001-01-01');
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000001');
SET LOCAL ROLE authenticated;
SELECT ok(EXISTS (SELECT 1 FROM public.codes_utilises() WHERE type = 'devise' AND code = 'ZZY'
  AND source = 'contrats.devise' AND NOT au_referentiel), 'un code saisi hors referentiel est signale');
SELECT lives_ok($$SELECT public.enregistrer_devise('zzy', 'Devise de test')$$, 'l''administrateur enregistre une devise');
SELECT ok((SELECT au_referentiel FROM public.codes_utilises() WHERE type = 'devise' AND code = 'ZZY' AND source = 'contrats.devise'),
  'le code saisi est desormais au referentiel');
SELECT throws_ok($$SELECT public.enregistrer_devise('ZZ', NULL)$$, '22023', NULL, 'code devise invalide refuse');
SELECT ok(EXISTS (SELECT 1 FROM public.unites_mesure WHERE code = 'tonne'), 'unites de tarif reprises au referentiel');
SELECT is((SELECT count(*)::int FROM public.sequences_numerotation()
  WHERE code IN ('BC', 'REC', 'PAY', 'INC', 'OT', 'CONS', 'FRS', 'PL', 'CST', 'RAP', 'INT', 'MVT', 'VYG', 'FAC', 'AV', 'FR', 'FP', 'FC')), 18,
  'les numerotations existantes sont listees');
SELECT ok((SELECT compteur IS NOT DISTINCT FROM (SELECT last_value FROM pg_sequences WHERE schemaname = 'public'
            AND sequencename = 'purchase_orders_numero_seq') FROM public.sequences_numerotation() WHERE code = 'BC'),
  'le compteur est celui de la sequence (lecture seule)');
SELECT ok((SELECT dernier_numero ~ '^BC-[0-9]{4}-[0-9]{5}$' FROM public.sequences_numerotation() WHERE code = 'BC'),
  'le dernier numero de bon de commande est reconnu par son format');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b640-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT * FROM public.sequences_numerotation()$$, '42501', NULL, 'sequences : reserve a l''administrateur');
SELECT throws_ok($$SELECT public.enregistrer_unite('litre', 'Litre')$$, '42501', NULL, 'referentiel : ecriture reservee a l''administrateur');
RESET ROLE;

-- Raccourcis de vehicule_permis et voyage_permis (C2) : meme resultat que D-046.
SELECT is(pg_temp.ecarts_permis_derives(), 0,
  'vehicule_permis et voyage_permis identiques a leur definition D-046 (comptes globaux, bornes, affectes, anon)');
-- Role absent de la matrice (en dernier : modifie role_permissions).
DELETE FROM public.role_permissions WHERE role::text IN ('driver', 'accountant');
SELECT is(pg_temp.ecarts_elargis(), 0, 'equivalence elargie : role absent de la matrice, identique a main');

SELECT * FROM finish();
ROLLBACK;
