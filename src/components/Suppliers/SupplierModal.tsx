import { useEffect, useState } from 'react';
import { X, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  supplier?: any;
}

export const SupplierModal = ({ isOpen, onClose, onSuccess, supplier }: SupplierModalProps) => {
  const [formData, setFormData] = useState({
    supplier_number: '',
    supplier_type: 'parts',
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    rating: 0,
    payment_terms: '',
    tax_id: '',
    notes: '',
    active: true,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (supplier) {
        setFormData({
          supplier_number: supplier.supplier_number || '',
          supplier_type: supplier.supplier_type || 'parts',
          company_name: supplier.company_name || '',
          contact_name: supplier.contact_name || '',
          email: supplier.email || '',
          phone: supplier.phone || '',
          address: supplier.address || '',
          city: supplier.city || '',
          rating: supplier.rating || 0,
          payment_terms: supplier.payment_terms || '',
          tax_id: supplier.tax_id || '',
          notes: supplier.notes || '',
          active: supplier.active !== undefined ? supplier.active : true,
        });
      } else {
        setFormData({
          supplier_number: `SUPP-${Date.now()}`,
          supplier_type: 'parts',
          company_name: '',
          contact_name: '',
          email: '',
          phone: '',
          address: '',
          city: '',
          rating: 0,
          payment_terms: '',
          tax_id: '',
          notes: '',
          active: true,
        });
      }
    }
  }, [isOpen, supplier]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dataToSave = {
        ...formData,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
        city: formData.city || null,
        payment_terms: formData.payment_terms || null,
        tax_id: formData.tax_id || null,
        notes: formData.notes || null,
        rating: formData.rating > 0 ? formData.rating : null,
      };

      if (supplier) {
        await supabase.from('suppliers').update(dataToSave).eq('id', supplier.id);
      } else {
        await supabase.from('suppliers').insert([dataToSave]);
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
        <div className="relative bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
            <h2 className="text-xl font-bold">{supplier ? 'Modifier' : 'Nouveau'} fournisseur</h2>
            <button onClick={onClose}><X className="w-6 h-6" /></button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">N° Fournisseur *</label>
                <input
                  type="text"
                  required
                  value={formData.supplier_number}
                  onChange={(e) => setFormData({ ...formData, supplier_number: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type *</label>
                <select
                  required
                  value={formData.supplier_type}
                  onChange={(e) => setFormData({ ...formData, supplier_type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="parts">Pièces détachées</option>
                  <option value="tires">Pneus</option>
                  <option value="fuel">Carburant</option>
                  <option value="services">Services</option>
                  <option value="other">Autre</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Nom de l'entreprise *</label>
              <input
                type="text"
                required
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nom du contact</label>
                <input
                  type="text"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Téléphone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Adresse</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ville</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Conditions de paiement</label>
                <input
                  type="text"
                  placeholder="Ex: 30 jours"
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Numéro fiscal</label>
                <input
                  type="text"
                  value={formData.tax_id}
                  onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Évaluation</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFormData({ ...formData, rating: star })}
                    className="focus:outline-none"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        star <= formData.rating
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
                {formData.rating > 0 && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, rating: 0 })}
                    className="text-sm text-slate-600 hover:text-slate-900 ml-2"
                  >
                    Réinitialiser
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-4 h-4 text-slate-900 rounded"
                />
                <span className="text-sm font-medium">Fournisseur actif</span>
              </label>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                {loading ? 'Enregistrement...' : supplier ? 'Mettre à jour' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
