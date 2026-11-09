/*
  # Add Comprehensive System Settings
  
  1. Purpose
    - Add all configurable settings for system administration
    - Cover all modules: vehicles, maintenance, fuel, GPS, invoicing, etc.
    
  2. Settings Categories
    - General: Company info, system config
    - Vehicles: Maintenance intervals, speed limits
    - Maintenance: Intervals, costs, budgets
    - Fuel: Prices, alerts, thresholds
    - Tires: Replacement, costs
    - GPS: Tracking, geofencing
    - Invoicing: Numbering, payment terms
    - Alerts: Notifications configuration
    - Security: Sessions, passwords
    - Integrations: API, webhooks
*/

-- Insert comprehensive settings if they don't exist
INSERT INTO settings (key, value, category, description, created_at, updated_at)
VALUES
  -- General settings
  ('company_name', '{"value": "DARI HOLDING"}', 'general', 'Nom de l''entreprise', NOW(), NOW()),
  ('company_address', '{"value": "Conakry, Guinée"}', 'general', 'Adresse de l''entreprise', NOW(), NOW()),
  ('company_phone', '{"value": "+224 XX XX XX XX"}', 'general', 'Téléphone', NOW(), NOW()),
  ('company_email', '{"value": "contact@dariholding.gn"}', 'general', 'Email', NOW(), NOW()),
  ('system_currency', '{"value": "GNF"}', 'general', 'Devise du système', NOW(), NOW()),
  ('system_language', '{"value": "fr"}', 'general', 'Langue du système', NOW(), NOW()),
  ('system_timezone', '{"value": "Africa/Conakry"}', 'general', 'Fuseau horaire', NOW(), NOW()),
  ('date_format', '{"value": "DD/MM/YYYY"}', 'general', 'Format de date', NOW(), NOW()),
  
  -- Vehicle settings
  ('vehicle_maintenance_km_alert', '{"value": 5000}', 'vehicles', 'Kilométrage minimum pour alerte (km)', NOW(), NOW()),
  ('vehicle_max_speed', '{"value": 90}', 'vehicles', 'Vitesse maximale autorisée (km/h)', NOW(), NOW()),
  ('vehicle_avg_consumption', '{"value": 35}', 'vehicles', 'Consommation moyenne (L/100km)', NOW(), NOW()),
  ('vehicle_auto_inspection', '{"value": true}', 'vehicles', 'Rappels automatiques d''inspection', NOW(), NOW()),
  ('vehicle_insurance_reminder', '{"value": true}', 'vehicles', 'Alertes renouvellement assurance', NOW(), NOW()),
  ('dumper_capacity', '{"value": 50}', 'vehicles', 'Capacité standard dumper (tonnes)', NOW(), NOW()),
  ('tractor_capacity', '{"value": 40}', 'vehicles', 'Capacité standard tracteur (tonnes)', NOW(), NOW()),
  ('oil_change_interval', '{"value": 10000}', 'vehicles', 'Intervalle vidange standard (km)', NOW(), NOW()),
  
  -- Maintenance settings
  ('maintenance_routine_km', '{"value": 10000}', 'maintenance', 'Intervalle maintenance routière (km)', NOW(), NOW()),
  ('maintenance_major_km', '{"value": 50000}', 'maintenance', 'Intervalle maintenance majeure (km)', NOW(), NOW()),
  ('maintenance_alert_advance', '{"value": 1000}', 'maintenance', 'Avance alerte maintenance (km)', NOW(), NOW()),
  ('maintenance_inspection_alert_days', '{"value": 30}', 'maintenance', 'Jours avant expiration inspection', NOW(), NOW()),
  ('maintenance_auto_schedule', '{"value": true}', 'maintenance', 'Planification automatique', NOW(), NOW()),
  ('maintenance_monthly_budget', '{"value": 50000000}', 'maintenance', 'Budget mensuel (GNF)', NOW(), NOW()),
  ('maintenance_oil_change_cost', '{"value": 500000}', 'maintenance', 'Coût moyen vidange (GNF)', NOW(), NOW()),
  ('maintenance_hourly_rate', '{"value": 25000}', 'maintenance', 'Taux horaire main d''oeuvre (GNF)', NOW(), NOW()),
  ('maintenance_budget_alert', '{"value": true}', 'maintenance', 'Alertes dépassement budget', NOW(), NOW()),
  
  -- Fuel settings
  ('fuel_price_diesel', '{"value": 8500}', 'fuel', 'Prix diesel (GNF/L)', NOW(), NOW()),
  ('fuel_price_gasoline', '{"value": 9000}', 'fuel', 'Prix essence (GNF/L)', NOW(), NOW()),
  ('fuel_tank_capacity', '{"value": 300}', 'fuel', 'Capacité réservoir standard (L)', NOW(), NOW()),
  ('fuel_auto_update_price', '{"value": false}', 'fuel', 'Mise à jour automatique des prix', NOW(), NOW()),
  ('fuel_low_level_alert', '{"value": 20}', 'fuel', 'Seuil alerte faible niveau (%)', NOW(), NOW()),
  ('fuel_critical_level_alert', '{"value": 10}', 'fuel', 'Seuil alerte niveau critique (%)', NOW(), NOW()),
  ('fuel_anomaly_threshold', '{"value": 15}', 'fuel', 'Variation anormale détection (%)', NOW(), NOW()),
  ('fuel_theft_detection', '{"value": true}', 'fuel', 'Détection vol de carburant', NOW(), NOW()),
  
  -- Tire settings
  ('tire_replacement_km', '{"value": 80000}', 'tires', 'Kilométrage avant remplacement (km)', NOW(), NOW()),
  ('tire_min_tread_depth', '{"value": 3.0}', 'tires', 'Profondeur minimale (mm)', NOW(), NOW()),
  ('tire_pressure_psi', '{"value": 110}', 'tires', 'Pression recommandée (PSI)', NOW(), NOW()),
  ('tire_max_retreads', '{"value": 3}', 'tires', 'Nombre maximum de rechapage', NOW(), NOW()),
  ('tire_rotation_reminder', '{"value": true}', 'tires', 'Rappels rotation des pneus', NOW(), NOW()),
  ('tire_new_price', '{"value": 1500000}', 'tires', 'Prix moyen pneu neuf (GNF)', NOW(), NOW()),
  ('tire_retread_cost', '{"value": 600000}', 'tires', 'Coût rechapage (GNF)', NOW(), NOW()),
  ('tire_monthly_budget', '{"value": 20000000}', 'tires', 'Budget mensuel pneus (GNF)', NOW(), NOW()),
  
  -- GPS settings
  ('gps_update_interval', '{"value": 30}', 'gps', 'Intervalle de mise à jour (secondes)', NOW(), NOW()),
  ('gps_history_retention', '{"value": 90}', 'gps', 'Durée historique conservé (jours)', NOW(), NOW()),
  ('gps_geofence_radius', '{"value": 500}', 'gps', 'Rayon géofencing par défaut (m)', NOW(), NOW()),
  ('gps_realtime_tracking', '{"value": true}', 'gps', 'Suivi en temps réel', NOW(), NOW()),
  ('gps_route_recording', '{"value": true}', 'gps', 'Enregistrement trajets', NOW(), NOW()),
  ('gps_offline_timeout', '{"value": 30}', 'gps', 'Temps max hors connexion (min)', NOW(), NOW()),
  ('gps_speed_alert', '{"value": true}', 'gps', 'Alertes excès de vitesse', NOW(), NOW()),
  ('gps_geofence_alert', '{"value": true}', 'gps', 'Alertes sortie de zone', NOW(), NOW()),
  ('gps_idle_alert', '{"value": true}', 'gps', 'Alertes temps d''arrêt prolongé', NOW(), NOW()),
  
  -- Invoicing settings
  ('invoice_prefix', '{"value": "INV"}', 'invoicing', 'Préfixe numéro facture', NOW(), NOW()),
  ('invoice_payment_terms', '{"value": 30}', 'invoicing', 'Délai de paiement (jours)', NOW(), NOW()),
  ('invoice_vat_rate', '{"value": 18}', 'invoicing', 'Taux TVA (%)', NOW(), NOW()),
  ('invoice_late_fee', '{"value": 2}', 'invoicing', 'Pénalités de retard (% par mois)', NOW(), NOW()),
  ('invoice_auto_numbering', '{"value": true}', 'invoicing', 'Numérotation automatique', NOW(), NOW()),
  ('invoice_reminder_1', '{"value": 7}', 'invoicing', 'Premier rappel avant échéance (jours)', NOW(), NOW()),
  ('invoice_reminder_2', '{"value": 7}', 'invoicing', 'Deuxième rappel après échéance (jours)', NOW(), NOW()),
  ('invoice_auto_reminder', '{"value": true}', 'invoicing', 'Envoi automatique des rappels', NOW(), NOW()),
  
  -- Alert settings
  ('alert_maintenance', '{"value": true}', 'alerts', 'Alertes maintenance', NOW(), NOW()),
  ('alert_fuel_low', '{"value": true}', 'alerts', 'Alertes niveau carburant bas', NOW(), NOW()),
  ('alert_inspection', '{"value": true}', 'alerts', 'Alertes inspection technique', NOW(), NOW()),
  ('alert_insurance', '{"value": true}', 'alerts', 'Alertes renouvellement assurance', NOW(), NOW()),
  ('alert_speed', '{"value": true}', 'alerts', 'Alertes excès de vitesse', NOW(), NOW()),
  ('alert_geofence', '{"value": true}', 'alerts', 'Alertes sortie de zone', NOW(), NOW()),
  ('alert_tire', '{"value": true}', 'alerts', 'Alertes usure pneus', NOW(), NOW()),
  ('alert_overdue_invoice', '{"value": true}', 'alerts', 'Alertes factures impayées', NOW(), NOW()),
  ('notification_email', '{"value": true}', 'alerts', 'Notifications par email', NOW(), NOW()),
  ('notification_sms', '{"value": false}', 'alerts', 'Notifications par SMS', NOW(), NOW()),
  ('notification_push', '{"value": true}', 'alerts', 'Notifications push', NOW(), NOW()),
  ('notification_dashboard', '{"value": true}', 'alerts', 'Notifications dans l''application', NOW(), NOW()),
  
  -- Security settings
  ('session_timeout', '{"value": 60}', 'security', 'Durée de session (minutes)', NOW(), NOW()),
  ('password_min_length', '{"value": 8}', 'security', 'Longueur minimale mot de passe', NOW(), NOW()),
  ('require_strong_password', '{"value": true}', 'security', 'Exiger mots de passe complexes', NOW(), NOW()),
  ('enable_2fa', '{"value": false}', 'security', 'Authentification à deux facteurs', NOW(), NOW()),
  ('log_user_activity', '{"value": true}', 'security', 'Journaliser activité utilisateurs', NOW(), NOW()),
  ('backup_frequency', '{"value": "daily"}', 'security', 'Fréquence sauvegardes', NOW(), NOW()),
  ('backup_retention', '{"value": 30}', 'security', 'Durée conservation sauvegardes (jours)', NOW(), NOW()),
  ('backup_enabled', '{"value": true}', 'security', 'Activer sauvegardes automatiques', NOW(), NOW()),
  
  -- Integration settings
  ('api_enabled', '{"value": false}', 'integrations', 'Accès API activé', NOW(), NOW()),
  ('api_key', '{"value": "sk_xxxxxxxxxxxxx"}', 'integrations', 'Clé API', NOW(), NOW()),
  ('webhook_enabled', '{"value": false}', 'integrations', 'Webhooks activés', NOW(), NOW()),
  ('google_maps_enabled', '{"value": false}', 'integrations', 'Google Maps activé', NOW(), NOW()),
  ('accounting_export_enabled', '{"value": false}', 'integrations', 'Export comptabilité activé', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;
