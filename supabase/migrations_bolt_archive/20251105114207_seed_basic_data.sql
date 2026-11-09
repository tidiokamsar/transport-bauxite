/*
  # Données basiques
*/

INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price, item_order)
SELECT i.id, 'Transport', 1, 5000000, 5000000, 1
FROM invoices i WHERE NOT EXISTS (SELECT 1 FROM invoice_items WHERE invoice_id = i.id);

INSERT INTO stock_movements (item_id, movement_type, quantity, previous_quantity, new_quantity, reference, reason, performed_by)
SELECT si.id, 'entry', 10, si.quantity, si.quantity + 10, 'PO', 'Réception', (SELECT id FROM profiles LIMIT 1)
FROM stock_items si ORDER BY random() LIMIT 30;

INSERT INTO maintenance_parts (maintenance_order_id, part_id, quantity_used, unit_cost)
SELECT mo.id, pi.id, 2, pi.unit_price FROM maintenance_orders mo
CROSS JOIN parts_inventory pi WHERE mo.status = 'completed' ORDER BY random() LIMIT 50;
