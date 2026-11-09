/*
  # Correction de la fonction is_admin
  
  1. Modifications
    - Supprime la vérification de la colonne status qui n'existe pas
    - Vérifie uniquement le rôle admin
*/

-- Correction de la fonction is_admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
