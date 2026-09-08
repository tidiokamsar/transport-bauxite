import { useCallback, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../lib/supabase';
import {
  X, Truck, User, Fuel, Gauge, MapPin, Calendar, Clock, Weight,
  Navigation2, Activity, TrendingUp, AlertTriangle, CheckCircle, Package,
  Thermometer, BarChart3, Route, Target
} from 'lucide-react';

interface VehicleDetailModalProps {
  vehicleId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface Waypoint {
  id: string;
  sequence_number: number;
  waypoint_type: 'departure' | 'intermediate' | 'arrival';
  location_name: string;
  latitude: number;
  longitude: number;
  actual_arrival_time?: string;
  departure_time?: string;
}

interface WeightReading {
  gross_weight_kg: number;
  net_weight_kg: number;
  tare_weight_kg: number;
  axle_weights: any;
  is_overloaded: boolean;
  reading_timestamp: string;
}

interface TireReading {
  tire_position: string;
  pressure_psi: number;
  temperature_celsius: number;
  tread_depth_mm: number;
  is_anomaly: boolean;
}

interface VehicleDetail {
  id: string;
  registration: string;
  brand_model: string;
  vehicle_type: string;
  status: string;
  current_km: number;
  capacity_tonnes: number;
  gps_position?: {
    latitude: number;
    longitude: number;
    speed_kmh: number;
    timestamp: string;
  };
  fuel_data?: {
    fuel_level_percentage: number;
    fuel_level_liters: number;
    tank_capacity_liters: number;
  };
  current_trip?: {
    id: string;
    reference: string;
    departure_site: string;
    arrival_site: string;
    planned_date: string;
    gross_weight: number;
    net_weight: number;
    estimated_distance_km: number;
  };
  trip_waypoints?: Waypoint[];
  weight_data?: WeightReading;
  tire_data?: TireReading[];
  driver?: {
    name: string;
    phone: string;
    license_number: string;
  };
  recent_route?: Array<{
    latitude: number;
    longitude: number;
    speed_kmh: number;
    timestamp: string;
  }>;
  iot_device?: {
    device_id: string;
    manufacturer: string;
    model: string;
    status: string;
  };
}

export const VehicleDetailModal = ({ vehicleId, isOpen, onClose }: VehicleDetailModalProps) => {
  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'map' | 'sensors'>('info');

  const fetchVehicleDetails = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch vehicle basic info
      const { data: vehicleData } = await supabase
        .from('vehicles')
        .select('*')
        .eq('id', vehicleId)
        .single();

      if (!vehicleData) return;

      // Fetch GPS position
      const { data: gpsData } = await supabase
        .from('iot_gps_readings')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('reading_timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch fuel data
      const { data: fuelData } = await supabase
        .from('iot_fuel_readings')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('reading_timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch current trip
      const { data: tripData } = await supabase
        .from('trips')
        .select(`
          *,
          departure_site:sites!trips_departure_site_id_fkey(name),
          arrival_site:sites!trips_arrival_site_id_fkey(name),
          driver:drivers!trips_driver_id_fkey(name, phone, license_number)
        `)
        .eq('vehicle_id', vehicleId)
        .in('status', ['in_progress', 'planned'])
        .order('planned_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch trip waypoints if trip exists
      let waypointsData = null;
      if (tripData) {
        const { data } = await supabase
          .from('trip_waypoints')
          .select('*')
          .eq('trip_id', tripData.id)
          .order('sequence_number', { ascending: true });
        waypointsData = data;
      }

      // Fetch weight sensor data
      const { data: weightData } = await supabase
        .from('iot_weight_readings')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('reading_timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch tire sensor data
      const { data: tireData } = await supabase
        .from('iot_tire_readings')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('reading_timestamp', { ascending: false })
        .limit(4);

      // Fetch recent route (last 50 points)
      const { data: routeData } = await supabase
        .from('iot_gps_readings')
        .select('latitude, longitude, speed_kmh, timestamp:reading_timestamp')
        .eq('vehicle_id', vehicleId)
        .order('reading_timestamp', { ascending: false })
        .limit(50);

      // Fetch IoT device info
      const { data: deviceData } = await supabase
        .from('iot_devices')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .eq('device_type', 'gps_tracker')
        .maybeSingle();

      setVehicle({
        ...vehicleData,
        gps_position: gpsData ? {
          latitude: parseFloat(gpsData.latitude),
          longitude: parseFloat(gpsData.longitude),
          speed_kmh: parseFloat(gpsData.speed_kmh || 0),
          timestamp: gpsData.reading_timestamp,
        } : undefined,
        fuel_data: fuelData ? {
          fuel_level_percentage: parseFloat(fuelData.fuel_level_percentage || 0),
          fuel_level_liters: parseFloat(fuelData.fuel_level_liters || 0),
          tank_capacity_liters: parseFloat(fuelData.tank_capacity_liters || 0),
        } : undefined,
        current_trip: tripData ? {
          id: tripData.id,
          reference: tripData.reference,
          departure_site: tripData.departure_site?.name || 'N/A',
          arrival_site: tripData.arrival_site?.name || 'N/A',
          planned_date: tripData.planned_date,
          gross_weight: tripData.gross_weight || 0,
          net_weight: tripData.net_weight || 0,
          estimated_distance_km: tripData.estimated_distance_km || 0,
        } : undefined,
        trip_waypoints: waypointsData?.map(w => ({
          id: w.id,
          sequence_number: w.sequence_number,
          waypoint_type: w.waypoint_type,
          location_name: w.location_name,
          latitude: parseFloat(w.latitude),
          longitude: parseFloat(w.longitude),
          actual_arrival_time: w.actual_arrival_time,
          departure_time: w.departure_time,
        })) || [],
        weight_data: weightData ? {
          gross_weight_kg: parseFloat(weightData.gross_weight_kg),
          net_weight_kg: parseFloat(weightData.net_weight_kg),
          tare_weight_kg: parseFloat(weightData.tare_weight_kg),
          axle_weights: weightData.axle_weights,
          is_overloaded: weightData.is_overloaded,
          reading_timestamp: weightData.reading_timestamp,
        } : undefined,
        tire_data: tireData?.map(t => ({
          tire_position: t.tire_position,
          pressure_psi: parseFloat(t.pressure_psi),
          temperature_celsius: parseFloat(t.temperature_celsius),
          tread_depth_mm: parseFloat(t.tread_depth_mm),
          is_anomaly: t.is_anomaly,
        })) || [],
        driver: tripData?.driver ? {
          name: tripData.driver.name,
          phone: tripData.driver.phone || 'N/A',
          license_number: tripData.driver.license_number || 'N/A',
        } : undefined,
        recent_route: routeData?.map(r => ({
          latitude: parseFloat(r.latitude),
          longitude: parseFloat(r.longitude),
          speed_kmh: parseFloat(r.speed_kmh || 0),
          timestamp: r.timestamp,
        })) || [],
        iot_device: deviceData || undefined,
      });
    } catch (error) {
      console.error('Error fetching vehicle details:', error);
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    if (isOpen && vehicleId) {
      fetchVehicleDetails();
    }
  }, [isOpen, vehicleId, fetchVehicleDetails]);

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-xl p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-slate-600 mt-4">Chargement des données...</p>
        </div>
      </div>
    );
  }

  if (!vehicle) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'maintenance': return 'bg-orange-100 text-orange-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'En service';
      case 'maintenance': return 'Maintenance';
      case 'inactive': return 'Inactif';
      default: return status;
    }
  };

  const getFuelColor = (level: number) => {
    if (level < 15) return 'text-red-600';
    if (level < 30) return 'text-orange-600';
    return 'text-green-600';
  };

  return (
    <div className="fixed inset-0 z-[2000] overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/60" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto z-[2001]">
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-4">
              <Truck className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">{vehicle.registration}</h2>
                <p className="text-blue-100 text-sm">{vehicle.brand_model}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(vehicle.status)}`}>
                {getStatusLabel(vehicle.status)}
              </span>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-blue-800 rounded-lg transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-slate-200 px-6">
            <div className="flex gap-4">
              {[
                { id: 'info', label: 'Informations', icon: Activity },
                { id: 'map', label: 'Trajet & Carte', icon: MapPin },
                { id: 'sensors', label: 'Capteurs IoT', icon: BarChart3 },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600 font-medium'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {activeTab === 'info' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Current Status */}
                <div className="bg-slate-50 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-600" />
                    État Actuel
                  </h3>
                  <div className="space-y-4">
                    {vehicle.gps_position && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 flex items-center gap-2">
                            <Gauge className="w-4 h-4" />
                            Vitesse
                          </span>
                          <span className="text-2xl font-bold text-slate-900">
                            {vehicle.gps_position.speed_kmh.toFixed(1)} km/h
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Dernière position
                          </span>
                          <span className="text-sm text-slate-700">
                            {new Date(vehicle.gps_position.timestamp).toLocaleString('fr-FR')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            Coordonnées
                          </span>
                          <span className="text-sm text-slate-700 font-mono">
                            {vehicle.gps_position.latitude.toFixed(4)}°N, {Math.abs(vehicle.gps_position.longitude).toFixed(4)}°W
                          </span>
                        </div>
                      </>
                    )}

                    {vehicle.fuel_data && (
                      <>
                        <div className="pt-4 border-t border-slate-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-slate-600 flex items-center gap-2">
                              <Fuel className="w-4 h-4" />
                              Niveau carburant
                            </span>
                            <span className={`text-2xl font-bold ${getFuelColor(vehicle.fuel_data.fuel_level_percentage)}`}>
                              {vehicle.fuel_data.fuel_level_percentage.toFixed(1)}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-3">
                            <div
                              className={`h-3 rounded-full ${
                                vehicle.fuel_data.fuel_level_percentage < 15
                                  ? 'bg-red-600'
                                  : vehicle.fuel_data.fuel_level_percentage < 30
                                  ? 'bg-orange-600'
                                  : 'bg-green-600'
                              }`}
                              style={{ width: `${vehicle.fuel_data.fuel_level_percentage}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-slate-500 mt-1">
                            <span>{vehicle.fuel_data.fuel_level_liters.toFixed(0)} L</span>
                            <span>{vehicle.fuel_data.tank_capacity_liters.toFixed(0)} L</span>
                          </div>
                        </div>
                      </>
                    )}

                    <div className="pt-4 border-t border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          Kilométrage
                        </span>
                        <span className="text-xl font-bold text-slate-900">
                          {vehicle.current_km.toLocaleString('fr-FR')} km
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Current Trip */}
                <div className="bg-slate-50 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Route className="w-5 h-5 text-blue-600" />
                    Mission en Cours
                  </h3>
                  {vehicle.current_trip ? (
                    <div className="space-y-4">
                      <div>
                        <div className="text-sm text-slate-500">Référence</div>
                        <div className="text-lg font-semibold text-slate-900">
                          {vehicle.current_trip.reference}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <div className="text-sm text-slate-500">Départ</div>
                          <div className="font-medium text-slate-900">
                            {vehicle.current_trip.departure_site}
                          </div>
                        </div>
                        <Navigation2 className="w-5 h-5 text-blue-600" />
                        <div className="flex-1">
                          <div className="text-sm text-slate-500">Arrivée</div>
                          <div className="font-medium text-slate-900">
                            {vehicle.current_trip.arrival_site}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-slate-500 flex items-center gap-1">
                            <Weight className="w-4 h-4" />
                            Poids net
                          </div>
                          <div className="text-xl font-bold text-slate-900">
                            {(vehicle.current_trip.net_weight / 1000).toFixed(1)} T
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-slate-500 flex items-center gap-1">
                            <Target className="w-4 h-4" />
                            Distance
                          </div>
                          <div className="text-xl font-bold text-slate-900">
                            {vehicle.current_trip.estimated_distance_km.toFixed(0)} km
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="text-sm text-slate-500 flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Date prévue
                        </div>
                        <div className="font-medium text-slate-900">
                          {new Date(vehicle.current_trip.planned_date).toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Aucune mission en cours</p>
                    </div>
                  )}
                </div>

                {/* Driver Info */}
                {vehicle.driver && (
                  <div className="bg-slate-50 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <User className="w-5 h-5 text-blue-600" />
                      Chauffeur
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm text-slate-500">Nom</div>
                        <div className="text-lg font-semibold text-slate-900">{vehicle.driver.name}</div>
                      </div>
                      <div>
                        <div className="text-sm text-slate-500">Téléphone</div>
                        <div className="font-medium text-slate-900">{vehicle.driver.phone}</div>
                      </div>
                      <div>
                        <div className="text-sm text-slate-500">N° Permis</div>
                        <div className="font-medium text-slate-900">{vehicle.driver.license_number}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Vehicle Info */}
                <div className="bg-slate-50 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-blue-600" />
                    Caractéristiques
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Type</span>
                      <span className="font-medium text-slate-900">{vehicle.vehicle_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Modèle</span>
                      <span className="font-medium text-slate-900">{vehicle.brand_model}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Capacité</span>
                      <span className="font-medium text-slate-900">{vehicle.capacity_tonnes} tonnes</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Immatriculation</span>
                      <span className="font-medium text-slate-900 font-mono">{vehicle.registration}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'map' && vehicle.gps_position && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <div className="h-[500px]">
                    <MapContainer
                      center={[vehicle.gps_position.latitude, vehicle.gps_position.longitude]}
                      zoom={11}
                      style={{ height: '100%', width: '100%' }}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                      {/* Tracé du trajet récent */}
                      {vehicle.recent_route && vehicle.recent_route.length > 1 && (
                        <Polyline
                          positions={vehicle.recent_route.map((p): [number, number] => [p.latitude, p.longitude]).reverse()}
                          color="#60a5fa"
                          weight={3}
                          opacity={0.5}
                        />
                      )}

                      {/* Tracé du trajet planifié avec waypoints */}
                      {vehicle.trip_waypoints && vehicle.trip_waypoints.length > 1 && (
                        <>
                          <Polyline
                            positions={vehicle.trip_waypoints.map(w => [w.latitude, w.longitude])}
                            color="#f59e0b"
                            weight={4}
                            opacity={0.8}
                            dashArray="10, 10"
                          />
                          {vehicle.trip_waypoints.map((waypoint, _idx) => (
                            <Marker
                              key={waypoint.id}
                              position={[waypoint.latitude, waypoint.longitude]}
                              icon={L.divIcon({
                                html: `<div style="background: ${
                                  waypoint.waypoint_type === 'departure' ? '#10b981' :
                                  waypoint.waypoint_type === 'arrival' ? '#ef4444' : '#f59e0b'
                                }; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>
                                <div style="position: absolute; top: 20px; left: -30px; background: white; padding: 2px 6px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); font-size: 10px; font-weight: bold; white-space: nowrap;">${waypoint.location_name}</div>`,
                                className: '',
                                iconSize: [16, 16],
                              })}
                            />
                          ))}
                        </>
                      )}

                      {/* Position actuelle du véhicule */}
                      <Marker
                        position={[vehicle.gps_position.latitude, vehicle.gps_position.longitude]}
                        icon={L.divIcon({
                          html: `<div style="background: #3b82f6; width: 24px; height: 24px; border-radius: 50%; border: 4px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); animation: pulse 2s infinite;"></div>`,
                          className: '',
                          iconSize: [24, 24],
                        })}
                      />
                    </MapContainer>
                  </div>
                </div>

                {/* Légende */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                      <span className="font-semibold text-blue-900">Position Actuelle</span>
                    </div>
                    <p className="text-sm text-blue-700">Localisation en temps réel du véhicule</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-1 bg-orange-500" style={{borderTop: '4px dashed #f59e0b'}}></div>
                      <span className="font-semibold text-orange-900">Trajet Planifié</span>
                    </div>
                    <p className="text-sm text-orange-700">Itinéraire avec points de passage</p>
                  </div>
                  <div className="bg-sky-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-1 bg-sky-400"></div>
                      <span className="font-semibold text-sky-900">Historique GPS</span>
                    </div>
                    <p className="text-sm text-sky-700">Derniers déplacements (50 points)</p>
                  </div>
                </div>

                {/* Waypoints list */}
                {vehicle.trip_waypoints && vehicle.trip_waypoints.length > 0 && (
                  <div className="bg-slate-50 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Route className="w-5 h-5 text-orange-600" />
                      Points de Passage du Trajet
                    </h3>
                    <div className="space-y-3">
                      {vehicle.trip_waypoints.map((waypoint, idx) => (
                        <div key={waypoint.id} className="flex items-center gap-4 p-3 bg-white rounded-lg">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                            waypoint.waypoint_type === 'departure' ? 'bg-green-500' :
                            waypoint.waypoint_type === 'arrival' ? 'bg-red-500' : 'bg-orange-500'
                          }`}>
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-slate-900">{waypoint.location_name}</div>
                            <div className="text-sm text-slate-600">
                              {waypoint.latitude.toFixed(4)}°N, {Math.abs(waypoint.longitude).toFixed(4)}°W
                            </div>
                            {waypoint.actual_arrival_time && (
                              <div className="text-xs text-green-600 mt-1">
                                ✓ Passé le {new Date(waypoint.actual_arrival_time).toLocaleString('fr-FR')}
                              </div>
                            )}
                          </div>
                          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                            waypoint.waypoint_type === 'departure' ? 'bg-green-100 text-green-700' :
                            waypoint.waypoint_type === 'arrival' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {waypoint.waypoint_type === 'departure' ? 'Départ' :
                             waypoint.waypoint_type === 'arrival' ? 'Arrivée' : 'Étape'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'sensors' && (
              <div className="space-y-6">
                {/* Weight Sensor */}
                {vehicle.weight_data && (
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border-2 border-purple-200">
                    <h3 className="text-xl font-bold text-purple-900 mb-6 flex items-center gap-2">
                      <Weight className="w-6 h-6" />
                      Capteur de Poids - Tonnage
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white rounded-lg p-6 text-center">
                        <div className="text-sm text-purple-600 mb-2">Poids Brut</div>
                        <div className="text-4xl font-bold text-purple-900">
                          {(vehicle.weight_data.gross_weight_kg / 1000).toFixed(1)}
                        </div>
                        <div className="text-sm text-purple-600 mt-1">Tonnes</div>
                      </div>
                      <div className="bg-white rounded-lg p-6 text-center">
                        <div className="text-sm text-purple-600 mb-2">Poids Net (Charge)</div>
                        <div className="text-4xl font-bold text-purple-900">
                          {(vehicle.weight_data.net_weight_kg / 1000).toFixed(1)}
                        </div>
                        <div className="text-sm text-purple-600 mt-1">Tonnes</div>
                      </div>
                      <div className="bg-white rounded-lg p-6 text-center">
                        <div className="text-sm text-purple-600 mb-2">Poids à Vide</div>
                        <div className="text-4xl font-bold text-purple-900">
                          {(vehicle.weight_data.tare_weight_kg / 1000).toFixed(1)}
                        </div>
                        <div className="text-sm text-purple-600 mt-1">Tonnes</div>
                      </div>
                    </div>
                    {vehicle.weight_data.axle_weights && (
                      <div className="mt-6 grid grid-cols-2 gap-4">
                        <div className="bg-white rounded-lg p-4">
                          <div className="text-sm text-purple-600 mb-1">Essieu Avant</div>
                          <div className="text-2xl font-bold text-purple-900">
                            {((vehicle.weight_data.axle_weights.front || vehicle.weight_data.axle_weights.front_axle) / 1000).toFixed(1)} T
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4">
                          <div className="text-sm text-purple-600 mb-1">Essieu Arrière</div>
                          <div className="text-2xl font-bold text-purple-900">
                            {((vehicle.weight_data.axle_weights.rear || vehicle.weight_data.axle_weights.rear_axle) / 1000).toFixed(1)} T
                          </div>
                        </div>
                      </div>
                    )}
                    {vehicle.weight_data.is_overloaded && (
                      <div className="mt-4 flex items-center gap-2 p-4 bg-red-100 border-2 border-red-300 rounded-lg">
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                        <span className="font-semibold text-red-800">SURCHARGE DÉTECTÉE - Poids dépassé!</span>
                      </div>
                    )}
                    <div className="mt-4 text-xs text-purple-700 text-center">
                      Dernière mesure: {new Date(vehicle.weight_data.reading_timestamp).toLocaleString('fr-FR')}
                    </div>
                  </div>
                )}

                {/* Tire Sensors */}
                {vehicle.tire_data && vehicle.tire_data.length > 0 && (
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-6 border-2 border-amber-200">
                    <h3 className="text-xl font-bold text-amber-900 mb-6 flex items-center gap-2">
                      <Thermometer className="w-6 h-6" />
                      Capteurs Pneumatiques
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {vehicle.tire_data.map((tire) => {
                        const getPressureColor = (psi: number) => {
                          if (psi < 80) return 'border-red-300 bg-red-50';
                          if (psi < 90) return 'border-orange-300 bg-orange-50';
                          return 'border-green-300 bg-green-50';
                        };
                        const getPositionLabel = (pos: string) => {
                          if (pos === 'FL' || pos === 'front_left') return 'Avant Gauche';
                          if (pos === 'FR' || pos === 'front_right') return 'Avant Droit';
                          if (pos === 'RL' || pos === 'rear_left') return 'Arrière Gauche';
                          if (pos === 'RR' || pos === 'rear_right') return 'Arrière Droit';
                          return pos;
                        };
                        return (
                          <div key={tire.tire_position} className={`p-4 rounded-lg border-2 ${getPressureColor(tire.pressure_psi)}`}>
                            <div className="font-bold text-amber-900 mb-3 flex items-center justify-between">
                              <span>{getPositionLabel(tire.tire_position)}</span>
                              {tire.is_anomaly && <AlertTriangle className="w-5 h-5 text-red-600" />}
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="bg-white rounded p-2">
                                <div className="text-xs text-amber-600">Pression</div>
                                <div className="text-xl font-bold text-amber-900">{tire.pressure_psi.toFixed(1)}</div>
                                <div className="text-xs text-amber-600">PSI</div>
                              </div>
                              <div className="bg-white rounded p-2">
                                <div className="text-xs text-amber-600">Temp.</div>
                                <div className="text-xl font-bold text-amber-900">{tire.temperature_celsius.toFixed(0)}</div>
                                <div className="text-xs text-amber-600">°C</div>
                              </div>
                            </div>
                            <div className="mt-2 bg-white rounded p-2 text-center">
                              <div className="text-xs text-amber-600">Profondeur</div>
                              <div className="text-lg font-bold text-amber-900">{tire.tread_depth_mm.toFixed(1)} mm</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {vehicle.tire_data.some(t => t.is_anomaly) && (
                      <div className="mt-4 flex items-center gap-2 p-4 bg-red-100 border-2 border-red-300 rounded-lg">
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                        <span className="font-semibold text-red-800">Anomalie détectée - Vérification recommandée</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Other sensors */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {vehicle.iot_device && (
                  <div className="bg-slate-50 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-blue-600" />
                      Dispositif IoT
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-slate-600">ID Dispositif</span>
                        <span className="font-medium text-slate-900 font-mono">{vehicle.iot_device.device_id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Fabricant</span>
                        <span className="font-medium text-slate-900">{vehicle.iot_device.manufacturer}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Modèle</span>
                        <span className="font-medium text-slate-900">{vehicle.iot_device.model}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Statut</span>
                        <span className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="font-medium text-green-600">Actif</span>
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {vehicle.fuel_data && (
                  <div className="bg-slate-50 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Fuel className="w-5 h-5 text-blue-600" />
                      Capteur Carburant
                    </h3>
                    <div className="space-y-4">
                      <div className="text-center">
                        <div className="text-5xl font-bold" style={{
                          color: vehicle.fuel_data.fuel_level_percentage < 15 ? '#dc2626' :
                                 vehicle.fuel_data.fuel_level_percentage < 30 ? '#ea580c' : '#16a34a'
                        }}>
                          {vehicle.fuel_data.fuel_level_percentage.toFixed(1)}%
                        </div>
                        <div className="text-sm text-slate-600 mt-1">Niveau actuel</div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-white rounded-lg">
                          <div className="text-2xl font-bold text-slate-900">
                            {vehicle.fuel_data.fuel_level_liters.toFixed(0)}
                          </div>
                          <div className="text-xs text-slate-600">Litres restants</div>
                        </div>
                        <div className="text-center p-3 bg-white rounded-lg">
                          <div className="text-2xl font-bold text-slate-900">
                            {vehicle.fuel_data.tank_capacity_liters.toFixed(0)}
                          </div>
                          <div className="text-xs text-slate-600">Capacité totale</div>
                        </div>
                      </div>
                      {vehicle.fuel_data.fuel_level_percentage < 15 && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                          <span className="text-sm text-red-800">Niveau critique - Ravitaillement urgent nécessaire</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {vehicle.gps_position && (
                  <div className="bg-slate-50 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Navigation2 className="w-5 h-5 text-blue-600" />
                      Capteur GPS
                    </h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-white rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {vehicle.gps_position.speed_kmh.toFixed(1)}
                          </div>
                          <div className="text-xs text-slate-600">km/h</div>
                        </div>
                        <div className="text-center p-3 bg-white rounded-lg">
                          <div className="text-sm font-mono text-slate-900">
                            {vehicle.gps_position.latitude.toFixed(4)}°
                          </div>
                          <div className="text-xs text-slate-600">Latitude</div>
                        </div>
                      </div>
                      <div className="p-3 bg-white rounded-lg">
                        <div className="text-xs text-slate-600 mb-1">Longitude</div>
                        <div className="text-sm font-mono text-slate-900">
                          {vehicle.gps_position.longitude.toFixed(4)}°
                        </div>
                      </div>
                      <div className="p-3 bg-white rounded-lg">
                        <div className="text-xs text-slate-600 mb-1">Dernière mise à jour</div>
                        <div className="text-sm text-slate-900">
                          {new Date(vehicle.gps_position.timestamp).toLocaleString('fr-FR')}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-slate-50 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Thermometer className="w-5 h-5 text-blue-600" />
                    État des Capteurs
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                      <span className="text-sm text-slate-700">GPS Tracker</span>
                      <span className="flex items-center gap-2 text-sm font-medium text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        Opérationnel
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                      <span className="text-sm text-slate-700">Capteur Carburant</span>
                      <span className="flex items-center gap-2 text-sm font-medium text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        Opérationnel
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                      <span className="text-sm text-slate-700">Connexion Réseau</span>
                      <span className="flex items-center gap-2 text-sm font-medium text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        En ligne
                      </span>
                    </div>
                  </div>
                </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
