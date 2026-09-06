import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  MapPinned, Navigation, AlertCircle, RefreshCw,
  Activity, Cpu, Wifi, Target, BarChart3, Bell, Eye, PauseCircle, AlertTriangle,
  CheckCircle, Info, Map as MapIcon
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle as LeafletCircle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { VehicleDetailModal } from './VehicleDetailModal';

interface VehiclePosition {
  id: string;
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
  current_zone?: string;
  mission_ref?: string;
}

interface GeofenceZone {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  radius: number;
  color: string;
  speed_limit?: number;
  active: boolean;
}

interface Alert {
  id: string;
  vehicle_id: string;
  type: string;
  severity: string;
  message: string;
  timestamp: string;
  resolved: boolean;
}

// Map auto-center component
function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export const FleetIntelligenceView = () => {
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);
  const [zones, setZones] = useState<GeofenceZone[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'map' | 'analytics'>('map');
  const [mapCenter, setMapCenter] = useState<[number, number]>([11.1325, -14.3267]); // Sangaredi [lat, lon]
  const [mapZoom, setMapZoom] = useState(10);

  useEffect(() => {
    fetchFleetData();
    if (autoRefresh) {
      const interval = setInterval(fetchFleetData, 10000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchFleetData = async () => {
    try {
      setLoading(true);

      // Fetch latest vehicle tracking data with trip info
      const { data: trackingData } = await supabase
        .from('vehicle_tracking')
        .select(`
          *,
          vehicle:vehicles!inner(id, registration, status),
          driver:drivers(name)
        `)
        .gte('timestamp', new Date(Date.now() - 15 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: false });

      if (trackingData) {
        // Get unique vehicles (latest position only)
        const uniqueVehicles = new Map<string, any>();
        trackingData.forEach(pos => {
          if (!uniqueVehicles.has(pos.vehicle_id)) {
            uniqueVehicles.set(pos.vehicle_id, pos);
          }
        });

        // Enrich with trip data
        const positions = await Promise.all(
          Array.from(uniqueVehicles.values()).map(async (pos) => {
            const { data: tripData } = await supabase
              .from('trips')
              .select('reference')
              .eq('vehicle_id', pos.vehicle_id)
              .eq('planned_date', new Date().toISOString().split('T')[0])
              .in('status', ['in_progress', 'planned'])
              .maybeSingle();

            return {
              id: pos.vehicle_id,
              registration: pos.vehicle.registration,
              latitude: parseFloat(pos.latitude),
              longitude: parseFloat(pos.longitude),
              speed_kmh: pos.speed || 0,
              heading: pos.heading || 0,
              timestamp: pos.timestamp,
              driver_name: pos.driver?.name,
              status: pos.vehicle.status,
              fuel_level: pos.fuel_level,
              engine_on: pos.engine_status === 'on',
              mission_ref: tripData?.reference,
            };
          })
        );
        setVehicles(positions);
      }

      // Fetch geofence zones
      const { data: zonesData } = await supabase
        .from('geofence_zones')
        .select('*')
        .eq('active', true);

      if (zonesData) {
        setZones(zonesData.map(z => ({
          id: z.id,
          name: z.name,
          type: z.zone_type,
          latitude: z.center_latitude,
          longitude: z.center_longitude,
          radius: z.radius_meters,
          color: getZoneColor(z.zone_type),
          speed_limit: z.max_speed_kmh,
          active: z.active,
        })));
      }

      // Fetch recent alerts
      const { data: alertsData } = await supabase
        .from('geofence_alerts')
        .select('*, vehicle:vehicles(registration)')
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(20);

      if (alertsData) {
        setAlerts(alertsData.map(a => ({
          id: a.id,
          vehicle_id: a.vehicle_id,
          type: a.alert_type,
          severity: a.severity,
          message: a.message,
          timestamp: a.created_at,
          resolved: a.resolved,
        })));
      }

    } catch (error) {
      console.error('Error fetching fleet data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getZoneColor = (type: string) => {
    const colors: Record<string, string> = {
      'mine_loading': '#f59e0b',
      'mine_unloading': '#10b981',
      'parking': '#3b82f6',
      'maintenance': '#ef4444',
      'restricted': '#dc2626',
      'checkpoint': '#8b5cf6',
    };
    return colors[type] || '#6b7280';
  };

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'high': return <AlertCircle className="w-5 h-5 text-orange-500" />;
      case 'medium': return <Info className="w-5 h-5 text-yellow-500" />;
      default: return <Bell className="w-5 h-5 text-blue-500" />;
    }
  };

  const getVehicleIcon = (status: string, speed: number) => {
    const color = status === 'operational' && speed > 0 ? '#10b981' :
                  status === 'operational' ? '#3b82f6' : '#ef4444';

    return L.divIcon({
      html: `
        <div style="position: relative;">
          <div style="
            background: ${color};
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M18 18.5C18.83 18.5 19.5 17.83 19.5 17C19.5 16.17 18.83 15.5 18 15.5C17.17 15.5 16.5 16.17 16.5 17C16.5 17.83 17.17 18.5 18 18.5M19.5 9.5L21.46 12H17V9.5H19.5M6 18.5C6.83 18.5 7.5 17.83 7.5 17C7.5 16.17 6.83 15.5 6 15.5C5.17 15.5 4.5 16.17 4.5 17C4.5 17.83 5.17 18.5 6 18.5M20 8H17V4H3C1.9 4 1 4.9 1 6V17H3C3 18.66 4.34 20 6 20C7.66 20 9 18.66 9 17H15C15 18.66 16.34 20 18 20C19.66 20 21 18.66 21 17H23V12L20 8Z"/>
            </svg>
          </div>
          ${speed > 0 ? `
            <div style="
              position: absolute;
              top: -8px;
              right: -8px;
              background: white;
              border-radius: 8px;
              padding: 2px 4px;
              font-size: 10px;
              font-weight: bold;
              color: ${color};
              box-shadow: 0 1px 4px rgba(0,0,0,0.2);
            ">${speed} km/h</div>
          ` : ''}
        </div>
      `,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  };

  const filteredVehicles = vehicles.filter(v =>
    filterStatus === 'all' || v.status === filterStatus
  );

  const stats = {
    total: vehicles.length,
    moving: vehicles.filter(v => v.speed_kmh > 5).length,
    stopped: vehicles.filter(v => v.speed_kmh <= 5 && v.engine_on).length,
    offline: vehicles.filter(v => !v.engine_on).length,
    alerts: alerts.filter(a => !a.resolved).length,
    zones: zones.length,
  };

  if (loading && vehicles.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Cpu className="w-8 h-8 text-blue-600" />
            Fleet Intelligence
          </h1>
          <p className="text-slate-600 mt-1">Suivi GPS & Géofencing Intelligent en Temps Réel</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setViewMode(viewMode === 'map' ? 'analytics' : 'map')}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2"
          >
            {viewMode === 'map' ? <BarChart3 className="w-5 h-5" /> : <MapIcon className="w-5 h-5" />}
            {viewMode === 'map' ? 'Analytics' : 'Carte'}
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              autoRefresh ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            <RefreshCw className={`w-5 h-5 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto' : 'Manuel'}
          </button>
          <button
            onClick={fetchFleetData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Actualiser
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-6 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.total}</span>
          </div>
          <p className="text-sm opacity-90">Véhicules actifs</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Navigation className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.moving}</span>
          </div>
          <p className="text-sm opacity-90">En mouvement</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <PauseCircle className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.stopped}</span>
          </div>
          <p className="text-sm opacity-90">À l'arrêt</p>
        </div>

        <div className="bg-gradient-to-br from-slate-500 to-slate-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Wifi className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.offline}</span>
          </div>
          <p className="text-sm opacity-90">Hors ligne</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Target className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.zones}</span>
          </div>
          <p className="text-sm opacity-90">Zones actives</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Bell className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.alerts}</span>
          </div>
          <p className="text-sm opacity-90">Alertes actives</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Map View */}
        <div className="col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <MapPinned className="w-5 h-5 text-blue-600" />
                Carte Intelligente Unifiée
              </h2>
              <div className="flex gap-2">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-1 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="all">Tous</option>
                  <option value="operational">Opérationnel</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="out_of_service">Hors service</option>
                </select>
              </div>
            </div>
          </div>

          <div className="h-[600px] relative">
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              style={{ height: '100%', width: '100%' }}
              zoomControl={true}
            >
              <MapController center={mapCenter} zoom={mapZoom} />
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />

              {/* Geofence Zones */}
              {zones.map((zone) => (
                <LeafletCircle
                  key={zone.id}
                  center={[zone.longitude, zone.latitude]}
                  radius={zone.radius}
                  pathOptions={{
                    color: zone.color,
                    fillColor: zone.color,
                    fillOpacity: 0.15,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div className="p-2">
                      <p className="font-bold">{zone.name}</p>
                      <p className="text-sm text-slate-600">{zone.type}</p>
                      {zone.speed_limit && (
                        <p className="text-xs text-orange-600 mt-1">
                          Limite: {zone.speed_limit} km/h
                        </p>
                      )}
                    </div>
                  </Popup>
                </LeafletCircle>
              ))}

              {/* Vehicles */}
              {filteredVehicles.map((vehicle) => (
                <Marker
                  key={vehicle.id}
                  position={[vehicle.longitude, vehicle.latitude]}
                  icon={getVehicleIcon(vehicle.status, vehicle.speed_kmh)}
                  eventHandlers={{
                    click: () => setSelectedVehicle(vehicle.id),
                  }}
                >
                  <Popup>
                    <div className="p-3 min-w-[250px]">
                      <div className="font-bold text-lg mb-2">{vehicle.registration}</div>
                      {vehicle.driver_name && (
                        <p className="text-sm text-slate-700 mb-1">
                          <span className="font-medium">Chauffeur:</span> {vehicle.driver_name}
                        </p>
                      )}
                      {vehicle.mission_ref && (
                        <p className="text-sm text-blue-600 mb-1">
                          <span className="font-medium">Mission:</span> {vehicle.mission_ref}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                        <div>
                          <p className="text-slate-500">Vitesse</p>
                          <p className="font-bold">{vehicle.speed_kmh} km/h</p>
                        </div>
                        {vehicle.fuel_level && (
                          <div>
                            <p className="text-slate-500">Carburant</p>
                            <p className="font-bold">{vehicle.fuel_level}%</p>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-200">
                        <p className="text-xs text-slate-500">
                          Moteur: {vehicle.engine_on ? '🟢 Allumé' : '🔴 Éteint'}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Maj: {new Date(vehicle.timestamp).toLocaleTimeString('fr-FR')}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedVehicle(vehicle.id);
                          setShowDetailModal(true);
                        }}
                        className="w-full mt-3 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Voir détails complets
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>

        {/* Alerts & Vehicle List */}
        <div className="space-y-6">
          {/* Active Alerts */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-4 border-b border-slate-200 bg-red-50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Bell className="w-5 h-5 text-red-600" />
                Alertes Actives ({stats.alerts})
              </h3>
            </div>
            <div className="p-4 max-h-[300px] overflow-y-auto space-y-2">
              {alerts.filter(a => !a.resolved).length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                  <p>Aucune alerte active</p>
                </div>
              ) : (
                alerts.filter(a => !a.resolved).map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border-l-4 ${
                      alert.severity === 'critical' ? 'bg-red-50 border-red-500' :
                      alert.severity === 'high' ? 'bg-orange-50 border-orange-500' :
                      alert.severity === 'medium' ? 'bg-yellow-50 border-yellow-500' :
                      'bg-blue-50 border-blue-500'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {getAlertIcon(alert.severity)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {alert.message}
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                          {new Date(alert.timestamp).toLocaleString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Vehicle List */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Véhicules en Temps Réel
              </h3>
            </div>
            <div className="p-4 max-h-[400px] overflow-y-auto space-y-2">
              {filteredVehicles.map((vehicle) => (
                <div
                  key={vehicle.id}
                  className={`w-full p-3 rounded-lg border-2 transition-all ${
                    selectedVehicle === vehicle.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200'
                  }`}
                >
                  <div
                    onClick={() => {
                      setSelectedVehicle(vehicle.id);
                      setMapCenter([vehicle.latitude, vehicle.longitude]);
                      setMapZoom(15);
                    }}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <div className={`w-3 h-3 rounded-full ${
                      vehicle.speed_kmh > 5 ? 'bg-green-500 animate-pulse' :
                      vehicle.engine_on ? 'bg-yellow-500' : 'bg-slate-400'
                    }`} />
                    <div className="flex-1 text-left">
                      <p className="font-medium text-slate-900">{vehicle.registration}</p>
                      {vehicle.driver_name && (
                        <p className="text-xs text-slate-600">{vehicle.driver_name}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-blue-600">{vehicle.speed_kmh} km/h</p>
                      {vehicle.fuel_level && (
                        <p className="text-xs text-slate-500">{vehicle.fuel_level}% fuel</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedVehicle(vehicle.id);
                      setShowDetailModal(true);
                    }}
                    className="w-full mt-2 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    <Eye className="w-3 h-3 inline mr-1" />
                    Voir détails
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {selectedVehicle && (
        <VehicleDetailModal
          vehicleId={selectedVehicle}
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
          }}
        />
      )}
    </div>
  );
};
