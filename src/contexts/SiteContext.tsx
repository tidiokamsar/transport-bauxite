import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

// Site de travail selectionne (CDC 4.3, perimetre site). Choisi dans le menu
// lateral, memorise par navigateur, utilise par les ecrans pour filtrer.
// Ce filtre d'affichage n'est pas une barriere de securite : le
// cloisonnement par site se fera en RLS au LOT 02.

export interface SiteResume {
  id: string;
  name: string;
  type: string;
}

interface SiteContextType {
  sites: SiteResume[];
  siteId: string | null;
  site: SiteResume | null;
  choisirSite: (id: string | null) => void;
  chargement: boolean;
}

const CLE_STOCKAGE = 'sigtb.site';

const SiteContext = createContext<SiteContextType | undefined>(undefined);

const lireSiteMemorise = (): string | null => {
  try {
    return localStorage.getItem(CLE_STOCKAGE);
  } catch {
    return null;
  }
};

export const SiteProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [sites, setSites] = useState<SiteResume[]>([]);
  const [siteId, setSiteId] = useState<string | null>(lireSiteMemorise);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    if (!user) return;
    let actif = true;
    supabase
      .from('sites')
      .select('id, name, type')
      .eq('is_active', true)
      .order('name')
      .then(({ data, error }) => {
        if (!actif) return;
        if (error) console.error('Sites :', error.message);
        const liste = (data ?? []) as SiteResume[];
        setSites(liste);
        setSiteId((courant) => (courant && liste.some((s) => s.id === courant) ? courant : null));
        setChargement(false);
      });
    return () => {
      actif = false;
    };
  }, [user]);

  const choisirSite = (id: string | null) => {
    setSiteId(id);
    try {
      if (id) localStorage.setItem(CLE_STOCKAGE, id);
      else localStorage.removeItem(CLE_STOCKAGE);
    } catch {
      // Stockage indisponible : le choix vaut pour la session seulement.
    }
  };

  return (
    <SiteContext.Provider
      value={{ sites, siteId, site: sites.find((s) => s.id === siteId) ?? null, choisirSite, chargement }}
    >
      {children}
    </SiteContext.Provider>
  );
};

export const useSite = () => {
  const contexte = useContext(SiteContext);
  if (!contexte) throw new Error('useSite doit etre utilise dans SiteProvider');
  return contexte;
};
