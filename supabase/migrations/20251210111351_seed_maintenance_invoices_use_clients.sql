/*
  # Seed Maintenance Orders and Invoices - Use Clients Table
  
  1. Seed Data Created
    - 300+ maintenance orders
    - 150+ invoices using clients table
    
  2. Notes
    - Uses existing clients (not customers)
    - Proper payment_status enum
    - Tonnage-based invoicing for mining
    - GNF currency throughout
*/

-- Seed 300 maintenance orders
DO $$
DECLARE
  v_vehicles UUID[];
  v_sites UUID[];
  v_vehicle_id UUID;
  v_site_id UUID;
  v_maint_type maintenance_type;
  v_maint_status maintenance_status;
  v_workshop workshop_type;
  v_request_date DATE;
  v_scheduled_date DATE;
  v_completion_date DATE;
  v_km NUMERIC;
  v_labor_hours NUMERIC;
  v_labor_cost NUMERIC;
  i INTEGER;
BEGIN
  SELECT ARRAY_AGG(id) INTO v_vehicles FROM vehicles LIMIT 60;
  SELECT ARRAY_AGG(id) INTO v_sites FROM sites LIMIT 10;
  
  IF array_length(v_vehicles, 1) > 0 THEN
    FOR i IN 1..300 LOOP
      v_vehicle_id := v_vehicles[1 + (random() * (array_length(v_vehicles, 1) - 1))::INTEGER];
      v_site_id := CASE WHEN array_length(v_sites, 1) > 0 THEN v_sites[1 + (random() * (array_length(v_sites, 1) - 1))::INTEGER] ELSE NULL END;
      
      v_maint_type := CASE WHEN random() < 0.4 THEN 'preventive'::maintenance_type ELSE 'corrective'::maintenance_type END;
      v_workshop := CASE WHEN random() < 0.7 THEN 'internal'::workshop_type ELSE 'external'::workshop_type END;
      
      v_request_date := (CURRENT_DATE - (random() * 180)::INTEGER)::DATE;
      v_scheduled_date := (v_request_date + (1 + random() * 14)::INTEGER)::DATE;
      
      v_maint_status := CASE 
        WHEN random() < 0.60 THEN 'completed'::maintenance_status
        WHEN random() < 0.80 THEN 'in_progress'::maintenance_status
        WHEN random() < 0.95 THEN 'open'::maintenance_status
        ELSE 'cancelled'::maintenance_status
      END;
      
      v_completion_date := CASE 
        WHEN v_maint_status = 'completed'::maintenance_status THEN (v_scheduled_date + (1 + random() * 7)::INTEGER)::DATE
        ELSE NULL
      END;
      
      SELECT current_km INTO v_km FROM vehicles WHERE id = v_vehicle_id;
      v_km := COALESCE(v_km, 100000) - (random() * 30000)::NUMERIC;
      
      v_labor_hours := (2 + random() * 20)::NUMERIC(5,2);
      v_labor_cost := (v_labor_hours * (50000 + random() * 150000))::NUMERIC;
      
      INSERT INTO maintenance_orders (
        work_order_number,
        title,
        vehicle_id,
        request_date,
        scheduled_date,
        completion_date,
        maintenance_type,
        status,
        workshop,
        priority,
        km_at_maintenance,
        description,
        labor_hours,
        labor_cost,
        site_id
      ) VALUES (
        'WO-' || TO_CHAR(v_request_date, 'YYYYMMDD') || '-' || LPAD(i::TEXT, 4, '0'),
        CASE 
          WHEN v_maint_type = 'preventive'::maintenance_type THEN 
            (ARRAY['Révision périodique complète', 'Vidange moteur et filtres', 'Contrôle freinage système', 'Inspection pneus et suspension', 'Maintenance préventive standard'])[1 + (random() * 4)::INTEGER]
          ELSE
            (ARRAY['Réparation panne moteur', 'Remplacement pièces usées', 'Correction défaut transmission', 'Réparation système électrique', 'Intervention urgente panne'])[1 + (random() * 4)::INTEGER]
        END,
        v_vehicle_id,
        v_request_date,
        v_scheduled_date,
        v_completion_date,
        v_maint_type,
        v_maint_status,
        v_workshop,
        CASE 
          WHEN v_maint_type = 'corrective'::maintenance_type AND random() < 0.3 THEN 'urgent'
          WHEN random() < 0.25 THEN 'high'
          WHEN random() < 0.60 THEN 'medium'
          ELSE 'low'
        END,
        v_km,
        'Intervention maintenance ' || CASE WHEN v_maint_type = 'preventive'::maintenance_type THEN 'préventive' ELSE 'corrective' END || ' - ' || 
        CASE WHEN v_workshop = 'internal'::workshop_type THEN 'Atelier interne' ELSE 'Sous-traitant agréé' END,
        v_labor_hours,
        v_labor_cost,
        v_site_id
      );
    END LOOP;
  END IF;
