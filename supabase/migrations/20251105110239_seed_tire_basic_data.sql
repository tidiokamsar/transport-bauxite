/*
  # Données pneus basiques
*/

-- FOURNISSEURS
INSERT INTO tire_suppliers (name, contact_info, is_local_importer, lead_time_port_to_site_days, quality_rating, active)
SELECT * FROM (VALUES
  ('Triangle Tire Guinea', '{"phone": "+224 622 123 456"}'::jsonb, true, 14, 4.5, true),
  ('Aeolus Tyre Africa', '{"phone": "+224 622 234 567"}'::jsonb, true, 21, 4.3, true),
  ('Double Coin Guinea', '{"phone": "+224 622 345 678"}'::jsonb, true, 18, 4.4, true)
) AS v(name, contact_info, is_local_importer, lead_time_port_to_site_days, quality_rating, active)
WHERE NOT EXISTS (SELECT 1 FROM tire_suppliers WHERE tire_suppliers.name = v.name);

-- MODÈLES
DO $$
DECLARE
  tri_id uuid;
BEGIN
  SELECT id INTO tri_id FROM tire_suppliers WHERE name = 'Triangle Tire Guinea' LIMIT 1;
  
  IF tri_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tire_models WHERE sku = 'TRI-TB516') THEN
    INSERT INTO tire_models (supplier_id, model_name, sku, dimension, load_index, pattern_type, price_unit, max_retreads, warranty_days, recommended_pressure_psi) VALUES
    (tri_id, 'Triangle TB516', 'TRI-TB516', '20.5-25', 186, 'L3', 35000000, 2, 730, 40),
    (tri_id, 'Triangle TB588S', 'TRI-TB588S', '23.5-25', 196, 'L5', 45000000, 2, 730, 45);
  END IF;
END $$;

-- PNEUS
DO $$
DECLARE
  model_id uuid;
  i INT;
BEGIN
  SELECT id INTO model_id FROM tire_models WHERE sku = 'TRI-TB516' LIMIT 1;
  
  IF model_id IS NOT NULL THEN
    FOR i IN 1..10 LOOP
      IF NOT EXISTS (SELECT 1 FROM tires WHERE tire_number = 'PN-2024-' || LPAD(i::text, 3, '0')) THEN
        INSERT INTO tires (tire_number, tire_model_id, brand, model, purchase_date, purchase_price, status, retread_count, max_retreads, country_origin)
        VALUES ('PN-2024-' || LPAD(i::text, 3, '0'), model_id, 'Triangle', 'TB516', CURRENT_DATE - i * 30, 35000000, 'stored', 0, 2, 'Chine');
      END IF;
    END LOOP;
  END IF;
END $$;

-- INVENTAIRE
INSERT INTO tire_inventory (site_id, tire_model_id, quantity, condition, minimum_stock, reorder_point, last_counted_date)
SELECT s.id, tm.id, 8, 'new', 3, 5, CURRENT_DATE
FROM sites s, tire_models tm
WHERE s.active = true
  AND NOT EXISTS (SELECT 1 FROM tire_inventory ti WHERE ti.site_id = s.id AND ti.tire_model_id = tm.id)
LIMIT 10;
