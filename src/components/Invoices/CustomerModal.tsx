import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Save, Users, Trash2 } from 'lucide-react';

interface CustomerModalProps {
  customer: any;
  onClose: (saved: boolean) => void;
}

export const CustomerModal = ({ customer, onClose }: CustomerModalProps) => {
  const [formData, setFormData] = useState({
    customer_number: '',
    customer_type: 'company',
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    tax_id: '',
    payment_terms: 30,
    credit_limit: 0,
    notes: '',
    active: true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (customer) {
      setFormData({
        customer_number: customer.customer_number || '',
        customer_type: customer.customer_type || 'company',
        company_name: customer.company_name || '',
        contact_name: customer.contact_name || '',
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
        city: customer.city || '',
        tax_id: customer.tax_id || '',
        payment_terms: customer.payment_terms || 30,
        credit_limit: customer.credit_limit || 0,
        notes: customer.notes || '',
        active: customer.active !== undefined ? customer.active : true,
      });
    }
  }, [customer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (customer?.id) {
        const { error } = await supabase
          .from('customers')
          .update(formData)
          .eq('id', customer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('customers').insert([formData]);
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
    if (!customer?.id || !confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('customers').delete().eq('id', customer.id);
      if (error) throw error;
      onClose(true);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              {customer ? 'Modifier le client' : 'Nouveau client'}
            </h2>
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
                <label className="block text-sm font-medium text-slate-700 mb-2">N° Client *</label>
                <input
                  type="text"
                  required
                  value={formData.customer_number}
                  onChange={(e) => setFormData({ ...formData, customer_number: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="CLI-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Type *</label>
                <select
                  required
                  value={formData.customer_type}
                  onChange={(e) => setFormData({ ...formData, customer_type: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="company">Entreprise</option>
                  <option value="individual">Particulier</option>
                  <option value="government">Gouvernement</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Nom de l'entreprise *</label>
                <input
                  type="text"
                  required
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Personne de contact *</label>
                <input
                  type="text"
                  required
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Téléphone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="+224 621 123 456"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Ville</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Adresse</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">N° fiscal</label>
                <input
                  type="text"
                  value={formData.tax_id}
                  onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Conditions de paiement (jours)</label>
                <input
                  type="number"
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: parseInt(e.target.value) || 0 })}
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
                  placeholder="Notes internes..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900"
                  />
                  <span className="text-sm font-medium text-slate-700">Client actif</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200">
            <div>
              {customer?.id && (
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
