import { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { LoginPage } from './components/Auth/LoginPage';
import { VerificationMfa } from './components/Auth/VerificationMfa';
import { verificationRequise, type NiveauAssurance } from './components/Auth/mfa';
import { supabase } from './lib/supabase';
import { Sidebar } from './components/Layout/Sidebar';
import { VUES_OPERATIONS, libelleVue, resoudreVue } from './components/Layout/menu';
import { avecContexte, contexteDepuisRequete } from './components/Operations/journal';
import { TopBar } from './components/Layout/TopBar';
import { BandeauDemonstration } from './components/Layout/BandeauDemonstration';
import { SiteProvider } from './contexts/SiteContext';
import { DashboardView } from './components/Dashboard/DashboardView';
import OfflineIndicator from './components/Offline/OfflineIndicator';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import { Embleme } from './components/Brand/Marque';
import { EVENEMENT_ALLER_A } from './components/ui/navigation';
import { lireRoute, naviguer, routeListe, useRoute } from './components/ui/routeur';

const lireRouteCourante = () => lireRoute(window.location.hash);

const VehiclesView = lazy(() => import('./components/Vehicles/VehiclesView').then(m => ({ default: m.VehiclesView })));
const DriversView = lazy(() => import('./components/Drivers/DriversView').then(m => ({ default: m.DriversView })));
const PlanificationView = lazy(() => import('./components/Planning/PlanificationView').then(m => ({ default: m.PlanificationView })));
const DispatchView = lazy(() => import('./components/Dispatch/DispatchView').then(m => ({ default: m.DispatchView })));
const ImmobilisationsView = lazy(() => import('./components/Maintenance/ImmobilisationsView').then(m => ({ default: m.ImmobilisationsView })));
const ContratsView = lazy(() => import('./components/Contrats/ContratsView').then(m => ({ default: m.ContratsView })));
const FichesView = lazy(() => import('./components/Fiches/FichesView').then(m => ({ default: m.FichesView })));
const MonPosteView = lazy(() => import('./components/Contrats/MonPosteView').then(m => ({ default: m.MonPosteView })));
const EngagementsView = lazy(() => import('./components/Contrats/EngagementsView').then(m => ({ default: m.EngagementsView })));
const ComitesView = lazy(() => import('./components/Contrats/ComitesView').then(m => ({ default: m.ComitesView })));
const RecouvrementView = lazy(() => import('./components/Facturation/RecouvrementView').then(m => ({ default: m.RecouvrementView })));
const FacturesNeembaView = lazy(() => import('./components/Contrats/FacturesNeembaView').then(m => ({ default: m.FacturesNeembaView })));
const TripsView = lazy(() => import('./components/Trips/TripsView').then(m => ({ default: m.TripsView })));
const SecuriteCompte = lazy(() => import('./components/Auth/SecuriteCompte').then(m => ({ default: m.SecuriteCompte })));
const PostesView = lazy(() => import('./components/Postes/PostesView').then(m => ({ default: m.PostesView })));
const InterventionsLoueurView = lazy(() => import('./components/Maintenance/InterventionsLoueurView').then(m => ({ default: m.InterventionsLoueurView })));
const TicketsCbgView = lazy(() => import('./components/Fiches/TicketsCbgView').then(m => ({ default: m.TicketsCbgView })));
const HabilitationsView = lazy(() => import('./components/Drivers/HabilitationsView').then(m => ({ default: m.HabilitationsView })));
const KilometrageView = lazy(() => import('./components/Trips/KilometrageView').then(m => ({ default: m.KilometrageView })));
const FuelView = lazy(() => import('./components/Fuel/PleinsView').then(m => ({ default: m.PleinsView })));
const LivraisonsCbgView = lazy(() => import('./components/Fuel/LivraisonsCbgView').then(m => ({ default: m.LivraisonsCbgView })));
const FuelDashboard = lazy(() => import('./components/Fuel/AnalyseCarburantView').then(m => ({ default: m.AnalyseCarburantView })));
const FuelAnomaliesView = lazy(() => import('./components/Fuel/AnomaliesCarburantView').then(m => ({ default: m.AnomaliesCarburantView })));
const StocksCarburantView = lazy(() => import('./components/Fuel/StocksCarburantView').then(m => ({ default: m.StocksCarburantView })));
const MaintenanceView = lazy(() => import('./components/Maintenance/MaintenanceView').then(m => ({ default: m.MaintenanceView })));
const FacturesView = lazy(() => import('./components/Facturation/FacturesView').then(m => ({ default: m.FacturesView })));
const ReconciliationView = lazy(() => import('./components/Facturation/ReconciliationView').then(m => ({ default: m.ReconciliationView })));
const ReportsView = lazy(() => import('./components/Reports/ReportsView').then(m => ({ default: m.ReportsView })));
const AdminSettingsView = lazy(() => import('./components/Settings/AdminSettingsView').then(m => ({ default: m.AdminSettingsView })));
const PneusView = lazy(() => import('./components/Pneus/PneusView').then(m => ({ default: m.PneusView })));
const MoyensGenerauxView = lazy(() => import('./components/MoyensGeneraux/MoyensGenerauxView').then(m => ({ default: m.MoyensGenerauxView })));
const GPSTrackingView = lazy(() => import('./components/Tracking/GPSTrackingView').then(m => ({ default: m.GPSTrackingView })));
const RouteHistoryView = lazy(() => import('./components/Tracking/RouteHistoryView').then(m => ({ default: m.RouteHistoryView })));
const FleetIntelligenceView = lazy(() => import('./components/Tracking/FleetIntelligenceView').then(m => ({ default: m.FleetIntelligenceView })));
const FuelSensorsView = lazy(() => import('./components/Fuel/CapteursCarburantView').then(m => ({ default: m.CapteursCarburantView })));
const PreventiveMaintenanceView = lazy(() => import('./components/Maintenance/PreventiveMaintenanceView').then(m => ({ default: m.PreventiveMaintenanceView })));
const StockView = lazy(() => import('./components/Stock/StockView').then(m => ({ default: m.StockView })));
const PurchasesView = lazy(() => import('./components/Purchases/PurchasesView').then(m => ({ default: m.PurchasesView })));
const SuppliersView = lazy(() => import('./components/Suppliers/SuppliersView').then(m => ({ default: m.SuppliersView })));
const EmployeesView = lazy(() => import('./components/HR/EmployeesView').then(m => ({ default: m.EmployeesView })));
const AttendanceView = lazy(() => import('./components/HR/AttendanceView').then(m => ({ default: m.AttendanceView })));
const PayrollView = lazy(() => import('./components/HR/PayrollView').then(m => ({ default: m.PayrollView })));
const CostsView = lazy(() => import('./components/Costs/CostsView').then(m => ({ default: m.CostsView })));
const VehicleDocumentsView = lazy(() => import('./components/Documents/VehicleDocumentsView').then(m => ({ default: m.VehicleDocumentsView })));
const ESGTrackingView = lazy(() => import('./components/ESG/ESGTrackingView').then(m => ({ default: m.ESGTrackingView })));
const IoTDashboardView = lazy(() => import('./components/IoT/IoTDashboardView').then(m => ({ default: m.IoTDashboardView })));
const GeofencingView = lazy(() => import('./components/Geofencing/GeofencingView'));
const ControlesDepartView = lazy(() => import('./components/Hse/ControlesDepartView').then(m => ({ default: m.ControlesDepartView })));
const PaiementsView = lazy(() => import('./components/Paiements/PaiementsView').then(m => ({ default: m.PaiementsView })));
const FinanceView = lazy(() => import('./components/Finance/FinanceView').then(m => ({ default: m.FinanceView })));
const EvaluationLoueurView = lazy(() => import('./components/Contrats/EvaluationLoueurView').then(m => ({ default: m.EvaluationLoueurView })));
const IncidentsView = lazy(() => import('./components/Incidents/IncidentsView').then(m => ({ default: m.IncidentsView })));
const CentreDecisionsView = lazy(() => import('./components/Decisions/CentreDecisionsView').then(m => ({ default: m.CentreDecisionsView })));
const HsePreventionView = lazy(() => import('./components/Hse/HsePreventionView').then(m => ({ default: m.HsePreventionView })));
const SitesView = lazy(() => import('./components/Sites/SitesView').then(m => ({ default: m.SitesView })));
const ShiftsView = lazy(() => import('./components/Shifts/ShiftsView').then(m => ({ default: m.ShiftsView })));
const InfrastructuresView = lazy(() => import('./components/Sites/InfrastructuresView').then(m => ({ default: m.InfrastructuresView })));
const PredictiveMaintenanceView = lazy(() => import('./components/Analyses/AnalysesFlotte').then(m => ({ default: m.FiabiliteEnginsView })));
const DriverBehaviorAnalyticsView = lazy(() => import('./components/Analyses/AnalysesFlotte').then(m => ({ default: m.PerformanceChauffeursView })));
const TCOAnalysisView = lazy(() => import('./components/Analyses/AnalysesFlotte').then(m => ({ default: m.CoutTonneView })));
const FleetHealthDashboard = lazy(() => import('./components/Analyses/AnalysesFlotte').then(m => ({ default: m.SanteFlotteView })));
const CentrePilotageView = lazy(() => import('./components/Pilotage/CentrePilotageView').then(m => ({ default: m.CentrePilotageView })));
const OperationsView = lazy(() => import('./components/Operations/OperationsView').then(m => ({ default: m.OperationsView })));
const MesValidationsView = lazy(() => import('./components/Notifications/MesValidationsView').then(m => ({ default: m.MesValidationsView })));
const QuickActionsPanel = lazy(() => import('./components/QuickActions/QuickActionsPanel'));

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
  const { user, loading, signOut } = useAuth();
  // Ecran courant porte par l'adresse (#/<vue>/..., D-090) : bouton retour
  // du navigateur, lien partageable ; le menu ouvre la liste telle qu'elle a
  // ete laissee (filtres conserves pendant la session).
  const route = useRoute();
  const currentView = route.vue || 'dashboard';
  // Menu (D-088) : un alias de l'espace Operations transport ouvre l'ecran
  // du module ; entre ecrans de cet espace, le contexte (date, site, shift,
  // camion, chauffeur, voyage, rotation) suit dans l'adresse.
  const setCurrentView = useCallback((entree: string) => {
    const vue = resoudreVue(entree);
    const depuis = lireRouteCourante();
    const garder = VUES_OPERATIONS.has(vue) && VUES_OPERATIONS.has(depuis.vue);
    naviguer(garder ? avecContexte(routeListe(vue), contexteDepuisRequete(depuis.requete)) : routeListe(vue));
  }, []);
  const principal = useRef<HTMLElement>(null);
  const cleRoute = `${route.vue}/${route.mode}/${route.id ?? ''}/${route.action ?? ''}`;
  useEffect(() => { principal.current?.scrollTo?.({ top: 0 }); }, [cleRoute]);
  // Double authentification (D-045) : un compte avec facteur verifie passe
  // par le code TOTP avant d'entrer ; null = niveau pas encore lu.
  const [niveau, setNiveau] = useState<NiveauAssurance | null>(null);
  const lireNiveau = useCallback(async () => {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setNiveau(data ? { currentLevel: data.currentLevel, nextLevel: data.nextLevel } : { currentLevel: null, nextLevel: null });
  }, []);
  useEffect(() => { if (user) lireNiveau(); else setNiveau(null); }, [user, lireNiveau]);
  // Liens des etats vides vers l'ecran de parametrage manquant (D-078).
  useEffect(() => {
    const aller = (e: Event) => { const vue = (e as CustomEvent<string>).detail; if (vue) setCurrentView(vue); };
    window.addEventListener(EVENEMENT_ALLER_A, aller);
    return () => window.removeEventListener(EVENEMENT_ALLER_A, aller);
  }, [setCurrentView]);

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

  if (verificationRequise(niveau)) {
    return <VerificationMfa onVerifie={lireNiveau} onDeconnexion={signOut} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'vehicles':
        return <VehiclesView />;
      case 'tires':
        return <PneusView />;
      case 'documents':
        return <VehicleDocumentsView />;
      case 'drivers':
        return <DriversView />;
      case 'trips':
        return <TripsView />;
      case 'securite-compte':
        return <SecuriteCompte />;
      case 'postes':
        return <PostesView />;
      case 'tickets-cbg':
        return <TicketsCbgView />;
      case 'habilitations':
        return <HabilitationsView />;
      case 'kilometrage':
        return <KilometrageView />;
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
      case 'livraisons-cbg':
        return <LivraisonsCbgView />;
      case 'fuel-dashboard':
        return <FuelDashboard />;
      case 'fuel-anomalies':
        return <FuelAnomaliesView />;
      case 'fuel-stocks':
        return <StocksCarburantView />;
      case 'fuel-sensors':
        return <FuelSensorsView />;
      case 'interventions-loueur':
        return <InterventionsLoueurView />;
      case 'immobilisations':
        return <ImmobilisationsView />;
      case 'maintenance':
        return <MaintenanceView />;
      case 'preventive':
        return <PreventiveMaintenanceView />;
      case 'stock':
        return <StockView />;
      case 'moyens-generaux':
        return <MoyensGenerauxView />;
      case 'purchases':
        return <PurchasesView />;
      case 'suppliers':
        return <SuppliersView />;
      case 'fiches':
        return <FichesView />;
      case 'mon-poste':
        return <MonPosteView />;
      case 'engagements':
        return <EngagementsView />;
      case 'comites':
        return <ComitesView />;
      case 'factures-neemba':
        return <FacturesNeembaView />;
      case 'recouvrement':
        return <RecouvrementView />;
      case 'contrats':
        return <ContratsView />;
      case 'reconciliation':
        return <ReconciliationView onFactureCreee={() => setCurrentView('invoices')} />;
      case 'invoices':
        return <FacturesView />;
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
      case 'esg-tracking':
        return <ESGTrackingView />;
      case 'iot-dashboard':
        return <IoTDashboardView />;
      case 'controles-depart':
        return <ControlesDepartView />;
      case 'paiements':
        return <PaiementsView />;
      case 'budgets':
        return <FinanceView />;
      case 'evaluation-loueur':
        return <EvaluationLoueurView />;
      case 'incidents':
        return <IncidentsView />;
      case 'alerts':
        return <CentreDecisionsView onAllerA={setCurrentView} />;
      case 'hse-prevention':
        return <HsePreventionView />;
      case 'sites':
        return <SitesView />;
      case 'infrastructures':
        return <InfrastructuresView />;
      case 'shifts':
        return <ShiftsView />;
      case 'predictive-maintenance':
        return <PredictiveMaintenanceView />;
      case 'driver-behavior':
        return <DriverBehaviorAnalyticsView />;
      case 'fleet-health':
        return <FleetHealthDashboard />;
      case 'tco-analysis':
        return <TCOAnalysisView />;
      case 'centre-pilotage':
        return <CentrePilotageView />;
      case 'mes-validations':
      case 'notifications':
        return <MesValidationsView onAllerA={setCurrentView} />;
      case 'quick-actions':
        return <QuickActionsPanel onNavigate={setCurrentView} />;
      case 'settings':
        return <AdminSettingsView />;
      case 'planification':
        return <PlanificationView />;
      case 'dispatch':
        return <DispatchView />;
      case 'operations':
      case 'operations-journal':
      case 'operations-anomalies':
      case 'operations-controles':
        return <OperationsView />;
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
          sousTitre={currentView === 'dashboard' ? 'Vue globale des opérations de transport de bauxite' : currentView === 'securite-compte' ? 'Sécurité du compte' : libelleVue(currentView)}
          onAllerA={setCurrentView}
        />
        <main ref={principal} className="flex-1 overflow-y-auto">
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
