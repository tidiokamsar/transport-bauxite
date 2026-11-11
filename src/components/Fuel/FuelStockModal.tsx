import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Save, Droplet } from 'lucide-react';

interface FuelStockModalProps {
  stock: any;
  onClose: (saved: boolean) => void;
}

export const FuelStockModal = ({ stock, onClose }: FuelStockModalProps) => {
  const [formData, setFormData] = useState({
    site_id: '',
    fuel_type_id: '',
    tank_capacity: 0,
    current_stock: 0,
    minimum_stock: 0,
    last_refill_date: '',
  });

  const [sites, setSites] = useState<any[]>([]);
  const [fuelTypes, setFuelTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchOptions();
    if (stock) {
      setFormData({
        site_id: stock.site_id || '',
        fuel_type_id: stock.fuel_type_id || '',
        tank_capacity: stock.tank_capacity || 0,
        current_stock: stock.current_stock || 0,
        minimum_stock: stock.minimum_stock || 0,
        last_refill_date: stock.last_refill_date || '',
      });
    }
  }, [stock]);

  const fetchOptions = async () => {
    const [sitesRes, fuelTypesRes] = await Promise.all([
      supabase.from('sites').select('id, name').eq('is_active', true),
      supabase.from('fuel_types').select('id, name').eq('active', true),
    ]);

    setSites(sitesRes.data || []);
    setFuelTypes(fuelTypesRes.data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const dataToSave = {
        ...formData,
        last_refill_date: formData.last_refill_date || null,
        updated_at: new Date().toISOString(),
      };

      if (stock?.id) {
        const { error } = await supabase
          .from('fuel_stocks')
          .update(dataToSave)
          .eq('id', stock.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('fuel_stocks').insert([dataToSave]);
        if (error) throw error;
      }

      onClose(true);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const percentage = formData.tank_capacity > 0 ? (formData.current_stock / formData.tank_capacity) * 100 : 0;
  const isLowStock = formData.current_stock <= formData.minimum_stock;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Droplet className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {stock ? 'Gérer le stock de carburant' : 'Nouveau stock de carburant'}
              </h2>
              <p className="text-sm text-slate-600">Configuration du réservoir et alertes de stock</p>
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Site *</label>
                <select
                  required
                  value={formData.site_id}
                  onChange={(e) => setFormData({ ...formData, site_id: e.target.value })}
                  disabled={!!stock}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-100"
                >
                  <option value="">Sélectionner un site</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Type de carburant *</label>
                <select
                  required
                  value={formData.fuel_type_id}
                  onChange={(e) => setFormData({ ...formData, fuel_type_id: e.target.value })}
                  disabled={!!stock}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-100"
                >
                  <option value="">Sélectionner</option>
                  {fuelTypes.map((ft) => (
                    <option key={ft.id} value={ft.id}>
                      {ft.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Capacité du réservoir (L) *</label>
                <input
                  type="number"
                  required
                  value={formData.tank_capacity}
                  onChange={(e) => setFormData({ ...formData, tank_capacity: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="1"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Stock actuel (L) *</label>
                <input
                  type="number"
                  required
                  value={formData.current_stock}
                  onChange={(e) => setFormData({ ...formData, current_stock: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="1"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Stock minimum d'alerte (L) *</label>
                <input
                  type="number"
                  required
                  value={formData.minimum_stock}
                  onChange={(e) => setFormData({ ...formData, minimum_stock: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="1"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Date dernier réapprovisionnement</label>
                <input
                  type="date"
                  value={formData.last_refill_date}
                  onChange={(e) => setFormData({ ...formData, last_refill_date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>
            </div>

            {formData.tank_capacity > 0 && (
              <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Aperçu du stock</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-600">Niveau de remplissage</span>
                      <span className={`font-semibold ${isLowStock ? 'text-red-600' : 'text-slate-900'}`}>
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          isLowStock ? 'bg-red-600' : percentage < 50 ? 'bg-orange-600' : 'bg-green-600'
                        }`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-2">
                    <div>
                      <p className="text-xs text-slate-600 mb-1">Stock actuel</p>
                      <p className="text-lg font-bold text-slate-900">{formData.current_stock.toLocaleString()} L</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 mb-1">Capacité max</p>
                      <p className="text-lg font-bold text-slate-900">{formData.tank_capacity.toLocaleString()} L</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 mb-1">Disponible</p>
                      <p className="text-lg font-bold text-green-600">
                        {(formData.tank_capacity - formData.current_stock).toLocaleString()} L
                      </p>
                    </div>
                  </div>

                  {isLowStock && (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-sm font-medium">Stock critique ! Réapprovisionnement requis</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-slate-200">
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
        </form>
      </div>
    </div>
  );
};
