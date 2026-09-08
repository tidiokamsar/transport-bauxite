import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Bell, BellRing, AlertTriangle, Info, CheckCircle, Clock,
  Settings, Filter, Search, Trash2, Eye, EyeOff
} from 'lucide-react';
import { buttonStyles, cardStyles } from '../../styles/theme';

interface Alert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  vehicle_id?: string;
  vehicle_registration?: string;
  driver_id?: string;
  driver_name?: string;
  created_at: string;
  acknowledged: boolean;
  acknowledged_at?: string;
  acknowledged_by?: string;
  resolved: boolean;
  resolved_at?: string;
  metadata?: any;
}

export const AlertsView = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('unresolved');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);


  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('alerts')
        .select(`
          *,
          vehicles(registration),
          drivers(name)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (filterStatus === 'unresolved') {
        query = query.eq('resolved', false);
      } else if (filterStatus === 'resolved') {
        query = query.eq('resolved', true);
      }

      const { data, error } = await query;
      if (error) throw error;

      const formattedAlerts: Alert[] = (data || []).map((alert: any) => ({
        id: alert.id,
        alert_type: alert.alert_type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        vehicle_id: alert.vehicle_id,
        vehicle_registration: alert.vehicles?.registration,
        driver_id: alert.driver_id,
        driver_name: alert.drivers?.name,
        created_at: alert.created_at,
        acknowledged: alert.acknowledged || false,
        acknowledged_at: alert.acknowledged_at,
        acknowledged_by: alert.acknowledged_by,
        resolved: alert.resolved || false,
        resolved_at: alert.resolved_at,
        metadata: alert.metadata
      }));

      setAlerts(formattedAlerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchAlerts();

    if (autoRefresh) {
      const interval = setInterval(fetchAlerts, 15000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, fetchAlerts]);

  const handleAcknowledge = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({
          acknowledged: true,
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) throw error;
      fetchAlerts();
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  };

  const handleResolve = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) throw error;
      fetchAlerts();
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  };

  const handleDelete = async (alertId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette alerte ?')) return;

    try {
      const { error } = await supabase
        .from('alerts')
        .delete()
        .eq('id', alertId);

      if (error) throw error;
      fetchAlerts();
    } catch (error) {
      console.error('Error deleting alert:', error);
    }
  };

  const getAlertTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      maintenance_due: 'Maintenance à prévoir',
      fuel_low: 'Carburant faible',
      speeding: 'Excès de vitesse',
      geofence_breach: 'Sortie de zone',
      engine_warning: 'Alerte moteur',
      tire_pressure: 'Pression pneus',
      temperature: 'Température anormale',
      unauthorized_use: 'Utilisation non autorisée',
      accident: 'Accident',
      breakdown: 'Panne',
      theft: 'Vol',
      other: 'Autre'
    };
    return labels[type] || type;
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'medium':
        return <Bell className="w-5 h-5 text-yellow-600" />;
      case 'low':
        return <Info className="w-5 h-5 text-blue-600" />;
      default:
        return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const badges: Record<string, string> = {
      critical: 'bg-red-100 text-red-700 border-red-200',
      high: 'bg-orange-100 text-orange-700 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      low: 'bg-blue-100 text-blue-700 border-blue-200'
    };
    return badges[severity] || badges.low;
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filterSeverity !== 'all' && alert.severity !== filterSeverity) return false;
    if (filterType !== 'all' && alert.alert_type !== filterType) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!alert.title.toLowerCase().includes(search) &&
          !alert.message.toLowerCase().includes(search) &&
          !alert.vehicle_registration?.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  const stats = {
    total: alerts.length,
    critical: alerts.filter(a => a.severity === 'critical' && !a.resolved).length,
    unacknowledged: alerts.filter(a => !a.acknowledged && !a.resolved).length,
    unresolved: alerts.filter(a => !a.resolved).length,
    resolved: alerts.filter(a => a.resolved).length
  };

  const alertTypes = [...new Set(alerts.map(a => a.alert_type))];

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
          <h1 className="text-3xl font-bold text-gray-900">Centre d'Alertes</h1>
          <p className="text-gray-600">Surveillance et gestion des alertes en temps réel</p>
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
            <BellRing className={`w-5 h-5 ${autoRefresh ? 'animate-pulse' : ''}`} />
            {autoRefresh ? 'Actualisation auto' : 'Pause'}
          </button>
          <button className={buttonStyles.secondary}>
            <Settings className="w-5 h-5 inline mr-2" />
            Configurer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total</p>
              <p className="text-4xl font-bold mt-2">{stats.total}</p>
            </div>
            <Bell className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm font-medium">Critiques</p>
              <p className="text-4xl font-bold mt-2">{stats.critical}</p>
            </div>
            <AlertTriangle className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium">Non lues</p>
              <p className="text-4xl font-bold mt-2">{stats.unacknowledged}</p>
            </div>
            <EyeOff className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-100 text-sm font-medium">En cours</p>
              <p className="text-4xl font-bold mt-2">{stats.unresolved}</p>
            </div>
            <Clock className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Résolues</p>
              <p className="text-4xl font-bold mt-2">{stats.resolved}</p>
            </div>
            <CheckCircle className="w-12 h-12 opacity-80" />
          </div>
        </div>
      </div>

      <div className={cardStyles}>
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher une alerte..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-600" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">Toutes</option>
                <option value="unresolved">Non résolues</option>
                <option value="resolved">Résolues</option>
              </select>

              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">Toutes gravités</option>
                <option value="critical">Critique</option>
                <option value="high">Élevée</option>
                <option value="medium">Moyenne</option>
                <option value="low">Faible</option>
              </select>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">Tous types</option>
                {alertTypes.map(type => (
                  <option key={type} value={type}>
                    {getAlertTypeLabel(type)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {filteredAlerts.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucune alerte trouvée</p>
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-6 hover:bg-gray-50 transition-colors ${
                  !alert.acknowledged ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    {getSeverityIcon(alert.severity)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{alert.title}</h3>
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium border ${getSeverityBadge(alert.severity)}`}>
                            {alert.severity === 'critical' && 'Critique'}
                            {alert.severity === 'high' && 'Élevée'}
                            {alert.severity === 'medium' && 'Moyenne'}
                            {alert.severity === 'low' && 'Faible'}
                          </span>
                          {!alert.acknowledged && (
                            <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-orange-100 text-orange-700">
                              Non lue
                            </span>
                          )}
                          {alert.resolved && (
                            <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-green-100 text-green-700 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Résolue
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{alert.message}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(alert.created_at).toLocaleString('fr-FR')}
                          </span>
                          <span>{getAlertTypeLabel(alert.alert_type)}</span>
                          {alert.vehicle_registration && (
                            <span className="font-medium text-gray-700">
                              {alert.vehicle_registration}
                            </span>
                          )}
                          {alert.driver_name && (
                            <span className="text-gray-600">
                              Chauffeur: {alert.driver_name}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!alert.acknowledged && (
                          <button
                            onClick={() => handleAcknowledge(alert.id)}
                            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                            title="Marquer comme lue"
                          >
                            <Eye className="w-4 h-4 text-gray-600" />
                          </button>
                        )}
                        {!alert.resolved && (
                          <button
                            onClick={() => handleResolve(alert.id)}
                            className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                            title="Résoudre"
                          >
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(alert.id)}
                          className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
