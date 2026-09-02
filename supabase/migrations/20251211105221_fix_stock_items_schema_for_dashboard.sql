/*
  # Correction du schema stock_items pour le dashboard

  1. Ajouts
    - Colonne minimum_quantity comme alias de min_quantity
*/

-- Ajouter minimum_quantity si elle n'existe pas
ALTER TABLE stock_items
ADD COLUMN IF NOT EXISTS minimum_quantity NUMERIC;

-- Migrer les donnees
UPDATE stock_items
SET minimum_quantity = COALESCE(minimum_quantity, min_quantity)
WHERE minimum_quantity IS NULL;

-- Creer un trigger pour maintenir minimum_quantity a jour
CREATE OR REPLACE FUNCTION sync_stock_items_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.minimum_quantity IS NULL AND NEW.min_quantity IS NOT NULL THEN
    NEW.minimum_quantity := NEW.min_quantity;
  END IF;
  
  IF NEW.min_quantity IS NULL AND NEW.minimum_quantity IS NOT NULL THEN
    NEW.min_quantity := NEW.minimum_quantity;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_stock_items_columns_trigger ON stock_items;
CREATE TRIGGER sync_stock_items_columns_trigger
BEFORE INSERT OR UPDATE ON stock_items
FOR EACH ROW
EXECUTE FUNCTION sync_stock_items_columns();
