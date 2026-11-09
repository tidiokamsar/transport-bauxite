/*
  # Génération automatique des références pour les transactions de carburant

  Cette migration génère automatiquement des références uniques pour toutes les transactions
  de carburant et met en place un système de génération automatique pour les nouvelles transactions.

  ## Format des références
  - Format : FUEL-YYYYMMDD-NNNN
  - Exemple : FUEL-20251105-0001
  - YYYYMMDD : Date de la transaction
  - NNNN : Numéro séquentiel sur 4 chiffres

  ## Changements
  1. Génération des références pour les transactions existantes sans référence
  2. Création d'une fonction de génération automatique
  3. Trigger pour appliquer la fonction lors de l'insertion
*/

-- Fonction pour générer une référence unique pour une transaction de carburant
CREATE OR REPLACE FUNCTION generate_fuel_transaction_reference()
RETURNS TRIGGER AS $$
DECLARE
  next_sequence INTEGER;
  date_part TEXT;
  new_reference TEXT;
BEGIN
  -- Si une référence est déjà fournie, on la garde
  IF NEW.reference IS NOT NULL AND NEW.reference != '' THEN
    RETURN NEW;
  END IF;

  -- Créer la partie date au format YYYYMMDD
  date_part := TO_CHAR(COALESCE(NEW.transaction_date, CURRENT_DATE), 'YYYYMMDD');

  -- Trouver le prochain numéro de séquence pour cette date
  SELECT COALESCE(MAX(
    CASE 
      WHEN reference ~ ('^FUEL-' || date_part || '-[0-9]{4}$')
      THEN CAST(SUBSTRING(reference FROM '[0-9]{4}$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO next_sequence
  FROM fuel_transactions
  WHERE transaction_date = COALESCE(NEW.transaction_date, CURRENT_DATE);

  -- Générer la nouvelle référence
  new_reference := 'FUEL-' || date_part || '-' || LPAD(next_sequence::TEXT, 4, '0');

  -- Assigner la référence
  NEW.reference := new_reference;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Supprimer le trigger s'il existe déjà
DROP TRIGGER IF EXISTS trigger_generate_fuel_transaction_reference ON fuel_transactions;

-- Créer le trigger pour générer automatiquement les références
CREATE TRIGGER trigger_generate_fuel_transaction_reference
  BEFORE INSERT ON fuel_transactions
  FOR EACH ROW
  EXECUTE FUNCTION generate_fuel_transaction_reference();

-- Générer les références pour toutes les transactions existantes sans référence
DO $$
DECLARE
  transaction_record RECORD;
  next_seq INTEGER;
  date_str TEXT;
  new_ref TEXT;
BEGIN
  -- Boucle sur toutes les transactions sans référence, triées par date
  FOR transaction_record IN 
    SELECT id, transaction_date, created_at
    FROM fuel_transactions 
    WHERE reference IS NULL OR reference = ''
    ORDER BY COALESCE(transaction_date, created_at::date), created_at
  LOOP
    -- Créer la partie date
    date_str := TO_CHAR(COALESCE(transaction_record.transaction_date, transaction_record.created_at::date), 'YYYYMMDD');
    
    -- Trouver le prochain numéro de séquence pour cette date
    SELECT COALESCE(MAX(
      CASE 
        WHEN reference ~ ('^FUEL-' || date_str || '-[0-9]{4}$')
        THEN CAST(SUBSTRING(reference FROM '[0-9]{4}$') AS INTEGER)
        ELSE 0
      END
    ), 0) + 1
    INTO next_seq
    FROM fuel_transactions
    WHERE COALESCE(transaction_date, created_at::date) = COALESCE(transaction_record.transaction_date, transaction_record.created_at::date);
    
    -- Générer la nouvelle référence
    new_ref := 'FUEL-' || date_str || '-' || LPAD(next_seq::TEXT, 4, '0');
    
    -- Mettre à jour la transaction
    UPDATE fuel_transactions 
    SET reference = new_ref 
    WHERE id = transaction_record.id;
  END LOOP;
END $$;

-- Rendre la colonne reference obligatoire maintenant qu'elle est remplie
ALTER TABLE fuel_transactions ALTER COLUMN reference SET NOT NULL;

-- Créer un index unique sur la référence pour garantir l'unicité
CREATE UNIQUE INDEX IF NOT EXISTS idx_fuel_transactions_reference ON fuel_transactions(reference);
