-- Tests (D-079) : saisie des referentiels (sites, comptes, infrastructures)
-- et du dossier contractuel (suppressions, tarifs en vigueur, avenant)
-- (migration 20261121170000_saisie_referentiels). Tout est annule.
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

SELECT plan(91);

-- Jeu de test : A, B et D administrateurs, U chauffeur, I inactif, C charge de contrats.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-e790-000000000001', 'admin.a.d079@exemple.invalid'),
  ('00000000-0000-4000-e790-000000000002', 'admin.b.d079@exemple.invalid'),
  ('00000000-0000-4000-e790-000000000003', 'chauffeur.d079@exemple.invalid'),
  ('00000000-0000-4000-e790-000000000004', 'inactif.d079@exemple.invalid'),
  ('00000000-0000-4000-e790-000000000005', 'contrats.d079@exemple.invalid'),
  ('00000000-0000-4000-e790-000000000006', 'admin.d.d079@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status, email) VALUES
  ('00000000-0000-4000-e790-000000000001', 'admin', 'Admin A D079', 'active', 'admin.a.d079@exemple.invalid'),
  ('00000000-0000-4000-e790-000000000002', 'admin', 'Admin B D079', 'active', 'admin.b.d079@exemple.invalid'),
  ('00000000-0000-4000-e790-000000000003', 'driver', 'Chauffeur D079', 'active', 'chauffeur.d079@exemple.invalid'),
  ('00000000-0000-4000-e790-000000000004', 'driver', 'Inactif D079', 'inactive', 'inactif.d079@exemple.invalid'),
  ('00000000-0000-4000-e790-000000000005', 'contract_manager', 'Contrats D079', 'active', 'contrats.d079@exemple.invalid'),
  ('00000000-0000-4000-e790-000000000006', 'admin', 'Admin D D079', 'active', 'admin.d.d079@exemple.invalid')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = NULL;
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-e790-0000000000a1', 'Mine D079', 'mine'),
  ('00000000-0000-4000-e790-0000000000a2', 'Depot D079', 'depot');

-- 1. Sites ------------------------------------------------------------------
SELECT col_type_is('public', 'sites', 'latitude', 'numeric(9,6)', 'latitude numeric(9,6)');
SELECT col_type_is('public', 'sites', 'longitude', 'numeric(9,6)', 'longitude numeric(9,6)');
SELECT throws_ok($$UPDATE public.sites SET latitude = 7.5 WHERE id = '00000000-0000-4000-e790-0000000000a1'$$,
  '23514', NULL, 'latitude sans longitude refusee');
SELECT throws_ok($$UPDATE public.sites SET latitude = 95, longitude = -8 WHERE id = '00000000-0000-4000-e790-0000000000a1'$$,
  '23514', NULL, 'latitude hors bornes refusee');

SELECT pg_temp.se_connecter('00000000-0000-4000-e790-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$INSERT INTO public.sites (name, type, current_stock) VALUES ('Site stock D079', 'depot', 10)$$,
  '42501', NULL, 'stock du site non saisissable a la creation');
SELECT lives_ok($$INSERT INTO public.sites (id, name, type, capacity, latitude, longitude, organisation_id)
  VALUES ('00000000-0000-4000-e790-0000000000a3', 'Port D079', 'port', 5000, 10.123456, -14.654321, NULL)$$,
  'site cree avec capacite et coordonnees');
SELECT throws_ok($$UPDATE public.sites SET current_stock = 12 WHERE id = '00000000-0000-4000-e790-0000000000a3'$$,
  '42501', NULL, 'stock du site non modifiable');
SELECT throws_ok($$UPDATE public.sites SET capacity = 0 WHERE id = '00000000-0000-4000-e790-0000000000a3'$$,
  '23514', NULL, 'capacite nulle refusee (tonnes, strictement positive)');
SELECT throws_ok($$UPDATE public.sites SET responsable_id = '00000000-0000-4000-e790-000000000004' WHERE id = '00000000-0000-4000-e790-0000000000a3'$$,
  '22023', NULL, 'responsable inactif refuse');
SELECT lives_ok($$UPDATE public.sites SET responsable_id = '00000000-0000-4000-e790-000000000003', name = 'Port D079 bis'
  WHERE id = '00000000-0000-4000-e790-0000000000a3'$$, 'responsable choisi parmi les comptes actifs');
SELECT is((SELECT (latitude, longitude, capacity)::text FROM public.sites WHERE id = '00000000-0000-4000-e790-0000000000a3'),
  '(10.123456,-14.654321,5000)', 'une modification garde les champs non envoyes');
SELECT ok((SELECT bool_and(full_name <> 'Inactif D079') AND bool_or(full_name = 'Chauffeur D079') FROM public.comptes_selectionnables()),
  'comptes selectionnables : actifs seulement');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-e790-000000000003');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT * FROM public.comptes_selectionnables()$$, '42501', NULL,
  'un chauffeur ne liste pas les comptes');
