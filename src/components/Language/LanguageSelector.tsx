import { Languages } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export const LanguageSelector = () => {
  const { language, setLanguage, t } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'fr' ? 'en' : 'fr');
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-3 w-full px-4 py-3 text-slate-600 hover:bg-slate-100 rounded-lg transition-all duration-200 group"
      title={t('language.select')}
    >
      <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-white group-hover:shadow-md transition-all">
        <Languages className="w-5 h-5 text-slate-700" />
      </div>
      <span className="font-medium">
        {language === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
      </span>
    </button>
  );
};
