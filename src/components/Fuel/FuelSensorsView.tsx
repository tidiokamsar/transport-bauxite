import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Droplet, TrendingDown, TrendingUp, AlertTriangle, Activity,
  RefreshCw, Download, Settings, BarChart3, Gauge, Thermometer
} from 'lucide-react';

interface FuelSensor {
  id: string;
  vehicle_id: string;
  vehicle_registration: string;
  fuel_level_percent: number;
  fuel_level_liters: number;
  tank_capacity_liters: number;
  temperature_celsius?: number;
  flow_rate_lph?: number;
  timestamp: string;
  sensor_status: string;
  last_refuel?: string;
  consumption_rate?: number;
}

export const FuelSensorsView = () => {
  const [sensors, setSensors] = useState<FuelSensor[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [selectedSensor, setSelectedSensor] = useState<string | null>(null);

  useEffect(() => {
    fetchSensorsData();

    if (autoRefresh) {
      const interval = setInterval(fetchSensorsData, 10000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchSensorsData = async () => {
    try {
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('id, registration, fuel_capacity_liters')
        .eq('fuel_sensor_active', true);

      if (vehiclesError) throw vehiclesError;

      if (vehiclesData && vehiclesData.length > 0) {
        const sensorsData = await Promise.all(
          vehiclesData.map(async (vehicle) => {
            const { data: fuelData } = await supabase
              .from('iot_fuel_readings')
              .select('*')
              .eq('vehicle_id', vehicle.id)
              .order('timestamp', { ascending: false })
              .limit(1)
              .single();

            const { data: lastRefuel } = await supabase
              .from('fuel_transactions')
              .select('transaction_date, quantity_liters')
              .eq('vehicle_id', vehicle.id)
              .eq('transaction_type', 'refuel')
              .order('transaction_date', { ascending: false })
              .limit(1)
              .single();

            const { data: consumptionData } = await supabase
              .from('iot_fuel_readings')
              .select('fuel_level_liters, timestamp')
              .eq('vehicle_id', vehicle.id)
              .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
              .order('timestamp', { ascending: true });

            let consumptionRate = 0;
            if (consumptionData && consumptionData.length > 1) {
              const first = consumptionData[0];
              const last = consumptionData[consumptionData.length - 1];
              const fuelDiff = first.fuel_level_liters - last.fuel_level_liters;
              const timeDiff = (new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / (1000 * 60 * 60);
              consumptionRate = timeDiff > 0 ? fuelDiff / timeDiff : 0;
            }

            return {
              id: fuelData?.id || vehicle.id,
              vehicle_id: vehicle.id,
              vehicle_registration: vehicle.registration,
              fuel_level_percent: fuelData?.fuel_level_percent || 0,
              fuel_level_liters: fuelData?.fuel_level_liters || 0,
              tank_capacity_liters: vehicle.fuel_capacity_liters || 400,
              temperature_celsius: fuelData?.temperature_celsius,
              flow_rate_lph: fuelData?.flow_rate_lph,
              timestamp: fuelData?.timestamp || new Date().toISOString(),
              sensor_status: fuelData?.sensor_status || 'offline',
              last_refuel: lastRefuel?.transaction_date,
              consumption_rate: consumptionRate
            };
          })
        );

        setSensors(sensorsData);
      }
    } catch (error) {
      console.error('Error fetching fuel sensors data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLevelColor = (percent: number) => {
    if (percent < 20) return 'text-red-600 bg-red-50';
    if (percent < 50) return 'text-orange-600 bg-orange-50';
    return 'text-green-600 bg-green-50';
  };

  const getLevelBgColor = (percent: number) => {
    if (percent < 20) return 'bg-red-500';
    if (percent < 50) return 'bg-orange-500';
    return 'bg-green-500';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'warning':
        return 'bg-orange-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const filteredSensors = sensors.filter(s => {
    if (filterLevel === 'low') return s.fuel_level_percent < 30;
    if (filterLevel === 'critical') return s.fuel_level_percent < 20;
    if (filterLevel === 'normal') return s.fuel_level_percent >= 50;
    return true;
  });

  const criticalCount = sensors.filter(s => s.fuel_level_percent < 20).length;
  const lowCount = sensors.filter(s => s.fuel_level_percent >= 20 && s.fuel_level_percent < 50).length;
  const avgLevel = sensors.length > 0
    ? Math.round(sensors.reduce((sum, s) => sum + s.fuel_level_percent, 0) / sensors.length)
    : 0;
  const totalCapacity = sensors.reduce((sum, s) => sum + s.tank_capacity_liters, 0);
  const totalFuel = sensors.reduce((sum, s) => sum + s.fuel_level_liters, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Capteurs Carburant IoT</h1>
          <p className="text-gray-600">Monitoring en temps réel des réservoirs et cuves</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
              autoRefresh
                ? 'bg-green-50 border-green-600 text-green-700'
                : 'bg-gray-50 border-gray-300 text-gray-700'
            }`}
          >
            <Activity className={`w-5 h-5 ${autoRefresh ? 'animate-pulse' : ''}`} />
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
          <button
            onClick={fetchSensorsData}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="w-5 h-5" />
            Actualiser
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            <Download className="w-5 h-5" />
            Exporter
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-red-600 text-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center gap-4">
            <AlertTriangle className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-sm opacity-90">Niveau critique</p>
              <p className="text-3xl font-bold">{criticalCount}</p>
              <p className="text-xs opacity-75">véhicules &lt; 20%</p>
            </div>
          </div>
        </div>

        <div className="bg-orange-600 text-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center gap-4">
            <TrendingDown className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-sm opacity-90">Niveau bas</p>
              <p className="text-3xl font-bold">{lowCount}</p>
              <p className="text-xs opacity-75">véhicules &lt; 50%</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-600 text-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center gap-4">
            <Gauge className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-sm opacity-90">Niveau moyen</p>
              <p className="text-3xl font-bold">{avgLevel}%</p>
              <p className="text-xs opacity-75">flotte complète</p>
            </div>
          </div>
        </div>

        <div className="bg-green-600 text-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center gap-4">
            <Droplet className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-sm opacity-90">Stock total</p>
              <p className="text-3xl font-bold">{Math.round(totalFuel)}</p>
              <p className="text-xs opacity-75">L / {Math.round(totalCapacity)} L</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Filtrer par niveau</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterLevel('all')}
              className={`px-3 py-1 text-sm rounded ${
                filterLevel === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tous ({sensors.length})
            </button>
            <button
              onClick={() => setFilterLevel('critical')}
              className={`px-3 py-1 text-sm rounded ${
                filterLevel === 'critical'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Critique ({criticalCount})
            </button>
            <button
              onClick={() => setFilterLevel('low')}
              className={`px-3 py-1 text-sm rounded ${
                filterLevel === 'low'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Bas ({sensors.filter(s => s.fuel_level_percent < 30).length})
            </button>
            <button
              onClick={() => setFilterLevel('normal')}
              className={`px-3 py-1 text-sm rounded ${
                filterLevel === 'normal'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Normal ({sensors.filter(s => s.fuel_level_percent >= 50).length})
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSensors.length === 0 ? (
          <div className="col-span-full bg-white rounded-lg shadow-sm p-12 text-center">
            <Droplet className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Aucun capteur trouvé</h3>
            <p className="text-gray-500">Ajustez les filtres pour voir plus de résultats</p>
          </div>
        ) : (
          filteredSensors.map((sensor) => (
            <div
              key={sensor.id}
              onClick={() => setSelectedSensor(sensor.id)}
              className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
                selectedSensor === sensor.id ? 'ring-2 ring-blue-600' : ''
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {sensor.vehicle_registration}
                    </h3>
                    <p className="text-sm text-gray-500">
                      ID: {sensor.vehicle_id.substring(0, 8)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(sensor.sensor_status)}`} />
                    <span className="text-xs text-gray-600">{sensor.sensor_status}</span>
                  </div>
                </div>

                <div className={`p-4 rounded-lg ${getLevelColor(sensor.fuel_level_percent)} mb-4`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Droplet className="w-5 h-5" />
                      <span className="font-semibold">Niveau carburant</span>
                    </div>
                    <span className="text-2xl font-bold">{sensor.fuel_level_percent}%</span>
                  </div>
                  <div className="w-full bg-white/50 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full ${getLevelBgColor(sensor.fuel_level_percent)} transition-all`}
                      style={{ width: `${sensor.fuel_level_percent}%` }}
                    />
                  </div>
                  <p className="text-sm mt-2">
                    {sensor.fuel_level_liters.toFixed(1)} L / {sensor.tank_capacity_liters} L
                  </p>
                </div>

                <div className="space-y-3">
                  {sensor.temperature_celsius !== undefined && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Thermometer className="w-4 h-4" />
                        <span>Température</span>
                      </div>
                      <span className="font-medium text-gray-900">
                        {sensor.temperature_celsius}°C
                      </span>
                    </div>
                  )}

                  {sensor.flow_rate_lph !== undefined && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Activity className="w-4 h-4" />
                        <span>Débit</span>
                      </div>
                      <span className="font-medium text-gray-900">
                        {sensor.flow_rate_lph.toFixed(1)} L/h
                      </span>
                    </div>
                  )}

                  {(sensor.consumption_rate ?? 0) > 0 && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <TrendingDown className="w-4 h-4" />
                        <span>Consommation 24h</span>
                      </div>
                      <span className="font-medium text-gray-900">
                        {(sensor.consumption_rate ?? 0).toFixed(1)} L/h
                      </span>
                    </div>
                  )}

                  {sensor.last_refuel && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <TrendingUp className="w-4 h-4" />
                        <span>Dernier plein</span>
                      </div>
                      <span className="font-medium text-gray-900">
                        {new Date(sensor.last_refuel).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  )}

                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Dernière lecture</span>
                      <span>{new Date(sensor.timestamp).toLocaleString('fr-FR')}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 text-sm">
                    <BarChart3 className="w-4 h-4" />
                    Historique
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 text-gray-700 rounded hover:bg-gray-100 text-sm">
                    <Settings className="w-4 h-4" />
                    Config
                  </button>
                </div>

                {sensor.fuel_level_percent < 20 && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                    <div className="flex items-center gap-2 text-red-900">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        Niveau critique - Ravitaillement urgent
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
