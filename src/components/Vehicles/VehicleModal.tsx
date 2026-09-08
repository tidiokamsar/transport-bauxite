import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X } from 'lucide-react';
import { Vehicle } from '../../types/vehicle';

interface VehicleModalProps {
  vehicle: Vehicle | null;
  mode: 'view' | 'edit' | 'create';
  onClose: () => void;
}

export const VehicleModal = ({ vehicle, mode, onClose }: VehicleModalProps) => {
  const [formData, setFormData] = useState<Vehicle>({
    registration: '',
    brand_model: '',
    capacity_tonnes: 0,
    vehicle_type: 'tipper',
    current_km: 0,
    status: 'active',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (vehicle) {
      setFormData(vehicle);
    }
  }, [vehicle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'create') {
        const { error } = await supabase.from('vehicles').insert([formData]);
        if (error) throw error;
      } else if (mode === 'edit' && vehicle?.id) {
        const { error } = await supabase
          .from('vehicles')
          .update(formData)
          .eq('id', vehicle.id);
        if (error) throw error;
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const isReadOnly = mode === 'view';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900">
            {mode === 'create'
              ? 'Nouveau véhicule'
              : mode === 'edit'
              ? 'Modifier véhicule'
              : 'Détails du véhicule'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Immatriculation *
              </label>
              <input
                type="text"
                value={formData.registration}
                onChange={(e) => setFormData({ ...formData, registration: e.target.value })}
                disabled={isReadOnly}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Marque et modèle *
              </label>
              <input
                type="text"
                value={formData.brand_model}
                onChange={(e) => setFormData({ ...formData, brand_model: e.target.value })}
                disabled={isReadOnly}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Type de véhicule *
              </label>
              <select
                value={formData.vehicle_type}
                onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                disabled={isReadOnly}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-100"
              >
                <option value="tipper">Benne</option>
                <option value="tanker">Citerne</option>
                <option value="flatbed">Plateau</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Capacité (tonnes) *
              </label>
              <input
                type="number"
                value={formData.capacity_tonnes}
                onChange={(e) =>
                  setFormData({ ...formData, capacity_tonnes: parseFloat(e.target.value) })
                }
                disabled={isReadOnly}
                required
                min="0"
                step="0.1"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Année</label>
              <input
                type="number"
                value={formData.year || ''}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                disabled={isReadOnly}
                min="1900"
                max={new Date().getFullYear()}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Numéro de châssis
              </label>
              <input
                type="text"
                value={formData.chassis_number || ''}
                onChange={(e) => setFormData({ ...formData, chassis_number: e.target.value })}
                disabled={isReadOnly}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Kilométrage actuel *
              </label>
              <input
                type="number"
                value={formData.current_km}
                onChange={(e) => setFormData({ ...formData, current_km: parseFloat(e.target.value) })}
                disabled={isReadOnly}
                required
                min="0"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Statut *</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                disabled={isReadOnly}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-100"
              >
                <option value="active">Actif</option>
                <option value="maintenance">En maintenance</option>
                <option value="immobilized">Immobilisé</option>
                <option value="sold">Vendu</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Expiration assurance
              </label>
              <input
                type="date"
                value={formData.insurance_expiry || ''}
                onChange={(e) => setFormData({ ...formData, insurance_expiry: e.target.value })}
                disabled={isReadOnly}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Expiration visite technique
              </label>
              <input
                type="date"
                value={formData.technical_inspection_expiry || ''}
                onChange={(e) =>
                  setFormData({ ...formData, technical_inspection_expiry: e.target.value })
                }
                disabled={isReadOnly}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-100"
              />
            </div>
          </div>

          {!isReadOnly && (
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-slate-900 text-white py-2 px-4 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {loading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-slate-100 text-slate-700 py-2 px-4 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Annuler
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
