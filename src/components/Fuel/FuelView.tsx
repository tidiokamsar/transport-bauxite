import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Plus, Search, Droplet, TrendingUp, AlertTriangle, Activity,
  Truck, MapPin, DollarSign, BarChart3, Target, Award, FileText, Download,
  Edit, Trash2, RefreshCw, Leaf, Shield
} from 'lucide-react';
import { FuelTransactionModal } from './FuelTransactionModal';
import { FuelStockModal } from './FuelStockModal';
import { FuelStationModal } from './FuelStationModal';

interface FuelStats {
  totalConsumption: number;
  totalRefills: number;
  totalCost: number;
  avgConsumption: number;
  totalVehicles: number;
  totalAnomalies: number;
  co2Emissions: number;
  efficiency: number;
}

interface Station {
  id: string;
  name: string;
  station_type: string;
  location: string;
  current_stock: number;
  capacity_liters: number;
  minimum_stock: number;
  has_iot_sensors: boolean;
  authorized: boolean;
  supplier_name: string;
  contact_phone: string;
}

interface VehicleConsumption {
  vehicle_id: string;
  registration: string;
  total_fuel: number;
  avg_per_100km: number;
  total_missions: number;
  anomalies: number;
  co2_kg: number;
  rating: string;
  total_cost: number;
}

interface Anomaly {
  id: string;
  anomaly_type: string;
  severity: string;
  description: string;
  detection_date: string;
  status: string;
  vehicle_registration: string;
  variance_percentage: number;
  estimated_loss: number;
}

interface Transaction {
  id: string;
  reference: string;
  transaction_date: string;
  transaction_type: string;
  vehicle: { registration: string } | null;
  driver: { name: string } | null;
  volume_liters: number;
  unit_price: number;
  total_cost: number;
  odometer_reading: number;
  station_id: string;
  supplier: string;
  invoice_number: string;
  notes: string;
}

