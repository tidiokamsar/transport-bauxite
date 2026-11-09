/*
  # Fonction calcul automatique paie complète
  
  Charge automatiquement depuis tous les modules:
  - Salaire de base (employees)
  - Heures supplémentaires (attendance)
  - Primes missions (trips)
  - Nombre de voyages (trips)
  - Présences (attendance)
  - Déductions (automatiques)
*/

CREATE OR REPLACE FUNCTION calculate_employee_payroll(
  p_employee_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_base_salary NUMERIC := 0;
  v_position TEXT := '';
  v_employee_name TEXT := '';
  v_employee_number TEXT := '';
  
  -- Données calculées
  v_days_present INTEGER := 0;
  v_days_absent INTEGER := 0;
  v_total_hours NUMERIC := 0;
  v_regular_hours NUMERIC := 0;
  v_overtime_hours NUMERIC := 0;
  v_overtime_pay NUMERIC := 0;
  
  -- Missions et primes
  v_completed_trips INTEGER := 0;
  v_mission_bonus NUMERIC := 0;
  v_bonus_per_trip NUMERIC := 50000; -- 50,000 GNF par mission
  
  -- Déductions
  v_total_deductions NUMERIC := 0;
  v_social_security NUMERIC := 0;
  v_tax_amount NUMERIC := 0;
  v_late_penalties NUMERIC := 0;
  v_absence_deduction NUMERIC := 0;
  
  -- Calculs finaux
  v_gross_salary NUMERIC := 0;
  v_net_salary NUMERIC := 0;
  
  -- Constantes
  v_hours_per_day CONSTANT NUMERIC := 8;
  v_working_days INTEGER;
  v_hourly_rate NUMERIC;
  v_daily_rate NUMERIC;
  
BEGIN
  -- 1. Charger informations employé
  SELECT 
    base_salary,
    position,
    first_name || ' ' || last_name,
    employee_number
  INTO 
    v_base_salary,
    v_position,
    v_employee_name,
    v_employee_number
  FROM employees
  WHERE id = p_employee_id AND status = 'active';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employé non trouvé ou inactif';
  END IF;
  
  -- Calculer taux horaire et journalier
  v_working_days := (SELECT COUNT(DISTINCT date) 
                     FROM generate_series(p_period_start, p_period_end, '1 day'::interval) date
                     WHERE EXTRACT(DOW FROM date) NOT IN (0, 6)); -- Exclure weekend
  
  v_daily_rate := v_base_salary / NULLIF(v_working_days, 0);
  v_hourly_rate := v_daily_rate / v_hours_per_day;
  
  -- 2. Charger présences depuis attendance OU employee_attendance
  SELECT 
    COUNT(*) FILTER (WHERE status = 'present'),
    COUNT(*) FILTER (WHERE status = 'absent'),
    COALESCE(SUM(hours_worked), 0)
  INTO 
    v_days_present,
    v_days_absent,
    v_total_hours
  FROM employee_attendance
  WHERE employee_id = p_employee_id
    AND date >= p_period_start
    AND date <= p_period_end;
  
  -- Si pas de données dans employee_attendance, essayer attendance (ancienne table)
  IF v_days_present = 0 THEN
    SELECT COUNT(*)
    INTO v_days_present
    FROM attendance
    WHERE employee_id = p_employee_id
      AND date >= p_period_start
      AND date <= p_period_end;
    
    v_total_hours := v_days_present * v_hours_per_day;
  END IF;
  
  -- 3. Calculer heures régulières et supplémentaires
  v_regular_hours := LEAST(v_total_hours, v_working_days * v_hours_per_day);
  v_overtime_hours := GREATEST(0, v_total_hours - v_regular_hours);
  v_overtime_pay := v_overtime_hours * v_hourly_rate * 1.5; -- 150% taux horaire
  
  -- 4. Charger nombre de missions complétées (pour CHAUFFEURS uniquement)
  IF v_position ILIKE '%chauffeur%' OR v_position ILIKE '%driver%' THEN
    SELECT COUNT(*)
    INTO v_completed_trips
    FROM trips t
    WHERE t.driver_id = p_employee_id
      AND t.status = 'completed'
      AND t.planned_date >= p_period_start
      AND t.planned_date <= p_period_end;
    
    v_mission_bonus := v_completed_trips * v_bonus_per_trip;
  END IF;
  
  -- 5. Calculer déductions
  
  -- Sécurité sociale (8% du salaire de base)
  v_social_security := v_base_salary * 0.08;
  
  -- Pénalités retards (5000 GNF par retard)
  SELECT COUNT(*) * 5000
  INTO v_late_penalties
  FROM employee_attendance
  WHERE employee_id = p_employee_id
    AND date >= p_period_start
    AND date <= p_period_end
    AND status = 'late';
  
  -- Déduction absences (prorata du salaire journalier)
  v_absence_deduction := v_days_absent * v_daily_rate;
  
  -- Total déductions
  v_total_deductions := v_social_security + v_late_penalties + v_absence_deduction;
  
  -- 6. Calculer salaire brut
  v_gross_salary := v_base_salary + v_overtime_pay + v_mission_bonus;
  
  -- 7. Calculer impôts (5% du brut après sécurité sociale)
  v_tax_amount := (v_gross_salary - v_social_security) * 0.05;
  
  -- 8. Calculer salaire net
  v_net_salary := v_gross_salary - v_total_deductions - v_tax_amount;
  
  -- 9. Construire résultat JSON avec TOUTES les données
  v_result := json_build_object(
    'employee', json_build_object(
      'id', p_employee_id,
      'name', v_employee_name,
      'number', v_employee_number,
      'position', v_position
    ),
    'period', json_build_object(
      'start', p_period_start,
      'end', p_period_end,
      'working_days', v_working_days
    ),
    'attendance', json_build_object(
      'days_present', v_days_present,
      'days_absent', v_days_absent,
      'total_hours', v_total_hours,
      'regular_hours', v_regular_hours,
      'overtime_hours', v_overtime_hours
    ),
    'missions', json_build_object(
      'completed_trips', v_completed_trips,
      'bonus_per_trip', v_bonus_per_trip,
      'total_mission_bonus', v_mission_bonus
    ),
    'salary', json_build_object(
      'base_salary', v_base_salary,
      'overtime_pay', v_overtime_pay,
      'mission_bonus', v_mission_bonus,
      'gross_salary', v_gross_salary
    ),
    'deductions', json_build_object(
      'social_security', v_social_security,
      'tax_amount', v_tax_amount,
      'late_penalties', v_late_penalties,
      'absence_deduction', v_absence_deduction,
      'total_deductions', v_total_deductions
    ),
    'final', json_build_object(
      'net_salary', v_net_salary
    ),
    'details', json_build_object(
      'hourly_rate', v_hourly_rate,
      'daily_rate', v_daily_rate,
      'calculation_notes', 
        'Salaire de base: ' || v_base_salary::TEXT || ' GNF' ||
        ' | Heures supp: ' || v_overtime_hours::TEXT || 'h × ' || ROUND(v_hourly_rate * 1.5)::TEXT || ' = ' || v_overtime_pay::TEXT || ' GNF' ||
        CASE WHEN v_completed_trips > 0 THEN
          ' | Missions: ' || v_completed_trips::TEXT || ' × ' || v_bonus_per_trip::TEXT || ' = ' || v_mission_bonus::TEXT || ' GNF'
        ELSE '' END ||
        ' | Jours présents: ' || v_days_present::TEXT || '/' || v_working_days::TEXT ||
        CASE WHEN v_days_absent > 0 THEN ' | Absences: -' || v_absence_deduction::TEXT || ' GNF' ELSE '' END ||
        CASE WHEN v_late_penalties > 0 THEN ' | Retards: -' || v_late_penalties::TEXT || ' GNF' ELSE '' END
    )
  );
  
  RETURN v_result;
  
END;
$$ LANGUAGE plpgsql;

-- Fonction helper pour générer paie automatique et l'insérer
CREATE OR REPLACE FUNCTION generate_payroll_record(
  p_employee_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS UUID AS $$
DECLARE
  v_calc JSON;
  v_payroll_id UUID;
BEGIN
  -- Calculer la paie
  v_calc := calculate_employee_payroll(p_employee_id, p_period_start, p_period_end);
  
  -- Insérer dans payroll_records
  INSERT INTO payroll_records (
    employee_id,
    period_start,
    period_end,
    base_salary,
    overtime_pay,
    bonuses,
    gross_salary,
    deductions,
    social_security,
    tax_amount,
    net_salary,
    status,
    payment_method,
    notes
  )
  VALUES (
    p_employee_id,
    p_period_start,
    p_period_end,
    (v_calc->'salary'->>'base_salary')::NUMERIC,
    (v_calc->'salary'->>'overtime_pay')::NUMERIC,
    (v_calc->'salary'->>'mission_bonus')::NUMERIC,
    (v_calc->'salary'->>'gross_salary')::NUMERIC,
    (v_calc->'deductions'->>'total_deductions')::NUMERIC,
    (v_calc->'deductions'->>'social_security')::NUMERIC,
    (v_calc->'deductions'->>'tax_amount')::NUMERIC,
    (v_calc->'final'->>'net_salary')::NUMERIC,
    'draft',
    'Virement bancaire',
    v_calc->'details'->>'calculation_notes'
  )
  RETURNING id INTO v_payroll_id;
  
  -- Insérer les bonus détaillés
  IF (v_calc->'salary'->>'mission_bonus')::NUMERIC > 0 THEN
    INSERT INTO payroll_bonuses (payroll_record_id, bonus_type, amount, description)
    VALUES (
      v_payroll_id,
      'Prime missions',
      (v_calc->'salary'->>'mission_bonus')::NUMERIC,
      (v_calc->'missions'->>'completed_trips')::TEXT || ' missions × ' || 
      (v_calc->'missions'->>'bonus_per_trip')::TEXT || ' GNF'
    );
  END IF;
  
  -- Insérer déductions détaillées
  INSERT INTO payroll_deductions (payroll_record_id, deduction_type, amount, description)
  VALUES 
    (v_payroll_id, 'Sécurité sociale', (v_calc->'deductions'->>'social_security')::NUMERIC, '8% du salaire de base'),
    (v_payroll_id, 'Impôts', (v_calc->'deductions'->>'tax_amount')::NUMERIC, '5% du brut après SS');
  
  IF (v_calc->'deductions'->>'late_penalties')::NUMERIC > 0 THEN
    INSERT INTO payroll_deductions (payroll_record_id, deduction_type, amount, description)
    VALUES (v_payroll_id, 'Pénalités retards', (v_calc->'deductions'->>'late_penalties')::NUMERIC, 'Retards période');
  END IF;
  
  IF (v_calc->'deductions'->>'absence_deduction')::NUMERIC > 0 THEN
    INSERT INTO payroll_deductions (payroll_record_id, deduction_type, amount, description)
    VALUES (v_payroll_id, 'Absences', (v_calc->'deductions'->>'absence_deduction')::NUMERIC, 
            (v_calc->'attendance'->>'days_absent')::TEXT || ' jours');
  END IF;
  
  RETURN v_payroll_id;
END;
$$ LANGUAGE plpgsql;
