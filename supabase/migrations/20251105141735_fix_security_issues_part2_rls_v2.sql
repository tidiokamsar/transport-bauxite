/*
  # Fix Security Issues - Part 2: RLS Optimization (Fixed)

  Optimize RLS policies with proper type casting
*/

-- Role permissions - Read policy
DROP POLICY IF EXISTS "Users can read their role permissions" ON role_permissions;
CREATE POLICY "Users can read their role permissions" ON role_permissions
  FOR SELECT TO authenticated
  USING (
    role::text = (
      SELECT role::text FROM profiles WHERE id = (SELECT auth.uid())
    )
  );

DO $$
BEGIN
  RAISE NOTICE '✅ Part 2 Complete: Fixed RLS policy with proper casting';
END $$;
