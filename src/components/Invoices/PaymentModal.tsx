import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Save, DollarSign } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface PaymentModalProps {
  invoice: any;
  onClose: (saved: boolean) => void;
}

export const PaymentModal = ({ invoice, onClose }: PaymentModalProps) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    payment_number: '',
    invoice_id: '',
    customer_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    amount: 0,
    payment_method: 'bank_transfer',
    reference_number: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (invoice) {
      setFormData({
        payment_number: 'PAY-' + new Date().toISOString().split('T')[0].replace(/-/g, '') + '-' + Math.floor(Math.random() * 1000),
        invoice_id: invoice.id,
        customer_id: invoice.customer_id,
        payment_date: new Date().toISOString().split('T')[0],
        amount: invoice.balance_due || invoice.total_amount || 0,
        payment_method: 'bank_transfer',
        reference_number: '',
        notes: `Paiement pour facture ${invoice.invoice_number}`,
      });
    }
  }, [invoice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const paymentData = {
        ...formData,
        received_by: user?.id,
      };

      const { error: paymentError } = await supabase
        .from('payments')
        .insert([paymentData]);
      if (paymentError) throw paymentError;

      const newAmountPaid = (invoice.amount_paid || 0) + formData.amount;
      const newBalanceDue = (invoice.total_amount || 0) - newAmountPaid;
      const newStatus = newBalanceDue <= 0 ? 'paid' : invoice.status;

      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          amount_paid: newAmountPaid,
          balance_due: newBalanceDue,
          status: newStatus,
        })
        .eq('id', invoice.id);
      if (invoiceError) throw invoiceError;

      onClose(true);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const maxPayment = invoice?.balance_due || invoice?.total_amount || 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Enregistrer un paiement</h2>
              <p className="text-sm text-slate-600">{invoice?.invoice_number}</p>
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

          {invoice && (
            <div className="bg-blue-50 rounded-lg p-4 mb-6 border border-blue-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-600 font-medium">Client:</span>
                  <span className="ml-2 text-slate-900">{invoice.customer?.company_name}</span>
                </div>
                <div>
                  <span className="text-blue-600 font-medium">Montant total:</span>
                  <span className="ml-2 text-slate-900 font-semibold">
                    {((invoice.total_amount || 0) / 1000000).toFixed(2)}M GNF
                  </span>
                </div>
                <div>
                  <span className="text-blue-600 font-medium">Déjà payé:</span>
                  <span className="ml-2 text-green-600 font-semibold">
                    {((invoice.amount_paid || 0) / 1000000).toFixed(2)}M GNF
                  </span>
                </div>
                <div>
                  <span className="text-blue-600 font-medium">Solde dû:</span>
                  <span className="ml-2 text-orange-600 font-bold text-lg">
                    {((invoice.balance_due || invoice.total_amount || 0) / 1000000).toFixed(2)}M GNF
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">N° Paiement *</label>
                <input
                  type="text"
                  required
                  value={formData.payment_number}
                  onChange={(e) => setFormData({ ...formData, payment_number: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Date de paiement *</label>
                <input
                  type="date"
                  required
                  value={formData.payment_date}
                  onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Montant (GNF) *</label>
                <input
                  type="number"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  min="1"
                  max={maxPayment}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Maximum: {(maxPayment / 1000000).toFixed(2)}M GNF
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Méthode de paiement *</label>
                <select
                  required
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="bank_transfer">Virement bancaire</option>
                  <option value="cash">Espèces</option>
                  <option value="check">Chèque</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="credit">Crédit</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Numéro de référence</label>
                <input
                  type="text"
                  value={formData.reference_number}
                  onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="Numéro de transaction, chèque, etc."
                />
              </div>

              <div className="md:col-span-2">
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

            {formData.amount > 0 && (
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="text-sm font-medium text-green-900 mb-2">Après ce paiement:</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-green-600">Montant payé:</span>
                    <span className="ml-2 font-semibold text-slate-900">
                      {(((invoice?.amount_paid || 0) + formData.amount) / 1000000).toFixed(2)}M GNF
                    </span>
                  </div>
                  <div>
                    <span className="text-green-600">Solde restant:</span>
                    <span className="ml-2 font-semibold text-slate-900">
                      {(((invoice?.total_amount || 0) - (invoice?.amount_paid || 0) - formData.amount) / 1000000).toFixed(2)}M GNF
                    </span>
                  </div>
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
              disabled={loading || formData.amount <= 0 || formData.amount > maxPayment}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {loading ? 'Enregistrement...' : 'Enregistrer le paiement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
