import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  BarChart3, TrendingUp, Download, DollarSign, Truck, Fuel,
  Calendar, FileText, Filter, RefreshCw
} from 'lucide-react';

export const ReportsView = () => {
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchStats();
  }, [period]);

  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(now.toISOString().split('T')[0]);
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);

      const dateFilter = getDateFilter();

      const [tripsRes, fuelRes, costsRes, invoicesRes, maintenanceRes] = await Promise.all([
        supabase
          .from('trips')
          .select('*, vehicles(registration)')
          .gte('planned_date', dateFilter.start)
          .lte('planned_date', dateFilter.end),
        supabase
          .from('fuel_transactions')
          .select('*')
          .gte('transaction_date', dateFilter.start)
          .lte('transaction_date', dateFilter.end),
        supabase
          .from('costs')
          .select('*')
          .gte('date', dateFilter.start)
          .lte('date', dateFilter.end),
        supabase
          .from('invoices')
          .select('*')
          .gte('invoice_date', dateFilter.start)
          .lte('invoice_date', dateFilter.end),
        supabase
          .from('maintenance_orders')
          .select('*')
          .gte('order_date', dateFilter.start)
          .lte('order_date', dateFilter.end),
      ]);

      const trips = tripsRes.data || [];
      const fuel = fuelRes.data || [];
      const costs = costsRes.data || [];
      const invoices = invoicesRes.data || [];
      const maintenance = maintenanceRes.data || [];

      const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
      const totalCosts = costs.reduce((sum, c) => sum + (c.amount || 0), 0);
      const totalFuelCost = fuel.reduce((sum, f) => sum + (f.total_cost || 0), 0);
      const totalMaintenanceCost = maintenance.reduce((sum, m) => sum + (m.total_cost || 0), 0);

      const totalDistance = trips.reduce((sum, t) => {
        const km = (t.km_end || 0) - (t.km_start || 0);
        return sum + km;
      }, 0);

      const totalFuelVolume = fuel.reduce((sum, f) => sum + (f.volume_liters || 0), 0);

      setStats({
        trips: trips.length,
        completedTrips: trips.filter((t) => t.status === 'completed').length,
        totalDistance,
        avgDistancePerTrip: trips.length > 0 ? totalDistance / trips.length : 0,
        totalRevenue,
        totalCosts: totalCosts + totalFuelCost + totalMaintenanceCost,
        profit: totalRevenue - (totalCosts + totalFuelCost + totalMaintenanceCost),
        profitMargin: totalRevenue > 0 ? ((totalRevenue - (totalCosts + totalFuelCost + totalMaintenanceCost)) / totalRevenue) * 100 : 0,
        totalFuelCost,
        totalFuelVolume,
        avgFuelConsumption: totalDistance > 0 ? (totalFuelVolume / totalDistance) * 100 : 0,
        totalMaintenanceCost,
        maintenanceOrders: maintenance.length,
        invoicesCount: invoices.length,
        paidInvoices: invoices.filter((i) => i.status === 'paid').length,
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateFilter = () => {
    const now = new Date();
    let start = new Date();

    if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'quarter') {
      const quarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), quarter * 3, 1);
    } else if (period === 'year') {
      start = new Date(now.getFullYear(), 0, 1);
    } else if (period === 'custom') {
      return {
        start: startDate,
        end: endDate,
      };
    }

    return {
      start: start.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
    };
  };

  const formatCurrency = (amount: number) => {
    return `${(amount / 1000000).toFixed(2)}M GNF`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Rapports et Analyses</h1>
          <p className="text-slate-600 mt-1">Tableaux de bord et analyses de performance</p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-4 mb-4">
          <Filter className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold">Période d'analyse</h3>
        </div>
        <div className="flex flex-wrap gap-4">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg"
          >
            <option value="month">Ce mois</option>
            <option value="quarter">Ce trimestre</option>
            <option value="year">Cette année</option>
            <option value="custom">Période personnalisée</option>
          </select>
          {period === 'custom' && (
            <>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg"
              />
              <button
                onClick={fetchStats}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
              >
                Appliquer
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-blue-100">Voyages</p>
            <Truck className="w-8 h-8 text-blue-300" />
          </div>
          <p className="text-3xl font-bold">{stats.completedTrips}/{stats.trips}</p>
          <p className="text-xs text-blue-200 mt-1">complétés</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-green-100">Revenus</p>
            <DollarSign className="w-8 h-8 text-green-300" />
          </div>
          <p className="text-3xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
          <p className="text-xs text-green-200 mt-1">Marge: {stats.profitMargin.toFixed(1)}%</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-700 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-orange-100">Coûts totaux</p>
            <TrendingUp className="w-8 h-8 text-orange-300" />
          </div>
          <p className="text-3xl font-bold">{formatCurrency(stats.totalCosts)}</p>
          <p className="text-xs text-orange-200 mt-1">Profit: {formatCurrency(stats.profit)}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-purple-100">Distance totale</p>
            <BarChart3 className="w-8 h-8 text-purple-300" />
          </div>
          <p className="text-3xl font-bold">{stats.totalDistance.toLocaleString()}</p>
          <p className="text-xs text-purple-200 mt-1">km parcourus</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Fuel className="w-5 h-5 text-blue-600" />
            Consommation Carburant
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg">
              <span className="text-sm text-slate-600">Volume total</span>
              <span className="font-semibold">{stats.totalFuelVolume.toFixed(0)} L</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg">
              <span className="text-sm text-slate-600">Coût total</span>
              <span className="font-semibold">{formatCurrency(stats.totalFuelCost)}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg">
              <span className="text-sm text-slate-600">Consommation moyenne</span>
              <span className="font-semibold">{stats.avgFuelConsumption.toFixed(2)} L/100km</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-green-600" />
            Facturation
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg">
              <span className="text-sm text-slate-600">Factures émises</span>
              <span className="font-semibold">{stats.invoicesCount}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg">
              <span className="text-sm text-slate-600">Factures payées</span>
              <span className="font-semibold text-green-600">{stats.paidInvoices}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg">
              <span className="text-sm text-slate-600">Taux de paiement</span>
              <span className="font-semibold">
                {stats.invoicesCount > 0 ? ((stats.paidInvoices / stats.invoicesCount) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-slate-700" />
          Performance des Voyages
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg">
            <p className="text-sm text-slate-600 mb-2">Distance moyenne par voyage</p>
            <p className="text-3xl font-bold text-slate-900">{stats.avgDistancePerTrip.toFixed(0)}</p>
            <p className="text-xs text-slate-500 mt-1">kilomètres</p>
          </div>
          <div className="text-center p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg">
            <p className="text-sm text-slate-600 mb-2">Revenu moyen par voyage</p>
            <p className="text-3xl font-bold text-slate-900">
              {stats.completedTrips > 0 ? formatCurrency(stats.totalRevenue / stats.completedTrips) : '0M GNF'}
            </p>
            <p className="text-xs text-slate-500 mt-1">par trajet</p>
          </div>
          <div className="text-center p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg">
            <p className="text-sm text-slate-600 mb-2">Ordres de maintenance</p>
            <p className="text-3xl font-bold text-slate-900">{stats.maintenanceOrders}</p>
            <p className="text-xs text-slate-500 mt-1">{formatCurrency(stats.totalMaintenanceCost)} dépensés</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <button className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow text-left">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Download className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Rapport complet</h3>
          </div>
          <p className="text-sm text-slate-600 mb-4">Export PDF de toutes les statistiques</p>
          <span className="text-sm font-medium text-blue-600">Télécharger</span>
        </button>

        <button className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow text-left">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Export Excel</h3>
          </div>
          <p className="text-sm text-slate-600 mb-4">Données détaillées au format Excel</p>
          <span className="text-sm font-medium text-green-600">Télécharger</span>
        </button>

        <button className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow text-left">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-orange-50 rounded-lg">
              <Calendar className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Rapport mensuel</h3>
          </div>
          <p className="text-sm text-slate-600 mb-4">Synthèse mensuelle automatique</p>
          <span className="text-sm font-medium text-orange-600">Télécharger</span>
        </button>
      </div>
    </div>
  );
};
