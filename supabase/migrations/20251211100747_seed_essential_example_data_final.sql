/*
  # Ajout de données essentielles pour tous les modules principaux

  1. Tables de configuration
    - work_shifts, departments, cost_categories, stock_categories
    - fuel_types, tire_brands, tire_suppliers
    
  2. Tables opérationnelles
    - clients, trailers, vehicle_documents
    - dispatch_assignments, settings, invoice_items
    
  3. Tables IoT et suivi
    - iot_devices, geofence_zones
    
  4. Tables analytiques
    - carbon_emissions, alert_subscriptions
*/

-- 1. WORK SHIFTS
INSERT INTO work_shifts (name, display_name, start_time, end_time, shift_order, color, is_active) VALUES
('morning', 'Matin (6h-14h)', '06:00:00', '14:00:00', 1, '#FFA500', true),
('afternoon', 'Après-midi (14h-22h)', '14:00:00', '22:00:00', 2, '#4169E1', true),
('night', 'Nuit (22h-6h)', '22:00:00', '06:00:00', 3, '#483D8B', true)
ON CONFLICT (name) DO NOTHING;

-- 2. DEPARTMENTS
INSERT INTO departments (id, name, description) VALUES
(gen_random_uuid(), 'Direction', 'Direction générale'),
(gen_random_uuid(), 'Exploitation', 'Opérations et transport'),
(gen_random_uuid(), 'Maintenance', 'Atelier et maintenance'),
(gen_random_uuid(), 'Logistique', 'Approvisionnement et stocks'),
(gen_random_uuid(), 'Comptabilité', 'Finance et comptabilité'),
(gen_random_uuid(), 'Ressources Humaines', 'RH et administration')
ON CONFLICT DO NOTHING;

-- 3. COST CATEGORIES
INSERT INTO cost_categories (id, name, type, description) VALUES
(gen_random_uuid(), 'Carburant', 'variable', 'Coûts de carburant'),
(gen_random_uuid(), 'Maintenance', 'variable', 'Réparations et entretien'),
(gen_random_uuid(), 'Pièces détachées', 'variable', 'Pièces de rechange'),
(gen_random_uuid(), 'Salaires', 'fixed', 'Salaires du personnel'),
(gen_random_uuid(), 'Assurances', 'fixed', 'Assurances véhicules'),
(gen_random_uuid(), 'Taxes', 'fixed', 'Taxes et impôts')
ON CONFLICT DO NOTHING;

-- 4. STOCK CATEGORIES
INSERT INTO stock_categories (id, name, description) VALUES
(gen_random_uuid(), 'Filtres', 'Filtres à huile, air, carburant'),
(gen_random_uuid(), 'Fluides', 'Huiles, liquides de refroidissement'),
(gen_random_uuid(), 'Pneus', 'Pneumatiques et chambres à air'),
(gen_random_uuid(), 'Électricité', 'Batteries, alternateurs, démarreurs'),
(gen_random_uuid(), 'Freinage', 'Plaquettes, disques, liquide de frein')
ON CONFLICT DO NOTHING;

-- 5. FUEL TYPES
INSERT INTO fuel_types (id, name, unit, active) VALUES
(gen_random_uuid(), 'Diesel', 'litres', true),
(gen_random_uuid(), 'Essence', 'litres', true),
(gen_random_uuid(), 'Gas-oil', 'litres', true)
ON CONFLICT (name) DO NOTHING;

-- 6. TIRE BRANDS
INSERT INTO tire_brands (id, name, country_origin, is_active, average_quality_rating) VALUES
(gen_random_uuid(), 'Michelin', 'France', true, 4.5),
(gen_random_uuid(), 'Bridgestone', 'Japon', true, 4.3),
(gen_random_uuid(), 'Goodyear', 'USA', true, 4.2),
(gen_random_uuid(), 'Triangle', 'Chine', true, 3.8),
(gen_random_uuid(), 'Westlake', 'Chine', true, 3.6)
ON CONFLICT (name) DO NOTHING;

-- 7. TIRE SUPPLIERS
INSERT INTO tire_suppliers (id, name, is_local_importer, lead_time_port_to_site_days, quality_rating, active) VALUES
(gen_random_uuid(), 'SOMATRAG Guinée', true, 15, 4.2, true),
(gen_random_uuid(), 'Total Guinée', true, 10, 4.5, true),
(gen_random_uuid(), 'Import Direct Chine', false, 45, 3.8, true)
ON CONFLICT DO NOTHING;

