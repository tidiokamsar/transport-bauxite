-- Tests RLS (D-036) : droits d'acces aux modules par utilisateur
-- (migration 20261112060000). L'attribution specifique prime sur la matrice
-- du role, dans les deux sens ; compte actif exige ; journalisation.
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

SELECT plan(25);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-9000-000000000010', 'admin.d036@exemple.invalid'),
  ('00000000-0000-4000-9000-000000000011', 'chauffeur.d036@exemple.invalid'),
  ('00000000-0000-4000-9000-000000000012', 'comptable.d036@exemple.invalid'),
  ('00000000-0000-4000-9000-000000000013', 'inactif.d036@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status) VALUES
  ('00000000-0000-4000-9000-000000000010', 'admin', 'Admin D-036', 'active'),
  ('00000000-0000-4000-9000-000000000011', 'driver', 'Chauffeur D-036', 'active'),
  ('00000000-0000-4000-9000-000000000012', 'accountant', 'Comptable D-036', 'active'),
  ('00000000-0000-4000-9000-000000000013', 'accountant', 'Inactif D-036', 'inactive')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name, status = EXCLUDED.status;

INSERT INTO public.employees (id, employee_number, first_name, last_name, position, department)
VALUES ('00000000-0000-4000-9000-0000000000d1', 'TEST-D036-E1', 'Test', 'D036', 'Chauffeur', 'Transport');

-- Etat de depart, avant toute attribution : la matrice du role s'applique.
SELECT pg_temp.se_connecter('00000000-0000-4000-9000-000000000011');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_view('hr'), false, 'etat initial : un chauffeur ne lit pas les RH');
SELECT is(public.has_module_write('trips'), false, 'etat initial : un chauffeur n''ecrit pas les voyages');
RESET ROLE;

-- Attribution : le chauffeur gagne la lecture des RH, puis l'ecriture des
-- voyages (droits que son role n'a pas).
SELECT pg_temp.se_connecter('00000000-0000-4000-9000-000000000010');
SELECT lives_ok(
  $$SELECT public.definir_droit_module('00000000-0000-4000-9000-000000000011', 'hr', 'lecture', 'besoin ponctuel')$$,
  'un administrateur attribue la lecture d''un module');
SELECT lives_ok(
  $$SELECT public.definir_droit_module('00000000-0000-4000-9000-000000000011', 'trips', 'ecriture')$$,
  'un administrateur attribue l''ecriture d''un module');
SELECT throws_ok(
  $$SELECT public.definir_droit_module('00000000-0000-4000-9000-000000000011', 'module_inconnu', 'lecture')$$,
  '22023', NULL, 'un module inconnu est refuse');
SELECT throws_ok(
  $$SELECT public.definir_droit_module('00000000-0000-4000-9000-000000000011', 'hr', 'total')$$,
  '22023', NULL, 'un niveau inconnu est refuse');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-9000-000000000011');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_view('hr'), true, 'le chauffeur lit les RH apres attribution lecture');
SELECT is((SELECT count(*)::int FROM public.employees WHERE id = '00000000-0000-4000-9000-0000000000d1'), 1,
  'la policy de lecture suit l''attribution (employees visibles)');
SELECT is(public.has_module_write('hr'), false, 'l''attribution lecture ne donne pas l''ecriture');
SELECT is(public.has_module_write('trips'), true, 'le chauffeur ecrit les voyages apres attribution ecriture');
RESET ROLE;

-- Retrait : le comptable perd un module de son role.
SELECT pg_temp.se_connecter('00000000-0000-4000-9000-000000000010');
SELECT lives_ok(
  $$SELECT public.definir_droit_module('00000000-0000-4000-9000-000000000012', 'hr', 'aucun', 'rotation du poste')$$,
  'un administrateur retire un module du role');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-9000-000000000012');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_view('hr'), false, 'le comptable ne lit plus les RH apres retrait');
SELECT is((SELECT count(*)::int FROM public.employees), 0,
  'la policy de lecture suit le retrait (employees invisibles)');
SELECT is(public.has_module_write('invoices'), true,
  'le comptable garde les autres modules de son role (factures)');
RESET ROLE;

-- Retour au reglage du role.
SELECT pg_temp.se_connecter('00000000-0000-4000-9000-000000000010');
SELECT lives_ok(
  $$SELECT public.definir_droit_module('00000000-0000-4000-9000-000000000012', 'hr', 'defaut')$$,
  'retour au reglage du role (suppression de l''attribution)');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-9000-000000000012');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_view('hr'), true, 'les droits du role sont retablis');
RESET ROLE;

-- Compte desactive : aucune attribution ne le reveille.
SELECT pg_temp.se_connecter('00000000-0000-4000-9000-000000000010');
SELECT lives_ok(
  $$SELECT public.definir_droit_module('00000000-0000-4000-9000-000000000013', 'trips', 'ecriture')$$,
  'attribution sur un compte desactive (testee ensuite)');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-9000-000000000013');
SET LOCAL ROLE authenticated;
SELECT is(public.has_module_write('trips'), false,
  'un compte desactive n''ecrit pas, meme avec une attribution');
RESET ROLE;

-- Journal : chaque changement est trace avec l'etat avant et apres.
SELECT pg_temp.se_connecter('00000000-0000-4000-9000-000000000010');
SELECT is((SELECT count(*)::int FROM public.journal_droits_modules
  WHERE utilisateur = '00000000-0000-4000-9000-000000000011'
    AND module = 'hr' AND niveau_avant IS NULL AND niveau_apres = 'lecture'), 1,
  'journal : attribution tracee (avant null, apres lecture)');
SELECT is((SELECT count(*)::int FROM public.journal_droits_modules
  WHERE utilisateur = '00000000-0000-4000-9000-000000000012'
    AND module = 'hr' AND niveau_avant = 'aucun' AND niveau_apres IS NULL), 1,
  'journal : retour au role trace (avant aucun, apres null)');
SELECT is((SELECT count(*)::int FROM public.journal_droits_modules), 5,
  'journal : une ligne par changement, ni plus ni moins');
RESET ROLE;

-- Un non-administrateur ne peut pas definir les droits, ne lit pas le
-- journal, mais lit ses propres attributions (menu).
SELECT pg_temp.se_connecter('00000000-0000-4000-9000-000000000011');
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$SELECT public.definir_droit_module('00000000-0000-4000-9000-000000000011', 'fuel', 'ecriture')$$,
  '42501', NULL, 'un non-administrateur ne definit pas les droits');
SELECT is((SELECT count(*)::int FROM public.journal_droits_modules), 0,
  'un non-administrateur ne lit pas le journal');
SELECT is((SELECT count(*)::int FROM public.droits_utilisateur
  WHERE utilisateur = '00000000-0000-4000-9000-000000000011'), 2,
  'un utilisateur lit ses propres attributions');
SELECT is((SELECT count(*)::int FROM public.v_droits_modules
  WHERE utilisateur = '00000000-0000-4000-9000-000000000011'
    AND module = 'trips' AND niveau_effectif = 'ecriture'), 1,
  'vue : niveau effectif ecriture pour le chauffeur sur trips');
RESET ROLE;

SELECT finish();
ROLLBACK;
