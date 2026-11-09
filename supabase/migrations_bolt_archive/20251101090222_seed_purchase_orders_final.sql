/*
  # Seed Purchase Orders Final
  
  Add purchase orders with line items
*/

DO $$
DECLARE
  v_supplier_id UUID;
  v_order_id UUID;
  v_user_id UUID;
  v_i INTEGER;
  v_status purchase_order_status;
  v_order_date DATE;
  v_expected_delivery DATE;
BEGIN
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  
  FOR v_i IN 1..20 LOOP
    SELECT id INTO v_supplier_id 
    FROM suppliers 
    WHERE active = true 
    ORDER BY random() 
    LIMIT 1;
    
    v_status := (ARRAY['draft', 'submitted', 'approved', 'pending', 'received', 'cancelled'])[floor(random() * 6 + 1)]::purchase_order_status;
    v_order_date := CURRENT_DATE - (random() * 90)::INTEGER;
    v_expected_delivery := v_order_date + (random() * 30 + 7)::INTEGER;
    
    INSERT INTO purchase_orders (
      id,
      order_number,
      supplier_id,
      order_date,
      expected_delivery,
      actual_delivery,
      status,
      total_amount,
      notes,
      created_by,
      created_at
    ) VALUES (
      gen_random_uuid(),
      'BC-' || TO_CHAR(v_order_date, 'YYYYMMDD') || '-' || LPAD((1000 + v_i)::TEXT, 4, '0'),
      v_supplier_id,
      v_order_date,
      v_expected_delivery,
      CASE WHEN v_status = 'received' THEN v_expected_delivery + (random() * 5 - 2)::INTEGER ELSE NULL END,
      v_status,
      0,
      CASE 
        WHEN v_i % 3 = 0 THEN 'Commande urgente - livraison prioritaire'
        WHEN v_i % 3 = 1 THEN 'Commande standard pour stock'
        ELSE 'Commande maintenance préventive'
      END,
      v_user_id,
      NOW() - (random() * 90 || ' days')::INTERVAL
    )
    RETURNING id INTO v_order_id;
    
    INSERT INTO purchase_order_items (
      id,
      order_id,
      item_description,
      quantity,
      unit_price,
      total_price
    )
    SELECT 
      gen_random_uuid(),
      v_order_id,
      (ARRAY[
        'Filtre à huile moteur',
        'Filtre à air',
        'Plaquettes de frein avant',
        'Disques de frein',
        'Huile moteur 15W40 (bidon 20L)',
        'Liquide de refroidissement',
        'Courroie de distribution',
        'Batterie 12V 100Ah',
        'Ampoules phares H7',
        'Pneus 315/80R22.5',
        'Essuie-glace',
        'Durites diverses',
        'Joints de culasse',
        'Roulements',
        'Bougies de préchauffage'
      ])[floor(random() * 15 + 1)],
      (1 + random() * 20)::INTEGER,
      (50000 + random() * 950000)::NUMERIC,
      0
    FROM generate_series(1, (2 + random() * 5)::INTEGER);
    
    UPDATE purchase_order_items 
    SET total_price = quantity * unit_price 
    WHERE order_id = v_order_id;
    
    UPDATE purchase_orders 
    SET total_amount = (
      SELECT SUM(total_price) 
      FROM purchase_order_items 
      WHERE order_id = v_order_id
    )
    WHERE id = v_order_id;
  END LOOP;
END $$;
