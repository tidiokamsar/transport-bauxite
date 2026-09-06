import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Search, Eye, Edit2, MapPin, Calendar, TrendingUp, Package, CheckCircle, Clock, Sunrise, Sun, Moon, BarChart3, Table, FileText } from 'lucide-react';
import { TripModal } from './TripModal';
import { exportToCSV, exportToPDF } from '../../lib/exports';

interface WorkShift {
  id: string;
  name: string;
  display_name: string;
  start_time: string;
  end_time: string;
  shift_order: number;
  color: string;
}

interface Trip {
  id: string;
  reference: string;
  planned_date: string;
  status: string;
  net_weight: number | null;
  estimated_distance_km: number | null;
  actual_departure_time: string | null;
  actual_arrival_time: string | null;
  trip_duration_minutes: number | null;
  material_type: string | null;
  shift_sequence: number | null;
  vehicle: { registration: string; brand_model: string } | null;
  driver: { name: string } | null;
  departure_site: { name: string } | null;
  arrival_site: { name: string } | null;
  client: { name: string } | null;
  shift: WorkShift | null;
}

interface ShiftStats {
  shift_id: string;
  shift_name: string;
  display_name: string;
  color: string;
  total_trips: number;
  completed_trips: number;
  in_progress_trips: number;
  total_weight: number;
  avg_duration_minutes: number;
}

