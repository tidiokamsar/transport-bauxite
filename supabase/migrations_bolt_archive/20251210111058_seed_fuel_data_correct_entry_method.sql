/*
  # Seed Fuel Data - Correct Entry Method
  
  1. Seed Data Created
    - 8 fuel stations across Guinea
    - 500+ fuel transactions
    
  2. Corrections
    - entry_method: manual, iot_sensor, api_integration, qr_scan, rfid
    - verification_status: pending, approved, rejected, flagged
    - Unique references using timestamp
    
  3. Notes
    - Proper Guinea locations and pricing
    - All constraints validated
*/

-- Seed 8 fuel stations
INSERT INTO fuel_stations (
  name, station_type, location, gps_latitude, gps_longitude, capacity_liters, current_stock, 
  supplier_name, has_iot_sensors, authorized, contact_phone, contact_email, operating_hours, status
) VALUES
  ('Station Sangaredi Mine Principale', 'internal', 'Mine Sangaredi, Boké', 11.0667, -13.7833, 800000, 520000, 'Total Guinée', true, true, '+224 620111000', 'sangaredi@dariholding.gn', '24/7', 'active'),
  ('Station Kamsar Port', 'internal', 'Port de Kamsar', 10.6667, -14.5833, 600000, 380000, 'Total Guinée', true, true, '+224 620111100', 'kamsar@dariholding.gn', '06:00-22:00', 'active'),
  ('Station Conakry Base', 'internal', 'Base Conakry Centre', 9.5370, -13.6785, 500000, 320000, 'Puma Energy', true, true, '+224 620111200', 'conakry@dariholding.gn', '06:00-20:00', 'active'),
  ('Station Boké Depot', 'internal', 'Dépôt Boké', 10.9333, -14.2833, 450000, 280000, 'Total Guinée', false, true, '+224 620111300', 'boke@dariholding.gn', '24/7', 'active'),
  ('Station Sangaredi Sud', 'internal', 'Site Sud Sangaredi', 11.0000, -13.8000, 700000, 450000, 'Total Guinée', true, true, '+224 620111400', 'sud@dariholding.gn', '24/7', 'active'),
  ('Total Station Route Nationale', 'external', 'Route Conakry-Boké', 10.8000, -13.9000, 300000, 180000, 'Total Guinée', false, true, '+224 620111500', 'route@total.gn', '06:00-22:00', 'active'),
  ('Station Urgence Mine', 'internal', 'Zone Extraction', 11.0800, -13.7700, 400000, 260000, 'Total Guinée', true, true, '+224 620111600', 'urgence@dariholding.gn', '24/7', 'active'),
  ('Station Maintenance Centrale', 'internal', 'Atelier Central', 11.0650, -13.7850, 350000, 220000, 'Puma Energy', false, true, '+224 620111700', 'atelier@dariholding.gn', '06:00-20:00', 'active')
ON CONFLICT DO NOTHING;

-- Seed 500 fuel transactions
DO $$
DECLARE
  v_vehicles UUID[];
  v_drivers UUID[];
  v_stations UUID[];
  v_fuel_type_diesel UUID;
  v_fuel_type_essence UUID;
  v_sites UUID[];
  v_vehicle_id UUID;
  v_driver_id UUID;
  v_station_id UUID;
  v_fuel_type_id UUID;
  v_site_id UUID;
  v_volume NUMERIC;
  v_unit_price NUMERIC;
  v_total_cost NUMERIC;
  v_odometer NUMERIC;
  v_prev_odometer NUMERIC;
  v_distance_since_fill NUMERIC;
  v_transaction_date DATE;
  v_trans_type fuel_transaction_type;
  v_unique_ref TEXT;
  i INTEGER;
