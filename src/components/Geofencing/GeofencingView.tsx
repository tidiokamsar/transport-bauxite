import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from 'react-leaflet';
import { supabase } from '../../lib/supabase';
import {
  Shield, AlertTriangle, MapPin, Plus, Edit2, Trash2, Eye,
  Download, Settings, CheckCircle, XCircle, AlertCircle, Navigation,
  Activity, Clock
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GeofenceZoneModal } from './GeofenceZoneModal';

interface GeofenceZone {
  id: string;
  name: string;
  description: string;
  zone_type: string;
  geometry_type: string;
  polygon_coordinates?: any;
  center_lat?: number;
  center_lng?: number;
  radius_meters?: number;
  color: string;
  is_active: boolean;
  priority: number;
  alert_on_entry: boolean;
  alert_on_exit: boolean;
  alert_on_dwell: boolean;
  max_dwell_minutes?: number;
  max_speed_kmh?: number;
  site_id?: string;
  created_at: string;
}

interface GeofenceViolation {
  id: string;
  zone_id: string;
  vehicle_id: string;
  driver_id?: string;
  violation_type: string;
  severity: string;
  entry_time?: string;
  exit_time?: string;
  duration_minutes?: number;
  latitude: number;
  longitude: number;
  speed_kmh?: number;
  description: string;
  status: string;
  created_at: string;
  zone?: GeofenceZone;
  vehicle?: any;
  driver?: any;
}

interface GeofenceAlert {
  id: string;
  violation_id: string;
  zone_id: string;
  vehicle_id: string;
  alert_type: string;
  priority: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

const MapUpdater = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
};

