import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { X, CheckSquare, Send, Trash2, Edit } from 'lucide-react';

interface BulkActionsModalProps {
  selectedInvoiceIds: string[];
  onClose: (saved: boolean) => void;
  onComplete: () => void;
}

export const BulkActionsModal = ({ selectedInvoiceIds, onClose, onComplete }: BulkActionsModalProps) => {
  const [action, setAction] = useState<'status' | 'delete' | ''>('');
  const [newStatus, setNewStatus] = useState('sent');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleBulkAction = async () => {
    if (!action) return;

    setLoading(true);
    setError('');

    try {
      if (action === 'status') {
        const { error: updateError } = await supabase
          .from('invoices')
          .update({ status: newStatus })
          .in('id', selectedInvoiceIds);
        if (updateError) throw updateError;
      } else if (action === 'delete') {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer ${selectedInvoiceIds.length} facture(s) ?`)) {
          setLoading(false);
          return;
        }
        const { error: deleteError } = await supabase
          .from('invoices')
          .delete()
          .in('id', selectedInvoiceIds);
        if (deleteError) throw deleteError;
      }

      onComplete();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <CheckSquare className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Actions groupées</h2>
              <p className="text-sm text-slate-600">{selectedInvoiceIds.length} facture(s) sélectionnée(s)</p>
            </div>
          </div>
          <button onClick={() => onClose(false)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
            <X className="w-6 h-6 text-slate-600" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Action à effectuer</label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value as any)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              >
                <option value="">Sélectionner une action</option>
                <option value="status">Changer le statut</option>
                <option value="delete">Supprimer</option>
              </select>
            </div>

            {action === 'status' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nouveau statut</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="draft">Brouillon</option>
                  <option value="sent">Envoyée</option>
                  <option value="paid">Payée</option>
                  <option value="cancelled">Annulée</option>
                </select>
              </div>
            )}

            {action === 'delete' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Trash2 className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-900">Attention</p>
                    <p className="text-xs text-red-700 mt-1">
                      Cette action est irréversible. Les {selectedInvoiceIds.length} facture(s) sélectionnée(s) seront définitivement supprimées.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 mt-6">
            <button
              onClick={() => onClose(false)}
              disabled={loading}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={handleBulkAction}
              disabled={loading || !action}
              className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${
                action === 'delete'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <CheckSquare className="w-5 h-5" />
              {loading ? 'Traitement...' : 'Appliquer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
