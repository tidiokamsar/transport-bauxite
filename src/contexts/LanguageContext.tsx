import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, Language } from '../i18n/translations';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>('fr');
  const { user } = useAuth();

  useEffect(() => {
    const loadLanguagePreference = async () => {
      if (user) {
        const { data } = await supabase
          .from('user_preferences')
          .select('language')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data?.language) {
          setLanguageState(data.language as Language);
        }
      } else {
        const savedLang = localStorage.getItem('preferredLanguage');
        if (savedLang === 'fr' || savedLang === 'en') {
          setLanguageState(savedLang);
        }
      }
    };

    loadLanguagePreference();
  }, [user]);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);

    localStorage.setItem('preferredLanguage', lang);

    if (user) {
      await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          language: lang,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });
    }
  };

  const t = (key: string): string => {
    const keys = key.split('.');
    let value: any = translations[language];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key;
      }
    }

    return typeof value === 'string' ? value : key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
