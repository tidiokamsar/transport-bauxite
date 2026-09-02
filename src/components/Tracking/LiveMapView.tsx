import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../lib/supabase';
import {
  MapPin, Gauge, Fuel, User, Clock, Navigation, Map as MapIcon,
  TrendingUp, Package, AlertTriangle, CheckCircle, Truck, X, Maximize2,
  Activity, Droplet, Thermometer, Battery, Radio, Calendar
} from 'lucide-react';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Waypoint {
  id: string;
  sequence_number: number;
  waypoint_type: 'departure' | 'intermediate' | 'arrival';
  location_name: string;
  latitude: number;
  longitude: number;
  actual_arrival_time?: string;
}

interface ActiveTrip {
  trip_id: string;
  trip_reference: string;
  vehicle_id: string;
  vehicle_registration: string;
  vehicle_brand: string;
  driver_name?: string;
  current_latitude: number;
  current_longitude: number;
  current_speed: number;
  fuel_level?: number;
  waypoints: Waypoint[];
  departure_site: string;
  arrival_site: string;
  status: string;
  planned_date: string;
  actual_departure_time?: string;
  shift_name?: string;
  last_update: string;
  km_start?: number;
  km_end?: number;
  net_weight?: number;
}

interface GeofenceZone {
  id: string;
  name: string;
  center_lat?: number;
  center_lng?: number;
  radius_meters?: number;
  color: string;
  is_active: boolean;
}

