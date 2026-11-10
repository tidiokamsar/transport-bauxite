import { useState, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { LoginPage } from './components/Auth/LoginPage';
import { Sidebar } from './components/Layout/Sidebar';
import { libelleVue } from './components/Layout/menu';
import { TopBar } from './components/Layout/TopBar';
import { BandeauDemonstration } from './components/Layout/BandeauDemonstration';
import { SiteProvider } from './contexts/SiteContext';
import { DashboardView } from './components/Dashboard/DashboardView';
import OfflineIndicator from './components/Offline/OfflineIndicator';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import { Embleme } from './components/Brand/Marque';

const VehiclesView = lazy(() => import('./components/Vehicles/VehiclesView').then(m => ({ default: m.VehiclesView })));
const DriversView = lazy(() => import('./components/Drivers/DriversView').then(m => ({ default: m.DriversView })));
const PlanificationView = lazy(() => import('./components/Planning/PlanificationView').then(m => ({ default: m.PlanificationView })));
const DispatchView = lazy(() => import('./components/Dispatch/DispatchView').then(m => ({ default: m.DispatchView })));
const TripsView = lazy(() => import('./components/Trips/TripsView').then(m => ({ default: m.TripsView })));
const FuelView = lazy(() => import('./components/Fuel/FuelViewEnhanced').then(m => ({ default: m.FuelViewEnhanced })));
const FuelDashboard = lazy(() => import('./components/Fuel/FuelIntelligentDashboard').then(m => ({ default: m.FuelIntelligentDashboard })));
const FuelAnomaliesView = lazy(() => import('./components/Fuel/FuelAnomaliesView').then(m => ({ default: m.FuelAnomaliesView })));
const FuelStocksView = lazy(() => import('./components/Fuel/FuelStocksView').then(m => ({ default: m.FuelStocksView })));
const MaintenanceView = lazy(() => import('./components/Maintenance/MaintenanceView').then(m => ({ default: m.MaintenanceView })));
const InvoicesView = lazy(() => import('./components/Invoices/InvoicesView').then(m => ({ default: m.InvoicesView })));
const ReportsView = lazy(() => import('./components/Reports/ReportsView').then(m => ({ default: m.ReportsView })));
const AdminSettingsView = lazy(() => import('./components/Settings/AdminSettingsView').then(m => ({ default: m.AdminSettingsView })));
const CompleteTireManagement = lazy(() => import('./components/TireManagement/CompleteTireManagement'));
const GPSTrackingView = lazy(() => import('./components/Tracking/GPSTrackingView').then(m => ({ default: m.GPSTrackingView })));
const RouteHistoryView = lazy(() => import('./components/Tracking/RouteHistoryView').then(m => ({ default: m.RouteHistoryView })));
const FleetIntelligenceView = lazy(() => import('./components/Tracking/FleetIntelligenceView').then(m => ({ default: m.FleetIntelligenceView })));
const FuelSensorsView = lazy(() => import('./components/Fuel/FuelSensorsView').then(m => ({ default: m.FuelSensorsView })));
const PreventiveMaintenanceView = lazy(() => import('./components/Maintenance/PreventiveMaintenanceView').then(m => ({ default: m.PreventiveMaintenanceView })));
const StockView = lazy(() => import('./components/Stock/StockView').then(m => ({ default: m.StockView })));
const PurchasesView = lazy(() => import('./components/Purchases/PurchasesView').then(m => ({ default: m.PurchasesView })));
const SuppliersView = lazy(() => import('./components/Suppliers/SuppliersView').then(m => ({ default: m.SuppliersView })));
const EmployeesView = lazy(() => import('./components/HR/EmployeesView').then(m => ({ default: m.EmployeesView })));
const AttendanceView = lazy(() => import('./components/HR/AttendanceView').then(m => ({ default: m.AttendanceView })));
const PayrollView = lazy(() => import('./components/HR/PayrollView').then(m => ({ default: m.PayrollView })));
const CostsView = lazy(() => import('./components/Costs/CostsView').then(m => ({ default: m.CostsView })));
const VehicleDocumentsView = lazy(() => import('./components/Documents/VehicleDocumentsView').then(m => ({ default: m.VehicleDocumentsView })));
const ClientPortalView = lazy(() => import('./components/ClientPortal/ClientPortalView').then(m => ({ default: m.ClientPortalView })));
const ESGTrackingView = lazy(() => import('./components/ESG/ESGTrackingView').then(m => ({ default: m.ESGTrackingView })));
const IoTDashboardView = lazy(() => import('./components/IoT/IoTDashboardView').then(m => ({ default: m.IoTDashboardView })));
const GeofencingView = lazy(() => import('./components/Geofencing/GeofencingView'));
const IncidentsView = lazy(() => import('./components/Incidents/IncidentsView').then(m => ({ default: m.IncidentsView })));
const AlertsView = lazy(() => import('./components/Alerts/AlertsView').then(m => ({ default: m.AlertsView })));
const SitesView = lazy(() => import('./components/Sites/SitesView').then(m => ({ default: m.SitesView })));
const PredictiveMaintenanceView = lazy(() => import('./components/AI/PredictiveMaintenanceView'));
const DriverBehaviorAnalyticsView = lazy(() => import('./components/AI/DriverBehaviorAnalyticsView'));
const TCOAnalysisView = lazy(() => import('./components/Analytics/TCOAnalysisView'));
const FleetHealthDashboard = lazy(() => import('./components/Analytics/FleetHealthDashboard'));
const SmartNotificationCenter = lazy(() => import('./components/Notifications/SmartNotificationCenter'));
const QuickActionsPanel = lazy(() => import('./components/QuickActions/QuickActionsPanel'));
const FleetOptimizerView = lazy(() => import('./components/FleetOptimizer/FleetOptimizerView').then(m => ({ default: m.FleetOptimizerView })));

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-96 animate-fade-in">
    <div className="text-center">
      <div className="relative">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-stone-200 mx-auto mb-4"></div>
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-transparent border-t-bauxite-600 absolute top-0 left-1/2 -translate-x-1/2"></div>
      </div>
      <p className="text-slate-600 font-medium animate-pulse">Chargement du module...</p>
    </div>
  </div>
);

