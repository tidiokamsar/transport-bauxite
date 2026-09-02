import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../lib/supabase';
import {
  Calendar, Download, MapPin, TrendingUp, Clock, Navigation, Filter,
  Truck, User, Package, Route, Target
} from 'lucide-react';

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

interface Trip {
  id: string;
  reference: string;
  planned_date: string;
  actual_departure_time: string;
  actual_arrival_time: string;
  status: string;
  vehicle: { registration: string; id: string };
  driver: { name: string };
  departure_site?: { name: string };
  arrival_site?: { name: string };
  estimated_distance_km: number;
  gross_weight: number;
  net_weight: number;
  waypoints: Waypoint[];
}

interface GPSPoint {
  latitude: number;
  longitude: number;
  speed_kmh: number;
  timestamp: string;
}

export const RouteHistoryView = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [gpsPoints, setGpsPoints] = useState<GPSPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedVehicle, setSelectedVehicle] = useState('all');
  const [vehicles, setVehicles] = useState<any[]>([]);

  useEffect(() => {
    fetchVehicles();
    fetchTrips();
  }, []);

  useEffect(() => {
    if (selectedTrip) {
      fetchGPSPoints(selectedTrip.vehicle.id, selectedTrip.actual_departure_time, selectedTrip.actual_arrival_time);
    }
  }, [selectedTrip]);

  const fetchVehicles = async () => {
    const { data } = await supabase
      .from('vehicles')
      .select('id, registration')
      .eq('gps_device_active', true)
      .order('registration');
    setVehicles(data || []);
  };

  const fetchTrips = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('trips')
        .select(`
          *,
          vehicle:vehicles!trips_vehicle_id_fkey(id, registration),
          driver:drivers!trips_driver_id_fkey(name),
          departure_site:sites!trips_departure_site_id_fkey(name),
          arrival_site:sites!trips_arrival_site_id_fkey(name)
        `)
        .in('status', ['completed', 'in_progress'])
        .order('planned_date', { ascending: false })
        .limit(50);

      const { data: tripsData, error } = await query;
      if (error) throw error;

      if (tripsData && tripsData.length > 0) {
        const tripsWithWaypoints = await Promise.all(
          tripsData.map(async (trip) => {
            const { data: waypointsData } = await supabase
              .from('trip_waypoints')
              .select('*')
              .eq('trip_id', trip.id)
              .order('sequence_number', { ascending: true });

            return {
              ...trip,
              waypoints: waypointsData?.map(w => ({
                id: w.id,
                sequence_number: w.sequence_number,
                waypoint_type: w.waypoint_type,
                location_name: w.location_name,
                latitude: parseFloat(w.latitude),
                longitude: parseFloat(w.longitude),
                actual_arrival_time: w.actual_arrival_time,
                departure_time: w.departure_time,
              })) || [],
            };
          })
        );

        setTrips(tripsWithWaypoints);
      }
    } catch (error) {
      console.error('Error fetching trips:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGPSPoints = async (vehicleId: string, startTime: string, endTime: string) => {
    try {
      // Try trip_route_tracking first (has full routes)
      const { data: routeData, error: routeError } = await supabase
        .from('trip_route_tracking')
        .select('current_latitude, current_longitude, speed_kmh, timestamp, trip_id')
        .eq('vehicle_id', vehicleId)
        .gte('timestamp', startTime)
        .lte('timestamp', endTime)
        .order('timestamp', { ascending: true });

      if (!routeError && routeData && routeData.length > 0) {
        setGpsPoints(routeData.map(p => ({
          latitude: parseFloat(p.current_latitude),
          longitude: parseFloat(p.current_longitude),
          speed_kmh: parseFloat(p.speed_kmh || 0),
          timestamp: p.timestamp,
        })));
        return;
      }

      // Fallback to vehicle_tracking
      const { data: trackingData } = await supabase
        .from('vehicle_tracking')
        .select('latitude, longitude, speed, timestamp')
        .eq('vehicle_id', vehicleId)
        .gte('timestamp', startTime)
        .lte('timestamp', endTime)
        .order('timestamp', { ascending: true });

      setGpsPoints(trackingData?.map(p => ({
        latitude: parseFloat(p.latitude),
        longitude: parseFloat(p.longitude),
        speed_kmh: p.speed || 0,
        timestamp: p.timestamp,
      })) || []);
    } catch (error) {
      console.error('Error fetching GPS points:', error);
      setGpsPoints([]);
    }
  };

  const calculateTripStats = () => {
    if (!selectedTrip) return null;

    const distance = selectedTrip.estimated_distance_km || 0;
    let duration = 0;

    if (selectedTrip.actual_departure_time && selectedTrip.actual_arrival_time) {
      duration = (new Date(selectedTrip.actual_arrival_time).getTime() -
        new Date(selectedTrip.actual_departure_time).getTime()) / (1000 * 60);
    } else if (selectedTrip.actual_departure_time) {
      duration = (new Date().getTime() - new Date(selectedTrip.actual_departure_time).getTime()) / (1000 * 60);
    }

    const avgSpeed = gpsPoints.length > 0
      ? gpsPoints.reduce((sum, p) => sum + p.speed_kmh, 0) / gpsPoints.length
      : 0;
    const maxSpeed = gpsPoints.length > 0 ? Math.max(...gpsPoints.map((p) => p.speed_kmh)) : 0;

    return { distance, duration, avgSpeed, maxSpeed };
  };

  const stats = calculateTripStats();

  const completedTrips = trips.filter(t => t.status === 'completed');
  const totalDistance = trips.reduce((sum, t) => sum + (t.estimated_distance_km || 0), 0);

  const totalDuration = trips.reduce((sum, t) => {
    if (t.actual_departure_time && t.actual_arrival_time) {
      return sum + (new Date(t.actual_arrival_time).getTime() -
        new Date(t.actual_departure_time).getTime()) / (1000 * 60);
    }
    return sum;
  }, 0);

  const totalGPSPoints = gpsPoints.length;

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
          <h1 className="text-3xl font-bold text-slate-900">Historique des Trajets</h1>
          <p className="text-slate-600 mt-1">Analyse et replay des itinéraires parcourus</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Download className="w-5 h-5" />
          Exporter données
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Date début</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Date fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Véhicule</label>
            <select
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            >
              <option value="all">Tous les véhicules</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.registration}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchTrips}
              className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 flex items-center justify-center gap-2"
            >
              <Filter className="w-5 h-5" />
              Filtrer
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-blue-600 text-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center gap-4">
            <Navigation className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-sm opacity-90">Total trajets</p>
              <p className="text-3xl font-bold">{trips.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-green-600 text-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center gap-4">
            <TrendingUp className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-sm opacity-90">Distance totale</p>
              <p className="text-3xl font-bold">{Math.round(totalDistance)}</p>
              <p className="text-xs opacity-75">kilomètres</p>
            </div>
          </div>
        </div>

        <div className="bg-orange-600 text-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center gap-4">
            <Clock className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-sm opacity-90">Temps total</p>
              <p className="text-3xl font-bold">{Math.round(totalDuration)}</p>
              <p className="text-xs opacity-75">minutes</p>
            </div>
          </div>
        </div>

        <div className="bg-purple-600 text-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center gap-4">
            <MapPin className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-sm opacity-90">Points GPS</p>
              <p className="text-3xl font-bold">{totalGPSPoints}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h2 className="text-lg font-bold text-slate-900">
              Trajets récents ({trips.length})
            </h2>
          </div>
          <div className="overflow-y-auto max-h-[700px]">
            {trips.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Navigation className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Aucun trajet trouvé</p>
              </div>
            ) : (
              trips.map((trip) => (
                <div
                  key={trip.id}
                  onClick={() => setSelectedTrip(trip)}
                  className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${
                    selectedTrip?.id === trip.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-slate-900">{trip.reference}</div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      trip.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {trip.status === 'completed' ? 'Terminé' : 'En cours'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                    <Truck className="w-4 h-4" />
                    <span>{trip.vehicle.registration}</span>
                    <span>•</span>
                    <User className="w-4 h-4" />
                    <span>{trip.driver.name}</span>
                  </div>
                  <div className="text-xs text-slate-500 mb-2">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    {new Date(trip.planned_date).toLocaleDateString('fr-FR')}
                  </div>
                  {trip.waypoints.length > 0 && (
                    <div className="text-xs text-slate-600 flex items-center gap-2 mb-2">
                      <Route className="w-3 h-3" />
                      <span>{trip.waypoints[0]?.location_name}</span>
                      <span>→</span>
                      <span>{trip.waypoints[trip.waypoints.length - 1]?.location_name}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-blue-600">
                      <Target className="w-3 h-3 inline mr-1" />
                      {(trip.estimated_distance_km || 0).toFixed(1)} km
                    </div>
                    {trip.gross_weight && (
                      <div className="text-xs font-medium text-purple-600">
                        <Package className="w-3 h-3 inline mr-1" />
                        {(trip.gross_weight / 1000).toFixed(1)} T
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {selectedTrip ? (
            <>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                  <h3 className="text-lg font-bold text-slate-900">
                    Itinéraire: {selectedTrip.reference}
                  </h3>
                </div>
                <div className="h-[500px]">
                  <MapContainer
                    center={selectedTrip.waypoints.length > 0
                      ? [selectedTrip.waypoints[0].latitude, selectedTrip.waypoints[0].longitude]
                      : [11.0967, -13.7761]}
                    zoom={10}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                    {/* GPS Trail */}
                    {gpsPoints.length > 1 && (
                      <Polyline
                        positions={gpsPoints.map((p) => [p.latitude, p.longitude])}
                        pathOptions={{
                          color: '#60a5fa',
                          weight: 3,
                          opacity: 0.6,
                        }}
                      />
                    )}

                    {/* Planned Route */}
                    {selectedTrip.waypoints.length > 1 && (
                      <Polyline
                        positions={selectedTrip.waypoints.map(w => [w.latitude, w.longitude])}
                        pathOptions={{
                          color: '#f59e0b',
                          weight: 4,
                          opacity: 0.8,
                          dashArray: '10, 10',
                        }}
                      />
                    )}

                    {/* Waypoint Markers */}
                    {selectedTrip.waypoints.map((waypoint) => {
                      const getColor = () => {
                        if (waypoint.waypoint_type === 'departure') return '#10b981';
                        if (waypoint.waypoint_type === 'arrival') return '#ef4444';
                        return '#f59e0b';
                      };

                      return (
                        <Marker
                          key={waypoint.id}
                          position={[waypoint.latitude, waypoint.longitude]}
                          icon={L.divIcon({
                            html: `
                              <div style="
                                background: ${getColor()};
                                width: 16px;
                                height: 16px;
                                border-radius: 50%;
                                border: 3px solid white;
                                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                              "></div>
                              <div style="
                                position: absolute;
                                top: 20px;
                                left: -40px;
                                background: white;
                                padding: 2px 6px;
                                border-radius: 4px;
                                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                                font-size: 10px;
                                font-weight: bold;
                                white-space: nowrap;
                              ">${waypoint.location_name}</div>
                            `,
                            className: '',
                            iconSize: [16, 16],
                          })}
                        />
                      );
                    })}
                  </MapContainer>
                </div>
              </div>

              {/* Trip Details */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Détails du Trajet</h3>

                {stats && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-xs text-blue-600 mb-1">Distance</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {stats.distance.toFixed(1)}
                      </div>
                      <div className="text-xs text-blue-600">km</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-xs text-green-600 mb-1">Durée</div>
                      <div className="text-2xl font-bold text-green-900">
                        {Math.round(stats.duration)}
                      </div>
                      <div className="text-xs text-green-600">minutes</div>
                    </div>
                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                      <div className="text-xs text-orange-600 mb-1">Vitesse moy.</div>
                      <div className="text-2xl font-bold text-orange-900">
                        {stats.avgSpeed.toFixed(1)}
                      </div>
                      <div className="text-xs text-orange-600">km/h</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <div className="text-xs text-purple-600 mb-1">Vitesse max</div>
                      <div className="text-2xl font-bold text-purple-900">
                        {stats.maxSpeed.toFixed(1)}
                      </div>
                      <div className="text-xs text-purple-600">km/h</div>
                    </div>
                  </div>
                )}

                {/* Waypoints List */}
                {selectedTrip.waypoints.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-3">Points de Passage</h4>
                    <div className="space-y-2">
                      {selectedTrip.waypoints.map((waypoint, idx) => (
                        <div key={waypoint.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                            waypoint.waypoint_type === 'departure' ? 'bg-green-500' :
                            waypoint.waypoint_type === 'arrival' ? 'bg-red-500' : 'bg-orange-500'
                          }`}>
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-slate-900">{waypoint.location_name}</div>
                            <div className="text-xs text-slate-600">
                              {waypoint.latitude.toFixed(4)}°N, {Math.abs(waypoint.longitude).toFixed(4)}°W
                            </div>
                            {waypoint.actual_arrival_time && (
                              <div className="text-xs text-green-600 mt-1">
                                ✓ Passé le {new Date(waypoint.actual_arrival_time).toLocaleString('fr-FR')}
                              </div>
                            )}
                          </div>
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
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
            </>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <MapPin className="w-16 h-16 mx-auto mb-4 text-slate-400" />
              <h3 className="text-xl font-semibold text-slate-700 mb-2">
                Sélectionnez un trajet
              </h3>
              <p className="text-slate-500">Choisissez un trajet dans la liste pour voir son itinéraire complet avec tous les points de passage</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
