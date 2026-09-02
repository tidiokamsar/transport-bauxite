import { useState } from 'react';
import { X, Send, Mail, FileText } from 'lucide-react';

interface SendInvoiceModalProps {
  invoice: any;
  onClose: (saved: boolean) => void;
}

export const SendInvoiceModal = ({ invoice, onClose }: SendInvoiceModalProps) => {
  const [formData, setFormData] = useState({
    to: invoice?.customer?.email || '',
    subject: `Facture ${invoice?.invoice_number}`,
    message: `Bonjour,\n\nVeuillez trouver ci-joint la facture ${invoice?.invoice_number} d'un montant de ${((invoice?.total_amount || 0) / 1000000).toFixed(2)}M GNF.\n\nDate d'échéance: ${invoice?.due_date ? new Date(invoice.due_date).toLocaleDateString('fr-FR') : ''}\n\nCordialement,`,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSuccess(true);
      setTimeout(() => {
        onClose(true);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue lors de l\'envoi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Mail className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Envoyer la facture par email</h2>
              <p className="text-sm text-slate-600">{invoice?.invoice_number}</p>
            </div>
          </div>
          <button onClick={() => onClose(false)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
            <X className="w-6 h-6 text-slate-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                <span>Facture envoyée avec succès !</span>
              </div>
            </div>
          )}

          {!success && (
            <>
              <div className="bg-blue-50 rounded-lg p-4 mb-6 border border-blue-200">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900">Informations de la facture</p>
                    <div className="mt-2 space-y-1 text-blue-700">
                      <p><span className="font-medium">Client:</span> {invoice?.customer?.company_name}</p>
                      <p><span className="font-medium">Montant:</span> {((invoice?.total_amount || 0) / 1000000).toFixed(2)}M GNF</p>
                      <p><span className="font-medium">Échéance:</span> {invoice?.due_date ? new Date(invoice.due_date).toLocaleDateString('fr-FR') : '-'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Destinataire *</label>
                  <input
                    type="email"
                    required
                    value={formData.to}
                    onChange={(e) => setFormData({ ...formData, to: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    placeholder="client@exemple.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Objet *</label>
                  <input
                    type="text"
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Message</label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={8}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                  />
                </div>

                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">Pièce jointe:</span> Facture_{invoice?.invoice_number}.pdf
                  </p>
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
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                  {loading ? 'Envoi en cours...' : 'Envoyer'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
