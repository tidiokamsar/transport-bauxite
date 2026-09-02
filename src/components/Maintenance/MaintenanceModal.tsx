import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Save, Wrench, Play, CheckCircle, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface MaintenanceModalProps {
  workOrder: any;
  onClose: (saved: boolean) => void;
}

export const MaintenanceModal = ({ workOrder, onClose }: MaintenanceModalProps) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    work_order_number: '',
    title: '',
    description: '',
    maintenance_type: 'preventive',
    priority: 'medium',
    status: 'open',
    vehicle_id: '',
    site_id: '',
    scheduled_date: new Date().toISOString().split('T')[0],
    km_at_maintenance: 0,
    labor_hours: 0,
    labor_cost: 0,
    estimated_cost: 0,
    actual_cost: 0,
    notes: '',
  });

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchOptions();
    if (workOrder) {
      setFormData({
        work_order_number: workOrder.work_order_number || '',
        title: workOrder.title || '',
        description: workOrder.description || '',
        maintenance_type: workOrder.maintenance_type || 'preventive',
        priority: workOrder.priority || 'medium',
        status: workOrder.status || 'open',
        vehicle_id: workOrder.vehicle_id || '',
        site_id: workOrder.site_id || '',
        scheduled_date: workOrder.scheduled_date?.split('T')[0] || new Date().toISOString().split('T')[0],
        km_at_maintenance: workOrder.km_at_maintenance || 0,
        labor_hours: workOrder.labor_hours || 0,
        labor_cost: workOrder.labor_cost || 0,
        estimated_cost: workOrder.estimated_cost || 0,
        actual_cost: workOrder.actual_cost || 0,
        notes: workOrder.notes || '',
      });
    }
  }, [workOrder]);

  const fetchOptions = async () => {
    const [vehiclesRes, sitesRes] = await Promise.all([
      supabase.from('vehicles').select('id, registration, brand_model').eq('status', 'active'),
      supabase.from('sites').select('id, name').eq('active', true),
    ]);

    setVehicles(vehiclesRes.data || []);
    setSites(sitesRes.data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const dataToSave = {
        ...formData,
        request_date: workOrder ? workOrder.request_date : new Date().toISOString().split('T')[0],
        requested_by: user?.id,
      };

      if (workOrder?.id) {
        const { error } = await supabase
          .from('maintenance_orders')
          .update(dataToSave)
          .eq('id', workOrder.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('maintenance_orders').insert([dataToSave]);
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
    if (!workOrder?.id || !confirm('Êtes-vous sûr de vouloir supprimer cet ordre de travail ?')) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('maintenance_orders').delete().eq('id', workOrder.id);
      if (error) throw error;
      onClose(true);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression');
    } finally {
      setLoading(false);
    }
  };

  const handleStartWork = () => {
    setFormData({ ...formData, status: 'in_progress', started_at: new Date().toISOString() } as any);
  };

  const handleCompleteWork = () => {
    setFormData({ ...formData, status: 'completed', completion_date: new Date().toISOString().split('T')[0] } as any);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Wrench className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {workOrder ? 'Modifier l\'ordre de travail' : 'Nouvel ordre de travail'}
              </h2>
              {workOrder && (
                <p className="text-sm text-slate-600">{formData.work_order_number}</p>
              )}
            </div>
          </div>
          <button onClick={() => onClose(false)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
            <X className="w-6 h-6 text-slate-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">N° Ordre *</label>
                <input
                  type="text"
                  required
                  value={formData.work_order_number}
                  onChange={(e) => setFormData({ ...formData, work_order_number: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="MNT-2025-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Véhicule *</label>
                <select
                  required
                  value={formData.vehicle_id}
                  onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="">Sélectionner</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.registration} - {v.brand_model}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Titre *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="Vidange moteur et remplacement filtres"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                  placeholder="Détails de l'intervention..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Type de maintenance *</label>
                <select
                  required
                  value={formData.maintenance_type}
                  onChange={(e) => setFormData({ ...formData, maintenance_type: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="preventive">Préventive</option>
                  <option value="corrective">Corrective</option>
                  <option value="predictive">Prédictive</option>
                  <option value="emergency">Urgence</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Priorité *</label>
                <select
                  required
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="low">Basse</option>
                  <option value="medium">Moyenne</option>
                  <option value="high">Haute</option>
                  <option value="critical">Critique</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Statut *</label>
                <select
                  required
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="open">Ouvert</option>
                  <option value="in_progress">En cours</option>
                  <option value="completed">Terminé</option>
                  <option value="cancelled">Annulé</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Site</label>
                <select
                  value={formData.site_id}
                  onChange={(e) => setFormData({ ...formData, site_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="">Sélectionner</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Date prévue *</label>
                <input
                  type="date"
                  required
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Kilométrage</label>
                <input
                  type="number"
                  value={formData.km_at_maintenance}
                  onChange={(e) => setFormData({ ...formData, km_at_maintenance: parseFloat(e.target.value) || 0 })}
                  min="0"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Heures de travail</label>
                <input
                  type="number"
                  value={formData.labor_hours}
                  onChange={(e) => setFormData({ ...formData, labor_hours: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.5"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Coût main d'œuvre (GNF)</label>
                <input
                  type="number"
                  value={formData.labor_cost}
                  onChange={(e) => setFormData({ ...formData, labor_cost: parseFloat(e.target.value) || 0 })}
                  min="0"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Coût estimé (GNF)</label>
                <input
                  type="number"
                  value={formData.estimated_cost}
                  onChange={(e) => setFormData({ ...formData, estimated_cost: parseFloat(e.target.value) || 0 })}
                  min="0"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Coût réel (GNF)</label>
                <input
                  type="number"
                  value={formData.actual_cost}
                  onChange={(e) => setFormData({ ...formData, actual_cost: parseFloat(e.target.value) || 0 })}
                  min="0"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                  placeholder="Notes additionnelles..."
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200">
            <div className="flex gap-2">
              {workOrder?.id && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-5 h-5" />
                  Supprimer
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {workOrder?.id && (
                <>
                  {formData.status === 'open' && (
                    <button
                      type="button"
                      onClick={handleStartWork}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                    >
                      <Play className="w-5 h-5" />
                      Démarrer
                    </button>
                  )}
                  {formData.status === 'in_progress' && (
                    <button
                      type="button"
                      onClick={handleCompleteWork}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Terminer
                    </button>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={() => onClose(false)}
                disabled={loading}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
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
