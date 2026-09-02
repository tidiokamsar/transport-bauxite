/*
  # Seed Attendance and Payroll Data

  1. Purpose
    - Add comprehensive attendance records for all employees (last 60 days)
    - Generate payroll records for the last 3 months
    - Ensure data consistency with existing trips and employees

  2. Attendance Data
    - Daily attendance for all active employees
    - Mix of present, absent, late statuses
    - Check-in/out times with realistic patterns
    - Higher attendance for drivers with active missions

  3. Payroll Data
    - Monthly payroll for last 3 months (September, October, November 2025)
    - Base salary from employee records
    - Overtime based on actual hours worked
    - Mission completion bonuses for drivers
    - Tax and social security deductions (18% total)
    - Realistic vacation days and absences

  4. Data Coherence
    - Drivers with more trips get mission bonuses
    - Attendance affects payroll calculations
    - Progressive status from pending → approved → paid
*/

-- ============================================================================
-- PART 1: ATTENDANCE DATA (Last 60 days)
-- ============================================================================

DO $$
DECLARE
  emp RECORD;
  attendance_date DATE;
  days_back INTEGER;
  attendance_status TEXT;
  check_in_time TIME;
  check_out_time TIME;
  total_hours NUMERIC;
  is_weekend BOOLEAN;
  random_val NUMERIC;
BEGIN
  -- Loop through all active employees
  FOR emp IN
    SELECT id, employee_number, position
    FROM employees
    WHERE status = 'active'
  LOOP
    -- Generate attendance for last 60 days
    FOR days_back IN 0..59 LOOP
      attendance_date := CURRENT_DATE - days_back;

      -- Check if weekend (skip some attendance)
      is_weekend := EXTRACT(DOW FROM attendance_date) IN (0, 6);

      -- Generate random value for status determination
      random_val := random();

      -- Determine attendance status (higher presence rate for drivers)
      IF is_weekend THEN
        -- Fewer people work on weekends
        IF random_val < 0.3 THEN
          attendance_status := 'present';
        ELSIF random_val < 0.5 THEN
          attendance_status := 'late';
        ELSE
          attendance_status := 'absent';
        END IF;
      ELSE
        -- Weekday attendance (drivers have better attendance)
        IF emp.position LIKE '%Chauffeur%' THEN
          IF random_val < 0.85 THEN
            attendance_status := 'present';
          ELSIF random_val < 0.92 THEN
            attendance_status := 'late';
          ELSE
            attendance_status := 'absent';
          END IF;
        ELSE
          IF random_val < 0.75 THEN
            attendance_status := 'present';
          ELSIF random_val < 0.85 THEN
            attendance_status := 'late';
          ELSE
            attendance_status := 'absent';
          END IF;
        END IF;
      END IF;

      -- Set check-in/out times based on status
      IF attendance_status = 'present' THEN
        check_in_time := '07:00:00'::TIME + (random() * interval '30 minutes');
        check_out_time := '17:00:00'::TIME + (random() * interval '1 hour');
        total_hours := EXTRACT(EPOCH FROM (check_out_time - check_in_time)) / 3600;
      ELSIF attendance_status = 'late' THEN
        check_in_time := '08:00:00'::TIME + (random() * interval '45 minutes');
        check_out_time := '17:00:00'::TIME + (random() * interval '1 hour');
        total_hours := EXTRACT(EPOCH FROM (check_out_time - check_in_time)) / 3600;
      ELSE
        check_in_time := NULL;
        check_out_time := NULL;
        total_hours := 0;
      END IF;

      -- Insert attendance record
      INSERT INTO employee_attendance (
        employee_id,
        date,
        status,
        check_in_time,
        check_out_time,
        total_hours,
        notes
      ) VALUES (
        emp.id,
        attendance_date,
        attendance_status,
        check_in_time,
        check_out_time,
        total_hours,
        CASE
          WHEN attendance_status = 'absent' AND random() < 0.3 THEN 'Congé maladie'
          WHEN attendance_status = 'absent' AND random() < 0.5 THEN 'Congé personnel'
          WHEN attendance_status = 'late' THEN 'Retard trafic'
          ELSE NULL
        END
      )
      ON CONFLICT (employee_id, date) DO NOTHING;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Attendance records created successfully';
