/*
  # Remplir les données complètes pour le dashboard
  
  Cette migration ajoute toutes les données nécessaires avec tous les champs obligatoires.
*/

-- 1. Types de carburant
INSERT INTO fuel_types (name, unit, active)
VALUES ('Diesel', 'Litres', true), ('Essence', 'Litres', true), ('AdBlue', 'Litres', true)
ON CONFLICT DO NOTHING;

-- 2. Catégories de stock
INSERT INTO stock_categories (name, description)
VALUES ('Mécanique', 'Pièces mécaniques'), ('Pneumatiques', 'Pneus'), ('Électricité', 'Électrique')
ON CONFLICT (name) DO NOTHING;

-- 3. Entrepôts
INSERT INTO warehouses (name, code, warehouse_type, location, manager_name, phone, active)
VALUES ('Entrepôt Principal', 'WH-01', 'main', 'Mine Sangaredi', 'M. Diallo', '+224 620001', true),
  ('Dépôt Port', 'WH-02', 'depot', 'Port Kamsar', 'A. Barry', '+224 620002', true)
ON CONFLICT (code) DO NOTHING;

-- 4. Fournisseurs
INSERT INTO suppliers (supplier_number, supplier_type, company_name, contact_name, email, phone, address, payment_terms, active)
VALUES ('SUP-001', 'parts', 'SOGUIPAMI', 'I. Sow', 'contact@soguipami.gn', '+224 620111', 'Zone Industrielle', '30', true),
  ('SUP-002', 'fuel', 'Total Guinée', 'F. Camara', 'pro@total.gn', '+224 620222', 'Boulevard', '15', true)
ON CONFLICT (supplier_number) DO NOTHING;

-- 5. Clients
INSERT INTO customers (customer_number, customer_type, company_name, contact_name, email, phone, address, city, country, tax_id, payment_terms, credit_limit, active)
VALUES ('CLT-001', 'mining_company', 'CBG', 'Dir Commercial', 'contact@cbg.com', '+224 630101', 'Mine', 'Boké', 'Guinée', 'GN111', 30, 50000000000, true),
  ('CLT-002', 'mining_company', 'SMB', 'Achats', 'achats@smb.com', '+224 630202', 'Zone', 'Boké', 'Guinée', 'GN222', 30, 30000000000, true)
ON CONFLICT (customer_number) DO NOTHING;

-- 6. Stocks carburant
INSERT INTO fuel_stocks (fuel_type_id, site_id, tank_capacity, current_stock, minimum_stock, last_refill_date)
SELECT ft.id, s.id,
  CASE WHEN ft.name = 'Diesel' THEN 150000 ELSE 50000 END,
  CASE WHEN ft.name = 'Diesel' THEN 75000 ELSE 15000 END,
  CASE WHEN ft.name = 'Diesel' THEN 20000 ELSE 5000 END,
  CURRENT_DATE - 3
FROM fuel_types ft CROSS JOIN (SELECT id FROM sites LIMIT 1) s
WHERE NOT EXISTS (SELECT 1 FROM fuel_stocks WHERE fuel_type_id = ft.id);

-- 7. Articles stock (avec quelques articles en dessous du seuil)
INSERT INTO stock_items (name, item_code, category_id, unit_of_measure, unit_price, quantity_in_stock, minimum_threshold, maximum_threshold, warehouse_id, supplier_id, active)
SELECT t.name, t.code, (SELECT id FROM stock_categories LIMIT 1), t.unit, t.price, t.qty, t.min_qty, t.max_qty, (SELECT id FROM warehouses LIMIT 1), (SELECT id FROM suppliers LIMIT 1), true
FROM (VALUES
  ('Filtre huile', 'FLT-001', 'UNITÉ', 25000, 45, 10, 100),
  ('Filtre air', 'FLT-002', 'UNITÉ', 35000, 6, 10, 80),
  ('Plaquettes', 'FRN-001', 'JEU', 95000, 3, 8, 50),
  ('Batterie', 'BAT-001', 'UNITÉ', 325000, 12, 4, 25),
  ('Huile moteur', 'OIL-001', 'BIDON', 125000, 65, 20, 150),
  ('Liquide refroid', 'LIQ-001', 'BIDON', 45000, 8, 15, 100)
) AS t(name, code, unit, price, qty, min_qty, max_qty)
WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE item_code = t.code);

-- 8. Factures avec tous les champs obligatoires
DO $$
DECLARE
  v_customer_id UUID;
  v_invoice_id UUID;
  v_amount BIGINT;
  v_status TEXT;
  v_amount_paid NUMERIC;
  v_period_start DATE;
  v_period_end DATE;
  v_payment_number TEXT;
BEGIN
  SELECT id INTO v_customer_id FROM customers LIMIT 1;
  
  IF v_customer_id IS NOT NULL THEN
    FOR i IN 1..30 LOOP
      v_amount := 150000000 + (RANDOM() * 50000000)::BIGINT;
      v_status := CASE WHEN i <= 15 THEN 'paid' WHEN i <= 25 THEN 'partial' ELSE 'pending' END;
      v_amount_paid := CASE WHEN i <= 15 THEN v_amount * 1.18 WHEN i <= 25 THEN v_amount * 1.18 * 0.6 ELSE 0 END;
      v_period_start := CURRENT_DATE - i - 15;
      v_period_end := CURRENT_DATE - i;
      v_payment_number := 'PAY-' || TO_CHAR(CURRENT_DATE - i + 7, 'YYYYMMDD') || '-' || LPAD(i::TEXT, 4, '0');
      
      INSERT INTO invoices (
        invoice_number, customer_id, invoice_date, due_date,
        period_start, period_end, unit_rate,
        subtotal, tax_amount, discount_amount, total_amount, amount_paid,
        status, notes
      )
      VALUES (
        'INV-' || TO_CHAR(CURRENT_DATE - i, 'YYYYMM') || '-' || LPAD(i::TEXT, 4, '0'),
        v_customer_id, CURRENT_DATE - i, CURRENT_DATE - i + 30,
        v_period_start, v_period_end, 3500000,
        v_amount, v_amount * 0.18, 0, v_amount * 1.18, v_amount_paid,
        v_status, 'Transport'
      )
      ON CONFLICT (invoice_number) DO NOTHING
      RETURNING id INTO v_invoice_id;
      
      IF v_invoice_id IS NOT NULL THEN
        INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price)
        VALUES (v_invoice_id, 'Transport minerai', (50 + RANDOM() * 30)::INTEGER, 3500000, ((50 + RANDOM() * 30) * 3500000)::NUMERIC);
        
        IF v_status IN ('paid', 'partial') AND v_amount_paid > 0 THEN
          INSERT INTO payments (
            payment_number, invoice_id, customer_id, payment_date, 
            amount, payment_method, reference_number, notes
          )
          VALUES (
            v_payment_number, v_invoice_id, v_customer_id, CURRENT_DATE - i + 7,
            v_amount_paid, 'bank_transfer', 'REF-' || LPAD(i::TEXT, 6, '0'), 'Paiement facture'
          );
        END IF;
      END IF;
    END LOOP;
  END IF;
END $$;
