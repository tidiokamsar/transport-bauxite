import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Truck, Users, MapPin, DollarSign, AlertTriangle, TrendingUp,
  Fuel, Wrench, FileText, Package, Clock, Calendar, Activity,
  CheckCircle, XCircle, AlertCircle, TrendingDown, BarChart3, PieChart,
  Navigation, Zap, Shield, Target
} from 'lucide-react';

interface DashboardStats {
  activeVehicles: number;
  totalVehicles: number;
  activeDrivers: number;
  totalDrivers: number;
  todayTrips: number;
  monthTrips: number;
  totalTonnage: number;
  averageTonnage: number;
  fuelConsumption: number;
  fuelStock: number;
  lowFuelStock: number;
  pendingMaintenance: number;
  completedMaintenance: number;
  lowStockParts: number;
  totalRevenue: number;
  paidInvoices: number;
  unpaidInvoices: number;
  overdueInvoices: number;
  outstandingBalance: number;
  totalCosts: number;
  fuelCosts: number;
  maintenanceCosts: number;
  tireCosts: number;
  insuranceCosts: number;
}

interface RecentActivity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  icon: any;
  color: string;
}

const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'blue',
  onClick
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: any;
  trend?: string;
  color?: string;
  onClick?: () => void;
}) => {
  const colorClasses = {
    blue: 'bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 shadow-blue-100',
    green: 'bg-gradient-to-br from-green-50 to-green-100 text-green-600 shadow-green-100',
    orange: 'bg-gradient-to-br from-orange-50 to-orange-100 text-orange-600 shadow-orange-100',
    red: 'bg-gradient-to-br from-red-50 to-red-100 text-red-600 shadow-red-100',
    slate: 'bg-gradient-to-br from-slate-50 to-slate-100 text-slate-600 shadow-slate-100',
    purple: 'bg-gradient-to-br from-purple-50 to-purple-100 text-purple-600 shadow-purple-100',
    indigo: 'bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-600 shadow-indigo-100',
  }[color];

  return (
    <div
      className={`bg-white rounded-2xl shadow-lg border-2 border-slate-100 p-6 hover:shadow-xl hover:scale-105 transition-all duration-300 ${onClick ? 'cursor-pointer' : ''} group`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-600 mb-2 uppercase tracking-wide">{title}</p>
          <p className="text-4xl font-black text-slate-900 mb-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-slate-500 mt-2 font-medium">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-3 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
              <p className="text-sm font-semibold">{trend}</p>
            </div>
          )}
        </div>
        <div className={`p-4 rounded-2xl ${colorClasses} flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="w-8 h-8" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
};

export const DashboardView = () => {
  const [stats, setStats] = useState<DashboardStats>({
    activeVehicles: 0,
    totalVehicles: 0,
    activeDrivers: 0,
    totalDrivers: 0,
    todayTrips: 0,
    monthTrips: 0,
    totalTonnage: 0,
    averageTonnage: 0,
    fuelConsumption: 0,
    fuelStock: 0,
    lowFuelStock: 0,
    pendingMaintenance: 0,
    completedMaintenance: 0,
    lowStockParts: 0,
    totalRevenue: 0,
    paidInvoices: 0,
    unpaidInvoices: 0,
    overdueInvoices: 0,
    outstandingBalance: 0,
    totalCosts: 0,
    fuelCosts: 0,
    maintenanceCosts: 0,
    tireCosts: 0,
    insuranceCosts: 0,
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const today = new Date().toISOString().split('T')[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

      const [
        vehiclesRes,
        activeVehiclesRes,
        driversRes,
        activeDriversRes,
        todayTripsRes,
        monthTripsRes,
        fuelStockRes,
        fuelTransactionsRes,
        maintenanceRes,
        completedMaintenanceRes,
        recentMaintenanceRes,
        partsInventoryRes,
        invoicesRes,
        paymentsRes,
        costsRes,
        recentTripsRes,
      ] = await Promise.all([
        supabase.from('vehicles').select('id', { count: 'exact' }),
        supabase.from('vehicles').select('id', { count: 'exact' }).eq('status', 'active'),
        supabase.from('drivers').select('id', { count: 'exact' }),
        supabase.from('drivers').select('id', { count: 'exact' }).eq('status', 'active'),
        supabase
          .from('trips')
          .select('load_weight')
          .gte('start_date', today),
        supabase
          .from('trips')
          .select('load_weight')
          .gte('start_date', monthStart),
        supabase
          .from('fuel_stocks')
          .select('current_stock'),
        supabase
          .from('fuel_transactions')
          .select('quantity, transaction_date')
          .gte('transaction_date', monthStart),
        supabase
          .from('maintenance_orders')
          .select('id', { count: 'exact' })
          .in('status', ['open', 'in_progress']),
        supabase
          .from('maintenance_orders')
          .select('id', { count: 'exact' })
          .eq('status', 'completed')
          .gte('completion_date', monthStart),
        supabase
          .from('maintenance_orders')
          .select('id, description, created_at, vehicles(registration_number)')
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('stock_items')
          .select('quantity, minimum_quantity'),
        supabase
          .from('invoices')
          .select('total_amount, amount_paid, status, due_date'),
        supabase
          .from('payments')
          .select('amount, payment_date')
          .gte('payment_date', monthStart)
          .order('payment_date', { ascending: false })
          .limit(5),
        supabase
          .from('costs')
          .select('amount, category_id, cost_categories(name)')
          .gte('date', monthStart),
        supabase
          .from('trips')
          .select('id, status, start_date, vehicles(registration_number), drivers(first_name, last_name)')
          .order('start_date', { ascending: false })
          .limit(3),
      ]);

      const todayTrips = todayTripsRes.data || [];
      const monthTrips = monthTripsRes.data || [];
      const fuelStocks = fuelStockRes.data || [];
      const fuelTransactions = fuelTransactionsRes.data || [];
      const partsInventory = partsInventoryRes.data || [];
      const invoices = invoicesRes.data || [];
      const costs = costsRes.data || [];
      const recentMaintenance = recentMaintenanceRes.data || [];
      const recentTrips = recentTripsRes.data || [];

      const totalTonnageToday = todayTrips.reduce((sum, trip) => sum + (trip.load_weight || 0), 0);
      const totalTonnageMonth = monthTrips.reduce((sum, trip) => sum + (trip.load_weight || 0), 0);
      const avgTonnage = monthTrips.length > 0 ? totalTonnageMonth / monthTrips.length : 0;
      const totalFuelConsumed = fuelTransactions.reduce((sum, tx) => sum + (tx.quantity || 0), 0);

      const totalFuelStock = fuelStocks.reduce((sum, stock) => sum + (stock.current_stock || 0), 0);
      const lowFuelStock = fuelStocks.filter(stock => (stock.current_stock || 0) <= (stock.minimum_stock || 5000)).length;

      const lowStockParts = partsInventory.filter(part => (part.quantity || 0) <= (part.minimum_quantity || 0)).length;

      const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
      const paidInvoices = invoices.filter(inv => inv.status === 'paid').length;
      const unpaidInvoices = invoices.filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled').length;
      const overdueInvoices = invoices.filter(inv => {
        if (inv.status === 'paid' || inv.status === 'cancelled') return false;
        return new Date(inv.due_date) < new Date();
      }).length;
      const outstandingBalance = invoices.reduce((sum, inv) => {
        const balance = (inv.total_amount || 0) - (inv.amount_paid || 0);
        return sum + (balance > 0 ? balance : 0);
      }, 0);

      const totalCosts = costs.reduce((sum, cost) => sum + (cost.amount || 0), 0);
      const fuelCosts = costs.filter((cost: any) => cost.cost_categories?.name === 'Carburant').reduce((sum, cost) => sum + (cost.amount || 0), 0);
      const maintenanceCosts = costs.filter((cost: any) => ['Entretien courant', 'Réparations'].includes(cost.cost_categories?.name)).reduce((sum, cost) => sum + (cost.amount || 0), 0);
      const tireCosts = costs.filter((cost: any) => cost.cost_categories?.name === 'Pneus').reduce((sum, cost) => sum + (cost.amount || 0), 0);
      const insuranceCosts = costs.filter((cost: any) => cost.cost_categories?.name === 'Assurances').reduce((sum, cost) => sum + (cost.amount || 0), 0);

      setStats({
        activeVehicles: activeVehiclesRes.count || 0,
        totalVehicles: vehiclesRes.count || 0,
        activeDrivers: activeDriversRes.count || 0,
        totalDrivers: driversRes.count || 0,
        todayTrips: todayTrips.length,
        monthTrips: monthTrips.length,
        totalTonnage: Math.round(totalTonnageMonth),
        averageTonnage: Math.round(avgTonnage * 10) / 10,
        fuelConsumption: Math.round(totalFuelConsumed),
        fuelStock: Math.round(totalFuelStock),
        lowFuelStock,
        pendingMaintenance: maintenanceRes.count || 0,
        completedMaintenance: completedMaintenanceRes.count || 0,
        lowStockParts,
        totalRevenue,
        paidInvoices,
        unpaidInvoices,
        overdueInvoices,
        outstandingBalance,
        totalCosts,
        fuelCosts,
        maintenanceCosts,
        tireCosts,
        insuranceCosts,
      });

      const activities: RecentActivity[] = [];

      // Ajouter les voyages récents
      recentTrips.forEach((trip: any) => {
        const statusLabels: any = {
          'completed': 'Voyage complété',
          'in_progress': 'Voyage en cours',
          'planned': 'Voyage planifié'
        };
        const vehicleReg = trip.vehicles?.registration_number || 'N/A';
        const driverName = trip.drivers ? `${trip.drivers.first_name} ${trip.drivers.last_name}` : 'N/A';
        activities.push({
          id: `trip-${trip.id}`,
          type: 'trip',
          description: `${statusLabels[trip.status] || trip.status} - ${vehicleReg} (${driverName})`,
          timestamp: trip.start_date,
          icon: MapPin,
          color: 'text-blue-600 bg-blue-50',
        });
      });

      // Ajouter les maintenances récentes
      recentMaintenance.forEach((maintenance: any) => {
        const vehicleReg = maintenance.vehicles?.registration_number || 'N/A';
        activities.push({
          id: `maintenance-${maintenance.id}`,
          type: 'maintenance',
          description: `Maintenance: ${maintenance.description} (${vehicleReg})`,
          timestamp: maintenance.created_at,
          icon: Wrench,
          color: 'text-orange-600 bg-orange-50',
        });
      });

      // Ajouter les paiements récents
      const recentPayments = paymentsRes.data || [];
      recentPayments.forEach(payment => {
        activities.push({
          id: `payment-${Math.random()}`,
          type: 'payment',
          description: `Paiement reçu: ${((payment.amount || 0) / 1000000).toFixed(2)}M GNF`,
          timestamp: payment.payment_date,
          icon: DollarSign,
          color: 'text-green-600 bg-green-50',
        });
      });

      // Trier par date décroissante
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      if (activities.length === 0) {
        activities.push({
          id: '1',
          type: 'info',
          description: 'Système opérationnel',
          timestamp: new Date().toISOString(),
          icon: Activity,
          color: 'text-blue-600 bg-blue-50',
        });
      }

      setRecentActivities(activities.slice(0, 5));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  const alerts = [];
  if (stats.pendingMaintenance > 0) {
    alerts.push({
      icon: Wrench,
      color: 'orange',
      title: `${stats.pendingMaintenance} maintenance(s) en attente`,
      description: 'Vérifiez les ordres de maintenance',
    });
  }
  if (stats.lowFuelStock > 0) {
    alerts.push({
      icon: Fuel,
      color: 'red',
      title: `${stats.lowFuelStock} type(s) de carburant en stock faible`,
      description: 'Réapprovisionnement recommandé',
    });
  }
  if (stats.lowStockParts > 0) {
    alerts.push({
      icon: Package,
      color: 'orange',
      title: `${stats.lowStockParts} pièce(s) en stock faible`,
      description: 'Commandez les pièces détachées',
    });
  }
  if (stats.overdueInvoices > 0) {
    alerts.push({
      icon: AlertTriangle,
      color: 'red',
      title: `${stats.overdueInvoices} facture(s) en retard`,
      description: 'Relancez vos clients',
    });
  }

  const profitMargin = stats.totalRevenue - stats.totalCosts;
  const profitPercentage = stats.totalRevenue > 0 ? ((profitMargin / stats.totalRevenue) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header avec gradient */}
      <div className="bg-gradient-to-r from-orange-500 via-red-600 to-orange-700 rounded-3xl shadow-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-black mb-2">Tableau de bord DARI HOLDING</h1>
              <p className="text-orange-100 text-lg font-medium">Vue d'ensemble de vos opérations de transport de bauxite</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
              <Truck className="w-16 h-16" strokeWidth={1.5} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <p className="text-sm text-orange-100 font-medium mb-1">Véhicules actifs</p>
              <p className="text-3xl font-black">{stats.activeVehicles}/{stats.totalVehicles}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <p className="text-sm text-orange-100 font-medium mb-1">Voyages ce mois</p>
              <p className="text-3xl font-black">{stats.monthTrips}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <p className="text-sm text-orange-100 font-medium mb-1">Tonnage transporté</p>
              <p className="text-3xl font-black">{stats.totalTonnage}T</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <p className="text-sm text-orange-100 font-medium mb-1">Chauffeurs actifs</p>
              <p className="text-3xl font-black">{stats.activeDrivers}/{stats.totalDrivers}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Véhicules actifs"
          value={stats.activeVehicles}
          subtitle={`sur ${stats.totalVehicles} total`}
          icon={Truck}
          color="blue"
        />
        <StatCard
          title="Chauffeurs actifs"
          value={stats.activeDrivers}
          subtitle={`sur ${stats.totalDrivers} total`}
          icon={Users}
          color="green"
        />
        <StatCard
          title="Voyages aujourd'hui"
          value={stats.todayTrips}
          subtitle={`${stats.monthTrips} ce mois`}
          icon={MapPin}
          color="blue"
        />
        <StatCard
          title="Tonnage moyen"
          value={`${stats.averageTonnage} T`}
          subtitle={`${stats.totalTonnage}T au total`}
          icon={TrendingUp}
          color="green"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Stock carburant"
          value={`${stats.fuelStock}L`}
          subtitle={stats.lowFuelStock > 0 ? `${stats.lowFuelStock} alerte(s)` : 'Stock normal'}
          icon={Fuel}
          color={stats.lowFuelStock > 0 ? 'red' : 'blue'}
        />
        <StatCard
          title="Maintenance"
          value={stats.pendingMaintenance}
          subtitle={`${stats.completedMaintenance} terminées ce mois`}
          icon={Wrench}
          color={stats.pendingMaintenance > 0 ? 'orange' : 'green'}
        />
        <StatCard
          title="Pièces détachées"
          value={stats.lowStockParts}
          subtitle="alertes de stock"
          icon={Package}
          color={stats.lowStockParts > 0 ? 'orange' : 'green'}
        />
        <StatCard
          title="Facturation"
          value={stats.unpaidInvoices}
          subtitle={`${stats.paidInvoices} payées`}
          icon={FileText}
          color={stats.overdueInvoices > 0 ? 'red' : 'blue'}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Revenus du mois</h3>
            <DollarSign className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-4xl font-bold mb-2">
            {(stats.totalRevenue / 1000000).toFixed(1)}M
          </p>
          <p className="text-sm opacity-90">GNF</p>
          <div className="mt-4 pt-4 border-t border-green-400">
            <div className="flex justify-between text-sm">
              <span>Factures payées</span>
              <span className="font-semibold">{stats.paidInvoices}</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">En attente</h3>
            <Clock className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-4xl font-bold mb-2">
            {(stats.outstandingBalance / 1000000).toFixed(1)}M
          </p>
          <p className="text-sm opacity-90">GNF</p>
          <div className="mt-4 pt-4 border-t border-orange-400">
            <div className="flex justify-between text-sm">
              <span>Factures impayées</span>
              <span className="font-semibold">{stats.unpaidInvoices}</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Carburant</h3>
            <Fuel className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-4xl font-bold mb-2">
            {stats.fuelConsumption}L
          </p>
          <p className="text-sm opacity-90">Consommation ce mois</p>
          <div className="mt-4 pt-4 border-t border-blue-400">
            <div className="flex justify-between text-sm">
              <span>Stock disponible</span>
              <span className="font-semibold">{stats.fuelStock}L</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Alertes récentes</h2>
            <AlertTriangle className="w-5 h-5 text-orange-600" />
          </div>
          <div className="space-y-3">
            {alerts.length > 0 ? (
              alerts.map((alert, index) => {
                const colorClasses = {
                  orange: 'bg-orange-50 border-orange-200 text-orange-600',
                  red: 'bg-red-50 border-red-200 text-red-600',
                  green: 'bg-green-50 border-green-200 text-green-600',
                }[alert.color];

                return (
                  <div key={index} className={`flex items-start gap-3 p-3 rounded-lg border ${colorClasses}`}>
                    <alert.icon className="w-5 h-5 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{alert.title}</p>
                      <p className="text-xs text-slate-600 mt-1">{alert.description}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-sm text-slate-700">Aucune alerte, tout fonctionne normalement</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Activité récente</h2>
            <Activity className="w-5 h-5 text-blue-600" />
          </div>
          <div className="space-y-3">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-3 hover:bg-slate-50 rounded-lg transition-colors">
                <div className={`p-2 rounded-lg ${activity.color}`}>
                  <activity.icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">{activity.description}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(activity.timestamp).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-600">OPÉRATIONS</h3>
            <MapPin className="w-5 h-5 text-blue-600" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Voyages ce mois</span>
              <span className="text-lg font-bold text-slate-900">{stats.monthTrips}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Tonnage total</span>
              <span className="text-lg font-bold text-slate-900">{stats.totalTonnage}T</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Carburant consommé</span>
              <span className="text-lg font-bold text-slate-900">{stats.fuelConsumption}L</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-600">FLOTTE</h3>
            <Truck className="w-5 h-5 text-blue-600" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Véhicules actifs</span>
              <span className="text-lg font-bold text-green-600">{stats.activeVehicles}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Chauffeurs actifs</span>
              <span className="text-lg font-bold text-green-600">{stats.activeDrivers}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">En maintenance</span>
              <span className="text-lg font-bold text-orange-600">{stats.pendingMaintenance}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-600">FINANCES</h3>
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Factures payées</span>
              <span className="text-lg font-bold text-green-600">{stats.paidInvoices}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">En attente</span>
              <span className="text-lg font-bold text-orange-600">{stats.unpaidInvoices}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">En retard</span>
              <span className="text-lg font-bold text-red-600">{stats.overdueInvoices}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