SELECT throws_ok($$SELECT public.autres_admins_actifs(NULL)$$, '42501',
  'Comptage des administrateurs reserve a l''administrateur', 'un chauffeur ne compte pas les administrateurs');
RESET ROLE;

-- 2. Comptes ----------------------------------------------------------------
SELECT ok(NOT has_function_privilege('anon', 'public.desactiver_compte(uuid, text)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.reactiver_compte(uuid, text)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.definir_site_compte(uuid, uuid, text)', 'EXECUTE'),
  'fonctions de comptes fermees a anon');
SELECT ok(NOT has_table_privilege('authenticated', 'public.journal_comptes', 'INSERT')
      AND NOT has_table_privilege('authenticated', 'public.journal_comptes', 'UPDATE')
      AND NOT has_table_privilege('authenticated', 'public.journal_comptes', 'DELETE'),
  'journal des comptes : aucune ecriture directe');
SELECT ok(has_function_privilege('authenticated', 'public.autres_admins_actifs(uuid)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.autres_admins_actifs(uuid)', 'EXECUTE'),
  'comptage des administrateurs ouvert aux comptes (garde INVOKER), ferme a anon');

SELECT pg_temp.se_connecter('00000000-0000-4000-e790-000000000001');
SET LOCAL ROLE authenticated;
-- Creation d'un compte borne a un site (chemin de la fonction Edge apres
-- l'ecriture du profil : definir_site_compte avec le jeton de l'administrateur).
SELECT lives_ok($$SELECT public.definir_site_compte('00000000-0000-4000-e790-000000000003', '00000000-0000-4000-e790-0000000000a1')$$,
  'compte affecte a un site');
SELECT is((SELECT site_id FROM public.profiles WHERE id = '00000000-0000-4000-e790-000000000003'),
  '00000000-0000-4000-e790-0000000000a1'::uuid, 'site du compte enregistre');
SELECT is((SELECT action FROM public.journal_comptes WHERE utilisateur = '00000000-0000-4000-e790-000000000003'), 'site',
  'affectation journalisee');
SELECT throws_ok($$SELECT public.definir_site_compte('00000000-0000-4000-e790-000000000005', NULL)$$,
  '22023', 'Compte global (tous les sites) : motif obligatoire', 'compte global sans motif refuse');
SELECT lives_ok($$SELECT public.definir_site_compte('00000000-0000-4000-e790-000000000005', NULL, 'Charge de contrats, tous sites')$$,
  'compte global par choix motive');
SELECT is((SELECT motif FROM public.journal_comptes WHERE utilisateur = '00000000-0000-4000-e790-000000000005' AND action = 'perimetre_global'),
  'Charge de contrats, tous sites', 'choix global journalise avec son motif');
SELECT throws_ok($$SELECT public.definir_site_compte('00000000-0000-4000-e790-000000000005', gen_random_uuid())$$,
  '22023', 'Site inconnu ou inactif', 'site inconnu refuse');
SELECT throws_ok($$UPDATE public.profiles SET site_id = NULL WHERE id = '00000000-0000-4000-e790-000000000003'$$,
  '42501', NULL, 'site d''un compte non modifiable par update direct');
SELECT throws_ok($$UPDATE public.profiles SET status = 'inactive' WHERE id = '00000000-0000-4000-e790-000000000003'$$,
  '42501', NULL, 'statut non modifiable par update direct');
