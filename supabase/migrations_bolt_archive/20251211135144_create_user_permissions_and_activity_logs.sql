/*
  # Système de permissions et journaux d'activité utilisateurs

  1. Nouvelles Tables
    - `user_permissions` - Permissions détaillées par utilisateur et module
    - `user_activity_logs` - Journal d'activité des utilisateurs
    
  2. Sécurité
    - Enable RLS on both tables
    - Add policies for authenticated users
    
  3. Fonctions
    - update_user_password - Permet la réinitialisation de mot de passe
    - log_user_activity - Enregistre l'activité utilisateur
*/

-- Table des permissions utilisateurs
CREATE TABLE IF NOT EXISTS user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  module text NOT NULL,
  can_view boolean DEFAULT false,
  can_create boolean DEFAULT false,
  can_edit boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, module)
);

-- Table des journaux d'activité
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  module text,
  details jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;

-- Policies pour user_permissions
DROP POLICY IF EXISTS "Users can view their own permissions" ON user_permissions;
CREATE POLICY "Users can view their own permissions"
  ON user_permissions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all permissions" ON user_permissions;
CREATE POLICY "Admins can manage all permissions"
  ON user_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policies pour user_activity_logs
DROP POLICY IF EXISTS "Users can view their own activity" ON user_activity_logs;
CREATE POLICY "Users can view their own activity"
  ON user_activity_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all activity" ON user_activity_logs;
CREATE POLICY "Admins can view all activity"
  ON user_activity_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "System can insert activity logs" ON user_activity_logs;
CREATE POLICY "System can insert activity logs"
  ON user_activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Fonction pour mettre à jour le mot de passe
CREATE OR REPLACE FUNCTION update_user_password(
  user_id uuid,
  new_password text
) RETURNS void AS $$
BEGIN
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour enregistrer l'activité
CREATE OR REPLACE FUNCTION log_user_activity(
  p_action text,
  p_details jsonb DEFAULT '{}'::jsonb
) RETURNS void AS $$
BEGIN
  INSERT INTO user_activity_logs (
    user_id,
    action,
    details,
    created_at
  ) VALUES (
    auth.uid(),
    p_action,
    p_details,
    now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_module ON user_permissions(module);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON user_activity_logs(created_at DESC);
