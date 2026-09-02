/*
  # Ajout des colonnes manquantes à la table profiles
  
  1. Modifications
    - Ajoute la colonne email
    - Ajoute la colonne department  
    - Ajoute la colonne status
    - Ajoute la colonne photo_url
    - Ajoute la colonne last_login
*/

-- Ajouter les colonnes manquantes à la table profiles
DO $$ 
BEGIN
  -- Ajouter email si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email text;
    CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_key ON profiles(email);
  END IF;

  -- Ajouter department si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'department'
  ) THEN
    ALTER TABLE profiles ADD COLUMN department text;
  END IF;

  -- Ajouter status si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN status text DEFAULT 'active';
    ALTER TABLE profiles ADD CONSTRAINT profiles_status_check CHECK (status IN ('active', 'inactive', 'suspended'));
  END IF;

  -- Ajouter photo_url si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE profiles ADD COLUMN photo_url text;
  END IF;

  -- Ajouter last_login si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'last_login'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_login timestamptz;
  END IF;
END $$;

-- Mettre à jour les profils existants avec les emails des utilisateurs auth
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- Mettre à jour les départements par défaut
UPDATE profiles 
SET department = 'Opérations' 
WHERE department IS NULL;

-- Mettre à jour le statut par défaut
UPDATE profiles 
SET status = 'active' 
WHERE status IS NULL;
