import { X, FileText } from 'lucide-react';

interface InvoiceDetailsModalProps {
  invoice: any;
  onClose: (saved: boolean) => void;
}

export const InvoiceDetailsModal = ({ invoice, onClose }: InvoiceDetailsModalProps) => {
  if (!invoice) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Détails de la facture</h2>
              <p className="text-sm text-slate-600">{invoice.invoice_number}</p>
            </div>
          </div>
          <button onClick={() => onClose(false)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
            <X className="w-6 h-6 text-slate-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-white p-8 border border-slate-200 rounded-lg">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">FACTURE</h1>
                <p className="text-sm text-slate-600">N° {invoice.invoice_number}</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-600">Date</div>
                <div className="font-semibold">
                  {new Date(invoice.invoice_date).toLocaleDateString('fr-FR')}
                </div>
                <div className="text-sm text-slate-600 mt-2">Échéance</div>
                <div className="font-semibold">
                  {new Date(invoice.due_date).toLocaleDateString('fr-FR')}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <div className="text-sm font-semibold text-slate-600 mb-2">FACTURÉ À</div>
                <div className="font-semibold text-slate-900">{invoice.customer?.company_name}</div>
                <div className="text-slate-600">{invoice.customer?.contact_name}</div>
              </div>
            </div>

            <div className="border-t border-b border-slate-200 py-4 mb-4">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm font-semibold text-slate-600">
                    <th className="pb-2">Description</th>
                    <th className="pb-2 text-right">Quantité</th>
                    <th className="pb-2 text-right">Prix unitaire</th>
                    <th className="pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  <tr>
                    <td className="py-2">Transport de bauxite - Période du {new Date(invoice.period_start || invoice.invoice_date).toLocaleDateString('fr-FR')} au {new Date(invoice.period_end || invoice.due_date).toLocaleDateString('fr-FR')}</td>
                    <td className="py-2 text-right">{invoice.total_tonnage || 0} tonnes</td>
                    <td className="py-2 text-right">{((invoice.unit_rate || 0) / 1000).toLocaleString()} GNF</td>
                    <td className="py-2 text-right font-semibold">{((invoice.total_amount || 0) / 1000000).toFixed(2)}M GNF</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <div className="w-64">
                <div className="flex justify-between py-2">
                  <span className="text-slate-600">Sous-total</span>
                  <span className="font-semibold">{((invoice.subtotal || invoice.total_amount || 0) / 1000000).toFixed(2)}M GNF</span>
                </div>
                {invoice.tax_amount > 0 && (
                  <div className="flex justify-between py-2">
                    <span className="text-slate-600">Taxe</span>
                    <span className="font-semibold">{((invoice.tax_amount || 0) / 1000000).toFixed(2)}M GNF</span>
                  </div>
                )}
                {invoice.discount_amount > 0 && (
                  <div className="flex justify-between py-2">
                    <span className="text-slate-600">Remise</span>
                    <span className="font-semibold text-red-600">-{((invoice.discount_amount || 0) / 1000000).toFixed(2)}M GNF</span>
                  </div>
                )}
                <div className="flex justify-between py-3 border-t border-slate-300">
                  <span className="font-bold text-slate-900">TOTAL</span>
                  <span className="font-bold text-xl text-slate-900">
                    {((invoice.total_amount || 0) / 1000000).toFixed(2)}M GNF
                  </span>
                </div>
                {invoice.amount_paid > 0 && (
                  <>
                    <div className="flex justify-between py-2">
                      <span className="text-green-600">Payé</span>
                      <span className="font-semibold text-green-600">
                        -{((invoice.amount_paid || 0) / 1000000).toFixed(2)}M GNF
                      </span>
                    </div>
                    <div className="flex justify-between py-3 border-t border-slate-300">
                      <span className="font-bold text-orange-600">SOLDE DÛ</span>
                      <span className="font-bold text-xl text-orange-600">
                        {((invoice.balance_due || 0) / 1000000).toFixed(2)}M GNF
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {invoice.terms && (
              <div className="mt-8 pt-6 border-t border-slate-200">
                <div className="text-sm font-semibold text-slate-600 mb-2">CONDITIONS</div>
                <div className="text-sm text-slate-700">{invoice.terms}</div>
              </div>
            )}

            {invoice.notes && (
              <div className="mt-4">
                <div className="text-sm font-semibold text-slate-600 mb-2">NOTES</div>
                <div className="text-sm text-slate-700">{invoice.notes}</div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3 bg-slate-50">
          <button
            onClick={() => onClose(false)}
            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
