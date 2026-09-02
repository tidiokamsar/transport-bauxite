/*
  # Mise à jour des informations de l'administrateur
  
  1. Changement du nom: Abdoulaye BAH
  2. Changement du mot de passe: Seilou170213
*/

DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Récupérer l'ID de l'utilisateur admin
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'admin@dariholding.gn';
  
  IF admin_user_id IS NOT NULL THEN
    -- Mettre à jour le mot de passe dans auth.users
    UPDATE auth.users
    SET 
      encrypted_password = crypt('Seilou170213', gen_salt('bf')),
      raw_user_meta_data = jsonb_build_object(
        'full_name', 'Abdoulaye BAH',
        'role', 'admin'
      ),
      updated_at = now()
    WHERE id = admin_user_id;
    
    -- Mettre à jour le profil
    UPDATE profiles
    SET 
      full_name = 'Abdoulaye BAH',
      updated_at = now()
    WHERE id = admin_user_id;
    
    RAISE NOTICE 'Informations admin mises à jour: Abdoulaye BAH / Seilou170213';
  ELSE
    RAISE EXCEPTION 'Utilisateur admin non trouvé';
  END IF;
END $$;