SELECT throws_ok($$UPDATE public.profiles SET role = 'driver' WHERE id = '00000000-0000-4000-e790-000000000001'$$,
  '42501', NULL, 'un administrateur ne change pas son propre role');
-- Retrogradation d'un autre administrateur par l'API (UserModal) : la garde
-- INVOKER compte les administrateurs restants sous le role authenticated.
SELECT lives_ok($$UPDATE public.profiles SET role = 'director' WHERE id = '00000000-0000-4000-e790-000000000002'$$,
  'A retrograde l''administrateur B (D reste actif)');
SELECT is((SELECT role::text FROM public.profiles WHERE id = '00000000-0000-4000-e790-000000000002'), 'director',
  'retrogradation enregistree');
SELECT throws_ok($$SELECT public.desactiver_compte('00000000-0000-4000-e790-000000000001', 'test')$$,
  '42501', 'Vous ne pouvez pas desactiver votre propre compte', 'desactivation refusee sur soi-meme');
SELECT throws_ok($$SELECT public.desactiver_compte('00000000-0000-4000-e790-000000000003', '  ')$$,
  '22023', 'Motif de la desactivation obligatoire', 'desactivation sans motif refusee');
SELECT lives_ok($$SELECT public.desactiver_compte('00000000-0000-4000-e790-000000000003', 'Depart de l''entreprise')$$,
  'desactivation motivee');
SELECT is((SELECT status FROM public.profiles WHERE id = '00000000-0000-4000-e790-000000000003'), 'inactive', 'compte inactif');
SELECT throws_ok($$SELECT public.desactiver_compte('00000000-0000-4000-e790-000000000003', 'encore')$$,
  '22023', 'Compte deja inactif', 'double desactivation refusee');
SELECT lives_ok($$SELECT public.reactiver_compte('00000000-0000-4000-e790-000000000003', 'Retour de conge')$$,
  'reactivation motivee');
SELECT is((SELECT array_agg(action ORDER BY le, action) FROM public.journal_comptes WHERE utilisateur = '00000000-0000-4000-e790-000000000003'),
  ARRAY['desactivation', 'reactivation', 'site'], 'desactivation et reactivation journalisees');
RESET ROLE;
-- MFA exige (D-040) : desactivation refusee sans second facteur.
INSERT INTO public.settings (key, value) VALUES ('mfa_exige', '{"value": "true"}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
SELECT pg_temp.se_connecter('00000000-0000-4000-e790-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.desactiver_compte('00000000-0000-4000-e790-000000000003', 'Sans MFA')$$,
  '42501', 'Confirmation en deux etapes (MFA) requise pour cette operation', 'mfa exige : desactivation sans aal2 refusee');
RESET ROLE;
DELETE FROM public.settings WHERE key = 'mfa_exige';

SELECT pg_temp.se_connecter('00000000-0000-4000-e790-000000000003');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.desactiver_compte('00000000-0000-4000-e790-000000000002', 'x')$$,
  '42501', NULL, 'un chauffeur ne desactive pas un compte');
RESET ROLE;

-- Dernier administrateur actif : les autres administrateurs (y compris
-- reels) sont desactives un a un dans la transaction annulee, A reste seul.
SELECT pg_temp.se_connecter(NULL);
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles
            WHERE role = 'admin' AND status = 'active' AND id <> '00000000-0000-4000-e790-000000000001' LOOP
    UPDATE public.profiles SET status = 'inactive' WHERE id = r.id;
  END LOOP;
END $$;
SELECT throws_ok($$UPDATE public.profiles SET status = 'inactive' WHERE id = '00000000-0000-4000-e790-000000000001'$$,
  '42501', 'Dernier administrateur actif : il garde son role et son statut', 'dernier administrateur : desactivation refusee (tout chemin)');
SELECT throws_ok($$UPDATE public.profiles SET role = 'director' WHERE id = '00000000-0000-4000-e790-000000000001'$$,
  '42501', 'Dernier administrateur actif : il garde son role et son statut', 'dernier administrateur : changement de role refuse');
