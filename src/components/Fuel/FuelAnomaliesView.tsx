import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { MapPin, TrendingUp, Eye, CheckCircle, Clock } from 'lucide-react';

interface Anomaly {
  id: string;
  vehicleReg: string;
  driverName: string;
  anomalyType: string;
  severity: string;
  expectedValue: number;
  actualValue: number;
  variance: number;
  variancePercentage: number;
  description: string;
  detectionMethod: string;
  confidenceScore: number;
  location: string;
  status: string;
  estimatedLoss: number;
  detectionDate: string;
}

export const FuelAnomaliesView = () => {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'investigating' | 'resolved'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');

  const fetchAnomalies = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('fuel_anomalies')
      .select(`
        *,
        vehicles!inner(registration),
        drivers!inner(first_name, last_name)
      `)
      .order('detection_date', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    if (severityFilter !== 'all') {
      query = query.eq('severity', severityFilter);
    }

    const { data } = await query;

    if (data) {
      setAnomalies(data.map(a => ({
        id: a.id,
        vehicleReg: a.vehicles?.registration || 'N/A',
        driverName: `${a.drivers?.first_name || ''} ${a.drivers?.last_name || ''}`.trim() || 'N/A',
        anomalyType: a.anomaly_type,
        severity: a.severity,
        expectedValue: a.expected_value,
        actualValue: a.actual_value,
        variance: a.variance,
        variancePercentage: a.variance_percentage,
        description: a.description,
        detectionMethod: a.detection_method,
        confidenceScore: a.confidence_score,
        location: a.location_name,
        status: a.status,
        estimatedLoss: a.estimated_loss,
        detectionDate: a.detection_date
      })));
    }

    setLoading(false);
  }, [filter, severityFilter]);

  useEffect(() => {
    fetchAnomalies();
  }, [fetchAnomalies]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'theft': return '🚨';
      case 'leak': return '💧';
      case 'overconsumption': return '📈';
      case 'unauthorized_station': return '🚫';
      default: return '⚠️';
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('fr-GN', { style: 'currency', currency: 'GNF', maximumFractionDigits: 0 }).format(val);

  const formatNumber = (val: number) =>
    new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(val);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Détection d'Anomalies IA</h2>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">Tous statuts</option>
            <option value="open">Ouvert</option>
            <option value="investigating">En investigation</option>
            <option value="resolved">Résolu</option>
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">Toutes sévérités</option>
            <option value="critical">Critique</option>
            <option value="high">Élevée</option>
            <option value="medium">Moyenne</option>
            <option value="low">Faible</option>
          </select>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <p className="text-sm text-red-600 font-medium">Critiques</p>
          <p className="text-2xl font-bold text-red-900">
            {anomalies.filter(a => a.severity === 'critical').length}
          </p>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
          <p className="text-sm text-orange-600 font-medium">Élevées</p>
          <p className="text-2xl font-bold text-orange-900">
            {anomalies.filter(a => a.severity === 'high').length}
          </p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <p className="text-sm text-green-600 font-medium">Résolues</p>
          <p className="text-2xl font-bold text-green-900">
            {anomalies.filter(a => a.status === 'resolved').length}
          </p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <p className="text-sm text-purple-600 font-medium">Perte Estimée</p>
          <p className="text-xl font-bold text-purple-900">
            {formatCurrency(anomalies.reduce((sum, a) => sum + a.estimatedLoss, 0))}
          </p>
        </div>
      </div>

      {/* Anomalies List */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Véhicule</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sévérité</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Écart</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Perte</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confiance IA</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lieu</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    Chargement...
                  </td>
                </tr>
              ) : anomalies.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                    <p className="text-gray-600">Aucune anomalie détectée</p>
                  </td>
                </tr>
              ) : (
                anomalies.map(anomaly => (
                  <tr key={anomaly.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          {getTypeIcon(anomaly.anomalyType)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{anomaly.vehicleReg}</p>
                          <p className="text-xs text-gray-500">{anomaly.driverName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm text-gray-900 capitalize">{anomaly.anomalyType.replace('_', ' ')}</p>
                      <p className="text-xs text-gray-500">{anomaly.detectionMethod}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getSeverityColor(anomaly.severity)}`}>
                        {anomaly.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-4 h-4 text-red-500" />
                        <span className="text-sm font-medium text-red-600">
                          +{formatNumber(anomaly.variancePercentage)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{formatNumber(anomaly.variance)}L</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-medium text-red-600">{formatCurrency(anomaly.estimatedLoss)}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-purple-600 h-2 rounded-full"
                            style={{ width: `${anomaly.confidenceScore * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700">
                          {formatNumber(anomaly.confidenceScore * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700">{anomaly.location}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {anomaly.status === 'resolved' ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : anomaly.status === 'investigating' ? (
                          <Eye className="w-4 h-4 text-orange-600" />
                        ) : (
                          <Clock className="w-4 h-4 text-red-600" />
                        )}
                        <span className="text-sm capitalize">{anomaly.status}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