BEGIN
  SELECT ARRAY_AGG(id) INTO v_vehicles FROM vehicles WHERE status = 'active'::vehicle_status LIMIT 50;
  SELECT ARRAY_AGG(id) INTO v_drivers FROM drivers WHERE status = 'active'::driver_status LIMIT 35;
  SELECT ARRAY_AGG(id) INTO v_stations FROM fuel_stations WHERE status = 'active' LIMIT 8;
  SELECT ARRAY_AGG(id) INTO v_sites FROM sites LIMIT 10;
  SELECT id INTO v_fuel_type_diesel FROM fuel_types WHERE name = 'Diesel' LIMIT 1;
  SELECT id INTO v_fuel_type_essence FROM fuel_types WHERE name = 'Essence' LIMIT 1;
  
  IF array_length(v_vehicles, 1) > 0 AND array_length(v_stations, 1) > 0 THEN
    FOR i IN 1..500 LOOP
      v_vehicle_id := v_vehicles[1 + (random() * (array_length(v_vehicles, 1) - 1))::INTEGER];
      v_driver_id := CASE WHEN array_length(v_drivers, 1) > 0 THEN v_drivers[1 + (random() * (array_length(v_drivers, 1) - 1))::INTEGER] ELSE NULL END;
      v_station_id := v_stations[1 + (random() * (array_length(v_stations, 1) - 1))::INTEGER];
      v_site_id := CASE WHEN array_length(v_sites, 1) > 0 THEN v_sites[1 + (random() * (array_length(v_sites, 1) - 1))::INTEGER] ELSE NULL END;
      v_fuel_type_id := CASE WHEN random() < 0.85 THEN v_fuel_type_diesel ELSE v_fuel_type_essence END;
      v_trans_type := CASE WHEN random() < 0.9 THEN 'refuel'::fuel_transaction_type ELSE 'tank_fill'::fuel_transaction_type END;
      
      v_volume := (100 + random() * 400)::NUMERIC(10,2);
      v_unit_price := CASE 
        WHEN v_fuel_type_id = v_fuel_type_diesel THEN (12000 + random() * 3000)::NUMERIC(10,2)
        ELSE (13000 + random() * 3000)::NUMERIC(10,2)
      END;
      v_total_cost := v_volume * v_unit_price;
      v_transaction_date := (CURRENT_DATE - (random() * 180)::INTEGER)::DATE;
      
      SELECT current_km INTO v_odometer FROM vehicles WHERE id = v_vehicle_id;
      v_odometer := COALESCE(v_odometer, 100000) - (random() * 40000)::NUMERIC;
      v_prev_odometer := v_odometer - (300 + random() * 800)::NUMERIC;
      v_distance_since_fill := v_odometer - v_prev_odometer;
      
      v_unique_ref := 'FUEL-' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDDHH24MISSMS') || '-' || LPAD(i::TEXT, 5, '0');
      
      INSERT INTO fuel_transactions (
        reference, transaction_date, vehicle_id, driver_id, station_id, site_id, fuel_type_id,
        volume_liters, quantity, unit_price, total_cost, total_amount, transaction_type,
        odometer_reading, previous_odometer, distance_since_last_fill, tank_capacity_percentage,
        invoice_number, entry_method, is_authorized, verification_status, has_anomaly, notes
      ) VALUES (
        v_unique_ref, v_transaction_date, v_vehicle_id, v_driver_id, v_station_id, v_site_id, v_fuel_type_id,
        v_volume, v_volume, v_unit_price, v_total_cost, v_total_cost, v_trans_type,
        v_odometer, v_prev_odometer, v_distance_since_fill, (40 + random() * 50)::NUMERIC(5,2),
        'INV-' || v_unique_ref,
        CASE 
          WHEN random() < 0.50 THEN 'manual'
          WHEN random() < 0.75 THEN 'rfid'
          WHEN random() < 0.90 THEN 'qr_scan'
          ELSE 'iot_sensor'
        END,
        true,
        CASE WHEN random() < 0.80 THEN 'approved' WHEN random() < 0.93 THEN 'pending' ELSE 'flagged' END,
        CASE WHEN random() < 0.05 THEN true ELSE false END,
        CASE WHEN random() < 0.05 THEN 'Consommation anormalement élevée détectée' ELSE NULL END
      );
      
      PERFORM pg_sleep(0.002);
    END LOOP;
  END IF;
END $$;

-- Update stock levels
UPDATE fuel_stations SET current_stock = GREATEST(50000, capacity_liters * (0.3 + random() * 0.5)) WHERE status = 'active';
