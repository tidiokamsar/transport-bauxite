import { useEffect, useState } from 'react';
import { X, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface StockEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item?: any;
  type: 'entry' | 'exit';
}

export const StockEntryModal = ({ isOpen, onClose, onSuccess, item, type }: StockEntryModalProps) => {
  const [formData, setFormData] = useState({
    item_id: '',
    quantity: '',
    reference: '',
    reason: '',
    notes: '',
  });
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      if (item) {
        setFormData({
          item_id: item.id,
          quantity: '',
          reference: '',
          reason: '',
          notes: '',
        });
        setSelectedItem(item);
      } else {
        fetchItems();
        setFormData({
          item_id: '',
          quantity: '',
          reference: '',
          reason: '',
          notes: '',
        });
        setSelectedItem(null);
      }
    }
  }, [isOpen, item]);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('stock_items')
        .select('*')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  const handleItemChange = (itemId: string) => {
    setFormData({ ...formData, item_id: itemId });
    const found = items.find(i => i.id === itemId);
    setSelectedItem(found);
  };

  const getCurrentQuantity = () => {
    const qty = selectedItem?.quantity;
    return typeof qty === 'string' ? parseFloat(qty) : qty || 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const currentQty = getCurrentQuantity();
      const changeQty = parseFloat(formData.quantity);

      if (type === 'exit' && changeQty > currentQty) {
        alert('Quantité insuffisante en stock');
        setLoading(false);
        return;
      }

      const newQty = type === 'entry' ? currentQty + changeQty : currentQty - changeQty;

      await supabase
        .from('stock_items')
        .update({ quantity: newQty })
        .eq('id', formData.item_id);

      await supabase
        .from('stock_movements')
        .insert([{
          item_id: formData.item_id,
          movement_type: type,
          quantity: type === 'entry' ? changeQty : -changeQty,
          previous_quantity: currentQty,
          new_quantity: newQty,
          reference: formData.reference || null,
          reason: formData.reason || null,
          notes: formData.notes || null,
          performed_by: (await supabase.auth.getUser()).data.user?.id,
        }]);

      onSuccess();
    } catch (error) {
      console.error('Error processing movement:', error);
      alert('Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentQty = getCurrentQuantity();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />

        <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {type === 'entry' ? (
                <div className="p-2 bg-green-100 rounded-lg">
                  <ArrowUpCircle className="w-5 h-5 text-green-600" />
                </div>
              ) : (
                <div className="p-2 bg-orange-100 rounded-lg">
                  <ArrowDownCircle className="w-5 h-5 text-orange-600" />
                </div>
              )}
              <h2 className="text-xl font-bold text-slate-900">
                {type === 'entry' ? 'Entrée de stock' : 'Sortie de stock'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {!item && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Article <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.item_id}
                  onChange={(e) => handleItemChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="">Sélectionner un article</option>
                  {items.map((itm) => (
                    <option key={itm.id} value={itm.id}>
                      {itm.code} - {itm.name} (Stock: {itm.quantity} {itm.unit})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedItem && (
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-600">Article</p>
                    <p className="font-medium text-slate-900">{selectedItem.code} - {selectedItem.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Stock actuel</p>
                    <p className="text-lg font-bold text-slate-900">
                      {currentQty.toLocaleString()} {selectedItem.unit}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Quantité <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                placeholder="Quantité"
              />
              {selectedItem && formData.quantity && (
                <p className="text-sm text-slate-600 mt-2">
                  Nouveau stock: {' '}
                  <span className="font-bold">
                    {type === 'entry'
                      ? (currentQty + parseFloat(formData.quantity || '0')).toLocaleString()
                      : (currentQty - parseFloat(formData.quantity || '0')).toLocaleString()
                    } {selectedItem.unit}
                  </span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Référence document
              </label>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                placeholder="Ex: BL-2024-001, Facture-123"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Raison <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              >
                <option value="">Sélectionner une raison</option>
                {type === 'entry' ? (
                  <>
                    <option value="Achat">Achat</option>
                    <option value="Retour">Retour</option>
                    <option value="Ajustement">Ajustement inventaire</option>
                    <option value="Transfert entrant">Transfert entrant</option>
                  </>
                ) : (
                  <>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Réparation">Réparation</option>
                    <option value="Installation">Installation véhicule</option>
                    <option value="Transfert sortant">Transfert sortant</option>
                    <option value="Perte">Perte/Casse</option>
                    <option value="Autre">Autre</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                placeholder="Informations complémentaires..."
              />
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
                className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${
                  type === 'entry' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {loading ? 'Enregistrement...' : type === 'entry' ? 'Enregistrer l\'entrée' : 'Enregistrer la sortie'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