SELECT is((SELECT count(*)::int FROM public.profiles WHERE role = 'admin' AND status = 'active'), 1, 'un administrateur actif demeure');
SELECT pg_temp.se_connecter('00000000-0000-4000-e790-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$UPDATE public.profiles SET role = 'director' WHERE id = '00000000-0000-4000-e790-000000000001'$$,
  '42501', 'Dernier administrateur actif : il garde son role et son statut',
  'dernier administrateur : retrogradation par l''API refusee avec un message clair');
RESET ROLE;
SELECT pg_temp.se_connecter(NULL);

-- 3. Infrastructures et fermetures -------------------------------------------
SELECT ok(NOT has_column_privilege('authenticated', 'public.infrastructures_site', 'cree_par', 'INSERT')
      AND NOT has_column_privilege('authenticated', 'public.fermetures_site', 'declare_par', 'INSERT')
      AND NOT has_column_privilege('authenticated', 'public.fermetures_site', 'levee_par', 'UPDATE')
      AND NOT has_column_privilege('authenticated', 'public.infrastructures_site', 'cree_par', 'UPDATE')
      AND NOT has_column_privilege('authenticated', 'public.fermetures_site', 'declare_par', 'UPDATE'),
  'auteur jamais transmis par le client');
SELECT pg_temp.se_connecter('00000000-0000-4000-e790-000000000001');
SET LOCAL ROLE authenticated;
INSERT INTO public.infrastructures_site (id, site_id, type, code, libelle)
VALUES ('00000000-0000-4000-e790-0000000000b1', '00000000-0000-4000-e790-0000000000a1', 'pont_bascule', 'PB-D079', 'Pont-bascule D079');
INSERT INTO public.fermetures_site (id, site_id, debut, motif)
VALUES ('00000000-0000-4000-e790-0000000000b2', '00000000-0000-4000-e790-0000000000a1', now() + interval '1 day', 'Travaux D079');
UPDATE public.fermetures_site SET levee_le = now(), motif_levee = 'Travaux reportes' WHERE id = '00000000-0000-4000-e790-0000000000b2';
RESET ROLE;
SELECT is((SELECT cree_par FROM public.infrastructures_site WHERE id = '00000000-0000-4000-e790-0000000000b1'),
  '00000000-0000-4000-e790-000000000001'::uuid, 'infrastructure : auteur renseigne par le serveur');
SELECT is((SELECT (declare_par, levee_par)::text FROM public.fermetures_site WHERE id = '00000000-0000-4000-e790-0000000000b2'),
  '(00000000-0000-4000-e790-000000000001,00000000-0000-4000-e790-000000000001)', 'fermeture : declarant et auteur de la levee renseignes');
SELECT pg_temp.se_connecter('00000000-0000-4000-e790-000000000001');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$UPDATE public.infrastructures_site SET libelle = 'Pont-bascule D079 bis' WHERE id = '00000000-0000-4000-e790-0000000000b1'$$,
  'infrastructure : modification ordinaire acceptee');
RESET ROLE;
-- Tout chemin (y compris une fonction serveur) : l'auteur ne change pas.
SELECT pg_temp.se_connecter(NULL);
SELECT throws_ok($$UPDATE public.infrastructures_site SET cree_par = '00000000-0000-4000-e790-000000000002' WHERE id = '00000000-0000-4000-e790-0000000000b1'$$,
  '42501', 'Auteur de l''infrastructure non modifiable', 'infrastructure : auteur non modifiable');
SELECT throws_ok($$UPDATE public.fermetures_site SET declare_par = '00000000-0000-4000-e790-000000000002' WHERE id = '00000000-0000-4000-e790-0000000000b2'$$,
  '42501', 'Declarant de la fermeture non modifiable', 'fermeture : declarant non modifiable');

-- 4. Dossier contractuel -------------------------------------------------------
SELECT is((SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND cmd = 'DELETE'
            AND tablename IN ('contrats', 'contrat_versions', 'contrat_engagements', 'contrat_tarifs')), 0,
  'aucune politique de suppression sur le dossier contractuel');
SELECT ok(NOT has_table_privilege('authenticated', 'public.contrats', 'DELETE')
      AND NOT has_table_privilege('authenticated', 'public.contrat_versions', 'DELETE')
      AND NOT has_table_privilege('authenticated', 'public.contrat_engagements', 'DELETE')
      AND NOT has_table_privilege('authenticated', 'public.contrat_tarifs', 'DELETE'),
  'privilege de suppression retire');

