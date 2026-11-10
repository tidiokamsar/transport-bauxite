import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// « Se souvenir de moi » : la session est gardee dans localStorage (elle
// survit a la fermeture du navigateur) ou dans sessionStorage (elle se
// termine avec l'onglet). Le choix est fait sur la page de connexion.
export const CLE_SOUVENIR = 'sigtb.souvenir';

const memoriser = () => {
  try {
    return localStorage.getItem(CLE_SOUVENIR) !== '0';
  } catch {
    return true;
  }
};

const stockageSession = {
  getItem: (cle: string) => {
    try {
      return sessionStorage.getItem(cle) ?? localStorage.getItem(cle);
    } catch {
      return null;
    }
  },
  setItem: (cle: string, valeur: string) => {
    try {
      if (memoriser()) {
        localStorage.setItem(cle, valeur);
        sessionStorage.removeItem(cle);
      } else {
        sessionStorage.setItem(cle, valeur);
        localStorage.removeItem(cle);
      }
    } catch {
      // Stockage indisponible : la session reste en memoire.
    }
  },
  removeItem: (cle: string) => {
    try {
      localStorage.removeItem(cle);
      sessionStorage.removeItem(cle);
    } catch {
      // Rien a nettoyer.
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storage: stockageSession, persistSession: true },
});

export type UserRole =
  | 'admin'
  | 'director'
  | 'operations_manager'
  | 'fleet_manager'
  | 'maintenance_chief'
  | 'logistician'
  | 'accountant'
  | 'contract_manager'
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