END $$;

-- ============================================================================
-- PART 2: PAYROLL DATA (Last 3 months: Sep, Oct, Nov 2025)
-- ============================================================================

DO $$
DECLARE
  emp RECORD;
  month_offset INTEGER;
  period_start DATE;
  period_end DATE;
  days_worked INTEGER;
  days_absent INTEGER;
  hours_worked NUMERIC;
  overtime_hours NUMERIC;
  base_salary NUMERIC;
  overtime_pay NUMERIC;
  bonuses NUMERIC;
  mission_count INTEGER;
  deductions NUMERIC;
  tax_amount NUMERIC;
  social_security NUMERIC;
  gross_salary NUMERIC;
  net_salary NUMERIC;
  payroll_status TEXT;
  approval_date TIMESTAMP;
  payment_date TIMESTAMP;
BEGIN
  -- Loop through all active employees
  FOR emp IN
    SELECT
      e.id,
      e.employee_number,
      e.first_name,
      e.last_name,
      e.position,
      e.base_salary,
      e.hire_date
    FROM employees e
    WHERE e.status = 'active'
  LOOP
    -- Generate payroll for last 3 months (0=current, 1=last month, 2=2 months ago)
    FOR month_offset IN 0..2 LOOP
      -- Calculate period dates
      period_start := DATE_TRUNC('month', CURRENT_DATE - (month_offset || ' months')::INTERVAL)::DATE;
      period_end := (DATE_TRUNC('month', period_start) + INTERVAL '1 month - 1 day')::DATE;

      -- Skip if employee was not hired yet
      CONTINUE WHEN emp.hire_date > period_end;

      -- Get attendance stats for the period
      SELECT
        COUNT(*) FILTER (WHERE status IN ('present', 'late')),
        COUNT(*) FILTER (WHERE status = 'absent'),
        COALESCE(SUM(total_hours), 0)
      INTO days_worked, days_absent, hours_worked
      FROM employee_attendance
      WHERE employee_id = emp.id
        AND date BETWEEN period_start AND period_end;

      -- Set defaults if no attendance data
      IF days_worked IS NULL OR days_worked = 0 THEN
        days_worked := 22; -- Standard work days
        days_absent := 0;
        hours_worked := 176; -- 22 days * 8 hours
      END IF;

      -- Calculate overtime (hours beyond 176/month = 22 days * 8h)
      overtime_hours := GREATEST(0, hours_worked - 176);

      -- Base salary (prorated if absent days)
      base_salary := emp.base_salary * (days_worked::NUMERIC / 22);

      -- Overtime pay (1.5x hourly rate)
      overtime_pay := (emp.base_salary / 176) * 1.5 * overtime_hours;

      -- Bonuses (mission completion for drivers)
      bonuses := 0;
      IF emp.position LIKE '%Chauffeur%' THEN
        -- Count missions completed in this period
        SELECT COUNT(*)
        INTO mission_count
        FROM trips
        WHERE driver_id = emp.id
          AND status = 'completed'
          AND actual_arrival_time BETWEEN period_start AND period_end;

        -- Bonus: 50,000 GNF per completed trip
        bonuses := mission_count * 50000;
      END IF;

      -- Add random performance bonus (5-10% of base for good performers)
      IF random() < 0.6 AND days_absent <= 2 THEN
        bonuses := bonuses + (emp.base_salary * (0.05 + random() * 0.05));
      END IF;

      -- Calculate gross salary
      gross_salary := base_salary + overtime_pay + bonuses;

      -- Deductions: Social security (2.5%), Tax (15.5%), Other (0.5%)
      social_security := gross_salary * 0.025;
      tax_amount := gross_salary * 0.155;
      deductions := gross_salary * 0.005; -- Other deductions

      -- Calculate net salary
      net_salary := gross_salary - social_security - tax_amount - deductions;

      -- Determine payroll status based on month
      IF month_offset = 0 THEN
        payroll_status := 'pending';
        approval_date := NULL;
        payment_date := NULL;
      ELSIF month_offset = 1 THEN
        payroll_status := 'approved';
        approval_date := period_end + INTERVAL '5 days';
        payment_date := NULL;
      ELSE
        payroll_status := 'paid';
        approval_date := period_end + INTERVAL '5 days';
        payment_date := period_end + INTERVAL '7 days';
      END IF;

      -- Insert payroll record
      INSERT INTO payroll_records (
        employee_id,
        period_start,
        period_end,
        days_worked,
        days_absent,
        hours_worked,
        overtime_hours,
        base_salary,
        overtime_pay,
        bonuses,
        deductions,
        tax_amount,
        social_security,
        gross_salary,
        net_salary,
        status,
        approval_date,
        payment_date,
        notes
      ) VALUES (
        emp.id,
        period_start,
        period_end,
        days_worked,
        days_absent,
        hours_worked,
        overtime_hours,
        base_salary,
        overtime_pay,
        bonuses,
        deductions,
        tax_amount,
        social_security,
        gross_salary,
        net_salary,
        payroll_status,
        approval_date,
        payment_date,
        CASE
          WHEN mission_count > 0 THEN
            'Inclut prime missions: ' || mission_count || ' trajets complétés'
          ELSE NULL
        END
      )
      ON CONFLICT (employee_id, period_start) DO UPDATE SET
        days_worked = EXCLUDED.days_worked,
        hours_worked = EXCLUDED.hours_worked,
        bonuses = EXCLUDED.bonuses,
        net_salary = EXCLUDED.net_salary,
        notes = EXCLUDED.notes;

    END LOOP;
  END LOOP;

  RAISE NOTICE 'Payroll records created successfully';