-- Contrat actif K1 (version 0 en vigueur, version 1 future), brouillon K2.
INSERT INTO public.contrats (id, reference, intitule, nature, contrepartie, devise, date_debut, statut) VALUES
  ('00000000-0000-4000-e790-0000000000c1', 'TEST-D079-ACTIF', 'Transport', 'client', 'CBG', 'USD', '2001-01-01', 'actif'),
  ('00000000-0000-4000-e790-0000000000c2', 'TEST-D079-BROUILLON', 'Location', 'location', 'Neemba', 'USD', '2001-01-01', 'brouillon');
INSERT INTO public.contrat_versions (id, contrat_id, numero, intitule, date_effet) VALUES
  ('00000000-0000-4000-e790-0000000000d0', '00000000-0000-4000-e790-0000000000c1', 0, 'Contrat initial', '2001-01-01'),
  ('00000000-0000-4000-e790-0000000000d2', '00000000-0000-4000-e790-0000000000c2', 0, 'Contrat initial', '2001-01-01');
INSERT INTO public.contrat_tarifs (id, version_id, libelle, unite, prix) VALUES
  ('00000000-0000-4000-e790-0000000000e0', '00000000-0000-4000-e790-0000000000d0', 'Transport mine - port', 'tonne', 4.5),
  ('00000000-0000-4000-e790-0000000000e1', '00000000-0000-4000-e790-0000000000d0', 'Transport mine - stock', 'tonne', 3),
  ('00000000-0000-4000-e790-0000000000e2', '00000000-0000-4000-e790-0000000000d2', 'Chargeuse', 'heure', 100);
INSERT INTO public.contrat_engagements (id, version_id, indicateur, libelle, seuil, unite, sens, periodicite) VALUES
  ('00000000-0000-4000-e790-0000000000f0', '00000000-0000-4000-e790-0000000000d0', 'disponibilite', 'Disponibilite', 85, '%', 'minimum', 'mois');

SELECT pg_temp.se_connecter('00000000-0000-4000-e790-000000000005');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.supprimer_element_contrat('contrat_tarifs', '00000000-0000-4000-e790-0000000000e1', 'Erreur de saisie')$$,
  '22023', NULL, 'contrat actif : aucun element ne se supprime');
SELECT throws_ok($$SELECT public.supprimer_element_contrat('contrat_versions', '00000000-0000-4000-e790-0000000000d2', 'Erreur de saisie')$$,
  '23503', NULL, 'brouillon : une version qui porte des tarifs ne se supprime pas');
SELECT throws_ok($$SELECT public.supprimer_element_contrat('contrat_tarifs', '00000000-0000-4000-e790-0000000000e2', '')$$,
  '22023', 'Motif de la suppression obligatoire', 'suppression sans motif refusee');
SELECT lives_ok($$SELECT public.supprimer_element_contrat('contrat_tarifs', '00000000-0000-4000-e790-0000000000e2', 'Doublon de saisie')$$,
  'brouillon : tarif jamais utilise supprime avec motif');
SELECT is((SELECT (motif, contenu->>'libelle', auteur)::text FROM public.suppressions_contrats WHERE ligne_id = '00000000-0000-4000-e790-0000000000e2'),
  '("Doublon de saisie",Chargeuse,00000000-0000-4000-e790-000000000005)', 'suppression journalisee (motif, contenu, auteur)');
SELECT throws_ok($$UPDATE public.contrat_tarifs SET prix = 5 WHERE id = '00000000-0000-4000-e790-0000000000e0'$$,
  '22023', NULL, 'tarif en vigueur d''un contrat actif non modifiable sur place');
SELECT throws_ok($$INSERT INTO public.contrat_tarifs (version_id, libelle, unite, prix)
  VALUES ('00000000-0000-4000-e790-0000000000d0', 'Ajout sur place', 'tonne', 9)$$,
  '22023', NULL, 'version en vigueur d''un contrat actif : aucun tarif ajoute sur place');
SELECT throws_ok($$UPDATE public.contrat_engagements SET seuil = 70 WHERE id = '00000000-0000-4000-e790-0000000000f0'$$,
  '22023', NULL, 'engagement en vigueur d''un contrat actif non modifiable sur place');
