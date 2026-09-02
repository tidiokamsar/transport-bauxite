/*
  # Création du Compte Administrateur Principal

  1. Compte Administrateur
    - Email: admin@dariholding.gn
    - Mot de passe: S@liou170213
    - Nom: Abdoulaye Diallo
    - Rôle: Administrateur Système

  2. Sécurité
    - Email confirmé par défaut
    - Utilisateur actif
*/

-- Créer l'utilisateur admin s'il n'existe pas déjà
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Vérifier si l'utilisateur existe déjà
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'admin@dariholding.gn';

  -- Si l'utilisateur n'existe pas, le créer
  IF admin_user_id IS NULL THEN
    -- Insérer dans auth.users
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'admin@dariholding.gn',
      crypt('S@liou170213', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Abdoulaye Diallo","role":"admin","title":"Administrateur Système"}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    ) RETURNING id INTO admin_user_id;

    -- Insérer dans auth.identities
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      admin_user_id,
      admin_user_id::text,
      json_build_object(
        'sub', admin_user_id::text,
        'email', 'admin@dariholding.gn',
        'email_verified', true
      ),
      'email',
      now(),
      now(),
      now()
    );

    RAISE NOTICE 'Utilisateur administrateur créé avec succès: admin@dariholding.gn';
  ELSE
    RAISE NOTICE 'Utilisateur administrateur existe déjà: admin@dariholding.gn';
  END IF;
END $$;
