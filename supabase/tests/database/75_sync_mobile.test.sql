-- Tests (D-102, tranche T1) : synchronisation mobile idempotente.
-- Un lot envoye par le mobile execute les fonctions de saisie du cycle
-- (D-089) ; un client_id deja recu renvoie son resultat archive sans
-- reexecuter ; un refus metier passe « a_arbitrer » ; la lecture des
-- operations est limitee a leur auteur. Tout est annule en fin.
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

SELECT plan(15);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8f75-000000000001', 'mobile.t1@exemple.invalid'),
  ('00000000-0000-4000-8f75-000000000002', 'autre.t1@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status) VALUES
  ('00000000-0000-4000-8f75-000000000001', 'contract_manager', 'Agent mobile', 'active'),
  ('00000000-0000-4000-8f75-000000000002', 'accountant', 'Autre compte', 'active')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-8f75-0000000000a1', 'Site mobile T1', 'mine');
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status) VALUES
  ('00000000-0000-4000-8f75-0000000000b1', 'TEST-MOB-1', 'Test', 40, 'tipper', 'active'),
  ('00000000-0000-4000-8f75-0000000000b2', 'TEST-MOB-2', 'Test', 40, 'tipper', 'active');
INSERT INTO public.drivers (id, name, license_number, license_category, license_expiry, hire_date, status) VALUES
  ('00000000-0000-4000-8f75-0000000000c1', 'Chauffeur mobile', 'MO-1', 'C', current_date + 100, current_date - 100, 'active');
INSERT INTO public.trips (id, reference, planned_date, vehicle_id, departure_site_id, driver_id) VALUES
  ('00000000-0000-4000-8f75-0000000000d1', 'TEST-MOB-T1', current_date, '00000000-0000-4000-8f75-0000000000b1',
   '00000000-0000-4000-8f75-0000000000a1', '00000000-0000-4000-8f75-0000000000c1');

