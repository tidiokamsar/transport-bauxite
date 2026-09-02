/*
  # Ajouter les données manquantes pour le tableau de bord
  
  Cette migration ajoute les données de démonstration manquantes :
  1. Stocks de carburant
  2. Articles de stock
  3. Factures et paiements
*/

-- Ajouter des stocks de carburant
INSERT INTO fuel_stocks (fuel_type_id, site_id, tank_capacity, current_stock, minimum_stock, last_refill_date)
SELECT 
  ft.id,
  s.id,
  CASE 
    WHEN ft.name = 'Diesel' THEN 150000
    WHEN ft.name = 'Essence' THEN 50000
    ELSE 20000
  END as tank_capacity,
  CASE 
    WHEN ft.name = 'Diesel' THEN 75000
    WHEN ft.name = 'Essence' THEN 15000
    ELSE 5000
  END as current_stock,
  CASE 
    WHEN ft.name = 'Diesel' THEN 20000
    WHEN ft.name = 'Essence' THEN 5000
    ELSE 2000
  END as minimum_stock,
  (NOW() - INTERVAL '3 days')::DATE as last_refill_date
FROM fuel_types ft
CROSS JOIN (SELECT id FROM sites WHERE name = 'Mine Sangaredi' LIMIT 1) s
ON CONFLICT DO NOTHING;

-- Ajouter des articles de stock (pièces détachées)
DO $$
DECLARE
  v_category_id UUID;
  v_warehouse_id UUID;
  v_supplier_id UUID;
BEGIN
  SELECT id INTO v_category_id FROM stock_categories WHERE name = 'Mécanique' LIMIT 1;
  SELECT id INTO v_warehouse_id FROM warehouses LIMIT 1;
  SELECT id INTO v_supplier_id FROM suppliers LIMIT 1;
  
  IF v_category_id IS NOT NULL AND v_warehouse_id IS NOT NULL THEN
    INSERT INTO stock_items (name, item_code, category_id, unit_of_measure, unit_price, quantity_in_stock, minimum_threshold, maximum_threshold, warehouse_id, supplier_id, active)
    VALUES
      ('Filtre à huile HD', 'FLT-001', v_category_id, 'UNITÉ', 25000, 45, 10, 100, v_warehouse_id, v_supplier_id, true),
      ('Filtre à air HD', 'FLT-002', v_category_id, 'UNITÉ', 35000, 38, 10, 80, v_warehouse_id, v_supplier_id, true),
      ('Filtre à carburant', 'FLT-003', v_category_id, 'UNITÉ', 28000, 52, 15, 100, v_warehouse_id, v_supplier_id, true),
      ('Plaquettes de frein', 'FRN-001', v_category_id, 'JEU', 95000, 24, 8, 50, v_warehouse_id, v_supplier_id, true),
      ('Disques de frein', 'FRN-002', v_category_id, 'UNITÉ', 185000, 16, 5, 30, v_warehouse_id, v_supplier_id, true),
      ('Huile moteur 15W40', 'OIL-001', v_category_id, 'BIDON 20L', 125000, 65, 20, 150, v_warehouse_id, v_supplier_id, true),
      ('Liquide refroidissement', 'LIQ-001', v_category_id, 'BIDON 20L', 45000, 42, 15, 100, v_warehouse_id, v_supplier_id, true),
      ('Batterie 12V 180Ah', 'BAT-001', v_category_id, 'UNITÉ', 325000, 12, 4, 25, v_warehouse_id, v_supplier_id, true),
      ('Courroie alternateur', 'BEL-001', v_category_id, 'UNITÉ', 45000, 28, 8, 40, v_warehouse_id, v_supplier_id, true),
      ('Essuie-glace HD', 'WSH-001', v_category_id, 'PAIRE', 15000, 35, 10, 50, v_warehouse_id, v_supplier_id, true),
      ('Ampoule H4', 'LMP-001', v_category_id, 'UNITÉ', 8000, 48, 15, 80, v_warehouse_id, v_supplier_id, true),
      ('Rétroviseur externe', 'MIR-001', v_category_id, 'UNITÉ', 65000, 8, 3, 20, v_warehouse_id, v_supplier_id, true),
      ('Joint de culasse', 'GSK-001', v_category_id, 'UNITÉ', 285000, 4, 2, 10, v_warehouse_id, v_supplier_id, true),
      ('Radiateur complet', 'RAD-001', v_category_id, 'UNITÉ', 425000, 3, 1, 8, v_warehouse_id, v_supplier_id, true),
      ('Démarreur', 'STR-001', v_category_id, 'UNITÉ', 385000, 5, 2, 12, v_warehouse_id, v_supplier_id, true)
    ON CONFLICT (item_code) DO NOTHING;
  END IF;
