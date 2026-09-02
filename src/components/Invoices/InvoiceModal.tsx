import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Save, FileText, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface InvoiceModalProps {
  invoice: any;
  onClose: (saved: boolean) => void;
}

interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export const InvoiceModal = ({ invoice, onClose }: InvoiceModalProps) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    invoice_number: '',
    customer_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'draft',
    tax_rate: 0,
    discount_amount: 0,
    notes: '',
    terms: 'Paiement sous 30 jours',
  });

  const [items, setItems] = useState<InvoiceItem[]>([{
    description: '',
    quantity: 1,
    unit_price: 0,
    total_price: 0
  }]);

  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCustomers();
    if (invoice) {
      setFormData({
        invoice_number: invoice.invoice_number || '',
        customer_id: invoice.customer_id || '',
        invoice_date: invoice.invoice_date?.split('T')[0] || new Date().toISOString().split('T')[0],
        due_date: invoice.due_date?.split('T')[0] || new Date().toISOString().split('T')[0],
        status: invoice.status || 'draft',
        tax_rate: invoice.tax_rate || 0,
        discount_amount: invoice.discount_amount || 0,
        notes: invoice.notes || '',
        terms: invoice.terms || 'Paiement sous 30 jours',
      });
      fetchInvoiceItems(invoice.id);
    }
  }, [invoice]);

  const fetchCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('id, customer_number, company_name, contact_name')
      .eq('active', true);
    setCustomers(data || []);
  };

  const fetchInvoiceItems = async (invoiceId: string) => {
    const { data } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('item_order');
    if (data && data.length > 0) {
      setItems(data.map(item => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price || (item.quantity * item.unit_price)
      })));
    }
  };

  const handleAddItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0, total_price: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total_price = newItems[index].quantity * newItems[index].unit_price;
    }
    setItems(newItems);
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
    const tax_amount = (subtotal * formData.tax_rate) / 100;
    const total_amount = subtotal + tax_amount - formData.discount_amount;
    return { subtotal, tax_amount, total_amount };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { subtotal, tax_amount, total_amount } = calculateTotals();

      const invoiceData = {
        ...formData,
        subtotal,
        tax_amount,
        total_amount,
        balance_due: total_amount - (invoice?.amount_paid || 0),
        created_by: user?.id,
      };

      let invoiceId = invoice?.id;

      if (invoice?.id) {
        const { error } = await supabase
          .from('invoices')
          .update(invoiceData)
          .eq('id', invoice.id);
        if (error) throw error;

        await supabase.from('invoice_items').delete().eq('invoice_id', invoice.id);
      } else {
        const { data, error } = await supabase
          .from('invoices')
          .insert([invoiceData])
          .select()
          .single();
        if (error) throw error;
        invoiceId = data.id;
      }

      const itemsToInsert = items.map((item, index) => ({
        invoice_id: invoiceId,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        item_order: index,
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsToInsert);
      if (itemsError) throw itemsError;

      onClose(true);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, tax_amount, total_amount } = calculateTotals();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col my-8">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {invoice ? 'Modifier la facture' : 'Nouvelle facture'}
              </h2>
              {invoice && <p className="text-sm text-slate-600">{formData.invoice_number}</p>}
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
                <label className="block text-sm font-medium text-slate-700 mb-2">N° Facture *</label>
                <input
                  type="text"
                  required
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="INV-2025-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Client *</label>
                <select
                  required
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="">Sélectionner un client</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name} ({c.customer_number})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Date de facture *</label>
                <input
                  type="date"
                  required
                  value={formData.invoice_date}
                  onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Date d'échéance *</label>
                <input
                  type="date"
                  required
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Statut</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="draft">Brouillon</option>
                  <option value="sent">Envoyée</option>
                  <option value="paid">Payée</option>
                  <option value="cancelled">Annulée</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Lignes de facture</h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                >
                  <Plus className="w-5 h-5" />
                  Ajouter une ligne
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="flex gap-3 items-start p-4 bg-slate-50 rounded-lg">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="md:col-span-2">
                        <input
                          type="text"
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                          required
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          placeholder="Quantité"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                          required
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          placeholder="Prix unitaire"
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          min="0"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                          required
                        />
                      </div>
                    </div>
                    <div className="w-32 px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-right font-semibold">
                      {(item.total_price / 1000).toLocaleString()}K
                    </div>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Taux de taxe (%)</label>
                <input
                  type="number"
                  value={formData.tax_rate}
                  onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 0 })}
                  min="0"
                  max="100"
                  step="0.1"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Remise (GNF)</label>
                <input
                  type="number"
                  value={formData.discount_amount}
                  onChange={(e) => setFormData({ ...formData, discount_amount: parseFloat(e.target.value) || 0 })}
                  min="0"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Résumé</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-slate-700">
                  <span>Sous-total</span>
                  <span className="font-medium">{(subtotal / 1000000).toFixed(2)}M GNF</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Taxe ({formData.tax_rate}%)</span>
                  <span className="font-medium">{(tax_amount / 1000000).toFixed(2)}M GNF</span>
                </div>
                {formData.discount_amount > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>Remise</span>
                    <span className="font-medium text-red-600">-{(formData.discount_amount / 1000000).toFixed(2)}M GNF</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t border-slate-300">
                  <span>Total</span>
                  <span>{(total_amount / 1000000).toFixed(2)}M GNF</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Conditions de paiement</label>
              <textarea
                value={formData.terms}
                onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                rows={2}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                placeholder="Notes additionnelles..."
              />
            </div>
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
