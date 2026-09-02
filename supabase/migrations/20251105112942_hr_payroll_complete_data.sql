/*
  # Données RH et Paie complètes
*/

DELETE FROM attendance;

DO $$
DECLARE
  emp_id uuid; d DATE; dn INT; pres BOOLEAN; arr TIMESTAMP; dep TIMESTAMP;
BEGIN
  FOR emp_id IN SELECT id FROM employees WHERE status = 'active' LIMIT 99
  LOOP
    FOR dn IN 1..5 LOOP
      d := DATE '2025-11-01' + (dn - 1);
      pres := random() < 0.95;
      
      IF pres THEN
        arr := d + TIME '07:00:00' + (interval '1 minute' * (random() * 60)::int);
        dep := arr + (interval '8 hours') + (interval '1 hour' * (random() * 2)::int);
        
        INSERT INTO attendance (employee_id, date, status, check_in, check_out)
        VALUES (emp_id, d, 'present'::attendance_status, arr, dep);
      ELSE
        INSERT INTO attendance (employee_id, date, status, notes)
        VALUES (emp_id, d, 
          CASE WHEN random() < 0.5 THEN 'absent'::attendance_status ELSE 'sick'::attendance_status END,
          'Absence justifiée');
      END IF;
    END LOOP;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION calculate_mission_bonuses(p_employee_id uuid, p_start date, p_end date)
RETURNS numeric AS $$
  SELECT COUNT(*) * 50000 FROM trips
  WHERE driver_id = p_employee_id AND status = 'completed'
  AND planned_date >= p_start AND planned_date <= p_end;
$$ LANGUAGE sql;

UPDATE payroll_records pr
SET 
  bonuses = calculate_mission_bonuses(pr.employee_id, pr.period_start, pr.period_end),
  notes = (SELECT COUNT(*) || ' missions × 50 000 GNF' FROM trips t 
    WHERE t.driver_id = pr.employee_id AND t.status = 'completed'
    AND t.planned_date >= pr.period_start AND t.planned_date <= pr.period_end),
  days_worked = (SELECT COUNT(*) FROM attendance a 
    WHERE a.employee_id = pr.employee_id AND a.status = 'present'
    AND a.date >= pr.period_start AND a.date <= pr.period_end),
  days_absent = (SELECT COUNT(*) FROM attendance a 
    WHERE a.employee_id = pr.employee_id AND a.status IN ('absent', 'sick')
    AND a.date >= pr.period_start AND a.date <= pr.period_end),
  net_salary = base_salary + COALESCE(overtime_pay, 0) + calculate_mission_bonuses(pr.employee_id, pr.period_start, pr.period_end)
               - COALESCE(deductions, 0) - COALESCE(tax_amount, 0) - COALESCE(social_security, 0)
WHERE pr.period_start = DATE_TRUNC('month', CURRENT_DATE);

DELETE FROM payroll_bonuses WHERE payroll_record_id IN (
  SELECT id FROM payroll_records WHERE period_start = DATE_TRUNC('month', CURRENT_DATE)
);

INSERT INTO payroll_bonuses (payroll_record_id, bonus_type, amount, description)
SELECT pr.id, 'mission_completion', calculate_mission_bonuses(pr.employee_id, pr.period_start, pr.period_end),
  (SELECT COUNT(*) FROM trips WHERE driver_id = pr.employee_id AND status = 'completed' 
   AND planned_date >= pr.period_start AND planned_date <= pr.period_end) || ' missions'
FROM payroll_records pr
WHERE pr.period_start = DATE_TRUNC('month', CURRENT_DATE)
AND EXISTS (SELECT 1 FROM employees WHERE id = pr.employee_id AND position = 'Chauffeur')
AND calculate_mission_bonuses(pr.employee_id, pr.period_start, pr.period_end) > 0;
