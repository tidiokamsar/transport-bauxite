import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Truck,
  Users,
  MapPin,
  Fuel,
  Wrench,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  CircleDot,
  Package,
  ShoppingCart,
  Banknote,
  UserCog,
  Bell,
  MapPinned,
  Gauge,
  ChevronDown,
  ChevronRight,
  Cog,
  FileStack,
  TrendingUp,
  Leaf,
  ExternalLink,
  Radio,
  Brain,
  Target,
  Calculator,
  Activity,
  Zap,
  AlertTriangle,
  Search,
  type LucideIcon
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { GlobalSearchModal } from '../Search/GlobalSearchModal';
import { LanguageSelector } from '../Language/LanguageSelector';
import { Embleme, NOM_PRODUIT, SOUS_TITRE_PRODUIT } from '../Brand/Marque';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  children?: MenuItem[];
}

const getMenuItems = (t: (key: string) => string): MenuItem[] => [
  { id: 'dashboard', label: t('menu.dashboard'), icon: LayoutDashboard },
  {
    id: 'fleet',
    label: t('menu.fleet'),
    icon: Truck,
    children: [
      { id: 'vehicles', label: t('menu.vehicles'), icon: Truck },
      { id: 'tires', label: t('menu.tires'), icon: CircleDot },
      { id: 'documents', label: t('menu.documents'), icon: FileStack },
    ]
  },
  { id: 'drivers', label: t('menu.drivers'), icon: Users },
  { id: 'trips', label: t('menu.trips'), icon: MapPin },
  {
    id: 'fleet-optimizer',
    label: t('menu.fleetOptimizer'),
    icon: Zap,
    children: [
      { id: 'fleet-optimizer', label: t('menu.optimization'), icon: Zap },
    ]
  },
  {
    id: 'tracking',
    label: t('menu.tracking'),
    icon: MapPinned,
    children: [
      { id: 'fleet-intelligence', label: t('menu.fleetIntelligence'), icon: Radio },
      { id: 'gps-tracking', label: t('menu.gpsTracking'), icon: MapPinned },
      { id: 'geofencing', label: t('menu.geofencing'), icon: Gauge },
      { id: 'route-history', label: t('menu.routeHistory'), icon: TrendingUp },
    ]
  },
  {
    id: 'fuel-menu',
    label: t('menu.fuel'),
    icon: Fuel,
    children: [
      { id: 'fuel-dashboard', label: t('menu.fuelDashboard'), icon: Brain },
      { id: 'fuel', label: t('menu.fuelTransactions'), icon: Fuel },
      { id: 'fuel-anomalies', label: t('menu.fuelAnomalies'), icon: AlertTriangle },
      { id: 'fuel-stocks', label: t('menu.fuelStocks'), icon: Package },
      { id: 'fuel-sensors', label: t('menu.fuelSensors'), icon: Gauge },
    ]
  },
  {
    id: 'maintenance-management',
    label: t('menu.maintenance'),
    icon: Wrench,
    children: [
      { id: 'maintenance', label: t('menu.repairOrders'), icon: Wrench },
      { id: 'preventive', label: t('menu.preventiveMaintenance'), icon: Cog },
    ]
  },
  {
    id: 'inventory',
    label: t('menu.inventory'),
    icon: Package,
    children: [
      { id: 'stock', label: t('menu.stock'), icon: Package },
      { id: 'purchases', label: t('menu.purchases'), icon: ShoppingCart },
      { id: 'suppliers', label: t('menu.suppliers'), icon: Users },
    ]
  },
  {
    id: 'financial',
    label: t('menu.financial'),
    icon: Banknote,
    children: [
      { id: 'invoices', label: t('menu.invoicing'), icon: FileText },
      { id: 'costs', label: t('menu.costs'), icon: Banknote },
    ]
  },
  {
    id: 'hr',
    label: t('menu.hr'),
    icon: UserCog,
    children: [
      { id: 'hr-employees', label: t('menu.employees'), icon: Users },
      { id: 'hr-attendance', label: t('menu.attendance'), icon: Cog },
      { id: 'hr-payroll', label: t('menu.payroll'), icon: Banknote },
    ]
  },
  { id: 'incidents', label: t('menu.incidents'), icon: Bell },
  { id: 'alerts', label: t('menu.alerts'), icon: Bell },
  { id: 'sites', label: t('menu.sites'), icon: MapPin },
  {
    id: 'ai-analytics',
    label: t('menu.aiAnalytics'),
    icon: Brain,
    children: [
      { id: 'predictive-maintenance', label: t('menu.predictiveMaintenance'), icon: Brain },
      { id: 'driver-behavior', label: t('menu.driverAnalytics'), icon: Target },
      { id: 'fleet-health', label: t('menu.fleetHealth'), icon: Activity },
      { id: 'tco-analysis', label: t('menu.tcoAnalysis'), icon: Calculator },
      { id: 'notifications', label: t('menu.notifications'), icon: Bell },
      { id: 'quick-actions', label: t('menu.quickActions'), icon: Zap },
    ]
  },
  { id: 'reports', label: t('menu.reports'), icon: BarChart3 },
  { id: 'iot-dashboard', label: t('menu.iotSensors'), icon: Radio },
  { id: 'esg-tracking', label: t('menu.sustainability'), icon: Leaf },
  { id: 'client-portal', label: t('menu.clientPortal'), icon: ExternalLink },
  { id: 'settings', label: t('menu.settings'), icon: Settings },
];