export const TripsView = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [, setShiftStats] = useState<ShiftStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [shiftFilter, setShiftFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'table' | 'shifts'>('shifts');
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'create'>('view');

  useEffect(() => {
    fetchShifts();
    fetchTrips();
    fetchShiftStats();
  }, [dateFilter]);

  const fetchShifts = async () => {
    try {
      const { data, error } = await supabase
        .from('work_shifts')
        .select('*')
        .eq('is_active', true)
        .order('shift_order');

      if (error) throw error;
      setShifts(data || []);
    } catch (error) {
      console.error('Error fetching shifts:', error);
    }
  };

  const fetchTrips = async () => {
    try {
      const { data, error } = await supabase
        .from('trips')
        .select(`
          *,
          vehicle:vehicles(registration, brand_model),
          driver:drivers(name),
          departure_site:sites!trips_departure_site_id_fkey(name),
          arrival_site:sites!trips_arrival_site_id_fkey(name),
          client:clients(name),
          shift:work_shifts(id, name, display_name, start_time, end_time, shift_order, color)
        `)
        .gte('planned_date', dateFilter)
        .lte('planned_date', dateFilter)
        .order('planned_date', { ascending: false });

      if (error) throw error;
      setTrips(data || []);
    } catch (error) {
      console.error('Error fetching trips:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchShiftStats = async () => {
    try {
      const { data, error } = await supabase
        .from('shift_performance_stats')
        .select('*')
        .eq('date', dateFilter);

      if (error) throw error;
      setShiftStats(data || []);
    } catch (error) {
      console.error('Error fetching shift stats:', error);
    }
  };

  const filteredTrips = trips.filter((trip) => {
    const matchesSearch =
      trip.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trip.vehicle?.registration.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trip.driver?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || trip.status === statusFilter;
    const matchesShift = shiftFilter === 'all' || trip.shift?.id === shiftFilter;
    return matchesSearch && matchesStatus && matchesShift;
  });

  const getStatusColor = (status: string) => {
    const colors = {
      planned: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-orange-100 text-orange-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status as keyof typeof colors] || 'bg-slate-100 text-slate-800';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      planned: 'Planifié',
      in_progress: 'En cours',
      completed: 'Terminé',
      cancelled: 'Annulé',
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'planned':
        return Clock;
      case 'in_progress':
        return TrendingUp;
      case 'completed':
        return CheckCircle;
      default:
        return Package;
    }
  };

  const getShiftIcon = (shiftName: string) => {
    switch (shiftName) {
      case 'morning':
        return Sunrise;
      case 'afternoon':
        return Sun;
      case 'night':
        return Moon;
      default:
        return Clock;
    }
  };

  const handleCreateNew = () => {
    setSelectedTrip(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleView = (trip: Trip) => {
    setSelectedTrip(trip);
    setModalMode('view');
    setIsModalOpen(true);
  };

  const handleEdit = (trip: Trip) => {
    setSelectedTrip(trip);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleModalClose = (saved: boolean) => {
    setIsModalOpen(false);
    setSelectedTrip(null);
    if (saved) {
      fetchTrips();
      fetchShiftStats();
    }
  };

  const handleExportCSV = () => {
    const formattedData = filteredTrips.map(t => ({
      'Référence': t.reference,
      'Date': new Date(t.planned_date).toLocaleDateString('fr-FR'),
      'Shift': t.shift?.display_name || '-',
      'Séquence': t.shift_sequence || '-',
      'Véhicule': t.vehicle?.registration || '-',
      'Chauffeur': t.driver?.name || '-',
      'Départ': t.departure_site?.name || '-',
      'Arrivée': t.arrival_site?.name || '-',
      'Client': t.client?.name || '-',
      'Poids (tonnes)': t.net_weight || 0,
      'Distance (km)': t.estimated_distance_km || 0,
      'Durée (min)': t.trip_duration_minutes || 0,
      'Matériau': t.material_type || '-',
      'Statut': t.status === 'planned' ? 'Planifié' : t.status === 'in_progress' ? 'En cours' : t.status === 'completed' ? 'Terminé' : 'Annulé',
      'Heure départ': t.actual_departure_time ? new Date(t.actual_departure_time).toLocaleTimeString('fr-FR') : '-',
      'Heure arrivée': t.actual_arrival_time ? new Date(t.actual_arrival_time).toLocaleTimeString('fr-FR') : '-'
    }));
    exportToCSV(formattedData, 'voyages');
  };

  const handleExportPDF = () => {
    const formattedData = filteredTrips.map(t => ({
      'Ref': t.reference,
      'Date': new Date(t.planned_date).toLocaleDateString('fr-FR'),
      'Shift': t.shift?.display_name || '-',
      'Seq': t.shift_sequence || '-',
      'Véhicule': t.vehicle?.registration || '-',
      'Chauffeur': t.driver?.name || '-',
      'Départ': t.departure_site?.name || '-',
      'Arrivée': t.arrival_site?.name || '-',
      'Poids (t)': t.net_weight || 0,
      'Statut': t.status === 'planned' ? 'Planifié' : t.status === 'in_progress' ? 'En cours' : t.status === 'completed' ? 'Terminé' : 'Annulé'
    }));
    exportToPDF('Liste des voyages', formattedData, 'voyages');
  };

  const totalTrips = filteredTrips.length;
  const plannedTrips = filteredTrips.filter(t => t.status === 'planned').length;
  const inProgressTrips = filteredTrips.filter(t => t.status === 'in_progress').length;
  const completedTrips = filteredTrips.filter(t => t.status === 'completed').length;
  const totalTonnage = filteredTrips
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + (t.net_weight || 0), 0);

  if (loading) {
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
          <h1 className="text-3xl font-bold text-slate-900">Voyages & Missions</h1>
          <p className="text-slate-600 mt-1">Gestion des quarts de travail et missions de transport</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              title="Exporter en CSV/Excel"
            >
              <Table className="w-5 h-5" />
              CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              title="Exporter en PDF"
            >
              <FileText className="w-5 h-5" />
              PDF
            </button>
          </div>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nouvelle mission
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-600" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('shifts')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  viewMode === 'shifts'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Clock className="w-4 h-4 inline mr-2" />
                Par Quarts
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  viewMode === 'table'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <BarChart3 className="w-4 h-4 inline mr-2" />
                Liste Complète
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total voyages</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{totalTrips}</p>
            </div>
            <MapPin className="w-8 h-8 text-slate-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Planifiés</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{plannedTrips}</p>
            </div>
            <Clock className="w-8 h-8 text-blue-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">En cours</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{inProgressTrips}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Terminés</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{completedTrips}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Tonnage total</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{totalTonnage.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-0.5">tonnes</p>
            </div>
            <Package className="w-8 h-8 text-slate-400" />
          </div>
        </div>
      </div>

      {viewMode === 'shifts' && (
        <div className="space-y-6">
          {shifts.map((shift) => {
            const ShiftIcon = getShiftIcon(shift.name);
            const shiftTrips = filteredTrips
              .filter(t => t.shift?.id === shift.id)
              .sort((a, b) => (a.shift_sequence || 0) - (b.shift_sequence || 0));

            return (
              <div key={shift.id} className="bg-white rounded-xl shadow-sm border-2 border-slate-200 overflow-hidden" style={{ borderTopColor: shift.color }}>
                <div className="p-6 border-b border-slate-200" style={{ background: `linear-gradient(135deg, ${shift.color}15, transparent)` }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl" style={{ backgroundColor: `${shift.color}20` }}>
                        <ShiftIcon className="w-8 h-8" style={{ color: shift.color }} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">{shift.display_name}</h3>
                        <p className="text-sm text-slate-600 mt-1">
                          {shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-6">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-slate-900">{shiftTrips.length}</p>
                        <p className="text-xs text-slate-500">Missions</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">
                          {shiftTrips.filter(t => t.status === 'completed').length}
                        </p>
                        <p className="text-xs text-slate-500">Terminées</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-slate-900">
                          {shiftTrips.filter(t => t.status === 'completed').reduce((sum, t) => sum + (t.net_weight || 0), 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-500">Tonnes</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {shiftTrips.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                      <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p>Aucune mission planifiée pour ce quart</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Séq</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Référence</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Véhicule</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Chauffeur</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Trajet</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Matériau</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Tonnage</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Durée</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Statut</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {shiftTrips.map((trip) => {
                          const StatusIcon = getStatusIcon(trip.status);
                          return (
                            <tr key={trip.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: `${shift.color}20`, color: shift.color }}>
                                  {trip.shift_sequence || '-'}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  onClick={() => handleView(trip)}
                                  className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                                  title="Voir les détails"
                                >
                                  {trip.reference}
                                </button>
                                {trip.client && (
                                  <div className="text-xs text-slate-500 mt-1">{trip.client.name}</div>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <div className="font-medium text-slate-900">
                                  {trip.vehicle?.registration || '-'}
                                </div>
                                {trip.vehicle?.brand_model && (
                                  <div className="text-sm text-slate-500">{trip.vehicle.brand_model}</div>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                                {trip.driver?.name || '-'}
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-sm">
                                  <div className="font-medium text-slate-900">{trip.departure_site?.name || '-'}</div>
                                  <div className="text-slate-500">→ {trip.arrival_site?.name || '-'}</div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded">
                                  {trip.material_type || 'minerai'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                {trip.net_weight ? (
                                  <span className="font-semibold text-slate-900">{trip.net_weight.toLocaleString()} T</span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                {trip.trip_duration_minutes ? (
                                  <span className="text-sm text-slate-700">{Math.round(trip.trip_duration_minutes)} min</span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(
                                    trip.status
                                  )}`}
                                >
                                  <StatusIcon className="w-3.5 h-3.5" />
                                  {getStatusLabel(trip.status)}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleView(trip)}
                                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                    title="Voir détails"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  {trip.status !== 'completed' && trip.status !== 'cancelled' && (
                                    <button
                                      onClick={() => handleEdit(trip)}
                                      className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                      title="Modifier"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'table' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher par référence, véhicule ou chauffeur..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>
              <select
                value={shiftFilter}
                onChange={(e) => setShiftFilter(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              >
                <option value="all">Tous les quarts</option>
                {shifts.map(shift => (
                  <option key={shift.id} value={shift.id}>{shift.display_name}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              >
                <option value="all">Tous les statuts</option>
                <option value="planned">Planifiés</option>
                <option value="in_progress">En cours</option>
                <option value="completed">Terminés</option>
                <option value="cancelled">Annulés</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Référence</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Quart</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Véhicule</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Chauffeur</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Trajet</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Tonnage</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Statut</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredTrips.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                      Aucun voyage trouvé
                    </td>
                  </tr>
                ) : (
                  filteredTrips.map((trip) => {
                    const StatusIcon = getStatusIcon(trip.status);
                    const ShiftIcon = trip.shift ? getShiftIcon(trip.shift.name) : Clock;
                    return (
                      <tr key={trip.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleView(trip)}
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                            title="Voir les détails"
                          >
                            {trip.reference}
                          </button>
                          {trip.client && (
                            <div className="text-xs text-slate-500 mt-1">{trip.client.name}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {trip.shift && (
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded" style={{ backgroundColor: `${trip.shift.color}20` }}>
                                <ShiftIcon className="w-4 h-4" style={{ color: trip.shift.color }} />
                              </div>
                              <div>
                                <div className="text-sm font-medium text-slate-900">{trip.shift.display_name}</div>
                                <div className="text-xs text-slate-500">{trip.shift.start_time.substring(0, 5)}</div>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900">
                            {trip.vehicle?.registration || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                          {trip.driver?.name || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <div className="font-medium text-slate-900">{trip.departure_site?.name || '-'}</div>
                            <div className="text-slate-500">→ {trip.arrival_site?.name || '-'}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {trip.net_weight ? (
                            <span className="font-semibold text-slate-900">{trip.net_weight.toLocaleString()} T</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(
                              trip.status
                            )}`}
                          >
                            <StatusIcon className="w-3.5 h-3.5" />
                            {getStatusLabel(trip.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleView(trip)}
                              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Voir détails"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {trip.status !== 'completed' && trip.status !== 'cancelled' && (
                              <button
                                onClick={() => handleEdit(trip)}
                                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Modifier"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <TripModal trip={selectedTrip} mode={modalMode} onClose={handleModalClose} />
      )}
    </div>
  );
};
