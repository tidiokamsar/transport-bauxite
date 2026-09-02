import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Save, Package } from 'lucide-react';

interface PartsModalProps {
  part: any;
  onClose: (saved: boolean) => void;
}

export const PartsModal = ({ part, onClose }: PartsModalProps) => {
  const [formData, setFormData] = useState({
    part_reference: '',
    description: '',
    quantity_in_stock: 0,
    minimum_threshold: 0,
    unit_price: 0,
    supplier: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (part) {
      setFormData({
        part_reference: part.part_reference || part.part_number || '',
        description: part.description || part.name || '',
        quantity_in_stock: part.quantity_in_stock || 0,
        minimum_threshold: part.minimum_threshold || part.minimum_stock || 0,
        unit_price: part.unit_price || 0,
        supplier: part.supplier || '',
      });
    }
  }, [part]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (part?.id) {
        const { error } = await supabase
          .from('parts_inventory')
          .update(formData)
          .eq('id', part.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('parts_inventory').insert([formData]);
        if (error) throw error;
      }

      onClose(true);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const stockPercentage = formData.minimum_threshold > 0
    ? (formData.quantity_in_stock / (formData.minimum_threshold * 2)) * 100
    : 50;
  const isLowStock = formData.quantity_in_stock <= formData.minimum_threshold;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {part ? 'Modifier la pièce' : 'Nouvelle pièce'}
              </h2>
              <p className="text-sm text-slate-600">Gestion de l'inventaire</p>
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Référence *</label>
                <input
                  type="text"
                  required
                  value={formData.part_reference}
                  onChange={(e) => setFormData({ ...formData, part_reference: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="FLT-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Fournisseur</label>
                <input
                  type="text"
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="Auto Pièces Guinée"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Description *</label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                  placeholder="Description de la pièce..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Quantité en stock *</label>
                <input
                  type="number"
                  required
                  value={formData.quantity_in_stock}
                  onChange={(e) => setFormData({ ...formData, quantity_in_stock: parseFloat(e.target.value) || 0 })}
                  min="0"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Seuil minimum *</label>
                <input
                  type="number"
                  required
                  value={formData.minimum_threshold}
                  onChange={(e) => setFormData({ ...formData, minimum_threshold: parseFloat(e.target.value) || 0 })}
                  min="0"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Prix unitaire (GNF) *</label>
                <input
                  type="number"
                  required
                  value={formData.unit_price}
                  onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })}
                  min="0"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>
            </div>

            {formData.minimum_threshold > 0 && (
              <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Aperçu du stock</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-600">Niveau de stock</span>
                      <span className={`font-semibold ${isLowStock ? 'text-red-600' : 'text-slate-900'}`}>
                        {stockPercentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          isLowStock ? 'bg-red-600' : 'bg-green-600'
                        }`}
                        style={{ width: `${Math.min(stockPercentage, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-2">
                    <div>
                      <p className="text-xs text-slate-600 mb-1">Stock actuel</p>
                      <p className="text-lg font-bold text-slate-900">{formData.quantity_in_stock}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 mb-1">Seuil minimum</p>
                      <p className="text-lg font-bold text-slate-900">{formData.minimum_threshold}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 mb-1">Valeur stock</p>
                      <p className="text-lg font-bold text-slate-900">
                        {((formData.quantity_in_stock * formData.unit_price) / 1000).toLocaleString()}K
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
                      <span className="text-sm font-medium">Stock faible ! Réapprovisionnement recommandé</span>
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
