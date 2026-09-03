/*
  # Protection contre l'auto-promotion (Tranche 0, action 0.2)

  Constat : la politique « Users can update own profile » permet a tout
  utilisateur authentifie de modifier sa propre ligne dans `profiles`,
  colonne `role` comprise. Un utilisateur peut donc s'auto-promouvoir
  `admin` et obtenir, via `is_admin()`, l'acces complet a la base.

  Correctif : trigger BEFORE UPDATE qui rejette toute modification de
  `role` ou `status` sauf si l'appelant est un admin. Les operations du
  service role (dashboard Supabase, Edge Functions) ne portent pas de
  JWT utilisateur (auth.uid() IS NULL) et restent autorisees.
*/

CREATE OR REPLACE FUNCTION profiles_guard_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    IF auth.uid() IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.profiles
         WHERE id = auth.uid() AND role = 'admin'
       ) THEN
      RAISE EXCEPTION
        'Modification de role/status reservee aux administrateurs'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_sensitive_columns ON public.profiles;

CREATE TRIGGER profiles_guard_sensitive_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION profiles_guard_sensitive_columns();

-- Ceinture et bretelles : la politique UPDATE « own profile » ne doit
-- exister que pour les colonnes innocues ; le trigger en garantit
-- l'application quelle que soit la politique en vigueur.
