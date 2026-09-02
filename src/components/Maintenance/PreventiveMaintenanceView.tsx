import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { MaintenanceScheduleModal } from './MaintenanceScheduleModal';
import {
  Calendar, Clock, AlertCircle, CheckCircle, Wrench, TrendingUp,
  Settings, Bell, BarChart3, Filter, Download, Plus, RefreshCw, Edit, Trash2
} from 'lucide-react';

interface MaintenanceSchedule {
  id: string;
  vehicle_id: string;
  vehicle_registration: string;
  maintenance_type: string;
  description: string;
  interval_type: string;
  interval_value: number;
  last_maintenance_km?: number;
  last_maintenance_date?: string;
  current_km: number;
  next_due_km: number;
  next_due_date: string;
  status: 'upcoming' | 'due' | 'overdue';
  priority: string;
  estimated_cost: number;
  estimated_duration_hours: number;
}

interface Vehicle {
  id: string;
  registration: string;
  current_km: number;
  last_service_date?: string;
}

export const PreventiveMaintenanceView = () => {
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | undefined>();

  useEffect(() => {
    fetchMaintenanceSchedules();
  }, []);

  const fetchMaintenanceSchedules = async () => {
    try {
      setLoading(true);

      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('id, registration, current_km')
        .eq('status', 'active');

      if (vehiclesError) throw vehiclesError;
      setVehicles(vehiclesData || []);

      const { data: schedulesData, error: schedulesError } = await supabase
        .from('maintenance_schedules')
        .select(`
          id,
          vehicle_id,
          maintenance_type,
          description,
          interval_km,
          interval_days,
          last_maintenance_km,
          last_maintenance_date,
          is_active,
          vehicles(registration, current_km)
        `)
        .eq('is_active', true);

      if (schedulesError) throw schedulesError;

      const processedSchedules: MaintenanceSchedule[] = (schedulesData || []).map((schedule: any) => {
        const currentKm = schedule.vehicles?.current_km || 0;
        const lastKm = schedule.last_maintenance_km || 0;
        const intervalKm = schedule.interval_km || 0;
        const nextDueKm = lastKm + intervalKm;
        const kmRemaining = nextDueKm - currentKm;

        const lastDate = schedule.last_maintenance_date
          ? new Date(schedule.last_maintenance_date)
          : new Date();
        const intervalDays = schedule.interval_days || 0;
        const nextDueDate = new Date(lastDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);
        const daysRemaining = Math.floor((nextDueDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

        let status: 'upcoming' | 'due' | 'overdue';
        if (kmRemaining <= 0 || daysRemaining <= 0) {
          status = 'overdue';
        } else if (kmRemaining <= intervalKm * 0.1 || daysRemaining <= 7) {
          status = 'due';
        } else {
          status = 'upcoming';
        }

        let priority = 'low';
        if (status === 'overdue') priority = 'high';
        else if (status === 'due') priority = 'medium';

        const estimatedCosts: Record<string, number> = {
          'oil_change': 15000,
          'filter_replacement': 8000,
          'tire_rotation': 5000,
          'brake_inspection': 12000,
          'full_service': 35000,
          'engine_service': 45000,
          'transmission_service': 40000,
          'coolant_replacement': 10000,
          'timing_belt': 60000,
          'suspension_check': 15000
        };

        const estimatedDurations: Record<string, number> = {
          'oil_change': 1,
          'filter_replacement': 0.5,
          'tire_rotation': 1,
          'brake_inspection': 2,
          'full_service': 4,
          'engine_service': 6,
          'transmission_service': 5,
          'coolant_replacement': 1.5,
          'timing_belt': 8,
          'suspension_check': 2
        };

        return {
          id: schedule.id,
          vehicle_id: schedule.vehicle_id,
          vehicle_registration: schedule.vehicles?.registration || 'N/A',
          maintenance_type: schedule.maintenance_type,
          description: schedule.description,
          interval_type: intervalKm > 0 ? 'km' : 'time',
          interval_value: intervalKm > 0 ? intervalKm : intervalDays,
          last_maintenance_km: schedule.last_maintenance_km,
          last_maintenance_date: schedule.last_maintenance_date,
          current_km: currentKm,
          next_due_km: nextDueKm,
          next_due_date: nextDueDate.toISOString(),
          status,
          priority,
          estimated_cost: estimatedCosts[schedule.maintenance_type] || 20000,
          estimated_duration_hours: estimatedDurations[schedule.maintenance_type] || 2
        };
      });

      processedSchedules.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority as keyof typeof priorityOrder] -
               priorityOrder[b.priority as keyof typeof priorityOrder];
      });

      setSchedules(processedSchedules);
    } catch (error) {
      console.error('Error fetching maintenance schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'overdue':
        return { style: 'bg-red-100 text-red-700', label: 'En retard', icon: AlertCircle };
      case 'due':
        return { style: 'bg-orange-100 text-orange-700', label: 'À faire', icon: Clock };
      case 'upcoming':
        return { style: 'bg-blue-100 text-blue-700', label: 'Planifié', icon: Calendar };
      default:
        return { style: 'bg-gray-100 text-gray-700', label: status, icon: Clock };
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return { style: 'bg-red-500', label: 'Urgent' };
      case 'medium':
        return { style: 'bg-orange-500', label: 'Moyen' };
      case 'low':
        return { style: 'bg-green-500', label: 'Normal' };
      default:
        return { style: 'bg-gray-500', label: priority };
    }
  };

  const getMaintenanceLabel = (type: string) => {
    const labels: Record<string, string> = {
      'oil_change': 'Vidange moteur',
      'filter_replacement': 'Remplacement filtres',
      'tire_rotation': 'Permutation pneus',
      'brake_inspection': 'Inspection freins',
      'full_service': 'Révision complète',
      'engine_service': 'Entretien moteur',
      'transmission_service': 'Entretien transmission',
      'coolant_replacement': 'Remplacement liquide refroidissement',
      'timing_belt': 'Courroie distribution',
      'suspension_check': 'Contrôle suspension'
    };
    return labels[type] || type;
  };

  const filteredSchedules = schedules.filter(s => {
    if (filterStatus !== 'all' && s.status !== filterStatus) return false;
    if (filterPriority !== 'all' && s.priority !== filterPriority) return false;
    return true;
  });

  const overdueCount = schedules.filter(s => s.status === 'overdue').length;
  const dueCount = schedules.filter(s => s.status === 'due').length;
  const upcomingCount = schedules.filter(s => s.status === 'upcoming').length;
  const totalEstimatedCost = filteredSchedules
    .filter(s => s.status !== 'upcoming')
    .reduce((sum, s) => sum + s.estimated_cost, 0);

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
          <h1 className="text-3xl font-bold text-gray-900">Maintenance Préventive</h1>
          <p className="text-gray-600">Planification automatique et suivi des entretiens</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchMaintenanceSchedules}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="w-5 h-5" />
            Actualiser
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            <Download className="w-5 h-5" />
            Exporter
          </button>
          <button
            onClick={() => {
              setSelectedScheduleId(undefined);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus className="w-5 h-5" />
            Nouveau planning
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-red-600 text-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center gap-4">
            <AlertCircle className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-sm opacity-90">En retard</p>
              <p className="text-3xl font-bold">{overdueCount}</p>
              <p className="text-xs opacity-75">maintenances urgentes</p>
            </div>
          </div>
        </div>

        <div className="bg-orange-600 text-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center gap-4">
            <Clock className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-sm opacity-90">À faire</p>
              <p className="text-3xl font-bold">{dueCount}</p>
              <p className="text-xs opacity-75">cette semaine</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-600 text-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center gap-4">
            <Calendar className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-sm opacity-90">Planifiés</p>
              <p className="text-3xl font-bold">{upcomingCount}</p>
              <p className="text-xs opacity-75">prochainement</p>
            </div>
          </div>
        </div>

        <div className="bg-green-600 text-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center gap-4">
            <TrendingUp className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-sm opacity-90">Coût estimé</p>
              <p className="text-3xl font-bold">{(totalEstimatedCost / 1000).toFixed(0)}k</p>
              <p className="text-xs opacity-75">GNF</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Statut:</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1 text-sm rounded ${
                  filterStatus === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Tous ({schedules.length})
              </button>
              <button
                onClick={() => setFilterStatus('overdue')}
                className={`px-3 py-1 text-sm rounded ${
                  filterStatus === 'overdue'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                En retard ({overdueCount})
              </button>
              <button
                onClick={() => setFilterStatus('due')}
                className={`px-3 py-1 text-sm rounded ${
                  filterStatus === 'due'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                À faire ({dueCount})
              </button>
              <button
                onClick={() => setFilterStatus('upcoming')}
                className={`px-3 py-1 text-sm rounded ${
                  filterStatus === 'upcoming'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Planifiés ({upcomingCount})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Priorité:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterPriority('all')}
                className={`px-3 py-1 text-sm rounded ${
                  filterPriority === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Toutes
              </button>
              <button
                onClick={() => setFilterPriority('high')}
                className={`px-3 py-1 text-sm rounded ${
                  filterPriority === 'high'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Urgente
              </button>
              <button
                onClick={() => setFilterPriority('medium')}
                className={`px-3 py-1 text-sm rounded ${
                  filterPriority === 'medium'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Moyenne
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredSchedules.length === 0 ? (
          <div className="col-span-full bg-white rounded-lg shadow-sm p-12 text-center">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              Aucune maintenance trouvée
            </h3>
            <p className="text-gray-500">Toutes les maintenances sont à jour</p>
          </div>
        ) : (
          filteredSchedules.map((schedule) => {
            const statusBadge = getStatusBadge(schedule.status);
            const priorityBadge = getPriorityBadge(schedule.priority);
            const StatusIcon = statusBadge.icon;

            return (
              <div
                key={schedule.id}
                onClick={() => setSelectedScheduleId(schedule.id)}
                className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
                  selectedScheduleId === schedule.id ? 'ring-2 ring-blue-600' : ''
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {schedule.vehicle_registration}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {getMaintenanceLabel(schedule.maintenance_type)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 text-xs rounded-full ${statusBadge.style} flex items-center gap-1`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusBadge.label}
                      </span>
                      <div className={`w-3 h-3 rounded-full ${priorityBadge.style}`} title={priorityBadge.label} />
                    </div>
                  </div>

                  {schedule.description && (
                    <p className="text-sm text-gray-600 mb-4">{schedule.description}</p>
                  )}

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Kilométrage actuel</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {schedule.current_km.toLocaleString()} km
                      </p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Prochaine échéance</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {schedule.next_due_km.toLocaleString()} km
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Restant:</span>
                      <span className={`font-medium ${
                        schedule.next_due_km - schedule.current_km <= 0
                          ? 'text-red-600'
                          : 'text-gray-900'
                      }`}>
                        {Math.max(0, schedule.next_due_km - schedule.current_km).toLocaleString()} km
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Date prévue:</span>
                      <span className="font-medium text-gray-900">
                        {new Date(schedule.next_due_date).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Coût estimé:</span>
                      <span className="font-medium text-gray-900">
                        {schedule.estimated_cost.toLocaleString()} GNF
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Durée estimée:</span>
                      <span className="font-medium text-gray-900">
                        {schedule.estimated_duration_hours}h
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedScheduleId(schedule.id);
                        setIsModalOpen(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 text-sm"
                    >
                      <Edit className="w-4 h-4" />
                      Modifier
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm('Désactiver ce planning ?')) return;
                        try {
                          await supabase
                            .from('maintenance_schedules')
                            .update({ is_active: false })
                            .eq('id', schedule.id);
                          fetchMaintenanceSchedules();
                        } catch (error) {
                          console.error('Error:', error);
                        }
                      }}
                      className="px-3 py-2 bg-red-50 text-red-700 rounded hover:bg-red-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {schedule.status === 'overdue' && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-red-900">Maintenance en retard</p>
                        <p className="text-xs text-red-700 mt-1">
                          Planifiez cette maintenance immédiatement pour éviter les pannes
                        </p>
                      </div>
                    </div>
                  )}

                  {schedule.status === 'due' && (
                    <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded flex items-center gap-2">
                      <Bell className="w-4 h-4 text-orange-600" />
                      <p className="text-sm text-orange-900">
                        Maintenance à prévoir cette semaine
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <MaintenanceScheduleModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedScheduleId(undefined);
        }}
        scheduleId={selectedScheduleId}
        onSuccess={fetchMaintenanceSchedules}
      />
    </div>
  );
};