END $$;

-- Seed 150 invoices using clients table
DO $$
DECLARE
  v_clients UUID[];
  v_client_id UUID;
  v_period_start DATE;
  v_period_end DATE;
  v_invoice_date DATE;
  v_due_date DATE;
  v_tonnage NUMERIC;
  v_unit_rate NUMERIC;
  v_gross_amount NUMERIC;
  v_deductions NUMERIC;
  v_taxes NUMERIC;
  v_net_amount NUMERIC;
  v_amount_paid NUMERIC;
  v_balance_due NUMERIC;
  v_payment_status payment_status;
  i INTEGER;
BEGIN
  SELECT ARRAY_AGG(id) INTO v_clients FROM clients LIMIT 10;
  
  IF array_length(v_clients, 1) > 0 THEN
    FOR i IN 1..150 LOOP
      v_client_id := v_clients[1 + (random() * (array_length(v_clients, 1) - 1))::INTEGER];
      
      v_period_start := (CURRENT_DATE - (random() * 150 + 30)::INTEGER)::DATE;
      v_period_end := (v_period_start + 30)::DATE;
      v_invoice_date := (v_period_end + 2)::DATE;
      v_due_date := (v_invoice_date + 30 + (random() * 30)::INTEGER)::DATE;
      
      v_tonnage := (500 + random() * 4500)::NUMERIC(10,2);
      v_unit_rate := (3000 + random() * 2000)::NUMERIC(10,2);
      v_gross_amount := v_tonnage * v_unit_rate;
      v_deductions := (v_gross_amount * (0.01 + random() * 0.04))::NUMERIC;
      v_taxes := ((v_gross_amount - v_deductions) * 0.18)::NUMERIC;
      v_net_amount := v_gross_amount - v_deductions + v_taxes;
      
      v_payment_status := CASE 
        WHEN random() < 0.65 THEN 'paid'::payment_status
        WHEN random() < 0.85 THEN 'pending'::payment_status
        WHEN random() < 0.95 THEN 'partial'::payment_status
        ELSE 'overdue'::payment_status
      END;
      
      v_amount_paid := CASE 
        WHEN v_payment_status = 'paid'::payment_status THEN v_net_amount
        WHEN v_payment_status = 'partial'::payment_status THEN v_net_amount * (0.3 + random() * 0.5)
        ELSE 0
      END;
      
      v_balance_due := v_net_amount - v_amount_paid;
      
      INSERT INTO invoices (
        invoice_number,
        client_id,
        invoice_date,
        period_start,
        period_end,
        total_tonnage,
        unit_rate,
        gross_amount,
        deductions,
        taxes,
        tax_amount,
        net_amount,
        total_amount,
        amount_paid,
        balance_due,
        payment_status,
        status,
        due_date,
        currency,
        notes
      ) VALUES (
        'INV-' || TO_CHAR(v_invoice_date, 'YYYYMM') || '-' || LPAD(i::TEXT, 5, '0'),
        v_client_id,
        v_invoice_date,
        v_period_start,
        v_period_end,
        v_tonnage,
        v_unit_rate,
        v_gross_amount,
        v_deductions,
        v_taxes,
        v_taxes,
        v_net_amount,
        v_net_amount,
        v_amount_paid,
        v_balance_due,
        v_payment_status,
        CASE 
          WHEN v_payment_status = 'paid'::payment_status THEN 'paid'
          WHEN v_payment_status = 'overdue'::payment_status THEN 'overdue'
          WHEN v_payment_status = 'partial'::payment_status THEN 'partial'
          ELSE 'pending'
        END,
        v_due_date,
        'GNF',
        CASE 
          WHEN v_payment_status = 'overdue'::payment_status THEN 'Paiement en retard - Relance client'
          WHEN v_payment_status = 'partial'::payment_status THEN 'Paiement partiel reçu - Solde à payer: ' || v_balance_due::TEXT || ' GNF'
          WHEN v_payment_status = 'paid'::payment_status THEN 'Facture soldée'
          ELSE 'En attente de paiement'
        END
      );
    END LOOP;
  END IF;
END $$;