export const LiveMapView = () => {
  const [activeTrips, setActiveTrips] = useState<ActiveTrip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [center] = useState<[number, number]>([11.0967, -13.7761]);
  const [loading, setLoading] = useState(true);
  const [showPlannedRoute, setShowPlannedRoute] = useState(true);
  const [showGeofenceZones, setShowGeofenceZones] = useState(true);
  const [geofenceZones, setGeofenceZones] = useState<GeofenceZone[]>([]);
  const [filterMoving, setFilterMoving] = useState<'all' | 'moving' | 'stopped'>('all');
  const mapRef = useRef<any>(null);
  const detailMapRef = useRef<any>(null);

  useEffect(() => {
    fetchActiveTrips();
    fetchGeofenceZones();
    const interval = setInterval(fetchActiveTrips, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchGeofenceZones = async () => {
    try {
      const { data } = await supabase
        .from('geofence_zones')
        .select('id, name, center_lat, center_lng, radius_meters, color, is_active')
        .eq('is_active', true)
        .eq('geometry_type', 'circle');

      if (data) {
        setGeofenceZones(data);
      }
    } catch (error) {
      console.error('Error fetching geofence zones:', error);
    }
  };

  const fetchActiveTrips = async () => {
    try {
      const { data: tripsData } = await supabase
        .from('trips')
        .select(`
          id,
          reference,
          status,
          planned_date,
          actual_departure_time,
          km_start,
          km_end,
          net_weight,
          vehicle_id,
          driver_id,
          vehicles!trips_vehicle_id_fkey(registration, brand_model),
          drivers!trips_driver_id_fkey(name),
          departure_site:sites!trips_departure_site_id_fkey(name),
          arrival_site:sites!trips_arrival_site_id_fkey(name),
          shift:work_shifts(display_name)
        `)
        .eq('status', 'in_progress')
        .order('planned_date', { ascending: false })
        .limit(50);

      if (tripsData && tripsData.length > 0) {
        const trips = await Promise.all(
          tripsData.map(async (trip) => {
            const { data: gpsData } = await supabase
              .from('iot_gps_readings')
              .select('latitude, longitude, speed_kmh, reading_timestamp')
              .eq('vehicle_id', trip.vehicle_id)
              .order('reading_timestamp', { ascending: false })
              .limit(1)
              .maybeSingle();

            const { data: fuelData } = await supabase
              .from('iot_fuel_readings')
              .select('fuel_level_percentage')
              .eq('vehicle_id', trip.vehicle_id)
              .order('reading_timestamp', { ascending: false })
              .limit(1)
              .maybeSingle();

            const { data: waypoints } = await supabase
              .from('trip_waypoints')
              .select('*')
              .eq('trip_id', trip.id)
              .order('sequence_number');

            if (gpsData && gpsData.latitude && gpsData.longitude && waypoints && waypoints.length > 0) {
              return {
                trip_id: trip.id,
                trip_reference: trip.reference,
                vehicle_id: trip.vehicle_id,
                vehicle_registration: (trip.vehicles as any)?.registration || '',
                vehicle_brand: (trip.vehicles as any)?.brand_model || '',
                driver_name: (trip.drivers as any)?.name,
                current_latitude: parseFloat(gpsData.latitude),
                current_longitude: parseFloat(gpsData.longitude),
                current_speed: parseFloat(gpsData.speed_kmh || 0),
                fuel_level: fuelData?.fuel_level_percentage,
                waypoints: waypoints.map(w => ({
                  ...w,
                  latitude: parseFloat(w.latitude),
                  longitude: parseFloat(w.longitude),
                })),
                departure_site: (trip.departure_site as any)?.name || '',
                arrival_site: (trip.arrival_site as any)?.name || '',
                status: trip.status,
                planned_date: trip.planned_date,
                actual_departure_time: trip.actual_departure_time,
                shift_name: (trip.shift as any)?.display_name,
                last_update: gpsData.reading_timestamp,
                km_start: trip.km_start,
                km_end: trip.km_end,
                net_weight: trip.net_weight,
              };
            }
            return null;
          })
        );

        setActiveTrips(trips.filter((t): t is ActiveTrip => t !== null));
      } else {
        setActiveTrips([]);
      }
    } catch (error) {
      console.error('Error fetching active trips:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDepartureIcon = (label: string) => {
    return L.divIcon({
      html: `
        <div style="position: relative; width: 50px; height: 50px;">
          <div style="
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            background: #10B981;
            width: 28px; height: 28px;
            border-radius: 50%;
            border: 4px solid white;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
            font-size: 16px;
          ">D</div>
          <div style="
            position: absolute;
            top: -36px; left: 50%;
            transform: translateX(-50%);
            background: #10B981;
            color: white;
            font-size: 12px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 6px;
            white-space: nowrap;
            box-shadow: 0 3px 8px rgba(0,0,0,0.3);
          ">${label}</div>
        </div>
      `,
      className: 'departure-marker',
      iconSize: [50, 50],
      iconAnchor: [25, 25],
    });
  };

  const getArrivalIcon = (label: string) => {
    return L.divIcon({
      html: `
        <div style="position: relative; width: 50px; height: 50px;">
          <div style="
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            background: #EF4444;
            width: 28px; height: 28px;
            border-radius: 50%;
            border: 4px solid white;
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
            font-size: 16px;
          ">A</div>
          <div style="
            position: absolute;
            top: -36px; left: 50%;
            transform: translateX(-50%);
            background: #EF4444;
            color: white;
            font-size: 12px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 6px;
            white-space: nowrap;
            box-shadow: 0 3px 8px rgba(0,0,0,0.3);
          ">${label}</div>
        </div>
      `,
      className: 'arrival-marker',
      iconSize: [50, 50],
      iconAnchor: [25, 25],
    });
  };

  const getCurrentPositionIcon = (registration: string, speed: number) => {
    const isMoving = speed > 5;
    return L.divIcon({
      html: `
        <div style="position: relative; width: 60px; height: 60px;">
          <div style="
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            background: ${isMoving ? '#3B82F6' : '#F59E0B'};
            width: 32px; height: 32px;
            border-radius: 50%;
            border: 5px solid white;
            box-shadow: 0 4px 16px rgba(59, 130, 246, 0.8);
            animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          "></div>
          <div style="
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 0; height: 0;
            border-left: 10px solid transparent;
            border-right: 10px solid transparent;
            border-bottom: 16px solid white;
            filter: drop-shadow(0 3px 6px rgba(0,0,0,0.4));
          "></div>
          <div style="
            position: absolute;
            top: -40px; left: 50%;
            transform: translateX(-50%);
            background: ${isMoving ? '#3B82F6' : '#F59E0B'};
            color: white;
            font-size: 11px;
            font-weight: 800;
            padding: 4px 10px;
            border-radius: 6px;
            white-space: nowrap;
            box-shadow: 0 3px 8px rgba(0,0,0,0.3);
            letter-spacing: 0.5px;
          ">${registration}</div>
          <div style="
            position: absolute;
            bottom: -32px; left: 50%;
            transform: translateX(-50%);
            background: white;
            color: ${isMoving ? '#3B82F6' : '#F59E0B'};
            font-size: 10px;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 4px;
            white-space: nowrap;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            border: 2px solid ${isMoving ? '#3B82F6' : '#F59E0B'};
          ">${speed.toFixed(0)} km/h</div>
        </div>
        <style>
          @keyframes pulse-ring {
            0%, 100% {
              box-shadow: 0 4px 16px rgba(59, 130, 246, 0.8), 0 0 0 0 rgba(59, 130, 246, 0.5);
            }
            50% {
              box-shadow: 0 4px 16px rgba(59, 130, 246, 0.8), 0 0 0 15px rgba(59, 130, 246, 0);
            }
          }
        </style>
      `,
      className: 'current-position-marker',
      iconSize: [60, 60],
      iconAnchor: [30, 40],
    });
  };

  const filteredTrips = activeTrips.filter(trip => {
    if (filterMoving === 'moving') return trip.current_speed > 5;
    if (filterMoving === 'stopped') return trip.current_speed <= 5;
    return true;
  });

  const selectedTrip = activeTrips.find(t => t.trip_id === selectedTripId);

  const handleOpenDetailModal = (tripId: string) => {
    setSelectedTripId(tripId);
    setShowDetailModal(true);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const calculateProgress = (trip: ActiveTrip): number => {
    if (!trip.waypoints || trip.waypoints.length < 2) return 0;
    const start = trip.waypoints[0];
    const end = trip.waypoints[trip.waypoints.length - 1];
    const totalDistance = calculateDistance(start.latitude, start.longitude, end.latitude, end.longitude);
    const coveredDistance = calculateDistance(start.latitude, start.longitude, trip.current_latitude, trip.current_longitude);
    return Math.min(Math.round((coveredDistance / totalDistance) * 100), 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Chargement des missions en cours...</p>
        </div>
      </div>
    );
  }

  if (activeTrips.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="text-center max-w-md p-8">
          <Truck className="w-20 h-20 text-slate-300 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-slate-700 mb-2">Aucune mission en cours</h3>
          <p className="text-slate-500">Il n'y a actuellement aucun véhicule avec une mission active.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden flex">
      {/* Sidebar */}
      <div className="w-96 bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden shadow-lg">
        <div className="p-5 border-b border-slate-200 bg-gradient-to-br from-blue-600 to-blue-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Navigation className="w-6 h-6" />
              Missions en cours
            </h3>
            <span className="bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-bold">
              {activeTrips.length}
            </span>
          </div>
          <p className="text-blue-100 text-sm">Suivi GPS en temps réel</p>
        </div>

        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterMoving('all')}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                filterMoving === 'all'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Tous ({activeTrips.length})
            </button>
            <button
              onClick={() => setFilterMoving('moving')}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                filterMoving === 'moving'
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              En mvt ({activeTrips.filter(t => t.current_speed > 5).length})
            </button>
            <button
              onClick={() => setFilterMoving('stopped')}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                filterMoving === 'stopped'
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Arrêtés ({activeTrips.filter(t => t.current_speed <= 5).length})
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredTrips.map((trip) => (
            <div
              key={trip.trip_id}
              className={`border-b border-slate-200 hover:bg-blue-50 transition-all ${
                selectedTripId === trip.trip_id
                  ? 'bg-blue-50 border-l-4 border-l-blue-600'
                  : 'hover:border-l-4 hover:border-l-blue-300'
              }`}
            >
              <button
                onClick={() => setSelectedTripId(trip.trip_id === selectedTripId ? null : trip.trip_id)}
                className="w-full p-4 text-left"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      trip.current_speed > 5 ? 'bg-green-100' : 'bg-orange-100'
                    }`}>
                      <Truck className={`w-6 h-6 ${
                        trip.current_speed > 5 ? 'text-green-600' : 'text-orange-600'
                      }`} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-lg">{trip.vehicle_registration}</p>
                      <p className="text-xs text-slate-500">{trip.vehicle_brand}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                      trip.current_speed > 5
                        ? 'bg-green-100 text-green-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {trip.current_speed.toFixed(0)} km/h
                    </span>
                  </div>
                </div>

                <div className="mb-3 pb-3 border-b border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">Mission</p>
                  <p className="font-semibold text-slate-800">{trip.trip_reference}</p>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-xs font-bold">D</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500">Départ</p>
                      <p className="text-sm font-medium text-slate-800 truncate">{trip.departure_site}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-xs font-bold">A</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500">Arrivée</p>
                      <p className="text-sm font-medium text-slate-800 truncate">{trip.arrival_site}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100">
                  {trip.driver_name && (
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs text-slate-600 truncate">{trip.driver_name}</span>
                    </div>
                  )}
                  {trip.fuel_level !== undefined && (
                    <div className="flex items-center gap-2">
                      <Fuel className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs text-slate-600">{trip.fuel_level.toFixed(0)}%</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 text-xs text-slate-400 mt-2">
                  <Clock className="w-3 h-3" />
                  <span>MAJ: {new Date(trip.last_update).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })}</span>
                </div>
              </button>

              {selectedTripId === trip.trip_id && (
                <div className="px-4 pb-4">
                  <button
                    onClick={() => handleOpenDetailModal(trip.trip_id)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    <Maximize2 className="w-4 h-4" />
                    Voir détails complets
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Map View */}
      <div className="flex-1 relative">
        <MapContainer
          center={center}
          zoom={11}
          ref={mapRef}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Geofence Zones */}
          {showGeofenceZones && geofenceZones.map((zone) => {
            if (zone.center_lat && zone.center_lng && zone.radius_meters) {
              return (
                <Circle
                  key={zone.id}
                  center={[zone.center_lat, zone.center_lng]}
                  radius={zone.radius_meters}
                  pathOptions={{
                    color: zone.color || '#3B82F6',
                    fillColor: zone.color || '#3B82F6',
                    fillOpacity: 0.15,
                    weight: 3,
                    opacity: 0.6,
                  }}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-bold text-blue-700">{zone.name}</p>
                      <p className="text-xs text-slate-600">Rayon: {(zone.radius_meters / 1000).toFixed(1)} km</p>
                    </div>
                  </Popup>
                </Circle>
              );
            }
            return null;
          })}

          {filteredTrips.map((trip) => {
            const isSelected = trip.trip_id === selectedTripId;
            const routePositions = trip.waypoints.map(w => [w.latitude, w.longitude] as [number, number]);
            const departureWaypoint = trip.waypoints[0];
            const arrivalWaypoint = trip.waypoints[trip.waypoints.length - 1];

            return (
              <div key={trip.trip_id}>
                {showPlannedRoute && routePositions.length > 1 && (
                  <Polyline
                    positions={routePositions}
                    pathOptions={{
                      color: isSelected ? '#F59E0B' : '#CBD5E1',
                      weight: isSelected ? 4 : 2,
                      opacity: isSelected ? 0.8 : 0.4,
                      dashArray: '10, 10',
                    }}
                  />
                )}

                {departureWaypoint && (
                  <Marker
                    position={[departureWaypoint.latitude, departureWaypoint.longitude]}
                    icon={getDepartureIcon(trip.departure_site)}
                  >
                    <Popup>
                      <div className="text-sm">
                        <p className="font-bold text-green-700">Point de départ</p>
                        <p className="text-slate-600">{trip.departure_site}</p>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {arrivalWaypoint && (
                  <Marker
                    position={[arrivalWaypoint.latitude, arrivalWaypoint.longitude]}
                    icon={getArrivalIcon(trip.arrival_site)}
                  >
                    <Popup>
                      <div className="text-sm">
                        <p className="font-bold text-red-700">Point d'arrivée</p>
                        <p className="text-slate-600">{trip.arrival_site}</p>
                      </div>
                    </Popup>
                  </Marker>
                )}

                <Marker
                  position={[trip.current_latitude, trip.current_longitude]}
                  icon={getCurrentPositionIcon(trip.vehicle_registration, trip.current_speed)}
                  eventHandlers={{
                    click: () => setSelectedTripId(trip.trip_id),
                  }}
                >
                  <Popup>
                    <div className="text-sm space-y-2 min-w-[200px]">
                      <div className="border-b border-slate-200 pb-2">
                        <p className="font-bold text-slate-900 text-base">{trip.vehicle_registration}</p>
                        <p className="text-xs text-slate-500">{trip.vehicle_brand}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-slate-500">Vitesse</p>
                          <p className="font-semibold text-slate-900">{trip.current_speed.toFixed(0)} km/h</p>
                        </div>
                        {trip.fuel_level && (
                          <div>
                            <p className="text-xs text-slate-500">Carburant</p>
                            <p className="font-semibold text-slate-900">{trip.fuel_level.toFixed(0)}%</p>
                          </div>
                        )}
                      </div>

                      {trip.driver_name && (
                        <div className="pt-2 border-t border-slate-200">
                          <p className="text-xs text-slate-500">Chauffeur</p>
                          <p className="font-medium text-slate-800">{trip.driver_name}</p>
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-200">
                        <p className="text-xs text-slate-500">Mission</p>
                        <p className="font-medium text-slate-800">{trip.trip_reference}</p>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              </div>
            );
          })}
        </MapContainer>

        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-xl p-4 z-[1000] min-w-[240px]">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-200">
            <MapIcon className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-slate-900">Contrôles carte</span>
          </div>

          <label className="flex items-center gap-3 cursor-pointer group mb-3">
            <input
              type="checkbox"
              checked={showPlannedRoute}
              onChange={(e) => setShowPlannedRoute(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700 group-hover:text-slate-900 font-medium">
              Afficher trajets planifiés
            </span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={showGeofenceZones}
              onChange={(e) => setShowGeofenceZones(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700 group-hover:text-slate-900 font-medium">
              Afficher zones géofencing
            </span>
          </label>

          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-500 mb-2">Missions actives</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-blue-600">{activeTrips.length}</span>
              <span className="text-sm text-slate-600">en cours</span>
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-xl p-4 z-[1000] max-w-[300px]">
          <div className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            Légende
          </div>
          <div className="space-y-3 text-xs">
            <div className="space-y-2 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 bg-green-500 rounded-full border-3 border-white shadow-md flex items-center justify-center text-white font-bold text-sm">
                  D
                </div>
                <span className="text-slate-700 font-medium">Point de départ</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 bg-blue-500 rounded-full border-3 border-white shadow-md relative">
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-b-7 border-b-white"></div>
                </div>
                <span className="text-slate-700 font-bold">Position actuelle GPS</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 bg-red-500 rounded-full border-3 border-white shadow-md flex items-center justify-center text-white font-bold text-sm">
                  A
                </div>
                <span className="text-slate-700 font-medium">Point d'arrivée</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-1 bg-blue-500 rounded"></div>
                <span className="text-slate-600">En mouvement</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-1 bg-orange-500 rounded"></div>
                <span className="text-slate-600">Arrêté</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-1 border-t-2 border-dashed border-slate-400"></div>
                <span className="text-slate-600">Trajet planifié</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal - GRAND */}
      {showDetailModal && selectedTrip && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <Truck className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{selectedTrip.vehicle_registration}</h2>
                  <p className="text-blue-100 text-sm">{selectedTrip.vehicle_brand}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              <div className="grid grid-cols-3 gap-6 mb-6">
                {/* Real-time Stats */}
                <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <Gauge className="w-8 h-8 opacity-80" />
                    <Activity className="w-5 h-5 animate-pulse" />
                  </div>
                  <p className="text-sm opacity-90 mb-1">Vitesse actuelle</p>
                  <p className="text-4xl font-bold">{selectedTrip.current_speed.toFixed(0)}</p>
                  <p className="text-sm opacity-75">km/h</p>
                  <div className="mt-3 pt-3 border-t border-white/20">
                    <p className="text-xs opacity-75 font-semibold">
                      {selectedTrip.current_speed > 5 ? '🟢 En mouvement' : selectedTrip.current_speed > 0 ? '🟡 Ralenti' : '🔴 Arrêté'}
                    </p>
                  </div>
                </div>

                {selectedTrip.fuel_level !== undefined && (
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-6 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <Fuel className="w-8 h-8 opacity-80" />
                      <Droplet className="w-5 h-5" />
                    </div>
                    <p className="text-sm opacity-90 mb-1">Niveau carburant</p>
                    <p className="text-4xl font-bold">{selectedTrip.fuel_level.toFixed(0)}</p>
                    <p className="text-sm opacity-75">%</p>
                    <div className="mt-3">
                      <div className="w-full bg-white/20 rounded-full h-2">
                        <div
                          className="bg-white rounded-full h-2 transition-all"
                          style={{ width: `${selectedTrip.fuel_level}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <TrendingUp className="w-8 h-8 opacity-80" />
                    <Radio className="w-5 h-5" />
                  </div>
                  <p className="text-sm opacity-90 mb-1">Progression</p>
                  <p className="text-4xl font-bold">{calculateProgress(selectedTrip)}</p>
                  <p className="text-sm opacity-75">%</p>
                  <div className="mt-3">
                    <div className="w-full bg-white/20 rounded-full h-2">
                      <div
                        className="bg-white rounded-full h-2 transition-all"
                        style={{ width: `${calculateProgress(selectedTrip)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mission Info */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5 text-blue-600" />
                    Informations mission
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Référence</p>
                      <p className="font-bold text-slate-900 text-lg">{selectedTrip.trip_reference}</p>
                    </div>
                    {selectedTrip.shift_name && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Quart de travail</p>
                        <p className="font-medium text-slate-800">{selectedTrip.shift_name}</p>
                      </div>
                    )}
                    {selectedTrip.net_weight && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Poids transporté</p>
                        <p className="font-bold text-slate-900 text-xl">{selectedTrip.net_weight.toFixed(1)} T</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-purple-600" />
                    Chauffeur & Horaires
                  </h3>
                  <div className="space-y-3">
                    {selectedTrip.driver_name && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Chauffeur</p>
                        <p className="font-bold text-slate-900 text-lg">{selectedTrip.driver_name}</p>
                      </div>
                    )}
                    {selectedTrip.actual_departure_time && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Heure de départ
                        </p>
                        <p className="font-medium text-slate-800">
                          {new Date(selectedTrip.actual_departure_time).toLocaleString('fr-FR')}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Dernière position GPS
                      </p>
                      <p className="font-medium text-slate-800">
                        {new Date(selectedTrip.last_update).toLocaleString('fr-FR')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-green-600" />
                    Détails véhicule
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Immatriculation</p>
                      <p className="font-bold text-slate-900 text-lg">{selectedTrip.vehicle_registration}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Marque & Modèle</p>
                      <p className="font-medium text-slate-800">{selectedTrip.vehicle_brand}</p>
                    </div>
                    {selectedTrip.km_start && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Kilométrage départ</p>
                        <p className="font-medium text-slate-800">{selectedTrip.km_start.toLocaleString()} km</p>
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-200">
                      <p className="text-xs text-slate-500 mb-1">Status moteur</p>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${selectedTrip.current_speed > 0 ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                        <p className="font-semibold text-slate-900">
                          {selectedTrip.current_speed > 0 ? 'Moteur allumé' : 'Moteur éteint'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Navigation2 className="w-5 h-5 text-orange-600" />
                    Données de localisation
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Latitude</p>
                      <p className="font-mono text-sm text-slate-800">{selectedTrip.current_latitude.toFixed(6)}°</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Longitude</p>
                      <p className="font-mono text-sm text-slate-800">{selectedTrip.current_longitude.toFixed(6)}°</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Dernière mise à jour GPS
                      </p>
                      <p className="font-medium text-slate-800 text-sm">
                        {new Date(selectedTrip.last_update).toLocaleString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-slate-200">
                      <p className="text-xs text-slate-500 mb-1">Signal GPS</p>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-1 h-3 bg-green-500 rounded-sm"></div>
                          <div className="w-1 h-4 bg-green-500 rounded-sm"></div>
                          <div className="w-1 h-5 bg-green-500 rounded-sm"></div>
                          <div className="w-1 h-6 bg-green-500 rounded-sm"></div>
                        </div>
                        <p className="text-xs font-semibold text-green-600">Excellent</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Map with Route */}
              <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200">
                <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-4 border-b border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <MapIcon className="w-5 h-5 text-blue-600" />
                    Trajet en temps réel - Position exacte
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {selectedTrip.departure_site} → {selectedTrip.arrival_site}
                  </p>
                </div>
                <div className="h-[600px] relative">
                  <MapContainer
                    center={[selectedTrip.current_latitude, selectedTrip.current_longitude]}
                    zoom={12}
                    ref={detailMapRef}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={true}
                  >
                    <TileLayer
                      attribution='&copy; OpenStreetMap'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* Planned Route */}
                    {selectedTrip.waypoints.length > 1 && (
                      <Polyline
                        positions={selectedTrip.waypoints.map(w => [w.latitude, w.longitude])}
                        pathOptions={{
                          color: '#F59E0B',
                          weight: 4,
                          opacity: 0.7,
                          dashArray: '10, 10',
                        }}
                      />
                    )}

                    {/* Departure */}
                    {selectedTrip.waypoints[0] && (
                      <Marker
                        position={[selectedTrip.waypoints[0].latitude, selectedTrip.waypoints[0].longitude]}
                        icon={getDepartureIcon(selectedTrip.departure_site)}
                      />
                    )}

                    {/* Arrival */}
                    {selectedTrip.waypoints[selectedTrip.waypoints.length - 1] && (
                      <Marker
                        position={[
                          selectedTrip.waypoints[selectedTrip.waypoints.length - 1].latitude,
                          selectedTrip.waypoints[selectedTrip.waypoints.length - 1].longitude
                        ]}
                        icon={getArrivalIcon(selectedTrip.arrival_site)}
                      />
                    )}

                    {/* Current Position */}
                    <Marker
                      position={[selectedTrip.current_latitude, selectedTrip.current_longitude]}
                      icon={getCurrentPositionIcon(selectedTrip.vehicle_registration, selectedTrip.current_speed)}
                    />
                  </MapContainer>
                </div>

                {/* GPS Coordinates */}
                <div className="p-4 bg-slate-50 border-t border-slate-200">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Latitude</p>
                      <p className="font-mono font-semibold text-slate-900">{selectedTrip.current_latitude.toFixed(6)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Longitude</p>
                      <p className="font-mono font-semibold text-slate-900">{selectedTrip.current_longitude.toFixed(6)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Altitude</p>
                      <p className="font-mono font-semibold text-slate-900">N/A</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