export const Sidebar = ({ currentView, onViewChange }: SidebarProps) => {
  const { profile, signOut, canAccessModule } = useAuth();
  const { t } = useLanguage();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['fleet', 'tracking', 'fuel-menu', 'ai-analytics']));
  const [showSearchModal, setShowSearchModal] = useState(false);
  const menuItems = getMenuItems(t);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearchModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    const Icon = item.icon;
    const isActive = currentView === item.id;
    const isExpanded = expandedItems.has(item.id);
    const hasChildren = item.children && item.children.length > 0;

    const canAccess = hasChildren || canAccessModule(item.id);
    if (!canAccess && level > 0) return null;

    const accessibleChildren = hasChildren
      ? item.children!.filter(child => canAccessModule(child.id))
      : [];

    if (hasChildren && accessibleChildren.length === 0) return null;

    return (
      <div key={item.id}>
        <button
          onClick={() => {
            if (hasChildren) {
              toggleExpand(item.id);
            } else {
              onViewChange(item.id);
            }
          }}
          className={`w-full flex items-center gap-3 py-2.5 pr-4 transition-all border-l-4 ${
            level > 0 ? 'pl-11 text-[13px]' : 'pl-5'
          } ${
            isActive
              ? 'bg-gradient-to-r from-bauxite-600/30 to-transparent text-white border-bauxite-400'
              : 'border-transparent text-stone-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-bauxite-300' : ''}`} />
          <span className="font-medium flex-1 text-left text-sm">{item.label}</span>
          {item.badge && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {item.badge}
            </span>
          )}
          {hasChildren && (
            isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          )}
        </button>
        {hasChildren && isExpanded && (
          <div className="bg-black/20">
            {accessibleChildren.map(child => renderMenuItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative w-64 flex-shrink-0 bg-[#1a1411] text-white flex flex-col h-screen shadow-2xl overflow-hidden">
      {/* Gradins de fosse en filigrane, bas du menu */}
      <svg viewBox="0 0 256 160" className="pointer-events-none absolute bottom-0 left-0 w-full opacity-[0.18]" aria-hidden="true">
        <path d="M0 40 L256 40 L256 160 L0 160 Z" fill="#5e281c" />
        <path d="M20 70 L236 70 L236 160 L20 160 Z" fill="#8f371f" />
        <path d="M44 100 L212 100 L212 160 L44 160 Z" fill="#b04524" />
        <path d="M70 128 L186 128 L186 160 L70 160 Z" fill="#c95a32" />
      </svg>

      <div className="relative px-5 pt-6 pb-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Embleme className="w-11 h-11 flex-shrink-0" />
          <div>
            <p className="text-xl font-black tracking-tight">{NOM_PRODUIT}</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-bauxite-300">{SOUS_TITRE_PRODUIT}</p>
          </div>
        </div>
        {profile && (
          <div className="mt-5 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-bauxite-700 text-sm font-bold">
              {profile.full_name?.trim().charAt(0).toUpperCase() || '?'}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{profile.full_name}</p>
              <p className="text-xs capitalize text-stone-400">{profile.role.replace(/_/g, ' ')}</p>
            </div>
          </div>
        )}
      </div>

      <div className="relative px-4 py-3 border-b border-white/10">
        <button
          onClick={() => setShowSearchModal(true)}
          className="w-full flex items-center gap-3 px-3 py-2.5 bg-white/5 hover:bg-white/10 text-stone-300 hover:text-white rounded-lg transition-all"
        >
          <Search className="w-4 h-4 text-bauxite-300" />
          <span className="text-sm flex-1 text-left">{t('common.search')}...</span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[11px] font-semibold text-stone-400 bg-black/30 border border-white/10 rounded">
            Ctrl K
          </kbd>
        </button>
      </div>

      <nav className="relative flex-1 overflow-y-auto py-2 scrollbar-thin">
        {menuItems.map((item) => renderMenuItem(item))}
      </nav>

      <div className="relative p-4 border-t border-white/10 bg-black/30 backdrop-blur-sm space-y-2">
        <LanguageSelector />
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-stone-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/20 border border-transparent rounded-lg transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium text-sm">{t('menu.logout')}</span>
        </button>
      </div>

      <GlobalSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
      />
    </div>
  );
};
