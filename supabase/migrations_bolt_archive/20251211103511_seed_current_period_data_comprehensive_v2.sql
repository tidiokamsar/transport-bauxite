/*
  # Ajout de donnees pour la periode actuelle

  1. Donnees ajoutees
    - Incidents de cette semaine
    - Couts de ce mois
    - Presence d'aujourd'hui
    - Paie de ce mois
*/

-- Verifier qu'il existe des categories de couts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cost_categories LIMIT 1) THEN
    INSERT INTO cost_categories (name, description)
    VALUES 
      ('Carburant', 'Depenses de carburant'),
      ('Maintenance', 'Entretien et reparations'),
      ('Pieces', 'Achat de pieces detachees'),
      ('Assurance', 'Frais d''assurance'),
      ('Peages', 'Frais de peage'),
      ('Autres', 'Autres depenses');
  END IF;
END $$;

-- Ajouter des incidents pour cette semaine
INSERT INTO incidents (
  trip_id,
  incident_time,
  description,
  severity,
  estimated_cost
)
SELECT 
  t.id as trip_id,
  t.actual_departure_time + (RANDOM() * 180)::int * INTERVAL '1 minute' as incident_time,
  (CASE (RANDOM() * 6)::int
    WHEN 0 THEN 'Collision mineure avec obstacle sur la route'
    WHEN 1 THEN 'Panne mecanique - surchauffe moteur'
    WHEN 2 THEN 'Crevaison double essieu arriere'
    WHEN 3 THEN 'Probleme freinage necessitant intervention'
    WHEN 4 THEN 'Perte de controle sur route boueuse'
    ELSE 'Incident mineur - retard operationnel'
  END) as description,
  (CASE (RANDOM() * 4)::int
    WHEN 0 THEN 'minor'
    WHEN 1 THEN 'moderate'
    WHEN 2 THEN 'severe'
    ELSE 'critical'
  END)::incident_severity as severity,
  750000 + (RANDOM() * 12000000)::numeric as estimated_cost
FROM trips t
WHERE t.status IN ('in_progress', 'completed')
  AND t.actual_departure_time IS NOT NULL
  AND t.actual_departure_time >= CURRENT_DATE - INTERVAL '7 days'
  AND RANDOM() < 0.08
LIMIT 25;

-- Ajouter des couts pour ce mois
INSERT INTO costs (
  vehicle_id,
  date,
  category_id,
  description,
  amount,
  reference
)
SELECT 
  v.id as vehicle_id,
  CURRENT_DATE - (RANDOM() * 30)::int as date,
  (SELECT id FROM cost_categories ORDER BY RANDOM() LIMIT 1) as category_id,
  (CASE (RANDOM() * 8)::int
    WHEN 0 THEN 'Reparation moteur diesel - revision complete'
    WHEN 1 THEN 'Remplacement 6 pneus Michelin XZL'
    WHEN 2 THEN 'Vidange complete + remplacement filtres'
    WHEN 3 THEN 'Revision generale 50000 km'
    WHEN 4 THEN 'Reparation suspension avant'
    WHEN 5 THEN 'Plein carburant - 500L diesel'
    WHEN 6 THEN 'Changement plaquettes freins'
    ELSE 'Entretien preventif complet'
  END) as description,
  450000 + (RANDOM() * 6500000)::numeric as amount,
  'COST-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-' || LPAD((RANDOM() * 9999)::int::text, 4, '0') as reference
FROM vehicles v
WHERE v.status = 'active'
  AND RANDOM() < 0.5
LIMIT 150;

-- Ajouter des presences pour aujourd'hui
INSERT INTO attendance (
  employee_id,
  date,
  check_in,
  check_out,
  status
)
SELECT 
  e.id as employee_id,
  CURRENT_DATE as date,
  CASE 
    WHEN RANDOM() < 0.93 THEN (TIME '06:00:00' + (RANDOM() * 50)::int * INTERVAL '1 minute')
    ELSE NULL
  END as check_in,
  CASE 
    WHEN RANDOM() < 0.78 THEN (TIME '14:30:00' + (RANDOM() * 150)::int * INTERVAL '1 minute')
    ELSE NULL
  END as check_out,
  (CASE (RANDOM() * 6)::int
    WHEN 0 THEN 'present'
    WHEN 1 THEN 'absent'
    WHEN 2 THEN 'leave'
    WHEN 3 THEN 'present'
    WHEN 4 THEN 'present'
    ELSE 'present'
  END)::attendance_status as status
FROM employees e
WHERE e.status = 'active'
ON CONFLICT (employee_id, date) DO NOTHING;

-- Ajouter des enregistrements de paie pour ce mois
INSERT INTO payroll_records (
  employee_id,
  period_start,
  period_end,
  base_salary,
  overtime_pay,
  bonuses,
  deductions,
  tax_amount,
  social_security,
  net_salary,
  days_worked,
  days_absent,
  hours_worked,
  overtime_hours,
  status,
  payment_date
)
SELECT 
  e.id as employee_id,
  DATE_TRUNC('month', CURRENT_DATE)::date as period_start,
  (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date as period_end,
  e.base_salary,
  (RANDOM() * 850000)::numeric as overtime_pay,
  (RANDOM() * 550000)::numeric as bonuses,
  e.base_salary * 0.10 as deductions,
  e.base_salary * 0.12 as tax_amount,
  e.base_salary * 0.05 as social_security,
  e.base_salary + (RANDOM() * 850000)::numeric + (RANDOM() * 550000)::numeric - (e.base_salary * 0.27) as net_salary,
  20 + (RANDOM() * 5)::int as days_worked,
  (RANDOM() * 3)::int as days_absent,
  160 + (RANDOM() * 40)::numeric as hours_worked,
  (RANDOM() * 20)::numeric as overtime_hours,
  (CASE (RANDOM() * 4)::int
    WHEN 0 THEN 'draft'
    WHEN 1 THEN 'approved'
    WHEN 2 THEN 'paid'
    ELSE 'approved'
  END) as status,
  CASE 
    WHEN RANDOM() < 0.65 THEN (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::date
    ELSE NULL
  END as payment_date
FROM employees e
WHERE e.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM payroll_records pr 
    WHERE pr.employee_id = e.id 
    AND pr.period_start = DATE_TRUNC('month', CURRENT_DATE)::date
  );
