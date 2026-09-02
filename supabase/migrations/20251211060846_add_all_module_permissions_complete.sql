/*
  # Ajout de toutes les permissions pour tous les modules

  1. Modifications
    - Supprime les anciennes permissions limitées
    - Ajoute toutes les permissions pour TOUS les modules du système
    - Configure les accès complets pour admin et manager
    - Configure les accès appropriés pour les autres rôles
  
  2. Modules couverts
    - dashboard, vehicles, drivers, trips, gps_tracking
    - fuel, maintenance, stock, purchases, invoices, costs
    - hr, reports, settings
    - NOUVEAUX: iot, esg, ai_analytics, geofencing, client_portal
*/

-- Suppression des anciennes permissions pour reconfigurer
DELETE FROM role_permissions;

-- ADMIN - Accès complet à tout
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
('admin', 'settings', true, true, true, true, true),
('admin', 'iot', true, true, true, true, true),
('admin', 'esg', true, true, true, true, true),
('admin', 'ai_analytics', true, true, true, true, true),
('admin', 'geofencing', true, true, true, true, true),
('admin', 'client_portal', true, true, true, true, true);

-- MANAGER - Accès complet sauf settings limité
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_approve) VALUES
('manager', 'dashboard', true, true, true, true, true),
('manager', 'vehicles', true, true, true, true, true),
('manager', 'drivers', true, true, true, true, true),
('manager', 'trips', true, true, true, true, true),
('manager', 'gps_tracking', true, true, true, true, true),
('manager', 'fuel', true, true, true, true, true),
('manager', 'maintenance', true, true, true, true, true),
('manager', 'stock', true, true, true, true, true),
('manager', 'purchases', true, true, true, true, true),
('manager', 'invoices', true, true, true, true, true),
('manager', 'costs', true, true, true, true, true),
('manager', 'hr', true, true, true, true, true),
('manager', 'reports', true, true, true, true, true),
('manager', 'settings', true, false, true, false, false),
('manager', 'iot', true, true, true, true, true),
('manager', 'esg', true, true, true, true, true),
('manager', 'ai_analytics', true, true, true, true, true),
('manager', 'geofencing', true, true, true, true, true),
('manager', 'client_portal', true, true, true, true, true);

-- DISPATCHER - Opérations et suivi
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_approve) VALUES
('dispatcher', 'dashboard', true, false, false, false, false),
('dispatcher', 'vehicles', true, false, true, false, false),
('dispatcher', 'drivers', true, false, true, false, false),
('dispatcher', 'trips', true, true, true, true, false),
('dispatcher', 'gps_tracking', true, false, false, false, false),
('dispatcher', 'fuel', true, true, false, false, false),
('dispatcher', 'maintenance', true, true, false, false, false),
('dispatcher', 'stock', true, false, false, false, false),
('dispatcher', 'purchases', false, false, false, false, false),
('dispatcher', 'invoices', false, false, false, false, false),
('dispatcher', 'costs', false, false, false, false, false),
('dispatcher', 'hr', false, false, false, false, false),
('dispatcher', 'reports', true, false, false, false, false),
('dispatcher', 'settings', false, false, false, false, false),
('dispatcher', 'iot', true, false, false, false, false),
('dispatcher', 'esg', true, false, false, false, false),
('dispatcher', 'ai_analytics', true, false, false, false, false),
('dispatcher', 'geofencing', true, false, false, false, false),
('dispatcher', 'client_portal', false, false, false, false, false);

