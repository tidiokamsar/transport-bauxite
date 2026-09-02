import { useEffect, useState } from 'react';
import { X, ArrowUpCircle, ArrowDownCircle, RefreshCw, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface StockMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: any;
}

export const StockMovementModal = ({ isOpen, onClose, item }: StockMovementModalProps) => {
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && item) {
      fetchMovements();
    }
  }, [isOpen, item]);

  const fetchMovements = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('item_id', item.id)
        .order('performed_at', { ascending: false });

      if (error) throw error;
      setMovements(data || []);
    } catch (error) {
      console.error('Error fetching movements:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !item) return null;

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'entry':
        return <ArrowUpCircle className="w-5 h-5 text-green-600" />;
      case 'exit':
        return <ArrowDownCircle className="w-5 h-5 text-orange-600" />;
      case 'adjustment':
        return <RefreshCw className="w-5 h-5 text-blue-600" />;
      default:
        return <RefreshCw className="w-5 h-5 text-slate-600" />;
    }
  };

  const getMovementLabel = (type: string) => {
    switch (type) {
      case 'entry':
        return 'Entrée';
      case 'exit':
        return 'Sortie';
      case 'adjustment':
        return 'Ajustement';
      case 'transfer':
        return 'Transfert';
      default:
        return type;
    }
  };

  const getMovementColor = (type: string) => {
    switch (type) {
      case 'entry':
        return 'bg-green-100 text-green-800';
      case 'exit':
        return 'bg-orange-100 text-orange-800';
      case 'adjustment':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getQuantity = (qty: any) => {
    return typeof qty === 'string' ? parseFloat(qty) : qty;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />

        <div className="relative bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Historique des mouvements</h2>
              <p className="text-sm text-slate-600">{item.code} - {item.name}</p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6">
            <div className="mb-6 p-4 bg-slate-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-slate-600">Code</p>
                  <p className="font-medium text-slate-900">{item.code}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Article</p>
                  <p className="font-medium text-slate-900">{item.name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Stock actuel</p>
                  <p className="text-lg font-bold text-slate-900">
                    {getQuantity(item.quantity).toLocaleString()} {item.unit}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Mouvements</p>
                  <p className="text-lg font-bold text-slate-900">{movements.length}</p>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
              </div>
            ) : movements.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500">Aucun mouvement enregistré</p>
              </div>
            ) : (
              <div className="space-y-4">
                {movements.map((movement) => (
                  <div
                    key={movement.id}
                    className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-white rounded-lg border border-slate-200">
                        {getMovementIcon(movement.movement_type)}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${getMovementColor(movement.movement_type)}`}>
                                {getMovementLabel(movement.movement_type)}
                              </span>
                              {movement.reason && (
                                <span className="text-sm text-slate-600">• {movement.reason}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                              <Calendar className="w-4 h-4" />
                              {new Date(movement.performed_at).toLocaleString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className={`text-lg font-bold ${
                              movement.quantity > 0 ? 'text-green-600' : 'text-orange-600'
                            }`}>
                              {movement.quantity > 0 ? '+' : ''}{getQuantity(movement.quantity).toLocaleString()} {item.unit}
                            </div>
                            <div className="text-sm text-slate-600">
                              {getQuantity(movement.previous_quantity).toLocaleString()} → {getQuantity(movement.new_quantity).toLocaleString()}
                            </div>
                          </div>
                        </div>

                        {movement.reference && (
                          <div className="mt-2 text-sm text-slate-600">
                            <span className="font-medium">Réf:</span> {movement.reference}
                          </div>
                        )}

                        {movement.notes && (
                          <div className="mt-2 text-sm text-slate-700 bg-slate-50 p-2 rounded">
                            {movement.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-6 border-t border-slate-200 mt-6">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
