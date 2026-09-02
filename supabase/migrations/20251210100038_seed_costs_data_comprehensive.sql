/*
  # Add Comprehensive Cost Management Data for DARI HOLDING

  1. New Data
    - Add diverse operational costs (fuel, maintenance, repairs, tires, insurance, salaries)
    - November-December 2025 period
    - Linked to real vehicles and cost categories
    - Realistic amounts in GNF (Guinean Francs)
  
  2. Cost Categories
    - Fixed costs: Insurance, salaries, amortization
    - Variable costs: Fuel, maintenance, repairs, tires
    - Operational costs: Tolls, taxes
  
  3. Security
    - Maintains all existing RLS policies
    - Links to existing vehicles and categories
*/

-- Add additional comprehensive costs data for November-December 2025
DO $$
DECLARE
  v_vehicle_ids uuid[];
  v_category_ids record;
  v_vehicle_id uuid;
  v_random_vehicle uuid;
  v_date date;
BEGIN
  -- Get sample vehicle IDs
  SELECT ARRAY_AGG(id) INTO v_vehicle_ids FROM vehicles LIMIT 30;
  
  -- Get category IDs
  SELECT 
    (SELECT id FROM cost_categories WHERE name = 'Carburant' LIMIT 1) as fuel_id,
    (SELECT id FROM cost_categories WHERE name = 'Entretien courant' LIMIT 1) as maintenance_id,
    (SELECT id FROM cost_categories WHERE name = 'Réparations' LIMIT 1) as repair_id,
    (SELECT id FROM cost_categories WHERE name = 'Pneus' LIMIT 1) as tire_id,
    (SELECT id FROM cost_categories WHERE name = 'Assurances' LIMIT 1) as insurance_id,
    (SELECT id FROM cost_categories WHERE name = 'Salaires chauffeurs' LIMIT 1) as salary_id,
    (SELECT id FROM cost_categories WHERE name = 'Péages et taxes' LIMIT 1) as toll_id
  INTO v_category_ids;

  -- Insert fuel costs for November 2025 (multiple refueling)
  FOR i IN 1..25 LOOP
    v_random_vehicle := v_vehicle_ids[1 + floor(random() * array_length(v_vehicle_ids, 1))];
    v_date := ('2025-11-' || LPAD((1 + floor(random() * 28))::text, 2, '0'))::date;
    
    INSERT INTO costs (date, category_id, vehicle_id, description, amount, reference, payment_method, notes)
    VALUES (
      v_date,
      v_category_ids.fuel_id,
      v_random_vehicle,
      'Plein de gasoil - Mine Sangarédi',
      (800 + random() * 300) * 12500, -- 800-1100L x 12,500 GNF/L = 10-13.75M GNF
      'FUEL-2025-11-' || LPAD(i::text, 4, '0'),
      'card',
      'Ravitaillement opérationnel transport bauxite'
    );
  END LOOP;

  -- Insert fuel costs for December 2025
  FOR i IN 1..20 LOOP
    v_random_vehicle := v_vehicle_ids[1 + floor(random() * array_length(v_vehicle_ids, 1))];
    v_date := ('2025-12-' || LPAD((1 + floor(random() * 10))::text, 2, '0'))::date;
    
    INSERT INTO costs (date, category_id, vehicle_id, description, amount, reference, payment_method, notes)
    VALUES (
      v_date,
      v_category_ids.fuel_id,
      v_random_vehicle,
      'Plein de gasoil - Station Total Kamsar',
      (800 + random() * 300) * 12500,
      'FUEL-2025-12-' || LPAD(i::text, 4, '0'),
      'card',
      'Carburant transport bauxite'
    );
  END LOOP;

  -- Insert maintenance costs for November 2025
  FOR i IN 1..15 LOOP
    v_random_vehicle := v_vehicle_ids[1 + floor(random() * array_length(v_vehicle_ids, 1))];
    v_date := ('2025-11-' || LPAD((1 + floor(random() * 28))::text, 2, '0'))::date;
    
    INSERT INTO costs (date, category_id, vehicle_id, description, amount, reference, payment_method, notes)
    VALUES (
      v_date,
      v_category_ids.maintenance_id,
      v_random_vehicle,
      CASE (i % 4)
        WHEN 0 THEN 'Vidange moteur et filtres'
        WHEN 1 THEN 'Révision 50,000 km'
        WHEN 2 THEN 'Graissage et vérification générale'
        ELSE 'Entretien préventif complet'
      END,
      2500000 + random() * 3500000, -- 2.5M - 6M GNF
      'MAINT-2025-11-' || LPAD(i::text, 4, '0'),
      'transfer',
      'Maintenance préventive programmée'
    );
  END LOOP;

  -- Insert repair costs for November-December 2025
  FOR i IN 1..12 LOOP
    v_random_vehicle := v_vehicle_ids[1 + floor(random() * array_length(v_vehicle_ids, 1))];
    v_date := ('2025-' || LPAD((11 + floor(random() * 2))::text, 2, '0') || '-' || LPAD((1 + floor(random() * 28))::text, 2, '0'))::date;
    
    INSERT INTO costs (date, category_id, vehicle_id, description, amount, reference, payment_method, notes)
    VALUES (
      v_date,
      v_category_ids.repair_id,
      v_random_vehicle,
      CASE (i % 5)
        WHEN 0 THEN 'Réparation système freinage'
        WHEN 1 THEN 'Remplacement embrayage'
        WHEN 2 THEN 'Réparation suspension avant'
        WHEN 3 THEN 'Réparation boîte de vitesses'
        ELSE 'Réparation système électrique'
      END,
      5000000 + random() * 15000000, -- 5M - 20M GNF
      'REP-2025-' || LPAD(i::text, 4, '0'),
      'transfer',
      'Réparation urgente suite à panne'
    );
  END LOOP;

  -- Insert tire costs for November-December 2025
  FOR i IN 1..8 LOOP
    v_random_vehicle := v_vehicle_ids[1 + floor(random() * array_length(v_vehicle_ids, 1))];
    v_date := ('2025-' || LPAD((11 + floor(random() * 2))::text, 2, '0') || '-' || LPAD((1 + floor(random() * 28))::text, 2, '0'))::date;
    
    INSERT INTO costs (date, category_id, vehicle_id, description, amount, reference, payment_method, notes)
    VALUES (
      v_date,
      v_category_ids.tire_id,
      v_random_vehicle,
      CASE (i % 3)
        WHEN 0 THEN 'Remplacement 2 pneus avant'
        WHEN 1 THEN 'Train complet 4 pneus'
        ELSE 'Remplacement 2 pneus arrière'
      END,
      CASE (i % 3)
        WHEN 0 THEN 8000000 -- 8M GNF (2 pneus)
        WHEN 1 THEN 16000000 -- 16M GNF (4 pneus)
        ELSE 8000000
      END,
      'TIRE-2025-' || LPAD(i::text, 4, '0'),
      'transfer',
      'Pneus Michelin/Bridgestone pour camions benne'
    );
  END LOOP;

  -- Insert insurance costs (monthly fixed cost)
  FOR i IN 1..30 LOOP
    v_random_vehicle := v_vehicle_ids[i];
    
    IF v_random_vehicle IS NOT NULL THEN
      -- November insurance
      INSERT INTO costs (date, category_id, vehicle_id, description, amount, reference, payment_method, notes)
      VALUES (
        '2025-11-01'::date,
        v_category_ids.insurance_id,
        v_random_vehicle,
        'Prime assurance mensuelle tous risques',
        2800000, -- 2.8M GNF per vehicle per month
        'INS-2025-11-' || LPAD(i::text, 4, '0'),
        'transfer',
        'Assurance tous risques DARI HOLDING'
      );
      
      -- December insurance
      INSERT INTO costs (date, category_id, vehicle_id, description, amount, reference, payment_method, notes)
      VALUES (
        '2025-12-01'::date,
        v_category_ids.insurance_id,
        v_random_vehicle,
        'Prime assurance mensuelle tous risques',
        2800000,
        'INS-2025-12-' || LPAD(i::text, 4, '0'),
        'transfer',
        'Assurance tous risques DARI HOLDING'
      );
    END IF;
  END LOOP;

  -- Insert toll/tax costs for trips
  FOR i IN 1..35 LOOP
    v_random_vehicle := v_vehicle_ids[1 + floor(random() * array_length(v_vehicle_ids, 1))];
    v_date := ('2025-' || LPAD((11 + floor(random() * 2))::text, 2, '0') || '-' || LPAD((1 + floor(random() * 28))::text, 2, '0'))::date;
    
    INSERT INTO costs (date, category_id, vehicle_id, description, amount, reference, payment_method, notes)
    VALUES (
      v_date,
      v_category_ids.toll_id,
      v_random_vehicle,
      'Péages et taxes de circulation',
      150000 + random() * 100000, -- 150K - 250K GNF per trip
      'TOLL-2025-' || LPAD(i::text, 4, '0'),
      'cash',
      'Taxes trajet Sangarédi-Kamsar'
    );
  END LOOP;

END $$;
