/*
  # Ajouter des transactions de carburant récentes pour les analyses
  
  Cette migration ajoute des transactions de carburant pour les 30 derniers jours
  afin que l'onglet Analyses affiche des données.
*/

-- Ajouter des transactions de carburant récentes
DO $$
DECLARE
  v_vehicle_id UUID;
  v_driver_id UUID;
  v_fuel_type_id UUID;
  v_site_id UUID;
  v_date DATE;
  v_volume NUMERIC;
  v_unit_price NUMERIC;
BEGIN
  -- Obtenir des IDs de référence
  SELECT id INTO v_fuel_type_id FROM fuel_types WHERE name = 'Diesel' LIMIT 1;
  SELECT id INTO v_site_id FROM sites WHERE name = 'Mine Sangaredi' LIMIT 1;
  
  IF v_fuel_type_id IS NOT NULL AND v_site_id IS NOT NULL THEN
    -- Créer 60 transactions sur les 30 derniers jours (environ 2 par jour)
    FOR i IN 0..59 LOOP
      v_date := CURRENT_DATE - (i / 2);
      
      -- Sélectionner un véhicule et conducteur aléatoires
      SELECT id INTO v_vehicle_id FROM vehicles ORDER BY RANDOM() LIMIT 1;
      SELECT id INTO v_driver_id FROM drivers ORDER BY RANDOM() LIMIT 1;
      
      -- Volume aléatoire entre 100 et 500 litres
      v_volume := 100 + (RANDOM() * 400)::NUMERIC;
      
      -- Prix unitaire avec variation
      v_unit_price := 7000 + (RANDOM() * 1000)::NUMERIC;
      
      -- Insérer la transaction
      INSERT INTO fuel_transactions (
        transaction_date,
        vehicle_id,
        driver_id,
        fuel_type_id,
        site_id,
        volume_liters,
        unit_price,
        total_cost,
        odometer_reading,
        entry_method,
        notes
      )
      VALUES (
        v_date,
        v_vehicle_id,
        v_driver_id,
        v_fuel_type_id,
        v_site_id,
        v_volume,
        v_unit_price,
        v_volume * v_unit_price,
        50000 + (RANDOM() * 200000)::INTEGER,
        'manual',
        'Ravitaillement quotidien'
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END $$;