-- Fiche FR menee jusqu'a l'etat saisissable (cycle D-089).
SELECT pg_temp.se_connecter('00000000-0000-4000-8f75-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE gen AS SELECT * FROM public.generer_fiches_rotation(current_date, '00000000-0000-4000-8f75-0000000000a1');
CREATE TEMP TABLE fr AS SELECT fiche_id AS id FROM gen WHERE vehicle_id = '00000000-0000-4000-8f75-0000000000b1';
SELECT is(public.attribuer_fiches(ARRAY[(SELECT id FROM fr)], 'Agent Mobile'), 1, 'fiche attribuee');
SELECT is(public.changer_etat_fiche((SELECT id FROM fr), 'a_imprimer'), 'a_imprimer', 'fiche a imprimer');
SELECT is(public.enregistrer_impression_fiches(ARRAY[(SELECT id FROM fr)]), 1, 'fiche imprimee');
CREATE TEMP TABLE rem AS SELECT public.remettre_fiches(ARRAY[(SELECT id FROM fr)], 'agent mobile', NULL, now(), NULL, 'Debut de poste') AS id;
SELECT lives_ok($$SELECT public.confirmer_remise((SELECT id FROM rem), 'signature')$$, 'remise confirmee');
SELECT lives_ok($$SELECT public.enregistrer_retour_fiches('Agent Mobile',
  jsonb_build_array(jsonb_build_object('fiche_id', (SELECT id FROM fr), 'etat_retour', 'complete')))$$, 'retour enregistre');

-- 1. Premier envoi : la ligne est saisie par la fonction du cycle.
CREATE TEMP TABLE lot1 AS SELECT public.synchroniser_saisies_mobile(jsonb_build_array(
  jsonb_build_object('client_id', 'mob-001', 'fonction', 'saisir_ligne_rotation',
    'fiche_id', (SELECT id FROM fr),
    'params', jsonb_build_object('rang', 1,
      'ligne', jsonb_build_object('trip_id', '00000000-0000-4000-8f75-0000000000d1',
        'ticket_cbg', 'TCK-MOB-1', 'km_depart', 1000, 'km_arrivee', 1042, 'observations', 'RAS'))))) AS sorties;
SELECT is((SELECT e ->> 'statut' FROM jsonb_array_elements((SELECT sorties FROM lot1)) e
  WHERE e ->> 'client_id' = 'mob-001'), 'ok', 'premier envoi : ligne saisie (statut ok)');
SELECT ok((SELECT (e -> 'resultat' ->> 'id') IS NOT NULL FROM jsonb_array_elements((SELECT sorties FROM lot1)) e
  WHERE e ->> 'client_id' = 'mob-001'), 'premier envoi : identifiant de ligne renvoye');

-- 2. Rejeu du meme client_id : resultat archive, aucune reexecution.
CREATE TEMP TABLE lot2 AS SELECT public.synchroniser_saisies_mobile(jsonb_build_array(
  jsonb_build_object('client_id', 'mob-001', 'fonction', 'saisir_ligne_rotation',
    'fiche_id', (SELECT id FROM fr),
    'params', jsonb_build_object('rang', 1,
      'ligne', jsonb_build_object('trip_id', '00000000-0000-4000-8f75-0000000000d1',
        'ticket_cbg', 'TCK-MOB-1', 'km_depart', 1000, 'km_arrivee', 1042))))) AS sorties;
SELECT is((SELECT e ->> 'statut' FROM jsonb_array_elements((SELECT sorties FROM lot2)) e
  WHERE e ->> 'client_id' = 'mob-001'), 'rejouee', 'rejeu : operation non reexecutee');
SELECT is((SELECT count(*)::int FROM public.fiches_rotations_lignes WHERE fiche_id = (SELECT id FROM fr)), 1,
  'rejeu : toujours une seule ligne de rotation');

-- 3. Refus metier (voyage d'un autre camion) : a_arbitrer, pas d'exception.
CREATE TEMP TABLE lot3 AS SELECT public.synchroniser_saisies_mobile(jsonb_build_array(
  jsonb_build_object('client_id', 'mob-002', 'fonction', 'saisir_ligne_rotation',
    'fiche_id', (SELECT id FROM fr),
    'params', jsonb_build_object('rang', 2,
      'ligne', jsonb_build_object('trip_id', '00000000-0000-4000-8f75-0000000000d1'))))) AS sorties;
-- le meme voyage sur une fiche d'un autre camion serait refuse ; ici le refus
-- vient du rang 2 sans second voyage : refus metier attendu.
SELECT ok(EXISTS (SELECT 1 FROM public.sync_mobile_operations WHERE client_id = 'mob-002'), 'refus metier archive');
SELECT is((SELECT statut FROM public.sync_mobile_operations WHERE client_id = 'mob-002'), 'a_arbitrer',
  'refus metier : statut a_arbitrer, message conserve, lot non interrompu');

-- 4. Fonction hors liste blanche : refusee, archivee.
CREATE TEMP TABLE lot4 AS SELECT public.synchroniser_saisies_mobile(jsonb_build_array(
  jsonb_build_object('client_id', 'mob-003', 'fonction', 'valider_fiche', 'fiche_id', (SELECT id FROM fr),
    'params', '{}'::jsonb))) AS sorties;
SELECT is((SELECT e ->> 'statut' FROM jsonb_array_elements((SELECT sorties FROM lot4)) e
  WHERE e ->> 'client_id' = 'mob-003'), 'erreur', 'fonction hors liste blanche refusee');

-- 5. Lecture des operations : auteur seul.
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-8f75-000000000002');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.sync_mobile_operations), 0,
  'un autre compte ne lit pas les operations de synchronisation');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-8f75-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.sync_mobile_operations), 3,
  'l auteur retrouve ses trois operations (ok, a_arbitrer, erreur)');
SELECT ok(NOT has_function_privilege('anon', 'public.synchroniser_saisies_mobile(jsonb)', 'EXECUTE'),
  'fonction de synchronisation inaccessible a anon');
RESET ROLE;

SELECT finish();
ROLLBACK;
