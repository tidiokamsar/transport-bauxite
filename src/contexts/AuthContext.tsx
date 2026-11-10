import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';

interface Permission {
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  permissions: Permission[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (module: string, action: 'view' | 'create' | 'edit' | 'delete' | 'approve') => boolean;
  canAccessModule: (moduleId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        }
        setLoading(false);
      })();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setPermissions([]);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return;
    }

    setProfile(data);

    if (data?.role) {
      await fetchPermissions(data.role);
      await updateLastLogin(userId);
    }
  };

  const fetchPermissions = async (role: string) => {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('*')
      .eq('role', role);

    if (error) {
      console.error('Error fetching permissions:', error);
      return;
    }

    setPermissions(data || []);
  };

  const updateLastLogin = async (userId: string) => {
    await supabase
      .from('profiles')
      .update({ last_login: new Date().toISOString() })
      .eq('id', userId);
  };

  const hasPermission = (module: string, action: 'view' | 'create' | 'edit' | 'delete' | 'approve'): boolean => {
    if (profile?.role === 'admin') return true;

    const permission = permissions.find(p => p.module === module);
    if (!permission) return false;

    const actionMap = {
      view: permission.can_view,
      create: permission.can_create,
      edit: permission.can_edit,
      delete: permission.can_delete,
      approve: permission.can_approve,
    };

    return actionMap[action] || false;
  };

  const canAccessModule = (moduleId: string): boolean => {
    if (profile?.role === 'admin') return true;

    const modulePermissionMap: Record<string, string> = {
      'dashboard': 'dashboard',
      'vehicles': 'vehicles',
      'tires': 'vehicles',
      'documents': 'vehicles',
      'drivers': 'drivers',
      'trips': 'trips',
      'planification': 'planning',
      'dispatch': 'trips',
      'gps-tracking': 'gps_tracking',
      'geofencing': 'gps_tracking',
      'route-history': 'gps_tracking',
      'fuel': 'fuel',
      'fuel-sensors': 'fuel',
      'immobilisations': 'maintenance',
      'maintenance': 'maintenance',
      'preventive': 'maintenance',
      'stock': 'stock',
      'purchases': 'purchases',
      'suppliers': 'purchases',
      'invoices': 'invoices',
      'costs': 'costs',
      'hr-employees': 'hr',
      'hr-attendance': 'hr',
      'hr-payroll': 'hr',
      'reports': 'reports',
      'predictive-maintenance': 'reports',
      'driver-behavior': 'reports',
      'fleet-health': 'reports',
      'tco-analysis': 'reports',
      'notifications': 'dashboard',
      'quick-actions': 'dashboard',
      'fleet-intelligence': 'gps_tracking',
      'fuel-stocks': 'fuel',
      'incidents': 'reports',
      'alerts': 'reports',
      'sites': 'settings',
      'iot-dashboard': 'reports',
      'esg-tracking': 'reports',
      'client-portal': 'reports',
      'settings': 'settings',
    };

    const permissionModule = modulePermissionMap[moduleId];
    if (!permissionModule) return false;

    return hasPermission(permissionModule, 'view');
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
  };

  const signUp = async (email: string, password: string, fullName: string, role: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;

    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          full_name: fullName,
          role: role,
        });

      if (profileError) throw profileError;
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error during sign out:', error);
    } finally {
      setSession(null);
      setUser(null);
      setProfile(null);
      setPermissions([]);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        permissions,
        loading,
        signIn,
        signUp,
        signOut,
        hasPermission,
        canAccessModule,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
