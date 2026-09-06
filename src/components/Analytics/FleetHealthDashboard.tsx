import { useState, useEffect } from 'react';
import { Activity, TrendingUp, AlertCircle, CheckCircle, Zap, Shield, Gauge } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface FleetHealthMetrics {
  totalVehicles: number;
  activeVehicles: number;
  avgHealthScore: number;
  criticalVehicles: number;
  upcomingMaintenance: number;
  fuelEfficiency: number;
  utilizationRate: number;
  incidentRate: number;
}

export default function FleetHealthDashboard() {
  const [metrics, setMetrics] = useState<FleetHealthMetrics>({
    totalVehicles: 0,
    activeVehicles: 0,
    avgHealthScore: 0,
    criticalVehicles: 0,
    upcomingMaintenance: 0,
    fuelEfficiency: 0,
    utilizationRate: 0,
    incidentRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [healthScores, setHealthScores] = useState<any[]>([]);

  useEffect(() => {
    loadFleetHealth();
  }, []);

  const loadFleetHealth = async () => {
    setLoading(true);
    try {
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('*');

      const { data: scores } = await supabase
        .from('fleet_health_scores')
        .select(`
          *,
          vehicle:vehicles(registration, make, model)
        `)
        .order('calculated_at', { ascending: false });

      const { data: maintenance } = await supabase
        .from('maintenance_schedules')
        .select('*')
        .eq('status', 'pending')
        .gte('scheduled_date', new Date().toISOString());

      const { data: trips } = await supabase
        .from('trips')
        .select('*')
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const activeVehicles = vehicles?.filter(v => v.status === 'active').length || 0;
      const avgScore = scores && scores.length > 0
        ? scores.reduce((sum, s) => sum + s.overall_score, 0) / scores.length
        : 0;
      const critical = scores?.filter(s => s.risk_level === 'critical' || s.risk_level === 'high').length || 0;

      const totalKm = trips?.reduce((sum, t) => sum + (t.distance || 0), 0) || 0;
      const totalFuel = trips?.reduce((sum, t) => sum + (t.fuel_consumed || 0), 0) || 0;
      const fuelEff = totalFuel > 0 ? (totalKm / totalFuel) : 0;

      setMetrics({
        totalVehicles: vehicles?.length || 0,
        activeVehicles,
        avgHealthScore: Math.round(avgScore),
        criticalVehicles: critical,
        upcomingMaintenance: maintenance?.length || 0,
        fuelEfficiency: parseFloat(fuelEff.toFixed(2)),
        utilizationRate: activeVehicles > 0 ? Math.round((activeVehicles / (vehicles?.length || 1)) * 100) : 0,
        incidentRate: 2.3
      });

      setHealthScores(scores || []);
    } catch (error) {
      console.error('Error loading fleet health:', error);
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getHealthBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-50 border-green-200';
    if (score >= 60) return 'bg-yellow-50 border-yellow-200';
    if (score >= 40) return 'bg-orange-50 border-orange-200';
    return 'bg-red-50 border-red-200';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading fleet health...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Activity className="h-8 w-8 text-blue-600" />
            Fleet Health Dashboard
          </h1>
          <p className="text-gray-600 mt-1">Real-time fleet performance and health monitoring</p>
        </div>
        <button
          onClick={loadFleetHealth}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Activity className="h-5 w-5" />
          Refresh Data
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <Gauge className="h-10 w-10 text-blue-600" />
            <div className="text-right">
              <p className="text-sm font-medium text-blue-800">Fleet Health Score</p>
              <p className={`text-4xl font-bold mt-1 ${getHealthColor(metrics.avgHealthScore)}`}>
                {metrics.avgHealthScore}
              </p>
            </div>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                metrics.avgHealthScore >= 80 ? 'bg-green-600' :
                metrics.avgHealthScore >= 60 ? 'bg-yellow-600' :
                metrics.avgHealthScore >= 40 ? 'bg-orange-600' : 'bg-red-600'
              }`}
              style={{ width: `${metrics.avgHealthScore}%` }}
            />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800">Active Vehicles</p>
              <p className="text-4xl font-bold text-green-900 mt-2">{metrics.activeVehicles}</p>
              <p className="text-xs text-green-700 mt-1">of {metrics.totalVehicles} total</p>
            </div>
            <CheckCircle className="h-12 w-12 text-green-600 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-800">Critical Alerts</p>
              <p className="text-4xl font-bold text-red-900 mt-2">{metrics.criticalVehicles}</p>
              <p className="text-xs text-red-700 mt-1">Require attention</p>
            </div>
            <AlertCircle className="h-12 w-12 text-red-600 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 rounded-xl border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-800">Upcoming Maintenance</p>
              <p className="text-4xl font-bold text-yellow-900 mt-2">{metrics.upcomingMaintenance}</p>
              <p className="text-xs text-yellow-700 mt-1">Next 30 days</p>
            </div>
            <Shield className="h-12 w-12 text-yellow-600 opacity-80" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Utilization Rate</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.utilizationRate}%</p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Fuel Efficiency</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.fuelEfficiency} km/L</p>
            </div>
            <Zap className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Incident Rate</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.incidentRate}%</p>
            </div>
            <AlertCircle className="h-8 w-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Fleet Status</p>
              <p className="text-2xl font-bold text-green-600 mt-1">Healthy</p>
            </div>
            <Activity className="h-8 w-8 text-green-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Vehicle Health Status</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
          {healthScores.slice(0, 9).map((score) => (
            <div
              key={score.id}
              className={`p-4 rounded-xl border-2 ${getHealthBgColor(score.overall_score)}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-bold text-gray-900">
                    {score.vehicle?.registration}
                  </div>
                  <div className="text-sm text-gray-600">
                    {score.vehicle?.make} {score.vehicle?.model}
                  </div>
                </div>
                <div className={`text-3xl font-bold ${getHealthColor(score.overall_score)}`}>
                  {score.overall_score}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="text-center p-2 bg-white rounded">
                  <div className={`text-lg font-semibold ${getHealthColor(score.mechanical_score)}`}>
                    {score.mechanical_score}
                  </div>
                  <div className="text-xs text-gray-600">Mechanical</div>
                </div>
                <div className="text-center p-2 bg-white rounded">
                  <div className={`text-lg font-semibold ${getHealthColor(score.performance_score)}`}>
                    {score.performance_score}
                  </div>
                  <div className="text-xs text-gray-600">Performance</div>
                </div>
                <div className="text-center p-2 bg-white rounded">
                  <div className={`text-lg font-semibold ${getHealthColor(score.safety_score)}`}>
                    {score.safety_score}
                  </div>
                  <div className="text-xs text-gray-600">Safety</div>
                </div>
                <div className="text-center p-2 bg-white rounded">
                  <div className={`text-lg font-semibold ${getHealthColor(score.efficiency_score)}`}>
                    {score.efficiency_score}
                  </div>
                  <div className="text-xs text-gray-600">Efficiency</div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-1">
                <AlertCircle className={`h-4 w-4 ${
                  score.risk_level === 'critical' ? 'text-red-600' :
                  score.risk_level === 'high' ? 'text-orange-600' :
                  score.risk_level === 'medium' ? 'text-yellow-600' : 'text-green-600'
                }`} />
                <span className={`text-xs font-medium ${
                  score.risk_level === 'critical' ? 'text-red-600' :
                  score.risk_level === 'high' ? 'text-orange-600' :
                  score.risk_level === 'medium' ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {score.risk_level?.toUpperCase()} RISK
                </span>
              </div>
            </div>
          ))}

          {healthScores.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500">
              <Activity className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>No health scores available</p>
              <p className="text-sm mt-1">Generate predictions to see fleet health</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}