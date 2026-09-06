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
  Search
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { GlobalSearchModal } from '../Search/GlobalSearchModal';
import { LanguageSelector } from '../Language/LanguageSelector';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: any;
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
          className={`w-full flex items-center gap-3 px-6 py-3 transition-all ${
            level > 0 ? 'pl-12' : ''
          } ${
            isActive
              ? 'bg-slate-800 text-white border-l-4 border-blue-500'
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
          }`}
        >
          <Icon className="w-5 h-5 flex-shrink-0" />
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
          <div className="bg-slate-900/50">
            {accessibleChildren.map(child => renderMenuItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col h-screen shadow-2xl">
      <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-slate-800">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-gradient-to-br from-orange-500 to-red-600 p-3 rounded-xl shadow-lg">
            <Truck className="w-10 h-10 text-white" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-orange-400 via-red-400 to-orange-500 bg-clip-text text-transparent">
              DARI HOLDING
            </h1>
            <p className="text-xs text-slate-400">Gestion Transport Bauxite</p>
          </div>
        </div>
        {profile && (
          <div className="mt-4 pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Utilisateur</p>
            <p className="text-sm font-semibold truncate mt-1">{profile.full_name}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <p className="text-xs text-slate-400 capitalize">{profile.role.replace('_', ' ')}</p>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-b border-slate-800">
        <button
          onClick={() => setShowSearchModal(true)}
          className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all group"
        >
          <Search className="w-5 h-5 text-blue-400" />
          <span className="text-sm flex-1 text-left">{t('common.search')}...</span>
          <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-semibold text-slate-400 bg-slate-700 border border-slate-600 rounded">
            ⌘K
          </kbd>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
        {menuItems.map((item) => renderMenuItem(item))}
      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-900/50 space-y-2">
        <LanguageSelector />
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 border border-transparent rounded-lg transition-all"
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
