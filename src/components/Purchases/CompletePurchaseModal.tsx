import { useEffect, useState } from 'react';
import { X, Plus, Trash2, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface PurchaseOrderItem {
  id?: string;
  item_description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface CompletePurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  order?: any;
}

export const CompletePurchaseModal = ({ isOpen, onClose, onSuccess, order }: CompletePurchaseModalProps) => {
  const [formData, setFormData] = useState({
    order_number: '',
    supplier_id: '',
    order_date: '',
    expected_delivery: '',
    status: 'draft',
    notes: '',
  });
  const [items, setItems] = useState<PurchaseOrderItem[]>([{
    item_description: '',
    quantity: 1,
    unit_price: 0,
    total_price: 0,
  }]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSuppliers();
      if (order) {
        setFormData({
          order_number: order.order_number || '',
          supplier_id: order.supplier_id || '',
          order_date: order.order_date || '',
          expected_delivery: order.expected_delivery || '',
          status: order.status || 'draft',
          notes: order.notes || '',
        });
        fetchOrderItems(order.id);
      } else {
        const newOrderNumber = `BC-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
        setFormData({
          order_number: newOrderNumber,
          supplier_id: '',
          order_date: new Date().toISOString().split('T')[0],
          expected_delivery: '',
          status: 'draft',
          notes: '',
        });
        setItems([{
          item_description: '',
          quantity: 1,
          unit_price: 0,
          total_price: 0,
        }]);
      }
    }
  }, [isOpen, order]);

  const fetchSuppliers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .eq('active', true)
      .order('company_name');
    setSuppliers(data || []);
    setLoading(false);
  };

  const fetchOrderItems = async (orderId: string) => {
    const { data } = await supabase
      .from('purchase_order_items')
      .select('*')
      .eq('order_id', orderId);
    if (data && data.length > 0) {
      setItems(data);
    }
  };

  const handleAddItem = () => {
    setItems([...items, {
      item_description: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0,
    }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, field: keyof PurchaseOrderItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'quantity' || field === 'unit_price') {
      const quantity = field === 'quantity' ? parseFloat(value) || 0 : newItems[index].quantity;
      const unitPrice = field === 'unit_price' ? parseFloat(value) || 0 : newItems[index].unit_price;
      newItems[index].total_price = quantity * unitPrice;
    }

    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.total_price || 0), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const totalAmount = calculateTotal();

      if (order) {
        const { error: orderError } = await supabase
          .from('purchase_orders')
          .update({
            ...formData,
            total_amount: totalAmount,
          })
          .eq('id', order.id);

        if (orderError) throw orderError;

        await supabase
          .from('purchase_order_items')
          .delete()
          .eq('order_id', order.id);

        for (const item of items) {
          if (item.item_description.trim()) {
            await supabase
              .from('purchase_order_items')
              .insert({
                order_id: order.id,
                item_description: item.item_description,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price,
              });
          }
        }
      } else {
        const { data: user } = await supabase.auth.getUser();

        const { data: newOrder, error: orderError } = await supabase
          .from('purchase_orders')
          .insert({
            order_number: formData.order_number,
            supplier_id: formData.supplier_id,
            order_date: formData.order_date,
            expected_delivery: formData.expected_delivery,
            status: formData.status,
            total_amount: totalAmount,
            notes: formData.notes,
            created_by: user?.user?.id,
          })
          .select()
          .single();

        if (orderError) throw orderError;

        for (const item of items) {
          if (item.item_description.trim()) {
            await supabase
              .from('purchase_order_items')
              .insert({
                order_id: newOrder.id,
                item_description: item.item_description,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price,
              });
          }
        }
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving purchase order:', error);
      alert('Erreur lors de la sauvegarde du bon de commande');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
            <h2 className="text-xl font-bold text-slate-900">
              {order ? 'Modifier le bon de commande' : 'Nouveau bon de commande'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  N° Bon de commande *
                </label>
                <input
                  type="text"
                  value={formData.order_number}
                  onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Fournisseur *
                </label>
                <select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled={loading}
                >
                  <option value="">Sélectionner un fournisseur</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Date de commande *
                </label>
                <input
                  type="date"
                  value={formData.order_date}
                  onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Livraison prévue
                </label>
                <input
                  type="date"
                  value={formData.expected_delivery}
                  onChange={(e) => setFormData({ ...formData, expected_delivery: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Statut
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="draft">Brouillon</option>
                  <option value="submitted">Soumise</option>
                  <option value="approved">Approuvée</option>
                  <option value="received">Reçue</option>
                  <option value="cancelled">Annulée</option>
                </select>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>

            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Articles commandés</h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter article
                </button>
              </div>

              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-3 items-end p-4 bg-slate-50 rounded-lg">
                    <div className="col-span-5">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={item.item_description}
                        onChange={(e) => handleItemChange(index, 'item_description', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        placeholder="Description de l'article"
                        required
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Quantité
                      </label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Prix unitaire (GNF)
                      </label>
                      <input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Total (GNF)
                      </label>
                      <input
                        type="text"
                        value={item.total_price.toLocaleString('fr-FR')}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-100"
                        disabled
                      />
                    </div>

                    <div className="col-span-1">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="w-full p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        disabled={items.length === 1}
                      >
                        <Trash2 className="w-4 h-4 mx-auto" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-end">
                <div className="bg-slate-100 px-6 py-4 rounded-lg">
                  <div className="text-sm text-slate-600 mb-1">Montant total</div>
                  <div className="text-2xl font-bold text-slate-900">
                    {calculateTotal().toLocaleString('fr-FR')} GNF
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving || !formData.supplier_id || items.every(i => !i.item_description.trim())}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Enregistrement...' : order ? 'Mettre à jour' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
