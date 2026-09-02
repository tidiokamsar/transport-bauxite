import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface CostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cost?: any;
}

export const CostModal = ({ isOpen, onClose, onSuccess, cost }: CostModalProps) => {
  const [formData, setFormData] = useState({
    date: '',
    category_id: '',
    vehicle_id: '',
    description: '',
    amount: '',
    reference: '',
    payment_method: 'Espèces',
    notes: '',
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchData();
      if (cost) {
        setFormData({
          date: cost.date || '',
          category_id: cost.category_id || '',
          vehicle_id: cost.vehicle_id || '',
          description: cost.description || '',
          amount: cost.amount?.toString() || '',
          reference: cost.reference || '',
          payment_method: cost.payment_method || 'Espèces',
          notes: cost.notes || '',
        });
      } else {
        setFormData({
          date: new Date().toISOString().split('T')[0],
          category_id: '',
          vehicle_id: '',
          description: '',
          amount: '',
          reference: '',
          payment_method: 'Espèces',
          notes: '',
        });
      }
    }
  }, [isOpen, cost]);

  const fetchData = async () => {
    const [cats, vehs] = await Promise.all([
      supabase.from('cost_categories').select('*').order('name'),
      supabase.from('vehicles').select('id, registration').order('registration')
    ]);
    setCategories(cats.data || []);
    setVehicles(vehs.data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dataToSave = {
        date: formData.date,
        category_id: formData.category_id || null,
        vehicle_id: formData.vehicle_id || null,
        description: formData.description,
        amount: parseFloat(formData.amount),
        reference: formData.reference || null,
        payment_method: formData.payment_method,
        notes: formData.notes || null,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      };

      if (cost) {
        await supabase.from('costs').update(dataToSave).eq('id', cost.id);
      } else {
        await supabase.from('costs').insert([dataToSave]);
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving cost:', error);
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
            <h2 className="text-xl font-bold">{cost ? 'Modifier' : 'Nouvelle'} dépense</h2>
            <button onClick={onClose}><X className="w-6 h-6" /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Date *</label>
                <input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Catégorie *</label>
                <select required value={formData.category_id} onChange={(e) => setFormData({ ...formData, category_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">Sélectionner</option>
                  {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description *</label>
              <input type="text" required value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Montant (GNF) *</label>
                <input type="number" required value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Véhicule</label>
                <select value={formData.vehicle_id} onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">Aucun</option>
                  {vehicles.map((v) => (<option key={v.id} value={v.id}>{v.registration}</option>))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Référence</label>
                <input type="text" value={formData.reference} onChange={(e) => setFormData({ ...formData, reference: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Mode de paiement</label>
                <select value={formData.payment_method} onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option>Espèces</option>
                  <option>Virement</option>
                  <option>Chèque</option>
                  <option>Carte</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea rows={3} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="flex gap-3 pt-4 border-t">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg">Annuler</button>
              <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg">{loading ? 'Enregistrement...' : cost ? 'Mettre à jour' : 'Créer'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
