/*
  # Restriction des politiques RLS ouvertes (Tranche 0, action 0.4)

  Constat : environ 113 politiques de la forme
  `FOR ALL TO authenticated USING (true) WITH CHECK (true)` accordent a
  N'IMPORTE QUEL utilisateur authentifie (y compris un compte chauffeur)
  la lecture, la modification et la suppression sur les tables metier :
  paie, conges, pneus, ESG, dispatch, alertes, donnees IoT...

  Correctif en trois temps :

  1. Fonction `has_module_write(module)` : reflete la matrice
     `role_permissions` (can_create OU can_edit) deja utilisee par
     l'interface. L'admin est toujours autorise via `is_admin()`.
  2. Filet de securite : pour chaque table portant une politique
     FOR ALL ouverte, creer si besoin une politique SELECT pour les
     authentifies (la lecture large reste le comportement affiche par
     l'application), puis supprimer toutes les politiques FOR ALL
     dont le USING vaut `true`.
  3. Retablir les ecritures par module, selon la correspondance
     table -> module documentee ci-dessous.

  Correspondance tables -> module (module = cle de role_permissions) :

    hr           : payroll, payroll_items, payroll_records,
                   payroll_bonuses, payroll_deductions,
                   employee_attendance, leave_requests
    trips        : work_shifts, dispatch_assignments, dispatch_rules,
                   dispatch_simulations, mission_requirements
    drivers      : driver_availability, driving_time_regulations
    gps_tracking : alerts, alert_rules, alert_thresholds,
                   alert_notifications
    esg          : carbon_emissions, environmental_incidents,
                   esg_reports, sustainability_kpis
    ai_analytics : eco_driving_scores, performance_scores,
                   fatigue_alerts, rest_periods, optimization_history
    maintenance  : tire_alerts, tire_installations, tire_inventory,
                   tire_maintenance_events, tire_models, tire_po_items,
                   tire_purchase_orders, tire_removals, tire_retreads,
                   tire_suppliers, tire_transfers
    iot          : iot_fuel_readings, iot_telemetry_raw
                   (les Edge Functions ecrivent en service role,
                   hors RLS : non impactees)

  Notes :
  - Les roles absents de `role_permissions` perdent l'ecriture
    (comportement ferme par defaut). Les ajouter dans la matrice si
    besoin.
  - La suppression des politiques ouvertes est dynamique : elle couvre
    aussi toute table oubliee de l'inventaire initial.
*/

-- ============================================
-- 1. Fonction d'autorisation par module
-- ============================================

CREATE OR REPLACE FUNCTION has_module_write(p_module text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    -- D-008 (2026-11-07) : role_permissions.role est text, profiles.role
    -- est l'enum user_role ; le double cast vaut pour les deux types.
    JOIN public.role_permissions rp ON rp.role::text = pr.role::text
    WHERE pr.id = auth.uid()
      AND rp.module = p_module
      AND (rp.can_create OR rp.can_edit)
  );
$$;

-- ============================================
-- 2. Preserver la lecture, supprimer les politiques FOR ALL ouvertes
-- ============================================

DO $$
DECLARE
  t RECORD;
  p RECORD;
  has_select boolean;
BEGIN
  FOR t IN
    SELECT DISTINCT schemaname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd = 'ALL'
      AND roles = ARRAY['authenticated']::name[]
      AND replace(COALESCE(qual, ''), ' ', '') IN ('true', '(true)')
  LOOP
    -- Garantir la lecture authentifiee avant de retirer le FOR ALL
    SELECT EXISTS (
      SELECT 1 FROM pg_policies s
      WHERE s.schemaname = t.schemaname
        AND s.tablename = t.tablename
        AND s.cmd = 'SELECT'
        AND s.roles @> ARRAY['authenticated']::name[]
    ) INTO has_select;

    IF NOT has_select THEN
      EXECUTE format(
        'CREATE POLICY lecture_authentifies ON %I.%I FOR SELECT TO authenticated USING (true)',
        t.schemaname, t.tablename
      );
    END IF;
  END LOOP;

  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd = 'ALL'
      AND roles = ARRAY['authenticated']::name[]
      AND replace(COALESCE(qual, ''), ' ', '') IN ('true', '(true)')
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON %I.%I',
      p.policyname, p.schemaname, p.tablename
    );
    RAISE NOTICE 'Politique ouverte supprimee : % sur %.%',
      p.policyname, p.schemaname, p.tablename;
  END LOOP;
END $$;

-- ============================================
-- 3. Retablir les ecritures par module
--    (FOR ALL : lecture large + ecritures roles metier)
-- ============================================

DO $$
DECLARE
  module_definitions CONSTANT text[] := ARRAY[
    'hr|payroll',
    'hr|payroll_items',
    'hr|payroll_records',
    'hr|payroll_bonuses',
    'hr|payroll_deductions',
    'hr|employee_attendance',
    'hr|leave_requests',
    'trips|work_shifts',
    'trips|dispatch_assignments',
    'trips|dispatch_rules',
    'trips|dispatch_simulations',
    'trips|mission_requirements',
    'drivers|driver_availability',
    'drivers|driving_time_regulations',
    'gps_tracking|alerts',
    'gps_tracking|alert_rules',
    'gps_tracking|alert_thresholds',
    'gps_tracking|alert_notifications',
    'esg|carbon_emissions',
    'esg|environmental_incidents',
    'esg|esg_reports',
    'esg|sustainability_kpis',
    'ai_analytics|eco_driving_scores',
    'ai_analytics|performance_scores',
    'ai_analytics|fatigue_alerts',
    'ai_analytics|rest_periods',
    'ai_analytics|optimization_history',
    'maintenance|tire_alerts',
    'maintenance|tire_installations',
    'maintenance|tire_inventory',
    'maintenance|tire_maintenance_events',
    'maintenance|tire_models',
    'maintenance|tire_po_items',
    'maintenance|tire_purchase_orders',
    'maintenance|tire_removals',
    'maintenance|tire_retreads',
    'maintenance|tire_suppliers',
    'maintenance|tire_transfers',
    'iot|iot_fuel_readings',
    'iot|iot_telemetry_raw'
  ];
  item text;
  mod_name text;
  tbl text;
  table_exists boolean;
BEGIN
  FOREACH item IN ARRAY module_definitions LOOP
    mod_name := split_part(item, '|', 1);
    tbl := split_part(item, '|', 2);

    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) INTO table_exists;

    IF table_exists THEN
      EXECUTE format(
        'CREATE POLICY ecriture_roles_metier ON %I FOR ALL TO authenticated
         USING (has_module_write(%L)) WITH CHECK (has_module_write(%L))',
        tbl, mod_name, mod_name
      );
    ELSE
      RAISE NOTICE 'Table absente, ignoree : %', tbl;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- Verification (a executer manuellement apres deploiement)
--
-- Politiques FOR ALL encore ouvertes (doit retourner 0 ligne) :
--   SELECT schemaname, tablename, policyname FROM pg_policies
--   WHERE schemaname = 'public' AND cmd = 'ALL'
--     AND roles = ARRAY['authenticated']::name[]
--     AND replace(COALESCE(qual,''),' ','') IN ('true','(true)');
--
-- Scenario chauffeur (doit echouer avec erreur RLS) :
--   UPDATE payroll SET base_salary = 999999 WHERE id = '...';
--   UPDATE profiles SET role = 'admin' WHERE id = auth.uid();
-- ============================================
