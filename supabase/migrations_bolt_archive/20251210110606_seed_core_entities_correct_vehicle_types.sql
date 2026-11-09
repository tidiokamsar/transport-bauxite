/*
  # Seed Core Entities - Correct Vehicle Types
  
  1. Seed Data Created
    - 60 vehicles (using: tipper, tanker, flatbed, loader, excavator, pickup, bus, tow_truck)
    - 40 drivers
    - 35 employees
    - 25 suppliers
    - 15 customers
    - 10 additional sites
    
  2. Corrections
    - vehicle_type: tipper, tanker, flatbed, loader, excavator, pickup, bus, tow_truck
    - All enums properly cast
    - Correct schema for all tables
    
  3. Notes
    - Chinese truck brands for mining operations
    - Guinea context with GNF, +224 phones
    - Sangaredi/Conakry/Kamsar locations
*/

-- Seed 60 vehicles
DO $$
DECLARE
  v_site_id UUID;
  v_status vehicle_status;
BEGIN
  SELECT id INTO v_site_id FROM sites LIMIT 1;
  
  FOR i IN 1..60 LOOP
    v_status := CASE 
      WHEN random() < 0.80 THEN 'active'::vehicle_status
      WHEN random() < 0.95 THEN 'maintenance'::vehicle_status
      ELSE 'immobilized'::vehicle_status
    END;
    
    INSERT INTO vehicles (
      registration,
      brand_model,
      year,
      capacity_tonnes,
      vehicle_type,
      chassis_number,
      current_km,
      status,
      site_id,
      purchase_cost,
      current_value,
      insurance_expiry,
      technical_inspection_expiry,
      gps_device_id,
      gps_device_active
    ) VALUES (
      'GN-' || LPAD(i::TEXT, 3, '0') || '-' || LPAD((1000 + i)::TEXT, 3, '0'),
      CASE 
        WHEN i <= 20 THEN 'XCMG XG958'
        WHEN i <= 35 THEN 'SANY SY956'
        WHEN i <= 45 THEN 'Sinotruk HOWO ZZ3257'
        WHEN i <= 55 THEN 'Shacman X3000'
        ELSE 'FAW J6P'
      END,
      2018 + (random() * 6)::INTEGER,
      CASE 
        WHEN i <= 45 THEN (30 + random() * 25)::NUMERIC(10,2)
        ELSE (5 + random() * 10)::NUMERIC(10,2)
      END,
      CASE 
        WHEN i <= 35 THEN 'tipper'
        WHEN i <= 43 THEN 'tanker'
        WHEN i <= 48 THEN 'flatbed'
        WHEN i <= 51 THEN 'loader'
        WHEN i <= 54 THEN 'excavator'
        WHEN i <= 57 THEN 'bus'
        ELSE 'pickup'
      END,
      'CHASSIS-' || LPAD(i::TEXT, 8, '0'),
      (50000 + random() * 200000)::NUMERIC,
      v_status,
      v_site_id,
      (800000000 + random() * 1200000000)::NUMERIC,
      (500000000 + random() * 1000000000)::NUMERIC,
      (CURRENT_DATE + (180 + random() * 180)::INTEGER * INTERVAL '1 day')::DATE,
      (CURRENT_DATE + (30 + random() * 300)::INTEGER * INTERVAL '1 day')::DATE,
      'GPS-' || LPAD(i::TEXT, 6, '0'),
      CASE WHEN random() < 0.95 THEN true ELSE false END
    );
  END LOOP;
END $$;

-- Seed 40 drivers
DO $$
DECLARE
  first_names TEXT[] := ARRAY['Mamadou', 'Ibrahima', 'Abdoulaye', 'Ousmane', 'Sekou', 'Amadou', 'Boubacar', 'Alpha', 'Mohamed', 'Thierno'];
  last_names TEXT[] := ARRAY['Diallo', 'Barry', 'Bah', 'Camara', 'Condé', 'Sylla', 'Keita', 'Touré', 'Soumah', 'Bangoura'];
  license_cats TEXT[] := ARRAY['C', 'CE', 'D', 'DE'];
  i INTEGER;
  fname TEXT;
  lname TEXT;
  v_status driver_status;
