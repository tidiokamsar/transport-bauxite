import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface StockItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item?: any;
}

export const StockItemModal = ({ isOpen, onClose, onSuccess, item }: StockItemModalProps) => {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    category_id: '',
    warehouse_location: '',
    unit: 'pièce',
    quantity: '',
    min_quantity: '',
    unit_price: '',
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      if (item) {
        setFormData({
          code: item.code || '',
          name: item.name || '',
          description: item.description || '',
          category_id: item.category_id || '',
          warehouse_location: item.warehouse_location || '',
          unit: item.unit || 'pièce',
          quantity: item.quantity?.toString() || '',
          min_quantity: item.min_quantity?.toString() || '',
          unit_price: item.unit_price?.toString() || '',
        });
      } else {
        setFormData({
          code: '',
          name: '',
          description: '',
          category_id: '',
          warehouse_location: '',
          unit: 'pièce',
          quantity: '0',
          min_quantity: '0',
          unit_price: '',
        });
      }
    }
  }, [isOpen, item]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('stock_categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dataToSave = {
        code: formData.code,
        name: formData.name,
        description: formData.description || null,
        category_id: formData.category_id || null,
        warehouse_location: formData.warehouse_location || null,
        unit: formData.unit,
        quantity: parseFloat(formData.quantity) || 0,
        min_quantity: parseFloat(formData.min_quantity) || 0,
        unit_price: parseFloat(formData.unit_price) || 0,
        status: 'active',
      };

      if (item) {
        const { error } = await supabase
          .from('stock_items')
          .update(dataToSave)
          .eq('id', item.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('stock_items')
          .insert([dataToSave]);

        if (error) throw error;
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />

        <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">
              {item ? 'Modifier l\'article' : 'Nouvel article'}
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Code article <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="Ex: FLT-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Catégorie
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="">Sélectionner une catégorie</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nom de l'article <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                placeholder="Ex: Filtre à huile standard"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                placeholder="Description détaillée de l'article"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Emplacement entrepôt
                </label>
                <input
                  type="text"
                  value={formData.warehouse_location}
                  onChange={(e) => setFormData({ ...formData, warehouse_location: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="Ex: A-101"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Unité <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="pièce">pièce</option>
                  <option value="litre">litre</option>
                  <option value="kg">kg</option>
                  <option value="mètre">mètre</option>
                  <option value="kit">kit</option>
                  <option value="jeu">jeu</option>
                  <option value="boîte">boîte</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Quantité initiale <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Seuil minimum <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.min_quantity}
                  onChange={(e) => setFormData({ ...formData, min_quantity: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Prix unitaire (GNF) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="1"
                  value={formData.unit_price}
                  onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {loading ? 'Enregistrement...' : item ? 'Mettre à jour' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
