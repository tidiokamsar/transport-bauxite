import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  AlertTriangle, MapPin, Clock, User, FileText, CheckCircle,
  XCircle, Filter, Download, Plus, Search, TrendingUp, Calendar
} from 'lucide-react';
import { buttonStyles, statusColors, cardStyles } from '../../styles/theme';
import { IncidentModal } from './IncidentModal';

interface Incident {
  id: string;
  vehicle_id: string;
  vehicle_registration: string;
  driver_id?: string;
  driver_name?: string;
  incident_type: string;
  severity: string;
  date_time: string;
  location: string;
  latitude?: number;
  longitude?: number;
  description: string;
  damage_cost?: number;
  injured_count?: number;
  status: string;
  resolved_date?: string;
  insurance_claim_number?: string;
  photos?: string[];
}

export const IncidentsView = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('incidents')
        .select(`
          *,
          vehicles(registration),
          drivers(name)
        `)
        .order('date_time', { ascending: false })
        .limit(100);

      if (error) throw error;

      const formattedIncidents: Incident[] = (data || []).map((incident: any) => ({
        id: incident.id,
        vehicle_id: incident.vehicle_id,
        vehicle_registration: incident.vehicles?.registration || 'N/A',
        driver_id: incident.driver_id,
        driver_name: incident.drivers?.name,
        incident_type: incident.incident_type,
        severity: incident.severity,
        date_time: incident.date_time,
        location: incident.location,
        latitude: incident.latitude,
        longitude: incident.longitude,
        description: incident.description,
        damage_cost: incident.damage_cost,
        injured_count: incident.injured_count,
        status: incident.status,
        resolved_date: incident.resolved_date,
        insurance_claim_number: incident.insurance_claim_number,
        photos: incident.photos
      }));

      setIncidents(formattedIncidents);
    } catch (error) {
      console.error('Error fetching incidents:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIncidentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      accident: 'Accident',
      breakdown: 'Panne',
      theft: 'Vol',
      vandalism: 'Vandalisme',
      damage: 'Dommage',
      other: 'Autre'
    };
    return labels[type] || type;
  };

  const getSeverityBadge = (severity: string) => {
    const badges: Record<string, { style: string; label: string }> = {
      critical: { style: 'bg-red-600 text-white', label: 'Critique' },
      high: { style: 'bg-orange-600 text-white', label: 'Élevée' },
      medium: { style: 'bg-yellow-500 text-white', label: 'Moyenne' },
      low: { style: 'bg-green-600 text-white', label: 'Faible' }
    };
    return badges[severity] || badges.medium;
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { icon: any; label: string }> = {
      open: { icon: AlertTriangle, label: 'Ouvert' },
      investigating: { icon: Clock, label: 'En cours' },
      resolved: { icon: CheckCircle, label: 'Résolu' },
      closed: { icon: XCircle, label: 'Fermé' }
    };
    return badges[status] || badges.open;
  };

  const filteredIncidents = incidents.filter(incident => {
    if (filterSeverity !== 'all' && incident.severity !== filterSeverity) return false;
    if (filterStatus !== 'all' && incident.status !== filterStatus) return false;
    if (searchTerm && !incident.vehicle_registration.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !incident.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: incidents.length,
    open: incidents.filter(i => i.status === 'open' || i.status === 'investigating').length,
    resolved: incidents.filter(i => i.status === 'resolved' || i.status === 'closed').length,
    totalCost: incidents.reduce((sum, i) => sum + (i.damage_cost || 0), 0),
    critical: incidents.filter(i => i.severity === 'critical').length
  };

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
          <h1 className="text-3xl font-bold text-gray-900">Gestion des Incidents</h1>
          <p className="text-gray-600">Suivi et résolution des incidents de la flotte</p>
        </div>
        <div className="flex items-center gap-3">
          <button className={buttonStyles.secondary}>
            <Download className="w-5 h-5 inline mr-2" />
            Exporter
          </button>
          <button
            onClick={() => {
              setSelectedIncident(null);
              setShowModal(true);
            }}
            className={buttonStyles.primary}
          >
            <Plus className="w-5 h-5 inline mr-2" />
            Déclarer incident
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total incidents</p>
              <p className="text-4xl font-bold mt-2">{stats.total}</p>
            </div>
            <FileText className="w-12 h-12 opacity-80" />
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
              <p className="text-orange-100 text-sm font-medium">En cours</p>
              <p className="text-4xl font-bold mt-2">{stats.open}</p>
            </div>
            <Clock className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Résolus</p>
              <p className="text-4xl font-bold mt-2">{stats.resolved}</p>
            </div>
            <CheckCircle className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Coût total</p>
              <p className="text-4xl font-bold mt-2">{(stats.totalCost / 1000000).toFixed(1)}M</p>
              <p className="text-purple-100 text-xs mt-1">GNF</p>
            </div>
            <TrendingUp className="w-12 h-12 opacity-80" />
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
                  placeholder="Rechercher par véhicule ou description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-600" />
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
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">Tous statuts</option>
                <option value="open">Ouvert</option>
                <option value="investigating">En cours</option>
                <option value="resolved">Résolu</option>
                <option value="closed">Fermé</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Véhicule</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Type</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Gravité</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Lieu</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Coût</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Statut</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Aucun incident trouvé</p>
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((incident) => {
                  const severityBadge = getSeverityBadge(incident.severity);
                  const statusBadge = getStatusBadge(incident.status);
                  const StatusIcon = statusBadge.icon;

                  return (
                    <tr key={incident.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {new Date(incident.date_time).toLocaleDateString('fr-FR')}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(incident.date_time).toLocaleTimeString('fr-FR')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{incident.vehicle_registration}</div>
                        {incident.driver_name && (
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {incident.driver_name}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {getIncidentTypeLabel(incident.incident_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${severityBadge.style}`}>
                          {severityBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <MapPin className="w-4 h-4" />
                          <span className="truncate max-w-[200px]">{incident.location}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {incident.damage_cost ? (
                          <span className="text-sm font-medium text-red-600">
                            {incident.damage_cost.toLocaleString()} GNF
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${statusColors[incident.status as keyof typeof statusColors]}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => {
                            setSelectedIncident(incident);
                            setShowModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                        >
                          Voir détails
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <IncidentModal
          incident={selectedIncident}
          onClose={() => {
            setShowModal(false);
            setSelectedIncident(null);
          }}
          onSave={() => {
            fetchIncidents();
            setShowModal(false);
            setSelectedIncident(null);
          }}
        />
      )}
    </div>
  );
};
