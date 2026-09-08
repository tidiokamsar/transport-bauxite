import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Droplet, TrendingUp, AlertTriangle,
  DollarSign, Target, Award, Brain, Zap, Gauge,
  AlertCircle, CheckCircle, Calendar, Leaf, RefreshCw
} from 'lucide-react';

interface DashboardStats {
  totalFuelConsumed: number;
  totalCost: number;
  avgConsumption: number;
  totalDistance: number;
  totalVehicles: number;
  activeAnomalies: number;
  co2Emissions: number;
  efficiency: number;
  trend: string;
  savingsPotential: number;
}

interface TopVehicle {
  id: string;
  registration: string;
  avgConsumption: number;
  efficiencyScore: number;
  trend: string;
}

interface RecentAnomaly {
  id: string;
  vehicleReg: string;
  type: string;
  severity: string;
  detectionDate: string;
  estimatedLoss: number;
  status: string;
}

interface Prediction {
  date: string;
  predictedConsumption: number;
  confidence: number;
}

export const FuelIntelligentDashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topVehicles, setTopVehicles] = useState<TopVehicle[]>([]);
  const [worstVehicles, setWorstVehicles] = useState<TopVehicle[]>([]);
  const [anomalies, setAnomalies] = useState<RecentAnomaly[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);


  const fetchStats = useCallback(async () => {
    const { data: consumption } = await supabase
      .from('fuel_consumption')
      .select('fuel_used_liters, fuel_cost, distance_km, co2_emissions_kg')
      .gte('mission_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const { data: vehicleStats } = await supabase
      .from('fuel_vehicle_stats')
      .select('*');

    const { data: anomaliesData } = await supabase
      .from('fuel_anomalies')
      .select('id')
      .in('status', ['open', 'investigating']);

    const totalFuel = consumption?.reduce((sum, r) => sum + (r.fuel_used_liters || 0), 0) || 0;
    const totalCost = consumption?.reduce((sum, r) => sum + (r.fuel_cost || 0), 0) || 0;
    const totalDistance = consumption?.reduce((sum, r) => sum + (r.distance_km || 0), 0) || 0;
    const totalCO2 = consumption?.reduce((sum, r) => sum + (r.co2_emissions_kg || 0), 0) || 0;
    const avgConsumption = totalDistance > 0 ? (totalFuel / totalDistance) * 100 : 0;
    // Indice d'efficacite calcule (reference flotte : 30 L/100 km),
    // meme formule que la vue efficacite par vehicule.
    const efficiency = Math.max(0, Math.min(100, 100 - (avgConsumption - 30) * 2));

    setStats({
      totalFuelConsumed: totalFuel,
      totalCost,
      avgConsumption,
      totalDistance,
      totalVehicles: vehicleStats?.length || 0,
      activeAnomalies: anomaliesData?.length || 0,
      co2Emissions: totalCO2,
      efficiency,
      trend: 'stable',
      savingsPotential: totalCost * 0.08
    });
  }, []);

  const fetchTopPerformers = useCallback(async () => {
    const { data } = await supabase
      .from('fuel_vehicle_stats')
      .select(`
        vehicle_id,
        avg_consumption_per_100km,
        efficiency_score,
        consumption_trend,
        vehicles!inner(registration)
      `)
      .order('avg_consumption_per_100km', { ascending: true })
      .limit(5);

    const { data: worst } = await supabase
      .from('fuel_vehicle_stats')
      .select(`
        vehicle_id,
        avg_consumption_per_100km,
        efficiency_score,
        consumption_trend,
        vehicles!inner(registration)
      `)
      .order('avg_consumption_per_100km', { ascending: false })
      .limit(5);

    if (data) {
      setTopVehicles(data.map(v => ({
        id: v.vehicle_id,
        registration: (v.vehicles as unknown as { registration?: string } | null)?.registration || 'N/A',
        avgConsumption: v.avg_consumption_per_100km,
        efficiencyScore: v.efficiency_score,
        trend: v.consumption_trend
      })));
    }

    if (worst) {
      setWorstVehicles(worst.map(v => ({
        id: v.vehicle_id,
        registration: (v.vehicles as unknown as { registration?: string } | null)?.registration || 'N/A',
        avgConsumption: v.avg_consumption_per_100km,
        efficiencyScore: v.efficiency_score,
        trend: v.consumption_trend
      })));
    }
  }, []);

  const fetchAnomalies = useCallback(async () => {
    const { data } = await supabase
      .from('fuel_anomalies')
      .select(`
        id,
        anomaly_type,
        severity,
        detection_date,
        estimated_loss,
        status,
        vehicles!inner(registration)
      `)
      .in('status', ['open', 'investigating'])
      .order('detection_date', { ascending: false })
      .limit(10);

    if (data) {
      setAnomalies(data.map(a => ({
        id: a.id,
        vehicleReg: (a.vehicles as unknown as { registration?: string } | null)?.registration || 'N/A',
        type: a.anomaly_type,
        severity: a.severity,
        detectionDate: a.detection_date,
        estimatedLoss: a.estimated_loss,
        status: a.status
      })));
    }
  }, []);

  const fetchPredictions = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('fuel_predictions')
      .select('prediction_date, predicted_consumption_liters, confidence_level')
      .gte('prediction_date', today.toISOString().split('T')[0])
      .order('prediction_date')
      .limit(7);

    if (data && data.length > 0) {
      setPredictions(data.map(p => ({
        date: p.prediction_date,
        predictedConsumption: p.predicted_consumption_liters,
        confidence: (p.confidence_level || 0.85) * 100
      })));
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchStats(),
      fetchTopPerformers(),
      fetchAnomalies(),
      fetchPredictions()
    ]);
    setLoading(false);
  }, [fetchStats, fetchTopPerformers, fetchAnomalies, fetchPredictions]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('fr-GN', { style: 'currency', currency: 'GNF', maximumFractionDigits: 0 }).format(val);

  const formatNumber = (val: number) =>
    new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(val);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
            Gestion Intelligente du Carburant
          </h1>
          <p className="text-gray-600 mt-1">Système IA de traçabilité et optimisation énergétique</p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
          Actualiser
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Consommation Totale</p>
              <h3 className="text-2xl font-bold text-gray-900">{formatNumber(stats?.totalFuelConsumed || 0)}L</h3>
              <p className="text-xs text-gray-500 mt-2">{formatNumber(stats?.totalDistance || 0)} km parcourus</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Droplet className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm font-medium text-blue-600">{formatNumber(stats?.avgConsumption || 0)}L/100km</span>
            <span className="text-xs text-gray-500">Moyenne</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Coût Total</p>
              <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(stats?.totalCost || 0)}</h3>
              <p className="text-xs text-gray-500 mt-2">30 derniers jours</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-600 font-medium">
              {formatCurrency(stats?.savingsPotential || 0)} économisables
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Anomalies Actives</p>
              <h3 className="text-2xl font-bold text-gray-900">{stats?.activeAnomalies || 0}</h3>
              <p className="text-xs text-gray-500 mt-2">En cours d'investigation</p>
            </div>
            <div className={`p-3 rounded-lg ${(stats?.activeAnomalies || 0) > 5 ? 'bg-red-50' : 'bg-yellow-50'}`}>
              <AlertTriangle className={`w-6 h-6 ${(stats?.activeAnomalies || 0) > 5 ? 'text-red-600' : 'text-yellow-600'}`} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            {(stats?.activeAnomalies || 0) > 5 ? (
              <span className="text-sm text-red-600 font-medium">Action requise</span>
            ) : (
              <span className="text-sm text-green-600 font-medium">Sous contrôle</span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Efficacité Globale</p>
              <h3 className="text-2xl font-bold text-gray-900">{formatNumber(stats?.efficiency || 0)}%</h3>
              <p className="text-xs text-gray-500 mt-2">Score flotte</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <Gauge className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Leaf className="w-4 h-4 text-green-600" />
            <span className="text-sm text-gray-600">
              {formatNumber(stats?.co2Emissions || 0)} kg CO₂
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performers */}
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-bold text-gray-900">Top 5 Véhicules Efficaces</h3>
          </div>
          <div className="space-y-3">
            {topVehicles.map((vehicle, idx) => (
              <div key={vehicle.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{vehicle.registration}</p>
                    <p className="text-sm text-gray-600">{formatNumber(vehicle.avgConsumption)} L/100km</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-600">{formatNumber(vehicle.efficiencyScore)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Worst Performers */}
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-bold text-gray-900">Véhicules à Optimiser</h3>
          </div>
          <div className="space-y-3">
            {worstVehicles.map((vehicle, idx) => (
              <div key={vehicle.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{vehicle.registration}</p>
                    <p className="text-sm text-gray-600">{formatNumber(vehicle.avgConsumption)} L/100km</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium text-red-600">+{formatNumber((vehicle.avgConsumption - 38) / 38 * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Anomalies */}
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-orange-600" />
            <h3 className="text-lg font-bold text-gray-900">Anomalies Détectées (IA)</h3>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {anomalies.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                <p className="text-gray-600">Aucune anomalie détectée</p>
              </div>
            ) : (
              anomalies.map(anomaly => (
                <div key={anomaly.id} className={`p-3 rounded-lg border ${
                  anomaly.severity === 'critical' ? 'bg-red-50 border-red-200' :
                  anomaly.severity === 'high' ? 'bg-orange-50 border-orange-200' :
                  'bg-yellow-50 border-yellow-200'
                }`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{anomaly.vehicleReg}</p>
                      <p className="text-sm text-gray-600 capitalize">{anomaly.type.replace('_', ' ')}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(anomaly.detectionDate).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        anomaly.severity === 'critical' ? 'bg-red-200 text-red-800' :
                        anomaly.severity === 'high' ? 'bg-orange-200 text-orange-800' :
                        'bg-yellow-200 text-yellow-800'
                      }`}>
                        {anomaly.severity}
                      </span>
                      <p className="text-sm font-medium text-red-600 mt-1">
                        {formatCurrency(anomaly.estimatedLoss)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Predictions */}
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-bold text-gray-900">Prédictions IA (7 jours)</h3>
          </div>
          <div className="space-y-3">
            {predictions.map((pred, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="font-semibold text-gray-900">
                      {new Date(pred.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-sm text-gray-600">{formatNumber(pred.predictedConsumption)}L prévus</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <Target className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-600">{formatNumber(pred.confidence * 100)}%</span>
                  </div>
                  <p className="text-xs text-gray-500">confiance</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