SELECT lives_ok($$INSERT INTO public.contrat_tarifs (version_id, libelle, unite, prix)
  VALUES ('00000000-0000-4000-e790-0000000000d2', 'Pelle', 'heure', 120)$$,
  'contrat brouillon : tarif ajoute librement');
SELECT throws_ok($$UPDATE public.contrat_versions SET date_effet = '2099-01-01' WHERE id = '00000000-0000-4000-e790-0000000000d0'$$,
  '22023', NULL, 'date d''effet d''une version en vigueur fixe');
SELECT throws_ok($$UPDATE public.contrats SET statut = 'brouillon' WHERE id = '00000000-0000-4000-e790-0000000000c1'$$,
  '22023', NULL, 'un contrat actif ne repasse pas en brouillon');
SELECT throws_ok($$SELECT public.modifier_tarif_par_avenant('00000000-0000-4000-e790-0000000000e0', 5, 'Revision', '2001-01-01')$$,
  '22023', NULL, 'avenant : date d''effet apres la version modifiee');
SELECT lives_ok($$SELECT public.modifier_tarif_par_avenant('00000000-0000-4000-e790-0000000000e0', 5, 'Revision du tarif port', '2001-06-01')$$,
  'modification du tarif par avenant');
SELECT is((SELECT string_agg(t.libelle || '=' || t.prix, ', ' ORDER BY t.libelle)
             FROM public.contrat_tarifs t JOIN public.contrat_versions v ON v.id = t.version_id
            WHERE v.contrat_id = '00000000-0000-4000-e790-0000000000c1' AND v.numero = 1)
          || ' / ' || (SELECT count(*) FROM public.contrat_engagements e JOIN public.contrat_versions v ON v.id = e.version_id
                        WHERE v.contrat_id = '00000000-0000-4000-e790-0000000000c1' AND v.numero = 1),
  'Transport mine - port=5, Transport mine - stock=3 / 1', 'avenant n° 1 : grille reprise, tarif vise modifie, engagement repris');
SELECT is((SELECT prix FROM public.contrat_tarifs WHERE id = '00000000-0000-4000-e790-0000000000e0'), 4.5::numeric,
  'le tarif de la version initiale reste intact');
RESET ROLE;
-- Clause active sur la version n° 1 (en vigueur) et facture emise jusqu'au
-- 31/12/2010 sur K1.
INSERT INTO public.contrat_clauses (id, version_id, type_clause, libelle, engagement_id, declenchement, base, valeur)
SELECT '00000000-0000-4000-e790-0000000000a9', e.version_id, 'penalite', 'Penalite D079', e.id, 'non_tenu', 'taux', 2
  FROM public.contrat_engagements e JOIN public.contrat_versions v ON v.id = e.version_id
 WHERE v.contrat_id = '00000000-0000-4000-e790-0000000000c1' AND v.numero = 1;
INSERT INTO public.factures (contrat_id, objet, periode_debut, periode_fin, devise, taux_taxe_pct, statut)
VALUES ('00000000-0000-4000-e790-0000000000c1', 'Transport D079', '2010-12-01', '2010-12-31', 'USD', 0, 'emise');

SELECT pg_temp.se_connecter('00000000-0000-4000-e790-000000000005');
SET LOCAL ROLE authenticated;
-- Grille figee : engagements et clauses d'une version en vigueur.
SELECT throws_ok($$INSERT INTO public.contrat_engagements (version_id, indicateur, libelle, seuil, unite, sens, periodicite)
  VALUES ('00000000-0000-4000-e790-0000000000d0', 'rotations', 'Rotations', 10, 'u', 'minimum', 'jour')$$,
  '22023', NULL, 'version en vigueur : aucun engagement ajoute sur place');
SELECT throws_ok($$SELECT public.definir_clause(v.id, 'bonus', 'Bonus D079', e.id, 'tenu', 'montant', 100)
  FROM public.contrat_versions v JOIN public.contrat_engagements e ON e.version_id = v.id
 WHERE v.contrat_id = '00000000-0000-4000-e790-0000000000c1' AND v.numero = 1$$,
  '22023', NULL, 'version en vigueur : aucune clause saisie sur place');
