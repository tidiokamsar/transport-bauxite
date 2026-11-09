/*
  # Enrichir le schéma de la table sites
  
  1. Objectif
    - Ajouter les colonnes manquantes pour la gestion complète des sites
    - Correspondance avec les besoins de l'interface React
  
  2. Nouvelles colonnes
    - Informations d'adresse détaillées
    - Coordonnées de contact
    - Capacité et stock
    - Responsable du site
    - Notes
    
  3. Sécurité
    - RLS maintenu
    - Valeurs par défaut appropriées
*/

-- Ajouter les colonnes manquantes
DO $$ 
BEGIN
  -- Adresse
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'address') THEN
    ALTER TABLE sites ADD COLUMN address TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'city') THEN
    ALTER TABLE sites ADD COLUMN city TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'country') THEN
    ALTER TABLE sites ADD COLUMN country TEXT DEFAULT 'Guinée';
  END IF;
  
  -- Contact
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'contact_name') THEN
    ALTER TABLE sites ADD COLUMN contact_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'contact_phone') THEN
    ALTER TABLE sites ADD COLUMN contact_phone TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'contact_email') THEN
    ALTER TABLE sites ADD COLUMN contact_email TEXT;
  END IF;
  
  -- Capacité et stock
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'capacity') THEN
    ALTER TABLE sites ADD COLUMN capacity NUMERIC;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'current_stock') THEN
    ALTER TABLE sites ADD COLUMN current_stock NUMERIC DEFAULT 0;
  END IF;
  
  -- Responsable
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'manager_id') THEN
    ALTER TABLE sites ADD COLUMN manager_id UUID REFERENCES employees(id);
  END IF;
  
  -- Informations supplémentaires
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'notes') THEN
    ALTER TABLE sites ADD COLUMN notes TEXT;
  END IF;
  
  -- Renommer active en is_active pour cohérence
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'active') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'is_active') THEN
      ALTER TABLE sites RENAME COLUMN active TO is_active;
    END IF;
  END IF;
END $$;

-- Mettre à jour les sites existants avec des données cohérentes
UPDATE sites SET
  address = location,
  city = CASE 
    WHEN name LIKE '%Sangarédi%' OR name LIKE '%Sangaredi%' THEN 'Sangarédi'
    WHEN name LIKE '%Kamsar%' THEN 'Kamsar'
    WHEN name LIKE '%Boké%' OR name LIKE '%Boke%' THEN 'Boké'
    WHEN name LIKE '%Conakry%' THEN 'Conakry'
    ELSE 'Conakry'
  END,
  country = 'Guinée'
WHERE address IS NULL;

-- Ajouter des index pour les recherches
CREATE INDEX IF NOT EXISTS idx_sites_city ON sites(city);
CREATE INDEX IF NOT EXISTS idx_sites_type ON sites(type);
CREATE INDEX IF NOT EXISTS idx_sites_active ON sites(is_active);