END $$;

-- ============================================================================
-- PART 3: PAYROLL BONUSES (Detail mission bonuses for drivers)
-- ============================================================================

DO $$
DECLARE
  payroll_rec RECORD;
  trip_rec RECORD;
  bonus_amount NUMERIC;
BEGIN
  -- For each payroll record with missions
  FOR payroll_rec IN
    SELECT
      pr.id as payroll_id,
      pr.employee_id,
      pr.period_start,
      pr.period_end,
      e.position
    FROM payroll_records pr
    JOIN employees e ON e.id = pr.employee_id
    WHERE e.position LIKE '%Chauffeur%'
      AND pr.bonuses > 0
  LOOP
    -- Get completed trips in this period
    FOR trip_rec IN
      SELECT t.id, t.reference, t.net_weight
      FROM trips t
      WHERE t.driver_id = payroll_rec.employee_id
        AND t.status = 'completed'
        AND t.actual_arrival_time BETWEEN payroll_rec.period_start AND payroll_rec.period_end
      LIMIT 20 -- Max 20 bonuses per month
    LOOP
      -- Base bonus 50k + weight bonus (2k per ton)
      bonus_amount := 50000 + COALESCE(trip_rec.net_weight * 2000, 0);

      -- Insert bonus detail
      INSERT INTO payroll_bonuses (
        payroll_id,
        bonus_type,
        amount,
        description
      ) VALUES (
        payroll_rec.payroll_id,
        'mission_completion',
        bonus_amount,
        'Mission ' || trip_rec.reference || ' - ' || COALESCE(trip_rec.net_weight::TEXT || 'T', 'N/A')
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Payroll bonuses created successfully';
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Count records created
DO $$
DECLARE
  attendance_count INTEGER;
  payroll_count INTEGER;
  bonus_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO attendance_count FROM employee_attendance;
  SELECT COUNT(*) INTO payroll_count FROM payroll_records;
  SELECT COUNT(*) INTO bonus_count FROM payroll_bonuses;

  RAISE NOTICE '=== DATA SEEDING COMPLETE ===';
  RAISE NOTICE 'Attendance records: %', attendance_count;
  RAISE NOTICE 'Payroll records: %', payroll_count;
  RAISE NOTICE 'Bonus details: %', bonus_count;
END $$;
