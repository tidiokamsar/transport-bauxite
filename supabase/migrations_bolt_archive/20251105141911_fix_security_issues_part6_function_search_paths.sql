/*
  # Fix Security Issues - Part 6: Fix Function Search Paths

  Fix mutable search_path in functions for security
*/

-- Fix calculate_employee_payroll function
DROP FUNCTION IF EXISTS calculate_employee_payroll(uuid, date, date);
CREATE OR REPLACE FUNCTION calculate_employee_payroll(
  p_employee_id uuid,
  p_period_start date,
  p_period_end date
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_base_salary numeric;
  v_trips_count integer;
  v_mission_bonus numeric;
  v_overtime_hours numeric;
  v_overtime_pay numeric;
  v_total_bonuses numeric;
  v_gross_salary numeric;
  v_social_security numeric;
  v_tax_amount numeric;
  v_total_deductions numeric;
  v_net_salary numeric;
BEGIN
  -- Get base salary
  SELECT base_salary INTO v_base_salary
  FROM employees
  WHERE id = p_employee_id;

  -- Count completed trips for mission bonus
  SELECT COUNT(*) INTO v_trips_count
  FROM trips
  WHERE driver_id = p_employee_id
    AND status = 'completed'
    AND planned_date BETWEEN p_period_start AND p_period_end;

  -- Calculate mission bonus (50,000 GNF per trip)
  v_mission_bonus := v_trips_count * 50000;

  -- Get overtime hours (simplified)
  v_overtime_hours := 0;
  v_overtime_pay := 0;

  -- Total bonuses
  v_total_bonuses := v_mission_bonus + v_overtime_pay;

  -- Gross salary
  v_gross_salary := v_base_salary + v_total_bonuses;

  -- Calculate deductions
  v_social_security := v_gross_salary * 0.05; -- 5% CNSS
  v_tax_amount := v_gross_salary * 0.05; -- 5% IR
  v_total_deductions := v_social_security + v_tax_amount;

  -- Net salary
  v_net_salary := v_gross_salary - v_total_deductions;

  -- Build result
  v_result := jsonb_build_object(
    'employee_id', p_employee_id,
    'base_salary', v_base_salary,
    'trips_count', v_trips_count,
    'mission_bonus', v_mission_bonus,
    'overtime_hours', v_overtime_hours,
    'overtime_pay', v_overtime_pay,
    'bonuses', v_total_bonuses,
    'gross_salary', v_gross_salary,
    'social_security', v_social_security,
    'tax_amount', v_tax_amount,
    'deductions', v_total_deductions,
    'net_salary', v_net_salary
  );

  RETURN v_result;
END;
$$;

-- Fix generate_payroll_record function
DROP FUNCTION IF EXISTS generate_payroll_record(uuid, date, date);
CREATE OR REPLACE FUNCTION generate_payroll_record(
  p_employee_id uuid,
  p_period_start date,
  p_period_end date
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payroll_data jsonb;
  v_payroll_id uuid;
BEGIN
  -- Calculate payroll
  v_payroll_data := calculate_employee_payroll(p_employee_id, p_period_start, p_period_end);

  -- Insert payroll record
  INSERT INTO payroll_records (
    employee_id,
    period_start,
    period_end,
    base_salary,
    bonuses,
    overtime_pay,
    overtime_hours,
    gross_salary,
    social_security,
    tax_amount,
    deductions,
    net_salary,
    status
  ) VALUES (
    p_employee_id,
    p_period_start,
    p_period_end,
    (v_payroll_data->>'base_salary')::numeric,
    (v_payroll_data->>'bonuses')::numeric,
    (v_payroll_data->>'overtime_pay')::numeric,
    (v_payroll_data->>'overtime_hours')::numeric,
    (v_payroll_data->>'gross_salary')::numeric,
    (v_payroll_data->>'social_security')::numeric,
    (v_payroll_data->>'tax_amount')::numeric,
    (v_payroll_data->>'deductions')::numeric,
    (v_payroll_data->>'net_salary')::numeric,
    'draft'
  )
  RETURNING id INTO v_payroll_id;

  RETURN v_payroll_id;
END;
$$;

DO $$
BEGIN
  RAISE NOTICE '✅ Part 6 Complete: Fixed 2 functions with immutable search_path';
END $$;