SELECT throws_ok($$SELECT public.desactiver_clause('00000000-0000-4000-e790-0000000000a9', 'Erreur')$$,
  '22023', NULL, 'version en vigueur : aucune clause desactivee sur place');
-- Creation directe d'une version d'un contrat engage.
SELECT throws_ok($$INSERT INTO public.contrat_versions (contrat_id, numero, intitule, date_effet)
  VALUES ('00000000-0000-4000-e790-0000000000c1', 2, 'Directe', '2099-01-01')$$,
  '22023', NULL, 'contrat actif : pas de version creee en direct');
-- Sequence et periodes facturees.
SELECT throws_ok($$SELECT public.creer_avenant('00000000-0000-4000-e790-0000000000c1', 2, 'Trop tot', '2001-03-01')$$,
  '22023', NULL, 'creer_avenant : date d''effet apres toute version du contrat');
SELECT throws_ok($$SELECT public.creer_avenant('00000000-0000-4000-e790-0000000000c1', 5, 'Hors sequence', '2099-01-01')$$,
  '22023', 'Numero d''avenant attendu : 2 (version suivante)', 'creer_avenant : numero suivant impose');
SELECT throws_ok($$SELECT public.creer_avenant('00000000-0000-4000-e790-0000000000c1', 2, 'Retroactif', '2005-01-01')$$,
  '22023', 'Periode deja facturee ou controlee jusqu''au 31/12/2010 : l''avenant prend effet apres',
  'creer_avenant : pas d''effet sur une periode facturee');
SELECT throws_ok($$SELECT public.modifier_tarif_par_avenant(t.id, 6, 'Retroactif', '2005-01-01')
  FROM public.contrat_tarifs t JOIN public.contrat_versions v ON v.id = t.version_id
 WHERE v.contrat_id = '00000000-0000-4000-e790-0000000000c1' AND v.numero = 1 AND t.libelle = 'Transport mine - port'$$,
  '22023', NULL, 'modifier_tarif_par_avenant : pas d''effet sur une periode facturee');
-- Avenant avec reprise atomique (creer_avenant) : version future, libre.
SELECT lives_ok($$SELECT public.creer_avenant('00000000-0000-4000-e790-0000000000c1', 2, 'Avenant futur', '2099-01-01')$$,
  'creer_avenant : avenant futur cree');
SELECT is((SELECT string_agg(t.libelle || '=' || t.prix, ', ' ORDER BY t.libelle)
             FROM public.contrat_tarifs t JOIN public.contrat_versions v ON v.id = t.version_id
            WHERE v.contrat_id = '00000000-0000-4000-e790-0000000000c1' AND v.numero = 2)
          || ' / ' || (SELECT count(*) FROM public.contrat_engagements e JOIN public.contrat_versions v ON v.id = e.version_id
                        WHERE v.contrat_id = '00000000-0000-4000-e790-0000000000c1' AND v.numero = 2),
  'Transport mine - port=5, Transport mine - stock=3 / 1', 'creer_avenant : grille de la version n° 1 reprise');
SELECT is((SELECT string_agg(k.libelle || '@' || e.libelle, ', ')
             FROM public.contrat_clauses k JOIN public.contrat_versions v ON v.id = k.version_id
             JOIN public.contrat_engagements e ON e.id = k.engagement_id AND e.version_id = v.id
            WHERE v.contrat_id = '00000000-0000-4000-e790-0000000000c1' AND v.numero = 2 AND k.actif),
  'Penalite D079@Disponibilite', 'creer_avenant : clause active reprise sur l''engagement de la nouvelle version');
SELECT lives_ok($$INSERT INTO public.contrat_tarifs (version_id, libelle, unite, prix)
  SELECT v.id, 'Nouvel engin', 'km', 2 FROM public.contrat_versions v
   WHERE v.contrat_id = '00000000-0000-4000-e790-0000000000c1' AND v.numero = 2$$,
  'version future : tarif ajoute');
SELECT lives_ok($$UPDATE public.contrat_engagements e SET seuil = 90 FROM public.contrat_versions v
   WHERE v.id = e.version_id AND v.contrat_id = '00000000-0000-4000-e790-0000000000c1' AND v.numero = 2$$,
  'version future : engagement modifie');
