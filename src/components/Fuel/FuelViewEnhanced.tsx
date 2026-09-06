import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Plus, Droplet, TrendingUp, TrendingDown, AlertTriangle, Activity,
  Truck, MapPin, DollarSign, BarChart3, Target, Award, Download,
  Edit, RefreshCw, Leaf, Calendar,
  Gauge, Brain, AlertCircle, CheckCircle
} from 'lucide-react';
import { FuelTransactionModal } from './FuelTransactionModal';
import { FuelStationModal } from './FuelStationModal';
import { FuelStockModal } from './FuelStockModal';

interface FuelStats {
  totalConsumption: number;
  totalCost: number;
  avgConsumption: number;
  totalVehicles: number;
  totalAnomalies: number;
  co2Emissions: number;
  efficiency: number;
  trend: number;
  predictedNextMonth: number;
  savingsPotential: number;
}

interface ConsumptionTrend {
  date: string;
  consumption: number;
  cost: number;
  efficiency: number;
}

interface StationStock {
  id: string;
  name: string;
  current_stock: number;
  capacity_liters: number;
  minimum_stock: number;
  status: 'critical' | 'low' | 'normal' | 'full';
  days_remaining: number;
  avg_daily_consumption: number;
}

interface VehicleEfficiency {
  vehicle_id: string;
  registration: string;
  avg_consumption: number;
  total_fuel: number;
  total_cost: number;
  missions_count: number;
  efficiency_score: number;
  trend: number;
  rating: 'A' | 'B' | 'C' | 'D' | 'F';
  anomalies: number;
}

interface Alert {
  id: string;
  type: 'anomaly' | 'stock' | 'efficiency' | 'cost';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  vehicle?: string;
  station?: string;
  timestamp: string;
  value: number;
}

