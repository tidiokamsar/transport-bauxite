import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  MapPinned, Navigation, AlertCircle, Clock, Gauge, RefreshCw, Activity, Filter, Download, Maximize2
} from 'lucide-react';
import { LiveMapView } from './LiveMapView';

interface VehiclePosition {
  id: string;
  vehicle_id: string;
  registration: string;
  latitude: number;
  longitude: number;
  speed_kmh: number;
  heading: number;
  timestamp: string;
  driver_name?: string;
  status: string;
  fuel_level?: number;
  engine_on: boolean;
}

export const GPSTrackingView = () => {
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [noGpsCount, setNoGpsCount] = useState(0);

  const fetchLivePositions = useCallback(async () => {
    try {
      // Récupérer les dernières positions GPS de chaque véhicule
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('vehicles')
        .select(`
          id,
          registration,
          status
        `)
        .eq('gps_device_active', true)
        .limit(50);

      if (vehiclesError) throw vehiclesError;

      if (vehiclesData && vehiclesData.length > 0) {
        // Pour chaque véhicule, récupérer la dernière position GPS.
        // Un véhicule sans relevé GPS n'est PAS affiché : aucune position
        // n'est fabriquée, il est compté « sans signal ».
        const positions = await Promise.all(
          vehiclesData.map(async (vehicle): Promise<VehiclePosition | null> => {
            const { data: gpsData } = await supabase
              .from('iot_gps_readings')
              .select('*')
              .eq('vehicle_id', vehicle.id)
              .order('reading_timestamp', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (!gpsData?.latitude || !gpsData?.longitude) {
              return null;
            }

            // Récupérer le chauffeur actuel si en mission
            const { data: tripData } = await supabase
              .from('trips')
              .select(`
                driver_id,
                drivers(name)
              `)
              .eq('vehicle_id', vehicle.id)
              .in('status', ['in_progress', 'planned'])
              .order('planned_date', { ascending: false })
              .limit(1)
              .single();

            // Récupérer le niveau de carburant si disponible
            const { data: fuelData } = await supabase
              .from('iot_fuel_readings')
              .select('fuel_level_percentage')
              .eq('vehicle_id', vehicle.id)
              .order('reading_timestamp', { ascending: false })
              .limit(1)
              .maybeSingle();

            return {
              id: vehicle.id,
              vehicle_id: vehicle.id,
              registration: vehicle.registration,
              latitude: parseFloat(gpsData.latitude),
              longitude: parseFloat(gpsData.longitude),
              speed_kmh: parseFloat(gpsData.speed_kmh || 0),
              heading: 0,
              timestamp: gpsData.reading_timestamp || new Date().toISOString(),
              driver_name: (tripData?.drivers as unknown as { name?: string } | null)?.name,
              status: vehicle.status,
              fuel_level: fuelData?.fuel_level_percentage,
              engine_on: gpsData?.ignition_status ?? false
            };
          })
        );

        setNoGpsCount(positions.filter(p => p === null).length);
        setVehicles(positions.filter((p): p is VehiclePosition => p !== null));
      }
    } catch (error) {
      console.error('Error fetching GPS positions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLivePositions();

    if (autoRefresh) {
      const interval = setInterval(fetchLivePositions, 15000); // Refresh every 15 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, fetchLivePositions]);

  const movingVehicles = vehicles.filter(v => v.speed_kmh > 5).length;
  const stoppedVehicles = vehicles.filter(v => v.speed_kmh <= 5).length;
  const averageSpeed = vehicles.length > 0
    ? Math.round(vehicles.reduce((sum, v) => sum + v.speed_kmh, 0) / vehicles.length)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Suivi GPS en Temps Réel</h1>
          <p className="text-gray-600">Géolocalisation et télématique de la flotte</p>
          {noGpsCount > 0 && (
            <p className="mt-1 text-sm font-medium text-amber-600">
              {noGpsCount} véhicule{noGpsCount > 1 ? 's' : ''} équipé{noGpsCount > 1 ? 's' : ''} sans signal GPS — non affiché{noGpsCount > 1 ? 's' : ''} sur la carte
            </p>
          )}
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
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={fetchLivePositions}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="w-5 h-5" />
            Actualiser
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-green-600 text-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center gap-4">
            <Navigation className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-sm opacity-90">En mouvement</p>
              <p className="text-3xl font-bold">{movingVehicles}</p>
              <p className="text-xs opacity-75">véhicules actifs</p>
            </div>
          </div>
        </div>

        <div className="bg-orange-600 text-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center gap-4">
            <Clock className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-sm opacity-90">Arrêtés</p>
              <p className="text-3xl font-bold">{stoppedVehicles}</p>
              <p className="text-xs opacity-75">véhicules arrêtés</p>
            </div>
          </div>
        </div>

        <div className="bg-red-600 text-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center gap-4">
            <AlertCircle className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-sm opacity-90">Moteur éteint</p>
              <p className="text-3xl font-bold">
                {vehicles.filter(v => !v.engine_on).length}
              </p>
              <p className="text-xs opacity-75">véhicules éteints</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-600 text-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center gap-4">
            <Gauge className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-sm opacity-90">Vitesse moy.</p>
              <p className="text-3xl font-bold">{averageSpeed}</p>
              <p className="text-xs opacity-75">km/h</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Carte plein écran */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPinned className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Carte interactive</h2>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-gray-100 rounded">
              <Filter className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded">
              <Download className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded">
              <Maximize2 className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Carte GPS en temps réel */}
        <div className="relative h-[700px] bg-gray-100">
          <LiveMapView />
        </div>
      </div>

      {/* Alertes en temps réel */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-orange-600" />
          Alertes en temps réel
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {vehicles.filter(v => v.speed_kmh === 0 && v.engine_on).length > 0 && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm font-medium text-orange-900">Arrêt prolongé</p>
              <p className="text-xs text-orange-700 mt-1">
                {vehicles.filter(v => v.speed_kmh === 0 && v.engine_on).length} véhicule(s) arrêté(s) moteur allumé
              </p>
            </div>
          )}

          {vehicles.filter(v => v.fuel_level && v.fuel_level < 20).length > 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm font-medium text-yellow-900">Carburant faible</p>
              <p className="text-xs text-yellow-700 mt-1">
                {vehicles.filter(v => v.fuel_level && v.fuel_level < 20).length} véhicule(s) niveau bas
              </p>
            </div>
          )}

          {vehicles.filter(v => v.speed_kmh > 80).length > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-medium text-red-900">Excès de vitesse</p>
              <p className="text-xs text-red-700 mt-1">
                {vehicles.filter(v => v.speed_kmh > 80).length} véhicule(s) au-dessus de 80 km/h
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
