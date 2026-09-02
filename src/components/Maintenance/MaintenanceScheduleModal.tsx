import { useState, useEffect } from 'react';
import { X, Wrench, Calendar, TrendingUp, DollarSign, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface MaintenanceScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleId?: string;
  onSuccess: () => void;
}

interface ScheduleForm {
  vehicle_id: string;
  maintenance_type: string;
  description: string;
  interval_km: number;
  interval_days: number;
  last_maintenance_km: number;
  last_maintenance_date: string;
  estimated_cost: number;
  estimated_duration_hours: number;
  priority: string;
}

const MAINTENANCE_TYPES = [
  'Vidange moteur',
  'Révision complète',
  'Changement filtres',
  'Contrôle freins',
  'Contrôle suspension',
  'Contrôle direction',
  'Changement pneus',
  'Contrôle électrique',
  'Contrôle climatisation',
  'Contrôle échappement',
  'Graissage',
  'Contrôle transmission',
];

export const MaintenanceScheduleModal = ({
  isOpen,
  onClose,
  scheduleId,
  onSuccess,
}: MaintenanceScheduleModalProps) => {
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [formData, setFormData] = useState<ScheduleForm>({
    vehicle_id: '',
    maintenance_type: 'Vidange moteur',
    description: '',
    interval_km: 10000,
    interval_days: 180,
    last_maintenance_km: 0,
    last_maintenance_date: new Date().toISOString().split('T')[0],
    estimated_cost: 50000,
    estimated_duration_hours: 2,
    priority: 'medium',
  });

  useEffect(() => {
    if (isOpen) {
      fetchVehicles();
      if (scheduleId) {
        fetchSchedule();
      } else {
        resetForm();
      }
    }
  }, [isOpen, scheduleId]);

  const fetchVehicles = async () => {
    const { data } = await supabase
      .from('vehicles')
      .select('id, registration, current_km')
      .eq('status', 'active')
      .order('registration');
    setVehicles(data || []);
  };

  const fetchSchedule = async () => {
    if (!scheduleId) return;

    const { data, error } = await supabase
      .from('maintenance_schedules')
      .select('*')
      .eq('id', scheduleId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching schedule:', error);
      return;
    }

    if (data) {
      setFormData({
        vehicle_id: data.vehicle_id,
        maintenance_type: data.maintenance_type,
        description: data.description || '',
        interval_km: data.interval_km || 10000,
        interval_days: data.interval_days || 180,
        last_maintenance_km: data.last_maintenance_km || 0,
        last_maintenance_date: data.last_maintenance_date?.split('T')[0] || new Date().toISOString().split('T')[0],
        estimated_cost: data.estimated_cost || 50000,
        estimated_duration_hours: data.estimated_duration_hours || 2,
        priority: data.priority || 'medium',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      vehicle_id: '',
      maintenance_type: 'Vidange moteur',
      description: '',
      interval_km: 10000,
      interval_days: 180,
      last_maintenance_km: 0,
      last_maintenance_date: new Date().toISOString().split('T')[0],
      estimated_cost: 50000,
      estimated_duration_hours: 2,
      priority: 'medium',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (scheduleId) {
        const { error } = await supabase
          .from('maintenance_schedules')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', scheduleId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('maintenance_schedules')
          .insert({
            ...formData,
            is_active: true,
          });

        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving schedule:', error);
      alert(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {scheduleId ? 'Modifier Planning' : 'Nouveau Planning'}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Planifier une maintenance préventive
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Véhicule *
              </label>
              <select
                required
                value={formData.vehicle_id}
                onChange={(e) => {
                  const vehicle = vehicles.find(v => v.id === e.target.value);
                  setFormData({
                    ...formData,
                    vehicle_id: e.target.value,
                    last_maintenance_km: vehicle?.current_km || 0,
                  });
                }}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sélectionner un véhicule</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.registration} - {vehicle.current_km.toLocaleString()} km
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Wrench className="w-4 h-4 inline mr-2" />
                Type de maintenance *
              </label>
              <select
                required
                value={formData.maintenance_type}
                onChange={(e) => setFormData({ ...formData, maintenance_type: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {MAINTENANCE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Détails de la maintenance..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <TrendingUp className="w-4 h-4 inline mr-2" />
                Intervalle (km) *
              </label>
              <input
                type="number"
                required
                value={formData.interval_km}
                onChange={(e) => setFormData({ ...formData, interval_km: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="0"
                step="1000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Intervalle (jours) *
              </label>
              <input
                type="number"
                required
                value={formData.interval_days}
                onChange={(e) => setFormData({ ...formData, interval_days: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="0"
                step="30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Dernier kilométrage
              </label>
              <input
                type="number"
                value={formData.last_maintenance_km}
                onChange={(e) => setFormData({ ...formData, last_maintenance_km: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Dernière maintenance
              </label>
              <input
                type="date"
                value={formData.last_maintenance_date}
                onChange={(e) => setFormData({ ...formData, last_maintenance_date: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <DollarSign className="w-4 h-4 inline mr-2" />
                Coût estimé (GNF)
              </label>
              <input
                type="number"
                value={formData.estimated_cost}
                onChange={(e) => setFormData({ ...formData, estimated_cost: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="0"
                step="10000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Clock className="w-4 h-4 inline mr-2" />
                Durée estimée (heures)
              </label>
              <input
                type="number"
                value={formData.estimated_duration_hours}
                onChange={(e) => setFormData({ ...formData, estimated_duration_hours: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.5"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Priorité
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Faible</option>
                <option value="medium">Moyenne</option>
                <option value="high">Haute</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Enregistrement...' : scheduleId ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
