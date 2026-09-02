/*
  # Correction du schema suppliers pour le frontend

  1. Modifications
    - Ajouter colonnes manquantes: supplier_number, supplier_type, company_name, rating
    - Migrer les donnees existantes
    - Renommer contact_person en contact_name
*/

-- Ajouter les colonnes manquantes
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS supplier_number TEXT,
ADD COLUMN IF NOT EXISTS supplier_type TEXT DEFAULT 'other',
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS contact_name TEXT,
ADD COLUMN IF NOT EXISTS rating NUMERIC(2,1);

-- Migrer les donnees existantes - company_name et contact_name
UPDATE suppliers
SET 
  company_name = COALESCE(name, 'Fournisseur ' || SUBSTRING(id::text, 1, 8)),
  contact_name = COALESCE(contact_person, 'Contact'),
  supplier_type = CASE 
    WHEN name ILIKE '%pneu%' OR name ILIKE '%tire%' THEN 'tires'
    WHEN name ILIKE '%carburant%' OR name ILIKE '%fuel%' OR name ILIKE '%petrol%' THEN 'fuel'
    WHEN name ILIKE '%pieces%' OR name ILIKE '%parts%' OR name ILIKE '%spare%' THEN 'parts'
    WHEN name ILIKE '%service%' THEN 'services'
    ELSE 'other'
  END,
  rating = 3.0 + (RANDOM() * 2)
WHERE company_name IS NULL;

-- Generer supplier_number avec une sous-requete
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM suppliers
  WHERE supplier_number IS NULL
)
UPDATE suppliers s
SET supplier_number = 'SUP-' || LPAD(n.rn::text, 4, '0')
FROM numbered n
WHERE s.id = n.id;

-- S'assurer que tous les suppliers sont actifs par defaut
UPDATE suppliers
SET active = true
WHERE active IS NULL;
