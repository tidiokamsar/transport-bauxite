/*
  # User Management System

  1. New Tables
    - `user_activity_logs` - Track user actions and login history
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `action` (text)
      - `details` (jsonb)
      - `ip_address` (text)
      - `created_at` (timestamptz)

  2. Enhancements to Existing Tables
    - Add user management fields to profiles
    - Add status tracking (active/inactive/suspended)

  3. Security
    - Enable RLS on all tables
    - Add policies for user management
    - Admin-only access to sensitive operations
*/

-- Create user activity logs table
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all activity logs"
  ON user_activity_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view own activity logs"
  ON user_activity_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert activity logs"
  ON user_activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Enhance profiles table with additional fields
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'status') THEN
    ALTER TABLE profiles ADD COLUMN status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'created_by') THEN
    ALTER TABLE profiles ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'updated_by') THEN
    ALTER TABLE profiles ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON user_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);

-- Function to log user activity
CREATE OR REPLACE FUNCTION log_user_activity(
  p_action text,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_activity_logs (user_id, action, details)
  VALUES (auth.uid(), p_action, p_details);
END;
$$;
