/*
  # Durcissement de is_admin() et de la garde du role (constat N4)

  Constat (docs/SIGTB_2.0_SECURITY.md, N4) :
  - `is_admin()` (derniere definition : 20251211142206_enable_full_admin_access)
    est SECURITY DEFINER sans `search_path` fixe et reference `profiles`
    sans schema : un objet `profiles` place plus tot dans le search_path de
    l'appelant pourrait detourner la verification.
  - Le trigger `profiles_guard_sensitive_columns` (20260903090000) reconnait
    un admin par son seul role, sans controler `status` : un admin
    desactive ou suspendu pouvait encore modifier les roles.

  Correctif :
  1. `is_admin()` : `SET search_path = ''`, references qualifiees ; la
     regle reste role = 'admin' ET status = 'active'.
  2. La garde du role s'appuie sur `public.is_admin()`.

  Idempotent (CREATE OR REPLACE). Aucune donnee modifiee.
*/

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.profiles_guard_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
      RAISE EXCEPTION
        'Modification de role/status reservee aux administrateurs actifs'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