-- LOGISTICIAN - Planification et suivi logistique
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_approve) VALUES
('logistician', 'dashboard', true, false, false, false, false),
('logistician', 'vehicles', true, false, true, false, false),
('logistician', 'drivers', true, false, false, false, false),
('logistician', 'trips', true, true, true, false, false),
('logistician', 'gps_tracking', true, false, false, false, false),
('logistician', 'fuel', true, true, true, false, false),
('logistician', 'maintenance', true, true, false, false, false),
('logistician', 'stock', true, true, true, false, false),
('logistician', 'purchases', true, true, true, false, false),
('logistician', 'invoices', true, false, false, false, false),
('logistician', 'costs', true, false, false, false, false),
('logistician', 'hr', false, false, false, false, false),
('logistician', 'reports', true, false, false, false, false),
('logistician', 'settings', false, false, false, false, false),
('logistician', 'iot', true, false, false, false, false),
('logistician', 'esg', true, false, false, false, false),
('logistician', 'ai_analytics', true, false, false, false, false),
('logistician', 'geofencing', true, false, false, false, false),
('logistician', 'client_portal', false, false, false, false, false);

-- ACCOUNTANT - Finance et rapports
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_approve) VALUES
('accountant', 'dashboard', true, false, false, false, false),
('accountant', 'vehicles', true, false, false, false, false),
('accountant', 'drivers', true, false, false, false, false),
('accountant', 'trips', true, false, false, false, false),
('accountant', 'gps_tracking', false, false, false, false, false),
('accountant', 'fuel', true, false, false, false, false),
('accountant', 'maintenance', true, false, false, false, false),
('accountant', 'stock', true, false, false, false, false),
('accountant', 'purchases', true, false, true, false, true),
('accountant', 'invoices', true, true, true, true, true),
('accountant', 'costs', true, true, true, true, true),
('accountant', 'hr', true, true, true, true, true),
('accountant', 'reports', true, true, false, false, false),
('accountant', 'settings', false, false, false, false, false),
('accountant', 'iot', false, false, false, false, false),
('accountant', 'esg', true, false, false, false, false),
('accountant', 'ai_analytics', true, false, false, false, false),
('accountant', 'geofencing', false, false, false, false, false),
('accountant', 'client_portal', true, false, false, false, false);

-- MECHANIC - Maintenance et réparations
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_approve) VALUES
('mechanic', 'dashboard', true, false, false, false, false),
('mechanic', 'vehicles', true, false, true, false, false),
('mechanic', 'drivers', false, false, false, false, false),
('mechanic', 'trips', false, false, false, false, false),
('mechanic', 'gps_tracking', false, false, false, false, false),
('mechanic', 'fuel', false, false, false, false, false),
('mechanic', 'maintenance', true, true, true, false, false),
('mechanic', 'stock', true, false, false, false, false),
('mechanic', 'purchases', false, false, false, false, false),
('mechanic', 'invoices', false, false, false, false, false),
('mechanic', 'costs', false, false, false, false, false),
('mechanic', 'hr', false, false, false, false, false),
('mechanic', 'reports', false, false, false, false, false),
('mechanic', 'settings', false, false, false, false, false),
('mechanic', 'iot', true, false, false, false, false),
('mechanic', 'esg', false, false, false, false, false),
('mechanic', 'ai_analytics', true, false, false, false, false),
('mechanic', 'geofencing', false, false, false, false, false),
('mechanic', 'client_portal', false, false, false, false, false);

-- DRIVER - Vue limitée
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_approve) VALUES
('driver', 'dashboard', true, false, false, false, false),
('driver', 'vehicles', true, false, false, false, false),
('driver', 'drivers', false, false, false, false, false),
('driver', 'trips', true, false, false, false, false),
('driver', 'gps_tracking', false, false, false, false, false),
('driver', 'fuel', true, false, false, false, false),
('driver', 'maintenance', true, false, false, false, false),
('driver', 'stock', false, false, false, false, false),
('driver', 'purchases', false, false, false, false, false),
('driver', 'invoices', false, false, false, false, false),
('driver', 'costs', false, false, false, false, false),
('driver', 'hr', false, false, false, false, false),
('driver', 'reports', false, false, false, false, false),
('driver', 'settings', false, false, false, false, false),
('driver', 'iot', false, false, false, false, false),
('driver', 'esg', false, false, false, false, false),
('driver', 'ai_analytics', false, false, false, false, false),
('driver', 'geofencing', false, false, false, false, false),
('driver', 'client_portal', false, false, false, false, false);
