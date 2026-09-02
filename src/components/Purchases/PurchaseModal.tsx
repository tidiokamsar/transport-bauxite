import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  order?: any;
}

export const PurchaseModal = ({ isOpen, onClose, onSuccess, order }: PurchaseModalProps) => {
  const [formData, setFormData] = useState({
    order_number: '',
    supplier_id: '',
    order_date: '',
    expected_delivery: '',
    status: 'pending',
    notes: '',
  });
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSuppliers();
      if (order) {
        setFormData({
          order_number: order.order_number || '',
          supplier_id: order.supplier_id || '',
          order_date: order.order_date || '',
          expected_delivery: order.expected_delivery || '',
          status: order.status || 'pending',
          notes: order.notes || '',
        });
      } else {
        setFormData({
          order_number: `BC-${Date.now()}`,
          supplier_id: '',
          order_date: new Date().toISOString().split('T')[0],
          expected_delivery: '',
          status: 'pending',
          notes: '',
        });
      }
    }
  }, [isOpen, order]);

  const fetchSuppliers = async () => {
    const { data } = await supabase.from('suppliers').select('*').eq('active', true).order('name');
    setSuppliers(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dataToSave = {
        ...formData,
        supplier_id: formData.supplier_id || null,
        expected_delivery: formData.expected_delivery || null,
        notes: formData.notes || null,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      };

      if (order) {
        await supabase.from('purchase_orders').update(dataToSave).eq('id', order.id);
      } else {
        await supabase.from('purchase_orders').insert([dataToSave]);
      }

      onSuccess();
    } catch (error) {
      console.error('Error:', error);
      alert('Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full">
          <div className="border-b px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">{order ? 'Modifier' : 'Nouveau'} bon de commande</h2>
            <button onClick={onClose}><X className="w-6 h-6" /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">N° Bon de commande *</label>
                <input type="text" required value={formData.order_number} onChange={(e) => setFormData({ ...formData, order_number: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Fournisseur *</label>
                <select required value={formData.supplier_id} onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">Sélectionner</option>
                  {suppliers.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Date commande *</label>
                <input type="date" required value={formData.order_date} onChange={(e) => setFormData({ ...formData, order_date: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Livraison prévue</label>
                <input type="date" value={formData.expected_delivery} onChange={(e) => setFormData({ ...formData, expected_delivery: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Statut</label>
              <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                <option value="pending">En attente</option>
                <option value="received">Reçu</option>
                <option value="cancelled">Annulé</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea rows={3} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="flex gap-3 pt-4 border-t">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg">Annuler</button>
              <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg">{loading ? 'Enregistrement...' : order ? 'Mettre à jour' : 'Créer'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
