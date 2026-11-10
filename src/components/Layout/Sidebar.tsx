import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, MapPin, Search } from 'lucide-react';
import { MENU, type MenuItem } from './menu';
import { useAuth } from '../../contexts/AuthContext';
import { useSite } from '../../contexts/SiteContext';
import { GlobalSearchModal } from '../Search/GlobalSearchModal';
import { Embleme, NOM_PRODUIT, SOUS_TITRE_PRODUIT } from '../Brand/Marque';

// Menu lateral, maquette du proprietaire (2026-11-09, D-018). Planification
// suit le droit `planning` (D-023), Dispatch celui des voyages (D-024).

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

const groupeDe = (vue: string) => MENU.find((m) => m.children?.some((c) => c.id === vue))?.id;

export const Sidebar = ({ currentView, onViewChange }: SidebarProps) => {
  const { canAccessModule } = useAuth();
  const { sites, siteId, choisirSite } = useSite();
  const [ouverts, setOuverts] = useState<Set<string>>(() => new Set([groupeDe(currentView) ?? 'exploitation']));
  const [recherche, setRecherche] = useState(false);

  useEffect(() => {
    const groupe = groupeDe(currentView);
    if (groupe) setOuverts((o) => (o.has(groupe) ? o : new Set(o).add(groupe)));
  }, [currentView]);

  useEffect(() => {
    const raccourci = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setRecherche(true);
      }
    };
    window.addEventListener('keydown', raccourci);
    return () => window.removeEventListener('keydown', raccourci);
  }, []);

  const basculer = (id: string) =>
    setOuverts((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const accessible = (id: string) => id === 'dashboard' || canAccessModule(id);

  const rendre = (item: MenuItem, niveau = 0) => {
    const Icone = item.icon;
    const enfants = item.children?.filter((c) => accessible(c.id)) ?? [];
    if (item.children && enfants.length === 0) return null;
    if (!item.children && !accessible(item.id)) return null;
    const actif = currentView === item.id;
    const groupeActif = enfants.some((c) => c.id === currentView);
    const ouvert = ouverts.has(item.id);

    return (
      <div key={item.id}>
        <button
          onClick={() => (item.children ? basculer(item.id) : onViewChange(item.id))}
          className={`group flex w-full items-center gap-3 rounded-xl text-left transition ${
            niveau > 0 ? 'py-2 pl-11 pr-3 text-[13px]' : 'px-3 py-2.5 text-[15px]'
          } ${
            actif
              ? 'bg-gradient-to-r from-orange-500 to-orange-600 font-semibold text-white shadow-lg shadow-orange-900/30'
              : groupeActif
                ? 'text-white'
                : 'text-stone-200/85 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Icone className={`flex-shrink-0 ${niveau > 0 ? 'h-4 w-4' : 'h-5 w-5'}`} strokeWidth={1.7} />
          <span className="flex-1 truncate">{item.label}</span>
          {item.children && (ouvert ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 opacity-70" />)}
        </button>
        {item.children && ouvert && <div className="mt-0.5 space-y-0.5">{enfants.map((c) => rendre(c, niveau + 1))}</div>}
      </div>
    );
  };

  return (
    <aside className="flex h-screen w-[17.5rem] flex-shrink-0 flex-col bg-gradient-to-b from-[#3d1f15] via-[#331a11] to-[#24120b] text-white shadow-2xl">
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <Embleme className="h-14 w-14 flex-shrink-0 rounded-2xl shadow-lg" />
        <div>
          <p className="text-2xl font-black tracking-tight">{NOM_PRODUIT}</p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-100/90">{SOUS_TITRE_PRODUIT}</p>
        </div>
      </div>

      <div className="px-3 pb-3">
        <button
          onClick={() => setRecherche(true)}
          className="flex w-full items-center gap-3 rounded-xl bg-white/5 px-3 py-2 text-sm text-stone-300 transition hover:bg-white/10 hover:text-white"
        >
          <Search className="h-4 w-4 text-orange-300" />
          <span className="flex-1 text-left">Rechercher...</span>
          <kbd className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] text-stone-400">Ctrl K</kbd>
        </button>
      </div>

      <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">{MENU.map((m) => rendre(m))}</nav>

      <div className="p-3">
        <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5">
          <MapPin className="h-5 w-5 flex-shrink-0 text-orange-200" />
          <span className="sr-only">Site</span>
          <select
            value={siteId ?? ''}
            onChange={(e) => choisirSite(e.target.value || null)}
            className="w-full cursor-pointer appearance-none bg-transparent text-[15px] font-medium text-white focus:outline-none"
          >
            <option value="" className="text-stone-900">Site : tous les sites</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id} className="text-stone-900">
                Site : {s.name}
              </option>
            ))}
          </select>
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-stone-300" />
        </label>
      </div>

      <GlobalSearchModal isOpen={recherche} onClose={() => setRecherche(false)} />
    </aside>
  );
};
