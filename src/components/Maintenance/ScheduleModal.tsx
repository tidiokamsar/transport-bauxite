import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Save, Calendar, Trash2, Wrench, Clock, Gauge } from 'lucide-react';

interface ScheduleModalProps {
  schedule: any;
  onClose: (saved: boolean) => void;
}

export const ScheduleModal = ({ schedule, onClose }: ScheduleModalProps) => {
  const [formData, setFormData] = useState({
    vehicle_id: '',
    title: '',
    description: '',
    maintenance_type: 'preventive',
    frequency_type: 'kilometers',
    frequency_value: 0,
    last_service_date: '',
    last_service_km: 0,
    next_service_date: '',
    next_service_km: 0,
    estimated_cost: 0,
    active: true,
  });

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchVehicles();
    if (schedule) {
      setFormData({
        vehicle_id: schedule.vehicle_id || '',
        title: schedule.title || '',
        description: schedule.description || '',
        maintenance_type: schedule.maintenance_type || 'preventive',
        frequency_type: schedule.frequency_type || 'kilometers',
        frequency_value: schedule.frequency_value || 0,
        last_service_date: schedule.last_service_date || '',
        last_service_km: schedule.last_service_km || 0,
        next_service_date: schedule.next_service_date || '',
        next_service_km: schedule.next_service_km || 0,
        estimated_cost: schedule.estimated_cost || 0,
        active: schedule.active !== undefined ? schedule.active : true,
      });
    }
  }, [schedule]);

  const fetchVehicles = async () => {
    const { data } = await supabase
      .from('vehicles')
      .select('id, registration, brand_model')
      .eq('status', 'active');
    setVehicles(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (schedule?.id) {
        const { error } = await supabase
          .from('maintenance_schedules')
          .update(formData)
          .eq('id', schedule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('maintenance_schedules').insert([formData]);
        if (error) throw error;
      }

      onClose(true);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!schedule?.id || !confirm('Êtes-vous sûr de vouloir supprimer ce planning ?')) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('maintenance_schedules').delete().eq('id', schedule.id);
      if (error) throw error;
      onClose(true);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-8 py-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
              <Wrench className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                {schedule ? 'Modifier le planning' : 'Nouveau planning de maintenance'}
              </h2>
              <p className="text-sm text-blue-100 mt-1">Maintenance préventive programmée</p>
            </div>
          </div>
          <button
            onClick={() => onClose(false)}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <div className="space-y-8">
            {/* Section 1: Informations principales */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
              <div className="flex items-center gap-2 mb-4">
                <Wrench className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-blue-900">Informations principales</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Véhicule *</label>
                  <select
                    required
                    value={formData.vehicle_id}
                    onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  >
                    <option value="">Sélectionner un véhicule</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.registration} - {v.brand_model}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Titre *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="Vidange moteur périodique"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                    placeholder="Détails de la maintenance..."
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Type et fréquence */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-bold text-purple-900">Type et fréquence</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Type de maintenance *</label>
                  <select
                    required
                    value={formData.maintenance_type}
                    onChange={(e) => setFormData({ ...formData, maintenance_type: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                  >
                    <option value="preventive">Préventive</option>
                    <option value="corrective">Corrective</option>
                    <option value="predictive">Prédictive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Type de fréquence *</label>
                  <select
                    required
                    value={formData.frequency_type}
                    onChange={(e) => setFormData({ ...formData, frequency_type: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                  >
                    <option value="kilometers">Kilométrage</option>
                    <option value="days">Jours</option>
                    <option value="months">Mois</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Fréquence *</label>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      required
                      value={formData.frequency_value}
                      onChange={(e) => setFormData({ ...formData, frequency_value: parseFloat(e.target.value) || 0 })}
                      min="1"
                      className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                    />
                    <span className="px-6 py-3 bg-purple-100 border-2 border-purple-200 rounded-xl text-purple-700 font-semibold">
                      {formData.frequency_type === 'kilometers' ? 'km' : formData.frequency_type === 'days' ? 'jours' : 'mois'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Suivi des services */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
              <div className="flex items-center gap-2 mb-4">
                <Gauge className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-bold text-green-900">Suivi des services</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Dernier service (date)</label>
                  <input
                    type="date"
                    value={formData.last_service_date}
                    onChange={(e) => setFormData({ ...formData, last_service_date: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Dernier service (km)</label>
                  <input
                    type="number"
                    value={formData.last_service_km}
                    onChange={(e) => setFormData({ ...formData, last_service_km: parseFloat(e.target.value) || 0 })}
                    min="0"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Prochain service (date)</label>
                  <input
                    type="date"
                    value={formData.next_service_date}
                    onChange={(e) => setFormData({ ...formData, next_service_date: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Prochain service (km)</label>
                  <input
                    type="number"
                    value={formData.next_service_km}
                    onChange={(e) => setFormData({ ...formData, next_service_km: parseFloat(e.target.value) || 0 })}
                    min="0"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Coût estimé (GNF)</label>
                  <input
                    type="number"
                    value={formData.estimated_cost}
                    onChange={(e) => setFormData({ ...formData, estimated_cost: parseFloat(e.target.value) || 0 })}
                    min="0"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    placeholder="0"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center gap-3 p-4 bg-white rounded-xl border-2 border-slate-200 cursor-pointer hover:bg-green-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      className="w-5 h-5 text-green-600 border-slate-300 rounded focus:ring-green-500"
                    />
                    <span className="text-sm font-semibold text-slate-700">Planning actif</span>
                  </label>
                </div>
              </div>
            </div>

            {formData.next_service_date && (
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-6 border border-blue-300 shadow-lg">
                <div className="flex items-center gap-3 text-white">
                  <Calendar className="w-6 h-6" />
                  <div>
                    <p className="font-bold text-lg">Prochain service prévu</p>
                    <p className="text-sm mt-1 text-blue-100">
                      Le {new Date(formData.next_service_date).toLocaleDateString('fr-FR')}
                      {formData.next_service_km > 0 && ` ou à ${formData.next_service_km.toLocaleString()} km`}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-8 pt-6 border-t-2 border-slate-200">
            <div>
              {schedule?.id && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50 font-semibold border-2 border-red-200 hover:border-red-300"
                >
                  <Trash2 className="w-5 h-5" />
                  Supprimer
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onClose(false)}
                disabled={loading}
                className="px-6 py-3 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50 font-semibold border-2 border-slate-200 hover:border-slate-300"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 font-semibold shadow-lg"
              >
                <Save className="w-5 h-5" />
                {loading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
