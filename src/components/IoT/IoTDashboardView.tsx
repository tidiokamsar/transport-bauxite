import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Radio, Droplet, MapPin, Activity, AlertTriangle,
  Battery, Signal, RefreshCw, Clock, TrendingUp
} from 'lucide-react';

export const IoTDashboardView = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [fuelReadings, setFuelReadings] = useState<any[]>([]);
  const [gpsReadings, setGpsReadings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchData();

    if (autoRefresh) {
      const interval = setInterval(fetchData, 30000); // 30 secondes
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [devicesRes, fuelRes, gpsRes] = await Promise.all([
        supabase.from('iot_devices').select('*').eq('status', 'active'),
        supabase.from('iot_fuel_readings').select('*, iot_devices(*)').order('reading_timestamp', { ascending: false }).limit(50),
        supabase.from('iot_gps_readings').select('*, iot_devices(*)').order('reading_timestamp', { ascending: false }).limit(50),
      ]);

      setDevices(devicesRes.data || []);
      setFuelReadings(fuelRes.data || []);
      setGpsReadings(gpsRes.data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDeviceStatus = (device: any) => {
    const lastUpdate = new Date(device.updated_at);
    const minutesAgo = (new Date().getTime() - lastUpdate.getTime()) / 60000;

    if (minutesAgo > 30) return { status: 'offline', color: 'red' };
    if (minutesAgo > 10) return { status: 'warning', color: 'orange' };
    return { status: 'online', color: 'green' };
  };

  const gpsDevices = devices.filter(d => d.device_type === 'gps_tracker');
  const fuelDevices = devices.filter(d => d.device_type === 'fuel_sensor');

  if (loading && devices.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Monitoring IoT</h1>
          <p className="text-slate-600 mt-1">Capteurs GPS et carburant en temps réel</p>
        </div>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium text-slate-700">Auto-refresh 30s</span>
          </label>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-blue-100">Dispositifs actifs</p>
            <Radio className="w-8 h-8 text-blue-300" />
          </div>
          <p className="text-3xl font-bold">{devices.length}</p>
          <p className="text-xs text-blue-200 mt-1">
            {gpsDevices.length} GPS + {fuelDevices.length} Fuel
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-green-100">GPS en ligne</p>
            <MapPin className="w-8 h-8 text-green-300" />
          </div>
          <p className="text-3xl font-bold">
            {gpsDevices.filter(d => getDeviceStatus(d).status === 'online').length}
          </p>
          <p className="text-xs text-green-200 mt-1">sur {gpsDevices.length} trackers</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-700 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-orange-100">Capteurs fuel</p>
            <Droplet className="w-8 h-8 text-orange-300" />
          </div>
          <p className="text-3xl font-bold">
            {fuelDevices.filter(d => getDeviceStatus(d).status === 'online').length}
          </p>
          <p className="text-xs text-orange-200 mt-1">sur {fuelDevices.length} capteurs</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-700 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-red-100">Alertes actives</p>
            <AlertTriangle className="w-8 h-8 text-red-300" />
          </div>
          <p className="text-3xl font-bold">
            {devices.filter(d => getDeviceStatus(d).status === 'offline').length}
          </p>
          <p className="text-xs text-red-200 mt-1">hors ligne</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            Trackers GPS
          </h3>
          <div className="space-y-3">
            {gpsDevices.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">Aucun tracker GPS configuré</p>
            ) : (
              gpsDevices.map((device) => {
                const status = getDeviceStatus(device);
                const latestGps = gpsReadings.find(r => r.device_id === device.device_id);

                return (
                  <div key={device.id} className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
                    <div className={`p-3 rounded-lg ${
                      status.color === 'green' ? 'bg-green-100' :
                      status.color === 'orange' ? 'bg-orange-100' :
                      'bg-red-100'
                    }`}>
                      <Signal className={`w-5 h-5 ${
                        status.color === 'green' ? 'text-green-600' :
                        status.color === 'orange' ? 'text-orange-600' :
                        'text-red-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-slate-900">{device.device_id}</p>
                          <p className="text-sm text-slate-600">{device.manufacturer} {device.model}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          status.color === 'green' ? 'bg-green-100 text-green-700' :
                          status.color === 'orange' ? 'bg-orange-100 text-orange-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {status.status}
                        </span>
                      </div>
                      {latestGps && (
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-slate-500">Position</p>
                            <p className="font-medium text-slate-900">
                              {latestGps.latitude.toFixed(5)}, {latestGps.longitude.toFixed(5)}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500">Vitesse</p>
                            <p className="font-medium text-slate-900">{latestGps.speed_kmh || 0} km/h</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Kilométrage</p>
                            <p className="font-medium text-slate-900">
                              {latestGps.odometer_km?.toLocaleString() || 'N/A'} km
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500">Dernière mise à jour</p>
                            <p className="font-medium text-slate-900">
                              {new Date(latestGps.reading_timestamp).toLocaleTimeString('fr-FR')}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Droplet className="w-5 h-5 text-orange-600" />
            Capteurs Carburant
          </h3>
          <div className="space-y-3">
            {fuelDevices.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">Aucun capteur carburant configuré</p>
            ) : (
              fuelDevices.map((device) => {
                const status = getDeviceStatus(device);
                const latestFuel = fuelReadings.find(r => r.device_id === device.device_id);

                return (
                  <div key={device.id} className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
                    <div className={`p-3 rounded-lg ${
                      status.color === 'green' ? 'bg-green-100' :
                      status.color === 'orange' ? 'bg-orange-100' :
                      'bg-red-100'
                    }`}>
                      <Activity className={`w-5 h-5 ${
                        status.color === 'green' ? 'text-green-600' :
                        status.color === 'orange' ? 'text-orange-600' :
                        'text-red-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-slate-900">{device.device_id}</p>
                          <p className="text-sm text-slate-600">{device.manufacturer} {device.model}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          status.color === 'green' ? 'bg-green-100 text-green-700' :
                          status.color === 'orange' ? 'bg-orange-100 text-orange-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {status.status}
                        </span>
                      </div>
                      {latestFuel && (
                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-slate-600">Niveau carburant</span>
                              <span className="font-semibold text-slate-900">
                                {latestFuel.fuel_level_percentage?.toFixed(1) || 0}%
                              </span>
                            </div>
                            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  (latestFuel.fuel_level_percentage || 0) > 50 ? 'bg-green-500' :
                                  (latestFuel.fuel_level_percentage || 0) > 20 ? 'bg-orange-500' :
                                  'bg-red-500'
                                }`}
                                style={{ width: `${latestFuel.fuel_level_percentage || 0}%` }}
                              ></div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-slate-500">Niveau</p>
                              <p className="font-medium text-slate-900">
                                {latestFuel.fuel_level_liters?.toFixed(1) || 0}L
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Capacité</p>
                              <p className="font-medium text-slate-900">
                                {latestFuel.tank_capacity_liters || 400}L
                              </p>
                            </div>
                          </div>
                          <div className="text-xs text-slate-500">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {new Date(latestFuel.reading_timestamp).toLocaleString('fr-FR')}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Système IoT opérationnel</h3>
            <p className="text-sm text-slate-700 mb-4">
              Les capteurs GPS et carburant envoient des données toutes les 30 secondes.
              Les données sont stockées et disponibles pour analyse en temps réel.
            </p>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-slate-700">Connexion active</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Battery className="w-4 h-4 text-slate-600" />
                <span className="text-slate-700">Batteries OK</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Signal className="w-4 h-4 text-slate-600" />
                <span className="text-slate-700">Signal GSM stable</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