BEGIN
  FOR i IN 1..40 LOOP
    fname := first_names[1 + (random() * (array_length(first_names, 1) - 1))::INTEGER];
    lname := last_names[1 + (random() * (array_length(last_names, 1) - 1))::INTEGER];
    v_status := CASE WHEN random() < 0.92 THEN 'active'::driver_status ELSE 'suspended'::driver_status END;
    
    INSERT INTO drivers (
      name,
      employee_id,
      phone,
      email,
      birth_date,
      address,
      license_number,
      license_category,
      license_expiry,
      hire_date,
      contract_type,
      base_salary,
      status,
      health_certificate_expiry,
      emergency_contact_name,
      emergency_contact_phone,
      notes
    ) VALUES (
      fname || ' ' || lname,
      'EMP-DR-' || LPAD(i::TEXT, 4, '0'),
      '+224 6' || (20000000 + (random() * 79999999)::INTEGER)::TEXT,
      lower(fname || '.' || lname || '@dariholding.gn'),
      (DATE '1970-01-01' + (random() * 18250)::INTEGER * INTERVAL '1 day')::DATE,
      CASE 
        WHEN i <= 20 THEN 'Conakry, Quartier ' || (ARRAY['Kaloum', 'Ratoma', 'Matoto'])[1 + (random() * 2)::INTEGER]
        ELSE 'Boké, Sangaredi'
      END,
      'DL-GN-' || LPAD((100000 + i)::TEXT, 6, '0'),
      license_cats[1 + (random() * (array_length(license_cats, 1) - 1))::INTEGER],
      (CURRENT_DATE + (180 + random() * 720)::INTEGER * INTERVAL '1 day')::DATE,
      (CURRENT_DATE - (random() * 2000)::INTEGER * INTERVAL '1 day')::DATE,
      CASE WHEN random() < 0.7 THEN 'CDI' ELSE 'CDD' END,
      (8000000 + random() * 7000000)::NUMERIC,
      v_status,
      (CURRENT_DATE + (90 + random() * 270)::INTEGER * INTERVAL '1 day')::DATE,
      first_names[1 + (random() * (array_length(first_names, 1) - 1))::INTEGER] || ' ' || 
      last_names[1 + (random() * (array_length(last_names, 1) - 1))::INTEGER],
      '+224 6' || (20000000 + (random() * 79999999)::INTEGER)::TEXT,
      CASE WHEN random() < 0.2 THEN 'Chauffeur expérimenté poids lourds' ELSE NULL END
    );
  END LOOP;
END $$;

-- Seed 35 employees
DO $$
DECLARE
  v_dept_id UUID;
  first_names TEXT[] := ARRAY['Fatoumata', 'Mariama', 'Kadiatou', 'Aissatou', 'Mamadou', 'Ibrahima', 'Abdoulaye', 'Ousmane'];
  last_names TEXT[] := ARRAY['Diallo', 'Barry', 'Bah', 'Camara', 'Condé', 'Sylla', 'Keita', 'Touré'];
  positions TEXT[] := ARRAY['Manager', 'Supervisor', 'Technician', 'Coordinator'];
  i INTEGER;
  v_status employee_status;
