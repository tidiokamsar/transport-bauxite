/*
  # Create Demo Users Helper Function

  This migration creates a helper function that can be called to set up demo user profiles.

  IMPORTANT: Users must still be created manually in Supabase Auth Dashboard first,
  then this function can link them to profiles.
*/

-- Function to create/update demo profiles
CREATE OR REPLACE FUNCTION setup_demo_profiles()
RETURNS TABLE (
  email text,
  profile_created boolean,
  message text
) AS $$
DECLARE
  user_record RECORD;
  profile_data RECORD;
BEGIN
  -- Define demo user data
  FOR profile_data IN
    SELECT * FROM (VALUES
      ('admin@sigtb.gn', 'Abdoulaye Diallo', 'admin', '+224 622 111 111', 'Direction'),
      ('manager@sigtb.gn', 'Fatoumata Sow', 'manager', '+224 622 222 222', 'Operations'),
      ('fleet@sigtb.gn', 'Mohamed Camara', 'fleet_manager', '+224 622 333 333', 'Flotte'),
      ('dispatcher@sigtb.gn', 'Ibrahim Bah', 'dispatcher', '+224 622 444 444', 'Operations'),
      ('mechanic@sigtb.gn', 'Thierno Diakité', 'mechanic', '+224 622 666 666', 'Maintenance'),
      ('accountant@sigtb.gn', 'Kadiatou Condé', 'accountant', '+224 622 888 888', 'Finance'),
      ('hr@sigtb.gn', 'Mariama Keita', 'hr_manager', '+224 622 999 999', 'Ressources Humaines')
    ) AS t(user_email, full_name, role, phone, department)
  LOOP
    -- Try to find the user in auth.users
    SELECT id INTO user_record FROM auth.users WHERE auth.users.email = profile_data.user_email;

    IF user_record.id IS NOT NULL THEN
      -- User exists, create/update profile
      INSERT INTO profiles (id, full_name, role, phone, department)
      VALUES (
        user_record.id,
        profile_data.full_name,
        profile_data.role,
        profile_data.phone,
        profile_data.department
      )
      ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        phone = EXCLUDED.phone,
        department = EXCLUDED.department;

      RETURN QUERY SELECT
        profile_data.user_email,
        true,
        'Profile created/updated successfully';
    ELSE
      -- User doesn't exist
      RETURN QUERY SELECT
        profile_data.user_email,
        false,
        'User not found in auth.users - create user first';
    END IF;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION setup_demo_profiles() TO authenticated;

-- Create a convenience view to check demo user status
CREATE OR REPLACE VIEW demo_users_status AS
SELECT
  u.email,
  u.id as user_id,
  u.created_at as user_created_at,
  u.email_confirmed_at,
  p.full_name,
  p.role,
  p.department,
  CASE
    WHEN p.id IS NULL THEN 'Profile Missing'
    WHEN u.email_confirmed_at IS NULL THEN 'Email Not Confirmed'
    ELSE 'Ready'
  END as status
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email IN (
  'admin@sigtb.gn',
  'manager@sigtb.gn',
  'fleet@sigtb.gn',
  'dispatcher@sigtb.gn',
  'mechanic@sigtb.gn',
  'accountant@sigtb.gn',
  'hr@sigtb.gn'
);

-- Grant select on view
GRANT SELECT ON demo_users_status TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION setup_demo_profiles() IS
'Creates or updates demo user profiles. Users must exist in auth.users first. Usage: SELECT * FROM setup_demo_profiles();';