-- 8. CLIENTS
INSERT INTO clients (id, name, contract_reference, rate_per_tonne, payment_terms_days, active) 
SELECT gen_random_uuid(), 'CBK - Compagnie des Bauxites de Kindia', 'CBK-2024-001', 12500, 30, true
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE contract_reference = 'CBK-2024-001');

INSERT INTO clients (id, name, contract_reference, rate_per_tonne, payment_terms_days, active)
SELECT gen_random_uuid(), 'SMB - Société Minière de Boké', 'SMB-2024-002', 13000, 45, true
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE contract_reference = 'SMB-2024-002');

-- 9. TRAILERS
INSERT INTO trailers (id, registration, capacity_tonnes, status) VALUES
('a1111111-1111-1111-1111-111111111111', 'REM-001-GN', 40, 'active'),
('a2222222-2222-2222-2222-222222222222', 'REM-002-GN', 40, 'active'),
('a3333333-3333-3333-3333-333333333333', 'REM-003-GN', 35, 'active'),
('a4444444-4444-4444-4444-444444444444', 'REM-004-GN', 40, 'maintenance')
ON CONFLICT (registration) DO NOTHING;

-- 10. IOT DEVICES
DO $$
DECLARE
  v_vehicle RECORD;
  v_device_id TEXT;
BEGIN
  FOR v_vehicle IN (SELECT id, registration FROM vehicles LIMIT 50) LOOP
    v_device_id := 'GPS-' || substring(v_vehicle.registration from 1 for 15);
    INSERT INTO iot_devices (device_id, device_type, manufacturer, model, vehicle_id, installation_date, status)
    VALUES (v_device_id, 'gps_tracker', 'Teltonika', 'FMB920', v_vehicle.id, CURRENT_DATE - (random() * 365)::int, 'active')
    ON CONFLICT (device_id) DO NOTHING;
  END LOOP;
END $$;

-- 11. GEOFENCE ZONES
INSERT INTO geofence_zones (
  id, name, description, zone_type, geometry_type,
  center_lat, center_lng, radius_meters, color, is_active,
  alert_on_entry, alert_on_exit
)
SELECT
  gen_random_uuid(),
  s.name || ' - Zone',
  'Périmètre de ' || s.name,
  CASE s.type
    WHEN 'mine' THEN 'mine'::text
    WHEN 'port' THEN 'depot'::text
    WHEN 'depot' THEN 'depot'::text
    WHEN 'workshop' THEN 'maintenance'::text
    ELSE 'depot'::text
  END,
  'circle',
  s.latitude,
  s.longitude,
  2000,
  '#3B82F6',
  true,
  true,
  true
FROM sites s
WHERE s.latitude IS NOT NULL AND s.longitude IS NOT NULL
ON CONFLICT DO NOTHING;

-- 12. VEHICLE DOCUMENTS
DO $$
DECLARE
  v_vehicle RECORD;
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    FOR v_vehicle IN (SELECT id FROM vehicles ORDER BY created_at DESC LIMIT 30) LOOP
      INSERT INTO vehicle_documents (
        vehicle_id, document_type, document_name, reference_number,
        issue_date, expiry_date, status, cost, uploaded_by
      ) VALUES (
        v_vehicle.id, 'insurance', 'Assurance 2024',
        'ASS-' || substring(md5(random()::text) from 1 for 8),
        CURRENT_DATE - 180, CURRENT_DATE + 185, 'active', 2500000, v_user_id
      );
      
      INSERT INTO vehicle_documents (
        vehicle_id, document_type, document_name, reference_number,
        issue_date, expiry_date, status, cost, uploaded_by
      ) VALUES (
        v_vehicle.id, 'technical_inspection', 'Visite Technique 2024',
        'VT-' || substring(md5(random()::text) from 1 for 8),
        CURRENT_DATE - 90, CURRENT_DATE + 275, 'active', 150000, v_user_id
      );
    END LOOP;
  END IF;
END $$;

-- 13. CARBON EMISSIONS
DO $$
DECLARE
  v_trip RECORD;
