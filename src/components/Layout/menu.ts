// Rubriques du menu lateral (maquette du proprietaire, 2026-11-09).
import {
  LayoutDashboard, Truck, Users, MapPin, Fuel, Wrench, FileText, BarChart3, Settings,
  CircleDot, Package, ShoppingCart, Banknote, UserCog, Bell, MapPinned, Gauge,
  Cog, FileStack, TrendingUp, Leaf, ExternalLink, Radio, Brain,
  Target, Calculator, Activity, AlertTriangle, CalendarDays, Route, Waypoints,
  ShieldAlert, Briefcase, Timer, ClipboardList, Scale, type LucideIcon,
} from 'lucide-react';
import { NOM_PRODUIT } from '../Brand/Marque';

export interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  children?: MenuItem[];
}

export const MENU: MenuItem[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  {
    id: 'exploitation',
    label: 'Exploitation',
    icon: Truck,
    children: [
      { id: 'gps-tracking', label: 'Suivi GPS', icon: MapPinned },
      { id: 'fleet-intelligence', label: 'Intelligence flotte', icon: Radio },
      { id: 'route-history', label: 'Historique des trajets', icon: TrendingUp },
      { id: 'geofencing', label: 'Géorepérage', icon: Gauge },
      { id: 'sites', label: 'Sites', icon: MapPin },
      { id: 'alerts', label: 'Alertes', icon: Bell },
    ],
  },
  { id: 'planification', label: 'Planification', icon: CalendarDays },
  { id: 'dispatch', label: 'Dispatch', icon: Waypoints },
  { id: 'trips', label: 'Voyages & Rotations', icon: Route },
  { id: 'fiches', label: 'Fiches terrain', icon: ClipboardList },
  {
    id: 'flotte',
    label: 'Flotte',
    icon: Truck,
    children: [
      { id: 'vehicles', label: 'Véhicules et engins', icon: Truck },
      { id: 'drivers', label: 'Chauffeurs', icon: Users },
      { id: 'documents', label: 'Documents', icon: FileStack },
    ],
  },
  {
    id: 'carburant',
    label: 'Carburant',
    icon: Fuel,
    children: [
      { id: 'fuel', label: 'Pleins et cuves', icon: Fuel },
      { id: 'fuel-stocks', label: 'Stocks et cuves', icon: Package },
      { id: 'fuel-dashboard', label: 'Analyse carburant', icon: Brain },
      { id: 'fuel-anomalies', label: 'Anomalies', icon: AlertTriangle },
      { id: 'fuel-sensors', label: 'Jauges connectées', icon: Gauge },
    ],
  },
  {
    id: 'maintenance-groupe',
    label: 'Maintenance',
    icon: Wrench,
    children: [
      { id: 'immobilisations', label: 'Immobilisations', icon: Timer },
      { id: 'maintenance', label: 'Ordres de travail', icon: Wrench },
      { id: 'preventive', label: 'Préventif', icon: Cog },
    ],
  },
  { id: 'tires', label: 'Pneus', icon: CircleDot },
  {
    id: 'stocks-achats',
    label: 'Stocks & Achats',
    icon: Package,
    children: [
      { id: 'stock', label: 'Stocks', icon: Package },
      { id: 'purchases', label: 'Achats', icon: ShoppingCart },
      { id: 'suppliers', label: 'Fournisseurs', icon: Briefcase },
    ],
  },
  {
    id: 'finance',
    label: 'Contrats & Finance',
    icon: Banknote,
    children: [
      { id: 'contrats', label: 'Dossier contractuel', icon: FileStack },
      { id: 'reconciliation', label: 'Réconciliation mensuelle', icon: Scale },
      { id: 'invoices', label: 'Facturation', icon: FileText },
      { id: 'costs', label: 'Coûts', icon: Banknote },
    ],
  },
  {
    id: 'rh-securite',
    label: 'RH & Sécurité',
    icon: UserCog,
    children: [
      { id: 'hr-employees', label: 'Employés', icon: Users },
      { id: 'hr-attendance', label: 'Présences', icon: Cog },
      { id: 'hr-payroll', label: 'Paie', icon: Banknote },
      { id: 'incidents', label: 'Incidents', icon: ShieldAlert },
    ],
  },
  {
    id: 'reporting',
    label: 'Reporting & Analyse',
    icon: BarChart3,
    children: [
      { id: 'reports', label: 'Rapports', icon: BarChart3 },
      { id: 'tco-analysis', label: 'Coût direct par tonne', icon: Calculator },
      { id: 'fleet-health', label: 'Santé de la flotte', icon: Activity },
      { id: 'predictive-maintenance', label: 'Fiabilité des engins', icon: Brain },
      { id: 'driver-behavior', label: 'Performance chauffeurs', icon: Target },
      { id: 'iot-dashboard', label: 'Capteurs IoT', icon: Radio },
      { id: 'esg-tracking', label: 'Environnement', icon: Leaf },
      { id: 'notifications', label: 'Notifications', icon: Bell },
      { id: 'client-portal', label: 'Portail client', icon: ExternalLink },
    ],
  },
  { id: 'settings', label: 'Paramètres', icon: Settings },
];

/** Libelle d'un ecran, pour l'entete. */
export const libelleVue = (id: string): string => {
  for (const item of MENU) {
    if (item.id === id) return item.label;
    const enfant = item.children?.find((c) => c.id === id);
    if (enfant) return enfant.label;
  }
  return NOM_PRODUIT;
};