const MainApp = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1411] flex flex-col items-center justify-center gap-6">
        <Embleme className="w-16 h-16 animate-pulse" />
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-bauxite-400 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'vehicles':
        return <VehiclesView />;
      case 'tires':
        return <CompleteTireManagement />;
      case 'tire-management':
        return <CompleteTireManagement />;
      case 'tire-lifecycle':
        return <CompleteTireManagement />;
      case 'documents':
        return <VehicleDocumentsView />;
      case 'drivers':
        return <DriversView />;
      case 'trips':
        return <TripsView />;
      case 'fleet-optimizer':
        return <FleetOptimizerView />;
      case 'fleet-intelligence':
        return <FleetIntelligenceView />;
      case 'gps-tracking':
        return <GPSTrackingView />;
      case 'geofencing':
        return <GeofencingView />;
      case 'route-history':
        return <RouteHistoryView />;
      case 'fuel':
        return <FuelView />;
      case 'fuel-dashboard':
        return <FuelDashboard />;
      case 'fuel-anomalies':
        return <FuelAnomaliesView />;
      case 'fuel-stocks':
        return <FuelStocksView />;
      case 'fuel-sensors':
        return <FuelSensorsView />;
      case 'maintenance':
        return <MaintenanceView />;
      case 'preventive':
        return <PreventiveMaintenanceView />;
      case 'stock':
        return <StockView />;
      case 'purchases':
        return <PurchasesView />;
      case 'suppliers':
        return <SuppliersView />;
      case 'invoices':
        return <InvoicesView />;
      case 'costs':
        return <CostsView />;
      case 'hr-employees':
        return <EmployeesView />;
      case 'hr-attendance':
        return <AttendanceView />;
      case 'hr-payroll':
        return <PayrollView />;
      case 'reports':
        return <ReportsView />;
      case 'client-portal':
        return <ClientPortalView />;
      case 'esg-tracking':
        return <ESGTrackingView />;
      case 'iot-dashboard':
        return <IoTDashboardView />;
      case 'incidents':
        return <IncidentsView />;
      case 'alerts':
        return <AlertsView />;
      case 'sites':
        return <SitesView />;
      case 'predictive-maintenance':
        return <PredictiveMaintenanceView />;
      case 'driver-behavior':
        return <DriverBehaviorAnalyticsView />;
      case 'fleet-health':
        return <FleetHealthDashboard />;
      case 'tco-analysis':
        return <TCOAnalysisView />;
      case 'notifications':
        return <SmartNotificationCenter />;
      case 'quick-actions':
        return <QuickActionsPanel onNavigate={setCurrentView} />;
      case 'settings':
        return <AdminSettingsView />;
      case 'planification':
        return <PlanificationView />;
      case 'dispatch':
        return <DispatchView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-sable">
        <Sidebar currentView={currentView} onViewChange={setCurrentView} />
        <div className="flex min-w-0 flex-1 flex-col">
        <BandeauDemonstration />
        <TopBar
          sousTitre={currentView === 'dashboard' ? 'Vue globale des opérations de transport de bauxite' : libelleVue(currentView)}
          onAllerA={setCurrentView}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 xl:p-8">
            <Suspense fallback={<LoadingFallback />}>
              <div className="animate-fade-in">
                {renderView()}
              </div>
            </Suspense>
          </div>
        </main>
        </div>
        <OfflineIndicator />
      </div>
    </ErrorBoundary>
  );
};

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <SiteProvider>
          <MainApp />
        </SiteProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
