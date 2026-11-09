/*
  # Add Purchase Order Statuses
  
  Add missing enum values for purchase_order_status to match the UI
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'draft' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'purchase_order_status')) THEN
    ALTER TYPE purchase_order_status ADD VALUE 'draft';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'submitted' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'purchase_order_status')) THEN
    ALTER TYPE purchase_order_status ADD VALUE 'submitted';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'approved' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'purchase_order_status')) THEN
    ALTER TYPE purchase_order_status ADD VALUE 'approved';
  END IF;
END $$;
