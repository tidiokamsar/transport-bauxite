/*
  # Correction de la structure de la table role_permissions
  
  1. Modifications
    - Supprimer l'ancienne table role_permissions
    - Créer une nouvelle table avec la structure correcte (module, can_view, can_create, can_edit, can_delete, can_approve)
    - Insérer les permissions par défaut pour tous les rôles
    
  2. Permissions par défaut
    - admin: Accès complet à tous les modules
    - manager: Accès à la plupart des modules avec restrictions
    - dispatcher: Accès limité aux modules opérationnels
    - driver: Accès très limité
    - accountant: Accès aux modules financiers
    - mechanic: Accès aux modules maintenance
*/

-- Supprimer l'ancienne table si elle existe
DROP TABLE IF EXISTS role_permissions CASCADE;

-- Créer la nouvelle table avec la structure correcte
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  module text NOT NULL,
  can_view boolean DEFAULT false,
  can_create boolean DEFAULT false,
  can_edit boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  can_approve boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role, module)
);

-- Permissions pour ADMIN (accès complet à tout)
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_approve) VALUES
  ('admin', 'dashboard', true, true, true, true, true),
  ('admin', 'vehicles', true, true, true, true, true),
  ('admin', 'drivers', true, true, true, true, true),
  ('admin', 'trips', true, true, true, true, true),
  ('admin', 'gps_tracking', true, true, true, true, true),
  ('admin', 'fuel', true, true, true, true, true),
  ('admin', 'maintenance', true, true, true, true, true),
  ('admin', 'stock', true, true, true, true, true),
  ('admin', 'purchases', true, true, true, true, true),
  ('admin', 'invoices', true, true, true, true, true),
  ('admin', 'costs', true, true, true, true, true),
  ('admin', 'hr', true, true, true, true, true),
  ('admin', 'reports', true, true, true, true, true),
  ('admin', 'settings', true, true, true, true, true);

-- Permissions pour MANAGER (accès large mais sans suppression)
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_approve) VALUES
  ('manager', 'dashboard', true, true, true, false, true),
  ('manager', 'vehicles', true, true, true, false, true),
  ('manager', 'drivers', true, true, true, false, true),
  ('manager', 'trips', true, true, true, false, true),
  ('manager', 'gps_tracking', true, false, false, false, false),
  ('manager', 'fuel', true, true, true, false, true),
  ('manager', 'maintenance', true, true, true, false, true),
  ('manager', 'stock', true, true, true, false, false),
  ('manager', 'purchases', true, true, true, false, true),
  ('manager', 'invoices', true, true, true, false, true),
  ('manager', 'costs', true, true, true, false, false),
  ('manager', 'hr', true, true, true, false, true),
  ('manager', 'reports', true, false, false, false, false),
  ('manager', 'settings', true, true, true, false, false);

-- Permissions pour DISPATCHER (accès opérationnel)
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_approve) VALUES
  ('dispatcher', 'dashboard', true, false, false, false, false),
  ('dispatcher', 'vehicles', true, false, true, false, false),
  ('dispatcher', 'drivers', true, false, true, false, false),
  ('dispatcher', 'trips', true, true, true, false, false),
  ('dispatcher', 'gps_tracking', true, false, false, false, false),
  ('dispatcher', 'fuel', true, true, false, false, false),
  ('dispatcher', 'maintenance', true, true, false, false, false),
  ('dispatcher', 'stock', true, false, false, false, false),
  ('dispatcher', 'purchases', false, false, false, false, false),
  ('dispatcher', 'invoices', false, false, false, false, false),
  ('dispatcher', 'costs', false, false, false, false, false),
  ('dispatcher', 'hr', false, false, false, false, false),
  ('dispatcher', 'reports', true, false, false, false, false),
  ('dispatcher', 'settings', false, false, false, false, false);

-- Permissions pour DRIVER (accès très limité)
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_approve) VALUES
  ('driver', 'dashboard', true, false, false, false, false),
  ('driver', 'vehicles', true, false, false, false, false),
  ('driver', 'drivers', false, false, false, false, false),
  ('driver', 'trips', true, false, false, false, false),
  ('driver', 'gps_tracking', false, false, false, false, false),
  ('driver', 'fuel', true, true, false, false, false),
  ('driver', 'maintenance', true, true, false, false, false),
  ('driver', 'stock', false, false, false, false, false),
  ('driver', 'purchases', false, false, false, false, false),
  ('driver', 'invoices', false, false, false, false, false),
  ('driver', 'costs', false, false, false, false, false),
  ('driver', 'hr', false, false, false, false, false),
  ('driver', 'reports', false, false, false, false, false),
  ('driver', 'settings', false, false, false, false, false);

-- Permissions pour ACCOUNTANT (accès financier)
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_approve) VALUES
  ('accountant', 'dashboard', true, false, false, false, false),
  ('accountant', 'vehicles', true, false, false, false, false),
  ('accountant', 'drivers', true, false, false, false, false),
  ('accountant', 'trips', true, false, false, false, false),
  ('accountant', 'gps_tracking', false, false, false, false, false),
  ('accountant', 'fuel', true, false, true, false, false),
  ('accountant', 'maintenance', true, false, true, false, false),
  ('accountant', 'stock', true, false, false, false, false),
  ('accountant', 'purchases', true, true, true, false, true),
  ('accountant', 'invoices', true, true, true, false, true),
  ('accountant', 'costs', true, true, true, false, false),
  ('accountant', 'hr', true, false, false, false, false),
  ('accountant', 'reports', true, false, false, false, false),
  ('accountant', 'settings', false, false, false, false, false);

-- Permissions pour MECHANIC (accès maintenance)
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_approve) VALUES
  ('mechanic', 'dashboard', true, false, false, false, false),
  ('mechanic', 'vehicles', true, false, true, false, false),
  ('mechanic', 'drivers', false, false, false, false, false),
  ('mechanic', 'trips', false, false, false, false, false),
  ('mechanic', 'gps_tracking', false, false, false, false, false),
  ('mechanic', 'fuel', false, false, false, false, false),
  ('mechanic', 'maintenance', true, true, true, false, false),
  ('mechanic', 'stock', true, true, false, false, false),
  ('mechanic', 'purchases', false, false, false, false, false),
  ('mechanic', 'invoices', false, false, false, false, false),
  ('mechanic', 'costs', false, false, false, false, false),
  ('mechanic', 'hr', false, false, false, false, false),
  ('mechanic', 'reports', false, false, false, false, false),
  ('mechanic', 'settings', false, false, false, false, false);

-- Activer RLS
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre à tous les utilisateurs authentifiés de lire leurs permissions
CREATE POLICY "Users can view role permissions"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (true);

-- Politique pour permettre aux admins de gérer les permissions
CREATE POLICY "Admins can manage role permissions"
  ON role_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
