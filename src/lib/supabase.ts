import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole =
  | 'admin'
  | 'director'
  | 'operations_manager'
  | 'fleet_manager'
  | 'maintenance_chief'
  | 'logistician'
  | 'accountant'
  | 'driver';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  site_id: string | null;
  created_at: string;
  updated_at: string;
}
