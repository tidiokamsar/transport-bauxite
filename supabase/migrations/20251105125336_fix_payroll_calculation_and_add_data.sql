/*
  # Fix Payroll Calculation Function and Add More Payroll Data

  1. Changes
    - Add SECURITY DEFINER to payroll functions to fix RLS issues
    - Create additional payroll records for more employees
    - Ensure data consistency across modules
    
  2. Data Added
    - More comprehensive payroll records
    - Missing employee payroll for last 3 months
*/

-- Drop and recreate the calculation function with SECURITY DEFINER
DROP FUNCTION IF EXISTS calculate_employee_payroll(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION calculate_employee_payroll(
  p_employee_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS JSON
SECURITY DEFINER -- This allows the function to bypass RLS
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSON;
  v_base_salary NUMERIC := 0;
  v_position TEXT := '';
  v_employee_name TEXT := '';
  v_employee_number TEXT := '';
  
  v_days_present INTEGER := 0;
  v_days_absent INTEGER := 0;
  v_total_hours NUMERIC := 0;
  v_regular_hours NUMERIC := 0;
  v_overtime_hours NUMERIC := 0;
  v_overtime_pay NUMERIC := 0;
  
  v_completed_trips INTEGER := 0;
  v_mission_bonus NUMERIC := 0;
  v_bonus_per_trip NUMERIC := 50000;
  
  v_total_deductions NUMERIC := 0;
  v_social_security NUMERIC := 0;
  v_tax_amount NUMERIC := 0;
  v_late_penalties NUMERIC := 0;
  v_absence_deduction NUMERIC := 0;
  
  v_gross_salary NUMERIC := 0;
  v_net_salary NUMERIC := 0;
  
  v_hours_per_day CONSTANT NUMERIC := 8;
  v_working_days INTEGER;
  v_hourly_rate NUMERIC;
  v_daily_rate NUMERIC;

BEGIN
  -- Load employee information
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
    RAISE EXCEPTION 'Employé non trouvé ou inactif: %', p_employee_id;
  END IF;

  -- Calculate working days
  v_working_days := (
    SELECT COUNT(*)
    FROM generate_series(p_period_start, p_period_end, '1 day'::interval) AS date
    WHERE EXTRACT(DOW FROM date) NOT IN (0, 6)
  );

  v_daily_rate := v_base_salary / NULLIF(v_working_days, 0);
  v_hourly_rate := v_daily_rate / v_hours_per_day;

  -- Load attendance data
  SELECT 
    COUNT(*) FILTER (WHERE status IN ('present', 'late')),
    COUNT(*) FILTER (WHERE status = 'absent'),
    COALESCE(SUM(hours_worked), 0)
  INTO 
    v_days_present,
    v_days_absent,
    v_total_hours
  FROM employee_attendance
  WHERE employee_id = p_employee_id
    AND date BETWEEN p_period_start AND p_period_end;

  -- Default if no attendance data
  IF v_days_present = 0 AND v_days_absent = 0 THEN
    v_days_present := v_working_days;
    v_total_hours := v_working_days * v_hours_per_day;
  END IF;

  -- Calculate regular and overtime hours
  v_regular_hours := LEAST(v_total_hours, v_working_days * v_hours_per_day);
  v_overtime_hours := GREATEST(0, v_total_hours - v_regular_hours);
  v_overtime_pay := v_overtime_hours * v_hourly_rate * 1.5;

  -- Calculate mission bonus for drivers
  IF v_position ILIKE '%chauffeur%' OR v_position ILIKE '%driver%' THEN
    SELECT COUNT(*)
    INTO v_completed_trips
    FROM trips t
    WHERE t.driver_id = p_employee_id
      AND t.status = 'completed'
      AND t.actual_arrival_time BETWEEN p_period_start AND p_period_end;

    v_mission_bonus := v_completed_trips * v_bonus_per_trip;
  END IF;

  -- Calculate deductions
  v_social_security := v_base_salary * 0.025;  -- 2.5%
  
  -- Late penalties
  SELECT COUNT(*) * 5000
  INTO v_late_penalties
  FROM employee_attendance
  WHERE employee_id = p_employee_id
    AND date BETWEEN p_period_start AND p_period_end
    AND status = 'late';

  -- Absence deduction
  v_absence_deduction := v_days_absent * v_daily_rate;

  -- Calculate gross and net
  v_gross_salary := (v_base_salary * v_days_present / NULLIF(v_working_days, 1)) + v_overtime_pay + v_mission_bonus;
  v_tax_amount := v_gross_salary * 0.155;  -- 15.5%
  v_total_deductions := v_social_security + v_tax_amount + v_late_penalties + v_absence_deduction + (v_gross_salary * 0.005);
  v_net_salary := v_gross_salary - v_total_deductions;

  -- Build result JSON
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
        'Salaire: ' || ROUND(v_gross_salary)::TEXT || ' GNF' ||
        CASE WHEN v_completed_trips > 0 THEN
          ' | Missions: ' || v_completed_trips::TEXT || ' × 50k'
        ELSE '' END ||
        ' | Présent: ' || v_days_present::TEXT || '/' || v_working_days::TEXT ||
        ' | Net: ' || ROUND(v_net_salary)::TEXT || ' GNF'
    )
  );

  RETURN v_result;
