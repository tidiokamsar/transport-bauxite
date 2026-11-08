/*
  # Alignement de role_permissions sur l'enum user_role (D-010, D-012)

  Constat N2 (docs/SIGTB_2.0_SECURITY.md) : `has_module_write` lit
  `role_permissions`, dont les roles (`20251211060846`) sont admin, manager,
  dispatcher, mechanic, logistician, accountant, driver. Les roles de l'enum
  director, operations_manager, fleet_manager et maintenance_chief n'y ont
  aucune ligne : apres deploiement de la Tranche 0, ils perdraient toute
  ecriture metier.

  Correspondance (D-012, a valider par DARI HOLDING avant P3) : chaque role
  cible recoit exactement les droits du role historique de meme fonction,
  module par module ; aucun droit nouveau n'est cree.

    director           <- manager
    operations_manager <- dispatcher
    fleet_manager      <- dispatcher
    maintenance_chief  <- mechanic

  Les lignes des roles historiques restent en place (retrait au LOT 02).

  Idempotent : une ligne (role, module) deja presente n'est ni dupliquee ni
  modifiee. Le type de `role_permissions.role` (text dans l'historique, non
  verifie en production) est lu dans le catalogue pour le cast.
  Avertissement (WARNING) si un role de l'enum reste sans aucune ligne.
*/

DO $$
DECLARE
  v_type text;
  v_inserees integer;
  v_sans_ligne text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO v_type
    FROM pg_attribute a
   WHERE a.attrelid = 'public.role_permissions'::regclass
     AND a.attname = 'role'
     AND NOT a.attisdropped;

  EXECUTE format($sql$
    INSERT INTO public.role_permissions
      (role, module, can_view, can_create, can_edit, can_delete, can_approve)
    SELECT m.cible::%s, rp.module, rp.can_view, rp.can_create, rp.can_edit,
           rp.can_delete, rp.can_approve
      FROM (VALUES
              ('director', 'manager'),
              ('operations_manager', 'dispatcher'),
              ('fleet_manager', 'dispatcher'),
              ('maintenance_chief', 'mechanic')
           ) AS m(cible, source)
      JOIN public.role_permissions rp ON rp.role::text = m.source
     WHERE NOT EXISTS (
             SELECT 1 FROM public.role_permissions existant
              WHERE existant.role::text = m.cible
                AND existant.module = rp.module)
  $sql$, v_type);

  GET DIAGNOSTICS v_inserees = ROW_COUNT;
  RAISE NOTICE 'role_permissions : % ligne(s) ajoutee(s) (D-012)', v_inserees;

  SELECT string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder)
    INTO v_sans_ligne
    FROM pg_enum e
   WHERE e.enumtypid = 'public.user_role'::regtype
     AND NOT EXISTS (
           SELECT 1 FROM public.role_permissions rp
            WHERE rp.role::text = e.enumlabel::text);

  IF v_sans_ligne IS NOT NULL THEN
    RAISE WARNING 'Roles sans aucune ligne dans role_permissions : %', v_sans_ligne;
  END IF;
END
$$;