SELECT lives_ok($$SELECT public.definir_clause(v.id, 'bonus', 'Bonus D079', e.id, 'tenu', 'montant', 100)
  FROM public.contrat_versions v JOIN public.contrat_engagements e ON e.version_id = v.id
 WHERE v.contrat_id = '00000000-0000-4000-e790-0000000000c1' AND v.numero = 2$$,
  'version future : clause saisie');
-- Contrat brouillon : version directe ; activation seulement avec un tarif.
SELECT lives_ok($$INSERT INTO public.contrat_versions (contrat_id, numero, intitule, date_effet)
  VALUES ('00000000-0000-4000-e790-0000000000c2', 1, 'Avenant brouillon', '2002-01-01')$$,
  'contrat brouillon : version creee en direct');
SELECT throws_ok($$INSERT INTO public.contrats (reference, intitule, nature, contrepartie, devise, date_debut, statut)
  VALUES ('TEST-D079-DIRECT', 'Direct', 'client', 'CBG', 'USD', '2001-01-01', 'actif')$$,
  '22023', NULL, 'un contrat ne nait pas actif (aucun tarif)');
SELECT lives_ok($$INSERT INTO public.contrats (id, reference, intitule, nature, contrepartie, devise, date_debut)
  VALUES ('00000000-0000-4000-e790-0000000000c3', 'TEST-D079-VIDE', 'Vide', 'client', 'CBG', 'USD', '2001-01-01')$$,
  'contrat cree en brouillon');
SELECT throws_ok($$UPDATE public.contrats SET statut = 'actif' WHERE id = '00000000-0000-4000-e790-0000000000c3'$$,
  '22023', 'Contrat sans tarif : saisir le contrat initial et sa grille en brouillon avant de l''activer',
  'activation d''un contrat sans tarif refusee');
SELECT lives_ok($$UPDATE public.contrats SET statut = 'actif' WHERE id = '00000000-0000-4000-e790-0000000000c2'$$,
  'activation d''un contrat avec tarif');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-e790-000000000003');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.creer_avenant('00000000-0000-4000-e790-0000000000c1', 3, 'Chauffeur', '2100-01-01')$$,
  '42501', NULL, 'creer_avenant refuse sans droit contrats');
RESET ROLE;
SELECT ok(NOT has_function_privilege('anon', 'public.creer_avenant(uuid, integer, text, date, date, text, text)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.modifier_tarif_par_avenant(uuid, numeric, text, date, text, text, text)', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.controler_date_avenant(uuid, date)', 'EXECUTE'),
  'fonctions d''avenant fermees a anon, controle de date interne');

-- Activation d'un compte cree (fonction Edge) : journal et activation ensemble.
RESET ROLE;
SELECT ok(NOT has_function_privilege('authenticated', 'public.activer_compte_cree(uuid, uuid)', 'EXECUTE'), 'activer_compte_cree fermee a authenticated');
SELECT ok(NOT has_function_privilege('anon', 'public.activer_compte_cree(uuid, uuid)', 'EXECUTE'), 'activer_compte_cree fermee a anon');
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-e790-000000000007', 'cree.d079@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status, email)
VALUES ('00000000-0000-4000-e790-000000000007', 'driver', 'Cree D079', 'inactive', 'cree.d079@exemple.invalid');
SELECT pg_temp.se_connecter(NULL);
SELECT public.activer_compte_cree('00000000-0000-4000-e790-000000000007', '00000000-0000-4000-e790-000000000001');
SELECT is((SELECT status FROM public.profiles WHERE id = '00000000-0000-4000-e790-000000000007'), 'active', 'compte cree active');
SELECT is((SELECT count(*)::integer FROM public.journal_comptes WHERE utilisateur = '00000000-0000-4000-e790-000000000007' AND action = 'creation'
           AND auteur = '00000000-0000-4000-e790-000000000001'), 1, 'activation journalisee avec son auteur');
SELECT throws_ok($$SELECT public.activer_compte_cree('00000000-0000-4000-e790-000000000007', NULL)$$, '22023', NULL,
  'un compte deja actif ne se reactive pas par cette voie');

SELECT * FROM finish();
ROLLBACK;
