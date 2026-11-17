import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
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
  /** sansDelegation : droit propre seulement (un droit recu ne se redelegue pas, D-064). */
  hasPermission: (module: string, action: 'view' | 'create' | 'edit' | 'delete' | 'approve', sansDelegation?: boolean) => boolean;
  canAccessModule: (moduleId: string) => boolean;
  /** Erreur du dernier chargement des delegations recues (D-064), null si aucune. */
  erreurDelegations: string | null;
  rafraichirDelegations: () => Promise<void>;
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
  const [droitsSpecifiques, setDroitsSpecifiques] = useState<{ module: string; niveau: string }[]>([]);
  // Delegations recues en vigueur (D-064), statut calcule par le serveur.
  const [delegationsRecues, setDelegationsRecues] = useState<{ module: string; niveau: string; donne_lecture: boolean }[]>([]);
  const [erreurDelegations, setErreurDelegations] = useState<string | null>(null);
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
          setDroitsSpecifiques([]);
          setDelegationsRecues([]);
          setErreurDelegations(null);
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
      await fetchDroitsSpecifiques(userId);
      await fetchDelegationsRecues(userId);
      await updateLastLogin(userId);
    }
  };

  // Droits specifiques par utilisateur (D-036) : ils priment sur la matrice
  // du role, comme dans has_module_view / has_module_write cote serveur.
  const fetchDroitsSpecifiques = async (userId: string) => {
    const { data, error } = await supabase
      .from('droits_utilisateur')
      .select('module, niveau')
      .eq('utilisateur', userId);

    if (error) {
      console.error('Error fetching module rights:', error);
      return;
    }

    setDroitsSpecifiques(data ?? []);
  };

  // Delegations recues : une delegation commence, expire ou est revoquee sans
  // action de l'utilisateur ; relues periodiquement et au retour sur l'onglet.
  // Le serveur reste seul juge (has_module_*) ; l'erreur est exposee a l'ecran.
  const fetchDelegationsRecues = async (userId: string) => {
    const { data, error } = await supabase.rpc('mes_delegations');
    if (error) {
      console.error('Error fetching delegations:', error);
      setErreurDelegations(error.message);
      return;
    }
    setErreurDelegations(null);
    setDelegationsRecues(((data ?? []) as { delegue: string; module: string; niveau: string; statut: string; donne_lecture: boolean }[])
      .filter(d => d.delegue === userId && d.statut === 'active'));
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

  const rafraichirDelegations = useCallback(async () => {
    if (user?.id) await fetchDelegationsRecues(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const relire = () => { if (document.visibilityState === 'visible') void rafraichirDelegations(); };
    const minuterie = window.setInterval(relire, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', relire);
    return () => { window.clearInterval(minuterie); document.removeEventListener('visibilitychange', relire); };
  }, [user?.id, rafraichirDelegations]);

  const hasPermission = (module: string, action: 'view' | 'create' | 'edit' | 'delete' | 'approve', sansDelegation = false): boolean => {
    if (profile?.role === 'admin') return true;

    // Attribution specifique (D-036) : lecture ou ecriture, avant la matrice.
    const specifique = droitsSpecifiques.find(d => d.module === module);
    if (specifique) {
      if (action === 'view') return specifique.niveau === 'lecture' || specifique.niveau === 'ecriture';
      return specifique.niveau === 'ecriture';
    }

    // Delegation en vigueur (D-064) : ecriture, et lecture du module si le
    // delegant la detient (meme regle que has_module_view) ; approbation
    // deleguee depuis D-082 (has_module_approve), sans l'ecriture.
    const delegations = sansDelegation ? [] : delegationsRecues.filter(d => d.module === module);
    if (action === 'view' && delegations.some(d => d.donne_lecture)) return true;
    if (action === 'approve' && delegations.some(d => d.niveau === 'approbation')) return true;
    if (action !== 'view' && action !== 'approve' && delegations.some(d => d.niveau === 'ecriture')) return true;

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

    // Une entree peut citer plusieurs modules : l'ecran s'ouvre si l'un
    // d'eux est lisible (miroir des politiques de lecture du serveur).
    const modulePermissionMap: Record<string, string | string[]> = {
      'dashboard': 'dashboard',
      'mes-validations': 'dashboard',
      'centre-pilotage': 'dashboard',
      'vehicles': 'vehicles',
      'tires': 'vehicles',
      'documents': 'vehicles',
      'drivers': 'drivers',
      'habilitations': 'drivers',
      'trips': 'trips',
      'kilometrage': 'trips',
      'tickets-cbg': 'trips',
      'postes': 'trips',
      'fiches': 'trips',
      'planification': 'planning',
      'dispatch': 'trips',
      'operations': 'trips',
      'operations-journal': 'trips',
      'operations-anomalies': ['trips', 'invoices'],
      'operations-controles': 'trips',
      'gps-tracking': 'gps_tracking',
      'geofencing': 'gps_tracking',
      'route-history': 'gps_tracking',
      'fuel': 'fuel',
      'livraisons-cbg': 'fuel',
      'fuel-sensors': 'fuel',
      'fuel-dashboard': 'fuel',
      'fuel-anomalies': 'fuel',
      'immobilisations': 'maintenance',
      'interventions-loueur': 'maintenance',
      'maintenance': 'maintenance',
      'preventive': 'maintenance',
      'stock': 'stock',
      'moyens-generaux': 'stock',
      'purchases': 'purchases',
      'suppliers': 'purchases',
      'contrats': 'contracts',
      'mon-poste': 'contracts',
      'engagements': 'contracts',
      'comites': 'contracts',
      'recouvrement': 'invoices',
      'factures-neemba': 'contracts',
      // D-065 : evaluations du loueur (contracts) ; budgets lus par costs,
      // invoices ou reports ; contracts n'y voit que l'onglet Referentiels
      // (plan comptable, natures, comptes de tiers ; FinanceView, D-078).
      'evaluation-loueur': 'contracts',
      'budgets': ['costs', 'invoices', 'reports', 'contracts'],
      'paiements': 'invoices',
      'reconciliation': 'invoices',
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
      'controles-depart': 'trips',
      'hse-prevention': 'trips',
      'alerts': 'reports',
      'sites': 'settings',
      'infrastructures': 'trips',
      'iot-dashboard': 'reports',
      'esg-tracking': 'reports',
      'settings': 'settings',
      // D-078 : shifts lisibles par tout compte, ecrits sous le droit settings.
      'shifts': ['settings', 'planning', 'trips'],
    };

    const permissionModule = modulePermissionMap[moduleId];
    if (!permissionModule) return false;

    return (Array.isArray(permissionModule) ? permissionModule : [permissionModule])
      .some((m) => hasPermission(m, 'view'));
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
      setDroitsSpecifiques([]);
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
        erreurDelegations,
        rafraichirDelegations,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