export const FuelView = () => {
  const [stats, setStats] = useState<FuelStats | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [vehicleConsumption, setVehicleConsumption] = useState<VehicleConsumption[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'stations' | 'vehicles' | 'anomalies' | 'transactions'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');

  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isStationModalOpen, setIsStationModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [selectedStock, setSelectedStock] = useState<any>(null);
  const [selectedStation, setSelectedStation] = useState<any>(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchStats(),
      fetchStations(),
      fetchVehicleConsumption(),
      fetchAnomalies(),
      fetchTransactions()
    ]);
    setLoading(false);
  };

  const fetchStats = async () => {
    const { data: consumption } = await supabase
      .from('fuel_consumption')
      .select('fuel_used_liters, fuel_cost, consumption_per_100km, co2_emissions_kg');

    const { data: transactions } = await supabase
      .from('fuel_transactions')
      .select('volume_liters, total_cost, transaction_type');

    const { data: anomaliesCount } = await supabase
      .from('fuel_anomalies')
      .select('id', { count: 'exact', head: true });

    const { data: vehiclesCount } = await supabase
      .from('fuel_vehicle_stats')
      .select('vehicle_id', { count: 'exact', head: true });

    if (consumption && transactions) {
      const totalConsumption = consumption.reduce((sum, item) => sum + (item.fuel_used_liters || 0), 0);
      const totalRefills = transactions.filter(t => t.transaction_type === 'refuel')
        .reduce((sum, t) => sum + (t.volume_liters || 0), 0);
      const totalCost = consumption.reduce((sum, item) => sum + (item.fuel_cost || 0), 0);
      const avgConsumption = consumption.length > 0 ?
        consumption.reduce((sum, item) => sum + (item.consumption_per_100km || 0), 0) / consumption.length : 0;
      const co2 = consumption.reduce((sum, item) => sum + (item.co2_emissions_kg || 0), 0);

      setStats({
        totalConsumption,
        totalRefills,
        totalCost,
        avgConsumption,
        totalVehicles: vehiclesCount?.count || 0,
        totalAnomalies: anomaliesCount?.count || 0,
        co2Emissions: co2,
        efficiency: 82
      });
    }
  };

  const fetchStations = async () => {
    const { data } = await supabase
      .from('fuel_stations')
      .select('*')
      .order('name');
    if (data) setStations(data);
  };

  const fetchVehicleConsumption = async () => {
    const { data } = await supabase
      .from('fuel_vehicle_stats')
      .select(`
        vehicle_id,
        vehicle:vehicle_id(registration),
        total_fuel_consumed_liters,
        total_fuel_cost,
        avg_consumption_per_100km,
        total_missions,
        total_anomalies,
        total_co2_emissions_kg
      `)
      .order('avg_consumption_per_100km', { ascending: true })
      .limit(50);

    if (data) {
      setVehicleConsumption(data.map((item: any) => ({
        vehicle_id: item.vehicle_id,
        registration: item.vehicle?.registration || 'N/A',
        total_fuel: item.total_fuel_consumed_liters || 0,
        total_cost: item.total_fuel_cost || 0,
        avg_per_100km: item.avg_consumption_per_100km || 0,
        total_missions: item.total_missions || 0,
        anomalies: item.total_anomalies || 0,
        co2_kg: item.total_co2_emissions_kg || 0,
        rating: item.avg_consumption_per_100km < 40 ? 'A' :
          item.avg_consumption_per_100km < 45 ? 'B' :
          item.avg_consumption_per_100km < 50 ? 'C' : 'D'
      })));
    }
  };

  const fetchAnomalies = async () => {
    const { data } = await supabase
      .from('fuel_anomalies')
      .select(`
        *,
        vehicle:vehicle_id(registration)
      `)
      .order('detection_date', { ascending: false })
      .limit(50);

    if (data) {
      setAnomalies(data.map((item: any) => ({
        ...item,
        vehicle_registration: item.vehicle?.registration || 'N/A'
      })));
    }
  };

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from('fuel_transactions')
      .select(`
        *,
        vehicle:vehicle_id(registration),
        driver:driver_id(name)
      `)
      .order('transaction_date', { ascending: false })
      .limit(100);

    if (data) setTransactions(data);
  };

  const handleAddTransaction = () => {
    setSelectedTransaction(null);
    setIsTransactionModalOpen(true);
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsTransactionModalOpen(true);
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette transaction ?')) return;

    const { error } = await supabase
      .from('fuel_transactions')
      .delete()
      .eq('id', id);

    if (!error) {
      fetchAllData();
    }
  };

  const handleAddStation = () => {
    setSelectedStation(null);
    setIsStationModalOpen(true);
  };

  const handleEditStation = (station: Station) => {
    setSelectedStation(station);
    setIsStationModalOpen(true);
  };

  const handleDeleteStation = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette station ?')) return;

    const { error } = await supabase
      .from('fuel_stations')
      .delete()
      .eq('id', id);

    if (!error) {
      fetchStations();
    }
  };

  const handleModalClose = (saved: boolean) => {
    setIsTransactionModalOpen(false);
    setIsStockModalOpen(false);
    setIsStationModalOpen(false);
    setSelectedTransaction(null);
    setSelectedStock(null);
    setSelectedStation(null);
    if (saved) {
      fetchAllData();
    }
  };

  const exportData = () => {
    const dataToExport = {
      stats,
      stations,
      vehicleConsumption,
      anomalies,
      transactions: transactions.slice(0, 50)
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fuel-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const getSeverityColor = (severity: string) => {
    const colors = {
      low: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      medium: 'bg-orange-100 text-orange-800 border-orange-200',
      high: 'bg-red-100 text-red-800 border-red-200',
      critical: 'bg-red-600 text-white border-red-700'
    };
    return colors[severity as keyof typeof colors] || colors.medium;
  };

  const getRatingColor = (rating: string) => {
    const colors = {
      A: 'bg-green-500 text-white',
      B: 'bg-blue-500 text-white',
      C: 'bg-orange-500 text-white',
      D: 'bg-red-500 text-white'
    };
    return colors[rating as keyof typeof colors] || colors.C;
  };

  const getStationTypeLabel = (type: string) => {
    const labels = { internal: 'Interne', external: 'Externe', partner: 'Partenaire' };
    return labels[type as keyof typeof labels] || type;
  };

  const getTransactionTypeLabel = (type: string) => {
    const labels = { refuel: 'Ravitaillement', tank_fill: 'Réapprovisionnement' };
    return labels[type as keyof typeof labels] || type;
  };

  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch =
      t.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.vehicle?.registration?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.driver?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || t.transaction_type === filterType;
    return matchesSearch && matchesType;
  });

  const filteredAnomalies = anomalies.filter((a) => {
    const matchesSeverity = filterSeverity === 'all' || a.severity === filterSeverity;
    const matchesSearch = a.vehicle_registration?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSeverity && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600 font-medium">Chargement des données carburant...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3">
            <Droplet className="w-10 h-10 text-blue-600" />
            Gestion du Carburant
          </h1>
          <p className="text-slate-600 mt-2">Suivi complet, analyse et optimisation</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportData}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2 shadow-sm transition-all"
          >
            <Download className="w-5 h-5" />
            Exporter
          </button>
          <button
            onClick={fetchAllData}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2 shadow-sm transition-all"
          >
            <RefreshCw className="w-5 h-5" />
            Actualiser
          </button>
          <button
            onClick={handleAddTransaction}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-md transition-all"
          >
            <Plus className="w-5 h-5" />
            Nouvelle Transaction
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-1 flex gap-1">
        {(['overview', 'stations', 'vehicles', 'anomalies', 'transactions'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === tab
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab === 'overview' && <><BarChart3 className="w-5 h-5" /> Vue d'Ensemble</>}
            {tab === 'stations' && <><MapPin className="w-5 h-5" /> Stations ({stations.length})</>}
            {tab === 'vehicles' && <><Truck className="w-5 h-5" /> Véhicules ({vehicleConsumption.length})</>}
            {tab === 'anomalies' && <><AlertTriangle className="w-5 h-5" /> Anomalies ({anomalies.length})</>}
            {tab === 'transactions' && <><FileText className="w-5 h-5" /> Transactions ({transactions.length})</>}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <Droplet className="w-10 h-10 opacity-90" />
                <div className="text-right">
                  <p className="text-sm font-medium opacity-90">Consommation Totale</p>
                  <p className="text-3xl font-bold mt-1">{stats.totalConsumption.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} L</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm opacity-90">
                <TrendingUp className="w-4 h-4" />
                <span>+12% ce mois</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <DollarSign className="w-10 h-10 opacity-90" />
                <div className="text-right">
                  <p className="text-sm font-medium opacity-90">Coût Total</p>
                  <p className="text-3xl font-bold mt-1">{(stats.totalCost / 1000000).toFixed(1)} M</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm opacity-90">
                <span>GNF</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <AlertTriangle className="w-10 h-10 opacity-90" />
                <div className="text-right">
                  <p className="text-sm font-medium opacity-90">Anomalies</p>
                  <p className="text-3xl font-bold mt-1">{stats.totalAnomalies}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm opacity-90">
                <Shield className="w-4 h-4" />
                <span>Détection auto</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <Leaf className="w-10 h-10 opacity-90" />
                <div className="text-right">
                  <p className="text-sm font-medium opacity-90">Émissions CO₂</p>
                  <p className="text-3xl font-bold mt-1">{(stats.co2Emissions / 1000).toFixed(1)} T</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm opacity-90">
                <span>Tonnes</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Target className="w-6 h-6 text-green-600" />
                Indicateurs Clés
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                  <div className="text-3xl font-bold text-blue-600">{(stats.totalCost / stats.totalConsumption).toFixed(0)}</div>
                  <div className="text-xs text-slate-600 mt-1">GNF/Litre</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                  <div className="text-3xl font-bold text-green-600">{stats.totalVehicles}</div>
                  <div className="text-xs text-slate-600 mt-1">Véhicules</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200">
                  <div className="text-3xl font-bold text-orange-600">{stats.avgConsumption.toFixed(1)}</div>
                  <div className="text-xs text-slate-600 mt-1">L/100km Moyen</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl border border-teal-200">
                  <div className="text-3xl font-bold text-teal-600">2.68</div>
                  <div className="text-xs text-slate-600 mt-1">kg CO₂/L</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Award className="w-6 h-6 text-yellow-600" />
                Top 5 Véhicules Efficaces
              </h3>
              <div className="space-y-3">
                {vehicleConsumption.slice(0, 5).map((vehicle, index) => (
                  <div key={vehicle.vehicle_id} className="flex items-center gap-3 p-3 bg-gradient-to-r from-slate-50 to-white rounded-xl border border-slate-200 hover:shadow-md transition-all">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white' :
                      index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' :
                      index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white' :
                      'bg-slate-200 text-slate-700'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-slate-900">{vehicle.registration}</div>
                      <div className="text-xs text-slate-600">{vehicle.total_missions} missions</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">{vehicle.avg_per_100km.toFixed(2)}</div>
                      <div className="text-xs text-slate-600">L/100km</div>
                    </div>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${getRatingColor(vehicle.rating)}`}>
                      {vehicle.rating}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'stations' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              onClick={handleAddStation}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-md transition-all"
            >
              <Plus className="w-5 h-5" />
              Nouvelle Station
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stations.map((station) => {
              const currentStock = station.current_stock || 0;
              const capacity = station.capacity_liters || 1;
              const minimumStock = station.minimum_stock || 0;
              const percentage = (currentStock / capacity) * 100;
              const isLow = percentage < 30;
              const isCritical = percentage < 15;

              return (
                <div key={station.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-lg transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-900 text-lg">{station.name}</h4>
                      <p className="text-sm text-slate-600 mt-1 flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {station.location}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditStation(station)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteStation(station.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      station.station_type === 'internal' ? 'bg-blue-100 text-blue-700' :
                      station.station_type === 'external' ? 'bg-purple-100 text-purple-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {getStationTypeLabel(station.station_type)}
                    </span>
                    {station.has_iot_sensors && (
                      <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-medium flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        IoT
                      </span>
                    )}
                    {!station.authorized && (
                      <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                        Non autorisée
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium text-slate-700">Stock Actuel</span>
                        <span className={`text-sm font-bold ${isCritical ? 'text-red-600' : isLow ? 'text-orange-600' : 'text-green-600'}`}>
                          {currentStock.toLocaleString()} L ({percentage.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all ${
                            isCritical ? 'bg-gradient-to-r from-red-500 to-red-600' :
                            isLow ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
                            'bg-gradient-to-r from-green-500 to-green-600'
                          }`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200 text-sm">
                      <div>
                        <span className="text-slate-600">Capacité</span>
                        <div className="font-bold text-slate-900">{capacity.toLocaleString()} L</div>
                      </div>
                      <div>
                        <span className="text-slate-600">Min</span>
                        <div className="font-bold text-slate-900">{minimumStock.toLocaleString()} L</div>
                      </div>
                    </div>

                    {(isCritical || isLow) && (
                      <div className={`p-3 rounded-lg ${isCritical ? 'bg-red-50 border border-red-200' : 'bg-orange-50 border border-orange-200'}`}>
                        <div className="flex items-center gap-2 text-sm">
                          <AlertTriangle className={`w-4 h-4 ${isCritical ? 'text-red-600' : 'text-orange-600'}`} />
                          <span className={`font-medium ${isCritical ? 'text-red-700' : 'text-orange-700'}`}>
                            {isCritical ? 'Stock critique' : 'Stock faible'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'vehicles' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-6 h-6 text-blue-600" />
              Performance par Véhicule
            </h3>
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg w-64"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b-2 border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Rang</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Véhicule</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Total (L)</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Coût Total</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">L/100km</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Missions</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">CO₂ (kg)</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Anomalies</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {vehicleConsumption
                  .filter(v => v.registration.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((vehicle, index) => (
                  <tr key={vehicle.vehicle_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white' :
                        index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' :
                        index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white' :
                        'bg-slate-200 text-slate-700'
                      }`}>
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{vehicle.registration}</div>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-900 font-medium">{vehicle.total_fuel.toFixed(0)} L</td>
                    <td className="px-6 py-4 text-right text-slate-900 font-medium">{(vehicle.total_cost / 1000).toFixed(0)}k GNF</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-bold text-lg ${
                        vehicle.avg_per_100km < 40 ? 'text-green-600' :
                        vehicle.avg_per_100km < 45 ? 'text-blue-600' :
                        vehicle.avg_per_100km < 50 ? 'text-orange-600' :
                        'text-red-600'
                      }`}>
                        {vehicle.avg_per_100km.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-600">{vehicle.total_missions}</td>
                    <td className="px-6 py-4 text-right text-slate-600">{vehicle.co2_kg.toFixed(0)}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        vehicle.anomalies === 0 ? 'bg-green-100 text-green-700' :
                        vehicle.anomalies <= 2 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {vehicle.anomalies}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-xl mx-auto ${getRatingColor(vehicle.rating)} shadow-md`}>
                        {vehicle.rating}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'anomalies' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              Anomalies Détectées ({filteredAnomalies.length})
            </h3>
            <div className="flex gap-3">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg w-64"
                />
              </div>
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 bg-white"
              >
                <option value="all">Toutes</option>
                <option value="low">Faible</option>
                <option value="medium">Moyenne</option>
                <option value="high">Élevée</option>
                <option value="critical">Critique</option>
              </select>
            </div>
          </div>

          {filteredAnomalies.map((anomaly) => (
            <div key={anomaly.id} className="bg-white rounded-xl border-2 border-slate-200 p-5 hover:shadow-lg transition-all">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${getSeverityColor(anomaly.severity)}`}>
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-bold text-lg text-slate-900">{anomaly.vehicle_registration}</h4>
                      <p className="text-slate-600 mt-1">{anomaly.description}</p>
                    </div>
                    <span className={`px-4 py-2 rounded-full text-sm font-bold ${getSeverityColor(anomaly.severity)}`}>
                      {anomaly.severity.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-600 mb-1">Type</div>
                      <div className="font-bold text-slate-900">{anomaly.anomaly_type}</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-600 mb-1">Variance</div>
                      <div className="font-bold text-red-600">+{anomaly.variance_percentage?.toFixed(1)}%</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-600 mb-1">Perte estimée</div>
                      <div className="font-bold text-red-600">{(anomaly.estimated_loss / 1000).toFixed(0)}k GNF</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-600 mb-1">Date</div>
                      <div className="font-bold text-slate-900">{new Date(anomaly.detection_date).toLocaleDateString('fr-FR')}</div>
                    </div>
                  </div>

                  <span className={`px-3 py-1 rounded-full text-xs font-medium inline-block ${
                    anomaly.status === 'resolved' ? 'bg-green-100 text-green-700' :
                    anomaly.status === 'investigating' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {anomaly.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-6 h-6 text-blue-600" />
                Transactions ({filteredTransactions.length})
              </h3>
              <div className="flex gap-3">
                <div className="relative">
                  <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Rechercher..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg w-64"
                  />
                </div>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 bg-white"
                >
                  <option value="all">Tous types</option>
                  <option value="refuel">Ravitaillement</option>
                  <option value="tank_fill">Réapprovisionnement</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b-2 border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Référence</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Véhicule</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Chauffeur</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-600 uppercase">Volume</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-600 uppercase">Prix U.</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-600 uppercase">Total</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredTransactions.slice(0, 50).map((trans) => (
                  <tr key={trans.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleEditTransaction(trans)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                        title="Voir les détails"
                      >
                        {trans.reference}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900">{new Date(trans.transaction_date).toLocaleDateString('fr-FR')}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        trans.transaction_type === 'refuel' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {getTransactionTypeLabel(trans.transaction_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{trans.vehicle?.registration || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {trans.driver?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900">{trans.volume_liters} L</td>
                    <td className="px-6 py-4 text-right text-slate-600">{trans.unit_price?.toLocaleString()} GNF</td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">{(trans.total_cost / 1000).toFixed(0)}k GNF</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditTransaction(trans)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTransaction(trans.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isTransactionModalOpen && (
        <FuelTransactionModal
          transaction={selectedTransaction}
          onClose={handleModalClose}
        />
      )}

      {isStockModalOpen && (
        <FuelStockModal
          stock={selectedStock}
          onClose={handleModalClose}
        />
      )}

      {isStationModalOpen && (
        <FuelStationModal
          station={selectedStation}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
};
