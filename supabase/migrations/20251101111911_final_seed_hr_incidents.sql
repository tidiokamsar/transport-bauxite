/*
  # Final HR and Incidents Seeding
*/

INSERT INTO employees (employee_number, first_name, last_name, position, base_salary, hire_date, phone, email, status)
VALUES
  ('EMP-016', 'Alpha', 'Condé', 'Chauffeur', 3500000, '2023-03-15', '+224 620 11 22 33', 'alpha.conde@fleet.gn', 'active'),
  ('EMP-017', 'Mariama', 'Sylla', 'Chauffeur', 3500000, '2023-04-10', '+224 620 22 33 44', 'mariama.sylla@fleet.gn', 'active'),
  ('EMP-018', 'Sékou', 'Touré', 'Mécanicien', 4200000, '2023-02-20', '+224 620 33 44 55', 'sekou.toure@fleet.gn', 'active'),
  ('EMP-019', 'Hadja', 'Barry', 'Mécanicien', 4200000, '2023-05-01', '+224 620 44 55 66', 'hadja.barry@fleet.gn', 'active'),
  ('EMP-020', 'Thierno', 'Diop', 'Électricien', 4000000, '2023-06-15', '+224 620 55 66 77', 'thierno.diop@fleet.gn', 'active')
ON CONFLICT (employee_number) DO NOTHING;

DO $$
DECLARE emp RECORD;
BEGIN
  FOR emp IN SELECT id FROM employees WHERE status = 'active' LOOP
    FOR i IN 0..59 LOOP
      IF EXTRACT(DOW FROM CURRENT_DATE - i) NOT IN (0, 6) THEN
        INSERT INTO employee_attendance (employee_id, date, status, check_in_time, check_out_time, hours_worked, overtime_hours)
        VALUES (emp.id, CURRENT_DATE - i, 'present', '08:00'::TIME, '17:00'::TIME, 8, 0)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END $$;

DO $$
DECLARE emp RECORD; mo INT; ps DATE; pe DATE;
BEGIN
  FOR emp IN SELECT id, base_salary FROM employees WHERE status = 'active' LOOP
    FOR mo IN 0..1 LOOP
      ps := DATE_TRUNC('month', CURRENT_DATE - (mo || ' months')::INTERVAL)::DATE;
      pe := (ps + INTERVAL '1 month - 1 day')::DATE;
      INSERT INTO payroll_records (
        employee_id, period_start, period_end, base_salary, overtime_pay, bonuses, deductions,
        tax_amount, social_security, net_salary, days_worked, hours_worked, status, payment_method
      ) VALUES (
        emp.id, ps, pe, emp.base_salary, 100000, 50000, 30000,
        emp.base_salary * 0.05, emp.base_salary * 0.08, emp.base_salary * 0.87 + 120000, 22, 176,
        CASE mo WHEN 0 THEN 'pending' ELSE 'paid' END, 'Virement'
      ) ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

DO $$
DECLARE t_id uuid; i INT;
BEGIN
  FOR i IN 1..20 LOOP
    SELECT id INTO t_id FROM trips ORDER BY random() LIMIT 1;
    INSERT INTO incidents (trip_id, incident_time, description, severity, estimated_cost)
    VALUES (t_id, NOW() - (i || ' days')::INTERVAL, 'Incident trajet ' || i, 'moderate'::incident_severity, 1000000 + i * 200000);
  END LOOP;
END $$;