END;
$$;

-- Drop and recreate generate function with SECURITY DEFINER
DROP FUNCTION IF EXISTS generate_payroll_record(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION generate_payroll_record(
  p_employee_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS UUID
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  v_calc JSON;
  v_payroll_id UUID;
BEGIN
  -- Calculate payroll
  v_calc := calculate_employee_payroll(p_employee_id, p_period_start, p_period_end);

  -- Insert payroll record
  INSERT INTO payroll_records (
    employee_id,
    period_start,
    period_end,
    base_salary,
    overtime_pay,
    bonuses,
    deductions,
    social_security,
    tax_amount,
    net_salary,
    days_worked,
    days_absent,
    hours_worked,
    overtime_hours,
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
    (v_calc->'deductions'->>'total_deductions')::NUMERIC,
    (v_calc->'deductions'->>'social_security')::NUMERIC,
    (v_calc->'deductions'->>'tax_amount')::NUMERIC,
    (v_calc->'final'->>'net_salary')::NUMERIC,
    (v_calc->'attendance'->>'days_present')::INTEGER,
    (v_calc->'attendance'->>'days_absent')::INTEGER,
    (v_calc->'attendance'->>'total_hours')::NUMERIC,
    (v_calc->'attendance'->>'overtime_hours')::NUMERIC,
    'pending',
    'Virement bancaire',
    v_calc->'details'->>'calculation_notes'
  )
  ON CONFLICT (employee_id, period_start, period_end) 
  DO UPDATE SET
    base_salary = EXCLUDED.base_salary,
    overtime_pay = EXCLUDED.overtime_pay,
    bonuses = EXCLUDED.bonuses,
    deductions = EXCLUDED.deductions,
    net_salary = EXCLUDED.net_salary,
    notes = EXCLUDED.notes
  RETURNING id INTO v_payroll_id;

  -- Add bonus details if applicable
  IF (v_calc->'salary'->>'mission_bonus')::NUMERIC > 0 THEN
    INSERT INTO payroll_bonuses (payroll_record_id, bonus_type, amount, description)
    VALUES (
      v_payroll_id,
      'mission_completion',
      (v_calc->'salary'->>'mission_bonus')::NUMERIC,
      (v_calc->'missions'->>'completed_trips')::TEXT || ' missions complétées'
    )
    ON CONFLICT (payroll_record_id, bonus_type) 
    DO UPDATE SET amount = EXCLUDED.amount, description = EXCLUDED.description;
  END IF;

  RETURN v_payroll_id;
END;
$$;

-- Add more payroll data for employees without records
DO $$
DECLARE
  emp_rec RECORD;
  month_start DATE;
  month_end DATE;
  created_count INTEGER := 0;
BEGIN
  -- For each active employee
  FOR emp_rec IN 
    SELECT id, employee_number, first_name, last_name
    FROM employees 
    WHERE status = 'active'
    AND id NOT IN (
      SELECT DISTINCT employee_id 
      FROM payroll_records 
      WHERE period_start >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '2 months')
    )
    LIMIT 20
  LOOP
    -- Generate payroll for last 3 months
    FOR i IN 0..2 LOOP
      month_start := DATE_TRUNC('month', CURRENT_DATE - (i || ' months')::INTERVAL)::DATE;
      month_end := (month_start + INTERVAL '1 month - 1 day')::DATE;
      
      BEGIN
        PERFORM generate_payroll_record(emp_rec.id, month_start, month_end);
        created_count := created_count + 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error creating payroll for % %: %', emp_rec.first_name, emp_rec.last_name, SQLERRM;
      END;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Created % payroll records', created_count;
END $$;

-- Verify payroll data
SELECT 
  COUNT(*) as total_payroll_records,
  COUNT(DISTINCT employee_id) as unique_employees,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'approved') as approved,
  COUNT(*) FILTER (WHERE status = 'paid') as paid,
  MIN(period_start) as earliest_period,
  MAX(period_end) as latest_period
FROM payroll_records;