export default function GeofencingView() {
  const [zones, setZones] = useState<GeofenceZone[]>([]);
  const [violations, setViolations] = useState<GeofenceViolation[]>([]);
  const [alerts, setAlerts] = useState<GeofenceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'map' | 'zones' | 'violations' | 'alerts'>('map');
  const [selectedZone, setSelectedZone] = useState<GeofenceZone | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [mapCenter, setMapCenter] = useState<[number, number]>([11.0967, -13.7761]);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [editingZone, setEditingZone] = useState<GeofenceZone | null>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [zonesRes, violationsRes, alertsRes] = await Promise.all([
        supabase
          .from('geofence_zones')
          .select('*')
          .order('priority', { ascending: false }),
        supabase
          .from('geofence_violations')
          .select(`
            *,
            zone:geofence_zones(*),
            vehicle:vehicles(registration_number, model),
            driver:drivers(first_name, last_name)
          `)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('geofence_alerts')
          .select('*')
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .limit(20)
      ]);

      if (zonesRes.data) setZones(zonesRes.data);
      if (violationsRes.data) setViolations(violationsRes.data);
      if (alertsRes.data) setAlerts(alertsRes.data);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setLoading(false);
    }
  };

  const getZoneTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      mine: 'Mine',
      depot: 'Dépôt',
      route: 'Route',
      restricted: 'Zone Interdite',
      loading: 'Chargement',
      maintenance: 'Maintenance',
      parking: 'Parking',
      customs: 'Douane'
    };
    return types[type] || type;
  };

  const getViolationTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      unauthorized_entry: 'Entrée non autorisée',
      unauthorized_exit: 'Sortie non autorisée',
      overstay: 'Dépassement de temps',
      speeding: 'Excès de vitesse',
      restricted_hours: 'Horaires non autorisés'
    };
    return types[type] || type;
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      low: 'text-blue-600 bg-blue-50',
      medium: 'text-yellow-600 bg-yellow-50',
      high: 'text-orange-600 bg-orange-50',
      critical: 'text-red-600 bg-red-50'
    };
    return colors[severity] || 'text-gray-600 bg-gray-50';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: 'text-red-600 bg-red-50',
      acknowledged: 'text-yellow-600 bg-yellow-50',
      investigating: 'text-blue-600 bg-blue-50',
      resolved: 'text-green-600 bg-green-50',
      false_positive: 'text-gray-600 bg-gray-50'
    };
    return colors[status] || 'text-gray-600 bg-gray-50';
  };

  const stats = {
    totalZones: zones.length,
    activeZones: zones.filter(z => z.is_active).length,
    restrictedZones: zones.filter(z => z.zone_type === 'restricted').length,
    totalViolations: violations.length,
    openViolations: violations.filter(v => v.status === 'open').length,
    criticalViolations: violations.filter(v => v.severity === 'critical').length,
    unreadAlerts: alerts.length
  };

  const filteredZones = filterType === 'all'
    ? zones
    : zones.filter(z => z.zone_type === filterType);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du géofencing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Géofencing</h1>
          <p className="text-gray-600 mt-1">Surveillance et gestion des zones géographiques</p>
        </div>
        <button
          onClick={() => {
            setEditingZone(null);
            setShowZoneModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nouvelle Zone
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Zones Actives</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.activeZones}</p>
              <p className="text-xs text-gray-500 mt-1">sur {stats.totalZones} zones</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <MapPin className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Violations Ouvertes</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.openViolations}</p>
              <p className="text-xs text-gray-500 mt-1">sur {stats.totalViolations} total</p>
            </div>
            <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Alertes Critiques</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.criticalViolations}</p>
              <p className="text-xs text-red-600 mt-1">Action requise</p>
            </div>
            <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Zones Interdites</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.restrictedZones}</p>
              <p className="text-xs text-gray-500 mt-1">Haute sécurité</p>
            </div>
            <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex space-x-8 px-6">
            {[
              { id: 'map', label: 'Carte', icon: MapPin },
              { id: 'zones', label: 'Zones', icon: Shield },
              { id: 'violations', label: 'Violations', icon: AlertTriangle },
              { id: 'alerts', label: 'Alertes', icon: AlertCircle, badge: stats.unreadAlerts }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors relative ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'map' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">Toutes les zones</option>
                    <option value="mine">Mines</option>
                    <option value="depot">Dépôts</option>
                    <option value="route">Routes</option>
                    <option value="restricted">Zones Interdites</option>
                    <option value="loading">Chargement</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Exporter
                  </button>
                  <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Paramètres
                  </button>
                </div>
              </div>

              <div className="h-[600px] rounded-lg overflow-hidden border border-gray-200">
                <MapContainer
                  center={mapCenter}
                  zoom={11}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapUpdater center={mapCenter} />

                  {filteredZones.map((zone) => {
                    if (zone.geometry_type === 'circle' && zone.center_lat && zone.center_lng && zone.radius_meters) {
                      return (
                        <Circle
                          key={zone.id}
                          center={[zone.center_lat, zone.center_lng]}
                          radius={zone.radius_meters}
                          pathOptions={{
                            color: zone.color,
                            fillColor: zone.color,
                            fillOpacity: zone.zone_type === 'restricted' ? 0.4 : 0.2,
                            weight: 2
                          }}
                        >
                          <Popup>
                            <div className="p-2">
                              <h3 className="font-semibold text-gray-900">{zone.name}</h3>
                              <p className="text-sm text-gray-600 mt-1">{zone.description}</p>
                              <div className="mt-2 space-y-1 text-xs">
                                <p><span className="font-medium">Type:</span> {getZoneTypeLabel(zone.zone_type)}</p>
                                <p><span className="font-medium">Rayon:</span> {zone.radius_meters}m</p>
                                {zone.max_speed_kmh && (
                                  <p><span className="font-medium">Vitesse max:</span> {zone.max_speed_kmh} km/h</p>
                                )}
                                {zone.max_dwell_minutes && (
                                  <p><span className="font-medium">Temps max:</span> {zone.max_dwell_minutes} min</p>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  setSelectedZone(zone);
                                  if (zone.center_lat && zone.center_lng) {
                                    setMapCenter([zone.center_lat, zone.center_lng]);
                                  }
                                }}
                                className="mt-2 w-full bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                              >
                                Voir détails
                              </button>
                            </div>
                          </Popup>
                        </Circle>
                      );
                    }
                    return null;
                  })}

                  {violations.slice(0, 20).map((violation) => (
                    <Marker
                      key={violation.id}
                      position={[violation.latitude, violation.longitude]}
                      icon={L.divIcon({
                        className: 'custom-violation-marker',
                        html: `<div style="width: 24px; height: 24px; border-radius: 50%; background-color: ${
                          violation.severity === 'critical' ? '#DC2626' :
                          violation.severity === 'high' ? '#EA580C' :
                          violation.severity === 'medium' ? '#D97706' : '#2563EB'
                        }; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
                          <svg style="width: 16px; height: 16px; color: white;" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                          </svg>
                        </div>`,
                        iconSize: [24, 24]
                      })}
                    >
                      <Popup>
                        <div className="p-2">
                          <h3 className="font-semibold text-red-600">Violation</h3>
                          <p className="text-sm text-gray-900 mt-1">{violation.description}</p>
                          <div className="mt-2 space-y-1 text-xs">
                            <p><span className="font-medium">Véhicule:</span> {violation.vehicle?.registration_number}</p>
                            <p><span className="font-medium">Type:</span> {getViolationTypeLabel(violation.violation_type)}</p>
                            <p><span className="font-medium">Gravité:</span> {violation.severity}</p>
                            {violation.speed_kmh && (
                              <p><span className="font-medium">Vitesse:</span> {violation.speed_kmh} km/h</p>
                            )}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-green-500"></div>
                  <span className="text-sm text-gray-700">Zones autorisées</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-red-500"></div>
                  <span className="text-sm text-gray-700">Zones interdites</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                  <span className="text-sm text-gray-700">Zones de chargement</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                  <span className="text-sm text-gray-700">Dépôts</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'zones' && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zone</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Géométrie</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alertes</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredZones.map((zone) => (
                      <tr key={zone.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: zone.color }}></div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{zone.name}</div>
                              <div className="text-sm text-gray-500">{zone.description}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                            {getZoneTypeLabel(zone.zone_type)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {zone.geometry_type === 'circle' && zone.radius_meters && (
                            <span>Cercle - {zone.radius_meters}m</span>
                          )}
                          {zone.geometry_type === 'polygon' && (
                            <span>Polygone</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-xs">
                            {zone.alert_on_entry && <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">Entrée</span>}
                            {zone.alert_on_exit && <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded">Sortie</span>}
                            {zone.alert_on_dwell && <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded">Durée</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {zone.is_active ? (
                            <span className="flex items-center gap-1 text-green-600 text-sm">
                              <CheckCircle className="w-4 h-4" />
                              Actif
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-gray-400 text-sm">
                              <XCircle className="w-4 h-4" />
                              Inactif
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedZone(zone);
                                if (zone.center_lat && zone.center_lng) {
                                  setMapCenter([zone.center_lat, zone.center_lng]);
                                  setActiveTab('map');
                                }
                              }}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingZone(zone);
                                setShowZoneModal(true);
                              }}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm('Êtes-vous sûr de vouloir supprimer cette zone ?')) {
                                  await supabase.from('geofence_zones').delete().eq('id', zone.id);
                                  fetchData();
                                }
                              }}
                              className="text-red-600 hover:text-red-900"
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

          {activeTab === 'violations' && (
            <div className="space-y-4">
              {violations.map((violation) => (
                <div key={violation.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${getSeverityColor(violation.severity)}`}>
                          {violation.severity.toUpperCase()}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(violation.status)}`}>
                          {violation.status}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(violation.created_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <h3 className="text-sm font-medium text-gray-900 mt-2">{violation.description}</h3>
                      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Véhicule</p>
                          <p className="font-medium text-gray-900">{violation.vehicle?.registration_number || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Chauffeur</p>
                          <p className="font-medium text-gray-900">
                            {violation.driver ? `${violation.driver.first_name} ${violation.driver.last_name}` : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Zone</p>
                          <p className="font-medium text-gray-900">{violation.zone?.name || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Type</p>
                          <p className="font-medium text-gray-900">{getViolationTypeLabel(violation.violation_type)}</p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setMapCenter([violation.latitude, violation.longitude]);
                        setActiveTab('map');
                      }}
                      className="ml-4 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center gap-1"
                    >
                      <Navigation className="w-4 h-4" />
                      Carte
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'alerts' && (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <div key={alert.id} className="border-l-4 border-red-500 bg-red-50 p-4 rounded-r-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                          alert.priority === 'urgent' ? 'bg-red-600 text-white' :
                          alert.priority === 'high' ? 'bg-orange-600 text-white' :
                          alert.priority === 'medium' ? 'bg-yellow-600 text-white' :
                          'bg-blue-600 text-white'
                        }`}>
                          {alert.priority.toUpperCase()}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(alert.created_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-gray-900">{alert.message}</p>
                    </div>
                    <button className="ml-4 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                      Marquer comme lu
                    </button>
                  </div>
                </div>
              ))}
              {alerts.length === 0 && (
                <div className="text-center py-12">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <p className="text-gray-600">Aucune alerte non lue</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <GeofenceZoneModal
        isOpen={showZoneModal}
        onClose={() => {
          setShowZoneModal(false);
          setEditingZone(null);
        }}
        onSave={() => {
          fetchData();
          setShowZoneModal(false);
          setEditingZone(null);
        }}
        zone={editingZone}
      />
    </div>
  );
}