BEGIN
  SELECT id INTO v_dept_id FROM departments LIMIT 1;
  
  IF v_dept_id IS NOT NULL THEN
    FOR i IN 1..35 LOOP
      v_status := CASE WHEN random() < 0.93 THEN 'active'::employee_status ELSE 'on_leave'::employee_status END;
      
      INSERT INTO employees (
        employee_number,
        first_name,
        last_name,
        department_id,
        position,
        hire_date,
        base_salary,
        phone,
        email,
        address,
        status
      ) VALUES (
        'EMP-' || LPAD(i::TEXT, 5, '0'),
        first_names[1 + (random() * (array_length(first_names, 1) - 1))::INTEGER],
        last_names[1 + (random() * (array_length(last_names, 1) - 1))::INTEGER],
        v_dept_id,
        positions[1 + (random() * (array_length(positions, 1) - 1))::INTEGER],
        (CURRENT_DATE - (random() * 1500)::INTEGER * INTERVAL '1 day')::DATE,
        (5000000 + random() * 15000000)::NUMERIC,
        '+224 6' || (20000000 + (random() * 79999999)::INTEGER)::TEXT,
        'employee' || i || '@dariholding.gn',
        'Conakry, Guinea',
        v_status
      );
    END LOOP;
  END IF;
END $$;

-- Seed 25 suppliers
DO $$
BEGIN
  FOR i IN 1..25 LOOP
    INSERT INTO suppliers (name, contact_person, phone, email, address, active)
    VALUES (
      CASE 
        WHEN i <= 5 THEN 'Total Guinée Fournisseur ' || i
        WHEN i <= 10 THEN 'Pièces Auto Conakry ' || i
        WHEN i <= 15 THEN 'Pneumatiques Guinée ' || i
        ELSE 'Garage Moderne ' || i
      END,
      'Contact ' || i,
      '+224 6' || (20000000 + (random() * 79999999)::INTEGER)::TEXT,
      'supplier' || i || '@example.gn',
      CASE WHEN i <= 15 THEN 'Conakry' ELSE 'Boké' END || ', Guinea',
      true
    );
  END LOOP;
END $$;

-- Seed 15 customers
DO $$
BEGIN
  FOR i IN 1..15 LOOP
    INSERT INTO customers (customer_number, customer_type, company_name, contact_name, email, phone, address, city, country, payment_terms, credit_limit, active)
    VALUES (
      'CUST-' || LPAD(i::TEXT, 5, '0'),
      CASE WHEN random() < 0.6 THEN 'company' ELSE 'individual' END,
      'Client CBG Site ' || i,
      'Contact Client ' || i,
      'client' || i || '@client.gn',
      '+224 6' || (20000000 + (random() * 79999999)::INTEGER)::TEXT,
      CASE WHEN i <= 8 THEN 'Zone Minière' ELSE 'Centre Ville' END,
      CASE WHEN i <= 8 THEN 'Boké' ELSE 'Conakry' END,
      'Guinea',
      CASE WHEN random() < 0.4 THEN 30 ELSE 60 END,
      (50000000 + random() * 200000000)::NUMERIC,
      true
    );
  END LOOP;
END $$;

-- Seed sites
DO $$
DECLARE
  v_count INTEGER;
  v_manager_id UUID;
  v_site_type site_type;
BEGIN
  SELECT COUNT(*) INTO v_count FROM sites;
  SELECT id INTO v_manager_id FROM employees LIMIT 1;
  
  IF v_count < 15 THEN
    FOR i IN 1..LEAST(15, 15 - v_count) LOOP
      v_site_type := CASE 
        WHEN i <= 3 THEN 'depot'::site_type
        WHEN i <= 6 THEN 'mine'::site_type
        WHEN i <= 10 THEN 'workshop'::site_type
        WHEN i <= 13 THEN 'base'::site_type
        ELSE 'port'::site_type
      END;
      
      INSERT INTO sites (name, type, location, address, city, country, latitude, longitude, contact_name, contact_phone, manager_id, is_active)
      VALUES (
        'Site DARI ' || i,
        v_site_type,
        'Région ' || CASE WHEN i <= 8 THEN 'Boké' ELSE 'Conakry' END,
        'Adresse Site ' || i,
        CASE WHEN i <= 8 THEN 'Sangaredi' ELSE 'Conakry' END,
        'Guinea',
        11.0 + (random() * 0.2)::NUMERIC,
        -13.8 + (random() * 0.2)::NUMERIC,
        'Responsable ' || i,
        '+224 620' || (111000 + i)::TEXT,
        v_manager_id,
        true
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END $$;
