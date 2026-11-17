// Rubriques du menu lateral (maquette du proprietaire, 2026-11-09).
import {
  LayoutDashboard, Truck, Users, MapPin, Fuel, Wrench, FileText, BarChart3, Settings,
  CircleDot, Package, ShoppingCart, Banknote, UserCog, Bell, MapPinned, Gauge,
  Cog, FileStack, TrendingUp, Leaf, Radio, Brain,
  Target, Calculator, Activity, AlertTriangle, CalendarDays, Route, Waypoints,
  ShieldAlert, Briefcase, Timer, ClipboardList, Scale, Wallet, Handshake, Receipt, Building, BadgeCheck, ClipboardCheck, Inbox, Armchair, Clock, type LucideIcon,
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
  { id: 'mes-validations', label: 'Mes validations', icon: Inbox },
  { id: 'centre-pilotage', label: 'Centre de pilotage', icon: Gauge },
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
      { id: 'shifts', label: 'Shifts', icon: Clock },
      { id: 'infrastructures', label: 'Infrastructures et fermetures', icon: Building },
      { id: 'alerts', label: 'Centre des décisions', icon: Bell },
    ],
  },
  { id: 'planification', label: 'Planification', icon: CalendarDays },
  { id: 'postes', label: 'Postes de travail', icon: Timer },
  { id: 'dispatch', label: 'Dispatch', icon: Waypoints },
  { id: 'trips', label: 'Voyages & Rotations', icon: Route },
  { id: 'kilometrage', label: 'Kilométrage', icon: Gauge },
  { id: 'fiches', label: 'Fiches terrain', icon: ClipboardList },
  { id: 'tickets-cbg', label: 'Pesée CBG', icon: Scale },
  // Espace Operations transport (D-088) : regroupe la chaine sans retirer les
  // acces directs ci-dessus. Les entrees « op-* » sont des alias (ALIAS_MENU)
  // qui ouvrent l'ecran du module avec le contexte de l'adresse.
  {
    id: 'operations-transport',
    label: 'Opérations transport',
    icon: Route,
    children: [
      { id: 'operations', label: 'Vue générale', icon: LayoutDashboard },
      { id: 'op-planification', label: 'Objectifs planifiés', icon: CalendarDays },
      { id: 'op-postes', label: 'Instances de shift', icon: Timer },
      { id: 'op-dispatch', label: 'Affectation des voyages', icon: Waypoints },
      { id: 'op-voyages', label: 'Registre des voyages', icon: Route },
      { id: 'op-fiches', label: 'Cycle des fiches', icon: ClipboardList },
      { id: 'op-pesee', label: 'Tickets et relevés CBG', icon: Scale },
      { id: 'op-supervision', label: 'Supervision du jour', icon: Gauge },
      { id: 'operations-anomalies', label: 'Anomalies et écarts', icon: AlertTriangle },
      { id: 'operations-journal', label: 'Journal des événements', icon: Activity },
      { id: 'operations-controles', label: 'Contrôles et clôtures', icon: ClipboardCheck },
    ],
  },
  {
    id: 'flotte',
    label: 'Flotte',
    icon: Truck,
    children: [
      { id: 'vehicles', label: 'Véhicules et engins', icon: Truck },
      { id: 'drivers', label: 'Chauffeurs', icon: Users },
      { id: 'habilitations', label: 'Habilitations chauffeurs', icon: BadgeCheck },
      { id: 'documents', label: 'Documents', icon: FileStack },
    ],
  },
  {
    id: 'carburant',
    label: 'Carburant',
    icon: Fuel,
    children: [
      { id: 'fuel', label: 'Distribution aux engins', icon: Fuel },
      { id: 'livraisons-cbg', label: 'Livraisons et factures CBG', icon: Receipt },
      { id: 'fuel-stocks', label: 'Réceptions, cuves et inventaires', icon: Package },
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
      { id: 'interventions-loueur', label: 'Interventions Neemba', icon: Wrench },
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
      { id: 'moyens-generaux', label: 'Moyens généraux et patrimoine', icon: Armchair },
      { id: 'purchases', label: 'Achats', icon: ShoppingCart },
      { id: 'suppliers', label: 'Fournisseurs', icon: Briefcase },
    ],
  },
  {
    id: 'finance',
    label: 'Contrats & Finance',
    icon: Banknote,
    children: [
      { id: 'mon-poste', label: 'Mon tableau de bord', icon: LayoutDashboard },
      { id: 'contrats', label: 'Dossier contractuel', icon: FileStack },
      { id: 'engagements', label: 'Engagements et rapport', icon: Target },
      { id: 'comites', label: 'Comités de contrat', icon: Handshake },
      { id: 'reconciliation', label: 'Réconciliation mensuelle', icon: Scale },
      { id: 'invoices', label: 'Facturation', icon: FileText },
      { id: 'recouvrement', label: 'Recouvrement', icon: Wallet },
      { id: 'factures-neemba', label: 'Contrôle factures Neemba', icon: Receipt },
      { id: 'evaluation-loueur', label: 'Évaluation Neemba', icon: BadgeCheck },
      { id: 'paiements', label: 'Paiements fournisseurs', icon: Wallet },
      { id: 'budgets', label: 'Budgets et comptabilité', icon: Calculator },
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
      { id: 'controles-depart', label: 'Contrôles avant départ', icon: ClipboardCheck },
      { id: 'incidents', label: 'Incidents', icon: ShieldAlert },
      { id: 'hse-prevention', label: 'Prévention HSE', icon: ClipboardList },
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
    ],
  },
  { id: 'settings', label: 'Paramètres', icon: Settings },
];

/** Alias du menu Operations transport (D-088) : entree -> ecran du module. */
export const ALIAS_MENU: Record<string, string> = {
  'op-planification': 'planification',
  'op-postes': 'postes',
  'op-dispatch': 'dispatch',
  'op-voyages': 'trips',
  'op-fiches': 'fiches',
  'op-pesee': 'tickets-cbg',
  'op-supervision': 'centre-pilotage',
};

/** Ecran reellement ouvert par une entree du menu. */
export const resoudreVue = (id: string): string => ALIAS_MENU[id] ?? id;

/** Ecrans de l'espace Operations transport : le contexte de l'adresse les suit. */
export const VUES_OPERATIONS = new Set(['operations', 'operations-journal', 'operations-anomalies', 'operations-controles',
  'planification', 'postes', 'shifts', 'dispatch', 'trips', 'fiches', 'tickets-cbg', 'kilometrage']);

/** Libelle d'un ecran, pour l'entete. */
export const libelleVue = (id: string): string => {
  for (const item of MENU) {
    if (item.id === id) return item.label;
    const enfant = item.children?.find((c) => c.id === id);
    if (enfant) return enfant.label;
  }
  return NOM_PRODUIT;
};

