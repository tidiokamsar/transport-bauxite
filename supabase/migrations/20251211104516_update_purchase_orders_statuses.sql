/*
  # Mise a jour des statuts purchase_orders

  1. Modifications
    - Changer 'pending' en 'submitted' ou 'approved' pour correspondre au frontend
*/

-- Changer les statuts pending en submitted et approved
UPDATE purchase_orders
SET status = CASE 
  WHEN RANDOM() < 0.6 THEN 'submitted'::purchase_order_status
  ELSE 'approved'::purchase_order_status
END
WHERE status = 'pending'::purchase_order_status;
