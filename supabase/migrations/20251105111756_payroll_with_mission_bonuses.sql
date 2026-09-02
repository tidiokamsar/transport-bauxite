/*
  # Salaires avec primes missions
*/

INSERT INTO departments (name, description)
VALUES ('Chauffeurs', 'Chauffeurs')
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  dept_id uuid;
  d_rec RECORD;
  fn TEXT; ln TEXT; parts TEXT[]; emp_n TEXT; cnt INT := 1;
BEGIN
  SELECT id INTO dept_id FROM departments WHERE name = 'Chauffeurs' LIMIT 1;
  
  FOR d_rec IN SELECT id, name, phone, hire_date FROM drivers WHERE status = 'active' ORDER BY name
  LOOP
    parts := string_to_array(d_rec.name, ' ');
    IF array_length(parts, 1) >= 2 THEN
      fn := parts[1]; ln := array_to_string(parts[2:array_length(parts, 1)], ' ');
    ELSE fn := d_rec.name; ln := ''; END IF;
    
    emp_n := 'DRV-' || LPAD(cnt::text, 4, '0');
    cnt := cnt + 1;
    
    INSERT INTO employees (
      id, employee_number, first_name, last_name, department_id, 
      position, hire_date, base_salary, phone, status
    ) VALUES (
      d_rec.id, emp_n, fn, ln, dept_id, 'Chauffeur', 
      COALESCE(d_rec.hire_date, CURRENT_DATE - INTERVAL '2 years'),
      3500000, d_rec.phone, 'active'
    )
    ON CONFLICT (id) DO UPDATE SET 
      department_id = EXCLUDED.department_id, 
      position = 'Chauffeur',
      employee_number = CASE WHEN employees.employee_number IS NULL OR employees.employee_number = '' 
                             THEN EXCLUDED.employee_number ELSE employees.employee_number END;
  END LOOP;
END $$;

DELETE FROM payroll_bonuses;
DELETE FROM payroll_deductions;
DELETE FROM payroll_records;

DO $$
DECLARE
  e_rec RECORD; m_cnt INT; b_amt NUMERIC; b_sal NUMERIC := 3500000;
  ov_amt NUMERIC; ded NUMERIC; tx NUMERIC; soc NUMERIC; net NUMERIC;
  pr_id uuid; ps DATE := DATE_TRUNC('month', CURRENT_DATE);
  pe DATE := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;
BEGIN
  FOR e_rec IN 
    SELECT 
      e.id,
      COUNT(t.id) FILTER (WHERE t.status = 'completed' AND 
            t.planned_date >= ps AND t.planned_date <= pe) as missions,
      SUM(t.net_weight) FILTER (WHERE t.status = 'completed' AND 
          t.planned_date >= ps AND t.planned_date <= pe) as tonnage
    FROM employees e
    LEFT JOIN trips t ON t.driver_id = e.id
    WHERE e.position = 'Chauffeur' AND e.status = 'active'
    GROUP BY e.id
  LOOP
    m_cnt := COALESCE(e_rec.missions, 0);
    b_amt := m_cnt * 50000;
    ov_amt := CASE WHEN m_cnt > 20 THEN (m_cnt - 20) * 25000 ELSE 0 END;
    soc := b_sal * 0.05;
    tx := (b_sal + b_amt + ov_amt) * 0.10;
    ded := 50000 + (random() * 100000)::numeric;
    net := b_sal + b_amt + ov_amt - soc - tx - ded;
    
    INSERT INTO payroll_records (
      employee_id, period_start, period_end, base_salary, overtime_pay, bonuses, deductions, 
      tax_amount, social_security, net_salary, days_worked, days_absent, hours_worked, 
      overtime_hours, status, payment_date, payment_method, notes
    ) VALUES (
      e_rec.id, ps, pe, b_sal, ov_amt, b_amt, ded, tx, soc, net,
      CASE WHEN CURRENT_DATE < pe THEN EXTRACT(DAY FROM CURRENT_DATE)::int ELSE EXTRACT(DAY FROM pe)::int END,
      0, m_cnt * 8, CASE WHEN m_cnt > 20 THEN (m_cnt - 20) * 2 ELSE 0 END,
      CASE WHEN CURRENT_DATE >= pe THEN 'paid' WHEN CURRENT_DATE >= pe - 5 THEN 'approved' ELSE 'pending' END,
      pe + 5, 'bank_transfer', m_cnt || ' missions × 50 000 GNF'
    )
    RETURNING id INTO pr_id;
    
    IF b_amt > 0 THEN
      INSERT INTO payroll_bonuses (payroll_record_id, bonus_type, amount, description)
      VALUES (pr_id, 'mission_completion', b_amt, m_cnt || ' missions × 50 000 GNF');
    END IF;
    
    IF e_rec.tonnage > 500000 THEN
      INSERT INTO payroll_bonuses (payroll_record_id, bonus_type, amount, description)
      VALUES (pr_id, 'performance', 200000, ROUND(e_rec.tonnage::numeric, 0) || ' tonnes');
      UPDATE payroll_records SET bonuses = bonuses + 200000, net_salary = net_salary + 200000 WHERE id = pr_id;
    END IF;
    
    INSERT INTO payroll_deductions (payroll_record_id, deduction_type, amount, description)
    VALUES (pr_id, 'insurance', 50000, 'Assurance'), (pr_id, 'other', ded - 50000, 'Avances');
  END LOOP;
END $$;
