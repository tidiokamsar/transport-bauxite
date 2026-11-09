/*
  # Création du compte administrateur
  
  Création d'un utilisateur admin avec:
  - Email: admin@dariholding.gn
  - Mot de passe: temporaire, à révoquer immédiatement après le premier
    démarrage via le dashboard Supabase (Authentication > Users).
    Aucun mot de passe réel ne doit figurer dans une migration.
  - Rôle: admin
  - Profil complet
*/

-- Créer l'utilisateur admin dans auth.users
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Insérer l'utilisateur dans auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'admin@dariholding.gn',
    crypt('A-Changer-Des-Le-Premier-Demarrage!', gen_salt('bf')),
    now(),
    NULL,
    '',
    NULL,
    '',
    NULL,
    '',
    '',
    NULL,
    now(),
    '{"provider":"email","providers":["email"],"role":"admin"}',
    '{"full_name":"Administrateur Système","role":"admin"}',
    NULL,
    now(),
    now(),
    NULL,
    NULL,
    '',
    '',
    NULL,
    '',
    0,
    NULL,
    '',
    NULL,
    false,
    NULL
  )
  RETURNING id INTO admin_user_id;

  -- Créer le profil correspondant
  INSERT INTO profiles (id, role, full_name, phone)
  VALUES (
    admin_user_id,
    'admin',
    'Administrateur Système',
    '+224 620000000'
  );

  RAISE NOTICE 'Compte admin créé avec succès: admin@dariholding.gn (mot de passe temporaire, à changer)';
END $$;
