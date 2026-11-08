-- Tests RLS (D-010, D-012, constat N2) : chaque role de l'enum user_role a
-- des lignes dans role_permissions, et les roles alignes ecrivent selon
-- leur role historique (migration 20261108100000_aligner_role_permissions).
-- Tout est annule en fin de transaction.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

-- Simule la session d'un utilisateur. auth.uid() lit request.jwt.claims
-- (GoTrue recent) ou request.jwt.claim.sub (image Postgres seule).
CREATE FUNCTION pg_temp.se_connecter(p_id uuid) RETURNS void
LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', coalesce(p_id::text, ''), true),
         set_config('request.jwt.claims',
           CASE WHEN p_id IS NULL THEN '{}'
                ELSE json_build_object('sub', p_id, 'role', 'authenticated')::text END,
           true);
$$;

SELECT plan(11);

-- Matrice : aucun role de l'enum sans ligne, aucun doublon.
SELECT is(
  (SELECT count(*)::int FROM pg_enum e
    WHERE e.enumtypid = 'public.user_role'::regtype
      AND NOT EXISTS (SELECT 1 FROM public.role_permissions rp
                       WHERE rp.role::text = e.enumlabel::text)),
  0,
  'chaque role de user_role a au moins une ligne dans role_permissions');

SELECT is(
  (SELECT count(*)::int FROM (
     SELECT role::text, module FROM public.role_permissions
      GROUP BY 1, 2 HAVING count(*) > 1) d),
  0,
  'aucun doublon (role, module)');

-- Copie exacte : director a les memes droits que manager, module par module.
SELECT is(
  (SELECT count(*)::int FROM public.role_permissions s
     JOIN public.role_permissions c
       ON c.role::text = 'director' AND c.module = s.module
    WHERE s.role::text = 'manager'
      AND (c.can_view, c.can_create, c.can_edit, c.can_delete, c.can_approve)
          IS DISTINCT FROM
          (s.can_view, s.can_create, s.can_edit, s.can_delete, s.can_approve)),
  0,
  'director reprend exactement les droits de manager');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-d000-000000000001', 'directeur.n2@exemple.invalid'),
  ('00000000-0000-4000-d000-000000000002', 'resp.operations.n2@exemple.invalid'),
  ('00000000-0000-4000-d000-000000000003', 'resp.flotte.n2@exemple.invalid'),
  ('00000000-0000-4000-d000-000000000004', 'chef.maintenance.n2@exemple.invalid');

INSERT INTO public.profiles (id, role, full_name, status) VALUES
  ('00000000-0000-4000-d000-000000000001', 'director', 'Directeur N2', 'active'),
  ('00000000-0000-4000-d000-000000000002', 'operations_manager', 'Responsable operations N2', 'active'),
  ('00000000-0000-4000-d000-000000000003', 'fleet_manager', 'Responsable flotte N2', 'active'),
  ('00000000-0000-4000-d000-000000000004', 'maintenance_chief', 'Chef maintenance N2', 'active')
ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role, full_name = EXCLUDED.full_name, status = EXCLUDED.status;

SELECT pg_temp.se_connecter('00000000-0000-4000-d000-000000000001');
SELECT is(public.has_module_write('invoices'), true,
  'director ecrit en factures');

SELECT pg_temp.se_connecter('00000000-0000-4000-d000-000000000002');
SELECT is(public.has_module_write('trips'), true,
  'operations_manager ecrit en voyages');
SELECT is(public.has_module_write('invoices'), false,
  'operations_manager n''ecrit pas en factures');

SELECT pg_temp.se_connecter('00000000-0000-4000-d000-000000000003');
SELECT is(public.has_module_write('vehicles'), true,
  'fleet_manager ecrit en vehicules');
SELECT is(public.has_module_write('hr'), false,
  'fleet_manager n''ecrit pas en RH');

SELECT pg_temp.se_connecter('00000000-0000-4000-d000-000000000004');
SELECT is(public.has_module_write('maintenance'), true,
  'maintenance_chief ecrit en maintenance');
SELECT is(public.has_module_write('trips'), false,
  'maintenance_chief n''ecrit pas en voyages');
SELECT is(public.has_module_write('invoices'), false,
  'maintenance_chief n''ecrit pas en factures');

SELECT * FROM finish();
ROLLBACK;
