/*
  # Attendance and Payroll System

  Complete system with sample data
*/

CREATE TABLE IF NOT EXISTS employee_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  status text DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'half_day', 'leave', 'sick_leave', 'unpaid_leave')),
  check_in_time time,
  check_out_time time,
  hours_worked numeric(4,2) DEFAULT 0,
  overtime_hours numeric(4,2) DEFAULT 0,
  absence_reason text,
  justification_document text,
  approved_by uuid REFERENCES auth.users(id),
  approval_date timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, date)
);

ALTER TABLE employee_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage attendance" ON employee_attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS payroll_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  base_salary numeric(12,2) NOT NULL DEFAULT 0,
  overtime_pay numeric(12,2) DEFAULT 0,
  bonuses numeric(12,2) DEFAULT 0,
  deductions numeric(12,2) DEFAULT 0,
  tax_amount numeric(12,2) DEFAULT 0,
  social_security numeric(12,2) DEFAULT 0,
  net_salary numeric(12,2) NOT NULL DEFAULT 0,
  days_worked integer DEFAULT 0,
  days_absent integer DEFAULT 0,
  hours_worked numeric(6,2) DEFAULT 0,
  overtime_hours numeric(6,2) DEFAULT 0,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'paid')),
  payment_date date,
  payment_method text,
  notes text,
  approved_by uuid REFERENCES auth.users(id),
  approval_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, period_start, period_end)
);

ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage payroll" ON payroll_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS payroll_deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_record_id uuid REFERENCES payroll_records(id) ON DELETE CASCADE NOT NULL,
  deduction_type text NOT NULL,
  description text,
  amount numeric(12,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payroll_deductions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage deductions" ON payroll_deductions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS payroll_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_record_id uuid REFERENCES payroll_records(id) ON DELETE CASCADE NOT NULL,
  bonus_type text NOT NULL,
  description text,
  amount numeric(12,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payroll_bonuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage bonuses" ON payroll_bonuses FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$
DECLARE emp RECORD; d DATE; dow INTEGER; rv NUMERIC;
BEGIN
  FOR emp IN SELECT id FROM employees WHERE status = 'active' LIMIT 10 LOOP
    FOR i IN 0..89 LOOP
      d := CURRENT_DATE - i; dow := EXTRACT(DOW FROM d);
      IF dow NOT IN (0, 6) THEN
        rv := random();
        IF rv < 0.80 THEN
          INSERT INTO employee_attendance (employee_id, date, status, check_in_time, check_out_time, hours_worked, overtime_hours)
          VALUES (emp.id, d, CASE WHEN random() < 0.15 THEN 'late' ELSE 'present' END,
            ('08:' || LPAD((random() * 30)::INTEGER::TEXT, 2, '0'))::TIME,
            ('17:' || LPAD((random() * 30)::INTEGER::TEXT, 2, '0'))::TIME,
            8 + random() * 2, CASE WHEN random() < 0.2 THEN random() * 3 ELSE 0 END)
          ON CONFLICT DO NOTHING;
        ELSIF rv < 0.90 THEN
          INSERT INTO employee_attendance (employee_id, date, status, absence_reason, hours_worked)
          VALUES (emp.id, d, 'leave', 'Congé', 0) ON CONFLICT DO NOTHING;
        ELSIF rv < 0.95 THEN
          INSERT INTO employee_attendance (employee_id, date, status, absence_reason, hours_worked)
          VALUES (emp.id, d, 'sick_leave', 'Maladie', 0) ON CONFLICT DO NOTHING;
        ELSE
          INSERT INTO employee_attendance (employee_id, date, status, absence_reason, hours_worked)
          VALUES (emp.id, d, 'absent', 'Absence', 0) ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END $$;

DO $$
DECLARE emp RECORD; mo INTEGER; ps DATE; pe DATE; dw INTEGER; hw NUMERIC; oh NUMERIC; bs NUMERIC; op NUMERIC; bn NUMERIC; dd NUMERIC; ss NUMERIC; tx NUMERIC; ns NUMERIC;
BEGIN
  FOR emp IN SELECT id, base_salary FROM employees WHERE status = 'active' LIMIT 10 LOOP
    FOR mo IN 0..1 LOOP
      ps := DATE_TRUNC('month', CURRENT_DATE - (mo || ' months')::INTERVAL)::DATE;
      pe := (ps + INTERVAL '1 month - 1 day')::DATE;
      SELECT COUNT(*) FILTER (WHERE status IN ('present', 'late')), COALESCE(SUM(hours_worked), 0), COALESCE(SUM(overtime_hours), 0)
      INTO dw, hw, oh FROM employee_attendance WHERE employee_id = emp.id AND date BETWEEN ps AND pe;
      bs := emp.base_salary; op := oh * (bs / 160) * 1.5;
      bn := CASE WHEN random() < 0.3 THEN 50000 + random() * 200000 ELSE 0 END;
      dd := CASE WHEN random() < 0.2 THEN 10000 + random() * 50000 ELSE 0 END;
      ss := bs * 0.08; tx := (bs + op + bn - ss) * 0.05; ns := bs + op + bn - dd - tx - ss;
      INSERT INTO payroll_records (employee_id, period_start, period_end, base_salary, overtime_pay, bonuses, deductions,
        tax_amount, social_security, net_salary, days_worked, hours_worked, overtime_hours, status, payment_date, payment_method)
      VALUES (emp.id, ps, pe, bs, op, bn, dd, tx, ss, ns, dw, hw, oh,
        CASE mo WHEN 0 THEN 'pending' ELSE 'paid' END, CASE WHEN mo > 0 THEN pe + 5 ELSE NULL END, 'Virement')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_ea_date ON employee_attendance(date DESC);
CREATE INDEX IF NOT EXISTS idx_ea_emp ON employee_attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_pr_period ON payroll_records(period_start DESC);
CREATE INDEX IF NOT EXISTS idx_pr_emp ON payroll_records(employee_id);
