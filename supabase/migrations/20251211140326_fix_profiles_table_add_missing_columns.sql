/*
  # Ajouter les colonnes manquantes à la table profiles

  1. Modifications
    - Ajouter email (text, unique, nullable pour compatibilité)
    - Ajouter department (text, nullable)
    - Ajouter photo_url (text, nullable)
    - Ajouter status (text, default 'active')
    - Ajouter last_login (timestamptz, nullable)
  
  2. Synchronisation
    - Synchroniser les emails depuis auth.users
    - Mettre à jour les profils existants avec les valeurs par défaut
  
  3. Sécurité
    - Maintenir les politiques RLS existantes
*/

-- Ajouter email si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email text;
    CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_key ON profiles(email);
  END IF;
END $$;

-- Ajouter department si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'department'
  ) THEN
    ALTER TABLE profiles ADD COLUMN department text;
  END IF;
END $$;

-- Ajouter photo_url si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE profiles ADD COLUMN photo_url text;
  END IF;
END $$;

-- Ajouter status si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN status text DEFAULT 'active';
  END IF;
END $$;

-- Ajouter last_login si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'last_login'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_login timestamptz;
  END IF;
END $$;

-- Synchroniser les emails depuis auth.users pour tous les profils
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- Mettre à jour les valeurs par défaut pour les profils existants
UPDATE profiles
SET 
  department = COALESCE(department, 'Opérations'),
  status = COALESCE(status, 'active')
WHERE department IS NULL OR status IS NULL;