BEGIN
  FOR v_trip IN (
    SELECT t.id, t.vehicle_id, t.planned_date, 
           t.km_end - t.km_start as distance
    FROM trips t
    WHERE t.status = 'completed' 
      AND t.km_end IS NOT NULL AND t.km_start IS NOT NULL
    ORDER BY t.planned_date DESC LIMIT 100
  ) LOOP
    INSERT INTO carbon_emissions (
      trip_id, vehicle_id, emission_date,
      fuel_consumed_liters, distance_km, co2_emissions_kg,
      emission_factor, verified
    ) VALUES (
      v_trip.id, v_trip.vehicle_id, v_trip.planned_date,
      (v_trip.distance * 0.35)::numeric, v_trip.distance,
      (v_trip.distance * 0.35 * 2.68)::numeric, 2.68, true
    );
  END LOOP;
END $$;

-- 14. DISPATCH ASSIGNMENTS
DO $$
DECLARE
  v_trip RECORD;
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    FOR v_trip IN (
      SELECT id, vehicle_id, driver_id, planned_date
      FROM trips
      WHERE status IN ('planned', 'in_progress')
      ORDER BY planned_date DESC LIMIT 50
    ) LOOP
      INSERT INTO dispatch_assignments (
        trip_id, vehicle_id, driver_id, assignment_date,
        assignment_type, optimization_score, status, assigned_by
      ) VALUES (
        v_trip.id, v_trip.vehicle_id, v_trip.driver_id, v_trip.planned_date,
        'automatic', 85 + (random() * 10)::numeric,
        CASE WHEN random() < 0.7 THEN 'accepted' WHEN random() < 0.9 THEN 'in_progress' ELSE 'assigned' END,
        v_user_id
      );
    END LOOP;
  END IF;
END $$;

-- 15. SETTINGS
INSERT INTO settings (key, value, category, description) VALUES
('company_name', '"DARI HOLDING - Transport Minier"', 'general', 'Nom de l''entreprise'),
('currency', '"GNF"', 'general', 'Devise principale'),
('fuel_alert_threshold', '20', 'fuel', 'Seuil d''alerte carburant (%)'),
('maintenance_alert_days', '7', 'maintenance', 'Jours avant alerte maintenance'),
('default_fuel_price', '10500', 'fuel', 'Prix du carburant par défaut (GNF/L)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 16. INVOICE ITEMS
DO $$
DECLARE
  v_invoice RECORD;
  v_trip RECORD;
  v_item_count INT;
BEGIN
  FOR v_invoice IN (SELECT id, client_id FROM invoices WHERE client_id IS NOT NULL LIMIT 50) LOOP
    v_item_count := 0;
    FOR v_trip IN (
      SELECT id, net_weight, reference
      FROM trips
      WHERE client_id = v_invoice.client_id AND status = 'completed' AND net_weight > 0
      ORDER BY random() LIMIT (5 + (random() * 10)::int)
    ) LOOP
      v_item_count := v_item_count + 1;
      INSERT INTO invoice_items (
        invoice_id, trip_id, description, quantity, unit_price, total_price, item_order
      ) VALUES (
        v_invoice.id, v_trip.id, 'Transport minerai - ' || v_trip.reference,
        v_trip.net_weight, 12500, v_trip.net_weight * 12500, v_item_count
      ) ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- 17. ALERT SUBSCRIPTIONS
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  FOR v_user_id IN (SELECT id FROM auth.users) LOOP
    INSERT INTO alert_subscriptions (user_id, alert_category, min_severity, notification_channels, is_active) VALUES
    (v_user_id, 'fuel', 'warning', ARRAY['in_app', 'email'], true),
    (v_user_id, 'maintenance', 'warning', ARRAY['in_app', 'email'], true),
    (v_user_id, 'safety', 'critical', ARRAY['in_app', 'email', 'sms'], true)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- 18. STOCK MOVEMENTS (Pour les articles existants)
DO $$
DECLARE
  v_item RECORD;
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    FOR v_item IN (SELECT id, quantity FROM stock_items WHERE quantity > 0) LOOP
      INSERT INTO stock_movements (
        item_id, movement_type, quantity, previous_quantity,
        new_quantity, reference, reason, performed_by
      ) VALUES (
        v_item.id, 'entry', v_item.quantity, 0, v_item.quantity,
        'STOCK-INIT-' || substring(md5(random()::text) from 1 for 6),
        'Stock initial', v_user_id
      );
    END LOOP;
  END IF;
END $$;
