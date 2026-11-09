/*
  # Système de paramètres
  
  1. Nouvelle table
    - `settings`
      - `id` (uuid, primary key)
      - `key` (text, unique) - Clé du paramètre
      - `value` (jsonb) - Valeur du paramètre
      - `category` (text) - Catégorie (general, pricing, alerts, notifications, etc.)
      - `description` (text) - Description du paramètre
      - `updated_at` (timestamptz)
      - `updated_by` (uuid) - Référence auth.users
  
  2. Sécurité
    - Enable RLS
    - Policies pour lecture (tous les utilisateurs authentifiés)
    - Policies pour écriture (tous les utilisateurs authentifiés)
*/

CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  category text NOT NULL DEFAULT 'general',
  description text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read settings"
  ON settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update settings"
  ON settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert settings"
  ON settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- Insérer les paramètres par défaut
INSERT INTO settings (key, value, category, description) VALUES
  ('company_name', '{"value": "Transport Guinée"}', 'general', 'Nom de l''entreprise'),
  ('company_address', '{"value": "Conakry, Guinée"}', 'general', 'Adresse de l''entreprise'),
  ('company_phone', '{"value": "+224 XXX XX XX XX"}', 'general', 'Téléphone de l''entreprise'),
  ('company_email', '{"value": "contact@transport.gn"}', 'general', 'Email de l''entreprise'),
  ('currency', '{"value": "GNF", "symbol": "GNF"}', 'general', 'Devise utilisée'),
  
  ('fuel_price_diesel', '{"value": 10500}', 'pricing', 'Prix du diesel par litre'),
  ('fuel_price_gasoline', '{"value": 11000}', 'pricing', 'Prix de l''essence par litre'),
  ('default_km_rate', '{"value": 1500}', 'pricing', 'Tarif par km par défaut'),
  ('default_tonnage_rate', '{"value": 5000}', 'pricing', 'Tarif par tonne par défaut'),
  
  ('maintenance_km_threshold', '{"value": 10000}', 'alerts', 'Seuil km pour maintenance préventive'),
  ('tire_rotation_km', '{"value": 20000}', 'alerts', 'Seuil km pour permutation pneus'),
  ('insurance_renewal_days', '{"value": 30}', 'alerts', 'Alerte renouvellement assurance (jours avant)'),
  ('technical_control_days', '{"value": 30}', 'alerts', 'Alerte contrôle technique (jours avant)'),
  ('low_fuel_stock_threshold', '{"value": 1000}', 'alerts', 'Seuil stock carburant bas (litres)'),
  
  ('enable_email_notifications', '{"value": true}', 'notifications', 'Activer notifications email'),
  ('enable_sms_notifications', '{"value": false}', 'notifications', 'Activer notifications SMS'),
  ('notification_email', '{"value": "admin@transport.gn"}', 'notifications', 'Email pour notifications'),
  
  ('fiscal_year_start', '{"value": "01-01"}', 'accounting', 'Début année fiscale (MM-DD)'),
  ('tax_rate', '{"value": 18}', 'accounting', 'Taux de TVA (%)'),
  ('enable_auto_invoice_numbering', '{"value": true}', 'accounting', 'Numérotation auto des factures')
ON CONFLICT (key) DO NOTHING;