END $$;

-- Ajouter des factures
DO $$
DECLARE
  v_customer_id UUID;
  v_invoice_id UUID;
  v_vehicle_reg TEXT;
  v_amount DECIMAL;
  v_invoice_date DATE;
  v_due_date DATE;
  v_status TEXT;
  v_amount_paid DECIMAL;
  v_invoice_number TEXT;
BEGIN
  SELECT id INTO v_customer_id FROM customers LIMIT 1;
  
  IF v_customer_id IS NOT NULL THEN
    FOR i IN 1..30 LOOP
      v_invoice_date := (NOW() - (i || ' days')::INTERVAL)::DATE;
      v_due_date := v_invoice_date + INTERVAL '30 days';
      v_amount := 150000000 + (RANDOM() * 50000000)::INTEGER;
      v_invoice_number := 'INV-' || TO_CHAR(v_invoice_date, 'YYYYMM') || '-' || LPAD(i::TEXT, 4, '0');
      
      IF i <= 15 THEN
        v_status := 'paid';
        v_amount_paid := v_amount * 1.18;
      ELSIF i <= 25 THEN
        v_status := 'partial';
        v_amount_paid := v_amount * 1.18 * 0.6;
      ELSE
        v_status := 'pending';
        v_amount_paid := 0;
      END IF;
      
      INSERT INTO invoices (
        invoice_number, customer_id, invoice_date, due_date,
        subtotal, tax_amount, discount_amount, total_amount, amount_paid,
        status, notes
      )
      VALUES (
        v_invoice_number, v_customer_id, v_invoice_date, v_due_date,
        v_amount, v_amount * 0.18, 0, v_amount * 1.18, v_amount_paid,
        v_status, 'Facture transport de minerai'
      )
      ON CONFLICT (invoice_number) DO NOTHING
      RETURNING id INTO v_invoice_id;
      
      IF v_invoice_id IS NOT NULL THEN
        SELECT registration INTO v_vehicle_reg FROM vehicles ORDER BY RANDOM() LIMIT 1;
        
        INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price)
        VALUES (
          v_invoice_id,
          'Transport de minerai - ' || COALESCE(v_vehicle_reg, 'N/A'),
          (50 + RANDOM() * 30)::INTEGER,
          3500000,
          ((50 + RANDOM() * 30) * 3500000)::DECIMAL
        );
        
        IF v_status IN ('paid', 'partial') THEN
          INSERT INTO payments (invoice_id, payment_date, amount, payment_method, reference_number, notes)
          VALUES (
            v_invoice_id,
            v_invoice_date + INTERVAL '7 days',
            v_amount_paid,
            CASE 
              WHEN RANDOM() < 0.6 THEN 'bank_transfer'
              WHEN RANDOM() < 0.8 THEN 'check'
              ELSE 'wire_transfer'
            END,
            'PAY-' || TO_CHAR(v_invoice_date + INTERVAL '7 days', 'YYYYMMDD') || '-' || LPAD(v_invoice_id::TEXT, 6, '0'),
            'Paiement facture ' || v_invoice_number
          );
        END IF;
      END IF;
    END LOOP;
  END IF;
END $$;
