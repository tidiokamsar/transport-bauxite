-- Tests (D-104, T2) : catalogue versionne des fiches. Source documentaire
-- unique lisible par le web et le mobile : 21 familles, statut reel
-- (deployee/cible), lecture pour tout compte connecte, ecriture
-- administrative seule, version active par code. Tout est annule.
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

SELECT plan(8);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8f76-000000000001', 'admin.t2@exemple.invalid'),
  ('00000000-0000-4000-8f76-000000000002', 'chauffeur.t2@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status) VALUES
  ('00000000-0000-4000-8f76-000000000001', 'admin', 'Admin T2', 'active'),
  ('00000000-0000-4000-8f76-000000000002', 'driver', 'Chauffeur T2', 'active')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

-- Structure et contenu initial.
SELECT has_table('public', 'fiches_catalogue', 'table du catalogue');
SELECT is((SELECT count(*)::int FROM public.fiches_catalogue), 21, '21 familles initialisees');
SELECT is((SELECT count(*)::int FROM public.fiches_catalogue WHERE statut = 'deployee'), 10,
  'dix familles deployees (FR, FP, FC + vague 1)');
SELECT is((SELECT count(*)::int FROM public.v_fiches_catalogue_actives WHERE statut = 'deployee'), 10,
  'dix versions actives deployees');
SELECT ok((SELECT count(*) = 21 FROM public.v_fiches_catalogue_actives), 'une version active par code');
SELECT is((SELECT modules_consommateurs FROM public.fiches_catalogue WHERE code = 'FR' AND version = 1),
  ARRAY['trips','dispatch','planning','invoices','contracts'], 'rattachements de la fiche FR conserves');

-- Droits : lecture pour tout connecte, ecriture administrative seule.
SELECT pg_temp.se_connecter('00000000-0000-4000-8f76-000000000002');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.v_fiches_catalogue_actives), 21,
  'un chauffeur lit le catalogue (menus et formulaires)');
SELECT throws_ok($$INSERT INTO public.fiches_catalogue (code, nom, objectif, module_proprietaire)
  VALUES ('FX', 'Fiche interdite', 'test', 'trips')$$,
  '42501', NULL, 'creation reservee a l administrateur');
RESET ROLE;

SELECT finish();
ROLLBACK;