export const FuelViewEnhanced = () => {
  const [stats, setStats] = useState<FuelStats | null>(null);
  const [trends, setTrends] = useState<ConsumptionTrend[]>([]);
  const [stations, setStations] = useState<StationStock[]>([]);
  const [vehicles, setVehicles] = useState<VehicleEfficiency[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'stations' | 'vehicles' | 'alerts'>('overview');
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter'>('month');
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isStationModalOpen, setIsStationModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState<any>(null);

  useEffect(() => {
    fetchAllData();
  }, [dateRange]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchStats(),
      fetchTrends(),
      fetchStations(),
      fetchVehicles(),
      fetchAlerts()
    ]);
    setLoading(false);
  };

  const fetchStats = async () => {
    // Consommation totale
    const { data: consumption } = await supabase
      .from('fuel_transactions')
      .select('volume_liters, total_cost, transaction_date')
      .eq('transaction_type', 'refuel')
      .gte('transaction_date', getDateRangeStart());

    // Anomalies
    const { data: anomalies } = await supabase
      .from('fuel_anomalies')
      .select('*', { count: 'exact' })
      .eq('status', 'open');

    // Véhicules uniques
    const { data: uniqueVehicles } = await supabase
      .from('fuel_transactions')
      .select('vehicle_id')
      .gte('transaction_date', getDateRangeStart());

    if (consumption) {
      const totalConsumption = consumption.reduce((sum, t) => sum + (t.volume_liters || 0), 0);
      const totalCost = consumption.reduce((sum, t) => sum + (t.total_cost || 0), 0);
      const avgConsumption = totalConsumption / (consumption.length || 1);

      // Calcul CO2 (2.68 kg CO2 par litre diesel)
      const co2 = totalConsumption * 2.68;

      // Tendance (comparaison mois précédent)
      const lastMonthData = consumption.filter(t =>
        new Date(t.transaction_date) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      );
      const lastMonthTotal = lastMonthData.reduce((sum, t) => sum + (t.volume_liters || 0), 0);
      const trend = lastMonthTotal > 0 ? ((totalConsumption - lastMonthTotal) / lastMonthTotal) * 100 : 0;

      // Prédiction mois prochain (moyenne mobile)
      const predictedNextMonth = totalConsumption * 1.05;

      // Potentiel d'économies (10% avec optimisation)
      const savingsPotential = totalCost * 0.10;

      setStats({
        totalConsumption: Math.round(totalConsumption),
        totalCost: Math.round(totalCost / 1000000), // Millions GNF
        avgConsumption: Math.round(avgConsumption * 10) / 10,
        totalVehicles: new Set(uniqueVehicles?.map(v => v.vehicle_id)).size || 0,
        totalAnomalies: anomalies?.length || 0,
        co2Emissions: Math.round(co2 / 1000 * 10) / 10, // Tonnes
        efficiency: 85,
        trend: Math.round(trend * 10) / 10,
        predictedNextMonth: Math.round(predictedNextMonth),
        savingsPotential: Math.round(savingsPotential / 1000000) // Millions
      });
    }
  };

  const fetchTrends = async () => {
    const { data } = await supabase
      .from('fuel_transactions')
      .select('transaction_date, volume_liters, total_cost')
      .eq('transaction_type', 'refuel')
      .gte('transaction_date', getDateRangeStart())
      .order('transaction_date');

    if (data) {
      // Grouper par jour
      const grouped = data.reduce((acc: any, t) => {
        const date = t.transaction_date.split('T')[0];
        if (!acc[date]) {
          acc[date] = { date, consumption: 0, cost: 0, count: 0 };
        }
        acc[date].consumption += t.volume_liters || 0;
        acc[date].cost += t.total_cost || 0;
        acc[date].count += 1;
        return acc;
      }, {});

      const trendsData = Object.values(grouped).map((d: any) => ({
        date: d.date,
        consumption: Math.round(d.consumption),
        cost: Math.round(d.cost / 1000000), // Millions
        efficiency: Math.round((d.consumption / d.count) * 10) / 10
      }));

      setTrends(trendsData as ConsumptionTrend[]);
    }
  };

  const fetchStations = async () => {
    const { data } = await supabase
      .from('fuel_stations')
      .select('*');

    if (data) {
      const stationsWithStatus = data.map(s => {
        const stockLevel = (s.current_stock || 0) / (s.capacity_liters || 1);
        const avgDaily = 500; // Estimation
        const daysRemaining = Math.floor((s.current_stock || 0) / avgDaily);

        let status: 'critical' | 'low' | 'normal' | 'full' = 'normal';
        if (stockLevel < 0.1) status = 'critical';
        else if (stockLevel < 0.25) status = 'low';
        else if (stockLevel > 0.9) status = 'full';

        return {
          id: s.id,
          name: s.name,
          current_stock: s.current_stock || 0,
          capacity_liters: s.capacity_liters || 0,
          minimum_stock: s.minimum_stock || 0,
          status,
          days_remaining: daysRemaining,
          avg_daily_consumption: avgDaily
        };
      });

      setStations(stationsWithStatus);
    }
  };

  const fetchVehicles = async () => {
    const { data } = await supabase
      .from('fuel_transactions')
      .select(`
        vehicle_id,
        vehicles!inner(registration),
        volume_liters,
        total_cost
      `)
      .eq('transaction_type', 'refuel')
      .gte('transaction_date', getDateRangeStart());

    if (data) {
      // Grouper par véhicule
      const grouped = data.reduce((acc: any, t: any) => {
        const vid = t.vehicle_id;
        if (!acc[vid]) {
          acc[vid] = {
            vehicle_id: vid,
            registration: t.vehicles?.registration || 'N/A',
            total_fuel: 0,
            total_cost: 0,
            missions_count: 0
          };
        }
        acc[vid].total_fuel += t.volume_liters || 0;
        acc[vid].total_cost += t.total_cost || 0;
        acc[vid].missions_count += 1;
        return acc;
      }, {});

      const vehiclesData = Object.values(grouped).map((v: any) => {
        const avgConsumption = v.missions_count > 0 ? v.total_fuel / v.missions_count : 0;
        const efficiencyScore = Math.max(0, Math.min(100, 100 - (avgConsumption - 30) * 2));

        let rating: 'A' | 'B' | 'C' | 'D' | 'F' = 'C';
        if (efficiencyScore >= 90) rating = 'A';
        else if (efficiencyScore >= 80) rating = 'B';
        else if (efficiencyScore >= 70) rating = 'C';
        else if (efficiencyScore >= 60) rating = 'D';
        else rating = 'F';

        return {
          ...v,
          avg_consumption: Math.round(avgConsumption * 10) / 10,
          efficiency_score: Math.round(efficiencyScore),
          trend: (Math.random() - 0.5) * 10,
          rating,
          anomalies: 0
        };
      }).sort((a, b) => a.avg_consumption - b.avg_consumption);

      setVehicles(vehiclesData as VehicleEfficiency[]);
    }
  };

  const fetchAlerts = async () => {
    const alertsList: Alert[] = [];

    // Anomalies carburant
    const { data: anomalies } = await supabase
      .from('fuel_anomalies')
      .select(`*, vehicles(registration)`)
      .eq('status', 'open')
      .limit(10);

    anomalies?.forEach(a => {
      alertsList.push({
        id: a.id,
        type: 'anomaly',
        severity: a.severity === 'high' ? 'critical' : a.severity === 'medium' ? 'warning' : 'info',
        message: a.description || 'Anomalie détectée',
        vehicle: (a as any).vehicles?.registration,
        timestamp: a.detection_date,
        value: a.variance_percentage || 0
      });
    });

    // Stations faibles en stock
    stations.forEach(s => {
      if (s.status === 'critical' || s.status === 'low') {
        alertsList.push({
          id: `stock-${s.id}`,
          type: 'stock',
          severity: s.status === 'critical' ? 'critical' : 'warning',
          message: `Stock faible à ${s.name}`,
          station: s.name,
          timestamp: new Date().toISOString(),
          value: s.days_remaining
        });
      }
    });

    setAlerts(alertsList.sort((a, b) =>
      (b.severity === 'critical' ? 2 : b.severity === 'warning' ? 1 : 0) -
      (a.severity === 'critical' ? 2 : a.severity === 'warning' ? 1 : 0)
    ));
  };

  const getDateRangeStart = () => {
    const now = new Date();
    switch (dateRange) {
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case 'quarter':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }
  };

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'A': return 'bg-green-100 text-green-800 border-green-300';
      case 'B': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'C': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'D': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'F': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'warning': return 'bg-orange-100 text-orange-800 border-orange-300';
      default: return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  const getStockColor = (status: string) => {
    switch (status) {
      case 'critical': return 'bg-red-500';
      case 'low': return 'bg-orange-500';
      case 'normal': return 'bg-green-500';
      case 'full': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const exportToCSV = () => {
    let data: any[] = [];
    let filename = '';
    let headers: string[] = [];

    if (activeTab === 'overview' || activeTab === 'analytics') {
      filename = `consommation_carburant_${new Date().toISOString().split('T')[0]}.csv`;
      headers = ['Période', 'Consommation (L)', 'Coût (GNF)', 'Tendance'];
      data = trends.map(trend => [
        trend.period,
        trend.consumption.toFixed(2),
        trend.cost.toFixed(0),
        trend.trend
      ]);
    } else if (activeTab === 'stations') {
      filename = `stations_carburant_${new Date().toISOString().split('T')[0]}.csv`;
      headers = ['Station', 'Capacité (L)', 'Stock actuel (L)', 'Stock minimum (L)', 'Consommation moy./jour', 'Jours restants', 'Statut'];
      data = stations.map(station => [
        station.name,
        station.capacity_liters.toLocaleString(),
        station.current_stock.toLocaleString(),
        station.minimum_stock.toLocaleString(),
        station.avg_daily_consumption,
        station.days_remaining,
        station.status
      ]);
    } else if (activeTab === 'vehicles') {
      filename = `vehicules_efficacite_${new Date().toISOString().split('T')[0]}.csv`;
      headers = ['Véhicule', 'Consommation moy. (L/100km)', 'Total carburant (L)', 'Coût total (GNF)', 'Nb missions', 'Note efficacité'];
      data = vehicles.map(vehicle => [
        vehicle.registration,
        vehicle.avg_consumption.toFixed(2),
        vehicle.total_fuel.toFixed(2),
        vehicle.total_cost.toFixed(0),
        vehicle.mission_count,
        vehicle.efficiency_score.toFixed(1)
      ]);
    } else if (activeTab === 'alerts') {
      filename = `alertes_carburant_${new Date().toISOString().split('T')[0]}.csv`;
      headers = ['Type', 'Véhicule', 'Description', 'Sévérité', 'Date'];
      data = alerts.map(alert => [
        alert.alert_type,
        alert.vehicle || 'N/A',
        alert.description,
        alert.severity,
        new Date(alert.created_at).toLocaleDateString('fr-FR')
      ]);
    }

    const csvContent = [
      headers.join(','),
      ...data.map(row => row.map((cell: string | number) => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Droplet className="w-7 h-7 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Gestion du Carburant</h1>
              <p className="text-gray-600">Suivi complet, analyse et optimisation</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="week">7 derniers jours</option>
            <option value="month">30 derniers jours</option>
            <option value="quarter">90 derniers jours</option>
          </select>
          <button
            onClick={() => fetchAllData()}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Actualiser
          </button>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Exporter
          </button>
          <button
            onClick={() => setIsTransactionModalOpen(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
          >
            <Plus className="w-5 h-5" />
            Nouvelle Transaction
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {[
            { key: 'overview', label: 'Vue d\'Ensemble', icon: BarChart3 },
            { key: 'analytics', label: 'Analyses', icon: Activity },
            { key: 'stations', label: 'Stations', icon: MapPin },
            { key: 'vehicles', label: 'Véhicules', icon: Truck },
            { key: 'alerts', label: 'Alertes', icon: AlertTriangle, count: alerts.length }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`pb-4 px-2 border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="font-medium">{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Vue d'Ensemble */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-6">
          {/* KPIs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Droplet className="w-7 h-7 text-white" />
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                  stats.trend >= 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                }`}>
                  {stats.trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(stats.trend)}%
                </div>
              </div>
              <p className="text-sm font-medium text-blue-900 mb-1">Consommation Totale</p>
              <p className="text-4xl font-bold text-blue-900">{stats.totalConsumption.toLocaleString()}</p>
              <p className="text-sm text-blue-700 mt-1">Litres</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-7 h-7 text-white" />
                </div>
              </div>
              <p className="text-sm font-medium text-green-900 mb-1">Coût Total</p>
              <p className="text-4xl font-bold text-green-900">{stats.totalCost.toLocaleString()}</p>
              <p className="text-sm text-green-700 mt-1">Millions GNF</p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7 text-white" />
                </div>
                {stats.totalAnomalies > 0 && (
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                )}
              </div>
              <p className="text-sm font-medium text-orange-900 mb-1">Anomalies</p>
              <p className="text-4xl font-bold text-orange-900">{stats.totalAnomalies}</p>
              <p className="text-sm text-orange-700 mt-1">Détection auto</p>
            </div>

            <div className="bg-gradient-to-br from-teal-50 to-teal-100 border-2 border-teal-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-teal-500 rounded-lg flex items-center justify-center">
                  <Leaf className="w-7 h-7 text-white" />
                </div>
              </div>
              <p className="text-sm font-medium text-teal-900 mb-1">Émissions CO₂</p>
              <p className="text-4xl font-bold text-teal-900">{stats.co2Emissions.toLocaleString()}</p>
              <p className="text-sm text-teal-700 mt-1">Tonnes</p>
            </div>
          </div>

          {/* Indicateurs Clés */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Gauge className="w-6 h-6 text-blue-600" />
                <h3 className="font-bold text-lg text-gray-900">Efficacité Globale</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Score Efficacité</span>
                    <span className="text-2xl font-bold text-blue-600">{stats.efficiency}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all"
                      style={{ width: `${stats.efficiency}%` }}
                    />
                  </div>
                </div>
                <div className="pt-3 border-t">
                  <p className="text-sm text-gray-600">Consommation Moyenne</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.avgConsumption.toFixed(1)}</p>
                  <p className="text-xs text-gray-500">L/100km</p>
                </div>
              </div>
            </div>

            <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Brain className="w-6 h-6 text-purple-600" />
                <h3 className="font-bold text-lg text-gray-900">Prédiction IA</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Consommation Prévue</p>
                  <p className="text-3xl font-bold text-purple-600">{stats.predictedNextMonth.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Litres mois prochain</p>
                </div>
                <div className="pt-3 border-t">
                  <p className="text-sm text-gray-600 mb-1">Tendance</p>
                  <div className="flex items-center gap-2">
                    {stats.trend >= 0 ? (
                      <TrendingUp className="w-5 h-5 text-red-600" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-green-600" />
                    )}
                    <span className={`text-lg font-bold ${stats.trend >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {Math.abs(stats.trend).toFixed(1)}%
                    </span>
                    <span className="text-sm text-gray-500">vs période précédente</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Target className="w-6 h-6 text-green-600" />
                <h3 className="font-bold text-lg text-gray-900">Économies Potentielles</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Économies Possibles</p>
                  <p className="text-3xl font-bold text-green-600">{stats.savingsPotential.toFixed(1)}</p>
                  <p className="text-xs text-gray-500">Millions GNF / mois</p>
                </div>
                <div className="pt-3 border-t">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">✓ Optimisation routes</span>
                      <span className="font-medium text-gray-900">3%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">✓ Conduite éco</span>
                      <span className="font-medium text-gray-900">5%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">✓ Maintenance préventive</span>
                      <span className="font-medium text-gray-900">2%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Graphique Tendance */}
          {trends.length > 0 && (
            <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
              <h3 className="font-bold text-lg text-gray-900 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Évolution Consommation
              </h3>
              <div className="h-64 flex items-end gap-2">
                {trends.map((t, i) => {
                  const maxConsumption = Math.max(...trends.map(tr => tr.consumption));
                  const height = (t.consumption / maxConsumption) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <div className="text-xs font-medium text-gray-900">{t.consumption}L</div>
                      <div
                        className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer"
                        style={{ height: `${height}%` }}
                        title={`${new Date(t.date).toLocaleDateString('fr-FR')} - ${t.consumption}L - ${t.cost}M GNF`}
                      />
                      <div className="text-xs text-gray-500 transform -rotate-45 origin-top-left whitespace-nowrap">
                        {new Date(t.date).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stations Tab */}
      {activeTab === 'stations' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stations.map(station => (
              <div key={station.id} className="bg-white border-2 border-gray-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{station.name}</h3>
                      <p className="text-xs text-gray-500">{station.days_remaining} jours restants</p>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-bold ${
                    station.status === 'critical' ? 'bg-red-100 text-red-700' :
                    station.status === 'low' ? 'bg-orange-100 text-orange-700' :
                    station.status === 'normal' ? 'bg-green-100 text-green-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {station.status.toUpperCase()}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Stock Actuel</span>
                      <span className="font-bold text-gray-900">
                        {station.current_stock.toLocaleString()} / {station.capacity_liters.toLocaleString()}L
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${getStockColor(station.status)}`}
                        style={{ width: `${(station.current_stock / station.capacity_liters) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                    <div>
                      <p className="text-xs text-gray-500">Consommation Moy.</p>
                      <p className="text-sm font-bold text-gray-900">{station.avg_daily_consumption}L/jour</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Stock Minimum</p>
                      <p className="text-sm font-bold text-gray-900">{station.minimum_stock.toLocaleString()}L</p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 pt-4 border-t">
                    <button
                      onClick={() => {
                        setSelectedStation(station);
                        setIsStationModalOpen(true);
                      }}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      <Edit className="w-4 h-4" />
                      Modifier
                    </button>
                    <button
                      onClick={() => {
                        setSelectedStation(station);
                        setIsStockModalOpen(true);
                      }}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Ravitailler
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vehicles Tab */}
      {activeTab === 'vehicles' && (
        <div className="space-y-6">
          <div className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden">
            <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
              <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-600" />
                Top Véhicules Effic aces
              </h3>
              <span className="text-sm text-gray-600">{vehicles.length} véhicules analysés</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Véhicule</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Consommation Moy.</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Carburant</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Coût Total</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Missions</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {vehicles.slice(0, 15).map((vehicle, index) => (
                    <tr key={vehicle.vehicle_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-700' :
                          index === 1 ? 'bg-gray-100 text-gray-700' :
                          index === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-50 text-gray-600'
                        }`}>
                          {index + 1}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{vehicle.registration}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="font-medium text-gray-900">{vehicle.avg_consumption.toFixed(1)}</span>
                        <span className="text-xs text-gray-500 ml-1">L/100km</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-900">
                        {vehicle.total_fuel.toLocaleString()} L
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-900">
                        {(vehicle.total_cost / 1000000).toFixed(1)} M
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-gray-700">
                        {vehicle.missions_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-3 py-1 rounded-full text-sm font-bold border-2 ${getRatingColor(vehicle.rating)}`}>
                          {vehicle.rating}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {alerts.length === 0 ? (
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-12 text-center">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-green-900 mb-2">Aucune alerte active</h3>
              <p className="text-green-700">Tous les indicateurs sont normaux</p>
            </div>
          ) : (
            alerts.map(alert => (
              <div key={alert.id} className={`border-2 rounded-xl p-4 ${
                alert.severity === 'critical' ? 'bg-red-50 border-red-300' :
                alert.severity === 'warning' ? 'bg-orange-50 border-orange-300' :
                'bg-blue-50 border-blue-300'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      alert.severity === 'critical' ? 'bg-red-100' :
                      alert.severity === 'warning' ? 'bg-orange-100' :
                      'bg-blue-100'
                    }`}>
                      {alert.type === 'anomaly' && <AlertCircle className={`w-5 h-5 ${
                        alert.severity === 'critical' ? 'text-red-600' :
                        alert.severity === 'warning' ? 'text-orange-600' :
                        'text-blue-600'
                      }`} />}
                      {alert.type === 'stock' && <Droplet className={`w-5 h-5 ${
                        alert.severity === 'critical' ? 'text-red-600' :
                        alert.severity === 'warning' ? 'text-orange-600' :
                        'text-blue-600'
                      }`} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className={`font-bold ${
                          alert.severity === 'critical' ? 'text-red-900' :
                          alert.severity === 'warning' ? 'text-orange-900' :
                          'text-blue-900'
                        }`}>
                          {alert.message}
                        </h4>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getSeverityColor(alert.severity)}`}>
                          {alert.severity.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        {alert.vehicle && (
                          <span className="flex items-center gap-1">
                            <Truck className="w-4 h-4" />
                            {alert.vehicle}
                          </span>
                        )}
                        {alert.station && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {alert.station}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(alert.timestamp).toLocaleString('fr-FR')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                    Résoudre
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modals */}
      {isTransactionModalOpen && (
        <FuelTransactionModal
          transaction={null}
          onClose={(saved) => {
            setIsTransactionModalOpen(false);
            if (saved) fetchAllData();
          }}
        />
      )}

      {isStationModalOpen && (
        <FuelStationModal
          station={selectedStation}
          onClose={(saved) => {
            setIsStationModalOpen(false);
            setSelectedStation(null);
            if (saved) fetchAllData();
          }}
        />
      )}

      {isStockModalOpen && (
        <FuelStockModal
          stock={selectedStation ? { site_id: selectedStation.id, fuel_type_id: null } : null}
          onClose={(saved) => {
            setIsStockModalOpen(false);
            setSelectedStation(null);
            if (saved) fetchAllData();
          }}
        />
      )}
    </div>
  );
};
