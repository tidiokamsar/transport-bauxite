/*
  # Correction des colonnes manquantes

  1. Modifications
    - Ajouter `last_login` à la table profiles
    - Créer la table `role_permissions` pour la gestion des permissions
    - Ajouter les colonnes manquantes dans trips
  
  2. Sécurité
    - Activer RLS sur role_permissions
    - Politiques d'accès appropriées
*/

-- Ajouter last_login à profiles si manquant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_login'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_login TIMESTAMPTZ;
  END IF;
END $$;

-- Créer la table role_permissions si elle n'existe pas
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  permission TEXT NOT NULL,
  resource TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role, permission, resource)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Politique pour lire les permissions (tous les utilisateurs authentifiés)
DROP POLICY IF EXISTS "Users can read their role permissions" ON role_permissions;
CREATE POLICY "Users can read their role permissions"
  ON role_permissions
  FOR SELECT
  TO authenticated
  USING (
    role IN (
      SELECT profiles.role::text
      FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

-- Politique pour gérer les permissions (admin seulement)
DROP POLICY IF EXISTS "Admins can manage permissions" ON role_permissions;
CREATE POLICY "Admins can manage permissions"
  ON role_permissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Insérer les permissions par défaut
INSERT INTO role_permissions (role, permission, resource)
VALUES
  ('admin', 'read', 'all'),
  ('admin', 'write', 'all'),
  ('admin', 'delete', 'all'),
  ('manager', 'read', 'all'),
  ('manager', 'write', 'most'),
  ('driver', 'read', 'own'),
  ('driver', 'write', 'own'),
  ('mechanic', 'read', 'maintenance'),
  ('mechanic', 'write', 'maintenance')
ON CONFLICT (role, permission, resource) DO NOTHING;

-- Vérifier les colonnes de trips et ajouter celles qui manquent
DO $$
BEGIN
  -- Ajouter cargo_weight si manquant (alias de load_weight)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trips' AND column_name = 'cargo_weight'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'trips' AND column_name = 'load_weight'
    ) THEN
      -- Créer une vue calculée
      ALTER TABLE trips ADD COLUMN cargo_weight NUMERIC GENERATED ALWAYS AS (load_weight) STORED;
    END IF;
  END IF;
END $$;
